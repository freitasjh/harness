# Specs Desenvolvidas

Registro cronológico de funcionalidades e refactors entregues.

| Data | ID | Tipo | Descrição | Spec | Status |
|------|----|------|-----------|------|--------|
| 2026-09-27 | `refactor-prompt-optimizer` | Refactor | Skill `prompt-optimizer` v1→v2: tiers (3) → score 6 elementos PICCO, 2 rotas, re-encoding com delimiter tags, rota de conflito, exceção de comandos de consulta. 5 call sites sincronizados. | `.spec/archive/20260927-refactor-prompt-optimizer/` | Completed |

## Etapas concluídas — refactor-prompt-optimizer
- [x] Fase 1 — Análise (SPEC, score 92%)
- [x] Fase 2 — Planejamento (TASKS, PO-01..PO-08)
- [x] Fase 3 — Execução (7 arquivos criados/modificados)
- [x] Fase 3/4 — Code review iteração 1: 3 🔴 + 10 🟡 + 6 🟢
- [x] Fase 4 — Correção iteração 2: 19 gaps
- [x] Fase 4 — Correção iteração 3: 2 regressões (Y1, Y2)
- [x] Fase 5 — Verify (V1-V6 + Y1 + Y2 confirmados)
- [x] Fase 6 — Archive
| 2026-09-29 | `harness-v7-hardening` | Refactor | Harness soft-law → enforcement duro: `gate.js` bloqueante (`tool.execute.before` + `DenyError`), evidência machine-checkable + contraprova, `harness.config.json` por projeto, gate PICCO, SDD sob o harness, reviewer renomeado `code-reviewer`. 8 batches, 19/21 tasks (2 pendentes de remote), 103+8 testes, smoke 7/7 vivo. | `.spec/archive/20260929-harness-v7-hardening/` | Completed |

## Etapas concluídas — harness-v7-hardening
- [x] Fase 0 — Triagem (Refactor, escopo A, PICCO re-encoded)
- [x] Fase 1 — Análise (PROPOSAL + SPEC v1→v4, 3 reprovações do architect, RUNTIME-CONTRACT, security partial)
- [x] Fase 2 — Planejamento (PLAN 17+5 tickets, TASKS BDD, P2→P3)
- [x] Fase 3 — Execução (8 batches, reviews APPROVED, 0 🔴 em aberto)
- [x] Fase 4 — Quality (smoke 7/7 vivo pós 4 restarts, LOADER-01 + FU-19 diagnosticados e corrigidos)
- [x] Fase 5 — Verify (3 dimensões ✅, aceite §14 4/4)
- [x] Fase 6 — Archive (deltas aplicados durante os batches; sem `.doc` neste repo)
| 2026-09-29 | `harness-installer` | Feature | Instalador repo→repo (Node ESM, zero deps): Q&A que gera config (anti-Hive), backup-first + merge por camada, manifesto `.harness-install.json`, checks + canário, dogfood em cópia atlas-ecm + CLI-smoke em processo fresco. 7/7 tasks, 51 testes, smoke S1-S4 observado. | `.spec/archive/20260929-harness-installer/` | Completed |

## Etapas concluídas — harness-installer
- [x] Fase 0 — Triagem (Feature, escopo A, atlas-ecm, backup+merge)
- [x] Fase 1 — Análise (PROPOSAL + SPEC 92%, architect aprovar-com-ajustes, security partial)
- [x] Fase 2 — Planejamento (PLAN + TASKS, 7 tickets)
- [x] Fase 3 — Execução (2 batches, reviews APPROVED, 0 🔴)
- [x] Fase 4 — Quality (fixtures + dogfood + secret-scan em-batch)
- [x] Fase 5 — Verify (3 dimensões ✅ + CLI-smoke suplementar, aceite 4/4)
- [x] Fase 6 — Archive
| 2026-10-08 | `harness-installer-mobile` | Feature | Instalação do harness em projetos mobile (Flutter/Dart): perfil de stack flutter/dart (config gerado, mcp marionette+dart, flutter test), vendor de 22 skills dart-*/flutter-* (BSD-3, --check), wizard TUI W0..W7 com auto-detecção de pubspec.yaml, canário R3 por escopo. 14/14 tasks, 4 batches, dogfood mobile PASS. | `.spec/archive/20261008-harness-installer-mobile/` | Completed |

