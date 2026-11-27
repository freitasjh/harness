# Playbook de análise

Este arquivo detalha como executar a skill. O contrato permanece em
`assets/codebase-analysis-contract.md`.

## Eixos obrigatórios

1. **Definição e fronteiras.** O que é o alvo, o que não é, quais termos o
   projeto usa. Diferencie módulo, funcionalidade e superfície.
2. **Regras e precedência.** `AGENTS.md`, rules, steering, hooks, metadata de
   agentes e configuração de plataforma. Registre conflito com `arquivo:linha`.
3. **Mapa do repositório.** Estrutura, manifests, lockfiles, linguagens, build,
   diretórios de código, config e arquivos gerados. Separe contagem do
   inventário de leitura efetiva.
4. **Arquitetura.** Contexto, containers, componentes, ownership, fronteiras
   de rede e dependências externas. Use apenas níveis que agregam valor.
4b. **Backend, frontend e SQL/dados.** No modo `full`, aplique
   `backend-lens.md`, `frontend-lens.md` e `sql-lens.md`. Cada lente produz
   evidência própria; nenhuma é opcional por conveniência.
5. **Contratos e dados.** Entry points, parâmetros, payloads, respostas,
   persistência, eventos, tenant e PII.
6. **Segurança estática.** Autenticação, autorização, validação de entrada,
   cripto e segredos, configuração, supply chain, logging, erro e lógica.
7. **Testes e operação.** O que é unitário, o que exige integração, mocks
   perigosos, CI/CD, deploy, observabilidade e recuperação.
8. **Evidência e lacunas.** Cada afirmação com `arquivo:linha` ou fonte
   externa com URL + data. O que não dá para saber sem rodar vira pergunta.

## Gates entre fases

| Gate | Entrada | Saída | Critério de avanço |
|---|---|---|---|
| G0 | Pedido do usuário | Plano travado | alvo, modo, inclusões e exclusão presentes |
| G1 | Plano | Inventário | `collect.mjs` executado ou limitação declarada |
| G2 | Inventário | Mapa de regras e contexto | regras citadas e arquitetura mínima descrita |
| G3 | Mapa | Achados classificados | cada achado tem classe, padrão e evidência |
| G4 | Rascunho de relatório | Relatório validado | `validate-evidence.mjs` sem erros |

Nenhum gate é negociado por conveniência. Se uma ferramenta não existir,
declare a limitação e reduza o alcance; não simule resultado.

## Checklist operacional

- [ ] Travar alvo, modo, `ref`, inclusões e exclusões.
- [ ] Rodar `scripts/plan.mjs` e salvar o plano.
- [ ] Rodar `scripts/collect.mjs` e conferir truncamento.
- [ ] Ler regras na ordem de precedência observada.
- [ ] Reconstruir contexto mínimo mesmo em modo focado.
- [ ] No modo `full`, preencher a matriz de cobertura das cinco camadas.
- [ ] No modo `full`, aplicar lentes de backend, frontend e SQL/dados.
- [ ] Escolher lentes adicionais: arquitetura, segurança, testes, operação.
- [ ] Classificar achados sem promover alerta a confirmação.
- [ ] Preencher cartões de evidência para achados de segurança.
- [ ] Rodar `scripts/validate-evidence.mjs` no rascunho.
- [ ] Listar lacunas e handoffs antes de entregar.

## Saturação de subquestão

Uma subquestão termina em um destes estados:

- fonte local aberta com `arquivo:linha`;
- fonte oficial externa aberta com URL e data da consulta;
- inferência rotulada com alvo concreto de verificação.

Se nenhum dos três aconteceu, continue buscando ou diga explicitamente que a
ferramenta ou a permissão não está disponível. Não encerre com “provavelmente”.

## Modos em detalhe

### `full`
Percorre todos os eixos. Saída esperada: mapa completo, mesmo que some eixos
não aplicáveis com motivo.

### `feature`
Parte da funcionalidade e caminha para trás até entry point e para a frente
até persistência/resposta. Contexto mínimo é obrigatório.

### `diff`
Parte da mudança, identifica arquivos tocados e expande para contratos e
regras que a mudança pode violar. Não assume que o resto do repo é seguro.

### `security`
Parte de uma superfície ou requisito e aplica a lente de segurança. Ainda cita
regras e arquitetura que limitam o impacto do achado.

## Formato de raciocínio na saída

Não escreva cadeia de pensamento. Escreva apenas:

```text
Observação: <arquivo:linha mostra X>
Interpretação: <isso pode significar Y>
Confiança: <alta | média | baixa> — <motivo>
Próxima verificação: <o que faria mudar a classificação>
```
