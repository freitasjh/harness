// checks-adr.spec.mjs — TDD for the per-ADR layout (F3a / D-A).
//
// Contract (`.opencode/plugins/lib/prd-adr-pipeline/checks.mjs`):
//   - `ADR-INDEX.md` gains the OPTIONAL column `unit` (`adr` | `legacy`).
//   - ADR-01: `unit: adr` ⇒ the ADR directory also carries `SPEC.md` and
//     `TASKS.md`, plus `VERIFY.md` when `status=merged`. `TASKS.md` MUST carry
//     `<!-- scope: adr/<ADR-ID> -->` (F4 — marker measured, not prose only).
//     `legacy`/absent keeps the original contract (`ADR.md` only) —
//     retrocompatible, never a demand. A root-level `.spec/prd/<id>/TASKS.md`
//     or `SPEC.md` is REPROVED: feature-wide SDD is not a delivery unit.
//   - ADR-02: `unit` outside the enum FAILs; a PRD that declares
//     `prd_version: 2` requires `unit: adr` on every `in-progress`/`merged` row.
//
// Every assertion has BOTH a PASS and a FAIL fixture: a check that only passes
// by absence of the target proves nothing (the defects are silently green).
import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { tempScope } from "../../../scripts/test-temp.mjs";
import { runPrdChecks } from "../../../.opencode/plugins/lib/prd-adr-pipeline/checks.mjs";

const REPO = join(import.meta.dirname, "..", "..", "..");
const TMP = tempScope({ label: "checks-adr" });
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

// 7 required sections, each with the closed-question line; §7 non-empty; a §5
// metric with "como medir"; §16 with verdict + date. `v2` adds the layout marker.
function validPrd({ v2 = false } = {}) {
  return [
    "# PRD — fixture",
    ...(v2 ? ["prd_version: 2", ""] : []),
    section(1, "Problema", `Dor real.\n${MARK}`),
    section(2, "Objetivo", `Meta.\n${MARK}`),
    section(5, "Métricas", `| Métrica | Como medir |\n|---|---|\n| tempo | contagem de merges |\n${MARK}`),
    section(6, "Escopo", `Inclui X.\n${MARK}`),
    section(7, "NÃO entra", `Não inclui Y.\n${MARK}`),
    section(9, "Requisitos", `RF-1.\n${MARK}`),
    section(16, "Aprovação", `- Veredito: aprovado\n- Data: 2026-11-18\n${MARK}`),
  ].join("\n");
}

function validAdrMd(id = "001") {
  return [
    `# ADR-${id} — Base`,
    "- **depende-de**: —",
    "- **Interface congelada**: `runPrdChecks(root)`",
  ].join("\n");
}

const RESEARCH = "# RESEARCH\n\n- Fonte A: https://example.org/a\n- Fonte B: https://example.org/b\n";

function index({ unitColumn = true, unit = "adr", status = "merged" } = {}) {
  const cols = ["order", "id", "title", "status", "depends_on", "dir", "branch", "merge"];
  if (unitColumn) cols.push("unit");
  const values = {
    order: "1",
    id: "ADR-001",
    title: "Base",
    status,
    depends_on: "—",
    dir: "ADRs/ADR-001-base/",
    branch: "adr/feat-x/01-base",
    merge: status === "merged" ? "abc123" : "—",
    unit,
  };
  return [
    `| ${cols.join(" | ")} |`,
    `|${cols.map(() => "---").join("|")}|`,
    `| ${cols.map((c) => values[c]).join(" | ")} |`,
  ].join("\n");
}

const ADR_DIR = ".spec/prd/p1/ADRs/ADR-001-base/";

// A complete per-ADR cycle: ADR + SPEC + TASKS (+ VERIFY when merged).
function tree({ prd = validPrd({ v2: true }), indexText = index(), files = null } = {}) {
  return {
    ".spec/prd/p1/PRD.md": prd,
    ".spec/prd/p1/RESEARCH.md": RESEARCH,
    ".spec/prd/p1/ADR-INDEX.md": indexText,
    [`${ADR_DIR}ADR.md`]: validAdrMd(),
    [`${ADR_DIR}SPEC.md`]: "# SPEC — ADR-001\n\n- RF-01: checks unit.\n",
    [`${ADR_DIR}TASKS.md`]: "<!-- scope: adr/ADR-001 -->\n\n### F3A-01 — checks\n",
    [`${ADR_DIR}VERIFY.md`]: "# VERIFY — ADR-001\n\nAPPROVED ✅\n",
    ...(files ?? {}),
  };
}