## Etapas concluídas — harness-installer-mobile
- [x] Fase 0 — Triagem (Feature; forks A1 vendor + B2 wizard + C mobile)
- [x] Fase 1 — Análise (PROPOSAL + SPEC 94%, ux-designer wizard + architect A1-A5, security partial)
- [x] Fase 2 — Planejamento (PLAN + TASKS, 14 tickets, 4 batches)
- [x] Fase 3 — Execução (B1 contrato, B2 vendor, B3 wizard, B4 docs+dogfood; reviews APPROVED 0 🔴)
- [x] Fase 3.x — Side-quest FU-32 (canário denylist) fechado por redesenho por escopo
- [x] Fase 4/4.5 — Quality (104/104 + 162/162 + dogfood) + Security Verify pass
- [x] Fase 5 — Verify (3 dimensões ✅, traceability 100%)
- [x] Fase 6 — Archive
| 2026-10-11 | `installer-melhoria` | Melhoria | Instalador: menu W2m 5 itens produto→stack (sem nova key), erro padrão 4-linhas + dry-run NÃO EXECUTADO + pico-fim, `init` greenfield create-only W0–W7, `doctor` brownfield read-only D0–D6, higiene de segredos H1/M1–M4, contrato CLI init/doctor. ADRs 011–014, 20/20 tasks, suite verde (plugins 135 + installer 358). | `.spec/archive/20261011-installer-melhoria/` | Completed |

## Etapas concluídas — installer-melhoria
- [x] Fase 1 — Análise (PROPOSAL + SPEC, ADRs 011–014, Delta Specs)
- [x] Fase 2 — Planejamento (PLAN INS-01..INS-20 + TASKS BDD)
- [x] Fase 3 — Execução (20/20 Done, reviews APPROVED, security 14/14)
- [x] Fase 5 — Verify (3 dimensões ✅ PASS, coverage funcs 96.21%)
- [x] Fase 6 — Archive (deltas: SKILL §9.2/§7 MODIFIED + §10/§11 ADDED, harness-config nota, spec-developed entrada)
| 2026-10-14 | `harness-brain-separation` | Refactor | Governança harness×brain (docs, ZERO código produto): H1 vendored REMOVED→ref, H2 ponte 259→15 linhas→BRAIN.MCP.md, H3 7+2 refs stale zerados, H4 doctor 0-writes+warn-não-fail prescrito, H5 fronteira README:18/RUNTIME:68 prescrita. 15/15 Done, 5 reviews APPROVED, security PASS, suite verde 135/135+360/360. Continuação harness-installer-mobile. | `.spec/archive/20261014-harness-brain-separation/` | Completed |

## Etapas concluídas — harness-brain-separation
- [x] Fase 1 — Análise (PROPOSAL + SPEC PASS, Delta 1 REMOVED+13 MODIFIED+1 ADDED)
- [x] Fase 2 — Planejamento (PLAN + TASKS 15/15 BDD, JIRA_BOARD 15/15)
- [x] Fase 3 — Execução (H1-H5 aplicados batches 2-4, 9 alvos + follow-ups :245-246)
- [x] Fase 4 — Quality (reviews APPROVED 🔴0, security Fase3 PASS, suite verde)
- [x] Fase 5 — Verify (3 dimensões ✅ APPROVED, D-01/O-01/O-02 explícitos)
- [x] Fase 6 — Archive (mover + Completion + estado, Delta já-aplicado, installer/README/RUNTIME intocados)
| 2026-10-16 | `prd-adr-pipeline` | Feature | Esteira PRD → ADR → SDD no harness: layout `.spec/prd/**` non-cycle, 3 checks (`PRD-01`/`ADR-01`/`ADR-02`) em path propagável, fases = rótulos (PRD/RESEARCH→Discovery, ADR-INDEX/ADR→Planning), enforcement = suíte+CI (nunca deny); dogfood real com PRD aprovado e 5 ADRs decision-only. 12/12 tasks (`PAP-01`..`PAP-12`), 110/110 caixas, reviews APPROVED. Notas (1 linha): **C-1 aberto** — o schema do REPORT exige `counts`, mas a contraprova do gate nega counts não-observáveis (`gate.js:624-626` `counts-unverifiable`, fixture FU-09), logo ciclo fechado com desvio declarado no REPORT; abertos: selo não republicado (A-1, `sealed-command-mismatch` fail-closed), CI não barra push com suíte vermelha (A-2/R-4), enum de `status` do ADR-INDEX não modela "decisão realizada mas não mergeada" (D4), débito pré-existente de 4 regras citadas e ausentes em `orchestrator/AGENT.md` (A-3). | `.spec/archive/20261016-prd-adr-pipeline/` | Completed |

