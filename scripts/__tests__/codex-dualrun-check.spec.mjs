import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkCodexDualRun, isForbiddenPath } from "../check-codex-dualrun.mjs";

describe("ADR-003 DUALRUN-01 — verificação dual-run", () => {
  it("caminho opencode é proibido (exceto as exceções declaradas)", () => {
    assert.equal(isForbiddenPath(".opencode/plugins/gate.js"), false);
    assert.equal(isForbiddenPath(".opencode/plugins/lib/gate-core.mjs"), false);
    assert.equal(isForbiddenPath(".opencode/plugins/__tests__/prompt-optimizer.spec.mjs"), false);
    assert.equal(isForbiddenPath(".opencode/plugins/outro.mjs"), true);
    assert.equal(isForbiddenPath("opencode.json"), true);
    assert.equal(isForbiddenPath(".agents/rules/always-on.md"), false);
    // drift externo aceito em .agents/skills/**; demais .agents/** seguem proibidos
    assert.equal(isForbiddenPath(".agents/skills/prompt-optimizer/SKILL.md"), false);
    assert.equal(isForbiddenPath(".agents/skills/brainstorming/scripts/helper.js"), false);
    assert.equal(isForbiddenPath(".agents/schemas/harness-report.schema.json"), false);
  });

  it("camada .codex é permitida", () => {
    assert.equal(isForbiddenPath(".codex/agents/architect.toml"), false);
    assert.equal(isForbiddenPath(".codex/config.toml"), false);
    assert.equal(isForbiddenPath(".codex/harness-state.json"), false);
  });

  it("diff de working tree não toca caminho opencode (exceto exceções declaradas)", () => {
    const result = checkCodexDualRun();
    assert.deepEqual(result.hits, [], JSON.stringify(result));
  });
});
