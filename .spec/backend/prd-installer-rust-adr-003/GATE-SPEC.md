# GATE-SPEC — prd-installer-rust-adr-003

Fórmula: `asserts/spec-gate.md` §5 — itens atendidos / itens aplicáveis × 100; N/A com motivo fora do denominador.

| # | Item | Veredito | Motivo |
|---|---|---|---|
| 1 | ADRs | ✅ | ADR-003 §2/§3 é a fonte; 17 itens congelados |
| 2 | DDD Modular api/impl/public | N/A | motor Rust sob contract-v1; fronteira é o dispatcher de 23 ops, não camadas Java |
| 3 | Segurança/IAM @HasPermission | N/A | instalação local sem autenticação HTTP/API; segredo em stdin sem eco (SPEC I5) |
| 4 | ERD | N/A | nenhuma entidade persistida nova; manifesto v1 e backup já existentes |
| 5 | Event Registry | N/A | comunicação por stdin/stdout/stderr (contract-v1), sem barramento |
| 6 | Migrations | N/A | não-Java; nenhuma migration |
| 7 | Invariantes de Entidade | ✅ | I1 manifesto schema v1, I2 backup verificado, I5 segredo |
| 8 | Invariantes de Workflow | ✅ | I3 duas ordens congeladas/doctor não-gate/apply único ponto; I4 exit codes |
| 9 | Test Strategy | ✅ | SPEC §4: 5 suítes + Rust paralelo + prova(op)×23 + runParity |
| 10 | Single File | ✅ | SPEC.md única; SECURITY.md é relatório de gate, não especificação |
| 11 | Domínio claro | ✅ | instalação do harness (installer); 23 ops de engine; 4 entrypoints |

**aplicáveis = 6 · atendidos = 6 · falhas = 0 · N/A = 5 · score = 100%**

Gaps 🔴/🟠 abertos: **0**. Segurança Fase 1: `pass` (SECURITY.md). Apto ao P1→P2: **sim**.
