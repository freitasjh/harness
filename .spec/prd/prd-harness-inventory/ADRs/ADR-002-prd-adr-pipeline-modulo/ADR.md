# ADR-002 — `prd-adr-pipeline` como módulo de regra/checks: o check executável sai de `.agents/skills/` para `.opencode/plugins/lib/`, a norma fica na rule

- **prd-id**: `prd-harness-inventory` — `.spec/prd/prd-harness-inventory/PRD.md`
- **order**: 2 de 5 (`.spec/prd/prd-harness-inventory/ADR-INDEX.md`)
- **status**: `in-progress`
- **branch**: `adr/prd-harness-inventory/02-prd-adr-pipeline-modulo`
- **depende-de**: — (nenhum ADR deste ciclo é pré-requisito formal; `ADR-001` **já entrou** em `fe7c408` e a ordem de execução preferível do `RESEARCH.md` §9-R4 — reapontar 3 citações em vez de 4 — está satisfeita **de fato**, não por dependência declarada)
- **data**: 2026-11-11
- **dono da decisão**: owner do harness — portão **G1**, `PRD.md` §16, decisão **D4 = reclassificar `prd-adr-pipeline` como módulo de regra/checks e reapontar as citações**
- **rota**: Refactor
- **insumo de pesquisa**: `RESEARCH.md` §4 (tema B, alternativas B1–B3) e §9 (riscos R1, R4)
- **escopo de escrita desta entrega**: `.spec/prd/prd-harness-inventory/**`. Nenhum `.mjs`, `AGENT.md`, rule, `installer/` ou `harness.config.json` foi editado — a implementação é o SDD deste ADR.

## 1. Contexto

`.agents/skills/` é um namespace com **um** contrato: skill é diretório com `SKILL.md`
obrigatório, e o `name` do frontmatter casa com o nome do diretório (fonte **S2** do
`RESEARCH.md` §2). Medido neste repo em 2026-11-11:

| Fato medido | Valor | Comando de origem |
|---|---|---|
| Diretórios em `.agents/skills/` | **49** | `ls -d .agents/skills/*/ \| wc -l` |
| Diretórios **sem** `SKILL.md` | **1** — `.agents/skills/prd-adr-pipeline/` | laço `[ -f "$d/SKILL.md" ]` |
| Conteúdo desse diretório | **5** arquivos: `checks.mjs` (504 l.) + `templates/{PRD,RESEARCH,ADR,ADR-INDEX}.md` | `find` + `wc -l` |
| Skills **locais** (sem entrada no `.vendor-lock.json`) | **24** — logo `prd-adr-pipeline` é contado como skill local | `realLocalSkills()` = dirs − chaves do lock |
| Arquivos que **importam** `checks.mjs` | **2** — `scripts/static-checks.mjs:28`, `.opencode/plugins/__tests__/prd-checks.spec.mjs:29` | `grep -rn "prd-adr-pipeline/checks.mjs" --include=*.mjs` |
| Agentes que citam `prd-adr-pipeline` | **3** — `orchestrator:273` (path de `checks.mjs`), `product-manager:10` e `architect:11` (**já** citam a **rule**, não a skill) | `grep -rn "prd-adr-pipeline" .agents/agents/` |
| `SKILLS_COMMON` (registro de skills locais comuns do instalador) | contém `'prd-adr-pipeline'` em `installer/install.mjs:419` | `grep -n` |
| `RULES_COMMON` (registro de rules comuns) | contém `'prd-adr-pipeline.md'` em `installer/install.mjs:384` | `grep -n` |
| Testes da suíte do instalador | **559** (559 pass, 0 fail) | `node --test "installer/__tests__/*.spec.mjs"` |

Quatro defeitos, todos medidos, nenhum de opinião:

1. **O namespace mente.** Um diretório sem `SKILL.md` mora em `skills/`. Ferramenta que
   assume `<dir>/SKILL.md` existe (o próprio vendor hasheia `SKILL.md`) não encontra skill
   ali — e o instalador o trata como skill local, porque `realLocalSkills()` classifica
   por **ausência de entrada no lock**, não por presença de `SKILL.md`.
2. **O registro do instalador mente junto.** `SKILLS_COMMON` é a lista de *skills* locais
   comuns; `prd-adr-pipeline` está nela. O instalador declara, por dados, que um módulo de
   checks é uma skill.
