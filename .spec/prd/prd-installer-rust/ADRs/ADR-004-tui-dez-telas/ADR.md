# ADR-004 — TUI de 10 telas: apresentação como modelo declarativo de 5 campos por tela, navegação igual à ordem do oráculo, `apply` no motor, segredo sem eco com cleanup e transcript como única autoridade de tela

- **prd-id**: `prd-installer-rust` — `.spec/prd/prd-installer-rust/PRD.md`
- **order**: 4 de 5 (`.spec/prd/prd-installer-rust/ADR-INDEX.md`)
- **status**: `in-progress`
- **branch**: `adr/prd-installer-rust/04-tui-dez-telas` (aberta de `dc95c1fb299a458436ef746c6688ee40ef30cc98`; o SHA do commit deste batch é registrado no retorno do subagente)
- **depende-de**: ADR-001, ADR-002, ADR-003 — `.spec/prd/prd-installer-rust/ADRs/ADR-001-fronteira-subprocesso/ADR.md` (contrato `contract-v1`: stdout=envelope, stderr=progresso, segredo em stdin/TTY, 8 `op`s de TUI em `D-TUI`, exit `0/1/2`, oráculo em worktree `detach`), `.spec/prd/prd-installer-rust/ADRs/ADR-002-oraculo-paridade/ADR.md` (predicado de externalidade, SI-4, rito de validação humana do literal, autoridade do transcript arquivado) e `.spec/prd/prd-installer-rust/ADRs/ADR-003-motor-init-doctor-upgrade/ADR.md` (`runWizard` como `op` de engine, `apply` como único ponto de escrita, ordem congelada). **Nenhuma rubrica de ADR-001/002/003 é reaberta**; este ADR consome os canais, a autoridade do transcript e a fronteira motor/apresentação.
- **data**: 2026-11-16
- **dono da decisão**: owner do harness. **D3** (10 telas completas com navegação, prompts, estados e a11y — item 1 da demanda), **D1** (subprocesso, sem FFI), **D4** (Node `c63e333` como oráculo de transcript), **D6** (selo `c904f1c5…` invariante, suíte em paralelo) e **D7** (binário autocontido) são insumo fechado; este ADR os **implementa**, não os reabre.
- **rota**: refactor de apresentação. Nenhuma mensagem, prompt, default, range, transição, preset ou chave é inventado; muda o modelo pelo qual a tela existente é descrita e verificada.
- **escopo de escrita desta entrega**: apenas `.spec/prd/prd-installer-rust/**` — neste batch, `ADRs/ADR-004-tui-dez-telas/ADR.md` e uma linha nova em `ADR-INDEX.md` (com a promoção de ADR-003 a `merged`, obrigatória por `ADR-02`). Nenhum arquivo de `installer/**`, `scripts/**`, `.opencode/**`, `.agents/**`, `harness.config.json`, `gate.js`, `opencode.json` ou `workflow-state.json` foi tocado. O módulo de tela, as 8 `op`s e as specs migradas são o **SDD** deste ADR.
- **insumo de pesquisa**: `RESEARCH.md` §3 (B1/B2/B3, fontes S4/S5/S6, recomendação B3), §7 (linha do ADR-004), §8-5 (transcript é oráculo de tela; cleanup de terminal obrigatório), fontes S10 (`IsTerminal`) e S11 (leitura de senha sem eco); `PRD.md` §3.7 (5 campos de tela), §5 M-4/M-5, §16-D3; ADR-001 §2.1 (canais), §2.3 (prova de segredo), §5 (`D-TUI` = 8 nomes), ADR-002 §2.1 (externalidade) e §4 (SI-4), ADR-003 §2.1 (`runWizard`), §2.2 (ordem), §2.5 (selo); medição direta de `installer/install.mjs:2234-2437` e do transcript arquivado.

## 1. Contexto — fatos medidos, não deduzidos

Medições e leituras de 2026-11-16 neste repo. Nenhum número abaixo é estimativa; nenhuma transição é inferida de "como deveria ser".

