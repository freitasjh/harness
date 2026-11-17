# GATE-SPEC — prd-eixos-separados-cli-adr-001

Fórmula: asserts/spec-gate.md §5 — atendidos/aplicáveis x 100.

| # | Item | Veredito | Motivo |
|---|---|---|---|
| 1 | ADRs | ✅ | ADR-001 13 itens §3, decisão A1/C1/C2/C3 |
| 2 | DDD Modular | N/A | geração de config, não camada Java |
| 3 | Segurança/IAM | N/A | sem auth HTTP; SECURITY.md STRIDE |
| 4 | ERD | N/A | nenhuma entidade persistida nova |
| 5 | Event Registry | N/A | composição pura |
| 6 | Migrations | N/A | não-Java |
| 7 | Invariantes de Entidade | ✅ | I1 48 eixos; I2 composição; I3 baseline validado |
| 8 | Invariantes de Workflow | ✅ | I4 selo ratificado; I5 gate/config intactos |
| 9 | Test Strategy | ✅ | SPEC §4: eixos 48, golden 48, cargo, selo, harness |
| 10 | Single File | ✅ | SPEC.md única; PROPOSAL/SECURITY/GATE relatórios |
| 11 | Domínio claro | ✅ | instalador: composição de config por eixo backend/frontend |

**aplicaveis=6 · atendidos=6 · N/A=5 · score=100%**

Gaps 🔴/🟠: **0**. Segurança Fase 1: pass. Apto ao P1 a P2: **sim**.
