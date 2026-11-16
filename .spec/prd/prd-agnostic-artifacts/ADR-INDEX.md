# ADR-INDEX — `prd-agnostic-artifacts`

> **Ledger 1:1 com `ADRs/**`** — uma linha por `ADR.md` existente no disco. Contrato das colunas
> (`.agents/rules/prd-adr-pipeline.md` §2): `order` inteiro ≥1 · `status` ∈ `todo|in-progress|merged|dropped`
> · `depends_on` declarado (`—` quando não há) · `dir` = `ADRs/ADR-00N-{slug}/` ·
> `branch` = `adr/{prd-id}/{nn}-{slug}` · `merge` preenchido **somente** quando `status=merged`.
> Enum de `status`: **`proposed` não existe** — o contrato é `INDEX_STATUS = todo|in-progress|merged|dropped`
> (`.opencode/plugins/lib/prd-adr-pipeline/checks.mjs:47`); usar `proposed` reprova `ADR-02`.
>
> **Por que este índice nasce com 1 linha e não 5.** `ADR-01` exige 1:1 entre índice e disco
> (`checks.mjs:294-301`): linha de índice sem `ADRs/<dir>/` correspondente é **FAIL**, e diretório sem linha é
> **órfão**. Materializar as 5 linhas do fatiamento aprovado antes dos 5 diretórios existirem deixaria
> `node scripts/static-checks.mjs` em exit 1 com 5× *"linha do índice sem dir correspondente"* — contra RF-10 e
> H2. A forma escolhida é a do precedente da casa (PRD-1): **o índice nasce com o primeiro ADR** e cada linha
> nova entra no **mesmo commit** do seu `ADR.md` (é a saída (a) do risco **R2** do `RESEARCH.md` §9).
>
> **O plano completo dos 5 ADRs não se perde.** Ele vive em `PRD.md` §16 ("Fatiamento proposto para os ≤5 ADRs",
> aprovado no G1 em 2026-11-11) e em `RESEARCH.md` §8 (recomendação por ADR, com critério declarado). Este
> arquivo é o ledger **do que existe**, não o plano do que existirá. `ADR-01`/`ADR-02` **não** impõem
> continuidade de `order` (buraco não reprova), mas a ordem é a de merge do fatiamento — 1 → 5.
>
> **Estado:** `ADR-001` **`merged`** (`10f60f7`, merge do PR #10 em 2026-11-12) e `ADR-002` **`merged`**
> (`4838e0e`, merge do PR #11 em 2026-11-12) — a baseline de **80** entradas e o `V20` estão no repo da `main`,
> e é a linha do `V20` que este ledger usa como oráculo (§10-N7 do ADR-001). `ADR-003` está **`in-progress`** —
> branch `adr/prd-agnostic-artifacts/03-skills-comuns-e-spec-review` (de `main` @ `4838e0e`), `ADR.md` escrito
> (decisão + 12 itens de interface congelada + as 42 entradas de baseline com veredito alvo: 33 de
> `spec-review`, 4 de `security-review`, 5 das 2 rules de frontend); implementação = SDD, nenhum merge. `merge`
> fica `—` em toda linha com `status ≠ merged`. No máximo **1** linha `in-progress` por vez
> (`checks.mjs:378-379`) — é por isso que a promoção do `ADR-002` a `merged` entra no **mesmo commit** em que o
> `ADR-003` nasce: 2 `merged` + 1 `in-progress` mantém `ADR-02` verde (1 slot só, sem pulo de `order`).
>
> **Dependências do fatiamento (ainda sem linha neste ledger, porque ainda sem `ADR.md`):** `ADR-004` e
> `ADR-005` declaram `depends_on = ADR-001`; nenhum dos dois depende de outro. O `ADR-003` depende de
> **`ADR-001` e `ADR-002`**: herda a rubrica e a baseline do primeiro e, do segundo, o mecanismo **M1**
> ("nomear o eixo no escopo") e a **obrigação nominal** de §2.4 (fechar as 2 headings de frontend e remover
> `PROJECT_TERMS["Atlas ECM"]`). A fronteira entre 003/004/005 continua sendo por arquivo e por classe: o
> `ADR-003` não decide paths nem `DESIGN.md` (004) e não fecha o corpo das skills de stack nem a frota
> identitária de agentes (005).

| order | id | title | status | depends_on | dir | branch | merge |
|---|---|---|---|---|---|---|---|
| 1 | ADR-001 | Critério do Destino Limpo (CDL): rubrica de 4 vereditos por linha com população e lista de termos derivadas dos presets, medida por módulo puro no runner selado | merged | — | ADRs/ADR-001-criterio-cdl-e-instrumento/ | adr/prd-agnostic-artifacts/01-criterio-cdl-e-instrumento | `10f60f7` (PR #10) |
| 2 | ADR-002 | Entradas sempre instaladas: prescrição de stack por eixo nomeado nas 2 entradas de RULES_COMMON e autoria de SPEC/PLAN/TASKS por permissão resolvida — `deny *` antes de `allow .spec/**` | merged | ADR-001 | ADRs/ADR-002-entradas-sempre-instaladas/ | adr/prd-agnostic-artifacts/02-entradas-sempre-instaladas | `4838e0e` (PR #11) |
| 3 | ADR-003 | Skills comuns: `spec-review` sai do payload por veredito `removido` (33 entradas → 0) e a revisão de SPEC passa a ser portão de metodologia; D1 formalizado por eixo no escopo das 2 rules de frontend e D8/E-1/E-3 como exceção permanente com predicado | in-progress | ADR-001, ADR-002 | ADRs/ADR-003-skills-comuns-e-spec-review/ | adr/prd-agnostic-artifacts/03-skills-comuns-e-spec-review | — |

## Insumos das linhas existentes

- **ADR-001** — decisão G1: **D7** (o critério mede o repo inteiro menos vendor: `__tests__/` e
  `ui-ux-pro-max/data/**` ficam fora por E-4/E-1) e **D2** (proibição citando tecnologia **não** é acoplamento;
  A-2 mede prescrição). Requisitos: RF-01 e RF-09. Evidência: população = 112 arquivos / 21.174 l.;
  A-1 = 11 arquivos; A-2 = 43 arquivos / 8.245 l. (38,9%); A-3 = 13 paths (8 acionáveis). Pesquisa:
  `RESEARCH.md` §3 (tema A), §5 (tema C), §8 (recomendação) e §9-R3 (população por eixo tem 2 leituras).
- **ADR-002** — RF-03, RF-06, **D6**: classe (b) nas 2 entradas de `RULES_COMMON`
  (`workflow-rules.md` §5.1–5.4 + §7, `sdd-workflow-standard.md:3`) + herança de autoria (`orchestrator` com
  `edit` allow só em `.spec/**`, `deny *` **antes**). Baseline medida no dia em que o `ADR.md` nasceu:
  `baseline=96 (incondicional=81, identity=15)`, com **15** linhas `incondicional` em `workflow-rules.md` e
  **1** `identity` em `sdd-workflow-standard.md` — 16 das 96 com `owner: ADR-002` (histórico: o `V20` da `main`
  depois do SDD publica `baseline=80`, com **0** em `workflow-rules.md` e **0** em `sdd-workflow-standard.md`).
  A prosa que **afirma** o estado a mudar vive em 5 linhas (`gate-contract.md:18`,
  `orchestrator/AGENT.md:9,16,19,285`) e entra junto: deixá-la de fora abriria no vizinho de mesmo alcance.
- **ADR-003** *(este ciclo)* — RF-03, RF-08, **D1/D3/D8**: skills comuns + `spec-review` como skill de projeto.
  42 entradas de baseline com `owner: ADR-003` (33 de `spec-review/*`, 4 de `security-review/SKILL.md`, 5 das 2
  rules de frontend via `@rule-axis:*`); `V20` no HEAD `4838e0e`: `baseline=80 (66/14)`, `identity=14/11`,
  `payload=219`, `structural-debt=1` (`license@security-review/SKILL.md:4`). Depende do **ADR-002** por dois
  motivos nomeados: mecanismo M1 (§2.1) e a obrigação de §2.4 (fechar as 2 headings `Atlas ECM` e remover
  `PROJECT_TERMS["Atlas ECM"]`).
- **ADR-004** (depois) — RF-05, RF-07, **D4/D5**: 8 paths + `DESIGN.md` + N30.
- **ADR-005** (depois) — RF-02, RF-04, **D2/D8**: frota restante (identidade, proibições, catálogo, skills por
  eixo). Herda de `PROJECT_TERMS["Atlas ECM"]` a prova re-apontada pelo ADR-002 para
  `frontend-coding-standards.md:154`: o termo só sai do registro quando o ADR-003 fechar as 2 headings de
  frontend (N5 do ADR-002).

*Nota de forma: as 3 linhas "depois" são **lista**, não tabela — `parseIndex` (`checks.mjs:149-163`) lê toda
linha que começa com `|` como linha do ledger, logo uma segunda tabela seria interpretada como ADR extra e
reprovaria `ADR-01`.*
