# ADR-005 — Publicação do binário e runtime do adotante: wrapper npm com `optionalDependencies` por os/cpu/libc, `install.mjs` legado fora do caminho de instalação, selo `c904f1c5` invariante e cobertura Rust em comandos paralelos fora da contraprova

- **prd-id**: `prd-installer-rust` — `.spec/prd/prd-installer-rust/PRD.md`
- **order**: 5 de 5 (`.spec/prd/prd-installer-rust/ADR-INDEX.md`) — **último ADR do PRD-3**
- **status**: `in-progress`
- **branch**: `adr/prd-installer-rust/05-publicacao-runtime-selo` (aberta de `a0508a3b88c42d9625bde223187b75670d718340` — tip da branch 04; `41c6f22a1344d9ab4bef836072d4ddbe7189f384` é o commit de abertura desta branch; o SHA do commit deste batch é registrado no retorno do subagente)
- **depende-de**: ADR-001, ADR-003, ADR-004 — `.spec/prd/prd-installer-rust/ADRs/ADR-001-fronteira-subprocesso/ADR.md` (contrato `contract-v1`: `$INSTALLER_BIN` invocado por subprocesso, stdout=envelope, stderr=progresso, exit `0/1/2`, nenhum segundo motor, oráculo em worktree `detach` fora do caminho de instalação), `.spec/prd/prd-installer-rust/ADRs/ADR-003-motor-init-doctor-upgrade/ADR.md` (`contract-v1` é a única superfície estável; 23 `op`s de engine; selo tratado como invariante em §2.5) e `.spec/prd/prd-installer-rust/ADRs/ADR-004-tui-dez-telas/ADR.md` (tela só em `stderr`, `apply` no motor, cobertura de tela já declarada como paralela e não selada em §2.6). **Nenhuma rubrica de ADR-001/003/004 é reaberta**; este ADR consome o contrato, a fronteira de escrita e a disciplina de selo, fechando apenas a frente de distribuição.
- **data**: 2026-11-16
- **dono da decisão**: owner do harness. **D5** (12 presets congelados), **D6** (`commands.suiteFull` e `HARNESS_SEAL_JSON` `c904f1c5…` invariantes; suíte Rust em comandos paralelos) e **D7** (binário autocontido + Node ≥ 20 no destino, sem toolchain Rust) são insumo fechado em `PRD.md` §16; este ADR os **implementa**, não os reabre.
- **rota**: refactor de distribuição. Nenhum preset, comando canônico, chave de config, contrato, tela ou número é inventado; muda apenas como o binário chega a quem adota e como a cobertura Rust é posicionada em relação ao selo.
- **escopo de escrita desta entrega**: apenas `.spec/prd/prd-installer-rust/**` — neste batch, `ADRs/ADR-005-publicacao-runtime-selo/ADR.md` e uma linha nova em `ADR-INDEX.md` (com a promoção de ADR-004 a `merged`, obrigatória por `ADR-02`). Nenhum arquivo de `installer/**`, `scripts/**`, `.opencode/**`, `.agents/**`, `harness.config.json`, `gate.js`, `opencode.json`, `workflow-state.json` ou `docs/**` foi tocado. O wrapper, os pacotes de plataforma, o shim e o pipeline de publicação são o **SDD** deste ADR.
- **insumo de pesquisa**: `RESEARCH.md` §6 (tema E, E1/E2, fonte S12), §7 (linha do ADR-005), §8-1 (versão de crate não é decisão do repo), §8-2 (cobertura Rust fora do selo é custo aceito), §1 S12 (npm `optionalDependencies`, `os`/`cpu`/`libc`, `bin`, `files`, `bundleDependencies`, `engines`); `PRD.md` §16-D5/D6/D7, §3.6 M8, §7 (invariantes), §13 (rede-zero); ADR-001 §2.1 (`contract-v1`), §2.5 (selo), §2.6 (oráculo em worktree `detach`); ADR-003 §2.5 (selo); ADR-004 §2.6 (selo e suíte paralela); `harness.config.json:13-16` (`commands.suiteFull`, 4 etapas) e `.opencode/plugins/lib/seal.mjs` (`sealCommands`/`verifySeal`).

