# Implementation Plan: installer-melhoria

## 1. Context & SPEC Traceability
- **Target Specification**: `.spec/backend/installer-melhoria/SPEC.md`
- **Goal**: Compilar SPEC (REQ-01..18, ADRs 011-014, §9.5 CLI, §10 barra) em plano executavel sem pular requisito. Task sem teste ou sem arquivo-alvo conta como defeito.
- **Tipo de rota**: Melhoria. Sem stacks/profiles novos, sem medflow, sem `--fix`, sem i18n. So PLAN+TASKS nesta demanda (sem codigo).

### 1.1 SPEC Validation Report
- **Status**: Strictly Validated (SPEC §13 proposal-gate + spec-gate todos checked).
- **Identified Gaps/Warnings**: nenhum bloqueador. Notas:
  - Eventos/mensageria N/A (SPEC §6) — lifecycle 4-tasks dispensado com justificativa (§9).
  - Multi-tenancy N/A (CLI local single-target) — substituido por invariantes I-01..I-06 como constraints testaveis.
  - R1/R3/R4 (condicoes de teste desta demanda): R1 = sanitizeLog sempre com contexto answers (REQ-14/H1); R3 = `--backup-dir` validado (REQ-17/M3); R4 = strip ANSI/controle no display (REQ-18/M4). R2 = higiene shell (`lsof`+`kill`, nunca `pkill -f`) — transversal a toda execucao.
- **Assumptions Made**: nenhuma; SPEC traz `arquivo:linha` para todo requisito (matriz §11).

## 2. Technical Strategy
### 2.1 Backend Strategy
- **Framework**: Node ESM zero-dep CLI (`installer/install.mjs`, 1492 linhas). Sem camadas Java.
- **Architectural Pattern**: single-file CLI com funcoes puras exportadas (`generateConfig`, `planMerge`, `runChecks`, `detect`) testadas direto (SPEC §2).

### 2.2 Frontend Strategy
- N/A — repo sem frontend Vue (`harness.config.json` `stack.frontend: N/A`).

### 2.3 Infrastructure Strategy
- **Deployment Model**: N/A — CLI local single-target (`--target <dir>`).
- **CI/CD**: suite via `harness.config.json` `commands.suiteFull` (`node --test installer/__tests__/ + scripts/static-checks.mjs`); V15 confirma `install.mjs` rede-zero; zero `pkill -f`/Lombok/skip.

