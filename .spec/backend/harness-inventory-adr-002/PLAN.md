# PLAN — harness-inventory-adr-002

> Execução do ADR-002 na branch `adr/prd-harness-inventory/02-prd-adr-pipeline-modulo` (base `74b3153`).

## 1. Fases

### Fase 1 — Mover (RF-01, RF-02, I1)
1. `git mv .agents/skills/prd-adr-pipeline/checks.mjs .opencode/plugins/lib/prd-adr-pipeline/checks.mjs`
2. `git mv .agents/skills/prd-adr-pipeline/templates/ .opencode/plugins/lib/prd-adr-pipeline/templates/`
3. Remover o diretório vazio `.agents/skills/prd-adr-pipeline/`.

**Checkpoint:** `ls -d .agents/skills/*/ | wc -l` = 48; `find .agents/skills -maxdepth 2 -name SKILL.md | wc -l` = 48.

### Fase 2 — Consumidores (RF-03..RF-06)
4. `scripts/static-checks.mjs:28` → `../.opencode/plugins/lib/prd-adr-pipeline/checks.mjs`.
5. `prd-checks.spec.mjs:29` → path novo; `:1125-1129` (4 templates) derivam de `LIB`; `:915-923` (guard de pureza) relê o path novo.
6. Remover a prosa `"Lives under ... only path the installer propagates"` de `checks.mjs` e o comentário equivalente em `static-checks.mjs`.

### Fase 3 — Instalador e eixos (RF-07, RF-08)
7. `installer/install.mjs:419` — remover `'prd-adr-pipeline',` de `SKILLS_COMMON` (**não** tocar `:384`).
8. Conferir os 3 guardas de enumeração em `installer/__tests__/**` (recomputam do disco; não editar).

**Checkpoint:** `grep -c "prd-adr-pipeline" installer/install.mjs` = **1**; 559 pass.

### Fase 4 — Prosa e rules (RF-09, RF-10) — ⚠️ paths protegidos
9. `orchestrator/AGENT.md:273`; `.agents/rules/prd-adr-pipeline.md:63-65`; `.agents/rules/workflow-rules.md:322`; `docs/FUNCIONAMENTO.md:109,138,484,538`.
10. Commit com trailer: `Harness-Gate-Change: ADR-002 (modulo prd-adr-pipeline) — move codigo+4 templates para .opencode/plugins/lib; norma segue na rule; 1 linha de SKILLS_COMMON`.

### Fase 5 — Verificação (RF-01, RF-11, RF-12)
11. Prova de propagação: `collectIncoming` em 4 stacks (`5 / 0`) + instalação real em `/tmp` (`find | wc -l` = 5) + `__tests__` não entregues.
12. Suíte completa, `static-checks`, `sdd-checks`, `vendor --check`; `git diff --stat` de `gate.js`/`harness.config.json` vazio.

## 2. Constraint mapping

| Constraint | Onde |
|---|---|
| `git mv`, nunca cópia (I1) | Fase 1 |
| Norma em 1 lugar (I2) | Fase 4 só reaponta path |
| Pureza preservada (I3) | Fase 2 item 6 + RF-05 |
| Selo intocado (I4) | Fase 5 item 12 |
| Gate por eixo intacto (I5) | Fase 3 |
| `:384` fica (E1) | Fase 3, item 7 |

## 3. Caminho crítico

`F1 → F2 → F4.12` — mover sem reapontar deixa o `static-checks` vermelho no mesmo comando que o CI roda.

## 4. Rollback

`git reset --hard 74b3153` (nada foi pushado).
