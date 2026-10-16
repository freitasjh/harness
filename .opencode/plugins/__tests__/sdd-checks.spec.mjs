// sdd-checks.spec.mjs — TDD for SDD-02/SDD-03/RENAME/V4/V12/V17 (Batch 7).
// Pure helpers from scripts/sdd-checks.mjs, tested against tmp fixtures
// (no repo state, no network). Failing first, then green.
import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tempScope } from "../../../scripts/test-temp.mjs";
import {
  countLines,
  evaluateSdd02,
  extractTaskIds,
  extractTaskSections,
  findLiveRefs,
  hasGatesConvention,
  hasNoBypassClause,
  hasVocabTable,
  isMappingLine,
  isNonCycleRel,
  missingArtifacts,
  readWorkflowState,
  resolveSddCycle,
  SDD_ARTIFACTS,
} from "../../../scripts/sdd-checks.mjs";

// FU-43: fixtures em temp agora são RASTREADAS — cada rodada desta spec
// deixava 25 órfãos "sdd-checks-*" em /tmp (medido antes da correção).
// afterEach cobre o caminho de falha; after é a vara final.
const TMP = tempScope({ label: "sdd-checks" });
afterEach(() => TMP.cleanup());
after(() => TMP.cleanup());

function tmp(files) {
  return TMP.tmp(files);
}

describe("V4 line budget", () => {
  it("counts lines across a rules dir", () => {
    const root = tmp({ "rules/a.md": "l1\nl2\n", "rules/b.md": "x\n" });
    assert.equal(countLines(join(root, "rules")), 3);
  });
});

describe("R-V12 orphan refs", () => {
  it("finds harness-continuous.md refs in live roots", () => {
    const root = tmp({ ".agents/x.md": "see harness-continuous.md H1" });
    assert.equal(findLiveRefs(root, ["harness-continuous\\.md"]).length, 1);
  });
  it("ignores archive history and pycache noise", () => {
    const root = tmp({
      ".spec/archive/o.md": "harness-continuous.md",
      ".agents/skills/x/__pycache__/a.pyc": "harness-continuous.md",
    });
    assert.equal(findLiveRefs(root, ["harness-continuous\\.md"]).length, 0);
  });
  it("fusion-record lines are audit trail, not orphans", () => {
    const root = tmp({ ".agents/rules/w.md": "fundido do harness-continuous.md (DOC-02)" });
    assert.equal(findLiveRefs(root, ["harness-continuous\\.md"]).length, 1);
    assert.equal(findLiveRefs(root, ["harness-continuous\\.md"], { allowFusionRecord: true }).length, 0);
  });
});

describe("RENAME anti-regression", () => {
  it("flags the old reviewer name in live paths", () => {
    const root = tmp({ ".agents/a.md": "ask fullstack-code-reviewer" });
    assert.equal(findLiveRefs(root, ["fullstack-code-reviewer"]).length, 1);
  });
  it("mapping lines (A → B) are not violations", () => {
    assert.equal(isMappingLine("RENAME `fullstack-code-reviewer` → `code-reviewer`"), true);
    assert.equal(isMappingLine("delegate to fullstack-code-reviewer now"), false);
  });
});

describe("SDD-02 mechanical subset", () => {
  it("every sprint-summary task id has a section", () => {
    const tasks = "| Phase 0 | INF-01 | Infra |\n| Phase 4 | RENAME | Infra |";
    const body = "### Task INF-01: x\n### Task RENAME: y\n";
    const ids = extractTaskIds(tasks);
    const sections = extractTaskSections(body);
    assert.deepEqual(ids, ["INF-01", "RENAME"]);
    for (const id of ids) assert.ok(sections.includes(id), `missing section ${id}`);
  });
  it("detects a section without Constraint Ref", () => {
    const root = tmp({
      "TASKS.md": "### Task X-01: t\n- **Constraint Ref**: U10\n- #### Acceptance — S1 ok\n",
    });
    assert.equal(hasGatesConvention(root), false);
  });
});

