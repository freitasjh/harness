// prd-checks.spec.mjs — TDD for the PRD→ADR pipeline checks (PAP-02/PAP-03).
//
// Contract (SPEC §5): `runPrdChecks(root)` returns
//   { ok: boolean, results: [{ id, status: "PASS"|"FAIL", detail }] }
// with exactly the ids PRD-01 / ADR-01 / ADR-02, in that order.
//
// Vacuous-safe: when `.spec/prd/**` does NOT exist the 3 checks PASS and the
// detail declares N/A. FAIL only when the target exists and is malformed.
//
// Every contract assertion gets BOTH a PASS and a FAIL fixture. No fixture is
// allowed to pass by absence of the target without covering the negative case
// (SPEC §9/§12 constraint 10). Fixtures live in a tracked temp scope — never
// in the repo's real `.spec/`.
//
// Parse convention (this spec is the contract PAP-05's template must honour):
//   - PRD section   = `## <N>. <title>` heading with an explicit number.
//                     PRD-01 validates the NUMBERS 1,2,5,6,7,9,16, not titles.
//   - closed question = a line starting with `> ❓ Validação:` inside a section.
//   - ADR-INDEX.md  = markdown table, minimal columns
//                     order,id,title,status,depends_on,dir,branch,merge (§4.2).
//   - ADR.md        = `depende-de` field + "interface congelada" (label
//                     variation accepted, documented).
//   - branch regex (§5) = ^adr/[a-z0-9-]+/\d{2}-[a-z0-9-]+$
import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempScope } from "../../../scripts/test-temp.mjs";
import { runPrdChecks } from "../../../.agents/skills/prd-adr-pipeline/checks.mjs";

const TMP = tempScope({ label: "prd-checks" });
afterEach(() => TMP.cleanup());
after(() => TMP.cleanup());

function fixture(files) {
  return TMP.tmp(files);
}

function byId(report, id) {
  const r = report.results.find((x) => x.id === id);
  assert.ok(r, `missing result ${id}`);
  return r;
}

const MARK = "> ❓ Validação: confirma?";

function section(n, title, body) {
  return `## ${n}. ${title}\n${body}\n`;
}

// A well-formed PRD: 7 required sections, each with the closed-question line,
// §7 non-empty, a §5 metric with "como medir" filled, §16 with verdict+date.
function validPrd() {
  return [
    "# PRD — fixture",
    section(1, "Problema", `Dor real.\n${MARK}`),
    section(2, "Objetivo", `Meta.\n${MARK}`),
    section(5, "Métricas", `| Métrica | Como medir |\n|---|---|\n| tempo | contagem de merges |\n${MARK}`),
    section(6, "Escopo", `Inclui X.\n${MARK}`),
    section(7, "NÃO entra", `Não inclui Y.\n${MARK}`),
    section(9, "Requisitos", `RF-1.\n${MARK}`),
    section(16, "Aprovação", `- Veredito: aprovado\n- Data: 2026-10-15\n${MARK}`),
  ].join("\n");
}

function validAdrMd() {
  return [
    "# ADR-001 — Base",
    "- **depende-de**: —",
    "- **Interface congelada**: `runPrdChecks(root)`",
  ].join("\n");
}

function validResearch() {
  return "# RESEARCH\n\n- Fonte A: https://example.org/a\n- Fonte B: https://example.org/b\n";
}

function validIndex() {
  return [
    "| order | id | title | status | depends_on | dir | branch | merge |",
    "|---|---|---|---|---|---|---|---|",
    "| 1 | ADR-001 | Base | merged | — | ADRs/ADR-001-base/ | adr/feat-x/01-base | abc123 |",
    "| 2 | ADR-002 | Next | in-progress | ADR-001 | ADRs/ADR-002-next/ | adr/feat-x/02-next | — |",
  ].join("\n");
}

// A fully consistent PRD tree: index 1:1 with disk, ADR.md fields present,
// RESEARCH with 2 sources.
function validTree() {
  return {
    ".spec/prd/p1/PRD.md": validPrd(),
    ".spec/prd/p1/RESEARCH.md": validResearch(),
    ".spec/prd/p1/ADR-INDEX.md": validIndex(),
    ".spec/prd/p1/ADRs/ADR-001-base/ADR.md": validAdrMd(),
    ".spec/prd/p1/ADRs/ADR-002-next/ADR.md": validAdrMd().replace("ADR-001", "ADR-002"),
  };
}

describe("PRD-01 — vacuous-safe (target absent)", () => {
  it("no .spec/prd/ at all ⇒ the 3 checks PASS and declare N/A", () => {
    const root = fixture({ "README.md": "# empty repo\n" });
    const report = runPrdChecks(root);
    assert.equal(report.ok, true);
    for (const id of ["PRD-01", "ADR-01", "ADR-02"]) {
      const r = byId(report, id);
      assert.equal(r.status, "PASS");
      assert.match(r.detail, /N\/A/);
    }
  });

  it(".spec/prd/ present but empty ⇒ still vacuous-safe N/A", () => {
    const root = fixture({ ".spec/prd/.keep": "" });
    const report = runPrdChecks(root);
    assert.equal(report.ok, true);
    assert.match(byId(report, "PRD-01").detail, /N\/A/);
  });

  it("N5: an EMPTY .spec/prd/ is reported 'vazio', not 'ausente'", () => {
    const root = fixture({ ".spec/prd/.keep": "" });
    assert.ok(existsSync(join(root, ".spec/prd")), "control: target exists");
    const r = byId(runPrdChecks(root), "PRD-01");
    assert.equal(r.status, "PASS");
    assert.match(r.detail, /N\/A/);
    assert.match(r.detail, /vazio/);
    assert.doesNotMatch(r.detail, /ausente/);
  });

  it("Scenario 8 (INV-7): type=bug with no .spec/prd/ ⇒ N/A, no PRD demanded", () => {
    const root = fixture({
      "workflow-state.json": JSON.stringify({ type: "bug", current_feature: "fix-x" }),
    });
    const report = runPrdChecks(root);
    assert.equal(report.ok, true);
    for (const id of ["PRD-01", "ADR-01", "ADR-02"]) {
      const r = byId(report, id);
      assert.equal(r.status, "PASS");
      assert.match(r.detail, /N\/A/);
    }
  });
});

