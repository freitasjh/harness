# ADR-001 — Critério do Destino Limpo (CDL): rubrica de 4 vereditos por linha, população derivada dos exports do instalador e vocabulário derivado dos eixos, medidos por módulo puro no runner selado

- **prd-id**: `prd-agnostic-artifacts` — `.spec/prd/prd-agnostic-artifacts/PRD.md`
- **order**: 1 de 5 (`.spec/prd/prd-agnostic-artifacts/ADR-INDEX.md`)
- **status**: `in-progress`
- **branch**: `adr/prd-agnostic-artifacts/01-criterio-cdl-e-instrumento` (de `main` @ `19b2edf`, HEAD `467f3ef`)
- **depende-de**: — (nenhum ADR). Depende do **PRD-2 aprovado no G1** em 2026-11-11 (`PRD.md` §16) e das duas decisões do owner que este ADR implementa: **D7** (o critério mede o **repo inteiro menos vendor**) e **D2** (proibição citando tecnologia **não** é acoplamento — A-2 mede **prescrição**). **Precedentes usados, não dependências**: `ADR-004` e `ADR-005` do PRD-1 (forma do mecanismo: módulo puro em `.opencode/plugins/lib/**` + adapter em `scripts/static-checks.mjs`, baseline literal em `protectedPaths`, zero comando novo). Se qualquer um deles fosse revertido, a decisão abaixo continuaria a mesma — só os números de §4 mudariam, e eles são re-deriváveis por comando.
- **data**: 2026-11-11
- **dono da decisão**: owner do harness — portão **G1**. **D7**: "critério mede o repo inteiro menos vendor (`__tests__/` e `ui-ux-pro-max/data/**` ficam de fora pela exceção E-4/E-1)". **D2**: "proibição não é acoplamento (exceção permanente): banir tecnologia por nome é permitido em qualquer rule, e A-2 mede **prescrição**, não proibição".
- **rota**: refactor de governança com mecanismo (sem comportamento observável de produto ⇒ não gera PRD novo; `.agents/rules/prd-adr-pipeline.md` §3)
- **insumo de pesquisa**: `RESEARCH.md` §3 (tema A — condição inline × perfil de eixo), §5 (tema C — vale/textlint/lychee × módulo próprio, C4 escolhido), §8 (recomendação por ADR) e §9 (**R3** — a população "por eixo" tem 2 leituras hoje). `PRD.md` §2 (A-1/A-2/A-3), §3.6 (exceções E-1..E-4), §3.7 (M1–M9), §5 (M-1..M-8), §9 (RF-01, RF-09).
- **escopo de escrita desta entrega**: `.spec/prd/prd-agnostic-artifacts/**` (`ADR.md` + o parágrafo de estado do `ADR-INDEX.md`). **Nenhum** arquivo de `.agents/**`, `installer/**`, `opencode.json`, `harness.config.json`, `scripts/**` ou `.opencode/plugins/**` foi tocado — o módulo, o adapter, a spec e a baseline são o SDD deste ADR.
- **escopo não decidido aqui**: qual prosa de cada arquivo é corrigida e como (ADR-002 a ADR-005); o destino de `spec-review` (ADR-003); os vereditos dos 8 paths e de `frontend/DESIGN.md` (ADR-004); o destino das proibições e do catálogo (ADR-005).

## 1. Contexto

O `PRD.md` §3.6 fixa o CDL em três predicados — A-1 identidade, A-2 prescrição, A-3 referência — e diz, literalmente, que "nada depende de julgamento no momento da medição". Essa frase ainda não tem mecanismo: nenhum dos três predicados tem instrumento, e o único check que se aproxima do assunto (`V3`, `scripts/static-checks.mjs:317`) casa **dois literais fixos** (`/docker-compose-postgresql|-pl application/`) e está `PASS 0` hoje — verde que não mede nada, exatamente o defeito que o PRD §1-3 nomeia.

| Fato medido (2026-11-11, HEAD `467f3ef`) | Valor | Comando / fonte |
|---|---|---|
| População `.md` sob **D7** (repo inteiro menos as 3 exclusões de §2.1) | **228 arquivos / 31.661 linhas** | `git ls-files '*.md' \| grep -vE '^\.spec/' \| grep -vE '(^\|/)__tests__/' \| grep -vE '^\.agents/skills/ui-ux-pro-max/data/' \| wc -l` ⇒ `228`; mesmo pipe + `xargs wc -l \| tail -1` ⇒ `31661 total` |
| Payload do instalador em `.md` (derivado dos exports + roster + lock) | **219 arquivos, 0 fora da população** | §3-IF3 |
| Universo se `.spec/**` **não** fosse excluído | 382 arquivos / 52.142 linhas | `git ls-files '*.md' \| wc -l` ⇒ `382`; `git ls-files '*.md' \| xargs wc -l \| tail -1` ⇒ `52142 total` |
| Arquivos da população com ≥1 termo do vocabulário de §2.2 | **139 / 25.622 linhas** | `node` sobre a população (reproduzido no SDD como `counters`) |
| **A-1** (posição identitária com termo de projeto) | **12 arquivos / 15 linhas** | §3-IF11 |
| **A-2** (linha prescritiva com termo, por veredito) | **91 prescrições**: `condicional` 43 · `exemplo` 8 · `catálogo` 8 · **`incondicional` 32** (em **11 arquivos**) | §2.3 + §4.2 |
| Proibições citando tecnologia (fora de A-2 por **D2**) | **30 linhas** | `node scripts/static-checks.mjs` passará a publicar `prohibition-cited=30` (IF9) |
| **A-3** — paths de `rules/*.md` citados e ausentes | **13**, `V18` com `baseline=7` + `non-defect=1` | `node scripts/static-checks.mjs \| grep V18` |
| `frontend/DESIGN.md` citado em agentes vivos | **11 citações / 3 agentes** | `grep -rn "DESIGN\.md" .agents/agents \| wc -l` ⇒ `11` |
| `V3` (o único check que hoje toca o assunto) | casa **2 literais** | `sed -n '317p' scripts/static-checks.mjs` |

**O defeito, dito sem retórica.** Três coisas, e a terceira é a que mata:

1. **O critério é um adjetivo com três predicados e nenhum instrumento.** "Agnóstico" só se torna verificável quando cada linha de cada artefato recebe um veredito **por regra**, e a regra é a mesma para todos. Sem isso, cada arquivo dos 43 vira uma decisão avulsa no review — o defeito que o `ADR-005` do PRD-1 já pagou para eliminar (lá: 6 classes; aqui: 4 vereditos).
2. **A população tem duas leituras vivas.** A prosa do PRD cita `SKILLS_BY_AXIS` (2), e a suíte imprime `V19 … skills=48 (… axis=0), rules=8 (… axis=1)`. Se a lista de termos for derivada da leitura errada, ela **nunca falha**: `axis=0` faria o instrumento concluir que não existe skill de eixo, e a derivação por eixo viraria no-op silencioso (`RESEARCH.md` §9-R3).
3. **Toda lista escrita à mão neste repo já nasceu errada.** O PRD §1 mediu 112 arquivos de payload e a re-derivação por export dá **219 `.md`** (§8-N1); o PRD §3.6 mede A-1 = 11 e a medição por comando dá **12** (§8-N2); as "6 skills de stack em `SKILLS_COMMON`" são **5 + 1 só no mapa de exclusão** (§8-N4). Um critério cuja população e cujo vocabulário são digitados **já falhou três vezes antes de existir**.

**O que este ADR não faz.** Não corrige uma linha de prosa (é ADR-002..005), não move artefato no instalador (PRD §7), não toca `gate.js` (o CDL é medição, não `DenyError`), não decide o destino de `spec-review`/`DESIGN.md`/paths, e não escreve a baseline literal — ele **congela a régua e o instrumento**; a lista literal é produzida no SDD e só pode encolher.

## 2. Decisão

**O CDL é medido por uma rubrica de 4 vereditos por linha — `condicional` | `exemplo` | `catálogo` | `incondicional` — aplicada a uma população derivada por comando (D7), com vocabulário de termos cujas **chaves** derivam dos eixos do instalador e cuja **cobertura é verificada** (chave sem entrada = FAIL), e protegida por uma baseline literal que só encolhe.** A rubrica é a decisão; os 32 `incondicional` de hoje são **aplicação** dela, com dono por ADR, não 32 decisões avulsas.

Cinco consequências mecânicas, cada uma com predicado e comando.

### 2.1 A população — derivada por `git ls-files`, com **três** exclusões nomeadas

