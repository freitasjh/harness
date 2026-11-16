# RESEARCH — prd-agnostic-artifacts

> **prd-id**: `prd-agnostic-artifacts` · **Programa**: `harness-refactor-2026-11` (ordem 2) · **Rota**: Refactor
> **Data da pesquisa**: 2026-11-11 · **Data de acesso de todas as fontes**: 2026-11-11
> **Estatuto**: insumo do portão **G2**. Cada tema termina em **recomendação** — recomendação não é decisão.
> As 8 decisões (D1–D8) já estão **fechadas** pelo owner no G1 (`PRD.md` §16); aqui se pesquisa **como**
> cada uma se sustenta e **a que custo**, nunca se elas deveriam ser outras.
> **Escopo de escrita**: só `.spec/prd/prd-agnostic-artifacts/` (`RESEARCH.md`, `ADR-INDEX.md` e o stub
> mínimo de `ADRs/ADR-001-…/ADR.md` exigido pelo 1:1). Nenhum `.agents/**`, `installer/**`,
> `opencode.json`, `harness.config.json` ou `gate.js` foi tocado.

## 0. Resumo executivo (1 linha por ADR)

1. **ADR-001 (critério CDL + instrumento)** — o padrão publicado para instrução condicional é **modo de
   inclusão declarado** (Kiro `inclusion:`, Cursor `globs`/`alwaysApply`), não prosa genérica; o instrumento
   equivalente aqui é rubrica de 4 vereditos por linha, com população e lista **derivadas** dos presets.
2. **ADR-002 (2 entradas sempre-instaladas + autoria)** — "core + override do projeto" é o padrão que
   sobrevive (`spec-kit` constitution/preset), mas mover artefato exige mapa de instalador (PRD-3); na prática
   do ciclo, a forma executável é **condição inline** + `edit` restrito por `resource` glob.
3. **ADR-003 (skills comuns + `spec-review`)** — escopo de skill já é cidadão de primeira classe
   (`project` × `global` no opencode; namespace de plugin no Claude Code); a saída de `spec-review` do payload
   comum tem mecanismo, não precisa de invenção.
4. **ADR-004 (8 paths + `DESIGN.md` + N30)** — lint genérico (vale/textlint/lychee) **não cobre** path em
   backtick nem link-ref `[//]: #`; o detector próprio já existe (`V18`) e é o único com custo zero de toolchain.
5. **ADR-005 (frota restante)** — proibição de tecnologia é exceção **declarada** com razão escrita (o repo já
   a tem em `harness-installer/SKILL.md:161-164`), e identidade (classe a) se corrige por **escopo**, não por
   placeholder vago — o padrão do próprio repo é `N/A` **com justificativa inline**.

## 1. Contexto e método

**Por que pesquisar.** O PRD fixa o critério (§3.6) e o fatiamento (§16), mas três coisas só se respondem com
precedente externo: (i) existe formato publicado para "instrução que só vale num eixo"? (ii) existe lint que
pegue acoplamento em prosa normativa? (iii) "skill do harness" × "skill do projeto" tem precedente de escopo?
Sem isso, cada ADR reinventa vocabulário e o custo aparece depois, no SDD.

**Regras aplicadas.**

- Toda alternativa tem **URL http(s) real**, **data de acesso** e **trade-off com custo declarado** (arquivos,
  comandos, dependência nova, risco de drift). "É mais complexo" não é custo.
- Fonte que não abre entra na §10 como **inacessível** e **não** é citada como lida.
- Onde a fonte não fala do nosso caso, a inferência é marcada **inferência**.
- **D1–D8 não são reabertas.** Achado que contradiz decisão vira **risco para o G2** (§9), não contraproposta.
- Nada aqui afirma comportamento de runtime além do que a documentação oficial afirma; não executamos
  `opencode`, não medimos tokens em produção. Os custos são de arquivos e comandos.

**O que este documento não prova.** Não prova que a rubrica acerta 100% dos casos (o PRD já declara que a
heurística de linha prescritiva **superestima**, §3.6-A-2); não prova que o destino herda o instrumento
(ADR-005-C7 do PRD-1 registra que o adapter não viaja); e não substitui a medição — todo número usado aqui vem
do `PRD.md` §3.7 (M1–M9) ou do disco, medido em 2026-11-11.

## 2. Fontes consultadas (12, todas acessíveis, todas usadas)

