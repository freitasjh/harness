import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DenyError,
  DEFAULT_MODE,
  KILL_SWITCH_ENV,
  isKillSwitchOff,
  resolveMode,
  verifySealOrDeny,
  decide,
  HarnessGate,
  loadConfigOrDeny,
  ensureConfig,
  recordSessionAgent,
  resolveSessionAgent,
  clearSessionAgents,
  noteChatParams,
  isHumanMessage,
  checkPicco,
  extractPromptText,
  gatePiccoTask,
  normalizePath,
  matchGlob,
  parsePatchPaths,
  extractWriteTargets,
  checkWriteAccess,
  isCompletionWrite,
  runContraprova,
  clearContraproveCache,
  gateCompletionAnchorA,
  loadWorkflowState,
  checkAnchorB,
  inferNewCycle,
  gatePhaseAnchorB,
  createHitlTracker,
  hitlTrackerFor,
  resetHitlTracker,
  gateHitlBatch,
  extractBashCommand,
  isPkillF,
  bashProtectedWrites,
  gateShellHygiene,
  modeForGate,
  isCacheableTreeHash,
} from "../gate.js";
import { sealCommands } from "../lib/seal.mjs";

const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (file) => readFileSync(join(PLUGIN_DIR, file), "utf8");

// Contract literals are built by concatenation so the static greps
// (SPEC §12 V2/V7/V16) never self-match on this test file.
const ASK_HOOK = ["permission", "ask"].join(".");
const SYS_SCALAR_ASSIGN = ["output", "system"].join(".") + " =";
const BUS_FILTER = ["event", "type"].join(".") + " === ";
const DEAD_BUS_EVENT = ["tool", "execute", "after"].join(".");

function makeLogger() {
  const entries = [];
  return {
    entries,
    warn: (message) => entries.push({ level: "warn", message: String(message) }),
    error: (message) =>
      entries.push({ level: "error", message: message instanceof Error ? message.message : String(message) }),
  };
}

const denyingGate = (reason = "test-deny") => async () => {
  throw new DenyError(reason, { test: true });
};
const explodingGate = () => async () => {
  throw new Error("boom");
};

describe("gate.js core — GATE-01 (ADR-001/006/009)", () => {
  it("deny-throws: DenyError in enforce propagates with actionable reason", async () => {
    const logger = makeLogger();
    await assert.rejects(
      () => decide({ gateFn: denyingGate("sealed-command-mismatch"), mode: "enforce", env: {}, logger }),
      (err) => err instanceof DenyError && err.reason === "sealed-command-mismatch",
    );
  });

  it("deny-throws: DenyError in warn mode becomes allow + warn log", async () => {
    assert.equal(DEFAULT_MODE, "enforce");
    const logger = makeLogger();
    const verdict = await decide({ gateFn: denyingGate("picco-tag-absent"), mode: "warn", env: {}, logger });
    assert.equal(verdict.verdict, "allow");
    assert.equal(verdict.via, "warn");
    assert.equal(verdict.reason, "picco-tag-absent");
    assert.equal(logger.entries.length, 1);
    assert.equal(logger.entries[0].level, "warn");
    assert.match(logger.entries[0].message, /picco-tag-absent/);
  });

  it("plugin-throws: plain Error => allow + error log in enforce AND warn (ADR-006)", async () => {
    for (const mode of ["enforce", "warn"]) {
      const logger = makeLogger();
      const verdict = await decide({ gateFn: explodingGate(), mode, env: {}, logger });
      assert.equal(verdict.verdict, "allow");
      assert.equal(verdict.via, "plugin-error-fail-open");
      assert.equal(logger.entries.length, 1);
      assert.equal(logger.entries[0].level, "error");
    }
  });

  it("kill-switch: HARNESS_GATES=off allows even a denying gate (ADR-009)", async () => {
    const logger = makeLogger();
    const verdict = await decide({
      gateFn: denyingGate("anything"),
      mode: "enforce",
      env: { [KILL_SWITCH_ENV]: "off" },
      logger,
    });
    assert.equal(verdict.verdict, "allow");
    assert.equal(verdict.via, "kill-switch");
    assert.equal(logger.entries.length, 0);
  });

  it("kill-switch: absent or other value keeps gates armed", () => {
    assert.equal(isKillSwitchOff({}), false);
    assert.equal(isKillSwitchOff({ [KILL_SWITCH_ENV]: "on" }), false);
    assert.equal(isKillSwitchOff({ [KILL_SWITCH_ENV]: "off" }), true);
  });

  it("resolveMode: default warn; config gates.* off/unknown never disables (ADR-009)", () => {
    assert.equal(resolveMode(undefined, "picco"), "warn");
    assert.equal(resolveMode({}, "picco"), "warn");
    assert.equal(resolveMode({ gates: { picco: "off" } }, "picco"), "warn");
    assert.equal(resolveMode({ gates: { picco: "banana" } }, "picco"), "warn");
    assert.equal(resolveMode({ gates: { picco: "enforce" } }, "picco"), "enforce");
  });

  it("DenyError is an Error with name + reason + details", () => {
    const err = new DenyError("test-reason", { key: "task-1" });
    assert.ok(err instanceof Error);
    assert.ok(err instanceof DenyError);
    assert.equal(err.name, "DenyError");
    assert.equal(err.reason, "test-reason");
    assert.deepEqual(err.details, { key: "task-1" });
    assert.match(err.message, /test-reason/);
  });
});