A população é o conjunto de linhas `.md` que o critério examina. Não é `ls` no repo, nem a lista do PRD, nem "o que o instalador propaga": é uma **função** com três exclusões declaradas, cada uma com razão e com prova.

| # | Exclusão | Razão | Prova (comando) |
|---|---|---|---|
| X1 | `^\.spec/` | **Registro datado**, não artefato: `.spec/**` é a memória de decisão (PRD/RESEARCH/ADR/SPEC). Incluí-lo faria o instrumento medir **a si mesmo** e o próprio ADR seria a primeira linha vermelha. Mesma regra de corpus do `ADR-005` §2.1-C5 (C5 `dated-record`), agora com predicado de **prefixo** e não de data — data nunca promove nem rebaixa | `git ls-files '*.md' \| grep -cE '^\.spec/'` ⇒ `154` |
| X2 | `(^\|/)__tests__/` | **Dado de teste/fixture** (E-4 de `PRD.md` §3.6). É o recorte que **D7** fixou: só `__tests__/`, não `scripts/` nem `harness/` | `git ls-files '*/__tests__/*.md' \| wc -l` ⇒ `0` (vazio hoje; a exclusão existe para o dia em que não for) |
| X3 | `^\.agents/skills/ui-ux-pro-max/data/` | **Catálogo multi-stack** (E-1): a lista de stacks é o conteúdo (`data/*.csv`, 14 arquivos) | `ls .agents/skills/ui-ux-pro-max/data/*.csv \| wc -l` ⇒ `14` |

**Unidade de medida = linha `.md`.** `.csv`, `.mjs` e `.json` não são instrução lida pelo agente do destino e ficam fora **por forma**, não por escolha: `git ls-files '*.md'` é o filtro. Consequência declarada: `scripts/` e `harness/` continuam no universo **se** algum `.md` aparecer lá (hoje: 0), porque D7 removeu essa exclusão do E-4 original do PRD (§8-N3).

**Números de hoje:** 228 arquivos / 31.661 linhas. O payload do instalador em `.md` (219) é **subconjunto** da população — a checagem de contenção é item de interface (IF3) e o modo de falha `cdl-population-payload-gap` existe para que um artefato novo em `RULES_COMMON`/`SKILLS_COMMON` que não caia na população **reprove**, em vez de sair da régua por acidente.

**Consequência auto-aplicada:** este `ADR.md` cita `TaskFlow`, `Spring`, `JUnit`, `mvn` e paths ausentes, e **não** é violação — está em `.spec/prd/**` (X1). É o mesmo estatuto do `ADR-005` §2.1 e do item 7 da interface dele.

### 2.2 O vocabulário — **chaves derivadas**, termos curados, cobertura que falha

O PRD §3.4 lista 21 termos à mão. Isso é o defeito `FU-64` ("contar antes de filtrar") com outro nome: termo novo (`Go`, `Svelte`, `Rails`, `Prisma`, `Svelte`) não entra na lista e o check **passa verde por omissão** (`RESEARCH.md` §9-R3 / risco R3 do PRD). A decisão separa duas coisas que estavam juntas:

| Camada | O que é | De onde vem (derivação) | Apodrece? |
|---|---|---|---|
| **Chaves** (`STACK_VOCAB[<id>]`) | quais eixos **têm** vocabulário | `AXIS_IDS` (`installer/install.mjs:210-213`, 14 ids, 10 distintos) ∪ tags de `stacks` no `.vendor-lock.json` (4: `dart`, `flutter`, `react`, `nestjs`, hoje já contidas nos ids) | **Não** — é o mesmo dado que o instalador usa para gatear |
| **Termos** (o valor de cada chave) | o vocabulário técnico de cada eixo | curado no módulo (`.opencode/plugins/lib/cdl/checks.mjs`, `protectedPaths`) | Sim — por isso a **cobertura** é cobrada (§2.5 id 4) e a baseline expira |
| **Fecho declarado** | `flutter ⇒ dart` | `STACKS_FOR_EXCEPTIONS` (`install.mjs:231-233`) — a mesma exceção que o instalador usa para `stacks` | Não |
| **Termo cross-axis** | `shadcn`, `Tailwind` valem em `react` **e** `vue` | `Map<term, Set<axis>>`, não `Map<term, axis>` | Não |

**Por que "termos curados" não é lista digitada à mão (a distinção que importa).** O que RF-09 proíbe é a lista **fechada por conveniência**, que passa verde quando aparece um preset novo. Aqui a chave é derivada e a **cobertura é uma condição de falha**: todo id de `AXIS_IDS` tem de ter entrada em `STACK_VOCAB` (vazia só para `other`/`none`, declarado com razão). Como todo preset é **composição de eixos** (`STACK_PROFILES[name].axes`, `install.mjs:252-354`), um preset novo ou reusa eixo já coberto, ou adiciona um id a `AXIS_IDS` — e nesse caso o instrumento **reprova** (`cdl-axis-vocabulary-missing`). A fixture vermelha é obrigatória e está no aceite (§4-C5 / IF4).

**Termos de projeto (`PROJECT_TERMS`)** — não são deriváveis de preset nenhum (são nomes de projeto do cliente). A decisão: registro declarado `{ term, class, proof, owner }` com `class ∈ {projeto, upstream, ferramenta}`, **mais dois alarmes estruturais que não dependem da lista**:

- **(a) `license:`** — o campo só aceita SPDX id ou referência a arquivo de licença empacotado (a spec de skill trata `license` como "license name or reference to a bundled license file", `RESEARCH.md` §2-S4). Medido: 2 fora do padrão, dos quais **1 é legítimo** (`frontend-design/SKILL.md:4`, "Complete terms in LICENSE.txt") e **1 é violação de primeira ordem** (`security-review/SKILL.md:4`, `license: TaskFlow Security Standard` — afirma licença de terceiro que não licenciou nada, `PRD.md` §13).
- **(b) termo de stack em posição identitária de artefato cujo eixo declarado não o contém** — pega identidade cruzada sem precisar de lista de projeto (ex.: uma rule `frontend=vue` cujo título prescreve React).

Nível honesto: 🟢 para (a) e (b); 🟠 para "nome de projeto numa `description:` **sem** termo de stack na mesma linha" — aí só o registro detecta, e o registro é o que o ADR-005 vai aplicar aos 12 arquivos de §4.1. Declarado, não escondido.

### 2.3 A rubrica — 4 vereditos, árvore de ordem fixa, cada um com predicado mecânico

Aplicada **linha a linha** sobre a população. A ordem é fixa (o primeiro passo que decide, decide) — é o que torna a classificação determinística e re-derivável por terceiro.

```
0. a linha não está na população (§2.1)?                              → fora do corpus (não classificada)
1. a linha é PRESCRITIVA?
   predicado: (a) marcador normativo + termo na MESMA cláusula
              (b) linha de tabela com checkbox `[ ]`/`[x]`
              (c) item de lista sob heading normativo
   não ⇒ `menção`/`referência` (não recebe veredito; A-3 é quem trata path)
2. a linha é PROIBIÇÃO? (D2)
   predicado: marcador de negação ANTES do termo, na mesma linha
   sim ⇒ fora de A-2 (contador `prohibition-cited`)
3. `exemplo`      — dentro de fence ```, dentro de <context>/<acceptance>/<task>/<constraints>,
                    blockquote `>`, termo entre aspas, ou "ex.:" / "e.g." / "exemplo"
4. `catálogo`     — ≥2 eixos distintos na linha, OU ≥2 termos ligados por conectivo de
                    alternativa/listagem (`or`, `ou`, `,`, `|`) sem composição `+`;
                    OU o artefato está na exceção E-1 (verdict de arquivo inteiro)
5. `condicional`  — gate no escopo: mesma linha, bullet ancestral (por indentação),
                    heading delimitante, ou `declaredAxis(artefato) ⊇ eixo(termo)`
