import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPreserved, payloadFiles, runInit, runUpdate } from "../harness-sync.mjs";
import { tempScope } from "../test-temp.mjs";

const scope = tempScope({ label: "codex-statenotpayload" });
const OPTS = { suite: "node --test", backend: "node" };

describe("ADR-003 INSTALLER-03 — state file é runtime, não payload", () => {
  it("harness-state.json é preservado e fora do payload", () => {
    assert.equal(isPreserved(".codex/harness-state.json"), true);
    assert.ok(!payloadFiles().includes(".codex/harness-state.json"));
  });

  it("conteúdo preexistente sobrevive ao update", () => {
    const state = '{"session_id":"s1","agent":"qa-engineer"}\n';
    const target = scope.tmp({ ".codex/harness-state.json": state });
    assert.equal(runUpdate(target, { ...OPTS, log: () => {} }), 0);
    assert.equal(fs.readFileSync(path.join(target, ".codex/harness-state.json"), "utf8"), state);
  });

  it("ausente não é criado pelo payload", () => {
    const target = scope.tmp();
    assert.equal(runInit(target, OPTS), 0);
    assert.ok(!fs.existsSync(path.join(target, ".codex/harness-state.json")));
  });
});
