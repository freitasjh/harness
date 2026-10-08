# Verify — harness-installer-mobile

- **Skill:** `sdd-compiler` modo `verify` · **Data:** 2026-10-08
- **SPEC:** `.spec/governance/harness-installer-mobile/SPEC.md` (94%)
- **TASKS:** 14/14 DONE · **Contraprova:** plugins 104/104 · installer 162/162 · static PASS · dogfood mobile PASS

## 1. Completeness ✅
- Todas as **14 tasks** do backlog marcadas DONE no `JIRA_BOARD.md` (IM-BE-01..07, IM-VAL-01..06, IM-DOC-01).
- Zero `TODO`/`FIXME` nos arquivos entregues (`install.mjs`, `vendor-skills.mjs`, `dogfood-mobile.mjs`).
- RF-11..17 cobertos (ver §4 Traceability).
- Side-quest FU-32 (canary) fechada; FU-29/33/34..38 registradas como follow-up (não bloqueiam).

## 2. Correctness ✅
- `commands.suiteFull` → **104/104** (0 fail/skip). `installer/__tests__` → **162/162**.
- `static-checks.mjs` → PASS (V15 rede installer=0).
- Dogfood mobile: config gerado `mcp ['marionette_mcp','dart']`, `commands {flutter test, dart analyze}`, `moduleMap {lib,test}`; `checks.passed:true`; reinstall aborta (`REINSTALL`); origem intocada; cópia removida.
- Golden retrocompat (I7): node/node-esm/java+vue/outra byte-idênticos ao baseline.
- Requisitos SPEC cobertos (RF-11..17).

## 3. Coherence ✅
- **ADR-008** (profiles dirigidos por dados): `STACK_PROFILES` + `profileOf`; `generateConfig` PURO (zero I/O — `generate.spec` guard + inspeção).
- **ADR-009** (vendor por stack): `vendor-skills.mjs` byte-idêntico + `.vendor-lock.json` + `--check`; `collectIncoming({stacks})` filtra; lock nunca copiado.
- **ADR-010** (wizard sem autoridade): `runWizard` não escreve/não gera config; W6/W7 delegados ao `main`; I11 verificado.
- Sem vazamento de camada: `vendor-skills.mjs` é source-side; `install.mjs` só lê o lock.
- Naming/estrutura consistentes com o instalador v1.

## 4. Traceability (pré-archive)

| RF/Invariante | Task(s) | Código | Teste | ✅ |
|---|---|---|---|---|
| RF-11 validateAnswer flutter/dart | IM-BE-02 | `install.mjs` validateAnswer | mobile.spec | ✅ |
| RF-12 generateConfig profiles | IM-BE-01 | `install.mjs` STACK_PROFILES | golden.spec | ✅ |
| RF-13 vendor + --check | IM-BE-05, IM-VAL-02 | `vendor-skills.mjs` | vendor.spec | ✅ |
| RF-14 collectIncoming filtro | IM-BE-03 | `install.mjs` | mobile.spec | ✅ |
| RF-15 wizard B2 | IM-BE-07, IM-VAL-05 | `install.mjs` runWizard | wizard.spec | ✅ |
| RF-16 merge mcp | IM-BE-04 | `install.mjs` mergeOpencodeJson | merge-manifest.spec | ✅ |
| RF-17 SKILL doc | IM-DOC-01 | `SKILL.md` | docs.spec | ✅ |
| I7 golden retrocompat | IM-VAL-01 | — | golden.spec | ✅ |
| I8 rede-zero | IM-BE-05 | — | network.spec / V15 | ✅ |
| I9 vendor drift | IM-BE-05 | `vendor-skills.mjs` | vendor.spec | ✅ (CI wiring = FU-29) |
| I10 filtro | IM-BE-03 | `install.mjs` | mobile.spec | ✅ |
| I11 wizard sem autoridade | IM-BE-07 | `install.mjs` | wizard.spec | ✅ |

**Score: 12/12 (100%)** — ≥80% ✅ (gate de traceability passa).

## 5. Veredito

| Dimensão | Status |
|---|---|
| Completude | ✅ |
| Corretude | ✅ |
| Coerência | ✅ |

**APPROVED** — archive permitido. Ressalvas não-bloqueantes: FU-29 (I9 CI wiring), FU-33..38 (cleanups/hardening), commit de protected paths (trailer `Harness-Gate-Change`).
