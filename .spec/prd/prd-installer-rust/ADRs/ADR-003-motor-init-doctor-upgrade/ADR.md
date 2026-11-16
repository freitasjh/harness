# ADR-003 — Motor `init`/`doctor`/`upgrade`: as 23 `op`s de engine mapeadas 1:1, ordem de `upgrade` congelada e vereditos lidos como literais externos; critério de CLI fixado contra o oráculo, crate/versão fora da decisão

- **prd-id**: `prd-installer-rust` — `.spec/prd/prd-installer-rust/PRD.md`
- **order**: 3 de 5 (`.spec/prd/prd-installer-rust/ADR-INDEX.md`)
- **status**: `in-progress`
- **branch**: `adr/prd-installer-rust/03-motor-init-doctor-upgrade` (aberta de `eb9adf6`; HEAD local `eb9adf643e2655ed5b8c3712b3d77a894a03f34b` antes do commit deste ADR — commit do orquestrador que abriu o slot; o SHA do commit deste batch é registrado no retorno)
- **depende-de**: ADR-001, ADR-002 — `.spec/prd/prd-installer-rust/ADRs/ADR-001-fronteira-subprocesso/ADR.md` (contrato `contract-v1`: canais, envelope `v:1`, exit `0/1/2`, segredo em `stdin`, registry de 6 mapas, worktree `detach` em `c63e333`) e `.spec/prd/prd-installer-rust/ADRs/ADR-002-oraculo-paridade/ADR.md` (predicado anti-tautologia, SI-1..SI-6, rito de validação humana, `9 byte-equal + 2 parciais` como baseline medido). **Nenhuma rubrica de ADR-001 ou ADR-002 é reaberta**; este ADR consome as `op`s e os predicados, não os redefine.
- **data**: 2026-11-16
- **dono da decisão**: owner do harness. **D1** (subprocesso), **D2** (paridade total antes de trocar), **D4** (Node `c63e333` + literais), **D5** (12 presets), **D6** (selo `c904f1c5…`, suíte em paralelo), **D7** (binário autocontido + Node≥20) e **D8** (fatia 3 = motor) são insumo fechado; este ADR os **implementa**, não os reabre.
- **rota**: refactor de motor. Nenhum comportamento de instalação é mudado, nenhuma mensagem, código, preset ou chave é inventado; muda o endereço das 23 `op`s de engine sob `contract-v1` e a autoridade que julga sua paridade.
- **escopo de escrita desta entrega**: apenas `.spec/prd/prd-installer-rust/**` — neste batch, `ADRs/ADR-003-motor-init-doctor-upgrade/ADR.md` e uma linha nova em `ADR-INDEX.md` (com a promoção de ADR-002 a `merged`, obrigatória por `ADR-02`). Nenhum arquivo de `installer/**`, `scripts/**`, `.opencode/**`, `.agents/**`, `harness.config.json`, `gate.js`, `opencode.json` ou `workflow-state.json` foi tocado. O dispatcher, os módulos Rust e as specs migradas são o **SDD** deste ADR.
- **insumo de pesquisa**: `RESEARCH.md` §2 (A1 = `clap` derive + `anyhow` app + `thiserror` domínio, fontes S1/S2/S3; A2 = `std::env::args` sem crate) e §7 (linha do ADR-003), §8 (riscos para o G2); `PRD.md` §16 (D1/D2/D4/D5/D6/D7/D8) e §3.5 (SI-1..SI-6); ADR-001 §5 (D-ENGINE = 23 nomes) e §2.2 (exit codes); ADR-002 §2.1 (predicado de externalidade), §2.4 (rito do literal), §4 (dono/comando por SI); medição direta de `installer/install.mjs`; Brain `regras/projetos/projeto/harness/merge-de-config-remocao-por-forma` e `regras/projetos/projetos/harness/merge-opencode-json-v2-only`.

## 1. Contexto — fatos medidos, não deduzidos

Medições e leituras de 2026-11-16 neste repo. Cada linha tem `arquivo:linha`, comando ou artefato citado; nenhum número abaixo é estimativa.

