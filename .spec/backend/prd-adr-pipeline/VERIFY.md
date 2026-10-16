# VERIFY — Esteira PRD → ADR → SDD no harness

> **Ciclo**: `prd-adr-pipeline` · **Branch**: `feat/prd-adr-pipeline`
> **Data**: 2026-10-16 · **Gate**: `asserts/verify-gate.md` (3 dimensões)
> **Regra**: cada dimensão traz **comando + saída colada**. Nenhum ✅ sem evidência.

---

## Dimensão 1 — Completude

### 1.1 Tasks 100% (checkboxes)

```console
$ grep -c '^- \[ \]' .spec/backend/prd-adr-pipeline/TASKS.md
1
$ grep -c '^- \[x\]' .spec/backend/prd-adr-pipeline/TASKS.md
109
$ grep -c '| Todo |' .spec/backend/prd-adr-pipeline/TASKS.md
0
$ grep -n '^- \[ \]' .spec/backend/prd-adr-pipeline/TASKS.md
626:- [ ] **`code-reviewer` invocado após a última mudança, com zero 🔴** ... **PENDENTE**: ... ver `VERIFY.md` §1.4.
```

**109/110** marcados. O único item **não** marcado é a DoD do `PAP-10` que exige
o parecer do `code-reviewer` — **pendente e declarado** (§1.4), não mascarado.

As 12 tasks `PAP-01`..`PAP-12` constam `Done` na Sprint Summary; `PAP-10` leva a
qualificação honesta **`Done (1 item de DoD pendente — parecer do code-reviewer)`**
e `PAP-12` leva **`Done (F-1 do review fechado na iteração 1 do loop §6.2)`**
(achado F-5 do review: um rótulo `Done` seco esconderia o item de DoD aberto).
`PAP-01`..`PAP-09` e `PAP-11` foram concluídas e commitadas em ciclos anteriores;
**`PAP-10` e `PAP-12` foram executadas nesta sessão** — nada foi marcado por
antecipação.

**Fora do escopo declarado (não é lacuna de completude):**
- `PAP-11` é **decision-only**: os 5 ADRs do dogfood contêm apenas `ADR.md` — exceção declarada em `SPEC §4.4` ("ADR cujo SDD é o próprio ciclo em curso"). Não há `SPEC/PLAN/TASKS/VERIFY` por ADR neste meta-ciclo; o SDD deles é **este** ciclo.
- `PLAN §9` (Event Implementation Mapping) é **N/A justificado** (`SPEC §6`: sem mensageria). Nenhuma task de evento existe para marcar.
- Dogfood externo (ECM) está **out of scope** (`SPEC §0.3`); a propagação de `scripts/`+`.github/` é 🟡 processo no repo-destino até F3 (declarado, não mascarado).

### 1.2 Sem TODOs

O comando é **escopado**: um grep sem escopo sobre `.spec/backend/prd-adr-pipeline/`
casa as auto-referências do próprio `VERIFY.md` (este comando, a prosa e a tabela
da DoD), cujo número **cresce com este arquivo** — logo não é reproduzível. Saídas
literais (todas estáveis):

```console
$ grep -rn "TODO\|FIXME\|HACK" .spec/backend/prd-adr-pipeline/TASKS.md | grep -v "Sem TODO pendente" | wc -l
0

$ grep -c "TODO\|FIXME\|HACK" .spec/backend/prd-adr-pipeline/TASKS.md
12

$ grep -o "Sem TODO pendente" .spec/backend/prd-adr-pipeline/TASKS.md | wc -l
12

$ grep -rn "TODO\|FIXME\|HACK" .spec/backend/prd-adr-pipeline/ --exclude=VERIFY.md | wc -l
12
$ grep -rln "TODO\|FIXME\|HACK" .spec/backend/prd-adr-pipeline/ --exclude=VERIFY.md
.spec/backend/prd-adr-pipeline/TASKS.md
```

As 12 ocorrências cruas vêm **todas** do `TASKS.md` e são exatamente o **rótulo**
da própria DoD (`Sem TODO pendente.`), 1 por task (`PAP-01`..`PAP-12`): `12 = 12`.
Excluindo o rótulo, **zero** TODO/FIXME/HACK real. `SPEC.md`/`PLAN.md`/`PROPOSAL.md`
contribuem `0`.

