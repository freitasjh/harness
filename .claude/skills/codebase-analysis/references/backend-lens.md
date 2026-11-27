# Lente de backend

Use esta lente no modo `full` e sempre que o alvo incluir serviço, API,
domínio ou persistência. O objetivo é percorrer o código, não descrever o
`AGENTS.md`.

## 1. Mapa de módulos e dependências

- Liste módulos/reatores e sua responsabilidade com `arquivo:linha` no manifest.
- Levante arestas de dependência entre módulos a partir de manifests, não de
  prosa. Registre ciclo ou dependência invertida como achado de arquitetura.
- Diferencie contrato (`api`), implementação (`impl`), migração (`dbupdate`) e
  transporte (`web`) quando essa convenção existir.

## 2. Entry points e contratos HTTP

Para cada controller relevante, registre:

- classe, rota e verbo com `arquivo:linha`;
- autenticação/autorização declarada e onde é aplicada;
- DTO de entrada, `@Valid`/constraints e DTO de saída;
- códigos de resposta e handler de erro;
- tenants, `company_id` e escopo da rota;
- paginação, filtros e ordenação com allowlist.

Não basta citar um controller “de exemplo” no modo `full`: a matriz de
cobertura deve dizer quantos foram encontrados e quais foram lidos.

## 3. Serviço, domínio e transação

- Percorra `Controller → Service → Repository/Adapter → Domínio`.
- Identifique limites de transação (`@Transactional`), consistência e
  publicação de eventos depois da escrita.
- Separe regra de negócio em domínio de regra de transporte em controller.
- Registre exceções de domínio e como elas viram HTTP.
- Procure lógica repetida em controllers, serviços anêmicos e validação só no
  cliente.

## 4. Persistência e acesso a dados

- Entidades, chaves, relacionamentos, cascade, lazy/eager.
- Repositórios, JPQL/native query, parâmetros bind, `ORDER BY` e `LIKE`.
- Paginação e contagem; risco de N+1.
- Filtro por tenant em toda leitura/escrita de recurso corporativo.
- Índices que sustentam os filtros reais; cruze com `sql-lens.md`.

## 5. Segurança no código

- Autenticação: issuer, audience, expiração, algoritmo, revogação.
- Autorização: papel → código e ACL de recurso, sem substituir uma pela outra.
- Tenant: origem do `company_id`, 404 anti-oracle, ausência de contexto.
- Arquivos: tipo, magic bytes, tamanho, nome sanitizado, storage confinado.
- Log: segredo, token, PII, query string e stacktrace.
- Config: fail-closed, placeholders, perfis, superfície operacional.

Classifique com `suspeito`, `fraca confirmada em código` ou `requer runtime`.

## 6. Integrações e operação

- Eventos de domínio, filas, cache, busca, storage e OCR.
- Idempotência, retry, timeout, ordem de publicação e falha parcial.
- Health/readiness efetivos e quem depende deles.
- Configuração por ambiente e o que só pode ser provado em runtime.

## 7. Testes do backend

- Unitário: serviços e domínio, com fakes; o que cobre regra negativa.
- Integração: banco real, tenant, ACL, migração e endpoints.
- Relacione cada controle crítico a um teste nomeado com `arquivo:linha`.
- Ausência de teste negativo é achado, mesmo quando o código parece correto.

## Saída esperada da lente

```markdown
### 4.2 Backend

- Módulos e responsabilidades: <arquivo:linha>
- Matriz de entry points: <quantidade encontrada> / <quantidade lida>
- Serviços e domínio percorridos: <arquivo:linha>
- Persistência e queries: <arquivo:linha>
- Integrações e operação: <arquivo:linha>
- Testes que sustentam os controles: <arquivo:linha>
- Achados: <IDs>
```
