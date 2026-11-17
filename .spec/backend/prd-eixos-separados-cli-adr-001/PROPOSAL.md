# PROPOSAL — prd-eixos-separados-cli-adr-001

> Ciclo SDD do **ADR-001 do PRD eixos-separados-cli** (eixos separados). Fonte: `.spec/prd/prd-eixos-separados-cli/ADRs/ADR-001-eixos-separados/ADR.md` (13 itens §3; G2 aprovado).
> Classificação: **Feature** (reabertura de D5/ADR-004 via §16 `D16-EIXOS-CLI`).

## 1. Problema (medido)
| Fato | Valor |
|---|---|
| Presets atuais | **12 casados** (`java+vue`, `java+react`, `node+react`, `rust+react`, ...) |
| Eixos | **8 backend × 6 frontend = 48** combinações possíveis |
| `rust+vue` | `"rust+vue" in STACK_PROFILES` ⇒ **false** — combinação citada pelo owner não existe |
| Perfis | `java+react.axes = {backend:'java',frontend:'react'}` — eixos já separados, mas só em 12 pares |
| Consumidores | **13 arquivos** importam `STACK_VALUES`/`STACK_PROFILES` |
| Baseline | golden.spec 9 byte-equal + java+react; V20 223/30373; selo c904f1c5 |

**Defeito evitado:** estender a tabela para 48 entradas manuais (Zⁿ estados, duplicação de commands/mcp/textos) — A2 descartada; e regenerar baseline auto-aceito (C3) — transforma bug em verdade.

## 2. Proposta
Compor config por eixo (A1): `commands`/`moduleMap` do backend, `mcp`/`stacks`/skills do frontend, textos derivados. 48 combinações substituindo os 12 como caminho principal. Baseline novo **validado e ratificado** (C1 autoridade, C2 só revisor de diff, C3 proibida); V20 e selo re-derivados com aprovação do owner.

## 3. Escopo
13 itens de interface; composição por eixo; 13 consumidores migrados; golden/V20/selo re-derivados.

## 4. Não-escopo
CLI visual e protótipo (ADR-002) · manter os 12 como caminho principal · qUalquer preset/chave/comando/default novo sem §16.

## 5. Riscos
P0-1 36 combinações sem baseline (ratificação §16) · P0-2 selo novo sem compatibilidade com c904f1c5 · P1 13 consumidores · P2 confundir com ADR-002.

## 6. Verificação
`eixos-stack.spec.mjs` oráculo 48/48; `golden.spec.mjs` 48 literais; V20 re-medido; selo novo ratificado; `grep` consumidores reduzido; `static-checks` 0 falhas.
