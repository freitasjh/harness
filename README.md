# Harness — enforcement duro para agentes opencode

Prosa descreve; quem nega é `gate.js` + CI. Os portões são aplicados no runtime
(hook `execute.before`), com evidência verificável por máquina e honestidade
declarada onde não há garantia. Não há wizard, perfil de stack nem rede no sync.

## Quickstart

```sh
# neste repo (Node 20+, opencode v2)
node --test ".opencode/plugins/__tests__/*.spec.mjs"
node --test "scripts/__tests__/*.spec.mjs"
node scripts/static-checks.mjs
node scripts/sdd-checks.mjs
node scripts/vendor-skills.mjs --check
node scripts/acceptance-clean-room.mjs        # A1..A7, exit 0 só se tudo passar
```

Em outro repo: `node scripts/harness-sync.mjs init --target <dir> --suite "node
--test"`, depois `doctor --target <dir>`. O plano antes de escrever é
`--dry-run`. Detalhe completo (backup, preservação, merge, selo, symlink) em
[`docs/ref/sync.md`](docs/ref/sync.md); funcionamento completo em
[`docs/FUNCIONAMENTO.md`](docs/FUNCIONAMENTO.md).

## Comandos do operador

| Comando | O que faz |
|---|---|
| `init --target <dir>` | cria payload + config mínimo; recusa alvo com estado do harness |
| `update --target <dir>` | backup fora do alvo, grava só o que mudou, órfão só reportado |
| `doctor --target <dir>` | somente leitura; lista cada `FAIL <o quê>: <path>` |
| `/harness-init` · `/harness-update` · `/harness-doctor` | mesma tríade pelo agente (plano → confirmação → aplica → valida) |
| `/ui-bootstrap` | detecta React/Vue e prepara DESIGN.md, tokens e Storybook (com `--dry-run` antes) |
| `/ui-audit` | auditoria somente leitura de tokens/estados/a11y |
| `/ui-review` | build estático do Storybook + revisão no browser; nada é editado |

Os comandos `/harness-*` e `/ui-*` vivem em `.opencode/commands/` e são payload.
`targets`/`commands` são detectados do projeto; `--suite`/`--unit` sobrepõem.

## Esteira PRD → ADR → SDD

`PRD → RESEARCH → ADR-INDEX → ADR (ADR.md + SPEC.md + TASKS.md + VERIFY.md) →
implementação → VERIFY → archive`. 1 ADR = 1 branch = 1 PR = 1 revisão. Um PRD
que declara `prd_version: 2` exige `unit: adr` nas linhas `in-progress`/`merged`
do índice, e cada `TASKS.md` deve levar `<!-- scope: adr/<ID> -->`. Os checks
`PRD-01`/`ADR-01`/`ADR-02` medem isso e entram no `commands.suiteFull`.

## Gates (runtime)

| Gate | Nega quando | Símbolo |
|---|---|---|
| PICCO | `task` sem `<open_questions>` (ou com conteúdo) | `checkPicco` |
| Completed anchor A | sem relatório, selo divergente, contraprova divergente/timeout, `frontend_evidence` ausente com alvo frontend | `gateCompletionAnchorA`, `requireFrontendEvidence` |
| Completed anchor B | novo ciclo com o anterior não fechado | `checkAnchorB` |
| HITL | 3º `task` consecutivo sem turno humano | `gateHitlBatch` |
| Higiene | `pkill -f`, redireção para path protegido, qa fora de `harness/` | `gateShellHygiene` |
| Escrita | path protegido fora das papéis de implementação; orquestrador fora de `.spec/**` + state | `checkWriteAccess` |

Modo vem de `gates.*` no config + env do host: `HARNESS_GATES=off` desliga a
suíte no host (o config nunca desliga), `HARNESS_GATE_<GATE>` rebaixa com
`_REASON` obrigatório (`resolveGateMode`, `auditConfigGates`). Downgrade sem
motivo é recusado. O gate de Completed usa `contraproveExec` injetável e
`HARNESS_SEAL_JSON`; ver [gate-contract.md](.agents/rules/gate-contract.md) §1.

## Orçamentos medidos em 2026-11-18 (sem previsão)

| Grandeza | Valor medido |
|---|---|
| Specs de plugin / testes | 21 specs, 488 testes, 0 falha, 0 skip |
| Specs de scripts / testes | 7 specs, 152 testes, 0 falha, 0 skip |
| `always-on.md` | 10.309 bytes, 103 linhas |
| `workflow-state.json` | 17.631 bytes |
| Payload (manifest) | 283 arquivos, 1.884.227 bytes (~1,79 MiB) |
| README / AGENTS | 98 / 55 linhas (limite 150 cada) |

Os números acima são uma fotografia com data: mudou o repo, meça de novo.
`docs/FUNCIONAMENTO.md` registra os limites declarados de cada garantia.

## Verificação e CI

`commands.suiteFull` encadeia as duas suítes, `static-checks` e
`vendor-skills --check`. `sdd-checks` roda à parte, nos workflows
`.github/workflows/harness-integrity.yml` (push/PR, com trailer
`Harness-Gate-Change: <aprovador>` em path protegido) e
`.github/workflows/harness-acceptance.yml` (suítes + aceite clean-room; detalhe
em [`docs/ref/acceptance.md`](docs/ref/acceptance.md)): sem LLM e sem UI real —
a contraprova de verdade permanece no host.

Mudou `commands.suiteFull`? Reexporte o selo: `eval "$(node scripts/seal.mjs
--env)"`.

## Estrutura e Histórico

`.opencode/plugins` (gates + libs + testes), `.opencode/commands`, `.agents`
(rules/agents/skills/schemas), `scripts` (sync, checks, aceite), `harness/`
(evidência), `.spec/` (governança, tech-debts, archive), `workflow-state.json`.
Specs concluídas em `.spec/archive/` e `spec-developed.md`; sessões e lições no
Brain (`sessoes/harness/*`, `regras/global/*`).
