# Implementation Plan: harness-brain-separation

## 1. Context & SPEC Traceability
- **Target Specification**: `.spec/backend/harness-brain-separation/SPEC.md` (426 linhas, PASS 16/16)
- **Goal**: Translate SPEC docs-only em plano executável determinístico, risk-aware. Zero código produto nesta fase — só `.spec` docs. Execução real em TASKS/Execution com portão próprio.
- **Continuação**: `harness-installer-mobile` Completed, archive `.spec/archive/20261008-harness-installer-mobile/` intocado. `workflow-state.json` (`current_feature: harness-installer-mobile`, `current_phase: Completed`) só atualizado em fase própria. Novo ciclo em `.spec/backend/harness-brain-separation/` separado — âncora B preservada.

### 1.1 SPEC Validation Report
- **Status**: Validated with Warnings (spec-review APROVADA COM RESSALVAS + security-review PASS)
- **Identified Gaps/Warnings**:
  - 🟡001 Delta count 14→13: SPEC §11 declara "14 MODIFIED + 1 ADDED + 1 REMOVED" mas contagem real = 13 MODIFIED (vendored 1 REMOVED + 12 MODIFIED + 1 ADDED externo). Fix nesta PLAN Fase 3.
  - 🟡002 range `brain-context.md:16-47` → `16-132`: bloco Tools MCP real vai até `:132` (4 tools + `brain_reindex`), não `:47`. Evidência: `sed -n '16,50p' .agents/rules/brain-context.md` mostra `brain_store` em `:49`, `brain_read` em `:88`, `brain_reindex` em `:108`. Fix Fase 0.
  - 🟡003 G0.2 2 passos: guarda G0.2 citava 1 grep mas exige 2 passos (Out-of-Scope presente + B1-B3/frontend só lá). Fix Fase 3.
  - 🟡004 canônico TODO: RUNTIME-CONTRACT canônico não localizado; SPEC usa espelho archive `.spec/archive/20260929-harness-v7-hardening/RUNTIME-CONTRACT.md:68` + TODO PLAN-localizar (= P2-01). Resolve Fase 0.
  - 🟡G1 (security): pin integridade ref externa — `../brain/.agents/skills/brain/SKILL.md` sem hash/commit pin. Endurecimento Fase 2 (ponte cita ref + commit esperado + fallback).
  - 🟡G2 (security): fallback URL pinada — fallback doc citava "URL/canônico" sem URL pinada. Endurecimento Fase 1 (URL + caminho + warn).
  - 🟢G3 canônico TODO = P2-01 (mesmo que 🟡004, lado security).
  - P2-02 scrub: `brain/knowledge/` + `mcp_ObsidianBrain_*` hardcoded em `codebase-analyzer/AGENT.md:45-68` exigem scrub sem path hardcoded residual. Fase 3.
- **Assumptions Made**: nenhuma — todos os gaps viram tasks explícitas abaixo. Nenhum default preenchido; dono doctor confirmado por leitura (`installer/install.mjs:743-772` `runDoctor` D0-D6 + dispatch `1797-1810` + `installer/__tests__/doctor.spec.mjs:97` 0-writes). `README.md:18` na SPEC = contagem com header (linha física 18 = `| 8 | Memória persistente...`); PLAN usa linha física + conteúdo para não reintroduzir off-by-N.

## 2. Technical Strategy
### 2.1 Backend Strategy
- **Framework**: N/A — docs-only governança, zero `.java`/runtime.
- **Architectural Pattern**: decreto ownership (ADR-001 separation) — referência nunca cópia.

### 2.2 Frontend Strategy
- **Framework**: N/A — frontend fora de escopo (RF-G0.2). Nenhuma task FE neste PLAN.

