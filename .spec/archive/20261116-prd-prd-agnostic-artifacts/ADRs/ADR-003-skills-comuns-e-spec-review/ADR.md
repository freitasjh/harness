# ADR-003 — Skills comuns: `spec-review` sai do payload por veredito `removido` (33 entradas → 0) e a revisão de SPEC passa a ser portão de metodologia, não de persona

- **prd-id**: `prd-agnostic-artifacts` — `.spec/prd/prd-agnostic-artifacts/PRD.md`
- **order**: 3 de 5 (`.spec/prd/prd-agnostic-artifacts/ADR-INDEX.md`)
- **status**: `in-progress`
- **branch**: `adr/prd-agnostic-artifacts/03-skills-comuns-e-spec-review` (de `main` @ `4838e0e`, HEAD atual)
- **depende-de**: `ADR-001, ADR-002` — herda do **ADR-001** a **rubrica de 4 vereditos** (`condicional` \| `exemplo` \| `catálogo` \| `incondicional`, §2.3/§2.3-bis/§2.3-ter), a **baseline literal com `sha256` por linha** (§2.5), os **7 ids de falha** e o **oráculo de §10-N7**: o número que vale é o da linha do `V20`, nunca o parágrafo de um ADR. Herda do **ADR-002** o mecanismo **M1** ("nomear o eixo no escopo", §2.1), a remoção de dívida **por mudança de veredito, não por remoção de texto** (§2.1) e a **obrigação nominal** de §2.4: *"quando o ADR-003 remover as duas headings de frontend, o termo `Atlas ECM` deixará de aparecer em qualquer posição identitária e a entrada de `PROJECT_TERMS` passa a ser removida — o ADR-003 herda essa obrigação por construção do mesmo alarme"*. Nenhum dos dois é dispensável: sem o ADR-001 não há régua; sem o ADR-002 não há precedente de como fechar dívida sem deslocar baseline.
- **data**: 2026-11-12
- **dono da decisão**: owner do harness — portão **G1** (PRD §16). Três decisões, transcritas do `PRD.md:327,329,334`: **D1** = *"as 2 rules de frontend continuam axis-gated; não são reescritas neste PRD"* (formalizar o que já acontece); **D3** = *"separar `spec-review` como skill de projeto: sai do payload comum do harness; o `workflow-rules` §4 passa a invocar um revisor de SPEC genérico (ou o do destino), sem depender do TaskFlow"*; **D8** = *"exceção permanente declarada: `ui-ux-pro-max` (catálogo) e as 6 skills de stack seguem em `SKILLS_COMMON`; o nome da skill declara a stack de propósito (E-3)"*.
- **rota**: refactor de governança (remoção de artefato + prosa; sem comportamento observável de produto ⇒ não gera PRD novo; `.agents/rules/prd-adr-pipeline.md` §3)
- **insumo de pesquisa**: `RESEARCH.md` §8 (recomendação do ADR-003: *"`spec-review` sai do payload comum como skill de projeto e `workflow-rules` §4 invoca revisor genérico/do destino"*; critério: *"`description` sem nome de cliente nas skills comuns; 5/5 vereditos em `spec-review`; chamada do §4 preservada sem citar projeto nem depender de mapa do instalador"*) e §9 (**R3** — a população por eixo tem duas leituras; **R4** — dois paths protegidos, dois trailers; **R6** — `license:` de terceiro é afirmação jurídica falsa). `PRD.md` §3.4 (#12–#16), §3.6 (E-1/E-3), §9 (RF-03, RF-08), §16 (D1/D3/D8).
- **escopo de escrita desta entrega**: `.spec/prd/prd-agnostic-artifacts/**` (`ADR.md` + 1 linha no `ADR-INDEX.md`). **Nenhum** arquivo de `.agents/**`, `installer/**`, `opencode.json`, `harness.config.json`, `scripts/**` ou `.opencode/plugins/**` foi tocado — a remoção, as reescritas, a baseline e as exceções são o SDD deste ADR.
- **escopo não decidido aqui**: os 8 paths e `frontend/DESIGN.md` (ADR-004); a frota identitária restante, as proibições e o **corpo** das skills de stack (ADR-005); qualquer alteração em `gate.js` (nenhuma).

## 1. Contexto

A skill `spec-review` é **a única revisora de SPEC da esteira** e é, ao mesmo tempo, **100% material de outro projeto**: 5 de 5 arquivos, 1.298 linhas, 33 das 80 entradas de baseline do `V20`. Ela viaja para **todo** destino (`SKILLS_COMMON`, `installer/install.mjs:425`) e é invocada por **5 superfícies vivas** que continuariam apontando para um artefato inexistente se a remoção fosse feita sozinha — a definição exata do defeito que este ADR existe para não cometer.

| Fato medido (2026-11-12, HEAD `4838e0e`) | Valor | Comando / fonte |
|---|---|---|
| `V20` — o oráculo (§10-N7 do ADR-001) | `baseline=80 (incondicional=66, identity=14)`, `prescriptions=178 (56/39/17/66)`, `prohibition-cited=39`, `identity=14/11`, `payload=219`, `structural-debt=1`, `refs-undetected=20`, `population=228/31661` | `node scripts/static-checks.mjs \| grep V20` |
| `spec-review` — arquivos / linhas | **5 / 1.298** (README 303, SKILL 225, checklist 187, output-template 274, usage-guide 309) | `wc -l .agents/skills/spec-review/{README.md,SKILL.md,assets/*.md}` |
| `spec-review` — entradas de baseline | **33** = **27** `incondicional` + **6** `identity`, por arquivo: README **9** (8+1), SKILL **7** (5+2), checklist **12** (11+1), output-template **1** (0+1), usage-guide **4** (3+1) | dump de `m.BASELINE` + `scanArtifact` por arquivo |
| `spec-review` — densidade de termos de projeto | **5 de 5** arquivos (35/24/15/14/12 ocorrências) | `grep -cEi '<lista de §3.4>'` por arquivo |
| `spec-review` — o que o arquivo **é** | `# Revisor de Specifications — TaskFlow`, *"SPEC.md do **TaskFlow** (Spring Boot 3.5 + Vue 3)"*, checklist com `JUnit 5 + Mockito`, `*IT.java`, `Liquibase`, `Pinia`, `Remix` | `sed -n '1,11p' .agents/skills/spec-review/SKILL.md` |
| `spec-review` — no payload | **sim**, `SKILLS_COMMON` (22 entradas), linha `425` | `node -e 'console.log(require("fs").readFileSync("installer/install.mjs","utf8").split("\n")[424])'` ⇒ `'spec-review',` |
| `spec-review` — referências vivas fora do próprio diretório | **5** de invocação + **2** de prosa: `workflow-rules.md:205,566`, `orchestrator/AGENT.md:43,306`, `sdd-workflow-standard.md:44`, `README.md:15`, `docs/FUNCIONAMENTO.md:134` | `grep -rn 'spec-review' .agents README.md docs \| grep -v '.agents/skills/spec-review/'` |
| `spec-review` — o que a remoção arrastaria | 12 das 39 proibições contadas e 39 das 178 prescrições; **0** `refs-undetected` (o `refs-undetected=20` é todo do ADR-004) | `scanArtifact` por arquivo + `grep -c 'DESIGN.md\|\.doc/'` ⇒ `0` em 5/5 |
| `spec-review` — citações de rules **ausentes** (V18) | 6 refs: `backend-coding-standards` (11×), `backend-unit-tests` (6), `backend-integration-tests` (6), `db-migration-liquibase` (5), `db-migration-flyway` (3) | `grep -ohE '[a-z0-9-]+\.md' $(git ls-files .agents/skills/spec-review/) \| sort \| uniq -c` |
| essas 6 refs sobrevivem à remoção? | **sim**: cada uma mantém ≥1 citante vivo fora de `spec-review/` (16→11, 8→3, 9→4, 5→1, 4→3 arquivos) ⇒ `V18` continua `PASS baseline=7` | `for r in …; do grep -rl "$r\.md" .agents docs harness \| grep -v 'spec-review/' \| wc -l; done` |
| As 2 rules de frontend (`RULES_BY_AXIS`) | **1.882 + 194 = 382 l.**, axis-gated desde antes deste PRD (`frontend=react` ⇒ a rule de `vue`) | `sed -n '470,472p' installer/install.mjs`; `wc -l .agents/rules/frontend*coding-standards.md` |
| As 2 rules — entradas de baseline | **5** = **3** `incondicional` + **2** `identity`, **todas `owner: ADR-003`**, nomeadas por **slot** (`@rule-axis:frontend=react#0` → `frontend-coding-standards.md:12,159,154`; `@rule-axis:frontend=vue#0` → `frontend-react-coding-standards.md:30,161`) | `node -e '…m.BASELINE.filter(e=>e.file.startsWith("@"))'` + resolução por `RULES_BY_AXIS` |
| As 2 rules — `incondicional` **medidos** hoje | **3** (não 0): `frontend-coding-standards.md:12,159` e `frontend-react-coding-standards.md:30` | `scanArtifact(…, {exports})` |
| `security-review/SKILL.md` | **4** entradas: `:3` `description` (identity), `:4` `license: TaskFlow Security Standard` (identity + E-6), `:115` e `:166` (`npm audit`, incondicional) | dump de `m.BASELINE` filtrado |
| `EXCEPTIONS` — E-6 | **presente**, `structural-offender` `kind:license` `file:security-review/SKILL.md:4`, `owner: ADR-003`; `structural-debt=1` | `node -e '…m.EXCEPTIONS'`; `V20` |
| Skills de stack por nome | **6** (5 em `SKILLS_COMMON` + `frontend-vue-specialist` só no mapa); **2** entradas de baseline, **`owner: ADR-005`** (`nestjs-architecture-specialist/SKILL.md:81`, `node-architecture-specialist/SKILL.md:86`) | `SKILLS_COMMON.filter(…)` ⇒ `5`; dump filtrado |
| `ui-ux-pro-max` | **1** `.md` (`SKILL.md`) + 23 arquivos não-`.md` (14 `.csv` de catálogo); vereditos do `.md`: `exemplo=1`, `catálogo=2`, **0** `incondicional` | `git ls-files .agents/skills/ui-ux-pro-max/`; `scanArtifact` |
| `PROJECT_TERMS` | 3: `TaskFlow` (proof = `spec-review/README.md:1`), `Atlas ECM` (proof = `frontend-react-coding-standards.md:161`), `Pulse` (ADR-005) | `node -e '…m.PROJECT_TERMS'` |
| `TaskFlow` em posição identitária depois deste ADR | **3 linhas / 2 arquivos**: `developer-engineer/AGENT.md:1,25`, `ux-designer/AGENT.md:32` | `grep -lE '^(#{1,6} \|description:\|license:).*TaskFlow\|(neste\|no) projeto TaskFlow'` sobre a população |
| `cdl.spec.mjs` — números assados | `BASELINE.length === 80`, `identity === 14`, `population === 228/31.661`, `identity.files === 11` | `sed -n '800,830p' .opencode/plugins/__tests__/cdl.spec.mjs` |
| `commands.suiteFull` / selo | literal **inalterado** por este ADR | `node -e 'console.log(require("./harness.config.json").commands.suiteFull)'` |

**O defeito, dito sem retórica — três coisas, e a terceira é a que mata:**

1. **O harness distribui material que não é dele.** `spec-review` é o revisor de SPEC do **TaskFlow** — cliente que não é este repo, cujo stack (`Spring Boot 3.5 + Vue 3`, `Maven`, `Liquibase`) aparece em `harness.config.json` como `N/A` (`harness-config.md:13`). Todo destino recebe 1.298 linhas de norma inaplicável e 33 entradas de dívida que **nenhum destino pode pagar**, porque a dívida não é dele. É o sintoma do `FU-47`, medido.
2. **A dívida é a maior de um único artefato e a mais barata de resolver.** 33 de 80 entradas de baseline (41%) moram em 5 arquivos que são **100% de outro projeto**: `grep -c TaskFlow` não devolve "menção", devolve o **título**, a **descrição**, o **checklist** e o **template de saída**. Não há prosa agnóstica a preservar — há um artefato alheio a repatriar.
3. **A remoção, sozinha, deixa a esteira cega — e é isso que este ADR não faz.** A skill é invocada em 5 superfícies propagadas (`workflow-rules.md` é `RULES_COMMON`; `orchestrator/AGENT.md` é o system prompt do orquestrador; `sdd-workflow-standard.md` é `RULES_COMMON`). Apagar o diretório sem reescrever as 5 linhas produz **exatamente** a invocação órfã que o `V18` chama de dívida — e, pior, deixa a fase de revisão de SPEC **sem revisor declarado**, com o portão `P1→P2` pedindo *"score da SPEC"* que ninguém calcula mais (`orchestrator/AGENT.md:306-311`).

**O que este ADR não faz.** Não move artefato entre classes do instalador (nenhum mapa novo: PRD §7); não toca `gate.js`, `harness.config.json`, `seal.mjs` ou `commands.suiteFull`; não reescreve uma linha das 2 rules de frontend (D1); não decide paths nem `DESIGN.md` (ADR-004); não fecha as entradas de **corpo** das skills de stack (ADR-005); e **não implementa** — o SDD é que apaga, reescreve, mede e remove entradas de baseline.

## 2. Decisão

**Os 5 arquivos de `spec-review` recebem o veredito `removido` (33 entradas de baseline → 0) e saem do payload comum junto com a única entrada que os instala; a revisão de SPEC deixa de depender de uma persona e passa a ser um portão de metodologia já no payload (`asserts/spec-gate.md` do `sdd-compiler`) com parecer opcional do revisor do destino; as 2 rules de frontend declaram o eixo no próprio escopo (D1, 5 entradas → 0) e `ui-ux-pro-max` + as 6 skills de stack ficam em `SKILLS_COMMON` por exceção permanente com predicado mecânico (D8/E-1/E-3).** A decisão é o par (veredito por artefato + mecanismo que o substitui); as 42 entradas, as 5 linhas de prosa e as 4 linhas de heading são **aplicação**.

### 2.1 `spec-review` — veredito `removido`, e por que não é "reescrever" nem "rotular"

RF-03 admite `removido` como veredito de sítio, ao lado de `condicional`/`exemplo`/`catálogo`. Ele é o único que satisfaz **D3** com custo proporcional ao valor do artefato:

| Alternativa de D3 (`PRD.md:319`) | Custo medido | Veredito da rubrica que produz | Por que não |
|---|---|---|---|
| **(a) reescrever como revisor genérico** | 1.298 linhas reescritas + 5 `description`/checklist/template a reinventar sem dono do método | `condicional` em todas as linhas | mantém um **segundo** revisor de SPEC concorrente com o portão do `sdd-compiler`, e o harness passa a manter metodologia de review que não é sua especialidade. Owner descartou (a) explicitamente |
| **(b) separar como skill de projeto — escolhida** | **5 arquivos / 1.298 l. / 33 entradas** saem; 1 entrada sai de `SKILLS_COMMON`; 5 linhas reescritas | `removido` (5/5 arquivos) | é a leitura literal de D3 e o **único** caminho que zera a dívida de outro projeto sem inventar conteúdo |
| **(c) manter e rotular** | 0 arquivo, 2 linhas de frontmatter | `incondicional` em 27 linhas + `identity` em 6 | mantém 33 entradas de dívida **e** o payload de 1.298 linhas; é o estado atual com um adesivo. Owner descartou (c) |

**"Separar como skill de projeto" = repatriar, não realocar.** O harness não tem — e este ADR **não cria** — uma classe "skill de projeto" no instalador: criar uma seria mapa novo, o que o `PRD.md:215` reserva ao PRD-3 e a cobertura de `eixos-stack.spec.mjs:533` proíbe implicitamente (toda skill em `.agents/skills/**` **tem** de estar em `SKILLS_COMMON` ou em `SKILLS_BY_AXIS` — sem terceira classe). O dono do material é o projeto que ele descreve; "skill de projeto" significa que ela vive **no repositório do projeto dela**, com as regras dele, e o harness deixa de distribuí-la. Consequência declarada: o harness **deixa de ter um revisor de SPEC próprio** — e é por isso que §2.2 é parte da decisão, não um detalhe.

**Por que apagar e não mover para `.spec/`.** `.spec/**` é a exclusão **X1** da população (ADR-001 §2.1: "o instrumento mediria a si mesmo"). Mover 1.298 linhas prescritivas para dentro dela **apagaria a dívida do instrumento sem pagá-la** — o oposto do que a baseline existe para fazer. Descartado por princípio, não por custo (ver §6).

### 2.2 O que substitui a invocação — portão obrigatório de metodologia + parecer opcional do destino

A skill sai; **o passo de revisão fica**. A substituição tem dois degraus, e só o primeiro é portão:

| Degrau | O que é | Onde vive | Nível |
|---|---|---|---|
| **R1 — portão obrigatório** | `asserts/spec-gate.md` do `sdd-compiler` (skill **já** em `SKILLS_COMMON`, já é a metodologia que gera a SPEC) + `commands.suiteFull` do destino | payload comum — **nada novo é instalado** | 🟢 mecânico: o checklist é aplicado e o resultado é o relatório de gaps; o `commands.suiteFull` reprova o que o portão não pegou |
| **R2 — parecer opcional do destino** | *"o revisor de SPEC **do projeto**, quando o destino tiver um"* — papel, **sem id de skill e sem entrada em mapa** | projeto do destino | 🟡 processo: parecer humano/agente do destino, nunca requisito de gate |

**A regra que impede o portão órfão:** nenhuma linha do payload pode **exigir** um artefato que o harness não distribui. Por isso a linha do `workflow-rules` nomeia o **portão** (que existe e viaja) e descreve o revisor do destino como **opcional** — nunca "invocar a skill X" onde X não chega. É a diferença entre um portão e uma promessa, e é o teste que o `grep` de §3-IF2 faz.

**Cinco superfícies a reescrever (alvo linha a linha, contagem de linhas preservada):**

| `arquivo:linha` | Hoje | Alvo |
|---|---|---|
| `.agents/rules/workflow-rules.md:205` | `10. **Revisar SPEC**: skill `spec-review` — gerar relatório de gaps e conformidade` | `10. **Revisar SPEC**: aplicar `asserts/spec-gate.md` do `sdd-compiler` — relatório de gaps e conformidade; conformidade com as regras do projeto = revisor de SPEC do destino, quando houver` |
| `.agents/rules/workflow-rules.md:566` | `\| **Revisão de Spec** \| `spec-review` \| Revisar SPEC.md contra regras do projeto, gerar relatório de gaps e conformidade \|` | `\| **Revisão de Spec** \| `sdd-compiler` (`asserts/spec-gate.md`) \| Aplicar o portão à SPEC.md e registrar gaps; regras do projeto = revisor do destino \|` |
| `.agents/agents/orchestrator/AGENT.md:43` | `\| Planejamento \| `sdd-compiler`, `spec-review`, `jira-microtask-breaker` \| …` | `\| Planejamento \| `sdd-compiler`, `jira-microtask-breaker` \| …` (remove o id, preserva a célula) |
| `.agents/agents/orchestrator/AGENT.md:306` | `11. Revise SPEC: skill `spec-review` — relatório de gaps e conformidade. Valide contra `asserts/spec-gate.md`.` | `11. Revise SPEC: `sdd-compiler` (`asserts/spec-gate.md`) — relatório de gaps e conformidade; revisor do destino, se houver.` |
| `.agents/rules/sdd-workflow-standard.md:44` | `2. Invocar skill `spec-review` para revisar SPEC.md contra regras do projeto.` | `2. Revisar a SPEC contra `asserts/spec-gate.md` do `sdd-compiler` e contra as regras do projeto (revisor do destino, se houver).` |

**Duas prosa-órfãs fora da população de regras** (`README.md:15`, `docs/FUNCIONAMENTO.md:134`): a célula "skills `sdd-compiler`, `spec-review`" passa a "skills `sdd-compiler`". Não são prescrição (sem termo de stack ⇒ veredito `null`), logo não mexem em baseline — são órfãs de referência, e o `V18` não as pega porque o id de skill não é path de `rules/*.md`.

**O que a substituição NÃO faz:** não recria o scorecard por categoria que a skill produzia. O `orchestrator/AGENT.md:311` pede *"score da SPEC"* no portão `P1→P2`; o score passa a ser o do portão aplicado (itens do `spec-gate.md` checados / total) — declarado como **mudança de conteúdo do parecer**, com dono no SDD deste ADR e sem novo artefato.

### 2.3 D1 formalizado — o eixo vai para o escopo (4 headings), não para o corpo (382 linhas)

O owner decidiu **gatear por eixo**, e as 2 rules **já** estão axis-gated no instalador (`RULES_BY_AXIS`: `frontend=react` exclui a rule de `vue`, e vice-versa). O que falta é o segundo lado do predicado: a rubrica só classifica como `condicional` quando o **gate está no escopo** (ADR-001 §2.3, passo 5) — e nenhum dos headings dessas rules nomeia o eixo.

**Medição que corrige o ADR-001:** `ADR-001` §4.5-D1 afirma *"as duas rules têm **0** linha `incondicional` hoje"*. **Falso** no `V20` atual: são **3** — `frontend-coding-standards.md:12,159` e `frontend-react-coding-standards.md:30` —, e são exatamente as 3 entradas `incondicional` de baseline `@rule-axis:*` (as 2 `identity` são as linhas 154/161). A causa é o teste do passo 5 (`allowed.every(term ⇒ eixo ∈ declared)`) encontrando **termo de outro eixo** na mesma linha: `Radix` (react) nas duas linhas da rule de Vue, e `mdi-*`/`ri-*` (vue) na linha de ícones da rule de React. Não é defeito do artefato — `Radix` e `mdi` são menção legítima — é fronteira do predicado.

**Decisão (sem tocar a rubrica, sem reescrever o corpo):** o eixo entra no **heading que delimita** a linha, que é o mecanismo **M1** do ADR-002 §2.1. Quatro headings, nenhuma linha de prescrição reescrita:

| `arquivo:linha` | Hoje | Alvo | Efeito medido |
|---|---|---|---|
| `.agents/rules/frontend-coding-standards.md:7` | `## Stack definitiva` | `## Stack definitiva (Vue)` | `:12` `incondicional` → **`condicional`** |
| `.agents/rules/frontend-coding-standards.md:154` | `## Dependências Principais (Atlas ECM)` | `## Dependências Principais (Vue)` | `:159` `incondicional` → **`condicional`**; identidade `Atlas ECM` sai (ADR-002 §2.4) |
| `.agents/rules/frontend-react-coding-standards.md:21` | `## ESLint / Formatação` | `## ESLint / Formatação (React)` | `:30` `incondicional` → **`condicional`** |
| `.agents/rules/frontend-react-coding-standards.md:161` | `## Dependências Principais (Atlas ECM)` | `## Dependências Principais (React)` | identidade `Atlas ECM` sai (ADR-002 §2.4) |

**Prova de que o alvo é o medido, não o desejado** (o `classifyLine` do próprio instrumento sobre o texto proposto, com o `axis` real de cada artefato):

```sh
# axis: vue-rule = vue,dart,flutter,other,none | react-rule = react,dart,flutter,other,none
vue:12   heading "Stack definitiva"          ⇒ incondicional      heading "Stack definitiva (Vue)"          ⇒ condicional
vue:159  heading "Dependências Principais (Atlas ECM)" ⇒ incondicional  heading "Dependências Principais (Vue)" ⇒ condicional
react:30 heading "ESLint / Formatação"       ⇒ incondicional      heading "ESLint / Formatação (React)"     ⇒ condicional
```

**Quatro linhas de prosa não-identitária do mesmo par de arquivos** (`:3` "Padrões de codificação para o frontend **Atlas ECM** (…)" e `:152`/`:159` "Não usar `@iconify-json/ri` / `mdi` **no Atlas ECM**") saem junto: o projeto não tem mais **nenhuma** ocorrência do termo no par, o que (i) cumpre RF-02 no que é deste ADR, (ii) é veredito-neutro (medido: `null` e proibição, D2) e (iii) **mata a prova** de `PROJECT_TERMS["Atlas ECM"]`, que então sai do registro (§2.5). Sem essa limpeza, o registro sobreviveria apontando para uma linha que ninguém mais controla — dívida disfarçada.

**O que D1 continua sendo:** as rules **não** são reescritas (382 linhas intactas em conteúdo prescritivo) e **não** mudam de mapa (`RULES_BY_AXIS` intocado). O que muda é o predicado da rubrica passar a enxergar o eixo que o instalador **já** declarava.

### 2.4 `security-review` — a licença falsa sai, e a exceção que a escusava morre com ela

Quatro entradas `owner: ADR-003` e uma exceção estrutural (`E-6`) apontando para a mesma linha: o campo `license: TaskFlow Security Standard` (`SKILL.md:4`) afirma licença de terceiro que não licenciou este material — achado de primeira ordem (PRD §13, `RESEARCH.md` §9-R6), porque o campo **viaja para todo destino**.

| `arquivo:linha` | Hoje | Veredito | Alvo | Efeito |
|---|---|---|---|---|
| `security-review/SKILL.md:4` | `license: TaskFlow Security Standard` | `identity` + E-6 | **linha removida** (`license` é opcional na spec de skill; o repo não tem `LICENSE`, logo não há licença a declarar) | `identity` −1; `structural-debt` 1 → **0**; **E-6 removida de `EXCEPTIONS`** (6 → 5), senão `cdl-exception-stale` FAIL |
| `security-review/SKILL.md:3` | `description: "… against OWASP Top 10, ASVS 4.x, MASVS 2.x, and the TaskFlow security-standard.md (source of truth). …"` | `identity` | `description: "… against OWASP Top 10, ASVS 4.x, MASVS 2.x, and the project's security standard (source of truth). …"` | `identity` −1; **remove também 1 citação** de path ausente (`rules/security-standard.md`), que segue viva em 11 outras → `V18` `baseline=7` intacto |
| `security-review/SKILL.md:115` | `- [ ] **A06 (Vulnerable Components):** `npm audit` clean (no critical/high). OWASP Dependency-Check clean.` | `incondicional` | `- [ ] **A06 (Vulnerable Components):** auditoria de dependências pelo gerenciador do eixo (`commands.audit` de `harness.config.json`): zero CVE crítica/alta.` | `null` (mecanismo **M2** do ADR-002: comando vem do config) |
| `security-review/SKILL.md:166` | `- [ ] Dependências auditadas (npm audit + OWASP Dependency-Check) — zero CVE alta sem mitigação?` | `incondicional` | `- [ ] Dependências auditadas (gerenciador de pacotes do eixo) — zero CVE alta sem mitigação?` | `null` |

**Por que M2 e não M1 aqui.** `security-review` é **comum**: vai a todo destino, e não há eixo declarado para herdar. OWASP/ASVS/MASVS são universais e ficam; `npm audit` é específico de `node` e o comando correto é o do `harness.config.json` do destino — a mesma escolha que o ADR-002 fez para as Fases 2/3.

**Consequência declarada:** remover a linha 4 desloca as linhas 115/166 para 114/165. As duas são reescritas neste mesmo batch, e o arquivo **não tem outra entrada de baseline** — nenhum vizinho se desloca por acidente (ao contrário do que aconteceria em `orchestrator/AGENT.md`, cujas 9 entradas §3-IF5 manda preservar).

### 2.5 D8 / E-1 / E-3 — exceção permanente, com predicado que existe no código

**D8 é exceção declarada, e "declarado" só vale com predicado e prova.** Os três já existem, e o ADR não os inventa: ele **fixa que eles são o mecanismo** (e não prosa de ADR) e proíbe que qualquer um deles vire baseline ou contador de dívida.

| Exceção | Predicado (o código que decide) | Prova (comando hoje) | O que **não** cobre |
|---|---|---|---|
| **E-1** catálogo multi-stack | `artifact-prefix` `.agents/skills/ui-ux-pro-max/` (`EXCEPTIONS`, consumido em `checks.mjs:1947-1952`) + `catalogueFileOf` ⇒ veredito `catálogo` por arquivo | `git ls-files .agents/skills/ui-ux-pro-max/ \| grep -c '\.md$'` ⇒ **1**; `ls data/*.csv \| wc -l` ⇒ **14**; `scanArtifact(SKILL.md)` ⇒ `exemplo=1, catálogo=2, incondicional=0` | os 23 arquivos **não-`.md`** nunca entram: a unidade é linha `.md` (ADR-001 §2.1) — a exceção cobre 1 arquivo, não 24 |
| **E-3** identidade por design | `skill-name-axis` (`EXCEPTIONS`, consumido em `checks.mjs:1958`) **e** `declaredAxis` derivação 3 (nome do diretório declara o eixo) | `declaredAxis` das 6 ⇒ `react:react,dart,flutter,other,none` · `vue:vue,…` · `java:java` · `nestjs:nestjs` · `node:node` · `rust:rust` (6/6 não-vazio); `SKILLS_COMMON.filter(nome com segmento de eixo).length` ⇒ **5** (+1 no mapa = 6) | **o corpo** da skill: `E-3` declara a **identidade pelo nome**, não escusa prescrição fora de eixo. As 2 entradas `incondicional` de corpo (`nestjs:81`, `node:86`) **ficam** e são do ADR-005 |
| **E-6** (removida por este ADR) | `structural-offender` `kind:license` `file:security-review/SKILL.md:4` | `sed -n '4p' …` ⇒ `license:` não-SPDX | — |

**Decisão D8:** `ui-ux-pro-max` e as **6** skills de stack **permanecem** em `SKILLS_COMMON`/`SKILLS_BY_AXIS`; `SKILLS_BY_AXIS`, `RULES_BY_AXIS`, `RULES_COMMON` e os 12 presets **não** mudam. O predicado de E-3 é o mesmo que o instalador usa para gatear (`AXIS_IDS`), portanto a exceção **não pode apodrecer em silêncio**: skill nova com segmento de eixo desconhecido cai em `cdl-axis-vocabulary-missing` (FAIL) e skill removida do disco cai em `cdl-exception-stale` (FAIL) por `checks.mjs:1959-1962`.

**O que muda no `PROJECT_TERMS` (consequência mecânica, não decisão nova).** Duas das três provas morrem neste ADR: `TaskFlow` (proof em `spec-review/README.md:1`, arquivo removido) e `Atlas ECM` (proof em `frontend-react-coding-standards.md:161`, heading de-identificada).

| Termo | Antes | Depois | Razão |
|---|---|---|---|
| `TaskFlow` | `proof: spec-review/README.md:1`, `owner: ADR-003` | `proof: .agents/agents/developer-engineer/AGENT.md:1`, `owner: **ADR-005**` | **3 linhas identitárias vivas** restam (`developer-engineer/AGENT.md:1,25`, `ux-designer/AGENT.md:32`) e são da frota do ADR-005 (RF-02). Re-apontar em vez de remover é o mesmo movimento do ADR-002 §2.4, e transferir o `owner` evita que o ADR-003 responda por prova que não controla |
| `Atlas ECM` | `proof: frontend-react-coding-standards.md:161`, `owner: ADR-003` | **entrada removida** | após §2.3, **0** posições identitárias no repo (`grep` da população); o ADR-002 §2.4 previu exatamente este fecho |
| `Pulse` | `proof: design-system-specialist/AGENT.md:42`, `owner: ADR-005` | inalterado | fora do escopo |

### 2.6 O que este ADR **deixa aberto**, com dono nomeado

| Aberto | Por que não é deste ADR | Dono |
|---|---|---|
| as **2** entradas de corpo das skills de stack (`nestjs:81`, `node:86`) | são prescrição de corpo com `owner: ADR-005` **no módulo** — e o módulo é o oráculo de dono (mesma regra do §10-N7). `E-3` cobre a identidade, não o corpo | **ADR-005** |
| as 11 linhas identitárias de agentes (9 linhas em 3 arquivos com `TaskFlow`/`Pulse` após este ADR) | RF-02 é a frota identitária por reescrita de escopo | **ADR-005** |
| `sdd-compiler/asserts/spec-gate.md` ainda carrega `Flyway`/`JWT`/domínios do TaskFlow (1 entrada de baseline) | é o **portão** que este ADR adota; limpá-lo é conteúdo de skill comum fora dos 42 sítios deste ADR | **ADR-005**, declarado aqui para não parecer resolvido |
| `frontend/DESIGN.md` e os 8 paths ausentes | A-3 e D4/D5 | **ADR-004** |
| o `V20` não roda no destino (o portão fica sem runner lá) | ADR-001-C7, já declarado | PRD-3 |

## 3. Interface congelada

Cada item é verificável por comando, da raiz do repo. Itens *(SDD)* só valem depois da implementação; antes dela o comando mede o **estado atual**, com o valor esperado anotado. Onde a verificação depende de leitura humana, o nível 🟡 está declarado — nenhum item se declara 🟢 por presença de texto.

1. **`spec-review` sai do payload — diretório e única entrada de instalação, no mesmo commit.** Os 5 arquivos (1.298 l.) são removidos e `'spec-review'` sai de `SKILLS_COMMON` (`install.mjs:425`); nenhuma outra skill, mapa ou preset muda.
   *Verificação (SDD)*: `git ls-files .agents/skills/spec-review/ | wc -l` ⇒ `0`; `node --input-type=module -e 'import * as m from "./installer/install.mjs"; console.log(m.SKILLS_COMMON.length, m.SKILLS_COMMON.includes("spec-review"))'` ⇒ `21 false`; hoje ⇒ `22 true`.
   *Por que os dois juntos*: `eixos-stack.spec.mjs:533` exige toda skill local de `.agents/skills/**` em `SKILLS_COMMON` ∪ `SKILLS_BY_AXIS` e `:538` proíbe **fantasma** na lista — remover um lado só deixa a suíte vermelha (fixture real, não hipótese).

2. **Nenhuma invocação órfã: as 5 superfícies deixam de nomear o id, e a fase continua com portão.**
   *Verificação (SDD)*: `grep -rn 'spec-review' .agents README.md docs | wc -l` ⇒ `0` (hoje `7`: 5 de invocação + 2 de prosa); `grep -c 'spec-gate.md' .agents/rules/workflow-rules.md` ⇒ `≥1`; `grep -c 'Revisar SPEC' .agents/rules/workflow-rules.md` ⇒ `1` (o **passo** sobrevive à skill); `grep -c 'Revisar a SPEC contra' .agents/rules/sdd-workflow-standard.md` ⇒ `1`.
   *Contraprova de não-vacuidade*: `git diff -U0 -- .agents/rules/workflow-rules.md .agents/rules/sdd-workflow-standard.md .agents/agents/orchestrator/AGENT.md | grep -c '^@@'` ⇒ `5` hunks (1 por linha de §2.2 nos 3 arquivos, com o par table+step em `workflow-rules`).

3. **A baseline só encolhe — e o encolhimento é por arquivo.** `BASELINE` passa de **80** para **38**; `spec-review/*` **33 → 0** (5 arquivos), `security-review/SKILL.md` **4 → 0**, as 2 rules de frontend **5 → 0** (3 `incondicional` + 2 `identity`); **nenhuma** entrada de nenhum outro arquivo muda de linha, hash ou veredito.
   *Verificação (SDD)*: `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>{const by={};for(const e of m.BASELINE)by[e.file]=(by[e.file]||0)+1;console.log(m.BASELINE.length, by[".agents/skills/spec-review/README.md"]??0, by[".agents/skills/spec-review/assets/checklist.md"]??0, by[".agents/skills/security-review/SKILL.md"]??0)})'` ⇒ `38 0 0 0`.
   Hoje ⇒ `80 9 12 4`. *Contraprova de não-regressão*: o mapa por arquivo depois tem **19 chaves / 38** (hoje 27/80), com os mesmos totais nas 19 restantes — mapa integral em §4.4.

4. **`identity` desce de 14/11 para 4/3, e o registro de termos não fica com prova morta.**
   *Verificação (SDD)*: `node scripts/static-checks.mjs | grep V20` ⇒ `identity=4/3` e `baseline=38 (incondicional=34, identity=4)`; `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(JSON.stringify(m.PROJECT_TERMS.map(p=>p.term+":"+p.owner))))'` ⇒ `["TaskFlow:ADR-005","Pulse:ADR-005"]` (hoje `["TaskFlow:ADR-003","Atlas ECM:ADR-003","Pulse:ADR-005"]`); o `proof` de `TaskFlow` aponta para linha que **contém** o termo (`sed -n '1p' .agents/agents/developer-engineer/AGENT.md`), senão `cdl-identity-term-stale` FAIL.

5. **D1 formalizado: 0 `incondicional` e 0 nome de projeto nas 2 rules, sem reescrever prescrição.**
   *Verificação (SDD)*: `node --input-type=module -e 'const m=await import("./.opencode/plugins/lib/cdl/checks.mjs");const ex=await import("./installer/install.mjs");for(const f of [".agents/rules/frontend-coding-standards.md",".agents/rules/frontend-react-coding-standards.md"]){const a=m.scanArtifact(process.cwd(),f,{exports:{AXIS_IDS:ex.AXIS_IDS,RULES_BY_AXIS:ex.RULES_BY_AXIS,RULES_COMMON:ex.RULES_COMMON,SKILLS_BY_AXIS:ex.SKILLS_BY_AXIS,SKILLS_COMMON:ex.SKILLS_COMMON,STACKS_FOR_EXCEPTIONS:ex.STACKS_FOR_EXCEPTIONS}});console.log(f,JSON.stringify(a.verdicts.filter(v=>v.verdict==="incondicional").map(v=>v.line)))}'` ⇒ `[] []`; hoje ⇒ `[12,159]` e `[30]`.
   `grep -c 'Atlas ECM' .agents/rules/frontend-coding-standards.md .agents/rules/frontend-react-coding-standards.md` ⇒ `0 0` (hoje `3 3`); `awk 'END{print NR}'` ⇒ `188 194` (contagem preservada em ambos, para não deslocar nada); `git diff --numstat -- .agents/rules/frontend-coding-standards.md .agents/rules/frontend-react-coding-standards.md` ⇒ `4 4` e `4 4` (só as linhas de §2.3; **nenhuma** linha prescritiva do corpo é tocada).

6. **`security-review`: licença falsa removida, E-6 morta junto, débito estrutural zero.**
   *Verificação (SDD)*: `sed -n '4p;114p;165p' .agents/skills/security-review/SKILL.md` ⇒ nenhuma é `license:`/`npm audit`; `grep -c 'TaskFlow' .agents/skills/security-review/SKILL.md` ⇒ `0`; `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.EXCEPTIONS.length, m.EXCEPTIONS.some(e=>e.id==="E-6")))'` ⇒ `5 false`; `node scripts/static-checks.mjs | grep V20` ⇒ `structural-debt=0` e sem `cdl-exception-stale` em FAIL.
   *Fixture vermelha (deve continuar derrubando)*: recolocar `license: Foo Security Standard` numa cópia ⇒ alarme de A-1 FAIL **mesmo** com entrada `identity` na baseline (o comportamento que E-6 existia para contornar).

7. **D8/E-1/E-3 são exceção com predicado vivo, não prosa.** Nenhuma **nova** entrada das 6 skills de stack e nenhum arquivo de `ui-ux-pro-max` entra na baseline; `SKILLS_COMMON`/`SKILLS_BY_AXIS`/`RULES_BY_AXIS`/`RULES_COMMON` mantêm 21/2/2/6.
   *Verificação (SDD)*: `node --input-type=module -e 'import * as m from "./installer/install.mjs";console.log(m.SKILLS_COMMON.length, JSON.stringify(m.SKILLS_BY_AXIS), JSON.stringify(m.RULES_BY_AXIS), m.RULES_COMMON.length)'` ⇒ `21 {"frontend=react":["frontend-vue-specialist"],"frontend=vue":["frontend-react-specialist"]} {"frontend=react":["frontend-coding-standards.md"],"frontend=vue":["frontend-react-coding-standards.md"]} 6`; `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.EXCEPTIONS.map(e=>e.id).join(",")))'` ⇒ `E-1,E-2,E-3,E-4,E-5`; `node scripts/static-checks.mjs | grep V20` ⇒ `vocabulary=10`, `axis-decl=2/2`, `axis-class=0/1` (inalterados) e `structural-debt=0`.
   *Contraprova de que a exceção não apodrece*: renomear `java-architecture-specialist` para `java-arch` numa árvore temporária ⇒ `cdl-exception-stale` FAIL (`E-3: java-architecture-specialist ausente`).

8. **Instalador: 1 entrada removida, nenhum mapa novo, presets intactos.** `installer/install.mjs` é tocado **apenas** na lista `SKILLS_COMMON`; `RULES_BY_AXIS`, `SKILLS_BY_AXIS`, `AXIS_IDS`, `STACK_PROFILES`, `STACKS_FOR_EXCEPTIONS` e o bloco gerenciado (`HARNESS_MANAGED_CONFIG_KEYS`) sem diff.
   *Verificação (SDD)*: `git diff --numstat -- installer/install.mjs` ⇒ `0 1` (1 linha removida, **zero** inseridas); `git diff -- installer/install.mjs | grep -c '^[-+]'` ⇒ `3` (cabeçalho + a linha); `node --test "installer/__tests__/*.spec.mjs"` ⇒ 0 fail, com a cobertura bidirecional de `eixos-stack.spec.mjs` verde (disco↔lista sem fantasma e sem não-classificada).

9. **Selo: zero comando novo, zero republicação.** `commands.suiteFull` literalmente inalterado; `harness.config.json`, `seal.mjs` e `harness.config.json.protectedPaths` sem diff; `HARNESS_SEAL_JSON` não é republicado.
   *Verificação*: `git diff --exit-code -- harness.config.json .opencode/plugins/lib/seal.mjs` ⇒ vazio; `node -e 'console.log(require("./harness.config.json").commands.suiteFull)'` ⇒ literal atual; `node scripts/static-checks.mjs; echo $?` ⇒ `0`.

10. **O oráculo é a linha do `V20`, e os contadores batem com §4.5.** Nenhum número deste ADR é contrato: os valores abaixo são a **previsão** derivada e o SDD publica o medido.
    *Verificação (SDD)*: `node scripts/static-checks.mjs | grep V20` ⇒ `PASS` com `population=223/30385`, `prescriptions=137 (condicional=53, exemplo=33, catálogo=17, incondicional=34)`, `prohibition-cited=27`, `baseline=38 (incondicional=34, identity=4)`, `identity=4/3`, `payload=214`, `structural-debt=0`, `refs-undetected=20`, `vocabulary=10`.

11. **Os testes que assam número são atualizados para o novo oráculo (e o guard de "todo `incondicional` está na baseline" continua valendo).**
    *Verificação (SDD)*: `grep -n 'BASELINE.length' .opencode/plugins/__tests__/cdl.spec.mjs` ⇒ `38`; `grep -c 'assert.equal(report.counters.identity.lines, 4)' …` ⇒ `1`; `node --test ".opencode/plugins/__tests__/*.spec.mjs"` ⇒ 0 fail, inclusive `prescriptions.unconditional === baseline.unconditional` (34 = 34).
    *Nota*: `cdl.spec.mjs:754` cita o caminho de `spec-review` **dentro de fixture temporária** (não lê o disco real) — não precisa mudar; se o SDD o mover, muda o nome do fixture, nunca a asserção.

12. **Este ADR está fora do corpus do instrumento, e o batch só escreve em `.spec/prd/**`.**
    *Verificação*: `node scripts/static-checks.mjs` ⇒ exit `0` com `PASS ADR-01` e `PASS ADR-02` **não-vacuosos** (linhas `ADR-001`+`ADR-002` `merged` e `ADR-003` `in-progress`, 3 linhas / 3 dirs); `git show --stat --name-only HEAD` ⇒ `ADR-INDEX.md` + `ADRs/ADR-003-skills-comuns-e-spec-review/ADR.md`; `.spec/**` é a exclusão **X1** (ADR-001 §2.1).

## 4. Aplicação — o que a régua diz hoje

Regra de leitura: **veredito hoje** é o medido (`V20`/`BASELINE`, HEAD `4838e0e`); **alvo** é o veredito da rubrica do ADR-001 §2.3; **ação** é o que o SDD faz. Nenhuma linha é "caso especial".

### 4.1 `spec-review` — 33 entradas / 5 arquivos, todas `removido`

| Arquivo | Linhas | Entradas | `identity` | `incondicional` | Veredito alvo | Ação | Comando |
|---|---|---|---|---|---|---|---|
| `README.md` | 303 | 9 | 1 (`:1`) | 8 (`:83,111,114,115,116,141,178,179`) | **`removido`** | apagar | `test -e .agents/skills/spec-review/README.md` ⇒ exit `1` |
| `SKILL.md` | 225 | 7 | 2 (`:3`,`:8`) | 5 (`:61,116,164,166,167`) | **`removido`** | apagar | `test -e …/SKILL.md` ⇒ exit `1` |
| `assets/checklist.md` | 187 | 12 | 1 (`:1`) | 11 (`:48,94,98,99,106,117,120,121,137,159,161`) | **`removido`** | apagar | `test -e …/assets/checklist.md` ⇒ exit `1` |
| `assets/output-template.md` | 274 | 1 | 1 (`:7`) | 0 | **`removido`** | apagar | `test -e …/assets/output-template.md` ⇒ exit `1` |
| `assets/usage-guide.md` | 309 | 4 | 1 (`:1`) | 3 (`:3,258,259`) | **`removido`** | apagar | `test -e …/assets/usage-guide.md` ⇒ exit `1` |
| **total** | **1.298** | **33** | **6** | **27** | — | — | `git ls-files .agents/skills/spec-review/ \| wc -l` ⇒ `0` |

**Nenhuma linha recebe `condicional`/`exemplo`/`catálogo`.** Não é preguiça de classificação: §2.1 mediu que 5 de 5 arquivos são material de outro projeto em 100% do conteúdo — o veredito de sítio (`removido`) é o que a rubrica oferece para "este artefato não pertence ao corpus do destino". Reclassificar linha a linha produziria um artefato de 1.298 linhas que **continua** sendo do TaskFlow, com vereditos verdes.

### 4.2 `security-review/SKILL.md` — 4 entradas → 0

| `arquivo:linha` | Hoje | Alvo | Ação | Verificação |
|---|---|---|---|---|
| `:4` | `identity` (+E-6) | removida | apagar a linha `license:` | `sed -n '1,6p' … \| grep -c '^license:'` ⇒ `0`; E-6 fora de `EXCEPTIONS` |
| `:3` | `identity` | `identity`→não-identitária | `the project's security standard (source of truth)` | `grep -c 'TaskFlow' …` ⇒ `0` |
| `:115` | `incondicional` | `null` | auditoria pelo gerenciador do eixo (`commands.audit`) | `classifyLine` ⇒ `null` |
| `:166` | `incondicional` | `null` | idem, sem `npm`/`Dependency-Check` | `classifyLine` ⇒ `null` |

### 4.3 As 2 rules de frontend — 5 entradas → 0 (+ 4 linhas de prosa de projeto)

| `arquivo:linha` (baseline) | Hoje | Alvo | Mecanismo | Verificação |
|---|---|---|---|---|
| `frontend-coding-standards.md:12` (`@rule-axis:frontend=react#0`) | `incondicional` | `condicional` | heading `:7` → `## Stack definitiva (Vue)` | item 5 ⇒ `[]` |
| `frontend-coding-standards.md:159` (idem) | `incondicional` | `condicional` | heading `:154` → `## Dependências Principais (Vue)` | idem |
| `frontend-coding-standards.md:154` (idem) | `identity` | `null` | heading de-identificado | `grep -c 'Atlas ECM'` ⇒ `0` |
| `frontend-react-coding-standards.md:30` (`@rule-axis:frontend=vue#0`) | `incondicional` | `condicional` | heading `:21` → `## ESLint / Formatação (React)` | item 5 ⇒ `[]` |
| `frontend-react-coding-standards.md:161` (idem) | `identity` | `null` | heading de-identificado | `grep -c 'Atlas ECM'` ⇒ `0` |
| *fora de baseline*: `:3`, `:152` / `:3`, `:159` | prosa (`null`) e proibição (D2) | veredito-neutro | remover "no `Atlas ECM`" / "para o frontend `Atlas ECM`" | `git diff --numstat` ⇒ `4 4` / `4 4`; `prohibition-cited` não sobe |

### 4.4 Os artefatos do instrumento e o mapa da baseline

| Alvo | O que muda | Verificação |
|---|---|---|
| `.opencode/plugins/lib/cdl/checks.mjs` — `BASELINE` | −33 (`spec-review/*`) −4 (`security-review`) −5 (`@rule-axis:*`) | item 3 |
| `.opencode/plugins/lib/cdl/checks.mjs` — `PROJECT_TERMS` | `Atlas ECM` **removido**; `TaskFlow.proof` re-apontado + `owner: ADR-005` | item 4 |
| `.opencode/plugins/lib/cdl/checks.mjs` — `EXCEPTIONS` | `E-6` **removida** (6 → 5); `E-1..E-5` intactas | item 6/7 |
| `installer/install.mjs` — `SKILLS_COMMON` | `'spec-review'` removido (22 → 21); **nada mais** | item 8 |
| `.opencode/plugins/__tests__/cdl.spec.mjs` | 80→38, 14→4, 66→34, 228/31.661→223/30.363, 11→3 | item 11 |

**Baseline depois — 19 chaves / 38 entradas** (contraprova de que só estes 3 grupos encolheram):

```
3 .agents/agents/code-reviewer/PROMPT.md          2 .agents/agents/design-system-specialist/AGENT.md
5 .agents/agents/developer-engineer/AGENT.md      9 .agents/agents/orchestrator/AGENT.md
2 .agents/agents/ux-designer/AGENT.md             2 .agents/skills/dev-planner/SKILL.md
1 .agents/skills/harness-installer/SKILL.md       1 .agents/skills/nestjs-architecture-specialist/SKILL.md
1 .agents/skills/node-architecture-specialist/SKILL.md
1 .agents/skills/prompt-optimizer/references/clarifying-questions.md
1 .agents/skills/sdd-architecture-board/SKILL.md  1 .agents/skills/sdd-compiler/asserts/spec-gate.md
1 .agents/skills/sdd-compiler/references/backend.md  2 .agents/skills/sdd-compiler/references/database.md
1 .agents/skills/sdd-compiler/references/frontend.md 1 .agents/skills/template-best-practices/SKILL.md
2 .agents/skills/template-structure/SKILL.md      1 docs/INSTALACAO.md      1 spec-developed.md
```

### 4.5 `V20` esperado — antes → depois (previsão derivada; o oráculo é a linha publicada)

| Contador | Antes (`4838e0e`) | Depois | Δ derivado de |
|---|---|---|---|
| `population` | `228/31661` | `223/30385` | −5 arquivos, −1.298 linhas |
| `prescriptions` | `178 (56/39/17/66)` | `137 (53/33/17/34)` | −39 (arquivos removidos) −2 (`security:115,166` → `null`); `+3` migram de `incondicional` para `condicional` |
| `prohibition-cited` | `39` | `27` | −12 (as 5 proibições de `README`, 3 de `SKILL`, 4 de `checklist` saem com os arquivos) |
| `baseline` | `80 (66/14)` | `38 (34/4)` | −32 `incondicional`, −10 `identity` |
| `identity` | `14/11` | `4/3` | −6 (spec-review) −2 (security-review) −2 (rules de frontend) |
| `payload` | `219` | `214` | −5 `.md` de `spec-review` fora de `SKILLS_COMMON` |
| `structural-debt` | `1` | `0` | `license:` removida + E-6 retirada |
| `refs-undetected` | `20` | `20` | `spec-review` não cita `DESIGN.md`/`.doc/` (medido: 0 em 5/5) — o contador é todo do ADR-004 |
| `axis-decl` / `axis-class` | `2/2` · `0/1` | `2/2` · `0/1` | nenhum mapa de eixo muda (D1 formaliza, não move) |
| `vocabulary` | `10` | `10` | `AXIS_IDS` intocado |
| `vendor-upstream` | `284/94` | `284/94` | E-5 não é tocada |

## 5. Consequências

- **C1 — o destino recebe 1.298 linhas menos de norma que não é dele — e não fica sem portão.** A revisão de SPEC continua obrigatória e continua **mecânica**: `asserts/spec-gate.md` viaja no payload, e o parecer do revisor do destino é opcional. É a mitigação direta de R2 ("agnóstico vira vazio"): o passo não foi apagado, foi **despersonificado**.
- **C2 — a maior dívida isolada do repo fecha sem uma única linha nova de conteúdo.** 33 entradas a menos, `identity` 14 → 4, `payload` 219 → 214. Nenhum arquivo novo é criado; nenhuma regra perde prescrição útil (as 2 rules de frontend mantêm as 382 linhas, só nomeiam o eixo no heading).
- **C3 — D1 deixa de ser uma afirmação sobre o ADR-001 e passa a ser uma afirmação sobre o `V20`.** O `ADR-001` §4.5-D1 afirmou "0 `incondicional`"; o instrumento mediu 3 (§8-N2). A decisão não mexeu na rubrica: usou o mecanismo que o ADR-002 já validou (M1) para fazer o número bater com a intenção.
- **C4 — custo de gate declarado.** `.agents/rules/**`, `.agents/agents/**`, `.agents/skills/**`, `.opencode/plugins/**` e `installer/**` são `protectedPaths` ⇒ **um** trailer `Harness-Gate-Change` no PR do SDD (R4 do `RESEARCH.md` §9). Não é bloqueio; é o preço de apagar o que viaja.
- **C5 — a tensão com o `PRD.md:215` fica registrada, com leitura e escopo mínimo.** O PRD proíbe tocar `installer/` neste ciclo *"inclusive `RULES_BY_AXIS`/`SKILLS_BY_AXIS`/`SKILLS_COMMON`"*, e a razão declarada na mesma linha é *"mover é do PRD 3 **se exigir mapa novo**"*. Esta entrega remove **uma** entrada de `SKILLS_COMMON` (0 inserções, 0 mapas novos, 0 presets revalidados) porque a invariante de cobertura (`eixos-stack.spec.mjs:533,538`) torna a remoção do diretório e a da entrada **inseparáveis**. Fazer só a metade do diretório deixa a suíte vermelha; fazer só a metade da lista deixa 33 entradas de dívida e o `V19`/`V20` mentindo sobre o payload. A alternativa (deferir tudo ao PRD-3) está em §6 com custo medido.
- **C6 — 🟠 escape declarado (os mesmos dos precedentes).** (a) `scripts/static-checks.mjs` não é `protectedPaths`: remover a chamada de `checkCdl()` desliga o `V20` sem trailer (ADR-001-C7). (b) O destino herda o **módulo** mas não o `V20`; ele não tem como medir a própria baseline (PRD-3). (c) O corpo de `spec-gate.md` ainda é parcialmente stack-bound (§2.6) — o portão que substitui `spec-review` **não** é 100% agnóstico hoje, e isso está declarado com dono, não escondido.
- **C7 — o `V20` não guarda época.** "Só encolhe" é a consequência do par (`cdl-unconditional-unbaselined` + `cdl-baseline-stale`), não de um histórico. Quem quiser a trajetória olha o `git log` do módulo. Declarado para não vender garantia que o instrumento não dá.

## 6. Alternativas descartadas

| Alternativa | Custo medido neste repo | Por que não |
|---|---|---|
| **Reescrever `spec-review` como revisor genérico** (a opção (a) de D3) | 1.298 linhas + 5 artefatos a reinventar, + 27 `incondicional` → `condicional` (baseline 80 → 47, não → 38) | Mantém um **segundo** revisor concorrente com o portão do `sdd-compiler`, com metodologia de review que o harness não domina. Owner descartou; e o ganho seria 33 linhas de dívida trocadas por 1.298 de manutenção |
| **Manter + rotular `description`** (a opção (c) de D3) | 2 linhas de frontmatter | 27 `incondicional` + 6 `identity` permanecem, `payload` continua 219, e o destino continua recebendo TaskFlow. É o status quo com adesivo — o PRD não teria ADR-003 |
| **Mover os 5 arquivos para `.spec/**`** | 1 `git mv` + 5 entradas de baseline que "desaparecem" | `.spec/**` é a exclusão **X1**: a dívida sairia do instrumento **sem** ser paga, e o ADR-003 estaria usando a regra de corpus como esconderijo. Descartado por princípio, e é o atalho mais tentador que este ADR recusa explicitamente |
| **Criar a classe "skill de projeto" no instalador** | 1 mapa novo (`SKILLS_PROJECT_LOCAL`) + validação na carga + `eixos-stack` com 3 classes + 12 presets a revalidar | É exatamente o que o `PRD.md:215` reserva ao PRD-3 ("mover é do PRD 3 **se exigir mapa novo**"). Benefício: manter 1.298 linhas de outro projeto no repo do harness. Custo/benefício invertido |
| **Deferir a remoção inteira ao PRD-3** (não tocar `SKILLS_COMMON`) | 0 linha de instalador | As 33 entradas **e** o payload ficam como estão; RF-08 não é entregue e este ADR nasce sem efeito medível — decisão sem consequência é pior que decisão cara. Declarado em C5 |
| **Manter `spec-review` no payload e gatear por eixo** | 1 chave nova em `SKILLS_BY_AXIS` | O artefato não é de **um** eixo: é de **outro projeto** (Spring Boot **e** Vue **e** Liquibase **e** Pinia). Nenhum par `<eixo>=<id>` o descreve, e ele voltaria a viajar para o destino que tem aquele eixo |
| **Substituir a invocação por uma nova skill de revisão genérica** | 1 skill nova no payload (autor, manutenção, veredito) | O portão **já existe** (`asserts/spec-gate.md`, `SKILLS_COMMON`) e o produto textual já existe (relatório de gaps). Criar persona nova para o mesmo passo é custo sem ganho — e o `PRD.md` §7 não autoriza artefato novo neste ciclo |
| **Tocar a rubrica para o teste `all` do passo 5 aceitar termo cruzado** (resolveria as 3 linhas de frontend sem heading) | 1 mudança de predicado + re-derivação de TODA a baseline (as 176 prescrições) + 1 rodada de FP/FN | A rubrica está **fechada** (ADR-001 §2.3-ter, 3 rodadas) e o owner proibiu reabri-la. O heading é o mecanismo que o ADR-002 já provou (M1), custa 4 linhas e não move um único veredito de outro arquivo |
| **Remover `PROJECT_TERMS["TaskFlow"]` junto com a prova** | 1 linha | Haveria **3 linhas identitárias vivas** (`developer-engineer:1,25`, `ux-designer:32`) e o alarme `cdl-identity-term-stale` só olha termos **registrados** — remover o termo apagaria o alarme em vez da dívida. ADR-001 §2.2 declara esse ponto cego; usá-lo seria transformá-lo em método |

## 7. Critérios de verificação

**Re-derivação do contexto (rodar antes do SDD; tem de bater com §1/§4):**

```sh
# o oráculo
node scripts/static-checks.mjs | grep -E '^(PASS|FAIL) (V18|V19|V20|ADR-0|PRD-01)'

# as 33 entradas de spec-review, por arquivo e por veredito
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>{const t=".agents/skills/spec-review/";const by={};
  for(const e of m.BASELINE) if(e.file.startsWith(t)){by[e.file]=by[e.file]||{n:0,i:0,u:0};by[e.file].n++;by[e.file][e.verdict[0]]++;}
  console.log(JSON.stringify(by,null,0));console.log("total",Object.values(by).reduce((a,b)=>a+b.n,0))})'

# as 5 entradas @rule-axis (o sujeito real das 2 rules de frontend)
node --input-type=module -e 'import * as m2 from "./installer/install.mjs";import fs from "node:fs";
 const m=await import("./.opencode/plugins/lib/cdl/checks.mjs");
 for(const e of m.BASELINE.filter(x=>x.file.startsWith("@"))){const r=/^@rule-axis:(.+)#(\d+)$/.exec(e.file);
   const p=".agents/rules/"+m2.RULES_BY_AXIS[r[1]][Number(r[2])];
   console.log(p+":"+e.line,e.verdict,fs.readFileSync(p,"utf8").split("\n")[e.line-1].slice(0,70))}'

# as 42 entradas com owner ADR-003 (o perímetro exato deste ADR)
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.BASELINE.filter(e=>e.owner==="ADR-003").length))'   # 42

# o mapa por arquivo (é o que o item 3 exige preservar)
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>{const by={};for(const e of m.BASELINE)by[e.file]=(by[e.file]||0)+1;
  console.log(Object.entries(by).sort().map(([k,v])=>v+" "+k).join("\n"));console.log("keys",Object.keys(by).length,"sum",m.BASELINE.length)})'

# as 5 referências vivas + 2 de prosa
grep -rn 'spec-review' .agents README.md docs | grep -v '.agents/skills/spec-review/'

# a invariante que torna remoção-de-dir e remoção-de-lista inseparáveis
sed -n '528,540p' installer/__tests__/eixos-stack.spec.mjs
```

**Aceite do SDD deste ADR** (cada bloco mapeia para um item de §3):

```sh
# IF-1 / IF-2: fora do payload, sem invocação órfã
git ls-files .agents/skills/spec-review/ | wc -l                                  # 0
node --input-type=module -e 'import * as m from "./installer/install.mjs";console.log(m.SKILLS_COMMON.length,m.SKILLS_COMMON.includes("spec-review"))'   # 21 false
grep -rn 'spec-review' .agents README.md docs | wc -l                             # 0
grep -c 'spec-gate.md' .agents/rules/workflow-rules.md                            # ≥1
grep -c 'Revisar SPEC' .agents/rules/workflow-rules.md                            # 1

# IF-3 / IF-4: baseline só encolhe, identidade coerente
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>{const by={};for(const e of m.BASELINE)by[e.file]=(by[e.file]||0)+1;
 console.log(m.BASELINE.length, Object.keys(by).length, m.BASELINE.filter(e=>e.verdict==="identity").length)})'   # 38 19 4
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.PROJECT_TERMS.map(p=>p.term+":"+p.owner).join(",")))'   # TaskFlow:ADR-005,Pulse:ADR-005

# IF-5: D1 formalizado, sem tocar o corpo
grep -c 'Atlas ECM' .agents/rules/frontend-coding-standards.md .agents/rules/frontend-react-coding-standards.md   # 0 0
awk 'END{print NR}' .agents/rules/frontend-coding-standards.md .agents/rules/frontend-react-coding-standards.md   # 188 / 194
git diff --numstat -- .agents/rules/frontend-coding-standards.md .agents/rules/frontend-react-coding-standards.md # 6 6 / 5 5

# IF-6 / IF-7: licença e exceções
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.EXCEPTIONS.map(e=>e.id).join(",")))'   # E-1,E-2,E-3,E-4,E-5
node scripts/static-checks.mjs | grep V20                                          # structural-debt=0

# IF-8 / IF-9: instalador mínimo, selo intacto
git diff --numstat -- installer/install.mjs                                       # 0 1
node --test "installer/__tests__/*.spec.mjs"                                      # 0 fail
git diff --exit-code -- harness.config.json .opencode/plugins/lib/seal.mjs         # vazio
node -e 'console.log(require("./harness.config.json").commands.suiteFull)'

# IF-10 / IF-11: o oráculo e os testes assados
node scripts/static-checks.mjs; echo $?                                           # 0
node --test ".opencode/plugins/__tests__/*.spec.mjs"                              # 0 fail

# IF-12: batch só em .spec/prd/**
git show --stat --name-only HEAD
```

**Fora do aceite deste ADR (declarado):** o corpo das skills de stack e as 11 linhas identitárias de agentes (ADR-005), `DESIGN.md` e os 8 paths (ADR-004), mapa novo no instalador (PRD-3), runner do `V20` no destino (PRD-3) e qualquer alteração em `gate.js` (byte-idêntico).

## 8. Notas de correção (divergências medidas entre PRD/RESEARCH/ADR-001 e o disco)

- **N1 — `spec-review` mede 1.298 linhas, não 1.303.** `PRD.md:123,250` e o RF-08 publicam **1.303**; o disco dá **1.298** (`wc -l`: 303+225+187+274+309), com **1 linha a menos em cada um dos 5 arquivos** — assinatura de uma medição anterior a uma edição. O número que este ADR usa é o medido, e o desvio de 5 linhas **não** muda nenhuma das 33 entradas.
- **N2 — "as duas rules de frontend têm 0 linha `incondicional` hoje" é falso.** `ADR-001` §4.5-D1 afirma isso; o `V20`/`scanArtifact` mede **3** (`frontend-coding-standards.md:12,159`, `frontend-react-coding-standards.md:30`), e são justamente as 3 entradas `incondicional` de baseline `@rule-axis:*`. A causa é o teste `allowed.every(term ⇒ eixo ∈ declared)` encontrando termo **de outro eixo** na mesma linha (`Radix` na rule de Vue; `mdi-*`/`ri-*` na de React). Consequência dura para D1: "formalizar sem tocar" **não** zera a dívida — exige nomear o eixo em 4 headings (§2.3). O que **não** se fez: mexer na rubrica.
- **N3 — as 5 entradas das rules de frontend existem e o ADR-001 não as viu na tabela dele.** O `file` dessas entradas é o **slot** `@rule-axis:<chave>#<índice>`, resolvido em tempo de execução por `RULES_BY_AXIS` (`checks.mjs:348-357`) — por isso elas não aparecem em `ADR-001` §4.1/§4.2, que listam path literal. Materialmente são **5 das 42** entradas com `owner: ADR-003`, e estão neste ADR.
- **N4 — a tensão com `PRD.md:215` é real e fica com escopo mínimo declarado.** O PRD proíbe tocar `installer/` *inclusive* `SKILLS_COMMON`; a razão escrita na mesma linha é *"mover é do PRD 3 **se exigir mapa novo**"*. Este ADR remove **1** entrada (0 inserções, 0 mapas, 0 presets) porque `eixos-stack.spec.mjs:533` e `:538` (cobertura bidirecional) tornam dir-e-lista inseparáveis. Registrado em C5 e em §6 com a alternativa de deferimento e seu custo — o owner decide no G2 se prefere a outra metade.
- **N5 — `RESEARCH.md` §8 diz que as 6 skills de stack "passam a condicionar o corpo ao eixo"; o módulo registra as 2 entradas de corpo com `owner: ADR-005`.** Pela regra do oráculo (§10-N7 do ADR-001) o dono é o que o módulo publica: as 2 entradas **ficam** e são do ADR-005. `E-3` cobre **identidade pelo nome**, não corpo — e é por isso que D8 é exceção de identidade, não salvo-conduto de prosa.
- **N6 — `ui-ux-pro-max` são 24 arquivos, dos quais 1 `.md`.** A população mede **linha `.md`** (ADR-001 §2.1), logo o catálogo contribui **1** arquivo com vereditos `exemplo=1, catálogo=2` e os 23 restantes (14 `.csv` + 9 outros) nunca entram **por forma**. O "24 arquivos" do PRD é a pasta, não a população — e a exceção E-1 cobre 1, não 24.
- **N7 — E-6 é obrigação herdada, não opcional.** Corrigir o `license:` de `security-review/SKILL.md:4` **sem** remover `E-6` de `EXCEPTIONS` produz `cdl-exception-stale` FAIL (predicado `structural-offender` não casa mais). O ADR-001 §2.5 já avisou: *"corrigida a linha, a exceção fica obsoleta e o próprio check reprova"*. A remoção da entrada é parte do fix, não limpeza.
- **N8 — o `V20` não tem contador de "órfão de invocação".** O `V18` mede path de `rules/*.md` citado e ausente; **id de skill** citado e não distribuído não é medido por ninguém. A prova de §3-IF2 é `grep` (🟡 revisão assistida), não instrumento — declarado para não vender garantia que não existe. Candidato a contador no PRD-3.

## 9. O que fica para o SDD deste ADR

Nesta ordem (a ordem importa: 2 antes de 3, senão o `V20` reprova no meio do caminho):

1. **`.agents/skills/spec-review/**`** — remover os 5 arquivos (1.298 linhas).
2. **`.agents/rules/workflow-rules.md`** — linhas `205` e `566` conforme §2.2, **sem** inserir/remover linha.
3. **`.agents/rules/sdd-workflow-standard.md:44`** e **`.agents/agents/orchestrator/AGENT.md:43,306`** — conforme §2.2, contagem de linhas preservada (o `AGENT.md` tem 9 entradas de baseline; nenhuma pode deslocar).
4. **`README.md:15`** e **`docs/FUNCIONAMENTO.md:134`** — remover o id da célula.
5. **`installer/install.mjs:425`** — remover `'spec-review'` de `SKILLS_COMMON`; **nenhuma** outra linha do arquivo.
6. **`.agents/rules/frontend-coding-standards.md`** e **`.agents/rules/frontend-react-coding-standards.md`** — os 4 headings de §2.3 + as 4 linhas de prosa de projeto; contagem de linhas preservada em ambos (188/194).
7. **`.agents/skills/security-review/SKILL.md`** — as 4 linhas de §2.4 (a remoção da `license:` desloca 115/166 → 114/165; sem outros efeitos).
8. **`.opencode/plugins/lib/cdl/checks.mjs`** — remover 42 entradas de `BASELINE`, remover `E-6` de `EXCEPTIONS`, remover `PROJECT_TERMS["Atlas ECM"]`, re-apontar `PROJECT_TERMS["TaskFlow"].proof` para `.agents/agents/developer-engineer/AGENT.md:1` e trocar `owner` para `ADR-005`. **Nenhuma** mudança de predicado, `VERDICTS` ou id de falha.
9. **`.opencode/plugins/__tests__/cdl.spec.mjs`** — 80→38, 14→4, 66→34, 11→3, 228/31.661→223/30.363 (itens de §3-IF11).
10. **Rodar o harness completo** — `commands.suiteFull` (plugins, instalador, static-checks, vendor-check) e `node scripts/sdd-checks.mjs`; `VERIFY.md` com as 3 dimensões e a linha do `V20` transcrita.
11. **PR do SDD** — trailer `Harness-Gate-Change` (5 paths protegidos: `.agents/rules/**`, `.agents/agents/**`, `.agents/skills/**`, `.opencode/plugins/**`, `installer/**`), `git diff --exit-code -- harness.config.json .opencode/plugins/lib/seal.mjs`, e a URL de compare impressa (merge é humano — `.agents/rules/prd-adr-pipeline.md` §4).

**Fora do SDD (declarado):** corpo das skills de stack e as 11 linhas identitárias de agentes (ADR-005), `spec-gate.md` stack-bound (§2.6, ADR-005), `DESIGN.md`/8 paths (ADR-004), mapa novo no instalador e runner do `V20` no destino (PRD-3), `gate.js` (byte-idêntico).

## 11. Correções do review (rodada 1)

- **H2 — números do ADR × medido.** `git diff --numstat` das 2 rules dá `4 4` / `4 4` (o ADR previu `6 6`/`5 5`: só heading + prosa de identidade mudam; o corpo prescritivo é requisito intacto) e `population=223/30385` (não 30363: o ADR esqueceu a linha `license:` removida). Implementação correta, **texto do ADR errado** — corrigido. O oráculo segue sendo a linha do `V20` (ADR-001 N7).
- **H3 — item 7 dizia que nenhuma skill de stack está na baseline.** Falso: `nestjs:81` e `node:86` continuam, com `owner: ADR-005` (o **corpo** é a dívida; o eixo pelo nome já está correto). Frase corrigida para "nenhuma **nova** entrada" — o N5 já dizia isso.
- **H1 — o P1→P2 pedia um "score" que a skill removida produzia e nada substituiu.** Fechado em `asserts/spec-gate.md` §5: `score = itens atendidos / itens aplicáveis × 100`, com `N/A` só com motivo (sem motivo conta ❌ e fica no denominador) e `aplicáveis = 0 ⇒ score N/A` tratado como FAIL. O portão do orchestrator (tabela P1→P2 e passo 15) passou a citar a fórmula. Custo declarado: `spec-gate.md` 22 → 45 linhas.
- **H4 — ciclo não registrado.** O `sdd-checks` verde media o ciclo do ADR-002 (vacuidade para este); registro e versionamento feitos no fechamento.
- **H5 — menções obsoletas** (`workflow-state.json:597,1051,1095`; `.spec/bugs/installer-upgrade-regression/TASKS.md:147`) ficam como registro datado: descrevem estado passado, não instrução.

- **H6 (QA) — `population` sobe para 223/30385, não 30362.** A definição do score em `spec-gate.md` (§5) acrescentou 23 linhas ao payload; o número de arquivos segue 223. Registrado: o oráculo é a linha do `V20`, e ela muda quando o próprio payload muda — o que é o comportamento correto.
