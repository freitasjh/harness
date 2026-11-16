# Security Assessment — Fase 1 — prd-installer-rust-adr-004

> Skill `security-review` (SSoT). CLI local, sem endpoints. STRIDE nos fluxos da TUI.

## Threat Model
| Ameaça | Fluxo | Risco | Mitigação |
|---|---|---|---|
| Information Disclosure | segredo `deployToken` | 🔴 | TTY sem eco (RF-07); pipe `serializeSkips` (RF-08); `[REDACTED]`; nunca em argv/stdout/stderr/RELATÓRIO |
| Information Disclosure | canais | 🟠 | `stdout` só envelope, `stderr` progresso (RF-10); `deployToken` ausente do envelope em pipe |
| Tampering | transcript | 🟠 | 16.336 B imutável, sha registrado antes da comparação, rito ADR-002 (RF-13/14) |
| Tampering | escrita no aborto | 🔴 | tela nunca grava (RF-05); 0 writes (RF-06) |
| DoS | terminal sem eco | 🟠 | cleanup idempotente antes da leitura, `SIGTERM` com sinal (RF-09) |
| Spoofing | `op` de TUI | 🟢 | 8 nomes 1:1 com D-TUI, differential contra `c63e333` (RF-11) |
| Elevation | tela chamando `apply` | 🔴 | `grep` = 0 no módulo de tela (RF-05); `apply` só no motor |

## Gaps
🔴 0 · 🟠 0 · 🟡 0. R5 (cleanup) tem mitigação prescritiva e prova PTY (RF-09) — não é gap aberto.

## Veredito
`pass` — Threat model sim; 0 críticos. Revalidar Fase 3 (OWASP aplicável) e Fase 4 (checklist 14 itens com N/A de CLI local).
