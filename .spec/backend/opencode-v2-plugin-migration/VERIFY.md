# VERIFY: Migração Plugins Opencode v1 → v2 (dual-export)

> **ID**: `opencode-v2-plugin-migration`
> **Status**: `VERIFY`
> **Author**: qa-engineer (subagent)
> **Date**: 2026-10-15
> **Source**: `PROPOSAL.md` + `SPEC.md` + `PLAN.md` + `TASKS.md` (mesmo diretório)
> **Asserts**: `.agents/skills/sdd-compiler/asserts/verify-gate.md` (lido, 3 dimensões)
> **Tipo**: refactor — VERIFY apenas, sem edição de runtime
> **Role**: validador que barra archive incompleto

---

## 0. Comandos executados (evidência literal)

```
$ ls .opencode/plugins/ → gate.js, harness-validator.js, hitl-guardrail.js, lib/, __tests__/
$ ls .opencode/plugins/__tests__/ → 15 specs (6 baseline: gate, config-loader,
  seal, dogfood, sdd-checks, report-schema + 9 novas: v2-adapter-registration,
  v2-shims, v2-hook-no-equiv, smoke-load-v1v2, config-dual-parity,
  matrix-v1v2-parity, matrix-gate-absent, matrix-no-leak, prohibitions)

$ node --test ".opencode/plugins/__tests__/*.spec.mjs" 2>&1 | tail
  ℹ tests 216 / suites 43 / pass 216 / fail 0 / cancelled 0 / skipped 0 / todo 0

$ node scripts/static-checks.mjs 2>&1 | tail
  PASS V6, V6b, V2 (permission.ask=0), V3 (hardcoded=0), V7 (scalar=0),
  V15 (rede installer=0), V14 — INFO V12/V-LEGACY — EXIT:0

$ node --test config-dual-parity + config-loader → tests 25 / pass 25 / fail 0
$ node --test matrix-v1v2-parity + matrix-gate-absent + matrix-no-leak
  → tests 26 / pass 26 / fail 0

$ grep -rn "server:" .opencode/plugins/*.js | wc -l → 6
  (gate.js:1009,1010 + harness-validator.js:28,29 + hitl-guardrail.js:29,30 —
   2 por arquivo, dual-branch `Plugin.define(...) : {...}`)
$ grep -rn "setup" gate.js harness-validator.js hitl-guardrail.js | wc -l → 19
$ grep -c "DenyError" harness-validator.js hitl-guardrail.js → 0 / 0
$ grep -rn '"ask"' gate.js → só linha 1051 (V2_FORBIDDEN_HOOKS, asserção negativa)
$ grep -rn "output\.system\s*=" .opencode/plugins/*.js → vazio
$ grep -rn "TODO|FIXME|HACK" .opencode/plugins/*.js lib/*.mjs opencode.json → vazio
$ grep -c "\[ \]" TASKS.md → 67 ; grep -c "\[x\]" TASKS.md → 0

$ git status --porcelain → 9 modified (gate.js, 2 satélites, opencode.json,
  installer/* ×4, workflow-state.json) + 10 untracked (9 specs + .spec/ + log)
$ git diff --stat → 571 insertions, 49 deletions
$ baseline-suite.log (tail): registra suíte verde + nota de discrepância
  server-count (HEAD tinha 1, critério "3" inatingível sem violar constraint
  de não editar satélites) — load-bearing, declarado pelo implementador
```

---

## Dimensão 1: Completeness — 6/10 ⚠️

| Item (verify-gate) | Verdict | Evidência |
|---|---|---|
| PROPOSAL checkboxes cobertos | ✅ | §7 prescreve dual/smoke; implementado (dual-export 3/3, smoke+matriz verdes) |
| SPEC RF-01..RF-05 cobertos | ✅ | RF-01 adapter gate.js ✅ / RF-02 satélites ✅ / RF-03 config dual C1–C3 ✅ / RF-04 smoke+matriz ✅ / RF-05 proibições ✅ (greps + prohibitions.spec) |
| SPEC INV-01..INV-08 | ⚠️ parcial | INV-02/03/04/06/07/08 ✅ com teste; INV-01 **literal falhou** (6 ≠ 3, ver gap G1); INV-05 **letra falhou** (diff toca `gateShellHygiene`/`checkWriteAccess`/`loadWorkflowState`/`loadConfigOrDeny`, ver gap G2) |
| PLAN PL-01..PL-08 done | ✅ funcional / ❌ formal | Todos os artifacts existem (baseline.log, adapter+shims, smoke, satélites, config dual, parity, matriz, greps+static). **Mas 0/67 checkboxes marcados `[x]` em TASKS.md** → gap G3 |
| Batch 4 done | ➖ N/A justificado | "Batch 4" pertence a features arquivadas (`harness-installer-mobile`, `harness-brain-separation`); nenhum batch previsto para esta migração em PLAN §8 / TASKS.md. Sem tasks órfãs |
| TODOs pendentes | ✅ | grep TODO/FIXME/HACK vazio em plugins+lib+opencode.json |
| BDD cenários cobertos | ✅ | 3 cenários/task com specs (26 matriz + 25 loader + registration/shims/no-equiv/smoke/prohibitions, tudo dentro dos 216) |

