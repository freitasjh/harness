# RESEARCH — prd-harness-inventory

> **prd-id**: `prd-harness-inventory` · **Programa**: `harness-refactor-2026-11` (ordem 1) · **Rota**: Refactor
> **Data da pesquisa**: 2026-11-11 · **Data de acesso de todas as fontes**: 2026-11-11
> **Estatuto deste documento**: insumo do portão **G2**. Cada seção termina em **recomendação**
> — recomendação não é decisão. A decisão D1–D6 já está fechada pelo owner em 2026-11-11
> (`PRD.md` §16); aqui se pesquisa **como** cada decisão fechada se sustenta e a que custo.
> **Escopo de escrita**: só este diretório. Nenhum `ADRs/**`, `ADR.md`, branch ou PR foi criado.

## 0. Resumo executivo (5 linhas, um por ADR)

1. **ADR-001 (roster)** — consolidar é o que a evidência sustenta: menos papéis com mandato disjunto vence papéis sobrepostos, desde que cada referência ao removido seja tratada por comando.
2. **ADR-002 (`prd-adr-pipeline` como módulo)** — skill sem `SKILL.md` não é skill pela especificação; reclassificar é o caminho, **mas** o diretório precisa continuar em path propagável pelo instalador.
3. **ADR-003 (agente `planner`)** — há precedente publicado de papel de planejamento **como fase/skill** e de agente de planejamento **nativo** (`plan`); o híbrido (`subagent` que consome `dev-planner`) é o único que herda as 3 citações sem duplicar metodologia.
4. **ADR-004 (inventário canônico)** — inventário como documento apodrece (já apodreceu 2× neste PRD); o padrão que sobrevive é derivação por comando + verificação, e a classe das 49 skills sai do `.vendor-lock.json`, nunca do prefixo do nome.
5. **ADR-005 (prosa órfã)** — lint genérico (lychee) não cobre a classe do nosso defeito (path em backtick não é link); a rubrica precisa ser executável com os comandos já declarados.

## 1. Contexto e método

**Por que pesquisar.** O PRD mede o disco, mas medir não é decidir entre alternativas. As 5 decisões do
ciclo têm custo de manutenção assimétrico e o owner decide no G2 com informação externa: existe
precedente publicado para cada formato que estamos escolhendo? O que esse precedente cobra?

**Regras aplicadas nesta pesquisa.**

- Toda alternativa tem **fonte com URL http(s)**, **data de acesso** e **trade-off explícito**.
- Todo trade-off declara o **custo neste repo** (arquivos tocados, dependência nova, risco de drift) — "é mais complexo" não é custo.
- Fonte que não abre entra na §10 como **inacessível** e não é citada como lida. Nesta rodada: nenhuma.
- Onde a fonte não fala do nosso caso, a inferência é marcada como **inferência**, não como fato da fonte.
- **Decisão D1–D6 não é reaberta.** Quando a pesquisa contradiz a decisão, o achado vira **risco para o G2** (§9), não contraproposta.

**O que esta pesquisa não prova.** Não executamos o runtime opencode: nenhuma afirmação aqui sobre
"o que o runtime faz" vai além do que a documentação oficial afirma. Também não medimos custo de
tokens em produção — os números de custo são de arquivos e comandos, não de performance.

## 2. Fontes consultadas (9, todas acessíveis, todas usadas)

