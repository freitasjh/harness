# Lente de revisão estática de segurança

Esta lente organiza a leitura. Ela não autoriza exploração nem transforma
alerta de ferramenta em vulnerabilidade confirmada.

## Classificação obrigatória

| Classe | Significado | Critério |
|---|---|---|
| `suspeito` | padrão ou ausência observada | há evidência local, mas impacto não foi estabelecido |
| `fraca confirmada em código` | caminho lido da origem ao efeito | `arquivo:linha` na origem e no sink/efeito |
| `requer runtime` | depende de config, estado ou comportamento real | vai para handoff `pentest` com Gate 0 |

Não use “vulnerabilidade confirmada” nesta skill. A confirmação depende de
evidência de runtime autorizado.

## Áreas a percorrer

1. **Autenticação e sessão.** Identidade, renovação, revogação, cookies,
   tokens, clock skew e falha de login.
2. **Autorização.** Checagem por recurso, tenant, papel e operação; negar por
   padrão; IDOR e elevação.
3. **Entrada e encoding.** Validação, parametrização, saída contextual,
   parsing de arquivo, upload e comandos externos.
4. **Cripto e segredos.** Algoritmo, chave, rotação, aleatoriedade,
   hardcoded credential, log de segredo.
5. **Configuração.** Default seguro, CORS, headers, TLS, permissões,
   exposição de debug e erro detalhado.
6. **Supply chain.** Dependências, lockfile, pin, integridade, script de
   build e CI com permissão ampla.
7. **Dados e PII.** Minificação, retenção, mascaramento em log, criptografia
   em repouso e em trânsito.
8. **Logging e erro.** Evento de segurança, correlação, ausência de segredo,
   falha aberta/fechada.
9. **Lógica de negócio.** Fluxos que o compilador não protege: etapas,
   idempotência, limites e abuso de fluxo.
10. **Testes.** Cobertura do controle, mock que esconde falha, ausência de
    teste negativo.

## Mapeamento de padrões

- Use `references/standards-and-versions.md` para ASVS, Top 10 e CWE.
- Não invente ID. Quando o ID não estiver na referência, abra a fonte oficial
  com `deepsearch` antes de escrever.
- Um achado pode ter um CWE, um requisito ASVS e uma categoria Top 10; são
  lentes diferentes, não sinônimos.

## Cartão de evidência mínimo

Para cada achado de segurança, preencha `assets/evidence-card.md`. A versão
curta no relatório deve conter: ID, título, classe, padrão, `arquivo:linha`,
impacto observado, remediação e verificação.

## Handoff

Se a classe for `requer runtime`, o relatório deve dizer explicitamente:

```text
Handoff: pentest — Gate 0 pendente — validar em <ambiente autorizado>
```

Não inclua payload, comando pronto nem passos de exploração. O agente
`pentest` planeja e revisa; a execução fica com operador autorizado.

## Falsos positivos e limitações

Ferramentas SAST ajudam a localizar código, mas não provam vulnerabilidade e
não veem configuração fora do código. Se usar uma ferramenta externa:

- fixe a versão;
- registre o comando e a data no relatório;
- trate a saída como `suspeito` até leitura e classificação manuais;
- nunca cole segredo encontrado pela ferramenta no relatório.
