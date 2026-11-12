# PRD — Agnosticização de agentes, skills e rules

> **prd-id**: `prd-agnostic-artifacts` (casa com `.spec/prd/prd-agnostic-artifacts/`)
> **Dono da aprovação**: owner do harness
> **Status**: **rascunho** — aguarda o portão G1 (§16). Nenhum `ADRs/**` nasce antes do veredito (INV-3 de `.agents/rules/prd-adr-pipeline.md` §1).
> **Tipo de rota**: Refactor (programa multi-PRD `harness-refactor-2026-11`, ordem 2 — `workflow-state.json.program.prds[1]`)
> **Mapa das 16 seções**: §1, §2, §5, §6, §7, §9 e §16 são obrigatórias; §3, §4, §8, §10–§15 são recomendadas.
> **Item do owner neste PRD**: **4** — *"Deixar os agentes, skills e rules mais agnósticas, sem relacionamento com projetos."*
> **Herda** do PRD-1 `prd-harness-inventory` (fechado 2026-11-11, 5 ADRs merged, arquivado em `.spec/archive/20261111-prd-prd-harness-inventory/`): §3.5 (paths de rule ausentes), ADR-003 C4/N15 (autoria de `SPEC.md`/`PLAN.md`/`TASKS.md`), ADR-004 N30 (link-ref markdown), §13 (`frontend/DESIGN.md`) e `FU-47`.
> **Teto**: 5 ADRs neste PRD. Nenhuma decisão de **mecanismo** é tomada aqui (§7).

## 1. Problema [obrigatória]

O harness se instala em qualquer projeto, mas uma fração grande do que ele instala fala de **um** projeto e de **uma** stack que ele mesmo não usa. Medido em 2026-11-11 neste repo (comandos em §3.7): o payload propagado pelo instalador são **112 arquivos / 21.174 linhas**; **43 desses arquivos (8.245 linhas, 38,9% do payload)** citam um projeto do cliente por nome ou uma tecnologia que o harness não possui. `harness.config.json:13` declara `stack.backend`/`stack.frontend` = `N/A` com a justificativa de que "this repo has no Java/Maven backend and no Vue/Vite frontend" — e ainda assim rules e skills instaladas em **todo** destino prescrevem `JUnit`, `Mockito`, `MockMvc`, `mvn test`, `Vite`, `shadcn-vue`.

O acoplamento não é homogêneo, e tratá-lo como um número só produz repair errado. Ele aparece em **três classes** distintas (§3.2): (a) projeto do cliente citado por nome — `TaskFlow`, `Atlas ECM`, Design System `Pulse`; (b) stack que o harness não usa — Java/Maven/Spring/JUnit/Testcontainers/Flyway, Vuetify/PrimeVue/Remix/Lombok/MapStruct; (c) referência a artefato que não existe no destino — **13** paths de rule citados e ausentes (8 acionáveis) e `frontend/DESIGN.md` citado por 3 agentes.

O defeito não é estético. Três consequências medidas:

1. **A prosa manda obedecer o que não existe.** `security-engineer/AGENT.md:26` diz que o agente "**DEVE** seguir rigorosamente" `.agents/rules/security-standard.md`, declarada "padrão obrigatório de segurança **do TaskFlow**" — o arquivo não existe (0 `security-standard.md` em `.agents/rules/`, medido) e é a SSoT de segurança declarada do repo. `ux-designer/AGENT.md:32-34` e `design-system-specialist/AGENT.md:26` obrigam a respeitar o Design System `Pulse` em `frontend/DESIGN.md` — arquivo ausente neste repo e no destino genérico.
2. **O destino recebe instrução inaplicável em massa.** `developer-engineer/AGENT.md:41` prescreve "Frontend (Vue 3.5 + TypeScript 5.7 + PrimeVue)" sem condição; num destino Rust, Go ou Flutter a instrução não tem referente e o agente precisa decidir sozinho o que ignorar. É o sintoma que `FU-47` nomeia: "Em repo de tooling isso produz N/A em massa e regra inaplicável".
3. **Nenhum check cobre essa classe.** O único check chamado `hardcoded-project-literals` (`static-checks.mjs:317`) casa **dois** literais fixos — `/docker-compose-postgresql|-pl application/` — e não olha nome de projeto nem stack. Ele está `PASS 0` hoje, o que **não** significa que o repo esteja limpo: significa que o check não mede isto.

E o levantamento entregue como insumo deste PRD **subestima o problema**: ele nomeia 16 arquivos; a medição de hoje devolve **43** (delta de 27, §3.3). O maior acoplamento do repo não está entre os 16 — está em `workflow-rules.md` (609 linhas, 11 termos, **instalada em todo destino**), que prescreve `JUnit 5 + Mockito + AssertJ`, `Testcontainers + PostgreSQL real`, `MockMvc` e `mvn verify` como normas obrigatórias de teste (§5.1–§5.4, linhas 431–452). É a lição `FU-64` ("contar antes de filtrar") cobrando o preço outra vez.

> ❓ Validação: a dor existe hoje, é observável e não é uma preferência do agente? **Sim** — 43 arquivos, 8.245 linhas e 38,9% do payload medidos por comando declarado (§3.7), com o sítio mais grave identificado por `arquivo:linha` (§3.4). A consequência 3 mostra que o repo pode estar "verde" com o defeito intacto — o que é exatamente o motivo de o PRD existir.

## 2. Objetivo [obrigatória]

Tornar o payload do harness **agnóstico por critério verificável**, e não por adjetivo. O objetivo é um estado observável, expresso por três predicados avaliados sobre o que o instalador propaga (a definição completa está em §3.6):

- **A-1 — identidade**: nenhum arquivo propagado afirma que o destino *é* um projeto nomeado.
- **A-2 — prescrição**: nenhuma instrução depende de tecnologia que o destino não declarou. Instrução que precisa citar stack é **condicional a um eixo declarado** — o padrão que o próprio repo já pratica em `sdd-compiler/references/backend.md:53` ("**Spring Boot**: Use `ApplicationEventPublisher`…") e `:58` ("**NestJS**: Use CQRS module…"), e que `database.md:60` usa para "Flyway **or** Liquibase".
- **A-3 — referência**: nenhum arquivo propagado aponta para artefato que o destino não recebe.

Resultado observável: instalar o harness num destino cujo `harness.config.json` declara `stack: "outra"` produz um payload em que **0** arquivo nomeia projeto do cliente, **0** arquivo prescreve stack incondicional e **0** referência aponta para fora do payload — com as exceções **nomeadas e contadas**, nunca inferidas.

O objetivo **não** é "remover menções". Um arquivo que lista stacks suportados (`sdd-compiler/references/frontend.md:49-51`: "React: Radix/Shadcn/MUI. Vue: PrimeVue or Vuetify. Angular: Angular Material or PrimeNG") é **catálogo**, não acoplamento: a lista é o produto. Distinguir os dois casos é parte do objetivo, e por isso a definição de §3.6 mede **posição e tipo de frase**, não substring.

> ❓ Validação: o objetivo é mensurável e não é uma solução? **Sim** — três predicados, cada um com comando (§3.6/§3.7); nenhum deles diz *como* chegar lá (parametrizar, mover para perfil de eixo, reescrever ou remover é decisão de ADR, §7).

## 3. Contexto e evidências

### 3.1 População: o que o instalador realmente propaga

O acoplamento só importa se chega ao destino. A população é derivada **dos exports do instalador**, não de um `ls` no repo: `RULES_COMMON` (6) + `RULES_BY_AXIS` (2) + agentes registrados em `opencode.json` (10) + os diretórios de `SKILLS_COMMON` (22) e `SKILLS_BY_AXIS` (2), abertos recursivamente = **112 arquivos / 21.174 linhas** (comando M1 em §3.7).

Três recortes dessa população mudam a leitura do problema:

