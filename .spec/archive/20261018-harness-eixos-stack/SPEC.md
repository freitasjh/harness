# SPEC — harness-eixos-stack

> **Feature ID**: `harness-eixos-stack`
> **Tipo**: `refactor` (configuração do instalador; esteira **ADR-only** por isenção — `.agents/rules/prd-adr-pipeline.md` §3)
> **Status**: `Under Review` (P1 — aguarda aprovação do usuário)
> **Data**: 2026-10-18
> **Fonte**: `PROPOSAL.md` (mesmo dir) + parecer `architect` (5 ADRs) + parecer `ux-designer` (vinculante, adaptado por D-A) + decisões de portão D-A..D-D
> **Autor**: orchestrator (sdd-compiler `generate-spec`)

---

## 0. Declaração de escopo desta SPEC

Esta SPEC é **prescritiva** para o ciclo `harness-eixos-stack`. Ela descreve o comportamento exigido, o mecanismo que prova cada afirmação e o que **não** entra. Toda afirmação de garantia é classificada como 🟢 runtime (teste no `suiteFull` selado) · 🟠 parcial/CI · 🟡 processo · 🔴 aberto (`.agents/rules/gate-contract.md` §1/§3).

---

## 1. Estado atual (evidência)

| # | Fato | Evidência |
|---|---|---|
| E1 | Q&A tem **uma** pergunta de stack | `installer/install.mjs:194-200` |
| E2 | `STACK_VALUES` = lista literal de 6 valores (a lista aparece **2×**: aqui e na mensagem de erro) | `installer/install.mjs:264`, `:299` |
| E3 | `STACK_PROFILES` keyed por valor **composto**; `backend`/`frontend` são descrições humanas congeladas | `installer/install.mjs:209-258` (strings em `:210-212`, `:226-228`) |
| E4 | `generateConfig` resolve um único `profileOf(stack)` e emite `stack.{backend,frontend}` | `installer/install.mjs:381-429` (`:392-393`, `:415-418`) |
| E5 | Gating de artefato filtra **só** `.agents/skills/**` por `stacks`; `stacks: []` = comum = entra sempre | `installer/install.mjs:1186-1198` (`:1195-1196`) |
| E6 | `stacks` da skill é derivado do **nome** (`inferStacks` só conhece `dart-`/`flutter-`) | `scripts/vendor-skills.mjs:284-288`, `:341` |
| E7 | `WIZARD_MENU` = 5 itens; item 4 funde 2 eixos; range `[1-5]` **hardcoded** no prompt e no erro | `installer/install.mjs:1492-1498`, `:1646`, `:1649` |
| E8 | `defaultSuiteFor` só conhece flutter/dart/node; qualquer outro retorna `''` | `installer/install.mjs:1560-1570` |
| E9 | `howToFix('stack')` e o prompt de `QUESTIONS.stack` re-hardcodam a lista de stacks | `installer/install.mjs:1575`, `:196` |
| E10 | Vendor: allowlist SPDX + fail-closed; `SOURCE_LICENSES` com sha congelado; NOTICE afirma byte-identidade universal | `scripts/vendor-skills.mjs:31-45`, `:47-51`, `:109-137`, `:317-325`, `:398`, `:416` |
| E11 | `--check` é parte do `suiteFull` (selado) | `harness.config.json:14` |
| E12 | `.agents/skills/**` fora do scan dos canários; V15 varre só `installer/` | `scripts/static-checks.mjs:42-47`, `:280-286` |
| E13 | `runPrdChecks` é vacuous-safe: valida `.spec/prd/**` só quando o dir existe | `.agents/skills/prd-adr-pipeline/checks.mjs:8-12` |

---

## 2. ADRs deste ciclo

`ADR-INDEX.md` (mesmo dir) + `ADRs/ADR-001..005/ADR.md`. Resumo:

| ADR | Decisão em uma linha | depende-de |
|---|---|---|
| ADR-001 | Registry ganha `axes` (IDs de eixo) + rótulos literais congelados; `profileOf`/`generateConfig` inalterados | — |
| ADR-002 | Perfil `java+react`; gating de skill/rules **derivado do eixo** (fecha A1/A2) | ADR-001 |
| ADR-003 | Vendor com `licenseOrigin` (`upstream-file` \| `declared-evidence`); NOTICE sem claim universal | ADR-002 |
| ADR-004 | `W2m` em 2 passos; range derivado; padrões do bloco de erro reparados | ADR-002 |
| ADR-005 | Rota (desenho) para a pergunta dupla `backend`+`frontend`; `answersVersion` reservado | ADR-001 |

---

## 3. Requisitos Funcionais

### RF-01 — Registry com eixos (ADR-001)
Cada entrada de `STACK_PROFILES` passa a expor `axes: { backend, frontend }` com **IDs estáveis**, mantendo `backend`/`frontend` como **literais congelados** e os demais campos (`commands`, `mcp`, `moduleMap`) com a semântica atual.
**Correção do PM (D-1) — `axes` precisa de consumidor real:** `stacks` deixa de ser campo independente e passa a ser **derivado** de `axes` por `stacksFor(axes)`, com **tabela de exceções declarada** para os presets mobile (`flutter` → ver exceções). Um preset cujo `axes` divirja do `stacks` — e que **não** esteja na tabela de exceções — deixa o teste **vermelho**.
- **Aceite**: `generateConfig` para os 6 presets existentes produz JSON **byte-idêntico** ao baseline. 🟢 (roda no `suiteFull`)
  - **Precisão da citação (correção do `code-reviewer`, I2-CIT)**: o que está **byte-a-byte intacto** é o builder `baseline()` (`golden.spec.mjs:14-45`) e os asserts de byte-identidade (`:48-61`); o assert **estrutural** de contagem de chaves foi **reescopado** para superconjunto (autorizado por I9(a), declarado em `TASKS.md`). Citar "48-97 não editado" era falso e foi corrigido em todos os artefatos.
