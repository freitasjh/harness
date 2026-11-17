# GATE-SPEC — prd-eixos-separados-cli-adr-002

Fórmula: asserts/spec-gate.md §5 — atendidos/aplicáveis x 100.

| # | Item | Veredito | Motivo |
|---|---|---|---|
| 1 | ADRs | ✅ | ADR-002 12 itens §3 + protótipo aprovado congelado |
| 2 | DDD Modular | N/A | apresentação CLI, não camada Java |
| 3 | Segurança/IAM | N/A | sem auth HTTP; SECURITY.md STRIDE segredo/TTY |
| 4 | ERD | N/A | nenhuma entidade persistida nova |
| 5 | Event Registry | N/A | prompts síncronos |
| 6 | Migrations | N/A | não-Java |
| 7 | Invariantes de Entidade | ✅ | I1 N=4/M congelado; I2 segredo; I5 transcript ratificado |
| 8 | Invariantes de Workflow | ✅ | I3 aborto 0 writes/restore; I4 eixos separados |
| 9 | Test Strategy | ✅ | SPEC §4: wizard, segredo, eixos, transcript, harness |
| 10 | Single File | ✅ | SPEC.md única; PROPOSAL/SECURITY/GATE relatórios |
| 11 | Domínio claro | ✅ | apresentação do instalador: 4 telas + resumo |

**aplicaveis=6 · atendidos=6 · N/A=5 · score=100%**

Gaps 🔴/🟠: **0**. Segurança Fase 1: pass. Protótipo aprovado e congelado. Apto ao P1 a P2: **sim**.
