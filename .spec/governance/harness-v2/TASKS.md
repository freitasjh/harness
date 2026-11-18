# TASKS — Harness v2

Ciclo: `harness-v2` · Branch: `v2` · Base: `SPEC.md`
Status: `done` · `done-pending` · `open` · `blocked`

## F0 — Baseline

### BASELINE-01 — Tag v1.0 e branch v2
Status: done. Tag `v1.0` em `381b5e0`; branch `v2` ativa.

### BASELINE-02 — Suíte completa registrada
Status: done. 540 plugins + 1.091 instalador, 0 falhas (`.spec/governance/harness-v2/baseline-v1.md`).

### BASELINE-03 — Diretório de comandos confirmado
Status: done. `.opencode/commands/` (plural) canônico, legado singular também descoberto.

### BASELINE-04 — Inventário do instalador
Status: done. 149 arquivos / 25.372 linhas / 403 MB de `target/`.

## F1 — Remover instalador

### SYNC-01 — Apagar árvores do instalador
Status: done. `installer/`, `installer-rs/`, `packaging/`, skill `harness-installer`, `docs/INSTALACAO.md` (173 arquivos, 32.088 linhas).

### SYNC-02 — `scripts/harness-sync.mjs`
Status: done. `init|update|doctor`, manifesto sha256, backup, `--dry-run`, `--suite/--unit`.

### SYNC-03 — `scripts/seal.mjs`
Status: done. Sela todas as chaves de `commands` (contrato simétrico do `verifySeal`).

### SYNC-04 — Testes do sincronizador
Status: done. 72 testes em `scripts/__tests__/sync.spec.mjs` + 8 em `roster-parity.spec.mjs` (80 no total).

### SYNC-05 — Rewiring
Status: done. `harness.config.json` v2 (`targets`), `static-checks`, `refs`, CI, README, 4 rules, VENDOR-NOTICE.

### SYNC-06 — Sucessores de V15/V19/V20
Status: done. `NET-01` (rede nos scripts do caminho de instalação) e `V21` (roster↔disco); CDL declarado em tech-debt.

### SYNC-07 — Correções do review #1
Status: done. C1 symlink (`assertSafeWrite`; SYNC-07 em `sync.spec.mjs`), C2 declaração honesta (223/30.373 no momento da remoção; baseline 0, não 96), C3 init recusa `.opencode/**` (SYNC-01). A1 `brainWarning` (SYNC-06); A2 `NET-01` (SYNC-09); A3 `assertNotSource` (SYNC-07); A4 backup fora do target (SYNC-04); A5 suite nula no init (SYNC-02); A6 `writeAtomic` + re-hash no doctor (SYNC-06); A7 órfãos reportados (SYNC-08); A8 `sweepOrphans` removido; M1–M7 em `workflow-rules`, `refs`, `FUNCIONAMENTO`, `README` e `sync.spec.mjs`.

### SYNC-10 — Correções do review #2
Status: done. N1 escrita atômica do `harness.config.json` dentro do guard; N2 órfão preservado no manifesto; N3 guarda de suite compartilhada com `update`; N9 manifesto ausente recriado; N4 número honesto; N5 controle positivo do `NET-01`; N7 backup atômico e validado.

### SYNC-08 — Re-review do batch de correção
Status: done. Parecer #5: APPROVED, sem crítico; libera F2. Débitos D1/D2/D3 em `.spec/tech-debts/harness-v2-path-identity/TASKS.md`.

### SYNC-11 — Fechamento do review (R-1/R-2 + via única)
Status: done. `writeGuarded` como única via; `wx` no tmp; `lstat` no doctor; `assertNoLinkInPath`; WARN de config inválido; 80 testes de `scripts`.

### SYNC-09 — Reexportar selo do host
Status: open. `commands.suiteFull` mudou; operador roda `eval "$(node scripts/seal.mjs --env)"`.

## F2 — Comandos

### CMD-01 — `/harness-init`
Status: open. Detecta, mostra plano, confirma, aplica; sem wizard.

### CMD-02 — `/harness-update`
Status: open. Backup fora do target, diff por hash, órfãos reportados.

