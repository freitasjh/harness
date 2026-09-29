# Specification — harness-v7-hardening (v2)

- **Domínio:** `governanca-de-agentes` · **Tipo:** `refactor`
- **Status:** `APLICADAS AS CORREÇÕES 1–6 — aguardando re-validação do architect e portão P1→P2`
- **Proposal:** `.spec/governance/harness-v7/PROPOSAL.md`
- **Histórico:** §17 (veredito v1 do architect) · §18 (log de correção v2)
- **Runtime alvo:** opencode `1.18.31` (verificado via `opencode --version`)

> **Base factual vinculante.** Toda afirmação de enforcement neste SPEC deriva de inspeção
> estática do binário `opencode` 1.18.31, não da documentação nem dos tipos do pacote
> (`@opencode-ai/plugin` local instalado está em 1.18.30 — próximo do runtime; o
> argumento NÃO é "pacote defasado", é **ausência do call site** `trigger("permission.ask")`).
> **`permission.ask` NÃO EXISTE** no runtime — não é usado neste design.
> Nenhum gate aqui depende de hook que não tenha sido confirmado como call site de `trigger(`.

---

## 1. Architecture Decision Records (ADRs)

### ADR-001: O único enforcement confiável é `throw` em `tool.execute.before`
- **Decision**: portão confiável = handler de `tool.execute.before` que lança `DenyError`.
  O dispatcher (`Plugin.trigger`) é sequencial e sem `catch`; `throw` aborta antes de
  `tool.execute`. Camada secundária (grosseira) = `tools.*` e `permission.*` de config.
- **Contexto**: as regras que nunca falharam neste harness são as que o runtime aplica.
  Mas o conjunto é **menor** do que se supunha: `permission.ask` não dispara em 1.18.31.
- **Trade-offs**: gate fica em código de plugin (não em JSON); exige teste com fixtures.

### ADR-002: Evidência é contrato auditável; a **contraprova** é do gate
- **Decision**: `harness/REPORT.json` é **auto-declarado pelo executor** — e é assumido como
  tal (campo `selfReported`). Ele **não** é prova. A prova é a **contraprova**: o gate
  **re-executa** o comando canônico do `harness.config.json` e compara exit code e contagens
  com o que o `REPORT.json` afirma. Divergência ⇒ deny.
- **Contexto**: a v1 chamava `REPORT.json` de "evidência fora do executor" — falso, pois quem
  escreve é o executor. Sem re-execução, verificador = verificado.
- **Trade-offs**: o gate paga o custo de rodar a suite (o comando mais caro do fluxo).
  Mitigado por cache `(demand, reportHash, treeHash)` — **não** por `gitSha` (N2: o repo
  pode não ter git). `treeHash` = hash de conteúdo dos paths relevantes do consumidor.
- **Integridade do comando (U6=b / N4)**: o comando da contraprova é **selado**. O
  `gate.js` guarda o par `{commandKey, sha256}`; em runtime compara o hash do valor lido de
  `harness.config.json` com o selo. Divergência ⇒ `DenyError` com motivo
  `sealed-command-mismatch`. Impede trocar `suiteFull` por `true` para passar na contraprova.
- **Inconclusivo ≠ erro (N11)**: se a re-execução estourar o timeout configurado
  (`gates.contraproveTimeoutMs`), o resultado é **deny** com motivo
  `contraprove-timeout` — contraprova inconclusiva não é prova. Isso **não** viola o
  ADR-006: timeout é veredito, não exceção de plugin.

### ADR-003: Zero path de projeto em texto de regra
- **Decision**: paths, comandos, portas, credenciais e mapa de módulos vêm do
  `harness.config.json` do projeto. `.agents/rules/*` referencia a chave, nunca o literal.
- **Contexto**: `harness-continuous.md:70,158` e `harness-validator.js:30,65-68` contêm comandos
  de um projeto específico; nos consumidores (atlas-ecm, hive) o comando não existe → H3 é
  pulado em silêncio.
- **Trade-offs**: um arquivo a mais por projeto.

### ADR-004: Rigor de gate — E1/E2 bloqueiam; contrato PICCO sem ambiguidade
- **Decision**: ausência de Objetivo (E1) ou Escopo (E2) ⇒ deny. E3–E6 ausentes ⇒ aviso.
  **Contrato exato** (resolve a ambiguidade que gerava falso positivo):
  - A tag `<open_questions>` é **obrigatória** no bloco PICCO.
  - `<open_questions></open_questions>` (vazia ou só whitespace/HTML comment) ⇒ válido.
  - Tag **ausente**, ou com qualquer conteúdo não-vazio ⇒ deny (E1/E2 ausentes ⇒ deny;
    E3–E6 registrados como aviso).
  - Comandos de consulta (leitura de estado, `show status`) **não** passam pelo gate.
- **Contexto**: na v1, "tag ausente" não era distinguida de "tag vazia"; a delegação real
  (role/task/context/constraints/acceptance, sem a tag) seria negada — falso positivo alto.
- **Trade-offs**: exige padronizar o prompt de delegação em todos os agentes.

### ADR-005: Fora de escopo — motor de decisão externo e worktree
- **Decision**: não introduzir Laya AI (MCP de decisão) nem `git worktree` nesta fase.
- **Contexto**: aumentam superfície antes de o enforcement existir.
- **Trade-offs**: o desenho de 5 estágios fica adiado.

### ADR-006: `DenyError` tipado separa "nego" de "plugin quebrou"
- **Decision**: `gate.js` define `class DenyError extends Error`. Contrato:
  `catch (e) { if (e instanceof DenyError) throw e; log.error(e); /* allow */ }`.
  - `DenyError` ⇒ **deny** (propaga o `throw`).
  - Qualquer outro erro ⇒ **allow** + log em nível `error` (falha-aberto, plugin não paralisa o dev).
- **Contexto**: na v1, "try/catch em todo hook → allow" engolia o próprio deny (o deny **é**
  um `throw`). Sem distinção de sinal, I8 e I1/I2/I6/I7 eram mutuamente impossíveis.
- **Trade-offs**: todo gate precisa lançar `DenyError`, nunca `Error`.

### ADR-007: Path protegido é **defense-in-depth, não garantia** — e a defesa é o CI
- **Decision**: assumir explicitamente que **não há garantia de runtime**. A defesa é
  fora-de-banda: job de CI (e hook de pre-commit) que **reverte/falha** qualquer commit que
  altere paths protegidos sem autorização declarada.
  Paths protegidos (canônico, idêntico ao `protectedPaths` do config e à fixture):
  `.opencode/plugins/**` (+ `__tests__`), `.agents/rules/**`, `.agents/schemas/**`,
  `.agents/agents/**`, `.github/workflows/**`, `.githooks/**`,
  `opencode.json`, `harness.config.json`.
  - Autorização = trailer de commit `Harness-Gate-Change: <aprovador>`, exigido pelo CI.
