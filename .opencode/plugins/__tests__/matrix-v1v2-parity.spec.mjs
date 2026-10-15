// matrix-v1v2-parity.spec.mjs — PL-07 V2-VAL-10 (TDD FIRST).
//
// Full deny/allow matrix executed through BOTH entries with identical
// outcomes: the v1 `server` entry (HarnessGate → "tool.execute.before")
// and the v2 `setup` entry (setup(ctx) → captured runGatesShim).
// Parity = same outcome + same deny reason per row. Any divergence is a
// release-blocking defect (rollback, never advance to PL-08).
//
// Gate map (GATE-01..GATE-05, gate.js header):
//   GATE-01 dispatcher/DenyError/kill-switch/fail-open — rows KILL, FAILOPEN
//     + every deny row (propagation) proves the dispatcher 1:1.
//   GATE-02 PICCO (gatePiccoTask) — rows PICCO-DENY / PICCO-ALLOW.
//   GATE-03A completion anchor A (gateCompletionAnchorA) — row ANCHOR-A.
//   GATE-03B phase anchor B (gatePhaseAnchorB) — row ANCHOR-B.
//   GATE-04 HITL pause (gateHitlBatch) — row HITL.
//   GATE-05 shell hygiene (gateShellHygiene) — rows PKILL-DENY / BASH-ALLOW
//     + row GATES-OFF (hygiene has no gates.* key ⇒ still denies).
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  HarnessGate,
  setup,
  runGatesShim,
  noteChatParamsShim,
  resetHitlTracker,
  DenyError,
  V2_TOOL_KEYS,
} from "../gate.js";

const VALID_PICCO =
  "<role>dev</role><task>fix widget</task><context>repo</context>" +
  "<constraints>none</constraints><acceptance>tests green</acceptance>" +
  "<open_questions></open_questions>";

const ENFORCE = {
  protectedPaths: [],
  gates: { picco: "enforce", evidence: "enforce", hitlBatch: "enforce" },
};
const GATES_OFF = {
  protectedPaths: [],
  gates: { picco: "off", evidence: "off", hitlBatch: "off" },
};

const tmpRoots = [];
function tempStatePath(state) {
  const dir = mkdtempSync(join(tmpdir(), "pl07-matrix-"));
  tmpRoots.push(dir);
  const file = join(dir, "workflow-state.json");
  writeFileSync(file, JSON.stringify(state));
  return file;
}
after(() => {
  for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true });
});

const CLOSED = {
  current_phase: "Completed",
  harness_status: "passed",
  code_review_status: "passed",
  current_feature: "matrix-closed-fixture",
};
const OPEN = {
  current_phase: "BugCompleted",
  harness_status: "passed",
  code_review_status: "passed",
  current_feature: "feat-absent-xyz-never-mentioned",
};

let sidCounter = 0;
const freshSid = (prefix) => `${prefix}-${Date.now()}-${sidCounter++}`;

function v2Stub() {
  const calls = [];
  const ctx = {
    tool: {
      hook: async (tool, timing, handler) => {
        calls.push({ api: "tool.hook", tool, timing, handler });
      },
    },
    session: {
      hook: async (event, handler) => {
        calls.push({ api: "session.hook", event, handler });
      },
    },
    event: { subscribe: async () => {} },
  };
  return { ctx, calls };
}

// Capture the handler the v2 entry actually registered (proves the call
// goes through `setup`, not a direct import bypass).
async function v2HookFor(tool) {
  const { ctx, calls } = v2Stub();
  const result = await setup(ctx);
  assert.ok(result.registered.length > 0, "setup registers hooks");
  for (const key of V2_TOOL_KEYS) {
    const hit = calls.find((c) => c.api === "tool.hook" && c.tool === key);
    assert.ok(hit, `setup registered tool hook: ${key}`);
    assert.equal(hit.handler, runGatesShim, `handler for ${key} is runGatesShim`);
  }
  const hit = calls.find((c) => c.api === "tool.hook" && c.tool === tool);
  assert.ok(hit, `setup registered requested tool hook: ${tool}`);
  return hit.handler;
}

async function runV1(toolInput, toolOutput) {
  const hooks = await HarnessGate({});
  const handler = hooks["tool.execute.before"];
  assert.equal(typeof handler, "function", "v1 server exposes tool.execute.before");
  try {
    await handler(toolInput, toolOutput);
    return { outcome: "allow" };
  } catch (err) {
    if (err instanceof DenyError) {
      return { outcome: "deny", reason: err.reason, details: err.details };
    }
    throw err;
  }
}

