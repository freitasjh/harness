# ADR-004 — Inventário canônico: superfície derivada (check `V19`), não documento; a única coisa commitada é o registry de decisões de órfão, e ele expira

- **prd-id**: `prd-harness-inventory` — `.spec/prd/prd-harness-inventory/PRD.md`
- **order**: 4 de 5 (`.spec/prd/prd-harness-inventory/ADR-INDEX.md`)
- **status**: `in-progress`
- **branch**: `adr/prd-harness-inventory/04-inventario-canonico` (criada de `main` @ `cb0f08d`, HEAD `ea88d4d`)
- **depende-de**: `—` (decisão do owner, `PRD.md` §16; nenhum ADR é pré-requisito de execução). **Precedentes** que este ADR usa e que não são dependência: `ADR-001` (o roster passou a 10 — o inventário *deriva* esse número, não o herda), `ADR-002` (módulo de regra em `.opencode/plugins/lib/**` + norma na rule), `ADR-005` (o padrão de mecanismo: módulo puro + adapter no runner selado, baseline em `protectedPaths`). Se qualquer um dos três fosse revertido, a decisão abaixo continuaria válida — só os números da §3 mudariam, e eles mudam por derivação, sem editar este arquivo.
- **data**: 2026-11-11
- **dono da decisão**: owner do harness — portão **G1**, decisão **D3**: *manter `vendor-by-axis`; as 25 vendorizadas são classificadas pelo `.vendor-lock.json`, sem exigir agente consumidor por stack*. Este ADR **não reabre** D3: ele apenas dá ao `vendor-by-axis` um predicado executável e um lugar.
- **rota**: refactor de governança com mecanismo (sem comportamento observável de produto ⇒ não gera PRD novo; `prd-adr-pipeline.md` §3)
- **insumo de pesquisa**: `RESEARCH.md` §6 (tema D — alternativas D1–D3 e E1–E3, recomendação "D2 + E2, rodando dentro de `static-checks.mjs` para não tocar o selo") e §9 (riscos R2, R5, R8); `PRD.md` §5, §7 (não-objetivo "definir formato de arquivo de inventário gerado") e §9 (RF-01, RF-04, RF-07)
- **escopo de escrita desta entrega**: `.spec/prd/prd-harness-inventory/**` (`ADR.md` + 1 linha e 2 parágrafos de estado no `ADR-INDEX.md`). **Nenhum** arquivo de `.agents/**`, `opencode.json`, `installer/**`, `scripts/**` ou plugin foi editado — o módulo, o adapter e a spec são o SDD deste ADR.
- **escopo não decidido aqui**: as 8 rules ausentes (PRD 2), a agnosticização de conteúdo stack-bound (PRD 2), `KNOWN_AGENTS` (FU-65), a propagação do `.vendor-lock.json` ao destino (§4-C4), e a correção de texto do PRD para as contagens de 11 agentes / 49 skills (§4-C1).

## 1. Contexto

O `RF-01` pede inventário **1:1 de agentes, skills e rules** com nome, propósito, consumidor/eixo e fonte de evidência; o `RF-04` pede **classe por skill**, vendorizada derivada do **lock**; o `RF-07` pede que **todo número publicado seja re-derivável**. Hoje o repo tem três inventários parciais e nenhum deles fecha a conta:

| Fato medido (2026-11-11, HEAD `ea88d4d`, pós-merge `cb0f08d`) | Valor | Comando / fonte |
|---|---|---|
| Diretórios em `.agents/skills/` | **48** | `ls -d .agents/skills/*/ \| wc -l` |
| Diretórios com `SKILL.md` | **48** | `ls .agents/skills/*/SKILL.md \| wc -l` |
| Chaves em `.agents/skills/.vendor-lock.json` → `.skills` | **25** | `node -e 'console.log(Object.keys(require("./.agents/skills/.vendor-lock.json").skills).length)'` |
| Chaves do lock **sem** diretório no disco | **0** | mesmo `node -e`, filtrando por `fs.existsSync` |
| Skills locais (sem chave no lock) | **23** | `48 − 25` |
| Skills locais fora de `SKILLS_COMMON ∪ SKILLS_BY_AXIS` | **0** | teste `installer/__tests__/eixos-stack.spec.mjs:528` |
| Skills com ≥1 citação em prompt do roster + `opencode.json` | **22** | §3, comando da coluna `consumer` |
| Skills sem citação viva e sem eixo | **1** (`harness-installer`) | idem |
| Agentes em `opencode.json.agent` | **10** | `node -e 'console.log(Object.keys(require("./opencode.json").agent).length)'` |
| Diretórios em `.agents/agents/` | **10** | `ls -d .agents/agents/*/ \| wc -l` |
| Diferença simétrica registro↔disco | **0** | `comm -3` entre as duas listas ordenadas |
| Arquivos de prompt dos 10 registros | **10** = **9** `AGENT.md` + **1** `PROMPT.md` (`code-reviewer`) | resolução do `{file:…}` de cada `agent.*.prompt` |
| Rules em `.agents/rules/` | **8** | `ls .agents/rules/*.md \| wc -l` |
| Rules com ≥1 citação viva | **7** | §3 |
| Rules sem citação viva, com eixo declarado | **1** (`frontend-react-coding-standards.md` em `RULES_BY_AXIS['frontend=vue']`) | `installer/install.mjs:370` |