| # | URL | Acesso | Acessível | O que a fonte efetivamente sustenta |
|---|---|---|---|---|
| S1 | https://opencode.ai/docs/agents | 2026-11-11 | S | Agente é definido por arquivo (`.opencode/agents/<name>.md`) **ou** por config (`agents` em `opencode.json(c)`); `mode` ∈ `primary` \| `subagent` \| `all` (`primary` é o default de agente novo); `subagent` roda só em child session via tool `subagent` e herda o modelo do pai se não declarar; `description` é mostrada ao modelo que escolhe o subagente; `permissions` é lista ordenada com `effect: allow\|ask\|deny` e "a última regra que casa vence"; `disabled` remove agente; definições fazem merge em ordem de config; e a página declara que campos top-level legados (`prompt`, `permission`, `tools`, `temperature`, …) **não devem ser usados** em configuração V2 nova. |
| S2 | https://agentskills.io/specification | 2026-11-11 | S | Skill **é** um diretório com `SKILL.md` obrigatório; frontmatter exige `name` (>0–64, `a-z0-9-`, **deve casar com o nome do diretório pai**) e `description` (>0–1024); `license` é opcional; validação de referência via `skills-ref validate ./my-skill`; referências internas devem ser relativas à raiz da skill e "um nível de profundidade"; progressive disclosure em 3 níveis. |
| S3 | https://www.anthropic.com/engineering/building-effective-agents | 2026-11-11 (publicado 2024-12-19) | S | "Comece pela solução mais simples; só aumente complexidade quando melhora mensurável"; padrão *orchestrator-workers* = um LLM central delega e sintetiza; sistemas agênticos "trocam latência e custo por performance" e agentes autônomos acumulam "erro composto". |
| S4 | https://github.com/github/spec-kit | 2026-11-11 | S | O fluxo SDD é entregue como **skills/comandos** rodados por um agente de código: `/speckit-constitution → /speckit-specify → /speckit-plan → /speckit-tasks → /speckit-implement → /speckit-converge`. Não existe papel "planner" separado: `plan` é etapa, não agente. |
| S5 | https://github.github.io/spec-kit/overview/artifacts.html | 2026-11-11 | S | Precedente de **inventário como superfície de introspecção read-only**: `specify artifact list --json` devolve "uma linha por par `(kind, name)`" com proveniência (`layer`, `sourceId`, `manifestPath`, `sourcePath`), contrato JSON explícito, e erros com exit code definido. O inventário é **derivado**, não escrito à mão. |
| S6 | https://kiro.dev/docs/specs | 2026-11-11 (página atualizada 2026-10-15) | S | Spec = 3 artefatos (`requirements.md`, `design.md`, `tasks.md`) e "three-phase workflow" com gates de aprovação por fase; fases são etapas do mesmo produto, não papéis distintos. |
| S7 | https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html | 2026-11-11 (publicado 2025-10-15) | S | Análise independente de Kiro/spec-kit/Tessl: "SDD não é uma coisa só"; Kiro = Requirements→Design→Tasks em 3 docs; spec-kit "cria MUITOS arquivos markdown… verbosos e tediosos de revisar"; alerta de "falsa sensação de controle" quando o agente não segue as instruções; recomendação de passos pequenos e iterativos. |
| S8 | https://lychee.cli.rs/ | 2026-11-11 | S | Verificador de links para Markdown/HTML e codebases, "com saída JSON para integrar em CI/CD". |
| S9 | https://docs.npmjs.com/cli/v10/commands/npm-ci | 2026-11-11 | S | Padrão **manifest + check**: o projeto *deve* ter lockfile; se as dependências do lock não casarem com o manifesto, `npm ci` **sai com erro em vez de atualizar**; "installs are essentially frozen" (nunca escreve no lock). |

**Evidência local usada (não é fonte web, é o disco deste repo, medido 2026-11-11):**
`opencode.json` (10 registros; `agent.*.prompt`), `.agents/skills/.vendor-lock.json` (25 chaves em
`skills`, com `treeHash`/`computedHash`/`stacks`/`license`), `.agents/skills/prd-adr-pipeline/checks.mjs:15-16`
("Lives under `.agents/skills/**` because that is the only path the installer propagates"),
`.agents/rules/harness-config.md` (selo de `commands.suiteFull` via `HARNESS_SEAL_JSON`).

## 3. Tema A — Roster de agentes: orquestrador único vs papéis múltiplos (ADR-001)

O que está em jogo não é "quantos agentes", é **quantos mandatos disjuntos** o roster expressa. Medido:
11 `AGENT.md`, 10 registros, 1 primário (`orchestrator`), 9 subagentes, 4 com `edit: allow`.

| Alternativa | Fonte | Trade-off | Custo declarado neste repo |
|---|---|---|---|
| **A1. Registrar o `sdd-orquestrador` e manter os 11** | S1 (`primary` = agente principal da sessão; dois primários são selecionáveis) | Dois mandatos concorrentes de orquestração; a delegação passa a depender de qual primário o usuário escolheu. S3: complexidade só se paga com ganho mensurável — e aqui o ganho é zero, porque o `orchestrator` já cobre triagem/governança. | 1 entrada nova em `opencode.json` + 1 arquivo de prompt de ~120 linhas a manter em paridade com o outro orquestrador; e as 2 rules que hoje descrevem "o orquestrador" passam a precisar desambiguar qual. |
| **A2. Paridade mínima: só registrar/renomear, sem consolidar** *(alternativa considerada e descartada pelo owner em G1/D2 — registrada aqui para rastro)* | S1, S3 | Mantém `codebase-analyzer` (reverse engineering read-only) e `architect` (decisão/ADR) com mandatos que a §3.1 do PRD mede como colidentes: "reconstruct the systemic architecture" vs "decidir arquitetura". Dois prompts descrevem o mesmo trabalho com nomes diferentes. | 0 arquivos tocados hoje; dívida transferida: cada adoção futura herda 2 agentes para 1 trabalho. S3 explicitamente desaconselha manter abstração sem ganho. |
| **A3. Consolidar (D1+D2 fechadas): retirar `sdd-orquestrador`, fundir `codebase-analyzer` em `architect`, remover stub `code-reviewer/AGENT.md`** | S1 (`mode` separa "principal" de "invocado"; `description` guia a escolha do subagente), S3 | Ganho: 1 primário, 1 mandato por papel, e a escolha do subagente passa a ser legível pela `description`. Perda: o papel "reconstruir o sistema sem escrever" deixa de existir como agente nomeado e vira capacidade do `architect` (que tem `edit: allow`). | Medido: **10 arquivos** citam `sdd-orquestrador` fora de `.spec/**` (2 são o próprio diretório do agente) — `.agents/rules/sdd-workflow-standard.md`, `.agents/rules/workflow-rules.md`, `.agents/skills/prompt-optimizer/SKILL.md`, `docs/FUNCIONAMENTO.md`, `harness/opencode-v2-only.json`, `.opencode/plugins/__tests__/sdd-checks.spec.mjs`, `scripts/sdd-checks.mjs`, `workflow-state.json`. Somam-se 1 remoção de AGENT.md (6 linhas) e 1 fusão de prompt (~130 linhas a absorver no `architect`). |
| **A4. Especialização máxima (um agente por fase do SDD)** | S6 (3 fases = 3 artefatos), S7 ("verbosos e tediosos de revisar"; "falsa sensação de controle") | Uma fase ≈ um agente parece "limpo", mas S6 mostra as fases como etapas de **um** produto, e S7 mede o custo de cerimônia em revisão humana. | +3 agentes e +3 prompts (~300 linhas) para um fluxo que hoje cabe em 1 primário + 4 subagentes; cada handoff novo é um ponto onde o contexto se perde (S1: subagente roda em sessão filha com contexto próprio). |

