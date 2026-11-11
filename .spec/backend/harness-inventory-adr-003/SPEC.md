# SPEC — harness-inventory-adr-003

> Prescritivo. Origem: `ADR-003` §3 (16 itens). Em conflito, o ADR prevalece. Tipo: feature (papel novo) sob o refactor do roster.

## 1. Requisitos funcionais

- **RF-01 (itens 1, 2, 13)** — `opencode.json.agent` = **10** chaves; `planner.mode = "subagent"`; registro no **shape legado homogêneo** (`prompt` string `"{file:…}"` + `permission`), zero campo V2; paridade registro↔disco 10/10.
- **RF-02 (item 3)** — `edit: allow` = **5**: `architect,developer-engineer,planner,product-manager,qa-engineer` (conjunto literal).
- **RF-03 (itens 4, 5, 6)** — `description` carrega as 4 fronteiras pelos nomes dos vizinhos; `AGENT.md` ≤ **60 linhas**, cita `dev-planner`, **0** ocorrências de `Fase N —` e **0** de `websearch`; **≥ 4** "não faz", um por vizinho.
- **RF-04 (itens 7, 8)** — escrita do `planner` limitada a **4 basenames** (`EXPLORATION.md`, `CONSTRAINTS.md`, `DESIGN-DECISIONS.md`, `ARCHITECTURE.md`) sob `.spec/(backend|frontend)/{feature}/`; **`PLAN.md` fora do escopo**; a skill `dev-planner` perde as 2 ocorrências de `PLAN.md` (`:139`, `:161`).
- **RF-05 (itens 9, 10)** — `grep -rn "planejador" .agents/` = **0**; as 2 linhas-alvo nomeiam o vizinho certo (`sdd-workflow-standard.md:50` → `planner` + Fase 5; `qa-engineer/AGENT.md:9` → `orchestrator`); `DESIGN-DECISIONS.md` **não** é ADR: 0 `depende-de`, 0 "interface congelada".
- **RF-06 (item 11)** — `gate.js` byte-idêntico; `grep -c planner .opencode/plugins/gate.js` = **0**.
- **RF-07 (item 12)** — `KNOWN_AGENTS`: `planner` cai em `unknown`; 4 de 10. Declarado, não resolvido (FU-65).
- **RF-08 (item 14)** — ROSTER literal de `config-dual-parity.spec.mjs:124-137` ganha `planner` (10 nomes).
- **RF-09 (itens 15, 16)** — instalador intocado (`.agents/agents` já é camada); `commands.suiteFull` e selo intactos; suíte verde.

## 2. Invariantes

- **I1** — o `planner` **consome** a skill `dev-planner`; não copia fase nem metodologia para o prompt.
- **I2** — `PLAN.md` tem **um** autor (`sdd-compiler`). Nenhum outro papel o escreve. → 🟡 **DEFERIDA ao ADR-005**: o `SKILL.md` foi corrigido, mas `.agents/skills/dev-planner/workflow.md` (diagrama `:20-21`, `:420`, `:434`) ainda prescreve `PLAN`; a métrica por token do ADR item 8 passa sem que a invariante seja verdadeira.
- **I3** — `DESIGN-DECISIONS.md` é insumo de decisão, **não** decisão: não carrega `status`, `depende-de` nem "interface congelada". → 🟡 **DEFERIDA ao ADR-005** quanto à skill: `workflow.md:199-225` ainda tem template de ADR com `### Status`.
- **I4** — nenhuma linha de código de gate, instalador ou config de suíte é tocada.
- **I5** — toda citação reapontada nomeia o papel que **realmente** executa a ação (não basta trocar o token).

## 3. Edge cases

- E1 — `qa-engineer/AGENT.md:9`: reapontar para `planner` manteria a frase falsa (quem dispara QA é o `orchestrator`).
- E2 — remover `PLAN.md` da skill sem garantir o autor substituto deixa o artefato órfão de dono.
- E3 — `config-dual-parity.spec.mjs` tem o roster literal: esquecer `planner` deixa o teste medindo 9 quando há 10.
- E4 — `dev-planner` já está em `SKILLS_COMMON` do instalador: o agente novo não exige mudança de propagação.

## 4. Estratégia de teste

| Nível | Comando | Esperado |
|---|---|---|
| Plugins | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 0 falhas |
| Instalador | `node --test "installer/__tests__/*.spec.mjs"` | 559 pass |
| Static | `node scripts/static-checks.mjs` | exit 0 |
| SDD | `node scripts/sdd-checks.mjs` | 0 FAIL |
| Vendor | `node scripts/vendor-skills.mjs --check` | OK |

## 5. N/A declarado

Sem backend Java, frontend, DB, endpoint ou auth: as rules `backend-*`/`frontend-*` não se aplicam.
