// sdd-checks.spec.mjs — TDD for SDD-02/SDD-03/RENAME/V4/V12/V17 (Batch 7).
// Pure helpers from scripts/sdd-checks.mjs, tested against tmp fixtures
// (no repo state, no network). Failing first, then green.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  countLines,
  findLiveRefs,
  extractTaskIds,
  extractTaskSections,
  hasGatesConvention,
  hasNoBypassClause,
  hasVocabTable,
  isMappingLine,
} from "../../../scripts/sdd-checks.mjs";

function tmp(files) {
  const root = mkdtempSync(join(tmpdir(), "sdd-checks-"));
  for (const [rel, content] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, content);
  }
  return root;
}

describe("V4 line budget", () => {
  it("counts lines across a rules dir", () => {
    const root = tmp({ "rules/a.md": "l1\nl2\n", "rules/b.md": "x\n" });
    assert.equal(countLines(join(root, "rules")), 3);
  });
});

describe("R-V12 orphan refs", () => {
  it("finds harness-continuous.md refs in live roots", () => {
    const root = tmp({ ".agents/x.md": "see harness-continuous.md H1" });
    assert.equal(findLiveRefs(root, ["harness-continuous\\.md"]).length, 1);
  });
  it("ignores archive history and pycache noise", () => {
    const root = tmp({
      ".spec/archive/o.md": "harness-continuous.md",
      ".agents/skills/x/__pycache__/a.pyc": "harness-continuous.md",
    });
    assert.equal(findLiveRefs(root, ["harness-continuous\\.md"]).length, 0);
  });
  it("fusion-record lines are audit trail, not orphans", () => {
    const root = tmp({ ".agents/rules/w.md": "fundido do harness-continuous.md (DOC-02)" });
    assert.equal(findLiveRefs(root, ["harness-continuous\\.md"]).length, 1);
    assert.equal(findLiveRefs(root, ["harness-continuous\\.md"], { allowFusionRecord: true }).length, 0);
  });
});

describe("RENAME anti-regression", () => {
  it("flags the old reviewer name in live paths", () => {
    const root = tmp({ ".agents/a.md": "ask fullstack-code-reviewer" });
    assert.equal(findLiveRefs(root, ["fullstack-code-reviewer"]).length, 1);
  });
  it("mapping lines (A → B) are not violations", () => {
    assert.equal(isMappingLine("RENAME `fullstack-code-reviewer` → `code-reviewer`"), true);
    assert.equal(isMappingLine("delegate to fullstack-code-reviewer now"), false);
  });
});

describe("SDD-02 mechanical subset", () => {
  it("every sprint-summary task id has a section", () => {
    const tasks = "| Phase 0 | INF-01 | Infra |\n| Phase 4 | RENAME | Infra |";
    const body = "### Task INF-01: x\n### Task RENAME: y\n";
    const ids = extractTaskIds(tasks);
    const sections = extractTaskSections(body);
    assert.deepEqual(ids, ["INF-01", "RENAME"]);
    for (const id of ids) assert.ok(sections.includes(id), `missing section ${id}`);
  });
  it("detects a section without Constraint Ref", () => {
    const root = tmp({
      "TASKS.md": "### Task X-01: t\n- **Constraint Ref**: U10\n- #### Acceptance — S1 ok\n",
    });
    assert.equal(hasGatesConvention(root), false);
  });
});

describe("SDD-01/SDD-03/V17 markers", () => {
  it("non-bypass clause requires the marker + gate-contract citation", () => {
    assert.equal(hasNoBypassClause("NÃO-BYPASS\nsee gate-contract.md"), true);
    assert.equal(hasNoBypassClause("no marker here"), false);
  });
  it("vocab table requires canonical header + a mapping row", () => {
    assert.equal(hasVocabTable("| Etapa (rótulo) | `current_phase` canônico |\n| P0 (triagem) | Discovery |"), true);
    assert.equal(hasVocabTable("no table"), false);
  });
});