describe("PRD-01 — output contract", () => {
  it("always returns exactly the 3 ids in order with enum status and a detail", () => {
    const report = runPrdChecks(fixture({}));
    assert.deepEqual(report.results.map((r) => r.id), ["PRD-01", "ADR-01", "ADR-02"]);
    for (const r of report.results) {
      assert.ok(r.status === "PASS" || r.status === "FAIL", `bad status ${r.status}`);
      assert.equal(typeof r.detail, "string");
      assert.ok(r.detail.length > 0);
    }
  });

  it("ok is true iff every result is PASS", () => {
    const good = runPrdChecks(fixture({}));
    assert.equal(good.ok, good.results.every((r) => r.status === "PASS"));
    const bad = runPrdChecks(fixture({ ".spec/prd/p1/PRD.md": "# nothing\n" }));
    assert.equal(bad.ok, false);
    assert.equal(bad.ok, bad.results.every((r) => r.status === "PASS"));
  });
});

describe("PRD-01 — required sections", () => {
  it("PASS: all 7 required section numbers present", () => {
    const root = fixture({ ".spec/prd/p1/PRD.md": validPrd() });
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "PASS");
  });

  it("FAIL: a required section number is missing (names the number)", () => {
    const prd = validPrd().replace(/## 9\. Requisitos[\s\S]*?(?=\n## 16\.)/, "");
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    const r = byId(runPrdChecks(root), "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /§?9\b/);
  });

  it("FAIL: title text is irrelevant — a renumbered section still fails", () => {
    // §16 renamed but numbered 15 ⇒ 16 missing, 15 present.
    const prd = validPrd().replace("## 16. Aprovação", "## 15. Aprovação");
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    const r = byId(runPrdChecks(root), "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /§?16\b/);
  });
});

describe("PRD-01 — section heading must fit on ONE line (N1)", () => {
  // The heading regex must not let `\s` cross `\n`: `##\n5. Métricas` is a
  // split heading, NOT a `## 5.` heading, so §5 is unrecognised (and, being
  // required, the number is reported missing).
  it("FAIL: a split heading `##\\n5. Métricas` is NOT §5 ⇒ required section missing", () => {
    const prd = validPrd().replace("## 5. Métricas", "##\n5. Métricas");
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    assert.ok(existsSync(join(root, ".spec/prd/p1/PRD.md")), "control: target exists");
    const r = byId(runPrdChecks(root), "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /§?5\b/);
  });

  it("PASS (control): the same PRD with the heading on one line is §5", () => {
    const root = fixture({ ".spec/prd/p1/PRD.md": validPrd() });
    assert.ok(existsSync(join(root, ".spec/prd/p1/PRD.md")), "control: target exists");
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "PASS");
  });
});

describe("PRD-01 — §7 (NÃO entra) non-empty", () => {
  it("FAIL: §7 present but empty (names the section)", () => {
    const prd = validPrd().replace(
      section(7, "NÃO entra", `Não inclui Y.\n${MARK}`),
      "## 7. NÃO entra\n\n",
    );
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    const r = byId(runPrdChecks(root), "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /§?7\b/);
  });

  it("FAIL: §7 with only the validation marker still counts as empty", () => {
    const prd = validPrd().replace(
      section(7, "NÃO entra", `Não inclui Y.\n${MARK}`),
      `## 7. NÃO entra\n${MARK}\n`,
    );
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "FAIL");
  });
});

describe("PRD-01 — §5 metric with 'como medir' filled", () => {
  it("FAIL: no metric with the 'como medir' column filled (all empty)", () => {
    const prd = validPrd().replace("| tempo | contagem de merges |", "| tempo |  |");
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    const r = byId(runPrdChecks(root), "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /como medir/i);
  });

  it("FAIL: §5 has no 'como medir' column at all", () => {
    const prd = validPrd().replace(
      "| Métrica | Como medir |\n|---|---|\n| tempo | contagem de merges |",
      "| Métrica | Valor |\n|---|---|\n| tempo | 3 |",
    );
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "FAIL");
  });

  it("PASS: at least one metric row has the column filled", () => {
    const root = fixture({ ".spec/prd/p1/PRD.md": validPrd() });
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "PASS");
  });
});

describe("PRD-01 — closed question per required section", () => {
  it("FAIL: a required section without the `> ❓ Validação:` line (names it)", () => {
    const prd = validPrd().replace(`Inclui X.\n${MARK}`, "Inclui X.");
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    const r = byId(runPrdChecks(root), "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /§?6\b/);
  });

  it("PASS: every required section carries the line", () => {
    const root = fixture({ ".spec/prd/p1/PRD.md": validPrd() });
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "PASS");
  });
});

describe("PRD-01 — §10 stories (optional section)", () => {
  it("PASS: §10 absent ⇒ nothing demanded", () => {
    const root = fixture({ ".spec/prd/p1/PRD.md": validPrd() });
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "PASS");
  });

  it("FAIL: a §10 story missing Dado/Quando/Então (names §10)", () => {
    const prd = validPrd() + "\n" + section(10, "Histórias", "- Como usuário quero algo sem palavras-chave.");
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    const r = byId(runPrdChecks(root), "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /§?10\b/);
  });

  it("PASS: a §10 story with all three keywords", () => {
    const prd = validPrd() + "\n" + section(10, "Histórias", "- Dado A, Quando B, Então C.");
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "PASS");
  });
});

describe("PRD-01 — §15 PICCO (optional section)", () => {
  it("PASS: §15 absent", () => {
    const root = fixture({ ".spec/prd/p1/PRD.md": validPrd() });
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "PASS");
  });

  it("FAIL: §15 with an empty <task> (names §15/task)", () => {
    const prd = validPrd() + "\n" + section(15, "PICCO", "<task></task>\n<context>ctx</context>");
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    const r = byId(runPrdChecks(root), "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /15/);
  });

  it("FAIL: §15 with an empty <context>", () => {
    const prd = validPrd() + "\n" + section(15, "PICCO", "<task>fazer</task>\n<context>   </context>");
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "FAIL");
  });

  it("PASS: §15 present with both tags filled", () => {
    const prd = validPrd() + "\n" + section(15, "PICCO", "<task>fazer X</task>\n<context>ctx Y</context>");
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "PASS");
  });
});

