# VERIFY — prd-installer-rust-adr-002

> Verificação de 3 dimensões sobre o ciclo que executa o **ADR-002 do PRD-3** (oráculo de paridade).
> Data: 2026-11-16. Branch: `adr/prd-installer-rust/02-oraculo-paridade-impl`.

## Veredito: **3/3 PASS** — rito assinado pelo owner

| Dimensão | Resultado | Base |
|---|---|---|
| Completude | ✅ PASS | 11/11 microtasks; 5 artefatos; rito completo (QA mediu → owner aprovou → orquestrador registrou) |
| Corretude | ✅ PASS | 1.178 testes (540 + 638), 0 falhas; 15/15 itens; 6 predicados SI com mutação |
| Coerência | ✅ PASS | selo `c904f1c5` intacto; oráculo externo; `9+2` medição, `12/12` meta |

## 1. Completude

- `TASKS.md`: 11/11 marcadas.
- **Rito (ADR §2.4)**: QA preparou a rubrica e mediu sem assinar (`selfReported:false`); owner aprovou o sha do **arquivo de literal** `9fa4530bbe0d…`; orquestrador gravou:
  `Veredito: validated literal 9fa4530b… <ISO-8601> c63e333`.
- Distinção que o review forçou: assinar o sha da **origem** (`17a704c3…`) não prova nada; assinar o sha do **arquivo** (`9fa4530b…`) prova, e 1 byte mutado reprova.

## 2. Corretude

| Predicado | Estado | Prova |
|---|---|---|
| SI-1 config byte-equal | **medido/pass** | `golden.spec.mjs` 42/42; oráculo íntegro |
| SI-2 payload | **`not_measured`** | depende do binário Rust do ADR-003 — não existe ainda |
| SI-3 dry-run 0 writes | **`not_measured`** | idem; predicar PASS agora seria green falso |
| SI-4 transcript | **medido/pass** | 5 marcadores W0..W7/W2m |
| SI-5 checks/manifesto | **medido/pass** | V18/V19/V20 + specs de checks |
| SI-6 sem invenção | **medido/pass** | 2 paths protegidos, ambos declarados no ADR-001 |

**Mutações que derrubam** (QA): 1 byte do literal ⇒ `assertLiteralMatchesSource` lança; assinar sha da origem ⇒ `literalProven:false`; 1 mapa da registry corrompido ⇒ `digest divergente: AXIS_IDS`.

**Correções do review (F1–F6)**: `isLiteralProven(report, expectedLiteralSha)` lido do disco; driver `runParity` com `not_measured` explícito; `canonicalJson` para SI-1/SI-2 (não `!==`); `si3` com `porcelain` obrigatório e hash de **conteúdo** (`find -type f -print0 | sort -z | xargs -0 sha256sum`); REPORT ancorado no SHA entregue.

**Suíte:** plugins 540/0 · installer 638/0 · static exit 0 · sdd 0 FAIL · vendor OK · `--run-parity` com `literalProven:true`.

## 3. Coerência

- **Oráculo externo**: `git show c63e333:` — anterior ao sujeito, imutável por escrita, legível sem executar Rust. Proveniência `git-object:c63e333`; sha do blob `17a704c3…`.
- **Anti-tautologia**: `EXPECTED_STACKS` é literal escrito à mão; nenhum caminho regera o oráculo a partir do mecanismo sob teste.
- **Driver lê a assinatura do REPORT por default** (correção pós-assinatura): sem `--verdict`, `--run-parity` agora encontra `validationVerdict` em `harness/prd-installer-rust-adr-002.json`. Antes o oráculo executável ignorava a prova registrada — defeito de rito, não de conteúdo, corrigido e medido (`literalProven:true`).
- **Selo intacto**: `commands.suiteFull` byte-idêntico; nenhum comando novo.

## 4. Traceability

| RF | Task | Onde |
|---|---|---|
| RF-01, RF-02, RF-10 | PO-01..PO-03 | `installer/parity-oracle.mjs` |
| RF-03, RF-11, RF-12 | PO-04, PO-05, PO-10 | rito + assinatura no REPORT |
| RF-04..RF-09 | PO-06..PO-10 | 6 predicados SI |
| RF-13 | PO-11 | suíte + selo |

**Cobertura: 13/13 RF · 15/15 itens · traceability 100%.**

## 5. Ressalvas

| # | Item |
|---|---|
| — | SI-2/SI-3 `not_measured` até o ADR-003 (motor Rust) |
| — | `9+2` é medição; `12/12` só com comando re-derivável (medido 115/115 nos specs) |
| — | Ponte `D1-two-motors` do ADR-001 ainda expira no ADR-003 |

## 6. Conclusão

As 3 dimensões fecham com o rito completo: quem mediu não assinou, quem assinou foi o owner, quem registrou foi o orquestrador. O mecanismo de paridade existe e falha fechado onde não pode medir. **Apto ao P5→P6.**
