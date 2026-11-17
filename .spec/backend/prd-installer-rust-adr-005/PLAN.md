# PLAN — prd-installer-rust-adr-005

> Compilado de `SPEC.md` (16 RF) + ADR-005 §2/§3. Branch `05-impl`, base `d4e9924`. Refactor de distribuição: nenhum preset/comando/chave/contrato/tela/número novo. Selo `c904f1c5` byte-idêntico.

## 1. Fases
| Fase | Objetivo | Tasks |
|---|---|---|
| F0 — Wrapper | `package.json` com `bin`, `optionalDependencies`, `engines`; shim localizador | PUB-01, PUB-02 |
| F1 — Pacotes de plataforma | matriz os/cpu/libc, `files` só binário, versão acompanha wrapper | PUB-03 |
| F2 — Fallback + D7 | tripla não casa ⇒ stderr + exit 1; prova sem cargo/rustc; rede-zero | PUB-04, VAL-01 |
| F3 — Selo + oráculo | selo byte-idêntico, oráculo fora do caminho, differential `prova(op)` | VAL-02 |
| F4 — Relatório | 5 suítes, ledger, VERIFY | VAL-03 |

**Critical path:** `PUB-01 → PUB-02 → PUB-03 → PUB-04 → VAL-01 → VAL-02 → VAL-03`.

## 2. Traceability 1:1
| RF | Item ADR | Task |
|---|---|---|
| RF-01 (bin→shim) | 1 | PUB-01, PUB-02 |
| RF-02 (optionalDeps) | 2 | PUB-01, PUB-03 |
| RF-03 (sem toolchain) | 3 | PUB-04, VAL-01 |
| RF-04 (fallback) | 4 | PUB-04 |
| RF-05 (motor único) | 5 | PUB-02, VAL-01 |
| RF-06 (install.mjs fora) | 6 | PUB-03, VAL-01 |
| RF-07 (12 presets) | 7 | VAL-02 |
| RF-08 (suiteFull 4 etapas) | 8 | VAL-02 |
| RF-09 (selo) | 9 | VAL-02 |
| RF-10 (Rust fora) | 10 | VAL-02 |
| RF-11 (contract-v1) | 11 | PUB-02, VAL-01 |
| RF-12 (rede-zero) | 12 | PUB-03, VAL-01 |
| RF-13 (oráculo fora) | 13 | VAL-02 |
| RF-14 (engines) | 14 | PUB-01 |
| RF-15 (ledger) | 15 | VAL-03 |
| RF-16 (sem crate pinado) | 16 | PUB-03 |

## 3. Constraint mapping
| Constraint | Enforcement | Failure Mode |
|---|---|---|
| Motor único | shim sem init/doctor/upgrade, sem escrita; `apply` só no binário | 2º motor ⇒ FAIL |
| Selo intacto | `sealCommands` = c904f1c5; `git diff` config/selos vazio; `grep cargo rust` config = 0 | republicar ⇒ FAIL |
| install.mjs fora do pacote | `find node_modules/harness-installer -name install.mjs` vazio | entrypoint legado ⇒ FAIL |
| Sem build no destino | `package.json` sem script de build; prova PATH sem cargo/rustc | compilação ⇒ FAIL |
| Rede-zero | nenhum postinstall/download; fallback não baixa | download ⇒ FAIL |
| 12 presets / contrato | byte-idênticos ao oráculo | valor novo ⇒ FAIL |

## 4. Event lifecycle
**N/A** — subprocesso síncrono (`contract-v1`), sem barramento.

## 5. Testes
4 etapas seladas + `cargo test`/differential em paralelo (D6); prova D7 em PATH sem toolchain; `find` install.mjs vazio; selo re-derivado; oráculo worktree detach.

## 6. Rollback
`git reset --hard d4e9924`. Nenhum gate/config/selo tocado.
