# Referência — detalhe que não cabe no README/AGENTS

Índice. Citações aqui são por **símbolo** ou **seção**, nunca por número de linha
(`scripts/__tests__/docs-citations.spec.mjs` reprova `arquivo.ext:NNN` em `docs/**`).

| Doc | O que detalha |
|---|---|
| [`sync.md`](sync.md) | `harness-sync.mjs` (`init`/`update`/`doctor`): plano, backup fora do alvo, preservação de dados do projeto, merge do `opencode.json`, selo, recusa de symlink, comandos `/harness-*` |
| [`acceptance.md`](acceptance.md) | aceite clean-room A1..A7, o que prova e o que está fora de escopo (limite Q1=A) |

`docs/FUNCIONAMENTO.md` continua sendo o documento de funcionamento completo
(mecanismos, gates, tabelas de garantia e limites declarados).
