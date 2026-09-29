# Implementation Plan — harness-installer

## 1. Context & SPEC Traceability
- **Target Specification**: `.spec/governance/harness-installer/SPEC.md` (v1 + ajustes R1–R4/Y1)
- **Goal**: traduzir o SPEC em plano executável, com fixtures antes/depois e dogfood em cópia.

### 1.1 SPEC Validation Report
- **Status**: `Validated with named residuals` — architect aprovar-com-ajustes aplicados.
- **Gaps vindos do review (todos com dono neste PLAN)**:
  - Y2 (uid 0) → IN-01 (pre-flight recusa root sem `--allow-root`).
  - G1 (Node mínimo) → IN-01 (pre-flight + pin no código).
  - Y4 (allowlist dogfood) → IN-07.
  - Y5 (campos secret + leak por campo) → IN-06.
  - Y3 (I2 garantia, I5 log, retenção backup) → IN-05/IN-06.
  - G2 (normalização whitespace) → IN-04.
  - G3 (manifesto pré-existente alheio) → IN-01 (idempotência).
- **Assumptions**: Node disponível nos dois repos; `atlas-ecm` legível para cópia em `/tmp`;
  Q&A em português (padrão do programa).

## 2. Technical Strategy
### 2.1 CLI Strategy
- **Runtime**: Node ESM, zero dependências além do stdlib (`fs`, `path`, `readline`, `crypto`).
- **Padrão**: funções puras por etapa (inventário, backup, Q&A, geração, merge, manifesto,
  checks) + `main()` orquestrando; cada etapa testável isolada com FS temporário.
- **Testes**: `installer/__tests__/*.spec.mjs` via `node --test`, TDD red→green.

### 2.2 Fixture Strategy
- Destinos fake em `os.tmpdir()`: novo-vazio, existente-com-conflitos, existente-limpo,
  JSON-corrompido, re-instalação (manifesto presente), segredo-falso, literal-canário.

### 2.3 Dogfood Strategy
- Cópia de `atlas-ecm` para `/tmp` (trava: recusa qualquer alvo fora de allowlist de
  teste sem `--target` explícito + confirmação). Depois: suite + restart + smoke do
  destino + grep de literais.

## 3. Architecture Realization & Constraint Mapping
| SPEC Reference | Constraint | Enforcement Point | Failure Mode | Implementation Strategy |
|---|---|---|---|---|
| ADR-002/I3 | config sempre gerado | geração (sem caminho de cópia no código) | Hive por config copiado | `generateConfig(answers)` única fonte; teste diff-vs-template |
| ADR-003/I1 | backup-first | início da execução | escrita sem rede de volta | `backup()` + assert exists antes de qualquer write |
| I2 | sem sobrescrita silenciosa | plano de escrita + `--dry-run` | perda de config do destino | cada escrita classificada (novo/merge/flag) e listada |
| I4 | manifesto sempre / dry-run nada | final da execução real | auditoria impossível | `writeManifest()` só em run real; FS fake no teste |
| I5 | segredo nunca persistido | serialização (manifesto/config/log) | vazamento | allowlist de campos + fixture por campo |
| I6 | flag pendente ⇒ checks FAIL | veredito dos checks | harness meio-mergeado em uso | `flagged.length>0 → fail` + lista |
| ADR-005 | validar contra o real | Q&A (por resposta) | referência ao inexistente | `existsSync`/`command -v` por resposta; R5 trava dogfood |
| R1/R4 | corrompido-aborta / detectores definidos | merge | crash ou merge pior | parse-then-compare normalizado + testes negativos |

## 4. Module & Code Structure
| Module | Responsibilities | Boundaries |
|---|---|---|
| `installer/install.mjs` | CLI, pre-flight, etapas, veredito | não contém dados de projeto (tudo via Q&A/config) |
| `installer/__tests__/` | fixtures por invariante | sem rede, sem repo real |
| `.agents/skills/harness-installer/` | contrato de uso | doc, não gate |