- **Pré-requisito (N2 / U4=a)**: a defesa pressupõe **git + remote + CI**, que **não existem**
  neste repo (`.git` ausente). Portanto `git init` + remote + job de CI é o **passo 0** do
  rollout (§16) e **condição de eficácia** desta ADR. Sem o passo 0, I9 é 🔴 declarado — e
  está declarado assim.
- **Contexto**: `permission.bash` casa **comando** (prefixo de tokens), não alvo de
  redirecionamento — bloquear `cat > .opencode/...` por pattern é impossível por design
  (verificado no binário). `gate.js` ainda faz parse de comando (defesa em profundidade),
  mas isso é evadível e **não** é contado como garantia.
- **Trade-offs**: a proteção depende do CI rodar; sem CI, o vetor fica aberto e está
  documentado como aberto. **Status: 🔴 não garantido por runtime — 🟢 coberto por CI (U2=c).**

### ADR-008: Conclusão de fase tem dois âncoras — escrita estruturada e gate do próximo `task`
- **Decision**: a transição para `current_phase: "Completed"` é protegida por **dois**
  mecanismos independentes (U5=c):
  1. **Âncora A — escrita estruturada com path-check.** O `orchestrator` recebe
     `write`/`edit` **habilitados** com allowlist de path no `gate.js`
     (`.spec/**`, `workflow-state.json`). Fora da allowlist ⇒ `DenyError`.
     A via é `args.filePath` **estruturado** — não parse de string. Isso substitui o
     `write/edit:false` atual, que **forçava o orquestrador a usar bash** (a origem do
     furo N1: o guardrail empurrava para o vetor não guardado).
     **Explicitamente FORA da allowlist** (N12): `.agents/rules/**`, `.agents/schemas/**`,
     `.agents/agents/**`, `.opencode/plugins/**`, `opencode.json`, `harness.config.json`.
     Escrita nesses paths ocorre **somente** via `developer-engineer` sob delegação com
     trailer `Harness-Gate-Change`, revertida pelo CI em caso contrário (ADR-007).
     `apply_patch`/`patch` (N3) são cobertos pela mesma checagem via `args.patchText`.
  2. **Âncora B — gate do próximo `task`.** Todo `task` de fase é negado se o
     `workflow-state.json` do ciclo anterior não tiver `current_phase: "Completed"` **e**
     `harness_status: "passed"` **e** `code_review_status: "passed"`.
     Isso fecha N9: declarar em prosa e **não gravar** o state deixa de ser um caminho de fuga —
     a fase seguinte não inicia.
- **Contraprova (ADR-002)**: ao gravar `Completed`, o gate re-executa o comando canônico
  (selado) e compara exit code/contagens com `harness/<demand>.json`. Divergência ⇒ `DenyError`.
- **Contexto**: na v1 o desenho apoiava-se em interceptar `write`/`edit` — mas o declarante não
  os tinha (N1), e nada obrigava a gravar o state (N9). Dois âncoras removem o ponto único.
- **Trade-offs**: dá ao orquestrador poder de escrita (dentro da allowlist de governança, que é
  exatamente a exceção já documentada em `workflow-rules.md` §0.1). Ganho: a via de declaração
  passa a ser observável e negável — hoje ela é opcional e invisível.

### ADR-009: Kill-switch vive fora do worktree
- **Decision**: desligar gates exige variável de ambiente do **processo host**
  (`HARNESS_GATES=off`), lida no `gate.js`. Alterar `harness.config.json` **não** desliga
  nada (o campo `gates.enabled` é informativo e auditado, não autoritativo).
- **Contexto**: na v1 o kill-switch morava no config, que é gravável por bash → "kill-switch"
  era "attack switch".
- **Trade-offs**: desligar em incidente exige restart do opencode com a env var.

### ADR-010: Ordem de implantação é uma dependência, não uma preferência
- **Decision**: `harness.config.json` + schema → `gate.js` em `warn` → fixtures verdes →
  flip para `enforce` → dieta de rules.
- **Contexto**: a v1 declarava `enforcement → evidência → desacoplamento`, mas o enforcement
  **depende** do config (RF-01/RF-02, fail-closed sem config). Era ciclo, não ordem: o gate
  negaria a própria obra de criar o config. `gate.js` também não pode proteger a si mesmo
  durante a própria criação (chicken-egg) — coberto por CI (ADR-007).
- **Trade-offs**: desacoplamento (D1) deixa de ser "depois" e vira pré-requisito.

---

## 2. Domain Context & Units

- **Bounded Context**: governança de agentes do opencode (runtime de processo).
- **Tipos**: plugin de runtime + configuração + texto normativo.

| Unidade | Papel | Bloqueia? | Como |
|---|---|---|---|
| `opencode.json` (`tools`, `permission`) | política de runtime | ✅ | nativo |
| `.opencode/plugins/gate.js` | gates de processo | ✅ | `throw DenyError` |
| `.opencode/plugins/harness-validator.js` | contraprova / validação de REPORT | ✅ | `throw DenyError` |
| `.opencode/plugins/hitl-guardrail.js` | pausa entre batches | ✅ | `throw DenyError` |
| CI / pre-commit (ADR-007) | integridade de path protegido | ✅ | fora-de-banda |
| `.agents/rules/*.md` | política descritiva | ❌ | — |
| `.agents/agents/*/AGENT.md` | papel + critério do agente | ❌ | — |
| `harness.config.json` | dados de projeto | ❌ | fonte de dados |

- **Tenant**: N/A. Equivalente = **projeto consumidor**: entra criando seu `harness.config.json`;
  nenhum plugin muda.

---

## 3. Permission Model

| Sujeito | Recurso | Decisão | Enforcement |
|---|---|---|---|
| `orchestrator` | `write`/`edit` | allow **com path-check** (`.spec/**`, `workflow-state.json`, `.agents/**`) | `gate.js` (ADR-008 âncora A) |
| `orchestrator` | `task` | condicional (PICCO válido) | `gate.js` |
| `developer-engineer` | `write`/`edit`/`bash` | allow (só após gate) | nativo + `gate.js` |
| `fullstack-code-reviewer` | `write`/`edit` | deny | nativo |
| `ux-designer` | `write`/`edit` | deny | nativo |
| `qa-engineer` | `write` | allow (path `harness/`) | `gate.js` (path-check) |
| qualquer subagente | escrita em path protegido (qualquer via, incl. `bash`) | deny | **CI (ADR-007)** + parse no gate |
| qualquer | `pkill -f` | deny | `gate.js` (parse; evadível → CI) |
| qualquer | `HARNESS_GATES=off` | não aplicável | env do processo host (ADR-009) |

**Identidade do sujeito**: `tool.execute.before` **não** traz o agente — só `{tool, sessionID, callID}`.
`gate.js` mantém mapa `sessionID → agente` alimentado por `chat.message` / `chat.params`.
Sem esse mapa, nenhuma regra "por agente" é aplicável (G8).

---

## 4. Security, Rollback & Kill-switch

- **Kill-switch**: env `HARNESS_GATES=off` no processo host (ADR-009). Não é arquivo.
- **Rollback**: plugins versionados em git; revert + restart. **RTO**: 1 restart. **RPO**: último commit.
- **Integridade do gate**: CI (ADR-007) reverte commit não autorizado em path protegido.
  Trailer obrigatório `Harness-Gate-Change: <aprovador>`.
