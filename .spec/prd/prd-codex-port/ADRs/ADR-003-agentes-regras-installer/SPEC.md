# SPEC — ADR-003: Agentes, regras, config e instalador repo-local (.codex/)

> **prd-id**: `prd-codex-port`
> **adr**: `ADR-003-agentes-regras-installer` (`.spec/prd/prd-codex-port/ADRs/ADR-003-agentes-regras-installer/ADR.md`)
> **status do ADR**: `todo`
> **fontes**: `PRD.md` (§2, §3, §5, §6, §7, §9, §12, §13, §14, §16), `RESEARCH.md` (D3, D4, D5, D6, D7, D8), `ADR.md` (Decisão, Motivo, Interface congelada I1–I9, Consequências, Requisitos de segurança), `ADR-001` (I1 inventário, I5 dual-run, I8 paridade), `ADR-002` (I5 persistência, I6 matcher, RF-22 bootstrap, RF-05 estado)
> **escopo**: especificação da decisão ADR-003 — gerar `.codex/agents/*.toml` (11, um por papel), encadear `AGENTS.md` dentro do teto de 32 KiB, tratar `.codex/config.toml` como preservado/criado-quando-ausente, estender `harness-sync` para publicar a camada `.codex/`, e aplicar as salvaguardas de segurança do state file, protectedPaths, smoke schema e contagem de agentes. Hooks/gates ficam em ADR-002.

## 1. Propósito

Congelar, de forma verificável, como a camada de agentes, regras, config e instalador do harness é portada para o Codex: o layout fechado de `.codex/`, o schema dos agentes `.toml`, a estratégia de encadeamento de `AGENTS.md` respeitando o teto de 32 KiB, a forma de publicação via `harness-sync` (payload copiado para estáticos + preservado/criado-quando-ausente para `config.toml`), o conjunto fechado de `protectedPaths` (incluindo a camada Codex no dual-run), as regras complementares (`.rules` Starlark), e as salvaguardas de segurança do state file, da contagem de agentes (11) e do smoke report. ADR-002 herda o bootstrap de identidade (RF-22) e o estado persistente (I5) deste contrato; mudança exige nova decisão (ADR.md §"Consequências").

## 2. Decisão de referência (ADR-003)

Gerar `.codex/agents/*.toml` com **um arquivo por papel** (11 agentes, D6-A), reusando o conteúdo de `.agents/agents/**` em `developer_instructions`. Encadear `AGENTS.md` com **raiz enxuta + chunking por papel** (D3-A+B) respeitando o teto de 32 KiB, com `SessionStart` apenas como complemento dinâmico (D3-C). Publicar a camada `.codex/` via `harness-sync` como **payload copiado para estáticos + preservado/criado-quando-ausente para `config.toml`** (D5-C), mantendo G1/G3/G4 de `harness-sync`. Transporte de hook por `command` (D7-A); matcher amplo (D8-A). `.rules` (Starlark) complementar para sandbox de comandos (D2-C). ADR-003 herda o contrato de deny/kill-switch de ADR-001 via ADR-002.

## 3. Interface congelada (I1–I9)

Contrato consumível pelo implementador e pelo `harness-sync`. Nenhum item pode ser emendado por prosa de implementação — mudança exige nova decisão.

