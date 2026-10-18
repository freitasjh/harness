# JIRA_BOARD — harness-eixos-stack (EPIC EX)

> **EPIC**: `EX` — harness-eixos-stack (Refactor, instala­dor: registry com eixos + perfil react + gating por eixo + vendor)
> **Fontes**: `.spec/backend/harness-eixos-stack/PLAN.md` (EX-01..14) + `TASKS.md` (EX-BE/FE/VAL)
> **Camadas**: `BE` = módulo ESM (`installer/install.mjs`, `scripts/vendor-skills.mjs`) · `FE` = texto/CLI-tty e prosa canônica · `VAL` = validação (testes/E2E/pré-delega­ção)
> **Regra**: 1 microtask = 1 trecho de arquivo + 1 spec. Microtask sem arquivo-alvo = defeito. Gate sem evidência = defeito.
> **Escopo deste board**: rastreio. Sem código.

## EPIC

| Campo | Valor |
|---|---|
| Key | `EX` (EPIC refactor) |
| Tipo | Refactor de instala­dor (sem FE/BE de aplicação; "frontend" = texto do TTY) |
| Fases | P1 Foundation → P2 Gating → P3 Wizard → P4 Vendor → P5 Prosa/fechamento |
| Gate P1 | `EX-BE-01`, `EX-VAL-02`, `EX-BE-03` |
| Gate P2 | `EX-BE-04`, `EX-BE-05`, `EX-VAL-06` |
| Gate P3 | `EX-FE-07`, `EX-FE-08`, `EX-VAL-09` |
| Gate P4 | `EX-BE-10`, `EX-BE-11`, `EX-VAL-12` |
| Transversal | `EX-FE-13` (prosa) + `EX-VAL-14` (suíte/dry-run/brain) |
| Caminho crítico | `EX-BE-01` → `EX-VAL-02` → `EX-BE-03` → `EX-BE-04` → `EX-BE-05` → `EX-VAL-06` → `EX-FE-07` → `EX-FE-08` → `EX-VAL-09` → `EX-VAL-14` |
| Bloqueio externo | **FU-48**: clone dos upstreams (passo de `EX-BE-10`) |

## Board — microtasks atômicas

