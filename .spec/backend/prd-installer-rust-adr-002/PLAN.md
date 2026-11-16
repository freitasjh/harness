# PLAN — prd-installer-rust-adr-002

> Execução do ADR-002 na branch `adr/prd-installer-rust/02-oraculo-paridade-impl` (base `331e44f`).

## 1. Fases

### Fase 1 — Oráculo externo (RF-01, RF-02, RF-10, I1)
1. Materializar worktree `detach` `c63e333` com verificação de SHA e `status --porcelain` vazio antes de cada medição.
2. Confirmar literais inalterados e registry 6 mapas byte-equal (herdada do ADR-001).

### Fase 2 — Rito do literal (RF-03, I3)
3. Rubrica de validação humana com `Veredito: validated literal <sha> <ISO> <oráculo>` em `harness/<demand>.json`.
4. Proibir `cargo insta accept` e `*.snap.new` como baseline.

### Fase 3 — SI-1..SI-6 (RF-04..RF-09)
5. Implementar differential driver por predicado, com fallback fail-closed.
6. Publicar 9+2 como medição; 12/12 só re-derivável (I4).

### Fase 4 — Verificação (RF-11..RF-13, I5)
7. 5 suítes, selo intacto, comandos paralelos fora de `suiteFull`, trailer `Harness-Gate-Change`.

## 2. Constraint mapping

| Constraint | Onde |
|---|---|
| Oráculo externo (I1) | Fase 1 |
| Derivado reprova (I2) | Fase 3 |
| Literal assinado (I3) | Fase 2 |
| 9+2 ≠ 12/12 (I4) | Fase 3 |
| Selo intacto (I5) | Fase 4 |

## 3. Caminho crítico

`F1 → F2 → F3` — rito sem oráculo imutável vira assinatura de snapshot cego.

## 4. Rollback

`git reset --hard 331e44f`.
