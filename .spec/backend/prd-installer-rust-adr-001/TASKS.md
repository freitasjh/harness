# TASKS — prd-installer-rust-adr-001

> Execução do ADR-001 na branch `adr/prd-installer-rust/01-fronteira-subprocesso` (base `e3d86de`).

## Microtasks (TDD-ready)

### RC-01
- [x] Criar `installer/contract-registry.mjs` com os 6 mapas byte-idênticos ao oráculo (RF-07, I1).

### RC-02
- [x] Provar byte-a-byte dos 6 mapas antes de trocar `scripts/static-checks.mjs:81`; divergência preserva especificador antigo (RF-07, I3).

### RC-03
- [x] Definir envelope `contract-v1` (`{v:1, ok, result|error}`), `op` = nome do export,零 vocabulário novo (RF-02, E1).

### RC-04
- [x] Adapter: stdout envelope / stderr progresso `[OK]/[INFO]/[AVISO]`; nenhum byte de tela no envelope (RF-02, I4).

### RC-05
- [x] Códigos 0/1/2; oráculo nunca emite 2; `NOT_INSTALLED`/`MANIFEST_INVALID` renderizados `UNKNOWN` sem código novo (RF-03, E2).

### RC-06
- [x] Segredo fora de argv/stdout/stderr; `IsTerminal` + `--answers-file`; aborto 0 writes (RF-04, RF-05, RF-06).

### RC-07
- [x] Migrar G-INJ (3) e G-DOGFOOD (2) para o adapter (RF-08).

### RC-08
- [x] Migrar G-ORACLE-DATA (4) e G-CLI-TUI (13); 22/22 e 75/75 (RF-08).

### RC-09
- [x] Oráculo por SHA `c63e333` + `status --porcelain` vazio antes de cada medição (RF-09).

### RC-10
- [x] Verificação: 5 suítes exit 0; `commands.suiteFull` e selo `c904f1c5` byte-idênticos; trailer (RF-10, RF-11).

## Sumário de execução

| Task | Fase | Depende de |
|---|---|---|
| RC-01 | 1 | — |
| RC-02 | 1 | RC-01 |
| RC-03 | 2 | RC-02 |
| RC-04 | 2 | RC-03 |
| RC-05 | 2 | RC-03 |
| RC-06 | 2 | RC-03 |
| RC-07 | 3 | RC-02 |
| RC-08 | 3 | RC-07 |
| RC-09 | 4 | RC-01 |
| RC-10 | 4 | RC-08, RC-09 |
