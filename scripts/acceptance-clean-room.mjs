#!/usr/bin/env node
// acceptance-clean-room.mjs — aceite DETERMINÍSTICO dos mecanismos v2 (F8).
//
// Limite declarado (Q1=A): este repo não tem runner de LLM nem frontend. O que
// se prova aqui é o MECANISMO — gate chamado diretamente, com fixture em tmp,
// both outcomes (deny E allow) — não tela real, não score 7/10, não contraprova
// de verdade. A contraprova real pertence ao GATE de Completed no host; este
// script usa `contraproveExec` stub e diz isso no relatório (selfReported).
//
// Regras: tmp com cleanup, zero rede, zero porta, zero LLM. Exit 0 SÓ se todos
// os cenários passarem; exit 1 nomeia o cenário que falhou. Relatório segue
// `.agents/schemas/harness-report.schema.json` (campos extras são permitidos
// pelo schema e carregam `at`/`scenarios`/a limitação declarada).
//
// A vacuidade é o defeito desta classe: por isso as dependências são
// INJETÁVEIS (`gates`, `validate`, `runPrdChecks`) e `scripts/__tests__/
// acceptance-clean-room.spec.mjs` tampera cada uma delas — um gate no-op tem
// que virar FAIL. `gateCalls` instrumenta as chamadas; um run sem chamadas
// suficientes falha mesmo que todos os cenários digam PASS.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tempScope } from "./test-temp.mjs";
import {
  DenyError,
  DENY_PICCO_ABSENT,
  DENY_HITL,
  DENY_COMPLETED_NO_EVIDENCE,
  DENY_FRONTEND_EVIDENCE,
  DENY_PREV_CYCLE,
  gatePiccoTask,
  gateHitlBatch,
  gateCompletionAnchorA,
  checkAnchorB,
  createHitlTracker,
  clearContraproveCache,
  validateAgainstSchema,
  reportSchemaViolations,
  SCHEMA_SUBSET_KEYWORDS,
} from "../.opencode/plugins/gate.js";
import { sealCommands } from "../.opencode/plugins/lib/seal.mjs";
import { runPrdChecks } from "../.opencode/plugins/lib/prd-adr-pipeline/checks.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const SYNC_SCRIPT = path.join(REPO_ROOT, "scripts", "harness-sync.mjs");
const SCHEMA_PATH = path.join(REPO_ROOT, ".agents", "schemas", "harness-report.schema.json");
const SCHEMA = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
const REPORT_PATH = path.join(REPO_ROOT, "harness", "acceptance-clean-room.json");
const SUITE = "node --test";
const COMMANDS = { suiteFull: SUITE, unit: SUITE };
const TEST_CONFIG = { commands: COMMANDS, protectedPaths: [".opencode/plugins/**", ".agents/rules/**", "harness.config.json"] };
const MIN_GATE_CALLS = 12;
const EXPECTED_SCENARIOS = 14;
const LOGGER = { warn() {}, error() {} };
const OPEN = "<!-- harness:v2:start -->";
const CLOSE = "<!-- harness:v2:end -->";
const OWN_FRONTEND = ".agents/rules/project-frontend.md";
const OWN_BACKEND = ".agents/rules/project-backend.md";

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function detectGitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function validReport(demand = "harness-v2-clean-room") {
  return {
    version: 1,
    demand,
    agent: "backend-engineer",
    phase: "Testing",
    gitSha: detectGitSha(),
    commands: [{ cmd: SUITE, exitCode: 0, durationMs: 1, stdoutHash: sha256(SUITE).slice(0, 16) }],
    counts: {
      unit: { passed: 1, failed: 0, skipped: 0 },
      it: { passed: 0, failed: 0, skipped: 0 },
      frontend: { passed: 0, failed: 0, skipped: 0 },
    },
    evaluation: { telas: "n/a", negocio: "n/a", logica: "fixture de aceite", perf: "n/a" },
    brainStore: [],
    cleanup: { ports: [] },
    selfReported: true,
  };
}

