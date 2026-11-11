# TASKS — harness-inventory-adr-001

> Execução do ADR-001. Todos os itens entram em **um único commit** na branch `adr/prd-harness-inventory/01-roster-de-agentes` (base `5dcc0e0`).

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
- [x] Commit único com trailer `Harness-Gate-Change` (itens RV-08/RV-09 tocam `.agents/rules/**`); sem push (RF-11, I2).

### RV-12
- [x] Verificação final: suíte completa exit 0, `git diff --stat` com 0 linhas em `gate.js`/`harness.config.json`, comandos de aceite do `ADR.md` §7, relatório de harness no Anexo B (RF-12).

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
