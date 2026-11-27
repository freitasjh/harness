import { describe, it } from "node:test";
import assert from "node:assert/strict";

function isDualRunForbidden(relPath) {
  const p = String(relPath).replace(/\\/g, "/").replace(/^\.?\//, "");
  if (p.startsWith(".opencode/") || p === ".opencode") return true;
  if (p === "opencode.json") return true;
  // drift externo aceito pelo owner 2026-11-24
  if (p.startsWith(".agents/skills/")) return false;
  if (p.startsWith(".agents/")) return true;
  return false;
}

describe("IC-05 — dual-run invariante (paths proibidos)", () => {
  it("paths opencode proibidos", () => {
    assert.equal(isDualRunForbidden(".opencode/plugins/gate.js"), true);
    assert.equal(isDualRunForbidden("opencode.json"), true);
    assert.equal(isDualRunForbidden(".agents/rules/always-on.md"), true);
  });

  it("paths novos permitidos", () => {
    assert.equal(isDualRunForbidden(".agents/skills/prompt-optimizer/SKILL.md"), false);
    assert.equal(isDualRunForbidden("scripts/check-codex-inventory.mjs"), false);
    assert.equal(isDualRunForbidden(".codex/hooks.json"), false);
    assert.equal(isDualRunForbidden("harness/codex-port-smoke.json"), false);
  });

  it("documentação declara exceção de merge aditivo", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const spec = readFileSync(join(process.cwd(), ".spec", "prd", "prd-codex-port", "ADRs", "ADR-001-inventario-contrato", "SPEC.md"), "utf8");
    assert.ok(spec.includes("merge aditivo"));
  });
});