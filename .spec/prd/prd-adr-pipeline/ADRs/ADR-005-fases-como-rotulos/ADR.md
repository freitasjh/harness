# ADR-005 — Fases da esteira são rótulos do vocabulário canônico

> Unidade de decisão: 1 ADR = 1 branch = 1 PR (merge humano). **Neste meta-ciclo a branch não foi criada**: a realização foi por `PAP-07` na branch única `feat/prd-adr-pipeline` — a coluna `branch` do `ADR-INDEX.md` registra o **nome planejado**, não um fato consumado (convenção no topo do índice).
> **Realizado por**: `PAP-07` — commit `60335b0` (convenção de `status`/`merge` no `ADR-INDEX.md`).
> **Ref da SPEC**: `ADR-P05` · **Requisitos**: `RF-06`, `NFR-6`, `V17`.

- **Decisão**: nenhum valor novo em `current_phase`. `PRD`/`RESEARCH` → `Discovery`; `ADR-INDEX`/`ADR` → `Planning`; execução por ADR → `Execution`; review/harness → `Testing`; fim → `Completed`. A tabela V17 de `workflow-rules.md` ganha as linhas novas **preservando** os marcadores existentes.
- **Motivo**: **correção de premissa** (achada no review do `PAP-07`): `gate.js` **não** valida um conjunto canônico de `current_phase` — ele só compara com `Completed`. E `V17` prova apenas o **marcador** da tabela, não o conteúdo das linhas. Logo, um valor inventado **não** é recusado por mecanismo algum: a proteção real é a tabela canônica de `sdd-workflow-standard.md` + processo (🟡). O que se ganha aqui é vocabulário consistente, não um deny.
- **Alternativas descartadas**: (a) adotar o vocabulário de fases de um toolkit externo (ex.: `constitution/specify/plan/tasks/implement/converge`) — fonte: https://github.com/github/spec-kit — descartada: importaria um ciclo de vida paralelo e valores novos de `current_phase` (proibido por `NFR-6`), sem ganho sobre o vocabulário canônico vigente; (b) criar valores novos de `current_phase` (`PRD`, `ADR`) — descartada: sem mecanismo de recusa e contra `NFR-6`, a "fase" seria só prosa.
- **depende-de**: — (o vocabulário de fase é ortogonal às decisões técnicas: não consome `ADR-001`, `ADR-002`, `ADR-003` nem `ADR-004` — é a ponta declarada em `ADR-001`)
- **Interface congelada**: nenhum valor novo em `current_phase`; mapa `PRD/RESEARCH→Discovery`, `ADR-INDEX/ADR→Planning`, execução→`Execution`, review→`Testing`, fim→`Completed`. Consumido por: `workflow-state.json` (compatível com `gate.js`, que só compara `Completed`) e a tabela V17.
- **Fora desta decisão**: o layout dos artefatos e o contrato do `ADR.md` (`ADR-004`).
- **Consequências se estiver errado**: o `workflow-state.json` não distingue "fazendo PRD" de "explorando" sem ler o artefato, e nenhum mecanismo recusa um rótulo inventado. Reversível: manter o vocabulário canônico — nenhuma migração de dados.
- **Status**: merged