| Recorte | Nº | Por que importa |
|---|---|---|
| População propagada | **112 arquivos / 21.174 l.** | É o universo do critério A-1/A-2/A-3 |
| Com ≥1 termo da lista fechada, **dentro de `ui-ux-pro-max`** | **24 arquivos** | Catálogo multi-stack: a lista de stacks é o conteúdo (`data/stacks/*.csv`). **Não é acoplamento** — é o caso que uma métrica ingênua reprova e o PRD precisa proteger |
| Com ≥1 termo, **fora do catálogo** ("substantivos") | **43 arquivos / 8.245 l. (38,9% do payload)** | É o objeto deste PRD |

Duas assimetrias que o insumo não registra e que mudam a prioridade:

- **O acoplamento sempre-instalado é `workflow-rules.md`, não as rules de frontend.** As duas rules de frontend (`frontend-coding-standards.md` 188 l., `frontend-react-coding-standards.md` 194 l. = **382 l., 29,6% do corpo de rules**) são **gateadas por eixo** (`RULES_BY_AXIS`, `install.mjs:370-373`): um destino react não recebe a rule Vue e vice-versa. Já `workflow-rules.md` (609 l.) está em `RULES_COMMON` (`install.mjs:380-387`) e vai para **todo** destino — e é ela que prescreve a baseline Java de testes. O insumo aponta as 382 l. como "30% do corpo de rules"; a afirmação é verdadeira sobre o **repo-fonte** e enganosa sobre o **destino**.
- **Skills de stack por nome estão na lista comum.** `java-architecture-specialist`, `nestjs-architecture-specialist`, `rust-architecture-specialist`, `node-architecture-specialist`, `frontend-vue-specialist`, `frontend-react-specialist` estão em `SKILLS_COMMON` (`install.mjs:407-429`) — instalam em qualquer destino. Aqui o nome **declara** a stack, o que é honesto; o que não está declarado é *quando* a skill se aplica.

### 3.2 As três classes de acoplamento (nomenclatura canônica deste PRD)

| Classe | Definição operacional | Como se mede | Exemplos medidos |
|---|---|---|---|
| **(a) projeto do cliente citado por nome** | O arquivo afirma que o destino **é** um projeto específico de terceiro | termo de projeto em título, heading, `description:`/`license:` de frontmatter, ou em instrução de escopo ("neste projeto") | TaskFlow (10 arquivos), `Atlas ECM` (4), `taskflow` minúsculo como namespace de `brain_store` (5), Design System `Pulse` (3 skills de template + 3 agentes) |
| **(b) stack que o harness não usa** | O arquivo prescreve ou proíbe tecnologia que `harness.config.json` declara `N/A` | termo de stack em linha prescritiva **incondicional** | Java 13, Spring 12, Vue 20, Lombok 11, Vuetify 8, Flyway 8, Mockito 7, Liquibase 7, Maven 6, `mvn` 6, JUnit 6, PrimeVue 5, Remix 5, MapStruct 5, Testcontainers 5, Tailwind 5, shadcn 3, NestJS 3 |
| **(c) referência a artefato que não existe** | O arquivo aponta para path que o destino não recebe | `grep -rhoE "rules/[a-z0-9-]+\.md"` filtrado por ausência no disco | **20** paths citados, **13** ausentes; **8 acionáveis** (§3.5); + `frontend/DESIGN.md` |

As três classes **não se corrigem do mesmo jeito**: (a) é uma decisão de identidade (a quem o artefato pertence); (b) é uma decisão de parametrização; (c) é uma decisão de destino do ponteiro. Por isso o PRD as nomeia separadamente e §9 tem requisito por classe.

### 3.3 Delta: os 16 arquivos do insumo × os 43 medidos

Os 16 arquivos nomeados no insumo estão todos dentro dos 43 (verificado item a item). **27 arquivos ficaram de fora**, e são justamente os que o insumo não menciona terem sido filtrados:

| Grupo do delta (27) | Arquivos | Termos | Tipo de frase dominante |
|---|---|---|---|
| Rule sempre-instalada | `rules/workflow-rules.md` (609 l.) | Java, Spring, mvn, JUnit, Mockito, Testcontainers, Flyway, Lombok, MapStruct, Vue, NestJS | **prescritiva incondicional** (§5.1–5.4) + operacional (`mvn compile -pl`) |
| Skill de planejamento | `dev-planner/{SKILL.md 249, anti-patterns.md 457, workflow.md 512, questions-template.md 220}` | Java, Spring, Maven, Liquibase, JUnit, Mockito, Lombok | prescritiva (`SKILL.md:36` "Considere contexto real do projeto (Java EE 7, EJB, JSF, PostgreSQL)") + proibitiva (AP-020 "Usar Lombok") |
| Skill de compilação SDD | `sdd-compiler/{SKILL.md 149, asserts/spec-gate.md 23, asserts/verify-gate.md 49, references/backend.md 64, references/database.md 81, references/plan-template.md 91, references/fintech.md 59}` | mvn, Flyway, Java, Spring, NestJS, JUnit, Testcontainers | **mista** — `backend.md:53,58` e `database.md:60` são **condicionais** (padrão correto); `plan-template.md` usa a stack em modelo de plano (exemplo) |
| Skill de otimização de prompt | `prompt-optimizer/{SKILL.md 175, references/clarifying-questions.md 160}` | Lombok | exemplo + proibitiva ("Negação pura: 'não use Lombok'") |
| Skills de template | `template-{structure 141, best-practices 71, deepsearch 80}` | Pulse, Vue, React, Tailwind, shadcn | **prescritiva** — "ring âmbar (Pulse)", "classes/CSS vars do Pulse" = design system do cliente |
| Skills de stack por nome | `frontend-vue-specialist 213`, `frontend-react-specialist 180`, `java-architecture-specialist 133`, `nestjs-architecture-specialist 127` | Vue, React, Java, Spring, NestJS | identitária declarada (nome = eixo) |
| Board e feedback | `sdd-architecture-board 37`, `sdd-feedback/{SKILL.md 142, references/summary-template.md 97}` | Maven, Flyway | exemplo/prescritiva |
| Rule de config | `rules/harness-config.md` 96 l. | Java, Maven, Vue | **descritiva/N-A justificado** (`:13` declara a ausência de stack) — não é defeito |
| Agentes | `agents/design-system-specialist/AGENT.md` (Pulse), `agents/code-reviewer/PROMPT.md` (`:30` "listeners não removidos no Vue ou streams abertos no Flutter"; `:35` "XSS no Vue, SQLi no Spring"; `:61` "Java 21") | Pulse, Vue, Flutter, Spring, Java | **prescritiva condicional ao stack *presumido*** — o checklist do reviewer assume a stack do destino |

O delta muda duas conclusões: (i) o esforço não é "reescrever 2 rules de frontend + 1 skill", é **43 arquivos, e o mais custoso é uma rule de 609 linhas em `protectedPaths`**; (ii) `sdd-compiler/references/backend.md` já contém o **padrão correto** (prescrição condicionada por stack) — o PRD tem precedente interno, não precisa inventar modelo.

### 3.4 Tipo de frase: por que a classificação é o coração deste PRD

Proibição citando tecnologia e exemplo citando stack são **defeitos diferentes** com remediações diferentes. A taxonomia usada (6 tipos, aplicada linha a linha nos arquivos de §3.3):

| Tipo | Assinatura | Efeito no destino |
|---|---|---|
| **identitária** | título, heading, `description:`, `license:`, "no projeto X" | o artefato se apresenta como de outro projeto — **não editável por remoção pontual** |
| **prescritiva incondicional** | DEVE/NUNCA/USE/tabela de stack sem condição | instrução inaplicável; o agente decide sozinho ignorar |
| **prescritiva condicionada** | "**Spring Boot**: use…", "se `frontend=vue`…" | correta: o destino não declarado nunca ativa o ramo |
| **proibitiva** | "Proibido Lombok", "Vuetify é proibido" | proíbe o que o destino talvez nunca tenha tivesse; **posição declarada do repo** (ver abaixo) |
| **exemplo** | bloco `<context>`/`<acceptance>` de template, "ex.:" | ensina default errado ao artefato **gerado** |
| **catálogo** | lista de stacks suportados | não é acoplamento |

