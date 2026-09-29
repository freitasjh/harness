# Implementation Plan — harness-v7-hardening

## 1. Context & SPEC Traceability
- **Target Specification**: `.spec/governance/harness-v7/SPEC.md` (v4, 735 linhas)
- **Runtime Contract**: `.spec/governance/harness-v7/RUNTIME-CONTRACT.md`
- **Goal**: traduzir o SPEC em plano executável, determinístico e consciente de risco,
  respeitando a ordem de dependência `config → schema → gate(warn) → enforce → rules diet`.

### 1.1 SPEC Validation Report
- **Status**: `Validated with named residuals` — 0 críticos abertos; 4 revalidações do
  architect consumidas (v2 REPROVAR → v3 REPROVAR → v4 com correções aplicadas).
- **Gaps/Warnings conhecidos**:
  - I9 (path protegido) é 🔴 por runtime; coberto por CI **após** o passo 0 (INF-01/INF-02).
  - I2/I6/I7 são 🟠 parciais — declarados como parciais, não como garantidos.
  - I4 é 🟡 de processo (auditoria), não de runtime.
  - Contraprova = consistência, não cobertura; cobertura de risco = `escalateOnRisk`.
- **Assumptions**:
  - A1: alvo = CLI 1.18.31 **e** Desktop (U8=c). Todo mecanismo que depende de shape de
    args ganha fixture que asserta o shape nos dois (N13).
  - A2: `tool.execute.before` propaga `throw` sem `catch` no dispatcher (verificado no
    binário). `DenyError` é o único sinal de deny.
  - A3: não existe `permission.ask` nem evento de bus `tool.execute.after` (contrato H1/H3).
  - A4: o repo ganha `git` + remote + CI no passo 0 (U4=a). Sem isso, INF-02 e tudo que
    depende de CI fica vermelho — e o PLAN marca.

## 2. Technical Strategy
### 2.1 Plugin Strategy (`.opencode/plugins/`)
- **Runtime**: Node ESM, função pura por hook + `DenyError` tipado. Sem MCP, sem rede.
- **Padrão**: cada gate = função `(tool, args, ctx) => 'allow' | throw DenyError`,
  com `ctx` = `{mode, killSwitch, config, sessionAgent}`. Modo `warn`/`enforce` por
  `harness.config.json` (informativo) — desligamento real só por `HARNESS_GATES=off`.
- **Testes**: `.opencode/plugins/__tests__/gate.spec.mjs` — fixtures §7.3 como casos,
  `node --test` puro, sem dependência externa.

### 2.2 Config & Schema Strategy
- `harness.config.json` (JSONC-friendly, validado por script) + `.agents/schemas/`
  para `harness-report.schema.json`. Selo de comando = `sha256` guardado no `gate.js`
  e verificado contra o valor lido do config.
- `riskPaths` + `escalateOnRisk`: mudança que toca superfície de risco sobe gates
  de `warn` para `enforce` automaticamente.

### 2.3 CI Strategy
- Job de integridade: reverte/falha commit que altere path protegido sem trailer
  `Harness-Gate-Change: <aprovador>`. Pre-commit local espelha a checagem.
- `workflow-state.json` **fora** da proteção (churn por fase; integridade pelo gate).

### 2.4 Rules Strategy
- Fusão `workflow-rules.md` + `harness-continuous.md` com mapa de back-references;
  unificação do vocabulário de fase (canônico = `sdd-workflow-standard.md`);
  remoção da re-injeção dos plugins (inclui corrigir o shape G14).