describe("SDD-01/SDD-03/V17 markers", () => {
  it("non-bypass clause requires the marker + gate-contract citation", () => {
    assert.equal(hasNoBypassClause("NÃO-BYPASS\nsee gate-contract.md"), true);
    assert.equal(hasNoBypassClause("no marker here"), false);
  });
  it("vocab table requires canonical header + a mapping row", () => {
    assert.equal(hasVocabTable("| Etapa (rótulo) | `current_phase` canônico |\n| P0 (triagem) | Discovery |"), true);
    assert.equal(hasVocabTable("no table"), false);
  });
});

// --- SDD-02 target resolution (FU-38) --------------------------------------
// The dogfood target is NOT a hardcoded path: it is resolved from the repo's
// own state, and an archived cycle (.spec/archive/**) counts as valid.
const TASKS_TABLE = [
  "# Execution Backlog — cycle",
  "## 2. Sprint Summary",
  "| Phase | Task ID | Type |",
  "| Phase 0 | INF-01 | Infra |",
  "| Phase 4 | RENAME | Infra |",
  "## 4. Task Backlog",
  "### Task INF-01: a",
  "### Task RENAME: b",
].join("\n");

const TASKS_TEMPLATE = [
  "## 2. Sprint Summary",
  "| Phase | Task ID | Type |",
  "| Phase 1 | `BE-01` | Code |",
  "## 4. Task Backlog",
  "### Task `BE-01`: implement",
].join("\n");

const TASKS_DASHED = [
  "## Batch 1 — Contrato de dados",
  "### IM-BE-01 — STACK_PROFILES",
  "### IM-VAL-02 — Vendor",
].join("\n");

function writeCycle(root, rel, tasks = TASKS_TABLE) {
  const dir = join(root, rel);
  mkdirSync(dir, { recursive: true });
  for (const a of SDD_ARTIFACTS) {
    writeFileSync(join(dir, a), a === "TASKS.md" ? tasks : `# ${a}\n`);
  }
  return dir;
}

function writeState(root, state) {
  writeFileSync(join(root, "workflow-state.json"), JSON.stringify(state, null, 2));
}