| # | URL | Acesso | Acessível | O que a fonte efetivamente sustenta |
|---|---|---|---|---|
| S1 | https://opencode.ai/docs/agents | 2026-11-11 | S | Agente é arquivo markdown (`.opencode/agents/<name>.md`) com frontmatter `description`, `mode`, `permissions`; o exemplo publicado é um **reviewer read-only** com `action: edit, resource: "*", effect: deny`; opções incluem Model, System, Permissions, Steps, Hidden, Disabled. |
| S2 | https://opencode.ai/docs/permissions | 2026-11-11 | S | Regra = `{action, resource, effect}`; **"the last matching rule wins, so the specific exceptions follow the broad rule"**; `resource` aceita glob de caminho (`packages/docs/*.mdx`), casamento por caminho normalizado; a página V2 troca `permission`/`bash`/`task` por `permissions`/`shell`/`subagent`. |
| S3 | https://opencode.ai/docs/skills | 2026-11-11 | S | Descoberta de skill por **escopo**: Global `~/.config/opencode/skills` (+ compat `~/.claude/skills`, `~/.agents/skills`) e Project `.opencode/skills` (+ compat `.claude/skills`, `.agents/skills`), subindo do diretório atual até a raiz. |
| S4 | https://agentskills.io/specification | 2026-11-11 | S | Skill = diretório com `SKILL.md` obrigatório; frontmatter `name` (obrigatório, ≤64, `a-z0-9-`, **"must match the parent directory name"**), `description` (obrigatório, ≤1024, "what the skill does and when to use it"), `license` (**opcional**: "license name or reference to a bundled license file"), `allowed-tools` (experimental); dirs opcionais `scripts/`, `references/`, `assets/`; `validate` como verificação. |
| S5 | https://code.claude.com/docs/en/skills | 2026-11-11 | S | Skills têm escopo (bundled, projeto, pessoal, plugin) e **precedência declarada** em colisão de nome; skill de plugin é **namespaced** (`/plugin-name:skill-name`), logo plugin e skill de projeto **coexistem** sem renomear; há seção específica "Load skills in monorepos and subdirectories". |
| S6 | https://github.com/github/spec-kit | 2026-11-11 | S | "**Create a constitution once per project** and repeat the remaining steps for each feature"; customização por **Preset** ("adapt templates, commands, terminology, or methodology", "enforce organizational or regulatory standards") e por **project-local override** ("override a template for one project"). |
| S7 | https://kiro.dev/docs/steering/ | 2026-11-11 | S | Steering tem **modos de inclusão**: `always`, `fileMatch` (`fileMatchPattern: "components/**/*.tsx"`, aceita array) e `manual` (`#steering-file-name`); *foundation files* incluem `tech.md` — "Documents your chosen frameworks, libraries, development tools, and technical constraints. When Kiro suggests implementations, it will prefer your established stack over alternatives"; `AGENTS.md` "do not support inclusion modes and are **always included**". |
| S8 | https://cursor.com/docs/context/rules | 2026-11-11 | S | Quatro tipos de regra com semântica explícita: **Always Apply** / **Apply Intelligently** (pela `description`) / **Apply to Specific Files** (por pattern) / **Apply Manually** (`@`-mention); anatomia = markdown + frontmatter `description`, `globs`, `alwaysApply`; suporta `AGENTS.md` aninhado em subdiretórios. |
| S9 | https://agents.md/ | 2026-11-11 | S | Formato aberto usado por "over 60k open-source projects"; em monorepo, `AGENTS.md` aninhado — "Agents automatically read the **nearest** file in the directory tree, so the closest one takes precedence"; cita 88 `AGENTS.md` no repo principal da OpenAI. |
| S10 | https://vale.sh/ | 2026-11-11 | S | "code-like linting to prose": regras **em YAML** (vocabulário/terminologia) contra guia de estilo, com estilos publicados (Microsoft/Google/Red Hat), rodando offline em macOS/Windows/Linux. |
| S11 | https://textlint.github.io/ | 2026-11-11 | S | Ferramenta de lint de linguagem natural **pluggable**, escrita em JavaScript; regra é pacote npm (`npm install textlint-rule-xxx`). |
| S12 | https://lychee.cli.rs/ | 2026-11-11 | S | Caça link quebrado; suporte nativo a **Markdown e HTML**; saída **JSON** para CI/CD; binário estático único (Rust). |

