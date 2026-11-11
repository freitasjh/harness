# PROPOSAL — Modo efetivo de um gate vive no env do processo host

> Ciclo: `prd-garantias-runtime` · ADR: `ADR-001` · branch: `adr/prd-garantias-runtime/01-modo-gate-no-env`
> PRD: `.spec/prd/prd-garantias-runtime/PRD.md` §1 (problema), §6 (escopo P1-A), §9 (RF-01, RF-05)
> Decisão do owner (portão G1, 2026-10-22): o rebaixamento passa a viver no env do processo host; `gates.*` no `harness.config.json` volta a ser puramente informativo. Este PROPOSAL não re-decide — implementa.

## 1. Problema (estado atual, com evidência)

O harness permite **desligar o deny de um gate sem tocar em código**: `resolveMode` honra
apenas o literal `"enforce"` e qualquer outro valor — inclusive `"warn"`, `"off"` ou
lixo — cai para `"warn"`, onde o `DenyError` vira log + allow (`gate.js:76-80`,
`gate.js:171-174`). A chave vive em `harness.config.json:38-43`, arquivo gravável por
`bash` — a proteção de path do próprio config é parse de redirect/`tee`, evadível
(`gate.js:949-1004`; `gate-contract.md` I7/I9, 🟠/🔴).

**Medido em 2026-10-22** (sonda com `runGatesShim`): `gates.picco = "warn"` ⇒
`task` sem `<open_questions>` ⇒ **ALLOW** (`via: warn`); `gates.picco = "enforce"` ⇒
**DENY** `picco-tag-absent`.

O custo: um gate de **segurança** (PICCO, path protegido, evidência) pode ser
desligado por edição de arquivo, sem failing test e sem revisão visível. O PRD §13
classifica isso como elevação de privilégio dentro do próprio harness, não chave de
conveniência.

## 2. Escopo

### In scope
- O modo efetivo de um gate passa a ser resolvido **somente** pelo env do processo
  host (`HARNESS_GATE_<GATE>` + `HARNESS_GATE_<GATE>_REASON`).
- `gates.*` no `harness.config.json` deixa de participar da resolução e passa a ser
  lido **apenas para auditoria** (1 WARN por chave ≠ `"enforce"`).
- O rebaixamento, quando em vigor, é **anunciado em log** (nunca silencioso) e exige
  **motivo declarado**.
- Contrato de prosa: `gate-contract.md`, `harness-config.md`, `README.md`,
  `docs/FUNCIONAMENTO.md`.
- Declaração da nova semântica no config gerado pelo instalador (sem alterar a
  forma do config — o golden test continua byte-a-byte igual).

### Out of scope
- O fail-closed do config ausente (é `ADR-002`).
- O schema e o veredito da contraprova (`ADR-003`).
- O check de conformidade da prosa (`ADR-004` — depende da prosa que este ciclo reescreve).
- Qualquer deny novo de runtime, hook novo, ou alteração do `HARNESS_GATES=off`.
- `riskPaths`/`escalateOnRisk` (sem consumidor no runtime — follow-up, PRD §7).

## 3. Impacto arquitetural

| Aspecto | Impacto | Nota |
|---|---|---|
| Núcleo do plugin (backend) | **ALTERADO** | `gate.js`: `resolveMode` sai do contrato; entra `resolveGateMode(gateName, env)`; `modeForGate(gateFn, env)`; `decide()` mantém assinatura e semântica (`gate.js:161-177`) |
| Loader de config (`config.mjs`) | **INALTERADO** | `loadHarnessConfig`/`resolveCommand`/`configGatesDisableEnforcement` não mudam; a auditoria de `gates.*` acontece onde o config é carregado |
| Frontend | **N/A** | não há UI; o `reason` do deny é a interface (PRD §11) |
| Banco / migrações | **N/A** | não há estado persistente; nada a migrar |
| Tenancy | **N/A** | o plugin é single-tenant por definição (roda no host) |
| RBAC / IAM | **N/A** | não há autenticação; a dimensão equivalente é a superfície de bypass (PRD §13) |
| Eventos / fila | **N/A** | o deny é síncrono, no hook `execute.before` |
| Selo do `suiteFull` | **INALTERADO** | `harness.config.json:13-16` e o `sha256` do comando canônico não mudam |
| Conflitos | **ADR-002** toca o mesmo dispatcher (a ordem 1 → 2 evita colisão no mesmo bloco); `ADR-003` toca a contraproveva (disjoint deste ciclo) | |

## 4. Delta preview

| Documento | Tipo | O que muda |
|---|---|---|
| `.agents/rules/gate-contract.md` | **MODIFIED** | rows `RF-01/RF-02` e `KILL` da §1: o config não altera modo; o rebaixamento vive no env + motivo; o `KILL` distingue corte de suíte (env) de rebaixamento de gate (env por gate) |
| `.agents/rules/harness-config.md` | **MODIFIED** | linha da tabela `gates.*` e a seção "Kill-switch": `gates.*` é informativo/auditado; o rebaixamento por gate é env |
| `README.md` | **MODIFIED** | funcionalidade #7: "config nunca desliga" → "o config nunca desliga a suíte; o rebaixamento de um gate vive no env do processo host" |
| `docs/FUNCIONAMENTO.md` | **MODIFIED** | §3 (funcionalidade #7), §4.7 (config/kill-switch/selo), §10 `a7` (status: implementado) |
| `installer/install.mjs` | **MODIFIED** | comentário/semântica declarada de `gates.*` no config gerado — **sem** mudar o formato (golden `installer/__tests__/golden.spec.mjs:40` continua igual) |
| `.opencode/plugins/gate.js` | **MODIFIED** | código (não é doc) — ver SPEC §3 |

## 5. Critérios de sucesso (binários)

| # | Critério | Verificação | Tipo |
|---|---|---|---|
| C1 | Nenhuma chave de `harness.config.json` altera o modo efetivo de um gate | para cada gate de `CORE_GATES`, config com `gates.<chave>` ∈ {`"warn"`, `"off"`, inválido} ⇒ modo efetivo `enforce` (sonda unitária) | funcional |
| C2 | O rebaixamento por env exige motivo e nunca é silencioso | `HARNESS_GATE_PICCO=warn` sem `_REASON` ⇒ modo `enforce` + 1 WARN "motivo ausente"; com `_REASON` ⇒ modo `warn` + 1 WARN contendo gate, env e motivo | funcional |
| C3 | `HARNESS_GATES=off` continua desligando a suíte e precede qualquer resolução de modo | env `HARNESS_GATES=off` ⇒ allow em todas as tools, mesmo com `HARNESS_GATE_PICCO=warn` | funcional |
| C4 | A config `gates.*` não decide mais o modo, mas sua presença não é silenciosa | config com `gates.picco="warn"` ⇒ 1 WARN de auditoria (chave, valor, modo efetivo `enforce`, se é gate registrado) | funcional |
| C5 | Nenhum deny novo, nenhum hook novo, `decide()` com a mesma assinatura e semântica | diff do `gate.js` mostra `decide()` intocado; `node --test ".opencode/plugins/__tests__/*.spec.mjs"` verde | técnico |
| C6 | Suíte completa verde e sem deriva de prosa | `commands.suiteFull` (895 testes) + `scripts/sdd-checks.mjs` 8 PASS + as 4 fontes de prosa com o mesmo alcance do código | técnico |
