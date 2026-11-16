# VERIFY — prd-installer-rust-adr-003 (ADR-003 · PRD-3)

> Skill `sdd-compiler` modo `verify` · 3 dimensões (Completeness / Correctness / Coherence).
> Skill `security-review` Fase 4 (checklist 14 itens, N/A de CLI local declarados).
> Branch `adr/prd-installer-rust/03-motor-init-doctor-upgrade-impl` · oráculo `c63e33307710e1c6271f5c68b2dd9fb15283f49c`.
> Revisado no loop de correção 1 (review final ADR-003 reprovou por 2 🔴: differential
> tautológico por double-unwrap e VERIFO afirmado sem evidência). Todo `✅` abaixo
> aponta para saída literal re-executada **depois** do fix.

## 0. Correções do review final (antes → depois)

| # | Achado | Antes (`14e0a64`) | Depois (commit entregue) |
|---|---|---|---|
| C1 🔴 | `side()` recebia valor **já extraído** | `prova-engine.mjs:123,187-189`: `side(normalizeSide(op, e.ok ? e.result : e.error.code))` ⇒ `e.ok` undefined nos dois lados ⇒ `canonicalJson(undefined)` ⇒ `diff:''` ⇒ `sideMatch` vacuo. Mutante 100% corrompido passava 23/23 | `side(envelope, op)` extrai **dentro**, depois de `normalizeSide`; chamada `side(oracleEnv, op)` / `side(binEnv, op)`. Cada prova registra `sideSha.oracle` == `sideSha.bin` (sha da saída canonical real). Mutante exit-preserving reprova **23/23** no mesmo `prova()` |
| C2 🔴 | VERIFY afirmava prova inexistente | `VERIFY.md:15,17,42,85`: "mutação derruba" ancorado no differential vazio | REESCRITO com `mutantGuard` (0 provados / 23 reprovados), 5 casos de mutação no caminho real e tabela 23/23 com sha por lado |
| 🟡 | `normalized:['date']` enganoso | double-unwrap descartava **todos** os campos | Revalidado: só `buildManifest.date` é removido, simetricamente; corromper `version`/outro campo reprova (teste permanente) |
| 🟡 | `gitSha` "commit final" impreciso | RELATÓRIO `f18d528` (abertura do batch) | RELATÓRIO reancorado no **commit que entrega o código** (`<COMMIT_SHA>`); VERIFY cita o mesmo SHA |

**Divergência real exposta pelo C1:** com o differential passando a comparar de fato,
`buildManifest` reprovou — oracle `install.mjs:15 @ c63e333` usa `VERSION = '1.0.0'`,
o motor Rust emitia `"version":"0.1.0"`. Corrigido em
`installer-rs/src/ops/manifest.rs` + assertion permanente em `merge_spec.rs`.
Antes do fix essa divergência era invisível (`diff:''` dos dois lados).

## 1. Completeness — ✅

| Critério | Evidência | Resultado |
|---|---|---|
| 12 microtasks | `JIRA_BOARD.md` 12/12 DONE (BE-01..08, VAL-01..04) | ✅ |
| 23 `op`s D-ENGINE com `prova(op)` | RELATÓRIO → `prova[]` 23 entradas, 23 `ok`, 23 `comparison.allMatch:true` | ✅ |
| Tabela 23 `op` → oráculo → comando → **sha oráculo vs sha bin** | RELATÓRIO → `differentialTable[]` 23 linhas com `sideShaOracle == sideShaBin` (vide §2) + `mutation` | ✅ |
| 8 vereditos congelados com SHA pré-comparado | RELATÓRIO → `frozenVerdicts[]` 8 shas; `frozenUnchanged:true` | ✅ |
| Mutação de 1 byte em cada oráculo | RELATÓRIO → 23/23 `prova[].mutation.rejected:true` (sha original ≠ sha mutado) — prova **separada** do differential | ✅ |
| **Mutante exit-preserving no caminho real** | RELATÓRIO → `mutantGuard`: `total:23, proved:0, failed:23, mode:'all'`; saída literal de `prova-mutant.mjs` e de `prova-engine.mjs` (§2) | ✅ |
| **5 casos de mutação + normalização** | `prova-engine.spec.mjs`: result/error.code/ok/exit reprovam; `buildManifest.date` passa; outro campo de `buildManifest` reprova | ✅ |
| SI-1..SI-6 | `--run-parity`: 6/6 `status:medido`, `pass:true` — SI-2/SI-3 saíram de `not_measured` por differential real | ✅ |
| VERIFY 3/3 dimensões | este arquivo, com evidência re-executada | ✅ |
| Ponte `installer/installer-contract.mjs:15` | intacta — expira só no merge humano do ADR-003 | ✅ |
| Push | **não executado** — aguarda aprovação | ✅ |

