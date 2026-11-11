# Architecture & Software Specification

## 1. Architecture Decision Records (ADRs)

### ADR-001: NestJS como eixo próprio (não subset de node)
- **Decision**: adicionar `nestjs` como eixo próprio em `AXIS_IDS.backend`.
- **Context**: gating por eixo (RF-03/RF-04). Se NestJS fosse subset de `node`, padrões NestJS vazaríam para Express/Fastify e a prosa NestJS entraria em todo destino node.
- **Trade-offs**: +1 eixo exige presets; mitigado limitando a preset API-only nesta rodada e adiando combos para ADR-005.

### ADR-002: Rust como eixo próprio (backend-only)
- **Decision**: adicionar `rust` como eixo próprio, preset `rust` (backend=rust, frontend=none), análogo a `dart`.
- **Context**: Rust já deferido em ADR-001 do ciclo eixos-stack. Backend-only evita N×M.
- **Trade-offs**: combos rust+react/rust+vue adiados.

### ADR-003: React standards gated por `frontend=vue` (espelho)
- **Decision**: manter `frontend-coding-standards.md` (Vue) como common-excluded para react; criar `frontend-react-coding-standards.md` excluded para vue. Não renomear o existente (12 refs penduradas).
- **Context**: `RULES_BY_AXIS` já tem `'frontend=react': ['frontend-coding-standards.md']`. Espelhar para vue→react-standards.

### ADR-004: Backend specialists em SKILLS_COMMON (por consistência)
- **Decision**: novos specialists (nestjs, node, rust) entram em `SKILLS_COMMON`, espelhando `java-architecture-specialist`. Gating backend-específico fica como tech debt (ADR separado).
- **Context**: `java-architecture-specialist` já é common; manter consistência. Gating positivo por backend axis é alto blast radius.

## 2. Domain Context

- **Bounded Context**: installer do harness — instala governança (rules/skills/agents) em repo destino conforme stack.
- **System Type**: CLI Node ESM.
- **Tenant Provisioning**: N/A (ferramenta local).

## 3. Functional Requirements

### FR-01: Eixos backend
`AXIS_IDS.backend` MUST incluir `rust` e `nestjs` (além dos existentes). Validador na carga (fail-closed) rejeita id inexistente.

### FR-02: Presets aditivos
`STACK_PROFILES` MUST incluir (labels literais congelados):
- `rust`: `{backend:rust, frontend:none}`
- `nestjs`: `{backend:nestjs, frontend:none}`
- `node+react`: `{backend:node, frontend:react}`
- `nestjs+react`: `{backend:nestjs, frontend:react}`
- `rust+react`: `{backend:rust, frontend:react}`

Presets existentes MUST permanecer byte-idênticos (golden I7).

### FR-03: stacksFor
`stacksFor` MUST push `rust` quando `backend==='rust'` e `nestjs` quando `backend==='nestjs'`. `node` permanece sem tag (sem vendor skills node-tagged).

### FR-04: STACK_VALUES
`STACK_VALUES` MUST incluir os novos presets (AT-3: `STACK_VALUES == keys(STACK_PROFILES)`).

### FR-05: RULES_BY_AXIS
MUST adicionar `'frontend=vue': ['frontend-react-coding-standards.md']`. Manter `'frontend=react': ['frontend-coding-standards.md']`.

### FR-06: SKILLS_BY_AXIS
MUST adicionar `'frontend=vue': ['frontend-react-specialist']`. Manter `'frontend=react': ['frontend-vue-specialist']`.

### FR-07: Artefatos novos
- `.agents/rules/frontend-react-coding-standards.md`
- `.agents/skills/frontend-react-specialist/SKILL.md`
- `.agents/skills/nestjs-architecture-specialist/SKILL.md`
- `.agents/skills/node-architecture-specialist/SKILL.md`
- `.agents/skills/rust-architecture-specialist/SKILL.md`

### FR-08: SKILLS_COMMON
Novos skills locais MUST ser classificados em `SKILLS_COMMON` (enumeração total).

### FR-09: Docs/agents
Atualizar `README.md`, `.agents/agents/orchestrator/AGENT.md`, `.agents/rules/workflow-rules.md` (seção 7) para mencionar novos skills.

### FR-10: Testes
Atualizar `eixos-stack.spec.mjs` (EXPECTED_STACKS, axisIds), `golden.spec.mjs` (baselines novos), docs tests. Suite verde.

## 4. Invariants

- I1: `Object.keys(STACK_VALUES)` == `Object.keys(STACK_PROFILES)` (AT-3).
- I2: `profile.stacks === stacksFor(profile.axes)` (oracle independente).
- I3: Presets existentes byte-idênticos (golden I7).
- I4: `RULES_BY_AXIS`/`SKILLS_BY_AXIS` enumeração bidirecional completa.
- I5: `AXIS_IDS` validação na carga (fail-closed).

## 5. Delta Specs

| Documento Alvo | Tipo | Seção |
|----------------|------|-------|
| `installer/install.mjs` | MODIFIED | AXIS_IDS, STACK_VALUES, STACK_PROFILES, stacksFor, RULES_BY_AXIS, SKILLS_BY_AXIS, SKILLS_COMMON |
| `.agents/rules/frontend-react-coding-standards.md` | ADDED | novo |
| `.agents/skills/frontend-react-specialist/` | ADDED | novo |
| `.agents/skills/nestjs-architecture-specialist/` | ADDED | novo |
| `.agents/skills/node-architecture-specialist/` | ADDED | novo |
| `.agents/skills/rust-architecture-specialist/` | ADDED | novo |
| `.agents/agents/orchestrator/AGENT.md` | MODIFIED | mapeamento skills |
| `.agents/rules/workflow-rules.md` | MODIFIED | seção 7 |
| `README.md` | MODIFIED | stacks suportadas |
| `installer/__tests__/eixos-stack.spec.mjs` | MODIFIED | EXPECTED_STACKS, axisIds |
| `installer/__tests__/golden.spec.mjs` | MODIFIED | baselines |

## 6. Out of Scope (Feature A / C)
- ADR-005 (pergunta dupla backend+frontend) — feature separada.
- Vendor skills NestJS/Rust upstream — feature separada.
- Upgrade path de repos instalados.
- Gating positivo backend specialist por eixo.
- Combos `*+vue` para node/nestjs/rust.