### CMD-03 — `/harness-doctor`
Status: open. Somente leitura; falha nomeando path.

### CMD-04 — `.opencode/commands/` no payload
Status: open. Camada hoje listada no payload e ausente na origem; entra com F2.

## F3 — Fluxo PRD → ADR

### FLOW-01 — `workflow.md` único
Status: open. Discovery → PRD → RESEARCH → ADR-INDEX → ADR → SPEC/TASKS → impl → verify → archive.

### FLOW-02 — SPEC/TASKS dentro do ADR
Status: open. `ADR-01`/`ADR-02` exigem `ADR.md` + `SPEC.md` + `TASKS.md` no diretório do ADR.

### FLOW-03 — `sdd-compiler` v2
Status: open. Modos `spec-from-adr`, `tasks-from-adr`, `verify`, `archive`; sai PROPOSAL por feature.

### FLOW-04 — Estado enxuto
Status: open. `workflow-state.json` ≤ 20 KB + `workflow-history.jsonl`.

## F4 — Agentes

### AGENTS-01 — `orchestrator` ≤ 160 linhas
Status: open. Sem hardcode de porta, stack ou TaskFlow.

### AGENTS-02 — `frontend-engineer` + `backend-engineer`
Status: open. Remove `developer-engineer`; cada um carrega skill de eixo + deepsearch.

### AGENTS-03 — `engineer` substitui `planner`
Status: open. md-only, deepsearch, rubric CRÍTICO/ARQUITETURA/MELHORIA; não decide ADR.

### AGENTS-04 — Permissões e roster
Status: open. `.spec/**` only para PM/architect/engineer/ux; `KNOWN_AGENTS` do `gate.js`; linha I5.

## F5 — Deepsearch + prompt-optimizer

### SEARCH-01 — Skill `deepsearch`
Status: open. Fonte + data obrigatórios; API de memória proibida para assinatura.

### SEARCH-02 — `prompt-optimizer` v3
Status: open. Probe de repo + brain antes do score; ledger de premissas; PICCO com `arquivo:linha`.

### SEARCH-03 — Fixtures de prompt
Status: open. ≥7/10 Rota B na primeira; 3 vagos continuam bloqueados.

## F6 — Frontend/design

### DESIGN-01 — Fim da contradição de frontend
Status: open. React e Vue viram skills por eixo; regra always-on só aponta.

### DESIGN-02 — Skills de design
Status: open. `design-system`, `storybook`, `frontend-quality`.

### DESIGN-03 — Portar harness-frontend
Status: open. `init.mjs`, `build-tokens.mjs`, `validate.mjs`, `DESIGN.md` + adapter Vue.

### DESIGN-04 — Comandos de UI
Status: open. `ui-bootstrap`, `ui-audit`, `ui-review`.

### DESIGN-05 — UX sem Pulse
Status: open. `ux-designer` e `design-system-specialist` leem tokens/`DESIGN.md` do destino.

### DESIGN-06 — `frontend_evidence` no gate
Status: open. `stories[]`, `screenshots[]`, `a11y` obrigatórios quando `targets.frontend` ≠ null.

### DESIGN-07 — Dart/Flutter fora do core
Status: open. 22 skills saem do payload; vendor sob demanda.

## F7 — Gates e estado

### GATES-01 — `gate-contract` v2
Status: open. Sem referências ao instalador; selo 🟠 declarado.

### GATES-02 — Defaults de config no `init`
Status: open. `gates`, `mcp.required`, `contraproveTimeoutMs`, `moduleMap`.

### GATES-03 — Estado compactado
Status: open. Migração de chaves aditivas para histórico.

## F8 — Aceite e docs

### ACCEPT-01 — `acceptance-clean-room.mjs`
Status: open. init → PRD → 2 ADRs → SPEC/TASKS → FE/BE → gates.

### ACCEPT-02 — CI de aceite
Status: open. `harness-acceptance.yml` em PR para `v2`.

### ACCEPT-03 — Docs enxutos
Status: open. README/AGENTS ≤ 150 linhas; `docs/ref/`.

### ACCEPT-04 — Brain e tag
Status: open. `brain_store` de decisões/sessão; tag `v2.0.0`.