describe("PRD-01 — §16 verdict + date", () => {
  it("FAIL: §16 without a verdict (names §16)", () => {
    const prd = validPrd().replace("- Veredito: aprovado\n- Data: 2026-10-15", "- Data: 2026-10-15");
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    const r = byId(runPrdChecks(root), "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /§?16\b/);
  });

  it("FAIL: §16 without a date", () => {
    const prd = validPrd().replace("- Veredito: aprovado\n- Data: 2026-10-15", "- Veredito: aprovado");
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    const r = byId(runPrdChecks(root), "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /data/i);
  });

  it("PASS: §16 with verdict and date", () => {
    const root = fixture({ ".spec/prd/p1/PRD.md": validPrd() });
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "PASS");
  });
});

describe("PRD-01 — §16 verdict must be on the label's line (false-green fix)", () => {
  // The old VERDICT_RE used `\s*` after the colon, which crosses `\n`; an empty
  // `- Veredito:` then matched the first char of the NEXT line (`- Data: …`).
  it("FAIL: empty `- Veredito:` before a `- Data:` line is NOT a verdict", () => {
    const prd = validPrd().replace(
      "- Veredito: aprovado\n- Data: 2026-10-15",
      "- Veredito:\n- Data: 2026-10-15",
    );
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    const r = byId(runPrdChecks(root), "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /§?16\b/);
  });

  it("FAIL (§16 false-green): empty verdict WITH ADRs/** ⇒ ok=false + INV-3 (was ok=true)", () => {
    const prd = validPrd().replace(
      "- Veredito: aprovado\n- Data: 2026-10-15",
      "- Veredito:\n- Data: 2026-10-15",
    );
    const root = fixture({ ...validTree(), ".spec/prd/p1/PRD.md": prd });
    assert.ok(existsSync(join(root, ".spec/prd/p1/ADR-INDEX.md")), "control: ADRs tree exists");
    const report = runPrdChecks(root);
    assert.equal(report.ok, false);
    const r = byId(report, "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /INV-3/);
  });

  it("FAIL: `- Veredito:` followed by only spaces is empty too", () => {
    const prd = validPrd().replace(
      "- Veredito: aprovado\n- Data: 2026-10-15",
      "- Veredito:   \n- Data: 2026-10-15",
    );
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "FAIL");
  });

  it("PASS: a verdict with a value on the same line still passes", () => {
    const root = fixture({ ".spec/prd/p1/PRD.md": validPrd() });
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "PASS");
  });
});

describe("PRD-01 — §16 verdict label: anchored start, bold accepted (N2/N3)", () => {
  // N3: the label may legitimately be bold. The ADR templates write
  // `**depende-de**` / `**Interface congelada**`, so PAP-05's PRD template may
  // write `- **Veredito**: …`. Rejecting bold is a FALSE-FAIL on a valid PRD.
  it("PASS (N3): a bold label `- **Veredito**: ok` IS a verdict (was false-FAIL)", () => {
    const prd = validPrd().replace("- Veredito: aprovado", "- **Veredito**: ok");
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    assert.ok(existsSync(join(root, ".spec/prd/p1/PRD.md")), "control: target exists");
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "PASS");
  });

  it("PASS (N3): bold label + ADRs/** ⇒ INV-3 does NOT false-fire", () => {
    const prd = validPrd().replace("- Veredito: aprovado", "- **Veredito**: ok");
    const root = fixture({ ...validTree(), ".spec/prd/p1/PRD.md": prd });
    assert.ok(existsSync(join(root, ".spec/prd/p1/ADR-INDEX.md")), "control: ADRs tree exists");
    const report = runPrdChecks(root);
    assert.equal(report.ok, true);
    assert.doesNotMatch(byId(report, "PRD-01").detail, /INV-3/);
  });

  // N2: the label must be anchored at the START of the line. An unanchored
  // search finds `veredito:` inside ordinary prose (`- Sem veredito: pendente`)
  // and silently disarms INV-3 while `ADRs/**` exists on disk.
  it("FAIL (N2): prose `- Sem veredito: pendente` is NOT a verdict ⇒ INV-3 fires (was ok=true)", () => {
    const prd = validPrd().replace(
      "- Veredito: aprovado\n- Data: 2026-10-15",
      "- Sem veredito: pendente\n- Data: 2026-10-15",
    );
    const root = fixture({ ...validTree(), ".spec/prd/p1/PRD.md": prd });
    assert.ok(existsSync(join(root, ".spec/prd/p1/ADR-INDEX.md")), "control: ADRs tree exists");
    const report = runPrdChecks(root);
    assert.equal(report.ok, false);
    const r = byId(report, "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /INV-3/);
  });

  it("PASS (control N2): a plain `- Veredito: ok` still counts", () => {
    const prd = validPrd().replace("- Veredito: aprovado", "- Veredito: ok");
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    assert.ok(existsSync(join(root, ".spec/prd/p1/PRD.md")), "control: target exists");
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "PASS");
  });

  it("FAIL (control): `- Veredito:` with no value on the line is still empty", () => {
    const prd = validPrd().replace(
      "- Veredito: aprovado\n- Data: 2026-10-15",
      "- Veredito:\n- Data: 2026-10-15",
    );
    const root = fixture({ ".spec/prd/p1/PRD.md": prd });
    assert.ok(existsSync(join(root, ".spec/prd/p1/PRD.md")), "control: target exists");
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "FAIL");
  });
});

