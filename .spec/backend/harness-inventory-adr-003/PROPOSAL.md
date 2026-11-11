# PROPOSAL — harness-inventory-adr-003

> Ciclo SDD escopado do **ADR-003 do PRD-1**. Fonte da verdade: `.spec/prd/prd-harness-inventory/ADRs/ADR-003-agente-planner/ADR.md` (223 linhas, 16 itens, G2 aprovado 2026-11-11).

## 1. Problema (medido 2026-11-11, pós-merge `67e8162`)

| Fato | Número |
|---|---|
| Citações vivas de `planejador` (agente que não existe) | **2** (`qa-engineer/AGENT.md:9`, `sdd-workflow-standard.md:50`) |
| Agentes que consomem a skill `dev-planner` | **0** — a skill existe, completa, e ninguém a carrega |
| Autores declarados de `PLAN.md` | **2** (skill `dev-planner` `:139`/`:161` × `sdd-workflow-standard` §1) |
| Precedente de mercado para "planner agent" | **0** — Kiro, spec-kit e o `plan` nativo tratam planejamento como fase (RESEARCH §5-R6) |

Consequência: a prosa do harness manda invocar um agente inexistente, cita um ciclo que ninguém executa, e atribui o mesmo artefato a dois papéis.

## 2. Proposta

Criar o agente `planner` (modo `subagent`, `edit: allow`), que **consome** a skill `dev-planner` e produz 4 artefatos de planejamento (`EXPLORATION.md`, `CONSTRAINTS.md`, `DESIGN-DECISIONS.md`, `ARCHITECTURE.md`), **sem** escrever `PLAN.md` (que fica com o `sdd-compiler`), e reivindicar as 2 citações vivas.

## 3. Escopo

Os 16 itens do `ADR.md` §3.

## 4. Não-escopo

Inventário derivado (ADR-004), prosa órfã (ADR-005), agnosticização (PRD-2), migração V2 do `opencode.json` (R3), `gate.js`/`KNOWN_AGENTS` (FU-65 continua aberto e piora de 3→4).

## 5. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | `edit: allow` é grosseiro: `scripts/`, `docs/`, `installer/`, `src/` ficam alcançáveis | declarado em C2 do ADR; nenhum branch de gate novo |
| R2 | Papel novo com fronteira frouxa vira camada extra (latência dupla) | 4 "não faz" explícitos + `description` carregando as fronteiras (item 4/6) |
| R3 | Skill perde 2 linhas e alguém acha que perdeu capacidade | PLAN.md continua produzido — pelo `sdd-compiler` (RF do item 8) |
| R4 | ROSTER literal do spec de paridade fica desatualizado e o teste passa a medir o passado | item 14 + suíte |

## 6. Verificação

5 comandos de suíte + os comandos de aceite dos 16 itens; `git diff` de `gate.js`, `harness.config.json` e `installer/` vazio.
