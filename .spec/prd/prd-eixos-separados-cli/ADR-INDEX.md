# ADR-INDEX — `prd-eixos-separados-cli`

> **Ledger 1:1 com `ADRs/**`** — uma linha por `ADR.md` existente no disco. Contrato das colunas
> (`.agents/rules/prd-adr-pipeline.md` §2): `order` inteiro ≥1 · `status` no enum
> `todo|in-progress|merged|dropped` (`proposed` não existe — `checks.mjs:47`) · `depends_on` declarado
> (`—` quando não há) · `dir` no padrão `ADRs/ADR-00N-{slug}/` · `branch` no padrão
> `adr/{prd-id}/{nn}-{slug}` · `merge` preenchido **somente** quando `status=merged`.
>
> **Frentes do PRD mapeadas 1:1 para os ADRs previstos (P2-2, PRD §8).** O PRD aprovado (§16,
> `D16-EIXOS-CLI`) define duas unidades avaliáveis separadamente: Frente A — separação de eixos
> (linha 1) e Frente B — CLI visual (linha 2). A re-derivação de `golden.spec.mjs`/V20/selo
> (§16.4, P0-1/P0-2) é **critério dentro da linha 1**, não um terceiro ADR: o selo é derivado das
> configurações que a linha 1 muda. A recomendação com fonte de cada linha está em `RESEARCH.md`
> §2–§5 (A1/B1/C1); decisão final é do owner no G2 e dos ADRs.
>
> **Estado deste batch — tensão 1:1 declarada, não maquiada.** Este batch entrega apenas
> `RESEARCH.md` + este índice: **nenhum `ADR.md` foi criado** (constraint explícita). As duas linhas
> abaixo são os ADRs que **serão criados**, com `status=todo`, `merge` vazio e `dir`/`branch` já
> reservados. `ADR-01` (`checks.mjs:294-301`) exige que toda linha tenha `ADRs/<dir>/` correspondente
> no disco e que todo diretório tenha linha — logo, enquanto os diretórios não existem, a checagem
> aponta as duas linhas como "sem dir correspondente". Isso é **esperado e coerente com o precedente
> da casa** (`.spec/prd/prd-installer-rust/ADR-INDEX.md:9-25`): cada linha entra no mesmo commit do
> seu `ADR.md`, nunca antes. `ADR-02` não aceita índice sem linha parseável (`checks.mjs:362-366`),
> então um ledger comentado/vazio também não serve — as linhas reais são a forma correta de
> registrar o plano. **Resolução**: materializar `ADRs/ADR-001-eixos-separados/ADR.md` e
> `ADRs/ADR-002-cli-visual/ADR.md` (cada um com `depende-de` + `interface congelada`, `RESEARCH.md`
> já no lugar) no mesmo commit em que cada ADR for escrito; o índice fica verde nesse ponto, sem
> stub e sem rubrica reaberta.
>
> **Ordem de merge**: 1 (eixos) → 2 (CLI). A linha 2 `depende-de` a linha 1 porque a CLI seleciona
> os eixos definidos pela linha 1 (PRD §10/§11: backend → frontend → revisão → instalação).
> `depends_on` é descritivo — o mecanismo só impõe sequência a linha `in-progress`
> (`checks.mjs:387-399`); ambas as linhas estão `todo`, sem pulo.
>
> *Nota de forma: sem segunda tabela. `parseIndex` (`checks.mjs:149-163`) lê toda linha que começa
> com `|` como linha do ledger; tabela adicional seria interpretada como ADR extra e reprovaria
> `ADR-01`.*

| order | id | title | status | depends_on | dir | branch | merge |
|---|---|---|---|---|---|---|---|
| 1 | ADR-001 | Eixos separados: compor config por eixo (commands/moduleMap do backend; mcp/stacks/skills do frontend; textos derivados), 8×6=48 combinações substituindo os 12 presets, 13 consumidores migrados, selo e baseline re-derivados com ratificação do owner | todo | — | ADRs/ADR-001-eixos-separados/ | adr/prd-eixos-separados-cli/01-eixos-separados | — |
| 2 | ADR-002 | CLI visual setas+enter: substituir a tela line-based por prompts interativos com i18n PT-BR, segredo sem eco e nunca em argv, com critério comportamental medido (N telas, M interações, zero comando digitado) e protótipo ao vivo antes da spec | todo | ADR-001 | ADRs/ADR-002-cli-visual/ | adr/prd-eixos-separados-cli/02-cli-visual | — |

## Insumo das linhas previstas

- **ADR-001 — eixos separados** (PRD §16.1/§16.2/§16.4; RF-01..05, RF-09; riscos P0-1/P0-2, P2-1).
  Medido em `PRD.md` §3: 12 perfis (`install.mjs:252`), `axes` já separado em `java+react` mas
  `.backend`/`.frontend` literais de Q&A, `rust+vue` sem perfil (`install.mjs:210`); 9 byte-equal +
  `java+react` com oráculo e **36** combinações sem baseline (`golden.spec.mjs:48`); 13 consumidores
  de presets; V19 consumer=21, V20 population=223/30373; selo `c904f1c5…`. Pesquisa: `RESEARCH.md`
  §2 (A1 aceita / A2 descartada, fontes S1/S2/S3) e §4 (C1 autoridade, C2 revisor, C3 proibida,
  fontes S8/S9/S10). Critério: 48/48 oráculo, asserção por eixo, zero literal de preset, baseline
  validado e ratificado em §16, `suiteFull` 0 falhas. `depende-de` ficará registrado no `ADR.md`.
- **ADR-002 — CLI visual** (PRD §16.3/§16.5; RF-06..08, RF-10; riscos P1-1, P1-2; §11/§13).
  Medido em `PRD.md` §3/§8: tela line-based `[1/5]` exige digitação; transcript congelado de
  16.336 B do ADR-004 (reabertura registrada em §16); ux-designer fonte visual vinculante e
  design-system-specialist para componentes (§6). Pesquisa: `RESEARCH.md` §3 (B1 aceita / B2
  como divergência declarada, fontes S4/S5/S6/S7/S11). Critério: protótipo ao vivo antes da spec,
  N telas e M interações medidas, i18n PT-BR completo sem literal solto, zero comando digitado,
  nenhum segredo em argv/stdout/stderr com leitura sem eco em TTY. Versão de biblioteca fica no SDD;
  este ADR decide só o critério de apresentação e medição. `depende-de: ADR-001` — a CLI consome os
  eixos definidos na linha 1.

> **O que ficou em aberto para os ADRs (não decidido neste batch)**: conteúdo do `depende-de` e da
> `interface congelada` de cada `ADR.md`; alternativas e trade-off finais no G2; valores exatos de N
> e M e o hash do novo selo (medições do protótipo, ratificadas em §16 — PRD §14); ratificação do
> baseline das 36 combinações; escolha/pin de dependência de CLI no SDD. Nada disso é inventado aqui.
