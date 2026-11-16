# VERIFY — prd-installer-rust-adr-003 (ADR-003 · PRD-3)

> Skill `sdd-compiler` modo `verify` · 3 dimensões (Completeness / Correctness / Coherence).
> Skill `security-review` Fase 4 (checklist 14 itens, N/A de CLI local declarados).
> Branch `adr/prd-installer-rust/03-motor-init-doctor-upgrade-impl` · oráculo `c63e33307710e1c6271f5c68b2dd9fb15283f49c`.

## 1. Completeness — ✅

| Critério | Evidência | Resultado |
|---|---|---|
| 12 microtasks | `JIRA_BOARD.md` 12/12 DONE (BE-01..08, VAL-01..04) | ✅ |
| 23 `op`s D-ENGINE com `prova(op)` | `harness/prd-installer-rust-adr-003.json` → `prova[]` 23 entradas, 23 `ok` | ✅ |
| Tabela 23 `op` → oráculo → comando → mutação | RELATÓRIO → `differentialTable[]` (23 linhas, cada uma com `mutation: 1 byte … ⇒ reprova`) | ✅ |
| 8 vereditos congelados com SHA pré-comparado | RELATÓRIO → `frozenVerdicts[]` 8 shas; `frozenUnchanged:true` | ✅ |
| Mutação de 1 byte em cada oráculo | RELATÓRIO → 23/23 `prova[].mutation.rejected:true` (sha original ≠ sha mutado, `diff -u` reprova) | ✅ |
| SI-1..SI-6 | `--run-parity`: 6/6 `status:medido`, `pass:true` — SI-2/SI-3 saíram de `not_measured` por differential real | ✅ |
| VERIFY 3/3 dimensões | este arquivo | ✅ |
| Ponte `installer/installer-contract.mjs:15` | intacta — expira só no merge humano do ADR-003 | ✅ |
| Push | **não executado** — aguarda aprovação | ✅ |

**Número publicado:** `9 byte-equal + 2 parciais` é medição (RELATÓRIO → `measurement`, `claimed12of12:false`). `12/12` **nunca** é publicado como fato — só re-derivável por `node installer/parity-oracle.mjs --rederive-12`.

## 2. Correctness — ✅

### Suítes (saída literal em `/tmp/opencode/batch3/`)

| # | Comando | Exit | Contagem |
|---|---|---|---|
| 1 | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 0 | 540 pass / 0 fail |
| 2 | `node --test "installer/__tests__/*.spec.mjs"` | 0 | 644 pass / 0 fail |
| 3 | `node scripts/static-checks.mjs` | 0 | PRD-01 / ADR-01 / ADR-02 PASS; V19/V20 PASS |
| 4 | `node scripts/sdd-checks.mjs` | 0 | SDD-01/02/03, V17, R-NODENY, RENAME-01 PASS |
| 5 | `node scripts/vendor-skills.mjs --check` | 0 | `vendor-check OK` |
| 6 | `cargo test --manifest-path installer-rs/Cargo.toml` | 0 | 60 pass / 0 fail |
| 7 | `node installer-rs/tests/prova-engine.mjs` | 0 | 23/23 provados, 0 falhas, 23 mutações |
| 8 | `INSTALLER_BIN=… node installer/parity-oracle.mjs --run-parity` | 0 | SI-1..SI-6 medido/pass, `literalProven:true` |

**Débito pré-existente saneado (H2):** primeira execução de `cargo test` falhou em `run_upgrade_with_flag_yields_collisions_and_continues` (`entrypoints_spec.rs:100`, `Option::unwrap()` em `None`). Causa: **binário `target/debug/harness-installer` stale** — continha string `DOCTOR_GATE / doctor quebrado aborta upgrade` ausente da fonte (o gate foi removido em `upgrade.rs` no batch 2, mas o artefato não foi recompilado). Ação: `touch` das fontes + `cargo build` (conteúdo inalterado) + re-execução → 60/60. Nenhuma edição de `gate.js`, `harness.config.json`, `seal.mjs`, `opencode.json`, `workflow-state.json`, ADR/spec/rules.

### Gate de differential (VAL-02)

`fullComparison()` agora é **gate**, não só cálculo: `status = ok` exige `sideMatch && okMatch && exitCodeMatch && oracleExitMatch`. `prova()` compara `result` (canonicalJson), `ok`, `exit-code` e código de erro renderizado (22+UNKNOWN) — `buildManifest.date` é o único volátil, normalizado **simetricamente** nos dois lados e declarado em `normalized:['date']`. SHA cheio + `status --porcelain` vazio são checados **antes de cada comparação** (`checkOracle()` no topo de `prova()`).

### Selo (VAL-04)

