# ADR-004 — `ADR.md` é a unidade; o SDD dentro do ADR é scoped e não é ciclo autônomo

> Unidade de decisão: 1 ADR = 1 branch = 1 PR (merge humano). **Neste meta-ciclo a branch não foi criada**: a realização foi por `PAP-05` na branch única `feat/prd-adr-pipeline` — a coluna `branch` do `ADR-INDEX.md` registra o **nome planejado**, não um fato consumado (convenção no topo do índice).
> **Realizado por**: `PAP-05` — commit `2534930` (convenção de `status`/`merge` no `ADR-INDEX.md`).
> **Ref da SPEC**: `ADR-P04` · **Requisitos**: `RF-03`, `INV-1`, `INV-2`, `INV-3`.

- **Decisão**: cada `ADRs/ADR-00N-{slug}/` contém `ADR.md` (+ `SPEC.md`/`PLAN.md`/`TASKS.md`/`VERIFY.md` scoped, **exceto** a exceção declarada em `SPEC §4.4`). O `ADR.md` carrega os campos mínimos: decisão, motivo, alternativas descartadas + fonte, `depende-de`, interface congelada, fora desta decisão, consequências se estiver errado, status.
- **Motivo**: sem `depende-de` + interface congelada, "ADRs independentes" é aspiração — o ADR seguinte quebra no merge porque herdou contrato implícito do anterior. Transformar os dois em campo obrigatório torna a independência **verificável** por check, não declarada em prosa.
- **Alternativas descartadas**: (a) um documento único de arquitetura, sem unidade por decisão — fonte: https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions ("documentos grandes nunca são mantidos"; o registro por decisão é pequeno e revisável) — descartada; (b) MADR com front-matter YAML como forma canônica — fonte: https://adr.github.io/madr/ (útil, mas o check é estrutural e lê markdown simples; YAML adiciona parser sem ganho) — descartada como forma, mantendo o espírito (campo de status + links entre ADRs).
- **depende-de**: ADR-002
- **Interface congelada**: `ADRs/ADR-00N-{slug}/ADR.md` contém literalmente `depende-de` e `interface congelada`; `ADR-INDEX.md` é ledger 1:1 com o disco, 8 colunas (`order,id,title,status,depends_on,dir,branch,merge`). Consumido por: `ADR-01`/`ADR-02` e o `code-reviewer`.
- **Fora desta decisão**: o conteúdo dos checks, o vocabulário de fase (`ADR-005`) e o layout do `PRD.md`.
- **Consequências se estiver errado**: a independência vira aspiração e o ADR seguinte quebra no merge por contrato implícito herdado. Reversível: acrescentar/ajustar o campo no `ADR.md` (aditivo).
- **Status**: merged