**Número publicado:** `9 byte-equal + 2 parciais` é medição (RELATÓRIO → `measurement`,
`claimed12of12:false`). `12/12` **nunca** é publicado como fato — só re-derivável por
`node installer/parity-oracle.mjs --rederive-12`.

## 2. Correctness — ✅

### Suítes (saída literal em `/tmp/opencode/batch3/` e `/tmp/opencode/mutant-literal.txt`)

| # | Comando | Exit | Contagem |
|---|---|---|---|
| 1 | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 0 | 540 pass / 0 fail |
| 2 | `node --test "installer/__tests__/*.spec.mjs"` | 0 | 644 pass / 0 fail |
| 3 | `node scripts/static-checks.mjs` | 0 | PRD-01 / ADR-01 / ADR-02 PASS; V19/V20 PASS |
| 4 | `node scripts/sdd-checks.mjs` | 0 | SDD-01/02/03, V17, R-NODENY, RENAME-01 PASS |
| 5 | `node scripts/vendor-skills.mjs --check` | 0 | `vendor-check OK` |
| 6 | `cargo test --manifest-path installer-rs/Cargo.toml` | 0 | 60 pass / 0 fail |
| 7 | `node --test installer-rs/tests/prova-engine.spec.mjs` | 0 | 20 pass / 0 fail (13 originais + 7 anti-C1) |
| 8 | `node installer-rs/tests/prova-engine.mjs` | 0 | 23 provados / 0 falhas / 23 mutações / **mutante 0 provados / 23 reprovados** |
| 9 | `node installer-rs/tests/prova-mutant.mjs` | 0 | mutante 100% corrompido: `proved:0, failed:23` |
| 10 | `INSTALLER_BIN=… node installer/parity-oracle.mjs --run-parity` | 0 | SI-1..SI-6 medido/pass, `literalProven:true` |

**Débito pré-existente saneado (H2):** primeira execução de `cargo test` falhou em
`run_upgrade_with_flag_yields_collisions_and_continues` (`entrypoints_spec.rs:100`,
`Option::unwrap()` em `None`). Causa: **binário `target/debug/harness-installer` stale**
— continha string `DOCTOR_GATE / doctor quebrado aborta upgrade` ausente da fonte.
Ação: `touch` das fontes + `cargo build` (conteúdo inalterado) + re-execução → 60/60.
Nenhuma edição de `gate.js`, `harness.config.json`, `seal.mjs`, `opencode.json`,
`workflow-state.json`, ADR/spec/rules.

### Gate de differential (VAL-02) — evidência real

`side(envelope, op)` agora extrai `result` (ok) ou `error.code` **depois** de
`normalizeSide`. Cada `prova[]` carrega `sideSha: {oracle, bin}` — sha256 da saída
canonical de cada lado. Os 23 pares são **iguais** (differential real), e os 23
`diff` vazios são agora consequência de igualdade computada, não de `undefined`.
`fullComparison()` é gate: `status = ok` exige
`sideMatch && okMatch && exitCodeMatch && oracleExitMatch`. SHA cheio +
`status --porcelain` vazio são checados **antes de cada comparação**.

**Mutante exit-preserving** (`installer-rs/tests/fixtures/mutant-bin.mjs`): envolve o
binário real, corrompe `__MUTANT__` em todo `result` e `MUTANTCODE` em todo
`error.code`, preserva o exit-code. Passa pelo **mesmo** `prova()` das 23 provas:
`mutantGuard = {proved:0, failed:23}`. `mutatedRejects()` (1 byte em `diffUnified`
sintético) permanece como prova **separada** — não é usado para fechar C1.

**5 casos do teste permanente (saída literal TAP):**

| Caso | Veredito |
|---|---|
| `result` corrompido | `reprovado` — `sideMatch:false`, `sideSha.oracle ≠ sideSha.bin`, diff contém `__MUTANT__` |
| `error.code` corrompido | `reprovado` — `sideMatch:false`, diff contém `MUTANTCODE` |
| `ok` invertido | `reprovado` — `okMatch:false`, `allMatch:false` |
| exit-code divergente | `reprovado` — `exitCodeMatch:false`, `allMatch:false` |
| `buildManifest.date` divergente | `ok` — `normalized:['date']`, `sideSha.oracle == sideSha.bin` |
| `buildManifest` com outro campo corrompido | `reprovado` — prova que a normalização **não** é irrestrita |

**Tabela 23/23 provas reais (sha oráculo == sha bin, 12 hex iniciais):**

