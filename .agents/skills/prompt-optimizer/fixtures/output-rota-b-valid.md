Score: 6/6 — Rota B

<role>Revisa mudanças de status code em contratos de API procurando consumidor quebrado</role>

<task>Rejeitar email inválido em POST /internal/registrations com 422</task>

<context>
  Projeto: Atlas ECM — `AGENTS.md:1`
  Escopo: só POST /internal/registrations do módulo company
  Tipo de rota: Bugfix
  Fornecido pelo usuário: validação de email; cliente mobile hoje recebe 400 e não pode quebrar
</context>

<constraints>
  Sempre: manter o corpo de erro padronizado
  Sempre: manter o campo de email no request
  Nunca: alterar o shape da resposta de sucesso
</constraints>

<acceptance>
  mvn test passa; IT de POST /internal/registrations cobre 422 com email inválido e 201 com email válido
</acceptance>

<open_questions>
  <!-- vazio -->
</open_questions>
