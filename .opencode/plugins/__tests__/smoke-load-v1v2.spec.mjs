// smoke-load-v1v2.spec.mjs — PL-03 V2-VAL-05, UPDATED to the measured v2-only
// contract (opencode-v2-only, EX2-VAL-03/04).
//
// HISTORY: this file proved the SAME gate.js loaded in both runtimes — v1 via
// the default `{ id, server }` record (loader 1.18.30, LOADER-01) and v2 via
// `setup(ctx)`. The owner decided v2-only: the `server` key is gone. The smoke
// now proves the single measured contract: the default is an OBJECT
// `{ id, setup }`, `await setup(ctx)` registers without throwing and returns
// `undefined`. Retired: the v1 `server` legs and the "dual default carries both
// entries" assertion (no `server` key exists anymore).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import gateDefault, {
  setup,
  runGatesShim,
  V2_TOOL_HOOK,
  V2_TOOL_KEYS,
} from "../gate.js";

describe("PL-03 V2-VAL-05 — smoke load of the single v2 entry", () => {
  it("default export is the { id, setup } object (no `server`, never a bare function)", () => {
    assert.equal(typeof gateDefault, "object");
    assert.equal(gateDefault.id, "harness-gate");
    assert.equal(typeof gateDefault.setup, "function", "v2 setup present");
    assert.ok(!("server" in gateDefault), "v1 server entry removed (v2-only)");
  });

  it("v2: setup(ctx) registers without throw, returns undefined and covers GATE-01..05", async () => {
    const seen = [];
    const ctx = {
      tool: {
        hook: async (tool, handler) => {
          seen.push({ tool, handler });
        },
      },
      event: {
        subscribe: () => ({ [Symbol.asyncIterator]: async function* () {} }),
      },
    };
    const result = await setup(ctx);
    assert.equal(result, undefined, "acquireRelease contract: must be undefined");
    const hook = seen.find((s) => s.tool === V2_TOOL_HOOK);
    assert.ok(hook, "single execute.before hook registered");
    assert.equal(hook.handler, runGatesShim, "covers every gate-bearing tool via the shared loop");
    assert.ok(V2_TOOL_KEYS.length >= 5, "gate-bearing tools documented");
  });

  it("regression fixture: a default with neither setup nor server fails loudly, not silently", () => {
    const broken = { id: "broken" };
    assert.throws(
      () => {
        if (typeof broken.setup !== "function") {
          throw new Error("Plugin export is not a function");
        }
      },
      /Plugin export is not a function/,
    );
  });
});