**Evidência local (não é fonte web — é este repo, medido 2026-11-11):**
`PRD.md` §3.1/§3.4/§3.6/§3.7 (M1–M9); `harness.config.json:13` (`stack.backend`/`frontend` = `N/A` com
justificativa inline); `installer/install.mjs:350-421` (`RULES_BY_AXIS`/`RULES_COMMON`/`SKILLS_COMMON`);
`scripts/static-checks.mjs` (checks `V18`/`V19` já no `suiteFull`, sem comando novo);
`.opencode/plugins/lib/prd-adr-pipeline/checks.mjs:271-350` (`ADR-01`, 1:1 índice↔disco).

## 3. Tema A — Portabilidade de instruções: "core" × "perfil de stack" (ADR-001, ADR-002)

**O que está em jogo.** `workflow-rules.md` (609 l.) e `sdd-workflow-standard.md` (50 l.) estão em
`RULES_COMMON`: vão a **todo** destino. O primeiro prescreve `JUnit 5 + Mockito + AssertJ`, `Testcontainers` e
`mvn verify` incondicionalmente (§5.1–§5.4); o segundo delimita a norma "no projeto Atlas ECM" (`:3`). Os
precedentes publicados separam de três formas distintas — e nenhuma delas é "escrever prosa neutra".

| Alternativa | Fonte (URL · acesso) | Trade-off | Custo declarado neste repo |
|---|---|---|---|
| **A1. Condição inline** — a instrução continua no arquivo comum, mas cada bloco prescritivo abre com o eixo que o ativa ("se `backend=java`…"), como Kiro faz com `fileMatch` e o repo já faz em `sdd-compiler/references/backend.md:53` ("**Spring Boot**: Use…") | https://kiro.dev/docs/steering/ · 2026-11-11; https://cursor.com/docs/context/rules · 2026-11-11 | O destino **sempre recebe** a instrução, mas ela só ativa no eixo declarado — é exatamente o critério A-2 do PRD (§3.6). Perda: o arquivo comum cresce em condicionais e o agente precisa **ler a condição primeiro** (§11 do PRD: condição implícita é pior que prosa nenhuma). | 2 arquivos de `RULES_COMMON` editados (`workflow-rules.md` §5.1–5.4 + `:3` de `sdd-workflow-standard.md`), ambos em `protectedPaths` ⇒ trailer `Harness-Gate-Change`. **Zero** mudança em `installer/` ⇒ selo intacto. |
| **A2. Perfil por eixo (artefato sai do payload comum)** — o bloco de testes vira artefato gateado (`RULES_BY_AXIS`), como o Cursor separa "Apply to Specific Files" por `globs` | https://cursor.com/docs/context/rules · 2026-11-11; https://kiro.dev/docs/steering/ · 2026-11-11 | Mais limpo: o destino só baixa o que aplica. Mas **exige mapa novo no instalador** (`RULES_BY_AXIS` não tem eixo de teste; `SKILLS_BY_AXIS` não tem entrada para "rule de teste") e o PRD §7 proíbe alterar `installer/` neste ciclo. | 1 mapa novo + `install.mjs` editado + 12 presets a revalidar — trabalho do **PRD-3** (`prd-installer-rust`), não deste. Declarado como **deferimento com dono**, nunca como efeito colateral. |
| **A3. Core + override do projeto** — o harness entrega o núcleo e o destino declara stack/overrides (padrão `constitution` do spec-kit e `tech.md` do Kiro) | https://github.com/github/spec-kit · 2026-11-11; https://kiro.dev/docs/steering/ · 2026-11-11 | Modelo com melhor separação de responsabilidade: o eixo é **dado do destino**, não prosa do harness. Perda: exige um artefato de override no destino e um leitor desse artefato — nada disso existe hoje; `harness.config.json` já carrega `stack.*`, mas nenhuma rule o lê. | 1 convenção nova ("rule de teste lê `stack.*`) + 0 arquivo de destino no ciclo; risco de virar 2 SSoT (config × override) se o override não for o próprio `harness.config.json`. |
| **A4. Permanecer como está + exceção declarada** | — (estado atual) | Zero trabalho e zero risco de regressão. Mas mantém M-2 no baseline (43 arquivos, 8.245 l.) e mantém o sintoma que `FU-47` nomeia: N/A em massa num destino de tooling. | 0 arquivo; M-1/M-2/M-4 do PRD §5 ficam impossíveis de fechar, e o PRD-2 não teria razão de existir. |

