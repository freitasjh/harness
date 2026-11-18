# PROPOSAL — Harness v2 (engenheiro de software especialista)

Ciclo: `harness-v2` · Tipo: refactor · Branch: `v2` · Baseline: tag `v1.0` (commit `381b5e0`)

## 1. Problema

O harness v1 deixou de ser um harness de engenharia e virou um **produto de instalação**:

- `installer/` (18.118 linhas) + `installer-rs/` (6.694) + `packaging/` (560) + 1.091 testes de instalador para distribuir arquivos.
- 79 KB de regras injetadas em **toda** request (~20k tokens), com a mesma política repetida em 3 arquivos.
- Frontend contraditório: `developer-engineer` manda PrimeVue + fetch + Remix; `frontend-coding-standards` manda shadcn-vue + axios + lucide. UX e design system hardcodam o design system **Pulse**, de outro produto.
- Zero mecanismo de qualidade visual: nenhum gate, skill ou comando olha tela, estados ou Storybook.
- SPEC/TASKS nascem por funcionalidade inteira, não por decisão arquitetural — o que produz documentos grandes e sem dono.

## 2. Objetivo

Harness v2 = engenharia de software: um pipeline PRD → ADR → SPEC/TASKS **por ADR**, papéis especialistas (frontend e backend separados), deepsearch obrigatório, design system verificável via Storybook, e bootstrap de 3 verbos.

## 3. Alternativas

| # | Alternativa | Trade-off |
|---|---|---|
| A | Manter instalador e só remover o wizard de stack | Não resolve 25k linhas nem o custo de manutenção; mantém 1.091 testes de distribuição |
| B | CLI fino (`init/update/doctor`) mantendo perfis/eixos/Rust | Metade do custo permanece; eixos não têm consumidor real |
| C | **Escolhida** — apagar instalador, sync determinístico + comandos; pipeline por ADR; React+Vue com Storybook | Perde perfis de stack e Dart/Flutter no core; exige `/harness-update` para consumidores |
| D | Reescrita total em Rust | Custo alto sem ganho de produto; contraria Q2=A |

## 4. Decisão e escopo

Decisões do usuário: **Q1=A** (aceite clean-room), **Q2=A** (apagar instalador), **Q3=A** (React+Vue+Storybook, Dart/Flutter fora do core), **D1=A** (declaração honesta do CDL + V21), **D2=A** (backup fora do target).

Entra: F0..F8 do `.spec/governance/harness-v2/PLAN.md`.
Não entra: reintroduzir instalador, perfis/eixos, TUI, Rust; migração automática de consumidores; Storybook em Flutter.

## 5. Riscos aceitos

| Risco | Mitigação |
|---|---|
| Trust do selo cai de 🟢 para 🟠 sem instalador | seal em `scripts/seal.mjs` + CI; declarado |
| Régua de prosa (CDL) perdida | débito `.spec/tech-debts/harness-v2-cdl/TASKS.md` |
| Consumidores com layout v1 | re-init em branch + backup obrigatório |

## 6. Critério de aprovação

Plano F0..F8 aprovado; F1 só fecha com code review sem 🔴 e suíte verde.
