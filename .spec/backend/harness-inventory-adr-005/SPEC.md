# SPEC — harness-inventory-adr-005

> Prescritivo. Origem: `ADR-005` §3 (14 itens). Em conflito, o ADR prevalece. Tipo: refactor de documentação normativa + mecanismo de detecção.

## 1. Requisitos funcionais

- **RF-01 (itens 1–3)** — `.opencode/plugins/lib/refs/checks.mjs` existe, puro (`node:fs`/`node:path` read-only, sem rede/child/escrita), exporta `runRefsChecks(root)` devolvendo `{ ok, results: [{ id, status, detail }] }`.
- **RF-02 (item 4)** — `BASELINE` contém exatamente **7** entradas (2 `live-orphan` + 5 `foreign-baseline`), cada uma com `path`, `class`, `reason`, `owner`; `NON_DEFECT` contém **1** (`exemplo.md`), com `reason` e `proof`.
- **RF-03 (itens 5–7)** — o check falha em **2 modos**: (a) referência viva a path ausente **fora** do `BASELINE`; (b) entrada do `BASELINE` que **deixou** de ser ausente (baseline obsoleto). Nenhum dos dois pode passar verde.
- **RF-04 (item 8)** — predicado de escopo exato: vivo = citante casa `^(\.agents/|opencode\.json$)`; `docs/`, `harness/`, `.spec/` são registro e não entram. Provado por fixture com o **mesmo** texto nos dois lados.
- **RF-05 (itens 9–11)** — `refs.spec.mjs` com ≥3 fixtures de escopo e ≥2 de falha de baseline; `node --test` verde.
- **RF-06 (item 12)** — adapter `V18` em `scripts/static-checks.mjs`: um `record("V18", …)`, **sem** comando novo em `commands.suiteFull` e sem alterar `harness.config.json`.
- **RF-07 (item 13)** — as 5 decisões de autor único, uma por path: `PLAN.md` → `sdd-compiler`; template de ADR na skill → `architect`; `EXPLORATION.md` → `planner`; tabela de delegação → roster (com `planner`); gatilho da Fase 0 → lista de isenção.
- **RF-08 (item 14)** — suíte completa verde; `git diff --stat` de `harness.config.json` vazio; selo não republicado.

## 2. Invariantes

- **I1** — o check **não escreve**: só lê árvore e reporta (mesma classe de pureza de `lib/prd-adr-pipeline/checks.mjs`).
- **I2** — `BASELINE` é **dívida declarada**, não permissão: cada entrada nomeia dono e condição de saída.
- **I3** — escopo por **path do citante**, nunca por conteúdo nem por data.
- **I4** — nenhuma rule nova é criada neste ciclo (as 8 acionáveis são PRD-2).
- **I5** — as 5 decisões de autor único mudam **quem**, não **o que**: nenhum artefato novo, nenhum path novo.

## 3. Edge cases

- E1 — a própria `workflow-rules.md` cita `.doc/*`; se o predicado fosse por conteúdo, ela entraria como violação e o check nasceria vermelho.
- E2 — `security-standard.md` é `live-orphan` **e** a mais citada: entra no baseline com dono PRD-2, não é "corrigida" criando uma rule vazia.
- E3 — `AGENTS.md` citado por 16 arquivos é `declared-non-defect` (convenção do tooling de agentes), não órfão.
- E4 — baseline que não encolhe nunca é dívida: o modo (b) existe para impedir isso.

## 4. Estratégia de teste

| Nível | Comando | Esperado |
|---|---|---|
| Unit (refs) | `node --test ".opencode/plugins/__tests__/refs.spec.mjs"` | 0 falhas |
| Plugins | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 0 falhas |
| Instalador | `node --test "installer/__tests__/*.spec.mjs"` | 559 pass |
| Static (V18 incluído) | `node scripts/static-checks.mjs` | exit 0 |
| SDD | `node scripts/sdd-checks.mjs` | 0 FAIL |

## 5. N/A declarado

Sem backend Java, frontend, DB, endpoint ou auth neste repo: as rules `backend-*`/`frontend-*` não se aplicam — e é exatamente essa a classe `foreign-baseline` que o ADR classifica.
