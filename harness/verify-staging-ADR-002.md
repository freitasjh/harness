<!-- scope: adr/ADR-002 -->
# VERIFY — ADR-002: Hooks e gates no Codex (PreToolUse, reason codes, kill-switch)

Data: 2026-11-24 · Branch: `adr/prd-codex-port/02-hooks-gates-codex` · Papel: `qa-engineer` (verificação independente; nenhuma correção de código).

Entradas: `ADR.md` (I1–I9 + requisitos C-01/C-02/H-01..H-04/M-02/M-03/M-06), `SPEC.md`, `TASKS.md` (CORE-01..SMOKE-01), ADR-001 (I2/I3/I4), PRD §16 (A1..A6), `workflow-state.json` (`code_review`, gate `P3_P4`) e comandos re-medidos nesta sessão. Citação por comando/símbolo — sem número de linha em docs.

## Veredito por dimensão

| Dimensão | Veredito | Motivo |
|---|---|---|
| Completude | ✅ | 21/21 tasks CORE-01..SMOKE-01 com critérios BDD/DoD no `TASKS.md`; implementação concluída e revisada APPROVED; contrato I1–I9 e requisitos de segurança presentes. Divergência documental: coluna Status da Sprint Summary ainda `Todo` em 21/21 (ver risco 2). |
| Correção | ❌ | Suíte re-medida vermelha (plugins 485/488, scripts 288/292); `checkCodexDualRun()`/`checkCodexInventory()` `ok:false`; `codex execpolicy check` e A6 ❌ PENDENTES (dono: usuário). |
| Coerência | ✅ | I2/I3 (deny JSON e reason literal), I4 (kill-switch), I5 (estado em arquivo) e I7 (fronteira hooks/`.rules`) coerentes com ADR-001; `ALLOWED_EXCEPTIONS` cobre `gate.js`/`gate-core.mjs` (I8) e não aparece nos hits do dual-run. |

## 1. Completude

| Item | Veredito | Evidência |
|---|---|---|
| Tasks 100% | ✅ | `TASKS.md`: 21 task rows (`CORE-01`..`SMOKE-01`), todas com Acceptance Criteria (BDD) e DoD; implementação atestada por specs `codex-*` e parecer APPROVED. |
| Contrato I1–I9 | ✅ | Mapeamento tool→gate (I1), I/O do adapter (I2), deny JSON (I3), kill-switch (I4), persistência HITL (I5), spike `spawn_agent` best-effort (I6), fronteira hooks/`.rules` (I7), refatoração condicionada de `gate.js` (I8), `SessionStart` complementar (I9). |
| Segurança | ✅ | C-01 identidade da sessão, C-02 manifesto com hashes, H-04 fail-closed em input inválido, M-02 detalhes sem eco, M-03 bypass log 0600, M-06 sem interpolação de `tool_input`. |
| Sem TODO/FIXME/HACK | ✅ | nenhum marcador de dívida nos artefatos deste ADR; limites (spawn_agent, hosted tools) declarados como risco, não como pendência oculta. |
| BDD cobertos | ✅ | Sucesso/Falha/Borda das 21 tasks exercitados em `scripts/__tests__/codex-*.spec.mjs` e `.opencode/plugins/__tests__/`. |
| A6 smoke real / `codex execpolicy check` | ❌ PENDENTE | Dono: **usuário**. Codex CLI ausente; `harness/codex-port-smoke.json` é template. `.rules` validado apenas por estrutura (`prefix_rule`/decisões), best-effort (IMPLEMENTATION-REPORT §4). Não marcar ✅. |

## 2. Correção

