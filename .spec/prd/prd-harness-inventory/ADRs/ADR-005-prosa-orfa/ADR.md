# ADR-005 — Prosa órfã: uma *rubric* de 6 classes derivadas por comando (não uma lista de casos), com o corpus vivo derivado do grafo de carregamento e a baseline selada no runner estático

- **prd-id**: `prd-harness-inventory` — `.spec/prd/prd-harness-inventory/PRD.md`
- **order**: 5 de 5 (`.spec/prd/prd-harness-inventory/ADR-INDEX.md`)
- **status**: `in-progress`
- **branch**: `adr/prd-harness-inventory/05-prosa-orfa` (criada de `main` @ `f9c5ca2`)
- **depende-de**: `ADR-003` — este ADR **herda** os 5 itens que o `ADR-003` §10 deferiu por decisão do owner em 2026-11-11 (I2, I3, autor de `EXPLORATION.md`, protocolo de delegação, gatilho da Fase 0) e herda também o **critério de autor único por path** que o `ADR-003` fixou no item 8 ("1 autor por path"), usado aqui como régua de resolução de 3 dos 5. Nenhum outro ADR é pré-requisito: o `ADR-004` (inventário derivado) **não** é dependência — a baseline deste ADR é literal justamente para não depender dele.
- **data**: 2026-11-11
- **dono da decisão**: owner do harness — portão **G1**, decisão **D5**: *classificar a prosa órfã neste ciclo, corrigir o texto no PRD 2*. O re-escopo dos 5 itens do `ADR-003` §10 para cá é decisão do owner de 2026-11-11 e está declarado no cabeçalho, não inferido.
- **rota**: refactor de documentação normativa (sem comportamento observável de produto ⇒ não gera PRD novo; `prd-adr-pipeline.md` §3)
- **insumo de pesquisa**: `RESEARCH.md` §7 (tema E — alternativas F1–F4 e a recomendação "F2 como decisão, F4 como mecanismo") e §9 (riscos R5 e R2); `PRD.md` §3.5 e §9-RF-03
- **escopo de escrita desta entrega**: `.spec/prd/prd-harness-inventory/**` (`ADR.md` + 1 linha no `ADR-INDEX.md`). **Nenhum** arquivo de `.agents/**`, `opencode.json`, `installer/**`, `scripts/**` ou plugin foi editado — a implementação é o SDD deste ADR.

## 1. Contexto

O harness cita **20 paths distintos de `rules/*.md`**; **13 não existem no disco** e somam **52 citações**. E a correção disso, hoje, não tem régua: cada path vira um caso avulso, decidido por quem estiver escrevendo.

| Fato medido (2026-11-11, pós-merge `f9c5ca2`) | Valor | Comando / fonte |
|---|---|---|
| Paths de `rules/*.md` citados em `.agents/**` | **20** distintos | `grep -rhoE "rules/[a-z0-9-]+\.md" .agents \| sort -u \| wc -l` |
| Paths citados e ausentes no disco | **13** | mesmo `grep`, filtrado por `test -e ".agents/$p"` |
| Citações desses 13 paths | **52** | soma de `grep -roE "rules/<p>\.md" .agents \| wc -l` por path |
| Dos 8 "acionáveis" do `PRD.md` §3.5, quantos têm assunto de eixo que `stack.*` declara `N/A` | **5** | `echo "$p" \| grep -qE '^rules/(backend-\|db-migration-)'`; `node -e 'console.log(require("./harness.config.json").stack.backend)'` ⇒ `N/A …` |
| Docs `.doc/*.md` citados e ausentes | **5 paths** + **1 diretório** (`.doc/`), em **2 grafias** (`stacks.md`/`STACK.md`, `arquitetura-backend.md`/`ARCHITECTURE.md`) | `grep -rhoE "\.doc/[A-Za-z-]+\.md" .agents \| sort -u`; `test -d .doc` ⇒ falso |
| `frontend/DESIGN.md` citado em agentes vivos | **11 citações / 3 agentes** (`design-system-specialist`, `ux-designer`, `orchestrator`) | `grep -rn "DESIGN\.md" .agents/agents` |
| `AGENTS.md` na raiz | **ausente** (`test -e`), citado em **16 arquivos** (14 locais + 2 vendorizados) | `test -e AGENTS.md`; `grep -rnE "AGENTS\.md" .agents` |
| `planejador` em `.agents/**` | **0** — a dívida do `ADR-003` foi fechada em `f9c5ca2` | `grep -rn "planejador" .agents/` |
| Divergências vivas herdadas do `ADR-003` §10 | **5** (I2, I3, autor de `EXPLORATION.md`, protocolo de delegação, gatilho da Fase 0) | §3, tabela C |

**O defeito, dito sem retórica:** o problema não é a citação ausente — é que **não existe régua** que diga, por comando, em qual classe a citação cai e o que se faz com ela. Sem régua, o ADR vira sacola de 26 casos; com régua, ele vira 6 classes + 26 aplicações e a próxima citação órfã é classificada **sem** um novo ADR.

**O segundo defeito, específico dos 5 herdados:** todos são *divergência entre dois textos vivos sobre o mesmo sujeito* (quem escreve `PLAN.md`, o que é um ADR, quem escreve `EXPLORATION.md`, quem está na tabela de delegação, qual predicado abre a Fase 0). Cinco decisões "avulsas" aqui repetiriam o defeito que este ADR quer eliminar — o mesmo critério de resolução serve para os 5.

**O que este ADR não faz.** Não escreve o texto das 8 rules ausentes (PRD 2), não agnosticiza conteúdo stack-bound (PRD 2), não implementa o inventário derivado (ADR-004), não cria branch de gate nem toca `gate.js`/`FU-65`, não edita nenhum `.md` de skill/agente/rule (o SDD deste ADR é quem edita), não decide o contrato de design system do PRD 5.

## 2. Decisão

**Toda referência a artefato na prosa do harness é classificada por uma *rubric* de 6 classes, cada uma com predicado executável (um comando), uma única ação e um nível de garantia declarado; a classificação vive numa baseline literal, protegida, que falha o build quando cresce em silêncio.** A decisão é a régua. As 26 instâncias são **aplicação** dela, não decisões avulsas.

### 2.1 Corpus vivo × registro datado — a fronteira é o grafo de carregamento, não a opinião

A régua só classifica **prosa viva**. "Viva" não é juízo de valor: é **o que o runtime carrega como instrução ou o instalador propaga**.

| Corpus | Caminhos | Como se prova (comando) |
|---|---|---|
| **Vivo** | `.agents/agents/**`, `.agents/rules/**`, `.agents/skills/**`, `opencode.json` | `installer/install.mjs:103` (`.agents/agents` como camada inteira) + `:107` (`.opencode/plugins`) + `RULES_BY_AXIS`/`SKILLS_BY_AXIS`; `git ls-files .agents \| wc -l` |
| **Vivo por convenção** | `AGENTS.md` na raiz — nome carregado pelo runtime, **não** é path do repo | `test -e AGENTS.md` (falso aqui) e `test -e ~/.config/opencode/AGENTS.md` (verdadeiro no host) |
| **Registro datado** (imutável) | `.spec/**`, `docs/**`, `harness/**` | fora do grafo de carregamento: nenhum prompt aponta para lá — `node -e 'const a=require("./opencode.json").agent;console.log(Object.values(a).some(v=>/\.spec\//.test(v.prompt)))'` ⇒ `false`; e nenhum desses caminhos é origem de propagação em `installer/install.mjs` |

**A distinção é por comando, não por opinião:** o prefixo do caminho (`^(\.agents/\|opencode\.json$)` → vivo) decide; a **data declarada no próprio artefato** (`grep -qE '[0-9]{4}-[0-9]{2}-[0-9]{2}'`) apenas **corrobora** que se trata de registro. A data **nunca promove** um arquivo a vivo nem rebaixa um vivo a registro — senão bastaria datar uma rule para ela sair da régua. Registro **sem** data é anomalia de integridade (relatada na revisão), não defeito de prosa.

