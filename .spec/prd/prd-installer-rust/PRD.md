# PRD — CLI Rust de instalação com UI de terminal

> **prd-id**: `prd-installer-rust` (casa com `.spec/prd/prd-installer-rust/`)
> **Dono da aprovação**: owner do harness
> **Status**: **rascunho** — aguarda o portão G1 (§16). Nenhum `ADRs/**`, `RESEARCH.md` ou `ADR-INDEX.md` nasce antes do veredito (INV-3 de `.agents/rules/prd-adr-pipeline.md` §1).
> **Tipo de rota**: Refactor (programa multi-PRD `harness-refactor-2026-11`, ordem 3 — `workflow-state.json.program.prds[2]`)
> **Itens do owner neste PRD**: **1** — *"Refatorar a parte de instalação, utilizar o rust como cli de instalação, ver UI para tela de CLI"*; **6** — *"Na parte de instalação, tem que fazer da maneira correta sem invenção"*.
> **Herda**: PRD-1 `prd-harness-inventory` (fechado/arquivado `.spec/archive/20261111-prd-prd-harness-inventory/`) e PRD-2 `prd-agnostic-artifacts` (arquivado `.spec/archive/20261116-prd-prd-agnostic-artifacts/`) — o payload correto e o inventário são entrada da paridade.
> **Teto**: 5 ADRs neste PRD. **Nenhuma decisão de arquitetura Rust é tomada aqui** — crate, framework de CLI/TUI, estratégia de FFI e rewrite total vs incremental pertencem ao ADR (§7).
> **Vocabulário**: **CLI** = motor de instalação/upgrade/doctor, merge, backup, checks, manifesto, presets e gating. **TUI** = o que a tela mostra: telas, navegação, prompts, defaults, máscara de segredo, confirmação e estados. São fronteiras distintas (§3.7); misturá-las é o defeito que este PRD evita.
> **Mapa das 16 seções**: §1, §2, §5, §6, §7, §9 e §16 são obrigatórias; §3, §4, §8, §10–§15 são recomendadas.

## 1. Problema [obrigatória]

A instalação do harness é um programa de **4.229 linhas em 5 arquivos** medidos em 2026-11-16 (M1 em §3.6): `install.mjs` 3.010 · `dogfood-common.mjs` 397 · `dogfood.mjs` 289 · `dogfood-mobile.mjs` 439 · `zone.mjs` 94. `install.mjs` não é só CLI: é **biblioteca e CLI no mesmo arquivo**, com **95 exports** (M2) e um entrypoint guardado por `import.meta.url === file://argv[1]` (`install.mjs:2745`). Como efeito medido, **22 arquivos consumidores importam 75 dos 95 exports** (M3) — a fronteira do rewrite está no disco, não na intenção.

O owner pediu duas coisas na mesma demanda (itens 1 e 6, `workflow-state.json.program.origem`): **Rust como CLI de instalação com UI para tela de CLI**, e **instalação feita da maneira correta, sem invenção**. Hoje o instalador roda sobre Node ≥ 20 no destino (`docs/INSTALACAO.md:17`, P1) e sua "tela" é uma sequência de linhas W0..W7 lidas por `createLineReader` (`install.mjs:1893`) — não um modelo de tela com navegação, estados e prompts declarados. Não existe `Cargo.toml` no repo (M7): Rust é greenfield aqui.

O defeito não é "Node ser lento" nem gosto de stack. É que **um rewrite sem oráculo vira reinterpretação**. O instalador transporta **12 presets** (M4), wizard W0..W7 com menu W2m em **2 passos** (M5), gating de artefato por eixo com validação na carga, `.vendor-lock.json`, backup com verificação, merge de `opencode.json` com detecção de conflito e canários V3/V7/V15 no `static-checks.mjs` (M6). Qualquer reescrita que "aproxime" um desses comportamentos está inventando — e o item 6 do owner proíbe explicitamente. A lição está escrita no próprio `harness.config.json:13`: copiar comando/stack de outro projeto foi "the original sin this config fixes".

A consequência prática é dupla: (a) o adotante não tem escolha de runtime para instalar o harness; (b) não existe hoje um critério único que diga se uma versão Rust é **equivalente** à atual — e, sem ele, "está pronto" vira autoafirmação. PRDs 1 e 2 entregaram o inventário e o payload agnóstico que precisam ser preservados; nenhum dos dois decide a migração.

> ❓ Validação: a dor existe hoje, é observável e não é preferência do agente? **Sim** — 4.229 linhas, 95 exports, 22 consumidores, 12 presets e `Cargo.toml` ausente medidos em 2026-11-16 (M1–M7 em §3.6); os itens 1 e 6 estão registrados em `workflow-state.json.program.origem`.

## 2. Objetivo [obrigatória]

Entregar uma **CLI de instalação em Rust** cujas saídas observáveis sejam **par** ao instalador atual por oráculo declarado (§3.5), e uma **TUI** cuja tela, navegação e prompts sejam descritos como contrato verificável (§3.7) — sem decidir como isso será implementado.

Estado observável esperado, expresso em três predicados:

- **P-1 — paridade**: para cada um dos **12 presets**, config gerada, lista de arquivos propagados (caminhos + bodies), manifesto e vereditos de checks são **iguais byte-a-byte** aos do instalador Node congelado; dry-run produz **0 writes** (hash do diretório destino idêntico antes/depois).
- **P-2 — tela**: a interação W0..W7 e W2m em 2 passos tem descrição de tela (cabeçalho, conteúdo, prompt, ações válidas, estado) e transcript comparável ao existente (`.spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt`); nenhum prompt, default ou transição é introduzido sem decisão registrada.
- **P-3 — fronteira**: a camada de tela **não escreve** e o motor **não formata tela**; o que hoje é API pública (75 exports importados por 22 consumidores) tem destino declarado — contrato equivalente, substituição ou convivência — nunca órfão silencioso.

"Maneira correta sem invenção" é definida em §3.5 com fontes fechadas, proibições e oráculo; "TUI" é definida em §3.7 com unidade, navegação, prompts e acessibilidade. O objetivo **não** é "usar Rust": é substituir um instalador de 4.229 linhas por outro verificável, com tela, sem perder o que já funciona.

> ❓ Validação: o objetivo é mensurável e não é uma solução? **Sim** — P-1/P-2/P-3 são predicados medidos por comando/transcript (§5); nenhum deles nomeia crate, framework, FFI ou estratégia de rewrite (§7).

## 3. Contexto e evidências

Todas as medições são de **2026-11-16**, repo `/home/joao/fusionlf/wsProjeto/harness`, HEAD `c63e333`, `git status --short` vazio. Onde um número não pôde ser medido, ele está declarado como **meta**, nunca como fato.

### 3.1 População: os 5 arquivos do instalador (M1)

| Arquivo | Linhas | Papel observado |
|---|---|---|
| `installer/install.mjs` | **3.010** | biblioteca (95 exports) + CLI guardada em `:2745`; contém presets, wizard, merge, checks, backup e manifesto |
| `installer/dogfood-common.mjs` | **397** | utilitários de dogfood; cita `assertDogfoodTarget` como trava de escrita (`:44`) |
| `installer/dogfood.mjs` | **289** | importa `main`, `runChecks`, `scanLiterals`, `DENYLIST`, `assertDogfoodTarget`, `VERSION` (`:21`) |
| `installer/dogfood-mobile.mjs` | **439** | importa `runCli`, `assertDogfoodTarget`, `MANIFEST_NAME` (`:36`) |
| `installer/zone.mjs` | **94** | descreve a trava de escrita do dogfood (`:4`) |
| **Total** | **4.229** | — |

