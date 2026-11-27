import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAYLOAD_DIRS, PAYLOAD_FILES, PATH_CLASSES, mergeClaudeSettings } from "../harness-sync.mjs";
import { mapClaudeTool, handleClaudeEvent, formatClaudeDeny } from "../../.claude/hooks/hook.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8");

describe("camada Claude do harness", () => {
  it("faz parte do payload do instalador", () => {
    for (const dir of [".claude/agents", ".claude/hooks", ".claude/skills"]) {
      assert.ok(PAYLOAD_DIRS.includes(dir), `dir ausente no payload: ${dir}`);
    }
    assert.ok(PAYLOAD_FILES.includes(".claude/settings.json"));
    assert.ok(PATH_CLASSES.attached.includes("CLAUDE.md"));
    assert.ok(!PAYLOAD_FILES.includes("CLAUDE.md"), "CLAUDE.md é anexado, não payload byte-cru");
  });

  it("CLAUDE.md importa AGENTS.md", () => {
    assert.match(read("CLAUDE.md"), /@AGENTS\.md/);
  });

  it("settings registram hooks e permissões protegidas", () => {
    const settings = JSON.parse(read(".claude/settings.json"));
    assert.equal(settings.permissions.defaultMode, "default");
    assert.equal(settings.agent, "orchestrator");
    assert.ok(settings.permissions.allow.includes("Agent"), "Agent deve ser allow para delegação");
    for (const event of ["PreToolUse", "PermissionRequest", "UserPromptSubmit", "SessionStart"]) {
      assert.ok(settings.hooks[event], `hook ausente: ${event}`);
    }
    const commands = JSON.stringify(settings.hooks);
    assert.match(commands, /"command":"node"/);
    assert.match(commands, /\$\{CLAUDE_PROJECT_DIR\}\/\.claude\/hooks\/hook\.mjs/);
    for (const event of Object.values(settings.hooks)) {
      for (const group of event) {
        for (const hook of group.hooks) {
          assert.equal(hook.command, "node");
          assert.deepEqual(hook.args, ["${CLAUDE_PROJECT_DIR}/.claude/hooks/hook.mjs"]);
        }
      }
    }
    const deny = settings.permissions.deny.join(" ");
    for (const pathPattern of ["/.agents/**", "/.codex/**", "/.opencode/**", "/.claude/**"]) {
      assert.ok(deny.includes(pathPattern), `deny ausente: ${pathPattern}`);
    }
  });

  it("publica 11 agents com papéis read-only sem Write/Edit", () => {
    const dir = path.join(REPO, ".claude", "agents");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    assert.equal(files.length, 11);
    for (const file of files) {
      const text = fs.readFileSync(path.join(dir, file), "utf8");
      assert.match(text, /^---\nname: /);
      assert.match(text, /description: .+/);
      assert.match(text, /permissionMode: default/);
    }
    for (const role of ["code-reviewer", "ux-designer", "security-engineer", "design-system-specialist"]) {
      const text = fs.readFileSync(path.join(dir, `${role}.md`), "utf8");
      assert.doesNotMatch(text, /^tools: .*\b(Write|Edit)\b/m, `${role} não é read-only`);
    }
    const orchestrator = fs.readFileSync(path.join(dir, "orchestrator.md"), "utf8");
    assert.match(orchestrator, /^tools: .*\bAgent\b/m);
    assert.match(orchestrator, /## Protocolo Claude Code/);
    assert.match(orchestrator, /ferramenta `Agent`/);
  });

  it("publica skills próprias e exclui as três locked", () => {
    const dir = path.join(REPO, ".claude", "skills");
    const names = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    assert.equal(names.length, 32);
    for (const locked of ["react-components", "react-best-practices", "nestjs-best-practices"]) {
      assert.ok(!names.includes(locked), `skill locked publicada: ${locked}`);
    }
    for (const canonical of ["harness-workflow", "harness-prd", "harness-adr", "harness-review", "harness-bootstrap", "codebase-analysis"]) {
      assert.ok(names.includes(canonical), `skill canônica ausente: ${canonical}`);
    }
  });

  it("merge de settings preserva chaves do projeto e une arrays", () => {
    const merged = mergeClaudeSettings(
      { permissions: { deny: ["Bash(git push *)"] }, hooks: { PreToolUse: [{ matcher: "Bash" }] } },
      { permissions: { deny: ["Read(./.env)"], allow: ["Bash(npm test *)"] }, model: "opus" },
    );
    assert.equal(merged.model, "opus");
    assert.deepEqual(merged.permissions.deny, ["Bash(git push *)", "Read(./.env)"]);
    assert.deepEqual(merged.permissions.allow, ["Bash(npm test *)"]);
    assert.equal(merged.hooks.PreToolUse.length, 1);
  });

  it("merge remove hook legado com command contendo o caminho", () => {
    const legacy = {
      hooks: {
        SessionStart: [{
          hooks: [{
            type: "command",
            command: "node \"${CLAUDE_PROJECT_DIR}/.claude/hooks/hook.mjs\"",
            args: [],
          }],
        }],
      },
    };
    const merged = mergeClaudeSettings(JSON.parse(read(".claude/settings.json")), legacy);
    const handlers = merged.hooks.SessionStart.flatMap((group) => group.hooks);
    assert.equal(handlers.length, 1);
    assert.equal(handlers[0].command, "node");
    assert.deepEqual(handlers[0].args, ["${CLAUDE_PROJECT_DIR}/.claude/hooks/hook.mjs"]);
  });

  it("mapeia ferramentas Claude para o contrato do harness", () => {
    assert.equal(mapClaudeTool("Agent"), "task");
    assert.equal(mapClaudeTool("NotebookEdit"), "edit");
    assert.equal(mapClaudeTool("Bash"), "bash");
    assert.equal(mapClaudeTool("Write"), "write");
  });

  it("formata deny no shape de cada evento", async () => {
    const gateModule = {
      runGatesShim: async () => {
        const err = new Error("protected-path-write");
        err.name = "DenyError";
        err.reason = "protected-path-write";
        throw err;
      },
    };
    const pre = await handleClaudeEvent({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "/repo/.agents/rules/x.md" } }, { projectDir: REPO, gateModule });
    assert.equal(pre.output.hookSpecificOutput.permissionDecision, "deny");
    assert.equal(pre.output.hookSpecificOutput.permissionDecisionReason, "protected-path-write");
    const perm = await handleClaudeEvent({ hook_event_name: "PermissionRequest", tool_name: "Bash", tool_input: { command: "git push" } }, { projectDir: REPO, gateModule });
    assert.equal(perm.output.hookSpecificOutput.decision.behavior, "deny");
    assert.deepEqual(formatClaudeDeny("SessionStart", "x"), { continue: false, stopReason: "x" });
  });
});