3. **A justificativa registrada do path está expirada — medida, não suposta.**
   `checks.mjs:15-16` afirma: *"Lives under `.agents/skills/**` because that is the only
   path the installer propagates (ADR-P02)"*. **Hoje isso é falso**: `collectIncoming`
   entrega `.opencode/plugins/lib/config.mjs` e `.opencode/plugins/lib/seal.mjs` a todo
   destino (2 arquivos medidos). Ou seja, o `lib/` dos plugins já é um path propagado — a
   premissa que forçou o módulo para dentro de `skills/` deixou de valer sem que ninguém
   revisse a decisão.
4. **A prosa repete a premissa expirada em mais 2 lugares** além de `checks.mjs:15-16`:
   `scripts/static-checks.mjs:25-27` (comentário do import) e `docs/FUNCIONAMENTO.md:109`
   (lista `prd-adr-pipeline` entre as skills).

O risco que motivou o `RESEARCH.md` §9-**R1** é o inverso do defeito 3: **se o módulo sair
para um path que o instalador não conhece, o repo-destino perde `checks.mjs` + os 4
templates em silêncio**. Medido agora, esse risco é real e não é teórico:

```sh
# fonte temporária com o módulo em um path NOVO (.agents/modules/**) e nada mais
node --input-type=module -e '… collectIncoming(src,{stack:"node"}) …'
# => arquivos entregues sob .agents/modules/: 0   (com a fonte contendo 5 arquivos lá)
```

Novo path sem layer no instalador ⇒ **0 de 5 entregues**. Por isso a decisão abaixo não
cria layer nenhum: ela usa um layer que **já está nos dois registros** do instalador.

## 2. Decisão

**`prd-adr-pipeline` deixa de ser skill: a norma permanece na rule
`.agents/rules/prd-adr-pipeline.md` (único SSoT normativo) e o artefato executável —
`checks.mjs` + os 4 templates — passa a ser um módulo em
`.opencode/plugins/lib/prd-adr-pipeline/`. O instalador perde exatamente 1 entrada de
registro (`SKILLS_COMMON`) e ganha 0 mecanismo novo.**

Três operações, uma consequência única (o artefato passa a morar no layer do seu próprio
tipo, sem perder propagação):

| # | Operação | Escopo medido |
|---|---|---|
| 1 | **Mover** os 5 arquivos para `.opencode/plugins/lib/prd-adr-pipeline/` (`checks.mjs` + `templates/`), preservando nomes e conteúdo | 5 arquivos; `git mv` |
| 2 | **Reapontar** os 2 imports, o guard de pureza, os 4 paths de template no teste, 1 citação de agente e 2 rules | 2 `.mjs` + 1 spec (3 sítios) + 1 `AGENT.md` + 2 rules |
| 3 | **Limpar o registro e a prosa**: `SKILLS_COMMON` perde `'prd-adr-pipeline'`; `checks.mjs` e `static-checks.mjs` trocam a justificativa expirada pela real; `docs/FUNCIONAMENTO.md` deixa de listar o módulo como skill | 1 linha de instalador + 3 sítios de prosa |

**Por que este layer, e não outro** — critério: o layer escolhido tem de estar **já** nos
dois registros do instalador (`LAYER_PREFIX`, `installer/install.mjs:101-108`, para o
inventário/backup; `INCOMING_ROOTS`, `:1685-1692`, para a propagação), senão o ADR inventa
capacidade. Medido:

| Layer | Em `LAYER_PREFIX` | Em `INCOMING_ROOTS` | Entrega 5/5 hoje | Mecanismo novo |
|---|---|---|---|---|
| `.agents/skills/**` (atual) | sim | sim | **sim** | 0 — mas é o namespace de skill |
| **`.opencode/plugins/lib/**`** (escolhido) | **sim** (`:107`) | **sim** (`:1690`) | **sim** (2 arquivos medidos) | **0** |
| `.agents/rules/**` | sim | sim | sim | 0 — mas 5 arquivos caem na enumeração de rules (§7, B2c) |
| `.agents/modules/**` (novo) | **não** | **não** | **0 de 5** | +2 registros + 1 mapa de eixo + 1 validador + 1 teste de enumeração |

E **por que é a classificação certa, não só a conveniente**: o repo **já** tem o par
"rule normativa em `.agents/rules/` + mecanismo em `.opencode/plugins/lib/`" —
`harness-config.md` (rule) ↔ `lib/config.mjs` (mecanismo), consumido por `gate.js` **e**
por `scripts/static-checks.mjs`, propagado ao destino e **sem** mapa de eixo. Este ADR
aplica o mesmo par a `prd-adr-pipeline.md` ↔ `lib/prd-adr-pipeline/`. Zero padrão novo.

