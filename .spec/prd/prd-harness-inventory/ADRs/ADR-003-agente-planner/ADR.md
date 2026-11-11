# ADR-003 — Agente `planner` (`subagent`, consome a skill `dev-planner`): papel de planejamento com escrita limitada a 4 artefatos do ciclo SDD e zero poder de decisão

- **prd-id**: `prd-harness-inventory` — `.spec/prd/prd-harness-inventory/PRD.md`
- **order**: 3 de 5 (`.spec/prd/prd-harness-inventory/ADR-INDEX.md`)
- **status**: `in-progress`
- **branch**: `adr/prd-harness-inventory/03-agente-planner` (criada de `main` @ `67e8162`)
- **depende-de**: `ADR-001` — o `planner` entra no roster que o ADR-001 define (1 primário, 8 subagentes, 1 mandato por papel) e herda a decisão de **primário único**: o `planner` é `subagent` porque `primary` já é do `orchestrator`. Nenhum outro ADR é pré-requisito.
- **data**: 2026-11-11
- **dono da decisão**: owner do harness — portão **G1**, `PRD.md` §16, decisão **D6** (`planner`, modo `subagent`, **consome** a skill `dev-planner`). Nome e modo **não são reabertos aqui**; este ADR decide o que sobrou: artefatos que o papel escreve, permissão, fronteira contra 4 vizinhos e forma de registro.
- **rota**: Feature (papel novo) dentro do refactor do roster
- **insumo de pesquisa**: `RESEARCH.md` §5 (tema C, alternativas C1–C3), §8 (linha do ADR-003) e §9 (riscos **R3** e **R6**)
- **escopo de escrita desta entrega**: `.spec/prd/prd-harness-inventory/**`. Nenhum `AGENT.md`, `opencode.json`, rule, skill, plugin ou script foi editado — a implementação é o SDD deste ADR.

## 1. Contexto

A prosa do harness invoca um papel de planejamento que **não existe**, e a metodologia que ele deveria executar existe e **não tem consumidor**. Os dois fatos são independentes e medidos:

| Fato medido (2026-11-11, pós-merge `67e8162`) | Valor | Comando / fonte |
|---|---|---|
| Citações vivas de `planejador` em `.agents/**` | **2** — `.agents/agents/qa-engineer/AGENT.md:9`, `.agents/rules/sdd-workflow-standard.md:50` | `grep -rn "planejador" .agents/` |
| Agentes que citam a skill `dev-planner` | **0** | `grep -rl dev-planner .agents/agents/ \| wc -l` |
| Tamanho da metodologia órfã | **247 linhas**, 6 fases (`Fase 0 — Descoberta` … `Fase 5 — Validação`), 5 artefatos declarados | `wc -l .agents/skills/dev-planner/SKILL.md`; `grep -c "^### Fase"` ⇒ `6` |
| Agentes registrados em `opencode.json` / diretórios em `.agents/agents/` | **9 / 9** (paridade pós-ADR-001) | `node -e 'Object.keys(require("./opencode.json").agent).length'`; `ls -d .agents/agents/*/ \| wc -l` |
| `edit: allow` | **4** — `architect`, `developer-engineer`, `product-manager`, `qa-engineer` | `node -e '…filter(v=>v.permission?.edit==="allow")'` |
| `AGENT.md` somados | **8 arquivos / 1.553 linhas** (o `code-reviewer` registra `PROMPT.md`) | `wc -l .agents/agents/*/AGENT.md` |
| `KNOWN_AGENTS` (`gate.js:635-643`) | 6 nomes + `unknown`; **3** dos 9 registrados já caem em `unknown` (`product-manager`, `architect`, `security-engineer`) | leitura de `gate.js:635-646` + cruzamento com `opencode.json` |
| Colisão de path `PLAN.md` | a skill declara `PLAN.md` como **seu** artefato (`SKILL.md:139`, `:161`); a regra canônica atribui `PLAN.md` ao `sdd-compiler` (`sdd-workflow-standard.md` §1/§2) | `grep -n "PLAN\.md" .agents/skills/dev-planner/SKILL.md` ⇒ **2 ocorrências** |

O defeito que motiva o papel, dito sem retórica: **o harness manda planejar e não tem a quem mandar.** A prosa cita `planejador` (2×), a skill que ensina a planejar tem 247 linhas e 0 consumidores (medido), e o planejamento que acontece de fato está diluído no `orchestrator` Fase 2 (`workflow-rules.md:174-198`). O `PRD.md` §10 exige, como história de usuário, *"existe um papel nomeado que produz o plano antes da SPEC, e esse papel não emite PRD nem decide ADR"*, e o `RF-05` exige fronteira escrita contra 4 vizinhos.

**O que este ADR não faz.** Não reabre `D6` (nome `planner`, modo `subagent`); não migra o formato de registro para V2 (`R3`); não altera `gate.js` (path protegido, `FU-65`); não reclassifica `prd-adr-pipeline` (ADR-002); não trata inventário derivado (ADR-004) nem prosa órfã fora das 2 citações (ADR-005/PRD 2); não cria `AGENT.md` nem entrada em `opencode.json` neste batch.