- **Aceite**: nenhum rótulo é construído por concatenação de strings.
- **Aceite (D-1)**: para **todo** preset, `stacks` é igual a `stacksFor(axes)`, salvo exceção **explicitamente listada**; um caso sintético `axes.frontend='react'` + `stacks:['vue']` **falha** o teste.
- **Aceite**: `axes` tem **≥2 consumidores** (gating de skill e gating de rules) — eixo decorativo é defeito, não detalhe.

**Tabela de exceções de `stacksFor` (declarada, não inferida):**

| Preset | `axes` | `stacks` derivado | Exceção declarada? |
|---|---|---|---|
| `java+vue` | java / vue | `[]` | não |
| `java+react` | java / react | `['react']` | não |
| `node`, `node-esm`, `outra` | — / — | `[]` | não |
| `flutter` | flutter / flutter | `['flutter','dart']` | **sim** (par mobile compartilha skills) |
| `dart` | dart / none | `['dart']` | não |

### RF-02 — Preset `java+react` (ADR-001/002)
Novo preset com `axes: { backend: 'java', frontend: 'react' }`, literais próprios, `commands` próprios, `mcp.required: ['chrome-devtools']` e `moduleMap` de stack (chaves não harness-owned).
- **Aceite**: `Object.keys(STACK_PROFILES)` contém **todos** os 6 nomes atuais **e** `java+react` (superconjunto, não igualdade).
- **Aceite**: `generateConfig({stack: 'java+react'})` produz `stack.backend`/`stack.frontend` distintos do par Vue e um `moduleMap` que **não** é filtrado pelo check `config-ref-missing` (chaves de stack não são harness-owned).

### RF-03 — Gating de skill por eixo (A1, ADR-002) 🟢 P1
O `stacks` da skill deixa de ser inferido do **nome** e passa a derivar da **origem declarada** no source-lock.
**Mecanismo (nomeado):** a entrada de skill no **source-lock de entrada** do vendor passa a carregar `stacks` explícito (declarado por quem vendoriza); `buildVendor` grava esse valor em vez de `inferStacks(name)` (`scripts/vendor-skills.mjs:341`), e `inferStacks` fica rebaixado a **fallback** para skills com prefixo conhecido (`dart-`/`flutter-`, `:284-288`). Skill sem `stacks` explícito e sem prefixo conhecido ⇒ `stacks: []` = **comum** (semântica preservada) — o que significa: **toda** skill nova de terceiro só é gated se a origem declarar seu eixo.
- **Aceite (2 direções)**: em destino `java+react`, as 2 skills react **entram**; em `java+vue`, `node`, `outra`, **não entram**.
- **Aceite (não-regressão)**: para `dart-*`/`flutter-*` o resultado de `inferStacks` é **idêntico** ao atual (asserts de `installer/__tests__/vendor.spec.mjs:161-172` sem alteração).
- **Aceite**: a semântica "sem entrada no lock ⇒ comum" (`installer/install.mjs:1194-1196`) permanece para artefatos sem origem declarada.

### RF-04 — Gating de `.agents/rules/**` pelo mesmo eixo (A2, ADR-002) 🟢 P2
**Mecanismo (obrigatório — rules não têm lock de vendor):** `installer/install.mjs` declara **duas estruturas explícitas**:
1. `RULES_BY_AXIS` — mapa de **EXCLUSÃO** por eixo: `{ 'frontend=react': ['frontend-coding-standards.md'] }`, lido como *"para um destino cujo eixo casa com a chave, estes artefatos **não** entram"*.
2. `RULES_COMMON` — lista explícita dos artefatos de rule **comuns** (entram em todo destino).

**Semântica:** artefato em `RULES_COMMON` entra sempre; artefato citado numa chave de `RULES_BY_AXIS` é excluído **apenas** para aquele eixo; **toda** rule de `.agents/rules/**` tem de estar em **uma** das duas listas (cobertura total checada por enumeração).

> **Correção de desenho (orquestrador, antes do Batch 2)** — esta é a ressalva: a redação anterior era *allowlist de inclusão* ("não citado = comum"), o que **contradizia** o residual declarado abaixo. Sob a leitura de inclusão, classificar `frontend-coding-standards.md` para o eixo vue **removeria** a rule de `node`, `outra`, `flutter` e `dart` (mudança de comportamento fora do escopo aprovado). A leitura correta é de **exclusão**: atinge o alvo do A2 (destino react sem prosa Vue) **sem** tocar os demais destinos.

