# Implementation Plan: Esteira PRD → ADR → SDD no harness

## 1. Context & SPEC Traceability

- **Target Specification**: `.spec/backend/prd-adr-pipeline/SPEC.md`
- **Goal**: traduzir a SPEC em plano determinístico e executável, com enforcement rastreável e ordem que **nunca deixa a suíte vermelha por mais tempo do que o necessário**.

### 1.1 SPEC Validation Report

- **Status**: `Strictly Validated` (spec-gate 10/10; spec-review 0 🔴; security pass com ressalva pré-existente)
- **Identified Gaps/Warnings**:
  - **G-1 (RESOLVIDO durante o P1→P2)**: a suíte ficou **RED** por drift do `SDD-02` enquanto `PLAN.md`/`TASKS.md` não existiam (estado transitório esperado entre P1 e P2). **Fechado** no instante em que os dois arquivos foram materializados — verificado: `sdd-checks` 8/8 PASS, `SDD-02` com `artifacts 4/4, tasks sections=12 declared=12`. **Não há drift em aberto.**
  - **G-2 (declarado)**: `gate.js:487-516` não escopa escrita de `product-manager`/`architect` (lacuna D11). **Não corrigido** — exige editar `gate.js` (fora de escopo, ADR-P03).
  - **G-3 (declarado)**: em repo-destino o enforcement é 🟡 processo até F3; `INCOMING_ROOTS` não propaga `scripts/`+`.github/`.
- **Assumptions Made**:
  - **A-1**: o harness deste ciclo já tem o `installer upgrade` (`main 68be417`); a branch `feat/prd-adr-pipeline` parte de lá.
  - **A-2**: `.opencode/plugins/__tests__/**` é path protegido ⇒ os testes criados por `PAP-02` exigem trailer `Harness-Gate-Change` no commit.
  - **A-3**: nenhum AC do PROPOSAL/SPEC depende de rede, banco ou MCP.
  - **A-4**: `current_feature` permanece o literal `prd-adr-pipeline` durante todo o ciclo — toda delegação via `task` precisa nomeá-lo (INV-6, `gate.js:724-743`).

---

## 2. Technical Strategy

### 2.1 Backend Strategy
- **Framework**: **N/A** — o harness não tem backend Java/Maven (`harness.config.json:5`).
- **Architectural Pattern**: análogo aplicável = **núcleo puro + adaptador**. O núcleo (`checks.mjs`) é puro e sem I/O; o adaptador (`scripts/static-checks.mjs`) importa e registra no relatório. Mesma disciplina do dual-export v1/v2 do precedente `opencode-v2-plugin-migration`.

### 2.2 Frontend Strategy
- **Framework**: **N/A** — sem frontend (`harness.config.json:6`). Sem `ux-designer` neste ciclo (declarado em Fase 1).

### 2.3 Infrastructure Strategy
- **Deployment Model**: **N/A** — toolchain local. O "deploy" é a propagação repo→repo do installer.
- **CI/CD**: **sem mudança de pipeline**. O `.github/workflows/harness-integrity.yml` já roda `static-checks.mjs` e `sdd-checks.mjs`; os checks novos entram por dentro. Alterar `commands.suiteFull` mudaria o selo e quebraria o contraprova (ADR-P02/constraint 2).

---

## 3. Architecture Realization & Constraint Mapping