Sobre **gate por eixo** neste layer: `.opencode/plugins/**` **não** tem mapa de eixo, e
isso é o correto — a esteira é comum a **todo** destino (a rule já está em
`RULES_COMMON`, `installer/install.mjs:384`). O gate declarado do layer é
`LAYER_PREFIX` (inventário) + `INCOMING_ROOTS` (propagação) + a exclusão única
`CONSUMER_EXCLUDED_PREFIXES = ['.opencode/plugins/__tests__/']` (`:1693`). Nenhum mapa
novo é criado — criar um seria inventar capacidade para um artefato que **não** é
excludente por eixo.

**Fora desta decisão** (declarado, não decidido aqui): agnosticização do conteúdo de
rules/templates (PRD 2), agente `planner` (ADR-003), inventário derivado e classe das 49
(ADR-004), prosa órfã (ADR-005). Também **não** é decidido aqui: o formato V2 de registro
em `opencode.json`, nem renomear `checks.mjs`, nem alterar o contrato
`runPrdChecks(root) → { ok, results }`.

## 3. Interface congelada

Cada item é verificável por comando, roda da raiz do repo, e é o que o SDD deste ADR tem
de entregar. **O item 1 é a interface de propagação** — a regressão silenciosa que o
`RESEARCH.md` §9-R1 aponta: é ele que prova que o repo-destino continua recebendo o módulo.

1. **O destino recebe 5/5 arquivos no path novo e 0 no antigo, em todo eixo.**
   A entrega é a mesma função que o instalador usa para montar o plano (`collectIncoming`),
   e a prova fim-a-fim é uma instalação real em diretório temporário.
   *Verificação*:
   ```sh
   node --input-type=module -e '
     import { collectIncoming } from "./installer/install.mjs";
     for (const stack of ["java+vue","java+react","node","flutter"]) {
       const inc = collectIncoming(".", { stack });
       const novo = Object.keys(inc).filter(k=>k.startsWith(".opencode/plugins/lib/prd-adr-pipeline/"));
       const velho = Object.keys(inc).filter(k=>k.startsWith(".agents/skills/prd-adr-pipeline/"));
       console.log(stack, novo.length, velho.length);
     }'   # esperado, 4 linhas: 5 0
   D=$(mktemp -d); node --input-type=module -e '
     import { main, collectIncoming } from "./installer/install.mjs";
     import fs from "node:fs"; import os from "node:os";
     const out = main({ target: process.argv[1],
       scriptedAnswers: { project:"adr002", stack:"node", suiteCommand:"node", pluginsDir:process.argv[1] },
       incomingFiles: collectIncoming(".", { stack:"node" }),
       options: { allowRoot:false, backupRoot: fs.mkdtempSync(os.tmpdir()+"/bk-"), yes:true } });
     console.log("exitCode", out.exitCode);' "$D"
   find "$D/.opencode/plugins/lib/prd-adr-pipeline" -type f | wc -l   # 5
   rm -rf "$D"
   ```
   (O comando gêmeo roda hoje contra o path **antigo** e devolve `5 0` com
   `.agents/skills/...` — é a linha de base que este item inverte.)

2. **O namespace `skills/` volta a ser uniforme: 48 diretórios, 48 com `SKILL.md`, 0 sem.**
   `.agents/skills/prd-adr-pipeline/` não existe.
   *Verificação*: `ls -d .agents/skills/*/ | wc -l` ⇒ `48`;
   `for d in .agents/skills/*/; do [ -f "$d/SKILL.md" ] || echo "SEM: $d"; done` ⇒ vazio;
   `test ! -e .agents/skills/prd-adr-pipeline && echo ABSENT` ⇒ `ABSENT`.

3. **Os 2 imports apontam para o path novo e nenhum `.mjs` cita o antigo.**
   *Verificação*:
   ```sh
   grep -rn "skills/prd-adr-pipeline" --include=*.mjs . | wc -l    # 0
   node --input-type=module -e 'import("./.opencode/plugins/lib/prd-adr-pipeline/checks.mjs").then(m=>console.log(typeof m.runPrdChecks))'  # function
   node scripts/static-checks.mjs | grep -c "^PASS PRD-01"          # 1
   node --test ".opencode/plugins/__tests__/prd-checks.spec.mjs"    # 0 fail
   ```

4. **Os 4 paths de template do teste seguem o módulo.**
   `.opencode/plugins/__tests__/prd-checks.spec.mjs:1125-1129` deixa de derivar de
   `SKILLS` e passa a derivar de `LIB = join(REPO, ".opencode", "plugins", "lib")`; os 4
   templates continuam sendo lidos (os testes de template seguem verdes).
   *Verificação*: `grep -c "templates/PRD.md\|templates/RESEARCH.md\|templates/ADR.md\|templates/ADR-INDEX.md" .opencode/plugins/__tests__/prd-checks.spec.mjs` ⇒ ≥4;
   `node --test ".opencode/plugins/__tests__/prd-checks.spec.mjs"` ⇒ 0 fail.

