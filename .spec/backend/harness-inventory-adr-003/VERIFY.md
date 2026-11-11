# VERIFY — harness-inventory-adr-003

> Verificação de 3 dimensões sobre o ciclo que executa o **ADR-003 do PRD-1** (re-escopado — §10).
> Data: 2026-11-11. Branch: `adr/prd-harness-inventory/03-agente-planner`. HEAD: `7f13923`.

## Veredito: **3/3 PASS — com escopo deferido declarado**

| Dimensão | Resultado | Base |
|---|---|---|
| Completude | ✅ PASS | 7/7 microtasks; 5 artefatos; 0 TODO; 5 itens deferidos **declarados** no ADR §10 |
| Corretude | ✅ PASS | 938 testes 0 falhas; 17/17 itens (§3 + item 17); REPORT schema-válido |
| Coerência | ✅ PASS | `gate.js`/`harness.config.json`/`installer/`/`lib/` com 0 linhas; paridade registro↔disco 10/10 |

## 1. Completude

- `TASKS.md`: 7/7 marcadas.
- `grep -ric 'TODO|TBD|FIXME'`: 0.
- **Deferido (ADR §10), declarado e não contado como entrega:** I2 (autor único de `PLAN.md`), I3 (template de ADR na skill), autor único de `EXPLORATION.md`, Protocolo de Delegação do orquestrador, gatilho da Fase 0. Dono: **ADR-005**.

## 2. Corretude

| Item | Evidência |
|---|---|
| 1–3 (`opencode.json`) | 10 chaves; `planner.mode = "subagent"`; `edit: allow` = 5 (`architect,developer-engineer,planner,product-manager,qa-engineer`) |
| 4–6 (`AGENT.md`) | 42 linhas; `description` cita os 4 vizinhos; 4 "não faz" (`:27-30`) |
| 7–8 (escrita e colisão) | 4 basenames; `grep -rc "PLAN\.md"` no dir da skill = 0 **no token** (resíduo semântico em `workflow.md` deferido) |
| 9–10 (citações) | `grep -rn "planejador" .agents/` = 0; `qa:9` → `orchestrator`/P4; `rule:50` → `planner`/Fase 5 |
| 11 (gate) | `gate.js` 0 linhas; `grep -c planner gate.js` = 0 |
| 12 (KNOWN_AGENTS) | enum de 6 inalterado; `planner` cai em `unknown` (FU-65 piora 3→4, declarado) |
| 13 (paridade) | 10 dirs ↔ 10 chaves, diff de conjuntos vazio |
| 14 (ROSTER do spec) | `config-dual-parity.spec.mjs:129` com `planner` |
| 15–16 (instalador/selo) | `installer/` 0 linhas; `harness.config.json` 0 linhas; selo não republicado |
| 17 (fiação) | `grep -c planner` no `orchestrator/AGENT.md` = 1; em `workflow-rules.md` = 5; `grep -c dev-planner workflow-rules.md` = 0 |

**Suíte:** plugins 379/0 · installer 559/0 · static exit 0 · sdd-checks 0 FAIL · vendor OK.

## 3. Coerência

- **Contradição 9-vs-10 eliminada**: `docs/FUNCIONAMENTO.md` diz 10 em `:95`, `:108`, `:622`, `:655`, `:740`; `opencode.json:12-102` em todas as âncoras; 13 refs `orchestrator/AGENT.md:NNN` conferidas linha a linha contra o arquivo.
- **Fechamento falso corrigido no contrato, não apagado**: a mensagem do commit `0502835` afirmava F1/F2 fechados; o ADR §10-N18 registra que estavam errados, e `SPEC` I2/I3 + `TASKS` PL-04 + ADR §4-C5 foram rebaixados a 🟡 deferido. Nada foi reescrito no histórico.
- **Sem vazamento de camada**: `gate.js`, `installer/`, `lib/`, `harness.config.json` intocados; o papel entra no roster sem mecanismo novo.
- **Allowlist é prosa, e o agente agora diz isso** (`AGENT.md:24`): pedido de escopo, não garantia; `bash: allow` contorna; o que barra escrita perigosa é `protectedPaths`.

## 4. Traceability

| RF | Task | Onde |
|---|---|---|
| RF-01/02 | PL-01, PL-02 | `planner/AGENT.md`, `opencode.json:31-38` |
| RF-03 | PL-01 | `AGENT.md:10,27-30` |
| RF-04 | PL-04 | `dev-planner/SKILL.md:139,162` (resíduo em `workflow.md` deferido) |
| RF-05 | PL-03 | `sdd-workflow-standard.md:50`, `qa-engineer/AGENT.md:9` |
| RF-06/07 | PL-06, PL-07 | `gate.js` intocado; `KNOWN_AGENTS` declarado |
| RF-08 | PL-05 | `config-dual-parity.spec.mjs:129` |
| RF-09 | PL-06 | `installer/` intocado; selo |

**Cobertura: 9/9 RF · 17/17 itens.**

## 5. Resíduos

| # | Item | Dono |
|---|---|---|
| §10 (5 itens) | prosa da skill e gatilho da Fase 0 | **ADR-005** |
| FU-65 | `KNOWN_AGENTS` com 6 nomes para 10 agentes | ciclo de gate (path protegido) |
| FU-63 | regra §1 × `ADR-01` | PRD-2 |

## 6. Conclusão

O **que o ADR se comprometeu a entregar** (papel, registro, fronteira, fiação, correção de lastro) está entregue e verificado por QA independente. O que **não** está entregue está nomeado, com dono e com o motivo: a prosa da skill pertence ao ADR-005. **Apto ao P5→P6**, com essa ressalva explícita no PR.