- **Correção do PM (D-4a) — lista REFAZADA contra o disco (defeito nosso, achado pelo `developer-engineer` no Batch 2)**: o conjunto **real** de `.agents/rules/**` neste repo é **7** arquivos: `brain-context.md`, `frontend-coding-standards.md`, `gate-contract.md`, `harness-config.md`, `prd-adr-pipeline.md`, `sdd-workflow-standard.md`, `workflow-rules.md`. A lista anterior (12 arquivos: `backend-coding-standards.md`, `backend-integration-tests.md`, `backend-unit-tests.md`, `db-migration-flyway.md`, `security-standard.md`, …) foi **copiada de prosa que referencia stack de outro projeto e não existe aqui** — mesma classe do item aberto "AGENT.md cita regras inexistentes" (`workflow-state.json` → `A-3`). **Regra derivada**: nenhuma prosa/artefato cita caminho de `.agents/rules/**` sem conferir o disco (`ls`), e `RULES_COMMON` reflete o diretório real — com a enumeração do RF-04 cobrindo desvio.
  **Não existe** rule de React ⇒ o destino `java+react` **não recebe nenhuma rule de frontend** nesta entrega (o eixo, aqui, só **remove**). Criar `frontend-react-standards.md` é **nova decisão do owner** (fora deste ciclo).
- **Aceite**: destino `java+react` **não** recebe `.agents/rules/frontend-coding-standards.md`; destino `java+vue` continua recebendo.
- **Aceite (residual declarado — D-4b)**: `node`, `node-esm`, `outra`, `flutter` e `dart` **mantêm** o incoming de rules **idêntico** ao de hoje (a exclusão só cobre a chave do eixo react).
- **Aceite (D-4b)**: o teste **enumera** `.agents/rules/**` e exige que **cada** arquivo esteja em `RULES_COMMON` **ou** em alguma chave de `RULES_BY_AXIS` — rule nova não classificada deixa o teste **vermelho**.
- **Aceite**: a filtragem é por **dado declarado**, nunca por nome de arquivo — há teste que falha se a implementação voltar a inferir por nome.
- **Aceite (🔴 CR-1 do `code-reviewer`, endurecimento obrigatório)**: a **chave** de `RULES_BY_AXIS` (`<eixo>=<id>`) é **validada contra `AXIS_IDS`** na carga, e o **conjunto de ids de eixo do destino** deriva de `profileOf(stack).axes` (não das *tags* de `stacks`) — sem isso a chave `'backend=react'` (eixo errado), `'frontend=blazor'` (id fora do conjunto fechado) e `'backend=node'` (eixo que nunca casa) passam **verdes** e a declaração vira **no-op silencioso** (fail-open). Declaração inválida ⇒ **falha de carga** (fail-closed, mesmo padrão de RF-01/RF-02).
- **Aceite (🟡 N-1 do re-review, endurecimento final)**: o match de `RULES_BY_AXIS` exige **o par** `{eixo, id}` — não apenas o `id`. Motivo: `AXIS_IDS` compartilha ids entre eixos (`dart`, `flutter`, `other`, `none`), então uma chave como `'backend=none'` casaria destinos que **não** são daquele eixo (over-match silencioso, provado com 3 falhas de não-regressão). O eixo validado da chave tem de **participar** da decisão de exclusão.
- **Aceite (🟡 do review)**: a enumeração é **recursiva** (`.agents/rules/**` inclui subdiretórios) e **bidirecional** (disco → lista **e** lista → disco: nome fantasma em `RULES_COMMON` também deixa o teste vermelho).

### RF-05 — Range do menu derivado (A4, ADR-004) 🟢 P2
Prompt e mensagem de erro do menu passam a derivar o range de `WIZARD_MENU.length`.
- **Aceite**: teste com item sintético adicional prova que o novo índice é **alcançável** (hoje, item 6 cairia em loop de `BAD_ANSWER`).

### RF-06 — `W2m` em 2 passos (ADR-004)
- **Aceite**: `W2m-1` mantém os 5 itens na **mesma ordem/numeração**; item 4 exibe `-> segue: frontend` (deixa de mapear direto para `java+vue`).
- **Aceite**: `W2m-2` só é exibido quando `W2m-1 = 4`, com `[2/2]`, `(default: 1)` e itens `1) Vue -> stack java+vue` / `2) React -> stack java+react`; `Enter` reproduz o comportamento atual.
- **Aceite**: todo prompt do menu exibe contador `[i/total]` e `(q cancela)`.
  - **Contrato do total (correção de drift de brief)**: o total é **derivado** de o menu ter passo condicional (`WIZARD_MENU.some(m => m.next)`) ⇒ o passo 1 imprime **sempre `[1/2]`**, inclusive quando o item escolhido for um sem passo 2 (o rótulo do item 4 é quem anuncia "segue: frontend"). Um brief que peça `[1/1]` nos itens simples contradiz o literal do ADR-004 §2 — **o ADR é a fonte** (o `developer-engineer` seguiu o ADR e reportou o conflito: comportamento correto, SPEC preservada).
- **Aceite**: a linha 3 do bloco de erro (como corrigir) **não** contém jargão de stack; a linha 4 traz `arquivo:linha` do bloco do menu.
- **Aceite**: `q`/`ABORT_TOKENS` em qualquer passo aborta com **0 writes**; `W2m` continua **pulado** quando há `pubspec.yaml`.

