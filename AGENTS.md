# AGENTS — contrato curto para quem trabalha neste repo

Fonte canônica: `.agents/rules/always-on.md` (carregada por
`opencode.json.instructions`). Prosa descreve; `gate.js` + CI negam. Em conflito,
a regra em disco e o gate vencem esta página.

## Antes de começar

- `brain_search` com o prompt literal; `brain_store` depois (decisões/lições).
- Sem spec (feature) ou análise (bug), não implemente. Sem testes, não entregue.
- Toda delegação `task` leva bloco PICCO com `<open_questions></open_questions>`
  vazio; pergunta sem tag é negada por `checkPicco`.
- Dados do projeto vêm de `harness.config.json`, nunca de literal de prosa.
- Zero rede, zero porta e tmp com cleanup nos scripts de aceite/check.

## Papéis e escrita

| Papel | Escrita |
|---|---|
| orchestrator | `.spec/**` + `workflow-state.json` apenas |
| frontend-engineer / backend-engineer | código e testes; exceção de path protegido sob delegação |
| qa-engineer | `harness/**` apenas |
| code-reviewer · ux-designer · security-engineer · design-system-specialist | parecer, sem `edit` |

`checkWriteAccess` aplica a tabela no runtime; o trailer
`Harness-Gate-Change: <aprovador>` é cobrado pelo CI em path protegido.

## Ciência do ciclo

`PRD → RESEARCH → ADR-INDEX → ADR (ADR.md + SPEC.md + TASKS.md) → implementação
→ VERIFY → archive`. 1 ADR = 1 branch = 1 PR = 1 revisão humana. `PRD-01`/
`ADR-01`/`ADR-02` rodam em `scripts/static-checks.mjs`. Não crie tag nem commit
sem instrução explícita.

`Completed` exige relatório em `harness/<demand>.json` válido no schema
`.agents/schemas/harness-report.schema.json`, selo `HARNESS_SEAL_JSON` coerente
e contraprova re-executando `commands.suiteFull`. `selfReported` é honesto:
quem prova é o gate, não o executor.

## Comandos que todo mundo roda

```sh
node --test ".opencode/plugins/__tests__/*.spec.mjs"
node --test "scripts/__tests__/*.spec.mjs"
node scripts/static-checks.mjs
node scripts/sdd-checks.mjs
node scripts/vendor-skills.mjs --check
node scripts/acceptance-clean-room.mjs
```

`init/update/doctor` e `/ui-*` estão em
[`docs/ref/sync.md`](docs/ref/sync.md); o aceite A1..A7 em
[`docs/ref/acceptance.md`](docs/ref/acceptance.md); os mecanismos e garantias em
[`docs/FUNCIONAMENTO.md`](docs/FUNCIONAMENTO.md). Cite sempre símbolo ou seção —
nunca `arquivo.ext:NNN` em `docs/**`.