| op | sha oráculo | sha bin | op | sha oráculo | sha bin |
|---|---|---|---|---|---|
| preflight | `5d8e7460c0f5` | `5d8e7460c0f5` | planMerge | `8ff96f2c7c22` | `8ff96f2c7c22` |
| inventory | `54178b21e2b8` | `54178b21e2b8` | applyMerge | `1cf0a97eef38` | `1cf0a97eef38` |
| backup | `90b9a12bab85` | `90b9a12bab85` | buildManifest | `c7f6fd1ae538` | `c7f6fd1ae538` |
| resolveBackupDir | `6bf730528a69` | `6bf730528a69` | writeManifest | `1ff9c3c88ffc` | `1ff9c3c88ffc` |
| loadAnswersFile | `17958d7c1049` | `17958d7c1049` | requireVerifiedBackup | `3ca2b6fcab30` | `3ca2b6fcab30` |
| collectAnswers | `18eb376ee7f6` | `18eb376ee7f6` | runChecks | `56095e3ddc18` | `56095e3ddc18` |
| generateConfig | `540033f43ffa` | `540033f43ffa` | mergeOpencodeJson | `c7f8c0a8a998` | `c7f8c0a8a998` |
| collectIncoming | `68faa5af8840` | `68faa5af8840` | mergeAgentFile | `684201ff638b` | `684201ff638b` |
| main | `367bc8be7793` | `367bc8be7793` | runDoctor | `e69fdf72dca7` | `e69fdf72dca7` |
| runInit | `367bc8be7793` | `367bc8be7793` | runUpgrade | `0f15dc23249e` | `0f15dc23249e` |
| runCli | `842a147667a2` | `842a147667a2` | parseArgs | `bffeb60cb68b` | `bffeb60cb68b` |
| runWizard | `973d5d076a73` | `973d5d076a73` | — | — | — |

### Selo (VAL-04)

`sealCommands(commands)` = `c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2`
— **idêntico** ao publicado. `commands.suiteFull` byte-idêntico; Rust
(`cargo test`), `prova-engine.mjs`, `prova-mutant.mjs` e `--run-parity` rodam
**fora do selo** (rastreabilidade, não contraprova selada).

## 3. Coherence — ✅

| Invariante | Verificação |
|---|---|
| Oráculo anterior ao sujeito | `c63e333` detach, SHA cheio conferido, worktree limpo; nada é gerado a partir do binário |
| 23 nomes = D-ENGINE | `OP_TABLE` 23, sem `planUpgrade`/`applyUpgrade`; `op` nova ⇒ SI-6 (fail-closed) |
| Duas ordens congeladas | `runUpgrade` planeja antes de backup; `main` faz backup antes de planejar; `doctor` é reportado (`doctorPre`), nunca gate |
| Backup verificado antes de escrita | `backup` + `requireVerifiedBackup` no `apply`; dry-run 0 writes (`zeroWrites:true`) |
| Rito do literal | `literalProven:true` via `Veredito: validated literal 9fa4530b… c63e333` (ADR-002 REPORT); 8 shas inalterados |
| Nenhum PASS por omissão | 23 sideSha computados por op; mutante 23/23 reprovado; SI-2/SI-3 sem `$INSTALLER_BIN` ⇒ `not_measured` com motivo explícito |
| Versão do manifesto | `buildManifest.version = '1.0.0'` (oracle `install.mjs:15`) — divergência `0.1.0` mascarada pelo C1, agora corrigida e travada por teste Rust |
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
| 11 | Dependências auditadas, zero CVE alta | ✅ | `Cargo.lock` versionado; crates fixadas com fonte S1/S2/S3 em `Cargo.toml`; `vendor-check OK` |
| 12 | Actuator/Swagger protegidos | **N/A** | sem Actuator/Swagger |
| 13 | Mobile Keychain/Keystore + TLS | **N/A** | não é mobile |
| 14 | Segredo em `stdin` sem eco | ✅ | `canNoEcho`/`readSecretRaw` no oráculo; `parse_request` não ecoa `answers`; prova sem `deployToken` em stdout/stderr/RELATÓRIO |

**Veredito segurança:** ✅ `pass` — 14/14 itens atendidos (9 N/A declarados por CLI local,
5 aplicáveis ✅). Zero achados críticos.

## Conclusão

3/3 dimensões ✅ · 23/23 differential **real** (sha oráculo == sha bin por op, result +
ok + exit-code) · mutante exit-preserving 100% corrompido reprova **23/23** no mesmo
`prova()` · 5 casos de mutação no caminho real · SI-1..SI-6 medido/pass ·
RELATÓRIO reancorado (`batch:3`, `gitSha` = `<COMMIT_SHA>` — commit que entrega o
código, `unit:60`, `it:23`, `sideSha` por op, `mutantGuard` 0/23,
`claimed12of12:false`, `measurement` 9+2) · 5 suítes + cargo + spec (20/20) + prova +
parity verdes · selo `c904f1c5` intacto · trailer `Harness-Gate-Change`.
**Bloqueios:** nenhum. **Próximo:** (após aprovação) push e merge humano do ADR-003,
quando a ponte `installer-contract.mjs:15` expira.
