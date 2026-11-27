<!-- scope: adr/ADR-002 -->
# VERIFY (re-emissão) — ADR-002: Hooks e gates no Codex (PreToolUse, reason codes, kill-switch)

Data: 2026-11-24 · Branch: `adr/prd-codex-port/02-hooks-gates-codex` · Papel: `qa-engineer` (verificação independente; nenhuma correção de código).

Motivo da re-emissão: owner aceitou o drift externo em `.agents/skills/**` como novo baseline em 2026-11-24 (`workflow-state.json`: gate `P4_P5` = `approved_owner_drift_baseline_2026_11_24`, override `skills-baseline-drift`). Contratos atualizados: `prompt-optimizer.spec` v4 (140 linhas), inventário `skills:33`, dual-run permite `.agents/skills/**`. Suíte re-medida agora, verde.

Entradas: `ADR.md` (I1–I9 + requisitos C-01/C-02/H-01..H-04/M-02/M-03/M-06), `SPEC.md`, `TASKS.md` (CORE-01..SMOKE-01), ADR-001 (I2/I3/I4), PRD §16 (A1..A6), `workflow-state.json` (`code_review`, gate `P3_P4`) e comandos re-medidos nesta sessão. Citação por comando/símbolo — sem número de linha em docs.

## Veredito por dimensão

| Dimensão | Veredito | Motivo |
|---|---|---|
| Completude | ✅ | 21/21 tasks CORE-01..SMOKE-01 com critérios BDD/DoD no `TASKS.md`; implementação concluída e revisada APPROVED; contrato I1–I9 e requisitos de segurança presentes. Divergência documental: coluna Status da Sprint Summary ainda `Todo` em 21/21 (ver risco 2). |
| Correção | ✅ | Suíte re-medida verde: plugins 488/488, scripts 292/292, static/sdd/vendor exit 0, acceptance 14/14, inventory ok (`skills:33`), dualrun ok (`hits:[]`). Ressalva: `codex execpolicy check` e A6 ⏸ PENDENTES (dono: usuário) — não são defeitos. |
| Coerência | ✅ | I2/I3 (deny JSON e reason literal), I4 (kill-switch), I5 (estado em arquivo) e I7 (fronteira hooks/`.rules`) coerentes com ADR-001; `ALLOWED_EXCEPTIONS` cobre `gate.js`/`gate-core.mjs` (I8) e não aparece nos hits do dual-run. |

## 1. Completude

| Item | Veredito | Evidência |
|---|---|---|
| Tasks 100% | ✅ | `TASKS.md`: 21 task rows (`CORE-01`..`SMOKE-01`), todas com Acceptance Criteria (BDD) e DoD; implementação atestada por specs `codex-*` e parecer APPROVED. |
| Contrato I1–I9 | ✅ | Mapeamento tool→gate (I1), I/O do adapter (I2), deny JSON (I3), kill-switch (I4), persistência HITL (I5), spike `spawn_agent` best-effort (I6), fronteira hooks/`.rules` (I7), refatoração condicionada de `gate.js` (I8), `SessionStart` complementar (I9). |
| Segurança | ✅ | C-01 identidade da sessão, C-02 manifesto com hashes, H-04 fail-closed em input inválido, M-02 detalhes sem eco, M-03 bypass log 0600, M-06 sem interpolação de `tool_input`. |
| Sem TODO/FIXME/HACK | ✅ | nenhum marcador de dívida nos artefatos deste ADR; limites (spawn_agent, hosted tools) declarados como risco, não como pendência oculta. |
| BDD cobertos | ✅ | Sucesso/Falha/Borda das 21 tasks exercitados em `scripts/__tests__/codex-*.spec.mjs` e `.opencode/plugins/__tests__/`; suíte verde na re-medição. |
| A6 smoke real / `codex execpolicy check` | ⏸ PENDENTE | Dono: **usuário**. Codex CLI ausente; `harness/codex-port-smoke.json` é template. `.rules` validado apenas por estrutura (`prefix_rule`/decisões), best-effort (IMPLEMENTATION-REPORT §4). Ressalva externa, não defeito — não marcar ✅. |

## 2. Correção