5. **O guard de pureza segue lendo o módulo, no path novo, e segue verde.**
   O `MODULE` do `describe("checks.mjs module-loading guard")`
   (`prd-checks.spec.mjs:915-923`) passa de `.agents/skills/…` para
   `.opencode/plugins/lib/prd-adr-pipeline/checks.mjs`; o conjunto de specifiers
   estáticos continua exatamente `{node:fs, node:path}` e os 4 tokens ambiente continuam
   ausentes.
   *Verificação*: `node --test ".opencode/plugins/__tests__/prd-checks.spec.mjs"` ⇒ 0 fail;
   `grep -c "node:fs\|node:path" .opencode/plugins/lib/prd-adr-pipeline/checks.mjs` ⇒ ≥2.

6. **A prosa expirada morre nos 3 sítios — `grep` de prova por sítio.**
   `checks.mjs` (cabeçalho, hoje `:15-16`), `scripts/static-checks.mjs` (hoje `:25-27`) e
   `docs/FUNCIONAMENTO.md` (hoje `:109`) deixam de afirmar que `skills/` é o único path
   propagado / que o módulo é uma skill.
   *Verificação*:
   ```sh
   grep -c "only path the installer propagates" .opencode/plugins/lib/prd-adr-pipeline/checks.mjs scripts/static-checks.mjs   # 0 e 0
   grep -rn "skills/prd-adr-pipeline" docs/ README.md .agents/ | wc -l                                                        # 0
   ```

7. **O registro do instalador para de chamar o módulo de skill — e o efeito é 1 linha.**
   `installer/install.mjs:419` (`'prd-adr-pipeline',` em `SKILLS_COMMON`) é **removida**;
   `SKILLS_COMMON` fica com **22** entradas (medido; o ADR previu 23 — ver N11) e `realLocalSkills()` com **23** diretórios;
   os 2 testes de enumeração (`BUG-2`, `eixos-stack.spec.mjs:529-560`) continuam verdes
   nas **duas** direções (disco→lista e fantasma).
   *Verificação*:
   ```sh
   node --input-type=module -e 'import("./installer/install.mjs").then(m=>console.log(m.SKILLS_COMMON.length, m.SKILLS_COMMON.includes("prd-adr-pipeline")))'  # 22 false (medido; N11)
   node --test "installer/__tests__/*.spec.mjs" | grep -E "^ℹ (tests|pass|fail)"   # 559 / 559 / 0
   ```

8. **A rule continua registrada e entregue — remover a entrada **errada** não pode apagar a certa.**
   `installer/install.mjs:384` mantém `'prd-adr-pipeline.md'` em `RULES_COMMON`; a rule
   continua indo para todo destino; `installer/install.mjs` cita `prd-adr-pipeline`
   **1** vez, não 0.
   *Verificação*: `grep -c "prd-adr-pipeline" installer/install.mjs` ⇒ `1`;
   `grep -c "'prd-adr-pipeline.md'" installer/install.mjs` ⇒ `1`.

9. **As citações de agente apontam para o que existe.**
   `orchestrator/AGENT.md:273` troca `.agents/skills/prd-adr-pipeline/checks.mjs` por
   `.opencode/plugins/lib/prd-adr-pipeline/checks.mjs`; `product-manager:10` e
   `architect:11` **não mudam** (já citam a rule, que é o SSoT). Nenhum agente cita path
   de skill do módulo.
   *Verificação*: `grep -c "skills/prd-adr-pipeline" .agents/agents/orchestrator/AGENT.md .agents/agents/product-manager/AGENT.md .agents/agents/architect/AGENT.md` ⇒ `0 0 0`;
   `grep -rc "prd-adr-pipeline" .agents/agents/*/AGENT.md | grep -v ":0"` ⇒ 3 arquivos.

10. **As 2 rules citam o path novo, sem crescer orçamento.**
    `.agents/rules/prd-adr-pipeline.md:63-65` (*"é **path propagável**"*) passa a nomear
    `.opencode/plugins/lib/prd-adr-pipeline/` e a declarar o que é **módulo** aqui
    (mecanismo executável, não playbook carregável); `.agents/rules/workflow-rules.md:322`
    idem. `.agents/rules/prd-adr-pipeline.md` continua **≤80 linhas** (hoje 79) e o total
    de `.agents/rules` continua **≤1705** (hoje 1290). Ambas são path protegido ⇒ o commit
    carrega o trailer `Harness-Gate-Change` (🟠 CI, ADR-007).
    *Verificação*: `grep -c "skills/prd-adr-pipeline" .agents/rules/*.md` ⇒ `0` em todos;
    `wc -l .agents/rules/prd-adr-pipeline.md` ⇒ `≤80`; `cat .agents/rules/*.md | wc -l` ⇒ `≤1705`.

