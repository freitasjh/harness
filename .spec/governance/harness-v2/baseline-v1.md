# Baseline v1 — Harness v2 (F0)

Data: 2026-11-18T11:54:43-03:00
Commit base: `381b5e0` · Tag: `v1.0` · Branch de trabalho: `v2`
Ambiente: node `v26.7.0` · opencode `v2.3.0` · Linux

## 1. Suíte completa (H1/H2)

Comando canônico (`harness.config.json.commands.suiteFull`, executado por partes):

| Etapa | Comando | Resultado |
|---|---|---|
| Plugins/gates | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | **540 testes / 128 suítes / 0 falhas** (1.217 ms) |
| Instalador | `node --test "installer/__tests__/*.spec.mjs"` | **1.091 testes / 241 suítes / 0 falhas** (6.081 ms) |
| Checks estáticos | `node scripts/static-checks.mjs` | exit 0 — V2/V3/V6/V6b/V7/V15/V14/V18/V19/V20/PRD-01/ADR-01/ADR-02 PASS; V12 e LEGACY em INFO |
| Vendor | `node scripts/vendor-skills.mjs --check` | `vendor-check OK (.agents/skills/.vendor-lock.json)` |

**Total: 1.631 testes, 0 falhas, 0 skips.**
Veredito H2: **zero débito pré-existente** — F1 pode apagar o instalador sem mascarar regressão.

## 2. Diretório de comandos (confirmado)

Runtime v2.3.0 descobre `.opencode/commands/` (plural, canônico) e também o legado singular `command/`.
Decisão: novos comandos em `.opencode/commands/` — coincide com o que os consumidores já usam.

## 3. Inventário do que F1 remove

| Alvo | Arquivos | LOC (mjs/js/rs) | Tamanho |
|---|---|---|---|
| `installer/` | 65 | 18.118 | 3,0 MB |
| `installer-rs/` | 71 | 6.694 | 403 MB (`target/` incluso; fonte limpa ~3,7k linhas) |
| `packaging/` | 11 | 560 | 92 KB |
| `.agents/skills/harness-installer/` | 1 | — | 24 KB |
| `docs/INSTALACAO.md` | 1 | — | 19 KB |
| **Total** | **149** | **25.372** | — |

Lixo de raiz a remover: `{{PROVA_TMP}}/`, `baseline-suite.log`. Não há `.harness-backup*` no repo.

## 4. Referências que F1 precisa corrigir (fora de `installer/`)

Arquivos que citam/importam `installer/` e não podem ficar apontando para path apagado:

| Arquivo | Tipo de referência |
|---|---|
| `harness.config.json` | `commands.suiteFull` inclui `installer/__tests__` |
| `scripts/static-checks.mjs` | importa `../installer/contract-registry.mjs`; checks V15/V20 sobre `installer/` |
| `scripts/vendor-skills.mjs` | comentário/asserção de vendor por eixo |
| `scripts/test-temp.mjs` | regras testadas em `installer/__tests__/test-temp.spec.mjs` |
| `.opencode/plugins/lib/cdl/checks.mjs` | leitura de vocabulário/população derivada do installer |
| `.opencode/plugins/lib/refs/checks.mjs` | refs para paths do installer |
| `.opencode/plugins/lib/inventory/checks.mjs` | inventário por eixo (edge/rule/agent × installer) |
| `.opencode/plugins/__tests__/inventory.spec.mjs`, `cdl.spec.mjs` | fixtures com paths do installer |
| `.github/workflows/harness-integrity.yml` | passos de suíte/instalação |
| `README.md`, `spec-developed.md` | instruções `node installer/install.mjs` |
| `.agents/rules/harness-config.md`, `brain-context.md`, `gate-contract.md` | citações de comportamento/garantia "do instalador" |
| `.agents/skills/VENDOR-NOTICE.md` | origem do vendor |

## 5. Ciclos ativos que a v2 supersede

`workflow-state.json.current_feature = prd-eixos-separados-cli-adr-002`; PRDs abertos relacionados:
- `prd-installer-rust` (substituído: não haverá instalador)
- `prd-eixos-separados-cli` (substituído: sem perfis/eixos no bootstrap)

Ação em F1: registrar ambos em `workflow-state.superseded_cycles` e congelar seus `.spec/**` como histórico (sem apagar — `.spec/prd/**` é ledger).

## 6. Conclusão F0

- Baseline verde e reprodutível (1.631 testes).
- Path de comandos decidido.
- Inventário fechado: 149 arquivos / 25.372 linhas / ~3,1 MB úteis + 403 MB de `target/`.
- Referências mapeadas para não deixar import quebrado em F1.

F0 concluída. Próximo: F1 (apagar instalador + criar `harness-sync.mjs`/`seal.mjs`).