| Fato | Valor | Comando / fonte |
|---|---|---|
| Telas do fluxo | **10**: `W0`, `W1`, `W2`, `W2m-1`, `W2m-2`, `W3`, `W4`, `W5`, `W6`, `W7` | `runWizard:2264-2436`, `runInit:2497-2557`; `PRD.md` §3.7 |
| Campos por tela | **5**: identidade, conteúdo, prompt+ações, estado, acessibilidade/meio | `PRD.md` §3.7; 10×5 = 50 campos, nenhum vazio |
| `op`s de TUI | **8**, nenhuma grava: `askMenuStep`, `detect`, `printPlan`, `printUsage`, `promptAnswers`, `readSecretPrompt`, `readSecretRaw`, `sourceLineOf` | ADR-001 §5 (`D-TUI`); ADR-003 §2.1 (`runWizard` orquestra, `promptAnswers` interpela) |
| Transcript oráculo | **16.336 bytes**, marcadores `[1/2]` (`:19`), `[2/2]` (`:24`), `[1-5]` (`:19`), `(default: 1)` (`:24`), `(q cancela)` (`:19`,`:24`,`:26-38`); 5 perguntas `[1/5]`..`[5/5]` (`:26-38`) | `wc -c` e `grep -nE` sobre `.spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt`; SI-4 em ADR-002 §4 |
| Canal W3 | `[3/5] Comando da suite de testes? (default: npm run test:run) (q cancela)`; `[4/5] Diretorio de plugins…`; `[5/5] Token de deploy (sensivel, opcional)?` | transcript `:32`, `:35`, `:38`; `QUESTIONS` em `install.mjs:227` |
| Oráculo de segredo (reexecutado neste batch) | `secretQuestions=deployToken` · `serializeSkips=true` · `sanitizeLog=token=[REDACTED]` · `canNoEchoPipe=false canNoEchoTTY=true` · `stripAnsi="AB"` | comando de ADR-001 §2.3, saída literal repetida abaixo em §2.4 |
| Range do W2m | passo 1 `[1-5]` derivado de `WIZARD_MENU.length`; passo 2 `[1-2]` derivado de `WIZARD_MENU_FRONTEND.length` com default `'1'` | `install.mjs:2296` (`menuTotal`), `:2304-2317`; transcript `:19`,`:24` |
| Segredo em TTY | `canNoEcho(stdin)` ⇒ `r.close()` + `readSecretPrompt` + `r = createLineReader(...)`; `q` vale também no segredo (REQ-11/INS-16) | `install.mjs:2347-2357` |
| `apply` fora da tela | `runWizard` só formata W6/W7 e delega: `apply` injetado pela CLI; sem `apply`/dry-run ⇒ `[INFO] W6/W7 nao executados …; nenhum write` | `install.mjs:2419-2436`; transcript `:264-266` |
| Risco de terminal sem eco | `SIGTERM` com prompt aberto pode deixar o terminal sem eco se não houver handler de restauração | `RESEARCH.md` S5 e §3-B2, §8-5 (risco R5) |
| Critério de apresentação | B3 (line-based explícito) é **recomendação com fonte**; nenhum crate/framework de TUI é decisão deste ADR | `RESEARCH.md` §3-B3/§7/§8-1; S4/S5/S6 são fontes, não pin |
| Selo | `c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2`, invariante | `sealCommands(commands)`; D6; ADR-001 §2.5 |

Saída literal da medição de segredo (reexecutada neste batch):

```text
secretQuestions=deployToken
serializeSkips=true
sanitizeLog=token=[REDACTED]
canNoEchoPipe=false canNoEchoTTY=true
stripAnsi="AB"
```

**O defeito que este ADR fecha.** Duas falhas produzem "tela pronta" sem prova: (1) trocar os prompts line-based do oráculo por widgets de tela cheia e chamar isso "UI para tela de CLI" — os textos `[1/2]`, `[1-5]`, `(default: 1)`, `(q cancela)` mudam, o transcript SI-4 deixa de ser comparável e a transição nova entra sem decisão §16; (2) tratar a tela como dona da escrita (ou esquecer a restauração do terminal após `SIGTERM` com prompt de segredo aberto) — nesse caso aborto deixa arquivo no destino ou o operador fica com terminal sem eco. Este ADR escolhe **uma** decisão de apresentação e a fecha com comando por tela.

## 2. Decisão

**Decisão única: a TUI é um modelo declarativo de exatamente 10 telas × 5 campos, cuja navegação é a ordem já existente em `runWizard` (0 transição nova), cujos prompts/defaults/ranges são comparados byte-a-byte ao transcript arquivado e ao Node `c63e333`, que interpela e formata mas nunca grava (`apply` permanece no motor), que lê segredo sem eco em TTY e usa `serializeSkips` em pipe com cleanup obrigatório do terminal após `SIGTERM`, e que escreve progresso/prompt somente em `stderr` deixando `stdout` exclusivamente para o envelope de `contract-v1` — com o critério de apresentação julgado por transcript, não por widget, e crate/framework ficando como recomendação de `RESEARCH.md` §3 (S4/S5/S6/S10/S11), não como decisão deste ADR.** 🟢 para a forma do modelo e da fronteira (D1/D3/D4/D6/D7 + ADR-001/002/003 + medição de `install.mjs` e do transcript); 🟡 para execução, transcript e cleanup — é o SDD deste ADR que os prova.

### 2.1 As 10 telas × 5 campos, transições permitidas e comando de prova

Notação dos campos (PRD §3.7, sem escolha de biblioteca): **I** = identidade · **C** = conteúdo (`[OK]`/`[INFO]`/`[AVISO]`) · **P** = prompt e ações válidas · **E** = estado · **A** = acessibilidade/meio (TTY vs pipe, segredo sem eco, `stdout` envelope / `stderr` progresso).

