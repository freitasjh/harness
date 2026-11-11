// static-checks.mjs — static verification gates (TST-02).
// Runs locally and in CI with the same result:
//   node scripts/static-checks.mjs
// Exit 0 = all blocking checks green. Exit 1 = at least one FAIL.
//
// Scope: V2/V3/V7 scan the files owned by Batch 2 (config, schema,
// config doc, lib, opencode.json). Tooling itself (scripts/, __tests__/)
// is excluded — it necessarily names the forbidden patterns as test data.
// Legacy ledger (FIX-01 done, baseline 0): any residual hits in the
// pre-existing plugins are reported as INFO for history, never as green.
// V12 is INFO until the rules diet lands (owner DOC-02, Batch 5/6).
// V14 FAILs honestly while no git remote exists (REMOTE_URL_PENDING).
// V18 (ADR-005) FAILs on live prose citing a missing `rules/*.md` that is not
// declared in the `BASELINE` of `.opencode/plugins/lib/refs/checks.mjs`, and on
// a baseline entry that went stale. Pure core, no new command in the seal.
// V19 (ADR-004) registers the canonical inventory: the pure core
// (`.opencode/plugins/lib/inventory/checks.mjs`) derives classes from disk and
// from the roster REGISTRY, and the owner-decision registry expires. It is the
// first check that looks at the ARTIFACT (does it have a class and an owner?)
// instead of at the REFERENCE (does this prose point to something missing?) —
// V18 and V19 are orthogonal, neither replaces the other. `common` lists from
// the installer are read for closure only: they never confer a class.
// V20 (ADR-001) registers the Clean Destination Criterion: the 4-verdict rubric
// per line, over a population derived by command (D7), with vocabulary whose
// keys come from the installer axes and whose coverage is owed. The debt it
// finds lives in the literal BASELINE (with owner + sha256) and can only
// shrink; prohibitions citing technology are COUNTERS (`prohibition-cited`),
// not verdicts (D2). It never reads V18/V19 output — the `axis-decl` ×
// `axis-class` divergence is published side by side, never treated as failure.
// No new command in the seal for V18, V19 or V20: the adapters ride the
// existing `suiteFull`.
import { readFileSync, existsSync, readdirSync, statSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  loadHarnessConfig,
  resolveCommand,
  configGatesDisableEnforcement,
  DEFAULT_CONFIG_PATH,
  REPO_ROOT,
} from "../.opencode/plugins/lib/config.mjs";
// PRD→ADR→SDD pipeline checks (PAP-04). The core is the module at
// `.opencode/plugins/lib/prd-adr-pipeline/` (ADR-002), a path the installer
// propagates; this file is just the adapter that registers the result in the
// same report the sealed `commands.suiteFull` already runs — the command itself
// is NOT touched.
import { runPrdChecks } from "../.opencode/plugins/lib/prd-adr-pipeline/checks.mjs";
// Prosa órfã (ADR-005): the rubric is the module; V18 below only registers it.
import {
  runRefsChecks,
  BASELINE as REFS_BASELINE,
  NON_DEFECT as REFS_NON_DEFECT,
} from "../.opencode/plugins/lib/refs/checks.mjs";
// Inventário canônico (ADR-004): the module derives the classes; V19 below only
// registers the verdict. The axis/common structures are the OWNER's exported
// bindings — this adapter IMPORTS them (`installer/install.mjs` is a module, not
// a file to be parsed) and injects them; the module never copies them
// (ADR-004 §4-C2), so a second registry of the same decision cannot rot. The
// installer CLI is guarded by `import.meta.url === file://argv[1]`
// (`install.mjs:2746`), so importing the module does not run the CLI.
import { runInventoryChecks } from "../.opencode/plugins/lib/inventory/checks.mjs";
// Critério do Destino Limpo (ADR-001): a rubrica de 4 vereditos é o módulo; o
// V20 abaixo só registra o veredito. O módulo NÃO importa `installer/` (C5 do
// review): `installer/` não propaga, logo o import relativo morreria no destino
// com `ERR_MODULE_NOT_FOUND`. Aqui — o adapter, que roda NESTE repo — os
// exports do instalador são importados e INJETADOS em `exports`. Sem injeção o
// módulo degrada para vocabulário vazio + `cdl-axis-vocabulary-missing`
// (fail-closed, nunca verde). O par `axis-decl`/`axis-class` é publicado junto:
// são duas leituras diferentes do mesmo assunto, e esconder uma seria o defeito
// (ADR-001 §2.4). `axis-class` vem do inventário JÁ calculado acima e é
// INJETADO como contador — o módulo não lê nem nomeia a saída do V19.
import { runCdlChecks } from "../.opencode/plugins/lib/cdl/checks.mjs";
import {
  AXIS_IDS,
  SKILLS_BY_AXIS,
  SKILLS_COMMON,
  RULES_BY_AXIS,
  RULES_COMMON,
  STACKS_FOR_EXCEPTIONS,
} from "../installer/install.mjs";