describe("SDD-02 target resolution (FU-38)", () => {
  it("exports the artifact contract the check requires", () => {
    assert.deepEqual(SDD_ARTIFACTS, ["PROPOSAL.md", "SPEC.md", "PLAN.md", "TASKS.md"]);
  });

  it("missingArtifacts reports each absent artifact of a cycle", () => {
    const root = tmp({});
    writeCycle(root, ".spec/archive/20261008-a");
    assert.deepEqual(missingArtifacts(join(root, ".spec/archive/20261008-a")), []);
    const partial = join(root, "b");
    mkdirSync(partial, { recursive: true });
    writeFileSync(join(partial, "SPEC.md"), "x\n");
    assert.deepEqual(missingArtifacts(partial), ["PROPOSAL.md", "PLAN.md", "TASKS.md"]);
  });

  it("readWorkflowState returns null instead of throwing on absent/invalid state", () => {
    const root = tmp({});
    assert.equal(readWorkflowState(root), null);
    writeFileSync(join(root, "workflow-state.json"), "{ not json");
    assert.equal(readWorkflowState(root), null);
  });

  it("resolves the cycle declared by state.artifacts.archive (archived cycle is valid)", () => {
    const root = tmp({});
    writeCycle(root, ".spec/archive/20261008-harness-installer-mobile", TASKS_DASHED);
    writeState(root, {
      current_feature: "harness-installer-mobile",
      artifacts: { archive: ".spec/archive/20261008-harness-installer-mobile/" },
    });
    const cycle = resolveSddCycle(root);
    assert.equal(cycle.complete, true);
    assert.equal(cycle.rel, ".spec/archive/20261008-harness-installer-mobile");
    assert.equal(cycle.via, "state.artifacts.archive");
  });

  it("tolerates stale features[] artifact paths — the false-red of FU-38", () => {
    // features[] points at .spec/governance/<feature> (already archived away);
    // the check must not fail on that stale pointer when the archive is real.
    const root = tmp({});
    writeCycle(root, ".spec/archive/20261008-harness-installer-mobile", TASKS_DASHED);
    writeState(root, {
      current_feature: "harness-installer-mobile",
      artifacts: { archive: ".spec/archive/20261008-harness-installer-mobile/" },
      features: [
        {
          name: "harness-installer-mobile",
          artifacts: {
            proposal: ".spec/governance/harness-installer-mobile/PROPOSAL.md",
            spec: ".spec/governance/harness-installer-mobile/SPEC.md",
            plan: ".spec/governance/harness-installer-mobile/PLAN.md",
            tasks: ".spec/governance/harness-installer-mobile/TASKS.md",
          },
        },
      ],
    });
    assert.equal(existsSync(join(root, ".spec/governance")), false);
    const res = evaluateSdd02(root);
    assert.equal(res.ok, true, res.detail);
    assert.match(res.detail, /\.spec\/archive\/20261008-harness-installer-mobile/);
  });

  it("resolves a live cycle by current_feature before falling back to the archive", () => {
    const root = tmp({});
    writeCycle(root, ".spec/governance/harness-v7");
    writeCycle(root, ".spec/archive/20260929-harness-v7-hardening");
    writeState(root, { current_feature: "harness-v7" });
    const cycle = resolveSddCycle(root);
    assert.equal(cycle.rel, ".spec/governance/harness-v7");
    assert.equal(evaluateSdd02(root).ok, true);
  });

  // MF-1 (review do FU-38): live incomplete cycle named by the state must not
  // be masked by a complete archive (false-green of the current cycle).
  it("FAILS when the state names an EXISTING but INCOMPLETE live cycle even with a complete archive", () => {
    const root = tmp({});
    const live = join(root, ".spec/governance/nova-feature");
    mkdirSync(live, { recursive: true });
    writeFileSync(join(live, "SPEC.md"), "x\n");
    writeCycle(root, ".spec/archive/20261008-old-feature");
    writeState(root, { current_feature: "nova-feature" });
    const res = evaluateSdd02(root);
    assert.equal(res.ok, false, res.detail);
    assert.match(res.detail, /nova-feature/);
    assert.match(res.detail, /PROPOSAL\.md/);
  });

  it("does NOT fail when the state names a live cycle that no longer exists (FU-38 false-red stays fixed)", () => {
    const root = tmp({});
    writeCycle(root, ".spec/archive/20261008-harness-installer-mobile", TASKS_DASHED);
    writeState(root, { current_feature: "harness-installer-mobile" });
    const res = evaluateSdd02(root);
    assert.equal(res.ok, true, res.detail);
    assert.match(res.detail, /\.spec\/archive\/20261008-harness-installer-mobile/);
  });

  it("PASSes when the state-named live cycle is complete (archive fallback not triggered)", () => {
    const root = tmp({});
    writeCycle(root, ".spec/governance/nova-feature");
    writeCycle(root, ".spec/archive/20261008-old-feature");
    writeState(root, { current_feature: "nova-feature" });
    const cycle = resolveSddCycle(root);
    assert.equal(cycle.complete, true);
    assert.equal(cycle.rel, ".spec/governance/nova-feature");
  });

  it("falls back to the newest archived cycle when no live cycle and no state pointer", () => {
    const root = tmp({});
    writeCycle(root, ".spec/archive/20260927-old-feature");
    writeCycle(root, ".spec/archive/20261008-new-feature");
    const cycle = resolveSddCycle(root);
    assert.equal(cycle.rel, ".spec/archive/20261008-new-feature");
  });

  it("ignores partial-doc buckets (tech-debts/bugs/roadmap) when resolving", () => {
    const root = tmp({});
    mkdirSync(join(root, ".spec/tech-debts/x"), { recursive: true });
    writeFileSync(join(root, ".spec/tech-debts/x/TASKS.md"), "### T-01: x\n");
    const cycle = resolveSddCycle(root);
    assert.equal(cycle.complete, false);
    assert.equal(evaluateSdd02(root).ok, false);
  });

  it("FAILS closed when no cycle has the 4 artifacts (not vacuous)", () => {
    const root = tmp({});
    writeState(root, { current_feature: "nothing" });
    const res = evaluateSdd02(root);
    assert.equal(res.ok, false);
    assert.match(res.detail, /no complete SDD cycle/i);
  });

  it("FAILS when the resolved cycle is missing artifacts (fail-closed on drift)", () => {
    const root = tmp({});
    const dir = join(root, ".spec/governance/f");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SPEC.md"), "x\n");
    writeFileSync(join(dir, "TASKS.md"), TASKS_TABLE);
    writeState(root, { current_feature: "f" });
    const res = evaluateSdd02(root);
    assert.equal(res.ok, false);
    assert.match(res.detail, /PROPOSAL\.md|PLAN\.md/);
  });

  it("FAILS when a sprint-summary task id has no task section", () => {
    const root = tmp({});
    const orphan = TASKS_TABLE + "\n| Phase 5 | DOG-01 | Test |\n";
    writeCycle(root, ".spec/archive/20261008-a", orphan);
    const res = evaluateSdd02(root);
    assert.equal(res.ok, false);
    assert.match(res.detail, /DOG-01/);
  });

  it("FAILS when TASKS.md declares no task section at all", () => {
    const root = tmp({});
    writeCycle(root, ".spec/archive/20261008-a", "# backlog vazio\nsem tasks\n");
    assert.equal(evaluateSdd02(root).ok, false);
  });

  it("PASSes a cycle whose TASKS uses the `### ID — title` convention and no sprint table", () => {
    const root = tmp({});
    writeCycle(root, ".spec/archive/20261008-a", TASKS_DASHED);
    const res = evaluateSdd02(root);
    assert.equal(res.ok, true, res.detail);
    assert.match(res.detail, /sections=2/);
  });

  it("parses both task conventions and the backticked canonical template", () => {
    assert.deepEqual(extractTaskSections(TASKS_TABLE), ["INF-01", "RENAME"]);
    assert.deepEqual(extractTaskSections(TASKS_DASHED), ["IM-BE-01", "IM-VAL-02"]);
    assert.deepEqual(extractTaskIds(TASKS_TEMPLATE), ["BE-01"]);
    assert.deepEqual(extractTaskSections(TASKS_TEMPLATE), ["BE-01"]);
  });

  it("does not treat prose headings as task sections", () => {
    assert.deepEqual(extractTaskSections("### Batch 1 — Contrato\n#### Acceptance — S1\n"), []);
  });

  it("accepts single-letter task ids (T-01/S-01/B-01) — FU-38 MF-2 regression", () => {
    assert.deepEqual(extractTaskSections("### T-01: x\n### S-02 — y\n### B-01 — z\n"), ["T-01", "S-02", "B-01"]);
    assert.deepEqual(extractTaskIds("| Phase 0 | T-01 | Tech debt |\n"), ["T-01"]);
  });

  it("still rejects prose ids — selectivity is not traded for single letters", () => {
    for (const prose of ["### WARNING — do not", "### Batch 1 — Contrato", "### API v2", "### Task 42"]) {
      assert.deepEqual(extractTaskSections(prose), [], `should reject ${prose}`);
    }
  });
});