describe("PRD-01 — INV-3: ADRs require an approved PRD", () => {
  it("FAIL: ADRs/ exists while §16 has no verdict (names INV-3)", () => {
    const prd = validPrd().replace("- Veredito: aprovado\n- Data: 2026-10-15", "- Data: 2026-10-15");
    const root = fixture({
      ".spec/prd/p1/PRD.md": prd,
      ".spec/prd/p1/ADRs/ADR-001-base/ADR.md": validAdrMd(),
    });
    const r = byId(runPrdChecks(root), "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /INV-3/);
  });

  it("PASS: ADRs/ exists and §16 is approved", () => {
    const root = fixture(validTree());
    assert.equal(byId(runPrdChecks(root), "PRD-01").status, "PASS");
  });
});

describe("PRD-01 — missing PRD.md inside an existing prd dir", () => {
  it("FAIL: prd dir present without PRD.md", () => {
    const root = fixture({ ".spec/prd/p1/RESEARCH.md": validResearch() });
    const r = byId(runPrdChecks(root), "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /PRD\.md/);
  });
});

// ---------------------------------------------------------------------------
// ADR-01 — ADR-INDEX.md × ADRs/**
// ---------------------------------------------------------------------------

describe("ADR-01 — vacuous-safe / no ADR artifacts", () => {
  it("PASS: PRD only, no ADR-INDEX.md and no ADRs/ ⇒ N/A", () => {
    const root = fixture({ ".spec/prd/p1/PRD.md": validPrd() });
    const r = byId(runPrdChecks(root), "ADR-01");
    assert.equal(r.status, "PASS");
    assert.match(r.detail, /N\/A/);
  });

  it("PASS: consistent index ↔ disk (with ADR.md fields + RESEARCH)", () => {
    const root = fixture(validTree());
    assert.equal(byId(runPrdChecks(root), "ADR-01").status, "PASS");
  });
});

describe("ADR-01 — orphans both directions", () => {
  it("FAIL: dir in ADRs/ with no index line (names the orphan dir)", () => {
    const root = fixture({
      ...validTree(),
      ".spec/prd/p1/ADRs/ADR-007-orphan/ADR.md": validAdrMd(),
    });
    const r = byId(runPrdChecks(root), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /ADR-007-orphan/);
  });

  it("FAIL: index line whose dir does not exist (names the dir)", () => {
    const files = validTree();
    delete files[".spec/prd/p1/ADRs/ADR-002-next/ADR.md"];
    const root = fixture(files);
    const r = byId(runPrdChecks(root), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /ADR-002-next/);
  });
});

describe("ADR-01 — duplicate id", () => {
  it("FAIL: two index rows share an id (names the id)", () => {
    const idx = validIndex().replace(
      "| 2 | ADR-002 | Next | in-progress | ADR-001 | ADRs/ADR-002-next/ | adr/feat-x/02-next | — |",
      "| 2 | ADR-001 | Next | in-progress | ADR-001 | ADRs/ADR-002-next/ | adr/feat-x/02-next | — |",
    );
    const root = fixture({ ...validTree(), ".spec/prd/p1/ADR-INDEX.md": idx });
    const r = byId(runPrdChecks(root), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /ADR-001/);
  });
});

describe("ADR-01 — ADR.md required fields", () => {
  it("FAIL: ADR.md without `depende-de` (names the field)", () => {
    const root = fixture({
      ...validTree(),
      ".spec/prd/p1/ADRs/ADR-001-base/ADR.md": "# ADR-001\n- **Interface congelada**: x",
    });
    const r = byId(runPrdChecks(root), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /depende-de/i);
  });

  it("FAIL: ADR.md without a frozen interface (names the field)", () => {
    const root = fixture({
      ...validTree(),
      ".spec/prd/p1/ADRs/ADR-001-base/ADR.md": "# ADR-001\n- **depende-de**: —",
    });
    const r = byId(runPrdChecks(root), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /interface/i);
  });

  it("PASS: ADR.md with both fields (label variation accepted)", () => {
    const root = fixture({
      ...validTree(),
      ".spec/prd/p1/ADRs/ADR-001-base/ADR.md": "# ADR-001\n- depende-de: ADR-000\n- Interface Congelada: `f()`",
    });
    assert.equal(byId(runPrdChecks(root), "ADR-01").status, "PASS");
  });

  it("FAIL: 'interface' and 'congelada' on separate lines are NOT the field (same-line fix)", () => {
    const root = fixture({
      ...validTree(),
      ".spec/prd/p1/ADRs/ADR-001-base/ADR.md":
        "# ADR-001\n- **depende-de**: —\n- Interface\n  congelada: nada",
    });
    const r = byId(runPrdChecks(root), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /interface/i);
  });
});

describe("ADR-01 — dir pattern", () => {
  it("FAIL: `dir` outside ADRs/ADR-00N-{slug}/ (names the value)", () => {
    const idx = validIndex().replace("ADRs/ADR-001-base/", "ADR-001-base/");
    const root = fixture({ ...validTree(), ".spec/prd/p1/ADR-INDEX.md": idx });
    const r = byId(runPrdChecks(root), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /ADR-001-base/);
  });

  it("FAIL: `dir` with a bad slug", () => {
    const idx = validIndex().replace("ADRs/ADR-002-next/", "ADRs/ADR-002-Next/");
    const root = fixture({ ...validTree(), ".spec/prd/p1/ADR-INDEX.md": idx });
    assert.equal(byId(runPrdChecks(root), "ADR-01").status, "FAIL");
  });
});

describe("ADR-01 — RESEARCH.md sources", () => {
  it("FAIL: ADRs/ exists without RESEARCH.md (names RESEARCH)", () => {
    const files = validTree();
    delete files[".spec/prd/p1/RESEARCH.md"];
    const root = fixture(files);
    const r = byId(runPrdChecks(root), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /RESEARCH/);
  });

  it("FAIL: RESEARCH.md with fewer than 2 sources", () => {
    const root = fixture({
      ...validTree(),
      ".spec/prd/p1/RESEARCH.md": "# RESEARCH\n- one: https://example.org/a\n",
    });
    const r = byId(runPrdChecks(root), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /RESEARCH/);
  });

  it("PASS: RESEARCH.md with 2 sources", () => {
    const root = fixture(validTree());
    assert.equal(byId(runPrdChecks(root), "ADR-01").status, "PASS");
  });
});

describe("ADR-01 — minimal columns", () => {
  it("FAIL: index missing the `merge` column (names it)", () => {
    const idx = [
      "| order | id | title | status | depends_on | dir | branch |",
      "|---|---|---|---|---|---|---|",
      "| 1 | ADR-001 | Base | merged | — | ADRs/ADR-001-base/ | adr/feat-x/01-base |",
    ].join("\n");
    const root = fixture({ ...validTree(), ".spec/prd/p1/ADR-INDEX.md": idx });
    const r = byId(runPrdChecks(root), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /merge/);
  });
});

// ---------------------------------------------------------------------------
// ADR-02 — ADR-INDEX.md sequencing / branch
// ---------------------------------------------------------------------------

describe("ADR-02 — one in-progress at a time (INV-1)", () => {
  it("PASS: a single in-progress row", () => {
    const root = fixture({ ...validTree() });
    assert.equal(byId(runPrdChecks(root), "ADR-02").status, "PASS");
  });

  it("FAIL: two in-progress rows (names the count)", () => {
    const idx = validIndex().replace(
      "| 1 | ADR-001 | Base | merged |",
      "| 1 | ADR-001 | Base | in-progress |",
    );
    const root = fixture({ ...validTree(), ".spec/prd/p1/ADR-INDEX.md": idx });
    const r = byId(runPrdChecks(root), "ADR-02");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /in-progress/);
  });
});

describe("ADR-02 — merged requires a merge ref", () => {
  it("FAIL: a merged row without `merge` filled (names the id)", () => {
    const idx = validIndex().replace(
      "| 1 | ADR-001 | Base | merged | — | ADRs/ADR-001-base/ | adr/feat-x/01-base | abc123 |",
      "| 1 | ADR-001 | Base | merged | — | ADRs/ADR-001-base/ | adr/feat-x/01-base | — |",
    );
    const root = fixture({ ...validTree(), ".spec/prd/p1/ADR-INDEX.md": idx });
    const r = byId(runPrdChecks(root), "ADR-02");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /ADR-001/);
  });

  it("PASS: a merged row with a sha", () => {
    const root = fixture(validTree());
    assert.equal(byId(runPrdChecks(root), "ADR-02").status, "PASS");
  });
});