### RF-07 — Default de `suiteCommand` para o par react (E8)
`defaultSuiteFor` precisa cobrir o preset react; sem isso o default fica `''` e o usuário digita o comando sem sugestão.
- **Decisão binária**: `defaultSuiteFor` ganha uma lista de candidatos para o **eixo frontend react** (`['npm run test:run', 'npm test']`, na ordem, vencendo o primeiro cujo primeiro token resolve no PATH — `commandResolves`, `installer/install.mjs:266-274`). Se **nenhum** resolver, retorna o **primeiro candidato da lista** (comportamento idêntico ao ramo flutter/dart, `:1568-1569`) — nunca `''` por ausência de branch.
- **Aceite**: com `npm` disponível, `defaultSuiteFor('java+react') === 'npm run test:run'`; sem `npm`, o valor é `'npm run test:run'` (primeiro da lista, não vazio).
- **Aceite (não-regressão)**: `java+vue` mantém o comportamento atual (lista vazia ⇒ `''`), **e isso é assertado explicitamente** para que a paridade seja provada, não presumida.

### RF-08 — Vendor das 2 skills (ADR-003)
`react-components` (Apache-2.0) e `react-best-practices` (MIT) vendorizadas **offline** por `scripts/vendor-skills.mjs`, com `sourceCommit` **pinado** e `licenseOrigin` correto por fonte.
- **Aceite**: `.vendor-lock.json` contém as 2 skills com `source`, `sourceType`, `sourceCommit`, `skillPath`, `computedHash`, `treeHash`, `license`; a fonte vercel carrega `licenseOrigin: declared-evidence` + `evidence[]` (URL/§ + commit); a fonte stitch carrega `licenseOrigin: upstream-file`.
- **Aceite**: `LICENSE-stitch-skills` e `LICENSE-vercel-agent-skills` existem na raiz de `.agents/skills/` e **nenhuma** skill vendorizada é patchada (cópia byte-idêntica à fonte).
- **Aceite**: as skills **existentes** (`dart-*`/`flutter-*`) mantêm `treeHash` e `computedHash` **inalterados**.

### RF-09 — `react-components` como opcional (ADR-002/003)
**Mecanismo (nomeado):** campo booleano **`optional: true`** na entrada da skill em `.agents/skills/.vendor-lock.json` (aditivo; ausente = obrigatória do seu eixo).
**Correção do PM (D-3) — semântica sem ambiguidade:** nesta entrega o campo é **metadado de procedência** e o instalador **continua instalando as 2 skills** no preset react. "Opcional" **não** significa "não instalada": significa que a skill tem dependência externa declarada (rede em runtime + `@swc/core` + Stitch MCP). Fazer o instalador **honrar** o campo é **escopo novo** (decisão do owner), não deste ciclo. A proibição de patchar o `SKILL.md` permanece (quebraria `treeHash`).
- **Aceite**: `lock.skills['react-components'].optional === true` e `lock.skills['react-best-practices'].optional` ausente/false.
- **Aceite (D-3)**: destino `java+react` recebe **as duas** skills — o critério é explícito para não ser lido como "a de rede fica fora".
- **Aceite**: a cópia da skill permanece byte-idêntica à fonte (nenhum campo injetado no `SKILL.md`).
- **Aceite**: o `VENDOR-NOTICE` registra que a skill faz rede em runtime (`scripts/fetch-stitch.sh`), depende de `@swc/core` e do Stitch MCP.

### RF-13 — Pré-requisitos operacionais do vendor (declarado)
O vendor é **source-side** e exige os repositórios upstream disponíveis **localmente** (`git clone` — rede **fora** do instalador) no commit pinado, além do `--source-license` por fonte.
- **Aceite**: a execução do vendor é documentada como passo de **build do repo do harness** (não do instalador), com o commit pinado registrado no lock; o `installer/` permanece rede-zero (I3).
- **Aceite**: se as fontes **não** estiverem disponíveis, o `--check` continua verde com o lock já commitado (o CI não precisa de rede) — o lock é o artefato versionado.
- **Nível**: 🟡 processo (pré-requisito humano de ambiente) + 🟢 no que é verificável (`--check` sem rede).

### RF-14 — Prompt do W3 coerente com o preset escolhido (D-2 do PM) 🟢 P1
O prompt de `QUESTIONS.stack` **hardcoda** a lista antiga (`installer/install.mjs:196`: `(flutter/dart/node/java+vue/outra)`). Consequência: depois de escolher **React** no menu, o W3 mostra ao usuário uma lista **sem** `java+react` — contradição visível na mesma execução. Nenhum teste congela essa string (grep: só o call site), portanto **não** é "prompt congelado": entra no escopo.
- **Aceite**: o prompt é derivado de `STACK_VALUES` (fonte única) e exibe `java+react`; nenhuma lista de stacks fica duplicada à mão (`:196`, `:299`, `:1575` passam a referenciar a mesma fonte).
- **Aceite (D-4a)**: a mesma fonte alimenta `howToFix('stack')` (`:1575`) — o exemplo de rule/framework citado no erro deixa de ser jargão desatualizado.
- **Aceite**: teste prova que, dado o preset react, a string exibida contém o valor escolhido.
- **Nível**: 🟢.

### RF-10 — `--check` por origem (A5/ADR-003)
- **Aceite**: `node scripts/vendor-skills.mjs --check` verde com as 2 fontes.
- **Aceite**: o assert de "byte-a-byte com o upstream" passa a valer **só** para `licenseOrigin: upstream-file`; `declared-evidence` valida o sha do **nosso** texto (`installer/__tests__/vendor.spec.mjs:396` dividido).
- **Aceite**: `VENDOR-NOTICE.md` **não** afirma byte-identidade universal ao upstream.