11. **Nada de runtime de gate muda: `gate.js` e o config ficam byte-idênticos, e o selo NÃO é republicado.**
    `commands.suiteFull` não ganha nem perde comando ⇒ `HARNESS_SEAL_JSON` segue válido
    (`harness-config.md` §"Command seal"). O módulo passa a morar dentro de
    `SCAN_DIRS = [".agents/schemas", ".opencode/plugins/lib"]`
    (`scripts/static-checks.mjs:47`) — logo `V2`/`V3`/`V7` passam a **varrê-lo**, e têm de
    continuar em 0 (medido hoje: nenhum dos 3 padrões aparece em `checks.mjs` nem nos
    templates).
    *Verificação*: `git diff --stat .opencode/plugins/gate.js harness.config.json` ⇒ vazio;
    `git diff --stat harness.config.json | grep -c suiteFull` ⇒ `0`;
    `node scripts/static-checks.mjs | grep -E "^(PASS|FAIL) (V2|V3|V7)"` ⇒ 3 PASS.

12. **Suíte completa verde ao fim do SDD, e `sdd-checks` sem FAIL.**
    *Verificação*:
    ```sh
    node --test ".opencode/plugins/__tests__/*.spec.mjs" \
      && node --test "installer/__tests__/*.spec.mjs" \
      && node scripts/static-checks.mjs \
      && node scripts/vendor-skills.mjs --check        # exit 0
    node scripts/sdd-checks.mjs | grep -c FAIL          # 0
    ```

## 4. Consequências

- **C1 — `skills/` volta a ter um só tipo de habitante.** 49→48 diretórios, 48/48 com
  `SKILL.md`, 0 sem. A métrica do `PRD.md` §5 "artefatos sem classe e sem decisão" cai a 0
  **por classe declarada**, não por omissão: o artefato tem classe (módulo) e a classe tem
  dono (este ADR + rule §5).
- **C2 — O registro do instalador deixa de mentir, com 1 linha.** `SKILLS_COMMON` 23→22 (medido; N11)
  entradas; `realLocalSkills()` 24→23. Nenhum mapa novo, nenhum validador novo, nenhuma
  chave de config nova.
- **C3 — A propagação fica provada, não prometida.** O módulo passa a viver no **mesmo**
  layer que `lib/config.mjs` e `lib/seal.mjs`, que já são entregues a todo destino hoje
  (medido: 2 arquivos). O item 1 da interface congela a prova `5 0` por eixo, e a prova
  fim-a-fim por instalação real.
- **C4 — O módulo entra no scan estático, e isso é ganho.** Antes, `checks.mjs` não estava
  em nenhum `SCAN_DIRS`; agora está. `V2` (`permission.ask`), `V3` (literais de projeto) e
  `V7` (`output.system` escalar) passam a cobri-lo — mais estrito, sem custo de comando.
- **C5 — Path protegido ⇒ trailer obrigatório.** Mover arquivos para
  `.opencode/plugins/**` e editar 2 rules toca `harness.config.json.protectedPaths`. O
  commit do SDD carrega `Harness-Gate-Change` (🟠: pre-commit + `harness-integrity.yml`,
  ADR-007). Não muda veredito de gate: `gate.js` não lê path de módulo.
- **C6 — "Módulo" passa a ter definição escrita.** O SDD acrescenta em
  `.agents/rules/prd-adr-pipeline.md` §5 a definição operacional: *módulo* = mecanismo
  executável + templates, sem `SKILL.md`, que vive em layer propagado e cuja norma fica na
  rule. Custo: ~3 linhas na rule (79 → ≤80, o orçamento do teste `PAP-06` é respeitado
  porque a linha de §5 é reescrita, não acrescentada em bloco).
- **C7 — Reversível por 1 commit.** `git revert` devolve os 5 arquivos e as 7 citações; não
  há migração de dado, nem estado, nem formato de artefato. O que **não** é reversível é a
  decisão: depois deste ADR, um diretório sem `SKILL.md` em `skills/` é defeito declarado
  (e o ADR-004 pode passar a medir isso).

## 5. Impacto no instalador (declarado, como a interface exige)

**Toca?** Sim — **exatamente 1 linha removida**: `installer/install.mjs:419`,
`'prd-adr-pipeline',` em `SKILLS_COMMON`.