describe("gate.js seal gate — FU-03 (reject empty commands/seal)", () => {
  it("empty commands object => DenyError sealed-command-mismatch", () => {
    assert.throws(() => verifySealOrDeny({}, { suiteFull: "x" }), (err) => err instanceof DenyError);
  });

  it("null/undefined commands or seal => DenyError", () => {
    assert.throws(() => verifySealOrDeny(null, { suiteFull: "x" }), DenyError);
    assert.throws(() => verifySealOrDeny({ suiteFull: "cmd" }, null), DenyError);
    assert.throws(() => verifySealOrDeny({ suiteFull: "cmd" }, {}), DenyError);
  });

  it("empty command value => DenyError (no silent allow)", () => {
    assert.throws(() => verifySealOrDeny({ suiteFull: "" }, { suiteFull: "x" }), DenyError);
  });

  it("tampered command => DenyError with mismatches", () => {
    const commands = { suiteFull: "node --test", unit: "node --test x/" };
    const seal = sealCommands(commands);
    assert.throws(
      () => verifySealOrDeny({ ...commands, suiteFull: "true" }, seal),
      (err) => err instanceof DenyError && err.reason === "sealed-command-mismatch",
    );
  });

  it("untampered commands + seal => true", () => {
    const commands = { suiteFull: "node --test", unit: "node --test x/" };
    assert.equal(verifySealOrDeny(commands, sealCommands(commands)), true);
  });
});

describe("gate.js runtime contract — no hook outside RUNTIME-CONTRACT §2/H1-H3", () => {
  const SOURCES = ["gate.js", "harness-validator.js", "hitl-guardrail.js"];

  it("no gate uses the forbidden ask hook (H1)", () => {
    for (const file of SOURCES) {
      assert.ok(!readSource(file).includes(ASK_HOOK), `${file} references the forbidden ask hook`);
    }
  });

  it("no scalar assign to the system-transform output (G14)", () => {
    for (const file of SOURCES) {
      assert.ok(!readSource(file).includes(SYS_SCALAR_ASSIGN), `${file} assigns the transform output as scalar`);
    }
  });

  it("no filter on the nonexistent bus event (N7/H3)", () => {
    for (const file of SOURCES) {
      const source = readSource(file);
      const filtersDeadEvent = source.includes(BUS_FILTER) && source.includes(DEAD_BUS_EVENT);
      assert.ok(!filtersDeadEvent, `${file} filters a bus event that does not exist`);
    }
  });

  it("legacy plugins expose no dead event handler key", () => {
    for (const file of ["harness-validator.js", "hitl-guardrail.js"]) {
      assert.ok(!/^\s*event\s*:/m.test(readSource(file)), `${file} still declares an event handler`);
    }
  });

  it("plugin surface exposes only contract hooks", async () => {
    // Allowlist built by concatenation (same self-match avoidance as above).
    // FU-04: the dead bus event is NOT a contract hook — removed.
    const CONTRACT_HOOKS = ["tool.execute.before", "chat.message", "chat.params"];
    const hooks = await HarnessGate({});
    const keys = Object.keys(hooks);
    assert.ok(keys.includes("tool.execute.before"), "deny primitive hook missing");
    for (const key of keys) {
      assert.ok(CONTRACT_HOOKS.includes(key), `hook outside contract: ${key}`);
    }
    assert.ok(!keys.includes(ASK_HOOK));
  });
});

// ---------------------------------------------------------------------------
// Batch 4/7 — GATE-02..05 fixtures (SPEC §7.3 + v4). Every deny fixture runs
// in BOTH modes: enforce rejects with DenyError, warn allows via "warn".
// ---------------------------------------------------------------------------

const TEST_PROTECTED = [
  ".opencode/plugins/**",
  ".agents/rules/**",
  ".agents/schemas/**",
  "opencode.json",
  "harness.config.json",
];

const TEST_COMMANDS = {
  suiteFull: 'node --test ".opencode/plugins/__tests__/*.spec.mjs"',
  unit: 'node --test ".opencode/plugins/__tests__/*.spec.mjs"',
};

const TEST_CONFIG = {
  commands: TEST_COMMANDS,
  protectedPaths: TEST_PROTECTED,
  contraproveTimeoutMs: 900000,
  evidence: { path: "harness/" },
};

function testSeal(commands = TEST_COMMANDS) {
  return sealCommands(commands);
}

async function deniesBothModes(gateFn, ctx, reason) {
  const enforceLog = makeLogger();
  await assert.rejects(
    () => decide({ gateFn, mode: "enforce", env: {}, logger: enforceLog, ctx }),
    (err) => err instanceof DenyError && (!reason || err.reason === reason),
  );
  const warnLog = makeLogger();
  const verdict = await decide({ gateFn, mode: "warn", env: {}, logger: warnLog, ctx });
  assert.equal(verdict.verdict, "allow");
  assert.equal(verdict.via, "warn");
  if (reason) assert.equal(verdict.reason, reason);
}

async function allowsBothModes(gateFn, ctx) {
  for (const mode of ["warn", "enforce"]) {
    const verdict = await decide({ gateFn, mode, env: {}, logger: makeLogger(), ctx });
    assert.equal(verdict.verdict, "allow");
  }
}

