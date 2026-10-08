# Tech Debt — wired do `vendor --check` + installer tests no CI/suiteFull

- **Origem:** code review Batch 2 (🟡-5 + follow-up). ADR-009 declara enforcement no CI; I9 🟢 não factual.
- **Classificação:** **P2** (não bloqueia Batch 2; fecha a garantia de drift)

## Problema
- `commands.suiteFull` = `node --test plugins/__tests__` + `static-checks.mjs`.
- Ficam **fora**: `node scripts/vendor-skills.mjs --check` e `installer/__tests__/*.spec.mjs` (117 testes).
- `vendor --check` roda só manualmente ⇒ drift de vendor/licença escapa.

## Ação
- Adicionar ao `suiteFull` (e/ou job CI `harness-integrity.yml`):
  `node scripts/vendor-skills.mjs --check` e `node --test installer/__tests__/*.spec.mjs`.
- Paths protegidos (`.github/workflows/**`, `harness.config.json`) ⇒ trailer `Harness-Gate-Change`.

## Aceite
- `commands.suiteFull` inclui `--check` + installer tests; CI roda ambos.
- Remover "🟢" de I9/ADR-009 (passa a 🟢 real só após wired).

## Dono
Orchestrator (edição de governança) + developer-engineer (se tocar CI) → review.