### 1.3 BDD cenários cobertos

Os 3 checks (`SPEC §5`) têm ≥1 fixture PASS e ≥1 FAIL por check, incluindo o caso
vacuous-safe e o de bug (`type=bug` ⇒ `N/A`): `.opencode/plugins/__tests__/prd-checks.spec.mjs`,
verde na suíte (350/350 — §2.1). A regressão do resolver (`INV-4`) está em
`.opencode/plugins/__tests__/sdd-checks.spec.mjs`. O guard de `NFR-6` (campos do
gate preservados no state real) é o describe `PAP-12/NFR-6` do mesmo arquivo —
4 testes, incluindo 3 de discriminação (ver §4).

### 1.4 Pendência declarada — parecer do `code-reviewer` (DoD do PAP-10)

O `PAP-10` exige, na DoD, "`code-reviewer` invocado após a última mudança, com
zero 🔴". **Este subagente não consegue satisfazê-lo**: o runtime recusa subagente
aninhado. Evidência literal da tentativa:

```console
$ # invocacao do subagente code-reviewer a partir desta sessao
{"error":{"type":"tool.execution","message":"Subagent depth limit reached (1). Increase \"experimental.subagent_depth\" to allow nested subagents."}}
```

**Handoff ao orquestrador**: delegar `code-reviewer` sobre o diff desta sessão
(README + `workflow-state.json` + `TASKS.md` + `VERIFY.md`). O checkbox
`TASKS.md:626` fica **`[ ]`** até o parecer existir. Self-review seria violação de
"verificador ≠ executor" — por isso **não** foi feito.

### 1.5 Loop de correção §6.2 — rodada 1 (findings do code review)

O `code-reviewer` foi invocado pelo orquestrador e devolveu **1 🔴 + 4 🟡** sobre
este ciclo. O `developer-engineer` fechou os 5 na iteração 1 do loop §6.2:

| # | Sev | Defeito | Correção | Onde |
|---|---|---|---|---|
| **F-1** | 🔴 | `TASKS.md` marcava `[x]` o "teste de que `workflow-state.json` preserva os campos do gate" **sem artefato**: nenhum teste lia o state real (todos usavam fixture), logo renomear `current_phase` no state real não quebrava nada verde — o furo que o `NFR-6` deveria fechar | **Opção (A)**: teste escrito em `prd-checks.spec.mjs` que lê o state **real** e discrimina (3 testes negativos + RED citado) | §4; `prd-checks.spec.mjs` (describe `PAP-12/NFR-6`) |
| **F-2** | 🟡 | comando de TODO colado não reproduzia: o grep sem escopo casa as auto-referências do próprio `VERIFY.md` (número instável) e o `0` era falso | comando escopado ao `TASKS.md` (+ `--exclude=VERIFY.md`); saída real colada | §1.2 |
| **F-3** | 🟡 | número sem comando: `diff -u <state antes do PAP-12>` (placeholder) e `43` subcontava (o real do PAP-12 é **57**) | `git diff --numstat` = `58 1` + `grep` de campos removidos (vazio); `43`→`57` | §Prova de aditividade |
| **F-4** | 🟡 | gatilho de pivot condicional/ambíguo: `snapshots: []` **e** `ADR-003` já `merged` ⇒ SM-3 nunca computável para este `prd_adr`; e "merge" com 2 sentidos | desambiguado (2 sentidos separados; gatilho no 1º merge do **próximo** PRD) | §Gatilho de pivot |
| **F-5** | 🟡 | `TASKS.md:23` dizia `PAP-10 = Done` com item de DoD aberto; status `APPROVED` com 1 🔴 | rótulo honesto em `TASKS.md` §2; status ajustado ao round | §1.1; `TASKS.md` §2 |

**Re-review pendente**: o parecer final é do `code-reviewer` (handoff §1.4). Este
round fecha os findings; não substitui o parecer.

---

## Dimensão 2 — Corretude

### 2.1 `commands.suiteFull` verde — **com** `.spec/prd/**` materializado

O comando vem de `harness.config.json:14` (nunca literal de prosa):

