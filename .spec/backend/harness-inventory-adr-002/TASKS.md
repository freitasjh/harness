# TASKS — harness-inventory-adr-002

> Execução do ADR-002 na branch `adr/prd-harness-inventory/02-prd-adr-pipeline-modulo` (base `74b3153`).

## Microtasks (TDD-ready)

### PA-01
- [x] `git mv` de `checks.mjs` + `templates/` (4 arquivos) para `.opencode/plugins/lib/prd-adr-pipeline/`; remover o diretório antigo (RF-01, I1).

### PA-02
- [x] `.agents/skills/` uniforme: 48 dirs, 48 com `SKILL.md`, 0 sem (RF-02).

### PA-03
- [x] Reapontar `scripts/static-checks.mjs:28` e `prd-checks.spec.mjs:29`; `grep -rn "skills/prd-adr-pipeline" --include=*.mjs` = 0 (RF-03).

### PA-04
- [x] `prd-checks.spec.mjs`: 4 paths de template derivam de `LIB` (`:1125-1129`) e o guard de pureza relê o path novo (`:915-923`) (RF-04, RF-05).

### PA-05
- [x] Remover a prosa `"only path the installer propagates"` de `checks.mjs:15-16` e de `static-checks.mjs` (RF-06).

### PA-06
- [x] `installer/install.mjs:419`: remover `'prd-adr-pipeline',` de `SKILLS_COMMON` (23→22, medido), **mantendo** `:384` em `RULES_COMMON`; `grep -c "prd-adr-pipeline" installer/install.mjs` = 1 (RF-07, RF-08).

### PA-07
- [x] `orchestrator/AGENT.md:273`, `.agents/rules/prd-adr-pipeline.md:63-65`, `.agents/rules/workflow-rules.md:322`, `docs/FUNCIONAMENTO.md:109,138,484,538` com o path novo (RF-09, RF-10).

### PA-08
- [x] Commit com trailer `Harness-Gate-Change` (`.opencode/plugins/**` e `.agents/rules/**` são protegidos) (RF-10, I4).

### PA-09
- [x] Prova de propagação: `collectIncoming` em 4 stacks (5 no path novo / 0 no antigo) + instalação real em `/tmp` (`find | wc -l` = 5) + `__tests__` não entregues (RF-01).

### PA-10
- [x] Verificação final: 4 comandos de suíte + `sdd-checks` exit 0; `git diff --stat` de `gate.js`/`harness.config.json` vazio; selo não republicado; `V2/V3/V7` = 0 com `lib/` em `SCAN_DIRS` (RF-11, RF-12).

## Sumário de execução

| Task | Fase | Depende de |
|---|---|---|
| PA-01 | 1 | — |
| PA-02 | 1 | PA-01 |
| PA-03 | 2 | PA-01 |
| PA-04 | 2 | PA-03 |
| PA-05 | 2 | PA-01 |
| PA-06 | 3 | PA-02 |
| PA-07 | 4 | PA-01 |
| PA-08 | 4 | PA-01..PA-07 |
| PA-09 | 5 | PA-06 |
| PA-10 | 5 | PA-08, PA-09 |
