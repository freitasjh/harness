# ADR-001 — Fronteira de subprocesso e contrato: binário Rust invocado por subprocesso, com envelope estruturado, segredo confinado a stdin e registry congelado injetado

- **prd-id**: `prd-installer-rust` — `.spec/prd/prd-installer-rust/PRD.md`
- **order**: 1 de 5 (`.spec/prd/prd-installer-rust/ADR-INDEX.md`)
- **status**: `in-progress`
- **branch**: `adr/prd-installer-rust/01-fronteira-subprocesso` (aberta de `abfc281`; HEAD local `13dce58` — commit do orquestrador que materializou o inventário deste ADR)
- **depende-de**: — (primeira ADR do fatiamento D8). Pressupõe o PRD aprovado no G1 (`PRD.md` §16, D1–D8 fechadas) e o inventário/critério de `RESEARCH.md` §5 (tema D, fontes S9/S10/S11) e §7. Precedente **estrutural, não dependência**: `ADR-001` do PRD-2 (`.spec/archive/20261116-prd-prd-agnostic-artifacts/ADRs/ADR-001-criterio-cdl-e-instrumento/ADR.md`) — forma de "1 ADR = 1 branch = 1 PR", `depende-de`, interface numerada com comando por item e `módulo puro + adapter`. Nenhuma rubrica daquele ADR é reaberta aqui.
- **data**: 2026-11-16
- **dono da decisão**: owner do harness. **D1** (subprocesso/CLI, sem FFI e sem dois motores), **D4** (Node `c63e333` como oráculo), **D6** (selo `c904f1c5` invariante) e **D7** (binário autocontido, Node≥20 no destino) são insumo fechado; este ADR os implementa como contrato, não os reabre. D2/D3/D5/D8 pertencem aos ADR-002/004 e ao índice.
- **rota**: refactor de fronteira de API. Nenhum comportamento de instalação é mudado; muda o modo de invocação e o destino dos exports.
- **escopo de escrita desta entrega**: apenas `.spec/prd/prd-installer-rust/**` — neste batch, somente este `ADR.md`. Nenhum arquivo de `installer/**`, `scripts/**`, `.opencode/**`, `.agents/**`, `harness.config.json`, `gate.js`, `opencode.json` ou `workflow-state.json` foi tocado. O adapter, os módulos e as specs migradas são o **SDD** deste ADR.
- **insumo de pesquisa**: `RESEARCH.md` §5 (D1/D2 — argv + stdout estruturado, stdin/`--answers-file` + TTY), §7 (recomendação ADR-001 com critério), §8-R3/R7 (oráculo físico; fronteira de 22 consumidores), §1 (S9 `Command`/`ExitStatus`, S10 `IsTerminal`, S11 leitura de senha sem eco).

## 1. Contexto — fatos medidos, não deduzidos

Medições de 2026-11-16 neste repo. Cada linha tem comando ou `arquivo:linha`; nenhum número abaixo é estimativa.

| Fato | Valor | Comando / fonte |
|---|---|---|
| Exports em `installer/install.mjs` | **95** | `grep -c '^export ' installer/install.mjs` |
| Exports importados por consumidores | **75** | varredura de `import {…} from '…install.mjs'` nos 22 arquivos (§4), cruzada com `Object.keys(await import('./installer/install.mjs'))` |
| Exports sem import externo | **20** | os 95 menos os 75; lista em `PRD.md` §3.2 |
| Consumidores | **22** (4 grupos) | §4; `gate.js` tem **0** referência ao instalador (`grep -c 'install\.mjs\|installer/' .opencode/plugins/gate.js` ⇒ `0`) |
| Mapas injetados | **6**, em `scripts/static-checks.mjs:81` | `AXIS_IDS`, `SKILLS_BY_AXIS`, `SKILLS_COMMON`, `RULES_BY_AXIS`, `RULES_COMMON`, `STACKS_FOR_EXCEPTIONS`; congelados em `CDL_EXPORTS` (`:85-92`) e passados a `runCdlChecks` (`:497`, `:517`) |
| Módulos que recebem injeção | **3** `lib/**/checks.mjs` | `cdl`, `inventory`, `refs` — não leem `installer/` como dependência de runtime; o adapter é que importa e injeta |
| Códigos de saída atuais | **0** sucesso/help/dry-run, **1** qualquer recusa/aborto/falha de checks | `install.mjs:1470-1472`, `:1665`, `:2761`, `:2764`, `:2773` |
| Canais atuais | `stdout` = progresso e `printPlan`/`printUsage`; `stderr` = erro sanitizado | `runCli` `:2605-2606`; `say` `:2493`, `:2940`; `printPlan` `:1967`; `printUsage` `:2462` |
| Segredo | 1 pergunta sensível (`deployToken`); `serializeAnswers` a omite; `sanitizeLog` redaciona; `canNoEcho` exige `isTTY && setRawMode`; `readSecretRaw` ecoa só máscara | `install.mjs:227`, `:718-727`, `:1514-1523`, `:1839-1891`; comando de prova em §2.3 |
| Selo | `c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2` | `sealCommands(commands)` sobre `harness.config.json.commands.suiteFull` |
| Oráculo | `c63e33307710e1c6271f5c68b2dd9fb15283f49c` é **ancestral** do HEAD; `git diff --stat c63e333 HEAD -- installer/` ⇒ vazio | `git merge-base --is-ancestor c63e333 HEAD` ⇒ `0`; conteúdo do instalador hoje é idêntico, mas o pin é por SHA porque o SDD vai mudar esses bytes |

