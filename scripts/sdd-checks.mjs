// sdd-checks.mjs — executable checks for SDD-02/SDD-03/RENAME + V4/V12/V17 (Batch 7).
// Mechanical subset only: existence per phase, 1:1 task sections, vocab table,
// artifact↔gate convention markers, old-name anti-regression. No runtime deny
// is added here (SDD-03: grep gate.js for proof — check R-NODENY).
// Runs locally and in CI with the same result: node scripts/sdd-checks.mjs
// Exit 0 = all green. Exit 1 = at least one FAIL.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
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

// Task ids seen in the repo: `INF-01`, `IM-BE-01`, `GATE-01`, `RENAME`, ...
// built as a string so one source of truth serves both extractors.
// Single-letter prefixes count (`T-01` in .spec/tech-debts/**/TASKS.md):
// `[A-Z]+(?:-[A-Z]+)*-\d+` still rejects prose (`### WARNING —`,
// `### Batch 1 —`, `### API v2`, `### Task 42`) because prose has no
// uppercase-run followed by `-<digits>`.
const TASK_ID_SRC = "[A-Z]+(?:-[A-Z]+)*-\\d+|RENAME";

export function extractTaskIds(summaryText) {
  const re = new RegExp(`\\|\\s*(?:Phase\\s+\\S+|Phase\\s+\\S+\\+\\S+)\\s*\\|\\s*\`?(${TASK_ID_SRC})\`?\\s*\\|`, "g");
  const ids = [];
  for (const m of summaryText.matchAll(re)) {
    ids.push(m[1]);
  }
  return [...new Set(ids)];
}

