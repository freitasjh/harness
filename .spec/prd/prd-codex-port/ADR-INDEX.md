# ADR-INDEX — prd-codex-port

> Ledger 1:1 com `ADRs/**`: uma linha por ADR; a ordem é a de merge.
> Contrato das colunas (`.agents/rules/prd-adr-pipeline.md` §2 / `checks.mjs`):
> `order` inteiro ≥1 · `status` ∈ todo|in-progress|merged|dropped · `depends_on` declarado (`—` quando não há) ·
> `dir` = `ADRs/ADR-00N-{slug}/` · `branch` = `adr/{prd-id}/{nn}-{slug}` · `merge` preenchido quando `status=merged` ·
> `unit` ∈ `adr`|`legacy` (estrito minúsculas); `unit: adr` = o diretório carrega `ADR.md` + `SPEC.md` + `TASKS.md`.
>
> **Estado transitório declarado.** As 3 linhas nascem no mesmo commit do respectivo `ADR.md` (1:1, sem stub).
> `unit: adr` exige `SPEC.md` e `TASKS.md` no diretório; esses dois são gerados pelo `sdd-compiler`
> logo após cada ADR. Até lá `ADR-01` reprova com `unit=adr sem SPEC.md`/`unit=adr sem TASKS.md` —
> falha transitória esperada, não drift. `PRD-01` e `ADR-02` não dependem desses arquivos e devem passar.
> `merge` fica `—` enquanto `status=todo`; o merge é humano (`.agents/rules/prd-adr-pipeline.md` §4).
> Ordem de merge: 1 → 2 → 3 (ADR-002 reaproveita o contrato de ADR-001; ADR-003 reaproveita ADR-002).

| order | id | title | status | depends_on | dir | branch | merge | unit |
|---|---|---|---|---|---|---|---|---|
| 1 | ADR-001 | Inventário e contrato de paridade opencode↔Codex | todo | PRD | ADRs/ADR-001-inventario-contrato | adr/prd-codex-port/01-inventario-contrato | — | adr |
| 2 | ADR-002 | Hooks e gates no Codex (PreToolUse, reason codes, kill-switch) | todo | ADR-001 | ADRs/ADR-002-hooks-gates-codex | adr/prd-codex-port/02-hooks-gates-codex | — | adr |
| 3 | ADR-003 | Agentes, regras, config e instalador repo-local (.codex/) | todo | ADR-002 | ADRs/ADR-003-agentes-regras-installer | adr/prd-codex-port/03-agentes-regras-installer | — | adr |