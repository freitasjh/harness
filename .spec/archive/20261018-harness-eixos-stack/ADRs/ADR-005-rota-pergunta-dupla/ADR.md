# ADR-005 — Rota de migração para a pergunta dupla `backend`+`frontend` (desenho; execução futura)

- **Status**: `todo` (documento de rota — **nada é executado nesta entrega**)
- **Data**: 2026-10-18
- **Ciclo**: `harness-eixos-stack`
- **Fonte**: parecer do `architect` §2b/ADR-005 + decisão de portão **D-B** (usuário: registry com `axes` agora)

## Contexto

O caminho aditivo (ADR-001) entrega a capacidade enumerada, mas **não** independência de eixo completa: a combinação **é** a chave, um par não enumerado falha com `BAD_ANSWER` (`installer/install.mjs:298-300`) e cada par novo exige entrada de registry. O alvo declarado (java/go/rust × vue/react) é N×M. Quando `go`/`rust` entrarem, o caminho natural é a **pergunta dupla** `backend` + `frontend`.

Superfícies da migração (levantadas por leitura, com arquivo:linha):

| Superfície | Evidência | Quebra |
|---|---|---|
| Forma do Q&A | `installer/install.mjs:194-200` | 6ª pergunta; `stack` deixa de ser chave única |
| Rigidez de `collectAnswers` | `installer/install.mjs:340-347` | resposta incompleta morre com `missing answer` ⇒ `--answers-file` legado quebra |
| Validação | `installer/install.mjs:264`, `:296-321`, `:299` | 2 cases + 2 listas + mensagem (hoje a lista aparece 2×) |
| Geração | `installer/install.mjs:392-393`, `:415-418` | resolução por par, não por string |
| Wizard | `installer/install.mjs:1492-1498`, `:1635-1651`, `:1655-1661` | menu vira preset + 2 prompts/defaults |
| Gating de skill/rule | 7 call sites de `profile.stacks` (`:891-892`, `:1703-1705`, `:1839`, `:1889`, `:1984`, `:2033`, `:2183`) | derivação por eixo |
| Fixtures de answers | ≈20 call sites (`installer-upgrade-regression.spec.mjs`, `mustfix-f1.spec.mjs`, `qa.spec.mjs`, `suite.spec.mjs`, `checks.spec.mjs`, `cli.spec.mjs`) | chave nova |

## Decisão (rota, não execução)

1. Perguntas `backend` e `frontend` **adicionais**, com `stack` mantido como **preset legado** — leitura **dual-shape** em `collectAnswers`, de modo que as ≈20 fixtures existentes continuem válidas e a quebra de contrato vire **adição**.
2. `presetOfAxes(backendId, frontendId)` ao lado de `presetOf(stack)` — a função nova é **adicionada**, nunca substitui a antiga.
3. Rótulos congelados **literais** (jamais concatenação) ⇒ I7 sobrevive à migração.
4. Campo **`answersVersion`** no arquivo de respostas (hoje **inexistente**) — reservado já em ADR-001 e declarado nesta rota; sem ele a migração não distingue arquivo antigo de novo.
5. Baseline **novo** para pares inéditos (ex.: `java+react` pós-migração), mantendo o baseline atual **intacto**.
6. `stacks` de skill/rule resolvido pelo eixo (fim da inferência por nome — herdado de ADR-002).

## Alternativas descartadas

- **Big-bang** (trocar `stack` por 2 perguntas de uma vez): quebra ≈20 fixtures e o `--answers-file` dos consumidores sem ganho.
- **Aditivo para sempre**: N×M de manutenção e par novo exigindo release do instalador.
- **Sintaxe composta livre digitada** (`java+react` à mão): erro de digitação vira `BAD_ANSWER`, sem eixo nem sugestão.

## Consequências

- Migração = **adição** de lookup + 2 perguntas + leitor dual-shape; o registry de ADR-001 **permanece**.
- Custo estimado (parecer do architect §2b): ~1 dia de registry/geração (barato **porque** ADR-001 já valeu), 1–2 dias de Q&A/wizard, ~0,5 dia de fixtures, + baseline novo congelado.
- `commands.suiteFull` deste repo **não** muda (cobre testes por glob, `harness.config.json:14`) ⇒ selo ADR-002 intacto.
- **Gatilho declarado**: esta rota é executada no ciclo que criar `go` e/ou `rust` — não antes.

## Invariantes preservados

- Saída byte-idêntica para os 6 presets (asserts de byte-identidade de `golden.spec.mjs:48-61` + builder `baseline()` `:14-45`).
- `gate.js` intocado; nenhum deny novo; nenhum path de projeto hardcoded (SPEC ADR-003 / V3).

## Interface congelada

Schema do `--answers-file` (`project|stack|suiteCommand|pluginsDir|deployToken`, `installer/install.mjs:194-200`) — a migração é **aditiva** a esse schema.

**depende-de**: ADR-001.

## Fora desta decisão

Criar/perfis backend `go`/`rust`; executar a migração.