// --- FU-38 hard-stop: Tier-1 explicit state-pointer precedence ---------------
// Precedence contract (documented in resolveSddCycle):
//   ponteiro explícito do estado (Tier 1) → ciclo VIVO completo
//   > ciclo vivo completo (current_feature)
//   > archive.
// Um ponteiro Tier-1 SÓ vence se apontar para dir VIVO e COMPLETO: ponteiro de
// archive nunca abafa drift (contra-prova do MF-1).
describe("SDD-02 Tier-1 state-pointer precedence (FU-38 hard-stop)", () => {
  it("state.artifacts pointer to a LIVE complete cycle beats same-name WIP drift", () => {
    const root = tmp({});
    writeCycle(root, ".spec/backend/nova-feature");
    const wip = join(root, ".spec/frontend/nova-feature");
    mkdirSync(wip, { recursive: true });
    writeFileSync(join(wip, "SPEC.md"), "wip\n");
    writeState(root, {
      current_feature: "nova-feature",
      artifacts: {
        spec: ".spec/backend/nova-feature/SPEC.md",
        tasks: ".spec/backend/nova-feature/TASKS.md",
      },
    });
    const res = evaluateSdd02(root);
    assert.equal(res.ok, true, res.detail);
    assert.match(res.detail, /\.spec\/backend\/nova-feature/);
    const cycle = resolveSddCycle(root);
    assert.equal(cycle.complete, true);
    assert.equal(cycle.via, "state.artifacts.spec");
  });

  it("features[] artifacts pointer to a LIVE complete cycle beats same-name WIP drift", () => {
    const root = tmp({});
    writeCycle(root, ".spec/backend/outra-feature");
    const wip = join(root, ".spec/frontend/outra-feature");
    mkdirSync(wip, { recursive: true });
    writeFileSync(join(wip, "SPEC.md"), "wip\n");
    writeState(root, {
      current_feature: "outra-feature",
      features: [
        {
          name: "outra-feature",
          artifacts: { tasks: ".spec/backend/outra-feature/TASKS.md" },
        },
      ],
    });
    const res = evaluateSdd02(root);
    assert.equal(res.ok, true, res.detail);
    assert.match(res.detail, /\.spec\/backend\/outra-feature/);
    assert.equal(resolveSddCycle(root).via, 'state.features[outra-feature].artifacts');
  });

  it("Tier-1 INCOMPLETE live pointer does not win — drift still fails (no weakening)", () => {
    const root = tmp({});
    const dir = join(root, ".spec/backend/nova-feature");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SPEC.md"), "partial\n");
    writeState(root, {
      current_feature: "nova-feature",
      artifacts: { spec: ".spec/backend/nova-feature/SPEC.md" },
    });
    const res = evaluateSdd02(root);
    assert.equal(res.ok, false, res.detail);
    assert.match(res.detail, /drift/);
  });

  it("archive-only Tier-1 pointer does NOT mask live incomplete cycle — MF-1 contra-prova", () => {
    const root = tmp({});
    const live = join(root, ".spec/backend/nova-feature");
    mkdirSync(live, { recursive: true });
    writeFileSync(join(live, "SPEC.md"), "x\n");
    writeCycle(root, ".spec/archive/20261008-nova-feature");
    writeState(root, {
      current_feature: "nova-feature",
      artifacts: { archive: ".spec/archive/20261008-nova-feature/" },
    });
    const res = evaluateSdd02(root);
    assert.equal(res.ok, false, res.detail);
    assert.match(res.detail, /nova-feature/);
    assert.match(res.detail, /PROPOSAL\.md/);
  });
});

