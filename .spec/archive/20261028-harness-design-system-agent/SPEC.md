# Architecture & Software Specification — Design System Agent

## 1. ADRs

### ADR-001: Criar agente `design-system-specialist` + 3 skills de template
- **Decision**: agente subagent (edit deny, bash allow) + skills `template-structure`, `template-best-practices`, `template-deepsearch` (locais, COMMON).
- **Context**: falta camada de componentes/templates reutilizáveis; ux-designer é visual, frontend specialists são implementação.
- **Trade-offs**: mais um subagente e orquestração; mitigado com escopo claro e handoff.

### ADR-002: Gating: skills de template são locais e COMMON
- **Decision**: adicionar os 3 nomes em SKILLS_COMMON (local, não vendorizado).
- **Context**: segue precedente de frontend-design/ui-ux-pro-max; skills autorais do harness.
- **Trade-offs**: shipping inerte para destinos não-frontend; aceitável (KISS).

### ADR-003: Contrato de handoff ux-designer → design-system → frontend specialists
- **Decision**: ux-designer entrega tokens/fluxos; design-system entrega template spec (props/events/states/tokens) versionada; frontend specialists implementam.
- **Context**: evita duplicação de decisões visuais e implementação framework.
- **Trade-offs**: interface congelada exige versionamento ao mudar contrato.

## 2. Functional Requirements

### FR-01: Agente
`.agents/agents/design-system-specialist/AGENT.md` MUST existir com frontmatter/descrição: subagent, edit deny, bash allow, prompt file. Responsabilidades: anatomia de componente, API pública, mapeamento de tokens Pulse, template spec framework-agnostic + notas de adapter Vue/React, identificação de componentes recorrentes.

### FR-02: Skills
3 skills locais MUST existir com frontmatter válido:
- `template-structure`: estrutura de templates (anatomia, props/slots, estados, variantes, composição, i18n/a11y).
- `template-best-practices`: boas práticas (a11y WCAG 2.1 AA, perf, testabilidade, versionamento, deprecação).
- `template-deepsearch`: busca via deepsearch pelo estado da arte em templates/arquiteturas de componentes; exige citação de fonte (URL) + data.

### FR-03: opencode.json
MUST registrar `design-system-specialist` (subagent, description, permission edit deny/bash allow, prompt file).

### FR-04: Integração workflow
- orchestrator AGENT.md: mapeamento de skills (linha Design System / Templates) + regra de invocação (após parecer ux-designer, antes dos frontend specialists) + checklist.
- developer-engineer AGENT.md: skills obrigatórias quando task envolver componentes reutilizáveis.
- ux-designer AGENT.md: design-system-specialist como downstream.
- workflow-rules.md: seção 7 (skills por contexto) + linha Design System.

### FR-05: Installer
SKILLS_COMMON MUST incluir `template-structure`, `template-best-practices`, `template-deepsearch`.

### FR-06: Enumeração bidirecional
`eixos-stack.spec.mjs` MUST passar (novos skills classificados em COMMON).

### FR-07: Não-frontend
Nada não-frontend (backend, installer core, gates, rules não-frontend) MUST ser alterado.

## 3. Invariants
- I1: agentes/skills existentes (ux-designer, frontend-*-specialist) continuam funcionando.
- I2: installer rede-zero (V15) preservado.
- I3: gating por eixo declarado mantido.
- I4: suite + static-checks verdes.

## 4. Delta Specs

| Documento Alvo | Tipo | Seção |
|----------------|------|-------|
| `.agents/agents/design-system-specialist/AGENT.md` | ADDED | novo |
| `.agents/skills/template-structure/SKILL.md` | ADDED | novo |
| `.agents/skills/template-best-practices/SKILL.md` | ADDED | novo |
| `.agents/skills/template-deepsearch/SKILL.md` | ADDED | novo |
| `opencode.json` | MODIFIED | + design-system-specialist |
| `.agents/agents/orchestrator/AGENT.md` | MODIFIED | mapeamento + regra |
| `.agents/agents/developer-engineer/AGENT.md` | MODIFIED | skills obrigatórias |
| `.agents/agents/ux-designer/AGENT.md` | MODIFIED | downstream |
| `.agents/rules/workflow-rules.md` | MODIFIED | seção 7 |
| `installer/install.mjs` | MODIFIED | SKILLS_COMMON (+3) |
