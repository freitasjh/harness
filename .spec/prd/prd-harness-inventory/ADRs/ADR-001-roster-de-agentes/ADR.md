# ADR-001 — Roster de agentes: 1 primário, `codebase-analyzer` absorvido pelo `architect`, stub `code-reviewer/AGENT.md` removido e saída do `sdd-orquestrador`

- **prd-id**: `prd-harness-inventory` — `.spec/prd/prd-harness-inventory/PRD.md`
- **order**: 1 de 5 (`.spec/prd/prd-harness-inventory/ADR-INDEX.md`)
- **status**: `in-progress`
- **branch**: `adr/prd-harness-inventory/01-roster-de-agentes`
- **depende-de**: — (nenhum ADR deste ciclo é pré-requisito; `ADR-003` é que depende deste, não o contrário)
- **data**: 2026-11-11
- **dono da decisão**: owner do harness — portão **G1**, `PRD.md` §16, decisões **D1+D2 = retirar + consolidar**
- **rota**: Refactor
- **insumo de pesquisa**: `RESEARCH.md` §3 (tema A, alternativas A1–A4) e §9 (riscos R1–R8)
- **escopo de escrita desta entrega**: `.spec/prd/prd-harness-inventory/**`. Nenhum `AGENT.md`, `opencode.json`, `gemini.yaml`, rule, plugin ou script foi editado — a implementação é o SDD deste ADR.

## 1. Contexto

O roster do harness não é verificável hoje porque **registro e disco não descrevem o mesmo conjunto**, e porque papéis com o mesmo mandato sobrevivem com nomes diferentes.

Medido neste repo em 2026-11-11 (comando declarado em §7, item 0):

| Fato medido | Valor | Fonte |
|---|---|---|
| Diretórios de agente com `AGENT.md` | **11** | `ls .agents/agents/*/AGENT.md` |
| Agentes registrados em `opencode.json` | **10** (`agent.<nome>.prompt`) | `node -e` sobre `opencode.json` |
| Divergência | **1**: `sdd-orquestrador` tem diretório e **não** está registrado; `orchestrator` é o único `mode: primary` | `opencode.json`, medido |
| `edit: allow` | **4**: `developer-engineer`, `product-manager`, `qa-engineer`, `architect` | `opencode.json` |
| `edit: deny` | **6**: `orchestrator`, `codebase-analyzer`, `security-engineer`, `code-reviewer`, `ux-designer`, `design-system-specialist` | `opencode.json` |
| Arquivos que citam `sdd-orquestrador` fora de `.spec/**` | **10** = 8 externos + 2 do próprio agente (`AGENT.md`, `gemini.yaml`) | `grep -rln` |
| Arquivos do diretório `sdd-orquestrador/` | **3** = `AGENT.md` (112 l.), `gemini.yaml`, `opencode.yaml` | `ls` |
| Stub `code-reviewer/AGENT.md` | **6 linhas**; o registro aponta para `PROMPT.md` (75 l.) | `wc -l`, `opencode.json` |
| `codebase-analyzer` | `AGENT.md` 46 l., `gemini.yaml`, `opencode.yaml`; **0** skill consumida; `edit: deny` | `ls`, `grep` |

Dois defeitos de mandato motivam a consolidação:

1. **Dois orquestradores para uma função.** `orchestrator` é o primário registrado; `sdd-orquestrador` tem prompt de 112 linhas, `CLÁUSULA DE NÃO-BYPASS` própria e é citado como vivo em 8 arquivos externos — mas o runtime **nunca o carrega**, porque não há registro. As 2 rules que descrevem "o orquestrador" (`workflow-rules.md:87`, `sdd-workflow-standard.md:42`) apontam para o agente que o runtime não conhece.
2. **Dois mandatos para uma competência.** `codebase-analyzer` declara *"reconstruct the systemic architecture"* (`AGENT.md:5`) e `architect` declara *"Definir a estrutura macro do sistema"* (`AGENT.md:16`). O mesmo trabalho com nomes diferentes; `codebase-analyzer` não consome skill nenhuma e é o único agente cuja razão de existir o `architect` já cobre.

