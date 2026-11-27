<!-- scope: adr/ADR-003 -->
# VERIFY (re-emissão) — ADR-003: Agentes, regras, config e instalador repo-local (.codex/)

Data: 2026-11-24 · Branch: `adr/prd-codex-port/03-agentes-regras-installer` · Papel: `qa-engineer` (verificação independente; nenhuma correção de código).

Motivo da re-emissão: owner aceitou o drift externo em `.agents/skills/**` como novo baseline em 2026-11-24 (`workflow-state.json`: gate `P4_P5` = `approved_owner_drift_baseline_2026_11_24`, override `skills-baseline-drift`). Contratos atualizados: `prompt-optimizer.spec` v4 (140 linhas), inventário `skills:33`, dual-run permite `.agents/skills/**`. Suíte re-medida agora, verde.

Entradas: `ADR.md` (I1–I9 + requisitos M-01/M-04/M-05/M-07/L-02), `SPEC.md`, `TASKS.md` (LAYOUT-01..CHECKS-01), `IMPLEMENTATION-REPORT.md` (19/19 Done), ADR-002 (I1/I5/I7), PRD §16 (A1..A6), `workflow-state.json` (`code_review`, gate `P3_P4`) e comandos re-medidos nesta sessão. Citação por comando/símbolo — sem número de linha em docs.

## Veredito por dimensão

| Dimensão | Veredito | Motivo |
|---|---|---|
| Completude | ✅ | 19/19 tasks LAYOUT-01..CHECKS-01 `Done` em `TASKS.md` e `IMPLEMENTATION-REPORT.md`; layout `.codex/` completo; BDD/doD por task. |
| Correção | ✅ | Suíte re-medida verde: plugins 488/488, scripts 292/292, static/sdd/vendor exit 0, acceptance 14/14, inventory ok (`skills:33`), dualrun ok (`hits:[]`). Ressalva: A6 ⏸ PENDENTE (dono: usuário) — não é defeito. |
| Coerência | ✅ | I1 layout, I2 11 agentes, I4 payload/idempotência, I5 `protectedPaths`, I8 paridade de papéis coerentes com ADR-001/002; teto efetivo 4867 bytes ≤ 32768; drift externo em `.agents/skills/**` é baseline declarado. |

## 1. Completude

| Item | Veredito | Evidência |
|---|---|---|
| Tasks 100% | ✅ | `TASKS.md` Sprint Summary: 19/19 `Done` (LAYOUT-01..CHECKS-01); `IMPLEMENTATION-REPORT.md` §1 replica 19/19. |
| Layout `.codex/` | ✅ | I1: `agents/`, `hooks.json`, `hooks/`, `rules/`, `config.toml`, `harness-state.json` runtime; `AGENTS.md` encadeado na raiz, não em `.codex/`. |
| Agentes/regras | ✅ | I2/I8: 11 `.codex/agents/*.toml` com `name`/`description`/`developer_instructions`; paridade 11/11; 8 regras; 33 skills no inventário corrente — baseline declarado (override `skills-baseline-drift`), `checkCodexInventory()` ok. |
| Estado/config | ✅ | STATEFILE-01 HMAC-SHA256+nonce, `wx` 0600, rename, lock, `.gitignore`; `config.toml` preservado/criado-quando-ausente (INSTALLER-02); `harness-state.json` fora do payload (INSTALLER-03). |
| Sem TODO/FIXME/HACK | ✅ | nenhum marcador nos artefatos; limites (caminho absoluto em `hooks.json`, schema do smoke report, execpolicy) declarados como risco em `IMPLEMENTATION-REPORT.md` §4. |
| BDD cobertos | ✅ | `codex-agent-parity.spec.mjs`, `codex-agents-md*.spec.mjs`, `codex-config-preserve.spec.mjs`, `codex-fallback.spec.mjs`, `codex-dualrun*.spec.mjs`, `codex-inventory.spec.mjs`; suíte verde na re-medição. |
| A6 smoke real | ⏸ PENDENTE | Dono: **usuário**. Codex CLI ausente; `harness/codex-port-smoke.json` é template. Ressalva externa, não defeito — não marcar ✅. |

## 2. Correção

