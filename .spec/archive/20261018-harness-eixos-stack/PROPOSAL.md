# Change Proposal: harness-eixos-stack

> **ID**: `harness-eixos-stack`
> **Status**: `Under Review` (P1 — aguarda aprovação do usuário para Planejamento)
> **Author**: orchestrator (sdd-orquestrador)
> **Date**: 2026-10-18
> **Source**: descrição direta do usuário (2026-10-18) + parecer `architect` (5 ADRs) + parecer `ux-designer` (vinculante) + decisões de portão D-A..D-D
> **Tipo**: `refactor` (melhoria de configuração do instalador; sem valor de produto novo ⇒ esteira ADR-only por isenção em `.agents/rules/prd-adr-pipeline.md` §3)

---

## 1. Problem Statement

- **Contexto**: a configuração do harness é decidida por **uma única pergunta** de stack (`QUESTIONS` em `installer/install.mjs:194-200`, validada contra `STACK_VALUES` em `installer/install.mjs:264`). O registry `STACK_PROFILES` (`installer/install.mjs:209-258`) é indexado por **valor composto** (`java+vue`, `flutter`, `dart`, `node`, `node-esm`, `outra`), e os campos `backend`/`frontend` de cada perfil são **descrições humanas congeladas** (`installer/install.mjs:210-212`, `226-228`), **não identidades de eixo**. Não existe `backendId`/`frontendId`.
- **Impacto atual**: (a) o usuário não consegue escolher **React** — o único caminho web é `java+vue`; (b) o objetivo declarado (java/go/rust × vue/react) custa **O(N·M) duplicação**: 6 campos × 6 perfis hoje, e o par não enumerado falha fechado com `BAD_ANSWER` (`installer/install.mjs:298-300`); (c) o menu de produto (5 itens) funde dois eixos no item 4 (`installer/install.mjs:1496`), então "frontend sem backend" e "backend sem frontend" não são expressáveis; (d) o eixo que **de fato** existe no código — `stacks`, que controla quais skills entram — é resolvido pelo **nome** da skill, não pelo perfil.
- **Evidência**: parecer do `architect` (§1.1/§1.5/§2) com arquivo:linha; parecer do `ux-designer` (§1, defeitos 2..5 do menu); achados A1/A2/A4/A5 registrados em `workflow-state.json` → `cycle_eixos_stack.achados_de_analise`.
- **Defeito concreto e já reproduzível por leitura** (A1, severidade P1): `inferStacks` conhece apenas os prefixos `dart-`/`flutter-` (`scripts/vendor-skills.mjs:284-288`) e grava `stacks` derivado do **nome** no lock (`scripts/vendor-skills.mjs:341`); como `stacks: []` significa "skill comum, entra sempre" (`installer/install.mjs:1195-1196`), as duas skills React **vazariam para todos os destinos** e o perfil react **não filtraria nada**.

---

## 2. Proposed Solution

**Resumo**: separar backend e frontend como **eixos de primeira classe** no registry de perfis do instalador (`axes` com IDs estáveis + rótulos literais congelados), materializar o perfil **React** (com as duas skills vendorizadas), e derivar o gating de skills/rules do **eixo** em vez do nome do arquivo — preservando byte-a-byte a configuração gerada das stacks existentes.

