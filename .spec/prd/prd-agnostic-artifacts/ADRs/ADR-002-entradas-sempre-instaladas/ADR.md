# ADR-002 — Entradas sempre instaladas: prescrição de stack por eixo nomeado nas 2 entradas de `RULES_COMMON`, e autoria de `SPEC`/`PLAN`/`TASKS` dada por permissão **resolvida** (não declarada)

- **prd-id**: `prd-agnostic-artifacts` — `.spec/prd/prd-agnostic-artifacts/PRD.md`
- **order**: 2 de 5 (`.spec/prd/prd-agnostic-artifacts/ADR-INDEX.md`)
- **status**: `in-progress`
- **branch**: `adr/prd-agnostic-artifacts/02-entradas-sempre-instaladas` (de `main` @ `10f60f7`)
- **depende-de**: `ADR-001` — herda a **rubrica de 4 vereditos** (`condicional` \| `exemplo` \| `catálogo` \| `incondicional`, ADR-001 §2.3/§2.3-bis/§2.3-ter), a **baseline literal com `sha256` por linha** (§2.5), os **7 ids de falha** e o oráculo declarado em **§10-N7**: o número que vale é o da linha do `V20`, nunca o parágrafo de um ADR. Sem o ADR-001 não existe régua para dizer "esta linha saiu da dívida"; com ele, esta decisão é **aplicação**, não julgamento. Nenhum outro ADR é pré-requisito: o `ADR-003` (skills comuns + `spec-review`) e o `ADR-004`/`ADR-005` (paths, frota restante) recebem a prosa que este ADR **não** toca.
- **data**: 2026-11-12
- **dono da decisão**: owner do harness — portão **G1** (PRD §16, 2026-11-11). **D6**: *"`orchestrator` ganha `edit: allow` restrito a `.spec/**` (mesma forma de `product-manager`/`architect`/`qa-engineer`); para todo o resto segue `deny`"*. Requisitos que este ADR fecha: **RF-03** (classe (b) nas 2 entradas de `RULES_COMMON`) e **RF-06** (autoria de `SPEC`/`PLAN`/`TASKS` coerente com `permission.edit`).
- **rota**: refactor de governança com mecanismo (prosa + config; sem comportamento observável de produto ⇒ não gera PRD novo; `.agents/rules/prd-adr-pipeline.md` §3)
- **insumo de pesquisa**: `RESEARCH.md` §3 (tema A — A1 condição inline × A2 perfil × A3 core+override), §7 (tema E — E1/E2/E3, com a recomendação E3 e a ressalva de **ordem**), §8 (recomendação do ADR-002) e §9 (**R1** — ordem de permissão invertida mata o D6; **R3** — população por eixo tem duas leituras; **R4** — duas entradas em `protectedPaths`, dois trailers). `PRD.md` §3.1 (assimetria `RULES_COMMON` × `RULES_BY_AXIS`), §3.4 (#7), §3.5 (herança de autoria), §9 (RF-03/RF-06), §11 (condição no começo) e §16-D6.
- **escopo de escrita desta entrega**: `.spec/prd/prd-agnostic-artifacts/**` (`ADR.md` + 1 linha no `ADR-INDEX.md`). **Nenhum** arquivo de `.agents/**`, `opencode.json`, `installer/**`, `scripts/**`, `.opencode/plugins/**` ou `harness.config.json` foi tocado — a implementação é o SDD deste ADR.

## 1. Contexto

As duas entradas que vão a **todo** destino somam **658 linhas** e **16 das 96 entradas de baseline** do instrumento. Uma delas (`workflow-rules.md`) é o **maior ofensor isolado do repo** — 15 linhas `incondicional` num único arquivo — e a outra (`sdd-workflow-standard.md`) tem **uma** linha de identidade que resolve o problema mais caro do PRD pelo menor custo (PRD §3.4, #7: "1 termo, alcance máximo").

| Fato medido (2026-11-12, HEAD `10f60f7`) | Valor | Comando / fonte |
|---|---|---|
| `workflow-rules.md` em `RULES_COMMON` (vai a todo destino) | **sim** | `sed -n '380,387p' installer/install.mjs` ⇒ lista de 6, com `workflow-rules.md` e `sdd-workflow-standard.md` |
| Tamanho das 2 entradas | **608 + 50 = 658 l.** | `awk 'END{print NR}' .agents/rules/workflow-rules.md` ⇒ `608`; idem `sdd-workflow-standard.md` ⇒ `50` |
| `workflow-rules.md` — linhas `incondicional` | **15** (15/81 = 18,5% de toda a dívida `incondicional`; 15/96 = 15,6% da baseline) | `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.BASELINE.filter(e=>e.file.endsWith("workflow-rules.md")).map(e=>e.line).join(",")))'` ⇒ `217,218,219,225,435,436,440,441,442,446,558,559,560,561,563` |
| `workflow-rules.md` — arquivo com **mais** entradas de baseline no repo | **15** (2º lugar: `spec-review/assets/checklist.md`, 12) | dump por arquivo de `m.BASELINE` |
| `sdd-workflow-standard.md` — entradas de baseline | **1**, veredito `identity`, `owner: ADR-002` | `node -e '…m.BASELINE.filter(e=>e.file.includes("sdd-workflow-standard"))'` ⇒ `{line:3, verdict:"identity"}`; `sed -n '3p'` ⇒ "…(SDD) no projeto **Atlas ECM**" |
| `V20` (o oráculo) | `baseline=96 (incondicional=81, identity=15)`, `prescriptions=181 (44/39/17/81)`, `identity=15/12`, `prohibition-cited=39` | `node scripts/static-checks.mjs \| grep V20` |
| `orchestrator` — estado da permissão | `{"edit":"deny","bash":"allow"}` | `node -e 'console.log(JSON.stringify(require("./opencode.json").agent.orchestrator.permission))'` |
| `orchestrator` — o que o **runtime** resolve hoje | `[{edit,*,"deny"},{shell,*,"allow"}]` (o legado `permission.bash` vira a ação **`shell`**) | `opencode debug config \| node -e '…find(d.info.agents.orchestrator).permissions'` |
| Superfícies de prosa que **afirmam** `edit: deny` do orchestrator | **5**: `gate-contract.md:18` (I5), `orchestrator/AGENT.md:9,16,19,285` | `grep -rn 'permission.edit' .agents/rules .agents/agents` |
| Teste que assa a **forma** atual (`"deny"` string) | **1** (`config-dual-parity.spec.mjs:152-160`), dentro de `commands.suiteFull` | `node --test .opencode/plugins/__tests__/config-dual-parity.spec.mjs` |
| Entradas de baseline no `orchestrator/AGENT.md` | **9** (`36,158,323,500,501,502,503,504,619`) — nenhuma nas linhas 9/16/19/285 | dump de `m.BASELINE` filtrado |
| `commands.suiteFull` / selo | literal **inalterado** por este ADR | `node -e 'console.log(require("./harness.config.json").commands.suiteFull)'` |

**O defeito, dito sem retórica — três coisas, e a terceira é a que mata:**

1. **A instrução chega a todo destino e não se aplica a quase nenhum.** `workflow-rules.md` §5.1–5.4 prescreve `JUnit 5 + Mockito`, `@SpringBootTest`, `mvn test`, `mvn verify`, `Testcontainers`, `PostgreSQL`, `Flyway`, `Pinia`/`Vitest`/`npm` — em linha **sem gate** — para um harness cujo `harness.config.json.stack.backend` diz `N/A`. O agente do destino não pode "decidir se aplica" (PRD §11); ele obedece ou ignora, e as duas coisas são erradas.
2. **A dívida está concentrada onde o custo de corrigir é menor.** 15 das 81 linhas `incondicional` moram num arquivo só, e as 3 seções que as contêm já são **normativas por título** (`(obrigatório)`): falta **nomear o eixo**, não reescrever a regra. É o padrão que o repo já demonstrou correto em `sdd-compiler/references/backend.md:53` (`**Spring Boot**: Use…`).
3. **A herança de autoria é uma promessa que o runtime nega.** `orchestrator/AGENT.md:9,16,19` e `gate-contract.md:18` afirmam que `edit` é negado a ele — e o runtime confirma (`opencode debug config`). A mesma prosa lhe atribui a geração de `PLAN.md`/`TASKS.md` (`workflow-rules.md:214-215`) e `sdd-workflow-standard.md:16-18` a atribui a uma **skill** (que roda na sessão do chamador). Resultado medido: os 3 artefatos centrais não têm autor que possa escrever. **D6** nomeia o autor; o risco **R1** do `RESEARCH.md` diz como isso falha em silêncio: a doc do runtime é *"the last matching rule wins"* — se o `allow` vier antes do `deny *`, a negação vence e o papel continua sem escrever, **com a prosa dizendo que escreve**.

**O que este ADR não faz.** Não toca `gate.js` nem `harness.config.json` (PRD §7); não move artefato no instalador (A2 descartado — é PRD-3); não reescreve as skills comuns nem `spec-review` (ADR-003); não decide paths e `DESIGN.md` (ADR-004); não decide proibições, catálogo e skills por eixo (ADR-005); não cria o runner do destino (declarado em ADR-001-C7); e **não implementa** — o SDD é que edita prosa, config e baseline.

## 2. Decisão

**As 2 entradas de `RULES_COMMON` deixam de prescrever stack sem eixo: cada uma das 16 linhas de baseline recebe um veredito da rubrica do ADR-001 — `condicional` com o eixo nomeado no escopo, ou reescrita genérica que condiciona o comando ao `commands.*` do `harness.config.json` — e a autoria de `SPEC`/`PLAN`/`TASKS` passa a ser do `orchestrator` por uma regra de permissão ordenada `deny *` → `allow .spec/**`, cuja prova é a **resolução** que o runtime publica (`opencode debug config`), nunca a linha no JSON.** A decisão é o par (veredito por linha + permissão resolvida); as 16 instâncias, as 5 linhas de prosa de §2.3 e as 3 de §2.4 são **aplicação**.

### 2.1 As 15 linhas de `workflow-rules.md` — dois mecanismos, um critério

A rubrica já decidiu, para cada linha, **qual** dos dois mecanismos cabe. Nenhum deles é novo: os dois já existem no repo e já são reconhecidos pelo instrumento.

| Mecanismo | Predicado da rubrica (ADR-001 §2.3) | Onde se aplica aqui | Custo |
|---|---|---|---|
| **M1 — eixo nomeado no escopo** (heading delimitante ou gate explícito na linha) | passo 5: `scopeGate` — heading/ancestral/bullet que **nomeia eixo** (`namesAxis`) | §5.1, §5.2 e §5.3 (3 headings), e as 5 linhas da tabela de skills (§7) | **3 headings + 5 células + 1 item de lista**; o corpo de §5.1–§5.2 fica **intacto** (as 5 linhas 435/436/440/441/442 não são reescritas) |
| **M2 — comando resolvido do config** (reescrita genérica, veredito `null`) | passo 1: deixa de haver termo de stack na mesma cláusula | Fase 2 (itens 5–7) e Fase 3 (item 4): `mvn compile`, `mvn clean install`, `JUnit 5 + Mockito`, `*IT.java` | **4 linhas**; a obrigação continua explícita e o comando passa a vir de `harness.config.json` (ADR-003 do PRD-1, já a regra da casa em `harness-config.md`) |

**Por que M1 e não M2 nas seções 5.x.** O corpo de §5.1–§5.2 é específico de Java e **é útil** para um destino Java (`@ExtendWith`, `*IT.java`, `Testcontainers`); reescrevê-lo genérico destruiria o valor e cairia no risco **R2** do PRD ("agnóstico vira vazio"). O que falta ali não é conteúdo: é **declarar para quem**. Já nas Fases 2/3 a linha é **operacional** (`mvn compile`), e ali o genérico é estritamente melhor: o comando do destino está no `harness.config.json` dele.

**Por que a tabela de §7 é M1 e não M2.** As 5 linhas prescrevem "carregue a skill X" — o `Contexto` é exatamente o lugar onde o eixo pertence ("**Desenvolvimento Backend**" → "**Desenvolvimento Backend** (`backend=java`)"). A linha 562 (`frontend-vue-specialist`) **não** está na baseline porque a célula dela não tem termo — é um falso negativo declarado (ADR-001 §10-N8) que este ADR fecha na mesma passada, sem criar dívida (ver §4.3).

**Efeito mecânico, para o arquivo inteiro:** as 15 linhas saem da baseline **por mudança de veredito**, não por remoção da linha — e é exatamente isso que o instrumento exige (ADR-001 §2.5: entrada de baseline cujo veredito deixou de ser `incondicional` é `cdl-baseline-stale`, FAIL; a entrada **só pode** ser removida junto com a correção).

### 2.2 A permissão — a forma que resolve, a forma que mente, e a que apaga o prompt

O mecanismo nativo é permissão por **ação × caminho**, com **ordem**: "the last matching rule wins" (`RESEARCH.md` §7-E3, §9-R1). Três formas foram **medidas** em sonda fora do repo (`/tmp/opencode/permprobe`, `opencode debug config`, runtime v2.2.4) antes de escolher:

| Forma escrita | O que o runtime publica | Veredito |
|---|---|---|
| `agent.orchestrator.permission.edit: { "*": "deny", ".spec/**": "allow" }` + `bash: "allow"` | `[{edit,*,"deny"},{edit,".spec/**","allow"},{shell,*,"allow"}]` — **ordem preservada** | **escolhida** |
| idem com a ordem invertida (`{".spec/**":"allow","*":"deny"}`) | `[{edit,".spec/**","allow"},{edit,*,"deny"}]` — o `deny` é o **último** ⇒ nega | **fixture vermelha** (prova que o item de verificação detecta a inversão) |
| `agents.orchestrator.{description,prompt,permissions:[…]}` **coexistindo** com `agent.orchestrator` | a entrada de `agents` **substitui** a de `agent`: `system:""`, `description` e `mode` **perdidos** | **proibida** — apaga o prompt do orquestrador |
| `agent.orchestrator.permissions: […]` (array sob a chave singular) | campo **inerte** (cai em `request.body`, não é permissão) | **proibida** — `allow` fantasma |

**Decisão:** a permissão do `orchestrator` passa a ser **três regras ordenadas, nesta ordem**: `edit * deny` → `edit .spec/** allow` → `shell * allow`, escritas na forma legada aninhada (`permission.edit` objeto) porque o arquivo inteiro está nessa forma, `HARNESS_MANAGED_CONFIG_KEYS = ['agent','permission']` substitui o bloco gerenciado no merge do instalador (`install.mjs:860`) e a forma aninhada **é normalizada pelo runtime na ordem escrita** (medido). Migrar o arquivo inteiro para `agents` + `permissions` está fora deste ADR: quebraria o roster medido por `config-dual-parity.spec.mjs:121-146` e o merge do instalador, sem ganho de resolução.

**O que a permissão NÃO passa a permitir (declarado, não escondido):**

- `workflow-state.json` continua **negado** a `edit` (não está sob `.spec/`). A escrita de estado segue pela via `bash` — **evasão declarada** (`gate-contract.md` I5), com a decisão A/B/C aberta em `workflow-state.json.enforcement_status.pendente`. Este ADR **não** a resolve e **não** finge que resolveu.
- `.agents/**`, `opencode.json` e `harness.config.json` continuam negados a `edit` (e são `protectedPaths`): governança de regra não vira escrita livre de regra.
- `bash: allow` **não muda** — o que significa que o `deny` de `edit` continua sendo 🟠 intenção, não garantia, exatamente como hoje (`gate-contract.md` I5). O ADR troca a **prosa mentirosa** por uma permissão **que existe**; não promete isolamento que o runtime não dá.

### 2.3 A prosa que descreve a permissão — e por que ela entra neste ADR

Mudar a permissão e deixar a prosa afirmando o contrário é **abrir no vizinho de mesmo alcance**: `orchestrator/AGENT.md` é propagado (roster de 10) e `gate-contract.md` é `RULES_COMMON`. As 5 linhas que afirmam `edit: deny` para o orchestrator são, portanto, **consequência direta de D6** — não classe (b), não prosa alheia:

| Superfície | Linha | O que afirma | Alvo |
|---|---|---|---|
| `.agents/rules/gate-contract.md` | `18` (I5) | "**5 sem `edit`**: `orchestrator`/…" e o mecanismo `permission.edit: deny` | "**4 sem `edit`** … + `orchestrator` **com `edit` restrito a `.spec/**`** (`deny *` → `allow .spec/**`, ordem provada por resolução)"; a citação de mecanismo passa a ser a regra ordenada, mantendo a nota de que `bash` contorna (I5 continua 🟠, não 🟢) |
| `.agents/agents/orchestrator/AGENT.md` | `9` | "`permission.edit = "deny"`, logo a ação `edit` é negada … inclusive para `SPEC.md`, `PLAN.md` e `TASKS.md`" | a política **resolvida** e o autor: `edit` negado em `*`, **permitido** em `.spec/**`; os 3 artefatos passam a ter autor nomeado |
| idem | `16` | "o runtime **nega** a ação `edit` ao orchestrator" | idem — com o nível de garantia preservado (🟢 literal para a regra, 🟠 intenção para `bash`) |
| idem | `19` | "`permission.edit: deny` removeu a tool `edit`, então a escrita de governança acontece via `bash`" | a escrita de `.spec/**` volta à **via nativa**; `workflow-state.json`/`.agents/**` continuam pela via `bash` (evasão declarada) |
| idem | `285` | "Nenhum artefato de planejamento nasce no `orchestrator`, que não escreve (`permission.edit: deny`)" | o pai está correto por **decisão de papel** (o `planner` é autor dos 4 artefatos), não por permissão — a citação muda e a decisão fica |

**Restrição de forma (para não abrir dívida nova):** as 5 linhas são reescritas **em linha**, com contagem de linhas preservada. O `orchestrator/AGENT.md` tem **9** entradas de baseline em `36,158,323,500-504,619`; como nenhuma delas está nas linhas tocadas e nenhuma linha é inserida/removida, **nenhuma entrada se desloca** — é o mesmo cuidado que impede o ADR-005 de receber 9 `cdl-baseline-stale` de presente.

### 2.4 `sdd-workflow-standard.md:3` — a identidade sai, o `proof` morre junto, então ele muda de dono

A linha 3 é a única entrada de baseline desse arquivo: veredito **`identity`**, `owner: ADR-002` (ADR-001 §4.1). Ela delimita a norma inteira "no projeto **Atlas ECM**" — 1 termo, alcance máximo, custo mínimo (PRD §3.4 #7). **Veredito: reescrita genérica de escopo**, sem projeto: *"…para todo o ciclo de vida de desenvolvimento (SDD) no repositório que adota este harness."*

**A armadilha medida, que o ADR precisa declarar:** `PROJECT_TERMS` tem `{term:"Atlas ECM", proof:".agents/rules/sdd-workflow-standard.md:3", owner:"ADR-003"}`. O alarme `cdl-identity-term-stale` exige que o `proof` **cite o termo** (`.opencode/plugins/lib/cdl/checks.mjs:2002-2005`). Remover "Atlas ECM" da linha 3 **mata a prova** e deixa a suíte **vermelha** — sem que ninguém tenha mexido em identidade nenhuma de propósito. O termo, porém, **continua vivo** em duas linhas identitárias (`.agents/rules/frontend-coding-standards.md:154` e `frontend-react-coding-standards.md:161`, ambas `## Dependências Principais (Atlas ECM)`). **Decisão:** o SDD deste ADR **re-aponta** o `proof` para `.agents/rules/frontend-coding-standards.md:154`, mantendo `class: projeto` e `owner: ADR-003` (o dono da correção daquelas duas linhas continua o ADR-003). Nenhuma entrada de `PROJECT_TERMS` é removida por este ADR.

**Consequência de sequenciamento (declarada):** quando o ADR-003 remover as duas headings de frontend (D1: elas são gateadas por eixo, mas a identidade "Atlas ECM" sai mesmo assim), o termo `Atlas ECM` deixará de aparecer em **qualquer** posição identitária e a entrada de `PROJECT_TERMS` passa a ser removida — o ADR-003 herda essa obrigação por construção do mesmo alarme, não por gentileza.

**RF-06 neste arquivo.** As linhas `16-18` ("(gerada pelo `sdd-compiler`)") são a segunda metade da herança: atribuem a autoria a uma **skill** que roda na sessão do chamador. Com D6, o autor é a **sessão** que escreve — o `orchestrator` — e a skill é a metodologia. As três linhas passam a dizer as duas coisas, em linha, sem mudar a contagem do arquivo.

### 2.5 O que este ADR **deixa aberto**, com dono nomeado

| Aberto | Por que não é deste ADR | Dono |
|---|---|---|
| §5.1–§5.2 existem **só** para `backend=java`: `node`, `nestjs`, `rust` recebem a obrigação de testar (via `commands.*`) **sem** seção própria | criar seção por eixo é conteúdo novo de eixo — e o eixo novo nasce no PRD-4 | **PRD-4** (`prd-axes-split`) — declarado em §5.4 da regra |
| prosa de governança ainda é escrita por `bash` (`workflow-state.json`, `.agents/**`) | decisão A/B/C pendente em `workflow-state.json.enforcement_status`; este ADR não a antecipa | owner (pendência registrada) |
| as 25 skills vendorizadas e as 6 skills de stack por nome | E-3/E-5 e D8 | **ADR-003** / **ADR-005** |
| `commands.suiteFull` no **destino** (o `V20` não roda lá) | ADR-001-C7, já declarado | PRD-3 |

## 3. Interface congelada

Cada item é verificável por comando, da raiz do repo. Itens marcados *(SDD)* só valem depois da implementação; antes dela o comando mede o **estado atual**, e o valor esperado está anotado. Onde a verificação depende de sessão/leitura, o nível 🟡/🟠 está declarado — nenhum item se declara 🟢 por presença de texto.

1. **A permissão do `orchestrator` é resolvida — `deny` antes de `allow`, na ordem que o runtime publica.**
   *Verificação (SDD)*: `opencode debug config | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s).find(x=>x.info?.agents?.orchestrator).info.agents.orchestrator.permissions;console.log(JSON.stringify(d))})'` ⇒ exatamente `[{"action":"edit","resource":"*","effect":"deny"},{"action":"edit","resource":".spec/**","effect":"allow"},{"action":"shell","resource":"*","effect":"allow"}]`.
   Hoje ⇒ `[{"action":"edit","resource":"*","effect":"deny"},{"action":"shell","resource":"*","effect":"allow"}]` (medido). Nível: 🟢 para a **ordem publicada** (é saída do runtime, não leitura do JSON).

2. **A ordem não é vácuo: a inversão reprova.** O item 1 é uma asserção de **índice** (`index(deny*) < index(allow .spec/**)`), não de presença.
   *Verificação*: `opencode debug config | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).find(x=>x.info?.agents?.orchestrator).info.agents.orchestrator.permissions;const i=p.findIndex(r=>r.action==="edit"&&r.resource==="*"&&r.effect==="deny");const a=p.findIndex(r=>r.action==="edit"&&r.resource===".spec/**"&&r.effect==="allow");process.exit(i>=0&&a>i?0:1)})'` ⇒ exit `0`; **hoje** ⇒ exit `1` (medido: `i=0`, `a=-1` — a segunda regra não existe, logo o item não passa por vacuidade).
   *Fixtures vermelhas exigidas*: (a) objeto invertido (`{".spec/**":"allow","*":"deny"}`) ⇒ `a < i` ⇒ exit `1` (medido em sonda: o runtime preserva a ordem invertida); (b) `agents.orchestrator.permissions` **sem** `description`/`prompt` ⇒ a entrada **substitui** a legada e o orquestrador perde o `system` (medido: `system:""`) ⇒ reprova por perda de prompt, não por permissão.

3. **A resolução vale para o caminho real, não só para a regra (prova de escrita, uma vez).**
   A sessão do `orchestrator` executa, no SDD: (a) um `write` em `.spec/prd/prd-agnostic-artifacts/.probe/ok.md` ⇒ **sucede**; (b) um `write` em `.agents/rules/.probe.md` ⇒ **negado pelo runtime**; (c) os dois arquivos de sonda são removidos. Transcrição literal no `VERIFY.md`.
   *Verificação*: `git status --porcelain` ⇒ vazio ao final (as duas sondas não sobrevivem). Nível: 🟡 **processo, uma vez** — declarado como tal, não como garantia de runtime.

4. **`workflow-rules.md` não tem mais linha `incondicional`.** As 15 saem por mudança de veredito (§4.1), não por remoção de texto.
   *Verificação (SDD)*: `node --input-type=module -e 'const m=await import("./.opencode/plugins/lib/cdl/checks.mjs");const a=m.scanArtifact(process.cwd(),".agents/rules/workflow-rules.md");console.log(JSON.stringify(a.verdicts.filter(v=>v.verdict==="incondicional").map(v=>v.line)))'` ⇒ `[]`.
   Hoje ⇒ `[217,218,219,225,435,436,440,441,442,446,558,559,560,561,563]` (medido por comando).

5. **A baseline só encolhe — e o encolhimento é por arquivo, com `owner` intacto.** `BASELINE` passa de **96** para **80** entradas; as **15** de `workflow-rules.md` e a **1** de `sdd-workflow-standard.md` **desaparecem**; **nenhuma** entrada de nenhum outro arquivo muda de linha, hash ou veredito.
   *Verificação (SDD)*: `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>{const by={};for(const e of m.BASELINE)by[e.file]=(by[e.file]||0)+1;console.log(m.BASELINE.length, by[".agents/rules/workflow-rules.md"]??0, by[".agents/rules/sdd-workflow-standard.md"]??0)})'` ⇒ `80 0 0`.
   Hoje ⇒ `96 15 1`. *Contraprova de não-regressão nos vizinhos*: o dump por arquivo antes e depois preserva as **27** chaves restantes com os mesmos totais — mapa medido hoje, que o SDD tem de reproduzir linha a linha (o comando está em §7):
   `3 code-reviewer/PROMPT.md · 2 design-system-specialist/AGENT.md · 5 developer-engineer/AGENT.md · 9 orchestrator/AGENT.md · 2 ux-designer/AGENT.md · 2 dev-planner/SKILL.md · 1 harness-installer/SKILL.md · 1 nestjs-architecture-specialist/SKILL.md · 1 node-architecture-specialist/SKILL.md · 1 prompt-optimizer/references/clarifying-questions.md · 1 sdd-architecture-board/SKILL.md · 1 sdd-compiler/asserts/spec-gate.md · 1 sdd-compiler/references/backend.md · 2 sdd-compiler/references/database.md · 1 sdd-compiler/references/frontend.md · 4 security-review/SKILL.md · 9 spec-review/README.md · 7 spec-review/SKILL.md · 12 spec-review/assets/checklist.md · 1 spec-review/assets/output-template.md · 4 spec-review/assets/usage-guide.md · 1 template-best-practices/SKILL.md · 2 template-structure/SKILL.md · 3 @rule-axis:frontend=react#0 · 2 @rule-axis:frontend=vue#0 · 1 docs/INSTALACAO.md · 1 spec-developed.md` (soma **80**).
   Nível: 🟢 para "entrada removida"; 🟠 para "nada cresceu em arquivo vizinho" (coberto pelo id de falha nº 1 no arquivo vizinho, não por auditoria visual).

6. **Nada `incondicional` novo nasce — em nenhum arquivo.** A garantia não é o número: é o par de modos de falha do ADR-001 §2.5.
   *Verificação*: `node scripts/static-checks.mjs | grep V20` ⇒ `PASS` com `baseline=80` e **sem** `cdl-unconditional-unbaselined`/`cdl-baseline-stale`/`cdl-exception-stale` em FAIL; *fixture vermelha*: acrescentar uma linha prescritiva com termo em `workflow-rules.md` (ex.: `- Use `Spring` sempre`) ⇒ `cdl-unconditional-unbaselined` FAIL; apagar a linha de uma entrada de baseline ⇒ `cdl-baseline-stale` FAIL.

7. **Nenhuma das 20 linhas tocadas em `workflow-rules.md` vira `null` por acidente: o veredito alvo é declarado linha a linha e o diff é exato.** O arquivo **não muda de tamanho** e o diff toca **exatamente** as linhas de §4.1–§4.3 (15 dívida + 4 de apoio + 1 de §4.3) — logo, nenhuma outra linha muda de veredito sem estar na tabela.
   *Verificação (SDD)*: `awk 'END{print NR}' .agents/rules/workflow-rules.md` ⇒ `608` (igual a hoje); `git diff --numstat -- .agents/rules/workflow-rules.md` ⇒ `20	20	.agents/rules/workflow-rules.md` (20 substituições em linha, **zero** inserções/remoções líquidas); `git diff -U0 -- .agents/rules/workflow-rules.md | grep -c '^@@'` ⇒ `11` (11 hunks: `217-219`, `225`, `431`, `435-436`, `438`, `440-442`, `444`, `446`, `448`, `558-561`, `562-563`).
   Nível: 🟡 (é revisão de diff assistida por contagem, não instrumento).

8. **A identidade "Atlas ECM" sai de `sdd-workflow-standard.md:3` sem matar o alarme.** A linha deixa de ser posição identitária e `PROJECT_TERMS["Atlas ECM"].proof` é re-apontado para uma prova **viva**.
   *Verificação (SDD)*: `sed -n '3p' .agents/rules/sdd-workflow-standard.md` ⇒ sem `Atlas ECM`; `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(JSON.stringify(m.PROJECT_TERMS.find(p=>p.term==="Atlas ECM"))))'` ⇒ `proof` aponta para linha que contém o termo; `node scripts/static-checks.mjs | grep V20` ⇒ `identity=14/11` (hoje `15/12`) e `cdl-identity-term-stale` **PASS**.

9. **RF-06: a prosa não atribui a geração a papel com `edit: deny`, e o autor nomeado é o que pode escrever.**
   *Verificação (SDD)*: `sed -n '16,18p' .agents/rules/sdd-workflow-standard.md` ⇒ cada linha nomeia `sdd-compiler` **e** a sessão que escreve (`orchestrator`); `grep -rn 'permission.edit = "deny"\|permission.edit: deny' .agents/rules .agents/agents | wc -l` ⇒ `0`; `grep -c '4 sem `edit`' .agents/rules/gate-contract.md` ⇒ `1`; `sed -n '9p;16p;19p;285p' .agents/agents/orchestrator/AGENT.md` ⇒ nenhuma afirma negação total de `edit`, todas citam `.spec/**` **e** o nível de garantia.
   Nível: 🟢 para o `grep`; 🟡 para "a prosa está coerente" (leitura humana no review).

10. **A contagem de linhas do `orchestrator/AGENT.md` é preservada, para não deslocar as 9 entradas de baseline do arquivo** (owner ADR-005).
    *Verificação (SDD)*: `awk 'END{print NR}' .agents/agents/orchestrator/AGENT.md` ⇒ `682`; `git diff --numstat -- .agents/agents/orchestrator/AGENT.md` ⇒ `4	4`; `node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.BASELINE.filter(e=>e.file===".agents/agents/orchestrator/AGENT.md").map(e=>e.line).join(",")))'` ⇒ `36,158,323,500,501,502,503,504,619` (idêntico a hoje).

11. **O teste que assa a forma antiga passa a assar a **resolução**, e a suíte completa continua verde.** `config-dual-parity.spec.mjs:152-160` hoje compara `permission.edit === "deny"` (string). O SDD o substitui por: (a) forma ordenada (`Object.keys(edit)` = `["*", ".spec/**"]`), (b) resolvedor de duas linhas com a semântica documentada ("last match wins") sobre **três** caminhos de sonda: `.spec/prd/x/ADR.md` ⇒ `allow`, `.agents/rules/x.md` ⇒ `deny`, `harness.config.json` ⇒ `deny`. O roster (10 agentes) e a presença de `permission` em todo agente **não** mudam.
    *Verificação (SDD)*: `node --test .opencode/plugins/__tests__/config-dual-parity.spec.mjs` ⇒ 0 fail; `node --test ".opencode/plugins/__tests__/*.spec.mjs"` ⇒ 0 fail.

12. **Instalador e selo: zero comando novo, zero republicação.** `commands.suiteFull` literalmente inalterado, `harness.config.json` e `seal.mjs` sem diff, `installer/**` sem diff. O efeito no destino é **de conteúdo**, pela substituição já existente do bloco gerenciado (`HARNESS_MANAGED_CONFIG_KEYS`, `install.mjs:860`) — `opencode.json` é payload (`install.mjs:1690`) e a prosa das rules/agentes também; o **mecanismo** de instalação não muda.
    *Verificação*: `git diff --exit-code -- harness.config.json .opencode/plugins/lib/seal.mjs installer/` ⇒ vazio; `node -e 'console.log(require("./harness.config.json").commands.suiteFull)'` ⇒ literal atual; `node --test "installer/__tests__/*.spec.mjs"` ⇒ 0 fail.

13. **Este ADR está fora do corpus do instrumento, e o batch só escreve em `.spec/prd/**`.**
    *Verificação*: `node scripts/static-checks.mjs` ⇒ exit `0` com `PASS ADR-01` e `PASS ADR-02` **não-vacuosos** (2 linhas, 2 dirs); `git show --stat --name-only HEAD` ⇒ `ADR-INDEX.md` + `ADRs/ADR-002-entradas-sempre-instaladas/ADR.md`; `.spec/**` é exclusão X1 (ADR-001 §2.1), logo a auto-aplicação é a mesma do ADR-001.

## 4. Aplicação — o que a régua diz hoje

Regra de leitura: **veredito hoje** é o medido (`V20`/`BASELINE`, HEAD `10f60f7`); **alvo** é o veredito do ADR-001 §2.3 que a linha passa a ter; **prova** é o comando. Nenhuma linha é "caso especial".

### 4.1 As 15 linhas de `workflow-rules.md` (dívida)

| `arquivo:linha` | Hoje | Alvo | Ação (rubrica) | Verificação |
|---|---|---|---|---|
| `.agents/rules/workflow-rules.md:217` | `incondicional` | `null` (genérica) | reescrever: "escrever **testes unitários** do eixo declarado — §5.1–§5.3 por eixo; `commands.unit`" | `termsOf` não casa termo ⇒ `classifyLine` `null` |
| `:218` | `incondicional` | `null` | idem para integração: sem `*IT.java`/`integration-test`; `commands.integration` | idem |
| `:219` | `incondicional` | `null` | trocar `mvn compile` por "comando de build do eixo (`commands.*` de `harness.config.json`)" | idem |
| `:225` | `incondicional` | `null` | trocar `mvn clean install` por `commands.suiteFull` (zero erros) | idem |
| `:435` | `incondicional` | `condicional` | M1 — heading `431` passa a `## 5.1 Backend (Java) — …` (`namesAxis`) | `sed -n '431p'` + item 4 |
| `:436` | `incondicional` | `condicional` | M1 — mesmo heading | idem |
| `:440` | `incondicional` | `condicional` | M1 — heading `438` passa a `## 5.2 Backend (Java) — …` | idem |
| `:441` | `incondicional` | `condicional` | M1 — mesmo heading | idem |
| `:442` | `incondicional` | `condicional` | M1 — mesmo heading | idem |
| `:446` | `incondicional` | `condicional` | M1 — heading `444` passa a `## 5.3 Frontend (Vue/React) — …` **e** a linha vira item de lista (`- **Obrigatório**: …`), porque hoje é parágrafo sem marcador normativo próprio | idem |
| `:558` | `incondicional` | `condicional` | M1 — gate na célula de Contexto: `**Desenvolvimento Backend** (backend=java)` | `explicitGate` casa `backend=java` |
| `:559` | `incondicional` | `condicional` | M1 — `(backend=nestjs)` | idem |
| `:560` | `incondicional` | `condicional` | M1 — `(backend=node)` | idem |
| `:561` | `incondicional` | `condicional` | M1 — `(backend=rust)` | idem |
| `:563` | `incondicional` | `condicional` | M1 — `(frontend=react)` | idem |

**Total: 15 linhas / 1 arquivo** — 11 por M1 (6 de corpo + 5 de tabela) + 4 por M2. Os dois lados foram **medidos** com o `classifyLine` do próprio instrumento sobre o texto proposto: `condicional` em 435/436/440/441/442/446/558/559/560/561/563 e `null` em 217/218/219/225. Nenhuma linha fica em `incondicional`.

### 4.2 As 4 linhas de `workflow-rules.md` que a rubrica **não** deixa para trás

| `arquivo:linha` | Por que existe a edição | Verificação |
|---|---|---|
| `:431`, `:438`, `:444` | headings que **nomeiam o eixo** — é o mecanismo M1; sem eles o corpo de §5.1–5.3 continua `incondicional` | `sed -n '431p;438p;444p'` ⇒ cada um casa `Java`/`Vue`/`React`; item 4 ⇒ `[]` |
| `:448` | acrescentar **uma frase** à "Regra Geral": eixos sem seção própria resolvem por `commands.*` — fecha o buraco do §2.5 sem criar seção | `termsOf` sobre a linha nova ⇒ `[]`; `classifyLine` ⇒ `null` (não cresce baseline) |

### 4.3 As 2 linhas de apoio (dívida **zero**, mesmo alcance)

| `arquivo:linha` | Hoje | Alvo | Por que entra | Verificação |
|---|---|---|---|---|
| `.agents/rules/workflow-rules.md:562` | `null` (sem termo) | `condicional` | **falso negativo declarado** (ADR-001 §10-N8): a linha Vue prescreve uma skill de stack sem citar a stack. Com o gate `frontend=vue` na célula de Contexto e "Componentes **Vue**" no corpo, a linha passa a ser legível pela régua — e, como o alvo é `condicional`, **não** cria entrada de baseline | `classifyLine` ⇒ `condicional`; item 5 ⇒ `80 0 0` (não sobe para 81) |
| `.agents/rules/sdd-workflow-standard.md:3` | `identity` | `null` | identidade "Atlas ECM" (§2.4) | item 8 |

### 4.4 A config, as 4 linhas de prosa, os 2 artefatos do instrumento e o teste

| Alvo | O que muda | Verificação |
|---|---|---|
| `opencode.json` (`agent.orchestrator.permission.edit`) | string `"deny"` → objeto ordenado `{"*":"deny",".spec/**":"allow"}` | itens 1–2 |
| `.agents/rules/gate-contract.md:18` | I5: 4 sem `edit` + orchestrator com escopo `.spec/**`; mecanismo citado por resolução | item 9 |
| `.agents/agents/orchestrator/AGENT.md:9,16,19,285` | política resolvida + autor nomeado | itens 9–10 |
| `.agents/rules/sdd-workflow-standard.md:16-18` | autor: skill **na sessão** do orchestrator | item 9 |
| `.opencode/plugins/lib/cdl/checks.mjs` — `BASELINE` | −15 (`workflow-rules.md`) −1 (`sdd-workflow-standard.md`) | item 5 |
| `.opencode/plugins/lib/cdl/checks.mjs` — `PROJECT_TERMS` | `Atlas ECM.proof` → `.agents/rules/frontend-coding-standards.md:154` | item 8 |
| `.opencode/plugins/__tests__/config-dual-parity.spec.mjs:152-160` | asserção de forma → asserção de **resolução** (3 caminhos) | item 11 |

> Nota de escopo: 2 arquivos do instrumento (baseline e `PROJECT_TERMS`) entram porque **o instrumento se mantém pela remoção da dívida que ele mede** (ADR-001 §2.5: "1 remoção quando a dívida fecha"). Nenhum predicado, veredito, id de falha ou exceção é alterado — `git diff` do módulo deve mostrar **só** as 16 entradas removidas e 1 linha de `proof`.

## 5. Consequências

- **C1 — o destino recebe menos norma inaplicável, não menos norma.** §5.1–5.2 continuam prescritivas **e úteis** para um destino Java; para os demais eixos, o comando vem do `harness.config.json` do destino — que é a regra que o repo já escreveu na `harness-config.md`. É a mitigação direta do R2 ("agnóstico vira vazio").
- **C2 — o D6 deixa de ser promessa.** Antes: `edit` negado e prosa dizendo que a escrita é via `bash`. Depois: `.spec/**` liberado ao `edit`, **resolvido** pelo runtime, e o resto igual. A melhora é verificável por um comando que **mostra a ordem**, não a linha.
- **C3 — a dívida fecha com 1 remoção por linha e nenhuma linha nova.** 16 entradas de baseline a menos; zero `incondicional` novo (modo de falha nº 1); nenhuma linha "vazia" (§4.1 alvo declarado, `null` só onde o termo sai **com** a obrigação mantida).
- **C4 — custo de gate declarado.** `R4` do `RESEARCH.md` se confirma: `.agents/rules/**`, `.agents/agents/**`, `opencode.json` e `.opencode/plugins/**` são `protectedPaths` ⇒ **um** trailer `Harness-Gate-Change` no PR do SDD, com revisão de path protegido. Não é bloqueio; é o preço de mexer no que nega.
- **C5 — a prosa de permissão fica com uma fonte só.** As 5 superfícies passam a descrever a mesma política resolvida; hoje descrevem o oposto dela em 3 lugares (`AGENT.md:9,16`, `gate-contract.md:18`) e o parcial em 2 (`:19`, `:285`).
- **C6 — 🟠 escape declarado (dois, os mesmos dos precedentes).** (a) `bash: allow` continua podendo escrever fora de `.spec/**`: o `deny` de `edit` é **intenção**, não isolamento (`gate-contract.md` I5/I7). (b) `scripts/static-checks.mjs` não é `protectedPaths`: remover a chamada de `checkCdl()` desliga o `V20` sem trailer (ADR-001-C7). Nenhum dos dois é resolvido aqui, e nenhum é mascarado.
- **C7 — o `V20` não garante monotonicidade histórica.** Ele não guarda época: garante que (i) toda linha `incondicional` está na baseline e (ii) toda entrada de baseline corresponde a uma linha `incondicional` viva. "Só encolhe" é a consequência combinada dos dois — quem quiser o histórico olha o `git log` do módulo. Declarado para não vender garantia que o instrumento não dá.

## 6. Alternativas descartadas

| Alternativa | Custo medido neste repo | Por que não |
|---|---|---|
| **A2 — mover §5.1–5.4 para artefato gateado por eixo** (`RULES_BY_AXIS`) | 1 mapa novo + `install.mjs` editado + 12 presets a revalidar + selo republicado | `RULES_BY_AXIS` não tem eixo de teste, a criação é trabalho de mapa do PRD-3 e o PRD §7 proíbe tocar `installer/` neste ciclo. Deferido com dono, nunca como efeito colateral. |
| **A3 — core + override do destino** (a rule lê `stack.*`) | 1 convenção nova + 1 leitor; hoje **nenhuma** rule lê `harness.config.json` | Melhor desenho a prazo, mas exige um leitor de config na prosa — mecanismo que não existe e que não cabe num ADR de prosa. Fica como direção declarada (§8-N4). |
| **A4 — manter como está + exceção declarada** | 0 arquivo | Mantém 15 linhas de dívida no maior ofensor e o sintoma do `FU-47`; M-2 do PRD não fecha e este PRD não teria ADR-002. |
| **M2 nas seções 5.1–5.3** (reescrever tudo genérico) | 6 linhas a mais reescritas, ~0 ganho | Destrói especificidade útil (R2 do PRD) e não muda o veredito de mais nada: as mesmas 15 linhas já saem da baseline por M1 com **3 headings**. |
| **M1 nas Fases 2/3** (nomear o eixo no heading da fase) | 2 headings ("Fase 2 (Java)") | As Fases 2/3 do SDD **não são** sobre Java — são sobre o ciclo; nomear Java no heading tornaria o workflow condicional a uma stack. Ali o certo é o comando vir do config. |
| **Migrar `opencode.json` inteiro para `agents` + `permissions`** (v2 canônico) | 10 agentes + renomear `bash`→`shell` + reescrever `config-dual-parity` e os testes de merge do instalador | Ganho **zero** de resolução (a forma aninhada é normalizada na mesma ordem — medido) e risco alto: a mesma chave `agents.orchestrator` **substitui** o bloco legado e apaga `prompt`/`description` (medido: `system:""`). |
| **`edit: "allow"` global no orchestrator** (a opção A antiga de `enforcement_status`) | 1 string | Dá ao papel escrita em **código** — exatamente a violação registrada em 2026-08-06 que a regra existe para impedir. D6 escolheu o escopo por isso. |
| **Confiar na prosa para autorizar a escrita** (sem mudar `opencode.json`) | 0 config | É o estado atual: prosa atribui, runtime nega, 3 artefatos sem autor. Trocaria 1 mentira por 1 mentira com mais passos. |
| **Verificar a permissão lendo o JSON** | 0 | É o defeito R1: `"deny"` presente e `allow` depois ⇒ negação vence. Presença ≠ resolução; o item 1 exige a **ordem publicada** pelo runtime e o item 2 exige o **índice**. |

## 7. Critérios de verificação

**Re-derivação do contexto (rodar antes do SDD; tem de bater com §1/§4):**

```sh
# as 15 linhas da dívida e o arquivo com mais entradas
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>{
  const w=m.BASELINE.filter(e=>e.file.endsWith("workflow-rules.md"));
  console.log(w.length, w.map(e=>e.line).join(","));
  console.log(m.BASELINE.filter(e=>e.file.includes("sdd-workflow-standard")).map(e=>e.line+":"+e.verdict));
  console.log("total", m.BASELINE.length);})'                                  # 15 217,218,… | 3:identity | 96

# o oráculo
node scripts/static-checks.mjs | grep -E '^(PASS|FAIL) V20'

# permissão como o runtime a resolve HOJE (estado a mudar)
opencode debug config | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  console.log(JSON.stringify(JSON.parse(s).find(x=>x.info?.agents?.orchestrator).info.agents.orchestrator.permissions))})'

# as 5 superfícies de prosa que afirmam o contrário
grep -rn 'permission.edit' .agents/rules .agents/agents | cut -c1-110

# a prova de PROJECT_TERMS que morre se a linha 3 for reescrita sem re-apontar
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(JSON.stringify(m.PROJECT_TERMS.find(p=>p.term==="Atlas ECM"))))'

# o mapa por arquivo da baseline (é o que o item 5 exige preservar, menos as 2 chaves deste ADR)
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>{const by={};for(const e of m.BASELINE)by[e.file]=(by[e.file]||0)+1;
  const ent=Object.entries(by).filter(([k])=>!k.endsWith("workflow-rules.md")&&!k.endsWith("sdd-workflow-standard.md")).sort();
  console.log(ent.map(([k,v])=>v+" "+k).join("\n"));console.log("keys",ent.length,"sum",ent.reduce((a,[,v])=>a+v,0))})'   # 27 chaves / 80
```

**Aceite do SDD deste ADR** (cada bloco mapeia para um item de §3):

```sh
# IF-1 / IF-2: permissão resolvida e ordem não-vacuosa
opencode debug config | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const p=JSON.parse(s).find(x=>x.info?.agents?.orchestrator).info.agents.orchestrator.permissions;
  console.log(JSON.stringify(p));
  const i=p.findIndex(r=>r.action==="edit"&&r.resource==="*"&&r.effect==="deny");
  const a=p.findIndex(r=>r.action==="edit"&&r.resource===".spec/**"&&r.effect==="allow");
  process.exit(i>=0&&a>i?0:1)})'; echo $?                                    # ordem ok ⇒ 0

# IF-4 / IF-5 / IF-6: dívida zerada, baseline só encolhe, nada novo nasce
node --input-type=module -e 'const m=await import("./.opencode/plugins/lib/cdl/checks.mjs");
 const a=m.scanArtifact(process.cwd(),".agents/rules/workflow-rules.md");
 console.log("incondicional:", JSON.stringify(a.verdicts.filter(v=>v.verdict==="incondicional").map(v=>v.line)));
 const by={};for(const e of m.BASELINE)by[e.file]=(by[e.file]||0)+1;
 console.log("baseline:", m.BASELINE.length, "wf:", by[".agents/rules/workflow-rules.md"]??0, "sdd-std:", by[".agents/rules/sdd-workflow-standard.md"]??0)'   # [] 80 0 0
node scripts/static-checks.mjs; echo $?                                      # 0
node scripts/static-checks.mjs | grep -E 'V20|ADR-0'                          # PASS, baseline=80

# IF-7 / IF-10: contagem de linhas e diff exato (nada muda de veredito fora da tabela)
awk 'END{print NR}' .agents/rules/workflow-rules.md                            # 608
git diff --numstat -- .agents/rules/workflow-rules.md                          # 20	20
awk 'END{print NR}' .agents/agents/orchestrator/AGENT.md                       # 682
git diff --numstat -- .agents/agents/orchestrator/AGENT.md                     # 4	4
git diff --numstat -- .agents/rules/sdd-workflow-standard.md                   # 4	4
git diff --numstat -- .agents/rules/gate-contract.md                           # 1	1

# IF-8 / IF-9: identidade e autoria
sed -n '3p' .agents/rules/sdd-workflow-standard.md                            # sem "Atlas ECM"
node -e 'import("./.opencode/plugins/lib/cdl/checks.mjs").then(m=>console.log(m.PROJECT_TERMS.find(p=>p.term==="Atlas ECM").proof))'
grep -rn 'permission.edit = "deny"\|permission.edit: deny' .agents/rules .agents/agents | wc -l   # 0

# IF-11: teste de permissão assa a resolução; suíte completa verde
node --test .opencode/plugins/__tests__/config-dual-parity.spec.mjs
node --test ".opencode/plugins/__tests__/*.spec.mjs"

# IF-12: instalador e selo intocados
git diff --exit-code -- harness.config.json .opencode/plugins/lib/seal.mjs installer/
node -e 'console.log(require("./harness.config.json").commands.suiteFull)'
node --test "installer/__tests__/*.spec.mjs"

# IF-13: batch só em .spec/prd/**
git show --stat --name-only HEAD
```

**Fora do aceite deste ADR (declarado):** criar seção de teste para `node`/`nestjs`/`rust` (PRD-4), mover §5.x para eixo (PRD-3), corrigir as 6 skills de stack e as 25 vendorizadas (ADR-003/ADR-005), `DESIGN.md` (ADR-004) e qualquer alteração em `gate.js`.

## 8. Notas de correção (divergências medidas)

- **N1 — o ADR-001 §4.2 publicou 4 linhas em `workflow-rules.md`; o `V20` publica 15.** O §4.2 é a medição da **rodada 2** (`:435,:436,:440,:442`); a rodada 3 (`§2.3-ter`) mudou o predicado e a linha do `V20` em 2026-11-12 mede **15** no mesmo arquivo (`217,218,219,225,435,436,440,441,442,446,558,559,560,561,563`). Pela regra do §10-N7, **o oráculo é a linha do `V20`** — este ADR aplica 15, não 4, e a diferença não é drift escondido: é a regra funcionando.
- **N2 — `workflow-rules.md` tem 608 linhas, não 609.** `PRD.md` §3.1 e §3.3 medem 609; `awk 'END{print NR}'` ⇒ `608` (o número do PRD veio do `wc -l` da versão anterior a uma edição). O número que este ADR usa é o medido, e é ele que o item 7 preserva.
- **N3 — o `edit: deny` do `orchestrator` é hoje `deny` string, e o runtime já o normaliza.** `opencode debug config` publica `[{edit,*,"deny"},{shell,*,"allow"}]` a partir de `{"edit":"deny","bash":"allow"}` — ou seja, o config **já** é lido como regra ordenada; o que falta é a segunda regra. Isso reduz o risco do D6: não há migração de formato, só uma regra a mais (medido).
- **N4 — A3 (core + override) é direção, não mecanismo deste ciclo.** Nenhuma rule lê `harness.config.json` hoje; escrever A3 aqui exigiria um leitor de config na prosa do destino — mecanismo que não existe. Fica declarado como a forma-alvo do ADR que tocar o instalador (PRD-3), sem virar promessa de prosa.
- **N5 — `PROJECT_TERMS["Atlas ECM"].owner` é `ADR-003` e a baseline de `sdd-workflow-standard.md:3` é `ADR-002`.** A divergência de dono é real e **não** é erro de digitação: o termo tem 3 provas em 2 arquivos com donos diferentes. Este ADR corrige **a linha que é dele** e re-aponta a prova; a entrada do termo só morre quando o ADR-003 fechar as duas headings de frontend. Registrado para que ninguém "conserte" o `owner` no meio do caminho.
- **N6 — 5 superfícies de prosa, não 2.** O PRD §9-RF-06 nomeia `workflow-rules.md:214-215` e `sdd-workflow-standard.md:16-18`; a varredura por `permission.edit` encontra **5** linhas que afirmam o estado a mudar (`gate-contract.md:18`, `orchestrator/AGENT.md:9,16,19,285`). Corrigir só as 2 nomeadas deixaria o repo com a prosa do agente contradizendo a permissão **no artefato que o agente lê como system prompt** — o defeito que este ADR existe para não cometer.

## 9. O que fica para o SDD deste ADR

Nesta ordem:

1. **`opencode.json`** — `agent.orchestrator.permission.edit` de `"deny"` para `{"*": "deny", ".spec/**": "allow"}`; `bash: "allow"` **inalterado**; nenhum outro agente tocado; nenhuma outra chave do arquivo tocada.
2. **`.agents/rules/workflow-rules.md`** — as 20 substituições em linha de §4.1–§4.3 (15 dívida + 3 headings + 1 frase de §5.4 + 1 linha 562), **sem** inserir/remover linha.
3. **`.agents/rules/sdd-workflow-standard.md`** — linha 3 genérica (identidade) e linhas 16-18 com autor nomeado; **50 linhas preservadas**.
4. **`.agents/agents/orchestrator/AGENT.md`** — linhas 9, 16, 19, 285 com a política resolvida; **682 linhas preservadas**.
5. **`.agents/rules/gate-contract.md`** — linha 18 (I5) com 4 sem `edit` + orchestrator com escopo, mecanismo citado por resolução; **59 linhas preservadas**.
6. **`.opencode/plugins/lib/cdl/checks.mjs`** — remover as 16 entradas de `BASELINE` (15 + 1) e re-apontar `PROJECT_TERMS["Atlas ECM"].proof`; **nenhuma** mudança de predicado, `VERDICTS`, `EXCEPTIONS` ou id de falha.
7. **`.opencode/plugins/__tests__/config-dual-parity.spec.mjs`** — o teste `I3/RF-03` passa a assar forma ordenada + resolução em 3 caminhos; roster e presença de `permission` intactos.
8. **Rodar o harness completo** — `commands.suiteFull` (testes de plugin, testes do instalador, static-checks, vendor-check) e `node scripts/sdd-checks.mjs`; `VERIFY.md` com as 3 dimensões e, no item de interface 3, a transcrição da sonda de escrita permitida/negada.
9. **PR do SDD** — trailer `Harness-Gate-Change` (4 paths protegidos), `git diff --exit-code -- harness.config.json .opencode/plugins/lib/seal.mjs installer/`, e a URL de compare impressa (merge é humano — `.agents/rules/prd-adr-pipeline.md` §4).

**Fora do SDD (declarado):** seção de teste por eixo para `node`/`nestjs`/`rust` (PRD-4), mapa novo no instalador (PRD-3), `spec-review` e as 6 skills de stack (ADR-003), paths e `DESIGN.md` (ADR-004), proibições/catálogo (ADR-005), e `gate.js` (byte-idêntico).
