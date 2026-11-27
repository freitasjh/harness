import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { tempScope } from "../test-temp.mjs";
import { extractReasonCodes, extractReasonCodeEntries, REPO_ROOT } from "../extract-reason-codes.mjs";

const TMP = tempScope({ label: "codex-reason-codes" });
afterEach(() => TMP.cleanup());
after(() => TMP.cleanup());

describe("IC-02 — reason codes (CORE_GATES) extraídos de gate.js", () => {
  it("extração não vazia", () => {
    const codes = extractReasonCodes(REPO_ROOT);
    assert.ok(Array.isArray(codes));
    assert.ok(codes.length > 0);
  });

  it("estabilidade: duas extrações iguais (hash)", () => {
    const a = extractReasonCodes(REPO_ROOT);
    const b = extractReasonCodes(REPO_ROOT);
    const ha = createHash("sha256").update(JSON.stringify(a)).digest("hex");
    const hb = createHash("sha256").update(JSON.stringify(b)).digest("hex");
    assert.equal(ha, hb);
  });

  it("entradas têm name e code", () => {
    const entries = extractReasonCodeEntries(REPO_ROOT);
    for (const e of entries) {
      assert.equal(typeof e.name, "string");
      assert.equal(typeof e.code, "string");
      assert.ok(e.name.startsWith("DENY_"));
    }
  });

  it("sem drift: todos os codes são strings não vazias e únicos", () => {
    const codes = extractReasonCodes(REPO_ROOT);
    assert.equal(new Set(codes).size, codes.length);
    for (const c of codes) assert.ok(c.length > 0);
  });

  it("gate.js ausente reprova", () => {
    const root = TMP.tmp({});
    assert.throws(() => extractReasonCodes(root));
  });
});