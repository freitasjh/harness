# harness/ — chunk de escopo (ADR-003 AGENTSMD-01)

Carrega quando o cwd está em `harness/`. Raiz `AGENTS.md` continua válida e vem primeiro.

## Convenções de evidência

- Relatório em `harness/<demand>.json` conforme `.agents/schemas/harness-report.schema.json`.
- `selfReported` é honesto: quem prova é o gate, não o executor; re-executar `commands.suiteFull`.
- `codex-port-smoke.json` é template: sem campos `token`/`api_key` e sem padrões de segredo em valores.
- Fixtures em `harness/fixtures/` são dados de teste, não código de produção.
- Nenhuma porta, nenhuma rede; tmp com cleanup.
