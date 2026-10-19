// opencode-v2-adapter.spec.mjs — EX2-VAL-03 (SPEC T2, RF-01 + RF-02).
//
// Contract of the v2-only adapter, MEASURED on the installed runtime
// (opencode v2.0.32) — the /docs/plugins/ page is stale on this point:
//
//   - every plugin module default is an OBJECT `{ id, setup }`; a bare
//     function default is rejected by the loader schema
//     ("Plugin must export a default definition with an id and an effect
//     or setup function").
//   - `await setup(ctx)` NEVER throws on a well-formed ctx and returns
//     `undefined` — the runtime hands the return value to
//     Effect.acquireRelease and CALLS a truthy value (the old
//     `TypeError: t is not a function`).
//   - gate.js registers the single confirmed tool hook
//     `ctx.tool.hook("execute.before", runGatesShim)` and subscribes the
//     confirmed turn-boundary event stream via `ctx.event.subscribe()`.
//   - a v1 surface with no confirmed v2 equivalent FAILS VISIBLY
//     (HOOK-NO-EQUIV / GATE-ABSENT), never a silent no-op.
//
// The deny/allow matrix at the bottom proves >=1 deny + >=1 allow per core
// gate THROUGH this single entry (handler captured from `setup`), pinning the
// same verdicts the pre-migration matrix pinned (RF-02). One row is a
// documented exception: GATE-01 (the dispatcher itself) is asserted at decide()
// level, since the handler's only deny path IS the dispatcher — see 🟢-10.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import gateDefault, {
  setup as gateSetup,
  runGatesShim,
  V2_TOOL_HOOK,
  V2_TOOL_KEYS,
  V2_FORBIDDEN_HOOKS,
  DenyError,
  decide,
  resetHitlTracker,
  noteTurnBoundary,
  hitlTrackerFor,
  clearSessionAgents,
} from "../gate.js";
import validatorDefault, { setup as validatorSetup } from "../harness-validator.js";
import guardrailDefault, { setup as guardrailSetup } from "../hitl-guardrail.js";

const PLUGINS = [
  { name: "harness-gate", mod: gateDefault, setup: gateSetup },
  { name: "harness-validator", mod: validatorDefault, setup: validatorSetup },
  { name: "hitl-guardrail", mod: guardrailDefault, setup: guardrailSetup },
];

// A confirmed v2 ctx: the tool hook plus the event stream. `subscribe()`
// returns an async iterable (the runtime's confirmed shape); it takes NO
// name argument — the old "subscribe by name" dual contract is gone.
function v2Stub({ rejectTool = null } = {}) {
  const calls = [];
  const ctx = {
    tool: {
      hook: async (tool, handler) => {
        if (rejectTool !== null && tool === rejectTool) {
          throw new Error(`stub rejects tool:${tool}`);
        }
        calls.push({ api: "tool.hook", tool, handler });
      },
    },
    event: {
      subscribe: () => {
        calls.push({ api: "event.subscribe" });
        return { [Symbol.asyncIterator]: async function* () {} };
      },
    },
  };
  return { ctx, calls };
}

function quietLogger() {
  return { warn() {}, error() {} };
}

describe("EX2-VAL-03 — adapter export contract (v2-only, measured)", () => {
  for (const plugin of PLUGINS) {
    it(`${plugin.name}: default is an object { id, setup }, never a bare function and never a \`server\` key`, () => {
      assert.equal(typeof plugin.mod, "object", "default export is an object");
      assert.notEqual(plugin.mod, null);
      assert.equal(plugin.mod.id, plugin.name, "id matches the plugin name");
      assert.equal(typeof plugin.mod.setup, "function", "setup present on the default");
      assert.ok(
        !("server" in plugin.mod),
        "v1 `server` entry removed (owner decision: v2-only)",
      );
      assert.ok(
        !("plugin" in plugin.mod) && !("hooks" in plugin.mod),
        "no undocumented default keys",
      );
    });

    it(`${plugin.name}: await setup(ctx) does not throw and returns undefined (acquireRelease contract)`, async () => {
      const { ctx } = v2Stub();
      const result = await plugin.setup(ctx);
      assert.equal(
        result,
        undefined,
        "a truthy return is handed to Effect.acquireRelease and called => TypeError",
      );
    });
  }

  it("setup() with a well-formed ctx registers hooks and still returns undefined", async () => {
    const { ctx, calls } = v2Stub();
    const result = await gateSetup(ctx);
    assert.equal(result, undefined);
    assert.ok(calls.length > 0, "well-formed ctx registers hooks");
  });

  it("setup() twice on the same ctx is idempotent (no duplicate deny, still undefined)", async () => {
    const { ctx, calls } = v2Stub();
    const first = await gateSetup(ctx);
    const countAfterFirst = calls.length;
    assert.equal(first, undefined);
    assert.ok(countAfterFirst > 0, "first setup registers hooks");
    const second = await gateSetup(ctx);
    assert.equal(second, undefined, "second setup returns undefined");
    assert.equal(calls.length, countAfterFirst, "second setup adds no hook calls");
  });
});

