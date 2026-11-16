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
> **Estado:** `ADR-001` **`merged`** (`10f60f7`, PR #10), `ADR-002` **`merged`** (`4838e0e`, PR #11),
> `ADR-003` **`merged`** (`b5c23dd`, PR #12) e `ADR-004` **`merged`** (`94a0047`, PR #13 em 2026-11-16) —
> a baseline, o `V18`/`V19`/`V20` e o `refs-undetected=9` estão na `main @ e297d82`, e é a **linha do
> `V20`** que este ledger usa como oráculo (§10-N7 do ADR-001; §11-H6 do ADR-003). `ADR-005` está
> **`in-progress`** — branch `adr/prd-agnostic-artifacts/05-frota-restante` (de `main @ e297d82`, HEAD
> `5644d37`), `ADR.md` escrito (decisão única = rubrica `FR0..FR5` de expiração de exceção com predicado
> vivo, dono por instância e conversão de dívida — nunca apagão para zerar contador; 12 itens de interface
> congelada; instâncias re-medidas na `main`); implementação = SDD, nenhum merge. `merge` fica `—` em toda
> linha com `status ≠ merged`. No máximo **1** linha `in-progress` por vez (`checks.mjs:378-379`) — é por
> isso que a promoção do `ADR-004` a `merged` entra no **mesmo commit** em que o `ADR-005` nasce:
> 4 `merged` + 1 `in-progress` mantém `ADR-02` verde (1 slot só, sem pulo de `order`). O número de
> `identity`/`baseline`/`refs-undetected` muda com o SDD do ADR-005, mas o oráculo segue sendo a linha
> publicada.
>
> **Dependências do fatiamento:** `ADR-004` declara `depends_on = ADR-001, ADR-003` — do primeiro herda o
> predicado de A-3, a segunda gramática publicada como `refs-undetected`, o oráculo de §10-N7 e a restrição
> de selo (§2.6); do segundo herda a regra de **re-medir quando o payload muda** (§11-H6). `ADR-005`
> declara `depends_on = ADR-001, ADR-003, ADR-004` (ampliação registrada em §8-N1 do ADR-005): do primeiro
> herda a rubrica de 4 vereditos, a `declaredAxis` por nome (E-3) e os ids de falha; do segundo, a regra de
> re-medir e o resultado de D8; do terceiro, a rubrica `RC0..RC6` e as **9 linhas de `.doc/**`** que ele
> classificou RC3 com dono ADR-005. O `ADR-003` dependia de **`ADR-001` e `ADR-002`**: herdava a rubrica e a
> baseline do primeiro e, do segundo, o mecanismo **M1** ("nomear o eixo no escopo") e a **obrigação
> nominal** de §2.4. A fronteira entre 004/005 continua sendo por arquivo e por classe: o `ADR-004` não
> fecha a frota identitária de agentes, as proibições, o catálogo nem as 9 linhas de `.doc/**` (todas
> ADR-005), e o `ADR-005` não decide os 8 paths, o `DESIGN.md` nem o N30 (004).

| order | id | title | status | depends_on | dir | branch | merge |
|---|---|---|---|---|---|---|---|
| 1 | ADR-001 | Critério do Destino Limpo (CDL): rubrica de 4 vereditos por linha com população e lista de termos derivadas dos presets, medida por módulo puro no runner selado | merged | — | ADRs/ADR-001-criterio-cdl-e-instrumento/ | adr/prd-agnostic-artifacts/01-criterio-cdl-e-instrumento | `10f60f7` (PR #10) |
| 2 | ADR-002 | Entradas sempre instaladas: prescrição de stack por eixo nomeado nas 2 entradas de RULES_COMMON e autoria de SPEC/PLAN/TASKS por permissão resolvida — `deny *` antes de `allow .spec/**` | merged | ADR-001 | ADRs/ADR-002-entradas-sempre-instaladas/ | adr/prd-agnostic-artifacts/02-entradas-sempre-instaladas | `4838e0e` (PR #11) |
| 3 | ADR-003 | Skills comuns: `spec-review` sai do payload por veredito `removido` (33 entradas → 0) e a revisão de SPEC passa a ser portão de metodologia; D1 formalizado por eixo no escopo das 2 rules de frontend e D8/E-1/E-3 como exceção permanente com predicado | merged | ADR-001, ADR-002 | ADRs/ADR-003-skills-comuns-e-spec-review/ | adr/prd-agnostic-artifacts/03-skills-comuns-e-spec-review | `b5c23dd` (PR #12) |
| 4 | ADR-004 | Referências quebradas: rubrica de ação por classe (`RC0..RC6`) com predicado por comando, dono e 4 ações — reapontar a SSoT declarada (`security-standard` → skill `security-review`), remover baseline Java com dívida PRD-4 + reativação, remover ponteiro `DESIGN.md` com dono PRD-5 e medir N30 no detector selado | merged | ADR-001, ADR-003 | ADRs/ADR-004-referencias-e-design-md/ | adr/prd-agnostic-artifacts/04-referencias-e-design-md | `94a0047` (PR #13) |
| 5 | ADR-005 | Frota restante: exceção só vive sob predicado com expiração e dívida se converte com dono — rubrica `FR0..FR5`, D2/D8/E-3 com predicado vivo, 4 identidades reatribuídas, 2 skills de eixo condicionadas no corpo, `spec-gate` e `security-review:132` internalizados, 9 linhas `.doc/**` com dono | in-progress | ADR-001, ADR-003, ADR-004 | ADRs/ADR-005-frota-restante/ | adr/prd-agnostic-artifacts/05-frota-restante | — |

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
- **ADR-004** *(este ciclo)* — RF-05, RF-07, **D4/D5** + N30: rubrica `RC0..RC6` (7 classes, predicado por
  comando, dono, 4 ações); D4 = remover baseline Java com dono PRD-4 + reativação, **SSoT de segurança
  reapontada (R5: `remover` puro proibido)**; D5 = remover 11 linhas de `DESIGN.md` dos 3 agentes, dono
  PRD-5; N30 = detector de refs estendido sem toolchain nova. Re-medido no HEAD `fe42912` (pós-ADR-003):
  `V18` `baseline=7 (2 C1 + 5 C2)`, `non-defect=1`; `V19` `consumer=21`; `V20` `refs-undetected=20` (11
  `DESIGN.md` + 9 `.doc/**`), `population=223/30385`, `payload=214`; 8 paths = **33** citações
  (12/7/4/3/3/1/2/1), não as 47/52 do PRD — `spec-review` levou 14 delas. Oráculo = linha do `V18`/`V20`,
  nunca este parágrafo (ADR-001 §10-N7, ADR-003 §11-H6).
- **ADR-005** *(este ciclo)* — RF-02, RF-04, **D2/D8**: frota restante. Decisão única = rubrica `FR0..FR5`
  de expiração de exceção com predicado vivo, dono por instância e conversão de dívida (nunca apagão para
  zerar contador). Re-medido na `main @ e297d82`: `V20` `baseline=38 (34 incond / 4 identity)`,
  `identity=4/3` (3 `TaskFlow` + 1 `Pulse`), `prescriptions=138 (…/34)`,
  `prohibition-cited=27`, `refs-undetected=9` (dono ADR-004 → ADR-005); `V18` `baseline=1, non-defect=1`
  e `V19` `consumer=21` inalterados. 9 linhas `.doc/**` herdas do ADR-004 com dono PRD-4/PRD-5; 2 skills
  de eixo (`nestjs:81`, `node:86`) condicionadas no corpo sem sair de `SKILLS_COMMON`. `depende-de =
  ADR-001, ADR-003, ADR-004` (ampliação em §8-N1). Oráculo = linha do `V20`, não este parágrafo.

*Nota de forma: não há linhas "depois" — os 5 ADRs do fatiamento estão materializados na tabela acima, um
por `ADR.md` no disco. `parseIndex` (`checks.mjs:149-163`) lê toda linha que começa com `|` como linha do
ledger: uma segunda tabela seria interpretada como ADR extra e reprovaria `ADR-01`.*