| Pergunta | Resposta medida |
|---|---|
| Muda `commands.suiteFull`? | **Não.** Nenhum comando entra/sai. |
| O selo (`HARNESS_SEAL_JSON`) é republicado? | **Não.** `sealCommands` só muda se `commands.suiteFull` mudar (`harness-config.md` §"Command seal"). |
| `LAYER_PREFIX` muda? | **Não.** `.opencode/plugins` já é o layer `:107`. |
| `INCOMING_ROOTS` muda? | **Não.** `.opencode/plugins` já está em `:1690`. |
| Mapa de eixo novo? | **Não.** `SKILLS_BY_AXIS`/`RULES_BY_AXIS` intocados; o layer de plugins não tem mapa por eixo por desenho (o módulo é comum a todo destino). |
| Quantos dos 559 testes sentem? | **2 testes** sentem a remoção de registro (medido por mutação; o ADR dizia 3 — ver N12), ambos por **enumeração recomputada do disco** (`eixos-stack.spec.mjs`: disco→lista e a guarda `SANGRA`; o guarda "fantasma" não sente remoção. As 2 seguem verdes porque o disco e a lista mudam juntos). **Nenhum** teste tem literal `24` ou `prd-adr-pipeline` em `installer/__tests__/**` (medido: 0 ocorrências). |
| Efeito observável nos 559 | `realLocalSkills()` 24→23; `SKILLS_COMMON.length` 23→22 (medido; N11); `pass 559 / fail 0` mantido. |

**O que quebraria se a linha errada fosse removida:** `installer/install.mjs:384`
(`'prd-adr-pipeline.md'` em `RULES_COMMON`) é a entrada da **rule**. Removê-la deixaria a
enumeração `EX-BE-05` vermelha (`realRuleNames()` tem 8 rules; 7 classificadas ⇒ 1 não
classificada) — e o destino pararia de receber a norma da esteira. A interface congela o
número: `grep -c "prd-adr-pipeline" installer/install.mjs` = **1**, não 0 (item 8).

## 6. Riscos herdados do `RESEARCH.md` §9

| # | Como se aplica | Estado |
|---|---|---|
| **R1 — D4 vs. propagação** | É **o** risco deste ADR. Fechado por construction: o path escolhido já está em `LAYER_PREFIX:107` **e** `INCOMING_ROOTS:1690`; medido, `lib/` entrega 2 arquivos hoje e entregaria os 5 do módulo (`5 0` por eixo, simulado e provado com `collectIncoming` e com `main()` real). A alternativa que **perde** propagação foi medido e descartado: `.agents/modules/**` entrega **0 de 5**. | **fechado com medição** |
| **R4 — 4→3 citações** | Materializou-se quando o `ADR-001` entrou (`fe7c408`): `sdd-orquestrador` não existe mais. Este ADR reaponta **1** citação de path (`orchestrator:273`); as outras 2 já citavam a rule. | **herdado e fechado** |
| **R2 — divergências de contagem** | `RESEARCH.md` §4 estima "3–4 arquivos de agente precisam de edição"; **medido: 1**. Corrigido em §9, N1. | **herdado e corrigido aqui** |
| **R5 — custo de `suiteFull` mutável** | Não acionado: nenhum comando novo. Item 11 prova `harness.config.json` byte-idêntico. | **não acionado** |
| **R7 — enum de `status`** | `ADR-INDEX.md` usa `merged` (ADR-001) e `in-progress` (ADR-002) — ambos em `INDEX_STATUS` (`checks.mjs:47`). `proposed` continua inexistente. | **fechado por construção** |
| **R8 — índice↔disco no mesmo passo** | A linha do ADR-002 entra no **mesmo commit** do `ADRs/ADR-002-prd-adr-pipeline-modulo/ADR.md`. `ADR-02` também exige: `order 2 in-progress` só é legal porque `order 1` está `merged` (a sequência é validada). | **fechado por construção** |

## 7. Alternativas descartadas