**Recomendação (ADR-002): A1 agora, A3 como direção declarada.**
*Critério:* o ciclo só pode editar prosa (`installer/**` é do PRD-3, PRD §7), então a única forma **executável
hoje** que satisfaz A-2 é a condição inline com o eixo nomeado; A3 fica escrito como a forma-alvo para o ADR
que tocar o instalador. Custo aceito: 2 arquivos protegidos (trailer de gate) e nenhuma republicação de selo.

> **Inferência declarada:** Kiro e Cursor tratam "instrução condicional" como **metadado de inclusão**
> (`inclusion:`/`globs`), não como frase no corpo. Nosso equivalente não é copiar o metadado — é copiar a
> **propriedade** que ele garante: a condição é verificável sem interpretar a frase. É por isso que o ADR-001
> precisa de veredito por linha (rubrica) e não de "tom condicional" na prosa.

## 4. Tema B — Parametrização por eixo e gating de artefato (ADR-003, ADR-005)

**O que está em jogo.** O repo **já tem** gating (`RULES_BY_AXIS`, `SKILLS_BY_AXIS`, `install.mjs:350-421`),
mas 6 skills de stack por nome ficam em `SKILLS_COMMON` e as 2 rules de frontend já são gateadas. D1
(status quo formalizado) e D8 (exceção declarada) fecham o destino; o que falta é **como** declarar.

| Alternativa | Fonte (URL · acesso) | Trade-off | Custo declarado neste repo |
|---|---|---|---|
| **B1. Formalizar o status quo** — rule de frontend continua axis-gated; skills de stack continuam comuns com o nome declarando o eixo (D1/D8) | https://opencode.ai/docs/skills · 2026-11-11 (escopo project × global); https://kiro.dev/docs/steering/ · 2026-11-11 (modo `manual`/`fileMatch`) | Menor custo e nenhum risco de quebrar destino: o nome da skill **já** é a declaração ("java-architecture-specialist" não engana ninguém). Perda: M-4 do PRD não cai a zero — cai para "exceção nomeada", que é o que o PRD §5 aceita desde que contada. | 0 arquivo movido; 1 parágrafo de critério + 1 linha de exceção (E-1/E-3) por skill. `V19` mantém `skills=48`. |
| **B2. Mover as 6 skills de stack para eixo** (`SKILLS_BY_AXIS`) | https://kiro.dev/docs/steering/ · 2026-11-11 (`fileMatchPattern`); https://cursor.com/docs/context/rules · 2026-11-11 (globs) | Semanticamente correto: skill de stack só no destino daquela stack. Mas exige eixo **por skill** e combinação com os 12 presets — hoje `V19` reporta `skills … axis=0`, ou seja, **não existe** skill axis-gated no disco; criar a categoria é trabalho de mapa do PRD-3/PRD-4. | 6 entradas de mapa + revalidação dos 12 presets + `install.mjs` editado (fora de escopo). **Risco:** mover antes do PRD-3 faz o destino Java **perder** a skill que hoje recebe. |
| **B3. Identidade por nome + corpo condicionado** — a skill continua comum (nome declara o eixo) e o corpo passa a abrir com a condição, como `backend.md:53` | https://agentskills.io/specification · 2026-11-11 (`description` = "what the skill does **and when to use it**"); https://github.com/github/spec-kit · 2026-11-11 (preset por projeto) | Fecha A-2 sem mover arquivo: o consumidor vê a condição na `description` (que é o gatilho de descoberta) e no primeiro bloco. Perda: 6 skills a editar (~1.000 l.) e o risco de "genérico demais" (R2 do PRD) — mitigado por manter o catálogo de opções. | 6 `SKILL.md` editados; 0 mapa novo; 0 selo. Ganho mensurável: M-6 fecha sem tocar o instalador. |
| **B4. Gatear por diretório do destino** (`AGENTS.md` aninhado, "nearest wins") | https://agents.md/ · 2026-11-11; https://cursor.com/docs/context/rules · 2026-11-11 | Padrão real e adotado em escala (60k projetos; 88 arquivos num único repo). Mas resolve **escopo por pasta**, não por stack: o destino não tem "pasta Java" previsível no harness, e o instalador não sabe escrever em subdiretório do consumidor. | 0 arquivo hoje; exige convenção de layout do destino — decisão de produto, não de agnosticização. **Não adotar neste ciclo** (registrado para o PRD-5, que já mexe em payload de frontend). |

**Recomendação (ADR-003/ADR-005): B1 + B3.**
*Critério:* reduz prescrição incondicional (A-2) **sem** alterar o mapa do instalador — o que o ciclo não pode
fazer — e mantém o catálogo como conteúdo (E-1), que é o caso que a métrica ingênua reprovaria (PRD §3.6).

