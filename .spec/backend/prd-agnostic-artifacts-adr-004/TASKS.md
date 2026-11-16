# TASKS — prd-agnostic-artifacts-adr-004

> Execução do ADR-004 na branch `adr/prd-agnostic-artifacts/04-referencias-e-design-md` (base `5c13bdf`).

## Microtasks (TDD-ready)

### EP-01
- [x] RC1: reapontar 7 citações prefixadas de `security-standard.md` para a skill `security-review`, com norma internalizada (RF-01).

### EP-02
- [x] RC1 forma nua: 4 ocorrências fora da gramática do `V18` removidas; `grep -rIn "security-standard\.md" .agents` = 0 (RF-03).

### EP-03
- [x] RC2: remover citações das 6 rules Java; dívida PRD-4 + condição de reativação declarada (RF-02).

### EP-04
- [x] RC4: remover 2 citações de `unit-testing-standards` (RF-04).

### EP-05
- [x] RC3: remover 11 linhas de `DESIGN.md` em 3 agentes; dívida PRD-5 (RF-05).

### EP-06
- [x] 9 linhas de `.doc/**` classificadas com dono ADR-005; `exemplo.md` segue em `NON_DEFECT` (RF-06, RF-07).

### EP-07
- [x] N30: detector de link-ref estendido em `lib/refs/checks.mjs` + fixture; `V19 consumer=21` inalterado (RF-08).

### EP-08
- [x] Re-derivar `V18` (~0) e `refs-undetected` (~9, não 0) (RF-09).

### EP-09
- [x] Commit com trailer `Harness-Gate-Change` (RF-10).

### EP-10
- [x] Verificação final: 5 comandos exit 0; `grep -rn "rules/security-standard\.md" .agents` = 0; `grep -rn "DESIGN\.md" .agents/agents` = 0; selo intacto (RF-10).

## Sumário de execução

| Task | Fase | Depende de |
|---|---|---|
| EP-01 | 1 | — |
| EP-02 | 1 | EP-01 |
| EP-03 | 2 | EP-01 |
| EP-04 | 2 | — |
| EP-05 | 3 | — |
| EP-06 | 3 | EP-05 |
| EP-07 | 4 | — |
| EP-08 | 5 | EP-01..EP-07 |
| EP-09 | 5 | EP-08 |
| EP-10 | 5 | EP-09 |

## Exceção EP-03 (review APPROVED)

1 citação de `backend-coding-standards.md` permanece em `dev-planner/SKILL.md:204` — linha **pinada** no `BASELINE` do `lib/cdl/checks.mjs`, módulo fora do escopo deste ciclo. Linha intacta + entrada C2 com `owner: PRD-4` e condição de reativação. `V18 baseline=1` (meta ≤1). Ver ADR §12-N6.
