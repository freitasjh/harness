import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlan, isPreserved } from "../harness-sync.mjs";
import { tempScope } from "../test-temp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scope = tempScope({ label: "codex-protected" });
const OPTS = { suite: "node --test", backend: "node" };

describe("ADR-003 PROTECTED-01 — protectedPaths estendido à camada Codex", () => {
  it("config, state e arquivo não-payload sob .codex/ são preservados", () => {
    for (const rel of [
      ".codex/config.toml",
      ".codex/harness-state.json",
      ".codex/hooks/custom.toml",
      ".codex/bypass.log",
    ]) {
      assert.equal(isPreserved(rel), true, `${rel} não preservado`);
    }
  });

  it("arquivos do payload não são preservados", () => {
    assert.equal(isPreserved(".codex/agents/architect.toml"), false);
    assert.equal(isPreserved(".codex/hooks.json"), false);
  });

  it("plano não escreve fora do payload", () => {
    const target = scope.tmp();
    const plan = buildPlan(target, OPTS);
    // Exceções declaradas: os dois arquivos de config são criados quando ausentes.
    const created = new Set(["harness.config.json", ".codex/config.toml"]);
    const outside = plan.filter((e) =>
      e.action !== "skip" && isPreserved(e.rel) && !created.has(e.rel));
    assert.deepEqual(outside.map((e) => e.rel), []);
  });

  it("config canônico lista .codex/**", () => {
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, "harness.config.json"), "utf8"));
    assert.ok(config.protectedPaths.includes(".codex/**"));
  });
});