### RF-11 — Prosa ↔ mecanismo (D2/D4 do parecer do architect)
- **Aceite**: `.agents/skills/harness-installer/SKILL.md` (lista de stacks, tabela de perfil, menu, vendor por stack), `.agents/rules/harness-config.md` (deixa de descrever o mobile como único perfil especial) e `AGENTS.md` (nota do eixo) atualizados — e `installer/__tests__/docs.spec.mjs` verde.

### RF-12 — Rota documentada, schema intocado (ADR-005)
- **Aceite**: a rota da pergunta dupla está em ADR-005 (superfícies + alternativas + gatilho).
- **Aceite**: **nenhuma** chave de `QUESTIONS` é adicionada nesta entrega; `answersVersion` **não** entra no schema agora (reservado por escrito).

---

## 4. Invariantes (I)

| # | Invariante | Prova | Nível |
|---|---|---|---|
| I1 | **0 linhas alteradas** em `.opencode/plugins/gate.js`, `harness.config.json` e no comando selado (`commands.suiteFull`) | `git diff --stat`; selo ADR-002 | 🟢 |
| I2 | Config gerada dos 6 presets existentes **byte-idêntica** | asserts de byte-identidade de `golden.spec.mjs:48-61` + builder `baseline()` `:14-45` (**intactos**, não editados) | 🟢 |
| I3 | `installer/` continua **rede-zero** | `node scripts/static-checks.mjs` (V15) no `suiteFull` | 🟢 |
| I4 | Wizard nunca escreve e nunca chama `generateConfig` | `installer/install.mjs:1485`, `:1700-1706`; testes de wizard | 🟢 |
| I5 | Novas entradas no lock são **aditivas**; hashes das skills existentes inalterados | `vendor-skills.mjs --check` | 🟢 |
| I6 | Zero path/URL de projeto hardcoded em rule/plugin | check V3 (`scripts/static-checks.mjs`) | 🟢 |
| I7 | Lock **nunca** é copiado ao destino | `installer/install.mjs` (coleta) + teste existente | 🟢 |
| I8 | Sem novo deny no gate; sem evento/DB/tenancy | revisão por diff | 🟢 |
| I9 | **Política de edição de teste**: testes existentes podem ser editados **apenas** para (a) escopar asserções estruturais ao novo bloco/registry, (b) acrescentar o caso novo. **Nenhum** assert de valor congelado (saída gerada, hashes das skills existentes, strings do baseline) pode ser alterado | `git diff` dos `installer/__tests__/*.spec.mjs` + T2/T7 | 🟢 |
| I10 | `node-esm` continua **alcançável sem item de menu** (digitável no W3/`--answers-file`) — invariante do ciclo anterior preservado | `installer/__tests__/wizard.spec.mjs:484-487` (assert existente, **não** editado) | 🟢 |

### Invariantes de dados do registry (novos)

- **D1**: `axes.backend`/`axes.frontend` são strings de um **conjunto fechado** e todo preset tem ambos preenchidos.
- **D2**: `backend`/`frontend` (rótulos) **não** derivam de `axes` por concatenação — são literais independentes.
- **D3**: o número de entradas de `STACK_PROFILES` **nunca diminui** dentro deste ciclo (adição pura).
- **D4 (D-1 do PM)**: `stacks` **deriva** de `axes` via `stacksFor(axes)`; divergência entre `axes` e `stacks` fora da **tabela de exceções declarada** (RF-01) é **defeito detectado por teste** — não pode passar verde.
  - **Endurecimento obrigatório (🔴 CR-1 do `code-reviewer`)**: como `stacks` é **atribuído** no load do módulo (`install.mjs:303-305`), comparar `profile.stacks` com `stacksFor(profile.axes)` é **tautológico** (compara o valor consigo mesmo) e **não** pega registry incoerente. O oráculo tem de ser **independente**: **tabela literal de expectativa por preset** (`EXPECTED_STACKS`) assertada contra `profile.stacks`, **e** guarda de que `STACK_VALUES` ≡ `Object.keys(STACK_PROFILES)`. Falha provada por sonda (registry `java+vue` com `stacks:['react']` passava verde).
- **D5 (D-4b do PM)**: toda rule em `.agents/rules/**` é **classificada** (eixo ou "comum" declarado); rule nova não classificada deixa o teste **vermelho**.

---

## 5. Contratos e interfaces congeladas

