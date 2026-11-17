# PLAN — prd-eixos-separados-cli-adr-001

> Compilado de SPEC.md (13 RF) + ADR-001 §3. Branch `01-eixos-separados-impl`, base `2fed40a`. Feature §16 D16-EIXOS-CLI: substituir 12 presets casados por 48 combinações compostas.

## 1. Fases
| Fase | Objetivo | Tasks |
|---|---|---|
| F0 — Eixos | 8 backends × 6 frontends = 48; composição commands/moduleMap do backend, mcp/stacks do frontend | EIX-01, EIX-02 |
| F1 — Gerador | `generateConfig({axes:{backend,frontend}})` → 48 configs; textos derivados; rust+vue sem perfil | EIX-03 |
| F2 — Consumidores | migrar 13 arquivos; veredito por arquivo; nenhum preset casado como caminho principal | EIX-04 |
| F3 — Baseline | 48 literais no golden, ratificação das 36 novas (C1/C2/C3), V20 re-medido | VAL-01 |
| F4 — Selo + harness | novo hash ratificado, gate/config intocados, suíte 0 falhas, VERIFY | VAL-02 |

**Critical path:** `EIX-01 → EIX-02 → EIX-03 → EIX-04 → VAL-01 → VAL-02`.

## 2. Traceability 1:1
| RF | Item | Task |
|---|---|---|
| RF-01 cardinalidade 48 | 1 | EIX-01 |
| RF-02 commands/moduleMap backend | 2 | EIX-02 |
| RF-03 mcp/stacks frontend | 3 | EIX-02 |
| RF-04 textos derivados | 4 | EIX-03 |
| RF-05 rust+vue sem perfil | 5 | EIX-03, VAL-01 |
| RF-06 substituir 12 | 6 | EIX-04 |
| RF-07 inventário 13 | 7 | EIX-04 |
| RF-08 baseline 48 ratificado | 8 | VAL-01 |
| RF-09 V20 re-medido | 9 | VAL-01 |
| RF-10 selo re-derivado | 10 | VAL-02 |
| RF-11 invariantes harness | 11 | VAL-02 |
| RF-12 suíte + ledger | 12 | VAL-02 |
| RF-13 escopo (CLI → ADR-002) | 13 | EIX-01 (não incluir) |

## 3. Constraint mapping
| Constraint | Enforcement | Failure Mode |
|---|---|---|
| 48 por composição | eixos-stack.spec oráculo 48/48 | combinação ausente ⇒ FAIL |
| commands/moduleMap do backend | asserção por eixo | valor do frontend em commands ⇒ FAIL |
| mcp/stacks do frontend | asserção por eixo | valor do backend em mcp ⇒ FAIL |
| textos derivados | grep 'declared via Q&A' vazio no gerador | literal solto ⇒ FAIL |
| baseline ratificado | 48 literais, C1 autoridade, C2 revisor, C3 proibida | auto-accept ⇒ FAIL |
| selo novo ratificado | novo hash, sem compatibilidade c904f1c5 | promessa de compatibilidade ⇒ FAIL |
| gate/config intactos | gate.js byte-idêntico | tocar gate ⇒ FAIL |

## 4. Event lifecycle
**N/A** — composição de config é pura, sem eventos.

## 5. Testes
`eixos-stack.spec` 48/48 · `golden.spec` 48 literais · `cargo test` · `static-checks`/`sdd-checks` 0 falhas · selo novo ratificado · inventário 13 com veredito.

## 6. Rollback
`git reset --hard 2fed40a`. Nenhum gate/config/selo antigo tocado até ratificação.
