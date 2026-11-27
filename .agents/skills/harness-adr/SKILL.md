---
name: harness-adr
description: "Skill canônica do ADR: indice, decisao, unit, branch/PR e cerimonia de merge. Use apos PRD aprovado ou para decisao arquitetural isolada."
---

# Harness ADR

Dona de ADR-INDEX.md e ADR.md. sdd-architecture-board e a lente de qualidade da decisao; sdd-compiler produz SPEC/TASKS/VERIFY/archive.

## Quando usar
Decisao arquitetural, criacao ou atualizacao de ADR, unit adr/legacy, branch e PR por ADR.

## Entradas
PRD aprovado, RESEARCH, decisao, dependencias, interface congelada.

## Saidas
Linha do ADR-INDEX com order, id, title, status, depends_on, dir, branch, merge, unit; ADR.md com decisao e consequencias.

## Portoes
ADR-01/ADR-02 no suite; 1 ADR = 1 branch = 1 PR = 1 revisao humana; merge humano. ADR decision-only usa unit legacy e status todo.

## Referencias
sdd-architecture-board, sdd-compiler, harness-prd, workflow.md (stub).
