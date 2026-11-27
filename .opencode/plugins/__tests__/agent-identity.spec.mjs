import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gateAgentIdentity, DENY_AGENT_UNKNOWN } from "../gate.js";

describe("GATE-06 — identidade de agente", () => {
  it("task sem papel conhecido nega", async () => {
    await assert.rejects(gateAgentIdentity({ tool: "task", args: {} }), (e) => e.reason === DENY_AGENT_UNKNOWN);
  });
  it("task com papel conhecido permite", async () => {
    assert.equal(await gateAgentIdentity({ tool: "task", args: {}, sessionAgent: "orchestrator" }), true);
  });
  it("escrita sensível sem papel conhecido nega", async () => {
    for (const filePath of ["workflow-state.json", "harness/demo.json", ".agents/rules/x.md"]) {
      await assert.rejects(gateAgentIdentity({ tool: "write", args: { filePath, content: "x" }, config: { protectedPaths: [".agents/rules/**"] } }), (e) => e.reason === DENY_AGENT_UNKNOWN);
    }
  });
  it("escrita não sensível com papel conhecido permite", async () => {
    assert.equal(await gateAgentIdentity({ tool: "write", args: { filePath: "src/x.ts", content: "x" }, sessionAgent: "frontend-engineer" }), true);
  });
  it("shell não é afetado pelo gate", async () => {
    assert.equal(await gateAgentIdentity({ tool: "bash", args: { command: "echo ok" } }), true);
  });
});
