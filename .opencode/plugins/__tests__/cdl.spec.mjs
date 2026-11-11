// cdl.spec.mjs — TDD do Critério do Destino Limpo (ADR-001, CD-01..CD-10).
//
// Contract (ADR-001 §3 prevalece sobre a SPEC):
//   runCdlChecks(root, opts) → { ok, results: [{ id, status, detail }], counters }
// com os 7 ids da ADR-001 §2.5 + os 2 alarmes estruturais de A-1.
//
// Regra desta spec, herdada de `refs.spec.mjs` e `inventory.spec.mjs`: cada modo
// de falha é provado por FIXTURE QUE O DERRUBA — árvore em `tempScope`, mutação
// REAL (um arquivo, uma linha, um caractere) e FAIL do id específico. Asserção
// de fachada (checar que o id existe) não conta.
//
// A baseline do repo NÃO é o alvo daqui: as fixtures rodam com `baseline: []`,
// `exceptions: []` e `projectTerms: []` para isolar a mutação — o PASS do repo
// real é um caso à parte, no fim, com os números publicados no `detail` do V20.
import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { tempScope } from "../../../scripts/test-temp.mjs";
import { REPO_ROOT } from "../lib/config.mjs";
import {
  BASELINE,
  EXCEPTIONS,
  PROJECT_TERMS,
  STACK_VOCAB,
  VERDICTS,
  classifyLine,
  declaredAxis,
  derivePopulation,
  missingVocabulary,
  prohibitionOf,
  runCdlChecks,
  sha256Line,
} from "../lib/cdl/checks.mjs";
import { cdlCheckResults } from "../../../scripts/static-checks.mjs";

const TMP = tempScope({ label: "cdl-checks" });
afterEach(() => TMP.cleanup());
after(() => TMP.cleanup());

function fixture(files) {
  return TMP.tmp(files);
}

function byId(report, id) {
  const r = report.results.find((x) => x.id === id);
  assert.ok(r, `resultado ausente: ${id}`);
  return r;
}

// Declarações mínimas: o fixture não herda o mapa real (senão todo artefato do
// instalador seria fantasma no fixture). `ruleCommon` decide o eixo: artefato
// comum tem ∅ por construção.
const DECL = {
  RULES_COMMON: ["uma.md"],
  RULES_BY_AXIS: {},
  SKILLS_COMMON: [],
  SKILLS_BY_AXIS: {},
  AXIS_IDS: {
    backend: ["java", "other", "none"],
    frontend: ["vue", "other", "none"],
  },
  STACKS_FOR_EXCEPTIONS: {},
};

const LOCK = JSON.stringify({ version: "1", skills: {} });
const RULE = "# Uma\n- Use JUnit 5 e Mockito\n";

function baseFiles(extra = {}) {
  return {
    ".agents/skills/.vendor-lock.json": LOCK,
    ".agents/rules/uma.md": RULE,
    ...extra,
  };
}

const OPTS = { baseline: [], exceptions: [], projectTerms: [] };

function options(overrides = {}) {
  return { ...OPTS, declarations: { ...DECL, ...(overrides.declarations ?? {}) }, ...overrides };
}

function entry(file, line, text, { verdict = "incondicional", owner = "ADR-002" } = {}) {
  return { file, line, sha256: sha256Line(text), verdict, owner };
}

const ALL_IDS = [
  "cdl-unconditional-unbaselined",
  "cdl-baseline-stale",
  "cdl-exception-stale",
  "cdl-axis-vocabulary-missing",
  "cdl-population-payload-gap",
  "cdl-axis-declaration-phantom",
  "cdl-identity-term-stale",
];