### 3.2 95 exports: biblioteca + CLI no mesmo arquivo (M2/M3)

`grep -c '^export ' installer/install.mjs` → **95**. Destes, **75 são importados** por algum consumidor e **20 não têm consumidor externo** (são usados internamente pelo motor/CLI ou apenas por leitura de texto nos testes). A separação em famílias é descritiva — não é decisão de módulo/crate:

| Família (comportamento observado) | Exemplos medidos (exports) | natureza |
|---|---|---|
| Dados/registro | `STACK_VALUES`, `STACK_PROFILES`, `AXIS_IDS`, `RULES_COMMON`, `RULES_BY_AXIS`, `SKILLS_COMMON`, `SKILLS_BY_AXIS`, `STACKS_FOR_EXCEPTIONS`, `DENYLIST`, `WIZARD_MENU`, `W2M_MARKER`, `QUESTIONS` | fonte de verdade do instalador |
| Motor de instalação | `preflight`, `backup`, `collectIncoming`, `planMerge`, `applyMerge`, `generateConfig`, `runChecks`, `main`, `buildManifest`, `writeManifest`, `mergeOpencodeJson`, `mergeAgentFile`, `inventory`, `inventory*`, `scanLiterals` | grava/verifica — **não é tela** |
| Entrypoints CLI | `parseArgs`, `runCli`, `runInit`, `runDoctor`, `runUpgrade`, `printUsage`, `applyUpgrade`, `runUpgrade` | `init`/`doctor`/`upgrade`/legado (`install.mjs:2463-2471`) |
| Apresentação / TUI | `runWizard`, `askMenuStep`, `menuChoices`, `menuItemLine`, `sourceLineOf`, `promptAnswers`, `readSecretRaw`, `readSecretPrompt`, `canNoEcho`, `confirmByLayer`, `printPlan`, `formatError`, `detect`, `dryRunNotice` | input/output — **não grava** (`install.mjs:2015-2017`, `:2419-2432`) |
| Segurança/erro | `assertDogfoodTarget`, `assertInside`, `requireVerifiedBackup`, `InstallError`, `sanitizeLog`, `stripAnsiControls`, `validateAnswer` | guardas e formatação |

Os 20 sem import externo: `CONSUMER_EXCLUDED_PREFIXES`, `DEFAULT_EVIDENCE_SCHEMA`, `INCOMING_EXCLUDE`, `INCOMING_ROOTS`, `VENDOR_LOCK_NAME`, `WIZARD_MENU_FRONTEND`, `WIZARD_MENU_FRONTEND_DEFAULT`, `WIZARD_MENU_FRONTEND_WIDTH`, `WIZARD_MENU_WIDTH`, `applyUpgrade`, `confirmByLayer`, `getLastCliAnswers`, `howToFix`, `isHarnessLocalPluginEntry`, `menuChoices`, `menuItemLine`, `planUpgrade`, `pubspecDeclaresFlutter`, `sha256`, `validateAxesCombination` (M3). Alguns são lidos por testes via `readFileSync` do próprio `install.mjs` (ex.: `golden.spec.mjs:37`), o que reforça: **a fronteira é de comportamento, não de contagem de import**.

### 3.3 Acoplamento: consumidor → funções importadas → impacto (M3)

Tabela completa, derivada por varredura de `import … from '…install.mjs'` (M3). `gate.js` **não referencia** `install.mjs` (verificado por grep: 0 ocorrências). Os módulos `.opencode/plugins/lib/{cdl,inventory,refs}/checks.mjs` **não importam** o instalador: recebem os mapas por injeção via `scripts/static-checks.mjs:81` (`cdl/checks.mjs:96-100`, `inventory/checks.mjs:318-321`) — é esse o contrato a preservar.

| Consumidor | Funções/consts importadas | O que muda se virar Rust |
|---|---|---|
| `scripts/static-checks.mjs:81` | `AXIS_IDS`, `SKILLS_BY_AXIS`, `SKILLS_COMMON`, `RULES_BY_AXIS`, `RULES_COMMON`, `STACKS_FOR_EXCEPTIONS` | adapter precisa continuar injetando os 6 mapas; se o registro sair do JS, `V19`/`V20` mudam de fonte — oráculo de paridade obrigatório |
| `.opencode/plugins/__tests__/cdl.spec.mjs:52` | `AXIS_IDS`, `RULES_BY_AXIS`, `RULES_COMMON`, `SKILLS_BY_AXIS`, `SKILLS_COMMON`, `STACKS_FOR_EXCEPTIONS` | idem; teste do canário CDL deixa de importar JS |
| `.opencode/plugins/__tests__/inventory.spec.mjs:49` | `RULES_BY_AXIS`, `RULES_COMMON`, `SKILLS_BY_AXIS`, `SKILLS_COMMON` | idem; inventário derivado do dono muda de adapter |
| `installer/dogfood.mjs:21` | `main`, `runChecks`, `scanLiterals`, `DENYLIST`, `assertDogfoodTarget`, `VERSION` | dogfood hoje é JS que chama o motor em-processo; precisa de contrato de subprocesso/biblioteca |
| `installer/dogfood-mobile.mjs:36` | `runCli`, `assertDogfoodTarget`, `MANIFEST_NAME` | idem, com assert de zona de escrita |
| `installer/__tests__/golden.spec.mjs:8` | `generateConfig`, `STACK_PROFILES`, `profileOf`, `AXIS_IDS` | baselines byte-congelados são o oráculo: Rust precisa reproduzi-los, não reescrevê-los |
| `installer/__tests__/eixos-stack.spec.mjs:33` | `STACK_PROFILES`, `STACKS_FOR_EXCEPTIONS`, `STACK_VALUES`, `AXIS_IDS`, `stacksFor`, `profileOf`, `collectIncoming`, `axisIdsFromAxes`, `ruleAllowedForAxes`, `validateRulesByAxis`, `RULES_BY_AXIS`, `RULES_COMMON`, `skillAllowedForLocalAxes`, `validateSkillsByAxis`, `SKILLS_BY_AXIS`, `SKILLS_COMMON`, `InstallError` | oráculo literal `EXPECTED_STACKS` (`:40`) não deriva de `stacksFor`; comparar Rust contra ele é a prova anti-tautologia |
| `installer/__tests__/cli.spec.mjs:24` | `main`, `runInit`, `runDoctor`, `runCli`, `parseArgs`, `printUsage`, `planMerge`, `printPlan`, `collectIncoming`, `promptAnswers`, `resolveAnswerSource`, `canNoEcho`, `readSecretRaw`, `readSecretPrompt`, `InstallError` | cobre CLI **e** TUI; precisa de paridade de stdout/stderr e de comportamento de segredo sem eco |
| `installer/__tests__/wizard.spec.mjs:11` | `runWizard`, `runInit`, `assertCreateOnly`, `isAbortToken`, `detect`, `promptAnswers`, `runCli`, `InstallError`, `WIZARD_MENU`, `askMenuStep`, `sourceLineOf`, `W2M_MARKER`, `validateAnswer`, `QUESTIONS` | transcript W0..W7 vira oráculo de tela |
| `installer/__tests__/suite.spec.mjs:26` | `preflight`, `backup`, `collectAnswers`, `generateConfig`, `planMerge`, `applyMerge`, `writeManifest`, `buildManifest`, `serializeAnswers`, `sanitizeLog`, `assertDogfoodTarget`, `QUESTIONS`, `InstallError`, `formatError`, `dryRunNotice`, `runCli`, `runWizard`, `runInit` | ponto de virada: 0 writes no abort/dry-run precisa ser re-provado |
| `installer/__tests__/checks.spec.mjs:17` | `DENYLIST`, `scanLiterals`, `isScannablePath`, `runChecks`, `requireVerifiedBackup`, `main`, `buildManifest`, `serializeAnswers`, `collectIncoming`, `QUESTIONS` | vereditos de checks precisam ser idênticos |
| `installer/__tests__/merge-manifest.spec.mjs:16` e `merge-v2-only.spec.mjs:33` | `normalizeSection`, `hasHarnessSection`, `mergeOpencodeJson`, `mergeAgentFile`, `planMerge`, `applyMerge`, `assertCreateOnly`, `InstallError`, `buildManifest` | merge não destrutivo de `opencode.json` é comportamento observável; paridade por conteúdo |
| `installer/__tests__/installer-upgrade-regression.spec.mjs:32` | `main`, `runInit`, `runUpgrade`, `runCli`, `runChecks`, `generateConfig`, `configReferenceTargets`, `writtenPathsOf` | regressão histórica de `upgrade`: ordem backup→apply e `writtenPaths` em cada call-site (`:367`) |
| `installer/__tests__/doctor.spec.mjs:13` | `runDoctor`, `runUpgrade`, `resolveBackupDir`, `formatError`, `InstallError` | `doctor` é caminho brownfield; mensagens 4-linhas precisam de paridade |
| `installer/__tests__/preflight.spec.mjs:13` | `preflight`, `inventory`, `backup`, `InstallError`, `MIN_NODE_VERSION`, `assertInside` | pré-vôo (root, Node mínimo, target) muda de dono |
| `installer/__tests__/qa.spec.mjs:18` (+ imports dinâmicos `:229`, `:243`) | `QUESTIONS`, `validateAnswer`, `collectAnswers`, `serializeAnswers`, `sanitizeLog`, `stripAnsiControls`, `buildManifest`, `runCli`, `loadAnswersFile`, `formatError`, `promptAnswers`, `runWizard` | `promptAnswers`/`runWizard` por `await import` — fronteira dinâmica |
| `installer/__tests__/generate.spec.mjs:6` | `generateConfig`, `STACK_PROFILES`, `profileOf`, `defaultSuiteFor` | geração de config é o oráculo byte-a-byte |
| `installer/__tests__/mobile.spec.mjs:7` | `validateAnswer`, `collectIncoming`, `InstallError` | mobile/detecção `pubspec.yaml` |
| `installer/__tests__/mustfix-f1.spec.mjs:17` | `printPlan`, `runWizard`, `runCli`, `InstallError` | saída de prévia do plano |
| `installer/__tests__/dogfood-write-zone.spec.mjs:25` | `assertDogfoodTarget` | trava lexical de escrita (`.spec/tech-debts/dogfood-write-zone-symlink/TASKS.md:7`) |
| `installer/__tests__/adr-005.spec.mjs:13` | `presetOfAxes`, `presetsOfAxes`, `collectAnswers`, `generateConfig`, `defaultSuiteFor`, `InstallError` | resolução de preset por eixos |
| `installer/__tests__/merge-v2-only.spec.mjs`, `dogfood-write-zone`, `checks` (leitura de fonte) | leem `install.mjs` como texto (`cli.spec.mjs:307`, `generate.spec.mjs:37`, `qa.spec.mjs:110`, `wizard.spec.mjs:1007`, `suite.spec.mjs:65`) | canários de synthesize/source não podem depender de arquivo que deixou de existir |

