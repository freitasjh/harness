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
Status: done. `.opencode/commands/harness-init.md` (37 l.): recusa estado pré-existente, `--dry-run`, confirmação, apply, doctor; canal para `--suite`/`--unit`.

### CMD-02 — `/harness-update`
Status: done. 40 l.: backup fora do alvo anunciado, plano, confirmação, apply, doctor; canal para `--backup-dir`.

### CMD-03 — `/harness-doctor`
Status: done. 20 l.: somente leitura, exit code + cada FAIL com path, sem corrigir.

### CMD-04 — `.opencode/commands/` no payload
Status: done. Camada copiada no `init`, presente no manifesto e validada pelo `doctor` (ausente/vazia/symlink/arquivo removido ⇒ FAIL). Contrato em `scripts/__tests__/commands.spec.mjs` (frontmatter, `$ARGUMENTS`, ≤40 linhas, ordem plano→confirmação→apply).

### CMD-05 — D1/D2 e encerramento do F2
Status: done. `realpath` no backup (D1) e em `assertNotSource` (D2); init recusa link quebrado; `--dry-run` roda o guard de backup. Parecer do F2: APPROVED, 0 críticos.

## F3 — Fluxo PRD → ADR

### FLOW-01 — `workflow.md` único
Status: done. 220 linhas; absorveu `sdd-workflow-standard.md`; §2.4 traceability; 🟡 nas imperativas sem mecanismo; V17 preservado.

### FLOW-02 — SPEC/TASKS dentro do ADR
Status: done. Coluna `unit` (`adr|legacy`, estrita em minúsculas); `prd_version: 2` força `unit: adr`; ADR legado retrocompatível.

### FLOW-03 — `sdd-compiler` v2
Status: done. Modos ativos `spec-from-adr`/`tasks-from-adr`/`verify`/`archive`; asserts e templates por ADR; `sdd-feedback` alinhado.

### FLOW-04 — Estado enxuto
Status: done. `workflow-state.json` 127.186 → 16.634 bytes (96 → 21 chaves); `workflow-history.jsonl` 76 linhas append-only; 75/75 chaves recuperáveis; idempotente.

### FLOW-05 — SDD-02 layout-aware e docs por símbolo
Status: done. Drift do ADR nomeado pelo estado julga antes do legado; `unit` vem do ledger; 395 citações por linha trocadas por símbolo/seção + guarda `docs-citations.spec.mjs`. Review final: APPROVED.

### FLOW-06 — `follow_ups` vivo exigir `created_at`
Status: open (sugestão do review F3b). `selectFollowUps` mantém `open`/`pending` sem timestamp; reforçar filtro em F4.

## F4 — Agentes

### AGENTS-01 — `orchestrator` ≤ 160 linhas
Status: done. 85 linhas; rotas/HITL/brain/gates sem duplicar política; zero `8080`/`5173`/`mvn`/`taskflow`.

### AGENTS-02 — `frontend-engineer` + `backend-engineer`
Status: done. Cada um com skill de eixo + deepsearch; soma de agentes 976 linhas (≤1100).

### AGENTS-03 — `engineer` substitui `planner`
Status: done. md-only, deepsearch, raiz `.spec/prd/{prd-id}/`; não decide ADR.

### AGENTS-04 — Permissões e roster
Status: done. 11 agentes = 11 diretórios; `KNOWN_AGENTS` e I5 atualizados; ux permanece `edit: deny` com motivo citado no runtime.

### AGENTS-05 — Exceção de escrita protegida pós-rename
Status: done (escrita de governança autorizada). `gate.js` dava a exceção só a `developer-engineer`; sem isso nenhum papel vivo editava rules/agents/plugins. Exceção agora `frontend-engineer|backend-engineer`, com teste de mutação em `protected-write-exception.spec.mjs`.

## F5 — Deepsearch + prompt-optimizer

