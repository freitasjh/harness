# SPEC — prd-agnostic-artifacts-adr-005

> Prescritivo. Origem: `ADR-005` §3 (12 itens). Em conflito, o ADR prevalece. Tipo: governança (frota).

## 1. Requisitos funcionais

- **RF-01 (itens 1, 5)** — rubrica FR0–FR5 publicada; **4 identidades reescritas** (`TaskFlow` ×3, `Pulse` ×1) com `PROJECT_TERMS.proof` re-apontado; `V20 identity 4/3 → 0/0`.
- **RF-02 (item 6)** — `nestjs:81` (Jest) e `node:86` (Vitest) **condicionados por gate no início da linha**; skill permanece no payload (`consumer=21`).
- **RF-03 (item 7)** — `spec-gate.md`: Flyway → alternativa neutra ("Flyway ou Liquibase"), JWT → vocabulário neutro; checklist preservado.
- **RF-04 (itens 3, 8)** — 27 proibições mantidas (D2) com predicado de expiração; `security-review:132` ganha dono explícito sem virar prescrição.
- **RF-05 (itens 4, 7)** — catálogo `ui-ux-pro-max` + 6 skills de stack mantidos (D8/E-3) com predicado vivo e `cdl-exception-stale` como expiração.
- **RF-06 (item 9)** — 9 linhas `.doc/**` **classificadas com dono por linha antes de qualquer remoção**; `refs-undetected → 0` somente com 9 donos.
- **RF-07 (item 10)** — nenhuma dívida apagada sem dono; baseline só encolhe por mudança de classe.
- **RF-08 (item 11)** — `V18 baseline=1` e `V19 skills=47/consumer=21` inalterados.
- **RF-09 (item 12)** — `commands.suiteFull`, `harness.config.json`, `seal.mjs` byte-idênticos; ledger 1:1 com 5 linhas.

## 2. Invariantes

- **I1** — exceção só vive enquanto o predicado casa; "permanente" sem predicado é dívida.
- **I2** — E-3 cobre nome/identidade, **nunca o corpo** — corpo de outro eixo é incondicional até ser condicionado.
- **I3** — dívida se converte, nunca se apaga para zerar contador.
- **I4** — dono por linha antes de remover referência.
- **I5** — zero comando novo no `suiteFull`.

## 3. Edge cases

- E1 — `PROJECT_TERMS["TaskFlow"]` tem `proof` re-apontado; reescrever a linha sem re-apontar ⇒ `cdl-identity-term-stale`.
- E2 — `Jest ∈ node ⊄ {nestjs}` e `Vitest ∈ {vue,react} ⊄ {node}`: E-3 não isenta o corpo.
- E3 — `security-review:132` é `exemplo`, fora da baseline; "resolvê-la" não melhora número nenhum — só falta dono.
- E4 — `refs-undetected=0` sem dono é pior que 9 com dono.

## 4. Estratégia de teste

| Nível | Comando | Esperado |
|---|---|---|
| Plugins | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 0 falhas |
| Instalador | `node --test "installer/__tests__/*.spec.mjs"` | 559 pass |
| Static | `node scripts/static-checks.mjs` | exit 0, `V18=1`, `V19 consumer=21` |
| SDD | `node scripts/sdd-checks.mjs` | 0 FAIL |
| Refs | `grep -rIn "TaskFlow\|Pulse" .agents` | coerente com `PROJECT_TERMS` |

## 5. N/A declarado

Conteúdo de `DESIGN.md` é PRD-5; reativação Java é PRD-4; CI Rust é PRD-3.
