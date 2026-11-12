# SPEC — prd-agnostic-artifacts-adr-001

> Prescritivo. Origem: `ADR-001` §3 (12 itens). Em conflito, o ADR prevalece. Tipo: governança com mecanismo.

## 1. Requisitos funcionais

- **RF-01 (itens 1, 2)** — `.opencode/plugins/lib/cdl/checks.mjs` puro (`node:fs`/`node:path`, `root` injetável), exportando `derivePopulation`, `classifyLine`, `declaredAxis`, `VOCAB`, `PROJECT_TERMS`, `EXCEPTIONS`, `BASELINE`, `runCdlChecks`; um `record("V20", …)` no runner selado.
- **RF-02 (item 3)** — população **derivada** dos exports do instalador; artefato propagado fora dos globs ⇒ `cdl-population-payload-gap`; `population=N/L` publicado no `detail`.
- **RF-03 (item 4)** — vocabulário derivado (`AXIS_IDS` ∪ tags de `stacks` do lock) = 10 ids; eixo novo sem vocabulário ⇒ `cdl-axis-vocabulary-missing`.
- **RF-04 (item 5)** — fonte de eixo **única** = export do instalador; `grep -c "V19"` no módulo = 0; divergência `axis-decl` × `axis-class` **publicada**, não falha.
- **RF-05 (item 6)** — 4 vereditos em ordem fixa (`condicional|exemplo|catálogo|incondicional`); `classifyLine` puro; artefato comum tem `declaredAxis = ∅` (não confere eixo).
- **RF-06 (item 7)** — `BASELINE` literal `{file,line,sha256,verdict,owner}`, **só encolhe**: entrada cuja linha mudou/fechou ⇒ `cdl-baseline-stale`.
- **RF-07 (item 8)** — `EXCEPTIONS` E-1..E-4 com `predicate`/`reason`/`proof`, **expiráveis**: predicate morto ⇒ `cdl-exception-stale`.
- **RF-08 (item 9)** — D2 contada: `prohibition-cited` publicado **em PASS** (não é FAIL).
- **RF-09 (item 10)** — A-3 reusa `V18` (`baseline=7, non-defect=1`); 2ª gramática publicada como `refs-undetected`, dono ADR-004.
- **RF-10 (item 11)** — A-1: registro `PROJECT_TERMS` + 2 alarmes estruturais (`license:` fora de SPDX; termo de stack fora do eixo declarado).
- **RF-11 (item 12)** — `.spec/**` fora do corpus; suíte verde; `commands.suiteFull` e `seal.mjs` byte-idênticos.
- **RF-12** — `cdl.spec.mjs`: 1 fixture por veredito, 2 de ordem, os 2 modos exigidos, fixture de preset novo.

## 2. Invariantes

- **I1** — o módulo não escreve; só lê árvore/exports e reporta.
- **I2** — população e vocabulário **derivados**; zero lista digitada à mão para o corpus.
- **I3** — baseline é dívida com dono e prazo, nunca permissão.
- **I4** — `V20` não substitui `V18`/`V19`; os três são ortogonais.
- **I5** — zero comando novo no `suiteFull` (selo é trust root).

## 3. Edge cases

- E1 — artefato comum (`RULES_COMMON`) prescrevendo stack ⇒ `incondicional`, mesmo citando stack que o harness usa.
- E2 — proibição citando tecnologia ⇒ **não** é A-2 (D2); conta em `prohibition-cited`.
- E3 — termo de projeto real (`TaskFlow`) ⇒ A-1, não A-2.
- E4 — mapa de eixo nomeando artefato ausente ⇒ `cdl-axis-declaration-phantom` (único FAIL permitido na divergência).
- E5 — TOC em seção normativa e descrição de check são FP declarados (3 classes), entram em `EXCEPTIONS`/baseline com dono.

## 4. Estratégia de teste

| Nível | Comando | Esperado |
|---|---|---|
| Unit (cdl) | `node --test ".opencode/plugins/__tests__/cdl.spec.mjs"` | 0 falhas, ≥12 casos |
| Plugins | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 0 falhas |
| Instalador | `node --test "installer/__tests__/*.spec.mjs"` | 559 pass |
| Static (V20) | `node scripts/static-checks.mjs` | exit 0 com `PASS V20` |
| SDD | `node scripts/sdd-checks.mjs` | 0 FAIL |

## 5. N/A declarado

Sem backend/frontend/DB/endpoint/auth: o entregável é medidor de prosa normativa.