describe("ADR-01 — unit: adr exige SPEC/TASKS no diretório do ADR", () => {
  it("PASS: PRD v2 + ADR unit: adr merged com ADR/SPEC/TASKS/VERIFY", () => {
    const report = runPrdChecks(fixture(tree()));
    assert.equal(byId(report, "ADR-01").status, "PASS", byId(report, "ADR-01").detail);
    assert.equal(byId(report, "ADR-02").status, "PASS", byId(report, "ADR-02").detail);
    assert.equal(report.ok, true);
  });

  it("FAIL: mesmo ADR sem SPEC.md ⇒ ADR-01 reprova nomeando o arquivo", () => {
    const t = tree();
    delete t[`${ADR_DIR}SPEC.md`];
    assert.equal(Object.keys(t).some((k) => k.endsWith("ADR-001-base/SPEC.md")), false, "controle: SPEC.md removida");
    const r = byId(runPrdChecks(fixture(t)), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /ADR-001-base\/ unit=adr sem SPEC\.md/);
  });

  it("FAIL: ADR unit: adr merged sem VERIFY.md", () => {
    const t = tree();
    delete t[`${ADR_DIR}VERIFY.md`];
    const r = byId(runPrdChecks(fixture(t)), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /merged sem VERIFY\.md/);
  });

  it("PASS: ADR unit: adr in-progress dispensa VERIFY (só merged exige)", () => {
    const t = tree({ indexText: index({ status: "in-progress" }) });
    delete t[`${ADR_DIR}VERIFY.md`];
    assert.equal(Object.keys(t).some((k) => k.endsWith("ADR-001-base/VERIFY.md")), false, "controle: VERIFY.md removido");
    const report = runPrdChecks(fixture(t));
    assert.equal(byId(report, "ADR-01").status, "PASS", byId(report, "ADR-01").detail);
  });
});

describe("ADR-01 — unit: legacy continua válido (retrocompatível)", () => {
  it("PASS: PRD legado (sem prd_version) + índice sem coluna unit + só ADR.md", () => {
    const t = {
      ".spec/prd/p1/PRD.md": validPrd(),
      ".spec/prd/p1/RESEARCH.md": RESEARCH,
      ".spec/prd/p1/ADR-INDEX.md": index({ unitColumn: false }),
      [`${ADR_DIR}ADR.md`]: validAdrMd(),
    };
    const report = runPrdChecks(fixture(t));
    assert.equal(byId(report, "ADR-01").status, "PASS", byId(report, "ADR-01").detail);
    assert.equal(byId(report, "ADR-02").status, "PASS", byId(report, "ADR-02").detail);
    assert.equal(report.ok, true);
  });

  it("FAIL (controle): o MESMO índice com unit: adr reprova sem SPEC/TASKS", () => {
    const t = {
      ".spec/prd/p1/PRD.md": validPrd(),
      ".spec/prd/p1/RESEARCH.md": RESEARCH,
      ".spec/prd/p1/ADR-INDEX.md": index({ unit: "adr" }),
      [`${ADR_DIR}ADR.md`]: validAdrMd(),
    };
    const r = byId(runPrdChecks(fixture(t)), "ADR-01");
    assert.equal(r.status, "FAIL", "o layout switch é o que muda o veredito");
    assert.match(r.detail, /SPEC\.md/);
  });
});

describe("F4 — marcador de escopo medido (ADR-01)", () => {
  const SCOPE = "<!-- scope: adr/ADR-001 -->";

  it("FAIL: ADR unit: adr com TASKS.md sem marcador de escopo", () => {
    const t = tree();
    t[`${ADR_DIR}TASKS.md`] = "### F3A-01 — checks\n";
    assert.equal(t[`${ADR_DIR}TASKS.md`].includes(SCOPE), false, "controle: marcador ausente");
    const r = byId(runPrdChecks(fixture(t)), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /scope.*ADR-001|ADR-001.*scope/i, r.detail);
  });

  it("PASS: marcador correto no TASKS.md do ADR", () => {
    const t = tree();
    t[`${ADR_DIR}TASKS.md`] = `<!-- scope: adr/ADR-001 -->\n### F3A-01 — checks\n`;
    const r = byId(runPrdChecks(fixture(t)), "ADR-01");
    assert.equal(r.status, "PASS", r.detail);
  });

  it("FAIL: marcador com ID de OUTRO ADR não conta", () => {
    const t = tree();
    t[`${ADR_DIR}TASKS.md`] = "<!-- scope: adr/ADR-999 -->\n### F3A-01 — checks\n";
    const r = byId(runPrdChecks(fixture(t)), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /scope/i, r.detail);
  });

  it("FAIL: TASKS.md na raiz do PRD (SPEC de feature inteira) é reprovado", () => {
    const t = tree();
    t[".spec/prd/p1/TASKS.md"] = "### FEAT-01 — feature-wide\n";
    const r = byId(runPrdChecks(fixture(t)), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /TASKS\.md/, r.detail);
  });

  it("FAIL: SPEC.md na raiz do PRD é reprovado (mesmo sem ADRs/)", () => {
    const t = { ".spec/prd/p1/PRD.md": validPrd(), ".spec/prd/p1/SPEC.md": "# SPEC da feature\n" };
    const r = byId(runPrdChecks(fixture(t)), "ADR-01");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /SPEC\.md/, r.detail);
  });

  it("PASS: legado com só ADR.md não exige marcador (retrocompatível)", () => {
    const t = {
      ".spec/prd/p1/PRD.md": validPrd(),
      ".spec/prd/p1/RESEARCH.md": RESEARCH,
      ".spec/prd/p1/ADR-INDEX.md": index({ unitColumn: false }),
      [`${ADR_DIR}ADR.md`]: validAdrMd(),
    };
    const r = byId(runPrdChecks(fixture(t)), "ADR-01");
    assert.equal(r.status, "PASS", r.detail);
  });
});

