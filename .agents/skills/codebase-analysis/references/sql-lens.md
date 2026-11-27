# Lente de SQL e dados

Use esta lente no modo `full` e sempre que houver migração, entidade,
repositório ou dado persistido. Prosa sobre tenant não substitui leitura do
SQL.

## 1. Inventário de migrações

- Liste arquivos `V*.sql` por domínio, ordem e convenção de nome.
- Identifique migrações aplicadas, datas, backfill e convergência.
- Nunca edite migration aplicada; proponha nova migration.
- Verifique se seed/raiz por tenant tem caminho de runtime equivalente.

## 2. Esquema e integridade

Para cada tabela relevante, registre `arquivo:linha` e observe:

- PK, FK, `NOT NULL`, default e unicidade;
- `company_id`/tenant e índice que sustenta o filtro;
- colunas de auditoria e exclusão lógica;
- JSONB/GIN, enum/check e tipos;
- tabelas filhas sem tenant próprio e como o tenant é derivado;
- exceções registradas e condição de revisão.

## 3. Queries e repositórios

- JPQL e SQL nativo: bind de parâmetros, sem concatenação de entrada.
- `ORDER BY` e colunas dinâmicas apenas por allowlist.
- `LIKE`, paginação, joins e filtro de tenant.
- N+1, fetch join, projeções e exposição de entidade em DTO.
- Consultas que respondem “existe?” sem materializar PII.

Cruze cada padrão com a entidade e a migration correspondente.

## 4. Dados sensíveis e ciclo de vida

- PII em coluna, log, evento, cache e mensagem de erro.
- Criptografia em repouso/em trânsito quando aplicável ao dado.
- Retenção, exclusão e anonimização.
- Trilha persistida de operação de dado sensível.

## 5. Testes de dados

- Migration IT com banco real e ordem de execução.
- Teste de isolamento entre tenants com 404 uniforme.
- Teste de backfill/convergência e idempotência.
- Teste negativo de query e de restrição de banco.

## Saída esperada da lente

```markdown
### 4.4 SQL e dados

- Migrações encontradas e lidas: <n> / <n>
- Tabelas críticas: <arquivo:linha>
- Filtro de tenant e integridade: <arquivo:linha>
- Queries e repositórios: <arquivo:linha>
- Dados sensíveis e trilha: <arquivo:linha>
- Achados: <IDs>
```
