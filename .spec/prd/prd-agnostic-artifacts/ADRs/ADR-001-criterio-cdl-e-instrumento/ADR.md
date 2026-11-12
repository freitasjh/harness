# ADR-001 — Critério do Destino Limpo (CDL) e seu instrumento

> ## ⚠️ STUB DE 1:1 — NENHUMA DECISÃO ESTÁ TOMADA NESTE ARQUIVO
>
> Este `ADR.md` foi materializado **apenas** para satisfazer o par índice↔disco que `ADR-01` impõe
> (`.opencode/plugins/lib/prd-adr-pipeline/checks.mjs:294-301` exige 1:1; `:320-334` exige `depende-de` e
> "interface congelada" dentro de cada `ADR.md`). **O corpo é o próximo batch** e substitui integralmente o
> conteúdo abaixo. Ele é declarado como risco **R2** do `RESEARCH.md` §9: placeholder de gate não é decisão.
>
> **TODO (batch do ADR-001):** preencher, nesta ordem —
> 1. **Contexto** — os 3 predicados do CDL (`PRD.md` §3.6) com o baseline medido (A-1 = 11 arquivos;
>    A-2 = 43 arquivos / 8.245 l.; A-3 = 13 paths, 8 acionáveis) e a fronteira do corpus.
> 2. **Decisão** — rubrica de 4 vereditos por linha (`condicional` | `exemplo` | `catálogo` | `incondicional`),
>    com a árvore de decisão em ordem fixa (mesma forma do `ADR-005` do PRD-1).
> 3. **Aplicação** — por que `ui-ux-pro-max` e `references/frontend.md:49-51` são `catálogo` (E-1), por que
>    `harness-config.md:13` é N/A justificado (E-2) e por que as 6 skills de stack são identidade (E-3/E-4).
> 4. **População e lista derivadas** (RF-09) — fonte única declarada, com a fixture vermelha obrigatória quando
>    um preset novo não aparecer na lista. **Bloqueio conhecido:** `V19` imprime `skills … axis=0` e
>    `rules … axis=1`, enquanto a prosa do PRD cita `SKILLS_BY_AXIS` (2) — a fonte precisa ser escolhida por
>    comando, não por conveniência (`RESEARCH.md` §9-R3).
> 5. **Interface congelada** — 1 item por predicado, cada um com o comando que o reproduz, e o modo de falha.
> 6. **Consequências** + **Alternativas descartadas** — incluindo por que vale/textlint/lychee não são o
>    instrumento (`RESEARCH.md` §5, C1–C4).
>
> **Insumos já prontos:** `PRD.md` §3.6/§3.7/§9 (RF-01, RF-09), §16-D2 e §16-D7; `RESEARCH.md` §3 (tema A),
> §5 (tema C), §8 (recomendação) e §9 (R1–R7).
> **Escopo de escrita deste stub:** `.spec/prd/prd-agnostic-artifacts/**`. Nenhum `.agents/**`, `installer/**`,
> `opencode.json`, `harness.config.json`, `gate.js` ou `scripts/**` foi tocado.

- **prd-id**: `prd-agnostic-artifacts` — `.spec/prd/prd-agnostic-artifacts/PRD.md`
- **order**: 1 de 5 (`.spec/prd/prd-agnostic-artifacts/ADR-INDEX.md`)
- **status**: `in-progress` — *placeholder de 1:1; ver aviso acima*
- **branch**: `adr/prd-agnostic-artifacts/01-criterio-cdl-e-instrumento`
- **depende-de**: — (nenhum ADR; depende do **PRD-2 aprovado no G1** em 2026-11-11 — `PRD.md` §16)
- **data**: 2026-11-11
- **dono da decisão**: owner do harness — portão **G1**, decisões **D7** (escopo do critério: repo inteiro menos
  vendor) e **D2** (proibição citando tecnologia não é acoplamento)
- **rota**: refactor de documentação normativa (sem comportamento observável de produto ⇒ não gera PRD novo;
  `.agents/rules/prd-adr-pipeline.md` §3)

## Interface congelada

**TODO.** Nenhum item desta seção é decisão. A seção existe porque `ADR-01` a exige por termo
(`checks.mjs:332-334`); os itens verificáveis por comando — 1 por predicado (A-1, A-2, A-3), mais o modo de
falha da baseline e a fixture de preset novo — são escritos no batch do ADR-001.

## Aplicação

**TODO.** 0 arquivo classificado neste batch. `RESEARCH.md` §8 traz a recomendação e o critério; o ADR decide.
