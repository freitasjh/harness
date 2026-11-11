// checks.mjs — prosa órfã (ADR-005): a rubric de 6 classes como mecanismo.
//
// Contract (SPEC RF-01/RF-03): `runRefsChecks(root)` →
//   { ok: boolean, results: [{ id, status: "PASS"|"FAIL", detail }] }
// com os ids `missing-and-unclassified`, `stale-baseline-entry`,
// `baseline-entry-incomplete`, `nondefect-entry-incomplete`.
//
// A decisão que este arquivo executa é a régua, não a lista de casos: cada
// referência ausente cai numa classe por predicado de PATH, nunca por conteúdo
// nem por data (SPEC I3). As 6 classes da ADR-005 §2.3:
//
//   C1 live-orphan          alvo ausente, citante vivo, sem supressão
//                           → BASELINE (dívida com dono) ou FAIL
//   C2 foreign-baseline     C1 cujo assunto é de eixo que `stack.*` declara N/A
//                           → BASELINE (dívida com dono + reativação)
//   C3 declared-non-defect  citação em NON_DEFECT (reason + proof) → suprimida
//   C4 vendor-internal      todos os citantes em skill do `.vendor-lock.json`
//                           → suprimida (derivada do lock, nunca do prefixo)
//   C5 dated-record         citante fora do corpus vivo → não varrido
//   C6 live-conflict        duas fontes vivas divergem sobre o mesmo sujeito
//                           → NÃO é detectável por esta gramática (declarado
//                           na ADR-005 §2.5: resolve-se na tabela §3-C e na
//                           revisão, não por token)
//
// Gramática do detector — escopo DECLARADO, não implícito (ADR-005 §2.5):
// casa exatamente o predicado do RF-03, `rules/[a-z0-9-]+\.md`. Consequência
// declarada: os 13 paths da tabela A ficam cobertos; os 8 da tabela B
// (`.doc/**`, `.doc/`, `frontend/DESIGN.md`, `AGENTS.md`) ficam classificados
// na ADR e SEM detecção automática até o PRD 2 declarar um segundo regex.
//
// Escopo por PATH DO CITANTE (SPEC RF-04 / I3): vivo = `^(\.agents/|opencode\.json$)`.
// `docs/`, `harness/` e `.spec/` são registro datado — o walker os percorre de
// propósito e o predicado os descarta, para que a exclusão seja provada e não
// apenas presumida por não olhar.
//
// Purity (SPEC I1): `node:fs`/`node:path` read-only; sem rede, sem MCP, sem
// child process, sem gravação. Vive em `.opencode/plugins/lib/**`, caminho que
// o instalador propaga (install.mjs:107) — o destino herda o check, não o
// vermelho (ADR-005 §5-C7).
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, sep } from "node:path";

// --- Gramática ------------------------------------------------------------
// O mesmo predicado do RF-03. `g` é obrigatório: uma linha pode citar N paths.
export const REF_RE = /rules\/[a-z0-9-]+\.md/g;

// Prefixo do corpus vivo — a fronteira é path, não conteúdo (SPEC I3).
export const LIVE_CITER_RE = /^(\.agents\/|opencode\.json$)/;

const SCANNED_ROOTS = [".agents", "docs", "harness", ".spec"];
const SCANNED_FILES = ["opencode.json"];
const SKIPPED_DIRS = new Set(["node_modules", ".git"]);

// --- Classes (ADR-005 §2.3) -----------------------------------------------
export const CLASS_LABELS = Object.freeze({
  C1: "live-orphan",
  C2: "foreign-baseline",
  C3: "declared-non-defect",
  C4: "vendor-internal",
  C5: "dated-record",
  C6: "live-conflict",
});

// A baseline só admite as classes com AÇÃO de dívida declarada. C3/C4 são
// suprimidas por mecanismo (lista com razão / lock) e não ocupam entrada.
export const BASELINE_CLASSES = new Set(["C1", "C2"]);

const OWNER = "prd-harness-inventory";
const PRD = "PRD 2";
const EIXO_NA = "eixo backend declarado N/A em harness.config.json.stack.backend";