describe("ADR-02 — sequence without gaps (INV-2)", () => {
  it("PASS: order=1 merged, order=2 in-progress", () => {
    const root = fixture(validTree());
    assert.equal(byId(runPrdChecks(root), "ADR-02").status, "PASS");
  });

  it("FAIL: order=2 in-progress while order=1 is not merged (names ADR-002)", () => {
    const idx = validIndex().replace(
      "| 1 | ADR-001 | Base | merged |",
      "| 1 | ADR-001 | Base | todo |",
    );
    const root = fixture({ ...validTree(), ".spec/prd/p1/ADR-INDEX.md": idx });
    const r = byId(runPrdChecks(root), "ADR-02");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /ADR-002/);
  });
});

describe("ADR-02 — branch pattern", () => {
  it("FAIL: branch `feat/x` outside adr/<id>/<nn>-<slug> (names branch)", () => {
    const idx = validIndex().replace("adr/feat-x/02-next", "feat/x");
    const root = fixture({ ...validTree(), ".spec/prd/p1/ADR-INDEX.md": idx });
    const r = byId(runPrdChecks(root), "ADR-02");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /branch/i);
  });

  it("PASS: branch matching the regex", () => {
    const root = fixture(validTree());
    assert.equal(byId(runPrdChecks(root), "ADR-02").status, "PASS");
  });
});

// ---------------------------------------------------------------------------
// Malformed cells must never disarm a contract condition, and no detail may
// claim conformity that was not evaluated (§4.2 / §5 — review debts 1 & 5).
// Every fixture asserts existsSync() on the target first: a FAIL must come from
// the malformation, never from the target being absent.
// ---------------------------------------------------------------------------

describe("ADR-INDEX — malformed cells are issues, never a silent skip", () => {
  it("ADR-02 FAIL: `order` non-integer in an in-progress row (was ok=true)", () => {
    const idx = [
      "| order | id | title | status | depends_on | dir | branch | merge |",
      "|---|---|---|---|---|---|---|---|",
      "| 1 | ADR-001 | Base | todo | — | ADRs/ADR-001-base/ | adr/feat-x/01-base | — |",
      "| x | ADR-002 | Next | in-progress | ADR-001 | ADRs/ADR-002-next/ | adr/feat-x/02-next | — |",
    ].join("\n");
    const root = fixture({ ...validTree(), ".spec/prd/p1/ADR-INDEX.md": idx });
    assert.ok(existsSync(join(root, ".spec/prd/p1/ADR-INDEX.md")), "control: target exists");
    const report = runPrdChecks(root);
    assert.equal(report.ok, false);
    const r = byId(report, "ADR-02");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /order/i);
  });

  it("ADR-01 FAIL: `order` non-integer on a non-in-progress row (§4.2 contract)", () => {
    const idx = validIndex().replace("| 1 | ADR-001", "| z | ADR-001");
    const root = fixture({ ...validTree(), ".spec/prd/p1/ADR-INDEX.md": idx });
    assert.ok(existsSync(join(root, ".spec/prd/p1/ADR-INDEX.md")), "control: target exists");
    const r = byId(runPrdChecks(root), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /order/i);
  });

  it("ADR-01 FAIL: `status` outside the enum (§4.2 contract)", () => {
    const idx = validIndex().replace("| Base | merged |", "| Base | bananado |");
    const root = fixture({ ...validTree(), ".spec/prd/p1/ADR-INDEX.md": idx });
    assert.ok(existsSync(join(root, ".spec/prd/p1/ADR-INDEX.md")), "control: target exists");
    const report = runPrdChecks(root);
    assert.equal(report.ok, false);
    const r = byId(report, "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /status/i);
    assert.match(r.detail, /todo|in-progress|merged|dropped/);
  });
});

// ---------------------------------------------------------------------------
// Class A — the same defect class as the malformed `order`/`status` cells: an
// EMPTY cell in a column that is PRESENT must be an explicit issue. Truthiness
// (`if (r.dir && …)`) makes an empty cell indistinguishable from an absent
// column, silently disarming the condition while the detail still claims
// conformity. §4.2's normative scope: `dir` and `branch` must be FILLED;
// `title`/`depends_on` stay descriptive and are NOT enforced here.
// ---------------------------------------------------------------------------

