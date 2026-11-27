import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { agentNames, parityProblems } from "../codex-support.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE = path.join(ROOT, ".agents", "agents");
const PUBLISHED = path.join(ROOT, ".codex", "agents");

function sourceNames(root) {
  return fs.readdirSync(path.join(root, ".agents", "agents"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((e) => ["AGENT.md", "PROMPT.md"].some((f) =>
      fs.existsSync(path.join(root, ".agents", "agents", e.name, f))))
    .map((e) => e.name)
    .sort();
}

describe("ADR-003 AGENTS-02 — paridade de papéis (contagem/nomes)", () => {
  const left = sourceNames(ROOT);
  const right = agentNames(PUBLISHED);

  it("fonte publica 11 papéis", () => {
    assert.equal(left.length, 11, left.join(", "));
  });

  it(".codex publica 11 papéis", () => {
    assert.equal(right.length, 11, right.join(", "));
  });

  it("0 divergências de nomes entre fonte e publicação", () => {
    assert.deepEqual(parityProblems(left, right), []);
  });

  it("nome divergente é listado", () => {
    assert.ok(parityProblems(["architect", "qa-engineer"], ["architect", "qa"]).some((p) => /qa/.test(p)));
  });

  it("agente extra reprova (contagem ≠ 11)", () => {
    assert.ok(parityProblems(["a"], ["a", "b"]).some((p) => /contagem/.test(p)));
  });
});
