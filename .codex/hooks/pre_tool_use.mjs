import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { runGatesShim, DenyError, isKillSwitchOff, DENY_HITL } from "../../.opencode/plugins/gate.js";
import { normalizePath, parsePatchPaths, KNOWN_AGENTS } from "../../.opencode/plugins/lib/gate-core.mjs";
import * as state from "./state.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const ALLOWED_TOOLS = new Set([
  "Bash", "bash", "shell", "apply_patch", "patch", "write", "edit", "task",
]);

export function isAllowedToolName(name) {
  if (typeof name !== "string" || name.length === 0) return false;
  if (ALLOWED_TOOLS.has(name)) return true;
  // MCP: apenas nomes com separador real (mcp__server__tool ou mcp-server-tool)
  if (/^mcp[_-].+[_-].+/i.test(name)) return true;
  if (/^mcp__/.test(name)) return true;
  return false;
}

export function canonicalizePath(raw) {
  if (typeof raw !== "string") return { ok: false, path: "" };
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, path: "" };
  if (trimmed.startsWith("/") || trimmed.startsWith("~") || trimmed.startsWith("\\")) {
    return { ok: false, path: "" };
  }
  const n = normalizePath(raw);
  if (!n) return { ok: false, path: "" };
  const segments = n.split("/");
  if (segments.includes("..")) return { ok: false, path: n };
  if (raw.includes('"') || raw.includes("'")) {
    return { ok: false, path: n || "" };
  }
  return { ok: true, path: n };
}

export function canonicalizeAllPaths(event) {
  const problems = [];
  const paths = [];
  const ti = event?.tool_input && typeof event.tool_input === "object" ? event.tool_input : {};
  // direct path fields
  for (const key of ["filePath", "file_path", "path", "file", "filename", "target"]) {
    if (typeof ti[key] === "string") {
      const r = canonicalizePath(ti[key]);
      if (!r.ok) problems.push(ti[key]);
      else paths.push(r.path);
    }
  }
  // patch text fields
  for (const key of ["patchText", "patch", "diff", "content", "newContent", "data"]) {
    if (typeof ti[key] === "string" && ti[key].length > 0) {
      for (const p of parsePatchPaths(ti[key])) {
        const r = canonicalizePath(p);
        if (!r.ok) problems.push(p);
        else paths.push(r.path);
      }
    }
  }
  // command extraction (NF-03)
  if (typeof ti.command === "string" && ti.command.length > 0) {
    for (const p of parsePatchPaths(ti.command)) {
      const r = canonicalizePath(p);
      if (!r.ok) problems.push(p);
      else paths.push(r.path);
    }
    // also extract quoted path-ish tokens? keep minimal: parsePatchPaths only
  }
  return { ok: problems.length === 0, paths, problems };
}

export function deriveAgent(event, st) {
  // never read tool_input for identity (C-01)
  const session = event?.session || event?.sessionContext || event?.context?.session;
  const candidates = [
    session?.agent,
    event?.sessionAgent,
    event?.session_agent,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && KNOWN_AGENTS.has(c)) return c;
  }
  const sid = event?.session_id || event?.sessionId;
  if (sid && st && st.sessions && st.sessions[sid] && typeof st.sessions[sid].agent === "string") {
    const a = st.sessions[sid].agent;
    if (KNOWN_AGENTS.has(a)) return a;
  }
  return "unknown";
}

export function validateEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) return false;
  if (typeof event.tool_name !== "string" || event.tool_name.length === 0) return false;
  if (event.tool_input !== undefined && (typeof event.tool_input !== "object" || event.tool_input === null || Array.isArray(event.tool_input))) {
    return false;
  }
  return true;
}

export function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
    // if no stdin (tty), resolve quickly
    if (process.stdin.isTTY) resolve("");
  });
}

export async function parseStdin() {
  const raw = await readStdin();
  if (raw.trim() === "") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined; // invalid
  }
}