## 2. Decisão

**O roster de 9 do ADR-001 passa a 10: entra `planner`, `subagent`, que consome a skill `dev-planner` — e o papel tem escrita limitada a 4 documentos de planejamento do ciclo SDD, nenhum deles com poder de decisão.**

O papel, por inteiro:

| Dimensão | Decisão |
|---|---|
| Nome / modo | `planner` / `subagent` (fixado em D6; herda primário único do ADR-001) |
| Metodologia | **consumida** da skill `dev-planner` (SSoT do método). O `AGENT.md` do agente é **fino** (≤ 60 linhas): fronteira, artefatos, handoff, Brain — nenhuma fase F0–F5 reescrita |
| Escreve | exatamente **4** arquivos, no diretório do ciclo SDD `.spec/{backend\|frontend}/{feature}/`: `EXPLORATION.md`, `CONSTRAINTS.md`, `DESIGN-DECISIONS.md`, `ARCHITECTURE.md` |
| **Não** escreve | `PLAN.md` (do `sdd-compiler`), `SPEC.md`/`TASKS.md` (do `sdd-compiler`), `PRD.md` (do `product-manager`), `ADR.md`/`ADR-INDEX.md` (do `architect`), `workflow-state.json` (do orquestrador), qualquer path de `harness.config.json.protectedPaths` |
| Permissão | `permission.edit = "allow"` no `opencode.json` (é o que torna os 4 artefatos possíveis) — conjunto `edit: allow` vai de **4 para 5** |
| Registro | shape **homogêneo legado** dos outros 9 (`agent.<nome>.prompt` = string `{file:…}` + `permission`), porque misturar um 2º formato no mesmo arquivo é justamente o risco `R3` |
| Resultado esperado (RF-05) | antes de qualquer `SPEC.md`, o ciclo tem um pacote de planejamento legível (4 arquivos) + parecer de viabilidade com estimativa e riscos |
| Métrica | `grep -rl dev-planner .agents/agents/ \| wc -l` = **0 → 1**; `grep -rn "planejador" .agents/` = **0**; `PLAN.md` escrito por 1 só autor |

### 2.1 Fronteira — 4 vizinhos, cada um com artefato e "não faz"

O critério de fronteira é **artefato de saída**, não descrição de intenção: se dois papéis produzem o mesmo arquivo, um dos dois está sobrando.

| Vizinho | Produz (artefato) | O `planner` **não faz** |
|---|---|---|
| **`product-manager`** | `.spec/prd/{prd-id}/PRD.md` — o **quê** e o **por quê**: problema, escopo, aceite, risco de produto | Não escreve nem edita `PRD.md`; não define escopo de negócio, critério de aceite nem abre `prd-id`. Consome o PRD aprovado como **entrada** |
| **`architect`** | `ADRs/ADR-00N-{slug}/ADR.md` + linha no `ADR-INDEX.md` — a **decisão** (status, `depende-de`, interface congelada) | Não decide ADR: `DESIGN-DECISIONS.md` é **alternativas + trade-off + recomendação**, sem `status`, sem `depende-de`, sem interface congelada; não cria `ADRs/**` nem edita o índice |
| **`sdd-compiler`** (skill, operada pelo `orchestrator`) | `SPEC.md`, `PLAN.md`, `TASKS.md` do ciclo | Não gera `SPEC.md`, `PLAN.md` nem `TASKS.md`; não marca checkbox de task; **não escreve `PLAN.md`** — a colisão de path (§1) é resolvida a favor de um autor só |
| **skill `dev-planner`** | `.agents/skills/dev-planner/SKILL.md` — a **metodologia** (F0 Descubra → F5 Valide, princípios, checklists, `websearch`) | Não duplica as fases no `AGENT.md` (0 ocorrências de `Fase N —` e de `websearch`), não edita a skill em runtime e não substitui o método por prosa própria |

**Por que o `planner` existe, então — e por que isso não é "padrão de mercado".** O `RESEARCH.md` §9-**R6** mostra que Kiro (S6), spec-kit (S4) e o `plan` nativo (S1) tratam planejamento como **fase** ou como agente **primário** nativo; nenhum dos três publica um roster com papel de planejamento como subagente. O papel se sustenta por **dívida local medida**, e só por ela: (a) 247 linhas de metodologia sem 1 consumidor; (b) prosa que invoca um papel inexistente — correção que herda 1 das 2 citações (§3, item 9); (c) `PRD.md` §10/RF-05 exigem papel **nomeado** com artefato. Se qualquer um dos três desaparecesse, a alternativa C2 voltaria a ser a mais barata.

## 3. Interface congelada

Cada item é verificável por comando. Nenhum item depende de leitura subjetiva de prosa.

