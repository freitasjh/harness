# Specification — `upgrade` no instalador do harness (v1)

- **Domínio:** `governanca-de-agentes` · **Tipo:** `feature`
- **Status:** `Em análise — aguardando security review + architect`
- **Spec baseline (pai):** `.spec/archive/20260929-harness-installer/SPEC.md` (RF-01..RF-10, I1..I6, ADR-001..ADR-007)
- **Código afetado (único):** `installer/install.mjs` + `installer/__tests__/` · **Docs afetados:** `docs/INSTALACAO.md`
- **Compatibilidade:** Node ESM ≥ 20 (mesmo runtime de `init`/`doctor`); destino = qualquer repo já instalado por este instalador

> **Problema fundador:** `init` é greenfield create-only e **aborta com `REINSTALL`**
> (`installer/install.mjs:73-96`) quando `.harness-install.json` existe. Não existe
> caminho suportado para levar um destino já instalado da versão anterior do
> harness para a versão atual. O usuário fica entre reinstalar por cima (perda
> de estado) ou editar na mão (deriva). Este SPEC fecha essa porta com um
> comando `upgrade` **overwrite-gerenciado, backup-first, idempotente**.
>
> **Defeito que este SPEC existe para impedir (por construção):** perder
> configuração do destino, ou aplicar qualquer escrita sem backup verificado.

---

## 1. Escopo

### 1.1 In (o que este SPEC cobre)

| # | Item |
|---|---|
| IN-A | Comando CLI `upgrade` (dispatch novo em `parseArgs`/`runCli`), um comando por invocação |
| IN-B | Overwrite **gerenciado**: substituir as camadas gerenciadas pela versão atual do harness, **sem merge** |
| IN-C | Pré-condição de manifesto: exige `.harness-install.json` próprio e parseável |
| IN-D | Backup automático + **verificado** antes da primeira escrita, com restore documentado |
| IN-E | `--dry-run` read-only (zero writes, nem backup cria) |
| IN-F | Idempotência: 2 execuções consecutivas ⇒ 2ª não escreve nada |
| IN-G | Atualização do manifesto (versão pós-upgrade, hashes, backup, `upgradedFrom`) |
| IN-H | Gating idêntico ao `init` (`--target`, `--allow-root`, node mínimo, fence `assertInside`) |
| IN-I | Restore hook: falha no meio da escrita ⇒ rollback do backup verificado |
| IN-J | Delta specs (`docs/INSTALACAO.md`, `installer/__tests__/`) |

### 1.2 Out (explicitamente fora — com razão)

| # | Item | Por que fora |
|---|---|---|
| OUT-1 | **Merge** (`planMerge`, `mergeOpencodeJson`, `mergeAgentFile`, união de `plugin[]`, append de seção `Harness v7`) | Decisão do usuário (vinculante): upgrade é overwrite gerenciado, sem merge. Merge continua existindo só no caminho `init`. |
| OUT-2 | **Remover arquivos user-owned** (conteúdo do destino que não é camada gerenciada) | Upgrade nunca apaga o que não inventariou; risco de perda de dado do usuário é o defeito que este SPEC evita. |
| OUT-3 | **Upgrade remoto / via git** (`git pull`, `npx harness@latest`, rede, fetch) | Zero dependências é invariante do instalador (SPEC pai §4). Upgrade é **local**: usa o harness que está em disco (`INSTALLER_ROOT`). |
| OUT-4 | Desinstalação (`uninstall`) | Porta deixada: `manifest.installed` + `backupDir` já permitem; SPEC próprio futuro. |
| OUT-5 | Migração de `manifestSchemaVersion` (1 → 2) | Nenhum campo é quebrado nesta feature; só campos aditivos. |
| OUT-6 | Detecção/migração de stack do destino além do que `manifest.answers` já traz | `answers` do manifesto é a fonte; `--answers-file` só sobrepõe. |
| OUT-7 | `doctor --fix` | `doctor` permanece read-only D0–D6; humano resolve. |

---

## 2. CLI — uso e flags

### 2.1 Uso

```
uso: node installer/install.mjs upgrade --target <dir> [--dry-run] [--answers-file <json>] [--yes] [--backup-dir <dir>] [--allow-root]
  upgrade: destino já instalado — substitui as camadas gerenciadas pela versão atual do harness (sem merge).
  exige .harness-install.json próprio no target (senão NOT_INSTALLED: rode init).
  --dry-run: zero writes (nem backup cria); imprime plano + relatório.
```

Regras de sintaxe (herdadas de `parseArgs`, `installer/install.mjs:1188-1212`):

- **Um comando por invocação** — `upgrade` entra em `CLI_COMMANDS`; posicional extra aborta com `BAD_ANSWER`.
- `upgrade` **não aceita flag nova**: reutiliza exatamente o vocabulário de `init`
  (`--target`, `--dry-run`, `--answers-file`, `--yes`/`-y`, `--backup-dir`, `--allow-root`, `--help`/`-h`).
  Nenhuma bandeira nova significa nenhum branch novo de parsing — e nenhuma entrada
  não documentada em `docs/INSTALACAO.md` §0.

### 2.2 Flags

| Flag | Efeito no `upgrade` | Origem / reuso |
|---|---|---|
| `--target <dir>` | Obrigatório. Destino já instalado. Resolvido absoluto; segmento `..` aborta `OUTSIDE_TARGET` | `preflight` `install.mjs:52-97` |
| `--dry-run` | **Read-only**: plano + relatório, zero writes (nem backup, nem manifesto) | `main` `install.mjs:1050-1058`, `dryRunNotice` `install.mjs:992-995` |
| `--answers-file <json>` | JSON objeto que **sobrepõe** as respostas base do manifesto (`--answers-file` vira a fonte quando presente, como em `init`) | `loadAnswersFile` `install.mjs:1214-1228`, `collectAnswers` `install.mjs:338-349` |
| `--yes` / `-y` | Dispensa a confirmação por camada (`confirmByLayer`) | `install.mjs:1412-1441` |
| `--backup-dir <dir>` | Onde gravá-lo. Recusado se igual/aninhado ao target (nos dois sentidos, realpath incluído) | `resolveBackupDir` `install.mjs:146-163` |
| `--allow-root` | Permite uid 0; sem ele `UID_ROOT` (idêntico ao `init`) | `preflight` `install.mjs:70-73` |
| `--help` / `-h` | Imprime uso (incluindo a linha `upgrade`) e sai 0 | `printUsage` `install.mjs:1744-1752` |

