# SPEC — opencode-v2-only

> **Feature ID**: `opencode-v2-only` · **Tipo**: refactor/migração · **Status**: `Under Review`
> **Fonte**: `PROPOSAL.md` (mesmo dir) + doc oficial v2 (`/docs/agents/`, `/docs/plugins/`, 2026-10-17) + RT-02 (`workflow-state.json`)
> **Supersedes**: `opencode-v2-plugin-migration` (15/10) — a SPEC daquele ciclo prescreve `Plugin.define({id, setup})`. **Medido**: `Plugin.define` está **ausente do binário** (`grep -c`=0) e existe só como *identity shim* (`define(def)=>def`) no pacote `@opencode/plugin@2.0.29`; o contrato real é `export default {id, setup}` com `setup()` → `undefined` (ver §0)

## 0. Contratos do runtime v2 (fonte da verdade desta SPEC)

| Superfície | Contrato v2 (doc) | O que o harness tinha |
|---|---|---|
| **Agentes (JSON)** | chave `agent` (singular); **`description` OBRIGATÓRIA**; `prompt` aceita `{file:...}`; **`permission`** (o `tools` está **deprecated**) | `agent` sem `description` + mapa `agents`/`system` (não documentado) + `tools` |
| **Agentes (markdown)** | `~/.config/opencode/agents/` e `.opencode/agents/` (**plural**) | não existia |
| **Plugins** | **MEDIDO (a doc está errada):** `export default { id, setup }` — **objeto**. Default função é rejeitado pelo schema (*"Plugin must export a default definition with an id and an effect or setup function"*). `setup(ctx)` registra via `ctx.tool.hook("execute.before", h)` / `ctx.event.subscribe(t)` e **DEVE retornar `undefined`** — o loader entrega o retorno a `Effect.acquireRelease` e **chama valor truthy** (`bt(…,(t)=>t?Ae(()=>Promise.resolve(t())):g)`) ⇒ `TypeError: t is not a function` ⇒ `failed to reload plugins` | `export default {id, server, setup}` com `setup()` retornando **objeto** (inclusive no ramo `alreadyRegistered`) |
| **Chave `plugin` (config)** | **pacotes npm** | listava **caminhos locais** |
| **Plugin local** | `.opencode/plugins/` é **auto-carregado** no startup | (idem — por isso remover a chave não desligou nada) |

**Fatos medidos (não teoria)** — runtime `v2.0.32`, medido no binário pelo `code-reviewer` (2026-10-19):
- `Plugin.define` **ausente do binário** (`grep -c`=0), **mas presente** em `~/.config/opencode/node_modules/@opencode/plugin` (v2.0.29) como *identity shim*: `define(def) => def`. Ou seja: usar `Plugin.define` é indiferente — o que importa é o **shape** `{id, setup}`.
- **Payload medido de `tool.execute.before`**: `{tool, sessionID, agent, messageID, id, input}` — a chave de argumentos é **`input`**, não `args`.
- `ctx.event.subscribe()` devolve **async-iterable** (`{[Symbol.asyncIterator](){…}}`) ⇒ `for await` é válido.
- Nomes de evento de fronteira **confirmados no runtime**: `session.idle` (`{sessionID}`), `message.updated` (`{sessionID, info}` com `info.role`), `session.step.ended` (`{…, finish, rawFinish}`).
- Um `throw` do handler de `execute.before` **aborta a chamada da tool** (o deny funciona e não mata o plugin).
- `opencode debug config` prova que o runtime **lê** o `opencode.json` do projeto; a config é **re-lida a quente** (os agentes voltaram sem restart do serviço).

---

## 1. Requisitos Funcionais

### RF-01 — Plugins no contrato v2 (`{id, setup}` → hooks) 🟢 P0
Cada um dos 3 plugins (`gate.js`, `harness-validator.js`, `hitl-guardrail.js`) passa a exportar **`export default { id, setup }`** (objeto) e `setup(ctx)` **retorna `undefined`** em **todos** os caminhos, registrando os hooks pela API do `ctx`, mapeando o comportamento atual:
- `gate.js`: gates de tool → **`tool.execute.before`** (deny por `throw`); observação → `tool.execute.after`/`event`; o mapa `sessionID → agente` alimentado por `chat.message`/`chat.params` **se** o hook v2 equivalente existir.
- `hitl-guardrail.js`: fronteira de turno/batch → hook de mensagem equivalente.
- `harness-validator.js`: validação → hook equivalente.
- **Aceite**: os 3 carregam sem `TypeError` no log **e** `await setup(ctx)` devolve `undefined`; nenhum hook é registrado sem equivalente **confirmado** (hook sem equivalente ⇒ **erro visível**, nunca silêncio).
- **Aceite**: teste entra pela **entrada de produção** (handler capturado do `setup` + envelope medido `{tool,sessionID,agent,messageID,id,input}`) — não por *seam* injetado.

