<!-- scope: adr/ADR-001 -->
# VERIFY — ADR-001: Inventário e contrato de paridade opencode↔Codex

Data: 2026-11-24 · Branch: `adr/prd-codex-port/01-inventario-contrato` · Papel: `qa-engineer` (verificação independente; nenhuma correção de código).

Entradas: `ADR.md` (I1–I7), `SPEC.md`, `TASKS.md` (IC-01..IC-10), `RESEARCH.md` (D1–D8), PRD §16 (critérios A1..A6), `harness.config.json` (`commands.suiteFull`), `workflow-state.json` (`code_review`, gates `P3_P4`) e comandos re-medidos nesta sessão. Convenção de citação: comando/símbolo — sem número de linha em docs.

## Veredito por dimensão

| Dimensão | Veredito | Motivo |
|---|---|---|
| Completude | ✅ | 10/10 tasks IC-01..IC-10 com status `Done` na tabela Sprint Summary; contrato I1–I7 e inventário de 7 superfícies presentes; BDD rastreado em `SPEC.md`/`TASKS.md`. |
| Correção | ❌ | Suíte re-medida diverge da medição declarada (plugins 485/488, scripts 288/292); `checkCodexDualRun()` e `checkCodexInventory()` hoje `ok:false`; A6 ❌ PENDENTE (dono: usuário). |
| Coerência | ❌ | I1 (conjunto fechado) e I5 (dual-run invariante) violados no working tree atual por alterações concorrentes em `.agents/skills/**` — fora do escopo destes VERIFY, mas mensuráveis. |

## 1. Completude

| Item | Veredito | Evidência |
|---|---|---|
| Tasks 100% | ✅ | `TASKS.md` Sprint Summary: 10 linhas `IC-01..IC-10`, todas `Done` (10/10; 0 em status diverso). |
| Contrato congelado | ✅ | `ADR.md` I1 (7 superfícies), I2 (reason codes de `CORE_GATES`), I3 (`permissionDecision:"deny"` / exit 2), I4 (`HARNESS_GATES=off`), I5 (dual-run), I6 (bypass declarado), I7 (smoke empírico). |
| Sem TODO/FIXME/HACK | ✅ | nenhum marcador de dívida introduzido nos artefatos deste ADR; inventário e reason codes permanecem como contrato, não como código morto. |
| BDD cobertos | ✅ | Critérios de aceite das 10 tasks em `TASKS.md` exercitados via `checkCodexInventory`, `checkCodexDualRun` e specs `codex-*`. |
| A6 — smoke real | ❌ PENDENTE | Dono: **usuário**. `harness/codex-port-smoke.json` segue template (`agent: user`, `gitSha` zerado, `counts` 0/0/0, `notes` "preencher após smoke real"). Codex CLI ausente; `codex --version` não executado. Não marcar ✅. |

## 2. Correção

Medição declarada no ciclo (contexto + `IMPLEMENTATION-REPORT.md` / gate `P3_P4`) e re-medição independente executada nesta verificação:

| Comando (de `harness.config.json.commands.*` ou check nomeado) | Declarado | Re-medido 2026-11-24 | Veredito |
|---|---|---|---|
| `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 488/488 | **485 pass · 3 fail · 0 skip** (exit 1) | ❌ |
| `node --test "scripts/__tests__/*.spec.mjs"` | 292/292 | **288 pass · 4 fail · 0 skip** (exit 1) | ❌ |
| `node scripts/static-checks.mjs` | green | exit 0 | ✅ |
| `node scripts/sdd-checks.mjs` | green | exit 0 | ✅ |
| `node scripts/vendor-skills.mjs --check` | green | exit 0 (`vendor-check OK`) | ✅ |
| `node scripts/acceptance-clean-room.mjs` | 14/14 | 14/14 (exit 0, `ACEITE GREEN`) | ✅ |
| `node scripts/check-codex-dualrun.mjs` | `ok:true` | `ok:false` — `hits` em `.agents/skills/**` | ❌ |
| `node scripts/check-codex-inventory.mjs` | 11/8/32/7 | `ok:false` — `skills: 33, esperado 32`; `agents:11`, `rules:8`, `inventoryRows:7` | ❌ |
| A2 paridade de reason codes | fixtures green | coberta por specs `codex-*`, mas suíte agregada vermelha (acima) | ❌ |
| A6 — smoke real com Codex CLI | pendente | **PENDENTE (dono: usuário)** | ❌ |

Causa raiz das divergências re-medidas (diagnóstico apenas — não corrigido, fora do escopo de escrita deste VERIFY):

- `prompt-optimizer.spec.mjs` falha em 3 testes (`Stage 0 prescreve brain literal…`, `ledger registra workflow-state.prompt_assumptions[]…`, `limite de tamanho: SKILL.md … 130 linhas`) porque `.agents/skills/prompt-optimizer/SKILL.md` está na versão portátil v4 (130 linhas, sem `prompt_assumptions`).
- `checkCodexDualRun()` sinaliza `.agents/skills/brainstorming/**`, `.agents/skills/deepsearch/**` e `.agents/skills/prompt-optimizer/**` como paths proibidos; `.opencode/plugins/gate.js` e `lib/gate-core.mjs` são `ALLOWED_EXCEPTIONS` (ADR-002 I8), portanto não explicam os hits.
- `checkCodexInventory()` conta 33 skills porque o skill `brainstorming/` foi adicionado ao working tree; a contagem congelada em I1 é 32.
- Ambiente: zero rede, zero porta; todos os comandos acima são Node ESM/`node --test` com tmp via `tempScope`/`cleanup()` (convenção em `scripts/AGENTS.md`). Nenhuma porta aberta por esta verificação.

## 3. Coerência

| Item | Veredito | Evidência |
|---|---|---|
| I1 conjunto fechado | ❌ | Medição atual: 11 agentes / 8 regras / **33** skills (I1 congela 32); `inventoryRows:7` preservado. Skills extras vêm de `.agents/skills/brainstorming/**` (concorrente), não do port. |
| I2 reason codes | ✅ | Contrato aponta para `CORE_GATES` como fonte única; nenhuma reescrita de reason code em `.codex/**` observada nos artefatos deste ADR. |
| I3 semântica de deny | ✅ | `permissionDecision:"deny"` + `permissionDecisionReason` literal; nenhum formato alternativo introduzido. |
| I4 kill-switch | ✅ | `HARNESS_GATES=off` como contrato compartilhado; ausência de segredo/eco de path na especificação. |
| I5 dual-run invariante | ❌ | `checkCodexDualRun()` hoje `ok:false` por `.agents/skills/**` alterados; exceções `gate.js`/`gate-core.mjs` são legítimas (I8/ADR-002) e não estão nos hits. |
| I6 superfície de bypass | ✅ | `hooks.json` adulterado continua mitigado por A2 + revisão humana; nenhuma nova superfície de bypass descrita. |
| I7 verificação empírica | ❌ | A6 permanece PENDENTE; contrato não foi confirmado por smoke real. |
| Naming / fronteiras | ✅ | Nenhuma camada de domínio nova; ADR-001 é contrato/documentação, sem código de negócio escrito. |

## Riscos residuais

1. A6 — dono **usuário**: instalar Codex CLI, rodar smoke real e preencher `harness/codex-port-smoke.json` (schema, `gitSha`, counts, evaluation, cleanup). Até lá, nenhuma afirmação de ✅ para verificação empírica.
2. Divergência de suíte no working tree atual: 3 falhas em plugins + 4 em scripts, todas rastreadas a mudanças concorrentes em `.agents/skills/**` (fora do escopo destes VERIFY). Re-executar `commands.suiteFull` após essas mudanças serem resolvidas; não foi corrigido aqui.
3. I1/I5 hoje vermelhos por contagem de skills e por diff em `.agents/skills/**`; se essas mudanças forem permanentes, o contrato precisa de nova decisão (ADR), não de emenda por prosa.
4. R3 (hook não dispara em `spawn_agent`, issue #49736) — risco aceito, paridade best-effort.

## Veredito

```
VERIFY STATUS: BLOQUEADO ❌

Bloqueadores:
- A6 smoke real PENDENTE (dono: usuário; Codex CLI ausente).
- commands.suiteFull re-medido vermelho: 485/488 plugins, 288/292 scripts;
  checkCodexDualRun/checkCodexInventory ok:false (mudanças concorrentes em
  .agents/skills/**, fora do escopo destes VERIFY).

Não bloqueante neste ADR:
- code review APPROVED, 0 críticos (workflow-state.json: code_review.last_status
  = passed, critical_issues = 0; gate P3_P4 aprovado com 488+292 e 0 fail).
- Contrato I2/I3/I4/I6 e inventário de 7 superfícies íntegros nos artefatos.
```

Skipped: não executei `codex --version` nem `codex execpolicy check` (CLI ausente — A6, dono usuário). Risco: codes de gate em `spawn_agent` continuam sem contraprova empírica.