Sem `--answers-file` e sem stdin utilizável ⇒ `NO_STDIN` (nunca trava). Sem `--yes`
e com stdin utilizável ⇒ confirmação **por camada gerenciada** antes de escrever.

### 2.3 Fluxo (ordem fixa, espelha `main`)

```
U0 preflight + gate de manifesto     (read-only; aborta sem escrever)
U1 doctor pré-execução D0–D6         (read-only; veredito vai para o manifesto)
U2 respostas (manifesto ± answers-file) + geração do config
U3 plano de upgrade (create | overwrite | noop | remove)   (read-only, classificador PURO)
U4 dry-run? → relata e encerra (exit 0)   |  real: confirmação por camada
U5 backup (verificado) → apply → restore-hook em falha → manifesto → checks
```

`U1` é read-only por construção (`runDoctor` nunca chama `writeManifest`), então
não pode introduzir write antes do backup — INV-01 permanece intacta. Se o
destino estiver sem manifesto, `U0` já abortou antes, então o `D5` do doctor
sempre encontra manifesto próprio.

Camadas gerenciadas (fronteira exata da escrita — `LAYER_PREFIX`, `install.mjs:101-109`):

```
opencode.json · .agents/agents · .agents/rules · .agents/schemas
.agents/skills · .opencode/plugins · harness.config.json
```

Conteúdo instalado vem de `collectIncoming(INSTALLER_ROOT, { stacks })`
(`install.mjs:1159-1186`) — **o harness que está em disco**, nunca rede (OUT-3).

---

## 3. Gate de manifesto — pré-condição do `upgrade`

`upgrade` **exige** `.harness-install.json` no target. Isso é o que o separa de
`init` (que aborta justamente por ele existir).

| Situação | Código | Comportamento |
|---|---|---|
| Manifesto ausente | `NOT_INSTALLED` | Aborta. Fix no bloco 4-linhas: `rode init --target <dir>` |
| Manifesto presente, JSON inválido | `MANIFEST_INVALID` | Aborta. Nunca tenta adivinhar/sobrescrever estado corrompido |
| Manifesto presente, JSON válido, mas **não é nosso** (`manifestSchemaVersion !== 1` ou `source` não-string) | `FOREIGN_MANIFEST` | Aborta. Humano resolve (regra já existente, `install.mjs:84-94`) |
| Manifesto próprio e parseável | — | Segue. `manifest.version` vira `upgradedFrom` |

Razão de abortar em manifesto inválido (e não prosseguir "no escuro"): o
manifesto é a **fonte do inventário harness-owned** (o que pode ser removido sem
perder dado do usuário) e das **respostas do destino** (base do config). Sem ele
não há como distinguir user-owned de harness-owned — e remover errado é
exatamente o defeito que este SPEC impede (INV-03).

Nota de compat: `upgrade` chama `preflight` com `skipManifestGuard: true`
(aifo de `doctor`, `install.mjs:834`) e aplica o gate acima — o guard de
`REINSTALL` é exclusivo do `init`.

---

## 4. Modelo de Dados — delta do manifesto

`manifestSchemaVersion` permanece **1**: só campos **aditivos e opcionais**
(manifesto escrito pelo `init` antigo continua legível; `upgrade` só os preenche).

| Campo novo | Tipo | Quando | Para quê |
|---|---|---|---|
| `upgradedFrom` | `{ version, date, source } \| null` | toda execução real | auditoria do caminho de upgrade; `null` só em manifesto de `init` |
| `removed[]` | `{ path, reason }` | quando há prune | prova do que saiu e por quê (`stale-harness-owned`) |
| `collisions[]` | `{ path, previousSha256, incomingSha256 }` | quando path user-owned colide com path incoming | overwrite nunca é silencioso (ADR-005) |
| `backups[]` | `{ backupDir, date, verified }` | toda execução real | o backup **desta** execução + os anteriores (cadeia de restore) |
| `answersSource` | `'manifest' \| 'answers-file'` | toda execução real | rastreia de onde vieram as respostas usadas |
| `doctorPre` | `{ verdict, counts, failed }` | toda execução real | veredito do doctor rodado antes do upgrade (auditoria do estado de entrada) |
| `checks` | `{ passed, failed[] }` | pós-apply | idêntico ao `init`; `runChecks` inalterado |

Campos preservados do baseline (`buildManifest`, `install.mjs:592-622`):
`version`, `date`, `source`, `target`, `installed[]`, `merged[]`, `flagged[]`,
`backupDir`, `answers`, `manifestSchemaVersion`, `fileHashes[]`,
`flaggedResolution[]`, `validationMarks[]`.

Regra de escrita: `upgrade` grava o manifesto **por último** (depois de
`runChecks`), como `main` já faz (`install.mjs:1096-1101`) — manifesto na árvore
é a última verdade, nunca um estado intermediário.

---

## 5. Requisitos Funcionais (RF)

