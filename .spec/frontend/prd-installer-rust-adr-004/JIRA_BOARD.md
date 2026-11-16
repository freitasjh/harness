# JIRA_BOARD — PRD-3 ADR-004 (EPIC: TUI de 10 telas)

| Key | Summary | RF | Prioridade | Risco | Depende de | Status |
|---|---|---|---|---|---|---|
| TUI-01 | Modelo 10×5 + guarda de escrita com dente | 01,05,10,17,18 | P0 | Alto | — | DONE |
| VAL-01 | Transcript 16.336 B + oráculo c63e333 travados | 02,05,13 | P0 | Alto | TUI-01 | DONE |
| TUI-02 | Navegação W0→W4, 4 ramos, 0 transição | 03,12,18 | P0 | Alto | VAL-01 | TODO |
| TUI-03 | W5 confirmação, aborto e dry-run 0 writes | 03,06,18 | P0 | Alto | TUI-02 | TODO |
| TUI-04 | Segredo TTY sem eco + pipe serializeSkips | 07,08,18 | P0 | Alto | TUI-02 | TODO |
| TUI-05 | Cleanup de terminal após SIGTERM (R5) | 09,06,18 | P0 | Alto | TUI-04 | TODO |
| TUI-06 | 8 ops D-TUI no dispatcher + ponte reduzida a 10 | 04,11,12 | P0 | Alto | TUI-03,04,05 | TODO |
| VAL-02 | Prova integral: transcript, canais, segredo, 8 ops | 02,04,07,10,13 | P0 | Alto | TUI-01..06,VAL-01 | TODO |
| VAL-03 | Relatório + 5 suítes + selo + VERIFY | 14,15,16,18 | P0 | Médio | VAL-02 | TODO |

**Regra**: uma task por loop; teste antes do código; `code-reviewer` ao fim de cada batch; ux-designer `UX.md` vinculante (zero byte); guarda RF-05 com dente. Fora de escopo: 10 D-ENGINE (`FU-D1-ENGINE10`).