| Fato | Valor | Comando / fonte |
|---|---|---|
| Motor legado | `install.mjs` com **3.010 linhas** e **95 exports** | `wc -l installer/install.mjs`; `grep -c '^export ' installer/install.mjs` (ADR-001 §1) |
| `op`s de engine | **23**, nomes idênticos aos exports `D-ENGINE` | ADR-001 §5; nenhuma `op` nova é criada aqui |
| `op`s de TUI | **8**, fora deste ADR | ADR-001 §5 (`askMenuStep`, `detect`, `printPlan`, `printUsage`, `promptAnswers`, `readSecretPrompt`, `readSecretRaw`, `sourceLineOf`); ADR-004 |
| Entrypoints de paridade | **4**: `runInit`, `runDoctor`, `runUpgrade` e o legado `runCli`/`main` | `RESEARCH.md` §7; `install.mjs:2481`, `:1348`, `:2933`, `:2597`, `:1606` |
| `doctor` | **7 marcadores D0..D6**, veredito `SAUDÁVEL`(0) / `ATENÇÃO`(1) / `QUEBRADO`(1), somente leitura | `install.mjs:1348-1485`; `installer/__tests__/doctor.spec.mjs:46-135` (INS-11/INS-12) |
| Bloco de erro | **4 linhas** — `[ERRO] …` / `  porquê: <code>` / `  como corrigir: …` / `  onde ver: …`; vocabulário de **23 códigos** + `UNKNOWN` | `formatError` `install.mjs:1537-1544`; `ERROR_CODES` `:1529-1535`; `suite.spec.mjs:161-195` (INS-01) |
| `init` | wizard W0..W7, gate `assertCreateOnly` create-only, backup verificado antes de escrever, manifesto + checks | `install.mjs:2481-2580`, `:1606-1655`; `suite.spec.mjs:43-99` (IN-06 I1..I6) |
| `upgrade` — ordem medida (`runUpgrade`) | `preflight` → manifesto presente → parse → schema → `runDoctor` → `collectAnswers` → `collectIncoming`/`generateConfig` → `planUpgrade` → `printPlan` → [dry-run: retorno 0 writes] → `confirmByLayer` → `backup`+`requireVerifiedBackup` → `applyUpgrade` → `buildManifest`/`writeManifest` → `runChecks` → regrava manifesto → `exitCode` | `install.mjs:2933-3008` |
| `upgrade` — ordem medida (`main`, caminho comum de `init`/legado) | `preflight` → `inventory` → [dry-run: sem backup] `backup` → `requireVerifiedBackup` → `collectAnswers` → `generateConfig` → `planMerge` → `applyMerge` → `writeManifest` → `runChecks` → regrava manifesto → `exitCode` | `install.mjs:1606-1655` |
| Trava de escrita | `requireVerifiedBackup` exige `verified === true`; `applyMerge`/`applyUpgrade` são os únicos pontos de escrita de conteúdo | `install.mjs:1599-1604`, `:1055-1120`, `:2878-2931`; `checks.spec.mjs:329-370` (FU-20) |
| Rejeição de conflito | `init`: `merge`/`flag` ⇒ `assertCreateOnly` aborta com `flagged-open` + dica de `doctor`; `upgrade`: `flag` vira `collisions`, não aborta; `mcp` divergente é a única divergência humana do merge v2-only | `install.mjs:2519-2539`, `:2985-2995`; `suite.spec.mjs:54-61`; `merge-v2-only.spec.mjs:187-206`; Brain `merge-opencode-json-v2-only` |
| Idempotência | 2ª execução de `upgrade` inteiramente `noop`; schema intacto em conteúdo/mtime/inode | `installer-upgrade-regression.spec.mjs:201-248` (BF-02b) |
| Contrato de `exitCode` | valida ⇒ `0`, reprovada ⇒ `1` em `runInit`, `main`, `runCli` `--answers-file` e wizard TTY | `installer-upgrade-regression.spec.mjs:249-365` (BF-03) |
| Merge v2-only | bloco gerenciado substitui; chave v1 removida por **forma**; npm do usuário sobrevive; only-add em `mcp`/`instructions` | `merge-v2-only.spec.mjs:113-260` (T1..T8); Brain `merge-de-config-remocao-por-forma` |
| Veredito histórico congelado | suíte installer **508/508**, static **10 PASS/0 FAIL**, selo `c904f1c5…49a2`, `harness.config.json` 0 linhas de diff | Brain `regras/projetos/projetos/harness/merge-opencode-json-v2-only` (Batch 2, 2026-10-19) |
| Baseline de config | **9 presets byte-equal + 2 parciais** (`flutter`, `dart`); `12/12` é meta re-derivável, não fato medido | ADR-002 §2.3/§4; `golden.spec.mjs:48-60`, `:87-114`, `:118-170` |
| Oráculo | `c63e33307710e1c6271f5c68b2dd9fb15283f49c`; worktree `detach` em `/tmp/opencode/harness-oracle-c63e333`, SHA e `status --porcelain` verificados antes de cada corrida | ADR-001 §2.6; ADR-002 §2.6 |
| Selo | `c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2`, invariante | `sealCommands(commands)`; D6; ADR-001 §2.5 |

**O defeito que este ADR fecha.** Fixar 23 `op`s "por intuição" — sem oráculo por nome — produz verde falso: a `op` existe no dispatcher mas ninguém provou que ela devolve o mesmo envelope, a mesma mensagem e o mesmo `exitCode` do `c63e333`. O defeito simétrico é pior: chamar "paridade" de uma reescrita que "conserta" a ordem do `upgrade` (ex.: mover `backup` antes de `plan`, ou fazer o veredito `QUEBRADO` do `doctor` abortar o `upgrade`) — isso muda comportamento congelado por spec e quebra BF-01b/BF-02b/EX-BE-05. Este ADR escolhe **uma** decisão: as 23 `op`s são um mapa 1:1 cuja autoridade é externa, e a ordem observável é preservada, não melhorada.

## 2. Decisão

**Decisão única: o motor `init`/`doctor`/`upgrade` é a projeção de exatamente 23 `op`s de engine sobre `contract-v1`, com nome igual ao export do oráculo, ordem operatória congelada (backup verificado antes de qualquer escrita, `apply` como único ponto de escrita de conteúdo, `checks` depois do `apply`), cada mensagem e cada `exitCode` provados contra o Node `c63e333` e os vereditos congelados lidos como literais externos ao binário Rust — e o parâmetro de CLI é escolhido por critério de paridade observável, com crate/versão ficando como recomendação de `RESEARCH.md` §2 (S1/S2/S3), não como decisão deste ADR.** 🟢 para a forma do mapa e da ordem (D1/D2/D4/D5/D6/D8 + ADR-001 §5 + medição de `install.mjs`); 🟡 para execução e medição nos 12 presets — é o SDD deste ADR que as prova.

### 2.1 As 23 `op`s de engine — nenhuma a mais, nenhuma a menos

O vocabulário é o de ADR-001 §5, classe `D-ENGINE`. `planUpgrade` e `applyUpgrade` **não** entram na tabela: pertencem aos 20 exports sem import externo (ADR-001 §5), são internos ao binário e não superfície de compatibilidade — promovê-los a `op` seria invenção de vocabulário (SI-6). O mesmo vale para as 8 `op`s de TUI (ADR-004).

Notação de prova (comum a todas as linhas da tabela; definida em ADR-001 §2.1/§2.6 e ADR-002 §2.1):

```sh
prova(op) = diff -u \
  <(printf '%s\n' "$REQ_$op" | node "$ORACULO/installer/install.mjs") \
  <(printf '%s\n' "$REQ_$op" | "$INSTALLER_BIN" contract-v1 | node -e '…result|error…')
```