describe("EX2-VAL-03 — gate.js registers the confirmed v2 surfaces", () => {
  it("registers exactly one tool hook: ctx.tool.hook(\"execute.before\", runGatesShim)", async () => {
    const { ctx, calls } = v2Stub();
    await gateSetup(ctx);
    const toolCalls = calls.filter((c) => c.api === "tool.hook");
    assert.equal(toolCalls.length, 1, "a single registration covers every gate-bearing tool");
    assert.equal(toolCalls[0].tool, V2_TOOL_HOOK);
    assert.equal(V2_TOOL_HOOK, "execute.before");
    assert.equal(toolCalls[0].handler, runGatesShim, "the shared deny loop, no per-gate fork");
  });

  it("V2_TOOL_KEYS names every gate-bearing tool the single hook covers", () => {
    assert.deepEqual(
      V2_TOOL_KEYS,
      ["task", "write", "edit", "apply_patch", "patch", "bash", "shell"],
    );
  });

  it("subscribes the confirmed turn-boundary stream via ctx.event.subscribe (no name arg)", async () => {
    const { ctx, calls } = v2Stub();
    await gateSetup(ctx);
    const subs = calls.filter((c) => c.api === "event.subscribe");
    assert.equal(subs.length, 1, "one confirmed subscription replaces the v1 chat.message hook");
    assert.equal(subs[0].name, undefined, "the stream carries the boundary; no named dual event");
  });

  it("never registers a forbidden hook (H1 ask) on any api", async () => {
    const { ctx, calls } = v2Stub();
    await gateSetup(ctx);
    for (const name of V2_FORBIDDEN_HOOKS) {
      const hit = calls.find(
        (c) => c.tool === name || c.event === name || c.name === name,
      );
      assert.equal(hit, undefined, `forbidden hook never registered: ${name}`);
    }
  });

  it("a rejected execute.before registration fails LOUDLY as GATE-ABSENT (never a silent allow)", async () => {
    const { ctx } = v2Stub({ rejectTool: V2_TOOL_HOOK });
    await assert.rejects(gateSetup(ctx), /GATE-ABSENT:execute\.before/);
  });

  it("a ctx without ctx.tool.hook fails LOUDLY as HOOK-NO-EQUIV (never a silent no-op)", async () => {
    await assert.rejects(gateSetup({}), /HOOK-NO-EQUIV:ctx\.tool\.hook/);
    await assert.rejects(
      gateSetup({ event: { subscribe: () => {} } }),
      /HOOK-NO-EQUIV:ctx\.tool\.hook/,
    );
  });

  it("a ctx without the event stream logs an explicit HOOK-NO-EQUIV warning (never silence)", async () => {
    const errors = [];
    const orig = console.error;
    console.error = (...a) => errors.push(a.map(String).join(" "));
    try {
      const result = await gateSetup({ tool: { hook: async () => {} } });
      assert.equal(result, undefined, "still returns undefined with the tool hook present");
    } finally {
      console.error = orig;
    }
    assert.ok(
      errors.some((e) => e.includes("HOOK-NO-EQUIV:ctx.event.subscribe")),
      `explicit warning for the missing stream, got ${JSON.stringify(errors)}`,
    );
  });
});

