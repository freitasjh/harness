# Harness — enforcement duro para agentes opencode

> Prosa descreve; quem nega é `gate.js` + CI. Este repo transforma governança de
> agentes (que o modelo pode ignorar) em portões que o runtime aplica — com
> evidência verificável por máquina e honestidade declarada onde não há garantia.

## Funcionalidades

| # | O quê | Como |
|---|---|---|
| 1 | **Gates bloqueantes** — delegação sem PICCO nega; conclusão sem contraprova nega; 3º task sem turno humano nega; higiene de shell (I7) nega; escrita em path protegido nega | `tool.execute.before` + `DenyError` tipado (`.opencode/plugins/gate.js`) |
| 2 | **Evidência machine-checkable** — conclusão de fase exige `REPORT.json` válido + **re-execução** do comando canônico pelo gate (verificador ≠ executor) | contrato + selo `sha256` + cache |
| 3 | **Zero path hardcoded** — comandos, paths, portas e módulos vêm do `harness.config.json` do projeto | ADR-003; check estático acusa literal |
| 4 | **Portão de prompt** — toda demanda de mudança passa por 6 elementos (PICCO); sem eles, o orquestrador pergunta em vez de adivinhar | skill `prompt-optimizer` + gate PICCO |
| 5 | **SDD governado** — SPEC → PLAN → TASKS → execução → VERIFY → archive, com portões humanos P0..P6 e asserts executáveis | skills `sdd-compiler`, `spec-review` + checks |
| 6 | **Cobertura de risco** — mudança em `riskPaths` (auth/acl/security/i18n) sobe o E2E para `enforce` sozinha | `escalateOnRisk` |
| 7 | **Kill-switch fora do worktree** — `HARNESS_GATES=off` no processo host; config nunca desliga | ADR-009 |
| 8 | **Memória persistente** — decisões, erros e lições no Brain (busca antes, registra depois) | skill `brain` |
| 9 | **Instalador** — leva o harness a outro repo sem copiar domínio alheio (caso Hive) | `installer/` + skill `harness-installer` |

## Estrutura

```
.opencode/plugins/   → gate.js (deny) + libs + __tests__ (fixtures)
.agents/rules/       → política descritiva (nunca enforcement sozinha)
.agents/agents/      → papéis (orchestrator sem write; reviewer/code-reviewer sem write)
.agents/skills/      → playbooks (prompt-optimizer, sdd-compiler, harness-report, ...)
.agents/schemas/     → JSON schemas (REPORT, state)
installer/           → instalador repo→repo + testes
harness.config.json  → dados DESTE projeto (comandos, paths, portas, riskPaths)
scripts/             → checks estáticos (suite, sdd, integridade)
.spec/archive/       → specs concluídas (histórico imutável)
workflow-state.json  → estado do ciclo (única fonte de verdade do progresso)
```

## Como instalar em projetos

**Pré-requisitos**: Node 20+, git, opencode ≥ 1.18.31, MCP `chrome-devtools` (p/ H3).

```sh
# 1. Aponte para o destino (novo ou existente)
node installer/install.mjs --target /caminho/do/projeto

# 2. Responda o Q&A (stack, comandos, paths, portas) — tudo é validado na hora
# 3. Revise o --dry-run antes de aplicar de verdade
node installer/install.mjs --target /caminho/do/projeto --dry-run

# 4. Confira o manifesto e os checks
cat /caminho/do/projeto/.harness-install.json
```

O que o instalador faz: **backup** de tudo → gera `harness.config.json` a partir das
suas respostas (nunca copia) → merge por camada (colisão vira flag, nunca overwrite
silencioso) → escreve o **manifesto** → roda os **checks**. Re-instalação aborta com
instrução. Detalhes em `.agents/skills/harness-installer/SKILL.md`.

**Depois de instalar, no destino:**
1. `node --test` + checks verdes
2. **Restart do opencode** (plugins só carregam no boot)
3. Smoke: delegação sem PICCO nega · com PICCO permite · higiene de shell nega
4. Rollback imediato, se preciso: `HARNESS_GATES=off`

## Verificação (neste repo)

```sh
node --test ".opencode/plugins/__tests__/*.spec.mjs"  # 104 gates + dogfood
node scripts/static-checks.mjs                        # V2/V3/V6/V7 (V14 exige remote+CI)
node scripts/sdd-checks.mjs                           # V4/R-V12/V17/SDD/R-NODENY/RENAME
node --test "installer/__tests__/*.spec.mjs"          # 51 installer
```

## Histórico

Specs concluídas em `.spec/archive/` (imutável) e `spec-developed.md`.
Sessões e lições no Brain (`sessoes/harness/*`, `regras/global/*`).