### RF-02 — Paridade de veredito (núcleos puros intactos) 🟢 P0
- **Aceite**: `diff` das funções puras (`decide`, `gate*`, `CORE_GATES`, `loadConfigOrDeny`, `ensureConfig`, `DenyError`) contra o HEAD = **vazio**.
- **Aceite**: matriz **deny/allow** (≥1 deny + ≥1 allow por gate) verde, provando **mesmo veredito** antes/depois.
- **Aceite**: `DenyError` continua propagando (deny) e erro comum continua **allow + log** (contrato do dispatcher).

### RF-03 — `opencode.json` v2-only ✅ (aplicado)
- **Aceite (verificado)**: 9/9 agentes com `description` + `permission`; sem `agents`/`system`; `permissions` malformado removido; `plugin` vazio; `opencode debug agents` lista os 9.
- **Aceite**: `permission.edit: "deny"` em **5** agentes — `orchestrator`/`code-reviewer`/`ux-designer`/`codebase-analyzer`/`security-engineer` (preserva a intenção de I5; ver I3).
- **Aceite (decisão do owner, 2026-10-19; **corrigido em F1** pelo review do Batch 3)**: reversão da ampliação de autoridade introduzida pela conversão v1→v2 — `edit: "deny"` em `codebase-analyzer`, `security-engineer` (o v1 tinha `tools:{write:true, edit:false}`); **`qa-engineer` foi RE-CONCEDIDO a `edit: "allow"`** (D-19) porque o papel exige gravar o REPORT `harness/<demand>.json` — com o escopo imposto pelo gate (`isHarnessScoped`). **`product-manager`/`architect` voltam a `edit: "allow"`**: `prd-adr-pipeline.md` §5 exige que criem `.spec/prd/**`, e no v2 `write` **é** a ação `edit` ⇒ negar `edit` tornaria o passo 1 da esteira inexecutável pelo dono declarado.
  - **Correção de higiene (review 2026-10-19, 🟡-N1 + S2)**: a chave `write` **não** é um recurso independente — `opencode debug config` prova que o runtime mapeia `write` → **ação `edit`** (o config renderiza `[{edit,deny},{shell,allow},{edit,deny}]`). Por isso `write: "deny"` foi **removida** do config dos 2 agentes (alias redundante); o read-only deles é `edit: "deny"` (camada nativa).
  - **Guarda pendente**: o teste (`config-dual-parity.spec.mjs:133-141`) ainda só asserta `edit: deny` para `orchestrator`/`code-reviewer`/`ux-designer` — a reversão dos **2** agentes (`codebase-analyzer`/`security-engineer`) está **sem guarda** (aceite sem mecanismo). Enfileirado em `workflow-state.json.pending_dev_queue` (`D13-guard`, P2).

### RF-04 — Merge do instalador deixa o destino **v2-only** 🟢 P0 (produto)
> **Semântica corrigida pelo review do Batch 2 (2026-10-19, C1/A1/A2)** — remoção **por forma/conteúdo**, NUNCA por nome de chave.
- **Aceite**: merge de `opencode.json` **substitui** o bloco que o harness gerencia (`agent`, `permission`) e **remove só o que o próprio harness produziu**:
  - chaves não-nativas: `system`/`server` (medido: ausentes do schema instalado) e as **formas v1** — o mapa `agents` que carrega o marcador v1 `tools` e o `permissions` que **não** é array. Shape **nativo** bem-formado (`permissions` = `{action,resource,effect}[]`; `agents` = mapa de agente nativo sem `tools`) **sobrevive** (o schema instalado `@opencode/schema@2.0.29` os declara nativos);
  - `plugin`/`plugins`: removidas **apenas** as entradas cujo path está sob `.opencode/plugins/` (string-path v1 e `{id,path}` do dual). **Preservados**: npm/specifier, `{package,options}` e path local **alheio** (ex.: `./plugins/caveman/plugin.js`) — em v2 `plugin` é a lista de **pacotes npm**, logo não é chave gerada pelo harness (evidência: array misto real em `~/.config/opencode/v1-backup-20261015/opencode.json.original`).
