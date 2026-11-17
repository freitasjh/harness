# JIRA_BOARD — PRD eixos-separados-cli ADR-001 (EPIC: 48 combinações)

| Key | Summary | RF | Prioridade | Risco | Depende de | Status |
|---|---|---|---|---|---|---|
| EIX-01 | Inventário eixos 8×6=48 | 01,13 | P0 | Médio | — | DONE |
| EIX-02 | Composição backend/frontend | 02,03 | P0 | Alto | EIX-01 | DONE |
| EIX-03 | Gerador textos derivados, rust+vue | 04,05 | P0 | Alto | EIX-02 | TODO |
| EIX-04 | Migração 13 consumidores | 06,07 | P0 | Alto | EIX-03 | TODO |
| VAL-01 | Baseline 48 ratificado + V20 | 08,09 | P0 | Alto | EIX-04 | TODO |
| VAL-02 | Selo re-derivado + VERIFY | 10,11,12 | P0 | Alto | VAL-01 | TODO |

**Regra**: teste antes do código; C3 (auto-accept) proibida; selo/baseline só mudam com ratificação §16; CLI visual é ADR-002.