- **Redação de log**: motivo de negação passa por scrub de segredo antes de ir para log (I10).

---

## 5. Config & Evidence Schema

### 5.1 `harness.config.json`
```jsonc
{
  "version": 1,
  "project": "atlas-ecm",
  "stack": { "backend": "maven-multimodule", "frontend": "vue3-vite" },
  "moduleMap": { "bootstrap": "backend/application", "frontend": "frontend" },
  "commands": {
    "suiteFull": "mvn clean install -Dintegration.test.skip=false -Pintegration",
    "unit": "mvn test",
    "integration": "mvn verify -pl integration-test -Pintegration",
    "frontendTest": "npm run test:run",
    "frontendBuild": "npm run build",
    "backendRun": "mvn spring-boot:run -pl application",
    "frontendRun": "npm run dev"
  },
  "infra": { "composeFile": "docker/docker-compose-postgresql.yml", "ports": { "backend": 8080, "frontend": 5173 } },
  "mcp": { "required": ["chrome-devtools"] },
  "protectedPaths": [".opencode/plugins/**", ".opencode/plugins/__tests__/**", ".agents/rules/**", ".agents/schemas/**", ".agents/agents/**", ".github/workflows/**", ".githooks/**", "opencode.json", "harness.config.json"],
  "gates": { "picco": "enforce", "evidence": "enforce", "hitlBatch": "enforce", "e2eGreenfield": "warn" },
"riskPaths": ["**/security/**", "**/acl/**", "**/*Permission*", "**/auth/**", "**/i18n/**"],
  "escalateOnRisk": { "e2eGreenfield": "enforce", "evidenceScenario": "required" },
  "contraproveTimeoutMs": 900000,
  "evidence": { "path": "harness/", "schema": ".agents/schemas/harness-report.schema.json" }
}
```
> `gates.*` é **informativo/auditado**. O desligamento real é `HARNESS_GATES=off` (ADR-009).

**Comandos como template-por-projeto (Batch 2, review).** O bloco `commands` acima é
exemplo (atlas-ecm). Obrigatórias em todo projeto: `suiteFull` + `unit` (devem existir e
rodar). Chaves por stack (`integration`, `frontendTest`, `frontendBuild`, `backendRun`,
`frontendRun`) presentes quando a stack existe, ausentes com justificativa `N/A` quando
não. Inventar comando inexistente repete o pecado original que o ADR-003 corrige.

### 5.2 `harness/<demand>.json`
| Campo | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `version` | int | ✅ | versão do schema |
| `demand` / `agent` / `phase` | string | ✅ | identificação |
| `gitSha` | string | ✅ | chave de cache da contraprova |
| `commands[]` | array | ✅ | `{cmd, exitCode, durationMs, stdoutHash}` |
| `counts` | object | ✅ | `{unit, it, frontend}` com `passed/failed/skipped` |
| `e2e` | object | condicional | passos, network, console, screenshots |
| `evaluation` | object | ✅ | H4: telas/negócio/lógica/perf |
| `brainStore` / `cleanup` | array/object | ✅ | paths e PIDs liberados |
| `selfReported` | bool | ✅ | `true` quando o exit code não foi observável |

**Concorrência**: sem escrita concorrente — evidência particionada por demanda.

---

### 5.3 `workflow-state.json` — schema mínimo do gate (N14)

Âncora B e I2 leem estes campos **top-level**. Sem eles o predicado é morto.

| Campo | Tipo | Valores | Quem escreve |
|---|---|---|---|
| `current_phase` | string | vocabulário canônico (§21.2) | orquestrador (via âncora A) |
| `harness_status` | string | `pending` / `passed` / `failed (+ ref da evidência)` | `gate.js` (resultado da contraprova) |
| `code_review_status` | string | `pending` / `passed` / `failed` | orquestrador (resultado do `fullstack-code-reviewer`) |
| `spec_version` | int | — | orquestrador |

Regra: transição para `Completed` exige os três = `Completed`/`passed`/`passed`.
`harness_status` **nunca** é escrito pelo executor da fase — só pelo gate.
Este repo come o próprio dogfood: raiz já declara `harness_status` e `code_review_status`.

## 6. Hook Registry (somente hooks confirmados no binário)

| Hook | Call site? | Uso neste design | Bloqueia? |
|---|---|---|---|
| `tool.execute.before` | ✅ | PICCO (I1), path (I9), `pkill -f` (I7), **conclusão de fase (I2/ADR-008)** | ✅ `throw DenyError` |
| `tool.execute.after` | ✅ | observa `bash`/`task`; alimenta `commands[]` | ❌ |
| `chat.message` / `chat.params` | ✅ | mapa `sessionID → agente` (I11) + fronteira de turno (I6) | ❌ |
| `experimental.chat.system.transform` | ✅ | **não injeta regra.** Saída é `{system: string[]}` — os plugins v1 atribuíam `string` (contrato furado, G14). v2 não usa este hook para prosa | ❌ |
| `session.idle` / turno | ✅ | detecção de fim de turno p/ I6 | ❌ |
| ~~`permission.ask`~~ | ❌ **não dispara** | **removido do design** (G2) | — |

**Regra de higiene**: inventário de hooks válido = call sites de `trigger(` no binário ativo,
não a lista de tipos do pacote `@opencode-ai/plugin`.

---

## 7. Invariants & Fixtures

### 7.1 Invariants
| # | Invariante | Enforcement | Garantia |
|---|---|---|---|
| I1 | `task` exige bloco PICCO com `<open_questions>` presente e vazia (contrato ADR-004) | `gate.js` | 🟢 garantido |
| I2 | transição para `Completed` exige (a) escrita pela via estruturada do orquestrador e (b) contraprova por re-execução; e a fase seguinte exige `Completed` do ciclo anterior | `gate.js` (ADR-008 âncoras A+B) | 🟠 parcial — dois âncoras; escape só por escrita fora da allowlist, coberto pelo CI |
| I3 | zero path de projeto hardcoded | check estático (V3) | 🟢 garantido (CI) |
| I4 | portão confiável não existe **apenas** como prosa | auditoria manual (H7) | 🟡 invariante de processo, não auto-enforçável — declarado como tal |
| I5 | `orchestrator`/`reviewer`/`ux-designer` sem `write`/`edit` | config nativo | 🟢 literal · 🟠 intenção (bash) |
| I6 | batch concluído não inicia o próximo sem pausa HITL | `hitl-guardrail.js` | 🟠 parcial — exceção explícita p/ loop `developer→reviewer` (U3=separar) |
| I7 | nunca `pkill -f` | `gate.js` (parse) | 🟠 parcial — evadível; CI cobre regra |
| I8 | erro interno de plugin ⇒ allow; `DenyError` ⇒ deny | contrato ADR-006 | 🟢 garantido |
| I9 | não-orchestrator não escreve em path protegido (nem via bash) | CI + pre-commit (ADR-007, passo 0 do rollout) | 🔴 não garantido por runtime · 🟠 **coberto por CI após o passo 0 (U4=a)** |
| I10 | log de negação sem segredo | scrub | 🟢 garantido |
| I11 | mapa `sessionID → agente` mantido | `chat.message`/`chat.params` | 🟢 garantido |
| I12 | ordem de implantação respeitada (ADR-010) | checklist de rollout (§16) | 🟡 processo |