**Os 16 arquivos do insumo, um por um:**

| # | Arquivo | Termos externos | Tipo de frase (sítio) | Classe | O que isso implica |
|---|---|---|---|---|---|
| 1 | `agents/developer-engineer/AGENT.md` (144 l.) | TaskFlow, PrimeVue, Remix, Lombok, MapStruct, Java, mvn, Mockito, Spring, Flyway, Vue | **identitária** (`:1`, `:25`) + **prescritiva** (`:5`, `:41`) + **proibitiva** (`:29`, `:36`, `:50`, `:98`, `:101`) | a + b | O papel chega ao destino já dentro da stack e do domínio do cliente; num destino não-Java/não-Vue, 11 termos em 6 linhas prescritivas ficam sem referente |
| 2 | `agents/orchestrator/AGENT.md` (682 l.) | taskflow, Lombok, mvn, Mockito, Flyway, Vue | **operacional** (`:200` `curl …/taskflow/v1/auth/login`) + **prescritiva** (`:295`, `:427`, `:428`, `:469`, `:470` namespace `taskflow/` de `brain_store`) + **proibitiva** (`:338`, `:611`) | a + b | O primário único manda gravar memória de longo prazo sob prefixo `taskflow/` no brain **do destino** — acoplamento que vira dado persistente do adotante |
| 3 | `agents/security-engineer/AGENT.md` (136 l.) | TaskFlow | **prescritiva + referência ausente na mesma frase** (`:26`: "DEVE seguir … `security-standard.md` — padrão obrigatório … do TaskFlow") | a + c | A SSoT de segurança declarada do harness **não existe** e é prescrita como obrigatória; a classe (a) e a (c) se somam no mesmo período |
| 4 | `agents/ux-designer/AGENT.md` (309 l.) | TaskFlow, Vuetify, PrimeVue, Vue | **identitária** (`:32` heading) + **prescritiva** (`:34` "**TODO** desenho DEVE respeitar" Pulse) + **exemplo** (`:147`) | a + b + c | UX obrigado a obedecer design system inexistente; `:147` cita a stack como justificativa de padrão |
| 5 | `rules/frontend-coding-standards.md` (188 l.) | TaskFlow, taskflow, Atlas ECM, Vuetify, PrimeVue, shadcn, Vue, Tailwind | **identitária** (`:3` "frontend Atlas ECM") + **prescritiva** (tabela `:11-14`) + **proibitiva** (`:5`, `:12`, `:135`) | a + b | A rule inteira é a stack de **um** cliente, não "frontend Vue em geral". Gateada por eixo (não vai a todo destino), mas é 188 l. de conteúdo não-portável |
| 6 | `rules/frontend-react-coding-standards.md` (194 l.) | taskflow, Atlas ECM, Vuetify, PrimeVue, shadcn, Vue, Tailwind | idêntica à #5 (`:3`, `:5`, `:12`, `:142`) | a + b | Espelho React da mesma dívida; juntas **382 l. = 29,6%** do corpo de rules do repo-fonte |
| 7 | `rules/sdd-workflow-standard.md` (50 l.) | Atlas ECM (`:3`) | **prescritiva** — escopo da norma ("para todo o ciclo de vida … **no projeto Atlas ECM**") | a | Está em `RULES_COMMON`: **instalada em todo destino**. 1 termo, alcance máximo — a correção mais barata do PRD |
| 8 | `skills/harness-installer/SKILL.md` (381 l.) | Vuetify, Lombok, Maven, Vue, Dart, Flutter | **justificativa declarada** (`:161-164`: "rules/skills do harness, que citam Vuetify/Lombok/… **para bani-los**, instalam em destino limpo sem falso-positivo") | b | **O repo tem posição escrita de que a proibição é segura.** Não é achado a corrigir: é decisão do owner confirmar ou derrubar (§16-D2) |
| 9 | `skills/prompt-optimizer/references/picco-template.md` (177 l.) | Atlas ECM, Lombok, mvn | **exemplo** (`:58`, `:117` "Projeto: Atlas ECM"; `:72` "mvn test passa"; `:136` "Não use Lombok") | a + b | Dano no **artefato gerado**: todo ciclo que usa o template herda "Atlas ECM" como default do bloco `<context>` |
| 10 | `skills/sdd-compiler/references/frontend.md` (62 l.) | Vuetify, PrimeVue, Java, Vue, Tailwind | **catálogo** (`:49-51`) | — | **Não é acoplamento.** Lista de opções por stack. Proteger da métrica (§3.6, exceção E-2) |
| 11 | `skills/security-review/SKILL.md` (219 l.) | TaskFlow | **identitária no frontmatter** (`:3` description; `:4` `license: TaskFlow Security Standard`) | a + c | A `description` é o gatilho de descoberta da skill — ela se anuncia como "a skill do TaskFlow". O campo `license:` declara licença de terceiro que não licenciou nada (achado de §13) |
| 12 | `skills/spec-review/SKILL.md` (226 l.) | TaskFlow, taskflow, Vuetify, Remix, Lombok, MapStruct, Maven, JUnit, Mockito, Spring, Testcontainers, Flyway, Liquibase, Vue | **identitária** (`:3`, `:9` "# Revisor de Specifications — TaskFlow") + **prescritiva** (`:11` "SPEC.md do **TaskFlow** (Spring Boot 3.5 + Vue 3)") | a + b + c | A skill **é** de outro projeto |
| 13 | `skills/spec-review/README.md` (304 l.) | 13 termos | idem #12 | a + b + c | idem |
| 14 | `skills/spec-review/assets/checklist.md` (188 l.) | 12 termos | **checklist normativa** (cada item carrega a stack) | a + b + c | O produto da skill é o relatório: cada item do checklist é stack-bound |
| 15 | `skills/spec-review/assets/output-template.md` (275 l.) | TaskFlow, Remix, Liquibase, Vue | identitária/exemplo | a + b | idem |
| 16 | `skills/spec-review/assets/usage-guide.md` (310 l.) | TaskFlow, Spring, Liquibase, Vue | identificária/prescritiva | a + b | idem |

> **#12–#16 juntos**: 5 de 5 arquivos, **1.303 linhas**, **100% da skill**. Não é "prosa com menção" — é o conteúdo. A remediação não é edição pontual (§16-D3).

### 3.5 Heranças do PRD-1 que este PRD precisa fechar

| Herança | Origem medida | Estado hoje (2026-11-11) |
|---|---|---|
| **Paths de rule ausentes** | PRD-1 §3.5 + ADR-005 (classes C1/C2) | **20** paths citados, **13** ausentes. **8 acionáveis**: `backend-coding-standards` (16 citações/14 arquivos), `security-standard` (8/5), `backend-integration-tests` (7/7), `backend-unit-tests` (6/6), `db-migration-flyway` (4/4), `db-migration-liquibase` (3/3), `unit-testing-standards` (2/2), `exemplo` (1/1). Os outros 5 são vendor-internal (declarados não-defeito; `V18` conta `non-defect=1` + `baseline=7`) |
| **`frontend/DESIGN.md` (Pulse)** | PRD-1 §13 | Ausente no disco (medido) e citado por **3** agentes (`design-system-specialist`, `orchestrator`, `ux-designer`) |
| **Autoria de `SPEC.md`/`PLAN.md`/`TASKS.md`** | ADR-003 C4/N15 | **Contradição viva.** O `orchestrator` é `primary` com `permission.edit = "deny"` (medido em `opencode.json`) e a prosa atribui a ele a geração: `workflow-rules.md:214-215` ("Gerar PLAN… Gerar TASKS") e `sdd-workflow-standard.md:16-18` ("gerada pelo `sdd-compiler`" — uma **skill**, que roda na sessão do chamador e não tem sessão própria). Resultado: os 3 artefatos centrais não têm autor que possa escrever |
| **Link-ref `[//]: #`** | ADR-004 N30 | O mecanismo de citação **não** escapa link-ref markdown, então `[//]: # (skill)` compraria um `consumer` falso. Medido hoje: **0 ocorrências** em `.agents/` — buraco **latente**, não incidente. O PRD exige que 0 seja *medido* por check, não presumido |
| **`FU-47`** (tech-debt, dono `tech-debt governance-stack-bound-rules`) | review do SPEC `harness-eixos-stack` | Dívida aberta: "Skill `spec-review` e `.agents/rules/frontend-coding-standards.md` são stack-bound a outros projetos… Em repo de tooling isso produz N/A em massa" |

