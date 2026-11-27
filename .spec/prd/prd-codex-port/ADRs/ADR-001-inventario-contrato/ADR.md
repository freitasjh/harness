# ADR-001 — Inventário e contrato de paridade opencode↔Codex

- **prd-id**: `prd-codex-port` — `.spec/prd/prd-codex-port/PRD.md` (§16 **APROVADO** em 2026-11-19 pelo owner).
- **order**: 1 de 3 (`.spec/prd/prd-codex-port/ADR-INDEX.md`).
- **status**: `todo` — decisão redigida; `SPEC.md`/`TASKS.md` gerados pelo `sdd-compiler`; implementação (IC-01..IC-10) concluída e revisada (APPROVED). `ADR-01` verde.
- **branch**: `adr/prd-codex-port/01-inventario-contrato`.
- **data**: 2026-11-19.
- **dono da decisão**: owner do harness (decisões registradas no §16 do PRD).
- **insumo de pesquisa**: `RESEARCH.md` D1–D8 (2026-11-19); deepsearch Codex (hooks, AGENTS.md, subagents, rules, skills, config).

## Decisão

Estabelecer a camada `.codex/` como **segundo runtime paralelo** (dual-run), sem tocar no caminho opencode, e congelar o **contrato de equivalência** entre os dois runtimes: mesmos reason codes de gate, mesma semântica de deny (`permissionDecision:"deny"` / exit 2), mesmo kill-switch (`HARNESS_GATES=off`), e o mesmo conjunto de superfícies portadas (agentes, regras, skills, hooks, config). ADR-001 cobre o **inventário e o contrato**; a implementação de hooks (ADR-002) e de agentes/regras/config/instalador (ADR-003) herdam deste contrato e não o reabrem.

Inventário de superfícies (opencode → Codex):

| Superfície opencode | Superfície Codex | Portada? | Observação |
|---|---|---|---|
| `.opencode/plugins/gate.js` (hooks) | `.codex/hooks.json` + adapter Node | sim | reason codes idênticos (A2) |
| `.agents/agents/**` (11 papéis) | `.codex/agents/*.toml` (11) | sim | um `.toml` por papel (D6-A) |
| `.agents/rules/**` (8 regras) | `AGENTS.md` encadeado (≤32 KiB) + refs | sim | chunking por papel (D3) |
| `.agents/skills/**` (32 skills) | reuso direto (compatível) | não (já compatível) | sem port (já compatível) |
| `opencode.json` (registro de agentes) | `.codex/config.toml` | sim | merge/preservação (D5-C) |
| `harness.config.json` | reuso (mesma fonte) | não (reuso) | sem duplicação |
| `scripts/harness-sync.mjs` | estendido para publicar `.codex/` | sim | payload copiado (D5) |

Dual-run invariante: nenhum arquivo do caminho opencode é reescrito; nenhum deny novo é introduzido (PRD §7).

## Motivo

O harness v2 hoje só roda em opencode; portar "copiando" arrisca quebrar opencode e assumir capacidades que o Codex não tem (hooks que não disparam em `spawn_agent`, teto de 32 KiB de `AGENTS.md`, trust manual). Sem um contrato congelado de equivalência, a paridade de reason codes (A2) e o kill-switch (A3) não são verificáveis. A dor é de **portabilidade verificável**, não de reescrita (PRD §1).

## Alternativas descartadas

- **Reescrever o harness em Codex do zero** — contradiz dual-run e A2 (drift de reason codes); descartada (PRD §7 "mudança no caminho opencode" + RESEARCH D1-B).
- **Portar só hooks, ignorar agentes/regras** — não atende RF-06/RF-05; descartada.
- **Usar `.rules` (Starlark) como substituto dos gates** — não emite reason codes do harness; descartada como substituto (D2-A); mantida como complemento (D2-C).

## depende-de

PRD aprovado (§16, 2026-11-19) e `RESEARCH.md` (D1–D8). Nenhuma ADR anterior deste PRD.

## Interface congelada

Contrato consumível por ADR-002/ADR-003 e pelo implementador. Nenhum item pode ser emendado por prosa de implementação — mudança exige nova decisão.

**I1 — Conjunto fechado de superfícies (inventário acima).** Apenas as 7 superfícies listadas são portadas; skills reusam-se sem port; nenhum deny novo é introduzido (PRD §7). 🟢 contrato.

**I2 — Reason codes (conjunto congelado).** Os reason codes emitidos pelos gates Codex são exatamente os de `.opencode/plugins/gate.js` / `CORE_GATES` (mesma fonte de verdade). Paridade medida por fixtures (A2) para as tools onde o hook dispara. 🟢 contrato · 🟡 execução (ADR-002).

**I3 — Semântica de deny (única aceita).** `permissionDecision:"deny"` (JSON em stdout) **ou** exit code 2, com `permissionDecisionReason` carregando o reason code. Prompts interativos como gate são proibidos (PRD §13). 🟢 contrato.

**I4 — Kill-switch.** `HARNESS_GATES=off` desliga os hooks Codex e registra o bypass (sem segredo, sem eco de path); zero denies com a env setada (A3). 🟢 contrato.

**I5 — Dual-run invariante.** Diff do ciclo não toca `.opencode/**`, `opencode.json` (exceto merge aditivo do harness-sync) nem `.agents/**` existentes (RF-01). 🟢 contrato.

**I6 — Superfície de bypass declarada.** `.codex/hooks.json` adulterado pode desarmar gates; mitigação via paridade de fixtures (A2) e revisão humana no merge (PRD §13). 🟢 contrato.

**I7 — Verificação empírica.** Codex CLI não instalado neste ambiente; o smoke real é executado pelo usuário e registrado em `harness/codex-port-smoke.json` (A6). 🟢 processo.

## Fora desta decisão

- Implementação de hooks/gates (ADR-002) e de agentes/regras/config/instalador (ADR-003).
- Conteúdo detalhado de `.codex/agents/*.toml`, encadeamento de `AGENTS.md` e merge de `config.toml` (ADR-003).
- Fixtures de paridade e template de smoke report (verificação, fora do escopo de ADR).

## Consequências se estiver errado

- **R1 — Drift de reason codes.** Se o adapter não reusar o núcleo puro de `gate.js`, A2 falha. Mitigação: D1-A (adapter fino). 🟠 risco aberto até ADR-002.
- **R2 — Regressão no opencode.** Se o ciclo tocar arquivo opencode, A1 falha. Mitigação: I5 + revisão humana. 🟢 contrato.
- **R3 — Hooks não disparam em `spawn_agent`.** Limitação do Codex (issue #49736); paridade medida apenas onde o hook dispara (best-effort, documentado). 🟠 risco aceito.

## Status

`todo` — aguardando portão do ciclo SDD scoped (SPEC.md/TASKS.md gerados pelo `sdd-compiler`).