// --- PRD fixture (A2/A3) ----------------------------------------------------
// Forma canônica segundo `prd-adr-pipeline/checks.mjs`: §1/2/5/6/7/9/16 com
// pergunta fechada, §5 com "como medir", §16 com veredito+data, RESEARCH com
// 2 fontes, ADR-INDEX 1:1 com os diretórios, TASKS com marcador de escopo.
const MARK = "> ❓ Validação: confirma?";
const SECTION = (n, title, body) => `## ${n}. ${title}\n${body}\n${MARK}\n`;

function prdFixtureFiles() {
  const prd = [
    "# PRD — fixture clean-room",
    "prd_version: 2",
    "",
    SECTION(1, "Problema", "Mecanismos precisam de aceite executável."),
    SECTION(2, "Objetivo", "Exercitar os gates sem LLM."),
    SECTION(5, "Métricas", "| Métrica | Como medir |\n|---|---|\n| cenários | contagem de PASS |"),
    SECTION(6, "Escopo", "Aceite determinístico."),
    SECTION(7, "NÃO entra", "Tela real e runner de LLM."),
    SECTION(9, "Requisitos", "RF-01: exit 0 só se tudo passar."),
    `## 16. Aprovação\n- Veredito: aprovado\n- Data: 2026-11-18\n${MARK}\n`,
  ].join("\n");
  const files = {
    ".spec/prd/p1/PRD.md": prd,
    ".spec/prd/p1/RESEARCH.md": "# RESEARCH\n\n- Fonte A: https://example.org/a\n- Fonte B: https://example.org/b\n",
  };
  const cols = ["order", "id", "title", "status", "depends_on", "dir", "branch", "merge", "unit"];
  const rows = [
    ["1", "ADR-001", "Base", "merged", "—", "ADRs/ADR-001-base/", "adr/clean-room/01-base", "abc123", "adr"],
    ["2", "ADR-002", "Aceite", "in-progress", "ADR-001", "ADRs/ADR-002-aceite/", "adr/clean-room/02-aceite", "—", "adr"],
  ];
  files[".spec/prd/p1/ADR-INDEX.md"] = [
    `| ${cols.join(" | ")} |`,
    `|${cols.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
  for (const [id, slug] of [["ADR-001", "base"], ["ADR-002", "aceite"]]) {
    const dir = `.spec/prd/p1/ADRs/${id}-${slug}/`;
    files[`${dir}ADR.md`] = `# ${id} — Base\n- **depende-de**: —\n- **Interface congelada**: runPrdCheck\n`;
    files[`${dir}SPEC.md`] = `# SPEC — ${id}\n\n- RF-01: mecanismo exercitado.\n`;
    files[`${dir}TASKS.md`] = `<!-- scope: adr/${id} -->\n\n### F8-01 — aceite\n`;
    if (id === "ADR-001") files[`${dir}VERIFY.md`] = `# VERIFY — ${id}\n\nAPPROVED ✅\n`;
  }
  return files;
}

/**
 * Runs the seven scenarios against injectable dependencies.
 *
 * @param {{log?: (line:string)=>void, reportPath?: string|null,
 *          now?: ()=>string, gitSha?: string, tempRoot?: string,
 *          gates?: object, validate?: Function, runPrd?: Function,
 *          schema?: object}} opts
 */