`$TRANSCRIPT` = `.spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt`; `prova(op)` = comando de ADR-003 §2.1 (`diff -u <(oráculo) <(contract-v1 …result)`); `$ORACULO`, `$INSTALLER_BIN` e `contract-v1` vêm de ADR-001 §2.1/§2.6.

| id | campos (I / C / P / E / A) | transições permitidas (somente as do oráculo) | comando de prova contra o transcript/oráculo |
|---|---|---|---|
| **W0** | I `W0 pre-flight` · C `[OK] W0 pre-flight: target=… node=…` e `[OK] W0: pico-fim` (`:1-2`) · P nenhum prompt; ação `preflight` (leitura) · E aguardando → pré-vôo OK → aborto · A progresso em `stderr`, envelope em `stdout`, sem prompt | `W0 → W1` (preflight OK) · `W0 → aborto` (`BAD_TARGET`/`NODE_MIN`/`UID_ROOT`/`q`/EOF) | `sed -n '1,2p' "$TRANSCRIPT"`; `diff -u <(grep '^\[OK\] W0' "$TRANSCRIPT") <("$INSTALLER_BIN" contract-v1 <<<"$REQ_runWizard" 2>&1 >/dev/null \| grep '^\[OK\] W0')`; `prova(preflight)` |
| **W1** | I `W1 inventario do destino` · C `[INFO] W1 …` + 7 linhas `[OK]/[AVISO]` por camada (`:3-10`) · P nenhum prompt; `inventory` (leitura) · E aguardando → inventariado → aborto · A ordem das 7 camadas é a do oráculo; `stderr` | `W1 → W2` · `W1 → aborto` (EOF/`q`) | `sed -n '3,10p' "$TRANSCRIPT"`; `test "$(sed -n '3,10p' "$TRANSCRIPT" \| grep -c '\[OK\]\|\[AVISO\]')" -eq 7`; `prova(inventory)` |
| **W2** | I `W2 deteccao (pubspec.yaml)` · C `[INFO] W2 deteccao …` + `[AVISO] sem pubspec.yaml — stack sera escolhida no W2m.` (`:11-12`) ou `[OK] campo <- arquivo:linha` + `[INFO] sugestao de stack` quando há pubspec · P nenhum prompt; `detect` (leitura) · E aguardando → detectado (`hasPubspec` true/false) → aborto · A detecção não ecoa segredo; `terminal:false` permitido | com pubspec → `W3` (default sugerido) · sem pubspec → `W2m-1` · aborto | `sed -n '11,12p' "$TRANSCRIPT"`; `diff -u <(sed -n '11,12p' "$TRANSCRIPT") <(stderr do binário)`; `prova(detect)` |
| **W2m-1** | I `[1/2] tipo de projeto` · C `[INFO] W2m tipo de projeto — escolha o tipo do seu projeto:` + itens `1)`..`5)` (`:13-18`) · P `[1/2] escolha [1-5] (q cancela) > `, range derivado de `WIZARD_MENU.length`, `q` cancela · E aguardando → selecionado → aborto; `next` decide o passo 2 · A prompt em `stderr`, `IsTerminal` escolhe edição vs pipe, sem segredo | item com `next` → `W2m-2` · sem `next` → `W3` · inválido → repete `W2m-1` · `q`/EOF → aborto | `sed -n '13,20p' "$TRANSCRIPT"`; `grep -n '\[1/2\].*\[1-5\].*(q cancela)' "$TRANSCRIPT"`; `prova(askMenuStep)` |
| **W2m-2** | I `[2/2] frontend` · C `[INFO] W2m frontend — qual o frontend do seu projeto web:` + `1) Vue (default)` / `2) React` (`:21-23`) · P `[2/2] escolha [1-2] (default: 1) (q cancela) > `, range derivado de `WIZARD_MENU_FRONTEND.length`, default `'1'` · E aguardando → `menuStack = front.stack` → `W3`; inválido repete; aborto · A default aparece no prompt, não em documentação; `stderr` | `W2m-2 → W3` · inválido → repete `W2m-2` · `q`/EOF → aborto | `sed -n '21,25p' "$TRANSCRIPT"`; `grep -n '\[2/2\].*\[1-2\].*(default: 1).*(q cancela)' "$TRANSCRIPT"`; `prova(askMenuStep)` |
| **W3** | I `[1/5]`..`[5/5]` Q&A · C 5 perguntas + `[OK] chave = valor` por resposta; segredo nunca em claro (`:26-39`) · P `[i/5] <prompt> (default: …) (q cancela)`, `readSecretPrompt` quando `canNoEcho`, `q` vale no segredo, inválido repete com `formatError` · E aguardando → respondido → retry (`BAD_ANSWER`) → aborto; `deployToken` vazio permitido · A TTY sem eco; pipe sem `setRawMode`; envelope sem campo `secret` | `[i/5] → [i+1/5]` até `W4` · inválido → repete a mesma pergunta · `q`/EOF em qualquer pergunta → aborto | `sed -n '26,39p' "$TRANSCRIPT"`; `grep -nE '\[[1-5]/5\]|\(q cancela\)' "$TRANSCRIPT"`; `prova(promptAnswers)` + §2.4 |
| **W4** | I `W4 resumo + previa` · C `[INFO] W4 resumo das respostas (segredos omitidos):` + `serializeAnswers` + `[INFO] W4 previa do plano (reusa printPlan):` + `plano de instalacao:` + `resumo: 218 itens` + classes (`:40-263`) · P nenhum prompt; `assertCreateOnly` quando `createOnly` · E aguardando → prévia → create-only OK / `flagged-open` (0 writes) → aborto · A resumo omite `deployToken`; `printPlan` sanitiza; `stderr` | `W4 → W5` · `W4 → aborto` (`flagged-open`, `q`) | `sed -n '40,42p;262,263p' "$TRANSCRIPT"`; `test "$(sed -n '40,263p' "$TRANSCRIPT" \| grep -c deployToken)" -eq 0`; `prova(printPlan)` |
| **W5** | I `W5 confirmacao por camada` · C `[INFO] W5 confirmacao por camada:` ou `[INFO] W5 dry-run: confirmacao por camada dispensada (nada sera aplicado).` + `[INFO] dry-run: NÃO EXECUTADO — nenhum write (plano + relatório apenas)` (`:264-265`) · P `confirmByLayer` por camada, `--yes` pula, `q`/EOF aborta · E aguardando → confirmado por camada → aborto (0 writes) → dry-run retorna antecipado · A aborto = 0 writes; sem segredo; `stderr` | confirmado → `W6` · dry-run → fim (exit `0`, 0 writes) · `q`/EOF → aborto (exit `1`, 0 writes) | `sed -n '264,265p' "$TRANSCRIPT"`; `a=$(find . \| sort \| sha256sum); "$INSTALLER_BIN" contract-v1 <<<"$REQ_ABORT"; b=$(find . \| sort \| sha256sum); test "$a" = "$b"`; `prova(runWizard)` |
| **W6** | I `W6 backup + aplicacao` · C `[INFO] W6 backup + aplicacao:` + `[i/total] <action> <path>` + `[OK] apply: pico-fim` (`install.mjs:2427-2430`) · P nenhum prompt; `apply` injetado pela CLI; escrita só no motor · E aguardando → aplicado → `MISSING_INCOMING` (0 writes) → sem `apply`/dry-run: `W6/W7 nao executados …; nenhum write` (`:266`) · A tela formata; `applyMerge`/`applyUpgrade` são do motor (ADR-003) | apply OK → `W7` · falha antes do `apply` → aborto (0 writes) · dry-run/sem `apply` → fim sem W6/W7 | `grep -n 'W6 backup + aplicacao\|apply: pico-fim' "$ORACULO/installer/install.mjs"`; `sed -n '266p' "$TRANSCRIPT"`; `prova(applyMerge)`; item 3 da interface (0 escrita na tela) |
| **W7** | I `W7 manifesto + checks` · C `[INFO] W7 manifesto + checks:` + `[OK] manifesto: <path>` + `[OK\|ERRO] checks: PASS\|FAIL […]` + `[OK] checks: pico-fim` (`:2431-2436`) · P nenhum prompt; `writeManifest`/`runChecks` via `apply` · E aguardando → PASS (`0`) / FAIL (`1`, escrita já feita; rollback = backup verificado) · A vereditos são literais externos (ADR-002/003); `stderr`; sem segredo | PASS/FAIL → fim; nunca volta a W0..W5 | `prova(runChecks)` e `prova(writeManifest)`; `node --test installer/__tests__/checks.spec.mjs installer/__tests__/suite.spec.mjs` (transcript é dry-run, não registra W6/W7 — a prova é `runWizard` com `apply` real no harness) |

