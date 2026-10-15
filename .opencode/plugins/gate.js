// gate.js — harness gate core (GATE-01..GATE-05, Batches 3-4/7).
//
// SPEC: .spec/governance/harness-v7/SPEC.md (ADR-001/002/004/006/007/008/009, §6 Hook Registry)
// PLAN: .spec/governance/harness-v7/PLAN.md (Phase 2, GATE-01..GATE-05)
// TASKS: .spec/governance/harness-v7/TASKS.md (GATE-01..GATE-05, FIX-01)
// Contract: .spec/governance/harness-v7/RUNTIME-CONTRACT.md (§2 inventory, H1-H6).
//
// Scope per ticket:
//   GATE-01: DenyError, dispatcher with modes, kill-switch, seal-empty rejection (FU-03).
//   GATE-02: PICCO gate on `task` (ADR-004) — gatePiccoTask.
//   GATE-03: completion gate, anchors A+B + sealed contraprova (ADR-002/ADR-008).
//   GATE-04: HITL pause between batches + correction-loop exemption (I6).
//   GATE-05: shell hygiene + protected-path parse + qa-engineer scope (I7/I9).
// Per-gate checks register via registerCoreGate below; each is a pure
// async (ctx) => void function throwing DenyError to deny.
//
// Contract discipline (a defect is any violation of these):
//   - Every deny is `throw new DenyError(reason, details)` with an ACTIONABLE
//     reason (command, exit code, divergent counts, missing tag, ...).
//   - Any other thrown error NEVER denies: it is logged at error level and the
//     tool call is allowed (fail-open, ADR-006). A crashing plugin must not
//     paralyze the dev loop.
//   - Only hooks confirmed in RUNTIME-CONTRACT §2 are used. In particular this
//     module never touches the forbidden ask hook (H1), never assigns the
//     system-transform output as a scalar (G14/H2), and never filters the
//     nonexistent bus event (N7/H3).
//   - Honesty of guarantee: parse-based checks (GATE-05 bash parse) are
//     evadible and declared as such; the backstop is CI (ADR-007).
//
// Modes:
//
//   DEFAULT_MODE is "enforce" since DOG-01 (Batch 8/8, flip): a DenyError
//   denies the tool call. Pre-flip history ("warn": log + allow) is kept in
//   git history. Per-gate modes resolve via modeForGate(config, gateFn) from
//   harness.config.json gates.* (FU-06); DEFAULT_MODE is the fallback for
//   gates without a gates.* key (hygiene) and for missing/invalid config.
//   Flip record (DOG-01): gate.spec.mjs green in BOTH modes (helpers
//   deniesBothModes/allowsBothModes) + dogfood.spec.mjs S1-S4 + runbook
//   .spec/governance/harness-v7/FLIP-RUNBOOK.md. Rollback: HARNESS_GATES=off
//   (runtime, ADR-009) or revert this constant + opencode.json registration.
//
// Kill-switch (ADR-009):
//   ONLY the host-process env HARNESS_GATES=off disables enforcement.
//   gates.* in harness.config.json is informative/audited and NEVER disables
//   anything — see resolveMode + configGatesDisableEnforcement.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { verifySeal, sha256 } from "./lib/seal.mjs";
import { loadHarnessConfig, REPO_ROOT } from "./lib/config.mjs";

export const DEFAULT_MODE = "enforce";

export const KILL_SWITCH_ENV = "HARNESS_GATES";
export const KILL_SWITCH_OFF = "off";

export const DENY_SEAL_MISMATCH = "sealed-command-mismatch";

// ADR-006: the typed deny signal. The dispatcher propagates DenyError and
// fail-opens on anything else. Gates MUST throw this, never a raw Error.
export class DenyError extends Error {
  constructor(reason, details = {}) {
    super(typeof reason === "string" && reason.length > 0 ? reason : "deny");
    this.name = "DenyError";
    this.reason = typeof reason === "string" && reason.length > 0 ? reason : "deny";
    this.details = details;
  }
}

export function isKillSwitchOff(env = process.env) {
  return env?.[KILL_SWITCH_ENV] === KILL_SWITCH_OFF;
}

// ADR-009: gates.* never disables. "enforce" is honored; anything else
// (including "off" or unknown values) falls back to "warn".
export function resolveMode(config, _gateName) {
  const raw = config?.gates?.[_gateName];
  if (raw === "enforce") return "enforce";
  return "warn";
}

// ---------------------------------------------------------------------------
// FU-06: per-gate modes. Each core gate carries a gateName; modeForGate
// resolves it through resolveMode(config, key). Gates without a gates.* key
// (hygiene: no such key in harness.config.json) fall back to DEFAULT_MODE.
// Unknown gate functions fall back too — never "off" (ADR-009).
// ---------------------------------------------------------------------------

const GATE_NAME_TO_CONFIG_KEY = {
  picco: "picco",
  evidence: "evidence",
  hitlBatch: "hitlBatch",
};

export function modeForGate(gateFn, config) {
  // No config (missing/unreadable): fail-closed needs the deny to stick, so
  // fall back to DEFAULT_MODE (enforce post-flip), never to warn. The gate
  // itself still throws config-unavailable from inside decide() (FU-05).
  if (!config || typeof config !== "object") return DEFAULT_MODE;
  const gateName = gateFn?.gateName ?? gateFn?.name;
  const key = GATE_NAME_TO_CONFIG_KEY[gateName];
  if (!key) return DEFAULT_MODE;
  return resolveMode(config, key);
}

// ---------------------------------------------------------------------------
// FU-07: the contraprove cache is only valid when treeHash names real
// content (N11). "unknown" (the default when the caller states no hash)
// disables the cache: every contraprova re-executes. A stale allow from a
// cache hit on unknown content is a defect; a wasted re-run is not.
// ---------------------------------------------------------------------------

export function isCacheableTreeHash(treeHash) {
  return typeof treeHash === "string" && treeHash.length > 0 && treeHash !== "unknown";
}

// FU-03: empty commands or an empty seal is fail-closed. An empty command map
// (or an empty command value) most likely means the config failed to load or
// was tampered with — silently allowing would bless an unverified run.
export function verifySealOrDeny(commands, seal) {
  if (!commands || typeof commands !== "object" || Array.isArray(commands) || Object.keys(commands).length === 0) {
    throw new DenyError(DENY_SEAL_MISMATCH, { cause: "empty-commands" });
  }
  for (const [key, value] of Object.entries(commands)) {
    if (typeof value !== "string" || value.length === 0) {
      throw new DenyError(DENY_SEAL_MISMATCH, { cause: "empty-command", key });
    }
  }
  if (!seal || typeof seal !== "object" || Array.isArray(seal) || Object.keys(seal).length === 0) {
    throw new DenyError(DENY_SEAL_MISMATCH, { cause: "empty-seal" });
  }
  const { ok, mismatches } = verifySeal(commands, seal);
  if (!ok) throw new DenyError(DENY_SEAL_MISMATCH, { mismatches });
  return true;
}

