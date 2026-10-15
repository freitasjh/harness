# Change Proposal: Esteira PRD → ADR → SDD no harness

> **ID**: `prd-adr-pipeline`
> **Status**: `Under Review`
> **Author**: orchestrator (com pareceres de `architect` e `product-manager`)
> **Date**: 2026-10-15
> **Source**: demanda direta do owner + 2 pareceres independentes de Fase 1

---

## 1. Problem Statement

- **Contexto**: o harness governa o desenvolvimento com SDD (`EXPLORATION → PROPOSAL → SPEC → PLAN → TASKS → verify → archive`), portões humanos P0..P6 e harness de testes H1–H7. O artefato aprovado antes do código é o `SPEC.md` — escrito **para o compilador**, não para quem decide.
- **Impacto atual**: o owner aprova a fase por **confiança** em `SPEC.md`/`PLAN.md`/`TASKS.md` e descobre o que estava sendo construído no **merge/PR**, quando reprovar já custa branch aberta + SDD completo + código escrito. Não existe artefato de negócio aprovado antes do design.
- **Evidência**:
  - `grep -ric "prd" .agents/rules/*.md .agents/agents/*/AGENT.md` → **0 ocorrências** (o artefato não existe na esteira).
  - `workflow-state.json` `pending_actions`: seal não republicado, Brain MCP down, push pendente — trabalho já feito que não fechou.
  - Histórico de retrabalho: FU-01..FU-43; escalação **FU-32 com 4 iterações** de review num denylist; `overrides_history` com 1 override por limite de loop de correção.
  - Relato do owner, literal: *"fico muito sem contexto do que está sendo desenvolvido, fazendo com que passe coisas erradas e que acaba dando mais retrabalho"*.
- **Causa declarada (não presumida)**: ausência de intenção aprovada **antes** do design. O parecer de produto registra que a dor admite ≥3 causas e o desenho ataca 2 (intenção não vista; unidade de revisão grande) — a terceira (drift entre check/spec/código) **não** é atacada aqui e ganha métrica própria (SM-3) para ser medida, não presumida.

---

## 2. Proposed Solution

**Resumo**: inserir uma esteira de análise de engenharia **antes** do SDD — PRD aprovado pelo humano → pesquisa com fonte → decomposição em ADRs → **1 ADR = 1 branch = 1 PR → 1 ciclo SDD**, com checks de CI que provam o formato.

**Abordagem**:
1. **PRD** (`.spec/prd/{prd-id}/PRD.md`): 16 seções, cada uma com 1 pergunta fechada de validação e bloco de aprovação com veredito/data. É o artefato que o owner lê e aprova.
2. **RESEARCH.md**: ≥2 alternativas com fonte (URL/nome+versão) + trade-off + 1 recomendação. Tecnologia sem fonte não entra em ADR.
3. **ADR-INDEX.md + `ADRs/ADR-00N-{slug}/`**: cada ADR é unidade de trabalho independente (branch a partir de `main` atualizado após merge), com `ADR.md` + `SPEC.md` + `PLAN.md` + `TASKS.md` + `VERIFY.md`.
4. **Checks de CI** `PRD-01`/`ADR-01`/`ADR-02` dentro do `suiteFull` existente, cada um com fixture PASS e FAIL — **nenhum deny novo** em `gate.js`.
5. **Guard do resolver**: o bucket `prd` entra em `SPEC_NON_CYCLE` (`scripts/sdd-checks.mjs:146`), tirando a árvore PRD da detecção de ciclo SDD.
6. **Módulo de checks no path propagável** (`.agents/skills/prd-adr-pipeline/checks.mjs`) — `scripts/` **não** propaga pelo installer (`INCOMING_ROOTS`, `installer/install.mjs:1159`), então check em `scripts/` viraria gate órfão no repo-destino.

