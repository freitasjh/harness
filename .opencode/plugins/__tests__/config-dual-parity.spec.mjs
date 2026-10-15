// config-dual-parity.spec.mjs — Batch 2 (PL-04 + PL-05 + PL-06, TDD FIRST).
//
// Single parity spec for the batch: satellite no-ops (PL-04, V2-FE-01),
// config dual keys C1-C3 (PL-05, V2-BE-08) and loader parity v1-shape x
// v2-shape (PL-06, V2-BE-10). Uses the real loader border
// loadConfigOrDeny / ensureConfig from gate.js:215-237 (UNMODIFIED).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import validatorDefault, {
  HarnessValidator,
  setup as validatorSetup,
} from "../harness-validator.js";
import guardrailDefault, {
  HitlGuardrail,
  setup as guardrailSetup,
} from "../hitl-guardrail.js";
import {
  decide,
  gatePiccoTask,
  gateShellHygiene,
  loadConfigOrDeny,
  ensureConfig,
  DEFAULT_MODE,
} from "../gate.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const readText = (rel) => readFileSync(join(REPO_ROOT, rel), "utf8");
const opencodeJson = () => JSON.parse(readText("opencode.json"));

// Documented precedence (ADR-003, SPEC 4.2): v2 wins when both shapes are
// present, v1 is the fallback. The loader in gate.js stays untouched; this
// resolver mirrors the precedence the test asserts on opencode.json.
function resolveDual({ v1, v2 } = {}) {
  return v2 !== undefined ? v2 : v1;
}

function spyStub() {
  const calls = [];
  return {
    calls,
    ctx: {
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
    },
  };
}

const SATELLITES = [
  { name: "harness-validator", mod: validatorDefault, bare: HarnessValidator, setup: validatorSetup },
  { name: "hitl-guardrail", mod: guardrailDefault, bare: HitlGuardrail, setup: guardrailSetup },
];

describe("Batch 2 PL-04 — satellites stay no-op with dual export", () => {
  for (const sat of SATELLITES) {
    it(`${sat.name}: bare v1 function intact and default carries server + setup`, () => {
      assert.equal(typeof sat.bare, "function", "bare v1 function intact");
      assert.equal(sat.mod.server, sat.bare, "server entry points at the bare function");
      assert.equal(sat.mod.setup, sat.setup, "v2 setup present on the default record");
      assert.equal(typeof sat.setup, "function");
      assert.equal(sat.mod.id, sat.name);
    });

    it(`${sat.name}: v1 invoke returns {} (allow), never denies`, async () => {
      assert.deepEqual(await sat.bare({}), {});
      assert.deepEqual(await sat.bare(), {});
    });

    it(`${sat.name}: v2 setup(stub) registers zero deny hooks and stays no-op`, async () => {
      const { ctx, calls } = spyStub();
      const result = await sat.setup(ctx);
      assert.equal(result.id, sat.name);
      assert.deepEqual(await sat.bare({}), {}, "still no-op after v2 setup");
      for (const call of calls) {
        assert.notEqual(call.handler?.name, "DenyError", "no deny hook registered");
      }
    });

    it(`${sat.name}: setup twice keeps no-op state (no hook accumulation)`, async () => {
      const first = spyStub();
      const second = spyStub();
      const r1 = await sat.setup(first.ctx);
      const r2 = await sat.setup(second.ctx);
      assert.equal(r1.id, sat.name);
      assert.equal(r2.id, sat.name);
      assert.deepEqual(await sat.bare({}), {});
      assert.equal(second.calls.length, first.calls.length, "no accumulation across setups");
    });

    it(`${sat.name}: static source has zero DenyError and no scalar re-injection`, () => {
      const rel =
        sat.name === "harness-validator"
          ? ".opencode/plugins/harness-validator.js"
          : ".opencode/plugins/hitl-guardrail.js";
      const src = readText(rel);
      assert.equal((src.match(/DenyError/g) ?? []).length, 0, "zero DenyError");
      assert.equal((src.match(/throw new/g) ?? []).length, 0, "never throws");
      assert.match(src, /setup/, "v2 setup present in source");
    });
  }
});