- **Aceite**: teste com destino que **já tinha** o shape v1/dual ⇒ resultado é **v2-only**.
- **Aceite**: destino **sem** `opencode.json` continua recebendo o template (propagação preservada).
- **Aceite**: chaves do **usuário** preservadas (`mcp` extra + união de `required`; `instructions` próprias).
- **Aceite (A2)**: idempotência por **efeito** — `planMerge` devolve `noop` quando `canon(merge(existing,incoming)) === canon(existing)`, inclusive com chaves do usuário presentes; `conflict` é checado **antes** do `noop` (não engole divergência de `mcp`).
- **Aceite (N3 — precedência declarada)**: o runtime **funde** `agent` (singular) com `agents` (plural) e, **em colisão de nome, o PLURAL vence** (medido: `agents.orch` sobrepõe `agent.orch`). Consequência: num destino que tenha o plural nativo, a config do usuário **pode sobrepor** o bloco gerenciado do harness (inclusive `permissions` do agente). Isso é aceitável (config do usuário é dele; o boundary real é o `gate.js`), mas a frase "bloco gerenciado é autoritativo" seria **falsa** em colisão — declarado aqui para não over-claimar.
- **Aceite (A4)**: o ramo `mcp.required` é **defensivo e declarado** — o template propagado **não** declara `mcp`, logo ele só roda em destino que já tenha a chave; o shape do runtime é `mcp.servers` (o `required` é chave do `harness.config.json`). Rastreado em `TD-08`.

### RF-05 — Verificação de instalação nova 🟢 P1
- **Aceite**: `init` em dir temporário gera `opencode.json` v2-only que o runtime aceita **sem WARN** de `conflict`/`malformed` (checado via `opencode debug config`/log).

### RF-06 — Prosa e esteira coerentes 🟢 P2
- **Aceite**: `.agents/rules/gate-contract.md` (I5) deixa de citar `tools.write/edit` e passa a citar `permission.edit`.
- **Aceite**: ciclo `opencode-v2-plugin-migration` declarado **superseded** (no SPEC/PROPOSAL novo + `workflow-state.json`) — **sem** editar os artefatos dele.

### RF-07 — Enforcement declarado durante a transição 🟡 P2
- **Aceite**: enquanto os plugins não carregarem, `workflow-state.json` declara **enforcement OFF** (não por kill-switch) — o estado nunca afirma gate ativo que não existe.

---

## 2. Invariantes

| # | Invariante | Prova | Nível |
|---|---|---|---|
| I1 | Núcleos puros com **diff vazio** vs HEAD | `git diff` por função | 🟢 |
| I2 | `commands.suiteFull` + **selo** intactos | `git diff --numstat harness.config.json` = 0 + suíte | 🟢 |
| I3 | Papéis sem edit (**5**): `orchestrator`/`code-reviewer`/`ux-designer`/`codebase-analyzer`/`security-engineer` | `permission.edit: deny` nos **5**; com `allow`: `developer-engineer`, `product-manager`/`architect` (esteira — F1) e `qa-engineer` (REPORT — N1; escopo imposto pelo gate: `isHarnessScoped` `gate.js:402`/`504`). Medido; `write` é alias de `edit` | 🟢 literal · 🟠 intenção |
| I4 | Nenhum hook registrado sem equivalente confirmado | revisão + teste de contrato | 🟢 |
| I5 | Propagação do `opencode.json` preservada | teste do merge | 🟢 |
| I6 | `.spec/archive/**` intocado | `git status` | 🟢 |
| I7 | `.opencode/plugins/**` continua sendo o único lugar dos plugins locais | lista de `INCOMING_ROOTS` inalterada | 🟢 |

---

## 3. Modos de falha