## 1. Contexto — fatos medidos, não deduzidos

Medições e leituras de 2026-11-16 neste repo. Cada linha tem comando ou `arquivo:linha`; nenhum número abaixo é estimativa.

| Fato | Valor | Comando / fonte |
|---|---|---|
| Selo publicado (`suiteFull`) | **`c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2`** | `sealCommands(commands)` sobre `harness.config.json.commands`, re-derivado neste batch; `seal.mjs:14-17` |
| Selo do termo `unit` | `daba8c5465bffe061738235b274c497a4e8e761e41c5e79d4c671a72231cffc7` | mesmo comando; registrado só para provar que o objeto de selo completo é estável |
| `commands.suiteFull` | **4 etapas encadeadas**: plugins (`node --test ".opencode/plugins/__tests__/*.spec.mjs"`), installer (`node --test "installer/__tests__/*.spec.mjs"`), static (`node scripts/static-checks.mjs`), vendor (`node scripts/vendor-skills.mjs --check`) | `harness.config.json:14`; nenhuma etapa Rust |
| Suíte Rust | **fora** de `commands.suiteFull` e de `HARNESS_SEAL_JSON` | D6 (`PRD.md §16`); `RESEARCH.md §8-2`; ADR-001 §2.5, ADR-003 §2.5, ADR-004 §2.6 |
| Runtime no destino | **Node ≥ 20**; `NODE_MIN` aborta major menor | `docs/INSTALACAO.md:17` (P1); `installer/install.mjs:15,62-68` |
| Stack declarada neste repo | `stack.backend/frontend = N/A`, `infra.* = null` — o **destino** é que tem stack | `harness.config.json:4-23` |
| Presets congelados | **12** chaves em `STACK_VALUES`/`STACK_PROFILES` | D5; `PRD.md §3.4` (M4); `install.mjs:196,252` |
| `Cargo.toml` | ausente — Rust é greenfield aqui | `PRD.md §3.6` (M7); `ls Cargo.toml` |
| Oráculo | `c63e33307710e1c6271f5c68b2dd9fb15283f49c` em worktree `detach`, **fora** do caminho de instalação | ADR-001 §2.6; `git merge-base --is-ancestor c63e333 HEAD` ⇒ `0` |
| Entrypoint legado | `install.mjs` = 3.010 linhas, 95 exports, guard de entrypoint em `:2745`, 22 consumidores importam 75 exports | `PRD.md §3.1-§3.3` (M1–M3); ADR-001 §1 |
| Superfície estável do binário | `contract-v1`: stdin JSON → stdout envelope único → stderr humano sanitizado; exit `0/1/2` | ADR-001 §2.1; nenhum campo novo permitido |
| Mecanismo npm | `optionalDependencies` (falha de install **não** aborta; "program's responsibility to handle the lack"), `os`/`cpu`/`libc`, `bin`, `files`, `bundleDependencies`, `engines` | `RESEARCH.md` S12 (npm 12.2.2, `package-json`, acessada 2026-11-16) |
| `node scripts/static-checks.mjs` | exit **0**; `PASS PRD-01`/`PASS ADR-01`/`PASS ADR-02`; `V15 rede em installer/=0` | re-executado neste batch |

Saída literal da re-derivação do selo (reexecutada neste batch):

```text
suiteFull = c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2
unit      = daba8c5465bffe061738235b274c497a4e8e761e41c5e79d4c671a72231cffc7
```

**O defeito que este ADR fecha.** Duas falhas produzem "instalador em Rust pronto" sem entrega correta: (1) **empurrar a dependência para quem adota** — exigir `cargo`/`rustc`, compilar no destino ou baixar toolchain em runtime troca o requisito Node ≥ 20 por outro (D7) e reintroduz a reinvenção que o item 6 do owner proíbe; (2) **rebaixar a contraprova selada** — acrescentar `cargo test` a `commands.suiteFull` e republicar `HARNESS_SEAL_JSON` muda os bytes que `gate.js` compara e gera `sealed-command-mismatch` (`harness-config.md` §"Command seal"), trocando uma garantia 🟢 por uma suíte maior porém não confiável. Uma terceira falha, irmã da primeira: manter `install.mjs` como entrypoint no pacote ao lado do binário cria **dois motores** — exatamente o que D1/ADR-001 fecharam. Este ADR escolhe **uma** decisão de distribuição e a fecha com comando por item.

