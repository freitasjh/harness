# PROPOSAL — prd-agnostic-artifacts-adr-005

> Ciclo SDD escopado do **ADR-005 do PRD-2** (frota restante) — **último ADR do PRD-2**.
> Fonte: `.spec/prd/prd-agnostic-artifacts/ADRs/ADR-005-frota-restante/ADR.md` (341 l., 12 itens, G2 aprovado 2026-11-16).

## 1. Problema (medido em `e297d82`)

| Fato | Número |
|---|---|
| `V20 identity` | **4/3** — `TaskFlow` em 3 linhas, `Pulse` em 1 |
| Corpo de skills de eixo | `nestjs:81` (Jest), `node:86` (Vitest) — termo de **outro** eixo |
| `spec-gate.md` | Flyway (`:13`) + JWT (`:8`) em checklist de aplicação geral |
| `security-review/SKILL.md:132` | prescreve `npm audit + Dependency-Check` num `exemplo`, **sem dono** |
| `.doc/**` citado | **9 linhas**, dono ADR-005 (herdado do ADR-004) |
| Proibições | **27** — permitidas por D2, mas precisam de predicado de expiração |
| `V18 baseline` / `V19 consumer` | 1 / 21 (devem ficar) |

## 2. Proposta

Aplicar FR0–FR5: reescrever identidades, condicionar corpos por eixo, dar dono ao resíduo de `security-review`, classificar as 9 linhas `.doc/**` **com dono antes de remover**, manter as 27 proibições e o catálogo/skills de stack com predicado de expiração. Nenhuma dívida é apagada para zerar contador.

## 3. Escopo

Os 12 itens de interface do `ADR.md` §3.

## 4. Não-escopo

PRD-3 (CLI Rust), PRD-4 (axes-split + reativação Java), PRD-5 (`DESIGN.md`), e os ADRs 001–004.

## 5. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | apagar identidades em vez de reescrever (`PROJECT_TERMS.proof` morre) | FR1 + re-apontar prova |
| R2 | tratar E-3 como isenção do corpo | FR2 mede `Jest∈node ⊄ {nestjs}` |
| R3 | zerar `refs-undetected` sem dono | FR5 exige dono por linha |
| R4 | `consumer` mudar ao "aproveitar" catálogo | item trava `skills=47 / consumer=21` |
| R5 | proibição convertida sem substituto positivo | RF-04 exige substituto |

## 6. Verificação

5 comandos + `V18=1`, `V19 consumer=21`, `V20 baseline≈0`, `identity=0/0`, `refs-undetected=0 com 9 donos`, selo intacto.
