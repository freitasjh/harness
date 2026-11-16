# ADR-005 — Frota restante: exceção só vive sob predicado com expiração, e dívida se converte com dono — nunca se apaga para zerar contador

- **prd-id**: `prd-agnostic-artifacts` — `.spec/prd/prd-agnostic-artifacts/PRD.md`
- **order**: 5 de 5 (`.spec/prd/prd-agnostic-artifacts/ADR-INDEX.md`) — **último ADR do PRD-2**
- **status**: `in-progress`
- **branch**: `adr/prd-agnostic-artifacts/05-frota-restante` (de `main` @ `e297d82`, HEAD `5644d37`)
- **depende-de**: **ADR-001, ADR-003, ADR-004** — do **ADR-001** herda a rubrica de 4 vereditos (`condicional | exemplo | catálogo | incondicional`), a `declaredAxis` por nome de skill (E-3, §2.3 derivação 3), os ids de falha `cdl-exception-stale`/`cdl-baseline-stale`/`cdl-identity-term-stale` e o **oráculo de §10-N7** (o número que vale é o da linha do `V20`, nunca o parágrafo de um ADR); do **ADR-003** herda a regra de re-medir quando o payload muda (§11-H6) e o resultado de D8 (catálogo + 6 skills de stack permanecem em `SKILLS_COMMON`); do **ADR-004** herda a rubrica `RC0..RC6` e, especificamente, as **9 linhas de `.doc/**`** que ele classificou RC3 com dono ADR-005 (§4.3) — é este ADR que fecha esse dono. Nota de divergência: o parágrafo "Dependências do fatiamento" do `ADR-INDEX.md` dizia que ADR-005 declararia `depends_on = ADR-001` sozinho; a dependência ampliada para 3 ADRs é decisão desta entrega e o índice é atualizado no mesmo commit (§8-N1).
- **data**: 2026-11-16
- **dono da decisão**: owner do harness — portão **G1** (PRD §16). Duas decisões, **não reabertas**: **D2** = *"proibição não é acoplamento (exceção permanente): banir tecnologia por nome é permitido em qualquer rule, e A-2 mede prescrição, não proibição"* (`PRD.md:328`); **D8** = *"exceção permanente declarada: `ui-ux-pro-max` (catálogo) e as 6 skills de stack seguem em `SKILLS_COMMON`; o nome da skill declara a stack de propósito (E-3)"* (`PRD.md:334`). A contribuição deste ADR é o **predicado e a expiração** dessas exceções — não a sua revisão.
- **rota**: refactor de governança (rubrica + prosa; nenhum comportamento de produto observável ⇒ não gera PRD novo; `.agents/rules/prd-adr-pipeline.md` §3)
- **insumo de pesquisa**: `RESEARCH.md` §4 (tema B — **B1 + B3**: identidade por nome + corpo condicionado, sem tocar o mapa do instalador), §8 (recomendação do ADR-005: *"D2 formalizada como exceção permanente com frase de critério e D8 como exceção declarada; RF-02 aplicado aos 11 arquivos identitários por reescrita de escopo"*, critério *"A-1 = 0 e cada exceção nomeada com razão escrita + contagem re-derivável; nenhuma proibição removida sem substituto positivo"*) e §9. `PRD.md` §3.4 (taxonomia de frase), §3.6 (E-1..E-4), §9 (RF-02, RF-04), §16 (D2/D8). Rubrica de correção de prosa órfã: `ADR-005` do PRD-1 — **reutilizada por referência, não reaberta**.
- **escopo de escrita desta entrega**: `.spec/prd/prd-agnostic-artifacts/**` (`ADR.md` + `ADR-INDEX.md`, com a promoção de `ADR-004` a `merged`). **Nenhum** arquivo de `.agents/**`, `installer/**`, `opencode.json`, `harness.config.json`, `scripts/**` ou `.opencode/plugins/**` foi tocado — as reescritas, as reclassificações, os donos e as expirações são o **SDD deste ADR**.
- **escopo não decidido aqui**: `gate.js`, `harness.config.json`, selo (byte-idênticos), mapa do instalador (PRD-3), reativação do eixo backend (PRD-4), conteúdo do `DESIGN.md` (PRD-5), a rubrica do ADR-001 nem os ADRs 002–004.

---

## 1. Contexto — o que a medição diz hoje (pós-ADR-004)

Todos os números abaixo foram **re-medidos** em `main @ e297d82` (2026-11-16), não copiados do PRD. O oráculo é a linha publicada pelo instrumento; este parágrafo é **previsão derivada**, não contrato (ADR-001 §10-N7, ADR-003 §11-H6).

| Fato medido | Valor no HEAD | Comando / fonte |
|---|---|---|
| `V20` — CDL | `population=223/30372`, `prescriptions=138 (condicional=53, exemplo=34, catálogo=17, incondicional=34)`, `prohibition-cited=27`, `baseline=38 (incondicional=34, identity=4)`, `identity=4/3`, `refs-undetected=9 (owner ADR-004)`, `vocabulary=10`, `payload=214`, `structural-debt=0`, `heuristic=true fp=5/90 fn=4/90` | `node scripts/static-checks.mjs \| grep V20` |
| `V18` — refs de rule | `baseline=1`, `non-defect=1` | `node scripts/static-checks.mjs \| grep V18` |
| `V19` — inventário | `skills=47 (vendor-by-axis=25, consumer=21, axis=0, orphan=1)`, `rules=8 (consumer=7, axis=1, orphan=0)`, `agents=10/10` | `node scripts/static-checks.mjs \| grep V19` |
| Entradas de baseline com `owner: ADR-005` | **38** (34 `incondicional` + 4 `identity`) | `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>{const e=m.BASELINE.filter(x=>x.owner==="ADR-005");console.log(e.length,e.filter(x=>x.verdict==="identity").length)})'` ⇒ `38 4` |
| `.doc/**` — dívida herdada do ADR-004 | **9 linhas / 5 paths**, todos os alvos ausentes no disco | `grep -rPn '\`?\.doc/[\w./-]+\`?' .agents opencode.json \| wc -l` ⇒ `9`; `for p in …; do test -e $p \|\| echo MISSING $p; done` ⇒ 5 `MISSING` |
| Identidade viva (A-1) | **4 linhas / 3 arquivos**: 3 `TaskFlow` + 1 `Pulse` | `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>{for(const x of m.BASELINE.filter(x=>x.verdict==="identity"))console.log(x.file+":"+x.line)})'` |
| `PROJECT_TERMS` com dono aberto | `TaskFlow` (prova `developer-engineer/AGENT.md:1`) e `Pulse` (prova `design-system-specialist/AGENT.md:42`) — ambos `owner: ADR-005`, termo ainda não tratado | módulo `cdl/checks.mjs`, `PROJECT_TERMS` |
| Corpo stack-bound em skill de eixo | `nestjs-architecture-specialist/SKILL.md:81` (`Jest`), `node-architecture-specialist/SKILL.md:86` (`Jest/Vitest`) — 2 entradas de baseline `owner: ADR-005`; `declaredAxis` por nome = `{nestjs}` / `{node}` | `node --input-type=module` com `exports` do instalador ⇒ `[nestjs]` / `[node]` |
| Resíduo ADR-003 fora da baseline | `security-review/SKILL.md:131` prescreve `npm audit + Dependency-Check` num bloco `exemplo` — sem dono explícito | `sed -n '131p' .agents/skills/security-review/SKILL.md` |
| Posição D2 escrita no repo | `harness-installer/SKILL.md:161-164` — "citam Vuetify/Lombok/… para bani-los … sem falso-positivo" | `sed -n '161,164p' .agents/skills/harness-installer/SKILL.md` |