### 2.3 Infrastructure Strategy
- **Deployment Model**: N/A — sem deploy. Artefatos só em `.spec/backend/harness-brain-separation/`.
- **CI/CD**: suiteFull `harness.config.json` (`node --test ".opencode/plugins/__tests__/*.spec.mjs" && node scripts/static-checks.mjs`) verde antes/depois de cada fase que toca doc lido por check (V3 literais). `installer/__tests__/doctor.spec.mjs` âncora 0-writes nunca quebrada.

## 3. Architecture Realization & Constraint Mapping
| SPEC Reference | Constraint | Enforcement Point | Failure Mode | Implementation Strategy |
|---|---|---|---|---|
| ADR-001 separation | fonte única (dono brain) | `.agents/skills/brain/` + ponte | drift duplo / verdade paralela | REMOVED vendored → ref `../brain/.agents/skills/brain/SKILL.md` + fallback doc (Fase 1) |
| ADR-002 bridge | ponte fina ≤30 linhas, nunca re-explica | `.agents/rules/brain-context.md:1-259` | re-expansão / cópia residual | corpo → ponte ~20 linhas + G1 pin integridade (Fase 2) |
| ADR-003 installer-zero-brain | doctor read-only D0-D6, warn-não-fail | `installer/install.mjs:743-772` + dispatch `:1797-1810` | write no target / fail bloqueante sem brain | prescrever 0-writes + veredito `next` motivo+caminho (Fase 4) |
| ADR-004 evidence | nomes + `brainStore` byte-a-byte | `.agents/schemas/harness-report.schema.json:16,57` + `README.md:18` + RUNTIME-CONTRACT `:68` | rename quebra gates/evidência | proibição rename + grep guarda (Fase 5) |
| RF-G0.1 | zero código produto nesta fase | `git status` | edição produto acidental | guarda por fase: só `.spec/backend/harness-brain-separation/` |
| RF-G0.2 | B1-B3/frontend ausentes como trabalho | Out-of-Scope | scope creep | 2-passos: seção presente + termos só lá |
| 🟡G1 pin | ref externa sem integridade | ponte | checkout brain divergente silencioso | ponte cita ref + commit/hash esperado + doctor warn (Fase 2) |
| 🟡G2 fallback | destino sem checkout brain | ponte + installer | ref dangling = instrução morta | fallback URL pinada + caminho canônico + warn-não-fail (Fase 1) |
| P2-02 scrub | sem path hardcoded alheio | `codebase-analyzer/AGENT.md:45-68` | `brain/knowledge/` residual | scrub total + grep vazio (Fase 3) |

## 4. Module & Code Structure
| Module Name | Responsibilities | Boundaries & Communication |
|---|---|---|
| `.spec/backend/harness-brain-separation/` | único módulo de escrita (PROPOSAL/SPEC/PLAN/TASKS) | nunca escreve fora; produto só lido via grep/`sed -n` |
| `.agents/skills/brain/` (alvo REMOVED) | só leitura de inventário nesta fase | execução da remoção em TASKS/Execution |
| `.agents/rules/brain-context.md` (alvo ponte) | só leitura das 259 linhas + mapeamento §8 | reescrita em Execution |
| `installer/install.mjs` (alvo futuro) | só leitura `743-772` + `1797-1810` | nenhum write; teste âncora `doctor.spec.mjs:97` |
| `BRAIN.MCP.md` (externo, dono brain) | citado, nunca copiado | dependência externa ADDED |

## 5. Risks & Complexity Analysis
- **🔥 CRITICAL RISK: ref dangling em destino sem checkout brain (R1 PROPOSAL)**
  - **Mitigation**: fallback doc com URL pinada + caminho canônico (G2, Fase 1) + doctor warn-não-fail com motivo+caminho.
- **🟠 HIGH RISK: stale residual `brain-context-protocol.md` (9 pontos)**
  - **Mitigation**: grep 2-passos por fase (Fase 3 guarda final `grep -rn` vazio em `.agents/`).
- **🟠 HIGH RISK: ponte re-expande / cópia residual**
  - **Mitigation**: invariante `ponte_fina_max_30_linhas` (`wc -l` ≤ 30) + diff contra `BRAIN.MCP.md` na verificação.
