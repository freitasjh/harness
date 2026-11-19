# SPEC — Harness v2

Ciclo: `harness-v2` · Branch: `v2` · Base: `PROPOSAL.md` · Plano: `PLAN.md`

## 1. Requisitos funcionais

| ID | Requisito | Aceite verificável |
|---|---|---|
| RF-01 | Bootstrap por 3 verbos (`init`, `update`, `doctor`) sem wizard, perfis, eixos ou TUI | `scripts/harness-sync.mjs` + `scripts/__tests__/sync.spec.mjs` verdes |
| RF-02 | `init` recusa alvo com estado do harness (`.agents/`, `.agents/skills/`, `.opencode/plugins/`, `.opencode/commands/`, manifesto) e recusa `suiteFull` nulo | testes SYNC-01/SYNC-02 |
| RF-03 | `update` grava só o que difere, preserva `harness.config.json`, `workflow-state.json`, `.agents/rules/project-*.md` e `.spec/**`, e reporta `orphan` sem apagar | testes SYNC-03/SYNC-08 |
| RF-04 | Toda escrita é atômica e o manifesto é o último write; symlink no destino ou `target == fonte` aborta o run antes do backup | SYNC-07 + `assertSafeWrite`/`assertNotSource` |
| RF-05 | Backup fora do target, com timestamp em ms, sobrescrevível por `--backup-dir` (nunca dentro) | SYNC-04 |
| RF-06 | `doctor` é somente leitura e valida camadas, JSONs, `commands.suiteFull` e sha256 do manifesto; WARN (nunca fail) para o pin do `brain` | SYNC-06 + V21 |
| RF-07 | Pipeline PRD → RESEARCH → ADR-INDEX → ADR com `SPEC.md`/`TASKS.md` **dentro do diretório do ADR** | `ADR-01`/`ADR-02` em `prd-adr-pipeline/checks.mjs` |
| RF-08 | Roster com `frontend-engineer` e `backend-engineer` separados; `engineer` (md-only, deepsearch) faz análise/PRD/ADR sem decidir | `opencode.json` + `V21` |
| RF-09 | Storybook como contrato visual: story por estado antes da página; evidência com `stories[]`, `screenshots[]`, `a11y` | gate `evidence` (F6) |
| RF-10 | Prompt-optimizer v3: probe de repo + brain antes do score, ledger de premissas, PICCO com `arquivo:linha` | fixtures de prompt (F5) |
| RF-11 | Aceite clean-room executável | `scripts/acceptance-clean-room.mjs` + CI |
| RF-12 | Consumidor atualiza por `update` com backup; `init` é o único caminho de primeira instalação | probes P2/P6 do review F1 |

## 2. Requisitos não-funcionais

| ID | Requisito | Meta |
|---|---|---|
| NFR-01 | Orçamento de contexto always-on | `.agents/rules/**` ≤ 20 KB |
| NFR-02 | Orçamento de prompts de papel | `orchestrator` ≤ 160 linhas; agentes ≤ 1.100 linhas no total |
| NFR-03 | Payload de skills | ≤ 1,8 MB, sem `dart-*`/`flutter-*` no core |
| NFR-04 | Estado | `workflow-state.json` ≤ 20 KB + `workflow-history.jsonl` |
| NFR-05 | Zero rede no caminho de instalação | `NET-01` cobre builtins, clientes HTTP, `fetch`/`WebSocket` e comandos de download |
| NFR-06 | Toda afirmação de gate cita mecanismo | `gate-contract.md` §1 |

## 3. Contratos que não podem quebrar

1. `gate.js` mantém `picco`, `evidence`, `hitlBatch` e higiene; nenhuma fase da v2 remove gate.
2. Selo: `scripts/seal.mjs` sela **todas** as chaves de `commands`; `verifySeal` é simétrico (chave a mais ou a menos ⇒ deny).
3. `harness-report.schema.json` continua sendo o formato de evidência; F6 adiciona `frontend_evidence` como campo obrigatório quando há frontend.
4. `brain` permanece SSoT de memória; `security-review` permanece SSoT de segurança.
5. `.opencode/plugins/lib/prd-adr-pipeline/` é path propagável pelo sync.

## 4. Arquitetura alvo (resumo)

```
.agents/rules/          4 arquivos (workflow, harness-continuous, gates, engineering-standards)
.agents/agents/         orchestrator, engineer, product-manager, architect, ux-designer,
                        design-system-specialist, frontend-engineer, backend-engineer,
                        code-reviewer, qa-engineer, security-engineer
.agents/skills/         core + por eixo (react/vue, java/nestjs/node/rust) + deepsearch,
                        design-system, storybook, frontend-quality
.opencode/commands/     harness-init, harness-update, harness-doctor, ui-bootstrap,
                        ui-audit, ui-review
scripts/                harness-sync.mjs, seal.mjs, static-checks.mjs, sdd-checks.mjs,
                        acceptance-clean-room.mjs
.spec/prd/{prd}/ADRs/ADR-00N/   ADR.md + SPEC.md + TASKS.md + VERIFY.md
```

## 5. Delta em relação ao v1

| v1 | v2 |
|---|---|
| `installer/` + `installer-rs/` + `packaging/` | `scripts/harness-sync.mjs` (~600 linhas) |
| `stack` + 12 perfis + eixos | `targets` detectado (`frontend`, `backend`) |
| SPEC/TASKS por feature | SPEC/TASKS por ADR |
| `developer-engineer` único | `frontend-engineer` + `backend-engineer` |
| Pulse hardcoded | tokens/`DESIGN.md` do destino + Storybook |
| V15/V19/V20 | `NET-01` + `V21` (CDL/roster declarados em tech-debt) |

## 6. Verificação

- `node --test ".opencode/plugins/__tests__/*.spec.mjs"` → 418/418
- `node --test "scripts/__tests__/*.spec.mjs"` → 45/45
- `node scripts/static-checks.mjs` → exit 0 (inclui V21)
- `node scripts/vendor-skills.mjs --check` → OK
- `node scripts/sdd-checks.mjs` → exit 0
- F8: `scripts/acceptance-clean-room.mjs` → clean-room completo
