# Change Proposal: harness-design-system-agent

> **ID**: `harness-design-system-agent`
> **Status**: `Approved`
> **Author**: orchestrator
> **Date**: 2026-10-28
> **Source**: demanda do usuário (agente + skills de Design System para templates UI/componentes)

---

## 1. Problem Statement

Frontend delivery across supported stacks (Vue/React + shadcn) lacks a shared, minimal set of component templates; agents improvise markup/tokens, causing drift, rework, and review churn. Need reusable templates + guidance without turning harness into a component library. `ux-designer` é fonte visual; `frontend-*-specialist` são implementação; falta camada de **componentes/templates reutilizáveis**.

- **Contexto**: `.agents/agents/`, `.agents/skills/`, `opencode.json`, `workflow-rules.md`, `installer/install.mjs`.
- **Impacto atual**: drift de tokens/markup, review churn, retrabalho.
- **Evidência**: análise architect + product-manager.

## 2. Proposed Solution

**Resumo**: criar agente `design-system-specialist` (subagent, edit deny) + 3 skills locais (`template-structure`, `template-best-practices`, `template-deepsearch`), integrar ao workflow (invocação obrigatória em demandas de componente reutilizável, após parecer ux-designer e antes dos frontend specialists), registrar em opencode.json, incluir skills em SKILLS_COMMON (local, não vendorizado).

**Abordagem**:
- Agente: `.agents/agents/design-system-specialist/AGENT.md` (parecer/spec, não código).
- Skills: `.agents/skills/template-structure/SKILL.md`, `template-best-practices/SKILL.md`, `template-deepsearch/SKILL.md`.
- Integração: opencode.json (registro), orchestrator AGENT.md (mapeamento + regra), developer-engineer AGENT.md, ux-designer AGENT.md (downstream), workflow-rules.md (seção 7).
- Installer: +3 nomes em SKILLS_COMMON (local, common).
- Gating: COMMON (precedente de frontend-design/ui-ux-pro-max). Exclusões framework-specific apenas se skill for framework-bound (não é o caso — contrato agnóstico com seções por framework).

**Alternativas descartadas**:
- Vendorizar (lock) — skills autorais do harness, não de terceiro.
- Gating fino por frontend (exclusões proliferadas, não expresso bem pelo modelo de eixos).
- Agente com edit allow (duplicaria implementação; coerência com ux-designer exige deny).

## 3. Scope

### In Scope
- [x] Agente `design-system-specialist` (subagent, edit deny, bash allow).
- [x] 3 skills locais: template-structure, template-best-practices, template-deepsearch.
- [x] Integração: opencode.json, orchestrator AGENT.md, developer-engineer AGENT.md, ux-designer AGENT.md, workflow-rules.md.
- [x] Installer: +3 em SKILLS_COMMON.
- [x] Testes: enumeração bidirecional (eixos-stack.spec.mjs), suite + static-checks.

### Out of Scope
- Templates de componentes prontos (6-8 componentes) — pode ser follow-up (skill-first do PM).
- Vendorização de skills externas.
- Gating positivo por eixo (tech debt).
- Modificação de frontend coding standards.
- Backend/mobile templates.

## 4. Architecture Impact

| Aspecto | Impacto | ADR Necessário? |
|---------|---------|-----------------|
| Backend (installer) | SKILLS_COMMON (+3) | Não (aditivo) |
| Frontend (governança) | Novo agente + 3 skills + integração workflow | Não |
| Banco | N/A | Não |
| Multi-tenancy | N/A | Não |
| Segurança | N/A | Não |
| Eventos | N/A | Não |

## 5. Delta Preview

| Documento Alvo | Tipo | Seção |
|----------------|------|-------|
| `.agents/agents/design-system-specialist/AGENT.md` | ADDED | novo |
| `.agents/skills/template-structure/SKILL.md` | ADDED | novo |
| `.agents/skills/template-best-practices/SKILL.md` | ADDED | novo |
| `.agents/skills/template-deepsearch/SKILL.md` | ADDED | novo |
| `opencode.json` | MODIFIED | + design-system-specialist |
| `.agents/agents/orchestrator/AGENT.md` | MODIFIED | mapeamento skills + regra |
| `.agents/agents/developer-engineer/AGENT.md` | MODIFIED | skills obrigatórias |
| `.agents/agents/ux-designer/AGENT.md` | MODIFIED | downstream design-system |
| `.agents/rules/workflow-rules.md` | MODIFIED | seção 7 |
| `installer/install.mjs` | MODIFIED | SKILLS_COMMON (+3) |

## 6. Risk Assessment

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Duplicação com ux-designer | Média | Médio | Escopo explícito: ux-designer = visual/UX; design-system = componentes/templates. Handoff documentado. |
| Conflito com frontend specialists | Baixa | Médio | Frontend specialists são donos da implementação; design-system é dono do contrato. Interface congelada = template spec versionada. |
| Over-engineering (KISS) | Média | Médio | Apenas componentes recorrentes identificados pelo ux-designer. Evitar premature abstraction. |
| Deepsearch alucinação | Média | Baixo | Skill exige citação de fonte (URL) + data. |
| Installer enumeration tests | Alta | Médio | Adicionar +3 em SKILLS_COMMON (coberto pela suite). |
| Protected paths | — | — | Alterações seguem fluxo PR/humano com trailer. |

## 7. Success Criteria
- [ ] Agente `design-system-specialist` registrado em opencode.json (subagent, edit deny, bash allow).
- [ ] 3 skills criadas com frontmatter válido.
- [ ] Integração: orchestrator AGENT.md, developer-engineer AGENT.md, ux-designer AGENT.md, workflow-rules.md.
- [ ] Installer: +3 em SKILLS_COMMON; enumeração bidirecional verde.
- [ ] Suite installer verde + static-checks verde.
- [ ] Não quebrar nada não-frontend.

## 8. Completion Metadata
- **Archived on**: —
- **Duration**: —
- **Archive path**: —
- **Files changed**: —