- **I1 — Layout `.codex/` (conjunto fechado).** `.codex/agents/` (`*.toml`, um por papel, 11), `.codex/hooks.json`, `.codex/hooks/` (adapter Node), `.codex/rules/` (`*.rules` Starlark), `.codex/config.toml` (preservado/criado-quando-ausente), `.codex/harness-state.json` (runtime). `AGENTS.md` encadeado vive na raiz do projeto (descoberta root→cwd), não em `.codex/`. 🟢 contrato.
- **I2 — Agentes (`.codex/agents/*.toml`).** Schema TOML com `name`, `description`, `developer_instructions`; um arquivo por papel (11), reusando o conteúdo de `.agents/agents/**`. Custom agent sobrepõe built-in de mesmo nome. Paridade de papéis verificável por contagem e nomes (RF-06/RF-18). 🟢 contrato · 🟡 execução.
- **I3 — Estratégia `AGENTS.md` (teto 32 KiB).** Canal primário: raiz enxuta (índice + convenções) + chunking por papel (`AGENTS.md`/`AGENTS.override.md` aninhados por diretório, carregados só no escopo). Teto `project_doc_max_bytes` mantido em 32768 bytes (métrica PRD §5); não elevar sem revisar a métrica. `project_doc_fallback_filenames` pode carregar `.agents/rules/*` (validação empírica de tamanho efetivo — A5). `SessionStart` apenas como complemento dinâmico (`additionalContext`, limite conservador). 🟢 contrato · 🟡 execução (A5).
- **I4 — Payload do instalador (harness-sync).** Arquivos estáticos (`.codex/agents`, `.codex/hooks`, `.codex/rules`, `.codex/hooks.json`) entram no payload copiado (`PAYLOAD_DIRS`/`PAYLOAD_FILES`), com o mesmo contrato: determinismo G1 (write set = diff de hash), backup G3, merge G4, zero rede G5. `.codex/config.toml` é preservado se existente e criado quando ausente (como `buildConfig`), evitando dependência de parser TOML. `.codex/harness-state.json` é runtime (não payload gerenciado). 🟢 contrato · 🟡 execução (A4).
- **I5 — `protectedPaths` (conjunto fechado).** Caminhos que o instalador **nunca** sobrescreve (G3 preserved), estendidos para a camada Codex: `.codex/config.toml` (preservado/criado-quando-ausente); `.codex/harness-state.json` (runtime, nunca tocado pelo payload); qualquer arquivo sob `.codex/` não listado no payload (preservado); `.agents/rules/project-*.md` (já protegido, inalterado); `AGENTS.md` / `DESIGN.md` do consumidor (anexados, `inManifest: false`). Nenhuma escrita fora do payload; `writeGuarded`/`assertSafeWrite` permanecem a via única. 🟢 contrato.
- **I6 — Matcher de `PreToolUse` (D8-A).** Matcher amplo para tools locais (`Bash|apply_patch|Agent|.*`); hosted tools não disparam (limitação do Codex, documentada). Limitação de `spawn_agent` herdada de ADR-002 (I6). 🟢 contrato.
- **I7 — `.rules` (Starlark) (D2-C).** Complementar aos hooks: `prefix_rule` para comandos shell (allow/prompt/forbidden), validado por `codex execpolicy check`. Experimental (PRD §14.3); não duplicar política dos hooks. 🟢 contrato.
- **I8 — Paridade de papéis (RF-06).** 11 agentes em `.codex/agents/*.toml` com os mesmos nomes/papéis de `.agents/agents/**` (10 registrados em `opencode.json`). Verificável por contagem e nomes. 🟢 contrato.
- **I9 — Teto de injeção (métrica).** Tamanho efetivo de `AGENTS.md` encadeado ≤ 32768 bytes (PRD §5). Medido em A5; não elevar sem revisar a métrica. 🟢 contrato.

## 4. Interface de segurança (requisitos anexados)

Requisitos de segurança (security review ADR-001, 2026-11-19), incorporados como contrato adicional. Mudança exige nova decisão.

- **M-01 (state file)**: `.codex/harness-state.json` gitignored; escrita atômica via rename; lock com timeout; path normalizado; hash/nonce para detectar tampering; sem segredos. 🟢 contrato · 🟡 execução.
- **M-04 (teto 32 KiB)**: medir tamanho efetivo e falhar (não truncar silenciosamente); priorizar conteúdo crítico de segurança no raiz. 🟢 contrato.
- **M-05 (smoke report)**: schema proíbe campos de segredo; validador escaneia padrões (token/key) e falha. 🟢 contrato.
- **M-07 (contagem)**: 11 agentes (corrigido de 10) em `.codex/agents/*.toml`. 🟢 contrato.
- **L-02 (protectedPaths)**: incluir `.codex/` e `.codex/harness-state.json` em `protectedPaths` do opencode para proteção no dual-run. 🟢 contrato.

### Achados F-01..F-12 (security review 2026-11-20)

Incorporados como requisitos de segurança adicionais (mudança exige nova decisão). Cada F é rastreável a RF/NFR/INV/task.

