# ADR-INDEX — harness-eixos-stack

> **Esteira**: `.agents/rules/prd-adr-pipeline.md` — caminho **ADR-only** (isenção §3: mudança arquitetural **sem valor de produto novo**). Não existe `.spec/prd/harness-eixos-stack/` e **não será criado**: `PRD-01` valida `.spec/prd/**` quando o dir existe, então criar um bucket PRD sem `PRD.md` deixaria a suíte vermelha (mecanismo: `.agents/skills/prd-adr-pipeline/checks.mjs` → `runPrdChecks`, vacuous-safe).
> **Nível de garantia desta folha**: 🟡 **processo** — `ADR-01`/`ADR-02` validam `.spec/prd/**/ADR-INDEX.md`; este índice vive no dir do ciclo e portanto **não** é CI-enforced. Fica no formato do contrato (SPEC §4.2) para poder ser promovido depois sem reescrita.
> **Branch/PR**: nomes abaixo são **planejados**. Nenhuma branch foi criada e nada foi enviado ao remote (`workflow-state.json` → `pending_actions`: "push (nada enviado)"). Operação por ADR (RF-09) aguarda aprovação explícita do usuário.

| order | id | title | status | depends_on | dir | branch | merge |
|---|---|---|---|---|---|---|---|
| 1 | ADR-001 | Registry de perfis modela backend e frontend como eixos, com rótulos literais congelados | todo | — | `ADRs/ADR-001-registry-eixos-axis/` | `adr/harness-eixos-stack/01-registry-eixos-axis` | — |
| 2 | ADR-002 | Perfil `react` + gating de skill e rules derivado do eixo (fim do vazamento A1/A2) | todo | ADR-001 | `ADRs/ADR-002-perfil-react-gating-eixo/` | `adr/harness-eixos-stack/02-perfil-react-gating-eixo` | — |
| 3 | ADR-003 | Vendor com origem de licença declarada (`licenseOrigin`) e NOTICE sem claim universal | todo | ADR-002 | `ADRs/ADR-003-vendor-license-origin/` | `adr/harness-eixos-stack/03-vendor-license-origin` | — |
| 4 | ADR-004 | Menu W2m em 2 passos, range derivado e padrões do erro reparados | todo | ADR-002 | `ADRs/ADR-004-menu-w2m-2-passos/` | `adr/harness-eixos-stack/04-menu-w2m-2-passos` | — |
| 5 | ADR-005 | Rota de migração para a pergunta dupla `backend`+`frontend` (desenho; execução futura) | todo | ADR-001 | `ADRs/ADR-005-rota-pergunta-dupla/` | `adr/harness-eixos-stack/05-rota-pergunta-dupla` | — |

**Prova de independência (nota do architect, §4 do parecer):** ADR-001 é raiz (forma do registry) — sem ele, ADR-002 é impossível e ADR-005 perde alvo; ADR-004 depende de ADR-002 (o item do menu aponta para o preset); ADR-003 é ortogonal a ADR-004/005 e **pré-requisito de resultado** de ADR-002 (sem vendor, o perfil react não entrega skill alguma).