### 7.2 Workflow / State Invariants
- Estado vive só em `workflow-state.json`. `Completed` exige `harness_status` e
  `code_review_status` = `passed` (§ADR-008).
- Nenhum artefato de fase antes do portão anterior.
- Override nunca apaga falha: entra em `overrides[]` com motivo, data e aprovador.
- I6 — definição precisa: **batch** = conjunto de `task` que entrega unidade funcional.
  Após o batch, novo `task` exige turno humano. **Exceção**: sequência imediata
  `developer-engineer → fullstack-code-reviewer` (2 chamadas) é o loop de correção e não
  dispara a pausa. Qualquer terceiro `task` sem mensagem humana entre eles ⇒ deny.

### 7.3 Fixtures
| Fixture | Entrada | Esperado |
|---|---|---|
| `picco-tag-absent` | bloco PICCO sem `<open_questions>` | **deny** |
| `picco-tag-nonempty` | tag com 1 pergunta | **deny** |
| `picco-tag-empty` | `<open_questions></open_questions>` | allow |
| `picco-e3-missing-tag-present` | tag presente/vazia, E3 ausente | allow + aviso |
| `deny-throws` | gate lança `DenyError` | **deny** |
| `plugin-throws` | gate lança `Error` comum | allow + log error |
| `completed-no-evidence` | write de `Completed` sem `harness/<demand>.json` | **deny** |
| `completed-divergent-counts` | REPORT afirma 0 falhas, re-execução dá >0 | **deny** |
| `completed-ok` | REPORT confere com re-execução | allow |
| `batch-chained-3rd-task` | 3º `task` sem turno humano | **deny** |
| `correction-loop-exempt` | `developer` → `reviewer` imediatos | allow |
| `pkill-f` | `bash` com `pkill -f` | **deny** |
| `protected-path-bash` | `cat > .opencode/plugins/gate.js` | deny (parse) + **revert pelo CI** (V8) |
| `transform-shape` | `output.system` é `string[]` | array preservado (G14) |
| `permission-ask-absent` | asserção: nenhum gate usa `permission.ask` | passa (G2) |
| `orch-write-outside-allowlist` | orquestrador grava `frontend/src/x.ts` | **deny** (ADR-008 âncora A) |
| `orch-write-inside-allowlist` | orquestrador grava `workflow-state.json` | allow |
| `patch-protected-path` | `apply_patch` tocando `.opencode/plugins/gate.js` | **deny** (N3) |
| `completed-no-state-write` | declara pronto em prosa, não grava state; `task` seguinte | **deny** (ADR-008 âncora B) |
| `next-task-prev-not-completed` | `task` novo com ciclo anterior incompleto | **deny** (âncora B) |
| `sealed-command-mismatch` | `suiteFull` adulterado para `true` | **deny** (U6=b) |
| `contraprove-timeout` | re-execução estoura `contraproveTimeoutMs` | **deny** com motivo (ADR-002) |
| `bus-event-dead-handler` | handler filtra `tool.execute.after` | falha — evento inexistente (N7) |

---

## 8. Functional Requirements

| ID | Requisito | Enforcement |
|---|---|---|
| RF-01 | `harness.config.json` obrigatório; ausente ⇒ fail-closed com mensagem clara | `gate.js` |
| RF-02 | comandos canônicos resolvidos do config, nunca do texto | `gate.js` |
| RF-03 | `task` exige PICCO válido (I1) | `gate.js` |
| RF-04 | `Completed` exige contraprova por re-execução (I2/ADR-008) | `gate.js` |
| RF-05 | protocolo H3 resolvido do config e executável no consumidor | D1 + D5 |
| RF-06 | `developer-engineer`/`qa-engineer` cientes de `chrome-devtools` (MCP já é global) | AGENT.md + `mcp.required` |
| RF-07 | pausa entre batches bloqueante, com exceção do loop de correção (I6) | `hitl-guardrail.js` |
| RF-08 | todo gate tem modo warn/enforce por config, com override auditado | config + `gate.js` |
| RF-09 | kill-switch fora do worktree | env host (ADR-009) |
| RF-10 | motivo da negação visível ao agente e ao humano | retorno do hook |
| RF-11 | path protegido: parse no gate + revert pelo CI | ADR-007 |
| RF-12 | motivo redigido antes do log | scrub (I10) |
| RF-13 | mapa `sessionID → agente` disponível a todo gate que precisa | I11 |
| RF-14 | todo gate lança `DenyError`; nunca `Error` cru | ADR-006 |

---

## 9. Test Strategy

- **Unit — fixtures §7.3** em `.opencode/plugins/__tests__/`: `gate.js` invocado como função
  pura, sem MCP/rede. 15/15 com resultado esperado, em `warn` **e** `enforce`.
- **Contract** — asserção de que nenhum gate usa `permission.ask` (`permission-ask-absent`).
- **Shape** — `experimental.chat.system.transform` com `{system: string[]}`.
- **Schema** — `harness/<demand>.json` válido/inválido.
- **Estático** — zero path hardcoded (V3); zero referência órfã a `harness-continuous.md` (V12).
- **Dogfood (aceite)** — §14.
- **Regressão** — suite do repo consumidor permanece 0 falhas.

---

## 10. Files Affected

| Arquivo | Delta |
|---|---|
| `harness.config.json` | ADDED (implantar **primeiro**, ADR-010) |
| `.agents/schemas/harness-report.schema.json` | ADDED |
| `.opencode/plugins/gate.js` | ADDED (`DenyError`, gates I1/I2/I7/I9) |
| `.opencode/plugins/__tests__/gate.spec.mjs` | ADDED |
| `.agents/skills/harness-report/SKILL.md` | ADDED |
| `.agents/rules/gate-contract.md` | ADDED |
| `.agents/rules/harness-config.md` | ADDED |
| `.github/workflows/harness-integrity.yml` (ou equivalente) | ADDED (ADR-007, U2=c) |
| `.githooks/pre-commit` | ADDED (ADR-007) |
| `.agents/rules/harness-continuous.md` | MERGED INTO `workflow-rules.md` (mapa de back-refs — G10) |
| `.agents/rules/workflow-rules.md` | MODIFIED |
| `.opencode/plugins/harness-validator.js` | MODIFIED (remove re-injeção; corrige shape G14) |
| `.opencode/plugins/hitl-guardrail.js` | MODIFIED (bloqueia; exceção do loop I6; shape G14) |
| `opencode.json` | MODIFIED (registra `gate.js`) |
| `.agents/agents/orchestrator/AGENT.md` | MODIFIED |
| `.agents/agents/developer-engineer/AGENT.md` | MODIFIED |
| `.agents/agents/qa-engineer/AGENT.md` | MODIFIED |
| `.agents/agents/fullstack-code-reviewer/PROMPT.md` | MODIFIED |