## 2. Decisão

**Decisão única: o binário Rust chega ao destino como um pacote npm wrapper que declara o executável em `bin` e distribui o binário autocontido por `optionalDependencies` com `os`/`cpu`/`libc` — o destino continua com Node ≥ 20 (runtime dos plugins/checks) e nunca instala toolchain Rust; o pacote não expõe `install.mjs` como entrypoint de instalação (o `.mjs` legado permanece apenas como oráculo congelado em worktree `detach`, fora do caminho de instalação), e a suíte Rust roda em comandos paralelos **fora** da contraprova selada, com `commands.suiteFull` e `HARNESS_SEAL_JSON` (`c904f1c5…`) byte-idênticos — custo aceito: cobertura Rust não entra no selo. Critério de distribuição julgado por ausência de toolchain no destino e por byte-identidade do selo, nunca por "compilou na minha máquina".** 🟢 para a forma da decisão (D5/D6/D7 + ADR-001/003/004 + fontes S12 e medição direta do selo); 🟡 para publicação, matriz de plataformas e fallback — é o SDD deste ADR que os prova.

### 2.1 Topologia de publicação — wrapper + `optionalDependencies` + `bin` (E1)

`"autocontido"` aqui tem significado estreito e declarado: o binário traz consigo o runtime Rust e **não exige** `cargo`, `rustc`, fontes nem etapa de compilação no destino; a libc é a do sistema operacional — é por isso que a matriz distingue `glibc` de `musl`. Nenhum script `install`/`postinstall` do pacote compila Rust.

```text
adotante (Node >= 20, SEM cargo/rustc)
   │  npm install harness-installer
   ▼
wrapper npm  (package.json)
   ├─ bin: harness-installer ──► shim JS  (localizador/lançador; NÃO é motor de instalação)
   └─ optionalDependencies  (os / cpu / libc)
        ├─ @harness/installer-linux-x64-gnu   ── instalado  (casa com o host)
        ├─ @harness/installer-linux-x64-musl  ── ignorado   (libc diferente)
        ├─ @harness/installer-darwin-arm64    ── ignorado   (os/cpu diferentes)
        └─ … demais alvos                      ── ignorados
   │  shim resolve o pacote da plataforma e o lança como subprocesso
   ▼
binário Rust autocontido  ──contract-v1──►  stdout: envelope JSON único
                                             stderr: progresso/erro sanitizado
   │  22 consumidores Node (plugins/checks/tests) = runtime de hospedagem, NÃO motor
   ▼
oráculo c63e333 (worktree detach)  ── fora do caminho de instalação, só no harness de paridade
```

- **Wrapper (`E1`)** — `package.json` declara `bin`, `optionalDependencies` por alvo e `engines: {"node": ">=20"}`. Cada pacote de plataforma declara `os`, `cpu`, `libc`, `files` (só o binário) e o seu próprio `bin`. npm **ignora silenciosamente** os pacotes cuja tripla não casa (S12: dependência opcional que falha não aborta a instalação) e instala apenas o compatível. A versão de cada pacote de plataforma acompanha a do wrapper e é definida no SDD — **não é fixada neste ADR** (§8-1 de `RESEARCH.md`: nenhuma versão é contrato).
- **Shim JS** — existe porque o destino já tem Node ≥ 20 (D7). Ele **apenas** resolve o binário instalado e o invoca; não implementa `init`/`doctor`/`upgrade`, não grava arquivo, não decide comportamento. É `contract-v1` (ADR-001) de ponta a ponta: o wrapper é um localizador, o binário é o único motor.
- **E2 descartado** — tarball único com `files`/`bundleDependencies` embutindo cada alvo baixa binários desnecessários para qualquer adotante e exige `npm pack` (S12); custo pior para quem usa um alvo só. Registrado em §4.