## 3. Architecture Realization & Constraint Mapping
| SPEC Reference | Constraint | Enforcement Point | Failure Mode | Implementation Strategy |
|---|---|---|---|---|
| ADR-011 / REQ-01..04 | menu 5 itens produto→stack, sem nova key (I-01) | `WIZARD_MENU` (`installer/install.mjs:1157-1162`) + bloco W2m (`installer/install.mjs:1294-1305`) | item extra/faltante; stack nova quebra golden | trocar 4 itens por 5 da tabela ADR-011; `STACK_VALUES` (`installer/install.mjs:245`) + `STACK_PROFILES` (`installer/install.mjs:190-239`) intactos; `node-esm` so W3/`validateAnswer` (`installer/install.mjs:277-281`) |
| ADR-012 / REQ-05..08 | erro 4-linhas + dry-run + pico-fim | `howToFix` (`installer/install.mjs:1236-1244`), `sanitizeLog` (`installer/install.mjs:715-723`), call sites (`installer/install.mjs:1263,1266,1303,1345-1346,477,483,687-698`), `runChecks` (`installer/install.mjs:666-701`) | bloco incompleto; dry-run executa; sucesso sem marcador | nova `formatError` 4-linhas reusada em todos os pontos; tokens legados preservados como substring; `passed:null` dry-run (SKILL §10/§11) |
| ADR-013 / REQ-09..11 | `init` greenfield create-only W0–W7 + contador + `q` | wizard (`installer/install.mjs:1246-1390`), `planMerge` (`installer/install.mjs:457-505`), `ABORT_TOKENS` (`installer/install.mjs:1155`) | merge/flag passa; prompt sem contador; `q` nao aborta | entrypoint `init` com gate pos-W4 (qualquer `merge\|flag` aborta indicando `doctor`); `[i/total]` + `(q cancela)` em todo prompt W3 |
| ADR-014 / REQ-12..13 | `doctor` brownfield read-only D0–D6, 7 passos, zero writes (I-04) | `inventory`/`detect`/`planMerge` seco/`runChecks`/scan (`installer/install.mjs:1276-1281,1171-1222,1354-1357,660-701`), proibidos `applyMerge` (`installer/install.mjs:507-545`) + `writeManifest` (`installer/install.mjs:705-711`) + `apply` (`installer/install.mjs:1371-1386`) | write acidental; passo faltante | caminho doctor sem importar os 3 writes; scan estatico + teste fs-mock zero-writes; relatorio D6 por camada |
| REQ-14 (R1/H1) | log sempre com contexto de segredos (I-06) | `sanitizeLog(line, answers)` (`installer/install.mjs:715-723`); defeito em `installer/install.mjs:1408` | canario `deployToken` em output | corrigir call site + auditar (`installer/install.mjs:1091,1345,1408`); teste canario em `qa.spec.mjs` |
| REQ-15 (M1) | `--answers-file` validado + segredo so-memoria | `loadAnswersFile` (`installer/install.mjs:926-937`), `serializeAnswers` (`installer/install.mjs:333-340`) | array/primitivo aceito; segredo serializado | rejeita nao-objeto com `BAD_ANSWER`; `serializeAnswers` nunca contem token; doc SKILL §10/§11 (`chmod 600`, nao commitar) |
| REQ-16 (M2) | prompt de segredo sem eco | `readSecretPrompt`/`readSecretRaw` (`installer/install.mjs:977-1029`), fallback nao-TTY (`installer/install.mjs:1030-1070`), readline (`installer/install.mjs:1073-1080,1328-1334`) | eco em TTY; token vaza p/ proxima pergunta | sem eco + mascara em TTY; fecha-e-recria readline apos segredo |
| REQ-17 (R3/M3) | `--backup-dir` validado | `resolveBackupDir` (`installer/install.mjs:135-144`), `parseArgs` (`installer/install.mjs:909-926`) | `backupDir === target` escreve sobre si | resolve absoluto + rejeita igualdade com `BACKUP_FAIL`; sem bypass |
| REQ-18 (R4/M4) | sanitize ANSI/controle no display | `sanitizeLog` (`installer/install.mjs:715-723`) + `out()` wizard (`installer/install.mjs:1303,1345-1346`) | escape `\x1b[2J` / `\r` executado no terminal | filtra ANSI + controles (exceto `\n\t`) antes de exibir, alem da redacao R1 |
| §9.5 CLI | contrato `init`/`doctor` argv/flags/exit/help | `parseArgs` (`installer/install.mjs:909-926`), `printUsage` (`installer/install.mjs:1393-1396`), preflight (`installer/install.mjs:1272-1274`) | flag novo; exit errado; doctor escreve | reuso sem flag novo; `0` sucesso/help, `1` abort; doctor ignora `--dry-run`/`--yes`; init dry-run nao cria nem backup (`installer/install.mjs:783-787`) |

## 4. Module & Code Structure
| Module Name | Responsibilities | Boundaries & Communication |
|---|---|---|
| `installer/install.mjs` | wizard, menu, erro, init, doctor, higiene segredos, CLI | funcoes puras exportadas; sem rede (V15); sem módulos `api/impl/public` |
| `installer/__tests__/` | `wizard|suite|checks|cli|qa.spec.mjs` (+ `golden|generate` intactos) | cada task TDD altera 1 spec + `install.mjs`; `golden`/`generate` nunca quebram |
| `.agents/skills/harness-installer/SKILL.md` | docs §7/§9.2/§10/§11 (Delta) | prosa acompanha codigo; fora do escopo de teste automatizado |

## 5. Risks & Complexity Analysis
- **🔥 CRITICAL RISK: segredo vaza em log (H1)** — Mitigation: R1 asserts canario em `qa.spec.mjs` (INS-05); `serializeAnswers` + manifesto sem token.
- **🔥 CRITICAL RISK: doctor escreve acidentalmente** — Mitigation: scan estatico + fs-mock zero-writes (INS-12); proibicao por construcao.
- **HIGH: menu quebra compat (4→5 itens)** — Mitigation: update `wizard.spec.mjs:131-142` no mesmo batch (INS-07); golden intacto I-01.
- **MED: erro 4-linhas quebra asserts legados** — Mitigation: tokens (`[ERRO]`, `como corrigir`, códigos) como substrings; `assert.match` (INS-01/02).
- **MED: init confundido com install** — Mitigation: gate create-only aborta indicando doctor (INS-15).
- **LOW: `pkill -f`/Lombok/skip** — Mitigation: grep nos estaticos (INS-20); encerramento `lsof`+`kill` por PID (R2).

