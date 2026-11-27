import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ADR = path.join(process.cwd(), ".spec", "prd", "prd-codex-port", "ADRs", "ADR-001-inventario-contrato", "ADR.md");
const SPEC = path.join(process.cwd(), ".spec", "prd", "prd-codex-port", "ADRs", "ADR-001-inventario-contrato", "SPEC.md");
const TASKS = path.join(process.cwd(), ".spec", "prd", "prd-codex-port", "ADRs", "ADR-001-inventario-contrato", "TASKS.md");

describe("IC-04 — kill-switch HARNESS_GATES=off", () => {
  const adrText = fs.readFileSync(ADR, "utf8");
  const specText = fs.readFileSync(SPEC, "utf8");
  const tasksText = fs.readFileSync(TASKS, "utf8");
  const all = adrText + "\n" + specText + "\n" + tasksText;

  it("declara HARNESS_GATES=off", () => {
    assert.ok(all.includes("HARNESS_GATES=off"));
  });

  it("declara zero denies com env setada", () => {
    assert.ok(/0 denies|zero denies/i.test(all));
  });

  it("declara bypass log sem segredo e sem eco de path", () => {
    assert.ok(/sem segredo/i.test(all));
    assert.ok(/sem eco de path/i.test(all));
  });

  it("env ausente ⇒ hooks ativos (comportamento padrão)", () => {
    assert.ok(all.includes("HARNESS_GATES") && all.includes("não setada"));
  });
});