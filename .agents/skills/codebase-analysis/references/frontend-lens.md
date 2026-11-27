# Lente de frontend

Use esta lente no modo `full` e sempre que houver SPA, componentes ou estado
de cliente. Ela analisa o código da aplicação, não apenas regras de estilo.

## 1. Estrutura e rotas

- Router: rotas declaradas, guardas, redirecionamentos e fallback.
- Árvore de componentes: páginas, layouts, componentes reutilizáveis.
- Estado global: stores, escopo, hidratação e persistência.
- Clientes HTTP: base URL, interceptors, serialização de erro.

Cite `arquivo:linha` para cada afirmação.

## 2. Fluxo de dados e contratos

- De formulário/UI até chamada HTTP e volta para renderização.
- DTOs/interface de cliente versus contrato do backend.
- Tratamento de loading, erro, vazio e paginação.
- Validação no cliente e validação server-side correspondente.
- i18n: chaves ausentes, interpolação e idioma por tenant/usuário.

## 3. Autenticação e sessão no cliente

- Onde o token é armazenado e lido; quem pode acessá-lo.
- Cabeçalho de autorização e refresh/logout.
- Decodificação de claims no cliente: confiança e expiração.
- Guardas de rota por papel/tenant e o que acontece em mudança de contexto.

Marque risco de XSS como `fraca confirmada em código` somente quando houver
caminho de renderização não sanitizado; caso contrário, `suspeito`.

## 4. Renderização e XSS

- Procure `v-html`, `innerHTML`, `dangerouslySetInnerHTML`, template string
  inserida no DOM e HTML vindo de API.
- Verifique sanitização antes da renderização e CSP que reduza execução.
- Componentes de upload/preview e links gerados a partir de dado do usuário.
- Query string e fragmento usados em navegação.

## 5. Acessibilidade e UX técnica

- Controles com label, foco, teclado, estados de erro e contraste.
- Tabelas/formulários com semântica e navegação por teclado.
- Responsividade e comportamento em viewport pequena.

## 6. Build, testes e desempenho

- Scripts de build/test/lint e o que o CI executa.
- Testes de componente, store, rota e cliente HTTP.
- Bundle, code splitting, lazy loading e requests redundantes.
- Variáveis de ambiente e ausência de segredo embutido.

## Saída esperada da lente

```markdown
### 4.3 Frontend

- Rotas e guardas: <arquivo:linha>
- Componentes/páginas encontrados e lidos: <n> / <n>
- Fluxo de estado e autenticação: <arquivo:linha>
- Renderização e XSS: <arquivo:linha>
- Testes e build: <arquivo:linha>
- Achados: <IDs>
```
