# SPEC — prd-installer-rust-adr-004

> Prescritivo. Origem: ADR-004 §3 (17 itens), §2.1 (10 telas × 5 campos), §2.2 (ramos), parecer `ux-designer` M1..M8 (`UX.md`). Em conflito, o ADR prevalece. Classificação: **Refactor** (P0→P1 aprovado 2026-11-16).

## 0. Score do spec-gate
Ver `GATE-SPEC.md`. Alvo 100%.

## 1. Requisitos funcionais

- **RF-01 (item 1)** — modelo declarativo de exatamente **10 telas × 5 campos** (I/C/P/E/A), 50 campos preenchidos; `grep -c '^| \*\*W'` no ADR ⇒ 10; nenhum campo vazio. 🟢 oráculo · 🟡 SDD.
- **RF-02 (item 2)** — marcadores do transcript intactos: `[1/2]`, `[2/2]`, `[1-5]`, `(default: 1)`, `(q cancela)`; `diff -u "$TRANSCRIPT" <(transcript mesclado do binário em TTY)` ⇒ vazio; transcript **16.336 bytes** imutável (`git diff --exit-code`).
- **RF-03 (item 3)** — **0 transição nova**: só os 4 ramos medidos (W2 com/sem pubspec; W2m-1 com/sem `next`; retry da mesma pergunta; aborto). `diff` das transições oráculo↔binário vazio; nenhum rótulo `voltar`/`pular`.
- **RF-04 (item 4)** — cada uma das 10 telas tem comando de prova não vazio (tabela ADR §2.1); `prova(op)` para as **8** `op`s de TUI ⇒ `diff` vazio.
- **RF-05 (item 5)** — a tela **nunca grava**: **Guarda dupla (F1 — architect):** (a) literal do ADR-004 §3-5 `grep -cE 'applyMerge|applyUpgrade|writeManifest|fs\.write|writeFile|backup\(' <módulo de tela>` ⇒ **0**; (b) **guarda Rust real, restrita à TELA** (F1-rodada2): `test -f installer-rs/src/entry/wizard.rs && grep -cE 'std::fs::write|fs::write|File::create|write_all|OpenOptions|apply_merge|write_manifest|backup\(' installer-rs/src/entry/wizard.rs; test $? -le 1` ⇒ **0**. `entry/*.rs` contém chamadas legítimas de engine (`main.rs`, `upgrade.rs` — 9 hits) e **não** é tela; `src/tui/` ainda não existe (glob inexistente ⇒ exit 2, proibido). Caminhos de escrita `ops/write.rs:15` e `ops/merge.rs:190,210,305,313` pertencem ao motor, fora da guarda por desenho. O módulo de tela é Rust (`installer-rs/src/entry/wizard.rs`); a escrita real no repo é `std::fs::write` (`ops/write.rs:15`, `merge.rs:190,210,305,313`) — regex JS `fs\.write`/`writeFile` NÃO casa com `fs::write`. `apply` permanece no motor (ADR-003).
- **RF-06 (item 6)** — aborto ⇒ **0 writes**: hash de árvore antes=depois + envelope `USER_ABORT`/`NO_STDIN` + exit `1`.
- **RF-07 (item 7)** — segredo sem eco em TTY: `canNoEchoTTY=true`, `r.close()` → `readSecretPrompt` → novo reader; `q` no segredo ⇒ `USER_ABORT`; `grep -F SEGREDO_PROVA` vazio em `/proc/$PID/cmdline`, `stdout`, `stderr`; `[OK] deployToken = [REDACTED]`.
- **RF-08 (item 8)** — `serializeSkips` em pipe: envelope de `promptAnswers` **sem** chave `deployToken` (`grep -c '"deployToken"'` = 0); `sanitizeLog` ⇒ `token=[REDACTED]`; nenhum prompt órfão em `stdout`.
- **RF-09 (item 9, R5)** — cleanup após `SIGTERM`: handler **idempotente registrado antes** da leitura sem eco; `kill -TERM` com prompt aberto ⇒ `stty -a` com eco restaurado, nova leitura visível, `ExitStatus` com sinal, **nunca exit 0**. Sem handler ⇒ rejeição (M8).
- **RF-10 (item 10)** — canais separados: `stdout` exclusivo do envelope `contract-v1`; `stderr` progresso/prompt; `grep -c '"v":1' /tmp/r.err` ⇒ 0; `grep -cE '^\[(OK|INFO|AVISO)\]' /tmp/r.json` ⇒ 0; união mesclada `diff` vazia.
- **RF-11 (item 11)** — 8 `op`s de TUI 1:1 (`D-TUI`): `diff -u <(nomes D-TUI) <(ops TUI do dispatcher)` ⇒ vazio; nenhuma `op` de escrita na classe. **Este ADR quita os 8 D-TUI; os 10 D-ENGINE seguem em dívida** (`D1-two-motors-restante` é 18 nomes — `FU-D1-ENGINE10` depende de decisão owner sobre byte-paridade).
- **RF-12 (item 12)** — `runWizard` é do motor (ADR-003 §2.1 #23), `promptAnswers` interpela; a tela nunca chama `applyMerge` direto, só `op` de engine via adapter.
- **RF-13 (item 13)** — oráculo materializado (`c63e33307710e1c…49c`, `status --porcelain` vazio) e transcript imutável (16.336 B) antes de cada prova.
- **RF-14 (item 14)** — rito de ADR-002: linha `Veredito: validated literal <sha256> <ISO-8601> <oráculo>` em `harness/<demand>.json` antes de qualquer novo literal de tela; `cargo insta review` só leitura, `.snap.new` nunca baseline.
- **RF-15 (item 15)** — selo `c904f1c5…` intacto; `commands.suiteFull` byte-idêntico; suíte TUI/paridade em comandos paralelos fora do selo.
- **RF-16 (item 16)** — ledger 1:1 (`PASS ADR-01`/`ADR-02`, sequência 1-2-3-4, 1 `in-progress`, branch no padrão); PR humano.
- **RF-17 (item 17)** — nenhum crate/versão/toolchain/decisão de framework pinado neste ADR; escolha pelo critério §2.4 com fonte `RESEARCH.md` S4/S5/S6/S10/S11; sem fonte = SI-6.
- **RF-18 (UX M1/M8, vinculante)** — estado novo (M1) vai no **envelope**, nunca em `stderr`; **novas chaves em `result` exigem decisão §16/SI-6 + rito RF-14 e ficam fora do diff SI-4** (canais já fechados em ADR-001 §2.1/ADR-004 §2.5); cleanup de terminal (M8) precede qualquer leitura sem eco. Melhorias M2..M7 aplicadas conforme `UX.md`, todas custo 0 no transcript.

## 2. Invariantes

- **I1** — 10×5 = 50 campos, nenhum vazio; transições = exatamente 4, nenhuma nova.
- **I2** — transcript é autoridade externa; byte-a-byte; espaços finais e `\r` preservados.
- **I3** — tela interpela/formata, **nunca grava**; `apply` no motor.
- **I4** — aborto/dry-run/erro antes de `apply` ⇒ 0 writes e exit `1` (dry-run `0`).
- **I5** — segredo: nunca em argv/stdout/stderr/RELATÓRIO/envelope em pipe; TTY sem eco com restore.
- **I6** — canais: `stdout`=envelope, `stderr`=progresso; nenhuma mistura.
- **I7** — Pulse como vocabulário semântico; **zero escape ANSI** (cor quebraria SI-4); âmbar só em ação.

## 3. Edge cases

- E1 — widget de tela cheia troca `[1/5]` por caixa ⇒ transcript diverge ⇒ proibido.
- E2 — copy-edit de `Diretorio`/`deteccao` ⇒ byte novo sem §16 ⇒ proibido.
- E3 — `SIGTERM` durante segredo sem handler ⇒ terminal sem eco ⇒ rejeição.
- E4 — `q` no segredo tratado como valor ⇒ vaza intenção do operador; deve ser `USER_ABORT`.
- E5 — spinner/barra de progresso ⇒ byte novo; usar `[i/total]` existente.
- E6 — tela chamando `applyMerge` ⇒ aborto deixa escrita; inverte ADR-001/003.

## 4. Estratégia de teste

| Nível | Comando | Esperado |
|---|---|---|
| Transcript | `diff -u "$TRANSCRIPT" <(binário TTY)` | vazio; 16.336 B; 5 marcadores |
| Canais | envelopes em `/tmp/r.json` vs `/tmp/r.err` | separação estrita (item 10) |
| Segredo/cleanup | PTY + `kill -TERM` + `stty -a` + `/proc/$PID/cmdline` | eco restaurado, sinal, sem segredo |
| 8 ops TUI | `prova(op)` × 8 contra `c63e333` | `diff` vazio; dispatcher D-TUI 1:1 |
| Suítes | 5 suítes + cargo em paralelo | 0 falhas; selo `c904f1c5` intacto |

## 5. N/A declarado (spec-gate)
- **DDD api/impl/public** — `N/A — módulo de apresentação Rust sob contract-v1; não é camada Java`.
- **Segurança/IAM `@HasPermission`** — `N/A — CLI local sem autenticação HTTP/API; segredo em stdin sem eco (I5)`.
- **ERD** — `N/A — nenhuma entidade persistida nova; manifesto v1 e backup já existentes`.
- **Event Registry** — `N/A — comunicação por stdin/stdout/stderr (contract-v1), sem barramento`.
- **Migrations** — `N/A — não-Java; nenhuma migration`.
