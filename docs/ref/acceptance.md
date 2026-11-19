# Aceite clean-room (A1..A7)

`node scripts/acceptance-clean-room.mjs` imprime `PASS <cenário>` / `FAIL
<cenário> <motivo>` e escreve `harness/acceptance-clean-room.json`. Exit 0 **só**
com os 7 cenários verdes; exit 1 nomeia o que falhou. O relatório é válido no
schema (`version`/`demand`/`agent`/`phase`/`gitSha`/`commands`/`counts`/
`evaluation`/`brainStore`/`cleanup`/`selfReported`) e acrescenta `at`,
`scenarios`, `selfReportedNote`, `gateCalls`.

| Cenário | Mecanismo exercitado | Negativo que prova que o gate está vivo |
|---|---|---|
| A1 | CLI real `harness-sync init --target <tmp> --suite "node --test"` + `doctor` | camada/config/`instructions` ausentes ⇒ FAIL |
| A2 | `runPrdChecks` sobre PRD v2 com 2 ADRs `unit: adr` (merged + in-progress) | PRD-01/ADR-01/ADR-02 não PASS ⇒ FAIL |
| A3 | 3 mutações na fixture | `SPEC.md` removido, `TASKS.md` na raiz do PRD, marcador `scope: adr/ADR-999` ⇒ ADR-01 FAIL; restauração ⇒ PASS |
| A4 | `gatePiccoTask`, `gateHitlBatch` | sem `<open_questions>` ⇒ `picco-tag-absent`; 3º task sem turno ⇒ `hitl-pause-required`; tag vazia/turno humano ⇒ allow |
| A5 | `gateCompletionAnchorA`, `checkAnchorB` | relatório ausente ⇒ `completed-no-evidence`; estado anterior aberto ⇒ `prev-cycle-not-completed`; com selo + `contraproveExec` stub ⇒ allow |
| A6 | `gateCompletionAnchorA` com `targets.frontend="react"` | sem `frontend_evidence` ⇒ `frontend-evidence-missing`; stories/screenshots/a11y válidos ⇒ allow |
| A7 | validador do subset do schema | remover `brainStore` ⇒ violação `required`; relatório completo ⇒ 0 violações |

## Limite declarado (Q1=A)

- **Dentro:** mecanismos chamados diretamente, fixtures em tmp com cleanup,
  zero rede, zero porta, zero LLM. O CI (`harness-acceptance.yml`) roda as
  suítes e os checks canônicos antes do aceite.
- **Fora:** tela real, score 7/10, runner de LLM, frontend deste repo (não há).
  A contraprova aqui é **stub** — a contraprova de verdade (selo publicado pelo
  host + re-execução de `commands.suiteFull`) continua no gate de Completed no
  host. Por isso `selfReported: true` e a nota explicativa no relatório.
- **Anti-vacuidade:** as dependências são injetáveis e
  `scripts/__tests__/acceptance-clean-room.spec.mjs` tampera gates e validador:
  um gate no-op ou um validador que sempre retorna `[]` tem que virar FAIL.
  `gateCalls` instrumenta as chamadas; verde sem chamadas suficientes é FAIL.

## Dívidas tratadas pelo orquestrador em `.spec/**`

- **D3** (`.spec/tech-debts/harness-v2-path-identity/TASKS.md`): range de doc —
  resolvido em F8 com evidência no ledger: citações em `docs/**` são por
  símbolo ou seção, nunca por linha.
- **SEARCH-05** (`.spec/governance/harness-v2/TASKS.md`): resolvido em F8 com
  evidência no ledger. V6 do `prompt-optimizer` passa a assertar presença de
  `type` (string não vazia), não o valor transitório; edição de `.spec/**` é do
  orquestrador.