1. **`opencode.json.agent` passa a ter exatamente 10 chaves** — as 9 do ADR-001 mais `planner`. Continua **1** `mode: "primary"` (`orchestrator`); `planner` é `subagent`.
   *Verificação*: `node -e 'const k=Object.keys(require("./opencode.json").agent).sort();console.log(k.length,k.join(","))'` ⇒ `10 …`; `node -e 'const a=require("./opencode.json").agent;console.log(Object.values(a).filter(v=>v.mode==="primary").length)'` ⇒ `1`; `require("./opencode.json").agent.planner.mode` ⇒ `"subagent"`.

2. **Registro do `planner` no shape homogêneo legado** — `prompt` é a **string** `{file:./.agents/agents/planner/AGENT.md}`, `description` é string não vazia, `permission` é objeto. Nenhum campo V2 (`agents`, `system`, `permissions`) é introduzido; a migração de formato fica aberta (risco `R3`, §5).
   *Verificação*: `node -e 'const p=require("./opencode.json").agent.planner;console.log(typeof p.prompt, p.prompt, typeof p.description, p.description.length>0, typeof p.permission)'` ⇒ `string {file:./.agents/agents/planner/AGENT.md} string true object`; `node -e 'console.log(Object.keys(require("./opencode.json")))'` ⇒ sem `agents`/`system`.

3. **`edit: allow` do `planner`; conjunto 4 → 5** — `architect`, `developer-engineer`, `planner`, `product-manager`, `qa-engineer`. Os 5 restantes (`orchestrator`, `code-reviewer`, `security-engineer`, `ux-designer`, `design-system-specialist`) continuam `deny`.
   *Verificação*: `node -e 'const a=require("./opencode.json").agent;console.log(Object.entries(a).filter(([,v])=>v.permission?.edit==="allow").map(([k])=>k).sort().join(","))'` ⇒ `architect,developer-engineer,planner,product-manager,qa-engineer`; o mesmo filtro com `"deny"` ⇒ `5` nomes, sem `planner`.

4. **A `description` carrega as 4 fronteiras pelos nomes** — S1 é explícito: o modelo escolhe o subagente pela `description`, não pelo corpo do prompt. Logo a fronteira tem de caber onde a escolha é feita.
   *Verificação*: `node -e 'const d=require("./opencode.json").agent.planner.description;for(const t of ["product-manager","architect","sdd-compiler","dev-planner"])console.log(t,d.includes(t))'` ⇒ `true` nos quatro.

5. **`AGENT.md` fino e sem método duplicado** — ≤ 60 linhas; cita a skill `dev-planner` pelo nome (consumo, não cópia); **0** ocorrências do título de fase e de `websearch`.
   *Verificação*: `wc -l < .agents/agents/planner/AGENT.md` ⇒ `≤60`; `grep -cF "dev-planner" .agents/agents/planner/AGENT.md` ⇒ `≥1`; `grep -cE "^### Fase [0-5]" .agents/agents/planner/AGENT.md` ⇒ `0`; `grep -c "websearch" .agents/agents/planner/AGENT.md` ⇒ `0`.

6. **A fronteira está escrita como "não faz" explícito, 1 por vizinho** — é o RF-05 e a razão de o papel não ser redundante.
   *Verificação*: `grep -c "não faz" .agents/agents/planner/AGENT.md` ⇒ `≥4`; e cada um dos 4 nomes aparece **na mesma linha ou na linha imediatamente anterior** a um "não faz" (`grep -n -A1 -B1` conferido na revisão do SDD).

7. **Escrita = exatamente 4 basenames, com raiz declarada** — `EXPLORATION.md`, `CONSTRAINTS.md`, `DESIGN-DECISIONS.md`, `ARCHITECTURE.md`, todos sob `.spec/(backend|frontend)/{feature}/`. Qualquer outro alvo é violação declarada do contrato (🟡 prosa — ver §4, C2).
   *Verificação*: `for f in EXPLORATION CONSTRAINTS DESIGN-DECISIONS ARCHITECTURE; do grep -cF "$f.md" .agents/agents/planner/AGENT.md; done` ⇒ `≥1` em cada (4/4); `grep -cE "\.spec/(backend|frontend)/" .agents/agents/planner/AGENT.md` ⇒ `≥1` (corrigido: parênteses **não** são escapados em ERE — N13).

8. **`PLAN.md` não é do `planner` — 1 autor por path** — `grep -cE "PLAN\.md" .agents/agents/planner/AGENT.md` ⇒ **0**; a skill deixa de listá-lo (`grep -c "PLAN\.md" .agents/skills/dev-planner/SKILL.md` ⇒ **0**, hoje `2`, em `:139` e `:161`); a regra canônica que atribui `PLAN.md` ao `sdd-compiler` **não é editada**. O quinto produto da skill (estimativa/riscos, `Fase 4`/`Fase 5`) passa a ser **parecer no retorno do subagente**, não arquivo.
   *Verificação*: os 2 `grep -c` acima ⇒ `0` e `0`, **e** `grep -rc "PLAN\.md" .agents/skills/dev-planner/` ⇒ **0 em todo o diretório** (não só no `SKILL.md` — N14) e `grep -c "PLAN\.md" .agents/rules/workflow-rules.md` ⇒ **0** fora da menção ao `sdd-compiler`; a atribuição de `PLAN.md` em `.agents/rules/sdd-workflow-standard.md` §1/§2 permanece **byte-idêntica** — `git diff -U0 5c9bbc0..HEAD -- .agents/rules/sdd-workflow-standard.md` mostra **um único hunk, na linha 50** (§5), que é a edição autorizada pelo item 9 (N12).