### 3.6 Definição observável de "agnóstico" — Critério do Destino Limpo (CDL)

"Agnoóstico" é adjetivo; o PRD fixa três predicados, avaliados sobre a **população propagada** (§3.1) e não sobre o repo. O recorte é deliberado: `scripts/`, `__tests__/` e fixtures **podem** citar stack — é dado de teste, e a lição `FU-32` mostra o custo de um canário que reprova a prosa do próprio harness.

| Predicado | Enunciado verificável | Comando/leitura | Baseline hoje |
|---|---|---|---|
| **A-1** identidade | 0 arquivo do payload tem termo de projeto do cliente em posição identitária (linha `#`, heading, `description:`, `license:`, ou "no projeto X") | varredura das linhas de título/heading/frontmatter da população | **11 arquivos** |
| **A-2** prescrição | 0 instrução depende de tecnologia **não declarada** pelo destino. Instrução que cita stack precisa ser (i) condicional a eixo declarado, (ii) exemplo explicitamente não-normativo, ou (iii) catálogo de opções | por arquivo: cada linha prescritiva com termo de stack recebe veredito `condicional` \| `exemplo` \| `catálogo` \| `incondicional` | **43 arquivos** com ≥1 termo; heurística de linha prescritiva acusa **15 arquivos** (piso — a heurística superestima: `backend.md:53` casa "MUST" + "Java" na mesma linha sendo o padrão **correto**) |
| **A-3** referência | 0 referência a artefato que o destino não recebe | `grep -rhoE "rules/[a-z0-9-]+\.md"` × disco; `V18` do `static-checks.mjs` | **13** paths ausentes (8 acionáveis) + `DESIGN.md` em 3 agentes |

**Por que isso é verificável e não retórica:**

1. Cada predicado é função de **entradas declaradas**: a população vem dos exports do instalador (M1), a lista de termos é fechada e escrita em §3.4, as exceções são nomeadas (abaixo). Nada depende de julgamento no momento da medição.
2. **A-2 é binário por linha**, não por arquivo: a mesma linha é `condicional` ou `incondicional` — e o repo já tem o exemplo do caso correto (`backend.md:53,58`) para calibrar.
3. A-3 **já roda** (`V18` PASS com `baseline=7`): o predicado não precisa ser inventado, só levado a zero.
4. É **neutro quanto ao mecanismo**: remover, gatear por eixo, parametrizar por perfil ou separar em arquivo de stack — todas satisfazem o critério igualmente. É exatamente o que o PRD exige que o ADR decida (§7).

**Exceções declaradas (nomeadas, contadas, não inferidas):**

- **E-1 — catálogo multi-stack**: `ui-ux-pro-max` (24 arquivos) e `sdd-compiler/references/frontend.md` (`:49-51`). A lista de stacks é o conteúdo.
- **E-2 — N/A justificado inline**: `rules/harness-config.md:13` cita Java/Maven/Vue **para declarar que não existem**. É o oposto do defeito.
- **E-3 — identidade por design**: skills cujo **nome** declara a stack (`java-architecture-specialist`, `nestjs-architecture-specialist`, `rust-architecture-specialist`, `node-architecture-specialist`, `frontend-vue-specialist`, `frontend-react-specialist`). A definir no ADR se permanecem em `SKILLS_COMMON` ou passam a eixo (§16-D7).
- **E-4 — dado de teste/fixture**: `scripts/`, `.opencode/plugins/__tests__/`, `harness/`. Fora da população por construção.

**Falsos positivos que a definição precisa repelar** (medidos nesta análise, para não virarem dívida por engano): `Pulse` em `ui-ux-pro-max/data/*.csv` é nome de estilo/animação, não o design system; `Java` em `ui-ux-pro-max/data/stacks/react.csv` é a coluna de stacks suportados; `Spring` em `backend.md:53` é prescrição **condicionada**.

### 3.7 Comandos que produziram os números

Todas as medições são de **2026-11-11**, pós-merge `2c314de`, neste repo. `A=".agents"` nos scripts.

- **M1 — população**: leitura de `installer/install.mjs` (`RULES_COMMON`, `RULES_BY_AXIS`, `SKILLS_COMMON`, `SKILLS_BY_AXIS`) + `opencode.json.agent[*].prompt` + abertura recursiva dos diretórios → **112 arquivos / 21.174 linhas**.
- **M2 — acoplamento**: `terms=[TaskFlow,taskflow,"Atlas ECM",Vuetify,PrimeVue,Remix,Lombok,MapStruct,Java,Maven,"mvn ",JUnit,Mockito,Spring,Testcontainers,Flyway,Liquibase,Vue,Tailwind,shadcn,NestJS]`; `includes` por arquivo da população → **67** com ≥1 termo; **24** em `ui-ux-pro-max`; **43** substantivos (**8.245 l.**).
- **M3 — contagem por termo** (sobre os 43): TaskFlow 10, Lombok 11, Java 13, Spring 12, Vue 20, Vuetify 8, PrimeVue 5, Remix 5, MapStruct 5, Atlas ECM 4, Flyway 8, Liquibase 7, Mockito 7, Maven 6, `mvn` 6, JUnit 6, Testcontainers 5, Tailwind 5, shadcn 3, NestJS 3, taskflow 5.
- **M4 — A-1**: varredura de `#`/heading/`description:`/`license:` com termo de projeto → **11 arquivos**.
- **M5 — rules**: `wc -l .agents/rules/*.md` → **8 arquivos**; total do glob **1.288** (soma por arquivo **1.289** — um arquivo sem newline final); `RULES_COMMON` 6 arquivos = **907 l.**; gateadas por eixo = **382 l. (29,6%)**.
- **M6 — classe (c)**: `grep -rhoE "rules/[a-z0-9-]+\.md" .agents | sort -u` → **20** distintos; ausentes no disco → **13**; acionáveis **8** com 16/8/7/6/4/3/2/1 citações e 14/5/7/6/4/3/2/1 arquivos. `ls frontend/DESIGN.md` → ENOENT; citado por 3 agentes.
- **M7 — N30**: `grep -rIl "\[//\]: #" .agents` → **0**.
- **M8 — cobertura de check**: `sed -n '313,320p' scripts/static-checks.mjs` → `V3` casa `/docker-compose-postgresql|-pl application/`.
- **M9 — suíte**: `node scripts/static-checks.mjs` → exit **0**, `PRD-01` PASS, `V18` `baseline=7`, `V19` `skills=48 (vendor-by-axis=25, consumer=22, orphan=1)`, `rules=8 (consumer=7, axis=1)`.

> ❓ Validação: cada afirmação de problema tem lastro `arquivo:linha` ou comando declarado? **Sim** — §3.1–§3.5 com M1–M9 na mesma seção; o delta de 27 arquivos (§3.3) é explicitamente uma correção do insumo, com a mesma régua que corrigiu `FU-64`.

## 4. Público e impacto

- **Owner do harness** — ganha um critério para decidir "isto é agnóstico?" sem reler 21 mil linhas; hoje a decisão é feita caso a caso, no arquivo que apareceu no review.
- **Projeto-destino** — recebe payload cuja prosa é aplicável. Hoje herda prescrição de `mvn test` num repo Rust, `Pulse` num destino sem design system e namespace `taskflow/` no brain — sem aviso.
- **Agente de IA em runtime** — é quem obedece a prosa. Instrução inaplicável consome contexto e produz N/A declarado em massa; instrução *errada* (stack do cliente) produz trabalho errado. `FU-47` já registrou o sintoma.
- **Revisor / auditor** — passa a auditar por predicado (A-1/A-2/A-3) e por comando, em vez de julgar parágrafo.
- **PRDs 3–6** — o PRD 3 (instalador Rust) precisa saber qual é o payload correto para reproduzi-lo; o PRD 5 (frontend fusion) disputa `DESIGN.md`/`Pulse` com este ciclo (§12).

