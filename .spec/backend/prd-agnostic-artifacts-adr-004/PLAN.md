# PLAN — prd-agnostic-artifacts-adr-004

> Execução do ADR-004 na branch `adr/prd-agnostic-artifacts/04-referencias-e-design-md` (base `5c13bdf`).

## 1. Fases

### Fase 1 — SSoT (RF-01, RF-03)
1. RC1: reapontar as 7 citações prefixadas de `rules/security-standard.md` para a skill `security-review`; norma OWASP/ASVS internalizada no corpo citante.
2. Atingir também as **4 ocorrências nuas** (fora da gramática do `V18`): `grep -rIn "security-standard\.md" .agents` ⇒ 0.
3. `security-engineer/AGENT.md` mantém `DEVE seguir` — agora apontando para a skill viva.

### Fase 2 — Java e regra local (RF-02, RF-04)
4. RC2: remover citações das 6 rules de baseline Java; registrar dívida com dono **PRD-4** e condição de reativação quando o eixo backend existir.
5. RC4: remover 2 citações de `unit-testing-standards` (SSoT local em `workflow-rules.md` §5.1/§5.3).

### Fase 3 — DESIGN.md e .doc (RF-05, RF-06, RF-07)
6. RC3: remover 11 linhas de `DESIGN.md` em 3 agentes; dívida PRD-5.
7. 9 linhas de `.doc/**` **classificadas com dono ADR-005** — não remover.
8. `exemplo.md` permanece em `NON_DEFECT`.

### Fase 4 — Detector N30 (RF-08)
9. Estender `lib/refs/checks.mjs` para link-ref `[//]: # (skill)`; fixture nova; `V19 consumer=21` inalterado.

### Fase 5 — Verificação (RF-09, RF-10)
10. Re-derivar `V18`/`V20`; 5 comandos; trailer `Harness-Gate-Change`; selo intacto.

## 2. Constraint mapping

| Constraint | Onde |
|---|---|
| SSoT não removida (I1) | Fase 1 |
| Dívida não apagada (I2) | Fases 2-3 |
| `.doc` com dono (I3) | Fase 3 item 7 |
| N30 não altera consumer (I4) | Fase 4 |
| Zero comando novo (I5) | Fase 5 |

## 3. Caminho crítico

`F1 → F2 → F5` — RC1 antes de RC2, senão a SSoT é arrastada pela limpeza de baseline.

## 4. Rollback

`git reset --hard 5c13bdf`.
