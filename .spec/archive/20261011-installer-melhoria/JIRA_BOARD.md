# JIRA_BOARD — installer-melhoria (EPIC CLI)

> **EPIC**: `INS-CLI` — installer-melhoria (Melhoria, single-file CLI, sem FE/BE separados)
> **Fontes**: `.spec/backend/installer-melhoria/PLAN.md` (INS-01..20, F1→F4) + `.spec/backend/installer-melhoria/TASKS.md`
> **PM APROVADO com ajustes aplicados**: INS-04 fora do gate F1 (P1 paralelo) · F4 em 3 sub-gates (F4a/F4b/F4c) · INS-04/09/16 paralelizáveis
> **Regra**: 1 microtask = 1 trecho `installer/install.mjs` + 1 spec. Microtask sem arquivo-alvo = defeito. Gate sem evidência = defeito.
> **Escopo**: só board + relatório gates. Sem código, sem alteração PLAN/TASKS.

## EPIC

| Campo | Valor |
|---|---|
| Key | INS-CLI |
| Tipo | Melhoria (EPIC CLI único — tudo `installer/install.mjs`, camada Application CLI) |
| Fases | F1 erro+higiene → F2 menu → F3 doctor → F4a init → F4b answers → F4c CLI → transversal |
| Gate F1 | INS-CLI-01, 02, 03, 05, 06 (INS-04 FORA do gate — P1 paralelo, PM) |
| Gate F2 | INS-CLI-07, 08, 09, 10 |
| Gate F3 | INS-CLI-11, 12, 13 |
| Sub-gate F4a (init) | INS-CLI-14, 15, 16 |
| Sub-gate F4b (answers) | INS-CLI-17, 18 |
| Sub-gate F4c (CLI) | INS-CLI-19 |
| Transversal | INS-CLI-20 (suite verde + barra §10) |

## Board — microtasks atômicas

| Key | PLAN/TASKS | Arquivo-alvo (trecho) | Spec (TDD FIRST) | Dep | Paralela | Status |
|---|---|---|---|---|---|---|
| INS-CLI-01 | INS-01 `formatError` 4-linhas (REQ-05) | `installer/install.mjs` âncora `howToFix` :1236-1244, call sites :1263,:1266,:1303,:1345-1346,:477,:483,:687-698 | `installer/__tests__/suite.spec.mjs` | — | No | Todo |
| INS-CLI-02 | INS-02 `runChecks` blocos 4-linhas (REQ-06) | `installer/install.mjs` :666-701 (`failed[]` :669-698) | `installer/__tests__/checks.spec.mjs` | INS-CLI-01 | No | Todo |
| INS-CLI-03 | INS-03 dry-run `NÃO EXECUTADO` (REQ-07) | `installer/install.mjs` :507-513 + W5/W6/W7 :1364-1375 | `installer/__tests__/suite.spec.mjs` | INS-CLI-02 | No | Todo |
| INS-CLI-04 | INS-04 pico-fim por etapa (REQ-08) | `installer/install.mjs` :1274,:1342,:1383-1385 | `installer/__tests__/suite.spec.mjs` | INS-CLI-03 | **Yes** (PM) | Todo |
| INS-CLI-05 | INS-05 R1 `sanitizeLog` com answers (REQ-14/H1) | `installer/install.mjs` :715-723 + call sites :1091,:1345,:1408 (defeito :1408 sem 2º arg) | `installer/__tests__/qa.spec.mjs` (canário) | INS-CLI-03 | No | Todo |
| INS-CLI-06 | INS-06 R4 strip ANSI/controle (REQ-18/M4) | `installer/install.mjs` :715-723 + `out()` :1303,:1345-1346 | `installer/__tests__/qa.spec.mjs` | INS-CLI-05 | No | Todo |
| INS-CLI-07 | INS-07 W2m 5 itens produto (REQ-01) | `installer/install.mjs` :1157-1162 + bloco W2m :1294-1305 | `installer/__tests__/wizard.spec.mjs` (update :131-142) | INS-CLI-06 | No | Todo |
| INS-CLI-08 | INS-08 mapa item→stack sem nova key (REQ-02) | `installer/install.mjs` :245 + :190-239 + `validateAnswer` :277-281 | `installer/__tests__/wizard.spec.mjs` + `golden.spec.mjs` intacto | INS-CLI-07 | No | Todo |
| INS-CLI-09 | INS-09 `detect()` soberano (REQ-03) | `installer/install.mjs` :1171-1222 + default W3 :1307-1314 + guard :1296 | `installer/__tests__/wizard.spec.mjs` | INS-CLI-08 | **Yes** (PM) | Todo |
| INS-CLI-10 | INS-10 inválida repete `[1,5]` (REQ-04) | `installer/install.mjs` :1299-1304 | `installer/__tests__/wizard.spec.mjs` | INS-CLI-09 | No | Todo |
| INS-CLI-11 | INS-11 `doctor` D0–D6 7 passos (REQ-12) | `installer/install.mjs` entrypoint doctor (D0 :1272-1274, D1 :1276-1281, D2 :1171-1222, D3 :1354-1357, D4 :660-701, D5 `.harness-install.json`, D6 relatório) | `installer/__tests__/cli.spec.mjs` | INS-CLI-10 | No | Todo |
| INS-CLI-12 | INS-12 zero writes por construção (REQ-13) | ausência `applyMerge` :507-545 + `writeManifest` :705-711 + `apply` :1371-1386 no caminho doctor | `installer/__tests__/cli.spec.mjs` (fs-mock + scan) | INS-CLI-11 | No | Todo |
| INS-CLI-13 | INS-13 R3 `--backup-dir` validado (REQ-17/M3) | `installer/install.mjs` :135-144 + `parseArgs` :909-926 | `installer/__tests__/cli.spec.mjs` | INS-CLI-12 | No | Todo |
| INS-CLI-14 | INS-14 `init` W0–W7 (REQ-09) | `installer/install.mjs` entrypoint `init` W0 :1272-1274 → W7 :1381-1386 via `planMerge` :457-505 | `installer/__tests__/wizard.spec.mjs` | INS-CLI-13 | No | Todo |
| INS-CLI-15 | INS-15 gate create-only pós-W4 (REQ-10) | `installer/install.mjs` gate sobre `planMerge` ações :465-502 | `installer/__tests__/wizard.spec.mjs` (brownfield-abort) | INS-CLI-14 | No | Todo |
| INS-CLI-16 | INS-16 contador `[i/total]` + `q` (REQ-11) | `installer/install.mjs` prompts W3 (`QUESTIONS` :150-181, leitura :1259-1269, `ABORT_TOKENS` :1155) | `installer/__tests__/wizard.spec.mjs` | INS-CLI-15 | **Yes** (PM) | Todo |
| INS-CLI-17 | INS-17 `--answers-file` validado (REQ-15/M1) | `installer/install.mjs` :926-937 + `serializeAnswers` :333-340 | `installer/__tests__/qa.spec.mjs` | INS-CLI-16 | No | Todo |
| INS-CLI-18 | INS-18 segredo sem eco TTY (REQ-16/M2) | `installer/install.mjs` :977-1029 + fallback :1030-1070 + readline :1073-1080,:1328-1334 | `installer/__tests__/qa.spec.mjs` | INS-CLI-17 | No | Todo |
| INS-CLI-19 | INS-19 contrato CLI §9.5 init/doctor | `installer/install.mjs` :909-926 + `printUsage` :1393-1396 + NO_STDIN :1263,:1449-1452, dry-run sem writes :783-787 | `installer/__tests__/cli.spec.mjs` | INS-CLI-18 | No | Todo |
| INS-CLI-20 | INS-20 suite verde + barra §10 | `installer/__tests__/` + `scripts/static-checks.mjs` + `harness.config.json` suiteFull (consolidação, sem código novo) | suiteFull `node --test installer/__tests__/` | INS-CLI-19 | No | Todo |

