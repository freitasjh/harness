---
name: harness-workflow
description: "Fonte canônica do fluxo de agentes do harness: classificação, fases P0-P6, delegação, envelope de entrega e handoff. Use antes de delegar qualquer trabalho."
---

# Harness Workflow

Fonte única do fluxo. As regras em .agents/rules sao stubs de compatibilidade.

## Quando usar
Toda demanda de mudanca, delegacao, avanco de fase ou fechamento de ciclo.

## Entradas
PICCO valido, estado em workflow-state.json, config em harness.config.json e contexto de codebase-analysis/deepsearch quando houver decisao.

## Saidas
Bloco <delivery> com agent, phase, skills, inputs, write_scope, outputs, evidence_path, handoff_schema, stop_condition; e handoff estruturado no retorno.

## Portoes
P0 Discovery, P1 Planning, P2 Planning, P3 Execution, P4 Testing, P5 Testing, P6 Completed. Nao criar novos valores de current_phase. HITL explicito entre fases; loop de correcao ate 3 iteracoes.

## Referencias
references/handoff-schema.md; skills harness-prd, harness-adr, harness-review, security-review, harness-report, sdd-compiler.

## Delivery
Sempre que delegar, emita PICCO + <delivery>. Retorno incompleto e re-delegado.