**Recomendação (ADR-001): A3 — consolidar o roster em 1 primário + subagentes com mandato disjunto.**
*Critério declarado:* o roster só cresce quando o mandato novo **não** é coberto por mandato existente;
aplicado ao disco, os 11 atuais colapsam em 9 mandatos distintos e as 10 referências ao removido são
todas mecânicas (path de prosa, import de teste, JSON de variante), não semânticas.

## 4. Tema B — `prd-adr-pipeline` sem `SKILL.md`: skill de fato ou módulo de checks (ADR-002)

Medido: 49 diretórios em `.agents/skills/`, **48 com `SKILL.md`**; o único sem é `prd-adr-pipeline/`,
que contém `checks.mjs` (504 linhas) + `templates/` (4 arquivos) e é citado como **skill** por 4 agentes
(`architect`, `product-manager`, `orchestrator`, `sdd-orquestrador` — este último sai em ADR-001).

| Alternativa | Fonte | Trade-off | Custo declarado neste repo |
|---|---|---|---|
| **B1. Criar `SKILL.md` e assumir a skill** | S2 (`SKILL.md` é obrigatório; `name` deve casar com o diretório — `prd-adr-pipeline` casa) | As 4 citações viram verdadeiras sem edição — o único caminho com **zero** edição de agente. Mas passam a existir **duas** descrições normativas da mesma esteira: a rule `.agents/rules/prd-adr-pipeline.md` (79 linhas) e a skill nova; e a skill carrega prosa de política num diretório cujo uso real é **executar** `checks.mjs`. | 1 arquivo novo (`SKILL.md`, ~40–80 linhas) + risco permanente de drift entre rule e skill (2 SSoT para o mesmo contrato). O PRD já declara `prd-adr-pipeline` como "path propagável" (rule §5), então o diretório não pode simplesmente sumir. |
| **B2. Reclassificar como módulo de regra/checks e reapontar as citações (D4 fechada)** | S2 (`SKILL.md` obrigatório ⇒ não é skill), S5 (introspecção/validação pertence a ferramenta, não a prompt) | Consistência: 49/49 diretórios classificáveis, 1 SSoT normativo (a rule), e as citações passam a apontar para o que o artefato é (um check + templates). Perda: 3–4 arquivos de agente precisam de edição, e "módulo" é uma categoria **nova** no vocabulário do harness — precisa de definição escrita, senão vira rótulo vago. | **Risco medido:** `checks.mjs:15-16` declara que vive sob `.agents/skills/**` "because that is the only path the installer propagates". Mover o diretório para `.agents/rules/` ou `.agents/modules/` **quebra a propagação** até o instalador ganhar o mapa correspondente. Custo: 3 arquivos de agente (`architect`, `product-manager`, `orchestrator` após ADR-001) + decisão explícita de layout (ficar em `skills/` sem ser skill, ou ampliar o instalador). |
| **B3. Deixar como está (nem skill, nem módulo)** | — | É o estado atual: 1 artefato sem classe e 4 agentes mandando carregar algo que não é carregável. S3: manter abstração que não se paga é o caso mais caro. | 0 arquivos tocados; mantém a métrica do PRD §5 ("artefatos sem classe e sem decisão") acima de 0 indefinidamente. |

**Recomendação (ADR-002): B2 — reclassificar como módulo de regra/checks, com uma condição não negociável: o diretório permanece em path que o instalador propaga** (ou o instalador ganha o mapa no mesmo ADR).
*Critério declarado:* 49/49 skill classificáveis e 1 única fonte normativa da esteira; custo aceito = 3 arquivos de agente, custo **recusado** = perder propagação no destino.

## 5. Tema C — Papel de planejamento: agente, fase ou skill (ADR-003)

Medido: `planejador` citado **3×** em `.agents/` e **0** agentes com esse nome; `dev-planner` (skill)
citado por **0** agentes; o planejamento hoje está diluído no `orchestrator` (Fase 2) e na skill.

