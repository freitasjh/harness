# Change Proposal: Migração Plugins Opencode v1 → v2 (dual-export)

> **ID**: `opencode-v2-plugin-migration`
> **Status**: `Draft`
> **Author**: architect (subagent)
> **Date**: 2026-10-15
> **Source**: descrição direta (delegação PROPOSAL migração opencode v2 plugins harness)

---

## 1. Problem Statement

- **Contexto**: Harness registra gates em `opencode.json` no formato v1 (`"plugin": [...]`, `"permission.task"`, `"agent.{name}.prompt"`) e implementa o núcleo em `.opencode/plugins/gate.js` (933 linhas, entry `export default { id: "harness-gate", server: HarnessGate }` — linha 933), com satélites `.opencode/plugins/harness-validator.js` (no-op) e `.opencode/plugins/hitl-guardrail.js` (no-op). Lógica pura testada em `.opencode/plugins/__tests__/*.spec.mjs` e libs `.opencode/plugins/lib/config.mjs`, `.opencode/plugins/lib/seal.mjs`. Pacote local `@opencode-ai/plugin` em 1.18.30.
- **Impacto atual**: Doc oficial v2 declara que plugins v1 **não rodam** em v2. Sem migração, ao adotar runtime v2 os gates Harness (GATE-01..GATE-05: DenyError, PICCO, anchors, HITL, shell hygiene) silenciosamente deixam de carregar — fail-open vira ausência de enforcement, sem log de deny. Custo: perda total da governança SDD/HITL e falsa sensação de proteção.
- **Evidência**:
  - `.opencode/plugins/gate.js:933` — `export default { id: "harness-gate", server: HarnessGate }` (shape v1).
  - `opencode.json:3,7-9,13` — chaves v1 `"plugin"`, `"permission": { "task": "ask" }`, `"prompt": "{file:...}"`.
  - Doc v2 `migrate-v1`: nova API `Plugin.define({ id, setup(ctx) })` com `ctx.tool.hook` / `ctx.session.hook` / `ctx.event.subscribe`; config `plugin` → `plugins` (objetos), `permission` → `permissions`, `agent.prompt` → `agents.system`.

---

## 2. Proposed Solution

**Resumo**: Migrar os 3 plugins para **dual-export v1+v2** sem alterar runtime nem núcleos puros, preservando 100% dos gates.

**Abordagem**:
- Adicionar a cada plugin (`gate.js`, `harness-validator.js`, `hitl-guardrail.js`) um export v2 `setup(ctx)` via `Plugin.define({ id, setup })` (ou shape equivalente suportado desde 1.18.29+) que registra os mesmos hooks já usados no `server`, mantendo o export v1 `{ id, server }` intacto para compatibilidade retroativa.
- Isolar o adapter v2 em camada fina: `server` (v1 dispatcher) e `setup` (v2 registro via `ctx.tool.hook` / `ctx.session.hook` / `ctx.event.subscribe`) chamam os mesmos núcleos puros (`decide`, `gatePiccoTask`, `gateCompletionAnchorA`, `gatePhaseAnchorB`, `gateHitlBatch`, `gateShellHygiene`, `HarnessGate` em `.opencode/plugins/gate.js`).
- Migrar `opencode.json` para chaves duais/compatíveis: `plugin` → `plugins` (objetos), `permission.task` → `permissions`, `agent.*.prompt` → `agents.*.system`, mantendo leitura nos dois runtimes durante a transição.
- Validar com a suíte existente (`.opencode/plugins/__tests__/gate.spec.mjs`, `sdd-checks`, `dogfood`, etc.) + matriz v1/v2 de smoke (carrega em 1.18.30 e em runtime v2).
- **Alternativas descartadas e por quê**:
  - *Rewrite v2-only (remover `server`)*: descartado — quebra quem ainda roda v1; defeito explícito desta proposta.
  - *Fork/duplicar arquivos `gate.v2.js`*: descartado — duplica 933 linhas, diverge núcleos, viola KISS e DRY.
  - *Manter v1 e ignorar v2*: descartado — gates morrem silenciosamente no upgrade do runtime.

---

## 3. Scope

### In Scope
- [ ] Adapter dual-export (`server` + `setup` via `Plugin.define`) em `.opencode/plugins/gate.js`, `.opencode/plugins/harness-validator.js`, `.opencode/plugins/hitl-guardrail.js` — sem mudar lógica de gates.
- [ ] Migração compatível de `opencode.json` (`plugin`→`plugins`, `permission`→`permissions`, `agent.prompt`→`agents.system`) com leitura dual v1+v2.
- [ ] Matriz de verificação: suíte `__tests__/*.spec.mjs` verde + smoke load v1 (1.18.30) e v2.
- [ ] SPEC/PLAN/TASKS futuros detalhando mapeamento hook-a-hook (H1–H6 do RUNTIME-CONTRACT) — apenas previstos, não entregues aqui.

### Out of Scope
- Alterar lógica dos gates GATE-01..GATE-05, `DenyError`/fail-open (ADR-006), kill-switch `HARNESS_GATES` (ADR-009) — fora porque núcleos puros são invariantes desta migração.
- Criar novos gates, mudar `harness.config.json`, `lib/config.mjs`, `lib/seal.mjs` — fora porque não há mudança funcional.
- Remover suporte v1 ou reescrever testes existentes — fora porque quebraria compatibilidade retroativa.
- SPEC/PLAN/TASKS/implementação — fora porque esta entrega é PROPOSAL apenas.

---

## 4. Architecture Impact