```console
$ node --test ".opencode/plugins/__tests__/*.spec.mjs"
ℹ tests 350
ℹ pass 350
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0

$ node --test "installer/__tests__/*.spec.mjs"
ℹ tests 372
ℹ pass 372
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0

$ node scripts/static-checks.mjs
... EXIT=0  (ver §2.2)

$ node scripts/vendor-skills.mjs --check
vendor-check OK (.agents/skills/.vendor-lock.json)
EXIT=0
```

Verde **na presença** do artefato real (`.spec/prd/prd-adr-pipeline/**` está
rastreado por git — `git ls-files .spec/prd/prd-adr-pipeline` lista PRD.md,
RESEARCH.md, ADR-INDEX.md e 5 `ADRs/ADR-00N-*/ADR.md`). **Não** é verde por
ausência — o cenário 1 do `PAP-10` é o aceite; o cenário 3 (clone sem
`.spec/prd/`) é só o guard vacuous-safe.

### 2.2 Os 3 checks PASS **sobre o artefato real**

```console
$ node scripts/static-checks.mjs
PASS V6: harness.config.json: valid JSON
PASS V6b: harness-report.schema.json: valid JSON
PASS V2: permission.ask=0
PASS V3: hardcoded-project-literals=0
PASS V7: scalar-output-system=0
PASS V15: rede em installer/=0
INFO V12: harness-continuous.md orphan refs=0 (fusion landed DOC-02; enforced as FAIL R-V12 in scripts/sdd-checks.mjs)
PASS V14: git+remote+CI present
PASS PRD-01: PRD.md com as 7 seções obrigatórias conformes
PASS ADR-01: ADR-INDEX.md 1:1 com ADRs/<dir>/ (sem órfãos)
PASS ADR-02: ADR-INDEX.md: sequência e branch conformes
INFO LEGACY: FIX-01 done, baseline 0 (not green, history only): hardcode=0 scalar-assign=0
EXIT=0
```

`PRD-01`/`ADR-01`/`ADR-02` rodam sobre `.spec/prd/prd-adr-pipeline/` **real**
(não fixture): o `static-checks` chama `runPrdChecks(REPO_ROOT)`.

### 2.3 `sdd-checks` 8/8

```console
$ node scripts/sdd-checks.mjs
PASS V4: rules lines=1069 (budget 1705)
PASS R-V12: orphan refs=0
PASS V17: canonical vocab + conversion table present
PASS SDD-01: refs-ok=true non-bypass=true no-orphan-promise=true
PASS SDD-02: cycle=.spec/backend/prd-adr-pipeline (via state.artifacts.spec_dir) artifacts 4/4, tasks sections=12 declared=12
PASS SDD-03: state.gates P1_P2=approved_user_2026_10_15 (spec-gate 10/10; spec-review 0 criticos) P2_P3=pending_user_approval convention-doc=true
PASS R-NODENY: gate.js has no artifact-gate deny
PASS RENAME-01: old-name hits=0
EXIT=0
```

`SDD-02` continua resolvendo `.spec/backend/prd-adr-pipeline` (o ciclo certo) —
**mesmo** com `prd-id == current_feature` em `.spec/prd/**` (pior caso do guard).

### 2.4 Requisitos funcionais cobertos

| RF | Evidência |
|---|---|
| RF-01 guard non-cycle | `SPEC_NON_CYCLE = new Set([..., "prd"])` (`scripts/sdd-checks.mjs:150`) + teste de regressão verde |
| RF-02 módulo puro | `checks.mjs:41-42` importa **só** `{readFileSync, readdirSync, existsSync} from "node:fs"` e `{join} from "node:path"` — sem rede/exec/escrita |
| RF-03 3 checks | §2.2 (`PASS PRD-01/ADR-01/ADR-02`) |
| RF-04 wiring sem selo | §2.2 + `harness.config.json` inalterado (§3.4) |
| RF-05 templates | 5 templates em disco (`4` em `prd-adr-pipeline/templates/` + `ADR_TEMPLATE.md`) |
| RF-06 regra + emendas | `.agents/rules/prd-adr-pipeline.md` (79 linhas) + V17 linhas `162-163` + subseção `3.10` |
| RF-07 wiring agentes | `SDD-01`/`SDD-03` PASS (§2.3) |
| RF-08 drift SSoT | §3.3 |
| RF-09 branch/PR sem `gh` | documentado em `prd-adr-pipeline.md §4` (merge humano) |

