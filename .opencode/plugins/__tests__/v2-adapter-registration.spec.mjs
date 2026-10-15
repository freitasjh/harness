// v2-adapter-registration.spec.mjs — PL-02 V2-BE-01 (TDD FIRST).
//
// Asserts the v2 adapter registers every gate-bearing tool via
// ctx.tool.hook(_, "before", runGatesShim) + the two session shims, and
// NEVER registers the forbidden `ask` hook (H1) nor dead bus events (H3).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  setup,
  runGatesShim,
  noteChatParamsShim,
  humanBoundaryShim,
  V2_TOOL_KEYS,
  V2_HOOK_TABLE,
  V2_FORBIDDEN_HOOKS,
} from "../gate.js";

function spyStub() {
  const calls = [];
  return {
    calls,
    ctx: {
      tool: {
        hook: async (tool, timing, handler) => {
          calls.push({ api: "tool.hook", tool, timing, handler });
        },
      },
      session: {
        hook: async (event, handler) => {
          calls.push({ api: "session.hook", event, handler });
        },
      },
      event: {
        subscribe: async (name, handler) => {
          calls.push({ api: "event.subscribe", name, handler });
        },
      },
    },
  };
}

describe("PL-02 V2-BE-01 — v2 adapter registration", () => {
  it("registers one before-hook per gate-bearing tool (GATE-01..05 cover)", async () => {
    const { ctx, calls } = spyStub();
    const result = await setup(ctx);
    assert.ok(Array.isArray(result.registered), "setup returns registered list");
    const toolCalls = calls.filter((c) => c.api === "tool.hook");
    for (const tool of V2_TOOL_KEYS) {
      const hit = toolCalls.find((c) => c.tool === tool && c.timing === "before");
      assert.ok(hit, `tool.hook registered for ${tool}`);
      assert.equal(hit.handler, runGatesShim, `handler for ${tool} is runGatesShim`);
    }
  });

  it("registers both session shims (params + message boundary)", async () => {
    const { ctx, calls } = spyStub();
    await setup({ ...ctx, tool: ctx.tool, session: ctx.session, event: ctx.event });
    const sessionCalls = calls.filter((c) => c.api === "session.hook");
    const params = sessionCalls.find((c) => c.handler === noteChatParamsShim);
    const boundary = sessionCalls.find((c) => c.handler === humanBoundaryShim);
    assert.ok(params, "noteChatParamsShim registered via session.hook");
    assert.ok(boundary, "humanBoundaryShim registered via session.hook");
  });

  it("never registers the forbidden ask hook (H1) on any api", async () => {
    const { ctx, calls } = spyStub();
    await setup(ctx);
    for (const name of V2_FORBIDDEN_HOOKS) {
      const hit = calls.find(
        (c) => c.tool === name || c.event === name || c.name === name,
      );
      assert.equal(hit, undefined, `forbidden hook never registered: ${name}`);
    }
  });

  it("event.subscribe is never called with an unconfirmed (dead) name (H3)", async () => {
    const { ctx, calls } = spyStub();
    await setup(ctx);
    const subs = calls.filter((c) => c.api === "event.subscribe");
    const confirmed = new Set(
      V2_HOOK_TABLE.filter((r) => r.v2.api === "ctx.event.subscribe" && r.v2.name).map(
        (r) => r.v2.name,
      ),
    );
    for (const sub of subs) {
      assert.ok(confirmed.has(sub.name), `event.subscribe only on confirmed name, got ${sub.name}`);
    }
  });

  it("setup twice on the same ctx is idempotent (no duplicate deny)", async () => {
    const { ctx, calls } = spyStub();
    const first = await setup(ctx);
    const countAfterFirst = calls.length;
    assert.ok(first.registered.length > 0, "first setup registers hooks");
    const second = await setup(ctx);
    assert.equal(second.alreadyRegistered, true, "second setup reports alreadyRegistered");
    assert.equal(calls.length, countAfterFirst, "second setup adds no hook calls");
  });
});