**50 campos, 0 vazio.** Nenhuma linha da tabela introduz transição, prompt, default, range ou mensagem nova: cada C/P é extraído do transcript ou de `install.mjs:2264-2436`, e cada "transição permitida" é a sucessão observada no oráculo.

### 2.2 Navegação congelada — 0 transição nova

A ordem permitida é **exatamente** `W0 → W1 → W2 → {W2m-1 → W2m-2 | ∅} → W3 → W4 → W5 → W6 → W7 → fim`, com dois ramos já existentes e medidos:

1. **Ramificação W2** (`install.mjs:2295`): sem `pubspec.yaml` o fluxo passa por `W2m-1`; com `pubspec.yaml`, vai direto a `W3` com o stack sugerido como default. Não é transição nova — é o `if (!det.hasPubspec)` do oráculo.
2. **Ramificação W2m-1** (`install.mjs:2307`): `picked.next` decide se `W2m-2` ocorre; o total do menu é derivado de `WIZARD_MENU.some(m => m.next)` (`:2296`), nunca escrito à mão.
3. **Repetição da mesma pergunta** em W2m-1, W2m-2 e W3 (`for(;;)` em `:2343`) — não é "voltar": é o mesmo passo reemitido com `formatError`.
4. **Aborto** (`q`/EOF/`NO_STDIN`/`USER_ABORT`) e **dry-run** (`:2412-2423`) encerram sem escrita.

