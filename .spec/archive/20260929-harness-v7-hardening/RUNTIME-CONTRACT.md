# RUNTIME-CONTRACT — fatos pinados do runtime opencode (Fase 1.0)

> Base de todo gate do harness-v7. Proveniência por fato:
> **[self]** verificado pelo orquestrador nesta sessão · **[arch]** verificado pelo
> architect por inspeção do binário · **[cfg]** lido de arquivo de configuração.
> Fato sem proveniência não é fato — é suposição. Mudança de versão do alvo ⇒
> re-rodar a varredura + os fixtures. Toda linha de gate no SPEC/PLAN referencia
> uma linha deste contrato.

## 1. Versões

| Fato | Valor | Prov |
|---|---|---|
| CLI (`opencode --version`) | 1.18.31 | [self] |
| Runtime gerando as sessões | OpenCode Desktop (`/opt/OpenCode/ai.opencode.desktop`, PID 41003) | [self] |
| Tipos `@opencode-ai/plugin` | 1.3.17 (`~/node_modules`) e 1.14.31 (`~/.config/opencode/node_modules`) | [self] |
| Tese | tipos ≠ runtime; runtime = binário | [arch] |

**Decisão U8=(c)**: alvo = CLI **e** Desktop. Fixtures assertam os dois shapes de args.

## 2. Hooks — varredura de call sites `trigger("...")` no binário CLI

| Hook | call sites | Uso neste design |
|---|---|---|
| `tool.execute.before` | 7 | deny (único primitivo) |
| `tool.execute.after` | 7 | observação (não nega) |
| `shell.env` | 4 | — |
| `file.open` | 2 | — |
| `experimental.chat.system.transform` | 2 | **não usar** (ver H2) |
| `experimental.chat.messages.transform` | 2 | — |
| `tool.definition` | 1 | — |
| `tab.new` | 1 | — |
| `chat.params` | 1 | mapa `sessionID → agente` (I11) |
| `chat.message` | 1 | fronteira de turno (I6) |
| `chat.headers` | 1 | — |
| `command.execute.before` | 1 | — |
| `experimental.text.complete` / `session.compacting` / `provider.small_model` / `compaction.autocontinue` | 1 cada | — |
| `permission.ask` | **0** | **PROIBIDO usar em gate** |

Prov: contagens [self]; input `{tool,sessionID,callID}` + `args`, sem agente, e propagação
de `throw` (sem `catch` no dispatcher): [arch].

## 3. Negativas pinadas

| # | Fato | Prov |
|---|---|---|
| H1 | `permission.ask` não dispara — 0 call sites. `permission.asked` (12 ocorrências) é evento de bus, não hook de plugin | [self] |
| H2 | `output.system = string` não propaga — o caller usa o array por referência | [arch] |
| H3 | não existe evento de bus `tool.execute.after` — handlers que o filtram **nunca disparam** | [arch] |
| H4 | `permission.bash` casa *comando* (prefixo de tokens), não alvo de redirecionamento | [arch] |
| H5 | **nenhum hook bloqueia declaração em linguagem natural** | [arch] |
| H6 | `write` tem **dois** schemas na mesma versão: `{filePath,content}` e `{path,...}` | [arch] |

## 4. Inputs de tools

| Tool | Chaves | Prov |
|---|---|---|
| `write` | H6 — dois shapes; fixture deve assertar o do alvo | [arch] |
| `edit` | `{filePath,...}` | [arch] |
| `apply_patch` | `{patchText}` — paths **dentro do texto** (exige parser) | [arch] |
| `tool.execute.before` | input `{tool,sessionID,callID}` + `output.args`; **sem agente** | [arch] |
| `chat.params` | inclui `agent` — `sessionID → agente` é viável | [arch] |

## 5. Ambiente e evidência decisiva

| Fato | Valor | Prov |
|---|---|---|
| MCP global | `chrome-devtools` (local npx) + `brain` (remote) em `~/.config/opencode/opencode.json` | [cfg] |
| Repo `harness` | sem `.git`, sem `.github/`, sem `.githooks/` | [self] |
| DB de sessões | `~/.local/share/opencode/opencode.db` (~14 GB — não varrido; não é fonte de gate) | [self] |
| **Caso ACL/ECM** | `harness_status='passed'` + `code_review_status='passed'` **com** bug P0 posterior (perda de acesso ao conceder EVERYONE na raiz) | [self] |

## 6. Consequência de design (U7=a)

O runtime gateia o **artefato** (transição de `current_phase` para `Completed` com
contraprova) e o **encadeamento** (próximo `task` exige `Completed` do ciclo anterior).
Ele **não** gateia a **prosa**. Logo:

- **Concluído** = `workflow-state.json` diz `Completed` **com contraprova** (ADR-008).
  Prosa sem state não conta — é invariante de processo (🟡), não de runtime.
- **Contraprova** = consistência (declarado × real). **Não** é cobertura (cenário
  exercitado). Cobertura de risco = `escalateOnRisk` (§5.1), custo nomeado no PLAN.
- O caso ACL/ECM prova a distinção: consistência verde + cobertura zero = bug P0 em produção.