### 2.5 N/A declarado (stack)

`mvn`/`npm`/RBAC/multi-tenancy/Flyway do `verify-gate.md` são **N/A** — este repo
é toolchain Node (sem banco, sem serviço, sem camadas de aplicação; `SPEC §2`, `§6`).

---

## Dimensão 3 — Coerência

### 3.1 ADRs refletidos no código (mapa `ADR-INDEX.md` → realização)

| ADR | `merge` (sha) | Realizado por | Reflexo no código (evidência) |
|---|---|---|---|
| ADR-001 `.spec/prd/**` non-cycle | `d8073b2` | PAP-01 | `SPEC_NON_CYCLE` inclui `"prd"` (`scripts/sdd-checks.mjs:150`) |
| ADR-002 checks no path propagável | `1feb05c` | PAP-02/03 | `.agents/skills/prd-adr-pipeline/checks.mjs` + `import { runPrdChecks }` (`scripts/static-checks.mjs:28`) |
| ADR-003 enforcement = suíte+CI, nunca deny | `2534930` | PAP-04 | `PASS R-NODENY` (§2.3) + `gate.js` diff vazio (§3.4) |
| ADR-004 `ADR.md` é a unidade | `2534930` | PAP-05 | 5 dirs `ADRs/ADR-00N-*/ADR.md` (decision-only, `SPEC §4.4`) |
| ADR-005 fases = rótulos | `60335b0` | PAP-06/07 | linhas `PRD, RESEARCH → Discovery` / `ADR-INDEX, ADR → Planning` (`workflow-rules.md:162-163`) |

`621d6e8` (PAP-08/09) **consome** as decisões, não realiza nenhuma — por isso não
aparece como `merge` de nenhuma linha, coerente com o `ADR-INDEX.md`.

### 3.2 Sem vazamento de camada

Fronteira real (`SPEC §2`): `scripts/` **só importa** o núcleo puro; a lógica
mora em `.agents/skills/**` (propagável). Provado por `scripts/static-checks.mjs:28`
(import) — não há reimplementação dos checks em `scripts/`.

### 3.3 Conserto do drift de SSoT (RF-08)

```console
$ grep -rn "GEMINI.md\|docs/specs\|docs/adr" .agents/
.agents/skills/context-compressor/SKILL.md:20:- **Critical Constraints:** Rules from `GEMINI.md` or `MEMORY.md` that must persist.
```

**1 ocorrência**, e ela é **declarada não-viva** por `SPEC §8 RF-08`: é um exemplo
genérico dentro de uma skill de terceiro, não um ponteiro de projeto. Referências
**vivas** de projeto = **0**.

### 3.4 `gate.js` e `harness.config.json` intocados

```console
$ git diff main --numstat -- .opencode/plugins/gate.js harness.config.json
( sem saída = diff vazio )
```

---

## PAP-12 — Baseline congelado e métricas SM-1..SM-7

### Baseline (valores reais do state)

```json
{
  "suite": "plugins 350/0/0 + installer 372/0/0 + static-checks EXIT 0 + vendor-check OK",
  "follow_ups": 43,
  "escalations": 3,
  "frozen_at": "2026-10-16"
}
```

Confirmado por `node -e "const s=require('./workflow-state.json'); console.log(s.follow_ups.length, s.escalations.length)"` → `43 3`. O `suite` do baseline foi re-medido após a correção F-1 (4 testes novos no mesmo ciclo): `node --test ".opencode/plugins/__tests__/*.spec.mjs"` → `350/350/0` (§2.1).

### Campos aditivos no `workflow-state.json`

- `prd_adr` = `{prd_id: "prd-adr-pipeline", prd_status: "approved", active_adr: null, adr_order: ["ADR-001".."ADR-005"], snapshots: []}`.
  `snapshots: []` é **honesto**: nenhum ADR foi mergeado para `main` ainda (o
  `merge` do `ADR-INDEX` é "decisão realizada", não merge para `main` — §convenção
  do próprio índice). O **1º snapshot** é escrito pelo orquestrador no 1º merge de
  ADR do **próximo** PRD — para este `prd_adr` o SM-3 não é computável (ver
  §Gatilho de pivot). **Nada foi inventado.**