**O defeito que este ADR existe para não cometer** tem duas caras, e as duas são decisão, não detalhe de implementação:

1. **"Permanente" sem predicado é dívida disfarçada.** D2 e D8 foram fechados pelo owner como exceções permanentes. Se "permanente" for lido como *"para sempre, sem condição a medir"*, a exceção vira isenção: ninguém percebe quando o catálogo deixa de ser catálogo, quando a skill de stack passa a prescrever outro eixo no corpo, ou quando a posição D2 em `harness-installer/SKILL.md:161-164` desaparece. O `cdl-exception-stale` do ADR-001 existe exatamente para isso — mas só dispara se a exceção tiver `predicate` + `proof` vivos. Exceção sem predicado não é exceção: é dívida com outro nome.
2. **Zerar contador apagando linha é falso verde.** `identity=4/3`, `baseline=38`, `refs-undetected=9` e `prohibition-cited=27` são números públicos. Apagar as linhas para que caiam a zero satisfaz o medidor e destrói a norma: a proibição some (RF-04), o agente perde a regra de escopo (R2 do PRD), o ponteiro quebrado vira silêncio (ADR-001 §3-IF10). A regra desta decisão é: **toda linha que sai de um contador entra em outra classe com dono e comando** — a contagem muda porque a classificação mudou, nunca porque o texto evaporou.

**O que este ADR não faz.** Não corrige uma linha de prosa (é o SDD), não reabre D2/D8 nem a rubrica do ADR-001, não move artefato no instalador (PRD §7 / PRD-3), não cria rule (PRD-4) nem `DESIGN.md` (PRD-5), não toca `gate.js`/config/selo, e não escreve a baseline literal — ele **congela a rubrica de expiração e o dono de cada instância**; a aplicação é o SDD.

---

## 2. Decisão — uma única: adotar a rubrica FR0..FR5 de expiração de exceções com dono por instância

**Adotar uma rubrica de 6 classes (`FR0`..`FR5`) para toda a frota restante, com (predicado mecânico → ação única → comando → dono → condição de expiração) por classe. Toda exceção declarada (D2, D8/E-1, E-3) entra em `FR0` e só sobrevive enquanto o seu predicado casar; toda dívida residual entra em `FR1`..`FR5` e é convertida, nunca apagada. Um número de contador muda somente como efeito de uma mudança de classe com dono registrado.**

É a especialização de "frota restante" das rubricas C1..C6 (PRD-1) e RC0..RC6 (ADR-004): reusa os predicados por referência e acrescenta a dimensão que faltava — **expiração** — porque D2/D8 são as únicas exceções do ciclo que o owner chamou de "permanentes" e é exatamente aí que "permanente" pode virar isenção. Nenhuma linha das rubricas anteriores é reaberta.

### 2.1 A rubrica — classe × predicado (comando) × ação × dono × expiração

| Classe | Nome | Predicado — o comando que a prova | Ação (vocabulário fechado) | Dono | Condição de expiração |
|---|---|---|---|---|---|
| **FR0** | `excecao-com-predicado-vivo` | D2: `prohibitionOf(line)` devolve ≥1 termo e a linha **não** é prescritiva (rubrica ADR-001 passo 2) ⇒ `prohibition-cited=27`; D8/E-1: `ls .agents/skills/ui-ux-pro-max/data/*.csv \| wc -l` ⇒ `14`; E-3: nome da skill tem segmento em `AXIS_IDS` ⇒ `declaredAxis` devolve `{nestjs}`/`{node}`/… | `manter-excecao` + `registrar-predicado` em `EXCEPTIONS` com `reason` + `proof` + `expires_when` | instrumento (ADR-001 §2.5/§2.3) | predicado deixa de casar ⇒ `cdl-exception-stale` **FAIL**; proibição que vire prescrição sai do contador e entra em A-2 com dono |
| **FR1** | `identidade-reatribuida` | linha em `BASELINE` com `verdict: identity` e termo em `PROJECT_TERMS` (`TaskFlow`/`Pulse`) com `proof` nela ⇒ `identity=4/3` | `reescrever-escopo` — substituir nome de projeto por escopo de papel/domínio; re-apontar `PROJECT_TERMS.proof`; remover entrada `identity` da baseline | SDD deste ADR (1 dono por linha) | `cdl-identity-term-stale` FAIL se a prova morrer sem reescrita; `identity=0/0` quando fechado |
| **FR2** | `corpo-stack-bound-em-skill-de-eixo` | nome declara eixo (E-3), mas `∃ termo` cujos eixos `⊄ declaredAxis(skill)` ⇒ `classifyLine` devolve `incondicional` (`nestjs:81` Jest∈node ⊄ `{nestjs}`; `node:86` Vitest∈{vue,react} ⊄ `{node}`) | `condicionar-corpo` (B1+B3): manter a skill em `SKILLS_COMMON` e o nome intacto, tornar o gate visível no início do corpo — "**NestJS**: Jest", "**Node**: Jest/Vitest" | SDD deste ADR | reclassifica para `condicional` ⇒ `cdl-baseline-stale` remove as 2 entradas; **nunca** `remover-skill` (D8) |
| **FR3** | `prescricao-generica-em-comum` | `declaredAxis = ∅` + termo de `STACK_VOCAB` em checklist `[ ]` sob heading normativo (ADR-001 §2.3-bis 1b/1c) ⇒ `spec-gate.md:13` Flyway∈java; `spec-gate.md:8` JWT é termo cross-stack, fora do vocabulário | `condicionar` — "Flyway **ou** Liquibase" (padrão `database.md:60`) e "modelo de autenticação do destino" para JWT; `internalizar` quando o item vira exemplo | SDD deste ADR | sai de `incondicional`; entrada da baseline removida por `cdl-baseline-stale`; item do checklist **preservado** |
| **FR4** | `residual-sem-dono` | linha em bloco `exemplo`/tabela de achados, já `exemplo`, **fora** da baseline e sem `owner` explícito ⇒ `security-review/SKILL.md:131` | `internalizar` com dono explícito — "dependency scanning (`npm audit` / OWASP Dependency-Check / equivalente do eixo)" — ou `manter-exemplo` com dono registrado | SDD deste ADR (dono implícito → explícito) | dono escrito; 0 efeito em contador (fora da baseline); não vira dívida nova |
| **FR5** | `referencia-com-dono-posterior` | path `.doc/**` em prosa viva, `test -e` falso, classificado RC3 pelo ADR-004 com dono ADR-005 ⇒ 9 linhas / 5 paths | `reapontar-ou-remover-com-dono` — cada linha recebe dono de destino (PRD-4 para backend/arquitetura, PRD-5 para frontend/design) e só então o ponteiro sai | ADR-005 (9 linhas, dono por linha) + PRD-4/PRD-5 para criação eventual | `refs-undetected=0` **com 9 donos no registro**; se sobrar ponteiro por razão documentada, o contador fica >0 com dono — nunca "0 por apagão" |

**Regra de precedência — fixa, logo determinística.** `FR0 → FR2 → FR3 → FR4 → FR1 → FR5`. A exceção é avaliada **antes** da conversão (não se condiciona o que já é exceção, nem se apaga exceção para zerar contador); as conversões de corpo vêm antes da identidade (a reescrita de escopo pode tocar a mesma linha, e a classe de corpo é a que decide o comando); `FR5` vem por último porque é a única classe cuja ação pode remover texto e, por isso, exige dono já resolvido.

**Um dono por instância.** Toda linha das tabelas de §4 carrega `path:linha → classe → ação → comando → dono`. Linha sem dono **não está classificada** e o SDD não a executa. É a mesma disciplina do ADR-004 §2, agora com a coluna de expiração — que é o que faltava para "permanente" não virar "para sempre sem medir".

