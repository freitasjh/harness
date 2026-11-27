# Lente de arquitetura e regras

Use esta lente para descrever o sistema sem transformar desenho em opinião.

## C4-lite

Use apenas os níveis que agregam valor:

| Nível | Pergunta | Quando usar |
|---|---|---|
| Contexto | Quem usa o sistema e o que ele integra? | sempre que houver fronteira externa |
| Container | Quais serviços, processos, bancos e filas existem? | quase sempre |
| Componente | Quais módulos participam da funcionalidade analisada? | quando o caminho não é óbvio |
| Código | Qual classe/função implementa o comportamento? | para achado com `arquivo:linha` |

Se contexto e container já respondem à pergunta, pare ali.

## Regras e precedência

Procure, nesta ordem prática, e cite o que existir de fato:

1. `AGENTS.md` mais próximo do alvo;
2. diretivas de diretório abaixo dele;
3. rules do projeto (por exemplo `.agents/rules/*.md`);
4. steering/hooks de outras plataformas;
5. configuração de agente e metadados de skill;
6. documentação humana (README, ADR, runbook).

Não presuma presença. Se houver conflito entre fontes locais, registre as duas
com `arquivo:linha` e diga qual foi aplicada e por quê. Não crie exceção
silenciosa.

## Contratos e fronteiras

Para cada entry point relevante, registre:

- quem chama e com qual autenticação;
- entrada aceita, validação e limites;
- efeito lateral: banco, fila, arquivo, rede, e-mail;
- saída, código de erro e o que é logado;
- dado sensível que cruza a fronteira e onde ele é mascarado.

## Dados e migração

- modelo persistido e invariantes;
- leitura/escrita por qual componente;
- compatibilidade retroativa e rollout;
- rollback e dual-write quando houver mais de um sistema;
- retenção e exclusão de PII.

## Operação

- configuração por ambiente e quem a controla;
- deploy e ordem de inicialização;
- observabilidade sem vazar segredo ou PII;
- timeouts, retries, idempotência e falha parcial;
- recuperação e procedimento de parada.

## Saída esperada da lente

Um mapa curto, com `arquivo:linha`, distinguindo:

```text
Observado: <o que existe>
Inferido: <o que parece ser, com motivo>
Não verificado: <o que exigiria executar ou acessar>
```