**Abordagem**:
- Registry passa a `{ axes: { backend, frontend }, backend: <literal>, frontend: <literal>, commands, mcp, moduleMap, stacks }`. `axes` = **identidade**; `backend`/`frontend` continuam **literais congelados** (nunca concatenados) — é isso que mantém o golden I7 verde (prova: `installer/__tests__/golden.spec.mjs:48-61`).
- `profileOf(stack)` e `generateConfig(answers, {writtenPaths})` **não mudam de assinatura nem de saída** para os presets existentes. Novos presets são **adições**.
- Presets desta entrega: `java+vue` (existente, intacto) e **`java+react`** (novo). Target = `react`.
- Gating de skill deixa de vir do nome: `inferStacks` passa a ler a origem declarada (eixo/perfil) e o lock ganha o campo de eixo; `.agents/rules/**` recebe o **mesmo** filtro que hoje só vale para `.agents/skills/**` (`installer/install.mjs:1186-1198`) — fecha A1 e A2.
- Menu: `W2m` passa de 1 menu para **2 passos** — `tipo de projeto (5 itens)` → `frontend (Vue | React)` quando o item 4 for escolhido; o eixo backend vira pergunta própria **quando** go/rust entrarem (decisão D-A). O range `[1-5]` hardcoded (`installer/install.mjs:1646`, `:1649`) passa a derivar de `WIZARD_MENU.length` (fecha A4).
- Vendor: `scripts/vendor-skills.mjs` ganha `licenseOrigin` (`upstream-file` | `declared-evidence`) e o `VENDOR-NOTICE` passa a declarar a origem **por fonte** em vez de afirmar byte-identidade universal (fecha A5). As 2 skills entram por esse caminho, com `react-components` marcada como **opcional**.
- **Alternativas descartadas**: (i) aditivo raso — só `+java+react` sem eixo — reproduz N×M e obriga a refazer o registry na migração; (ii) migrar já para a pergunta dupla `backend`+`frontend` — quebra ≈20 fixtures de `--answers-file` e o escopo aprovado; (iii) derivar rótulos por concatenação de strings — quebra o golden **por formatação**, não por semântica; (iv) manter menu único de 5 itens — não expressa eixo e não escala (Hick/Miller, parecer UX §2).

---

## 3. Scope

### In Scope
- [ ] Modelar `axes` (IDs estáveis) nos perfis, preservando os 6 presets existentes byte-a-byte.
- [ ] Preset/perfil **`java+react`** com capacidades próprias (`commands`/`mcp`/`moduleMap`/`stacks`).
- [ ] **A1**: gating de skill derivado do eixo (fim do vazamento de skill react para todo destino).
- [ ] **A2**: gating de `.agents/rules/**` pelo mesmo eixo.
- [ ] **A4**: range do menu derivado de `WIZARD_MENU.length` (item novo alcançável).
- [ ] `W2m` em **2 passos** (tipo de projeto → frontend), com contador `[i/total]`, linha 3 do erro em linguagem de produto e linha 4 com `arquivo:linha` (padrões reparados pelo parecer UX).
- [ ] **A5 + política de vendor**: `licenseOrigin` + `VENDOR-NOTICE` com origem por fonte; vendorizar `react-components` (Apache-2.0, **opcional**) e `react-best-practices` (MIT, **padrão**), com commit pinado.
- [ ] ADRs em disco (esteira ADR-only): `ADR-INDEX.md` + 5 ADRs em `.spec/backend/harness-eixos-stack/ADRs/`.
- [ ] ADR-005 documentando a **rota** de migração para a pergunta dupla (desenho, não execução).
- [ ] **RF-14 (correção do PM, D-2)**: a lista de stacks deixa de ser duplicada à mão — prompt do W3 (`installer/install.mjs:196`) e `howToFix('stack')` (`:1575`) derivam da fonte única. *Verificado que nenhum teste congela essa string (grep: só o call site), portanto não é "prompt congelado".*

