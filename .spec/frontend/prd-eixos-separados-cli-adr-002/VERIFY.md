# VERIFY — prd-eixos-separados-cli-adr-002 (VAL-02 / ADR-002)

> Fase 4 (Verify) do ciclo SDD da ADR-002 (CLI visual B1). Executor: `developer-engineer`.
> Último batch do ADR-002. Decisão habilitante: PRD §16.3/§16.5 + protótipo aprovado
> (`workflow-state.json.prototype`, `approved_user_2026_11_17`).
> Ratificação final: **owner aprova, orquestrador registra** — `ownerApproval.pending = true`.
> Nenhum veredito de validação foi auto-assinado neste batch.

## 0. Prova executada (H1/H2)

Comandos medidos neste batch (`/tmp/opencode/val02-cli-measure.cjs`, `spawnSync` + `Date.now()`
imediatos antes/depois de cada comando). `stdoutHash` = sha256 do stdout real;
`durationMs` = relógio de parede, não estimativa. Saídas completas em `/tmp/opencode/val02-cli/out-*.txt`.
Os 4 primeiros são as etapas de `commands.suiteFull` de `harness.config.json`, executadas
separadamente para evidência por etapa; o 5º é o eixo Rust declarado no config do ADR-001.

| # | Comando | exit | duração | contagem | stdoutHash |
|---|---|---|---|---|---|
| 1 | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 0 | 1474ms | 540 passed / 0 failed / 0 skipped | `sha256:041994ef0cdf85b33c8132555ef4084787bf542db8235378341f0ad006d35c4e` |
| 2 | `node --test "installer/__tests__/*.spec.mjs"` | 0 | 6140ms | 1091 passed / 0 failed / 0 skipped | `sha256:21a8281605214ff2120f648e69246b91b91bc0d84daa1c5d10f3306abbc3e2d1` |
| 3 | `node scripts/static-checks.mjs` | 0 | 268ms | PASS V6/V6b/V2/V3/V7/V15/V14/V18/V19/V20 + PRD-01/ADR-01/ADR-02 | `sha256:4a1e734a85037a1e26e20ea8531b7b4e64cf76d4b1fd7890b3b62529b7652ad5` |
| 4 | `node scripts/vendor-skills.mjs --check` | 0 | 65ms | `vendor-check OK (.agents/skills/.vendor-lock.json)` | `sha256:e5e528c52d79fceaa1be828bd89116aa6e0be73294d2e99d39c4febe99e84516` |
| 5 | `cargo test --manifest-path installer-rs/Cargo.toml` | 0 | 206ms | 85 passed / 0 failed / 0 ignored (17 blocos `test result: ok`) | `sha256:dc8ca70936f6671a8af3687bfbb7b8f55f614d1193847d148bbccf5feedd405f` |

Soma dos tempos medidos: **8153ms**. Nenhuma falha nova, nenhuma falha pré-existente.
H2: débito pré-existente não-bloqueante `VAL01-OBS-CONTAGEM` (installer 1090→1091: +1 teste
TDD de `FU-Q-CANCEL`), `VAL01-OBS-2` (`stdoutHash` inclui `duration_ms` não-determinístico —
a contraprova re-executa e compara exit+contagens, não hash) e `VAL01-OBS-3` (arquivos
órfãos não rastreados em `installer/__tests__/`) — todos registrados e sem queda de cobertura.

### Saída literal (etapas 1–5, trechos finais)

```
$ node --test ".opencode/plugins/__tests__/*.spec.mjs"   # exit 0
ℹ tests 540
ℹ suites 128
ℹ pass 540
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1425.94405
```

```
$ node --test "installer/__tests__/*.spec.mjs"   # exit 0
ℹ tests 1091
ℹ suites 241
ℹ pass 1091
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6088.470529
```