// --- FU-39: vitória do Tier-1 é ESCOPADA ao ciclo do current_feature --------
// Um ponteiro Tier-1 COMPLETO de OUTRA feature (stale, de um ciclo anterior)
// abafava o drift do ciclo que o estado nomeia como atual: ponteiro stale
// completo declarava "ciclo ok" enquanto o ciclo corrente estava incompleto.
// A vitória agora exige que o ponteiro nomeie o current_feature.
describe("SDD-02 Tier-1 scoped to current_feature (FU-39)", () => {
  it("Tier-1 completo de OUTRA feature NAO abafa drift do ciclo corrente", () => {
    const root = tmp({});
    writeCycle(root, ".spec/backend/velha-feature");           // completo, stale
    const live = join(root, ".spec/backend/nova-feature");
    mkdirSync(live, { recursive: true });
    writeFileSync(join(live, "SPEC.md"), "wip\n");             // corrente, incompleto
    writeState(root, {
      current_feature: "nova-feature",
      artifacts: {
        spec: ".spec/backend/velha-feature/SPEC.md",
        tasks: ".spec/backend/velha-feature/TASKS.md",
      },
    });
    const res = evaluateSdd02(root);
    assert.equal(res.ok, false, res.detail);
    assert.match(res.detail, /nova-feature/, "drift do ciclo CORRENTE reportado");
    assert.match(res.detail, /PROPOSAL\.md/, "faltantes do ciclo corrente listados");
  });

  it("Tier-1 do proprio current_feature continua vencendo (mesmo nome, camada diferente)", () => {
    const root = tmp({});
    writeCycle(root, ".spec/frontend/nova-feature");
    const wip = join(root, ".spec/backend/nova-feature");
    mkdirSync(wip, { recursive: true });
    writeFileSync(join(wip, "SPEC.md"), "wip\n");
    writeState(root, {
      current_feature: "nova-feature",
      artifacts: { spec: ".spec/frontend/nova-feature/SPEC.md" },
    });
    const res = evaluateSdd02(root);
    assert.equal(res.ok, true, res.detail);
    assert.match(res.detail, /\.spec\/frontend\/nova-feature/);
  });

  it("sem current_feature nao ha ciclo para escopar: Tier-1 completo vence (retrocompat)", () => {
    const root = tmp({});
    writeCycle(root, ".spec/backend/qualquer");
    writeState(root, { artifacts: { spec: ".spec/backend/qualquer/SPEC.md" } });
    const res = evaluateSdd02(root);
    assert.equal(res.ok, true, res.detail);
  });

  it("isNonCycleRel classifica buckets sem-ciclo (.spec/<bucket>/...)", () => {
    for (const bucket of ["tech-debts", "bugs", "roadmap", "archive"]) {
      assert.equal(isNonCycleRel(`.spec/${bucket}/qualquer`), true, `${bucket} nao e ciclo`);
    }
    assert.equal(isNonCycleRel(".spec/backend/feature"), false);
    assert.equal(isNonCycleRel(".spec/feature"), false);
    assert.equal(isNonCycleRel(""), false);
    assert.equal(isNonCycleRel(null), false);
  });
});