| Interface | Contrato | Onde |
|---|---|---|
| `STACK_PROFILES` | chaves = presets; campos atuais preservados; `axes` **aditivo**; `stacks` **derivado** (não literal) | `installer/install.mjs:209-258` |
| `AXIS_IDS` / `stacksFor(axes)` | **novos**: conjunto fechado de IDs de eixo e função de derivação de `stacks` + tabela de exceções declarada | `installer/install.mjs` (novos símbolos) |
| `RULES_BY_AXIS` / `RULES_COMMON` / `axisIdsFromAxes` | **novos**: mapa de **exclusão** `<eixo>=<id>` **validado contra `AXIS_IDS`** na carga (fail-closed) + lista de rules comuns; o conjunto de ids do destino deriva de **`profileOf(stack).axes`** (não das *tags* de `stacks`) | `installer/install.mjs` (novos símbolos) |
| `defaultSuiteFor(stack)` | passa a ser **export** (aditivo — consumo por teste direto de RF-07); comportamento dos presets existentes inalterado | `installer/install.mjs:1560-1570` → `:1608` |
| `profileOf(stack)` | assinatura e semântica (`null` para desconhecido) **inalteradas** | `installer/install.mjs:260-262` |
| `generateConfig(answers, {writtenPaths})` | assinatura, pureza e as 12 chaves de saída **inalteradas** | `installer/install.mjs:381-438` |
| `QUESTIONS` | **5 chaves** inalteradas (RF-12); o **texto** do prompt de `stack` deixa de duplicar a lista (RF-14 — derivado de `STACK_VALUES`) | `installer/install.mjs:194-200` |
| `WIZARD_MENU` | export; itens `{key, label, stack, note?}`; ordem 1..5 preservada | `installer/install.mjs:1492-1498` |
| `collectIncoming(sourceDir, {stacks})` | assinatura preservada; semântica "sem entrada ⇒ comum" preservada | `installer/install.mjs:1200-1227` |
| `.vendor-lock.json` v1 | campos existentes preservados; `licenseOrigin`/`evidence[]` **aditivos** | `scripts/vendor-skills.mjs:25` |
| Schema do `--answers-file` | 5 chaves atuais; **sem** `answersVersion` nesta entrega | `installer/install.mjs:194-200`, `:340-347` |

---

## 6. Modos de falha e tratamento

| Modo | Comportamento exigido |
|---|---|
| `W2m-1`/`W2m-2` fora do range | bloco de erro 4 linhas + repete o **mesmo** passo (sem avançar) |
| `q` em qualquer passo | `USER_ABORT`, mensagem `cancelado pelo usuario no wizard. Abortando sem escrever nada.`, **0 writes** |
| EOF no stdin | `NO_STDIN` com instrução de usar `--answers-file`, **0 writes** |
| Skill sem licença identificável | excluída (fail-closed `P-02=(i)`), registrada como exclusão — **não** silenciosa |
| `treeHash`/sha divergente | `--check` **FALHA** (drift) — nunca "corrige" o lock sozinho |
| Eixo desconhecido no lock | artefato tratado como **comum** (compatibilidade), jamais "instalado em tudo" por acidente de nome |
| Declaração de `RULES_BY_AXIS` inválida (eixo/id fora de `AXIS_IDS`) | **falha na carga** (fail-closed) — declaração inválida nunca vira no-op silencioso |
| **Residual declarado (🟡 do review do Batch 2 — herda o dono A-3/tech-debt)**: destino `java+react` recebe **6 de 7** rules, mas **12 arquivos entregues citam** `.agents/rules/frontend-coding-standards.md` (índices de rules em `.agents/rules/workflow-rules.md:597`, `developer-engineer/AGENT.md:132`, `orchestrator/AGENT.md:639`, `sdd-compiler/SKILL.md:42`, `security-review/SKILL.md:39`, `spec-review/{SKILL.md,README.md,assets/**}`) ⇒ **ref pendurada**. `doctor` desse destino reporta **D6 SAUDÁVEL** (`config-ref-missing` só cobre `evidence.schema`/`moduleMap`). Mesma classe do item aberto `A-3` (`backend-coding-standards.md` inexistente já tem 16 refs no destino entregue) — **este ciclo adiciona instâncias, não a classe**. Mitigação exigida: **teste que enumera e congela a contagem** de refs penduradas do destino react (crescimento ⇒ vermelho). Remover os índices de rules inexistentes é do dono do `A-3` |
| `doctor` sem `--answers-file` | **deixa de ser no-op**: deriva `stacks` do manifesto/config do **destino** (não só do `--answers-file`), para não propor `create` de um artefato que o `init` excluiu deliberadamente |

---

## 7. Estratégia de testes

**Suíte de referência (selada, `harness.config.json:14`)** — é ela que o portão executa:

```
node --test ".opencode/plugins/__tests__/*.spec.mjs" \
  && node --test "installer/__tests__/*.spec.mjs" \
  && node scripts/static-checks.mjs \
  && node scripts/vendor-skills.mjs --check
```

### Unitários (por requisito)

| Teste | Arquivo | Cobre |
|---|---|---|
| T1 | `installer/__tests__/generate.spec.mjs` | RF-01/RF-02: preset novo + saída do react; iteração sobre **todos** os perfis (existente) verde |
| T2 | `installer/__tests__/golden.spec.mjs` | RF-01/I2: superconjunto de chaves + **asserts dos 6 presets intactos** |
| T3 | **novo** `installer/__tests__/eixos-stack.spec.mjs` | RF-03/RF-04: gating 2 direções (react entra; não entra em java+vue/node/outra) + rules |
| T4 | **novo** (mesmo arquivo) | RF-05: item sintético alcançável (range derivado) |
| T5 | `installer/__tests__/wizard.spec.mjs` | RF-06: `W2m-1` com 5 itens (asserção **escopada** ao bloco), `W2m-2` só no item 4, contador, erro 4 linhas, `pubspec` pula menu, `q` = 0 writes |
| T6 | `installer/__tests__/mobile.spec.mjs` | retrocompat de `validateAnswer` para o preset novo |
| T7 | `installer/__tests__/vendor.spec.mjs` | RF-08/RF-10: `licenseOrigin` nas 2 rotas; assert byte-a-byte **dividido**; opcional declarado; hashes das skills existentes inalterados |
| T8 | `installer/__tests__/docs.spec.mjs` | RF-11: paridade prosa ↔ mecanismo |

### E2E deste repo (declarado — não é o H3 de browser)