Proibido sem decisão do owner em `PRD.md` §16 + diff declarado (SI-6): "voltar", "pular", menu de navegação, ramo novo, prompt novo, default novo, range novo e mensagem nova. Qualquer transição fora da lista acima reprova, mesmo com tela bonita: `diff -u <(grep transições do oráculo) <(transições do binário)` ⇒ vazio é a regra.

### 2.3 A tela não grava — `apply` fica no motor, aborto = 0 writes

- As **8 `op`s de TUI** (`D-TUI`, ADR-001 §5) são leitura/formatação/interpelação: `askMenuStep`, `detect`, `printPlan`, `printUsage`, `promptAnswers`, `readSecretPrompt`, `readSecretRaw`, `sourceLineOf`. `applyMerge`, `applyUpgrade`, `writeManifest` e `backup` pertencem a `D-ENGINE` (ADR-001 §5, mapeadas em ADR-003 §2.1). A tela pode **pedir** `apply` ao adapter; nunca o implementa.
- Prova estrutural (SDD): `grep -cE 'applyMerge|applyUpgrade|writeManifest|fs\.write|writeFile|backup\(' <módulo de tela>` ⇒ `0`; `grep -c 'apply' <módulo de tela>` mostra só a delegação via `contract-v1`. `W6/W7` são formatados pela tela, executados pelo motor (`install.mjs:2419-2429` é o lastro).
- Prova de aborto (SDD): para `q`/EOF em W0..W5, `a=$(find . | sort | sha256sum)` antes e `b=$(find . | sort | sha256sum)` depois ⇒ `a = b`; envelope `ok:false` com `error.code ∈ {USER_ABORT, NO_STDIN}`; exit `1`. Histórico: `harness/harness-eixos-stack.json:70-71`, hash `063c1ddc…` (2 presets medidos — não publicar 12/12 sem comando, ADR-002 §2.3). Dry-run termina com exit `0`, `checks.passed:null`, 0 writes, sem backup/confirm/checks (ADR-003 §2.2 passo 9).

### 2.4 Segredo sem eco, `serializeSkips` em pipe e cleanup após `SIGTERM` (risco R5)

1. **TTY** — `canNoEcho(stdin)` verdadeiro (`canNoEchoTTY=true`): `r.close()` → leitura pela família `readpass` (S11) → `r = createLineReader(...)` para não enfilar o segredo como resposta seguinte (`install.mjs:2350-2353`). Só máscara é ecoada; `q` cancela também no segredo (REQ-11/INS-16, `:2355-2357`); `[OK] deployToken = [REDACTED]` em W3 (`:2365`) e ausência em W4 (`serializeAnswers`).
2. **Pipe/redirect/`--answers-file`** — `canNoEchoPipe=false`: sem `setRawMode`, sem prompt interativo; o valor entra por `answers`/caminho de arquivo em argv (`ADR-001` §2.1). `serializeSkips=true` ⇒ campo `deployToken` **ausente** do envelope; toda linha passa por `sanitizeLog` antes do `write` ⇒ `token=[REDACTED]`. Comando vivo: a saída literal de §1.
3. **Cleanup obrigatório (R5/S5)** — antes de entrar em qualquer leitura sem eco, o binário registra restauração de terminal **idempotente** para `SIGTERM`, `SIGINT`, EOF e caminho de erro: restaura modo/eco, libera o descritor e só então termina. `SIGTERM` com prompt aberto é `ExitStatus` com sinal, **nunca** convertido em exit `0` (ADR-001 §2.2). Prova do SDD: PTY com prompt de segredo aberto, `kill -TERM $PID` no meio da leitura, então `stty -a` (eco restaurado) + nova leitura visível + `grep -F SEGREDO_PROVA` vazio em `stdout`, `stderr` e `/proc/$PID/cmdline` — o mesmo par de comandos de ADR-001 §2.3 com o sinal injetado. Sem esse handler, B2 (`inquire`, S5) deixa o terminal sem eco: é **critério de rejeição**, não detalhe.
4. **Critério, não crate** — a recomendação `RESEARCH.md` §3-B3 (`std::io` + `IsTerminal` + `readpass`, fontes S10/S11) é insumo com fonte. `ratatui` (S4: não inclui input handling), `inquire`/`dialoguer` (S5/S6: desenho próprio tende a mudar os marcadores; S5 registra o risco de `SIGTERM`) ficam fora da decisão; se o owner exigir widgets, entram como divergência §16 (SI-6), não como "detalhe de implementação".