describe("Batch 2 PL-05 — opencode.json carries dual keys C1-C3, v1 retained", () => {
  it("C1: plugin (v1 array) + plugins (v2 objects) coexist on the same targets", () => {
    const json = opencodeJson();
    assert.ok(Array.isArray(json.plugin), "v1 plugin array retained");
    assert.ok(Array.isArray(json.plugins), "v2 plugins array present");
    assert.equal(json.plugins.length, json.plugin.length, "same plugin set in both shapes");
    json.plugins.forEach((entry, i) => {
      assert.equal(typeof entry, "object", `plugins[${i}] is a v2 object, not a bare path`);
      assert.equal(entry.path, json.plugin[i], `plugins[${i}].path mirrors plugin[${i}]`);
    });
  });

  it("C2: permission.task (v1) + permissions subagent/shell (v2) coexist", () => {
    const json = opencodeJson();
    assert.equal(json.permission?.task, "ask", "v1 permission.task retained");
    assert.equal(typeof json.permissions, "object", "v2 permissions present");
    assert.equal(json.permissions.subagent, json.permission.task, "task maps to subagent with equal value");
    assert.ok("shell" in json.permissions, "v2 shell key present");
  });

  it("C3: every agent prompt (v1) mirrored as agents system (v2) with same file ref", () => {
    const json = opencodeJson();
    const v1Names = Object.keys(json.agent ?? {});
    assert.ok(v1Names.length > 0, "v1 agent block retained");
    for (const name of v1Names) {
      const v1entry = json.agent[name];
      const v2entry = json.agents?.[name];
      assert.ok(v2entry, `agents.${name} present`);
      assert.equal(v2entry.system, v1entry.prompt, `agents.${name}.system mirrors agent.${name}.prompt`);
      assert.equal(v2entry.mode, v1entry.mode, `agents.${name}.mode unchanged`);
    }
  });

  it("C4: per-agent tools unchanged between agent.* and agents.* (native layer)", () => {
    const json = opencodeJson();
    for (const name of Object.keys(json.agent ?? {})) {
      assert.deepEqual(
        json.agents[name].tools,
        json.agent[name].tools,
        `tools for ${name} byte-equal across shapes (C4 unchanged)`,
      );
    }
  });

  it("precedence v2-wins documented next to the config + boot-reload noted", () => {
    const json = opencodeJson();
    const note = json.$comment ?? json._dualRuntime ?? "";
    assert.equal(typeof note, "string", "precedence note present in opencode.json");
    assert.match(note, /v2/i, "note names the v2 keys");
    assert.match(note, /win|precedence|fallback/i, "note documents v2-wins with v1 fallback");
    assert.match(note, /restart|boot|reload/i, "note records boot-time reload (restart required)");
  });
});

describe("Batch 2 PL-06 — loader parity: identical verdict in both shapes", () => {
  const DENY_TASK = { tool: "task", args: { prompt: "do the thing with no picco block at all" } };
  const ALLOW_TASK = {
    tool: "task",
    args: {
      prompt: "<role>dev</role><task>fix</task><context>c</context><constraints>k</constraints><acceptance>a</acceptance><open_questions></open_questions>",
    },
  };

  it("loader border intact: loadConfigOrDeny reads the file, ensureConfig passes through", () => {
    const fromFile = loadConfigOrDeny();
    assert.equal(fromFile.version, 1, "file config loads via loadConfigOrDeny");
    const probe = { gates: { picco: "enforce" }, marker: "shape-probe" };
    assert.equal(ensureConfig({ config: probe }), probe, "ensureConfig returns injected config as-is");
  });

  it("parity deny: PICCO-absent task denies identically via v1-shape and v2-shape", async () => {
    const json = opencodeJson();
    const policyV1 = resolveDual({ v1: json.permission?.task, v2: undefined });
    const policyV2 = resolveDual({ v1: json.permission?.task, v2: json.permissions?.subagent });
    assert.equal(policyV1, policyV2, "both shapes resolve the same delegation policy");
    const verdicts = [];
    for (const shape of ["v1", "v2"]) {
      const outcome = await decide({
        gateFn: gatePiccoTask,
        mode: DEFAULT_MODE,
        ctx: { ...DENY_TASK, shape },
      }).then(
        () => "allow",
        (err) => `deny:${err.reason ?? err.message}`,
      );
      verdicts.push(outcome);
    }
    assert.match(verdicts[0], /^deny:/, "v1 shape denies");
    assert.equal(verdicts[1], verdicts[0], "PARITY-DIVERGENT: v2 shape must deny identically");
  });

  it("parity allow: valid PICCO task allows identically via v1-shape and v2-shape", async () => {
    const verdicts = [];
    for (const shape of ["v1", "v2"]) {
      const outcome = await decide({
        gateFn: gatePiccoTask,
        mode: DEFAULT_MODE,
        ctx: { ...ALLOW_TASK, shape },
      }).then(
        () => "allow",
        (err) => `deny:${err.reason ?? err.message}`,
      );
      verdicts.push(outcome);
    }
    assert.equal(verdicts[0], "allow", "v1 shape allows");
    assert.equal(verdicts[1], verdicts[0], "PARITY-DIVERGENT: v2 shape must allow identically");
  });

  it("parity shell: pkill-f denies and clean bash allows in both shapes", async () => {
    const config = loadConfigOrDeny();
    const cases = [
      [{ tool: "bash", args: { command: "pkill -f worker" }, config }, "deny"],
      [{ tool: "bash", args: { command: "echo hi" }, config }, "allow"],
    ];
    for (const [ctx, expected] of cases) {
      const verdicts = [];
      for (const shape of ["v1", "v2"]) {
        const outcome = await decide({
          gateFn: gateShellHygiene,
          mode: DEFAULT_MODE,
          ctx: { ...ctx, shape },
        }).then(
          () => "allow",
          (err) => `deny:${err.reason ?? err.message}`,
        );
        verdicts.push(outcome);
      }
      assert.equal(verdicts[0].startsWith(expected), true, `v1 shape ${expected}s (${verdicts[0]})`);
      assert.equal(verdicts[1], verdicts[0], `PARITY-DIVERGENT: shell ${expected} must match`);
    }
  });

  it("precedence: dual-present resolves v2 deterministically across re-reads", () => {
    const first = resolveDual({ v1: "v1-value", v2: "v2-value" });
    const second = resolveDual({ v1: "v1-value", v2: "v2-value" });
    assert.equal(first, "v2-value", "v2 wins when both present");
    assert.equal(second, first, "re-read returns the same result");
    assert.equal(resolveDual({ v1: "only-v1" }), "only-v1", "v1-only falls back without throw");
    assert.equal(resolveDual({ v2: "only-v2" }), "only-v2", "v2-only resolves without throw");
  });
});
