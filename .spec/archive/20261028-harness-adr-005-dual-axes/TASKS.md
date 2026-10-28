# TASKS — harness-adr-005-dual-axes

## Microtasks (TDD-ready)

### BE-01
- [x] Implementar `presetOfAxes(backend, frontend)` + `presetsOfAxes` (reverse index por axes key). Unit tests: java+react→java+react, node+none→node, java+flutter→null.

### BE-02
- [x] Implementar `collectAnswers` dual-shape: legado (stack), novo (backend+frontend), misto (consistência), nenhum (BAD_ANSWER), paired (apenas um → BAD_ANSWER).

### BE-03
- [x] Implementar `validateAnswer` cases backend/frontend + helper `validateAxesCombination`.

### BE-04
- [x] Atualizar `generateConfig`: resolve stack = answers.stack ?? presetOfAxes(answers.backend, answers.frontend) ?? 'node'; throw BAD_ANSWER se backend/frontend presentes mas sem preset.

### BE-05
- [x] Atualizar `defaultSuiteFor`: aceitar stack string OU {backend, frontend}; resolve preset first.

### BE-06
- [x] Atualizar `QUESTIONS` (+backend/frontend opcionais) + `answersVersion` (opcional, serialize se presente) + runWizard serializa axes derivados.

### BE-07
- [x] Doctor: manifest legado (sem axes) deriva axes de stack.

### BE-08
- [x] Testes: compat (legado shape), golden (shape novo == preset), eixos-stack (presetOfAxes), wizard (QUESTIONS count), doctor.

### BE-09
- [x] Validação: suite completa + static-checks + temp install (shape legado e shape novo).

## Definition of Done
- Suite installer verde.
- static-checks verde.
- Temp install shape legado e shape novo → checks.passed === true.
- Baselines existentes byte-idênticos.
