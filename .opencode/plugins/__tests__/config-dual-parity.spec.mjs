// config-dual-parity.spec.mjs — Batch 2 (PL-04 satellites + PL-05 config +
// PL-06 loader border), INVERTED to v2-only (opencode-v2-only, EX2-VAL-03/04).
// (Legacy name kept so the orchestrator's file tracking stays stable.)
//
// HISTORY: this file was `config-dual-parity.spec.mjs` and asserted the
// superseded dual runtime (v1 `server` entries, `agents`/`system` maps,
// `permissions`, `plugin`+`plugins` coexist, v2-wins precedence). The owner
// decided v2-only and removed every dual key. The assertions below are the
// INVERSION: they assert the ABSENCE of the dual shape and the PRESENCE of the
// measured v2-only shape. Retired assertions (with reason):
//   - "default carries server + setup"        -> `server` key removed.
//   - C1 "plugin + plugins coexist"           -> dual `plugins` shape removed.
//   - C2 "permission.task + permissions"      -> dual `permissions` removed.
//   - C3 "agents.system mirrors agent.prompt" -> dual `agents` map removed.
//   - C4 "tools equal across agent.*/agents.*"-> no second shape exists.
//   - "precedence v2-wins documented"         -> no precedence; v2-only.
//   - PL-06 "dual-present resolves v2"        -> no dual resolver exists.
//
// The real loader border (loadConfigOrDeny / ensureConfig) is UNMODIFIED (pure
// core, RF-02) and is exercised here unchanged.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import validatorDefault, { HarnessValidator } from "../harness-validator.js";
import guardrailDefault, { HitlGuardrail } from "../hitl-guardrail.js";
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

const SATELLITES = [
  { name: "harness-validator", mod: validatorDefault, bare: HarnessValidator, rel: ".opencode/plugins/harness-validator.js" },
  { name: "hitl-guardrail", mod: guardrailDefault, bare: HitlGuardrail, rel: ".opencode/plugins/hitl-guardrail.js" },
];

describe("PL-04 — satellites are v2-only no-ops (no `server`, setup returns undefined)", () => {
  for (const sat of SATELLITES) {
    it(`${sat.name}: default is { id, setup } with NO \`server\` entry`, () => {
      assert.equal(typeof sat.mod, "object");
      assert.equal(sat.mod.id, sat.name);
      assert.equal(typeof sat.mod.setup, "function");
      assert.ok(!("server" in sat.mod), "v1 `server` entry removed (v2-only)");
      assert.equal(typeof sat.bare, "function", "the bare no-op function stays exported for the pure-core tests");
    });

    it(`${sat.name}: bare no-op function returns {} (allow), never denies`, async () => {
      assert.deepEqual(await sat.bare({}), {});
      assert.deepEqual(await sat.bare(), {});
    });

    it(`${sat.name}: setup(stub) registers zero hooks and returns undefined`, async () => {
      const calls = [];
      const ctx = {
        tool: { hook: async (...a) => calls.push(a) },
        event: { subscribe: () => { calls.push("subscribe"); return {}; } },
      };
      const result = await sat.mod.setup(ctx);
      assert.equal(result, undefined, "truthy return would be CALLED by acquireRelease => TypeError");
      assert.equal(calls.length, 0, "a declared no-op registers nothing");
    });

    it(`${sat.name}: setup twice stays a no-op (no hook accumulation)`, async () => {
      const mk = () => {
        const calls = [];
        return { calls, ctx: { tool: { hook: async (...a) => calls.push(a) } } };
      };
      const first = mk();
      const second = mk();
      assert.equal(await sat.mod.setup(first.ctx), undefined);
      assert.equal(await sat.mod.setup(second.ctx), undefined);
      assert.deepEqual(await sat.bare({}), {});
      assert.equal(second.calls.length, first.calls.length, "no accumulation across setups");
    });

    it(`${sat.name}: static source has zero DenyError and no scalar re-injection`, () => {
      const src = readText(sat.rel);
      assert.equal((src.match(/DenyError/g) ?? []).length, 0, "zero DenyError");
      assert.equal((src.match(/throw new/g) ?? []).length, 0, "never throws");
      assert.match(src, /setup/, "v2 setup present in source");
    });
  }
});

