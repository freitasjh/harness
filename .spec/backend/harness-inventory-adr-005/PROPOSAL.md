# PROPOSAL — harness-inventory-adr-005

> Ciclo SDD escopado do **ADR-005 do PRD-1** (`prd-harness-inventory`), que absorveu o escopo deferido do ADR-003 (§10).
> Fonte: `.spec/prd/prd-harness-inventory/ADRs/ADR-005-prosa-orfa/ADR.md` (313 linhas, rubric de 6 classes, 26 instâncias, 14 itens congelados, G2 aprovado 2026-11-11).

## 1. Problema (medido 2026-11-11)

| Fato | Número |
|---|---|
| Paths de `rules/*.md` citados e ausentes | **13** de 20 citados (52 citações) |
| Dos 13, `live-orphan` (citados por artefato vivo) | **2** — sendo `security-standard.md` a **SSoT declarada de segurança** (8 citações, 5 arquivos) |
| Dos 13, `foreign-baseline` (Java que este repo não tem) | **5** (36 citações em 31 arquivos) |
| `vendor-internal` (upstream) | **5** |
| Outros citados e ausentes | 3 `.doc/`, `frontend/DESIGN.md`, `AGENTS.md` (convenção) |
| Colisões de autoria herdadas do ADR-003 | **5** (`PLAN.md`, template de ADR na skill, `EXPLORATION.md`, tabela de delegação, gatilho da Fase 0) |

Consequência: o harness manda agentes obedecerem documentos que não existem, e dois papéis escrevem o mesmo path. Nada disso é detectado por suite: 938 testes verdes convivem com 13 referências mortas.

## 2. Proposta

Materializar a rubric em **mecanismo**: um módulo puro de checks (`refs/checks.mjs`) com `BASELINE` (as instâncias toleradas, com motivo) e `NON_DEFECT` (as convenções), um adapter `V18` no `static-checks` (sem comando novo — selo intacto), fixtures que provam o predicado de escopo, e as 5 decisões de autor único aplicadas nos arquivos vivos.

## 3. Escopo

Os 14 itens de interface do `ADR.md` §3.

## 4. Não-escopo

- **Escrever o texto** das 8 rules acionáveis (PRD-2) — aqui só se classifica e se cria o detector
- Remoção das 5 `foreign-baseline` (PRD-2, com condição de reativação em PRD-3/4)
- Inventário derivado (ADR-004), `KNOWN_AGENTS` (FU-65), agnosticização (PRD-2)

## 5. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | `BASELINE` virar cemitério: tudo entra e o check nunca falha | 2 modos de falha no spec: referência nova fora do baseline **e** baseline obsoleto |
| R2 | Adapter V18 alargar o escopo do check e pegar prosa legítima | predicado de escopo `^(\.agents/\|opencode\.json$)` provado por fixture |
| R3 | Selo republicado por engano | nenhum comando novo em `commands.suiteFull` |
| R4 | As 5 decisões de autor único mexerem em política | `.agents/rules/**` protegido ⇒ trailer `Harness-Gate-Change` |

## 6. Verificação

5 comandos de suíte + os comandos de aceite do ADR; `git diff` de `harness.config.json` vazio.
