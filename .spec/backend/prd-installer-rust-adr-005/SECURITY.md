# Security Assessment — Fase 1 — prd-installer-rust-adr-005

> Skill `security-review` (SSoT). Publicação de pacote npm + subprocesso local.

## Threat Model (STRIDE)
| Ameaça | Fluxo | Risco | Mitigação |
|---|---|---|---|
| Supply chain / Tampering | `optionalDependencies` | 🟠 | versões acompanham o wrapper, definidas no SDD com fonte; `files` só o binário; sem script de build |
| Information Disclosure | fallback stderr | 🟢 | tripla + matriz + ação corretiva; nenhum segredo/caminho interno sensível |
| Elevation | shim | 🟠 | shim só localiza/lança; nunca reimplementa motor nem grava; `install.mjs` fora do pacote (RF-06) |
| DoS | install sem rede | 🟢 | rede-zero (RF-12), nenhum download no postinstall |
| Spoofing | `bin` | 🟢 | envelope `v:1` + `op` conferidos pelo contrato (RF-11) |
| Repudiation | publicação/fallback | 🟡 N/A | sem log central em CLI; rastro = versão do pacote + tripla em stderr + RELATÓRIO do SDD (ADR-005 §2.2) |

## Gaps
🔴 0 · 🟠 0 (mitigações prescritivas). ℹ custo D6: cobertura Rust fora do selo — não é gap de segurança (o oráculo externo ADR-002 é a garantia).

## Veredito
`pass` — Threat model sim; 0 críticos. Revalidar Fase 3 (OWASP A06 dependências com lockfile) e Fase 4 (checklist 14 itens com N/A de CLI local).
