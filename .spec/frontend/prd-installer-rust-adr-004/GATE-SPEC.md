# GATE-SPEC — prd-installer-rust-adr-004

Formula: asserts/spec-gate.md §5 — atendidos/aplicaveis x 100; N/A com motivo fora do denominador.

| # | Item | Veredito | Motivo |
|---|---|---|---|
| 1 | ADRs | ✅ | ADR-004 17 itens §3 fonte da SPEC; UX.md parecer vinculante anexado |
| 2 | DDD Modular | N/A | modulo de apresentacao Rust sob contract-v1, nao camada Java |
| 3 | Seguranca/IAM | N/A | CLI local sem auth HTTP; segredo stdin sem eco (I5); SECURITY.md STRIDE |
| 4 | ERD | N/A | nenhuma entidade persistida nova |
| 5 | Event Registry | N/A | stdin/stdout/stderr (contract-v1), sem barramento |
| 6 | Migrations | N/A | nao-Java |
| 7 | Invariantes de Entidade | ✅ | I1 10x5=50 campos; I2 transcript 16336B; I3 tela nao grava |
| 8 | Invariantes de Workflow | ✅ | I4 aborto 0 writes; I5 segredo; I6 canais; I7 Pulse sem ANSI |
| 9 | Test Strategy | ✅ | SPEC §4: transcript, canais, segredo/cleanup PTY, 8 ops, 5 suites |
| 10 | Single File | ✅ | SPEC.md unica; UX.md/SECURITY.md sao relatorios de gate |
| 11 | Domínio claro | ✅ | apresentacao do instalador: 10 telas W0..W7, 8 ops D-TUI |

**aplicaveis=6 · atendidos=6 · N/A=5 · score=100%**

Gaps criticos/importantes: **0**. Seguranca Fase 1: pass. Parecer ux-designer: vinculante em UX.md (M1..M8, zero byte). Apto ao P1 a P2: **sim**.