// --- Baseline (dívida declarada, nunca permissão — SPEC I2) ---------------
// 7 entradas = as 2 C1 (A2, A7 da ADR-005 §3) + as 5 C2 (A1, A3–A6).
export const BASELINE = Object.freeze([
  {
    path: "rules/security-standard.md",
    class: "C1",
    reason:
      "SSoT de segurança declarada por 3 agentes vivos; alvo é agnóstico ⇒ repoint-or-create no PRD 2",
    owner: OWNER,
    prd: PRD,
  },
  {
    path: "rules/unit-testing-standards.md",
    class: "C1",
    reason:
      "citada só pela skill dev-planner; assunto não casa o predicado de eixo N/A ⇒ repoint-or-create no PRD 2",
    owner: OWNER,
    prd: PRD,
  },
  {
    path: "rules/backend-coding-standards.md",
    class: "C2",
    reason: `${EIXO_NA}; dívida com dono, reativar quando o PRD 3/4 habilitar o eixo`,
    owner: OWNER,
    prd: PRD,
  },
  {
    path: "rules/backend-integration-tests.md",
    class: "C2",
    reason: `${EIXO_NA}; dívida com dono, reativar quando o PRD 3/4 habilitar o eixo`,
    owner: OWNER,
    prd: PRD,
  },
  {
    path: "rules/backend-unit-tests.md",
    class: "C2",
    reason: `${EIXO_NA}; dívida com dono, reativar quando o PRD 3/4 habilitar o eixo`,
    owner: OWNER,
    prd: PRD,
  },
  {
    path: "rules/db-migration-flyway.md",
    class: "C2",
    reason: `${EIXO_NA}; dívida com dono, reativar quando o PRD 3/4 habilitar o eixo`,
    owner: OWNER,
    prd: PRD,
  },
  {
    path: "rules/db-migration-liquibase.md",
    class: "C2",
    reason: `${EIXO_NA}; dívida com dono, reativar quando o PRD 3/4 habilitar o eixo`,
    owner: OWNER,
    prd: PRD,
  },
]);

// --- Declared non-defect (C3) --------------------------------------------
// Lista literal com reason + proof: o detector REPORTARIA esta citação, logo
// ela precisa de registro explícito. `AGENTS.md` NÃO entra aqui: está fora da
// gramática acima (é nome de arquivo do repo-destino, sem prefixo de diretório).
export const NON_DEFECT = Object.freeze([
  {
    path: "rules/exemplo.md",
    reason:
      "string de exemplo em fixture de instalador (chave de `incomingFiles`), não é citação normativa",
    proof: ".agents/skills/harness-installer/SKILL.md:68",
  },
]);

// --- Helpers puros --------------------------------------------------------

export function posixPath(p) {
  return String(p).split(sep).join("/");
}

export function isLiveCiter(relPath) {
  return LIVE_CITER_RE.test(posixPath(relPath));
}

// A referência citada é `rules/<slug>.md`; o alvo no disco mora sob `.agents/`
// (mesmo `test -e ".agents/$p"` da ADR-005 §1).
export function diskPathOf(target) {
  const t = posixPath(target);
  return t.startsWith(".agents/") ? t : `.agents/${t}`;
}

// Entrada sem `class` válida, `owner`, `prd` ou `reason` é FAIL do próprio
// check (ADR-005 §4 item 4) — nunca do revisor.
export function validateBaseline(entries) {
  const issues = [];
  for (const [i, e] of entries.entries()) {
    const label = e && e.path ? e.path : `BASELINE[${i}]`;
    if (!e || typeof e.path !== "string" || e.path.trim() === "") {
      issues.push(`${label}: path ausente`);
    }
    if (!e || !BASELINE_CLASSES.has(e.class)) {
      issues.push(`${label}: class fora de {C1, C2} ("${e ? e.class : ""}")`);
    }
    for (const key of ["reason", "owner", "prd"]) {
      if (!e || typeof e[key] !== "string" || e[key].trim() === "") {
        issues.push(`${label}: ${key} ausente`);
      }
    }
  }
  return issues;
}

// C3: a lista É o registro; entrada sem reason/proof não suprime nada.
export function validateNonDefect(entries) {
  const issues = [];
  for (const [i, e] of entries.entries()) {
    const label = e && e.path ? e.path : `NON_DEFECT[${i}]`;
    if (!e || typeof e.path !== "string" || e.path.trim() === "") {
      issues.push(`${label}: path ausente`);
    }
    for (const key of ["reason", "proof"]) {
      if (!e || typeof e[key] !== "string" || e[key].trim() === "") {
        issues.push(`${label}: ${key} ausente`);
      }
    }
  }
  return issues;
}

// --- Varredura ------------------------------------------------------------

