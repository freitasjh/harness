# Architecture & Software Specification — Feature C

## 1. ADRs

### ADR-C1: Vendor NestJS skill (Kadajett)
- **Decision**: vendorizar `nestjs-best-practices` de Kadajett/agent-nestjs-skills, MIT declared-evidence, stacks `['nestjs']`, commit pinado.
- **Context**: fonte upstream viável com licença MIT declarada; skill única compatível com vendor-skills.mjs.
- **Trade-offs**: holder attribution 🟡 processo; upstream pode mudar licença sem alterar treeHash.

### ADR-C2: Rust — sem vendor, skill local
- **Decision**: manter `rust-architecture-specialist` em SKILLS_COMMON (local). Sem vendor.
- **Context**: ausência de fonte generalista adequada.
- **Trade-offs**: qualidade Rust depende do specialist local.

### ADR-C3: Upgrade path manifest-diff
- **Decision**: planUpgrade classifica paths (create/noop/overwrite/merge/flag/delete) usando manifest fileHashes + incoming; backup-first; dry-run; idempotência.
- **Context**: repos instalados precisam receber novos artefatos sem reinstalar tudo.
- **Trade-offs**: complexidade de classificação; fileHashes ausente → flag (fail-closed).

## 2. Functional Requirements

### FR-01: Vendor NestJS
`scripts/vendor/skills-lock.json` MUST conter entrada `nestjs-best-practices` com source `Kadajett/agent-nestjs-skills`, sourceType github, sourceCommit pinado, skillPath `skills/nestjs-best-practices/SKILL.md`, computedHash, stacks `['nestjs']`.

### FR-02: SOURCE_LICENSES
`scripts/vendor-skills.mjs` MUST incluir `Kadajett/agent-nestjs-skills` em SOURCE_LICENSES com SPDX MIT, licenseOrigin declared-evidence, evidence URLs.

### FR-03: .vendor-lock.json regenerado
Pós-vendor, `.vendor-lock.json` MUST conter `nestjs-best-practices` com treeHash, license MIT, licenseFile, stacks `['nestjs']`.

### FR-04: VENDOR-NOTICE
VENDOR-NOTICE MUST listar Kadajett com SPDX + licenseOrigin + evidence.

### FR-05: LICENSE agregado
Arquivo `LICENSE-<slug>` agregado MUST existir com sha256 == expectedLicenseSha.

### FR-06: SKILLS_COMMON
`nestjs-architecture-specialist` MUST ser removido de SKILLS_COMMON (agora vendorizada). `rust-architecture-specialist` permanece (local).

### FR-07: Enumeração bidirecional
`eixos-stack.spec.mjs` MUST atualizar enumeração (remove nestjs specialist de common; vendor skill nestjs-best-practices gated por stacks).

### FR-08: collectIncoming gating
`collectIncoming({stacks:['nestjs']})` MUST incluir nestjs-best-practices; `stacks:['node']` MUST excluir.

### FR-09: planUpgrade manifest-diff
`planUpgrade(prevManifest, incoming, destDir)` MUST classificar cada path como create/noop/overwrite/merge/flag/delete usando manifest fileHashes vs disco vs incoming.

### FR-10: applyUpgrade
`applyUpgrade(plan, ...)` MUST aplicar create/overwrite/merge, flag conflitos, delete (se não modificado), backup-first, dry-run zero writes.

### FR-11: Manifest novo
Manifest pós-upgrade MUST incluir `upgradedFrom`, `removed[]`, `collisions[]`, fileHashes atualizados, `answers` atualizados.

### FR-12: Idempotência
Segunda execução de upgrade MUST resultar em todos `noop`.

### FR-13: Doctor
Doctor MUST validar pós-upgrade (vendor lock, fileHashes) e derivar axes de stack (legado).

### FR-14: V15
Rede em `installer/` permanece zero.

## 3. Invariants
- I1: vendor skills existentes byte-idênticos.
- I2: `--check` verde.
- I3: installer rede-zero (V15).
- I4: licenças apenas SPDX allowlist.
- I5: nenhum symlink no vendor.
- I6: upgrade backup-first, dry-run zero writes, idempotente.

## 4. Delta Specs

| Documento Alvo | Tipo | Seção |
|----------------|------|-------|
| `scripts/vendor/skills-lock.json` | MODIFIED | + nestjs-best-practices |
| `scripts/vendor-skills.mjs` | MODIFIED | SOURCE_LICENSES |
| `.agents/skills/.vendor-lock.json` | REGENERATED | + nestjs-best-practices |
| `.agents/skills/VENDOR-NOTICE.md` | REGENERATED | + Kadajett |
| `.agents/skills/LICENSE-*` | ADDED | novo |
| `installer/install.mjs` | MODIFIED | planUpgrade/applyUpgrade manifest-diff |
| `installer/__tests__/eixos-stack.spec.mjs` | MODIFIED | SKILLS_COMMON enumeração |
| `installer/__tests__/*.spec.mjs` | MODIFIED | upgrade idempotência + conflito |