- `follow_ups[].created_at` (43/43): data derivada do commit mais antigo em que o
  id apareceu em `workflow-state.json` (`git log -S "<id>"`), declarada em
  `follow_ups_created_at_basis`. Não havia timestamp à mão.

### Prova de aditividade (NFR-6 / constraint 8)

Comando verificável contra `HEAD` — **não** há cópia pré-PAP-12 do state (o
placeholder `<state antes do PAP-12>` não é reproduzível); o `numstat` prova a
forma da mudança no working tree:

```console
$ git diff --numstat -- workflow-state.json
58	1	workflow-state.json

$ git diff -- workflow-state.json | grep -E '^-.*"(current_phase|current_feature|harness_status|code_review_status)"'
( sem saída = grep exit 1 = nenhum campo lido pelo gate foi removido/renomeado )
```

As **58 adições** decompõem-se em **57 do PAP-12** (43 `created_at` + 13 do bloco
`prd_adr` + 1 `follow_ups_created_at_basis`) **+ 1** linha `sdd_stage`
pré-existente do orquestrador. A **única deleção** é a `sdd_stage` antiga — também
pré-existente no working tree, **não** do PAP-12 (desvio declarado abaixo).

Nenhum campo lido pelo gate (`gate.js:708-710`, `:727-733`) foi renomeado ou
removido: o segundo comando não emite nenhuma linha. Os 4 campos permanecem com
os mesmos nomes e valores (`current_feature=prd-adr-pipeline`,
`current_phase=Planning`, `harness_status=passed`, `code_review_status=passed`).

> **Desvio declarado (defeito de premissa do aceite).** `git diff --numstat -- workflow-state.json`
> contra `HEAD` retorna `58 1` — **1 deleção**. Essa deleção **não** é do PAP-12:
> é uma edição **pré-existente no working tree** (linha `sdd_stage`, valor
> `9/12`→`10/12`), feita pelo orquestrador antes desta sessão. O PAP-12 é
> estritamente aditivo (prova acima: a única linha `-` do diff é a `sdd_stage`
> pré-existente; nenhuma remoção do PAP-12). Atingir "0 deleções vs HEAD"
> exigiria reverter a nota do orquestrador — não feito.

### As 7 métricas de `SPEC §14.1`

| # | Métrica | Instrumento | Estado **hoje** |
|---|---|---|---|
| SM-1 | Desalinhamento capturado **antes** do trabalho | `scope_additions` ÷ pedidos pós-aprovação | ⚠️ **NÃO falseável** — `scope_additions` conta itens de planejamento, não pedidos pós-aprovação |
| SM-2 | Unidade de revisão pequena | `git log --merges` (1 merge = 1 ADR) | ✅ medível |
| SM-3 | Retrabalho pós-merge por ADR | Δ `follow_ups` entre `prd_adr.snapshots[]` consecutivos | 🟡 **instrumentado, sem dado ainda** — `snapshots: []`; definição = Δ entre snapshots **consecutivos** (`SPEC §14.1`) ⇒ só computável no **2º** snapshot. Para **este** `prd_adr` não é computável; o gatilho do próximo PRD usa o **Δ-vs-baseline como proxy** (computável já no **1º** snapshot) — ver §Gatilho de pivot |
| SM-4 | Zero merge revertido por desalinhamento | contagem de `git revert` / reabertura | ✅ medível |
| SM-5 | Guardrail de cerimônia | nº de PRDs criados para bug/chore/abaixo do limiar (deve ser 0) | ⚠️ **NÃO falseável** — sem campo que registre PRD indevido |
| SM-6 | Suíte confiável | `suiteFull` verde em 100% dos merges | ✅ medível (baseline congelado acima) |
| SM-7 | Tempo até o primeiro "não é isso" | nº de ADRs/branches existentes quando o owner disse isso | ⚠️ **NÃO falseável** — não há registro do evento |

**SM-1, SM-5 e SM-7 não contam como sucesso** — não são falseáveis hoje. Declarar
o contrário venderia métrica sem instrumento.

### Gatilho de pivot (Q10) — condição e desambiguação