**Síntese da fronteira**: 22 consumidores, 75 exports importados, 0 referência em `gate.js`, 3 módulos de checks por injeção. O rewrite que ignorar esta tabela quebra a suíte **mesmo que a CLI funcione**.

### 3.4 Presets, wizard e gating (M4/M5/M6)

- **12 presets** (`install.mjs:196`): `node`, `java+vue`, `java+react`, `outra`, `node-esm`, `flutter`, `dart`, `rust`, `nestjs`, `node+react`, `nestjs+react`, `rust+react`. `STACK_PROFILES` tem as mesmas **12 chaves** (`:252`); `AXIS_IDS` declara backend `[java,node,rust,nestjs,dart,flutter,other,none]` e frontend `[vue,react,dart,flutter,other,none]` (`:210`).
- **W0..W7 + W2m em 2 passos**: `runWizard` (`:2234`), `runInit` (`:2481`), `askMenuStep` (`:2105`), `WIZARD_MENU` (`:2026`), `WIZARD_MENU_FRONTEND` (`:2039`, default `'1'` em `:2043`), `W2M_MARKER` (`:2080`). `printUsage` (`:2462`) declara `init`/`doctor`/`upgrade` e o caminho legado (`:2471`).
- **Regras de negócio do instalador a preservar**: gating de skills/rules por eixo declarado (nunca por nome de arquivo), validação dos mapas na carga (declaração inválida = falha, não no-op), `.vendor-lock.json` + `vendor-skills.mjs --check`, backup verificado antes de qualquer escrita, merge com detecção de conflito, `DENYLIST`/`scanLiterals`, canários V3/V7/V15. Fonte: `.agents/rules/harness-config.md:71-95` e `harness.config.json`.
- Oráculo histórico de dry-run: `harness/harness-eixos-stack.json:63-99` registra 2 presets (`java+vue`, `java+react`), **0 writes**, prova por `sha256` de `find . | sort` idêntico antes/depois (`063c1ddc5e92cf28`), e gating observado 0/1 e 1/0. Método de comparação por preset entre dois instaladores está em `harness/harness-eixos-stack-p2.json:159` (`collectIncoming` importado dos dois, listas `.agents/skills/**` ordenadas, comparadas por preset).

### 3.5 Definição observável de "sem invenção" (Critério SI)

"Maneira correta sem invenção" é um predicado composto, avaliado sobre saídas — não sobre intenção do implementador:

| # | Predicado verificável | Oráculo / comando | Estado hoje |
|---|---|---|---|
| **SI-1** | Config gerada por preset: **chaves e valores byte-a-byte** iguais ao baseline congelado | `installer/__tests__/golden.spec.mjs:48` cobre **9 presets não-mobile** byte-equal; `:118-165` cobre `java+react` e os 5 novos; `flutter`/`dart` têm asserts dedicados de `mcp`/`commands`/`moduleMap` (`:88-109`). **Meta deste PRD: 12/12 byte-equal** | **9 byte-equal + 2 com asserts parciais** — 12/12 é meta, não fato medido |
| **SI-2** | Lista de arquivos propagados por preset: caminhos **e bodies** byte-a-byte iguais entre instalador Node e Rust, para os 12 presets | `collectIncoming` de ambos em árvores descartáveis; método histórico em `harness/harness-eixos-stack-p2.json:159` | método existe; comparação Rust↔Node é **meta** |
| **SI-3** | Dry-run: **0 writes**, provado por hash do destino idêntico antes/depois | `harness/harness-eixos-stack.json:70-71` (2 presets, hash `063c1ddc…`) | **2 presets medidos**; 12 é meta |
| **SI-4** | Transcript de TUI cobre W0..W7 e W2m em 2 passos com os mesmos prompts/defaults/ranges | `.spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt` ([1/2] `[1-5] (q cancela)`, [2/2] `(default: 1) (q cancela)`) | 1 transcript arquivado; comparação com Rust é meta |
| **SI-5** | Vereditos de checks e manifesto: mesmos campos, mesmos valores | `installer/__tests__/checks.spec.mjs`, `merge-manifest.spec.mjs`, `suite.spec.mjs` | suíte Node verde; paridade Rust é meta |
| **SI-6** | Nenhum artefato/preset/comando/chave/default/arquivo **novo** sem decisão do owner (§16) e diff declarado | `git diff` + §16 + ADR; lista proibida em §3.5 abaixo | 0 divergência hoje (instalador é o próprio oráculo) |