### 2.2 Exposição do `bin` e fallback quando os/cpu/libc não casam

S12 é explícito: com `optionalDependencies`, é **responsabilidade do programa** tratar a ausência da dependência. O fallback é, portanto, parte da decisão — não detalhe:

1. **Tempo de `npm install`** — npm avalia `os`/`cpu`/`libc` de cada pacote opcional; os incompatíveis são pulados sem erro, o compatível é instalado. Nenhum download fora do registry npm declarado (rede-zero, `PRD.md §13`; V15).
2. **Tempo de execução, tripla casa** — o shim resolve o pacote instalado e lança o binário; stdout/stderr/exit seguem `contract-v1` byte-a-byte (ADR-001 §2.1). Detecção de `libc` por sinal do runtime Node (ex.: `process.report.getReport().header.glibcVersionRuntime`), nunca por tentativa de execução cega.
3. **Tempo de execução, tripla NÃO casa ou pacote ausente** — o shim escreve em **stderr** um erro claro contendo (a) a tripla detectada (`platform`/`arch`/`libc`), (b) a matriz de alvos publicados e (c) a ação corretiva ("instale para uma plataforma suportada"), e termina com **exit `1`**. **Não** tenta baixar binário, **não** invoca `cargo`, e **não** cai para `node install.mjs` — esse seria o segundo motor. `stdout` fica sem envelope (é falha de distribuição, não falha de protocolo `contract-v1`, que usa exit `2`). Comando de prova: item 4 da interface congelada.

### 2.3 `install.mjs` legado no pacote — por que não é "dois motores"

- **No pacote publicado**: `install.mjs` **não é entrypoint nem é embarcado como caminho de instalação**. O único `bin` é o binário Rust (via shim). Um `find node_modules/harness-installer -name install.mjs` deve devolver vazio (item 6 da interface).
- **No repo do harness**: o `.mjs` permanece, intacto, em `installer/install.mjs`, e sua única função viva após a migração é ser **oráculo de comportamento e transcript** — materializado por SHA em worktree `detach` (`c63e333`, ADR-001 §2.6), **fora** do caminho de instalação. Não é executado pelo adotante, não é dependência do wrapper, não é chamado pelo fallback.
- **Por que não é dois motores**: motor = o que decide e grava a instalação. Há **um** — o binário Rust, via `contract-v1`. Node ≥ 20 é o *runtime de hospedagem* dos plugins, checks e dos 22 adaptadores que invocam o binário por subprocesso (ADR-001 §2.1); o shim é um *localizador*. Nem um nem outro reimplementam `init`/`doctor`/`upgrade`, gating ou merge. "Dois motores" seria `install.mjs` e o binário escolhidos por flag — alternativa já descartada em ADR-001 §4 e vedada por D1.

```sh
# divergência proibida (cada linha ⇒ 1 motor a mais no caminho de instalação)
grep -c 'install.mjs' node_modules/harness-installer/package.json        # ⇒ 0
find node_modules/harness-installer -name 'install.mjs'                  # ⇒ vazio
grep -cE 'cargo build|rustc |npm run build' node_modules/harness-installer/package.json  # ⇒ 0
```

### 2.4 Prova de D7 — Node ≥ 20 no destino, nenhuma toolchain Rust

A prova é feita em ambiente limpo (sem `cargo`/`rustc` no `PATH`), com Node ≥ 20, instalando o wrapper e exercitando o contrato:

```sh
node -v                                            # ⇒ v20.x.x ou maior (docs/INSTALACAO.md:17)
command -v cargo || echo 'no cargo'                # ⇒ 'no cargo'
command -v rustc || echo 'no rustc'                # ⇒ 'no rustc'
npm install harness-installer                      # sem etapa de compilação
printf '%s\n' "$REQUEST" | ./node_modules/.bin/harness-installer contract-v1 >/tmp/r.json 2>/tmp/r.err
node -e 'const e=JSON.parse(require("fs").readFileSync("/tmp/r.json","utf8")); if(e.v!==1||typeof e.ok!=="boolean") process.exit(2); console.log(e.op,e.ok)'
grep -cE 'cargo build|rustc ' node_modules/harness-installer/package.json   # ⇒ 0
```

