# Implementation Plan: Migração Plugins Opencode v1 → v2 (dual-export)

> **ID**: `opencode-v2-plugin-migration`
> **Status**: `PLAN`
> **Author**: product-manager (subagent, modo generate-plan)
> **Date**: 2026-10-15
> **Revisão**: 2026-10-15 — gaps 1–5 incorporados como exit criteria/testes verificáveis (gap 1→Fase 1, gap 2→Fase 0/PL-01, gap 3→§1.1.1, gap 4→Fase 4/PL-07/§3 SEC, gap 5→§1.2 Delta); sem mudança de semântica, sem TASKS novas, sem edição de runtime.
> **Source**: `.spec/backend/opencode-v2-plugin-migration/SPEC.md` (aprovada — SPEC 11/11 + security pass) + `PROPOSAL.md` (PASS 13/13)
> **Type**: refactor — PLAN apenas, sem TASKS/implementação, sem edição de runtime nesta fase
> **Scope**: adapter dual em 3 plugins + config dual + matriz de verificação

---

## 1. Context & SPEC Traceability

- **Target Specification**: `.spec/backend/opencode-v2-plugin-migration/SPEC.md`
- **Goal**: Ordenar a migração dual v1+v2 sem mudar semântica de deny. `server` v1 intacto + `setup(ctx)` v2 fino sobre os mesmos núcleos puros. Valor: gates GATE-01..GATE-05 vivos em runtime v2. Risco se não fizer: silêncio — gates deixam de carregar sem log de deny.

### 1.1 SPEC Validation Report

- **Status**: Strictly Validated (SPEC 11/11 + security-review Fase 1 `pass`, 0 🔴; 🟠 H-elevate + 🟡 I-disclosure com mitigação e teste prescrito em SPEC §11).
- **Identified Gaps/Warnings**:
  - Nomes exatos das APIs v2 (`ctx.tool.hook` / `ctx.session.hook` / `ctx.event.subscribe`, chave `shell` vs `bash`, `agents.*.system`) dependem do RUNTIME-CONTRACT §2 + doc `migrate-v1` — SPEC §5 já prescreve regra de ouro (hook sem equivalente confirmado ⇒ erro visível, nunca silêncio). Nenhum gap bloqueador.
  - Sem eventos de negócio, sem multi-tenant, sem DB — asserts de tenant/eventos do plan-gate são N/A justificado (§9).
- **Assumptions Made**:
  - A1: `Plugin.define({ id, setup(ctx) })` disponível desde 1.18.29+, alvo 1.18.30 (SPEC ADR-001). Se runtime v2 exigir shape distinto, o adapter ajusta só o registro, nunca os núcleos.
  - A2: Baseline imutável: `.opencode/plugins/gate.js` 933 linhas, entry `:933`; núcleos `decide :156`, `gatePiccoTask :323`, `gateCompletionAnchorA :592`, `gatePhaseAnchorB :682`, `gateHitlBatch :755`, `gateShellHygiene :813`; loader `:215-237`; mapa `:237-257`; dispatcher `:854-919`. Qualquer diff fora de registro = defeito.
  - A3: Config dual transitória — remoção das chaves v1 é fora de escopo (SPEC futuro).

### 1.1.1 Nota de fonte — RUNTIME-CONTRACT (gap SPEC, reconstruído)

- **Gap**: `RUNTIME-CONTRACT` (nomes v2 §2 + regras §1.1/§10 item 2) **ausente no repo** — nenhuma cópia canônica encontrada.
- **Fonte reconstruída adotada neste PLAN**: `gate.js:22-24` (proibição `ask` / inexistência `permission.ask`) + `gate.js:854-919` (`runGates`/`noteChatParams`/`resetHitlTracker` = comportamento observável v1 a preservar) + `gate-contract.md` (contrato de deny/allow). Toda confirmação de nome v2 (gap 1) deve ser validada contra essas três fontes + doc oficial `migrate-v1`; divergência ⇒ hook tratado como sem-equivalente (erro visível, nunca silêncio).
- **Ação futura (fora deste PLAN)**: materializar `RUNTIME-CONTRACT.md` na fase `archive`/SPEC-follow-up; este PLAN não o cria, apenas declara a fonte substituta.