describe("rubrica — 4 vereditos, ordem fixa (RF-05)", () => {
  it("VERDICTS tem exatamente os 4 valores na ordem da ADR", () => {
    assert.deepEqual([...VERDICTS], ["condicional", "exemplo", "catálogo", "incondicional"]);
  });

  it("condicional: o artefato declara o eixo do termo", () => {
    const verdict = classifyLine("- Use JUnit 5 e Mockito", { axis: new Set(["java"]) });
    assert.equal(verdict, "condicional");
  });

  it("condicional: gate explícito na própria linha", () => {
    const verdict = classifyLine("- **Backend (Java 21)**: use JUnit 5 e Mockito", {
      axis: new Set(),
    });
    assert.equal(verdict, "condicional");
  });

  it("exemplo: termo entre aspas", () => {
    const verdict = classifyLine('- Unitários: "JUnit 5" + Mockito', { axis: new Set() });
    assert.equal(verdict, "exemplo");
  });

  it("exemplo: bloco PICCO (<acceptance>)", () => {
    const verdict = classifyLine("- Use JUnit 5 e Mockito", { axis: new Set(), inPico: true });
    assert.equal(verdict, "exemplo");
  });

  it("catálogo: dois eixos disjuntos na mesma linha", () => {
    const verdict = classifyLine("- Escolha Spring ou React para a UI", { axis: new Set() });
    assert.equal(verdict, "catálogo");
  });

  it("incondicional: artefato comum (∅) prescrevendo stack (SPEC E1)", () => {
    const verdict = classifyLine("- Use JUnit 5 e Mockito", { axis: new Set() });
    assert.equal(verdict, "incondicional");
  });

  it("ordem: exemplo vence catálogo", () => {
    const verdict = classifyLine('- "JUnit 5" ou Mockito, escolha um', { axis: new Set() });
    assert.equal(verdict, "exemplo");
  });

  it("ordem: catálogo vence condicional (heading que nomeia o eixo)", () => {
    const verdict = classifyLine("- Escolha Spring ou React", {
      axis: new Set(["java"]),
      heading: "## Java Ecosystem (Spring Boot)",
    });
    assert.equal(verdict, "catálogo");
  });

  it("proibição (D2) não recebe veredito, mas é detectada", () => {
    assert.equal(prohibitionOf("- NUNCA use Lombok"), true);
    assert.equal(classifyLine("- NUNCA use Lombok", { axis: new Set() }), null);
    assert.equal(prohibitionOf("- Use Lombok"), false);
  });
});

describe("declaredAxis — fonte de eixo em ordem (RF-04)", () => {
  it("artefato comum (`RULES_COMMON`) tem ∅ — comum não confere eixo", () => {
    const axis = declaredAxis(".agents/rules/workflow-rules.md");
    assert.equal(axis.size, 0);
  });

  it("mapa de exclusão devolve o COMPLEMENTO do id excluído", () => {
    const axis = declaredAxis(".agents/rules/frontend-coding-standards.md");
    assert.ok(axis.has("vue"), "rule excluída de `frontend=react` é a rule de vue");
    assert.ok(!axis.has("react"));
  });

  it("skill vendorizada usa `stacks` do lock, nunca o nome", () => {
    const axis = declaredAxis(
      ".agents/skills/react-best-practices/SKILL.md",
      undefined,
      { "react-best-practices": { stacks: ["react"] } },
    );
    assert.deepEqual([...axis], ["react"]);
  });

  it("skill local sem lock declara eixo pelo segmento do nome (E-3/D8)", () => {
    const axis = declaredAxis(".agents/skills/java-architecture-specialist/SKILL.md", undefined, {});
    assert.deepEqual([...axis], ["java"]);
  });
});

describe("vocabulário — chave derivada, cobertura cobrada (RF-03)", () => {
  it("as 10 chaves de AXIS_IDS ∪ stacks do lock estão cobertas hoje", () => {
    assert.deepEqual(missingVocabulary(), []);
    assert.equal(Object.keys(STACK_VOCAB).length, 10);
  });

  it("eixo novo sem vocabulário derruba `cdl-axis-vocabulary-missing` (RF-09)", () => {
    const root = fixture(baseFiles());
    const report = runCdlChecks(
      root,
      options({
        declarations: {
          AXIS_IDS: { backend: ["java", "svelte"], frontend: ["vue"] },
          RULES_COMMON: [],
        },
      }),
    );
    assert.equal(report.ok, false);
    const result = byId(report, "cdl-axis-vocabulary-missing");
    assert.equal(result.status, "FAIL");
    assert.match(result.detail, /svelte/);
  });
});

describe("população e baseline (RF-02, RF-06)", () => {
  it("linha incondicional fora da BASELINE derruba `cdl-unconditional-unbaselined`", () => {
    const root = fixture(baseFiles());
    const report = runCdlChecks(root, options());
    assert.equal(report.ok, false);
    const result = byId(report, "cdl-unconditional-unbaselined");
    assert.equal(result.status, "FAIL");
    assert.match(result.detail, /\.agents\/rules\/uma\.md:2/);
  });

  it("a MESMA linha declarada na BASELINE passa", () => {
    const root = fixture(baseFiles());
    const report = runCdlChecks(
      root,
      options({ baseline: [entry(".agents/rules/uma.md", 2, "- Use JUnit 5 e Mockito")] }),
    );
    assert.equal(byId(report, "cdl-unconditional-unbaselined").status, "PASS");
    assert.equal(byId(report, "cdl-baseline-stale").status, "PASS");
    assert.equal(report.ok, true);
  });

  it("baseline com sha errado derruba `cdl-baseline-stale`", () => {
    const root = fixture(baseFiles());
    const stale = entry(".agents/rules/uma.md", 2, "- texto que não é o da linha");
    const report = runCdlChecks(root, options({ baseline: [stale] }));
    const result = byId(report, "cdl-baseline-stale");
    assert.equal(result.status, "FAIL");
    assert.match(result.detail, /linha mudou/);
  });

  it("baseline cujo veredito deixou de ser incondicional derruba `cdl-baseline-stale`", () => {
    const root = fixture(
      baseFiles({
        ".agents/rules/uma.md": "# Uma\n## Java Ecosystem\n- Use JUnit 5 e Mockito\n",
      }),
    );
    const closed = entry(".agents/rules/uma.md", 3, "- Use JUnit 5 e Mockito");
    const report = runCdlChecks(root, options({ baseline: [closed] }));
    const result = byId(report, "cdl-baseline-stale");
    assert.equal(result.status, "FAIL");
    assert.match(result.detail, /deixou de ser incondicional: condicional/);
  });

  it("entrada de baseline sem owner é inválida (o dono não é do revisor)", () => {
    const root = fixture(baseFiles());
    const noOwner = { ...entry(".agents/rules/uma.md", 2, "- Use JUnit 5 e Mockito"), owner: "" };
    const report = runCdlChecks(root, options({ baseline: [noOwner] }));
    assert.equal(byId(report, "cdl-baseline-stale").status, "FAIL");
    assert.match(byId(report, "cdl-baseline-stale").detail, /owner/);
  });
});