## 5. Tema C — Instrumento de medição de prosa normativa (ADR-001, ADR-004)

**O que está em jogo.** O critério CDL precisa de instrumento. A pergunta não é "qual linter é melhor", é
"qual deles consegue emitir **veredito por linha** com a lista fechada de termos do PRD, sem inventar
toolchain". O repo já tem precedente de check puro dentro do runner selado (`V18`/`V19`).

| Alternativa | Fonte (URL · acesso) | Trade-off | Custo declarado neste repo |
|---|---|---|---|
| **C1. Vale (regras de estilo em YAML)** | https://vale.sh/ · 2026-11-11 | Maduro, offline, regras declarativas e revisáveis por humano. Mas as regras publicadas são de **estilo/terminologia** (usar "Vale CLI" e não "Vale cli"); "linha prescritiva com termo de stack **fora** de contexto condicional" exige regra customizada com `scope`/`raw` + regex por termo, e o veredito de 4 valores não é expressável no formato. | 1 binário por SO + 1 passo de CI + `.vale.ini` + ~21 regras YAML a manter em paridade com a lista derivada (RF-09) — duas fontes da lista (YAML e presets) é drift garantido. |
| **C2. textlint (regras em npm/JS)** | https://textlint.github.io/ · 2026-11-11 | Node-native, o que casa com o repo (Node ESM). Mesmo problema semântico do C1: cada termo vira regra, e "condicional × incondicional" precisa ser plugin próprio — nesse ponto o plugin **é** o detector que já temos. | 1 dependência nova + 21 pacotes/regras (ou 1 plugin próprio) + passo de CI; nenhum ganho sobre `V18` no que o check precisa provar. |
| **C3. lychee (link/path checker)** | https://lychee.cli.rs/ · 2026-11-11 | Resolve A-3 **se** a referência for link/URL. Não resolve: `rules/security-standard.md` é path em backtick no meio de prosa, e `[//]: # (skill)` (N30) é link-ref, que lychee nem resolve como link. Precedente do PRD-1 (ADR-005/F3) já mediu isso. | 1 binário Rust + 1 passo de CI + **extrator próprio** de path-em-backtick; sem o extrator, cobertura ≈ 0 para a classe (c). |
| **C4. Módulo puro próprio + adapter no runner selado** | https://agentskills.io/specification · 2026-11-11 (`validate` como verificação de skill); https://lychee.cli.rs/ · 2026-11-11 (a lição é "check em CI", não a ferramenta) | Só esta opção emite **veredito por linha** e deriva população/lista da mesma fonte que o instalador usa. Perda: regex frágil e a baseline precisa ser **declarada e protegida**, senão o check nasce vermelho (a lição do `V12`/`V18` com baseline). | 1 módulo em `.opencode/plugins/lib/**` (path propagado) + 1 linha de adapter em `scripts/static-checks.mjs` ⇒ **0 comando novo** no `suiteFull`, **0 republicação de selo**, 0 dependência. |

**Recomendação (ADR-001): C4, com a lista de termos derivada dos presets do instalador.**
*Critério:* todo veredito tem de ser reproduzível por **1 comando** e a lista tem de **falhar** quando um preset
novo aparecer (RF-09) — nenhum linter de estilo tem acesso aos presets, e qualquer opção que exija republicar o
selo é custo de gate pago sem ganho de critério.

## 6. Tema D — Skill de projeto × skill do harness (ADR-003)

**O que está em jogo.** `spec-review` = 5 arquivos / **1.303 l.**, 100% TaskFlow (PRD §3.4), e é o **único**
revisor de SPEC da esteira (`workflow-rules.md` §4, passos 2 e 4). D3 fechou: sai do payload comum. A pergunta
é **como** o escopo é declarado para que a chamada sobreviva.