**Notas de atomicidade**: cada linha altera no máximo 1 trecho `install.mjs` + 1 spec (INS-08 cita `golden.spec.mjs` só como invariante verde-intacto, sem edição). Nenhuma microtask mistura camadas — tudo CLI. Nenhuma implementa código nesta demanda (board only).

## Relatório de gates — plan-gate + tasks-gate (pass/fail por item, com evidência)

### plan-gate (`.agents/skills/sdd-compiler/asserts/plan-gate.md`)

| # | Item | Veredito | Evidência |
|---|---|---|---|
| P1 | Traceability 1:1 — cada REQ SPEC em ≥1 task PLAN | **PASS** | PLAN §8 cobre REQ-01..18: 01→INS-07, 02→08, 03→09, 04→10, 05→01, 06→02, 07→03, 08→04, 09→14, 10→15, 11→16, 12→11, 13→12, 14→05, 15→17, 16→18, 17→13, 18→06; §9.5→INS-19; §10→INS-20 (PLAN §10 self-check + SPEC matriz §11) |
| P2 | Constraint Mapping (Constraint→Enforcement→Failure Mode) | **PASS** | PLAN §3 tabela 11 linhas com Enforcement Point `arquivo:linha` + Failure Mode por REQ/ADR |
| P3 | Infra Bootstrap First | **PASS** | F1 (`formatError`/`sanitizeLog` INS-01..06) precede menu/doctor/init (PLAN §6, §10) |
| P4 | Execution Graph respeita camadas | **PASS** | F1→F2→F3→F4 linear, tudo Application CLI single-file (PLAN §6+§8); sem camadas Java/FE |
| P5 | Critical Execution Path (só core) | **PASS** | PLAN §7: INS-01→07→11→12→14→15→19→20, sem fluxos secundários |
| P6 | 4-Task Event Lifecycle ou N/A justificado | **PASS** | PLAN §9 N/A justificado (SPEC §6 sem eventos/mensageria), tabela N/A explícita |
| P7 | Mandatory Testing Tasks (isolamento) | **PASS** | R1→INS-05, R3→INS-13, R4→INS-06, I-04→INS-12, I-01→INS-08, cada um com spec dedicado (PLAN §10) |
| P8 | Failure Mode Testing | **PASS** | Toda INS-01..20 tem Enforcement + Failure Mode em PLAN §8; detalhe BDD no TASKS |
| P9 | Idempotency Validation | **PASS** | dry-run `passed:null` (INS-03), abort sem writes (INS-15/16), doctor read-only idempotente (INS-11/12) — PLAN §10 self-check |