9. **As 2 citações vivas de `planejador` são reivindicadas — 1 pelo papel, 1 pelo orquestrador** (a 3ª morreu com o `sdd-orquestrador` no ADR-001). Detalhe e justificativa em §8-N2; resultado: `grep -rn "planejador" .agents/` ⇒ **0**.
   *Verificação*: `grep -c "planejador" .agents/agents/qa-engineer/AGENT.md .agents/rules/sdd-workflow-standard.md` ⇒ `0 0`; `sed -n '9p' .agents/agents/qa-engineer/AGENT.md` contém `orchestrator`; `sed -n '50p' .agents/rules/sdd-workflow-standard.md` contém `planner` e `Fase 5`/`Valide`.

10. **`DESIGN-DECISIONS.md` não é ADR** — o contrato do `planner` não contém os marcadores que fazem um documento ser decisão neste repo, **e as duas fontes que o agente é obrigado a obedecer deixam de autorizar decisão**: `.agents/rules/workflow-rules.md:184` não manda mais "registrar ADRs" e `.agents/skills/dev-planner/SKILL.md:159` não rotula mais o artefato como "(ADRs)" (N15).
    *Verificação*: `grep -c "depende-de" .agents/agents/planner/AGENT.md` ⇒ `0`; `grep -ci "interface congelada" .agents/agents/planner/AGENT.md` ⇒ `0`; `grep -c "ADR" .agents/agents/planner/AGENT.md` ⇒ `≥1` (a fronteira **nomeia** o vizinho — proibir a palavra proibiria a fronteira).

11. **`gate.js` byte-idêntico e sem nome `planner`** — nenhum branch novo de escrita é criado para o papel. `planner` não é `developer-engineer`, não é `orchestrator`, não é `qa-engineer` e não está na lista de deny por papel (`gate.js:653-682`), logo o gate **não** restringe o alvo dele além de `protectedPaths` — consequência declarada em §4-C2, não corrigida aqui.
    *Verificação*: `git diff --stat .opencode/plugins/gate.js` ⇒ vazio no commit do SDD; `grep -c "planner" .opencode/plugins/gate.js` ⇒ `0`.

12. **Efeito em `KNOWN_AGENTS` (`FU-65`) declarado, não decidido** — `sanitizeAgent("planner")` devolve `"unknown"` por construção (`gate.js:645-646`), porque `planner` não está no enum de 6 nomes (`gate.js:635-643`). Efeito: `DenyError.details.agent` do `planner` sai como `unknown`; **veredito de gate não muda** (o enum é higiene de log, I10). Hoje 3 dos 9 caem em `unknown`; com o `planner` passam a ser 4 de 10. `FU-65` permanece aberto e P3.
    *Verificação*: `grep -c "planner" .opencode/plugins/gate.js` ⇒ `0`; `sed -n '635,646p' .opencode/plugins/gate.js` na revisão (enum de 6 + `unknown`); `node -e 'const a=require("./opencode.json").agent;const k=["orchestrator","developer-engineer","qa-engineer","code-reviewer","ux-designer","design-system-specialist"];console.log(Object.keys(a).filter(n=>!k.includes(n)).sort().join(","))'` ⇒ `architect,planner,product-manager,security-engineer` (4).

13. **Paridade registro↔disco 10/10** — `ls -d .agents/agents/*/` devolve **10** diretórios, conjunto idêntico às 10 chaves; `.agents/agents/planner/` tem `AGENT.md`.
    *Verificação*: `ls -d .agents/agents/*/ | wc -l` ⇒ `10`; `test -f .agents/agents/planner/AGENT.md && echo OK` ⇒ `OK`; `diff <(ls -d .agents/agents/*/ | xargs -n1 basename | sort) <(node -e 'console.log(Object.keys(require("./opencode.json").agent).sort().join("\n"))')` ⇒ vazio.

14. **O teste de paridade do roster acompanha (consequência direta, não gate)** — `config-dual-parity.spec.mjs:124-137` assere o **conjunto literal** de 9 (`assert.deepEqual`), comentado no próprio arquivo como "`length === 9` stays green on a silent swap". O literal ganha `planner` (10 nomes). Sem isso a suíte de plugins fica vermelha — e é o único teste que precisa mudar.
    *Verificação*: `grep -c '"planner"' .opencode/plugins/__tests__/config-dual-parity.spec.mjs` ⇒ `1`; `node --test ".opencode/plugins/__tests__/config-dual-parity.spec.mjs"` ⇒ 0 fail.

