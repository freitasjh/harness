// v2-hook-no-equiv.spec.mjs — PL-02 V2-BE-05 (TDD FIRST, gap 1).
//
// Golden rule (SPEC §5): a v1 hook with NO confirmed v2 equivalent must
// produce a VISIBLE error at load — never silence. The v1→v2 table
// (V2_HOOK_TABLE) is asserted against the stub: shell vs bash, session
// vs event, and the reserved (unsubscribed) future observer.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { setup, V2_HOOK_TABLE, V2_TOOL_KEYS, V2_FORBIDDEN_HOOKS } from "../gate.js";

describe("PL-02 V2-BE-05 — hook without equivalent is a visible error", () => {
  it("setup without ctx.tool.hook throws HOOK-NO-EQUIV (never silent)", async () => {
    await assert.rejects(
      setup({ session: { hook: async () => {} }, event: { subscribe: async () => {} } }),
      /HOOK-NO-EQUIV:ctx\.tool\.hook/,
    );
  });

  it("setup with empty ctx throws HOOK-NO-EQUIV (never silent)", async () => {
    await assert.rejects(setup({}), /HOOK-NO-EQUIV/);
  });

  it("minimal stub (tool.hook only) registers the subset with an explicit session warning", async () => {
    const calls = [];
    const result = await setup({
      tool: {
        hook: async (tool, timing, handler) => {
          calls.push({ tool, timing });
        },
      },
    });
    assert.ok(result.registered.length > 0, "tool subset registered");
    assert.ok(
      result.warnings.some((w) => w.startsWith("HOOK-NO-EQUIV:session")),
      `explicit warning for missing session api, got ${JSON.stringify(result.warnings)}`,
    );
  });

  it("v1→v2 table covers shell vs bash (H4) and both session shims (H6)", () => {
    const tools = V2_HOOK_TABLE.filter((r) => r.v2.api === "ctx.tool.hook").map(
      (r) => r.v2.tool,
    );
    assert.ok(tools.includes("bash"), "table confirms bash");
    assert.ok(tools.includes("shell"), "table confirms shell (H4 dual literal)");
    const sessionEvents = V2_HOOK_TABLE.filter(
      (r) => r.v2.api === "ctx.session.hook",
    ).map((r) => r.v2.event);
    assert.ok(sessionEvents.includes("params"), "table confirms session params");
    assert.ok(sessionEvents.includes("message"), "table confirms session message");
  });

  it("table never maps a forbidden hook (H1/H2/H3/H5)", () => {
    const flat = JSON.stringify(V2_HOOK_TABLE);
    for (const name of V2_FORBIDDEN_HOOKS) {
      assert.ok(
        !new RegExp(`"${name}"`).test(flat),
        `forbidden hook absent from table: ${name}`,
      );
    }
    assert.ok(!V2_TOOL_KEYS.includes("ask"), "ask never a tool key");
  });

  it("future after-observer stays reserved (no dead event.subscribe, H3)", () => {
    const reserved = V2_HOOK_TABLE.filter(
      (r) => r.v2.api === "ctx.event.subscribe",
    );
    for (const row of reserved) {
      assert.equal(
        row.v2.name,
        null,
        `event.subscribe row must stay unsubscribed this batch: ${row.v1}`,
      );
    }
  });
});
