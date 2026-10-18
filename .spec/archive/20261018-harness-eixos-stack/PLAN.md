# Implementation Plan: harness-eixos-stack

> **Fonte**: `.spec/backend/harness-eixos-stack/SPEC.md` (v2) · **ADRs**: `ADR-INDEX.md` + `ADRs/ADR-001..005/ADR.md`
> **Data**: 2026-10-18 · **Tipo**: `refactor` (tooling/instalador Node ESM)
> **Suíte de referência (selada)**: `harness.config.json:14` — `plugins tests && installer tests && static-checks && vendor-skills --check`

## 1. Context & SPEC Traceability

- **Target Specification**: `.spec/backend/harness-eixos-stack/SPEC.md`
- **Goal**: traduzir a SPEC em plano determinístico, com cada RF mapeado a ≥1 task, enforcement explícito e modo de falha declarado.

### 1.1 SPEC Validation Report

- **Status**: **Validated** (SPEC v2; 19/19 conformidade aplicável, 6 N/A declarados em §8)
- **Gaps/warnings conhecidos** (herdados do `REVIEW.md`, todos corrigidos na SPEC; ficam como risco de implementação):
  - `RULES_BY_AXIS` (RF-04) é **novo mecanismo** criado por este ciclo — não há precedente no repo; o risco é virar mapa decorativo (mitigado por T3/T4).
  - `licenseOrigin` (RF-08/RF-10) exige **reorganizar** o assert existente de byte-identidade (`vendor.spec.mjs:396`), que hoje vale para **toda** fonte.
  - `optional: true` (RF-09) é **dado de procedência** — o instalador **não** muda a semântica de inclusão nesta entrega (declarado; não confundir com "skill não instalada").
- **Assumptions adoptadas**:
  1. Os dois repositórios upstream são clonados no momento do vendor (decisão do owner: o `developer-engineer` clona) e ficam **fora** do path de instalação.
  2. O commit pinado é o `HEAD` do branch `main` no momento do clone; o valor entra no lock e passa a ser a identidade do vendor.
  3. Nenhum teste existente será alterado em valor congelado (I9) — apenas escopo estrutural + caso novo.

## 2. Technical Strategy

### 2.1 Backend Strategy
- **N/A** — não há backend Java/Maven neste repo (`harness.config.json:5`). O "backend" aqui é o módulo ESM `installer/install.mjs` (CLI/TTY, puro e testável).

### 2.2 Frontend Strategy
- **N/A** — não há frontend Vue/Vite (`harness.config.json:6`). A camada "frontend" afetada é o **texto do TTY** (menu W2m), especificada pelo parecer vinculante do `ux-designer`.

### 2.3 Infrastructure Strategy
- **Deployment**: nenhum — o artefato é instalado por `installer/install.mjs` em projetos de terceiros.
- **CI/CD**: `.github/workflows/harness-integrity.yml` já roda `static-checks`; o `suiteFull` **selado** é a referência local. Nenhuma mudança de pipeline neste ciclo (I1).

## 3. Architecture Realization & Constraint Mapping