export function emitDeny(reason, mode = "json") {
  const r = String(reason ?? "deny");
  if (mode === "exit2") {
    process.stderr.write(r + "\n");
    process.exitCode = 2;
    return { exitCode: 2, stderr: r };
  }
  const payload = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: r,
    },
  };
  process.stdout.write(JSON.stringify(payload));
  process.exitCode = 0;
  return { exitCode: 0, stdout: JSON.stringify(payload) };
}

export function logBypass(sessionId, gate = "all") {
  const entry = {
    timestamp: new Date().toISOString(),
    gate,
    sessionId: sessionId ?? "unknown",
    reason: "kill-switch",
  };
  // stderr sink
  try { process.stderr.write(JSON.stringify(entry) + "\n"); } catch {}
  // file sink 0600 with rotation
  try {
    const dir = path.join(REPO_ROOT, ".codex");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "bypass.log");
    const MAX = 1024 * 1024;
    try {
      const st = fs.statSync(file);
      if (st.size >= MAX) {
        try { fs.renameSync(file, file + ".1"); } catch {}
      }
    } catch {}
    const fd = fs.openSync(file, "a", 0o600);
    fs.writeSync(fd, JSON.stringify(entry) + "\n");
    fs.closeSync(fd);
    try { fs.chmodSync(file, 0o600); } catch {}
  } catch {}
  return entry;
}

export async function runAdapter(event, opts = {}) {
  const mode = opts.denyMode || process.env.HARNESS_CODEX_DENY_MODE || "json";
  const codexStatePath = opts.statePath || state.resolveStatePath(REPO_ROOT);
  const workflowStatePath = opts.workflowStatePath || path.join(REPO_ROOT, "workflow-state.json");

  // kill-switch (host env) — bypass before any state read
  if (isKillSwitchOff(process.env)) {
    logBypass(event?.session_id || event?.sessionId, "all");
    return { verdict: "allow", via: "kill-switch" };
  }

  let st = {};
  try {
    st = state.readState(codexStatePath, { strict: true });
  } catch {
    emitDeny("state-corrupt", mode);
    return { verdict: "deny", reason: "state-corrupt" };
  }

  // input validation (fail-closed)
  if (event === null || event === undefined || event === false) {
    emitDeny("invalid-input", "exit2");
    return { verdict: "deny", reason: "invalid-input" };
  }
  if (typeof event === "string") {
    try { event = JSON.parse(event); } catch { emitDeny("invalid-input", "exit2"); return { verdict: "deny", reason: "invalid-input" }; }
  }
  if (!validateEvent(event)) {
    emitDeny("invalid-input", "exit2");
    return { verdict: "deny", reason: "invalid-input" };
  }

  // tool_name allowlist
  if (!isAllowedToolName(event.tool_name)) {
    emitDeny("unknown-tool", mode);
    return { verdict: "deny", reason: "unknown-tool" };
  }

  // canonicalize paths
  const canon = canonicalizeAllPaths(event);
  if (!canon.ok) {
    emitDeny("protected-path-write", mode);
    return { verdict: "deny", reason: "protected-path-write" };
  }

  const agent = deriveAgent(event, st);

  // HITL tracker persistente injetado no shim (I6). Cada hook é um processo
  // novo: o contador em memória de gate.js não sobrevive entre chamadas.
  const sid = event.session_id || event.sessionId;
  const countOf = (snap) => Number(snap?.hitl?.[sid]?.taskCount) || 0;
  const hitlTracker = {
    onTask(subagentType) {
      // Incrementa DENTRO do lock: origem é o estado travado, não memória do processo.
      state.updateState(codexStatePath, (cur) => {
        const next = { ...(cur || {}) };
        if (!next.hitl || typeof next.hitl !== "object") next.hitl = {};
        next.hitl[sid] = { taskCount: countOf(next) + 1, last: subagentType ?? "unknown" };
        return next;
      });
    },
    onHumanMessage() {
      state.updateState(codexStatePath, (cur) => state.resetHitlCounter(cur || {}, sid));
    },
    pending() { return countOf(state.readState(codexStatePath)); },
    sequence() {
      const count = countOf(state.readState(codexStatePath));
      return Array.from({ length: count }, () => "persisted");
    },
    check() {
      const count = countOf(state.readState(codexStatePath, { strict: true }));
      if (count >= 3) {
        throw new DenyError(DENY_HITL, { count, sequence: Array.from({ length: count }, () => "persisted") });
      }
      return true;
    },
  };

  // build payload for runGatesShim
  const toolNameLower = String(event.tool_name).toLowerCase();
  const payload = {
    tool: toolNameLower === "bash" ? "bash" :
          toolNameLower === "shell" ? "shell" :
          toolNameLower,
    sessionID: event.session_id || event.sessionId,
    agent,
    input: event.tool_input && typeof event.tool_input === "object" ? event.tool_input : {},
    args: event.tool_input && typeof event.tool_input === "object" ? event.tool_input : {},
    cwd: event.cwd,
    env: process.env,
    configPath: opts.configPath,
    statePath: workflowStatePath,
    hitlTracker,
  };

  try {
    const result = await runGatesShim(payload);
    if (result && result.verdict === "allow") {
      return result;
    }
    if (result && result.verdict === "deny") {
      emitDeny(result.reason || "deny", mode);
      return result;
    }
    return result || { verdict: "allow" };
  } catch (err) {
    if (err instanceof DenyError) {
      emitDeny(err.reason, mode);
      return { verdict: "deny", reason: err.reason };
    }
    // fail-open for unexpected
    process.stderr.write(`plugin-error-fail-open: ${err?.message || err}\n`);
    return { verdict: "allow", via: "plugin-error-fail-open" };
  }
}

