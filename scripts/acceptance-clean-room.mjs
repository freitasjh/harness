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
const LOGGER = { warn() {}, error() {} };

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
    const run = (args) =>
      execFileSync(process.execPath, [SYNC_SCRIPT, ...args], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    const initOut = run(["init", "--target", target, "--suite", SUITE]);
    if (!/^init: \d+ file\(s\) written/m.test(initOut)) throw new Error("init não reportou escrita");
    for (const rel of [
      ".agents/agents", ".agents/rules", ".agents/schemas", ".agents/skills",
      ".opencode/plugins", ".opencode/commands", "scripts/harness-sync.mjs",
      ".agents/rules/always-on.md",
    ]) {
      if (!fs.existsSync(path.join(target, rel))) throw new Error(`camada ausente: ${rel}`);
    }
    const doctorOut = run(["doctor", "--target", target]);
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
  const allScenariosPass = scenarios.length === 7 && scenarios.every((s) => s.status === "PASS");
  if (allScenariosPass && gateCalls < MIN_GATE_CALLS) {
    const detail = `instrumentação: ${gateCalls} chamada(s) de gate, mínimo ${MIN_GATE_CALLS}`;
    scenarios.push({ name: "A0-instrumentation", status: "FAIL", detail });
    emit(`FAIL A0-instrumentation ${detail}`);
  }
  const ok = scenarios.length === 7 && scenarios.every((s) => s.status === "PASS");
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
      logica: "A1..A7 exercitam os mecanismos por chamada direta aos gates/checks",
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