| SPEC Reference | Constraint | Enforcement Point | Failure Mode | Implementation Strategy |
|---|---|---|---|---|
| RF-01 / ADR-001 | Eixos + **literais congelados** + coerência `axes`↔`stacks` (D-1) | `STACK_PROFILES` (`install.mjs:209-258`) + `stacksFor(axes)` | Eixo decorativo: `axes` diz react e `stacks` diz vue ⇒ artefato errado instalado com suíte verde | Adicionar `axes` como campo **novo**; `stacks` derivado; teste de divergência; literais existentes intocados |
| RF-02 / ADR-001 | Preset novo é **adição** | `STACK_PROFILES` + `STACK_VALUES` (`:264`) | Renumeração/remoção quebra fixtures | Append; asserts de chaves viram **superconjunto** (I9) |
| RF-03 / ADR-002 | Gating por **eixo declarado** | `scripts/vendor-skills.mjs:341` + `install.mjs:1186-1198` | Skill vaza para destino errado (A1) ou some do destino certo | `stacks` explícito no source-lock; `inferStacks` vira **fallback**; teste nas 2 direções |
| RF-04 / ADR-002 | Rules também gated (exclusão por eixo, não allowlist) | `RULES_BY_AXIS` + `RULES_COMMON` (novos) em `install.mjs` + `collectIncoming` | Prosa Vue instalada em destino react (A2); ou remoção indevida de rule em `node`/`outra`/mobile (fora do escopo) | Mapa de **exclusão** declarado + lista de comuns; cobertura total por enumeração; teste de não-regressão nos 5 destinos |
| RF-05 / ADR-004 | Range derivado | bloco `W2m` (`:1646`, `:1649`) | Item novo inalcançável (A4) | `WIZARD_MENU.length` no prompt e no erro |
| RF-06 / ADR-004 | Menu em 2 passos, erros 4 linhas | bloco `W2m` (`:1635-1652`) | Regressão do ADR-011 (jargon no menu) / loop de `BAD_ANSWER` | Textos do parecer UX; contador `[i/total]`; `arquivo:linha` na 4ª linha |
| RF-07 / ADR-002 | Default de suíte do par react | `defaultSuiteFor` (`:1560-1570`) | Default vazio ⇒ usuário sem sugestão | Lista `['npm run test:run','npm test']`; primeiro candidato quando nada resolve |
| RF-08/RF-10 / ADR-003 | Procedência por **origem** | `vendor-skills.mjs` + `.vendor-lock.json` | NOTICE afirma garantia que não existe | `licenseOrigin` (`upstream-file` \| `declared-evidence`) + sha por origem |
| RF-09 / ADR-003 | Skill opcional declarada | `.vendor-lock.json` | Terceiro com rede vira default silencioso | Campo `optional: true`; proibido patch no `SKILL.md` |
| RF-11 | Prosa ↔ mecanismo | `SKILL.md` do installer, `harness-config.md`, `AGENTS.md` | Documento mente sobre o mecanismo | Delta Specs do SPEC §11 + `docs.spec.mjs` |
| RF-12 / ADR-005 | Schema intocado | `QUESTIONS` (`:194-200`) | Quebra de `--answers-file` dos consumidores | Nenhuma chave nova; rota só documentada |
| I1 | Gate/config intocados | `.opencode/plugins/gate.js`, `harness.config.json` | Selo ADR-002 invalidado | Nenhum write nesses paths |
| I2 | Golden byte-idêntico | asserts de byte-identidade `golden.spec.mjs:48-61` + builder `baseline()` `:14-45` (**intactos**) | Regressão silenciosa de contrato | Assert congelado **não editado**; o assert **estrutural** de chaves foi reescopado (I9(a), declarado) |
| I3 | Installer rede-zero | `static-checks.mjs` V15 | Instalador passa a depender de rede | Clone só no passo de vendor (build do repo, não do installer) |

## 4. Module & Code Structure

| Módulo/arquivo | Responsabilidades | Fronteiras |
|---|---|---|
| `installer/install.mjs` | registry de perfis (`axes`), `generateConfig`, `validateAnswer`, `collectIncoming`/gating (skills **e** rules), wizard `W0..W7` | Não escreve no wizard; não faz I/O no gerador; rede-zero |
| `scripts/vendor-skills.mjs` | vendor offline, lock, NOTICE, `--check`, allowlist SPDX, `licenseOrigin` | Único ponto com rede (clone é passo externo); nunca roda no destino |
| `.agents/skills/.vendor-lock.json` | procedência por skill (source, commit, hash, stacks, license, **optional**) | Consumido por `--check` e pelo installer |
| `.agents/skills/VENDOR-NOTICE.md` | procedência por fonte (SPDX, origem, ressalvas) | Gerado, nunca editado à mão |
| `installer/__tests__/*.spec.mjs` | contrato do installer (geração, golden, wizard, vendor, docs) | DoD por task; I9 governa edições |
| `.agents/skills/harness-installer/SKILL.md`, `.agents/rules/harness-config.md`, `AGENTS.md` | prosa canônica | Atualizados pelo Delta Specs (RF-11) |