**O defeito, dito sem retórica.** O problema não é a falta de uma tabela — é que **toda tabela escrita à mão neste repo já nasceu errada**. Medido no próprio PRD deste ciclo, em menos de um dia: §1 diz "7 arquivos" citando o agente removido e a re-derivação dá **10**; §3.5 diz "13 paths distintos" e o `grep` devolve **20** distintos (13 só depois de filtrar ausência); §3.1/§5/RF-06 dizem **11** agentes e o disco tem **10** arquivos de prompt desde o `ADR-001`; §5 diz **49** skills e o disco tem **48** desde o `ADR-002` (`RESEARCH.md` §9-R2 registra as duas primeiras; as duas últimas são medição desta entrega). Uma forma de inventário que dependa de alguém digitar 66 linhas corretamente **já falhou quatro vezes antes de existir**.

**O segundo defeito, e o que realmente apodrece.** Um inventário derivado resolve o número, mas não resolve a **decisão**: existe ao menos um artefato que não tem consumidor e nem eixo — `harness-installer`, 22 citações a menos que qualquer outra skill local. Sem um lugar onde essa decisão more, o derivador só tem duas saídas ruins: pintar tudo de vermelho para sempre (o time aprende a ignorar) ou tratar "sem consumidor" como normal (aí a próxima skill órfã passa em silêncio). **A decisão deste ADR é sobre esse lugar** — o resto é aplicação.

## 2. Decisão

**O inventário canônico é uma superfície derivada (`V19` no runner selado), não um documento; e a única literal commitada é o `OWNER_DECISIONS` — o registry de decisões de órfão — cujas entradas expiram quando o sujeito desaparece ou deixa de ser órfão.** Classe nunca é escrita à mão: sai do `.vendor-lock.json` (skills), das estruturas do instalador (eixo) e do `opencode.json` (roster).

Uma coisa decidida; cinco consequências mecânicas. Cada uma responde a uma das perguntas abertas, com predicado e não com adjetivo.

### 2.1 O que é derivado × o que é commitado — a fronteira é "o que a máquina sabe", não "o que é confortável"

| Camada | Conteúdo | Onde vive | Apodrece? |
|---|---|---|---|
| **Derivado** (não commitado) | as 66 linhas, suas classes, as contagens, os eixos, a resolução dos prompts | função pura `deriveInventory(root)` | **Não**: não existe cópia para envelhecer. Contagem errada é impossível porque não há contagem escrita — há cálculo. |
| **Literal protegido** (commitado) | **só** `OWNER_DECISIONS` — uma entrada por artefato `orphan+decision`: `{ id, kind, owner, decision, reason, proof }` | `.opencode/plugins/lib/inventory/checks.mjs` (`protectedPaths`: `.opencode/plugins/**`) | **Sim, e é por isso que ele expira** (§2.4): entrada cujo sujeito desaparece, cujo `proof` morre ou cujo órfão ganha consumidor é **FAIL**. |
| **Snapshot datado** (não autoritativo) | a tabela da §3 deste ADR | `.spec/prd/**` (fora do corpus vivo; `ADR-005` §2.1 C5) | Sim, por construção — e é irrelevante: nenhum número deste ADR é fonte de verdade. Quem lê número lê a saída de `V19`. |

**Por que não existe `INVENTORY.md`, gerado ou não.** Três razões medidas: (a) o `PRD.md` §7 declara não-objetivo explícito *"definir formato de arquivo de inventário gerado"* — gerar arquivo está fora deste ciclo; (b) arquivo commitado é cópia, e cópia divergente é exatamente o defeito da §1; (c) um arquivo de 66 linhas reescrito a cada mudança de roster vira diff que o revisor aprova sem ler — o mesmo motivo pelo qual `git diff --exit-code` sobre artefato gerado é teatro de revisão. **A superfície de introspecção é o check**: ela não tem cópia, logo não tem drift.

### 2.2 Onde vive — e por que o destino não herda o vermelho

| Caminho | Propaga ao destino? | Prova | Consequência |
|---|---|---|---|
| `.opencode/plugins/lib/inventory/checks.mjs` (módulo puro) | **sim** (`.opencode/plugins` é camada inteira) | `installer/install.mjs:107`; `INCOMING_ROOTS` em `install.mjs:1686-1693` | o destino recebe o código; não recebe um veredito falso |
| `scripts/static-checks.mjs` (adapter / `V19`) | **não** (`scripts/` nunca é artefato de consumidor) | `install.mjs:1189-1195`, `:1736` | 🟢 neste repo · ⚠️ no destino não há caller até existir runner próprio (mesmo nível de `PRD-01`/`ADR-01`/`ADR-02` em `prd-adr-pipeline.md` §6) |
| `.agents/skills/.vendor-lock.json` (input da classe) | **não** — o instalador exclui o lock do que entrega | `install.mjs:1739` (`path.basename(rel) === VENDOR_LOCK_NAME`) | **no destino o lock é ausente por desenho** ⇒ o módulo **não classifica skill** lá e publica `lockPresent=false` |

**A consequência do lock ausente é uma decisão, não um acidente.** No destino, o conjunto de skills já foi **filtrado por eixo** pelo instalador: "vendorizada" e "local" descrevem a *origem* do artefato na casa de origem, não o destino. Derivar `orphan+decision` lá marcaria as 25 vendorizadas como órfãs (o lock não chegou) e o primeiro destino nasceria vermelho — inventário que nasce vermelho é inventário que morre na primeira semana. Por isso: **input ausente ⇒ classificação de skill suspensa com contador publicado**, nunca FAIL e nunca silêncio. `agents` e `rules` continuam deriváveis no destino (dependem de arquivos que propagam).

