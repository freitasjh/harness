import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SCHEMA_PATH = join(REPO_ROOT, ".agents", "schemas", "harness-report.schema.json");

// Test-only minimal required-fields checker. The authoritative validator
// lives in gate.js (GATE-03, Batch 4); this asserts the schema itself
// enforces what CFG-02 acceptance demands.
function checkRequired(report, schema) {
  const missing = [];
  for (const key of schema.required ?? []) {
    if (!(key in report)) missing.push(key);
  }
  return missing;
}

function validReport() {
  return {
    version: 1,
    demand: "CFG-02",
    agent: "developer-engineer",
    phase: "Execution",
    gitSha: "abc123",
    commands: [{ cmd: "node --test", exitCode: 0, durationMs: 10, stdoutHash: "deadbeef" }],
    counts: {
      unit: { passed: 5, failed: 0, skipped: 0 },
      it: { passed: 0, failed: 0, skipped: 0 },
      frontend: { passed: 0, failed: 0, skipped: 0 },
    },
    evaluation: { telas: "ok", negocio: "ok", logica: "ok", perf: "ok" },
    brainStore: [],
    cleanup: { ports: [] },
    selfReported: false,
  };
}

describe("harness-report.schema.json — CFG-02 (SPEC §5.2)", () => {
  it("schema is valid JSON with required counts and selfReported", () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
    assert.ok((schema.required ?? []).includes("counts"));
    assert.ok((schema.required ?? []).includes("selfReported"));
  });

  it("valid REPORT passes", () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
    assert.deepEqual(checkRequired(validReport(), schema), []);
  });

  it("REPORT without counts fails", () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
    const { counts, ...rest } = validReport();
    assert.ok(checkRequired(rest, schema).includes("counts"));
  });

  it("REPORT without selfReported fails", () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
    const { selfReported, ...rest } = validReport();
    assert.ok(checkRequired(rest, schema).includes("selfReported"));
  });
});