| Alternativa | Custo medido/derivado neste repo | Por que caiu |
|---|---|---|
| **B1 — criar `SKILL.md` e assumir a skill** | 1 arquivo novo (~40–80 l.); **0** linha de instalador; **0** teste tocado; propagação idêntica (o dir não sai do lugar). | Cria **2** descrições normativas da mesma esteira (rule de 79 l. + `SKILL.md`) com drift permanente, e mantém o registro do instalador chamando de *skill* um diretório cujo uso real é **executar** `checks.mjs`. A skill carregaria prosa para não executar nada: o valor (o check) continua fora do runtime de skill. Descartada pelo owner em G1/D4 ao escolher reclassificar. |
| **B3 — deixar como está** | 0 arquivo; 0 teste. | Mantém os 4 defeitos de §1: `realLocalSkills()` classifica um não-skill como skill (`SKILLS_COMMON`), `skills/` fica 48/49, a premissa expirada de `checks.mjs:15-16` continua **falsa** no disco, e 1 agente manda carregar um path que não é skill. Custo anual: o mesmo que o PRD existe para eliminar. |
| **B2b — path novo `.agents/modules/prd-adr-pipeline/`** | Medido: **0 de 5** arquivos entregues sem mudar o instalador. Com mudança: `+1` entrada em `LAYER_PREFIX`, `+1` em `INCOMING_ROOTS`, **novo** mapa de exclusão + validador fail-closed + teste de enumeração bidirecional (o repo já pagou esse preço 2× — `RULES_BY_AXIS`, `SKILLS_BY_AXIS`), ≈40 linhas de instalador + ≈70 de teste, e `ensure` de que nenhum destino antigo quebre no `upgrade` pela camada nova. | Inventa uma capacidade de instalador (mapa de eixo por layer) para **um único artefato** que **não é excludente por eixo**: o custo é permanente e o ganho é zero — o layer existente `lib/` entrega o mesmo resultado com 0 mecanismo. Viola "não inventar capacidade do instalador" e a §3 do `RESEARCH.md` (S3: complexidade só com ganho mensurável). |
| **B2c — mover para `.agents/rules/prd-adr-pipeline/`** | Propagação: **0** linha de instalador (rules já propagam). Enumeração: medido **5** arquivos não classificados (`prd-adr-pipeline/{checks.mjs,templates/ADR.md,templates/ADR-INDEX.md,templates/PRD.md,templates/RESEARCH.md}`) ⇒ `EX-BE-05` "disco→lista" vermelho até `RULES_COMMON` ganhar 5 entradas que **não são rules** (8 → 13, com 38% de entradas mentindo sobre o tipo). | Troca o defeito de namespace por outro: `.agents/rules/**` é declaradamente **prosa descritiva** (`gate-contract.md` §3, `harness-config.md` §2); um `.mjs` + 4 templates ali obrigam a lista de *rules* a hospedar não-rules. O SSoT normativo passaria a dividir espaço com binário. |
| **B2a — manter o diretório e só reclassificar nas citações** | 0 linha de instalador; 1 `.mjs` + 1 rule + 1 `AGENT.md` de prosa. | Não fecha o defeito estrutural: `skills/` continua 48/49, `realLocalSkills()` continua dizendo que o módulo é skill, e o próximo que listar as skills do repo continua contando 49. É a alternativa que "resolve o nome" e deixa o disco mentindo — o defeito que o `grep` de `SKILL.md` do item 2 existe para pegar. |

## 8. Critérios de verificação

**Item 0 — re-derivação do contexto (RF-07).** Deve reproduzir os valores de §1:

```sh
ls -d .agents/skills/*/ | wc -l                                             # 49 (antes) → 48 (depois)
for d in .agents/skills/*/; do [ -f "$d/SKILL.md" ] || echo "SEM: $d"; done  # 1 (antes) → 0 (depois)
find .agents/skills/prd-adr-pipeline -type f | wc -l                        # 5 (antes) → ausente (depois)
find .opencode/plugins/lib/prd-adr-pipeline -type f | wc -l                 # ausente (antes) → 5 (depois)
grep -rn "prd-adr-pipeline" .agents/agents/                                 # 3 linhas (2 já na rule)
grep -n "prd-adr-pipeline" installer/install.mjs                            # 384 (rule) + 419 (skill)
node --input-type=module -e 'import("./installer/install.mjs").then(m=>console.log(m.SKILLS_COMMON.length))'  # 23 → 22 (medido; N11)
```

**Aceite do SDD** — os 12 itens de §3, na ordem, com os comandos lá escritos. Critério de
bloqueio: se o item 1 devolver qualquer linha diferente de `5 0`, o SDD está errado e o
repo-destino perdeu o módulo — voltar antes de abrir o PR.

**Ordem de merge.** Sem dependência formal. `ADR-001` já entrou; `ADR-003` depende de
`ADR-001` (não deste). A ordem de **execução** preferível (`ADR-001` antes deste) está
consumada, o que reduziu o reapontamento de 4 para 1 citação de agente.

## 9. Notas de correção (divergências medidas entre brief/RESEARCH e disco)

- **N1 — "3 agentes citam como skill" é falso em 2 dos 3 casos.** Medido: só
  `orchestrator/AGENT.md:273` cita o **path** de skill. `product-manager:10` e
  `architect:11` citam `.agents/rules/prd-adr-pipeline.md` — o SSoT correto, que continua
  correto depois deste ADR. Logo o custo de reapontamento é **1** arquivo de agente, não
  3–4 como estimado no `RESEARCH.md` §4.
