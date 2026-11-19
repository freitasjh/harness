// sync.spec.mjs — TDD de `scripts/harness-sync.mjs` + `scripts/seal.mjs` (v2/F1).
//
// Contrato (PLAN §F1): o instalador v1 foi apagado e substituído por um
// sincronizador determinístico. Cada garantia da G1..G7 do próprio script tem
// um teste que a DERRUBA quando ela quebra:
//   G1 determinismo   — 2ª execução = 0 writes; nenhum backup novo
//   G2 backup         — arquivo sobrescrito tem cópia FORA do target
//   G3 projeto vive   — config do projeto, `workflow-state.json`,
//                       `.agents/rules/project-*.md` e `.spec/**` intocados
//   G4 merge          — `opencode.json` mantém chave do projeto
//   G5 rede-zero      — fonte dos dois scripts sem import/uso de rede (NET-01)
//   G6 symlink        — elo plantado no destino aborta o run inteiro, sem backup
//   G7 atômico        — nenhum `.tmp-*` sobrevive; manifesto é o último write
// Achados do review do F1 cobertos aqui, um teste por achado:
//   C1 (SYNC-07), C3 (SYNC-01), A3 (SYNC-07), A4 (SYNC-04), A5 (SYNC-02),
//   A6 (SYNC-06), A7 (SYNC-08), A2 (NET-01), M6 (SYNC-01/03/06).
// Achados do segundo parecer do F1, um teste por ataque:
//   N1  — config gerado fora do guard (symlink pendente/existente no config)
//   N2  — órfão apagado do manifesto no primeiro write
//   N3  — `update` instalando `commands.suiteFull` nulo
//   N9  — manifesto ausente nunca recriado
//   N7  — backup copiado para fora sem checar link/atômico
//   N5  — controle positivo do detector do NET-01 (lista pode esvaziar)
// Achados do TERCEIRO parecer do F1, um teste por ataque:
//   R-1 — temporário previsível da escrita atômica fora do guard (link seguido)
//   R-2 — doctor aceitando link em entrada do manifesto (re-hash pelo elo)
//   I1  — `update` verde e silencioso num config existente com suiteFull nulo
// Achados do QUINTO passe do F1 (classe "escrita fora do guard"), um teste por
// porta lateral que deixou de existir:
//   L1 — toda escrita passa por `writeGuarded` (payload, config, manifesto e a
//        CÓPIA DE BACKUP, que era o loop sem guard); `writeAtomic` é privado e
//        não tem chamador fora dele
//   L2 — `doctor` recusa link em COMPONENTE do caminho (camada symlinkada com
//        bytes idênticos) e a varredura de camadas usa `lstat`, não `stat`
//   I1b — `update` num config que não parseia avisa o defeito real (JSON
//        inválido), nunca "suiteFull nulo"
// Tudo em tmpdir; o CLI roda como subprocesso de node (sem shell, sem rede).
import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
  lstatSync,
  statSync,
  symlinkSync,
  cpSync,
  rmSync,
} from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tempScope } from "../test-temp.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SYNC = join(REPO_ROOT, "scripts", "harness-sync.mjs");
const SEAL = join(REPO_ROOT, "scripts", "seal.mjs");

const TMP = tempScope({ label: "harness-sync" });
afterEach(() => TMP.cleanup());
after(() => TMP.cleanup());

// `init` exige `commands.suiteFull` (A5). Todo alvo de teste que precisa de um
// init bem-sucedido declara o comando, como o operador faria num repo sem
// `scripts.test`.
const SUITE = ["--suite", "node --test"];

