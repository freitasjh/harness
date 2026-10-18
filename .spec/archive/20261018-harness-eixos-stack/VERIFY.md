# VERIFY — harness-eixos-stack

> **Skill**: `sdd-compiler` modo `verify` · **Asserts**: `verify-gate.md` + `traceability-gate.md`
> **Data**: 2026-10-18 · **Ciclo**: `harness-eixos-stack` (14/14 tasks, 5/5 batches)
> **Fonte**: `SPEC.md` (v2) · `TASKS.md` · `PLAN.md` · `REVIEW*.md` · QA P4 (`harness/harness-eixos-stack.json`)
> **Evidência de execução**: suíte selada `commands.suiteFull` (`harness.config.json:14`)

---

## Dimensão 1 — Completeness ✅

| Critério | Resultado | Evidência |
|---|---|---|
| **Tasks 100%** | ✅ **46/46 checkboxes** marcados, **0 pendentes** | `TASKS.md` (35 marcados nesta verificação; 11 já estavam) |
| **Sem TODOs** | ✅ | `grep -rn "TODO\|FIXME\|HACK" installer/install.mjs scripts/vendor-skills.mjs` → **0 reais**. Os 2 hits são **prosa em português** ("continua entrando em TODO destino", "entra em TODOS os destinos") — declarados aqui para não passarem como TODO pendente |
| **Sem tasks puladas** | ✅ | 14/14 tasks `**Done**`; nenhuma "N/A" |
| **BDD cenários cobertos** | ✅ | 52 cenários no `TASKS.md`; cobertura por suíte: **installer 479 testes** (164 suites), **plugins 352**, static 10 checks, vendor `--check`. Cenários de **falha** com prova de mutação: cada batch reportou vermelho-antes/verde-depois (Batches 1-4: 2, 8, 5 e 4 mutações respectivamente) |

**Tasks por batch**: 1 (EX-BE-01/EX-VAL-02/EX-BE-03) · 2 (EX-BE-04/EX-BE-05/EX-VAL-06) · 3 (EX-FE-07/EX-FE-08/EX-VAL-09) · 4 (EX-BE-10/EX-BE-11/EX-VAL-12) · 5 (EX-FE-13/EX-VAL-14).

---

## Dimensão 2 — Correctness ✅

| Critério | Resultado | Evidência |
|---|---|---|
| **Build limpo** | ✅ (equivalente declarado) | Não há compilação neste repo (Node ESM; `harness.config.json:5-6` = `N/A` para backend/frontend). O equivalente é a **suíte selada**: `node --test plugins && node --test installer && node scripts/static-checks.mjs && node scripts/vendor-skills.mjs --check` → **exit 0** |
| **Testes passando** | ✅ **831/831, 0 fail, 0 skip** | plugins **352/352** · installer **479/479** · static **10 PASS/0 FAIL** · vendor `--check` **OK** — reproduzido pelo QA (P4) **e** pelo orquestrador |
| **Cobertura mínima** | **N/A declarado** | As metas (service ≥80%, domain ≥90%) são de backend Java; não existem services/domain aqui. A cobertura exigível é a do `suiteFull` selado — integralmente verde |
| **Requisitos funcionais** | ✅ **RF-01..RF-14 todos com correspondência verificável** | §Traceability abaixo (14/14) |
| **RBAC** | **N/A** | Sem autenticação/permissões neste repo |
| **Multi-tenancy** | **N/A** | Sem persistência/tenancy |

**Evidência de comportamento (não só teste unitário)**: dry-run dos 2 presets web com **0 writes** (hash da árvore antes == depois) e o gating visível **no plano** nas 2 direções (`java+react` → 2 skills react + 0 rule Vue; `java+vue` → 0 + 1). Transcript do wizard escolhendo React **byte-idêntico** em 3 cópias (`sha256 fe1f9187…`).

---

## Dimensão 3 — Coherence ✅