### 2.2 D2 — veredito sobre as 27 proibições (FR0)

**Veredito: manter. Nenhuma proibição é removida por conveniência; toda remoção exige substituto positivo (RF-04).** O predicado que sustenta a exceção é mecânico e já medido: `prohibitionOf(line)` devolve termo proibido e a linha não é prescritiva — é o passo 2 da rubrica do ADR-001, que publica `prohibition-cited=27`. A frase de critério que o owner pediu em RF-04 vem de `harness-installer/SKILL.md:161-164`: a proibição cita tecnologia **para banir**, logo o efeito pretendido é **ausência** e não prescrição; num destino limpo o termo não existe e não há falso-positivo.

**Predicado vivo:** `prohibition-cited=27` publicado no `detail` do `V20`, calculado por termo e insensível a caixa (ADR-001 §2.3-ter-3). **Expiração:** se (a) a posição escrita em `harness-installer/SKILL.md:161-164` deixar de existir, ou (b) uma linha de proibição for reescrita como prescrição (ex.: "use X sempre"), ela sai do contador, entra em A-2 e recebe dono ou FAIL por `cdl-unconditional-unbaselined` — o contador publicado mostra a variação, não há como apagar a exceção em silêncio. Exemplos medidos da frota: `developer-engineer/AGENT.md:29` (`**Proibido Lombok.**`), `:44` (`**Proibido Axios.**`), `:98` (`NUNCA use Lombok …`), e as duas rules de frontend `:12` (`Não usar Vuetify/PrimeVue`).

### 2.3 D8 — veredito sobre catálogo e skills de stack (FR0/FR2)

**Veredito: manter o catálogo e as 6 skills em `SKILLS_COMMON`; não reabrir D8.** Duas exceções distintas, com predicados distintos:

- **E-1 (catálogo)** — `ui-ux-pro-max/**` (14 `.csv`) e `sdd-compiler/references/frontend.md:49-51`: a lista de stacks **é** o conteúdo. Predicado vivo = contagem de `.csv` + presença da enumeração de alternativas. Expiração = `cdl-exception-stale` FAIL se o prefixo deixar de existir ou o conteúdo deixar de ser catálogo.
- **E-3 (identidade por nome)** — `frontend-react-specialist`, `frontend-vue-specialist`, `java-…`, `nestjs-…`, `node-…`, `rust-architecture-specialist`: o segmento do nome casa `AXIS_IDS`, e `declaredAxis` usa esse segmento (ADR-001 §2.3 derivação 3, por D8). Predicado vivo = `declaredAxis(skill) ≠ ∅` via nome. Expiração = se o nome sair dos eixos **ou** o corpo passar a prescrever termo de outro eixo, a linha vira `incondicional` e entra em FR2 com dono.

**A distinção que este ADR congela:** E-3 cobre a **identidade** (A-1) e o **nome**, não o **corpo** (A-2). É por isso que as 2 linhas de §2.4 não são "isenção E-3" — são FR2.

### 2.4 As 2 entradas `nestjs:81` / `node:86` — o que acontece com elas (FR2)

**Veredito: `condicionar-corpo`, não `remover-skill`, não `apagar-linha`.** Ambas já têm o eixo correto pelo nome (`declaredAxis` = `{nestjs}` e `{node}`, medido por comando) — D8/E-3 está intacto. O que falha é o **corpo**: `- Unitários com Jest` (`nestjs:81`) e `- Unitários com Jest/Vitest` (`node:86`) são bullets sob heading `TESTING STRATEGY`, sem gate visível, e `Jest` pertence a `node` enquanto `Vitest` pertence a `vue`/`react`. Pela rubrica ADR-001 passo 5, `declaredAxis ⊇ eixo(termo)` falha em ambos (Jest⊄{nestjs}; Vitest⊄{node}), logo são `incondicional` — as 2 entradas de baseline `owner: ADR-005` medidas em §1.

Ação: manter as skills em `SKILLS_COMMON` (D8) e reescrever **só o corpo** no padrão B3 de `RESEARCH.md` §4 — "**NestJS**: Unitários com Jest" e "**Node**: Unitários com Jest/Vitest" — para que o gate apareça no começo da linha (PRD §11: condição implícita é pior que prosa nenhuma). Com o gate visível, `classifyLine` passa a devolver `condicional`, as 2 entradas saem da baseline por `cdl-baseline-stale` e `incondicional` cai de 34 para 32. **Se o SDD optar por não reescrever**, as 2 entram na baseline com `owner: ADR-005` e prazo — nunca "some do contador".

### 2.5 `spec-gate.md` — Flyway/JWT (FR3)

**Veredito: `condicionar`, preservando o checklist.** `spec-gate.md:13` (`- [ ] **Migrations**: Arquivos Flyway planejados com V{…}`) é checklist normativo sob heading, `declaredAxis = ∅` (é um `assert` do `sdd-compiler`, artefato comum), e `Flyway ∈ java` ⇒ `incondicional` — a 3ª entrada de baseline nomeada em §1. `spec-gate.md:8` cita `JWT` num item de autenticação; `JWT` não está em `STACK_VOCAB`, então **não** consome veredito de prescrição (não há entrada de baseline para :8) — é resíduo de vocabulário, não dívida medida; a ação é tornar o item neutro quanto ao mecanismo ("modelo de autenticação do destino") sem criar número novo.

Ação em `:13`: "Flyway **ou** Liquibase" (o padrão correto que o próprio `database.md:60` já usa e que o ADR-001 §4 cita como exemplo) — sai de `incondicional` para `catálogo`/`condicional`, a entrada da baseline é removida, e o item permanece no assert. **Proibido:** apagar o item do checklist para zerar a entrada — isso derrubaria a cobertura de migrations do portão P1→P2.

### 2.6 `security-review/SKILL.md:131` — resíduo fora da baseline (FR4)

**Veredito: `internalizar` com dono explícito.** A linha `| A06 Vulnerable Components | ✅ | npm audit + Dependency-Check clean |` está num bloco de **exemplo** de relatório, já classificada `exemplo` pela rubrica e, por isso, **fora** da baseline — não há número de contador para mudar. O defeito é outro: é resíduo do ADR-003 sem dono, e prescreve duas ferramentas concretas como se fossem as únicas. Ação: reescrever como "dependency scanning (`npm audit` / OWASP Dependency-Check / equivalente do eixo)" e registrar `owner: ADR-005` na prosa de escopo da skill. Efeito em `V20`: **nenhum contador muda**;efeito em governança: dívida sem dono passa a ter dono. É o caso de teste da regra "dono não é opcional" — uma linha fora do contador ainda precisa de classe.

### 2.7 As 9 linhas de `.doc/**` — herança do ADR-004 (FR5)

**Veredito: `reapontar-ou-remover-com-dono`, uma decisão por linha, antes de mexer no texto.** O ADR-004 as classificou RC3 e declarou "dono ADR-005 (frota restante)" em §4.3; os 5 alvos (`.doc/ARCHITECTURE.md`, `.doc/STACK.md`, `.doc/especificacao-sistema.md`, `.doc/arquitetura-backend.md`, `.doc/stacks.md`) **não existem** no disco (medido em §1). Diferente de `frontend/DESIGN.md`, nenhum PRD posterior foi nomeado dono do *conteúdo* —logo o dono é resolvido por assunto: paths de arquitetura/backend e stacks → **PRD-4** (`prd-axes-split`, que habilita o eixo backend e redefine a documentação de stack); paths de frontend/design → **PRD-5** (`prd-frontend-harness-fusion`). O ponteiro só sai quando o dono estiver escrito na linha de classificação; `refs-undetected` cai de 9 para 0 **por resolução com dono**, não por apagão (ADR-001 §3-IF10). Se o SDD decidir manter algum ponteiro porque o arquivo passa a existir no destino, o contador fica >0 com dono — honesto, não falha.