`sealCommands(commands)` = `c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2` — **idêntico** ao publicado. `commands.suiteFull` byte-idêntico; Rust (`cargo test`) e `prova-engine.mjs`/`--run-parity` rodam **fora do selo** (rastreabilidade, não contraprova selada).

## 3. Coherence — ✅

| Invariante | Verificação |
|---|---|
| Oráculo anterior ao sujeito | `c63e333` detach, SHA cheio conferido, worktree limpo; nada é gerado a partir do binário |
| 23 nomes = D-ENGINE | `OP_TABLE` 23, sem `planUpgrade`/`applyUpgrade`; `op` nova ⇒ SI-6 (fail-closed) |
| Duas ordens congeladas | `runUpgrade` planeja antes de backup; `main` faz backup antes de planejar; `doctor` é reportado (`doctorPre`), nunca gate (correção do artefato stale) |
| Backup verificado antes de escrita | `backup` + `requireVerifiedBackup` no `apply`; dry-run 0 writes (hash de conteúdo) |
| Rito do literal | `literalProven:true` via `Veredito: validated literal 9fa4530b… c63e333` (ADR-002 REPORT); 8 shas inalterados |
| Nenhum PASS por omissão | SI-2/SI-3 sem `$INSTALLER_BIN` ⇒ `not_measured` com motivo explícito; com binário ⇒ `medido` só se differential executa |
| Ponte D1-two-motors | pronta para expirar no merge humano do ADR-003; não removida neste commit |

## Segurança — Fase 4 (skill `security-review`, 14 itens)

| # | Item | Status | Justificativa / evidência |
|---|---|---|---|
| 1 | Controle de acesso server-side (`@HasPermission`) | **N/A** | CLI local, sem endpoints |
| 2 | Input validation server-side (`@Valid`) | ✅ | `parse_request`: `v:1`, `op` obrigatório; `parseArgs`: posicional ⇒ `BAD_ANSWER`; oráculo independente |
| 3 | SQL/JPQL parametrizado | **N/A** | sem banco |
| 4 | Senha Argon2id/bcrypt | **N/A** | nenhuma senha; único segredo é `deployToken` em `stdin` |
| 5 | JWT RS256/ES256 (`iss`/`aud`/`exp`) | **N/A** | sem auth HTTP |
| 6 | HTTPS/TLS 1.2+ | **N/A** | sem superfície de rede |
| 7 | Security headers (CSP, X-Content-Type-Options) | **N/A** | sem resposta HTTP |
| 8 | `v-html` sem sanitização | **N/A** | sem frontend (TUI é ADR-004) |
| 9 | Sem segredos em código/RELATÓRIO/log | ✅ | `serializeAnswers` omite `q.secret`; `sanitizeLog` redaciona; RELATÓRIO contém só shas/códigos; nenhum `SEGREDO_PROVA` em diff |
| 10 | Rate limiting em autenticação | **N/A** | sem autenticação |
| 11 | Dependências auditadas, zero CVE alta | ✅ | `Cargo.lock` versionado; crates fixadas com fonte S1/S2/S3 em `Cargo.toml` (`clap =4.6.6` desvio de patch declarado, `anyhow =1.0.104`, `thiserror =2.0.21`, serde/serde_json); `vendor-check OK` |
| 12 | Actuator/Swagger protegidos | **N/A** | sem Actuator/Swagger |
| 13 | Mobile Keychain/Keystore + TLS | **N/A** | não é mobile |
| 14 | Segredo em `stdin` sem eco | ✅ | `canNoEcho`/`readSecretRaw` no oráculo; `parse_request` não ecoa `answers`; prova sem `deployToken` em stdout/stderr/RELATÓRIO |

**Segredo em stdin:** nenhuma fixture de prova contém token real; o valor sintético `deployToken:"s"` aparece só em teste Rust e nunca é ecoado. **Zero segredos** em código versionado, RELATÓRIO ou logs. **Lockfile** `installer-rs/Cargo.lock` versionado e fonte S1/S2/S3 registrada.

**Veredito segurança:** ✅ `pass` — 14/14 itens atendidos (9 N/A declarados por CLI local, 5 aplicáveis ✅). Zero achados críticos.

## Conclusão

3/3 dimensões ✅ · 23/23 differential com mutação que derruba · SI-1..SI-6 medido/pass · RELATÓRIO reancorado (`batch:3`, `gitSha` do commit final, `unit:60`, `it:23`) · 5 suítes + cargo + prova + parity verdes · selo `c904f1c5` intacto · trailer `Harness-Gate-Change`. **Bloqueios:** nenhum. **Próximo:** commit + (após aprovação) push e merge humano do ADR-003, quando a ponte `installer-contract.mjs:15` expira.