| Critério | Resultado | Evidência |
|---|---|---|
| **ADRs refletidos** | ✅ | ADR-001 → `axes`/`AXIS_IDS`/`stacksFor`/`STACKS_FOR_EXCEPTIONS` (`installer/install.mjs:218,228,235,247`) · ADR-002 → `RULES_BY_AXIS`/`RULES_COMMON` + gating de skill/rules por eixo (`:325,334,1363-1394`) · ADR-003 → `licenseOrigin`/`evidence[]`/`optional` (`scripts/vendor-skills.mjs:359-392,659`) · ADR-004 → menu 2 passos + range derivado (`:1682,1695,1761`) · ADR-005 → rota **documentada**, não executada (correto: escopo declarado) |
| **Sem vazamento de camada** | ✅ (equivalente) | Não há controllers/DTOs. Os equivalentes verificados: o **wizard nunca escreve e nunca chama `generateConfig`** (`:1485`, `:1700-1706` — re-verificado no P4) · `installer/` continua **rede-zero** (V15 PASS) · `gate.js`/`harness.config.json` com **0 linhas** alteradas |
| **Naming conventions** | ✅ | Segue o estilo do repo (Node ESM, comentários PT, exports nomeados); nenhuma anotação Lombok (N/A), nenhum `axios` (N/A) |
| **Frontend DevTools** | **N/A declarado** | Este repo **não tem** frontend/browser (`harness.config.json:6`). O H3 do ciclo foi substituído por **dry-run + transcript de TTY** — declarado, **sem** alegar Chrome DevTools |

---

## Traceability Report — harness-eixos-stack

### Spec → Code

| RF | Task | Code | Status |
|---|---|---|---|
| RF-01 (registry com `axes`) | EX-BE-01, EX-VAL-02 | `installer/install.mjs` (`STACK_PROFILES`, `stacksFor`) · `installer/__tests__/eixos-stack.spec.mjs` | ✅ Mapped |
| RF-02 (preset `java+react`) | EX-BE-03 | `installer/install.mjs` + `generate.spec.mjs`/`mobile.spec.mjs` | ✅ Mapped |
| RF-03 (gating de skill por eixo) | EX-BE-04, EX-VAL-06 | `scripts/vendor-skills.mjs` (`stacks` da origem) + `vendor.spec.mjs`/`eixos-stack.spec.mjs` | ✅ Mapped |
| RF-04 (gating de rules + enumeração) | EX-BE-05, EX-VAL-06 | `installer/install.mjs` (`RULES_BY_AXIS`, `RULES_COMMON`, `validateRulesByAxis`) | ✅ Mapped |
| RF-05 (range derivado) | EX-FE-07 | `installer/install.mjs` (`askMenuStep`, `items.length`) | ✅ Mapped |
| RF-06 (menu 2 passos + erro 4 linhas) | EX-FE-08, EX-VAL-09 | `installer/install.mjs` + `wizard.spec.mjs` | ✅ Mapped |
| RF-07 (default de suíte do react) | EX-BE-03 | `installer/install.mjs` (`defaultSuiteFor`) | ✅ Mapped |
| RF-08 (vendor das 2 skills) | EX-BE-10, EX-BE-11 | `scripts/vendor-skills.mjs` + `.vendor-lock.json` + `LICENSE-*` | ✅ Mapped |
| RF-09 (`react-components` opcional) | EX-BE-11, EX-VAL-12 | `.vendor-lock.json` (`optional: true`) + `vendor.spec.mjs` | ✅ Mapped |
| RF-10 (`--check` por origem) | EX-BE-10, EX-VAL-12 | `scripts/vendor-skills.mjs` (`checkVendor`) + `vendor.spec.mjs` (split) | ✅ Mapped |
| RF-11 (prosa ↔ mecanismo) | EX-FE-13 | `harness-config.md`, `harness-installer/SKILL.md`, `README.md`, `docs.spec.mjs` | ✅ Mapped |
| RF-12 (schema do `--answers-file` intocado) | EX-VAL-14 | `installer/install.mjs` (`QUESTIONS`, 5 chaves) + fixtures legadas verdes | ✅ Mapped |
| RF-13 (pré-requisitos do vendor) | EX-BE-10, EX-BE-11 | `scripts/vendor/skills-lock.json` (source-lock commitado) + `VENDOR-NOTICE.md` | ✅ Mapped |
| RF-14 (prompt do W3 coerente) | EX-BE-03, EX-VAL-09 | `installer/install.mjs` (prompt/`howToFix` de `STACK_VALUES`) + `wizard.spec.mjs` | ✅ Mapped |

