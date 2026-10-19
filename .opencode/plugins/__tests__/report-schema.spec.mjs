import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateAgainstSchema,
  reportSchemaViolations,
  isDeclaredDeviation,
  SCHEMA_SUBSET_KEYWORDS,
} from "../gate.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SCHEMA_PATH = join(REPO_ROOT, ".agents", "schemas", "harness-report.schema.json");
const EVIDENCE_DIR = join(REPO_ROOT, "harness");

const readSchema = () => JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
const realReports = () =>
  readdirSync(EVIDENCE_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({ name, report: JSON.parse(readFileSync(join(EVIDENCE_DIR, name), "utf8")) }));

// Test-only minimal required-fields checker. The authoritative validator now
// lives in gate.js (validateAgainstSchema / reportSchemaViolations, C-1); this
// asserts the schema itself enforces what CFG-02 acceptance demands.
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
    const schema = readSchema();
    assert.ok((schema.required ?? []).includes("counts"));
    assert.ok((schema.required ?? []).includes("selfReported"));
  });

  it("valid REPORT passes", () => {
    const schema = readSchema();
    assert.deepEqual(checkRequired(validReport(), schema), []);
    assert.deepEqual(validateAgainstSchema(validReport(), schema), []);
  });

  it("REPORT without counts fails", () => {
    const schema = readSchema();
    const { counts, ...rest } = validReport();
    assert.ok(checkRequired(rest, schema).includes("counts"));
    assert.ok(validateAgainstSchema(rest, schema).some((v) => v.keyword === "required" && v.missing === "counts"));
  });

  it("REPORT without selfReported fails", () => {
    const schema = readSchema();
    const { selfReported, ...rest } = validReport();
    assert.ok(checkRequired(rest, schema).includes("selfReported"));
  });
});

// ---------------------------------------------------------------------------
// C-1 — real evidence validation. Before this, NOTHING validated the real
// `harness/*.json` files against the schema: a real violation was invisible.
// ---------------------------------------------------------------------------
describe("C-1 — real harness/*.json validated against the schema", () => {
  it("the guard is not vacuous: at least one real report is validated", () => {
    assert.ok(realReports().length > 0, "harness/*.json exists");
  });

  it("every real report conforms, or declares the exact missing key as a deviation", () => {
    const schema = readSchema();
    const failures = [];
    for (const { name, report } of realReports()) {
      const violations = reportSchemaViolations(report, schema);
      if (violations.length > 0) failures.push(`${name}: ${JSON.stringify(violations)}`);
    }
    assert.deepEqual(failures, [], "a real schema violation (undeclared) must leave this suite red");
  });

  it("load-bearing: a real report missing a required key WITHOUT a declaration is a violation", () => {
    const schema = readSchema();
    const { name, report } = realReports().find(({ report }) => "counts" in report);
    assert.ok(name, "a conformant real report exists");
    const { counts, ...withoutCounts } = report;
    const violations = reportSchemaViolations(withoutCounts, schema);
    assert.ok(
      violations.some((v) => v.keyword === "required" && v.missing === "counts"),
      `dropping counts from ${name} must be caught`,
    );
    // ...and the tolerance is DECLARATION-gated, never a blanket skip.
    const declared = {
      ...withoutCounts,
      deviation: { field: "counts", action: "omitted-on-purpose", schemaRequires: true },
    };
    assert.deepEqual(reportSchemaViolations(declared, schema), []);
    assert.equal(isDeclaredDeviation(declared, "counts"), true);
    assert.equal(isDeclaredDeviation(withoutCounts, "counts"), false, "silence is not a declaration");
  });

  it("load-bearing: type violations are caught even for a required key that IS present", () => {
    const schema = readSchema();
    const broken = validReport();
    broken.counts.unit.passed = "five";
    const violations = validateAgainstSchema(broken, schema);
    assert.ok(
      violations.some((v) => v.keyword === "type" && v.path.endsWith("counts.unit.passed")),
      `type violation must be caught, got ${JSON.stringify(violations)}`,
    );
  });

  it("declared limit: the schema uses only the subset keywords this validator evaluates", () => {
    const schema = readSchema();
    const META = new Set(["$schema", "$id", "title", "description"]);
    const found = new Set();
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(walk);
      for (const [key, value] of Object.entries(node)) {
        // `$defs` and `properties` hold NAMES as keys (definition/property
        // names are not keywords): only their values are walked.
        if (key === "$defs") {
          for (const child of Object.values(value)) walk(child);
          continue;
        }
        if (META.has(key)) {
          walk(value);
          continue;
        }
        found.add(key);
        if (key === "properties") {
          for (const child of Object.values(value)) walk(child);
        } else {
          walk(value);
        }
      }
    };
    walk(schema);
    for (const keyword of found) {
      assert.ok(
        SCHEMA_SUBSET_KEYWORDS.includes(keyword),
        `schema keyword "${keyword}" is outside the declared validator subset (${SCHEMA_SUBSET_KEYWORDS.join(", ")}) — extend the validator or the limit`,
      );
    }
  });
});
