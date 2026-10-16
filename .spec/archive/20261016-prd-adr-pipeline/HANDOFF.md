# HANDOFF — ciclo `prd-adr-pipeline`

> **Data**: 2026-10-15 · **Branch**: `feat/prd-adr-pipeline` (base `main 68be417`)
> **Estado**: **9/12 tasks** · 13 commits · árvore limpa · suites verdes
> **Fase canônica**: `Execution` (`workflow-state.json.current_phase`)
> **Motivo do handoff**: sessão longa; estado sólido e retomável.

---

## 1. Como retomar (leia isto primeiro)

```sh
cd <worktree>                     # branch feat/prd-adr-pipeline
node scripts/sdd-checks.mjs       # 8/8 PASS — é o termômetro do ciclo
node --test ".opencode/plugins/__tests__/*.spec.mjs"   # 346 pass / 0 fail
node --test "installer/__tests__/*.spec.mjs"           # 372 pass / 0 fail
node scripts/static-checks.mjs && node scripts/vendor-skills.mjs --check
```

Se algum desses falhar, **pare e trate** — o ciclo está sobre base verde hoje.

---

## 2. O que está pronto (commitado)

| Task | Entrega | Commit |
|---|---|---|
| PAP-01 | `"prd"` em `SPEC_NON_CYCLE` + injeção de `nonCycle` + regressão | `d8073b2` |
| PAP-02/03 | `runPrdChecks` puro (`PRD-01`/`ADR-01`/`ADR-02`) + 113 testes | `1feb05c` |
| PAP-04/05 | Wiring no `static-checks` (**barra de verdade**, provado por exit code) + 5 templates + conserto da ref órfã `ADR_TEMPLATE.md` | `2534930` |
| PAP-06/07 | `.agents/rules/prd-adr-pipeline.md` (79 linhas) + tabela V17 + layout/estado | `60335b0` |
| PAP-08/09 | Esteira nos 2 orquestradores (inserção pura) + drift de SSoT em **4** AGENT.md | `621d6e8` |

Mais os commits de planejamento (`272f7a9`, `3c5bb20`) e as correções de artefato (`a605db2`, `0c09785`, `9a3148d`, `52471fa`, `60b2243`, `b929010`).

**O que já funciona ponta a ponta**: os 3 checks existem, são puros, **barram** (`.spec/prd/` malformado ⇒ `static-checks` sai 1 nomeando os três), o bucket `prd` não é confundido com ciclo SDD, templates coerentes com os checks, regra descritiva com mecanismo+nível por afirmação, e a esteira wired nos dois orquestradores.

---

## 3. O que falta (3 tasks + o fecho)

| # | Task | Escopo exato | Notas |
|---|---|---|---|
| **10** | README + verificação final | `README.md` (1 linha na tabela) + `.spec/backend/prd-adr-pipeline/VERIFY.md` (3 dimensões) | Exige `suiteFull` verde **com** `.spec/prd/**` em disco (não por ausência). DoD inclui `code-reviewer` zero 🔴 e regressão (`V4`/`V17`/`SDD-01..03`/`R-NODENY`/`RENAME-01`). Depende de PAP-09 **e PAP-11**. |
| **11** | **Dogfood real** | `.spec/prd/prd-adr-pipeline/{PRD.md,RESEARCH.md,ADR-INDEX.md}` + `ADRs/ADR-00N-{slug}/ADR.md` (5) | **É o critério central do produto.** Deve rodar **depois de PAP-01** (guard). `prd-id == current_feature` = o pior caso. `PRD.md` precisa das 7 seções obrigatórias (§1,§2,§5,§6,§7,§9,§16), cada uma com `> ❓ Validação:`, §7 não-vazia, métrica com "como medir", §15 com `<task>`/`<context>`, §16 com veredito+data **citando o evento de aprovação do owner** (não auto-assinar). `ADR-INDEX.md` com 8 colunas; `ADR.md` com `depende-de` + interface congelada; `RESEARCH.md` com ≥2 fontes (`http`). |
| **12** | Métricas SM-1..SM-7 | `workflow-state.json` (aditivo) + `VERIFY.md` | Congelar `baseline{suite,follow_ups,escalations,frozen_at}`; acrescentar `follow_ups[].created_at` e `prd_adr.snapshots[]`; declarar **SM-1/SM-5/SM-7 não falseáveis hoje**. P1 — **cortável**. |

### Fecho do ciclo

`P5 verify` (3 dimensões) → `P6 archive` (delta specs → `.doc/`, move para `.spec/archive/[YYYYMMDD]-prd-adr-pipeline/`, Brain, `spec-developed.md`) → commit.

---

## 4. Abertos declarados (com evidência)