| Comando | Declarado | Re-medido 2026-11-24 | Veredito |
|---|---|---|---|
| `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 488/488 | **488 pass · 0 fail · 0 skip** (exit 0) | ✅ |
| `node --test "scripts/__tests__/*.spec.mjs"` | 292/292 | **292 pass · 0 fail · 0 skip** (exit 0) | ✅ |
| `node scripts/static-checks.mjs` | green | exit 0 | ✅ |
| `node scripts/sdd-checks.mjs` | green | exit 0 | ✅ |
| `node scripts/vendor-skills.mjs --check` | green | exit 0 (`vendor-check OK`) | ✅ |
| `node scripts/acceptance-clean-room.mjs` | 14/14 | 14/14 (exit 0, `ACEITE GREEN`) | ✅ |
| `node scripts/check-codex-dualrun.mjs` | `ok:true` | `ok:true`, `hits: []`, `checked: 116` (gate.js/gate-core.mjs são `ALLOWED_EXCEPTIONS`) | ✅ |
| `node scripts/check-codex-inventory.mjs` | 11/8/33/7 | `problems: []`; `agents:11`, `rules:8`, `skills:33`, `inventoryRows:7` | ✅ |
| A2 paridade de reason codes | fixtures green | specs `codex-*` presentes; suíte verde na re-medição | ✅ |
| A3 kill-switch (fixtures `HARNESS_GATES=off`) | green | coberto por `codex-killswitch.spec.mjs`/`codex-bypass.spec.mjs`; suíte verde | ✅ |
| `codex execpolicy check` (I7) | pendente | **⏸ PENDENTE (dono: usuário)** | ⏸ |
| A6 smoke real | pendente | **⏸ PENDENTE (dono: usuário)** | ⏸ |

Nota de baseline (diagnóstico encerrado, não corrigido aqui): as divergências anteriormente medidas (3 falhas em plugins, 4 em scripts, `dualrun`/`inventory` `ok:false`) originavam-se do drift externo em `.agents/skills/**` — `prompt-optimizer` v4 (130 linhas), skill `brainstorming` nova (33 skills). Owner aceitou esse estado como novo baseline em 2026-11-24; contratos/testes foram atualizados no ciclo (`prompt-optimizer.spec` v4 com 140 linhas, inventário `skills:33`, dual-run permitindo `.agents/skills/**`). Re-medição atual: zero falhas. `gate.js`/`gate-core.mjs` (I8) permanecem em `ALLOWED_EXCEPTIONS` e não explicam os hits anteriores. Ambiente: zero rede, zero porta, tmp via `tempScope`/`cleanup()`.

## 3. Coerência

| Item | Veredito | Evidência |
|---|---|---|
| I1 tool→gate | ✅ | Matcher amplo (`Bash\|apply_patch\|Agent\|.*`); hosted tools e `spawn_agent` documentados como limitação do Codex, não como claim de cobertura. |
| I2 adapter I/O | ✅ | stdin JSON (session/cwd/tool_name/tool_input) → stdout deny JSON ou exit 2; nenhum formato alternativo observado. |
| I3 deny JSON | ✅ | `permissionDecision:"deny"` e `permissionDecisionReason` literal, sem prefixo/transformação. |
| I4 kill-switch | ✅ | `HARNESS_GATES=off` ⇒ early-exit sem deny + log de bypass, sem segredo/eco de path. |
| I5 persistência | ✅ | `workflow-state.json` + `.codex/harness-state.json`; HMAC/nonce, `wx` 0600, rename atômico, lock, escopo por sessão (ADR-003 STATEFILE-01). |
| I6 `spawn_agent` | ✅ | Best-effort explícito (issue #49736); paridade medida só onde o hook dispara — sem afirmação além do contrato. |
| I7 hooks vs `.rules` | ✅ | Hooks = gates/reason codes; `.rules` = sandbox complementar, não duplica política; validação estrutural green, validação real depende de `codex execpolicy check` (⏸, dono usuário). |
| I8 refatoração `gate.js` | ✅ | Exceção declarada e presente em `ALLOWED_EXCEPTIONS` de `checkCodexDualRun()`; revisão humana registrada no gate `P3_P4`. |
| I9 `SessionStart` | ✅ | Complemento via `command`, `additionalContext` conservador; não é canal primário de regras. |
| Fronteiras | ✅ | Nenhuma lógica de negócio escrita por esta verificação; parecer APPROVED, 0 críticos. |

## Riscos residuais

1. A6 + `codex execpolicy check` — dono **usuário**: instalar Codex CLI, validar `.rules` e executar smoke com deny real. Nenhum ✅ para verificação empírica (⏸ PENDENTE).
2. `TASKS.md` (ADR-002) mantém coluna Status `Todo` em 21/21 embora a implementação esteja APPROVED. Divergência documental — não corrigida (fora do escopo de escrita). Atestar conclusão pela suíte/review, não pelo status da tabela.
3. R1 drift de reason codes, R2 `spawn_agent`, R3 divergência hooks/`.rules`, R4 concorrência de estado — todos declarados em `ADR.md`; R2/R3 dependem de A6 para fechamento empírico.
4. Baseline de drift em `workflow-state.json`: re-executar `commands.suiteFull` se novo drift externo surgir após 2026-11-24.

## Veredito

```
VERIFY STATUS: APROVADO ⏸ (ressalva externa A6)

Ressalva (não bloqueante, dono: usuário):
- A6 smoke real e codex execpolicy check PENDENTES; Codex CLI ausente.
- Não são defeitos de código; não executados nesta verificação.

Evidência re-medida 2026-11-24 (verde):
- commands.suiteFull: plugins 488/488, scripts 292/292, static/sdd/vendor exit 0.
- acceptance-clean-room 14/14; dualrun ok:true hits:[] checked:116;
  inventory problems:[] skills:33.
- Contrato I1–I9 e requisitos C/H/M coerentes com ADR-001.
- code review APPROVED, 0 críticos (workflow-state.json: code_review.last_status
  = passed, critical_issues = 0; gates P3_P4 e P4_P5 aprovados).
- Drift externo em .agents/skills/** é baseline declarado (override
  skills-baseline-drift), não divergência.
```

Skipped: não executei `codex --version` nem `codex execpolicy check` (CLI ausente — A6, dono usuário). Risco: `spawn_agent`/hosted tools e `.rules` seguem sem contraprova empírica.
