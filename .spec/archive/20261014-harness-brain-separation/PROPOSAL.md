# Change Proposal: Harness-Brain Separation (governança)

> **ID**: `harness-brain-separation`
> **Status**: `Under Review`
> **Author**: architect
> **Date**: 2026-10-14
> **Source**: handoff `sessoes/brain/2026-10-14-handoff-harness-brain-separation` + triagem architect + product-manager APPROVED Refactor + continuação `harness-installer-mobile` (Completed, archive `.spec/archive/20261008-harness-installer-mobile/`)

---

## 1. Problem Statement

- **Contexto**: repo `harness` (só harness) carrega cópia vendored da regra do brain: `.agents/skills/brain/SKILL.md` + 4 tools (`tools/brain_search/`, `tools/brain_store/`, `tools/brain_read/`, `tools/brain_reindex/`) e full-dup de 259 linhas em `.agents/rules/brain-context.md:1-259`. Refs quebradas/stale para `.agents/rules/brain-context-protocol.md` espalhadas em 7 pontos + 2 extras. Fronteira de ownership harness×brain sem decreto explícito em README/RUNTIME-CONTRACT.
- **Impacto atual**: drift duplo — toda evolução da regra brain exige editar dois repos; cópia local vira verdade paralela. Instalador corre risco de gravar regra alheia no destino (viola `install.mjs` 0-writes do doctor). Âncora B de `harness-installer-mobile` (Completed) ameaça se SPEC futuro tocar código produto.
- **Evidência**: `.agents/skills/brain/tools/` contém 4 dirs (`brain_read/`, `brain_reindex/`, `brain_search/`, `brain_store/`); `wc -l .agents/rules/brain-context.md` = 259; grep `brain-context-protocol.md` = 7 matches (`.agents/rules/workflow-rules.md:245`, `.agents/rules/workflow-rules.md:588`, `.agents/agents/architect/AGENT.md:5`, `.agents/agents/qa-engineer/AGENT.md:5`, `.agents/agents/code-reviewer/PROMPT.md:5`, `.agents/agents/ux-designer/AGENT.md:10`, `.agents/agents/product-manager/AGENT.md:5`); `installer/install.mjs:743-772` (`runDoctor` D0-D6); `README.md:18` (skill `brain`); `.spec/archive/20260929-harness-v7-hardening/RUNTIME-CONTRACT.md:68` (MCP `brain` remote).

---

## 2. Proposed Solution

**Resumo**: decretar `harness=só harness, brain dono da regra brain`; trocar cópia por referência, afinar ponte local, corrigir refs stale, amarrar installer 0-writes + doctor warn-não-fail — só `.spec` docs, zero código produto.

**Abordagem**:
- H1 — remover `.agents/skills/brain/` vendored (SKILL.md + 4 tools) → ref externa `../brain/.agents/skills/brain/SKILL.md` (referência nunca cópia). SPEC detalha mecanismo da ref (link doc, sem código produto nesta fase).
- H2 — `.agents/rules/brain-context.md:1-259` (259 linhas) → ponte fina ~20 linhas apontando para `BRAIN.MCP.md` (dono brain). Conteúdo canônico vive no brain.
- H3 — corrigir refs stale `brain-context-protocol.md`: `.agents/rules/workflow-rules.md:245`, `.agents/rules/workflow-rules.md:588`, 5 agent files (`architect/AGENT.md:5`, `qa-engineer/AGENT.md:5`, `code-reviewer/PROMPT.md:5`, `ux-designer/AGENT.md:10`, `product-manager/AGENT.md:5`) + extras a confirmar no SPEC (`codebase-analyzer:45-68`, `.agents/rules/sdd-workflow-standard.md:45` — linha 45 "sistema de memória (Obsidian)" stale).
- H4 — `installer/install.mjs`: 0 writes confirmado no caminho doctor (`runDoctor` em `installer/install.mjs:743-772`, D0-D6 read-only); doctor vira warn-não-fail quando brain ausente (localizar dono exato do doctor no SPEC — candidato `runDoctor` + dispatch `installer/install.mjs:1797-1810`).
- H5 — `README.md:18` + RUNTIME-CONTRACT (cópia archive em `.spec/archive/20260929-harness-v7-hardening/RUNTIME-CONTRACT.md:68`; canônico a localizar no SPEC) declaram fronteira: nomes `brain_search`/`brain_store`/`brain_read` + campo `brainStore` evidência mantidos.
- **Alternativas descartadas e por quê**:
  - Manter cópia vendored + sync manual → descartado: drift garantido, duas verdades.
  - Mover regra brain para dentro do harness (harness dono) → descartado: viola decisão vinculante (brain dono da regra brain).
  - Incluir B1-B3 do brain neste ciclo → descartado: fora da fronteira, escopo creep; B1-B3 vivem no repo brain.