- **F-01 (protectedPaths inclui `.codex`)**: `.codex/**` e `.codex/harness-state.json` em `protectedPaths` do opencode (dual-run). → RF-16, NFR-07, INV-12, task PROTECTED-02.
- **F-02 (fail-closed adapter)**: adapter/installer/payload não executa nem sobrescreve caminhos protegidos em input inválido/ausente; bootstrap ausente ⇒ `unknown` + deny para escrita protegida; fail-open apenas para erro inesperado de runtime. → RF-21, NFR-09, tasks INSTALLER-01/BOOTSTRAP-01.
- **F-03 (hash/nonce state)**: `.codex/harness-state.json` com hash/nonce anti-tampering (fail-closed em divergência). → RF-14, NFR-06, INV-10, task STATEFILE-01.
- **F-04 (`.gitignore`)**: `.codex/harness-state.json` gitignored. → RF-14, NFR-06, task STATEFILE-01.
- **F-05 (installer payload/protectedPaths)**: payload copiado apenas para estáticos; `protectedPaths` estendido à camada Codex; nenhuma escrita fora do payload. → RF-08, RF-11, RF-20, NFR-04, NFR-07, tasks INSTALLER-01/PROTECTED-01.
- **F-06 (integridade de manifest)**: manifest com hashes de `.codex/**`; `doctor` verifica. → RF-22, NFR-03, task INSTALLER-01.
- **F-07 (command injection)**: comando do hook com caminho absoluto validado; sem interpolação de `tool_input`. → RF-22, NFR-02, task INSTALLER-01.
- **F-08 (canonicalização)**: paths normalizados; traversal/absoluto/aspas ⇒ deny. → RF-22, NFR-09, tasks PROTECTED-01/DUALRUN-01.
- **F-09 (bypass log)**: sink seguro, sem segredo/eco de path. → RF-22, NFR-07, tasks STATEFILE-01/DUALRUN-01.
- **F-10 (trust)**: `doctor` reporta trust ativo/inativo. → RF-22, NFR-07, task DUALRUN-01.
- **F-11 (fail-open)**: fail-open apenas para erro inesperado de runtime. → RF-22, NFR-09, tasks INSTALLER-01/DUALRUN-01.
- **F-12 (smoke sem segredos)**: schema proíbe campos de segredo; validador escaneia padrões (token/key). → RF-17, NFR-08, task SMOKE-01.
## 5. Requisitos funcionais (RF)

Cada RF é rastreável ao item do ADR que o origina (decisão/interface/consequências/security). Formato: `RF-NN — <enunciado>. Verificável: <comando/asserção>`.