| SPEC Reference | Constraint | Enforcement Point | Failure Mode | Implementation Strategy |
|----------------|------------|-------------------|--------------|-------------------------|
| `ADR-P01` / `RF-01` | Bucket `prd` jamais reconhecido como ciclo SDD | const `SPEC_NON_CYCLE` em `scripts/sdd-checks.mjs` | **Verde-falso**: `SDD-02` valida o `TASKS.md` de outro ciclo enquanto o ADR ativo não é validado | Adicionar `"prd"` ao set + teste de regressão com fixture de `.spec/prd/<feat>/` incompleto |
| `ADR-P02` / `RF-02` | Check não pode virar gate órfão no repo-destino | `.agents/skills/prd-adr-pipeline/checks.mjs` (path propagável) | Regra propaga prometendo enforcement que o destino não tem | Módulo puro sob `.agents/skills/**`; `scripts/` só importa |
| `ADR-P03` / `RF-04` | Zero deny novo; selo intacto | `gate.js` + `harness.config.json` intocados | `R-NODENY` FAIL; contraprova quebra por troca de selo | Proibição explícita + prova por `git diff` na verificação |
| `ADR-P04` / `RF-03` | `ADR.md` declara `depende-de` + interface congelada | Check `ADR-01` | "Independência" vira aspiração; ADR-2 quebra no merge | Campo obrigatório validado por check |
| `ADR-P05` / `RF-06` | Fases são rótulos, não valores novos de `current_phase` | Tabela V17 em `workflow-rules.md` (prova só o **marcador**) + tabela canônica de `sdd-workflow-standard.md` | **Nada recusa um valor inventado** — `gate.js` só compara com `Completed` (correção de premissa, review do PAP-07). Proteção é processo 🟡 | Acrescentar linhas mantendo os marcadores `hasVocabTable` |
| `RF-05` | Ref órfã `templates/ADR_TEMPLATE.md` | `.agents/skills/sdd-architecture-board/` | Template citado e inexistente (`SKILL.md:36`) | Criar o arquivo e repontar |
| `NFR-2` | Budget de regras ≤1705 linhas | `V4` (check em `scripts/sdd-checks.mjs`) | Suíte vermelha por prosa excessiva | Regra enxuta; detalhe nos templates da skill |
| `RF-08` | SSoT único de requisito | 3 AGENT.md/PROMPT.md | SSoT triplo = retrabalho (a dor declarada) | Repontar `GEMINI.md`/`docs/specs/`/`docs/adr/` → `.spec/prd/**` |
| `INV-6` | `current_feature` literal em toda delegação | `gate.js:724-743` (`inferNewCycle`) | `prev-cycle-not-completed` nega a delegação | Nomear o literal em todo prompt de `task` |
| `RF-09` | Operação de branch/PR sem `gh` | procedimento + `git` | Automação inexequível (`gh` ausente) | `git push` + URL de compare impressa; merge humano |

---

## 4. Module & Code Structure

| Module Name | Responsibilities | Boundaries & Communication |
|-------------|------------------|----------------------------|
| `checks.mjs` (`.agents/skills/prd-adr-pipeline/`) | Núcleo puro: `runPrdChecks(root)` com `PRD-01`/`ADR-01`/`ADR-02` | Sem rede, sem MCP, sem escrita, sem `exec`. Consumido por import |
| `templates/` (mesma skill) | Esqueletos `PRD.md`, `RESEARCH.md`, `ADR-INDEX.md`, `ADR.md` | Texto puro; sem lógica |
| `scripts/static-checks.mjs` | Adaptador: importa e registra o resultado no relatório | Não contém regra de negócio do check |
| `scripts/sdd-checks.mjs` | Detecção de ciclo SDD + guard `prd` non-cycle | Único ponto de mudança do resolver |
| `.agents/rules/prd-adr-pipeline.md` | Política descritiva da esteira | Não nega tool; cita mecanismo |
| `.agents/rules/workflow-rules.md` · `sdd-workflow-standard.md` | Vocabulário (V17) e layout/estado | Editar preservando marcadores de check |
| `.agents/agents/**` | Wiring das fases + conserto de drift | Preservar cláusula de não-bypass (SDD-01) e `gates.P1_P2`/`P2_P3` (SDD-03) |

---

## 5. Risks & Complexity Analysis

- **🔥 RISCO CRÍTICO 1 — verde-falso do resolver**
  - **Mitigação**: `PAP-01` (guard + teste de regressão) é a **primeira** task de código, antes de qualquer materialização de `.spec/prd/**`. Fixture obrigatória: `.spec/prd/<current_feature>/` existente e incompleto ⇒ `SDD-02` deve apontar o ciclo correto **sem** drift.
- **🔥 RISCO CRÍTICO 2 — suíte vermelha por materializar `.spec/prd/**` sem o guard**
  - **Mitigação**: o drift do `SDD-02` (P1→P2) **já foi fechado** (8/8 PASS). O risco remanescente é criar `.spec/prd/{id}/` **antes** de `PAP-01`: sem o guard, `SDD-02` acusa drift ou, pior, resolve outro ciclo (verde-falso). Por isso `PAP-01` é a **primeira** task de código e é pré-requisito da task de dogfood (`PAP-11`), que só materializa o PRD real depois do guard no lugar.
- **⚠️ RISCO 3 — corrida adversarial nos checks (padrão FU-32, 4 iterações)**
  - **Mitigação**: checks estruturais (presença/campo/orfandade). Proibido denylist, varredura semântica ou heurística.
