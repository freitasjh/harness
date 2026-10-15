// matrix-no-leak.spec.mjs — PL-07 V2-VAL-12 (TDD FIRST, anomalia 🟡 I10).
//
// A deny with a secret / absolute path inside `args` must carry ONLY the
// actionable `reason` + registry metadata in DenyError.details — the secret
// itself must be absent in BOTH entries. Shims additionally never log raw
// args: captured warn/error output must not contain the secret either.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  HarnessGate,
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
  it("v1 server: PICCO deny with secret/path in args leaks nothing", async () => {
    const closed = tempStatePath(CLOSED);
    const hooks = await HarnessGate({});
    const prompt = `rotate ${SECRET} stored at ${ABS_PATH} with no picco block`;
    let caught = null;
    try {
      await hooks["tool.execute.before"](
        { tool: "task", sessionID: freshSid("v1-noleak"), config: ENFORCE, statePath: closed },
        { args: { prompt } },
      );
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, "v1 denies");
    assert.equal(caught.reason, "picco-tag-absent");
    assertNoLeak(caught, "v1");
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

  it("both entries: pkill deny embedding a secret leaks nothing", async () => {
    const results = {};
    const hooks = await HarnessGate({});
    try {
      await hooks["tool.execute.before"](
        { tool: "bash", sessionID: freshSid("v1-noleak-pkill"), config: ENFORCE },
        { args: { command: `pkill -f worker # ${SECRET} ${ABS_PATH}` } },
      );
    } catch (err) {
      results.v1 = err;
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
    assert.equal(results.v1?.reason, "pkill-f");
    assert.equal(results.v2?.reason, results.v1.reason, "pkill deny reason parity");
    assertNoLeak(results.v1, "v1-pkill");
    assertNoLeak(results.v2, "v2-pkill");
  });

  it("both entries: write to protected path holding SECRET leaks nothing (basename-only details)", async () => {
    const protectedConfig = {
      ...ENFORCE,
      protectedPaths: [".opencode/plugins/**"],
    };
    // SECRET sits in a directory segment; basename stays clean. Full path
    // must never round-trip into DenyError.details.
    const evilPath = `.opencode/plugins/dir-${SECRET}/gate.js`;
    const results = {};
    const hooks = await HarnessGate({});
    try {
      await hooks["tool.execute.before"](
        { tool: "write", sessionID: freshSid("v1-noleak-write"), config: protectedConfig },
        { args: { filePath: evilPath, content: `x ${SECRET} ${ABS_PATH}` } },
      );
    } catch (err) {
      results.v1 = err;
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
    assert.equal(results.v1?.reason, "protected-path-write");
    assert.equal(results.v2?.reason, results.v1.reason, "write deny reason parity");
    assertNoLeak(results.v1, "v1-write");
    assertNoLeak(results.v2, "v2-write");
    assert.equal(results.v1.details?.path, "gate.js", "protected detail carries basename only");
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

  it("v1 console output on secret-bearing deny contains no secret", async () => {
    const captured = [];
    const origError = console.error;
    const origWarn = console.warn;
    console.error = (...a) => { captured.push(a.map(String).join(" ")); };
    console.warn = (...a) => { captured.push(a.map(String).join(" ")); };
    try {
      const closed = tempStatePath(CLOSED);
      const hooks = await HarnessGate({});
      await hooks["tool.execute.before"](
        { tool: "task", sessionID: freshSid("v1-noleak-con"), config: ENFORCE, statePath: closed },
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
      assert.ok(!line.includes(SECRET), "v1 console must not leak the secret");
      assert.ok(!line.includes(ABS_PATH), "v1 console must not leak the abs path");
    }
  });
});