## 6. Implementation Phases & Dependencies
### Phase F1: Erro padrao + higiene (REQ-05..08, REQ-14/R1, REQ-18/R4)
- **Dependencies**: None (fundacao — `formatError`/`sanitizeLog` precedem todo resto).
- **Scope**: INS-01..INS-06. `formatError` 4-linhas, checks 4-linhas, dry-run `NÃO EXECUTADO`, pico-fim, R1 contexto segredos, R4 ANSI strip.

### Phase F2: Menu produto 5 itens (REQ-01..04)
- **Dependencies**: F1 (erro 4-linhas pronto para REQ-04 reusar).
- **Scope**: INS-07..INS-10. 5 itens ADR-011, mapeamento stacks, `detect` soberano, invalida repete.

### Phase F3: Doctor read-only D0–D6 (REQ-12, REQ-13, REQ-17/R3)
- **Dependencies**: F2 (wizard inventário/deteccao estaveis).
- **Scope**: INS-11..INS-13. D0–D6 read-only, zero-writes por construcao, backup-dir validado.

### Phase F4: Init create-only + CLI + answers (REQ-09..11, REQ-15, REQ-16, §9.5)
- **Dependencies**: F3 (gate create-only reusa diagnostico do doctor na mensagem de abort).
- **Scope**: INS-14..INS-19. W0–W7, gate create-only, contador+`q`, answers-file, sem-eco, contrato CLI init/doctor.
- **Transversal**: INS-20 suite verde + estaticos (§10 barra).

## 7. Critical Execution Path
INS-01 (formatError) → INS-07 (menu 5 itens) → INS-11 (doctor D0–D6) → INS-12 (zero-writes) → INS-14 (init W0–W7) → INS-15 (gate create-only) → INS-19 (CLI) → INS-20 (suite verde)

## 8. Atomic Task Breakdown & Execution Graph
### CLI Tasks (F1 — Erro + higiene)
- **[INS-01]** [ ] `formatError` 4-linhas para todos os codigos
  - **Depends on**: None
  - **Layer**: Application (CLI)
  - **Artifact**: `formatError` em `installer/install.mjs` (ancora `howToFix` `installer/install.mjs:1236-1244`)
  - **Enforcement**: todo bloco tem 4 linhas; linha 2 cita codigo real (`BAD_ANSWER|CORRUPT|NO_STDIN|USER_ABORT|BACKUP_FAIL|flagged-open|literal-denied`); toda linha via `sanitizeLog`
  - **Constraint Ref**: REQ-05 / ADR-012
  - **Framework Detail**: Node `node:test` + `assert.match` em `installer/__tests__/suite.spec.mjs`
- **[INS-02]** [ ] `runChecks` emite `failed[]` em blocos 4-linhas
  - **Depends on**: INS-01
  - **Layer**: Application (CLI)
  - **Artifact**: `runChecks` (`installer/install.mjs:666-701`)
  - **Enforcement**: cada falha com `onde ver` (manifesto/target); `manifest-missing|config-missing|json-invalid|flagged-open|literal-denied`
  - **Constraint Ref**: REQ-06 / ADR-012
  - **Framework Detail**: `installer/__tests__/checks.spec.mjs`
- **[INS-03]** [ ] dry-run declara `NÃO EXECUTADO`, nunca PASS
  - **Depends on**: INS-02
  - **Layer**: Application (CLI)
  - **Artifact**: `applyMerge` dryRun (`installer/install.mjs:507-513`) + W5/W6/W7 (`installer/install.mjs:1364-1375`)
  - **Enforcement**: shape `passed:null`; W5 dispensada; W6/W7 nao-executados; mensagem `[INFO] dry-run: NÃO EXECUTADO`
  - **Constraint Ref**: REQ-07 / ADR-012
  - **Framework Detail**: `installer/__tests__/suite.spec.mjs`
