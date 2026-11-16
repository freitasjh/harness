# ADR-002 — Oráculo de paridade com anti-tautologia: literais congelados **mais** differential contra o Node `c63e333`, `insta` apenas como revisor de diff e literal só válido após validação humana

- **prd-id**: `prd-installer-rust` — `.spec/prd/prd-installer-rust/PRD.md`
- **order**: 2 de 5 (`.spec/prd/prd-installer-rust/ADR-INDEX.md`)
- **status**: `in-progress`
- **branch**: `adr/prd-installer-rust/02-oraculo-paridade` (aberta de `e3d86de`; HEAD local `9f1e37e` — commit do orquestrador que abriu o slot; o commit deste ADR é registrado no §8 e no retorno do batch)
- **depende-de**: ADR-001 — `.spec/prd/prd-installer-rust/ADRs/ADR-001-fronteira-subprocesso/ADR.md`. Herda o contrato `contract-v1` (canais, envelope `v:1`, exit `0/1/2`, segredo em `stdin`, registry de 6 mapas, worktree `detach` do oráculo em `c63e333`). **Nenhuma rubrica de ADR-001 é reaberta**; este ADR escreve só o procedimento SI-1..SI-6 e a prova da registry.
- **data**: 2026-11-16
- **dono da decisão**: owner do harness. **D2** (paridade total antes de trocar), **D4** (Node `c63e333` como oráculo + baselines literais como contraprova), **D5** (12 presets congelados), **D6** (selo `c904f1c5…` invariante, suíte Rust em paralelo) e **D8** (5 ADRs) são insumo fechado: este ADR os **implementa**, não os reabre.
- **rota**: refactor do mecanismo de verificação. Nenhum comportamento de instalação muda; muda a autoridade que julga a paridade.
- **escopo de escrita desta entrega**: apenas `.spec/prd/prd-installer-rust/**` — neste batch, `ADRs/ADR-002-oraculo-paridade/ADR.md` e `ADR-INDEX.md`. Nenhum arquivo de `installer/**`, `scripts/**`, `.opencode/**`, `.agents/**`, `harness.config.json`, `gate.js`, `opencode.json` ou `workflow-state.json` foi tocado. O harness de paridade, a registry gerada e as specs migradas são o **SDD** deste ADR.
- **insumo de pesquisa**: `RESEARCH.md` §4 (C1/C2/C3 + recomendação C2+C3), §7 (linha do ADR-002), §8 itens 3/4/6 (oráculo físico, `9+2≠12`, snapshot aceito como bug validado), S7 (`insta`) e S8 ("Saved Master" *validated*/*unvalidated*, "Independent Implementation", "Functional Equivalence"); `PRD.md` §3.5 (SI-1..SI-6 + guarda tautológica), §3.6 (M-1/M-2/M-3/M-10), §16 (D2/D4/D5/D8); ADR-001 §2.5/§2.6 (registry injetada e oráculo materializado).

## 1. Contexto — fatos medidos, não deduzidos

Medições e leituras de 2026-11-16 neste repo. Nenhum número abaixo é estimativa; `12/12` **não** aparece como fato medido em lugar nenhum deste ADR.

| Fato | Valor | Comando / fonte |
|---|---|---|
| Baseline de config (SI-1) | **9 presets byte-equal + 2 com asserts parciais**. Os 2 parciais são `flutter`/`dart`: asserts dedicados de `commands`, `mcp.required` e `moduleMap`, não igualdade de documento inteiro | `installer/__tests__/golden.spec.mjs:48-60`, `:87-114`, `:118-170`; `PRD.md` §3.5-SI-1 e §3.6-M1 |
| Dry-run (SI-3) | **2 presets medidos**, hash `063c1ddc…`; 12 é meta | `harness/harness-eixos-stack.json:70-71`; `PRD.md` §3.5-SI-3 |
| Oráculo literal independente | `EXPECTED_STACKS` é **literal escrito à mão** no spec, não derivado de `install.mjs` nem de Rust | `installer/__tests__/eixos-stack.spec.mjs:3-9` (comentário CR-1), `:39-52`, `:54-60`; `ADR.md` ADR-001 §2.6(c) |
| Transcript de tela | 1 arquivo arquivado, com `[1/2]`, `[2/2]`, `[1-5]`, `(default: 1)`, `(q cancela)` | `.spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt`; `PRD.md` §3.5-SI-4 |
| Oráculo físico | `c63e33307710e1c6271f5c68b2dd9fb15283f49c` é ancestral do HEAD; materialização em worktree `detach` somente leitura, SHA e `status --porcelain` verificados antes de cada corrida | ADR-001 §2.6; `git merge-base --is-ancestor c63e333 HEAD` ⇒ `0`; `git diff --stat c63e333 HEAD -- installer/` ⇒ vazio hoje (o SDD mudará esses bytes) |
| `insta` | grava `.snap`/`.snap.new` e exige `cargo insta review`; `.snap.new` aceito sem validação é "saved master unvalidated" | `RESEARCH.md` S7, S8, §8-6 |
| Registry injetada | 6 mapas, hoje importados de `../installer/install.mjs` em `scripts/static-checks.mjs:81`, congelados em `CDL_EXPORTS` (`:85-92`) e passados a `runCdlChecks` (`:497`, `:517`) | `scripts/static-checks.mjs:73-92`; ADR-001 §2.5, risco R1 |
| Selo | `c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2`, invariante | `sealCommands(commands)`; D6; ADR-001 §2.5 |

**O defeito que este ADR fecha.** Há duas maneiras de "provar paridade" que produzem verde falso: (1) derivar o baseline do próprio Rust sob teste — o teste passa porque o sujeito se compara consigo mesmo (guarda tautológica registrada em `PRD.md` §3.5 e no Brain `sessoes/projetos/harness/2026-10-18-harness-eixos-stack-batch1`); (2) aceitar `.snap.new` sem validar o literal — o bug vira baseline "validado" (R6 do `RESEARCH.md` §8-6, S8 *unvalidated master*). A autoridade de julgamento precisa ser **externa ao sujeito e expirável**, com dono e comando.

## 2. Decisão

**O oráculo de paridade é um par obrigatório: literais congelados no repo (`golden.spec.mjs`, `EXPECTED_STACKS`, transcript arquivado) **mais** differential contra o instalador Node `c63e333` materializado em worktree `detach`, somente leitura. `insta` é opcional e **exclusivamente** revisor de diff — nunca produtor, nunca aceitador da verdade. Nenhuma asserção de paridade pode derivar do binário Rust sob teste nem de função por ele invocada. Cada literal só entra no baseline após validação humana com dono, assinatura e condição de expiração. Os 6 mapas da registry só trocam de especificador em `scripts/static-checks.mjs:81` depois de provados byte-a-byte contra o oráculo.** 🟢 para a forma do mecanismo (D2/D4/D5/D6 + `RESEARCH.md` §4/§7); 🟡 para execução, medição e assinatura — é o SDD deste ADR que as prova.

### 2.1 Predicado anti-tautologia — o que é externo ao sujeito

Seja `S` o binário Rust sob teste e `O` um candidato a oráculo. `O` é **externo** a `S` se e somente se as três condições valem:

1. **Anterioridade**: `source(O)` é um artefato com data/commit anterior ao início do SDD que produz `S` — literal committed em `installer/__tests__/**` ou transcript arquivado, ou o commit imutável `c63e333`.
2. **Independência de escrita**: nenhuma escrita em `S` (nem em módulo chamado por `S`, nem no adapter que o invoca) pode alterar os bytes de `O`. Prova: `git diff --exit-code -- installer/__tests__/golden.spec.mjs installer/__tests__/eixos-stack.spec.mjs .spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt` ⇒ vazio durante o ciclo inteiro; `git -C "$ORACULO" status --porcelain` ⇒ vazio antes de cada corrida.
3. **Independência de execução**: `O` pode ser lido sem executar `S`. Literal e transcript são arquivos; o differential executa `c63e333`, nunca `$INSTALLER_BIN`.

**Predicado de rejeição (tautologia).** `O` é **derivado** — logo inválido como oráculo — se existir comando que o regenere a partir de `S`, de `contract-v1`, da registry gerada para `S` ou de qualquer função que `S` chame. Nesse caso a asserção `S == O` é identidade disfarçada de prova e **reprova**, mesmo verde. `.snap`/`.snap.new` produzido por `insta` sobre a saída de Rust começa nessa classe: só sai dela após a validação humana do §2.4, e mesmo assim o literal assinado, não o `.snap`, é a autoridade.

Consequência operacional: o differential compara `node "$ORACULO/installer/install.mjs"` com `$INSTALLER_BIN contract-v1` (dois motores, dois processos, dois caminhos de código); o par comparado **nunca** é `$INSTALLER_BIN` consigo mesmo nem `contract-registry.mjs` com `contract-v1`.

### 2.2 Por que C2 + C3, e não um só

- **C2 (literais)** quebra a guarda tautológica e detecta drift de derivação — `EXPECTED_STACKS` falha quando `stacksFor` muda de comportamento, precisamente porque não vem de `stacksFor`. Cobertura atual: **9 byte-equal + 2 parciais**.
- **C3 (differential)** cobre o que o literal não cobre hoje: os 2 presets parciais, payload de arquivos, manifesto e transcript, nos 12 presets congelados (D5). É o "Functional Equivalence" / "Independent Implementation" de S8.
- **C1 (`insta`)** só torna o diff legível. `cargo insta review` é ferramenta de leitura; **`cargo insta accept` não é comando de validação** e não aparece em nenhum procedimento deste ADR. `.snap.new` pendente não entra em baseline nem em relatório verde.

Um dos dois sozinho é insuficiente: C2 sozinho não atinge 12/12 (são 9 + 2); C3 sozinho herda os bugs do oráculo e, sem literal independente, perde a contraprova que distingue "o Rust copiou o Node" de "o Rust e o Node concordam com a especificação congelada".

### 2.3 Linha de base e meta — publicação de número

| Classe | Valor | Tratamento obrigatório em relatório |
|---|---|---|
| Config por preset (SI-1) | **9 byte-equal + 2 parciais** medidos | escrever literalmente "baseline medido: 9 byte-equal + 2 parciais (`flutter`, `dart`)" |
| Dry-run (SI-3) | **2 presets medidos** (hash `063c1ddc…`) | escrever "dry-run medido em 2 presets"; nunca generalizar para 12 |
| Paridade total (D2/M-1/M-2/M-3) | **12/12 é meta re-derivável**, não fato atual | só publicar `12/12` quando os comandos do §4 (SI-1/SI-2/SI-3) tiverem sido executados nos 12 presets e o número puder ser re-derivado por terceiro (M-10) |

Qualquer relatório que apresente `12/12` como medido sem o comando correspondente é **drift** (R4 do `RESEARCH.md` §8) e bloqueia o G2. A meta não é rebaixada nem antecipada: o SDD mede 9 + 2, mede os 2 de dry-run e então deriva o restante via differential — nunca o contrário.

### 2.4 Validação humana do literal — dono, rito e expiração

Risco R6 (`RESEARCH.md` §8-6): snapshot aceito pode virar bug validado. Processo obrigatório, sem `accept` cego:

1. **Preparação (executor: `qa-engineer` no SDD)**: `.snap.new`/diff gerado por `insta` é **prévia**. Para cada literal candidato, o executor produz uma linha de rubrica com: `arquivo:linha` do literal, saída do oráculo que o sustenta (comando do §4), trecho de `PRD.md` §16/ADR que autoriza a mudança e o `sha256` do arquivo de literal resultante.
2. **Revisão (dono: owner do harness)**: `cargo insta review` usado **apenas** para ver o diff lado a lado. O owner compara a rubrica com a saída do oráculo; divergência não autorizada ⇒ rejeição, não "ajuste do baseline".
3. **Assinatura (registro: orquestrador)**: rito válido é uma linha `Veredito: validated literal <sha256> <ISO-8601> <oráculo>` no artefato de evidência do ciclo (`harness/<demand>.json`) **antes** do literal entrar no baseline. Sem essa linha, o literal é `unvalidated` e a asserção que dele depende não conta como prova.
4. **Congelamento**: após assinatura, `git diff --exit-code` sobre o arquivo de literal deve ser vazio até o fim do ciclo. Reescrita sem nova assinatura invalida a prova.

**Condição de expiração** — o literal validado deixa de valer na **primeira** destas ocorrências: (a) decisão §16 do owner mudar preset, eixo, comando canônico, chave de config ou default de menu (D5 congela os 12; qualquer mudança é decisão nova); (b) `c63e333` deixar de ser o oráculo pinado por decisão do owner; (c) `sha256` do arquivo de literal divergir do assinado; (d) arquivamento do PRD. Expirado ⇒ rubrica refeita do zero, com nova assinatura; **nunca** revalidação por herança.

### 2.5 Prova byte-a-byte da registry dos 6 mapas antes de trocar o especificador

`contract-registry.mjs` é gerada/congelada **a partir do oráculo `c63e333`** (ADR-001 §2.5), nunca a partir de Rust. Antes de `scripts/static-checks.mjs:81` passar de `../installer/install.mjs` para `../installer/contract-registry.mjs`, o harness de paridade executa, fail-closed:

```sh
node --input-type=module -e '
import fs from "node:fs";
const KEYS = ["AXIS_IDS","SKILLS_BY_AXIS","SKILLS_COMMON","RULES_BY_AXIS","RULES_COMMON","STACKS_FOR_EXCEPTIONS"];
const oracle = await import(process.env.ORACLE_MJS);      // $ORACULO/installer/install.mjs (detach, SHA verificado)
const reg    = await import("./installer/contract-registry.mjs");
for (const k of KEYS) {
  const a = JSON.stringify(oracle[k]), b = JSON.stringify(reg[k]);
  if (a !== b) throw new Error("REGISTRY_DRIFT " + k + " " + a.length + "/" + b.length);
  console.log(k + " byte-equal " + (await import("node:crypto")).createHash("sha256").update(b).digest("hex").slice(0,12));
}
'
grep -c 'contract-v1\|INSTALLER_BIN' installer/contract-registry.mjs   # ⇒ 0 (módulo de dados puro)
test "$(git show HEAD:scripts/static-checks.mjs | sed -n '81p')" = '} from "../installer/install.mjs";'  # troca só depois do verde
```

"Byte-a-byte" aqui é igualdade da serialização `JSON.stringify` com ordem de chaves preservada dos **6** mapas, mais o `sha256` de cada string registrado no relatório do ciclo; um sétimo mapa ou chave nova cai em SI-6, não em "detalhe de geração". A prova é pré-condição da troca: divergência em qualquer mapa mantém o especificador antigo e registra R1 do ADR-001. Depois da troca, `node scripts/static-checks.mjs` ⇒ `PASS V19`, `PASS V20` com os mesmos números, e `CDL_EXPORTS`/3 módulos `lib/**/checks.mjs` seguem intactos (ADR-001 §2.5 — nenhum deles passa a importar `installer/` como runtime).

### 2.6 Oráculo físico — onde vive, sem mexer no selo

Herda ADR-001 §2.6 integralmente: worktree `git worktree add --detach "$ORACULO" c63e333`, fora da árvore de trabalho, com `rev-parse HEAD` = SHA completo e `status --porcelain` vazio **antes de cada corrida**, removido ao fim do ciclo. `$ORACULO` é o único `.mjs` vivo permitido e fica **fora** do caminho de instalação — a convivência Node↔Rust autorizada pela exceção controlada de `PRD.md` §3.5 é só esta. Suíte Rust roda em comandos paralelos; `harness.config.json`, `HARNESS_SEAL_JSON` (`c904f1c5…`) e `commands.suiteFull` não são alterados (D6). Editar o worktree, apontá-lo para outra SHA ou gerar o baseline a partir do binário é **drift registrado**, nunca substituição silenciosa.

## 3. Interface congelada

Forma ratificada a partir de D2/D4/D5/D6 + `RESEARCH.md` §4/§7. Itens *(SDD)* só passam a valer após a implementação; antes dela, o comando mede o estado atual. Nível de garantia explícito.

1. **Predicado de externalidade.** `O` é externo se anterior a `S`, imutável por escrita em `S` e legível sem executar `S`; derivado de `S` ⇒ reprova. *(hoje)* `sed -n '3-9p;39-52p' installer/__tests__/eixos-stack.spec.mjs` mostra o literal CR-1 e a tabela escrita à mão; `git diff --exit-code -- installer/__tests__/golden.spec.mjs installer/__tests__/eixos-stack.spec.mjs` ⇒ vazio. *(SDD)* mesmo `git diff` ao fim de cada task ⇒ vazio. 🟢 código · 🟡 execução.

2. **Oráculo físico imutável.** Worktree `detach` em `c63e333`, verificado por corrida. *(hoje)* `git merge-base --is-ancestor c63e333 HEAD` ⇒ `0`; *(SDD)* `test "$(git -C "$ORACULO" rev-parse HEAD)" = c63e33307710e1c6271f5c68b2dd9fb15283f49c && test -z "$(git -C "$ORACULO" status --porcelain)"` ⇒ `0`. 🟢 git.

3. **Literais não reescritos no ciclo.** Baseline e transcript são somente leitura. *(SDD)* `git diff --exit-code -- installer/__tests__/golden.spec.mjs installer/__tests__/eixos-stack.spec.mjs .spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt` ⇒ vazio. 🟢 git.

4. **SI-1 — config por preset.** 9 byte-equal + 2 parciais hoje; 12/12 meta. *(hoje)* `node --test installer/__tests__/golden.spec.mjs`; *(SDD)* `diff -u <(printf '%s\n' "$REQ" | node "$ORACULO/installer/install.mjs") <(printf '%s\n' "$REQ" | "$INSTALLER_BIN" contract-v1 | node -e '…result.config…')` para cada um dos 12 presets. 🟢 baseline · 🟡 differential.

5. **SI-2 — payload caminhos + bodies.** *(hoje)* procedimento em `harness/harness-eixos-stack-p2.json:159`; *(SDD)* `diff -u <(node "$ORACULO/installer/install.mjs" <<<"$REQ_COLLECT" | node -e '… result.paths|sort|sha256 …') <("$INSTALLER_BIN" contract-v1 <<<"$REQ_COLLECT" | node -e '… result.paths|sort|sha256 …')` ⇒ vazio nos 12 presets. 🟡 SDD.

6. **SI-3 — dry-run 0 writes.** 2 presets medidos, 12 meta. *(hoje)* `sed -n '70,71p' harness/harness-eixos-stack.json`; *(SDD)* `a=$(find . | sort | sha256sum); "$INSTALLER_BIN" contract-v1 <<<"$REQ_DRY"; b=$(find . | sort | sha256sum); test "$a" = "$b" && test -z "$(git status --porcelain)"`. 🟡 SDD.

7. **SI-4 — transcript W0..W7/W2m.** *(hoje)* `grep -nE '\[1/2\]|\[2/2\]|\[1-5\]|\(default: 1\)|\(q cancela\)' .spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt` ⇒ 5 marcadores; *(SDD)* `diff -u .spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt <(transcript do binário em TTY)` ⇒ vazio. 🟢 arquivo · 🟡 transcript.

8. **SI-5 — checks e manifesto.** *(hoje)* `node --test installer/__tests__/checks.spec.mjs installer/__tests__/merge-manifest.spec.mjs installer/__tests__/suite.spec.mjs`; *(SDD)* `diff -u <(node "$ORACULO/installer/install.mjs" <<<"$REQ_CHECKS" | node -e '…result.verdicts…') <("$INSTALLER_BIN" contract-v1 <<<"$REQ_CHECKS" | node -e '…result.verdicts…')` ⇒ vazio. 🟢 Node · 🟡 SDD.

9. **SI-6 — sem invenção.** *(hoje)* `node --test installer/__tests__/eixos-stack.spec.mjs` (a tabela literal cobre exatamente os 12 presets); *(SDD)* `git diff --name-only c63e333 HEAD -- harness.config.json opencode.json .agents/ gate.js` ⇒ vazio e `node scripts/static-checks.mjs` ⇒ exit `0`; toda divergência tem linha em `PRD.md` §16 + ADR + diff declarado. 🟢 repo · 🟡 PR humano.

10. **Registry 6 mapas byte-a-byte antes da troca.** Comando do §2.5 ⇒ 6 linhas `byte-equal` + `grep -c 'contract-v1\|INSTALLER_BIN' installer/contract-registry.mjs` ⇒ `0`; só então `scripts/static-checks.mjs:81` muda. 🟡 SDD (pré-condição fail-closed).

11. **`insta` só revisor de diff.** *(SDD)* `grep -rn 'cargo insta accept' .spec/ installer/ harness/ 2>/dev/null` ⇒ vazio; `find . -name '*.snap.new' -not -path './target/*'` ⇒ vazio antes de qualquer relatório verde; `cargo insta review` aparece só no rito de leitura do §2.4. 🟡 processo + verificação estrutural.

12. **Validação humana do literal.** *(SDD)* `grep -q 'Veredito: validated literal' harness/<demand>.json` ⇒ `0`, com `sha256` do literal igual ao assinado e `data` ISO-8601; sem isso, a asserção dependente não conta como prova. Dono owner; executor `qa-engineer`; registro orquestrador; expiração nas 4 condições do §2.4. 🟡 processo (rito humano, sem deny de runtime).

13. **Número publicado é re-derivável.** Relatório só escreve `12/12` se os comandos dos itens 4–6 tiverem rodado nos 12 presets; caso contrário escreve "9 byte-equal + 2 parciais" e "dry-run medido em 2 presets". *(hoje)* `grep -n '12/12' PRD.md | head` ⇒ todas as ocorrências rotuladas `meta`/`M-*`. 🟢 prosa verificável.

14. **Selo intacto, cobertura paralela.** *(hoje)* `node --input-type=module -e "import {sealCommands} from './.opencode/plugins/lib/seal.mjs';import fs from 'node:fs';console.log(sealCommands(JSON.parse(fs.readFileSync('harness.config.json','utf8')).commands))"` ⇒ `c904f1c5…`; *(SDD)* `git diff --exit-code -- harness.config.json .opencode/plugins/lib/seal.mjs` ⇒ vazio. 🟢 runtime.

15. **Escopo de decisão.** Nenhum crate, versão, framework, preset novo, comando canônico novo ou rubrica de ADR-001 é decidido aqui. *(hoje)* `git status --porcelain` ⇒ vazio após o commit; `git show --stat --name-only HEAD` ⇒ só `.spec/prd/prd-installer-rust/**`. 🟢 processo.

## 4. Predicados SI-1..SI-6 — oráculo, comando, dono

`$ORACULO`, `$INSTALLER_BIN`, `$REQ*` e `contract-v1` vêm de ADR-001 §2.1/§2.6. "Dono" = quem responde pela autoridade do oráculo; execução no SDD é do `qa-engineer`, registro de evidência é do orquestrador.

| # | Predicado comparado | Oráculo (externo a Rust) | Comando que prova | Dono |
|---|---|---|---|---|
| **SI-1** | Chaves **e** valores da config gerada por preset, byte-a-byte. Hoje: 9 byte-equal + 2 parciais; 12/12 é meta | `baseline()` literal em `golden.spec.mjs:14-46` + asserts dedicados `:87-114` + `c63e333` nos 2 parciais | `node --test installer/__tests__/golden.spec.mjs` **e** `diff -u <(node "$ORACULO/installer/install.mjs" <<<"$REQ") <("$INSTALLER_BIN" contract-v1 <<<"$REQ" | node -e '…result.config…')` por preset | owner (D2/D4/D5); exec `qa-engineer` |
| **SI-2** | Lista de arquivos propagados: **caminhos e bodies** ordenados e iguais, 12 presets | `collectIncoming` do `c63e333` em árvore descartável + procedimento em `harness/harness-eixos-stack-p2.json:159` | `diff -u <(oráculo-collect \| sort \| sha256sum) <(contract-v1 collectIncoming \| sort \| sha256sum)` nos 12 | owner (D2); exec `qa-engineer` |
| **SI-3** | Dry-run: **0 writes** — hash do destino idêntico antes/depois. Hoje 2 presets medidos | hash `063c1ddc…` em `harness/harness-eixos-stack.json:70-71` + árvore descartável | `a=$(find . \| sort \| sha256sum); …contract-v1…; b=$(find . \| sort \| sha256sum); test "$a" = "$b"` | owner (D2); exec `developer-engineer` |
| **SI-4** | Transcript W0..W7 e W2m em 2 passos: mesmos prompts, defaults, ranges | Transcript arquivado (16.336 bytes, 5 marcadores) + TTY do `c63e333` | `grep -nE '\[1/2\]|\[2/2\]|\[1-5\]|\(default: 1\)|\(q cancela\)' …transcript.txt` **e** `diff -u …transcript.txt <(transcript do binário)` | owner (D4); TUI é ADR-004 |
| **SI-5** | Vereditos de checks e manifesto: mesmos campos, mesmos valores | specs Node `checks`/`merge-manifest`/`suite` + envelope do `c63e333` | `node --test installer/__tests__/checks.spec.mjs installer/__tests__/merge-manifest.spec.mjs installer/__tests__/suite.spec.mjs` **e** `diff -u <(oráculo.verdicts) <(binario.result.verdicts)` | owner (D2); exec `qa-engineer` |
| **SI-6** | Nenhum artefato/preset/comando/chave/default/arquivo **novo** sem §16 + diff declarado | `PRD.md` §16 + lista proibida em §3.5 + `EXPECTED_STACKS` literal + `c63e333` | `node --test installer/__tests__/eixos-stack.spec.mjs`; `git diff --name-only c63e333 HEAD -- harness.config.json opencode.json .agents/ gate.js` ⇒ vazio; `node scripts/static-checks.mjs` ⇒ `0` | owner (§16, D5/D6); registro orquestrador |

## 5. Alternativas descartadas — com custo medido

| Alternativa | Custo medido neste repo | Por que não |
|---|---|---|
| **`insta` como autoridade** (aceitar `.snap.new` para fechar o baseline) | 0 linha de código; risco real: S8 classifica saved master como *unvalidated* e `RESEARCH.md` §8-6 nomeia o dano — bug virado baseline | R6: exige rito do §2.4; `insta` fica só como revisor de diff, nunca produtor da verdade |
| **Snapshot gerado pelo próprio Rust como baseline** | Aparente economia de 2 arquivos literais; produce `S == f(S)` | É exatamente a guarda tautológica de `PRD.md` §3.5 / `eixos-stack.spec.mjs:3-9` — verde sem prova. Reprova pelo predicado §2.1 |
| **Differential sozinho, sem literais** | Cobre 12 presets, mas nenhuma contraprova externa independente do oráculo | S8: oráculo complexo tem bugs próprios e pode ser mais caro que o sujeito; D4 exige as baselines literais como contraprova |
| **Literais sozinhos, sem differential** | Cobre 9 byte-equal + 2 parciais (dry-run em 2) | D2 exige paridade total antes de trocar; os 2 parciais e os 12 presets de payload/manifesto/transcript ficariam sem prova |
| **Comparar contra `install.mjs` do HEAD vivo** | 0 config; o oráculo "acompanha" o SDD | Anula a anterioridade do predicado §2.1: quando o SDD mudar os bytes do instalador, a comparação passa a ser consigo mesma. D4 pinou `c63e333` justamente para isto |
| **Trocar `scripts/static-checks.mjs:81` antes da prova da registry** | 1 linha alterada; `V19`/`V20` passam a ler mapas ainda não provados | R1 do ADR-001: muda a fonte de verdade sem aviso. Pré-condição fail-closed do §2.5 |

## 6. Consequências, riscos e reversibilidade

- **C1 — rota de execução única.** Cada predicado SI passa a ter oráculo, comando e dono nomeados (§4); nenhum "deve ser equivalente" sem medição.
- **C2 — paridade é condição, não resultado.** D2 permanece: o especificador em `scripts/static-checks.mjs:81` só troca depois de SI-1..SI-6 verdes nos 12 + registry provada (§2.5). Nenhum meio instalador é entregue.
- **C3 — reversibilidade.** Desfazer o mecanismo = manter `install.mjs` como fonte dos 6 mapas e descartar o harness de paridade; `gate.js`, `harness.config.json` e o selo nunca mudaram. Custo de reversão: nenhum arquivo de config/gate.
- **R1 — drift da registry (herdado do ADR-001).** 6 mapas divergentes mudam `V19`/`V20` de fonte. Mitigação: prova byte-a-byte do §2.5 antes da troca; 🟠 aberto até o SDD.
- **R6 — snapshot aceito como bug validado.** Mitigação: rito do §2.4 com dono, assinatura e expiração; `cargo insta accept` proibido; 🟡 processo até o SDD.
- **R7 — `9+2≠12`.** Publicar `12/12` sem comando é drift; regra do §2.3 e item 13 da interface. 🟢 prosa verificável.
- **R8 — custo do differential.** Dois motores executados por preset durante a migração; é a convivência autorizada pela exceção de `PRD.md` §3.5, restrita ao worktree `detach` e fora do caminho de instalação. Custo aceito, não comando canônico novo.
- **R9 — transcript em TTY.** Marcadores podem divergir por cleanup de terminal; dono da regeneração é ADR-004, mas a autoridade do transcript permanece o arquivo arquivado + `c63e333`. 🟠 aberto até ADR-004.

## 7. Fora desta decisão

- implementação do harness de paridade, geração de `contract-registry.mjs`, migração dos 22 consumidores e criação de specs Rust — SDD deste ADR;
- crate, versão, framework de CLI/TUI, toolchain, formato de binário e distribuição — ADR-003/004/005 (`RESEARCH.md` §2–§4 só recomendam);
- o contrato `contract-v1`, os 6 mapas injetados, o selo `c904f1c5…` e as decisões D2/D4/D5/D6 — fechados, não reabertos;
- as 10 telas e o cleanup de terminal — ADR-004 (aqui só a autoridade do transcript, SI-4);
- publicação, runtime do adotante e suíte em paralelo — ADR-005;
- qualquer alteração em `gate.js`, `harness.config.json`, `opencode.json`, `workflow-state.json`, presets, eixos, comandos canônicos ou defaults de menu.

## 8. Verificação de prontidão deste batch

```sh
git status --short                                   # vazio; só .spec/prd/prd-installer-rust/** no commit
git rev-parse HEAD                                   # SHA local registrado no retorno do subagente
node scripts/static-checks.mjs                       # exit 0; PASS PRD-01 / ADR-01 / ADR-02
git show --stat --name-only HEAD                     # só ADR.md + ADR-INDEX.md deste PRD
grep -ciE 'TO''DO|S''TUB' .spec/prd/prd-installer-rust/ADRs/ADR-002-oraculo-paridade/ADR.md   # 0
grep -c 'cargo insta accept' .spec/prd/prd-installer-rust/ADRs/ADR-002-oraculo-paridade/ADR.md   # 4 ocorrências: todas em prosa de proibição/checagem; 0 como comando executável
```
