# ADR-INDEX — `prd-harness-inventory`

> **Ledger 1:1 com `ADRs/**`** — uma linha por ADR existente no disco. Contrato das colunas
> (`.agents/rules/prd-adr-pipeline.md` §2): `order` inteiro ≥1 · `status` ∈ `todo|in-progress|merged|dropped`
> · `depends_on` declarado (`—` quando não há) · `dir` = `ADRs/ADR-00N-{slug}/` ·
> `branch` = `adr/{prd-id}/{nn}-{slug}` · `merge` preenchido **somente** quando `status=merged`.
>
> **Por que este índice tem 1 linha e não 5.** `ADR-01` (`checks.mjs:298-301`) exige 1:1 entre índice e
> disco: linha de índice sem `ADRs/<dir>/` correspondente é **FAIL**. Materializar as 5 linhas do
> fatiamento aprovado antes de os 5 diretórios existirem deixaria `node scripts/static-checks.mjs` em
> exit 1 (5× *"linha do índice sem dir correspondente"*), contra o RF-08 e a regra H2. A forma escolhida
> é a do precedente da casa (`02e7f96`): **o índice nasce com o primeiro ADR**, e cada linha nova entra
> no mesmo commit do seu `ADR.md`. É a saída (a) do risco **R8** do `RESEARCH.md` §9.
>
> **O plano completo dos 5 ADRs não se perde:** vive em `workflow-state.json.prd_adr.adr_plan` (5 entradas
> com `order`, `id`, `titulo`, `depende_de`, `branch`) e em `PRD.md` §16 (fatiamento aprovado pelo owner
> em 2026-11-11). Este arquivo é o ledger **do que existe**, não o plano do que existirá. A regra não
> proíbe buraco de `order` (a continuidade não é imposta por `ADR-01`/`ADR-02`); a linha `order 1` é a
> única existente hoje e é a primeira do plano.
>
> **Estado:** `ADR-001` em `in-progress` (branch criada, `ADR.md` escrito, nenhum merge). `merge` fica `—`
> em toda linha com `status ≠ merged`. As linhas de `ADR-002`…`ADR-005` entram uma a uma, cada uma junto
> do seu diretório — nunca antes.
>
> **Ordem de merge:** `ADR-003` declara `depends_on: ADR-001` (o `planner` entra no roster que o ADR-001
> define). `ADR-002`, `ADR-004` e `ADR-005` não têm dependência declarada (decisão do owner, `PRD.md` §16).
> Há ordem de **execução** preferível — ADR-001 antes de ADR-002 reduz de 4 para 3 as citações de
> `prd-adr-pipeline` a reapontar (`RESEARCH.md` §9-R4) — mas ordem de execução não é `depends_on`.
>
> **Enum de `status`:** `proposed` **não existe** (`INDEX_STATUS` em `checks.mjs:47` é
> `todo|in-progress|merged|dropped`); usá-lo reprovaria `ADR-02`.

| order | id | title | status | depends_on | dir | branch | merge |
|---|---|---|---|---|---|---|---|
| 1 | ADR-001 | Roster de agentes: 1 primário, `codebase-analyzer` absorvido pelo `architect`, stub do `code-reviewer` removido e saída do `sdd-orquestrador` | in-progress | — | ADRs/ADR-001-roster-de-agentes/ | adr/prd-harness-inventory/01-roster-de-agentes | — |