| ID | Requisito | Enforcement / origem |
|---|---|---|
| **RF-01** | Comando `upgrade` no dispatch (`CLI_COMMANDS` + `runCli`); um comando por invocação; `printUsage` lista o uso | `install.mjs:1188-1212`, `1744-1752` |
| **RF-02** | Gating idêntico ao `init`: `--target` obrigatório e sem `..`, node ≥ 20, uid 0 só com `--allow-root`, toda escrita dentro da fence `assertInside` | `preflight` `install.mjs:52-97`, `assertInside` `install.mjs:43-50` |
| **RF-03** | Exigir manifesto próprio e parseável; ausente ⇒ `NOT_INSTALLED`, inválido ⇒ `MANIFEST_INVALID`, estrangeiro ⇒ `FOREIGN_MANIFEST`. Aborta com 0 writes nos três casos | §3 deste SPEC |
| **RF-04** | **Doctor pré-execução obrigatório**: roda D0–D6 (`runDoctor`, read-only, zero writes) antes de classificar o plano; imprime `[INFO] D0..D6` em ordem e o veredito, e o registra em `manifest.doctorPre`. `D0` do doctor já cobre o inventário (`inventory`) do destino | `runDoctor` `install.mjs:825-925` |
| **RF-05** | Respostas: base = `manifest.answers`; `--answers-file` sobrepõe e valida (`collectAnswers`/`validateAnswer`); `generateConfig` gera `harness.config.json` — **nunca copia** | `install.mjs:338-349`, `365-405` |
| **RF-06** | Plano de upgrade classificável **sem escrever**: ações `create` (arquivo gerenciado ausente), `overwrite` (existe e difere), `noop` (existe e idêntico), `remove` (harness-owned stale). Classificador é **puro** (sem sink), display no chamador | novo `planUpgrade`, espelha `planMerge` `install.mjs:477-529` |
| **RF-07** | Confirmação por camada antes de escrever; `--yes` dispensa; dry-run dispensa e não escreve | `confirmByLayer` `install.mjs:1412-1441` |
| **RF-08** | **Backup automático antes de qualquer write**, cobrindo as camadas gerenciadas + manifesto, em `--backup-dir` ou ao lado do target (**nunca dentro**, nunca aninhado — realpath incluído) | `backup` `install.mjs:165-184`, `resolveBackupDir` `install.mjs:146-163` |
| **RF-09** | **Backup verificado antes de liberar escrita**: `requireVerifiedBackup` (dir existe + `verified === true`); falha ⇒ `BACKUP_UNVERIFIED`/`BACKUP_FAIL`, 0 writes | `install.mjs:1042-1047` (I1/FU-20) |
| **RF-10** | **Apply overwrite gerenciado sem merge**: substitui o arquivo gerenciado pelo conteúdo atual do harness; nada de união/append/flag. Conteúdo ausente para um path do plano ⇒ `MISSING_INCOMING` (recusa write vazio silencioso) | `applyMerge` `install.mjs:546-584` (FU-21) adaptado |
| **RF-11** | **Restore hook**: falha durante o apply ⇒ rollback do backup verificado (restaura gerenciados + manifesto), sai com `RESTORED` e instrução manual no bloco 4-linhas | novo; ver §7.3 |
| **RF-12** | **Manifesto atualizado** ao final: `version`/`source` = versão atual do harness, `date`, `upgradedFrom`, `backups[]`, `removed[]`, `installed[]`, `fileHashes[]` recomputados, `checks` preenchido | `buildManifest` `install.mjs:592-622`, `writeManifest` `install.mjs:929-935` |
| **RF-13** | **Idempotência**: 2ª execução consecutiva produz plano 100% `noop` e **zero writes** (mtime da árvore intacta), exit 0 | §7.2 + teste dedicado |
| **RF-14** | `--dry-run` **read-only**: não cria backup, não escreve manifesto, não roda checks (`passed: null`, `ran: false`, `skipped: true`), imprime `dryRunNotice()`; exit 0 | `install.mjs:1050-1058`, `1077-1083`, `992-995` |
| **RF-15** | **Writes só no target**: fence `assertInside` em cada path do plano; `OUTSIDE_TARGET` aborta antes de escrever. `backupDir` é a única exceção documentada (vive fora, por desenho) | `install.mjs:43-50`, §130-135 (FU-22) |
| **RF-16** | Exit codes: `0` sucesso/dry-run · `1` abort (qualquer `InstallError` antes/ao escrever) · `2` escrito mas `checks` FAIL · `3` rollback executado (`RESTORED`) | §7.4 |
| **RF-17** | Erros saem no bloco 4-linhas (`formatError`) com códigos do vocabulário (`ERROR_CODES`); `NOT_INSTALLED`/`MANIFEST_INVALID`/`RESTORED` **entram no vocabulário** | `install.mjs:972-990` |
| **RF-18** | Segredo nunca persiste: `answers` serializado sem `secret` (`serializeAnswers`), log sanitizado (`sanitizeLog`) | `install.mjs:352-359`, `957-967` |
| **RF-19** | Dogfood do destino permanece protegido: alvo fora de `/tmp` exige `--target` explícito + confirmação (`DOGFOOD_GUARD`) | `assertDogfoodTarget` `install.mjs:1010-1038` |

**Total: 19 RFs.**

---

## 6. Architecture Decision Records (ADRs)

### ADR-001: `upgrade` é comando irmão do `init`, não flag dele
- **Decision**: novo subcomando `upgrade` em `CLI_COMMANDS`, nunca `--upgrade`.
- **Contexto**: `parseArgs` já impõe "um posicional por invocação"
  (`install.mjs:1201-1209`); `init` e `doctor` já são irmãos. Um flag criaria
  estado duplo no mesmo caminho (create-only vs overwrite) e um terceiro modo de
  falha silencioso.
- **Trade-offs**: mais uma linha no dispatch e no usage; ganha-se um contrato
  explícito por caminho e testes independentes.

### ADR-002: Overwrite gerenciado, **sem merge** (decisão do usuário, vinculante)
- **Decision**: `upgrade` substitui cada camada gerenciada pelo conteúdo atual do
  harness. `mergeOpencodeJson`, união de `plugin[]`, append de seção
  `Harness v7`, `flag` de conflito — **não rodam** no caminho upgrade.