## 5. Risks & Complexity Analysis

- **🔥 CRÍTICO: quebra do golden I7** — o registry é o contrato mais congelado do repo. **Mitigação**: `axes` é campo aditivo; nenhum literal existente é tocado; T2 (EX-02) roda antes de qualquer outra mudança estrutural.
- **🔥 CRÍTICO: `axes` decorativo** (repetir o defeito que motivou o ADR-001). **Mitigação (reforçada pelo PM, D-1)**: `stacks` passa a ser **derivado** de `axes` por `stacksFor(axes)`; EX-04/EX-05 consomem o eixo de verdade (skill **e** rules); o teste negativo (`EX-VAL-02`/`EX-VAL-06`) falha se `axes` e `stacks` divergirem ou se o gating olhar nome.
- **🟠 Vendor depende de ambiente** (FU-48). **Mitigação**: EX-10 tem passo explícito de clone + verificação de commit; se os clones falharem, a task **não** é marcada concluída (nunca "vendor fazer de conta").
- **🟠 Falso claim de licença**. **Mitigação**: EX-11 grava `licenseOrigin` + `evidence[]`; EX-12 divide o assert byte-a-byte por origem.
- **🟡 Duplicação N×M persiste** (decisão declarada do ADR-001). **Mitigação**: EX-01 registra quantas entradas foram tocadas → insumo do ADR-005.

## 6. Implementation Phases & Dependencies

### Phase 1 — Foundation: registry com eixos (`EX-01..EX-03`)
- **Dependencies**: nenhuma.
- **Scope**: `axes` + IDs de eixo; preset `java+react`; default de suíte do par react.
- **DoD**: suíte verde; golden antigo intacto; teste novo do eixo.

### Phase 2 — Gating derivado do eixo (`EX-04..EX-06`)
- **Dependencies**: Phase 1.
- **Scope**: `stacks` declarado no source-lock; `inferStacks` como fallback; `RULES_BY_AXIS`; testes 2 direções (skill + rules).
- **DoD**: nenhum artefato de um eixo vaza para outro; fallback de prefixo preservado.

### Phase 3 — Wizard/menu (`EX-07..EX-09`)
- **Dependencies**: Phase 1 (preset precisa existir) — paralelizável com Phase 2.
- **Scope**: range derivado; `W2m-1`/`W2m-2`; contador; erro 4 linhas; testes escopados (I9).
- **DoD**: fluxo de 2 passos exercitado por teste; `node-esm` ainda alcançável (I10).

### Phase 4 — Vendor (`EX-10..EX-12`)
- **Dependencies**: Phase 2 (o eixo precisa existir para o gating ter sentido) — paralelizável com Phase 3.
- **Scope**: clone pinado; `licenseOrigin`; vendor das 2 skills; lock/NOTICE; split do assert.
- **DoD**: `--check` verde; NOTICE sem claim universal; hashes das skills existentes inalterados.

### Phase 5 — Prosa e fechamento (`EX-13..EX-14`)
- **Dependencies**: Phases 1–4.
- **Scope**: Delta Specs aplicados; suíte completa; dry-run E2E; brain.
- **DoD**: paridade prosa↔mecanismo provada por teste; suíte 0 falhas; evidência de harness.

## 7. Critical Execution Path

`EX-01` → `EX-02` → `EX-03` → `EX-04` → `EX-05` → `EX-06` → `EX-07` → `EX-08` → `EX-09` → `EX-14`