A tradução `$REQ_op → argv/stdin do oráculo` é feita pelo harness de paridade do SDD (ADR-002); ela **não** altera o `.mjs` do worktree. Para `op` pura, "código de saída" significa `ok` do envelope; no processo, `0` se `ok:true`, `1` se `ok:false` com `error.code` do vocabulário de `install.mjs:1529-1535`, e `2` **somente** para erro de protocolo da fronteira (ADR-001 §2.2) — o oráculo nunca emite `2`, nenhuma `op` de motor o emite.

| # | `op` (nome = export) | Oráculo externo | Comando de prova | Código de saída |
|---|---|---|---|---|
| 1 | `preflight` | `preflight.spec.mjs` IN-01 S1/S2/S3 + `c63e333` | `node --test installer/__tests__/preflight.spec.mjs` **e** `prova(preflight)` | `0` ok · `1` `BAD_TARGET`/`NODE_MIN`/`UID_ROOT`/`REINSTALL` · `2` protocolo |
| 2 | `inventory` | `preflight.spec.mjs:37-43` (camadas) + `c63e333` | `node --test installer/__tests__/preflight.spec.mjs` **e** `prova(inventory)` | `0` · `1` erro de leitura · `2` protocolo |
| 3 | `backup` | `preflight.spec.mjs:68-75` (I1 injetado) + `suite.spec.mjs:44-53` | `node --test installer/__tests__/preflight.spec.mjs installer/__tests__/suite.spec.mjs` **e** `prova(backup)` | `0` `verified:true` · `1` `BACKUP_FAIL`, 0 writes · `2` protocolo |
| 4 | `resolveBackupDir` | `doctor.spec.mjs:136-180` (INS-13) | `node --test installer/__tests__/doctor.spec.mjs` **e** `prova(resolveBackupDir)` | `0` · `1` `BACKUP_FAIL` (igual/nested/symlink) · `2` protocolo |
| 5 | `loadAnswersFile` | `suite.spec.mjs` (caminho `--answers-file`) + `golden.spec.mjs` | `node --test installer/__tests__/suite.spec.mjs installer/__tests__/golden.spec.mjs` **e** `prova(loadAnswersFile)` | `0` · `1` `BAD_ANSWER` · `2` protocolo |
| 6 | `collectAnswers` | `suite.spec.mjs:161-195` (INS-01) + `qa.spec.mjs` | `node --test installer/__tests__/suite.spec.mjs` **e** `prova(collectAnswers)` | `0` · `1` `BAD_ANSWER`/`NO_STDIN`/`USER_ABORT` · `2` protocolo |
| 7 | `generateConfig` | `golden.spec.mjs:48-60`, `:87-170` (SI-1) + `generate.spec.mjs` | `node --test installer/__tests__/golden.spec.mjs installer/__tests__/generate.spec.mjs` **e** `prova(generateConfig)` | `0` byte-equal ao literal · `1` divergência SI-6 · `2` protocolo |
| 8 | `collectIncoming` | `eixos-stack.spec.mjs:39-60` + `harness/harness-eixos-stack-p2.json:159` (SI-2) | `node --test installer/__tests__/eixos-stack.spec.mjs` **e** `prova(collectIncoming)` | `0` · `1` divergência de paths/bodies · `2` protocolo |
| 9 | `planMerge` | `merge-manifest.spec.mjs:33-125` + `suite.spec.mjs:54-61` (I2) | `node --test installer/__tests__/merge-manifest.spec.mjs installer/__tests__/suite.spec.mjs` **e** `prova(planMerge)` | `0` (classificação create/flag/merge/noop) · `1` erro de leitura · `2` protocolo |
| 10 | `applyMerge` | `merge-manifest.spec.mjs:33-63`, `:117-124` + `suite.spec.mjs:115-131` (I4) | `node --test installer/__tests__/merge-manifest.spec.mjs installer/__tests__/suite.spec.mjs` **e** `prova(applyMerge)` | `0` escrito/noop · `1` `MISSING_INCOMING` · `2` protocolo; dry-run `0` writes |
| 11 | `buildManifest` | `merge-manifest.spec.mjs:34-63` (FU-21, schema v1) | `node --test installer/__tests__/merge-manifest.spec.mjs` **e** `prova(buildManifest)` | `0` `manifestSchemaVersion:1` · `1` schema inválido · `2` protocolo |
| 12 | `writeManifest` | `suite.spec.mjs:69-81` (I4: real grava / dry-run pula) | `node --test installer/__tests__/suite.spec.mjs` **e** `prova(writeManifest)` | `0` · `1` falha de gravação · `2` protocolo; dry-run `0` writes |
| 13 | `requireVerifiedBackup` | `checks.spec.mjs:329-351` (FU-20) | `node --test installer/__tests__/checks.spec.mjs` **e** `prova(requireVerifiedBackup)` | `0` · `1` `BACKUP_UNVERIFIED`, antes do `apply` · `2` protocolo |
| 14 | `runChecks` | `checks.spec.mjs:44-325` (IN-05/INS-02/FU-32/FU-33) | `node --test installer/__tests__/checks.spec.mjs` **e** `prova(runChecks)` | `0` `passed:true` · `1` `passed:false` (`json-invalid`/`flagged-open`/`literal-denied`/`manifest-missing`) · `2` protocolo |
| 15 | `mergeOpencodeJson` | `merge-v2-only.spec.mjs:113-260` (T1..T8) | `node --test installer/__tests__/merge-v2-only.spec.mjs` **e** `prova(mergeOpencodeJson)` | `0` v2-only + npm do usuário preservado · `1` divergência de merge · `2` protocolo |
| 16 | `mergeAgentFile` | `merge-manifest.spec.mjs:85-125` (IN-04 S3) | `node --test installer/__tests__/merge-manifest.spec.mjs` **e** `prova(mergeAgentFile)` | `0` (seção Harness anexada/normalizada) · `1` divergência · `2` protocolo |
| 17 | `main` | `installer-upgrade-regression.spec.mjs:110-145`, `:286-308` (BF-01/BF-03) + `suite.spec.mjs:337-370` | `node --test installer/__tests__/installer-upgrade-regression.spec.mjs installer/__tests__/suite.spec.mjs` **e** `prova(main)` | `0` PASS/dry-run · `1` FAIL · `2` protocolo |
| 18 | `runDoctor` | `doctor.spec.mjs:46-135` (INS-11/INS-12) + `:222-241` (EX-BE-05) | `node --test installer/__tests__/doctor.spec.mjs` **e** `prova(runDoctor)` | `0` `SAUDÁVEL` · `1` `ATENÇÃO`/`QUEBRADO` · `2` protocolo |
| 19 | `runInit` | `suite.spec.mjs:268-365` (INS-04) + `installer-upgrade-regression.spec.mjs:250-285` | `node --test installer/__tests__/suite.spec.mjs installer/__tests__/installer-upgrade-regression.spec.mjs` **e** `prova(runInit)` | `0` valida/dry-run · `1` `flagged-open`/FAIL · `2` protocolo |
| 20 | `runUpgrade` | `installer-upgrade-regression.spec.mjs:146-248` (BF-02/BF-02b) + `doctor.spec.mjs:222` | `node --test installer/__tests__/installer-upgrade-regression.spec.mjs` **e** `prova(runUpgrade)` | `0` PASS/dry-run · `1` `NOT_INSTALLED`/`MANIFEST_INVALID`/`FOREIGN_MANIFEST`/FAIL · `2` protocolo |
| 21 | `runCli` | `installer-upgrade-regression.spec.mjs:309-334` (BF-03 legado) + `cli.spec.mjs` | `node --test installer/__tests__/installer-upgrade-regression.spec.mjs installer/__tests__/cli.spec.mjs` **e** `prova(runCli)` | `0` PASS/help/dry-run · `1` FAIL/aborto · `2` protocolo |
| 22 | `parseArgs` | `cli.spec.mjs` + `install.mjs:2741-2754` (top-level INS-19) | `node --test installer/__tests__/cli.spec.mjs` **e** `prova(parseArgs)` | `0` `--help`/válido · `1` `BAD_ANSWER` (posicional desconhecido) · `2` protocolo |
| 23 | `runWizard` | `wizard.spec.mjs` + transcript SI-4 (autoridade ADR-002; tela é ADR-004) | `node --test installer/__tests__/wizard.spec.mjs` **e** `prova(runWizard)` | `0` completo/dry-run · `1` `USER_ABORT` · `2` protocolo |

