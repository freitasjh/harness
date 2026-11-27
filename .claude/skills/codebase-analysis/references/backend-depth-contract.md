# Contrato de profundidade do backend

Este arquivo complementa `full-depth-contract.md`. Ele define o que torna uma
análise de backend realmente completa. Contar arquivos e citar dois controllers
não é suficiente.

## Artefatos obrigatórios

### 4.2.1 Matriz de endpoints

Tabela com pelo menos uma linha por controller relevante e colunas:
`Controller | Rota | Verbo | Autorização | Tenant | Teste`.

- `Autorização` distingue público, self-service, papel (`@HasPermission`) e
  ACL de recurso.
- `Tenant` distingue `@TenantScoped`, gestão global e self-service.
- `Teste` aponta para IT ou teste que cobre a rota; use `—` se não houver e
  registre a lacuna.

### 4.2.2 Grafo de módulos

- Levantar dependências entre módulos a partir de `pom.xml`, não de prosa.
- Mostrar pelo menos quatro arestas com `arquivo:linha`.
- Classificar cada aresta como contrato (`api`), implementação (`impl`),
  transporte (`web`) ou infraestrutura (`dbupdate`).
- Registrar ciclo, dependência invertida ou módulo que concentra acoplamento.

### 4.2.3 Fluxos críticos

Pelo menos três fluxos ponta a ponta, cada um com origem, decisões, efeito e
teste. Sugestão mínima: login/emissão de token, upload/download de documento e
concessão/remoção de ACL. Cada fluxo precisa de referências em código, não só
na régua.

Formato:

```text
 nome do fluxo
 origem: arquivo:linha
 decisões: arquivo:linha; arquivo:linha
 efeito: arquivo:linha
 teste: arquivo:linha
 falha: o que acontece se cada controle falhar
```

Pelo menos um desses fluxos deve vir com `sequenceDiagram` Mermaid, com a
legenda de participantes e ramificações ancorada em `arquivo:linha`. O mapa de
módulos deve vir com `flowchart` Mermaid quando houver mais de três módulos.

### 4.2.4 Modelo de dados e consistência

- Mapear tabelas críticas com `arquivo:linha` na migration e na entidade.
- Para cada tenant: chave, FK, `NOT NULL`, índice que sustenta o filtro,
  exceção registrada e condição de revisão.
- Transações e idempotência: quem escreve, em que ordem e como evitar
  duplicação.
- Backfill/convergência: migração e caminho de runtime precisam semear o mesmo
  dado.

### 4.2.5 Testes e controles

Matriz `Controle | Teste | Caso negativo | Lacuna`. Um controle crítico sem
caso negativo é lacuna, mesmo com código correto.

### 4.2.6 Ameaças e riscos

Para cada ativo/trust boundary relevante, registre ameaça, controle existente,
evidência, severidade e incerteza. Não basta repetir o Top 10: diga qual ativo,
qual fronteira e qual caminho de dado.

## Evolução

`## 10. Plano de evolução` é obrigatório quando o pedido pede “como evoluir”.
Cada item traz:

| Ordem | Ação | Arquivo alvo | Aceite | Risco |
|---|---|---|---|---|

- `Aceite` precisa ser verificável: teste, comando, métrica ou asserção.
- `Risco` diz o que pode quebrar e qual é a mitigação.
- Itens P0/P1/P2 são recomendações, não autorização para implementar.

## Validação

`scripts/validate-evidence.mjs` aplica este contrato quando `full` inclui
backend. Relatório sem matriz de endpoints, grafo, fluxos, modelo de dados,
testes, ameaças e plano de evolução falha mesmo que tenha resumo elegante.
