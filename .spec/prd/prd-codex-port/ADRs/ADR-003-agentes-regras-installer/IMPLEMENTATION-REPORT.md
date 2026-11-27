<!-- scope: adr/ADR-003 -->
# Relatório de implementação — ADR-003

> papél: backend-engineer (eixo node) · data: 2026-11-24 · sem commit/tag

## 1. Tasks (19/19 Done)

| Task | Entrega |
|---|---|
| LAYOUT-01 | `.codex/{agents,hooks,rules}/`, `hooks.json`, `config.toml`; `harness-state.json` runtime |
| AGENTS-01 | 11 `.codex/agents/*.toml`: `name`/`description`/`developer_instructions` reusando `.agents/agents/**` |
| AGENTS-02 | paridade contagem/nomes source↔publicação |
| AGENTSMD-01 | raiz enxuta + `scripts/AGENTS.md`, `harness/AGENTS.md`; override root→cwd |
| AGENTSMD-02 | medição efetiva ≤ 32768 bytes; falha em 32769 |
| AGENTSMD-03 | `.codex/config.toml`: `project_doc_max_bytes=32768` + fallbacks dos `.agents/rules/*.md` |
| SESSIONSTART-01 | `SessionStart` via `command`, `additionalContext` ≤ 2500 tokens |
| INSTALLER-01 | PAYLOAD_DIRS/PAYLOAD_FILES estendidos; manifesto com hashes de `.codex/**` |
| INSTALLER-02 | `.codex/config.toml` criado quando ausente, preservado quando presente |
| INSTALLER-03 | `.codex/harness-state.json` fora do payload |
| INSTALLER-04 | 2ª passada = 0 writes; manifesto byte-igual; doctor re-hasheia |
| PROTECTED-01 | `isPreserved` cobre `.codex/` não-payload; `writeGuarded` via única |
| PROTECTED-02 | `protectedPaths` inclui `.codex/**` e `.codex/harness-state.json` |
| STATEFILE-01 | HMAC-SHA256 + nonce, chave fora do estado, `wx` 0600, rename, lock, `.gitignore` |
| BOOTSTRAP-01 | identidade só do contexto de sessão; `tool_input.agent` ignorado; ausente ⇒ `unknown` |
| RULES-01 | `.codex/rules/default.rules` (Starlark, complementar) |
| SMOKE-01 | validador `scanSecretPatterns`/`assertNoSecrets` sobre `harness/codex-port-smoke.json` |
| DUALRUN-01 | `checkCodexDualRun()` green; `.opencode/**` intacto salvo exceções ADR-002 |
| CHECKS-01 | static/sdd/vendor/acceptance green |

## 2. Evidência (H1/H4/H5)

- **H1** — `node --test ".opencode/plugins/__tests__/*.spec.mjs"` 488/488;
  `node --test "scripts/__tests__/*.spec.mjs"` 292/292 (baseline 225/225 antes do dev;
  29 falhas na fase vermelha, 0 na verde). 0 skips.
- **H4** — paridade 11/11; teto efetivo 4867 bytes somando raiz + chunks;
  state file 0600/HMAC; protectedPaths cross-runtime; idempotência 0 writes; N+1/transação N/A.
- **H5** — nenhuma porta aberta, nenhum `pkill -f`; tmp via `tempScope` + `cleanup()`;
  nenhum órfão deixado em `/tmp` pelos specs novos.
- **A5** — `node scripts/static-checks.mjs` (V6/V6b/V2/V3/V7/V14/V18/PRD-01/ADR-01/ADR-02/V21 OK),
  `node scripts/sdd-checks.mjs` (V4/R-V12/V17/SDD-01/02/03/R-NODENY/RENAME-01 OK),
  `node scripts/vendor-skills.mjs --check` OK,
  `node scripts/acceptance-clean-room.mjs` 14/14,
  `node scripts/check-codex-dualrun.mjs` `ok:true` (77 paths),
  `node scripts/check-codex-inventory.mjs` 11/8/32/7.

## 3. Fontes consultadas (deepsearch)

- Schema de agente custom (campos obrigatórios `name`, `description`,
  `developer_instructions`) — https://developers.openai.com/codex/agent-configuration/subagents — 2026-11-24.
- Descoberta `AGENTS.md` root→cwd, `AGENTS.override.md` primeiro, no máximo um
  arquivo por diretório, e parada silenciosa ao atingir `project_doc_max_bytes`
  (32 KiB default) — https://developers.openai.com/codex/guides/agents-md.md — 2026-11-24.
- `project_doc_fallback_filenames` = lista ordenada de *filenames* (não caminhos
  com `/`) — https://developers.openai.com/codex/config-file/config-sample — 2026-11-24.

## 4. Riscos / limites declarados

1. **`hooks.json` com caminho absoluto**: comando gerado em ADR-002 aponta para o
   checkout de origem. F-07 (sem interpolação de `tool_input`) é atendido; a
   portabilidade para outro target depende de decisão ADR-002 (não alterada).
2. **Schema do smoke report sem deny-list**: `.agents/schemas/**` está fora do
   escopo de escrita deste ADR; a proibição é aplicada pelo validador
   `assertNoSecrets` em `scripts/codex-support.mjs`.
3. **`codex execpolicy check` não executado**: Codex CLI ausente no ambiente;
   `.rules` validado por estrutura (`prefix_rule`/decisões), best-effort A6.
4. **Fail-open**: `PreToolUse`/`PermissionRequest` negam em input inválido/ausente;
   fail-open ocorre apenas em erro inesperado de runtime (`plugin-error-fail-open`),
   conforme F-11/ADR-002 — suíte ADR-002 preservada (488/488).
5. **Arquivos pré-existentes de outros eixos** (`gate.js`, `gate-core.mjs`,
   `harness/acceptance-clean-room.json`, `workflow-state.json`) não foram tocados.