**Fontes fechadas consultadas (não se inventa fora delas)**: `installer/install.mjs` (oráculo), `installer/__tests__/golden.spec.mjs` e `eixos-stack.spec.mjs` (baseline e oráculo literal independente), `harness/harness-eixos-stack.json` e `harness/harness-eixos-stack-p2.json` (dry-run e método), transcript arquivado acima, `harness.config.json`, `docs/INSTALACAO.md` (P1–P5), `.agents/skills/.vendor-lock.json`, PRDs 1–2 arquivados e notas do Brain (`regras/global/.../installer-valida-operabilidade`, `sessoes/.../2026-10-18-harness-eixos-stack-batch1`, `sessoes/harness/2026-10-07-batch3-wizard`).

**Proibido inventar**: novo preset ou eixo; novo item/default/range de menu W2m; nova pergunta W3; nova chave em `harness.config.json`; novo comando canônico; novo arquivo propagado; nova regra de gating; novo formato de manifesto; novo nome de agente/skill/rule; novo número publicado sem comando declarado em §3.6; trazer stack ou comando de projeto de terceiro (`harness.config.json:13`). **Exceção controlada**: se o ADR escolher convivência Node↔Rust, isso não é invenção **desde que** a fronteira seja a tabela §3.3, o contrato seja escrito e a paridade SI-1..SI-6 seja medida sobre a composição dos dois — nunca presumida.

> Armadilha conhecida: o brain registra o caso do "guarda tautológica" (`sessoes/projetos/harness/2026-10-18-harness-eixos-stack-batch1`) — comparar `profile.stacks` com `stacksFor(profile.axes)` aprovava registry incoerente porque ambos vinham da mesma função. Por isso SI-1/SI-2 exigem oráculo **independente** (`EXPECTED_STACKS` literal, baseline congelado, instalador Node congelado), nunca auto-comparação do código Rust.

### 3.6 Comandos e leituras que produziram os números (2026-11-16)

- **M1** — `wc -l installer/{install,dogfood-common,dogfood,dogfood-mobile,zone}.mjs` → `3010 / 397 / 289 / 439 / 94`, total **4.229**.
- **M2** — `grep -c '^export ' installer/install.mjs` → **95**; `node --input-type=module -e "const m=await import('./installer/install.mjs'); console.log(Object.keys(m).length)"` → **95** (confere).
- **M3** — varredura de `import … from '…install.mjs'` nos 22 arquivos (§3.3), re-derivada por parser linha-a-linha; `Object.keys(m)` cruzado com os nomes importados → **75 importados / 20 sem import externo**; `grep -n 'install.mjs' .opencode/plugins/gate.js` → **0**.
- **M4** — `grep -n 'export const STACK_VALUES' installer/install.mjs` (`:196`) → 12 valores; `Object.keys(STACK_PROFILES).length` → **12**; `AXIS_IDS` em `:210`.
- **M5** — `grep -n 'export const WIZARD_MENU\|export const W2M_MARKER\|export async function runWizard\|export async function runInit' installer/install.mjs` → `:2026`, `:2080`, `:2234`, `:2481`; `printUsage` `:2462-2471`.
- **M6** — `node scripts/static-checks.mjs` → exit **0**, `V15 rede em installer/=0`, `V18 baseline=1`, `V19 skills=47 (vendor-by-axis=25, consumer=21, axis=0, orphan=1), rules=8, agents=10/10`, `V20 baseline=0`, `PRD-01` PASS; `harness.config.json:14` → `commands.suiteFull` com 4 etapas.
- **M7** — `ls Cargo.toml` → ausente; `git rev-parse HEAD` → `c63e333`; `git status --short` → vazio.
- **M8** — `node --input-type=module -e "import {sealCommands} from './.opencode/plugins/lib/seal.mjs'; …"` → `suiteFull = c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2`.
- **M9** — `sed -n '1,60p' installer/__tests__/golden.spec.mjs` e `sed -n '116,165p'` → 9 presets não-mobile byte-equal + blocos `java+react`/novos; `sed -n '63,99p' harness/harness-eixos-stack.json` → dry-run 2 presets/0 writes.

> ❓ Validação: cada afirmação de problema tem lastro `arquivo:linha` ou comando declarado? **Sim** — §3.1–§3.5 com M1–M9 na mesma seção; o único número que não é fato (12/12 byte-equal) está explicitamente rotulado como **meta** em SI-1/SI-3.

### 3.7 Definição operacional de TUI (o que a tela mostra)

TUI é a **camada de apresentação**, separada do motor. Unidade mínima: uma **tela** = um passo do fluxo já existente. Cada tela tem cinco campos descritos — nenhum deles é escolha de biblioteca:

| Campo | Definição observável lastreada no instalador atual |
|---|---|
| **Identidade** | `W0`, `W1`, `W2`, `W2m-1`, `W2m-2`, `W3`, `W4`, `W5`, `W6`, `W7` —ordem em `runWizard:2264-2432` e `runInit:2497-2557` |
| **Conteúdo** | o que é escrito em stdout: pre-flight, inventário, detecção `pubspec`, resumo, prévia do plano, confirmação, aplicação, manifesto/checks (`[OK]`/`[INFO]`/`[AVISO]`) |
| **Prompt e ações** | prompt numerado derivado de `WIZARD_MENU`/`menuChoices`; `q cancela`; default do W2m-2 = `'1'`; range do W2m-1 derivado de `WIZARD_MENU.length`; validação por `validateAnswer` |
| **Estado** | aguardando entrada · resposta inválida (repete W3 com `formatError`) · aborto (EOF/`q`, 0 writes) · prévia · confirmado por camada · aplicado · checks PASS/FAIL |
| **Acessibilidade / meio** | TTY (`terminal:true`, `setRawMode`, máscara de segredo) vs pipe/redirect/`--answers-file` (`terminal:false`); segredos sem eco (`canNoEcho`/`readSecretRaw`); stdout e stderr distintos; legibilidade verificada por transcript, não por cor |

**Navegação = a ordem dos passos existente**. Não se inventa "voltar", "pular" ou nova transição: qualquer transição nova precisa de decisão do owner (§16-D3) e de paridade de transcript. **Invariante**: a tela não grava (`install.mjs:2015-2017` — camada de apresentação "NUNCA escreve"; `:2419-2432` — W6/W7 delegados via `apply`); aborto antes de `apply` ⇒ 0 writes por construção (nota do Brain `sessoes/harness/2026-10-07-batch3-wizard`).

> ❓ Validação: as definições de "sem invenção" e "TUI" são verificáveis? **Sim** — SI-1..SI-6 por comando/oráculo (§3.5) e os 5 campos de tela por `arquivo:linha` + transcript (§3.7); nenhuma definição nomeia crate, framework ou FFI.

> ❓ Validação (fronteira): nenhuma decisão de arquitetura Rust foi tomada nesta seção? **Sim** — os 5 campos descrevem comportamento observável; crate/framework/FFI ficam no ADR (§7).

## 4. Público e impacto