| Alternativa | Fonte (URL · acesso) | Trade-off | Custo declarado neste repo |
|---|---|---|---|
| **D1. Reescrever como revisor genérico, no lugar** | https://agentskills.io/specification · 2026-11-11 (`description` define quando usar) | Mantém 1 consumidor e 0 mudança de chamada. Perda: 1.303 l. reescritas **e** o destino perde o revisor específico do seu domínio; o PRD §7 declara que reescrever a frota inteira é risco de review impossível (R7). | 5 arquivos / 1.303 l. reescritos; e a chamada em `workflow-rules.md` §4 continua acoplada a 1 skill concreta. |
| **D2. Skill de projeto, fora do payload comum, com namespace/escopo explícito** (D3) | https://opencode.ai/docs/skills · 2026-11-11 (escopo `project` × `global`); https://code.claude.com/docs/en/skills · 2026-11-11 (`/plugin-name:skill-name` — plugin e projeto **coexistem**) | O mecanismo existe em ambos os runtimes: o projeto traz o seu revisor e o harness não carrega o do cliente. Perda: `workflow-rules` §4 precisa sobreviver à **ausência** da skill (revisor genérico ou manual), e o destino que quiser revisor tem de fornecer um. | 5 arquivos saem de `SKILLS_COMMON` (mapa do instalador ou diretório de projeto) + 1 parágrafo reescrito em `workflow-rules.md` §4. **Custo de mapa = PRD-3**; o ADR declara o destino e a forma da chamada, não a edição do instalador. |
| **D3. Remover a skill e deixar só revisão manual** | https://agentskills.io/specification · 2026-11-11 | Simples e honesto; A-2/A-3 caem juntos (−1.303 l.). Perda: a esteira perde o **passo de revisão de SPEC** que o `workflow-rules` §4 exige — vira dívida de processo com o nome "review" mantido sem produto. | 0 arquivo a manter; 1 passo da esteira sem produto (o PRD §8-R6 já proíbe: "chamada preservada"). |

**Recomendação (ADR-003): D2.**
*Critério:* preserva o passo 2/4 da esteira (R6 do PRD) **e** remove o nome do cliente do `description`, que é
o gatilho de descoberta (S4) — e o único custo recorrente é 1 parágrafo, porque o mecanismo de escopo já
existe nos dois runtimes (S3/S5), sem inventar categoria.

## 7. Tema E — Autoria de artefato por papel sem permissão de escrita (ADR-002, D6)

**O que está em jogo.** `orchestrator` é `primary` com `permission.edit = "deny"`; a prosa lhe atribui a
geração de `PLAN.md`/`TASKS.md` (`workflow-rules.md:214-215`) e `sdd-workflow-standard.md:16-18` a atribui a
uma **skill** (que roda na sessão do chamador). Os três artefatos centrais não têm autor que possa escrever.

| Alternativa | Fonte (URL · acesso) | Trade-off | Custo declarado neste repo |
|---|---|---|---|
| **E1. `planner` escreve (já tem `edit: allow`)** | https://opencode.ai/docs/agents · 2026-11-11 (`description` guia a escolha do subagente) | Zero mudança de permissão; o autor existe hoje. Perda: `planner` é **subagent** — a esteira do `orchestrator` passaria a depender de uma sessão filha para escrever o artefato central, e a prosa de `workflow-rules.md:214-215` teria de mudar de dono. | 2 blocos de prosa reescritos + 0 mudança de `opencode.json`; risco de handoff extra em toda fase de planejamento. |
| **E2. `sdd-compiler` vira agente com `edit: allow`** | https://opencode.ai/docs/agents · 2026-11-11 (roster é registry explícito) | Resolve a autoria onde a metodologia vive. Perda: **muda o roster de 10**, que o PRD §7 declara invariante (fechado no ADR-001 do PRD-1), e duplica a skill numa segunda superfície. | 1 entrada nova em `opencode.json` + 1 `AGENT.md` + revisão de 4 citações; **viola invariante declarado** ⇒ custo não aceito neste ciclo. |
| **E3. `orchestrator` ganha `edit` allow restrito a `.spec/**`** (D6) | https://opencode.ai/docs/permissions · 2026-11-11 (`action: "edit"`, `resource: "packages/docs/*.mdx"`, `effect: "allow"`); https://opencode.ai/docs/agents · 2026-11-11 (reviewer read-only com `edit` deny) | É o mecanismo nativo: permissão por **ação × caminho**, não por papel inteiro. Mantém o invariante de roster e dá autor executável à esteira. Perda: a prosa passa a depender de **ordem de regras** — "the last matching rule wins", logo `deny *` **precisa** vir antes do `allow .spec/**` — e a permissão vale para qualquer escrita sob `.spec/**`, não só para os 3 artefatos. | 1 entrada de `opencode.json` (2 regras ordenadas) + 2 blocos de prosa (§5 de `workflow-rules` e `sdd-workflow-standard` §1/§2) + 1 item de verificação que **resolve** a permissão, não que lê a prosa. |