**Alternativas descartadas**:
- **Deny de runtime para PRD/ADR** — quebraria `R-NODENY` (`sdd-checks.mjs:400-404`) e a decisão #2 do owner.
- **Todo ADR como ciclo SDD completo (com `PROPOSAL.md`)** — obriga artefato de "proposta" para uma decisão já tomada; ADR vira feature. Descartado pelo owner (Q1).
- **Ensinar o resolver a reconhecer o layout ADR de 2 níveis** — mais superfície de detecção, exatamente a família de bug FU-38/MF-1/FU-39/FU-40.
- **Automação de PR via `gh`** — `gh` não está instalado (verificado). Fallback: `git push` + URL de compare impressa (Q2).

---

## 3. Scope

### In Scope
- [ ] `PRD.md`, `RESEARCH.md`, `ADR-INDEX.md` e templates (`ADR.md`, `ADR-INDEX.md`, `PRD.md`, `RESEARCH.md`).
- [ ] Skill `prd-adr-pipeline` (playbook + módulo de checks puro e propagável).
- [ ] Regra descritiva da esteira + emenda de layout em `sdd-workflow-standard.md`.
- [ ] Checks `PRD-01`/`ADR-01`/`ADR-02` com fixtures PASS/FAIL, entrando pelo `suiteFull` existente.
- [ ] Guard do resolver: `prd` em `SPEC_NON_CYCLE` + teste de regressão.
- [ ] Wiring nos dois orquestradores (`orchestrator`, `sdd-orquestrador`) + linhas de vocabulário V17.
- [ ] Conserto do drift de documentos: `GEMINI.md`, `docs/specs/`, `docs/adr/` referenciados e inexistentes em 4 AGENT.md/PROMPT.md.
- [ ] Template `ADR_TEMPLATE.md` do `sdd-architecture-board` (referenciado em `SKILL.md:36`, **ausente**).
- [ ] Operação de branch/PR por ADR sem `gh` (`git push` + URL de compare).

