// matrix-gate-absent.spec.mjs — PL-07 V2-VAL-11 (anomalia 🟠), UPDATED to the
// measured v2-only contract (opencode-v2-only, EX2-VAL-03).
//
// Golden-rule companion: a gate with no registration must FAIL LOUDLY — never
// an allow silencioso (EoP). In the v1/dual model each gate-bearing tool got
// its own hook, so a rejected tool produced `GATE-ABSENT:<tool>`. The measured
// v2 contract registers ONE `execute.before` hook for every tool, so the
// visible failure is `GATE-ABSENT:execute.before`; a ctx with no tool hook
// raises `HOOK-NO-EQUIV`. Retired: the per-tool `GATE-ABSENT:<tool>` rows and
// the v1 `server`-entry coverage (both belonged to the removed dual shape).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  setup,
  runGatesShim,
  listCoreGates,
  V2_TOOL_HOOK,
  V2_TOOL_KEYS,
  V2_HOOK_TABLE,
} from "../gate.js";

function failingStub(failTool) {
  const calls = [];
  const ctx = {
    tool: {
      hook: async (tool, handler) => {
        if (tool === failTool) throw new Error(`stub rejects tool:${tool}`);
        calls.push({ api: "tool.hook", tool, handler });
      },
    },
    event: {
      subscribe: () => {
        calls.push({ api: "event.subscribe" });
        return { [Symbol.asyncIterator]: async function* () {} };
      },
    },
  };
  return { ctx, calls };
}

describe("PL-07 V2-VAL-11 — 🟠 gate-ausente fails loudly (never silent allow)", () => {
  it(`a rejected "${V2_TOOL_HOOK}" registration throws visible GATE-ABSENT:${V2_TOOL_HOOK}`, async () => {
    const { ctx, calls } = failingStub(V2_TOOL_HOOK);
    await assert.rejects(setup(ctx), new RegExp(`GATE-ABSENT:${V2_TOOL_HOOK}`));
    assert.equal(
      calls.find((c) => c.api === "tool.hook"),
      undefined,
      "rejected registration never recorded",
    );
  });

  it("setup with no tool hook at all throws HOOK-NO-EQUIV (never silent)", async () => {
    await assert.rejects(setup({}), /HOOK-NO-EQUIV/);
    await assert.rejects(
      setup({ event: { subscribe: () => {} } }),
      /HOOK-NO-EQUIV:ctx\.tool\.hook/,
    );
  });

  it("CORE_GATES holds GATE-01..05 (5 gates) and the single v2 hook covers every gate-bearing tool", async () => {
    const gates = listCoreGates();
    assert.equal(gates.length, 5, `5 core gates registered, got ${gates.length}`);
    const calls = [];
    const ctx = {
      tool: {
        hook: async (tool, handler) => {
          calls.push({ tool, handler });
        },
      },
      event: {
        subscribe: () => ({ [Symbol.asyncIterator]: async function* () {} }),
      },
    };
    const result = await setup(ctx);
    assert.equal(result, undefined, "setup returns undefined");
    const toolCalls = calls.filter((c) => c.tool === V2_TOOL_HOOK);
    assert.equal(toolCalls.length, 1, "one registration covers every gate-bearing tool");
    assert.equal(toolCalls[0].handler, runGatesShim, "single shared deny loop (no per-gate fork)");
    assert.ok(V2_TOOL_KEYS.length >= 5, "the single hook documents every gate-bearing tool");
    // No dead bus subscription hides a missing gate (H3): the one subscribed
    // row names the confirmed turn-boundary stream, not a nonexistent event.
    const subscribed = V2_HOOK_TABLE.filter((r) => r.v2.api === "ctx.event.subscribe" && r.v2.name);
    assert.equal(subscribed.length, 1, "exactly one confirmed subscription — nothing silently unfired");
  });
});