- **RF-01 (I1)** — Existe layout `.codex/` conjunto fechado publicado (`.codex/agents/`, `.codex/hooks/`, `.codex/rules/`, `.codex/hooks.json`, `.codex/config.toml`, `.codex/harness-state.json`) sem tocar o caminho opencode. *Verificável*: estrutura de diretórios + `harness-sync init` em tmp (A4).
- **RF-02 (I2, I8, M-07)** — 11 agentes em `.codex/agents/*.toml`, um por papel, com schema TOML (`name`, `description`, `developer_instructions`), reusando o conteúdo de `.agents/agents/**`. *Verificável*: contagem = 11 e nomes idênticos a `.agents/agents/**` (A5).
- **RF-03 (I2)** — Custom agent sobrepõe built-in de mesmo nome (comportamento do Codex); paridade verificável por contagem e nomes. *Verificável*: inspeção de `.codex/agents/*.toml` + smoke A6.
- **RF-04 (I3)** — `AGENTS.md` encadeado: raiz enxuta (índice + convenções) + chunking por papel (`AGENTS.md`/`AGENTS.override.md` aninhados por diretório), carregados só no escopo. *Verificável*: presença dos arquivos + medição (A5/métrica).
- **RF-05 (I3, M-04, I9)** — Teto `project_doc_max_bytes` mantido em 32768 bytes; tamanho efetivo de `AGENTS.md` encadeado ≤ 32768; medir e falhar (não truncar silenciosamente); priorizar conteúdo crítico de segurança no raiz. *Verificável*: medição de tamanho (A5/métrica) — 0 excedentes.
- **RF-06 (I3)** — `project_doc_fallback_filenames` pode carregar `.agents/rules/*` (validação empírica do tamanho efetivo — A5). *Verificável*: config + medição efetiva.
- **RF-07 (I3, I9)** — `SessionStart` apenas como complemento dinâmico (`additionalContext`, limite conservador) para contexto de sessão; não é canal primário de regras. *Verificável*: inspeção de `.codex/hooks.json`/config + smoke A6.
- **RF-08 (F-05, I4)** — Payload do instalador: arquivos estáticos (`.codex/agents`, `.codex/hooks`, `.codex/rules`, `.codex/hooks.json`) entram no payload copiado (`PAYLOAD_DIRS`/`PAYLOAD_FILES`), com contrato G1 (write set = diff de hash), G3 (backup), G4 (merge), G5 (zero rede). *Verificável*: `harness-sync init/update/doctor` em tmp (A4).
- **RF-09 (I4)** — `.codex/config.toml` preservado se existente e criado quando ausente (como `buildConfig`), evitando dependência de parser TOML. *Verificável*: teste de preservação em tmp (A4) — config preexistente não é sobrescrito.
- **RF-10 (I4)** — `.codex/harness-state.json` é runtime (não payload gerenciado); nunca tocado pelo payload. *Verificável*: `harness-sync` não sobrescreve o arquivo (A4).
- **RF-11 (F-05, I5)** — `protectedPaths` estendidos (conjunto fechado): `.codex/config.toml`, `.codex/harness-state.json`, qualquer arquivo sob `.codex/` não listado no payload, `.agents/rules/project-*.md`, `AGENTS.md`/`DESIGN.md` do consumidor. Nenhuma escrita fora do payload; `writeGuarded`/`assertSafeWrite` via única. *Verificável*: teste de `protectedPaths` + inspeção (A4/A5).
- **RF-12 (I7)** — `.rules` (Starlark) complementar: `prefix_rule` para comandos shell (allow/prompt/forbidden), validado por `codex execpolicy check`; experimental; não duplicar política dos hooks. *Verificável*: `codex execpolicy check` no smoke A6.
- **RF-13 (I1, I5)** — Dual-run: nenhuma escrita fora do payload; caminho opencode intacto. *Verificável*: `git diff --name-only` filtrado (A5) + suíte verde (A1).
- **RF-14 (F-03, F-04, M-01)** — State file `.codex/harness-state.json`: gitignored; escrita atômica via rename; lock com timeout; path normalizado; hash/nonce para detectar tampering; sem segredos. *Verificável*: inspeção de `.gitignore` + teste de escrita atômica/lock (T5 ADR-002) — 0 leak.
- **RF-15 (M-01, NF-04 ADR-002)** — Bootstrap de identidade (consumido por ADR-002 RF-22): agentes publicados em `.codex/agents/*.toml` + config fornecem contexto de sessão; ausente ⇒ `unknown` (fail-closed para escrita protegida); nenhuma identidade inferida do payload. *Verificável*: teste de bootstrap ausente ⇒ `unknown` + deny (T15 ADR-002).
- **RF-16 (F-01, L-02)** — `protectedPaths` do opencode inclui `.codex/**` e `.codex/harness-state.json` para proteção no dual-run. *Verificável*: inspeção da config de protectedPaths.
- **RF-17 (M-05)** — Smoke report `harness/codex-port-smoke.json`: schema proíbe campos de segredo; validador escaneia padrões (token/key) e falha. *Verificável*: validação JSON + schema (A6).
- **RF-18 (I8)** — Paridade de papéis: 11 agentes em `.codex/agents/*.toml` com os mesmos nomes/papéis de `.agents/agents/**`. *Verificável*: contagem e nomes (A5).
- **RF-19 (I2)** — Agentes reusam o conteúdo de `.agents/agents/**` em `developer_instructions` (fonte única de verdade: `.agents/agents/**`). *Verificável*: contagem de agentes + presença de `developer_instructions` não vazio.
- **RF-20 (F-05, I4, I5)** — Determinismo: publicação `.codex/` via `harness-sync` é determinística (write set = diff de hash; idempotente) (G1). *Verificável*: re-execução em tmp produz 0 writes na segunda passada (A4).
- **RF-21 (F-02)** — Fail-closed: adapter/installer/payload não executa nem sobrescreve caminhos protegidos quando input inválido/ausente; bootstrap ausente ⇒ `unknown` + deny para escrita protegida; fail-open apenas para erro inesperado de runtime. *Verificável*: teste de input inválido/ausente ⇒ deny (A3/T15 ADR-002).
- **RF-22 (F-06..F-12)** — Salvaguardas da camada Codex: manifest com hashes de `.codex/**` (F-06); comando do hook com caminho absoluto validado sem interpolação de `tool_input` (F-07); canonicalização de paths/traversal (F-08); bypass log sem segredo/eco de path (F-09); `doctor` reporta trust ativo/inativo (F-10); fail-open apenas para erro inesperado de runtime (F-11); smoke report sem campos/valores de segredo (F-12). *Verificável*: inspeção + testes A3/A4/A5/A6.
## 6. Requisitos não-funcionais (NFR)