Presença de `cargo`/`rustc` **no destino** não é requisito, mas também não é proibida: o critério é que a instalação **não dependa** deles. O que é proibido é o pacote exigir compilação — qualquer script de build no `package.json` reprova. 12 presets (D5) e o contrato `contract-v1` chegam ao adotante exatamente como no oráculo; nenhum preset novo é criado para acomodar a distribuição.

### 2.5 Prova de D6 — selo byte-idêntico e custo da cobertura paralela

`commands.suiteFull` e `HARNESS_SEAL_JSON` permanecem **byte-idênticos**. A prova é a re-derivação do selo mais o `git diff` dos dois arquivos que o sustentam:

```sh
node --input-type=module -e "import {sealCommands} from './.opencode/plugins/lib/seal.mjs';import fs from 'node:fs';console.log(sealCommands(JSON.parse(fs.readFileSync('harness.config.json','utf8')).commands))"
# ⇒ { suiteFull: 'c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2',
#      unit:      'daba8c5465bffe061738235b274c497a4e8e761e41c5e79d4c671a72231cffc7' }
node -e 'const c=JSON.parse(require("fs").readFileSync("harness.config.json","utf8")).commands.suiteFull; console.log(c.split("&&").length)'  # ⇒ 4
git diff --exit-code -- harness.config.json .opencode/plugins/lib/seal.mjs    # ⇒ vazio
grep -cE 'cargo|rust' harness.config.json                                    # ⇒ 0
```

**Declaração explícita do custo (aceito, D6):** a suíte Rust — paridade de 12 presets, gating, checks, tela e fallback — roda em **comandos paralelos fora do selo** (`cargo test` e os harnesses de differential, no SDD/CI), **nunca** em `commands.suiteFull` e nunca em `HARNESS_SEAL_JSON`. Consequência direta: **a cobertura Rust não entra na contraprova selada**. Uma suíte Rust verde não é pré-condição da contraprova selada e, inversamente, a contraprova selada não valida o binário Rust; o que garante a não-regressão do binário é o oráculo externo (ADR-002) executado nos comandos paralelos, não o selo. Não é comando canônico novo — é a decisão de **não republicar** `c904f1c5`. Custo ciência do owner no G2; `RESEARCH.md §8-2` e ADR-001/003/004 já o registram como aceito. Se o owner quiser trazer Rust para dentro do selo, isso é **reabertura de D6 em decisão §16**, com novo `sealCommands` e novo `HARNESS_SEAL_JSON` — nunca efeito colateral deste ADR.

### 2.6 Relação com `contract-v1` e com a fronteira de escrita

O wrapper é transparente ao contrato: nenhum campo de envelope, nenhum `op`, nenhum código de saída e nenhum marcador de tela muda (ADR-001 §2.1, ADR-003 §2.1, ADR-004 §2.1/§2.5). O binário continua escrevendo progresso só em `stderr` e o envelope único em `stdout`; a tela não grava e `apply` permanece no motor (ADR-004 §2.3). A distribuição altera **onde o binário está e como é encontrado**, não **o que ele faz**. Qualquer mudança observável no contrato para acomodar o empacotamento é drift e exige decisão do owner (SI-6).

## 3. Interface congelada

Forma ratificada a partir de D5/D6/D7 + ADR-001/003/004 + fontes S12. Itens *(SDD)* só passam a valer após a implementação; antes dela o comando mede o estado atual. Nível de garantia explícito.

