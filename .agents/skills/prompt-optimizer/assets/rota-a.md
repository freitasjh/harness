# Formato canônico da Rota A

Saída única. Não variar o heading. As seções `Já entendi` e `Regra` são
obrigatórias — elas impedem que o turno seguinte preencha a lacuna com default
do modelo.

```markdown
## Falta contexto — preciso de X resposta(s)

Bloqueio (o que não vou assumir): [elemento ausente, ex.: E2 Escopo — e por que não vou assumir]

1. **[E1] Pergunta primária.** Contexto mínimo para responder.
2. **[E2] Pergunta primária.** Contexto mínimo para responder.
3. **[E3] Pergunta primária.** Contexto mínimo para responder.

### Já entendi (afirmado por você)
- [Só o que o usuário afirmou]

### Regra
Não vou assumir o que ficou em branco. Escolher por você é palpite caro.
```

Regras de contagem:

- X = número de elementos ausentes que cabe em 3.
- Máximo 3 perguntas; se só cabe 1, é E1.
- Ordem: E1 > E2 > E3 > E4 > E5 > E6.
- Inferência da IA não conta como afirmação: registre como `E3 parcial
  (inferido de "...")` no ledger da conversa, não como fato afirmado.
- Rota A não emite bloco PICCO. Bloco PICCO é exclusivo da Rota B.