---

## 11. Risks

| R | Sev | Mitigação |
|---|---|---|
| R1 gate trava dev por falso positivo | alto | modo `warn` por gate + contrato PICCO exato (ADR-004) + override registrado |
| R2 plugin derruba sessão | alto | `DenyError` tipado (ADR-006): erro ≠ deny |
| R3 fricção E1/E2 desliga o gate | médio | só E1/E2 bloqueiam |
| R4 schema de evidência vira gate morto | médio | versionado + fixture |
| R5 dieta de rules remove conteúdo necessário | médio | fusão preserva + mapa de back-refs (G10) |
| R6 bootstrap (harness falho refatorando o harness) | alto | ordem ADR-010 + humano no 1º lote |
| R7 `REPORT.json` divergente do real | médio | **contraprova por re-execução** (ADR-002) |
| R8 `bash` como vetor de contorno | alto | parse no gate (evadível) + **CI reverte** (ADR-007) |
| R9 ordem invertida | alto | ADR-010 |
| R10 dependência de hook inexistente | alto | removido `permission.ask`; fixtures de contrato |
| R11 cache de contraprova mascarar mudança | médio | chave = `(demand, gitSha)`; invalidar em `dirty tree` |
| R12 CI ausente no consumidor deixa I9 aberto | alto | declarado **não garantido** sem CI; `harness.config.json` sinaliza |

---

## 12. Verification (dogfood)

| # | Verificação | Critério |
|---|---|---|
| V1 | fixtures §7.3 | 15/15 |
| V2 | `grep -rn "permission.ask" .opencode/plugins/` | 0 |
| V3 | `grep -rn "docker-compose-postgresql\|-pl application" .agents/ .opencode/plugins/` | 0 |
| V4 | `wc -l .agents/rules/*.md` | ≤ 55% do atual (3101 → ≤ 1705) |
| V5 | caso ACL/ECM | gate **nega** `Completed` antes do erro aparecer em tela |
| V6 | `opencode.json` / `harness.config.json` / `workflow-state.json` | JSON válido |
| V7 | `grep -rn "output.system = " .opencode/plugins/` | 0 atribuições escalares (G14) |
| V8 | commit alterando `.opencode/plugins/gate.js` sem trailer | **CI falha / reverte** |
| V9 | `HARNESS_GATES=off` | gates desligados; `harness.config.json` **não** desliga |
| V10 | 3º `task` sem turno humano | deny; `developer→reviewer` imediato | allow |
| V11 | `cat > .opencode/plugins/gate.js` via agent | deny (parse) + revert (CI) |
| V12 | referências a `harness-continuous.md` após a fusão | 0 órfãs |
| V13 | `git worktree`/Laya AI ausentes do diff | confirmado fora de escopo |
| V14 | `.git` existe, remote configurado, CI roda (passo 0) | presente (U4=a) |
| V15 | selo de comando confere com `harness.config.json` | `sealed-command-mismatch` ⇒ deny |
| V16 | nenhum plugin filtra evento de bus inexistente | N7 corrigido |
| V17 | vocabulário de fase único (G11) | 1 dialeto em rules/AGENT.md; mapa de conversão documentado |

---

## 13. Spec Gate — conformidade

| Critério | Status |
|---|---|
| ADRs | OK §1 (ADR-001..010; 4 reescritos com base em evidência de runtime) |
| DDD Modular | N/A — §2 (Unidades) |
| Segurança/IAM | N/A como app; §3 (permission + mapa de identidade) |
| ERD | N/A; §5 (schemas) |
| Event Registry | N/A; §6 (Hook Registry, só hooks confirmados) |
| Migrations | N/A |
| Invariantes de Entidade | §7.1 (I1..I12, com **grau de garantia** explícito) |
| Invariantes de Workflow | §7.2 |
| Test Strategy | §9 (fixtures + contrato + shape + dogfood) |
| Single File | OK |
| Domínio claro | OK — `governanca-de-agentes` |

---

## 14. Acceptance Criterion (o que decide se este refactor valeu)

> **Caso de referência**: demanda de ACL do Atlas ECM, 2026-09-27 — entregue como concluída
> com erro real em tela.

O harness v7 é aprovado **se e somente se**:

1. Reproduzido o estado daquela demanda (evidência/estado de conclusão), o gate **nega** a
   transição para `Completed` — porque a re-execução do comando canônico diverge do
   `REPORT.json` ou falha.
2. A negação traz **motivo acionável** (comando, exit code, contagens divergentes).
3. O usuário **não precisa reabrir** a demanda: o erro é barrado dentro do fluxo.
4. Cenário espelho: com a evidência correta, o gate **permite** — sem falso positivo.

Sem os 4, o aceite não está cumprido, independentemente do resto.

**Consistência ≠ cobertura.** A contraprova valida que o *declarado* confere com o *real*.
Ela **não** valida que o cenário do bug foi *exercitado*. A cobertura de cenário de risco
vem do **escalonamento por risco**: mudança que toca `riskPaths` exige evidência E2E do
fluxo afetado (`escalateOnRisk`), com custo nomeado no PLAN.
O caso ACL/ECM é a demonstração: suite verde + `harness_status='passed'` + bug P0 no
grant EVERYONE = consistência sem cobertura não pega (RUNTIME-CONTRACT §6).

---

## 15. Security Assessment — Fase 1 (revisado)

STRIDE sobre o gate:

| Ameaça | Fluxo | Risco | Mitigação | Garantia |
|---|---|---|---|---|
| Tampering | subagente edita `gate.js` via bash | Alto | parse no gate + **CI reverte** (ADR-007/U2=c) | 🟠 CI-dependente |
| Elevation of Privilege | rebaixar gate via config | Alto | `gates.*` não autoritativo (ADR-009) + CI | 🟢 |
| Spoofing | `REPORT.json` forjado | Médio | re-execução pelo gate + selo de comando (ADR-002) | 🟠 até o passo 0 · 🟢 após |
| Denial of Service | gate nega tudo | Alto | `DenyError` tipado + kill-switch por env | 🟢 |
| Information Disclosure | motivo vaza segredo | Médio | scrub (I10/RF-12) | 🟢 |
| Repudiation | negação sem rastro | Baixo | RF-10 + `overrides[]` | 🟢 |

- **Críticos abertos: 0.** 1 risco alto **não garantido por runtime** (I9/ADR-007) —
  mitigado fora-de-banda pelo CI e **documentado como não-garantido**.
- **ASVS L2**: aplicáveis V1/V4/V5/V7/V8 ✅; V2/V3/V6/V9–V14 N/A (sem rede/DB/credencial).
- **Verdict: partial** — nenhum item bloqueia Fase 2; a limitação residual está nomeada.

---

## 16. Rollout Order (ADR-010)