function collectCandidateFiles(root) {
  const out = [];
  for (const rel of SCANNED_FILES) {
    try {
      if (statSync(join(root, rel)).isFile()) out.push(rel);
    } catch {
      // ausente: nada a varrer
    }
  }
  const walk = (relDir) => {
    let entries;
    try {
      entries = readdirSync(join(root, relDir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const rel = `${relDir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) walk(rel);
      } else if (entry.isFile()) {
        out.push(rel);
      }
    }
  };
  for (const rel of SCANNED_ROOTS) walk(rel);
  return out;
}

// Citações dos citantes VIVOS. O registro é varrido e descartado de propósito:
// a exclusão é o predicado (isLiveCiter), provada por fixture.
function collectCitations(root) {
  const byTarget = new Map();
  for (const rel of collectCandidateFiles(root)) {
    if (!isLiveCiter(rel)) continue;
    let text;
    try {
      text = readFileSync(join(root, rel), "utf8");
    } catch {
      continue;
    }
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const hits = lines[i].match(REF_RE) ?? [];
      for (const target of new Set(hits)) {
        if (!byTarget.has(target)) byTarget.set(target, []);
        byTarget.get(target).push({ citer: rel, line: i + 1 });
      }
    }
  }
  return byTarget;
}

// C4 derivada do lock, NUNCA do prefixo do nome (ADR-002/ADR-005 §6).
function readLockSkills(root) {
  try {
    const parsed = JSON.parse(readFileSync(join(root, ".agents", "skills", ".vendor-lock.json"), "utf8"));
    const skills = parsed && parsed.skills;
    return skills && typeof skills === "object" && !Array.isArray(skills)
      ? new Set(Object.keys(skills))
      : new Set();
  } catch {
    // Fail-closed: sem lock não há supressão derivável — a citação vira C1.
    return new Set();
  }
}

const VENDOR_CITER_RE = /^\.agents\/skills\/([^/]+)\//;

function isVendorCiter(citer, lockSkills) {
  const m = VENDOR_CITER_RE.exec(citer);
  return Boolean(m) && lockSkills.has(m[1]);
}

function citeList(cites, limit = 3) {
  const shown = cites.slice(0, limit).map((c) => `${c.citer}:${c.line}`).join(", ");
  return cites.length > limit ? `${shown} (+${cites.length - limit})` : shown;
}

function vacuous(detail) {
  return {
    ok: true,
    results: [
      { id: "missing-and-unclassified", status: "PASS", detail },
      { id: "stale-baseline-entry", status: "PASS", detail },
      { id: "baseline-entry-incomplete", status: "PASS", detail },
      { id: "nondefect-entry-incomplete", status: "PASS", detail },
    ],
  };
}

// --- API ------------------------------------------------------------------

export function runRefsChecks(root = process.cwd()) {
  if (!existsSync(join(root, ".agents"))) {
    return vacuous("N/A — .agents/ ausente (vacuous-safe)");
  }

  const lockSkills = readLockSkills(root);
  const citations = collectCitations(root);
  const baselineByPath = new Map(BASELINE.map((e) => [posixPath(e.path), e]));
  const nonDefectPaths = new Set(NON_DEFECT.map((e) => posixPath(e.path)));

  // Modo (a): referência viva a path ausente FORA da baseline.
  const missing = [];
  for (const [target, cites] of citations) {
    if (existsSync(join(root, diskPathOf(target)))) continue;
    if (baselineByPath.has(target)) continue; // dívida declarada, com dono
    if (nonDefectPaths.has(target)) continue; // C3
    if (cites.every((c) => isVendorCiter(c.citer, lockSkills))) continue; // C4
    missing.push({ target, cites });
  }
  missing.sort((a, b) => a.target.localeCompare(b.target));

  // Modo (b): a classificação apodreceu — o path passou a existir ou perdeu
  // toda citação viva. Baseline que não encolhe nunca é dívida (SPEC E4).
  const stale = [];
  for (const entry of BASELINE) {
    const target = posixPath(entry.path);
    if (existsSync(join(root, diskPathOf(target)))) {
      stale.push(`${target} (o arquivo passou a existir no disco)`);
      continue;
    }
    const cites = citations.get(target) ?? [];
    if (cites.length === 0) stale.push(`${target} (0 citações vivas)`);
  }

  const baselineIssues = validateBaseline(BASELINE);
  const nonDefectIssues = validateNonDefect(NON_DEFECT);

  const results = [
    {
      id: "missing-and-unclassified",
      status: missing.length ? "FAIL" : "PASS",
      detail: missing.length
        ? `${missing.length} path(s) ausente(s) citado(s) por prosa viva fora da BASELINE: `
          + missing.map((m) => `${m.target} ← ${citeList(m.cites)}`).join("; ")
        : `órfãs vivas não classificadas=0 (baseline=${BASELINE.length}, non-defect=${NON_DEFECT.length}, skill(s) no lock=${lockSkills.size})`,
    },
    {
      id: "stale-baseline-entry",
      status: stale.length ? "FAIL" : "PASS",
      detail: stale.length
        ? `BASELINE com ${stale.length} entrada(s) obsoleta(s): ${stale.join("; ")}`
        : `BASELINE com ${BASELINE.length} entrada(s) ainda ausente(s) e citada(s)`,
    },
    {
      id: "baseline-entry-incomplete",
      status: baselineIssues.length ? "FAIL" : "PASS",
      detail: baselineIssues.length
        ? `BASELINE inválida: ${baselineIssues.join("; ")}`
        : `BASELINE com ${BASELINE.length} entradas, todas com class/owner/prd/reason`,
    },
    {
      id: "nondefect-entry-incomplete",
      status: nonDefectIssues.length ? "FAIL" : "PASS",
      detail: nonDefectIssues.length
        ? `NON_DEFECT inválida: ${nonDefectIssues.join("; ")}`
        : `NON_DEFECT com ${NON_DEFECT.length} entrada(s), com reason/proof`,
    },
  ];

  return { ok: results.every((r) => r.status === "PASS"), results };
}

// A ADR-005 §4 item 2 nomeia `runRefChecks`; a SPEC RF-01 nomeia
// `runRefsChecks`. Um alias, uma implementação — nenhuma divergência de contrato.
export function runRefChecks(root = process.cwd()) {
  return runRefsChecks(root);
}
