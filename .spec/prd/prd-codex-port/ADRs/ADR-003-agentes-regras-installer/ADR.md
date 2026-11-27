# ADR-003 — Agentes, regras, config e instalador repo-local (.codex/)

- **prd-id**: `prd-codex-port` — `.spec/prd/prd-codex-port/PRD.md` (§16 **APROVADO** em 2026-11-19 pelo owner).
- **order**: 3 de 3 (`.spec/prd/prd-codex-port/ADR-INDEX.md`).
- **status**: `todo` — decisão redigida; `SPEC.md`/`TASKS.md` pendentes, gerados pelo `sdd-compiler`.
- **branch**: `adr/prd-codex-port/03-agentes-regras-installer`.
- **data**: 2026-11-19.
- **depende-de**: ADR-002 (hooks/gates).
- **dono da decisão**: owner do harness.
- **insumo de pesquisa**: `RESEARCH.md` D3, D5, D6, D7, D8 (2026-11-19).

## Decisão

Gerar `.codex/agents/*.toml` com **um arquivo por papel** (11 agentes, D6-A), reusando o conteúdo de `.agents/agents/**` em `developer_instructions`. Encadear `AGENTS.md` com **raiz enxuta + chunking por papel** (D3-A+B) respeitando o teto de 32 KiB, com `SessionStart` apenas como complemento dinâmico (D3-C). Publicar a camada `.codex/` via `harness-sync` como **payload copiado para estáticos + preservado/criado-quando-ausente para `config.toml`** (D5-C), mantendo G1/G3/G4 de `harness-sync`. Transporte de hook por `command` (D7-A); matcher amplo (D8-A). `.rules` (Starlark) complementar para sandbox de comandos (D2-C).

## Motivo

Um agente genérico + skills (D6-B) perde especialização e viola RF-06 (contagem 10). Gerado por template (D5-B) perde determinismo (G1) e auditabilidade. Elevar `project_doc_max_bytes` acima de 32 KiB exigiria revisar a métrica (PRD §5); não fazer neste ciclo. Merge de TOML exigiria parser externo (zero rede) — evitado tratando `config.toml` como preservado/criado-quando-ausente (D5-C).

## Alternativas descartadas

- **Um agente genérico + skills** — D6-B: perde especialização, viola RF-06. Descartada.
- **Payload gerado por template no harness-sync** — D5-B: perde determinismo/auditabilidade. Descartada como padrão.
- **Híbrido copiado + merge TOML** — D5-C com merge: exige parser TOML externo (zero rede). Promovido a "copiado + preservado/criado-quando-ausente".
- **`AGENTS.md` raiz enxuto + referências apenas** — D3-A: fallback pode truncar silenciosamente. Promovido a combinação A+B.
- **Chunking por papel apenas** — D3-B: regras cross-cutting ficam invisíveis globalmente. Promovido a combinação A+B.
- **Injeção via `SessionStart` como canal primário** — D3-C: perde determinismo/auditabilidade. Mantido como complemento.

## depende-de

ADR-002 (I1 tool→gate, I5 persistência, I7 hooks vs `.rules`). ADR-003 herda o contrato de deny/kill-switch de ADR-001 via ADR-002.

## Interface congelada

Contrato consumível pelo implementador e pelo `harness-sync`.

**I1 — Layout `.codex/` (conjunto fechado).**

```
.codex/
  agents/        # *.toml, um por papel (11)
  hooks.json     # PreToolUse (D7-A, command)
  hooks/         # adapter Node (pre_tool_use.*)
  rules/         # *.rules (Starlark, sandbox) — complementar
  config.toml    # preservado/criado-quando-ausente
  harness-state.json  # estado runtime (D4-A)
```

`AGENTS.md` encadeado vive na raiz do projeto (descoberta root→cwd), não em `.codex/`. 🟢 contrato.

**I2 — Agentes (`.codex/agents/*.toml`).** Schema TOML com `name`, `description`, `developer_instructions`; um arquivo por papel (11), reusando o conteúdo de `.agents/agents/**`. Custom agent sobrepõe built-in de mesmo nome. Paridade de papéis verificável por contagem e nomes (RF-06). 🟢 contrato · 🟡 execução.

