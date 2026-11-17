# ADR-INDEX — `prd-installer-rust`

> **Ledger 1:1 com `ADRs/**`** — uma linha por `ADR.md` existente no disco. Contrato das colunas
> (`.agents/rules/prd-adr-pipeline.md` §2): `order` inteiro ≥1 · `status` no enum
> `todo|in-progress|merged|dropped` (`proposed` não existe — `checks.mjs:47`) · `depends_on` declarado
> (`—` quando não há) · `dir` no padrão `ADRs/ADR-00N-{slug}/` · `branch` no padrão
> `adr/{prd-id}/{nn}-{slug}` · `merge` preenchido **somente** quando `status=merged`.
>
> **Por que as linhas entraram uma a uma (e por que agora são 5).** As 5 linhas do fatiamento D8
> estão aprovadas (`PRD.md` §16) e recomendadas em `RESEARCH.md` §7, mas `ADR-01` exige 1:1 entre
> índice e disco: linha de índice sem `ADRs/<dir>/` correspondente é FAIL e diretório sem linha é
> órfão (`checks.mjs:294-301`). Materializar as 5 linhas antes dos 5 diretórios deixaria
> `node scripts/static-checks.mjs` em exit 1 com falhas de 1:1 — contra RF-10 e H2 do harness.
> `ADR-02` tampouco aceita índice sem linha parseável (`checks.mjs:362-366`). Cada linha nova entra
> no mesmo commit do seu `ADR.md` (precedente da casa, PRD-2). Com a linha 5 materializada neste
> commit, o índice cobre o fatiamento completo: 5 linhas, 5 diretórios, 5 `ADR.md`, 0 órfão.
>
> **1:1 resolvido sem stub.** A linha 1 nasceu com um `ADR.md` de inventário marcado como não-decisão;
> esse inventário foi ratificado em `e3d86de` (`docs(adr): ADR-001 do PRD-3 — fronteira de subprocesso
> e contrato contract-v1`) como decisão completa — `depende-de`, interface congelada numerada,
> alternativas e trade-off. Nenhuma rubrica foi reaberta. A linha 2 entrou com o `ADR.md` do
> oráculo de paridade em `6a3b4ed`; a linha 3 entrou com o `ADR.md` do motor
> `init`/`doctor`/`upgrade` em `4d5b70e`; a linha 4 entrou com o `ADR.md` da TUI de 10 telas em
> `a0508a3`; a linha 5 entra neste commit com o `ADR.md` de publicação/runtime/selo — o último do
> PRD-3. Cada linha nova nasce com seu diretório e seu `ADR.md`.
>
> **Slot único de `in-progress` — resolvido.** `checks.mjs:378-379` permite no máximo 1 linha
> `in-progress`, e `checks.mjs:387-399` proíbe `in-progress` com `order` 2 enquanto existir linha de
> `order` menor não-`merged`. Portanto ADR-001 e ADR-002 **não** podem ser ambos `in-progress`.
> ADR-001 foi promovido a `merged` com **`e3d86de` como SHA de landing**: é o commit que materializou
> a decisão, é o tip da branch `adr/prd-installer-rust/01-fronteira-subprocesso` (publicado como
> `origin/adr/prd-installer-rust/01-fronteira-subprocesso`) e é ancestral direto da branch 02 — foi
> dele que esta branch foi aberta. **Não houve merge commit em `main`/`origin/main`** e nenhum
> push/PR foi feito por este batch; a célula registra o landing linear, não um merge do GitHub.
> Se o merge humano do PR de ADR-001 gerar SHA diverso, o orquestrador substitui esta célula no mesmo
> ato do merge; até lá, `merged` aqui significa "decisão ratificada e incorporada à linhagem", não
> "PR mesclado". Aplicou-se o mesmo critério a ADR-002 ao abrir a branch 03: `6a3b4ed` é o commit que
> materializou a decisão do oráculo e o tip da branch `adr/prd-installer-rust/02-oraculo-paridade`,
> ancestral direto da branch 03. Ao abrir a branch 04, o mesmo critério promoveu ADR-003 a `merged`
> com **`4d5b70e` como SHA de landing**: é o commit `docs(adr): ADR-003 do PRD-3` (tip da branch
> `adr/prd-installer-rust/03-motor-init-doctor-upgrade`) e ancestral direto da branch 04. Ao abrir
> a branch 05, o mesmo critério promoveu ADR-004 a `merged` com **`a0508a3` como SHA de landing**:
> é o commit `docs(adr): ADR-004 do PRD-3 — TUI 10 telas com contrato de tela verificavel` (tip da
> branch `adr/prd-installer-rust/04-tui-dez-telas`, publicado como
> `origin/adr/prd-installer-rust/04-tui-dez-telas`) e ancestral direto da branch 05 — foi dele que
> esta branch foi aberta. Com isso ADR-005 é a única linha `in-progress` e não há pulo de sequência
> (`ADR-02` reprova 2 linhas `in-progress` e `in-progress` com order menor não-`merged`). Nenhum
> push/PR foi feito por estes batches; `merged` registra o landing linear na linhagem, não um merge
> do GitHub.
>
> **Estado:** 5 linhas, `ADR-001` `merged` (landing `e3d86de`), `ADR-002` `merged` (landing
> `6a3b4ed`), `ADR-003` `merged` (landing `4d5b70e`), `ADR-004` `merged` (landing `a0508a3`),
> `ADR-005` `in-progress`, branch `adr/prd-installer-rust/05-publicacao-runtime-selo`. Fatiamento
> D8 completo: 5 ADRs, ordem de merge 1 a 5, sem pulo. ADR-005 é o último — não há branch 06 a
> promovê-lo; a promoção a `merged` depende do merge humano do PR, feito pelo orquestrador na mesma
> célula.
>
> *Nota de forma: não há segunda tabela. `parseIndex` (`checks.mjs:149-163`) lê toda linha que começa
> com `|` como linha do ledger; uma tabela adicional seria interpretada como ADR extra e reprovaria
> `ADR-01`.*