15. **Instalador intocado** — `.agents/agents` propaga como **camada inteira** (`installer/install.mjs:103`), então o `planner` chega ao destino sem mapa por agente; e a skill consumida já está em `SKILLS_COMMON` (`installer/install.mjs:409`), então o destino recebe agente **e** metodologia sem 1 byte de instalador.
    *Verificação*: `git diff --stat installer/` ⇒ vazio no commit do SDD; `node -e 'import("./installer/install.mjs").then(m=>console.log(m.SKILLS_COMMON.includes("dev-planner")))'` ⇒ `true`.

16. **`commands.suiteFull` e selo intactos; suíte completa verde** — nenhum comando novo entra na suíte, portanto o selo `HARNESS_SEAL_JSON` não é republicado (`harness-config.md` §"Command seal"; risco R5 do ADR-001).
    *Verificação*: `git diff --stat harness.config.json` ⇒ vazio; `node --test ".opencode/plugins/__tests__/*.spec.mjs" && node --test "installer/__tests__/*.spec.mjs" && node scripts/static-checks.mjs && node scripts/vendor-skills.mjs --check` ⇒ exit 0; `node scripts/sdd-checks.mjs` ⇒ 0 FAIL.

## 4. Consequências

- **C1 — Roster 9 → 10 agentes, 1 mandato a mais, 0 papéis sobrepostos.** O `planner` é o único papel cujo produto são os 4 documentos de planejamento; a paridade registro↔disco do ADR-001 continua em 0 divergências.
- **C2 — `edit: allow` vai de 4 para 5, e o escopo dos 4 caminhos é 🟡 prosa.** `opencode.json` é permissão grosseira (SPEC §2): `allow` não expressa "só `EXPLORATION.md`…". Na camada nativa o `planner` pode escrever qualquer path **não protegido**; `gate.js:657-666` só barra `protectedPaths` (`.agents/rules/**`, `.agents/agents/**`, `opencode.json`, `harness.config.json`, `.opencode/plugins/**`, `.github/workflows/**`, `.githooks/**`) e só isenta `developer-engineer`. Concretamente: `scripts/**`, `docs/**`, `installer/**` e `src/**` são alcançáveis pelo `planner`. Mesma aspereza que `product-manager` e `architect` já têm hoje. **Não é criado branch de gate** (path protegido + `FU-65` aberto); a mitigação é a allowlist numérica do item 7 (verificável no contrato) + PR humano.
- **C3 — `KNOWN_AGENTS` perde mais 1 nome de atribuição.** 3 → 4 agentes em `unknown` nos `DenyError.details`. Nenhum veredito muda; a lacuna é do `FU-65` e continua P3.
- **C4 — a skill `dev-planner` ganha seu primeiro consumidor** (`grep -rl dev-planner .agents/agents/`: `0 → 1`). Ela deixa de ser órfã sem virar papel: 1 SSoT de método, 1 prompt fino, 0 duplicação.
- **C5 — colisão `PLAN.md` eliminada, com perda declarada.** O `planner` deixa de emitir o 5º artefato como arquivo; estimativa e riscos viram parecer no retorno. Ganho: 1 autor por path. Custo: o handoff estimativa→`PLAN.md` passa por texto do subagente em vez de arquivo (o `sdd-compiler` segue lendo `SPEC.md`, não `PLAN.md`, como hoje).
- **C6 — o repo-destino herda o papel e a metodologia juntos**, sem edição de instalador (`install.mjs:103` + `:409`). Nenhum mapa `AGENTS_BY_AXIS` é necessário — não existe hoje e este ADR não cria.
- **C7 — registro legado permanece 10/10.** O arquivo passa a ter 10 entradas no shape documentado como legado em V2. Misturar formatos seria pior que a dívida; a migração é de outro ciclo (`R3`).
- **C8 — o `planner` não roda em bugfix.** A própria skill declara "NÃO use para bugfix simples" (`SKILL.md:109-116`); a fronteira com o fluxo de 4 fases (`workflow-rules.md` §4) é o não-uso, não uma regra nova.

## 5. Riscos herdados do `RESEARCH.md` §9

| # | Como se aplica a este ADR | Estado |
|---|---|---|
| **R3 — formato V2 de registro** | Este ADR **adiciona 1 chave no formato legado** (`agent.planner.prompt` string + `permission`), para não criar 2 formatos no mesmo arquivo (item 2). O item 2 do ADR-001 já declarou a dívida. A migração (`agents`/`system`/`permissions`) **não é decidida aqui** e exige confirmação do runtime instalado. Custo aceito e medido: o `opencode.json` fica 10/10 legado. | herdado, **não acionado** |
| **R6 — sem precedente de mercado para "papel de planejamento no roster"** | Kiro (S4/S6) e spec-kit tratam planejamento como **fase**; o `plan` nativo (S1) é **primário** — e é exatamente o que C3 tentaria, descartado pelo ADR-001. **Este ADR não justifica o papel por padrão de mercado.** A justificativa é a dívida local de §1 (skill 247 linhas com 0 consumidores + 2 citações órfãs + `PRD.md` §10/RF-05) e o custo é pago por ela: se a dívida sumir, C2 volta a ser a alternativa correta. | herdado, **declarado como limite** |
| **R2 — divergências de contagem** | `PRD.md` §16-D6 e §1 dizem "3 citações"; medido pós-ADR-001: **2** (a 3ª era `sdd-orquestrador/AGENT.md:98`, apagado). Ver §8-N1. | **herdado e corrigido aqui** |
| **R7 — enum de `status`** | A linha do ADR-003 usa `in-progress` (enum `todo\|in-progress\|merged\|dropped`, `checks.mjs:47`). `proposed` não existe. | fechado por construção |
| **R8 — índice↔disco** | A linha entra no **mesmo commit** do `ADR.md` (padrão da casa, `ADR-01` exige 1:1). O `ADR-002` é promovido a `merged` (`67e8162`) para não haver 2 `in-progress` (`checks.mjs:378-379`). | fechado por construção |
| **R1 / R5** | R1 é do ADR-002 (propagação do instalador) e R5 é do ADR-004 (selo). O item 15 e o item 16 existem para provar que **nada** disso muda aqui. | herdados, **não acionados** |