O stub `code-reviewer/AGENT.md` é o terceiro resíduo: 6 linhas com frontmatter `name`/`description` e um corpo que manda invocar `PROMPT.md`. O runtime usa `PROMPT.md` (medido em `opencode.json`); o `AGENT.md` não é lido por nada — `grep -rn "code-reviewer/AGENT.md"` fora de `.spec/` devolve **0** leitores.

## 2. Decisão

**O roster do harness passa a ser 9 agentes — 1 primário e 8 subagentes — com exatamente um mandato por papel:**

| # | Agente | `mode` | `edit` | Papel |
|---|---|---|---|---|
| 1 | `orchestrator` | `primary` | deny | Triagem, governança, SPEC/PLAN/TASKS, delegação |
| 2 | `developer-engineer` | `subagent` | allow | Implementação de código e testes sob delegação |
| 3 | `code-reviewer` | `subagent` | deny | Parecer de review por severidade |
| 4 | `qa-engineer` | `subagent` | allow | Harness/qualidade e verificação independente |
| 5 | `product-manager` | `subagent` | allow | PRD, escopo, aceite, risco de produto |
| 6 | `architect` | `subagent` | allow | Decisão arquitetural/ADR **e** análise do código existente (absorvido) |
| 7 | `security-engineer` | `subagent` | deny | Auditoria OWASP/ASVS por fase |
| 8 | `ux-designer` | `subagent` | deny | Parecer de UX/interface |
| 9 | `design-system-specialist` | `subagent` | deny | Contratos de template do design system |

Três operações, uma consequência única (roster com 1 mandato por papel):

- **Retirar** `sdd-orquestrador` — 3 arquivos apagados, 8 referências externas tratadas (itens 6–13).
- **Fundir** `codebase-analyzer` em `architect` — 3 arquivos apagados; a capacidade de análise do código existente vira **modo declarado** no prompt do `architect` (item 4).
- **Remover** o stub `code-reviewer/AGENT.md` — `PROMPT.md` permanece como alvo do registro (item 5).

**Fora desta decisão** (declarado, não decidido aqui): o agente `planner` (ADR-003), o formato V2 de registro em `opencode.json` (`agents`/`system`/`permissions`, risco R3), a reclassificação de `prd-adr-pipeline` (ADR-002) e a classificação da prosa órfã de rules `.doc/`/`AGENTS.md` (ADR-005).

## 3. Interface congelada

Cada item é verificável por comando ou por `arquivo:linha`. Nenhum item depende de leitura subjetiva de prosa.

1. **`opencode.json.agent` tem exatamente 9 chaves**, iguais ao conjunto da tabela de §2 — `orchestrator`, `developer-engineer`, `code-reviewer`, `qa-engineer`, `product-manager`, `architect`, `security-engineer`, `ux-designer`, `design-system-specialist`. Exatamente **1 remoção** (`codebase-analyzer`) e **0 adições**. `orchestrator` continua o único com `mode: "primary"`.
   *Verificação*: `node -e 'const k=Object.keys(require("./opencode.json").agent).sort();console.log(k.length,k.join(","))'` ⇒ `9 …`; diff com o conjunto esperado = 0; contar `mode==="primary"` ⇒ `1`.
2. **Registro e disco em 1:1** — `ls -d .agents/agents/*/` devolve **9** diretórios e o conjunto dos nomes é idêntico ao das 9 chaves do item 1. Baseline de divergência (`PRD.md` §5: 1, `sdd-orquestrador`) vai a **0**.
   *Verificação*: `ls -d .agents/agents/*/ | wc -l` ⇒ `9`; `diff` dos dois conjuntos ⇒ vazio.
3. **`sdd-orquestrador` não existe no disco** — os 3 arquivos do diretório (`AGENT.md`, `gemini.yaml`, `opencode.yaml`) são apagados, sem sobra de diretório vazio.
   *Verificação*: `test ! -e .agents/agents/sdd-orquestrador && echo ABSENT` ⇒ `ABSENT`.
