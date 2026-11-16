# PLAN — prd-agnostic-artifacts-adr-003

> Execução do ADR-003 na branch `adr/prd-agnostic-artifacts/03-skills-comuns-e-spec-review` (base `f602867`).

## 1. Fases

### Fase 1 — Payload (RF-01, I2)
1. `git rm -r .agents/skills/spec-review/` (5 arquivos).
2. `installer/install.mjs`: remover `'spec-review'` de `SKILLS_COMMON` (22 → 21). **Nada mais** no instalador.

### Fase 2 — Invocação e prosa (RF-02, I3)
3. `workflow-rules.md` (5 sítios: `:205`, `:566`, §0.1/§4): R1 mecânico (`spec-gate` + `commands.suiteFull`) + R2 opcional ("revisor de SPEC **do projeto**").
4. `orchestrator/AGENT.md:43,306`; `sdd-workflow-standard.md:44`; `README.md:15`; `docs/FUNCIONAMENTO.md:134` — sem o id de skill.
5. Preservar contagem dos arquivos tocados; `Revisar SPEC` continua presente.

### Fase 3 — D1, E-6, PROJECT_TERMS (RF-04, RF-05, RF-03)
6. As 2 rules de frontend: headings nomeiam o eixo (`(frontend=vue)`/`(frontend=react)`), identidade "Atlas ECM" sai, corpo intacto.
7. `security-review/SKILL.md:4`: `license:` fora de referência a projeto (SPDX ou remoção); E-6 removida de `EXCEPTIONS`.
8. `vocabulary.txt`: `PROJECT_TERMS` — `Atlas ECM` removido (sem ocorrência viva), `TaskFlow`/`Pulse` com `owner: ADR-005`.

### Fase 4 — Baseline e testes (RF-03, RF-08, RF-06)
9. `BASELINE`: remover 33 de `spec-review/*`, 4 de `security-review`, 5 de `@rule-axis:*` ⇒ **38**.
10. `cdl.spec.mjs`: asserts atualizados (80 → 38; identidade 14/11 → 4/3).
11. `EXCEPTIONS`: E-6 fora; E-1..E-5 com predicado vivo (renomear skill de eixo ⇒ `cdl-exception-stale`).

### Fase 5 — Verificação (RF-07)
12. 5 comandos; `grep -rn spec-review` vazio; `V20` `baseline=38 (34+4)`; `git diff` de `harness.config.json`/`seal.mjs` vazio; trailer `Harness-Gate-Change`.

## 2. Constraint mapping

| Constraint | Onde |
|---|---|
| Apagar ≠ reescrever (I1) | Fase 1 |
| Disco e lista juntos (I2) | Fase 1 itens 1-2 |
| Portão mecânico (I3) | Fase 2 |
| Baseline só encolhe (I4) | Fase 4 |
| Zero comando novo (I5) | Fase 5 |

## 3. Caminho crítico

`F1.1 → F1.2 → F5.12` — remover o dir sem a lista derruba `eixos-stack.spec.mjs:538` (lista→disco).

## 4. Rollback

`git reset --hard f602867`.