### 1.2 Traceability 1:1 (SPEC → PLAN)

| SPEC Req | Descrição | Coberto em |
|---|---|---|
| RF-01 (SPEC §8) | Adapter dual em `gate.js` (`server` + `setup`) | Fase 1 (PL-02, PL-03) |
| RF-02 | Dual-export satélites no-op | Fase 2 (PL-04) |
| RF-03 | Config dual `opencode.json` C1–C3 | Fase 3 (PL-05, PL-06) |
| RF-04 | Smoke dual v1/v2 + suíte verde | Fase 0 (PL-01 baseline) + Fase 4 (PL-07, PL-08) |
| RF-05 | Proibições H1/H2/H3/H5 + núcleos intactos | Todas as fases; greps PL-08; constraint mapping §3 |
| INV-01..INV-08 (SPEC §7) | Dual-export, paridade, fail-open, kill-switch, núcleos, no-ops, hooks proibidos, loader parity | §3 + Fases 0–4, cada INV com comando verificável |
| ADR-001..ADR-004 | Dual-export, adapter fino, config dual, fail-open/kill-switch | §3 |
| H1–H6 (SPEC §5) | Mapeamento hooks v1→v2 + shims §5.1 | Fase 1 (PL-02/PL-03) + §9 |
| C1–C4 (SPEC §4) | Tabela config v1→v2 + precedência | Fase 3 (PL-05/PL-06) |
| Delta §13 | `workflow-rules.md`, `gate-contract.md`, `AGENTS.md` ausente (vigente: `spec-developed.md`) | Fora deste PLAN (fase `archive`, não implementação). **Nota Delta (gap 5)**: `AGENTS.md` não existe no repo; este PLAN não cria/atualiza docs — eventual `AGENTS.md` ou ajuste em `spec-developed.md` é `archive`-only. Nenhuma fase abaixo toca docs. |

---

## 2. Technical Strategy

### 2.1 Backend Strategy (plugin runtime JS ESM, host-local)

- **Framework**: Node ESM, sem build. Padrão: núcleos puros (domínio: `decide`, `gate*`, `CORE_GATES`, `loadConfigOrDeny`/`ensureConfig`) + adapters finos (`server(HarnessGate)` v1, `setup(ctx)` v2). Adapter só traduz envelope `{tool,sessionID,callID,args}` v1 ↔ payload v2 (shims SPEC §5.1: `runGatesShim`, `noteChatParamsShim`, `humanBoundaryShim` + normalização `extractPromptText :284`, `extractWriteTargets :411`, `extractBashCommand :775`, `normalizePath`/`matchGlob :341-351`).
- **Architectural Pattern**: Adapter fino sobre núcleo puro (ADR-002). Zero lógica de deny no adapter. Só `throw new DenyError` (`gate.js:61`) nega; resto → allow + log (ADR-004/ADR-006 fail-open).

### 2.2 Frontend Strategy

- N/A — sem UI, sem stores. Nenhum componente tocado (SPEC Out of Scope: sem `src/` backend/frontend).

### 2.3 Infrastructure Strategy

- **Deployment Model**: Nenhum deploy — arquivos locais versionados em git. Rollback = `git revert` + kill-switch runtime `HARNESS_GATES=off` (ADR-009). Config dual mantém chaves v1 presentes para fallback.
- **CI/CD**: `node scripts/static-checks.mjs` + suite `harness.config.json` + CI `harness-integrity.yml` (inalterados); suíte `node --test ".opencode/plugins/__tests__/*.spec.mjs"` como gate verde obrigatório antes e depois.

---

## 3. Architecture Realization & Constraint Mapping

