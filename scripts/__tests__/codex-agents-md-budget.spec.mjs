import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertInstructionBudget, measureInstructionChain } from "../codex-support.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUDGET = 32768;

function withinBudget(size, limit = BUDGET) {
  return size <= limit;
}

describe("IC-09 — teto de injeção 32 KiB (AGENTS.md)", () => {
  it("constante é 32768", () => {
    assert.equal(BUDGET, 32768);
  });

  it("dentro do teto passa", () => {
    assert.equal(withinBudget(1000), true);
  });

  it("exatamente 32768 passa", () => {
    assert.equal(withinBudget(32768), true);
  });

  it("32769 falha", () => {
    assert.equal(withinBudget(32769), false);
  });

  it("medição efetiva real (raiz) está dentro do teto", () => {
    const measured = measureInstructionChain(ROOT, ".");
    assert.equal(measured.ok, true, `${measured.bytes} bytes`);
    assert.ok(fs.statSync(path.join(ROOT, "AGENTS.md")).size <= BUDGET);
  });

  it("32768 bytes passa e 32769 bytes lança", () => {
    assert.doesNotThrow(() => assertInstructionBudget(32768));
    assert.throws(() => assertInstructionBudget(32769), /32768/);
  });

  it("medição soma raiz + aninhados no escopo", () => {
    const measured = measureInstructionChain(ROOT, "scripts");
    assert.ok(measured.files.some((f) => f.rel === "AGENTS.md"));
    assert.ok(measured.files.some((f) => f.rel === "scripts/AGENTS.md"));
    assert.ok(measured.bytes > fs.statSync(path.join(ROOT, "AGENTS.md")).size);
  });
});