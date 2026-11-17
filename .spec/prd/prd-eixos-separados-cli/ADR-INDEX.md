# ADR-INDEX — `prd-eixos-separados-cli`

> **Ledger 1:1 com `ADRs/**`** — uma linha por `ADR.md` existente no disco. Contrato das colunas
> (`.agents/rules/prd-adr-pipeline.md` §2): `order` inteiro ≥1 · `status` no enum
> `todo|in-progress|merged|dropped` (`proposed` não existe — `checks.mjs:47`) · `depends_on` declarado
> (`—` quando não há) · `dir` no padrão `ADRs/ADR-00N-{slug}/` · `branch` no padrão
> `adr/{prd-id}/{nn}-{slug}` · `merge` preenchido **somente** quando `status=merged`.
>
> **Frentes do PRD mapeadas 1:1 para os ADRs materializados (P2-2, PRD §8).** O PRD aprovado (§16,
> `D16-EIXOS-CLI`) define duas unidades avaliáveis separadamente: Frente A — separação de eixos
> (linha 1) e Frente B — CLI visual (linha 2). A re-derivação de `golden.spec.mjs`/V20/selo
> (§16.4, P0-1/P0-2) é **critério dentro da linha 1**, não um terceiro ADR: o selo é derivado das
> configurações que a linha 1 muda. A recomendação com fonte de cada linha está em `RESEARCH.md`
> §2–§5 (A1/B1/C1); decisão final é do owner em §16, congelada nos dois `ADR.md`.
>
> **Estado deste batch — 1:1 resolvido, sem stub.** Foram materializados
> `ADRs/ADR-001-eixos-separados/ADR.md` e `ADRs/ADR-002-cli-visual/ADR.md`, cada um com decisão
> única, `depende-de`, interface congelada numerada com comando de prova por item, riscos e
> verificação (`ADR-01` exige o campo `depende-de` e a expressão `interface congelada` no `ADR.md` —
> `checks.mjs:329/332`). O índice tem **2 linhas, 2 diretórios, 2 `ADR.md`, 0 órfão, 0 linha sem
> dir**: `ADR-01` (`checks.mjs:294-301`) exige 1:1 índice↔disco e agora o satisfaz; `ADR-02`
> (`checks.mjs:362-366`) exige linha parseável, sequência e branch — presentes. `status=todo` e
> `merge` vazio em ambas: o merge é humano e nenhuma branch foi aberta/pushada por este batch
> (precedente da casa: `.spec/prd/prd-installer-rust/ADR-INDEX.md:9-25`, cada linha entra no mesmo
> commit do seu `ADR.md`). Nenhuma rubrica foi reaberta: o protótipo aprovado em 2026-11-17 está
> congelado como interface no ADR-002.
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
| 1 | ADR-001 | Eixos separados: compor config por eixo (commands/moduleMap do backend; mcp/stacks/skills do frontend; textos derivados), 8×6=48 combinações substituindo os 12 presets, 13 consumidores migrados, selo e baseline re-derivados com ratificação do owner | todo | merged | ADRs/ADR-001-eixos-separados/ | adr/prd-eixos-separados-cli/01-eixos-separados | feat(#22) `7fafde3` — merge humano 2026-11-17 |
| 2 | ADR-002 | CLI visual setas+enter: substituir a tela line-based por prompts interativos com i18n PT-BR, segredo sem eco e nunca em argv, com critério comportamental medido (N telas, M interações, zero comando digitado) e protótipo ao vivo antes da spec | todo | ADR-001 | ADRs/ADR-002-cli-visual/ | adr/prd-eixos-separados-cli/02-cli-visual | — |

## Insumo das linhas

- **ADR-001 — eixos separados** (PRD §16.1/§16.2/§16.4; RF-01..05, RF-09; riscos P0-1/P0-2, P2-1).
  Medido em `PRD.md` §3: 12 perfis (`install.mjs:252`), `axes` já separado em `java+react` mas
  `.backend`/`.frontend` literais de Q&A, `rust+vue` sem perfil (`install.mjs:210`); 9 byte-equal +
  `java+react` com oráculo e **36** combinações sem baseline (`golden.spec.mjs:48`); 13 consumidores
  de presets; V19 consumer=21, V20 population=223/30373; selo `c904f1c5…`. Pesquisa: `RESEARCH.md`
  §2 (A1 aceita / A2 descartada, fontes S1/S2/S3) e §4 (C1 autoridade, C2 revisor, C3 proibida,
  fontes S8/S9/S10). Critério: 48/48 oráculo, asserção por eixo, zero literal de preset, baseline
  validado e ratificado em §16, `suiteFull` 0 falhas. `depende-de: —` está registrado no `ADR.md`.
- **ADR-002 — CLI visual** (PRD §16.3/§16.5; RF-06..08, RF-10; riscos P1-1, P1-2; §11/§13).
  Medido em `PRD.md` §3/§8: tela line-based `[1/5]` exige digitação; transcript congelado de
  16.336 B do ADR-004 (reabertura registrada em §16); ux-designer fonte visual vinculante e
  design-system-specialist para componentes (§6). Pesquisa: `RESEARCH.md` §3 (B1 aceita / B2
  como divergência declarada, fontes S4/S5/S6/S7/S11). Critério congelado do protótipo **aprovado
  em 2026-11-17**: N=4 telas (backend, frontend, nome, token) + resumo; M=2 setas+Enter (backend) /
  1 seta+Enter (frontend) / Enter (nome) / token+Enter; zero comando digitado; PT-BR; segredo
  `[input is masked]`/`[REDACTED]`; `rust+vue` separados e funcionando. B2 full-screen é divergência
  declarada, não escolhida; o protótipo não é reaberto. Versão de biblioteca fica no SDD; este ADR
  decide só apresentação, critério medido e segredo. `depende-de: ADR-001` — a CLI consome os eixos
  definidos na linha 1.

> **O que ficou para o SDD (não decidido nos ADRs)**: valor exato do novo hash do selo e o conteúdo
> do baseline validado das 36 combinações (ratificados em §16); novo transcript e sua ratificação;
> implementação da composição por eixo, a migração dos consumidores e o pin/versão de dependência de
> CLI. N e M **não** ficaram em aberto: são medições do protótipo aprovado, congeladas no ADR-002
> (PRD §14). Nada disso é inventado nos ADRs.