- **NFR-01 (Paridade de papéis)** — contagem = 11 e nomes idênticos entre `.codex/agents/*.toml` e `.agents/agents/**` (A2/A5).
- **NFR-02 (Teto de injeção)** — tamanho efetivo de `AGENTS.md` encadeado ≤ 32768 bytes (A5/métrica).
- **NFR-03 (Zero rede/portas)** — todos os scripts de aceite rodam sem rede e sem portas; tmp com cleanup (PRD §7, A4, A5).
- **NFR-04 (Determinismo)** — publicação `.codex/` via `harness-sync` é determinística: write set = diff de hash; idempotente (G1, A4).
- **NFR-05 (Compatibilidade)** — suíte opencode (`commands.suiteFull`) permanece verde (0 falhas) após o ciclo (A1).
- **NFR-06 (Segurança state file)** — `.codex/harness-state.json` gitignored, escrita atômica, lock com timeout, path normalizado, hash/nonce anti-tampering, sem segredos (M-01).
- **NFR-07 (Segurança protectedPaths)** — `.codex/` e `.codex/harness-state.json` protegidos no dual-run (L-02).
- **NFR-08 (Smoke sem segredos)** — schema proíbe campos de segredo; validador escaneia padrões (token/key) e falha (M-05).
- **NFR-09 (Auditabilidade)** — cada RF/NFR cita o item do ADR/security que o origina; verificável por revisão (ADR-001 NFR-09).
- **NFR-10 (Testabilidade)** — agentes/config/instalador testáveis via `harness-sync` em tmp (A4) e checks estáticos (A5).
- **NFR-11 (Segurança F-01..F-12)** — todos os achados F-01..F-12 da security review 2026-11-20 têm RF + task + verificação (A3–A6).
## 7. Invariantes (resumo executável)

| ID | Invariante | Verificação |
|---|---|---|
| INV-1 (layout fechado) | apenas as 6 entradas do I1 existem em `.codex/` | inspeção + harness-sync (A4) |
| INV-2 (contagem de agentes) | 11 agentes em `.codex/agents/*.toml`, mesmos nomes/papéis | contagem + nomes (A5) |
| INV-3 (teto de injeção) | tamanho efetivo de `AGENTS.md` ≤ 32768 bytes | medição (A5/métrica) |
| INV-4 (payload determinístico) | write set = diff de hash; idempotente | A4 |
| INV-5 (protectedPaths) | nenhum arquivo protegido é sobrescrito | teste de protectedPaths (A4) |
| INV-6 (config preservado) | `.codex/config.toml` preexistente não é sobrescrito | teste de preservação (A4) |
| INV-7 (state file runtime) | `.codex/harness-state.json` nunca é payload gerenciado | harness-sync (A4) |
| INV-8 (dual-run) | nenhum arquivo de `.opencode/**`, `opencode.json` (exceto merge aditivo), `.agents/**` existentes é reescrito, EXCETO `.opencode/plugins/gate.js` e `.opencode/plugins/lib/gate-core.mjs` — refatoração do núcleo puro herdada de ADR-002 SPEC §“ADR-002” (check-codex-dualrun.mjs exceções declaradas) | `git diff --name-only` + A1 |
| INV-9 (sem deny novo) | nenhuma negação além dos gates existentes (porta, não amplia) | revisão ADR/PRD §7 |
| INV-10 (state file seguro) | gitignored, atomic rename, lock, hash/nonce, sem segredos | inspeção + teste (M-01) |
| INV-11 (smoke sem segredos) | schema proíbe campos de segredo; validador escaneia padrões | validação A6 (M-05) |
| INV-12 (protectedPaths opencode) | `.codex/` e `.codex/harness-state.json` em protectedPaths | inspeção (L-02) |
| INV-13 (achados F) | F-01..F-12 cobertos por RF/NFR/task | revisão SPEC/TASKS |
## 8. Modelo de dados

Estado de runtime do Codex (já introduzido em ADR-002 §8, concretizado aqui):

- **`.codex/harness-state.json`** (arquivo dedicado, D4-A, M-01): estado específico do runtime Codex — identidade de sessão→agente, contadores HITL, turnos, cursor do bypass log. Campos mínimos (ADR-002 §8): `session_id`, `agent` (enum), `hitl` (object), `turn` (object), `bypass_log` (object). Escrita atômica (temp + rename) + lock por arquivo com timeout; escopo por `session_id` para concorrência em subagents; path normalizado; hash/nonce para detectar tampering; sem segredos; gitignored.
- **`.codex/config.toml`** (preservado/criado-quando-ausente): configuração do Codex (agentes, hooks, etc.); não é sobrescrito pelo payload (I4/I5).
- **`AGENTS.md` encadeado** (raiz + aninhados): regras/instruções, ≤ 32768 bytes efetivos (I3/I9).

N/A para entidade de domínio nova: este ADR não cria tabelas/coleções de negócio; o estado é de governança de runtime. Motivo: `N/A — estado de runtime/configuração, não entidade de domínio`.

