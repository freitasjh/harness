# ADR-003 — Enforcement = suíte + CI, nunca deny de runtime

> Unidade de decisão: 1 ADR = 1 branch = 1 PR (merge humano). **Neste meta-ciclo a branch não foi criada**: a realização foi por `PAP-04` na branch única `feat/prd-adr-pipeline` — a coluna `branch` do `ADR-INDEX.md` registra o **nome planejado**, não um fato consumado (convenção no topo do índice).
> **Realizado por**: `PAP-04` — commit `2534930` (convenção de `status`/`merge` no `ADR-INDEX.md`).
> **Ref da SPEC**: `ADR-P03` · **Requisitos**: `RF-04`, `INV-5`.

- **Decisão**: nenhum deny novo em `gate.js`. Os checks entram por `scripts/static-checks.mjs`, que o `commands.suiteFull` já executa — e que o CI `harness-integrity.yml` também roda. Nível de garantia declarado: **🟢 neste repo**, **🟡 processo** no repo-destino.
- **Motivo**: `R-NODENY` falha se `gate.js` ganhar `DENY_SDD`/`DENY_ARTIFACT`/`artifact-gate`; e alterar `commands.suiteFull` mudaria o selo e quebraria a contraprova. Além disso, um deny de formato falso-positivo bloquearia trabalho legítimo.
- **Alternativas descartadas**: (a) deny de runtime no plugin — bloquearia de imediato, mas arrisca falso-positivo e exige editar `gate.js`; fonte: https://pre-commit.com/ (a barreira útil é apontar o problema antes da revisão, não negar a ferramenta) — descartada; (b) check só no CI, fora da suíte local — fonte: https://martinfowler.com/articles/continuousIntegration.html (o build precisa ser self-testing e reproduzível localmente, não só no serviço de CI) — descartada, pois perderia o feedback local.
- **depende-de**: ADR-002
- **Interface congelada**: os 3 checks aparecem no relatório de `scripts/static-checks.mjs`; `commands.suiteFull` e `harness.config.json` **inalterados**; `gate.js` sem `DENY_*` novo. Consumido por: `R-NODENY`, o selo do `suiteFull` e o CI `harness-integrity.yml`.
- **Fora desta decisão**: o conteúdo dos checks (`ADR-002` / `SPEC §5`) e a propagação do CI ao repo-destino (declarada 🟡, não prometida).
- **Consequências se estiver errado**: nada impede, no runtime, começar a implementar sem PRD — a esteira fica sem barreira até o check da integração. Reversível: ligar o check em outro ponto (CI dedicado), sem tocar os artefatos.
- **Status**: merged
