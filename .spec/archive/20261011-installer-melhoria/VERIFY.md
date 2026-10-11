# VERIFY — installer-melhoria

> **Feature**: `installer-melhoria`
> **SPEC**: `.spec/backend/installer-melhoria/SPEC.md` (REQ-01..18, ADRs 011–014, §9.5, §10)
> **PLAN**: `.spec/backend/installer-melhoria/PLAN.md` (INS-01..INS-20, F1–F4)
> **TASKS**: `.spec/backend/installer-melhoria/TASKS.md` (20 tasks, 20/20 Done)
> **Assert**: `.agents/skills/sdd-compiler/asserts/verify-gate.md`
> **Data**: 2026-10-11 (re-verificação pós-G1/G2/G3)
> **Suite executada**: `harness.config.json` `commands.suiteFull` =
> `node --test ".opencode/plugins/__tests__/*.spec.mjs" && node --test "installer/__tests__/*.spec.mjs" && node scripts/static-checks.mjs && node scripts/vendor-skills.mjs --check`
> **Cobertura**: `.spec/backend/installer-melhoria/coverage.txt` (`--experimental-test-coverage`, include `installer/install.mjs`)

## Dimensão 1: Completeness (Completude) — ✅ PASS

- [x] **BDD cenários cobertos**: toda INS-01..20 tem Success + Failure + Edge em TASKS §4; specs correspondentes existem (`suite/checks/wizard/cli/qa.spec.mjs` + `doctor/mustfix-f1.spec.mjs`). INS-04 agora com bloco dedicado S1/S2/S3 em `suite.spec.mjs` (G2 fechado).
- [x] **Sem TODOs**: `grep TODO|FIXME|HACK installer/` retorna zero.
- [x] **Sem tasks puladas sem justificativa**: nenhuma marcada "N/A"; PLAN §9 N/A de eventos justificado (SPEC §6 sem mensageria).
- [x] **Tasks 100%**: `TASKS.md` §2 Sprint Summary marca as 20 linhas `INS-01..INS-20` como `Done`; todos os `Implementation Steps` / `DoD` com `- [x]`; zero `- [ ]` restante (G1 fechado).
- [x] **Sem tasks puladas (forma)**: nenhuma task em `Todo`.

**Gaps D1**: nenhum.

## Dimensão 2: Correctness (Correção) — ✅ PASS