// The real delegation shape of this repo (anti-false-positive, ADR-004).
const REAL_DELEGATION = [
  "Delegacao para developer-engineer",
  "<role>Implementa os gates com o contrato exato do SPEC.</role>",
  "<task>Implementar os 4 gates em `gate.js` via `registerCoreGate`.</task>",
  "<context>Repo: harness. Ja existe gate.js + suite 31/31.</context>",
  "<constraints>Escopo restrito a gate.js + testes.</constraints>",
  "<acceptance>Fixtures verdes em warn E enforce.</acceptance>",
  "<open_questions>",
  "</open_questions>",
].join("\n");

describe("GATE-02 PICCO (ADR-004, I1)", () => {
  it("picco-tag-absent: block without the tag => deny", async () => {
    const ctx = { tool: "task", args: { prompt: "<role>x</role>\n<task>y</task>" }, logger: makeLogger() };
    assert.equal(checkPicco(extractPromptText(ctx.args)).reason, "picco-tag-absent");
    await deniesBothModes(gatePiccoTask, ctx, "picco-tag-absent");
  });

  it("picco-tag-nonempty: tag with content => deny", async () => {
    const ctx = {
      tool: "task",
      args: { prompt: "<task>y</task>\n<open_questions>falta E2?</open_questions>" },
      logger: makeLogger(),
    };
    assert.equal(checkPicco(extractPromptText(ctx.args)).reason, "picco-tag-nonempty");
    await deniesBothModes(gatePiccoTask, ctx, "picco-tag-nonempty");
  });

  it("picco-tag-empty: empty tag => allow", async () => {
    const ctx = {
      tool: "task",
      args: { prompt: "<role>x</role>\n<task>y</task>\n<open_questions></open_questions>" },
      logger: makeLogger(),
    };
    await allowsBothModes(gatePiccoTask, ctx);
  });

  it("whitespace/comment-only tag => allow", async () => {
    const res = checkPicco("<task>y</task>\n<open_questions>\n  <!-- nada -->\n</open_questions>");
    assert.equal(res.verdict, "allow");
  });

  it("picco-e3-missing-tag-present: E3 absent but tag empty => allow + warning", async () => {
    const res = checkPicco("<role>x</role>\n<task>y</task>\n<open_questions></open_questions>");
    assert.equal(res.verdict, "allow");
    assert.ok(res.warnings.length > 0, "expected E3-E6 advisory warnings");
    const logger = makeLogger();
    await allowsBothModes(gatePiccoTask, {
      tool: "task",
      args: { prompt: "<role>x</role>\n<task>y</task>\n<open_questions></open_questions>" },
      logger,
    });
    assert.ok(logger.entries.some((e) => /picco-warning/.test(e.message)), "warnings must reach the log");
  });

  it("real delegation shape of this repo => allow (anti-false-positive)", async () => {
    const res = checkPicco(REAL_DELEGATION);
    assert.equal(res.verdict, "allow");
    assert.deepEqual(res.warnings, []);
    await allowsBothModes(gatePiccoTask, {
      tool: "task",
      args: { prompt: REAL_DELEGATION },
      logger: makeLogger(),
    });
  });

  it("query commands skip the gate (show status)", async () => {
    await allowsBothModes(gatePiccoTask, {
      tool: "task",
      args: { prompt: "show status" },
      logger: makeLogger(),
    });
  });

  it("non-task tools pass through the PICCO gate", async () => {
    await allowsBothModes(gatePiccoTask, {
      tool: "bash",
      args: { command: "ls" },
      logger: makeLogger(),
    });
  });

  it("task with no prompt text => deny (no tag present)", async () => {
    await deniesBothModes(gatePiccoTask, { tool: "task", args: {}, logger: makeLogger() }, "picco-tag-absent");
  });
});

describe("FU-05 config-unavailable (loader catch => DenyError)", () => {
  it("missing config maps to DenyError config-unavailable, never a bare Error", () => {
    assert.throws(
      () => loadConfigOrDeny("/nonexistent/harness.config.json"),
      (err) => err instanceof DenyError && err.reason === "config-unavailable",
    );
  });

  it("ensureConfig passes through an injected config, denies without one", () => {
    assert.equal(ensureConfig({ config: TEST_CONFIG }), TEST_CONFIG);
    assert.throws(() => ensureConfig({ configPath: "/nonexistent/harness.config.json" }), DenyError);
  });

  it("config-unavailable denies in enforce, warns in warn (fail-closed, RF-01)", async () => {
    await deniesBothModes(gateShellHygiene, { tool: "bash", args: { command: "ls" }, configPath: "/nonexistent/x.json" }, "config-unavailable");
  });
});