- **Contexto**: merge em camada já instalada produz híbrido
  destino-versão-antiga + harness-versão-nova que ninguém consegue raciocinar
  depois; e cada conflito vira `flag` pendente, que reprova os checks (I6). O
  destino que quer customizar recebe **backup + restore**, não merge.
- **Trade-offs**: edição local em camada gerenciada é substituída — aceito pelo
  usuário. Mitigação obrigatória: RF-08/09 (backup verificado), RF-11 (restore
  hook), `collisions[]` e `removed[]` no manifesto (prova do que mudou).

### ADR-003: Manifesto como fonte do caminho de upgrade
- **Decision**: `.harness-install.json` é pré-condição (RF-03) e fonte de três
  coisas: inventário harness-owned (o que pode ser removido), respostas do
  destino (RF-05) e versão anterior (`upgradedFrom`).
- **Contexto**: sem inventário não há como podar arquivo stale de versão antiga
  sem arriscar apagar coisa do usuário; sem respostas, o config seria
  "adivinhado" — que é exatamente o modo de falha Hive que o SPEC pai combate.
- **Trade-offs**: manifesto corrompido bloqueia o upgrade (`MANIFEST_INVALID`) —
  escolha deliberada: abortar com instrução é melhor que escrever sem saber.

### ADR-004: Backup atômico (diretório único, verificado, inviolável)
- **Decision**: um snapshot por execução em diretório **fora** do target
  (`--backup-dir` ou `<pai-do-target>/.harness-backup-<basename>-<iso>`),
  criado e **verificado** antes da primeira escrita; a cadeia de backups da
  execução atual e das anteriores fica no manifesto (`backups[]`).
- **Contexto**: escrever em repo alheio é a ação mais perigosa do programa
  (SPEC pai ADR-003). "Atômico" aqui = **tudo-ou-nada por execução**: o backup
  cobre 100% das camadas gerenciadas + manifesto antes de qualquer write, e a
  restauração devolve a árvore ao estado anterior completo.
- **Trade-offs**: disco ocupado; aceito (segurança > economia). Exceção
  documentada e testada: `backupDir` fora da fence `assertInside` (FU-22) — a
  fence vale para arquivos instalados, não para o backup.

### ADR-005: Prune só do inventariado (nunca adivinha o que é do usuário)
- **Decision**: `remove` só se aplica a path listado em `installed[]`/`merged[]`
  do manifesto anterior **e** ausente do incoming atual, com
  `reason: 'stale-harness-owned'`. Arquivo em camada gerenciada que **não** está
  no inventário é tratado como **user-owned**: não é removido; se colide com um
  path do incoming, é sobrescrito mas registrado em `collisions[]`.
- **Contexto**: remover arquivo user-owned está explicitamente fora do escopo
  (OUT-2) e é o defeito nº 1 deste SPEC.
- **Trade-offs**: sobra de arquivo user-owned dentro de `.agents/skills`
  persiste após o upgrade — correto: não é nosso para apagar.

### ADR-006: Restore hook automático em falha de escrita
- **Decision**: o apply é envolto por journaling de escrita; qualquer exceção
  dispara rollback do backup verificado (restaura gerenciados + manifesto,
  remove criados nesta execução) e exit `3` com `RESTORED`.
- **Contexto**: overwrite em N arquivos tem janela de falha parcial (disco
  cheio, EACCES, symlink surgindo no meio). Sem rollback, o destino fica em
  estado híbrido que nem o `init` (create-only) nem o `doctor` (read-only)
  resolvem sozinhos.
- **Trade-offs**: rollback best-effort, não transacional de SO. Falha do próprio
  rollback ⇒ aviso explícito + instrução manual de restore (RF-11) — nunca
  silêncio.

### ADR-007: `upgrade` escreve o manifesto só depois do apply
- **Decision**: `writeManifest` + `runChecks` acontecem depois do apply, na mesma
  ordem de `main`; em dry-run, checks **não rodam** (`passed: null`).
- **Contexto**: rodar checks contra árvore velha produziria PASS enganoso;
  `passed: null` é desconhecido honesto (FU-28), nunca leia como PASS.
- **Trade-offs**: nenhum.

### ADR-008: Respostas do destino são preservadas, não re-perguntadas
- **Decision**: base = `manifest.answers` (já serializado, sem segredo).
  `--answers-file` sobrepõe **inteiramente** e passa por `collectAnswers`
  (validação contra o real, ADR-005 do SPEC pai). Sem `--answers-file` em
  terminal interativo, o Q&A completo é oferecido (com os valores do manifesto
  como default) — o destino nunca perde `project`/`stack`/`suiteCommand` por
  acidente.
- **Contexto**: `harness.config.json` é sempre **gerado** (ADR-002 do SPEC pai,
  I3). Ler o config do destino para descobrir as respostas seria copiar config
  alheio — proibido.
- **Trade-offs**: `deployToken` (secret) não existe no manifesto; se o destino
  precisa dele, passa por `--answers-file` nesta execução.

### ADR-009: `upgrade` local, sem rede e sem git
- **Decision**: conteúdo instalado vem de `collectIncoming(INSTALLER_ROOT)`; não
  há fetch, `git pull`, `npx` ou versão remota.
- **Contexto**: zero dependências é invariante do instalador (SPEC pai §4).
  Atualizar o harness é responsabilidade do humano/dono do repo harness.
- **Trade-offs**: "upgrade" aqui significa "alinhar o destino ao harness em
  disco". Documentado no usage e em `docs/INSTALACAO.md`.

---

## 7. Invariantes, fluxo de escrita e exit codes

### 7.1 Invariantes (INV)

