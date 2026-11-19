// storybook-validate.spec.mjs — DESIGN-08 (F6b).
//
// Contrato: a matriz de estados canônica tem 9 entradas (com `active`) e a
// presença de cada estado é provada por ÂNCORA DE EXPORT na story — não por
// `text.includes(state)`. Um comentário que menciona "active" NÃO é story.
import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tempScope } from "../test-temp.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const VALIDATOR = join(REPO_ROOT, ".agents", "skills", "storybook", "scripts", "validate.mjs");
const CANONICAL = [
  "default",
  "active",
  "hover",
  "focus",
  "disabled",
  "loading",
  "error",
  "empty",
  "success",
];

const TMP = tempScope({ label: "storybook-validate" });
afterEach(() => TMP.cleanup());
after(() => TMP.cleanup());

function fixture(storyOverrides) {
  const target = TMP.tmp();
  for (const file of ["DESIGN.md", "tokens/base.json", "tokens/semantic.json", ".storybook/main.ts"]) {
    const p = join(target, file);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, "# fixture\n");
  }
  const storyDir = join(target, "src");
  mkdirSync(storyDir, { recursive: true });
  const story = storyOverrides ?? CANONICAL.map((s) => `export const ${s[0].toUpperCase()}${s.slice(1)} = { args: {} }`).join("\n");
  writeFileSync(join(storyDir, "Button.stories.tsx"), story + "\n");
  return target;
}

function run(target) {
  const res = spawnSync(process.execPath, [VALIDATOR, "--target", target], { encoding: "utf8" });
  assert.equal(res.error, undefined);
  return { code: res.status, out: res.stdout + res.stderr };
}

describe("storybook validate.mjs — DESIGN-08: 9 estados + âncora de export", () => {
  it("matriz canônica no código tem os 9 estados, incluindo active", () => {
    const src = readFileSync(VALIDATOR, "utf8");
    for (const state of CANONICAL) assert.match(src, new RegExp(`'${state}'`), `estado ${state} ausente`);
  });

  it("story com os 9 exports passa", () => {
    const res = run(fixture());
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /validate: OK/);
  });

  it("mutação: export Active faltante => FAIL com active", () => {
    const story = CANONICAL.filter((s) => s !== "active")
      .map((s) => `export const ${s[0].toUpperCase()}${s.slice(1)} = { args: {} }`)
      .join("\n");
    const res = run(fixture(story));
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /FAIL/);
    assert.match(res.out, /active/);
  });

  it("mutação: comentário contendo 'active' sem export => FAIL", () => {
    const story = [
      "// active: este comentário NÃO é uma story",
      ...CANONICAL.filter((s) => s !== "active").map(
        (s) => `export const ${s[0].toUpperCase()}${s.slice(1)} = { args: {} }`,
      ),
    ].join("\n");
    const res = run(fixture(story));
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /FAIL/);
    assert.match(res.out, /active/);
  });

  it("âncora exige export const — declaração de variável comum não conta", () => {
    const story = [
      ...CANONICAL.filter((s) => s !== "active").map(
        (s) => `export const ${s[0].toUpperCase()}${s.slice(1)} = { args: {} }`,
      ),
      "const activeState = { args: {} }",
    ].join("\n");
    const res = run(fixture(story));
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /active/);
  });

  it("a documentação canônica concorda com os 9 estados", () => {
    const docs = [
      ".agents/skills/storybook/SKILL.md",
      ".agents/skills/frontend-quality/SKILL.md",
      ".opencode/commands/ui-audit.md",
      ".opencode/commands/ui-review.md",
    ];
    for (const rel of docs) {
      const text = readFileSync(join(REPO_ROOT, rel), "utf8").toLowerCase();
      for (const state of CANONICAL) {
        assert.ok(text.includes(state), `${rel}: estado ${state} ausente`);
      }
    }
  });

  it("ui-bootstrap sem o typo 'criad/'", () => {
    const text = readFileSync(join(REPO_ROOT, ".opencode", "commands", "ui-bootstrap.md"), "utf8");
    assert.ok(!text.includes("criad/"));
    assert.ok(text.includes("criados/"));
    assert.ok(existsSync(join(REPO_ROOT, ".opencode", "commands", "ui-bootstrap.md")));
  });
});