| Comando | Declarado | Re-medido 2026-11-24 | Veredito |
|---|---|---|---|
| `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 488/488 | **485 pass · 3 fail · 0 skip** (exit 1) | ❌ |
| `node --test "scripts/__tests__/*.spec.mjs"` | 292/292 | **288 pass · 4 fail · 0 skip** (exit 1) | ❌ |
| `node scripts/static-checks.mjs` | green | exit 0 | ✅ |
| `node scripts/sdd-checks.mjs` | green | exit 0 | ✅ |
| `node scripts/vendor-skills.mjs --check` | green | exit 0 (`vendor-check OK`) | ✅ |
| `node scripts/acceptance-clean-room.mjs` | 14/14 | 14/14 (exit 0, `ACEITE GREEN`) | ✅ |
| `node scripts/check-codex-dualrun.mjs` | `ok:true` | `ok:false` — hits em `.agents/skills/**` (gate.js/gate-core.mjs são `ALLOWED_EXCEPTIONS`) | ❌ |
| `node scripts/check-codex-inventory.mjs` | 11/8/32/7 | `ok:false` — `skills: 33, esperado 32` | ❌ |
| A2 paridade de reason codes | fixtures green | specs `codex-*` presentes; agregado vermelho (acima) | ❌ |
| A3 kill-switch (fixtures `HARNESS_GATES=off`) | green | coberto por `codex-killswitch.spec.mjs`/`codex-bypass.spec.mjs`; agregado vermelho | ❌ |
| `codex execpolicy check` (I7) | pendente | **PENDENTE (dono: usuário)** | ❌ |
| A6 smoke real | pendente | **PENDENTE (dono: usuário)** | ❌ |

Causa raiz das divergências re-medidas (diagnóstico, não corrigido): as 3 falhas em plugins vêm de `prompt-optimizer.spec.mjs` (`.agents/skills/prompt-optimizer/SKILL.md` v4, 130 linhas, sem `prompt_assumptions`); as 4 falhas em scripts vêm de `checkCodexDualRun()` (`.agents/skills/brainstorming/**`, `deepsearch/**`, `prompt-optimizer/**` no diff) e `checkCodexInventory()` (33 skills). Todas as mudanças são concorrentes e fora do escopo destes VERIFY — `gate.js`/`gate-core.mjs` (I8) estão em `ALLOWED_EXCEPTIONS` e não explicam os hits. Ambiente: zero rede, zero porta, tmp via `tempScope`/`cleanup()`.

## 3. Coerência

| Item | Veredito | Evidência |
|---|---|---|
| I1 tool→gate | ✅ | Matcher amplo (`Bash\|apply_patch\|Agent\|.*`); hosted tools e `spawn_agent` documentados como limitação do Codex, não como claim de cobertura. |
| I2 adapter I/O | ✅ | stdin JSON (session/cwd/tool_name/tool_input) → stdout deny JSON ou exit 2; nenhum formato alternativo observado. |
| I3 deny JSON | ✅ | `permissionDecision:"deny"` e `permissionDecisionReason` literal, sem prefixo/transformação. |
| I4 kill-switch | ✅ | `HARNESS_GATES=off` ⇒ early-exit sem deny + log de bypass, sem segredo/eco de path. |
| I5 persistência | ✅ | `workflow-state.json` + `.codex/harness-state.json`; HMAC/nonce, `wx` 0600, rename atômico, lock, escopo por sessão (ADR-003 STATEFILE-01). |
| I6 `spawn_agent` | ✅ | Best-effort explícito (issue #49736); paridade medida só onde o hook dispara — sem afirmação além do contrato. |
| I7 hooks vs `.rules` | ✅ | Hooks = gates/reason codes; `.rules` = sandbox complementar, não duplica política; validação real depende de `codex execpolicy check` (A6, pendente). |
| I8 refatoração `gate.js` | ✅ | Exceção declarada e presente em `ALLOWED_EXCEPTIONS` de `checkCodexDualRun()`; revisão humana registrada no gate `P3_P4`. |
| I9 `SessionStart` | ✅ | Complemento via `command`, `additionalContext` conservador; não é canal primário de regras. |
| Fronteiras | ✅ | Nenhuma lógica de negócio escrita por esta verificação; parecer APPROVED, 0 críticos. |

## Riscos residuais

1. A6 + `codex execpolicy check` — dono **usuário**: instalar Codex CLI, validar `.rules` e executar smoke com deny real. Nenhum ✅ para verificação empírica.
2. `TASKS.md` (ADR-002) mantém coluna Status `Todo` em 21/21 embora a implementação esteja APPROVED. Divergência documental — não corrigida (fora do escopo de escrita). Atestar conclusão pela suíte/review, não pelo status da tabela.
3. Suíte re-medida vermelha por mudanças concorrentes em `.agents/skills/**` (fora destes VERIFY); re-executar `commands.suiteFull` após resolução.
4. R1 drift de reason codes, R2 `spawn_agent`, R3 divergência hooks/`.rules`, R4 concorrência de estado — todos declarados em `ADR.md`; R2/R3 dependem de A6 para fechamento empírico.

## Veredito

```
VERIFY STATUS: BLOQUEADO ❌

Bloqueadores:
- A6 smoke real e codex execpolicy check PENDENTES (dono: usuário; Codex CLI ausente).
- commands.suiteFull re-medido vermelho: 485/488 plugins, 288/292 scripts;
  dualrun/inventory ok:false por mudanças concorrentes em .agents/skills/**.

Não bloqueante neste ADR:
- code review APPROVED, 0 críticos (workflow-state.json: code_review.last_status
  = passed, critical_issues = 0; gate P3_P4 aprovado).
- Contrato I1–I9 e requisitos C/H/M coerentes com ADR-001.
```

Skipped: não executei `codex --version` nem `codex execpolicy check` (CLI ausente — A6, dono usuário). Risco: `spawn_agent`/hosted tools e `.rules` seguem sem contraprova empírica.