function logWarn(logger, err) {
  try {
    logger?.warn?.(err instanceof Error ? err.message : String(err));
  } catch {
    // Logging is best-effort; it never changes the verdict.
  }
}

function logError(logger, err) {
  // I10: message-only, same as logWarn. The full Error object carries
  // DenyError.details (paths, counts) and a stack; serializing loggers
  // (app log JSON, console.error(err)) would echo that verbatim. The
  // actionable signal is the reason/message string; details stay on the
  // thrown DenyError for the caller, never in the log line.
  try {
    logger?.error?.(err instanceof Error ? err.message : String(err));
  } catch {
    // Logging is best-effort; it never changes the verdict.
  }
}

// ADR-006 dispatcher. Pure and hook-agnostic so it is unit-testable without
// MCP or network. Returns a verdict object; only DenyError in enforce mode
// escapes as a throw (which is what denies the tool call at runtime).
export async function decide({ gateFn = null, mode = DEFAULT_MODE, ctx = {}, env = process.env, logger = console } = {}) {
  if (isKillSwitchOff(env)) return { verdict: "allow", via: "kill-switch" };
  try {
    if (gateFn) await gateFn(ctx);
    return { verdict: "allow" };
  } catch (err) {
    if (!(err instanceof DenyError)) {
      logError(logger, err);
      return { verdict: "allow", via: "plugin-error-fail-open" };
    }
    if (mode !== "enforce") {
      logWarn(logger, err);
      return { verdict: "allow", via: "warn", reason: err.reason };
    }
    throw err;
  }
}

// Core gate registry. GATE-02..05 append their pure gates here
// (each: async (ctx) => void, throwing DenyError to deny).
const CORE_GATES = [];

export function registerCoreGate(gateFn) {
  CORE_GATES.push(gateFn);
  return () => {
    const index = CORE_GATES.indexOf(gateFn);
    if (index >= 0) CORE_GATES.splice(index, 1);
  };
}

export function listCoreGates() {
  return [...CORE_GATES];
}

// ---------------------------------------------------------------------------
// Shared deny reasons (one per fixture row, SPEC §7.3).
// ---------------------------------------------------------------------------

export const DENY_PICCO_ABSENT = "picco-tag-absent";
export const DENY_PICCO_NONEMPTY = "picco-tag-nonempty";
export const DENY_COMPLETED_NO_EVIDENCE = "completed-no-evidence";
export const DENY_CONTRAPROVE_DIVERGENT = "contraprove-divergent";
export const DENY_CONTRAPROVE_TIMEOUT = "contraprove-timeout";
export const DENY_PREV_CYCLE = "prev-cycle-not-completed";
export const DENY_HITL = "hitl-pause-required";
export const DENY_PKILL = "pkill-f";
export const DENY_PROTECTED = "protected-path-write";
export const DENY_ALLOWLIST = "orch-write-outside-allowlist";
export const DENY_QA_SCOPE = "qa-scope-violation";
export const DENY_ROLE_WRITE = "write-denied-for-role";
export const DENY_CONFIG_UNAVAILABLE = "config-unavailable";
export const DENY_STATE_CORRUPT = "state-corrupt";

// ---------------------------------------------------------------------------
// FU-05: config→gate border. The loader throws a plain Error; decide() would
// fail-open on it (ADR-006) and RF-01 fail-closed would silently become allow.
// Mapping the catch to DenyError here keeps fail-closed enforceable.
// ---------------------------------------------------------------------------

export function loadConfigOrDeny(path) {
  try {
    return loadHarnessConfig(path);
  } catch (err) {
    // I10: never echo the loader's raw message (it embeds the failing
    // path, which may be attacker-controlled). The actionable signal is
    // the reason; the cause stays an enum.
    throw new DenyError(DENY_CONFIG_UNAVAILABLE, {
      cause: err?.code ?? "load-error",
    });
  }
}

export function ensureConfig(ctx = {}) {
  if (ctx?.config) return ctx.config;
  return loadConfigOrDeny(ctx?.configPath);
}

// ---------------------------------------------------------------------------
// Session→agent map (I11). The deny primitive carries no agent identity —
// only {tool, sessionID, callID} plus args — so per-agent rules resolve the
// subject through this map, fed by the chat.params hook (contract §2).
// Without an entry, no per-agent rule applies (SPEC G8): allow.
// ---------------------------------------------------------------------------

const sessionAgentMap = new Map();

// Bound on session entries: the map is fed by chat.params (one entry per
// sessionID). Unbounded growth across long-lived hosts is a memory leak;
// evict the oldest insertion when over cap (Map preserves insertion order).
// Cap is generous on purpose: eviction only drops the agent hint, which
// fail-opens per-agent rules to allow (SPEC G8), never to deny.
export const MAX_SESSION_AGENTS = 1000;

export function recordSessionAgent(sessionID, agent) {
  if (sessionID && agent) {
    if (!sessionAgentMap.has(sessionID) && sessionAgentMap.size >= MAX_SESSION_AGENTS) {
      const oldest = sessionAgentMap.keys().next().value;
      sessionAgentMap.delete(oldest);
    }
    sessionAgentMap.set(sessionID, agent);
  }
}

export function resolveSessionAgent(ctx = {}) {
  if (ctx?.sessionAgent) return ctx.sessionAgent;
  if (ctx?.sessionID && sessionAgentMap.has(ctx.sessionID)) return sessionAgentMap.get(ctx.sessionID);
  return undefined;
}

export function clearSessionAgents() {
  sessionAgentMap.clear();
}

export function noteChatParams(input = {}) {
  const sessionID = input?.sessionID ?? input?.params?.sessionID;
  const agent =
    input?.agent ?? input?.params?.agent ?? input?.params?.subagent_type ?? input?.subagent_type;
  if (sessionID && agent) recordSessionAgent(sessionID, agent);
}

export function isHumanMessage(input = {}, output) {
  // FU-19 (a): the real chat.message input ({sessionID,agent,model,...}
  // per @opencode-ai/plugin dist/index.d.ts) carries NO role — role lives
  // in the second arg output.message.role. Legacy single-arg shapes stay.
  const role =
    input?.role ?? input?.message?.role ?? input?.params?.role ?? output?.message?.role ?? output?.role;
  return role === "human" || role === "user";
}