- **⚠️ RISCO 4 — trailer em path protegido**
  - **Mitigação**: `PAP-02` (testes em `.opencode/plugins/__tests__/**`) e `PAP-06`/`PAP-07`/`PAP-08`/`PAP-09` (rules/agents) exigem `Harness-Gate-Change`. Declarado no checklist de cada task.
- **⚠️ RISCO 5 — estouro de V4**
  - **Mitigação**: a regra nova fica ≤80 linhas; o detalhe vai para os templates da skill.

---

## 6. Implementation Phases & Dependencies

### Phase 1: Foundation (guard + núcleo + templates)
- **Dependencies**: None.
- **Scope**: `PAP-01` (guard do resolver + regressão) → `PAP-02` (testes TDD dos 3 checks) → `PAP-03` (núcleo `checks.mjs`) → `PAP-04` (wiring no adaptador) → `PAP-05` (templates + conserto da ref órfã).
- **Racional**: o guard precede tudo; os checks nascem com teste antes de código.

### Phase 2: Governance (regra + vocabulário + layout)
- **Dependencies**: Phase 1.
- **Scope**: `PAP-06` (regra descritiva) → `PAP-07` (emendas `workflow-rules.md` V17 + `sdd-workflow-standard.md` §1/§2).

### Phase 3: Wiring de agentes e SSoT
- **Dependencies**: Phase 2 (a regra precisa existir para os agentes referenciarem).
- **Scope**: `PAP-08` (orchestrator + sdd-orquestrador) → `PAP-09` (drift: product-manager, architect, code-reviewer).

### Phase 4: Dogfood real + Fechamento
- **Dependencies**: Phase 3 + `PAP-04` + `PAP-05`.
- **Scope**: `PAP-11` (dogfood: rodar a esteira **sobre si mesma** — `.spec/prd/prd-adr-pipeline/` real com PRD, RESEARCH, ADR-INDEX e `ADRs/ADR-00N-{slug}/`) → `PAP-10` (README + verificação final **com o artefato real em disco**) → `PAP-12` (instrumentação do baseline SM-1..SM-7).

Adicionado após o parecer de negócio: sem `PAP-11` o critério central do produto (PRD aprovado antes do ADR) não tinha mecanismo real e o aceite passaria "verde por ausência" (achado O-1, bloqueador B-1).

---

## 7. Critical Execution Path

Caminho crítico para o MVP (ignora documentação secundária):

`PAP-01` → `PAP-02` → `PAP-03` → `PAP-05` → `PAP-06` → `PAP-07` → `PAP-08` → `PAP-09` → `PAP-10` → `PAP-12`

com o ramo paralelo `PAP-03` → `PAP-04` → `PAP-11` → `PAP-10` convergindo em `PAP-10` (que exige `09` **e** `11`).

Justificativa: guard + checks + wiring dão o núcleo de máquina; `PAP-05`/`PAP-06` estão no caminho porque são **hard deps** de `PAP-06`/`PAP-07` (o vocabulário/layout sem a emenda contradiz a regra vigente e `§14.8` não fecha); `PAP-08` é hard dep de `PAP-09`; `PAP-09` é hard dep de `PAP-10` e fecha `§14.7`; `PAP-11` é hard dep de `PAP-10` porque o critério central exige o artefato **real** em disco (achado O-1); `PAP-12` fecha a medição.

Histórico de correção: a 1ª versão deste caminho (`...→04→10`) violava hard deps; a 2ª (`...→04→07→09→11→10`) ainda pulava `PAP-05`, `PAP-06` e `PAP-08`. Ambas reprovadas no parecer de negócio — o caminho agora é derivado do grafo de `§8`, não escrito à mão.

Corte honesto: `PAP-05`/`PAP-06`/`PAP-08` entregam **formato e operação** além de serem deps; `PAP-12` é fechamento de medição e não bloqueia código.

---

## 8. Atomic Task Breakdown & Execution Graph

### Phase 1 – Foundation

- **[PAP-01]** [ ] Guard do resolver: `"prd"` em `SPEC_NON_CYCLE` + teste de regressão
  - **Depends on**: `None`
  - **Layer**: `Infrastructure`
  - **Artifact**: `scripts/sdd-checks.mjs`, `.opencode/plugins/__tests__/sdd-checks.spec.mjs`
  - **Enforcement**: `.spec/prd/<feat>/` incompleto não produz drift nem muda o alvo do `SDD-02`
  - **Constraint Ref**: `ADR-P01`, `RF-01`, `INV-4`
  - **Framework Detail**: `node:test`, edição de set estático

