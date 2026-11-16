# PLAN — prd-installer-rust-adr-003

> Compilado de `SPEC.md` (17 RF) e do ADR-003 §3. Branch `03-impl`, base `fbdca4c`. Crate/versão/toolchain escolhidos no SDD pelo critério do ADR §2.4 com fonte `RESEARCH.md` S1/S2/S3 (RF-17) — este plano fixa apenas o caminho físico `installer-rs/` e a fronteira `contract-v1`.

## 1. Fases e sequenciamento

| Fase | Objetivo | Tasks |
|---|---|---|
| F0 — Bootstrap | envelope `v:1`, exit 0/1/2, dispatcher com 23 nomes, segredo em stdin sem eco | BE-01, VAL-01 |
| F1 — Ops de leitura | preflight/inventory/resolveBackupDir/loadAnswersFile; collectAnswers/generateConfig/collectIncoming; doctor D0..D6 | BE-02, BE-03, BE-05 |
| F2 — Texto e erros | mensagem 4-linhas, códigos do `Set` do oráculo (22 + UNKNOWN), usage/help 9 linhas | BE-04 |
| F3 — Escrita segura | merge v2-only, manifesto, backup verificado, checks | BE-06, BE-07 |
| F4 — Orquestração | 4 entrypoints, DUAS ordens do upgrade, init create-only, dry-run | BE-08 |
| F5 — Prova | `prova(op)` × 23, SI-2/SI-3 medidos, relatório + 5 suítes + selo | VAL-02, VAL-03, VAL-04 |

**Execution graph:** `F0 → F1 → F2 → F3 → F4 → F5`. Infra (BE-01/VAL-01) precede domínio. Nenhuma task toca UI (TUI = ADR-004).

**Critical path (MVP):** `BE-01 → VAL-01 → BE-02 → BE-03 → BE-04 → BE-06 → BE-07 → BE-08 → VAL-02 → VAL-03 → VAL-04`.

## 2. Traceability 1:1 (RF → task do PLAN)

| RF | Item ADR | Task | Onde se prova |
|---|---|---|---|
| RF-01 | 1 | BE-01 | `grep -c 'case "'` = 23; `planUpgrade`/`applyUpgrade` = 0 |
| RF-02 | 2 | VAL-01, VAL-02 | `prova(op)` × 23, `diff` vazio |
| RF-03 | 3 | BE-08 | diff de sequência relativa contra `c63e333` |
| RF-04 | 4 | BE-07 | `injectFailure` ⇒ exit 1, hash destino idêntico |
| RF-05 | 5 | BE-08, VAL-03 | hash de árvore antes=depois, `checks.passed:null` |
| RF-06 | 6 | BE-05 | 7 marcadores, vereditos e exit idênticos |
| RF-07 | 7 | BE-04 | 4 linhas byte-equal, 22 códigos + UNKNOWN |
| RF-08 | 8 | BE-04 | `--help` 9 linhas ⇒ 0; sem `--target` ⇒ 1 |
| RF-09 | 9 | BE-06, BE-08 | `flagged-open` exit 1 / `flag` ⇒ `collisions` |
| RF-10 | 10 | BE-06, BE-08 | 2ª execução `noop`, schema intacto |
| RF-11 | 11 | BE-08 | tabela cruzada dos 4 call sites |
| RF-12 | 12 | VAL-01, VAL-03 | sha dos 8 arquivos antes; `git diff --exit-code` |
| RF-13 | 13 | VAL-04 | `9+2` medido, `12/12` não publicado como fato |
| RF-14 | 14 | VAL-01, VAL-02 | SHA + `status --porcelain` antes de cada `prova` |
| RF-15 | 15 | VAL-04 | `c904f1c5`, Rust fora do selo, 5 suítes |
| RF-16 | 16 | VAL-04 | `PASS ADR-01`/`ADR-02`, ledger 1:1 |
| RF-17 | 17 | BE-01 | `Cargo.toml` com fonte S1/S2/S3; sem crate órfão |

## 3. Constraint mapping (Constraint → Enforcement → Failure Mode)

| Constraint | Enforcement | Failure Mode |
|---|---|---|
| Nenhuma `op` nova / vocabulário fechado | BE-01 `grep` 23 nomes; VAL-04 SI-6 | dispatcher com 24º nome ⇒ FAIL |
| Duas ordens do upgrade | BE-08 diff de sequência; teste BF-02b/EX-BE-05 | unificar ordens ⇒ FAIL |
| Doctor não-gate | BE-05 `report.verdict` só em `doctorPre` | abortar em `QUEBRADO` ⇒ FAIL |
| Backup verificado antes do apply | BE-07 `requireVerifiedBackup`; I2 | escrita sem `verified` ⇒ FAIL |
| 0 writes no dry-run | BE-08 hash de árvore; I3 | `.harness-backup-*` criado ⇒ FAIL |
| Segredo sem eco | BE-01 stdin, nenhum log; I5 | segredo em stdout/stderr/RELATÓRIO ⇒ FAIL |
| Oráculo externo | VAL-01 SHA + porcelania; I6 | worktree sujo / SHA divergente ⇒ fail-closed |
| Literal assinado | VAL-03 `Veredito: validated literal …` | `.snap.new` ou sem assinatura ⇒ não é prova |
| Selo invariante | VAL-04 `sealCommands` = `c904f1c5…` | comando Rust dentro de `suiteFull` ⇒ FAIL |
| 22 códigos + UNKNOWN (S3) | BE-04 lê o `Set` do oráculo, não o número do ADR | código novo ⇒ FAIL |

## 4. Event lifecycle

**N/A — sem eventos assíncronos.** Comunicação é síncrona por `stdin`/`stdout`/`stderr` sob `contract-v1` (ADR-001 §2.2); não há Producer/Outbox/Broker/Consumer. "4-task event lifecycle" não se aplica.

## 5. Testes obrigatórios

- Integração isolada: `prova(op)` para cada uma das 23 `op`s contra `c63e333` (VAL-02) — substitui o "isolamento multi-tenant" de stack web: aqui o isolamento é entre SUJEITO e ORÁCULO.
- Failure mode: backup injetado, manifesto estrangeiro, `BAD_ANSWER`, `flagged-open`, `MISSING_INCOMING`, `insta accept`.
- Idempotência: 2ª execução de `upgrade` `noop` em conteúdo/mtime/inode (BF-02b).
- Contraprova: `commands.suiteFull` selada + 5 suítes + Rust paralelo.

## 6. Rollback

`git reset --hard fbdca4c`. Nenhum arquivo de gate/config/selo é tocado; reverter o motor = desligar o dispatcher de `contract-v1`, preservando o oráculo.
