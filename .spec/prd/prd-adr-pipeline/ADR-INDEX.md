# ADR-INDEX — prd-adr-pipeline

> Ledger 1:1 com `ADRs/**`: uma linha por ADR; a ordem é a de merge.
> Contrato das colunas (SPEC §4.2): `order` inteiro ≥1 · `status` ∈
> todo|in-progress|merged|dropped · `depends_on` declarado (`—` quando não há) ·
> `dir` = `ADRs/ADR-00N-{slug}/` · `branch` = `adr/{prd-id}/{nn}-{slug}` ·
> `merge` preenchido quando `status=merged`.

## Convenção dos desvios declarados neste meta-ciclo (dogfood)

Este ciclo roda a esteira **sobre si mesma**: os 5 ADRs abaixo são as decisões de
`SPEC §1` (ADR-P01..ADR-P05), **já realizadas** por `PAP-01`..`PAP-09`. O enum de
`status` não tem o valor "implementado", então o mapeamento honesto adotado é:

- `status=merged` = **a decisão já foi realizada** (não significa "mergeada para `main`").
- `merge` = **o sha do commit que realizou a decisão**. No meta-ciclo o "merge" é o
  commit de realização, não um merge para `main` — este não ocorreu: o merge é humano
  e acontece no fechamento do ciclo (`prd-adr-pipeline.md §4`).
- Um mesmo commit pode realizar **mais de uma** decisão; quando isso acontece o mesmo
  sha aparece em duas linhas. Registrado, não escondido: `ADR-003` e `ADR-004` foram
  ambos realizados por `2534930` (`PAP-04` wiring no `static-checks` + `PAP-05` templates).
- `621d6e8` (`PAP-08/09`, wiring dos agentes + conserto de drift) **não** aparece:
  ele **consome** estas decisões, não realiza nenhuma delas — por isso nenhuma linha
  aponta para ele.
- `branch` = **o nome planejado**, não um fato consumado. As 5 branches
  `adr/prd-adr-pipeline/NN-*` **não foram criadas** neste meta-ciclo (`git branch -a` →
  só `feat/prd-adr-pipeline` e `main`): a realização das 5 decisões foi por
  `PAP-01`..`PAP-09` na **branch única** `feat/prd-adr-pipeline`. A coluna é exigida
  pelo contrato (`ADR-02` valida o padrão `adr/{prd-id}/{nn}-{slug}`) e registra a
  intenção; a operação real de branch/PR é a de `prd-adr-pipeline.md §4` (merge humano).
- **Retroatividade**: este ledger — como o `PRD.md` — é **posterior** à realização das
  decisões. O meta-ciclo rodou a esteira sobre si mesma: a aprovação humana do
  *conteúdo* precedeu as decisões no portão `P1→P2`/`PROPOSAL` (2026-10-15), enquanto os
  commits de realização (`merge` das linhas abaixo) são de 2026-10-15 e o bloco de
  aprovação do `PRD.md` é de 2026-10-16. Exceção declarada em `SPEC §4.4` ("PRD
  retroativo ao próprio ciclo"): o dogfood prova **formato e checks**, não a ordenação
  temporal.

| order | id | title | status | depends_on | dir | branch | merge |
|---|---|---|---|---|---|---|---|
| 1 | ADR-001 | `.spec/prd/**` é bucket non-cycle no resolver | merged | — | ADRs/ADR-001-prd-bucket-non-cycle/ | adr/prd-adr-pipeline/01-prd-bucket-non-cycle | d8073b2 |
| 2 | ADR-002 | Módulo de checks vive no path propagável (`.agents/skills/**`) | merged | ADR-001 | ADRs/ADR-002-checks-path-propagavel/ | adr/prd-adr-pipeline/02-checks-path-propagavel | 1feb05c |
| 3 | ADR-003 | Enforcement = suíte + CI, nunca deny de runtime | merged | ADR-002 | ADRs/ADR-003-enforcement-suite-ci/ | adr/prd-adr-pipeline/03-enforcement-suite-ci | 2534930 |
| 4 | ADR-004 | `ADR.md` é a unidade; o SDD dentro do ADR é scoped | merged | ADR-002 | ADRs/ADR-004-adr-como-unidade/ | adr/prd-adr-pipeline/04-adr-como-unidade | 2534930 |
| 5 | ADR-005 | Fases da esteira são rótulos do vocabulário canônico | merged | — | ADRs/ADR-005-fases-como-rotulos/ | adr/prd-adr-pipeline/05-fases-como-rotulos | 60335b0 |