### 2.5 `stdout`/`stderr` do `contract-v1` convivem com a TUI

A TUI escreve **somente em `stderr`**: prompts, `[OK]`/`[INFO]`/`[AVISO]`, resumo e prévia são progresso humano (ADR-001 §2.1). `stdout` contém **exatamente um envelope JSON** por processo e nenhum byte de tela. Em TTY os dois canais aparecem na mesma tela, e o transcript é a **visão mesclada** — é essa união de bytes que se compara ao transcript arquivado (regra de união de ADR-001 §2.1), não `stdout` isolado.

```sh
# separação de canais (critério do SDD)
grep -c '"v":1' /tmp/r.err          # ⇒ 0  (nenhum envelope em stderr)
grep -cE '^\[(OK|INFO|AVISO)\]|^\[[0-9]+/[0-9]+\]' /tmp/r.json   # ⇒ 0 (nenhuma tela em stdout)
diff -u <(sort /tmp/r.json /tmp/r.err) <(sort /tmp/oraculo.out)  # ⇒ vazio (união de bytes)
```

Em pipe/redirect, os prompts são suprimidos quando `terminal:false` e `answers`/`--answers-file` estão presentes: o consumidor lê só o envelope; a tela não exige TTY para instalar (`PRD.md` §11 item 2). Nenhum canal novo é criado — emendar `contract-v1` exigiria decisão do owner, proibida aqui.

### 2.6 Efeito no selo e na suíte paralela (D6, herdado)

`harness.config.json`, `commands.suiteFull`, `HARNESS_SEAL_JSON` (`c904f1c5…`) e `.opencode/plugins/lib/seal.mjs` permanecem **byte-idênticos**. A comparação de transcript, as specs de tela e o teste de cleanup rodam em **comandos paralelos fora do selo**, como declarado em ADR-001 §2.5, ADR-002 §6 (R8) e ADR-003 §2.5. Nenhum comando canônico novo é acrescentado; custo aceito e declarado ao owner no G2: cobertura de tela não entra na contraprova selada. `node scripts/static-checks.mjs` segue sendo a contraprova canônica (exit `0`, `PASS PRD-01`/`ADR-01`/`ADR-02`).

## 3. Interface congelada

Forma ratificada a partir de D1/D3/D4/D6/D7 + ADR-001/002/003. Itens *(SDD)* só passam a valer após a implementação; antes dela o comando mede o estado atual. Nível de garantia explícito.

