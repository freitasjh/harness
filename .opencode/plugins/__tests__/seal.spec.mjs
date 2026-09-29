import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sha256, sealCommands, verifySeal } from "../lib/seal.mjs";

describe("seal.mjs — sha256 standalone (CFG-02, U6=b)", () => {
  it("sha256 of known vector matches", () => {
    assert.equal(
      sha256("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("sha256 rejects non-string input", () => {
    assert.throws(() => sha256(42), TypeError);
  });

  it("seal confere: untampered commands verify ok", () => {
    const commands = { suiteFull: "node --test", unit: "node --test x/" };
    const seal = sealCommands(commands);
    const result = verifySeal(commands, seal);
    assert.equal(result.ok, true);
    assert.deepEqual(result.mismatches, []);
  });

  it("seal diverge: tampered command is reported (sealed-command-mismatch)", () => {
    const commands = { suiteFull: "node --test", unit: "node --test x/" };
    const seal = sealCommands(commands);
    const tampered = { ...commands, suiteFull: "true" };
    const result = verifySeal(tampered, seal);
    assert.equal(result.ok, false);
    assert.ok(result.mismatches.includes("suiteFull"));
  });

  it("seal diverge: missing or extra key is reported", () => {
    const commands = { suiteFull: "node --test" };
    const seal = sealCommands(commands);
    assert.equal(verifySeal({}, seal).ok, false);
    assert.equal(verifySeal({ ...commands, extra: "x" }, seal).ok, false);
  });
});