6. `incondicional` — prescritiva + termo + nenhum dos acima
```

**`declaredAxis(artefato)` — derivação, nesta ordem** (nunca do nome *isolado*):

1. skill com chave no `.vendor-lock.json` → `stacks` da chave (dado declarado na origem do vendor);
2. artefato nomeado em `RULES_BY_AXIS`/`SKILLS_BY_AXIS` → **complemento** do id excluído dentro daquele eixo (são mapas de **exclusão**: a chave `<eixo>=<id>` é o destino que **NÃO** recebe — `install.mjs:361-369`; `frontend-coding-standards.md` está em `frontend=react` ⇒ é a rule de `vue`, `dart`, `flutter`, `other`, `none`);
3. skill local cujo diretório tem segmento igual a um id de eixo (`java-…`, `nestjs-…`, `node-…`, `rust-…`, `frontend-vue-…`) → esse id. Base: **D8** declara que o nome da skill de stack **é** a declaração de identidade (E-3). É a única derivação por nome, e ela existe por decisão do owner, não por conveniência;
4. nada disso → ∅ (artefato comum: prescrição de stack nele é **incondicional** por construção).

**Por que ∅ é a resposta certa para `RULES_COMMON`.** `workflow-rules.md` vai a **todo** destino: prescrever `JUnit 5 + Mockito` nele é incondicional mesmo que o termo seja de um eixo existente. Se "comum a todos" contasse como "eixo declarado", a regra inteira passaria verde — o vetor de apodrecimento que o `ADR-004` §2.3 do PRD-1 já fechou para o inventário ("`SKILLS_COMMON` não confere classe") e que aqui se fecha igual.

| Veredito | Predicado (o que a máquina vê) | Ação | Nível |
|---|---|---|---|
| **`condicional`** | gate no escopo (passo 5) com contrapartida mecânica: o gate nomeia eixo (`backend=java`, `**Spring Boot**:`, `If React`, heading `Java Ecosystem`) **ou** o artefato declara o eixo inteiro | `keep` — é o padrão correto (`sdd-compiler/references/backend.md:53,58`) | 🟢 |
| **`exemplo`** | forma não-normativa (passo 3) | `keep` — e **proibido** promover exemplo a norma implícita (§11 do PRD: condição implícita é pior que prosa nenhuma) | 🟢 |
| **`catálogo`** | enumeração de alternativas (passo 4) | `keep` + entrada em `EXCEPTIONS` quando for **arquivo** inteiro (E-1) | 🟢 |
| **`incondicional`** | prescritiva + termo + nenhum dos anteriores | **`baseline-entry`** com `owner` ∈ {ADR-002..ADR-005} **ou** FAIL do instrumento | 🟠 (a linha é dívida, não veredito: quem a corrige é o ADR dono) |

**D2 é medida, não presumida.** Linha de proibição **não recebe veredito** e entra no contador `prohibition-cited` (30 hoje). Isso é o que sustenta `harness-installer/SKILL.md:161-164` sem transformar a exceção em buraco: uma proibição que deixe de citar tecnologia **sai** do contador, e o contador publicado mostra a variação — não há como apagar a exceção em silêncio, nem como usá-la para esconder uma prescrição (o passo 2 exige o marcador de negação **antes** do termo; "NUNCA use X" é proibição, "use X sempre que…" é prescrição).


## 2.3-bis Emenda do predicado (obrigatória, 2026-11-11)

O review do SDD mediu o predicado em uso e a rubrica original **não cobre a forma canônica de prescrever stack neste repo**: linha de **tabela**. Consequência medida: `| Framework | Spring Boot 3 |` passava verde, e a baseline de 101 nasceu com **30% de ruído** (TOC, amostra de template, fato, anti-pattern invertido, registro datado) e **≥17 prescrições reais fora**. O predicado do passo 1 passa a ser:

```
1. a linha é PRESCRITIVA?
   (a) marcador normativo + termo na MESMA cláusula
   (b) linha de tabela com checkbox `[ ]`/`[x]`
   (c) item de lista SOB HEADING NORMATIVO (o heading é consultado; item solto não basta)
   (d) linha de TABELA cujo cabeçalho ou célula declara stack/ferramenta/comando
       (é a forma canônica aqui: frontend-coding-standards.md:11, workflow-rules.md:558-563)
   (e) prosa declarativa com cópula/determinação de stack ("A stack é X", "usa X", "com X")
2. a linha é PROIBIÇÃO? (D2) — avaliada POR TERMO, não "algum termo depois de alguma negação":
   negação imediatamente antes do termo, OU "X é proibido", "evitar X", "não usar X";
   comparação insensível a caixa (`Não`/`NÃO`/`Nunca`/`NUNCA`/`Evitar`/`Evite`)
```

Corolário: `- Use Spring Boot; NUNCA use Lombok.` deixa de evaporar (a prescrição de Spring Boot conta; a proibição de Lombok conta à parte), e `- Não use Lombok.` conta como proibição em vez de virar dívida.

**Baseline re-derivada:** com o predicado acima, a baseline **volta a ser dívida**: entradas que não são prescrição (TOC, template, fato, registro datado) **saem**, e linhas de tabela prescritivas **entram**. O número final é o que a medição der — e o ADR **não** fixa valor: fixa o predicado. O valor publicado no `detail` é o oráculo, com `sha256` por linha e `owner`.

### 2.4 R3 resolvido — a fonte de eixo é o **export do instalador**; o `V19` mede outra coisa

As duas leituras e o que cada uma é:

| Leitura | O que diz | O que é de fato |
|---|---|---|
| Prosa do `PRD.md` §3.1 | `SKILLS_BY_AXIS` (2), `RULES_BY_AXIS` (2) | **Registros de exclusão** por eixo: `{'frontend=react': ['frontend-vue-specialist'], 'frontend=vue': ['frontend-react-specialist']}` — 2 entradas cada, declaradas em `installer/install.mjs:370-373` e `:396-399`, validadas **na carga** (`:442-475`) |
| `V19` da suíte | `skills … axis=0`, `rules … axis=1` | **Contagem de classe primária**, com precedência `vendor-by-axis > consumer > axis > orphan+decision` (`.opencode/plugins/lib/inventory/checks.mjs:63`, implementada em `:704-715`) |

**A prova de que as duas não se contradizem** (comandos literais, executados em 2026-11-11):

```sh
node --input-type=module -e '
import fs from "node:fs";
const m = await import("./installer/install.mjs");
const oc = JSON.parse(fs.readFileSync("opencode.json","utf8"));
const prompts = Object.values(oc.agent).map(v=>(v.prompt||"").match(/\{file:(.+?)\}/)?.[1])
  .filter(Boolean).map(p=>fs.readFileSync(p,"utf8")).join("\n") + fs.readFileSync("opencode.json","utf8");
console.log("SKILLS_BY_AXIS =", JSON.stringify(m.SKILLS_BY_AXIS));
for (const id of Object.values(m.SKILLS_BY_AXIS).flat()) console.log(" citada por prompt:", id, prompts.includes(id));
console.log("RULES_BY_AXIS =", JSON.stringify(m.RULES_BY_AXIS));
console.log("react-rule citada:", prompts.includes("frontend-react-coding-standards"),
            "| vue-rule citada:", prompts.includes("frontend-coding-standards"));
