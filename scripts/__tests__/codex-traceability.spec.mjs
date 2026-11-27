import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SPEC = path.join(process.cwd(), ".spec", "prd", "prd-codex-port", "ADRs", "ADR-001-inventario-contrato", "SPEC.md");

describe("IC-10 — rastreabilidade ADR→RF/NFR", () => {
  const text = fs.readFileSync(SPEC, "utf8");

  it("SPEC §16 presente", () => {
    assert.ok(text.includes("## 16. Rastreabilidade ADR → RF/NFR"));
  });

  it("tabela de rastreabilidade presente", () => {
    assert.ok(text.includes("| ADR item | RF/NFR |"));
  });

  it("RF-01..RF-10 presentes", () => {
    for (let i = 1; i <= 10; i++) {
      const label = `RF-${String(i).padStart(2, "0")}`;
      assert.ok(text.includes(label), `${label} ausente`);
    }
  });

  it("NFR-01..NFR-09 presentes", () => {
    for (let i = 1; i <= 9; i++) {
      const label = `NFR-${String(i).padStart(2, "0")}`;
      assert.ok(text.includes(label), `${label} ausente`);
    }
  });

  it("invariantes INV-1..INV-6 presentes", () => {
    for (let i = 1; i <= 6; i++) {
      assert.ok(text.includes(`INV-${i}`), `INV-${i} ausente`);
    }
  });
});