- **🟡 MEDIUM RISK: warn mascara brain quebrado**
  - **Mitigation**: warn carrega motivo+caminho (`1797-1810` dispatch); `brainStore` segue obrigatório no report (só doctor não-falha).
- **🟡 MEDIUM RISK: âncora B `harness-installer-mobile`**
  - **Mitigation**: `git status --porcelain` guarda por fase — só `.spec/backend/harness-brain-separation/`.

## 6. Implementation Phases & Dependencies
### Phase 0: Localizar canônico + confirmar donos (fix 🟡002 + P2-01/G3)
- **Dependencies**: None.
- **Scope**: localizar RUNTIME-CONTRACT canônico (se não localizado: declarar archive como espelho + TODO explícito); confirmar dono doctor `runDoctor:743-772` + dispatch `:1797-1810` + `doctor.spec.mjs:97`; corrigir range `16-47`→`16-132`; confirmar `README.md:18` físico vs lógico.
- **Restrições**: só leitura; nenhum write fora `.spec/backend/harness-brain-separation/`.
- **Modos falha**: canônico inexistente (→ fallback espelho + TODO); dispatch deslocado por edição paralela (→ re-grep `runDoctor|doctor` + reportar drift).
- **Verificação**:
  ```
  find . -maxdepth 3 -name "RUNTIME-CONTRACT.md" | head
  grep -n "runDoctor" installer/install.mjs | head
  sed -n '743,772p' installer/install.mjs | head -n 5
  sed -n '1797,1810p' installer/install.mjs | head -n 14
  sed -n '85,115p' installer/__tests__/doctor.spec.mjs
  grep -n "^#\|^##\|^###" .agents/rules/brain-context.md | sed -n '1,20p'
  ```

### Phase 1: H1 vendored → ref externa + fallback dangling (endurece G2)
- **Dependencies**: Phase 0 (canônico conhecido → fallback cita alvo certo).
- **Scope**: prescrever REMOVED `.agents/skills/brain/SKILL.md` + 4 tools → ref `../brain/.agents/skills/brain/SKILL.md`; fallback doc com URL pinada + caminho canônico + doctor warn.
- **Restrições**: ponte cita ref literal; fallback nunca grava regra alheia.
- **Modos falha**: destino sem checkout brain (→ fallback ativa); ref com path errado (→ grep âncora `../brain/.agents/skills/brain/SKILL.md` ≥ 1 na ponte).
- **Verificação**:
  ```
  ls -R .agents/skills/brain | grep -c "brain_"
  test ! -d .agents/skills/brain && echo REMOVED_OK || echo STILL_PRESENT
  grep -c "\.\./brain/.agents/skills/brain/SKILL.md" .agents/rules/brain-context.md
  ```

### Phase 2: H2 ponte fina ~20 linhas (endurece G1)
- **Dependencies**: Phase 1 (ref + fallback definidos).
- **Scope**: corpo `:1-259` → ponte ≤30 linhas (alvo ~20) com dono, link, 3 tools literais, `brainStore`, fluxo 1-linha, fallback; cobertura 100% tabela SPEC §8.1.
- **Restrições**: nomes `brain_search`/`brain_store`/`brain_read` literais; nunca re-explicar sintaxe.
- **Modos falha**: ponte >30 linhas (→ cortar, detalhe vive no dono); seção sem destino (→ completar tabela §8.1, 12 linhas mapeamento).
- **Verificação**:
  ```
  wc -l < .agents/rules/brain-context.md
  grep -c "BRAIN.MCP.md" .agents/rules/brain-context.md
  grep -c "brain_search\|brain_store\|brain_read" .agents/rules/brain-context.md
  grep -c "brainStore" .agents/schemas/harness-report.schema.json
  ```