| Alternativa | Fonte | Trade-off | Custo declarado neste repo |
|---|---|---|---|
| **C1. Agente `planner`, modo `subagent`, que consome a skill `dev-planner` (D6 fechada)** | S1 (`subagent` = child session, `description` guia a escolha, `permissions` por agente), S4 (o plan é etapa alimentada por skill) | Papel nomeado e endereçável (`@planner`), com metodologia **na skill** (1 SSoT) e prompt fino no agente (fronteira, não método). S1 mostra que o modelo escolhe o subagente pela `description` — logo a fronteira precisa estar na `description`, não só no corpo. | 1 arquivo `.agents/agents/planner/AGENT.md` (fino, ~40–60 linhas) + 1 entrada em `opencode.json`; 3 citações de `planejador` reapontadas para `planner` (ou mantidas se o nome for herdado — D6 escolheu `planner`). Risco: sobreposição com `orchestrator` (que hoje assume a Fase 2) e com `sdd-compiler` (que gera PLAN) — mitigação já exigida por RF-05: checklist de 4 fronteiras. |
| **C2. Sem agente novo: `plan` como fase executada pelo `orchestrator` com a skill `dev-planner`** | S4 (spec-kit: `/speckit-plan` é etapa, não agente), S6 (Kiro: 3 fases, 3 docs), S7 (cerimônia extra custa revisão) | Menos peças e nenhum handoff novo. Mas: reprova RF-05 (papel **nomeado** que produz o plano), mantém `planejador` como prosa morta (3 citações seguem mentindo) e não resolve o motivo declarado do PRD — "o planejamento vive diluído no orchestrator". | 0 arquivos de agente; +1 seção de prosa no prompt do `orchestrator`; a skill continua sem consumidor nomeado (aumenta a contagem de órfãs). |
| **C3. `planner` como `primary`** (espelhando o built-in `plan` do runtime) | S1 (o built-in `plan` é `primary` e "explora e planeja sem editar arquivos normais do projeto") | Precedente nativo forte, e o papel fica impossível de ignorar. Mas cria um **segundo primário** — exatamente o defeito que ADR-001 corrige ao retirar o `sdd-orquestrador`. | 1 agente + 1 entrada; e a sessão passa a exigir escolha de primário (Tab), com 2 portas de entrada para o mesmo fluxo. |

**Recomendação (ADR-003): C1 — `planner` como `subagent` que consome `dev-planner`.**
*Critério declarado:* atende ao RF-05 (papel nomeado, artefato produzido, 4 fronteiras escritas) **sem**
introduzir segundo primário (coerência com ADR-001) e **sem** duplicar a metodologia que já vive na skill.

## 6. Tema D — Inventário canônico re-derivável + classe das 49 skills (ADR-004)

Medido hoje: 11 `AGENT.md` / 10 registros · 49 skills / 25 vendorizadas (lock) / 48 com `SKILL.md` /
27 sem consumidor · 8 rules · **20** paths de rule citados, dos quais **13 ausentes** (8 acionáveis,
5 vendor-internal) · `planejador` 3×.

### 6.1 Forma do inventário

| Alternativa | Fonte | Trade-off | Custo declarado neste repo |
|---|---|---|---|
| **D1. Inventário como documento escrito à mão** | S5 (o inventário publicado é derivado, com proveniência por linha) | Legível, zero infraestrutura. Apodrece: este próprio PRD já mediu 2 divergências internas na mesma data (§1 registra 7 arquivos citando o removido; a re-derivação dá 10; §3.5 diz "13 paths distintos" quando o `grep` devolve **20** e são 13 apenas após filtrar ausência). | 0 infra; custo recorrente: toda auditoria refaz a medição e o documento e o disco divergem em silêncio. É a falha que o PRD existe para corrigir. |
| **D2. Inventário derivado por script, com check de drift no CI** | S9 (lockfile + `npm ci` **falha** em vez de atualizar; "frozen"), S5 (`--json`, exit code definido, 1 linha por par) | O inventário passa a ser **fato verificável**: disco muda ⇒ check vermelho ⇒ alguém atualiza com o comando. Perda: um script a mais e uma decisão de onde ele roda. | Se o comando entrar em `commands.suiteFull`, o **selo muda** (`harness-config.md` — "Regenerate with `sealCommands(commands)` whenever `commands.suiteFull` changes") e o gate GATE-01 passa a exigir o selo republicado em `HARNESS_SEAL_JSON`. Alternativa sem selo: rodar o gerador **dentro** de `scripts/static-checks.mjs`, que já é o segundo termo do `suiteFull` — 0 mudança de comando, 0 republicação de selo. |
| **D3. Híbrido: gerado + commitado + `git diff --exit-code`** | S9, S5 | Permite revisar o inventário no PR (diff legível) e ainda detectar drift. Custo: um artefato gerado versionado para manter limpo a cada mudança de skill. | 1 arquivo gerado + 1 check; **e** cai no não-objetivo do PRD §7 ("definir formato de arquivo de inventário gerado") — o formato do arquivo fica fora deste ciclo. |

