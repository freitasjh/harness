# Parecer PM — harness-eixos-stack (validação de negócio do PLAN/TASKS)

> **Subagente**: `product-manager` · **Data**: 2026-10-18 · **Alvo**: `PLAN.md` + `TASKS.md` vs `PROPOSAL.md`/`SPEC.md` + decisões D-A..D-D

## 1. Veredito por dimensão (como entregue pelo PM)

| Dimensão | Veredito |
|---|---|
| Intenção do owner | 🟡 entregue para o frontend; **meia-entrega em "eixos"** (D-1) |
| Escopo | 🟡 fiel a D-A..D-D, com 2 zonas cinzentas (D-3, D-4) |
| Verificabilidade pelo owner | 🟡 verificável com 3 furos (D-2, D-8) |
| Consistência PROPOSAL→SPEC→PLAN→TASKS | 🟠 3 furos reais (D-5, D-6, D-4a) |
| Risco de produto | 🟠 médio-alto, concentrado em 1 ponto |

**Resposta direta ao ponto do `architect`** (o aditivo é fachada?): **não é fachada do que o owner vê hoje**, mas é **fachada parcial** na afirmação "eixos de primeira classe" — `axes` não tinha consumidor que forçasse coerência com `profile.stacks`, que é quem realmente gateia artefato.

## 2. Defeitos e tratamento

| ID | Sev | Defeito | Tratamento |
|---|---|---|---|
| D-1 | P1 | `axes` sem consumidor real ⇒ eixo decorativo (registry incoerente passa verde) | **Corrigido**: `stacksFor(axes)` + tabela de exceções declarada + cenário de divergência (`SPEC` RF-01/D4, `TASKS` EX-BE-01/EX-VAL-02/EX-VAL-06) |
| D-2 | P1 | W3 re-pergunta o stack com o texto **antigo** (`install.mjs:196`) logo após o usuário escolher React | **Corrigido**: novo **RF-14** (fonte única da lista) em `EX-BE-03`/`EX-VAL-09` |
| D-3 | P1 | `optional: true` **inerte**: "opcional" podia ser lido como "não instalada" | **Corrigido por decisão de leitura**: nesta entrega as **2 skills são instaladas**; `optional` é metadado (PROPOSAL §3/§7, SPEC RF-09, TASKS EX-VAL-14). Honrar o campo = escopo novo |
| D-4a | P2 | Aceite citava `react-coding-standards.md` — **arquivo inexistente** | **Corrigido**: conjunto real de `.agents/rules/**`; declarado que react **não** recebe rule de frontend (criar = decisão do owner) |
| D-4b | P2 | A2 fechado só na perna react; rule nova não classificada volta a vazar em silêncio (fail-open) | **Corrigido**: aceite que **enumera** `.agents/rules/**` (rule não classificada ⇒ teste vermelho) + residual flutter/dart declarado |
| D-5 | P2 | RF-12 sem task, apesar de `PLAN:191` afirmar cobertura total | **Corrigido**: RF-12 rastreável em `EX-VAL-14` (5 chaves + fixtures legadas) |
| D-6 | P2 | Caminho crítico omitia `EX-05` e `EX-07` ⇒ não era caminho no DAG | **Corrigido** no `PLAN` §7 e no `JIRA_BOARD` |
| D-7 | P3 | Rótulos `T1..T8` inconsistentes entre PLAN/SPEC | **Corrigido**: rastreabilidade por **arquivo** de teste (SPEC §10) |
| D-8 | P3 | Critério que o owner executaria (abrir o wizard) sem evidência própria (dry-run usa `--answers-file`, que **pula** o W2m) | **Corrigido**: `EX-VAL-14` produz **transcript salvo** em `.spec/backend/harness-eixos-stack/harness/wizard-react-transcript.txt` |
| D-9 | P3 | **Default do passo 2 permanece Vue** — não decidido em D-A..D-D | **ABERTO — pergunta ao owner** (não é correção de código) |

## 3. Confirmações do PM (não reabrir)

- **D-A** respeitado: nenhum preset `java`/`vue`/`react` isolado; sem 3º passo.
- **D-B** respeitado: `profileOf`/`generateConfig` intactos.
- **D-C**: A1 fecha de verdade; A2 fechava parcialmente (→ D-4).
- **D-D** coerente: `ADR-INDEX.md` explica por que `.spec/prd/**` não é criado (`runPrdChecks` vacuous-safe).
- **Caminho A** do vendor firmado no `ADR-003` (`licenseOrigin` + `evidence[]`, NOTICE sem claim universal).
- 1:1 PLAN→TASKS (14↔14), sem macro-tarefa inventada; batches com pausa HITL.
- Suíte de referência do `PROPOSAL` confere com `harness.config.json:14`.

## 4. Maior risco de "não era isso"

1. "Escolhi React, mas o default continua Vue **e ninguém me perguntou o backend**" — backend invisível + default Vue (→ D-9 + linha explícita no REPORT).
2. "Marquei opcional e a skill de rede foi instalada de qualquer forma" (→ D-3).
3. "Escolhi React e a tela seguinte mostra a lista sem React" (→ D-2).

**0 arquivos escritos** pelo PM (parecer retornado, nada materializado em disco por ele).