### 2.3 A álgebra das classes — ordem fixa, primeiro match vence, cada predicado com comando

**Por tipo de artefato, não por gosto.** Toda classe é derivada de um registro **declarado**; nenhuma de prefixo de nome (`RESEARCH.md` §6.2-E1: a heurística de prefixo erra **3 de 25** — `react-best-practices`, `nestjs-best-practices`, `react-components` não têm prefixo `dart-`/`flutter-`).

**Skills** (`id` = nome do diretório sob `.agents/skills/`):

| # | Classe | Predicado | Comando | Medido |
|---|---|---|---|---|
| 1 | `vendor-by-axis` | `id ∈ keys(.vendor-lock.json.skills)` | `node -e 'const l=require("./.agents/skills/.vendor-lock.json").skills;console.log(Object.keys(l).length)'` | **25** |
| 2 | `consumer` | `id` citado por ≥1 prompt do roster (resolvido de `agent.*.prompt`) **ou** por `opencode.json` | `grep -rlF <id> $(node -e '…prompts…') opencode.json` | **22** |
| 3 | `axis` | `id ∈ SKILLS_BY_AXIS[*]` (`install.mjs:396`) | `grep -c "SKILLS_BY_AXIS" installer/install.mjs` | **7** (as 2 locais de eixo têm consumidor e caem na 2.ª classe; o eixo delas sai na coluna `axis`, §3) |
| 4 | `orphan+decision` | nenhuma das anteriores ⇒ **exige** entrada em `OWNER_DECISIONS` | `node -e '…deriveInventory().counts.skills…'` | **1** |

**Rules** (`name` = arquivo sob `.agents/rules/`):

| # | Classe | Predicado | Medido |
|---|---|---|---|
| 1 | `consumer` | citada por ≥1 prompt do roster ou por `opencode.json` (por *basename*, que é como os agentes citam) | **7** |
| 2 | `axis` | `name ∈ RULES_BY_AXIS[*]` (`install.mjs:370`) | **1** (`frontend-react-coding-standards.md`) |
| 3 | `orphan+decision` | nenhuma das anteriores | **0** |

**Agents** (`name` = chave em `opencode.json.agent`):

| # | Classe | Predicado | Medido |
|---|---|---|---|
| 1 | `registered` | `name ∈ opencode.json.agent` **e** o caminho de `prompt` resolve no disco | **10** |
| 2 | `orphan+decision` | existe diretório em `.agents/agents/` sem chave no registro | **0** |

**A regra que impede "comprar isenção": `SKILLS_COMMON` e `RULES_COMMON` NÃO conferem classe.** Eles declaram *propagação a todo destino* (`install.mjs:380`, `:407`), não eixo nem consumo. Se `COMMON` conferisse classe, bastaria acrescentar uma skill à lista para ela sair do inventário sem decisão de dono — é precisamente o vetor de apodrecimento que este ADR existe para fechar. Consequência imediata e correta: `harness-installer` está em `SKILLS_COMMON` (`install.mjs:413`), **é** propagada a todo destino, e **mesmo assim** é `orphan+decision` (§3.1).

**A precedência tem uma consequência declarada: `vendor-by-axis` vence `consumer`.** Se uma skill vendorizada passar a ser citada por um agente, a classe **não** muda (D3 fechado); a citação aparece no contador `vendorCited` do `V19`, em PASS, para não virar dívida invisível — a mesma lição do `vendorOnly` do `V18` (`ADR-005` §8-N18). Medido hoje: `vendorCited=0`.

### 2.4 Como não apodrece — 7 modos de falha, cada um com fixture que o derruba

`runInventoryChecks(root)` devolve `{ ok, results: [{ id, status, detail, counters }] }`. Cada modo de falha é um id próprio, provado por árvore-fixture em `tempScope` (o padrão de `refs.spec.mjs`, nunca o repo real):

| id | O que significa | Veredito |
|---|---|---|
| `inventory-artifact-untracked` | artefato no disco sem classe derivável **e** sem entrada em `OWNER_DECISIONS` (skill/agente/rule nova) | **FAIL** |
| `inventory-class-ambiguous` | artefato casando ≥2 classes da mesma tabela | **FAIL** — força a precedência a ser **declarada** (§2.3), não descoberta pelo primeiro que rodar |
| `inventory-attendance-drift` | equação de fechamento por tipo quebra: `\|disco\| = Σ classes`; `\|registro\| = Σ classes de agente` | **FAIL**, com `counters` por tipo |
| `inventory-lock-disk-mismatch` | chave do lock sem diretório, ou diretório do lock sem `SKILL.md` | **FAIL** — `checkVendor` só anda lock→disco; esta é a outra direção |
| `inventory-agent-prompt-unresolved` | `agent.*.prompt` = `{file:X}` com `X` inexistente, ou chave sem `prompt` | **FAIL** |
| `owner-decision-incomplete` | entrada sem `owner`/`decision`/`reason`/`proof`, ou `proof` = `path:line` inexistente/que não cita o sujeito | **FAIL** (é o check que reprova, não o revisor) |
| `owner-decision-stale` | o sujeito da decisão desapareceu do disco, **ou** deixou de ser órfão (ganhou consumidor/eixo/lock) | **FAIL** — remover a entrada |

**Por que o registry expira em vez de só validar.** Uma lista de exceções que só cresce é permissão permanente com outro nome. As duas causas de `owner-decision-stale` cobrem as duas maneiras de uma entrada morrer: o artefato sai do disco, ou o motivo deixa de existir. Nos dois casos a entrada é removida — o registry **só encolhe ou se justifica**.

