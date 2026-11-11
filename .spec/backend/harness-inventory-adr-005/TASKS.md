# TASKS — harness-inventory-adr-005

> Execução do ADR-005 na branch `adr/prd-harness-inventory/05-prosa-orfa` (base `32c469d`).

## Microtasks (TDD-ready)

### PO-01
- [x] Criar `.opencode/plugins/lib/refs/checks.mjs` puro com `runRefsChecks(root)`, `BASELINE` (7 entradas com `path`/`class`/`reason`/`owner`) e `NON_DEFECT` (`exemplo.md` com `reason`+`proof`) (RF-01, RF-02, I1, I2).

### PO-02
- [x] Implementar o modo (a): referência viva a path ausente **fora** do baseline ⇒ `FAIL` com path + citante (RF-03, I3).

### PO-03
- [x] Implementar o modo (b): entrada do `BASELINE` que deixou de ser ausente ⇒ `FAIL baseline-stale` (RF-03, E4).

### PO-04
- [x] `refs.spec.mjs`: fixtures de escopo (mesmo texto em `.agents/` e `docs/`), vendor-internal, `NON_DEFECT`, novo órfão e baseline obsoleto (RF-05, E1).

### PO-05
- [x] Adapter `V18` em `scripts/static-checks.mjs`; nenhum comando novo em `commands.suiteFull` (RF-06, R3).

### PO-06
- [x] `dev-planner/workflow.md`: remover `PLAN` do diagrama (`:20-21`), de `:420` e `:434`; `:408` vira handoff ao `sdd-compiler` (RF-07, I5).

### PO-07
- [x] `dev-planner/workflow.md`: o "template de ADR" (`:199-225`) vira alternativas + trade-off + recomendação, sem `## ADR-00N` e sem `### Status` (RF-07, I5).

### PO-08
- [x] `orchestrator/AGENT.md`: `:285` sem gerar `EXPLORATION.md`; tabela de delegação (`:565-580`) com a linha `planner` (RF-07, I5).

### PO-09
- [x] `workflow-rules.md`: gatilho da Fase 0 alinhado à lista de isenção (sem "complexas/inovações" nem "Feature simples" como critérios concorrentes) (RF-07, I5).

### PO-10
- [x] Commit com trailer `Harness-Gate-Change` (`.agents/rules/**` e `.agents/agents/**` são protegidos) (RF-07, R4).

### PO-11
- [x] Verificação final: 5 comandos exit 0; `V18` no static; `git diff --stat` de `harness.config.json` vazio; selo não republicado (RF-08).

## Sumário de execução

| Task | Fase | Depende de |
|---|---|---|
| PO-01 | 1 | — |
| PO-02 | 1 | PO-01 |
| PO-03 | 1 | PO-01 |
| PO-04 | 2 | PO-02, PO-03 |
| PO-05 | 3 | PO-04 |
| PO-06 | 4 | — |
| PO-07 | 4 | — |
| PO-08 | 4 | — |
| PO-09 | 4 | — |
| PO-10 | 4 | PO-01..PO-09 |
| PO-11 | 5 | PO-10 |

## Execução (2026-11-11) — saída literal

Comandos do aceite, `commands.suiteFull` seguido do SDD:

```
$ node --test ".opencode/plugins/__tests__/*.spec.mjs"
ℹ tests 402
ℹ suites 101
ℹ pass 402
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0

$ node --test "installer/__tests__/*.spec.mjs"
ℹ tests 559
ℹ suites 183
ℹ pass 559
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0

$ node scripts/static-checks.mjs
PASS V6: harness.config.json: valid JSON
PASS V6b: harness-report.schema.json: valid JSON
PASS V2: permission.ask=0
PASS V3: hardcoded-project-literals=0
PASS V7: scalar-output-system=0
PASS V15: rede em installer/=0
INFO V12: harness-continuous.md orphan refs=0 (fusion landed DOC-02; enforced as FAIL R-V12 in scripts/sdd-checks.mjs)
PASS V14: git+remote+CI present
PASS V18: refs vivas: missing-and-unclassified=ok, stale-baseline-entry=ok, baseline-entry-incomplete=ok, nondefect-entry-incomplete=ok (baseline=7, non-defect=1)
PASS PRD-01: PRD.md com as 7 seções obrigatórias conformes
PASS ADR-01: ADR-INDEX.md 1:1 com ADRs/<dir>/ (sem órfãos)
PASS ADR-02: ADR-INDEX.md: sequência e branch conformes
INFO LEGACY: FIX-01 done, baseline 0 (not green, history only): hardcode=0 scalar-assign=0
exit 0

$ node scripts/vendor-skills.mjs --check
vendor-check OK (.agents/skills/.vendor-lock.json)
exit 0

$ node scripts/sdd-checks.mjs
PASS V4: rules lines=1286 (budget 1705)
PASS R-V12: orphan refs=0
PASS V17: canonical vocab + conversion table present
PASS SDD-01: refs-ok=true non-bypass=true no-orphan-promise=true
PASS SDD-02: ...
PASS SDD-03: ...
PASS R-NODENY: gate.js has no artifact-gate deny
PASS RENAME-01: old-name hits=0
0 FAIL, exit 0
```

Prova de que o check morde (árvores descartáveis em `/tmp`, não no repo):

```
# (a) uma órfã nova em .agents/rules/** — fixture com a baseline intacta
FAIL V18: missing-and-unclassified: 1 path(s) ausente(s) citado(s) por prosa viva fora da BASELINE: rules/nao-classificada.md ← .agents/rules/novo-orfao.md:1
ok=false

# (b) baseline obsoleto — o path da BASELINE passou a existir no disco
FAIL V18: stale-baseline-entry: BASELINE com 1 entrada(s) obsoleta(s): rules/security-standard.md (o arquivo passou a existir no disco)
ok=false
```

Inventário dos 13 paths ausentes, classificado pelo mecanismo (0 não classificadas):

| Classe | Paths | N |
|---|---|---|
| C1 `live-orphan` (BASELINE) | `security-standard.md`, `unit-testing-standards.md` | 2 |
| C2 `foreign-baseline` (BASELINE) | `backend-coding-standards`, `backend-integration-tests`, `backend-unit-tests`, `db-migration-flyway`, `db-migration-liquibase` | 5 |
| C3 `declared-non-defect` (NON_DEFECT) | `exemplo.md` | 1 |
| C4 `vendor-internal` (lock) | `arch-avoid-circular-deps`, `area-description`, `async-parallel`, `bundle-barrel-imports`, `security-validate-all-input` | 5 |

## Nota de correção (divergência medida)

- **N1 — o item 8 do ADR subestimou os sítios:** `grep -rn "PLAN" .agents/skills/dev-planner/`
  media **5** hits no disco (`workflow.md:20,420,434` + `SKILL.md:144,149`), não 3 como
  o ADR registrou. Os 2 de `SKILL.md` atribuíam corretamente os artefatos ao
  `sdd-compiler`, mas a verificação literal do item 8 (`grep -rc "PLAN" … ⇒ vazio`) não
  distinguia atribuição de autoria. Ambos foram reescritos sem o token (`SPEC →
  planejamento → TASKS` / "plano de implementação"), preservando o autor `sdd-compiler`;
  o item 8 fecha em 0 sem perder a atribuição. Nenhum outro comando do ADR mudou.

## Correções do code review (F1–F6) — 2026-11-11