### 6.2 Como derivar a classe das 49 (25 vendorizadas vs 24 locais)

| Alternativa | Fonte | Trade-off | Custo declarado neste repo |
|---|---|---|---|
| **E1. Classe pelo prefixo do nome** (`dart-*`/`flutter-*` ⇒ vendorizada) | S2 (`name` casa com o diretório, nada diz sobre origem) | Trivial de escrever. **Erra no disco:** `react-best-practices`, `nestjs-best-practices` e `react-components` são as 3 vendorizadas não-mobile, sem prefixo distintivo; qualquer heurística de prefixo as classificaria como locais, e um local futuro com prefixo `flutter-` seria vendorizado por engano. | 0 infra; taxa de erro já conhecida hoje: 3 de 25 (12%). |
| **E2. Classe pelas chaves de `.agents/skills/.vendor-lock.json` (D3 fechada)** | S9 (manifesto como fonte única, com versão/trava), S5 (proveniência declarada por linha) | 1 SSoT, e o lock já carrega `source`, `license`, `stacks`, `treeHash` — a classe e o eixo saem do mesmo registro que o instalador usa. Perda: lock pode ficar *stale* se alguém adicionar skill à mão; é preciso o check de D2 para o staleness doer. | 0 arquivo novo; 25 chaves a ler; o lock já existe e é público (PRD §13). |
| **E3. Classe pelo campo `license` do frontmatter de cada `SKILL.md`** | S2 (`license` é campo opcional do frontmatter) | Semanticamente alinhado à especificação (S2), e cada skill declara sua própria origem. **Inviável para as vendorizadas:** o lock guarda `computedHash`/`treeHash` — editar `SKILL.md` para inserir `license` quebra a verificação de integridade do vendor. | 48 `SKILL.md` editados (23 locais + 25 vendorizadas = 49 − `prd-adr-pipeline`) e **25** hashes de vendor quebrados, com risco de falha do `scripts/vendor-skills.mjs --check`. |

**Recomendação (ADR-004): D2 + E2 — derivação por comando (rodando dentro de `static-checks.mjs`, para não tocar o selo) e classe das 49 lida do `.vendor-lock.json`.**
*Critério declarado:* todo número publicado tem comando que o reproduz (RF-07) e a classe não pode ser
ambígua no disco — o lock é o único registro que acerta 25/25 sem editar 1 byte de skill vendorizada.

## 7. Tema E — Prosa órfã: como classificar 15 referências vivas (ADR-005)

Medido: **13** paths de `rules/*.md` citados e ausentes (8 acionáveis, 5 vendor-internal) + `rules/exemplo.md`
(string de exemplo, não defeito) + `frontend/DESIGN.md` + 3 citações de `planejador`. D5 fechada:
**classificar aqui, corrigir no PRD 2**.

| Alternativa | Fonte | Trade-off | Custo declarado neste repo |
|---|---|---|---|
| **F1. Corrigir o texto agora (reapontar/remover)** | S7 ("passos pequenos e iterativos"; revisão de markdown é cara) | Resolve na hora e some com a prosa mentirosa. Mas embarca trabalho de **outro** PRD (2) neste ciclo, e a correção certa depende de decisão que não é deste PRD: os 6 paths de backend/Flyway/Liquibase apontam para a baseline Java que este repo não tem — remover pode ser errado se o destino Java for reabilitado (PRD 3/4). | 15 arquivos que hoje citam rule ausente + 8 paths acionáveis a decidir; colide com o não-objetivo do PRD §7 (agnosticização é do PRD 2) e com o escopo do §6 ("este PRD não altera código/regra"). |
| **F2. Classificar com rubrica executável (reapontar / remover / dívida-com-dono) e adiar a edição (D5)** | S9 (o check é o que impede o drift de voltar), S5 (inventário derivado com proveniência) | Fecha a métrica do PRD §5 ("0 não classificadas") sem tocar texto alheio. Perda: a prosa continua mentindo por 1 ciclo — mitigado se cada dívida tiver dono+PRD declarados. | 1 rubrica com 3 valores + 1 comando declarado por linha (o `grep` do §3.5 já existe); 15 linhas de classificação; 0 arquivo de rule editado. |
| **F3. Adotar `lychee` (ou equivalente) como lint de referência** | S8 (suporta Markdown/HTML, saída JSON para CI) | Ferramenta madura e CI-ready — para **links**. **Não cobre nossa classe:** nossas referências são paths em backtick no meio de prosa (`rules/security-standard.md`), não links Markdown/HTML; exigiria extrair os paths antes de checar (**inferência**, não afirmação da fonte). Adiciona um binário Rust externo a um repo que hoje é Node-only. | 1 dependência nova de toolchain + 1 etapa de CI + um extrator próprio de path-em-backtick (sem o extrator, cobertura ≈ 0 para esta classe). |
| **F4. Detector próprio dentro de `scripts/static-checks.mjs`** | S9 (falha em vez de avisar), S8 (a lição é "check em CI", não a ferramenta) | Reaproveita o runner já selado: 0 comando novo, 0 dependência, 0 republicação de selo. Perda: regex frágil e a allowlist dos 5 vendor-internal precisa ser **declarada**, senão o check nasce vermelho e vira ruído (o repo já tem precedente de check que declara baseline em vez de fingir verde: os checks `V12`/`LEGACY` declaram baseline em vez de fingir sucesso). | 1 função nova em `static-checks.mjs` (~40 linhas) + allowlist de 5 paths vendor-internal + 1 caso de exemplo; custo de manutenção: toda rule nova ausente reabre o check. |