| SPEC Reference | Constraint | Enforcement Point | Failure Mode | Implementation Strategy (fase) |
|---|---|---|---|---|
| ADR-001 / INV-01 / RF-01 | Dual-export: manter `{id,server}` + adicionar `setup` via `Plugin.define`; nunca remover v1 | Registro dos 3 plugins | Remover `server` quebra v1; faltar `setup` = silêncio em v2 | Fase 1+2: adicionar `setup` ao lado de `server`; verificar `grep "server:"` = 3 e `grep "setup"` ≥ 3; smoke load v1+v2 |
| ADR-002 / INV-02,INV-05 / RF-01,RF-05 | Adapter fino; núcleos byte-idênticos; paridade deny/allow | `HarnessGate :854-919`, `decide :156`, `gate* :323/:592/:682/:755/:813`, `CORE_GATES :176-187` | Núcleo alterado ⇒ regressão deny/fail-open; divergência v1×v2 = defeito bloqueador | Fase 1: shims §5.1 chamam mesmo loop `decide`; diff de funções puras vazio; matriz ≥1 deny + ≥1 allow por entry |
| ADR-003 / INV-08 / RF-03 / C1–C3 | Config dual `opencode.json:3,7-9,10-92`; v2 vence, v1 fallback; remoção v1 fora de escopo | Loader `loadConfigOrDeny :215` / `ensureConfig :225` + `opencode.json` | Chave nova ignorada pelo runtime antigo (ou vice-versa) ⇒ config não lida | Fase 3: manter `plugin`+`plugins`, `permission.task`+`permissions.subagent/shell`, `agent.*.prompt`+`agents.*.system`; teste loader parity nos dois shapes |
| ADR-004 / INV-03 / RF-05 | Fail-open: só `DenyError` nega; erro genérico ⇒ allow + log `error` | `decide :156`, `toLogger :838-852` | `catch` novo convertendo erro genérico em deny = mudança de política | Todas: nenhum `catch` novo no adapter; fixture `Error` genérico ⇒ allow nos dois entries |
| ADR-004 / INV-04 / KILL | Kill-switch só `HARNESS_GATES=off` (`gate.js:54-55,70`); `gates.*` nunca desliga | `isKillSwitchOff :70` | Kill via config gravável por `bash` = EoP | Todas: `HARNESS_GATES=off` ⇒ allow; `gates.*=off` ⇒ ainda deny |
| SPEC §5 H1 / INV-07 / RF-05 | Nunca registrar `ask` (`permission.ask` não existe) | `gate.js:22-24` + adapter | Registrar H1 = defeito bloqueador | Fase 1+4: grep negativo `ask` + smoke asserta ausência |
| SPEC §5 H2 / INV-07 | Nunca scalar system-transform / re-injetar prosa (G14/N5) | `harness-validator.js:1-14`, `hitl-guardrail.js:1-14` | Re-injeção = no-op divergente | Fase 2+4: grep negativo + no-ops sem `DenyError` |
| SPEC §5 H3 / INV-07 | Nunca filtrar evento de bus inexistente; `event.subscribe` só em nome confirmado | RUNTIME-CONTRACT §2 | Handler morto, silêncio | Fase 1+4: grep negativo + smoke por gate registrado |
| SPEC §5 H4 (🟠) / I7,I9 | `permission.bash` casa comando, não alvo; garantia parcial + backstop CI | `gateShellHygiene :813`, `SHELL_TOOLS`, `isPkillF`, `bashProtectedWrites` | Alegar garantia 🟢 = defeito | Fase 4: matriz `pkill -f` deny + redirect protegido; declarar 🟠 |
| SPEC §5 H5,H6 / INV-06 | Prosa não é negada; deny primitivo = `throw` em `before`; dois shapes de `write`; mapa via `chat.params`; fronteira via `chat.message` | `runGates :854-901`, `noteChatParams :907/:253`, `resetHitlTracker :910-919/:750`, `sessionAgentMap :237-250` | Hook fora do §2 = defeito | Fase 1: `ctx.tool.hook(_,"before",runGatesShim)` + `ctx.session.hook` equivalentes; hook sem equivalente ⇒ erro visível (gap 1: só registra nome confirmado §1.1.1/`migrate-v1`) |
| SPEC §11 SEC | Sem segredo em log (scrub I10); sem rede nova; sem nova permissão (C4 inalterada) | `DenyError.details`, shims (`runGatesShim` nunca loga `args` brutos) | Vazamento de path absoluto/segredo em `details` (anomalia 🟡 I10) | Fase 4 (gap 4): caso "deny não vaza segredo" (só `reason` + metadados) |

---

## 4. Module & Code Structure