### Out of Scope
- Perfis de backend **`go`** e **`rust`** (usuário: "no futuro"). O menu e o registry ficam preparados; nenhum perfil é criado.
- Presets **`java`** (backend sem frontend) e **`vue`**/**`react`** (frontend sem backend) — propostos no parecer UX (3 passos) e **cortados** pela decisão D-A (2 passos).
- Executar a migração para a pergunta dupla (ADR-005 é só o desenho).
- Escrever skill nova, alterar `.opencode/plugins/gate.js`, alterar `commands.suiteFull` do repo (mudaria o selo ADR-002).
- Dogfood em projeto externo.
- **Honrar** o campo `optional` no instalador (nesta entrega ele é **metadado**; ver RF-09/D-3) — fazer o instalador pular a skill opcional é decisão nova do owner.
- Criar `frontend-react-standards.md` em `.agents/rules/` (não existe hoje; criação = decisão do owner — ver RF-04/D-4a).

---

## 4. Architecture Impact

| Aspecto | Impacto | ADR Necessário? |
|---------|---------|-----------------|
| Backend (módulos Java/DDD) | **N/A** — este repo não tem backend Java/Maven (`harness.config.json:5`) | Não |
| Frontend (componentes/stores) | **N/A** — sem Vue/Vite neste repo (`harness.config.json:6`); o "frontend" afetado é o **texto do TTY** do instalador | Não |
| Banco de dados / migrations | **N/A** — sem DB neste repo | Não |
| Multi-tenancy | **N/A** — sem tenancy | Não |
| Segurança / RBAC | **Sem impacto** — sem autenticação, sem roles, sem `@HasPermission` neste repo. Superfície relevante = **supply-chain do vendor** (licença + integridade por hash), coberta por ADR-003 | Sim (ADR-003) |
| Eventos (async) | **N/A** | Não |
| Instalador — registry/geração | `STACK_PROFILES`, `profileOf`, `generateConfig`, `validateAnswer` (`installer/install.mjs:209-258`, `260-262`, `381-429`, `296-321`) | Sim (ADR-001) |
| Instalador — gating de artefato | `collectIncoming`/`skillAllowedForStacks` (`installer/install.mjs:1186-1227`) | Sim (ADR-002) |
| Instalador — vendor | `scripts/vendor-skills.mjs` (lock, NOTICE, `--check`) | Sim (ADR-003) |
| Instalador — wizard | `WIZARD_MENU` + bloco W2m (`installer/install.mjs:1492-1498`, `1635-1652`) | Sim (ADR-004) |
| Contrato do `--answers-file` | chaves `project|stack|suiteCommand|pluginsDir|deployToken` — **mantidas** nesta entrega; `answersVersion` fica reservado para ADR-005 | Sim (ADR-005, só desenho) |

---

## 5. Delta Preview

| Documento Alvo | Tipo de Mudança | Seção Afetada |
|----------------|-----------------|---------------|
| `.agents/rules/harness-config.md` | MODIFIED | seção "Perfil mobile Flutter/Dart (harness-installer-mobile, 2026-10-08)" → passa a descrever os perfis existentes **e** o eixo `axes` (hoje a prosa diz que o mobile é o único perfil especial — achar D4 do parecer) |
| `.agents/skills/harness-installer/SKILL.md` | MODIFIED | lista de stacks (`:61,80`), tabela de perfil (`:196-203`), menu W2m (`:220-228`), vendor por stack (`:239-251`) |
| `.agents/skills/VENDOR-NOTICE.md` | MODIFIED (regenerado) | tabela de procedência → coluna/declaração de `licenseOrigin` por fonte |
| `.agents/skills/.vendor-lock.json` | MODIFIED (regenerado) | `licenses[]` ganha `licenseOrigin` + `evidence[]`; `skills[]` ganha as 2 skills react |
| `AGENTS.md` (raiz) | ADDED | nota de que a stack do destino é escolhida por eixo (backend/frontend) no instalador |

---

## 6. Risk Assessment

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Quebra do golden I7 (saída gerada deixa de ser byte-idêntica para as stacks existentes) | Média | Alto | Literais congelados, zero concatenação; `golden.spec.mjs:48-61` roda no `suiteFull` (selado) — falha = bloqueio |
| Campo `axes` virar decorativo (fachada), repetindo o defeito que motivou o ADR-001 | Média | Alto | Inventário de consumo derivado do eixo: `stacks` de skill e de rules; teste novo que falha se o gating voltar a usar o nome |
| Vazamento silencioso de skill react para outros destinos (A1) | Alta **se não corrigido** | Médio | A1 entra no escopo; teste com 2 direções (entra em react, **não** entra em `java+vue`) |
| Vendedor de licença: `licenseOrigin` ser só rótulo, sem verificação real | Média | Médio | `--check` valida sha do texto agregado por origem; ✅ VERIFY checa o caso `declared-evidence` explicitamente |
| Skill `react-components` com rede em runtime (`curl`) e `@swc/core` cair num destino que a trate como default | Média | Médio | Marcada como **opcional**; declarada no NOTICE/SPEC; V15 **não** cobre `.agents/skills/**` (declarado, não escondido) |
| Perda de comportamento do wizard (W0..W7) por mexer no menu | Baixa | Alto | Wizard é apresentação pura (nunca chama `generateConfig`, nunca escreve); testes `wizard.spec.mjs` cobrem por string |
| `[1-5]` literal remanescente deixar item inalcançável | Média | Médio | A4: derivar de `WIZARD_MENU.length` + teste que adiciona item sintético e verifica alcance |
| Prosa × mecanismo divergir de novo (D1..D5 do parecer) | Alta (histórico) | Médio | Delta Specs aponta os 3 docs de prosa; `docs.spec.mjs` congela a paridade |
| **Eixo decorativo**: `axes` existe mas o gating continua pela chave composta (D-1 do PM) | Média | Alto | `stacks` derivado de `axes` por `stacksFor`; teste de divergência que falha com o registry incoerente |
| **Owner lê "opcional" como "não instalada"** (D-3 do PM) | Alta | Médio | Critério explícito: as 2 skills são instaladas; `optional` é metadado; declarado no REPORT do `EX-VAL-14` |
| **Owner escolhe React e a tela seguinte mostra a lista antiga** (D-2 do PM) | Alta | Médio | RF-14: prompt do W3 derivado da fonte única + teste do valor escolhido |

---

## 7. Success Criteria

- [ ] **Funcional**: no menu W2m, escolher "Aplicação web" → "React" produz configuração gerada com `stack.backend`/`stack.frontend` distintos do par Vue, e o destino recebe as 2 skills react.
- [ ] **Funcional (não-regressão)**: escolher "Aplicação web" → "Vue" (default) reproduz exatamente o comportamento atual (`java+vue`).
- [ ] **Observável pelo owner (D-8)**: o fluxo de **2 telas** do menu tem evidência salva em `.spec/backend/harness-eixos-stack/harness/wizard-react-transcript.txt` — o `--answers-file` **pula** o menu, então o transcript é a única prova visível. É **ali** que o owner confere o critério funcional.
- [ ] **Sem ambiguidade de leitura (D-3)**: nesta entrega, "skill opcional" **não** significa "não instalada" — o destino react recebe **as duas** skills; `optional` é metadado de procedência. Declarado no REPORT final.
- [ ] **Motor de eixo visível (D-1)**: `stacks` é derivado de `axes`, e um teste de divergência fica **vermelho** se o registry perder a coerência (impede o eixo decorativo).
- [ ] **Técnico**: `node --test ".opencode/plugins/__tests__/*.spec.mjs" && node --test "installer/__tests__/*.spec.mjs" && node scripts/static-checks.mjs && node scripts/vendor-skills.mjs --check` → **0 falhas** (é o `commands.suiteFull` selado, `harness.config.json:14`).
- [ ] **Técnico**: a config gerada para os 6 presets existentes continua **byte-idêntica** (asserts de byte-identidade `golden.spec.mjs:48-61` + builder `baseline()` `:14-45` **intactos**).
- [ ] **Técnico (A1/A2)**: teste prova que skill/rule react entra no destino react e **não** entra em `java+vue`/`node`/`outra`.
- [ ] **Técnico (vendor)**: `.vendor-lock.json` com as 2 skills, `sourceCommit` pinado, `licenseOrigin` explícito; `--check` verde; `VENDOR-NOTICE` sem claim de byte-identidade para a fonte `declared-evidence`.
- [ ] **Qualidade**: zero linha alterada em `.opencode/plugins/gate.js` e em `commands.suiteFull`; `code-reviewer` sem 🔴; `brain_store` das lições.

---

## 8. Completion Metadata
*Preenchido durante `archive`.*

- **Archived on**: —
- **Duration**: —
- **Archive path**: —
- **Files changed**: —
