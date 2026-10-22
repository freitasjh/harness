# ADR-INDEX — prd-garantias-runtime

> Ledger 1:1 com `ADRs/**`: uma linha por ADR; a ordem é a de merge.
> Contrato das colunas (SPEC §4.2): `order` inteiro ≥1 · `status` ∈
> todo|in-progress|merged|dropped · `depends_on` declarado (`—` quando não há) ·
> `dir` = `ADRs/ADR-00N-{slug}/` · `branch` = `adr/{prd-id}/{nn}-{slug}` ·
> `merge` preenchido quando `status=merged`.
> `merge` = `—` em todas as linhas: nenhum ADR deste ciclo foi implementado
> ainda (as 4 decisões estão em `todo`, aguardando o portão do ciclo SDD scoped).
> A ordem de merge é 1 → 2 → 3 → 4: `ADR-002` reaproveita o dispatcher que
> `ADR-001` altera; `ADR-004` verifica a prosa que `ADR-001`..`ADR-003` reescrevem.

| order | id | title | status | depends_on | dir | branch | merge |
|---|---|---|---|---|---|---|---|
| 1 | ADR-001 | O modo efetivo de um gate vive no env do processo host | todo | — | ADRs/ADR-001-modo-gate-no-env/ | adr/prd-garantias-runtime/01-modo-gate-no-env | — |
| 2 | ADR-002 | Config indisponível nega toda tool call (fail-closed no dispatcher) | todo | ADR-001 | ADRs/ADR-002-config-indisponivel-nega-toda-tool/ | adr/prd-garantias-runtime/02-config-indisponivel-nega-toda-tool | — |
| 3 | ADR-003 | A contraproveva declara o que verificou (counts opcional no schema) | todo | — | ADRs/ADR-003-contraprova-declara-verificacao/ | adr/prd-garantias-runtime/03-contraprova-declara-verificacao | — |
| 4 | ADR-004 | Check estático de conformidade da prosa de garantia (`V18`) | todo | ADR-003 | ADRs/ADR-004-check-estatico-prosa-de-garantia/ | adr/prd-garantias-runtime/04-check-estatico-prosa-de-garantia | — |
