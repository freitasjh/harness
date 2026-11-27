import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInit, runUpdate, runDoctor } from "../harness-sync.mjs";
import { tempScope } from "../test-temp.mjs";

const scope = tempScope({ label: "codex-syncidem" });
const OPTS = { suite: "node --test", backend: "node" };

describe("ADR-003 INSTALLER-04 — determinismo e idempotência", () => {
  it("segunda passada produz 0 writes e manifesto byte-igual", () => {
    const target = scope.tmp();
    assert.equal(runInit(target, OPTS), 0);
    const manifest = path.join(target, ".harness-manifest.json");
    const before = fs.readFileSync(manifest);
    const logs = [];
    assert.equal(runUpdate(target, { ...OPTS, log: (l) => logs.push(l) }), 0);
    assert.ok(logs.some((l) => /update: 0 file\(s\) written/.test(l)), logs.join("\n"));
    assert.ok(before.equals(fs.readFileSync(manifest)));
  });

  it("manifest cobre hashes de .codex/** e doctor verifica", () => {
    const target = scope.tmp();
    assert.equal(runInit(target, OPTS), 0);
    const manifest = JSON.parse(fs.readFileSync(path.join(target, ".harness-manifest.json"), "utf8"));
    assert.ok(Object.keys(manifest.files).some((k) => k.startsWith(".codex/")));
    const logs = [];
    assert.equal(runDoctor(target, { log: (l) => logs.push(l) }), 0, logs.join("\n"));
    assert.ok(logs.some((l) => /trust ativo/.test(l)), logs.join("\n"));
  });

  it("hash divergente em .codex é FAIL no doctor", () => {
    const target = scope.tmp();
    assert.equal(runInit(target, OPTS), 0);
    fs.writeFileSync(path.join(target, ".codex/agents/architect.toml"), "# tamper\n");
    const logs = [];
    assert.equal(runDoctor(target, { log: (l) => logs.push(l) }), 1);
    assert.ok(logs.some((l) => /sha256 divergente.*\.codex\/agents\/architect\.toml/.test(l)), logs.join("\n"));
  });
});
