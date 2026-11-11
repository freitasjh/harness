# ADR-INDEX — `prd-harness-inventory`

> **Ledger 1:1 com `ADRs/**`** — uma linha por ADR existente no disco. Contrato das colunas
> (`.agents/rules/prd-adr-pipeline.md` §2): `order` inteiro ≥1 · `status` ∈ `todo|in-progress|merged|dropped`
> · `depends_on` declarado (`—` quando não há) · `dir` = `ADRs/ADR-00N-{slug}/` ·
> `branch` = `adr/{prd-id}/{nn}-{slug}` · `merge` preenchido **somente** quando `status=merged`.
>
> **Por que este índice nasceu com 2 linhas e não 5.** `ADR-01` (`checks.mjs:298-301`) exige 1:1 entre índice e
> disco: linha de índice sem `ADRs/<dir>/` correspondente é **FAIL**. Materializar as 5 linhas do
> fatiamento aprovado antes de os 5 diretórios existirem deixaria `node scripts/static-checks.mjs` em
> exit 1 (5× *"linha do índice sem dir correspondente"*), contra o RF-08 e a regra H2. A forma escolhida
> é a do precedente da casa (`02e7f96`): **o índice nasce com o primeiro ADR**, e cada linha nova entra
> no mesmo commit do seu `ADR.md`. É a saída (a) do risco **R8** do `RESEARCH.md` §9.
>
> **O plano completo dos 5 ADRs não se perde:** vive em `workflow-state.json.prd_adr.adr_plan` (5 entradas
> com `order`, `id`, `titulo`, `depende_de`, `branch`) e em `PRD.md` §16 (fatiamento aprovado pelo owner
> em 2026-11-11). Este arquivo é o ledger **do que existe**, não o plano do que existirá. A regra não
> proíbe buraco de `order` (a continuidade não é imposta por `ADR-01`/`ADR-02`); as linhas `order 1` a `5`
> existem porque os cinco `ADR.md` existem no disco — a `order 4` (`ADR-004`) entrou junto do seu
> diretório em 2026-11-11, última do fatiamento a nascer.
>
> **Estado:** `ADR-001` **merged** (`fe7c408`), `ADR-002` **merged** (`67e8162`, merge do PR #5),
> `ADR-003` **merged** (`f9c5ca2`, merge do PR #6) e `ADR-005` **merged** (`cb0f08d`, merge do PR #7) —
> os quatro por merge humano em 2026-11-11. `ADR-004` está `in-progress` (branch
> `adr/prd-harness-inventory/04-inventario-canonico` criada de `main` @ `cb0f08d`, `ADR.md` escrito,
> nenhum merge). `merge` fica `—` em toda linha com `status ≠ merged`.
> No máximo **1** linha `in-progress` por vez (`checks.mjs:378-379`): a promoção do `ADR-005` a `merged`
> no mesmo commit em que o `ADR-004` nasce é o que mantém `ADR-02` verde (mesmo padrão da promoção do
> `ADR-003` quando o `ADR-005` nasceu).
>
> **Ordem de merge:** `ADR-003` declara `depends_on: ADR-001` (o `planner` entra no roster que o ADR-001
> define e herda a decisão de primário único). `ADR-004` não tem dependência declarada (decisão do owner,
> `PRD.md` §16). **`ADR-005` passou a declarar `depends_on: ADR-003`** — mudança de 2026-11-11, decisão do
> owner: as 5 divergências que o `ADR-003` §10 deferiu (`I2`, `I3`, autor de `EXPLORATION.md`, protocolo de
> delegação, gatilho da Fase 0) foram **re-escopadas para o `ADR-005`**, então a dependência é real e não
> estética. Ela é válida só contra o estado pós-`ADR-003`, que já está `merged` (`f9c5ca2`) — a ordem de
> **execução** está consumada e nenhuma linha de `order` menor ficou aberta. Há ordem de execução
> preferível — ADR-001 antes de ADR-002 — também consumada, o que reduziu de 4 para 3 as citações de
> `prd-adr-pipeline` vivas e de 3 para 1 as que apontam para path de skill (`RESEARCH.md` §9-R4).
>
> **Enum de `status`:** `proposed` **não existe** (`INDEX_STATUS` em `checks.mjs:47` é
> `todo|in-progress|merged|dropped`); usá-lo reprovaria `ADR-02`.

| order | id | title | status | depends_on | dir | branch | merge |
|---|---|---|---|---|---|---|---|
| 1 | ADR-001 | Roster de agentes: 1 primário, `codebase-analyzer` absorvido pelo `architect`, stub do `code-reviewer` removido e saída do `sdd-orquestrador` | merged | — | ADRs/ADR-001-roster-de-agentes/ | adr/prd-harness-inventory/01-roster-de-agentes | feat(#4) `fe7c408` — merge humano 2026-11-11 |
| 2 | ADR-002 | `prd-adr-pipeline` como módulo de regra/checks: `checks.mjs` + 4 templates saem de `.agents/skills/` para `.opencode/plugins/lib/`, norma fica na rule | merged | — | ADRs/ADR-002-prd-adr-pipeline-modulo/ | adr/prd-harness-inventory/02-prd-adr-pipeline-modulo | feat(#5) `67e8162` — merge humano 2026-11-11 |
| 3 | ADR-003 | Agente `planner` (`subagent`, consome a skill `dev-planner`): escrita limitada a 4 artefatos de planejamento do ciclo SDD e zero poder de decisão | merged | ADR-001 | ADRs/ADR-003-agente-planner/ | adr/prd-harness-inventory/03-agente-planner | feat(#6) `f9c5ca2` — merge humano 2026-11-11 |
| 4 | ADR-004 | Inventário canônico: superfície derivada (`V19` no runner selado, sem comando novo) e não documento; a única literal é o registry de decisões de órfão, que expira quando o sujeito desaparece ou deixa de ser órfão | in-progress | — | ADRs/ADR-004-inventario-canonico/ | adr/prd-harness-inventory/04-inventario-canonico | — |
| 5 | ADR-005 | Prosa órfã: *rubric* de 6 classes derivadas por comando (não lista de casos) + resolução das 5 divergências herdadas do ADR-003; correção de texto no PRD 2 | merged | ADR-003 | ADRs/ADR-005-prosa-orfa/ | adr/prd-harness-inventory/05-prosa-orfa | feat(#7) `cb0f08d` — merge humano 2026-11-11 |