**Dois sentidos de "merge" — não confundir:**
- `merge` do **`ADR-INDEX.md`** = *decisão realizada* (o sha do commit que a
  materializou) — convenção local declarada no próprio índice; **não** é merge
  para `main`.
- `merge` da **`SPEC §4.3`** = o evento em que o orquestrador escreve um
  `prd_adr.snapshots[]` — o "snapshot no merge de cada ADR".

**Estado deste PRD (por que o gatilho é condicional aqui):** `snapshots: []`
**e** o `ADR-003` deste PRD já está `merged` no índice (sha `2534930`). Logo, para
**este** `prd_adr`, o SM-3 (Δ `follow_ups` entre snapshots consecutivos)
**nunca será computável** — o ciclo já está fechado e não produzirá dois snapshots.
É um limite **declarado**, não um sucesso.

**Onde o gatilho é falseável:** no **1º merge de ADR do próximo PRD** (o primeiro
`prd_adr.snapshots[]` escrito). **Proxy declarado:** a definição de SM-3 exige
snapshots **consecutivos** (`SPEC §14.1`, linha de SM-3) e só seria computável no
**2º** snapshot; este gatilho mede o **Δ-vs-baseline** — o snapshot novo contra a
referência congelada (`SPEC §14` item 11), não contra o snapshot anterior.
Comparar SM-3 contra o baseline congelado
(`follow_ups = 43` em `2026-10-16`): se o Δ **não** cair, decisão do owner em
≤1 semana entre (i) pivotar para "unidade de verificação" (atacar a causa *drift*)
ou (ii) manter o PRD e cortar o branch/PR por ADR. Alternativa, se o owner quiser
tornar **este** ciclo medível: escrever **um snapshot retroativo** do estado atual
(o baseline) e um segundo no merge do `ADR-003` para `main`. Sem uma dessas duas
condições, o gatilho permanece condicional — não é um dado deste ciclo. Antes do
PAP-12 era **indetectável** (não havia snapshot nem baseline datado) — é por isso
que ele existe.

---

## DoD do PAP-10 — evidência item a item

| Item da DoD | Evidência | Status |
|---|---|---|
| `suiteFull` verde **com** `.spec/prd/**` | §2.1 (350/0 · 372/0 · static EXIT 0 · vendor OK) | ✅ |
| `sdd-checks` 8/8 | §2.3 | ✅ |
| `git diff main -- .opencode/plugins/gate.js harness.config.json` vazio | §3.4 | ✅ |
| `R-NODENY` PASS e `SDD-02` PASS | §2.3 | ✅ |
| `VERIFY.md` com as 3 dimensões | este arquivo | ✅ |
| Regressão `V4`/`V17`/`SDD-01..03`/`R-NODENY`/`RENAME-01` PASS | §2.3 | ✅ |
| **`code-reviewer` invocado, zero 🔴** | §1.4 — **não executável por subagente aninhado** | ⏳ **pendente (handoff)** |
| Sem TODO pendente | §1.2 | ✅ |

## 4. Evidência TDD do guard `NFR-6` (F-1) — RED e GREEN

O teste do `F-1` (describe `PAP-12/NFR-6` em `prd-checks.spec.mjs`) é o **único**
da suíte que lê o `workflow-state.json` **real** (todos os outros usam fixture —
`prd-checks` `type=bug`, `sdd-checks` `writeFileSync(...)`, `gate` `statePath:
"/nonexistent/…"`). Sem ele, renomear `current_phase` no state real não quebrava
nada verde.

**GREEN (state real intacto):**

```console
$ node --test ".opencode/plugins/__tests__/prd-checks.spec.mjs"
▶ PAP-12/NFR-6 — the REAL workflow-state.json preserves the gate-read fields
  ✔ the 4 gate-read keys exist with the expected type + the PAP-12 additive fields
  ✔ discriminates: renaming current_phase in a COPY makes the guard fail
  ✔ discriminates: dropping prd_adr.snapshots makes the guard fail
  ✔ discriminates: a follow_up without created_at makes the guard fail
ℹ tests 117
ℹ pass 117
ℹ fail 0
ℹ skipped 0
```

**RED (o experimento do reviewer: `current_phase` renomeado numa cópia do state
real):**

