# Security Verify — Fase 4.5 — harness-installer-mobile

- **Skill:** `security-review` (Fase 4) · **Data:** 2026-10-08
- **Escopo:** instalação repo→repo em projeto Flutter/Dart; o instalador como vetor + supply chain do vendor.
- **Contraprova de suite:** plugins 104/104 · installer 162/162 · static PASS.

> Os controles de **aplicação** (endpoints, JWT, senha, TLS, headers, rate-limit, v-html,
> Actuator/Swagger, Keychain mobile) são **N/A** — o artefato é um CLI Node que escreve em
> repo alvo. Os controles **aplicáveis** ao modelo de ameaça do instalador estão abaixo.

## Zero-Tolerance (14 itens — adaptado)

| # | Item | Status | Evidência |
|---|---|---|---|
| 1 | Controle de acesso server-side em endpoints | N/A | sem endpoints |
| 2 | Validação server-side de entrada | ✅ equivalente | `validateAnswer` (path dentro do target, comando resolve, pubspec p/ stack mobile) — fail-closed |
| 3 | SQL/JPQL parametrizado | N/A | sem banco |
| 4 | Senhas com Argon2id/bcrypt | N/A | sem auth |
| 5 | JWT RS256/iss/aud/exp | N/A | sem auth |
| 6 | HTTPS/TLS 1.2+ | N/A | sem rede no install (I8/V15=0) |
| 7 | Security headers | N/A | sem HTTP |
| 8 | Zero v-html não sanitizado | N/A | sem frontend |
| 9 | Sem segredos em código/log | ✅ | `deployToken` só memória; `serializeAnswers`/`sanitizeLog` filtram; W3 loga `[REDACTED]`; fixture de segredo |
| 10 | Rate limiting | N/A | sem auth/HTTP |
| 11 | Dependências auditadas | ✅ | install **zero-dep**; vendor de terceiros = 22 skills BSD-3-Clause com proveniência (source+commit+sha) + `--check` fail-closed |
| 12 | Actuator/Swagger protegidos | N/A | sem app |
| 13 | Mobile: tokens Keychain/Keystore, TLS | N/A | instalador não é app mobile |
| 14 | Escrita restrita ao `--target`; backup-first | ✅ | `assertInside`/prefix-check; backup verificado antes de qualquer write (I1); `--dry-run` zero writes |

**Aplicáveis: 5/5 ✅ · N/A justificados: 9**

## Modelo de ameaça (resíduo)

| Ameaça | Risco | Status |
|---|---|---|
| Escrita fora do target | Alto | 🟢 mitigado (fence + dry-run) |
| Backup falha → write prossegue | Alto | 🟢 mitigado (I1) |
| Segredo persistido | Alto | 🟢 mitigado (I5/sanitize) |
| Rede no install | Alto | 🟢 mitigado (V15=0; vendor source-side) |
| Supply chain (skill de terceiro) | Médio | 🟢 mitigado (proveniência + treeHash + `--check`); conteúdo revisado (0 exec/symlink) |
| Licença/atribuição | Médio | 🟢 mitigado (LICENSE agregado + SPDX allowlist) |
| CI wiring do `--check` | Médio | 🟠 parcial → FU-29 (tech-debt) |

## Gaps
- 🔴 Críticos: **0**
- 🟠 Alto: **0** (CI wiring = médio, FU-29)
- 🟡 Médio: **1** — `--check` ainda não no CI (garantia I9 parcial; FU-29)
- 🟢 Baixo: 0

## Verdict
**pass** — 0 críticos; todos os controles aplicáveis satisfeitos; controles de app N/A justificados.
Ressalva única: I9 (drift do vendor) é 🟠 até o wired no CI (FU-29), não bloqueia o archive.
