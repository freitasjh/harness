# Implementation Plan: harness-design-system-agent

## 1. Context & SPEC Traceability
- **Target**: `.spec/backend/harness-design-system-agent/SPEC.md`
- **Goal**: Agente + 3 skills de Design System (templates UI/componentes), integração workflow + installer.

## 2. Technical Strategy
- Backend: N/A (governança .agents/ + installer).
- Frontend: N/A (agente/skills, não código de app).

## 3. Implementation Phases
- Phase 1: Criar agente + 3 skills.
- Phase 2: Integração (opencode.json, orchestrator, developer-engineer, ux-designer, workflow-rules).
- Phase 3: Installer (SKILLS_COMMON +3).
- Phase 4: Testes + validação.

## 4. Critical Execution Path
BE-01 (agente) → BE-02..04 (skills) → BE-05 (opencode.json) → BE-06..09 (integração) → BE-10 (installer) → BE-11 (testes) → BE-12 (validação)

## 5. Atomic Task Breakdown

- **[BE-01]** [ ] Criar `.agents/agents/design-system-specialist/AGENT.md`.
- **[BE-02]** [ ] Criar `.agents/skills/template-structure/SKILL.md`.
- **[BE-03]** [ ] Criar `.agents/skills/template-best-practices/SKILL.md`.
- **[BE-04]** [ ] Criar `.agents/skills/template-deepsearch/SKILL.md`.
- **[BE-05]** [ ] Registrar agente em `opencode.json`.
- **[BE-06]** [ ] Atualizar orchestrator AGENT.md (mapeamento + regra + checklist).
- **[BE-07]** [ ] Atualizar developer-engineer AGENT.md (skills obrigatórias).
- **[BE-08]** [ ] Atualizar ux-designer AGENT.md (downstream).
- **[BE-09]** [ ] Atualizar workflow-rules.md (seção 7 + linha Design System).
- **[BE-10]** [ ] Atualizar installer/install.mjs (SKILLS_COMMON +3).
- **[BE-11]** [ ] Testes: enumeração bidirecional (eixos-stack.spec.mjs) + suite + static-checks.
- **[BE-12]** [ ] Validação final.
