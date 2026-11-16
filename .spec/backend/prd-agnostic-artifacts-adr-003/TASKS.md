# TASKS — prd-agnostic-artifacts-adr-003

> Execução do ADR-003 na branch `adr/prd-agnostic-artifacts/03-skills-comuns-e-spec-review` (base `f602867`).

## Microtasks (TDD-ready)

### EC-01
- [x] `git rm -r .agents/skills/spec-review/` (5 arquivos) e remover `'spec-review'` de `SKILLS_COMMON` (22→21) no **mesmo commit** (RF-01, I2).

### EC-02
- [x] `workflow-rules.md`: R1 mecânico (`spec-gate` + `commands.suiteFull`) nos 5 sítios; `Revisar SPEC` preservado (RF-02, I3).

### EC-03
- [x] `orchestrator/AGENT.md:43,306`, `sdd-workflow-standard.md:44`, `README.md:15`, `docs/FUNCIONAMENTO.md:134` sem o id de skill; `grep -rn spec-review` = 0 (RF-02, E1).

### EC-04
- [x] As 2 rules de frontend: heading nomeia o eixo, "Atlas ECM" sai, corpo intacto (RF-04, E4).

### EC-05
- [x] `security-review/SKILL.md:4`: `license:` sem referência a projeto; E-6 fora de `EXCEPTIONS`; `structural-debt` 1→0 (RF-05).

### EC-06
- [x] `vocabulary.txt`: `PROJECT_TERMS` coerente (2 termos, `owner: ADR-005`) (RF-03, E3).

### EC-07
- [x] `BASELINE` 80→38 (33 `spec-review` + 4 `security-review` + 5 `@rule-axis`); 19 chaves restantes byte-idênticas (RF-03, I4).

### EC-08
- [x] `cdl.spec.mjs`: asserts 80→38 e identidade 14/11→4/3; E-1..E-5 com predicado vivo (RF-06, RF-08).

### EC-09
- [x] Commit com trailer `Harness-Gate-Change` (5 paths protegidos) (RF-07).

### EC-10
- [x] Verificação final: 5 comandos exit 0; `V20 baseline=38 (34+4)`; `grep -rn spec-review` vazio; `git diff` de `harness.config.json`/`seal.mjs` vazio (RF-07).

## Sumário de execução

| Task | Fase | Depende de |
|---|---|---|
| EC-01 | 1 | — |
| EC-02 | 2 | EC-01 |
| EC-03 | 2 | EC-02 |
| EC-04 | 3 | — |
| EC-05 | 3 | — |
| EC-06 | 3 | EC-04 |
| EC-07 | 4 | EC-01, EC-04, EC-05 |
| EC-08 | 4 | EC-07 |
| EC-09 | 4 | EC-01..EC-08 |
| EC-10 | 5 | EC-09 |
