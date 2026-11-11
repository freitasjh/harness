# VERIFY — harness-inventory-adr-005

> Verificação de 3 dimensões sobre o ciclo que executa o **ADR-005 do PRD-1** (prosa órfã), incluindo o escopo herdado do ADR-003 §10.
> Data: 2026-11-11. Branch: `adr/prd-harness-inventory/05-prosa-orfa`. HEAD: `c209487`.

## Veredito: **3/3 PASS**

| Dimensão | Resultado | Base |
|---|---|---|
| Completude | ✅ PASS | 11/11 microtasks; 5 artefatos; limites declarados em N8/N9/N15/N19 |
| Corretude | ✅ PASS | 971 testes (412 plugins + 559 installer) 0 falhas; 14/14 itens; REPORT schema-válido |
| Coerência | ✅ PASS | `gate.js`/`harness.config.json`/`installer/`/`config.mjs`/`seal.mjs`/`prd-adr-pipeline/` com 0 linhas; selo `c904f1c5` idêntico a `f9c5ca2` |

## 1. Completude

- `TASKS.md`: 11/11 marcadas.
- Artefatos: PROPOSAL (44), SPEC (43), PLAN (47), TASKS (54+), VERIFY.
- **Declarado como limite, não como entrega**: gramática de slug (N8), `AGENTS.md` como citante (N9), autoria de `SPEC/PLAN/TASKS` (N15), `vendorOnly` visível mas não bloqueante (N13), critério escopado a `edit`/`write` (N19).

## 2. Corretude

| Bloco | Evidência |
|---|---|
| Rubric em mecanismo | `PASS V18 … missing-and-unclassified=ok, stale-baseline-entry=ok[vendor-only=0], baseline-entry-incomplete=ok, nondefect-entry-incomplete=ok, stale-nondefect-entry=ok (baseline=7, non-defect=1)` |
| V18 morde (3 vetores) | órfã viva nova ⇒ `FAIL missing-and-unclassified` · baseline obsoleta ⇒ `FAIL stale-baseline-entry` · `NON_DEFECT` com proof datado ⇒ `FAIL stale-nondefect-entry` (os 3 em cópia fora do repo) |
| `BASELINE` = dívida com dono | 7 entradas com `path/class/reason/owner/prd`; 2 `live-orphan` (`security-standard.md`, `unit-testing-standards.md`) + 5 `foreign-baseline` |
| Escopo por citante | `LIVE_CITER_RE` = `^(\.agents/|opencode\.json$)`; fixture com o mesmo texto em `docs/` → verde, em `.agents/` → vermelho |
| Autor único (5 decisões) | `PLAN.md` → `sdd-compiler` (inclusive `workflow-rules.md:91` e `developer-engineer/AGENT.md:103`) · template de ADR → `architect` · `EXPLORATION.md` → `planner` · delegação 10/10 · gatilho da Fase 0 = lista de isenção |
| Paridade de papéis | `comm -3` vazio nos 2 ramos (roster × Protocolo de Delegação; roster × §0.1 por coluna) |

**Suíte:** plugins 412/0 · installer 559/0 · static exit 0 · sdd 0 FAIL · vendor OK.

## 3. Coerência

- **Nenhum comando novo em `commands.suiteFull`** — `V18` roda dentro do `static-checks`; selo `c904f1c5` idêntico ao estado anterior.
- **O check não é órfão de contexto**: `refs.spec.mjs:286` roda `runStaticChecks()` no repo real e exige `V18`, então remover o adapter quebra a suíte (mais forte que o ADR prometia).
- **Dívida declarada, não silenciosa**: `vendor-only` aparece no PASS; `BASELINE` exige dono e condição de saída; entrada obsoleta falha.
- **Autoria não foi inventada**: onde o config nega a ação (`edit: deny`), a prosa passou a dizer o fato e a decisão foi deferida (N15) em vez de "resolvida" no texto.

## 4. Traceability

| RF | Task | Onde |
|---|---|---|
| RF-01..03 | PO-01..PO-03 | `.opencode/plugins/lib/refs/checks.mjs` |
| RF-04/05 | PO-04 | `.opencode/plugins/__tests__/refs.spec.mjs` |
| RF-06 | PO-05 | `scripts/static-checks.mjs` |
| RF-07 | PO-06..PO-09 | `dev-planner/workflow.md`, `dev-planner/SKILL.md`, `orchestrator/AGENT.md`, `workflow-rules.md`, `sdd-compiler/SKILL.md` |
| RF-08 | PO-10, PO-11 | suíte + diff dos protegidos |

**Cobertura: 8/8 RF · 14/14 itens · traceability 100%.**

## 5. Divergências declaradas pelo QA (informativas)

| # | Fato |
|---|---|
| d1 | 412/412 confere; a decomposição "23 + 3" não fecha os 33 de `refs.spec.mjs` (23 + 7 + 3) |
| d2 | item 0 do ADR publica 104 citações; HEAD mede 107 (+3 em `rules/prd-adr-pipeline.md`, path existente) |
| d3 | `PLAN.md:11` promete varrer `.doc/`, `AGENTS.md`, `frontend/DESIGN.md` (fora da gramática declarada); ADR prevalece |
| d4 | item 14 literal não reproduz em `c209487` (docs-only); reproduz em `32c469d` |
| d5 | `workflow-state.json` é corrigido no fechamento do ciclo (dono: orquestrador) |

## 6. Conclusão

As 3 dimensões fecham. O que o ADR prometeu — rubric em mecanismo com 5 modos de falha provados, e autor único onde havia colisão — está entregue e verificado por 3 rodadas de code review e um QA independente. O que **não** está entregue está nomeado com dono: gramática de slug, `AGENTS.md` como citante, autoria dos três artefatos do ciclo (PRD-2). **Apto ao P5→P6.**