## 6. Alternativas descartadas

`C1` é a decisão (§2), fixada em D6 — não é reaberta; entra na tabela com o custo que ela **de fato** cobra. `C2`/`C3` vêm do `RESEARCH.md` §5. `C4` é a alternativa que **este** ADR teve de decidir (a pergunta que D6 deixou aberta: o que o papel escreve).

| Alternativa | Custo | Por que foi descartada |
|---|---|---|
| **C1 — `planner` `subagent` que consome `dev-planner`** *(adotada)* | 1 `AGENT.md` ≤60 l. + 1 chave em `opencode.json` + 2 citações tratadas + 1 linha no `config-dual-parity.spec.mjs`; e a dívida de `edit: allow` grosseiro (C2) | Adotada por D6. Paga-se por: papel endereçável (`@planner`) com metodologia em 1 SSoT, sem segundo primário. **Custo de oportunidade declarado:** +1 hop de subagente (child session) antes da SPEC. |
| **C2 — sem agente novo: `plan` como fase do `orchestrator` com a skill** | 0 arquivo de agente; +1 seção de prosa no prompt de 678 linhas do `orchestrator` | Menor custo absoluto e é o que Kiro/spec-kit fazem (S4/S6). **Reprova** `RF-05` (papel *nomeado* com artefato próprio), mantém as 2 citações órfãs mentindo e mantém a skill com 0 consumidores — ou seja, não fecha a dívida que motiva a decisão. Descartada por D6. |
| **C3 — `planner` como `primary`**, espelhando o `plan` nativo | 1 agente + 1 entrada; sessão passa a exigir escolha de primário | Precedente nativo forte (S1), mas cria **segundo primário** — precisamente o defeito que o ADR-001 removeu (`sdd-orquestrador`). Duas portas de entrada para o mesmo fluxo e desambiguação de "qual primário" na prosa de 2 rules. Descartada por D6 e por coerência com ADR-001. |
| **C4 — `planner` com `edit: "deny"`** (decisão **deste** ADR, não do RESEARCH) | 0 risco de escrita indevida; mas os 4 artefatos não têm autor: `orchestrator` é `edit: deny` nativo, e reabrir isso seria reabrir a tabela do ADR-001 | Torna o papel um **parecer falado**: o pacote de planejamento morre no transcript e o `sdd-compiler` recebe prosa de segunda mão. Contradiz `RF-05` ("artefato produzido") e o `PRD.md` §10. Descartada porque a dívida a pagar é justamente *"a metodologia de 247 linhas não vira artefato"*. |

## 7. Critérios de verificação

Todos os comandos rodam da raiz do repo, com `harness.config.json` inalterado.

**Item 0 — re-derivação do contexto (RF-07).** Deve reproduzir §1 antes do SDD:

```sh
grep -rn "planejador" .agents/                                  # 2 ocorrências / 2 arquivos
grep -rl dev-planner .agents/agents/ | wc -l                     # 0
wc -l .agents/skills/dev-planner/SKILL.md                        # 247
ls -d .agents/agents/*/ | wc -l                                  # 9
node -e 'console.log(Object.keys(require("./opencode.json").agent).length)'   # 9
grep -n "PLAN\.md" .agents/skills/dev-planner/SKILL.md           # :139 e :161
```

**Critérios de aceite do SDD deste ADR** (cada um mapeia para um item de §3):