async function runV2(tool, envelope) {
  const handler = await v2HookFor(tool);
  try {
    const verdict = await handler(envelope);
    return { outcome: "allow", via: verdict?.via ?? null };
  } catch (err) {
    if (err instanceof DenyError) {
      return { outcome: "deny", reason: err.reason, details: err.details };
    }
    throw err;
  }
}

function assertParity(v1, v2, row) {
  assert.equal(v1.outcome, v2.outcome, `${row}: v1×v2 outcome parity (${JSON.stringify(v1)} vs ${JSON.stringify(v2)})`);
  if (v1.outcome === "deny") {
    assert.equal(v2.reason, v1.reason, `${row}: v1×v2 deny reason parity`);
  }
}

describe("PL-07 V2-VAL-10 — matrix deny/allow v1(server)×v2(setup)", () => {
  it("PICCO-DENY (GATE-02): task without tag denies identically", async () => {
    const closed = tempStatePath(CLOSED);
    const v1 = await runV1(
      { tool: "task", sessionID: freshSid("v1-picco-deny"), config: ENFORCE, statePath: closed },
      { args: { prompt: "do the thing with no picco block at all" } },
    );
    const v2 = await runV2("task", {
      tool: "task",
      sessionID: freshSid("v2-picco-deny"),
      args: { prompt: "do the thing with no picco block at all" },
      config: ENFORCE,
      statePath: closed,
    });
    assert.equal(v1.outcome, "deny");
    assert.equal(v1.reason, "picco-tag-absent");
    assertParity(v1, v2, "PICCO-DENY");
  });

  it("PICCO-ALLOW (GATE-02): valid PICCO allows identically", async () => {
    const closed = tempStatePath(CLOSED);
    const v1 = await runV1(
      { tool: "task", sessionID: freshSid("v1-picco-allow"), config: ENFORCE, statePath: closed },
      { args: { prompt: VALID_PICCO } },
    );
    const v2 = await runV2("task", {
      tool: "task",
      sessionID: freshSid("v2-picco-allow"),
      args: { prompt: VALID_PICCO },
      config: ENFORCE,
      statePath: closed,
    });
    assert.equal(v1.outcome, "allow");
    assertParity(v1, v2, "PICCO-ALLOW");
  });

  it("PKILL-DENY (GATE-05): pkill -f denies identically", async () => {
    const v1 = await runV1(
      { tool: "bash", sessionID: freshSid("v1-pkill"), config: ENFORCE },
      { args: { command: "pkill -f worker" } },
    );
    const v2 = await runV2("bash", {
      tool: "bash",
      sessionID: freshSid("v2-pkill"),
      args: { command: "pkill -f worker" },
      config: ENFORCE,
    });
    assert.equal(v1.outcome, "deny");
    assert.equal(v1.reason, "pkill-f");
    assertParity(v1, v2, "PKILL-DENY");
  });

  it("BASH-ALLOW (GATE-05): clean bash allows identically", async () => {
    const v1 = await runV1(
      { tool: "bash", sessionID: freshSid("v1-bash-ok"), config: ENFORCE },
      { args: { command: "echo hello" } },
    );
    const v2 = await runV2("bash", {
      tool: "bash",
      sessionID: freshSid("v2-bash-ok"),
      args: { command: "echo hello" },
      config: ENFORCE,
    });
    assert.equal(v1.outcome, "allow");
    assertParity(v1, v2, "BASH-ALLOW");
  });

  it("FAILOPEN (GATE-01/ADR-006): generic Error inside a gate allows identically, never denies", async () => {
    // Invalid protectedPaths type makes isProtectedPath throw a generic
    // TypeError inside gateShellHygiene on a redirect target — decide()
    // fail-opens (allow + error log) in both entries.
    const badConfig = { protectedPaths: 123, gates: { picco: "enforce", evidence: "enforce", hitlBatch: "enforce" } };
    const errors = [];
    const origError = console.error;
    console.error = (...a) => { errors.push(a.map(String).join(" ")); };
    let v1;
    let v2;
    try {
      v1 = await runV1(
        { tool: "bash", sessionID: freshSid("v1-failopen"), config: badConfig },
        { args: { command: "echo hi > out.txt" } },
      );
      v2 = await runV2("bash", {
        tool: "bash",
        sessionID: freshSid("v2-failopen"),
        args: { command: "echo hi > out.txt" },
        config: badConfig,
        logger: { warn() {}, error(e) { errors.push(String(e?.message ?? e)); } },
      });
    } finally {
      console.error = origError;
    }
    assert.equal(v1.outcome, "allow", "v1 fail-open allows on generic error");
    assertParity(v1, v2, "FAILOPEN");
    assert.equal(v2.via, "plugin-error-fail-open", "v2 shim surfaces the fail-open via");
    assert.ok(errors.length > 0, "fail-open logs at error level");
  });

  it("KILL (GATE-01/ADR-009): HARNESS_GATES=off allows a denying input identically", async () => {
    const closed = tempStatePath(CLOSED);
    const killEnv = { HARNESS_GATES: "off" };
    const v1 = await runV1(
      { tool: "task", sessionID: freshSid("v1-kill"), config: ENFORCE, statePath: closed, env: killEnv },
      { args: { prompt: "no tags at all, would deny without kill-switch" } },
    );
    const v2 = await runV2("task", {
      tool: "task",
      sessionID: freshSid("v2-kill"),
      args: { prompt: "no tags at all, would deny without kill-switch" },
      config: ENFORCE,
      statePath: closed,
      env: killEnv,
    });
    assert.equal(v1.outcome, "allow");
    assertParity(v1, v2, "KILL");
    assert.equal(v2.via, "kill-switch");
  });

  it("GATES-OFF (GATE-01/ADR-009): gates.*=off never disables — hygiene still denies identically", async () => {
    // gateShellHygiene carries no gates.* key by design, so modeForGate
    // falls back to DEFAULT_MODE (enforce) even when every gates.* is off.
    const v1 = await runV1(
      { tool: "bash", sessionID: freshSid("v1-gates-off"), config: GATES_OFF },
      { args: { command: "pkill -f worker" } },
    );
    const v2 = await runV2("bash", {
      tool: "bash",
      sessionID: freshSid("v2-gates-off"),
      args: { command: "pkill -f worker" },
      config: GATES_OFF,
    });
    assert.equal(v1.outcome, "deny", "gates.*=off must still deny (hygiene enforce fallback)");
    assert.equal(v1.reason, "pkill-f");
    assertParity(v1, v2, "GATES-OFF");
  });

  it("ANCHOR-A (GATE-03A): orchestrator write outside allowlist denies identically", async () => {
    const s1 = freshSid("v1-anchor-a");
    const s2 = freshSid("v2-anchor-a");
    const hooks = await HarnessGate({});
    await hooks["chat.params"]({ sessionID: s1, params: { agent: "orchestrator" } });
    noteChatParamsShim({ sessionID: s2, params: { agent: "orchestrator" } });
    const args = { filePath: "src/app.js", content: "console.log(1)" };
    const v1 = await runV1({ tool: "write", sessionID: s1, config: ENFORCE }, { args });
    const v2 = await runV2("write", { tool: "write", sessionID: s2, args, config: ENFORCE });
    assert.equal(v1.outcome, "deny");
    assert.equal(v1.reason, "orch-write-outside-allowlist");
    assertParity(v1, v2, "ANCHOR-A");
  });

  it("ANCHOR-B (GATE-03B): new cycle on open state denies identically", async () => {
    // Valid PICCO (passes GATE-02) that never mentions the open fixture
    // feature ⇒ inferNewCycle=true ⇒ prev-cycle-not-completed.
    const open = tempStatePath(OPEN);
    const v1 = await runV1(
      { tool: "task", sessionID: freshSid("v1-anchor-b"), config: ENFORCE, statePath: open },
      { args: { prompt: VALID_PICCO } },
    );
    const v2 = await runV2("task", {
      tool: "task",
      sessionID: freshSid("v2-anchor-b"),
      args: { prompt: VALID_PICCO },
      config: ENFORCE,
      statePath: open,
    });
    assert.equal(v1.outcome, "deny");
    assert.equal(v1.reason, "prev-cycle-not-completed");
    assertParity(v1, v2, "ANCHOR-B");
  });

  it("HITL (GATE-04): 3rd consecutive task denies identically (allow, allow, deny)", async () => {
    const closed = tempStatePath(CLOSED);
    async function sequence(entry) {
      const sid = freshSid(entry === "v1" ? "v1-hitl" : "v2-hitl");
      const out = [];
      for (let i = 0; i < 3; i++) {
        if (entry === "v1") {
          out.push(await runV1(
            { tool: "task", sessionID: sid, config: ENFORCE, statePath: closed },
            { args: { prompt: VALID_PICCO } },
          ));
        } else {
          out.push(await runV2("task", {
            tool: "task", sessionID: sid, args: { prompt: VALID_PICCO }, config: ENFORCE, statePath: closed,
          }));
        }
      }
      resetHitlTracker(sid);
      return out;
    }
    const s1 = await sequence("v1");
    const s2 = await sequence("v2");
    assert.deepEqual(s1.map((r) => r.outcome), ["allow", "allow", "deny"]);
    assert.equal(s1[2].reason, "hitl-pause-required");
    assert.deepEqual(s2.map((r) => r.outcome), ["allow", "allow", "deny"]);
    assert.equal(s2[2].reason, s1[2].reason, "HITL deny reason parity");
  });
});
