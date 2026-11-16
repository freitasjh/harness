# PLAN — prd-installer-rust-adr-001

> Execução do ADR-001 na branch `adr/prd-installer-rust/01-fronteira-subprocesso` (base `e3d86de` + commits de estado).

## 1. Fases

### Fase 1 — Registry (RF-07)
1. Criar `installer/contract-registry.mjs` com os 6 mapas (`AXIS_IDS`, `SKILLS_BY_AXIS`, `SKILLS_COMMON`, `RULES_BY_AXIS`, `RULES_COMMON`, `STACKS_FOR_EXCEPTIONS`).
2. Provar byte-a-byte contra o oráculo **antes** de trocar o especificador em `scripts/static-checks.mjs:81`.

### Fase 2 — Contrato (RF-02..RF-06)
3. Definir envelope `contract-v1`, canais, códigos e `op` = nome do export; sem Rust neste ciclo.
4. Adapter de subprocesso com `IsTerminal`, `--answers-file`, segredo sem eco e aborto 0 writes.

### Fase 3 — Consumidores (RF-08)
5. Migrar G-INJ (3), G-DOGFOOD (2), G-ORACLE-DATA (4), G-CLI-TUI (13) — 22/22, com 75/75 exports com destino.

### Fase 4 — Verificação (RF-09..RF-11)
6. Oráculo por SHA + status limpo antes de cada corrida; 5 suítes; selo intacto; trailer `Harness-Gate-Change`.

## 2. Constraint mapping

| Constraint | Onde |
|---|---|
| Oráculo externo (I1) | Fase 1/4 |
| Adapter não grava (I2) | Fase 2 |
| Registry antes do despacho (I3) | Fase 1 |
| Canais separados (I4) | Fase 2 |
| Selo intacto (I5) | Fase 4 |

## 3. Caminho crítico

`F1 → F2 → F4` — registry divergente muda a fonte de `V19`/`V20` e a troca de especificador quebra os checks.

## 4. Rollback

`git reset --hard e3d86de`.