1. **Wrapper expõe o binário via `bin`.** *(hoje)* ADR-001 §2.1 define `$INSTALLER_BIN` como entrypoint lógico; S12 define `bin`. *(SDD)* `node -e 'console.log(require("./node_modules/harness-installer/package.json").bin)'` ⇒ aponta para o shim; `./node_modules/.bin/harness-installer contract-v1 <<<"$REQUEST"` ⇒ envelope `{"v":1,…}`. 🟢 contrato · 🟡 SDD.
2. **`optionalDependencies` por os/cpu/libc.** *(hoje)* `RESEARCH.md §6-E1`, fonte S12. *(SDD)* `npm ls --all 2>/dev/null | grep -c '@harness/installer-'` ⇒ `1` (só o da plataforma); `node -e 'const p=require("./node_modules/<pacote-da-plataforma>/package.json");console.log(p.os,p.cpu,p.libc)'` ⇒ tripla do host. 🟢 fonte · 🟡 SDD.
3. **Destino sem toolchain Rust (D7).** *(hoje)* `PRD.md §16-D7`; `docs/INSTALACAO.md:17`. *(SDD)* `command -v cargo || echo 'no cargo'` e `command -v rustc || echo 'no rustc'` ⇒ `'no …'`; `node -v` ⇒ major ≥ 20; instalação + `contract-v1` em ambiente limpo ⇒ envelope; `grep -cE 'cargo build|rustc ' package.json` ⇒ `0`. 🟢 decisão · 🟡 SDD.
4. **Fallback quando a tripla não casa.** *(hoje)* S12: "program's responsibility to handle the lack". *(SDD)* remover o pacote de plataforma e invocar o shim ⇒ stderr com tripla + matriz + ação corretiva, exit `1`, stdout sem envelope, **0** download, **0** `cargo`, **0** chamada a `install.mjs`. 🟡 SDD (obrigatório).
5. **Nenhum segundo motor no caminho de instalação.** *(hoje)* ADR-001 §2.1 (subprocesso, sem FFI); `install.mjs:2745` (guard de entrypoint). *(SDD)* `grep -c 'install.mjs' node_modules/harness-installer/package.json` ⇒ `0`; durante a instalação, único filho de escrita é o binário via `contract-v1`, nunca `node install.mjs`. 🟢 ADR-001 · 🟡 SDD.
6. **`install.mjs` legado não é entrypoint no pacote.** *(hoje)* 3.010 linhas / 95 exports / 22 consumidores vivem no repo como oráculo `c63e333` em worktree `detach` (ADR-001 §2.6). *(SDD)* `find node_modules/harness-installer -name 'install.mjs'` ⇒ vazio; `test "$(git -C "$ORACULO" rev-parse HEAD)" = c63e33307710e1c6271f5c68b2dd9fb15283f49c` ⇒ `0`. 🟢 decisão · 🟡 SDD.
7. **12 presets inalterados (D5).** *(hoje)* `STACK_VALUES`/`STACK_PROFILES` = 12 chaves (`PRD.md §3.4` M4). *(SDD)* `node -e '…Object.keys(STACK_PROFILES).length…'` sobre o oráculo ⇒ `12`; `node scripts/static-checks.mjs` ⇒ `V19 consumer=21`, `V18 baseline=1`. 🟢 oráculo.
8. **`commands.suiteFull` byte-idêntico (4 etapas).** *(hoje)* `harness.config.json:14` — plugins, installer, static, vendor. *(SDD)* `git diff --exit-code -- harness.config.json` ⇒ vazio; `node -e '…suiteFull.split("&&").length'` ⇒ `4`; `grep -cE 'cargo|rust' harness.config.json` ⇒ `0`. 🟢 runtime.
9. **Selo `c904f1c5` byte-idêntico.** *(hoje)* re-derivado neste batch: `suiteFull=c904f1c5…`, `unit=daba8c5…`. *(SDD)* comando de `sealCommands` em §2.5 reproduz os dois valores; `git diff --exit-code -- .opencode/plugins/lib/seal.mjs` ⇒ vazio. 🟢 runtime.
10. **Cobertura Rust fora da contraprova selada (custo D6).** *(hoje)* `D6` + `RESEARCH.md §8-2` + ADR-001/003/004. *(SDD)* `cargo test` e harnesses de differential rodam em comando paralelo, ausente de `commands.suiteFull`; relatório declara explicitamente "Rust suite: paralela, não selada"; nenhum `HARNESS_SEAL_JSON` novo. 🟢 decisão · 🟡 execução.
11. **`contract-v1` não muda.** *(hoje)* ADR-001 §2.1: stdout=envelope único, stderr=progresso, exit `0/1/2`. *(SDD)* `printf … | harness-installer contract-v1` ⇒ mesmo envelope do oráculo; nenhum campo novo; shim não consome `stdout`. 🟢 ADR-001 · 🟡 SDD.
12. **Rede-zero no caminho de instalação.** *(hoje)* `PRD.md §13`; `V15 rede em installer/=0`. *(SDD)* nenhum script `postinstall` faz download; fallback não executa `curl`/`wget`; `node scripts/static-checks.mjs` ⇒ `V15=0`. 🟢 decisão · 🟡 SDD.
13. **Oráculo fora do caminho de instalação.** *(hoje)* `git merge-base --is-ancestor c63e333 HEAD` ⇒ `0`; ADR-001 §2.6 (worktree `detach`). *(SDD)* `git -C "$ORACULO" status --porcelain` vazio e nenhuma referência a `$ORACULO` no pacote npm. 🟢 git.
14. **Engines Node ≥ 20 declarado.** *(hoje)* `docs/INSTALACAO.md:17`. *(SDD)* `node -e 'console.log(require("./node_modules/harness-installer/package.json").engines.node)'` ⇒ `>=20`; npm recusa major menor. 🟢 decisão · 🟡 SDD.
15. **1:1 do ledger e escopo do batch.** *(hoje)* este `ADR.md` + linha 5 em `ADR-INDEX.md`; ADR-004 promovido a `merged` (`a0508a3`). *(SDD)* `node scripts/static-checks.mjs` ⇒ `PASS ADR-01` (uma linha por `ADR.md`), `PASS ADR-02` (sequência 1-5, 1 `in-progress`, branch no padrão); `git show --stat --name-only HEAD` ⇒ só `.spec/prd/prd-installer-rust/**`. 🟢 runtime · 🟡 PR humano.
16. **Nenhum crate/versão pinado aqui.** *(hoje)* `Cargo.toml` ausente (M7); campos npm de S12 não são pin de crate. *(SDD)* `grep -nE 'Cargo\.toml|[a-z]+ = "[0-9]' ADR.md` ⇒ só menções de proibição em §1/§2.1/§4/§6; `git status --short` vazio após o commit. 🟢 processo.