| # | Invariante | Enforcement | Garantia |
|---|---|---|---|
| **INV-01** | Nada é escrito antes do backup existir **e** ser verificado, cobrindo 100% das camadas gerenciadas + manifesto | `requireVerifiedBackup` antes do apply (RF-09) | 🟢 teste dedicado (positivo + negativo) |
| **INV-02** | Toda escrita está dentro do target; `backupDir` é a única exceção (vive fora, por desenho) | `assertInside` por path (RF-15) | 🟢 |
| **INV-03** | Nenhum arquivo user-owned é removido; `remove` só do inventário do manifesto | ADR-005 + teste com arquivo plantado fora do inventário | 🟢 |
| **INV-04** | Dry-run é read-only: zero writes (nem backup, nem manifesto) e checks não rodam | `dryRun` curto-circuita backup/apply/manifesto (RF-14) | 🟢 teste com snapshot de mtime/árvore |
| **INV-05** | O manifesto pós-upgrade reflete a versão atual do harness (`version`, `source`, `date`, `fileHashes` recomputados) — nunca a anterior | `buildManifest` reescrito por último (RF-12) | 🟢 |
| **INV-06** | Idempotência: 2ª execução consecutiva ⇒ plano 100% `noop`, zero writes, exit 0 | RF-13 + teste 2× | 🟢 |
| **INV-07** | Respostas do destino preservadas (base = manifesto) e config sempre gerado, nunca copiado | ADR-008 + `generateConfig` | 🟢 |
| **INV-08** | Segredo nunca persiste (manifesto, config, log) | `serializeAnswers` + `sanitizeLog` (RF-18) | 🟢 fixture injeta token e greppa artefatos |
| **INV-09** | Falha de escrita ⇒ árvore restaurada do backup verificado antes de sair | ADR-006 journaling + rollback (RF-11) | 🟢 teste injeta falha no meio do apply |

### 7.2 Idempotência — definição operacional

`upgrade` é idempotente quando, aplicado 2× seguidas no mesmo destino:

1. a 1ª execução escreve as camadas gerenciadas diferentes e o manifesto novo;
2. a 2ª execução classifica **todos** os itens como `noop` (bytes idênticos,
   comparados por `sha256` do conteúdo, não por mtime);
3. a 2ª execução realiza **zero writes** — nem backup, nem manifesto;
4. ambas saem com exit `0` e checks PASS.

Nuance honesta: se o destino editar uma camada gerenciada entre as duas
execuções, a 2ª volta a sobrescrever (por desenho, ADR-002) — idempotência é
sobre o estado que o próprio `upgrade` produz, não sobre o destino.

### 7.3 Fluxo de escrita com restore hook (RF-08/09/11)

```
confirmByLayer ──► backup(gerenciados + manifesto) ──► requireVerifiedBackup ──► apply com journal
                                                                        │
                                            exceção em qualquer write ◄───┘
                                                    │
                                    rollback: restaura backup + remove criados
                                                    │
                                   exit 3 · RESTORED · bloco 4-linhas com backupDir
```

Journal por execução: lista de `{ path, action, previousExisted, previousBytes? }`
em memória (nunca em disco) — suficiente para desfazer a execução atual, porque o
estado anterior completo já está no backup verificado.

### 7.4 Exit codes

| Código | Significado | Exemplos |
|---|---|---|
| `0` | Sucesso (checks PASS) **ou** dry-run executado | — |
| `1` | Abort — nada escrito (ou aborta antes do apply) | `BAD_TARGET`, `NOT_INSTALLED`, `MANIFEST_INVALID`, `FOREIGN_MANIFEST`, `NODE_MIN`, `UID_ROOT`, `BACKUP_FAIL`, `BACKUP_UNVERIFIED`, `OUTSIDE_TARGET`, `BAD_ANSWER`, `NO_STDIN`, `USER_ABORT`, `DOGFOOD_GUARD`, `MISSING_INCOMING` |
| `2` | Escreveu, mas checks reprovaram | `manifest-missing`, `json-invalid`, `literal-denied`, `plugin-parse`, `config-ref-missing` |
| `3` | Rollback executado — árvore restaurada do backup verificado | falha de I/O no meio do apply (`RESTORED`) |

Códigos novos no vocabulário (`ERROR_CODES`, `install.mjs:972-978`):
`NOT_INSTALLED`, `MANIFEST_INVALID`, `RESTORED`.

---

## 8. Security Assessment — Fase 1 (skill `security-review`)

> Superfície real: um script que **sobrescreve** arquivos em repo alheio. Ameaça
> = o instalador como vetor. Checklist orientado a aplicação; adaptado.

### 8.1 Threat Model (STRIDE)

| Ameaça | Fluxo | Risco | Mitigação | Status |
|---|---|---|---|---|
| **Tampering** | escrita fora do `--target` (typo, `..`, symlink no caminho) | Alto | `preflight` + `assertInside` + symlink não resolvido ⇒ aborta antes de escrever (RF-02/15) | 🟢 mitigado |
| **Tampering** | backup falha e escrita prossegue | Alto | INV-01 (`requireVerifiedBackup` antes do apply) | 🟢 mitigado |
| **Information Disclosure** | segredo do Q&A parado em manifesto/config/log | Alto | INV-08 (`serializeAnswers` + `sanitizeLog`); upgrade reusa, não cria caminho novo | 🟢 mitigado |
| **Repudiation** | "não fui eu que mudou a versão do harness no destino" | Médio | manifesto com `upgradedFrom`, `backups[]`, `date`, `fileHashes`, `answersSource` | 🟢 mitigado |
| **Elevation** | rodar como root amplifica qualquer escrita errada | Médio | `UID_ROOT` sem `--allow-root` (idêntico ao `init`) | 🟢 mitigado |
| **Tampering** | aplicar em manifesto estrangeiro/corrompido e sobrescrever estado alheio | Médio | RF-03 aborta (`FOREIGN_MANIFEST`/`MANIFEST_INVALID`), 0 writes | 🟢 mitigado |
| **Denial of Service** | disco cheio no meio do apply ⇒ destino em estado híbrido | Médio | journaling + restore hook, exit 3 (ADR-006) | 🟡 residual declarado |
| **Spoofing** | "upgrade" que baixa versão remota (supply chain) | Alto | ADR-009: zero rede, conteúdo só do harness em disco | 🟢 mitigado |

