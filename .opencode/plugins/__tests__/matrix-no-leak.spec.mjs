// matrix-no-leak.spec.mjs — PL-07 V2-VAL-12 (TDD FIRST, anomalia 🟡 I10).
//
// A deny with a secret / absolute path inside `args` must carry ONLY the
// actionable `reason` + registry metadata in DenyError.details — the secret
// itself must be absent in BOTH entries. Both entries are envelope shapes of the
// SAME v2 handler (runGatesShim): the measured single-arg payload and the legacy
// two-arg (input, output) shape (contract H6). The retired v1 `HarnessGate`
// entry is gone (Batch 1 review, 🟡-4), so there is no second registration to
// compare against. Shims additionally never log raw args: captured warn/error
// output must not contain the secret either.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  runGatesShim,
  noteChatParamsShim,
  humanBoundaryShim,
  DenyError,
} from "../gate.js";

const SECRET = "SECRET-XYZ-9f8a6b4c2d7e";
const ABS_PATH = "/home/someone/secret/key.pem";

const ENFORCE = {
  protectedPaths: [],
  gates: { picco: "enforce", evidence: "enforce", hitlBatch: "enforce" },
};

const tmpRoots = [];
function tempStatePath(state) {
  const dir = mkdtempSync(join(tmpdir(), "pl07-noleak-"));
  tmpRoots.push(dir);
  const file = join(dir, "workflow-state.json");
  writeFileSync(file, JSON.stringify(state));
  return file;
}
after(() => {
  for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true });
});

const CLOSED = {
  current_phase: "Completed",
  harness_status: "passed",
  code_review_status: "passed",
  current_feature: "noleak-closed-fixture",
};

let sidCounter = 0;
const freshSid = (prefix) => `${prefix}-${Date.now()}-${sidCounter++}`;

const DETAILS_ALLOWLIST = ["tool", "gateId", "timing", "agent", "path", "hits"];

function assertNoLeak(err, entry) {
  assert.ok(err instanceof DenyError, `${entry}: deny is a DenyError`);
  assert.ok(typeof err.reason === "string" && err.reason.length > 0, `${entry}: actionable reason present`);
  const flat = JSON.stringify(err.details ?? {});
  assert.ok(!flat.includes(SECRET), `${entry}: details must not contain the secret`);
  assert.ok(!flat.includes(ABS_PATH), `${entry}: details must not contain the absolute path`);
  for (const key of Object.keys(err.details ?? {})) {
    assert.ok(
      DETAILS_ALLOWLIST.includes(key),
      `${entry}: details key "${key}" is reason-adjacent metadata only`,
    );
  }
  // I10 path hygiene: any surviving path value is a basename (no
  // directory, never absolute) — the full attacker-controlled path
  // (with SECRET in a dir segment) must not round-trip into details.
  for (const key of ["path"]) {
    const value = err.details?.[key];
    if (typeof value === "string") {
      assert.ok(!value.includes("/"), `${entry}: details.${key} is basename-only, got ${value}`);
    }
  }
  const hits = err.details?.hits;
  if (Array.isArray(hits)) {
    for (const hit of hits) {
      if (typeof hit?.target === "string") {
        assert.ok(!hit.target.includes("/"), `${entry}: hit target is basename-only`);
        assert.ok(!hit.target.includes(SECRET), `${entry}: hit target holds no secret`);
      }
    }
  }
}