Este repo **não tem** frontend/browser (`harness.config.json:6`), e `mcp.required: ['chrome-devtools']` existe para **consumidores**. O equivalente honesto do H3 aqui é:

1. Rodar `installer` em **dry-run** contra um dir temporário com `--answers-file` para os presets `java+vue` e `java+react` → conferir plano/resumo **sem nenhum write**;
2. Rodar o fluxo **interativo** (TTY real ou stdin em pipe) exercitando `W2m-1 → W2m-2` e escolhendo **React**;
3. Conferir que o dir do destino ficou **intocado** (0 writes) no dry-run.

**Correção do PM (D-8)**: o passo 1 **não** prova o menu — `--answers-file` **pula o `W2m` inteiro** (`installer/install.mjs:1835`, `:2023` vs `:1655-1698`). Por isso o passo 2 é **obrigatório** e sua evidência é um **transcript salvo** em `.spec/backend/harness-eixos-stack/harness/` (nome sugerido: `wizard-react-transcript.txt`), contendo os 2 prompts e a escolha. É esse arquivo que o owner lê para confirmar o critério funcional.

**Nível**: 🟡 processo para o passo 2 (simulação de TTY), 🟢 para o passo 1/3 (dry-run é caminho real de código). Não se declara "H3 cumprido por browser".

---

## 8. Declarações N/A (aplicação honesta do `spec-gate`)

| Item do assert | Situação | Justificativa |
|---|---|---|
| DDD Modular (api/impl/public) | **N/A** | Não há backend Java/Maven neste repo (`harness.config.json:5`); o artefato é JavaScript ESM de instalador |
| Segurança/IAM (JWT, `@HasPermission`) | **N/A** | Sem autenticação, roles ou endpoints; o instalador é CLI local. A superfície real é **supply-chain** (§9) |
| ERD | **N/A** | Sem banco de dados |
| Event Registry (produtor/consumidor/payload) | **N/A** | Sem eventos assíncronos |
| Migrations Flyway `V{YYYYMMDD}{NNN}` | **N/A** | Sem DB |
| Multi-tenancy | **N/A** | Sem tenancy |
| RBAC | **Sem impacto** | Nenhuma permissão avaliada ou criada |
| ADRs presentes | **✅** | 5 ADRs + índice (`ADR-INDEX.md`) |
| Invariantes definidos | **✅** | §4 (I1..I8 + D1..D3) |
| Test Strategy definida | **✅** | §7 (unit por RF + E2E declarado) |
| Single file / coeso | **✅** | este documento |
| Domínio afetado identificado | **✅** | `instalador-config` (registry de perfis, gating de artefato, wizard, vendor) |

---

## 9. Segurança (supply chain)

- **Sem rede nova no instalador**: `installer/` continua rede-zero (V15, 🟢 no `suiteFull`). As 2 skills entram por **vendor offline** source-side.
- **Integridade**: `treeHash`/`computedHash` por skill + sha do texto de licença por source; divergência ⇒ `--check` **falha**.
- **Licença**: SPDX na allowlist (Apache-2.0, MIT); `declared-evidence` expõe a **limitação** (transcrição 🟡 processo) em vez de afirmar garantia.
- **Dependência de terceiro declarada**: `react-components` faz `curl` em runtime e depende de `@swc/core` + Stitch MCP → entra como **opcional**; 🟠 **declarado**: `.agents/skills/**` está fora do scan dos canários (`static-checks.mjs:42-47`) e V15 não a alcança (`:280-286`).
- **Sem segredos novos**: `deployToken` permanece o único segredo, inalterado (`serializeAnswers` o omite).

---

## 10. Rastreabilidade (RF → ADR → teste)

> **Correção do PM (D-7)**: os testes são citados por **arquivo**, não por código `T*` (o mapeamento por letra gerava ruído).

| RF | ADR | Teste (arquivo) | Nível |
|---|---|---|---|
| RF-01 | ADR-001 | `golden.spec.mjs` (superconjunto + `axes` + coerência `axes`↔`stacks`) + `generate.spec.mjs` | 🟢 |
| RF-02 | ADR-001/002 | `generate.spec.mjs` + `mobile.spec.mjs` (`validateAnswer`) | 🟢 |
| RF-03 | ADR-002 | `eixos-stack.spec.mjs` (novo) + `vendor.spec.mjs` | 🟢 |
| RF-04 | ADR-002 | `eixos-stack.spec.mjs` (novo, enumera `.agents/rules/**`) | 🟢 |
| RF-05 | ADR-004 | `wizard.spec.mjs` (item sintético + range) | 🟢 |
| RF-06 | ADR-004 | `wizard.spec.mjs` (2 passos, contador, erro 4 linhas, `pubspec` pula) | 🟢 |
| RF-07 | ADR-002 | `generate.spec.mjs` (`defaultSuiteFor` do par react + paridade do par vue) | 🟢 |
| RF-08 | ADR-003 | `vendor.spec.mjs` + `vendor-skills.mjs --check` | 🟢 |
| RF-09 | ADR-002/003 | `vendor.spec.mjs` (`optional` + presença das 2 skills) | 🟠 (declaração em lock; sem deny de runtime) |
| RF-10 | ADR-003 | `vendor.spec.mjs` (split por `licenseOrigin`) | 🟢 |
| RF-11 | ADR-002/004 | `docs.spec.mjs` | 🟢 |
| RF-12 | ADR-005 | `EX-VAL-14` (D-5 do PM): `QUESTIONS` com 5 chaves + fixtures legadas de `--answers-file` verdes | 🟢 |
| RF-13 | ADR-003 | `--check` sem rede (CI limpo) + documentação do passo de clone | 🟢 verificável · 🟡 processo (ambiente) |
| D-2 (PM) | ADR-004 | `wizard.spec.mjs`: prompt do W3 exibe `java+react` quando o preset escolhido é react | 🟢 |
| RF-14 | ADR-004/001 | `wizard.spec.mjs` + `docs.spec.mjs` (lista única de stacks, sem duplicação à mão) | 🟢 |