### SEARCH-01 — Skill `deepsearch`
Status: done. 59 linhas, subordinada à rule always-on; hierarquia de fontes, websearch/webfetch/Context7, citação afirmação—URL—data.

### SEARCH-02 — `prompt-optimizer` v3
Status: done. 174→90 linhas; Stage 0 (brain literal + probe), ledger em `prompt_assumptions[]`, PICCO com citação, Rota A/B e conflito primeiro.

### SEARCH-03 — Fixtures de prompt
Status: done. 10 fixtures (7 Rota B / 3 Rota A); teste cobre contrato e declara que o veredito 7/10 não é executável sem runner de LLM.

### SEARCH-04 — Rubrica do code-reviewer
Status: done. 3 seções + tags `[CRÍTICO]`/`[ARQUITETURA]`/`[MELHORIA]`; permanece parecer (I2/âncora B).

### SEARCH-05 — V6 do teste desacoplada de `type: refactor`
Status: done (F8). `prompt-optimizer.spec.mjs` passa a assertar presença de `type` (string não vazia), não o valor transitório.

## F6 — Frontend/design

### DESIGN-01 — Fim da contradição de frontend
Status: done. Standards 382→12 linhas (skills são donas); shadcn+axios+lucide canônico; zero PrimeVue/Remix/ri-*.

### DESIGN-02 — Skills de design
Status: done. 3 skills criadas; DESIGN.md/tokens portados; matriz de estados + a11y + anti-slop.

### DESIGN-03 — Portar harness-frontend
Status: done. scripts em `.agents/skills/storybook/scripts/` (rede-zero, --dry-run) + templates/tokens em `design-system/`.

### DESIGN-04 — Comandos de UI
Status: done. 36/30/30 linhas; detectam framework; plano→confirmação→apply; `ui-audit` não edita.

### DESIGN-05 — UX sem Pulse
Status: done. ux 309→73 e design-system 101→62; zero Pulse/hex/fonte em prompts; template-* com nota de ilustração.

### DESIGN-06 — `frontend_evidence` no gate
Status: done. `requireFrontendEvidence` antes da contraprova; deny `frontend-evidence-missing`; 5 cenários medidos; campo opcional no schema.

### DESIGN-07 — Dart/Flutter fora do core
Status: done. 22 skills + licenças removidas; lock 25→3; payload 1.789.454 B (≤1.887.437).

### DESIGN-08 — Consistência de estados e validate
Status: done. 9 estados canônicos com `active`; âncora `export const` (comentário não satisfaz); typo corrigido; 7 testes com mutação.

## F7 — Gates e estado

### GATES-01 — `gate-contract` v2
Status: done. FRONT e SEAL 🟠 adicionados; V15/V19/V20 com perda declarada; trust root do selo = scripts/seal.mjs + host + CI.

### GATES-02 — Defaults de config no `init`
Status: done. 4 chaves com constantes nomeadas; probe gera config idêntico ao canônico; doctor OK.

### GATES-03 — Estado compactado
Status: done (F3b). 16,8 KB / 21 chaves + histórico de 76 linhas.

### GATES-04 — always-on único
Status: done. `.agents/rules/always-on.md` 10.309 B como único instructions; 9 rules completas preservadas e indexadas; V4 890/1705, V17 PASS.

## F8 — Aceite e docs

### ACCEPT-01 — `acceptance-clean-room.mjs`
Status: done. A1..A7: bootstrap, esteira, 3 mutações, PICCO/HITL, Completed, FRONT, schema; 12 chamadas reais de gate; anti-vacuidade com tampering.

### ACCEPT-02 — CI de aceite
Status: done. 31 linhas; Node 22; suítes + checks + acceptance em push/PR.

### ACCEPT-03 — Docs enxutos
Status: done. README 98 l., AGENTS 55 l.; detalhe movido para `docs/ref/`; citações por símbolo em docs.

### ACCEPT-04 — Brain e tag
Status: done. Brain de decisões/lições/sessões F0..F8; tag `v2.0.0` criada no branch `v2`.