- **[PAP-02]** [ ] Testes dos 3 checks (fixtures PASS/FAIL) — TDD FIRST
  - **Depends on**: `PAP-01`
  - **Layer**: `Integration`
  - **Artifact**: `.opencode/plugins/__tests__/prd-checks.spec.mjs`
  - **Enforcement**: ≥1 fixture PASS e ≥1 FAIL por check, incluindo o caso negativo de cada asserção
  - **Constraint Ref**: `RF-03`, `NFR-1`
  - **Framework Detail**: `node:test`, fixtures em dir temporário

- **[PAP-03]** [ ] Núcleo puro `runPrdChecks(root)`
  - **Depends on**: `PAP-02`
  - **Layer**: `Domain`
  - **Artifact**: `.agents/skills/prd-adr-pipeline/checks.mjs`
  - **Enforcement**: puro (sem rede/MCP/`exec`/escrita); sem termos da DENYLIST do installer
  - **Constraint Ref**: `ADR-P02`, `RF-02`
  - **Framework Detail**: ESM puro, `node:fs`/`node:path` read-only

- **[PAP-04]** [ ] Wiring do adaptador no `static-checks`
  - **Depends on**: `PAP-03`
  - **Layer**: `Integration`
  - **Artifact**: `scripts/static-checks.mjs`
  - **Enforcement**: `commands.suiteFull` inalterado; checks aparecem no relatório
  - **Constraint Ref**: `ADR-P02`, `RF-04`
  - **Framework Detail**: `import` + registro no mesmo formato do `sdd-checks`

- **[PAP-05]** [ ] Templates + conserto da ref órfã `ADR_TEMPLATE.md`
  - **Depends on**: `PAP-03`
  - **Layer**: `Domain`
  - **Artifact**: `.agents/skills/prd-adr-pipeline/templates/{PRD,RESEARCH,ADR-INDEX,ADR}.md`, `.agents/skills/sdd-architecture-board/templates/ADR_TEMPLATE.md`
  - **Enforcement**: `PRD.md` marcando as 7 seções obrigatórias (§4.4 da SPEC); `ADR.md` com `depende-de` e interface congelada
  - **Constraint Ref**: `RF-05`, `NFR-5`
  - **Framework Detail**: markdown puro

### Phase 2 – Governance

- **[PAP-06]** [ ] Regra descritiva `.agents/rules/prd-adr-pipeline.md` **(path protegido)**
  - **Depends on**: `PAP-03`, `PAP-05`
  - **Layer**: `Application`
  - **Artifact**: `.agents/rules/prd-adr-pipeline.md`
  - **Enforcement**: nenhum gate sem mecanismo citado; nível de garantia por afirmação; limiar de isenção e teto de 5 ADRs declarados
  - **Constraint Ref**: `RF-06`, `SPEC §4.4`, constraint 6 de `§12`
  - **Framework Detail**: markdown; exige trailer `Harness-Gate-Change`

- **[PAP-07]** [ ] Emendas: vocabulário V17 + layout/estado
  - **Depends on**: `PAP-06`
  - **Layer**: `Application`
  - **Artifact**: `.agents/rules/workflow-rules.md`, `.agents/rules/sdd-workflow-standard.md`
  - **Enforcement**: preservar marcadores `hasVocabTable` e `current_phase` canônico; `V4` ≤1705
  - **Constraint Ref**: `ADR-P05`, `RF-06`, `V17`, `NFR-2`
  - **Framework Detail**: markdown; exige trailer

### Phase 3 – Wiring de agentes e SSoT

- **[PAP-08]** [ ] Wiring nos 2 orquestradores
  - **Depends on**: `PAP-06`, `PAP-07`
  - **Layer**: `Interface`
  - **Artifact**: `.agents/agents/orchestrator/AGENT.md`, `.agents/agents/sdd-orquestrador/AGENT.md`
  - **Enforcement**: preservar cláusula de não-bypass + `gate-contract.md` (SDD-01) e `gates.P1_P2`/`gates.P2_P3` (SDD-03); operação de branch/PR sem `gh`
  - **Constraint Ref**: `RF-07`, `RF-09`, `SPEC §3`
  - **Framework Detail**: markdown; exige trailer