**Onde está a proteção:** o módulo mora em `.opencode/plugins/**` ⇒ `protectedPaths` (`harness.config.json`) ⇒ mudar `OWNER_DECISIONS` exige o trailer `Harness-Gate-Change` (pre-commit + `harness-integrity.yml`). Nível honesto: 🟢 *"órfão novo reprova a suíte selada"*; 🟠 *"quem editar `scripts/static-checks.mjs` (não protegido) e remover a chamada de `checkInventory()` escapa"* — mitigado por diff revisado + CI, não por runtime (idêntico ao `ADR-005` §2.5).

### 2.5 Rules entram — e o motivo é o RF, não preferência

`RF-01` diz, literalmente: *"inventário 1:1 de **agentes, skills e rules**"*. Rules entram por requisito. E não colidem com o `ADR-005`: **predicados distintos, objetos distintos** — `V18` responde *"esta prosa viva cita um `rules/*.md` que não existe?"* (referência órfã); `V19` responde *"este artefato que existe tem classe e dono?"* (artefato sem classe). Um arquivo pode estar classificado em `V19` e ser citado por prosa com path errado, e vice-versa; nenhum dos dois checks substitui o outro, e o `V19` **não** conta citação ausente (isso é escopo do `V18`, declarado).

Custo de incluir rules hoje: **1 linha** no registry de eixo que já existe (`RULES_BY_AXIS`, `install.mjs:370`) e **1** citação viva a menos que skills. Custo de **não** incluir: o `RF-01` fica com 2/3 dos artefatos, e a única rule sem consumidor do repo (`frontend-react-coding-standards.md`) fica sem lugar — vira o próximo "ninguém sabe se isso é dívida ou escolha".

## 3. Interface congelada

Cada item é verificável por comando, da raiz do repo. Onde a verificação depende de julgamento, o nível 🟡 está declarado. Itens marcados *(SDD)* só passam a valer depois da implementação — antes dela, o comando equivalente mede o **estado atual**, e o valor esperado está anotado.

1. **Módulo puro e propagável.** O inventário é `.opencode/plugins/lib/inventory/checks.mjs` (`.opencode/plugins` propaga: `install.mjs:107`), exportando `deriveInventory(root)`, `runInventoryChecks(root)`, `OWNER_DECISIONS`, `CLASS_LABELS`.
   *Verificação (SDD)*: `git ls-files .opencode/plugins/lib/inventory/` ⇒ não vazio; `grep -c "export function deriveInventory" .opencode/plugins/lib/inventory/checks.mjs` ⇒ `1`.

2. **Um único `record("V19", …)` no runner selado, e nenhum comando novo.** `checkInventory()` é chamado por `runStaticChecks()` em `scripts/static-checks.mjs`.
   *Verificação (SDD)*: `node scripts/static-checks.mjs | grep -c '^PASS V19'` ⇒ `1`; `grep -c "record(\"V19\"" scripts/static-checks.mjs` ⇒ `1`; `git diff --exit-code -- harness.config.json .opencode/plugins/lib/seal.mjs` ⇒ vazio.

3. **Selo intocado ⇒ custo zero de republicação.** `commands.suiteFull` permanece byte-idêntico ao de `cb0f08d`, logo `harness.config.json` não muda e `HARNESS_SEAL_JSON` **não** precisa ser republicado (`harness-config.md` §"Command seal"; risco R5 do `RESEARCH.md` §9 evitado por construção).
   *Verificação*: `node -e 'console.log(require("./harness.config.json").commands.suiteFull)'` ⇒ `node --test ".opencode/plugins/__tests__/*.spec.mjs" && node --test "installer/__tests__/*.spec.mjs" && node scripts/static-checks.mjs && node scripts/vendor-skills.mjs --check`.

4. **Classe de skill derivada do lock, com o número publicado.** `vendor-by-axis` ⟺ chave de `.vendor-lock.json.skills`; nenhuma heurística de prefixo.
   *Verificação*: `node -e 'console.log(Object.keys(require("./.agents/skills/.vendor-lock.json").skills).length)'` ⇒ `25`; `grep -c "startsWith" .opencode/plugins/lib/inventory/checks.mjs` ⇒ `0` *(SDD)*; `grep -c "inferStacks" .opencode/plugins/lib/inventory/checks.mjs` ⇒ `0` *(SDD)*.

5. **Fechamento aritmético por tipo, publicado em PASS.** `counters` carrega `agents`, `skills.{vendor-by-axis,consumer,axis,orphan}`, `rules.{consumer,axis,orphan}`, `vendorCited`, `lockPresent` — o detalhe do `V19` narra a mesma conta que o `RF-04` exige (`48 = 25 + 22 + 1`, `8 = 7 + 1 + 0`, `10 = 10 + 0`).
   *Verificação (SDD)*: `node --test .opencode/plugins/__tests__/inventory.spec.mjs` ⇒ 0 fail; `node scripts/static-checks.mjs | grep V19` ⇒ a linha de PASS contém `skills=48` e `vendorCited=`.

6. **Registry com 7 campos obrigatórios, e ele é o único literal.** Toda entrada de `OWNER_DECISIONS` tem `{ subject, class, owner, decision, reason, proof, expiresWhen }`; `proof` é `path:line` que **nomeia o `owner` ou o `subject`** e **não é o artefato do próprio sujeito**; `expiresWhen` é **superset** de `EXPIRY_CONDITIONS[class]` (conjunto fechado e executado — N21/N23).
   *Verificação*: `node -e 'import("./.opencode/plugins/lib/inventory/checks.mjs").then(m=>console.log(m.OWNER_DECISIONS.length, m.OWNER_DECISIONS.every(e=>e.owner&&e.decision&&e.reason&&e.proof)))'` ⇒ `1 true` no pós-SDD; hoje o valor equivalente é a contagem de órfãos: `1`.

