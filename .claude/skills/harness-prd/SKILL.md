---
name: harness-prd
description: "Skill canônica do PRD: requisitos, RESEARCH, aprovacao humana e handoff para ADR. Use na fase Discovery de uma feature."
---

# Harness PRD

Dona de PRD.md e RESEARCH.md em .spec/prd/{prd-id}/.

## Quando usar
Feature nova, escopo de produto, requisitos, riscos, aprovacao humana.

## Entradas
PICCO, evidencia local de codebase-analysis, fontes externas de deepsearch, estado do projeto.

## Saidas
PRD.md com 16 secoes e bloco 16 preenchido; RESEARCH.md com pelo menos 2 alternativas com fonte e trade-off; ADR-INDEX criado somente apos aprovacao.

## Portoes
PRD-01 verifica 7 secoes obrigatorias. Aprovacao humana e requisito. Nao criar ADR antes do bloco 16.

## Referencias
sdd-compiler, harness-adr, sdd-feedback, feature-status-dashboard.
