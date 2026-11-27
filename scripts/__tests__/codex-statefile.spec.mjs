import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as state from "../../.codex/hooks/state.mjs";
import { tempScope } from "../test-temp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scope = tempScope({ label: "codex-statefile" });

function newState(seed = {}) {
  const dir = scope.tmp();
  return { dir, file: path.join(dir, "harness-state.json") };
}

describe("ADR-003 STATEFILE-01 — state file seguro (M-01)", () => {
  it("escrita atômica com nonce+HMAC, 0600 e leitura íntegra", () => {
    const { dir, file } = newState();
    state.writeStateAtomic(file, { session_id: "s1", agent: "qa-engineer" });
    const st = fs.statSync(file);
    assert.equal(st.mode & 0o777, 0o600);
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.match(raw.__integrity.nonce, /^[0-9a-f]{32}$/);
    assert.match(raw.__integrity.mac, /^[0-9a-f]{64}$/);
    const read = state.readState(file, { strict: true });
    assert.equal(read.session_id, "s1");
    assert.equal(read.agent, "qa-engineer");
    assert.equal(read.__integrity, undefined);
    assert.ok(!fs.existsSync(path.join(dir, "harness-state.json.lock")));
  });

  it("tampering é detectado (fail-closed)", () => {
    const { file } = newState();
    state.writeStateAtomic(file, { session_id: "s1", agent: "qa-engineer" });
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    raw.agent = "orchestrator";
    fs.writeFileSync(file, JSON.stringify(raw));
    assert.throws(() => state.readState(file, { strict: true }), /state-corrupt/);
    assert.deepEqual(state.readState(file), {});
  });

  it("segredo no estado é recusado", () => {
    const { file } = newState();
    assert.throws(() => state.writeStateAtomic(file, { api_key: "sk-abc123def456" }), /state-secret/);
  });

  it("gitignore cobre state, key e lock", () => {
    const ignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    assert.match(ignore, /\.codex\/harness-state\.json/);
    assert.match(ignore, /\.codex\/\.state-key/);
    assert.match(ignore, /\.codex\/.*\.lock/);
  });

  it("temporário é O_EXCL (wx) no código-fonte", () => {
    const src = fs.readFileSync(path.join(ROOT, ".codex/hooks/state.mjs"), "utf8");
    assert.match(src, /openSync\([^)]*"wx"/);
  });
});