| Modo | Comportamento exigido |
|---|---|
| Hook v2 sem equivalente | **erro visível** (nunca registro silencioso de hook morto) |
| Config do destino com shape obsoleto | merge **remove** a chave; resultado v2-only |
| Plugin com export não-função | falha **visível** no log (não silêncio) — hoje é o `TypeError` |
| Erro comum em hook (não `DenyError`) | **allow + log** (não deny) |
| Runtime sem `description` | agente não registra ⇒ **declarado** (não é falha silenciosa do ciclo) |
| **`setup()` lança** (`HOOK-NO-EQUIV` / `GATE-ABSENT`) | **fail-closed mantido** (decisão do owner, 2026-10-19) — mas com **raio declarado**: neste runtime, falha de load de plugin derruba o **registry GLOBAL de agentes** (`failed to reload plugins` ⇒ `AgentNotFound`), i.e. harness degradado ⇒ app indisponível. Custo aceito e escrito; não é falha silenciosa. |
| **Mutação in-place de plugin com runtime vivo** | o watcher recarrega na hora; se o arquivo estiver momentaneamente inválido, o registry global cai (RT-02). Prova de mutação **só** sobre cópia em `/tmp` — nunca em `.opencode/plugins/**`. |

---

## 4. Estratégia de testes

**Suíte de referência**: `commands.suiteFull` (`harness.config.json:14`).

| Teste | Arquivo | Cobre |
|---|---|---|
| T1 | `.opencode/plugins/__tests__/gate.spec.mjs` | RF-02: matriz deny/allow; núcleos puros |
| T2 | **novo** `opencode-v2-adapter.spec.mjs` | RF-01: cada plugin exporta **objeto** `{id, setup}`; `await setup(ctx)` não lança e devolve **`undefined`**; os hooks esperados são registrados; **envelope medido** (`input`) entra pela entrada real e produz veredito |
| T3 | `installer/__tests__/merge-*.spec.mjs` | RF-04: merge substitui/limpa shape obsoleto; destino sem config recebe template |
| T4 | **novo** verificação de runtime | RF-05: instalação nova ⇒ `opencode.json` v2-only sem WARN |
| T5 | `installer/__tests__/docs.spec.mjs` | RF-06: prosa alinhada (I5 → `permission`) |

**Verificação de runtime (declarada)**: `opencode debug agents` (9) e ausência de `failed to reload plugins` no log **após** o batch de plugins. Nível: 🟢 observável · 🟡 depende do runtime vivo.

---

## 5. Declarações N/A

DDD/DB/tenancy/RBAC/eventos/Flyway: **N/A** (repo de tooling Node ESM, sem backend/DB/web). "Build": equivalente = suíte selada. Frontend DevTools: **N/A** (sem browser).

---

## 6. Rastreabilidade

| RF | Teste | Nível |
|---|---|---|
| RF-01 | T2 + verificação de runtime | 🟢 |
| RF-02 | T1 + diff dos núcleos | 🟢 |
| RF-03 | ✅ verificado (`debug agents`) | 🟢 |
| RF-04 | T3 | 🟢 |
| RF-05 | T4 | 🟢 observável · 🟡 runtime vivo |
| RF-06 | T5 + declaração de supersession | 🟢 |
| RF-07 | `workflow-state.json` | 🟡 processo |

## 7. Delta Specs

### Delta: `.agents/rules/gate-contract.md`
#### MODIFIED
> **Seção alvo**: §1, linha **I5**
```
| I5 | **5 sem `edit`**: `orchestrator`/`code-reviewer`/`ux-designer`/`codebase-analyzer`/`security-engineer`; com `edit: allow`: `developer-engineer`, `product-manager`/`architect` (esteira) e `qa-engineer` (REPORT) | `opencode.json` (`permission.edit: "deny"`) — camada nativa, grosseira (SPEC §2, ADR-001). Nota: no v2 `write` **é** a ação `edit` | 🟢 literal · 🟠 intenção — `bash` contorna (SPEC §7.1) |
```

### Delta: `.agents/rules/harness-config.md`
#### MODIFIED
> **Seção alvo**: *Command seal (ADR-002, U6=b)*
```
-`gate.js` … embeds the published seal and compares it at runtime against the value read from the config
+`gate.js` … **reads the published seal from `HARNESS_SEAL_JSON`** (rollout step 1 = the trust root, *not* the worktree; `loadPublishedSeal`, `gate.js:753-764`); **seal absent ⇒ fail-closed** (`cause: "empty-seal"`); regenerate with `sealCommands(commands)`
```
> **Motivo**: a prosa afirmava um mecanismo **inexistente** (0 literais sha256 em `gate.js`) — item **A-1** do ciclo (prosa órfã, DOC-01).

### Delta: `workflow-state.json`
#### MODIFIED
> **Seção alvo**: `prd_adr`/ciclo — declarar `opencode-v2-plugin-migration` como **superseded** por `opencode-v2-only`.