```console
$ cp workflow-state.json /tmp/ws.bak
$ node -e 'const fs=require("fs");const p="workflow-state.json";const s=JSON.parse(fs.readFileSync(p,"utf8"));s.current_phase_renamed=s.current_phase;delete s.current_phase;fs.writeFileSync(p,JSON.stringify(s,null,2)+"\n")'
$ node --test ".opencode/plugins/__tests__/prd-checks.spec.mjs"
▶ PAP-12/NFR-6 — the REAL workflow-state.json preserves the gate-read fields
  ✖ the 4 gate-read keys exist with the expected type + the PAP-12 additive fields (1.686105ms)
  ✖ discriminates: dropping prd_adr.snapshots makes the guard fail (0.500899ms)
  ✖ discriminates: a follow_up without created_at makes the guard fail (0.576501ms)
✖ PAP-12/NFR-6 — the REAL workflow-state.json preserves the gate-read fields (4.532725ms)
ℹ tests 117
ℹ pass 114
ℹ fail 3
✖ the 4 gate-read keys exist with the expected type + the PAP-12 additive fields
  AssertionError [ERR_ASSERTION]: current_phase must exist and be a string (gate.js:708,727)
$ cp /tmp/ws.bak workflow-state.json   # restaura; numstat volta a "58 1"
```

A renomeação de `current_phase` **derruba 3 testes** (o guard é sequencial: falha
no 1º assert e os 2 negativos também caem) — prova de que o guard **discrimina**,
fechando o furo do `NFR-6`. O arquivo foi restaurado byte-idêntico
(`git diff --numstat -- workflow-state.json` → `58 1`, §Prova de aditividade).

## Resultado Final

```
VERIFY STATUS: **APPROVED** — parecer do `code-reviewer` em 2 rodadas (iteração 1: 1 🔴 F-1 + 4 🟡; iteração 2: **zero 🔴**, "DoD de `code-reviewer` do `PAP-10` SATISFEITO"). O 🔴 e os 🟡 F-2..F-5 e N-1..N-3 foram corrigidos e verificados pelo orquestrador (suíte 352/0; `prd-checks.spec` 119/0; `sdd-checks` 8/8; os 3 checks PASS sobre o artefato real). Seguem como observações não-bloqueantes: N-4 (dois baselines sem ponte), N-5 (checkbox de trailer antecipado) e N-6 (retro-flip de caixas declarado no commit).
  (1 🔴 + 4 🟡 do code review endereçados); re-review do code-reviewer PENDENTE.

Bloqueadores absolutos (build/testes/requisito/vazamento de tenant): NENHUM.

Findings do code review (rodada 1) — todos FECHADOS nesta iteração (§1.5):
- 🔴 F-1: teste do guard NFR-6 (state real) escrito + discriminação provada (§4).
- 🟡 F-2: comando de TODO reproduzível, escopado ao TASKS.md (§1.2).
- 🟡 F-3: número com comando (git diff --numstat = 58 1; PAP-12 = 57 adições).
- 🟡 F-4: gatilho de pivot desambiguado (2 sentidos de merge; próximo PRD).
- 🟡 F-5: rótulo honesto em TASKS.md §2; status deste VERIFY ajustado.

Observações:
- Dimensão 1 (Completude): 109/110 checkboxes; o único item aberto é o parecer do
  `code-reviewer` (§1.4), não executável a partir de um subagente. 0 TODO real.
- Dimensão 2 (Corretude): suiteFull verde COM .spec/prd/** em disco (plugins
  350/0 · installer 372/0 · static EXIT 0); 3 checks PASS sobre o artefato real;
  sdd-checks 8/8.
- Dimensão 3 (Coerência): 5 ADRs mapeados a commit/PAP; gate.js e harness.config.json
  intocados.
- Declarado: SM-1/SM-5/SM-7 não falseáveis hoje (não contam como sucesso); SM-3
  instrumentado mas sem dado — para ESTE prd_adr não é computável (§Gatilho de pivot).
- Declarado: 1 deleção em `git diff --numstat` vs HEAD é a linha `sdd_stage`
  pré-existente do orquestrador, não do PAP-12 (PAP-12 = 0 remoções).
- O parecer final é do `code-reviewer` (handoff §1.4); o `archive` (P5→P6) fica
  condicionado ao re-review e à decisão do owner.
```
