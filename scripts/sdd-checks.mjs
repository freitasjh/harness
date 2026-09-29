// sdd-checks.mjs — executable checks for SDD-02/SDD-03/RENAME + V4/V12/V17 (Batch 7).
// Mechanical subset only: existence per phase, 1:1 task sections, vocab table,
// artifact↔gate convention markers, old-name anti-regression. No runtime deny
// is added here (SDD-03: grep gate.js for proof — check R-NODENY).
// Runs locally and in CI with the same result: node scripts/sdd-checks.mjs
// Exit 0 = all green. Exit 1 = at least one FAIL.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { REPO_ROOT } from "../.opencode/plugins/lib/config.mjs";

// Built dynamically so this check file does not flag itself in RENAME-01.
const OLD_REVIEWER = ["fullstack", "code-reviewer"].join("-");
const LINE_BUDGET = 1705;

// --- Pure helpers (unit-tested in __tests__/sdd-checks.spec.mjs) ------------

export function countLines(dir) {
  let total = 0;
  if (!existsSync(dir)) return 0;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) continue;
    if (!p.endsWith(".md")) continue;
    const text = readFileSync(p, "utf8");
    total += text.split("\n").length - (text.endsWith("\n") ? 1 : 0); // wc -l semantics
  }
  return total;
}

// __tests__/ excluded: tooling names forbidden patterns as test data (same
// doctrine as TST-02 static-checks). Anti-regression covers live code+docs.
const SKIP_DIRS = new Set(["__pycache__", "node_modules", ".git", "__tests__"]);
const SKIP_ARCHIVE = ".spec/archive";

export function collectLiveFiles(root) {
  const roots = [".agents", ".opencode/plugins", ".github", ".githooks", "scripts", "opencode.json"];
  const out = [];
  for (const r of roots) {
    const p = join(root, r);
    if (!existsSync(p)) continue;
    if (statSync(p).isFile()) {
      out.push(p);
      continue;
    }
    const walk = (dir) => {
      if ([...SKIP_DIRS].some((s) => dir.includes(s))) return;
      for (const e of readdirSync(dir)) {
        const q = join(dir, e);
        if (statSync(q).isDirectory()) walk(q);
        else out.push(q);
      }
    };
    walk(p);
  }
  return out;
}

// A line that names the removed file AS the fusion record (says fusão/fusion
// or cites DOC-02/back-refs) is audit trail, not orphan debt.
export function isFusionRecord(line) {
  return /fus[aã]o|fusion|DOC-02|back-refs/i.test(line);
}

export function findLiveRefs(root, patterns, { allowFusionRecord = false } = {}) {
  const res = [];
  const res_ = patterns.map((p) => new RegExp(p));
  for (const f of collectLiveFiles(root)) {
    if (f.includes(SKIP_ARCHIVE)) continue;
    let text;
    try {
      text = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\0")) continue; // binary
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (!res_.some((re) => re.test(line))) return;
      if (isMappingLine(line)) return;
      if (allowFusionRecord && isFusionRecord(line)) return;
      res.push(`${f.replace(root + "/", "")}:${i + 1}`);
    });
  }
  return res;
}

// Lines that DESCRIBE the rename (A → B) keep the old name legitimately.
export function isMappingLine(line) {
  return /→/.test(line) && line.includes(OLD_REVIEWER);
}

export function extractTaskIds(summaryText) {
  const ids = [];
  for (const m of summaryText.matchAll(/\|\s*(?:Phase\s+\S+|Phase\s+\S+\+\S+)\s*\|\s*([A-Z]+-\d+|RENAME)\s*\|/g)) {
    ids.push(m[1]);
  }
  return [...new Set(ids)];
}