| # | Item | Evidência / como resolver |
|---|---|---|
| **A-1** | **Seal não republicado** | Escrever `current_phase:"Completed"` é **negado** pelo `gate.js` (`seal-mismatch`, fail-closed). Hashes esperados: `suiteFull=c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2`, `unit=daba8c5465bffe061738235b274c497a4e8e761e41c5e79d4c671a72231cffc7`. Republicar `HARNESS_SEAL_JSON` no host **ou** fechar com override registrado. |
| **A-2** | CI **não** barra push com suíte vermelha (R-4) | `harness-integrity.yml` só cobra o trailer de path protegido. Foi assim que `68be417` entrou vermelho. |
| **A-3** | Débito **pré-existente** | `orchestrator/AGENT.md` cita 4 regras que **não existem**: `backend-unit-tests.md`, `security-standard.md`, `backend-coding-standards.md`, `db-migration-flyway.md` (o dir tem 7 arquivos). Herdado do HEAD, fora do escopo deste ciclo. |
| **A-4** | 3 nits cosméticos | Notação `§14.N` (é item de lista, não subseção); cross-ref sem qualificador de arquivo; frase ampla em `SPEC:161`. |
| **A-5** | Push pendente | Nada foi enviado ao remote. Merge é humano. |
| **A-6** | Enforcement no repo-destino é 🟡 | `scripts/` e `.github/` **não** propagam (`INCOMING_ROOTS`). Está declarado como 🟡 na regra — não é defeito, é escopo (F3). |

---

## 5. Armadilhas operacionais (aprendidas na marra nesta sessão)

1. **Todo `task` exige bloco PICCO** com `<open_questions>` **presente e vazia** — senão o `gate.js` nega (`picco-tag-absent`).
2. **Âncora B**: se `current_phase != "Completed"`, o prompt do `task` **precisa conter o literal de `current_feature`** (`inferNewCycle`), ou a delegação é negada com `prev-cycle-not-completed`.
3. **Path protegido** (`.opencode/plugins/**`, `.agents/rules/**`, `.agents/agents/**`, `.agents/schemas/**`, `.github/workflows/**`, `.githooks/**`, `opencode.json`, `harness.config.json`): escrita no runtime é liberada **só** para o agente chamado literalmente `developer-engineer`; o **commit** exige `HARNESS_GATE_APPROVER=<nome>` + `--trailer 'Harness-Gate-Change: <nome>'`. `.agents/skills/**` **não** é protegido.
4. **Orquestrador escreve apenas** `.spec/**` e `workflow-state.json` (`isOrchAllowlisted`). Todo o resto é delegação.
5. **`commands.suiteFull` é selado** — não alterar `harness.config.json`. E `sdd-checks` **não** faz parte do `suiteFull` (roda no CI e por invocação explícita).
6. **`HARNESS_SEAL_JSON` ausente** ⇒ `Completed` negado. Ver A-1.
7. **Brain MCP** pode cair (HTTP 410) — foi o caso no meio desta sessão. `brain_search` antes, `brain_store` depois; se cair, declarar aberto em vez de fingir.
8. **Registro de agentes** pode desaparecer do runtime (aconteceu): sem `developer-engineer`, nenhum agente passa na isenção de path protegido.

---

## 6. Lições (já no Brain)

1. **Padrão FU-32 materializado**: o review achou a **mesma classe** de defeito **7 vezes** em pontos diferentes — *"valor vazio/malformado desarmando condição normativa em silêncio, com o `detail` afirmando conformidade"* (`order`/`status` → `dir` → `branch` → **veredito do §16 com false-green `ok=true`** → `interface congelada` → coluna ausente → heading partido). **Raiz: regex validando prosa markdown livre.** A mitigação declarada no plano ("checks estruturais, sem varredura semântica") **não cobriu** — um `\s*` num regex é estrutural na forma e semântico no efeito. **Sugestão não implementada**: campos críticos como bloco parseável com valor obrigatório não-vazio, em vez de regex.
2. **Teste que passa por ausência de alvo** é o defeito mais recorrente: apareceu no check, no wiring e num teste que presumia `!existsSync(.spec/prd)` — este último era **bomba de tempo** que quebraria o próprio PAP-11/PAP-10.
3. **Afirmação de gate sem mecanismo** apareceu 3 vezes, incluindo **em artefato meu**: "o `gate.js` I2 recusa fase fora do canônico" é **falso** — o `gate.js` não tem conjunto canônico de `current_phase`; só compara com `Completed`. `V17` prova o **marcador** da tabela, não o conteúdo.
4. **Verificar, não confiar**: em todos os batches, a verificação independente (minha ou do revisor) achou algo que o relatório do implementador não pegou — e, uma vez, o subagente **recusou** sair do escopo e reportou o conflito (o `qa-engineer` não estava no `RF-08`).
5. **Âncora de linha em critério envelhece** — trocada por referência a símbolo em 10 pontos.

---

## 7. Arquivos-chave deste ciclo

```
.spec/backend/prd-adr-pipeline/{PROPOSAL,SPEC,PLAN,TASKS}.md   # contrato do ciclo
.agents/skills/prd-adr-pipeline/checks.mjs                     # núcleo puro (3 checks)
.agents/skills/prd-adr-pipeline/templates/                     # PRD/RESEARCH/ADR-INDEX/ADR
.agents/rules/prd-adr-pipeline.md                              # regra descritiva da esteira
.opencode/plugins/__tests__/prd-checks.spec.mjs                # 113 testes do núcleo
.opencode/plugins/__tests__/sdd-checks.spec.mjs                # testes do resolver/V17/SDD-01
.spec/bugs/installer-upgrade-regression/TASKS.md               # bugfix que destravou o ciclo
.spec/tech-debts/installer-upgrade-regression/TASKS.md         # débito fechado
```