### 2.8 Oráculo — número nunca é contrato (N7)

`identity=4/3`, `baseline=38`, `incondicional=34`, `prohibition-cited=27`, `refs-undetected=9`, `V18 baseline=1`, `V19 consumer=21` são o **estado medido no HEAD desta decisão**. O que o SDD entrega é o que a linha do `V20`/`V18`/`V19` publicar no commit de implementação — inclusive se as próprias reescritas mudarem `population` (ADR-003 §11-H6). Este ADR fixa o **predicado**, a **ação**, o **dono** e a **direção** (identity→0; baseline→0; incondicional→0 nas entradas owner ADR-005; prohibition-cited→inalterado salvo substituto; refs-undetected→0 com dono; V18 e V19→inalterados), **não os dígitos**. A tabela de efeito em §7 é previsão derivada por comando; o oráculo é a linha publicada.

---

## 3. Interface congelada

Cada item é verificável por comando, da raiz do repo. Itens *(SDD)* só passam a valer após a implementação; antes dela o comando mede o **estado atual**, anotado abaixo. Nível 🟡 declarado onde a verificação depende de leitura de prosa.

1. **A rubrica está publicada neste ADR com 6 classes, predicado, ação, comando, dono e expiração por classe.** `grep -c '^| \*\*FR[0-5]\*\*' .spec/prd/prd-agnostic-artifacts/ADRs/ADR-005-frota-restante/ADR.md` ⇒ `6`; `grep -oE 'manter-excecao|reescrever-escopo|condicionar-corpo|condicionar|internalizar|reapontar-ou-remover-com-dono' … | sort -u | wc -l` ⇒ `6`; `grep -c 'expires_when\|Condição de expiração' …` ⇒ `≥1`.

2. **Toda exceção tem predicado vivo e expiração registrada no instrumento.** `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>{for(const e of m.EXCEPTIONS)console.log(e.id,!!(e.predicate&&e.reason&&e.proof))})'` ⇒ 6 linhas `true` (E-1..E-5 + a frase D2); *(SDD)* `cdl-exception-stale` continua com fixture que derruba: remover o `N/A` de `harness-config.md:13` ou um `.csv` do catálogo ⇒ FAIL. Nível 🟡 para a frase de critério D2 em `harness-installer/SKILL.md:161-164`: `sed -n '161,164p' …` ⇒posição escrita.

3. **D2 — 27 proibições mantidas, nenhuma removida sem substituto.** Antes: `node scripts/static-checks.mjs | grep V20` ⇒ `prohibition-cited=27`. *(SDD)*: contador **inalterado ou maior**, nunca menor sem `substituto-positivo` registrado por linha; `grep -rn 'Proibido Lombok\|Proibido Axios\|NUNCA use Lombok' .agents/agents/developer-engineer/AGENT.md` ⇒ `≥3` linhasvivase. 🟡 revisão assistida no SDD para o substituto.

4. **D8/E-1/E-3 — catálogo e 6 skills intactos.** `ls .agents/skills/ui-ux-pro-max/data/*.csv | wc -l` ⇒ `14`; `node --input-type=module -e 'const m=await import("./installer/install.mjs");console.log(m.SKILLS_COMMON.filter(n=>/java|nestjs|node|rust|react|vue/.test(n)).length)'` ⇒ `5` (+1 no mapa de eixo = 6); `V19` publica `skills=47` e `consumer=21` idênticos antes/depois (0 skill removida do payload).

5. **FR1 — 4 identidades reatribuídas com prova re-apontada.** Antes: `identity=4/3`. *(SDD)*: `identity=0/0`; `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.PROJECT_TERMS.filter(t=>t.owner==="ADR-005").map(t=>t.term+":"+t.proof).join(" ")))'` ⇒ provas apontam para as linhas **reescritas** (ou os termos saem do registro com `reason`); `grep -rn 'TaskFlow' .agents/agents/developer-engineer/AGENT.md .agents/agents/ux-designer/AGENT.md` ⇒ `0`.

6. **FR2 — as 2 skills de eixo condicionadas no corpo, não removidas.** Antes: `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.BASELINE.filter(x=>/nestjs-architecture|node-architecture/.test(x.file)&&x.owner==="ADR-005").length))'` ⇒ `2`. *(SDD)*: `grep -n '\*\*NestJS\*\*:\|\*\*Node\*\*:' .agents/skills/nestjs-architecture-specialist/SKILL.md .agents/skills/node-architecture-specialist/SKILL.md` ⇒ `≥2`; `V20` publica `incondicional` menor em exatamente 2 (ou as 2 seguem na baseline com `owner` e prazo — nunca silêncio).

7. **FR3 — `spec-gate.md` condicionado sem perder o checklist.** *(SDD)*: `grep -n 'Flyway\|Liquibase' .agents/skills/sdd-compiler/asserts/spec-gate.md` ⇒ `≥1` com conectivo de alternativa; `grep -n '\[ \] \*\*Migrations\*\*' …` ⇒ `≥1` (item preservado); `grep -n 'JWT' …` ⇒rede neutra, sem nome de mecanismo obrigatório; entrada `spec-gate.md:13` sai da baseline por `cdl-baseline-stale`.

8. **FR4 — resíduo `security-review:131` com dono, 0 efeito em contador.** *(SDD)*: `sed -n '131p' .agents/skills/security-review/SKILL.md` ⇒ linguagem de "dependency scanning" com alternativas; `grep -c 'ADR-005' .agents/skills/security-review/SKILL.md` ⇒ `≥1` (dono explícito); `V20` `baseline` não muda por esta linha (estava fora dela).

9. **FR5 — 9 linhas `.doc/**` com dono antes da remoção.** Antes: `grep -rPn '\`?\.doc/[\w./-]+\`?' .agents opencode.json | wc -l` ⇒ `9`. *(SDD)*: `grep -rPn '\`?\.doc/[\w./-]+\`?' .agents opencode.json | wc -l` ⇒ `0`, e `grep -c 'PRD-4\|PRD-5' .spec/prd/prd-agnostic-artifacts/ADRs/ADR-005-frota-restante/ADR.md` ⇒ `≥1` por linha na tabela de §4.1; `V20` publica `refs-undetected=0` **com** os 9 donos no registro (ou >0 com dono, se ponteiro mantido por razão documentada).

10. **Nenhuma dívida apagada para zerar contador — prova por classificação.** *(SDD)*: para cada uma das 38 entradas `owner: ADR-005` da baseline, o SDD registra `path:linha → classe FR0..FR5 → ação → comando → dono`; `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.BASELINE.filter(x=>x.owner==="ADR-005").length))'` ⇒ `0` **após** as conversões, ou `>0` com `reason`+prazo por entrada. A variação de cada contador em §7 é acompanhada da linha que mudou de classe — nunca de um `git rm` sem classificação.

11. **`V18` e `V19` inalterados, sem justificativa nova.** `node scripts/static-checks.mjs | grep -E '^PASS (V18|V19)'` ⇒ `baseline=1, non-defect=1` e `consumer=21, orphan=1, skills=47, rules=8`. Nenhum path de `rules/*.md` é tocado por ADR-005 (ADR-004 fechou os 8), nenhuma skill sai do payload (D8), nenhum mapa muda (PRD-3). 🟢.