// ---------------------------------------------------------------------------
// 🔴-1 (Batch 1 review): the PRODUCTION envelope branch of runGatesShim
// (gate.js isEvent normalization: `input` -> `args`) had ZERO coverage — the
// matrix below only fed the legacy `args`/two-arg shapes. These tests drive the
// handler `setup` registered with the MEASURED v2 payload
// {tool, sessionID, agent, messageID, id, input} — no injected seam.
// ---------------------------------------------------------------------------
describe("EX2-VAL-03 — measured production envelope (input -> args normalization)", () => {
  it("task event with no PICCO tags denies picco-tag-absent through the registered handler", async () => {
    const handler = await registeredHandler();
    await assert.rejects(
      () =>
        handler({
          tool: "task",
          sessionID: freshSid("v2-env-picco"),
          agent: "orchestrator",
          messageID: "msg-env-picco",
          id: "call-env-picco",
          input: { prompt: "sem tags" },
        }),
      (err) => err instanceof DenyError && err.reason === "picco-tag-absent",
      "the measured envelope reaches gatePiccoTask with args derived from input",
    );
  });

  it("bash event denies pkill-f: input.command reaches ctx.args (the branch is load-bearing)", async () => {
    // Load-bearing proof of the isEvent branch: if `input` is NOT normalized to
    // `args` (mutant `{ args: undefined }`), extractBashCommand("") finds no
    // pkill and the call is ALLOWED — this assertion then bleeds.
    const handler = await registeredHandler();
    await assert.rejects(
      () =>
        handler({
          tool: "bash",
          sessionID: freshSid("v2-env-bash"),
          agent: "orchestrator",
          messageID: "msg-env-bash",
          id: "call-env-bash",
          input: { command: "pkill -f worker" },
        }),
      (err) => err instanceof DenyError && err.reason === "pkill-f",
      "the measured envelope reaches gateShellHygiene with args derived from input",
    );
  });
});

// ---------------------------------------------------------------------------
// 🔴-2 (Batch 1 review): the two REAL v2 feeds had zero coverage — the suite
// only exercised the unregistered v1 shims. (a) the human-turn boundary from
// the event stream (noteTurnBoundary); (b) the session→agent identity fed from
// the execute.before payload (recordSessionAgent).
// ---------------------------------------------------------------------------
describe("EX2-VAL-03 — v2 feeds (turn boundary + payload agent) are load-bearing", () => {
  const BOUNDARY_SHAPES = [
    ["session.idle", { sessionID: "S" }],
    ["message.updated", { sessionID: "S", info: { role: "user" } }],
    ["session.step.ended", { sessionID: "S", finish: "stop" }],
  ];

  for (const [type, data] of BOUNDARY_SHAPES) {
    it(`noteTurnBoundary resets the HITL counter on the measured ${type} event`, () => {
      const sid = freshSid(`v2-boundary-${type}`);
      hitlTrackerFor(sid).onTask("developer-engineer");
      hitlTrackerFor(sid).onTask("code-reviewer");
      assert.equal(hitlTrackerFor(sid).pending(), 2, "two tasks recorded before the boundary");
      const event = { id: `evt-${type}`, created: Date.now(), type, data: { ...data, sessionID: sid } };
      assert.equal(noteTurnBoundary(event), true, `${type} is a turn boundary`);
      assert.equal(hitlTrackerFor(sid).pending(), 0, `${type} reset the per-session tracker`);
    });
  }

  it("a non-boundary event does NOT reset (the feed is not vacuous)", () => {
    const sid = freshSid("v2-boundary-neg");
    hitlTrackerFor(sid).onTask("developer-engineer");
    const event = {
      id: "evt-neg",
      created: Date.now(),
      type: "message.updated",
      data: { sessionID: sid, info: { role: "assistant" } },
    };
    assert.equal(noteTurnBoundary(event), false, "an assistant message is not a human turn");
    assert.equal(hitlTrackerFor(sid).pending(), 1, "counter kept");
  });

  it("the payload.agent feed persists: a later agent-less write from that session still denies", async () => {
    // (b) the payload carries the agent identity (measured envelope). The feed
    // must survive for the session: a second call WITHOUT `agent` resolves the
    // subject through the session map. Remove the recordSessionAgent call and
    // the second call is ALLOWED — this assertion then bleeds.
    clearSessionAgents();
    const handler = await registeredHandler();
    const sid = freshSid("v2-agent-feed");
    const feed = await handler({
      tool: "bash",
      sessionID: sid,
      agent: "orchestrator",
      messageID: "msg-feed",
      id: "call-feed",
      input: { command: "echo ok" },
    });
    assert.equal(feed?.verdict ?? "allow", "allow", "the feeding call is allowed");
    await assert.rejects(
      () =>
        handler({
          tool: "write",
          sessionID: sid,
          messageID: "msg-write",
          id: "call-write",
          input: { filePath: "src/app.js", content: "console.log(1)" },
        }),
      (err) => err instanceof DenyError && err.reason === "orch-write-outside-allowlist",
      "the orchestrator identity from the earlier payload still denies the write",
    );
    clearSessionAgents();
  });
});