**Nota de vocabulário (sem código novo):** `NOT_INSTALLED` (`install.mjs:2943`) e `MANIFEST_INVALID` (`:2946`) são `InstallError.code` medidos no oráculo, mas **não** pertencem ao conjunto `ERROR_CODES` de `:1529-1535`; no envelope e no bloco 4-linhas, `formatError:1538` os converte em `UNKNOWN`. A tabela acima os nomeia como são medidos na fonte, não como códigos de envelope inventados — o SDD preserva o mapeamento para `UNKNOWN`, sem alargar o vocabulário.

**Regra de não-órfão (herdada de ADR-001 §5):** as 23 linhas são exatamente o conjunto `D-ENGINE`; uma `op` nova no dispatcher sem linha aqui é SI-6, e uma linha sem implementação é débito do SDD. O mesmo nome em duas classes (`runWizard` na engine e `promptAnswers` na TUI) não é duplicação: a primeira orquestra, a segunda interpela — a fronteira é a de ADR-001.

### 2.2 Ordem exata do `upgrade` e o que acontece em cada falha — paridade, não melhoria

Há **duas ordens medidas**, uma por entrypoint. Uni-las "para simplificar" é reescrita proibida. `runUpgrade` (`install.mjs:2933-3008`) planeja antes de fazer backup; `main` (`:1606-1655`, caminho comum de `init`/legado) faz backup antes de planejar. Ambas concordam no invariante: **backup verificado antes de qualquer escrita de conteúdo, `apply` como único ponto de escrita, `checks` depois do `apply`**.

**`runUpgrade` — ordem congelada:**

| Passo | Operação | Falha neste passo — comportamento do oráculo (preservar) |
|---|---|---|
| 1 | `preflight({ skipManifestGuard:true })` | `InstallError` (`BAD_TARGET`/`NODE_MIN`/`UID_ROOT`) sanitizada → `exit 1`, **0 writes** |
| 2 | verificar `.harness-install.json` | ausente ⇒ `NOT_INSTALLED` → `1`, 0 writes |
| 3 | `JSON.parse(manifesto)` | ilegível ⇒ `MANIFEST_INVALID` → `1`, 0 writes |
| 4 | validar `manifestSchemaVersion===1` + `source` | estrangeiro ⇒ `FOREIGN_MANIFEST` → `1`, 0 writes |
| 5 | `runDoctor` (D0..D6, **somente leitura**) | veredito é **reportado**, não é gate: `QUEBRADO`/`ATENÇÃO` **não abortam** o upgrade (`report.verdict` só entra em `manifest.doctorPre`) |
| 6 | `collectAnswers` (`answersFile`/manifesto/stdin) | `BAD_ANSWER`/`NO_STDIN` ⇒ `1`, 0 writes |
| 7 | `profileOf` → `collectIncoming` → `generateConfig(writtenPaths)` | erro de geração/leitura ⇒ `1`, 0 writes |
| 8 | `planUpgrade(prevManifest)` → `printPlan` | classificação congelada: `create`/`noop`/`flag`/`merge`/`generate-overwrite`/`overwrite`/`delete`; `delete` só se `diskHash === manifestHash`, senão `flag` |
| 9 | `options.dryRun === true` | retorno antecipado: `applied:false`, `backupDir:null`, `checks:{passed:null,ran:false,skipped:true}`, **0 writes, sem backup, sem confirm, sem checks**, `exit 0` |
| 10 | `confirmByLayer` (salvo `--yes`) | `q`/EOF/Ctrl+C ⇒ `USER_ABORT` → `1`, 0 writes |
| 11 | `backup` + `requireVerifiedBackup` | `BACKUP_FAIL`/`BACKUP_UNVERIFIED` ⇒ `1`, 0 writes (I1/FU-20) |
| 12 | `applyUpgrade` | único ponto de escrita de conteúdo; `flag` vira `collisions` (não aborta); `MISSING_INCOMING` ⇒ `1`; paths `flag` nunca escritos |
| 13 | `buildManifest` → `writeManifest` → `runChecks` → regrava manifesto | `checks.passed:false` ⇒ `exit 1` **com escrita já feita**; rollback é o diretório de backup verificado, não uma "limpeza" inventada |
| 14 | retorno | `exitCode = checks.passed ? 0 : 1` (BF-03); `upgradedFrom`, `removed`, `collisions`, `doctorPre` no manifesto |

