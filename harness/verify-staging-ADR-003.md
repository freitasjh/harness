<!-- scope: adr/ADR-003 -->
# VERIFY — ADR-003: Agentes, regras, config e instalador repo-local (.codex/)

Data: 2026-11-24 · Branch: `adr/prd-codex-port/03-agentes-regras-installer` · Papel: `qa-engineer` (verificação independente; nenhuma correção de código).

Entradas: `ADR.md` (I1–I9 + requisitos M-01/M-04/M-05/M-07/L-02), `SPEC.md`, `TASKS.md` (LAYOUT-01..CHECKS-01), `IMPLEMENTATION-REPORT.md` (19/19 Done), ADR-002 (I1/I5/I7), PRD §16 (A1..A6), `workflow-state.json` (`code_review`, gate `P3_P4`) e comandos re-medidos nesta sessão. Citação por comando/símbolo — sem número de linha em docs.

## Veredito por dimensão

| Dimensão | Veredito | Motivo |
|---|---|---|
| Completude | ✅ | 19/19 tasks LAYOUT-01..CHECKS-01 `Done` em `TASKS.md` e `IMPLEMENTATION-REPORT.md`; layout `.codex/` completo; BDD/doD por task. |
| Correção | ❌ | Suíte re-medida vermelha (plugins 485/488, scripts 288/292); `checkCodexDualRun()`/`checkCodexInventory()` `ok:false` (33 skills); A6 ❌ PENDENTE (dono: usuário). |
| Coerência | ✅ | I1 layout, I2 11 agentes, I4 payload/idempotência, I5 `protectedPaths`, I8 paridade de papéis coerentes com ADR-001/002; teto efetivo 4867 bytes ≤ 32768; `hooks.json` com caminho absoluto e `codex execpolicy check` são limites declarados. |

## 1. Completude

| Item | Veredito | Evidência |
|---|---|---|
| Tasks 100% | ✅ | `TASKS.md` Sprint Summary: 19/19 `Done` (LAYOUT-01..CHECKS-01); `IMPLEMENTATION-REPORT.md` §1 replica 19/19. |
| Layout `.codex/` | ✅ | I1: `agents/`, `hooks.json`, `hooks/`, `rules/`, `config.toml`, `harness-state.json` runtime; `AGENTS.md` encadeado na raiz, não em `.codex/`. |
| Agentes/regras | ✅ | I2/I8: 11 `.codex/agents/*.toml` com `name`/`description`/`developer_instructions`; paridade 11/11; 8 regras; 32 skills no contrato (contagem corrente 33 — ver risco 3). |
| Estado/config | ✅ | STATEFILE-01 HMAC-SHA256+nonce, `wx` 0600, rename, lock, `.gitignore`; `config.toml` preservado/criado-quando-ausente (INSTALLER-02); `harness-state.json` fora do payload (INSTALLER-03). |
| Sem TODO/FIXME/HACK | ✅ | nenhum marcador nos artefatos; limites (caminho absoluto em `hooks.json`, schema do smoke report, execpolicy) declarados como risco em `IMPLEMENTATION-REPORT.md` §4. |
| BDD cobertos | ✅ | `codex-agent-parity.spec.mjs`, `codex-agents-md*.spec.mjs`, `codex-config-preserve.spec.mjs`, `codex-fallback.spec.mjs`, `codex-dualrun*.spec.mjs`, `codex-inventory.spec.mjs`. |
| A6 smoke real | ❌ PENDENTE | Dono: **usuário**. Codex CLI ausente; `harness/codex-port-smoke.json` é template. Não marcar ✅. |

## 2. Correção