describe("PL-05 — opencode.json is v2-only (dual keys ABSENT, v2 shape PRESENT)", () => {
  it("v2-only: `plugin` is an EMPTY array (local plugins auto-load from .opencode/plugins/)", () => {
    const json = opencodeJson();
    assert.ok(Array.isArray(json.plugin), "`plugin` is an array");
    assert.equal(json.plugin.length, 0, "no local path listed — the key is for npm packages only");
    assert.ok(
      !json.plugin.some((entry) => String(entry).includes(".opencode/plugins")),
      "no local plugin path in `plugin`",
    );
  });

  it("v2-only: the dual `agents` / `system` map is ABSENT", () => {
    const json = opencodeJson();
    assert.ok(!("agents" in json), "dual `agents` map removed");
    for (const name of Object.keys(json.agent ?? {})) {
      assert.ok(!("system" in json.agent[name]), `agent.${name} carries no system key`);
    }
  });

  it("v2-only: the malformed dual `permissions` key is ABSENT", () => {
    const json = opencodeJson();
    assert.ok(!("permissions" in json), "dual `permissions` key removed");
  });

  it("v2 shape: every `agent` entry has the mandatory `description` + `permission`", () => {
    const json = opencodeJson();
    const names = Object.keys(json.agent ?? {});
    assert.equal(names.length, 9, `9 agents expected, got ${names.length}`);
    for (const name of names) {
      const entry = json.agent[name];
      assert.equal(typeof entry.description, "string", `agent.${name}.description present`);
      assert.ok(entry.description.length > 0, `agent.${name}.description non-empty`);
      assert.equal(typeof entry.prompt, "string", `agent.${name}.prompt present`);
      assert.equal(typeof entry.permission, "object", `agent.${name}.permission present`);
    }
  });

  it("I3/RF-03: orchestrator / code-reviewer / ux-designer deny edit", () => {
    const json = opencodeJson();
    for (const name of ["orchestrator", "code-reviewer", "ux-designer"]) {
      assert.equal(
        json.agent?.[name]?.permission?.edit,
        "deny",
        `${name} must deny edit (native layer)`,
      );
    }
  });

  it("v2-only is declared next to the config", () => {
    const json = opencodeJson();
    const note = json.$experiment ?? "";
    assert.match(note, /v2-only/i, "note names the v2-only decision");
    assert.match(note, /auto-?carregad|auto-?load/i, "note records local auto-load");
  });
});

describe("PL-06 — loader border intact + deny/allow verdicts unchanged", () => {
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

  it("PICCO deny: absent tag denies (single v2 contract, no shape label)", async () => {
    const outcome = await decide({
      gateFn: gatePiccoTask,
      mode: DEFAULT_MODE,
      ctx: DENY_TASK,
    }).then(
      () => "allow",
      (err) => `deny:${err.reason ?? err.message}`,
    );
    assert.equal(outcome, "deny:picco-tag-absent");
  });

  it("PICCO allow: valid tag allows", async () => {
    const outcome = await decide({
      gateFn: gatePiccoTask,
      mode: DEFAULT_MODE,
      ctx: ALLOW_TASK,
    }).then(
      () => "allow",
      (err) => `deny:${err.reason ?? err.message}`,
    );
    assert.equal(outcome, "allow");
  });

  it("shell hygiene: pkill-f denies and clean bash allows", async () => {
    const config = loadConfigOrDeny();
    const cases = [
      [{ tool: "bash", args: { command: "pkill -f worker" }, config }, "deny"],
      [{ tool: "bash", args: { command: "echo hi" }, config }, "allow"],
    ];
    for (const [ctx, expected] of cases) {
      const outcome = await decide({
        gateFn: gateShellHygiene,
        mode: DEFAULT_MODE,
        ctx,
      }).then(
        () => "allow",
        (err) => `deny:${err.reason ?? err.message}`,
      );
      assert.equal(outcome.startsWith(expected), true, `shell ${expected} (${outcome})`);
    }
  });
});