**Recomendação (ADR-005): F2 como decisão de classificação, com F4 como mecanismo de re-derivação a ser implementado no SDD do próprio ADR.**
*Critério declarado:* 15/15 referências classificadas por comando (RF-03/RF-07), zero dependência nova,
zero edição de rule neste ciclo — e a detecção fica onde já falha o build, não num passo opcional.

## 8. Recomendação por ADR (1 linha + critério)

| ADR | Recomendação | Critério declarado |
|---|---|---|
| ADR-001 | Consolidar: 1 primário, `codebase-analyzer` absorvido pelo `architect`, stub `code-reviewer/AGENT.md` removido | Só criar papel com mandato não coberto; medido, os 11 colapsam em 9 mandatos e as 10 referências são mecânicas |
| ADR-002 | `prd-adr-pipeline` vira **módulo de regra/checks**, citações reapontadas, mantido em path propagável | 49/49 classificáveis e 1 SSoT normativo, sem perder propagação no instalador |
| ADR-003 | `planner` `subagent` que **consome** `dev-planner` | RF-05 satisfeito sem segundo primário e sem duplicar metodologia |
| ADR-004 | Inventário **derivado por comando** (check dentro de `static-checks.mjs`, sem tocar `suiteFull`) + classe das 49 lida do `.vendor-lock.json` | Todo número re-derivável (RF-07) e classe sem ambiguidade no disco (25/25 sem editar skill vendorizada) |
| ADR-005 | Classificar com rubrica de 3 valores (reapontar/remover/dívida-com-dono); edição de texto no PRD 2; detector próprio como mecanismo | 15/15 classificadas por comando, 0 dependência nova, 0 rule editada neste ciclo |

## 9. Riscos para o portão G2 (o que o owner precisa saber antes de decidir)

| # | Risco | Evidência | Por que importa no G2 |
|---|---|---|---|
| R1 | **D4 vs. propagação do instalador.** "Sai de `.agents/skills/`" conflita com `checks.mjs:15-16` ("only path the installer propagates"). | `checks.mjs:15-16`; `harness-config.md` §"Perfis de stack" (`RULES_BY_AXIS`/`SKILLS_BY_AXIS`) | O ADR-002 precisa escolher: manter o diretório em `skills/` **sem** ser skill, ou ampliar o instalador no mesmo ADR. Sem isso, o repo-destino perde `checks.mjs` silenciosamente. |
| R2 | **Divergências de contagem entre PRD e disco (na mesma data).** §1/§8 dizem "7 arquivos vivos" citando `sdd-orquestrador`; re-derivação dá **10** fora de `.spec/**` (2 são o próprio agente). §3.5 diz "13 paths distintos, 52 citações"; o `grep` devolve **20** distintos, dos quais **13 ausentes** (52 citações). | medição 2026-11-11 neste repo | RF-07 manda registrar drift, não esconder. O ADR-004 deve herdar o número **correto** (20 citados / 13 ausentes), senão nasce desatualizado — exatamente o risco que o PRD §8 descreve. |
| R3 | **Forma de registro de agente.** `opencode.json` usa `agent` + `prompt: {file:}` + `permission`, que a doc oficial lista como campos **legados** ("do not use legacy top-level fields such as `prompt`, `permission`, `tools` … in new V2 agent configuration"). | S1 vs. `opencode.json` (medido) | O ADR-003 registra o `planner` — precisa declarar se escreve no formato atual do arquivo (homogêneo, legado) ou no formato V2 (`agents`/`system`/`permissions`). Escolha divergente sem verificação de runtime cria 2 formatos no mesmo arquivo. **Não decidido aqui**: exige confirmar o comportamento do runtime instalado. |
| R4 | **`prd-adr-pipeline` perde 1 das 4 citações quando ADR-001 executar** (o `sdd-orquestrador` é uma delas). | medição: 4 agentes citam; 1 é o removido | Se ADR-002 for executado antes de ADR-001, o reapontamento é feito 4× e depois 1 arquivo é apagado — retrabalho pequeno, mas o ADR-002 deve declarar a ordem (ADR-003 já depende de ADR-001; ADR-002 não depende, por decisão do owner). |
| R5 | **Custo de `suiteFull` mutável.** Qualquer opção que acrescente comando à suíte muda o selo (`HARNESS_SEAL_JSON`) e exige republicação. | `harness-config.md` §"Command seal" | É por isso que ADR-004 recomenda rodar o check **dentro** de `static-checks.mjs`. Se o owner preferir comando separado, o custo inclui republicar o selo — declarar no ADR. |
| R6 | **A visão "um agente por papel" não tem precedente nos 3 SDD pesquisados.** Kiro, spec-kit e o `plan` nativo tratam planejamento como **fase** ou **agente único nativo**, não como roster de papéis. | S4, S6, S7, S1 | O `planner` é justificável por dívida local (3 citações + skill sem consumidor), **não** por padrão de mercado. O ADR-003 deve declarar isso explicitamente, para que a fronteira contra `orchestrator`/`sdd-compiler` não dependa de retórica. |
| R7 | **Ambiguidade de `status` no índice.** O contrato (`checks.mjs`, `INDEX_STATUS`) aceita só `todo\|in-progress\|merged\|dropped`; **não existe `proposed`**. | `checks.mjs:47` | As 5 linhas do ledger (§11) usam `todo` (nenhuma `in-progress` antes do G2). Um `proposed` inventado reprova `ADR-02` — e é o erro natural de quem escreve "proposed antes do G2". |
| R8 | **Contradição interna do pipeline.** A rule manda `PRD → RESEARCH → ADR-INDEX → ADR` (`prd-adr-pipeline.md` §1), mas o `ADR-01` exige 1:1 índice↔disco (`checks.mjs:298-301`): linha de índice sem `ADRs/<dir>/` é **FAIL**. Logo o intervalo "índice escrito, 1º ADR ainda não escrito" é **inexequível com a suíte verde**. Precedente da casa: `02e7f96` criou índice + 5 dirs + 5 `ADR.md` no **mesmo** commit. | `prd-adr-pipeline.md:20` vs `checks.mjs:298-301`; `git show --stat 02e7f96` | Consequência prática **deste batch**: o ledger está pronto em §11 mas **não foi materializado** como `ADR-INDEX.md`, porque materializar 5 linhas sem os 5 dirs deixa `static-checks` em **exit 1** (provado: *"linha do índice sem dir correspondente: ADRs/ADR-001-…"*, 5×). O owner precisa escolher no G2: (a) materializar índice **junto** com `ADR-001` (padrão da casa, suíte verde o tempo todo); ou (b) aceitar índice adiantado e o vermelho até o 1º ADR; ou (c) emendar a rule §1 para dizer que o índice nasce com o 1º ADR. Nenhuma das três muda decisão D1–D6. |