describe("GATE-03 anchor A: path-check + completion + contraprova (ADR-002/008)", () => {
  const okReport = (overrides = {}) => ({
    demand: "harness-v7-hardening",
    commands: [{ cmd: TEST_COMMANDS.suiteFull, exitCode: 0 }],
    counts: { unit: { passed: 31, failed: 0, skipped: 0 } },
    selfReported: true,
    ...overrides,
  });
  const okExec = (counts = { unit: { passed: 31, failed: 0, skipped: 0 } }) => async () => ({
    exitCode: 0,
    counts,
  });
  const stateCompleted = (phase = "Completed") =>
    JSON.stringify({ current_feature: "harness-v7-hardening", current_phase: phase });

  it("orch-write-inside-allowlist: state write (non-Completed) => allow", async () => {
    clearContraproveCache();
    await allowsBothModes(gateCompletionAnchorA, {
      tool: "write",
      args: { filePath: "workflow-state.json", content: JSON.stringify({ current_phase: "Execution" }) },
      sessionAgent: "orchestrator",
      config: TEST_CONFIG,
      logger: makeLogger(),
    });
  });

  it("spec write via orchestrator => allow", async () => {
    await allowsBothModes(gateCompletionAnchorA, {
      tool: "write",
      args: { path: ".spec/governance/harness-v7/SPEC.md", content: "# spec" },
      sessionAgent: "orchestrator",
      config: TEST_CONFIG,
      logger: makeLogger(),
    });
  });

  it("orch-write-outside-allowlist: orchestrator writes source => deny", async () => {
    await deniesBothModes(
      gateCompletionAnchorA,
      {
        tool: "write",
        args: { filePath: "frontend/src/x.ts", content: "x" },
        sessionAgent: "orchestrator",
        config: TEST_CONFIG,
        logger: makeLogger(),
      },
      "orch-write-outside-allowlist",
    );
  });

  it("both write arg shapes covered (filePath + path, U8=c)", async () => {
    for (const args of [
      { filePath: "frontend/src/x.ts", content: "x" },
      { path: "frontend/src/x.ts", content: "x" },
    ]) {
      assert.equal(extractWriteTargets("write", args).length, 1);
      await deniesBothModes(
        gateCompletionAnchorA,
        { tool: "write", args, sessionAgent: "orchestrator", config: TEST_CONFIG, logger: makeLogger() },
        "orch-write-outside-allowlist",
      );
    }
  });

  it("patch-protected-path: apply_patch touching the gate => deny", async () => {
    const patchText = "diff --git a/.opencode/plugins/gate.js b/.opencode/plugins/gate.js\n+++ b/.opencode/plugins/gate.js\n+// evil\n";
    assert.deepEqual(parsePatchPaths(patchText), [".opencode/plugins/gate.js"]);
    await deniesBothModes(
      gateCompletionAnchorA,
      {
        tool: "apply_patch",
        args: { patchText },
        sessionAgent: "orchestrator",
        config: TEST_CONFIG,
        logger: makeLogger(),
      },
      "protected-path-write",
    );
  });

  it("completed-no-evidence: Completed write without REPORT => deny", async () => {
    await deniesBothModes(
      gateCompletionAnchorA,
      {
        tool: "write",
        args: { filePath: "workflow-state.json", content: stateCompleted() },
        sessionAgent: "orchestrator",
        config: TEST_CONFIG,
        report: null,
        logger: makeLogger(),
      },
      "completed-no-evidence",
    );
  });

  it("completed-divergent-counts: REPORT claims green, re-run fails => deny", async () => {
    clearContraproveCache();
    const report = okReport();
    const execFn = async () => ({ exitCode: 1, counts: { unit: { passed: 30, failed: 1, skipped: 0 } } });
    await deniesBothModes(
      gateCompletionAnchorA,
      {
        tool: "write",
        args: { filePath: "workflow-state.json", content: stateCompleted() },
        sessionAgent: "orchestrator",
        config: TEST_CONFIG,
        report,
        demand: report.demand,
        publishedSeal: testSeal(),
        contraproveExec: execFn,
        treeHash: "tree-divergent",
        logger: makeLogger(),
      },
      "contraprove-divergent",
    );
  });

  it("completed-ok: REPORT matches re-run => allow (and caches)", async () => {
    clearContraproveCache();
    let calls = 0;
    const execFn = async () => {
      calls += 1;
      return { exitCode: 0, counts: { unit: { passed: 31, failed: 0, skipped: 0 } } };
    };
    const base = {
      tool: "write",
      args: { filePath: "workflow-state.json", content: stateCompleted() },
      sessionAgent: "orchestrator",
      config: TEST_CONFIG,
      report: okReport(),
      demand: "harness-v7-hardening",
      publishedSeal: testSeal(),
      contraproveExec: execFn,
      treeHash: "tree-ok",
    };
    await allowsBothModes(gateCompletionAnchorA, { ...base, logger: makeLogger() });
    await allowsBothModes(gateCompletionAnchorA, { ...base, logger: makeLogger() });
    assert.equal(calls, 1, "second identical contraprova must hit the (demand, reportHash, treeHash) cache");
  });

  it("sealed-command-mismatch: tampered suiteFull => deny before running", async () => {
    clearContraproveCache();
    let calls = 0;
    const execFn = async () => {
      calls += 1;
      return { exitCode: 0, counts: null };
    };
    await deniesBothModes(
      gateCompletionAnchorA,
      {
        tool: "write",
        args: { filePath: "workflow-state.json", content: stateCompleted() },
        sessionAgent: "orchestrator",
        config: { ...TEST_CONFIG, commands: { ...TEST_COMMANDS, suiteFull: "true" } },
        report: okReport(),
        demand: "harness-v7-hardening",
        publishedSeal: testSeal(),
        contraproveExec: execFn,
        treeHash: "tree-seal",
        logger: makeLogger(),
      },
      "sealed-command-mismatch",
    );
    assert.equal(calls, 0, "seal divergence must deny before executing anything");
  });

  it("contraprove-timeout: re-run exceeds budget => deny contraprove-timeout", async () => {
    clearContraproveCache();
    const timeoutExec = async () => ({ timedOut: true });
    await deniesBothModes(
      gateCompletionAnchorA,
      {
        tool: "write",
        args: { filePath: "workflow-state.json", content: stateCompleted() },
        sessionAgent: "orchestrator",
        config: TEST_CONFIG,
        report: { demand: "harness-v7-hardening", commands: [{ cmd: TEST_COMMANDS.suiteFull, exitCode: 0 }], selfReported: true },
        demand: "harness-v7-hardening",
        publishedSeal: testSeal(),
        contraproveExec: timeoutExec,
        treeHash: "tree-timeout",
        logger: makeLogger(),
      },
      "contraprove-timeout",
    );
    const throwingExec = async () => {
      throw Object.assign(new Error("t/o"), { code: "ETIMEDOUT" });
    };
    await assert.rejects(
      () =>
        runContraprova({
          demand: "d",
          report: { demand: "d", selfReported: true },
          commands: TEST_COMMANDS,
          seal: testSeal(),
          execFn: throwingExec,
          treeHash: "t2",
        }),
      (err) => err instanceof DenyError && err.reason === "contraprove-timeout",
    );
  });

  it("non-write tools pass through anchor A", async () => {
    await allowsBothModes(gateCompletionAnchorA, {
      tool: "bash",
      args: { command: "ls" },
      sessionAgent: "orchestrator",
      config: TEST_CONFIG,
      logger: makeLogger(),
    });
  });
});

