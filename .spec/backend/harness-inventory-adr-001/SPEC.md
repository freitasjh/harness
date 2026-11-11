# SPEC — harness-inventory-adr-001

> Prescritivo. Origem normativa: `ADR-001-roster-de-agentes/ADR.md` §3 (16 itens). Em conflito, o `ADR.md` prevalece.
> Tipo: refactor de roster. Sem runtime novo, sem gate novo, sem dependência nova.

## 1. Requisitos funcionais

- **RF-01 (ADR item 1)** — `opencode.json.agent` contém exatamente as 9 chaves: `orchestrator`, `developer-engineer`, `product-manager`, `qa-engineer`, `architect`, `security-engineer`, `code-reviewer`, `ux-designer`, `design-system-specialist`. Zero adição; exatamente 1 `primary`. *Aceite*: `node -e` lê o objeto e compara o conjunto ordenado.
- **RF-02 (item 2)** — Registro↔disco 1:1: `ls -d .agents/agents/*/` produz o mesmo conjunto de 9. *Aceite*: diferença de conjuntos = vazia.
- **RF-03 (item 3)** — `.agents/agents/sdd-orquestrador/` não existe, com os 3 arquivos removidos (`AGENT.md`, `gemini.yaml`, `opencode.yaml`). *Aceite*: `test ! -e`.
- **RF-04 (item 4)** — `architect/AGENT.md` contém `### Modo análise (absorvido de codebase-analyzer)` e os 4 sub-marcadores literais do ADR; `architect` mantém `edit: allow` em `opencode.json`. `.agents/agents/codebase-analyzer/` não existe.
- **RF-05 (item 5)** — `.agents/agents/code-reviewer/AGENT.md` não existe; `.agents/agents/code-reviewer/PROMPT.md` existe e continua sendo o alvo do registro.
- **RF-06 (item 6)** — `scripts/sdd-checks.mjs` não contém `sdd-orquestrador`: `grep -c "sdd-orquestrador" scripts/sdd-checks.mjs` = 0, e o path lido é `orchestrator/AGENT.md` nas duas ocorrências funcionais (`:132`, `:384`) e no rótulo (`:383`).
- **RF-07 (item 7)** — `orchestrator/AGENT.md` passa a conter os 3 marcadores que hoje só existem no agente removido: cláusula `NÃO-BYPASS` citando `gate-contract.md`, `gates.P1_P2`, `gates.P2_P3`. *Aceite*: 3/3 presentes, 0/3 no arquivo removido (que também não existe mais).
- **RF-08 (item 8)** — `.opencode/plugins/__tests__/sdd-checks.spec.mjs` sem a constante `SDD_ORCH`; os 7 usos apontam para `ORCH`. *Aceite*: `grep -c SDD_ORCH` = 0 e o teste passa.
- **RF-09 (items 9, 10, 11)** — reapontamentos de referência: `.agents/rules/workflow-rules.md:87`, `.agents/rules/sdd-workflow-standard.md:42` → `orchestrator`; `.agents/rules/gate-contract.md:18` I5 passa de **6** para **5** agentes sem `edit` (sai `codebase-analyzer`); `.agents/skills/prompt-optimizer/SKILL.md:171` → só `orchestrator/AGENT.md`. *Aceite*: `grep -rc sdd-orquestrador` = 0 nesses 4 arquivos.
- **RF-10 (item 12)** — `docs/FUNCIONAMENTO.md`: `:542` e `:675` reapontados, `:624` removido, `:682` **mantido** (registro datado). *Aceite*: sobra exatamente 1 ocorrência.
- **RF-11 (item 13)** — `workflow-state.json` e `harness/opencode-v2-only.json` sem edição de conteúdo histórico: `git diff` desses arquivos não remove/reescreve ocorrências de `sdd-orquestrador`.
- **RF-12 (items 14, 15, 16)** — `gate.js` e `commands.suiteFull` byte-idênticos; suíte completa verde.

## 2. Invariantes

- **I1** — nenhum arquivo de `.opencode/plugins/lib/**`, `gate.js`, `harness.config.json` é editado (protegidos por contrato, não por permissão de agente).
- **I2** — os itens 9 e 10 são os únicos a tocar `.agents/rules/**`; o commit leva trailer `Harness-Gate-Change` com motivo.
- **I3** — nenhuma referência é apontada para arquivo inexistente (a nova referência é `orchestrator/AGENT.md`, que existe).
- **I4** — nenhuma policy muda: só caminho de referência e 1 contagem (I5 6→5).
- **I5** — o roster final não abre escrita nova: o conjunto `edit: allow` continua **exatamente** `developer-engineer`, `product-manager`, `qa-engineer`, `architect` (4 nomes; o `architect` já era `allow` e apenas absorve a capacidade do `codebase-analyzer`).
- **I6** — `sdd-checks.mjs` continua lendo um arquivo existente (fail-closed implícito: se `existsSync` falhar, `SDD-01` reprova).

## 3. Edge cases

- E1 — `opencode.yaml` do agente removido **não** contém o próprio nome: qualquer verificação por `grep` é insuficiente para provar a remoção do diretório; usar `test -e`.
- E2 — `docs/FUNCIONAMENTO.md:682` é registro histórico; editar ali é falsificar evidência.
- E3 — `harness/opencode-v2-only.json` carrega `gitSha` de ciclo arquivado; é artefato de evidência, não estado.
- E4 — `scripts/sdd-checks.mjs` é lido pelo CI (`.github/workflows/harness-integrity.yml:32`); a remoção do agente e o reapontamento precisam estar no mesmo commit, senão o CI fica vermelho num estado intermediário.

## 4. Estratégia de teste

| Nível | Comando | Esperado |
|---|---|---|
| Unit (plugins) | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 0 falhas |
| Static | `node scripts/static-checks.mjs` | exit 0 |
| SDD | `node scripts/sdd-checks.mjs` | 0 FAIL |
| Instalador | suíte de `installer/__tests__` | 0 falhas |
| Vendor | `node scripts/vendor-skills.mjs --check` | OK |

## 5. N/A declarado

Sem backend Java, sem frontend, sem DB, sem endpoint, sem auth: os requisitos de `.agents/rules/backend-*` e `frontend-*` não se aplicam a este ciclo (mesma justificativa de `harness.config.json.stack`).