7. **Órfão novo reprova; órfão decidido passa.** Uma skill/rule/agente criado sem classe e sem decisão ⇒ `inventory-artifact-untracked` FAIL. Com entrada completa ⇒ PASS.
   *Verificação (SDD)*: `node --test .opencode/plugins/__tests__/inventory.spec.mjs` prova o par PASS/FAIL com a **mesma** árvore e um arquivo de diferença.

8. **Decisão apodrecida reprova.** Remover o sujeito do fixture, ou dar-lhe um consumidor, ⇒ `owner-decision-stale` FAIL.
   *Verificação (SDD)*: idem, 2 casos dedicados (sujeito ausente; sujeito que passou a ser citado).

9. **Ambiguidade de classe reprova.** Um fixture onde o mesmo artefato casa `vendor-by-axis` **e** `axis` — contradição de **natureza**, não resolvida pela precedência ⇒ `inventory-class-ambiguous` FAIL. (`vendor × consumer` é **resolvido** por D3 e publicado em `vendorCited`; não é ambiguidade — N20.)
   *Verificação (SDD)*: 1 caso dedicado em `inventory.spec.mjs`.

10. **Attendance de agente é medida pelo registro, não pelo nome do arquivo.** O predicado resolve `agent.*.prompt` (`{file:./…}`); arquivo `AGENT.md` **não** é a unidade.
    *Verificação*: `node -e 'const a=require("./opencode.json").agent;const fs=require("fs");const r=Object.values(a).map(v=>(v.prompt||"").match(/\{file:(.+?)\}/)?.[1]).filter(Boolean);console.log(Object.keys(a).length, r.length, r.filter(p=>fs.existsSync(p)).length)'` ⇒ `10 10 10`; `ls .agents/agents/*/AGENT.md | wc -l` ⇒ `9` (e isso **não** é divergência: o 10.º é `code-reviewer/PROMPT.md`).

11. **Lock↔disco nas duas direções.** Chave sem diretório ⇒ FAIL; diretório com `SKILL.md` sem `SKILL.md` legível ⇒ FAIL. Fecha o que `checkVendor` (`scripts/vendor-skills.mjs:937`) não vê, porque ele itera **só** as chaves do lock.
    *Verificação*: `node -e 'const fs=require("fs");const l=Object.keys(require("./.agents/skills/.vendor-lock.json").skills);console.log(l.filter(k=>!fs.existsSync(".agents/skills/"+k)).length)'` ⇒ `0`.

12. **Destino não herda vermelho.** Sem `.vendor-lock.json` no root injetado, o check **não** classifica skill e publica `lockPresent=false`; `agents`/`rules` continuam derivados.
    *Verificação (SDD)*: 1 caso de fixture sem lock ⇒ `ok=true` com `counters.lockPresent=false`; e `grep -c "VENDOR_LOCK_NAME" .opencode/plugins/lib/inventory/checks.mjs` ⇒ `≥1`.

13. **Pureza.** Sem rede, MCP, `child_process` ou escrita; `node:fs` ler-only, `root` injetável (mesmo contrato de `refs/checks.mjs`).
    *Verificação (SDD)*: `grep -cE "child_process|fetch\(|https?:" .opencode/plugins/lib/inventory/checks.mjs` ⇒ `0`; `node --test .opencode/plugins/__tests__/inventory.spec.mjs` roda contra `tempScope`, não contra o repo.

14. **Zero edição fora de `.spec/prd/**` neste batch.** O commit do ADR toca **só** o `ADR.md` e o `ADR-INDEX.md`.
    *Verificação*: `git show --stat --name-only HEAD` ⇒ exatamente `.spec/prd/prd-harness-inventory/ADRs/ADR-004-inventario-canonico/ADR.md` + `.spec/prd/prd-harness-inventory/ADR-INDEX.md`; `node scripts/static-checks.mjs` ⇒ exit `0`.

## 4. Consequências

**C1 — Duas contagens do PRD ficam datadas, e eu não escondo.** `PRD.md` §5 e `RF-06` dizem **11** agentes; medido **10** (9 `AGENT.md` + 1 `PROMPT.md`, roster de 10) desde `ADR-001`. `PRD.md` §5 e `RF-04` dizem **49** skills; medido **48** desde `ADR-002` (o `prd-adr-pipeline` virou módulo). O inventário **deriva**, então o número errado não se propaga — mas o texto do PRD continua errado até alguém corrigi-lo. **Dívida declarada com dono**: correção de texto no PRD, mesma via que o `ADR-005`/D5 usou (`PRD.md` §16); não é escopo deste batch e não pode ser feita por inferência (`RF-07` manda registrar drift, não esconder).

**C2 — O inventário não vira SSoT de propagação.** `SKILLS_COMMON`, `SKILLS_BY_AXIS`, `RULES_COMMON`, `RULES_BY_AXIS` continuam **donos** do instalador (`install.mjs:370-421`); o `V19` **lê**, nunca copia. Copiar criaria dois registros para a mesma decisão — o defeito que o `ADR-002` já pagou para eliminar.