describe("GATE-03 anchor B: next task requires the previous cycle closed", () => {
  const closed = {
    current_feature: "harness-v7-hardening",
    current_phase: "Completed",
    harness_status: "passed",
    code_review_status: "passed",
  };
  const open = { ...closed, current_phase: "Execution", harness_status: "pending", code_review_status: "pending" };

  it("next-task-prev-not-completed: new cycle on an open state => deny", async () => {
    assert.throws(() => checkAnchorB({ state: open, startsNewCycle: true }), (err) => err instanceof DenyError && err.reason === "prev-cycle-not-completed");
    await deniesBothModes(
      gatePhaseAnchorB,
      {
        tool: "task",
        args: { prompt: `${REAL_DELEGATION}\nfeature: other-feature` },
        workflowState: { ...open, current_feature: "old-feature" },
        logger: makeLogger(),
      },
      "prev-cycle-not-completed",
    );
  });

  it("completed-no-state-write: prose claim without state write blocks the next task", async () => {
    // State still shows the old cycle open; the follow-up delegation for a new
    // feature must deny until the previous cycle is recorded closed.
    await deniesBothModes(
      gatePhaseAnchorB,
      {
        tool: "task",
        args: { prompt: REAL_DELEGATION },
        workflowState: { ...open, current_feature: "unrelated-old-cycle" },
        logger: makeLogger(),
      },
      "prev-cycle-not-completed",
    );
  });

  it("closed previous cycle => next task allows", async () => {
    await allowsBothModes(gatePhaseAnchorB, {
      tool: "task",
      args: { prompt: REAL_DELEGATION },
      workflowState: closed,
      logger: makeLogger(),
    });
  });

  it("same-cycle task on an open state => allow", async () => {
    await allowsBothModes(gatePhaseAnchorB, {
      tool: "task",
      args: { prompt: `${REAL_DELEGATION}\nfeature: harness-v7-hardening` },
      workflowState: { ...open, current_feature: "harness-v7-hardening" },
      logger: makeLogger(),
    });
  });

  it("no readable state (bootstrap) => allow", async () => {
    await allowsBothModes(gatePhaseAnchorB, {
      tool: "task",
      args: { prompt: REAL_DELEGATION },
      workflowState: null,
      statePath: "/nonexistent/workflow-state.json",
      logger: makeLogger(),
    });
  });

  it("inferNewCycle is explicit about its heuristic", () => {
    assert.equal(inferNewCycle("work on harness-v7-hardening now", { ...open, current_feature: "harness-v7-hardening" }), false);
    assert.equal(inferNewCycle("brand new thing", { ...open, current_feature: "harness-v7-hardening" }), true);
    assert.equal(inferNewCycle("anything", closed), false);
    assert.equal(inferNewCycle("anything", null), false);
  });
});