---

## 3. Scope

### In Scope
- [ ] H1 — remover `.agents/skills/brain/` vendored (`.agents/skills/brain/SKILL.md` + `tools/brain_search/`, `tools/brain_store/`, `tools/brain_read/`, `tools/brain_reindex/`) → ref externa `../brain/.agents/skills/brain/SKILL.md` (só SPEC nesta fase)
- [ ] H2 — `.agents/rules/brain-context.md:1-259` → ponte fina ~20 linhas → `BRAIN.MCP.md`
- [ ] H3 — corrigir refs `brain-context-protocol.md` em `.agents/rules/workflow-rules.md:245`, `.agents/rules/workflow-rules.md:588`, `.agents/agents/architect/AGENT.md:5`, `.agents/agents/qa-engineer/AGENT.md:5`, `.agents/agents/code-reviewer/PROMPT.md:5`, `.agents/agents/ux-designer/AGENT.md:10`, `.agents/agents/product-manager/AGENT.md:5` + confirmar/corrigir extras (`codebase-analyzer:45-68`, `.agents/rules/sdd-workflow-standard.md:45`)
- [ ] H4 — `installer/install.mjs` 0 writes (caminho doctor `installer/install.mjs:743-772`) + doctor warn-não-fail (localizar dono doctor no SPEC)
- [ ] H5 — `README.md:18` + RUNTIME-CONTRACT (`:68`) declaram fronteira harness×brain; manter nomes `brain_search`/`brain_store`/`brain_read` + campo `brainStore`

### Out of Scope
- B1-B3 do brain (vivem no repo brain, não neste ciclo) — por quê: fronteira decretada, evita scope creep
- Feature nova ou frontend — por quê: rota é Refactor governança, continuação `harness-installer-mobile`
- Edição de código produto (incl. `installer/install.mjs`, skills, rules) nesta fase — por quê: delegação autoriza só `.spec` docs; código vem em TASKS/Execution com portão próprio
- Renomear `brain_search`/`brain_store`/`brain_read` ou campo `brainStore` — por quê: proibido pelas decisões vinculantes (contrato de evidência)

---

## 4. Architecture Impact

| Aspecto | Impacto | ADR Necessário? |
|---------|---------|-----------------|
| Backend (módulos afetados) | Nenhum — zero código produto nesta fase; só `.spec/backend/harness-brain-separation/PROPOSAL.md` | Não |
| Frontend (componentes/stores) | Nenhum — frontend fora de escopo | Não |
| Banco de dados (migrations) | Nenhum | Não |
| Multi-tenancy | Nenhum | Não |
| Segurança / RBAC | Nenhum (`@HasPermission` n/a; sem impacto — explícito) | Não |
| Eventos (Kafka/async) | Nenhum | Não |
| Governança (ownership) | Sim — decreto `harness=só harness, brain dono da regra brain`; referência nunca cópia; installer 0-writes + doctor warn-não-fail | Sim (SPEC registra ADR de fronteira) |

---

## 5. Delta Preview

| Documento Alvo | Tipo de Mudança | Seção Afetada |
|----------------|-----------------|---------------|
| `.agents/skills/brain/SKILL.md` + `tools/*` (4 tools) | REMOVED | vendored inteiro → ref externa `../brain/.agents/skills/brain/SKILL.md` |
| `.agents/rules/brain-context.md` | MODIFIED | corpo 259 linhas (`:1-259`) → ponte fina ~20 linhas → `BRAIN.MCP.md` |
| `.agents/rules/workflow-rules.md` | MODIFIED | `:245` (template `brain-context-protocol.md` §3) + `:588` (tabela Documentos de Referência) |
| `.agents/agents/architect/AGENT.md` | MODIFIED | `:5` (link `brain-context-protocol.md`) |
| `.agents/agents/qa-engineer/AGENT.md` | MODIFIED | `:5` (link `brain-context-protocol.md`) |
| `.agents/agents/code-reviewer/PROMPT.md` | MODIFIED | `:5` (link `brain-context-protocol.md`) |
| `.agents/agents/ux-designer/AGENT.md` | MODIFIED | `:10` (link `brain-context-protocol.md`) |
| `.agents/agents/product-manager/AGENT.md` | MODIFIED | `:5` (link `brain-context-protocol.md`) |
| `.agents/rules/sdd-workflow-standard.md` | MODIFIED | `:45` (§5 Persistência no Brain — "Obsidian" stale) |
| `installer/install.mjs` (SPEC futuro, não esta fase) | MODIFIED | caminho doctor (`:743-772` D0-D6) + dispatch (`:1797-1810`) — 0 writes + warn-não-fail |
| `README.md` | MODIFIED | `:18` (linha skill `brain` — fronteira) |
| `RUNTIME-CONTRACT.md` (canônico a localizar; cópia archive `:68`) | MODIFIED | `:68` (linha MCP `brain` remote — fronteira) |
| `BRAIN.MCP.md` (dono brain) | ADDED | ponte alvo da H2 (fora deste repo; citado como dependência externa) |

