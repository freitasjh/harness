// matrix-v1v2-parity.spec.mjs — PL-07 V2-VAL-10, UPDATED to the measured
// v2-only contract (opencode-v2-only, EX2-VAL-03).
//
// HISTORY: this file ran the deny/allow matrix through BOTH entries — the v1
// `server` entry (HarnessGate → "tool.execute.before") and the v2 `setup`
// entry — and asserted parity. The owner decided v2-only: the `server` key is
// gone from every default export. There is nothing left to compare against, so
// the matrix now runs through the SINGLE v2 entry (setup → runGatesShim) and
// pins the SAME verdicts (same deny reasons) the pre-migration matrix pinned.
//
// Retired: every "v1 × v2 parity" comparison (the v1 leg no longer exists).
// Preserved: every row's verdict + reason (RF-02 "mesmo veredito").
//
// Gate map (GATE-01..GATE-05, gate.js header):
//   GATE-01 dispatcher/DenyError/kill-switch/fail-open — rows KILL, FAILOPEN
//     + every deny row (propagation) proves the dispatcher 1:1.
//   GATE-02 PICCO (gatePiccoTask) — rows PICCO-DENY / PICCO-ALLOW.
//   GATE-03A completion anchor A (gateCompletionAnchorA) — row ANCHOR-A.
//   GATE-03B phase anchor B (gatePhaseAnchorB) — row ANCHOR-B.
//   GATE-04 HITL pause (gateHitlBatch) — row HITL.
//   GATE-05 shell hygiene (gateShellHygiene) — rows PKILL-DENY / BASH-ALLOW
//     + row GATES-OFF (gates.*=off changes no mode; the env is the channel).
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setup, runGatesShim, resetHitlTracker, DenyError } from "../gate.js";

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
      hook: async (tool, handler) => {
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

// Capture the handler the v2 entry actually registered (proves the call goes
// through `setup`, not a direct import bypass).
async function v2Handler() {
  const { ctx, calls } = v2Stub();
  const result = await setup(ctx);
  assert.equal(result, undefined, "setup returns undefined (acquireRelease contract)");
  const hit = calls.find((c) => c.api === "tool.hook");
  assert.ok(hit, "setup registered the execute.before hook");
  assert.equal(hit.handler, runGatesShim, "handler is runGatesShim");
  return hit.handler;
}

async function runV2(envelope) {
  const handler = await v2Handler();
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

describe("PL-07 V2-VAL-10 — matrix deny/allow through the v2 entry (setup → runGatesShim)", () => {
  it("PICCO-DENY (GATE-02): task without tag denies", async () => {
    const closed = tempStatePath(CLOSED);
    const row = await runV2({
      tool: "task",
      sessionID: freshSid("v2-picco-deny"),
      args: { prompt: "do the thing with no picco block at all" },
      config: ENFORCE,
      statePath: closed,
    });
    assert.equal(row.outcome, "deny");
    assert.equal(row.reason, "picco-tag-absent");
  });

  it("PICCO-ALLOW (GATE-02): valid PICCO allows", async () => {
    const closed = tempStatePath(CLOSED);
    const row = await runV2({
      tool: "task",
      sessionID: freshSid("v2-picco-allow"),
      args: { prompt: VALID_PICCO },
      config: ENFORCE,
      statePath: closed,
    });
    assert.equal(row.outcome, "allow");
  });

  it("PKILL-DENY (GATE-05): pkill -f denies", async () => {
    const row = await runV2({
      tool: "bash",
      sessionID: freshSid("v2-pkill"),
      args: { command: "pkill -f worker" },
      config: ENFORCE,
    });
    assert.equal(row.outcome, "deny");
    assert.equal(row.reason, "pkill-f");
  });

  it("BASH-ALLOW (GATE-05): clean bash allows", async () => {
    const row = await runV2({
      tool: "bash",
      sessionID: freshSid("v2-bash-ok"),
      args: { command: "echo hello" },
      config: ENFORCE,
    });
    assert.equal(row.outcome, "allow");
  });

  it("FAILOPEN (GATE-01/ADR-006): generic Error inside a gate allows, never denies", async () => {
    // Invalid protectedPaths type makes isProtectedPath throw a generic
    // TypeError inside gateShellHygiene on a redirect target — decide()
    // fail-opens (allow + error log).
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
    assert.equal(row.via, "plugin-error-fail-open", "the shim surfaces the fail-open via");
    assert.ok(errors.length > 0, "fail-open logs at error level");
  });

  it("KILL (GATE-01/ADR-009): HARNESS_GATES=off allows a denying input", async () => {
    const closed = tempStatePath(CLOSED);
    const row = await runV2({
      tool: "task",
      sessionID: freshSid("v2-kill"),
      args: { prompt: "no tags at all, would deny without kill-switch" },
      config: ENFORCE,
      statePath: closed,
      env: { HARNESS_GATES: "off" },
    });
    assert.equal(row.outcome, "allow");
    assert.equal(row.via, "kill-switch");
  });

  it("GATES-OFF (GATE-01/ADR-001): gates.*=off changes no mode — hygiene still denies and the only channel is the env", async () => {
    // ADR-001 (MODO-06): gates.* no longer downgrades anything. This row used
    // to prove "off downgrades to warn, never off"; it now proves the opposite
    // contract, in two halves inside the same row:
    //   (a) with every gates.* = off, the hygiene gate still DENIES a pkill -f.
    //       This half is a REGRESSION GUARD only: hygiene carries no gateName,
    //       so it resolves to DEFAULT_MODE and never consulted the config —
    //       neither before nor after ADR-001. It does NOT prove that the config
    //       is ignored;
    //   (b) this is the half that proves it: the PICCO-less task the config can
    //       never relax denies without env and is allowed when
    //       HARNESS_GATE_PICCO downgrades it with a motive — the env is the
    //       real channel.
    const hygieneRow = await runV2({
      tool: "bash",
      sessionID: freshSid("v2-gates-off"),
      args: { command: "pkill -f worker" },
      config: GATES_OFF,
    });
    assert.equal(
      hygieneRow.outcome,
      "deny",
      "gates.*=off must still deny (hygiene carries no gateName ⇒ DEFAULT_MODE)",
    );
    assert.equal(hygieneRow.reason, "pkill-f");

    const closed = tempStatePath(CLOSED);
    const baseEnvelope = {
      tool: "task",
      args: { prompt: "no picco block; config gates.*=off must not relax this" },
      config: GATES_OFF,
      statePath: closed,
    };
    const configOnly = await runV2({ ...baseEnvelope, sessionID: freshSid("v2-gates-off-cfg") });
    assert.equal(configOnly.outcome, "deny", "gates.picco=off cannot downgrade the PICCO gate");
    assert.equal(configOnly.reason, "picco-tag-absent");

    const viaEnv = await runV2({
      ...baseEnvelope,
      sessionID: freshSid("v2-gates-off-env"),
      env: { HARNESS_GATE_PICCO: "warn", HARNESS_GATE_PICCO_REASON: "debug" },
    });
    assert.equal(viaEnv.outcome, "allow", "the env is the downgrade channel");
    assert.equal(viaEnv.via, "warn");
  });

  it("ANCHOR-A (GATE-03A): orchestrator write outside allowlist denies", async () => {
    const row = await runV2({
      tool: "write",
      sessionID: freshSid("v2-anchor-a"),
      args: { filePath: "src/app.js", content: "console.log(1)" },
      sessionAgent: "orchestrator",
      config: ENFORCE,
    });
    assert.equal(row.outcome, "deny");
    assert.equal(row.reason, "orch-write-outside-allowlist");
  });

  it("ANCHOR-B (GATE-03B): new cycle on open state denies", async () => {
    // Valid PICCO (passes GATE-02) that never mentions the open fixture feature
    // ⇒ inferNewCycle=true ⇒ prev-cycle-not-completed.
    const open = tempStatePath(OPEN);
    const row = await runV2({
      tool: "task",
      sessionID: freshSid("v2-anchor-b"),
      args: { prompt: VALID_PICCO },
      config: ENFORCE,
      statePath: open,
    });
    assert.equal(row.outcome, "deny");
    assert.equal(row.reason, "prev-cycle-not-completed");
  });

  it("HITL (GATE-04): 3rd consecutive task denies (allow, allow, deny)", async () => {
    const closed = tempStatePath(CLOSED);
    const sid = freshSid("v2-hitl");
    const out = [];
    for (let i = 0; i < 3; i++) {
      out.push(
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
    assert.deepEqual(out.map((r) => r.outcome), ["allow", "allow", "deny"]);
    assert.equal(out[2].reason, "hitl-pause-required");
  });
});