## 3. Architecture Realization & Constraint Mapping
| SPEC Ref | Constraint | Enforcement Point | Failure Mode | Implementation Strategy |
|---|---|---|---|---|
| ADR-001/006 | todo deny é `throw DenyError`; erro comum não nega | `tool.execute.before` | gate morto silencioso / plugin trava dev | classe `DenyError` + contrato de `catch` + fixtures `deny-throws`/`plugin-throws` |
| ADR-002 | REPORT.json auto-declarado; prova = re-execução + selo | conclusão de fase | spoofing da evidência | `gate.js` re-executa comando selado; compara exit+counts; timeout ⇒ deny |
| ADR-003 | zero path hardcoded | estático (CI) | H3 pulado em silêncio no consumidor | `harness.config.json`; V3 grep ⇒ 0 |
| ADR-004 | PICCO exato (tag obrigatória; vazia=válido) | `tool.execute.before('task')` | falso positivo / previsão | parser da tag + fixtures `picco-*` |
| ADR-007 | path protegido sem garantia de runtime | CI + pre-commit | agente reescreve o gate | trailer + revert; passo 0 antes |
| ADR-008 | conclusão por 2 âncoras (A escrita estruturada, B próximo task) | `before(write/edit/patch)` + `before(task)` | declara-em-prosa-e-para (N15: fora do runtime — regra de processo) | allowlist `.spec/**`+state; B exige `Completed`+status do ciclo anterior |
| ADR-009 | kill-switch fora do worktree | env do processo host | attack switch | `HARNESS_GATES=off`; `gates.*` do config não desliga |
| ADR-010 | ordem config→schema→gate(warn)→enforce | rollout §16 | gate nega a própria obra | passo 0 `git init` primeiro |
| I6 | batch ≠ loop de correção | `hitl-guardrail.js` | pausa no fluxo obrigatório | exceção `developer→reviewer` (2 calls); 3º `task` sem turno ⇒ deny |
| I7/I9 | higiene de shell + escrita protegida | parse (evadível) + CI | evasão por `bash -c`/`python -c` | medir evasão (fixture negativo), não afirmar fechamento |
| I10/I11 | log sem segredo; mapa session→agente | scrub + `chat.params` | vazamento / regra por agente sem sujeito | `chat.params.agent` |

## 4. Module & Code Structure
| Module | Responsibilities | Boundaries |
|---|---|---|
| `.opencode/plugins/gate.js` | DenyError, dispatcher por tool, gates I1/I2/I6/I7/I9, modos, kill-switch | não lê prosa; só `args` + state + config |
| `.opencode/plugins/harness-validator.js` | contraprova de REPORT.json, alimenta `commands[]` via `after(bash)` | sem re-injeção de regra; shape `{system:string[]}` corrigido |
| `.opencode/plugins/hitl-guardrail.js` | pausa entre batches + exceção do loop | sem re-injeção; usa `session.next.tool.*` |
| `.opencode/plugins/__tests__/` | fixtures §7.3 como testes executáveis | sem MCP/rede |
| `harness.config.json` | dados do projeto: comandos, paths, portas, riskPaths, modos | nunca autoritativo p/ desligar |
| `.agents/schemas/` | JSON schemas (report) | protegido (CI) |
| `.agents/rules/` | política descritiva + gate-contract + harness-config | protegido (CI); sem duplicar enforcement |
| `.agents/skills/harness-report/` | contrato de evidência p/ subagentes | doc, não gate |

## 5. Risks & Complexity Analysis
- **🔥 CRITICAL: gate nega a própria obra (bootstrap)** — Mitigação: ADR-010; warn antes de enforce; humano no 1º lote.
- **🔥 CRITICAL: selo auto-referente** — Mitigação: raiz de confiança = CI+remote (passo 0), não o worktree.
- **HIGH: falso positivo do PICCO no prompt legado** — Mitigação: contrato ADR-004 + fixture com a forma real de delegação do repo.
- **HIGH: re-execução bloqueia o tool call (timeout)** — Mitigação: cache `(demand, reportHash, treeHash)` + timeout nomeado + deny `contraprove-timeout`.
- **MED: Desktop vs CLI divergem em shape de args** — Mitigação: fixtures por alvo (U8=c).
- **MED: dieta de rules remove conteúdo necessário** — Mitigação: mapa de back-refs + review obrigatório.

## 6. Implementation Phases & Dependencies
### Phase 0: Repo bootstrap (INF)
- **Dependencies**: decisão U4=a (ok). **Scope**: `git init` + remote + CI + pre-commit.
### Phase 1: Config & schema (CFG)
- **Dependencies**: Phase 0. **Scope**: `harness.config.json` + `harness-report.schema.json` + selo.
### Phase 2: Gate em warn (GATE)
- **Dependencies**: Phase 1. **Scope**: `gate.js` + fixtures + modo warn + correções nos 2 plugins atuais.
### Phase 3: Enforce (ENF)
- **Dependencies**: Phase 2 (fixtures verdes). **Scope**: flip para enforce + kill-switch + timeout.
### Phase 4: Rules diet + SDD + rename (DOC)
- **Dependencies**: Phase 3. **Scope**: fusão das rules, back-refs, vocabulário, AGENT.md,
  skills, alinhamento SDD (SDD-01/02/03), rename do reviewer.