describe("exceções declaradas (RF-07)", () => {
  it("E-2 morta (linha sem `N/A`) derruba `cdl-exception-stale`", () => {
    const lines = Array.from({ length: 14 }, (_, i) => `linha ${i + 1}`);
    const root = fixture(
      baseFiles({ ".agents/rules/config.md": `${lines.join("\n")}\n` }),
    );
    const report = runCdlChecks(
      root,
      options({
        exceptions: [
          {
            id: "E-2",
            reason: "N/A justificado inline",
            predicate: {
              type: "line-declaration",
              file: ".agents/rules/config.md",
              line: 13,
              contains: "N/A",
            },
            proof: "fixture",
          },
        ],
      }),
    );
    const result = byId(report, "cdl-exception-stale");
    assert.equal(result.status, "FAIL");
    assert.match(result.detail, /E-2: .*sem "N\/A"/);
  });

  it("E-1 sem catálogo `.md` derruba `cdl-exception-stale`", () => {
    const root = fixture(baseFiles({ ".agents/skills/vazio/nota.txt": "x\n" }));
    const report = runCdlChecks(
      root,
      options({
        declarations: { RULES_COMMON: [] },
        exceptions: [
          {
            id: "E-1",
            reason: "catálogo multi-stack",
            predicate: { type: "artifact-prefix", value: ".agents/skills/vazio/" },
            proof: "fixture",
          },
        ],
      }),
    );
    const result = byId(report, "cdl-exception-stale");
    assert.equal(result.status, "FAIL");
    assert.match(result.detail, /sem catálogo \.md/);
  });

  it("E-4 viva passa (a exclusão X2 existe)", () => {
    const root = fixture(baseFiles());
    const report = runCdlChecks(
      root,
      options({
        exceptions: [
          {
            id: "E-4",
            reason: "dado de teste/fixture",
            predicate: { type: "population-exclusion", value: "X2" },
            proof: "fixture",
          },
        ],
      }),
    );
    assert.equal(byId(report, "cdl-exception-stale").status, "PASS");
  });
});

describe("população × payload e fantasma (RF-02, SPEC E4)", () => {
  it("artefato propagado fora dos globs derruba `cdl-population-payload-gap`", () => {
    const root = fixture(
      baseFiles({
        ".agents/skills/skill-util/SKILL.md": "# skill-util\n",
        ".agents/skills/skill-util/__tests__/nota.md": "# fixture\n",
      }),
    );
    const report = runCdlChecks(
      root,
      options({ declarations: { RULES_COMMON: [], SKILLS_COMMON: ["skill-util"] } }),
    );
    const result = byId(report, "cdl-population-payload-gap");
    assert.equal(result.status, "FAIL");
    assert.match(result.detail, /__tests__\/nota\.md/);
  });

  it("mapa de eixo nomeando artefato ausente derruba `cdl-axis-declaration-phantom`", () => {
    const root = fixture(baseFiles());
    const report = runCdlChecks(
      root,
      options({ declarations: { RULES_BY_AXIS: { "frontend=vue": ["fantasma.md"] } } }),
    );
    const result = byId(report, "cdl-axis-declaration-phantom");
    assert.equal(result.status, "FAIL");
    assert.match(result.detail, /fantasma\.md/);
  });
});