### Phase 3: H3 refs 7+2 + fixes 🟡001/003 + P2-02 scrub
- **Dependencies**: Phase 2 (ponte existe → refs apontam para ela).
- **Scope**: 7 refs `brain-context-protocol.md` (`workflow-rules.md:245,588`; `architect/AGENT.md:5`; `qa-engineer/AGENT.md:5`; `code-reviewer/PROMPT.md:5`; `ux-designer/AGENT.md:10`; `product-manager/AGENT.md:5`) + 2 extras (`codebase-analyzer/AGENT.md:45-68` scrub total; `sdd-workflow-standard.md:45` reescrita); fix Delta 14→13 MODIFIED; fix G0.2 2-passos.
- **Restrições**: cada arquivo com Delta MODIFIED próprio; scrub sem `brain/knowledge/`/`mcp_ObsidianBrain_*` residual.
- **Modos falha**: stale residual (→ grep final deve ser vazio); scrub parcial (→ segundo grep em `codebase-analyzer/`).
- **Verificação**:
  ```
  grep -rn "brain-context-protocol.md" .agents/ || echo ZERO_STALE_OK
  grep -rn "mcp_ObsidianBrain_\|brain/knowledge/" .agents/agents/codebase-analyzer/ || echo SCRUB_OK
  grep -n "Obsidian" .agents/rules/sdd-workflow-standard.md || echo SDD_OK
  ```

### Phase 4: H4 installer 0-writes + warn-não-fail
- **Dependencies**: Phase 0 (dono confirmado).
- **Scope**: prescrever `runDoctor` D0-D6 read-only + dispatch `1797-1810` `--dry-run/--yes` sem efeito + warn-não-fail (veredito + `next` motivo+caminho); âncora `doctor.spec.mjs:97`.
- **Restrições**: NENHUM write `installer/install.mjs` nesta fase; teste âncora nunca quebrado.
- **Modos falha**: write acidental (→ `git status` acusa; reverter); warn sem motivo (→ exigir motivo+caminho no veredito).
- **Verificação**:
  ```
  node --test installer/__tests__/doctor.spec.mjs 2>&1 | tail -n 5
  grep -c "1797-1810\|743-772" .spec/backend/harness-brain-separation/SPEC.md
  git status --porcelain | grep -v ".spec/backend/harness-brain-separation/" | grep -v "^??" || echo ZERO_PROD_OK
  ```

### Phase 5: H5 fronteira README + RUNTIME-CONTRACT, nomes + `brainStore`
- **Dependencies**: Phase 0 (canônico/espelho) + Phase 2 (ponte).
- **Scope**: Delta `README.md:18` (linha física `| 8 | Memória persistente...`) + RUNTIME-CONTRACT `:68` declaram fronteira; proibição rename tools/`brainStore`.
- **Restrições**: texto fronteira sem renomear contrato; `harness-report.schema.json:16,57` intacto.
- **Modos falha**: rename acidental (→ grep guarda nomes); linha README deslocada (→ citar por conteúdo + linha física).
- **Verificação**:
  ```
  grep -c "brainStore" .agents/schemas/harness-report.schema.json
  grep -n "Memória persistente" README.md
  grep -n "brain" .spec/archive/20260929-harness-v7-hardening/RUNTIME-CONTRACT.md | head
  ```

### Phase 6: Verificação final + plan-gate
- **Dependencies**: Phases 0-5.
- **Scope**: suiteFull verde + greps guarda G0.1/G0.2 + `git status` só `.spec/` + plan-gate self-check §10.
- **Restrições**: nenhum `.java/.ts/.vue/.sql` tocado; archive `20261008-harness-installer-mobile` intocado.
- **Modos falha**: suite RED (→ root-cause antes de TASKS); `git status` com produto (→ reverter e re-verificar).
- **Verificação**:
  ```
  node --test ".opencode/plugins/__tests__/*.spec.mjs" 2>&1 | tail -n 3 && node scripts/static-checks.mjs 2>&1 | tail -n 3
  git status --porcelain | grep -v "^??" | grep -v ".spec/backend/harness-brain-separation/" || echo ZERO_PROD_OK
  test ! -d .spec/archive/20261008-harness-installer-mobile-bis && echo ARCHIVE_INTACT
  ```

