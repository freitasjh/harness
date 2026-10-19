// v2-runtime-events.mjs — INDEPENDENT fixture of the opencode v2.0.32 runtime
// event contract.
//
// Why it exists (Batch 1 review, 🟡-3): the H3 assertion used to compare
// gate.js's V2_HOOK_TABLE against gate.js's own V2_TURN_BOUNDARY_TYPES — a
// self-referential check that stays green even if BOTH sides drift away from
// the runtime. This fixture is the independent side of that comparison.
//
// SOURCE OF TRUTH: measured against the installed binary (opencode v2.0.32,
// `ctx.event.subscribe()` returns an async-iterable of bus events) — NOT
// derived from gate.js. Any drift between this fixture and gate.js is a defect
// the specs must catch.
export const RUNTIME_TURN_BOUNDARY_EVENTS = [
  "session.idle",
  "message.updated",
  "session.step.ended",
];

// Measured payload schemas — the fields the adapter's predicate reads.
export const RUNTIME_EVENT_SCHEMAS = {
  "session.idle": { sessionID: "string" },
  "message.updated": { sessionID: "string", "info.role": "string" },
  "session.step.ended": { sessionID: "string", finish: "string" },
};

// The single subscribed name in V2_HOOK_TABLE must equal this join.
export const RUNTIME_TURN_BOUNDARY = RUNTIME_TURN_BOUNDARY_EVENTS.join("|");

// One measured sample bus event per boundary type, shaped like the runtime's
// {id, created, type, data} envelope (used to drive the predicate).
export function runtimeBoundarySample(type, sessionID) {
  switch (type) {
    case "session.idle":
      return { id: "evt-idle", created: 1, type, data: { sessionID } };
    case "message.updated":
      return { id: "evt-msg", created: 2, type, data: { sessionID, info: { role: "user" } } };
    case "session.step.ended":
      return { id: "evt-step", created: 3, type, data: { sessionID, finish: "stop" } };
    default:
      throw new Error(`unknown runtime boundary type: ${type}`);
  }
}