4. **`codebase-analyzer` não existe no disco e a capacidade vive no `architect`** — diretório apagado (3 arquivos); `architect/AGENT.md` ganha a seção literal `### Modo análise (absorvido de codebase-analyzer)` com 4 sub-marcadores literais: `Topologia de deployment`, `Contratos e fronteiras de linguagem`, `Heurísticas e anti-patterns`, `Confiança e Unknowns`. O mandato de análise **não escreve**: o modo declara isso em prosa, e o `architect` mantém `edit: "allow"` (o read-only não é herdado — ver §4, consequência C3).
   *Verificação*: `test ! -e .agents/agents/codebase-analyzer` ⇒ verdadeiro; `grep -cF` de cada um dos 5 literais em `.agents/agents/architect/AGENT.md` ⇒ ≥1 cada (5/5); `node -e '…agent.architect.permission.edit'` ⇒ `"allow"`.
5. **Stub `code-reviewer/AGENT.md` removido; `PROMPT.md` permanece e continua sendo o alvo do registro** — `.agents/agents/code-reviewer/PROMPT.md` existe (75 l. hoje) e `opencode.json.agent["code-reviewer"].prompt` é exatamente a **string** `{file:./.agents/agents/code-reviewer/PROMPT.md}` (no shape v2-only não há objeto com `.file`; ver N8).
   *Verificação*: `test ! -e .agents/agents/code-reviewer/AGENT.md`; `test -e .agents/agents/code-reviewer/PROMPT.md`; `node -e 'const p=require("./opencode.json").agent["code-reviewer"].prompt;console.log(p==="{file:./.agents/agents/code-reviewer/PROMPT.md}")'` ⇒ `true`.
6. **`scripts/sdd-checks.mjs` deixa de ler o arquivo removido** — as 2 leituras (`hasGatesConvention`, hoje `:132`; `SDD-01`, hoje `:384`) e o rótulo/comentário de `SDD-01` (`:383`) passam a apontar para `.agents/agents/orchestrator/AGENT.md`. `grep -c "sdd-orquestrador" scripts/sdd-checks.mjs` ⇒ **0**. O id do check continua `SDD-01` (não é renomeado neste ADR).
   *Verificação*: `grep -c "sdd-orquestrador" scripts/sdd-checks.mjs` ⇒ `0`; `node scripts/sdd-checks.mjs` ⇒ `SDD-01` PASS e `SDD-03` PASS com `convention-doc=true`.
7. **Os 3 marcadores que sustentam `SDD-01`/`SDD-03` migram para `orchestrator/AGENT.md`** — hoje medido: `sdd-orquestrador/AGENT.md` tem **3/3** e `orchestrator/AGENT.md` tem **0/3**. Os marcadores são: (a) a palavra `NÃO-BYPASS` (ou `NAO-BYPASS`/`não-bypass`) **junto** da citação `gate-contract.md` — exigência de `hasNoBypassClause` (`scripts/sdd-checks.mjs:121`); (b) o literal `gates.P1_P2`; (c) o literal `gates.P2_P3` — exigência de `hasGatesConvention` (`:129-136`). Sem este item, remover o arquivo deixa `SDD-01` e `SDD-03` vermelhos e o CI falha (`.github/workflows/harness-integrity.yml:32` roda `node scripts/sdd-checks.mjs`).
   *Verificação*: `grep -c "NÃO-BYPASS" .agents/agents/orchestrator/AGENT.md` ⇒ ≥1 e `grep -c "gate-contract.md"` ⇒ ≥1; `grep -c "gates.P1_P2"` ⇒ ≥1; `grep -c "gates.P2_P3"` ⇒ ≥1; `node scripts/sdd-checks.mjs` ⇒ 0 FAIL.
8. **`.opencode/plugins/__tests__/sdd-checks.spec.mjs` deixa de referenciar o caminho removido** — a constante `SDD_ORCH` (hoje `:651`) é eliminada e seus **7** usos (`:655`, `:662`, `:672`, `:681`, `:694`, `:698`, `:710`) passam a usar `ORCH`; o teste de preservação do marcador de não-bypass troca de fixture para `orchestrator/AGENT.md`. Sem isso o `readFileSync` estoura `ENOENT` e a suíte de plugins (primeiro termo de `commands.suiteFull`) fica vermelha.
   *Verificação*: `grep -c "sdd-orquestrador" .opencode/plugins/__tests__/sdd-checks.spec.mjs` ⇒ `0`; `node --test ".opencode/plugins/__tests__/sdd-checks.spec.mjs"` ⇒ 0 fail.