### 8.2 Gaps

- 🔴 **Críticos: 0**
- 🟡 **Médio: 1** — restore hook é best-effort: se o rollback falhar (ex.: disco
  realmente cheio), o destino pode ficar parcial. Mitigação: bloco 4-linhas com
  `backupDir` explícito + `docs/INSTALACAO.md` documenta o restore manual.
  Dono: PLAN (task de teste de falha dupla: write falha **e** restore falha).
- 🟢 **Baixo: 0**

---

## 9. Test Strategy

Testes em `installer/__tests__/upgrade.spec.mjs` (Node `node --test`, zero deps,
fixtures em `os.tmpdir()` — nunca no repo real). Convenção do repo: cada
invariante com **positivo + negativo**.

### 9.1 Unit / fixtures (instalador)

| # | Caso | RF / INV cobertos | Verificação |
|---|---|---|---|
| T-01 | happy path: `init` em tmp → modifica camada gerenciada (simula versão antiga) → `upgrade` → bytes == incoming, `upgradedFrom` preenchido, exit 0 | RF-06/10/12, INV-05 | byte-compare + `manifest.version === VERSION` |
| T-02 | backup verificado antes de escrever: `injectFailure` / backupDir inexequível ⇒ `BACKUP_FAIL`/`BACKUP_UNVERIFIED` e **0 writes** | RF-08/09, INV-01 | snapshot da árvore antes/depois idêntico |
| T-03 | dry-run read-only: nenhum write (backup, manifesto, camadas), `checks.passed === null`, aviso `NÃO EXECUTADO` no stdout, exit 0 | RF-14, INV-04 | snapshot de mtime + `fs.readdirSync` |
| T-04 | manifesto ausente ⇒ `NOT_INSTALLED`, 0 writes; manifesto inválido ⇒ `MANIFEST_INVALID`; manifesto estrangeiro ⇒ `FOREIGN_MANIFEST` | RF-03 | 3 fixtures |
| T-05 | idempotência: `upgrade` 2× consecutivas ⇒ 2ª run plano 100% `noop`, 0 writes, exit 0, `fileHashes` idênticos | RF-13, INV-06 | hash da árvore antes/depois da 2ª run |
| T-06 | prune: arquivo listado em `installed[]` e ausente do incoming ⇒ `removed[]` com `reason: stale-harness-owned` | RF-06/12, ADR-005 | assert removido + registrado |
| T-07 | **user-owned preservado**: arquivo em camada gerenciada fora do inventário e fora do incoming ⇒ **não** removido | INV-03, OUT-2 | assert ainda existe |
| T-08 | colisão: path user-owned == path incoming ⇒ sobrescrito e registrado em `collisions[]` (nunca silencioso) | ADR-005 | assert `collisions[0].path` |
| T-09 | respostas preservadas: sem `--answers-file`, `manifest.answers` vira base do config; com `--answers-file`, valida e sobrescreve; `harness.config.json` sempre **gerado** (difere byte-a-byte de qualquer template) | RF-05, INV-07, ADR-008 | diff contra template ≠ 0 |
| T-10 | restore hook: escrita falha no meio do apply ⇒ rollback restaura a árvore (hash idêntico ao pré-upgrade), exit 3, `RESTORED`, `backupDir` no bloco | RF-11, INV-09, ADR-006 | fixture com `fsImpl` injetável que falha no N-ésimo write |
| T-11 | falha dupla (write falha **e** rollback falha) ⇒ aviso explícito + instrução manual, nunca silêncio | §8.2 gap médio | assert mensagem contém `backupDir` |
| T-12 | fence: path do plano fora do target, `..` no `--target`, symlink/atalho no caminho ⇒ `OUTSIDE_TARGET` antes de qualquer write | RF-02/15, INV-02 | reusa `zone.mjs` |
| T-13 | gating: uid 0 sem `--allow-root` ⇒ `UID_ROOT`; node < 20 ⇒ `NODE_MIN` (injetado via `nodeVersion`) | RF-02 | 2 asserts |
| T-14 | `--answers-file` inválido (JSON não-objeto, caminho inexistente) ⇒ `BAD_ANSWER` | RF-05 | reusa `loadAnswersFile` |
| T-15 | segredo: `--answers-file` com `deployToken` ⇒ token **ausente** em manifesto, config e stdout | RF-18, INV-08 | grep nos 3 artefatos |
| T-16 | checks pós-upgrade reprovando ⇒ exit 2 (diferenciável de abort = 1) | RF-16 | fixture com plugin corrompido |
| T-17 | `MISSING_INCOMING`: path no plano sem conteúdo ⇒ recusa write vazio | RF-10 | assert exception |
| T-18 | `upgrade` sobre destino com **arquivo stale em `.opencode/plugins`** (saiu do incoming atual) ⇒ removido; plugin user-owned (fora do inventário) ⇒ preservado | ADR-005, INV-03 | 2 asserts |
| T-19 | confirmação por camada: sem `--yes` e stdin recusando ⇒ `USER_ABORT`, 0 writes | RF-07 | leitor injetado |
| T-20 | uso/help: `printUsage` contém a linha `upgrade`; `parseArgs(['upgrade','--target','x'])` aceita; posicional extra aborta | RF-01 | string assert |
| T-21 | doctor pré-execução: `upgrade` imprime `D0..D6` em ordem, com 0 writes, e o veredito entra em `manifest.doctorPre`; doctor QUEBRADO **não** bloqueia o upgrade (é read-only, diagnóstico) | RF-04 | grep dos marcadores + mtime intacto |