## 7. Critical Execution Path
*Minimum sequence para o MVP docs-only (ignora endurecimentos secundários).*
- `PL-00` (localizar canônico + donos) → `PL-10` (REMOVED vendored → ref) → `PL-20` (ponte fina) → `PL-30` (7+2 refs) → `PL-50` (fronteira + nomes) → `PL-60` (guarda final)

## 8. Atomic Task Breakdown & Execution Graph
*Tasks ordenadas. Cada task com ID + dependências explícitas. Camada `Docs` (docs-only). Nenhuma task FE/B1-B3.*

### Docs Tasks Phase 0 — localizar + confirmar
- **[PL-00]** [ ] Localizar RUNTIME-CONTRACT canônico; se ausente declarar espelho + TODO P2-01/G3
  - **Depends on**: None
  - **Layer**: Docs
  - **Artifact**: `PLAN.md §6 Phase 0` + evidência `find`
  - **Enforcement**: sem canônico não se declara fronteira final
  - **Constraint Ref**: ADR-004 + P2-01/G3
  - **Framework Detail**: `find` + `grep -n brain RUNTIME-CONTRACT`
- **[PL-01]** [ ] Confirmar dono doctor (`runDoctor:743-772` + dispatch `:1797-1810` + `doctor.spec.mjs:97`) via leitura
  - **Depends on**: None
  - **Layer**: Docs
  - **Artifact**: confirmação caminho:linha no PLAN
  - **Enforcement**: dono deslocado → reportar drift, não adivinhar
  - **Constraint Ref**: ADR-003
  - **Framework Detail**: `sed -n` + `grep -n runDoctor`
- **[PL-02]** [ ] Fix 🟡002: corrigir range `16-47`→`16-132` no mapeamento H2
  - **Depends on**: PL-00
  - **Layer**: Docs
  - **Artifact**: TASKS H2 com range correto
  - **Enforcement**: `grep -n` prova `brain_store:49`, `brain_read:88`, `brain_reindex:108`
  - **Constraint Ref**: RF-H2.1/RF-H2.2
  - **Framework Detail**: `grep -n "^#\|^##\|^###" .agents/rules/brain-context.md`

### Docs Tasks Phase 1 — H1 (RF-H1.1/H1.2 + G2)
- **[PL-10]** [ ] Prescrever REMOVED vendored (SKILL.md + 4 tools) → ref externa
  - **Depends on**: PL-00
  - **Layer**: Docs
  - **Artifact**: TASKS H1 + Delta REMOVED
  - **Enforcement**: `ls -R .agents/skills/brain | grep -c brain_` == 4 (pré)
  - **Constraint Ref**: ADR-001, RF-H1.1
  - **Framework Detail**: `ls` + `test -d`
- **[PL-11]** [ ] Prescrever fallback dangling com URL pinada + caminho canônico + doctor warn (endurece G2)
  - **Depends on**: PL-10
  - **Layer**: Docs
  - **Artifact**: bloco fallback na ponte (Delta)
  - **Enforcement**: destino sem checkout brain segue instruído
  - **Constraint Ref**: ADR-001 trade-off, RF-H1.2
  - **Framework Detail**: doc-link, sem código

### Docs Tasks Phase 2 — H2 (RF-H2.1/H2.2 + G1)
- **[PL-20]** [ ] Prescrever ponte ≤30 linhas com dono/link/3 tools/`brainStore`/fluxo/fallback
  - **Depends on**: PL-11
  - **Layer**: Docs
  - **Artifact**: bloco ponte Delta `.agents/rules/brain-context.md`
  - **Enforcement**: `wc -l` ≤ 30; nomes literais
  - **Constraint Ref**: ADR-002, RF-H2.1
  - **Framework Detail**: `wc -l` + `grep -c`