## 10. Fontes inacessíveis

**Nenhuma.** As 9 fontes da §2 abriram e foram lidas em 2026-11-11; nenhuma linha deste documento cita
fonte não lida. Fontes candidatas descartadas **antes** da leitura (não usadas, não citadas):
resultados de busca de blogs agregadores sobre configuração de agentes — preferimos a documentação
oficial do runtime (S1), que é a referência que o próprio repo aponta.

## 11. Apêndice — conteúdo de `ADR-INDEX.md`, pronto para materializar (não materializado)

**Por que não está no disco:** `ADR-01` exige 1:1 índice↔disco (`checks.mjs:298-301`). As 5 linhas
abaixo apontam para `ADRs/ADR-00N-{slug}/`, que **não existem** e **não podem existir neste batch**
(nenhum `ADRs/**`, `ADR.md`, branch ou PR está no escopo desta entrega). Materializar o arquivo agora
deixa `node scripts/static-checks.mjs` em **exit 1** com 5× *"linha do índice sem dir correspondente"*;
por isso o conteúdo é entregue aqui, íntegro, e o arquivo nasce no commit do `ADR-001` — exatamente o
padrão da casa (`02e7f96`: índice + 5 dirs + 5 `ADR.md` no mesmo commit). Ver risco **R8** (§9).

**Quando materializar:** no primeiro commit de ADR do ciclo, criando `ADR-INDEX.md` **e**
`ADRs/ADR-001-roster-de-agentes/ADR.md` no mesmo passo. A partir daí `ADR-01` e `ADR-02` ficam verdes
para este diretório e cada linha nova entra junto com seu `ADR.md`.

````markdown
# ADR-INDEX — prd-harness-inventory