### 9.2 Dogfood (diretório temporário)

Roteiro em `/tmp` (trava `assertDogfoodTarget` ativa — `DOGFOOD_GUARD`):

1. `init` num destino tmp limpo (destino "versão antiga": editar uma rule e um plugin).
2. `doctor --target <dir>` ⇒ veredito registrado (também exercitado dentro do `upgrade`, RF-04/T-21).
3. `upgrade --dry-run` ⇒ 0 writes (mtime intacto).
4. `upgrade` real ⇒ checks PASS, exit 0, `upgradedFrom` correto.
5. `upgrade` **2ª vez** ⇒ 0 writes, exit 0 (idempotência, INV-06).
6. **restore de backup**: `cp -r <backupDir>/. <target>/` + apagar o manifesto ⇒ destino volta ao estado anterior (verificado por hash).
7. Suite do repo-harness intacta (upgrade não altera o repo de origem).

### 9.3 Regressão

Suite existente (`installer/__tests__/suite.spec.mjs`, `golden.spec.mjs`,
`cli.spec.mjs`) permanece verde: `init`/`doctor`/legado inalterados nos caminhos
existentes (delta aditiva em `CLI_COMMANDS`/`printUsage`).

---

## 10. Riscos

| R | Sev | Mitigação |
|---|---|---|
| R1 perda de edição do usuário em camada gerenciada (overwrite por desenho) | alto | backup verificado (RF-08/09) + `collisions[]` + restore documentado (RF-11) |
| R2 remover arquivo user-owned por inventário incompleto | alto | prune só do inventário do manifesto (ADR-005); manifesto inválido ⇒ abort (RF-03) |
| R3 backup gravado dentro do target (recursão/autofagia) | alto | `resolveBackupDir` recusa igual/aninhado nos dois sentidos, realpath incluído |
| R4 falha de escrita no meio do apply (disco, EACCES) | alto | journaling + rollback, exit 3 (ADR-006); falha dupla documentada |
| R5 dry-run que escreve | alto | T-03 com snapshot; `dryRun` curto-circuita backup/apply/manifesto |
| R6 manifesto velho após upgrade (diz versão anterior) | médio | INV-05 + T-01 assert `manifest.version === VERSION` |
| R7 destino perde segredo ao não re-passar `--answers-file` | médio | ADR-008 documenta; `deployToken` nunca esteve no manifesto |
| R8 atalho/symlink no caminho do target escapa da fence | médio | reusa `zone.mjs` (T-12) + trava dogfood |
| R9 divergência de inventário (manifesto lista arquivo já removido na mão) | baixa | `removed[]` só de caminhos ausentes do incoming; se já não existe em disco, `noop` |

---

## 11. Verificação (gate do PLAN)

| # | Verificação | Critério |
|---|---|---|
| V1 | T-01..T-21 | todos verdes (cada INV com positivo + negativo) |
| V2 | idempotência | 2× run ⇒ 2ª com 0 writes (INV-06) |
| V3 | dry-run | 0 writes, `passed: null` (INV-04) |
| V4 | restore | rollback automático (exit 3) **e** manual por `backupDir` verificados |
| V5 | doctor pré-execução | marcadores D0..D6 em ordem + 0 writes + `manifest.doctorPre` preenchido |
| V6 | dogfood | roteiro §9.2 completo ✅ |
| V7 | regressão | `init`/`doctor`/legado verdes (golden intacto) |
| V8 | assert spec-gate | conformidade §12 |
| V9 | exit codes | 0/1/2/3 cobertos por teste (T-01, T-02/T-04, T-16, T-10) |

---

## 12. Conformidade — asserts `sdd-compiler`

Arquivos de assert (fonte da verdade):

- `.agents/skills/sdd-compiler/asserts/spec-gate.md` (este gate)
- `.agents/skills/sdd-compiler/asserts/plan-gate.md` (próxima fase)
- `.agents/skills/sdd-compiler/asserts/tasks-gate.md`
- `.agents/skills/sdd-compiler/asserts/verify-gate.md`
- `.agents/skills/sdd-compiler/asserts/traceability-gate.md` (RF→Task→Code)
- `.agents/skills/sdd-compiler/asserts/proposal-gate.md` (retroativo — ver §13)

### 12.1 `spec-gate.md` — critério a critério

| Critério do assert | Status | Justificativa |
|---|---|---|
| **ADRs** | ✅ §6 (ADR-001..009) | cada decisão crítica com Decision/Contexto/Trade-offs |
| **DDD Modular** (api/impl/public) | **N/A justificado** | não há código de aplicação: feature é um script Node ESM + testes, mesma fronteira do SPEC pai. A separação real existente é funções puras (`planUpgrade`, sem I/O) vs. efeitos (`backup`/`apply`) — ver RF-06 |
| **Segurança/IAM** (JWT, `@HasPermission`) | **N/A justificado** | instalador não tem modelo de autenticação de app; roda com privilégios do humano que o invoca. Equivalente real: §8 (STRIDE) + fences `assertInside`/`preflight`/dogfood + segredo fora do disco |
| **ERD** | **N/A justificado** | sem banco. Modelo de dados é o delta do manifesto JSON (§4) |
| **Event Registry** (produtor/consumidor/payload) | **N/A justificado** | sem mensageria; instalador é linear e local, zero rede (ADR-009) |
| **Migrations** (Flyway `V{YYYYMMDD}{NNN}`) | **N/A justificado** | sem banco. Equivalente: evolução do `manifestSchemaVersion` (§4) — permanece 1, só campos aditivos |
| **Invariantes de Entidade** | ✅ §7.1 INV-01..09 | propriedades sempre verdadeiras da execução de upgrade |
| **Invariantes de Workflow** | ✅ §7.2/7.3/7.4 | fluxo U0→U5 com transições de estado (abort / escreveu / checks-FAIL / restaurado) e idempotência operacional |
| **Test Strategy** | ✅ §9 | unit com fixtures em tmp + dogfood 2× + restore de backup + regressão |
| **Single File** | ✅ este arquivo | — |
| **Domínio claro** | ✅ `governanca-de-agentes` | herdado do SPEC pai |

