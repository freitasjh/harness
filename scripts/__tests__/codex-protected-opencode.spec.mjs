import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("ADR-003 PROTECTED-02 / L-02 — protectedPaths do opencode inclui .codex/", () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "harness.config.json"), "utf8"));

  it(".codex/ e state file presentes", () => {
    assert.ok(config.protectedPaths.includes(".codex/**"), ".codex/** ausente");
    assert.ok(config.protectedPaths.includes(".codex/harness-state.json"), "state file ausente");
  });

  it("proteção existente não foi removida", () => {
    for (const rel of [
      ".opencode/plugins/**",
      ".agents/rules/**",
      ".agents/agents/**",
      "opencode.json",
      "harness.config.json",
    ]) {
      assert.ok(config.protectedPaths.includes(rel), `${rel} removido`);
    }
  });

  it("gate lê protectedPaths do config (sem lista hardcoded)", () => {
    const src = fs.readFileSync(path.join(ROOT, ".opencode/plugins/gate.js"), "utf8");
    assert.match(src, /protectedPaths/);
  });
});