// ---------------------------------------------------------------------------
// GATE-02 — PICCO gate on `task` (ADR-004, I1).
//
// Exact contract: the <open_questions> tag is MANDATORY. Absent, or present
// with non-empty content, => deny (E1/E2). Empty or whitespace/HTML-comment
// only => allow. Missing E3-E6 content tags => allow + warn (advisory).
// Read-only query prompts carry no PICCO block and skip the gate.
// ---------------------------------------------------------------------------

export const PICCO_CONTENT_TAGS = ["role", "task", "context", "constraints", "acceptance"];

// Narrow on purpose: only bare state-reading queries skip. Anything shaped
// like a delegation (any PICCO tag present) is evaluated, never skipped.
const QUERY_PREFIX_RE = /^\s*(show\s+status|o que|onde|qual|existe|list|read|get|status)\b/i;

export function extractPromptText(args) {
  if (typeof args === "string") return args;
  if (!args || typeof args !== "object") return "";
  const parts = [];
  for (const key of ["prompt", "description", "task", "message", "text", "content"]) {
    if (typeof args[key] === "string" && args[key].length > 0) parts.push(args[key]);
  }
  if (parts.length === 0) {
    for (const value of Object.values(args)) {
      if (typeof value === "string" && value.length > 0) parts.push(value);
    }
  }
  return parts.join("\n");
}

function stripHtmlComments(text) {
  return String(text).replace(/<!--[\s\S]*?-->/g, "");
}

export function checkPicco(promptText) {
  const text = typeof promptText === "string" ? promptText : "";
  const hasAnyPiccoTag = /<(role|task|context|constraints|acceptance|open_questions)\b/i.test(text);
  if (!hasAnyPiccoTag && QUERY_PREFIX_RE.test(text)) {
    return { verdict: "allow", warnings: [], via: "query" };
  }
  const match = text.match(/<open_questions\b[^>]*>([\s\S]*?)<\/open_questions\s*>/i);
  if (!match) return { verdict: "deny", reason: DENY_PICCO_ABSENT, warnings: [] };
  if (stripHtmlComments(match[1]).trim().length > 0) {
    return { verdict: "deny", reason: DENY_PICCO_NONEMPTY, warnings: [] };
  }
  const warnings = [];
  for (const tag of PICCO_CONTENT_TAGS) {
    if (!new RegExp(`<${tag}\\b`, "i").test(text)) {
      warnings.push(`picco-warning: <${tag}> absent (E3-E6 advisory, allow)`);
    }
  }
  return { verdict: "allow", warnings };
}

