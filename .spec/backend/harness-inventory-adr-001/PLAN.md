# PLAN — harness-inventory-adr-001

> Execução atômica do ADR-001. Um único commit de implementação na branch `adr/prd-harness-inventory/01-roster-de-agentes` (base `5dcc0e0`).

## 1. Fases

### Fase 1 — Roster e fusão (RF-01..RF-05)
1. Editar `opencode.json`: remover a chave `codebase-analyzer`; 9 chaves restantes.
2. Editar `.agents/agents/architect/AGENT.md`: acrescentar `### Modo análise (absorvido de codebase-analyzer)` com os 4 sub-marcadores congelados no ADR §3 item 4.
3. Remover `.agents/agents/codebase-analyzer/` (diretório inteiro).
4. Remover `.agents/agents/sdd-orquestrador/` (3 arquivos — inclui `opencode.yaml`, que o `grep` não vê).
5. Remover `.agents/agents/code-reviewer/AGENT.md` (stub); `PROMPT.md` fica.
6. Migrar os 3 marcadores de gate para `.agents/agents/orchestrator/AGENT.md`.

**Checkpoint F1:** `ls -d .agents/agents/*/ | wc -l` = 9 e conjunto = RF-01.

### Fase 2 — Consumidores de código (RF-06..RF-08)
7. `scripts/sdd-checks.mjs`: `:132` e `:384` passam a ler `orchestrator/AGENT.md`; rótulo `:383` atualizado.
8. `.opencode/plugins/__tests__/sdd-checks.spec.mjs`: `SDD_ORCH` → `ORCH` nos 7 usos; constante eliminada.

**Checkpoint F2:** `grep -c sdd-orquestrador scripts/sdd-checks.mjs` = 0; teste de plugins verde.

### Fase 3 — Prosa e rules (RF-09, RF-10) — ⚠️ paths protegidos
9. `.agents/rules/workflow-rules.md:87`, `.agents/rules/sdd-workflow-standard.md:42`, `.agents/rules/gate-contract.md:18` (I5 6→5), `.agents/skills/prompt-optimizer/SKILL.md:171`.
10. `docs/FUNCIONAMENTO.md`: `:542`, `:675` reapontar; `:624` remover; `:682` manter.
11. Commit com trailer `Harness-Gate-Change: ADR-001 (roster) — reapontamento de referencia e correcao de contagem I5; nenhuma policy alterada`.

**Checkpoint F3:** `grep -rn sdd-orquestrador .agents docs scripts .opencode | grep -v archive` = só `harness/opencode-v2-only.json` (se dentro do escopo do grep) e `workflow-state.json`.

### Fase 4 — Verificação (RF-11, RF-12)
12. Suíte completa (5 comandos) + os comandos de aceite do `ADR.md` §7.
13. `git diff --stat` prova: `gate.js` e `harness.config.json` com 0 linhas alteradas.

## 2. Constraint mapping

| Constraint | Onde é respeitada |
|---|---|
| Atomicidade (P1) | todas as fases em 1 commit |
| Paths protegidos (P2) | trailer em Fase 3 |
| Sem policy nova (I4) | só 1 contagem alterada |
| Sem tocar gate/selo (RF-12) | proibido editar `gate.js`, `harness.config.json` |
| Evidence artifacts intocados (RF-11) | `workflow-state.json` só com o bloco `prd_adr` do orquestrador |

## 3. Caminho crítico

`F1.2 → F1.4 → F2.7 → F2.8 → F4.12` — quebrar esse elo deixa `suiteFull` vermelho (ENOENT e SDD-01).

## 4. Riscos de execução

- **X1** — esquecer `opencode.yaml` na remoção do `sdd-orquestrador` (invisível ao grep).
- **X2** —"consertar" `harness/opencode-v2-only.json` por engano (é evidência).
- **X3** — atualizar o instalador "para refletir o roster" quando ele não é escopo: o instalador propaga o diretório `.agents/agents` inteiro; nenhuma lista hardcoded deve ser introduzida.
- **X4** — deixar o commit sem trailer e o hook/CI rejeitar.

## 5. Rollback

`git reset --hard 5dcc0e0` na branch (nada foi pushado).
