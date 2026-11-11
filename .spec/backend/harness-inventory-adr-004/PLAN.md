# PLAN — harness-inventory-adr-004

> Execução do ADR-004 na branch `adr/prd-harness-inventory/04-inventario-canonico` (base `a789003`).

## 1. Fases

### Fase 1 — Módulo (RF-01, RF-03, RF-09..RF-11)
1. `.opencode/plugins/lib/inventory/checks.mjs`: puro, `root` injetável. Lê `opencode.json.agent`, `.agents/skills/*/`, `.agents/rules/*.md`, `.vendor-lock.json`.
2. Classe por lock (nunca prefixo); `lockPresent=false` quando ausente.
3. Agentes por **registro** (chave + `prompt` resolvido), não por `AGENT.md`.
4. Lock↔disco nas duas direções.

### Fase 2 — Decisões de dono (RF-05, RF-06, RF-07)
5. `OWNER_DECISIONS` com 6 campos; 1 entrada (`harness-installer` → `installer/install.mjs:413`).
6. Modos `owner-decision-incomplete` e `owner-decision-stale` (sujeito ausente / ganhou consumidor).

### Fase 3 — Adapter e counters (RF-02, RF-04)
7. `scripts/static-checks.mjs`: `record("V19", …)`; counters no `detail` **em PASS e FAIL**.
8. Confirmar `commands.suiteFull` e `seal.mjs` sem diff.

### Fase 4 — Fixtures (RF-08, RF-12)
9. `inventory.spec.mjs`: 1 fixture por id (7) + caso sem lock; par PASS/FAIL com 1 arquivo de diferença.

### Fase 5 — Verificação
10. 5 comandos + `PASS V19` com counters; `git diff` de `harness.config.json`/`seal.mjs` vazio.

## 2. Constraint mapping

| Constraint | Onde |
|---|---|
| Módulo não escreve (I1) | Fase 1 |
| Sem heurística de prefixo (I2) | Fase 1 item 2 + item 4 do ADR |
| Decisão expira (I3) | Fase 2 item 6 |
| V18×V19 ortogonais (I4) | Fase 3 |
| Sem comando novo (I5) | Fase 3 item 8 |

## 3. Caminho crítico

`F1 → F2 → F4 → F3.7` — fixtures antes do adapter evita "verde de fachada".

## 4. Rollback

`git reset --hard a789003`.
