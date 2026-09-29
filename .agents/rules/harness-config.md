# harness-config — project data for the harness (descriptive policy, not enforcement)

`harness.config.json` is the single source of project data: commands,
paths, ports, risk surfaces, gate modes. Gates read it; rules and
plugins never hardcode its values (SPEC ADR-003). Enforcement lives in
`gate.js` (Batch 4) and the CI job (step 0); this file only describes.

## Key map (every key exists in SPEC §5.1; values reflect THIS repo)

| Key | Value in this repo |
|---|---|
| `version` / `project` | `1` / `"harness"` |
| `stack.backend` / `stack.frontend` | `N/A` with inline justification — this repo has no Java/Maven backend and no Vue/Vite frontend; the runtime is Node ESM (opencode plugins). No build command from another project was copied here; that was the original sin this config fixes. |
| `moduleMap` | real paths: plugins, rules, schemas |
| `commands.suiteFull` | canonical contraprova command: node tests + static checks |
| `commands.unit` | node tests only |
| `infra` | nulls — no compose file, no local servers in this repo (E2E targets consumers via MCP) |
| `mcp.required` | `["chrome-devtools"]` (SPEC §5.1; RF-06) |
| `protectedPaths` | canonical list, identical to SPEC ADR-007 |
| `gates.*` | informative/audited only — see below |
| `riskPaths` / `escalateOnRisk` | identical to SPEC §5.1; a change touching a risk path escalates `e2eGreenfield` to `enforce` and requires E2E evidence of the affected flow |
| `contraproveTimeoutMs` | identical to SPEC §5.1; re-execution past this timeout is a `contraprove-timeout` deny (ADR-002) |
| `evidence` | `harness/` + report schema path |

## Fail-closed (RF-01/RF-02)

Missing or invalid config ⇒ every gate fails closed with a clear
message (never a crash). Canonical commands resolve from the config,
never from prose. Covered by `config-loader.spec.mjs`.

## Kill-switch (ADR-009)

`gates.*` does NOT switch anything off. The only kill-switch is the
host-process env `HARNESS_GATES=off`. Covered by test
(`configGatesDisableEnforcement` always false).

## Command seal (ADR-002, U6=b)

`suiteFull` is sealed: `.opencode/plugins/lib/seal.mjs` exposes
`sha256` / `sealCommands` / `verifySeal`. `gate.js` (Batch 4, GATE-01)
embeds the published seal and compares it at runtime against the value
read from the config; divergence ⇒ `DenyError sealed-command-mismatch`.
Seal behavior is covered by `seal.spec.mjs` (confere/diverge).

## Static checks (TST-02)

Run locally and in CI with the same command:

```sh
node scripts/static-checks.mjs
node --test ".opencode/plugins/__tests__/*.spec.mjs"
```

V2/V3/V7 scan the files owned by Batch 2 and must read zero. Tooling
(`scripts/`, `__tests__/`) is excluded from the scan — it names the
forbidden patterns as test data. Pre-existing hits in the legacy
plugins are reported as INFO with owner DOC-02 (Batch 7), never as
green. V12 reports live-code refs as INFO; the fusion landed in DOC-02 and
is enforced as FAIL (R-V12 in `scripts/sdd-checks.mjs`). V14 FAILs honestly with `REMOTE_URL_PENDING` while no
git remote exists — that is the declared state, not a masked one.