## 4. Alternativas descartadas — com custo medido

| Alternativa | Custo medido neste repo | Por que não |
|---|---|---|
| **E2 — tarball único com `files`/`bundleDependencies` (S12)** | baixa cada alvo para qualquer adotante; `bundleDependencies` exige `npm pack` | pior para quem usa um alvo só; matriz por `optionalDependencies` resolve com 1 pacote instalado |
| **Toolchain Rust no destino (`cargo build` no install/postinstall)** | exige `cargo`/`rustc` + compilação em cada adotante | D7: troca o requisito Node ≥ 20 por outro; `RESEARCH.md §8-1` — versão/toolchain não são decisão do repo |
| **Manter `install.mjs` como entrypoint no pacote (Node e Rust por flag)** | 3.010 linhas duplicadas + 12 presets × 2 implementações; paridade viraria "rode os dois e concorde" | D1/ADR-001 fecharam: sem dois motores; o único `.mjs` vivo é o oráculo `c63e333`, fora do caminho de instalação |
| **Acrescentar `cargo test` a `commands.suiteFull` e republicar o selo** | `suiteFull` 4 → 5 etapas; novo `HARNESS_SEAL_JSON`; `gate.js` compara os bytes publicados | D6 fechou "selo invariante"; divergência gera `sealed-command-mismatch` (`harness-config.md` §"Command seal") — rebaixa a contraprova 🟢 |
| **Baixar binário em runtime se a tripla não casar** | chamada de rede no caminho de instalação; dependência de disponibilidade externa | `PRD.md §13` rede-zero; `V15=0`; fallback deve ser erro claro (S12), não download |
| **Fixar versão de crate/`Cargo.toml` neste ADR** | 1 linha de manifesto; owner não pinou nada; `Cargo.toml` ausente (M7) | `RESEARCH.md §8-1`: versão lida de docs.rs é recomendação com fonte, não pin do projeto |
| **Publicar sem `engines.node`, aceitando Node < 20** | adotante com Node 18 quebra nos plugins/checks | D7 preserva Node ≥ 20 como runtime de hospedagem; `docs/INSTALACAO.md:17` mede `NODE_MIN` |

