// Harness Validator — TaskFlow Orchestrator (FIX-01, Batch 3/7).
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
export const HarnessValidator = async (_input = {}) => ({});

export default HarnessValidator;
