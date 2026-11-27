<!-- scope: adr/ADR-001 -->
# VERIFY (re-emissão) — ADR-001: Inventário e contrato de paridade opencode↔Codex

Data: 2026-11-24 · Branch: `adr/prd-codex-port/01-inventario-contrato` · Papel: `qa-engineer` (verificação independente; nenhuma correção de código).

Motivo da re-emissão: owner aceitou o drift externo em `.agents/skills/**` como novo baseline em 2026-11-24 (`workflow-state.json`: gate `P4_P5` = `approved_owner_drift_baseline_2026_11_24`, override `skills-baseline-drift`). Contratos atualizados: `prompt-optimizer.spec` v4 (140 linhas), inventário `skills:33`, dual-run permite `.agents/skills/**`. Suíte re-medida agora, verde.

Entradas: `ADR.md` (I1–I7), `SPEC.md`, `TASKS.md` (IC-01..IC-10), `RESEARCH.md` (D1–D8), PRD §16 (A1..A6), `harness.config.json` (`commands.suiteFull`), `workflow-state.json` (`code_review`, gates `P3_P4`/`P4_P5`) e comandos re-medidos nesta sessão. Convenção de citação: comando/símbolo — sem número de linha em docs.

## Veredito por dimensão

| Dimensão | Veredito | Motivo |
|---|---|---|
| Completude | ✅ | 10/10 tasks IC-01..IC-10 `Done`; contrato I1–I7 e inventário de 7 superfícies presentes; BDD rastreado em `SPEC.md`/`TASKS.md`. |
| Correção | ✅ | Suíte re-medida verde: plugins 488/488, scripts 292/292, static/sdd/vendor exit 0, acceptance 14/14, inventory ok (`skills:33`), dualrun ok (`hits:[]`). Única ressalva: A6 ⏸ PENDENTE (dono: usuário) — não é defeito. |
| Coerência | ✅ | Drift externo em `.agents/skills/**` agora é baseline declarado (override `skills-baseline-drift` em `workflow-state.json`); I1/I5 re-medidos ok. |

## 1. Completude

| Item | Veredito | Evidência |
|---|---|---|
| Tasks 100% | ✅ | `TASKS.md` Sprint Summary: 10 linhas `IC-01..IC-10`, todas `Done` (10/10; 0 em status diverso). |
| Contrato congelado | ✅ | `ADR.md` I1 (7 superfícies), I2 (reason codes de `CORE_GATES`), I3 (`permissionDecision:"deny"` / exit 2), I4 (`HARNESS_GATES=off`), I5 (dual-run), I6 (bypass declarado), I7 (smoke empírico). |
| Sem TODO/FIXME/HACK | ✅ | nenhum marcador de dívida introduzido nos artefatos deste ADR; inventário e reason codes permanecem como contrato, não como código morto. |
| BDD cobertos | ✅ | Critérios de aceite das 10 tasks em `TASKS.md` exercitados via `checkCodexInventory`, `checkCodexDualRun` e specs `codex-*`; suíte verde na re-medição. |
| A6 — smoke real | ⏸ PENDENTE | Dono: **usuário**. `harness/codex-port-smoke.json` segue template (`agent: user`, `gitSha` zerado, `counts` 0/0/0, `notes` "preencher após smoke real"). Codex CLI ausente; `codex --version` não executado. Ressalva externa, não defeito — não marcar ✅. |

## 2. Correção

Medição declarada no ciclo (`workflow-state.json` gate `P3_P4`) e re-medição independente executada nesta verificação:

| Comando (de `harness.config.json.commands.*` ou check nomeado) | Declarado | Re-medido 2026-11-24 | Veredito |
|---|---|---|---|
| `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 488/488 | **488 pass · 0 fail · 0 skip** (exit 0) | ✅ |
| `node --test "scripts/__tests__/*.spec.mjs"` | 292/292 | **292 pass · 0 fail · 0 skip** (exit 0) | ✅ |
| `node scripts/static-checks.mjs` | green | exit 0 | ✅ |
| `node scripts/sdd-checks.mjs` | green | exit 0 | ✅ |
| `node scripts/vendor-skills.mjs --check` | green | exit 0 (`vendor-check OK`) | ✅ |
| `node scripts/acceptance-clean-room.mjs` | 14/14 | 14/14 (exit 0, `ACEITE GREEN`) | ✅ |
| `node scripts/check-codex-dualrun.mjs` | `ok:true` | `ok:true`, `hits: []`, `checked: 116` | ✅ |
| `node scripts/check-codex-inventory.mjs` | 11/8/33/7 | `problems: []`; `agents:11`, `rules:8`, `skills:33`, `inventoryRows:7` | ✅ |
| A2 paridade de reason codes | fixtures green | coberta por specs `codex-*`; suíte verde na re-medição | ✅ |
| A6 — smoke real com Codex CLI | pendente | **⏸ PENDENTE (dono: usuário)** | ⏸ |

Nota de baseline (diagnóstico encerrado, não corrigido aqui): as divergências anteriormente medidas (3 falhas em plugins, 4 em scripts, `dualrun`/`inventory` `ok:false`) originavam-se do drift externo em `.agents/skills/**` — `prompt-optimizer` v4 (130 linhas), skill `brainstorming` nova (33 skills). Owner aceitou esse estado como novo baseline em 2026-11-24; contratos/testes foram atualizados no ciclo (`prompt-optimizer.spec` v4 com 140 linhas, inventário `skills:33`, dual-run permitindo `.agents/skills/**`). Re-medição atual: zero falhas. Ambiente: zero rede, zero porta; comandos Node ESM/`node --test` com tmp via `tempScope`/`cleanup()` (convenção em `scripts/AGENTS.md`). Nenhuma porta aberta por esta verificação.

## 3. Coerência

| Item | Veredito | Evidência |
|---|---|---|
| I1 conjunto fechado | ✅ | Re-medido: 11 agentes / 8 regras / 33 skills / 7 inventoryRows; contagem de skills agora é baseline declarado (override `skills-baseline-drift`), `checkCodexInventory()` `problems: []`. |
| I2 reason codes | ✅ | Contrato aponta para `CORE_GATES` como fonte única; nenhuma reescrita de reason code em `.codex/**` observada nos artefatos deste ADR. |
| I3 semântica de deny | ✅ | `permissionDecision:"deny"` + `permissionDecisionReason` literal; nenhum formato alternativo introduzido. |
| I4 kill-switch | ✅ | `HARNESS_GATES=off` como contrato compartilhado; ausência de segredo/eco de path na especificação. |
| I5 dual-run invariante | ✅ | `checkCodexDualRun()` `ok:true`, `hits: []`, `checked: 116`; `.agents/skills/**` permitido pelo baseline declarado. Exceções `gate.js`/`gate-core.mjs` (I8/ADR-002) permanecem legítimas e fora dos hits. |
| I6 superfície de bypass | ✅ | `hooks.json` adulterado continua mitigado por A2 + revisão humana; nenhuma nova superfície de bypass descrita. |
| I7 verificação empírica | ⏸ PENDENTE | Contrato re-medido verde por suíte; confirmação por smoke real segue ⏸ (dono: usuário). Ressalva, não divergência de projeto. |
| Naming / fronteiras | ✅ | Nenhuma camada de domínio nova; ADR-001 é contrato/documentação, sem código de negócio escrito. |

## Riscos residuais

1. A6 — dono **usuário**: instalar Codex CLI, rodar smoke real e preencher `harness/codex-port-smoke.json` (schema, `gitSha`, counts, evaluation, cleanup). Até lá, nenhuma afirmação de ✅ para verificação empírica (⏸ PENDENTE).
2. Baseline de drift declarado em `workflow-state.json`: se novo drift externo surgir após 2026-11-24, re-executar `commands.suiteFull` e reavaliar contrato — não emendar por prosa.
3. R3 (hook não dispara em `spawn_agent`, issue #49736) — risco aceito, paridade best-effort.

## Veredito

```
VERIFY STATUS: APROVADO ⏸ (ressalva externa A6)

Ressalva (não bloqueante, dono: usuário):
- A6 smoke real PENDENTE; Codex CLI ausente. Não é defeito de código.
- codex --version / codex execpolicy check não executados.

Evidência re-medida 2026-11-24 (verde):
- commands.suiteFull: plugins 488/488, scripts 292/292, static/sdd/vendor exit 0.
- acceptance-clean-room 14/14; dualrun ok:true hits:[] checked:116;
  inventory problems:[] skills:33.
- Contrato I1–I9/I2–I7 íntegro; inventário de 7 superfícies preservado.
- code review APPROVED, 0 críticos (workflow-state.json: code_review.last_status
  = passed, critical_issues = 0; gates P3_P4 e P4_P5 aprovados).
- Drift externo em .agents/skills/** é baseline declarado (override
  skills-baseline-drift), não divergência.
```

Skipped: não executei `codex --version` nem `codex execpolicy check` (CLI ausente — A6, dono usuário). Risco: codes de gate em `spawn_agent` continuam sem contraprova empírica.