**Consequência declarada e auto-aplicada:** este `ADR.md` cita os 13 paths ausentes e **não** é violação — ele está em `.spec/prd/**`, fora do corpus vivo. É o mesmo critério que o `ADR-001`-N7 já usou para `.spec/archive/**`; aqui ele deixa de ser convenção e passa a ser predicado.

### 2.2 Árvore de decisão — a ordem é fixa, logo a classe é determinística

```
0. o arquivo que cita está FORA do corpus vivo?                          → C5 dated-record
1. TODOS os citantes são skills listadas em .vendor-lock.json?           → C4 vendor-internal
2. a citação está declarada em NON_DEFECT (com reason + proof)?          → C3 declared-non-defect
3. o MESMO path (ou o predicado de uma fase) é atribuído a 2+ autores    → C6 live-conflict
   vivos, ou o mesmo sujeito tem 2 nomes e 2 autores?
4. alvo ausente ∧ o assunto é de eixo que stack.* declara N/A?           → C2 foreign-baseline
5. alvo ausente (demais)                                                 → C1 live-orphan
6. alvo existe, 1 autor                                                  → sem defeito (não entra na tabela)
```

**Um caso de fronteira, resolvido pela árvore e não pelo gosto:** o mesmo sujeito com **duas grafias e nenhum autor** (`.doc/ARCHITECTURE.md` × `.doc/arquitetura-backend.md`, §3-B4/B5) **não** é C6 — C6 exige disputa de **autoria**; aqui ninguém produz o arquivo, ele está ausente nas duas grafias. Cai em C1, e a escolha do nome faz parte do `repoint` que o PRD 2 decide.

### 2.3 As 6 classes — predicado, ação e garantia

| Classe | Predicado (o comando que a prova) | Ação (uma por classe) | Garantia |
|---|---|---|---|
| **C1 `live-orphan`** | `test -e ".agents/$p"` ⇒ falso **e** o citante está em `.agents/{rules,agents,skills}/**` **e** não suprimido por C3/C4 | **`repoint-or-create`** — o alvo (SSoT existente ou rule nova) é decidido no **PRD 2**; até lá, entrada na baseline com `owner` + `prd` | 🟢 detectável (V18) |
| **C2 `foreign-baseline`** | C1 **e** o assunto é de eixo que `harness.config.json.stack.*` declara `N/A` — prova: `echo "$p" \| grep -qE '^(rules/)?(backend-\|db-migration-)'` **ou** o path contém `backend` **e** `node -e 'console.log(require("./harness.config.json").stack.backend)'` ⇒ `N/A …` | **`debt-with-owner: PRD 2`** + **condição de reativação** (PRD 3/4 habilita o eixo). **Remoção não é decidida aqui** — apagar uma rule de baseline Java pode ser o erro caro se o eixo voltar | 🟢 detectável (V18) |
| **C3 `declared-non-defect`** | citação presente em `NON_DEFECT` — lista literal com `reason` **e** `proof` (arquivo:linha). Sub-formas: `illustrative` (string de exemplo dentro de bloco de código — **é** reportada pelo detector, logo precisa da lista) e `convention` (nome de arquivo do runtime, sem prefixo de diretório — **não** é reportada, porque está fora da gramática do V18; a lista fica vazia para ela) | **`none`** — a lista **é** o registro; entrada sem `reason`/`proof` é FAIL do próprio V18 | 🟡 declarado (revisão humana) |
| **C4 `vendor-internal`** | todo citante está sob `.agents/skills/<n>/` **e** `<n>` ∈ chaves de `.vendor-lock.json.skills` | **`none (upstream)`** — a exclusão é **derivada do lock**, nunca do prefixo do nome (mesma regra do instalador, `ADR-002`) | 🟢 derivado |
| **C5 `dated-record`** | citante ∉ corpus vivo (`^(\.agents/\|opencode\.json$)`) | **`none`** — imutável; o detector **não varre** | 🟢 por escopo |
| **C6 `live-conflict`** | 2+ fontes vivas divergem sobre o mesmo sujeito — autoria, nome, roster ou predicado; prova = os dois `arquivo:linha` lado a lado | **`single-owner`** — o vencedor sai da ordem de §2.4; o perdedor é reescrito como **handoff** (nunca apagado sem dono declarado) | 🟢 nos itens que caem em token exclusivo; 🟡 nos que dependem de sentido (§3-C) |

**Por que C1 e C2 são classes distintas e não "acionável" com sub-rótulo:** a ação é diferente. C1 fecha no PRD 2 com `repoint`/`create`; C2 fecha com dívida declarada **e** uma condição de reativação que C1 não tem. Uma classe por ação — duas ações, duas classes. O contrário (uma classe, duas ações) é o começo da sacola.

### 2.4 Como C6 resolve — ordem fixa, cada passo com um comando

Quando duas fontes vivas divergem, vence nesta ordem (o primeiro critério que decidir, decide):

1. **Permissão nativa** — só pode ser autor quem tem `edit: allow`: um autor sem escrita é prosa morta.
   `node -e 'const a=require("./opencode.json").agent;console.log(Object.entries(a).filter(([,v])=>v.permission?.edit==="allow").map(([k])=>k).sort().join(","))'`
2. **Canon declarado** — `.agents/rules/sdd-workflow-standard.md` §1/§2 (dono de cada path do ciclo) e `.agents/rules/prd-adr-pipeline.md` §1/§2 (forma de ADR/índice).
   `sed -n '/^## 1\. Organização/,/^## 2\./p' .agents/rules/sdd-workflow-standard.md`
3. **Registro** — `opencode.json.agent` é o roster: membro registrado e ausente de uma tabela de operação é omissão, não escolha.
   `node -e 'console.log(Object.keys(require("./opencode.json").agent).sort().join("\n"))'`
4. **Lista de isenção** — `.agents/rules/prd-adr-pipeline.md` §3 é o **único** predicado que particiona "planeja / não planeja". Onde a lista canônica existe, ela vence os adjetivos ("complexa", "simples").
   `sed -n '/^## 3\. Cerimônia/,/^## 4\./p' .agents/rules/prd-adr-pipeline.md`

Se nenhum dos 4 decidir, o item **não** é decidido por este ADR: vira follow-up com dono — nunca voto de desempate por gosto.

### 2.5 Onde a classificação vive — e por que ela não apodrece

A classificação tem dois registros, e os dois são mecânicos:

- **A tabela de §3** (este ADR, registro datado) — a leitura humana, com `arquivo:linha`.
- **A baseline executável** — `BASELINE` no módulo `.opencode/plugins/lib/refs/checks.mjs` (path **propagado** pelo instalador: `.opencode/plugins` é camada inteira, `install.mjs:107`), invocada pelo runner já selado (`scripts/static-checks.mjs`, check novo **`V18`**; no estado pré-SDD desse runner existem `V2`, `V3`, `V6`, `V6b`, `V7`, `V12`, `V14`, `V15` — `V17` vive em `scripts/sdd-checks.mjs`, logo `V18` é o próximo livre e não colide). **Zero comando novo, zero republicação de selo** (risco `R5` do `RESEARCH.md` §9).

**Gramática do detector — escopo declarado, não implícito.** O `V18` casa **o mesmo predicado do RF-03** (`grep -rhoE "rules/[a-z0-9-]+\.md" .agents`) e nada além. Consequência declarada: os 13 paths de A estão cobertos; os 8 de B são classificados **aqui** e ficam **sem detecção automática** (🟡) — `.doc/**` e `frontend/DESIGN.md` entrariam por um segundo regex, que o SDD **pode** declarar explicitamente, nunca em silêncio. Detector com gramática implícita é a mesma doença da lista sem régua.

A baseline **só pode encolher**, e isso é verificado pelos modos de falha abaixo:

| Modo de falha de V18 | O que significa | Veredito |
|---|---|---|
| path ausente **citado** em corpus vivo, **fora** da baseline e sem supressão | drift novo | **FAIL** |
| path **na baseline** com **0 citações** (ou que passou a existir no disco) | classificação apodreceu — o texto foi corrigido e a entrada ficou | **FAIL** (remover a entrada) |
| entrada de `NON_DEFECT` cujo `proof` (`arquivo:linha`) deixou de existir, cuja linha não cita mais o path, ou cujo path passou a existir no disco | a supressão apodreceu — a lista vira permissão permanente | **FAIL** (corrigir ou remover a entrada) |
| path ausente citado, mas **todos** os citantes são skills do lock, ou a citação está em `NON_DEFECT` | supressão legítima | **PASS** |

**Por que a baseline não pode ser inflada em silêncio:** o módulo mora em `.opencode/plugins/**`, que é `protectedPaths` (`harness.config.json`), logo **alterar a baseline exige o trailer `Harness-Gate-Change`** (ADR-007; pre-commit + `harness-integrity.yml`). Nível de garantia honesto: 🟢 *"órfã nova reprova a suíte selada"*; 🟠 *"quem editar o adapter `scripts/static-checks.mjs` (não protegido) e remover a chamada de `checkRefs()` escapa do check"* — mitigado pelo diff revisado, não por runtime.

## 3. Aplicação da *rubric* — 26 instâncias

### 3.0 Medido, com o comando em cada linha

Regra de leitura: **classe** vem da árvore de §2.2; **ação** é a de §2.3; **prova** é o comando que reproduz o fato. Nenhuma linha desta tabela é "caso especial".

#### A. Os 13 paths de `rules/*.md` citados e ausentes (52 citações)