9. **As 2 rules que nomeiam o agente removido são reapontadas para `orchestrator`** — `.agents/rules/workflow-rules.md:87` (*"Orchestrator (sdd-orquestrador)"*) e `.agents/rules/sdd-workflow-standard.md:42` (*"o `sdd-orquestrador` deve obrigatoriamente"*). `.agents/rules/**` ∈ `harness.config.json.protectedPaths`, portanto o commit correspondente exige o trailer `Harness-Gate-Change` (mecanismo 🟠: pre-commit + `harness-integrity.yml`, ADR-007).
   *Verificação*: `grep -c "sdd-orquestrador" .agents/rules/workflow-rules.md .agents/rules/sdd-workflow-standard.md` ⇒ `0` nos dois; mensagem do commit contém `Harness-Gate-Change`.
10. **`.agents/rules/gate-contract.md` I5 corrigido para 5 agentes sem `edit`** — a linha `:18` hoje lista `codebase-analyzer` entre "os 6 sem `edit`". Após a fusão, a lista passa a nomear exatamente **5** — `orchestrator`, `code-reviewer`, `ux-designer`, `security-engineer`, `design-system-specialist` — e `grep -c "codebase-analyzer" .agents/rules/gate-contract.md` ⇒ **0**. Path protegido: mesmo requisito de trailer do item 9.
    *Verificação*: `grep -c "codebase-analyzer" .agents/rules/gate-contract.md` ⇒ `0`; os 5 nomes presentes na linha I5.
11. **`.agents/skills/prompt-optimizer/SKILL.md:171` reapontado** — a célula de comando do check `V3` cita `sdd-orquestrador/AGENT.md` como um dos 3 call sites; passa a citar apenas `orchestrator/AGENT.md` e `workflow-rules.md`.
    *Verificação*: `grep -c "sdd-orquestrador" .agents/skills/prompt-optimizer/SKILL.md` ⇒ `0`.
12. **`docs/FUNCIONAMENTO.md` tratado linha a linha (4 ocorrências)** — `:542` (tabela de checks) e `:675` (drift `d2`) reapontadas para `orchestrator`; `:624` removida (a divergência `d2` deixa de existir); `:680` **mantida** (o texto original dizia `:682`; as duas remoções do item deslocam −2) — é registro histórico datado ("Corrigido em 2026-10-22") que cita `sdd-orquestrador/AGENT.md:17` como evidência do defeito passado, não do estado atual. Resultado: `grep -c` ⇒ **1** ocorrência remanescente, a de `:680`.
    *Verificação*: `grep -c "sdd-orquestrador" docs/FUNCIONAMENTO.md` ⇒ `1`; a ocorrência remanescente está na linha do registro `d9`.
13. **`sdd-orquestrador` mantido sem edição em 2 arquivos de registro** — `workflow-state.json` (3 ocorrências: `follow_ups` FU-64, decisão `D1_D2`, título do `adr_plan`) e `harness/opencode-v2-only.json` (`residual_risks`: *"TD-15 agente orfao sdd-orquestrador"*, artefato de evidência com `gitSha` do ciclo arquivado). Nenhuma delas afirma que o agente existe hoje; são registro histórico. `git diff` desses trechos no commit do SDD ⇒ vazio.
    *Verificação*: `grep -c "sdd-orquestrador" workflow-state.json` ⇒ `3` e `harness/opencode-v2-only.json` ⇒ `1`; nenhuma linha adicionada/removida nesses dois arquivos pelo SDD deste ADR.
14. **`gate.js` byte-idêntico** — o roster não é lido como regra por papel além dos 6 nomes de `KNOWN_AGENTS` (`gate.js:635-643`, enum de **sanitização de log**, I10) e dos branches de `checkWriteAccess` (`gate.js:655-680`). `codebase-analyzer` e `sdd-orquestrador` **não aparecem** em nenhum dos dois (medido: 0 ocorrências) — logo remover/fundir **não** altera veredito de gate. `gate.js` e `.opencode/plugins/lib/**` byte-idênticos. Os **specs de teste** mudam como consequência direta do roster: `sdd-checks.spec.mjs` (item 8) e o `assert.deepEqual` do conjunto de 9 nomes em `config-dual-parity.spec.mjs:123-140` (antes: `length === 10`, depois `2b80685`: conjunto literal).
    *Verificação*: `git diff --stat .opencode/plugins/gate.js` ⇒ vazio no commit do SDD; `node --test ".opencode/plugins/__tests__/*.spec.mjs"` ⇒ 0 fail.