- **[PAP-09]** [ ] Conserto do drift de SSoT
  - **Depends on**: `PAP-08`
  - **Layer**: `Interface`
  - **Artifact**: `.agents/agents/product-manager/AGENT.md`, `.agents/agents/architect/AGENT.md`, `.agents/agents/code-reviewer/PROMPT.md`, `.agents/agents/qa-engineer/AGENT.md` (escopo corrigido no review do PAP-08/09)
  - **Enforcement**: zero referência viva a `GEMINI.md`/`docs/specs/`/`docs/adr/`
  - **Constraint Ref**: `RF-08`, `BR-12`
  - **Framework Detail**: markdown; exige trailer

### Phase 4 – Dogfood real + Fechamento

- **[PAP-11]** [ ] Dogfood: rodar a esteira sobre si mesma (`.spec/prd/prd-adr-pipeline/` real)
  - **Depends on**: `PAP-04`, `PAP-05`
  - **Layer**: `Integration`
  - **Artifact**: `.spec/prd/prd-adr-pipeline/{PRD.md,RESEARCH.md,ADR-INDEX.md}`, `.spec/prd/prd-adr-pipeline/ADRs/ADR-00N-{slug}/ADR.md` (5 dirs)
  - **Enforcement**: os 3 checks PASS sobre o artefato **real**; `prd-id == current_feature` (pior caso do guard); nenhum `SPEC.md`/`PLAN.md`/`TASKS.md` por ADR neste ciclo (ADR aqui é unidade **de decisão** dos 5 ADRs P01..P05 da SPEC, não ciclo SDD completo)
  - **Constraint Ref**: `INV-3`, `PROPOSAL §7` critério funcional #1, `SPEC §14.1`, achado O-1
  - **Framework Detail**: markdown; **deve rodar depois de `PAP-01`** (guard) ou o `SDD-02` acusa drift

- **[PAP-10]** [ ] README + verificação final do ciclo
  - **Depends on**: `PAP-09`, `PAP-11`
  - **Layer**: `Integration`
  - **Artifact**: `README.md`, `.spec/backend/prd-adr-pipeline/VERIFY.md`
  - **Enforcement**: `suiteFull` verde **com** `.spec/prd/**` materializado (não por ausência); `sdd-checks` 8/8; `git diff main` vazio para `gate.js` e `harness.config.json`; `R-NODENY` PASS
  - **Constraint Ref**: `SPEC §14`
  - **Framework Detail**: markdown + comandos do `harness.config.json`

- **[PAP-12]** [ ] Instrumentação do baseline SM-1..SM-7 + trava de discurso
  - **Depends on**: `PAP-10`
  - **Layer**: `Infrastructure`
  - **Artifact**: `workflow-state.json` (aditivo), `.spec/backend/prd-adr-pipeline/VERIFY.md`
  - **Enforcement**: congelar `baseline{suite, follow_ups, escalations, frozen_at}` no `VERIFY.md`; acrescentar `follow_ups[].created_at` e `prd_adr.snapshots[] = {adr, follow_ups_count, escalations_count, at}` (aditivo — `NFR-6` proíbe renomear/remover, não acrescentar); declarar **SM-1, SM-5, SM-7 como não falseáveis hoje** para não vender métrica falsa
  - **Constraint Ref**: `Q7`/`Q10` do parecer de negócio, `PROPOSAL §6` (linha "Causa errada"), `NFR-6`
  - **Framework Detail**: edição de JSON aditiva + markdown

---

## 9. Event Implementation Mapping (MANDATORY)

**N/A justificado**: a SPEC não define nenhum evento (`SPEC §6` — sem mensageria, sem outbox, sem broker, sem consumer). Não há ciclo de 4 tasks a gerar. Zero eventos ⇒ zero tasks de evento; nenhuma asserção do `plan-gate §3` é aplicável.

| Event Name | Producer Task ID | Outbox Task ID | Broker Task ID | Consumer Task ID |
|------------|------------------|----------------|----------------|------------------|
| _(nenhum — N/A)_ | — | — | — | — |

---

## 10. Execution Readiness Checklist

- [x] Todas as tasks têm dependência válida (sem ciclo). Caminho: `01→02→03→05→06→07→08→09→10→12`, com o ramo `03→04→11→10`.
- [x] Ciclo de 4 tasks por evento — **N/A justificado** (§9, SPEC §6).
- [x] Tasks de teste obrigatórias para as restrições críticas: `PAP-02` (fixtures PASS/FAIL por check) e `PAP-01` (regressão do verde-falso).
- [x] Tasks de infra base explicitamente definidas: `PAP-01` (guard) e `PAP-03` (núcleo puro).
- [x] Critical Execution Path mapeado ignorando documentação secundária (§7).
- [x] Sem tasks de frontend — **N/A** (§2.2).