**Gaps**: G1 (INV-01 literal 6≠3), G2 (INV-05/V2-VAL-04/V2-VAL-09 letra vs I10), G3 (67 checkboxes `[ ]`).

---

## Dimensão 2: Correctness — 8/10 ⚠️

| Item | Verdict | Evidência literal |
|---|---|---|
| Suite plugins 216/216 | ✅ | `pass 216 / fail 0` (43 suites) |
| static-checks PASS | ✅ | `EXIT:0`, V2=0 ask, V7=0 scalar, V3=0 literais |
| Matriz paridade v1×v2 | ✅ | 26/26 (deny PICCO, allow PICCO, deny `pkill -f`, fail-open, kill-switch, GATE-ABSENT 🟠, no-leak 🟡 nos dois entries) |
| Parity loader C1–C3 | ✅ | 25/25 (shape v1 × v2 × dual, precedência v2-vence) |
| Greps proibições H1/H2/H3/H5 | ✅ | `ask` só em allowlist negativa; `output.system=` vazio; `event.subscribe` só nome confirmado/reservado |
| No-ops seguem no-ops | ✅ | `DenyError` 0/0 nos satélites |
| code-review APPROVED (implementação) | ❌ ausente | Nenhum artifact de review desta migração no repo; `workflow-state.json §code_review` refere-se a `harness-brain-separation` (2026-10-14), não a este ID → gap G4 |
| security PASS implementação (re-review pós-I10) | ❌ ausente | SPEC §11 Fase 1 `pass` é **pré-implementação**; as mudanças I10 em `details` (G2) não têm re-review registrado → gap G5 (condicional mitigado por testes, mas sem sign-off) |
| Fail-open + kill-switch | ✅ | matriz cobre `Error` genérico ⇒ allow e `HARNESS_GATES=off` ⇒ allow vs `gates.*=off` ⇒ deny |

**Gaps**: G4 (sem code-review da implementação), G5 (sem security re-review pós-I10).

---

## Dimensão 3: Coherence — 8/10 ⚠️

| Item (verify-gate adaptado a plugin host-local) | Verdict | Evidência |
|---|---|---|
| ADR-001 dual-export refletido | ✅ | 3/3 plugins: `server` intacto + `setup` via `Plugin.define` (dual-branch com fallback, `setup` hoisted em gate.js:1179) |
| ADR-002 adapter fino | ✅ | shims (`runGatesShim`, `noteChatParamsShim`, `humanBoundaryShim`) delegam a `decide`/`noteChatParams`/`recordSessionAgent`/`isHumanMessage`/`resetHitlTracker`; suite verde confirma semântica 1:1 |
| ADR-003 config dual | ✅ | `opencode.json`: `plugin`+`plugins`, `permission.task`+`permissions.subagent/shell`, `agent.*.prompt`+`agents.*.system` (mesmo `{file:...}`); C4 inalterada; remoção v1 adiada |
| ADR-004 fail-open/kill-switch | ✅ | `decide` preservado; nenhum `catch` novo convertendo erro em deny (só I10 sanitiza `details`, sem mudar veredito) |
| Naming ok | ✅ | `setup`, `V2_HOOK_TABLE`, `V2_FORBIDDEN_HOOKS`, `HOOK-NO-EQUIV`, `GATE-ABSENT:<id>`, `sanitize*/basenameOf`, `MAX_SESSION_AGENTS` — convenções do repo |
| Sem vazamento de camada | ✅ | Adapter → núcleos unidirecional; sem backend Java/Vue/DB (N/A justificado como em SPEC §2/§6); `toLogger` best-effort preservado |
| Delta docs listada p/ archive, não executada | ✅ | `git diff --stat` sem `.agents/rules/*` nem `AGENTS.md`; SPEC §13 ADDED/MODIFIED/REMOVED intacta para fase archive |
| Árvore limpa para archive | ❌ | `git status` sujo: 4 arquivos `installer/*` + `workflow-state.json` alheios ao escopo + 9 specs untracked não commitados → gap G6 |

**Gap**: G6 (working tree com modificações fora do escopo misturadas).

---

## Gaps consolidados