**`main` — ordem congelada (usada por `runInit` e pelo legado `runCli`):** `preflight` → `inventory` → [`dryRun`: sem backup] `backup` → `requireVerifiedBackup` → `collectAnswers` → `generateConfig` → `planMerge` → [`runInit`: `assertCreateOnly`] → `applyMerge` → `writeManifest` → `runChecks` → regrava manifesto → `exitCode = checks.passed === false ? 1 : 0`. Falha em `backup`/`requireVerifiedBackup`/`assertCreateOnly` ⇒ `1` e 0 writes; `dryRun` ⇒ 0 writes, `checks.passed:null`, `exit 0` (FU-28: checks não executados nunca são publicados como PASS).

**Duas armadilhas que esta tabela proíbe explicitamente:** (a) promover o veredito do `doctor` a gate do `upgrade` — o oráculo só o reporta (passo 5); (b) reordenar `backup`/`plan` para uma "ordem mais lógica" — as duas ordens medidas são dessas formas e BF-02b/EX-BE-05 as congelam. Correção de ordem só por decisão §16 do owner, registrada como divergência SI-6.

### 2.3 Como os vereditos congelados são lidos sem executar Rust

Autoridade = ADR-002 §2.1: `O` é externo se anterior a `S`, imutável por escrita em `S` e legível sem executar `S`. Cada veredito congelado é um **arquivo** (literal, título/assert de spec, transcript), não saída do binário Rust. O rito de leitura é:

1. **Fixar a fonte**: registrar `sha256` de cada arquivo de veredito no relatório de evidência do ciclo (`harness/<demand>.json`) antes da primeira comparação.
2. **Ler, não gerar**: extrair o literal/título/assert com `grep`/`sed` — nunca com comando que o regenere a partir de `$INSTALLER_BIN`, de `contract-v1` ou da registry gerada. Exemplos literais (fonte: oráculo):
   ```sh
   grep -nE "BF-01|BF-02b|BF-03|BF-04" installer/__tests__/installer-upgrade-regression.spec.mjs
   grep -nE "RF-04/T[1-8]" installer/__tests__/merge-v2-only.spec.mjs
   grep -nE "INS-11|INS-12|EX-BE-05" installer/__tests__/doctor.spec.mjs
   grep -nE "IN-01 S[123]" installer/__tests__/preflight.spec.mjs
   grep -nE "IN-05 S[123]|INS-02|FU-32|FU-20" installer/__tests__/checks.spec.mjs
   grep -nE "\[1/2\]|\[2/2\]|\[1-5\]|\(default: 1\)|\(q cancela\)" \
     .spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt
   ```
3. **Imutabilidade durante o ciclo**: `git diff --exit-code -- installer/__tests__/golden.spec.mjs installer/__tests__/eixos-stack.spec.mjs installer/__tests__/installer-upgrade-regression.spec.mjs installer/__tests__/merge-v2-only.spec.mjs installer/__tests__/doctor.spec.mjs installer/__tests__/preflight.spec.mjs installer/__tests__/checks.spec.mjs .spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt` ⇒ vazio até o fim do ciclo.
4. **O differential entra depois, e só contra o Node**: `node "$ORACULO/installer/install.mjs"` (worktree `detach`, SHA `c63e333` e `status --porcelain` verificados antes de cada corrida) é comparado ao envelope de `$INSTALLER_BIN contract-v1`. Nunca `$INSTALLER_BIN` consigo mesmo, nunca registry contra `contract-v1`.
5. **`insta` não é autoridade**: `cargo insta review` é leitura de diff; `.snap.new` pendente não entra em baseline nem em relatório verde; literal só vale com a linha `Veredito: validated literal <sha256> <ISO-8601> <oráculo>` do rito de ADR-002 §2.4.
6. **Expiração**: qualquer decisão §16 que mude preset/eixo/comando/chave/default, troca do oráculo pinado, divergência de `sha256` ou arquivamento do PRD obriga rubrica nova — nunca revalidação por herança.

Assim, "ler o veredito" não depende de Rust: o Rust é o **sujeito** comparado ao artefato; o artefato é lido com `grep`/`sha256`/`git diff`, e o differential usa o `.mjs` imutável. Nenhum número é publicado sem re-derivação (ADR-002 item 13): `9 byte-equal + 2 parciais` e "dry-run medido em 2 presets" são o que se escreve hoje; `12/12` só depois dos comandos SI nos 12 presets.

### 2.4 Critério de parâmetro — crate/versão são recomendação com fonte, não decisão

