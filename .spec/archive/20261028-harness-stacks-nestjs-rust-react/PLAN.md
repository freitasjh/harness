# Implementation Plan: harness-stacks-nestjs-rust-react

## 1. Context & SPEC Traceability
- **Target Specification**: `.spec/backend/harness-stacks-nestjs-rust-react/SPEC.md`
- **Goal**: Adicionar eixos rust/nestjs + presets aditivos + gating React standards + skills de arquitetura.

### 1.1 SPEC Validation Report
- **Status**: Validated.
- **Gaps**: nenhum bloqueante. ADR-005 e combos `*+vue` adiados (out of scope).

## 2. Technical Strategy
### 2.1 Backend Strategy
- Framework: Node ESM (installer). Mudanças em `installer/install.mjs` (registry + gating).
### 2.2 Frontend Strategy
- N/A (harness não tem frontend). Novo rule React + skill React specialist (common-excluded por vue).
### 2.3 Infrastructure Strategy
- N/A.

## 3. Architecture Realization & Constraint Mapping

| SPEC Ref | Constraint | Enforcement | Failure Mode | Strategy |
|----------|-----------|-------------|--------------|----------|
| FR-01 | Eixos válidos | AXIS_IDS + validador carga | InstallError BAD_DECLARATION | Adicionar rust/nestjs |
| FR-02 | Presets aditivos | STACK_PROFILES | golden baseline | Labels literais congelados |
| FR-03 | stacksFor | stacks derivados | EXPECTED_STACKS oracle | push rust/nestjs |
| FR-05 | RULES_BY_AXIS | enumeração bidirecional | eixos-stack.spec | espelho vue→react-standards |
| FR-06 | SKILLS_BY_AXIS | enumeração bidirecional | eixos-stack.spec | espelho vue→react-specialist |
| FR-07 | Artefatos novos | fs + skill dir | vendor.spec | criar files |
| FR-08 | SKILLS_COMMON | enumeração | eixos-stack.spec | classificar novos |
| I1-I5 | Invariantes | testes | CI | lockstep |

## 4. Module & Code Structure
- `installer/install.mjs`: registry + gating + stacksFor.
- `.agents/rules/frontend-react-coding-standards.md`: novo.
- `.agents/skills/{frontend-react,nestjs,node,rust}-*`: novos.
- Tests: `eixos-stack.spec.mjs`, `golden.spec.mjs`, docs tests.

## 5. Risks & Complexity Analysis
- Oracle de teste desatualizado → atualizar em lockstep.
- Golden baseline faltante → baseline explícito por preset.
- Regressão presets existentes → mudanças puramente aditivas.

## 6. Implementation Phases & Dependencies
- Phase 1: eixos + presets + stacksFor + STACK_VALUES (installer core).
- Phase 2: gating (RULES_BY_AXIS, SKILLS_BY_AXIS, SKILLS_COMMON) + novos artefatos.
- Phase 3: docs/agents/workflow-rules.
- Phase 4: testes (oracle, golden, docs).
- Phase 5: validação (static-checks, suite, temp dir install).

## 7. Critical Execution Path
BE-01 (eixos) → BE-02 (presets) → BE-03 (stacksFor) → BE-04 (gating) → BE-05 (artefatos) → BE-06 (tests) → BE-07 (validação)

## 8. Atomic Task Breakdown

### Backend Tasks (installer)
- **[BE-01]** [ ] Adicionar `rust`, `nestjs` em `AXIS_IDS.backend`.
  - Depends on: None
  - Layer: installer
  - Artifact: installer/install.mjs
  - Constraint Ref: FR-01

- **[BE-02]** [ ] Adicionar presets aditivos em `STACK_PROFILES` (rust, nestjs, node+react, nestjs+react, rust+react) com labels literais.
  - Depends on: BE-01
  - Layer: installer
  - Artifact: installer/install.mjs
  - Constraint Ref: FR-02, I3

- **[BE-03]** [ ] Atualizar `stacksFor` (push rust/nestjs).
  - Depends on: BE-01
  - Layer: installer
  - Artifact: installer/install.mjs
  - Constraint Ref: FR-03

- **[BE-04]** [ ] Atualizar `STACK_VALUES` (AT-3).
  - Depends on: BE-02
  - Layer: installer
  - Artifact: installer/install.mjs
  - Constraint Ref: FR-04, I1

- **[BE-05]** [ ] Atualizar `RULES_BY_AXIS` (+frontend=vue → frontend-react-coding-standards.md).
  - Depends on: None
  - Layer: installer
  - Artifact: installer/install.mjs
  - Constraint Ref: FR-05

- **[BE-06]** [ ] Atualizar `SKILLS_BY_AXIS` (+frontend=vue → frontend-react-specialist).
  - Depends on: None
  - Layer: installer
  - Artifact: installer/install.mjs
  - Constraint Ref: FR-06

- **[BE-07]** [ ] Criar `.agents/rules/frontend-react-coding-standards.md`.
  - Depends on: None
  - Layer: rules
  - Artifact: .agents/rules/frontend-react-coding-standards.md
  - Constraint Ref: FR-07

- **[BE-08]** [ ] Criar skill `frontend-react-specialist/SKILL.md`.
  - Depends on: None
  - Layer: skills
  - Artifact: .agents/skills/frontend-react-specialist/SKILL.md
  - Constraint Ref: FR-07

- **[BE-09]** [ ] Criar skill `nestjs-architecture-specialist/SKILL.md`.
  - Depends on: None
  - Layer: skills
  - Artifact: .agents/skills/nestjs-architecture-specialist/SKILL.md
  - Constraint Ref: FR-07

- **[BE-10]** [ ] Criar skill `node-architecture-specialist/SKILL.md`.
  - Depends on: None
  - Layer: skills
  - Artifact: .agents/skills/node-architecture-specialist/SKILL.md
  - Constraint Ref: FR-07

- **[BE-11]** [ ] Criar skill `rust-architecture-specialist/SKILL.md`.
  - Depends on: None
  - Layer: skills
  - Artifact: .agents/skills/rust-architecture-specialist/SKILL.md
  - Constraint Ref: FR-07

- **[BE-12]** [ ] Adicionar novos skills em `SKILLS_COMMON`.
  - Depends on: BE-08..BE-11
  - Layer: installer
  - Artifact: installer/install.mjs
  - Constraint Ref: FR-08

- **[BE-13]** [ ] Atualizar docs/agents/workflow-rules (mencionar novos skills).
  - Depends on: BE-07..BE-11
  - Layer: docs
  - Artifact: README.md, .agents/agents/orchestrator/AGENT.md, .agents/rules/workflow-rules.md
  - Constraint Ref: FR-09

- **[BE-14]** [ ] Atualizar `eixos-stack.spec.mjs` (EXPECTED_STACKS, axisIds).
  - Depends on: BE-01..BE-04
  - Layer: tests
  - Artifact: installer/__tests__/eixos-stack.spec.mjs
  - Constraint Ref: FR-10, I2

- **[BE-15]** [ ] Atualizar `golden.spec.mjs` (baselines novos).
  - Depends on: BE-02
  - Layer: tests
  - Artifact: installer/__tests__/golden.spec.mjs
  - Constraint Ref: FR-10, I3

- **[BE-16]** [ ] Rodar suite + static-checks + temp dir install.
  - Depends on: BE-01..BE-15
  - Layer: validation
  - Artifact: CI
  - Constraint Ref: FR-10, success criteria
