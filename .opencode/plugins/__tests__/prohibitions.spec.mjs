// prohibitions.spec.mjs — PL-08 V2-VAL-14 (TDD FIRST, Contract).
//
// Negative prohibitions H1/H2/H3/H5 enforced two ways: statically (precise
// source patterns — a bare `grep ask` is VACUOUS because "task"/"mask"
// contain "ask", so every pattern below anchors on registration syntax)
// and at runtime (the setup spy must show zero forbidden registrations
// while every gate-bearing tool IS registered).
//
//   H1: never register the permission prompt hook ("ask") — gate.js:22-24.
//   H2: never assign a system-transform scalar (G14) — validator/guardrail
//       stay no-op, zero DenyError, zero `throw new`.
//   H3: never subscribe a dead bus event — event.subscribe rows stay
//       reserved (name null) and setup() never calls subscribe.
//   H5: never claim prose blocking — no prose-named hook, no prose deny/block
//       identifier; the runtime registry must show no prose-named handler.
//   H4 is declared PARTIAL (evadible parse, CI backstop) — never green.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  setup,
  runGatesShim,
  noteChatParamsShim,
  humanBoundaryShim,
  V2_TOOL_KEYS,
  V2_HOOK_TABLE,
} from "../gate.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const src = (rel) => readFileSync(join(REPO_ROOT, rel), "utf8");

const PLUGINS = [
  ".opencode/plugins/gate.js",
  ".opencode/plugins/harness-validator.js",
  ".opencode/plugins/hitl-guardrail.js",
];

// Precise registration-syntax patterns (NOT bare words — "task" contains "ask").
const H1_PATTERNS = [
  /hook\(\s*['"]ask['"]/,
  /subscribe\(\s*['"]ask['"]/,
  /['"]permission\.ask['"]/,
];
const H2_PATTERNS = [/output\.system\s*=/];
const H3_PATTERNS = [/\.subscribe\s*\(/];
const H5_PATTERNS = [
  /hook\(\s*['"][^'"]*prose/i,
  /denyProse|blockProse|proseBlock/i,
];

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

describe("PL-08 V2-VAL-14 — prohibitions H1/H2/H3/H5 (static + runtime)", () => {
  it("H1 (ask ausente): no ask registration syntax in any plugin source", () => {
    for (const rel of PLUGINS) {
      const text = src(rel);
      for (const pattern of H1_PATTERNS) {
        assert.ok(!pattern.test(text), `H1-ASK-FOUND: ${rel} matches ${pattern}`);
      }
    }
  });

  it("H1 (ask ausente): setup registers no ask-named hook on any api", async () => {
    const { ctx, calls } = spyStub();
    await setup(ctx);
    for (const call of calls) {
      for (const field of [call.tool, call.event, call.name]) {
        assert.notEqual(field, "ask", "H1-ASK-FOUND: forbidden ask hook registered at runtime");
      }
    }
  });

  it("H2 (sem scalar system-transform): no scalar assignment in any plugin source", () => {
    for (const rel of PLUGINS) {
      const text = src(rel);
      for (const pattern of H2_PATTERNS) {
        assert.ok(!pattern.test(text), `H2-SCALAR-FOUND: ${rel} matches ${pattern}`);
      }
    }
  });

  it("H2 (satellites no-op): zero DenyError, zero throw in validator/guardrail", () => {
    for (const rel of [
      ".opencode/plugins/harness-validator.js",
      ".opencode/plugins/hitl-guardrail.js",
    ]) {
      const text = src(rel);
      assert.equal((text.match(/DenyError/g) ?? []).length, 0, `H2: DenyError in ${rel}`);
      assert.equal((text.match(/throw new/g) ?? []).length, 0, `H2: throw in ${rel}`);
    }
  });

  it("H3 (sem evento inexistente): no subscribe call in any plugin source", () => {
    for (const rel of PLUGINS) {
      const text = src(rel);
      for (const pattern of H3_PATTERNS) {
        assert.ok(!pattern.test(text), `H3-DEAD-EVENT-FOUND: ${rel} matches ${pattern}`);
      }
    }
    const subscribed = V2_HOOK_TABLE.filter((r) => r.v2.api === "ctx.event.subscribe" && r.v2.name);
    assert.equal(subscribed.length, 0, "H3: event table keeps every row reserved (name null)");
  });

  it("H3 (sem evento inexistente): setup never calls event.subscribe", async () => {
    const { ctx, calls } = spyStub();
    await setup(ctx);
    const subs = calls.filter((c) => c.api === "event.subscribe");
    assert.equal(subs.length, 0, `H3-DEAD-EVENT-FOUND: ${subs.length} subscribe call(s) at runtime`);
  });

  it("H5 (sem bloqueio de prosa): no prose-named hook or prose deny identifier", () => {
    for (const rel of PLUGINS) {
      const text = src(rel);
      for (const pattern of H5_PATTERNS) {
        assert.ok(!pattern.test(text), `H5-PROSE-BLOCK-FOUND: ${rel} matches ${pattern}`);
      }
    }
  });

  it("H5 (sem bloqueio de prosa): runtime registry shows no prose-named handler", async () => {
    const { ctx, calls } = spyStub();
    await setup(ctx);
    for (const call of calls) {
      const flat = JSON.stringify([call.tool, call.event, call.name, call.handler?.name]);
      assert.ok(!/prose/i.test(flat), `H5-PROSE-BLOCK-FOUND in registry: ${flat}`);
    }
  });

  it("smoke per gate: every gate-bearing tool + both session shims registered", async () => {
    const { ctx, calls } = spyStub();
    const result = await setup(ctx);
    assert.equal(result.id, "harness-gate");
    for (const tool of V2_TOOL_KEYS) {
      const hit = calls.find((c) => c.api === "tool.hook" && c.tool === tool && c.timing === "before");
      assert.ok(hit, `gate registered for tool: ${tool}`);
      assert.equal(hit.handler, runGatesShim, "shared deny loop, no fork");
    }
    const sessionCalls = calls.filter((c) => c.api === "session.hook");
    assert.ok(sessionCalls.some((c) => c.handler === noteChatParamsShim), "params shim registered");
    assert.ok(sessionCalls.some((c) => c.handler === humanBoundaryShim), "boundary shim registered");
  });

  it("H4 declarada parcial 🟠 (nunca 🟢): evadible parse + CI backstop documented", () => {
    const text = src(".opencode/plugins/gate.js");
    assert.ok(/evad|partial|backstop/i.test(text), "H4 partial guarantee declared in gate.js");
    assert.ok(/CI/.test(text), "H4 CI backstop named in gate.js");
  });
});