- **Owner do harness** — passa a ter um critério (SI) para aceitar ou rejeitar a migração sem reler 3.010 linhas; hoje "feito em Rust" não é verificável.
- **Projeto-destino / adotante** — ganha relatório de instalação com tela legível e, se o §16-D7 permitir, deixa de depender de Node ≥ 20 apenas para instalar (`docs/INSTALACAO.md:17`). O comportamento instalado não pode mudar: é o mesmo payload e o mesmo `harness.config.json` (P-1).
- **Operador que roda o wizard** — a tela deixa de ser implícita: prompts, defaults, cancelamento e segredo sem eco passam a ter contrato e transcript de referência.
- **QA / auditor** — troca "rodei e deu certo" por 12/12 byte-equal, 0 writes e transcript comparável.
- **PRDs 4–6** — PRD-4 (`prd-axes-split`) pode mexer em eixos/perfis; este PRD **congela** os 12 presets como oráculo e não cria perfil novo. PRD-2 já entregou o payload a ser preservado.

## 5. Métricas de sucesso [obrigatória]

| Métrica | Como medir | Meta |
|---|---|---|
| **M-1** Paridade de config por preset (SI-1) | `JSON.stringify(generateConfig(...))` do Rust vs baseline congelado, 12 presets | **12/12 byte-equal** (baseline medido: 9 byte-equal + 2 parciais) |
| **M-2** Paridade de payload por preset (SI-2) | `collectIncoming` de Node e Rust em árvores descartáveis; caminhos + bodies ordenados e comparados | **12/12 idênticos**; 0 arquivo a mais ou a menos |
| **M-3** Dry-run sem escrita (SI-3) | `find . | sort` + `sha256` do destino antes/depois, por preset | **0 writes em 12/12** (baseline: 2 presets, hash `063c1ddc…`) |
| **M-4** Transcript de TUI (SI-4) | transcript do fluxo Rust vs `.spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt`: prompts `[1/2]`/`[2/2]`, `[1-5]`, `(default: 1)`, `(q cancela)` | **mesmos prompts/defaults/ranges** em W0..W7 + W2m-1/-2; 0 transição nova |
| **M-5** Fronteira CLI/TUI (P-3) | varredura: nenhuma função de escrita (`applyMerge`, `writeManifest`, `backup`, `fs.write*`) chamada da camada de tela; aborto antes de `apply` | **0 chamada de escrita na tela**; 0 writes no aborto |
| **M-6** Contrato dos 22 consumidores (§3.3) | cada consumidor da tabela tem veredito: contrato equivalente / substituído / convive; `gate.js` segue com 0 referência | **22/22 com veredito**, 75 exports com destino, 0 consumidor órfão |
| **M-7** Presets/gating/vendor intactos | `STACK_VALUES`/`STACK_PROFILES` = 12 chaves; `AXIS_IDS`; mapas validados na carga; `node scripts/vendor-skills.mjs --check` | **12/12 presets**, 0 default de menu novo, `vendor --check` exit 0 |
| **M-8** Suíte e selo | `node scripts/static-checks.mjs` + `commands.suiteFull` (`harness.config.json:14`); selo por `sealCommands` | exit **0**; `PRD-01` PASS; `V15=0`, `V18 baseline=1`, `V19 consumer=21`, `V20 baseline=0`; selo `c904f1c5…` **inalterado salvo §16-D6** |
| **M-9** Sem invenção (SI-6) | `git diff` + §16 + ADR: toda divergência de SI-1..SI-5 tem decisão e diff declarado | **0 divergência não declarada**; 0 preset/chave/comando/default novo sem owner |
| **M-10** Números re-deriváveis | reexecutar M1–M9 de §3.6 e comparar | **9/9 reproduzem**; divergência = drift registrado, nunca escondido |

> ❓ Validação: ao menos uma métrica tem a coluna "como medir" preenchida? **Sim** — as 10 têm comando, oráculo ou transcript declarado, com baseline medido quando existe.

## 6. Escopo [obrigatória]

- **CLI — motor**: cobrir `init` (greenfield create-only), `doctor` (brownfield), `upgrade` e o caminho legado (`install.mjs:2463-2471`), com os mesmos pré-vôo, backup verificado, merge não destrutivo, plano, aplicação, manifesto e checks. *Aceite*: M-1/M-2/M-3/M-7/M-8.
- **TUI — tela**: descrever e entregar as 10 telas W0..W7 (com W2m-1/-2), os 5 campos de §3.7, os estados e a acessibilidade TTY/não-TTY. *Aceite*: M-4/M-5; 0 escrita na camada de tela.
- **Oráculo de paridade**: congelar o instalador Node atual como referência, escrever o procedimento SI-1..SI-6 e executá-lo nos 12 presets. *Aceite*: M-1/M-2/M-3/M-9; oráculo independente (nunca auto-comparação do código novo).
- **Fronteira de API**: dar destino a 22 consumidores e 75 exports importados (§3.3), preservando a injeção dos 6 mapas em `scripts/static-checks.mjs:81`. *Aceite*: M-6; `gate.js` sem referência ao instalador.
- **Regras de negócio herdadas**: 12 presets, eixos, gating por eixo declarado, validação na carga, `.vendor-lock.json`, `DENYLIST`, canários. *Aceite*: M-7; nenhuma regra nova sem §16.
- **Este PRD não altera código, config, regra, skill, agente, `opencode.json`, `workflow-state.json`, `gate.js` nem `harness.config.json`** — define problema, critério, métricas e critérios para os ADRs. *Aceite*: `git status --short` do ciclo mostra apenas `.spec/prd/prd-installer-rust/`.

> ❓ Validação: o escopo é fechado o bastante para caber em até 5 ADRs? **Sim** — 4 eixos de decisão: (i) oráculo/paridade, (ii) CLI motor + fronteira de API, (iii) TUI, (iv) adoção/runtime. Fatiamento em §16.

## 7. NÃO entra [obrigatória]

- **Arquitetura Rust — é do ADR, não do PRD**: escolha de crate, framework de CLI, framework de TUI, gerenciador de build, estratégia de FFI/vinculação, rewrite total vs incremental e formato de binário. Nenhuma dessas é decidida aqui; o PRD fixa o **critério**, o ADR escolhe o caminho (§2, §6).
- **Presets/eixos novos**: `go`/`rust` como eixos separados e split backend/frontend são do PRD-4 (`prd-axes-split`, ordem 4, `FU-46`/`FU-53`). Aqui os 12 presets são **congelados como oráculo**.
- **Agnosticização de prosa**: PRD-2 (`prd-agnostic-artifacts`, arquivado) decidiu o payload; este ciclo **reproduz** o payload, não reescreve skill/rule.
- **PRD-5** (`prd-frontend-harness-fusion`) e **PRD-6** (`prd-forge-integration`): fora, respectivamente, design system/frontend e forge/commit/PR/issues.
- **Invariantes do repo neste PRD**: `gate.js` byte-idêntico; `harness.config.json` byte-idêntico; selo `c904f1c5…` não republicado; `opencode.json` com roster inalterado. No SDD do ADR, se o oráculo exigir comando novo, o ADR **declara o custo** e o selo é republicado por `sealCommands` (`harness-config.md` §"Command seal") — nunca como efeito colateral silencioso (decisão em §16-D6).
- **Não-objetivos**: trocar mensagens de erro por "melhores"; adicionar perguntas ao W3; criar navegação "voltar"; traduzir prosa; mudar defaults de menu; alterar `docs/INSTALACAO.md` para esconder requisito de runtime sem decisão do owner; escrever fora de `.spec/prd/prd-installer-rust/`.

