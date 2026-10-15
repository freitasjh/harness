// v2-shims.spec.mjs — PL-02 V2-BE-03 (TDD FIRST).
//
// The three v2 shims delegate to the SAME pure cores as the v1 server entry
// (decide + CORE_GATES, noteChatParams/recordSessionAgent,
// isHumanMessage/resetHitlTracker) with H6 normalization, and never log
// raw args (I10).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DenyError,
  decide,
  resolveSessionAgent,
  hitlTrackerFor,
  resetHitlTracker,
  gateHitlBatch,
  runGatesShim,
  noteChatParamsShim,
  humanBoundaryShim,
} from "../gate.js";

const VALID_PICCO =
  "<role>dev</role><task>do x</task><context>c</context>" +
  "<constraints>k</constraints><acceptance>a</acceptance><open_questions></open_questions>";
const TEST_CONFIG = {
  protectedPaths: [],
  gates: { picco: "enforce", evidence: "enforce", hitlBatch: "enforce" },
};

describe("PL-02 V2-BE-03 — runGatesShim delegates to decide + CORE_GATES", () => {
  it("denies task without PICCO (same decide as v1 server entry)", async () => {
    await assert.rejects(
      runGatesShim({
        tool: "task",
        sessionID: "v2-shim-picco-deny",
        args: { prompt: "do something without any tag" },
        config: TEST_CONFIG,
        startsNewCycle: false,
        logger: { warn() {}, error() {} },
      }),
      (err) => err instanceof DenyError && err.reason === "picco-tag-absent",
    );
  });

  it("allows task with valid PICCO (parity with decide allow)", async () => {
    const verdict = await runGatesShim({
      tool: "task",
      sessionID: "v2-shim-picco-allow",
      args: { prompt: VALID_PICCO },
      config: TEST_CONFIG,
      startsNewCycle: false,
      logger: { warn() {}, error() {} },
    });
    assert.equal(verdict.verdict, "allow");
  });

  it("normalizes H6 shapes: string args, shell vs bash, write path shapes", async () => {
    // String args carrying pkill deny like an object shape would.
    await assert.rejects(
      runGatesShim({
        tool: "shell",
        sessionID: "v2-shim-h6-shell",
        args: "pkill -f node",
        config: TEST_CONFIG,
        logger: { warn() {}, error() {} },
      }),
      (err) => err instanceof DenyError && err.reason === "pkill-f",
    );
    // Clean bash allows.
    const verdict = await runGatesShim({
      tool: "bash",
      sessionID: "v2-shim-h6-bash",
      args: { command: "echo hello" },
      config: TEST_CONFIG,
      logger: { warn() {}, error() {} },
    });
    assert.equal(verdict.verdict, "allow");
  });

  it("fail-open preserved: generic Error inside a gate allows (never deny)", async () => {
    const evilTracker = {
      onTask() {
        throw new Error("boom (generic, must fail-open)");
      },
    };
    const verdict = await runGatesShim({
      tool: "task",
      sessionID: "v2-shim-failopen",
      args: { prompt: VALID_PICCO },
      config: TEST_CONFIG,
      startsNewCycle: false,
      hitlTracker: evilTracker,
      logger: { warn() {}, error() {} },
    });
    assert.equal(verdict.verdict, "allow");
  });

  it("kill-switch HARNESS_GATES=off allows via shim (ADR-009)", async () => {
    const verdict = await runGatesShim({
      tool: "task",
      sessionID: "v2-shim-kill",
      args: { prompt: "no tags at all" },
      config: TEST_CONFIG,
      env: { HARNESS_GATES: "off" },
      logger: { warn() {}, error() {} },
    });
    assert.equal(verdict.verdict, "allow");
    assert.equal(verdict.via, "kill-switch");
  });

  it("accepts the v1 (input, output) two-arg handler shape too", async () => {
    const verdict = await runGatesShim(
      { tool: "bash", sessionID: "v2-shim-2arg" },
      { args: { command: "echo hello" } },
    );
    assert.equal(verdict.verdict, "allow");
  });
});

describe("PL-02 V2-BE-03 — session shims share the v1 maps", () => {
  it("noteChatParamsShim feeds resolveSessionAgent (same map as v1)", () => {
    noteChatParamsShim({ sessionID: "v2-shim-sess-1", params: { agent: "qa-engineer" } });
    assert.equal(resolveSessionAgent({ sessionID: "v2-shim-sess-1" }), "qa-engineer");
  });

  it("humanBoundaryShim resets the HITL counter on human turns", async () => {
    const sid = "v2-shim-hitl-1";
    resetHitlTracker(sid);
    const tracker = hitlTrackerFor(sid);
    await gateHitlBatch({ tool: "task", sessionID: sid, args: {}, hitlTracker: tracker });
    await gateHitlBatch({ tool: "task", sessionID: sid, args: {}, hitlTracker: tracker });
    assert.equal(tracker.pending(), 2);
    humanBoundaryShim({ sessionID: sid }, { message: { role: "human" } });
    const fresh = hitlTrackerFor(sid);
    assert.notEqual(fresh, tracker, "reset drops the map entry so runtime gets a new tracker");
    assert.equal(fresh.pending(), 0);
    resetHitlTracker(sid);
  });

  it("humanBoundaryShim ignores non-human turns (counter kept)", () => {
    const sid = "v2-shim-hitl-2";
    resetHitlTracker(sid);
    const tracker = hitlTrackerFor(sid);
    tracker.onTask("developer-engineer");
    humanBoundaryShim({ sessionID: sid }, { message: { role: "assistant" } });
    assert.equal(tracker.pending(), 1);
    resetHitlTracker(sid);
  });
});