## Etapas concluídas — prd-adr-pipeline
- [x] Fase 1 — Análise (PROPOSAL + SPEC aprovada, ADRs 001–005, Delta Specs, dogfood `.spec/prd/prd-adr-pipeline/` real)
- [x] Fase 2 — Planejamento (PLAN + TASKS, 12 tickets `PAP-01`..`PAP-12`, 110/110 caixas)
- [x] Fase 3 — Execução (12/12 Done; loop §6.2 — iteração 1: 1 🔴 F-1 + 4 🟡 fechados; iteração 2: zero 🔴)
- [x] Fase 5 — Verify (3 dimensões ✅ APPROVED; plugins 352/0 · installer 372/0 · static-checks EXIT 0 · `sdd-checks` 8/8)
- [x] Fase 6 — Archive (move para `.spec/archive/20261016-prd-adr-pipeline/`, `current_phase: Completed`)
| 2026-10-18 | `harness-eixos-stack` | Refactor | Eixos backend/frontend separados na configuração do instalador: registry com `axes` (IDs de eixo) + `stacks` **derivado** por `stacksFor(axes)`, preset **`java+react`**, gating de artefato por **eixo** (skills via `stacks` declarado na origem; rules via `RULES_BY_AXIS`/`RULES_COMMON` validado na carga), menu `W2m` em **2 passos** (11/11 linhas byte-iguais ao ADR-004), vendor das 2 skills React com `licenseOrigin` (Apache-2.0 `upstream-file` / MIT `declared-evidence`). 14/14 tasks em 5 batches, reviews APPROVED (0 🔴), suite 831/831. Notas (1 linha): **C-1 aberto** (REPORT schema-inválido por decisão declarada — schema exige `counts`, contraprova nega counts não observados; QA provou empiricamente); **A-1** selo republicado pelo owner no fechamento; **FU-59/FU-60 (P2)** caminho default do menu repete `BAD_ANSWER` e skill local Vue entra no destino react — em `.spec/tech-debts/harness-eixos-stack-p2/`; **FU-56** 3 skills mobile fora do pin declarado (nomeadas no NOTICE); abertos: push (nada enviado), emenda de `gate.js`/schema para C-1. | `.spec/archive/20261018-harness-eixos-stack/` | Completed |

## Etapas concluídas — harness-eixos-stack
- [x] Fase 0/1 — Triagem + Análise (PICCO confirmado; 5 ADRs + ADR-INDEX; PROPOSAL + SPEC v2; REVIEW 19/19 aplicáveis; SECURITY Fase 1 partial 0 críticos; pareceres architect + ux-designer)
- [x] Fase 2 — Planejamento (PLAN EX-01..14; TASKS 14 tickets / 52 cenários BDD; JIRA_BOARD 5 batches; parecer do PM com 9 defeitos, 8 corrigidos)
- [x] Fase 3 — Execução (5 batches, 9 iterações de review no total; 2 críticos achados por mutação: guarda tautológica do D-1 e contrato de `RULES_BY_AXIS` sem validação)
- [x] Fase 4 — Quality Gate / Harness (QA independente: 831/831, dry-run 0 writes, gating nas 2 direções, transcript byte-idêntico)
- [x] Fase 5 — Verify (3 dimensões ✅ APPROVED; traceability 100%, 46/46 checkboxes)
- [x] Fase 6 — Archive (move para `.spec/archive/20261018-harness-eixos-stack/`, `current_phase: Completed`, lições no Brain)
| 2026-10-20 | `opencode-v2-only` | Refactor | Migração total do harness para o OpenCode **v2-only**: contrato de plugin medido no binário (`{id, setup}` + `setup`→`undefined`), gate migrado para `ctx.tool.hook("execute.before")`/`ctx.event.subscribe`, 41 asserções do contrato v1/dual aposentadas, merge do instalador removendo **só** o que o harness gerou (npm do usuário preservado), prosa alinhada (I5 → `permission.edit`, selo ← `HARNESS_SEAL_JSON`) e supersession do ciclo anterior. 9 tasks (`MIG-*`), 51/51 caixas, 3 reviews APPROVED, traceability 100%. Notas (1 linha): **brain_store bloqueado** (MCP exige login) — 8 lições em `workflow-state.lessons` (L-01..L-08); **A-1** `Completed` real exige `HARNESS_SEAL_JSON` no host; **F-03 (P2)** o parse de higiene casa o padrão no texto do comando; abertos: `TD-01` (atlas-ecm/taskflow com a receita do fatal), `TD-07` (`estudo/opencode.json` inválido), `TD-13` (16 rótulos `EX2-*`), `TD-14/15`. | `.spec/archive/20261020-opencode-v2-only/` | Completed |

## Etapas concluídas — opencode-v2-only
- [x] Fase 0/1 — Triagem + Análise (PROPOSAL + SPEC com o contrato MEDIDO; §0 corrigido 2×; security pela matriz de autoridade)
- [x] Fase 2 — Planejamento (PLAN + TASKS, 9 tasks `MIG-*`, 51 caixas)
- [x] Fase 3 — Execução (3 batches: plugins+testes · merge do instalador · prosa+supersession; **3 reviews**, loop de correção até zero 🔴; o Batch 3 exigiu 3 iterações + 1 autorizada pelo owner)
- [x] Fase 3.5 — Incidente RT-02 (registry global caindo): causa raiz = worktree velho + contrato de plugin; neutralizado/removido
- [x] Fase 4 — Quality Gate (suíte selada: 379/0 plugins + 516/0 installer + static 10 PASS + sdd 8 PASS + selo ok)
- [x] Fase 5 — Verify (3 dimensões ✅; traceability 100%; 51/51 caixas; 0 TODO)
- [x] Fase 6 — Archive (`.spec/archive/20261020-opencode-v2-only/` + superseded em `.spec/archive/20261015-opencode-v2-plugin-migration-superseded/`; `current_phase: Completed`; lições locais — Brain bloqueado por login)
