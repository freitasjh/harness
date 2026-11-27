# Cartão de evidência

```text
ID: SEC-001
Classe: suspeito | fraca confirmada em código | requer runtime
Alvo: <arquivo ou superfície>
Origem: <arquivo:linha>
Sink ou efeito: <arquivo:linha>
Observação: <o que foi lido, em uma frase>
Interpretação: <por que isso importa; marcada como interpretação>
Padrão: CWE-<n> · v5.0.0-<n.n.n> · A0n:2025
Impacto observado: <impacto mínimo sustentado pela evidência>
Limitação: <o que não foi verificado>
Remediação: <ação concreta>
Verificação: <como provar a correção>
Handoff: nenhum | pentest (Gate 0 pendente)
```

Regras:

- `Origem` e `Sink ou efeito` são obrigatórios quando a classe for
  `fraca confirmada em código`.
- Se `Handoff: pentest`, a classe deve ser `requer runtime`.
- Nunca preencher `Observação` com valor de segredo, token ou PII.