### Out of Scope
- **Dogfood em projeto externo (ECM)** — decisão do owner; a validação é neste repo.
- **`gate.js`** — nenhum deny novo (decisão #2; protegido por `R-NODENY`).
- **`commands.suiteFull`** em `harness.config.json` — alterar muda o selo e o contraprova.
- **PRD/ADR para bug** — bug mantém o fluxo B1-B4 (decisão #4).
- **Propagação de `scripts/` e `.github/` pelo installer** — fora deste ciclo (F3, cortável); declarar 🟡 processo no destino.
- **Republicar o seal / restaurar o Brain MCP** — abertos herdados, aceitos como declarados.
- **Nova chave em `moduleMap`/`generateConfig`** do installer — quebra golden test.

---

## 4. Architecture Impact

Aplicabilidade adaptada: o harness é governança Node ESM, não aplicação de negócio. Aspectos sem correspondência são marcados **N/A explícito** (exigência do `proposal-gate.md §3`).

| Aspecto | Impacto | ADR Necessário? |
|---------|---------|-----------------|
| Regras (`.agents/rules/**`) — **protegido** | novo arquivo de regra + emenda em `workflow-rules.md` e `sdd-workflow-standard.md`; consome budget V4 (974/1705) | Sim — ADR-P01/P05 |
| Agentes (`.agents/agents/**`) — **protegido** | wiring nos 2 orquestradores; conservar cláusula de não-bypass (SDD-01) e `gates.P1_P2`/`P2_P3` (SDD-03) | Sim — ADR-P05 |
| Skills (`.agents/skills/**`) — **não protegido** | skill nova + templates + módulo de checks; **é o único canal que propaga** para repo-destino | Sim — ADR-P02/P03 |
| Checks (`scripts/`) — **não protegido** | `sdd-checks.mjs:146` (`SPEC_NON_CYCLE += "prd"`) + wiring dos checks no `static-checks` | Sim — ADR-P03 |
| Installer (`installer/`) | **sem mudança neste ciclo**; `INCOMING_ROOTS` não inclui `scripts/`/`.github/` — limitante registrado | Não (F3) |
| Banco de dados / migrations | **N/A** — o harness não tem banco | Não |
| Multi-tenancy | **N/A** — o harness não é multi-tenant | Não |
| Segurança / RBAC | **impacto parcial**: `gate.js:487-516` não escopa escrita de `product-manager`/`architect` (achado D11). Registrado como 🟡, não corrigido aqui (`gate.js` é out of scope) | Não (registrado) |
| Eventos (Kafka/async) | **N/A** — sem mensageria | Não |

---

## 5. Delta Preview

| Documento Alvo | Tipo de Mudança | Seção Afetada |
|----------------|-----------------|---------------|
| `.agents/rules/prd-adr-pipeline.md` | ADDED | arquivo novo (regra descritiva) |
| `.agents/rules/workflow-rules.md` | ADDED | nova subseção da esteira em §3 + linha na tabela V17 |
| `.agents/rules/sdd-workflow-standard.md` | MODIFIED | §1 Organização de Arquivos (layout `.spec/prd/**`) e §2 (campos de estado) |
| `.agents/agents/orchestrator/AGENT.md` | MODIFIED | fases da esteira + operação de branch/PR |
| `.agents/agents/sdd-orquestrador/AGENT.md` | MODIFIED | idem, preservando não-bypass (SDD-01) e `gates.P1_P2`/`P2_P3` (SDD-03) |
| `.agents/agents/product-manager/AGENT.md` | MODIFIED | SSoT de saída: `docs/specs/`/`docs/product/` → `.spec/prd/**` |
| `.agents/agents/architect/AGENT.md` | MODIFIED | SSoT de saída: `docs/adr/` → `.spec/prd/**`; modo ADR |
| `.agents/agents/code-reviewer/PROMPT.md` | MODIFIED | ponteiro de `docs/specs/*.md` → `.spec/prd/**` |
| `.agents/skills/sdd-architecture-board/SKILL.md` | MODIFIED | saída ADR → `.spec/prd/**`; `templates/ADR_TEMPLATE.md` |
| `spec-developed.md` | MODIFIED | registro do ciclo ao arquivar |
| `README.md` | MODIFIED | linha na tabela de funcionalidades |

---

## 6. Risk Assessment

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Verde-falso / vermelho na suíte** pelo bucket `prd` (`sdd-checks.mjs:146,286-298`) | Alta | Alto | Guard do resolver (`SPEC_NON_CYCLE += "prd"`) + teste de regressão **antes** de materializar `.spec/prd/**` |
| **Gate órfão propagado**: check só em `scripts/` não chega ao destino | Alta | Alto | Módulo de checks em `.agents/skills/**` (propaga) + declarar 🟡 processo no destino |
| **`prev-cycle-not-completed`** na delegação (âncora B) | Alta | Alto | `current_feature` único para toda a feature e literal obrigatório em todo prompt de `task` |
| **Cerimônia vira a nova dor** (PRD para tudo) | Média | Alto | Limiar de isenção declarado + PRD ≤120 linhas + nenhum gate de runtime |
| **Estouro do budget V4** (974/1705) | Média | Médio | Regra enxuta; detalhe nos templates da skill, não na regra |
| **Checks virarem corrida adversarial** (padrão FU-32, 4 iterações) | Média | Médio | Checks estruturais e determinísticos: presença/campo/orfandade. Sem denylist, sem varredura semântica |
| **"Independência" dos ADRs é aspiração** | Média | Médio | Todo `ADR.md` declara `depende-de` + interface congelada; o check `ADR-01` valida o campo |
| **Trailer `Harness-Gate-Change` em cada PR de path protegido** | Alta | Baixo | Declarado no checklist do PR (`.githooks/pre-commit`, `harness-integrity.yml`) |
| **`gh` ausente** quebra US de PR automatizado | Alta | Baixo | Fallback aprovado: `git push` + URL de compare impressa |
| **SSoT triplo** (`docs/specs`/`docs/adr`/`.spec/prd`) | Média | Médio | Conserto dos ponteiros no mesmo ciclo + grep de paths mortos |
| **Causa errada**: retrabalho vem de drift, não de intenção | Média | Alto | Baseline antes de F1 + SM-3 mede retrabalho pós-merge por ADR; se não cair em 3 ADRs, pivotar com dado |

---

## 7. Success Criteria

Critérios verificáveis (binário). Redigidos como **asserção**, não como atividade — corrige o defeito D1 do parecer de produto.

- [ ] **Funcional (owner)**: dado um pedido novo classificado como *Feature*, existe `.spec/prd/<prd-id>/PRD.md` com o bloco de aprovação preenchido (veredito + data) **antes** de existir qualquer `ADRs/**` ou branch de trabalho.
- [ ] **Funcional (owner)**: o PRD é legível sem ler código — cada seção tem pergunta fechada de validação e a §7 ("NÃO entra") é obrigatória e não-vazia.
- [ ] **Técnico**: `PRD-01` falha quando falta seção obrigatória, quando §7 está vazia, ou quando o bloco de aprovação não tem os 3 campos.
- [ ] **Técnico**: `ADR-01` falha quando há dir órfão em `ADRs/`, id duplicado entre `ADR-INDEX.md` e disco, ou `ADR.md` sem `depende-de`.
- [ ] **Técnico**: `ADR-02` falha quando há ≥2 ADRs `in-progress` ou quando o merge do anterior não está registrado.
- [ ] **Técnico**: cada um dos 3 checks tem ≥1 fixture que PASSA e ≥1 que FALHA, exercitada por teste unitário.
- [ ] **Técnico**: `commands.suiteFull` do `harness.config.json` verde — `node --test` (plugins) + `node --test` (installer) + `static-checks` + `vendor-check` — **com** o bucket `prd` presente em disco. Nota de precisão: `sdd-checks` **não** faz parte do `suiteFull`; é executado no CI (`harness-integrity.yml`) e é comando de aceite **separado** (`node scripts/sdd-checks.mjs`).
- [ ] **Qualidade**: com `.spec/prd/**` materializado, `SDD-02` continua apontando o ciclo SDD correto (nenhum verde-falso).
- [ ] **Qualidade**: caminho executável de branch/PR documentado e validado por **dry-run local** (`git push --dry-run` + URL de compare montada), sem push real.
- [ ] **Regressão**: ciclos SDD existentes inalterados; `V4`, `V17`, `SDD-01/02/03`, `R-NODENY`, `RENAME-01` continuam PASS.

---

## 8. Completion Metadata

- **Archived on**: —
- **Duration**: —
- **Archive path**: —
- **Files changed**: —

---

## Constraints (máx. 10, referenciadas nesta fase)

1. Sempre: `gate.js` intocado — zero `DenyError`, zero `registerCoreGate`, zero literal `DENY_SDD`/`DENY_ARTIFACT`/`artifact-gate`.
2. Sempre: `commands.suiteFull` inalterado (selo + contraprova dependem dele); checks novos entram pelo `static-checks` já invocado.
3. Sempre: todo check novo tem fixture PASS e FAIL coberta por teste.
4. Sempre: módulo de checks no path propagável (`.agents/skills/**`); `scripts/` apenas importa.
5. Sempre: bucket `prd` marcado como **non-cycle** no resolver, com teste de regressão.
6. Nunca: adicionar chave a `moduleMap`/`generateConfig` do installer (quebra golden test).
7. Nunca: renomear ou deprecar campos existentes de `workflow-state.json` (`gate.js:705-743` lê `current_phase`/`current_feature`/`harness_status`/`code_review_status`).
8. Nunca: introduzir valor novo de `current_phase` — fases da esteira são rótulos mapeados para `Discovery`/`Planning`.
9. Nunca: fazer bug passar por PRD/ADR (decisão #4) nem exigir PRD para mudança abaixo do limiar.
10. Nunca: afirmar garantia sem citar mecanismo — nível (runtime/CI/processo/aberto) sempre explícito.