describe("ADR-INDEX — empty normative cells are issues, never a silent skip (class A)", () => {
  it("ADR-01 FAIL: `dir` column present but cell empty on every row (was ok=true + '1:1 sem órfãos')", () => {
    const idx = [
      "| order | id | title | status | depends_on | dir | branch | merge |",
      "|---|---|---|---|---|---|---|---|",
      "| 1 | ADR-001 | Base | merged | — |  | adr/feat-x/01-base | abc123 |",
      "| 2 | ADR-002 | Next | in-progress | ADR-001 |  | adr/feat-x/02-next | — |",
    ].join("\n");
    const root = fixture({ ".spec/prd/p1/PRD.md": validPrd(), ".spec/prd/p1/ADR-INDEX.md": idx });
    assert.ok(existsSync(join(root, ".spec/prd/p1/ADR-INDEX.md")), "control: target exists");
    const report = runPrdChecks(root);
    assert.equal(report.ok, false);
    const r = byId(report, "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /sem dir preenchido/);
    assert.match(r.detail, /ADR-001/);
    assert.doesNotMatch(r.detail, /1:1 com ADRs/);
  });

  it("ADR-02 FAIL: `branch` column present but cell empty (was ok=true + 'sequência e branch conformes')", () => {
    const idx = [
      "| order | id | title | status | depends_on | dir | branch | merge |",
      "|---|---|---|---|---|---|---|---|",
      "| 1 | ADR-001 | Base | merged | — | ADRs/ADR-001-base/ |  | abc123 |",
      "| 2 | ADR-002 | Next | in-progress | ADR-001 | ADRs/ADR-002-next/ |  | — |",
    ].join("\n");
    const root = fixture({ ...validTree(), ".spec/prd/p1/ADR-INDEX.md": idx });
    assert.ok(existsSync(join(root, ".spec/prd/p1/ADR-INDEX.md")), "control: target exists");
    const report = runPrdChecks(root);
    assert.equal(report.ok, false);
    const r = byId(report, "ADR-02");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /branch/i);
    assert.match(r.detail, /ADR-001/);
    assert.doesNotMatch(r.detail, /conformes/);
  });
});

describe("ADR-02 — no conformity claim without parsed rows (review debt 5)", () => {
  it("FAIL: ADR-INDEX.md with no table at all ⇒ ADR-02 never says 'conformes'", () => {
    const root = fixture({
      ".spec/prd/p1/PRD.md": validPrd(),
      ".spec/prd/p1/ADR-INDEX.md": "# Ledger\n\nNenhuma tabela aqui.\n",
    });
    assert.ok(existsSync(join(root, ".spec/prd/p1/ADR-INDEX.md")), "control: target exists");
    const r = byId(runPrdChecks(root), "ADR-02");
    assert.notEqual(r.status, "PASS");
    assert.doesNotMatch(r.detail, /conformes/);
    assert.match(r.detail, /N\/A|malformado|sem tabela|linha/i);
  });

  it("FAIL: ADR-INDEX.md table with header only (0 data rows)", () => {
    const idx = [
      "| order | id | title | status | depends_on | dir | branch | merge |",
      "|---|---|---|---|---|---|---|---|",
    ].join("\n");
    const root = fixture({ ".spec/prd/p1/PRD.md": validPrd(), ".spec/prd/p1/ADR-INDEX.md": idx });
    assert.ok(existsSync(join(root, ".spec/prd/p1/ADR-INDEX.md")), "control: target exists");
    const r = byId(runPrdChecks(root), "ADR-02");
    assert.notEqual(r.status, "PASS");
    assert.doesNotMatch(r.detail, /conformes/);
  });
});

// Same defect class, ADR-02 side: an ABSENT column means its condition was
// never evaluated, so the detail must never claim "sequência e branch
// conformes". Mirrors evalAdr01's `missing.length` ⇒ FAIL.
describe("ADR-02 — absent column is never 'conformes' (mirrors ADR-01)", () => {
  it("ADR-02 FAIL: `branch` column absent ⇒ FAIL, never 'conformes'", () => {
    const idx = [
      "| order | id | title | status | depends_on | dir | merge |",
      "|---|---|---|---|---|---|---|",
      "| 1 | ADR-001 | Base | merged | — | ADRs/ADR-001-base/ | abc123 |",
      "| 2 | ADR-002 | Next | in-progress | ADR-001 | ADRs/ADR-002-next/ | — |",
    ].join("\n");
    const root = fixture({ ...validTree(), ".spec/prd/p1/ADR-INDEX.md": idx });
    assert.ok(existsSync(join(root, ".spec/prd/p1/ADR-INDEX.md")), "control: target exists");
    const report = runPrdChecks(root);
    assert.equal(report.ok, false);
    const r = byId(report, "ADR-02");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /coluna\(s\) ausente\(s\)/);
    assert.match(r.detail, /branch/);
    assert.doesNotMatch(r.detail, /conformes/);
  });

  it("ADR-02 FAIL: `order` column absent ⇒ FAIL (sequence never evaluated)", () => {
    const idx = [
      "| id | title | status | depends_on | dir | branch | merge |",
      "|---|---|---|---|---|---|---|",
      "| ADR-001 | Base | merged | — | ADRs/ADR-001-base/ | adr/feat-x/01-base | abc123 |",
      "| ADR-002 | Next | in-progress | ADR-001 | ADRs/ADR-002-next/ | adr/feat-x/02-next | — |",
    ].join("\n");
    const root = fixture({ ...validTree(), ".spec/prd/p1/ADR-INDEX.md": idx });
    assert.ok(existsSync(join(root, ".spec/prd/p1/ADR-INDEX.md")), "control: target exists");
    const report = runPrdChecks(root);
    assert.equal(report.ok, false);
    const r = byId(report, "ADR-02");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /order/);
    assert.doesNotMatch(r.detail, /conformes/);
  });

  it("ADR-02 FAIL: `status` column absent ⇒ FAIL (INV-1 never evaluated)", () => {
    const idx = [
      "| order | id | title | depends_on | dir | branch | merge |",
      "|---|---|---|---|---|---|---|",
      "| 1 | ADR-001 | Base | — | ADRs/ADR-001-base/ | adr/feat-x/01-base | abc123 |",
      "| 2 | ADR-002 | Next | ADR-001 | ADRs/ADR-002-next/ | adr/feat-x/02-next | — |",
    ].join("\n");
    const root = fixture({ ...validTree(), ".spec/prd/p1/ADR-INDEX.md": idx });
    assert.ok(existsSync(join(root, ".spec/prd/p1/ADR-INDEX.md")), "control: target exists");
    const report = runPrdChecks(root);
    assert.equal(report.ok, false);
    const r = byId(report, "ADR-02");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /status/);
    assert.doesNotMatch(r.detail, /conformes/);
  });
});