- **[INS-04]** [ ] marcador pico-fim por etapa de sucesso
  - **Depends on**: INS-03
  - **Layer**: Application (CLI)
  - **Artifact**: `[OK]` (`installer/install.mjs:1274,1342,1383-1385`)
  - **Enforcement**: `[OK] <etapa>: pico-fim` em cada etapa verde
  - **Constraint Ref**: REQ-08 / ADR-012
  - **Framework Detail**: `installer/__tests__/suite.spec.mjs`
- **[INS-05]** [ ] R1: `sanitizeLog` sempre com contexto answers (H1)
  - **Depends on**: INS-04
  - **Layer**: Application (CLI)
  - **Artifact**: call sites `installer/install.mjs:715-723,1091,1345,1408`
  - **Enforcement**: nenhum log/say exibe `deployToken`; 2º arg `answers` obrigatorio
  - **Constraint Ref**: REQ-14 (R1)
  - **Framework Detail**: `installer/__tests__/qa.spec.mjs` (teste canario)
- **[INS-06]** [ ] R4: strip ANSI/controle no display (M4)
  - **Depends on**: INS-05
  - **Layer**: Application (CLI)
  - **Artifact**: `sanitizeLog` + `out()` (`installer/install.mjs:715-723,1303,1345-1346`)
  - **Enforcement**: `\x1b[...` e controles (exceto `\n\t`) removidos antes de exibir, alem de R1
  - **Constraint Ref**: REQ-18 (R4)
  - **Framework Detail**: `installer/__tests__/qa.spec.mjs`

### CLI Tasks (F2 — Menu)
- **[INS-07]** [ ] W2m 5 itens produto (§9.1)
  - **Depends on**: INS-06
  - **Layer**: Application (CLI)
  - **Artifact**: `WIZARD_MENU` (`installer/install.mjs:1157-1162`) + bloco W2m (`installer/install.mjs:1294-1305`)
  - **Enforcement**: exatamente 5 itens ADR-011; update `wizard.spec.mjs:131-142`
  - **Constraint Ref**: REQ-01 / ADR-011
  - **Framework Detail**: `installer/__tests__/wizard.spec.mjs`
- **[INS-08]** [ ] mapeamento item→stack existente, sem nova key
  - **Depends on**: INS-07
  - **Layer**: Application (CLI)
  - **Artifact**: `STACK_VALUES` (`installer/install.mjs:245`) + `STACK_PROFILES` (`installer/install.mjs:190-239`) + `validateAnswer` (`installer/install.mjs:277-281`)
  - **Enforcement**: I-01 (`Object.keys` + `STACK_VALUES` byte-identicos); `node-esm` so W3 digitavel
  - **Constraint Ref**: REQ-02 / ADR-011
  - **Framework Detail**: `installer/__tests__/golden.spec.mjs` (verde sem alteracao) + `wizard.spec.mjs`
- **[INS-09]** [ ] `detect()` soberano com pubspec
  - **Depends on**: INS-08
  - **Layer**: Application (CLI)
  - **Artifact**: `detect` (`installer/install.mjs:1171-1222`) + default W3 (`installer/install.mjs:1307-1314`)
  - **Enforcement**: com pubspec W2m pulado (`installer/install.mjs:1296`); `suggestedStack` (`installer/install.mjs:1217`) alimenta default
  - **Constraint Ref**: REQ-03 / ADR-011
  - **Framework Detail**: `installer/__tests__/wizard.spec.mjs`
- **[INS-10]** [ ] invalida repete com bloco 4-linhas
  - **Depends on**: INS-09
  - **Layer**: Application (CLI)
  - **Artifact**: bloco W2m (`installer/install.mjs:1299-1304`)
  - **Enforcement**: fora de `[1,5]` (ou `q`) nunca avanca; repete mantendo tokens `[ERRO]`/`q`; codigo `BAD_ANSWER`
  - **Constraint Ref**: REQ-04 / ADR-011+012
  - **Framework Detail**: `installer/__tests__/wizard.spec.mjs`