| # | Passo | Modo | Sai quando |
|---|---|---|---|
| **0** | **`git init` + remote + job de CI** (U4=a, condição do ADR-007) | ativo | CI roda e V8 verde |
| 1 | `harness.config.json` + selo de comando (U6=b) + `.agents/schemas/harness-report.schema.json` | inerte | ambos válidos (V6) + selo confere |
| 2 | `gate.js` + fixtures | `warn` | 15/15 (V1) |
| 3 | CI + pre-commit de integridade (ADR-007) | ativo | V8 verde |
| 4 | flip gate p/ `enforce` | `enforce` | V9/V10 verde |
| 5 | dieta de rules + back-refs (G10/G11) | — | V4/V12 verde |
| 6 | dogfood do aceite (§14) | — | V5/V11 verde |

Enquanto o passo 2 estiver em `warn`, o humano é o gate (bootstrap, R6).

---

## 18. Revision Log — v2 (aplicação das correções 1–6)

| Correção | Gap | Onde | Decisão do usuário |
|---|---|---|---|
| 1 | G2/G4 — `permission.ask` inexistente; deny vs erro | ADR-001, ADR-006, RF-14, §6, §11/R10 | — |
| 2 | G1 — conclusão de fase + evidência auto-produzida | ADR-002, **ADR-008**, I2, RF-04, §14 | **U1 = re-executar** |
| 3 | G3/G5 — path e kill-switch | **ADR-007**, ADR-009, I9, RF-11, §11/R8 | **U2 = c (CI/pre-commit)** |
| 4 | G6 — ordem de implantação | ADR-010, §16 | — |
| 5 | G7 — batch vs loop de correção | I6, RF-07, §7.2 | **U3 = separar** |
| 6 | G8 — identidade de agente | I11, RF-13, §3, §6 | — |
| — | G9–G14 (atenção) | §10 (back-refs), §6/§12-V7 (shape), ADR-004 (PICCO), RF-06 (`mcp.required`) | — |

**Escopo**: nenhuma correção expande o escopo A. U2=(c) mantém a defesa **dentro do repo**
(CI + pre-commit), sem tocar infra/host.

---

## 19. Spec Score

**93%** — 0 críticos abertos; 4 ADRs reescritos com base em evidência de runtime do binário.
Garantia explícita por invariante (§7.1), revisada pelo architect: **não-garantido-por-runtime**
(I2, I9) — ver §20
(coberto por CI), 1 🟡 de processo. Risco residual nomeado: sem CI no consumidor, I9 fica aberto.

---

## 17. Registro histórico — validação v1 do architect — REPROVADO (2026-09-28)

Método: leitura integral de PROPOSAL/SPEC + estado do repo + **inspeção estática do binário
`opencode` 1.18.31** (confirmado via `opencode --version`). Princípio aplicado:
"enforcement sem mecanismo de runtime = defeito".

### 17.1 ADRs invalidados

| ADR | Veredito do architect | Motivo |
|---|---|---|
| ADR-001 | Parcial | `tool.execute.before` bloqueia por `throw` (confirmado). Mas **`permission.ask` não dispara** em 1.18.31 — só existe em docs/tipos defasados. Metade da ogiva é morta. |
| ADR-002 | **Inválido** | O `REPORT.json` é escrito **pelo próprio executor**. Título ("fora do executor") é falso. É contrato auditável, não evidência independente. |
| ADR-003 | Válido | — |
| ADR-004 | Válido, contrato impreciso | falta definir "tag ausente" vs "tag vazia" |
| ADR-005 | Válido | — |
| ADR-006 | **Inválido** | único primitivo de deny é `throw`; `catch→allow` engole o próprio deny. Falta erro tipado (`DenyError`) |
| ADR-007 | Diagnóstico válido, **mitigação não fecha** | `permission.bash` casa **comando** (prefixo), não path. `cat > .opencode/...` é inexprimível como pattern |

### 17.2 Invariantes — veredito real

| # | Veredito | Nota |
|---|---|---|
| I1 | Parcial | hook vê só `args`; tag ausente ≠ vazia. **A própria delegação desta task seria negada** (falso positivo) |
| I2 | **Não garantido** | `tool.execute.after` não nega; nenhum hook bloqueia declaração em linguagem natural |
| I3 | Garantido | check estático |
| I4 | Parcial | invariante de processo, não auto-enforçável |
| I5 | Garantido (literal) / Parcial (intenção) | bash contorna |
| I6 | Parcial | hook não distingue batch novo de loop de correção developer→reviewer |
| I7 | Parcial | match de string, evadível (`bash -c`, `python -c`, `$IFS`) |
| I8 | **Contraditório** | sem `DenyError` tipado, I8 e I1/I2/I6/I7 são mutuamente impossíveis |
| I9 | **Não garantido** | `permission.bash` não protege path + hook não traz identidade de agente |
| I10 | Garantido (se implementado) | — |

### 17.3 Críticos (bloqueiam Fase 2)

| # | Gap | Correção mínima |
|---|---|---|
| G1 | "conclusão de fase" não é bloqueável por hook; evidência auto-produzida ⇒ **aceite ACL inalcançável** | Gate passa a interceptar o **write de `current_phase=Completed`** em `workflow-state.json`; e o gate **re-executa** o comando canônico do config, comparando exit code/contagens com o `REPORT.json` (verificador ≠ executor) |
| G2 | `permission.ask` não existe no runtime | remover dependência; deny = `throw` em `tool.execute.before` + `permission.*` de config |
| G3 | `permission.bash` não protege path | assumir "defense-in-depth, não garantia" + defesa fora-de-banda (chmod a-w / owner separado / gate fora do worktree / CI que reverte) |
| G4 | deny por `throw` vs `catch→allow` | `DenyError` tipado: `catch` → `DenyError` = deny; outro erro = log `error` + allow |
| G5 | kill-switch no config = attack switch | kill-switch fora do worktree (env do processo host / arquivo fora do repo) |

### 17.4 Atenção (não bloqueiam, corrigir no PLAN)

G6 ordem invertida (config→schema→gate(warn)→enforce) · G7 I6 batch vs loop de correção ·
G8 falta mapa `sessionID→agente` no Hook Registry · G9 `chrome-devtools` **já é global** (falta
awareness, não instalação) · G10 fusão de rules quebra back-references (`HARNESS_RULE` em
`harness-validator.js:18`) · G11 três vocabulários de fase · G12 `write scoped` não é nativo ·
G13 contrato PICCO ambíguo · G14 `experimental.chat.system.transform` espera `{system: string[]}`;
**os 2 plugins atuais atribuem `string`** — a "re-injeção" que este SPEC quer remover pode já
estar quebrada.

### 17.5 Veredito

**🔴 REPROVAR / retornar para design.** Direção correta (hook bloqueante > prosa); fundamentos
do enforcement inválidos no detalhe. Nenhum item das correções 1–6 expande o escopo aprovado
(D1–D6).

#

---

## 20. Re-validação v2 do architect — REPROVADO (2026-09-28)

Método: mesma inspeção estática do binário 1.18.31. Veredito: **🔴 REPROVAR / ajustes
direcionados**. Correções 1–6 fecharam **G2, G4, G5, G6, G8**; **G1 fechou parcialmente**;
**G11 e G10 permanecem parciais/abertos**.