*(Corrigido pelo PM — D-6: a versão anterior omitia `EX-05` (pré-requisito de `EX-06`) e `EX-07` (pré-requisito de `EX-08`), o que não é caminho no DAG.)*

## 8. Atomic Task Breakdown & Execution Graph

### Phase 1 — Registry com eixos

- **[EX-01]** [ ] Modelar `axes` (IDs de eixo) no registry, preservando literais congelados
  - **Depends on**: None · **Layer**: Infra · **Artifact**: `installer/install.mjs` (`STACK_PROFILES`)
  - **Enforcement**: `axes.{backend,frontend}` em **toda** entrada; `backend`/`frontend` literais **inalterados**
  - **Constraint Ref**: RF-01, ADR-001, I2
- **[EX-02]** [ ] Testes do registry/eixo (TDD first)
  - **Depends on**: EX-01 · **Layer**: Test · **Artifact**: `installer/__tests__/golden.spec.mjs` + `generate.spec.mjs`
  - **Enforcement**: chaves = **superconjunto**; asserts de valor congelado **intactos** (I9)
  - **Constraint Ref**: RF-01, I2, I9
- **[EX-03]** [ ] Preset `java+react` + `defaultSuiteFor` do par react + prompt do W3 coerente (RF-14)
  - **Depends on**: EX-01 · **Layer**: Infra · **Artifact**: `installer/install.mjs` (`STACK_PROFILES`, `STACK_VALUES` `:264`, `defaultSuiteFor` `:1560-1570`, prompt `:196`, `howToFix` `:1575`)
  - **Enforcement**: `moduleMap` de stack não entra em `config-ref-missing`; lista de suíte conforme RF-07; **fonte única** para a lista de stacks (RF-14 / D-2)
  - **Constraint Ref**: RF-02, RF-07, RF-14, ADR-001

### Phase 2 — Gating por eixo

- **[EX-04]** [ ] Declarar `stacks` de skill na origem e rebaixar `inferStacks` a fallback
  - **Depends on**: EX-03 · **Layer**: Integration · **Artifact**: `scripts/vendor-skills.mjs`
  - **Enforcement**: `stacks` explícito vence; prefixo conhecido = fallback idêntico ao atual
  - **Constraint Ref**: RF-03, A1, ADR-002
- **[EX-05]** [ ] `RULES_BY_AXIS` + filtro de `.agents/rules/**` no `collectIncoming`
  - **Depends on**: EX-04 · **Layer**: Integration · **Artifact**: `installer/install.mjs`
  - **Enforcement**: mapa **declarado**; artefato não citado = comum; proibido inferir por nome
  - **Constraint Ref**: RF-04, A2, ADR-002
- **[EX-06]** [ ] Testes de gating nas **duas direções** (skill + rules)
  - **Depends on**: EX-05 · **Layer**: Test · **Artifact**: `installer/__tests__/eixos-stack.spec.mjs` (novo)
  - **Enforcement**: entra em react; **não** entra em `java+vue`/`node`/`outra`; fallback dart/flutter inalterado
  - **Constraint Ref**: RF-03, RF-04, I9

### Phase 3 — Wizard/menu

- **[EX-07]** [ ] Derivar o range do menu de `WIZARD_MENU.length`
  - **Depends on**: EX-03 · **Layer**: Interface · **Artifact**: `installer/install.mjs` (bloco `W2m`)
  - **Enforcement**: prompt e mensagem de erro usam o range derivado
  - **Constraint Ref**: RF-05, A4, ADR-004
- **[EX-08]** [ ] `W2m` em 2 passos + padrões do bloco de erro reparados
  - **Depends on**: EX-07 · **Layer**: Interface · **Artifact**: `installer/install.mjs`
  - **Enforcement**: textos do parecer UX (vinculante, adaptado por D-A); contador `[i/total]`; 4ª linha `arquivo:linha`
  - **Constraint Ref**: RF-06, ADR-004
