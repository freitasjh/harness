# PROPOSAL — prd-agnostic-artifacts-adr-003

> Ciclo SDD escopado do **ADR-003 do PRD-2** (skills comuns + `spec-review`).
> Fonte: `.spec/prd/prd-agnostic-artifacts/ADRs/ADR-003-skills-comuns-e-spec-review/ADR.md` (417 l., 12 itens, G2 aprovado 2026-11-12).

## 1. Problema (medido em `4838e0e`)

| Fato | Número |
|---|---|
| `spec-review` no payload | 5 arquivos, **1.298 linhas**, **33 entradas de baseline** |
| Origem do conteúdo | **100% TaskFlow** (identidade + checklist stack-bound) |
| `SKILLS_COMMON` | 22 entradas (a skill vai a **todo** destino) |
| Baseline total | 80 (66 `incondicional` + 14 `identity`) |
| `security-review/SKILL.md:4` | `license: TaskFlow Security Standard` → `structural-debt=1` |
| `PROJECT_TERMS` | 3 termos com prova viva |

## 2. Proposta

Apagar `spec-review` do payload (**não** reescrever 1.298 linhas de material alheio), remover a entrada de `SKILLS_COMMON` (1 linha, 0 mapas), substituir a invocação do `workflow-rules` §4 por **R1 mecânico** (`spec-gate` + `commands.suiteFull`) com R2 opcional (revisor do projeto), e re-derivar a baseline por arquivo.

## 3. Escopo

Os 12 itens de interface do `ADR.md` §3.

## 4. Não-escopo

ADR-004 (referências + `DESIGN.md`), ADR-005 (frota restante, incl. `TaskFlow` residual em 3 linhas e o `nestjs:81`/`node:86`), reescrita de conteúdo genérico.

## 5. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | Remover a skill e deixar a fase 3 sem revisor | R1 mecânico obrigatório + `grep spec-review = 0` com `Revisar SPEC` = 1 |
| R2 | `dir` e entrada de `SKILLS_COMMON` em commits diferentes | `eixos-stack.spec.mjs:533,538` (disco↔lista nos dois sentidos) — mesmo commit |
| R3 | ADR-001 §4.5-D1 afirma 0 `incondicional` nas rules de frontend; medido 3 | N2 do ADR-003 registra; a decisão usa o medido |
| R4 | `spec-gate.md` ainda tem 1 entrada TaskFlow | declarado em C6(c), dono ADR-005 |
| R5 | `V20` não mede órfão de invocação | prova por `grep` (🟡), declarado em N8 |

## 6. Verificação

5 comandos + `V20` com `baseline=38 (34+4)`; `git diff` de `harness.config.json`/`seal.mjs` vazio; `grep -rn spec-review` ⇒ 0.
