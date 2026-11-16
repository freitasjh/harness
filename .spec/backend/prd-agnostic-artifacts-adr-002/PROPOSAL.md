# PROPOSAL — prd-agnostic-artifacts-adr-002

> Ciclo SDD escopado do **ADR-002 do PRD-2** (classe (b) nas 2 entradas sempre-instaladas + herança de autoria).
> Fonte: `.spec/prd/prd-agnostic-artifacts/ADRs/ADR-002-entradas-sempre-instaladas/ADR.md` (344 l., 13 itens, G2 aprovado 2026-11-12).

## 1. Problema (medido, `V20` na `main`)

| Fato | Número |
|---|---|
| Baseline total | 96 (81 `incondicional` + 15 `identity`) |
| Linhas incondicionais em `workflow-rules.md` (609 l., **`RULES_COMMON`**) | **15** — maior ofensor isolado |
| Destinos que recebem esse arquivo | **todos** |
| Prescrição para um repo cujo `harness.config.json.stack = N/A` | JUnit+Mockito, Spring, Maven, Testcontainers, Flyway, Lombok/MapStruct, Vue/NestJS |
| Identidade "projeto Atlas ECM" em `sdd-workflow-standard.md:3` | 1 |
| Permissão do `orchestrator` para `.spec/**` | **inexistente** (`edit: deny`) com a prosa atribuindo autoria |

## 2. Proposta

Reescrever as 15 linhas pela rubrica do ADR-001 (4 genéricas → `commands.*` do config; 11 → `condicional` por heading/célula), trocar a identidade do `sdd-workflow-standard` por escopo, e dar ao `orchestrator` `edit` **resolvido** (`deny *` antes de `allow .spec/**`).

## 3. Escopo

Os 13 itens de interface do `ADR.md` §3.

## 4. Não-escopo

ADR-003 (skills comuns + `spec-review`), ADR-004 (referências + `DESIGN.md`), ADR-005 (frota restante), e qualquer mudança em `gate.js`/`harness.config.json`/selo.

## 5. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | Ordem invertida mata D6 em silêncio | asserção de **índice** no teste (hoje exit 1) |
| R2 | Linha inserida desloca vizinhos e `ADR-005` herda `cdl-baseline-stale` | contagem de linhas congelada (item 7/10) |
| R3 | `PROJECT_TERMS.proof` morre ao reescrever `:3` | re-apontar para `frontend-coding-standards.md:154` |
| R4 | `config-dual-parity.spec.mjs` atual compara `edit === "deny"` | atualizar o teste no mesmo commit |
| R5 | `bash: allow` contorna o escopo | declarado (evasão A/B/C aberta) |

## 6. Verificação

5 comandos + `V20` com baseline **80**; `git diff` de `installer/`/`seal.mjs` vazio; permissão provada por `opencode debug config`.
