# JIRA_BOARD — EPIC harness-brain-separation

> **EPIC**: `harness-brain-separation` — Refactor governança (decreto ownership harness×brain, docs-only)
> **Tipo**: EPIC (Refactor, não BUG — classifica `jira-microtask-breaker`: Feature/Refactor → EPIC)
> **Continuação**: `harness-installer-mobile` Completed, archive `.spec/archive/20261008-harness-installer-mobile/` intocado
> **Fontes**: `SPEC.md` 426 linhas PASS 16/16 + `PLAN.md` 309 linhas PASS 7/7 (PL-00..PL-60) + `PROPOSAL.md` PASS 11/11 + spec-review 🟡4 + security 🟡2 + product-manager APROVADO COM RESSALVAS (PM-1 URL exata → HB-BE-05, PM-2 pin hash → HB-BE-07)
> **Escopo**: PL-00 canônico/donos, PL-01 doctor, PL-10/11 H1 ref+fallback, PL-20/21 H2 ponte+pin G1, PL-30/31/32 H3 7+2+scrub+fixes 001/002/003, PL-40/41 H4 0-writes+warn, PL-50 H5 fronteira, PL-60 guarda+suite. NÃO ENTRA: B1-B3, frontend, código produto, rename tools/`brainStore`, `workflow-state.json`.
> **Layer isolation**: todas Docs (docs-only). 1 microtask = 1 arquivo/grupo, nunca mistura camadas. Escrita só em `.spec/backend/harness-brain-separation/`; produto só lido via grep/sed/wc/test.

## Board (15 tickets: 13 BE + 2 VAL)

| Key | PLAN | Resumo | Prioridade / Risco | Depends | Validação binária | Status |
|-----|------|--------|-------------------|---------|-------------------|--------|
| HB-BE-01 | PL-00 | Localizar RUNTIME-CONTRACT canônico (fix 🟡004/G3; F1: sem `maxdepth`, espelho em profundidade 4) | P0 / Medium | — | `find . -name "RUNTIME-CONTRACT.md" \| head` + `grep -n brain <alvo>` | Done |
| HB-BE-02 | PL-01 | Confirmar dono doctor `install.mjs:743-772` + dispatch `1797-1810` + `doctor.spec.mjs` 0-writes | P0 / Low | — | `grep -n runDoctor installer/install.mjs` + `grep -n "0 writes" installer/__tests__/doctor.spec.mjs` | Done |
| HB-BE-03 | PL-02 | Fix range `16-47`→`16-132` H2 (fix 🟡002) | P1 / Low | HB-BE-01 | `grep -n "### \`brain_" .agents/rules/brain-context.md` == 4 (`18/49/88/108`) | Done |
| HB-BE-04 | PL-10 | REMOVED vendored → ref `../brain/.agents/skills/brain/SKILL.md` (`REMOVED_OK`, `ABSENT_TOTAL`, ref sibling OK) | P0 / Medium | HB-BE-01 | `ls -R .agents/skills/brain \| grep -c brain_` → 8 pré; `test ! -d` pós | Done |
| HB-BE-05 | PL-11 | Fallback dangling URL EXATA + caminho + warn (🟡G2, PM-1; PIN-ME + comando, `https://` count 0) | P0 / High | HB-BE-04 | `grep -c "\.\./brain/.agents/skills/brain/SKILL.md" SPEC.md` → 8 + canônico irmão OK | Done |
| HB-BE-06 | PL-20 | Ponte ≤30 linhas (dono/link/3-tools/`brainStore`/fluxo/fallback) — 15 linhas | P0 / High | HB-BE-05 | `wc -l` bloco ≤ 30 + `grep -c "BRAIN.MCP.md"` ≥ 3 | Done |
| HB-BE-07 | PL-21 | Pin G1 ref+commit/HASH + warn divergência (🟡G1, PM-2) — `8b96509...` real | P1 / Medium | HB-BE-06 | pin `commit <sha>` ou `sha256:<PIN-ME>` + comando `git -C <brain> rev-parse HEAD` | Done |
| HB-BE-08 | PL-30 | 7 refs `brain-context-protocol.md` → ponte | P0 / Medium | HB-BE-06 | `grep -rn "brain-context-protocol.md" .agents/ \| wc -l` == 7 pré → 0 pós | Done |
| HB-BE-09 | PL-31 | 2 extras + scrub P2-02 (`codebase-analyzer:45-68`, `sdd:45`) | P0 / Medium | HB-BE-08 | `grep -rn "mcp_ObsidianBrain_\|brain/knowledge/" .agents/agents/codebase-analyzer/` vazio pós | Done |
| HB-BE-10 | PL-32 | Fix Delta 14→13 (🟡001) + G0.2 2-passos (🟡003) | P1 / Low | HB-BE-08 | `grep -c "#### MODIFIED" SPEC.md` + G0.2 2 comandos | Done |
| HB-BE-11 | PL-40 | Doctor 0-writes D0-D6 + dispatch sem efeito | P0 / Medium | HB-BE-02 | `node --test installer/__tests__/doctor.spec.mjs` verde | Done |
| HB-BE-12 | PL-41 | Warn-não-fail (veredito + `next` motivo+caminho) | P1 / Medium | HB-BE-11 | `grep -c "warn-não-fail" SPEC.md` ≥ 3 + motivo+caminho no bloco | Done |
| HB-BE-13 | PL-50 | Fronteira `README.md:18` + RUNTIME `:68`, nomes intactos | P1 / Low | HB-BE-01, HB-BE-06 | `grep -c brainStore .agents/schemas/harness-report.schema.json` ≥ 2 + `grep -n "Memória persistente" README.md` | Done |
| HB-VAL-01 | PL-60 | Guarda G0.1/G0.2 + suiteFull + `git status` só `.spec/` | P0 / High | HB-BE-07, HB-BE-09, HB-BE-10, HB-BE-12, HB-BE-13 | `node --test ".opencode/plugins/__tests__/*.spec.mjs" && node scripts/static-checks.mjs` + `ZERO_PROD_OK` + `ARCHIVE_INTACT` | Done |
| HB-VAL-02 | gate | tasks-gate self-check + traceability 14/14 | P0 / Medium | HB-VAL-01 | 15 HB, BDD 15/15, grafo acíclico, 0 órfãs | Done |

