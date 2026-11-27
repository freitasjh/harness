# Template de saída da deepsearch

A saída precisa ser utilizável por quem vai codificar sem voltar a perguntar
o que já poderia ter sido pesquisado.

```markdown
# Pesquisa: <tema>

## 1. Resumo executivo
<3 a 6 frases com a recomendação, o motivo principal e o maior risco.>

## 2. Pergunta travada
- Assunto:
- Stack e versão:
- Ambiente:
- Decisão que esta pesquisa apoia:

## 3. Mapa de decisões
| Decisão | Recomendação | Alternativa descartada | Fontes | Implicação no código |
|---|---|---|---|---|

## 4. Detalhamento por decisão
### <decisão>
- Evidência: Afirmação — URL — YYYY-MM-DD — versão aplicável
- Por que esta opção:
- O que muda na implementação:
- Cuidados:

## 5. Contexto pronto para delegação
- <fato citado>
- <fato citado>
- <limitação declarada, se houver>

## 6. Riscos e perguntas abertas
- <risco ou pergunta> — verificar em <alvo>

## 7. Fontes
1. <URL> — consultada em <YYYY-MM-DD> — versão <versão, se aplicável>

## 8. O que não foi verificado
- <item> — motivo — como verificar
```

## Regras de preenchimento

- Uma afirmação por citação; se uma frase contém três fatos, use três
  citações.
- "Não verificado" é uma seção obrigatória quando existir qualquer lacuna.
- A recomendação nunca aparece sem pelo menos uma alternativa descartada.
- Se a ferramenta de busca não estiver disponível, diga isso no resumo e nas
  perguntas abertas. Não troque ferramenta indisponível por memória.