**C3 — O `V19` é o primeiro check que olha o *artefato* e não a *referência*.** Consequência de desenho: ele **não** pode reprovar por conteúdo (stack-bound, prosa datada) — isso é PRD 2 e `V18`. Um `V19` que opinasse sobre conteúdo seria o segundo inventário que apodrece, agora com opinião.

**C4 — O lock ausente no destino é comportamento declarado, não bug pendente.** Se o PRD 3/4 quiser que o destino derive a classe de skill, isso exige **propagar o `.vendor-lock.json`** — mudança no instalador (`install.mjs:1739`) e, por consequência, decisão sobre expor `source`/`commit` de terceiros no destino. **Fora deste ADR**, registrado aqui para não ser decidido por acidente.

**C5 — Custo de manutenção recorrente: 1 linha por órfão novo, 0 por artefato classificado.** Adicionar uma skill com consumidor não toca nada. Adicionar uma skill sem consumidor custa **1 entrada de 7 campos** em `OWNER_DECISIONS` — e essa é a fricção desejada: a decisão é humana, e o preço de não decidir é a suíte vermelha.

**C6 — 🟠 Escape declarado.** O adapter em `scripts/static-checks.mjs` não é `protectedPaths`; remover a chamada de `checkInventory()` desliga o check sem trailer. Ancora final é CI + diff revisado (mesmo estatuto do `ADR-005`), não runtime.

## 5. Riscos herdados do `RESEARCH.md` §9

- **R2 (drift de contagem na mesma data) — herdado e resolvido pela forma.** Este ADR publica apenas números que ele mesmo re-deriva (§1), e a forma escolhida torna drift de contagem *impossível de persistir*: não há contagem escrita na superfície canônica. As duas divergências que o R2 não cobria (11→10 agentes, 49→48 skills) estão em **C1**, com comando.
- **R5 (custo de `suiteFull` mutável) — evitado, com o custo medido.** A alternativa "comando novo em `suiteFull`" mudaria a string selada ⇒ **1** republicação de `HARNESS_SEAL_JSON` no trust root (`harness-config.md` §"Command seal"), ato do operador do host, não do worktree. O adapter dentro de `scripts/static-checks.mjs` custa **0**. (§6, D2 × D2-bis.)
- **R8 (índice 1:1 × suíte verde) — respeitado.** A linha `order 4` entra no **mesmo commit** do `ADR.md`, mantendo `ADR-01` verde e exatamente 1 linha `in-progress` (o `ADR-005` está `merged` desde `cb0f08d`).

## 6. Alternativas descartadas

**Forma (RESEARCH §6.1):**

| Alternativa | Custo medido neste repo | Por que não |
|---|---|---|
| **D1. `INVENTORY.md` escrito à mão** | 0 infra; **4 divergências em <1 dia** só no PRD (7×10 arquivos, 13×20 paths, 11×10 agentes, 49×48 skills). Detecção automática: **0** — nada fica vermelho quando o documento envelhece. | É literalmente o defeito que o PRD existe para corrigir. |
| **D2. Script + **comando novo** em `commands.suiteFull`** | 1 string selada alterada ⇒ **1** republicação de `HARNESS_SEAL_JSON` (ato no host) + novo round-trip de selo a cada ajuste do comando; `seal.mjs` tem 3 funções (`sha256`/`sealCommands`/`verifySeal`) e GATE-01 compara com o selo publicado. | Custo recorrente por um ganho que o adapter entrega de graça. |
| **D3. Gerado + commitado + `git diff --exit-code`** | 1 arquivo de **66 linhas** reescrito a cada mudança de roster + 1 passo de pré-commit (rodar o gerador) + 1 check; **colide** com o não-objetivo do `PRD.md` §7 ("definir formato de arquivo de inventário gerado"). | Diff gerado é aprovado sem leitura; e o formato de arquivo está fora do ciclo. |
| **D2-bis (escolhida). Derivação dentro de `scripts/static-checks.mjs`** | 1 módulo + 1 adapter + 1 spec; **0** comando novo, **0** selo republicado; superfície = saída do `V19`. | Única forma em que o número não tem cópia. |

**Classe (RESEARCH §6.2):**

| Alternativa | Custo medido | Por que não |
|---|---|---|
| **E1. Prefixo do nome** | Erra **3 de 25** (12%): `react-best-practices`, `nestjs-best-practices`, `react-components`; e um local futuro `flutter-*` seria vendorizado por engano. Existe no repo hoje só no caminho de *build* (`inferStacks`, `scripts/vendor-skills.mjs:636`). | Ambiguidade no disco, exatamente o que o RF-04 proíbe. |
| **E2. Chaves do `.vendor-lock.json` (escolhida)** | 0 arquivo novo; 25 chaves lidas; **0** bytes de skill editados; o lock já carrega `stacks`/`source`/`license`/`treeHash`. | — |
| **E3. `license` do frontmatter de cada `SKILL.md`** | 48 `SKILL.md` editados e **25** `treeHash` quebrados ⇒ `node scripts/vendor-skills.mjs --check` (hoje `OK`) passaria a FAIL em 25 skills. | Destrói a integridade do vendor para ganhar um campo. |

**Formas híbridas rejeitadas por princípio (não por custo):** registry de **todas** as 66 linhas commitado (reintroduz a cópia de D3 com outro nome); markdown gerado **e** check (custo de D3 sem o benefício); exceção "skill sem consumidor é OK se for vendorizada" codificada como *allowlist de nome* (seria `E1` de novo, com outra roupa — a classe já vem do lock).

## 7. Critérios de verificação

