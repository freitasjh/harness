# always-on — índice carregado em todo agente

Fonte canônica: skills em .agents/skills. Prosa descreve; gate.js + CI negam.
Em conflito, skill canônica e mecanismo executável vencem este índice.

## 1. Identidade
Dados do projeto vêm de harness.config.json, nunca de literal de prosa.
Papéis e permissões: opencode.json; contrato: harness-workflow.

## 2. Prompt gate
Toda mudança passa por prompt-optimizer antes de agir. Consulta factual pula.
Delegacao exige PICCO + <delivery> com write_scope, handoff_schema e stop_condition.

## 3. Fluxo
PRD → RESEARCH → ADR-INDEX → ADR → SPEC/TASKS → implementação → VERIFY → archive.
Bugfix: BugAnalysis → BugFix → BugReview.

## 4. Gates
PICCO, evidence/contraprova, HITL, higiene, escrita. Níveis: runtime/parcial/processo/declarado-aberto.

## 5. Harness
H0..H7 vivem em harness-workflow e harness-report. Suite completa antes de done.

## 6. Deepsearch
Fonte antes de recomendação externa; URL + data; sem fonte = inferência rotulada.

## 7. Regras completas
| Tema | Skill canônica |
|---|---|
| fluxo e delegação | harness-workflow |
| PRD | harness-prd |
| ADR | harness-adr |
| revisão | harness-review |
| segurança | security-review |
| busca externa | deepsearch |
| bootstrap | harness-bootstrap |
| evidência | harness-report |