`RESEARCH.md` §2 recomenda **A1** (`clap` derive para os entrypoints, `anyhow` no app, `thiserror` nos tipos de domínio; fontes **S1** = parser/help/subcomandos/range com MSRV 1.74, **S2** = contexto de erro de aplicação, **S3** = `thiserror` sem poluir API pública) contra **A2** (`std::env::args` + `Box<dyn Error>`, controle byte-a-byte com custo de reimplementar `--help`, ranges, defaults e mensagem 4-linhas). O owner não pinou crate nem versão; este ADR **não os decide**. Decide o **critério** que os escolherá no SDD:

1. **Texto é saída, não opinião da crate.** As 9 linhas de `printUsage` (`install.mjs:2462-2470`), as 4 linhas de `formatError` (`:1537-1544`) e os 23 códigos de `ERROR_CODES` (`:1529-1535`) são comparados byte-a-byte ao oráculo. Se a crate gerar texto divergente, o texto do oráculo vence: configura-se a crate ou troca-se a crate — **nunca se edita o oráculo nem se "ajusta" a expectativa**.
2. **Nenhum código/preset/chave/mensagem novo.** `exit 0/1` do oráculo e `2` exclusivo de protocolo (ADR-001 §2.2); os 12 presets congelados (D5); o vocabulário de `ERROR_CODES` — a escolha de crate não pode introduzir valor fora desses conjuntos.
3. **Ordem observável preservada** (§2.2). A crate de parser não redefine a sequência de `preflight`/`backup`/`apply`/`checks` nem o caráter não-gate do `doctor`.
4. **Rastreabilidade de fonte.** Toda crate/versão efetiva entra no SDD com linha de `RESEARCH.md` (S1/S2/S3) e `Cargo.toml` versionado; sem fonte, é SI-6.

**Critério de escolha (decisão deste ADR):** minimizar defeito de parsing com paridade observável nos 4 entrypoints; o custo de 3 dependências é menor que reimplementar validação/help à mão, e o risco de texto diferente é fechado por golden (ADR-002), não por intenção. A recomendação A1/S1/S2/S3 é insumo; o veredito final sobre crate/versão pertence ao SDD com fonte, não a esta decisão.

### 2.5 Efeito no selo e nas suítes paralelas (D6, herdado)

- `harness.config.json`, `commands.suiteFull`, `HARNESS_SEAL_JSON` (`c904f1c5…`) e `.opencode/plugins/lib/seal.mjs` permanecem **byte-idênticos**. Nenhum comando de teste Rust é acrescentado ao selo; as suítes Rust e o harness de paridade rodam em **comandos paralelos fora dele**, como declarado em ADR-001 §2.5, ADR-002 §6 (R8) e `RESEARCH.md` §8-R2.
- `node scripts/static-checks.mjs` continua sendo a contraprova canônica (exit `0`, `PASS PRD-01`, `PASS ADR-01`, `PASS ADR-02`); as specs Node congeladas (tabela §2.1) rodam **contra o oráculo**, não contra o binário — é o que impede que a cobertura paralela vire fonte de verdade do motor.
- Custo aceito e declarado ao owner no G2: cobertura Rust não entra na contraprova selada (R5 abaixo). Não é inventar comando novo — é não republicar `c904f1c5`.

## 3. Interface congelada

Forma ratificada a partir de D1/D2/D4/D5/D6/D8 + ADR-001 §5/§2.2 + ADR-002 §2.1/§4. Itens *(SDD)* só passam a valer após a implementação; antes dela o comando mede o estado atual. Nível de garantia explícito. Cada item liga `op`/mensagem/`exitCode` a comando e oráculo.