| Module Name | Responsibilities | Boundaries & Communication |
|---|---|---|
| `.opencode/plugins/gate.js` (núcleo, invariante) | `decide`, `gatePiccoTask`, `gateCompletionAnchorA/B`, `gateHitlBatch`, `gateShellHygiene`, `HarnessGate`, `CORE_GATES`, loader, mapa sessão→agente, HITL tracker, `toLogger` | Não recebe lógica nova; só é chamado pelos adapters |
| `.opencode/plugins/gate.js` (adapter dual, único delta) | Manter `server` v1 (`:933`, `:854-919`) + adicionar `setup(ctx)` v2 (`ctx.tool.hook`/`ctx.session.hook`/`ctx.event.subscribe`) + shims §5.1 | Adapter → núcleos (unidirecional); nunca núcleos → adapter; sem I/O novo |
| `.opencode/plugins/harness-validator.js` + `hitl-guardrail.js` (no-ops) | Dual-export sem enforcement | Nunca `DenyError`; nunca hook de deny |
| `opencode.json` (config dual) | Chaves C1–C3 duais; C4 inalterada | Lida por loader; v2 vence, v1 fallback |
| `.opencode/plugins/__tests__/*.spec.mjs` + matriz smoke (verificação) | `gate.spec.mjs`, `config-loader.spec.mjs`, `seal.spec.mjs`, `dogfood.spec.mjs`, `sdd-checks.spec.mjs`, `report-schema.spec.mjs` + matriz v1×v2 + loader parity + greps | Só leem; nunca alteram semântica |

---

## 5. Risks & Complexity Analysis

| Risco (PROPOSAL §6 / SPEC §11) | P×I | Mitigação neste PLAN | Fase |
|---|---|---|---|
| Gate ausente em v2 ⇒ allow silencioso (EoP, 🟠 High) | M×A | Regra de ouro + smoke v2 asserta cada gate registrado (RF-04/INV-07) | Fase 4 |
| Remover `server` sem dual-export quebra v1 | B×A | Constraint dual + `grep server` = 3 + load v1 1.18.30 | Fase 1+2 |
| Hook v1 sem equivalente v2 (H1–H6) | M×A | Mapeamento só a confirmados §2; hook sem equivalente ⇒ erro visível | Fase 1 |
| Config dual divergente (C1–C3) | M×M | Precedência v2-vence + loader parity INV-08 + lint de paridade | Fase 3 |
| Núcleo alterado por acidente | B×A | Diff de puras vazio + suíte verde obrigatória (INV-05) | Fase 0+4 |
| No-ops virando enforcement divergente | B×M | INV-06: sem `DenyError` nos 2 satélites | Fase 2 |
| `details` vaza segredo/path (🟡) | M×M | Scrub I10; shims não logam `args` brutos; teste anti-vazamento | Fase 4 |
| **Rollback** | — | `HARNESS_GATES=off` (efeito imediato, runtime) **ou** `git revert` do commit (chaves v1 ainda presentes garantem fallback). Sem migração de dados. Gatilho: qualquer INV vermelho na Fase 4 ⇒ reverter antes de considerar v2-only. | Todas |

**Validação de negócio**: valor = gates vivos em v2 (paridade deny/allow demonstrada na matriz); risco residual = silêncio (mitigado por smoke por gate + erro visível). Se matriz não demonstra ≥1 deny + ≥1 allow idênticos em v1 e v2, o PLAN falhou — não avançar para TASKS.

---

## 6. Implementation Phases & Dependencies

> PLAN apenas — nenhuma fase edita runtime aqui; cada fase declara o comando verificável que a implementação/TASKS deverá executar.

### Fase 0 — Baseline verde (pré-condição; sem mudança)

- **Dependencies**: None.
- **Scope**: Congelar baseline + provar suíte verde antes de qualquer adapter.
- **Verificável por** (gap 2 — gate bloqueador — executar nesta ordem, sem pular):
  - `node --test ".opencode/plugins/__tests__/*.spec.mjs"` → 100% verde (INV-05); salvar log como `baseline-suite.log` (artifact referenciável).
  - `grep -c "server:" .opencode/plugins/gate.js` → 1 (total nos 3 plugins = 3: `grep -rn "server:" .opencode/plugins/*.js` → 3 ocorrências).
  - `git status --porcelain` → vazio **e** `git diff --stat` → limpo (prova de baseline congelado).
