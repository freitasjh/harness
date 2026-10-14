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