export async function runAcceptance(opts = {}) {
  const started = Date.now();
  const log = opts.log ?? (() => {});
  const lines = [];
  const emit = (line) => {
    lines.push(line);
    log(line);
  };
  const tempRoot = opts.tempRoot ?? os.tmpdir();
  const scope = tempScope({ label: "harness-accept" });
  const gates = { gatePiccoTask, gateHitlBatch, gateCompletionAnchorA, checkAnchorB, ...(opts.gates ?? {}) };
  const validate = opts.validate ?? validateAgainstSchema;
  const runPrd = opts.runPrd ?? runPrdChecks;
  const schema = opts.schema ?? SCHEMA;
  const gitSha = opts.gitSha ?? detectGitSha();
  const at = opts.now ? opts.now() : new Date().toISOString();
  const scenarios = [];
  let gateCalls = 0;

  // Injetável para anti-vacuidade: um `runSync` no-op tem que virar FAIL nos
  // cenários A8..A13, e uma `suiteFull` trocada tem que virar FAIL em A14.
  const runSync = opts.runSync ?? ((args) =>
    execFileSync(process.execPath, [SYNC_SCRIPT, ...args], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }));
  const attemptSync = (args) => {
    try {
      return { code: 0, out: runSync(args) };
    } catch (err) {
      return { code: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}${err.message ?? ""}` };
    }
  };
  const sync = (args) => {
    const result = attemptSync(args);
    if (result.code !== 0) throw new Error(`sync ${args[0]} saiu ${result.code}: ${result.out}`);
    return result.out;
  };
  const readConfig =
    opts.readConfig ?? (() => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "harness.config.json"), "utf8")));

  async function expectDeny(fn, reason, label) {
    gateCalls += 1;
    let thrown = null;
    try {
      await fn();
    } catch (err) {
      thrown = err;
    }
    if (!thrown) throw new Error(`${label}: gate ALLOWOU; esperado deny ${reason}`);
    if (!(thrown instanceof DenyError)) throw new Error(`${label}: erro inesperado (${thrown?.message})`);
    if (thrown.reason !== reason) throw new Error(`${label}: reason ${thrown.reason} ≠ ${reason}`);
    return thrown;
  }

  async function expectAllow(fn, label) {
    gateCalls += 1;
    try {
      return await fn();
    } catch (err) {
      throw new Error(`${label}: gate negou inesperadamente (${err?.reason ?? err?.message})`);
    }
  }

  async function scenario(name, fn) {
    try {
      const detail = await fn();
      scenarios.push({ name, status: "PASS", detail: detail || "ok" });
      emit(`PASS ${name} ${detail || "ok"}`);
    } catch (err) {
      const detail = err?.message ?? String(err);
      scenarios.push({ name, status: "FAIL", detail });
      emit(`FAIL ${name} ${detail}`);
    }
  }

  // A1 — bootstrap: CLI real do sincronizador + camadas + config + doctor.
  await scenario("A1", async () => {
    const target = scope.tmp({}, { root: tempRoot });
    // ADR-001/I5: sem stack detectada, a flag é obrigatória — o aceite declara
    // a origem explicitamente em vez de inventar `project-fullstack.md`.
    const initOut = sync(["init", "--target", target, "--suite", SUITE, "--frontend", "react"]);
    if (!/^init: \d+ file\(s\) written/m.test(initOut)) throw new Error("init não reportou escrita");
    for (const rel of [
      ".agents/agents", ".agents/rules", ".agents/schemas", ".agents/skills",
      ".opencode/plugins", ".opencode/commands", "scripts/harness-sync.mjs",
      ".agents/rules/always-on.md",
    ]) {
      if (!fs.existsSync(path.join(target, rel))) throw new Error(`camada ausente: ${rel}`);
    }
    const doctorOut = sync(["doctor", "--target", target]);
    if (!/doctor: OK/.test(doctorOut)) throw new Error("doctor não deu OK");
    const cfg = JSON.parse(fs.readFileSync(path.join(target, "harness.config.json"), "utf8"));
    for (const key of ["moduleMap", "gates", "mcp", "contraproveTimeoutMs"]) {
      if (!(key in cfg)) throw new Error(`config sem chave nova: ${key}`);
    }
    if (cfg.commands.suiteFull !== SUITE) throw new Error("suiteFull não preservou --suite");
    const opencode = JSON.parse(fs.readFileSync(path.join(target, "opencode.json"), "utf8"));
    if (!opencode.instructions?.includes?.(".agents/rules/always-on.md")) {
      throw new Error("instructions não aponta always-on");
    }
    return "init+doctor OK; 8 camadas; 4 chaves novas; instructions=always-on";
  });

  // A2 — esteira positiva: PRD v2 + 2 ADRs unit:adr.
  await scenario("A2", async () => {
    const files = prdFixtureFiles();
    const root = scope.tmp(files, { root: tempRoot });
    const report = runPrd(root);
    for (const id of ["PRD-01", "ADR-01", "ADR-02"]) {
      const res = report.results.find((r) => r.id === id);
      if (!res || res.status !== "PASS") throw new Error(`${id}: ${res?.status} ${res?.detail ?? ""}`);
    }
    return "PRD-01/ADR-01/ADR-02 PASS (2 ADRs unit:adr, in-progress+merged)";
  });

  // A3 — negativos da esteira: cada mutação tem que reprovar ADR-01.
  await scenario("A3", async () => {
    const files = prdFixtureFiles();
    const root = scope.tmp(files, { root: tempRoot });
    const prdDir = ".spec/prd/p1";
    const adr2 = `${prdDir}/ADRs/ADR-002-aceite`;
    const check = (expect) => {
      const res = runPrd(root).results.find((r) => r.id === "ADR-01");
      if (res.status !== expect) throw new Error(`ADR-01=${res.status}, esperado ${expect}: ${res.detail}`);
    };
    check("PASS");
    const spec = path.join(root, adr2, "SPEC.md");
    fs.rmSync(spec);
    try {
      check("FAIL");
    } finally {
      fs.writeFileSync(spec, files[`${adr2}/SPEC.md`]);
    }
    const rootTasks = path.join(root, prdDir, "TASKS.md");
    fs.writeFileSync(rootTasks, "<!-- scope: adr/ADR-002 -->\n");
    try {
      check("FAIL");
    } finally {
      fs.rmSync(rootTasks);
    }
    const tasks = path.join(root, adr2, "TASKS.md");
    fs.writeFileSync(tasks, "<!-- scope: adr/ADR-999 -->\n");
    try {
      check("FAIL");
    } finally {
      fs.writeFileSync(tasks, files[`${adr2}/TASKS.md`]);
    }
    check("PASS");
    return "3 mutações reprovadas (SPEC/TASKS raiz/scope); restauração PASS";
  });

  // A4 — PICCO e HITL: deny e allow no gate real.
  await scenario("A4", async () => {
    const absent = {
      tool: "task",
      args: { prompt: "<role>x</role>\n<task>y</task>" },
      logger: LOGGER,
    };
    await expectDeny(() => gates.gatePiccoTask(absent), DENY_PICCO_ABSENT, "picco-absent");
    const empty = {
      tool: "task",
      args: { prompt: "<role>x</role>\n<task>y</task>\n<open_questions></open_questions>" },
      logger: LOGGER,
    };
    await expectAllow(() => gates.gatePiccoTask(empty), "picco-empty");
    const tracker = createHitlTracker();
    const task = () => ({ tool: "task", args: { subagent_type: "backend-engineer" }, hitlTracker: tracker });
    await expectAllow(() => gates.gateHitlBatch(task()), "task-1");
    await expectAllow(() => gates.gateHitlBatch(task()), "task-2");
    await expectDeny(() => gates.gateHitlBatch(task()), DENY_HITL, "task-3");
    tracker.onHumanMessage();
    await expectAllow(() => gates.gateHitlBatch(task()), "task-after-human");
    return "picco-absent/picco-empty + 3º task sem turno nega; turno humano libera";
  });

  // A5 — Completed: relatório, selo, contraprova stub e âncora B.
  await scenario("A5", async () => {
    clearContraproveCache();
    const report = validReport();
    const base = {
      tool: "write",
      args: {
        filePath: "workflow-state.json",
        content: JSON.stringify({ current_phase: "Completed", current_feature: report.demand }),
      },
      sessionAgent: "orchestrator",
      config: TEST_CONFIG,
      logger: LOGGER,
    };
    await expectDeny(
      () => gates.gateCompletionAnchorA({ ...base, report: null }),
      DENY_COMPLETED_NO_EVIDENCE,
      "completed-no-evidence",
    );
    await expectAllow(
      () =>
        gates.gateCompletionAnchorA({
          ...base,
          report,
          demand: report.demand,
          publishedSeal: sealCommands(COMMANDS),
          contraproveExec: async () => ({ exitCode: 0, counts: report.counts }),
          treeHash: "clean-room-a5",
          logger: LOGGER,
        }),
      "completed-ok",
    );
    await expectDeny(
      () =>
        gates.checkAnchorB({
          state: { current_phase: "Execution", harness_status: "passed", code_review_status: "passed" },
          startsNewCycle: true,
        }),
      DENY_PREV_CYCLE,
      "anchor-b-open",
    );
    await expectAllow(
      () =>
        gates.checkAnchorB({
          state: { current_phase: "Completed", harness_status: "passed", code_review_status: "passed" },
          startsNewCycle: true,
        }),
      "anchor-b-closed",
    );
    return "completed-no-evidence/ok (selo+stub) + âncora B aberta/fechada";
  });

  // A6 — FRONT condicional ao alvo, não ao relatório.
  await scenario("A6", async () => {
    clearContraproveCache();
    const feConfig = { ...TEST_CONFIG, targets: { frontend: "react" } };
    const base = {
      tool: "write",
      args: {
        filePath: "workflow-state.json",
        content: JSON.stringify({ current_phase: "Completed" }),
      },
      sessionAgent: "orchestrator",
      config: feConfig,
      logger: LOGGER,
      publishedSeal: sealCommands(COMMANDS),
      contraproveExec: async () => ({ exitCode: 0, counts: null }),
      treeHash: "clean-room-a6",
    };
    const without = validReport();
    await expectDeny(
      () => gates.gateCompletionAnchorA({ ...base, report: without, demand: without.demand }),
      DENY_FRONTEND_EVIDENCE,
      "frontend-missing",
    );
    const withEvidence = {
      ...validReport(),
      frontend_evidence: {
        stories: ["Button.stories.tsx"],
        screenshots: ["button-1280.png"],
        a11y: { violations: 0 },
      },
    };
    await expectAllow(
      () => gates.gateCompletionAnchorA({ ...base, report: withEvidence, demand: withEvidence.demand }),
      "frontend-valid",
    );
    return "targets.frontend=react exige stories/screenshots/a11y; ausente nega, válido permite";
  });

  // A7 — schema do relatório com o subset de keywords + mutation.
  await scenario("A7", async () => {
    const report = validReport();
    if (validate(report, schema).length) throw new Error("relatório válido reprovado");
    if (reportSchemaViolations(report, schema).length) throw new Error("wrapper reprovou relatório válido");
    const mutated = { ...report };
    delete mutated.brainStore;
    const violations = validate(mutated, schema);
    if (!violations.some((v) => v.keyword === "required" && v.missing === "brainStore")) {
      throw new Error("mutation brainStore não foi detectada");
    }
    if (!SCHEMA_SUBSET_KEYWORDS.includes("minItems")) throw new Error("subset de keywords incompleto");
    return "schema válido; remover brainStore ⇒ required FAIL; subset declarado";
  });

  // --- ADR-001 / PRD §10 — identidade do init (A8..A14) --------------------
  const identityLines = (out) =>
    out
      .split("\n")
      .filter((line) =>
        /^(harness-sync (init|update): (stack |plano |.{3,} (created|appended|preserved|skip|divergent|malformed)$)|WARN divergência |ERROR seção malformada )/.test(line));
  const initFixture = () => ({
    "package.json": JSON.stringify({ dependencies: { react: "^18" }, scripts: { test: SUITE } }),
  });

  // A8 — fixture sem AGENTS.md: três artefatos created, origem detectada.
  // MS-1 é PARCIAL: I8 defere o perfil de tokens a ADR nova, então nenhum
  // tokens/*.json é gerado — declarar a pendência, não inventar perfil.
  await scenario("A8", async () => {
    const target = scope.tmp(initFixture(), { root: tempRoot });
    const out = sync(["init", "--target", target, "--suite", SUITE]);
    for (const rel of ["AGENTS.md", "DESIGN.md", OWN_FRONTEND]) {
      if (!fs.existsSync(path.join(target, rel))) throw new Error(`artefato ausente: ${rel}`);
      if (!out.includes(`harness-sync init: ${rel} created`)) throw new Error(`${rel} não reportado como created`);
    }
    if (!out.includes("harness-sync init: stack origem=detectada frontend=react backend=null")) {
      throw new Error("origem da stack não reportada");
    }
    const files = JSON.parse(fs.readFileSync(path.join(target, ".harness-manifest.json"), "utf8")).files;
    if (!(OWN_FRONTEND in files)) throw new Error("PRÓPRIO fora do manifesto");
    for (const rel of ["AGENTS.md", "DESIGN.md"]) {
      if (rel in files) throw new Error(`ANEXADO no manifesto: ${rel}`);
    }
    // I8: gerar tokens sem decidir perfil (shadcn/claude) seria palpite — o
    // gerador não escolhe; a ausência do diretório é a prova da pendência.
    if (fs.existsSync(path.join(target, "tokens"))) {
      throw new Error("tokens/ gerado sem ADR de perfil (violação de I8)");
    }
    return "3 artefatos created; MS-1 parcial: tokens pendente (I8 — ADR de perfil)";
  });

  // A9 — 2ª execução: 0 writes, manifesto byte-igual, nenhum backup novo.
  await scenario("A9", async () => {
    const target = scope.tmp(initFixture(), { root: tempRoot });
    sync(["init", "--target", target, "--suite", SUITE]);
    const manifest = path.join(target, ".harness-manifest.json");
    const before = fs.readFileSync(manifest);
    const second = attemptSync(["update", "--target", target]);
    if (second.code !== 0) throw new Error(`2ª execução saiu ${second.code}: ${second.out}`);
    if (!/update: 0 file\(s\) written/.test(second.out)) throw new Error("2ª execução escreveu");
    if (!before.equals(fs.readFileSync(manifest))) throw new Error("manifesto mudou na 2ª execução");
    return "2ª execução = 0 writes; manifesto byte-igual";
  });

  // A10 — anexados pré-existentes: original byte-idêntico como prefixo + 1 par.
  await scenario("A10", async () => {
    const agents = "# AGENTS do time\n\nRegra própria, sem tocar.\n";
    const design = "# DESIGN do time\n";
    const target = scope.tmp(
      { ...initFixture(), "AGENTS.md": agents, "DESIGN.md": design },
      { root: tempRoot },
    );
    const out = sync(["init", "--target", target, "--suite", SUITE]);
    for (const [rel, original] of [["AGENTS.md", agents], ["DESIGN.md", design]]) {
      const after = fs.readFileSync(path.join(target, rel), "utf8");
      if (!after.startsWith(original)) throw new Error(`prefixo alterado: ${rel}`);
      if (after.split(OPEN).length - 1 !== 1 || after.split(CLOSE).length - 1 !== 1) {
        throw new Error(`par de marcadores não é 1+1: ${rel}`);
      }
      if (!out.includes(`harness-sync init: ${rel} appended`)) throw new Error(`${rel} não reportado como appended`);
    }
    return "AGENTS.md/DESIGN.md byte-idênticos no prefixo; 1 par start/end cada";
  });

  // A11 — project-backend.md do maintainer: preserved, zero byte, doctor 0.
  await scenario("A11", async () => {
    const own = "# backend do maintainer\n";
    const target = scope.tmp(
      { "pom.xml": "<project/>", [OWN_BACKEND]: own },
      { root: tempRoot },
    );
    const out = sync(["init", "--target", target]);
    if (fs.readFileSync(path.join(target, OWN_BACKEND), "utf8") !== own) throw new Error("PRÓPRIO sobrescrito");
    if (!out.includes(`harness-sync init: ${OWN_BACKEND} preserved`)) throw new Error("preserved não reportado");
    const doctorOut = sync(["doctor", "--target", target]);
    if (!/doctor: OK/.test(doctorOut)) throw new Error(`doctor reprovou: ${doctorOut}`);
    return "project-backend.md preserved; byte-idêntico; doctor OK";
  });

  // A12 — recompute do doctor: PRÓPRIO corrompido/symlinkado FAIL com path.
  await scenario("A12", async () => {
    const target = scope.tmp(initFixture(), { root: tempRoot });
    sync(["init", "--target", target, "--suite", SUITE]);
    const own = path.join(target, OWN_FRONTEND);
    const original = fs.readFileSync(own);
    fs.writeFileSync(own, `${original.toString("utf8")}\nX`);
    let bad = attemptSync(["doctor", "--target", target]);
    if (bad.code !== 1 || !bad.out.includes(`sha256 divergente do manifesto: ${OWN_FRONTEND}`)) {
      throw new Error(`corrupção não detectada: ${bad.out}`);
    }
    fs.writeFileSync(own, original);
    const outside = path.join(tempRoot, "fora-do-target.md");
    fs.writeFileSync(outside, "INTOCADO\n");
    fs.rmSync(own);
    fs.symlinkSync(outside, own);
    bad = attemptSync(["doctor", "--target", target]);
    if (bad.code !== 1 || !bad.out.includes(`arquivo do manifesto é symlink: ${OWN_FRONTEND}`)) {
      throw new Error(`symlink não detectado: ${bad.out}`);
    }
    if (fs.readFileSync(outside, "utf8") !== "INTOCADO\n") throw new Error("arquivo externo alterado");
    return "doctor FAIL em sha divergente e em symlink, com o path";
  });

  // A13 — --dry-run imprime as mesmas linhas I6 do apply, sem escrever.
  await scenario("A13", async () => {
    const dryTarget = scope.tmp({ ...initFixture(), "AGENTS.md": "# time\n" }, { root: tempRoot });
    const applyTarget = scope.tmp({ ...initFixture(), "AGENTS.md": "# time\n" }, { root: tempRoot });
    const dry = sync(["init", "--target", dryTarget, "--suite", SUITE, "--dry-run"]);
    const applied = sync(["init", "--target", applyTarget, "--suite", SUITE]);
    const a = identityLines(dry);
    const b = identityLines(applied);
    if (a.length === 0 || JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error(`plano ≠ apply: ${JSON.stringify(a)} / ${JSON.stringify(b)}`);
    }
    if (fs.existsSync(path.join(dryTarget, OWN_FRONTEND)) || fs.existsSync(path.join(dryTarget, "AGENTS.md.backup"))) {
      throw new Error("dry-run escreveu no alvo");
    }
    if (fs.readFileSync(path.join(dryTarget, "AGENTS.md"), "utf8") !== "# time\n") {
      throw new Error("dry-run alterou anexado pré-existente");
    }
    return "dry-run = apply nas linhas I6; zero escrita no dry-run";
  });

  // A14 — a contraprova continua sendo a auto-suite do destino (NFR-03).
  await scenario("A14", async () => {
    const cfg = readConfig();
    const suite = cfg?.commands?.suiteFull;
    if (typeof suite !== "string" || !suite.includes('scripts/__tests__/*.spec.mjs')) {
      throw new Error("suiteFull não inclui a suíte de scripts");
    }
    if (!suite.includes("node scripts/static-checks.mjs")) throw new Error("suiteFull não inclui static-checks");
    if (suite.includes("acceptance-clean-room.mjs")) throw new Error("suiteFull foi trocada pelo aceite");
    return "suiteFull inalterada: contraprova é a auto-suite, não o aceite";
  });

  let removed = [];
  try {
    // cleanup cobre o caminho de erro: o registro é removido mesmo se um
    // cenário tiver lançado. Os cenários já trataram seus próprios erros.
    removed = scope.cleanup();
  } finally {
    if (removed.length === 0) removed = scope.cleanup();
  }

  // A instrumentação só ataca o caso perigoso: TUDO verde sem gate chamado.
  // Quando um cenário já falhou, ele nomeia o defeito — A0 só acrescentaria
  // ruído (e um gate no-op aborta o cenário antes das chamadas seguintes).
  const allScenariosPass = scenarios.length === EXPECTED_SCENARIOS && scenarios.every((s) => s.status === "PASS");
  if (allScenariosPass && gateCalls < MIN_GATE_CALLS) {
    const detail = `instrumentação: ${gateCalls} chamada(s) de gate, mínimo ${MIN_GATE_CALLS}`;
    scenarios.push({ name: "A0-instrumentation", status: "FAIL", detail });
    emit(`FAIL A0-instrumentation ${detail}`);
  }
  const ok = scenarios.length === EXPECTED_SCENARIOS && scenarios.every((s) => s.status === "PASS");
  const passed = scenarios.filter((s) => s.status === "PASS").length;
  const failed = scenarios.length - passed;
  const exitCode = ok ? 0 : 1;
  const report = {
    version: 1,
    demand: "harness-v2-clean-room",
    agent: "backend-engineer",
    phase: "Testing",
    gitSha,
    at,
    commands: [
      {
        cmd: "node scripts/acceptance-clean-room.mjs",
        exitCode,
        durationMs: Date.now() - started,
        stdoutHash: sha256(lines.join("\n")),
      },
    ],
    counts: {
      unit: { passed, failed, skipped: 0 },
      it: { passed: 0, failed: 0, skipped: 0 },
      frontend: { passed: 0, failed: 0, skipped: 0 },
    },
    countsNote: "counts.unit conta os CENÁRIOS de aceite, não a suíte node --test (rodada separada pelo CI)",
    evaluation: {
      telas: "fora de escopo: sem frontend neste repo",
      negocio: "fora de escopo: sem alvo RBAC/tenant",
      logica: "A1..A7 exercitam os gates/checks; A8..A14 exercitam a identidade do init via CLI real",
      perf: `sem medição de UI; duração do aceite ${Date.now() - started}ms`,
    },
    brainStore: [],
    brainStoreNote: "nota de sessão registrada pelo agente fora deste script (Q1=A: sem LLM)",
    cleanup: { ports: [], processes: [], tempDirs: removed.length, tempDirPaths: removed },
    selfReported: true,
    selfReportedNote:
      "mecanismos exercitados por chamada direta; sem LLM/UI real; contraprova é o gate, não o script",
    scenarios,
    gateCalls,
    debts: {
      D3: "resolvido pelo orquestrador em .spec/: citações em docs são por símbolo/seção, nunca por linha",
      SEARCH05: "resolvido pelo orquestrador em .spec/: V6 do prompt-optimizer asserta tipo transitório",
      MS_1:
        "parcial: tokens/*.json pendente por I8 (perfil shadcn/claude deferido a ADR nova); ver .spec/prd/prd-init-project-scaffold/ADRs/ADR-001-managed-section-scaffold/TECH-DEBT-tokens.md",
    },
  };
  if (opts.reportPath !== null) {
    const dest = opts.reportPath ?? REPORT_PATH;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, `${JSON.stringify(report, null, 2)}\n`);
  }
  emit(`ACEITE ${ok ? "GREEN" : "RED"}: ${passed}/${scenarios.length} cenário(s) PASS`);
  return { ok, exitCode, scenarios, report };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runAcceptance({ log: (line) => console.log(line) });
  process.exitCode = result.exitCode;
}