- **[PL-21]** [ ] Pin integridade ref (endurece G1): ref + commit/hash esperado + doctor warn em divergência
  - **Depends on**: PL-20
  - **Layer**: Docs
  - **Artifact**: linha pin na ponte + task verificação
  - **Enforcement**: checkout divergente = warn explícito, nunca silent
  - **Constraint Ref**: 🟡G1
  - **Framework Detail**: doc-pin, sem fetch nesta fase

### Docs Tasks Phase 3 — H3 (RF-H3.1/H3.2 + 🟡001/003 + P2-02)
- **[PL-30]** [ ] Prescrever 7 refs `brain-context-protocol.md` → ponte/`BRAIN.MCP.md`
  - **Depends on**: PL-20
  - **Layer**: Docs
  - **Artifact**: 7 Deltas MODIFIED (`workflow-rules.md:245,588`; 5 agent files)
  - **Enforcement**: `grep -rn brain-context-protocol.md .agents/` == 7 (pré) → vazio (pós-Execution)
  - **Constraint Ref**: RF-H3.1
  - **Framework Detail**: `grep -rn`
- **[PL-31]** [ ] Prescrever 2 extras + scrub P2-02 (`codebase-analyzer:45-68`; `sdd-workflow-standard.md:45`)
  - **Depends on**: PL-30
  - **Layer**: Docs
  - **Artifact**: 2 Deltas MODIFIED com scrub total
  - **Enforcement**: `grep -rn "mcp_ObsidianBrain_\|brain/knowledge/"` vazio pós
  - **Constraint Ref**: RF-H3.2 + P2-02
  - **Framework Detail**: `grep -rn`
- **[PL-32]** [ ] Fix 🟡001 Delta 14→13 + 🟡003 G0.2 2-passos
  - **Depends on**: PL-30
  - **Layer**: Docs
  - **Artifact**: Resumo Impacto corrigido (13 MODIFIED) + guarda G0.2 em 2 passos
  - **Enforcement**: contagem Delta == arquivos reais; G0.2 = seção Out-of-Scope presente + termos só lá
  - **Constraint Ref**: RF-G0.2
  - **Framework Detail**: `grep -ci "B1-B3\|frontend"` + inspeção seção

### Docs Tasks Phase 4 — H4 (RF-H4.1/H4.2)
- **[PL-40]** [ ] Prescrever doctor 0-writes D0-D6 + dispatch sem efeito `--dry-run/--yes` + âncora teste `:97`
  - **Depends on**: PL-01
  - **Layer**: Docs
  - **Artifact**: Delta `installer/install.mjs` (futuro, não esta fase)
  - **Enforcement**: `node --test installer/__tests__/doctor.spec.mjs` verde (caso 0 writes PASS)
  - **Constraint Ref**: ADR-003, RF-H4.1
  - **Framework Detail**: `node --test` + `String(runDoctor)` audit
- **[PL-41]** [ ] Prescrever warn-não-fail (veredito + `next` motivo+caminho, sem FAIL bloqueante)
  - **Depends on**: PL-40
  - **Layer**: Docs
  - **Artifact**: invariante §7.2 + Delta installer
  - **Enforcement**: `grep -c "warn-não-fail"` ≥ 3 na SPEC (já); TASKS exige motivo+caminho
  - **Constraint Ref**: RF-H4.2
  - **Framework Detail**: doc-only

### Docs Tasks Phase 5 — H5 (RF-H5.1/H5.2)
- **[PL-50]** [ ] Prescrever fronteira `README.md:18` + RUNTIME-CONTRACT `:68`, nomes + `brainStore` intactos
  - **Depends on**: PL-00, PL-20
  - **Layer**: Docs
  - **Artifact**: 2 Deltas MODIFIED + proibição rename
  - **Enforcement**: `grep -c brainStore schema` ≥ 2; nomes literais na ponte
  - **Constraint Ref**: ADR-004, RF-H5.1/H5.2
  - **Framework Detail**: `grep -c` + `grep -n`

