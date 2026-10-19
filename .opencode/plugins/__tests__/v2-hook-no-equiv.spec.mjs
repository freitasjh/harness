// v2-hook-no-equiv.spec.mjs — PL-02 V2-BE-05 (gap 1), UPDATED to the measured
// v2-only contract (opencode-v2-only, EX2-VAL-03).
//
// Golden rule (SPEC §5): a v1 hook with NO confirmed v2 equivalent must produce
// a VISIBLE error at load — never silence. The v1→v2 table (V2_HOOK_TABLE) is
// asserted against the measured contract: tool.execute.before → the single
// ctx.tool.hook("execute.before"); chat.params → NOT a hook (the agent rides
// the execute.before payload); chat.message → the confirmed event stream.
//
// Retired: the "both session shims" row and the "event.subscribe stays
// reserved (name null)" assertion — the confirmed stream row now carries its
// name; the shims were part of the removed dual session.hook surface.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  setup,
  V2_TOOL_HOOK,
  V2_HOOK_TABLE,
  V2_FORBIDDEN_HOOKS,
} from "../gate.js";
import { RUNTIME_TURN_BOUNDARY } from "./fixtures/v2-runtime-events.mjs";

describe("PL-02 V2-BE-05 — hook without equivalent is a visible error", () => {
  it("setup without ctx.tool.hook throws HOOK-NO-EQUIV (never silent)", async () => {
    await assert.rejects(
      setup({ event: { subscribe: () => {} } }),
      /HOOK-NO-EQUIV:ctx\.tool\.hook/,
    );
  });

  it("setup with empty ctx throws HOOK-NO-EQUIV (never silent)", async () => {
    await assert.rejects(setup({}), /HOOK-NO-EQUIV/);
  });

  it("minimal stub (tool.hook only) registers the hook, returns undefined and warns for the missing stream", async () => {
    const calls = [];
    const errors = [];
    const orig = console.error;
    console.error = (...a) => errors.push(a.map(String).join(" "));
    let result;
    try {
      result = await setup({
        tool: {
          hook: async (tool, handler) => {
            calls.push({ tool, handler });
          },
        },
      });
    } finally {
      console.error = orig;
    }
    assert.equal(result, undefined, "still returns undefined");
    assert.equal(calls.length, 1, "the tool hook is registered");
    assert.equal(calls[0].tool, V2_TOOL_HOOK);
    assert.ok(
      errors.some((e) => e.includes("HOOK-NO-EQUIV:ctx.event.subscribe")),
      `explicit warning for the missing stream, got ${JSON.stringify(errors)}`,
    );
  });

  it("v1→v2 table maps tool.execute.before → ctx.tool.hook(execute.before)", () => {
    const rows = V2_HOOK_TABLE.filter((r) => r.v1 === "tool.execute.before");
    assert.equal(rows.length, 1, "one tool hook row");
    assert.equal(rows[0].v2.api, "ctx.tool.hook");
    assert.equal(rows[0].v2.name, "execute.before");
  });

  it("v1→v2 table maps chat.params to NO hook (agent rides the payload)", () => {
    const rows = V2_HOOK_TABLE.filter((r) => r.v1 === "chat.params");
    assert.equal(rows.length, 1, "one chat.params row");
    assert.equal(rows[0].v2.api, "no-hook", "v2 has no chat.params hook");
    assert.equal(rows[0].v2.field, "event.agent");
  });

  it("v1→v2 table maps chat.message to the confirmed turn-boundary stream", () => {
    const rows = V2_HOOK_TABLE.filter((r) => r.v1 === "chat.message");
    assert.equal(rows.length, 1, "one chat.message row");
    assert.equal(rows[0].v2.api, "ctx.event.subscribe");
    // 🟡-3: the expected name comes from the INDEPENDENT runtime fixture, not
    // from gate.js's own V2_TURN_BOUNDARY_TYPES (self-referential otherwise).
    assert.equal(rows[0].v2.name, RUNTIME_TURN_BOUNDARY);
  });

  it("table never maps a forbidden hook (H1)", () => {
    const flat = JSON.stringify(V2_HOOK_TABLE);
    for (const name of V2_FORBIDDEN_HOOKS) {
      assert.ok(
        !new RegExp(`"${name}"`).test(flat),
        `forbidden hook absent from table: ${name}`,
      );
    }
  });
});
