import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveStatePath } from "../../.codex/hooks/state.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const STATIC = [".codex/agents", ".codex/hooks", ".codex/rules", ".codex/hooks.json", ".codex/config.toml"];

describe("ADR-003 LAYOUT-01 — layout .codex/ conjunto fechado", () => {
  it("cinco entradas estáticas existem na fonte", () => {
    for (const rel of STATIC) {
      assert.ok(fs.existsSync(path.join(ROOT, rel)), `entrada ausente: ${rel}`);
    }
  });

  it("sexta entrada é runtime: resolve para .codex/harness-state.json", () => {
    assert.equal(
      path.relative(ROOT, resolveStatePath(ROOT)),
      path.join(".codex", "harness-state.json"),
    );
  });

  it("arquivo de estado runtime é gitignored", () => {
    const ignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    assert.match(ignore, /\.codex\/harness-state\.json/);
  });

  it("nenhuma superfície estática fora das seis entradas", () => {
    const entries = fs.readdirSync(path.join(ROOT, ".codex"), { withFileTypes: true })
      .filter((e) => e.isFile() || e.isDirectory())
      .map((e) => e.name)
      .sort();
    for (const extra of ["default.rules"]) {
      assert.ok(!entries.includes(extra), `superfície extra: ${extra}`);
    }
  });
});
