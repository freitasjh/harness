# PLAN — harness-inventory-adr-003

> Execução do ADR-003 na branch `adr/prd-harness-inventory/03-agente-planner` (base `5c9bbc0`).

## 1. Fases

### Fase 1 — O agente (RF-01..RF-03)
1. Criar `.agents/agents/planner/AGENT.md` ≤ 60 linhas: papel, gatilho (`subagent`, invocado pelo `orchestrator` em fase de planejamento), 4 artefatos que produz, **4 "não faz"** (um por vizinho), skills obrigatórias (`dev-planner` como metodologia).
2. Registrar em `opencode.json`: chave `planner` no **shape legado homogêneo** — `prompt: "{file:.agents/agents/planner/AGENT.md}"`, `mode: "subagent"`, `description` com as 4 fronteiras pelos nomes dos vizinhos, `permission.edit: "allow"`.

**Checkpoint:** 10 chaves; `edit: allow` = 5 nomes; `planner.mode = "subagent"`.

### Fase 2 — Reivindicar as citações (RF-05)
3. `.agents/rules/sdd-workflow-standard.md:50` → sujeito `planner`, gatilho "ao concluir as TASKS" corrigido para `Fase 5 — Valide`.
4. `.agents/agents/qa-engineer/AGENT.md:9` → token `planejador` sai, entra `orchestrator` (quem dispara QA na Fase 7). **Não** reapontar para `planner`.

**Checkpoint:** `grep -rn "planejador" .agents/` = 0.

### Fase 3 — Colisão do PLAN.md (RF-04)
5. Remover as 2 ocorrências de `PLAN.md` da skill `dev-planner` (`:139`, `:161`); declarar, no lugar, que o `sdd-compiler` é o autor e que estimativa/riscos voltam como parecer.

### Fase 4 — Paridade de teste (RF-08)
6. `config-dual-parity.spec.mjs:124-137`: ROSTER literal ganha `planner` (10 nomes).

### Fase 5 — Verificação (RF-06, RF-07, RF-09)
7. Commit com trailer `Harness-Gate-Change` (`.agents/rules/**` é protegido).
8. 5 comandos de suíte; `git diff --stat` de `gate.js`, `harness.config.json` e `installer/` vazio; `grep -c planner gate.js` = 0; `KNOWN_AGENTS` declara `planner` como `unknown`.

## 2. Constraint mapping

| Constraint | Onde |
|---|---|
| Consome a skill, não duplica (I1) | Fase 1 item 1 |
| `PLAN.md` com um autor (I2) | Fase 3 |
| `DESIGN-DECISIONS.md` não é ADR (I3) | Fase 1 item 1 (texto do agente) |
| Gate/instalador intactos (I4) | Fase 5 item 8 |
| Citação nomeia quem executa (I5) | Fase 2 item 4 (E1) |

## 3. Caminho crítico

`F1.1 → F1.2 → F4 → F5.8` — o agente nascer sem o ROSTER atualizado deixa o spec de paridade medindo 9 de 10.

## 4. Rollback

`git reset --hard 5c9bbc0`.
