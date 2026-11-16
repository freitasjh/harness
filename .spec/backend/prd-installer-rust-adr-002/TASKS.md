# TASKS — prd-installer-rust-adr-002

> Execução do ADR-002 na branch `adr/prd-installer-rust/02-oraculo-paridade-impl` (base `331e44f`).

## Microtasks (TDD-ready)

### PO-01
- [ ] Materializar worktree `detach` `c63e333`; SHA verificado + `status --porcelain` vazio antes de cada corrida (RF-02, I1).

### PO-02
- [ ] Confirmar `git diff --exit-code` nos literais de `golden.spec.mjs`, `eixos-stack.spec.mjs` e transcript (RF-01).

### PO-03
- [ ] Registry 6 mapas byte-equal antes de qualquer troca de especificador — herança do ADR-001 (RF-10).

### PO-04
- [ ] Rubrica de validação humana e `Veredito: validated literal <sha> <ISO> <oráculo>` em `harness/<demand>.json` (RF-03, I3).

### PO-05
- [ ] Proibir `cargo insta accept` e `*.snap.new` como baseline; `insta` só revisor (RF-11).

### PO-06
- [ ] SI-1 config byte-equal (9+2 hoje, 12/12 meta re-derivável) (RF-04, I4).

### PO-07
- [ ] SI-2 payload (caminhos+bodies) idêntico por differential hash (RF-05, I2).

### PO-08
- [ ] SI-3 dry-run 0 writes por hash de árvore antes=depois (RF-06).

### PO-09
- [ ] SI-4 transcript W0..W7/W2m com 5 marcadores + SI-5 checks/manifesto (RF-07, RF-08).

### PO-10
- [ ] SI-6 nada novo sem §16; `12/12` nunca publicado como fato medido (RF-09, RF-12).

### PO-11
- [ ] Verificação: 5 suítes exit 0; selo `c904f1c5` intacto; comandos paralelos fora de `suiteFull`; trailer (RF-13, I5).

## Sumário de execução

| Task | Fase | Depende de |
|---|---|---|
| PO-01 | 1 | — |
| PO-02 | 1 | PO-01 |
| PO-03 | 1 | PO-01 |
| PO-04 | 2 | PO-01 |
| PO-05 | 2 | PO-04 |
| PO-06 | 3 | PO-03 |
| PO-07 | 3 | PO-03 |
| PO-08 | 3 | PO-03 |
| PO-09 | 3 | PO-06 |
| PO-10 | 3 | PO-09 |
| PO-11 | 4 | PO-05, PO-10 |