| Aspecto | Impacto | ADR Necessário? |
|---------|---------|-----------------|
| Backend (módulos afetados) | `.opencode/plugins/gate.js` (adapter `setup` + `server` mantido), `.opencode/plugins/harness-validator.js`, `.opencode/plugins/hitl-guardrail.js`, `opencode.json` (chaves `plugins`/`permissions`/`agents.system`) | Não (refactor compat, sem nova decisão estrutural; ADR futuro só se mapear hook inexistente) |
| Frontend (componentes/stores) | Nenhum — sem UI afetada | Não |
| Banco de dados (migrations) | Nenhum — sem persistência | Não |
| Multi-tenancy | Sem impacto — plugins são locais ao repo, sem isolamento de tenant | Não |
| Segurança / RBAC | Sem novas permissões; enforcement preservado 1:1 (`DenyError`, fail-open ADR-006, kill-switch `HARNESS_GATES=off` ADR-009 inalterados); risco é ausência silenciosa de gates se v2 não registrar — mitigado por smoke dual | Não |
| Eventos (Kafka/async) | Nenhum evento de negócio; apenas remapeamento de hooks de plugin (`tool`/`session`/`event.subscribe` v2 ↔ dispatcher v1 H1–H6 de `.spec/governance/harness-v7/RUNTIME-CONTRACT.md`) | Não |

---

## 5. Delta Preview

| Documento Alvo | Tipo de Mudança | Seção Afetada |
|----------------|-----------------|---------------|
| `.agents/rules/workflow-rules.md` | MODIFIED | Seção de registro de plugins / hooks harness (atualizar shape v1→dual v1+v2) |
| `.agents/rules/gate-contract.md` | MODIFIED | Hook Registry / contrato de deny (mapear `server` v1 ↔ `setup(ctx)` v2) |
| `AGENTS.md` | MODIFIED | Seção de plugins/config (`opencode.json`: `plugins`, `permissions`, `agents.system`) |

---

## 6. Risk Assessment

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Propor quebra v1 (remover `server` sem dual-export) — gates param em runtime v1 | Baixa | Alto | Constraint explícita: dual-export obrigatório; SPEC futuro deve exigir teste de load v1 em 1.18.30 |
| Hook v1 sem equivalente v2 (H1–H6 do RUNTIME-CONTRACT) — gate sem registro silencioso | Média | Alto | Mapeamento hook-a-hook no SPEC; smoke v2 assertando cada gate registrado; fail-closed no diagnóstico (erro visível se hook ausente) |
| `opencode.json` com chaves novas ignoradas pelo runtime antigo (ou vice-versa) — config não lida | Média | Médio | Config dual/compatível validada nos dois runtimes; `loadConfigOrDeny`/`ensureConfig` (`.opencode/plugins/gate.js:215-237`) inalterados; teste de loader nos dois shapes |
| Núcleos puros alterados por acidente durante migração — regressão de deny/fail-open | Baixa | Alto | Proibição de tocar em lógica (`decide`, `gate*`, `HarnessGate`); suíte `__tests__/*.spec.mjs` como gate verde obrigatório |
| Falsa migração dos no-ops (`harness-validator.js`, `hitl-guardrail.js`) virando enforcement divergente | Baixa | Médio | Manter no-ops como no-ops nesta fase; qualquer ativação futura exige PROPOSAL/SPEC próprios |

---

## 7. Success Criteria

- [ ] PROPOSAL existe em `.spec/backend/opencode-v2-plugin-migration/PROPOSAL.md` com ID kebab-case `opencode-v2-plugin-migration`, In/Out e Delta preenchidos (verificável por leitura de arquivo).
- [ ] Cada um dos 3 plugins mantém export v1 `{ id, server }` intacto após a migração proposta (verificável por `grep "server:" .opencode/plugins/*.js` retornando 3 ocorrências).
- [ ] Cada um dos 3 plugins expõe entry v2 `setup` via `Plugin.define` (verificável por `grep "setup" .opencode/plugins/*.js` + smoke load em runtime v2 sem `Plugin export is not a function`).
- [ ] Suíte existente `.opencode/plugins/__tests__/*.spec.mjs` permanece 100% verde após a mudança (verificável por execução dos specs).
- [ ] Smoke dual passa: gates negam/permitem identicamente em v1 (1.18.30) e v2 para ao menos 1 caso DenyError e 1 caso allow (verificável por script de matriz).

---

## 8. Completion Metadata

- **Archived on**: —
- **Duration**: —
- **Archive path**: —
- **Files changed**: —

---

## Constraints (máx. 10, referenciadas nesta fase)

1. Preservar gates harness GATE-01..GATE-05 1:1 (`.opencode/plugins/gate.js`) — sem mudança de semântica deny/allow.
2. Dual-export obrigatório: manter `{ id, server }` v1 + adicionar `setup(ctx)` v2 (suporte 1.18.29+); nunca remover v1 nesta migração.
3. Núcleos puros inalterados: `decide`, `gatePiccoTask`, `gateCompletionAnchorA/B`, `gateHitlBatch`, `gateShellHygiene`, `HarnessGate`, `lib/config.mjs`, `lib/seal.mjs`.
4. Manter fail-open ADR-006 e kill-switch `HARNESS_GATES=off` ADR-009 intactos.
5. `harness-validator.js` e `hitl-guardrail.js` seguem no-op nesta fase.
6. Citar arquivos sempre com path (`opencode.json`, `.opencode/plugins/gate.js:933`, etc.).
7. Nunca editar plugins ou `opencode.json` nesta fase (somente PROPOSAL).
8. Nunca misturar SPEC nesta entrega (PROPOSAL apenas, sem SPEC/PLAN).
9. Mapear hooks somente aos confirmados em `.spec/governance/harness-v7/RUNTIME-CONTRACT.md` §2 (H1–H6).
10. Suíte `__tests__/*.spec.mjs` deve permanecer verde como invariante.