**Recomendação (ADR-002/D6): E3, com o item de verificação exigindo a ordem e a resolução efetiva.**
*Critério:* é a única alternativa que dá autor executável **sem** mudar o roster (invariante do PRD §7) e sem
depender de sessão filha para o artefato central; o custo é 1 arquivo de config e 2 blocos de prosa, e o risco
de ordem invertida é verificável por comando (não por leitura).

## 8. Recomendação por ADR (1 linha + critério declarado)

| ADR | Recomendação | Critério declarado |
|---|---|---|
| ADR-001 | CDL como **rubrica de 4 vereditos por linha** (`condicional` \| `exemplo` \| `catálogo` \| `incondicional`), instrumento = módulo puro em `.opencode/plugins/lib/**` + adapter no `static-checks.mjs` já selado; população derivada dos exports do instalador e lista derivada dos presets, baseline literal protegida | Todo veredito reproduzível por 1 comando e **0 comando novo** no `suiteFull` (selo intacto); a lista falha quando um preset novo aparece (fixture vermelha obrigatória) |
| ADR-002 | As 2 entradas de `RULES_COMMON` passam a prescrever por eixo declarado (condição inline, padrão `backend.md:53`) e a autoria de `SPEC`/`PLAN`/`TASKS` fica no `orchestrator` com `edit` allow **só** em `.spec/**` (`deny *` primeiro) | 0 linha prescritiva incondicional nas 2 entradas de maior alcance e 1 autor nomeado por path com permissão **resolvida** (ordem correta), não apenas declarada |
| ADR-003 | 6 skills de stack mantêm identidade por nome e passam a condicionar o corpo ao eixo; `spec-review` sai do payload comum como **skill de projeto** e `workflow-rules` §4 invoca revisor genérico/do destino | `description` sem nome de cliente nas skills comuns; 5/5 vereditos em `spec-review`; chamada do §4 preservada sem citar projeto nem depender de mapa do instalador |
| ADR-004 | Veredito por path (criar / reapontar / remover citação) com D4 = remover as 52 citações e declarar Java fora de suporte até o PRD-4; D5 = remover o ponteiro `DESIGN.md` dos 3 agentes; N30 coberto por **extensão do detector de refs**, não por lint externo | `V18` baseline ≤ 1 e 0 citação de `DESIGN.md`, com 9/9 vereditos e **zero** dependência nova de toolchain |
| ADR-005 | D2 formalizada como **exceção permanente com frase de critério** (proibição mede ausência, não prescrição) e D8 como **exceção declarada** (catálogo + 6 skills de stack); RF-02 aplicado aos 11 arquivos identitários por **reescrita de escopo** | A-1 = 0 e cada exceção nomeada com razão escrita + contagem re-derivável; nenhuma proibição removida sem substituto positivo (RF-04) |

## 9. Riscos para o portão G2 (o que o owner precisa saber antes de decidir)

