import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decide, DenyError, DEFAULT_MODE, persistGateTelemetry } from "../gate.js";
import { tempScope } from "../../../scripts/test-temp.mjs";

const TMP = tempScope({ label: "gate-telemetry" });
afterEach(() => TMP.cleanup());
after(() => TMP.cleanup());

const baseCtx = { tool: "bash", sessionID: "session-1", sessionAgent: "qa-engineer", correlationId: "corr-1" };

describe("telemetria por gate", () => {
  it("allow emite decisão com campos mínimos e sem detalhes", async () => {
    const events = [];
    const verdict = await decide({ gateFn: async () => {}, mode: DEFAULT_MODE, ctx: baseCtx, env: {}, telemetry: (e) => events.push(e) });
    assert.equal(verdict.verdict, "allow");
    assert.deepEqual(events, [{
      event: "gate_decision", correlationId: "corr-1", session: "session-1", gate: "unnamed",
      tool: "bash", agent: "qa-engineer", mode: DEFAULT_MODE, decision: "allow", reason: null,
    }]);
  });

  it("deny emite reason sem details", async () => {
    const events = [];
    const gateFn = async () => { throw new DenyError("test-deny", { secretish: "nunca sai" }); };
    await assert.rejects(decide({ gateFn, mode: DEFAULT_MODE, ctx: baseCtx, env: {}, telemetry: (e) => events.push(e) }));
    assert.equal(events[0].decision, "deny");
    assert.equal(events[0].reason, "test-deny");
    assert.equal(JSON.stringify(events).includes("secretish"), false);
  });

  it("warn e kill-switch são registrados", async () => {
    const events = [];
    const gateFn = async () => { throw new DenyError("picco-tag-absent"); };
    await decide({ gateFn, mode: "warn", ctx: baseCtx, env: {}, telemetry: (e) => events.push(e) });
    assert.equal(events[0].decision, "warn");
    await decide({ gateFn, mode: DEFAULT_MODE, ctx: baseCtx, env: { HARNESS_GATES: "off" }, telemetry: (e) => events.push(e) });
    assert.equal(events[1].reason, "kill-switch");
  });

  it("persiste uma linha JSON por evento", () => {
    const dir = TMP.tmp();
    const file = join(dir, "telemetry.jsonl");
    const event = { event: "gate_decision", correlationId: "corr-2", session: "s", gate: "identity", tool: "task", agent: "orchestrator", mode: "enforce", decision: "deny", reason: "agent-unknown" };
    persistGateTelemetry(event, file);
    const lines = readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(lines, [event]);
  });
});
