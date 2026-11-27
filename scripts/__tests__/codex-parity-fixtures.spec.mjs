import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { listCoreGates } from "../../.opencode/plugins/gate.js";

const FIXTURE_DIR = path.join(process.cwd(), "harness", "fixtures", "codex-parity");

describe("IC-08 — fixtures de paridade de reason codes", () => {
  it("diretório existe", () => {
    assert.ok(fs.existsSync(FIXTURE_DIR));
  });

  it("um fixture por gate de CORE_GATES", () => {
    const files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".json"));
    assert.equal(files.length, listCoreGates().length);
  });

  it("cada fixture tem estrutura válida e 0 divergência", () => {
    const files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), "utf8"));
      assert.equal(typeof data.gate, "string");
      assert.equal(typeof data.tool, "string");
      assert.equal(typeof data.opencodeReason, "string");
      assert.equal(typeof data.codexReason, "string");
      assert.equal(data.divergence, false);
      assert.equal(data.opencodeReason, data.codexReason);
    }
  });

  it("README documenta spawn_agent como best-effort", () => {
    const readme = fs.readFileSync(path.join(FIXTURE_DIR, "README.md"), "utf8");
    assert.ok(readme.includes("spawn_agent"));
    assert.ok(readme.includes("best-effort") || readme.includes("best-effort"));
  });
});