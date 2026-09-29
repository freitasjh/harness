# DOC-02 — Mapa de back-refs (antes da fusão)

Fusão: `workflow-rules.md` + `harness-continuous.md` → `workflow-rules.md`
(`harness-continuous.md` removido). Toda ref abaixo re-aponta para a seção
fundida (§5 Harness H0–H7). Levantado por grep em 2026-09-29, antes de mover.

## Refs para `harness-continuous.md` (V12 — devem zerar após a fusão)

| # | Arquivo:linha | Novo alvo |
|---|---|---|
| 1 | `.agents/agents/orchestrator/AGENT.md:435` (fonte da verdade) | `workflow-rules.md` §5 (H0–H7 fundidos) |
| 2 | `.agents/agents/orchestrator/AGENT.md:473` (protocolo H3) | `workflow-rules.md` §5 H3 |
| 3 | `.agents/agents/orchestrator/AGENT.md:492` (template Anexo B) | `workflow-rules.md` §5 Anexo B |
| 4 | `.agents/agents/orchestrator/AGENT.md:606` (tabela de docs) | `workflow-rules.md` §5 (linha da tabela reescrita) |
| 5 | `.agents/rules/workflow-rules.md:386` (H2) | âncora interna §5 H2 |
| 6 | `.agents/rules/workflow-rules.md:406` (fonte da verdade §5) | absorvido pelo §5 fundido |
| 7 | `.agents/rules/workflow-rules.md:504` (§5.4 substituída) | absorvido pelo §5 fundido |
| 8 | `.agents/rules/workflow-rules.md:557` (H6) | âncora interna §5 H6 |
| 9 | `.agents/rules/workflow-rules.md:662` (tabela de docs) | linha reescrita (sem o arquivo) |
| 10 | `.agents/skills/prompt-optimizer/SKILL.md:171` (V3 call sites) | lista sem `harness-continuous.md` |
| 11 | `.agents/skills/prompt-optimizer/SKILL.md:172` (V4 grep) | `workflow-rules.md` §5 |
| 12–14 | `.agents/skills/prompt-optimizer/references/clarifying-questions.md:129–131` | `workflow-rules.md` §5 H1/H2.1/H5.1 |
| 15 | `scripts/static-checks.mjs` V12 (INFO, owner DOC-02) | vira FAIL após a fusão (check em `sdd-checks.mjs` R-V12) |
| 16 | `.agents/rules/harness-config.md:57–59` (owner DOC-02) | passado: dieta aplicada (DOC-02) |

`harness-validator.js:7,18` (citado no SPEC §21.3): sem ocorrência — FIX-01 já
removeu as refs; nada a migrar.

## Vocabulário de fase (V17)

Canônico: `sdd-workflow-standard.md` (vive em `workflow-state.json`).
Rótulos mapeados em `workflow-rules.md` §3-tabela (P0..P6, Explore→Archive).
`verify` ocorre em `Testing`; `archive` ocorre em `Completed`.

## Refs que NÃO podem ser resolvidas (com motivo)

- `.spec/archive/20260927-*/`: imutável por decisão (histórico não reescrito).
  Fora do sweep do RENAME por exceção declarada (SPEC §23/U11).
- `.spec/governance/harness-v7/SPEC.md §23` + `PLAN.md §8` + `TASKS.md §RENAME`:
  linhas que descrevem o próprio rename (`fullstack-code-reviewer → code-reviewer`)
  mantêm o nome antigo como objeto da troca — trocar ali apagaria o significado.
- `PROPOSAL.md:122,140` + `PLAN.md:172` + `TASKS.md:251` + `SPEC.md:175,259,307,394,760,764`
  (FU-16): escritos pré-rename; o nome antigo ali é registro histórico do plano,
  não ref viva — o sweep do RENAME cobre só paths vivos (`opencode.json`,
  `gate.js`, agentes, rules/skills, testes, checks).
- Sentença `orchestrator/AGENT.md:435` ("Plugin harness-validator.js injeta…"):
  fato superado pelo FIX-01 (módulo virou no-op); só a ref de arquivo é
  re-apontada aqui — a correção da sentença é dono de DOC-03/follow-up.
- Sentenças normativas stale com o nome antigo (FU-16, dono DOC-03/follow-up,
  sem deny novo): `SPEC.md:259` (orquestrador "resultado do fullstack-code-reviewer"),
  `SPEC.md:307` (loop `developer-engineer → fullstack-code-reviewer`),
  `PROPOSAL.md:140` (diff "revisado por fullstack-code-reviewer") — lêem-se com o
  nome novo (`code-reviewer`); a troca textual acontece no follow-up do DOC-03
  para não misturar rename mecânico com revisão normativa.