describe("ADR-02 — enum de unit e exigência em PRD v2", () => {
  it("FAIL: unit fora do enum (adr|legacy)", () => {
    const r = byId(runPrdChecks(fixture(tree({ indexText: index({ unit: "unit" }) }))), "ADR-02");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /unit fora do enum \(adr\|legacy\): "unit"/);
  });

  it("FAIL: PRD v2 com linha in-progress sem unit: adr", () => {
    const r = byId(runPrdChecks(fixture(tree({ indexText: index({ unit: "legacy", status: "in-progress" }) }))), "ADR-02");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /PRD v2: ADR-001 com status in-progress sem unit: adr/);
  });

  it("PASS: PRD legado com in-progress unit: legacy (sem marcador v2)", () => {
    const t = tree({ prd: validPrd(), indexText: index({ unit: "legacy", status: "in-progress" }) });
    const report = runPrdChecks(fixture(t));
    assert.equal(byId(report, "ADR-02").status, "PASS", byId(report, "ADR-02").detail);
  });

  it("PASS: PRD v2 com todo ADR delivered em unit: adr", () => {
    const report = runPrdChecks(fixture(tree()));
    assert.equal(byId(report, "ADR-02").status, "PASS", byId(report, "ADR-02").detail);
    assert.match(byId(report, "ADR-02").detail, /sequência e branch conformes/);
  });

  it("FAIL: o marcador também vale como linha `> prd_version: 2` (não só frontmatter)", () => {
    const prd = validPrd().replace("# PRD — fixture\n", "# PRD — fixture\n\n> prd_version: 2\n");
    const t = tree({ prd, indexText: index({ unit: "legacy", status: "in-progress" }) });
    const r = byId(runPrdChecks(fixture(t)), "ADR-02");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /PRD v2: ADR-001 com status in-progress sem unit: adr/);
  });

  // Item 15 do review do F3a — o enum é ESTRITO em minúsculas. `unitOf` fazia
  // `toLowerCase()`, então `unit: ADR` era aceito como `adr`: o layout switch
  // passava a depender da caixa e o erro de digitação ficava invisível.
  it("FAIL: `unit: ADR` (maiúscula) reprova com mensagem que nomeia a caixa", () => {
    const r = byId(runPrdChecks(fixture(tree({ indexText: index({ unit: "ADR" }) }))), "ADR-02");
    assert.equal(r.status, "FAIL", "enum estrito: maiúscula não é sinônimo");
    assert.match(r.detail, /unit fora do enum \(adr\|legacy\): "ADR"/, r.detail);
    assert.match(r.detail, /minúsculas/, r.detail);
  });

  it("controle: `unit: adr` minúsculo continua PASS (o estrito não inventa FAIL)", () => {
    const report = runPrdChecks(fixture(tree({ indexText: index({ unit: "adr" }) })));
    assert.equal(byId(report, "ADR-02").status, "PASS", byId(report, "ADR-02").detail);
  });
});

describe("PRDs reais do repo continuam PASS (retrocompatibilidade)", () => {
  it("runPrdChecks(REPO) verde — PRD existente sem marcador v2 continua válido", () => {
    const report = runPrdChecks(REPO);
    for (const id of ["PRD-01", "ADR-01", "ADR-02"]) {
      assert.equal(byId(report, id).status, "PASS", `${id}: ${byId(report, id).detail}`);
    }
  });
});
