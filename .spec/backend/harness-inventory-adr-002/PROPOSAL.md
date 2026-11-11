# PROPOSAL — harness-inventory-adr-002

> Ciclo SDD escopado do **ADR-002 do PRD-1** (`prd-harness-inventory`).
> Fonte da verdade: `.spec/prd/prd-harness-inventory/ADRs/ADR-002-prd-adr-pipeline-modulo/ADR.md` (380 linhas, 12 itens, aprovado no G2 em 2026-11-11).

## 1. Problema (medido 2026-11-11)

| Fato | Número |
|---|---|
| Diretórios em `.agents/skills/` sem `SKILL.md` | 1 de 49 (`prd-adr-pipeline/`) |
| Conteúdo do diretório | `checks.mjs` + `templates/` (4 templates) — é código + template, não skill |
| Agentes que o citam como skill | 3 (`product-manager`, `orchestrator`, `architect`) |
| Prosa falsa no próprio código | `checks.mjs:15-16`: *"Lives under `.agents/skills/**` because that is the only path the installer propagates"* — o layer `.opencode/plugins` **já** é propagado (`installer/install.mjs:107`, `INCOMING_ROOTS:1690`) e já entrega `lib/config.mjs` + `lib/seal.mjs` |
| Custo da correção no instalador | **1 linha** (`:419`, `SKILLS_COMMON`) — `:384` (`RULES_COMMON`) **fica** |

## 2. Proposta

Mover `checks.mjs` + `templates/` para `.opencode/plugins/lib/prd-adr-pipeline/`, deixar a norma na rule `.agents/rules/prd-adr-pipeline.md`, e remover `'prd-adr-pipeline'` de `SKILLS_COMMON`. Resultado: `.agents/skills/` fica uniforme (48/48 com `SKILL.md`), a prosa falsa morre e o repo-destino continua recebendo os 5 arquivos — provado em 4 stacks.

## 3. Escopo

Os 12 itens de interface do `ADR.md` §3, nada além.

## 4. Não-escopo

Agnosticização de conteúdo (PRD 2), `planner` (ADR-003), inventário derivado (ADR-004), prosa órfã (ADR-005). `commands.suiteFull` e `harness.config.json` intocados (item 11). `RULES_COMMON:384` preservado (item 8).

## 5. Riscos

| # | Risco | Mitigação |
|---|---|---|
| Q1 | `git mv` parcial deixa import quebrado (2 sítios + 2 helpers do spec) | item 3 e 4 com `grep` de prova |
| Q2 | `sed` cego remove `:384` e o destino perde a rule | item 8 congela `grep -c` = **1** |
| Q3 | Mudança em `LAYER_PREFIX`/`SKILLS_COMMON` quebra os 3 guardas de enumeração | item 7 recomputa do disco; 0 literais nos testes |
| Q4 | `.opencode/plugins/**` e `.agents/rules/**` são `protectedPaths` | trailer `Harness-Gate-Change` |
| Q5 | Selo republicado por engano | `commands.suiteFull` intocado; `git diff` vazio em `harness.config.json` |

## 6. Verificação

`node --test ".opencode/plugins/__tests__/*.spec.mjs"`, `node --test "installer/__tests__/*.spec.mjs"`, `node scripts/static-checks.mjs`, `node scripts/sdd-checks.mjs`, `node scripts/vendor-skills.mjs --check` — todos exit 0; e a prova de propagação (item 1) em 4 stacks.