describe("PL-07 V2-VAL-12 — 🟡 deny details carry only reason+metadata (no secret leak)", () => {
  it("two-arg envelope: PICCO deny with secret/path in args leaks nothing", async () => {
    const closed = tempStatePath(CLOSED);
    const prompt = `rotate ${SECRET} stored at ${ABS_PATH} with no picco block`;
    let caught = null;
    try {
      await runGatesShim(
        { tool: "task", sessionID: freshSid("two-arg-noleak"), config: ENFORCE, statePath: closed },
        { args: { prompt } },
      );
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, "the two-arg envelope denies");
    assert.equal(caught.reason, "picco-tag-absent");
    assertNoLeak(caught, "two-arg");
  });

  it("v2 setup: PICCO deny with secret/path in args leaks nothing", async () => {
    const closed = tempStatePath(CLOSED);
    const prompt = `rotate ${SECRET} stored at ${ABS_PATH} with no picco block`;
    let caught = null;
    try {
      await runGatesShim({
        tool: "task",
        sessionID: freshSid("v2-noleak"),
        args: { prompt },
        config: ENFORCE,
        statePath: closed,
        logger: { warn() {}, error() {} },
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, "v2 denies");
    assert.equal(caught.reason, "picco-tag-absent");
    assertNoLeak(caught, "v2");
  });

  it("both envelope shapes: pkill deny embedding a secret leaks nothing", async () => {
    const results = {};
    try {
      await runGatesShim(
        { tool: "bash", sessionID: freshSid("two-arg-noleak-pkill"), config: ENFORCE },
        { args: { command: `pkill -f worker # ${SECRET} ${ABS_PATH}` } },
      );
    } catch (err) {
      results.twoArg = err;
    }
    try {
      await runGatesShim({
        tool: "bash",
        sessionID: freshSid("v2-noleak-pkill"),
        args: { command: `pkill -f worker # ${SECRET} ${ABS_PATH}` },
        config: ENFORCE,
        logger: { warn() {}, error() {} },
      });
    } catch (err) {
      results.v2 = err;
    }
    assert.equal(results.twoArg?.reason, "pkill-f");
    assert.equal(results.v2?.reason, results.twoArg.reason, "pkill deny reason parity across envelope shapes");
    assertNoLeak(results.twoArg, "two-arg-pkill");
    assertNoLeak(results.v2, "v2-pkill");
  });

  it("both envelope shapes: write to protected path holding SECRET leaks nothing (basename-only details)", async () => {
    const protectedConfig = {
      ...ENFORCE,
      protectedPaths: [".opencode/plugins/**"],
    };
    // SECRET sits in a directory segment; basename stays clean. Full path
    // must never round-trip into DenyError.details.
    const evilPath = `.opencode/plugins/dir-${SECRET}/gate.js`;
    const results = {};
    try {
      await runGatesShim(
        { tool: "write", sessionID: freshSid("two-arg-noleak-write"), config: protectedConfig },
        { args: { filePath: evilPath, content: `x ${SECRET} ${ABS_PATH}` } },
      );
    } catch (err) {
      results.twoArg = err;
    }
    try {
      await runGatesShim({
        tool: "write",
        sessionID: freshSid("v2-noleak-write"),
        args: { filePath: evilPath, content: `x ${SECRET} ${ABS_PATH}` },
        config: protectedConfig,
        logger: { warn() {}, error() {} },
      });
    } catch (err) {
      results.v2 = err;
    }
    assert.equal(results.twoArg?.reason, "protected-path-write");
    assert.equal(results.v2?.reason, results.twoArg.reason, "write deny reason parity across envelope shapes");
    assertNoLeak(results.twoArg, "two-arg-write");
    assertNoLeak(results.v2, "v2-write");
    assert.equal(results.twoArg.details?.path, "gate.js", "protected detail carries basename only");
    assert.equal(results.v2.details?.path, "gate.js", "protected detail carries basename only");
  });

  it("shims never log raw args (I10): captured warn/error lack the secret", async () => {
    const captured = [];
    const logger = {
      warn: (m) => { captured.push(String(m)); },
      error: (m) => { captured.push(String(m?.message ?? m)); },
    };
    const closed = tempStatePath(CLOSED);
    // Allow-path with the secret in args (valid PICCO + secret prose).
    const verdict = await runGatesShim({
      tool: "task",
      sessionID: freshSid("v2-noleak-log"),
      args: {
        prompt:
          "<role>dev</role><task>rotate</task><context>c</context>" +
          `<constraints>${SECRET} at ${ABS_PATH}</constraints>` +
          "<acceptance>a</acceptance><open_questions></open_questions>",
      },
      config: ENFORCE,
      statePath: closed,
      logger,
    });
    assert.equal(verdict.verdict, "allow");
    // Session shims never log at all (map/counter maintenance only).
    noteChatParamsShim({ sessionID: freshSid("sess"), params: { agent: `agent-${SECRET}` } });
    humanBoundaryShim({ sessionID: freshSid("sess") }, { message: { role: "assistant" } });
    for (const line of captured) {
      assert.ok(!line.includes(SECRET), "shim logs must not contain raw args (secret)");
      assert.ok(!line.includes(ABS_PATH), "shim logs must not contain raw args (abs path)");
    }
  });

  it("two-arg envelope console output on secret-bearing deny contains no secret", async () => {
    const captured = [];
    const origError = console.error;
    const origWarn = console.warn;
    console.error = (...a) => { captured.push(a.map(String).join(" ")); };
    console.warn = (...a) => { captured.push(a.map(String).join(" ")); };
    try {
      const closed = tempStatePath(CLOSED);
      await runGatesShim(
        { tool: "task", sessionID: freshSid("two-arg-noleak-con"), config: ENFORCE, statePath: closed },
        { args: { prompt: `no tags, ${SECRET} ${ABS_PATH}` } },
      ).then(
        () => { throw new Error("expected deny"); },
        (err) => {
          assert.ok(err instanceof DenyError);
        },
      );
    } finally {
      console.error = origError;
      console.warn = origWarn;
    }
    for (const line of captured) {
      assert.ok(!line.includes(SECRET), "console must not leak the secret");
      assert.ok(!line.includes(ABS_PATH), "console must not leak the abs path");
    }
  });
});