## 5. Métricas de sucesso [obrigatória]

| Métrica | Como medir | Meta |
|---|---|---|
| **M-1** Arquivos do payload com acoplamento identitário (A-1) | varredura de título/heading/frontmatter com termo de projeto (M4) | **0** (baseline **11**) |
| **M-2** Arquivos com prescrição **incondicional** que presume stack (A-2) | por arquivo dos 43: cada linha prescritiva com termo recebe `condicional`/`exemplo`/`catálogo`/`incondicional`; instrumento fixado no ADR | **0** linhas `incondicional` fora das exceções E-1..E-3 (baseline: 43 arquivos com termo; 15 por heurística-piso) |
| **M-3** Referências vivas a artefato não recebido (A-3) | `node scripts/static-checks.mjs` → `V18` + `grep -rhoE` × disco | `V18` **baseline ≤ 1** (só `exemplo.md`, string de exemplo declarada) e **0** `DESIGN.md` |
| **M-4** Linhas do payload sob acoplamento substantivo | soma das linhas dos arquivos que sobram com termo **após** as exceções declaradas em §6 | **0 linha não declarada como exceção** (baseline **8.245** sem exceção nomeada) |
| **M-5** Heranças do PRD-1 fechadas | checklist de §3.5, um veredito por herança, com `arquivo:linha` | **5/5** |
| **M-6** Skills de stack declaradas por eixo | `node -e` sobre `SKILLS_COMMON` × lista de skills de stack | decisão do §16-D7 registrada e aplicada: 0 skill de stack indiferenciada em `SKILLS_COMMON` (baseline 6) |
| **M-7** Suíte completa verde no ciclo | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` **e** `node scripts/static-checks.mjs` | exit **0**, sem regressão de `V18`/`V19`/`PRD-01` |
| **M-8** Todo número publicado neste PRD é re-derivável | reexecutar M1–M9 de §3.7 e comparar; divergência = drift a registrar, nunca a esconder | **8/8** comandos reproduzem |

> ❓ Validação: ao menos uma métrica tem a coluna "como medir" preenchida? **Sim** — as 8 têm comando ou leitura declarada, e todas citam o baseline medido hoje.

## 6. Escopo [obrigatória]

- **Fixar o critério CDL** (§3.6) como a definição operacional de "agnóstico", com os 3 predicados, a população, as exceções nomeadas e a lista fechada de termos. *Aceite*: os 3 predicados escritos com comando; cada exceção com nome e razão; zero predicado sem instrumento.
- **Fechar as 3 classes nos 43 arquivos substantivos** (§3.3/§3.4): cada arquivo recebe veredito por sítio — classe (a) removida/reatribuída, classe (b) tornada condicional ou marcada exemplo/catálogo, classe (c) reapontada. *Aceite*: **43/43** arquivos com veredito e nenhum "TBD"; M-1 = 0.
- **A rule sempre-instalada tem prioridade declarada**: `rules/workflow-rules.md` (§5.1–5.4) e `rules/sdd-workflow-standard.md:3` são as duas entradas de maior alcance (vão a **todo** destino, `RULES_COMMON`). *Aceite*: as duas aparecem com veredito e com a justificativa de alcance.
- **Skills de stack e catálogo**: classificar `ui-ux-pro-max` (24 arq.) e `sdd-compiler/references/frontend.md` como catálogo (E-1); decidir o destino das 6 skills de stack por nome em `SKILLS_COMMON` (§16-D7). *Aceite*: 0 arquivo de catálogo contado como acoplamento; decisão de eixo registrada.
- **`spec-review`** (5 arquivos, 1.303 l., 100% da skill): destino decidido — reescrita genérica, remoção, ou rotulagem como skill de projeto fora do payload comum (§16-D3). *Aceite*: a skill não fica no limbo; se ficar, fica com rótulo e com `description` sem nome de cliente.
- **Heranças de §3.5 fechadas**: 8 paths acionáveis + `DESIGN.md` + autoria de `SPEC`/`PLAN`/`TASKS` + N30. *Aceite*: 5/5 vereditos com `arquivo:linha`.
- **Este PRD não altera código, config, regra, skill, agente, `opencode.json` nem `workflow-state.json`** — define problema, critério, escopo e métricas para os ADRs. *Aceite*: `git status` do ciclo mostra apenas `.spec/prd/prd-agnostic-artifacts/`.

> ❓ Validação: o escopo é fechado o bastante para caber em até 5 ADRs? **Sim** — 3 eixos de decisão: (i) o critério e seu instrumento; (ii) as 43 correções por classe; (iii) as 5 heranças do PRD-1. Fatiamento em §16.

## 7. NÃO entra [obrigatória]

- **Mecanismo de solução — é do ADR, não do PRD.** Parametrizar por perfil de stack, mover conteúdo para artefato gateado por eixo, converter rule em template com variável, criar arquivo por stack, ou simplesmente remover: **nenhuma** dessas é decidida aqui. O PRD fixa o critério; o ADR escolhe o caminho.
- **PRD 3 — `prd-installer-rust` (ordem 3)**: CLI Rust, reescrita do instalador, paridade dos 12 presets, TUI, item 6 do owner ("instalação sem invenção"). Nenhuma alteração em `installer/install.mjs` neste ciclo — inclusive `RULES_BY_AXIS`/`SKILLS_BY_AXIS`/`SKILLS_COMMON`: este PRD **decide** o destino dos artefatos; **mover** é do PRD 3 se exigir mapa novo.
- **PRD 4 — `prd-axes-split` (ordem 4)**: separação backend/frontend sem combo, perfis `go`/`rust` (`FU-46`), mobile Flutter/Dart (`FU-53`). Se a solução de §9 exigir eixo novo, ele nasce lá.
- **PRD 5 — `prd-frontend-harness-fusion` (ordem 5)**: incorporar o harness de frontend. `DESIGN.md`/`Pulse` é **disputado** pelos dois ciclos: aqui só se decide se o ponteiro ausente sai, é reapontado ou vira dívida com dono; o design system em si é do PRD 5 (§16-D5).
- **PRD 6 — `prd-forge-integration` (ordem 6)**: commit/push/PR/issues em forge.
- **O que NÃO muda neste ciclo, por decisão explícita:**
  - **`gate.js`** — byte-idêntico. Nenhum `DenyError` novo, nenhum branch por papel, nenhuma lista de termo virando gate. O critério CDL é **medição**, não deny (prosa descreve, runtime nega — `gate-contract.md`).
  - **`harness.config.json`** — nenhuma chave nova, nenhuma alteração de `stack`/`modules`/`gates`/`protectedPaths`.
  - **O selo** — `commands.suiteFull` não muda; logo `HARNESS_SEAL_JSON` **não** é republicado (`harness-config.md` §"Command seal"). Se algum ADR precisar de comando novo, isso é declarado como custo no ADR, não como efeito colateral.
  - **`opencode.json`** — o roster de 10 agentes não muda (fechado no ADR-001 do PRD-1).
  - **Vendor**: as 25 skills vendorizadas não são editadas — `scripts/vendor-skills.mjs --check` depende dos hashes (`ADR-003` do ciclo `harness-eixos-stack`).
- **Não-objetivos**: apagar skills/rules por "não ter consumidor" (é assunto do `V19`/ADR-004 do PRD-1); traduzir prosa para inglês; reescrever `workflow-rules.md` inteira por estilo; criar check que reprove fixture de teste; proibir termo em `.md` de `docs/` ou `harness/`.

> ❓ Validação: o que não entra está declarado, não inferido? **Sim** — 4 PRDs irmãos nomeados com ordem medida em `workflow-state.json.program.prds`, 4 invariantes de "não muda" (`gate.js`, `harness.config.json`, selo, `opencode.json`) e 4 não-objetivos.

## 8. Riscos e mitigação

| # | Risco | Evidência | Mitigação |
|---|---|---|---|
| **R1** | **Remover proibição reduz proteção.** "Proibido Lombok/Vuetify" existe porque o check de destino limpo reprovava com eles como baseline (`FU-32`); apagar o termo pode apagar o efeito pretendido | `harness-installer/SKILL.md:161-164` declara a posição; `FU-32`/`FU-26` registram o histórico | RF-04: proibição só sai com critério escrito e decisão do owner (§16-D2). Nenhum ADR pode remover proibição por conveniência |
| **R2** | **"Agnóstico" vira "vazio".** Rule genérica demais perde utilidade e o agente volta a improvisar | O contraexemplo está no repo: `sdd-compiler/references/backend.md` é genérico **e** prescritivo (Hexagonal, DDD, outbox) porque condiciona a stack | M-2 mede `incondicional`, não "presença de termo": um arquivo pode citar 5 stacks desde que condicione. §3.6 explicitamente protege catálogo e condicional |
| **R3** | **Verde-falso por lista fechada de termos.** Termo novo (`Svelte`, `Go`, `Rails`, `Prisma`) não está em §3.4 e o check passa | Hoje os 21 termos cobrem os presets existentes; um preset novo escapa | RF-09 exige que a lista e a população sejam **derivadas de fonte declarada** (exports do instalador/presets), não digitadas; adicionar preset precisa obrigar a lista a mudar — mecanismo no ADR |
| **R4** | **`workflow-rules.md` é `protectedPaths`.** 609 linhas, citada por `gate-contract.md`, com §5 (H1–H7) como fonte da verdade do harness | `harness.config.json` lista `.agents/rules/**`; `FU-66` registra o trailer obrigatório | O SDD do ADR que tocar a rule carrega trailer `Harness-Gate-Change` e passa pelo CI. Não é bloqueio: é custo declarado (M-7) |
| **R5** | **Colisão com o PRD 5.** `DESIGN.md`/`Pulse` é reivindicado pelos dois ciclos; decidir "o design system é X" aqui invade escopo alheio | PRD-1 §13 + 3 agentes citando o arquivo | §7 fixa a fronteira: aqui só o **ponteiro** (sai/reatribui/dívida); o conteúdo é do PRD 5 (§16-D5) |
| **R6** | **`spec-review` é o único revisor de SPEC e está na esteira.** `workflow-rules.md` §4 passo 2 e 4 mandam invocá-la | `grep` de `spec-review` em `workflow-rules.md` | Remoção exige reescrever a invocação na mesma entrega. §16-D3 oferece as 3 saídas, todas com a chamada preservada |
| **R7** | **Reescrita em massa vira review impossível.** 43 arquivos / 8.245 linhas num PR | Medição M1/M2 | Fatiamento por classe e por alcance: primeiro os 2 sempre-instalados (menor superfície, maior efeito), depois skills comuns, depois eixo, depois `spec-review` |

## 9. Requisitos funcionais [obrigatória]

- **RF-01** *(origem: item 4 do owner + `FU-47`)* — Adotar o **CDL** (§3.6) como definição única de "agnóstico", com A-1/A-2/A-3, população, exceções nomeadas e lista fechada de termos. *Verificável*: 3 predicados, cada um com comando; 3 exceções + 1 de escopo, cada uma com nome e razão; 0 predicado sem instrumento; M-8 reproduz os números.
- **RF-02** *(origem: item 4 + medição M4)* — Classe (a): **0** arquivo do payload com termo de projeto em posição identitária. *Verificável*: M-1 = 0 (baseline **11**, nomeados em §3.4 e no delta de §3.3).
- **RF-03** *(origem: item 4 + `FU-47`)* — Classe (b): cada um dos **43** arquivos substantivos recebe veredito por sítio (`condicional` | `exemplo` | `catálogo` | `removido` | `incondicional→condicional`), com `arquivo:linha`. *Verificável*: 43/43 vereditos; 0 linha `incondicional` remanescente fora de E-1..E-3; preferência declarada para os 2 arquivos de `RULES_COMMON` (`workflow-rules.md`, `sdd-workflow-standard.md`).
- **RF-04** *(origem: `harness-installer/SKILL.md:161-164`)* — Proibições que citam tecnologia: o critério "proibição de tecnologia alheia é segura em destino limpo" é **confirmado por escrito com a condição que o sustenta** ou revisto. *Verificável*: 1 decisão registrada (§16-D2) + 1 frase de critério na norma; se revista, as proibições afetadas têm veredito individual e nenhuma perde efeito sem substituto positivo.
- **RF-05** *(origem: PRD-1 §3.5 + ADR-005)* — Classe (c): os **8** paths acionáveis recebem destino final (criar / reapontar / remover citação) e `frontend/DESIGN.md` idem. *Verificável*: `V18` `baseline ≤ 1` e `DESIGN.md` = 0 citações; 9/9 vereditos (8 paths + DESIGN.md) com `arquivo:linha`.
- **RF-06** *(origem: ADR-003 C4/N15)* — Autoria de `SPEC.md`/`PLAN.md`/`TASKS.md`: declarar **quem escreve**, coerente com `permission.edit` de `opencode.json`, e alinhar a prosa de `workflow-rules.md:214-215` e `sdd-workflow-standard.md:16-18`. *Verificável*: 1 autor nomeado por path; `grep` da prosa não atribui a geração a papel com `edit: deny`; RSS: se o autor for agente, está registrado em `opencode.json` com `edit: allow`.
- **RF-07** *(origem: ADR-004 N30)* — A forma de citação que o inventário conta não pode ser comprável por link-ref markdown: **0** ocorrência hoje precisa ser **medida** por check, não presumida. *Verificável*: check novo (ou extensão) que reprova `[//]: # (…)` contendo nome de skill; `V19` mantém `consumer` idêntico antes/depois.
- **RF-08** *(origem: `FU-47`)* — `spec-review` deixa de ser stack-bound: os 5 arquivos (**1.303 l.**) têm veredito e a `description` (`SKILL.md:3`) não nomeia projeto. *Verificável*: 5/5 vereditos; `grep -c "TaskFlow"` no diretório = **0**; `workflow-rules.md` continua invocando a skill (chamada preservada).
- **RF-09** *(origem: `FU-64` + item 4)* — População e lista de termos são **derivadas**, nunca digitadas: a fonte da população são os exports do instalador; a da lista, os presets/eixos declarados. *Verificável*: script que falha quando um preset novo não aparece na lista (fixture vermelha obrigatória, padrão dos checks do repo).
- **RF-10** *(origem: harness §5 H1/H2 + §7)* — A revisão não quebra o repo e não muda invariante: `gate.js` e `harness.config.json` byte-idênticos, selo não republicado, `opencode.json` sem mudança de roster. *Verificável*: `git diff --stat` dos 2 arquivos = vazio; selo `sha256` inalterado; suíte exit 0; `V18`/`V19`/`PRD-01` PASS.

> ❓ Validação: cada requisito é verificável por um teste? **Sim** — 10/10 têm comando, contagem ou checklist com item obrigatório; RF-02/03/05 carregam baseline numérico para que "melhorou" não seja auto-declarado.

## 10. Histórias de usuário

- Dado um destino recém-instalado com `harness.config.json.stack = "outra"`, Quando o agente lê qualquer rule ou skill propagada, Então ele não encontra nome de projeto do cliente em título, description ou instrução de escopo — M-1 = 0.
- Dado um destino Rust, Quando o agente lê a regra de testes propagada, Então a prescrição de teste é condicional ("se backend Java…", "se Node…") ou não existe, em vez de `JUnit 5 + Testcontainers + mvn verify` como norma incondicional.
- Dado o `security-engineer` recém-instalado, Quando ele procura a SSoT de segurança que o próprio prompt declara obrigatória, Então ou o arquivo existe no destino, ou a referência foi reapontada/removida — nunca a promessa silenciosa de hoje (`AGENT.md:26`).
- Dado o `orchestrator` com `permission.edit = "deny"`, Quando a esteira chega na geração de `PLAN.md`, Então existe um autor nomeado que pode escrever, e a prosa não manda o orquestrador gerar o arquivo.
- Dado o owner revisando um PR de agnosticização, Quando ele abre o relatório do ciclo, Então obtém por arquivo: classe, tipo de frase, veredito e linha — e consegue discordar de um caso sem refazer a medição.
- Dado um preset novo adicionado ao instalador, Quando a suíte roda, Então o critério acusa que a lista de termos/população não cobre o preset, em vez de ficar verde por omissão.

## 11. UX / experiência

Sem tela. A experiência é de **leitura e decisão**, e o critério precisa ser legível para três leitores diferentes:

1. **O agente em runtime** — não consegue "decidir se aplica". Instrução condicional precisa **mostrar a condição** no começo (padrão `references/backend.md:53`: "**Spring Boot**: Use…"), não no fim. Instrução condicional cuja condição está implícita é pior que prosa nenhuma: parece aplicável.
2. **O owner** — precisa ver o estado "não declarado" de forma barulhenta. `harness-config.md:13` é o padrão da casa: `N/A` **com a justificativa inline**. O PRD herda isso: exceção sem razão escrita é dívida disfarçada.
3. **O projeto-destino** — o que ele recebe precisa ser lido sem saber que existe um harness de origem. Um destino que abre `SKILL.md` e lê "Security review … TaskFlow security-standard" conclui corretamente que instalou a coisa errada.

Erro clássico a evitar: **trocar nome de projeto por placeholder vago** ("o projeto", "sua stack") — resolve A-1 no medidor e piora a prosa. `FU-47` nomeia o outro extremo: `N/A` em massa. O alvo é o meio já demonstrado no repo: prescrição real, condicionada a eixo declarado.

## 12. Dependências e relações com os PRDs irmãos

- **Depende de**: PRD-1 `prd-harness-inventory` (**fechado** 2026-11-11; 5 ADRs merged, arquivado). Herda §3.5, ADR-003 C4/N15, ADR-004 N30, §13 e `FU-47` (§3.5). Depende também de `opencode.json` (roster de 10 agentes) e dos exports de `installer/install.mjs` como fonte da população.
- **Bloqueia**: PRD 3 (`prd-installer-rust`) — o instalador a reproduzir precisa saber qual payload é o correto, e mover artefato pode exigir mapa novo; PRD 5 (`prd-frontend-harness-fusion`) — a decisão sobre o ponteiro `DESIGN.md`/`Pulse` precede a fusão do harness de frontend; PRD 4 (`prd-axes-split`) — se a agnosticização depender de eixo novo, o eixo nasce lá e o mapa de exclusão muda.
- **Relação com os irmãos** (ordem medida em `workflow-state.json.program.prds`): 1 `prd-harness-inventory` (archived), 3 `prd-installer-rust`, 4 `prd-axes-split`, 5 `prd-frontend-harness-fusion`, 6 `prd-forge-integration`.
- **Ferramentas que este PRD usa e não altera**: `scripts/static-checks.mjs` (checks `V18`/`V19`/`PRD-01`) e o módulo `.opencode/plugins/lib/prd-adr-pipeline/checks.mjs` (ADR-002 do PRD-1). `commands.suiteFull` intacto — selo intacto.

## 13. Segurança

- **Superfície nova: nenhuma.** Nenhum tool, plugin, gate, permissão ou endpoint. O critério CDL é medição estática em arquivo de repositório.
- **Proibição é controle, não estilo.** "Proibido Lombok/MapStruct/Axios" e "não use `mdi-*`" são guardas contra padrões que o repo considera inseguros/opacos (reflexão, geração implícita, fonte de ícone não auditada). Remover essas linhas **reduz** cobertura de uma regra de segurança de código — por isso RF-04 exige substituto positivo antes de qualquer remoção.
- **`license: TaskFlow Security Standard`** (`security-review/SKILL.md:4`): o campo declara uma licença de terceiro que não licenciou este material. É afirmação jurídica falsa num artefato **distribuído**. Tratar como achado de primeira ordem em RF-08, não como cosmético.
- **Referência a SSoT inexistente é risco de processo de segurança**: `security-engineer/AGENT.md:26` manda obedecer `.agents/rules/security-standard.md` (ausente) sob pena de "nenhuma decisão de segurança pode divergir sem registro de exceção". O agente fica sem norma e com uma proibição de divergir — o pior dos dois mundos. RF-05.
- **`workflow-rules.md` é `protectedPaths`**: a edição exige trailer `Harness-Gate-Change` e passa pelo CI (ADR-007). Não é risco técnico, é risco de processo — declarado em R4.
- **A lista fechada de termos não pode virar scanner de segredo**: ela olha nome de projeto/tecnologia, nunca valor de credencial. Nenhum termo de §3.7 é sensível.
- **Dados**: nada de conteúdo de credencial; apenas caminhos, contagens e nomes de tecnologia já públicos no repo.

## 14. Perguntas abertas

1. **As 2 rules de frontend (382 l., 29,6% do corpo de rules) são agnósticas ou de perfil?** Elas são gateadas por eixo, então não vão a todo destino — reescrevê-las para "Vue/React genérico" pode destruir o valor que elas têm para um destino que **é** Vue. Alternativa: viram perfil de stack do cliente, fora do payload comum. → §16-D1.
2. **Proibição citando tecnologia é acoplamento?** O repo tem posição escrita de que é seguro (`harness-installer/SKILL.md:161-164`). Manter com critério, ou converter toda proibição em instrução positiva sem nome de tecnologia? → §16-D2.
3. **`spec-review` (1.303 l., 100% do conteúdo é de outro projeto)**: reescrever como revisor genérico de SPEC, remover, ou rotular como skill de projeto (fora do payload comum)? É a única skill que revisa SPEC na esteira. → §16-D3.
4. **As 6 rules de baseline Java ausentes** (16/8/7/6/4/3 citações): criar (o harness passa a ter baseline Java), reapontar para uma rule genérica de testes, ou remover as citações e declarar que Java não é suportado? → §16-D4.
5. **`DESIGN.md`/`Pulse`**: sai o ponteiro, vira dívida com dono no PRD 5, ou o PRD 5 entrega o arquivo? 3 agentes dependem dele hoje. → §16-D5.
6. **Autoria dos 3 artefatos centrais** (ADR-003 C4/N15): `planner` escreve e o `orchestrator` só delega; `sdd-compiler` vira agente com `edit: allow`; ou o `orchestrator` ganha `edit` restrito a `.spec/**`? → §16-D6.
7. **Escopo do CDL**: só a população do instalador (112 arquivos), ou também `.agents/schemas`, `docs/` e `harness/`? → §16-D7.
8. **`ui-ux-pro-max` (24 arquivos de catálogo) e as 6 skills de stack em `SKILLS_COMMON`**: exceção permanente declarada, ou saída do payload comum? → §16-D8.

## 15. PICCO (prompt da demanda)

<task>Escrever o PRD do ciclo "agnosticização de agentes, skills e rules" do harness: definir o problema com medição própria (população propagada, 3 classes de acoplamento, tipo de frase por sítio), fixar um critério observável de "agnóstico" verificável por comando, listar requisitos por classe, herdar e fechar as 5 pendências do PRD-1, e entregar bloco de aprovação humana com decisões abertas numeradas — sem criar ADR, RESEARCH, ADR-INDEX nem alterar código/config.</task>

<context>Repo `/home/joao/fusionlf/wsProjeto/harness` (tooling Node ESM, plugins opencode, instalador; não tem backend Java nem frontend Vue/React — `harness.config.json.stack = N/A`). Programa `harness-refactor-2026-11`, PRD-2 de 6; PRD-1 `prd-harness-inventory` fechado em 2026-11-11 com 5 ADRs merged (`2c314de`). Demanda do owner 2026-11-11, item 4: "Deixar os agentes, skills e rules mais agnósticas, sem relacionamento com projetos." Medido em 2026-11-11: payload propagado 112 arquivos/21.174 l.; 43 arquivos/8.245 l. (38,9%) com acoplamento substantivo; insumo nomeava 16 (delta 27); A-1 = 11 arquivos; classe (c) = 20 paths citados/13 ausentes/8 acionáveis; `DESIGN.md` em 3 agentes; `[//]: #` = 0. Heranças: ADR-003 C4/N15 (autoria de SPEC/PLAN/TASKS), ADR-004 N30 (link-ref), PRD-1 §3.5, FU-47. Fora de escopo: PRDs 3–6, `gate.js`, `harness.config.json`, selo (PRD §7).</context>

## 16. Aprovação [obrigatória]

- **Veredito**: **APROVADO** — portão G1 fechado pelo owner em 2026-11-11; as 8 decisões (D1–D8) foram respondidas uma a uma e estão registradas abaixo
- **Data**: 2026-11-11 (redação e aprovação no mesmo dia)
- **Portão**: **G1** (humano/HITL) — aprovação deste PRD **antes** de qualquer `ADRs/**`. `ADRs/` não existe neste diretório (INV-3 preservado)
- **Aprovador**: owner do harness
- **Decisões que o owner precisa fechar** (cada uma vira insumo de ADR; nenhuma é recomendação do agente — teto de **5 ADRs** para este PRD):

  - **D1 — alcance das 2 rules de frontend (382 l., 29,6% do corpo de rules).** São gateadas por eixo (`RULES_BY_AXIS`). Alternativas: (a) reescrever como "frontend Vue/React genérico"; (b) transformar em **perfil de stack do cliente**, fora do payload comum; (c) manter como estão e declarar exceção permanente. *Efeito de cada uma*: (a) 382 l. reescritas e o destino Vue perde especificidade; (b) o instalador ganha uma categoria nova de artefato; (c) M-4 cresce em 382 l. declaradas.
  - **D2 — proibição citando tecnologia é acoplamento?** Existe posição escrita no repo de que não (`harness-installer/SKILL.md:161-164`: "citam Vuetify/Lombok/… para bani-los … sem falso-positivo"). Alternativas: (a) confirmar a posição e escrever o **critério** que a sustenta (proibição vale porque o efeito pretendido é ausência); (b) converter toda proibição em instrução positiva sem nome de tecnologia; (c) híbrido: manter proibição de tecnologia *do cliente*, converter as demais. *Histórico relevante*: `FU-32`/`FU-26`.
  - **D3 — `spec-review` (5 arquivos, 1.303 l., 100% TaskFlow).** Alternativas: (a) reescrever como revisor genérico de SPEC (mantém a esteira, custo = 1.303 l.); (b) remover do payload comum e separar como skill de projeto; (c) manter e apenas rotular (`description` sem cliente, aviso de origem). *Restrição comum às três*: `workflow-rules.md` §4 passos 2 e 4 continuam invocando uma skill de revisão de SPEC.
  - **D4 — as 6 rules de baseline Java ausentes** (`backend-coding-standards` 16/14, `security-standard` 8/5, `backend-integration-tests` 7/7, `backend-unit-tests` 6/6, `db-migration-flyway` 4/4, `db-migration-liquibase` 3/3). Alternativas: (a) criar as 6 (o harness passa a ter baseline Java e ela se instala em todo destino); (b) reapontar para 1–2 rules genéricas de teste/migração; (c) remover as 52 citações e declarar Java fora de suporte. *Agrava-se com*: `security-standard.md` é declarada SSoT de segurança.
  - **D5 — `frontend/DESIGN.md` / Design System `Pulse`.** Alternativas: (a) remover o ponteiro dos 3 agentes; (b) registrar dívida com dono = PRD 5 `prd-frontend-harness-fusion`; (c) declarar que o design system é fornecido pelo destino e reescrever o ponteiro como "o design system do projeto (se houver)". *Fronteira*: o **conteúdo** do design system é do PRD 5; aqui decide-se só o ponteiro.
  - **D6 — autoria de `SPEC.md`/`PLAN.md`/`TASKS.md`** (ADR-003 C4/N15). Medido: `orchestrator` é `primary` com `edit: deny`; `sdd-compiler` é **skill** (roda na sessão do chamador). Alternativas: (a) `planner` escreve (já tem `edit: allow`) e o `orchestrator` só delega; (b) `sdd-compiler` vira agente com `edit: allow` (muda o roster de 10); (c) `orchestrator` ganha `edit` restrito a `.spec/**`. *Consequência*: (a) exige mudar a prosa de `workflow-rules.md:214-215` e `sdd-workflow-standard.md:16-18`.
  - **D7 — escopo do critério.** (a) Só a população do instalador (112 arquivos, M1); (b) também `.agents/schemas` + `docs/` + `harness/`; (c) população do instalador + `docs/` (o que o adotante lê antes de instalar).
  - **D8 — catálogo e skills de stack por nome.** `ui-ux-pro-max` (24 arquivos: lista de stacks é o conteúdo) + `sdd-compiler/references/frontend.md:49-51` + 6 skills de stack em `SKILLS_COMMON`. Alternativas: (a) exceção permanente declarada (E-1/E-3); (b) saída do payload comum, gateadas por eixo; (c) exceção para o catálogo e eixo para as skills.

- **Decisões fechadas pelo owner (2026-11-11)**:
  - **D1 = gatear por eixo** (formalizar o que já acontece): as 2 rules de frontend continuam axis-gated; não são reescritas neste PRD.
  - **D2 = proibição não é acoplamento** (exceção permanente): banir tecnologia por nome é permitido em qualquer rule, e A-2 mede **prescrição**, não proibição. O critério não muda por causa do alcance.
  - **D3 = separar `spec-review` como skill de projeto**: sai do payload comum do harness; o `workflow-rules` §4 passa a invocar um revisor de SPEC genérico (ou o do destino), sem depender do TaskFlow.
  - **D4 = remover as 52 citações e declarar Java fora do suporte atual**; as rules voltam quando o PRD-4 (`prd-axes-split`) habilitar o eixo backend.
  - **D5 = remover o ponteiro agora**: os 3 agentes deixam de citar `frontend/DESIGN.md`. O `DESIGN.md` correto nasce com o harness de frontend (**PRD-5**), que passa a ser o dono do arquivo.
  - **D6 = `orchestrator` ganha `edit: allow` restrito a `.spec/**`** (mesma forma de `product-manager`/`architect`/`qa-engineer`); para todo o resto segue `deny`.
  - **D7 = critério mede o repo inteiro menos vendor** (`__tests__/` e `ui-ux-pro-max/data/**` ficam de fora pela exceção E-4/E-1).
  - **D8 = exceção permanente declarada**: `ui-ux-pro-max` (catálogo) e as 6 skills de stack seguem em `SKILLS_COMMON`; o nome da skill declara a stack de propósito (E-3).

- **Fatiamento proposto para os ≤5 ADRs** (o owner ajusta): **ADR-1** critério CDL + instrumento (RF-01, RF-09); **ADR-2** classe (b) nas 2 entradas sempre-instaladas + herança de autoria (RF-03, RF-06, D6); **ADR-3** classe (b) nas skills comuns + `spec-review` (RF-03, RF-08, D1/D3); **ADR-4** classe (c): 8 paths + `DESIGN.md` + N30 (RF-05, RF-07, D4/D5); **ADR-5** frota restante: proibições, catálogo e skills por eixo (RF-02, RF-04, D2/D8).
- **Nota**: o agente redigiu; o veredito é do owner. Nenhum `ADRs/**`, `RESEARCH.md` ou `ADR-INDEX.md` foi criado — nascem somente após o G1 (`.agents/rules/prd-adr-pipeline.md` §1).
> ❓ Validação: o owner precisa aprovar (veredito + data) antes de qualquer ADR? **Sim** — §16 está com `Veredito: PENDENTE` e data de redação; as 8 decisões estão numeradas, com alternativas e efeito de cada uma, sem recomendação do agente.