// ---------------------------------------------------------------------------
// Deny/allow matrix — >=1 deny + >=1 allow per core gate, routed through the
// SAME handler `setup` registered (proves the adapter reaches the pure cores,
// and the verdicts are the ones the pre-migration matrix pinned, RF-02).
//
// Documented exception (🟢-10 of the Batch 1 review): the GATE-01 row below
// asserts the DISPATCHER at decide() level (a synthetic gate) — it is the only
// row that does not pass through the handler, and it is labelled as such. Every
// other row (and the GATE-01 kill-switch ALLOW row) goes through the handler.
// ---------------------------------------------------------------------------
const VALID_PICCO =
  "<role>dev</role><task>fix widget</task><context>repo</context>" +
  "<constraints>none</constraints><acceptance>tests green</acceptance>" +
  "<open_questions></open_questions>";

const ENFORCE = {
  protectedPaths: [],
  gates: { picco: "enforce", evidence: "enforce", hitlBatch: "enforce" },
};

const CLOSED = {
  current_phase: "Completed",
  harness_status: "passed",
  code_review_status: "passed",
  current_feature: "matrix-closed-fixture",
};

const tmpRoots = [];
function tempStatePath(state) {
  const dir = mkdtempSync(join(tmpdir(), "ex2-val-03-"));
  tmpRoots.push(dir);
  const file = join(dir, "workflow-state.json");
  writeFileSync(file, JSON.stringify(state));
  return file;
}
after(() => {
  for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true });
});

let sidCounter = 0;
const freshSid = (prefix) => `${prefix}-${Date.now()}-${sidCounter++}`;

async function registeredHandler() {
  const { ctx, calls } = v2Stub();
  const result = await gateSetup(ctx);
  assert.equal(result, undefined, "setup returns undefined");
  const reg = calls.find((c) => c.api === "tool.hook");
  assert.ok(reg, "execute.before registered");
  assert.equal(reg.handler, runGatesShim);
  return reg.handler;
}

async function runV2(envelope) {
  const handler = await registeredHandler();
  try {
    const verdict = await handler(envelope);
    return { outcome: "allow", via: verdict?.via ?? null };
  } catch (err) {
    if (err instanceof DenyError) {
      return { outcome: "deny", reason: err.reason };
    }
    throw err;
  }
}

