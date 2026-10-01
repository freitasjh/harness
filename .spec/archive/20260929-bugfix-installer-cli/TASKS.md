# Bugfix — CLI do instalador não executa (só preflight)

## Bug
`node installer/install.mjs --target X [--dry-run]` imprime `{"ok":true,...}` e sai.
Nenhuma pergunta (Q&A), nenhum plano, nenhuma instalação. SKILL + README documentam
esse comando como instalação real. Reportado pelo usuário em 2026-09-29
("não faz pergunta nem nada"). Reproduzido pelo orquestrador antes de afirmar.

## Causa raiz
Bloco CLI (`installer/install.mjs:625-633`) chama **só** `preflight()`; `main()` nunca
é invocado. Faltam 3 peças: (1) prompting interativo do Q&A (com modo não-interativo),
(2) montagem canônica dos `incomingFiles` (dogfood montou ad hoc), (3) impressão do plano.
Camada: `installer/` (CLI). Módulo: entrypoint. Arquivo/função: `install.mjs:615-633`.

## Solução + arquivos + impacto
- Fiar o CLI: `parseArgs` + Q&A interativo (readline) com fallback `--answers-file` e
  abort limpo sem stdin (nunca travar); montar incoming varrendo `.opencode`+`.agents`
  (lista canônica, excluindo node_modules/.git); imprimir plano; confirmação por camada
  (RF-10); aí chamar `main()`.
- **Mudança de comportamento incluída**: dry-run NÃO cria backup (hoje cria — viola I4
  "nada escrito em dry-run"). Dry-run passa a ser: inventário + respostas + geração +
  plano + relatório, zero writes (com teste que conta writes).
- Arquivos: `installer/install.mjs` (CLI), `installer/__tests__/cli.spec.mjs` (novo),
  `.agents/skills/harness-installer/SKILL.md` (documentar flags reais).
- Impacto: nenhum no comportamento instalado; dogfood continua via API (inalterado).

## Testes necessários
- CLI com stdin fechado sem `--answers-file` ⇒ aborta com mensagem (não trava).
- `--dry-run` com FS fake ⇒ zero writes (inclui sem backup).
- Plano impresso contém create/merge/flag do fixture.
- Q&A interativo simulado (stdin pipado) ⇒ respostas validadas.
- Suite existente intacta (51 installer + 104 harness).

## Riscos
- Prompt interativo em shell não-interativo trava: mitigado por detecção + abort.
- Escopo: virou mini-feature (CLI real); manter restrito ao entrypoint, sem tocar
  lógica de merge/gates (já provada).
