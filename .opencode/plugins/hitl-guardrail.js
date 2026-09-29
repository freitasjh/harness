// HITL Guardrail — TaskFlow Orchestrator (FIX-01, Batch 3/7).
//
// FIX-01 removed two dead mechanisms from this module (SPEC §21.1, PLAN GATE-01):
//   1. Prose re-injection via the system-transform hook (G14/N5/H2): assigning
//      the transform output as a scalar never propagated to the caller, so the
//      guardrail text never reached the model. The blocking pause between
//      batches lands in GATE-04 on the confirmed deny primitive instead.
//   2. The bus-event handler filtering a nonexistent event (N7/H3): it never
//      fired, so the delegation audit log it promised never happened.
//
// This module stays a valid no-op plugin until GATE-04 implements the HITL
// pause (with the developer→reviewer loop exemption, I6). No prose, no dead
// handlers.
export const HitlGuardrail = async (_input = {}) => ({});

export default HitlGuardrail;