12. **Selo intacto, escopo de escrita e ledger 1:1.** `git diff --stat harness.config.json .opencode/plugins/lib/seal.mjs gate.js opencode.json installer/` ⇒ vazio; `node -e 'console.log(require("./harness.config.json").commands.suiteFull)'` ⇒ literal inalterado; `git show --stat --name-only HEAD` ⇒ `ADR-INDEX.md` + `ADRs/ADR-005-frota-restante/ADR.md` (o commit de abertura de estado `5644d37` é anterior e não é deste batch); `node scripts/static-checks.mjs` ⇒ exit `0` com `PASS PRD-01`, `PASS ADR-01`, `PASS ADR-02`; `ADR-INDEX.md` tem **5 linhas** (4 `merged` + ADR-005 `in-progress`), no máximo 1 `in-progress`.

---

## 4. Aplicação da rubrica — instâncias medidas

Regra de leitura: **classe** vem da árvore de §2.1; **ação** é a de §2.1; **comando** reproduz o fato; **dono** é obrigatório. Nenhuma linha é "caso especial" — D2/D8/e os residuais são esta tabela.

### 4.1 As 9 linhas de `.doc/**` — herança ADR-004, classe FR5

| # | `path:linha` | Classe | Ação | Comando | Dono |
|---|---|---|---|---|---|
| C1 | `dev-planner/workflow.md:33` — `` `.doc/ARCHITECTURE.md` `` | FR5 | reapontar-ou-remover-com-dono | `grep -rPn '\.doc/ARCHITECTURE\.md' .agents \| wc -l` ⇒ `2` (→0) | **PRD-4** (arquitetura backend) |
| C2 | `dev-planner/workflow.md:101` — `` `.doc/ARCHITECTURE.md`, `.doc/STACK.md` `` | FR5 | idem | `grep -rPn '\.doc/STACK\.md' .agents \| wc -l` ⇒ `2` (→0) | **PRD-4** (stack) |
| C3 | `dev-planner/SKILL.md:209` — `| `.doc/ARCHITECTURE.md` | Arquitetura detalhada |` | FR5 | idem | linha C1 | **PRD-4** |
| C4 | `dev-planner/SKILL.md:210` — `| `.doc/STACK.md` | Stack tecnológica e versões |` | FR5 | idem | linha C2 | **PRD-4** |
| C5 | `orchestrator/AGENT.md:675` — `| `.doc/especificacao-sistema.md` | Especificação do sistema |` | FR5 | idem | `grep -rPn '\.doc/especificacao-sistema\.md' .agents \| wc -l` ⇒ `2` (→0) | **PRD-4** |
| C6 | `orchestrator/AGENT.md:676` — `| `.doc/arquitetura-backend.md` | Arquitetura backend |` | FR5 | idem | `grep -rPn '\.doc/arquitetura-backend\.md' .agents \| wc -l` ⇒ `2` (→0) | **PRD-4** |
| C7 | `workflow-rules.md:595` — `| `.doc/stacks.md` | Stacks e versões |` | FR5 | idem | `grep -rPn '\.doc/stacks\.md' .agents \| wc -l` ⇒ `1` (→0) | **PRD-4** |
| C8 | `workflow-rules.md:596` — `| `.doc/arquitetura-backend.md` | Arquitetura detalhada do sistema |` | FR5 | idem | linha C6 | **PRD-4** |
| C9 | `workflow-rules.md:597` — `| `.doc/especificacao-sistema.md` | Especificação completa do sistema |` | FR5 | idem | linha C5 | **PRD-4** |

5 paths, 9 linhas. Nenhum PRD posterior declarou dono do **conteúdo** (ao contrário de `DESIGN.md` → PRD-5), logo o destino natural é PRD-4 — o ciclo que habilita o eixo backend e redefine a documentação de stack. Se o SDD julgar que um path é frontend/design, troca o dono para PRD-5 **na linha**, nunca no silêncio. `refs-undetected=9 → 0 com dono` é o fechamento desta classe.

### 4.2 Identidade — 3 `TaskFlow` + 1 `Pulse`, classe FR1

| # | `path:linha` | Termo | Classe | Ação | Comando | Dono |
|---|---|---|---|---|---|---|
| I1 | `developer-engineer/AGENT.md:1` — `# Developer Engineer — Especialista Backend & Frontend (TaskFlow)` | TaskFlow | FR1 | reescrever-escopo → "Especialista Backend & Frontend" | `grep -n 'TaskFlow' …` ⇒ `1` (→0) | SDD ADR-005 |
| I2 | `developer-engineer/AGENT.md:25` — `## Regras Técnicas (TaskFlow)` | TaskFlow | FR1 | reescrever-escopo → "Regras Técnicas" | `grep -n 'TaskFlow' …` ⇒ `1` (→0) | SDD ADR-005 |
| I3 | `ux-designer/AGENT.md:32` — `## Design System Pulse — Padrão Obrigatório (TaskFlow)` | TaskFlow + Pulse | FR1 | reescrever-escopo → "Design System do destino (se houver)" | `grep -n 'TaskFlow' …` ⇒ `1` (→0) | SDD ADR-005 |
| I4 | `design-system-specialist/AGENT.md:42` — `### 3. Mapeamento de Tokens Pulse` | Pulse | FR1 | reescrever-escopo → "Mapeamento de Tokens do design system do destino" | `grep -n 'Pulse' …` ⇒ `≥1` (→0) | SDD ADR-005 |

**Nota de escopo:** o pedido nomeia "3 linhas `TaskFlow`" (I1–I3); a 4ª (I4) é o termo `Pulse`, que `PROJECT_TERMS` também marca `owner: ADR-005` e cuja prova está re-apontada para essa linha. As duas juntas são as **4 entradas `identity`** medidas em §1 — tratá-las como 3 deixaria 1 dívida sem dono.

### 4.3 Corpo stack-bound — 2 skills de eixo, classe FR2

| # | `path:linha` | Conteúdo | Classe | Ação | Comando | Dono |
|---|---|---|---|---|---|---|
| S1 | `nestjs-architecture-specialist/SKILL.md:81` | `- Unitários com Jest` | FR2 | condicionar-corpo → "**NestJS**: Unitários com Jest" | `declaredAxis` ⇒ `{nestjs}`; `Jest ∈ node ⊄ {nestjs}`; baseline entry `4154b9c4…` | SDD ADR-005 |
| S2 | `node-architecture-specialist/SKILL.md:86` | `- Unitários com Jest/Vitest` | FR2 | condicionar-corpo → "**Node**: Unitários com Jest/Vitest" | `declaredAxis` ⇒ `{node}`; `Vitest ∈ {vue,react} ⊄ {node}`; baseline entry `95cfcc24…` | SDD ADR-005 |

`E-3` permanece intacto: o nome declara o eixo e as skills **não saem** de `SKILLS_COMMON` (`V19 consumer=21` inalterado). O que muda é só o corpo, para que a condição apareça no começo da linha.

### 4.4 Resíduos de ADR-003 — classes FR3/FR4

| # | `path:linha` | Conteúdo | Classe | Ação | Comando | Dono |
|---|---|---|---|---|---|---|
| G1 | `sdd-compiler/asserts/spec-gate.md:13` | `- [ ] **Migrations**: Arquivos Flyway planejados com V{YYYYMMDD}{NNN}` | FR3 | condicionar → "Flyway **ou** Liquibase", item preservado | `sed -n '13p' …`; baseline entry `290d91f4…` | SDD ADR-005 |
| G2 | `sdd-compiler/asserts/spec-gate.md:8` | `- [ ] **Segurança/IAM**: Modelo de autenticação (JWT) e @HasPermission definidos` | FR3 | condicionar vocabulário → "modelo de autenticação do destino" (0 entrada de baseline) | `sed -n '8p' …` | SDD ADR-005 |
| G3 | `security-review/SKILL.md:131` | `| A06 Vulnerable Components | ✅ | npm audit + Dependency-Check clean |` | FR4 | internalizar + dono explícito ("dependency scanning … / equivalente do eixo") | `sed -n '131p' …` | SDD ADR-005 |

