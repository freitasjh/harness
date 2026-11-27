# SPEC — ADR-001: Inventário e contrato de paridade opencode↔Codex

> **prd-id**: `prd-codex-port`
> **adr**: `ADR-001-inventario-contrato` (`.spec/prd/prd-codex-port/ADRs/ADR-001-inventario-contrato/ADR.md`)
> **status do ADR**: `todo`
> **fontes**: `PRD.md` (§5, §6, §7, §9, §12, §13, §16), `RESEARCH.md` (D1–D8), `ADR.md` (Decisão, Interface congelada I1–I7)
> **escopo**: especificação da decisão ADR-001 — inventário fechado de superfícies e contrato de equivalência. Implementação de hooks/agentes/regras/config fica em ADR-002/ADR-003.

## 1. Propósito

Congelar, de forma verificável, o que é portado (inventário) e as invariantes de equivalência (reason codes, deny semantics, kill-switch, dual-run) entre opencode e Codex. ADR-002 e ADR-003 herdam este contrato e não o reabrem; mudança exige nova decisão (ADR.md §"Consequências").

## 2. Decisão de referência (ADR-001)

Camada `.codex/` como segundo runtime paralelo (dual-run), sem tocar no caminho opencode. Conjunto fechado de 7 superfícies (ADR.md tabela + I1). Contrato consumível por ADR-002/ADR-003.

## 3. Inventário de superfícies (I1)

| # | Superfície opencode | Superfície Codex | Portada? | Observação |
|---|---|---|---|---|
| 1 | `.opencode/plugins/gate.js` (hooks) | `.codex/hooks.json` + adapter Node | sim | reason codes idênticos (I2) |
| 2 | `.agents/agents/**` (11 papéis) | `.codex/agents/*.toml` (11) | sim | um `.toml` por papel (D6-A) |
| 3 | `.agents/rules/**` (8 regras) | `AGENTS.md` encadeado (≤32 KiB) + refs | sim | chunking por papel (D3) |
| 4 | `.agents/skills/**` (32 skills) | reuso direto | não (já compatível) | sem port |
| 5 | `opencode.json` (registro de agentes) | `.codex/config.toml` | sim | merge/preservação (D5-C) |
| 6 | `harness.config.json` | reuso (mesma fonte) | não (reuso) | sem duplicação |
| 7 | `scripts/harness-sync.mjs` | estendido para publicar `.codex/` | sim | payload copiado (D5) |

**Invariantes de inventário**:
- INV-INV-1: apenas as 7 superfícies acima são portadas; nenhuma superfície adicional entra neste ciclo (PRD §7 "novos denies fora dos gates" + I1).
- INV-INV-2: skills reusam-se sem port; contagem de skills permanece 32 (sem alteração em `.agents/skills/**`).
- INV-INV-3: `harness.config.json` é fonte única; não há duplicação em `.codex/`.
- INV-INV-4: nenhum deny novo é introduzido (PRD §7).

Contagens de referência (verificáveis em disco na data do ADR):
- agentes registrados em `opencode.json`: 11
- regras em `.agents/rules/`: 8
- skills em `.agents/skills/`: 32

## 4. Interface congelada (contrato I1–I7)

Contrato consumível por ADR-002/ADR-003. Nenhum item pode ser emendado por prosa de implementação — mudança exige nova decisão.

