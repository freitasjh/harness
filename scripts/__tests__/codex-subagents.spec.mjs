import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ALLOWED_TOOLS, isAllowedToolName } from "../../.codex/hooks/pre_tool_use.mjs";

describe("Codex — ferramentas de subagent", () => {
  it("permitem spawn e controle de threads", () => {
    for (const name of ["Agent", "spawn_agent", "send_input", "wait_agent", "close_agent"]) {
      assert.ok(ALLOWED_TOOLS.has(name), `tool ausente: ${name}`);
      assert.equal(isAllowedToolName(name), true);
    }
  });

  it("mantêm task legado permitido", () => {
    assert.equal(isAllowedToolName("task"), true);
  });

  it("injeta condução orchestrator no SessionStart", () => {
    const file = fileURLToPath(new URL("../../.codex/hooks/pre_tool_use.mjs", import.meta.url));
    const source = readFileSync(file, "utf8");
    assert.match(source, /conduza a sessao como orchestrator/);
    assert.match(source, /spawn_agent/);
  });
});