### 4.5 Proibições — 27 linhas, classe FR0 (amostra nomeada; o número é do oráculo)

| # | `path:linha` (amostra) | Predicado | Classe | Ação | Comando | Dono |
|---|---|---|---|---|---|---|
| P1 | `developer-engineer/AGENT.md:29` — `**Proibido Lombok.**` | `prohibitionOf` ⇒ Lombok; não prescritiva | FR0 | manter-excecao + registrar-predicado | `V20 prohibition-cited=27` | instrumento (ADR-001) |
| P2 | `developer-engineer/AGENT.md:44` — `**Proibido Axios.**` | `prohibitionOf` ⇒ Axios | FR0 | idem | idem | instrumento |
| P3 | `developer-engineer/AGENT.md:98` — `NUNCA use Lombok (…)` | negação insensível a caixa antes do termo | FR0 | idem | idem | instrumento |
| P4 | `frontend-coding-standards.md:12` / `frontend-react-coding-standards.md:12` — `Não usar Vuetify/PrimeVue` | `prohibitionOf` ⇒ Vuetify, PrimeVue | FR0 | idem | idem | instrumento |
| P5 | as outras 22 linhas | mesmo predicado, contadas por termo | FR0 | idem | `node scripts/static-checks.mjs \| grep V20` ⇒ `27` | instrumento |

**Nenhuma destas 27 sai do contador por conveniência.** Se uma sair, é porque o predicado mudou (FR0 expira) e a linha entra em A-2 com dono — nunca por `git rm`.

---

## 5. Consequências

- **C1 — "permanente" passa a ter data de validade mecânica.** D2/D8/E-1/E-3 continuam decididos pelo owner, mas deixam de ser adjetivo: cada uma tem `predicate` + `proof` + `expires_when` e o `cdl-exception-stale` do `V20` publica a quebra. O risco central do pedido — exceção declarada tratada como isenção permanente — vira FAIL de suíte no momento em que o predicado morre.
- **C2 — dívida não desaparece; muda de classe com dono.** As 38 entradas `owner: ADR-005` e as 9 linhas `.doc/**` são convertidas, não apagadas. O efeito nos contadores é derivado da classificação; um número que cai sem uma linha correspondente na tabela de §4 é drift a investigar, não melhoria a comemorar.
- **C3 — E-3 cobre nome/identidade, não corpo.** A distinção congela o que o ADR-001 já implementava na `declaredAxis` (derivação 3): as 2 skills de stack mantêm o nome e o payload, e o corpo é condicionado. Não há contradição com D8 — há especialização.
- **C4 — nenhum número de `V19` muda.** 0 skill removida, 0 mapa alterado. `consumer=21`, `skills=47`, `orphan=1` ficam idênticos — é a prova de que a decisão não invadiu o PRD-3.
- **C5 — `V18` fica idêntico.** Os 8 paths de rule foram fechados no ADR-004; ADR-005 não toca `rules/*.md` por path de referência. `baseline=1, non-defect=1` permanece — é a prova de que a fronteira 004/005 foi respeitada.
- **C6 — RF-04 ganha mecanismo.** A frase de critério de `harness-installer/SKILL.md:161-164` vira predicado publicado (`prohibition-cited`), com expiração: sem a posição escrita ou com proibição convertida em prescrição, o contador muda e a entrada A-2 aparece com dono. Nenhuma proibição perde efeito sem substituto positivo.
- **C7 — 🟠 escape declarado (os mesmos dos precedentes).** (a) `scripts/static-checks.mjs` não é `protectedPaths`: remover o `record("V20", …)` desliga o oráculo sem trailer (ADR-001-C7). (b) O destino herda o módulo CDL mas não o adapter (PRD-3). (c) A expiração de D2 depende de 🟡 leitura da posição em `harness-installer/SKILL.md:161-164` — o contador mede o efeito, não a frase; o item de interface 2 torna a checagem explícita, mas quem editar o adapter pode removê-la. (d) Os donos PRD-4/PRD-5 das 9 linhas `.doc/**` são decisão deste ciclo; a **criação** é dos donos e não tem mecanismo aqui — 🟡 processo, declarado.
- **C8 — custo de manutenção cai a zero por linha fechada.** Enquanto a dívida existe: 1 linha de baseline/EXCEPTIONS com dono. Depois da conversão: 0 por `condicional`/`exemplo`/`catálogo`, e 1 remoção com `reason` quando a exceção expira. É a fricção desejada — o preço de não decidir é suíte vermelha, o preço de decidir é uma linha.

---

## 6. Alternativas descartadas

| Alternativa | Custo medido neste repo | Por que foi descartada |
|---|---|---|
| **"Permanente" literal, sem predicado nem expiração** | 0 linha de instrumento | É exatamente o defeito do pedido: exceção vira isenção, ninguém percebe quando o catálogo deixa de ser catálogo ou quando a posição D2 desaparece. `cdl-exception-stale` só dispara com predicado vivo |
| **Apagar as 27 proibições para baixar `prohibition-cited` a 0** | 27 linhas de prosa + perda de proteção | RF-04 proíbe: "proibição é controle, não estilo" (PRD §13). Reduz cobertura de segurança de código e contradiz D2, que as declara corretas |
| **Remover as 2 skills de stack do `SKILLS_COMMON`** (B2) | 6 entradas de mapa + revalidação de 12 presets + risco de o destino Java perder a skill | Owner fechou D8 = exceção permanente; mover é trabalho de mapa do PRD-3 e `RESEARCH.md` §4-B2 mede o risco. A correção certa é o corpo (B3), não o payload |
| **Reescrever as 6 skills inteiras (~1.000 l.) para genérico** | 6 `SKILL.md`, risco R2 ("agnóstico vira vazio") | `RESEARCH.md` §4-B3 resolve A-2 com 2 linhas condicionadas nas skills de eixo; reescrever o resto destruiria a especificidade que D8 protege |
| **Apagar as 9 linhas `.doc/**` para zerar `refs-undetected`** | 9 linhas, 5 ponteiros sem dono | ADR-001 §3-IF10: contador com dono, nunca silêncio. Sem dono PRD-4/PRD-5, o ponteiro volta na próxima auditoria e o contador mente |
| **Apagar a linha de `security-review:131`** (fora da baseline) | 1 linha, 0 efeito em contador | O defeito é dono implícito + ferramenta única, não presença. Apagar não muda número nenhum e deixa o resíduo sem classificação — a prova da regra "sem dono não está classificado" |
| **Criar as 5 rules `.doc/**` agora** | 5 artefatos novos no payload comum | PRD §7 não autoriza artefato novo neste ciclo; os paths são documentação de destino, dono PRD-4/PRD-5, não conteúdo do harness |
| **Abrir `gate.js` para deny de nova exceção** | 1 `DenyError` novo + trailer + risco de gate órfão | PRD §7: `gate.js` byte-idêntico. O CDL é **medição**, não negação (`gate-contract.md`, DOC-01); a expiração é FAIL de check selado, não runtime deny |

---

## 7. Critérios de verificação

**Re-derivação do contexto (rodar antes do SDD; tem de bater com §1):**