describe("EX2-VAL-03 — deny/allow matrix through the v2 entry (per core gate)", () => {
  it("GATE-01 dispatcher (decide level): a DenyError propagates in enforce, allows in warn", async () => {
    const rows = [];
    for (const mode of ["enforce", "warn"]) {
      const outcome = await decide({
        gateFn: async () => {
          throw new DenyError("gate-01-probe", { probe: true });
        },
        mode,
        ctx: {},
        env: {},
        logger: quietLogger(),
      }).then(
        () => ({ outcome: "allow", mode }),
        (err) => {
          assert.ok(err instanceof DenyError, "only DenyError denies");
          return { outcome: "deny", reason: err.reason, mode };
        },
      );
      rows.push(outcome);
    }
    assert.deepEqual(rows[0], { outcome: "deny", reason: "gate-01-probe", mode: "enforce" });
    assert.equal(rows[1].outcome, "allow", "warn mode allows (same verdict both modes)");
  });

  it("GATE-01 ALLOW: HARNESS_GATES=off allows a denying input through the v2 entry", async () => {
    const closed = tempStatePath(CLOSED);
    const row = await runV2({
      tool: "task",
      sessionID: freshSid("v2-kill"),
      args: { prompt: "no tags at all, would deny without the kill-switch" },
      config: ENFORCE,
      statePath: closed,
      env: { HARNESS_GATES: "off" },
    });
    assert.equal(row.outcome, "allow");
    assert.equal(row.via, "kill-switch");
  });

  it("GATE-02 PICCO: deny (no tag) + allow (valid tag)", async () => {
    const closed = tempStatePath(CLOSED);
    const deny = await runV2({
      tool: "task",
      sessionID: freshSid("v2-picco-deny"),
      args: { prompt: "do the thing with no picco block at all" },
      config: ENFORCE,
      statePath: closed,
    });
    assert.deepEqual(deny, { outcome: "deny", reason: "picco-tag-absent" });
    const allow = await runV2({
      tool: "task",
      sessionID: freshSid("v2-picco-allow"),
      args: { prompt: VALID_PICCO },
      config: ENFORCE,
      statePath: closed,
    });
    assert.equal(allow.outcome, "allow");
  });

  it("GATE-03A anchor A: deny (orchestrator source write) + allow (allowlisted state write)", async () => {
    const deny = await runV2({
      tool: "write",
      sessionID: freshSid("v2-anchor-a-deny"),
      args: { filePath: "src/app.js", content: "console.log(1)" },
      sessionAgent: "orchestrator",
      config: ENFORCE,
    });
    assert.deepEqual(deny, { outcome: "deny", reason: "orch-write-outside-allowlist" });
    const allow = await runV2({
      tool: "write",
      sessionID: freshSid("v2-anchor-a-allow"),
      args: {
        filePath: "workflow-state.json",
        content: JSON.stringify({ current_feature: "f", current_phase: "Execution" }),
      },
      sessionAgent: "orchestrator",
      config: ENFORCE,
    });
    assert.equal(allow.outcome, "allow");
  });

  it("GATE-03B anchor B: deny (new cycle on open state) + allow (closed previous cycle)", async () => {
    const open = tempStatePath({
      current_phase: "BugCompleted",
      harness_status: "passed",
      code_review_status: "passed",
      current_feature: "feat-absent-xyz-never-mentioned",
    });
    const deny = await runV2({
      tool: "task",
      sessionID: freshSid("v2-anchor-b-deny"),
      args: { prompt: VALID_PICCO },
      config: ENFORCE,
      statePath: open,
    });
    assert.deepEqual(deny, { outcome: "deny", reason: "prev-cycle-not-completed" });
    const closed = tempStatePath(CLOSED);
    const allow = await runV2({
      tool: "task",
      sessionID: freshSid("v2-anchor-b-allow"),
      args: { prompt: VALID_PICCO },
      config: ENFORCE,
      statePath: closed,
    });
    assert.equal(allow.outcome, "allow");
  });

  it("GATE-04 HITL: allow, allow, deny (3rd consecutive task without a human turn)", async () => {
    const closed = tempStatePath(CLOSED);
    const sid = freshSid("v2-hitl");
    const outcomes = [];
    for (let i = 0; i < 3; i++) {
      outcomes.push(
        await runV2({
          tool: "task",
          sessionID: sid,
          args: { prompt: VALID_PICCO },
          config: ENFORCE,
          statePath: closed,
        }),
      );
    }
    resetHitlTracker(sid);
    assert.deepEqual(outcomes.map((r) => r.outcome), ["allow", "allow", "deny"]);
    assert.equal(outcomes[2].reason, "hitl-pause-required");
  });

  it("GATE-05 hygiene: deny (pkill -f) + allow (clean bash)", async () => {
    const deny = await runV2({
      tool: "bash",
      sessionID: freshSid("v2-pkill"),
      args: { command: "pkill -f worker" },
      config: ENFORCE,
    });
    assert.deepEqual(deny, { outcome: "deny", reason: "pkill-f" });
    const allow = await runV2({
      tool: "bash",
      sessionID: freshSid("v2-bash-ok"),
      args: { command: "echo hello" },
      config: ENFORCE,
    });
    assert.equal(allow.outcome, "allow");
  });

  it("GATE-01/ADR-006 fail-open: a generic Error inside a gate allows, never denies", async () => {
    const badConfig = {
      protectedPaths: 123,
      gates: { picco: "enforce", evidence: "enforce", hitlBatch: "enforce" },
    };
    const errors = [];
    const row = await runV2({
      tool: "bash",
      sessionID: freshSid("v2-failopen"),
      args: { command: "echo hi > out.txt" },
      config: badConfig,
      logger: { warn() {}, error(e) { errors.push(String(e?.message ?? e)); } },
    });
    assert.equal(row.outcome, "allow", "fail-open on a generic error");
    assert.equal(row.via, "plugin-error-fail-open");
    assert.ok(errors.length > 0, "fail-open logs at error level");
  });
});
