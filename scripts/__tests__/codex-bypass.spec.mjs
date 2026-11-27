import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ADR = path.join(process.cwd(), ".spec", "prd", "prd-codex-port", "ADRs", "ADR-001-inventario-contrato", "ADR.md");

describe("IC-06 — superfície de bypass declarada", () => {
  const text = fs.readFileSync(ADR, "utf8");

  it("declara Superfície de bypass", () => {
    assert.ok(text.includes("Superfície de bypass"));
  });

  it("declara mitigação (paridade de fixtures + revisão humana)", () => {
    assert.ok(/paridade de fixtures/i.test(text));
    assert.ok(/revisão humana/i.test(text));
  });
});