**plan-gate: 9/9 PASS.**

### tasks-gate (`.agents/skills/sdd-compiler/asserts/tasks-gate.md`)

| # | Item | Veredito | Evidência |
|---|---|---|---|
| T1 | Traceability 1:1 — todos Task IDs PLAN presentes em TASKS | **PASS** | TASKS §2 + §4 cobre INS-01..20 1:1; §5 valida mapeamento REQ→INS + PLAN §8 |
| T2 | Metadata Enrichment (Priority/Risk/Type/Dep) | **PASS** | TASKS §2 tabela com Type+Priority+Risk por INS; §4 cada task com Priority/Risk/Parallelizable/Dep/Dep-Type/Layer |
| T3 | Layer-to-Folder Mapping (paths físicos + convenções) | **PASS** | Toda task §4 cita `installer/install.mjs:linha` + `installer/__tests__/*.spec.mjs`; arquivos existem (ex. `install.mjs` 1492 linhas, specs `suite/checks/wizard/cli/qa/golden` presentes) |
| T4 | BDD Scenarios (Sucesso + Falha + Borda) | **PASS** | Toda INS-01..20 tem Scenario 1 Success + 2 Failure Mode + 3 Edge (TASKS §4) |
| T5 | TDD Order (teste ANTES da implementação) | **PASS** | Todo `Implementation Steps` lista `*.spec.mjs` TDD FIRST antes de `install.mjs`; INS-20 consolida (TASKS §4) |
| T6 | Granularidade (atômica, <2h) | **PASS** | 20 tasks 1 trecho + 1 spec, Complexity 1..5 (maioria 2-3; 11/14 = 5 por D0–D6/W0–W7 fim-a-fim, ainda 1 entrypoint cada) — TASKS §2 |
| T7 | Mermaid Graph sem ciclos/órfãs | **PASS** | TASKS §3 linear F1→F4 + transversal, sem ciclos; §5 `No circular / No orphan` checked |
| T8 | Consistency Check (sem macro-task inventada) | **PASS** | 20 INS idênticos PLAN §8 ↔ TASKS §4; sem task extra; Delta docs fora do TDD por decisão registrada (TASKS §6) |
| T9 | DoD per Task | **PASS** | Toda task tem DoD 4 itens (teste antes, diretório exato, failure coberto, no TODOs) — TASKS §4 |

**tasks-gate: 9/9 PASS.**

### Divergências intencionais (PM APROVADO — não são fail)

| Ajuste PM | Reflexo no board |
|---|---|
| INS-04 fora do gate F1 | Gate F1 = 01,02,03,05,06; INS-CLI-04 (P1, complexity 1) roda em paralelo sem bloquear F1 |
| F4 em 3 sub-gates | F4a (14,15,16) / F4b (17,18) / F4c (19); cada sub-gate fecha antes do próximo |
| INS-04/09/16 paralelizáveis | Coluna Paralela = Yes só nesses 3; demais No (cadeia Hard) |

## Traceabilidade EPIC → PLAN → TASKS → código

| EPIC microtask | REQ | PLAN §8 | TASKS §4 | Código (não alterado nesta demanda) |
|---|---|---|---|---|
| INS-CLI-01..06 | REQ-05..08,14,18 | F1 | INS-01..06 | `install.mjs` :507-723,:1236-1244,:1274,:1303,:1342-1346,:1383-1385,:1408 + `suite/checks/qa.spec` |
| INS-CLI-07..10 | REQ-01..04 | F2 | INS-07..10 | `install.mjs` :190-281,:1155-1162,:1171-1222,:1294-1314 + `wizard/golden.spec` |
| INS-CLI-11..13 | REQ-12,13,17 | F3 | INS-11..13 | `install.mjs` :135-144,:507-545,:660-711,:909-926,:1272-1281,:1354-1357,:1371-1386 + `cli.spec` |
| INS-CLI-14..16 | REQ-09..11 | F4a | INS-14..16 | `install.mjs` :150-181,:457-505,:1155,:1246-1390 + `wizard.spec` |
| INS-CLI-17..18 | REQ-15,16 | F4b | INS-17..18 | `install.mjs` :333-340,:926-1080,:1328-1334 + `qa.spec` |
| INS-CLI-19 | §9.5 | F4c | INS-19 | `install.mjs` :783-787,:909-926,:1393-1396,:1449-1452 + `cli.spec` |
| INS-CLI-20 | §10 | Transversal | INS-20 | suiteFull + `static-checks.mjs` + V15 |

**Defeitos checados e ausentes**: nenhuma microtask sem arquivo-alvo; nenhum gate sem evidência acima; nenhuma mistura FE/BE; nenhum código implementado.