// O alvo vive DENTRO de um diretório de escopo próprio: o backup vai para
// `<parent>/.harness-backup/**` (A4) e precisa cair na árvore que o cleanup
// remove, nunca em /tmp nu.
function newTarget(files = {}) {
  const parent = TMP.tmp();
  const target = join(parent, "alvo");
  mkdirSync(target, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const file = join(target, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return target;
}

function run(script, args) {
  const res = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  const diagnostics = res.error ? `\nspawn: ${res.error.message}` : "";
  return { code: res.status, out: `${res.stdout ?? ""}${res.stderr ?? ""}${diagnostics}` };
}

function sync(verb, target, extra = []) {
  return run(SYNC, [verb, "--target", target, ...extra]);
}

// ADR-001/I5: um alvo sem sinal de stack exige flag. Os testes que não têm
// stack como assunto declaram `--frontend react`; os testes de detecção chamam
// `sync("init", …)` direto e mantêm a varredura como único sinal.
function init(target, extra = []) {
  return sync("init", target, [...SUITE, "--frontend", "react", ...extra]);
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// A4: diretório de backup = IRMÃO do target, com o nome do target como prefixo.
function backupRoot(target) {
  return join(dirname(target), ".harness-backup");
}

function backupDirs(target) {
  const root = backupRoot(target);
  if (!existsSync(root)) return [];
  const prefix = `${basename(target)}-`;
  return readdirSync(root).filter((name) => name.startsWith(prefix));
}

function backupInsideTarget(target) {
  return existsSync(join(target, ".harness-backup"));
}

function walkAll(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    out.push(path);
    if (entry.isDirectory()) walkAll(path, out);
  }
  return out;
}

describe("SYNC-01 — init cria payload + config + manifesto (C3, A5, M6)", () => {
  it("dir vazio: camadas copiadas, config mínimo e manifesto com sha256", () => {
    const target = newTarget();
    const res = init(target);
    assert.equal(res.code, 0, res.out);
    assert.doesNotMatch(res.out, /backup:/, "init em alvo novo não tem nada a preservar");
    assert.deepEqual(backupDirs(target), [], "nenhum backup sem sobrescrita");
    assert.equal(backupInsideTarget(target), false, "backup nunca dentro do target (A4)");

    for (const layer of [".agents/agents", ".agents/rules", ".agents/schemas", ".agents/skills", ".opencode/plugins"]) {
      assert.ok(existsSync(join(target, layer)), `camada ausente: ${layer}`);
    }
    assert.ok(existsSync(join(target, "scripts/harness-sync.mjs")));
    assert.ok(existsSync(join(target, "scripts/seal.mjs")));
    assert.ok(existsSync(join(target, "opencode.json")));

    const config = readJson(join(target, "harness.config.json"));
    assert.equal(config.version, 2);
    assert.equal(config.project, basename(target));
    assert.deepEqual(config.targets, { frontend: "react", backend: null });
    assert.equal(config.commands.suiteFull, "node --test");
    assert.equal(config.evidence.path, "harness/");
    assert.ok(config.protectedPaths.includes(".opencode/plugins/**"));
    assert.ok(config.protectedPaths.includes("harness.config.json"));

    // F7 — o config gerado carrega as chaves que os gates leem. Sem elas, um
    // alvo freshly-instalado nasce com `gates`/`mcp`/`moduleMap` ausentes e o
    // comportamento difere do repo de origem (que tem todas).
    assert.deepEqual(config.moduleMap, {
      plugins: ".opencode/plugins",
      rules: ".agents/rules",
      schemas: ".agents/schemas",
    });
    assert.deepEqual(config.gates, {
      picco: "enforce",
      evidence: "enforce",
      hitlBatch: "enforce",
      e2eGreenfield: "warn",
    });
    assert.deepEqual(config.mcp, { required: ["chrome-devtools"] });
    assert.equal(config.contraproveTimeoutMs, 900000);

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
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const manifest = readJson(join(target, ".harness-manifest.json"));
    const rels = Object.keys(manifest.files);
    for (const rel of rels) {
      // ADR-001: o artefato PRÓPRIO de stack é GERADO, não publicado pela fonte —
      // o sha é verificado contra o próprio arquivo do alvo (SCAF-04).
      if (rel === ".agents/rules/project-frontend.md") {
        assert.equal(sha256(readFileSync(join(target, rel))), manifest.files[rel]);
        continue;
      }
      // Buffer cru, não string: um payload binário não pode ser re-codificado.
      assert.equal(sha256(readFileSync(join(REPO_ROOT, rel))), manifest.files[rel], `sha divergente: ${rel}`);
    }
    assert.equal(rels.some((p) => p.includes("__pycache__")), false, "bytecode não é payload");
  });

  it("G7: nenhum `.tmp-<pid>` sobrevive ao init", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const leftovers = walkAll(target).filter((p) => /\.tmp-\d+$/.test(p));
    assert.deepEqual(leftovers, [], "escrita atômica não deixa temporário");
  });

  it("C3: dir com estado do harness em .agents/ falha e manda usar update", () => {
    // ADR-001/I4: `.agents/rules/project-*.md` sozinho NÃO é estado do harness —
    // é artefato PRÓPRIO criável/preservável. O marcador é uma camada gerenciada.
    const target = newTarget({ ".agents/skills/minha-skill/SKILL.md": "# do projeto\n" });
    const res = init(target);
    assert.equal(res.code, 1);
    assert.match(res.out, /estado do harness já presente/);
    assert.match(res.out, /update/);
    assert.equal(existsSync(join(target, ".harness-manifest.json")), false);
  });

  it("ADR-001/I4: alvo com só project-*.md do maintainer NÃO é recusado pelo init", () => {
    const target = newTarget({
      ".agents/rules/project-backend.md": "# do maintainer\n",
      "package.json": JSON.stringify({ dependencies: { react: "^18" } }),
    });
    const res = init(target);
    assert.equal(res.code, 0, res.out);
    assert.equal(readFileSync(join(target, ".agents/rules/project-backend.md"), "utf8"), "# do maintainer\n");
    assert.match(res.out, /preserved|\.agents\/rules\/project-frontend\.md created/);
  });

  it("C3: dir com .opencode/plugins/gate.js do projeto falha e o gate fica intacto", () => {
    const projeto = "// gate do projeto\n";
    const target = newTarget({ ".opencode/plugins/gate.js": projeto });
    const res = init(target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /estado do harness já presente/);
    assert.match(res.out, /\.opencode\/plugins/);
    assert.equal(readFileSync(join(target, ".opencode/plugins/gate.js"), "utf8"), projeto);
    assert.equal(existsSync(join(target, "harness.config.json")), false, "init recusado não escreve config");
  });

  it("C3: dir com .opencode/commands/ do projeto falha pelo mesmo guard", () => {
    const target = newTarget({ ".opencode/commands/deploy.md": "# do projeto\n" });
    const res = init(target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /\.opencode\/commands/);
  });

  it("M6: manifesto presente sem .agents/ também barra o init (guard próprio)", () => {
    const target = newTarget({ ".harness-manifest.json": JSON.stringify({ version: 2, files: {} }) });
    const res = init(target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /\.harness-manifest\.json/);
  });

  it("target inexistente é criado pelo init", () => {
    const parent = TMP.tmp();
    const target = join(parent, "novo-alvo");
    const res = init(target);
    assert.equal(res.code, 0, res.out);
    assert.ok(existsSync(join(target, "harness.config.json")));
  });
});

describe("SYNC-02 — detecção de targets e comandos (sem perguntar nada) — A5", () => {
  it("package.json com react + express e scripts.test", () => {
    const target = newTarget({
      "package.json": JSON.stringify({
        name: "app",
        dependencies: { react: "^18", express: "^4" },
        scripts: { test: "vitest" },
      }),
    });
    const res = sync("init", target); // sem --suite: o comando vem da detecção
    assert.equal(res.code, 0, res.out);
    const config = readJson(join(target, "harness.config.json"));
    assert.deepEqual(config.targets, { frontend: "react", backend: "node" });
    assert.equal(config.commands.suiteFull, "npm test");
    assert.equal(config.commands.unit, "npm test");
  });

  it("A5: sem comando detectável o init RECUSA (exit 1, zero writes); --suite resolve", () => {
    const target = newTarget({
      "package.json": JSON.stringify({ dependencies: { vue: "^3", "@nestjs/core": "^10" } }),
    });
    const refused = sync("init", target);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /commands\.suiteFull não detectado: passe --suite <cmd>/);
    assert.equal(existsSync(join(target, "harness.config.json")), false, "recusa antes de qualquer write");
    assert.equal(existsSync(join(target, ".agents")), false, "nenhum payload copiado na recusa");
    assert.equal(existsSync(join(target, ".harness-manifest.json")), false);

    // dry-run não é passe livre: o comando é contrato do config, não do apply.
    const dry = sync("init", target, ["--dry-run"]);
    assert.equal(dry.code, 1, dry.out);
    assert.match(dry.out, /passe --suite/);

    // Sem flag: a detecção (vue + nestjs) continua sendo a origem da stack.
    const accepted = sync("init", target, SUITE);
    assert.equal(accepted.code, 0, accepted.out);
    const config = readJson(join(target, "harness.config.json"));
    assert.deepEqual(config.targets, { frontend: "vue", backend: "nestjs" });
    assert.equal(config.commands.suiteFull, "node --test");
  });

  it("Q3=A: pubspec.yaml NÃO gera alvo de frontend (targets só react|vue|null)", () => {
    const mobile = newTarget({
      "pubspec.yaml": "name: app\ndependencies:\n  flutter:\n    sdk: flutter\n",
    });
    // I5: sem sinal de stack é obrigatório declarar uma flag; `--backend node`
    // mantém a pergunta original (pubspec não pode virar frontend).
    assert.equal(sync("init", mobile, [...SUITE, "--backend", "node"]).code, 0);
    const config = readJson(join(mobile, "harness.config.json"));
    assert.deepEqual(config.targets, { frontend: null, backend: "node" });
    assert.ok(["react", "vue", null].includes(config.targets.frontend));
  });

  it("pom.xml ⇒ java + mvn test; Cargo.toml ⇒ rust + cargo test; --suite sobrepõe", () => {
    const java = newTarget({ "pom.xml": "<project/>" });
    assert.equal(sync("init", java).code, 0); // detecção, sem --suite
    const jc = readJson(join(java, "harness.config.json"));
    assert.deepEqual(jc.targets, { frontend: null, backend: "java" });
    assert.equal(jc.commands.suiteFull, "mvn test");

    const rust = newTarget({ "Cargo.toml": "[package]\nname='x'\n" });
    assert.equal(sync("init", rust).code, 0);
    const rc = readJson(join(rust, "harness.config.json"));
    assert.deepEqual(rc.targets, { frontend: null, backend: "rust" });
    assert.equal(rc.commands.suiteFull, "cargo test");

    const over = newTarget({ "pom.xml": "<project/>" });
    assert.equal(init(over, ["--suite", "mvn -q test", "--unit", "mvn -q -Dtest=U test"]).code, 0);
    const oc = readJson(join(over, "harness.config.json"));
    assert.equal(oc.commands.suiteFull, "mvn -q test");
    assert.equal(oc.commands.unit, "mvn -q -Dtest=U test");
  });
});