**O defeito que esta ADR fecha.** A API do instalador é um arquivo de 3.010 linhas que é biblioteca e CLI ao mesmo tempo. Um rewrite que apenas "faça o CLI funcionar" deixa 22 consumidores órfãos e a suíte vermelha (R3 do PRD); um rewrite que exponha a biblioteca como FFI cria dois motores e viola D1; um rewrite sem canal de segredo transforma `deployToken` em argv visível. O contrato precisa ser **uma fronteira verificável**, não uma preferência de implementação.

## 2. Decisão

**O instalador Rust é um binário autocontido invocado por subprocesso. A fronteira é um contrato de versão 1 com três canais (`stdin` JSON, `stdout` envelope JSON, `stderr` humano sanitizado), códigos de saída idênticos aos do oráculo (0/1) mais um código de protocolo nunca emitido pelo oráculo (2), segredo confinado a `stdin`/arquivo de respostas/TTY sem eco e nunca em argv, stdout ou stderr. Os 75 exports importados recebem destino congelado em dois módulos Node estáveis de compatibilidade — um de dados de registry, um de adapter — de modo que os 22 consumidores mudam o especificador de import, não o vocabulário. Os 6 mapas continuam sendo injetados; `gate.js`, `harness.config.json` e o selo `c904f1c5` ficam byte-idênticos.** 🟢 para a forma do contrato (decisão do owner D1/D4/D6/D7 + fontes S9/S10/S11); 🟡 para execução e migração (é o SDD desta ADR que as prova).

### 2.1 Formato do contrato — canais

`$INSTALLER_BIN` é o **nome lógico do entrypoint do contrato**, não nome de crate (crate/versão ficam no ADR-003; framework de tela no ADR-004). O subcomando `contract-v1` é a única superfície estável. Cada requisição nomeia uma `op` com o **mesmo nome do export** que substitui — nenhum vocabulário novo é inventado.

| Canal | Conteúdo congelado | Proibição |
|---|---|---|
| **stdin** | Um documento JSON por chamada: `{"v":1,"op":"generateConfig","args":{…},"answers":{…},"target":"…"}`. `answers` é o único lugar onde value sensível pode entrar em modo scriptado; `--answers-file <path>` é alternativa e leva **só o caminho** em argv. Em TTY interativo, o segredo é lido pelo binário via TTY sem eco (S10/S11), não por `read_line` normal. | Nenhum valor sensível em argv. Nenhum prompt interativo quando `stdin` não é TTY e `answers`/`--answers-file` estão presentes. |
| **stdout** | **Exatamente um envelope JSON** por processo: `{"v":1,"ok":true,"op":"…","result":{…}}` ou `{"v":1,"ok":false,"op":"…","error":{"code":"…","what":"…","why":"…","fix":"…","where":"…"}}`. `result.answers` usa a mesma regra de `serializeAnswers` (`PRD.md` §3.2 / `install.mjs:718-727`): campo `secret` **ausente**. `error` espelha o bloco 4-linhas de `formatError`. | Nenhuma linha humana, nenhum valor sensível, nenhum progresso em stdout. Envelope ausente ou inválido ⇒ falha de protocolo (exit 2). |
| **stderr** | Toda linha que hoje vai para `stdout` como progresso (`say`/`log`) e toda linha de erro, **byte-comparável ao oráculo depois de `sanitizeLog`**. É o canal humano; em TTY, os dois canais aparecem na mesma tela e o transcript permanece idêntico (SI-4). | Nenhum JSON de envelope; nenhum segredo em claro (sanitização obrigatória antes do `write`). |
| **exit code** | `0` = sucesso/help/dry-run (mesmo significado de `install.mjs:2761`, `:2541`); `1` = recusa/aborto/veredito QUEBRADO/falha de checks (`:1470-1472`, `:1665`, `:2773`); `2` = **somente** erro de protocolo da fronteira (JSON inválido, `v` desconhecido, `op` não registrado, envelope ausente) — o oráculo nunca emite 2. Terminação por sinal é `ExitStatus`, não erro de spawn (S9); o adapter **nunca** a converte em 0. | Nenhum código novo para comportamento de instalação; 2 não é "falha de instalação", é falha do contrato. |

Comandos de exemplo — um por canal (executados no SDD; `$INSTALLER_BIN` e `$REQUEST` são definidos pelo harness de paridade):

```sh
# stdin — request; segredo entra aqui (pipe), nunca em argv
printf '%s\n' "$REQUEST" | "$INSTALLER_BIN" contract-v1 >/tmp/r.json 2>/tmp/r.err

# stdout — envelope único e interpretável
node -e 'const e=JSON.parse(require("fs").readFileSync("/tmp/r.json","utf8"));
  if(e.v!==1||typeof e.ok!=="boolean"||typeof e.op!=="string") process.exit(2);
  console.log(e.op, e.ok)'

# stderr — progresso/erro humano sanitizado
grep -E '^\[(OK|INFO|AVISO)\]|^abort:' /tmp/r.err

# exit code — 0/1 do oráculo, 2 só de protocolo
printf '%s\n' "$REQUEST" | "$INSTALLER_BIN" contract-v1 >/tmp/r.json 2>/tmp/r.err
ec=$?; test "$ec" -eq 0 -o "$ec" -eq 1 -o "$ec" -eq 2
```