| Comando | Declarado | Re-medido 2026-11-24 | Veredito |
|---|---|---|---|
| `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 488/488 | **485 pass · 3 fail · 0 skip** (exit 1) | ❌ |
| `node --test "scripts/__tests__/*.spec.mjs"` | 292/292 | **288 pass · 4 fail · 0 skip** (exit 1) | ❌ |
| `node scripts/static-checks.mjs` | green (V6/V6b/V2/V3/V7/V14/V18/PRD-01/ADR-01/ADR-02/V21) | exit 0 | ✅ |
| `node scripts/sdd-checks.mjs` | green (V4/R-V12/V17/SDD-01/02/03/R-NODENY/RENAME-01) | exit 0 | ✅ |
| `node scripts/vendor-skills.mjs --check` | green | exit 0 (`vendor-check OK`) | ✅ |
| `node scripts/acceptance-clean-room.mjs` | 14/14 | 14/14 (exit 0, `ACEITE GREEN`) | ✅ |
| `node scripts/check-codex-dualrun.mjs` | `ok:true` (77 paths) | `ok:false` — hits em `.agents/skills/**` | ❌ |
| `node scripts/check-codex-inventory.mjs` | 11/8/32/7 | `ok:false` — `skills: 33, esperado 32`; agents 11, rules 8, rows 7 | ❌ |
| A4 `init/update/doctor` em tmp | green | coberto por specs de sync; agregado vermelho (acima) | ❌ |
| A6 smoke real | pendente | **PENDENTE (dono: usuário)** | ❌ |

Causa raiz das divergências re-medidas (diagnóstico, não corrigido): 3 falhas em plugins em `prompt-optimizer.spec.mjs` (skill v4 130 linhas, sem `prompt_assumptions`); 4 falhas em scripts em `checkCodexDualRun()` (diff em `.agents/skills/brainstorming/**`, `deepsearch/**`, `prompt-optimizer/**`) e `checkCodexInventory()` (33 skills). `gate.js`/`gate-core.mjs` são `ALLOWED_EXCEPTIONS` e não explicam os hits. Mudanças concorrentes, fora do escopo destes VERIFY. Ambiente: zero rede, zero porta, tmp via `tempScope`/`cleanup()`; nenhuma porta aberta por esta verificação.

## 3. Coerência

| Item | Veredito | Evidência |
|---|---|---|
| I1 layout | ✅ | Estrutura fechada conforme `ADR.md`; nenhum arquivo novo fora do payload observado nos artefatos do ADR. |
| I2/I8 agentes | ✅ | 11 agentes nomeados/papéis alinhados a `.agents/agents/**`; `codex-agent-parity.spec.mjs` verde na re-medição (288 pass incluem estes specs). |
| I3 `AGENTS.md` / teto | ✅ | Raiz enxuta + chunks por papel; teto efetivo 4867 bytes (IMPLEMENTATION-REPORT §2) ≤ 32768; `project_doc_fallback_filenames` sem paths com `/`. |
| I4 payload | ✅ | `PAYLOAD_DIRS`/`PAYLOAD_FILES` estendidos; manifesto com hashes; 2ª passada 0 writes; `doctor` re-hasheia; deterministicidade G1/G3/G4/G5 preservada. |
| I5 `protectedPaths` | ✅ | `.codex/**` e `.codex/harness-state.json` incluídos; `isPreserved`/`writeGuarded` como via única. |
| I6 matcher | ✅ | Amplo (`Bash\|apply_patch\|Agent\|.*`), herdado de ADR-002; hosted tools não disparam (limitação documentada). |
| I7 `.rules` | ✅ | Complementar, `prefix_rule` validado por estrutura; validação real depende de `codex execpolicy check` (A6, pendente). |
| I9 métrica | ✅ | 32768 bytes mantido; nenhuma elevação sem revisão da métrica do PRD §5. |
| Segurança M/L | ✅ | M-01 state file, M-04 teto com falha (não truncamento), M-05 validador `assertNoSecrets` sobre o smoke report, M-07 11 agentes, L-02 `protectedPaths` cross-runtime. |
| Fronteiras | ✅ | `gate.js`, `gate-core.mjs`, `acceptance-clean-room.json`, `workflow-state.json` pré-existentes não foram reescritos fora da exceção I8/ADR-002; parecer APPROVED, 0 críticos. |

## Riscos residuais

1. A6 — dono **usuário**: instalar Codex CLI, preencher `harness/codex-port-smoke.json` e validar `.rules` com `codex execpolicy check`. Nenhum ✅ para verificação empírica.
2. `hooks.json` gerado com caminho absoluto para o checkout de origem (IMPLEMENTATION-REPORT §4.1): F-07 atendido, portabilidade para outro target depende de decisão ADR-002 — não alterada aqui.
3. I1/I5 hoje vermelhos: contagem corrente de skills é 33 (contrato congela 32) e `checkCodexDualRun()` acusa `.agents/skills/**`. Causa concorrente, fora destes VERIFY; se permanente, exige nova decisão, não emenda por prosa.
4. Suíte re-medida vermelha por mudanças concorrentes em `.agents/skills/**`; re-executar `commands.suiteFull` após resolução.

## Veredito

```
VERIFY STATUS: BLOQUEADO ❌

Bloqueadores:
- A6 smoke real PENDENTE (dono: usuário; Codex CLI ausente).
- commands.suiteFull re-medido vermelho: 485/488 plugins, 288/292 scripts;
  dualrun/inventory ok:false (mudanças concorrentes em .agents/skills/**).

Não bloqueante neste ADR:
- code review APPROVED, 0 críticos (workflow-state.json: code_review.last_status
  = passed, critical_issues = 0; gate P3_P4 aprovado).
- 19/19 tasks Done; contrato I1–I9 e limites declarados coerentes.
```

Skipped: não executei `codex --version` nem `codex execpolicy check` (CLI ausente — A6, dono usuário). Risco: instalação em target real e comportamento dos hooks no Codex seguem sem contraprova empírica.