export async function handleUserPromptSubmit(event) {
  const statePath = state.resolveStatePath(REPO_ROOT);
  const sid = event?.session_id || event?.sessionId;
  state.updateState(statePath, (s) => {
    state.resetHitlCounter(s, sid);
    return s;
  });
  return { verdict: "allow" };
}

export async function handleSessionStart(event) {
  const limit = 2500;
  const ctx = "Harness session context (placeholder).";
  const out = {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: ctx,
    },
  };
  // ensure within token budget (rough chars/4)
  if (ctx.length / 4 > limit) {
    out.hookSpecificOutput.additionalContext = ctx.slice(0, limit * 4);
  }
  process.stdout.write(JSON.stringify(out));
  process.exitCode = 0;
  return { verdict: "allow" };
}

export async function handleSubagentStart(event) {
  const statePath = state.resolveStatePath(REPO_ROOT);
  const sid = event?.session_id || event?.sessionId;
  const agent = deriveAgent(event, state.readState(statePath));
  state.updateState(statePath, (s) => {
    state.recordSessionAgentState(s, sid, agent);
    return s;
  });
  return { verdict: "allow" };
}

export async function handleSubagentStop(event) {
  return { verdict: "allow" };
}

export async function handleStop(event) {
  return { verdict: "allow" };
}

export async function main(argv = process.argv.slice(2)) {
  const eventFlag = argv.find((a) => a.startsWith("--event="));
  const eventName = eventFlag ? eventFlag.split("=")[1] : "PreToolUse";

  const raw = await parseStdin();
  if (raw === undefined) {
    // invalid JSON
    if (eventName === "PreToolUse" || eventName === "PermissionRequest") {
      emitDeny("invalid-input", "exit2");
    }
    process.exitCode = process.exitCode || 2;
    return;
  }
  const event = raw === null ? {} : raw;

  if (eventName === "UserPromptSubmit") {
    await handleUserPromptSubmit(event);
    return;
  }
  if (eventName === "SessionStart") {
    await handleSessionStart(event);
    return;
  }
  if (eventName === "SubagentStart") {
    await handleSubagentStart(event);
    return;
  }
  if (eventName === "SubagentStop") {
    await handleSubagentStop(event);
    return;
  }
  if (eventName === "Stop") {
    await handleStop(event);
    return;
  }
  // PreToolUse / PermissionRequest — stdin ausente => invalid-input (fail-closed)
  await runAdapter(event);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  main().catch((err) => {
    process.stderr.write(`plugin-error-fail-open: ${err?.message || err}\n`);
    process.exitCode = 0;
  });
}
