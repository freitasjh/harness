# TASKS — Tech-Debt: harness-eixos-stack-p2

> **Origem**: QA Quality Gate (P4) do ciclo `harness-eixos-stack` — `qa-engineer`, 2026-10-18
> **Regra**: `workflow-rules.md` §5 H4 — P1 → `.spec/bugs/` · **P2 → `.spec/tech-debts/`** · P3 → `.spec/roadmap/`
> **Nível de garantia das evidências abaixo**: 🟢 observado por execução (QA) · 🟡 por leitura
> **Nada aqui foi corrigido** — o QA reporta; correção vira task.

## P2-1 — O caminho **default** do menu termina em loop de `BAD_ANSWER` no comando da suíte

- **Evidência (🟢)**: `installer/install.mjs:1846-1862` — `defaultSuiteFor('java+vue')` retorna `''` (lista de candidatos vazia). O default do menu (Enter no passo 1 → item 4, Enter no passo 2 → Vue) chega ao `[3/5] Comando da suite` **sem default**; Enter com valor vazio falha `commandResolves` (`:311-319`) e o W3 **repete** — o QA observou **6 repetições** até `NO_STDIN` no EOF.
- **Por que importa**: é o caminho que o owner **executa primeiro** (defaults + Enter). O preset react ganhou candidato (`npm run test:run`); o **vue — que é o default — não**.
- **Pré-existência**: o comportamento de `java+vue` sem default é anterior ao ciclo (o item 4 já mapeava direto para `java+vue`); o ciclo o tornou **mais visível** ao criar um passo 2 com Vue como default.
- **Correção proposta**: dar candidatos ao eixo frontend vue (espelho do react) **ou** tornar explícito no prompt que o comando é obrigatório (sem default silencioso).
- **Classe**: produto/UX (não é regressão do ciclo).
- **Teste exigido na correção**: fluxo `Enter,Enter` no menu produz **um** prompt de comando (sem loop) ou uma mensagem que impede o vazio.

## P2-2 — Assimetria de gating: a **rule** Vue sai do destino react, a **skill** Vue entra

- **Evidência (🟢)**: `installer/install.mjs:1363-1377` (filtro de rules por eixo) vs `:410-419` (filtro de skills por `stacks`). `rules/frontend-coding-standards.md` é **excluída** de `java+react`, mas `.agents/skills/frontend-vue-specialist/SKILL.md` — **sem entrada no vendor-lock** ⇒ "comum" (`:1394`) — **entra** no destino react.
- **Por que importa**: o objetivo do A2 era o destino react não receber prosa Vue; a metade "skill local" continua vazando. Residual **declarado** (SPEC RF-03 linha 80 e RF-04 D-4b), mas é **incoerência de produto**: o mesmo eixo é tratado de duas formas.
- **Correção proposta**: classificar as skills **locais** (não-vendorizadas) pelo mesmo eixo — ex.: estender o mecanismo de `RULES_BY_AXIS` para `.agents/skills/**` locais, ou declarar explicitamente que skill local sem entrada no lock é **sempre comum** (decisão consciente, documentada) e cobrir por teste.
- **Classe**: produto/arquitetura de gating.
- **Teste exigido**: direção negativa para skill local (react não recebe `frontend-vue-specialist`) **ou** assert que congele a decisão de "comum".

## P3-1 — `REPORT.e2e.transcript.file` aponta para `/tmp` (efêmero)

- **Evidência (🟢)**: `harness/harness-eixos-stack.json` → `e2e.transcript.file` = `/tmp/opencode/wizard-react-transcript.txt`; a cópia **durável** está em `.spec/backend/harness-eixos-stack/harness/wizard-react-transcript.txt` (byte-idêntica, `sha256 fe1f9187…`).
- **Correção**: apontar o REPORT para o path durável.

## P3-2 — Constante de prova do dry-run no REPORT é literal, não derivada

- **Evidência (🟢)**: `/tmp/opencode/gen-report-b5.mjs:65` hardcoda `063c1ddc5e92cf28`; nenhum formato plausível casa (`find . | sort` de dir vazio = `eb4bd64f…`). A **propriedade** (0 writes) foi verificada de forma independente pelo QA e pelo orquestrador; a **prova declarada** é irreprodutível.
- **Correção**: recomputar a partir da execução, ou reescrever a nota para descrever o método (hash antes==depois) em vez de citar uma constante.
- **Relacionado**: FU-58.

## P3-3 — Warning `MODULE_TYPELESS_PACKAGE_JSON` ao importar `gate.js` como ESM

- **Evidência (🟢)**: `.opencode/package.json` sem `"type":"module"` ⇒ warning no import.
- **Correção**: avaliar `"type":"module"` (⚠️ pode afetar o carregamento de plugins — exige teste de boot) ou ignorar explicitamente.
