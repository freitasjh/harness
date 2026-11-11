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
> proíbe buraco de `order` (a continuidade não é imposta por `ADR-01`/`ADR-02`); as linhas `order 1`,
> `order 2` e `order 3` são as primeiras do plano e existem porque os três `ADR.md` existem no disco.
>
> **Estado:** `ADR-001` **merged** (`fe7c408`) e `ADR-002` **merged** (`67e8162`, merge do PR #5) —
> ambos merge humano 2026-11-11. `ADR-003` está `in-progress` (branch criada de `main` @ `67e8162`,
> `ADR.md` escrito, nenhum merge). `merge` fica `—` em toda linha com `status ≠ merged`.
> As linhas de `ADR-004`…`ADR-005` entram uma a uma, cada uma junto do seu diretório — nunca antes.
> No máximo **1** linha `in-progress` por vez (`checks.mjs:378-379`): a promoção do `ADR-002` a `merged`
> no mesmo commit em que o `ADR-003` nasce é o que mantém `ADR-02` verde.
>
> **Ordem de merge:** `ADR-003` declara `depends_on: ADR-001` (o `planner` entra no roster que o ADR-001
> define e herda a decisão de primário único). `ADR-002`, `ADR-004` e `ADR-005` não têm dependência
> declarada (decisão do owner, `PRD.md` §16). Há ordem de **execução** preferível — ADR-001 antes de
> ADR-002 — que já está **consumada** (`ADR-001` entrou em `fe7c408` e `ADR-002` em `67e8162`), o que
> reduziu de 4 para 3 as citações de `prd-adr-pipeline` vivas e de 3 para 1 as que apontam para path de
> skill (`RESEARCH.md` §9-R4). Ordem de execução não é `depends_on`.
>
> **Enum de `status`:** `proposed` **não existe** (`INDEX_STATUS` em `checks.mjs:47` é
> `todo|in-progress|merged|dropped`); usá-lo reprovaria `ADR-02`.

| order | id | title | status | depends_on | dir | branch | merge |
|---|---|---|---|---|---|---|---|
| 1 | ADR-001 | Roster de agentes: 1 primário, `codebase-analyzer` absorvido pelo `architect`, stub do `code-reviewer` removido e saída do `sdd-orquestrador` | merged | — | ADRs/ADR-001-roster-de-agentes/ | adr/prd-harness-inventory/01-roster-de-agentes | feat(#4) `fe7c408` — merge humano 2026-11-11 |
| 2 | ADR-002 | `prd-adr-pipeline` como módulo de regra/checks: `checks.mjs` + 4 templates saem de `.agents/skills/` para `.opencode/plugins/lib/`, norma fica na rule | merged | — | ADRs/ADR-002-prd-adr-pipeline-modulo/ | adr/prd-harness-inventory/02-prd-adr-pipeline-modulo | feat(#5) `67e8162` — merge humano 2026-11-11 |
| 3 | ADR-003 | Agente `planner` (`subagent`, consome a skill `dev-planner`): escrita limitada a 4 artefatos de planejamento do ciclo SDD e zero poder de decisão | merged | ADR-001 | ADRs/ADR-003-agente-planner/ | adr/prd-harness-inventory/03-agente-planner | feat(#6) `f9c5ca2` — merge humano 2026-11-11 |