> ❓ Validação: o que não entra está declarado, não inferido? **Sim** — arquitetura reservada ao ADR, 4 PRDs irmãos nomeados com ordem medida em `workflow-state.json.program.prds`, 4 invariantes de "não muda" e 7 não-objetivos explícitos.

## 8. Riscos e mitigação

| # | Risco | Evidência | Mitigação |
|---|---|---|---|
| **R1** | **Paridade tautológica**: testar o Rust contra si mesmo e ficar verde | Lição registrada no Brain: guarda que comparava `stacksFor(axes)` consigo aprovava registry incoerente; `eixos-stack.spec.mjs:3-5` | SI-1/SI-2 usam baseline congelado, `EXPECTED_STACKS` literal e instalador Node congelado como oráculo externo (M-1/M-2) |
| **R2** | **TUI "bonitinha" muda comportamento**: prompt/default/range diferentes quebram o fluxo e os segredos | `WIZARD_MENU` `:2026`, default `'1'` `:2043`, `readSecretRaw` `:1843`, `terminal:true` condicional (nota do Brain Batch 3) | M-4 compara transcript; §3.7 proíbe transição nova; aborto antes de `apply` = 0 writes |
| **R3** | **Quebra dos 22 consumidores**: 75 exports desaparecem e a suíte fica vermelha mesmo com CLI correta | Tabela §3.3; `gate.js` 0 referência, mas 3 `lib/**/checks.mjs` dependem de injeção via `static-checks.mjs:81` | M-6 exige veredito por consumidor; injeção dos 6 mapas preservada; `gate.js` intacto |
| **R4** | **"Sem invenção" vira paralisia ou vira desculpa**: ou nada é entregue, ou divergência é absorvida como "detalhe" | Item 6 do owner; `harness.config.json:13` ("original sin") | SI-6 + §16: toda divergência tem decisão, diff declarado e número re-derivável (M-9/M-10) |
| **R5** | **Regressão do upgrade**: ordem backup→apply e `writtenPaths` em cada call-site | `.spec/tech-debts/installer-upgrade-regression/TASKS.md`; `installer-upgrade-regression.spec.mjs:367` | M-8 roda a suíte completa, incluindo a spec de regressão; paridade de manifesto (SI-5) |
| **R6** | **Greenfield sem baseline**: nenhum `Cargo.toml`, nenhuma toolchain/decisão de build no repo | M7 | Nenhuma decisão de build neste PRD; o custo entra no ADR e nas decisões §16-D7; M-8 é a única prova de prontidão |
| **R7** | **Colisão com PRD-4**: eixo `rust` aparece como preset hoje e como eixo separado amanhã | `STACK_VALUES` inclui `rust`; `workflow-state.json.program.prds[3]` (`go`/`rust`) | §7 congela os 12; mudança de eixo é PRD-4 e exige novo oráculo, não reinterpretação aqui |

## 9. Requisitos funcionais [obrigatória]

- **RF-01** *(origem: itens 1 e 6 do owner)* — Adotar SI-1..SI-6 (§3.5) como critério único de "sem invenção", com fontes fechadas, lista de proibidos e oráculo independente. *Verificável*: 6 predicados com oráculo; fontes fechadas nomeadas em §3.5; 0 item "a definir"; M-1/M-2/M-9.
- **RF-02** *(origem: item 1 + `install.mjs:2463-2471`)* — A CLI cobre `init`, `doctor`, `upgrade` e o caminho legado com as mesmas regras de pré-vôo, backup verificado, merge, aplicação, manifesto e checks. *Verificável*: 4 entrypoints exercitados; M-1/M-2/M-3/M-8; `doctor.spec.mjs` e `installer-upgrade-regression.spec.mjs` verdes.
- **RF-03** *(origem: item 1 — "ver UI para tela de CLI")* — A TUI implementa os 5 campos de §3.7 para W0..W7/W2m e **não grava**; aplicação delegada via `apply`. *Verificável*: 10 telas descritas; 0 chamada de escrita na camada de tela; aborto = 0 writes (M-4/M-5).
- **RF-04** *(origem: item 6 + `harness.config.json:13`)* — Nenhum preset, eixo, comando, chave de config, default de menu, pergunta, arquivo propagado, regra de gating, formato de manifesto ou número é introduzido sem decisão do owner e diff declarado. *Verificável*: M-9 = 0 divergência não declarada; `git diff` + §16 + ADR.
- **RF-05** *(origem: medição M3 — 22 consumidores / 75 exports)* — Todo consumidor da tabela §3.3 recebe destino (contrato equivalente, substituição ou convivência); os 6 mapas continuam injetados em `scripts/static-checks.mjs:81`; `gate.js` segue sem referência ao instalador. *Verificável*: 22/22 vereditos; `grep install.mjs gate.js` = 0; M-6.
- **RF-06** *(origem: M4/M5 + `.agents/rules/harness-config.md:71-95`)* — Preservar 12 presets, `AXIS_IDS`, gating por eixo declarado com validação na carga, `.vendor-lock.json`, `DENYLIST` e canários V3/V7/V15. *Verificável*: 12 chaves em `STACK_PROFILES`; `vendor-skills.mjs --check` exit 0; `V15=0`; M-7.
- **RF-07** *(origem: `install.mjs:2745` — guard de entrypoint)* — O programa não executa ações de instalação quando importado como biblioteca; o mesmo vale para o substituto Rust. *Verificável*: importar o módulo sem argv de CLI não produz write (dry-run por hash), em Node e no substituto.
- **RF-08** *(origem: harness §5 H1/H2 + M6/M8)* — A entrega não quebra a suíte nem o selo: `commands.suiteFull` verde; `PRD-01`/`V15`/`V18`/`V19`/`V20` sem regressão; selo `c904f1c5…` intacto salvo RF de decisão §16-D6. *Verificável*: exit 0; contagens e selo medidos por M6/M8.
- **RF-09** *(origem: M9 + princípio de números do programa)* — Todo número publicado neste PRD e em seus ADRs é re-derivável pelo comando da mesma seção; divergência é drift registrado. *Verificável*: M-10 = 9/9 comandos reproduzem.
- **RF-10** *(origem: item 1 + §3.7)* — A descrição da TUI inclui navegação, prompts, estados e acessibilidade TTY/não-TTY, sem escolher framework. *Verificável*: 5 campos por tela × 10 telas, 0 campo vazio; transcript de referência anexado ao ADR; nenhuma decisão de crate/framework no PRD.

> ❓ Validação: cada requisito é verificável por um teste? **Sim** — 10/10 têm comando, contagem, transcript ou checklist com item obrigatório; RF-01/RF-04 carregam baseline e lista fechada para que "sem invenção" não seja auto-declarado.

## 10. Histórias de usuário