| Key | PLAN/TASKS | Arquivo-alvo (trecho) | Spec (TDD FIRST) | Dep | Paralela | Status |
|---|---|---|---|---|---|---|
| EX-BE-01 | EX-01 `axes` + `stacksFor` no registry (RF-01/D-1) | `installer/install.mjs` `STACK_PROFILES` :209-258 + `stacksFor` | `installer/__tests__/golden.spec.mjs` | — | No | **Done** |
| EX-VAL-02 | EX-02 testes do registry/eixo + oraculo literal por preset (RF-01/I2) | `installer/__tests__/golden.spec.mjs` + `generate.spec.mjs` + `eixos-stack.spec.mjs` | (mesmos) | EX-BE-01 | No | **Done** |
| EX-BE-03 | EX-03 preset `java+react` + default + prompt W3 (RF-02/RF-07/RF-14) | `installer/install.mjs` :209-258, :264, `defaultSuiteFor` :1560-1570, prompt :196, `howToFix` :1575 | `generate.spec.mjs` + `mobile.spec.mjs` + `wizard.spec.mjs` | EX-BE-01 | No | **Done** |
| EX-BE-04 | EX-04 `stacks` da origem; `inferStacks` fallback (RF-03/A1) | `scripts/vendor-skills.mjs` :284-288, :341 | `installer/__tests__/vendor.spec.mjs` | EX-BE-03 | No | **Done** |
| EX-BE-05 | EX-05 `RULES_BY_AXIS` (exclusao, par eixo=id) + `RULES_COMMON` + filtro (RF-04/A2) | `installer/install.mjs` `collectIncoming` + novos simbolos | `installer/__tests__/eixos-stack.spec.mjs` | EX-BE-04 | No | **Done** |
| EX-VAL-06 | EX-06 gating 2 direcoes + enumeracao recursiva/bidirecional + nao-regressao (RF-03/RF-04) | `installer/__tests__/eixos-stack.spec.mjs` | (mesmo) | EX-BE-05 | No | **Done** |
| EX-FE-07 | EX-07 range derivado (RF-05/A4) | `installer/install.mjs` bloco `W2m` (range/total derivados) | `installer/__tests__/wizard.spec.mjs` | EX-BE-03 | **Yes** | **Done** |
| EX-FE-08 | EX-08 `W2m` em 2 passos + erro 4 linhas (RF-06) | `installer/install.mjs` menu/`menuItemLine`/`askMenuStep` | `installer/__tests__/wizard.spec.mjs` | EX-FE-07 | No | **Done** |
| EX-VAL-09 | EX-09 testes de wizard escopados + `node-esm` + prompt W3 + FU-49 (RF-06/RF-14/I10) | `installer/__tests__/wizard.spec.mjs` | (mesmo) | EX-FE-08 | No | **Done** |
| EX-BE-10 | EX-10 clone pinado + `licenseOrigin` (RF-08/RF-10/RF-13) | `scripts/vendor-skills.mjs` (`SOURCE_LICENSES`, `writeVendor`, `checkVendor`) + `scripts/vendor/skills-lock.json` | `installer/__tests__/vendor.spec.mjs` | EX-VAL-06 | **Yes** | **Done** |
| EX-BE-11 | EX-11 vendorizar 2 skills + lock/NOTICE + `optional` (RF-08/RF-09) | `.agents/skills/.vendor-lock.json`, `VENDOR-NOTICE.md`, `LICENSE-*`, 2 dirs de skill | `installer/__tests__/vendor.spec.mjs` | EX-BE-10 | No | **Done** |
| EX-VAL-12 | EX-12 testes de vendor por origem (RF-10/A5) | `installer/__tests__/vendor.spec.mjs` (split por `licenseOrigin`) | (mesmo) | EX-BE-11 | No | **Done** |
| EX-FE-13 | EX-13 Delta Specs prosa↔mecanismo (RF-11) | `harness-installer/SKILL.md`, `harness-config.md`, `AGENTS.md` | `installer/__tests__/docs.spec.mjs` | EX-VAL-12 | **Yes** | Todo |
| EX-VAL-14 | EX-14 fechamento: suíte + dry-run + transcript + RF-12 (D-5/D-8) | `harness/harness-eixos-stack.json` + `.../harness/wizard-react-transcript.txt` + suíte selada | suíte completa | EX-FE-13, EX-VAL-09 | No | Todo |

## Batches de delegação (Fase 3 — cada batch exige aprovação humana)

| Batch | Tasks | Foco | Pré-condição | Status |
|---|---|---|---|---|
| 1 | `EX-BE-01`, `EX-VAL-02`, `EX-BE-03` | Foundation: eixos + preset react + prompt W3 | suíte verde (H2) | **Done** (review APPROVED, 0 🔴) |
| 2 | `EX-BE-04`, `EX-BE-05`, `EX-VAL-06` | Gating por eixo (A1/A2) | batch 1 revisado | **Done** (3 iteracoes; APPROVED, 0 🔴) |
| 3 | `EX-FE-07`, `EX-FE-08`, `EX-VAL-09` | Wizard/menu 2 passos | batch 1 (paralelo ao 2) | **Done** (2 iteracoes; APPROVED, 0 🔴, 0 🟡) |
| 4 | `EX-BE-10`, `EX-BE-11`, `EX-VAL-12` | Vendor + licença | **FU-48** (clones) + batch 2 | **Done** (2 iteracoes; APPROVED, 0 🔴, 0 🟡) |
| 5 | `EX-FE-13`, `EX-VAL-14` | Prosa + fechamento | batches 3 e 4 | Todo |