- **Exit criteria (BLOQUEADOR)**: suíte verde registrada em `baseline-suite.log` **+** `git status --porcelain` vazio. Sem esse gate verde, Fase 1/2/3 **não iniciam** (adapter sobre baseline vermelho = defeito). Registro exigido antes de qualquer adapter (SPEC §10 item 4).

### Fase 1 — Adapter dual em `gate.js` (RF-01, H1–H6, ADR-001/002)

- **Dependencies**: Fase 0 verde (gate bloqueador PL-01; gap 2).
- **Scope**: Adicionar `setup(ctx)` via `Plugin.define` ao lado de `server` (`gate.js:933` intacto); registrar `ctx.tool.hook(_,"before",runGatesShim)` por tool com gate (`task`, `write`, `bash`/`shell`), `ctx.session.hook` p/ `noteChatParamsShim` + `humanBoundaryShim`, `ctx.event.subscribe` só em nome confirmado; shims §5.1 com normalização H6; proibições H1/H2/H3/H5.
- **Verificável por**:
  - `grep "server:" .opencode/plugins/*.js` → 3 ocorrências; `grep "setup" .opencode/plugins/*.js` → ≥ 3.
  - `node -e "import('./.opencode/plugins/gate.js')"` (v1) + stub v2 `{tool:{hook},session:{hook},event:{subscribe}}` sem `Plugin export is not a function`.
  - Diff restrito a registro: `git diff .opencode/plugins/gate.js` mostra só adapter/shims, zero diff em `decide`/`gate*`/`HarnessGate`.
  - **Confirmação de nomes v2 (gap 1 — RUNTIME-CONTRACT §2 + doc `migrate-v1`, §1.1/§10 item 2, fontes §1.1.1)**: antes de registrar, confirmar cada nome exato — (a) chave tool `shell` vs `bash` (registrar **apenas** o literal confirmado pelo runtime v2), (b) `ctx.tool.hook` vs alternativa, (c) `ctx.session.hook` vs `ctx.event.subscribe` para `noteChatParamsShim`/`humanBoundaryShim`. Comando: stub v2 com espião que loga `hookName+toolKey+timing` e asserta cada gate (GATE-01..05) efetivamente registrado; nome não confirmado ⇒ **não registrar**.
- **Exit criteria**: `server` intacto + `setup` carrega nos dois runtimes sem throw de registro **+** (gap 1) tabela nome-v1 → nome-v2-confirmado preenchida (fonte: RUNTIME-CONTRACT §2 / `migrate-v1` / §1.1.1) **+** regra de ouro demonstrada: hook v1 sem equivalente confirmado ⇒ **erro visível no load** (throw ou log explícito, nunca silêncio) — caso de teste obrigatório `hook-sem-equivalente ⇒ erro visível`.

### Fase 2 — Dual-export nos satélites no-op (RF-02, INV-06)

- **Dependencies**: Fase 1 (mesmo padrão de `setup`).
- **Scope**: `harness-validator.js` + `hitl-guardrail.js`: adicionar `setup` mantendo no-op; nenhum `DenyError`, nenhum hook de deny, nenhuma re-injeção de prosa (H2).
- **Verificável por**:
  - Load v1 + stub v2 dos 2 arquivos sem erro; chamada retorna `{}`/allow.
  - `grep -c "DenyError" .opencode/plugins/harness-validator.js .opencode/plugins/hitl-guardrail.js` → 0.
- **Exit criteria**: No-ops carregam duplos e seguem no-ops.

### Fase 3 — Config dual `opencode.json` (RF-03, C1–C3, ADR-003, INV-08)

- **Dependencies**: Fase 1 (loader `loadConfigOrDeny`/`ensureConfig :215-237` inalterado é pré-requisito lógico; ordem de edição pode paralelizar com Fase 2).
- **Scope**: Adicionar `plugins` (objetos), `permissions` (`subagent`, `shell`), `agents.*.system` mantendo `plugin`, `permission.task`, `agent.*.prompt`; precedência v2-vence documentada; C4 inalterada.
- **Verificável por**:
  - `node -e` loader parity: mesma fixture deny/allow com shape v1 (`plugin`/`permission.task`/`agent.*.prompt`) e shape v2 (`plugins`/`permissions`/`agents.*.system`) → decisão idêntica.
  - `opencode.json` contém ambas as chaves (C1–C3); runtime v1 lê v1, v2 lê v2.
