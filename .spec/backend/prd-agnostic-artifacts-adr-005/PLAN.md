# PLAN — prd-agnostic-artifacts-adr-005

> Execução do ADR-005 na branch `adr/prd-agnostic-artifacts/05-frota-restante` (base `ac20a2a`).

## 1. Fases

### Fase 1 — Identidades (RF-01)
1. FR1: reescrever 3 linhas `TaskFlow` (`developer-engineer/AGENT.md:1,25`, `ux-designer/AGENT.md:32`) e 1 `Pulse` (`design-system-specialist/AGENT.md:42`) como escopo do destino.
2. Re-apontar `PROJECT_TERMS` para linhas vivas; `identity 4/3 → 0/0`.

### Fase 2 — Corpos e checklist (RF-02, RF-03)
3. FR2: condicionar `nestjs:81` (Jest) e `node:86` (Vitest) com gate no início da linha.
4. FR3: `spec-gate.md` — Flyway → "Flyway ou Liquibase", JWT → vocabulário neutro; checklist preservado.
5. FR4: `security-review/SKILL.md:132` ganha dono explícito (sem mudarveredito `exemplo`).

### Fase 3 — .doc e exceções (RF-05, RF-06)
6. FR5: classificar 9 linhas `.doc/**` com dono **por linha** antes de remover; `refs-undetected 9 → 0` com rastro.
7. D2/D8/E-3: 27 proibições e catálogo/6 skills mantidos; predicado de expiração vivo; `consumer=21`.

### Fase 4 — Contadores e verificação (RF-07..RF-09)
8. Re-derivar `V20 baseline 38 → ~0` e `V18=1`; 5 comandos; selo intacto.

## 2. Constraint mapping

| Constraint | Onde |
|---|---|
| Exceção com predicado (I1) | Fase 3 |
| E-3 não cobre corpo (I2) | Fase 2 item 3 |
| Dívida se converte (I3) | Fases 1-3 |
| Dono antes de remover (I4) | Fase 3 item 6 |
| Zero comando novo (I5) | Fase 4 |

## 3. Caminho crítico

`F1 → F3 → F4` — reescrever identidade sem re-apontar prova derruba `cdl-identity-term-stale`.

## 4. Rollback

`git reset --hard ac20a2a`.
