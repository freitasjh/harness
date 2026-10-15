// Harness Validator — no-op plugin (FIX-01, Batch 3/7).
//
// FIX-01 removed two dead mechanisms from this module (SPEC §21.1, PLAN GATE-01):
//   1. Prose re-injection via the system-transform hook (G14/N5/H2): assigning
//      the transform output as a scalar never propagated to the caller, so the
//      injected rule block was a silent no-op. Enforcement lives in
//      .opencode/plugins/gate.js, not in prompt prose.
//   2. The bus-event handler filtering a nonexistent event (N7/H3): it never
//      fired, so the audit log it promised never happened.
//
// This module stays a valid no-op plugin until GATE-03 lands the contraprova
// observer on the confirmed after-hook. No prose, no dead handlers.
//
// Dual-export v1+v2 (opencode-v2-plugin-migration, PL-04): the bare v1
// function HarnessValidator is intact and wired as `server`; the v2 entry
// `setup` rides on the same default record (dual-branch, same shape as
// gate.js:939-940): v1 loaders read `server`, v2 runtimes read `setup`.
// setup registers nothing and denies nothing — pure no-op.
export const HarnessValidator = async (_input = {}) => ({});

// V2 entry (PL-04): no-op registration. Takes any stub ctx, registers zero
// hooks, throws never, logs no args. Idempotent by construction (no state).
export async function setup(_ctx = {}) {
  return { id: "harness-validator", registered: [], warnings: [], noop: true };
}

export default (typeof globalThis.Plugin?.define === "function"
  ? globalThis.Plugin.define({ id: "harness-validator", server: HarnessValidator, setup })
  : { id: "harness-validator", server: HarnessValidator, setup });
