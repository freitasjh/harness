import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateAgainstSchema, reportSchemaViolations } from "../../.opencode/plugins/gate.js";

const SCHEMA_PATH = path.join(process.cwd(), ".agents", "schemas", "harness-report.schema.json");
const TEMPLATE_PATH = path.join(process.cwd(), "harness", "codex-port-smoke.json");

describe("IC-07 — smoke report schema", () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const template = JSON.parse(fs.readFileSync(TEMPLATE_PATH, "utf8"));

  it("template existe e é JSON válido", () => {
    assert.ok(template && typeof template === "object");
  });

  it("template válido contra o schema (0 violações)", () => {
    const violations = reportSchemaViolations(template, schema);
    assert.deepEqual(violations, [], JSON.stringify(violations));
  });

  it("validateAgainstSchema retorna [] para o template", () => {
    assert.deepEqual(validateAgainstSchema(template, schema), []);
  });

  it("report sem campo obrigatório falha", () => {
    const mutated = { ...template };
    delete mutated.brainStore;
    const violations = validateAgainstSchema(mutated, schema);
    assert.ok(violations.some((v) => v.keyword === "required" && v.missing === "brainStore"));
  });

  it("template não contém padrões de segredo", () => {
    const raw = fs.readFileSync(TEMPLATE_PATH, "utf8");
    assert.ok(!/sk-[a-z0-9]{10,}/i.test(raw));
    assert.ok(!/token\s*[:=]\s*["'][^"']+["']/i.test(raw));
  });
});