```sh
# oráculo — não fixar número como contrato (ADR-001 §10-N7)
node scripts/static-checks.mjs | grep -E '^(PASS|FAIL) (V18|V19|V20|PRD-01|ADR-0)'

# as 38 entradas owner ADR-005 e as 4 identidades
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>{const e=m.BASELINE.filter(x=>x.owner==="ADR-005");console.log(e.length, e.filter(x=>x.verdict==="identity").length)})'   # 38 4

# as 9 linhas .doc/** e os 5 alvos ausentes
grep -rPn '\`?\.doc/[\w./-]+\`?' .agents opencode.json | wc -l    # 9
for p in .doc/ARCHITECTURE.md .doc/STACK.md .doc/especificacao-sistema.md \
         .doc/arquitetura-backend.md .doc/stacks.md; do test -e "$p" || echo "MISSING $p"; done   # 5 MISSING

# FR2 — eixo pelo nome correto, corpo fora do eixo
node --input-type=module -e '
import fs from "node:fs";
const m = await import("./.opencode/plugins/lib/cdl/checks.mjs");
const inst = await import("./installer/install.mjs");
const lock = JSON.parse(fs.readFileSync(".agents/skills/.vendor-lock.json","utf8")).skills;
const ex = {AXIS_IDS:inst.AXIS_IDS, STACKS_FOR_EXCEPTIONS:inst.STACKS_FOR_EXCEPTIONS,
  SKILLS_BY_AXIS:inst.SKILLS_BY_AXIS, RULES_BY_AXIS:inst.RULES_BY_AXIS};
for (const p of [".agents/skills/nestjs-architecture-specialist/SKILL.md",
                 ".agents/skills/node-architecture-specialist/SKILL.md",
                 ".agents/skills/sdd-compiler/asserts/spec-gate.md"])
  console.log(p, [...m.declaredAxis(p, ex, lock)]);
'   # [nestjs] / [node] / []

# FR0 — posição D2 escrita e amostra de proibições
sed -n '161,164p' .agents/skills/harness-installer/SKILL.md
grep -rn 'Proibido Lombok\|Proibido Axios\|NUNCA use Lombok' .agents/agents/developer-engineer/AGENT.md
```

**Efeito nos contadores — antes → depois (previsão derivada por comando; oráculo = linha publicada):**

| Check | Antes (`main @ e297d82`) | Depois (SDD ADR-005) | Derivação |
|---|---|---|---|
| `V18` | `baseline=1, non-defect=1` | `1, 1` (inalterado) | nenhum path `rules/*.md` tocado (ADR-004 fechou os 8); item 11 |
| `V19` | `skills=47, consumer=21, orphan=1, rules=8` | idêntico | 0 skill removida (D8), 0 mapa alterado (PRD-3); item 4 |
| `V20 identity` | `4/3` | `0/0` | 4 linhas FR1 reescritas (3 TaskFlow + 1 Pulse); item 5 |
| `V20 prescriptions` | `138 (53/34/17/34)` | total ~inalterado; `incondicional 34→32 (FR2) →31 (FR3)`; `condicional/catálogo +3` | 3 linhas mudam de veredito, nenhuma é apagada; itens 6–7 |
| `V20 baseline` | `38 (34 incond / 4 identity)` | `31 (31/0)` com só as 3 nomeadas convertidas → `0` com a rubrica FR1..FR5 aplicada às 38 | 4 identity + 3 incondicionais saem por `cdl-baseline-stale`; item 10 |
| `V20 prohibition-cited` | `27` | `27` (inalterado) | D2 predicado vivo; nenhuma proibição removida; item 3 |
| `V20 refs-undetected` | `9 (owner ADR-004)` | `0` com 9 donos (ou >0 com dono, se ponteiro mantido) | FR5 resolve as 9 com PRD-4/PRD-5; item 9 |
| `V20 population` | `223/30372` | derivado (rewrites são linha-a-linha; ≈ igual) | ADR-003 §11-H6: a linha do `V20` é o oráculo |
| `V20 structural-debt` | `0` | `0` | `license:` de `security-review:4` já corrigida no ADR-003 |

**Aceite do SDD deste ADR** (cada bloco mapeia para um item de §3):

```sh
# IF-2/3/4: exceções, D2, D8
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.EXCEPTIONS.every(e=>e.predicate&&e.reason&&e.proof)))'  # true
node scripts/static-checks.mjs | grep V20        # prohibition-cited=27, population=…
node scripts/static-checks.mjs | grep V19        # consumer=21, skills=47 — idênticos

# IF-5/6/7/8: FR1..FR4
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.BASELINE.filter(x=>x.owner==="ADR-005").length))'  # 0 (ou >0 com reason)
grep -rn 'TaskFlow' .agents/agents/developer-engineer/AGENT.md .agents/agents/ux-designer/AGENT.md  # 0
grep -n 'Flyway\|Liquibase' .agents/skills/sdd-compiler/asserts/spec-gate.md                          # ≥1
sed -n '131p' .agents/skills/security-review/SKILL.md                                              # dono explícito

# IF-9/10/11: FR5, sem apagão, V18/V19
grep -rPn '\`?\.doc/[\w./-]+\`?' .agents opencode.json | wc -l   # 0 com 9 donos
node scripts/static-checks.mjs | grep -E '^PASS (V18|V19)'       # 1/1 e consumer=21

# IF-12: selo, escopo, ledger 5 linhas
git diff --stat harness.config.json .opencode/plugins/lib/seal.mjs gate.js opencode.json installer/  # vazio
git show --stat --name-only HEAD                       # ADR-INDEX.md + ADR-005/ADR.md
node scripts/static-checks.mjs; echo $?                # 0
```

**Fora do aceite (declarado):** reduzir os números por remoção sem classificação (é o defeito que este ADR proíbe), mover skill no instalador (PRD-3), criar rules/documentação (PRD-4/PRD-5), reabrir D2/D8 ou a rubrica do ADR-001, e qualquer alteração em `gate.js`.

---

## 8. Notas de correção (divergências medidas entre pedido/PRD/índice e disco)

- **N1 — `depende-de` ampliado para 3 ADRs.** O parágrafo "Dependências do fatiamento" do `ADR-INDEX.md` (linhas 38-39) afirma que ADR-005 declararia `depends_on = ADR-001` sozinho. A task desta entrega exige **ADR-001, ADR-003, ADR-004**. A razão é estrutural: sem o ADR-003 não há regra de re-medir (§11-H6) nem o resultado de D8 que este ADR só aplica; sem o ADR-004 não há dono para as 9 linhas `.doc/**`. O índice é atualizado no mesmo commit — divergência registrada, não escondida.
- **N2 — "3 linhas `TaskFlow`" × 4 entradas `identity`.** O pedido nomeia `developer-engineer:1,25` e `ux-designer:32`. O módulo mede **4** entradas `identity` com `owner: ADR-005`: a 4ª é `design-system-specialist/AGENT.md:42` (`Pulse`), com `PROJECT_TERMS` re-apontado para ela. As três do pedido são as `TaskFlow`; a 4ª é o outro termo de projeto com o mesmo dono. Classificar só 3 deixaria 1 dívida sem dono — contra a regra "sem dono, não está classificada".
- **N3 — `refs-undetected` ainda diz `owner ADR-004` no `detail`.** O `V20` da `main` publica `refs-undetected=9 (owner ADR-004)`, mas as 9 linhas são de `.doc/**` e o ADR-004 as declarou "dono ADR-005". A etiqueta do contador está desatualizada em relação ao dono real; o SDD deste ADR atualiza a publicação para `owner ADR-005 (resolvido)` quando as linhas forem classificadas — ou mantém `owner ADR-004` se o ponteiro sobreviver por razão documentada. Número e etiqueta são oráculo, não este parágrafo.
- **N4 — `spec-gate.md:8` (JWT) não tem entrada de baseline.** `JWT` não pertence a `STACK_VOCAB`; a rubrica não o conta como prescrição de stack. A ação FR3 em `:8` é de **vocabulário** (tornar o item neutro), com 0 efeito em contador — registrar para que o SDD não invente uma 4ª entrada de baseline a partir dela. A entrada medida é `:13` (Flyway).
- **N5 — números do ADR-004 §1 ≠ números da `main` atual.** Aquele ADR mediu `population=223/30385`, `refs-undetected=20` e `V19 consumer=21` no HEAD `fe42912`; a `main @ e297d82` publica `population=223/30372` e `refs-undetected=9` (as 11 linhas de `DESIGN.md` saíram no SDD do ADR-004). A diferença é o payload mudando, não divergência de régua (ADR-003 §11-H6). Re-medido em §1, não reaproveitado.
- **N6 — `prohibition-cited=27` (hoje) × 30/39 em ADRs anteriores.** O ADR-001 §1 mediu 30; a rodada 3 do instrumento (§2.3-ter) mediu 39; a `main` pós-ADR-003 publica 27, porque `spec-review` saiu do payload e levou parte das proibições. Oráculo = linha do `V20`; o número 27 é o deste HEAD, não contrato.