- **I1 — Conjunto fechado de superfícies**: apenas as 7 superfícies listadas (§3). 🟢 contrato.
- **I2 — Reason codes (conjunto congelado)**: reason codes emitidos pelos gates Codex são exatamente os de `.opencode/plugins/gate.js` / `CORE_GATES` (mesma fonte de verdade). Paridade medida por fixtures (A2) para as tools onde o hook dispara. 🟢 contrato · 🟡 execução (ADR-002).
- **I3 — Semântica de deny (única aceita)**: `permissionDecision:"deny"` (JSON em stdout) **ou** exit code 2, com `permissionDecisionReason` carregando o reason code. Prompts interativos como gate são proibidos (PRD §13). 🟢 contrato.
- **I4 — Kill-switch**: `HARNESS_GATES=off` desliga os hooks Codex e registra o bypass (sem segredo, sem eco de path); zero denies com a env setada (A3). 🟢 contrato.
- **I5 — Dual-run invariante**: Diff do ciclo não toca `.opencode/**`, `opencode.json` (exceto merge aditivo do harness-sync) nem `.agents/**` existentes (RF-01). 🟢 contrato.
- **I6 — Superfície de bypass declarada**: `.codex/hooks.json` adulterado pode desarmar gates; mitigação via paridade de fixtures (A2) e revisão humana no merge (PRD §13). 🟢 contrato.
- **I7 — Verificação empírica**: Codex CLI não instalado neste ambiente; o smoke real é executado pelo usuário e registrado em `harness/codex-port-smoke.json` (A6). 🟢 processo.

## 5. Requisitos funcionais (RF)

Cada RF é rastreável ao item do ADR que o origina (decisão/interface/consequências). Formato: `RF-NN — <enunciado>. Verificável: <comando/asserção>`.

- **RF-01 (I1, I5)** — Existe inventário fechado de superfícies opencode→Codex publicado no ADR-001 (§3) e referenciado por ADR-002/ADR-003. *Verificável*: `test -f .spec/prd/prd-codex-port/ADRs/ADR-001-inventario-contrato/ADR.md` e presença da tabela de inventário (grep `Superfície opencode`).
- **RF-02 (I2)** — O conjunto de reason codes dos gates Codex é exatamente o conjunto de `CORE_GATES` do opencode (mesma fonte de verdade). *Verificável*: fixtures de paridade (A2) — 0 divergências para as tools cobertas.
- **RF-03 (I3)** — Deny Codex usa exclusivamente `permissionDecision:"deny"` (JSON em stdout) ou exit code 2, com `permissionDecisionReason` carregando o reason code; prompts interativos como gate são proibidos. *Verificável*: inspeção do adapter + teste de hook (A2/A3).
- **RF-04 (I4)** — `HARNESS_GATES=off` desliga os hooks Codex e registra o bypass (sem segredo, sem eco de path); 0 denies com a env setada. *Verificável*: teste de hook com env setada (A3).
- **RF-05 (I5)** — Dual-run invariante: o diff do ciclo não toca `.opencode/**`, `opencode.json` (exceto merge aditivo do harness-sync) nem `.agents/**` existentes. *Verificável*: `git diff --name-only` filtrado (A1/A5); suíte opencode verde.
- **RF-06 (I6)** — Superfície de bypass (`.codex/hooks.json` adulterado) é declarada e mitigada via paridade de fixtures (A2) + revisão humana no merge. *Verificável*: presença da declaração em ADR.md (grep `Superfície de bypass`) + checklist de revisão.
- **RF-07 (I7)** — Existe template de smoke report `harness/codex-port-smoke.json` válido no schema, preenchido pelo usuário. *Verificável*: validação JSON + schema (A6).
- **RF-08 (I1)** — Skills reusam-se sem port (já compatíveis); nenhum deny novo é introduzido. *Verificável*: contagem de skills = 32 inalterada; `git diff` em `.agents/skills/**` vazio.
- **RF-09 (I1)** — `harness.config.json` é reusado como fonte única; não há duplicação em `.codex/`. *Verificável*: ausência de `harness.config.json` em `.codex/` (quando publicado) e leitura da mesma fonte.
- **RF-10 (I1)** — ADR-002 e ADR-003 herdam o contrato e não o reabrem; mudança exige nova decisão. *Verificável*: revisão de ADR-002/ADR-003 (seção "depende-de" cita ADR-001).

## 6. Requisitos não-funcionais (NFR)

