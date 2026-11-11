# Change Proposal: harness-feature-c-vendor-upgrade

> **ID**: `harness-feature-c-vendor-upgrade`
> **Status**: `Approved`
> **Author**: orchestrator
> **Date**: 2026-10-28
> **Source**: Feature C — vendor skills NestJS/Rust upstream + upgrade path

---

## 1. Problem Statement

Repos instalados com harness anterior não recebem novas skills vendorizadas (nestjs-best-practices) nem atualizações de artefatos. Upgrade path atual (planUpgrade/applyUpgrade) só trata incoming presentes; não detecta remoções nem modificações do usuário. Rust não tem fonte upstream adequada.

- **Contexto**: `scripts/vendor-skills.mjs`, `.agents/skills/.vendor-lock.json`, `installer/install.mjs` (planUpgrade/applyUpgrade/runDoctor/buildManifest).
- **Impacto atual**: destinos nestjs não recebem best-practices; upgrades manuais ou reinstalação completa.
- **Evidência**: análise architect + product-manager.

## 2. Proposed Solution

**Resumo**: (A) Vendorizar NestJS (Kadajett) como `nestjs-best-practices` (stacks `['nestjs']`), manter Rust como skill local; (B) Implementar upgrade path manifest-diff (create/overwrite/merge/flag/delete) com backup-first, dry-run, idempotência.

**Abordagem**:
- A: adicionar entrada em `scripts/vendor/skills-lock.json` + `SOURCE_LICENSES` (MIT declared-evidence) + rodar vendor source-side + regenerar lock/NOTICE.
- A: remover `nestjs-architecture-specialist` de SKILLS_COMMON (passa a ser vendorizada) — manter `rust-architecture-specialist` em COMMON (local).
- B: `planUpgrade` classifica paths (create/noop/overwrite/merge/flag/delete) usando manifest fileHashes + incoming.
- B: `applyUpgrade` trata delete + flag; backup-first; dry-run zero writes.
- B: manifest novo com `upgradedFrom`, `removed[]`, `collisions[]`, fileHashes.
- B: Doctor derivação + validação pós-upgrade.
- B: testes idempotência + conflito.

**Alternativas descartadas**:
- Vendorizar Rust (sem fonte adequada).
- Reinstalação completa (quebra customizações).
- Overwrite sem backup (risco de perda).

## 3. Scope

### In Scope
- [x] Vendor NestJS (Kadajett) — source-side.
- [x] Atualizar .vendor-lock.json + VENDOR-NOTICE + LICENSE.
- [x] Remover nestjs-architecture-specialist de SKILLS_COMMON (enumeração).
- [x] Upgrade path manifest-diff (planUpgrade/applyUpgrade).
- [x] Doctor validação pós-upgrade.
- [x] Testes idempotência + conflito.

### Out of Scope
- Vendor Rust (manter local).
- Gating positivo backend specialist por eixo (tech debt).
- Combos *+vue.
- Mudanças em gate.js.
- Dogfood em repo externo.

## 4. Architecture Impact

| Aspecto | Impacto | ADR Necessário? |
|---------|---------|-----------------|
| Backend (vendor) | scripts/vendor/skills-lock.json, vendor-skills.mjs SOURCE_LICENSES | ADR-C1 |
| Backend (installer) | planUpgrade/applyUpgrade manifest-diff, buildManifest | ADR-C3 |
| Frontend | N/A | Não |
| Licença | declared-evidence MIT (Kadajett) | ADR-C1 |

## 5. Delta Preview

| Documento Alvo | Tipo | Seção |
|----------------|------|-------|
| `scripts/vendor/skills-lock.json` | MODIFIED | + nestjs-best-practices |
| `scripts/vendor-skills.mjs` | MODIFIED | SOURCE_LICENSES +Kadajett |
| `.agents/skills/.vendor-lock.json` | REGENERATED | + nestjs-best-practices |
| `.agents/skills/VENDOR-NOTICE.md` | REGENERATED | + Kadajett |
| `.agents/skills/LICENSE-mit-kadajett` (ou similar) | ADDED | novo |
| `installer/install.mjs` | MODIFIED | planUpgrade/applyUpgrade manifest-diff, buildManifest |
| `installer/__tests__/*.spec.mjs` | MODIFIED | upgrade idempotência + conflito |
| `installer/__tests__/eixos-stack.spec.mjs` | MODIFIED | SKILLS_COMMON enumeração (remove nestjs) |

## 6. Risk Assessment

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Licença declared-evidence (holder attribution) | Média | Médio | Pin commit + evidence URLs + revisão periódica |
| Upstream muda estrutura | Baixa | Médio | computedHash fail-closed |
| Upgrade overwrite clobber | Média | Alto | Backup-first; fileHashes ausente → flag (fail-closed) |
| Delete de skill por gating | Baixa | Médio | Só paths do manifest; nunca dirs não rastreados |
| Rust gap (sem best-practices) | — | Baixo | Skill local aceitável |

## 7. Success Criteria
- [ ] `scripts/vendor/skills-lock.json` contém nestjs-best-practices (stacks ['nestjs']).
- [ ] `vendor-skills.mjs --check` verde.
- [ ] `.vendor-lock.json` contém nestjs-best-practices.
- [ ] VENDOR-NOTICE lista Kadajett (MIT, declared-evidence).
- [ ] nestjs-architecture-specialist removido de SKILLS_COMMON; enumeração verde.
- [ ] Upgrade path: create/noop/overwrite/merge/flag/delete classificados.
- [ ] Backup-first, dry-run zero writes, idempotência.
- [ ] Suite + static-checks verdes.
- [ ] Doctor validação pós-upgrade.

## 8. Completion Metadata
- **Archived on**: —
- **Duration**: —
- **Archive path**: —
- **Files changed**: —
