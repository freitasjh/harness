# ADR-002 — Módulo de checks vive no path propagável (`.agents/skills/**`)

> Unidade de decisão: 1 ADR = 1 branch = 1 PR (merge humano). **Neste meta-ciclo a branch não foi criada**: a realização foi por `PAP-03` na branch única `feat/prd-adr-pipeline` — a coluna `branch` do `ADR-INDEX.md` registra o **nome planejado**, não um fato consumado (convenção no topo do índice).
> **Realizado por**: `PAP-03` — commit `1feb05c` (convenção de `status`/`merge` no `ADR-INDEX.md`).
> **Ref da SPEC**: `ADR-P02` · **Requisitos**: `RF-02`, `NFR-4`.

- **Decisão**: os checks `PRD-01`/`ADR-01`/`ADR-02` são implementados em `.agents/skills/prd-adr-pipeline/checks.mjs` (módulo puro, exporta `runPrdChecks(root)`); `scripts/static-checks.mjs` apenas importa e chama. Nada de lógica nova sob `scripts/`.
- **Motivo**: `INCOMING_ROOTS` do installer propaga `.agents/agents`, `.agents/rules`, `.agents/skills`, `.opencode/plugins` e `opencode.json` — **não** propaga `scripts/` nem `.github/`. Check que viva só em `scripts/` vira **gate órfão** no repo-destino: a regra propaga prometendo enforcement que não existe lá.
- **Alternativas descartadas**: (a) implementar os checks dentro de `scripts/static-checks.mjs` (mais perto do adaptador, mas não propaga) — fonte: https://pre-commit.com/ (o valor do hook é ser compartilhável entre projetos; check não-propagável não compartilha) — descartada; (b) publicar os checks como pacote/CLI separado — descartada por `NFR-3` (zero dependência nova) e por acoplar o repo-destino a uma instalação extra.
- **depende-de**: ADR-001
- **Interface congelada**: `runPrdChecks(root)` → `{ ok: boolean, results: [{ id, status: "PASS"|"FAIL", detail }] }`, com exatamente os ids `PRD-01`/`ADR-01`/`ADR-02` nessa ordem; puro (read-only `node:fs`/`node:path`; sem rede, sem MCP, sem escrita, sem `exec`). Consumido por: `scripts/static-checks.mjs` e o repo-destino.
- **Fora desta decisão**: o formato e o conteúdo de cada check (decididos com a SPEC §5) e o ponto de enforcement (`ADR-003`); não decide o layout dos artefatos.
- **Consequências se estiver errado**: o módulo deixa de propagar e a regra da esteira promete, no destino, um check que não roda (gate órfão). Reversível: mover o módulo e ajustar o `import`, sem mudança de contrato de dados.
- **Status**: merged