- **Exit criteria**: Paridade de loader demonstrada; remoção v1 explicitamente adiada.

### Fase 4 — Matriz smoke dual v1×v2 + proibições (RF-04/RF-05, INV-02/03/04/07, SEC)

- **Dependencies**: Fases 1+2+3 completas.
- **Scope** (gap 4 — SEC): Matriz `server`×`setup` × {deny PICCO sem tag, allow PICCO válido, deny `pkill -f` (cada GATE-01..05 negado individualmente em v1 e v2 com paridade; gate não registrado ⇒ FAIL explícito `GATE-ABSENT:<id>`, nunca allow silencioso — anomalia 🟠), allow bash limpo, `Error` genérico ⇒ allow, `HARNESS_GATES=off` ⇒ allow vs `gates.*=off` ⇒ ainda deny}; loader parity C1–C3; greps negativos H1/H2/H3/H5; anti-vazamento I10 (anomalia 🟡: fixture deny com segredo/path absoluto em `args` ⇒ `DenyError.details` contém só `reason` + metadados, sem o segredo/path — asserção nos dois entries); suíte 100% verde final.
- **Verificável por**:
  - `node --test ".opencode/plugins/__tests__/*.spec.mjs"` → verde.
  - Script de matriz v1/v2 → ≥1 DenyError + ≥1 allow idênticos por entry, sem gate silencioso; **casos obrigatórios (gap 4 / SPEC §11)**: (i) anomalia 🟠 gate-ausente — `setup` sem registrar GATE-0X ⇒ smoke falha com `GATE-ABSENT:<id>` visível; (ii) anomalia 🟡 I10 — `details` de deny com segredo/path em `args` contém só `reason` + metadados (`gateId`, `tool`, `timing`), asserção de ausência do segredo nos dois entries.
  - `grep -rn "ask"\|"system.*=" .opencode/plugins/gate.js` (H1/H2 negativo) + smoke asserta cada gate registrado.
  - `node scripts/static-checks.mjs` → verde.
- **Exit criteria**: Todos os INVs §7 verificados **+** casos 🟠/🟡 acima verdes nos dois entries; qualquer vermelho ⇒ rollback (`HARNESS_GATES=off` + `git revert`).

---

## 7. Critical Execution Path

*Mínimo para o MVP (gates vivos em v2 sem mudar semântica), ignorando docs/delta e polimento:*

`PL-01 baseline verde` → `PL-02 adapter gate.js (server+setup+shims)` → `PL-05 config dual` → `PL-07 matriz deny/allow v1×v2` → `PL-08 greps proibições + suíte final`

Secundário (fora do caminho crítico): `PL-04` satélites no-op, `PL-06` lint paridade, delta docs (fase `archive`).

---

## 8. Atomic Task Breakdown & Execution Graph (esboço — explosão TDD em TASKS.md, não aqui)

> Por constraint desta delegação, TASKS detalhadas NÃO são entregues neste PLAN. Abaixo o esboço de microtasks (convenção `V2-[CAMADA]-[ID]`, esboço `jira-microtask-breaker`, 1 arquivo por microtask) para a futura fase `generate-tasks`.

### Esboço por fase