1. **10 telas × 5 campos, nenhum vazio.** *(hoje)* `sed -n '2264,2436p' installer/install.mjs` e a tabela §2.1 ⇒ 10 ids, 50 campos preenchidos. *(SDD)* `grep -c '^| \*\*W' <this ADR>` ⇒ `10`; cada linha tem 5 entradas I/C/P/E/A. 🟢 oráculo · 🟡 SDD.
2. **Marcadores do transcript intactos.** *(hoje)* `grep -nE '\[1/2\]|\[2/2\]|\[1-5\]|\(default: 1\)|\(q cancela\)' "$TRANSCRIPT"` ⇒ 5 marcadores em `:19`,`:24`,`:26-38`. *(SDD)* `diff -u "$TRANSCRIPT" <(transcript mesclado do binário em TTY)` ⇒ vazio. 🟢 arquivo · 🟡 transcript.
3. **0 transição nova.** *(hoje)* `sed -n '2295,2323p;2343,2371p;2412,2424p' installer/install.mjs` mostra só os 4 ramos de §2.2. *(SDD)* `diff -u <(grep transições do oráculo) <(transições do binário)` ⇒ vazio; nenhum rótulo "voltar"/"pular" na tela. 🟢 fonte · 🟡 differential.
4. **Cada tela tem comando de prova.** Tabela §2.1, 10 linhas, coluna "comando de prova" não vazia. *(hoje)* `sed -n '1,2p;11,12p;13,25p;26,39p;40,42p;262,266p' "$TRANSCRIPT"` reproduz os trechos. *(SDD)* `prova(op)` para as 8 `op`s de TUI ⇒ `diff` vazio. 🟢 transcript · 🟡 differential.
5. **A tela não grava.** *(hoje)* `install.mjs:2015-2017` (apresentação nunca escreve) e `:2419-2429` (`apply` delegado). *(SDD)* `grep -cE 'applyMerge|applyUpgrade|writeManifest|fs\.write|writeFile|backup\(' <módulo de tela>` ⇒ `0`. 🟢 oráculo · 🟡 SDD.
6. **Aborto = 0 writes.** *(hoje)* `harness/harness-eixos-stack.json:70-71` (hash `063c1ddc…`, 2 presets medidos). *(SDD)* `a=$(find . | sort | sha256sum); …REQ_ABORT…; b=$(find . | sort | sha256sum); test "$a" = "$b"` + envelope `USER_ABORT`/`NO_STDIN` + exit `1`. 🟡 SDD.
7. **Segredo sem eco em TTY.** *(hoje)* `canNoEchoTTY=true`, `readSecretPrompt` em `:2351`, `[REDACTED]` em `:2365`. *(SDD)* PTY + `q` no segredo ⇒ `USER_ABORT`; `grep -F SEGREDO_PROVA` vazio em `/proc/$PID/cmdline`, `stdout`, `stderr`. 🟢 oráculo · 🟡 SDD.
8. **`serializeSkips` em pipe.** *(hoje)* saída literal §1: `serializeSkips=true`, `canNoEchoPipe=false`, `sanitizeLog=token=[REDACTED]`. *(SDD)* envelope de `promptAnswers` sem chave `deployToken`; `grep -c '"deployToken"' /tmp/r.json` ⇒ `0`. 🟢 oráculo · 🟡 SDD.
9. **Cleanup após `SIGTERM` (R5).** *(hoje)* `RESEARCH.md` S5/§3-B2 registra o risco; `install.mjs:2347-2357` mostra a janela sem eco. *(SDD)* `kill -TERM` com prompt aberto ⇒ `stty -a` com eco restaurado, nova leitura visível, `ExitStatus` com sinal, nunca exit `0`. 🟡 SDD (handler obrigatório).
10. **Canais separados.** *(hoje)* ADR-001 §2.1 e o bloco de §2.5. *(SDD)* `grep -c '"v":1' /tmp/r.err` ⇒ `0`; `grep -cE '^\[(OK|INFO|AVISO)\]' /tmp/r.json` ⇒ `0`; união mesclada `diff` vazia. 🟠 contrato · 🟡 SDD.
11. **8 `op`s de TUI, 1:1.** *(hoje)* ADR-001 §5 `D-TUI` lista os 8 nomes. *(SDD)* `diff -u <(nomes D-TUI) <(ops TUI do dispatcher)` ⇒ vazio; nenhuma `op` de escrita na classe. 🟢 inventário · 🟡 SDD.
12. **`runWizard` é do motor, `promptAnswers` da tela.** *(hoje)* ADR-003 §2.1 linha 23 e nota de vocabulário; `install.mjs:2234`. *(SDD)* a tela nunca chama `applyMerge` direto; só `op` de engine via adapter. 🟢 ADR-003 · 🟡 SDD.
13. **Oráculo materializado e transcript imutável.** *(hoje)* `git merge-base --is-ancestor c63e333 HEAD` ⇒ `0`; `wc -c "$TRANSCRIPT"` ⇒ `16336`. *(SDD)* `test "$(git -C "$ORACULO" rev-parse HEAD)" = c63e33307710e1c6271f5c68b2dd9fb15283f49c && test -z "$(git -C "$ORACULO" status --porcelain)"` e `git diff --exit-code -- "$TRANSCRIPT"` ⇒ vazio. 🟢 git.
14. **Literal validado antes de virar oráculo de tela.** *(hoje)* rito de ADR-002 §2.4. *(SDD)* linha `Veredito: validated literal <sha256> <ISO-8601> <oráculo>` em `harness/<demand>.json` antes de qualquer novo literal de tela; `cargo insta review` só leitura. 🟡 processo.
15. **Selo intacto, cobertura paralela.** *(hoje)* `node --input-type=module -e "import {sealCommands} from './.opencode/plugins/lib/seal.mjs';import fs from 'node:fs';console.log(sealCommands(JSON.parse(fs.readFileSync('harness.config.json','utf8')).commands))"` ⇒ `c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2`. *(SDD)* `git diff --exit-code -- harness.config.json .opencode/plugins/lib/seal.mjs` ⇒ vazio. 🟢 runtime.
16. **1:1 do ledger e escopo do batch.** *(hoje)* `git show --stat --name-only HEAD` ⇒ só `.spec/prd/prd-installer-rust/**`; *(SDD)* `node scripts/static-checks.mjs` ⇒ `PASS ADR-01` (uma linha por `ADR.md`), `PASS ADR-02` (sequência 1-2-3-4, 1 `in-progress`, branch no padrão). 🟢 runtime · 🟡 PR humano.
17. **Escopo de decisão — nenhum crate pinado aqui.** *(hoje)* `grep -nE 'ratatui|inquire|dialoguer|readpass|Cargo\.toml' ADR.md` ⇒ só menções em recomendação/proibição nos §2.4/§4; `git status --short` ⇒ vazio após o commit. 🟢 processo.

## 4. Alternativas descartadas — com custo medido