## 5. Consequências, riscos e reversibilidade

- **C1 — distribuição é contrato, não build.** Onde o binário está e como é encontrado vira item de interface com comando (§3), não "o CI publica e pronto".
- **C2 — um motor, um canal.** Wrapper e shim são localizadores; o binário é o único que decide e grava; `contract-v1` permanece a fronteira (ADR-001).
- **C3 — reversibilidade.** Trocar o mecanismo de distribuição (wrapper por outro empacotamento) não toca `contract-v1`, `gate.js`, `harness.config.json`, presets nem selo. Custo de reversão: pacotes de plataforma + shim + pipeline; 0 arquivo de config/gate.
- **R1 — matriz de plataformas incompleta (herdado do tema E).** Se um alvo não tiver pacote publicado, o fallback (item 4) impede instalação silenciosa, mas o adotante fica sem suporte; 🟠 aberto até o SDD definir a matriz, com ciência no G2.
- **R2 — responsabilidade do fallback (S12).** npm não aborta em dependência opcional ausente; sem handler o shim falharia de forma opaca; mitigação: erro explícito com tripla + matriz + exit `1` (item 4); 🟠 até o SDD.
- **R3 — detecção de libc.** `glibc` vs `musl` mal detectado instala o binário errado; mitigação: sinal do runtime Node + verificação do binário resolvido antes de executar; 🟠 até o SDD.
- **R4 — cobertura Rust fora do selo (D6).** Custo aceito; risco de uma regressão Rust passar despercebida pela contraprova selada. Mitigação: differential contra `c63e333` (ADR-002) nos comandos paralelos + relatório explícito. 🟠 ciência do owner no G2 — **risco de G2**; não é comando novo, é não republicar `c904f1c5`.
- **R5 — pressão para "trazer Rust para a suíte".** Tentação de acrescentar etapa a `commands.suiteFull`; vedada por D6 a menos que o owner reabra a decisão em §16 com novo selo; 🟢 prosa verificável (itens 8/9/10).

## 6. Fora desta decisão

- a implementação do wrapper, do shim, dos pacotes de plataforma, do pipeline de build/publicação e da matriz de alvos — SDD deste ADR;
- crate, versão de crate, toolchain de compilação, `Cargo.toml`, formato/código do binário e configuração de build — SDD, escolhidos pelo critério de `RESEARCH.md` §6/§8-1 (S12 é fonte de distribuição, não pin); nenhum é decidido aqui;
- o contrato `contract-v1`, canais, envelope, segredo, exit `0/1/2`, as 23 `op`s de engine, as 8 `op`s de TUI, as 10 telas, os 12 presets, o procedimento SI-1..SI-6 e o oráculo `c63e333` — ADR-001/002/003/004 + D1–D5, fechados;
- o rito de validação de literal e a autoridade do transcript — ADR-002;
- registro npm específico (URL de registry, escopo/nome exato do pacote), assinatura de pacote e política de versionamento — SDD, desde que não violem D6/D7;
- qualquer alteração em `gate.js`, `harness.config.json`, `opencode.json`, `workflow-state.json`, presets, eixos, comandos canônicos, defaults de menu ou `HARNESS_SEAL_JSON` — decisão §16 do owner, nunca efeito colateral.

## 7. Verificação de prontidão deste batch

```sh
git status --short                                   # vazio; só .spec/prd/prd-installer-rust/** no commit
git rev-parse HEAD                                   # SHA local registrado no retorno do subagente
node scripts/static-checks.mjs                       # exit 0; PASS PRD-01 / ADR-01 / ADR-02 não-vacuosos
git show --stat --name-only HEAD                     # só ADR.md + ADR-INDEX.md deste PRD
grep -ciE 'TO''DO|S''TUB' .spec/prd/prd-installer-rust/ADRs/ADR-005-publicacao-runtime-selo/ADR.md   # 0
```
