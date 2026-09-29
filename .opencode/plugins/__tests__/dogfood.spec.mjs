// dogfood.spec.mjs — DOG-01 executable acceptance (SPEC §14, TASKS DOG-01).
//
// S1 (V5): Completed write without/divergent evidence => deny with actionable reason.
// S2 (V11): bash into a protected path => deny + CI backstop present (revert net).
// S3 (mirror): correct evidence + matching re-run => allow, no false positive.
// S4 (regression): this repo's consumer suite is the harness suite itself —
//   canonical commands resolve from harness.config.json and the seal verifies.
//
// Every deny pins enforce-rejects + warn-allows. No MCP, no network.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DenyError,
  decide,
  gateCompletionAnchorA,
  gateShellHygiene,
  verifySealOrDeny,
} from "../gate.js";
import { loadHarnessConfig } from "../lib/config.mjs";
import { sealCommands } from "../lib/seal.mjs";

const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(PLUGIN_DIR, "..", "..");

function makeLogger() {
  const entries = [];
  return {
    entries,
    warn: (message) => entries.push({ level: "warn", message: String(message) }),
    error: (message) =>
      entries.push({ level: "error", message: message instanceof Error ? message.message : String(message) }),
  };
}

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
  await assert.rejects(
    () => decide({ gateFn, mode: "enforce", env: {}, logger: makeLogger(), ctx }),
    (err) => err instanceof DenyError && (!reason || err.reason === reason),
  );
  const verdict = await decide({ gateFn, mode: "warn", env: {}, logger: makeLogger(), ctx });
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

const completedContent = JSON.stringify({ current_feature: "harness-v7-hardening", current_phase: "Completed" });

describe("DOG-01 S1 (V5): Completed without evidence => deny with actionable reason", () => {
  it("no REPORT => deny completed-no-evidence (demand identified)", async () => {
    await deniesBothModes(
      gateCompletionAnchorA,
      {
        tool: "write",
        args: { filePath: "workflow-state.json", content: completedContent },
        sessionAgent: "orchestrator",
        config: TEST_CONFIG,
        report: null,
        logger: makeLogger(),
      },
      "completed-no-evidence",
    );
  });

  it("divergent re-run => deny contraprove-divergent with exit codes", async () => {
    const report = {
      demand: "harness-v7-hardening",
      commands: [{ cmd: TEST_COMMANDS.suiteFull, exitCode: 0 }],
      selfReported: true,
    };
    const execFn = async () => ({ exitCode: 1, counts: null });
    try {
      await decide({
        gateFn: gateCompletionAnchorA,
        mode: "enforce",
        env: {},
        logger: makeLogger(),
        ctx: {
          tool: "write",
          args: { filePath: "workflow-state.json", content: completedContent },
          sessionAgent: "orchestrator",
          config: TEST_CONFIG,
          report,
          demand: report.demand,
          publishedSeal: testSeal(),
          contraproveExec: execFn,
          treeHash: "tree-dogfood-s1",
          logger: makeLogger(),
        },
      });
      assert.fail("expected DenyError contraprove-divergent");
    } catch (err) {
      assert.ok(err instanceof DenyError);
      assert.equal(err.reason, "contraprove-divergent");
      assert.equal(err.details?.expectedExit, 0);
      assert.equal(err.details?.observedExit, 1);
    }
  });
});

describe("DOG-01 S2 (V11): bash into a protected path => deny + CI backstop present", () => {
  it("redirect into the gate => deny protected-path-write", async () => {
    await deniesBothModes(
      gateShellHygiene,
      { tool: "bash", args: { command: "cat > .opencode/plugins/gate.js" }, config: TEST_CONFIG },
      "protected-path-write",
    );
  });

  it("CI + pre-commit backstop files exist (the revert net)", async () => {
    assert.ok(existsSync(join(REPO_ROOT, ".github", "workflows", "harness-integrity.yml")), "CI workflow missing");
    assert.ok(existsSync(join(REPO_ROOT, ".githooks", "pre-commit")), "pre-commit missing");
  });
});

describe("DOG-01 S3 (mirror): correct evidence => allow, no false positive", () => {
  it("matching REPORT + re-run => allow in both modes", async () => {
    const counts = { unit: { passed: 31, failed: 0, skipped: 0 } };
    const report = {
      demand: "harness-v7-hardening",
      commands: [{ cmd: TEST_COMMANDS.suiteFull, exitCode: 0 }],
      counts,
      selfReported: true,
    };
    const execFn = async () => ({ exitCode: 0, counts });
    await allowsBothModes(gateCompletionAnchorA, {
      tool: "write",
      args: { filePath: "workflow-state.json", content: completedContent },
      sessionAgent: "orchestrator",
      config: TEST_CONFIG,
      report,
      demand: report.demand,
      publishedSeal: testSeal(),
      contraproveExec: execFn,
      treeHash: "tree-dogfood-s3",
      logger: makeLogger(),
    });
  });
});

describe("DOG-01 S4 (regression): consumer suite is this repo's suite", () => {
  it("canonical commands resolve from harness.config.json (no hardcoded literal)", async () => {
    const config = loadHarnessConfig(join(REPO_ROOT, "harness.config.json"));
    assert.ok(typeof config?.commands?.suiteFull === "string" && config.commands.suiteFull.length > 0);
    assert.ok(typeof config?.commands?.unit === "string" && config.commands.unit.length > 0);
    assert.match(config.commands.suiteFull, /opencode\/plugins\/__tests__/);
  });

  it("sealed commands verify (untampered trust root)", async () => {
    const config = loadHarnessConfig(join(REPO_ROOT, "harness.config.json"));
    assert.equal(verifySealOrDeny(config.commands, sealCommands(config.commands)), true);
  });

  it("gate.js is registered in opencode.json plugin list (flip consistency)", async () => {
    const raw = readFileSync(join(REPO_ROOT, "opencode.json"), "utf8");
    const parsed = JSON.parse(raw);
    assert.ok(Array.isArray(parsed.plugin), "opencode.json plugin must be an array");
    assert.ok(parsed.plugin.some((entry) => String(entry).includes("gate.js")), "gate.js must be registered");
  });
});
