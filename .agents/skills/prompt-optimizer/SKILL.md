---
name: prompt-optimizer
description: "Avalia demandas de mudança antes da execução: confere objetivo, escopo, contexto, restrições, critério de aceite e intenção; pergunta o que falta e só então entrega um bloco PICCO com contexto citado. Use antes de criar, alterar, corrigir ou refatorar algo não trivial. Não use para consultas factuais, leitura de estado, análise somente leitura ou pentest autorizado."
---

# Prompt Optimizer v4 — portátil

Portão de entrada de toda demanda de **mudança**. Consulta factual ao repo
pula o gate. O default escolhido pelo modelo não é o default do usuário —
lacuna preenchida em silêncio é requisito inventado.

## Quando usar / não usar

Mudança não trivial; objetivo, escopo, contexto, restrição ou aceite incompletos; delegação que precisa decidir sem voltar a perguntar.
Não usar para consulta factual, leitura de estado, análise somente leitura, pentest autorizado ou tarefa trivial sem mudança de contrato.
Pacote portátil: `SKILL.md`, `assets/`, `references/`, `scripts/` e `fixtures/` viajam juntos; sem dependência de runner ou arquivo específico de repo.

## Stage 0 — contexto antes do score

Antes de contar E1..E6, nesta ordem:

1. **Brain literal:** `brain_search(query=<prompt do usuário, literal>, top_k=3)`.
   Paráfrase já é interpretação — não reescreva a query.
   Se a ferramenta não existir ou não responder, diga explicitamente que o
   brain está indisponível e continue apenas com fatos observáveis do prompt
   e do projeto. Nunca simule resultado, path ou citação do brain.
2. **Probe do projeto (somente leitura):** instruções, manifests,
   documentação, regras e nomes de diretório que **existem de fato** no
   ambiente. Cite `arquivo:linha` para cada fato usado. Não presuma a presença
   de nenhum arquivo específico.

Saída do Stage 0: fatos citáveis (`arquivo:linha` ou brain path) para o
`<context>`. O probe **nunca** preenche lacuna do usuário — só diz onde a
demanda cai. Nada é escrito.

## Os 6 elementos

Score = elementos **afirmados** / 6.

| # | Elemento | Checagem | Ausente = |
|---|----------|----------|-----------|
| E1 | Objetivo | O que muda no mundo quando estiver pronto? | crítico |
| E2 | Escopo | O que entra e o que NÃO entra? | crítico |
| E3 | Contexto | Módulo/domínio/tela/endpoint afetado | alto |
| E4 | Restrições | O que não pode quebrar? | alto |
| E5 | Critério de aceite | Como se sabe que ficou pronto? | médio |
| E6 | Intenção de rota | Feature / Bugfix / Refactor / Melhoria? | médio |

**Presente = o usuário AFIRMOU.** O que a IA deduziu conta como ausente.
E1 ou E2 ausentes = gate fechado.

## Rotas

**Rota A (score < 6/6).** PARAR. Nenhuma outra skill, subagente ou artefato —
nada é criado. Máximo 3 perguntas, ordenadas E1 > E2 > E3 > E4 > E5 > E6, na
[forma canônica](references/clarifying-questions.md#formato-de-saída-da-rota-a).
Use `assets/rota-a.md` como template canônico.
Máximo 2 rodadas; na 2ª sem fechamento, 2 interpretações com o que muda no
resultado e pedido de desempate.

**Rota B (score = 6/6).** Re-encoding em bloco PICCO
([template](assets/picco.md) e [exemplos](references/picco-template.md)) com 1 confirmação antes
de executar. Bloco efêmero: chat + prompt de delegação, nunca arquivo.

**Conflito de regra primeiro.** Violar regra do projeto é contradição, não
ambiguidade: nomeie a regra com caminho, ofereça o caminho permitido mais
próximo e pergunte sobre exceção explícita. Violador **e** incompleto:
conflito primeiro, Rota A depois.

**Exceção — consulta.** `show status`, `onde paramos?`, `o que Y faz?` e
leitura de estado pulam Stage 0, score e confirmação. `add feature X`,
`skip X` não pulam.

## Ledger de premissas

Premissa não confirmada que sobreviveu ao estoque (inferência marcada
"parcial" na Rota A, ou premissa da 1ª rodada não respondida na 2ª) **não**
vira fato e **não** entra no PICCO. Vai para o ledger da conversa:

```text
Premissas pendentes:
- <texto da premissa> (E3, inferida de "<trecho do prompt>")
```

O ledger é append-only dentro da conversa e não exige arquivo. Confirmação do
usuário remove o item e promove o texto para `<context>` com citação. Ledger é
rastro, não autorização para executar.

## Bloco PICCO (Rota B)

Use `assets/picco.md`. O template canônico mora lá; `references/picco-template.md`
mantém exemplos, tabela de campos e checklist.

Cinco regras: **≤ 10 constraints**; **role = critério, não persona**;
**positivas primeiro**; **`<context>` cita toda afirmação que não veio
literalmente do prompt**; **nunca escrever nem sugerir "pense passo a passo"**
(CoT escrito degrada modelo de raciocínio). `<acceptance>` deve ser
executável. Exemplos bons e ruins e contagem de constraints em
`references/picco-template.md`.

Use `assets/context-card.md` no Stage 0 quando precisar registrar de onde veio
cada fato: `fato | origem | tipo | elemento | lacuna`.

## Scripts disponíveis

- `scripts/validate-output.mjs` — valida forma/gates da Rota A ou da Rota B.
- `scripts/check-package.mjs` — checa integridade deste pacote.

Ambos são somente leitura, não interativos e documentados por `--help`. Eles não
fazem score semântico: o modelo continua decidindo E1..E6 e a reencoding.

## Brain (depois)

Padrão que se repete 2x → `brain_store(layer="regras",
path="projeto/prompt-patterns/<elemento>-<padrao>", scope="projetos")` com
lacuna, pergunta que resolveu e resposta. 1 ocorrência é coincidência. Se o
brain estiver indisponível, mantenha o padrão como pendência explícita — não
finja que foi gravado.

## Verificação manual

Use `TESTING.md`. Há validadores de forma, não runner semântico. As verificações
comportamentais usam os fixtures incluídos.

| # | Verificação | Critério |
|---|-------------|----------|
| V1 | Fixture vago (`fixtures/08-melhorar-cadastro.md`) | Rota A, ≤3 perguntas, zero artefato |
| V2 | Fixture completo (`fixtures/01-email-invalido.md`) | Rota B, PICCO válido, 6/6, 1 confirmação |
| V3 | Brain indisponível | Limitação declarada, nenhum path inventado |
| V4 | Pacote portátil | Nenhuma referência obrigatória a arquivo fora de `SKILL.md`, `references/` e `fixtures/` |
| V5 | Constraints do PICCO | ≤10, positivas primeiro, zero instrução de raciocínio |
| V6 | `scripts/validate-output.mjs` | Rota A/B válidas passam; inválidas falham com `--expect-fail` |
| V7 | `scripts/check-package.mjs` | Todos os checks estruturais passam |

## Arquivos do pacote

`SKILL.md` · `assets/` · `references/` · `scripts/` · `fixtures/` (10 prompts + 4 output fixtures). Todos viajam juntos; não copie apenas o SKILL.md.