### CLI Tasks (F3 — Doctor)
- **[INS-11]** [ ] `doctor` D0–D6 read-only, 7 passos
  - **Depends on**: INS-10
  - **Layer**: Application (CLI)
  - **Artifact**: entrypoint `doctor` (D0 preflight `installer/install.mjs:1272-1274`; D1 `1276-1281`; D2 `1171-1222`; D3 `1354-1357`; D4 `660-701`; D5 `.harness-install.json`; D6 relatorio)
  - **Enforcement**: 7 passos D0..D6; D2 cita fontes `arquivo:linha` (`1198,1206,1211`); D6 por camada + `checks.failed[]` em blocos §9.2
  - **Constraint Ref**: REQ-12 / ADR-014
  - **Framework Detail**: `installer/__tests__/cli.spec.mjs` + fixture divergente (dogfood)
- **[INS-12]** [ ] zero writes por construcao + prova
  - **Depends on**: INS-11
  - **Layer**: Application (CLI)
  - **Artifact**: ausencia de `applyMerge` (`507-545`) + `writeManifest` (`705-711`) + `apply` (`1371-1386`) no caminho doctor
  - **Enforcement**: I-04; scan estatico de imports + teste fs-mock 0 writes
  - **Constraint Ref**: REQ-13 / ADR-014
  - **Framework Detail**: `installer/__tests__/cli.spec.mjs` (fs-mock)
- **[INS-13]** [ ] R3: `--backup-dir` validado (M3)
  - **Depends on**: INS-12
  - **Layer**: Application (CLI)
  - **Artifact**: `resolveBackupDir` (`installer/install.mjs:135-144`) + `parseArgs` (`installer/install.mjs:909-926`)
  - **Enforcement**: absoluto + `backupDir === target` ⇒ `BACKUP_FAIL`; `init`/`doctor`/install sem bypass
  - **Constraint Ref**: REQ-17 (R3)
  - **Framework Detail**: `installer/__tests__/cli.spec.mjs`

### CLI Tasks (F4 — Init + CLI + answers)
- **[INS-14]** [ ] `init` W0–W7 greenfield
  - **Depends on**: INS-13
  - **Layer**: Application (CLI)
  - **Artifact**: entrypoint `init` (W0 `1272-1274` → W7 `1381-1386` via `planMerge` `457-505` + `printPlan`)
  - **Enforcement**: fluxo W0–W7 idem SPEC REQ-09 (defaults `1308-1314`, recalc `1320-1322`, previas `1351-1369`, backup+apply `1376-1380`, manifesto+checks `1381-1386`)
  - **Constraint Ref**: REQ-09 / ADR-013
  - **Framework Detail**: `installer/__tests__/wizard.spec.mjs` (greenfield `/tmp`)
- **[INS-15]** [ ] gate create-only pos-W4
  - **Depends on**: INS-14
  - **Layer**: Application (CLI)
  - **Artifact**: gate sobre `planMerge` (acoes `installer/install.mjs:465-502`)
  - **Enforcement**: qualquer `merge|flag` ⇒ aborta antes de W5 com bloco 4-linhas (`target nao-limpo`, `rode doctor`, `D0–D6`)
  - **Constraint Ref**: REQ-10 / ADR-013
  - **Framework Detail**: `installer/__tests__/wizard.spec.mjs` (brownfield-abort)
- **[INS-16]** [ ] contador `[i/total]` + `q` visivel em todo prompt W3
  - **Depends on**: INS-15
  - **Layer**: Application (CLI)
  - **Artifact**: prompts W3 (`QUESTIONS` `~150-181`, leitura `1259-1269`, `ABORT_TOKENS` `1155`)
  - **Enforcement**: `[i/total]` com `total = QUESTIONS.length`; `q/quit/cancel/abort` ⇒ `USER_ABORT` sem writes (`1265-1267`)
  - **Constraint Ref**: REQ-11 / ADR-013
  - **Framework Detail**: `installer/__tests__/wizard.spec.mjs`
- **[INS-17]** [ ] `--answers-file` validado + segredo so-memoria (M1)
  - **Depends on**: INS-16
  - **Layer**: Application (CLI)
  - **Artifact**: `loadAnswersFile` (`installer/install.mjs:926-937`) + `serializeAnswers` (`333-340`)
  - **Enforcement**: nao-objeto ⇒ `BAD_ANSWER`; token do arquivo nunca serializado; SKILL §10/§11 (`chmod 600`, nao commitar)
  - **Constraint Ref**: REQ-15 (M1)
  - **Framework Detail**: `installer/__tests__/qa.spec.mjs`
