# PROPOSAL — harness-inventory-adr-004

> Ciclo SDD escopado do **ADR-004 do PRD-1** — último ADR do PRD.
> Fonte: `.spec/prd/prd-harness-inventory/ADRs/ADR-004-inventario-canonico/ADR.md` (282 linhas, 14 itens, G2 aprovado 2026-11-11).

## 1. Problema (medido 2026-11-11, pós-merge `cb0f08d`)

| Fato | Número |
|---|---|
| Skills no disco / com `SKILL.md` | 48 / 48 |
| Vendorizadas (`.vendor-lock.json`) | 25 |
| Sem consumidor em `.agents/agents/**` | 26 (25 do lock + `harness-installer`) |
| Rules | 8 (7 com consumidor, 1 de eixo) |
| Agentes registrados | 10 (9 `AGENT.md` + 1 `PROMPT.md`) |
| Contagens **erradas** publicadas neste PRD | 2 (11 agentes; 49 skills) |

Consequência: o único inventário existente é prosa — e ela errou 4 vezes em menos de 1 dia (7→10 arquivos, 13→20 paths, 11→10 agentes, 49→48 skills). Documento manual não é inventário; é rascunho datado.

## 2. Proposta

Superfície **derivada** (`V19`): módulo puro `lib/inventory/checks.mjs` que conta do disco e do `opencode.json`, classifica skill pelo `.vendor-lock.json` (nunca por prefixo), exige dono para órfã e **expira** a decisão do dono quando ela deixa de fazer sentido. Adapter no `static-checks` — **sem** comando novo, selo intacto.

## 3. Escopo

Os 14 itens de interface do `ADR.md` §3.

## 4. Não-escopo

Agnosticização de conteúdo (PRD-2), as 8 rules ausentes (classificadas no ADR-005), `KNOWN_AGENTS` (FU-65), e a **correção das contagens do PRD** (ciclo separado com dono: reabrir PRD aprovado não é corrigir fato).

## 5. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | `OWNER_DECISIONS` virar licença permanente | modo `owner-decision-stale` (sujeito sumiu / ganhou consumidor) |
| R2 | `SKILLS_COMMON`/`RULES_COMMON` comprarem isenção | as listas do instalador **não** conferem classe |
| R3 | Selo republicado | nenhum comando novo em `commands.suiteFull` |
| R4 | Destino sem lock nascer vermelho | `lockPresent=false` ⇒ classe por eixo já resolvida, sem FAIL |
| R5 | Heurística de prefixo voltar | item congela `grep -c startsWith` = 0 |

## 6. Verificação

5 comandos de suíte + `PASS V19` com os counters; `git diff` de `harness.config.json` e `seal.mjs` vazio.
