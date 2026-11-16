# VERIFY — prd-installer-rust-adr-004 (batch 3, TUI-06 + VAL-02 + VAL-03)

> Data 2026-11-16. Base `2d76f93` (HEAD de trabalho `287391a` — commit de abertura do batch 3).
> Evidência: `harness/prd-installer-rust-adr-004.json` (9 comandos, hashes e durações medidos).

## 1. Completeness — ✅ PASS

| Item | Medição |
|---|---|
| Tasks | TUI-06, VAL-02, VAL-03 — 3/3 entregues; JIRA_BOARD 9/9 DONE |
| 8 `op`s TUI | `askMenuStep`, `detect`, `printPlan`, `printUsage`, `promptAnswers`, `readSecretPrompt`, `readSecretRaw`, `sourceLineOf` — `diff -u` inventário↔dispatcher vazio |
| Dispatcher | `OP_NAMES = 31` = 23 D-ENGINE + 8 D-TUI; nenhuma op de escrita na classe |
| Ponte | `installer/installer-contract.mjs`: 18 → 10 nomes; 8 removidos, 10 D-ENGINE mantidos; `grep -rn "from '.*install\.mjs'"` = 1 |
| Suítes | plugins 540/540 · installer 714/714 · static 0 · sdd 0 · vendor 0 · cargo 85/85 · 8 provas · `--run-parity` PASS |
| TODO/STUB | zero no escopo do batch |

## 2. Correctness — ✅ PASS

| Dimensão | Evidência |
|---|---|
| Transcript | 16.336 B, sha `fe1f9187…`, 5 marcadores, `diff` com oráculo `c63e333` vazio |
| Canais | **medidos**: `r.json` 1 envelope (`v:1`), `r.err` 29 B de protocolo; `grep -c '"v":1' r.err = 0`; `grep -cE '^\[(OK\|INFO\|AVISO)\]' r.json = 0` — fecha o 🟠 do batch 1 |
| Segredo | 0 ocorrências de `SEGREDO_PROVA` em `/proc/$PID/cmdline`, stdout e stderr; `SIGTERM` com sinal preservado |
| Guarda RF-05(b) | 3 caminhos: limpo exit `0`, `fs::write` injetado exit `1`, arquivo ausente exit `1` |
| Provas | 8/8 `ok` contra `c63e333`; 8/8 binários mutantes exit-preserving reprovados; mutação 1 byte por op reprova |
| Review fixes | FU-ADR004-01 (envelope alinhado) e FU-ADR004-02 (`free()` fora do handler) corrigidos e testados |
| Selo | `c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2`; `commands.suiteFull` byte-idêntico; `git diff --exit-code` em `harness.config.json`/`seal.mjs` = 0 |

## 3. Coherence — ✅ PASS

| Invariante | Resultado |
|---|---|
| I1 (telas/campos) | 10×5 = 50 campos; 4 ramos; nenhuma transição nova |
| I2 (transcript) | autoridade externa intacta, byte-a-byte |
| I3 (tela não grava) | guarda estrutural em `wizard.rs` e em `src/tui/ops.rs` (sem `fs::write`/`File::create`/`write_all`/`OpenOptions`) |
| I4 (0 writes) | aborto/dry-run inalterados; nenhuma op TUI escreve |
| I5 (segredo) | nunca em argv/stdout/stderr/envelope de pipe |
| I6 (canais) | envelope em stdout, progresso/protocolo em stderr |
| I7 (sem ANSI) | nenhum escape adicionado |
| Arquitetura | `apply` permanece no motor; nenhum crate/versão/toolchain/framework decidido; nenhum path protegido tocado |

## Segurança — Fase 4 (14 itens)

13 itens da zero-tolerance checklist + item 14 específico do risco R5 (ADR-004 §2.4):
- **Aplicáveis e PASS (2)**: input validation (`parse_request`/`EngineError`); segredos (`/proc`+canais medidos).
- **PASS específico (1)**: cleanup de terminal após sinal (`tcsetattr` sem `free()` no handler).
- **N/A declarados (11)**: acesso HTTP, SQL, senhas, JWT, TLS, headers, `v-html`, rate limiting, auditoria de dependências (nenhuma nova; `Cargo.lock` congelado), Actuator/Swagger, mobile Keychain.
- 🔴 críticos: **0**. Verdict: **pass**.

## Rito ADR-002

Literal `9fa4530bbe0d431781a159cced28c011e1d94a8abea5ca1cc8465608976552f0` (sha256 do **arquivo** `installer/__tests__/oracle-literal.sha256`) verificado por `sha256sum` e por `isLiteralProven(harness/prd-installer-rust-adr-002.json)`. Veredito existente **reutilizado**; nenhuma assinatura nova escrita por este agente; nenhuma rubrica pendente.

## Portões pendentes (fora deste papel)

- `code_review_status`: orquestrador delega `code-reviewer` após o commit.
- Override `D1-two-motors-restante` no `workflow-state.json`: **não alterado** — governança do orquestrador (10 D-ENGINE seguem em `FU-D1-ENGINE10`).
- Push: **não executado**.