## 5. Risks & Complexity Analysis
- **🔥 CRITICAL: escrita fora do target** — Mitigação: prefix-check + teste com `..`.
- **🔥 CRITICAL: dogfood no repo real** — Mitigação: trava `/tmp` + teste tenta path fora.
- **HIGH: Q&A cansativo ⇒ resposta qualquer** — Mitigação: validação bloqueia inválida.
- **MED: merge de `opencode.json` quebra projeto** — Mitigação: aditivo + flag + dry-run mostra.

## 6. Implementation Phases & Dependencies
### Phase 1: Core (inventário, backup, Q&A, geração)
- **Dependencies**: None. **Scope**: IN-01..IN-03.
### Phase 2: Merge + manifesto
- **Dependencies**: Phase 1. **Scope**: IN-04 (+ manifest).
### Phase 3: Checks + skill
- **Dependencies**: Phase 2. **Scope**: IN-05.
### Phase 4: Provas (fixtures + dogfood)
- **Dependencies**: Phase 3. **Scope**: IN-06, IN-07.

## 7. Critical Execution Path
`IN-01` → `IN-02` → `IN-03` → `IN-04` → `IN-05` → `IN-06` → `IN-07`

## 8. Atomic Task Breakdown & Execution Graph
### Phase 1
- **[IN-01]** [ ] Pre-flight + inventário + backup (+ abort paths)
  - **Depends on**: None · **Layer**: Infra · **Artifact**: `install.mjs` (pre-flight, inventory, backup)
  - **Enforcement**: recusa uid 0 sem `--allow-root`; Node mínimo (G1/Y2); backup verificado antes de tudo (I1); re-instalação/manifesto-alheio aborta (G3) · **Constraint Ref**: ADR-003/I1
- **[IN-02]** [ ] Q&A com validação por resposta
  - **Depends on**: IN-01 · **Layer**: Interface · **Artifact**: Q&A + validadores
  - **Enforcement**: path existe, comando resolve, stack declarada; segredo só-memória · **Constraint Ref**: ADR-005/I5
- **[IN-03]** [ ] Geração do `harness.config.json` (única fonte)
  - **Depends on**: IN-02 · **Layer**: Infra · **Artifact**: `generateConfig(answers)`
  - **Enforcement**: sem caminho de cópia; diff-vs-template em teste · **Constraint Ref**: ADR-002/I3
### Phase 2
- **[IN-04]** [ ] Merge por camada + manifesto
  - **Depends on**: IN-03 · **Layer**: Infra · **Artifact**: merge + `.harness-install.json` (+ Y1 campos)
  - **Enforcement**: tabela §5.2 + detectores normalizados (R4) + whitespace-normalized (G2); corrompido-aborta (R1) · **Constraint Ref**: §5.2/I6
### Phase 3
- **[IN-05]** [ ] Checks pós-instalação + skill de uso
  - **Depends on**: IN-04 · **Layer**: Test/Interface · **Artifact**: checks + `SKILL.md`
  - **Enforcement**: flagged⇒FAIL (I6); zero-literais em copiados + canário (R3); log coberto no fixture de segredo (Y3) · **Constraint Ref**: RF-07/I6
### Phase 4
- **[IN-06]** [ ] Suite de fixtures
  - **Depends on**: IN-05 · **Layer**: Test · **Artifact**: `installer/__tests__/`
  - **Enforcement**: I1..I6 com 2 ramos; leak por campo secret (Y5) · **Constraint Ref**: §9
- **[IN-07]** [ ] Dogfood em cópia atlas-ecm + 4 itens do aceite
  - **Depends on**: IN-06 · **Layer**: Test · **Artifact**: evidência em `.spec/governance/harness-installer/harness/`
  - **Enforcement**: allowlist `/tmp` + abort fora (Y4); suite+restart+smoke+literais · **Constraint Ref**: §12/V3

## 9. Event Implementation Mapping
N/A justificado — instalador linear, sem eventos de domínio. Equivalente: invariantes I1..I6
com fixtures dedicados (§8/§9 do SPEC).

## 10. Execution Readiness Checklist
- [x] Dependências válidas (grafo em TASKS.md §3).
- [x] Infra bootstrap primeiro (backup antes de tudo, I1).
- [x] Testing explícito (IN-06 + IN-07 + dogfood).
- [x] Failure-mode testing (abort paths, corrompido, segredo, re-instalação).
- [x] Critical path = fluxo núcleo (7 tasks).