// --- FU-40: Tier-1 ignora buckets não-ciclo ---------------------------------
// .spec/tech-debts|bugs|roadmap carregam docs PARCIAIS. Com 4 artefatos
// completos (proposta de ciclo), um ponteiro Tier-1 para esse bucket faria o
// check amarar ciclo nesse diretorio — e o ciclo real (current_feature)
// incompleto passaria sem drift. Buckets sem-ciclo nunca qualificam.
describe("SDD-02 Tier-1 ignores SPEC_NON_CYCLE buckets (FU-40)", () => {
  it("Tier-1 apontando para tech-debts COMPLETO nao abafa drift do ciclo corrente", () => {
    const root = tmp({});
    writeCycle(root, ".spec/tech-debts/x-completo");           // 4 artefatos, mas bucket parcial
    const live = join(root, ".spec/governance/nova-feature");
    mkdirSync(live, { recursive: true });
    writeFileSync(join(live, "SPEC.md"), "wip\n");
    writeState(root, {
      current_feature: "nova-feature",
      artifacts: { tasks: ".spec/tech-debts/x-completo/TASKS.md" },
    });
    const res = evaluateSdd02(root);
    assert.equal(res.ok, false, res.detail);
    assert.match(res.detail, /nova-feature/);
  });

  it("bugs/roadmap com 4 artefatos tambem nao viram ciclo", () => {
    for (const bucket of ["bugs", "roadmap"]) {
      const root = tmp({});
      writeCycle(root, `.spec/${bucket}/y-completo`);
      const live = join(root, ".spec/governance/nova-feature");
      mkdirSync(live, { recursive: true });
      writeFileSync(join(live, "SPEC.md"), "wip\n");
      writeState(root, {
        current_feature: "nova-feature",
        artifacts: { tasks: `.spec/${bucket}/y-completo/TASKS.md` },
      });
      assert.equal(evaluateSdd02(root).ok, false, `${bucket} nao pode ser ciclo`);
    }
  });

  it("ciclo real em grupo valido continua resolvendo normalmente", () => {
    const root = tmp({});
    writeCycle(root, ".spec/backend/nova-feature");
    writeState(root, { current_feature: "nova-feature" });
    const res = evaluateSdd02(root);
    assert.equal(res.ok, true, res.detail);
    assert.match(res.detail, /\.spec\/backend\/nova-feature/);
  });
});