| Alternativa | Custo medido neste repo | Por que não |
|---|---|---|
| **B1 — `ratatui` tela cheia (S4)** | + backend de evento (S4 declara que a crate não tem input handling); dois caminhos TTY/pipe; transcript renegociado | Os marcadores `[1/2]`/`[1-5]`/`(default: 1)` mudam e SI-4 deixa de provar; widget é divergência §16 (SI-6), não detalhe |
| **B2 — `inquire`/`dialoguer` (S5/S6) sem handler** | 1–2 crates; S5 registra terminal sem eco após `SIGTERM` com prompt aberto | R5: sem cleanup, dano ao operador. Com handler e texto byte-idêntico ainda é recomendação, não decisão deste ADR |
| **Inventar "voltar"/"pular"/menu de navegação** | 1 transição nova + spec nova; quebra a ordem de `runWizard:2264-2436` | D3 entregou 10 telas completas, não novo fluxo; §3.7 proíbe transição nova sem owner |
| **Tela chamando `applyMerge`/`writeManifest`** | 0 linha de prostético; 1 fronteira violada | Inverte ADR-001/003: `apply` é do motor; aborto deixaria escrita e quebraria M-5 |
| **Segredo por argv (`--token=…`)** | 0 linha; `ps`/`/proc/$PID/cmdline` expõe o valor | ADR-001 §2.3 proíbe; `canNoEcho`/`readSecretRaw` existem para manter o valor fora de canais visíveis |
| **TUI escrevendo no envelope/`stdout`** | 1 linha de progresso em `stdout` | `contract-v1` exige envelope único em `stdout`; quebra item 10 da interface e a união de bytes |
| **Fixar crate/versão de TUI neste ADR** | 1 linha de `Cargo.toml`; owner não pinou | `RESEARCH.md` §8-1: fonte é recomendação; o ADR escolhe critério, crate fica para o SDD com fonte |

## 5. Consequências, riscos e reversibilidade

- **C1 — tela vira contrato, não impressão.** Cada uma das 10 telas tem 5 campos, transições e comando de prova (§2.1); "a tela ficou bonita" deixa de ser aceite.
- **C2 — fronteira de escrita é estrutural.** 8 `op`s de TUI não gravam; `apply` é o único ponto de escrita e pertence ao motor. Aborto é 0 writes por construção.
- **C3 — reversibilidade.** Reverter o modelo = manter os prompts line-based do oráculo e descartar o módulo de tela declarativo; `gate.js`, `harness.config.json` e o selo nunca mudaram. Custo de reversão: módulo de tela e specs, 0 arquivo de config/gate.
- **R2 (herdado do PRD) — TUI muda comportamento.** Prompt/default/range divergente quebra M-4/SI-4; mitigação: transcript como autoridade + diff mesclado (itens 2/3/4); 🟠 aberto até o SDD.
- **R5 — terminal sem eco após `SIGTERM`.** Janela real em `install.mjs:2347-2357` e risco documentado em S5; mitigação: handler de restauração idempotente + prova em PTY (item 9); 🟠 aberto até o SDD — **risco de G2**.
- **R9 (herdado de ADR-002) — transcript em TTY.** Marcadores podem divergir por cleanup; a autoridade permanece o arquivo arquivado + `c63e333`; regeneração só com rito de ADR-002 §2.4 e decisão §16; 🟠 aberto.
- **R10 — cobertura de tela fora do selo (D6).** Custo aceito; não é comando canônico novo, é não republicar `c904f1c5`; ciência do owner no G2.
- **R11 — `9+2≠12` e "dry-run em 2".** Nenhum número de tela é generalizado para 12 presets sem comando; o transcript é 1 artefato arquivado, não 12 medições (ADR-002 §2.3). 🟢 prosa verificável.

## 6. Fora desta decisão

- a implementação do módulo de tela, das 8 `op`s e do handler de sinal — SDD deste ADR;
- crate, versão, toolchain, formato de binário e `Cargo.toml` — SDD, escolhidos pelo critério de `RESEARCH.md` §3 (S4/S5/S6/S10/S11); nenhum é decidido aqui;
- o contrato `contract-v1`, canais, envelope, segredo em `stdin`, exit `0/1/2`, as 23 `op`s de engine, a ordem do `upgrade` e os 12 presets — ADR-001/003/002 + D1/D2/D4/D5/D6/D7, fechados;
- o procedimento SI-1..SI-6, o predicado de externalidade, `insta` e o rito de validação humana — ADR-002;
- publicação npm, runtime do adotante e distribuição do binário — ADR-005;
- qualquer alteração em `gate.js`, `harness.config.json`, `opencode.json`, `workflow-state.json`, presets, eixos, comandos canônicos ou defaults de menu — decisão §16 do owner, nunca efeito colateral.

## 7. Verificação de prontidão deste batch

```sh
git status --short                                   # vazio; só .spec/prd/prd-installer-rust/** no commit
git rev-parse HEAD                                   # SHA local registrado no retorno do subagente
node scripts/static-checks.mjs                       # exit 0; PASS PRD-01 / ADR-01 / ADR-02 não-vacuosos
git show --stat --name-only HEAD                     # só ADR.md + ADR-INDEX.md deste PRD
grep -ciE 'TO''DO|S''TUB' .spec/prd/prd-installer-rust/ADRs/ADR-004-tui-dez-telas/ADR.md   # 0
```