- **[INS-18]** [ ] segredo sem eco em TTY (M2)
  - **Depends on**: INS-17
  - **Layer**: Application (CLI)
  - **Artifact**: `readSecretPrompt`/`readSecretRaw` (`977-1029`), fallback (`1030-1070`), readline (`1073-1080,1328-1334`)
  - **Enforcement**: TTY sem eco + mascara; nao-TTY leitor historico; token nunca enfileirado na proxima pergunta
  - **Constraint Ref**: REQ-16 (M2)
  - **Framework Detail**: `installer/__tests__/qa.spec.mjs`
- **[INS-19]** [ ] contrato CLI §9.5 `init`/`doctor` (argv/flags/exit/help)
  - **Depends on**: INS-18
  - **Layer**: Application (CLI)
  - **Artifact**: `parseArgs` (`909-926`) + `printUsage` (`1393-1396`) + preflight/NO_STDIN (`1263,1449-1452`)
  - **Enforcement**: nenhum flag novo; `--target` obrigatorio (`BAD_TARGET` exit 1); `--help` exit 0; doctor ignora `--dry-run`/`--yes`; init dry-run sem writes nem backup (`783-787`)
  - **Constraint Ref**: §9.5 / REQ-09..13 (CLI)
  - **Framework Detail**: `installer/__tests__/cli.spec.mjs`
- **[INS-20]** [ ] suite verde + barra §10 (transversal)
  - **Depends on**: INS-19
  - **Layer**: Test
  - **Artifact**: `installer/__tests__/` + `scripts/static-checks.mjs` + `harness.config.json` suiteFull
  - **Enforcement**: 0 falhas `node --test installer/__tests__/`; cobertura ≥90% funcoes tocadas; 0 skip; `defaultSuiteFor` (`1224-1234`) + `howToFix` (5 stacks) intactos; golden+generate verdes; zero `pkill -f`/Lombok; V15 rede-zero
  - **Constraint Ref**: SPEC §10 + I-01..I-06
  - **Framework Detail**: suiteFull + `docs.spec.mjs` (Delta SKILL §10/§11 redigido no archive, nao aqui)

## 9. Event Implementation Mapping (MANDATORY)
N/A justificado — SPEC §6: sem eventos/mensageria, sem Outbox/Broker/Consumer. Sem tabela; nenhuma task de evento gerada (determinismo preservado).

| Event Name | Producer Task ID | Outbox Task ID | Broker Task ID | Consumer Task ID |
|---|---|---|---|---|
| N/A (sem eventos — SPEC §6) | N/A | N/A | N/A | N/A |

## 10. Execution Readiness Checklist
- [x] All tasks have valid dependencies (no circular references).
- [x] All SPEC events generated the 4 mandatory tasks (N/A justificado §9).
- [x] Mandatory testing tasks created for critical constraints (R1→INS-05, R3→INS-13, R4→INS-06 em `qa/cli.spec`; I-04→INS-12; I-01→INS-08).
- [x] Base Infra tasks explicitly defined (F1 fundacao `formatError`/`sanitizeLog` antes do dominio — CLI sem tenant/DB).
- [x] Critical Execution Path maps only the core flow (§7).

### plan-gate self-check
- [x] Traceability 1:1 — REQ-01..18 cada um em ≥1 task (§8; matriz §3); §9.5 em INS-19; §10 em INS-20.
- [x] Constraint Mapping — tabela §3 (Constraint→Enforcement→Failure Mode).
- [x] Infra Bootstrap First — F1 (`formatError`/`sanitizeLog`) precede menu/doctor/init.
- [x] Execution Graph — F1→F2→F3→F4, camadas respeitadas.
- [x] Critical Execution Path — §7, so fluxo core.
- [x] 4-Task Event Lifecycle — N/A justificado §9.
- [x] Mandatory Testing Tasks — TDD em toda task (§8 Framework Detail); isolamento = I-01/I-04/R1 com testes dedicados.
- [x] Failure Mode Testing — BDD falha em TASKS para cada INS.
- [x] Idempotency Validation — dry-run `passed:null` (INS-03), abort sem writes (INS-15/16), doctor idempotente read-only (INS-11/12).
