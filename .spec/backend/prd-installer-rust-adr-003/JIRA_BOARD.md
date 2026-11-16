# JIRA_BOARD — PRD-3 ADR-003 (EPIC: motor init/doctor/upgrade)

> Classificação: **EPIC** (Refactor). Layer: `BE` (motor Rust) + `VAL` (validação). FE: N/A (ADR-004).
> Base `fbdca4c` · branch `adr/prd-installer-rust/03-motor-init-doctor-upgrade-impl`.

| Key | Summary | RF | Prioridade | Risco | Depende de | Status |
|---|---|---|---|---|---|---|
| HARN-BE-01 | Bootstrap crate + envelope `v:1` + 23 ops no dispatcher | 01,17 | P0 | Alto | — | DONE |
| HARN-VAL-01 | Oráculo `c63e333` + harness `prova(op)` + 8 shas | 02,12,14 | P0 | Alto | BE-01 | DONE |
| HARN-BE-02 | Ops 1/2/4/5 — preflight, inventory, backupDir, answers | 01,02 | P0 | Médio | BE-01 | DONE |
| HARN-BE-03 | Ops 6/7/8 — collectAnswers, generateConfig, collectIncoming | 01,02 | P0 | Médio | BE-02 | DONE |
| HARN-BE-04 | Texto congelado — erro 4-linhas, 22 códigos+UNKNOWN, help | 07,08 | P0 | Alto | BE-01 | DONE |
| HARN-BE-05 | Op 18 — `runDoctor` D0..D6 somente leitura, não-gate | 06,03 | P0 | Alto | BE-02 | DONE |
| HARN-BE-06 | Ops 9/10/11/12/15/16 — merge v2-only, manifesto, escrita | 09,10 | P0 | Alto | BE-03 | DONE |
| HARN-BE-07 | Ops 3/13/14 — backup verificado, checks, único ponto de escrita | 04 | P0 | Alto | BE-06 | DONE |
| HARN-BE-08 | Ops 17/19/20/21/23 — 4 entrypoints, duas ordens congeladas | 03,05,09,10,11 | P0 | Alto | BE-04,BE-05,BE-07 | DONE |
| HARN-VAL-02 | Differential das 23 ops com mutação que derruba | 02,14 | P0 | Alto | VAL-01,BE-02..08 | TODO |
| HARN-VAL-03 | SI-2/SI-3 `not_measured` → differential real; rito intacto | 12,14 | P0 | Alto | VAL-02 | TODO |
| HARN-VAL-04 | Relatório + 5 suítes + Rust paralelo + selo `c904f1c5` | 13,15,16 | P0 | Médio | VAL-03 | TODO |

**Regra de execução:** uma task por loop, teste antes do código, atualizar esta tabela após cada task, `code-reviewer` ao fim de cada batch. Nenhuma task cruza camada BE/VAL.
