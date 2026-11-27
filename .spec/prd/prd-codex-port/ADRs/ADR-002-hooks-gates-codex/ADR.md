# ADR-002 — Hooks e gates no Codex (PreToolUse, reason codes, kill-switch)

- **prd-id**: `prd-codex-port` — `.spec/prd/prd-codex-port/PRD.md` (§16 **APROVADO** em 2026-11-19 pelo owner).
- **order**: 2 de 3 (`.spec/prd/prd-codex-port/ADR-INDEX.md`).
- **status**: `todo` — decisão redigida; `SPEC.md`/`TASKS.md` gerados; implementação (CORE-01..SMOKE-01) concluída e revisada (APPROVED).
- **branch**: `adr/prd-codex-port/02-hooks-gates-codex`.
- **data**: 2026-11-19.
- **depende-de**: ADR-001 (inventário/contrato de paridade).
- **dono da decisão**: owner do harness.
- **insumo de pesquisa**: `RESEARCH.md` D1, D2, D4, D7, D8 (2026-11-19).

## Decisão

Portar a lógica de `gate.js` para hooks Codex via **adapter fino reusando o núcleo puro** de `gate.js` (D1-A): extrair funções puras (reason codes, `DenyError`, modos) para módulo compartilhado; criar adapter `.codex/hooks/pre_tool_use.*` (Node) que lê o evento Codex de stdin, monta o `ctx` equivalente, executa os gates e emite o deny JSON ou exit 2. Adotar o **híbrido** hooks (gates/reason codes) + `.rules` (Starlark, sandbox de comandos) (D2-C), com `.rules` complementar e experimental. Persistência de estado via **arquivo** (D4-A); transporte por `command` (D7-A); matcher amplo para tools locais (D8-A); limitação de `spawn_agent` documentada como best-effort (issue #49736).

Kill-switch: `HARNESS_GATES=off` ⇒ saída antecipada no adapter com log de bypass, sem negar (A3).

## Motivo

Reescrever standalone (D1-B) duplica reason codes e viola A2 (paridade). `.rules` sozinho (D2-A) não emite reason codes do harness nem cobre tools não-shell. Env (D4-C) não propaga entre processos (inviável para HITL batch). `mcp_tool` (D7-B) exige servidor em execução (porta/rede — viola aceite). Apenas hooks cobre os gates com paridade; `.rules` complementa o sandbox nativo.

## Alternativas descartadas

- **Reescrita standalone (Python/Node)** — D1-B: drift de reason codes, dobra manutenção. Descartada.
- **Apenas `.rules` (Starlark)** — D2-A: sem reason codes, experimental. Descartada como substituto.
- **Apenas hooks (sem `.rules`)** — D2-B: perde controle nativo de sandbox. Aceita parcialmente, promovida a híbrido (D2-C).
- **Adapter + scripts dedicados para deny simples** — D1-C: aumenta superfície de bypass. Descartada como padrão.
- **Estado em tmp / env** — D4-B/C: não sobrevive entre sessões / não propaga. Descartadas para governança.
- **Transporte `mcp_tool`** — D7-B: exige servidor (rede/porta). Descartado.
- **Matcher por tool explícita** — D8-B: deixa gaps (spawn_agent). Promovido a amplo (D8-A).

## depende-de

ADR-001 (I2 reason codes, I3 deny semantics, I4 kill-switch). Sem ADR-001 o contrato de equivalência não existe.

## Interface congelada

Contrato consumível por ADR-003 e pelo implementador.

**I1 — Mapeamento tool → gate (conjunto fechado).** `PreToolUse` dispara nos local function tools do Codex: `Bash`, `apply_patch`, tools MCP e demais local function tools. Matcher amplo (`Bash|apply_patch|Agent|.*`) para cobertura máxima; hosted tools (ex.: `WebSearch`) não disparam (limitação do Codex). 🟢 contrato · 🟡 execução.

**I2 — Adapter (contrato de I/O).** Entrada: evento Codex em stdin (JSON com `session_id`, `cwd`, `tool_name`, `tool_input`, …). Saída de deny: stdout JSON `{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "<reason code>" } }` **ou** exit code 2 com a reason code em stderr. Nenhum outro formato de deny é aceito (ADR-001 I3). 🟢 contrato.

**I3 — Deny JSON (forma congelada).** `permissionDecision:"deny"` é a única semântica aceita; `permissionDecisionReason` carrega o reason code literal (sem transformação, sem prefixo). 🟢 contrato.

**I4 — Kill-switch (A3).** Com `HARNESS_GATES=off`, o adapter sai antes de executar gates, não nega, e registra bypass (arquivo de estado, sem segredo/eco de path). Zero denies. 🟢 contrato.

**I5 — Persistência HITL/agente (D4-A).** Estado mutável em arquivo: reusa `workflow-state.json` quando fizer sentido + arquivo dedicado `.codex/harness-state.json` para estado específico do runtime Codex. Escrita atômica + lock; escopo por sessão para concorrência em subagents. Env apenas para kill-switch/config; tmp apenas para output grande (nativo do Codex). 🟢 contrato · 🟡 execução.

**I6 — Spike `spawn_agent` (best-effort).** `PreToolUse` pode não disparar em `spawn_agent` (issue openai/codex#49736, v0.159.2). Se confirmado no smoke, gates de subagent ficam documentados como best-effort e a paridade de reason codes (A2) é medida apenas nas tools onde o hook dispara. Thread principal é tratada como orchestrator por premissa (sem claim de identidade); regras dependentes de identidade não são portadas como gates de hook. 🟢 contrato · 🟡 empírico (A6).

**I7 — Fronteira hooks vs `.rules` (D2-C).** Hooks = gates/reason codes (RF-02). `.rules` (Starlark) = sandbox de comandos (allow/prompt/forbidden por prefixo), validado por `codex execpolicy check`. `.rules` é complementar e experimental (PRD §14.3); não duplicar política (risco de divergência silenciosa, mitigado por A2). 🟢 contrato.

**I8 — Refatoração de `gate.js` (condicionada).** Extração do núcleo puro exige refatoração mínima de `gate.js` sem alterar o caminho opencode; arquivo protegido — exige revisão humana no merge. 🟡 processo.

**I9 — `SessionStart` (complemento).** Hook `SessionStart` pode injetar `additionalContext` (limite conservador, default 2500 tokens) para contexto de sessão; não é canal primário de regras (D3-C). 🟢 contrato.

## Fora desta decisão

- Conteúdo/geração de `.codex/agents/*.toml`, encadeamento de `AGENTS.md` e payload do instalador (ADR-003).
- Merge/preservação de `.codex/config.toml` (ADR-003).
- Fixtures de paridade e smoke report (verificação).

## Consequências se estiver errado

- **R1 — Drift de reason codes.** Se o adapter não reusar o núcleo puro, A2 falha. Mitigação: D1-A + I2. 🟠 risco aberto.
- **R2 — `spawn_agent` não dispara.** Paridade degradada para subagents; documentado como best-effort (I6). 🟠 risco aceito.
- **R3 — Divergência hooks vs `.rules`.** Mitigada por fixtures A2 e fronteira clara (I7). 🟠 risco aberto.
- **R4 — Concorrência de estado.** Mitigada por escrita atômica + lock + escopo de sessão (I5). 🟠 risco aberto.

## Status

`todo` — aguardando portão do ciclo SDD scoped.


## Requisitos de segurança (security review ADR-001, 2026-11-19)

- **C-01 (identidade confiável)**: adapter deriva `agent` exclusivamente do contexto de sessão do Codex, nunca de `tool_input`; valida contra enum fechado; sessão não identificada ⇒ `unknown` (fail-closed para escrita protegida).
- **C-02 (integridade)**: harness-sync publica manifest com hashes de `.codex/**`; `doctor` verifica hash de `hooks.json` e do adapter; CI bloqueia alteração sem atualização do manifest.
- **H-04 (fail-open)**: adapter valida/parseia input defensivamente e nega (exit 2) em input inválido; fail-open apenas para erro inesperado de runtime.
- **M-02 (higiene I10)**: details com basename apenas e agentes reduzidos ao enum; reason code literal sem transformação.
- **H-01 (trust)**: `doctor` reporta estado de trust ativo/inativo; smoke inclui deny real.
- **H-02 (precedência)**: hooks autoritativos > `.rules`; `.rules` é subset validado por `codex execpolicy check`.
- **H-03 (matriz de cobertura)**: documentar tool→hook (sim/não), incluindo `spawn_agent` e hosted tools.
- **M-03 (bypass log)**: sink stderr/arquivo 0600, rotação, campos permitidos (timestamp, gate, session id, reason "kill-switch"), proibição de eco de env/path/args.
- **M-06 (command injection)**: caminho absoluto validado/publicado; sem interpolação de `tool_input`.
