# ADR-001 — `.spec/prd/**` é bucket non-cycle no resolver

> Unidade de decisão: 1 ADR = 1 branch = 1 PR (merge humano). **Neste meta-ciclo a branch não foi criada**: a realização foi por `PAP-01` na branch única `feat/prd-adr-pipeline` — a coluna `branch` do `ADR-INDEX.md` registra o **nome planejado**, não um fato consumado (convenção no topo do índice).
> **Realizado por**: `PAP-01` — commit `d8073b2` (convenção de `status`/`merge` no `ADR-INDEX.md`).
> **Ref da SPEC**: `ADR-P01` · **Requisitos**: `RF-01`, `INV-4`.

- **Decisão**: a const `SPEC_NON_CYCLE` (em `scripts/sdd-checks.mjs`) passa a incluir `"prd"`, e `.spec/prd/**` sai da detecção de ciclo SDD; a validação dos ADRs passa a ser feita por check dedicado (`ADR-01`/`ADR-02`), **nunca** pelo `SDD-02`.
- **Motivo**: o resolver trata todo bucket de `.spec/` fora de `SPEC_NON_CYCLE` como grupo de ciclo (`sddCycleCandidates`/`resolveSddCycle`) e `SDD_ARTIFACTS` exige `PROPOSAL.md` — que o layout PRD não tem. Sem esta decisão, materializar o próprio PRD derruba a suíte; `PAP-11` é justamente o pior caso, com `prd-id == current_feature`.
- **Alternativas descartadas**: (a) tratar `.spec/prd/**` como bucket de ciclo e dar a ele um `PROPOSAL.md`/`TASKS.md` — fonte: https://adr.github.io/ (ADR é o registro de **uma** decisão; um ciclo SDD por artefato de produto contradiz a unidade pequena) — descartada; (b) manter o `SDD-02` como validador do ADR — descartada, pois `SDD_ARTIFACTS` não modela `ADR-INDEX.md`/`ADRs/**`, e o check dedicado é o que prova o 1:1.
- **depende-de**: — (decisão de fundação; consumida por `ADR-002`..`ADR-004` — `ADR-003` e `ADR-004` a consomem pela cadeia que passa por `ADR-002`. `ADR-005` **não** a consome: nenhum artefato que ele toca (`workflow-state.json`, tabela V17) lê `.spec/prd/**`, e o `depende-de` dele é `—`)
- **Interface congelada**: `isNonCycleRel(".spec/prd/**") === true`; `.spec/prd/**` nunca é candidato de ciclo do `sdd-checks`; o `SDD-02` continua resolvendo o ciclo SDD real. Consumido por: `ADR-002`..`ADR-004` e pela materialização de `.spec/prd/**` (`PAP-11`).
- **Fora desta decisão**: o layout dos ADRs, o contrato do índice, o conteúdo dos checks e o enforcement — não decide `gate.js` nem o selo do `suiteFull`.
- **Consequências se estiver errado**: `.spec/prd/**` volta a ser candidato de ciclo → `SDD-02` acusa drift (vermelho) ou, pior, resolve outro ciclo e valida o `TASKS.md` alheio (verde-falso). Reversível: remover `"prd"` do set (1 linha) + reverter o teste de regressão.
- **Status**: merged