- **NFR-01 (Paridade)** — 0 divergências de reason codes entre opencode e Codex para as tools cobertas (A2).
- **NFR-02 (Teto de injeção)** — tamanho efetivo de `AGENTS.md` encadeado ≤ 32 KiB (32768 bytes) (métrica PRD §5; aplicado em ADR-003).
- **NFR-03 (Zero rede/portas)** — todos os scripts de aceite rodam sem rede e sem portas; tmp com cleanup (PRD §7).
- **NFR-04 (Determinismo)** — publicação `.codex/` via harness-sync é determinística: write set = diff de hash; idempotente (G1).
- **NFR-05 (Compatibilidade)** — suíte opencode (`commands.suiteFull`) permanece verde (0 falhas) após o ciclo (A1).
- **NFR-06 (Auditabilidade)** — todo deny carrega o reason code em `permissionDecisionReason` (I3).
- **NFR-07 (Segurança)** — bypass log não contém segredo nem eco de path (I4, PRD §13).
- **NFR-08 (Testabilidade)** — adapter Codex é fino e reusa o núcleo puro de `gate.js` (D1-A), permitindo testes de paridade (A2) sem reescrita.
- **NFR-09 (Rastreabilidade)** — cada RF/NFR cita o item do ADR que o origina; verificável por revisão.

## 7. Invariantes (resumo executável)

| ID | Invariante | Verificação |
|---|---|---|
| INV-1 (dual-run) | nenhum arquivo de `.opencode/**`, `opencode.json` (exceto merge aditivo), `.agents/**` existentes é reescrito | `git diff --name-only` + A1 |
| INV-2 (reason codes) | conjunto congelado = `CORE_GATES` de `gate.js` | fixtures A2 |
| INV-3 (deny) | única semântica aceita = `permissionDecision:"deny"`/exit 2 | inspeção + teste |
| INV-4 (kill-switch) | 0 denies com `HARNESS_GATES=off` | teste A3 |
| INV-5 (inventário fechado) | apenas 7 superfícies portadas | revisão ADR |
| INV-6 (sem deny novo) | nenhuma negação além dos gates existentes | revisão ADR/PRD §7 |

## 8. Modelo de dados

N/A — sem entidade nova neste ciclo. ADR-001 é contrato/inventário; não cria tabelas, coleções ou esquemas. Estado de governança (HITL/turno) é tratado em ADR-002/ADR-003 (D4-A: arquivo). Motivo: `N/A — contrato documental, sem persistência nova`.

## 9. Event model / integrações

N/A — sem eventos novos. A paridade é verificada por fixtures de gate (A2), não por eventos de domínio. Motivo: `N/A — sem produtor/consumidor de evento novo`.

## 10. Migrations

N/A — sem migração de dados. Motivo: `N/A — sem banco/ORM afetado`.

## 11. IAM, segurança e trust

- Trust de hooks exige `/hooks` e projeto trusted (PRD §8, §13); `doctor` do harness-sync verifica presença de `.codex/hooks.json` mas não força trust.
- Nenhum prompt interativo como gate (I3, PRD §13).
- Bypass log sem segredo e sem eco de path (I4).
- Superfície de bypass declarada (I6): `.codex/hooks.json` adulterado pode desarmar gates; mitigação via paridade de fixtures (A2) + revisão humana no merge.

## 12. Estratégia de testes

- **T1 (Paridade de reason codes)** — fixtures comparando opencode × Codex para cada gate de `CORE_GATES`; meta 0 divergências (A2).
- **T2 (Kill-switch)** — hook Codex com `HARNESS_GATES=off` não nega e registra bypass (A3).
- **T3 (Dual-run)** — suíte opencode verde + `git diff` sem tocar opencode (A1, A5).
- **T4 (harness-sync em tmp)** — `init/update/doctor` em tmp sem rede, exit 0 (A4).
- **T5 (Checks estáticos)** — `static-checks`, `sdd-checks`, `vendor-skills --check`, `acceptance-clean-room` verdes (A5).
- **T6 (Smoke real)** — `harness/codex-port-smoke.json` válido no schema (A6).
- **T7 (Teto de injeção)** — tamanho efetivo de `AGENTS.md` ≤ 32768 bytes (métrica PRD).

## 13. Critérios de aceite executáveis (ADR-001)

