# PROPOSAL — prd-installer-rust-adr-004

> Ciclo SDD escopado do **ADR-004 do PRD-3** (TUI de 10 telas). Fonte: `.spec/prd/prd-installer-rust/ADRs/ADR-004-tui-dez-telas/ADR.md` (17 itens §3; G2 aprovado).
> Classificação P0→P1: **Refactor** — modelo de apresentação, nenhum prompt/default/range/transição novo.

## 1. Problema (medido)

| Fato | Valor |
|---|---|
| Telas | **10** (W0, W1, W2, W2m-1, W2m-2, W3, W4, W5, W6, W7) × **5 campos** = 50, nenhum vazio |
| `op`s de TUI | **8** (`askMenuStep`, `detect`, `printPlan`, `printUsage`, `promptAnswers`, `readSecretPrompt`, `readSecretRaw`, `sourceLineOf`) |
| Transcript oráculo | **16.336 bytes**, 5 marcadores `[1/2]`, `[2/2]`, `[1-5]`, `(default: 1)`, `(q cancela)` — SI-4 |
| Transições | **0 nova**; só 4 ramos de `runWizard` (W2 pubspec; W2m next; retry; aborto) |
| Risco R5 | `SIGTERM` com prompt de segredo aberto deixa terminal sem eco — critério de rejeição |
| Ponte D1 | 8 D-TUI em dívida (`D1-two-motors-restante`); este ADR os leva ao dispatcher Rust |

**Defeito evitado:** trocar prompts line-based por widgets de tela cheia muda os bytes do transcript e SI-4 deixa de provar; tratar a tela como dona da escrita inverte ADR-001/003 (aborto deixaria arquivo no destino).

## 2. Proposta

Modelo declarativo de 10 telas × 5 campos (I/C/P/E/A), navegação = ordem existente de `runWizard`, prompts/defaults/ranges comparados byte-a-byte ao transcript e ao Node `c63e333`, tela interpela e formata mas **nunca grava** (`apply` no motor), segredo sem eco em TTY com cleanup obrigatório, `stdout` só envelope / `stderr` progresso. Crate/framework fora da decisão (critério §2.4, fontes S4/S5/S6/S10/S11).

## 3. Escopo

17 itens de interface do ADR §3; 10 telas × 5 campos; 8 `op`s de TUI; ritos de segredo/cleanup/canais; parecer `ux-designer` M1..M8.

## 4. Não-escopo

23 `op`s de engine (ADR-003) · 10 `D-ENGINE` em dívida de byte-paridade (FU-D1-ENGINE10) · publicação/runtime (ADR-005) · gate/config/selo/presets · crate/versão/toolchain.

## 5. Parecer do ux-designer (vinculante, anexo em UX.md)

Jornada já sólida. Melhorias em **E** (estado no envelope, nunca em `stderr`) e **A** (acessibilidade/meio): M1 estado declarativo, M2 `[AVISO]` como sequência informativa, M3 ramo do W2 como dado, M4 retry da mesma pergunta, M5 prévia sem paginar, M6 0 writes antes de confirmar, M7 progresso/veredito só `[i/total]`/`[OK|ERRO]`, M8 cleanup idempotente antes de leitura sem eco. Pulse = vocabulário semântico, **nunca escape ANSI**.

## 6. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R-ADR2 | widget muda bytes do transcript | prompts line-based; `diff` vazio (item 2) |
| R-ADR5 | tela grava no aborto | guarda dupla JS+Rust em RF-05 (item 5) |
| R-ADR9 | segredo vaza | `stdin` TTY sem eco, `serializeSkips` em pipe, `[REDACTED]` (itens 7/8) |
| R-ADR10 | `SIGTERM` sem eco | handler idempotente + prova PTY (item 9) |
| R-ADR11 | canais misturados | `stdout` envelope / `stderr` progresso (item 10) |

## 7. Verificação

17 itens com comando; `diff` do transcript 16.336 B; 8 `op`s provadas; cleanup PTY; 5 suítes + cargo em paralelo; selo `c904f1c5` intacto.
