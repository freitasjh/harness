import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { tempScope } from "../test-temp.mjs";
import { checkCodexInventory, countAgents, countRules, countSkills, countInventoryRows, REPO_ROOT } from "../check-codex-inventory.mjs";

const TMP = tempScope({ label: "codex-inventory" });
afterEach(() => TMP.cleanup());
after(() => TMP.cleanup());

describe("IC-01 — inventário de superfícies (7) + contagens", () => {
  it("repo real: 7 linhas de inventário", () => {
    assert.equal(countInventoryRows(REPO_ROOT), 7);
  });

  it("repo real: agentes=11, regras=8, skills=39", () => {
    assert.equal(countAgents(REPO_ROOT), 11);
    assert.equal(countRules(REPO_ROOT), 8);
    assert.equal(countSkills(REPO_ROOT), 39);
  });

  it("checkCodexInventory ok no repo real", () => {
    const res = checkCodexInventory(REPO_ROOT);
    assert.equal(res.ok, true, res.problems.join("; "));
    assert.deepEqual(res.counts.agents, 11);
  });

  it("inventário parcial reprova", async () => {
    const root = TMP.tmp({
      ".spec/prd/prd-codex-port/ADRs/ADR-001-inventario-contrato/ADR.md": "# ADR\n\nSem tabela\n",
      "opencode.json": JSON.stringify({ agent: { orchestrator: {} } }),
    });
    // create rules/skills minimal dirs
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    mkdirSync(join(root, ".agents", "rules"), { recursive: true });
    mkdirSync(join(root, ".agents", "skills", "s"), { recursive: true });
    writeFileSync(join(root, ".agents", "rules", "r.md"), "x");
    const res = checkCodexInventory(root);
    assert.equal(res.ok, false);
    assert.ok(res.problems.some((p) => /inventário|Superfície opencode|agentes|skills/.test(p)));
  });
});