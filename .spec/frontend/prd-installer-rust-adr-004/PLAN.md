# PLAN — prd-installer-rust-adr-004

> Compilado de `SPEC.md` (18 RF) + ADR-004 §3 + parecer `ux-designer` (`UX.md`, M1..M8). Branch `04-impl`, base `9a74ba9`. Refactor de apresentação: nenhum prompt/default/range/transição/mensagem nova.

## 1. Fases

| Fase | Objetivo | Tasks |
|---|---|---|
| F0 — Modelo + guardas | modelo 10×5 no módulo de tela, guarda de escrita com dente, transcript e canais travados | TUI-01, VAL-01 |
| F1 — Navegação | W0→W7 na ordem de `runWizard`, 4 ramos, 0 transição nova, retry da mesma pergunta | TUI-02, TUI-03 |
| F2 — Segredo/meio | TTY sem eco, pipe `serializeSkips`, cleanup `SIGTERM` (R5) | TUI-04, TUI-05 |
| F3 — 8 ops + quitação | 8 `op`s de TUI 1:1 no dispatcher, prova por tela, ponte D1 perde os 8 nomes | TUI-06, VAL-02 |
| F4 — Relatório | rito do literal, 5 suítes + cargo, selo, VERIFY | VAL-03 |

**Execution graph:** `F0 → F1 → F2 → F3 → F4`. Critical path: `TUI-01 → VAL-01 → TUI-02 → TUI-03 → TUI-04 → TUI-05 → TUI-06 → VAL-02 → VAL-03`.

## 2. Traceability 1:1 (RF → task)

| RF | Item ADR | Task |
|---|---|---|
| RF-01 | 1 | TUI-01 |
| RF-02 | 2 | VAL-01, VAL-02 |
| RF-03 | 3 | TUI-02, TUI-03 |
| RF-04 | 4 | TUI-06, VAL-02 |
| RF-05 | 5 | TUI-01, VAL-01 (guarda com dente) |
| RF-06 | 6 | TUI-03, TUI-05 |
| RF-07 | 7 | TUI-04, VAL-02 |
| RF-08 | 8 | TUI-04 |
| RF-09 | 9 | TUI-05 |
| RF-10 | 10 | TUI-01, VAL-02 |
| RF-11 | 11 | TUI-06 (8 D-TUI; 10 D-ENGINE seguem em dívida) |
| RF-12 | 12 | TUI-02, TUI-06 |
| RF-13 | 13 | VAL-01, VAL-02 |
| RF-14 | 14 | VAL-03 |
| RF-15 | 15 | VAL-03 |
| RF-16 | 16 | VAL-03 |
| RF-17 | 17 | TUI-01 (crate/versão fora, fonte S4/S5/S6/S10/S11) |
| RF-18 | UX M1..M8 | TUI-01..TUI-05 (estado no envelope, cleanup antes da leitura) |

## 3. Constraint mapping

| Constraint | Enforcement | Failure Mode |
|---|---|---|
| 0 byte novo no transcript | `diff -u "$TRANSCRIPT" <(TTY binário)` vazio; 16.336 B | 1 byte mudado ⇒ FAIL |
| 0 transição nova | diff de ramos oráculo↔binário; sem `voltar`/`pular` | 5º ramo ⇒ FAIL |
| Tela nunca grava | **asserção RF-05(b)**: `test -f wizard.rs && test "$(grep -cE 'std::fs::write|fs::write|File::create|write_all|OpenOptions|apply_merge|write_manifest|backup\(' ...)" -eq 0` | match ou arquivo ausente ⇒ FAIL |
| Aborto 0 writes | hash antes=depois + `USER_ABORT`/`NO_STDIN` + exit 1 | 1 write ⇒ FAIL |
| Segredo sem eco | PTY + `q` no segredo + `/proc/$PID/cmdline` limpo | 1 occurrence de `SEGREDO_PROVA` ⇒ FAIL |
| Cleanup SIGTERM | `stty -a` eco restaurado + `ExitStatus` com sinal | exit 0 com prompt aberto ⇒ FAIL |
| Canais separados | `stdout` envelope / `stderr` progresso | `"v":1` em `.err` ⇒ FAIL |
| Pulse sem ANSI | prefixos textuais; nenhum byte `\x1b` | 1 ANSI ⇒ FAIL (SI-4) |
| Selo intacto | `c904f1c5…`, Rust/TUI fora de `suiteFull` | comando novo no selo ⇒ FAIL |

## 4. Event lifecycle
**N/A** — comunicação síncrona por stdin/stdout/stderr (`contract-v1`); sem barramento.

## 5. Testes obrigatórios
- Transcript byte-a-byte em TTY (16.336 B, 5 marcadores) · canais separados · segredo PTY + cleanup · 8 `prova(op)` · guarda de escrita com dente nos 3 caminhos · mutação de 1 byte no transcript reprova.
- Suíte Rust em paralelo; 5 suítes Node; selo intacto.

## 6. Rollback
`git reset --hard 9a74ba9`. A ponte D1-two-motors-restante volta a 18 nomes; nenhum gate/config/selo tocado.