---

## 11. Delta Specs: harness-eixos-stack

> **Feature ID**: `harness-eixos-stack`
> **SPEC Source**: `.spec/backend/harness-eixos-stack/SPEC.md`
> **Purpose**: Rastrear exatamente o que muda em documentos existentes quando esta feature for arquivada.

### Delta: `.agents/rules/harness-config.md`

#### MODIFIED
> **Seção alvo**: `## Perfil mobile Flutter/Dart (harness-installer-mobile, 2026-10-08)`
```
## Perfis de stack do instalador (ADR-008 + harness-eixos-stack)

`STACK_PROFILES` (installer/install.mjs) é o registry único das capacidades por
preset: `axes` (IDs de eixo backend/frontend), `backend`/`frontend` (rótulos
literais, congelados por I7), `commands`, `mcp`, `moduleMap`, `stacks`.
Presets atuais: node, node-esm, java+vue, java+react, outra, flutter, dart.
O gating de artefato (skills e rules) deriva do eixo declarado, NUNCA do nome
do arquivo (ADR-002). Perfis backend go/rust ainda não existem; a rota para
eixos separados na pergunta está em ADR-005 do ciclo harness-eixos-stack.
```

### Delta: `.agents/skills/harness-installer/SKILL.md`

#### MODIFIED
> **Seção alvo**: lista de stacks + tabela de perfil + menu do wizard + vendor por stack
```
- Stacks aceitos: node | node-esm | java+vue | java+react | outra | flutter | dart
  (flutter/dart exigem pubspec.yaml; java+react é o preset web com frontend React)
- Menu do wizard: W2m-1 (tipo de projeto, 5 itens) → W2m-2 (frontend: Vue|React,
  apenas no item "Aplicação web"). O range exibido é derivado de WIZARD_MENU.length.
- Vendor: procedência por fonte com `licenseOrigin` (upstream-file |
  declared-evidence). `react-components` é skill OPCIONAL do preset react
  (rede em runtime + @swc/core + Stitch MCP).
```

### Delta: `README.md` (raiz) — **EMENDA** do delta original

> **Emenda (reportada pelo `developer-engineer` no Batch 5)**: o alvo original era `AGENTS.md` da raiz, que **não existe** neste repo (conferido no disco). Criá-lo em silêncio seria inventar documento; a nota foi aplicada no **`README.md`** (documento real) e o desvio está congelado por teste em `installer/__tests__/docs.spec.mjs`.

#### MODIFIED
```
## Stack do destino — escolhida por EIXO (instalador)

A configuração do harness por destino é escolhida por EIXO: backend e frontend
são campos independentes no registry de perfis do instalador (`STACK_PROFILES`,
`installer/install.mjs`; IDs de eixo em `AXIS_IDS`; `stacks` derivado por
`stacksFor(axes)`). Hoje o backend disponível é `java` e o frontend oferecido é
`vue` (padrão) ou `react`. Perfis de backend adicionais (`go`, `rust`) estão
previstos e têm rota documentada (`ADR-005` do ciclo `harness-eixos-stack`).
```
> **Inserir após**: seção de visão geral/stack do `README.md`.

#### MODIFIED
> **Seção alvo**: `.agents/rules/harness-config.md` — ver Delta acima (mesma unidade de mudança).

### Resumo do Impacto

| Documento | ADDED | MODIFIED | REMOVED |
|---|---|---|---|
| `.agents/rules/harness-config.md` | 0 | 1 | 0 |
| `.agents/skills/harness-installer/SKILL.md` | 0 | 1 | 0 |
| `README.md` (raiz) | 0 | 1 | 0 |
| `.agents/skills/VENDOR-NOTICE.md` | 0 | 1 (regenerado) | 0 |
| `.agents/skills/.vendor-lock.json` | 0 | 1 (regenerado) | 0 |

> **Emenda da contabilidade (🟡 D do review do Batch 5)**: a linha original era `AGENTS.md | ADDED | 1` — arquivo **inexistente** no disco; a nota foi para o `README.md` (MODIFIED). O alvo original e a emenda estão declarados no bloco do delta acima.

---

## 12. Asserts aplicados

| Fase | Assert | Resultado |
|---|---|---|
| PROPOSAL | `.agents/skills/sdd-compiler/asserts/proposal-gate.md` | ✅ (ver §1/§3/§4/§5/§7 do PROPOSAL) |
| SPEC | `.agents/skills/sdd-compiler/asserts/spec-gate.md` | ✅ com as N/A declaradas em §8 |
| PLAN/TASKS | `plan-gate.md` / `tasks-gate.md` | ⏳ próxima fase (P2) |
| VERIFY | `verify-gate.md` + `traceability-gate.md` | ⏳ P5 |
