# JIRA_BOARD — PRD eixos-separados-cli ADR-002 (EPIC: CLI visual)

| Key | Summary | RF | Prioridade | Risco | Depende de | Status |
|---|---|---|---|---|---|---|
| CLI-01 | Infra @inquirer + i18n PT-BR + AbortSignal | 04,08,12 | P0 | Médio | — | TODO |
| CLI-02 | 4 telas backend/frontend/nome + resumo (N=4) | 01,02,03,04 | P0 | Alto | CLI-01 | TODO |
| CLI-03 | Seleção independente backend/frontend (ADR-001) | 06,10 | P0 | Alto | CLI-02 | TODO |
| CLI-04 | Segredo, aborto 0 writes, restore de eco | 05,07 | P0 | Alto | CLI-02 | TODO |
| VAL-01 | Transcript novo ratificado + rust+vue | 06,09,10 | P0 | Alto | CLI-04 | TODO |
| VAL-02 | Suíte, canais, N/M medidos, VERIFY | 02,08,11 | P0 | Médio | VAL-01 | TODO |

**Regra**: protótipo aprovado é autoridade (N/M não reabertos sem §16); B1 @inquirer, não B2 full-screen; grep word-boundary para RF-08; segredo nunca em argv/canal; transcript novo sem paridade com 16336B.