```sh
# itens 1-3: roster 10, subagent, 1 primário, allow 4->5
node -e 'const a=require("./opencode.json").agent;const k=Object.keys(a).sort();
console.log(k.length,k.join(","));
console.log("primary:",Object.values(a).filter(v=>v.mode==="primary").length);
console.log("edit:",a.planner.permission.edit)'                              # 10 … / primary: 1 / edit: allow
node -e 'const a=require("./opencode.json").agent;console.log(Object.entries(a).filter(([,v])=>v.permission?.edit==="allow").map(([k])=>k).sort().join(","))'
# => architect,developer-engineer,planner,product-manager,qa-engineer

# itens 2 e 4: shape homogêneo + fronteira na description
node -e 'const p=require("./opencode.json").agent.planner;console.log(p.prompt==="{file:./.agents/agents/planner/AGENT.md}",typeof p.description,p.permission.edit)'
node -e 'const d=require("./opencode.json").agent.planner.description;for(const t of ["product-manager","architect","sdd-compiler","dev-planner"])console.log(t,d.includes(t))'

# itens 5-8, 10: prompt fino, fronteira, 4 artefatos, PLAN.md fora, sem marcador de ADR
wc -l < .agents/agents/planner/AGENT.md                                     # <=60
grep -cF "dev-planner" .agents/agents/planner/AGENT.md                      # >=1
grep -cE "^### Fase [0-5]" .agents/agents/planner/AGENT.md                  # 0
grep -c "websearch" .agents/agents/planner/AGENT.md                         # 0
grep -c "não faz" .agents/agents/planner/AGENT.md                           # >=4
for f in EXPLORATION CONSTRAINTS DESIGN-DECISIONS ARCHITECTURE; do grep -cF "$f.md" .agents/agents/planner/AGENT.md; done   # 4x >=1
grep -cE "PLAN\.md" .agents/agents/planner/AGENT.md                         # 0
grep -c "PLAN\.md" .agents/skills/dev-planner/SKILL.md                      # 0 (hoje 2)
grep -c "depende-de" .agents/agents/planner/AGENT.md                        # 0
grep -ci "interface congelada" .agents/agents/planner/AGENT.md              # 0

# item 9: as 2 citações
grep -rn "planejador" .agents/                                              # vazio
sed -n '9p'  .agents/agents/qa-engineer/AGENT.md                            # contém "orchestrator"
sed -n '50p' .agents/rules/sdd-workflow-standard.md                         # contém "planner" + Fase 5

# itens 11-13: gate intocado, KNOWN_AGENTS como consequência, paridade
git diff --stat .opencode/plugins/gate.js                                   # vazio
grep -c "planner" .opencode/plugins/gate.js                                 # 0
node -e 'const a=require("./opencode.json").agent;const k=["orchestrator","developer-engineer","qa-engineer","code-reviewer","ux-designer","design-system-specialist"];console.log(Object.keys(a).filter(n=>!k.includes(n)).sort().join(","))'
# => architect,planner,product-manager,security-engineer  (4 caem em unknown)
ls -d .agents/agents/*/ | wc -l                                             # 10
test -f .agents/agents/planner/AGENT.md && echo OK

# itens 14-16: teste de paridade, instalador, selo
grep -c '"planner"' .opencode/plugins/__tests__/config-dual-parity.spec.mjs  # 1
git diff --stat installer/ harness.config.json                              # vazio
node --test ".opencode/plugins/__tests__/*.spec.mjs" \
  && node --test "installer/__tests__/*.spec.mjs" \
  && node scripts/static-checks.mjs \
  && node scripts/vendor-skills.mjs --check                                 # exit 0
node scripts/sdd-checks.mjs                                                 # 0 FAIL
```

**Ordem de merge.** `ADR-003` depende de `ADR-001` (roster e primário único). `ADR-002` já está `merged` (`67e8162`), o que também libera o `slot` único de `in-progress` do índice (`checks.mjs:378-379`).

## 8. Notas de correção (divergências medidas entre PRD/RESEARCH e disco)

- **N1 — "3 citações" → 2.** `PRD.md` §1/§16-D6 e `RESEARCH.md` §5 dizem 3; a 3ª era `.agents/agents/sdd-orquestrador/AGENT.md:98`, apagado pelo ADR-001 (`67e8162` é posterior). Medido hoje: **2 ocorrências em 2 arquivos** (`grep -rn "planejador" .agents/`). `workflow-state.json:1093` e `harness/harness-inventory-adr-002.json:205` também contêm a palavra, mas são **registro datado** (decisão D6 e relatório de evidência do ciclo anterior), não prosa que manda alguém fazer algo — pela convenção do `N7` do ADR-001, não são referências vivas.
- **N2 — as 2 citações não são a mesma coisa; só 1 é do `planner`.**
  - `.agents/rules/sdd-workflow-standard.md:50` — *"Ao concluir as TASKS, o `planejador` deve consolidar a análise e as lições aprendidas no brain"*. O **sujeito** é o papel de planejamento (a skill `dev-planner` já exige "decisões registradas no Brain" no checklist dela); o **gatilho** está errado: um papel que roda antes da SPEC não "conclui as TASKS". Disposição: **reivindicada** — sujeito vira `planner`, gatilho vira a conclusão do planejamento (`Fase 5 — Valide`). A consolidação de lições *do ciclo* continua sendo do orquestrador (`workflow-rules.md` §0.1) — não é a mesma nota.
  - `.agents/agents/qa-engineer/AGENT.md:9` — *"Este agente é acionado na Fase 7 (Quality Gate) via `@planejador`"*. Isto **não** descreve planejamento: descreve quem dispara o QA. Reapontar para `planner` manteria a frase falsa (o `planner` não aciona QA em fase nenhuma). Disposição: **não reivindicada pelo `planner`**; o token `planejador` sai e o invocador correto (`orchestrator`) entra. Justificativa registrada aqui porque o `RF-03` exige classificação, não reapontamento cego — e o `PRD.md` §16-D6 fala em *reapontar as 3*, o que só era verdadeiro enquanto o `sdd-orquestrador` tinha uma delas.