### Code → Spec

| Módulo/arquivo alterado | RF | Status |
|---|---|---|
| `installer/install.mjs` | RF-01..RF-07, RF-12, RF-14 | ✅ Mapped |
| `scripts/vendor-skills.mjs` + `scripts/vendor/skills-lock.json` | RF-03, RF-08, RF-10, RF-13 | ✅ Mapped |
| `.agents/skills/.vendor-lock.json` / `VENDOR-NOTICE.md` / `LICENSE-*` / 2 skills | RF-08, RF-09, RF-10, RF-13 | ✅ Mapped |
| `.agents/rules/harness-config.md` · `harness-installer/SKILL.md` · `README.md` | RF-11 | ✅ Mapped |
| `installer/__tests__/*.spec.mjs` (5 arquivos + 1 novo) | cobertura de RF-01..RF-14 | ✅ Mapped (teste) |

### Score

- **RF→Task: 100% (14/14)**
- **Task→Code: 100% (14/14)**
- **Orphaned specs: 0**
- **Orphaned code: 0** (todo arquivo alterado pertence a uma task do PLAN)
- **Overall: 100% ✅ PASS** (mínimo 80%)

---

## Resultado Final

```
VERIFY STATUS: APPROVED ✅
```

**Bloqueadores encontrados**: nenhum.

### Observações (declaradas, não bloqueiam o verify)

1. **C-1 (P1, aberto)** — o REPORT sai **schema-inválido** por decisão declarada do owner: o schema exige `counts`, a contraprova **nega** counts não observados (`gate.js:624-625`) e o executor padrão devolve `counts:null` (`:561-572`). O QA **verificou empiricamente**: com `counts` ⇒ `DENY`; sem ⇒ `ALLOW`. As contagens reais estão em `observedCounts`. Decisão do owner neste portão: **manter o desvio declarado**.
2. **A-1 (pré-existente, externo)** — `HARNESS_SEAL_JSON` **ausente no host** ⇒ escrever `current_phase:"Completed"` é **negado fail-closed**. O selo computado hoje é **byte-igual** ao publicado (`suiteFull` sha256 `c904f1c5…`). Decisão do owner: **republicar o selo** (ação externa) para o fechamento limpo.
3. **FU-59 / FU-60 (P2 novos, do QA P4)** — (a) o **caminho default** do menu (`Enter,Enter`) chega ao comando da suíte **sem default** para `java+vue` e repete `BAD_ANSWER`; (b) **assimetria de gating**: a *rule* Vue sai do destino react, a *skill local* `frontend-vue-specialist` **entra**. Registrados em `.spec/tech-debts/harness-eixos-stack-p2/TASKS.md` com evidência e teste exigido. **Não bloqueiam** o verify (são produto/tech-debt, não requisito do ciclo).
4. **FU-56** — 3 skills mobile divergem do commit pinado declarado; **declarado e nomeado** no `VENDOR-NOTICE` (decisão do owner pendente: re-vendorizar muda hashes congelados).
5. **FU-58 / FU-57 / FU-55** — constante de prova do dry-run no REPORT (irreprodutível, propriedade verificada); `checkVendor` não pega edição só-da-tabela de licença; incidente de processo auto-declarado no Batch 3.
6. **Desvios de escopo declarados e aprovados pelo owner**: menu em **2 passos** (D-A, em vez dos 3 do parecer UX) · `optional` como **metadado** (as 2 skills são instaladas) · `AGENTS.md` inexistente ⇒ nota no `README.md` (emenda de delta declarada no SPEC §11).
