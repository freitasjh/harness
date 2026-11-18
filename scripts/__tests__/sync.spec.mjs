// sync.spec.mjs — TDD de `scripts/harness-sync.mjs` + `scripts/seal.mjs` (v2/F1).
//
// Contrato (PLAN §F1): o instalador v1 foi apagado e substituído por um
// sincronizador determinístico. Cada garantia da G1..G5 do próprio script tem
// um teste que a DERRUBA quando ela quebra:
//   G1 determinismo   — 2ª execução = 0 writes; nenhum backup novo
//   G2 backup         — arquivo sobrescrito tem cópia em `.harness-backup/<ts>/`
//   G3 projeto vive   — config do projeto, `workflow-state.json` e
//                       `.agents/rules/project-*.md` intocados
//   G4 merge          — `opencode.json` mantém chave do projeto
//   G5 rede-zero      — fonte dos dois scripts sem import/uso de rede
// Tudo em tmpdir; o CLI roda como subprocesso de node (sem shell, sem rede).
import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tempScope } from "../test-temp.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SYNC = join(REPO_ROOT, "scripts", "harness-sync.mjs");
const SEAL = join(REPO_ROOT, "scripts", "seal.mjs");

const TMP = tempScope({ label: "harness-sync" });
afterEach(() => TMP.cleanup());
after(() => TMP.cleanup());

function newDir(files = {}) {
  const dir = TMP.tmp(files);
  return dir;
}