---

## 9. Riscos antes do G2 (o que o owner precisa saber)

| # | Risco | Evidência | Mitigação / por que não bloqueia |
|---|---|---|---|
| **G2-A** | Owner ler "exceção permanente" como "isenção sem medir" e cobrar 0 linha de predicado | D2/D8 em `PRD.md:328,334` | §2.1 coluna **expiração** + item de interface 2: `cdl-exception-stale` FAIL quando o predicado morre. "Permanente" = "enquanto o predicado casar", não "para sempre sem condição" |
| **G2-B** | SDD "fechar" `identity=4/3` apagando as 4 linhas — perde o papel e o design system | 4 entradas `identity` (N2) | FR1 = `reescrever-escopo`, não `remover`; item 5 exige `PROJECT_TERMS.proof` re-apontado e `grep TaskFlow ⇒ 0` **com** a norma preservada |
| **G2-C** | SDD tratar E-3 como isenção do corpo e deixar `nestjs:81`/`node:86` fora da baseline sem corrigir | 2 entradas `owner: ADR-005` medidas | §2.4 explicita: E-3 cobre nome/identidade, não corpo. FR2 condiciona o corpo; se não condicionar, as 2 ficam na baseline com dono e prazo — nunca silêncio |
| **G2-D** | SDD zerar `refs-undetected` removendo as 9 de `.doc/**` sem dono | ADR-004 §4.3 asssinalou ADR-005 | FR5 exige dono por linha **antes** da remoção; item 9 prova os donos PRD-4/PRD-5 na tabela de §4.1. Contador sem dono é dívida escondida |
| **G2-E** | SDD apagar a proibição `security-review:131` por estar fora da baseline | linha fora da baseline, 0 efeito em contador | FR4: dono implícito → explícito; é o caso de teste da regra "sem dono não está classificada". Apagar não melhora número nenhum |
| **G2-F** | Proibição convertida em prescrição sem `substituto-positivo` (RF-04) | PRD §13; `harness-installer:161-164` | FR0 expira e a linha entra em A-2 com dono; item 3 exige `prohibition-cited` inalterado ou maior, com substituto registrado por linha |
| **G2-G** | `V19 consumer` mudar porque alguém " aproveita" para mover skill (D8) | `consumer=21` medido | Item 4 trava `skills=47`/`consumer=21` idênticos; mapa é PRD-3, D8 é decisão do owner, não deste ADR |
| **G2-H** | Este ADR não implementa nada — risco de "decisão sem consequência" se o SDD não vier | Escopo = 2 arquivos | É o modelo do fatiamento aprovado (ADR-001..004 nasceram iguais); os 12 itens de interface são contrato do SDD, com comando por item |
| **G2-I** | `baseline=0` é frágil: qualquer órfã nova reprova sem supressão | H1/H2; `protectedPaths` | Desejado — é o que impede a 39ª linha de nascer. Custo de processo (trailer `Harness-Gate-Change`) aceito, igual aos ADRs 002–004 |

---

## 10. O que fica para o SDD deste ADR

Nesta ordem (a ordem importa: a exceção é avaliada antes da conversão, e o dono antes da remoção):

1. **FR0** — registrar `predicate`/`reason`/`proof`/`expires_when` para D2, E-1 e E-3; confirmar `prohibition-cited=27` e a posição em `harness-installer/SKILL.md:161-164`. Nenhuma proibição removida.
2. **FR2** — condicionar o corpo de `nestjs:81` e `node:86`, mantendo skills em `SKILLS_COMMON`; remover as 2 entradas da baseline por `cdl-baseline-stale` (ou mantê-las com prazo).
3. **FR3/FR4** — condicionar `spec-gate.md:13` (e o vocabulário de `:8`) preservando o checklist; internalizar `security-review:131` com dono explícito.
4. **FR1** — reescrever as 4 identidades (3 `TaskFlow` + 1 `Pulse`), re-apontar `PROJECT_TERMS.proof`, remover as 4 entradas `identity`.
5. **FR5** — atribuir dono PRD-4/PRD-5 às 9 linhas `.doc/**` e só então remover ou reapontar cada ponteiro; atualizar a etiqueta `owner` de `refs-undetected`.
6. **Verificar** os 12 itens de interface, rodar `commands.suiteFull` + `node scripts/sdd-checks.mjs` e transcrever a linha do `V18`/`V19`/`V20` no `VERIFY.md`. Nenhuma linha sai de contador sem entrada correspondente na tabela de §4 — é a prova de que dívida não foi apagada para zerar número.

**Fora do SDD (declarado):** mover skills no instalador (PRD-3), criar rules/`.doc/**`/`DESIGN.md` (PRD-4/PRD-5), reabrir D2/D8 ou a rubrica do ADR-001, e qualquer alteração em `gate.js`, `harness.config.json` ou selo.

## 13. Correções do review final (APPROVED, 0 críticos)

- **N4 — comando do item 6 tinha `^` demais.** O texto real começa com `- **Node**:`; o `^` antes de `**` fazia o `grep` devolver 0. Prova válida permanece: `declaredAxis` = `{nestjs}`/`{node}`, `classifyLine` ⇒ `condicional`, `incondicional=0`, `consumer=21`.
- **N5 — fixture E-1 do item 2 descrita errada.** `cdl-exception-stale` dispara quando o **diretório do catálogo** deixa de existir, não quando um `.csv` é removido. A mutação do review provou a expiração por E-2 e E-6.
- **N6 — etiqueta `refs-undetected=0 (owner ADR-004)` permanece.** Vem do motor (intocável); o dono real das 9 linhas está em §4.1 e no rastro por linha. Declarado no VERIFY como dívida documental, não como falha.
- **N7 — `prescriptions 138→137`.** Uma linha saiu do registro de prescrição quando virou `exemplo`/`catálogo`; as 38 entradas antigas da baseline mudaram de classe com sucessor rastreável (37 na mesma linha, 1 reescrita). Nenhuma linha foi apagada sem classificação.
- **N8 — 11 ocorrências de `Pulse` em corpos de `template-*`/`ui-ux-pro-max`.** Não são posições identitárias (heading/`description:`/`license:`), nunca contadas pelo `V20`; dono **PRD-5**, fora deste ADR.

- **N9 — A06 migrou 132→131.** Ao mover o comentário FR4 para fora da tabela GFM (correção do review), a linha A06 passou a 131; `sed -n '131p' .agents/skills/security-review/SKILL.md` agora mostra a reescrita com dono ADR-005. As 8 referências `:132` foram atualizadas.

- **N10 — population re-medido 223/30373 após o fix de governança.** O comentário FR4 saiu de dentro da tabela GFM (correção do review), reduzindo `security-review/SKILL.md` de 217 para 216 linhas; o pino em `cdl.spec.mjs:803,805` foi re-medido no mesmo commit. O QA encontrou exatamente este defeito (539/540) — número medido **antes** de uma mudança própria posterior. É o mesmo anti-pattern que o `V20` existe para caçar.
