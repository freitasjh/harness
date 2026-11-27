import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCodexDualRun, isForbiddenPath } from "../check-codex-dualrun.mjs";

test("dual-run: paths proibidos não aparecem no diff", () => {
  const r = checkCodexDualRun();
  assert.equal(r.ok, true, `hits: ${r.hits.join(", ")}`);
});

test("isForbiddenPath: .opencode/, opencode.json, .agents/", () => {
  assert.equal(isForbiddenPath(".opencode/plugins/gate.js"), false);
  assert.equal(isForbiddenPath(".opencode/plugins/lib/gate-core.mjs"), false);
  assert.equal(isForbiddenPath("opencode.json"), true);
  assert.equal(isForbiddenPath(".agents/rules/always-on.md"), false);
  assert.equal(isForbiddenPath(".agents/skills/prompt-optimizer/SKILL.md"), false);
  assert.equal(isForbiddenPath("scripts/foo.mjs"), false);
  assert.equal(isForbiddenPath(".spec/prd/x/PRD.md"), false);
});
