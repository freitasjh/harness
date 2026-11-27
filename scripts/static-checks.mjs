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
//
// REMOVED IN v2 (F1) — declared LOSS, with what each module really measured and
// the real population, not a silent pass:
//
//   V20 (CDL) — the Clean Destination Criterion. It was NOT a check over the
//   installer: it read LIVE `.md` prose repo-wide — population measured at
//   removal: 223 files / 30,373 lines — applied a 4-verdict rubric per line,
//   and published technology-citing prohibitions as a COUNTER
//   (`prohibition-cited` = 27 at removal), not as verdicts. Its pinned debt
//   list is NOT "96 debts at removal": the baseline peaked at 96 entries in
//   `47c906b` and was driven to zero by ADR-002/ADR-003/ADR-005 before the
//   removal — measured 80 in `9bf383c`, 38 in `c061514`, and 0 in `381b5e0`
//   (tag v1.0) and 0 in the commit de remoção `346a263` (its parent, `47f9237`,
//   still carried the modules).
//   V19 (inventory) — the canonical inventory: roster parity (`opencode.json`
//   registration ↔ directories that carry `AGENT.md`/`PROMPT.md`), citation by
//   token, the vendor lock as the class source (never a path prefix), and the
//   per-axis artifact inventory (skills 47, rules 8, agents 10/10 at removal).
//
//   Only the AXIS VOCABULARY of both depended on the deleted tree. The rest
//   measured THIS repository. What is no longer measured, stated plainly:
//   (a) the prose rubric of V20 (4 verdicts + `prohibition-cited`; the baseline
//       peaked at 96 entries and was already 0 at removal) — registered as tech
//       debt for the orchestrator (`.spec/tech-debts/harness-v2-cdl/TASKS.md`),
//       not covered by any check today; identity of another project's prose in
//       skills/rules/agents is therefore UNMEASURED;
//   (b) citation-by-token and the vendor-lock class derivation of V19;
//   (c) the per-axis inventory — the axes no longer exist (no wizard, no
//       profiles), so there is nothing to inventory.
//   V21 below restores the cheap, bidirectional half of (b): registration ↔
//   disk, naming both sides on failure. It does not restore token citation.
//   V15 (network references inside the installer tree) also lost its subject:
//   its successor `NET-01` (`scripts/__tests__/sync.spec.mjs`) scans the two
//   scripts on the install path and keeps the module/package/command classes;
//   the E1..E9 escapes of the old check are NOT measured any more.
//   V2/V3/V6/V6b/V7/V12/V14/V18, PRD-01 and ADR-01/ADR-02 are unchanged.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
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
// `.opencode/plugins/lib/prd-adr-pipeline/` (ADR-002), a path the harness
// propagates; this file is just the adapter that registers the result in the
// same report the sealed `commands.suiteFull` already runs — the command itself
// is NOT touched.
import { runPrdChecks } from "../.opencode/plugins/lib/prd-adr-pipeline/checks.mjs";
// ADR-003 F-12/M-05: o scan de segredos é registrado no mesmo relatório do
// `commands.suiteFull` (não apenas em um teste isolado).
import { assertNoSecrets } from "./codex-support.mjs";
// Prosa órfã (ADR-005): the rubric is the module; V18 below only registers it.
import {
  runRefsChecks,
  BASELINE as REFS_BASELINE,
  NON_DEFECT as REFS_NON_DEFECT,
} from "../.opencode/plugins/lib/refs/checks.mjs";

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

// --- V21: roster ↔ disk parity (F1-fix, D1=A) -----------------------------
// Restores the cheap, BIDIRECTIONAL half of the deleted V19 inventory: the
// roster declared in `opencode.json` and the directories under `.agents/agents`
// must agree, and every directory must carry the role file (`AGENT.md` or
// `PROMPT.md`, the `code-reviewer` case). Citation-by-token and the vendor-lock
// class derivation are NOT restored — declared loss in the header of this file.
const ROSTER_PATH = "opencode.json";
const ROSTER_DIR = ".agents/agents";
const ROLE_FILES = ["AGENT.md", "PROMPT.md"];