15. **`commands.suiteFull` byte-idêntico** — nenhum comando novo entra na suíte, portanto o selo `HARNESS_SEAL_JSON` **não** é republicado (`harness-config.md` §"Command seal"; risco R5).
    *Verificação*: `git diff --stat harness.config.json` ⇒ vazio; `node scripts/static-checks.mjs` ⇒ exit 0.
16. **Suíte completa verde ao fim do SDD deste ADR** — `node --test ".opencode/plugins/__tests__/*.spec.mjs" && node --test "installer/__tests__/*.spec.mjs" && node scripts/static-checks.mjs && node scripts/vendor-skills.mjs --check`, e `node scripts/sdd-checks.mjs` sem FAIL.
    *Verificação*: os 5 comandos, exit 0 cada.

## 4. Consequências

- **C1 — Roster 11→9 diretórios e 10→9 registros**; divergência registro↔disco vai a 0 (`PRD.md` §5, métrica "Divergências registro↔disco sem decisão"). É o RF-02 fechado.
- **C2 — O destino recebe menos 2 agentes automaticamente.** O instalador propaga `.agents/agents` como **camada inteira** (`installer/install.mjs:103`, `LAYER_PREFIX`), sem mapa por eixo/agente como existe para skills (`SKILLS_BY_AXIS`) e rules (`RULES_BY_AXIS`). Nenhuma edição de instalador é necessária; o efeito no projeto-destino é a ausência dos diretórios.
- **C3 — A capacidade "análise sem escrever" perde a garantia nativa.** Hoje o read-only de `codebase-analyzer` vem de `opencode.json` (`edit: deny`), **não** do manifest: o `gemini.yaml` do próprio agente já declara `write_file` e `replace` (medido). Ao fundir em `architect` (`edit: allow`), o modo análise passa a ser limitação **de prosa** (🟡 processo), sem mecanismo de runtime. Mitigação declarada: o modo é descrito no prompt do `architect` (item 4) e o `git diff` de `.spec/**` continua sendo o que um revisor olha. Nenhum gate novo é criado por este ADR.
- **C4 — `SDD-01`/`SDD-03` mudam de sujeito, não de exigência.** Os checks passam a dogfoodar `orchestrator/AGENT.md` (item 6–8). A cláusula de não-bypass deixa de ser "de um orquestrador não registrado" e passa a ser a do único orquestrador vivo — ganho de coerência, custo de 3 marcadores migrados.
- **C5 — `prd-adr-pipeline` cai de 4 para 3 agentes citantes** (medido: `sdd-orquestrador`, `product-manager`, `orchestrator`, `architect`). É o risco **R4** do `RESEARCH.md` §9 materializando-se; o ADR-002 reaponta 3, não 4.
- **C6 — `gate.js` e o gate por papel ficam intactos** (item 14). O mapa `sessionID→agente` (`recordSessionAgent`, `gate.js:419`, `:1347`) nunca teve entrada para `sdd-orquestrador`, porque agente não registrado nunca é sessão. Para `codebase-analyzer` a entrada existe, mas **nenhum gate a lê** (0 ocorrências em `KNOWN_AGENTS` e em `checkWriteAccess`) — a fusão não abre caminho de escrita em path protegido que já não existisse.
- **C7 — Granularidade de auditoria não regride, mas também não cobre o roster.** `KNOWN_AGENTS` (`gate.js:635-643`) tem 6 nomes + `unknown`; 4 agentes registrados (`product-manager`, `architect`, `security-engineer`, `codebase-analyzer`) já caem em `unknown` em `DenyError.details` hoje. O roster de 9 mantém a lacuna (5 nomes cairão em `unknown`). **Não é decidido aqui** — é consequência declarada; alinhar o enum ao roster é mudança de `.opencode/plugins/**` (path protegido) e não é roster.

## 5. Riscos herdados do `RESEARCH.md` §9