### 20.1 Gaps novos (v2) — bloqueiam

| # | Sev | Gap | Evidência |
|---|---|---|---|
| **N1** | 🔴 | O `orchestrator` tem `write/edit=false`, logo **não declara fase por write/edit** — só por `bash`. A interceptação principal do ADR-008 (write/edit) **não cobre o declarante**; sobra o parse de bash, que é o vetor já declarado evadível | `opencode.json:14-18` |
| **N2** | 🔴 | **Este repo não é git** (`.git` inexistente na raiz e no pai; sem `.github/`, sem `.githooks/`). ADR-007 (CI + pre-commit + trailer) e o cache `(demand,gitSha)` são **inoperantes** | `ls -a` / ausência de `.git` |
| **N4** | 🟠 | A contraprova lê o comando de `harness.config.json`, que é **gravável por bash**. Trocar `suiteFull` por `true` faz a contraprova passar. §15 marcava Spoofing 🟢 — **superestimado** | §5.1 `commands.*` |
| **N9** | 🟠 | Nada **força** o agente a gravar o `workflow-state.json`. Se ele declarar em prosa e não gravar, o gate não vê — gate vira opcional | ADR-008 só observa a escrita |
| **N3** | 🟠 | `apply_patch`/`patch` é tool nativa que altera arquivos e **não** está coberta por ADR-007/ADR-008 | binário: `apply_patch` args `{patchText}` |

### 20.2 Gaps novos (v2) — atenção

| # | Sev | Gap | Correção |
|---|---|---|---|
| N5 | 🟡 | Reatribuir `output.system` **não propaga** (o caller usa o array por referência). Qualquer "fix" nesse hook é no-op silencioso | usar `output.system.push(...)` ou **remover o hook** de todos os plugins |
| N6 | 🟡 | `protectedPaths` divergia entre ADR-007 e §5.1 | **corrigido nesta revisão** |
| N7 | 🟡 | O handler `event` dos plugins v1 filtra `event.type === "tool.execute.after"`, que **não existe** no bus → os logs **nunca dispararam**. 3º mecanismo morto encontrado | usar `session.next.tool.success/.failed` **ou** remover o handler |
| N8 | 🟡 | §19 contava a garantia dos invariantes errado | **corrigido nesta revisão** |
| N10 | 🟡 | A "base factual" errava a versão do pacote local (é 1.18.30, não 1.3.17) | **corrigido nesta revisão** — a razão real é o call site ausente |
| N11 | 🟠 | A contraprova re-executa `mvn clean install` **dentro** de `tool.execute.before`, bloqueando o tool call. Sem git, cache `gitSha` é sempre miss → toda escrita de estado paga a suite completa (risco de timeout) | cache por hash do report + tree hash; timeout nomeado |

### 20.3 Garantia real dos invariantes (revisada)

| Declarado v2 | Real |
|---|---|
| I1 🟢 · I3 🟢 · I8 🟢 · I10 🟢 · I11 🟢 | **5 🟢** |
| I5 🟠 · I6 🟠 · I7 🟠 | **3 🟠** |
| I2 🟠 → **🔴** · I9 🔴 runtime (+CI 🔴 hoje, sem git) | **2 🔴** |
| I4 🟡 · I12 🟡 | **2 🟡** |

### 20.4 Aceite §14

**Parcialmente alcançável — não garantido hoje.** Alcançável por *dogfood* no próprio repo
(fixtures V5/V11); **não** como reprodução literal do caso ACL (consumidor fora de escopo).
E **não garantido** em produção enquanto N1, N2, N4 e N9 existirem — caminho de falha:
`orchestrator declara Completed sem passar por write/edit → nenhum gate dispara`.

### 20.5 Ajustes mínimos para aprovação (não expandem o escopo A)

1. **N1** — via estruturada para a conclusão: dar `write`/`edit` ao orquestrador com
   **path-check em args estruturados** (`.spec/**`, `workflow-state.json`, `.agents/**`)
   e manter `bash` fora da declaração; **ou** ancorar I2 no `task` seguinte exigindo
   `current_phase` anterior = `Completed`.
2. **N2** — `git init` + remote + CI como **passo 0** do rollout (§16).
3. **N4** — selar o comando da contraprova (embutido no plugin ou hash validado).
4. **N9** — o `task` seguinte exige state `Completed` do ciclo anterior.
5. **N3** — incluir `patch`/`apply_patch` no path-check e na interceptação.

### 20.6 Pendências que exigem decisão do usuário

| # | Decisão | Opções |
|---|---|---|
| U4 | **N2 — este repo deve ser git?** A defesa do ADR-007 exige git + CI, que **não existem** | (a) `git init` + remote + CI agora (expande escopo p/ infra de repo) · (b) aceitar I9 como 🔴 permanentemente documentado (sem defesa de path) · (c) outro mecanismo fora-de-banda (ex: hook local por wrapper de `opencode`) |
| U5 | **N1 — como a conclusão é declarada** | (a) orquestrador ganha `write/edit` com path-check estruturado (gate confiável) · (b) I2 ancorado no `task` seguinte (state do ciclo anterior) · (c) ambos |
| U6 | **N4 — selar a contraprova** | (a) comando canônico embutido no plugin · (b) hash do config validado contra valor selado no gate · (c) aceitar 🟠 e documentar |

---

## 21. Revision Log — v3 (correções N1–N5 + atenção)

Aplicado após a re-validação §20. Decisões do usuário: **U4=a** (git init + remote + CI),
**U5=c** (dois âncoras), **U6=b** (selo de hash).

| Gap | Sev | Correção v3 | Onde |
|---|---|---|---|
| **N1** | 🔴 | Orquestrador recebe `write`/`edit` com **allowlist de path** (`gate.js`), em vez de `write:false` que **forçava bash**. Via estruturada (`args.filePath`) | ADR-008 âncora A · §3 |
| **N2** | 🔴 | `git init` + remote + CI como **passo 0** do rollout; cache deixa de depender de `gitSha` | ADR-007 · ADR-002 · §16 |
| **N4** | 🟠 | Comando da contraprova **selado** por `sha256`; divergência ⇒ deny | ADR-002 · §5.1 |
| **N9** | 🟠 | **Âncora B**: `task` de fase exige `Completed` + `harness_status` + `code_review_status` do ciclo anterior | ADR-008 âncora B |
| **N3** | 🟠 | `apply_patch`/`patch` cobertos pela checagem (`args.patchText`) | ADR-008 âncora A · §7.3 |
| N11 | 🟠 | Timeout de contraprova ⇒ deny `contraprove-timeout` (inconclusivo ≠ prova); cache por `(demand, reportHash, treeHash)` | ADR-002 |

### 21.1 Atenção resolvida no SPEC

