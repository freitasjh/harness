# PLAN — prd-eixos-separados-cli-adr-002

> Compilado de SPEC.md (12 RF) + ADR-002 §3 + protótipo aprovado (workflow-state.json.prototype). Branch `02-cli-visual-impl`, base `75caa4a`. Feature §16 D16-EIXOS-CLI; B1 @inquirer; protótipo N=4/M congelado.

## 1. Fases
| Fase | Objetivo | Tasks |
|---|---|---|
| F0 — Infra CLI | dependência @inquirer + i18n PT-BR, locale, AbortSignal | CLI-01 |
| F1 — Telas | 4 telas (backend, frontend, nome, token) + resumo, setas+Enter, zero comando | CLI-02, CLI-03 |
| F2 — Segredo/aborto | password sem eco, [REDACTED], USER_ABORT, 0 writes, restore de eco | CLI-04 |
| F3 — Transcript/eixos | transcript novo ratificado, rust+vue separados consomem ADR-001 | VAL-01 |
| F4 — Verificação | suíte, canais, N/M medidos, VERIFY | VAL-02 |

**Critical path:** `CLI-01 → CLI-02 → CLI-03 → CLI-04 → VAL-01 → VAL-02`.

## 2. Traceability 1:1
| RF | Item | Task |
|---|---|---|
| RF-01 N=4 | 1 | CLI-02 |
| RF-02 M medido | 2 | CLI-02, VAL-02 |
| RF-03 zero comando | 3 | CLI-02 |
| RF-04 i18n PT-BR | 4 | CLI-01, CLI-02 |
| RF-05 segredo | 5 | CLI-04 |
| RF-06 rust+vue | 6 | CLI-03, VAL-01 |
| RF-07 aborto 0 writes | 7 | CLI-04 |
| RF-08 B2/proto não reaberto | 8 | CLI-01, VAL-02 |
| RF-09 transcript novo | 9 | VAL-01 |
| RF-10 consome ADR-001 | 10 | CLI-03, VAL-01 |
| RF-11 suíte + ledger | 11 | VAL-02 |
| RF-12 escopo | 12 | CLI-01 (pin no SDD) |

## 3. Constraint mapping
| Constraint | Enforcement | Failure Mode |
|---|---|---|
| N=4/M congelado | wizard.spec 4 transições; N/M do state | 5ª tela ⇒ FAIL |
| zero comando digitado | fluxo só setas+Enter | stack como texto livre ⇒ FAIL |
| i18n PT-BR | todo texto de chave de locale; grep string solta | literal solto ⇒ FAIL |
| segredo fora de canais | /proc cmdline + stdout/stderr + transcript vazios | 1 occurrence ⇒ FAIL |
| aborto 0 writes | hash árvore antes=depois + eco restaurado | 1 write ⇒ FAIL |
| eixos separados | eixos da ADR-001, não preset casado | preset casado ⇒ FAIL |
| B2 ausente | grep word-boundary: `/\b(inquire|ratatui|dialoguer)\b/` excluindo `@inquirer/` | full-screen ⇒ FAIL |
| transcript novo ratificado | sha antes de baseline; sem paridade 16336B | claim de paridade ⇒ FAIL |

**Desambiguação RF-08 (watch-out architect):** o grep do ADR item 8 (`ratatui|inquire|dialoguer`) casa substring de `@inquirer/prompts`. Usar word-boundary `/\b(inquire|ratatui|dialoguer)\b/` e excluir o escopo `@inquirer/`. `@inquirer/prompts` é a escolha B1, não B2.

## 4. Event lifecycle
**N/A** — prompts síncronos, sem barramento.

## 5. Testes
wizard.spec (4 transições), qa.spec (segredo), eixos-stack.spec (rust+vue), transcript novo com sha, canais separados, 4 etapas 0 falhas.

## 6. Rollback
`git reset --hard 75caa4a`. Nenhum gate/config/preset da ADR-001 tocado.
