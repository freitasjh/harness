# PLAN — prd-agnostic-artifacts-adr-002

> Execução do ADR-002 na branch `adr/prd-agnostic-artifacts/02-entradas-sempre-instaladas` (base `b2d6bce`).

## 1. Fases

### Fase 1 — Permissão resolvida (RF-01, RF-02, RF-09)
1. `opencode.json`: `agent.orchestrator.permission.edit = { "*": "deny", ".spec/**": "allow" }` (**não** `agents.*`, **não** `permissions`).
2. `config-dual-parity.spec.mjs`: atualizar `:152-160` para asserir **resolução** (índice do `deny` < índice do `allow`), + 2 fixtures vermelhas (invertido; `agents.*` sem `prompt`).
3. Prova descartável de escrita: `.spec/**` grava, `.agents/**` negado; worktree limpo ao fim.

### Fase 2 — Prosa condicional (RF-03, RF-05)
4. `workflow-rules.md`: 4 linhas genéricas (`:217,:218,:219,:225`) passam a citar `commands.*` do `harness.config.json`.
5. Headings `:431`, `:438`, `:444` nomeiam o eixo (`Backend (Java)`, `Frontend (Vue/React)`).
6. Tabela `:558-563`: células ganham `` (`backend=java`) `` etc.
7. **Preservar contagem** (608 linhas, 11 hunks, 20/20) — nada desloca as 9 entradas do ADR-005.

### Fase 3 — Identidade (RF-06, RF-07)
8. `sdd-workflow-standard.md:3` → escopo ("no repositório que adota este harness").
9. `PROJECT_TERMS["Atlas ECM"].proof` re-apontado para `frontend-coding-standards.md:154`.
10. `:16-18` nomeiam a sessão que escreve (RF-07).

### Fase 4 — Baseline e verificação (RF-04, RF-08, RF-10)
11. Remover as 16 entradas correspondentes da `BASELINE` (15 + 1) e provar `baseline=80` com as 27 chaves vizinhas iguais.
12. 5 comandos + `opencode debug config`; `git diff` de `installer/`/`seal.mjs` vazio; trailer `Harness-Gate-Change`.

## 2. Constraint mapping

| Constraint | Onde |
|---|---|
| Permissão por resolução (I1) | Fase 1 |
| Baseline só encolhe (I2) | Fase 4 |
| Contagem preservada (I3) | Fase 2 |
| Zero comando novo (I4) | Fase 4 |
| `bash` é evasão declarada (I5) | não corrigir |

## 3. Caminho crítico

`F1.1 → F1.2 → F4.12` — config sem teste atualizado deixa `suiteFull` vermelho.

## 4. Rollback

`git reset --hard b2d6bce`.
