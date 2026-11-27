import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { payloadFiles, runInit, runUpdate } from "../harness-sync.mjs";
import { tempScope } from "../test-temp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scope = tempScope({ label: "codex-syncpayload" });
const OPTS = { suite: "node --test", backend: "node" };

describe("ADR-003 INSTALLER-01 — payload estático .codex/", () => {
  it("payload inclui agents/hooks/rules/hooks.json", () => {
    const files = payloadFiles();
    for (const rel of [
      ".codex/agents/architect.toml",
      ".codex/hooks/pre_tool_use.mjs",
      ".codex/rules/default.rules",
      ".codex/hooks.json",
    ]) {
      assert.ok(files.includes(rel), `fora do payload: ${rel}`);
    }
  });

  it("init publica os estáticos em tmp com exit 0", () => {
    const target = scope.tmp();
    const logs = [];
    const code = runInit(target, { ...OPTS, log: (l) => logs.push(l) });
    assert.equal(code, 0, logs.join("\n"));
    for (const rel of [
      ".codex/agents/architect.toml",
      ".codex/hooks/pre_tool_use.mjs",
      ".codex/rules/default.rules",
      ".codex/hooks.json",
    ]) {
      assert.ok(fs.existsSync(path.join(target, rel)), `não publicado: ${rel}`);
    }
  });

  it("update sobrescreve divergente com backup G3", () => {
    const target = scope.tmp();
    assert.equal(runInit(target, OPTS), 0);
    const rel = path.join(target, ".codex/agents/architect.toml");
    fs.writeFileSync(rel, "# adulterado\n");
    const backupDir = path.join(path.dirname(target), "codex-payload-backup");
    const code = runUpdate(target, { ...OPTS, backupDir, log: () => {} });
    assert.equal(code, 0);
    assert.equal(fs.readFileSync(rel, "utf8"), fs.readFileSync(path.join(ROOT, ".codex/agents/architect.toml"), "utf8"));
    assert.ok(fs.existsSync(path.join(backupDir, ".codex/agents/architect.toml")), "backup G3 ausente");
  });
});