'
```

Saída: `SKILLS_BY_AXIS = {"frontend=react":["frontend-vue-specialist"],"frontend=vue":["frontend-react-specialist"]}`; **ambas** as skills `citada por prompt: … true`; `RULES_BY_AXIS = {"frontend=react":["frontend-coding-standards.md"],"frontend=vue":["frontend-react-coding-standards.md"]}`; `react-rule citada: false | vue-rule citada: true`.

**Conclusão mecânica:** as 2 skills do mapa são **citadas por prompt**, logo caem na classe `consumer` e não na classe `axis` ⇒ `axis=0`. Das 2 rules, a `frontend-coding-standards.md` é citada (⇒ `consumer`) e a `frontend-react-coding-standards.md` não é (⇒ `axis`) ⇒ `axis=1`. Os números do `V19` estão **corretos**; eles apenas medem **classe primária**, não **declaração de eixo**.

**Decisão (é esta a escolha que faltava):**

1. O instrumento lê **exclusivamente** os exports do instalador (`SKILLS_BY_AXIS`, `RULES_BY_AXIS`, `AXIS_IDS`, `STACKS_FOR_EXCEPTIONS`) e o `.vendor-lock.json`. Nunca lê a saída do `V19`, nunca duplica o mapa (`grep -c "V19" .opencode/plugins/lib/cdl/checks.mjs` ⇒ `0` — IF5).
2. **Divergência entre as duas leituras é esperada e publicada, não falha:** o `V20` publica `axis-decl=2, axis-class=0` no `detail` de PASS. Os dois números medem coisas diferentes; esconder um deles é que seria o defeito.

   *Nota de honestidade:* o primeiro par publicado (`axis-decl=2 / axis-class=0`) descreve **skills**; para rules o par é `2 / 1`. O `V20` publica os dois pares, nomeados por tipo.
3. **Um único caso vira FAIL:** artefato nomeado num mapa de eixo e **ausente do disco** (`cdl-axis-declaration-phantom`). O instalador já valida a *forma* da declaração na carga (`install.mjs:442-475`); o check valida a *existência* do alvo — defesa em profundidade, não duplicação.
4. **Consequência de escopo declarada:** `frontend-vue-specialist` está **só** no mapa de exclusão, não em `SKILLS_COMMON` (§8-N4). O instrumento a mede (está na população sob D7), mas **o que isso significa para a instalação** é do ADR-003 — aqui só se registra que a régua não depende de onde ela mora.

### 2.5 A baseline e os modos de falha — 7 ids, cada um com fixture que **derruba**

A baseline é literal, com hash de linha, e **só encolhe** — a regra está nos dois primeiros ids da tabela abaixo. Tudo o mais que for dívida declarada mora em `EXCEPTIONS`, com `predicate` + `proof` + expiração.

| id de falha | O que significa | Veredito |
|---|---|---|
| **`cdl-unconditional-unbaselined`** | linha `incondicional` **fora** da baseline, ou com hash/veredito diferente do registrado | **FAIL** (modo de falha nº 1 exigido) |
| **`cdl-baseline-stale`** | entrada de baseline cuja linha mudou, cujo veredito deixou de ser `incondicional` ou cujo arquivo desapareceu — baseline inflada vira permissão permanente | **FAIL** (entrada removida; baseline só encolhe) |
| **`cdl-exception-stale`** | entrada de `EXCEPTIONS` cujo `predicate` deixou de casar (E-1 sem catálogo, E-2 sem `N/A`, E-3 sem a skill, E-4 sem `__tests__/`), ou cujo `proof` morreu | **FAIL** (modo de falha nº 2 exigido: **exceção obsoleta**) |
| `cdl-axis-vocabulary-missing` | id de eixo (ou tag de `stacks`) sem entrada em `STACK_VOCAB` — preset novo que escapa da lista | **FAIL** (RF-09, fixture obrigatória) |
| `cdl-population-payload-gap` | artefato propagado (derivado dos exports/roster/lock) **fora** da população derivada, ou população vazia por glob quebrado | **FAIL** |
| `cdl-axis-declaration-phantom` | mapa de eixo nomeia artefato ausente do disco | **FAIL** |
| `cdl-identity-term-stale` | termo de `PROJECT_TERMS` que não aparece mais em posição identitária, ou entrada sem `proof` viva | **FAIL** |

**Onde a baseline vive e por que não infla:** `.opencode/plugins/lib/cdl/checks.mjs`, que é `.opencode/plugins/**` ⇒ `protectedPaths` (`harness.config.json`) ⇒ mudá-la exige o trailer `Harness-Gate-Change` (pre-commit + `harness-integrity.yml`). Nível honesto: 🟢 *"`incondicional` novo reprova a suíte selada"*; 🟠 *"quem editar `scripts/static-checks.mjs` (não protegido) e remover a chamada de `checkCdl()` escapa"* — mesma aresta do `ADR-004`-C6 e do `ADR-005` §2.5, mitigada por diff revisado + CI, não por runtime.

**Custo de manutenção:** 0 por artefato `condicional`/`exemplo`/`catálogo`; 1 linha por `incondicional` (com `owner`); **1 remoção** quando a dívida fecha. É a fricção desejada: o preço de não decidir é a suíte vermelha, e o preço de decidir é uma linha.

### 2.6 Custo de selo: **zero**

O instrumento é um **módulo** em path propagado + **um** `record("V20", …)` no adapter que já roda dentro do selo. `commands.suiteFull` **não muda**, logo `harness.config.json` não muda e `HARNESS_SEAL_JSON` **não** é republicado (`harness-config.md` §"Command seal"). Qualquer desenho que exigisse comando novo seria custo de gate pago sem ganho de critério — é o que a alternativa C2/C1 do `RESEARCH.md` §5 já tinha descartado por esse motivo.


### 2.3-ter Rodada 3: o instrumento é heurístico, e agora diz isso

Duas rodadas de review mostraram o mesmo padrão: cada correção de predicado move a fronteira (sai um falso negativo, entra um falso positivo). Isso não é bug — é o que acontece ao medir prosa com regex. A decisão do owner (2026-11-11) é manter o instrumento **rotulado como heurístico**, com os 6 defeitos abaixo corrigidos e **FP/FN medidos numa amostra declarada**.

1. **Cópula `é`:** `\b` não casa antes de caractere não-ASCII. A classe de cópula passa a usar alternância explícita (`é|É|são|usa|usam|exige`) sem `\b` à esquerda.
2. **Marcadores e headings:** `NORMATIVE`/`NORMATIVE_HEADING` passam a cobrir os verbos que o corpus usa (`Verifique`, `Configure`, `Analise`, `Substituir`, `rode`, `garanta`) e os headings topicais (`### Testes`, `### DDD Modular`, `### Performance`) — hoje a linha conta conforme o título da seção, não conforme a cláusula.
3. **D2 com backtick e rótulo:** proibição vale com o termo em `code`, com dois-pontos (`Proibido no unitário: Lombok`), com verbo (`reprova`) e com "X proibido". As 4 proibições hoje baselinadas saem para `prohibition-cited`.
4. **`catálogo` só para alternativa:** exige conectivo de alternativa (`or|ou|/|,`) **sem** composição (`com`, `+`) e sem dois eixos na mesma cláusula. `Use X com Y` é composição ⇒ `incondicional`.
5. **C5 fail-closed real:** sem `exports` injetado, `cdl-axis-vocabulary-missing` **falha mesmo com lock presente** (hoje o fallback lê o próprio `STACK_VOCAB` e publica PASS).
6. **Ruído estrutural sai:** registros datados (`| 2026-.. |`), colisão do termo `H2` (exigir contexto de banco: `banco`, `database`, `testcontainers`), anti-patterns invertidos e template de exemplo deixam de ser `incondicional`.

**Rotulagem obrigatória:** o `detail` do `V20` passa a publicar `heuristic=true` + `fp=<n>/<amostra>` + `fn=<n>/<amostra>` + o método da amostra. A rubrica deixa de se chamar determinística: ela é **um scanner com erro declarado**, e a baseline é dívida **medida por ele**, não a verdade sobre o repo.

**Consequência aceita:** a baseline **sobe** (as ~20 prescrições que sumiram voltam). Um número maior aqui é sinal de instrumento mais honesto, não de repo pior.

## 3. Interface congelada

Cada item é verificável por comando, da raiz do repo. Itens marcados *(SDD)* só passam a valer após a implementação; antes dela o comando mede o **estado atual**, e o valor esperado está anotado. Nível 🟡 declarado onde a verificação depende de leitura.

1. **Módulo puro, propagável e sem comando novo.** O instrumento é `.opencode/plugins/lib/cdl/checks.mjs` (`.opencode/plugins` propaga ao destino, `install.mjs:107`), exportando `derivePopulation(root)`, `classifyLine(line, ctx)`, `declaredAxis(artifact, exports)`, `runCdlChecks(root)`, `STACK_VOCAB`, `PROJECT_TERMS`, `BASELINE`, `EXCEPTIONS`, `VERDICTS`.
   *Verificação (SDD)*: `git ls-files .opencode/plugins/lib/cdl/` ⇒ não vazio; `grep -c "export function runCdlChecks" .opencode/plugins/lib/cdl/checks.mjs` ⇒ `1`; `grep -c "export function classifyLine" …` ⇒ `1`.

2. **A população é a de §2.1, com o número publicado.** `derivePopulation(root)` não aceita lista externa; as 3 exclusões são constantes nomeadas (`X1`,`X2`,`X3`) com razão no cabeçalho.
   *Verificação*: `git ls-files '*.md' | grep -vE '^\.spec/' | grep -vE '(^|/)__tests__/' | grep -vE '^\.agents/skills/ui-ux-pro-max/data/' | wc -l` ⇒ `228`; `… | xargs wc -l | tail -1` ⇒ `31661 total`; *(SDD)* `node scripts/static-checks.mjs | grep V20` ⇒ `population=228/31661` no `detail`.

3. **A população contém o payload do instalador, derivado — 0 fora.** Um artefato novo em `RULES_COMMON`/`SKILLS_COMMON` que não caia nos globs de §2.1 ⇒ `cdl-population-payload-gap` FAIL.
   *Verificação*: o `node --input-type=module` que resolve `RULES_COMMON ∪ RULES_BY_AXIS ∪ agent.*.prompt ∪ SKILLS_COMMON ∪ SKILLS_BY_AXIS ∪ keys(.vendor-lock.json)` e conta `.md` ⇒ `payload md = 219`, `fora da população = 0`; *(SDD)* fixture com um `.md` fora dos globs ⇒ FAIL.

4. **O vocabulário tem chave derivada e cobertura cobrada.** Todo id de `AXIS_IDS` (10 distintos) e toda tag de `stacks` do lock (4, já contidas) têm entrada; só `other`/`none` são vazios, com razão escrita.
   *Verificação*: `node --input-type=module -e 'import fs from "node:fs";const m=await import("./installer/install.mjs");const ids=new Set(Object.values(m.AXIS_IDS).flat());const lock=JSON.parse(fs.readFileSync(".agents/skills/.vendor-lock.json","utf8")).skills;for(const v of Object.values(lock))for(const s of (v.stacks||[]))ids.add(s);console.log([...ids].sort().join(","))'` ⇒ `dart,flutter,java,nestjs,node,none,other,react,rust,vue` (10); *(SDD)* `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.missingVocabulary()))'` ⇒ `[]`; fixture que acrescenta um id a `AXIS_IDS` numa árvore temporária ⇒ `cdl-axis-vocabulary-missing` FAIL.

5. **Fonte de eixo única — o export do instalador (§2.4), e o `V19` nunca é lido.**
   *Verificação*: `grep -c "V19" .opencode/plugins/lib/cdl/checks.mjs` ⇒ `0` *(SDD)*; `grep -c "SKILLS_BY_AXIS" .opencode/plugins/lib/cdl/checks.mjs` ⇒ `≥1`; a prova das duas leituras é o comando de §2.4 (saída literal registrada ali).

6. **A rubrica tem exatamente 4 vereditos, ordem fixa e função pura.** `VERDICTS = ["condicional","exemplo","catálogo","incondicional"]`; `classifyLine` devolve **um** deles ou `null` (não-prescritiva), nunca dois; a ordem é a de §2.3 e está nos testes (exemplo vence catálogo; catálogo vence condicional).
   *Verificação (SDD)*: `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.VERDICTS.join(",")))'` ⇒ `condicional,exemplo,catálogo,incondicional`; `node --test .opencode/plugins/__tests__/cdl.spec.mjs` ⇒ 0 fail, com 1 caso por veredito e 2 casos de **ordem**.

7. **A baseline é literal, com hash, e só encolhe.** Entrada = `{ file, line, sha256, verdict: "incondicional", owner }`; `owner ∈ {ADR-002, ADR-003, ADR-004, ADR-005}`; entrada sem `owner` é FAIL do próprio check, não do revisor.
   *Verificação (SDD)*: `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.BASELINE.length, m.BASELINE.every(e=>e.owner&&e.sha256&&e.verdict))'`; hoje o valor equivalente é a medição de §4.2: **32 linhas / 11 arquivos** (`incondicional`) e **15 linhas / 12 arquivos** (`identity`).
   *Verificação do modo de falha nº 1*: fixture que acrescenta uma linha `incondicional` num arquivo da população ⇒ `cdl-unconditional-unbaselined` FAIL.
   *Verificação do modo de falha nº 2 (baseline)*: apagar/editar a linha de uma entrada ⇒ `cdl-baseline-stale` FAIL.

8. **`EXCEPTIONS` nomeia E-1..E-4, cada uma com `predicate` + `reason` + `proof`, e expira.**
   *Verificação*: `grep -c "cdl-exception-stale" .opencode/plugins/lib/cdl/checks.mjs` ⇒ `≥1` *(SDD)*; as 4 provas de §4.3 rodam hoje (§4.3); fixture que remove o `N/A` de `harness-config.md:13` ⇒ `cdl-exception-stale` FAIL.

9. **D2 é contada, não presumida.** O `detail` de PASS publica `prohibition-cited` e `prescriptions`; proibição não consome veredito.
   *Verificação (SDD)*: `node scripts/static-checks.mjs | grep V20` ⇒ contém `prohibition-cited=30` e `prescriptions=91` no dia da promulgação (números de §4.2; mudam com a prosa, e mudam para baixo).

10. **A-3 reusa o mecanismo selado, e a segunda gramática é declarada.** O predicado de A-3 para `rules/*.md` é o do `V18` (contrato do `ADR-005` do PRD-1: `baseline=7`, `non-defect=1`). A segunda gramática (`.doc/**`, `frontend/DESIGN.md`) **não** é detectada hoje: o `V20` publica `refs-undetected=<n>` com dono = **ADR-004**, nunca silêncio. Nenhum linter externo entra (C1/C2/C3 descartados em §6).
    *Verificação*: `node scripts/static-checks.mjs | grep V18` ⇒ `baseline=7, non-defect=1`; `grep -rn "DESIGN\.md" .agents/agents | wc -l` ⇒ `11`; `for p in $(grep -rhoE "rules/[a-z0-9-]+\.md" .agents | sort -u); do test -e ".agents/$p" || echo "$p"; done | wc -l` ⇒ `13`.

11. **A-1 com dois alarmes estruturais e um registro.** `PROJECT_TERMS` (registro) + `license:` fora de SPDX ⇒ FAIL + termo de stack em posição identitária fora do eixo declarado ⇒ FAIL.
    *Verificação*: `git ls-files '*.md' | grep -vE '^\.spec/' | grep -vE '(^|/)__tests__/' | grep -vE '^\.agents/skills/ui-ux-pro-max/data/' | xargs awk '/^(#{1,6} |description:|license:)|(neste|no) projeto [A-Z]/{ if ($0 ~ /TaskFlow|taskflow|Atlas ECM|Pulse/) print FILENAME }' | sort -u | wc -l` ⇒ `12`; mesmo pipeline com `print` em vez de `FILENAME` ⇒ `15`; *(SDD)* fixture com `license: Foo Security Standard` ⇒ `cdl-identity-*` FAIL.

12. **Este ADR está fora do corpus, e a suíte fica verde.** `.spec/**` é X1; o commit deste batch toca **só** `.spec/prd/prd-agnostic-artifacts/**`.
    *Verificação*: `node scripts/static-checks.mjs` ⇒ exit `0` com `PASS ADR-01` e `PASS ADR-02`; `git show --stat --name-only HEAD` ⇒ `ADR-INDEX.md` + `ADRs/ADR-001-criterio-cdl-e-instrumento/ADR.md`.

## 4. Aplicação — o que a régua diz hoje

Regra de leitura: **veredito** vem da árvore de §2.3; **dono** é o ADR do fatiamento que corrige a prosa; **prova** é o comando. Nenhuma linha abaixo é "caso especial" — é a régua aplicada.

### 4.1 A-1 — 12 arquivos / 15 linhas em posição identitária

| Arquivo | Linhas | Dono |
|---|---|---|
| `.agents/agents/developer-engineer/AGENT.md` | `:1`, `:25` | ADR-005 |
| `.agents/agents/design-system-specialist/AGENT.md` | `:42` | ADR-005 |
| `.agents/agents/ux-designer/AGENT.md` | `:32` | ADR-005 |
| `.agents/rules/sdd-workflow-standard.md` | `:3` | ADR-002 |
| `.agents/rules/frontend-coding-standards.md` | `:154` | ADR-003 (D1 formaliza o eixo; a linha `Atlas ECM` sai) |
| `.agents/rules/frontend-react-coding-standards.md` | `:161` | ADR-003 (idem) |
| `.agents/skills/security-review/SKILL.md` | `:3`, `:4` (inclui `license:`) | ADR-003 |
| `.agents/skills/spec-review/README.md` | `:1` | ADR-003 |
| `.agents/skills/spec-review/SKILL.md` | `:3`, `:8` | ADR-003 |
| `.agents/skills/spec-review/assets/checklist.md` | `:1` | ADR-003 |
| `.agents/skills/spec-review/assets/output-template.md` | `:7` | ADR-003 |
| `.agents/skills/spec-review/assets/usage-guide.md` | `:1` | ADR-003 |

**Total: 12 arquivos / 15 linhas.** Metade da skill `spec-review` (5 de 5 arquivos) está aqui — é a mesma leitura do `PRD.md` §3.4 (#12–#16).

### 4.2 A-2 — 32 `incondicional` em 11 arquivos

| Arquivo | Linhas `incondicional` | Nº | Dono |
|---|---|---|---|
| `.agents/rules/workflow-rules.md` (RULES_COMMON) | `:435`, `:436`, `:440`, `:442` | 4 | **ADR-002** |
| `.agents/agents/orchestrator/AGENT.md` | `:500`, `:501`, `:502`, `:611` | 4 | ADR-005 |
| `.agents/agents/developer-engineer/AGENT.md` | `:77`, `:78` | 2 | ADR-005 |
| `.agents/skills/spec-review/assets/checklist.md` | `:94`, `:98`, `:117`, `:120`, `:121`, `:137`, `:160` | 7 | ADR-003 |
| `.agents/skills/spec-review/README.md` | `:111`, `:114`, `:116`, `:178`, `:179` | 5 | ADR-003 |
| `.agents/skills/spec-review/SKILL.md` | `:68`, `:69`, `:164`, `:166`, `:167` | 5 | ADR-003 |
| `.agents/skills/dev-planner/SKILL.md` | `:194` | 1 | ADR-005 |
| `.agents/skills/dev-planner/anti-patterns.md` | `:208` | 1 | ADR-005 |
| `.agents/skills/sdd-compiler/references/backend.md` | `:28` | 1 | ADR-005 |
| `.agents/skills/sdd-compiler/references/database.md` | `:56` | 1 | ADR-005 |
| `.agents/skills/harness-installer/SKILL.md` | `:163` | 1 | ADR-005 |

**Total: 32 linhas / 11 arquivos** (de 91 prescrições: `condicional` 43, `exemplo` 8, `catálogo` 8, `incondicional` 32; e 30 proibições fora de A-2 por **D2**).

**Três classes de falso-positivo declaradas** (o SDD escolhe entre estender o predicado ou manter a entrada com dono — a baseline só encolhe, então qualquer escolha é segura):

- **FP-1 — índice/TOC em seção normativa**: `spec-review/README.md:178,179` ("4. Liquibase (5 itens)") são itens de sumário, não prescrição.
- **FP-2 — descrição de check, não instrução**: `harness-installer/SKILL.md:163` ("código reprova: `require('vuetify/lib')`…") descreve o que o check de destino limpo reprova — é a posição de **D2**, não uma prescrição.
- **FP-3 — prescrição genérica com exemplo embutido**: `sdd-compiler/references/backend.md:28` e `database.md:56` prescrevem comportamento genérico e exemplificam com nomes de tecnologia entre parênteses/`like`.

**Nota sobre o que NÃO aparece e deveria tranquilizar:** `sdd-compiler/references/backend.md:53,58` e `database.md:60` — os três sítios que o `PRD.md` §3.6 usa como **padrão correto** — saem `condicional`/`catálogo`, como esperado. Se a régua os reprovasse, a régua estaria errada, não o arquivo.

### 4.3 As exceções E-1..E-4 — nomeadas, com prova

| Exceção | O que cobre | Onde vive no instrumento | Prova (comando, hoje) |
|---|---|---|---|
| **E-1** catálogo multi-stack | `.agents/skills/ui-ux-pro-max/**` (arquivo inteiro) e `sdd-compiler/references/frontend.md:49-51` (enumeração) | `EXCEPTIONS` (verdict de arquivo) + passo 4 da rubrica (linha) | `ls .agents/skills/ui-ux-pro-max/data/*.csv \| wc -l` ⇒ `14`; `sed -n '49,51p' .agents/skills/sdd-compiler/references/frontend.md` ⇒ "React: Radix… / Vue: PrimeVue or Vuetify. / Angular: …" |
| **E-2** N/A justificado inline | `rules/harness-config.md:13` | passo 2 (não é prescrição: é declaração de ausência) + `EXCEPTIONS` se a heurística ainda casar | `sed -n '13p' .agents/rules/harness-config.md` ⇒ "`N/A` with inline justification — this repo has no Java/Maven backend and no Vue/Vite frontend…" |
| **E-3** identidade por design | 5 skills de stack em `SKILLS_COMMON` (`frontend-react-specialist`, `java-…`, `nestjs-…`, `node-…`, `rust-architecture-specialist`) + `frontend-vue-specialist` (só no mapa de eixo) = **6** | `declaredAxis` derivação 3 (nome como declaração, por **D8**) | `node --input-type=module -e 'const m=await import("./installer/install.mjs");const ax=Object.values(m.AXIS_IDS).flat();console.log(m.SKILLS_COMMON.filter(n=>n.split("-").some(s=>ax.includes(s))).length)'` ⇒ `5` (+1 no mapa ⇒ `6`) |
| **E-4** dado de teste/fixture | `**/__tests__/**` (recorte de **D7**; `scripts/` e `harness/` **não** são excluídos por decisão) | exclusão X2 da população | `git ls-files '*/__tests__/*.md' \| wc -l` ⇒ `0` (a exclusão é preventiva, não cosmética) |

### 4.4 A-3 — o predicado é do `V18`; os vereditos são do ADR-004

`V18` (`baseline=7`, `non-defect=1`) já mede `rules/*.md` citado e ausente em prosa viva. A segunda gramática (`.doc/**`, `frontend/DESIGN.md`) fica **declarada e não detectada** (`refs-undetected`), com dono ADR-004 — porque "não detectado" publicado é honesto, e "detectado" por um segundo regex inventado aqui seria um segundo `V18` sem o contrato dele.

### 4.5 O que **não** entra na baseline, por decisão do owner

A baseline não é o lugar de tudo o que cita stack. Quatro conjuntos ficam de fora, e a razão é uma decisão fechada no G1 — se qualquer um deles fosse para a baseline, a decisão viraria dívida disfarçada:

| Conjunto | Tamanho hoje | Por que **não** é baseline | Veredito/ação que o absorve | Prova |
|---|---|---|---|---|
| **D1** — as 2 rules de frontend | 382 l. (188 + 194) | O owner decidiu **gatear por eixo**, não reescrever. `declaredAxis` deriva `vue`/`react` do mapa de exclusão, então prescrição daquele próprio eixo é `condicional` — e as duas rules têm **0** linha `incondicional` hoje | `condicional` (passo 5, via `declaredAxis`) | `sed -n '370,373p' installer/install.mjs` ⇒ as 2 entradas do mapa; e as duas rules **não** aparecem na tabela de §4.2 |
| **D2** — proibições citando tecnologia | 30 linhas | Proibição não é prescrição: o efeito pretendido é **ausência** (`harness-installer/SKILL.md:161-164`). Entrar na baseline as trataria como defeito a corrigir, o oposto da decisão | `fora de A-2` + contador `prohibition-cited=30` publicado em PASS | §3-IF9 |
| **D8** — catálogo (`ui-ux-pro-max`, `sdd-compiler/references/frontend.md:49-51`) e as 6 skills de stack por nome | 1 arquivo + 1 bloco + 6 skills | O catálogo **é** o produto (E-1) e o nome da skill **é** a declaração de eixo (E-3), por decisão permanente | `catálogo` (passo 4 / exceção E-1) e `condicional` (via `declaredAxis` derivação 3) | §4.3-E1/E3 |
| **E-2** — `harness-config.md:13` | 1 linha | É a declaração de que a stack **não existe** — o oposto do defeito | não é prescrição (passo 1) | `sed -n '13p' .agents/rules/harness-config.md` |

**E o que** entra: as **32** linhas `incondicional` (A-2) e as **15** de identidade (A-1), essas sim com dono por ADR — porque são prescrição/identidade que o destino lê como norma, não decisão de escopo.

## 5. Consequências

- **C1 — a próxima linha de prosa não pede um ADR.** Pede um veredito. O ADR deixa de ser o lugar onde cada sítio nasce; passa a ser onde as **decisões de correção** vivem (ADR-002..005).
- **C2 — "agnóstico" deixa de ser adjetivo e passa a ter 4 respostas possíveis por linha**, com predicado escrito. É a propriedade que o `RESEARCH.md` §3 declara como o ganho real do padrão Kiro/Cursor (`inclusion:`/`globs`): a condição é verificável **sem interpretar a frase**.
- **C3 — a dívida continua por 1 ciclo, com dono e prazo.** As 32 linhas seguem no repo até ADR-002..005; o que muda é que a suíte **não deixa nascer a 33ª** e que cada uma tem dono.
- **C4 — o critério é neutro quanto ao mecanismo.** Remover, condicionar inline, gatear por eixo, mover para perfil — todos satisfazem a rubrica igualmente (é o que `PRD.md` §3.6 exige e §7 reserva ao ADR).
- **C5 — RF-09 ganha mecanismo.** A fixture que derruba: acrescentar um eixo sem vocabulário ⇒ FAIL. Sem ela, a lista derivada seria fé, não garantia.
- **C6 — custo de revisão: 1 linha por dívida, 1 remoção por fechamento.** Zero por `condicional`/`exemplo`/`catálogo`. Baseline em `protectedPaths` custa trailer `Harness-Gate-Change` em todo PR que a altere — e é isso que impede a lista de crescer sem rastro.
- **C7 — 🟠 escape declarado (dois, iguais aos precedentes).** (a) O adapter em `scripts/static-checks.mjs` não é `protectedPaths`: remover `checkCdl()` desliga o check sem trailer. (b) O destino herda o **módulo** (`.opencode/plugins` propaga) e **não** herda o `V20` (`scripts/` nunca é artefato de consumidor, `install.mjs:1189-1195`) — o destino recebe código sem caller até o PRD-3 decidir como ele ganha runner próprio. Nível: 🟢 neste repo · ⚠️ no destino, declarado.

## 6. Alternativas descartadas

| Alternativa | Custo medido neste repo | Por que não |
|---|---|---|
| **C1 — vale (regras YAML)** | 1 binário por SO + 1 passo de CI + `.vale.ini` + ~10–21 regras em paridade com a lista derivada | As regras publicadas são de **estilo/terminologia**; "linha prescritiva com termo fora de contexto condicional" exige regra própria, o veredito de 4 valores não é expressável no formato, e a lista viveria em **dois** lugares (YAML × `AXIS_IDS`) — drift garantido. `RESEARCH.md` §5-C1. |
| **C2 — textlint (regras npm)** | 1 dependência nova + N pacotes (ou 1 plugin próprio) + passo de CI | Mesmo problema semântico; o "plugin próprio" **é** o módulo que já temos, com uma dependência a mais. |
| **C3 — lychee (link/path)** | 1 binário Rust + 1 passo de CI + **extrator próprio** de path em backtick | Resolve A-3 só se a referência for link; `rules/security-standard.md` é path em prosa e `[//]: # (skill)` é link-ref que ele nem resolve. Sem extrator, cobertura ≈ 0. |
| **Lista de termos digitada (a do `PRD` §3.4)** | 0 infra | É o defeito `FU-64`: termo novo passa verde. `PRD` §9-RF-09 proíbe explicitamente. |
| **Sem baseline (FAIL em qualquer `incondicional`)** | 0 arquivo de baseline | Nasce vermelho com 32 linhas e o repo perde a suíte verde (H2) — a lição `V12`/`V18`: check que nasce vermelho morre na primeira semana. |
| **Usar o `V19` como fonte de eixo** | 0 linha | `V19` conta **classe primária** com precedência (§2.4): derivar dali produziria `axis=0` ⇒ nenhuma skill de eixo reconhecida ⇒ lista que **nunca falha**. É exatamente o risco R3. |
| **Incluir `.spec/**` na população** | 154 arquivos / 20.481 linhas a mais | O instrumento mediria o próprio registro de decisão e o `ADR-001` seria a primeira linha vermelha. Regra de corpus já fixada no `ADR-005` §2.1-C5 do PRD-1. |
| **Um 3º check para A-1 e outro para A-3** | +2 módulos +2 specs | A-1 e A-2 compartilham **população e vocabulário**; A-3 já tem instrumento (`V18`). Três réguas para uma definição é como se cria divergência entre predicados que o PRD declara irmãos. |

## 7. Critérios de verificação

**Re-derivação do contexto (rodar antes do SDD; tem de bater com §1/§4):**

```sh
# população (D7) — 228 arquivos / 31.661 linhas
git ls-files '*.md' | grep -vE '^\.spec/' | grep -vE '(^|/)__tests__/' \
  | grep -vE '^\.agents/skills/ui-ux-pro-max/data/' | wc -l                       # 228
git ls-files '*.md' | grep -vE '^\.spec/' | grep -vE '(^|/)__tests__/' \
  | grep -vE '^\.agents/skills/ui-ux-pro-max/data/' | xargs wc -l | tail -1       # 31661 total

# A-1 — 12 arquivos / 15 linhas
git ls-files '*.md' | grep -vE '^\.spec/' | grep -vE '(^|/)__tests__/' \
  | grep -vE '^\.agents/skills/ui-ux-pro-max/data/' \
  | xargs awk '/^(#{1,6} |description:|license:)|(neste|no) projeto [A-Z]/{ if ($0 ~ /TaskFlow|taskflow|Atlas ECM|Pulse/) print FILENAME }' \
  | sort -u | wc -l                                                               # 12

# R3 — as duas leituras (saída em §2.4)
node --input-type=module -e '
import fs from "node:fs";
const m = await import("./installer/install.mjs");
const oc = JSON.parse(fs.readFileSync("opencode.json","utf8"));
const p = Object.values(oc.agent).map(v=>(v.prompt||"").match(/\{file:(.+?)\}/)?.[1])
  .filter(Boolean).map(x=>fs.readFileSync(x,"utf8")).join("\n") + fs.readFileSync("opencode.json","utf8");
console.log(JSON.stringify(m.SKILLS_BY_AXIS), JSON.stringify(m.RULES_BY_AXIS));
console.log(Object.values(m.SKILLS_BY_AXIS).flat().map(id=>id+":"+p.includes(id)).join(" "));
'
node scripts/static-checks.mjs | grep V19        # axis=0 (skills) / axis=1 (rules)
grep -n "vendor-by-axis > consumer > axis" .opencode/plugins/lib/inventory/checks.mjs   # :63

# A-3 / suíte (estado atual, não muda por este ADR)
node scripts/static-checks.mjs | grep -E '^PASS (V18|V19)'
node scripts/static-checks.mjs | grep -E '^(PASS|FAIL) (ADR-01|ADR-02|PRD-01)'
```

**Aceite do SDD deste ADR** (cada bloco mapeia para um item de §3):

```sh
# IF-1 / IF-2 / IF-4: módulo, população, vocabulário
git ls-files .opencode/plugins/lib/cdl/                                          # não vazio
grep -c "export function classifyLine" .opencode/plugins/lib/cdl/checks.mjs       # 1
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.missingVocabulary()))'   # []
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.derivePopulation().files.length, m.derivePopulation().lines))'  # 228 31661

# IF-5 / IF-6: fonte única e ordem dos vereditos
grep -c "V19" .opencode/plugins/lib/cdl/checks.mjs                                # 0
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.VERDICTS.join(",")))'    # condicional,exemplo,catálogo,incondicional

# IF-7 / IF-8: baseline e exceções (7 ids, 2 modos exigidos com fixture que derruba)
node --test .opencode/plugins/__tests__/cdl.spec.mjs                              # 0 fail
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.BASELINE.every(e=>e.owner&&e.sha256) , m.EXCEPTIONS.length))'

# IF-9 / IF-10: contadores publicados, A-3 reusa V18
node scripts/static-checks.mjs | grep '^PASS V20'                                 # population=… prescriptions=… prohibition-cited=… refs-undetected=…
node scripts/static-checks.mjs | grep '^PASS V18'                                 # baseline=7, non-defect=1

# IF-12 e §2.6: selo intacto, suíte verde, batch só em .spec/prd/**
git diff --exit-code -- harness.config.json .opencode/plugins/lib/seal.mjs         # vazio
node -e 'console.log(require("./harness.config.json").commands.suiteFull)'        # literal inalterado
node scripts/static-checks.mjs; echo $?                                           # 0
git show --stat --name-only HEAD                                                  # só .spec/prd/prd-agnostic-artifacts/**
```

**Fora do aceite deste ADR (declarado):** reduzir os 32/15 (é ADR-002..005), mover artefato no instalador (PRD-3), decidir `DESIGN.md` (ADR-004/PRD-5) e republicar selo (não acontece).

## 8. Notas de correção (divergências medidas entre PRD/RESEARCH e disco)

- **N1 — "112 arquivos de payload" → 219 `.md`, e a população (D7) é 228.** O `PRD.md` §3.1 mede 112 arquivos/21.174 linhas a partir de `RULES_COMMON`+`RULES_BY_AXIS`+roster+`SKILLS_COMMON`+`SKILLS_BY_AXIS` **sem** as 25 skills vendorizadas (que o instalador propaga por `stacks` do lock). Re-derivado por export incluindo o lock: **219 `.md`**, 0 fora da população; e a população de D7 (repo inteiro menos 3 exclusões) = **228**. Os números de §1 substituem os do PRD para efeito deste instrumento; o PRD não é editado aqui (dono: correção de texto do PRD, mesma via do `ADR-004`-C1 do PRD-1).
- **N2 — A-1 "11 arquivos" → 12 (15 linhas).** A medição do PRD §3.6 lê "título/heading/frontmatter"; com **todos** os headings (`^#{1,6} `) e a prosa "no projeto X", a régua devolve 12 arquivos / 15 linhas: a diferença é `sdd-workflow-standard.md:3` ("…no projeto Atlas ECM", que não é heading) e `design-system-specialist/AGENT.md:42` (heading de nível 3). Nenhum arquivo a mais é surpresa; o número publicado passa a ser o medido.
- **N3 — o "E-4" do PRD citava `scripts/`, `__tests__/` e `harness/`; D7 estreitou para `__tests__/`.** Consequência: `scripts/` e `harness/` **estão** na população se algum `.md` aparecer lá (hoje 0). Registrado porque a decisão do owner veio **depois** do PRD e a prosa do PRD §3.6 continua com a lista antiga — o `ADR` implementa D7, e o texto do PRD é dívida de correção declarada, não fonte de verdade sobre a população.
- **N4 — "6 skills de stack em `SKILLS_COMMON`" → 5 + 1.** Medido: `SKILLS_COMMON` contém `frontend-react-specialist`, `java-architecture-specialist`, `nestjs-architecture-specialist`, `node-architecture-specialist`, `rust-architecture-specialist` (**5**); `frontend-vue-specialist` aparece **só** em `SKILLS_BY_AXIS['frontend=react']`. O conjunto de 6 que `E-3` protege está correto; a **localização** é que diverge. O que isso significa para a instalação (uma skill só no mapa de exclusão pode nunca ser instalada) **não é decidido aqui** — dono: **ADR-003**, junto de D1/D3.
- **N5 — o `PRD.md` §7 tem um não-objetivo que D7 superou.** §7 diz "não-objetivo: … proibir termo em `.md` de `docs/` ou `harness/`"; D7 (G1, mesma data) manda medir o **repo inteiro** menos vendor, o que inclui `docs/` e `harness/`. A decisão do owner prevalece; a leitura correta do não-objetivo sobrevivente é "não criar check que reprove **fixture** de teste" (que é o que X2 faz). Registrado para que a contradição não seja lida como descuido.
- **N6 — "A-2 = 43 arquivos / 15 por heurística-piso" → 139 arquivos com termo e 32 linhas `incondicional` em 11 arquivos.** Os 43 do PRD contam arquivos **do payload** com ≥1 termo, com pipeline próprio; sob D7 (população maior) e com a rubrica de 4 vereditos (que **classifica** as 91 prescrições em vez de filtrar por marcador), o número comparável é 32 linhas em 11 arquivos. A diferença não é melhora nem piora: é régua diferente, e a régua do PRD declara explicitamente que "a heurística superestima" (§3.6-A-2). O baseline deste ADR é o medido, não o herdado.
- **N7 — o `license:` de `frontend-design/SKILL.md:4` parece violação e não é.** "Complete terms in LICENSE.txt" é **referência a arquivo de licença empacotado**, que a spec de skill admite (`RESEARCH.md` §2-S4). Só `security-review/SKILL.md:4` é violação. Um alarme que reprovasse os dois seria ruído — e ruído é como se ensina o time a ignorar a régua (`ADR-004` §2.4).

## 9. O que fica para o SDD deste ADR

Nesta ordem:

1. `.opencode/plugins/lib/cdl/checks.mjs`: `derivePopulation`, `classifyLine`, `declaredAxis`, `missingVocabulary`, `runCdlChecks`, `STACK_VOCAB` (10 chaves derivadas + `other`/`none` vazios com razão), `PROJECT_TERMS`, `EXCEPTIONS` (E-1..E-4 com `predicate`/`reason`/`proof`), `BASELINE` (32 `incondicional` + 15 `identity`, com `sha256` e `owner` por linha), `VERDICTS`, e os **7** ids de falha de §2.5.
2. `.opencode/plugins/__tests__/cdl.spec.mjs` no padrão de `refs.spec.mjs`/`inventory.spec.mjs`: árvore-fixture em `tempScope`, 1 caso por veredito, 2 casos de **ordem**, 2 modos de falha exigidos (`cdl-unconditional-unbaselined` e `cdl-exception-stale`/`cdl-baseline-stale`) e a fixture de preset novo que derruba `cdl-axis-vocabulary-missing`.
3. Adapter: `checkCdl(root)` + **um** `record("V20", …)` em `scripts/static-checks.mjs`, com `detail` publicando `population`, `prescriptions`, `prohibition-cited`, `axis-decl`/`axis-class` por tipo, `refs-undetected` e `baseline`.
4. Rodar `commands.suiteFull` completo e `node scripts/sdd-checks.mjs` antes do merge; `VERIFY.md` com as 3 dimensões; `harness.config.json` e `seal.mjs` sem diff.
5. Publicar a **lista literal** da baseline no módulo (não neste ADR): divergência entre os 32/15 medidos aqui e a lista do SDD é **drift a registrar** (`PRD` §5-M-8), nunca a esconder.

**Fora do SDD (declarado):** corrigir qualquer uma das 32+15 linhas (ADR-002..005), mover/renomear artefato no instalador (PRD-3), decidir `DESIGN.md`/`Pulse` (ADR-004/PRD-5), o segundo regex de A-3 (ADR-004) e qualquer alteração em `gate.js`.

## 10. Notas de correção do SDD (rodada 1 do review)

- **N1 — predicado divergia do contrato (C1/C2 do review).** Ver §2.3-bis: o código aceitava qualquer item de lista e nenhuma tabela, produzindo 308 prescrições onde o ADR media 91, e deixando a forma canônica de prescrever stack invisível ao guarda. Corrigido no predicado, não no número.
- **N2 — proibição avaliada por termo (C3).** `NEGATION` por caixa exata deixava `Não`/`Nunca`/`Evitar` escaparem; e o predicado antigo ("negação antes de **algum** termo") apagava prescrição em linha mista. Passa a ser por termo, insensível a caixa.
- **N3 — `license`/eixo não podem ser escusados por entrada `identity` da baseline (C4).** Era o único modo de o alarme criado para pegar `license: TaskFlow Security Standard` desligar-se justamente ali.
- **N4 — item 1: o módulo não importa `installer/` (C5).** `installer/` não propaga (`install.mjs:1689`), logo módulo que importa de lá morre no destino com `ERR_MODULE_NOT_FOUND`. A fonte de eixo é **injetada pelo adapter** (que roda neste repo); o módulo segue puro e importável no destino, mesmo que inerte.
- **N5 — linha de skill vendorizada não entra na baseline (C6).** `treeHash` congela bytes: baselinar linha vendorizada cria dívida **impagável** (editar quebra `vendor-skills --check`; upstream novo quebra `cdl-baseline-stale`). Vendorizada entra em **E-5** (upstream, fora de A-2), não em dívida.
- **N6 — `axis-class` é publicação, não veredito.** Confirmado pelo review (`declaredAxis` não recebe `axisClass`); segue como contador informativo.

- **N7 — números vivos ≠ números de §4.2 (drift declarado, oracle é o `V20`).** §4.2 publicou a medição da **rodada 2** (101 → 92; 77 `incondicional`). A rodada 3 (`§2.3-ter`) mudou o predicado e o resultado medido hoje é: `baseline=96 (incondicional=81, identity=15)`, `prescriptions=181 (44/39/17/81)`, `prohibition-cited=39`, `structural-debt=1`, `vendor-upstream=284/94`, **`heuristic=true fp=5/90 fn=4/90`** (amostra de 90 linhas sorteadas por `sha256("<arquivo>:<linha>")`; 42 receberam veredito; revisor único). O ADR **não** fixa número: fixa o predicado, e a linha do `V20` é o oráculo. Os ADRs 002–005 devem citar o número do `detail`, nunca este parágrafo.
- **N8 — FP/FN são parte do contrato, não desculpa.** O instrumento mede prosa com regex: `fp=5/90` (4 são a tabela de skills por stack de `workflow-rules.md`; 1 o padrão genérico de `database.md:56`) e `fn=4/90` (`orchestrator/AGENT.md:543` é dívida real; 3 são categoria — catálogo e um heading em CAIXA ALTA que não casa termo case-sensitive). A baseline é **dívida medida por este scanner**, com erro conhecido, e não "a verdade sobre o repo".
- **N9 — E-6 (escusa do `license`) não pina o valor.** A escusa morre quando a linha é corrigida, mas qualquer `license:` não-SPDX na mesma linha continua escusado (não compara `sha256` como a baseline). Declarado; fecha quando o ADR-003 corrigir o frontmatter de `security-review`.