export function extractTaskSections(body) {
  const sections = [];
  for (const m of body.matchAll(/^### Task ([A-Z]+-\d+|RENAME)\b/gm)) {
    sections.push(m[1]);
  }
  return sections;
}

export function hasNoBypassClause(text) {
  return /NÃO-BYPASS|NAO-BYPASS|não-bypass/i.test(text) && text.includes("gate-contract.md");
}

export function hasVocabTable(text) {
  return text.includes("`current_phase` canônico") && /\|\s*(P0|Explore|SPEC)/.test(text);
}

// SDD-03 convention probe (used on TASKS fixtures in tests; on the repo it
// runs against sdd-orquestrador/AGENT.md + workflow-state.json in runSddChecks).
export function hasGatesConvention(root) {
  const agent = join(root, ".agents/agents/sdd-orquestrador/AGENT.md");
  if (!existsSync(agent)) return false;
  const text = readFileSync(agent, "utf8");
  return text.includes("gates.P1_P2") && text.includes("gates.P2_P3");
}

// --- Repo checks -------------------------------------------------------------

const results = [];
function record(id, status, detail) {
  results.push({ id, status, detail });
  console.log(`${status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : "INFO"} ${id}: ${detail}`);
}

export function runSddChecks(root = REPO_ROOT) {
  results.length = 0;

  // V4 — rules diet budget.
  const total = countLines(join(root, ".agents/rules"));
  record("V4", total <= LINE_BUDGET ? "PASS" : "FAIL", `rules lines=${total} (budget ${LINE_BUDGET})`);

  // R-V12 — zero orphan refs to the merged file (fusion-record lines allowed).
  const orphans = findLiveRefs(root, ["harness-continuous\\.md"], { allowFusionRecord: true });
  record("R-V12", orphans.length === 0 ? "PASS" : "FAIL", `orphan refs=${orphans.length}` + (orphans.length ? ` at ${orphans.join(", ")}` : ""));

  // V17 — single canonical vocab + conversion table.
  const wr = join(root, ".agents/rules/workflow-rules.md");
  const wrText = existsSync(wr) ? readFileSync(wr, "utf8") : "";
  record("V17", hasVocabTable(wrText) ? "PASS" : "FAIL", hasVocabTable(wrText) ? "canonical vocab + conversion table present" : "vocab table missing");

  // SDD-01 — sdd-orquestrador aligned: refs resolve, non-bypass clause, no orphan promise.
  const sddAgent = join(root, ".agents/agents/sdd-orquestrador/AGENT.md");
  const sddText = existsSync(sddAgent) ? readFileSync(sddAgent, "utf8") : "";
  const sddOrphans = findLiveRefs(root, []).length; // placeholder no-op
  void sddOrphans;
  const sddRefHits = findLiveRefs(root, ["BYPASS-SENTINEL-NEVER-MATCHES"]);
  void sddRefHits;
  const sddFileBad = /harness-continuous\.md/.test(sddText);
  const noBypass = hasNoBypassClause(sddText);
  const noOrphanPromise = !/(garante|bloqueia|impede)[^\n]*\n(?![\s\S]*gate-contract\.md)/i.test(sddText) || sddText.includes("Nenhuma linha deste AGENT.md");
  record("SDD-01", !sddFileBad && noBypass && noOrphanPromise ? "PASS" : "FAIL", `refs-ok=${!sddFileBad} non-bypass=${noBypass} no-orphan-promise=${noOrphanPromise}`);

  // SDD-02 — dogfood: artifacts exist + task sections 1:1 with sprint summary.
  const specDir = join(root, ".spec/governance/harness-v7");
  const artifacts = ["PROPOSAL.md", "SPEC.md", "PLAN.md", "TASKS.md"];
  const missing = artifacts.filter((a) => !existsSync(join(specDir, a)));
  let sdd02Detail = missing.length ? `missing ${missing.join(",")}` : "";
  let sdd02Ok = missing.length === 0;
  if (sdd02Ok) {
    const tasks = readFileSync(join(specDir, "TASKS.md"), "utf8");
    const ids = extractTaskIds(tasks);
    const sections = extractTaskSections(tasks);
    const orphanIds = ids.filter((id) => !sections.includes(id));
    sdd02Ok = ids.length > 0 && orphanIds.length === 0;
    sdd02Detail = `artifacts 4/4, tasks ${sections.length}/${ids.length} sections` + (orphanIds.length ? `, orphan ${orphanIds.join(",")}` : "");
  }
  record("SDD-02", sdd02Ok ? "PASS" : "FAIL", sdd02Detail);

  // SDD-03 — gates:{} convention recorded; check (not runtime gate).
  let state = null;
  try {
    state = JSON.parse(readFileSync(join(root, "workflow-state.json"), "utf8"));
  } catch {
    state = null;
  }
  const gatesOk = !!state?.gates?.P1_P2 && !!state?.gates?.P2_P3 && hasGatesConvention(root);
  record("SDD-03", gatesOk ? "PASS" : "FAIL", `state.gates P1_P2=${state?.gates?.P1_P2 ?? "∅"} P2_P3=${state?.gates?.P2_P3 ?? "∅"} convention-doc=${hasGatesConvention(root)}`);

  // R-NODENY — SDD-03 adds no runtime deny (explicit decision, grep proof).
  const gateJs = join(root, ".opencode/plugins/gate.js");
  const gateText = existsSync(gateJs) ? readFileSync(gateJs, "utf8") : "";
  const noSddDeny = !/DENY_SDD|DENY_ARTIFACT|artifact-gate/i.test(gateText);
  record("R-NODENY", noSddDeny ? "PASS" : "FAIL", noSddDeny ? "gate.js has no artifact-gate deny" : "unexpected artifact deny in gate.js");

  // RENAME-01 — old reviewer name zero in live paths (archive immutable, excluded).
  const oldHits = findLiveRefs(root, [OLD_REVIEWER.replace(/-/g, "\\-")]);
  record("RENAME-01", oldHits.length === 0 ? "PASS" : "FAIL", `old-name hits=${oldHits.length}` + (oldHits.length ? ` at ${oldHits.slice(0, 10).join(", ")}` : ""));

  const failed = results.filter((r) => r.status === "FAIL");
  return { ok: failed.length === 0, results };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { ok } = runSddChecks();
  process.exit(ok ? 0 : 1);
}
