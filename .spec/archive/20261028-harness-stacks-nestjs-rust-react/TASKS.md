# TASKS — harness-stacks-nestjs-rust-react

## Microtasks (TDD-ready)

### Batch 1 — Installer core (eixos + presets + stacksFor + STACK_VALUES)

### BE-01
- [x] **T1 (BE-01)** Adicionar `rust`, `nestjs` em `AXIS_IDS.backend` em `installer/install.mjs`.
  - Acceptance: `AXIS_IDS.backend` contém rust, nestjs; validador carga OK.
### BE-02
- [x] **T2 (BE-02)** Adicionar presets aditivos em `STACK_PROFILES` (rust, nestjs, node+react, nestjs+react, rust+react) com labels literais.
  - Acceptance: presets presentes; golden existentes byte-idênticos.
### BE-03
- [x] **T3 (BE-03)** Atualizar `stacksFor` (push rust/nestjs).
  - Acceptance: stacksFor({backend:rust,...}) === ['rust']; stacksFor({backend:nestjs,...}) === ['nestjs'].
### BE-04
- [x] **T4 (BE-04)** Atualizar `STACK_VALUES` para incluir novos presets.
  - Acceptance: `STACK_VALUES` keys == `STACK_PROFILES` keys.

### Batch 2 — Gating + artefatos

### BE-05
- [x] **T5 (BE-05)** Atualizar `RULES_BY_AXIS` (+frontend=vue → frontend-react-coding-standards.md).
### BE-06
- [x] **T6 (BE-06)** Atualizar `SKILLS_BY_AXIS` (+frontend=vue → frontend-react-specialist).
### BE-07
- [x] **T7 (BE-07)** Criar `.agents/rules/frontend-react-coding-standards.md` (espelho React/shadcn).
### BE-08
- [x] **T8 (BE-08)** Criar `.agents/skills/frontend-react-specialist/SKILL.md`.
### BE-09
- [x] **T9 (BE-09)** Criar `.agents/skills/nestjs-architecture-specialist/SKILL.md`.
### BE-10
- [x] **T10 (BE-10)** Criar `.agents/skills/node-architecture-specialist/SKILL.md`.
### BE-11
- [x] **T11 (BE-11)** Criar `.agents/skills/rust-architecture-specialist/SKILL.md`.
### BE-12
- [x] **T12 (BE-12)** Adicionar novos skills em `SKILLS_COMMON`.

### Batch 3 — Docs/agents

### BE-13
- [x] **T13 (BE-13)** Atualizar README.md, orchestrator AGENT.md, workflow-rules.md (seção 7).

### Batch 4 — Testes + validação

### BE-14
- [x] **T14 (BE-14)** Atualizar `eixos-stack.spec.mjs` (EXPECTED_STACKS, axisIds).
### BE-15
- [x] **T15 (BE-15)** Atualizar `golden.spec.mjs` (baselines novos).
### BE-16
- [x] **T16 (BE-16)** Rodar suite + static-checks + temp dir install; validar checks.passed.

## Definition of Done
- Suite installer verde.
- static-checks verde.
- Temp dir install com --answers-file + --yes retorna checks.passed === true.
- Presets existentes byte-idênticos (golden).