1. **23 `op`s, 1:1, nenhuma a mais.** *(hoje)* `sed -n '201p' ADR-001/ADR.md` lista `D-ENGINE`; `grep -c '^export ' installer/install.mjs` ⇒ `95`, dos quais `23` na classe. *(SDD)* `grep -c 'case "' <dispatcher>` ⇒ `23`; `diff -u <(grep nomes D-ENGINE) <(grep ops dispatcher)` ⇒ vazio; `grep -cE 'planUpgrade|applyUpgrade' <dispatcher>` ⇒ `0` (internos, ADR-001 §5). 🟢 inventário · 🟡 SDD.
2. **Cada `op` tem oráculo e comando de prova.** Tabela §2.1 é o inventário congelado. *(hoje)* `node --test installer/__tests__/{preflight,merge-manifest,merge-v2-only,doctor,checks,suite,installer-upgrade-regression,golden,eixos-stack,cli,wizard}.spec.mjs` ⇒ verde. *(SDD)* `prova(op)` do §2.1 para cada uma das 23 ⇒ `diff` vazio, com envelope `v:1`, `op` igual ao solicitado. 🟢 specs · 🟡 differential.
3. **Ordem do `runUpgrade` preservada.** *(hoje)* `sed -n '2933,3008p' installer/install.mjs` mostra `plan` antes de `backup` e `checks` depois de `apply`; *(SDD)* `diff -u <(grep -nE 'runDoctor\(|planUpgrade\(|backup\(|applyUpgrade\(|runChecks\(' "$ORACULO/installer/install.mjs") <(grep -nE … binário)` ⇒ mesma sequência relativa; `grep -c 'report.verdict' <upgrade>` mostra que o veredito do doctor **não** é gate. 🟢 fonte · 🟡 differential.
4. **Backup verificado antes do `apply` (I1/FU-20).** *(hoje)* `node --test installer/__tests__/checks.spec.mjs` (FU-20) e `suite.spec.mjs` (I1) ⇒ verde; `install.mjs:1599-1604`. *(SDD)* `prova(backup)` com `injectFailure` ⇒ `exit 1`, `BACKUP_FAIL`/`BACKUP_UNVERIFIED`, hash do destino idêntico. 🟢 oráculo · 🟡 SDD.
5. **Dry-run = 0 writes, sem backup/confirm/checks.** *(hoje)* `node --test installer/__tests__/suite.spec.mjs` (INS-03) ⇒ `passed:null`, nenhum `.harness-backup-*`; *(SDD)* `a=$(find . | sort | sha256sum); …contract-v1 com dryRun…; b=$(find . | sort | sha256sum); test "$a" = "$b" && test "$exitCode" = 0`. 🟢 Node · 🟡 SDD.
6. **Doctor somente leitura, D0..D6 exit 0/1.** *(hoje)* `node --test installer/__tests__/doctor.spec.mjs` (INS-11/INS-12) ⇒ 7 marcadores, 0 writes; *(SDD)* `prova(runDoctor)` ⇒ `SAUDÁVEL`/`ATENÇÃO`/`QUEBRADO` e `exitCode` idênticos ao oráculo. 🟢 Node · 🟡 SDD.
7. **Mensagem 4-linhas e vocabulário de códigos.** *(hoje)* `node --test installer/__tests__/suite.spec.mjs` (INS-01) ⇒ `[ERRO]`/`porquê: <code>`/`como corrigir:`/`onde ver:`; `sed -n '1529,1544p' installer/install.mjs` ⇒ 23 códigos + `UNKNOWN`. *(SDD)* `prova(formatError)` para cada código do vocabulário ⇒ byte-equal; nenhum código novo. 🟢 oráculo · 🟡 SDD.
8. **Textos de usage/help fixados.** *(hoje)* `sed -n '2462,2470p' installer/install.mjs` ⇒ 9 linhas literais; `cli.spec.mjs` cobre `--help`. *(SDD)* `diff -u <(node "$ORACULO/installer/install.mjs" --help) <("$INSTALLER_BIN" contract-v1 <<<"$REQ_printUsage" | node -e '…')` ⇒ vazio; `--help` ⇒ `0`, sem `--target` ⇒ `1`. 🟢 oráculo · 🟡 SDD.
9. **Create-only do `init` e rejeição de conflito.** *(hoje)* `node --test installer/__tests__/suite.spec.mjs` (IN-06 I2) e `grep -n 'assertCreateOnly' installer/install.mjs` (`:2522`); *(SDD)* `prova(runInit)` com destino sujo ⇒ `flagged-open`, `exit 1`, 0 writes, fix apontando `doctor`; `upgrade` com `flag` ⇒ `collisions` e continua (não aborta). 🟢 oráculo · 🟡 SDD.
10. **Merge v2-only e idempotência por efeito.** *(hoje)* `node --test installer/__tests__/merge-v2-only.spec.mjs` (T1..T8) + evidência histórica 508/508; *(SDD)* `prova(mergeOpencodeJson)` + `prova(runUpgrade)` 2× ⇒ 2ª `noop`, schema intacto em conteúdo/mtime/inode (BF-02b). 🟢 oráculo · 🟡 SDD.
11. **`exitCode` nos 4 call sites.** *(hoje)* `node --test installer/__tests__/installer-upgrade-regression.spec.mjs` (BF-03: `runInit`, `main`, `runCli`, wizard) ⇒ `0` válido / `1` reprovado; *(SDD)* tabela cruzada com envelope do oráculo nos 4 caminhos ⇒ nenhum `0` em silêncio. 🟢 oráculo · 🟡 SDD.
12. **Vereditos congelados lidos sem Rust.** *(hoje)* comandos do §2.3 ⇒ títulos/literais extraídos e `sha256` registrado; *(SDD)* `git diff --exit-code -- installer/__tests__/*.spec.mjs .spec/archive/…/wizard-react-transcript.txt` ⇒ vazio no ciclo; `grep -rn 'cargo insta accept' installer/ .spec/prd/prd-installer-rust/` ⇒ vazio como comando executável; differential só contra `c63e333`. 🟢 arquivo · 🟡 processo.
13. **Número publicado é re-derivável.** *(hoje)* `grep -n '12/12' PRD.md` ⇒ todas as ocorrências rotuladas `meta`; baseline é `9 byte-equal + 2 parciais`, dry-run medido em 2. *(SDD)* relatório só escreve `12/12` após SI-1/SI-2/SI-3 nos 12 presets. 🟢 prosa verificável.
14. **Oráculo materializado por SHA, somente leitura.** *(hoje)* `test "$(git -C "$ORACULO" rev-parse HEAD)" = c63e33307710e1c6271f5c68b2dd9fb15283f49c && test -z "$(git -C "$ORACULO" status --porcelain)"` ⇒ `0`. *(SDD)* mesma checagem antes de cada `prova(op)` do §2.1. 🟢 git.
15. **Registry, selo e suíte intactos.** *(hoje)* `node --input-type=module -e "import {sealCommands} from './.opencode/plugins/lib/seal.mjs';import fs from 'node:fs';console.log(sealCommands(JSON.parse(fs.readFileSync('harness.config.json','utf8')).commands))"` ⇒ `c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2`; `node scripts/static-checks.mjs` ⇒ exit `0` com `PASS PRD-01`/`PASS ADR-01`/`PASS ADR-02`. *(SDD)* `git diff --exit-code -- harness.config.json .opencode/plugins/lib/seal.mjs` ⇒ vazio; suíte Rust em comandos paralelos, nunca no selo. 🟢 runtime.
16. **1:1 do ledger e escopo do batch.** *(hoje)* `git show --stat --name-only HEAD` ⇒ só `.spec/prd/prd-installer-rust/**`; *(SDD)* `node scripts/static-checks.mjs` ⇒ `PASS ADR-01` (uma linha por `ADR.md`), `PASS ADR-02` (sequência 1-2-3, 1 `in-progress`, branch no padrão). 🟢 runtime · 🟡 PR humano.
17. **Escopo de decisão — nada é pinado aqui.** *(hoje)* nenhum `clap`/`anyhow`/`thiserror`/`Cargo.toml`/versão aparece como decidido; só em `RESEARCH.md` §2/S1/S2/S3 e no §2.4 como critério; `git status --short` ⇒ vazio após o commit. 🟢 processo.