| Item | Antes (medido) | Depois (medido) |
|---|---|---|
| **F1** — `PLAN` com 2º autor vivo | `grep -rn "SPEC, PLAN, TASKS" .agents/` ⇒ **3** hits: `workflow-rules.md:91` (orchestrator como autor), `:161` (rótulo de fase), `developer-engineer/AGENT.md:103` | a célula do orchestrator passa a nomear o que ele faz (triagem, governança, delegação, `workflow-state.json`, code review, brain); `:161` vira `SPEC → PLAN → TASKS` (rótulo, não autoria); `:103` nomeia `SPEC.md`/`PLAN.md`/`TASKS.md` com autor `sdd-compiler`/`planner`. `grep` ⇒ **vazio** |
| **F2** — tabela §0.1 com 7 de 10 | set-diff roster − §0.1 ⇒ `design-system-specialist`, `planner`, `ux-designer` | 10/10; set-diff ⇒ **vazio** |
| **F3** — item 11 media sopa de tokens | `grep -oE '`[a-z-]+`'` na seção inteira; controle negativo (papel fora da coluna `Subagente`, token na coluna de skills) ⇒ **falso verde** | `awk -F'|'` na coluna `Subagente`; o mesmo controle negativo ⇒ detecta `planner` |
| **F4** — `NON_DEFECT` sem modo `stale` | 4 ids; só `NON_DEFECT[0]` tinha a prova verificada (no teste) | 5º id `stale-nondefect-entry` (path existente, proof ausente/fora do arquivo, linha que não cita o path), verificado em **todas** as entradas; 4 fixtures novas |
| **F5** — baseline viva por citação vendorizada | silenciosa | limite declarado no cabeçalho do módulo + detalhe `sustentadas só por citação vendorizada=N` em `stale-baseline-entry` (não falha). Medido no repo: **0** |
| **F6** — SPEC RF-02 omitia `prd` | `path`, `class`, `reason`, `owner` | `path/class/reason/owner/prd` (alinhada ao `validateBaseline`) |

O modo novo morde — árvores descartáveis em `/tmp`, via o adapter selado:

```
(c1) path da lista passou a existir: FAIL stale-nondefect-entry: NON_DEFECT com 1 entrada(s) obsoleta(s): rules/exemplo.md (o arquivo passou a existir no disco)
(c2) proof com a linha fora do arquivo: FAIL stale-nondefect-entry: NON_DEFECT com 1 entrada(s) obsoleta(s): rules/exemplo.md (proof .agents/skills/harness-installer/SKILL.md:68 fora do arquivo: 3 linha(s))
(c3) proof existe mas não cita o path: FAIL stale-nondefect-entry: NON_DEFECT com 1 entrada(s) obsoleta(s): rules/exemplo.md (proof .agents/skills/harness-installer/SKILL.md:68 não cita o path)
(c4) proof ausente no disco: FAIL stale-nondefect-entry: NON_DEFECT com 1 entrada(s) obsoleta(s): rules/exemplo.md (proof ausente no disco: .agents/skills/harness-installer/SKILL.md)
FAIL V18: stale-nondefect-entry: NON_DEFECT com 1 entrada(s) obsoleta(s): rules/exemplo.md (o arquivo passou a existir no disco)
```

Controle negativo de F3 (a mesma tabela com o papel fora da coluna e o token na coluna de skills):

```
$ # predicado antigo (sopa de tokens)
$ comm -23 <(roster − orchestrator) <(sed … | grep -oE '`[a-z-]+`' | sort -u)
(exit 0, saída vazia)          # FALSO VERDE: `planner` só aparece na coluna de skills

$ # predicado novo (coluna Subagente)
$ comm -3 <(roster − orchestrator) <(sed … | awk -F'|' '{ c=$3; … gsub(/[^a-z0-9-]/,"",c); print c }' | sort -u)
planner                        # detecta a ausência na coluna que importa
```

Saída literal das 5 suítes depois das correções:

```
$ node --test ".opencode/plugins/__tests__/*.spec.mjs"
ℹ tests 409
ℹ suites 103
ℹ pass 409
ℹ fail 0

$ node --test "installer/__tests__/*.spec.mjs"
ℹ tests 559
ℹ suites 183
ℹ pass 559
ℹ fail 0

$ node scripts/static-checks.mjs
PASS V18: refs vivas: missing-and-unclassified=ok, stale-baseline-entry=ok, baseline-entry-incomplete=ok, nondefect-entry-incomplete=ok, stale-nondefect-entry=ok (baseline=7, non-defect=1)
exit 0

$ node scripts/vendor-skills.mjs --check
vendor-check OK (.agents/skills/.vendor-lock.json)
exit 0

$ node scripts/sdd-checks.mjs
PASS V4: rules lines=1289 (budget 1705)
0 FAIL, exit 0
```