- [x] **Build limpo**: suiteFull exit 0. Estáticos `static-checks.mjs` PASS (V6, V6b, V2, V3, V7, V15, V14); `vendor-skills.mjs --check` OK.
- [x] **Testes passando**: plugins **135/135 pass, 0 fail, 0 skip**; installer **358/358 pass, 0 fail, 0 skip** (355 baseline + 3 novos INS-04 S1/S2/S3). Zero `describe.skip/it.skip/test.skip` em `installer/__tests__/`.
- [x] **Requisitos funcionais com correspondência verificável no código** (18/18 com código, 18/18 com teste dedicado pleno):
  | REQ | Task | Evidência código | Evidência teste |
  |---|---|---|---|
  | REQ-01 menu 5 itens | INS-07 | `installer/install.mjs` (`WIZARD_MENU` 5 entradas `App Flutter/Pacote Dart/Projeto Node.js/Projeto Java + Vue/Outro`) | `wizard.spec.mjs` INS-07 (5 itens, ≠4, hint q) ✅ |
  | REQ-02 sem nova key | INS-08 | `STACK_VALUES`/`STACK_PROFILES` intactos + `validateAnswer` aceita `node-esm` | `wizard.spec.mjs` INS-08 + `golden.spec.mjs` verde sem alteração ✅ |
  | REQ-03 detect soberano | INS-09 | `detect` + guard W2m + default W3 | `wizard.spec.mjs` INS-09 (pubspec→skip, default flutter) ✅ |
  | REQ-04 inválida repete | INS-10 | `install.mjs` (fora de `[1,5]` repete, `q`→USER_ABORT) | `wizard.spec.mjs` INS-10 (`7`→bloco, gerador inválido, `q` 0 writes) ✅ |
  | REQ-05 bloco 4-linhas | INS-01 | `formatError` + call sites | `suite.spec.mjs` INS-01 S1/S2/S3 ✅ |
  | REQ-06 checks 4-linhas | INS-02 | `runChecks` blocos + `onde ver` | `checks.spec.mjs` INS-02 S1/S2/S3 ✅ |
  | REQ-07 dry-run | INS-03 | `dryRunNotice` (`NÃO EXECUTADO`), `passed:null`, sem backup | `suite.spec.mjs` INS-03 S1/S2/S3 + unidade ✅ |
  | REQ-08 pico-fim | INS-04 | `runWizard` (`[OK] W0: pico-fim`, `[OK] apply: pico-fim`, `[OK] checks: pico-fim` condicional) + `runInit` (mesmos 3 + `[OK] init: pico-fim`); falha nunca marca, dry-run nunca marca apply | `suite.spec.mjs` INS-04 S1 (verdes marcam os 3) / S2 (FAIL sem marca + `[ERRO]`) / S3 (dry-run sem apply + `NÃO EXECUTADO`) ✅ (G2 fechado) |
  | REQ-09 init W0–W7 | INS-14 | entrypoint `init`, `runInit`/`runWizard` | `wizard.spec.mjs` INS-14 (limpo instala exit 0, pre-flight aborta, NO_STDIN) ✅ |
  | REQ-10 gate create-only | INS-15 | gate `assertCreateOnly` | `wizard.spec.mjs` INS-15 (só-create passa, merge/flag abortam citando doctor) ✅ |
  | REQ-11 contador + q | INS-16 | prompts `[i/N]` + `isAbortToken`/`ABORT_TOKENS` | `wizard.spec.mjs` INS-16 (sequencial, `q`→USER_ABORT, sinônimos, hint) ✅ |
  | REQ-12 doctor D0–D6 | INS-11 | `runDoctor` D0..D6 | `doctor.spec.mjs`/`cli.spec.mjs` INS-11 (flag divergente exit 1, ordem D0..D6, limpo noop exit 0) ✅ |
  | REQ-13 zero writes | INS-12 | caminho doctor sem `applyMerge`/`writeManifest`/`apply` | `doctor.spec.mjs` INS-12 (fs-mock 0 writes, scan estático, mtime) ✅ |
  | REQ-14/R1 segredos | INS-05 | `sanitizeLog(line, answers)` + call sites corrigidos | `qa.spec.mjs` INS-05 S1/S2/S3 + `mustfix-f1.spec.mjs` MUSTFIX-1/2/3 ✅ |
  | REQ-15/M1 answers-file | INS-17 | `loadAnswersFile` rejeita não-objeto, `serializeAnswers` sem token | `qa.spec.mjs` INS-17 S1/S2/S3 ✅ |
  | REQ-16/M2 sem eco | INS-18 | `readSecretPrompt`/`readSecretRaw`, readline recriado | `qa.spec.mjs` INS-18 (pipe + wizard máscara) + `preflight/cli` FU-27 ✅ |
  | REQ-17/R3 backup-dir | INS-13 | `resolveBackupDir` absoluto + `BACKUP_FAIL` | `doctor.spec.mjs`/`cli.spec.mjs` INS-13 (igual→FAIL, sem bypass, relativo/symlink) ✅ |
  | REQ-18/R4 ANSI | INS-06 | strip ANSI/controles em `sanitizeLog` + `out()` | `qa.spec.mjs` INS-06 S1/S2/S3 + ordem strip-then-redact ✅ |
  | §9.5 contrato CLI | INS-19 | `parseArgs` (`CLI_COMMANDS init|doctor`), `printUsage` 2 entrypoints, exits | `cli.spec.mjs` INS-19 (dispatch, help exit 0, sem target exit 1, doctor ignora dry-run/yes) ✅ |
  | §10 barra | INS-20 | suite + estáticos + V15 + cobertura | suiteFull verde + `coverage.txt` funcs 96.21% ✅ (G3 fechado) |