describe("GATE-04 HITL pause + correction-loop exemption (I6)", () => {
  // NOTE: each decide() invocation runs the gate once and pushes one task
  // onto the tracker. Both-modes helpers therefore push twice — allow
  // fixtures below assert per mode with a fresh tracker each time.
  async function allowsBothModesFresh(makeCtx) {
    for (const mode of ["warn", "enforce"]) {
      const verdict = await decide({ gateFn: gateHitlBatch, mode, env: {}, logger: makeLogger(), ctx: makeCtx() });
      assert.equal(verdict.verdict, "allow");
    }
  }

  it("correction-loop-exempt: developer -> reviewer immediates => allow", async () => {
    const tracker = createHitlTracker();
    await gateHitlBatch({ tool: "task", args: { subagent_type: "developer-engineer" }, hitlTracker: tracker });
    await gateHitlBatch({ tool: "task", args: { subagent_type: "code-reviewer" }, hitlTracker: tracker });
    assert.equal(tracker.pending(), 2);
    assert.deepEqual(tracker.sequence(), ["developer-engineer", "code-reviewer"]);
    await allowsBothModesFresh(() => ({
      tool: "task",
      args: { subagent_type: "developer-engineer" },
      hitlTracker: createHitlTracker(),
    }));
  });

  it("batch-chained-3rd-task: 3rd task without a human turn => deny", async () => {
    const tracker = createHitlTracker();
    tracker.onTask("developer-engineer");
    tracker.onTask("code-reviewer");
    await deniesBothModes(
      gateHitlBatch,
      { tool: "task", args: { subagent_type: "developer-engineer" }, hitlTracker: tracker },
      "hitl-pause-required",
    );
  });

  it("human turn resets the counter (via chat.message semantics)", async () => {
    assert.equal(isHumanMessage({ role: "user" }), true);
    assert.equal(isHumanMessage({ role: "assistant" }), false);
    const tracker = createHitlTracker();
    tracker.onTask("developer-engineer");
    tracker.onTask("code-reviewer");
    tracker.onHumanMessage();
    assert.equal(tracker.pending(), 0);
    await gateHitlBatch({ tool: "task", args: { subagent_type: "developer-engineer" }, hitlTracker: tracker });
    assert.equal(tracker.pending(), 1);
    await allowsBothModesFresh(() => ({
      tool: "task",
      args: { subagent_type: "developer-engineer" },
      hitlTracker: createHitlTracker(),
    }));
  });

  it("session trackers are isolated; reset clears", async () => {
    resetHitlTracker();
    const session = `test-session-${Date.now()}`;
    const tracker = hitlTrackerFor(session);
    tracker.onTask("developer-engineer");
    tracker.onTask("code-reviewer");
    assert.equal(hitlTrackerFor(session).pending(), 2);
    assert.equal(hitlTrackerFor(`${session}-other`).pending(), 0);
    resetHitlTracker(session);
    assert.equal(hitlTrackerFor(session).pending(), 0);
    resetHitlTracker();
  });

  it("FU-19 (a): real chat.message shape resets via output role", async () => {
    // Official @opencode-ai/plugin shape: input {sessionID,agent,model,...}
    // carries NO role; role lives in output.message.role. Handler must
    // reset the session tracker for this shape (S6/S6b lockout otherwise).
    const session = `fu19-a-${Date.now()}`;
    const realInput = { sessionID: session, agent: "orchestrator" };
    const realOutput = { message: { role: "user" }, parts: [] };
    assert.equal(isHumanMessage(realInput, realOutput), true);
    const hooks = await HarnessGate({});
    hitlTrackerFor(session).onTask("developer-engineer");
    hitlTrackerFor(session).onTask("code-reviewer");
    assert.equal(hitlTrackerFor(session).pending(), 2);
    await hooks["chat.message"](realInput, realOutput);
    assert.equal(hitlTrackerFor(session).pending(), 0);
    resetHitlTracker();
  });

  it("non-task tools do not advance the HITL counter", async () => {
    const tracker = createHitlTracker();
    await allowsBothModes(gateHitlBatch, { tool: "bash", args: { command: "ls" }, hitlTracker: tracker });
    assert.equal(tracker.pending(), 0);
  });
});

describe("session map via chat.params (I11)", () => {
  it("records sessionID -> agent and resolves it for gates", async () => {
    clearSessionAgents();
    noteChatParams({ sessionID: "s-1", params: { agent: "qa-engineer" } });
    assert.equal(resolveSessionAgent({ sessionID: "s-1" }), "qa-engineer");
    assert.equal(resolveSessionAgent({ sessionID: "s-unknown" }), undefined);
    assert.equal(resolveSessionAgent({ sessionID: "s-1", sessionAgent: "orchestrator" }), "orchestrator");
    clearSessionAgents();
  });
});

