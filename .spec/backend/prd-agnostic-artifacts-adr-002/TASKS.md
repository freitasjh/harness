# TASKS — prd-agnostic-artifacts-adr-002

> Execução do ADR-002 na branch `adr/prd-agnostic-artifacts/02-entradas-sempre-instaladas` (base `b2d6bce`).

## Microtasks (TDD-ready)

### ED-01
- [x] `opencode.json`: `agent.orchestrator.permission.edit = { "*": "deny", ".spec/**": "allow" }`; sem `agents.*`, sem `permissions` (RF-01, E1, E2).

### ED-02
- [x] `config-dual-parity.spec.mjs`: asserção por **índice** (`deny` antes de `allow`) + 2 fixtures vermelhas (invertido; `agents.*` sem `prompt`) (RF-01, RF-09, I1).

### ED-03
- [x] Prova de escrita real: `.spec/**` grava, `.agents/**` negado; worktree limpo ao fim (RF-02).

### ED-04
- [x] `workflow-rules.md`: 4 linhas genéricas citam `commands.*` (`:217,:218,:219,:225`) (RF-03).

### ED-05
- [x] Headings `:431,:438,:444` nomeiam o eixo; tabela `:558-563` com `` (`backend=…`) `` (RF-03, E3).

### ED-06
- [x] Preservar contagem: `awk NR`=608, `numstat` 20/20, 11 hunks (RF-05, I3).

### ED-07
- [x] `sdd-workflow-standard.md:3` → escopo; `:16-18` nomeiam a sessão que escreve (RF-06, RF-07).

### ED-08
- [x] `PROJECT_TERMS["Atlas ECM"].proof` re-apontado para `frontend-coding-standards.md:154` (RF-06, E4).

### ED-09
- [x] Remover 16 entradas da `BASELINE` (15 de `workflow-rules.md` + 1 de `sdd-workflow-standard.md`); `baseline=80`, 27 chaves vizinhas iguais (RF-03, RF-04, I2).

### ED-10
- [x] Commit com trailer `Harness-Gate-Change` (4 paths protegidos) (RF-10).

### ED-11
- [x] Verificação final: 5 comandos + `opencode debug config` exit 0; `git diff` de `installer/`/`seal.mjs` vazio; `V18`/`V19` inalterados (RF-10, I4).

## Sumário de execução

| Task | Fase | Depende de |
|---|---|---|
| ED-01 | 1 | — |
| ED-02 | 1 | ED-01 |
| ED-03 | 1 | ED-01 |
| ED-04 | 2 | — |
| ED-05 | 2 | ED-04 |
| ED-06 | 2 | ED-05 |
| ED-07 | 3 | — |
| ED-08 | 3 | ED-07 |
| ED-09 | 4 | ED-04, ED-05, ED-07 |
| ED-10 | 4 | ED-01..ED-09 |
| ED-11 | 4 | ED-10 |