**I3 — Estratégia `AGENTS.md` (teto 32 KiB).** Canal primário: raiz enxuta (índice + convenções) + chunking por papel (`AGENTS.md`/`AGENTS.override.md` aninhados por diretório, carregados só no escopo). Teto `project_doc_max_bytes` mantido em 32768 bytes (métrica PRD §5); não elevar sem revisar a métrica. `project_doc_fallback_filenames` pode carregar `.agents/rules/*` (validação empírica de tamanho efetivo — A5). `SessionStart` apenas como complemento dinâmico (`additionalContext`, limite conservador). 🟢 contrato · 🟡 execução (A5).

**I4 — Payload do instalador (harness-sync).** Arquivos estáticos (`.codex/agents`, `.codex/hooks`, `.codex/rules`, `.codex/hooks.json`) entram no payload copiado (`PAYLOAD_DIRS`/`PAYLOAD_FILES`), com o mesmo contrato: determinismo G1 (write set = diff de hash), backup G3, merge G4, zero rede G5. `.codex/config.toml` é preservado se existente e criado quando ausente (como `buildConfig`), evitando dependência de parser TOML. `.codex/harness-state.json` é runtime (não payload gerenciado). 🟢 contrato · 🟡 execução (A4).

**I5 — `protectedPaths` (conjunto fechado).** Caminhos que o instalador **nunca** sobrescreve (G3 preserved), estendidos para a camada Codex:

- `.codex/config.toml` (preservado/criado-quando-ausente).
- `.codex/harness-state.json` (runtime, nunca tocado pelo payload).
- Qualquer arquivo sob `.codex/` não listado no payload (preservado).
- `.agents/rules/project-*.md` (já protegido, inalterado).
- `AGENTS.md` / `DESIGN.md` do consumidor (anexados, `inManifest: false`).

Nenhuma escrita fora do payload; `writeGuarded`/`assertSafeWrite` permanecem a via única. 🟢 contrato.

**I6 — Matcher de `PreToolUse` (D8-A).** Matcher amplo para tools locais (`Bash|apply_patch|Agent|.*`); hosted tools não disparam (limitação do Codex, documentada). Limitação de `spawn_agent` herdada de ADR-002 (I6). 🟢 contrato.

**I7 — `.rules` (Starlark) (D2-C).** Complementar aos hooks: `prefix_rule` para comandos shell (allow/prompt/forbidden), validado por `codex execpolicy check`. Experimental (PRD §14.3); não duplicar política dos hooks. 🟢 contrato.

**I8 — Paridade de papéis (RF-06).** 11 agentes em `.codex/agents/*.toml` com os mesmos nomes/papéis de `.agents/agents/**` (10 registrados em `opencode.json`). Verificável por contagem e nomes. 🟢 contrato.

**I9 — Teto de injeção (métrica).** Tamanho efetivo de `AGENTS.md` encadeado ≤ 32768 bytes (PRD §5). Medido em A5; não elevar sem revisar a métrica. 🟢 contrato.

## Fora desta decisão

- Refatoração do núcleo puro de `gate.js` (ADR-002 I8).
- Fixtures de paridade e smoke report (verificação).
- Plugins via marketplace, custom prompts (PRD §7, fora de escopo).
- Propagação de checks ao repositório-destino (PRD §7, processo).

## Consequências se estiver errado

- **R1 — Drift entre 11 agentes e 11 papéis.** Mitigado por paridade de contagem/nomes (I8) e revisão humana. 🟠 risco aberto.
- **R2 — `AGENTS.md` excede 32 KiB.** Mitigado por chunking + medição (I3/I9, A5). 🟠 risco aberto.
- **R3 — `config.toml` diverge entre camadas.** Mitigado por preservação/criação-quando-ausente (I4) + revisão humana. 🟠 risco aberto.
- **R4 — Payload não determinístico.** Mitigado por G1/G3/G4/G5 de `harness-sync` (I4). 🟢 mecanismo existente.

## Status

`todo` — aguardando portão do ciclo SDD scoped.


## Requisitos de segurança (security review ADR-001, 2026-11-19)

- **M-01 (state file)**: `.codex/harness-state.json` gitignored; escrita atômica via rename; lock com timeout; path normalizado; hash/nonce para detectar tampering; sem segredos.
- **M-04 (teto 32 KiB)**: medir tamanho efetivo e falhar (não truncar silenciosamente); priorizar conteúdo crítico de segurança no raiz.
- **M-07 (contagem)**: 11 agentes (corrigido de 10) em `.codex/agents/*.toml`.
- **L-02 (protectedPaths)**: incluir `.codex/` e `.codex/harness-state.json` em `protectedPaths` do opencode para proteção no dual-run.
- **M-05 (smoke report)**: schema proíbe campos de segredo; validador escaneia padrões (token/key) e falha.
