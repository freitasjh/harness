# PLAN — harness-inventory-adr-005

> Execução do ADR-005 na branch `adr/prd-harness-inventory/05-prosa-orfa` (base `32c469d`).

## 1. Fases

### Fase 1 — Módulo de checks (RF-01..RF-04)
1. Criar `.opencode/plugins/lib/refs/checks.mjs`: puro, `runRefsChecks(root)` → `{ ok, results[] }`.
   - `BASELINE`: 7 entradas (`security-standard.md` e `unit-testing-standards.md` = `live-orphan`; `backend-coding-standards`, `backend-integration-tests`, `backend-unit-tests`, `db-migration-flyway`, `db-migration-liquibase` = `foreign-baseline`), cada uma com `path`, `class`, `reason`, `owner`.
   - `NON_DEFECT`: `exemplo.md` com `reason` + `proof`.
   - Varredura: `grep` de `rules/<slug>.md` + caminhos de `.doc/`/`AGENTS.md`/`frontend/DESIGN.md` **apenas** em citantes vivos; compara com o disco.
2. Modo (a): referência viva ausente fora do baseline ⇒ `FAIL` com path e citante.
3. Modo (b): entrada do baseline que não está mais ausente ⇒ `FAIL` `baseline-stale`.

### Fase 2 — Fixtures (RF-05)
4. `refs.spec.mjs`: fixture de escopo (mesmo texto em `.agents/` e `docs/` → só o primeiro conta), fixture de vendor-internal, fixture de `NON_DEFECT`, e as 2 de falha (novo órfão; baseline obsoleto).

### Fase 3 — Adapter (RF-06)
5. `scripts/static-checks.mjs`: importar e registrar `record("V18", …)`. **Nenhum** comando novo em `commands.suiteFull`.

### Fase 4 — Autor único (RF-07) — ⚠️ paths protegidos
6. `dev-planner/workflow.md`: `PLAN` sai do diagrama (`:20-21`), de `:420`, `:434`; `:408` vira handoff ao `sdd-compiler`.
7. `dev-planner/workflow.md`: template de ADR (`:199-225`) vira "alternativas + trade-off + recomendação" sem `## ADR-00N` nem `### Status`.
8. `orchestrator/AGENT.md`: `:285` deixa de mandar gerar `EXPLORATION.md` (autor é o `planner`); tabela de delegação (`:565-580`) ganha a linha `planner`.
9. `workflow-rules.md`: gatilho da Fase 0 alinhado à lista de isenção; somem "complexas/inovações" e "Feature simples" como critérios concorrentes.
10. Commit com trailer `Harness-Gate-Change: ADR-005 (prosa orfa) — rubric em mecanismo (refs/checks + V18) e autor unico em 5 paths`.

### Fase 5 — Verificação (RF-08)
11. 5 comandos; `git diff --stat` de `harness.config.json` vazio; V18 presente no static.

## 2. Constraint mapping

| Constraint | Onde |
|---|---|
| Check não escreve (I1) | Fase 1 item 1 |
| Baseline é dívida com dono (I2) | Fase 1 item 1 |
| Escopo por path do citante (I3) | Fase 1 item 2 + Fase 2 |
| Nenhuma rule nova (I4) | Fase 4 |
| Autor único muda quem, não o quê (I5) | Fase 4 |

## 3. Caminho crítico

`F1 → F3 → F5` — V18 registrado sem o módulo puro deixa o static vermelho no commit.

## 4. Rollback

`git reset --hard 32c469d`.