**Escolha de roteamento declarada (não é mudança de comportamento).** O oráculo escreve progresso em stdout e devolve o resultado como valor de função; um subprocesso não tem "valor de função", logo o resultado passa a ser o envelope em stdout e o progresso migra para stderr. A paridade é sobre o **conteúdo observável**: a união dos bytes de stdout+stderr do binário tem de corresponder ao que o oráculo produzia, e o transcript de tela (SI-4) compara a visão mesclada. Qualquer divergência de conteúdo é divergência de comportamento e cai em SI-6 (decisão do owner), nunca "detalhe de canal".

### 2.2 Códigos de saída — mapeamento congelado

| Saída | Oráculo (`c63e333`) | Binário | Adapter Node |
|---|---|---|---|
| sucesso / `--help` / dry-run | `0` | `0` + envelope `ok:true` | `resolve()` |
| aborto `q`/EOF/Ctrl+C, `BAD_TARGET`, `NODE_MIN`, `UID_ROOT`, checks reprovados, `flagged-open` | `1` | `1` + envelope `ok:false` com `error.code` do vocabulário de `ERROR_CODES` (`install.mjs:1530+`) | `reject(ContractError)` com `code` preservado |
| JSON inválido / `v` desconhecido / `op` não registrado / envelope ausente | não existe | `2` | `reject(ProtocolError)` — nunca confundido com falha de instalação |
| sinal (SIGTERM/SIGKILL) | `ExitStatus` com sinal | `ExitStatus` com sinal | `reject(SignalError)`; sem eco de terminal pendente (risco S5 mitigado no ADR-004) |

### 2.3 Contrato de segredo — proibição com prova

- **argv**: nenhum valor sensível. `--answers-file` carrega **caminho**, nunca conteúdo. `IsTerminal` (S10) decide se há prompt; a leitura sem eco usa mecanismo da família `readpass` (S11) no TTY — escolha de crate é do ADR-004, não desta ADR.
- **stdout**: envelope é derivado de `serializeAnswers`, que já omite `secret` (`install.mjs:718-727`); `error` passa por `sanitizeLog` antes de virar envelope.
- **stderr**: toda linha passa por `sanitizeLog(linha, answers)` exatamente como `runCli:2605-2606` — a sanitização acontece **antes** do `write`, não depois.
- **memória/disco**: o valor sensível existe só no request stdin/TTY e na memória do processo até a gravação legítima de respostas; nunca entra em manifesto, log ou envelope.

Prova sobre o oráculo (comando executado nesta data; saída literal):

```sh
node --input-type=module -e '
import {QUESTIONS,serializeAnswers,sanitizeLog,canNoEcho,stripAnsiControls} from "./installer/install.mjs";
console.log("secretQuestions="+QUESTIONS.filter(q=>q.secret).map(q=>q.key).join(","));
console.log("serializeSkips="+!("deployToken" in serializeAnswers({deployToken:"SEGREDO_PROVA",project:"x"})));
console.log("sanitizeLog="+sanitizeLog("token=SEGREDO_PROVA",{deployToken:"SEGREDO_PROVA"}));
console.log("canNoEchoPipe="+canNoEcho({isTTY:false})+" canNoEchoTTY="+canNoEcho({isTTY:true,setRawMode(){}}));
console.log("stripAnsi="+JSON.stringify(stripAnsiControls("\u001b[31mAB\u001b[0m")));
'
# secretQuestions=deployToken
# serializeSkips=true
# sanitizeLog=token=[REDACTED]
# canNoEchoPipe=false canNoEchoTTY=true
# stripAnsi="AB"
```

Prova no binário (critério do SDD, não implementado aqui): com o segredo enviado apenas por stdin e o processo em pé, `tr '\0' ' ' </proc/$PID/cmdline` **não contém** `SEGREDO_PROVA`; `grep -F SEGREDO_PROVA /tmp/r.json /tmp/r.err` ⇒ nenhuma ocorrência; aborto no prompt (`q`/EOF/Ctrl+C) ⇒ exit `1` e hash do destino idêntico ao de antes.

### 2.4 Aborto e zero escrita

O contrato herda a invariante de `PRD.md` §3.7: a camada de tela não grava; `apply` é o único ponto de escrita. Qualquer saída antes de `apply` (`q`, EOF, Ctrl+C, `BAD_ANSWER`, preflight recusado, `--dry-run`) termina com exit `1` (dry-run com `0`, como no oráculo) e **0 escrita**, provada por `find . | sort` + `sha256` do destino antes/depois (`PRD.md` §3.4, hash histórico `063c1ddc…`). O adapter não faz "limpeza" de arquivos criados — não há arquivos para limpar.

### 2.5 Os 6 mapas injetados e o selo (efeito explícito)

- **`scripts/static-checks.mjs:81`**: o especificador do import muda de `../installer/install.mjs` para `../installer/contract-registry.mjs` — um módulo **de dados puros, gerado/congelado** no SDD a partir do oráculo `c63e333`, sem lógica de instalação. A forma de `CDL_EXPORTS` (`:85-92`), a injeção em `runCdlChecks(..., { exports: CDL_EXPORTS })` (`:497`, `:517`) e os 3 módulos `lib/**/checks.mjs` **não mudam**: continuam recebendo os 6 mapas pelo mesmo parâmetro e continuam fail-closed se `exports` faltar. Nenhum `lib/**/checks.mjs` passa a importar `installer/`.
- **Destino sem `scripts/`**: como `scripts/` não é propagado ao adotante, o runner do destino obtém os mesmos 6 mapas do binário por `{"v":1,"op":"registry"}` — na prática, uma `op` de leitura que devolve os mapas no envelope. **Não é segundo motor**: é a mesma projeção de dados, com o mesmo formato, verificada byte-a-byte contra os literais congelados (ADR-002). Isto resolve a aresta C7 do `ADR-001` do PRD-2 ("o destino herda o módulo, não o runner").
- **Selo (D6)**: `commands.suiteFull` e `HARNESS_SEAL_JSON` (`c904f1c5…`) permanecem inalterados; o harness de paridade e a suíte Rust rodam em **comandos paralelos fora do selo**. Custo aceito e declarado em `RESEARCH.md` §8-R2: cobertura Rust não entra na contraprova selada. Nenhum comando novo é acrescentado a `harness.config.json`.

