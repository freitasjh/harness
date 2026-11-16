# JIRA_BOARD — PRD-3 ADR-005 (EPIC: publicação/runtime/selo)

| Key | Summary | RF | Prioridade | Risco | Depende de | Status |
|---|---|---|---|---|---|---|
| PUB-01 | Wrapper package.json (bin, optionalDependencies, engines) | 01,02,14 | P0 | Médio | — | DONE |
| PUB-02 | Shim JS localizador (não motor) | 01,05,11 | P0 | Alto | PUB-01 | DONE |
| PUB-03 | Pacotes de plataforma (matriz os/cpu/libc) | 02,06,12,16 | P0 | Médio | PUB-01 | TODO |
| PUB-04 | Fallback tripla não casa + prova D7 | 03,04,12 | P0 | Alto | PUB-03 | TODO |
| VAL-01 | Prova runtime limpo (D7) e rede-zero | 03,05,11,12 | P0 | Alto | PUB-02,PUB-04 | TODO |
| VAL-02 | Selo, oráculo e differential (RF-07..10,13) | 07,08,09,10,13 | P0 | Alto | VAL-01 | TODO |
| VAL-03 | Ledger, 4 etapas, VERIFY | 15 | P0 | Médio | VAL-02 | TODO |

**Regra**: uma task por loop; teste antes do código; `code-reviewer` por batch; selo c904f1c5 invariante; Rust fora da contraprova; sem `npm publish` sem owner.
