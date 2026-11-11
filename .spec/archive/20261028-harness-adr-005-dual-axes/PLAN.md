# Implementation Plan: harness-adr-005-dual-axes

## 1. Context & SPEC Traceability
- **Target**: `.spec/backend/harness-adr-005-dual-axes/SPEC.md`
- **Goal**: ADR-005 — pergunta dupla backend+frontend, dual-shape collectAnswers.

## 2. Technical Strategy
- Backend: Node ESM (installer). Funções puras + dual reader.
- Frontend: N/A.

## 3. Architecture Realization

| SPEC Ref | Constraint | Enforcement | Strategy |
|----------|-----------|-------------|----------|
| FR-01 | presetOfAxes puro | unit tests | reverse index por axes |
| FR-02 | dual-shape collectAnswers | qa/suite tests | legado/novo/misto/nenhum/paired |
| FR-03 | answersVersion opcional | unit tests | serialize se presente |
| FR-04 | validateAnswer backend/frontend | unit tests | cases + validateAxesCombination |
| FR-05 | generateConfig resolution | golden tests | answers.stack ?? presetOfAxes ?? 'node' |
| FR-06 | defaultSuiteFor dual input | unit tests | resolve preset first |
| FR-07 | Wizard serializa axes | wizard tests | menu atalho + axes derivados |
| FR-08 | Doctor deriva axes de stack | doctor tests | fallback |

## 4. Implementation Phases
- Phase 1: presetOfAxes + reverse index.
- Phase 2: collectAnswers dual-shape + validateAnswer + validateAxesCombination.
- Phase 3: generateConfig + defaultSuiteFor.
- Phase 4: QUESTIONS + answersVersion + runWizard axes derivados.
- Phase 5: Doctor axes derivation.
- Phase 6: Testes (compat, golden, eixos-stack).
- Phase 7: Validação.

## 5. Critical Execution Path
BE-01 (presetOfAxes) → BE-02 (collectAnswers) → BE-03 (validateAnswer) → BE-04 (generateConfig) → BE-05 (defaultSuiteFor) → BE-06 (QUESTIONS/wizard) → BE-07 (doctor) → BE-08 (testes) → BE-09 (validação)

## 6. Atomic Task Breakdown

- **[BE-01]** [ ] Implementar `presetOfAxes` + `presetsOfAxes` (reverse index).
- **[BE-02]** [ ] Implementar `collectAnswers` dual-shape (legado/novo/misto/nenhum/paired).
- **[BE-03]** [ ] Implementar `validateAnswer` cases backend/frontend + `validateAxesCombination`.
- **[BE-04]** [ ] Atualizar `generateConfig` (resolution stack).
- **[BE-05]** [ ] Atualizar `defaultSuiteFor` (dual input).
- **[BE-06]** [ ] Atualizar `QUESTIONS` (+backend/frontend opcionais) + `answersVersion` + runWizard axes derivados.
- **[BE-07]** [ ] Doctor deriva axes de stack (manifest legado).
- **[BE-08]** [ ] Testes: compat, golden, eixos-stack, wizard, doctor.
- **[BE-09]** [ ] Validação: suite + static-checks + temp install.
