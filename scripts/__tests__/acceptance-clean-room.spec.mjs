// acceptance-clean-room.spec.mjs — TDD do aceite determinístico (F8).
//
// Defeito que esta guarda fecha: um script de aceite que imprime PASS sem
// chamar os gates (vacuidade), que escreve um relatório fora do schema, ou que
// deixa diretório temporário. As fixtures aqui TAMPERAM as dependências
// injetadas: se o gate for substituído por um no-op, o cenário correspondente
// TEM que virar FAIL — otherwise the acceptance is worth nothing.
import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tempScope } from "../test-temp.mjs";
import { runAcceptance } from "../acceptance-clean-room.mjs";
import { validateAgainstSchema } from "../../.opencode/plugins/gate.js";

const REPO = join(import.meta.dirname, "..", "..");
const SCHEMA = JSON.parse(readFileSync(join(REPO, ".agents/schemas/harness-report.schema.json"), "utf8"));
const SCOPE = tempScope({ label: "acceptance-spec" });
afterEach(() => SCOPE.cleanup());
after(() => SCOPE.cleanup());

const NAMES = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12", "A13", "A14"];

function opts(dir, overrides = {}) {
  return {
    log: () => {},
    reportPath: join(dir, "report.json"),
    gitSha: "testsha",
    now: () => "2026-11-18T00:00:00.000Z",
    tempRoot: dir,
    ...overrides,
  };
}

describe("ACEITE-CLEAN-ROOM — relatório e cenários", () => {
  it("todos os cenários passam e o relatório é válido no schema", async () => {
    const dir = SCOPE.tmp();
    const result = await runAcceptance(opts(dir));
    assert.equal(result.ok, true, JSON.stringify(result.scenarios));
    assert.deepEqual(result.scenarios.map((s) => s.name), NAMES);
    assert.ok(result.scenarios.every((s) => s.status === "PASS"));
    assert.deepEqual(validateAgainstSchema(result.report, SCHEMA), []);
    assert.equal(result.report.demand, "harness-v2-clean-room");
    assert.equal(result.report.gitSha, "testsha");
    assert.equal(result.report.at, "2026-11-18T00:00:00.000Z");
    assert.equal(result.report.selfReported, true);
    assert.match(result.report.selfReportedNote, /sem LLM\/UI real/);
    assert.ok(result.report.gateCalls >= 12, `gateCalls=${result.report.gateCalls}`);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "report.json"), "utf8")), result.report);
  });

  it("temp directories are all removed after the run", async () => {
    const dir = SCOPE.tmp();
    const result = await runAcceptance(opts(dir));
    assert.ok(result.report.cleanup.tempDirPaths.length >= 3);
    for (const path of result.report.cleanup.tempDirPaths) {
      assert.equal(existsSync(path), false, `temp dir não removido: ${path}`);
    }
  });

  it("exit 1 e relatório nomeiam o cenário quando um gate é no-op (A4)", async () => {
    const dir = SCOPE.tmp();
    const result = await runAcceptance(
      opts(dir, { gates: { gatePiccoTask: async () => true, gateHitlBatch: async () => true } }),
    );
    assert.equal(result.ok, false);
    const failed = result.scenarios.filter((s) => s.status === "FAIL");
    assert.deepEqual(failed.map((s) => s.name), ["A4"]);
    assert.match(failed[0].detail, /picco-tag-absent|hitl-pause-required/);
    assert.equal(result.exitCode, 1);
    assert.equal(result.report.commands[0].exitCode, 1);
    assert.deepEqual(validateAgainstSchema(result.report, SCHEMA), []);
  });

  it("validação de schema mutada reprova A7 (mutation loading)", async () => {
    const dir = SCOPE.tmp();
    const result = await runAcceptance(opts(dir, { validate: () => [] }));
    assert.equal(result.ok, false);
    assert.deepEqual(
      result.scenarios.filter((s) => s.status === "FAIL").map((s) => s.name),
      ["A7"],
    );
  });

  // SCAF-09: anti-vacuidade dos cenários novos. Se o runner do sync for um
  // no-op, A8..A13 TÊM que virar FAIL — um aceite que só imprime PASS não vale.
  it("runner de sync no-op reprova A8..A13 (anti-vacuidade)", async () => {
    const dir = SCOPE.tmp();
    const result = await runAcceptance(opts(dir, { runSync: () => "" }));
    assert.equal(result.ok, false);
    const failed = result.scenarios.filter((s) => s.status === "FAIL").map((s) => s.name);
    for (const name of ["A8", "A9", "A10", "A11", "A12", "A13"]) {
      assert.ok(failed.includes(name), `${name} não reprovou com runner no-op`);
    }
  });

  // Review ADR-001: A8 não pode herdar MS-1=100% sem tokens. A pendência é
  // explícita no rótulo e no campo de dívidas do relatório; I8 defere o perfil
  // a ADR nova, então nenhum token é gerado neste ciclo.
  it("A8 rotula MS-1 como parcial e declara tokens pendente (I8)", async () => {
    const dir = SCOPE.tmp();
    const result = await runAcceptance(opts(dir));
    const a8 = result.scenarios.find((s) => s.name === "A8");
    assert.equal(a8.status, "PASS");
    assert.match(a8.detail, /MS-1 parcial/);
    assert.match(a8.detail, /tokens pendente/);
    assert.match(a8.detail, /I8/);
    assert.match(result.report.debts.MS_1, /parcial/);
  });

  it("suiteFull trocada reprova A14 (contraprova continua sendo a auto-suite)", async () => {
    const dir = SCOPE.tmp();
    const result = await runAcceptance(
      opts(dir, {
        readConfig: () => ({ commands: { suiteFull: "node scripts/acceptance-clean-room.mjs" } }),
      }),
    );
    assert.equal(result.ok, false);
    assert.deepEqual(
      result.scenarios.filter((s) => s.status === "FAIL").map((s) => s.name),
      ["A14"],
    );
  });
});