### 2.6 Oráculo `c63e333` materializado no SDD

**Mecanismo: worktree destacado e somente leitura, criado pelo SDD fora da árvore de trabalho, referenciado por SHA.** O procedimento é do ADR-002; esta ADR fixa apenas a forma de materialização e a regra de não-contaminação:

```sh
ORACULO=/tmp/opencode/harness-oracle-c63e333
git worktree add --detach "$ORACULO" c63e333       # uma vez, pelo SDD
test "$(git -C "$ORACULO" rev-parse HEAD)" = c63e33307710e1c6271f5c68b2dd9fb15283f49c
test -z "$(git -C "$ORACULO" status --porcelain)"  # qualquer sujeira invalida a corrida
node "$ORACULO/installer/install.mjs" <request.json   # executa como está; nunca edita
git -C "$ORACULO" worktree remove --force "$ORACULO"   # no fim do ciclo
```

**Por que não é "reescrever o oráculo":** (a) o `.mjs` executado vem de um commit imutável, em worktree `detach`, com verificação de SHA e de árvore limpa antes de cada corrida; (b) o sujeito sob teste é o binário Rust, nunca o worktree; (c) os literais independentes (`golden.spec.mjs`, `EXPECTED_STACKS` em `eixos-stack.spec.mjs:40`, transcript arquivado) continuam como contraprova externa — a lição do guarda tautológica (`PRD.md` §3.5,Brain `sessoes/projetos/harness/2026-10-18-harness-eixos-stack-batch1`) proíbe comparar o código novo consigo mesmo; (d) `c63e333` é ancestral do HEAD e hoje os bytes do instalador são idênticos, mas o pin por SHA é o que impede o oráculo de "acompanhar" o SDD quando esses bytes mudarem. Editar o worktree, apontá-lo para outra SHA ou gerar o baseline a partir do binário é **drift**, registrado — nunca substituição silenciosa.

## 3. Interface congelada

Forma ratificada a partir de D1/D4/D6/D7. Itens marcados *(SDD)* só passam a valer após a implementação; antes dela o comando mede o estado atual. Nível de garantia explícito.

1. **Fronteira única, sem FFI e sem dois motores.** O contrato é `contract-v1` sobre subprocesso; `gate.js` segue com 0 referência ao instalador. *(SDD)* `grep -c 'install\.mjs\|installer/' .opencode/plugins/gate.js` ⇒ `0`; `grep -c 'contract-v1' <adapter>` ⇒ `≥1`; `ls installer/*.so installer/*.dylib 2>/dev/null` ⇒ vazio. 🟢 processo + verificação estrutural.

2. **Versão e envelope.** `stdout` contém um e único JSON com `v:1`, `ok`, `op` e `result|error`; nenhum outro byte. *(hoje)* `node -e '…JSON.parse…'` do §2.1 sobre a saída do oráculo adaptado; *(SDD)* mesmo comando sobre o binário ⇒ `v 1`, `op` igual ao solicitado. 🟢 contrato.

3. **Canais separados.** `stdout` = envelope; `stderr` = progresso/erro sanitizado; progresso ausente de stdout e JSON ausente de stderr. *(SDD)* `grep -c '^\[OK\]' /tmp/r.json` ⇒ `0`; `grep -c '"v":1' /tmp/r.err` ⇒ `0`; `diff <(cat /tmp/r.json /tmp/r.err | sort) <(cat /tmp/oraculo.out | sort)` ⇒ vazio para o mesmo cenário. 🟢 SDD.

4. **Códigos de saída.** 0/1 idênticos ao oráculo; 2 exclusivo de protocolo; sinal nunca vira 0. *(hoje)* `grep -nE 'process.exit\(' installer/install.mjs` ⇒ apenas `0`/`1`; *(SDD)* tabela de 4 casos do §2.2 executada e comparada com `ExitStatus`. 🟢 SDD.

5. **Segredo ausente de argv, stdout e stderr.** `deployToken` é a única pergunta `secret`; `serializeAnswers` a omite e `sanitizeLog` redaciona. *(hoje)* comando de prova do §2.3 ⇒ 5 linhas literais; *(SDD)* `tr '\0' ' ' </proc/$PID/cmdline | grep -F SEGREDO_PROVA` ⇒ vazio e `grep -F SEGREDO_PROVA /tmp/r.json /tmp/r.err` ⇒ vazio. 🟢 oráculo · 🟢 SDD.

6. **TTY vs pipe.** `IsTerminal` (S10) escolhe prompt; sem TTY, `answers`/`--answers-file` é obrigatório e não há `setRawMode`. *(hoje)* saída do §2.3: `canNoEchoPipe=false canNoEchoTTY=true`; *(SDD)* transcript em TTY e em pipe com o mesmo `REQUEST` ⇒ mesmos prompts/defaults/ranges (SI-4). 🟢 oráculo · 🟡 transcript.