- [x] **RBAC correto**: N/A declarado e correto — CLI local sem IAM (SPEC §3); sem `@HasPermission` por construção. Nada a testar.
- [x] **Multi-tenancy**: N/A declarado e correto — CLI single-target, `infra.ports: null`; substituído por invariantes I-01..I-06 com testes dedicados (I-01 golden, I-04 zero-writes, R1 canário).
- [x] **Cobertura mínima**: `install.mjs` **funcs 96.21% ≥ 90%** (lines 91.73%, branch 83.29%), relatório em `coverage.txt` (G3 fechado). Funções SPEC §10 tocadas: `formatError`, `assertCreateOnly`, `runDoctor`, `serializeAnswers`, `sanitizeLog`, `resolveBackupDir`, `loadAnswersFile`, `readSecretPrompt` — todas com specs dedicados verdes.

**Gaps D2**: nenhum.

## Dimensão 3: Coherence (Coerência) — ✅ PASS (com nota)

- [x] **ADRs refletidos**:
  - ADR-011 (menu produto, sem nova key): `WIZARD_MENU` 5 itens + `STACK_VALUES`/`STACK_PROFILES` intactos (golden verde) ✅
  - ADR-012 (erro 4-linhas + dry-run + pico-fim): `formatError` em todos os call sites, `dryRunNotice` `NÃO EXECUTADO`, `passed:null` (FU-28), pico-fim por etapa W0/apply/checks + `init` ✅ (ressalva G2 resolvida: granularidade por etapa implementada e testada S1/S2/S3)
  - ADR-013 (init create-only + contador + q): entrypoint `init`, gate pós-W4 citando doctor, `[i/N]` + `(q cancela)` ✅
  - ADR-014 (doctor read-only D0–D6, 7 passos, zero writes): `runDoctor` D0..D6, scan estático + fs-mock 0 writes ✅
- [x] **Sem vazamento de camada**: CLI single-file zero-dep, sem módulos `api/impl/public` (N/A justificado SPEC §2); funções puras exportadas testadas direto. Nenhum `impl→impl`.
- [x] **Naming conventions**: classes/funções/variáveis seguem o padrão do arquivo (verbos `run*/resolve*/assert*`, códigos `BAD_ANSWER|CORRUPT|NO_STDIN|USER_ABORT|BACKUP_FAIL|flagged-open|literal-denied`); sem Lombok (N/A Node, grep confirma zero `pkill -f` real — só menções em comentários + assert negativo em `generate.spec.mjs`).
- [x] **Frontend DevTools**: N/A — repo sem frontend Vue (`harness.config.json` `stack.frontend: N/A`); nada a checar.

**Notas D3**:
- N1: `doctor.spec.mjs` e `mustfix-f1.spec.mjs` untracked no git — funcionam e passam; `git add` no archive.
- N2: `.spec/backend/` untracked — SPEC/PLAN/TASKS/JIRA_BOARD + este VERIFY + `coverage.txt` fora do índice. Archive deve incluir o commit.

## Resultado Final

```
VERIFY STATUS: PASS ✅

Gaps fechados nesta re-verificação:
- G1 (D1): TASKS.md 20/20 Done, zero checkboxes desmarcados.
- G2 (D2): REQ-08/INS-04 com marcadores por etapa (W0/apply/checks) + bloco describe INS-04 S1/S2/S3 verde.
- G3 (D2): coverage.txt anexado — funcs 96.21% (≥90%), lines 91.73%.

Evidências:
- Suite completa verde: plugins 135/135 + installer 358/358 + static-checks PASS + vendor-check OK, 0 falhas, 0 skips.
- Zero TODOs/FIXME/HACK; zero `pkill -f` real; zero `sanitizeLog(` sem contexto; V15 rede-zero confirmado.
- 18/18 REQs com teste dedicado pleno; RBAC/multi-tenancy N/A corretamente declarados e testados via invariantes.
- Coerência aprovada (ADRs 011–014 visíveis no código); pendências N1/N2 são de git, não de código.
```
