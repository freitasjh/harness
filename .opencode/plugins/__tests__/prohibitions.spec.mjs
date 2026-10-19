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
//   H3: never subscribe a DEAD/unconfirmed bus event. `event.subscribe` is a
//       CONFIRMED v2 API (measured on v2.0.32) — the prohibition is no longer
//       "any .subscribe", it is "subscribe only the confirmed stream, never a
//       named dual event". The table row carries the confirmed name.
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
  V2_TOOL_HOOK,
  V2_TOOL_KEYS,
  V2_HOOK_TABLE,
  V2_TURN_BOUNDARY_TYPES,
  isTurnBoundaryEvent,
} from "../gate.js";
import {
  RUNTIME_TURN_BOUNDARY,
  RUNTIME_TURN_BOUNDARY_EVENTS,
  runtimeBoundarySample,
} from "./fixtures/v2-runtime-events.mjs";

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
// H3 (inverted): subscribing is allowed on the CONFIRMED stream, but never a
// named/dual event (`subscribe("some.event")`). The confirmed v2 form takes no
// name — the stream carries the boundary.
const H3_PATTERNS = [/\.subscribe\s*\(\s*['"]/];
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

  it("H3 (sem evento inexistente): no plugin subscribes a named/dual event (only the confirmed stream)", () => {
    for (const rel of PLUGINS) {
      const text = src(rel);
      for (const pattern of H3_PATTERNS) {
        assert.ok(!pattern.test(text), `H3-DEAD-EVENT-FOUND: ${rel} matches ${pattern}`);
      }
    }
    const subscribed = V2_HOOK_TABLE.filter((r) => r.v2.api === "ctx.event.subscribe" && r.v2.name);
    assert.equal(subscribed.length, 1, "H3: exactly one subscribed row carries the confirmed stream name");
    // 🟡-3: compare against the INDEPENDENT runtime fixture, never against
    // gate.js's own constant — a self-referential check stays green even if
    // BOTH sides drift away from the runtime.
    assert.equal(
      subscribed[0].v2.name,
      RUNTIME_TURN_BOUNDARY,
      "H3: the subscribed row names the runtime's measured turn-boundary events",
    );
    assert.equal(
      V2_TURN_BOUNDARY_TYPES.join("|"),
      RUNTIME_TURN_BOUNDARY,
      "H3: the adapter's boundary list matches the runtime fixture",
    );
    for (const type of RUNTIME_TURN_BOUNDARY_EVENTS) {
      assert.equal(
        isTurnBoundaryEvent(runtimeBoundarySample(type, "fixture-session")),
        true,
        `H3: isTurnBoundaryEvent handles the measured ${type} event`,
      );
    }
  });

  it("H3 (sem evento inexistente): setup subscribes the CONFIRMED stream exactly once, never a name", async () => {
    const { ctx, calls } = spyStub();
    await setup(ctx);
    const subs = calls.filter((c) => c.api === "event.subscribe");
    assert.equal(subs.length, 1, "one confirmed subscription replaces the v1 chat.message hook");
    assert.equal(subs[0].name, undefined, "the confirmed stream takes no name");
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

  it("smoke: the single execute.before hook covers every gate-bearing tool + the stream", async () => {
    const { ctx, calls } = spyStub();
    const result = await setup(ctx);
    assert.equal(result, undefined, "setup returns undefined (acquireRelease contract)");
    const toolCalls = calls.filter((c) => c.api === "tool.hook");
    assert.equal(toolCalls.length, 1, "a single registration covers every gate-bearing tool");
    assert.equal(toolCalls[0].tool, V2_TOOL_HOOK, "the confirmed execute.before name");
    assert.equal(toolCalls[0].handler, runGatesShim, "shared deny loop, no fork");
    assert.deepEqual(
      V2_TOOL_KEYS,
      ["task", "write", "edit", "apply_patch", "patch", "bash", "shell"],
      "the single hook documents every gate-bearing tool",
    );
    assert.equal(calls.filter((c) => c.api === "event.subscribe").length, 1, "confirmed stream subscribed");
  });

  it("H4 declarada parcial 🟠 (nunca 🟢): evadible parse + CI backstop documented", () => {
    const text = src(".opencode/plugins/gate.js");
    assert.ok(/evad|partial|backstop/i.test(text), "H4 partial guarantee declared in gate.js");
    assert.ok(/CI/.test(text), "H4 CI backstop named in gate.js");
  });
});