- **N2 — a premissa de `checks.mjs:15-16` está expirada, e isso é medível.** *"the only
  path the installer propagates"* é falsa hoje: `collectIncoming` entrega
  `.opencode/plugins/lib/config.mjs` e `lib/seal.mjs` (2 arquivos). O ADR não "inventa" o
  `lib/` como destino: ele é o **destino que já existia** quando a frase foi escrita.
- **N3 — a prosa expirada tem 3 sítios, não 1.** Além de `checks.mjs:15-16`, o comentário
  de `scripts/static-checks.mjs:25-27` repete a mesma justificativa, e
  `docs/FUNCIONAMENTO.md:109` lista `prd-adr-pipeline` explicitamente entre as skills
  (`prompt-optimizer`, `sdd-compiler`, `harness-report`, `harness-installer`,
  `prd-adr-pipeline`). O brief citou só o primeiro.
- **N4 — `installer/install.mjs` cita `prd-adr-pipeline` 2 vezes, com naturezas opostas.**
  `:384` = `'prd-adr-pipeline.md'` (rule, `RULES_COMMON`) — **fica**; `:419` =
  `'prd-adr-pipeline'` (skill local, `SKILLS_COMMON`) — **sai**. Um `sed` de "remover
  prd-adr-pipeline do instalador" apaga a rule do destino. O item 8 congela `1`, não `0`.
- **N5 — `ADR-P02` é decisão de ciclo **encerrado**.** A referência em `checks.mjs:15`
  aponta para `.spec/archive/20261016-prd-adr-pipeline/` (arquivado, `PRD.md`/`SPEC.md`
  datados). Este ADR **substitui** a premissa dela; o documento arquivado não é editado
  (imutável por convenção, como `RENAME-01`/`R-V12` já tratam).
- **N6 — o módulo passa a ser varrido por `V2`/`V3`/`V7` sem pedir licença.**
  `SCAN_DIRS` inclui `.opencode/plugins/lib` (`static-checks.mjs:47`); medido, nenhum dos
  3 padrões aparece hoje em `checks.mjs` nem nos 4 templates. É consequência (C4), não
  decisão nova — e é mais estrito do que o estado atual.
- **N7 — `.agents/skills` continua com 25 vendorizadas.** A conta 49 = 24 locais + 25 do
  lock cai para 48 = 23 + 25. O `.vendor-lock.json` **não** é tocado (o módulo nunca foi
  vendorizado).
- **N8 — `harness/prd-adr-pipeline.json` e `spec-developed.md` são registro histórico.**
  O primeiro é evidência datada do ciclo arquivado (`gitSha: 5c898cc…`); o segundo é o log
  cronológico (`2026-10-16`). Nenhum dos dois afirma estado atual do path ⇒ **não editados**
  (mesma regra de `docs/FUNCIONAMENTO.md:680` no ADR-001).
- **N9 — `workflow-state.json:715` cita o path antigo dentro de texto de follow-up
  datado.** Registro histórico, dono é o orquestrador do ciclo (bloco `prd_adr`); não é
  reescrito por este ADR.
- **N10 — a interface do contrato não muda.** `runPrdChecks(root)` e o formato
  `{ ok, results: [{ id, status, detail }] }` com exatamente `PRD-01`/`ADR-01`/`ADR-02`
  continuam idênticos; este ADR move **arquivos**, não contrato. Quem consome o check
  (`static-checks.mjs`, o spec) muda de **path**, não de chamada.

- **N11 — `SKILLS_COMMON` era 23, não 24 (o item 7 dizia 24→23; medido 23→22).** O número do ADR confundiu `SKILLS_COMMON` com a contagem de skills locais: `realLocalSkills()` é 24→23 (48 dirs − 25 vendorizadas) e `SKILLS_COMMON` é 23→22 — `frontend-vue-specialist` é classificado por `SKILLS_BY_AXIS`, não por `SKILLS_COMMON`. O contrato semântico do item 7 está cumprido (remove exatamente 1 entrada de skill, preserva a rule, enumeração bidirecional verde, 559/559); o **número** estava errado e não foi "corrigido" inventando uma entrada fantasma na enumeração.

- **N12 — 2 testes sentem a remoção, não 3.** Medido por mutação (remover outra entrada de `SKILLS_COMMON`): falham `disco→lista` e a guarda `SANGRA`; o guarda "fantasma" (nome na lista sem diretório no disco) **não** é acionado por remoção. O ADR superestimou em 1.