### Docs Tasks Phase 6 — guarda final
- **[PL-60]** [ ] Guarda G0.1/G0.2 + suiteFull verde + `git status` só `.spec/`
  - **Depends on**: PL-32, PL-41, PL-50
  - **Layer**: Docs
  - **Artifact**: VERIFY pré-TASKS (portão)
  - **Enforcement**: `git status --porcelain | grep -v ".spec/backend/harness-brain-separation/"` vazio; suiteFull verde
  - **Constraint Ref**: RF-G0.1/G0.2
  - **Framework Detail**: `git status` + suiteFull `harness.config.json`

## 9. Event Implementation Mapping (MANDATORY)
*N/A justificado — sem eventos na SPEC (§6: sem tópicos/filas/outbox/producer/consumer). Integração única = referência doc `../brain/.agents/skills/brain/SKILL.md` (link). Nenhuma das 4 tasks por evento aplicável.*

| Event Name | Producer Task ID | Outbox Task ID | Broker Task ID | Consumer Task ID |
|---|---|---|---|---|
| N/A (docs-only, SPEC §6) | N/A justificado | N/A justificado | N/A justificado | N/A justificado |

## 10. Execution Readiness Checklist
- [ ] All tasks have valid dependencies (no circular references). — grafo PL-00→PL-60 acíclico acima.
- [ ] All SPEC events generated the 4 mandatory tasks. — N/A justificado (§9, SPEC §6 sem eventos).
- [ ] Mandatory testing tasks created for critical constraints. — PL-40 (`doctor.spec.mjs:97` 0-writes) + PL-60 (suiteFull `harness.config.json`); multi-tenancy N/A (SPEC §2 sem DB).
- [ ] Base Infra tasks explicitly defined. — docs-only: infra = Phase 0 (canônico + donos) precede domínio (Phases 1-5).
- [ ] Critical Execution Path maps only the core flow. — §7: PL-00→PL-10→PL-20→PL-30→PL-50→PL-60.

### plan-gate self-check (asserts/plan-gate.md)
| # | Item | Veredito |
|---|---|---|
| §1 | Traceability 1:1 | PASS — RF-H1..H5 + G0 → PL-10..PL-60 (tabela: H1→PL-10/11, H2→PL-20/21, H3→PL-30/31/32, H4→PL-40/41, H5→PL-50, G0→PL-60/32) |
| §1 | Constraint Mapping | PASS — §3 (SPEC→constraint→enforcement→failure→strategy, incl. G1/G2/P2-02) |
| §2 | Infra Bootstrap First | PASS adaptado — Phase 0 (canônico + donos) antes do domínio docs-only |
| §2 | Execution Graph | PASS — Docs→Docs com dependências explícitas, sem ciclo |
| §2 | Critical Execution Path | PASS — §7 MVP docs-only |
| §3 | 4-Task Event Lifecycle | N/A justificado — sem eventos (SPEC §6), §9 declarado |
| §4 | Mandatory Testing Tasks | PASS — PL-40 + PL-60 (doctor + suiteFull); multi-tenant N/A (sem DB, SPEC §2) |
| §4 | Failure Mode Testing | PASS — cada fase §6 com modos falha + warn-não-fail PL-41 |
| §4 | Idempotency Validation | N/A justificado — sem eventos/filas (SPEC §6) |

**Score: PASS 7/7 exigíveis (2 N/A justificados, 0 bloqueadores).**

---
## Completion Metadata
- **Plan for**: `.spec/backend/harness-brain-separation/SPEC.md`
- **Next**: `generate-tasks` → `TASKS.md`
- **Files written this phase**: `.spec/backend/harness-brain-separation/PLAN.md` (este arquivo; nenhum código produto)
- **Continuação**: `harness-installer-mobile` archive `.spec/archive/20261008-harness-installer-mobile/` intocado.