describe("SYNC-03 — update preserva o projeto (G3) — M6", () => {
  it("harness.config.json, workflow-state.json e .agents/rules/project-*.md intocados", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);

    const customConfig = JSON.stringify({ version: 2, project: "meu-projeto", commands: { suiteFull: "pytest" } });
    writeFileSync(join(target, "harness.config.json"), customConfig);
    writeFileSync(join(target, "workflow-state.json"), JSON.stringify({ current_phase: "Discovery" }));
    const projectRule = join(target, ".agents/rules/project-convencoes.md");
    writeFileSync(projectRule, "# regra do projeto\n");

    // O config do operador não declara `targets`: a flag é o sinal (I5).
    const res = sync("update", target, ["--frontend", "react"]);
    assert.equal(res.code, 0, res.out);
    assert.equal(readFileSync(join(target, "harness.config.json"), "utf8"), customConfig);
    assert.deepEqual(readJson(join(target, "workflow-state.json")), { current_phase: "Discovery" });
    assert.equal(readFileSync(projectRule, "utf8"), "# regra do projeto\n");
    assert.match(res.out, /skip harness\.config\.json/);
  });

  it("M6: .spec/** do projeto sobrevive ao update e nunca entra no manifesto", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const specFile = join(target, ".spec/backend/minha-feature/SPEC.md");
    mkdirSync(dirname(specFile), { recursive: true });
    writeFileSync(specFile, "# SPEC do projeto\n");

    const res = sync("update", target);
    assert.equal(res.code, 0, res.out);
    assert.equal(readFileSync(specFile, "utf8"), "# SPEC do projeto\n");
    const manifest = readJson(join(target, ".harness-manifest.json"));
    assert.equal(Object.keys(manifest.files).some((p) => p.startsWith(".spec/")), false);
  });

  it("opencode.json é MERGE: chave do projeto sobrevive, bloco gerenciado é refrescado", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
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

describe("SYNC-04 — determinismo e backup (G1/G2) — A4", () => {
  it("2ª execução = 0 writes e nenhum backup novo", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const first = sync("update", target);
    assert.equal(first.code, 0, first.out);
    assert.match(first.out, /update: 0 file\(s\) written/);
    assert.deepEqual(backupDirs(target), [], "nada escrito ⇒ nenhum backup");

    const second = sync("update", target);
    assert.match(second.out, /update: 0 file\(s\) written/);
  });

  it("A4: arquivo divergente é sobrescrito e o backup vai para FORA do target", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const rel = ".agents/rules/harness-config.md";
    const sourceText = readFileSync(join(REPO_ROOT, rel), "utf8");
    writeFileSync(join(target, rel), "# adulterado\n");

    const res = sync("update", target);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /update \.agents\/rules\/harness-config\.md/);
    assert.equal(readFileSync(join(target, rel), "utf8"), sourceText);

    const dirs = backupDirs(target);
    assert.equal(dirs.length, 1, "um backup por execução");
    assert.match(dirs[0], new RegExp(`^${basename(target)}-\\d{4}-`), "nome = <target>-<timestamp ISO>");
    assert.equal(backupInsideTarget(target), false, "nunca dentro do target");
    assert.equal(readFileSync(join(backupRoot(target), dirs[0], rel), "utf8"), "# adulterado\n");
    assert.match(res.out, new RegExp(`backup: ${backupRoot(target).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  });

  it("A4: --backup-dir sobrepõe o default; backup dentro do target é recusado", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const rel = ".agents/rules/workflow-rules.md";
    writeFileSync(join(target, rel), "# adulterado\n");

    const outDir = join(dirname(target), "meus-backups");
    const res = sync("update", target, ["--backup-dir", outDir]);
    assert.equal(res.code, 0, res.out);
    assert.equal(readFileSync(join(outDir, rel), "utf8"), "# adulterado\n");
    assert.deepEqual(backupDirs(target), [], "o default não foi usado");

    writeFileSync(join(target, rel), "# adulterado 2\n");
    const refused = sync("update", target, ["--backup-dir", join(target, "backups")]);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /backup dentro do target/);
    assert.equal(readFileSync(join(target, rel), "utf8"), "# adulterado 2\n", "recusa antes de qualquer write");
  });
});

describe("SYNC-05 — dry-run não escreve (nem backup)", () => {
  it("init --dry-run imprime o plano e deixa o dir vazio", () => {
    const target = newTarget();
    const res = sync("init", target, ["--dry-run", ...SUITE, "--frontend", "react"]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /create \.agents\//);
    assert.match(res.out, /dry-run:/);
    assert.deepEqual(readdirSync(target), [], "nada escrito");
    assert.equal(backupInsideTarget(target), false);
  });

  it("update --dry-run nomeia o write pendente e não aplica", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const rel = ".agents/rules/workflow-rules.md";
    writeFileSync(join(target, rel), "# adulterado\n");

    const res = sync("update", target, ["--dry-run"]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, new RegExp(`update ${rel.replace(/[.]/g, "\\.")}`));
    assert.equal(readFileSync(join(target, rel), "utf8"), "# adulterado\n");
    assert.deepEqual(backupDirs(target), []);
  });
});

describe("SYNC-06 — doctor (read-only, exit 1 com a falha nomeada) — A1/A6/M6", () => {
  it("config inválido reprova nomeando o path; init completo passa", () => {
    const target = newTarget({ "package.json": JSON.stringify({ scripts: { test: "node --test" } }) });
    assert.equal(init(target).code, 0);
    const ok = sync("doctor", target);
    assert.equal(ok.code, 0, ok.out);

    writeFileSync(join(target, "harness.config.json"), "{ nao e json");
    const bad = sync("doctor", target);
    assert.equal(bad.code, 1);
    assert.match(bad.out, /harness\.config\.json/);
  });

  it("camada ausente e commands.suiteFull nulo são falhas separadas", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    writeFileSync(
      join(target, "harness.config.json"),
      JSON.stringify({ version: 2, commands: { suiteFull: null } }),
    );
    const nul = sync("doctor", target);
    assert.equal(nul.code, 1);
    assert.match(nul.out, /commands\.suiteFull nulo/);

    const other = newTarget({ "pom.xml": "<project/>" });
    assert.equal(init(other).code, 0);
    assert.equal(sync("doctor", other).code, 0);

    // destrói uma camada: o doctor precisa acusar o path exato
    const orphan = newTarget({ "pom.xml": "<project/>" });
    assert.equal(init(orphan).code, 0);
    rmSync(join(orphan, ".agents/schemas"), { recursive: true, force: true });
    const broken = sync("doctor", orphan);
    assert.equal(broken.code, 1);
    assert.match(broken.out, /\.agents\/schemas/);
  });

  it("A6: adulterar 1 byte de um arquivo do payload reprova pelo sha do manifesto", () => {
    const target = newTarget({ "pom.xml": "<project/>" });
    assert.equal(init(target).code, 0);
    assert.equal(sync("doctor", target).code, 0);

    const rel = ".agents/rules/workflow-rules.md";
    const original = readFileSync(join(target, rel));
    const corrupted = Buffer.from(original);
    corrupted[0] = corrupted[0] === 0x23 ? 0x2a : 0x23; // alterna o primeiro byte
    writeFileSync(join(target, rel), corrupted);

    const res = sync("doctor", target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /sha256 divergente do manifesto: \.agents\/rules\/workflow-rules\.md/);
  });

  it("A6: arquivo do manifesto removido também reprova", () => {
    const target = newTarget({ "pom.xml": "<project/>" });
    assert.equal(init(target).code, 0);
    rmSync(join(target, "scripts/seal.mjs"));
    const res = sync("doctor", target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /arquivo do manifesto ausente: scripts\/seal\.mjs/);
  });

  it("M6: doctor não escreve — bytes e mtimes intactos, nenhum backup", () => {
    const target = newTarget({ "pom.xml": "<project/>" });
    assert.equal(init(target).code, 0);
    const manifest = readJson(join(target, ".harness-manifest.json"));
    const watched = [...Object.keys(manifest.files), ".harness-manifest.json"];
    const before = new Map(
      watched.map((rel) => {
        const abs = join(target, rel);
        const st = statSync(abs);
        return [rel, { bytes: readFileSync(abs), mtimeMs: st.mtimeMs }];
      }),
    );

    assert.equal(sync("doctor", target).code, 0);
    for (const rel of watched) {
      const abs = join(target, rel);
      assert.deepEqual(readFileSync(abs), before.get(rel).bytes, `bytes mudaram: ${rel}`);
      assert.equal(statSync(abs).mtimeMs, before.get(rel).mtimeMs, `mtime mudou: ${rel}`);
    }
    assert.deepEqual(backupDirs(target), []);
    assert.equal(backupInsideTarget(target), false);
  });

  it("A1: brain ausente ⇒ WARN visível e exit 0 (pin nunca reprova o doctor)", () => {
    const target = newTarget({ "pom.xml": "<project/>" });
    assert.equal(init(target).code, 0);
    const res = sync("doctor", target);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /WARN brain ausente: pin não verificado/);
  });

  it("A1: brain presente mas não git ⇒ WARN com o path, exit 0", () => {
    const parent = TMP.tmp();
    const target = join(parent, "alvo");
    mkdirSync(join(parent, "brain"), { recursive: true });
    assert.equal(init(target).code, 0);
    const res = sync("doctor", target);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /WARN brain não é checkout git/);
    assert.match(res.out, /brain/);
  });
});

describe("SYNC-07 — symlink e target==fonte recusam o run INTEIRO (C1/A3, G6)", () => {
  it("C1: symlink na folha aponta para fora ⇒ update exit 1, alvo externo intacto, sem backup", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);

    const outside = join(dirname(target), "fora-do-target.md");
    writeFileSync(outside, "INTOCADO\n");
    const rel = ".agents/rules/harness-config.md";
    rmSync(join(target, rel));
    symlinkSync(outside, join(target, rel));

    const res = sync("update", target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /symlink no destino/);
    assert.equal(readFileSync(outside, "utf8"), "INTOCADO\n", "arquivo externo nunca é escrito");
    assert.deepEqual(backupDirs(target), [], "recusa antes do backup");
    assert.equal(lstatSync(join(target, rel)).isSymbolicLink(), true, "o elo não é substituído");
  });

  it("C1: symlink em componente de diretório ⇒ update exit 1 antes de qualquer byte", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);

    const outsideDir = join(dirname(target), "regras-externas");
    writeFileSync(join(dirname(target), "regras-externas.md"), "x\n");
    mkdirSync(outsideDir, { recursive: true });
    writeFileSync(join(outsideDir, "harness-config.md"), "ALHEIO\n");
    rmSync(join(target, ".agents/rules"), { recursive: true, force: true });
    symlinkSync(outsideDir, join(target, ".agents/rules"));

    const res = sync("update", target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /symlink no destino/);
    assert.equal(readFileSync(join(outsideDir, "harness-config.md"), "utf8"), "ALHEIO\n");
    assert.deepEqual(backupDirs(target), []);
  });

  it("A3: target === fonte ⇒ update e doctor recusam com mensagem própria", () => {
    const update = sync("update", REPO_ROOT);
    assert.equal(update.code, 1, update.out);
    assert.match(update.out, /target é a própria fonte/);

    const doctor = sync("doctor", REPO_ROOT);
    assert.equal(doctor.code, 1, doctor.out);
    assert.match(doctor.out, /target é a própria fonte/);

    const initRes = sync("init", REPO_ROOT);
    assert.equal(initRes.code, 1, initRes.out);
    assert.match(initRes.out, /target é a própria fonte/);
  });
});

describe("SYNC-08 — órfãos são reportados, nunca removidos (A7)", () => {
  it("entrada extra no manifesto ⇒ linha orphan, arquivo preservado e sem --prune", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);

    const rel = "scripts/legado-removido.mjs";
    const content = "// arquivo que o payload não publica mais\n";
    writeFileSync(join(target, rel), content);
    const manifestPath = join(target, ".harness-manifest.json");
    const manifest = readJson(manifestPath);
    manifest.files[rel] = sha256(Buffer.from(content));
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const res = sync("update", target);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /orphan scripts\/legado-removido\.mjs \(não removido\)/, res.out);
    assert.equal(existsSync(join(target, rel)), true, "órfão NUNCA é apagado");
    assert.equal(readFileSync(join(target, rel), "utf8"), content);
    // Zero writes ⇒ o manifesto NÃO é reescrito (G1): a entrada órfã continua
    // lá e volta a ser reportada na próxima execução, até uma decisão humana.
    assert.equal(rel in readJson(manifestPath).files, true, "manifesto intacto: 0 writes");
    const second = sync("update", target);
    assert.match(second.out, /orphan scripts\/legado-removido\.mjs/, second.out);
  });
});

describe("SYNC-09 — N1: config gerado passa pelo MESMO guard do payload", () => {
  it("N1(a): symlink PENDENTE no config ⇒ exit 1 e o arquivo externo NÃO é criado", () => {
    const target = newTarget();
    const outside = join(dirname(target), "fora-config.json");
    symlinkSync(outside, join(target, "harness.config.json"));

    const res = init(target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /symlink no destino \(harness\.config\.json\)/);
    // O farol do defeito: `writeFileSync` num link pendente cria o alvo FORA.
    assert.equal(existsSync(outside), false, "nenhum byte fora do target");
    // N1(c): a recusa acontece no plano, antes de qualquer escrita ou backup.
    assert.equal(existsSync(join(target, ".agents")), false, "payload não foi copiado");
    assert.equal(existsSync(join(target, ".harness-manifest.json")), false, "sem manifesto");
    assert.equal(backupInsideTarget(target), false);
    assert.deepEqual(backupDirs(target), []);
    assert.deepEqual(
      walkAll(target).filter((p) => /\.tmp-\d+$/.test(p)),
      [],
      "nenhum temporário de escrita atômica sobrou",
    );
    assert.equal(lstatSync(join(target, "harness.config.json")).isSymbolicLink(), true, "o elo não é substituído");
  });

  it("N1(b): symlink EXISTENTE no config ⇒ exit 1 e o destino do link fica intacto", () => {
    const target = newTarget();
    const outside = join(dirname(target), "config-alheio.json");
    writeFileSync(outside, '{"version":2,"commands":{"suiteFull":"intacto"}}\n');
    symlinkSync(outside, join(target, "harness.config.json"));

    const res = init(target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /symlink no destino \(harness\.config\.json\)/);
    assert.equal(
      readFileSync(outside, "utf8"),
      '{"version":2,"commands":{"suiteFull":"intacto"}}\n',
      "existsSync/resolve trataria o link como 'config presente' e o escritor o sobrescreveria",
    );
    assert.equal(existsSync(join(target, ".harness-manifest.json")), false);
    assert.deepEqual(
      walkAll(target).filter((p) => /\.tmp-\d+$/.test(p)),
      [],
      "nenhum temporário de escrita atômica sobrou",
    );
  });

  it("N1: init normal escreve o config pelo caminho atômico e ele NÃO entra no manifesto", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const manifest = readJson(join(target, ".harness-manifest.json"));
    assert.equal("harness.config.json" in manifest.files, false, "config é dado do projeto, não payload (G3)");
    assert.ok(existsSync(join(target, "harness.config.json")));
  });
});

describe("SYNC-10 — N2: órfão sobrevive à regravação do manifesto", () => {
  it("update que grava 1 arquivo preserva a entrada órfã, e o 2º update a reporta de novo", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);

    const rel = "scripts/legado.mjs";
    const content = "// o payload não publica mais este arquivo\n";
    writeFileSync(join(target, rel), content);
    const manifestPath = join(target, ".harness-manifest.json");
    const manifest = readJson(manifestPath);
    manifest.files[rel] = sha256(Buffer.from(content));
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const adulterado = ".agents/rules/workflow-rules.md";
    writeFileSync(join(target, adulterado), "# adulterado\n");

    const first = sync("update", target);
    assert.equal(first.code, 0, first.out);
    assert.match(first.out, /update: 1 file\(s\) written/, first.out);
    assert.match(first.out, /orphan scripts\/legado\.mjs \(não removido\)/, first.out);
    assert.equal(
      readJson(manifestPath).files[rel],
      sha256(Buffer.from(content)),
      "o write do manifesto não pode esquecer o registro órfão",
    );
    assert.equal(readFileSync(join(target, rel), "utf8"), content, "órfão nunca é apagado");

    const second = sync("update", target);
    assert.equal(second.code, 0, second.out);
    assert.match(second.out, /update: 0 file\(s\) written/, second.out);
    assert.match(second.out, /orphan scripts\/legado\.mjs \(não removido\)/, "o órfão continua visível");

    // O ledger continua honesto: o doctor re-hasheia o órfão e passa.
    assert.equal(sync("doctor", target).code, 0);
  });
});

describe("SYNC-11 — N3: update não instala config com suiteFull nulo", () => {
  it("alvo sem config e sem comando detectável ⇒ exit 1, ZERO writes", () => {
    const target = newTarget({
      "package.json": JSON.stringify({ name: "app", dependencies: { vue: "^3" } }),
    });
    const res = sync("update", target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /commands\.suiteFull não detectado: passe --suite <cmd>/);
    assert.deepEqual(readdirSync(target), ["package.json"], "nenhum byte escrito na recusa");
    assert.equal(existsSync(join(target, ".harness-manifest.json")), false);
  });

  it("o mesmo alvo com --suite instala o config e sai 0", () => {
    const target = newTarget({
      "package.json": JSON.stringify({ name: "app", dependencies: { vue: "^3" } }),
    });
    const res = sync("update", target, SUITE);
    assert.equal(res.code, 0, res.out);
    const config = readJson(join(target, "harness.config.json"));
    assert.equal(config.commands.suiteFull, "node --test");
    assert.deepEqual(config.targets, { frontend: "vue", backend: null });
    assert.ok(existsSync(join(target, ".harness-manifest.json")));
  });
});

describe("SYNC-12 — N9: manifesto ausente é recriado com o payload byte-idêntico", () => {
  it("init → rm manifesto → update recria (exit 0) e o doctor volta a passar", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const manifestPath = join(target, ".harness-manifest.json");
    const before = readJson(manifestPath);
    rmSync(manifestPath);

    const res = sync("update", target);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /update: 0 file\(s\) written/, "payload já idêntico: nenhum byte de payload reescrito");
    assert.match(res.out, /manifest rewritten \(\.harness-manifest\.json\)/);
    const after = readJson(manifestPath);
    assert.deepEqual(after.files, before.files, "os hashes são os do payload atual");
    assert.equal(sync("doctor", target).code, 0);
    // Idempotente: o manifesto recriado fica estável no run seguinte.
    assert.match(sync("update", target).out, /update: 0 file\(s\) written/);
    assert.doesNotMatch(sync("update", target).out, /manifest rewritten/);
  });

  it("manifesto adulterado (hash errado) também é regravado", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const manifestPath = join(target, ".harness-manifest.json");
    const manifest = readJson(manifestPath);
    const victim = Object.keys(manifest.files)[0];
    manifest.files[victim] = "0".repeat(64);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const res = sync("update", target);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /manifest rewritten/);
    assert.equal(readJson(manifestPath).files[victim], sha256(readFileSync(join(REPO_ROOT, victim))));
    assert.equal(sync("doctor", target).code, 0);
  });
});

describe("SYNC-13 — N7: diretório de backup é guardado e a cópia é atômica", () => {
  it("--backup-dir symlinkado ⇒ exit 1 antes de qualquer escrita (payload intacto)", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const rel = ".agents/rules/workflow-rules.md";
    writeFileSync(join(target, rel), "# adulterado\n");

    const realDir = join(dirname(target), "backups-reais");
    mkdirSync(realDir, { recursive: true });
    const linkDir = join(dirname(target), "backups-link");
    symlinkSync(realDir, linkDir);

    const res = sync("update", target, ["--backup-dir", linkDir]);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /symlink no diretório de backup/);
    assert.equal(readFileSync(join(target, rel), "utf8"), "# adulterado\n", "recusa antes de qualquer write");
    assert.deepEqual(readdirSync(realDir), [], "a cópia não atravessa o link");
    assert.deepEqual(
      walkAll(target).filter((p) => /\.tmp-\d+$/.test(p)),
      [],
      "nenhum temporário sobrou",
    );
  });

  it("componente do backup default symlinkado também aborta o run", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const rel = ".agents/rules/workflow-rules.md";
    writeFileSync(join(target, rel), "# adulterado\n");

    const outside = join(dirname(target), "backup-alheio");
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, backupRoot(target));

    const res = sync("update", target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /symlink no diretório de backup/);
    assert.deepEqual(readdirSync(outside), []);
    assert.equal(readFileSync(join(target, rel), "utf8"), "# adulterado\n");
  });
});

describe("SYNC-21 — D1: identidade do diretório de backup sob link INTERMEDIÁRIO (F2)", () => {
  // Defeito: `lstat` segue componentes intermediários, então o ancestral mais
  // fundo EXISTENTE era a própria folha (`sub`), lida como diretório comum — o
  // link em `mid/link` nunca era inspecionado e a contenção era lexical. Os dois
  // casos abaixo exigem exit 1 com ZERO writes: um porque o caminho real cai
  // dentro do target, o outro porque o elo nomeado está na cadeia.
  it("D1(a): ancestral symlinkado apontando para DENTRO do target ⇒ exit 1, backup dentro do target", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const rel = ".agents/rules/workflow-rules.md";
    writeFileSync(join(target, rel), "# adulterado\n");

    const inside = join(target, ".agents", "backup-alvo");
    mkdirSync(join(inside, "sub"), { recursive: true });
    const mid = join(TMP.tmp(), "mid");
    mkdirSync(mid, { recursive: true });
    symlinkSync(inside, join(mid, "link"));
    // `sub` existe ATRAVÉS do elo: é exatamente isso que cegava o walk antigo.
    const backupDir = join(mid, "link", "sub");
    assert.equal(lstatSync(backupDir).isDirectory(), true, "a folha resolve pelo link");

    const res = sync("update", target, ["--backup-dir", backupDir]);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /backup dentro do target/);
    assert.equal(readFileSync(join(target, rel), "utf8"), "# adulterado\n", "recusa antes de qualquer write");
    assert.deepEqual(readdirSync(join(inside, "sub")), [], "nada copiado para dentro do target");
    assert.deepEqual(
      walkAll(target).filter((p) => /\.tmp-\d+$/.test(p)),
      [],
      "nenhum temporário de escrita atômica sobrou",
    );
  });

  it("D1(b): ancestral symlinkado apontando para FORA com componente inexistente ⇒ exit 1, nada escrito", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const rel = ".agents/rules/workflow-rules.md";
    writeFileSync(join(target, rel), "# adulterado\n");

    const outside = join(TMP.tmp(), "fora-bk");
    mkdirSync(outside, { recursive: true });
    const mid = join(TMP.tmp(), "mid");
    mkdirSync(mid, { recursive: true });
    symlinkSync(outside, join(mid, "link"));
    // A folha NÃO existe: o ancestral mais fundo existente é o próprio elo, e um
    // link nomeado na cadeia continua sendo recusa (G6 não afrouxou).
    const backupDir = join(mid, "link", "nao-existe");

    const res = sync("update", target, ["--backup-dir", backupDir]);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /symlink no diretório de backup/);
    assert.equal(readFileSync(join(target, rel), "utf8"), "# adulterado\n");
    assert.deepEqual(readdirSync(outside), [], "nada atravessa o elo");
    assert.equal(existsSync(backupDir), false, "o diretório de backup não é criado");
  });
});

describe("SYNC-22 — D2: identidade do target quando ele é um symlink para a fonte (F2)", () => {
  it("target symlinkado para o checkout ⇒ update e doctor exit 1, manifesto não nasce na fonte", () => {
    const link = join(TMP.tmp(), "atalho-para-a-fonte");
    symlinkSync(REPO_ROOT, link);

    const update = sync("update", link);
    assert.equal(update.code, 1, update.out);
    assert.match(update.out, /target é a própria fonte/);

    const doctor = sync("doctor", link);
    assert.equal(doctor.code, 1, doctor.out);
    assert.match(doctor.out, /target é a própria fonte/);

    assert.equal(existsSync(join(REPO_ROOT, ".harness-manifest.json")), false, "a fonte não ganha manifesto");
    // Contraprova na VCS: o defeito deixava o manifesto como arquivo novo aqui.
    const gitStatus = spawnSync("git", ["-C", REPO_ROOT, "status", "--porcelain", "--", ".harness-manifest.json"], {
      encoding: "utf8",
    });
    assert.equal(gitStatus.status, 0, gitStatus.stderr);
    assert.equal(gitStatus.stdout.trim(), "", "nenhum manifesto no checkout da fonte");
  });
});

describe("SYNC-23 — borda do init: alvo que não pode ser criado recusa com mensagem, não com crash (F2)", () => {
  // Defeito: `mkdirSync` no alvo subia ENOENT (link quebrado) / EEXIST (arquivo
  // comum) como stack trace, enquanto `harness-config.md` promete mensagem
  // acionável. A recusa tem de nomear o que existe no path, sair 1 e escrever 0.
  it("link quebrado ⇒ exit 1 nomeado, sem stack trace, zero writes", () => {
    const parent = TMP.tmp();
    const dest = join(parent, "nao-existe");
    const link = join(parent, "alvo-quebrado");
    symlinkSync(dest, link);

    const res = sync("init", link, SUITE);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /target é link quebrado/);
    assert.doesNotMatch(res.out, /\n\s+at |node:fs:/, "nenhuma stack trace na recusa");
    assert.equal(existsSync(dest), false, "o destino do link não é criado");
    assert.deepEqual(readdirSync(parent), ["alvo-quebrado"], "zero writes no parent");
  });

  it("alvo é arquivo comum ⇒ exit 1 nomeado (nunca EEXIST como stack)", () => {
    const parent = TMP.tmp();
    const file = join(parent, "arquivo");
    writeFileSync(file, "x");

    const res = sync("init", file, SUITE);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /target não é diretório/);
    assert.doesNotMatch(res.out, /\n\s+at |node:fs:/);
    assert.equal(readFileSync(file, "utf8"), "x", "o arquivo existente fica intacto");
  });
});

describe("SYNC-24 — --dry-run valida o destino do backup antes de exibir o plano (F2)", () => {
  // Defeito: o dry-run listava um plano que o apply recusaria — o operador
  // confirmava uma escrita que nunca poderia acontecer. A validação do backup
  // roda no dry-run, com o mesmo guard do apply.
  it("--backup-dir dentro do target recusa no dry-run, sem imprimir plano aplicável", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const rel = ".agents/rules/workflow-rules.md";
    writeFileSync(join(target, rel), "# adulterado\n");

    const res = sync("update", target, ["--dry-run", "--backup-dir", join(target, "bk")]);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /backup dentro do target/);
    assert.doesNotMatch(res.out, /dry-run:/, "o plano não é exibido como aplicável");
    assert.doesNotMatch(res.out, new RegExp(`update ${rel.replace(/[.]/g, "\\.")}`), "nem a linha do write pendente");
    assert.equal(existsSync(join(target, "bk")), false, "zero writes no dry-run");
    assert.equal(readFileSync(join(target, rel), "utf8"), "# adulterado\n");
    assert.deepEqual(backupDirs(target), []);
  });

  it("--backup-dir symlinkado também recusa no dry-run", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    writeFileSync(join(target, ".agents/rules/workflow-rules.md"), "# adulterado\n");

    const realDir = join(dirname(target), "backups-reais");
    mkdirSync(realDir, { recursive: true });
    const linkDir = join(dirname(target), "backups-link");
    symlinkSync(realDir, linkDir);

    const res = sync("update", target, ["--dry-run", "--backup-dir", linkDir]);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /symlink no diretório de backup/);
    assert.doesNotMatch(res.out, /dry-run:/);
    assert.deepEqual(readdirSync(realDir), [], "o dry-run não atravessa o link");
  });
});

describe("CMD-01 — camada .opencode/commands no payload (F2)", () => {
  const COMMANDS = ["harness-init.md", "harness-update.md", "harness-doctor.md"];

  it("init copia os três comandos byte a byte e o doctor valida a camada", () => {
    const target = newTarget();
    const res = init(target);
    assert.equal(res.code, 0, res.out);
    for (const name of COMMANDS) {
      const dest = join(target, ".opencode/commands", name);
      assert.equal(existsSync(dest), true, `${name} copiado`);
      assert.equal(readFileSync(dest, "utf8"), readFileSync(join(REPO_ROOT, ".opencode/commands", name), "utf8"));
    }
    const manifest = readJson(join(target, ".harness-manifest.json"));
    assert.equal(".opencode/commands/harness-init.md" in manifest.files, true, "camada entra no manifesto");

    const doctor = sync("doctor", target);
    assert.equal(doctor.code, 0, doctor.out);
  });

  it("comando apagado no destino ⇒ doctor FAIL nomeando o path", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    rmSync(join(target, ".opencode/commands/harness-doctor.md"));

    const doctor = sync("doctor", target);
    assert.equal(doctor.code, 1, doctor.out);
    assert.match(doctor.out, /arquivo do manifesto ausente: \.opencode\/commands\/harness-doctor\.md/);
  });

  it("camada inteira removida no destino ⇒ doctor FAIL 'camada ausente'", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    rmSync(join(target, ".opencode/commands"), { recursive: true, force: true });

    const doctor = sync("doctor", target);
    assert.equal(doctor.code, 1, doctor.out);
    assert.match(doctor.out, /camada ausente: \.opencode\/commands/);
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
    const dir = newTarget({ "harness.config.json": JSON.stringify({ version: 2, commands: {} }) });
    const res = run(SEAL, ["--config", join(dir, "harness.config.json")]);
    assert.equal(res.code, 1);
    assert.match(res.out, /suiteFull/);
  });
});

describe("NET-01 — os dois scripts são rede-zero (G5, medido na fonte) — A2", () => {
  // V15 media rede no diretório do instalador v1 (apagado); a medição do
  // sucessor — que roda no caminho de instalação — fica aqui, no mesmo lugar
  // em que o comportamento dele é testado. Classes cobertas: módulo de rede,
  // CLIENTE HTTP de pacote, e COMANDO de rede. O que fica de fora (declarado):
  // comando montado em variável, `fetch` alcançado por alias e specifier
  // construído em runtime — as arestas E1..E9 do V15 não voltam com a v2.
  const FORBIDDEN = [
    /(?:from|import\s*\(|require\s*\()\s*["'](?:node:)?(?:https?|net|dns|dgram|http2|tls)["']/,
    /(?:from|import\s*\(|require\s*\()\s*["'](?:axios|got|undici|node-fetch|cross-fetch|isomorphic-fetch|superagent|ky|request|ws)["']/,
    /\bfetch\s*\(/,
    /\bnew\s+(?:globalThis\.)?(?:WebSocket|XMLHttpRequest)\b/,
    /\b(?:curl|wget)\b/,
    /\bgit\s+(?:clone|push|pull|fetch)\b/,
    /\b(?:npm|pnpm|yarn)\s+(?:install|add|i)\b/,
    /\bnpx\s/,
  ];

  for (const script of ["scripts/harness-sync.mjs", "scripts/seal.mjs"]) {
    it(`${script}: nenhum import/uso de rede`, () => {
      const source = readFileSync(join(REPO_ROOT, script), "utf8");
      for (const re of FORBIDDEN) assert.doesNotMatch(source, re, `padrão proibido em ${script}: ${re}`);
    });
  }

  it("o único child_process é o `git rev-parse` local do brain (A1)", () => {
    const source = readFileSync(join(REPO_ROOT, "scripts/harness-sync.mjs"), "utf8");
    const calls = source.match(/execFileSync\([^)]*\)/g) ?? [];
    assert.ok(calls.length >= 1, "doctor usa execFileSync para o pin do brain");
    for (const call of calls) assert.match(call, /"git", \["-C", brainDir, "rev-parse", "HEAD"\]/);
  });

  // N5 — controle positivo. Um detector que só é exercitado contra fontes
  // limpas fica verde quando a LISTA esvazia: o laço acima não roda nenhuma
  // regex e nada falha. Cada classe abaixo derruba o predicado se o padrão
  // correspondente for removido/afrouxado.
  it("controle positivo: a lista mantém as 8 classes (não pode esvaziar)", () => {
    assert.ok(FORBIDDEN.length >= 8, `detector com ${FORBIDDEN.length} classe(s): a lista esvaziou`);
  });

  const ATTACKS = [
    ["módulo de rede", 'import http from "node:http";'],
    ["cliente HTTP de pacote", 'import got from "got";'],
    ["fetch(", "const res = await fetch(url);"],
    ["WebSocket", "const socket = new WebSocket(url);"],
    ["curl", "curl https://example.com/x"],
    ["git clone", "git clone https://example.com/x.git"],
    ["npm install", "npm install left-pad"],
    ["npx", "npx some-tool --flag"],
  ];
  for (const [label, attack] of ATTACKS) {
    it(`controle positivo: ${label} é acusado`, () => {
      assert.ok(
        FORBIDDEN.some((re) => re.test(attack)),
        `nenhum padrão acusa ${label}: ${attack}`,
      );
    });
  }

  it("controle positivo: prosa/código inocente não é acusado (sem falso positivo óbvio)", () => {
    for (const benign of ["const files = payloadFiles();", "// a cópia é atômica", 'import fs from "node:fs";']) {
      assert.equal(FORBIDDEN.some((re) => re.test(benign)), false, `falso positivo em: ${benign}`);
    }
  });
});

describe("SYNC-14 — R-1: o temporário da escrita atômica é guardado (`wx`)", () => {
  // O temporário carrega o pid de QUEM escreve, logo o elo só é plantável pelo
  // próprio processo que grava: o launcher abaixo planta e chama `runUpdate` no
  // MESMO processo (pid == o do escritor) e sai com o código do verbo.
  // O launcher sai por `process.exitCode`, nunca `process.exit(código)` (item
  // 16 do review): com stdout em pipe a escrita é assíncrona e o exit imediato
  // descarta a última linha — o código de saída continuava 1 e o texto faltava.
  function runUpdateWithPlantedTmp(target, destTmpBase, linkTarget, opts = {}) {
    const script = [
      'import { symlinkSync, mkdirSync } from "node:fs";',
      'import { dirname } from "node:path";',
      `mkdirSync(dirname(${JSON.stringify(destTmpBase)}), { recursive: true });`,
      `symlinkSync(${JSON.stringify(linkTarget)}, ${JSON.stringify(destTmpBase)} + ".tmp-" + process.pid);`,
      `const { runUpdate } = await import(${JSON.stringify(SYNC)});`,
      `process.exitCode = runUpdate(${JSON.stringify(target)}, ${JSON.stringify(opts)});`,
    ].join("\n");
    return spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
  }

  function out(res) {
    return `${res.stdout ?? ""}${res.stderr ?? ""}`;
  }

  function noTmpLeft(...roots) {
    for (const root of roots) {
      assert.deepEqual(
        walkAll(root).filter((p) => /\.tmp-\d+$/.test(p)),
        [],
        `o temporário recusado é removido, não deixa rastro (${root})`,
      );
    }
  }

  it("R-1(a): tmp do PAYLOAD plantado como symlink ⇒ exit 1, zero bytes fora, destino intacto", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const rel = ".agents/rules/harness-config.md";
    writeFileSync(join(target, rel), "# adulterado\n");
    const outside = join(dirname(target), "fora-pelo-tmp.md");
    writeFileSync(outside, "INTOCADO\n");

    const res = runUpdateWithPlantedTmp(target, join(target, rel), outside);
    const text = out(res);
    assert.equal(res.status, 1, text);
    assert.match(text, /temporário já existe: possível symlink plantado/, text);
    // O farol do defeito: `writeFileSync` sem `wx` seguiria o elo e gravaria FORA.
    assert.equal(readFileSync(outside, "utf8"), "INTOCADO\n", "nenhum byte atravessou o link");
    assert.equal(lstatSync(join(target, rel)).isSymbolicLink(), false, "o destino não vira link");
    assert.equal(readFileSync(join(target, rel), "utf8"), "# adulterado\n", "recusa antes de gravar o payload");
    noTmpLeft(target);
  });

  it("R-1(b): tmp do MANIFESTO plantado ⇒ exit 1 e o manifesto não é trocado por link", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const manifestPath = join(target, ".harness-manifest.json");
    // Entrada podada ⇒ manifesto divergente ⇒ o write do manifesto acontece
    // mesmo com 0 writes de payload (N9).
    const manifest = readJson(manifestPath);
    delete manifest.files[Object.keys(manifest.files)[0]];
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const outside = join(dirname(target), "manifesto-alheio.json");
    writeFileSync(outside, "{}\n");

    const res = runUpdateWithPlantedTmp(target, manifestPath, outside);
    const text = out(res);
    assert.equal(res.status, 1, text);
    assert.match(text, /temporário já existe: possível symlink plantado/, text);
    assert.equal(readFileSync(outside, "utf8"), "{}\n", "o farol não é escrito");
    assert.equal(lstatSync(manifestPath).isSymbolicLink(), false, "o manifesto continua arquivo regular");
    noTmpLeft(target);
  });

  it("R-1(c): tmp da CÓPIA DE BACKUP plantado ⇒ exit 1 antes de gravar o payload", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const rel = ".agents/rules/workflow-rules.md";
    writeFileSync(join(target, rel), "# adulterado\n");
    const dir = join(dirname(target), "backup-do-teste");
    mkdirSync(dir, { recursive: true });
    const outside = join(dirname(target), "fora-pelo-tmp-backup.md");
    writeFileSync(outside, "INTOCADO\n");

    const res = runUpdateWithPlantedTmp(target, join(dir, rel), outside, { backupDir: dir });
    const text = out(res);
    assert.equal(res.status, 1, text);
    assert.match(text, /temporário já existe: possível symlink plantado/, text);
    assert.equal(readFileSync(outside, "utf8"), "INTOCADO\n");
    assert.equal(readFileSync(join(target, rel), "utf8"), "# adulterado\n", "a cópia falhou antes do write");
    noTmpLeft(target, dir);
  });
});

describe("SYNC-15 — R-2: doctor reprova link em entrada do manifesto", () => {
  it("payload substituído por symlink com bytes IDÊNTICOS ⇒ exit 1 (nunca re-hash pelo elo)", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const rel = ".agents/rules/harness-config.md";
    const outside = join(dirname(target), "copia-fiel.md");
    writeFileSync(outside, readFileSync(join(target, rel)));
    rmSync(join(target, rel));
    symlinkSync(outside, join(target, rel));
    // Pré-condição do ataque: os bytes do outro lado batem com o manifesto.
    const manifest = readJson(join(target, ".harness-manifest.json"));
    assert.equal(sha256(readFileSync(join(target, rel))), manifest.files[rel], "hash idêntico: só o lstat separa");

    const res = sync("doctor", target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /arquivo do manifesto é symlink: \.agents\/rules\/harness-config\.md/);
    assert.doesNotMatch(res.out, /sha256 divergente/, "não é o hash que reprova: é o tipo da entrada");
  });
});

describe("SYNC-16 — I1: config EXISTENTE com suiteFull nulo avisa e não é tocado", () => {
  it("update ⇒ WARN nomeado, exit 0, zero bytes escritos no config", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const configPath = join(target, "harness.config.json");
    const nulled = `${JSON.stringify({ version: 2, project: basename(target), commands: { suiteFull: null } }, null, 2)}\n`;
    writeFileSync(configPath, nulled);

    const res = sync("update", target, ["--frontend", "react"]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /WARN commands\.suiteFull nulo em harness\.config\.json/);
    assert.match(res.out, /o gate negará Completed até ser preenchido/);
    assert.equal(readFileSync(configPath, "utf8"), nulled, "config é dado do projeto: nunca reescrito");
  });

  // I1b: um config que NÃO parseia não tem `commands.suiteFull` para ser nulo.
  // O código antigo lia o JSON para null e culpava a chave da suíte por um erro
  // de sintaxe — diagnóstico falso que mandava o operador preencher o comando
  // num arquivo que o doctor nem consegue abrir.
  it("I1b: config com JSON inválido ⇒ WARN do JSON, nunca o de suiteFull", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const configPath = join(target, "harness.config.json");
    const broken = "{ nao e json";
    writeFileSync(configPath, broken);

    const res = sync("update", target, ["--frontend", "react"]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /WARN harness\.config\.json inválido — doctor reprova/);
    assert.doesNotMatch(res.out, /commands\.suiteFull nulo/, "não há suite para ser nula num arquivo ilegível");
    assert.equal(readFileSync(configPath, "utf8"), broken, "config nunca reescrito");
    // O verbo que reprova é o doctor (read-only), não o update.
    assert.equal(sync("doctor", target).code, 1);
  });
});

describe("SYNC-17 — I3: reparo de órfão é o documentado (podar a entrada)", () => {
  it("órfão apagado à mão ⇒ doctor FAIL; podar a entrada do manifesto ⇒ doctor verde", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const rel = "scripts/legado-removido.mjs";
    const content = "// arquivo que o payload não publica mais\n";
    writeFileSync(join(target, rel), content);
    const manifestPath = join(target, ".harness-manifest.json");
    const manifest = readJson(manifestPath);
    manifest.files[rel] = sha256(Buffer.from(content));
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    rmSync(join(target, rel));
    const broken = sync("doctor", target);
    assert.equal(broken.code, 1, broken.out);
    assert.match(broken.out, /arquivo do manifesto ausente: scripts\/legado-removido\.mjs/);

    const pruned = readJson(manifestPath);
    delete pruned.files[rel];
    writeFileSync(manifestPath, `${JSON.stringify(pruned, null, 2)}\n`);
    assert.equal(sync("doctor", target).code, 0);
  });
});

describe("SYNC-18 — L1: a CÓPIA DE BACKUP passa pelo mesmo guard (SYNC-14(d))", () => {
  // O loop de backup escrevia com `writeAtomic` direto: um link plantado abaixo
  // do diretório de backup copiava o arquivo do projeto para fora do backup. O
  // guard era por call site, e este call site não o tinha.
  it("L1(d): <backup-dir>/<pai-de-rel> symlinkado ⇒ exit 1, ZERO bytes fora, sem .tmp-*", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const rel = ".agents/rules/workflow-rules.md";
    writeFileSync(join(target, rel), "# adulterado\n");

    const dir = join(dirname(target), "backup-com-link");
    const outside = join(dirname(target), "backup-alheio");
    mkdirSync(join(dir, ".agents"), { recursive: true });
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, join(dir, ".agents/rules"));

    const res = sync("update", target, ["--backup-dir", dir]);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, new RegExp(`symlink no destino \\(${rel.replace(/[.\\/]/g, "\\$&")}\\)`));
    assert.deepEqual(readdirSync(outside), [], "nenhum byte do projeto atravessa o elo");
    assert.deepEqual(
      walkAll(dir).filter((p) => /\.tmp-\d+$/.test(p)),
      [],
      "a cópia recusada não deixa temporário no backup",
    );
    assert.deepEqual(
      walkAll(target).filter((p) => /\.tmp-\d+$/.test(p)),
      [],
      "nem no target",
    );
    assert.equal(readFileSync(join(target, rel), "utf8"), "# adulterado\n", "payload não é escrito depois do backup falho");
  });

  it("L1(d2): componente symlinkado DENTRO do backup default também é recusado", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const rel = ".agents/rules/workflow-rules.md";
    writeFileSync(join(target, rel), "# adulterado\n");

    // O nome do dir default é <target>-<ISO com ms>: só é previsível com o
    // relógio fixo. O launcher roda `runUpdate` no MESMO processo com `Date`
    // congelado, então o componente plantado é exatamente o que o run usará.
    const iso = "2026-01-02T03:04:05.678Z";
    const stamp = iso.replace(/[:.]/g, "-");
    const dir = join(backupRoot(target), `${basename(target)}-${stamp}`);
    const outside = join(dirname(target), "backup-default-alheio");
    mkdirSync(join(dir, ".agents"), { recursive: true });
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, join(dir, ".agents/rules"));

    const script = [
      "const RealDate = Date;",
      `const fixed = new RealDate(${JSON.stringify(iso)});`,
      "globalThis.Date = class extends RealDate {",
      "  constructor(...args) { super(...(args.length ? args : [fixed.getTime()])); }",
      "  static now() { return fixed.getTime(); }",
      "};",
      `const { runUpdate } = await import(${JSON.stringify(SYNC)});`,
      // `process.exitCode` (item 16): `process.exit(código)` descarta o stdout
      // pendente do pipe e a linha de recusa — a asserção de texto — se perdia.
      `process.exitCode = runUpdate(${JSON.stringify(target)}, {});`,
    ].join("\n");
    const res = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
    const text = `${res.stdout ?? ""}${res.stderr ?? ""}`;

    assert.equal(res.status, 1, text);
    assert.match(text, /symlink no destino/, text);
    assert.deepEqual(readdirSync(outside), [], "o backup default não atravessa o elo");
    assert.equal(readFileSync(join(target, rel), "utf8"), "# adulterado\n");
    assert.deepEqual(
      walkAll(target).filter((p) => /\.tmp-\d+$/.test(p)),
      [],
      "nenhum temporário sobrou",
    );
  });
});

describe("SYNC-19 — L2: doctor recusa link em COMPONENTE do caminho (SYNC-15(b))", () => {
  it("L2(b): `.agents/rules` → dir externo com bytes IDÊNTICOS ⇒ exit 1", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const outside = join(dirname(target), "regras-espelhadas");
    cpSync(join(target, ".agents/rules"), outside, { recursive: true });
    rmSync(join(target, ".agents/rules"), { recursive: true, force: true });
    symlinkSync(outside, join(target, ".agents/rules"));

    // Pré-condição do ataque: TODO hash do manifesto continua batendo pelo elo.
    const manifest = readJson(join(target, ".harness-manifest.json"));
    const entries = Object.keys(manifest.files).filter((rel) => rel.startsWith(".agents/rules/"));
    assert.ok(entries.length > 0, "o manifesto cobre .agents/rules");
    for (const rel of entries) {
      assert.equal(sha256(readFileSync(join(target, rel))), manifest.files[rel], `hash idêntico pelo elo: ${rel}`);
    }

    const res = sync("doctor", target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /camada é symlink: \.agents\/rules/, "a varredura de camadas usa lstat");
    assert.match(res.out, /symlink no caminho: \.agents\/rules\//, "a entrada do manifesto é recusada antes do hash");
    assert.doesNotMatch(res.out, /sha256 divergente/, "os bytes batem: quem reprova é o tipo do caminho");
  });

  it("L2(b2): camada trocada por symlink para dir VAZIO também reprova (não é 'camada vazia')", () => {
    const target = newTarget();
    assert.equal(init(target).code, 0);
    const outside = join(dirname(target), "schemas-vazio");
    mkdirSync(outside, { recursive: true });
    rmSync(join(target, ".agents/schemas"), { recursive: true, force: true });
    symlinkSync(outside, join(target, ".agents/schemas"));

    const res = sync("doctor", target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /camada é symlink: \.agents\/schemas/);
  });
});

describe("SYNC-20 — L1: `writeGuarded` é a via ÚNICA de escrita (prova na fonte)", () => {
  const SOURCE = join(REPO_ROOT, "scripts/harness-sync.mjs");
  const src = () => readFileSync(SOURCE, "utf8");

  function functionBody(name) {
    const start = src().indexOf(`function ${name}(`);
    assert.ok(start > 0, `função ausente: ${name}`);
    const end = src().indexOf("\n}\n", start) + 3;
    return src().slice(start, end);
  }

  it("writeGuarded compõe guard + mkdir + escrita atômica na MESMA função", () => {
    const body = functionBody("writeGuarded");
    assert.match(body, /assertSafeWrite\(/, "o guard tem de estar DENTRO da via de escrita");
    assert.match(body, /mkdirSync\(/, "a criação do diretório fica depois do guard, nunca no call site");
    assert.match(body, /writeAtomic\(/, "a troca atômica acontece dentro da via de escrita");
  });

  it("writeAtomic é privado: não é exportado e só `writeGuarded` o chama", () => {
    const source = src();
    assert.doesNotMatch(source, /export\s+(?:async\s+)?function\s+writeAtomic/);
    assert.doesNotMatch(source, /export\s*\{[^}]*writeAtomic/);
    const calls = source.match(/\bwriteAtomic\s*\(/g) ?? [];
    // 1 declaração + 1 chamada (dentro de writeGuarded). Um 3º é porta lateral.
    assert.equal(calls.length, 2, `writeAtomic com ${calls.length} ocorrência(s): só a declaração e a chamada de writeGuarded são permitidas`);
    // O laço de backup foi a porta que existia: ele precisa chamar a via única.
    const backupLoop = source.slice(source.indexOf("let backedUp = 0;"), source.indexOf("// Manifest LAST"));
    assert.match(backupLoop, /writeGuarded\(dir, entry\.rel/, "a cópia de backup passa pela via única");
  });

  it("fs.writeFileSync/fs.renameSync só existem dentro de writeAtomic", () => {
    const source = src();
    const start = source.indexOf("function writeAtomic(");
    const end = source.indexOf("\n}\n", start) + 3;
    const outside = `${source.slice(0, start)}${source.slice(end)}`;
    for (const name of ["writeFileSync", "renameSync"]) {
      assert.match(source.slice(start, end), new RegExp(`fs\\.${name}\\(`), `${name} sumiu da escrita atômica`);
      assert.doesNotMatch(outside, new RegExp(`fs\\.${name}\\(`), `${name} chamado fora de writeAtomic: porta lateral`);
    }
  });

  it("os 4 pontos de escrita declaram a via única (payload, config, manifesto, backup)", () => {
    const source = src();
    const sites = source.match(/\bwriteGuarded\s*\(/g) ?? [];
    // 1 definição + payload + backup + manifesto (config e payload usam o mesmo laço).
    assert.ok(sites.length >= 4, `writeGuarded com ${sites.length} ocorrência(s): um site de escrita escapou da via única`);
  });
});

describe("TMP-01 — fixtures não vazam para /tmp", () => {
  it("o escopo remove o que criou", () => {
    const dir = TMP.tmp({ "x.txt": "y" });
    assert.ok(existsSync(dir));
    TMP.cleanup();
    assert.equal(existsSync(dir), false);
  });
});

// --- SYNC-25 / item 16 do review do F3a: o flake da ÚLTIMA linha ------------
// Reproduzido 2× em 22 execuções do glob: os testes que asserem a ÚLTIMA linha
// do stdout de um filho (SYNC-08 órfão, R-1(b) temporário, L1(d) symlink)
// falhavam de forma intermitente, sempre com a linha final ausente e o exit
// code correto. Causa: `process.exit(<código>)` depois de escrever no stdout.
// Com stdout em PIPE a escrita é assíncrona; o exit imediato descarta o que
// ainda estava pendente. `process.exitCode = <código>` deixa o loop drenar e
// preserva o mesmo código de saída.
//
// O pino é DETERMINÍSTICO de duas formas complementares:
//   (a) estrutural — nenhum launcher de `scripts/` pode voltar a usar o exit
//       imediato. Isto falha no instante da regressão, sem depender de carga;
//   (b) comportamental — um filho que escreve mais que o buffer do pipe
//       (≈64 KiB) tem TODAS as linhas, inclusive a última, quando sai por
//       exitCode. A asserção da última linha é a mesma do flake.
describe("SYNC-25 — launchers drenam stdout antes de sair (flake da última linha)", () => {
  // Montado em runtime para este arquivo não acusar a si mesmo.
  const EXIT_CALL = ["process", "exit("].join(".");

  it("nenhum launcher de scripts/ usa exit imediato depois de escrever", () => {
    // Comentários são removidos antes da varredura: as próprias notas do fix
    // citam `process.exit` para explicar o defeito, e citar não é usar.
    const code = (text) =>
      text
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
    const launchers = [
      "scripts/harness-sync.mjs",
      "scripts/static-checks.mjs",
      "scripts/sdd-checks.mjs",
      "scripts/vendor-skills.mjs",
      "scripts/seal.mjs",
    ];
    for (const rel of launchers) {
      const source = readFileSync(join(REPO_ROOT, rel), "utf8");
      assert.equal(
        code(source).includes(EXIT_CALL),
        false,
        `${rel} usa ${EXIT_CALL}<código>: o tail do stdout pode ser descartado no pipe — use process.exitCode`,
      );
    }
  });

  it("nenhum launcher DESTA spec regrediu para exit imediato", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    const semComentarios = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    assert.equal(
      semComentarios.includes(`${EXIT_CALL}runUpdate`),
      false,
      `launcher de teste com ${EXIT_CALL}runUpdate(...): use process.exitCode = runUpdate(...)`,
    );
  });

  it("volume acima do buffer do pipe chega inteiro e o código de saída é preservado", () => {
    const lines = 20_000; // ~200 KiB >> buffer típico de pipe (64 KiB)
    const script = [
      `for (let i = 0; i < ${lines}; i += 1) console.log("linha-" + i);`,
      "process.exitCode = 7;",
    ].join("\n");
    const res = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const got = String(res.stdout ?? "").trimEnd().split("\n");
    assert.equal(res.status, 7, `código de saída preservado; stderr=${res.stderr ?? ""}`);
    assert.equal(got.length, lines, `linhas recebidas=${got.length} (escrita pendente descartada?)`);
    assert.equal(got[got.length - 1], `linha-${lines - 1}`, "a ÚLTIMA linha sobrevive ao pipe");
  });
});

// mkdtemp direto não é usado: todo fixture passa por tempScope (TMP.tmp).
