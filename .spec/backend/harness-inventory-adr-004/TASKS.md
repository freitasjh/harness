# TASKS — harness-inventory-adr-004

> Execução do ADR-004 na branch `adr/prd-harness-inventory/04-inventario-canonico` (base `a789003`).

## Microtasks (TDD-ready)

### PI-01
- [x] Criar `.opencode/plugins/lib/inventory/checks.mjs` puro com `deriveInventory`, `runInventoryChecks`, `CLASS_LABELS`; `root` injetável (RF-01, I1).

### PI-02
- [x] Classe de skill **só** pelo `.vendor-lock.json`; `lockPresent=false` sem lock; `grep -c "startsWith|inferStacks"` = 0 (RF-03, RF-11, I2, E4).

### PI-03
- [x] Contar agentes pelo **registro** (`opencode.json.agent` + `prompt` resolvido), não por `AGENT.md`; id `inventory-agent-prompt-unresolved` (RF-09, E1).

### PI-04
- [x] Lock↔disco nas duas direções; id `inventory-lock-disk-mismatch` (RF-10).

### PI-05
- [x] `OWNER_DECISIONS` com `subject/class/owner/decision/reason/proof/expiresWhen`; 1 entrada (`harness-installer` → `installer/install.mjs:413`) (RF-05, E3).

### PI-06
- [x] Modos `owner-decision-incomplete` e `owner-decision-stale` (sujeito ausente; sujeito que ganhou consumidor) (RF-06, RF-07, I3, R1).

### PI-07
- [x] Modos `inventory-class-ambiguous` e `inventory-artifact-untracked` (RF-08).

### PI-08
- [x] Adapter `V19` em `scripts/static-checks.mjs` com counters no `detail` em PASS e FAIL; `suiteFull`/`seal.mjs` sem diff (RF-02, RF-04, I5, R3).

### PI-09
- [x] `inventory.spec.mjs`: fixture por id (7) + caso sem lock + par PASS/FAIL com 1 arquivo de diferença (RF-12, R5).

### PI-10
- [x] Verificação final: 5 comandos exit 0; `PASS V19` com counters de fechamento; `git diff --stat` de `harness.config.json`/`seal.mjs` vazio; commit com trailer se tocar protegido.

## Sumário de execução

| Task | Fase | Depende de |
|---|---|---|
| PI-01 | 1 | — |
| PI-02 | 1 | PI-01 |
| PI-03 | 1 | PI-01 |
| PI-04 | 1 | PI-02 |
| PI-05 | 2 | PI-01 |
| PI-06 | 2 | PI-05 |
| PI-07 | 2 | PI-02 |
| PI-08 | 3 | PI-04, PI-07 |
| PI-09 | 4 | PI-06, PI-07 |
| PI-10 | 5 | PI-08, PI-09 |

## Verificação (saída literal)

### V19 em PASS — contadores de fechamento

```
$ node scripts/static-checks.mjs | grep V19
PASS V19: inventário derivado: skills=48 (vendor-by-axis=25, consumer=22, axis=0, orphan=1), rules=8 (consumer=7, axis=1, orphan=0), agents=10/10 (registered=10, orphan=0), vendorCited=0, lockPresent=true, owner-decisions=1
```

### Os 10 ids de §2.4, cada um com mutação real (cópia do repo fora do worktree)

```
### inventory-artifact-untracked
mutação: criado .agents/skills/skill-sem-dono/SKILL.md
FAIL inventory-artifact-untracked: 1 artefato(s) no disco sem classe derivável e sem decisão de dono: skill:skill-sem-dono — falta entrada em OWNER_DECISIONS

### inventory-class-ambiguous
mutação: skill vendorizada 'dart-add-unit-test' declarada também em SKILLS_BY_AXIS['frontend=vue']
FAIL inventory-class-ambiguous: 1 artefato(s) casando classes contraditórias: dart-add-unit-test ← vendor-by-axis (.vendor-lock.json) + axis (frontend=vue) — a precedência resolve classes, não declarações contraditórias

### inventory-attendance-drift
mutação: SKILLS_COMMON recebe 'skill-fantasma' (sem diretório no disco)
FAIL inventory-attendance-drift: fechamento quebrado: skills: disco=48 ≠ lock∩disco (25) + declarações locais (24)

### inventory-lock-disk-mismatch
mutação: removido .agents/skills/dart-add-unit-test/ (chave viva no lock)
FAIL inventory-lock-disk-mismatch: lock↔disco: 1 divergência(s): dart-add-unit-test (chave do lock sem diretório no disco)

### inventory-agent-prompt-unresolved
mutação: movido ./.agents/agents/orchestrator/AGENT.md (registro 'orchestrator' fica sem prompt)
FAIL inventory-agent-prompt-unresolved: 1 registro(s) com prompt não resolvido: orchestrator (prompt ausente no disco: .agents/agents/orchestrator/AGENT.md)

### owner-decision-incomplete
mutação: entrada de OWNER_DECISIONS com expiresWhen=[]
FAIL owner-decision-incomplete: OWNER_DECISIONS com 1 entrada(s) incompleta(s): skill:harness-installer: expiresWhen ausente (decisão sem prazo de validade)

### owner-decision-stale
mutação: entrada de OWNER_DECISIONS para 'dev-planner' (tem consumidor vivo)
FAIL owner-decision-stale: OWNER_DECISIONS com 1 entrada(s) expirada(s): skill:dev-planner (o sujeito ganhou consumidor no roster) — remover a entrada
```

### Suíte completa (== `commands.suiteFull`)

```
$ node --test ".opencode/plugins/__tests__/*.spec.mjs"
ℹ tests 468
ℹ suites 111
ℹ pass 468
ℹ fail 0

$ node --test "installer/__tests__/*.spec.mjs"
ℹ tests 559
ℹ suites 183
ℹ pass 559
ℹ fail 0

$ node scripts/static-checks.mjs ; echo EXIT=$?
...
EXIT=0

$ node scripts/vendor-skills.mjs --check
vendor-check OK (.agents/skills/.vendor-lock.json)
```

### Selo intocado

```
$ git diff --stat -- harness.config.json .opencode/plugins/lib/seal.mjs
(vazio)
```

## Nota de atualização (2026-11-11, pós-P4)

- Os ids passaram de **7 para 10** durante as rodadas de review (`inventory-lock-unreadable`, `inventory-declaration-phantom`, `inventory-skill-without-manifest`).
- Os counts de plugins passaram de **445** (`8041733`) para **468** (HEAD `b2b419e`) — os blocos de evidência abaixo são snapshots datados; o número vivo é o do P4.