7. **Aborto sem escrita.** `q`/EOF/Ctrl+C antes de `apply` ⇒ exit `1`, 0 arquivo criado. *(hoje)* `harness/harness-eixos-stack.json:63-99` (2 presets, hash `063c1ddc…`); *(SDD)* `find . | sort | sha256sum` antes/depois idêntico e `grep -c 'exitCode":1' /tmp/r.json` ⇒ `1`. 🟡 SDD.

8. **Os 6 mapas continuam injetados.** `scripts/static-checks.mjs:81` muda só o especificador; `CDL_EXPORTS` e os 3 `lib/**/checks.mjs` intactos. *(hoje)* `sed -n '74,92p' scripts/static-checks.mjs`; *(SDD)* `node scripts/static-checks.mjs` ⇒ `PASS V19`, `PASS V20` com os mesmos números de `PRD.md` §3.6-M6; `grep -c 'installer/install.mjs' .opencode/plugins/lib/*/checks.mjs` continua `0` import de runtime. 🟢 repo · 🟡 destino.

9. **22/22 consumidores com veredito e 75/75 exports com destino.** Tabelas §4 e §5 são o inventário congelado; nenhum import órfão. *(hoje)* varredura de 22 arquivos ⇒ `75` nomes, `0` nome importado não-exportado; *(SDD)* `grep -rn "from '.*install.mjs'" scripts/ installer/ .opencode/ | wc -l` ⇒ `0` após a migração, com cada consumidor apontando para registry/adapter. 🟢 medição · 🟡 SDD.

10. **Oráculo materializado por SHA, somente leitura.** Worktree `detach` em `c63e333`, verificado antes de cada corrida. *(hoje)* `git merge-base --is-ancestor c63e333 HEAD && git diff --stat c63e333 HEAD -- installer/` ⇒ ancestral, diff vazio; *(SDD)* as 3 linhas do bloco do §2.6 ⇒ SHA correto e `status --porcelain` vazio. 🟢 git.

11. **Selo e comandos canônicos inalterados.** *(hoje)* `node --input-type=module -e "import {sealCommands} from './.opencode/plugins/lib/seal.mjs';import fs from 'node:fs';const c=JSON.parse(fs.readFileSync('harness.config.json','utf8')).commands;console.log(sealCommands(c))"` ⇒ `c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2`; *(SDD)* `git diff --exit-code -- harness.config.json .opencode/plugins/lib/seal.mjs` ⇒ vazio. 🟢 runtime.

12. **Suíte verde e 1:1 do ledger.** *(hoje)* `node scripts/static-checks.mjs` ⇒ exit `0` com `PASS PRD-01`, `PASS ADR-01` (1:1 índice↔disco, não-vacuo), `PASS ADR-02` (sequência e branch); `git show --stat --name-only HEAD` ⇒ só `.spec/prd/prd-installer-rust/**`. 🟢 runtime · 🟡 PR humano.

13. **Escopo de decisão.** Nenhum crate, versão, framework de CLI/TUI, toolchain de build, preset novo, default de menu novo ou comando canônico novo é decidido aqui. *(hoje)* `grep -nE 'clap|anyhow|thiserror|ratatui|inquire|dialoguer|Cargo\.toml' ADR.md` ⇒ só menções de "fora desta decisão" no §8; `git status --short` ⇒ vazio. 🟢 processo.

## 4. Rubrica dos 22 consumidores — 4 grupos, veredito por consumidor

Os quatro grupos vêm da natureza do acoplamento medido (PRD §3.3), não da ordem alfabética. "Contrato equivalente" = o consumidor continua vendo o mesmo nome e o mesmo tipo de dado; "substituído" = a chamada passa a ir pelo adapter/subprocesso; nenhum consumidor fica sem veredito.