- **N3 — a skill lista um artefato que não pode ser do papel.** `SKILL.md:139` e `:161` põem `PLAN.md` na saída do `dev-planner`; `sdd-workflow-standard.md` §1/§2 põem `PLAN.md` na saída do `sdd-compiler`. Dois autores, um path. A interface resolve a favor do `sdd-compiler` (item 8) e o SDD corrige as 2 linhas da skill. **Desvio declarado do insumo** (a skill é mais velha que o ADR-001 e nunca teve consumidor, então a colisão nunca doeu).
- **N4 — `FU-65` está desatualizado em 1 unidade.** O texto diz "4 registrados caem em unknown"; após o ADR-001 são **3** (`codebase-analyzer` saiu do roster). Com o `planner`: **4 de 10**. O follow-up continua válido; a contagem nele não.
- **N5 — `installer/install.mjs:409` já lista `dev-planner` em `SKILLS_COMMON`.** O papel não exige nenhum trabalho de propagação — o que faltava era consumidor, não distribuição. É a medida mais direta de que o custo de C1 é 1 prompt fino, não uma nova superfície de instalação.

- **N12 — item 8 contradizia o item 9 e foi emendado.** A primeira versão do item 8 exigia `git diff --stat .agents/rules/sdd-workflow-standard.md` **vazio** no commit do SDD, mas o item 9 manda editar a linha **50** desse mesmo arquivo. As duas não podiam ser verdadeiras juntas. A verificação foi reescrita para o que de fato importa: **a atribuição de `PLAN.md` em §1/§2 fica intacta** (diff restrito à linha 50). Registrado durante a implementação, antes do code review.

- **N13 — comando de aceite do item 7 era impossível de passar.** O ERE usava parênteses escapados, que casam a string literal `(backend|frontend)` — inexistente. O intento estava cumprido; a verificação é que estava errada. Defeito do ADR, não do artefato.
- **N14 — F1 do code review: `PLAN.md` continuava com dois autores.** O item 8 media só `.agents/skills/dev-planner/SKILL.md` e ignorou que a skill é **diretório**: `workflow.md:395` (`### Saída → .spec/[feature]/PLAN.md`), `:429` (checklist) e `:461` (artefatos gerados) seguiam prescrevendo o arquivo, e `workflow-rules.md:186,198` mandavam o orquestrador gerar/incorporar `PLAN.md` na fase de planejamento. Com isso a invariante I2 e a métrica "1 autor" eram **falsas**. Os 5 sítios passaram a descrever **parecer** (texto no retorno), não path.
- **N15 — F2 do code review: `DESIGN-DECISIONS.md` era decisão disfarçada autorizada.** `workflow-rules.md:184` dizia "comparar alternativas, **registrar ADRs** → gerar `DESIGN-DECISIONS.md`" e `SKILL.md:159` rotulava o artefato como "Decisões de design com justificativa (ADRs)". O `planner/AGENT.md` manda obedecer `.agents/rules/**`: a proibição do item 10 e a obrigação do prompt se contradiziam, e a mitigação por 3 greps de token não pega um ADR sem carimbo.
- **N16 — F3: o papel nascia inalcançável; item 17 acrescenta a fiação.** `grep "@planner|invocar.*planner"` = 0 e `workflow-rules.md:181` mandava o **orchestrator** executar F0–F5 sozinho. Sem fiação o `planner` é decoração e o planejamento continua duplicado no orquestrador.
- **N17 — F4: a allowlist é prosa, e o `AGENT.md` citava lastro inexistente.** `gate-contract.md` não contém allowlist do `planner` (a única ocorrência da palavra é o I2, outro assunto) e o §2.1 do próprio contrato diz "prosa não é negada". O `AGENT.md` passa a declarar isso honestamente: a lista é pedido de escopo, **não** garantia; o que barra escrita é `protectedPaths`.

## 9. Emenda aprovada pelo owner em 2026-11-11 (item 17)

17. **O `orchestrator` delega ao `planner` antes da SPEC** — em feature não isenta (`.agents/rules/prd-adr-pipeline.md` §3), a fase de planejamento do orquestrador **delega** ao `planner` em vez de executar F0–F5 localmente; a rule `.agents/rules/workflow-rules.md` descreve a delegação, não a execução local. *Verificação*: `grep -c "planner" .agents/agents/orchestrator/AGENT.md` ⇒ **≥1**; `grep -c "planner" .agents/rules/workflow-rules.md` ⇒ **≥1**; `grep -c "dev-planner" .agents/rules/workflow-rules.md` ⇒ **0**.
