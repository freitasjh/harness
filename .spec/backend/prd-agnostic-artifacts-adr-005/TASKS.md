# TASKS — prd-agnostic-artifacts-adr-005

> Execução do ADR-005 na branch `adr/prd-agnostic-artifacts/05-frota-restante` (base `ac20a2a`).

## Microtasks (TDD-ready)

### FT-01
- [x] FR1: reescrever 3 linhas `TaskFlow` e 1 `Pulse` como escopo do destino; `PROJECT_TERMS.proof` re-apontado (RF-01, E1).

### FT-02
- [x] `V20 identity 4/3 → 0/0` (RF-01).

### FT-03
- [x] FR2: condicionar corpo de `nestjs:81` (Jest) e `node:86` (Vitest) com gate no início; skills seguem no payload (RF-02, E2).

### FT-04
- [x] FR3: `spec-gate.md` Flyway → alternativa neutra, JWT → vocabulário neutro; checklist preservado (RF-03).

### FT-05
- [x] FR4: `security-review/SKILL.md:132` com dono explícito, sem virar prescrição (RF-04, E3).

### FT-06
- [x] D2: 27 proibições mantidas com predicado de expiração; nenhuma removida sem substituto positivo (RF-04).

### FT-07
- [x] D8/E-3: catálogo e 6 skills mantidos; `cdl-exception-stale` cobre nome e `V19 consumer=21` (RF-05).

### FT-08
- [x] FR5: 9 linhas `.doc/**` classificadas com dono **por linha** antes da remoção; `refs-undetected → 0` com rastro (RF-06, E4).

### FT-09
- [x] Re-derivar `V20 baseline → ~0`, `V18=1`; dívida convertida, nunca apagada (RF-07, RF-08).

### FT-10
- [x] Verificação final: 5 comandos exit 0; selo intacto; ledger 1:1 com 5 linhas; trailer `Harness-Gate-Change` (RF-09).

## Sumário de execução

| Task | Fase | Depende de |
|---|---|---|
| FT-01 | 1 | — |
| FT-02 | 1 | FT-01 |
| FT-03 | 2 | — |
| FT-04 | 2 | — |
| FT-05 | 2 | — |
| FT-06 | 3 | — |
| FT-07 | 3 | — |
| FT-08 | 3 | — |
| FT-09 | 4 | FT-01..FT-08 |
| FT-10 | 4 | FT-09 |