## 9. Event model / integrações

N/A — sem eventos de domínio novos. `PreToolUse`/`SessionStart` são eventos de runtime do Codex consumidos pelo adapter (ADR-002). A paridade é verificada por fixtures de gate (A2), não por eventos. Motivo: `N/A — sem produtor/consumidor de evento de domínio novo`.

## 10. Estratégia de encadeamento `AGENTS.md` (teto) — I3/I9

| Camada | Conteúdo | Quando carrega |
|---|---|---|
| Raiz `AGENTS.md` | índice curto + convenções cross-cutting (crítico de segurança priorizado) | sempre (root→cwd) |
| `AGENTS.md`/`AGENTS.override.md` aninhados por diretório | regras por papel/escopo | apenas quando cwd está no diretório |
| `.agents/rules/*` via `project_doc_fallback_filenames` | regras detalhadas | conforme fallback (validação empírica de tamanho efetivo — A5) |
| `SessionStart` hook | `additionalContext` (limite conservador, default 2500 tokens) | contexto de sessão (complemento) |

**Regras de medição (M-04)**:
- Medir o tamanho efetivo do encadeamento (raiz + aninhados carregados no escopo) em bytes.
- Se exceder 32768 bytes: **falhar** (não truncar silenciosamente).
- Priorizar conteúdo crítico de segurança no raiz (não depender de chunk aninhado para segurança).
- Não elevar `project_doc_max_bytes` acima de 32768 sem revisar a métrica (PRD §5).

## 11. IAM, segurança e trust

- **Trust**: hooks dependem de trust do projeto (`/hooks` + projeto trusted). `doctor` reporta estado ativo/inativo e nunca força trust (H-01, PRD §8/§13). Aplicável à camada Codex publicada.
- **State file (M-01)**: `.codex/harness-state.json` gitignored; escrita atômica via rename; lock com timeout; path normalizado; hash/nonce para detectar tampering; sem segredos.
- **Teto (M-04)**: medir tamanho efetivo e falhar (não truncar silenciosamente); priorizar conteúdo crítico de segurança no raiz.
- **Contagem (M-07)**: 11 agentes (corrigido de 10) em `.codex/agents/*.toml`.
- **protectedPaths (L-02)**: incluir `.codex/` e `.codex/harness-state.json` em `protectedPaths` do opencode para proteção no dual-run.
- **Smoke schema (M-05)**: schema proíbe campos de segredo; validador escaneia padrões (token/key) e falha.
- **protectedPaths (I5)**: conjunto fechado estendido à camada Codex; `writeGuarded`/`assertSafeWrite` via única; nenhuma escrita fora do payload.
- **Dual-run (I5, ADR-001)**: nenhum arquivo do caminho opencode é reescrito; suíte verde (A1).
- **Superfície de bypass declarada (ADR-001 I6)**: `.codex/hooks.json` adulterado pode desarmar gates; mitigação via paridade de fixtures (A2) + revisão humana no merge.
- Nenhum prompt interativo como gate (ADR-001 I3, PRD §13).
- Bypass log sem segredo e sem eco de path (ADR-001 I4).

## 12. Estratégia de testes

- **T1 (Paridade de papéis)** — contagem = 11 e nomes idênticos entre `.codex/agents/*.toml` e `.agents/agents/**`. Cobertura: RF-02, RF-18, NFR-01.
- **T2 (Schema dos agentes)** — cada `.toml` possui `name`, `description`, `developer_instructions` não vazio. Cobertura: RF-02, RF-19.
- **T3 (Encadeamento/teto)** — tamanho efetivo de `AGENTS.md` ≤ 32768 bytes; medição falha se exceder. Cobertura: RF-04, RF-05, NFR-02.
- **T4 (Payload harness-sync)** — `init/update/doctor` em tmp sem rede, exit 0; write set = diff de hash; idempotente. Cobertura: RF-08, RF-20, NFR-03, NFR-04.
- **T5 (Preservação de config)** — `.codex/config.toml` preexistente não é sobrescrito; criado quando ausente. Cobertura: RF-09, INV-6.
- **T6 (Runtime state file)** — `.codex/harness-state.json` não é tocado pelo payload. Cobertura: RF-10, INV-7.
- **T7 (protectedPaths)** — arquivos protegidos não são sobrescritos; escrita fora do payload é negada. Cobertura: RF-11, INV-5, NFR-07.
- **T8 (State file seguro)** — gitignored, atomic rename, lock, hash/nonce, sem segredos. Cobertura: RF-14, NFR-06.
- **T9 (Bootstrap identidade)** — bootstrap ausente ⇒ `unknown` + deny protegido (ADR-002 T15). Cobertura: RF-15.
- **T10 (protectedPaths opencode)** — `.codex/` e `.codex/harness-state.json` em protectedPaths. Cobertura: RF-16, INV-12.
- **T11 (Smoke schema)** — `harness/codex-port-smoke.json` válido no schema; validador escaneia padrões (token/key) e falha. Cobertura: RF-17, NFR-08.
- **T12 (`.rules`)** — `codex execpolicy check` passa; não duplica política dos hooks. Cobertura: RF-12.
- **T13 (Dual-run)** — suíte opencode verde + `git diff` sem tocar opencode. Cobertura: RF-13, NFR-05.
- **T14 (Checks estáticos)** — `static-checks`, `sdd-checks`, `vendor-skills --check`, `acceptance-clean-room` verdes (A5).

