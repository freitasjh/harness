# PROPOSAL — prd-eixos-separados-cli-adr-002

> Ciclo SDD do **ADR-002 do PRD eixos-separados-cli** (CLI visual). Fonte: `.spec/prd/prd-eixos-separados-cli/ADRs/ADR-002-cli-visual/ADR.md` (12 itens §3; G2 aprovado).
> Classificação: **Feature** — protótipo aprovado pelo owner em 2026-11-17 e congelado (N=4, M medido).

## 1. Problema (medido)
| Fato | Valor |
|---|---|
| Instalação anterior | prompts line-based `[1/5]` congelados, transcript 16.336 B — nenhuma mudança visível no PRD-3 |
| Protótipo aprovado | setas+Enter, 4 telas (backend, frontend, nome, token) + resumo, PT-BR, token mascarado, rust+vue separados |
| B2 full-screen | descartada — sem oráculo de tela, cleanup de sinal complexo; N/M não reabertos sem §16 |

**Defeito evitado:** implementar CLI visual sem critério medido (promessa, não prova), reabrir N/M, ou expor segredo em argv/canal.

## 2. Proposta
`@inquirer/prompts` + i18n PT-BR (B1): `select` com setas+Enter, `password` sem eco, `AbortSignal`; 4 telas na ordem backend→frontend→nome→token + resumo; consome os eixos da ADR-001 (48 combinações); transcript novo ratificado em §16.

## 3. Escopo
12 itens de interface; N=4/M medido congelado; segredo/aborto/canais; transcript novo; versão/pin no SDD.

## 4. Não-escopo
B2 full-screen · mudar N/M sem §16 · publicação/toolchain · presets (ADR-001) · gate/config.

## 5. Riscos
P1-1 CLI sem critério medido (protótipo já resolve) · segredo em argv/TTY · SIGTERM sem eco · compatibilidade com transcript antigo proibida (item 9).

## 6. Verificação
wizard.spec (4 transições, 0 comando), qa.spec (segredo), eixos-stack.spec (rust+vue), transcript novo ratificado, C3 zero, 4 etapas 0 falhas.