describe("GATE-05 hygiene: pkill, protected bash, qa scope (I7/I9)", () => {
  it("pkill-f: bash with pkill -f => deny", async () => {
    assert.equal(isPkillF("pkill -f node"), true);
    assert.equal(isPkillF("pkill -9 -f opencode"), true);
    assert.equal(isPkillF("pkill node"), false);
    assert.equal(isPkillF("ls -la"), false);
    await deniesBothModes(
      gateShellHygiene,
      { tool: "bash", args: { command: "pkill -f node" }, config: TEST_CONFIG },
      "pkill-f",
    );
  });

  it("protected-path-bash: redirect into the gate => deny (parse)", async () => {
    const hits = bashProtectedWrites("cat > .opencode/plugins/gate.js", TEST_PROTECTED);
    assert.equal(hits.length, 1);
    await deniesBothModes(
      gateShellHygiene,
      { tool: "bash", args: { command: "cat > .opencode/plugins/gate.js" }, config: TEST_CONFIG },
      "protected-path-write",
    );
  });

  it("tee into a protected path => deny; clean commands => allow", async () => {
    assert.ok(bashProtectedWrites("echo x | tee .agents/rules/y.md", TEST_PROTECTED).length > 0);
    await deniesBothModes(
      gateShellHygiene,
      { tool: "bash", args: { command: "echo x | tee .agents/rules/y.md" }, config: TEST_CONFIG },
      "protected-path-write",
    );
    await allowsBothModes(gateShellHygiene, {
      tool: "bash",
      args: { command: "ls -la && node --test" },
      config: TEST_CONFIG,
    });
  });

  it("evasion is MEASURED, not claimed: interpreter indirection bypasses parse (CI backstop)", async () => {
    // python -c writing a protected path is invisible to the redirect/tee
    // parse. This test pins the honest boundary: allow + documented gap.
    const evasive = "python3 -c \"open('.opencode/plugins/gate.js','w').write('x')\"";
    assert.deepEqual(bashProtectedWrites(evasive, TEST_PROTECTED), []);
    const verdict = await decide({
      gateFn: gateShellHygiene,
      mode: "enforce",
      env: {},
      logger: makeLogger(),
      ctx: { tool: "bash", args: { command: evasive }, config: TEST_CONFIG },
    });
    assert.equal(verdict.verdict, "allow");
  });

  it("qa-engineer writes outside harness/ => deny; inside => allow", async () => {
    await deniesBothModes(
      gateCompletionAnchorA,
      {
        tool: "write",
        args: { filePath: ".spec/governance/harness-v7/SPEC.md", content: "x" },
        sessionAgent: "qa-engineer",
        config: TEST_CONFIG,
        logger: makeLogger(),
      },
      "qa-scope-violation",
    );
    await allowsBothModes(gateCompletionAnchorA, {
      tool: "write",
      args: { filePath: "harness/harness-v7-hardening.json", content: "{}" },
      sessionAgent: "qa-engineer",
      config: TEST_CONFIG,
      logger: makeLogger(),
    });
  });

  it("extractBashCommand covers both arg shapes (string + object)", async () => {
    assert.equal(extractBashCommand("pkill -f x"), "pkill -f x");
    assert.equal(extractBashCommand({ command: "ls" }), "ls");
    assert.equal(extractBashCommand({ cmd: "ls" }), "ls");
    assert.equal(normalizePath("./.spec/x.md"), ".spec/x.md");
    assert.equal(matchGlob(".opencode/plugins/gate.js", ".opencode/plugins/**"), true);
    assert.equal(matchGlob("harness/a.json", ".opencode/plugins/**"), false);
    assert.equal(matchGlob("opencode.json", "opencode.json"), true);
  });
});

// ---------------------------------------------------------------------------
// Batch 5/8 — FU-08 + FU-09 fixtures (TST-01). Same discipline as Batch 4/7:
// every deny pins enforce-rejects + warn-allows; every fixture covers both
// branches (positive allow + negative deny).
// ---------------------------------------------------------------------------

describe("FU-08 state file: only absent => allow, corrupt => deny", () => {
  function corruptStatePath() {
    const dir = mkdtempSync(join(tmpdir(), "harness-fu08-"));
    const file = join(dir, "workflow-state.json");
    writeFileSync(file, "{ not valid json !!!", "utf8");
    return file;
  }

  it("absent state file => null + next task allows (bootstrap, both modes)", async () => {
    assert.equal(loadWorkflowState("/nonexistent/fu08-workflow-state.json"), null);
    await allowsBothModes(gatePhaseAnchorB, {
      tool: "task",
      args: { prompt: REAL_DELEGATION },
      statePath: "/nonexistent/fu08-workflow-state.json",
      logger: makeLogger(),
    });
  });

  it("corrupt state file => DenyError state-corrupt, denies in both modes", async () => {
    const statePath = corruptStatePath();
    assert.throws(
      () => loadWorkflowState(statePath),
      (err) => err instanceof DenyError && err.reason === "state-corrupt",
    );
    await deniesBothModes(
      gatePhaseAnchorB,
      { tool: "task", args: { prompt: REAL_DELEGATION }, statePath, logger: makeLogger() },
      "state-corrupt",
    );
  });
});

describe("FU-09 counts-unverifiable: stated counts with no observation => deny", () => {
  const reported = {
    demand: "harness-v7-hardening",
    commands: [{ cmd: TEST_COMMANDS.suiteFull, exitCode: 0 }],
    counts: { unit: { passed: 31, failed: 0, skipped: 0 } },
    selfReported: true,
  };
  const completionCtx = (report, contraproveExec, treeHash) => ({
    tool: "write",
    args: { filePath: "workflow-state.json", content: JSON.stringify({ current_phase: "Completed" }) },
    sessionAgent: "orchestrator",
    config: TEST_CONFIG,
    report,
    demand: report.demand,
    publishedSeal: testSeal(),
    contraproveExec,
    treeHash,
    logger: makeLogger(),
  });

  it("stated counts + unobserved counts => deny contraprove-divergent (cause counts-unverifiable), both modes", async () => {
    clearContraproveCache();
    const noCountsExec = async () => ({ exitCode: 0, counts: null });
    await deniesBothModes(
      gateCompletionAnchorA,
      completionCtx(reported, noCountsExec, "tree-fu09-negative"),
      "contraprove-divergent",
    );
    clearContraproveCache();
    await assert.rejects(
      () =>
        runContraprova({
          demand: reported.demand,
          report: reported,
          commands: TEST_COMMANDS,
          seal: testSeal(),
          execFn: noCountsExec,
          treeHash: "tree-fu09-cause",
        }),
      (err) => err instanceof DenyError && err.reason === "contraprove-divergent" && err.details?.cause === "counts-unverifiable",
    );
  });

  it("stated counts + matching observation => allow (both modes)", async () => {
    clearContraproveCache();
    const matchingExec = async () => ({ exitCode: 0, counts: { unit: { passed: 31, failed: 0, skipped: 0 } } });
    await allowsBothModes(
      gateCompletionAnchorA,
      completionCtx(reported, matchingExec, "tree-fu09-positive"),
    );
  });
});