// Fonte de eixo do V20 — a declaração do instalador, injetada. É o único
// caminho pelo qual o módulo conhece eixos: ele não importa `installer/`.
const CDL_EXPORTS = Object.freeze({
  AXIS_IDS,
  RULES_BY_AXIS,
  RULES_COMMON,
  SKILLS_BY_AXIS,
  SKILLS_COMMON,
  STACKS_FOR_EXCEPTIONS,
});

// Re-exported so the tested loader interface stays stable after the
// Batch 3/7 relocation (GATE-01/FIX-01 scope). Canonical home is
// .opencode/plugins/lib/config.mjs; gate.js consumes it from there.
export {
  loadHarnessConfig,
  resolveCommand,
  configGatesDisableEnforcement,
  DEFAULT_CONFIG_PATH,
  REPO_ROOT,
};

// The installer OWNS the axis/common declarations; this adapter imports the
// owner's exported bindings and injects them (ADR-004 §4-C2). `common` is passed
// for observability — it never confers a class, so adding a name to
// `SKILLS_COMMON` cannot buy an exemption.
const INVENTORY_DECLARATIONS = Object.freeze({
  skillCommon: SKILLS_COMMON,
  skillAxis: SKILLS_BY_AXIS,
  ruleCommon: RULES_COMMON,
  ruleAxis: RULES_BY_AXIS,
});

// --- File collection -------------------------------------------------------
const SCAN_FILES = [
  "harness.config.json",
  "opencode.json",
  ".agents/rules/harness-config.md",
];
const SCAN_DIRS = [".agents/schemas", ".opencode/plugins/lib"];

function collectFiles() {
  const out = [];
  for (const f of SCAN_FILES) {
    const p = join(REPO_ROOT, f);
    if (existsSync(p)) out.push(p);
  }
  for (const d of SCAN_DIRS) {
    const root = join(REPO_ROOT, d);
    if (!existsSync(root)) continue;
    const walk = (dir) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walk(p);
        else out.push(p);
      }
    };
    walk(root);
  }
  return out;
}