- **Batches**: 6 = EV-01, DOC-01, DOC-03 (docs independentes);
  7 = DOC-02, SDD-01, SDD-02, SDD-03, RENAME (interdependentes — 1 review cobre cross-refs);
  8 = DOG-01 (era 7; += deps SDD-02, SDD-03, RENAME).
### Phase 5: Dogfood (DOG)
- **Dependencies**: Phase 3+4. **Scope**: reproduzir o caso ACL; risk-path E2E; regressão.

## 7. Critical Execution Path
`INF-01` → `CFG-01` → `CFG-02` → `GATE-01` → `GATE-03` → `TST-01` → `DOG-01`

## 8. Atomic Task Breakdown & Execution Graph
### INF — Phase 0
- **[INF-01]** [ ] `git init` + remote + CI de integridade (passo 0)
  - **Depends on**: None · **Layer**: Infra · **Artifact**: `.git`, remote, `.github/workflows/harness-integrity.yml`, `.githooks/pre-commit`
  - **Enforcement**: commit em path protegido sem trailer ⇒ CI falha · **Constraint Ref**: ADR-007/ADR-010
- **[INF-02]** [ ] Pre-commit local espelhando o CI
  - **Depends on**: INF-01 · **Layer**: Infra · **Artifact**: `.githooks/pre-commit`
  - **Enforcement**: mesma regra do CI, local · **Constraint Ref**: ADR-007
### CFG — Phase 1
- **[CFG-01]** [ ] `harness.config.json` do repo + doc do schema de config
  - **Depends on**: INF-01 · **Layer**: Infra · **Artifact**: `harness.config.json`, `.agents/rules/harness-config.md`
  - **Enforcement**: ausente ⇒ fail-closed com mensagem · **Constraint Ref**: RF-01/RF-02
- **[CFG-02]** [ ] `harness-report.schema.json` + selo de comando
  - **Depends on**: CFG-01 · **Layer**: Infra · **Artifact**: `.agents/schemas/harness-report.schema.json`
  - **Enforcement**: REPORT inválido ⇒ deny · **Constraint Ref**: ADR-002
### GATE — Phase 2
- **[GATE-01]** [ ] `gate.js` núcleo: DenyError, dispatcher, modos, kill-switch env
  - **Depends on**: CFG-01 · **Layer**: Infra · **Artifact**: `.opencode/plugins/gate.js`
  - **Enforcement**: erro comum ⇒ allow+log; DenyError ⇒ deny · **Constraint Ref**: ADR-001/006/009
- **[GATE-02]** [ ] Gate PICCO (I1, contrato ADR-004)
  - **Depends on**: GATE-01 · **Layer**: Infra · **Artifact**: gate PICCO em `gate.js`
  - **Enforcement**: tag ausente/não-vazia ⇒ deny · **Constraint Ref**: ADR-004
- **[GATE-03]** [ ] Gate de conclusão (âncoras A+B, contraprova, selo)
  - **Depends on**: GATE-01, CFG-02 · **Layer**: Infra · **Artifact**: âncora A (path-check) + âncora B (state do ciclo anterior) + re-execução
  - **Enforcement**: `Completed` sem contraprova ⇒ deny; próximo task sem `Completed` anterior ⇒ deny · **Constraint Ref**: ADR-002/ADR-008
- **[GATE-04]** [ ] Pausa HITL entre batches + exceção do loop (I6)
  - **Depends on**: GATE-01 · **Layer**: Infra · **Artifact**: `hitl-guardrail.js` bloqueante
  - **Enforcement**: 3º task sem turno ⇒ deny · **Constraint Ref**: I6
- **[GATE-05]** [ ] Higiene: `pkill -f`, path protegido (parse), escopo do qa-engineer
  - **Depends on**: GATE-01 · **Layer**: Infra · **Artifact**: gates I7/I9 (parse) + RF-06
  - **Enforcement**: parse (evadível) + CI; medir evasão · **Constraint Ref**: I7/I9
- **[FIX-01]** [ ] Corrigir os 2 plugins atuais (shape G14, handler morto N7, remover re-injeção)
  - **Depends on**: GATE-01 · **Layer**: Infra · **Artifact**: `harness-validator.js`, `hitl-guardrail.js`
  - **Enforcement**: shape `{system:string[]}`; sem `tool.execute.after` · **Constraint Ref**: contrato §6