| # | Como se aplica a este ADR | Estado |
|---|---|---|
| **R2 — divergências de contagem** | `PRD.md` §1/§8 diziam **7** arquivos citando `sdd-orquestrador`; medido **10** (8 externos + 2 próprios). O `PRD.md` §14-D1 fala em "10 arquivos vivos"; contado, são 8 vivos + 2 do próprio diretório que sai. Número canônico deste ADR: **10 ocorrências / 9 arquivos após a remoção dos 3 do diretório** (8 externos + 1 `workflow-state.json`… ver §8, N3 para a conta fechada). | **herdado e corrigido aqui** |
| **R3 — formato V2 de registro** | Este ADR remove **1** chave de `opencode.json` e **não** adiciona nenhuma. Não escreve `agents`/`system`/`permissions`. A escolha de formato continua aberta e é do ADR-003. | herdado, **não acionado** |
| **R4 — `prd-adr-pipeline` 4→3 citações** | Materializa-se (C5). Nenhum reapontamento é feito aqui; ADR-002 declara a ordem. | herdado, **transferido ao ADR-002** |
| **R7 — enum de `status` do índice** | `ADR-INDEX.md` usa `in-progress` (enum válido `todo|in-progress|merged|dropped`, `checks.mjs:47`). `proposed` não existe e não é usado. | **fechado por construção** |
| **R8 — índice↔disco no mesmo passo** | Resolvido pela forma **(a)** do R8: o índice nasce **com** o `ADR.md` do `ADR-001`, no mesmo commit, com **1 linha** (as outras 4 linhas não existem sem diretório). A suíte fica verde o tempo todo. | **fechado por construção** |
| **R1 / R5 / R6** | Pertencem a ADR-002 (propagação do instalador), ADR-004 (selo de `suiteFull`) e ADR-003 (precedente de mercado do `planner`). Não são acionados por este ADR — o item 15 existe justamente para provar que o selo não muda. | herdados, **não acionados** |

## 6. Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| **A1 — registrar `sdd-orquestrador` e manter 11 agentes** | Cria 2 primários com mandatos concorrentes; a delegação passaria a depender de qual primário o usuário escolheu na sessão. Ganho zero: `orchestrator` já cobre triagem/governança, e as 2 rules passariam a precisar desambiguar "qual orquestrador". Custo de manutenção de 2 prompts (~773 linhas somadas) em paridade. `RESEARCH.md` S3: complexidade só se paga com ganho mensurável. |
| **A2 — paridade mínima (só registrar/renomear, sem consolidar)** | Mantém `codebase-analyzer` × `architect` com mandatos colidentes (`AGENT.md:5` vs `AGENT.md:16`) e o stub de 6 linhas como artefato sem leitor. Zero arquivos tocados hoje, mas transfere a dívida para toda adoção futura. Descartada explicitamente pelo owner em G1/D2. |
| **A4 — um agente por fase do SDD** | As 3 fases do SDD pesquisado (Kiro, spec-kit) são etapas de **um** produto, não papéis; Fowler mede o custo de cerimônia em markdown verboso. +3 agentes e ~300 linhas de prompt para um fluxo que cabe em 1 primário + 8 subagentes, com mais pontos de perda de contexto (subagente roda em sessão filha). |
| **A5 — manter `sdd-orquestrador` como `subagent` registrado** (variante de A1 não listada no RESEARCH, avaliada e descartada) | Resolveria a divergência registro↔disco com 1 chave e preservaria o prompt de 112 linhas — mas mantém 2 mandatos de orquestração e exigiria que `orchestrator` e o subagente compartilhassem a esteira por cópia de prosa. Não resolve o defeito medido (prosa descrevendo 2 orquestradores) e adiciona um handoff onde hoje há um só. |

## 7. Critérios de verificação

Todos os comandos rodam da raiz do repo, com o `asar` de `harness.config.json` inalterado.

**Item 0 — re-derivação do contexto (RF-07).** Deve reproduzir os valores de §1:

```sh
ls -d .agents/agents/*/ | wc -l                                       # 11 (antes) → 9 (depois)
# NB (N9): `ls .agents/agents/*/AGENT.md` dá 8 depois — o alvo do `code-reviewer` é `PROMPT.md` (item 5). O critério vinculante é o item 2.
node -e 'console.log(Object.keys(require("./opencode.json").agent).length)'  # 10 (antes) → 9 (depois)
node -e 'const a=require("./opencode.json").agent;console.log(Object.entries(a).filter(([,v])=>v.permission?.edit==="allow").map(([k])=>k).sort().join(","))'
grep -rln "sdd-orquestrador" --exclude-dir=.git --exclude-dir=.spec .   # 10 arquivos (antes)
grep -rc "sdd-orquestrador" docs/FUNCIONAMENTO.md scripts/sdd-checks.mjs workflow-state.json
```

**Critérios de aceite do SDD deste ADR** (cada um mapeia para um item de §3):

```sh
# itens 1-2: roster 9, paridade registro↔disco
node -e 'const k=Object.keys(require("./opencode.json").agent).sort();console.log(k.length,k.join(","))'
ls -d .agents/agents/*/ | wc -l                                        # 9

# itens 3-5: remoções e alvo do registro
test ! -e .agents/agents/sdd-orquestrador && test ! -e .agents/agents/codebase-analyzer \
  && test ! -e .agents/agents/code-reviewer/AGENT.md && test -e .agents/agents/code-reviewer/PROMPT.md && echo "4/4 OK"
node -e 'const p=require("./opencode.json").agent["code-reviewer"].prompt;console.log(p==="{file:./.agents/agents/code-reviewer/PROMPT.md}")'   # true (N8: `prompt` é string, não objeto)
for s in "### Modo análise (absorvido de codebase-analyzer)" "Topologia de deployment" \
         "Contratos e fronteiras de linguagem" "Heurísticas e anti-patterns" "Confiança e Unknowns"; do
  grep -cF "$s" .agents/agents/architect/AGENT.md; done                # ≥1 em cada (5/5)

# itens 6-8: checks e teste re-apontados
grep -c "sdd-orquestrador" scripts/sdd-checks.mjs .opencode/plugins/__tests__/sdd-checks.spec.mjs   # 0 e 0
node scripts/sdd-checks.mjs                                            # SDD-01 PASS, SDD-03 convention-doc=true
node --test ".opencode/plugins/__tests__/sdd-checks.spec.mjs"           # 0 fail

# itens 7, 9-12: marcadores migrados e referências tratadas
grep -c "NÃO-BYPASS" .agents/agents/orchestrator/AGENT.md              # ≥1
grep -c "gates.P1_P2" .agents/agents/orchestrator/AGENT.md             # ≥1
grep -c "gates.P2_P3" .agents/agents/orchestrator/AGENT.md             # ≥1
grep -c "sdd-orquestrador" .agents/rules/workflow-rules.md .agents/rules/sdd-workflow-standard.md \
  .agents/rules/gate-contract.md .agents/skills/prompt-optimizer/SKILL.md docs/FUNCIONAMENTO.md
# esperado: 0 0 0 0 1 (a remanescente em :680 — deslocada −2 pelas remoções do item 12)

# itens 13-16: nada além do roster muda; suíte verde
git diff --stat .opencode/plugins/gate.js harness.config.json          # vazio
node --test ".opencode/plugins/__tests__/*.spec.mjs" \
  && node --test "installer/__tests__/*.spec.mjs" \
  && node scripts/static-checks.mjs \
  && node scripts/vendor-skills.mjs --check                            # exit 0
