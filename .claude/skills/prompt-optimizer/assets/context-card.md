# Cartão de contexto — Stage 0

Use um cartão por fato. Ele não preenche lacuna do usuário: só registra o que
foi afirmado, lido ou inferido.

```text
Fato: <uma frase verificável>
Origem: usuário | arquivo:linha | brain path | inferência
Tipo: afirmado | observado | inferido
Elemento: E1 | E2 | E3 | E4 | E5 | E6 | conflito
Lacuna: <o que falta para virar fato afirmado, ou nenhuma>
```

Regras:

- `afirmado` só quando o usuário disse; dedução da IA é `inferido`.
- `observado` exige `arquivo:linha` existente.
- `brain path` só quando `brain_search` realmente respondeu; nunca invente.
- Fato `inferido` vai para o ledger, nunca para `<context>` do PICCO.
- Se a origem não existir, escreva `inferência` e diga onde verificar.

Exemplo:

```text
Fato: o endpoint POST /internal/registrations existe.
Origem: backend/registration/web/.../RegistrationController.java:40
Tipo: observado
Elemento: E3
Lacuna: nenhuma
```