| order | id | title | status | depends_on | dir | branch | merge |
|---|---|---|---|---|---|---|---|
| 1 | ADR-001 | Fronteira de subprocesso e contrato: CLI Rust como binário invocado por 22 consumidores Node, com stdin/stdout/stderr, códigos de saída e segredo sem eco, sem FFI e sem dois motores | merged | — | ADRs/ADR-001-fronteira-subprocesso/ | adr/prd-installer-rust/01-fronteira-subprocesso | feat(#17) `331e44f` — merge humano 2026-11-16 |
| 2 | ADR-002 | Oráculo de paridade com anti-tautologia: literais congelados mais differential contra o Node c63e333, insta só como revisor de diff e literal válido após validação humana | merged | ADR-001 | ADRs/ADR-002-oraculo-paridade/ | adr/prd-installer-rust/02-oraculo-paridade | feat(#18) `fbdca4c` — merge humano 2026-11-16 |
| 3 | ADR-003 | Motor init/doctor/upgrade: 23 ops de engine mapeadas 1:1, ordem de upgrade congelada e vereditos lidos como literais externos; critério de CLI contra o oráculo, crate/versão fora da decisão | merged | ADR-001, ADR-002 | ADRs/ADR-003-motor-init-doctor-upgrade/ | adr/prd-installer-rust/03-motor-init-doctor-upgrade | feat(#19) `98f5900` — merge humano 2026-11-16 |
| 4 | ADR-004 | TUI de 10 telas: modelo declarativo de 5 campos por tela, navegação igual à ordem do oráculo (0 transição nova), tela não grava (apply no motor), segredo sem eco com cleanup após SIGTERM, stdout envelope / stderr progresso; transcript como autoridade, crate/framework fora da decisão | merged | ADR-001, ADR-002, ADR-003 | ADRs/ADR-004-tui-dez-telas/ | adr/prd-installer-rust/04-tui-dez-telas | feat(#20) `d4e9924` — merge humano 2026-11-16 |
| 5 | ADR-005 | Publicação do binário e runtime do adotante: wrapper npm com optionalDependencies por os/cpu/libc e bin, fallback claro se a tripla não casa, install.mjs legado só como oráculo fora do caminho de instalação (um motor), Node≥20 sem toolchain Rust (D7), commands.suiteFull e selo c904f1c5 byte-idênticos com cobertura Rust em comandos paralelos fora da contraprova (D6, custo aceito) | in-progress | ADR-001, ADR-003, ADR-004 | ADRs/ADR-005-publicacao-runtime-selo/ | adr/prd-installer-rust/05-publicacao-runtime-selo | — |

## Insumo das linhas existentes

- **ADR-001** — decisão G1 **D1** (subprocesso/CLI; 22 consumidores adaptados; sem FFI, sem dois
  motores) e **D4** (Node `c63e333` como oráculo de comportamento). Requisitos: RF-05, RF-07,
  M-6. Evidência: 22 consumidores importam 75 dos 95 exports; `gate.js` tem 0 referência ao
  instalador; 3 módulos `lib/**/checks.mjs` recebem os 6 mapas por injeção em
  `scripts/static-checks.mjs:81`. Pesquisa: `RESEARCH.md` §5 (tema D, fontes S9/S10/S11) e §7
  (recomendação com critério). Oráculo de paridade (linha 2) e motor (linha 3) herdam desta a
  fronteira de contrato; a TUI (linha 4) herda a separação CLI/TUI (P-3).
- **ADR-002** — decisões G1 **D2** (paridade total antes de trocar o especificador), **D4**
  (oráculo `c63e333` + baselines literais como contraprova), **D5** (12 presets congelados), **D6**
  (selo `c904f1c5…` invariante, suíte Rust em paralelo). Requisitos: RF-01, RF-09, M-1/M-2/M-3/M-10.
  Evidência: `golden.spec.mjs:48-60` mede 9 byte-equal + 2 parciais (`flutter`, `dart`); dry-run
  medido em 2 presets (`harness/harness-eixos-stack.json:70-71`); `EXPECTED_STACKS` é literal em
  `eixos-stack.spec.mjs:39-52`; `RESEARCH.md` §8-4/`§8-6` registram `9+2≠12` e o risco de snapshot
  aceito virar bug validado. Pesquisa: `RESEARCH.md` §4 (C1/C2/C3), §7 e fontes S7/S8. Herda de
  ADR-001 o contrato `contract-v1` e a materialização do oráculo; o motor (linha 3) consome SI-1..SI-6.
- **ADR-003** — decisão G1 **D8** (fatia 3 = motor), herda D1/D2/D4/D5/D6/D7 de ADR-001/002. Requisitos:
  RF-02/RF-05/RF-07. Evidência: 23 `op`s de engine em ADR-001 §5; ordem medida de `runUpgrade`
  (`install.mjs:2933-3008`) e de `main` (`:1606-1655`); vereditos congelados de
  `installer-upgrade-regression`, `merge-v2-only`, `doctor`, `preflight`, `checks` e `suite`.
  Pesquisa: `RESEARCH.md` §2 (A1/A2, fontes S1/S2/S3) e §7 — crate/versão ficam como recomendação
  com fonte; este ADR decide só o critério de paridade observável. `depende-de: ADR-001, ADR-002`.
- **ADR-004** — decisão G1 **D3** (fatia 4 = TUI, item 1 da demanda), herda D1/D4/D6/D7 de
  ADR-001/002/003. Requisitos: RF-03/RF-10, M-4/M-5, SI-4. Evidência: 10 telas `W0..W7` com
  `W2m-1/-2` em `runWizard:2264-2436` × 5 campos de `PRD.md` §3.7 (50 campos); 8 `op`s de TUI sem
  escrita em ADR-001 §5; transcript arquivado de 16.336 bytes com `[1/2]`/`[2/2]`/`[1-5]`/
  `(default: 1)`/`(q cancela)`; segredo `serializeSkips=true`, `sanitizeLog=token=[REDACTED]`,
  `canNoEchoTTY=true`/`canNoEchoPipe=false`; risco de `SIGTERM` sem eco em `RESEARCH.md` S5.
  Pesquisa: `RESEARCH.md` §3 (B1/B2/B3, fontes S4/S5/S6/S10/S11) e §7 — recomendação B3 com fonte;
  este ADR decide só o critério de apresentação (0 transição nova, transcript como autoridade,
  cleanup obrigatório). `depende-de: ADR-001, ADR-002, ADR-003`.
- **ADR-005** — decisão G1 **D5** (12 presets congelados), **D6** (`commands.suiteFull` 4 etapas e
  selo `c904f1c5…` invariantes; suíte Rust em comandos paralelos) e **D7** (binário autocontido +
  Node ≥ 20 no destino, sem toolchain Rust), herdada de ADR-001/003/004. Requisitos: RF-08,
  M-7/M-8. Evidência: selo re-derivado
  `suiteFull=c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2` e `unit=daba8c5…`;
  `harness.config.json:14` com 4 etapas e nenhuma Rust; `docs/INSTALACAO.md:17` (Node ≥ 20,
  `NODE_MIN`); `Cargo.toml` ausente (M7); `install.mjs` 3.010 linhas/95 exports com oráculo em
  worktree `detach` (`c63e333`, ADR-001 §2.6). Pesquisa: `RESEARCH.md` §6 (E1/E2, fonte S12 —
  `optionalDependencies`, `os`/`cpu`/`libc`, `bin`, `engines`), §7 e §8-2 (cobertura Rust fora do
  selo = custo aceito); este ADR decide só o critério de distribuição — wrapper + fallback + um
  motor + selo intacto, sem pinar crate/versão. `depende-de: ADR-001, ADR-003, ADR-004`.
