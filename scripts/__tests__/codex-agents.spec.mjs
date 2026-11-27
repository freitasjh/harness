import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAgentToml, scanSecretPatterns } from "../codex-support.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = path.join(ROOT, ".codex", "agents");

describe("ADR-003 AGENTS-01 — 11 agentes TOML completos", () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".toml")).sort();

  it("publica exatamente 11 arquivos .toml", () => {
    assert.equal(files.length, 11, files.join(", "));
  });

  it("cada .toml tem name/description/developer_instructions não vazios e sem segredos", () => {
    for (const file of files) {
      const text = fs.readFileSync(path.join(DIR, file), "utf8");
      const result = validateAgentToml(text);
      assert.deepEqual(result.problems, [], `${file}: ${result.problems.join("; ")}`);
      assert.equal(result.name, file.replace(/\.toml$/, ""), `${file}: name divergente`);
      assert.deepEqual(scanSecretPatterns(text), [], `${file}: segredo detectado`);
    }
  });

  it("rejeita .toml sem developer_instructions", () => {
    const result = validateAgentToml('name = "qa-engineer"\ndescription = "qa"\n');
    assert.ok(result.problems.some((p) => /developer_instructions/.test(p)));
  });

  it("rejeita .toml sem name", () => {
    const result = validateAgentToml('description = "qa"\ndeveloper_instructions = """x"""\n');
    assert.ok(result.problems.some((p) => /name/.test(p)));
  });
});
