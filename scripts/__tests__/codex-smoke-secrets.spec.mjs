import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanSecretPatterns, assertNoSecrets } from "../codex-support.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATE = path.join(ROOT, "harness", "codex-port-smoke.json");

describe("ADR-003 SMOKE-01 — schema smoke sem segredos (M-05)", () => {
  const template = JSON.parse(fs.readFileSync(TEMPLATE, "utf8"));

  it("template limpo passa no validador de padrões", () => {
    assert.deepEqual(scanSecretPatterns(template), []);
    assert.doesNotThrow(() => assertNoSecrets(template));
  });

  it("campo token é detectado e recusado", () => {
    const bad = { ...template, token: "abc123" };
    assert.ok(scanSecretPatterns(bad).some((h) => h.path.endsWith("token")));
    assert.throws(() => assertNoSecrets(bad), /state-secret|secret/);
  });

  it("padrão de segredo em valor é detectado", () => {
    const bad = { ...template, notes: "api_key=abc123def456" };
    assert.ok(scanSecretPatterns(bad).some((h) => h.kind === "value"));
  });

  it("chave sk- em valor é detectada", () => {
    assert.ok(scanSecretPatterns({ notes: "sk-abcdefghijklmnop" }).some((h) => h.kind === "value"));
  });
});