| # | Grupo | Consumidor | Veredito | Como migra (SDD) |
|---|---|---|---|---|
| 1 | **G-INJ** (3) | `scripts/static-checks.mjs:81` | contrato equivalente | troca só o especificador do import dos 6 mapas para `contract-registry.mjs`; `CDL_EXPORTS`/injeção intactos |
| 2 | G-INJ | `.opencode/plugins/__tests__/cdl.spec.mjs:52` | contrato equivalente | mesmos 6 nomes do registry congelado; nenhuma asserção reescrita |
| 3 | G-INJ | `.opencode/plugins/__tests__/inventory.spec.mjs:49` | contrato equivalente | mesmos 4 nomes do registry congelado |
| 4 | **G-DOGFOOD** (2) | `installer/dogfood.mjs:21` | substituído | `main`/`runChecks`/`scanLiterals` viram chamadas ao adapter de subprocesso; `DENYLIST`/`VERSION`/`assertDogfoodTarget` vêm do registry/adapter puro |
| 5 | G-DOGFOOD | `installer/dogfood-mobile.mjs:36` | substituído | `runCli` via adapter; `MANIFEST_NAME` do registry; `assertDogfoodTarget` guarda pura no adapter |
| 6 | **G-ORACLE-DATA** (4) | `installer/__tests__/golden.spec.mjs:8` | equivalente + substituído | `STACK_PROFILES`/`profileOf`/`AXIS_IDS` do registry; `generateConfig` via `op` — comparado ao baseline literal, nunca reescrito |
| 7 | G-ORACLE-DATA | `installer/__tests__/eixos-stack.spec.mjs:33` | equivalente + substituído | 17 nomes: registry/derivações puras + `collectIncoming` via `op`; `EXPECTED_STACKS` literal permanece oráculo independente |
| 8 | G-ORACLE-DATA | `installer/__tests__/generate.spec.mjs:6` | equivalente + substituído | `STACK_PROFILES`/`profileOf`/`defaultSuiteFor` do registry; `generateConfig` via `op` |
| 9 | G-ORACLE-DATA | `installer/__tests__/adr-005.spec.mjs:13` | equivalente + substituído | `presetOfAxes`/`presetsOfAxes`/`defaultSuiteFor` do registry; `generateConfig`/`collectAnswers` via `op` |
| 10 | **G-CLI-TUI** (13) | `installer/__tests__/cli.spec.mjs:24` | substituído | 15 nomes: `runCli`/`main`/`runInit`/`runDoctor` e TUI via `op`; `parseArgs`/`printUsage` via `op`; segredo por stdin; stdout/stderr/exit comparados |
| 11 | G-CLI-TUI | `installer/__tests__/wizard.spec.mjs:11` | substituído | 14 nomes: `runWizard`/`askMenuStep`/`promptAnswers`/`detect` via `op`; `WIZARD_MENU`/`W2M_MARKER`/`QUESTIONS` do registry; transcript W0..W7/W2m comparado |
| 12 | G-CLI-TUI | `installer/__tests__/suite.spec.mjs:26` | substituído | 18 nomes: `preflight`/`backup`/`applyMerge`/`writeManifest` via `op`; 0 writes no aborto re-provado por hash |
| 13 | G-CLI-TUI | `installer/__tests__/checks.spec.mjs:17` | substituído | `runChecks`/`requireVerifiedBackup`/`main` via `op`; `DENYLIST`/`scanLiterals`/`isScannablePath` puros; vereditos idênticos |
| 14 | G-CLI-TUI | `installer/__tests__/merge-manifest.spec.mjs:16` e `merge-v2-only.spec.mjs:33` | substituído | `mergeOpencodeJson`/`mergeAgentFile`/`planMerge`/`applyMerge` via `op`; `normalizeSection`/`hasHarnessSection` puros; merge por conteúdo |
| 15 | G-CLI-TUI | `installer/__tests__/installer-upgrade-regression.spec.mjs:32` | substituído | `runUpgrade`/`main` via `op`; `writtenPathsOf`/`configReferenceTargets` puros; ordem backup→apply preservada |
| 16 | G-CLI-TUI | `installer/__tests__/doctor.spec.mjs:13` | substituído | `runDoctor`/`runUpgrade` via `op`; `formatError`/`resolveBackupDir` puros; mensagem 4-linhas byte-comparável |
| 17 | G-CLI-TUI | `installer/__tests__/preflight.spec.mjs:13` | substituído | `preflight`/`inventory`/`backup` via `op`; `MIN_NODE_VERSION`/`assertInside` do registry/adapter puro |
| 18 | G-CLI-TUI | `installer/__tests__/qa.spec.mjs:18` (+ imports dinâmicos `:229`,`:243`) | substituído | `promptAnswers`/`runWizard` via `op` também no caminho dinâmico; `validateAnswer`/`sanitizeLog`/`stripAnsiControls` puros |
| 19 | G-CLI-TUI | `installer/__tests__/mobile.spec.mjs:7` | substituído | `collectIncoming` via `op`; `validateAnswer` puro; detecção `pubspec.yaml` sem escrita |
| 20 | G-CLI-TUI | `installer/__tests__/mustfix-f1.spec.mjs:17` | substituído | `printPlan`/`runWizard`/`runCli` via `op`; envelope carrega a prévia sanitizada |
| 21 | G-CLI-TUI | `installer/__tests__/dogfood-write-zone.spec.mjs:25` | equivalente | `assertDogfoodTarget` permanece guarda lexical pura no adapter, com a mesma fixture de symlink |
| 22 | G-CLI-TUI | leitura de fonte (`cli.spec.mjs:307`, `generate.spec.mjs:37`, `qa.spec.mjs:110`, `wizard.spec.mjs:1007`, `suite.spec.mjs:65`) | substituído | canários de synthesize/source passam a ler o **oráculo materializado** (`§2.6`), não `install.mjs` do HEAD — senão o canário segue um arquivo que deixou de existir |

**Síntese**: 22/22 vereditos; `gate.js` 0 referência; nenhum consumidor "convive com dois motores" — a convivência permitida em SI-6 é só a do oráculo de paridade, fora do caminho de instalação.

## 5. Destino dos 75 exports importados

Cada nome da medição (§1) aparece exatamente uma vez abaixo. As cinco classes são o destino congelado; nenhuma delas é um módulo de instalação duplicado.

