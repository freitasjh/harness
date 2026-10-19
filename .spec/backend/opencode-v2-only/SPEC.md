# SPEC — opencode-v2-only

> **Feature ID**: `opencode-v2-only` · **Tipo**: refactor/migração · **Status**: `Under Review`
> **Fonte**: `PROPOSAL.md` (mesmo dir) + doc oficial v2 (`/docs/agents/`, `/docs/plugins/`, 2026-10-17) + RT-02 (`workflow-state.json`)
> **Supersedes**: `opencode-v2-plugin-migration` (15/10) — SPEC prescreve `Plugin.define`, inexistente no runtime instalado

## 0. Contratos do runtime v2 (fonte da verdade desta SPEC)

| Superfície | Contrato v2 (doc) | O que o harness tinha |
|---|---|---|
| **Agentes (JSON)** | chave `agent` (singular); **`description` OBRIGATÓRIA**; `prompt` aceita `{file:...}`; **`permission`** (o `tools` está **deprecated**) | `agent` sem `description` + mapa `agents`/`system` (não documentado) + `tools` |
| **Agentes (markdown)** | `~/.config/opencode/agents/` e `.opencode/agents/` (**plural**) | não existia |
| **Plugins** | módulo que exporta **função(ões)**; cada função recebe `ctx {project, client, $, directory, worktree}` e retorna **objeto de hooks** (`tool.execute.before`, `tool.execute.after`, `event`, `shell.env`, `permission.*`, `experimental.session.compacting`, `tool`) | `export default {id, server, setup}` (**objeto**) → `TypeError: t is not a function` |
| **Chave `plugin` (config)** | **pacotes npm** | listava **caminhos locais** |
| **Plugin local** | `.opencode/plugins/` é **auto-carregado** no startup | (idem — por isso remover a chave não desligou nada) |

**Fatos medidos (não teoria)**: `Plugin.define` **ausente** no binário (`grep -c`=0); presentes `tool.hook`(4), `session.hook`(12), `event.subscribe`(16), `migrate-v1`(3). `opencode debug config` prova que o runtime **lê** o `opencode.json` do projeto. Config é **re-lida a quente** (os 9 agentes voltaram sem restart do serviço).

---

## 1. Requisitos Funcionais

### RF-01 — Plugins no contrato v2 (função → hooks) 🟢 P0
Cada um dos 3 plugins (`gate.js`, `harness-validator.js`, `hitl-guardrail.js`) passa a exportar **função** que devolve **objeto de hooks**, mapeando o comportamento atual:
- `gate.js`: gates de tool → **`tool.execute.before`** (deny por `throw`); observação → `tool.execute.after`/`event`; o mapa `sessionID → agente` alimentado por `chat.message`/`chat.params` **se** o hook v2 equivalente existir.
- `hitl-guardrail.js`: fronteira de turno/batch → hook de mensagem equivalente.
- `harness-validator.js`: validação → hook equivalente.
- **Aceite**: os 3 carregam sem `TypeError` no log; nenhum hook é registrado sem equivalente **confirmado** (hook sem equivalente ⇒ **erro visível**, nunca silêncio).

### RF-02 — Paridade de veredito (núcleos puros intactos) 🟢 P0
- **Aceite**: `diff` das funções puras (`decide`, `gate*`, `CORE_GATES`, `loadConfigOrDeny`, `ensureConfig`, `DenyError`) contra o HEAD = **vazio**.
- **Aceite**: matriz **deny/allow** (≥1 deny + ≥1 allow por gate) verde, provando **mesmo veredito** antes/depois.
- **Aceite**: `DenyError` continua propagando (deny) e erro comum continua **allow + log** (contrato do dispatcher).

### RF-03 — `opencode.json` v2-only ✅ (aplicado)
- **Aceite (verificado)**: 9/9 agentes com `description` + `permission`; sem `agents`/`system`; `permissions` malformado removido; `plugin` vazio; `opencode debug agents` lista os 9.
- **Aceite**: `permission.edit: "deny"` em `orchestrator`/`code-reviewer`/`ux-designer` (preserva a intenção de I5).

### RF-04 — Merge do instalador deixa o destino **v2-only** 🟢 P0 (produto)
- **Aceite**: merge de `opencode.json` **substitui** o bloco gerenciado e **remove** chave obsoleta (`agents`, `permissions`, `plugin` com caminho local).
- **Aceite**: teste com destino que **já tinha** o shape v1/dual ⇒ resultado é **v2-only**.
- **Aceite**: destino **sem** `opencode.json` continua recebendo o template (propagação preservada).

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
| I3 | Papéis: `orchestrator`/`code-reviewer`/`ux-designer` sem edit | `permission.edit: deny` nos 3 | 🟢 literal · 🟠 intenção |
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

---

## 4. Estratégia de testes

**Suíte de referência**: `commands.suiteFull` (`harness.config.json:14`).

| Teste | Arquivo | Cobre |
|---|---|---|
| T1 | `.opencode/plugins/__tests__/gate.spec.mjs` | RF-02: matriz deny/allow; núcleos puros |
| T2 | **novo** `opencode-v2-adapter.spec.mjs` | RF-01: cada plugin exporta **função**; a função devolve hooks; `await plugin(ctx)` não lança; os hooks esperados existem |
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
| I5 | `orchestrator`/`code-reviewer`/`ux-designer` sem edit | `opencode.json` (`permission.edit: "deny"` nos 3; campo `tools` e v1-only e deprecated no runtime v2) — camada nativa, grosseira (SPEC ADR-001) | 🟢 literal · 🟠 intenção — `bash` contorna |
```

### Delta: `workflow-state.json`
#### MODIFIED
> **Seção alvo**: `prd_adr`/ciclo — declarar `opencode-v2-plugin-migration` como **superseded** por `opencode-v2-only`.
