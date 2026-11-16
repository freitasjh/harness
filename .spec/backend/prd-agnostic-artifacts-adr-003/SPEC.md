# SPEC — prd-agnostic-artifacts-adr-003

> Prescritivo. Origem: `ADR-003` §3 (12 itens). Em conflito, o ADR prevalece. Tipo: governança.

## 1. Requisitos funcionais

- **RF-01 (itens 1, 8)** — `.agents/skills/spec-review/` ausente (0 arquivos) **e** `SKILLS_COMMON` 22 → 21 no **mesmo commit**; `SKILLS_BY_AXIS`/`RULES_BY_AXIS`/`RULES_COMMON`/presets inalterados.
- **RF-02 (item 2)** — `grep -rn 'spec-review' .agents README.md docs` = **0** e `grep -c 'Revisar SPEC' workflow-rules.md` = **1** (o passo sobrevive).
- **RF-03 (itens 3, 4)** — baseline **80 → 38** (34 `incondicional` + 4 `identity`); `spec-review/*` 33 → 0; `PROJECT_TERMS` coerente (2 termos, dono re-apontado).
- **RF-04 (item 5)** — D1: as 2 rules de frontend com **0** `incondicional` e **0** "Atlas ECM"; corpo preservado (`git diff` só nas linhas de heading/identidade).
- **RF-05 (item 6)** — `license:` de `security-review/SKILL.md:4` corrigido; `structural-debt` **1 → 0**; E-6 sai de `EXCEPTIONS`.
- **RF-06 (item 7)** — D8/E-1/E-3 com predicado vivo (`E-1..E-5`), `axis-decl` inalterado; renomear skill de eixo ⇒ `cdl-exception-stale` FAIL.
- **RF-07 (itens 9, 12)** — `harness.config.json`/`seal.mjs`/`commands.suiteFull` sem diff; nenhuma republicação de selo.
- **RF-08 (item 11)** — testes assados atualizados (`cdl.spec.mjs` 80 → 38) no mesmo commit.

## 2. Invariantes

- **I1** — apagar ≠ reescrever: nenhuma linha de conteúdo TaskFlow é transformada em genérica.
- **I2** — disco e lista mudam juntos (`eixos-stack.spec.mjs` nos dois sentidos).
- **I3** — o passo de revisão de SPEC continua existindo, com portão **mecânico**.
- **I4** — baseline só encolhe; nenhuma entrada nova.
- **I5** — zero comando novo em `suiteFull`; selo intacto.

## 3. Edge cases

- E1 — `spec-review` citada em `README.md:15` e `docs/FUNCIONAMENTO.md:134` (prosa): reescrever, não deixar órfã.
- E2 — `spec-gate.md` ainda cita Flyway/JWT (1 entrada, dono ADR-005): **não** é resolvido aqui.
- E3 — `TaskFlow` sobrevive em `developer-engineer:1,25` e `ux-designer:32`: prova re-apontada, dono transferido ao ADR-005.
- E4 — `@rule-axis:*` −5 entradas: as rules de frontend deixam de ser dívida (viram `condicional` por heading).

## 4. Estratégia de teste

| Nível | Comando | Esperado |
|---|---|---|
| Plugins | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 0 falhas |
| Instalador | `node --test "installer/__tests__/*.spec.mjs"` | 559 pass (eixos-stack sente a remoção) |
| Static | `node scripts/static-checks.mjs` | exit 0, `V20` `baseline=38` |
| SDD | `node scripts/sdd-checks.mjs` | 0 FAIL |
| Órfão | `grep -rn 'spec-review' .agents README.md docs` | vazio |

## 5. N/A declarado

Sem backend/frontend/DB: entregável é remoção de payload + prosa + baseline.