| # | Instância (path citado) | Citações / arquivos (arquivo:linha de amostra) | Classe | Ação | Comando de prova |
|---|---|---|---|---|---|
| A1 | `rules/backend-coding-standards.md` | 16 / 14 — `spec-review/SKILL.md`, `sdd-compiler/SKILL.md`, `dev-planner/SKILL.md`, `security-review/SKILL.md`, `orchestrator/AGENT.md`, `developer-engineer/AGENT.md`, `workflow-rules.md` | **C2** | dívida PRD 2 + reativação PRD 3/4 | `test -e .agents/rules/backend-coding-standards.md` ⇒ falso; `grep -rl "rules/backend-coding-standards.md" .agents \| wc -l` ⇒ 14 |
| A2 | `rules/security-standard.md` | 8 / 5 — `security-engineer/AGENT.md`, `security-review/SKILL.md:26,29`, `orchestrator/AGENT.md:573`, `developer-engineer/AGENT.md`, `workflow-rules.md` | **C1** | `repoint-or-create` (PRD 2) — **maior risco do lote**: é a SSoT de segurança **declarada** por um agente vivo, e o alvo é agnóstico | `test -e .agents/rules/security-standard.md` ⇒ falso; `grep -rn "rules/security-standard.md" .agents \| wc -l` ⇒ 8 |
| A3 | `rules/backend-integration-tests.md` | 7 / 7 — `spec-review/{SKILL.md,assets/*}`, `security-review/SKILL.md`, `orchestrator/AGENT.md`, `developer-engineer/AGENT.md`, `workflow-rules.md` | **C2** | dívida PRD 2 + reativação | `grep -rl "rules/backend-integration-tests.md" .agents \| wc -l` ⇒ 7 |
| A4 | `rules/backend-unit-tests.md` | 6 / 6 — idem A3 | **C2** | dívida PRD 2 + reativação | `grep -rl "rules/backend-unit-tests.md" .agents \| wc -l` ⇒ 6 |
| A5 | `rules/db-migration-flyway.md` | 4 / 4 — `spec-review/SKILL.md`, `orchestrator/AGENT.md`, `developer-engineer/AGENT.md`, `workflow-rules.md` | **C2** | dívida PRD 2 + reativação | `grep -rl "rules/db-migration-flyway.md" .agents \| wc -l` ⇒ 4 |
| A6 | `rules/db-migration-liquibase.md` | 3 / 3 — `spec-review/assets/*`, `dev-planner/SKILL.md` | **C2** | dívida PRD 2 + reativação | `grep -rl "rules/db-migration-liquibase.md" .agents \| wc -l` ⇒ 3 |
| A7 | `rules/unit-testing-standards.md` | 2 / 2 — `dev-planner/SKILL.md`, `dev-planner/anti-patterns.md` | **C1** | `repoint-or-create` (PRD 2) | `grep -rn "rules/unit-testing-standards.md" .agents` ⇒ 2 hits em `dev-planner/` |
| A8 | `rules/exemplo.md` | 1 / 1 — `harness-installer/SKILL.md:68`, **dentro de bloco ```` ```js ````** (chave de `incomingFiles`) | **C3** (`illustrative`) | `none` + entrada em `NON_DEFECT` com `reason: "string de exemplo em fixture de instalador"` e `proof: .agents/skills/harness-installer/SKILL.md:68` | `sed -n '60,70p' .agents/skills/harness-installer/SKILL.md` ⇒ objeto de exemplo; `test -e .agents/rules/exemplo.md` ⇒ falso |
| A9 | `rules/security-validate-all-input.md` | 1 / 1 — `nestjs-best-practices/SKILL.md:118` | **C4** | `none (upstream)` | citante sob skill do lock: `node -e 'console.log("nestjs-best-practices" in require("./.agents/skills/.vendor-lock.json").skills)'` ⇒ `true` |
| A10 | `rules/bundle-barrel-imports.md` | 1 / 1 — `react-best-practices/SKILL.md:138` | **C4** | `none (upstream)` | idem, chave `react-best-practices` ⇒ `true` |
| A11 | `rules/async-parallel.md` | 1 / 1 — `react-best-practices/SKILL.md:137` | **C4** | `none (upstream)` | idem |
| A12 | `rules/area-description.md` | 1 / 1 — `react-best-practices/README.md:40` (instrução de cópia de template do upstream) | **C4** | `none (upstream)` | idem |
| A13 | `rules/arch-avoid-circular-deps.md` | 1 / 1 — `nestjs-best-practices/SKILL.md:117` | **C4** | `none (upstream)` | idem |

**Fechamento de A:** `C1 = 2` (A2, A7) · `C2 = 5` (A1, A3, A4, A5, A6) · `C3 = 1` (A8) · `C4 = 5` (A9–A13) = **13**. A soma fecha por comando, não por soma manual:
`for p in $(grep -rhoE "rules/[a-z0-9-]+\.md" .agents | sort -u); do test -e ".agents/$p" || echo "$p"; done | wc -l` ⇒ `13`.

#### B. Outros artefatos citados e ausentes

| # | Instância | Arquivo:linha | Classe | Ação | Comando de prova |
|---|---|---|---|---|---|
| B1 | `.doc/stacks.md` | `workflow-rules.md:593` | **C1** | `repoint` — **SSoT já existe**: stack e versões vivem em `harness.config.json.stack` + `rules/harness-config.md`; PRD 2 confirma o texto | `test -e .doc/stacks.md` ⇒ falso; `node -e 'console.log(!!require("./harness.config.json").stack)'` ⇒ `true` |
| B2 | `.doc/arquitetura-backend.md` | `workflow-rules.md:594`, `orchestrator/AGENT.md:679` | **C2** | dívida PRD 2 + reativação (eixo backend `N/A`) | `test -e .doc/arquitetura-backend.md` ⇒ falso; `node -e 'console.log(require("./harness.config.json").stack.backend)'` ⇒ `N/A …` |
| B3 | `.doc/especificacao-sistema.md` | `workflow-rules.md:595`, `orchestrator/AGENT.md:678` | **C1** | `repoint-or-create` (PRD 2) | `grep -rn "especificacao-sistema" .agents \| wc -l` ⇒ 2 |
| B4 | `.doc/ARCHITECTURE.md` (grafia maiúscula) | `dev-planner/workflow.md:33`, `:101`; `dev-planner/SKILL.md:209` | **C1** | `repoint-or-create` — **mesmo sujeito de B2 com 2 grafias**; PRD 2 escolhe **1** nome e o outro desaparece | `grep -rhoE "\.doc/[A-Za-z-]+\.md" .agents \| sort -u` ⇒ 5 paths, 2 pares divergentes |
| B5 | `.doc/STACK.md` (grafia maiúscula) | `dev-planner/workflow.md:101`; `dev-planner/SKILL.md:210` | **C1** | idem B4 (par de B1) | idem B4 |
| B6 | `.doc/` (diretório nu, alvo de escrita) | `workflow-rules.md:204`, `:241`; `orchestrator/AGENT.md:425`, `:431` (archive "mescla Delta Specs em `.doc/`") | **C1** | `repoint-or-create` — o passo de archive escreve num diretório que não existe | `test -d .doc` ⇒ falso; `sed -n '204p' .agents/rules/workflow-rules.md` e `sed -n '425p' .agents/agents/orchestrator/AGENT.md` ⇒ ambas as linhas mandam escrever em `.doc/` |
| B7 | `frontend/DESIGN.md` (Design System *Pulse*) | `design-system-specialist/AGENT.md:26,43,57`; `ux-designer/AGENT.md:24,34,162,253,273`; `orchestrator/AGENT.md:152,299,359` | **C1** | `repoint-or-create` (PRD 2, texto stack-bound) — o **contrato** de design system do destino é do PRD 5, que hoje só *registra* a ausência (`PRD.md` §7) | `test -e frontend/DESIGN.md` ⇒ falso (`frontend/` não existe); `grep -rn "DESIGN\.md" .agents/agents \| wc -l` ⇒ 11 |
| B8 | `AGENTS.md` (raiz do projeto) | 16 arquivos: `orchestrator/AGENT.md:18,667`, `developer-engineer/AGENT.md:105,136`, `workflow-rules.md:606`, `dev-planner/workflow.md:33,41`, `dev-planner/SKILL.md:211`, `sdd-compiler/**` (3), `sdd-architecture-board/SKILL.md:20,28,33`, `spec-review/**` (3); 2 vendorizados | **C3** (`convention`) | `none` — é nome de arquivo **do repo-destino** carregado por convenção, não path deste repo. Fica **fora da gramática do V18** (§2.5), logo não ocupa entrada em `NON_DEFECT` | `test -e AGENTS.md` ⇒ falso; `test -e ~/.config/opencode/AGENTS.md` ⇒ verdadeiro; `sed -n '18p' .agents/agents/orchestrator/AGENT.md` ⇒ trata `AGENTS.md` como arquivo de governança |

**Fechamento de B:** `C1 = 6` (B1, B3, B4, B5, B6, B7) · `C2 = 1` (B2) · `C3 = 1` (B8) = **8**. Nenhuma linha de B entra na `BASELINE`: as de C1/C2 são de `.doc/**`/`frontend/**`, fora da gramática do V18 (§2.5) — ficam classificadas **aqui**, com dono, e sem detecção automática até o PRD 2 (ou até o SDD declarar o segundo regex).

#### C. As 5 divergências herdadas do `ADR-003` §10 — todas C6, com autor decidido

**Critério de resolução por item** = a ordem de §2.4 (permissão → canon → registro → isenção). **Autor único** por path, como no `ADR-003` item 8.

| # | Sujeito da divergência | As duas (ou três) fontes vivas | Classe | Ação decidida — **quem é o autor** | Comando de prova |
|---|---|---|---|---|---|
| C1 | **`PLAN.md`** (autor único) | `dev-planner/workflow.md:20` (diagrama, coluna `PLAN .md`), `:420` (entradas da F5 incluem `PLAN`), `:434` ("Para cada tarefa do PLAN, verifique") **×** `sdd-workflow-standard.md` §1/§2 + `ADR-003` item 8 | **C6** (critério 2 — canon) | **Autor = `sdd-compiler`.** Os 3 sítios da skill deixam de prescrever `PLAN.md`; a F5 recebe **4 artefatos + parecer**. Sítio extra medido: `:408` ("Posso gerar as tasks detalhadas?") promete ao usuário um produto que é do `sdd-compiler` — vira pergunta de **handoff**, sem promessa de geração | `grep -rn "PLAN" .agents/skills/dev-planner/` ⇒ hoje 3; meta 0 · `grep -c "gerar as tasks" .agents/skills/dev-planner/workflow.md` ⇒ meta 0 · `git diff --stat .agents/rules/sdd-workflow-standard.md` ⇒ vazio no commit do SDD |
| C2 | **Template de ADR dentro da skill** | `dev-planner/workflow.md:199` (`#### 2.5 — Registrar Decisões (ADRs)`), `:202` (`## ADR-001: …`), `:204` (`### Status`), `:207` (`### Contexto`), `:210` (`### Decisão`), `:214`, `:217`, `:225` ("Decisões documentadas (ADRs)") **×** `prd-adr-pipeline.md` §1/§2 (forma congelada de `ADR.md` + índice) | **C6** (critério 2 — canon) | **Autor = `architect`.** O bloco `199-225` deixa de gerar ADR: `DESIGN-DECISIONS.md` registra **alternativas + trade-off + recomendação**, sem `Status`, sem `depende-de`, sem interface congelada. O template de ADR continua existindo **só** em `ADRs/ADR-00N-{slug}/ADR.md` | `grep -cE '^## ADR-\|^#### 2\.5 — Registrar Decisões\|^### (Status\|Contexto\|Decisão\|Consequências\|Fontes)$' .agents/skills/dev-planner/workflow.md` ⇒ hoje 7; meta 0 · `grep -rc "depende-de" .agents/skills/dev-planner/ \| grep -v ':0'` ⇒ vazio |
| C3 | **`EXPLORATION.md`** (autor único) | `orchestrator/AGENT.md:285` (Fase 0, via `sdd-compiler` modo `explore`) e `workflow-rules.md:187-190` (Feature simples ⇒ orchestrator gera o path) **×** `orchestrator/AGENT.md:291` + `workflow-rules.md:180-185` (via `planner`), `dev-planner` (F0) e `sdd-compiler/SKILL.md:22` ("**Saída**: … `EXPLORATION.md`") | **C6** (critério **1 — permissão**) | **Autor = `planner`.** Fato mecânico que decide: `orchestrator.permission.edit === "deny"` — o autor proposto pelas 2 fontes perdedoras **não pode escrever**, logo `:285`/`:187-190` são inexecutáveis. O modo `explore` do `sdd-compiler` deixa de declarar o path como **saída** (segue podendo **ler** o arquivo como entrada, `SKILL.md:29`) | `node -e 'console.log(require("./opencode.json").agent.orchestrator.permission.edit, require("./opencode.json").agent.planner.permission.edit)'` ⇒ `deny allow` · `grep -c "sdd-compiler.*explore" .agents/agents/orchestrator/AGENT.md` ⇒ meta 0 · `grep -cE "Saída.*EXPLORATION" .agents/skills/sdd-compiler/SKILL.md` ⇒ meta 0 |
| C4 | **Protocolo de Delegação** omite o `planner` | `orchestrator/AGENT.md:565-580` (9 linhas de tabela, sem `planner`) **×** `opencode.json.agent` (10 chaves, com `planner`) + `workflow-rules.md:180` (a fase delega a ele) | **C6** (critério 3 — registro) | **Autor = roster.** Uma linha entra: `Planejamento técnico \| planner \| dev-planner`. A fiação deixa de existir só em prosa de fase e passa a existir no mecanismo que o agente usa para delegar | `sed -n '565,580p' .agents/agents/orchestrator/AGENT.md \| grep -c planner` ⇒ hoje 0; meta ≥1 · set-diff roster−tabela ⇒ vazio |
| C5 | **Gatilho da Fase 0** (3 predicados sobrepostos) | `workflow-rules.md:176` ("complexas/inovações"), `:180` ("Se Feature **não isenta**"), `:187` ("**Feature simples** (CRUD)") — e CRUD **não está** na lista de isenção, logo cai nos dois ramos | **C6** (critério 4 — lista de isenção) | **Predicado único = `.agents/rules/prd-adr-pipeline.md` §3** (isenta / não isenta). `:176` e `:187` desaparecem como gatilhos: não isenta ⇒ `planner` (4 artefatos); isenta ⇒ sem pacote de planejamento. Custo declarado em §5-C3 | `grep -cE "complexas/inovações\|Feature simples" .agents/rules/workflow-rules.md` ⇒ hoje 2; meta 0 · `grep -c "não isenta" .agents/rules/workflow-rules.md` ⇒ meta 1 · `grep -c "CRUD" .agents/rules/prd-adr-pipeline.md` ⇒ `0` (prova da sobreposição) |

## 4. Interface congelada

Cada item é verificável por comando, rodando da raiz do repo. Nenhum item depende de leitura subjetiva de prosa — e, quando depende, o nível 🟡 está declarado.

1. **V18 existe no runner selado, sem comando novo.** `checkRefs()` é chamado por `runStaticChecks()` em `scripts/static-checks.mjs`; `harness.config.json` e o selo ficam **intactos**.
   *Verificação*: `node scripts/static-checks.mjs | grep -c '^PASS V18'` ⇒ `1`; `git diff --stat harness.config.json .opencode/plugins/lib/seal.mjs` ⇒ vazio; `node -e 'console.log(require("./harness.config.json").commands.suiteFull)'` ⇒ idêntico a `f9c5ca2`.

2. **O detector é puro, propagável e injetável.** Vive em `.opencode/plugins/lib/refs/checks.mjs` (`.opencode/plugins` é camada propagada, `install.mjs:107`), exporta `runRefChecks(root)` e **não** lê o repo real quando recebe `root`.
   *Verificação*: `git ls-files .opencode/plugins/lib/refs/` ⇒ não vazio; `grep -c "export function runRefChecks" .opencode/plugins/lib/refs/checks.mjs` ⇒ `1`; `grep -c "export const CONSUMER_EXCLUDED_PREFIXES" installer/install.mjs` ⇒ `1` (prova de que `__tests__` não viaja).

3. **Escopo do detector = corpus vivo (§2.1), provado por fixture.** Uma referência ausente citada em `.spec/**` **não** é reportada; uma citada em skill do lock **não** é reportada; uma nova em `.agents/rules/**` **é** FAIL.
   *Verificação*: `node --test .opencode/plugins/__tests__/refs.spec.mjs` ⇒ 3 casos de **escopo**, 0 fail (o 3º é o FAIL esperado: órfã nova em `.agents/rules/**`).

4. **Baseline declarada, com as 3 colunas obrigatórias.** Toda entrada de `BASELINE` carrega `class` ∈ {C1, C2}, `owner` e `prd`; entrada sem qualquer das 3 **é** FAIL do próprio check (não do revisor).
   *Verificação*: `node -e 'import("./.opencode/plugins/lib/refs/checks.mjs").then(m=>{const b=m.BASELINE;console.log(b.length, b.every(e=>e.class&&e.owner&&e.prd))})'` ⇒ `7 true` no pós-merge deste ADR — 7 = as 2 de C1 (A2, A7) + as 5 de C2 (A1, A3–A6), até o PRD 2 fechá-las. C3/C4 **não** entram na baseline: são suprimidas por mecanismo (lista com razão / lock).

5. **Baseline não infla em silêncio.** Duas falhas novas para a `BASELINE` (`missing-and-unclassified` e `stale-baseline-entry` — 0 citações **ou** path que passou a existir) e uma terceira para a lista de não-defeitos (`stale-nondefect-entry` — `proof` morto, linha que não cita o path, ou path que passou a existir). A baseline mora em `protectedPaths`, o que exige o trailer `Harness-Gate-Change` para mudá-la.
   *Verificação*: `node --test .opencode/plugins/__tests__/refs.spec.mjs` cobre os 2 modos de **baseline** e o modo de **`NON_DEFECT`** além dos 3 de escopo — 0 fail; `node -e 'console.log(require("./harness.config.json").protectedPaths.includes(".opencode/plugins/**"))'` ⇒ `true`.

6. **Supressões separadas por mecanismo, nunca por nome.** C4 é derivado de `.vendor-lock.json.skills` (5 paths saem da régua sem literal); C3 é lista literal com `reason` + `proof` — **1** entrada (o exemplo do instalador), porque `AGENTS.md` está fora da gramática do detector. A lista não é permissão permanente: `stale-nondefect-entry` reprova quando o `proof` morre (arquivo/linha inexistente, linha que não cita mais o path) ou quando o path passa a existir no disco, e a prova é verificada em **todas** as entradas, não só na primeira.
   *Verificação*: `node -e 'const l=require("./.agents/skills/.vendor-lock.json").skills;console.log(Object.keys(l).length)'` ⇒ `25`; `grep -c "NON_DEFECT" .opencode/plugins/lib/refs/checks.mjs` ⇒ `≥1`; `node -e 'import("./.opencode/plugins/lib/refs/checks.mjs").then(m=>console.log(m.NON_DEFECT.length, m.NON_DEFECT.every(e=>e.reason&&e.proof)))'` ⇒ `1 true`; `node --test .opencode/plugins/__tests__/refs.spec.mjs` ⇒ 0 fail com o fixture `stale-nondefect-entry`.

7. **C5 vale para este ADR.** `ADR.md` e `ADR-INDEX.md` citam paths ausentes e **não** são reportados: estão fora do corpus vivo.
   *Verificação*: `grep -c "rules/security-standard\.md" .spec/prd/prd-harness-inventory/ADRs/ADR-005-prosa-orfa/ADR.md` ⇒ `≥1` **e** `node scripts/static-checks.mjs` ⇒ exit `0`.

8. **`PLAN.md` com 1 autor** (C1 da tabela C): a skill deixa de prescrever o path; a atribuição em `sdd-workflow-standard.md` §1/§2 fica byte-idêntica.
   *Verificação*: `grep -rc "PLAN" .agents/skills/dev-planner/ | grep -v ':0$'` ⇒ vazio **e** `grep -rn "SPEC, PLAN, TASKS" .agents/` ⇒ vazio **e** nenhuma sentença atribuindo a autoria de `SPEC.md`/`PLAN.md`/`TASKS.md` a papel com `permission.edit === "deny"` (varredura por sujeito, não por literal — ver N15) — o predicado varre **todo** o corpus vivo, não só o arquivo corrigido (`grep -v "sdd-compiler"` isentava a linha inteira que apenas mencionasse o skill, e por isso `workflow-rules.md:91` passava; N7).

9. **`DESIGN-DECISIONS.md` não é ADR** (C2 da tabela C): 0 marcadores de ADR no diretório da skill.
   *Verificação*: `grep -rcE '^## ADR-|^### (Status|Contexto|Decisão|Consequências|Fontes)$|^#### 2\.5' .agents/skills/dev-planner/ | grep -v ':0$'` ⇒ vazio; `grep -rc "depende-de" .agents/skills/dev-planner/ | grep -v ':0$'` ⇒ vazio.

10. **`EXPLORATION.md` com 1 autor = `planner`** (C3 da tabela C): a Fase 0 do orquestrador não gera o path e o modo `explore` não o declara como saída.
    *Verificação*: `grep -c "sdd-compiler.*explore" .agents/agents/orchestrator/AGENT.md` ⇒ `0`; `grep -cE "Saída.*EXPLORATION" .agents/skills/sdd-compiler/SKILL.md` ⇒ `0`; `node -e 'console.log(require("./opencode.json").agent.orchestrator.permission.edit)'` ⇒ `deny`.

11. **Delegação lista o roster delegável inteiro** (C4 da tabela C): set-diff vazio entre `opencode.json.agent` **menos o próprio `orchestrator`** (ele delega, não é alvo) e os agentes da **coluna `Subagente`** da tabela `## Protocolo de Delegação` de `orchestrator/AGENT.md`. A mesma régua vale para a tabela §0.1 de `workflow-rules.md`: ela cita os **10** do roster.
    *Verificação*: `comm -3 <(node -e 'console.log(Object.keys(require("./opencode.json").agent).filter(n=>n!=="orchestrator").sort().join("\n"))') <(sed -n '/^## Protocolo de Delegação/,/^## /p' .agents/agents/orchestrator/AGENT.md | awk -F'|' '/^\|/ { c=$3; if (c ~ /^-+$/) next; if (c ~ /Subagente/) next; gsub(/[^a-z0-9-]/,"",c); if (c!="") print c }' | sort -u)` ⇒ vazio. A extração é **de coluna**, não de token na seção: `grep -oE` pegava nomes de skill da coluna vizinha e o `comm` não distingue coluna (N12). Para §0.1: `comm -23 <(roster…sort) <(sed -n '/^## 0\.1 Divisão de Papéis/,/^## 1\. Workflow State/p' .agents/rules/workflow-rules.md | grep -ohiwE "$(node -e 'console.log(Object.keys(require("./opencode.json").agent).join("|"))')" | tr A-Z a-z | sort -u)` ⇒ vazio.

12. **Fase 0 com 1 predicado** (C5 da tabela C): só a lista de isenção particiona.
    *Verificação*: `grep -cE "complexas/inovações|Feature simples" .agents/rules/workflow-rules.md` ⇒ `0`; `grep -c "não isenta" .agents/rules/workflow-rules.md` ⇒ `1`.

13. **As 5 decisões de C não viram prosa órfã nova.** Nenhum dos 5 itens introduz path inexistente: a saída é remoção de frase, reapontamento para artefato existente (`sdd-compiler`, `architect`, `planner`, `opencode.json`, `prd-adr-pipeline.md` §3) ou linha de tabela.
    *Verificação*: rodar `node scripts/static-checks.mjs` **antes e depois** do commit do SDD ⇒ exit `0` nos dois, com a **mesma** contagem de baseline (7) — nenhuma entrada nova.

14. **Zero edição de prosa neste batch; suíte verde.** O commit do ADR toca **só** `.spec/prd/prd-harness-inventory/**`.
    *Verificação*: `git show --stat --name-only HEAD` ⇒ `ADR-INDEX.md` + `ADRs/ADR-005-prosa-orfa/ADR.md`; `node --test ".opencode/plugins/__tests__/*.spec.mjs" && node --test "installer/__tests__/*.spec.mjs" && node scripts/static-checks.mjs && node scripts/vendor-skills.mjs --check` ⇒ exit `0`; `node scripts/sdd-checks.mjs` ⇒ `0 FAIL`.

## 5. Consequências

- **C1 — a próxima citação órfã não pede um ADR.** Ela pede uma linha na baseline + uma classe. O ADR deixa de ser o lugar onde cada caso nasce.
- **C2 — a prosa continua mentindo por 1 ciclo, com prazo e dono.** A2 (`security-standard.md`, 8 citações) e A7 seguem ausentes até o PRD 2; a mitigação é a baseline com `owner`/`prd` e V18 reprovando qualquer órfã **nova**. O `PRD.md` §5 já declara a meta "0 não classificadas" — aqui ela passa a ter mecanismo.
- **C3 — custo aceito do predicado único da Fase 0:** CRUD básico **não** é isento (`prd-adr-pipeline.md` §3), logo passa pelo `planner` e recebe o pacote de 4 artefatos. Se o owner quiser isentar CRUD, a mudança é na **lista de isenção** (1 arquivo, 1 linha) — e não um 3º gatilho em `workflow-rules.md`, que é o defeito que este item fecha.
- **C4 — C2 (`foreign-baseline`) é a classe que menos fecha e mais protege.** As 5 rules de baseline Java continuam citadas e ausentes até o PRD 2; a decisão de **remover** não é tomada aqui porque o eixo pode voltar (PRD 3/4). O que muda é que agora a dívida tem dono e condição de saída, em vez de ser só um `test -e` vermelho que ninguém olha.
- **C5 — a baseline é um artefato protegido e, por isso, um lugar caro para mentir.** Mudá-la exige trailer de gate (🟠 CI). O custo é burocracia em todo PR que fechar uma dívida; o benefício é que a lista não cresce sem rastro.
- **C6 — `ADR-004` fica livre da classificação.** O inventário derivado mede (contagens re-deriváveis); este ADR classifica (o que fazer). Duas responsabilidades, dois artefatos, zero acoplamento — a baseline é literal justamente para o ADR-005 não falhar se o ADR-004 atrasar.
- **C7 — o repo-destino herda o módulo, **não** o check (corrigido — ver N10).** O módulo vive em path propagado, então o destino recebe `lib/refs/checks.mjs`; o **adapter** (`V18`) mora em `scripts/static-checks.mjs`, e `installer/install.mjs` exclui `scripts/` de artefato de consumidor ⇒ o destino herda um módulo **sem** quem o acione (check órfão, a mesma classe que o ADR-002 curou). Pior: se o adapter fosse ligado no destino, `stale-baseline-entry` reprovaria **por construção**, porque aquele repo não reproduz as 7 citações deste. Como o destino passa a ganhar o check fica no **PRD-3** (instalador/CLI); este ADR apenas declara a consequência real.
- **C8 — 3 das 5 divergências herdadas fecham por token (🟢); 2 dependem de sentido (🟡).** C4 (linha da tabela) e C5 (gatilho) não têm como ser provadas por token sem repetir o defeito do `ADR-003`-N14 ("verde por token, contraditório por sentido"). Elas fecham com **leitura na revisão** + o comando de set-diff do item 11. Declarado, não escondido.

## 6. Alternativas descartadas

| Alternativa | Custo | Por que foi descartada |
|---|---|---|
| **F1 — corrigir o texto agora** (`RESEARCH.md` §7) | 15+ arquivos vivos editados neste ciclo | Embarca trabalho do PRD 2 e colide com o não-objetivo do `PRD.md` §7; e a correção **certa** dos 5 paths de backend depende de decisão de eixo que não é deste ciclo (PRD 3/4). Descartada por D5. |
| **F3 — `lychee`/lint de link** | 1 dependência Rust + 1 etapa de CI + extrator próprio | Não cobre a classe: as referências são paths em backtick no meio de prosa, não links. Sem extrator, cobertura ≈ 0. |
| **F4 cru — check sem baseline** (só FAIL em qualquer ausente) | 0 arquivo de baseline | Nasce vermelho com as 13 órfãs e o repo perde a suíte verde (H2). Baseline declarada é o que impede o check de virar ruído — precedente `V12`/`LEGACY` no próprio runner. |
| **Uma lista de 26 casos, sem classes** | 26 decisões avulsas | É o defeito que este ADR existe para não cometer: a próxima órfã volta sem critério, e a revisão não tem como recalcular a classe — só confiar. |
| **6º ADR para as 5 heranças do `ADR-003`** | +1 linha no índice, +1 branch | O owner já re-escopou os 5 itens para cá (§10 do `ADR-003` + decisão de 2026-11-11). Criar um ADR novo agora seria reabrir decisão do owner **e** estourar o teto de 5 ADRs por PRD (`prd-adr-pipeline.md` §3). |
| **Suprimir vendor-internal por prefixo de nome** (`dart-*`, `react-*`) | 0 lookup | Repete o erro que o instalador já corrigiu: a classe vem do `.vendor-lock.json`, nunca do nome do diretório (ADR-002). |

## 7. Critérios de verificação

**Item 0 — re-derivação do contexto (RF-07).** Deve reproduzir §1/§3 antes do SDD:

```sh
grep -rhoE "rules/[a-z0-9-]+\.md" .agents | sort -u | wc -l                    # 20
for p in $(grep -rhoE "rules/[a-z0-9-]+\.md" .agents | sort -u); do
  test -e ".agents/$p" || echo "$p"; done | wc -l                              # 13
grep -rhoE "rules/[a-z0-9-]+\.md" .agents | sort | uniq -c | awk '{s+=$1} END {print s}'   # 104 (20 paths) — os 13 ausentes somam 52
grep -rn "planejador" .agents/                                                  # vazio (fechado em f9c5ca2)
test -e AGENTS.md || echo "AGENTS.md ausente na raiz"                           # ausente
test -d .doc || echo ".doc ausente"; test -d frontend || echo "frontend ausente"
grep -rn "PLAN" .agents/skills/dev-planner/                                     # :20 :420 :434
grep -nE "^## ADR-|^### (Status|Contexto|Decisão)$" .agents/skills/dev-planner/workflow.md   # :202 :204 :207 :210
node -e 'console.log(require("./opencode.json").agent.orchestrator.permission.edit)'         # deny
```

**Aceite do SDD deste ADR** (cada bloco mapeia para itens de §4):

```sh
# itens 1-2: V18 no runner, módulo propagável e puro
node scripts/static-checks.mjs | grep -c '^PASS V18'                            # 1
git diff --stat harness.config.json .opencode/plugins/lib/seal.mjs              # vazio
git ls-files .opencode/plugins/lib/refs/                                        # não vazio

# itens 3-6: fixtures, baseline com 3 colunas, 2 falhas novas, supressões separadas
node --test .opencode/plugins/__tests__/refs.spec.mjs                           # 0 fail
node -e 'import("./.opencode/plugins/lib/refs/checks.mjs").then(m=>console.log(m.BASELINE.every(e=>e.class&&e.owner&&e.prd)))'   # true
node -e 'console.log(require("./harness.config.json").protectedPaths.includes(".opencode/plugins/**"))'                          # true
node -e 'const l=require("./.agents/skills/.vendor-lock.json").skills;console.log(Object.keys(l).length)'                       # 25

# item 7: C5 vale para este ADR
node scripts/static-checks.mjs; echo $?                                         # 0

# itens 8-12: as 5 decisões de C
grep -rc "PLAN" .agents/skills/dev-planner/ | grep -v ':0$'                     # vazio
git diff --stat .agents/rules/sdd-workflow-standard.md                           # vazio
grep -rcE '^## ADR-|^### (Status|Contexto|Decisão|Consequências|Fontes)$|^#### 2\.5' .agents/skills/dev-planner/ | grep -v ':0$'   # vazio
grep -rc "depende-de" .agents/skills/dev-planner/ | grep -v ':0$'               # vazio
grep -c "sdd-compiler.*explore" .agents/agents/orchestrator/AGENT.md            # 0
grep -cE "Saída.*EXPLORATION" .agents/skills/sdd-compiler/SKILL.md              # 0
grep -cE "complexas/inovações|Feature simples" .agents/rules/workflow-rules.md   # 0
grep -c "não isenta" .agents/rules/workflow-rules.md                            # 1
comm -23 <(node -e 'console.log(Object.keys(require("./opencode.json").agent).filter(n=>n!=="orchestrator").sort().join("\n"))') \
         <(sed -n '/^## Protocolo de Delegação/,/^## /p' .agents/agents/orchestrator/AGENT.md | grep -oE '`[a-z-]+`' | tr -d '`' | sort -u)   # vazio

# itens 13-14: nenhuma baseline nova, suíte verde
node --test ".opencode/plugins/__tests__/*.spec.mjs" \
  && node --test "installer/__tests__/*.spec.mjs" \
  && node scripts/static-checks.mjs \
  && node scripts/vendor-skills.mjs --check                                     # exit 0
node scripts/sdd-checks.mjs                                                      # 0 FAIL
```

**Ordem de merge.** `ADR-005` depende de `ADR-003` **merged** (`f9c5ca2`) — a herança só é válida contra o estado pós-`ADR-003`. `ADR-001`/`ADR-002` também já estão `merged`; o `slot` único de `in-progress` (`checks.mjs:378-379`) fica livre para esta linha.

## 8. Notas de correção (divergências medidas entre PRD/RESEARCH e disco)

- **N1 — o "15/15" do RF-03 não fecha aritmeticamente, e a baseline mudou.** `PRD.md` §9-RF-03 enumera *"8 acionáveis + 5 vendor-internal + 1 exemplo + DESIGN.md + planejador×3"* — isso soma **18**, não 15. Além disso `planejador` mede **0** desde `f9c5ca2`. Baseline re-declarada por medição (2026-11-11): **13 de A + 8 de B = 21 instâncias** (C1 = 8 · C2 = 6 · C3 = 2 · C4 = 5), mais **5 divergências C6** herdadas — 26 linhas no total. Os "20" da prosa contam paths distintos (13 de rule + 5 de `.doc` + 1 `.doc/` + 1 `DESIGN.md`) e deixam `AGENTS.md` de fora (N4); as 21 instâncias contam **referências classificadas**, que é o que a métrica do `PRD.md` §5 pede.
- **N2 — "6 baseline Java" → 5, por predicado.** O `PRD.md` §3.5 diz 6; o predicado declarado `^rules/(backend-|db-migration-)` casa **5** (A1, A3, A4, A5, A6). `unit-testing-standards.md` (A7) **não** casa e vai para C1 — o predicado vence a contagem da prosa, e a contagem fica registrada aqui.
- **N3 — `.doc/` tem 5 paths, não 3, e 2 grafias para 2 sujeitos.** `dev-planner` usa `.doc/ARCHITECTURE.md` e `.doc/STACK.md`; as rules usam `.doc/arquitetura-backend.md` e `.doc/stacks.md`. Mesmo sujeito, nomes diferentes, ambos ausentes. Fica registrado como **1 decisão de nome por sujeito** no PRD 2 (B1/B4 e B2/B5), não como 4 paths independentes.
- **N4 — `AGENTS.md` ausente não é prosa órfã.** É o nome que o runtime carrega do repo-destino (e que existe no host, `~/.config/opencode/AGENTS.md`). Contá-lo como órfã inflaria o RF-03 com um falso positivo e ensinaria o leitor a ignorar a régua. Classe C3-`convention`.
- **N5 — o `ADR-003` §10 citou `workflow.md:408` dentro do I2; medido, `:408` não nomeia `PLAN`.** Ele promete *"Posso gerar as tasks detalhadas?"* — defeito real, mas de **outra fronteira** (o `planner` não gera `TASKS.md`). Entra na tabela C como sítio extra de C1, com ação própria, em vez de ser silenciado por não casar o token `PLAN`.
- **N6 — `sdd-compiler` modo `explore` já era inexecutável na prática.** `orchestrator/AGENT.md:285` e `workflow-rules.md:190` mandam **o `orchestrator`** gerar `EXPLORATION.md`, e o `orchestrator` é `edit: deny` — medido em `opencode.json`. A escolha de autor em C3 não é preferência: é a única atribuição que pode ser cumprida.

## 9. Volume, corte e o que fica para o SDD

**O volume excede?** Não — mas está no limite, e o limite é declarado: 6 classes + 26 instâncias + 14 itens de interface. O que **não** entra aqui é o conteúdo (texto das 8 rules, alvo de cada `repoint`, nome escolhido em N3/PRD 2) e a derivação de inventário (ADR-004). Se o owner quiser um ADR mais fino, o corte proposto é **um só**: mover a tabela A (13 linhas) para o `BASELINE` do módulo e deixar no ADR apenas as classes + B + C. **Não proponho um 6º ADR** — o teto de 5 por PRD (`prd-adr-pipeline.md` §3) é regra, e as 5 heranças já foram re-escopadas para cá pelo owner. A tabela A fica porque D5 diz "classificar no PRD-1" e porque a baseline sem a tabela legível vira lista de strings sem dono.

**Fica para o SDD deste ADR** (nesta ordem):

1. `refs/checks.mjs` + `BASELINE` (**7** entradas com `class`/`owner`/`prd`: as 2 de C1 + as 5 de C2) + `NON_DEFECT` (**1** entrada com `reason`/`proof`: o exemplo do instalador).
2. `refs.spec.mjs` com 3 fixtures (órfã nova ⇒ FAIL; citante em `.spec/**` ⇒ ignorado; skill do lock ⇒ ignorada) + 2 modos de falha da baseline (não classificada; entrada obsoleta).
3. Adapter `V18` em `scripts/static-checks.mjs` (1 linha na sequência de `runStaticChecks`).
4. As 5 decisões de C: `dev-planner/workflow.md` (C1: `:20`, `:408`, `:420`, `:434`; C2: bloco `199-225`), `orchestrator/AGENT.md` (C3: `:285`; C4: linha na tabela `565-580`), `workflow-rules.md` (C3: `187-190`; C5: `176`, `187`), `sdd-compiler/SKILL.md:22` (saída do `explore`).
5. Suíte completa + `sdd-checks` verdes, `harness.config.json` e selo **intactos**, nenhuma edição fora de `.agents/{skills,agents,rules}` + os 2 arquivos de check.

**Fora do SDD (declarado):** o texto das 8 rules ausentes (PRD 2), o nome canônico de cada doc em N3 (PRD 2), o contrato de design system do destino (PRD 5), `KNOWN_AGENTS` (`FU-65`), e qualquer alteração de `gate.js`.

- **N7 — F1 do code review: `PLAN.md` tinha um 2º autor vivo, e o predicado do item 8 não podia vê-lo.** `.agents/rules/workflow-rules.md:91` (tabela "Divisão de Papéis") atribuía `SPEC, PLAN, TASKS` ao **`orchestrator`** — que tem `edit: deny`, logo prosa inexecutável, exatamente o argumento que este ADR usa em C3. O item 8 verificava `grep -rc "PLAN" .agents/skills/dev-planner/`: escopo **igual ao arquivo corrigido**, o que é a definição de check que passa por construção. Predicado ampliado.
- **N8 — fronteira de classe de caractere na gramática (F2 do review).** A gramática `rules/[a-z0-9-]+\.md` não casa maiúscula, `_`, `.markdown` nem slug quebrado por linha. Medido: com `[A-Za-z0-9_.-]` o corpus tem **23** paths citados (não 20), e os 3 extras (`rules/_template.md`, `rules/_sections.md`, `rules/BRAIN.MCP.md`) estão ausentes no disco. Hoje benignos (2 são `vendor-internal`, `BRAIN.MCP.md` é path do repo irmão), mas a tabela A só fecha **por sorte**. Fronteira declarada; ampliar a gramática exige decidir o falso-positivo de citação relativa (`../brain/.agents/rules/x.md`), que `diskPathOf` hoje força para `.agents/<target>`. **Não ampliado neste ADR** — declarado como limite.
- **N9 — `AGENTS.md` da raiz é citante vivo e está fora do predicado.** A §2.1 o classifica como "vivo por convenção" **como citado**; como **citante**, fica fora de `^(\.agents/|opencode\.json$)`. No repo-destino ele é o arquivo mais vivo de todos. Limite declarado, não corrigido (mudar o predicado reabriria a classe inteira).
- **N10 — `§5-C7` estava invertida nos dois sentidos.** O destino **não herda o adapter**: `installer/install.mjs` exclui `scripts/` de artefato de consumidor. Logo (a) o destino herda o módulo `lib/refs/checks.mjs` **sem** o `V18` que o aciona — check órfão, a mesma doença que o ADR-002 curou no `prd-adr-pipeline`; e (b) se algum dia ligar o adapter, `stale-baseline-entry` reprova **por construção** num destino que não reproduz as 7 citações deste repo. Corrigido o texto de C7; a decisão de como o destino ganha o check fica para o PRD-3 (CLI/instalador).
- **N11 — `NON_DEFECT` sem modo `stale`.** A `BASELINE` tem 2 modos de falha; a lista de não-defeitos tem 1 (entrada incompleta). Entrada morta ali fica para sempre. Modo acrescentado no SDD como `stale-nondefect-entry`, com a prova verificada em **todas** as entradas (não só na primeira).
- **N12 — item 11 media sopa de tokens.** `grep -oE '\`[a-z-]+\`'` na seção inteira captura nomes de **skill** da coluna vizinha; o `comm` não distingue coluna. Restrito à 2ª coluna no SDD. E a tabela `.agents/rules/workflow-rules.md` §0.1 lista **7** papéis para um roster de **10** (faltam `planner`, `ux-designer`, `design-system-specialist`) — 27ª instância, do mesmo sujeito. Tabela §0.1 completada: 10/10 do roster.
- **N13 — baseline sustentada só por citação vendorizada (F5 do review).** Entrada da `BASELINE` cuja **única** citação viva está numa skill do `.vendor-lock.json` nunca perde a citação do modo (b): a entrada fica `PASS` para sempre, porque o lock suprime a citação em C4 mas o contador de citações continua vendo uma. Não é classe nova e não é FAIL — o alcance de `NON_DEFECT`/`BASELINE` não muda. O limite está declarado no cabeçalho de `lib/refs/checks.mjs` e o número aparece no detalhe de `stale-baseline-entry` (`sustentadas só por citação vendorizada=N`), para a dívida não ser silenciosa. Medido neste repo: **0** entradas nessa condição (as skills citantes de baseline são locais, não do lock).
- **N14 — `SPEC.md` RF-02 omitia a coluna `prd` (F6 do review).** O item 4 do §4 exige `class`/`owner`/`prd`; a SPEC listava `path`/`class`/`reason`/`owner`. Alinhada ao registro real do `BASELINE` (`path/class/reason/owner/prd`) — o `validateBaseline` já reprovava a entrada sem `prd`, então a SPEC era mais frouxa que o mecanismo.

- **N15 — o buraco de autoria de `SPEC.md`/`PLAN.md`/`TASKS.md` é real e fica deferido.** O code review mostrou que `.agents/agents/orchestrator/AGENT.md:9` afirma que as ferramentas de escrita do papel cobrem `SPEC.md`/`PLAN.md`/`TASKS.md` — enquanto `opencode.json` dá `edit: deny` a ele. É a **mesma classe** de C3 (`EXPLORATION.md`), agora nos três artefatos do ciclo: quem os escreve, na prática? A resposta honesta é que a redação acontece pela via estruturada do ciclo (`sdd-compiler` é skill, não papel com permissão), e isso **não** é decidido aqui. A sentença foi corrigida para não afirmar capacidade que o config nega; a decisão de **quem é o autor** fica para o **PRD-2**. Declarado, não silenciado: o item 8 não pode provar autoria, só a ausência do literal e a inexistência de atribuição a papel com `edit: deny`.
- **N16 — predicado do item 11, ramo §0.1.** A primeira versão extraía "menção na seção", que passa com a tabela mutilada desde que o nome apareça em prosa. Corrigido: extrair a **coluna `Role`** (`awk -F'|' '{print $2}'`) do intervalo da tabela e comparar com o roster por `comm -3` — bidirecional, pega linha faltante **e** papel fantasma.
- **N17 — `stale-nondefect-entry` aceitava prova de registro datado.** A validação checava que o `proof` existia e citava o path, mas não que o **citante era vivo** nem que o path ainda tinha citação viva. Com isso, uma linha em `.spec/archive/**` anulava a régua inteira — exatamente o verde falso que C5 proíbe. Endurecido: `isLiveCiter(proof.file)` **e** ≥1 citação viva do path, senão `FAIL`.
- **N18 — o contador de dívida vendorizada era invisível onde roda.** O módulo calculava `vendorOnly`, mas o adapter só imprime `detail` no ramo `!ok` — em PASS a dívida sumia. O `detail` do `V18` passa a carregar o contador em **ambos** os ramos: dívida declarada não pode depender de o check estar vermelho.