```bash
# 1) o batch do ADR não toca código: só .spec/prd/**
git show --stat --name-only HEAD

# 2) a suíte selada continua verde e o V19 (pós-SDD) aparece 1×
node --test ".opencode/plugins/__tests__/*.spec.mjs" \
  && node --test "installer/__tests__/*.spec.mjs" \
  && node scripts/static-checks.mjs \
  && node scripts/vendor-skills.mjs --check

# 3) nenhum comando novo, nenhum selo republicado
git diff --exit-code -- harness.config.json .opencode/plugins/lib/seal.mjs
node -e 'console.log(require("./harness.config.json").commands.suiteFull)'

# 4) os números da §1 são os que o disco diz (re-derivação, não confiança)
ls -d .agents/skills/*/ | wc -l                                    # 48
node -e 'console.log(Object.keys(require("./.agents/skills/.vendor-lock.json").skills).length)'  # 25
node -e 'console.log(Object.keys(require("./opencode.json").agent).length)'                       # 10
ls .agents/agents/*/AGENT.md | wc -l                               # 9  (o 10.º é PROMPT.md)
ls .agents/rules/*.md | wc -l                                      # 8

# 5) o índice continua 1:1 com o disco e com 1 só in-progress
node scripts/static-checks.mjs | grep -E '^(PASS|FAIL) (ADR-01|ADR-02|PRD-01)'

# 6) pós-SDD: o inventário se deriva e o registry expira
node -e 'import("./.opencode/plugins/lib/inventory/checks.mjs").then(m=>console.log(JSON.stringify(m.deriveInventory().counts)))'
node --test .opencode/plugins/__tests__/inventory.spec.mjs
```

**Aceite:** (a) `node scripts/static-checks.mjs` ⇒ exit `0`; (b) `V19` ⇒ `PASS` com `skills=48` e `rules=8` e `agents=10` na linha; (c) os 7 ids de §2.4 provados por fixture que **derruba** (não asserção de fachada); (d) `harness.config.json` e `seal.mjs` sem diff; (e) zero edição em `.agents/**`, `installer/**`, `scripts/**` e `opencode.json` **neste batch**.

## 8. Notas de correção (divergências medidas entre PRD/RESEARCH e disco)

**(N1) 11 agentes → 10.** `PRD.md` §3.1/§5/`RF-06` medem "11 `AGENT.md`". Pós-`ADR-001`: 10 registros e 10 arquivos de prompt, dos quais **9** são `AGENT.md` e **1** é `PROMPT.md`. Comando da §3-IF10. A unidade do inventário é o **registro**, não o nome do arquivo — medir por `AGENT.md` produziria 1 falso órfão (`code-reviewer`) e 1 agente perdido.

**(N2) 49 skills → 48.** `PRD.md` §3.2/§5/`RF-04` contam 49. O `ADR-002` removeu a skill `prd-adr-pipeline` (virou módulo). Comando: `ls -d .agents/skills/*/ | wc -l` ⇒ `48`; `ls .agents/skills/*/SKILL.md | wc -l` ⇒ `48` (nenhuma skill sem `SKILL.md` — o `RF-04` fala de 48 com `SKILL.md`, e agora os dois números coincidem).

**(N3) 27 "sem consumidor" → 26.** O `RESEARCH.md` §6 e o `PRD.md` §5 medem 27 órfãs de consumidor. Pós-`ADR-003`, `dev-planner` ganhou consumidor (`planner`): medido **26** (25 vendorizadas + `harness-installer`), e desse total apenas **1** é órfã de verdade, porque as 25 têm eixo declarado no lock (D3).

**(N4) As 25 vendorizadas têm `stacks` não vazio, e 3 delas não são mobile.** Medido: 22 `dart`/`flutter` + `react-components`/`react-best-practices` (`react`) + `nestjs-best-practices` (`nestjs`). As 3 últimas são a prova viva de que `E1` (prefixo) erraria — não há prefixo distintivo que as separe das locais.

**(N5) `code-reviewer` não tem `AGENT.md`.** Diretório com `PROMPT.md` (`opencode.json.agent["code-reviewer"].prompt` = `{file:./.agents/agents/code-reviewer/PROMPT.md}`, 4.526 bytes). Não é divergência: é a decisão do `ADR-001` (stub removido, alvo do registro mantido). O inventário resolve o prompt, não o nome do arquivo.

**(N6) `harness-installer` é a única órfã local, e ela é deliberada.** Está em `SKILLS_COMMON` (`install.mjs:413`) ⇒ propagada a todo destino; não é citada por nenhum prompt de agente. Decisão registrada abaixo, como **entrada de registry** — é o exemplo canônico do formato que o SDD vai implementar.

```js
// OWNER_DECISIONS — a ÚNICA literal do inventário (1 entrada hoje)
{
  id: "harness-installer",
  kind: "skill",
  owner: "installer/install.mjs (fluxo de instalação)",
  decision: "keep",
  reason: "manual operacional do instalador, distribuído a todo destino por SKILLS_COMMON; o consumidor é o operador que roda `node installer/install.mjs`, não um agente do roster",
  proof: "installer/install.mjs:413",
}
```

**Veredito sobre o dono:** o dono **não** é um agente — é o fluxo de instalação, e a prova é a linha que a declara em `SKILLS_COMMON`. A entrada **expira** (`owner-decision-stale`) se a skill sair do disco, se `install.mjs:413` deixar de citá-la, ou se algum prompt de agente passar a citá-la — nesse último caso a classe vira `consumer` e o registro some, porque deixou de haver decisão a tomar.

