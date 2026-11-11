# TASKS — prd-agnostic-artifacts-adr-001

> Execução do ADR-001 na branch `adr/prd-agnostic-artifacts/01-criterio-cdl-e-instrumento` (base `9b754e5`).

## Microtasks (TDD-ready)

### CD-01
- [x] Criar `.opencode/plugins/lib/cdl/checks.mjs` puro com `classifyLine` (4 vereditos, ordem fixa) e `declaredAxis` (lock → mapa de exclusão → nome da skill → ∅) (RF-01, RF-05, I1, E1).
  - evidência: `grep -c "export function classifyLine" .opencode/plugins/lib/cdl/checks.mjs` ⇒ `1`; `grep -c "export function declaredAxis" …` ⇒ `1`; `node -e 'import(…).then(m=>console.log(m.VERDICTS.join(",")))'` ⇒ `condicional,exemplo,catálogo,incondicional`; `node --test ".opencode/plugins/__tests__/cdl.spec.mjs"` ⇒ `ℹ pass 38 / ℹ fail 0`.

### CD-02
- [x] `VOCAB` derivado (`AXIS_IDS` ∪ tags do lock = 10) e `PROJECT_TERMS`; eixo novo sem vocabulário ⇒ `cdl-axis-vocabulary-missing` (RF-03, RF-10).
  - evidência: `node -e 'import(…).then(m=>console.log(JSON.stringify(m.missingVocabulary())))'` ⇒ `[]`; `Object.keys(STACK_VOCAB).length` ⇒ `10`; fixture que injeta `AXIS_IDS.backend += "svelte"` ⇒ `FAIL cdl-axis-vocabulary-missing: eixo(s) sem vocabulário em STACK_VOCAB: svelte …`.

### CD-03
- [x] `derivePopulation` sobre `git ls-files` (menos `.spec/**`, `__tests__/`, `ui-ux-pro-max/data/**`); superset do payload; `population=N/L` no detail (RF-02, I2, R3).
  - evidência: `node -e 'import(…).then(m=>{const p=m.derivePopulation();console.log(p.files.length,p.lines)})'` ⇒ `228 31661`; `PASS V20: … population=228/31661 … payload=219`; fixture com skill declarada e `.agents/skills/skill-util/__tests__/nota.md` ⇒ `FAIL cdl-population-payload-gap` (o `.md` de fixture fica fora dos globs).

### CD-04
- [x] Fonte de eixo única (import do instalador); `grep -c "V19"` = 0; divergência `axis-decl` × `axis-class` publicada; `cdl-axis-declaration-phantom` como único FAIL da divergência (RF-04, E4).
  - evidência: `grep -c "V19" .opencode/plugins/lib/cdl/checks.mjs` ⇒ `0`; `grep -c "SKILLS_BY_AXIS" …` ⇒ `10`; `PASS V20: … axis-decl=2/2, axis-class=0/1 (skills/rules) …`; fixture `RULES_BY_AXIS['frontend=vue'] = ['fantasma.md']` ⇒ `FAIL cdl-axis-declaration-phantom`.

### CD-05
- [x] `BASELINE` literal (32 `incondicional` + 15 A-1) com `{file,line,sha256,verdict,owner}`; `cdl-baseline-stale` se a linha mudar/fechar (RF-06, I3, R2).
  - evidência: `node -e '…m.BASELINE.every(e=>e.owner&&e.sha256&&e.verdict&&e.file&&e.line), m.BASELINE.length, m.EXCEPTIONS.length'` ⇒ `true 101 4`. **Drift declarado vs ADR §4.2:** a régua implementada mede **86** `incondicional` em **29 arquivos** (ADR mediu 32 em 11) e mantém as **15** linhas identitárias em **12 arquivos** — total **101**, não 47. O delta é de predicado, não de corpus: (a) itens de lista não-citação contam como prescritivos (o ADR §2.3 passo 1c), (b) o gate `label:` só vale quando o rótulo nomeia a stack, (c) proibições citando tecnologia (98/121/167/163 do ADR) saem para `prohibition-cited` por D2, (d) citações de artefato (`` - `rule.md` — descrição ``) são menção, não prescrição. Drift registrado, nunca escondido (PRD §5-M-8).
  - banco de provas: fixture com sha divergente ⇒ `FAIL cdl-baseline-stale: … (linha mudou)`; entrada cuja linha virou `condicional` ⇒ `FAIL … (deixou de ser incondicional: condicional)`; entrada sem `owner` ⇒ `FAIL … (file/line/sha256/verdict/owner)`.

### CD-06
- [x] `EXCEPTIONS` E-1..E-4 com `predicate`/`reason`/`proof` executável; predicate morto ⇒ `cdl-exception-stale` (RF-07, R5, E5).
  - evidência: `grep -c "cdl-exception-stale" .opencode/plugins/lib/cdl/checks.mjs` ⇒ `3`; `PASS cdl-exception-stale: EXCEPTIONS com 4 entrada(s), cada predicado ainda casando e prova viva`; fixture E-2 (linha 13 sem `N/A`) ⇒ `FAIL … E-2: .agents/rules/config.md:13 sem "N/A"`; fixture E-1 (prefixo sem `.md`) ⇒ `FAIL … sem catálogo .md`.

### CD-07
- [x] `prohibition-cited` como contador em PASS; A-3 reusa `V18` e publica `refs-undetected` com dono ADR-004 (RF-08, RF-09, E2).
  - evidência: `PASS V20: … prohibition-cited=44 … refs-undetected=20 (owner ADR-004) …`; `PASS V18: … (baseline=7, non-defect=1)`; proibição não consome veredito: `classifyLine("- NUNCA use Lombok", …)` ⇒ `null` e `prohibitionOf` ⇒ `true`.