| Classe | Destino | Nomes |
|---|---|---|
| **D-INJ (6)** | registry de dados puro, gerado do oráculo; injetado em `scripts/static-checks.mjs:81` e nos 3 módulos | `AXIS_IDS`, `RULES_BY_AXIS`, `RULES_COMMON`, `SKILLS_BY_AXIS`, `SKILLS_COMMON`, `STACKS_FOR_EXCEPTIONS` |
| **D-DATA (9)** | constantes/registro no mesmo módulo de registry; sem lógica de instalação | `DENYLIST`, `MANIFEST_NAME`, `MIN_NODE_VERSION`, `QUESTIONS`, `STACK_PROFILES`, `STACK_VALUES`, `VERSION`, `W2M_MARKER`, `WIZARD_MENU` |
| **D-PURE (29)** | funções puras no adapter Node (`installer-contract.mjs`): derivação de registry, validação lexical/formatação/redação. Leitura de arquivo permitida; **nenhuma escrita, nenhum subprocesso** | `InstallError`, `assertCreateOnly`, `assertDogfoodTarget`, `assertInside`, `axisIdsFromAxes`, `canNoEcho`, `configReferenceTargets`, `defaultSuiteFor`, `dryRunNotice`, `formatError`, `hasHarnessSection`, `isAbortToken`, `isScannablePath`, `normalizeSection`, `presetOfAxes`, `presetsOfAxes`, `profileOf`, `resolveAnswerSource`, `ruleAllowedForAxes`, `sanitizeLog`, `scanLiterals`, `serializeAnswers`, `skillAllowedForLocalAxes`, `stacksFor`, `stripAnsiControls`, `validateAnswer`, `validateRulesByAxis`, `validateSkillsByAxis`, `writtenPathsOf` |
| **D-ENGINE (23)** | `op` do binário via adapter; nome da `op` = nome do export; cobre escrita, leitura real de FS e orquestração | `applyMerge`, `backup`, `buildManifest`, `collectAnswers`, `collectIncoming`, `generateConfig`, `inventory`, `loadAnswersFile`, `main`, `mergeAgentFile`, `mergeOpencodeJson`, `parseArgs`, `planMerge`, `preflight`, `requireVerifiedBackup`, `resolveBackupDir`, `runChecks`, `runCli`, `runDoctor`, `runInit`, `runUpgrade`, `runWizard`, `writeManifest` |
| **D-TUI (8)** | `op` do binário na camada de tela; **nunca grava**; usa `IsTerminal`/leitura sem eco onde aplicável (S10/S11) | `askMenuStep`, `detect`, `printPlan`, `printUsage`, `promptAnswers`, `readSecretPrompt`, `readSecretRaw`, `sourceLineOf` |

Os **20 exports sem import externo** (`CONSUMER_EXCLUDED_PREFIXES`, `DEFAULT_EVIDENCE_SCHEMA`, `INCOMING_EXCLUDE`, `INCOMING_ROOTS`, `VENDOR_LOCK_NAME`, `WIZARD_MENU_FRONTEND`, `WIZARD_MENU_FRONTEND_DEFAULT`, `WIZARD_MENU_FRONTEND_WIDTH`, `WIZARD_MENU_WIDTH`, `applyUpgrade`, `confirmByLayer`, `getLastCliAnswers`, `howToFix`, `isHarnessLocalPluginEntry`, `menuChoices`, `menuItemLine`, `planUpgrade`, `pubspecDeclaresFlutter`, `sha256`, `validateAxesCombination`) **não são superfície de compatibilidade**: tornam-se internos ao binário; nenhum consumidor Node os importa hoje e nenhum passa a importar sem decisão §16. Alguns são lidos como texto por specs (`PRD.md` §3.2) — esses leem o oráculo materializado (§2.6), não o módulo vivo.

**Regra de não-órfão**: cada nome importado por qualquer um dos 22 consumidores tem de pertencer a exatamente uma das cinco classes; um nome novo fora delas é drift (SI-6), não migração.

## 6. Alternativas descartadas — com custo medido

| Alternativa | Custo medido neste repo | Por que não |
|---|---|---|
| **FFI (binding direto da biblioteca Rust no Node)** | 1 camada de ABI + 1 artefato nativo por `(os,cpu,libc)` + 1 toolchain no destino; 75 exports precisariam de assinatura ABI estável, incluindo streams e segredo | **D1 fechou**: sem FFI. Além disso, `readSecretRaw`/`canNoEcho` dependem de TTY e `setRawMode` do lado Node (`:1839-1891`); atravessar ABI para ler senha sem eco inverte a responsabilidade e põe o segredo no limite errado |
| **Dois motores convivendo (`.mjs` e Rust em paralelo, escolha por flag)** | 4.229 linhas duplicadas; 12 presets × 2 implementações; paridade viraria "rode os dois e concorde" — exatamente a guarda tautológica que `PRD.md` §3.5 proíbe | **D1 fechou**: sem dois motores. O único ".mjs vivo" permitido é o oráculo `c63e333`, em worktree destacado, **fora** do caminho de instalação (§2.6) |
| **Manter `install.mjs` como API pública e chamar o binário só nos bastidores** | 95 exports continuam no arquivo de 3.010 linhas; a fronteira de 22 consumidores não muda; cada `op` teria duas fontes de verdade (JS e Rust) | É o defeito original disfarçado de compatibilidade: D2 exige paridade total **antes** de trocar, e um `install.mjs` que ainda contém o motor é motor duplicado. O registry de dados é permitido; o motor, não |
| **Passar segredo por argv (`--token=…`)** | 0 linha de código; custo real: `ps`/`/proc/$PID/cmdline` expõe o valor a qualquer usuário no host | Proibido pelo contrato (§2.3). `canNoEcho`/`readSecretRaw` existem justamente para manter o valor fora de canais visíveis |
| **Envelope estruturado em fd próprio (3) mantendo stdout byte-idêntico** | +1 descriptor gerenciado no adapter e no binário; S9 exige `Stdio` explícito; dois caminhos de transcript a manter | Custa mais que o roteamento stdout/stderr do §2.1 sem ganho de critério: o conteúdo observável é preservado pela regra de união de bytes, e o transcript TTY já mescla os canais |
| **Códigos de saída ricos (2..9 por classe de erro)** | New vocabulary de 9 códigos contra 0/1 do oráculo (`:1470-1472`, `:2761`, `:2773`) | SI-6: nenhum número novo sem decisão do owner. O detalhe vai no campo `error.code` do envelope, que já usa o `ERROR_CODES` existente |