- **[PL-01]** [ ] Baseline: rodar suíte + congelar diff (**gap 2 — gate bloqueador**: `baseline-suite.log` + `git status --porcelain` vazio; sem isso PL-02 não inicia) — **Depends on**: None — **Artifact**: `baseline-suite.log` — **Enforcement**: INV-05 — **Constraint**: SPEC §9 + §10 item 4.
- **[PL-02]** [ ] Adapter `gate.js`: `setup(ctx)` + shims §5.1 (H4/H6) + tabela nomes v1→v2 confirmados (§1.1.1/`migrate-v1`; gap 1: sem equivalente ⇒ erro visível) — **Depends on**: PL-01 (gate bloqueador) — **Artifact**: `.opencode/plugins/gate.js` (só adapter) — **Enforcement**: paridade INV-02; proibições H1/H3/H5 — **Constraint**: ADR-001/002.
- **[PL-03]** [ ] Smoke load v1+v2 de `gate.js` (stub ctx) — **Depends on**: PL-02 — **Artifact**: script smoke — **Enforcement**: INV-01 (server=3, setup≥3) — **Constraint**: ADR-001.
- **[PL-04]** [ ] Dual nos 2 satélites no-op — **Depends on**: PL-02 — **Artifact**: `harness-validator.js`, `hitl-guardrail.js` — **Enforcement**: INV-06 (0 `DenyError`), H2 — **Constraint**: SPEC constraint 4.
- **[PL-05]** [ ] Config dual C1–C3 em `opencode.json` — **Depends on**: PL-01 — **Artifact**: `opencode.json` — **Enforcement**: INV-08 — **Constraint**: ADR-003.
- **[PL-06]** [ ] Teste loader parity v1-shape×v2-shape — **Depends on**: PL-05 — **Artifact**: `config-loader` parity — **Enforcement**: INV-08 — **Constraint**: ADR-003.
- **[PL-07]** [ ] Matriz deny/allow v1×v2 (PICCO, `pkill -f`, fail-open, kill-switch + 🟠 `GATE-ABSENT` por gate + 🟡 `deny-não-vaza-segredo` I10 nos dois entries; gap 4) — **Depends on**: PL-03, PL-06 — **Artifact**: script matriz — **Enforcement**: INV-02/03/04 + SEC §11 — **Constraint**: ADR-002/004.
- **[PL-08]** [ ] Greps negativos + suíte final + `static-checks` — **Depends on**: PL-07 — **Artifact**: relatório — **Enforcement**: INV-07, INV-05 — **Constraint**: RF-05.

**Grafo**: `PL-01 → PL-02 → PL-03 → PL-07 → PL-08`; `PL-02 → PL-04 → PL-08`; `PL-01 → PL-05 → PL-06 → PL-07`. Sem ciclos.

---

## 9. Event Implementation Mapping

*N/A justificado — sem eventos de negócio, sem Kafka, sem outbox/broker (SPEC §6: ERD/Event-Registry de negócio N/A). O "registro" desta migração é o Hook Registry SPEC §5 (H1–H6), mapeado 1:1 abaixo em vez do ciclo Producer→Outbox→Broker→Consumer:*

| Hook (evento de plugin) | Registro v1 | Registro v2 (PLAN Fase 1) | Núcleo | Tarefa esboço |
|---|---|---|---|---|
| H1 `ask` | ausente (correto) | **não registrar** | nenhum | PL-08 (asserção `permission-ask-absent`) |
| H2 system-transform | ausente | **não registrar** | nenhum (no-ops) | PL-04 + PL-08 |
| H3 bus inexistente | ausente | **não subscrever** | nenhum | PL-08 |
| H4 `bash`/`shell` | `tool.execute.before: runGates` → `gateShellHygiene :813` | `ctx.tool.hook("bash"‖shell,"before",shim)` → mesmo núcleo | `gateShellHygiene`+`decide` | PL-02 + PL-07 (`pkill -f`) |
| H5 prosa | nenhum | **não criar** | nenhum | PL-08 |
| H6 tools+`chat.params`+`chat.message` | `tool.execute.before` + `chat.params` + `chat.message` (`:854-919`) | `ctx.tool.hook(_,"before",runGatesShim)` + `ctx.session.hook` ×2 (ou `event.subscribe` só nome confirmado) | `decide`+`CORE_GATES`+mapa+HITL | PL-02 + PL-07 |

*4-task lifecycle: N/A com justificativa (sem eventos persistidos; idempotência N/A — adapter O(1) sem I/O).*

---

## 10. Execution Readiness Checklist + plan-gate self-review

- [x] All tasks have valid dependencies (grafo §8, sem ciclos).
- [x] All SPEC events covered — adaptado: H1–H6 todos mapeados em §9 (eventos de negócio N/A justificado).
- [x] Mandatory testing tasks: suíte verde (PL-01/PL-08) + matriz paridade (PL-07) + loader parity (PL-06) + anti-vazamento I10.
- [x] Failure-mode tasks: fail-open genérico, kill-switch `off` vs `gates.*`, hook-sem-equivalente ⇒ erro visível, rollback `HARNESS_GATES=off` + revert.
- [x] Base infra tasks: baseline Fase 0 precede adapters como **gate bloqueador** (gap 2: `baseline-suite.log` + `git status` limpo; equivalente a "Infra Bootstrap First" para refactor host-local; tenant/DB N/A).
- [x] Critical Execution Path mapeia só o fluxo núcleo (§7).
- [x] Nenhuma fase edita semântica; nenhuma TASKS detalhada nesta entrega (constraint).
- [x] Cada fase tem comando verificável (`node --test`, `grep`, `node -e import`, loader parity, `static-checks`).

