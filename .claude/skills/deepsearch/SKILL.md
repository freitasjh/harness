---
name: deepsearch
description: "Pesquisa profunda com fonte antes de recomendar biblioteca, API ou padrão. Use quando a resposta vai virar código e precisa de contexto versionado; a rule always-on é o contrato."
---

# Deepsearch — detalhe operacional

Contrato obrigatório: `assets/deepsearch-rule.md`. Este arquivo não
substitui nem copia a rule; ele ensina a executar o protocolo até gerar
contexto suficiente para codificação correta.

Pacote portátil: `SKILL.md`, `assets/`, `references/`, `scripts/` e
`fixtures/` viajam juntos.

## Sintoma que esta skill corrige

Uma busca única, seguida de um parágrafo curto, não é pesquisa profunda. Ela
deixa o agente sem versão, sem assinatura verificada, sem alternativas
descartadas e sem riscos conhecidos. O resultado de uma deepsearch útil é um
mapa de decisões com citações, não uma opinião resumida.

## Quando usar

Antes de recomendar biblioteca, API, configuração, versão ou padrão que vá
virar código e que possa ter mudado desde o cutoff do modelo. Também quando a
resposta anterior veio só de memória ou quando a tarefa será delegada a outro
agente que precisa decidir sozinho.

Não usar para conceito estável do domínio, decisão já registrada em ADR ou
conteúdo puramente local do projeto — nesses casos, cite `arquivo:linha` e
siga em frente.

## Fluxo de pesquisa profunda

1. **Travar o escopo da pergunta.** Escreva uma frase com: assunto, stack,
   versão conhecida, ambiente e o que será decidido. Se a versão não foi
   dita, procure a versão instalada no projeto antes de buscar na web.
2. **Decompor em subquestões.** Use o checklist em
   `references/research-playbook.md`. Uma pergunta grande como "SSO com
   Spring Boot" vira OIDC vs SAML, control plane vs IdP, versão do Spring
   Security, sessão vs JWT, rotação de chaves, provisionamento, multitenancy,
   observabilidade, testes e migração.
3. **Buscar por subquestão, não uma vez pelo tema inteiro.** Descubra com
   `websearch`, abra a fonte com `webfetch`, e use Context7 quando
   disponível para documentação versionada. Registre o que cada fonte
   respondeu e o que ficou em aberto.
4. **Persistir até saturação.** Cada subquestão termina em um de três estados:
   fonte oficial encontrada; changelog/RFC encontrado com data de validade;
   ou inferência explícita com alvo de verificação. Se nenhum dos três foi
   alcançado, a busca não acabou.
5. **Extrair evidência.** Para cada afirmação, registre
   `Afirmação — URL — data da consulta (YYYY-MM-DD)` e acrescente a versão
   aplicável e a implicação prática no código. Uma afirmação por citação.
6. **Montar o mapa de decisões.** Use o template em
   `references/output-template.md`: decisão, recomendação, alternativas
   descartadas, fontes, implicações de código, riscos e perguntas abertas.
7. **Entregar em camadas.** Resumo executivo primeiro, mapa detalhado
   depois, fontes numeradas no final. Nunca responda só "depende" — diga do
   que depende, quem decide e onde verificar.

## Ferramentas e fallback

- `websearch(query)` — **descobrir**. Query curta: nome da tecnologia +
  versão + subquestão. É índice, não fonte final.
- `webfetch(url, format="markdown", timeout≤120)` — **ler**. Abrir a URL e
  conferir a assinatura na íntegra antes de escrever código. Use `text` ou
  `html` se o markdown perder informação.
- `context7_resolve-library-id` → `context7_query-docs` — documentação
  versionada, quando o MCP estiver disponível. Alternativa CLI: `ctx7
  library` / `ctx7 docs`.

Se `websearch`/`webfetch`/Context7 nao estiverem disponiveis, use HTTPS
read-only via cliente de linha de comando quando autorizado, registre a URL
aberta e a data da consulta. Se nem isso existir, marque inferencia com alvo
de verificacao. Nunca finje consulta, URL, data ou resultado.

## Exemplo de evidência extraída

```text
Afirmação: <o que a fonte diz, em uma frase verificável>
URL: <url aberta>
Data da consulta: <YYYY-MM-DD>
Versão aplicável: <versão da lib/framework, se a fonte disser>
Implicação no código: <o que muda na implementação por causa dessa afirmação>
```

## Verificação manual

Não há runner de teste neste pacote. As verificações são comportamentais e
usam os fixtures incluídos.

| # | Verificação | Critério |
|---|-------------|----------|
| V1 | `fixtures/01-sso-identity-spring-boot.md` | Produz subquestões, fontes oficiais e mapa de decisões; não termina em parágrafo curto |
| V2 | `fixtures/02-conceito-estavel.md` | Não busca na web; cita contexto local ou segue sem citação externa |
| V3 | `fixtures/03-assinatura-api.md` | Não afirma assinatura sem abrir a fonte; sem ferramenta, declara limitação |
| V4 | Contrato | A rule canônica está em `assets/deepsearch-rule.md`; nenhum ponteiro a copia |

## Arquivos do pacote

`SKILL.md` · `assets/deepsearch-rule.md` (contrato) ·
`references/research-playbook.md` · `references/output-template.md` ·
`scripts/` · `fixtures/` · `TESTING.md`.

Todos viajam juntos. Não copie apenas o `SKILL.md` para outro projeto.

## Integração por plataforma

- **Codex:** a skill é descoberta em `.agents/skills/deepsearch/SKILL.md`;
  `AGENTS.md` aponta para a rule canônica sem duplicá-la.
- **OpenCode:** `opencode.json` carrega `.agents/rules/deepsearch.md`, que é
  um ponteiro para o asset.
- **Kiro (opcional):** se `.kiro/steering/deepsearch.md` e
  `.kiro/hooks/deepsearch.json` existirem, apontam para o asset; ausencia nao
  falha o self-check.

Nenhuma plataforma recebe uma cópia das 6 regras. Todas leem o mesmo asset.
