# VERIFY — prd-agnostic-artifacts-adr-001

> Verificação de 3 dimensões sobre o ciclo que executa o **ADR-001 do PRD-2** (critério CDL + instrumento `V20`).
> Data: 2026-11-11. Branch: `adr/prd-agnostic-artifacts/01-criterio-cdl-e-instrumento`. HEAD: `26706e0`.

## Veredito: **3/3 PASS — com instrumento declarado heurístico**

| Dimensão | Resultado | Base |
|---|---|---|
| Completude | ✅ PASS | 11/11 microtasks; 5 artefatos; 3 rodadas de predicado documentadas (§2.3, §2.3-bis, §2.3-ter) |
| Corretude | ✅ PASS | 1.093 testes (534 plugins + 559 installer) 0 falhas; 12/12 itens; REPORT schema-válido |
| Coerência | ✅ PASS | `gate.js`/`harness.config.json`/`installer/`/`lib/**` com 0 linhas; selo `c904f1c5` idêntico a `9b754e5`; `V18`/`V19` inalterados |

## 1. Completude

- `TASKS.md`: 11/11 marcadas (+ nota de atualização com os números vivos).
- Artefatos: PROPOSAL (42), SPEC (48), PLAN (42), TASKS (+nota), VERIFY.

## 2. Corretude

| Bloco | Evidência |
|---|---|
| `V20` vivo | `population=228/31661, prescriptions=181 (44/39/17/81), prohibition-cited=39, baseline=96 (81+15), identity=15/12, structural-debt=1, heuristic=true fp=5/90 fn=4/90, vendor-upstream=284/94` |
| Os 6 vetores do §2.3-ter | `é` cópula ⇒ `incondicional` · marcador/heading ⇒ conta · `Sem \`Lombok\`` ⇒ proibição · `Use X com Y` ⇒ `incondicional` (não catálogo) · sem `exports` ⇒ FAIL (fail-closed) · registro datado e `H2` de contrato ⇒ `null` |
| 7 ids | provados por mutação em cópia fora do repo |
| Fonte de eixo | injetada pelo adapter; módulo não importa `installer/` (importável no destino) |
| A-1 / `license` | `security-review/SKILL.md:4` publicado como `structural-debt` com dono **ADR-003**; alarme **não** é escusado pela baseline |
| Selo | `commands.suiteFull` byte-idêntico; nenhum comando novo |

**Suíte:** plugins 534/0 · installer 559/0 · static exit 0 · sdd 0 FAIL · vendor OK.

## 3. Coerência

- **O instrumento diz o que é**: `heuristic=true fp=5/90 fn=4/90`, com o método da amostra declarado no módulo. A rubrica deixou de se vender como determinística — foi a decisão do owner na rodada 3, e é a razão de a baseline ter **subido** (96 contra 92): um número maior aqui significa instrumento mais honesto, não repo pior.
- **Três rodadas de predicado, três contratos** (§2.3 → §2.3-bis → §2.3-ter), cada um com nota de correção. O padrão que emergiu: predicado lexical para prosa sempre tem furo; o valor está em **publicar o erro**, não em fingir que ele não existe.
- **Sem vazamento**: `V18`/`V19` intocados; `V20` é ortogonal aos dois (referência órfã × artefato sem classe × prosa acoplada).
- **Números não fixados no ADR**: N7 declara que o oráculo é a linha do `V20`; ADRs 002–005 devem citar o `detail`, não o parágrafo.

## 4. Traceability

| RF | Task | Onde |
|---|---|---|
| RF-01, RF-05, RF-10 | CD-01, CD-08 | `lib/cdl/checks.mjs` (`classifyLine`, `declaredAxis`, `PROJECT_TERMS`) |
| RF-03, RF-04 | CD-02, CD-04 | `VOCAB`, `missingVocabulary`, fonte injetada |
| RF-02 | CD-03 | `derivePopulation`, `cdl-population-payload-gap` |
| RF-06, RF-07, RF-08 | CD-05, CD-06, CD-07 | `BASELINE`, `EXCEPTIONS`, `prohibition-cited` |
| RF-09, RF-11 | CD-07, CD-09 | `refs-undetected`, adapter `V20`, selo |
| RF-12 | CD-10 | `cdl.spec.mjs` (66 testes) |

**Cobertura: 12/12 RF · 12/12 itens · traceability 100%.**

## 5. Divergências declaradas pelo QA

| # | Fato |
|---|---|
| d1 | `TASKS.md` congelado na rodada 2 — nota de atualização acrescentada |
| d2 | ADR §3 item 4 espera `[]` em `missingVocabulary` (pré-emenda); vivo é fail-closed |
| d3 | item 7 diz `incondicional`; há 15 `identity` (N7) |
| d4 | §4.3 lista E-1..E-4; existem 6 (E-5 vendor, E-6 dívida estrutural) |
| d5 | `workflow-state.json` é corrigido no fechamento (dono: orquestrador) |
| d6 | comando de diff do briefing citava `lib/*` sem o prefixo `.opencode/plugins` — literal passou por vacuidade; a forma corrigida deu 0 bytes |

## 6. Conclusão

As 3 dimensões fecham. O `V20` mede o que se propôs a medir, **com erro declarado**, e a baseline é dívida com dono e prazo — não uma lista de boa vontade. O que sobra (fp/fn, E-6 sem pin) está no contrato como limitação medida. **Apto ao P5→P6.**