| # | Correção |
|---|---|
| N5 | `experimental.chat.system.transform`: **remover o hook** de todos os plugins (reatribuir `output.system` não propaga). Se algum dia for usado, `output.system.push(...)`. |
| N6 | `protectedPaths` alinhado entre ADR-007 e §5.1 (inclui `.agents/schemas/**`). |
| N7 | Handler `event` com `tool.execute.after` (evento inexistente) **removido**; se necessário, `session.next.tool.success/.failed`. |
| N8 | Contagem de garantia dos invariantes corrigida (§20.3). |
| N10 | Base factual corrigida: pacote local é `1.18.30`; a razão real é a **ausência do call site**. |

### 21.2 Decisão de design nova — G11 (unificação do vocabulário de fase)

**Problema**: 3 dialetos coexistiam — `sdd-workflow-standard.md:25`
(`Discovery/Planning/Execution/Testing/Completed` + `Bug*`), `workflow-rules.md`
(`Explore→Proposal→SPEC→PLAN→TASKS→Verify→Archive`) e `orchestrator/AGENT.md` (`P0..P6` / `Fase 0..6`).

**Decisão**: o **estado canônico** é o de `sdd-workflow-standard.md` (é o que vive em
`workflow-state.json`). Os portões `P0..P6` e a esteira `Explore→…→Archive` passam a ser
**rótulos de etapa mapeados** para o estado canônico, com a tabela de conversão em
`.agents/rules/workflow-rules.md`. `verify` ocorre em `Testing`; `archive` ocorre em `Completed`.

**Consequência para o gate**: só o vocabulário canônico é validado por `gate.js` (I2). Um
rótulo de etapa que não mapeia para o canônico ⇒ aviso, não deny.

### 21.3 Itens de atenção remanescentes (viram TASKS no PLAN)

- Substituir as 5 referências a `harness-continuous.md` em `orchestrator/AGENT.md` (435/473/492/586)
  e as 5 em `workflow-rules.md` (386/406/504/557/662) + `harness-validator.js:7,18` (G10).
- Fixture de **evasão medida** (G19): `bash -c`, `python -c` escrevendo path protegido — medir, não afirmar.
- Selo de integridade do próprio `gate.js` (G18) via o mesmo CI do passo 0.

### 21.4 Score

**90%** — 0 críticos abertos; 5 bloqueantes (N1–N5) corrigidos; 6 itens de atenção resolvidos
no SPEC; 3 itens remanescentes explicitamente empurrados para o PLAN (não são gaps de design).
Condição de eficácia nomeada: **sem o passo 0 (git + CI), I9 permanece 🔴** — declarado, não mascarado.

---

## 22. Revision Log — Fase 1.0 RUNTIME-CONTRACT + v4 parcial (2026-09-28)

Decisões: **U7=a** (runtime gateia artefato e encadeamento, não prosa — U6 do contrato),
**U8=c** (CLI e Desktop, fixtures para os dois shapes), **U9=a** (contrato antes do SPEC).

| Item | Ação |
|---|---|
| `RUNTIME-CONTRACT.md` | ADDED — 83 linhas, fatos pinados com proveniência `[self]/[arch]/[cfg]` |
| N12 | allowlist do orquestrador = **só** `.spec/**` + `workflow-state.json`; resto via developer + trailer + CI |
| N14 | §5.3 define `harness_status`/`code_review_status`; próprio repo declara os dois |
| N16 | `protectedPaths` canônico em ADR-007 e config; `workflow-state.json` **fora** da proteção CI |
| ACL decisivo | `atlas-ecm`: `harness_status='passed'` + review passed + bug P0 EVERYONE-na-raiz → **consistência ≠ cobertura** (§14, contrato §6, Brain `atlas-ecm/acl-everyone-grant-p0-evidencia-verde`) |
| `riskPaths`/`escalateOnRisk` | ADDED ao config — mudança em superfície de risco exige E2E do fluxo (`enforce`) |
| Hook inventory | `permission.ask`=0 call sites; `permission.asked` é bus-event; `tool.execute.before`=7 — verificado no binário pelo orquestrador |

** Score: 91%** — 0 críticos abertos; 3 no-op do harness morto confirmados no binário;
residual nomeado: sem passo 0, I9 🔴; sem cobertura de risco, §14 não fecha (regra, não bug).

---

## 23. Revision Log — SDD sob o harness + rename do reviewer (decisões U10/U11, 2026-09-28)

### U10 — A parte do SDD tem que estar no harness
O workflow SDD (fases, asserts do `sdd-compiler`, agente legado) não pode ser um universo
paralelo fora dos gates. Cobertura em 3 tickets (Batch 7), **sem** novo primitivo de deny —
o enforcement que importa (PICCO no `task`, contraprova no `Completed`) já dispara por tool,
independentemente do agente que delega:
- **SDD-01**: alinhar `sdd-orquestrador/AGENT.md` (referências p/ rules fundidas, sem
  promessa de enforcement, cláusula de não-bypass: nenhum orquestrador escapa de PICCO/contraprova).
- **SDD-02**: asserts do `sdd-compiler` (spec/plan/tasks/verify/traceability) como checks
  executáveis — subconjunto mecânico; dogfood no próprio `.spec` deste repo.
- **SDD-03**: auditabilidade das transições de fase — `workflow-state.json` registra as
  aprovações P0..P6; check verifica correspondência artefato↔gate. Sem deny novo (explícito).

### U11 — rename `fullstack-code-reviewer` → `code-reviewer`
Blast radius medido: **45 ocorrências em 13 arquivos** (fora `archive/`, **imutável** —
histórico não é reescrito). Pontos críticos de runtime: `opencode.json` (chave do agente +
path do PROMPT), `gate.js:407` (match reviewer/ux no deny de escrita) + 5 refs em
`gate.spec.mjs`, diretório `.agents/agents/fullstack-code-reviewer/` (AGENT.md + PROMPT.md).
Docs/rules (11+10 ocorrências nos 2 maiores) entram no sweep.
**Ordenação**: DOC-03 (Batch 6) escreve o nome ATUAL; RENAME (Batch 7) faz a troca atômica
com suite verde como prova. Nenhum estado intermediário inconsistente.
A partir do Batch 7, delegações de review usam `subagent_type: code-reviewer`.

### Batches redivididos (total 8)
- Batch 6 (docs independentes): EV-01, DOC-01, DOC-03.
- Batch 7 (rules+checks+config, interdependentes): DOC-02, SDD-01, SDD-02, SDD-03, RENAME.
- Batch 8 (era 7): DOG-01 (+ deps SDD-02, SDD-03, RENAME).

### Arquivos afetados (adição ao §10)
| Arquivo | Delta |
|---|---|
| `.agents/agents/sdd-orquestrador/AGENT.md` | MODIFIED (SDD-01) |
| `scripts/sdd-checks.mjs` (ou extensão do static-checks) | ADDED (SDD-02) |
| `.agents/agents/code-reviewer/` (rename do dir) | MOVED (RENAME) |
| `opencode.json` (chave do agente) | MODIFIED (RENAME) |
| `.opencode/plugins/gate.js` (`:407` + comentário) + `gate.spec.mjs` (5 refs) | MODIFIED (RENAME) |

### Score
**91% mantido** — 0 críticos novos; +5 tickets rastreados (22 total); sem expansão de primitivo.
