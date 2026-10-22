# Harness — enforcement duro para agentes opencode

> Prosa descreve; quem nega é `gate.js` + CI. Este repo transforma governança de
> agentes (que o modelo pode ignorar) em portões que o runtime aplica — com
> evidência verificável por máquina e honestidade declarada onde não há garantia.

## Funcionalidades

| # | O quê | Como |
|---|---|---|
| 1 | **Gates bloqueantes** — delegação sem PICCO nega; conclusão sem contraprova nega; 3º task sem turno humano nega; higiene de shell (I7) nega; escrita em path protegido nega | hook v2 `ctx.tool.hook("execute.before", …)` + `DenyError` tipado (`.opencode/plugins/gate.js`) |
| 2 | **Evidência machine-checkable** — conclusão de fase exige `REPORT.json` válido + **re-execução** do comando canônico pelo gate (verificador ≠ executor) | contrato + selo `sha256` + cache |
| 3 | **Zero path hardcoded** — comandos, paths, portas e módulos vêm do `harness.config.json` do projeto | ADR-003; check estático acusa literal |
| 4 | **Portão de prompt** — toda demanda de mudança passa por 6 elementos (PICCO); sem eles, o orquestrador pergunta em vez de adivinhar | skill `prompt-optimizer` + gate PICCO |
| 5 | **SDD governado** — SPEC → PLAN → TASKS → execução → VERIFY → archive, com portões humanos P0..P6 e asserts executáveis | skills `sdd-compiler`, `spec-review` + checks |
| 6 | **Cobertura de risco** — mudança em `riskPaths` (auth/acl/security/i18n) está declarada para subir o E2E a `enforce` (declarativo: sem consumidor no runtime — ver `docs/FUNCIONAMENTO.md` §10a2) | `escalateOnRisk` |
| 7 | **Kill-switch fora do worktree** — `HARNESS_GATES=off` no processo host corta a suíte; o config nunca desliga a suíte **nem** rebaixa um gate — o rebaixamento por gate vive no env (`HARNESS_GATE_<GATE>` + `_REASON` obrigatório, `gate.js:98`) e todo `gates.*` com valor ≠ `"enforce"` é auditado (`gate.js:252`) | ADR-009 · 🟢 runtime |
| 8 | **Memória persistente** — decisões, erros e lições no Brain (busca antes, registra depois) | skill `brain` |
| 9 | **Instalador** — leva o harness a outro repo sem copiar domínio alheio (caso Hive) | `installer/` + skill `harness-installer` |
| 10 | **Esteira PRD→ADR→SDD** — intenção de negócio aprovada **antes** do design; 1 ADR = 1 branch = 1 ciclo SDD; checks entram no `suiteFull`, sem deny novo no runtime | `.spec/prd/**` (bucket non-cycle) + `.agents/rules/prd-adr-pipeline.md` + `PRD-01`/`ADR-01`/`ADR-02` |

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

**Pré-requisitos**: Node 20+, git, opencode **v2** (contrato medido em v2.0.32 — este repo é v2-only), MCP `chrome-devtools` (p/ H3).
Projetos **mobile (Flutter/Dart)** declaram `marionette_mcp` + `dart` (perfil gerado).

```sh
# 1. Aponte para o destino (novo ou existente)
node installer/install.mjs --target /caminho/do/projeto

# 2. Responda o Q&A (stack, comandos, paths) — tudo é validado na hora
#    (infra `composeFile`/`ports` não entra no Q&A: N/A justificado — §4 da
#    skill harness-installer; edite o bloco `infra` no destino pós-install)
# 3. Revise o --dry-run antes de aplicar de verdade
node installer/install.mjs --target /caminho/do/projeto --dry-run

# 4. Confira o manifesto e os checks
cat /caminho/do/projeto/.harness-install.json
```

Para **Flutter/Dart**: `stack=flutter|dart` exige `pubspec.yaml` no destino; o
perfil gera `commands { suiteFull: 'flutter test', unit, analyze: 'dart analyze' }`
e `mcp.required ['marionette_mcp','dart']` (flutter) / `['dart']` (dart). Sem TTY
o CLI aborta com instrução; com TTY entra no **wizard W0..W7** (detecção de
`pubspec.yaml` + confirmação por camada). Detalhes em
`.agents/skills/harness-installer/SKILL.md` §9.

### Stack do destino — escolhida por EIXO (instalador)

A configuração por destino é escolhida por **eixo**: `backend` e `frontend` são campos
independentes no registry de perfis do instalador (`STACK_PROFILES` / `AXIS_IDS` em
`installer/install.mjs`), e `stacks` (o que o destino aceita de skills/rules) **deriva** do eixo
via `stacksFor(axes)` — nunca do nome do arquivo. Presets atuais (7): `node`, `node-esm`,
`java+vue`, `java+react`, `outra`, `flutter`, `dart`. Hoje o backend disponível é **java** e o
frontend oferecido é **vue** (padrão) ou **react** (menu `W2m` em 2 passos, ADR-004). Perfis de
backend adicionais (**go**, **rust**) estão previstos e têm rota documentada (`ADR-005` do ciclo
`harness-eixos-stack`, em `.spec/backend/harness-eixos-stack/`).

Teste em cópia (nunca no repo real):

```sh
node installer/dogfood.mjs --source /caminho/do/repo            # stack genérica
node installer/dogfood-mobile.mjs --source /caminho/projeto-flutter  # Flutter/Dart
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
node --test ".opencode/plugins/__tests__/*.spec.mjs"  # gates + dogfood
node scripts/static-checks.mjs                        # V2/V3/V6/V6b/V7/V12/V14/V15 + PRD-01/ADR-01/ADR-02 (V14 exige remote+CI)
node scripts/sdd-checks.mjs                           # V4/R-V12/V17/SDD/R-NODENY/RENAME
node --test "installer/__tests__/*.spec.mjs"          # installer (golden/mobile/wizard/vendor/dogfood/docs)
```

## Histórico

Specs concluídas em `.spec/archive/` (imutável) e `spec-developed.md`.
Sessões e lições no Brain (`sessoes/harness/*`, `regras/global/*`).