- **[EX-09]** [ ] Testes do wizard (escopados) + exercício do fluxo de 2 passos
  - **Depends on**: EX-08 · **Layer**: Test · **Artifact**: `installer/__tests__/wizard.spec.mjs`
  - **Enforcement**: asserção de "5 itens" escopada ao `W2m-1`; `node-esm` ainda alcançável (I10); `q` = 0 writes
  - **Constraint Ref**: RF-06, I9, I10

### Phase 4 — Vendor

- **[EX-10]** [ ] Clonar upstreams no commit pinado + `licenseOrigin` no script de vendor
  - **Depends on**: EX-06 · **Layer**: Integration · **Artifact**: `scripts/vendor-skills.mjs`
  - **Enforcement**: `upstream-file` vs `declared-evidence`; sha por origem; NOTICE declara origem por fonte
  - **Constraint Ref**: RF-08, RF-10, RF-13, A5, ADR-003
- **[EX-11]** [ ] Vendorizar as 2 skills (lock + NOTICE + `optional: true`)
  - **Depends on**: EX-10 · **Layer**: Integration · **Artifact**: `.agents/skills/.vendor-lock.json`, `VENDOR-NOTICE.md`, `LICENSE-*`
  - **Enforcement**: cópia byte-idêntica (sem patch); `optional: true` só em `react-components`; hashes das skills existentes inalterados
  - **Constraint Ref**: RF-08, RF-09, I5, ADR-003
- **[EX-12]** [ ] Testes de vendor por origem + split do assert byte-a-byte
  - **Depends on**: EX-11 · **Layer**: Test · **Artifact**: `installer/__tests__/vendor.spec.mjs`
  - **Enforcement**: `declared-evidence` valida o **nosso** sha; `upstream-file` valida fidelidade ao upstream; `--check` verde
  - **Constraint Ref**: RF-10, A5

### Phase 5 — Prosa e fechamento

- **[EX-13]** [ ] Aplicar o Delta Specs (prosa ↔ mecanismo)
  - **Depends on**: EX-12 · **Layer**: Interface · **Artifact**: `harness-installer/SKILL.md`, `harness-config.md`, `AGENTS.md` + `docs.spec.mjs`
  - **Enforcement**: nenhuma afirmação sem mecanismo; testes de doc verdes
  - **Constraint Ref**: RF-11, delta do SPEC §11
- **[EX-14]** [ ] Fechamento: suíte completa, dry-run E2E declarado, evidência e brain
  - **Depends on**: EX-13 · **Layer**: Test · **Artifact**: `harness/harness-eixos-stack.json` + suíte
  - **Enforcement**: `commands.suiteFull` 0 falhas; dry-run nos 2 presets web com **0 writes**; brain registrado
  - **Constraint Ref**: I3, I4, §7 do SPEC (E2E declarado)

## 9. Event Implementation Mapping

**N/A declarado**: não há eventos, broker, outbox ou consumer neste repo (sem mensageria, sem DB). O checklist de 4 tasks por evento **não se aplica** — declarado, não pulado em silêncio.

## 10. Execution Readiness Checklist

- [x] Todas as tasks têm dependências válidas (sem ciclo; grafo em `TASKS.md` §3).
- [x] N/A justificado para eventos (sem mensageria).
- [x] Tasks de teste explícitas para as restrições críticas (golden/I2 em EX-02; gating A1/A2 em EX-06; vendor em EX-12).
- [x] Tasks de base explícitas (registry/eixo antes da lógica — EX-01 precede tudo).
- [x] Caminho crítico mapeia só o fluxo core (§7).
- [x] Restrições do SPEC sem task órfã: **RF-01..RF-14 todas com ≥1 task** (§3 + §8) — inclui RF-12 (D-5 do PM: rastreável em `EX-VAL-14`) e RF-14 (D-2 do PM: em `EX-BE-03`).
