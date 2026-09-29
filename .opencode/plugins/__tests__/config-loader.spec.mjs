import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadHarnessConfig,
  resolveCommand,
  configGatesDisableEnforcement,
  DEFAULT_CONFIG_PATH,
} from "../../../scripts/static-checks.mjs";

describe("static-checks.mjs loader — CFG-01 (RF-01/RF-02, ADR-009)", () => {
  it("valid config loads and resolves the canonical command", () => {
    const config = loadHarnessConfig(DEFAULT_CONFIG_PATH);
    assert.equal(config.version, 1);
    const cmd = resolveCommand(config, "suiteFull");
    assert.ok(cmd.includes("node --test"));
    assert.equal(cmd, config.commands.suiteFull);
  });

  it("missing config => fail-closed with clear message (never crash)", () => {
    assert.throws(
      () => loadHarnessConfig("/nonexistent/harness.config.json"),
      /fail-closed/i,
    );
  });

  it("invalid JSON => fail-closed with clear message", () => {
    const dir = mkdtempSync(join(tmpdir(), "harness-cfg-"));
    const bad = join(dir, "harness.config.json");
    writeFileSync(bad, "{not json", "utf8");
    assert.throws(() => loadHarnessConfig(bad), /fail-closed/i);
  });

  it("unknown command key => fail-closed", () => {
    const config = loadHarnessConfig(DEFAULT_CONFIG_PATH);
    assert.throws(() => resolveCommand(config, "nope"), /fail-closed/i);
  });

  it("gates.* off in config does NOT disable enforcement (ADR-009)", () => {
    const off = { picco: "off", evidence: "off", hitlBatch: "off", e2eGreenfield: "off" };
    assert.equal(configGatesDisableEnforcement(off), false);
    const config = loadHarnessConfig(DEFAULT_CONFIG_PATH);
    assert.equal(configGatesDisableEnforcement(config.gates), false);
  });
});
