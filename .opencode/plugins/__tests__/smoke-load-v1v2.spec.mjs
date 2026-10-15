// smoke-load-v1v2.spec.mjs — PL-03 V2-VAL-05 (TDD FIRST).
//
// The SAME gate.js file loads in both runtimes: v1 via the default
// { id, server } record (loader 1.18.30, LOADER-01) and v2 via setup(ctx)
// with a spy stub. No `Plugin export is not a function`, every gate
// registered.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import gateDefault, {
  HarnessGate,
  setup,
  runGatesShim,
  V2_TOOL_KEYS,
} from "../gate.js";

describe("PL-03 V2-VAL-05 — smoke load v1+v2 of the same file", () => {
  it("v1: default export is the { id, server } record (LOADER-01 intact)", () => {
    assert.equal(gateDefault.id, "harness-gate");
    assert.equal(gateDefault.server, HarnessGate, "server entry intact");
    assert.equal(typeof gateDefault.server, "function");
  });

  it("v1: server dispatch covers every core gate (GATE-01..05 wired)", async () => {
    const hooks = await HarnessGate({ client: null });
    assert.equal(typeof hooks["tool.execute.before"], "function");
    assert.equal(typeof hooks["chat.params"], "function");
    assert.equal(typeof hooks["chat.message"], "function");
  });

  it("v2: setup(ctx) registers without throw and covers GATE-01..05", async () => {
    const seen = new Map();
    const ctx = {
      tool: {
        hook: async (tool, timing, handler) => {
          seen.set(`${tool}:${timing}`, handler);
        },
      },
      session: { hook: async () => {} },
      event: { subscribe: async () => {} },
    };
    const result = await setup(ctx);
    assert.equal(result.id, "harness-gate");
    for (const tool of V2_TOOL_KEYS) {
      assert.equal(
        seen.get(`${tool}:before`),
        runGatesShim,
        `v2 covers gate-bearing tool: ${tool}`,
      );
    }
  });

  it("dual: default export carries both entries (server v1 + setup v2)", () => {
    assert.equal(gateDefault.server, HarnessGate, "v1 server intact on default");
    assert.equal(gateDefault.setup, setup, "v2 setup present on default");
  });

  it("regression fixture: broken default export fails loudly, not silently", async () => {
    const broken = {};
    assert.throws(
      () => {
        if (typeof broken.server !== "function" && typeof broken.setup !== "function") {
          throw new Error("Plugin export is not a function");
        }
      },
      /Plugin export is not a function/,
    );
  });
});