function countMatches(files, pattern) {
  const hits = [];
  for (const f of files) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${f.replace(REPO_ROOT + "/", "")}:${i + 1}`);
    });
  }
  return hits;
}

// --- V15: rede proibida em installer/ (V15/rede-installer) ----------------
// Rótulo canônico V15/rede-installer. NÃO usar "I8": no gate-contract.md
// (doc global) I8 = "DenyError ⇒ deny"; o I8 do spec da feature
// (harness-installer-mobile) significava "install.mjs não faz rede" —
// rótulo ambíguo/órfão (review FU-31 MF-1, higiene DOC-01). A linha de
// gate publicada vive no gate-contract.md (orchestrator); garantia 🟠.
//
// install.mjs e o caminho de instalacao: rede-zero. Rede so pode existir
// source-side (scripts/vendor-skills.mjs, ADR-009), nunca aqui.
//
// FU-31: lista FECHADA e documentada de padrões (a classe, não só o
// literal fetch(/node:http/node:https). Varredura é linha-inteira, sem
// exclusão de comentário — semântica herdada do V15 original (menção em
// comentário/prosa também bate; intencional, não é escape).
//
// Cobertura declarada:
//   builtin-net-import    node:(http|https|net|dns|dgram|http2|tls) e sem
//                         prefixo node:, via from / import() / require() /
//                         side-effect import "x" (FU-31 review MF-2, escape
//                         E5 fechado)
//   http-lib-import       axios|got|undici|node-fetch|cross-fetch|
//                         isomorphic-fetch|superagent|ky|request|ws,
//                         ancorado em specifier de import/require/side-effect
//                         — NUNCA palavra solta ("got ${ver}" é menção legítima)
//   fetch                 fetch( em qualquer posição
//   new-WebSocket         new WebSocket (global), incl. new globalThis.WebSocket
//   new-XMLHttpRequest    new XMLHttpRequest (global)
//   net-cmd-download      curl|wget (instalador não baixa nada)
//   net-git-cmd           string-única: git [flag+arg]{0,4} (clone|fetch|
//                         pull|push|ls-remote) — flags antes do subcomando
//                         cobertas (FU-31 review MF-3, escape E6 fechado).
//                         Grupo BOUNDED {0,4}: sem limite superior havia
//                         ReDoS catastrófico (linha com muitas flags sem
//                         subcomando travava o scan >120s — medida em
//                         2026-10-09, node v26; FU-31 review RE-1). Contrato
//                         de velocidade: linha patológica de 200+ chars
//                         fecha em <50ms (teste em network.spec.mjs).
//                         Limite declarado: >4 pares flag+arg antes do
//                         subcomando não casa.
//   net-git-cmd-array     array de child_process: subcomando quotado em
//                         qualquer posição do array (ex.: ["-C", repo,
//                         "clone", url]); git status/rev-parse/cp/
//                         node --test seguem permitidos. Grupo BOUNDED
//                         {0,200} no trecho antes do subcomando: sem
//                         limite havia ReDoS — linha com array enorme ou
//                         muitos prefixos git", [ custa O(n)..O(n²)
//                         (medido 2026-10-09, node v26: forma multi-
//                         ocorrência 64k chars = 305ms; contrato <50ms
//                         violado). Contrato de velocidade: linha
//                         patológica array fecha em <50ms (teste em
//                         network.spec.mjs).
//                         Limite declarado: elemento de array além de 200
//                         chars antes do subcomando não casa.
//   net-pkg-cmd           npm|pnpm|yarn|bun [flag+arg]{0,4} (install|ci|i|add)
//                         na string-única — mesmo bound {0,4} anti-ReDoS
//   net-pkg-cmd-array     idem via array de child_process — mesmo bound
//                         {0,200} e mesmo limite declarado do
//                         net-git-cmd-array
//   net-npx-cmd           npx (baixa pacote sob demanda — perfil mobile).
//                         Fronteira (?<![-\w]): my-npx/bin-npx (substring)
//                         não é falso-positivo (FU-31 review 🟡 alinhado)
//   net-pub-cmd           flutter|dart pub (get|add|upgrade) (perfil mobile)
//
// Escapes DECLARADOS (V15/rede-installer permanece 🟠 parcial enquanto existirem):
//   E1. child_process com comando em VARIÁVEL — ex.
//       installer/dogfood-mobile.mjs runCommand(cmd) => execFileSync(cmd,
//       {shell:'/bin/sh'}); cmd vem do flag --suite-command ou de
//       commands.suiteFull do harness.config.json do próprio INSTALLER_ROOT
//       (repo harness), resolvido em runtime. Scan estático não vê o valor.
//       O instalador em si (install.mjs) não faz rede própria.
//   E2. global de rede via alias (const W = WebSocket; new W(...)) ou alias
//       de fetch (const f = fetch; f(url)) — só a forma literal casa.
//   E3. specifier construído dinamicamente (import(modName)) ou sem espaço
//       (import"axios").
//   E4. builtins internos não listados (ex.: node:_http_agent).
//   E5. array-form: subcomando bate como elemento quotado em qualquer
//       posição — FP residual quando a palavra é argumento
//       (ex.: ["run", "install"]).
//   E6. comandos de rede fora da lista fechada (git remote add,
//       git submodule update, pip, cargo, deno, go get...).
//   E7. padrão dividido entre linhas escapa — scanNetworkRefs é
//       linha-a-linha, então import\n "node:https"; , fetch\n("http://x")
//       e execSync("git\n clone ...") não batem. DECLARADO (FU-31 review
//       ES-1): NÃO caçado — expandir regex para multi-linha custaria
//       backtracking/ReDoS de volta (lição RE-1) por benefício pequeno.
//   E8. alias de require escapa — createRequire(import.meta.url)("axios")
//       ou const rq = require; rq("got") não batem (só a forma literal
//       require("x") casa). DECLARADO (FU-31 review ES-2): NÃO caçado.
//   E9. npx só na forma string-única — execFileSync("npx", ["pkg"])
//       (array-form) escapa; só npx <arg> em string casa. DECLARADO
//       (FU-31 rodada final D-2): NÃO caçado.
// FP residual anotado (FU-31 rodada final D-3): net-npx-cmd casa
//       "npx --version" (só imprime versão, não baixa). Fronteira não
//       distingue flag de pacote — declarado, NÃO caçado: excluir flags
//       quebraria casos legítimos de download (npx -y pkg baixa).
const NETWORK_PATTERNS = [
  {
    pattern: "builtin-net-import",
    re: /(?:from\s*|import\s*\(\s*|import\s+|require\s*\(\s*)['"](?:node:)?(?:https?|net|dns|dgram|http2|tls)['"]/,
  },
  {
    pattern: "http-lib-import",
    re: /(?:from\s*|import\s*\(\s*|import\s+|require\s*\(\s*)['"](?:axios|got|undici|node-fetch|cross-fetch|isomorphic-fetch|superagent|ky|request|ws)['"]/,
  },
  { pattern: "fetch", re: /\bfetch\s*\(/ },
  { pattern: "new-WebSocket", re: /\bnew\s+(?:globalThis\.)?WebSocket\b/ },
  { pattern: "new-XMLHttpRequest", re: /\bnew\s+(?:globalThis\.)?XMLHttpRequest\b/ },
  { pattern: "net-cmd-download", re: /\b(?:curl|wget)\b/ },
  {
    pattern: "net-git-cmd",
    re: /\bgit\s+(?:-\S+(?:\s+[^\s|;&]+)?\s+){0,4}(?:clone|fetch|pull|push|ls-remote)\b/,
  },
  {
    pattern: "net-git-cmd-array",
    re: /\bgit['"]\s*,\s*\[[^\]]{0,200}['"](?:clone|fetch|pull|push|ls-remote)['"]/,
  },
  {
    pattern: "net-pkg-cmd",
    re: /\b(?:npm|pnpm|yarn|bun)\s+(?:--?\S+(?:\s+[^\s|;&]+)?\s+){0,4}(?:install|ci|i|add)\b/,
  },
  {
    pattern: "net-pkg-cmd-array",
    re: /\b(?:npm|pnpm|yarn|bun)['"]\s*,\s*\[[^\]]{0,200}['"](?:install|ci|i|add)['"]/,
  },
  { pattern: "net-npx-cmd", re: /(?<![-\w])npx\s+\S/ },
  {
    pattern: "net-pub-cmd",
    re: /\b(?:flutter|dart)\s+pub\s+(?:get|add|upgrade)\b/,
  },
];

function networkFiles(root) {
  const files = [];
  if (!existsSync(root)) return files;
  const walk = (dir) => {
    if (dir.includes("__tests__") || dir.includes("node_modules")) return;
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) walk(p);
      else if (/\.(mjs|js|cjs)$/.test(entry)) files.push(p);
    }
  };
  walk(root);
  return files;
}

export function scanNetworkRefs(root) {
  const hits = [];
  for (const f of networkFiles(root)) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const { pattern, re } of NETWORK_PATTERNS) {
        if (re.test(line)) hits.push({ file: f, line: i + 1, pattern });
      }
    });
  }
  return hits;
}

export function networkCheck(root) {
  const hits = scanNetworkRefs(root);
  return { ok: hits.length === 0, hits };
}

// --- Checks ----------------------------------------------------------------
const results = [];
function record(id, status, detail) {
  results.push({ id, status, detail });
  console.log(`${status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : "INFO"} ${id}: ${detail}`);
}

function checkV6() {
  try {
    loadHarnessConfig(DEFAULT_CONFIG_PATH);
    record("V6", "PASS", "harness.config.json: valid JSON");
  } catch (e) {
    record("V6", "FAIL", e.message);
  }
  const schemaPath = join(REPO_ROOT, ".agents", "schemas", "harness-report.schema.json");
  try {
    JSON.parse(readFileSync(schemaPath, "utf8"));
    record("V6b", "PASS", "harness-report.schema.json: valid JSON");
  } catch (e) {
    record("V6b", "FAIL", `schema invalid: ${e.message}`);
  }
}

function checkV2V3V7() {
  const files = collectFiles();
  const ask = countMatches(files, /permission\.ask/);
  record("V2", ask.length === 0 ? "PASS" : "FAIL", `permission.ask=${ask.length}` + (ask.length ? ` at ${ask.join(", ")}` : ""));
  const hard = countMatches(files, /docker-compose-postgresql|-pl application/);
  record("V3", hard.length === 0 ? "PASS" : "FAIL", `hardcoded-project-literals=${hard.length}` + (hard.length ? ` at ${hard.join(", ")}` : ""));
  const scalar = countMatches(files, /output\.system\s*=\s*[^=]/);
  record("V7", scalar.length === 0 ? "PASS" : "FAIL", `scalar-output-system=${scalar.length}` + (scalar.length ? ` at ${scalar.join(", ")}` : ""));
}

function checkV15() {
  const root = join(REPO_ROOT, "installer");
  const { ok, hits } = networkCheck(root);
  const detail = `rede em installer/=${hits.length}`
    + (hits.length ? ` at ${hits.map((h) => `${h.file.replace(REPO_ROOT + "/", "")}:${h.line}(${h.pattern})`).join(", ")}` : "");
  record("V15", ok ? "PASS" : "FAIL", detail);
}

function checkV12() {
  // Live-code refs only; .spec/ is the historical record, not orphan debt.
  const roots = [".agents", ".opencode/plugins", ".github", ".githooks", "opencode.json"];
  const files = [];
  for (const r of roots) {
    const p = join(REPO_ROOT, r);
    if (!existsSync(p)) continue;
    if (statSync(p).isFile()) {
      files.push(p);
      continue;
    }
    const walk = (dir) => {
      if (dir.includes("__tests__") || dir.includes("node_modules")) return;
      for (const e of readdirSync(dir)) {
        const q = join(dir, e);
        if (statSync(q).isDirectory()) walk(q);
        else if (!q.endsWith(".spec.mjs")) files.push(q);
      }
    };
    walk(p);
  }
  // Content-aware: fusion-record lines (name the removed file as audit trail)
  // are not orphans (see R-V12 in sdd-checks.mjs).
  const orphanHits = [];
  for (const f of files) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/harness-continuous\.md/.test(line) && !/fus[aã]o|fusion|DOC-02|back-refs/i.test(line)) {
        orphanHits.push(`${f.replace(REPO_ROOT + "/", "")}:${i + 1}`);
      }
    });
  }
  record("V12", "INFO", `harness-continuous.md orphan refs=${orphanHits.length} (fusion landed DOC-02; enforced as FAIL R-V12 in scripts/sdd-checks.mjs)`);
}

function checkV14() {
  let git = false;
  let remote = false;
  let ci = false;
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: REPO_ROOT, stdio: "pipe" });
    git = true;
  } catch {}
  try {
    const out = execFileSync("git", ["remote", "-v"], { cwd: REPO_ROOT, encoding: "utf8", stdio: "pipe" }).trim();
    remote = out.length > 0;
  } catch {}
  ci = existsSync(join(REPO_ROOT, ".github", "workflows", "harness-integrity.yml"));
  if (git && remote && ci) {
    record("V14", "PASS", "git+remote+CI present");
  } else {
    const reason = !git ? "NO_GIT" : !remote ? "REMOTE_URL_PENDING" : "CI_MISSING";
    record("V14", "FAIL", `${reason} (git=${git} remote=${remote} ci=${ci}) — ADR-007 defense inoperative until step 0 completes`);
  }
}

function reportLegacyBaseline() {
  // Honest ledger: pre-existing violations owned by a later ticket.
  const legacy = [".opencode/plugins/harness-validator.js", ".opencode/plugins/hitl-guardrail.js"]
    .map((f) => join(REPO_ROOT, f))
    .filter((p) => existsSync(p));
  const hard = countMatches(legacy, /docker-compose-postgresql|-pl application/);
  const scalar = countMatches(legacy, /output\.system\s*=\s*[^=]/);
  record("LEGACY", "INFO", `FIX-01 done, baseline 0 (not green, history only): hardcode=${hard.length} scalar-assign=${scalar.length}`);
}

// PAP-04: the pure core `runPrdChecks(root)` is invoked on an arbitrary root so
// the adapter is testable without touching the repo's real `.spec/**`. Default
// root is the repo root — identical to the sealed run.
export function prdCheckResults(root = REPO_ROOT) {
  return runPrdChecks(root).results;
}

function checkPrd(root = REPO_ROOT) {
  for (const r of prdCheckResults(root)) record(r.id, r.status, r.detail);
}

// ADR-005 / RF-06: one `record("V18", …)` — the verdict is `ok` (the exit code),
// not just the console line. `root` is injectable so the adapter's bar is
// testable against a fixture tree without touching the repo's real `.agents/**`.
export function refsCheckResults(root = REPO_ROOT) {
  return runRefsChecks(root).results;
}

function checkRefs(root = REPO_ROOT) {
  const { ok, results: refs } = runRefsChecks(root);
  // A dívida vendorizada é contada no módulo e precisa aparecer TAMBÉM em PASS:
  // o ramo verde era o único consumidor que roda e ele descartava o detalhe
  // (ADR-005 §8-N18). O contador sai do campo estruturado, não de regex na prosa.
  const vendorOnly = refs.find((r) => r.id === "stale-baseline-entry")?.counters?.vendorOnly ?? 0;
  const detail = ok
    ? `refs vivas: ${refs
        .map((r) => (r.id === "stale-baseline-entry" ? `${r.id}=ok[vendor-only=${vendorOnly}]` : `${r.id}=ok`))
        .join(", ")} (baseline=${REFS_BASELINE.length}, non-defect=${REFS_NON_DEFECT.length})`
    : refs.filter((r) => r.status === "FAIL").map((r) => `${r.id}: ${r.detail}`).join("; ");
  record("V18", ok ? "PASS" : "FAIL", detail);
}

// ADR-004 / RF-02: exactly one `record()` for V19 — the verdict is `ok` (the
// exit code), not just the console line. `root` is injectable for the same
// reason as V18: the adapter's bar must be testable against a fixture tree.
export function inventoryCheckResults(root = REPO_ROOT) {
  return runInventoryChecks(root, { declarations: INVENTORY_DECLARATIONS }).results;
}

// The closing arithmetic is published in PASS **and** in FAIL: a counter that
// only exists in the red branch is debt nobody reads while the check works.
function inventoryClosure(c) {
  return `skills=${c.skills.total} (vendor-by-axis=${c.skills["vendor-by-axis"]}, consumer=${c.skills.consumer}, axis=${c.skills.axis}, orphan=${c.skills.orphan})`
    + `, rules=${c.rules.total} (consumer=${c.rules.consumer}, axis=${c.rules.axis}, orphan=${c.rules.orphan})`
    + `, agents=${c.agents.registered + c.agents.orphan}/${c.agents.registry} (registered=${c.agents.registered}, orphan=${c.agents.orphan})`
    + `, vendorCited=${c.vendorCited}, lockPresent=${c.lockPresent}, owner-decisions=${c.ownerDecisions}, pendingRemoval=${c.pendingRemoval}`;
}

function checkInventory(root = REPO_ROOT) {
  const { ok, results: inv, counters } = runInventoryChecks(root, { declarations: INVENTORY_DECLARATIONS });
  const closure = inventoryClosure(counters);
  const detail = ok
    ? `inventário derivado: ${closure}`
    : `inventário reprovado: ${inv
        .filter((r) => r.status === "FAIL")
        .map((r) => `${r.id}: ${r.detail}`)
        .join("; ")} | ${closure}`;
  record("V19", ok ? "PASS" : "FAIL", detail);
  return counters;
}

// ADR-001 / RF-01: exactly one `record("V20", …)` — the verdict is `ok` (the
// exit code), not just the console line. `root` is injectable for the same
// reason as V18/V19: the adapter's bar must be testable against a fixture tree.
// The counters are published in PASS **and** in FAIL — a counter that only
// exists in the red branch is debt nobody reads while the check works.
export function cdlCheckResults(root = REPO_ROOT, opts = {}) {
  // `exports` injetado (C5) — fixture pode sobrepor via `declarations`.
  return runCdlChecks(root, { exports: CDL_EXPORTS, ...opts }).results;
}

function cdlClosure(c) {
  return `population=${c.population.files}/${c.population.lines}`
    + `, prescriptions=${c.prescriptions.total} (condicional=${c.prescriptions.conditional}, exemplo=${c.prescriptions.example}, catálogo=${c.prescriptions.catalogue}, incondicional=${c.prescriptions.unconditional})`
    + `, prohibition-cited=${c.prohibitionCited}`
    + `, baseline=${c.baseline.total} (incondicional=${c.baseline.unconditional}, identity=${c.baseline.identity})`
    + `, identity=${c.identity.lines}/${c.identity.files}`
    + `, axis-decl=${c.axisDecl.skills}/${c.axisDecl.rules}`
    + `, axis-class=${c.axisClass.skills ?? "n/a"}/${c.axisClass.rules ?? "n/a"} (skills/rules)`
    + `, refs-undetected=${c.refsUndetected} (owner ADR-004)`
    + `, vocabulary=${c.vocabulary}, payload=${c.payload}`
    + `, structural-debt=${c.structuralDebt}`
    + (c.structuralDebtEntries?.length ? ` (${c.structuralDebtEntries.join("; ")})` : "")
    + `, vendor-upstream=${c.vendorUpstreamLines}/${c.vendorUpstream} (E-5)`;
}

function checkCdl(root = REPO_ROOT, axisClass) {
  const { ok, results: cdl, counters } = runCdlChecks(root, { axisClass, exports: CDL_EXPORTS });
  const closure = cdlClosure(counters);
  const detail = ok
    ? `cdl medido: ${closure}`
    : `cdl reprovado: ${cdl
        .filter((r) => r.status === "FAIL")
        .map((r) => `${r.id}: ${r.detail}`)
        .join("; ")} | ${closure}`;
  record("V20", ok ? "PASS" : "FAIL", detail);
}

// PAP-04 (🟡3): `root` is injectable so the ADAPTER's verdict — the `ok` flag that
// defines the process exit code, not just the console line — is testable against
// a malformed fixture without touching the repo's real `.spec/**`. Production
// calls it with the default (REPO_ROOT): the sealed run and its exit code are
// unchanged. `results` is reset per call so `ok` reflects THIS run only, keeping
// the verdict deterministic regardless of how many times it is invoked.
export function runStaticChecks(root = REPO_ROOT) {
  results.length = 0;
  checkV6();
  checkV2V3V7();
  checkV15();
  checkV12();
  checkV14();
  checkRefs(root);
  // V19 roda ANTES de V20: `axis-class` é a contagem de classe primária que o
  // inventário já deriva; o V20 publica o par ao lado de `axis-decl` (a
  // declaração de eixo que ele mesmo deriva) sem ler a saída do outro check.
  const inventory = checkInventory(root);
  checkCdl(root, {
    skills: inventory?.skills?.axis ?? null,
    rules: inventory?.rules?.axis ?? null,
  });
  checkPrd(root);
  reportLegacyBaseline();
  const failed = results.filter((r) => r.status === "FAIL");
  return { ok: failed.length === 0, results };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { ok } = runStaticChecks();
  process.exit(ok ? 0 : 1);
}