## Dependency chain (crítico)
`HB-BE-01 → HB-BE-04 → HB-BE-05 → HB-BE-06 → HB-BE-08 → HB-BE-09 → HB-VAL-01 → HB-VAL-02`
Paralelizáveis: HB-BE-01 ∥ HB-BE-02; HB-BE-10 ∥ HB-BE-09. Restante Hard sequencial (grafo em `TASKS.md` §3, acíclico).

## Execução (micro-surgical, 1 task/loop)
1. Declarar Key (ex: `HB-BE-01`), ler SÓ escopo da task.
2. Rodar verificação FIRST (coluna Validação), depois preencher seção em `TASKS.md`.
3. Marcar Done aqui. NUNCA editar código produto; NUNCA B1-B3/frontend/rename; NUNCA task sem verificação.
4. Próxima task só após Done + `git status` limpo fora de `.spec/backend/harness-brain-separation/`.

## tasks-gate (veredito atual)
PASS 10/10 + 2 extras — 14/14 PL cobertos, BDD triplo 15/15, TDD-first 15/15, grafo acíclico zero órfãs, DoD 15/15, PM-1→HB-BE-05, PM-2→HB-BE-07, zero produto. Detalhe em `TASKS.md` §tasks-gate self-check.

## Batch 5 (2026-10-14, H4+H5+VAL+follow-ups) — CLOSED
- HB-BE-11 Done (doctor 10/10, `INSTALLER_UNTOUCHED`), HB-BE-12 Done (warn `11` via `-o|wc`, veredito motivo+caminho), HB-BE-13 Done (schema `2`, README `:18`, RUNTIME `:68`).
- Follow-ups workflow-rules Done (`ObsidianBrain_write_note`→`brain_store`, seção 3 dangling→ponte+`BRAIN.MCP.md`).
- HB-VAL-01 Done (plugins 135 + installer 360 + static + vendor verdes; G0.1 allowlist D H1 + G0.2 2-passos; `ARCHIVE_INTACT`).
- HB-VAL-02 Done (gate PASS 10/10 + 2 extras). **Board 15/15 Done.**
