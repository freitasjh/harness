// v2-adapter-registration.spec.mjs — PL-02 V2-BE-01, UPDATED to the measured
// v2-only contract (opencode-v2-only, EX2-VAL-03).
//
// Asserts the v2 adapter registers the SINGLE confirmed tool hook
// `ctx.tool.hook("execute.before", runGatesShim)` and the confirmed
// turn-boundary event stream `ctx.event.subscribe()`, never registers the
// forbidden `ask` hook (H1), and is idempotent per ctx.
//
// Retired (belonged to the removed dual shape):
//   - "one before-hook per gate-bearing tool" -> v2 registers ONE hook; the
//     per-tool filter lives in the pure cores.
//   - "both session shims (params + message)"  -> the v1 session.hook surface
//     is gone; the agent identity rides the execute.before payload and the
//     turn boundary rides the confirmed event stream.
//   - "event.subscribe only on a confirmed name" -> the confirmed stream takes
//     NO name; the prohibition is now "never a named/dual event".
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  setup,
  runGatesShim,
  V2_TOOL_HOOK,
  V2_FORBIDDEN_HOOKS,
} from "../gate.js";

function spyStub() {
  const calls = [];
  return {
    calls,
    ctx: {
      tool: {
        hook: async (tool, handler) => {
          calls.push({ api: "tool.hook", tool, handler });
        },
      },
      session: {
        hook: async (event, handler) => {
          calls.push({ api: "session.hook", event, handler });
        },
      },
      event: {
        subscribe: () => {
          calls.push({ api: "event.subscribe" });
          return { [Symbol.asyncIterator]: async function* () {} };
        },
      },
    },
  };
}

describe("PL-02 V2-BE-01 — v2 adapter registration (measured contract)", () => {
  it("registers the single execute.before hook with runGatesShim", async () => {
    const { ctx, calls } = spyStub();
    const result = await setup(ctx);
    assert.equal(result, undefined, "setup returns undefined");
    const toolCalls = calls.filter((c) => c.api === "tool.hook");
    assert.equal(toolCalls.length, 1, "a single registration covers every gate-bearing tool");
    assert.equal(toolCalls[0].tool, V2_TOOL_HOOK);
    assert.equal(toolCalls[0].handler, runGatesShim, "handler is runGatesShim");
  });

  it("registers the confirmed turn-boundary stream (no session.hook surface)", async () => {
    const { ctx, calls } = spyStub();
    await setup(ctx);
    const subs = calls.filter((c) => c.api === "event.subscribe");
    assert.equal(subs.length, 1, "one confirmed subscription");
    assert.equal(subs[0].name, undefined, "the confirmed stream takes no name");
    assert.equal(
      calls.filter((c) => c.api === "session.hook").length,
      0,
      "the v1 session.hook surface is not used",
    );
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

  it("setup twice on the same ctx is idempotent (no duplicate deny, still undefined)", async () => {
    const { ctx, calls } = spyStub();
    const first = await setup(ctx);
    const countAfterFirst = calls.length;
    assert.equal(first, undefined);
    assert.ok(countAfterFirst > 0, "first setup registers hooks");
    const second = await setup(ctx);
    assert.equal(second, undefined, "second setup returns undefined");
    assert.equal(calls.length, countAfterFirst, "second setup adds no hook calls");
  });
});
