# SPEC — prd-eixos-separados-cli-adr-002

> Prescritivo. Origem: ADR-002 §3 (12 itens), protótipo aprovado (`workflow-state.json.prototype`), B1. Em conflito, o ADR prevalece.

## 0. Score do spec-gate
Ver `GATE-SPEC.md`. Alvo 100%.

## 1. Requisitos funcionais
- **RF-01 (1)** — **N=4 telas + resumo**, ordem backend→frontend→nome→token; nenhuma tela extra sem §16.
- **RF-02 (2)** — **M interações medidas** congeladas: 2 setas+Enter (backend) / 1 seta+Enter (frontend) / Enter (nome) / token+Enter; wizard.spec cobre as 4 transições.
- **RF-03 (3)** — **zero comando digitado**: nenhuma etapa lê nome de stack como texto livre; só setas+Enter.
- **RF-04 (4)** — **i18n PT-BR completo**: todo texto vem de chave de locale; nenhuma string solta em prompt/message/placeholder.
- **RF-05 (5)** — segredo `[input is masked]` / `[REDACTED]`; `SEGREDO_PROVA` ausente de `/proc/$PID/cmdline`, stdout, stderr e transcript.
- **RF-06 (6)** — **`rust+vue` separados**:.backend e frontend vêm dos eixos da ADR-001, não de preset casado; config válida.
- **RF-07 (7)** — aborto (`q`/EOF/`ExitPromptError`/`USER_ABORT`) ⇒ **0 escrita** (hash de árvore antes=depois) e terminal com eco restaurado.
- **RF-08 (8)** — **B2 não escolhida, protótipo não reaberto**: nenhum full-screen (`ratatui|inquire|dialoguer`), nenhuma mudança de N/M sem §16.
- **RF-09 (9)** — **transcript novo ratificado**: 4 telas + resumo, marcadores PT-BR, sha registrado antes de virar baseline; **nenhuma afirmação de paridade com 16.336 B**.
- **RF-10 (10)** — consome ADR-001: eixos, não presets; wizard.spec + eixos-stack.spec 0 falha.
- **RF-11 (11)** — suíte completa 0 falhas (H1/H2); PRD/ADR-01/ADR-02 PASS.
- **RF-12 (12)** — escopo: versão/pin/toolchain/publicação no SDD; ADR decide só apresentação, critério medido e segredo.

## 2. Invariantes
- **I1** — N=4/M medido congelados; protótipo é a autoridade, não reaberto sem §16.
- **I2** — segredo nunca em argv/stdout/stderr/RELATÓRIO; mask + `[REDACTED]`.
- **I3** — aborto = 0 writes; terminal restaurado (SIGTERM/SIGINT/EOF).
- **I4** — eixos separados da ADR-001; nenhum preset casado na seleção.
- **I5** — transcript novo ratificado, sem promessa de paridade com o antigo.

## 3. Edge cases
- E1 — adicionar 5ª tela ⇒ viola N, exige §16.
- E2 — digitar nome de stack como texto ⇒ viola "zero comando digitado".
- E3 — `q` no segredo ⇒ `USER_ABORT`, não valor lido.
- E4 — `SIGTERM` com prompt aberto sem restore ⇒ terminal sem eco.
- E5 — claim de "mesmo transcript 16.336 B" ⇒ proibido (item 9).

## 4. Estratégia de teste
| Nível | Comando | Esperado |
|---|---|---|
| Wizard | `node --test installer/__tests__/wizard.spec.mjs` | 4 transições, 0 comando, PT-BR |
| Segredo | `qa.spec.mjs` + `/proc/$PID/cmdline` | 0 occurrence de SEGREDO_PROVA |
| Eixos | `eixos-stack.spec.mjs` | rust+vue separados, config válida |
| Transcript | novo transcript sha ratificado | 4 telas, sem paridade antiga |
| Harness | `static-checks && sdd-checks` | 0 falhas |

## 5. N/A declarado (spec-gate)
- DDD api/impl/public — N/A (apresentação CLI, não camada Java).
- Segurança/IAM — N/A (sem auth HTTP; SECURITY.md STRIDE cobre segredo/TTY).
- ERD — N/A (nenhuma entidade persistida nova).
- Event Registry — N/A (prompts síncronos).
- Migrations — N/A (não-Java).