### 12.2 `traceability-gate.md` — preparação

Cada RF-01..RF-19 tem caminho de task planejado (PLAN/TASKS) e teste
correspondente em §9 (mapeamento RF→T-xx explícito na coluna "RF / INV
cobertos"). Risco de orphaned spec: **zero** — nenhum RF sem teste; nenhum teste
sem RF. Score esperado no gate: ≥ 90%.

---

## 13. Spec Score

**~92%** — 0 críticos abertos.

| Dimensão | Nota | Observação |
|---|---|---|
| ADRs | 10/10 | 9 ADRs, todos com trade-off honesto |
| Invariantes | 10/10 | INV-01..09 testáveis, positivo+negativo |
| Requisitos | 9/10 | 19 RFs sem ambiguidade de escrita; RF-05 depende de `--answers-file` (documentado) |
| Segurança | 9/10 | 1 gap médio declarado (restore best-effort), dono no PLAN |
| Escopo | 10/10 | In/Out com razão; 7 exclusões explícitas |
| Testabilidade | 9/10 | dogfood exige `/tmp` + confirmação (já existente no repo) |

Débito conhecido (declarado, não escondido): sem `uninstall` (OUT-4), sem migração
de `manifestSchemaVersion` (OUT-5), sem upgrade remoto (OUT-3).

**Retroativo ao `proposal-gate`:** este SPEC entra direto em `generate-spec` por
decisão do solicitante (feature pequena, escopo já fechado pelas 3 decisões
vinculantes). O PROPOSAL correspondente fica como **delta sintético**: §1
(In/Out) + §6 (ADRs) + §10 (Riscos) cobrem problema/solução/escopo/risco. Se o
gate exigir o artefato, ele é gerado a partir destas seções sem retrabalho.

---

## 14. Delta Specs

> Formato de `references/delta-template.md`; usado no `archive` para atualizar
> os documentos alvo.

### Delta: `docs/INSTALACAO.md` — **MODIFIED**

**ADDED** (seção nova, inserir após §2 `doctor`):

```
## 3. `upgrade` — destino já instalado (overwrite gerenciado, sem merge)

Substitui as camadas gerenciadas pela versão atual do harness.
Exige .harness-install.json próprio (senão NOT_INSTALLED: rode init).

  1. doctor  --target <dir>                       # diagnóstico read-only
  2. upgrade --target <dir> --dry-run             # plano, zero writes
  3. upgrade --target <dir> --yes                 # real (backup automático antes)
  4. upgrade --target <dir> --yes                 # 2ª vez: zero writes (idempotente)

Flags: --target | --dry-run | --answers-file | --yes | --backup-dir | --allow-root
Saída de sucesso: [OK] upgrade: pico-fim + checks: PASS (exit 0)

Restore (rollback manual, documentado):
  node -e "console.log(require('<target>/.harness-install.json').backupDir)"
  rm -rf <target>/{opencode.json,harness.config.json,.agents,.opencode}
  cp -r <backupDir>/. <target>/
  # confira: ls <target>/.harness-install.json (voltou ao estado anterior)
```

**MODIFIED** (§0 "Flags reais" e §1 "init greenfield"):

- §0: acrescentar a linha de uso `upgrade` ao bloco de uso (espelhar `printUsage`).
- §1: deixar explícito que `REINSTALL` em destino instalado **não** é mais beco
  sem saída — a saída é `upgrade`.

**MODIFIED** (§5 Troubleshooting) — 4 códigos novos:

| Código novo | Porquê | Correção |
|---|---|---|
| `NOT_INSTALLED` | `upgrade` sem `.harness-install.json` no target | rode `init --target <dir>` primeiro |
| `MANIFEST_INVALID` | manifesto presente mas JSON inválido | corrija o JSON ou restaure o backup; nunca deixe o upgrade prosseguir no escuro |
| `RESTORED` | escrita falhou no meio; rollback executado (exit 3) | inspecione `backupDir`; resolva a causa (disco/permissão) e rode de novo |
| `MISSING_INCOMING` | path no plano sem conteúdo | bug do instalador ou harness corrompido — reporte |

**REMOVED** (§5, linha `REINSTALL`): a frase "siga caminho de upgrade" passa a
apontar para a seção nova em vez de texto sem destino.

### Delta: `installer/__tests__/` — **ADDED**

**ADDED**:

```
installer/__tests__/upgrade.spec.mjs    # T-01..T-20 (+ INV positivo/negativo)
```

**MODIFIED** (só se o golden quebrar — expectativa: não quebra):

```
installer/__tests__/cli.spec.mjs        # caso novo: dispatch upgrade + posicional extra
installer/__tests__/golden.spec.mjs     # somente se printUsage entrar no baseline
```

### Delta (secundário, coerente fora do pedido): `.agents/skills/harness-installer/SKILL.md` — **MODIFIED**

**ADDED**: quickstart de 4 passos + bloco de restore (idêntico ao de
`docs/INSTALACAO.md` §3 nova). Mantém a skill auto-suficiente sem ler SPEC.

### Resumo do impacto

| Documento | ADDED | MODIFIED | REMOVED |
|---|---|---|---|
| `docs/INSTALACAO.md` | 1 seção + 4 códigos | §0, §1, §5 | 0 seções (1 frase reescrita) |
| `installer/__tests__/` | 1 arquivo | 2 (condicional) | 0 |
| `.agents/skills/harness-installer/SKILL.md` | 1 bloco | 1 seção | 0 |