- Dado um dos 12 presets, Quando a CLI Rust gera `harness.config.json`, Então o resultado é byte-equal ao baseline congelado e nenhuma chave nova aparece (M-1).
- Dado o instalador Node atual e o Rust em árvores descartáveis, Quando um operador compara os arquivos propagados de um preset, Então caminhos e bodies são idênticos e o diff é vazio (M-2).
- Dado um destino vazio, Quando o operador roda `init --dry-run`, Então o hash do diretório antes e depois é o mesmo e nenhum arquivo é escrito (M-3).
- Dado um TTY sem `pubspec.yaml`, Quando o wizard chega ao W2m, Então aparecem os 2 passos com `[1-5]` e `[1-2] (default: 1) (q cancela)`, idênticos ao transcript arquivado (M-4).
- Dado um segredo digitado no W3, Quando o operador digita, Então nada é ecoado e o valor não aparece no resumo do W4 (§3.7; `readSecretRaw`/`sanitizeLog`).
- Dado um aborto (`q`/EOF) no W5, Quando o fluxo termina, Então a camada de tela não chamou `apply` e o destino segue com 0 writes (M-5).
- Dado `scripts/static-checks.mjs`, Quando a suíte roda, Então os 6 mapas de eixo continuam sendo injetados e `V19`/`V20` não mudam de fonte (M-6/M-8).
- Dado o consumidor `installer/dogfood.mjs`, Quando ele usa a API do instalador, Então existe contrato declarado para `main`/`runChecks`/`scanLiterals`/`DENYLIST`/`assertDogfoodTarget`/`VERSION`, sem import órfão (M-6).
- Dado o owner revisando o ADR, Quando ele abre o relatório de paridade, Então vê 12/12 config, 12/12 payload, 0 writes e o transcript — e consegue discordar de um caso sem refazer a medição (M-9/M-10).

## 11. UX / experiência

A "tela" aqui é o terminal. O contrato de §3.7 precisa ser legível para três leitores:

1. **Operador em TTY** — vê `[OK]`, `[INFO]`, `[AVISO]` e prompts numerados; `q cancela` e o default do W2m-2 aparecem **no prompt**, não em documentação. O resumo do W4 omite segredos (`formatError`/`sanitizeLog`). Foco e contraste não dependem de cor única; `setRawMode` é condicional.
2. **Operador em pipe/redirect ou com `--answers-file`** — o caminho `terminal:false` continua funcionando: sem prompt interativo, mesmas respostas, mesmos vereditos. A TUI não pode exigir TTY para instalar (nota do Brain Batch 3: branch aditivo em `runCli`).
3. **Auditor** — lê o transcript como evidência: cada tela identificada, cada prompt comparável, cada aborto com 0 writes. Nada de "a tela ficou bonita" como aceite.

Erro clássico a evitar: **confundir TUI com framework**. "UI para tela de CLI" do owner é uma exigência de experiência observável — o que aparece, em que ordem, com quais ações e estados — não uma biblioteca de widgets. Escolher biblioteca é do ADR (§7).

## 12. Dependências e relações com os PRDs irmãos

- **Depende de**: PRD-1 `prd-harness-inventory` (fechado, arquivado) — inventário e ADRs sobre roster/autoria; PRD-2 `prd-agnostic-artifacts` (arquivado) — payload agnóstico que a paridade deve reproduzir. Depende também de `installer/install.mjs` como oráculo congelado, de `harness.config.json` (dados do projeto) e de `workflow-state.json.program` (ordem e itens do owner).
- **Bloqueia**: PRD-4 (`prd-axes-split`) — se o instalador mudar de fronteira, os perfis `go`/`rust` e o split backend/frontend precisam do oráculo desta entrega; PRD-5 e PRD-6 consomem o instalador resultante.
- **Relação com os irmãos** (ordem medida em `workflow-state.json.program.prds`): 1 `prd-harness-inventory` (archived), 2 `prd-agnostic-artifacts` (archived), 4 `prd-axes-split`, 5 `prd-frontend-harness-fusion`, 6 `prd-forge-integration`.
- **Ferramentas que este PRD usa e não altera**: `scripts/static-checks.mjs` (`PRD-01`/`V15`/`V18`/`V19`/`V20`), `installer/__tests__/golden.spec.mjs`, `eixos-stack.spec.mjs`, `node scripts/vendor-skills.mjs --check` e o módulo de selo `.opencode/plugins/lib/seal.mjs`.

## 13. Segurança

- **Superfície nova: nenhuma neste PRD.** Nenhum tool, plugin, gate, permissão ou endpoint é criado; a migração é decidida no ADR e implementada no SDD.
- **Segredos do W3**: `canNoEcho`/`readSecretRaw`/`readSecretPrompt` (`install.mjs:1839-1891`) são controlo — a TUI não pode ecoar valor nem imprimí-lo no resumo do W4 (`RF-03` + story 5).
- **Zona de escrita do dogfood**: `assertDogfoodTarget` (`install.mjs:698`, `installer/zone.mjs:4`) trava escrita fora do destino; a migração preserva a trava e o teste `dogfood-write-zone.spec.mjs:25` (R3, M-6).
- **Backup verificado antes de escrever**: `requireVerifiedBackup` e a ordem backup→apply são guardas contra perda de dados do destino; regressão histórica registrada em `.spec/tech-debts/installer-upgrade-regression/TASKS.md` (R5).
- **Merge não destrutivo**: `mergeOpencodeJson`/`mergeAgentFile`/`normalizeSection`/`hasHarnessSection` preservam conteúdo do usuário; paridade por conteúdo é SI-5.
- **Rede-zero**: `V15 rede em installer/=0` medido (M6); nenhuma etapa de instalação pode buscar conteúdo remoto. `vendor-skills.mjs --check` é o único ponto source-side e roda fora da instalação.
- **Dados**: nenhum número ou evidência deste PRD contém credencial; apenas caminhos, hashes públicos e contagens do repo.

## 14. Perguntas abertas

1. **Destino dos 75 exports / 22 consumidores (§3.3)**: contrato equivalente na CLI Rust, substituição dos consumidores ou convivência Node↔Rust? Define R3 e M-6. → §16-D1.
2. **Fronteira de compatibilidade**: o owner exige paridade total desde a primeira entrega ou admite um recorte declarado de functions/presets? → §16-D2.
3. **Alcance da TUI**: substituir os prompts W0..W7 por telas completas, ou manter prompts line-based e só formalizar a tela? Nenhuma transição nova sem decisão. → §16-D3.
4. **Oráculo autoritativo**: instalador Node congelado, `golden.spec.mjs` ou transcript — qual prevalece em divergência entre eles? → §16-D4.
5. **Presets durante a migração**: congelar os 12 até o PRD-4, ou permitir eixo `rust` novo já neste ciclo? → §16-D5.
6. **Selo e `commands.suiteFull`**: podem mudar (com republicação de `HARNESS_SEAL_JSON`) ou são invariantes? → §16-D6.
7. **Requisito de runtime no destino**: o adotante precisa de Node ≥ 20, de toolchain Rust, ou recebe algo autocontido? É decisão de adoção, não de crate. → §16-D7.
8. **Fatiamento em ≤5 ADRs e ordem**: quais eixos viram ADR primeiro e qual é a unidade de entrega verificável? → §16-D8.

## 15. PICCO (prompt da demanda)

<task>Entregar `.spec/prd/prd-installer-rust/PRD.md` (16 seções, §16 = bloco de aprovação humana) para o ciclo "CLI Rust de instalação com UI de terminal" do harness: medir o acoplamento do instalador atual, definir "sem invenção" e "TUI" em termos observáveis, listar requisitos com origem rastreada e métricas de paridade, separar CLI de TUI, deixar arquitetura Rust para o ADR, e não criar RESEARCH/ADR-INDEX/ADRs nem alterar código/config/estado.</task>

