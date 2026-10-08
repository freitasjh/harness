# Tech Debt — falha pré-existente na suite: `state-corrupt` (RESOLVIDO)

- **Status:** RESOLVIDO (fix aplicado 2026-10-07) · aguardando code-review
- **Classificação:** P1 (gate de enforcement fail-closed)
- **Detecção:** Pre-Delegation Gate 2026-10-07 — `commands.suiteFull` = 104/103/1

## Causa raiz REAL (corrige hipótese inicial)
A hipótese inicial ("loader trata ausente e corrompido igual") estava **errada**.
`loadWorkflowState` já distingue ausente (ENOENT⇒allow) de corrompido (parse⇒DenyError `state-corrupt`);
`gatePhaseAnchorB` lança corretamente (verificado isolado).

**Masker real:** `HARNESS_GATES=off` exportado em `~/.profile:33`, herdado pelo processo host.
`HarnessGate` no teste injeta `config` mas não `env` ⇒ herdava o kill-switch e **nunca** chegava ao deny
(ADR-009 curto-circuita antes do gate). O teste media o ambiente do host, não o gate.

## Fix (`.opencode/plugins/gate.js`, 2 hunks)
- `base.env = toolInput?.env ?? (toolInput?.config ? {} : process.env)`.
- `decide({..., env: base.env})`.
- Semântica: config **injetada** = hermenêutica (kill-switch ambiente não desliga); config **de arquivo**
  (runtime) = `env=process.env` (ADR-009 preservado). Sem nova dependência.

## Aceite
- `node --test ".opencode/plugins/__tests__/*.spec.mjs"` → **104/104, 0 fail** (host off e env limpo).
- Teste irmão warn verde (corrupto+warn ⇒ allow+log). `static-checks.mjs` PASS.
- Python: kill-switch no runtime com config de arquivo continua honrado.

## Observação operacional (não bloqueia)
`HARNESS_GATES=off` está setado globalmente no `~/.profile` do host ⇒ enforcement desligado por ambiente.
Registrar para o usuário decidir (ligar/desligar conforme propósito).

## Dono
`developer-engineer` (fix) → `code-reviewer` (veredito).
