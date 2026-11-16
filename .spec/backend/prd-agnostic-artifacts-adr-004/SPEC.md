# SPEC — prd-agnostic-artifacts-adr-004

> Prescritivo. Origem: `ADR-004` §3 (12 itens). Em conflito, o ADR prevalece. Tipo: documentação normativa + detector.

## 1. Requisitos funcionais

- **RF-01 (item 1)** — nenhuma das 7 citações prefixadas de `rules/security-standard.md` permanece; **RC1**: reapontar para a skill `security-review` + norma internalizada no corpo citante; **remover é proibido**.
- **RF-02 (item 2)** — 6 rules Java (`backend-coding-standards` 12, `backend-integration-tests` 4, `backend-unit-tests` 3, `db-migration-flyway` 3, `db-migration-liquibase` 1, etc.) sem citação; dívida com dono **PRD-4** e condição de reativação declarada.
- **RF-03 (item 3)** — **7 prefixadas + 4 nuas** de `security-standard` removidas: `grep -rn "rules/security-standard\.md" .agents` ⇒ 0 **e** `grep -rIn "security-standard\.md" .agents` ⇒ 0.
- **RF-04 (item 4)** — `unit-testing-standards` (2 citações) removido: a SSoT local já é §5.1/§5.3 do `workflow-rules`.
- **RF-05 (item 5)** — `frontend/DESIGN.md`: **11 linhas em 3 agentes** removidas; `grep -rn "DESIGN\.md" .agents/agents` ⇒ 0; dívida com dono **PRD-5**.
- **RF-06 (item 6)** — 9 linhas de `.doc/**` **classificadas com dono ADR-005**, não removidas neste ciclo.
- **RF-07 (item 7)** — `exemplo.md` permanece em `NON_DEFECT` (RC5); `sed -n '68p'` do `harness-installer/SKILL.md` intacto.
- **RF-08 (item 8)** — N30: detector de link-ref estendido em `lib/refs/checks.mjs` + fixture; **`V19 consumer=21` inalterado** antes/depois.
- **RF-09 (itens 9, 10)** — `V18 baseline 7 → ~0` e `refs-undetected 20 → ~9`; 0 não é meta (dívida com dono não some).
- **RF-10 (itens 11, 12)** — selo intacto; nenhum comando novo; 5 suítes exit 0.

## 2. Invariantes

- **I1** — SSoT nunca é removida sem substituto vivo.
- **I2** — dívida com dono não é apagada para "zerar" contador.
- **I3** — `.doc/**` mantém dono ADR-005 (não é órfã muda).
- **I4** — detector N30 não muda a classe `consumer` de skill nenhuma.
- **I5** — zero comando novo em `suiteFull`.

## 3. Edge cases

- E1 — 4 ocorrências **nuas** de `security-standard.md` fora da gramática `rules/[a-z0-9-]+\.md`: só `grep -rIn` as vê.
- E2 — `refs-undetected=9` não é falha; é o estado correto (9 linhas de `.doc/**` com dono).
- E3 — link-ref `[//]: # (skill)` ainda não existe no repo (0 ocorrências), mas o detector tem de cobrir a forma.
- E4 — `spec-review` saiu e levou 14 citações: números do PRD não valem; oráculo é a linha do `V18`/`V20`.

## 4. Estratégia de teste

| Nível | Comando | Esperado |
|---|---|---|
| Plugins | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 0 falhas |
| Refs | `node --test ".opencode/plugins/__tests__/refs.spec.mjs"` | + fixture N30 |
| Instalador | `node --test "installer/__tests__/*.spec.mjs"` | 559 pass |
| Static | `node scripts/static-checks.mjs` | exit 0, `V18` ≈0 |
| SDD | `node scripts/sdd-checks.mjs` | 0 FAIL |

## 5. N/A declarado

Conteúdo do `DESIGN.md` é do PRD-5; reativação de Java é do PRD-4.
