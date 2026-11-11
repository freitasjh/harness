# PLAN — prd-agnostic-artifacts-adr-001

> Execução do ADR-001 na branch `adr/prd-agnostic-artifacts/01-criterio-cdl-e-instrumento` (base `9b754e5`).

## 1. Fases

### Fase 1 — Rubrica pura (RF-01, RF-04, RF-05, RF-10)
1. `lib/cdl/checks.mjs`: `classifyLine` (4 vereditos, ordem fixa), `declaredAxis` (lock → mapa de exclusão → nome da skill → ∅), `VOCAB` (10 ids), `PROJECT_TERMS`.
2. Fonte de eixo = **export do instalador** (import, como no `V19`); `grep -c "V19"` = 0; divergência publicada.

### Fase 2 — População derivada (RF-02, RF-03)
3. `derivePopulation`: globs sobre `git ls-files`, excluindo `.spec/**`, `__tests__/`, `ui-ux-pro-max/data/**`; conferir superset do payload derivado do instalador.

### Fase 3 — Baseline e exceções (RF-06, RF-07, RF-08)
4. `BASELINE` literal: 32 linhas `incondicional` + 15 de A-1, cada uma com `owner`; `sha256` da linha.
5. `EXCEPTIONS` E-1..E-4 com `predicate`/`proof` executável.
6. `prohibition-cited` como **contador** (D2), publicado em PASS.

### Fase 4 — Adapter e fixtures (RF-11, RF-12)
7. `scripts/static-checks.mjs`: `checkCdl` + **um** `record("V20")` com contadores em PASS e FAIL.
8. `cdl.spec.mjs`: 1 fixture por veredito, 2 de ordem, os 2 modos exigidos, preset novo.

### Fase 5 — Verificação (RF-09, RF-11)
9. 5 comandos; `git diff` de `harness.config.json`/`seal.mjs` vazio; `V18`/`V19` inalterados.

## 2. Constraint mapping

| Constraint | Onde |
|---|---|
| Módulo não escreve (I1) | Fase 1 |
| População/vocabulário derivados (I2) | Fase 2 |
| Baseline é dívida (I3) | Fase 3 |
| `V20` ortogonal (I4) | Fase 4 |
| Zero comando novo (I5) | Fase 4 |

## 3. Caminho crítico

`F1 → F2 → F4.7` — adapter antes da população derivada mede corpus errado e o baseline nasce mentindo.

## 4. Rollback

`git reset --hard 9b754e5`.
