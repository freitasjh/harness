# Contrato de profundidade do modo `full`

Este arquivo define o que significa “análise completa”. Ele existe para impedir
que um relatório `full` seja aprovado com governança, regras e poucos trechos
de código.

## Cobertura mínima obrigatória

Quando o escopo inclui backend, aplique também
`backend-depth-contract.md`: matriz de endpoints, grafo de módulos, fluxos
críticos, modelo de dados, matriz de testes, ameaças e plano de evolução.
Todo `full` deve incluir pelo menos um `flowchart` e um `sequenceDiagram` com
legenda de código; use `references/diagram-lens.md` para sintaxe e evidência.

| Camada | Obrigatório no modo full |
|---|---|
| Regras | todas as instruções aplicáveis encontradas, com precedência e conflitos |
| Backend | módulos, entry points, serviços/domínio, persistência, segurança, integrações, testes |
| Frontend | rotas, componentes/páginas, estado, autenticação no cliente, renderização, build/testes; se explicitamente excluído no Gate 0, a seção deve dizer `Fora do escopo — motivo` |
| SQL e dados | migrações, tabelas críticas, tenant, constraints, queries, dado sensível, testes de dados |
| Contratos | entrada/saída, autenticação, autorização, erro, paginação e tenant por fronteira |
| Operação | configuração, CI/CD, deploy, observabilidade e o que exige runtime |

## Matriz de cobertura

Todo relatório `full` traz uma tabela com pelo menos estas linhas:

```markdown
| Camada | Arquivos encontrados | Arquivos lidos | Evidência representativa |
|---|---|---|---|
| Regras | <n> | <n> | `AGENTS.md:1` |
| Backend | <n> | <n> | `...Controller.java:1`; `...ServiceImpl.java:1` |
| Frontend | <n> | <n> | `...vue:1`; `...store.ts:1` |
| SQL e dados | <n> | <n> | `V....sql:1`; `...Repository.java:1` |
| Testes | <n> | <n> | `<IT.java:1`; `...spec.ts:1` |
```

“Arquivos lidos” significa leitura efetiva de trechos relevantes, não contagem
do inventário. Se a leitura foi amostrada, diga isso e explique o critério.

## Regras de evidência por camada

- Backend: pelo menos duas referências `arquivo:linha` em `### 4.2 Backend`.
- Frontend: pelo menos duas referências em `### 4.3 Frontend`.
- SQL e dados: pelo menos duas referências em `### 4.4 SQL e dados`, sendo
  pelo menos uma para `.sql` e uma para entidade/repositório.
- Achados de segurança devem apontar para código real, não somente para a
  régua de segurança. A régua pode aparecer como contexto, nunca como única
  evidência.
- Uma camada explicitamente excluída no Gate 0 continua aparecendo na matriz e
  na seção, mas com `Fora do escopo — motivo`. Isso é decisão de escopo
  registrada, não lacuna escondida.

## Quando a cobertura não é possível

- Diretório ausente: registrar “não existe” com o comando ou caminho probing.
- Arquivo grande demais: registrar limite e critério de amostragem.
- Dado ou ambiente inacessível: virar lacuna ou handoff, nunca conclusão.

## Validação

`scripts/validate-evidence.mjs` aplica este contrato quando o modo é `full`.
Um relatório sem as seções backend, frontend e SQL/dados ou sem as referências
mínimas falha, mesmo que tenha resumo e achados bem escritos.