**(N7) `frontend-react-coding-standards.md` é a única rule sem consumidor — e não é órfã.** Está em `RULES_BY_AXIS['frontend=vue']` (`install.mjs:370`): só entra em destino Vue. Classe `axis`, não `orphan+decision`. Se o mapa for removido, ela vira órfã e o `V19` reprova — o que é o comportamento correto.

**(N8) O `V18` não cobre este escopo e vice-versa.** `V18` casa `rules/[a-z0-9-]+\.md` em prosa viva (`ADR-005` §2.5); `V19` casa artefato em disco. Nenhum dos dois substitui o outro; ambos rodam no mesmo `runStaticChecks()`, com ids distintos.

## 9. O que fica para o SDD

1. Criar `.opencode/plugins/lib/inventory/checks.mjs` com `deriveInventory`, `runInventoryChecks`, `OWNER_DECISIONS` (1 entrada, N6), `CLASS_LABELS` e os 7 ids de falha (§2.4).
2. Registrar `checkInventory(root)` e **um** `record("V19", …)` em `scripts/static-checks.mjs` — sem tocar `commands.suiteFull` (IF-2, IF-3).
3. Escrever `.opencode/plugins/__tests__/inventory.spec.mjs` no padrão de `refs.spec.mjs`: fixture em `tempScope`, par PASS/FAIL com 1 arquivo de diferença, 1 caso por id de falha, 1 caso sem lock (IF-12).
4. Fazer o `V19` publicar `counters` em PASS (`skills=48`, `rules=8`, `agents=10`, `vendorCited=0`, `lockPresent=true`) — a lição do `ADR-005` §8-N18.
5. Rodar `commands.suiteFull` completo e `node scripts/sdd-checks.mjs` antes do merge; `VERIFY.md` com as 3 dimensões.
6. Corrigir, **em ciclo separado com dono**, as duas contagens do PRD (C1/N1/N2) — este ADR não edita `PRD.md`.

- **N20 — item 9 contradizia §2.3/§2.4 e foi emendado.** O texto dizia que `vendor-by-axis ∧ consumer` reprova; o código (e D3) **resolvem** esse par e publicam `vendorCited`. `inventory-class-ambiguous` é para **contradição de natureza** (`vendor ∧ axis`). O item agora diz isso.
- **N21 — `expiresWhen` era auto-declarado (C1 do review).** A validação aceitava **qualquer** subconjunto das condições da classe; quem escrevia a entrada escolhia do que ela expirava (ex.: só `subject-absent`) e a supressão ficava permanente se o sujeito apenas ganhasse consumidor. Com isso I3 ("não existe supressão permanente") era falso. Passa a exigir `expiresWhen ⊇ EXPIRY_CONDITIONS[class]` — a string vira documentação de um conjunto **fechado e executado**.
- **N22 — proof podia ser o próprio artefato do sujeito (I1 do review).** `proof` só precisava citar o sujeito, então `proof: .agents/skills/<a própria skill>:1` satisfazia a letra de §2.4 e falhava o RF-01 ("fonte de evidência"). Passa a exigir que a linha citada nomeie **owner** ou **subject**, e que `proof` não seja o artefato do próprio sujeito.
- **N23 — registry: renomes e contagem.** Item 6 dizia "5 campos" e enumerava 6; a SPEC RF-05 listava 6 sem `decision`; o código usa 7 (`subject/class/owner/decision/reason/proof/expiresWhen`). Item 6 passa a declarar os **7** nomes do código — renomear por estética seria drift de contrato (a SPEC diz "em conflito, o ADR prevalece").
- **N24 — §7(e) dizia "zero edição em `scripts/**`" e §9-2 exige o adapter.** Corrigido: o adapter em `scripts/static-checks.mjs` é edição **autorizada** deste batch; o que não pode mudar é `commands.suiteFull` e `seal.mjs`.
- **N25 — lock ilegível era tratado como ausente (I4 do review).** `loadLock` devolvia `null` para arquivo **ausente** e para arquivo **inválido**, publicando `lockPresent=false` — mentira sobre um input presente. Passa a distinguir: ausente ⇒ `lockPresent=false` (legítimo no destino); **inválido ⇒ FAIL**.
- **N26 — declaração fantasma só falava pelo agregado (I3 do review).** `SKILLS_COMMON` com nome sem diretório não tinha id de causa; o fechamento aceitava par compensatório (remove 1, inventa 1). Id próprio `inventory-declaration-phantom` acrescentado.
- **N27 — a justificativa escrita do import estava errada (achado do review).** O código faz `import { SKILLS_BY_AXIS, RULES_BY_AXIS, … } from "../installer/install.mjs"`; o comentário descrevia "leitura de arquivo/parse de fonte". Não há parse: `install.mjs` é **módulo**, o CLI é guardado por `import.meta.url === file://${process.argv[1]}` (`install.mjs:2746`), e o import custa ~17ms sem efeito colateral. O desenho **está correto** (contrato do dono em vez de gramática de código); a prosa é que mentia. Corrigida no código (`static-checks.mjs:47-54,73-76`; `checks.mjs:268-272`). É o mesmo defeito DOC-01 que este PRD vem caçando: descrição de mecanismo inexistente.

- **N28 — R6 do review: N23 afirmou emenda que o item 6 não tinha.** O item 6 continuava dizendo "5 campos" e enumerando 6, enquanto o código usa 7. Corrigido agora no próprio item 6 e em C5. Lição repetida do ADR-003: **nota que descreve emenda não é emenda** — o texto normativo tem de mudar.