```
$ node scripts/static-checks.mjs   # exit 0 (saída integral, 14 linhas)
PASS V6: harness.config.json: valid JSON
PASS V6b: harness-report.schema.json: valid JSON
PASS V2: permission.ask=0
PASS V3: hardcoded-project-literals=0
PASS V7: scalar-output-system=0
PASS V15: rede em installer/=0
INFO V12: harness-continuous.md orphan refs=0 (fusion landed DOC-02; enforced as FAIL R-V12 in scripts/sdd-checks.mjs)
PASS V14: git+remote+CI present
PASS V18: refs vivas: missing-and-unclassified=ok, stale-baseline-entry=ok[vendor-only=0], baseline-entry-incomplete=ok, nondefect-entry-incomplete=ok, stale-nondefect-entry=ok, link-ref-citation-form=ok (baseline=1, non-defect=1)
PASS V19: inventário derivado: skills=47 (vendor-by-axis=25, consumer=21, axis=0, orphan=1), rules=8 (consumer=7, axis=1, orphan=0), agents=10/10 (registered=10, orphan=0), vendorCited=0, lockPresent=true, owner-decisions=1, pendingRemoval=0
PASS V20: cdl medido: population=223/30373, prescriptions=137 (condicional=74, exemplo=43, catálogo=20, incondicional=0), prohibition-cited=27, baseline=0 (incondicional=0, identity=0), identity=0/0, axis-decl=2/2, axis-class=0/1 (skills/rules), refs-undetected=0 (owner ADR-004), vocabulary=10, payload=214, structural-debt=0, heuristic=true fp=5/90 fn=4/90 (amostra=90, classificadas=42, método declarado no módulo), vendor-upstream=284/94 (E-5)
PASS PRD-01: PRD.md com as 7 seções obrigatórias conformes
PASS ADR-01: ADR-INDEX.md 1:1 com ADRs/<dir>/ (sem órfãos)
PASS ADR-02: ADR-INDEX.md: sequência e branch conformes
INFO LEGACY: FIX-01 done, baseline 0 (not green, history only): hardcode=0 scalar-assign=0
```

```
$ node scripts/vendor-skills.mjs --check   # exit 0
vendor-check OK (.agents/skills/.vendor-lock.json)
```

