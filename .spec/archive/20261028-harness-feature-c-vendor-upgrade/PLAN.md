# Implementation Plan: harness-feature-c-vendor-upgrade

## 1. Context & SPEC Traceability
- **Target**: `.spec/backend/harness-feature-c-vendor-upgrade/SPEC.md`
- **Goal**: Feature C — vendor NestJS + upgrade path manifest-diff.

## 2. Technical Strategy
- Backend: Node ESM (installer + vendor script). Source-side vendor + installer-side manifest-diff.
- Frontend: N/A.

## 3. Implementation Phases
- Phase 1: Vendor NestJS (source-side).
- Phase 2: Upgrade path manifest-diff (installer-side).
- Phase 3: Testes + validação.

## 4. Critical Execution Path
BE-01 (vendor) → BE-02 (upgrade manifest-diff) → BE-03 (testes) → BE-04 (validação)

## 5. Atomic Task Breakdown

### BE-01
- [x] Vendor NestJS: skills-lock entry, SOURCE_LICENSES, stage, run vendor, update .vendor-lock.json + VENDOR-NOTICE + LICENSE.

### BE-02
- [x] Upgrade path manifest-diff: planUpgrade/applyUpgrade/runUpgrade/buildManifest enhancement.

### BE-03
- [x] Testes: --check verde, suite verde, temp install.

### BE-04
- [x] Validação: suite + static-checks + temp install.
