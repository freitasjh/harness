import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPreserved, payloadFiles, runInit, runUpdate } from "../harness-sync.mjs";
import { tempScope } from "../test-temp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scope = tempScope({ label: "codex-configpreserve" });
const OPTS = { suite: "node --test", backend: "node" };

describe("ADR-003 INSTALLER-02 — .codex/config.toml preservado/criado", () => {
  it("config.toml é preservado e fora do payload", () => {
    assert.equal(isPreserved(".codex/config.toml"), true);
    assert.ok(!payloadFiles().includes(".codex/config.toml"));
  });

  it("criado quando ausente", () => {
    const target = scope.tmp();
    assert.equal(runInit(target, OPTS), 0);
    assert.ok(fs.existsSync(path.join(target, ".codex/config.toml")));
  });

  it("preexistente divergente não é sobrescrito", () => {
    const target = scope.tmp({ ".codex/config.toml": "# do consumidor\n" });
    assert.equal(runInit(target, { ...OPTS, log: () => {} }), 0);
    assert.equal(runUpdate(target, { ...OPTS, log: () => {} }), 0);
    assert.equal(fs.readFileSync(path.join(target, ".codex/config.toml"), "utf8"), "# do consumidor\n");
  });
});