function run(script, args) {
  const res = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  return { code: res.status, out: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

function sync(verb, target, extra = []) {
  return run(SYNC, [verb, "--target", target, ...extra]);
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function backupDirs(target) {
  const root = join(target, ".harness-backup");
  return existsSync(root) ? readdirSync(root) : [];
}

describe("SYNC-01 — init cria payload + config + manifesto", () => {
  it("dir vazio: camadas copiadas, config mínimo e manifesto com sha256", () => {
    const target = newDir();
    const res = sync("init", target);
    assert.equal(res.code, 0, res.out);
    assert.doesNotMatch(res.out, /backup:/, "init em alvo novo não tem nada a preservar");
    assert.deepEqual(backupDirs(target), [], "nenhum backup sem sobrescrita");

    for (const layer of [".agents/agents", ".agents/rules", ".agents/schemas", ".agents/skills", ".opencode/plugins"]) {
      assert.ok(existsSync(join(target, layer)), `camada ausente: ${layer}`);
    }
    assert.ok(existsSync(join(target, "scripts/harness-sync.mjs")));
    assert.ok(existsSync(join(target, "scripts/seal.mjs")));
    assert.ok(existsSync(join(target, "opencode.json")));

    const config = readJson(join(target, "harness.config.json"));
    assert.equal(config.version, 2);
    assert.equal(config.project, basename(target));
    assert.deepEqual(config.targets, { frontend: null, backend: null });
    assert.equal(config.commands.suiteFull, null, "sem stack detectável não se inventa comando");
    assert.equal(config.evidence.path, "harness/");
    assert.ok(config.protectedPaths.includes(".opencode/plugins/**"));
    assert.ok(config.protectedPaths.includes("harness.config.json"));

    const manifest = readJson(join(target, ".harness-manifest.json"));
    assert.equal(manifest.version, 2);
    const paths = Object.keys(manifest.files);
    assert.ok(paths.some((p) => p.startsWith(".agents/agents/")), "agentes no manifesto");
    assert.ok(paths.some((p) => p.startsWith(".agents/skills/")), "skills no manifesto");
    assert.ok(paths.includes("scripts/harness-sync.mjs"));
    assert.equal(paths.some((p) => p.includes("__tests__")), false, "__tests__ nunca é payload");
    for (const p of paths) assert.match(manifest.files[p], /^[0-9a-f]{64}$/, `sha inválido: ${p}`);
  });

  it("bytes preservados: cada path do manifesto tem o sha256 do arquivo na FONTE", () => {
    const target = newDir();
    assert.equal(sync("init", target).code, 0);
    const manifest = readJson(join(target, ".harness-manifest.json"));
    const rels = Object.keys(manifest.files);
    for (const rel of rels) {
      // Buffer cru, não string: um payload binário não pode ser re-codificado.
      assert.equal(sha256(readFileSync(join(REPO_ROOT, rel))), manifest.files[rel], `sha divergente: ${rel}`);
    }
    assert.equal(rels.some((p) => p.includes("__pycache__")), false, "bytecode não é payload");
  });

  it("dir com .agents/ falha e manda usar update (nunca sobrescreve por init)", () => {    const target = newDir({ ".agents/rules/project-x.md": "# do projeto\n" });
    const res = sync("init", target);
    assert.equal(res.code, 1);
    assert.match(res.out, /update/);
    assert.equal(existsSync(join(target, ".harness-manifest.json")), false);
  });

  it("target inexistente é criado pelo init", () => {
    const parent = newDir();
    const target = join(parent, "novo-alvo");
    const res = sync("init", target);
    assert.equal(res.code, 0, res.out);
    assert.ok(existsSync(join(target, "harness.config.json")));
  });
});

describe("SYNC-02 — detecção de targets e comandos (sem perguntar nada)", () => {
  it("package.json com react + express e scripts.test", () => {
    const target = newDir({
      "package.json": JSON.stringify({
        name: "app",
        dependencies: { react: "^18", express: "^4" },
        scripts: { test: "vitest" },
      }),
    });
    const res = sync("init", target);
    assert.equal(res.code, 0, res.out);
    const config = readJson(join(target, "harness.config.json"));
    assert.deepEqual(config.targets, { frontend: "react", backend: "node" });
    assert.equal(config.commands.suiteFull, "npm test");
    assert.equal(config.commands.unit, "npm test");
  });

  it("vue + @nestjs/core", () => {
    const target = newDir({
      "package.json": JSON.stringify({ dependencies: { vue: "^3", "@nestjs/core": "^10" } }),
    });
    assert.equal(sync("init", target).code, 0);
    const config = readJson(join(target, "harness.config.json"));
    assert.deepEqual(config.targets, { frontend: "vue", backend: "nestjs" });
    assert.equal(config.commands.suiteFull, null, "sem scripts.test não há comando");
  });

  it("pom.xml ⇒ java + mvn test; Cargo.toml ⇒ rust + cargo test; --suite sobrepõe", () => {
    const java = newDir({ "pom.xml": "<project/>" });
    assert.equal(sync("init", java).code, 0);
    const jc = readJson(join(java, "harness.config.json"));
    assert.deepEqual(jc.targets, { frontend: null, backend: "java" });
    assert.equal(jc.commands.suiteFull, "mvn test");

    const rust = newDir({ "Cargo.toml": "[package]\nname='x'\n" });
    assert.equal(sync("init", rust).code, 0);
    const rc = readJson(join(rust, "harness.config.json"));
    assert.deepEqual(rc.targets, { frontend: null, backend: "rust" });
    assert.equal(rc.commands.suiteFull, "cargo test");

    const over = newDir({ "pom.xml": "<project/>" });
    assert.equal(sync("init", over, ["--suite", "mvn -q test", "--unit", "mvn -q -Dtest=U test"]).code, 0);
    const oc = readJson(join(over, "harness.config.json"));
    assert.equal(oc.commands.suiteFull, "mvn -q test");
    assert.equal(oc.commands.unit, "mvn -q -Dtest=U test");
  });
});

describe("SYNC-03 — update preserva o projeto (G3)", () => {
  it("harness.config.json, workflow-state.json e .agents/rules/project-*.md intocados", () => {
    const target = newDir();
    assert.equal(sync("init", target).code, 0);

    const customConfig = JSON.stringify({ version: 2, project: "meu-projeto", commands: { suiteFull: "pytest" } });
    writeFileSync(join(target, "harness.config.json"), customConfig);
    writeFileSync(join(target, "workflow-state.json"), JSON.stringify({ current_phase: "Discovery" }));
    const projectRule = join(target, ".agents/rules/project-convencoes.md");
    writeFileSync(projectRule, "# regra do projeto\n");

    const res = sync("update", target);
    assert.equal(res.code, 0, res.out);
    assert.equal(readFileSync(join(target, "harness.config.json"), "utf8"), customConfig);
    assert.deepEqual(readJson(join(target, "workflow-state.json")), { current_phase: "Discovery" });
    assert.equal(readFileSync(projectRule, "utf8"), "# regra do projeto\n");
    assert.match(res.out, /skip harness\.config\.json/);
  });

  it("opencode.json é MERGE: chave do projeto sobrevive, bloco gerenciado é refrescado", () => {
    const target = newDir();
    assert.equal(sync("init", target).code, 0);
    const path = join(target, "opencode.json");
    const project = { ...readJson(path), "x-projeto": { dono: "time" }, agent: { "meu-agente": { mode: "primary" } } };
    writeFileSync(path, JSON.stringify(project, null, 2));

    assert.equal(sync("update", target).code, 0);
    const merged = readJson(path);
    assert.deepEqual(merged["x-projeto"], { dono: "time" }, "chave do projeto preservada");
    assert.ok(merged.agent["meu-agente"], "agente do projeto preservado");
    assert.ok(merged.agent.orchestrator, "agente gerenciado presente");
  });
});

describe("SYNC-04 — determinismo e backup (G1/G2)", () => {
  it("2ª execução = 0 writes e nenhum backup novo", () => {
    const target = newDir();
    assert.equal(sync("init", target).code, 0);
    const first = sync("update", target);
    assert.equal(first.code, 0, first.out);
    assert.match(first.out, /update: 0 file\(s\) written/);
    assert.deepEqual(backupDirs(target), [], "nada escrito ⇒ nenhum backup");

    const second = sync("update", target);
    assert.match(second.out, /update: 0 file\(s\) written/);
  });

  it("arquivo divergente é sobrescrito e o conteúdo antigo vai para o backup", () => {
    const target = newDir();
    assert.equal(sync("init", target).code, 0);
    const rel = ".agents/rules/harness-config.md";
    const sourceText = readFileSync(join(REPO_ROOT, rel), "utf8");
    writeFileSync(join(target, rel), "# adulterado\n");

    const res = sync("update", target);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /update \.agents\/rules\/harness-config\.md/);
    assert.equal(readFileSync(join(target, rel), "utf8"), sourceText);

    const dirs = backupDirs(target);
    assert.equal(dirs.length, 1, "um backup por execução");
    assert.equal(readFileSync(join(target, ".harness-backup", dirs[0], rel), "utf8"), "# adulterado\n");
  });
});

describe("SYNC-05 — dry-run não escreve (nem backup)", () => {
  it("init --dry-run imprime o plano e deixa o dir vazio", () => {
    const target = newDir();
    const res = sync("init", target, ["--dry-run"]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /create \.agents\//);
    assert.match(res.out, /dry-run:/);
    assert.deepEqual(readdirSync(target), [], "nada escrito");
  });

  it("update --dry-run nomeia o write pendente e não aplica", () => {
    const target = newDir();
    assert.equal(sync("init", target).code, 0);
    const rel = ".agents/rules/workflow-rules.md";
    writeFileSync(join(target, rel), "# adulterado\n");

    const res = sync("update", target, ["--dry-run"]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, new RegExp(`update ${rel.replace(/[.]/g, "\\.")}`));
    assert.equal(readFileSync(join(target, rel), "utf8"), "# adulterado\n");
    assert.deepEqual(backupDirs(target), []);
  });
});

describe("SYNC-06 — doctor (read-only, exit 1 com a falha nomeada)", () => {
  it("config inválido reprova nomeando o path; init completo passa", () => {
    const target = newDir({ "package.json": JSON.stringify({ scripts: { test: "node --test" } }) });
    assert.equal(sync("init", target).code, 0);
    assert.equal(sync("doctor", target).code, 0, sync("doctor", target).out);

    writeFileSync(join(target, "harness.config.json"), "{ nao e json");
    const bad = sync("doctor", target);
    assert.equal(bad.code, 1);
    assert.match(bad.out, /harness\.config\.json/);
  });

  it("camada ausente e commands.suiteFull nulo são falhas separadas", () => {
    const target = newDir();
    assert.equal(sync("init", target).code, 0);
    const res = sync("doctor", target);
    assert.equal(res.code, 1);
    assert.match(res.out, /commands\.suiteFull nulo/);

    const other = newDir({ "pom.xml": "<project/>" });
    assert.equal(sync("init", other).code, 0);
    assert.equal(sync("doctor", other).code, 0);

    // destrói uma camada: o doctor precisa acusar o path exato
    const orphan = newDir({ "pom.xml": "<project/>" });
    assert.equal(sync("init", orphan).code, 0);
    spawnSync("rm", ["-rf", join(orphan, ".agents/schemas")]);
    const broken = sync("doctor", orphan);
    assert.equal(broken.code, 1);
    assert.match(broken.out, /\.agents\/schemas/);
  });

  it("doctor não escreve: manifesto e mtimes intactos", () => {
    const target = newDir({ "pom.xml": "<project/>" });
    assert.equal(sync("init", target).code, 0);
    const before = readFileSync(join(target, ".harness-manifest.json"), "utf8");
    assert.equal(sync("doctor", target).code, 0);
    assert.equal(readFileSync(join(target, ".harness-manifest.json"), "utf8"), before);
    assert.deepEqual(backupDirs(target), []);
  });
});

describe("SEAL-01 — scripts/seal.mjs publica o selo do config", () => {
  it("imprime JSON com sha256 de 64 hex para suiteFull", () => {
    const res = run(SEAL, []);
    assert.equal(res.code, 0, res.out);
    const seal = JSON.parse(res.out.trim());
    assert.match(seal.suiteFull, /^[0-9a-f]{64}$/);
    // O verificador do gate exige o selo de TODAS as chaves de `commands`
    // (gate.js:157-159): um selo só com suiteFull negaria em `unit`.
    const config = readJson(join(REPO_ROOT, "harness.config.json"));
    assert.deepEqual(Object.keys(seal).sort(), Object.keys(config.commands).sort());
  });

  it("--env imprime a atribuição exportável", () => {
    const res = run(SEAL, ["--env"]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out.trim(), /^HARNESS_SEAL_JSON=\{"suiteFull":"[0-9a-f]{64}"/);
    assert.doesNotThrow(() => JSON.parse(res.out.trim().slice("HARNESS_SEAL_JSON=".length)));
  });

  it("config sem commands.suiteFull falha alto (nunca publica selo vazio)", () => {
    const dir = newDir({ "harness.config.json": JSON.stringify({ version: 2, commands: {} }) });
    const res = run(SEAL, ["--config", join(dir, "harness.config.json")]);
    assert.equal(res.code, 1);
    assert.match(res.out, /suiteFull/);
  });
});

describe("NET-01 — os dois scripts são rede-zero (G5, medido na fonte)", () => {
  // V15 media rede no diretório do instalador v1 (apagado); a medição do
  // sucessor — que roda no caminho de instalação — fica aqui, no mesmo lugar
  // em que o comportamento dele é testado.
  const FORBIDDEN = [
    /(?:from|import\s*\(|require\s*\()\s*["'](?:node:)?(?:https?|net|dns|dgram|http2|tls)["']/,
    /\bnode:child_process\b/,
    /\bfetch\s*\(/,
    /\bnew\s+(?:globalThis\.)?(?:WebSocket|XMLHttpRequest)\b/,
  ];

  for (const script of ["scripts/harness-sync.mjs", "scripts/seal.mjs"]) {
    it(`${script}: nenhum import/uso de rede`, () => {
      const source = readFileSync(join(REPO_ROOT, script), "utf8");
      for (const re of FORBIDDEN) assert.doesNotMatch(source, re);
    });
  }
});

describe("TMP-01 — fixtures não vazam para /tmp", () => {
  it("o escopo remove o que criou", () => {
    const dir = TMP.tmp({ "x.txt": "y" });
    assert.ok(existsSync(dir));
    TMP.cleanup();
    assert.equal(existsSync(dir), false);
  });
});

// mkdtemp direto não é usado: todo fixture passa por tempScope (TMP.tmp).