// ---------------------------------------------------------------------------
// Batch 8/8 — FU-06 + FU-07 + FU-11 (DOG-01 pré-restart). Same discipline:
// every deny pins enforce-rejects + warn-allows.
// ---------------------------------------------------------------------------

describe("FU-06 per-gate modes: resolveMode(config, gateName) routes each gate", () => {
  it("picco routes via gates.picco; hitl via gates.hitlBatch", async () => {
    assert.equal(modeForGate(gatePiccoTask, { gates: { picco: "enforce" } }), "enforce");
    assert.equal(modeForGate(gatePiccoTask, { gates: { picco: "warn" } }), "warn");
    assert.equal(modeForGate(gateHitlBatch, { gates: { hitlBatch: "warn" } }), "warn");
    assert.equal(modeForGate(gateHitlBatch, { gates: { hitlBatch: "enforce" } }), "enforce");
  });

  it("unknown gate or missing key falls back to DEFAULT_MODE (never off)", async () => {
    assert.equal(modeForGate(async () => {}, { gates: {} }), DEFAULT_MODE);
    assert.equal(modeForGate(gatePiccoTask, { gates: { picco: "off" } }), "warn");
    assert.equal(modeForGate(gatePiccoTask, undefined), DEFAULT_MODE);
  });

  it("mixed config: picco enforce denies while hitlBatch warn allows (no partial flip)", async () => {
    const config = { gates: { picco: "enforce", hitlBatch: "warn" } };
    assert.equal(modeForGate(gatePiccoTask, config), "enforce");
    assert.equal(modeForGate(gateHitlBatch, config), "warn");
  });
});

describe("FU-07 cache disabled when treeHash unknown (N11)", () => {
  const okReport = {
    demand: "harness-v7-hardening",
    commands: [{ cmd: TEST_COMMANDS.suiteFull, exitCode: 0 }],
    selfReported: true,
  };

  it("isCacheableTreeHash: unknown/empty => false, real hash => true", () => {
    assert.equal(isCacheableTreeHash("unknown"), false);
    assert.equal(isCacheableTreeHash(""), false);
    assert.equal(isCacheableTreeHash(undefined), false);
    assert.equal(isCacheableTreeHash("tree-ok-abc123"), true);
  });

  it("unknown treeHash: two identical contraprovas execute twice (cache bypass)", async () => {
    clearContraproveCache();
    let calls = 0;
    const execFn = async () => {
      calls += 1;
      return { exitCode: 0, counts: null };
    };
    const base = { demand: okReport.demand, report: okReport, commands: TEST_COMMANDS, seal: testSeal(), execFn, treeHash: "unknown" };
    await runContraprova(base);
    await runContraprova(base);
    assert.equal(calls, 2, "unknown treeHash must never hit the cache");
  });

  it("real treeHash still caches (one exec for two identical calls)", async () => {
    clearContraproveCache();
    let calls = 0;
    const execFn = async () => {
      calls += 1;
      return { exitCode: 0, counts: null };
    };
    const base = { demand: okReport.demand, report: okReport, commands: TEST_COMMANDS, seal: testSeal(), execFn, treeHash: "tree-fu07-real" };
    await runContraprova(base);
    await runContraprova(base);
    assert.equal(calls, 1, "real treeHash keeps the (demand, reportHash, treeHash) cache");
  });
});

describe("FU-11 lazy state: corrupt workflow-state routes via decide (warn-allows preserved)", () => {
  function corruptStatePath() {
    const dir = mkdtempSync(join(tmpdir(), "harness-fu11-"));
    const file = join(dir, "workflow-state.json");
    writeFileSync(file, "{ corrupt !!!", "utf8");
    return file;
  }

  it("HarnessGate in warn allows on corrupt state (warn-allows preserved)", async () => {
    const statePath = corruptStatePath();
    const hooks = await HarnessGate({ client: undefined });
    const runGates = hooks["tool.execute.before"];
    assert.ok(typeof runGates === "function");
    const warnConfig = { ...TEST_CONFIG, gates: { picco: "warn", evidence: "warn", hitlBatch: "warn" } };
    // Valid PICCO so the run reaches anchor B; corrupt state must allow-via-warn, not throw raw.
    await runGates(
      { tool: "task", sessionID: `fu11-warn-${Date.now()}`, statePath, config: warnConfig },
      { args: { prompt: REAL_DELEGATION } },
    );
  });

  it("HarnessGate in enforce denies on corrupt state with state-corrupt", async () => {
    const statePath = corruptStatePath();
    const hooks = await HarnessGate({});
    const runGates = hooks["tool.execute.before"];
    const enforceConfig = { ...TEST_CONFIG, gates: { picco: "enforce", evidence: "enforce", hitlBatch: "enforce" } };
    await assert.rejects(
      () =>
        runGates(
          { tool: "task", sessionID: `fu11-enforce-${Date.now()}`, statePath, config: enforceConfig },
          { args: { prompt: REAL_DELEGATION } },
        ),
      (err) => err instanceof DenyError && err.reason === "state-corrupt",
    );
  });

  it("direct decide routes corrupt-state DenyError in both modes", async () => {
    const statePath = corruptStatePath();
    await deniesBothModes(
      gatePhaseAnchorB,
      { tool: "task", args: { prompt: REAL_DELEGATION }, statePath, logger: makeLogger() },
      "state-corrupt",
    );
  });
});
