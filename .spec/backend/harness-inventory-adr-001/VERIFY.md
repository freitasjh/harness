# VERIFY — harness-inventory-adr-001

> Verificação de 3 dimensões (`.agents/skills/sdd-compiler/asserts/verify-gate.md`) sobre o ciclo que executa o **ADR-001 do PRD-1**.
> Data: 2026-11-11. Branch: `adr/prd-harness-inventory/01-roster-de-agentes`. HEAD: `3037d7a`.

## Veredito: **3/3 PASS**

| Dimensão | Resultado | Base |
|---|---|---|
| Completude | ✅ PASS | 12/12 microtasks marcadas, 0 `[ ]`, 0 TODO/TBD/FIXME no ciclo |
| Corretude | ✅ PASS | 938 testes (379 plugins + 559 installer) com 0 falhas; 12 RF da SPEC cobertos; REPORT schema-válido |
| Coerência | ✅ PASS | 16/16 itens do ADR honrados no código; `gate.js`/`harness.config.json` byte-idênticos; nenhum vazamento de camada |

## 1. Completude

- `TASKS.md`: **12 marcadas / 0 abertas**. RV-12 fechada com o REPORT aceito no P4.
- `grep -ric 'TODO|TBD|FIXME'` na pasta do ciclo: **0**.
- Artefatos presentes: `PROPOSAL.md` (49 l.), `SPEC.md` (49 l.), `PLAN.md` (57 l.), `TASKS.md` (71 l.), `VERIFY.md` (este).
- Contrato de origem: `ADR-001` §3 com 16 itens, todos com comando de aceite executado.

## 2. Corretude

| Requisito | Evidência |
|---|---|
| RF-01 (9 chaves) | `Object.keys(opencode.json.agent)` = 9; `primary` = `orchestrator` |
| RF-02 (registro↔disco) | `ls -d .agents/agents/*/` = 9; conjuntos idênticos |
| RF-03 (`sdd-orquestrador` fora) | `test ! -e` OK; 3 arquivos removidos |
| RF-04 (fusão no `architect`) | heading + 4 sub-marcadores; `edit: allow` preservado |
| RF-05 (stub removido) | `AGENT.md` ausente; `PROMPT.md` (75 l.) mantido e referenciado |
| RF-06 (`sdd-checks.mjs`) | `grep -c sdd-orquestrador` = 0; SDD-01/03 PASS |
| RF-07 (3 marcadores migrados) | `NÃO-BYPASS`, `gates.P1_P2`, `gates.P2_P3` presentes no `orchestrator` |
| RF-08 (`SDD_ORCH` → `ORCH`) | `grep -c SDD_ORCH` = 0; 379/379 |
| RF-09 (rules + SKILL reapontadas) | 4 arquivos com 0 ocorrências; I5 = 5 agentes sem `edit` |
| RF-10 (`docs/FUNCIONAMENTO.md`) | 1 ocorrência remanescente (`:680`, registro datado) |
| RF-11 (registros intocados) | `git diff` de `workflow-state.json` e `harness/opencode-v2-only.json` = 0 linhas nos commits de código |
| RF-12 (gate/selo) | `gate.js` e `harness.config.json` com 0 linhas; selo `c904f1c5` inalterado |

**Suíte (medida, não herdada):**

| Comando | Resultado |
|---|---|
| `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 379 pass / 0 fail · exit 0 |
| `node --test "installer/__tests__/*.spec.mjs"` | 559 pass / 0 fail · exit 0 |
| `node scripts/static-checks.mjs` | exit 0 (PRD-01/ADR-01/ADR-02 PASS) |
| `node scripts/vendor-skills.mjs --check` | OK · exit 0 |
| `node scripts/sdd-checks.mjs` | 0 FAIL · exit 0 |

## 3. Coerência

- **ADR ↔ código**: 16/16 itens com prova de comando (mapa no REPORT `harness/harness-inventory.json`).
- **Sem decisão fora do ADR**: as 3 escolhas não previstas (§7 item 0 `ls -d`, §3 item 5 `prompt` string, item 14 specs de teste) foram registradas como notas N8/N9/N10 **antes** deste verify — o contrato foi corrigido, não violado em silêncio.
- **Sem vazamento de camada**: o instalador propaga o diretório `.agents/agents` (nenhuma lista hardcoded introduzida — `grep` em `installer/` = 0); `gate.js` não passou a ler o roster; a política (rules) só mudou 1 contagem.
- **`code-reviewer`continua em `KNOWN_AGENTS`/`DENY_ROLE_WRITE`** — o stub removido era arquivo morto, não o registro.

## 4. Traceability (RF → task → arquivo)

| RF | Task | Onde |
|---|---|---|
| RF-01, RF-02 | RV-01 | `opencode.json:12-94`, `.agents/agents/*` |
| RF-04 | RV-02 | `architect/AGENT.md:22,28-31` |
| RF-03 | RV-03 | remoção de `sdd-orquestrador/` |
| RF-07 | RV-04 | `orchestrator/AGENT.md:643,655` |
| RF-05 | RV-05 | remoção de `code-reviewer/AGENT.md` |
| RF-06 | RV-06 | `scripts/sdd-checks.mjs:130,132,383-384` |
| RF-08 | RV-07 | `sdd-checks.spec.mjs:650` + usos |
| RF-09 | RV-08, RV-09, RV-10 | 3 rules + `prompt-optimizer/SKILL.md:171` |
| RF-10 | RV-10 | `docs/FUNCIONAMENTO.md:542,673,680` |
| RF-11 | RV-11 | `workflow-state.json`, `harness/opencode-v2-only.json` |
| RF-12 | RV-12 | `harness/harness-inventory.json` |

**Cobertura: 12/12 RF com arquivo e comando.** Score de traceability: **100%**.

## 5. Resíduos declarados (não bloqueiam o arquivamento)

| # | Item | Dono |
|---|---|---|
| FU-63 | Contradição `prd-adr-pipeline.md` §1 × `ADR-01` (índice exige disco): resolvida na prática (índice nasce com o 1º ADR), a **regra** continua ambígua | PRD-2 / emenda de rule |
| FU-65 | `KNOWN_AGENTS` cobre 6 nomes e o roster tem 9 (4 caem em `unknown` nos details) | mudança em `.opencode/plugins/**` (protegido) |
| — | `config-dual-parity.spec.mjs:150` assere 4 nomes de `deny`; são 5 (`security-engineer` fora) | follow-up de teste |
| — | `docs/FUNCIONAMENTO.md` cita `gate.js:659` (comentário); o `continue` está em `:660` | follow-up de prosa |

## 6. Conclusão

As 3 dimensões fecham. O ADR-001 está implementado, verificado por dois agentes independentes (QA e code review) e com o contrato reconciliado com o que foi executado. **Apto ao portão P5→P6** (decisão do owner).