### plan-gate score (self)

| Assert (`asserts/plan-gate.md`) | Verdict | Evidência |
|---|---|---|
| Traceability 1:1 | ✅ pass | §1.2 RF-01..05 + INV-01..08 + ADR + H/C mapeados |
| Constraint Mapping | ✅ pass | §3 (constraint→enforcement→failure→strategy) |
| Infra Bootstrap First | ✅ pass adaptado | Fase 0 baseline verde antes dos adapters; tenant/DB N/A (SPEC §2/§6) |
| Execution Graph | ✅ pass | §8, camadas adapter→config→matriz, sem ciclos |
| Critical Execution Path | ✅ pass | §7 (PL-01→02→05→07→08) |
| 4-Task Event Lifecycle | ✅ N/A justificado | §9: sem eventos de negócio; H1–H6 mapeados 1:1 |
| Mandatory Testing Tasks | ✅ pass | PL-01/06/07/08 (suíte + paridade + loader) |
| Failure Mode Testing | ✅ pass | PL-07 (fail-open, kill-switch, gate-ausente) |
| Idempotency Validation | ✅ N/A justificado | Adapter O(1) sem I/O/eventos; matriz por entry cobre repetição |

**Score: 9/9 (7 pass + 2 N/A justificado) — revalidado após gaps 1–5 (cada gap virou exit criteria/teste; nenhum ciclo novo; nenhuma TASKS adicionada). Nenhum gap bloqueador restante.**

### Constraints deste PLAN (máx. 10)

1. Dual v1+v2 obrigatório; nunca remover `server` nesta migração.
2. Núcleos puros intactos (`decide`, `gate*`, `HarnessGate`, `CORE_GATES`, `lib/config.mjs`, `lib/seal.mjs`).
3. Fail-open ADR-006 e kill-switch `HARNESS_GATES=off` ADR-009 intactos; `gates.*` nunca desliga.
4. Satélites seguem no-op (sem `DenyError`).
5. Hooks só aos confirmados (RUNTIME-CONTRACT §2, H1–H6); sem equivalente ⇒ erro visível.
6. Nunca scalar system-transform (H2), evento inexistente (H3), `ask` (H1), bloqueio de prosa (H5).
7. Toda fase tem comando verificável (`node --test`, `grep`, smoke, loader parity).
8. Nunca editar runtime nem `opencode.json` nesta entrega (PLAN apenas).
9. Nunca incluir TASKS detalhadas aqui (explosão TDD na próxima fase).
10. Rollback sempre disponível: `HARNESS_GATES=off` + `git revert` (chaves v1 presentes).

### Success Criteria (deste PLAN)

- [ ] PLAN existe em `.spec/backend/opencode-v2-plugin-migration/PLAN.md`, rastreia SPEC 1:1 (§1.2).
- [ ] Fases ordenadas 0→4 com dependências e critérios verificáveis (§6).
- [ ] Riscos + rollback documentados (§5).
- [ ] plan-gate 9/9 (§10).
- [ ] Validação de negócio: valor (gates vivos em v2) e risco (silêncio) declarados (§1, §5).

---

## Dependências para a próxima fase (`generate-tasks`)

1. SPEC aprovada (ok) + este PLAN (esta entrega).
2. RUNTIME-CONTRACT §2 confirmado para nomes v2 finais (`shell` vs `bash`, `session.hook` vs `event.subscribe`) — **gaps 1/3**: na ausência do doc canônico valem as fontes §1.1.1 (`gate.js:22-24,854-919` + `gate-contract.md`) + doc `migrate-v1`; nome não confirmado ⇒ erro visível (exit criteria Fase 1).
3. Runtime v2 ou stub de `ctx` (`{tool:{hook},session:{hook},event:{subscribe}}`) para smoke.
4. Baseline suíte verde registrada (PL-01) antes de qualquer adapter.