describe("target present but not readable ⇒ FAIL, never 'absent' (review debts 3 & 9)", () => {
  it(".spec/prd/ is a FILE ⇒ the 3 checks FAIL 'existe mas não é legível'", () => {
    const root = fixture({});
    mkdirSync(join(root, ".spec"), { recursive: true });
    writeFileSync(join(root, ".spec/prd"), "não é um diretório\n");
    assert.ok(existsSync(join(root, ".spec/prd")), "control: target exists");
    const report = runPrdChecks(root);
    assert.equal(report.ok, false);
    for (const id of ["PRD-01", "ADR-01", "ADR-02"]) {
      const r = byId(report, id);
      assert.equal(r.status, "FAIL");
      assert.match(r.detail, /existe mas não é legível/);
      assert.doesNotMatch(r.detail, /ausente/);
    }
  });

  it("PRD.md is a DIRECTORY ⇒ PRD-01 distinguishes unreadable from absent", () => {
    const root = fixture({ ".spec/prd/p1/ADRs/.keep": "" });
    mkdirSync(join(root, ".spec/prd/p1/PRD.md"), { recursive: true });
    assert.ok(existsSync(join(root, ".spec/prd/p1/PRD.md")), "control: target exists");
    const r = byId(runPrdChecks(root), "PRD-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /PRD\.md/);
    assert.match(r.detail, /não é legível/);
    assert.doesNotMatch(r.detail, /ausente/);
  });

  it("ADRs/ is a FILE ⇒ ADR-01 FAIL 'existe mas não é legível'", () => {
    const root = fixture({ ".spec/prd/p1/PRD.md": validPrd() });
    writeFileSync(join(root, ".spec/prd/p1/ADRs"), "não é um diretório\n");
    assert.ok(existsSync(join(root, ".spec/prd/p1/ADRs")), "control: target exists");
    const r = byId(runPrdChecks(root), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /existe mas não é legível/);
  });
});

// ---------------------------------------------------------------------------
// Module-loading guard (RF-02 / NFR-1). What this proves, and all it proves:
// the set of STATIC import specifiers in checks.mjs is exactly
// {node:fs, node:path}; `import(` and `require(` do not appear; and a
// BEST-EFFORT denylist of common ambient spellings is absent. It does NOT
// prove "pureza": ambient globals reachable WITHOUT an import (`fetch`,
// `globalThis`, `process`, `eval`) are invisible to a specifier allowlist, and
// spellings the denylist does not enumerate (e.g. `process["getBuiltinModule"](…)`,
// `Function(…)()` without `new`, an aliased `require`) escape it. Both a
// specifier allowlist and a token denylist are needed; neither is complete.
// The scan runs over CODE with comments stripped (stripComments) so honest
// documentation is not punished for naming these spellings. (Not
// `node --permission`: its flag name/availability varies across Node versions,
// so a test on it would be environment-flaky.)
// ---------------------------------------------------------------------------
describe("checks.mjs module-loading guard (RF-02/NFR-1)", () => {
  const MODULE = join(
    import.meta.dirname,
    "..",
    "..",
    "..",
    ".agents",
    "skills",
    "prd-adr-pipeline",
    "checks.mjs",
  );
  const src = readFileSync(MODULE, "utf8");

  const ALLOWED_IMPORTS = ["node:fs", "node:path"];
  // Every form that names a module specifier: `import x from "m"`, bare
  // `import "m"`, and `export … from "m"`. Each is multi-line safe — the
  // specifier may sit on a later line than the keyword, so a same-line regex
  // would miss `import {\n execSync\n} from "node:child_process"`.
  const SPECIFIER_RES = [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bexport\s+[^;]*\bfrom\s*["']([^"']+)["']/g,
  ];
  // Ambient capabilities reachable WITHOUT an import — an allowlist over
  // specifiers cannot see them, so they are banned as tokens. `\beval\b` (word
  // boundary, not a substring) so the module's own `evalAdr01`/`evalPrd01`
  // names are not false hits.
  const BANNED_TOKENS = [
    ["globalThis", /globalThis/],
    ["process.", /process\./],
    ["eval", /\beval\b/],
    ["new Function", /new\s+Function\b/],
  ];

  // The guard scans CODE, not prose. Honest documentation must not be punished
  // for naming the very spellings it declares out of scope (checks.mjs's own
  // header comment mentions `import(`/`require(`/`process["getBuiltinModule"]`).
  // APPROXIMATION, not a parser: a string or regex literal containing `//`
  // could be mis-stripped; the module's actual sources do not, and every
  // injected vector below is code, so discrimination is preserved. Line
  // comments are stripped FIRST. Verified against the module: it holds exactly
  // 3 `/*` sequences, all inside `//` comments (the file header and the INV-3
  // note), so the line-comment strip removes every one of them; and it holds
  // NO `*/` at all — asserted below — so the block rule below has nothing to
  // pair and cannot swallow real code. The `//` rule skips a slash pair
  // preceded by `:` or `\` so the `https://` search scheme is never mistaken
  // for a comment start.
  function stripComments(source) {
    return source
      .replace(/(^|[^:\\])\/\/[^\n]*/g, "$1")
      .replace(/\/\*[\s\S]*?\*\//g, " ");
  }

  function purityViolations(source) {
    const code = stripComments(source);
    const found = [];
    for (const re of SPECIFIER_RES) {
      for (const m of code.matchAll(re)) found.push(m[1]);
    }
    const issues = [];
    for (const spec of found) {
      if (!ALLOWED_IMPORTS.includes(spec)) issues.push(`import não permitido: ${spec}`);
    }
    for (const spec of ALLOWED_IMPORTS) {
      if (!found.includes(spec)) issues.push(`import esperado ausente: ${spec}`);
    }
    if (/\bimport\s*\(/.test(code)) issues.push("import() dinâmico");
    if (/\brequire\s*\(/.test(code)) issues.push("require() dinâmico");
    for (const [label, re] of BANNED_TOKENS) {
      if (re.test(code)) issues.push(`capacidade fora do allowlist: ${label}`);
    }
    return issues;
  }

  it("imports exactly {node:fs, node:path} and no dynamic import/require", () => {
    assert.deepEqual(purityViolations(src), []);
  });

  it("does not punish honest documentation: a comment naming banned spellings is ignored", () => {
    const injected = `${src}\n// require("node:child_process"); import("node:net"); process["getBuiltinModule"]("node:child_process")\n`;
    assert.notEqual(injected, src, "control: the injection changes the source");
    assert.deepEqual(purityViolations(injected), []);
  });

  it("comment stripping does not hide real code: an import after a comment line still fails", () => {
    const injected = `${src}\n// just a note\nimport { execSync } from "node:child_process";\n`;
    assert.notEqual(injected, src, "control: the injection changes the source");
    const issues = purityViolations(injected);
    assert.ok(
      issues.some((m) => m.includes("node:child_process")),
      `expected node:child_process to be rejected, got: ${issues.join("; ")}`,
    );
  });

  it("discriminates: an injected node:child_process import fails the assertion", () => {
    const injected = src.replace(
      'from "node:fs"',
      'from "node:fs";\nimport { execSync } from "node:child_process"',
    );
    assert.notEqual(injected, src, "control: the injection must change the source");
    const issues = purityViolations(injected);
    assert.ok(
      issues.some((m) => m.includes("node:child_process")),
      `expected node:child_process to be rejected, got: ${issues.join("; ")}`,
    );
  });

  it("discriminates: an injected dynamic import() fails the assertion", () => {
    const injected = `${src}\nconst net = await import("node:net");\n`;
    assert.ok(
      purityViolations(injected).some((m) => /import\(\)/.test(m)),
      "dynamic import must be rejected",
    );
  });

  it("discriminates: a MULTI-LINE import of node:child_process fails the assertion", () => {
    const injected = src.replace(
      'from "node:fs"',
      'from "node:fs";\nimport {\n  execSync\n} from "node:child_process"',
    );
    assert.notEqual(injected, src, "control: the injection must change the source");
    const issues = purityViolations(injected);
    assert.ok(
      issues.some((m) => m.includes("node:child_process")),
      `expected node:child_process to be rejected, got: ${issues.join("; ")}`,
    );
  });

  it("discriminates: an `export … from` re-export of node:child_process fails the assertion", () => {
    const injected = `${src}\nexport { execSync } from "node:child_process";\n`;
    assert.notEqual(injected, src, "control: the injection must change the source");
    const issues = purityViolations(injected);
    assert.ok(
      issues.some((m) => m.includes("node:child_process")),
      `expected node:child_process to be rejected, got: ${issues.join("; ")}`,
    );
  });

  it("discriminates: each banned ambient token (globalThis/process./eval/new Function) is rejected", () => {
    const vectors = [
      ["globalThis", 'globalThis.fetch("https://example.org")'],
      ["process.", "process.exit(0)"],
      ["eval", 'eval("1 + 1")'],
      ["new Function", 'new Function("return 1")()'],
    ];
    for (const [label, snippet] of vectors) {
      const injected = `${src}\n${snippet};\n`;
      assert.notEqual(injected, src, `control: ${label} injection changes the source`);
      const issues = purityViolations(injected);
      assert.ok(
        issues.some((m) => m.includes(label)),
        `expected ${label} to be rejected, got: ${issues.join("; ")}`,
      );
    }
  });

  it("counts RESEARCH sources with the literal http(s) scheme — no obfuscation", () => {
    assert.match(src, /https\?:\/\//, "the literal scheme must appear in the source");
    assert.doesNotMatch(src, /\[\s*"ht"\s*,\s*"tp"\s*\]/, "the scheme must not be assembled from fragments");
    assert.match(src, /string de busca/i, "the comment must state it is a search string");
  });

  it("does not carry installer-DENYLIST literals", () => {
    const lower = src.toLowerCase();
    for (const lit of ["taskflow", "vuetify", "primevue", "lombok", "mapstruct", "restassured"]) {
      assert.equal(lower.includes(lit), false, `denylist literal ${lit}`);
    }
  });

  // N4 — the guard depends on an invariant that must be ASSERTED, not assumed:
  // the block-comment rule (/\/\*[\s\S]*?\*\//g) only misbehaves if the source
  // holds a `/*` that survives the line-comment strip (i.e. one inside a string
  // or regex) AND a later `*/`. Asserting the absence of `*/` makes the block
  // rule a no-op: with nothing to pair, it cannot swallow real code.
  it("contains no `*/` — the block-comment stripper has nothing to pair (N4)", () => {
    assert.equal(/\*\//.test(src), false, "checks.mjs must contain no `*/`");
  });

  it("every `/*` lives inside a comment — none in strings/code (N4)", () => {
    // After stripping comments, no `/*` may survive: a `/*` inside a string or
    // code would remain, and is exactly what a later `*/` could pair with.
    assert.equal(
      /\/\*/.test(stripComments(src)),
      false,
      "a `/*` outside a comment survives stripping",
    );
  });

  it("discriminates (N4): a `/*` in a string + a stray `*/` blinds the scan", () => {
    // The hazard made explicit: a `/*` inside a STRING survives the
    // line-comment strip, so a later `*/` opens a phantom block comment that
    // swallows the injected import. This is why the source must carry no `*/`.
    const injected = `${src}\nconst s = "/*";\nimport { execSync } from "node:child_process";\n${"*/"}\n`;
    assert.notEqual(injected, src, "control: the injection changes the source");
    assert.deepEqual(
      purityViolations(injected),
      [],
      "the phantom block comment must swallow the injected import (guard blind)",
    );
    assert.equal(/\*\//.test(src), false, "the real source carries no `*/`");
    assert.equal(/\*\//.test(`${src}\n*/`), true, "the assertion discriminates a stray `*/`");
  });
});
