import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCodexConfig, measureInstructionChain } from "../codex-support.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("ADR-003 AGENTSMD-03 — fallback filenames vazio (sem AGENTS.md por diretório)", () => {
  const config = parseCodexConfig(fs.readFileSync(path.join(ROOT, ".codex", "config.toml"), "utf8"));
  const rules = fs.readdirSync(path.join(ROOT, ".agents", "rules"))
    .filter((f) => f.endsWith(".md"))
    .sort();

  it("teto mantido em 32768 bytes", () => {
    assert.equal(config.maxBytes, 32768);
  });

  it("fallback vazio: .agents/rules/* não é descoberto por filename", () => {
    assert.deepEqual(config.fallbackFilenames, []);
    assert.ok(rules.length > 0);
  });

  it("medição efetiva com fallback passa (≤ 32768)", () => {
    const measured = measureInstructionChain(ROOT, ".", config.fallbackFilenames);
    assert.equal(measured.ok, true, `${measured.bytes} bytes`);
    assert.ok(measured.bytes <= 32768);
  });

  it("sem regras não há erro", () => {
    const measured = measureInstructionChain(ROOT, ".", []);
    assert.equal(measured.ok, true);
  });
});