## 13. Critérios de aceite executáveis (ADR-003)

| ID | Critério | Comando / asserção | Meta |
|---|---|---|---|
| A1 | suíte opencode verde antes de dev novo | `commands.suiteFull` exit 0 | 0 falhas |
| A2 | paridade de reason codes | fixtures opencode × Codex | 0 divergências |
| A3 | kill-switch Codex | teste de hook com env setada | 0 denies |
| A4 | harness-sync em tmp | `init/update/doctor` em tmp, sem rede | 0 falhas |
| A5 | checks estáticos | `static-checks`, `sdd-checks`, `vendor-skills --check`, `acceptance-clean-room` | 0 falhas |
| A6 | smoke real | `harness/codex-port-smoke.json` válido no schema | 1 relatório |
| S1 | state file seguro (M-01) | gitignored + atomic rename + lock + hash/nonce + sem segredos | 0 leak |
| S2 | teto 32 KiB (M-04) | medição efetiva ≤ 32768 bytes; falha se exceder | ≤ 32768 |
| S3 | contagem de agentes (M-07) | 11 agentes em `.codex/agents/*.toml` | 11 |
| S4 | protectedPaths dual-run (L-02) | `.codex/` e state file em protectedPaths | presente |
| S5 | smoke schema sem segredos (M-05) | validador escaneia padrões (token/key) e falha | 0 leak |
| M | teto de injeção | tamanho efetivo `AGENTS.md` ≤ 32768 bytes | ≤ 32768 |

Comandos de verificação do contrato (executáveis neste repositório):
- `node scripts/static-checks.mjs` (ADR-01/ADR-02 devem passar após SPEC/TASKS)
- `node scripts/sdd-checks.mjs` (F4: marcador de escopo em TASKS.md)
- `grep -n "protectedPaths\|harness-state.json\|project_doc_max_bytes" .spec/prd/prd-codex-port/ADRs/ADR-003-agentes-regras-installer/ADR.md`

## 14. Diagrama (agentes/regras/config/instalador)

```mermaid
flowchart LR
  SRC[.agents/agents/** (11 papéis)] -->|reuso em developer_instructions| AGT[.codex/agents/*.toml (11)]
  RULES[.agents/rules/** (8)] -->|raiz enxuta + chunking| AMD[AGENTS.md encadeado ≤32KiB]
  SYNC[harness-sync] -->|payload copiado (G1/G3/G4/G5)| COD[.codex/ (agents/hooks/rules/hooks.json)]
  SYNC -->|preservado/criado-quando-ausente| CFG[.codex/config.toml]
  SYNC -->|runtime, nunca payload| STATE[(.codex/harness-state.json)]
  PP[protectedPaths (I5 + L-02)] -. protege .-> CFG
  PP -. protege .-> STATE
  STAR[.rules Starlark] -. complementar .-> CDX[Codex]
  ADR2[ADR-002 hooks/gates] -->|bootstrap identidade RF-22| AGT
  INV[ADR-001 contrato] --> SYNC
```

## 15. Delta Specs

Alterações documentadas (aplicadas em implementação futura; este ADR não implementa código):