describe("A-1 — registro e dois alarmes estruturais (RF-10)", () => {
  it("`license:` fora de SPDX derruba `cdl-identity-term-stale`", () => {
    const root = fixture(
      baseFiles({
        ".agents/skills/projeto/SKILL.md": "---\nname: projeto\nlicense: Foo Security Standard\n---\n# x\n",
      }),
    );
    const report = runCdlChecks(
      root,
      options({ declarations: { RULES_COMMON: [] }, projectTerms: [] }),
    );
    const result = byId(report, "cdl-identity-term-stale");
    assert.equal(result.status, "FAIL");
    assert.match(result.detail, /license fora de SPDX/);
  });

  it("`license:` com SPDX é admissível", () => {
    const root = fixture(
      baseFiles({
        ".agents/skills/projeto/SKILL.md": "---\nname: projeto\nlicense: MIT\n---\n# x\n",
      }),
    );
    const report = runCdlChecks(
      root,
      options({ declarations: { RULES_COMMON: [] }, projectTerms: [] }),
    );
    assert.equal(byId(report, "cdl-identity-term-stale").status, "PASS");
  });

  it("termo de projeto sem prova viva derruba `cdl-identity-term-stale`", () => {
    const root = fixture(baseFiles());
    const report = runCdlChecks(
      root,
      options({
        projectTerms: [
          { term: "TaskFlow", class: "projeto", proof: ".agents/NAO.md:1", owner: "ADR-005" },
        ],
      }),
    );
    const result = byId(report, "cdl-identity-term-stale");
    assert.equal(result.status, "FAIL");
    assert.match(result.detail, /proof morta/);
  });

  it("posição identitária nova (fora da baseline) derruba `cdl-identity-term-stale`", () => {
    const root = fixture(
      baseFiles({ ".agents/rules/uma.md": "# Uma — TaskFlow\n- Use JUnit 5 e Mockito\n" }),
    );
    const report = runCdlChecks(
      root,
      options({
        projectTerms: [
          {
            term: "TaskFlow",
            class: "projeto",
            proof: ".agents/rules/uma.md:1",
            owner: "ADR-002",
          },
        ],
      }),
    );
    const result = byId(report, "cdl-identity-term-stale");
    assert.equal(result.status, "FAIL");
    assert.match(result.detail, /posição identitária fora da baseline/);
  });
});

describe("repo real — os 7 ids PASS e os contadores publicados (RF-08, RF-09, RF-11)", () => {
  const report = runCdlChecks(REPO_ROOT);

  it("nenhum dos 7 ids reprova no repo", () => {
    for (const id of ALL_IDS) assert.equal(byId(report, id).status, "PASS", id);
    assert.equal(report.ok, true);
  });

  it("população é 228 arquivos / 31.661 linhas (D7)", () => {
    const population = derivePopulation(REPO_ROOT);
    assert.equal(population.files.length, 228);
    assert.equal(population.lines, 31661);
    assert.equal(report.counters.population.files, 228);
    assert.equal(report.counters.population.lines, 31661);
  });

  it("baseline contém as 15 linhas identitárias em 12 arquivos", () => {
    assert.equal(report.counters.identity.lines, 15);
    assert.equal(report.counters.identity.files, 12);
    assert.equal(BASELINE.filter((e) => e.verdict === "identity").length, 15);
  });

  it("D2 é contada, não presumida: contador em PASS", () => {
    assert.equal(typeof report.counters.prohibitionCited, "number");
    assert.ok(report.counters.prohibitionCited > 0, "proibições citando tecnologia são contadas");
    // Proibição não consome veredito: o total de prescrições não inclui D2.
    assert.ok(report.counters.prescriptions.total > 0);
  });

  it("A-3 publica `refs-undetected` com dono ADR-004", () => {
    assert.equal(typeof report.counters.refsUndetected, "number");
    assert.ok(report.counters.refsUndetected > 0, "a 2ª gramática é publicada, nunca silêncio");
  });

  it("EXCEPTIONS e PROJECT_TERMS são o registro vivo", () => {
    assert.equal(EXCEPTIONS.length, 4);
    assert.deepEqual(EXCEPTIONS.map((e) => e.id), ["E-1", "E-2", "E-3", "E-4"]);
    assert.deepEqual(PROJECT_TERMS.map((t) => t.term), ["TaskFlow", "Atlas ECM", "Pulse"]);
  });

  it("o adapter publica um único V20 com os contadores no PASS", () => {
    const results = cdlCheckResults(REPO_ROOT);
    for (const id of ALL_IDS) {
      const r = results.find((x) => x.id === id);
      assert.equal(r.status, "PASS", id);
    }
  });
});

describe("adapter — o veredito é o `ok`, não a linha de console (RF-01)", () => {
  it("fixture com incondicional não declarado reprova o adapter", () => {
    const root = fixture(baseFiles());
    const results = cdlCheckResults(root, options());
    const result = results.find((r) => r.id === "cdl-unconditional-unbaselined");
    assert.equal(result.status, "FAIL");
  });
});
