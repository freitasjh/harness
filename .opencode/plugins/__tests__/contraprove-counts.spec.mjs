import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTestCounts, runContraprova, DENY_CONTRAPROVE_DIVERGENT } from "../gate.js";
import { sealCommands } from "../lib/seal.mjs";

const commands = { suiteFull: "node --test" };
const seal = sealCommands(commands);
const report = { commands: [{ exitCode: 0 }], counts: { unit: { passed: 1, failed: 0, skipped: 0 } } };

describe("contraprova — contagens observáveis", () => {
  it("parseia blocos do node --test em camadas", () => {
    const out = "ℹ tests 1\nℹ pass 1\nℹ fail 0\nℹ skipped 0\nℹ tests 2\nℹ pass 2\nℹ fail 0\nℹ skipped 0\n";
    assert.deepEqual(parseTestCounts(out), {
      unit: { passed: 1, failed: 0, skipped: 0 },
      it: { passed: 2, failed: 0, skipped: 0 },
    });
  });

  it("contagens iguais permitem", async () => {
    const r = await runContraprova({ demand: "d", report, commands, seal, execFn: async () => ({ exitCode: 0, counts: report.counts }) });
    assert.equal(r.verdict, "allow");
  });

  it("contagens divergentes negam", async () => {
    await assert.rejects(
      runContraprova({ demand: "d", report, commands, seal, execFn: async () => ({ exitCode: 0, counts: { unit: { passed: 2, failed: 0, skipped: 0 } } }) }),
      (e) => e.reason === DENY_CONTRAPROVE_DIVERGENT,
    );
  });
});