| ID | Severidade | Descrição | Remediação (sem editar runtime além do já feito) |
|---|---|---|---|
| G1 | 🟡 minor | INV-01 literal `grep server: = 3` retorna **6** (dual-branch duplica a chave por arquivo) | Emendar critério para "cada plugin expõe `server` em ambos os branches + `setup`" ou aceitar 6 como literal canônico no VERIFY/archive |
| G2 | 🟡 minor (justificado) | V2-VAL-04/V2-VAL-09 "diff vazio em núcleos/loader" violados na letra: I10 sanitiza `details` em `logError`, `loadConfigOrDeny`, `checkWriteAccess`, `loadWorkflowState`, `gateShellHygiene` | Registrar exceção motivada (mitigação 🟡 prescrita em SPEC §11/PLAN gap 4, coberta por `matrix-no-leak` nos dois entries, vereditos inalterados — suite 216 verde) |
| G3 | 🔴 bloqueador formal | TASKS.md com **67 `[ ]` / 0 `[x]`** — verify-gate exige "Tasks 100%" marcadas | Marcar checkboxes PL-01..PL-08 + microtasks V2-* concluídas (edição só em TASKS.md) |
| G4 | 🔴 bloqueador | Sem code-review APPROVED da implementação | Rodar code-review no diff `gate.js`+satélites+`opencode.json` e anexar veredito |
| G5 | 🟠 major | Sem security re-review pós-mudanças I10 em `details` | Re-review focado em I10 (G2) + H-elevate 🟠; pode ser condicional-pass com matriz como prova |
| G6 | 🟠 major | Working tree mistura escopo alheio (`installer/*`, `workflow-state.json`) + specs untracked | Commit separado por escopo (migração vs installer) ou documentar no archive; `baseline-suite.log` já declara a mistura |

---

## Acceptances (sessão 2026-10-15, decisão do usuário)

| ID | Decisão | Registro |
|---|---|---|
| G1 | ✅ aceite | Critério INV-01/TASKS (`grep server: = 3`) **emendado** para "cada plugin expõe `server` nos dois branches + `setup`". Literal canônico passa a ser **6 = 3 plugins × 2 branches dual** (`gate.js:1009,1010 + harness-validator.js:28,29 + hitl-guardrail.js:29,30`, `Plugin.define(...) : {...}`). Aprovado pelo usuário em sessão 2026-10-15. Sem mudança de runtime. |
| G2 | ✅ exceção motivada | I10 sanitiza `details` em `checkWriteAccess` / `gateShellHygiene` / `loadWorkflowState` / `loadConfigOrDeny` (`logError` incluído). Mitigação prescrita em SPEC §11 / PLAN gap 4, coberta por `matrix-no-leak` nos dois entries; **vereditos deny/allow inalterados**, suite **216/216 verde**. Desvio de letra de V2-VAL-04/V2-VAL-09, não de semântica. |
| G6 | ✅ aceite com ação prescrita | `installer/*` (4 arquivos) + `workflow-state.json` são **pré-existentes e fora do escopo** desta migração; vão em **commit separado** (migração vs installer). `baseline-suite.log` já declara a mistura. Não julgar neste ID. |

---

## Veredito

```
VERIFY STATUS: CHANGES 🟠 (BLOCKED para archive)
```

**Bloqueadores**: G3 (checkboxes), G4 (code-review ausente).
**Não-bloqueadores para archive após remediação**: G5, G6 (exigem ação), G1, G2 (exigem aceite documentado).

**Observações**:
- Implementação funcionalmente correta: 216/216 + static PASS + 26 matriz + 25 loader + proibições — defeito seria aprovar sem rodar a suite, e a suite **foi rodada** (literais acima).
- Nenhum requisito SPEC sem implementação; desvios G1/G2 são de letra de critério, não de semântica (vereditos deny/allow 1:1 preservados).
- Archive liberado somente após: (a) TASKS.md 67 checkboxes marcados, (b) code-review APPROVED anexado, (c) security re-review pós-I10 (ao menos condicional-pass), (d) decisão G1/G6 registrada, (e) Delta SPEC §13 aplicada na fase archive (`workflow-rules.md`, `gate-contract.md`, `AGENTS.md`/`spec-developed.md`).

### Scores

| Dimensão | Score |
|---|---|
| Completeness | 6/10 |
| Correctness | 8/10 |
| Coherence | 8/10 |

### Completion Metadata (para archive futuro)

- **Verified on**: 2026-10-15 · **Duration**: — · **Archive path**: — (bloqueado)
- **Files changed (escopo)**: `.opencode/plugins/gate.js` (+319/-?), `harness-validator.js`, `hitl-guardrail.js`, `opencode.json`, 9 specs novas em `__tests__/`
- **Fora do escopo (não julgar aqui)**: `installer/*` (4 arquivos), `workflow-state.json`
