import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runAdapter } from "../../.codex/hooks/pre_tool_use.mjs";
import { readState } from "../../.codex/hooks/state.mjs";
import { tempScope } from "../test-temp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const HOOK = path.join(ROOT, ".codex", "hooks", "pre_tool_use.mjs");

describe("ADR-003 — adapter Codex: fail-closed e HITL persistente", () => {
  it("stdin vazio em PreToolUse => exit 2 e invalid-input", () => {
    const r = spawnSync(process.execPath, [HOOK, "--event=PreToolUse"], { input: "" });
    assert.equal(r.status, 2);
    assert.match(r.stderr.toString(), /invalid-input/);
  });

  it("contador HITL não perde update sob chamadas concorrentes", async () => {
    const scope = tempScope({ label: "codex-adapter" });
    const dir = scope.tmp();
    const sp = path.join(dir, "state.json");
    const wf = path.join(dir, "workflow-state.json");
    fs.writeFileSync(wf, JSON.stringify({
      current_feature: "prd-codex-port",
      current_phase: "Completed",
      harness_status: "passed",
      code_review_status: "passed",
    }));
    const event = {
      hook_event_name: "PreToolUse",
      tool_name: "task",
      sessionAgent: "orchestrator",
      tool_input: { prompt: "prd-codex-port <open_questions></open_questions>" },
      session_id: "S1",
      cwd: ROOT,
    };
    const opts = { statePath: sp, workflowStatePath: wf };
    try {
      await Promise.all([runAdapter(event, opts), runAdapter(event, opts)]);
      const st = readState(sp, { strict: true });
      assert.equal(st.hitl.S1.taskCount, 2);
    } finally {
      scope.cleanup();
    }
  });
});