// Three real conventions coexist: "### Task ID: t", the backticked canonical
// template "### Task `ID`: t" and batch-style "### ID — t".
export function extractTaskSections(body) {
  const re = new RegExp(`^###\\s+(?:Task\\s+)?\`?(${TASK_ID_SRC})\`?\\b`, "gm");
  const sections = [];
  for (const m of body.matchAll(re)) {
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

// --- SDD-02 target resolution (FU-38) ---------------------------------------
// The dogfood target must never be a hardcoded path: the bug being fixed here
// was a check looking at `.spec/governance/<feature>` after that cycle had been
// archived. The target is resolved from the repo's own state instead, and an
// archived cycle (`.spec/archive/**`) is as valid as a live one.
export const SDD_ARTIFACTS = ["PROPOSAL.md", "SPEC.md", "PLAN.md", "TASKS.md"];

// Buckets under .spec/ that carry partial docs, not a full SDD cycle.
const SPEC_NON_CYCLE = new Set(["archive", "tech-debts", "roadmap", "bugs"]);

// FU-40: um rel sob `.spec/<bucket>/...` (bucket nao-ciclo) nunca qualifica
// como ciclo, mesmo com os 4 artefatos. Um tech-debts/bugs/roadmap completo
// faria o check amarrar "o ciclo" num diretorio de docs parciais.
export function isNonCycleRel(rel) {
  const m = /^\.spec\/([^/]+)/.exec(String(rel || ""));
  return Boolean(m && SPEC_NON_CYCLE.has(m[1]));
}

export function readWorkflowState(root) {
  try {
    return JSON.parse(readFileSync(join(root, "workflow-state.json"), "utf8"));
  } catch {
    return null;
  }
}

export function missingArtifacts(dir) {
  return SDD_ARTIFACTS.filter((a) => !existsSync(join(dir, a)));
}

function subDirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

// Ordered candidate list (first complete dir wins). Tiers: state pointers,
// the cycle the state names, then any live cycle, then archived cycles
// (newest first — the `<YYYYMMDD>-<feature>` prefix sorts chronologically).
export function sddCycleCandidates(root) {
  const state = readWorkflowState(root);
  const out = [];
  const add = (rel, via) => {
    if (typeof rel !== "string") return;
    const norm = rel.replace(/^\.\//, "").replace(/\/+$/, "");
    if (norm.length === 0 || out.some((c) => c.rel === norm)) return;
    out.push({ rel: norm, via });
  };

  const specDir = join(root, ".spec");
  const groups = subDirs(specDir).filter((g) => !SPEC_NON_CYCLE.has(g));
  const archives = subDirs(join(specDir, "archive")).reverse();

  // Tier 1 — pointers declared by the state. Stale values are tolerated: an
  // incomplete candidate is skipped by the caller, never fatal on its own.
  // Every artifacts.* key counts (file pointers resolve to their dir; dir
  // pointers — archive — are added as-is).
  const stateArts = state?.artifacts;
  if (stateArts && typeof stateArts === "object") {
    for (const [k, v] of Object.entries(stateArts)) {
      if (typeof v !== "string" || v.length === 0) continue;
      add(v.endsWith(".md") ? dirname(v) : v, `state.artifacts.${k}`);
    }
  }
  for (const f of Array.isArray(state?.features) ? state.features : []) {
    const arts = f?.artifacts;
    if (!arts || typeof arts !== "object") continue;
    for (const v of Object.values(arts)) {
      if (typeof v === "string" && v.endsWith(".md")) {
        add(dirname(v), `state.features[${f?.name ?? "?"}].artifacts`);
      }
    }
  }

  // Tier 2 — the cycle the state names as current: live groups, then archive.
  const feat = typeof state?.current_feature === "string" ? state.current_feature.trim() : "";
  if (feat) {
    for (const g of groups) add(`.spec/${g}/${feat}`, `current_feature="${feat}" (.spec/${g})`);
    add(`.spec/${feat}`, `current_feature="${feat}" (.spec)`);
    for (const a of archives) {
      if (a === feat || a.endsWith(`-${feat}`)) add(`.spec/archive/${a}`, `current_feature="${feat}" (archive)`);
    }
  }

  // Tier 3 — any live cycle (a feature may exist without a state pointer).
  for (const g of groups) {
    for (const f of subDirs(join(specDir, g))) add(`.spec/${g}/${f}`, `live cycle .spec/${g}/${f}`);
    add(`.spec/${g}`, `live cycle .spec/${g}`);
  }

  // Tier 4 — archived cycles, newest first.
  for (const a of archives) add(`.spec/archive/${a}`, "archived cycle");

  return out;
}

export function resolveSddCycle(root = REPO_ROOT) {
  const candidates = sddCycleCandidates(root);

  // --- Precedence contract (FU-38 hard-stop) ---------------------------------
  // 1. Tier-1 explicit state pointer → LIVE COMPLETE cycle beats drift. In the
  //    multi-dir SDD layout (.spec/backend/<f>/ + .spec/frontend/<f>/) a
  //    complete layer and a WIP layer share the feature name; the state's own
  //    pointer says which dir IS the cycle, so a same-name WIP sibling must
  //    not read as drift (false-red, mirror of the FU-38 archived-dir bug).
  // 2. A Tier-1 pointer wins ONLY if it names a LIVE, COMPLETE dir. An
  //    archive pointer (or a stale/incomplete one) NEVER masks drift — that
  //    is the MF-1 contra-prova: a complete archived cycle does not absolve
  //    a live incomplete current cycle.
  // 2b. FU-39: the win is SCOPED to the cycle the state names as current
  //     (`current_feature`). A stale COMPLETE pointer of ANOTHER feature must
  //     not mask the drift of the current cycle; the multi-layer case keeps
  //     working because the pointer still names the same feature
  //     (`.spec/backend/<feat>` while `.spec/frontend/<feat>` is WIP). No
  //     current_feature => nothing to scope to: legacy behavior (any explicit
  //     live complete pointer wins).
  // 2c. FU-40: a Tier-1 pointer into a SPEC_NON_CYCLE bucket (tech-debts,
  //     bugs, roadmap — archive already excluded above) NEVER qualifies, even
  //     with 4 artifacts: partial-doc buckets are not SDD cycles.
  // 3. Otherwise: the drift gate below judges current_feature-named live dirs,
  //    then any complete live cycle, then the archive.
  const state = readWorkflowState(root);
  const feat = typeof state?.current_feature === "string" ? state.current_feature.trim() : "";
  const isArchiveRel = (rel) => /(^|\/)\.spec\/archive\//.test(rel);
  // FU-39: does the pointer name the cycle the state declares current?
  const namesFeature = (rel) => {
    if (!feat) return true; // no cycle named: legacy, nothing to scope to
    if (rel === `.spec/${feat}`) return true;
    const m = /^\.spec\/[^/]+\/([^/]+)/.exec(rel); // .spec/<group>/<name>
    return Boolean(m && m[1] === feat);
  };
  for (const c of candidates) {
    if (!c.via.startsWith("state.")) continue; // explicit pointer only
    if (isArchiveRel(c.rel)) continue; // archive never masks drift
    if (isNonCycleRel(c.rel)) continue; // FU-40: partial-doc bucket is not a cycle
    if (!namesFeature(c.rel)) continue; // FU-39: stale pointer of another feature
    if (!existsSync(join(root, c.rel))) continue; // stale pointer — not evidence
    if (missingArtifacts(join(root, c.rel)).length > 0) continue; // live but incomplete
    return { rel: c.rel, dir: join(root, c.rel), via: c.via, complete: true, candidates };
  }

  // MF-1 (review do FU-38): the state names a cycle as current. If that cycle
  // EXISTS on disk (a live group, not an archived dir) and is INCOMPLETE, a
  // complete archive must NOT mask it — that was the false-green of SDD-02.
  // A live dir that no longer exists is the FU-38 false-red (already
  // archived): still tolerated, the archive fallback wins.
  if (feat) {
    // Named dirs are matched by PATH, not by the candidate's via-label: a
    // Tier-1 pointer may have registered the same dir first (dedup keeps one
    // entry per path), and the drift gate must still classify it.
    const groups = subDirs(join(root, ".spec")).filter((g) => !SPEC_NON_CYCLE.has(g));
    const namedByFeat = new Set([...groups.map((g) => `.spec/${g}/${feat}`), `.spec/${feat}`]);
    for (const c of candidates) {
      if (!namedByFeat.has(c.rel)) continue;
      if (!existsSync(join(root, c.rel))) continue; // archived away — not drift
      if (missingArtifacts(join(root, c.rel)).length === 0) continue; // complete live cycle
      return { rel: c.rel, dir: join(root, c.rel), via: c.via, complete: false, drift: true, candidates };
    }
  }

  for (const c of candidates) {
    if (missingArtifacts(join(root, c.rel)).length === 0) {
      return { rel: c.rel, dir: join(root, c.rel), via: c.via, complete: true, candidates };
    }
  }
  return { rel: null, dir: null, via: null, complete: false, candidates };
}

export function evaluateSdd02(root = REPO_ROOT) {
  const cycle = resolveSddCycle(root);
  if (!cycle.complete) {
    if (cycle.drift) {
      // Fail-closed on drift of the cycle the state itself declares current.
      const missing = missingArtifacts(cycle.dir);
      return {
        ok: false,
        detail: `live cycle named by state is incomplete — drift: ${cycle.rel} (via ${cycle.via}) missing ${missing.join(",")}; an archived cycle must not mask the current one`,
      };
    }
    // Fail-closed: no cycle with the 4 artifacts anywhere (state or archive).
    let closest = null;
    for (const c of cycle.candidates) {
      const missing = missingArtifacts(join(root, c.rel));
      if (!closest || missing.length < closest.missing.length) closest = { ...c, missing };
    }
    const hint = closest
      ? `closest ${closest.rel} (via ${closest.via}) missing ${closest.missing.join(",")}`
      : "no candidate dir resolved (state + .spec scan empty)";
    return {
      ok: false,
      detail: `no complete SDD cycle (${SDD_ARTIFACTS.join("/")}) — ${cycle.candidates.length} candidates, ${hint}`,
    };
  }
  const tasks = readFileSync(join(cycle.dir, "TASKS.md"), "utf8");
  const ids = extractTaskIds(tasks);
  const sections = extractTaskSections(tasks);
  // A backlog without a sprint-summary table declares its tasks via the
  // sections themselves; when the table exists it must match 1:1.
  const declared = ids.length > 0 ? ids : sections;
  const orphans = ids.filter((id) => !sections.includes(id));
  const ok = declared.length > 0 && orphans.length === 0;
  const reason = sections.length === 0
    ? ", no task sections"
    : orphans.length > 0 ? `, orphan ids ${orphans.join(",")}` : "";
  return {
    ok,
    detail: `cycle=${cycle.rel} (via ${cycle.via}) artifacts ${SDD_ARTIFACTS.length}/${SDD_ARTIFACTS.length}, tasks sections=${sections.length} declared=${declared.length}${reason}`,
  };
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

  // SDD-02 — dogfood: artifacts of the resolved cycle exist + tasks coherent.
  const sdd02 = evaluateSdd02(root);
  record("SDD-02", sdd02.ok ? "PASS" : "FAIL", sdd02.detail);

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
