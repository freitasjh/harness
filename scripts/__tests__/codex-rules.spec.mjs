import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = path.join(ROOT, ".codex", "rules");

describe("ADR-003 RULES-01 — .rules Starlark complementar", () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".rules"));

  it("publica ao menos um arquivo .rules em .codex/rules/", () => {
    assert.ok(files.length > 0);
  });

  it("usa prefix_rule com decisão allow/prompt/forbidden", () => {
    let seen = 0;
    for (const file of files) {
      const text = fs.readFileSync(path.join(DIR, file), "utf8");
      const matches = [...text.matchAll(/prefix_rule\s*\([\s\S]*?decision\s*=\s*"(allow|prompt|forbidden)"/g)];
      seen += matches.length;
    }
    assert.ok(seen > 0);
  });

  it("não duplica política dos hooks", () => {
    for (const file of files) {
      const text = fs.readFileSync(path.join(DIR, file), "utf8");
      assert.doesNotMatch(text, /PreToolUse|PermissionRequest|permissionDecision/i);
    }
  });

  it("nenhum arquivo .rules solto na raiz de .codex/", () => {
    assert.ok(!fs.existsSync(path.join(ROOT, ".codex", "default.rules")));
  });
});