> Ledger 1:1 com `ADRs/**`: uma linha por ADR; a ordem é a de merge (PRD §16, fatiamento aprovado
> pelo owner em 2026-11-11 — 5 ADRs, exatamente o teto de `.agents/rules/prd-adr-pipeline.md` §3).
> Contrato das colunas (rule §2): `order` inteiro ≥1 · `status` ∈ `todo|in-progress|merged|dropped`
> · `depends_on` declarado (`—` quando não há) · `dir` = `ADRs/ADR-00N-{slug}/` ·
> `branch` = `adr/{prd-id}/{nn}-{slug}` · `merge` preenchido quando `status=merged`.
>
> **Estado deste ledger**: as 5 linhas estão em `todo` — nenhum ADR foi escrito, nenhuma branch foi
> criada, nenhum merge aconteceu. O portão **G2** (owner) é que promove a 1ª linha para `in-progress`
> e, no mesmo passo, cria `ADRs/ADR-001-roster-de-agentes/ADR.md` com decisão + `depende-de` +
> interface congelada (o `ADR-01` exige o par índice↔disco: **linha sem diretório é defeito**).
> `merge` fica `—` em todas as linhas enquanto `status ≠ merged`.
>
> **Por que `todo` e não `proposed`**: o enum do contrato (`checks.mjs`, `INDEX_STATUS`) é
> `todo|in-progress|merged|dropped`. `proposed` não existe e reprovaria `ADR-02`; `todo` é o valor
> que o contrato usa para "decidido no fatiamento, ainda não iniciado".
>
> **Ordem de merge 1 → 5**: `ADR-003` depende de `ADR-001` (o `planner` entra no roster que o
> ADR-001 define e herda a decisão de primário único). `ADR-002`, `ADR-004` e `ADR-005` não têm
> dependência declarada (decisão do owner, PRD §16) — mas há ordem de **execução** preferível:
> ADR-001 antes de ADR-002 reduz de 4 para 3 as citações de `prd-adr-pipeline` a reapontar
> (`RESEARCH.md` §9-R4). Ordem de execução não é `depends_on`: não a inventamos aqui.

| order | id | title | status | depends_on | dir | branch | merge |
|---|---|---|---|---|---|---|---|
| 1 | ADR-001 | Roster de agentes: 1 primário, consolidação de sobrepostos e saída do `sdd-orquestrador` | todo | — | ADRs/ADR-001-roster-de-agentes/ | adr/prd-harness-inventory/01-roster-de-agentes | — |
| 2 | ADR-002 | `prd-adr-pipeline` como módulo de regra/checks (não skill), com citações reapontadas | todo | — | ADRs/ADR-002-prd-adr-pipeline-modulo/ | adr/prd-harness-inventory/02-prd-adr-pipeline-modulo | — |
| 3 | ADR-003 | Agente `planner` em modo `subagent`, consumindo a skill `dev-planner` | todo | ADR-001 | ADRs/ADR-003-agente-planner/ | adr/prd-harness-inventory/03-agente-planner | — |
| 4 | ADR-004 | Inventário canônico re-derivável e classe das 49 skills a partir do `.vendor-lock.json` | todo | — | ADRs/ADR-004-inventario-canonico/ | adr/prd-harness-inventory/04-inventario-canonico | — |
| 5 | ADR-005 | Classificação da prosa órfã (reapontar / remover / dívida com dono), correção no PRD 2 | todo | — | ADRs/ADR-005-prosa-orfa/ | adr/prd-harness-inventory/05-prosa-orfa | — |

## Insumos por linha (o que cada ADR herda deste ciclo)

*(lista, não tabela: o parser do `ADR-01`/`ADR-02` lê **todas** as linhas `|` do arquivo como linhas do
ledger — uma segunda tabela seria interpretada como ADR extra e reprovaria os dois checks.)*

- **ADR-001** — decisão G1: D1+D2 = retirar `sdd-orquestrador` com as referências vivas tratadas, fundir
  `codebase-analyzer` em `architect`, remover o stub `code-reviewer/AGENT.md`. Evidência: 11 `AGENT.md`
  vs 10 registros; **10** arquivos citam `sdd-orquestrador` fora de `.spec/**`; 4 agentes com `edit: allow`.
  Pesquisa: `RESEARCH.md` §3 (A1–A4), risco R3.
- **ADR-002** — decisão G1: D4 = reclassificar `prd-adr-pipeline` como módulo de regra/checks e reapontar
  as citações. Evidência: 49 diretórios, 48 com `SKILL.md`; 4 agentes citam `prd-adr-pipeline` (1 deles
  sai no ADR-001). Pesquisa: §4 (B1–B3), riscos R1 e R4.
- **ADR-003** — decisão G1: D6 = `planner`, modo `subagent`, **consome** a skill `dev-planner`; 3 citações
  de `planejador` reapontadas. Evidência: `planejador` 3× sem agente; `dev-planner` com 0 consumidores.
  Pesquisa: §5 (C1–C3), risco R6.
- **ADR-004** — decisão G1: D3+D4 = classe `vendor-by-axis` derivada do `.vendor-lock.json` (nunca do
  prefixo do nome) + inventário re-derivável. Evidência: 25 chaves no lock; 27 skills sem consumidor;
  20 paths de rule citados, 13 ausentes. Pesquisa: §6 (D1–D3, E1–E3), riscos R2 e R5.
- **ADR-005** — decisão G1: D5 = classificar a prosa órfã neste ciclo, corrigir o texto no PRD 2.
  Evidência: 13 paths ausentes (8 acionáveis, 5 vendor-internal) + `frontend/DESIGN.md` + 3× `planejador`.
  Pesquisa: §7 (F1–F4).
````

**Nota de materialização:** o bloco acima é o arquivo inteiro, não um fragmento. Ao extrair, remova a
primeira linha (cerco `markdown`) e a última (cerco de fechamento) e grave como
`.spec/prd/prd-harness-inventory/ADR-INDEX.md`.