| Comando | Declarado | Re-medido 2026-11-24 | Veredito |
|---|---|---|---|
| `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 488/488 | **488 pass · 0 fail · 0 skip** (exit 0) | ✅ |
| `node --test "scripts/__tests__/*.spec.mjs"` | 292/292 | **292 pass · 0 fail · 0 skip** (exit 0) | ✅ |
| `node scripts/static-checks.mjs` | green (V6/V6b/V2/V3/V7/V14/V18/PRD-01/ADR-01/ADR-02/V21) | exit 0 | ✅ |
| `node scripts/sdd-checks.mjs` | green (V4/R-V12/V17/SDD-01/02/03/R-NODENY/RENAME-01) | exit 0 | ✅ |
| `node scripts/vendor-skills.mjs --check` | green | exit 0 (`vendor-check OK`) | ✅ |
| `node scripts/acceptance-clean-room.mjs` | 14/14 | 14/14 (exit 0, `ACEITE GREEN`) | ✅ |
| `node scripts/check-codex-dualrun.mjs` | `ok:true` (77 paths) | `ok:true`, `hits: []`, `checked: 116` | ✅ |
| `node scripts/check-codex-inventory.mjs` | 11/8/33/7 | `problems: []`; `agents:11`, `rules:8`, `skills:33`, `inventoryRows:7` | ✅ |
| A4 `init/update/doctor` em tmp | green | coberto por specs de sync; suíte verde na re-medição | ✅ |
| A6 smoke real | pendente | **⏸ PENDENTE (dono: usuário)** | ⏸ |

Nota de baseline (diagnóstico encerrado, não corrigido aqui): as divergências anteriormente medidas (3 falhas em plugins, 4 em scripts, `dualrun`/`inventory` `ok:false`) originavam-se do drift externo em `.agents/skills/**` — `prompt-optimizer` v4 (130 linhas), skill `brainstorming` nova (33 skills). Owner aceitou esse estado como novo baseline em 2026-11-24; contratos/testes foram atualizados no ciclo (`prompt-optimizer.spec` v4 com 140 linhas, inventário `skills:33`, dual-run permitindo `.agents/skills/**`). `gate.js`/`gate-core.mjs` são `ALLOWED_EXCEPTIONS` e não explicam os hits anteriores. Re-medição atual: zero falhas. Ambiente: zero rede, zero porta, tmp via `tempScope`/`cleanup()`; nenhuma porta aberta por esta verificação.

## 3. Coerência

| Item | Veredito | Evidência |
|---|---|---|
| I1 layout | ✅ | Estrutura fechada conforme `ADR.md`; nenhum arquivo novo fora do payload observado nos artefatos do ADR. |
| I2/I8 agentes | ✅ | 11 agentes nomeados/papéis alinhados a `.agents/agents/**`; `codex-agent-parity.spec.mjs` verde na re-medição (292 pass incluem estes specs). |
| I3 `AGENTS.md` / teto | ✅ | Raiz enxuta + chunks por papel; teto efetivo 4867 bytes (IMPLEMENTATION-REPORT §2) ≤ 32768; `project_doc_fallback_filenames` sem paths com `/`. |
| I4 payload | ✅ | `PAYLOAD_DIRS`/`PAYLOAD_FILES` estendidos; manifesto com hashes; 2ª passada 0 writes; `doctor` re-hasheia; deterministicidade G1/G3/G4/G5 preservada. |
| I5 `protectedPaths` | ✅ | `.codex/**` e `.codex/harness-state.json` incluídos; `isPreserved`/`writeGuarded` como via única. |
| I6 matcher | ✅ | Amplo (`Bash\|apply_patch\|Agent\|.*`), herdado de ADR-002; hosted tools não disparam (limitação documentada). |
| I7 `.rules` | ✅ | Complementar, `prefix_rule` validado por estrutura; validação real depende de `codex execpolicy check` (⏸, dono usuário). |
| I9 métrica | ✅ | 32768 bytes mantido; nenhuma elevação sem revisão da métrica do PRD §5. |
| Segurança M/L | ✅ | M-01 state file, M-04 teto com falha (não truncamento), M-05 validador `assertNoSecrets` sobre o smoke report, M-07 11 agentes, L-02 `protectedPaths` cross-runtime. |
| Fronteiras | ✅ | `gate.js`, `gate-core.mjs`, `acceptance-clean-room.json`, `workflow-state.json` pré-existentes não foram reescritos fora da exceção I8/ADR-002; parecer APPROVED, 0 críticos. |
| Drift `.agents/skills/**` | ✅ | Baseline declarado em `workflow-state.json` (override `skills-baseline-drift`); dual-run e inventário re-medidos ok — não é divergência de coerência. |

## Riscos residuais

1. A6 — dono **usuário**: instalar Codex CLI, preencher `harness/codex-port-smoke.json` e validar `.rules` com `codex execpolicy check`. Nenhum ✅ para verificação empírica (⏸ PENDENTE).
2. `hooks.json` gerado com caminho absoluto para o checkout de origem (IMPLEMENTATION-REPORT §4.1): F-07 atendido, portabilidade para outro target depende de decisão ADR-002 — não alterada aqui.
3. Baseline de drift em `workflow-state.json`: se novo drift externo surgir após 2026-11-24, re-executar `commands.suiteFull` e reavaliar contrato por decisão, não por emenda de prosa.

## Veredito

```
VERIFY STATUS: APROVADO ⏸ (ressalva externa A6)

Ressalva (não bloqueante, dono: usuário):
- A6 smoke real PENDENTE; Codex CLI ausente. Não é defeito de código.
- codex --version / codex execpolicy check não executados.

Evidência re-medida 2026-11-24 (verde):
- commands.suiteFull: plugins 488/488, scripts 292/292, static/sdd/vendor exit 0.
- acceptance-clean-room 14/14; dualrun ok:true hits:[] checked:116;
  inventory problems:[] skills:33/agents:11/rules:8/rows:7.
- 19/19 tasks Done; contrato I1–I9 e limites declarados coerentes.
- code review APPROVED, 0 críticos (workflow-state.json: code_review.last_status
  = passed, critical_issues = 0; gates P3_P4 e P4_P5 aprovados).
- Drift externo em .agents/skills/** é baseline declarado (override
  skills-baseline-drift), não divergência.
```

Skipped: não executei `codex --version` nem `codex execpolicy check` (CLI ausente — A6, dono usuário). Risco: instalação em target real e comportamento dos hooks no Codex seguem sem contraprova empírica.