| ID | Critério | Comando / asserção | Meta |
|---|---|---|---|
| A1 | suíte opencode verde antes de dev novo | `commands.suiteFull` exit 0 | 0 falhas |
| A2 | paridade de reason codes | fixtures opencode × Codex | 0 divergências |
| A3 | kill-switch Codex | teste de hook com env setada | 0 denies |
| A4 | harness-sync em tmp | `init/update/doctor` em tmp, sem rede | 0 falhas |
| A5 | checks estáticos | `static-checks`, `sdd-checks`, `vendor-skills --check`, `acceptance-clean-room` | 0 falhas |
| A6 | smoke real | `harness/codex-port-smoke.json` válido no schema | 1 relatório |
| M | teto de injeção | tamanho efetivo `AGENTS.md` ≤ 32768 bytes | ≤ 32768 |

Comandos de verificação do contrato (executáveis neste repositório):
- `node scripts/static-checks.mjs` (ADR-01 para ADR-001 deve passar após SPEC/TASKS)
- `node scripts/sdd-checks.mjs` (F4: marcador de escopo em TASKS.md)
- `grep -n "Superfície opencode" .spec/prd/prd-codex-port/ADRs/ADR-001-inventario-contrato/ADR.md`
- `grep -n "interface congelada\|depende-de" .spec/prd/prd-codex-port/ADRs/ADR-001-inventario-contrato/ADR.md`

## 14. Diagrama (paridade)

```mermaid
flowchart LR
  OC[gate.js / CORE_GATES] -->|reason codes| FIX[Fixtures de paridade A2]
  FIX -->|compara| CDX[Adapter Codex (ADR-002)]
  KS[HARNESS_GATES=off] -->|bypass log| CDX
  INV[Inventário I1] --> ADR2[ADR-002 hooks/gates]
  INV --> ADR3[ADR-003 agentes/regras/config]
```

## 15. Delta Specs

N/A — ADR-001 não altera documentos vivos (`.agents/rules/**`, `AGENTS.md`). O contrato é consumido por ADR-002/ADR-003, que declararão seus próprios deltas ao serem implementados. Motivo: `N/A — decisão de contrato; alteração de docs vivos ocorre em ADR-002/ADR-003`.

## 16. Rastreabilidade ADR → RF/NFR

| ADR item | RF/NFR |
|---|---|
| I1 (inventário fechado) | RF-01, RF-08, RF-09, RF-10, NFR-05 |
| I2 (reason codes) | RF-02, NFR-01, NFR-08 |
| I3 (deny semantics) | RF-03, NFR-06 |
| I4 (kill-switch) | RF-04, NFR-07 |
| I5 (dual-run) | RF-05, NFR-05 |
| I6 (bypass surface) | RF-06 |
| I7 (verificação empírica) | RF-07, NFR-03 |
| PRD §5/§7/§13 | NFR-02, NFR-03, NFR-04, NFR-09 |
| RESEARCH D1/D3/D5/D6 | NFR-08, NFR-02, NFR-04 |

## 17. Portão spec-gate (auto-avaliação)

| # | Item | Status |
|---|---|---|
| 1.1 | ADRs (decisão documentada) | ✅ ADR.md presente com decisão + interface congelada |
| 1.2 | DDD Modular (api/impl/public) | N/A — sem código/módulos neste ciclo |
| 1.3 | Segurança/IAM (auth + @HasPermission) | N/A — sem IAM de aplicação; trust de hooks documentado (§11) |
| 2.1 | ERD | N/A — sem entidade nova (§8) |
| 2.2 | Event Registry | N/A — sem eventos novos (§9) |
| 2.3 | Migrations | N/A — sem banco/ORM (§10) |
| 3.1 | Invariantes de entidade | N/A — sem entidade nova; invariantes de contrato em §7 |
| 3.2 | Invariantes de workflow | ✅ §7 (INV-1..INV-6) |
| 3.3 | Test strategy | ✅ §12 (T1–T7) |
| 4.1 | Single file | ✅ SPEC.md único |
| 4.2 | Domínio claro | ✅ portabilidade de harness (opencode↔Codex) |