```

**Ordem de merge.** `ADR-003` declara `depends_on: ADR-001` — o `planner` entra no roster que este ADR define e herda a decisão de primário único. `ADR-002` **não** depende deste ADR formalmente, mas executá-lo depois reduz de 4 para 3 os reapontamentos de `prd-adr-pipeline` (C5). Essa ordem de execução não é `depends_on` e não é inventada no índice.

## 8. Notas de correção (divergências medidas entre PRD/RESEARCH e disco)

- **N1 — "7 arquivos" → 10 ocorrências.** `PRD.md` §1 e §8 dizem "7 arquivos" citando `sdd-orquestrador`; a re-derivação de 2026-11-11 devolve **10 arquivos** fora de `.spec/**` (8 externos + 2 do próprio diretório). Este ADR usa 10. Registrado também em `workflow-state.json` FU-64.
- **N2 — o diretório removido tem 3 arquivos, não 2.** O brief do ciclo lista `AGENT.md` + `gemini.yaml`; o disco mostra **também** `opencode.yaml` (`description` + `mode: all`). Ele não aparece em `grep -rln "sdd-orquestrador"` porque o arquivo não contém o próprio nome — a contagem por `grep` **subestima** o que sai. Item 3 cobre os 3.
- **N3 — conta fechada das 10 ocorrências.** Por arquivo: `.agents/rules/sdd-workflow-standard.md` 1, `.agents/rules/workflow-rules.md` 1, `.agents/skills/prompt-optimizer/SKILL.md` 1, `docs/FUNCIONAMENTO.md` 4, `harness/opencode-v2-only.json` 1, `.opencode/plugins/__tests__/sdd-checks.spec.mjs` 1, `scripts/sdd-checks.mjs` 4 (2 leituras + 2 comentários), `workflow-state.json` 3, `sdd-orquestrador/AGENT.md` 1, `sdd-orquestrador/gemini.yaml` 1 → 10 arquivos / 18 ocorrências. "10 referências" no texto do PRD significa **10 arquivos**; as ocorrências são 18.
- **N4 — `edit: deny` do `codebase-analyzer` não é intrínseco.** O `gemini.yaml` do agente declara `write_file` e `replace` entre as tools. O read-only é do `opencode.json`. Relevante para C3 e para não prometer "análise é read-only" como propriedade do papel.
- **N5 — `§16` do PRD está internamente inconsistente.** `PRD.md:5` diz *"Status: draft — aguardando veredito"* e `:190` diz *"Não ainda — este bloco está em draft"*, enquanto `:170` registra *"Veredito: APROVADO … G1 fechado em 2026-11-11"*. O `PRD-01` passa (`VERDICT_RE` ancora em linha iniciada por `Veredito:`), mas a prosa das linhas 5 e 190 contradiz o veredito. **Não corrigido aqui** (fora do escopo deste ADR; um ADR decide o roster). Dono: orquestrador do ciclo.
- **N6 — `workflow-state.json.prd_adr.adr_index_status` fica obsoleto com este commit.** O campo registra *"não materializado por contradição rule §1 × ADR-01"*; a partir deste commit o índice existe na forma que satisfaz `ADR-01`. Atualizar o campo é do orquestrador (dono do bloco `prd_adr`), não deste ADR — e `workflow-state.json` estava modificado e não commitado quando este ADR foi escrito.
- **N7 — `.spec/**` fora deste diretório não é referência viva.** `grep -rln sdd-orquestrador` devolve mais 14 arquivos em `.spec/archive/**`, `.spec/tech-debts/**` e `.spec/prd/prd-garantias-runtime/**`. São artefatos datados de ciclos encerrados (imutáveis por convenção, como `RENAME-01` e `R-V12` já tratam): nenhuma ação.

- **N8 — `prompt` é string, não objeto (corrigido em 2026-11-11 após o code review).** O item 5 foi escrito contra um schema que não existe: as 9 entradas de `opencode.json.agent` usam `prompt: "{file:./…}"` como **string**, e não há nenhum leitor de `.prompt.file` no repo (0 ocorrências). O comando de aceite do §7 foi corrigido para comparar a string; o config **não** foi alterado — mudar o shape é escopo de outro ADR (risco R3).
- **N9 — `ls …/*/AGENT.md` = 8, não 9.** Decorrem do item 5: o `code-reviewer` não tem mais `AGENT.md`. O critério vinculante continua sendo o item 2 (`ls -d .agents/agents/*/` = 9, conjuntos idênticos).
- **N10 — resíduo de prosa em `docs/FUNCIONAMENTO.md` (fechado).** O code review apontou que a tabela de roster do documento de operação **listava** `codebase-analyzer` e ancorava `edit` em `opencode.json:36` (product-manager) para o agente apagado, e em `:72` (code-reviewer) para o `security-engineer`; `:108` dizia "10 papéis (o opencode.json registra 9)"; `:653` listava as linhas de `bash` com deslocamento +1. Fora dos 16 itens (o item 12 escopou só `sdd-orquestrador`). **Correção aplicada no commit de follow-up `2b80685`** (o SDD é `1c8062b`): `:108` reescrita para 8 `AGENT.md` + 9 diretórios + 9 registrados em paridade; linha do agente apagado removida; 9 lastros `edit` reancorados em `18,27,36,45,54,63,72,81,90`; `:653` passou a citar os pares `edit`/`bash`.
