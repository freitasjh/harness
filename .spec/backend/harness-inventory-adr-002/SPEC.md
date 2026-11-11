# SPEC — harness-inventory-adr-002

> Prescritivo. Origem: `ADR-002` §3 (12 itens). Em conflito, o `ADR.md` prevalece. Tipo: refactor de empacotamento.

## 1. Requisitos funcionais

- **RF-01 (item 1)** — o repo-destino recebe **5/5** arquivos em `.opencode/plugins/lib/prd-adr-pipeline/` (1 `checks.mjs` + 4 templates) e **0** em `.agents/skills/prd-adr-pipeline/`, em todo eixo instalável. *Aceite*: `collectIncoming()` nos 4 stacks + instalação real em `/tmp` com `find | wc -l` = 5; `__tests__` **não** entregues.
- **RF-02 (item 2)** — `.agents/skills/` uniforme: 48 diretórios, **48 com `SKILL.md`, 0 sem**; `.agents/skills/prd-adr-pipeline/` não existe.
- **RF-03 (item 3)** — os 2 imports apontam para o path novo: `scripts/static-checks.mjs:28` e `.opencode/plugins/__tests__/prd-checks.spec.mjs:29`. `grep -rn "skills/prd-adr-pipeline" --include=*.mjs` = **0**.
- **RF-04 (item 4)** — os 4 paths de template do spec (`prd-checks.spec.mjs:1125-1129`) derivam de `LIB`, não de `SKILLS`.
- **RF-05 (item 5)** — o guard de pureza (`prd-checks.spec.mjs:915-923`) relê o módulo no path novo; specifiers estáticos = `{node:fs, node:path}`.
- **RF-06 (item 6)** — prosa expirada morta: `grep -c "only path the installer propagates"` = 0 em `checks.mjs` e em `scripts/static-checks.mjs`.
- **RF-07 (item 7)** — `SKILLS_COMMON` passa de 23 para **22** entradas (medido; o ADR previu 24→23 — ver N11); `realLocalSkills()` = 24→23; enumeração bidirecional verde; os 3 guardas recomputados do disco, **0 literais** `24`/`prd-adr-pipeline` em `installer/__tests__/**`; 559 testes pass.
- **RF-08 (item 8)** — `RULES_COMMON` **mantém** `'prd-adr-pipeline.md'`; `grep -c "prd-adr-pipeline" installer/install.mjs` = **1**.
- **RF-09 (item 9)** — `orchestrator/AGENT.md:273` reapontado; `product-manager/AGENT.md:10` e `architect/AGENT.md:11` **inalterados** (já citam a rule).
- **RF-10 (item 10)** — as 2 rules com o path novo ficam ≤80 linhas cada (hoje 79) e o total ≤1705 (hoje 1290); trailer `Harness-Gate-Change` no commit.
- **RF-11 (item 11)** — `gate.js` e `harness.config.json` byte-idênticos; selo **não** republicado; `V2`/`V3`/`V7` em 0 com `lib/` em `SCAN_DIRS`.
- **RF-12 (item 12)** — suíte completa (4 comandos) + `sdd-checks` sem FAIL.

## 2. Invariantes

- **I1** — nenhum arquivo é **copiado**: são `git mv`, preservando o histórico do `checks.mjs`.
- **I2** — a norma continua em **um** lugar (`.agents/rules/prd-adr-pipeline.md`); o módulo não ganha prosa normativa nova.
- **I3** — `checks.mjs` continua puro: `node:fs`/`node:path`, sem rede, sem child process, sem escrita.
- **I4** — nenhum comando novo em `commands.suiteFull` (selo é trust root).
- **I5** — o gate por eixo continua decidindo o que vai ao destino: nada entra por "path novo" sem passar por `collectIncoming`.

## 3. Edge cases

- E1 — `installer/install.mjs:419` e `:384` contêm a mesma string; só a primeira sai.
- E2 — `harness/prd-adr-pipeline.json`, `spec-developed.md` e `workflow-state.json` são registro histórico: **não** editar.
- E3 — `lib/` é varrido por `V2/V3/V7`; qualquer literal de projeto introduzido ali reprova o static check.
- E4 — o teste de pureza relê o arquivo por path; mover sem atualizar o guard deixa o teste cego (verde falso).

## 4. Estratégia de teste

| Nível | Comando | Esperado |
|---|---|---|
| Plugins | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 0 falhas |
| Instalador | `node --test "installer/__tests__/*.spec.mjs"` | 559 pass |
| Static | `node scripts/static-checks.mjs` | exit 0 |
| SDD | `node scripts/sdd-checks.mjs` | 0 FAIL |
| Vendor | `node scripts/vendor-skills.mjs --check` | OK |
| Propagação | `collectIncoming` em `java+vue`, `java+react`, `node`, `nestjs` + instalação real | 5/5 no path novo, 0 no antigo |

## 5. N/A declarado

Sem backend Java, frontend, DB, endpoint ou auth neste repo: as rules `backend-*`/`frontend-*` não se aplicam (mesma justificativa de `harness.config.json.stack`).
