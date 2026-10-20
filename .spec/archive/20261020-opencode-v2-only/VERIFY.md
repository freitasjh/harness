# VERIFY — opencode-v2-only

> **Ciclo**: `opencode-v2-only` · **Tipo**: refactor/migração · **Data**: 2026-10-20
> **Fonte**: `SPEC.md` (RF-01..RF-07) + `PLAN.md` + `TASKS.md` (9 tasks) + 3 reviews do `code-reviewer`
> **Nota**: a skill `sdd-compiler` (modo verify) não está disponível nesta sessão ⇒ verificação executada manualmente contra os **mesmos** critérios (`asserts/verify-gate.md`): Completude · Corretude · Coerência.

## Dimensão 1 — Completude

| Critério | Medido | Veredito |
|---|---|---|
| Tasks do `TASKS.md` | 9 tasks; 40 `[x]` → **51/51** após este VERIFY (`MIG-FE-07` + `MIG-VAL-08` fechados) | ✅ |
| Zero TODO no escopo | `grep TODO/FIXME/XXX` em `gate.js`, satélites, `install.mjs` e `.spec/backend/opencode-v2-only/` → 2 hits, **ambos prosa** ("TODO destino", "DECISAO, nao TODO") ⇒ **0 TODO reais** | ✅ |
| RF cobertos | RF-01..RF-07 ⇒ **7/7** com ≥1 task | ✅ |
| Traceability (gate ≥80%) | RF→Task **7/7 = 100%**; zero órfãos (`RF-03` fechado por `MIG-BE-09`) | ✅ |
| Artefatos do ciclo | 4/4 (`PROPOSAL`, `SPEC`, `PLAN`, `TASKS`) | ✅ |

## Dimensão 2 — Corretude

| Critério | Medido |
|---|---|
| Suíte de plugins | **379/379**, 0 fail, 0 skip (94 suites) |
| Suíte do instalador | **516/516**, 0 fail (178 suites) |
| `static-checks` | **10 PASS** / 0 FAIL / 2 INFO |
| `sdd-checks` | **8 PASS** (V4, R-V12, V17, SDD-01..03, R-NODENY, RENAME-01) |
| Selo | `verifySeal` = `{ok:true}`; `sha256(suiteFull)` = `c904f1c5…` (idêntico ao publicado) |
| Runtime | **19 agentes**; **0** `failed to reload plugins` desde 2026-10-18T23:29:21; reload limpo em 2026-10-19 |

### Cobertura por RF

| RF | Evidência |
|---|---|
| RF-01 (plugins no contrato v2) | `gate.js` exporta `{id, setup}` e `setup`→`undefined`; hooks por `ctx.tool.hook("execute.before")`/`ctx.event.subscribe`; testes entram pelo **envelope medido** (`{tool,sessionID,agent,messageID,id,input}`) |
| RF-02 (paridade de veredito) | 12/12 núcleos puros byte-idênticos (3 medições independentes); matriz deny/allow com ≥1 deny + ≥1 allow por gate |
| RF-03 (`opencode.json` v2-only) | 9 agentes com `description`+`permission`; `plugin`/`plugins` vazios; autoridade **5 deny / 4 allow** medida em 3 vias (`MIG-BE-09`) |
| RF-04 (merge do instalador) | `mergePluginList` + `isHarnessLocalPluginEntry` + `stripObsoleteConfigKeys`; 11 testes em `merge-v2-only.spec.mjs`; **npm do usuário preservado** |
| RF-05 (instalação nova) | merge em destino temp ⇒ v2-only; sem WARN de `conflict`/`malformed` no merge |
| RF-06 (prosa + esteira) | I5 → `permission.edit`; selo lê `HARNESS_SEAL_JSON` (A-1); supersession declarada; `.spec/archive/**` intocado |
| RF-07 (enforcement declarado) | `enforcement_status` reflete o estado real — gate **vivo** (negou um comando nesta sessão: `F-03`) |

## Dimensão 3 — Coerência

| Critério | Medido |
|---|---|
| Núcleos puros | **12/12** byte-idênticos ao HEAD (3 medições independentes) |
| `harness.config.json` + `lib/**` | **0 linhas** de diff |
| Config × prosa (matriz 9 agentes) | **5 deny / 4 allow**; zero contradição prosa×permissão (varredura em 2 passes, 49 candidatas) |
| Registro do ciclo arquivado | `MIG-*` dentro de `cycle_eixos_stack` = **0**; arquivado byte-idêntico ao HEAD |
| Camadas | sem vazamento: núcleos puros + adapter nos plugins; instalador isolado; prosa separada |
| Supersession | `opencode-v2-plugin-migration` declarada; artefatos dela intocados |

## Provas independentes
- **3 reviews do `code-reviewer`** — todas convergiram para `APPROVED`; a do Batch 1 e a do Batch 3 com **provas de mutação próprias**.
- **Sondas de mutação** (todas sangram e revertem byte-igual): `P1/P2/P3` (envelope/boundary/agent feed) · `M-DIVERGENT`/`M-UNVERIFIABLE`/`M-SCHEMA` (C-1) · `D-GATE-DRIFT`/`D-FIXTURE-DRIFT`/`D-ISEVENT` · Batch 2 (união de `plugin`, delete de `agents` por nome, `noop` por texto).
- **Gate vivo**: negou um `write` fora da allowlist e um comando contendo o padrão de matança por nome — enforcement **observado**, não declarado.

## Riscos residuais (declarados, não bloqueiam o archive)
| ID | Risco |
|---|---|
| `TD-01` | `atlas-ecm`/`taskflow` ainda com o shape v1/dual **e** `gate.js` com `setup()`→objeto (a via de upgrade agora converge para v2-only, mas precisa ser **rodada** neles) |
| `TD-07` | `estudo/opencode.json` é JSON **inválido** |
| `A-1` | `Completed` real exige `HARNESS_SEAL_JSON` no host (valor exato entregue) |
| `F-03` (**P2**) | o gate casa o padrão de matança por nome no **texto** do comando ⇒ o canal `bash` do orchestrator não edita prosa que o mencione |
| `TD-13` | 16 rótulos `EX2-*` em `.opencode/plugins/**` (cosmético) |
| `TD-14/15` | falso-DENY de path absoluto no escopo do `qa-engineer`; agente órfão `sdd-orquestrador` |

## Veredito

| Dimensão | Veredito |
|---|---|
| **Completude** | ✅ 51/51 checkboxes · 0 TODO · 7/7 RF · trace 100% |
| **Corretude** | ✅ 379/379 + 516/516 + static 10 PASS + sdd 8 PASS + selo ok + runtime estável |
| **Coerência** | ✅ 12/12 núcleos puros · 0 linhas em config/lib · 0 contradição prosa×permissão · arquivado intocado |

**3/3 ✅ — archive liberado** (sujeito ao portão humano P5→P6).