## 7. Consequências, riscos e reversibilidade

- **C1 — migração é mecânica, não criativa.** Os 22 consumidores trocam import/estimador; nenhum prompt, default, preset ou mensagem é reescrito. Se algum consumidor exigir mudança de asserção, isso é divergência SI-6 com decisão do owner.
- **C2 — paridade passa a ter um ponto de aplicação único.** O oráculo é invocado pelo mesmo `contract-v1` do binário; ADR-002 herda esta fronteira e escreve o procedimento SI-1..SI-6. ADR-003 (motor) e ADR-004 (TUI) herdam as `op`s e a separação CLI/TUI; nenhum deles pode criar canal novo sem emendar esta ADR.
- **C3 — reversibilidade.** Reverter significa restaurar o especificador em `scripts/static-checks.mjs:81` e os imports dos 22 consumidores; o registry gerado é descartável e o selo nunca mudou. Custo de reversão: 22 arquivos, 0 arquivo de config/gate.
- **R1 — regressão no registry injetado.** Se o registry gerado divergir do oráculo, `V19`/`V20` mudam de fonte sem aviso (R3 do PRD). Mitigação: comparação byte-a-byte dos 6 mapas com `c63e333` no harness de paridade, antes de qualquer troca de especificador. 🟠 risco aberto até o SDD.
- **R2 — transcript por canal.** Progresso migrando de stdout para stderr pode alterar transcript em pipe se o adapter concatenar na ordem errada. Mitigação: regra de união de bytes do §2.1 + transcript TTY mesclado; dono é o ADR-004. 🟠 risco aberto.
- **R3 — oráculo "acompanhar" o SDD.** Worktree sujo ou SHA diferente invalida a medição; a checagem do §2.6 é pré-condição de cada corrida. 🟢 mecanismo declarado · 🟡 execução no SDD.
- **R4 — cobertura Rust fora do selo (D6).** Custo aceito; `RESEARCH.md` §8-R2 pede ciência do owner no G2. Não é inventar comando novo — é não republicar `c904f1c5`.

## 8. Fora desta decisão

- crate, versão, framework de CLI e de TUI, toolchain de build, formato de binário e distribuição — ADR-003/004/005 (o `RESEARCH.md` §2–§4 só recomenda);
- o procedimento SI-1..SI-6, a escolha de `insta` vs baseline literal e a validação humana do golden — ADR-002;
- as 10 telas W0..W7/W2m, prompts, defaults, ranges e cleanup de terminal — ADR-004 (aqui só os canais e o segredo);
- publicação npm, `optionalDependencies`, runtime do adotante e suíte em paralelo — ADR-005;
- qualquer alteração em `gate.js`, `harness.config.json`, `HARNESS_SEAL_JSON`, `opencode.json`, `workflow-state.json`, presets, eixos, comandos canônicos ou defaults de menu.

## 9. Verificação de prontidão deste batch

```sh
git status --short                                   # vazio; só .spec/prd/prd-installer-rust/ tocado no commit
git rev-parse HEAD                                   # SHA local registrado no cabeçalho
node scripts/static-checks.mjs                       # exit 0; PASS PRD-01 / ADR-01 / ADR-02 não-vacuosos
grep -ciE 'TO''DO|S''TUB' .spec/prd/prd-installer-rust/ADRs/ADR-001-fronteira-subprocesso/ADR.md   # 0
```

## 16. Exceção registrada pelo owner (2026-11-16) — ponte do adapter até o ADR-003

O owner autoriza, **como exceção explícita e datada**, a única ponte `export … from './install.mjs'` em `installer/installer-contract.mjs:15`, cobrindo os 23 `D-ENGINE` + 8 `D-TUI` ops.

- **Motivo**: a fronteira `contract-v1` e os adapters foram implementados no ADR-001, mas o binário Rust que executa os 31 ops só nasce no **ADR-003** (motor init/doctor/upgrade). Exigir `.mjs vivo = 0` agora forçaria um motor Rust improvisado antes da decisão de motor.
- **Escopo autorizado**: somente a linha `:15` e somente os 31 ops; os 6 mapas (`D-INJ`) e os 9 dados (`D-DATA`) já vieram da registry e **não** dependem da ponte.
- **Expiração (primeira ocorrência)**: merge do ADR-003 · binário Rust capaz de responder `contract-v1` · qualquer segundo caminho de escrita via `.mjs` no caminho de instalação.
- **Critério corrigido (item 9)**: `grep -rn "from '.*install\.mjs'" scripts/ installer/ .opencode/ | wc -l` ⇒ **1**, e essa 1 linha deve ser exatamente `installer/installer-contract.mjs:15`; qualquer outra ocorrência ⇒ FAIL.
- **Débito**: a ponte é transição, não conformidade; o ADR-003 a remove. Registrada também em `workflow-state.json.overrides` com `portao: D1-two-motors`.

**Atualização (review rodada 2)**: a exceção cobre também `installer/installer-contract.mjs:23` — `const { sanitizeLog } = await import('./install.mjs')`. É o **mesmo módulo do cache ESM** já reexportado em `:15`, usado apenas para `sanitizeLog` (read-only); não é segundo motor nem segunda fonte. O critério literal `grep -rn "from '.*install\.mjs'"` continua valendo para o re-export de `:15`; a referência dinâmica de `:23` fica **declarada nesta exceção** e desaparece junto dela no merge do ADR-003. Nenhuma outra referência ao `.mjs vivo` é autorizada.