### CD-08
- [x] A-1: `PROJECT_TERMS` + 2 alarmes estruturais (`license:` fora de SPDX; termo de stack fora do eixo declarado); `cdl-identity-term-stale` (RF-10, E3).
  - evidência: A-1 medido pelo comando do ADR §3 item 11 ⇒ `12` arquivos / `15` linhas; `PASS cdl-identity-term-stale: PROJECT_TERMS=3 com prova viva; identidade=15 linha(s) em 12 arquivo(s), todas declaradas; license fora de SPDX=0; stack fora do eixo=0`; fixture `license: Foo Security Standard` ⇒ `FAIL … license fora de SPDX`; fixture com prova morta ⇒ `FAIL … proof morta`; fixture de identidade nova ⇒ `FAIL … posição identitária fora da baseline`.

### CD-09
- [x] Adapter `V20` em `scripts/static-checks.mjs` com contadores em PASS e FAIL; `suiteFull`/`seal.mjs` sem diff (RF-01, RF-11, I5, R4).
  - evidência: `git diff --stat -- harness.config.json .opencode/plugins/lib/seal.mjs` ⇒ vazio; `node -e 'console.log(require("./harness.config.json").commands.suiteFull)'` ⇒ `node --test ".opencode/plugins/__tests__/*.spec.mjs" && node --test "installer/__tests__/*.spec.mjs" && node scripts/static-checks.mjs && node scripts/vendor-skills.mjs --check` (inalterado); `node scripts/static-checks.mjs` ⇒ exit `0` com `PASS V20` publicando população/prescrições/proibições/baseline/identidade/axis-decl/axis-class/refs-undetected.

### CD-10
- [x] `cdl.spec.mjs`: 1 fixture por veredito, 2 de ordem, os 2 modos exigidos, preset novo; ≥12 casos (RF-12).
  - evidência: `node --test ".opencode/plugins/__tests__/cdl.spec.mjs"` ⇒ `ℹ tests 38 / ℹ pass 38 / ℹ fail 0`; cobre 4 vereditos, ordem `exemplo>catálogo` e `catálogo>condicional`, e **os 7 ids** por mutação real (ver abaixo).

### CD-11
- [x] Verificação final: 5 comandos exit 0; `PASS V20` com `population`, baseline, contadores; `V18`/`V19` inalterados; commit com trailer se tocar protegido.
  - evidência: plugins `ℹ tests 506 / pass 506 / fail 0`; installer `ℹ tests 559 / pass 559 / fail 0`; `node scripts/static-checks.mjs` exit `0`; `node scripts/vendor-skills.mjs --check` ⇒ `vendor-check OK`; `node scripts/sdd-checks.mjs` exit `0`; `PASS V18 (baseline=7, non-defect=1)` e `PASS V19 (skills=48 … rules=8 …)` idênticos ao HEAD.

## Os 7 ids, provados por mutação (não por fachada)

| id | mutação real da fixture | `FAIL` literal |
|---|---|---|
| `cdl-unconditional-unbaselined` | `.agents/rules/uma.md:2` prescritivo, `baseline: []` | `FAIL cdl-unconditional-unbaselined: 1 linha(s) incondicional fora da BASELINE: .agents/rules/uma.md:2 (- Use JUnit 5 e Mockito)` |
| `cdl-baseline-stale` | entrada com sha de outro texto / linha que virou `condicional` / sem `owner` | `FAIL cdl-baseline-stale: BASELINE com 1 entrada(s) inválida(s)/obsoleta(s): .agents/rules/uma.md:2 (linha mudou)` |
| `cdl-exception-stale` | E-2 apontando linha sem `N/A`; E-1 sem catálogo `.md` | `FAIL cdl-exception-stale: EXCEPTIONS com 1 problema(s): E-2: .agents/rules/config.md:13 sem "N/A"` |
| `cdl-axis-vocabulary-missing` | `AXIS_IDS.backend += "svelte"` | `FAIL cdl-axis-vocabulary-missing: eixo(s) sem vocabulário em STACK_VOCAB: svelte (preset novo escaparia da lista)` |
| `cdl-population-payload-gap` | skill declarada com `__tests__/nota.md` | `FAIL cdl-population-payload-gap: população=2 arquivo(s); artefato propagado fora dos globs: .agents/skills/skill-util/__tests__/nota.md` |
| `cdl-axis-declaration-phantom` | `RULES_BY_AXIS['frontend=vue'] = ['fantasma.md']` | `FAIL cdl-axis-declaration-phantom: mapa de eixo nomeia artefato ausente: RULES_BY_AXIS['frontend=vue'] → fantasma.md` |
| `cdl-identity-term-stale` | `license: Foo Security Standard`; prova morta; identidade fora da baseline | `FAIL cdl-identity-term-stale: A-1: license fora de SPDX: .agents/skills/projeto/SKILL.md:3 (Foo Security Standard)` |

## Sumário de execução

| Task | Fase | Depende de |
|---|---|---|
| CD-01 | 1 | — |
| CD-02 | 1 | CD-01 |
| CD-03 | 2 | CD-01 |
| CD-04 | 1 | CD-01 |
| CD-05 | 3 | CD-03 |
| CD-06 | 3 | CD-01 |
| CD-07 | 3 | CD-05 |
| CD-08 | 3 | CD-02 |
| CD-09 | 4 | CD-05, CD-06 |
| CD-10 | 4 | CD-09 |
| CD-11 | 5 | CD-09, CD-10 |
