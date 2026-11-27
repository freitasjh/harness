import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ADR = path.join(process.cwd(), ".spec", "prd", "prd-codex-port", "ADRs", "ADR-001-inventario-contrato", "ADR.md");
const SPEC = path.join(process.cwd(), ".spec", "prd", "prd-codex-port", "ADRs", "ADR-001-inventario-contrato", "SPEC.md");

describe("IC-03 — deny semantics (permissionDecision/exit 2)", () => {
  const adrText = fs.readFileSync(ADR, "utf8");
  const specText = fs.readFileSync(SPEC, "utf8");

  it("ADR declara permissionDecision deny", () => {
    assert.ok(adrText.includes('permissionDecision:"deny"'));
  });

  it("ADR declara exit code 2", () => {
    assert.ok(/exit code 2|exit 2/.test(adrText));
  });

  it("ADR proíbe prompts interativos como gate", () => {
    assert.ok(/Prompts interativos como gate são proibidos/.test(adrText));
  });

  it("SPEC declara RF-03 com as duas formas", () => {
    assert.ok(specText.includes("RF-03"));
    assert.ok(specText.includes('permissionDecision:"deny"'));
  });

  it("nega forma não aceita (prompt interativo) no contrato", () => {
    assert.ok(!/prompt interativo como gate é permitido/i.test(adrText + specText));
  });
});