// --- PAP-01 / ADR-P01 / INV-4: bucket `prd` é non-cycle ---------------------
// `.spec/prd/{id}/` carrega `PRD.md` e NÃO tem `PROPOSAL.md` (exigido por
// SDD_ARTIFACTS). Sem o guard, um `current_feature` igual ao `prd-id` faz o
// resolver tratar o dir como grupo de ciclo: o gate de drift acusa vermelho
// (MF-1) ou, pior, cai no próximo candidato COMPLETO e valida o `TASKS.md` de
// OUTRO ciclo — verde-falso. Precedente: FU-40 deu o mesmo tratamento a
// `tech-debts`/`bugs`/`roadmap`.
describe("SDD-02 guard: .spec/prd/** é non-cycle (PAP-01 / ADR-P01 / INV-4)", () => {
  it("cenário 1: .spec/prd/<feat> incompleto (só PRD.md) não vira ciclo — SDD-02 resolve o ciclo real e PASSa", () => {
    const root = tmp({});
    writeCycle(root, ".spec/backend/nova-feature");                 // ciclo real, completo
    mkdirSync(join(root, ".spec/prd/nova-feature"), { recursive: true });
    writeFileSync(join(root, ".spec/prd/nova-feature/PRD.md"), "# PRD\n"); // sem PROPOSAL/SPEC/PLAN/TASKS
    writeState(root, { current_feature: "nova-feature" });          // prd-id == current_feature
    // D5: controle positivo — se a string do path rotar, o cenário passaria por
    // ausência de alvo; o existsSync prova que o alvo existe no disco.
    assert.ok(existsSync(join(root, ".spec/prd/nova-feature/PRD.md")), "controle positivo: PRD.md em disco");
    assert.deepEqual(missingArtifacts(join(root, ".spec/prd/nova-feature")), ["PROPOSAL.md", "SPEC.md", "PLAN.md", "TASKS.md"], "controle positivo: dir prd é incompleto (não é ciclo)");
    const cycle = resolveSddCycle(root);
    assert.equal(cycle.complete, true, "ciclo real deve resolver");
    assert.equal(cycle.rel, ".spec/backend/nova-feature");
    assert.ok(!String(cycle.rel).startsWith(".spec/prd"), "prd não pode ser o ciclo resolvido");
    const res = evaluateSdd02(root);
    assert.equal(res.ok, true, res.detail);
    assert.match(res.detail, /\.spec\/backend\/nova-feature/);
  });

  // Contra-prova VIVA (D2): o predicado é INJETÁVEL, não só o set global. Com o
  // guard default, `.spec/prd/**` sai da detecção de ciclo; injetando `nonCycle`
  // SEM `prd`, o MESMO dir volta a ser candidato. Se a injeção fosse ignorada
  // (uso do set global), o 2º assert FALHARIA — é a asserção que discrimina.
  it("cenário 2: `nonCycle` injetado é respeitado — sem `prd` o dir vira ciclo (falha se ignorado)", () => {
    const root = tmp({});
    writeCycle(root, ".spec/backend/nova-feature");
    mkdirSync(join(root, ".spec/prd/nova-feature"), { recursive: true });
    writeFileSync(join(root, ".spec/prd/nova-feature/PRD.md"), "# PRD\n");
    writeState(root, { current_feature: "nova-feature" });
    assert.ok(existsSync(join(root, ".spec/prd/nova-feature/PRD.md")), "controle positivo: fixture em disco");

    // guard default (com `prd`): bucket sai da detecção de ciclo.
    const guarded = resolveSddCycle(root);
    assert.deepEqual(guarded.candidates.filter((c) => c.rel.startsWith(".spec/prd")), []);
    assert.equal(guarded.rel, ".spec/backend/nova-feature");
    assert.equal(isNonCycleRel(".spec/prd/nova-feature"), true);

    // guard injetado SEM `prd`: o dir volta a ser acusado como candidato de ciclo.
    const noPrd = new Set(["archive", "tech-debts", "roadmap", "bugs"]);
    const noGuard = resolveSddCycle(root, { nonCycle: noPrd });
    const prdCandidates = noGuard.candidates.filter((c) => c.rel.startsWith(".spec/prd"));
    assert.ok(prdCandidates.length > 0, "sem `prd` em nonCycle, .spec/prd/** é candidato de ciclo");
    assert.equal(prdCandidates[0].rel, ".spec/prd/nova-feature");
    assert.equal(isNonCycleRel(".spec/prd/nova-feature", noPrd), false, "predicado injetável respeita o set recebido");
  });

  it("cenário 3: .spec/prd/outro-id incompleto com current_feature não correspondente — nenhum drift", () => {
    const root = tmp({});
    writeCycle(root, ".spec/backend/ciclo-real");
    mkdirSync(join(root, ".spec/prd/outro-id"), { recursive: true });
    writeFileSync(join(root, ".spec/prd/outro-id/PRD.md"), "# PRD\n");
    writeState(root, { current_feature: "ciclo-real" });
    // D5: controle positivo — o alvo existe; senão o cenário passaria por ausência.
    assert.ok(existsSync(join(root, ".spec/prd/outro-id/PRD.md")), "controle positivo: PRD.md de outro-id em disco");
    assert.ok(existsSync(join(root, ".spec/backend/ciclo-real/TASKS.md")), "controle positivo: ciclo real em disco");
    const cycle = resolveSddCycle(root);
    assert.equal(cycle.complete, true);
    assert.equal(cycle.rel, ".spec/backend/ciclo-real");
    // D4: `assert.ok(!cycle.drift)` é sensível ao guard — `notEqual(drift, true)`
    // passava trivialmente com `drift === undefined`.
    assert.ok(!cycle.drift, "nenhum drift reportado");
    assert.deepEqual(cycle.candidates.filter((c) => c.rel.startsWith(".spec/prd")), [], "nenhum candidato em .spec/prd/**");
    assert.equal(evaluateSdd02(root).ok, true);
  });

  // D3: o pior caso — verde-falso. `.spec/prd/<feat>/` COMPLETO (4 artefatos) e
  // SEM ciclo real. Com o guard, `prd` não é ciclo ⇒ fail-closed (`ok === false`).
  // Sem o guard, o resolver escolheria `.spec/prd/...` e validaria o TASKS.md
  // errado (verde-falso) — demonstrado pela injeção de `nonCycle` sem `prd`.
  it("cenário D3: .spec/prd/<feat> COMPLETO sem ciclo real ⇒ fail-closed (não verde-falso)", () => {
    const root = tmp({});
    writeCycle(root, ".spec/prd/nova-feature");                      // 4 artefatos no bucket parcial
    writeState(root, { current_feature: "nova-feature" });           // prd-id == current_feature
    // D5: controle positivo — a fixture É completa (senão fail-closed passaria por ausência).
    assert.ok(existsSync(join(root, ".spec/prd/nova-feature/PROPOSAL.md")), "controle positivo: prd COMPLETO em disco");
    assert.deepEqual(missingArtifacts(join(root, ".spec/prd/nova-feature")), [], "controle positivo: 4/4 artefatos presentes");

    // guard presente: bucket parcial não vira ciclo ⇒ nenhum ciclo completo.
    const res = evaluateSdd02(root);
    assert.equal(res.ok, false, res.detail);
    assert.match(res.detail, /no complete SDD cycle/i);

    // sem o guard (nonCycle injetado sem `prd`): o dir prd vence ⇒ verde-falso.
    const noPrd = new Set(["archive", "tech-debts", "roadmap", "bugs"]);
    const noGuard = evaluateSdd02(root, { nonCycle: noPrd });
    assert.equal(noGuard.ok, true, "sem guard o dir prd vence — verde-falso demonstrado");
    assert.match(noGuard.detail, /cycle=\.spec\/prd\/nova-feature/, "sem guard o alvo é .spec/prd/**, não o ciclo SDD");
  });
});
