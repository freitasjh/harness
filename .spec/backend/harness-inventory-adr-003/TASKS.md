# TASKS — harness-inventory-adr-003

> Execução do ADR-003 na branch `adr/prd-harness-inventory/03-agente-planner` (base `5c9bbc0`).

## Microtasks (TDD-ready)

### PL-01
- [x] Criar `.agents/agents/planner/AGENT.md` ≤ 60 linhas: papel, 4 artefatos, 4 "não faz" (product-manager, architect, sdd-compiler, dev-planner), skill `dev-planner` como metodologia, 0 `Fase N —`, 0 `websearch` (RF-03).

### PL-02
- [x] Registrar `planner` em `opencode.json`: shape legado homogêneo, `mode: "subagent"`, `description` com as 4 fronteiras, `permission.edit: "allow"` (RF-01, RF-02).

### PL-03
- [x] `.agents/rules/sdd-workflow-standard.md:50` → `planner` + `Fase 5 — Valide`; `.agents/agents/qa-engineer/AGENT.md:9` → `orchestrator`; `grep -rn "planejador" .agents/` = 0 (RF-05, E1).

### PL-04
- [x] Remover as 2 ocorrências de `PLAN.md` da skill `dev-planner` (`:139`, `:161`) e declarar o `sdd-compiler` como autor (RF-04, I2, E2).

### PL-05
- [x] `config-dual-parity.spec.mjs:124-137`: ROSTER literal ganha `planner` (10 nomes) (RF-08, E3).

### PL-06
- [x] Commit com trailer `Harness-Gate-Change` (`.agents/rules/**` protegido) (RF-09).

### PL-07
- [x] Verificação final: 5 comandos de suíte exit 0; `git diff --stat` de `gate.js`/`harness.config.json`/`installer/` vazio; `grep -c planner gate.js` = 0; `KNOWN_AGENTS` mantém `planner` em `unknown` (RF-06, RF-07, RF-09).

## Sumário de execução

| Task | Fase | Depende de |
|---|---|---|
| PL-01 | 1 | — |
| PL-02 | 1 | PL-01 |
| PL-03 | 2 | PL-01 |
| PL-04 | 3 | — |
| PL-05 | 4 | PL-02 |
| PL-06 | 5 | PL-01..PL-05 |
| PL-07 | 5 | PL-06 |

## Saída literal da suíte

Branch `adr/prd-harness-inventory/03-agente-planner`, 2026-11-11.

```text
$ node --test ".opencode/plugins/__tests__/*.spec.mjs"
ℹ tests 379
ℹ suites 94
ℹ pass 379
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
$ echo $?
0

$ node --test "installer/__tests__/*.spec.mjs"
ℹ tests 559
ℹ suites 183
ℹ pass 559
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
$ echo $?
0

$ node scripts/static-checks.mjs
PASS V6: harness.config.json: valid JSON
PASS V6b: harness-report.schema.json: valid JSON
PASS V2: permission.ask=0
PASS V3: hardcoded-project-literals=0
PASS V7: scalar-output-system=0
PASS V15: rede em installer/=0
INFO V12: harness-continuous.md orphan refs=0 (fusion landed DOC-02; enforced as FAIL R-V12 in scripts/sdd-checks.mjs)
PASS V14: git+remote+CI present
PASS PRD-01: PRD.md com as 7 seções obrigatórias conformes
PASS ADR-01: ADR-INDEX.md 1:1 com ADRs/<dir>/ (sem órfãos)
PASS ADR-02: ADR-INDEX.md: sequência e branch conformes
INFO LEGACY: FIX-01 done, baseline 0 (not green, history only): hardcode=0 scalar-assign=0
$ echo $?
0

$ node scripts/sdd-checks.mjs
PASS V4: rules lines=1291 (budget 1705)
PASS R-V12: orphan refs=0
PASS V17: canonical vocab + conversion table present
PASS SDD-01: refs-ok=true non-bypass=true no-orphan-promise=true
PASS SDD-02: cycle=.spec/backend/harness-inventory-adr-002 (via state.artifacts.verify) artifacts 4/4, tasks sections=10 declared=10
PASS SDD-03: state.gates P1_P2=approved_user_2026_11_11 (SPEC 49 linhas, 12 RF mapeados aos 16 itens do ADR-001, 6 invariantes) P2_P3=approved_user_2026_11_11 (PLAN 57 linhas, TASKS 12 microtasks RV-01..RV-12) convention-doc=true
PASS R-NODENY: gate.js has no artifact-gate deny
PASS RENAME-01: old-name hits=0
$ echo $?
0

$ node scripts/vendor-skills.mjs --check
vendor-check OK (.agents/skills/.vendor-lock.json)
$ echo $?
0
```