```
$ cargo test --manifest-path installer-rs/Cargo.toml   # exit 0 (bloco final)
running 4 tests
test can_no_echo_exige_tty_e_raw_mode ... ok
test gotchas_byte_level_do_parecer_ux ... ok
test q_no_segredo_e_aborto_token_vazio_e_permitido ... ok
test segredo_nunca_em_claro_em_log_ou_envelope ... ok
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
running 0 tests
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

## 0.1 Assert do `verify-gate` (3 dimensões) — cobertura item a item

| Assert | Resultado | Evidência |
|---|---|---|
| Tasks 100% | ✅ | 6/6 DONE (§1); `workflow-state.json.backlog.done=5` + VAL-02 neste batch (estado é do orquestrador, não escrito aqui) |
| Sem TODOs | ✅ | `grep -rnE 'TODO\|FIXME\|HACK' installer/cli/*.js installer/cli/package.json installer/__tests__/cli-infra.spec.mjs installer/__tests__/wizard-eixos.spec.mjs` ⇒ exit 1 (0). Ocorrências em `installer/cli/node_modules/**` são de terceiros, não código deste ADR |
| Sem tasks N/A sem justificativa | ✅ | Nenhuma task marcada N/A; backend é N/A por decisão da ADR-001 (eixos já entregues), com justificativa em `SPEC.md §5` e neste VERIFY |
| BDD sucesso/falha/borda | ✅ | CLI-01: locale/B1 + lib full-screen + Ctrl+C (`cli-infra.spec.mjs:52,73,96,122`); CLI-02: 4 transições + 5ª tela/texto livre + 48 combinações (`wizard.spec.mjs:1112,1166,1185`; `wizard-eixos.spec.mjs:93`); CLI-03: rust+vue + preset casado + other/none (`wizard-eixos.spec.mjs:93,122,128`); CLI-04: mask/0 writes + vazamento + token vazio (`qa.spec.mjs:268-415`; `qa.spec.mjs:461-483`); VAL-01: sha + paridade proibida + 37 novas (`val01`); VAL-02: N/M + protótipo reaberto + `duration_ms` (§2/§5) |
| Build limpo | **N/A motivado** | `installer/cli/package.json` não define `scripts.build` — módulo ESM consumido direto por `installer/`, sem etapa de compilação. Build do eixo é `cargo test` (85/85, §0); `stack.frontend` do config é N/A |
| Testes passando | ✅ | 540 + 1091 + 85 = 1716, 0 falha (§0) |
| Cobertura mínima | **N/A motivado** | limiar de cobertura do assert é para services/domain Java; eixo é Node ESM + Rust, sem JaCoCo. Cobertura comportamental por 1716 testes + PTY real |
| RBAC / multi-tenancy | **N/A motivado** | CLI local interativa, sem auth HTTP nem persistência multi-tenant |
| ADRs refletidos no código | ✅ | B1 em `wizard.js:25-42`; N/M em `wizard.js:7`; eixos ADR-001 em `eixos.js:6-20`; B2 ausente do código de produção (§3) |
| Sem vazamento de camada / naming | ✅ | CLI isolada em `installer/cli/`; nenhuma dependência de `impl` Java; convenções ESM mantidas |
| Frontend DevTools (console/rede) | **N/A motivado** | sem frontend web neste ADR; superfície é PTY local. H3 N/A declarado: nenhuma porta de `infra.ports` subida, nenhum browser, porta 5173 externa não tocada |

## 1. Completude — 6/6 tasks DONE

| Task | RF | Status | Arquivo:linha de entrega |
|---|---|---|---|
| CLI-01 | 04,08,12 | DONE | `installer/cli/package.json:7-10` (pin SDD, não ADR); `installer/cli/locale.js:1-78` (PT-BR completo, `t()`); `installer/cli/abort.js:8-36` (`ExitPromptError`/`AbortSignal`); teste `installer/__tests__/cli-infra.spec.mjs:52,73,96,122` |
| CLI-02 | 01,02,03,04 | DONE | `installer/cli/wizard.js:7` (`TELAS`), `:25-42` (B1), `:55-96` (4 prompts + resumo); teste `installer/__tests__/wizard.spec.mjs:1112,1166,1185` (N=4/M/PT-BR) |
| CLI-03 | 06,10 | DONE | `installer/cli/eixos.js:8-20` (8×6 da ADR-001 via `generateConfig`); teste `installer/__tests__/wizard-eixos.spec.mjs:60,93,133` |
| CLI-04 | 05,07 | DONE | `installer/cli/secret.js:11-19` (mask), `:25-77` (echo guard), `:79-98` (`readSecret`); teste `installer/__tests__/qa.spec.mjs:461-483` (PTY/SIGTERM), `:268-415` (0 writes) |
| VAL-01 | 06,09,10 | DONE | `harness/prd-eixos-separados-cli-adr-002.transcript.txt` (2412 B, sha `9fd70bb6…`); RELATÓRIO `val01` (sha antes do baseline, não-paridade, rust+vue byte-idêntico, rito reutilizado) |
| VAL-02 | 02,08,11 | **DONE neste batch** | este `VERIFY.md` + RELATÓRIO `val02` (5 comandos exit 0, N/M re-medidos, B2 = 0 no código de produção, selo c904f1c5, 14 itens de segurança) |

## 2. Corretude

- **Suíte 0 falhas**: 540 (plugins) + 1091 (installer) + 85 (cargo) = **1716 testes**, 0 falha,
  0 skip. `static-checks` PASS PRD-01 / ADR-01 (1:1 índice↔disco) / ADR-02 (sequência e branch)
  e V19/V20; `vendor --check` OK. Contagens idênticas às do início do batch — nenhuma
  regressão de cobertura, nenhuma queda de teste.
- **N/M re-medidos = congelados** (comandos literais no RELATÓRIO `val02.remedicao`):
  `workflow-state.json.prototype` ⇒ `N=4`, `M=2 setas+Enter (backend) / 1 seta+Enter
  (frontend) / Enter (nome) / token+Enter`, `cmd=0`, `PT-BR`, `[input is masked] / [REDACTED]`;
  `wizard.js:7` ⇒ `TELAS=["backend","frontend","name","token"]`; transcript real ⇒ `TELAS=...
  backend,frontend,name,token` e marcadores `↑↓ navigate • ⏎ select` nas 2 posições de backend
  e 1 de frontend; `wizard.spec.mjs:1166/1185` e `wizard-eixos.spec.mjs:134-147` ⇒ `M` medido
  idêntico ao congelado (2 e 1 setas). **Protótipo não reaberto; nenhum valor novo sem §16.**
- **Transcript real** (não escrito à mão): 2412 B, sha `9fd70bb612f5ca795bfcb036b492eed7e1e100
  d801b0023a8a39107f115e18db` re-confirmado por `sha256sum` neste batch; 4 telas + resumo;
  segredo mascarado e redacionado; sem paridade com o transcript antigo de **16336 B**
  (sha `fe1f9187…`, marcadores `[1/5]/[1/2]/[2/2]`) — item 9 da ADR veta qualquer
  afirmação de paridade. Shas e bytes divergem; nenhuma afirmação de igualdade foi escrita.
- **Comando literal rust+vue (item 5 da ADR-001, re-executado neste batch)**:
  `node --input-type=module -e 'import("./installer/installer-contract.mjs").then(m=>{const c=m.generateConfig({project:"demo",axes:{backend:"rust",frontend:"vue"}});console.log(c.stack.backend,c.stack.frontend,JSON.stringify(c.commands),JSON.stringify(c.mcp))})'`
  ⇒ `rust backend vue frontend {} {"required":["chrome-devtools"]}`. O `CONFIG_JSON` completo
  tem sha `sha256:7a2f5cfa08c337932759247e5b7dbc9de4efd6d0d80d69e18f79ab96a54e6876`,
  **byte-idêntico ao ratificado na ADR-001** — mesmo gerador, nenhum preset casado
  (`commands:{}` é dado do oráculo para rust, dívida `FU-CARGO-ORACULO`, não defeito).
- **Sinal (FU-SINAL-DIRETO, medição direta feita neste batch)**:
  - direto, `spawn(process.execPath, [fixture])` + `child.on("close",(code,signal))`:
    **`code=null, signal=SIGTERM`** (estável em 3 execuções);
  - wrapper `script -q -e -c`: **`code=143, signal=null`** (= 128+15);
  - caminho PTY (`qa.spec.mjs:461-483`, dentro dos 1091 verdes): `restored=true`,
    `signal=SIGTERM`, `stty -a` com `echo` ON (sem `-echo`).
  - honestidade: no spawn direto sem TTY, `restoreEcho()` retorna `false` e `stty` falha
    (`ioctl inapropriado`); a prova de **eco restaurado** vem do caminho PTY, não do spawn direto.
    `NAO_DEVERIA_CHEGAR` ausente do stdout em ambos. Nunca `exit 0` após sinal.

## 3. Coerência

- **B1, não B2**: `grep -rnE '\b(inquire|ratatui|dialoguer)\b' installer/*.mjs installer/cli/*.js`
  ⇒ exit 1 (zero ocorrências no código de produção). ADR §2.3/§3 item 8 só menciona B2 como
  divergência não escolhida. **Precisão de escopo**: um `grep` em todo `installer/` encontra as
  palavras em `installer/__tests__/*.spec.mjs` — são dados de teste do detector negativo
  (`cli-infra.spec.mjs:122-140`, `generate-eixos.spec.mjs:217`, `compose.spec.mjs:262`,
  `eixos.spec.mjs:186`), não implementação de TUI. Nenhuma afirmação de "zero em todo o repo".
- **Protótipo não reaberto**: N/M, mascaramento, idioma e demonstração `rust+vue` permanecem
  os medidos em 2026-11-17. Única mudança funcional desde VAL-01: nenhuma — este batch é só
  verificação e documentação.
- **Eixos da ADR-001**: `installer/cli/eixos.js:6-20` consome `AXIS_IDS`/`generateConfig`
  do módulo ratificado; 8 backends × 6 frontends; nenhuma tabela casada na seleção.
- **Selos e paths protegidos intactos**: `sealCommands(harness.config.json.commands)` ⇒
  `{"suiteFull":"c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2","unit":"daba8c5465bffe061738235b274c497a4e8e761e41c5e79d4c671a72231cffc7"}`;
  `git diff --exit-code 4b90ad5..HEAD -- .opencode/plugins/gate.js .opencode/plugins/lib/seal.mjs
  harness.config.json opencode.json` ⇒ exit 0 (vazio). `workflow-state.json` foi tocado apenas
  por commits de estado do orquestrador antes deste batch; **este batch não o escreveu**.
  Nenhum preset, chave, comando/default ou valor novo sem §16. Oráculo `c63e333` fora do caminho.
- **Rito ADR-002 não forjado**: literal `9fa4530bbe0d431781a159cced28c011e1d94a8abea5ca1cc
  8465608976552f0` reutilizado **como forma** (origem: `harness/prd-installer-rust-adr-002.json`);
  `ownerApproval {pending:true, signer:"orquestrador", reviewer:"owner do harness"}` com alvo
  no transcript 2412 B / sha `9fd70bb6…` e na não-paridade com 16336 B. Nenhuma assinatura
  escrita por este agente; `verdictWrittenHere: null` no RELATÓRIO.
- **Canais**: `stdout` do RELATÓRIO/hash separado de stderr; 5 comandos com `stderrBytes=0`
  salvo cargo (1747 B de `Compiling`/`Finished`, sem segredo); nenhum `SEGREDO_PROVA` em
  `stdout`/`stderr`/RELATÓRIO/transcript.

## 4. Segurança — Fase 4 (skill `security-review`, 14 itens)

13 itens do checklist zero-tolerance da skill + 1 controle A08 específico da ADR-002
(integridade de segredo/transcript/selo sem auto-accept) = 14. `N/A` motivado por superfície
inexistente: CLI local interativa, sem HTTP, banco, rede ou persistência nova.

| # | Controle | Resultado | Motivação / evidência |
|---|---|---|---|
| 1 | Controle de acesso server-side (`@HasPermission`) | **N/A** | CLI local; nenhum endpoint HTTP neste ADR |
| 2 | Input validation server-side (`@Valid`) | **N/A** | sem DTO/HTTP; seleção por conjuntos fechados `AXIS_IDS` 8×6 (`eixos.js:8-20`) |
| 3 | SQL/JPQL parametrizado | **N/A** | sem banco, query ou ORM |
| 4 | Senha Argon2id/bcrypt | **N/A** | nenhuma senha; token de acesso lido em TTY sem eco (`secret.js:11-19,79-98`) |
| 5 | JWT RS256/ES256 + `iss`/`aud`/`exp` | **N/A** | sem autenticação HTTP |
| 6 | HTTPS/TLS 1.2+ em produção | **N/A** | nenhum transporte de rede; wizard não faz `fetch` |
| 7 | Security headers (CSP, X-Content-Type-Options) | **N/A** | nenhuma resposta HTTP |
| 8 | Zero `v-html` não sanitizado | **N/A** | sem frontend web neste ADR (B2 não escolhida) |
| 9 | Sem segredos em código/logs/respostas | ✅ | `SEGREDO_PROVA` ausente de `/proc/$PID/cmdline`, stdout, stderr e transcript (VAL-01); `[input is masked]` / `[REDACTED]`; 0 ocorrência no RELATÓRIO |
| 10 | Rate limiting em autenticação/endpoints sensíveis | **N/A** | sem superfície de rede ou endpoint |
| 11 | Dependências auditadas, zero CVE alta | ✅ | pin `@inquirer/prompts@8.8.0` + `@inquirer/i18n@1.4.0` registrado no SDD (`package.json:7-10`), `npm ci` executado no CLI-04; `vendor-skills --check` OK; lock versionado |
| 12 | Actuator/Swagger protegidos | **N/A** | sem runtime web |
| 13 | Mobile: Keychain/Keystore, TLS, sem cleartext | **N/A** | dart/flutter são alvos de geração de config; nenhum app construído neste batch |
| 14 | A08 — integridade: segredo/transcript/selo sem auto-accept | ✅ | sha do transcript registrado antes do baseline; não-paridade declarada; selo c904f1c5 re-derivado e intocado; rito `9fa4530b…` reutilizado sem assinatura; `ownerApproval.pending=true`; `grep -cE '^Veredito: validated literal'` nos 2 artefatos ⇒ 0 assinaturas |

**Resultado**: 14/14 endereçados (11 N/A motivados + 3 ✅). Zero achados críticos.
Verdict: **pass** — nenhuma nova superfície de ataque; ratificação de integridade permanece
com owner/orquestrador, fora do escopo do executor.

## 5. Sugestões e dívidas documentadas (não escondidas, não bloqueantes)

| ID | Origem | Decisão / distribuição neste batch | Bloqueia? |
|---|---|---|---|
| `FU-HINT-VISIVEL` | review VAL-01 | **Registrada como limitação da lib B1.** `hint.navigation` (`locale.js:45-47`, "Ctrl+C para cancelar") existe e é testada (`cli-infra.spec.mjs:38,170-171`), mas nenhum prompt a consome: `wizard.js:64-68,72-79,82-85` e `secret.js:11-19` passam só `message`/`choices`/`default`/`placeholder`/máscara. A dica visível no transcript é a embutida do `@inquirer`, em inglês (`↑↓ navigate • ⏎ select`). Consumir a chave exigiria mudar o render do prompt → novo transcript/sha → nova ratificação §16, o que violaria o alvo `9fd70bb6…` deste batch. Não alterado. | não |
| `FU-SINAL-DIRETO` | review CLI-04 | **Endereçada**: medição direta `code=null, signal=SIGTERM` registrada na §2 e no RELATÓRIO `val02.sinal`, ao lado do `143 = 128+15` do wrapper `script -e`; distinção PTY (eco ON) vs spawn direto (sem TTY) explicitada. | não |
| `FU-GITIGNORE-CLI` | review CLI-04 | **Documentada como dívida P3**: não há `installer/cli/.gitignore`; `node_modules/` está só em `.git/info/exclude:9` (local, não versionado). Adicionar arquivo versionado é higiene de repo, mas cria arquivo novo fora do escopo de verificação deste batch e não muda contrato; fica para o orquestrador decidir com o dono do repo. Nenhum `node_modules` foi commitado. | não |
| `VAL01-OBS-CONTAGEM` | VAL-01 | installer 1090→1091: +1 teste TDD de `FU-Q-CANCEL`. Não é queda de cobertura nem mudança de N/M. | não |
| `FU-CARGO-ORACULO` | ADR-001 (P3) | `commands={}` de rust no oráculo congelado; dado da ADR-001, não defeito do gerador. | não |
| `FU-NODE-REINDEX` | ADR-001 (P3) | desempate `node`/`node-esm` em `node+none`; ajuste normativo é decisão §16 separada. | não |
| `VAL01-OBS-1` | ADR-001 (P3) | off-by-one 37 novas / 11 herdadas (normativo diz 36/12); ratificação cobre 48 ⊇ 37. | não |
| `VAL01-OBS-2` | ADR-001 | `stdoutHash` inclui `duration_ms` não-determinístico; contraprova re-executa, não compara hash. | não |
| `VAL01-OBS-3` | ADR-001 | arquivos órfãos não rastreados em `installer/__tests__/`; pré-existente. | não |
| `FU-AXIS-IDS-UNICO` | review CLI-03 | duas cópias literais byte-iguais de `AXIS_IDS` em `install.mjs` e `installer-contract.mjs`; re-export único é refactor opcional, sem comportamento observável. | não |
| `FU-RATIFICAR-48` | review ADR-001 VAL-01 | owner ratificar baseline 48 quando decidir; fora deste batch (o oráculo `c63e333` não foi reaberto). | não |

Todas são dívidas documentais/comportamento herdado. Nenhuma autoriza mudança de
config/gate/selo/N/M sem §16.

## 6. Veredito do Verify

| Dimensão | Resultado |
|---|---|
| Completude | ✅ 6/6 tasks DONE |
| Corretude | ✅ 5 comandos exit 0; 540/1091/85; N/M re-medidos = congelados; transcript 2412 B sha `9fd70bb6…`; literal rust+vue byte-idêntico ADR-001; sinal medido |
| Coerência | ✅ B1 não B2 (0 no código de produção); protótipo não reaberto; eixos ADR-001; selo c904f1c5 intacto; paths protegidos intocados |
| Segurança Fase 4 | ✅ 14/14 endereçados (0 críticos) |

### Resultado Final (assert `verify-gate`)

```
VERIFY STATUS: APPROVED ✅

Bloqueadores encontrados:
- nenhum

Observações:
- "APPROVED" acima é o parecer de verificação do executor (3/3 dimensões + 14/14 segurança),
  NÃO é ratificação: ownerApproval.pending = true; owner aprova, orquestrador registra.
- Dívidas P3 documentadas na §5 (hint, sinal, gitignore, contagem, P3 da ADR-001) — nenhuma bloqueia.
```

**Não é um `Veredito: validated literal`.** Rito ADR-002: owner aprova, orquestrador registra.
`ownerApproval.pending = true`; `verdictWrittenHere: null`; `literalProven` não é afirmado.
Push **não** executado — comando fica para o orquestrador após aprovação do owner.