| # | Risco | Evidência | Por que importa no G2 |
|---|---|---|---|
| **R1** | **Ordem de permissão invertida mata o D6 em silêncio.** "The last matching rule wins": se o `allow .spec/**` for escrito **antes** do `deny *`, a negação vence e o `orchestrator` continua sem escrever — com a prosa dizendo que escreve. | S2 (https://opencode.ai/docs/permissions, 2026-11-11); `opencode.json` (hoje `permission.edit = "deny"`) | O ADR-002 precisa exigir verificação por **resolução efetiva**, não por leitura do JSON. Um item de interface que só compara texto não pega isso. |
| **R2** | **O 1:1 força um stub de ADR-001 neste batch.** `ADR-01` exige `depende-de` **e** "interface congelada" dentro de cada `ADR.md` (`checks.mjs:329-334`) e 1:1 índice↔disco (`:294-301`). Logo o arquivo nasce **antes** do corpo, para a suíte ficar verde. | `checks.mjs:271-350`; `ADR-INDEX.md` deste diretório | Risco de leitura: o stub pode ser confundido com decisão. Ele traz aviso no topo e `TODO` declarado; o owner deve tratá-lo como **placeholder de 1:1**, não como ADR. |
| **R3** | **A população "por eixo" tem duas leituras no repo.** A prosa do PRD lista `SKILLS_BY_AXIS` (2), mas a suíte imprime `skills=48 (vendor-by-axis=25, consumer=22, axis=0)` e `rules=8 (consumer=7, axis=1)`: **0 skill axis-gated** hoje. | `node scripts/static-checks.mjs` → `V19` (2026-11-11) | O ADR-001 não pode derivar a lista "dos presets" sem decidir **qual** é a fonte: exports (`SKILLS_BY_AXIS`/`RULES_BY_AXIS`) ou o inventário do `V19`. Escolher errado produz lista que nunca falha (verde-falso — R3 do PRD). |
| **R4** | **Duas entradas em `protectedPaths`, dois trailers.** `workflow-rules.md` (§5.1–5.4) e `sdd-workflow-standard.md` estão em `.agents/rules/**`; toda edição exige `Harness-Gate-Change` e revisão no CI. | `harness.config.json`; `gate-contract.md` (I9/ADR-007) | Custo de processo em **2 ADRs** (002 e provavelmente 003/005). Não é bloqueio, mas encarece o SDD: cada PR desses passa por gate de path protegido. |
| **R5** | **D4 remove 52 citações, inclusive a SSoT de segurança.** `security-engineer/AGENT.md:26` manda **"DEVE seguir rigorosamente"** `.agents/rules/security-standard.md` (ausente). Remover a citação sem substituto deixa o agente sem norma **e** sem o dever de seguir — o pior dos dois mundos que o PRD §13 descreve. | PRD §3.5/§13; `grep -rn "rules/security-standard.md" .agents` = 8 citações | O ADR-004 não pode tratar as 8 citações como as outras 44: ou **cria** a rule genérica de segurança, ou **reaponta** para o padrão que o `security-review` já aplica. "Remover" puro é o único veredito que colide com RF-04. |
| **R6** | **`license: TaskFlow Security Standard` é afirmação jurídica falsa num artefato distribuído.** A spec de skill diz que `license` é "license name or reference to a bundled license file" — campo **opcional**, não declaração de contrato de terceiro. | S4 (https://agentskills.io/specification, 2026-11-11); `security-review/SKILL.md:4` | O ADR-003 deve tratar isso como **A-1 de primeira ordem** (identidade), não como cosmético: o campo viaja para todo destino e afirma licença que ninguém concedeu. |
| **R7** | **Gatear por pasta (`AGENTS.md` aninhado) parece a solução e não é.** O padrão é real e escala (60k projetos, 88 arquivos num repo), mas resolve escopo **por diretório**, e o destino não tem diretório de stack previsível. | S9 (https://agents.md/, 2026-11-11); S8 (https://cursor.com/docs/context/rules, 2026-11-11) | Se algum ADR propuser isso, ele muda o **layout do destino** — decisão de produto do PRD-5/PRD-3, não deste ciclo. Registrar como inferência, não adotar. |

## 10. Fontes inacessíveis / candidatas descartadas antes do uso

- **Inacessível (declarada):** `https://textlint.github.io/docs/getting-started.html` respondeu HTTP 200 com
  **corpo vazio** em 2026-11-11 (conteúdo renderizado por JS). Não é citada como lida; o que se usa de textlint
  vem da homepage (S11), que abriu com conteúdo.
- **Descartadas antes da leitura (não citadas, não usadas):** `https://code.claude.com/docs/en/sub-agents`
  (abriu, mas o que interessa — restringir ferramentas por subagente — já está coberto por S1/S2 para o runtime
  que este repo usa); páginas de blog agregadoras sobre "prompt profiles", preteridas em favor de documentação
  oficial.
- Nenhuma outra fonte foi citada sem ter sido aberta e lida.

## 11. Notas de derivação (para o ADR-001 não nascer com número errado)

- **N1 — "52 citações" é a soma das 8 acionáveis**, não das 13 ausentes: `52` distribui-se em
  `backend-coding-standards` 16, `security-standard` 8, `backend-integration-tests` 7, `backend-unit-tests` 6,
  `db-migration-flyway` 4, `db-migration-liquibase` 3, `unit-testing-standards` 2, `exemplo` 1 (PRD §3.5).
  D4 manda remover as **52**, mas `exemplo.md` é string de exemplo (`C3` no ADR-005 do PRD-1) ⇒ o ADR-004
  precisa do veredito por path, não de um "remover tudo".
- **N2 — `V18` hoje está `PASS` com `baseline=7` e `non-defect=1`**, e o PRD §5-M-3 pede `baseline ≤ 1`. O
  ADR-004 herda 7 entradas a fechar, não 1.
- **N3 — `V19` imprime `axis=0` para skills.** Ver R3: a lista derivada do ADR-001 não pode assumir que hoje
  existe skill axis-gated.