// `root` is injectable for the same reason as the other adapters: the verdict
// must be testable against a fixture without touching the real roster.
export function rosterParity(root = REPO_ROOT) {
  const rosterFile = join(root, ROSTER_PATH);
  if (!existsSync(rosterFile)) {
    return { ok: false, registered: [], dirs: [], problems: [`${ROSTER_PATH} ausente`] };
  }
  let roster;
  try {
    roster = JSON.parse(readFileSync(rosterFile, "utf8"));
  } catch (e) {
    return { ok: false, registered: [], dirs: [], problems: [`${ROSTER_PATH}: JSON inválido (${e.message})`] };
  }
  const registered = Object.keys(roster?.agent ?? {}).sort();
  const dirAbs = join(root, ROSTER_DIR);
  const dirs = existsSync(dirAbs)
    ? readdirSync(dirAbs, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
    : [];

  const problems = [];
  const registeredSet = new Set(registered);
  for (const name of registered) {
    if (!dirs.includes(name)) {
      problems.push(`registro sem diretório: ${name}`);
    } else if (!ROLE_FILES.some((file) => existsSync(join(dirAbs, name, file)))) {
      problems.push(`diretório sem AGENT.md/PROMPT.md: ${name}`);
    }
  }
  for (const name of dirs) {
    if (!registeredSet.has(name)) problems.push(`diretório sem entrada no registro: ${name}`);
  }
  return { ok: problems.length === 0, registered, dirs, problems };
}

function checkRosterParity(root = REPO_ROOT) {
  const { ok, registered, dirs, problems } = rosterParity(root);
  record(
    "V21",
    ok ? "PASS" : "FAIL",
    ok
      ? `roster↔disco em paridade (registrados=${registered.length}, diretórios=${dirs.length})`
      : problems.join("; "),
  );
}

function checkCodexSmoke(root = REPO_ROOT) {
  const file = join(root, "harness", "codex-port-smoke.json");
  try {
    const raw = readFileSync(file, "utf8");
    assertNoSecrets(JSON.parse(raw));
    record("CODEX-SMOKE", "PASS", "sem campos/valores de segredo");
  } catch (err) {
    record("CODEX-SMOKE", "FAIL", err?.message || String(err));
  }
}

function checkDeliveryAndE2e(root = REPO_ROOT) {
  const problems = [];
  const read = (rel) => readFileSync(join(root, rel), "utf8");
  try {
    const tpl = read(".agents/skills/prompt-optimizer/references/picco-template.md");
    const keys = ["agent", "phase", "skills", "inputs", "write_scope", "outputs", "evidence_path", "handoff_schema", "stop_condition"];
    if (!tpl.includes("<delivery>")) problems.push("PICCO sem <delivery>");
    for (const key of keys) if (!tpl.includes(key)) problems.push("delivery sem " + key);
    const handoff = read(".agents/skills/harness-workflow/references/handoff-schema.md");
    if (!handoff.includes("status")) problems.push("handoff sem status");
    const orch = read(".agents/agents/orchestrator/AGENT.md");
    if (!orch.includes("<delivery>")) problems.push("orchestrator sem <delivery>");
    const cfg = JSON.parse(read("harness.config.json"));
    if (cfg?.gates && "e2eGreenfield" in cfg.gates) problems.push("gates.e2eGreenfield inerte presente");
    if ("riskPaths" in cfg) problems.push("riskPaths inerte presente");
    if ("escalateOnRisk" in cfg) problems.push("escalateOnRisk inerte presente");
    const e2e = cfg?.e2e;
    if (!e2e || typeof e2e !== "object") problems.push("config sem bloco e2e");
    else {
      if (!Array.isArray(e2e.steps)) problems.push("e2e.steps não é array");
      if (typeof e2e.browserRequired !== "boolean") problems.push("e2e.browserRequired ausente");
      if (typeof e2e.skipPolicy !== "string") problems.push("e2e.skipPolicy ausente");
    }
  } catch (err) {
    problems.push(err?.message || String(err));
  }
  record("DELIVERY-E2E", problems.length === 0 ? "PASS" : "FAIL", problems.length === 0 ? "delivery e bloco e2e presentes" : problems.join("; "));
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
  checkV12();
  checkV14();
  checkRefs(root);
  checkPrd(root);
  checkRosterParity(root);
  checkCodexSmoke(root);
  checkDeliveryAndE2e(root);
  reportLegacyBaseline();
  const failed = results.filter((r) => r.status === "FAIL");
  return { ok: failed.length === 0, results };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { ok } = runStaticChecks();
  // Drain before exiting (F3a review, item 16): `process.exit` drops the pending
  // tail of a piped stdout, which is exactly where the PASS/FAIL lines live.
  process.exitCode = ok ? 0 : 1;
}