### EV/DOC — Phase 4 (documentam os gates; entram após enforce)
- **[EV-01]** [ ] Skill `harness-report` (contrato de evidência p/ subagentes)
  - **Depends on**: CFG-02 · **Layer**: Interface · **Artifact**: `.agents/skills/harness-report/SKILL.md`
- **[DOC-01]** [ ] Regra `gate-contract.md` (prosa vs hook)
  - **Depends on**: GATE-01 · **Layer**: Interface · **Artifact**: `.agents/rules/gate-contract.md`
- **[DOC-02]** [ ] Dieta de rules: fusão + back-refs + vocabulário único (G10/G11)
  - **Depends on**: GATE-01 · **Layer**: Interface · **Artifact**: `workflow-rules.md` fundido
  - **Enforcement**: V4 (≤55% linhas) + V12 (0 órfãs) · **Constraint Ref**: G10/G11
- **[DOC-03]** [ ] AGENT.md: orchestrator/developer/qa/reviewer + `mcp.required`
  - **Depends on**: GATE-02, GATE-03 · **Layer**: Interface · **Artifact**: 4 AGENT.md/PROMPT
### TST/DOG — Phase 3+5
- **[TST-01]** [ ] Suite de fixtures §7.3 (+ v4: allowlist, selo, âncoras, evasão medida)
  - **Depends on**: GATE-02, GATE-03, GATE-04, GATE-05 · **Layer**: Test
  - **Enforcement**: 23/23 em warn e enforce, nos 2 alvos · **Constraint Ref**: §7.3
- **[TST-02]** [ ] Checks estáticos (V2/V3/V7/V12/V14, `permission-ask-absent`)
  - **Depends on**: CFG-01 · **Layer**: Test
- **[DOG-01]** [ ] Dogfood: reproduzir o caso ACL + `riskPaths` E2E + regressão do consumidor
  - **Depends on**: TST-01, DOC-02 · **Layer**: Test
  - **Enforcement**: V5 (nega `Completed`) + V11 · **Constraint Ref**: §14

### Phase 4 — SDD & rename (Batch 7)
- **[SDD-01]** [ ] Alinhar `sdd-orquestrador/AGENT.md` ao harness
  - **Depends on**: DOC-02 · **Layer**: Interface · **Artifact**: `.agents/agents/sdd-orquestrador/AGENT.md`
  - **Enforcement**: cláusula de não-bypass (PICCO/contraprova valem p/ qualquer orquestrador) · **Constraint Ref**: U10
- **[SDD-02]** [ ] Asserts do `sdd-compiler` como checks executáveis
  - **Depends on**: DOC-02, TST-02 · **Layer**: Test · **Artifact**: checks SDD + wiring no CI
  - **Enforcement**: dogfood no `.spec` deste repo · **Constraint Ref**: U10
- **[SDD-03]** [ ] Auditabilidade das transições de fase (sem deny novo)
  - **Depends on**: DOC-02, SDD-02 · **Layer**: Interface · **Artifact**: convenção `gates:{}` + check artefato↔gate
  - **Enforcement**: check (não gate) · **Constraint Ref**: U10
- **[RENAME]** [ ] `fullstack-code-reviewer` → `code-reviewer`
  - **Depends on**: DOC-03, GATE-04 · **Layer**: Infra · **Artifact**: `opencode.json`, dir, `gate.js:407`, testes, docs/rules
  - **Enforcement**: grep nome antigo em paths vivos ⇒ 0; suite verde · **Constraint Ref**: U11

## 9. Event Implementation Mapping
N/A justificado — sem eventos de domínio. Equivalente funcional: **Hook Registry**
(SPEC §6), cujos "produtores/consumidores" são os hooks confirmados no contrato
(RUNTIME-CONTRACT §2). Cada linha do contrato com uso em design tem fixture em TST-01.

## 10. Execution Readiness Checklist
- [x] Todas as tasks têm dependências válidas (grafo em TASKS.md §3, sem ciclos).
- [x] Infra bootstrap primeiro (Phase 0 = passo 0; sem ele, I9 fica 🔴 declarado).
- [x] Testing tasks explícitas para constraints críticas (TST-01/TST-02/DOG-01).
- [x] Failure-mode testing incluído (DenyError vs erro; timeout; evasão medida).
- [x] Critical path mapeia só o fluxo núcleo (7 tasks).
