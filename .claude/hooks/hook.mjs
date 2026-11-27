#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

const TOOL_MAP = {
  Agent: "task",
  Bash: "bash",
  Edit: "edit",
  Write: "write",
  NotebookEdit: "edit",
  PowerShell: "bash",
};

export function mapClaudeTool(toolName) {
  if (typeof toolName !== "string" || toolName.length === 0) return "unknown";
  return TOOL_MAP[toolName] ?? toolName;
}

export function normalizeClaudeEvent(input = {}, projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd()) {
  const root = resolve(projectDir);
  const tool = mapClaudeTool(input.tool_name);
  const agentType = typeof input.agent_type === "string" ? input.agent_type : undefined;
  return {
    tool,
    sessionID: input.session_id,
    callID: input.tool_use_id ?? input.prompt_id,
    correlationId: input.prompt_id ?? randomUUID(),
    agent: agentType,
    sessionAgent: agentType,
    args: input.tool_input && typeof input.tool_input === "object" ? input.tool_input : {},
    cwd: input.cwd,
    env: process.env,
    configPath: resolve(root, "harness.config.json"),
    statePath: resolve(root, "workflow-state.json"),
    logger: { warn() {}, error() {} },
  };
}

export function formatClaudeDeny(eventName, reason) {
  if (eventName === "PreToolUse") {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: String(reason ?? "deny"),
      },
    };
  }
  if (eventName === "PermissionRequest") {
    return {
      hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: { behavior: "deny", message: String(reason ?? "deny") },
      },
    };
  }
  return { continue: false, stopReason: String(reason ?? "deny") };
}

export async function handleClaudeEvent(input = {}, deps = {}) {
  const projectDir = deps.projectDir ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const eventName = String(input?.hook_event_name ?? "");
  if (!["PreToolUse", "PermissionRequest", "UserPromptSubmit", "SessionStart"].includes(eventName)) {
    return { output: null, exitCode: 0 };
  }
  const gateModule = deps.gateModule ?? (await import(new URL("../../.opencode/plugins/gate.js", import.meta.url).href));
  const ctx = normalizeClaudeEvent(input, projectDir);
  try {
    const result = await gateModule.runGatesShim(ctx);
    if (result?.verdict === "deny") return { output: formatClaudeDeny(eventName, result.reason), exitCode: 0 };
    return { output: null, exitCode: 0 };
  } catch (err) {
    if (err && err.name === "DenyError") return { output: formatClaudeDeny(eventName, err.reason), exitCode: 0 };
    return { output: null, exitCode: 0 };
  }
}

async function main() {
  let raw = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) raw += chunk;
  let event = null;
  try { event = raw.trim() ? JSON.parse(raw) : {}; } catch { event = {}; }
  const result = await handleClaudeEvent(event);
  if (result.output) process.stdout.write(`${JSON.stringify(result.output)}\n`);
  process.exitCode = result.exitCode;
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  await main();
}
