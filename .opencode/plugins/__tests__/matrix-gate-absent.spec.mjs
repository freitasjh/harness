// matrix-gate-absent.spec.mjs — PL-07 V2-VAL-11 (anomalia 🟠).
//
// Golden-rule companion: a gate with no registration must FAIL LOUDLY as
// GATE-ABSENT:<id> — never an allow silencioso (EoP). For every
// gate-bearing tool key, a stub whose hook rejects that tool must THROW
// GATE-ABSENT:<tool> (fail-closed). The v1 entry must expose all three
// hooks (never silently absent), and the v2 entry must cover all five
// core gates with no silent gap.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HarnessGate,
  setup,
  runGatesShim,
  noteChatParamsShim,
  humanBoundaryShim,
  listCoreGates,
  V2_TOOL_KEYS,
  V2_HOOK_TABLE,
} from "../gate.js";

function failingStub(failTool) {
  const calls = [];
  const ctx = {
    tool: {
      hook: async (tool, timing, handler) => {
        if (tool === failTool) throw new Error(`stub rejects tool:${tool}`);
        calls.push({ api: "tool.hook", tool, timing, handler });
      },
    },
    session: {
      hook: async (event, handler) => {
        calls.push({ api: "session.hook", event, handler });
      },
    },
    event: { subscribe: async () => {} },
  };
  return { ctx, calls };
}

describe("PL-07 V2-VAL-11 — 🟠 gate-ausente fails loudly per gate (never silent allow)", () => {
  for (const tool of V2_TOOL_KEYS) {
    it(`missing tool hook "${tool}" throws visible GATE-ABSENT:${tool} (never warnings+success)`, async () => {
      const { ctx, calls } = failingStub(tool);
      await assert.rejects(setup(ctx), new RegExp(`GATE-ABSENT:${tool}`));
      assert.equal(
        calls.find((c) => c.api === "tool.hook" && c.tool === tool),
        undefined,
        `rejected tool never registered: ${tool}`,
      );
    });
  }

  it("setup with no tool hook at all throws HOOK-NO-EQUIV (never silent)", async () => {
    await assert.rejects(setup({}), /HOOK-NO-EQUIV/);
    await assert.rejects(
      setup({ session: { hook: async () => {} } }),
      /HOOK-NO-EQUIV:ctx\.tool\.hook/,
    );
  });

  it("v1 server entry exposes every hook (deny primitive + map + boundary)", async () => {
    const hooks = await HarnessGate({});
    for (const name of ["tool.execute.before", "chat.params", "chat.message"]) {
      assert.equal(typeof hooks[name], "function", `v1 hook present, never silently absent: ${name}`);
    }
  });

  it("CORE_GATES holds GATE-01..05 (5 gates) and v2 covers each gate-bearing tool", async () => {
    const gates = listCoreGates();
    assert.equal(gates.length, 5, `5 core gates registered, got ${gates.length}`);
    const calls = [];
    const ctx = {
      tool: {
        hook: async (tool, timing, handler) => {
          calls.push({ tool, timing, handler });
        },
      },
      session: { hook: async () => {} },
      event: { subscribe: async () => {} },
    };
    const result = await setup(ctx);
    for (const tool of V2_TOOL_KEYS) {
      const hit = calls.find((c) => c.tool === tool && c.timing === "before");
      assert.ok(hit, `GATE-COVER: v2 registers gate-bearing tool ${tool}`);
      assert.equal(hit.handler, runGatesShim, "single shared deny loop (no per-gate fork)");
    }
    // Session shims share the v1 maps (no parallel identity source).
    const sessionCalls = [];
    const ctx2 = {
      tool: { hook: async () => {} },
      session: {
        hook: async (event, handler) => {
          sessionCalls.push({ event, handler });
        },
      },
      event: { subscribe: async () => {} },
    };
    await setup(ctx2);
    assert.ok(sessionCalls.some((c) => c.handler === noteChatParamsShim), "params shim registered");
    assert.ok(sessionCalls.some((c) => c.handler === humanBoundaryShim), "boundary shim registered");
    // No dead bus subscription hides a missing gate (H3).
    const deadRows = V2_HOOK_TABLE.filter((r) => r.v2.api === "ctx.event.subscribe" && r.v2.name);
    assert.equal(deadRows.length, 0, "zero subscribed dead events — nothing silently unfired");
    assert.ok(result.registered.length >= V2_TOOL_KEYS.length, "no silent registration gap");
  });
});