export async function gatePiccoTask(ctx = {}) {
  if (ctx.tool !== "task") return true;
  const result = checkPicco(extractPromptText(ctx.args));
  if (result.verdict === "deny") throw new DenyError(result.reason, { tool: "task" });
  for (const warning of result.warnings) {
    try {
      ctx.logger?.warn?.(warning);
    } catch {
      // Best-effort; never changes the verdict.
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Path helpers shared by anchors A (GATE-03) and hygiene (GATE-05).
// ---------------------------------------------------------------------------

export function normalizePath(path) {
  if (typeof path !== "string") return "";
  return path.trim().replace(/\\/g, "/").replace(/^(?:\.\/)+/, "").replace(/^\/+/, "").replace(/^["']|["']$/g, "");
}

function escapeRegExp(text) {
  return text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

// Minimal glob: ** spans separators, * does not, ? is one non-separator char.
export function matchGlob(path, pattern) {
  const segments = normalizePath(pattern).split("**");
  const body = segments
    .map((segment) => {
      let out = "";
      for (const char of segment) {
        if (char === "*") out += "[^/]*";
        else if (char === "?") out += "[^/]";
        else out += escapeRegExp(char);
      }
      return out;
    })
    .join(".*");
  return new RegExp(`^${body}$`).test(normalizePath(path));
}

// Orchestrator allowlist, anchor A (SPEC N12): ONLY .spec/** plus the state
// file. Everything else (notably rules/schemas/plugins/config) is denied here
// and writable solely via developer-engineer under delegation (CI backstop).
export function isOrchAllowlisted(path) {
  const normalized = normalizePath(path);
  return (
    normalized.startsWith(".spec/") ||
    normalized === "workflow-state.json" ||
    normalized.endsWith("/workflow-state.json")
  );
}

export function isHarnessScoped(path) {
  const normalized = normalizePath(path);
  return normalized === "harness" || normalized.startsWith("harness/");
}

export function isProtectedPath(path, protectedPaths = []) {
  const normalized = normalizePath(path);
  if (!normalized) return false;
  return (protectedPaths ?? []).some((pattern) => matchGlob(normalized, pattern));
}

const WRITE_TOOLS = new Set(["write", "edit", "apply_patch", "patch"]);

export function parsePatchPaths(text) {
  const found = new Set();
  const patterns = [
    /^\+\+\+\s+b\/(\S+)/gm,
    /^---\s+a\/(\S+)/gm,
    /\*\*\*\s*Update File:\s*(\S+)/gi,
    /"(?:filePath|path)"\s*:\s*"([^"]+)"/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const candidate = match[1].replace(/["',;]+$/, "");
      if (candidate && candidate !== "/dev/null" && candidate !== "dev/null") found.add(candidate);
    }
  }
  return [...found];
}

// Covers both runtime arg shapes (contract H6): {filePath, ...} and {path, ...}.
export function extractWriteTargets(tool, args) {
  const targets = [];
  if (!WRITE_TOOLS.has(tool)) return targets;
  if (tool === "apply_patch" || tool === "patch") {
    const text =
      typeof args === "string"
        ? args
        : (args?.patchText ?? args?.patch ?? args?.diff ?? args?.content ?? "");
    if (typeof text === "string" && text.length > 0) {
      for (const path of parsePatchPaths(text)) targets.push({ kind: "patch", path });
    }
    return targets;
  }
  const candidates =
    typeof args === "string"
      ? [args]
      : [args?.filePath, args?.file_path, args?.path, args?.file, args?.filename, args?.target].filter(
          (value) => typeof value === "string" && value.length > 0,
        );
  for (const path of candidates) targets.push({ kind: "path", path });
  return targets;
}

// ---------------------------------------------------------------------------
// I10 detail hygiene (🟡-2 sec). DenyError.details travels to the caller
// and (via fail-open logging) to log lines, so it must never echo raw
// user-controlled strings (secrets, absolute paths in `args`). Allowed
// keys are registry metadata ({tool, gateId, timing}) plus small enums;
// any path is reduced to its allowlisted form below: basename (never a
// directory, never absolute). Agents are reduced to the known enum — an
// unknown/malicious agent string becomes "unknown" instead of leaking.
// ---------------------------------------------------------------------------

export function basenameOf(path) {
  const segments = normalizePath(path).split("/");
  return segments.length > 0 ? segments[segments.length - 1] : "";
}

const KNOWN_AGENTS = new Set([
  "orchestrator",
  "developer-engineer",
  "qa-engineer",
  "code-reviewer",
  "ux-designer",
  "unknown",
]);

export function sanitizeAgent(agent) {
  return KNOWN_AGENTS.has(agent) ? agent : "unknown";
}

export function sanitizePathForDetails(path) {
  return basenameOf(path);
}

export function checkWriteAccess({ agent, tool, targets = [], protectedPaths = [] } = {}) {
  for (const target of targets) {
    const normalized = normalizePath(target.path);
    if (!normalized || normalized === "dev/null") continue;
    if (isProtectedPath(normalized, protectedPaths)) {
      // Sole exception: developer-engineer under delegation; the trailer
      // requirement itself is enforced out-of-band by CI (ADR-007).
      if (agent === "developer-engineer") continue;
      throw new DenyError(DENY_PROTECTED, {
        tool,
        path: sanitizePathForDetails(normalized),
        agent: sanitizeAgent(agent ?? "unknown"),
      });
    }
    if (agent === "orchestrator" && !isOrchAllowlisted(normalized)) {
      throw new DenyError(DENY_ALLOWLIST, { tool, path: sanitizePathForDetails(normalized) });
    }
    if (agent === "qa-engineer" && !isHarnessScoped(normalized)) {
      throw new DenyError(DENY_QA_SCOPE, { tool, path: sanitizePathForDetails(normalized) });
    }
    if (agent === "code-reviewer" || agent === "ux-designer") {
      throw new DenyError(DENY_ROLE_WRITE, {
        tool,
        path: sanitizePathForDetails(normalized),
        agent: sanitizeAgent(agent),
      });
    }
  }
  return true;
}

export function extractWriteContent(args) {
  if (!args || typeof args !== "object") return null;
  for (const key of ["content", "text", "newContent", "data", "new_string", "newString"]) {
    if (typeof args[key] === "string" && args[key].length > 0) return args[key];
  }
  return null;
}

export function isCompletionWrite({ tool, targets = [], args } = {}) {
  if (!WRITE_TOOLS.has(tool)) return false;
  const touchesState = targets.some((target) => {
    const normalized = normalizePath(target.path);
    return normalized === "workflow-state.json" || normalized.endsWith("/workflow-state.json");
  });
  if (!touchesState) return false;
  const content = extractWriteContent(args);
  if (!content) return false;
  try {
    return JSON.parse(content)?.current_phase === "Completed";
  } catch {
    return /"current_phase"\s*:\s*"Completed"/.test(content);
  }
}

// ---------------------------------------------------------------------------
// GATE-03 — completion gate (ADR-002/ADR-008).
//
// Anchor A: structured path-check on write/edit/patch. Anchor B: the next
// `task` requires the previous cycle closed (Completed + passed + passed).
// The contraprova re-runs the sealed canonical command and compares exit
// code plus counts; timeout is a deny (inconclusive is not proof).
// ---------------------------------------------------------------------------

const contraproveCache = new Map();

export function clearContraproveCache() {
  contraproveCache.clear();
}

export function contraproveCacheKey({ demand, report, treeHash = "unknown" } = {}) {
  return `${demand}::${sha256(JSON.stringify(report))}::${treeHash}`;
}

export function defaultContraproveExec(command, { timeoutMs } = {}) {
  try {
    execFileSync(command, { shell: "/bin/sh", timeout: timeoutMs, stdio: "pipe" });
    return { exitCode: 0, counts: null };
  } catch (err) {
    if (err?.code === "ETIMEDOUT" || /ETIMEDOUT|timed out/i.test(String(err?.message ?? ""))) {
      return { timedOut: true };
    }
    if (typeof err?.status === "number") return { exitCode: err.status, counts: null };
    throw err;
  }
}

export async function runContraprova({
  demand,
  report,
  commands,
  seal,
  execFn = defaultContraproveExec,
  timeoutMs = 900000,
  treeHash = "unknown",
} = {}) {
  // Seal first (U6=b): a tampered canonical command denies before anything runs.
  verifySealOrDeny(commands, seal);
  if (!demand || typeof demand !== "string") {
    throw new DenyError(DENY_COMPLETED_NO_EVIDENCE, { cause: "missing-demand" });
  }
  if (!report || typeof report !== "object") {
    throw new DenyError(DENY_COMPLETED_NO_EVIDENCE, { demand });
  }
  const key = contraproveCacheKey({ demand, report, treeHash });
  const cacheable = isCacheableTreeHash(treeHash);
  if (cacheable && contraproveCache.has(key)) return { verdict: "allow", via: "cache", key };
  let observed;
  try {
    observed = await execFn(commands.suiteFull, { timeoutMs });
  } catch (err) {
    if (
      err &&
      (err.code === "ETIMEDOUT" || err.timedOut === true || /timed out/i.test(err.message ?? ""))
    ) {
      throw new DenyError(DENY_CONTRAPROVE_TIMEOUT, { demand, timeoutMs });
    }
    // ADR-006: an exec harness failure that is not a timeout verdict is a
    // plugin error, not a deny — it propagates and decide() fail-opens.
    throw err;
  }
  if (observed?.timedOut === true) {
    throw new DenyError(DENY_CONTRAPROVE_TIMEOUT, { demand, timeoutMs });
  }
  const expectedExit = report?.commands?.[0]?.exitCode;
  if (typeof expectedExit === "number" && observed?.exitCode !== expectedExit) {
    throw new DenyError(DENY_CONTRAPROVE_DIVERGENT, {
      demand,
      expectedExit,
      observedExit: observed?.exitCode,
    });
  }
  const expectedCounts = report?.counts ?? null;
  const observedCounts = observed?.counts ?? null;
  // Partial by declaration: the default executor observes exit codes only.
  // Counts are compared whenever both sides state them; a stated-but-
  // unobservable count is divergent (unverifiable claim, not proof).
  if (expectedCounts && !observedCounts) {
    throw new DenyError(DENY_CONTRAPROVE_DIVERGENT, { demand, cause: "counts-unverifiable" });
  }
  if (
    expectedCounts &&
    observedCounts &&
    JSON.stringify(expectedCounts) !== JSON.stringify(observedCounts)
  ) {
    throw new DenyError(DENY_CONTRAPROVE_DIVERGENT, { demand, expectedCounts, observedCounts });
  }
  if (cacheable) contraproveCache.set(key, { ok: true });
  return { verdict: "allow", key };
}

// Published seal (U6=b): the trust root is rollout step 1, not the worktree.
// Absent seal => verifySealOrDeny denies (fail-closed), never allows.
export function loadPublishedSeal(ctx = {}) {
  if (ctx?.publishedSeal) return ctx.publishedSeal;
  const raw = ctx?.env?.HARNESS_SEAL_JSON ?? process.env?.HARNESS_SEAL_JSON;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

export async function gateCompletionAnchorA(ctx = {}) {
  const tool = ctx.tool;
  if (!WRITE_TOOLS.has(tool)) return true;
  const targets = extractWriteTargets(tool, ctx.args);
  if (targets.length === 0) return true;
  const config = ensureConfig(ctx);
  checkWriteAccess({
    agent: resolveSessionAgent(ctx),
    tool,
    targets,
    protectedPaths: config?.protectedPaths ?? [],
  });
  if (!isCompletionWrite({ tool, targets, args: ctx.args })) return true;
  const report = ctx.report ?? null;
  if (!report) throw new DenyError(DENY_COMPLETED_NO_EVIDENCE, { demand: ctx.demand ?? null });
  await runContraprova({
    demand: ctx.demand ?? report?.demand ?? "workflow-state",
    report,
    commands: config?.commands,
    seal: loadPublishedSeal(ctx),
    execFn: ctx.contraproveExec ?? defaultContraproveExec,
    timeoutMs: ctx.timeoutMs ?? config?.contraproveTimeoutMs ?? 900000,
    treeHash: ctx.treeHash ?? "unknown",
  });
  return true;
}

export function loadWorkflowState(statePath) {
  const resolved = statePath ?? join(REPO_ROOT, "workflow-state.json");
  let raw;
  try {
    raw = readFileSync(resolved, "utf8");
  } catch (err) {
    // Absent state is bootstrap: no previous cycle to gate => allow (null).
    if (err?.code === "ENOENT") return null;
    // Any other read failure denies fail-closed (FU-08): an unreadable
    // state must not silently bless a new cycle. I10: details carry the
    // basename + errno enum only, never the absolute path.
    throw new DenyError(DENY_STATE_CORRUPT, { statePath: basenameOf(resolved), cause: err?.code ?? "read-error" });
  }
  try {
    return JSON.parse(raw);
  } catch {
    // Corrupt state denies fail-closed (FU-08). Only ENOENT above allows.
    // I10: parse errors never echo file content (may hold secrets).
    throw new DenyError(DENY_STATE_CORRUPT, {
      statePath: basenameOf(resolved),
      cause: "parse-error",
    });
  }
}

export function checkAnchorB({ state = null, startsNewCycle = false } = {}) {
  if (!startsNewCycle) return true;
  const closed =
    state?.current_phase === "Completed" &&
    state?.harness_status === "passed" &&
    state?.code_review_status === "passed";
  if (!closed) {
    throw new DenyError(DENY_PREV_CYCLE, {
      current_phase: state?.current_phase ?? null,
      harness_status: state?.harness_status ?? null,
      code_review_status: state?.code_review_status ?? null,
    });
  }
  return true;
}

// Heuristic, declared partial: a task that names the open cycle's feature
// continues it; one that does not, starts a new cycle and must find the
// previous one closed. Prose claims (H5) stay outside runtime by design.
export function inferNewCycle(promptText, state) {
  if (!state) return false;
  if (
    state.current_phase === "Completed" &&
    state.harness_status === "passed" &&
    state.code_review_status === "passed"
  ) {
    return false;
  }
  const feature = state.current_feature;
  if (
    typeof feature === "string" &&
    feature.length > 0 &&
    typeof promptText === "string" &&
    promptText.toLowerCase().includes(feature.toLowerCase())
  ) {
    return false;
  }
  return true;
}

export async function gatePhaseAnchorB(ctx = {}) {
  if (ctx.tool !== "task") return true;
  const state = ctx.workflowState ?? loadWorkflowState(ctx.statePath);
  if (!state) return true;
  const startsNewCycle = ctx.startsNewCycle ?? inferNewCycle(extractPromptText(ctx.args), state);
  checkAnchorB({ state, startsNewCycle });
  return true;
}

// Best-effort evidence lookup for the runtime wrapper: the demand under
// completion is the state's current feature. Missing => null, and the
// completion gate then denies fail-closed (fixture completed-no-evidence).
export function readEvidenceReport(ctx = {}) {
  try {
    if (ctx.report) return ctx.report;
    const state = ctx.workflowState ?? loadWorkflowState(ctx.statePath);
    const feature = state?.current_feature;
    if (!feature) return null;
    const config = ctx.config ?? loadHarnessConfig(ctx.configPath);
    const dir = config?.evidence?.path ?? "harness";
    return JSON.parse(readFileSync(join(REPO_ROOT, dir, `${feature}.json`), "utf8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GATE-04 — HITL pause between batches (I6).
//
// Rule: the 3rd consecutive `task` without an intervening human turn denies.
// The mandatory correction loop (developer-engineer -> code-reviewer (renamed RENAME, Batch 7)
// as the first two calls) therefore always passes — the exemption is
// structural (2 < 3), not a special case. Human turns arrive via the
// chat.message hook, which resets the per-session counter.
// ---------------------------------------------------------------------------

export function createHitlTracker() {
  const tasks = [];
  return {
    onTask(subagentType) {
      tasks.push(subagentType ?? "unknown");
    },
    onHumanMessage() {
      tasks.length = 0;
    },
    pending() {
      return tasks.length;
    },
    sequence() {
      return [...tasks];
    },
    check() {
      if (tasks.length >= 3) {
        throw new DenyError(DENY_HITL, { count: tasks.length, sequence: [...tasks] });
      }
      return true;
    },
  };
}

const hitlTrackers = new Map();

export function hitlTrackerFor(sessionID) {
  const key = sessionID ?? "default";
  if (!hitlTrackers.has(key)) hitlTrackers.set(key, createHitlTracker());
  return hitlTrackers.get(key);
}

export function resetHitlTracker(sessionID) {
  if (sessionID === undefined) hitlTrackers.clear();
  else hitlTrackers.delete(sessionID);
}

export async function gateHitlBatch(ctx = {}) {
  if (ctx.tool !== "task") return true;
  const tracker = ctx.hitlTracker ?? hitlTrackerFor(ctx.sessionID);
  tracker.onTask(ctx.args?.subagent_type ?? ctx.args?.subagentType ?? "unknown");
  tracker.check();
  return true;
}

// ---------------------------------------------------------------------------
// GATE-05 — hygiene (I7/I9/RF-06).
//
//   - `pkill -f` in any bash call => deny.
//   - Redirection/tee into a protected path via bash => deny by parse.
//     DECLARED EVADIBLE (H4/ADR-007): indirect forms (interpreters, encoded
//     commands, variable indirection) bypass string parse; CI is the backstop.
//   - qa-engineer writes outside harness/ => deny (subject via session map).
// ---------------------------------------------------------------------------

const SHELL_TOOLS = new Set(["bash", "shell"]);

export function extractBashCommand(args) {
  if (typeof args === "string") return args;
  if (!args || typeof args !== "object") return "";
  for (const key of ["command", "cmd", "script", "code"]) {
    if (typeof args[key] === "string" && args[key].length > 0) return args[key];
  }
  return Object.values(args)
    .filter((value) => typeof value === "string")
    .join("\n");
}

export function isPkillF(command) {
  return /\bpkill\b[^\n&;|]*\s-[A-Za-z]*f/i.test(command ?? "");
}

export function bashProtectedWrites(command, protectedPaths = []) {
  const hits = [];
  const text = command ?? "";
  const redirectPattern = /(>>?)\s*("[^"]+"|'[^']+'|[^\s;&|>"']+)/g;
  let match;
  while ((match = redirectPattern.exec(text)) !== null) {
    const target = normalizePath(match[2]);
    if (target && isProtectedPath(target, protectedPaths)) {
      hits.push({ via: "redirect", target });
    }
  }
  const teePattern = /\btee\b((?:\s+(?:"[^"]+"|'[^']+'|[^\s;&|>"']+))*)/g;
  while ((match = teePattern.exec(text)) !== null) {
    const parts = match[1].match(/"[^"]+"|'[^']+'|[^\s'"]+/g) ?? [];
    for (let part of parts) {
      if (/^-/.test(part)) continue;
      part = normalizePath(part);
      if (part && isProtectedPath(part, protectedPaths)) hits.push({ via: "tee", target: part });
    }
  }
  return hits;
}

export async function gateShellHygiene(ctx = {}) {
  if (!SHELL_TOOLS.has(ctx.tool)) return true;
  const command = extractBashCommand(ctx.args);
  if (isPkillF(command)) throw new DenyError(DENY_PKILL, { tool: ctx.tool });
  const config = ensureConfig(ctx);
  const hits = bashProtectedWrites(command, config?.protectedPaths ?? []);
  // I10: hits carry raw redirect/tee targets (attacker-controlled paths).
  // Details keep only the enum via + basename target, never the full path.
  if (hits.length > 0) {
    throw new DenyError(DENY_PROTECTED, {
      tool: ctx.tool,
      hits: hits.map((h) => ({ via: h.via, target: sanitizePathForDetails(h.target) })),
    });
  }
  return true;
}

// Gate registration (Batch 4/7). GATE-03 contributes both anchors.
// FU-06: each gate carries a gateName so HarnessGate can resolve its mode
// via modeForGate(config, gateFn). Hygiene has no gates.* key on purpose:
// it falls back to DEFAULT_MODE (declared in modeForGate).
registerCoreGate(gatePiccoTask);
registerCoreGate(gateCompletionAnchorA);
registerCoreGate(gatePhaseAnchorB);
registerCoreGate(gateHitlBatch);
registerCoreGate(gateShellHygiene);
gatePiccoTask.gateName = "picco";
gateCompletionAnchorA.gateName = "evidence";
gatePhaseAnchorB.gateName = "evidence";
gateHitlBatch.gateName = "hitlBatch";

function toLogger(client) {
  const appLog = client?.app?.log;
  if (typeof appLog !== "function") return console;
  const send = (level, message) => {
    try {
      appLog({ body: { service: "harness-gate", level, message: String(message) } });
    } catch {
      // Best-effort; never breaks the tool call.
    }
  };
  return { warn: (message) => send("warn", message), error: (message) => send("error", message) };
}

// Runtime plugin entry. Only confirmed hooks are wired (contract §2):
// the deny primitive on the before hook, the session→agent map on
// chat.params, and the human-turn boundary on chat.message. No prose
// injection, no bus-event filtering, no ask hook.
export const HarnessGate = async (input = {}) => {
  const logger = toLogger(input?.client);
  const runGates = async (toolInput, toolOutput) => {
    const sessionID = toolInput?.sessionID;
    const base = {
      tool: toolInput?.tool,
      sessionID,
      callID: toolInput?.callID,
      args: toolOutput?.args,
      defaultMode: DEFAULT_MODE,
      logger,
      // Test/consumer seam: injected config wins; otherwise the file config.
      // A missing config stays null here — each gate denies config-unavailable
      // from INSIDE decide() (FU-05), never as a raw throw here.
      statePath: toolInput?.statePath,
      configPath: toolInput?.configPath,
      // Kill-switch boundary (ADR-009). The ambient HARNESS_GATES=off belongs
      // to the host process and is honored when the plugin loads its own file
      // config. An explicitly injected config marks a hermetic evaluation
      // (test/consumer seam): the caller owns the environment, so the ambient
      // kill-switch must not silently short-circuit a gate before it runs.
      env: toolInput?.env ?? (toolInput?.config ? {} : process.env),
    };
    let config = toolInput?.config ?? null;
    if (!config) {
      try {
        config = loadConfigOrDeny(base.configPath);
      } catch {
        config = null;
      }
    }
    const ctx = {
      ...base,
      config: config ?? undefined,
      sessionAgent: sessionID ? sessionAgentMap.get(sessionID) : undefined,
      // FU-11: workflowState is NEVER loaded here. The eager
      // loadWorkflowState() used to throw DenyError outside decide(),
      // bypassing warn-allows (fail-open on crash would allow, raw throw
      // would crash). Gates load lazily inside decide() via
      // ctx.workflowState ?? loadWorkflowState(ctx.statePath).
      workflowState: undefined,
      publishedSeal: loadPublishedSeal(),
    };
    // Safe eagerly: readEvidenceReport catches every failure (missing or
    // corrupt state/config) and returns null, which anchor A denies
    // fail-closed from inside decide() (fixture completed-no-evidence).
    ctx.report = toolInput?.report ?? readEvidenceReport(ctx);
    for (const gateFn of CORE_GATES) {
      // FU-06: mode per gate, not one global constant. A gate without a
      // gates.* key (hygiene) or without config resolves to DEFAULT_MODE.
      await decide({ gateFn, mode: config ? modeForGate(gateFn, config) : DEFAULT_MODE, ctx, env: base.env, logger });
    }
  };
  return {
    "tool.execute.before": runGates,
    "chat.params": async (chatInput) => {
      try {
        noteChatParams(chatInput);
      } catch {
        // Map maintenance never denies.
      }
    },
    "chat.message": async (messageInput, output) => {
      try {
        if (isHumanMessage(messageInput, output)) {
          resetHitlTracker(messageInput?.sessionID ?? messageInput?.params?.sessionID);
        }
      } catch {
        // Counter maintenance never denies.
      }
    },
  };
};

// V1 plugin module (LOADER-01): the runtime resolves mod.default as an
// { id, server } record BEFORE the legacy Object.values() sweep, which
// throws "Plugin export is not a function" on the string/array unit-test
// exports above and drops the whole plugin. Named exports (incl.
// HarnessGate) stay untouched for the suite. The v2 entry `setup` rides on
// the same default record (dual-export, ADR-001): v1 loaders read `server`,
// v2 runtimes read `setup`. When the v2 host exposes the Plugin global, the
// record is wrapped via Plugin.define (identity with types since 1.18.29+,
// target 1.18.30); otherwise the plain record is exported. `setup` is a
// hoisted function declaration defined in the V2 adapter block below.
export default (typeof globalThis.Plugin?.define === "function"
  ? globalThis.Plugin.define({ id: "harness-gate", server: HarnessGate, setup })
  : { id: "harness-gate", server: HarnessGate, setup });

// ---------------------------------------------------------------------------
// V2 adapter — dual-export v1+v2 (opencode-v2-plugin-migration, PL-02).
//
// SPEC: .spec/backend/opencode-v2-plugin-migration/SPEC.md (§5 H1-H6, §5.1
// shims, ADR-001/002/004). Adapter discipline (a defect is any violation):
//   - Thin adapter, zero deny logic. Every verdict flows through the same
//     `decide` + `CORE_GATES` loop as the v1 `HarnessGate` entry above. Only
//     `throw new DenyError` denies; any other error fail-opens via decide
//     (ADR-006). No new catch converts a generic error into a deny.
//   - Kill-switch unchanged: only host env HARNESS_GATES=off disables
//     (ADR-009); the hermetic-config rule below mirrors HarnessGate exactly.
//   - Confirmed hooks only (PLAN §1.1.1: gate.js:22-24,854-919 plus
//     gate-contract.md plus migrate-v1). Golden rule: a v1 hook with no
//     confirmed v2 equivalent raises a VISIBLE HOOK-NO-EQUIV error at load,
//     never silence. This module never registers the permission prompt hook
//     (H1), never assigns a system-transform scalar (H2), never subscribes a
//     dead bus event (H3), and never claims prose blocking (H5).
//   - H6 normalization reuses the same pure helpers (extractPromptText,
//     extractWriteTargets, extractBashCommand, normalizePath/matchGlob).
//     Shims never log raw args (I10): warnings carry hook names only.
//   - setup() is idempotent per ctx object (second call reports
//     alreadyRegistered without re-registering).
// ---------------------------------------------------------------------------

// Every tool with a gate. `task` covers the PICCO gate, anchor B and the
// HITL pause; write-shaped tools cover completion anchor A; both shell
// literals cover hygiene (H4: the v2 `shell` literal maps into SHELL_TOOLS,
// `bash` stays for v1 parity).
export const V2_TOOL_KEYS = ["task", "write", "edit", "apply_patch", "patch", "bash", "shell"];

// Hooks that must never be registered by this adapter (H1).
// Intentionally narrow: H1 names the single hook; H2 (scalar transform
// output), H3 (dead bus event) and H5 (prose blocking) are not hook names
// and cannot appear in this list — they are enforced structurally instead:
// H2/H3 by static greps (scalar-assign, bus-filter) + the reserved
// ctx.event.subscribe row with name null in V2_HOOK_TABLE below (never
// subscribed this batch), H5 by the no-prose-injection discipline of both
// entries. Widening this list with non-hook strings would give false
// confidence; the table + greps are the enforcement.
export const V2_FORBIDDEN_HOOKS = ["ask"];

// v1 → v2-confirmed table (gap 1 evidence). Sources: RUNTIME-CONTRACT §2
// where present, else PLAN §1.1.1 substitute (gate.js:22-24,854-919 plus
// gate-contract.md plus migrate-v1). ctx.event.subscribe stays reserved:
// the after-observer lands on a confirmed name only, in a later phase (H3).
export const V2_HOOK_TABLE = [
  { v1: "tool.execute.before", v2: { api: "ctx.tool.hook", tool: "task", timing: "before" }, core: "gatePiccoTask, gatePhaseAnchorB, gateHitlBatch via decide", note: "delegation gate, anchor B, HITL pause" },
  { v1: "tool.execute.before", v2: { api: "ctx.tool.hook", tool: "write", timing: "before" }, core: "gateCompletionAnchorA via decide", note: "anchor A path check, both write arg shapes" },
  { v1: "tool.execute.before", v2: { api: "ctx.tool.hook", tool: "edit", timing: "before" }, core: "gateCompletionAnchorA via decide", note: "anchor A path check, both write arg shapes" },
  { v1: "tool.execute.before", v2: { api: "ctx.tool.hook", tool: "apply_patch", timing: "before" }, core: "gateCompletionAnchorA via decide", note: "anchor A patch-text targets" },
  { v1: "tool.execute.before", v2: { api: "ctx.tool.hook", tool: "patch", timing: "before" }, core: "gateCompletionAnchorA via decide", note: "anchor A patch-text targets" },
  { v1: "tool.execute.before", v2: { api: "ctx.tool.hook", tool: "bash", timing: "before" }, core: "gateShellHygiene via decide", note: "H4 parse-based, declared partial, CI backstop" },
  { v1: "tool.execute.before", v2: { api: "ctx.tool.hook", tool: "shell", timing: "before" }, core: "gateShellHygiene via decide", note: "H4 v2 tool literal mapped into SHELL_TOOLS" },
  { v1: "chat.params", v2: { api: "ctx.session.hook", event: "params" }, core: "noteChatParams + recordSessionAgent", note: "session to agent map" },
  { v1: "chat.message", v2: { api: "ctx.session.hook", event: "message" }, core: "isHumanMessage + resetHitlTracker", note: "human-turn boundary" },
  { v1: "tool.execute.after observer (future)", v2: { api: "ctx.event.subscribe", name: null }, core: "none this batch", note: "reserved, subscribe on a confirmed name only" },
];

// v2 tool-hook shim (SPEC §5.1). Normalizes the v2 payload — string vs
// object args (H6), (input, output) pair or single envelope — into the same
// base/ctx shape HarnessGate builds, then runs the identical decide loop.
// Returns { verdict: "allow" }; deny escapes as DenyError via decide.
export async function runGatesShim(v2Payload = {}, v2Output) {
  const twoArgs = v2Output !== undefined;
  const rawInput = twoArgs ? v2Payload : (v2Payload?.toolInput ?? v2Payload?.input ?? v2Payload);
  const rawOutput = twoArgs ? v2Output : (v2Payload?.toolOutput ?? v2Payload?.output ?? v2Payload);
  const toolInput = rawInput && typeof rawInput === "object" ? rawInput : {};
  const toolOutput = rawOutput && typeof rawOutput === "object" ? rawOutput : {};
  const payloadObj = v2Payload && typeof v2Payload === "object" ? v2Payload : {};
  const sessionID = toolInput.sessionID ?? payloadObj.sessionID;
  const logger = toolInput.logger ?? payloadObj.logger ?? console;
  const base = {
    tool: toolInput.tool ?? payloadObj.tool,
    sessionID,
    callID: toolInput.callID ?? payloadObj.callID,
    args:
      toolOutput.args ?? toolInput.args ?? payloadObj.args ??
      (typeof v2Payload === "string" ? v2Payload : undefined),
    defaultMode: DEFAULT_MODE,
    logger,
    statePath: toolInput.statePath ?? payloadObj.statePath,
    configPath: toolInput.configPath ?? payloadObj.configPath,
    env:
      toolInput.env ??
      payloadObj.env ??
      (toolInput.config ?? payloadObj.config ? {} : process.env),
  };
  let config = toolInput.config ?? payloadObj.config ?? null;
  if (!config) {
    try {
      config = loadConfigOrDeny(base.configPath);
    } catch {
      config = null;
    }
  }
  const ctx = {
    ...base,
    config: config ?? undefined,
    sessionAgent:
      toolInput.sessionAgent ??
      payloadObj.sessionAgent ??
      (sessionID ? sessionAgentMap.get(sessionID) : undefined),
    // Optional explicit seams (test/consumer injection only — prod callers
    // leave every one undefined and fall through to the same lazy defaults
    // the v1 HarnessGate uses: workflowState via loadWorkflowState,
    // startsNewCycle via inferNewCycle, hitlTracker via hitlTrackerFor,
    // contraproveExec via defaultContraproveExec, timeoutMs via
    // config.contraproveTimeoutMs, treeHash "unknown" = cache bypass. The
    // seam exists so decide() + CORE_GATES stay pure and unit-testable
    // without MCP/network; narrowing to undefined in prod is the default
    // path, not a separate branch.
    workflowState: toolInput.workflowState ?? payloadObj.workflowState ?? undefined,
    startsNewCycle: toolInput.startsNewCycle ?? payloadObj.startsNewCycle ?? undefined,
    hitlTracker: toolInput.hitlTracker ?? payloadObj.hitlTracker ?? undefined,
    contraproveExec: toolInput.contraproveExec ?? payloadObj.contraproveExec ?? undefined,
    timeoutMs: toolInput.timeoutMs ?? payloadObj.timeoutMs ?? undefined,
    treeHash: toolInput.treeHash ?? payloadObj.treeHash ?? undefined,
    publishedSeal: loadPublishedSeal(),
  };
  ctx.report = toolInput.report ?? payloadObj.report ?? readEvidenceReport(ctx);
  let outcome = { verdict: "allow" };
  for (const gateFn of CORE_GATES) {
    const result = await decide({ gateFn, mode: config ? modeForGate(gateFn, config) : DEFAULT_MODE, ctx, env: base.env, logger });
    if (result && typeof result === "object") {
      if (result.via && !outcome.via) outcome = result;
      else if (!outcome.via) outcome = result;
    }
  }
  return outcome;
}

// v2 session shim for chat.params (SPEC §5.1): same map write as v1.
// Map maintenance never denies.
export function noteChatParamsShim(input = {}) {
  try {
    noteChatParams(input);
  } catch {
    // Map maintenance never denies.
  }
}

// v2 session shim for the human-turn boundary (SPEC §5.1): same reset as
// the v1 chat.message handler. Counter maintenance never denies.
export function humanBoundaryShim(messageInput = {}, output) {
  try {
    if (isHumanMessage(messageInput, output)) {
      resetHitlTracker(messageInput?.sessionID ?? messageInput?.params?.sessionID);
    }
  } catch {
    // Counter maintenance never denies.
  }
}

const v2SetupSeen = new WeakSet();

// v2 plugin entry (ADR-001): registers runGatesShim per gate-bearing tool
// plus the two session shims. Hook without a confirmed equivalent raises a
// visible HOOK-NO-EQUIV error, never silence. A rejected gate-bearing tool
// hook throws GATE-ABSENT:<tool> (fail-closed, never warnings+success: a
// half-registered adapter must not bless an unverified run). A stub
// exposing only tool.hook registers that subset with an explicit session
// warning; zero registrations raise SETUP-REGISTER-FAIL.
// Idempotency note: the WeakSet short-circuit reports alreadyRegistered
// without re-validating host hooks. Documented limitation: hosts retain
// hooks for the ctx lifetime; a host-side reset needs a fresh ctx object
// (no revalidation this batch by design — re-registering on the same ctx
// would double-deny).
export async function setup(ctx = {}) {
  if (v2SetupSeen.has(ctx)) {
    return { id: "harness-gate", registered: [], warnings: [], alreadyRegistered: true };
  }
  const registered = [];
  const warnings = [];
  const toolHook = ctx?.tool?.hook;
  if (typeof toolHook !== "function") {
    throw new Error("HOOK-NO-EQUIV:ctx.tool.hook");
  }
  for (const tool of V2_TOOL_KEYS) {
    try {
      await toolHook(tool, "before", runGatesShim);
      registered.push(`tool:${tool}:before`);
    } catch {
      throw new Error(`GATE-ABSENT:${tool}`);
    }
  }
  const sessionHook = ctx?.session?.hook;
  if (typeof sessionHook === "function") {
    for (const [event, handler] of [["params", noteChatParamsShim], ["message", humanBoundaryShim]]) {
      try {
        await sessionHook(event, handler);
        registered.push(`session:${event}`);
      } catch {
        warnings.push(`HOOK-NO-EQUIV:session:${event}`);
      }
    }
  } else {
    warnings.push("HOOK-NO-EQUIV:session(params,message)");
  }
  if (registered.length === 0) {
    throw new Error("SETUP-REGISTER-FAIL:GATE-ABSENT:all");
  }
  for (const warning of warnings) {
    try {
      console.error(`[harness-gate] ${warning}`);
    } catch {
      // Best-effort; never changes registration.
    }
  }
  v2SetupSeen.add(ctx);
  return { id: "harness-gate", registered, warnings };
}
