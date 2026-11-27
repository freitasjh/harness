import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleSessionStart } from "../../.codex/hooks/pre_tool_use.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("ADR-003 SESSIONSTART-01 — complemento dinâmico", () => {
  it("hooks.json registra SessionStart via command", () => {
    const hooks = JSON.parse(fs.readFileSync(path.join(ROOT, ".codex", "hooks.json"), "utf8"));
    const entries = hooks.hooks?.SessionStart ?? [];
    assert.ok(entries.length > 0);
    assert.ok(entries.every((e) => e.hooks?.some((h) => h.type === "command")));
  });

  it("comando do hook não interpola tool_input nem usa shell", () => {
    const raw = fs.readFileSync(path.join(ROOT, ".codex", "hooks.json"), "utf8");
    assert.doesNotMatch(raw, /\$\{|tool_input|bash -c|sh -c/);
    assert.match(raw, /\.codex\/hooks\/pre_tool_use\.mjs/);
  });

  it("additionalContext respeita limite conservador de 2500 tokens", async () => {
    const original = process.stdout.write.bind(process.stdout);
    let out = "";
    process.stdout.write = (chunk) => { out += chunk; return true; };
    try {
      await handleSessionStart({});
    } finally {
      process.stdout.write = original;
    }
    const parsed = JSON.parse(out);
    const ctx = parsed.hookSpecificOutput.additionalContext;
    assert.equal(parsed.hookSpecificOutput.hookEventName, "SessionStart");
    assert.ok(typeof ctx === "string" && ctx.length > 0);
    assert.ok(ctx.length / 4 <= 2500);
  });
});