## 4. Alternativas descartadas — com custo medido

| Alternativa | Custo medido neste repo | Por que não |
|---|---|---|
| Fixar `clap`/`anyhow`/`thiserror` e versões **neste ADR** | 3 linhas de `Cargo.toml`; owner não pinou crate (S1/S2/S3 são insumo) | Fonte é recomendação, não decisão; o ADR escolhe o **critério** (§2.4) e deixa crate/versão para o SDD com fonte. Pinar aqui seria inventar decisão §16 |
| "Corrigir" a ordem do `upgrade` — backup antes de `plan`, ou abortar no veredito `QUEBRADO` do `doctor` | 2 mudanças de ordem; quebra `runUpgrade:2933-3008`, `doctor.spec.mjs:222` (EX-BE-05) e `BF-02b` | É reescrita do comportamento do oráculo, não paridade. Ordem nova só por §16 + diff declarado (SI-6) |
| Reduzir 23 `op`s a um punhado "equivalente" | Aparente economia no dispatcher; quebra a regra de não-órfão de ADR-001 §5 e os 22 consumidores | Nome da `op` = nome do export; fundir `op`s cria vocabulário novo sem oráculo (SI-6) |
| Promover `planUpgrade`/`applyUpgrade` a `op` | 2 nomes a mais na tabela | São 2 dos 20 exports sem import externo (ADR-001 §5) — internos ao binário, não compatibilidade |
| Usar o binário Rust para gerar os vereditos congelados | 0 linha de literal novo; produz `S == f(S)` | Guarda tautológica de ADR-002 §2.1 / `PRD.md` §3.5 — verde sem prova; os vereditos são arquivos anteriores, lidos por `grep`/`sha256` (§2.3) |
| Aceitar `.snap.new` como baseline do `doctor`/`upgrade` | 1 comando `cargo insta accept`; S8 classifica saved master como *unvalidated* | Bug virado baseline; `insta` só revisor de diff e literal só com rito de ADR-002 §2.4 |
| Deixar a crate de parser definir texto de help/erro | 0 trabalho de pinagem; texto divergente de `printUsage`/`formatError` | Texto é saída comparada (critério §2.4.1); o oráculo vence, nunca a crate |

## 5. Consequências, riscos e reversibilidade

- **C1 — paridade ganha ponto de aplicação por `op`.** Cada uma das 23 linhas da tabela tem oráculo, comando e código de saída; nenhum "deve ser equivalente" sem medição (§3 itens 1–2).
- **C2 — a ordem congelada é contrato, não detalhe.** As duas ordens de §2.2 são preservadas por entrypoint; o SDD que as unificar reprova em EX-BE-05/BF-02b.
- **C3 — reversibilidade.** Reverter o motor = desligar o dispatcher de `contract-v1` e manter o oráculo como fonte; `gate.js`, `harness.config.json` e o selo nunca mudaram. Custo de reversão: módulos Rust e adapter, 0 arquivo de config/gate.
- **R1 — crate gera texto divergente.** Risco alto de parser (RESEARCH §2 A1); mitigação: critério §2.4.1 + golden (ADR-002); 🟠 aberto até o SDD.
- **R2 — reescrita involuntária da ordem.** "Refactor" tenta naturalmente mover `backup` antes de `plan`; mitigação: tabela de falhas de §2.2 + item 3 da interface + diff contra `c63e333`; 🟠 aberto até o SDD.
- **R3 — conflito de `init` mal tratado.** `flagged-open` virar "merge automático" destrói dados do usuário; mitigação: item 9 + Brain `merge-de-config-remocao-por-forma` (remoção por forma, nunca por nome); 🟠 aberto até o SDD.
- **R4 — idempotência do schema.** 2ª execução reescreve schema (mtime/inode) quebra BF-02b; mitigação: `noop` por efeito, item 10; 🟠 aberto até o SDD.
- **R5 — cobertura Rust fora do selo (D6).** Custo aceito; `RESEARCH.md` §8-R2 pede ciência do owner no G2. Não é comando canônico novo — é não republicar `c904f1c5`.
- **R6 — veredito congelado expirado sem rubrica nova.** `sha256` divergente ou decisão §16 muda o literal; mitigação: §2.3.6 + rito de ADR-002 §2.4; 🟡 processo.

## 6. Fora desta decisão

- as 8 `op`s de TUI, as 10 telas W0..W7/W2m, prompts/defaults/ranges e cleanup de terminal — ADR-004 (aqui só os canais/herança de `runWizard`);
- publicação npm, `optionalDependencies`, runtime do adotante e distribuição do binário — ADR-005;
- crate, versão, toolchain, formato de binário e `Cargo.toml` — SDD, escolhidos pelo critério do §2.4 com fonte S1/S2/S3;
- o procedimento SI-1..SI-6, `insta`, o rito de validação humana e a registry de 6 mapas — ADR-002;
- o contrato `contract-v1`, canais, envelope, segredo, exit `0/1/2`, os 12 presets e o selo `c904f1c5…` — ADR-001/ADR-002 + D1/D2/D4/D5/D6/D7, fechados;
- qualquer alteração em `gate.js`, `harness.config.json`, `opencode.json`, `workflow-state.json`, presets, eixos, comandos canônicos ou defaults de menu.

## 7. Verificação de prontidão deste batch

```sh
git status --short                                   # vazio; só .spec/prd/prd-installer-rust/** no commit
git rev-parse HEAD                                   # SHA local registrado no retorno do subagente
node scripts/static-checks.mjs                       # exit 0; PASS PRD-01 / ADR-01 / ADR-02 não-vacuosos
git show --stat --name-only HEAD                     # só ADR.md + ADR-INDEX.md deste PRD
grep -ciE 'TO''DO|S''TUB' .spec/prd/prd-installer-rust/ADRs/ADR-003-motor-init-doctor-upgrade/ADR.md   # 0
```
