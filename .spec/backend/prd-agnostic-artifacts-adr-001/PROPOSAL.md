# PROPOSAL — prd-agnostic-artifacts-adr-001

> Ciclo SDD escopado do **ADR-001 do PRD-2**. Fonte: `.spec/prd/prd-agnostic-artifacts/ADRs/ADR-001-criterio-cdl-e-instrumento/ADR.md` (410 linhas, 12 itens, G2 aprovado 2026-11-11).

## 1. Problema (medido 2026-11-11)

| Fato | Número |
|---|---|
| Payload propagado, só `.md` | **219** arquivos (o PRD dizia 112 — omitia as 25 vendorizadas) |
| Linhas com termo de projeto/stack | **139** |
| Prescrições classificáveis | 91 → 43 `condicional`, 8 `exemplo`, 8 `catálogo`, **32 `incondicional`** |
| A-1 (termo em posição identitária) | **15 linhas / 12 arquivos** |
| O que o `V3` mede hoje | **2 literais** (`static-checks.mjs:317`) |
| Linhas acopladas que o repo já tolera em verde | **8.245** |

Consequência: o harness distribui instrução de stack de um cliente com o check verde. A rubrica resolve *o que conta* como acoplamento; o instrumento resolve *quem mede*.

## 2. Proposta

`lib/cdl/checks.mjs` (puro, propagável) que deriva população e vocabulário, classifica **linha a linha** nos 4 vereditos, e falha em 7 modos. Adapter `V20` no runner selado — **sem** comando novo (`commands.suiteFull` e selo intactos).

## 3. Escopo

Os 12 itens de interface do `ADR.md` §3.

## 4. Não-escopo

Corrigir as 32 linhas incondicionais (ADR-002/003/004/005 conforme o arquivo), as 2 rules de frontend (D1), as 30 proibições (D2 — contador), o catálogo/skills de stack (D8), as referências de A-3 (ADR-004).

## 5. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | Rubrica vira julgamento na hora da medição | predicado mecânico por veredito + ordem fixa + fixture por veredito |
| R2 | Baseline vira permissão | só encolhe (`cdl-baseline-stale`) + `owner` obrigatório por entrada |
| R3 | População não derivada ⇒ lista que nunca falha | população derivada dos exports + `cdl-population-payload-gap` |
| R4 | Selo republicado | zero comando novo em `suiteFull` |
| R5 | Falso positivo em TOC/descrição de check | 3 classes declaradas no ADR + `EXCEPTIONS` expiráveis |

## 6. Verificação

5 comandos + `PASS V20` com contadores; `git diff` de `harness.config.json`/`seal.mjs` vazio.