<context>Repo `/home/joao/fusionlf/wsProjeto/harness` (tooling Node ESM, plugins opencode), programa `harness-refactor-2026-11`, PRD-3 de 6 (`workflow-state.json.program.prds[2]`). Owner 2026-11-11, itens 1 ("Refatorar a parte de instalação, utilizar o rust como cli de instalação, ver UI para tela de CLI") e 6 ("Na parte de instalação, tem que fazer da maneira correta sem invenção"). PRDs 1 e 2 arquivados. Medido 2026-11-16 (HEAD c63e333): 4.229 linhas/5 arquivos; 95 exports em install.mjs; 22 consumidores/75 exports importados; 12 presets; W0..W7 + W2m em 2 passos; `Cargo.toml` ausente; selo `c904f1c5`; `node scripts/static-checks.mjs` exit 0, PRD-01 PASS, V18 baseline=1, V19 consumer=21, V20 baseline=0. Fora de escopo: arquitetura Rust (ADR), PRDs 4–6, `gate.js`, `harness.config.json`, selo (§7).</context>

## 16. Aprovação [obrigatória]

- **Veredito**: **APROVADO** — portão G1 fechado pelo owner em 2026-11-11/16; D1–D8 respondidas uma a uma e registradas abaixo
- **Data**: 2026-11-16 (redação)
- **Portão**: **G1** — aprovação deste PRD antes de qualquer ADR, RESEARCH ou ADR-INDEX
- **Aprovador**: owner do harness
- **Decisões abertas — cada uma vira insumo de ADR; nenhuma é recomendação do agente** (teto: **5 ADRs**):

  - **D1 — destino da API pública (75 exports / 22 consumidores, §3.3).** Alternativas: (a) a CLI Rust expõe contrato equivalente e os 22 consumidores seguem importando/chamando; (b) os consumidores são substituídos e o contrato é redefinido; (c) Node e Rust convivem com fronteira declarada. *Efeito*: (a) preserva a suíte, custa compatibilidade; (b) libera a API, custa reescrita de 22 arquivos; (c) mantém paridade por composição, custa dois runtimes.

  - **D2 — recorte de compatibilidade da primeira entrega.** Alternativas: (a) paridade total (12 presets + CLI + TUI + UI de terminal) antes de qualquer entrega; (b) recorte declarado por preset/entrypoint com dívida registrada; (c) entrega apenas do motor e TUI em ciclo distinto. *Efeito*: (a) M-1..M-5 em 12/12; (b) requer lista explícita do que fica de fora e oráculo para o restante; (c) separa D3 do resto e adia "ver UI para tela de CLI".

  - **D3 — alcance da TUI.** Alternativas: (a) telas completas para W0..W7/W2m com os 5 campos de §3.7; (b) manter prompts line-based e só documentar/transcrever a tela atual; (c) telas apenas no wizard, CLI/scriptado segue textual. *Efeito*: (a) exige transcript novo e paridade M-4; (b) reduz risco R2 mas pode não satisfazer "ver UI para tela de CLI"; (c) cria dois caminhos de tela a manter.

  - **D4 — oráculo autoritativo em divergência.** Alternativas: (a) instalador Node congelado no HEAD `c63e333`; (b) `golden.spec.mjs` + `EXPECTED_STACKS` literais; (c) transcript arquivado para tela e golden para config. *Efeito*: (a) fonte única, mas congela o Node; (b) oráculo independente, mas hoje cobre 9 presets byte-equal + 2 parciais (SI-1); (c) reprodutível, mas exige manter dois artefatos de referência.

  - **D5 — presets durante a migração.** Alternativas: (a) congelar os 12 até o PRD-4; (b) permitir eixo `rust` separado já aqui; (c) congelar e registrar `rust`/`go` como dívida do PRD-4. *Efeito*: (a) mantém M-7 = 12/12; (b) antecipa o PRD-4 e muda `AXIS_IDS` (proibido por RF-04 sem owner); (c) explicita a dívida sem mexer no oráculo.

  - **D6 — selo e `commands.suiteFull`.** Alternativas: (a) invariantes (`c904f1c5…`, 4 etapas em `harness.config.json:14`); (b) mudar o comando e republicar `HARNESS_SEAL_JSON` por `sealCommands` (`harness-config.md` §"Command seal"); (c) manter o selo e registrar comandos de teste Rust fora dele. *Efeito*: (a) M-8 sem custo, mas testes Rust ficam de fora da contraprova; (b) traz Rust para a suíte, exige novo selo; (c) suíte verde com cobertura paralela não selada.

  - **D7 — runtime exigido do adotante.** Alternativas: (a) Node ≥ 20 como hoje (`docs/INSTALACAO.md:17`); (b) toolchain Rust no destino; (c) artefato autocontido, sem exigência de Node/Rust. *Efeito*: (a) zero mudança de adoção; (b) troca um requisito por outro; (c) exige decisão de distribuição no ADR (não de crate, apenas de requisito para o adotante).

  - **D8 — fatiamento em ≤5 ADRs.** Sugestão de eixos para o owner ajustar (não é recomendação vinculante): **ADR-1** oráculo SI + instrumento (RF-01/RF-09, D4); **ADR-2** CLI motor + fronteira de API (RF-02/RF-05/RF-07, D1/D2); **ADR-3** TUI e telas W0..W7 (RF-03/RF-10, D3); **ADR-4** paridade de payload/presets/vendor (RF-06, D5); **ADR-5** adoção, suíte e selo (RF-08, D6/D7). *Efeito*: 5 unidades verificáveis, nenhuma acima do teto.

- **Decisões fechadas pelo owner (2026-11-16)**:
  - **D1 = subprocesso/CLI**: a Rust é binário; os 22 consumidores Node são adaptados para invocá-la. Sem FFI e sem dois motores convivendo.
  - **D2 = paridade total antes de trocar**: motor + TUI + 12 presets validados contra o oráculo antes de desligar o `.mjs` — sem entrega de meio instalador.
  - **D3 = telas completas**: as 10 telas com navegação, prompts, estados e a11y (TTY vs pipe, segredo sem eco). É o item 1 da demanda ("ver UI para tela de CLI") entregue de verdade.
  - **D4 = Node congelado como oráculo**: o `.mjs` no commit `c63e333` é a referência de comportamento e transcript; as baselines literais permanecem como contraprova de configs.
  - **D5 = congelar os 12 presets**; o eixo `rust` do destino vai para o PRD-4. "Rust como língua do CLI" e "eixo rust do destino" são coisas distintas.
  - **D6 = selo invariante**: `commands.suiteFull` e `HARNESS_SEAL_JSON` (`c904f1c5`) não mudam; a suíte Rust roda em comandos paralelos.
  - **D7 = binário autocontido + Node≥20 no destino**: quem adota não instala toolchain Rust.
  - **D8 = 5 ADRs, um por frente**: (1) fronteira subprocesso + contrato; (2) oráculo de paridade + golden; (3) motor init/doctor/upgrade; (4) TUI 10 telas; (5) publicação/runtime/selo.

- **Fatiamento alternativo**: se o owner fechar D2=(c), o ADR-3 vira o primeiro ciclo e os demais são reordenados — decisão registrada no `workflow-state.json.prd_adr` pelo orquestrador, não neste PRD.
- **Nota**: o agente redigiu; o veredito é do owner. Nenhum `ADRs/**`, `RESEARCH.md` ou `ADR-INDEX.md` foi criado; nenhum arquivo fora de `.spec/prd/prd-installer-rust/` foi alterado.
> ❓ Validação: o owner precisa aprovar (veredito + data) antes de qualquer ADR? **Sim** — §16 está com `Veredito: PENDENTE` e data de redação; as 8 decisões estão numeradas, com alternativas e efeito de cada uma, sem recomendação do agente; `ADRs/` não existe neste diretório.
