# Change Proposal: harness-stacks-nestjs-rust-react

> **ID**: `harness-stacks-nestjs-rust-react`
> **Status**: `Approved`
> **Author**: orchestrator
> **Date**: 2026-10-28
> **Source**: demanda do usuário (cadastro para sistemas NestJS/Node/React) + análise architect/product-manager

---

## 1. Problem Statement

O installer do harness suporta apenas 7 presets de stack (node, node-esm, java+vue, java+react, outra, flutter, dart) e 6 eixos de backend (java, node, dart, flutter, other, none). Sistemas com NestJS, Rust ou React (frontend) não têm perfil dedicado, forçando uso de `node`/`java+react` genéricos e causando vazamento de padrões (ex.: prosa NestJS vaza para Express/Fastify; regras Vue vaza para React).

- **Contexto**: `installer/install.mjs` (registry `STACK_PROFILES`, `AXIS_IDS`, `RULES_BY_AXIS`, `SKILLS_BY_AXIS`), `.agents/rules/`, `.agents/skills/`, `.agents/agents/`, `opencode.json`.
- **Impacto atual**: destinos NestJS/Rust/React recebem artefatos genéricos ou incompatíveis; gating por eixo não cobre essas stacks.
- **Evidência**: análise arquitetural (architect) + validação de produto (product-manager).

## 2. Proposed Solution

**Resumo**: adicionar eixos `rust` e `nestjs` ao backend, presets aditivos (API-only para nestjs, backend-only para rust, mais combos node/nestjs/rust × react), gating de standards React (rule + skill local) e skills de arquitetura NestJS/Rust/Node, sem renomear artefatos existentes e sem implementar ADR-005 (pergunta dupla) nesta rodada.

**Abordagem**:
- `AXIS_IDS.backend`: +`rust`, +`nestjs`.
- `STACK_PROFILES`: +`rust`, +`nestjs`, +`node+react`, +`nestjs+react`, +`rust+react` (aditivos, labels literais congelados).
- `stacksFor`: push `rust`/`nestjs` para seus eixos.
- `RULES_BY_AXIS`: +`'frontend=vue': ['frontend-react-coding-standards.md']` (espelho de react→vue).
- `SKILLS_BY_AXIS`: +`'frontend=vue': ['frontend-react-specialist']`.
- Criar: `frontend-react-coding-standards.md`, skills `frontend-react-specialist`, `nestjs-architecture-specialist`, `node-architecture-specialist`, `rust-architecture-specialist` (common).
- Atualizar `STACK_VALUES`, docs, agents, workflow-rules.
- Atualizar testes (oracle EXPECTED_STACKS, golden baselines, eixos enumeração).

**Alternativas descartadas**:
- NestJS como subset de `node` (vazamento de padrões; gating incorreto).
- ADR-005 agora (alto blast radius; adiado para feature separada).
- Renomear `frontend-coding-standards.md` (quebra 12 refs penduradas).

## 3. Scope

### In Scope
- [x] Eixos `rust`, `nestjs` no backend.
- [x] Presets aditivos: rust, nestjs, node+react, nestjs+react, rust+react.
- [x] Gating React standards (rule + skill) por `frontend=vue`.
- [x] Skills de arquitetura NestJS/Node/Rust (common).
- [x] Atualização de `STACK_VALUES`, docs, agents, workflow-rules.
- [x] Atualização de testes (oracle, golden, enumeração).

### Out of Scope
- ADR-005 (pergunta dupla backend+frontend) — feature separada.
- Vendor skills NestJS/Rust upstream — feature separada (C).
- Upgrade/migração de repos já instalados.
- Novas features de negócio no harness (gates, SDD, brain).
- Gating positivo de backend specialist por eixo (tech debt, ADR separado).
- Combos `*+vue` para node/nestjs/rust (adiado).

## 4. Architecture Impact

| Aspecto | Impacto | ADR Necessário? |
|---------|---------|-----------------|
| Backend (installer) | STACK_PROFILES, AXIS_IDS, stacksFor, RULES_BY_AXIS, SKILLS_BY_AXIS, SKILLS_COMMON | Não (aditivo) |
| Frontend (rules/skills) | Novo rule React + skill React specialist | Não |
| Banco de dados | N/A | Não |
| Multi-tenancy | N/A | Não |
| Segurança / RBAC | N/A | Não |
| Eventos | N/A | Não |

## 5. Delta Preview

| Documento Alvo | Tipo de Mudança | Seção Afetada |
|----------------|-----------------|---------------|
| `installer/install.mjs` | MODIFIED | AXIS_IDS, STACK_VALUES, STACK_PROFILES, RULES_BY_AXIS, SKILLS_BY_AXIS, SKILLS_COMMON, stacksFor |
| `.agents/rules/frontend-coding-standards.md` | (inalterado) | — |
| `.agents/rules/frontend-react-coding-standards.md` | ADDED | novo |
| `.agents/skills/frontend-react-specialist/` | ADDED | novo |
| `.agents/skills/nestjs-architecture-specialist/` | ADDED | novo |
| `.agents/skills/node-architecture-specialist/` | ADDED | novo |
| `.agents/skills/rust-architecture-specialist/` | ADDED | novo |
| `.agents/agents/orchestrator/AGENT.md` | MODIFIED | mapeamento de skills |
| `.agents/rules/workflow-rules.md` | MODIFIED | seção 7 skills |
| `README.md` | MODIFIED | stacks suportadas |
| `installer/__tests__/eixos-stack.spec.mjs` | MODIFIED | EXPECTED_STACKS, axisIds |
| `installer/__tests__/golden.spec.mjs` | MODIFIED | baselines novos |

## 6. Risk Assessment

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Oracle de teste desatualizado | Alta | Médio | Atualizar EXPECTED_STACKS em lockstep |
| Golden baseline faltante | Média | Alto | Baseline explícito por preset (padrão C-2) |
| Regressão presets existentes | Baixa | Alto | Mudanças puramente aditivas; labels literais |
| PENDING_REFS_REACT count | Média | Médio | Manter nome frontend-coding-standards.md |
| Gating backend specialist leak | Baixa | Baixo | Tech debt (common por consistência) |

## 7. Success Criteria
- [ ] Eixos `rust`, `nestjs` adicionados; `AXIS_IDS` válidos.
- [ ] Presets aditivos presentes; `STACK_VALUES == keys(STACK_PROFILES)`.
- [ ] `profile.stacks === stacksFor(profile.axes)` com oracle independente.
- [ ] Gating React standards (rule + skill) por `frontend=vue` funcional.
- [ ] Skills de arquitetura NestJS/Node/Rust criadas e em `SKILLS_COMMON`.
- [ ] `node --test "installer/__tests__/*.spec.mjs"` verde.
- [ ] `node scripts/static-checks.mjs` verde.
- [ ] Instalação em dir temp com `--answers-file` + `--yes` retorna `checks.passed === true`.
- [ ] Presets existentes byte-idênticos (golden).

## 8. Completion Metadata
- **Archived on**: —
- **Duration**: —
- **Archive path**: —
- **Files changed**: —