---

## 6. Risk Assessment

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Ref externa `../brain/...` quebra em destino sem checkout brain (`installer/` leva ref dangling) | Média | Alto | SPEC exige fallback doc: ponte fina cita URL/canônico + doctor warn-não-fail; `installer/install.mjs:743-772` nunca grava (`doctor.spec.mjs:96-117` já asserta 0 writes) |
| Corrigir 7 refs + 2 extras deixa stale residual (grep futuro acusa `brain-context-protocol.md`) | Média | Médio | SPEC inclui grep de verificação nos 9 pontos (`.agents/rules/workflow-rules.md:245,588`; 5 agent files; `sdd-workflow-standard.md:45`; `codebase-analyzer:45-68`) como critério de aceite |
| Ponte fina H2 (~20 linhas) perde instrução crítica que vivia nas 259 linhas (`.agents/rules/brain-context.md:1-259`) | Baixa | Alto | SPEC mapeia cada seção removida → destino (`BRAIN.MCP.md` ou descarte justificado); nomes `brain_search`/`brain_store`/`brain_read` preservados literalmente |
| Quebrar âncora B de `harness-installer-mobile` (Completed, `workflow-state.json`) ao abrir novo ciclo | Baixa | Alto | Novo ciclo `harness-brain-separation` em `.spec/backend/` separado; archive `20261008-harness-installer-mobile` intocado; `workflow-state.json` só atualizado em fase própria com `current_feature` distinto |
| Doctor warn-não-fail mascara brain realmente quebrado (falha silenciosa) | Baixa | Médio | Warn carrega motivo + caminho (`installer/install.mjs:1797-1810` dispatch); evidência `brainStore` segue obrigatória em harness report (campo mantido, só o doctor não-falha) |

---

## 7. Success Criteria

- [ ] Funcional: `PROPOSAL.md` existe em `.spec/backend/harness-brain-separation/PROPOSAL.md` com ID `harness-brain-separation`, problema/solução/escopo H1-H5/riscos/delta (binário: arquivo existe e contém as 7 seções)
- [ ] Funcional: escopo H1-H5 cita caminho:linha e out-of-scope exclui B1-B3 + frontend (binário: grep aprova)
- [ ] Técnico: `proposal-gate.md` PASS em todos os itens não-bloqueadores + zero bloqueadores (binário: checklist §1-5 + 3 bloqueadores avaliados)
- [ ] Técnico: Delta Preview lista ADDED/MODIFIED/REMOVED por doc alvo (binário: ≥1 de cada tipo presente)
- [ ] Qualidade: zero edição de código produto neste ciclo (binário: `git status` mostra só `.spec/backend/harness-brain-separation/`)

---

## 8. Completion Metadata

- **Archived on**: 2026-10-14
- **Duration**: 1 dia (2026-10-14)
- **Archive path**: `.spec/archive/20261014-harness-brain-separation/`
- **Files changed**: `.agents/rules/brain-context.md` (259→15 ponte) + 9 refs (workflow-rules.md, sdd-workflow-standard.md, 5 agent files, codebase-analyzer) + `D .agents/skills/brain/*` (5 vendored REMOVED) + follow-ups workflow-rules.md:245-246; installer/README/RUNTIME intocados (H4/H5 prescritos)
- **Continuation**: `harness-installer-mobile` (Completed, archive `.spec/archive/20261008-harness-installer-mobile/` intocado)
- **Verify**: APPROVED 3/3 (D-01/O-01/O-02 explícitos) — `.spec/archive/20261014-harness-brain-separation/VERIFY.md`