- **Cria** `.codex/agents/*.toml` (11, um por papel, schema TOML, reusando `.agents/agents/**`).
- **Cria** `AGENTS.md` encadeado (raiz enxuta + `AGENTS.md`/`AGENTS.override.md` aninhados por diretório) ≤ 32768 bytes.
- **Cria** `.codex/config.toml` (preservado/criado-quando-ausente).
- **Cria** `.codex/rules/*.rules` (Starlark, complementar e experimental).
- **Cria** `.codex/harness-state.json` (runtime, gitignored; não payload gerenciado).
- **Modifica** `scripts/harness-sync.mjs` (adicionar `.codex/agents`, `.codex/hooks`, `.codex/rules`, `.codex/hooks.json` ao payload copiado; `config.toml` preservado/criado-quando-ausente; `harness-state.json` runtime; `protectedPaths` estendido; manifest com hashes).
- **Modifica** `.gitignore` (adicionar `.codex/harness-state.json`).
- **Modifica** config de `protectedPaths` do opencode (adicionar `.codex/` e `.codex/harness-state.json` — L-02).
- **Modifica** `harness/codex-port-smoke.json` (schema proíbe campos de segredo; validador escaneia padrões — M-05).
- **Não toca** `.opencode/**` (exceto protectedPaths config aditiva), `opencode.json` (exceto merge aditivo do harness-sync) nem `.agents/**` existentes (dual-run, ADR-001 I5).
- **Não introduz** novos denies além dos gates existentes (PRD §7).

## 16. Rastreabilidade ADR → RF/NFR

| ADR item | RF/NFR |
|---|---|
| I1 (layout .codex/) | RF-01, RF-13, NFR-03 |
| I2 (agentes .toml) | RF-02, RF-03, RF-19, NFR-01 |
| I3 (AGENTS.md teto) | RF-04, RF-05, RF-06, RF-07, NFR-02 |
| I4 (payload instalador) | RF-08, RF-09, RF-10, RF-20, NFR-04 |
| I5 (protectedPaths) | RF-11, RF-13, NFR-07, INV-5 |
| I6 (matcher PreToolUse) | (herdado de ADR-002 I6) — documentado |
| I7 (.rules Starlark) | RF-12, NFR-03 |
| I8 (paridade de papéis) | RF-02, RF-18, NFR-01 |
| I9 (teto de injeção) | RF-05, NFR-02 |
| M-01 (state file) | RF-14, NFR-06, INV-10 |
| M-04 (teto 32 KiB) | RF-05, NFR-02, INV-3 |
| M-05 (smoke schema) | RF-17, NFR-08, INV-11 |
| M-07 (contagem 11) | RF-02, RF-18, NFR-01, INV-2 |
| L-02 (protectedPaths opencode) | RF-16, NFR-07, INV-12 |
| F-01 (protectedPaths .codex) | RF-16, NFR-07, INV-12 |
| F-02 (fail-closed) | RF-21, NFR-09 |
| F-03 (hash/nonce state) | RF-14, NFR-06, INV-10 |
| F-04 (.gitignore) | RF-14, NFR-06 |
| F-05 (installer payload/protectedPaths) | RF-08, RF-11, RF-20, NFR-04, NFR-07 |
| F-06..F-12 | RF-22, NFR-11 |
| PRD §5/§7/§13 | NFR-03, NFR-05, NFR-09 |
| RESEARCH D3/D5/D6/D7/D8 | RF-04, RF-08, RF-09, RF-12, NFR-04 |
| ADR-001 I1/I5/I8 | RF-01, RF-13, RF-18, INV-8 |
| ADR-002 I5/I6/RF-22 | RF-14, RF-15, INV-10 |

## 17. Portão spec-gate (auto-avaliação)

| # | Item | Status |
|---|---|---|
| 1.1 | ADRs (decisão documentada) | ✅ ADR.md presente com decisão + interface congelada I1–I9 + segurança |
| 1.2 | DDD Modular (api/impl/public) | N/A — sem código/módulos neste ciclo (governança docs + contrato) |
| 1.3 | Segurança/IAM (auth + @HasPermission) | N/A — sem IAM de aplicação; trust de hooks + state file + protectedPaths documentados (§11) |
| 2.1 | ERD | N/A — sem entidade de domínio nova; estado de runtime documentado (§8) |
| 2.2 | Event Registry | N/A — sem eventos de domínio novos (§9) |
| 2.3 | Migrations | N/A — sem banco/ORM afetado |
| 3.1 | Invariantes de entidade | N/A — sem entidade nova; invariantes de contrato em §7 (INV-1..INV-12) |
| 3.2 | Invariantes de workflow | ✅ §7 (INV-1..INV-12) |
| 3.3 | Test strategy | ✅ §12 (T1–T14) |
| 4.1 | Single file | ✅ SPEC.md único |
| 4.2 | Domínio claro | ✅ portabilidade de harness (opencode↔Codex), agentes/regras/config/instalador |