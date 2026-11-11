# TASKS — harness-inventory-adr-001

> Execução do ADR-001 na branch `adr/prd-harness-inventory/01-roster-de-agentes` (base `5dcc0e0`). **2 commits**, ambos com trailer `Harness-Gate-Change`: `1c8062b` (implementação, RV-01..RV-11) e `2b80685` (prosa do doc + assert de conjunto, fechamento das ressalvas do review).

## Microtasks (TDD-ready)

### RV-01
- [x] `opencode.json`: remover a chave `codebase-analyzer`; provar 9 chaves e 1 `primary` (RF-01).

### RV-02
- [x] `architect/AGENT.md`: adicionar `### Modo análise (absorvido de codebase-analyzer)` + os 4 sub-marcadores do ADR; remover o diretório `codebase-analyzer/` (RF-04).

### RV-03
- [x] Remover `.agents/agents/sdd-orquestrador/` inteiro (3 arquivos: `AGENT.md`, `gemini.yaml`, `opencode.yaml`) (RF-03).

### RV-04
- [x] Migrar os 3 marcadores de gate (`NÃO-BYPASS`+`gate-contract.md`, `gates.P1_P2`, `gates.P2_P3`) para `orchestrator/AGENT.md` (RF-07).

### RV-05
- [x] Remover o stub `.agents/agents/code-reviewer/AGENT.md`, mantendo `PROMPT.md` (RF-05).

### RV-06
- [x] `scripts/sdd-checks.mjs`: reapontar `:132`, `:384` e o rótulo `:383` para `orchestrator/AGENT.md` (RF-06).

### RV-07
- [x] `.opencode/plugins/__tests__/sdd-checks.spec.mjs`: eliminar `SDD_ORCH`, migrar os 7 usos para `ORCH` (RF-08).

### RV-08
- [x] `.agents/rules/workflow-rules.md:87` e `.agents/rules/sdd-workflow-standard.md:42` reapontados para `orchestrator/AGENT.md` (RF-09).

### RV-09
- [x] `.agents/rules/gate-contract.md:18`: I5 passa de 6 para 5 agentes sem `edit` (sai `codebase-analyzer`) (RF-09).

### RV-10
- [x] `.agents/skills/prompt-optimizer/SKILL.md:171` e `docs/FUNCIONAMENTO.md` (`:542`, `:675` reapontar; `:624` remover; `:682` manter) (RF-09, RF-10).

### RV-11
- [x] Commits com trailer `Harness-Gate-Change` (RV-08/RV-09 tocam `.agents/rules/**`); sem push (RF-11, I2). São 2: `1c8062b` (implementação) e `2b80685` (prosa + assert de conjunto).

### RV-12
- [ ] Verificação final: suíte completa exit 0, `git diff --stat` com 0 linhas em `gate.js`/`harness.config.json`, comandos de aceite do `ADR.md` §7 **com as substituições N8/N9**, e relatório de harness em `harness/harness-inventory.json` (Anexo B) — **pendente: o REPORT é produzido pelo `qa-engineer` no portão P4**.
  - **N8** — o item 5 do ADR exigia `prompt.file`, que não existe (o valor é a string). Aceite = comparação da string.
  - **N9** — `ls .agents/agents/*/AGENT.md` = 8 depois; o critério vinculante é `ls -d .agents/agents/*/` = 9.

## Sumário de execução

| Task | Fase | Depende de |
|---|---|---|
| RV-01 | 1 | — |
| RV-02 | 1 | RV-01 |
| RV-03 | 1 | — |
| RV-04 | 1 | RV-03 |
| RV-05 | 1 | — |
| RV-06 | 2 | RV-03 |
| RV-07 | 2 | RV-06 |
| RV-08 | 3 | RV-03 |
| RV-09 | 3 | RV-02 |
| RV-10 | 3 | RV-03 |
| RV-11 | 3 | RV-01..RV-10 |
| RV-12 | 4 | RV-11 |

## Desvios declarados na execução (2026-11-11)

| # | Desvio | Situação |
|---|---|---|
| D1 | Item 5: o comando de aceite do ADR não rodava (o schema `prompt` é string, não objeto) | corrigido em §3 (item 5) e §7 (nota N8); config intacto |
| D2 | `config-dual-parity.spec.mjs:123` — assert `10 agents` → `9` | ✅ **resolvido**: virou `assert.deepEqual` do conjunto literal de 9 nomes (`2b80685`) |
| D3 | `ls .agents/agents/*/AGENT.md` = 8 depois | corrigido no ADR (nota N9) |
| D4 | `describe` do `sdd-checks.spec.mjs` singularizado | consequência direta do item 8 |
| D5 | `docs/FUNCIONAMENTO.md:108/:610/:614/:653` com prosa defasada | ✅ **corrigido** em `2b80685` (9 lastros `edit` reancorados; linha do agente apagado removida; `design-system-specialist` incluído) |
