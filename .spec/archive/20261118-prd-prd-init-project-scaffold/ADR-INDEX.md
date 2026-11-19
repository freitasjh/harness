# ADR-INDEX — prd-init-project-scaffold

> Ledger 1:1 com `ADRs/**`: uma linha por ADR; a ordem é a de merge. Contrato das colunas
> (`.agents/rules/prd-adr-pipeline.md` §2): `order` inteiro ≥1 · `status` ∈
> todo|in-progress|merged|dropped · `depends_on` declarado (`—` quando não há) ·
> `dir` = `ADRs/ADR-00N-{slug}/` · `branch` = `adr/{prd-id}/{nn}-{slug}` · `merge`
> preenchido somente quando `status=merged` · `unit` ∈ `adr`|`legacy` (`adr` = o
> diretório carrega `ADR.md` + `SPEC.md` + `TASKS.md`).
>
> **Estado transitório declarado.** A linha 1 nasceu no mesmo commit do seu `ADR.md`
> (1:1, sem stub). `unit: adr` exige `SPEC.md` e `TASKS.md` no diretório; esses dois
> são gerados pelo `sdd-compiler` logo após esta decisão. Até lá `ADR-01` reprova com
> `unit=adr sem SPEC.md`/`unit=adr sem TASKS.md` — falha transitória esperada, não drift.
> `PRD-01` e `ADR-02` não dependem desses arquivos e devem passar. `merge` fica vazio
> enquanto `status=in-progress`; o merge é humano (`.agents/rules/prd-adr-pipeline.md` §4).

| order | id | title | status | depends_on | dir | branch | merge | unit |
|---|---|---|---|---|---|---|---|---|
| 1 | ADR-001 | Seção gerenciada delimitada em AGENTS.md/DESIGN.md, artefatos próprios em create-or-skip e stack por detecção com override: identidade do init sem sobrescrever arquivo vivo | merged | — | ADRs/ADR-001-managed-section-scaffold/ | adr/prd-init-project-scaffold/01-managed-section-scaffold | efcae5b (PR #25) | adr |
