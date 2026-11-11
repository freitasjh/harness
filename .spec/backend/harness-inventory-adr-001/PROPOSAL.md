# PROPOSAL — harness-inventory-adr-001

> Ciclo SDD escopado do **ADR-001 do PRD-1** (`prd-harness-inventory`).
> Fonte da verdade da decisão: `.spec/prd/prd-harness-inventory/ADRs/ADR-001-roster-de-agentes/ADR.md` (190 linhas, interface congelada de 16 itens, aprovada no portão G2 em 2026-11-11).

## 1. Problema (medido 2026-11-11)

| Fato | Número |
|---|---|
| `AGENT.md` no disco vs agentes registrados em `opencode.json` | 11 vs 10 |
| Arquivos fora de `.spec/**` citando `sdd-orquestrador` | 10 arquivos / 18 ocorrências |
| Agentes com mandato sobreposto | `codebase-analyzer` × `architect`; `sdd-orquestrador` × `orchestrator` |
| Arquivos órfãos no roster | stub `code-reviewer/AGENT.md` (6 linhas — o runtime usa `PROMPT.md`) |
| Consumidores do arquivo vivo do `sdd-orquestrador` | `scripts/sdd-checks.mjs:132`, `:384`; `.opencode/plugins/__tests__/sdd-checks.spec.mjs`; `.github/workflows/harness-integrity.yml:32` |

Consequência: o roster que o runtime carrega não é o roster que a prosa descreve; `sdd-checks` lê um agente que ninguém pode invocar.

## 2. Proposta

Aplicar o ADR-001 de forma **atômica**: roster de **9 agentes registrados**, `codebase-analyzer` absorvido pelo `architect`, `sdd-orquestrador` e o stub do `code-reviewer` removidos, e todas as referências vivas reapontadas no mesmo commit. Atômico não é preferência: o primeiro termo de `suiteFull` (`.opencode/plugins/__tests__/*.spec.mjs`) estoura `ENOENT` se a remoção e o reapontamento forem faseados.

## 3. Escopo (os 16 itens de interface do ADR-001)

Os itens 1–16 do `ADR.md` §3 são requisitos normativos deste ciclo. Nada além deles.

## 4. Não-escopo

- `planner` (ADR-003), `prd-adr-pipeline` como módulo (ADR-002), inventário derivado (ADR-004), prosa órfã (ADR-005)
- formato V2 de registro de agente (`agents`/`system`/`permissions`) — risco R3 declarado, não decidido
- `gate.js`, `harness.config.json` e `commands.suiteFull`: **byte-idênticos** (itens 14 e 15)
- `workflow-state.json` e `harness/opencode-v2-only.json`: registros históricos, **mantidos** (item 13)

## 5. Riscos

| # | Risco | Mitigação |
|---|---|---|
| P1 | Remoção faseada quebra `suiteFull` (`ENOENT`) | implementação em um único commit |
| P2 | Itens 9 e 10 tocam `.agents/rules/**` (protectedPaths) | trailer `Harness-Gate-Change` no commit (`FU-66`) |
| P3 | `KNOWN_AGENTS` do gate cobre 6 nomes e o roster tem 9 (`FU-65`) | declarado; não é regressão deste ciclo |
| P4 | Fusão torna a análise arquitetural gravável por runtime (C3) | declarado e aceito no G2 |
| P5 | Selo `HARNESS_SEAL_JSON` publicado divergir | `suiteFull` intocado (item 15) — provado por `git diff` |

## 6. Delta Specs

Nenhum documento em `.doc/` é alterado. As rules tocadas são reapontamento de referência, não mudança de política: `workflow-rules.md` (1 linha), `sdd-workflow-standard.md` (1 linha), `gate-contract.md` (1 linha, contagem I5).

## 7. Verificação

`node --test ".opencode/plugins/__tests__/*.spec.mjs"` + `node scripts/static-checks.mjs` + `node scripts/sdd-checks.mjs` + suíte do instalador + `vendor-skills --check`, todas exit 0; e os comandos de aceite de cada item do `ADR.md` §7.
