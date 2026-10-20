# Change Proposal: opencode-v2-only

> **ID**: `opencode-v2-only` · **Status**: `Under Review` · **Date**: 2026-10-18
> **Tipo**: refactor/migração (comportamento observável: plugin carrega, destino recebe config válida)
> **Supersedes**: `.spec/backend/opencode-v2-plugin-migration/` (15/10) — a SPEC daquele ciclo prescreve `Plugin.define({id, setup})`, **inexistente** no runtime instalado (v2.0.32). Não será "concluído"; será declarado **superseded**.
> **Fonte dos contratos**: doc oficial v2 — `/docs/agents/` e `/docs/plugins/` (atualizada 2026-10-17), registrada no Brain em `regras/global/harness/opencode-v2-contratos-agentes-e-plugins`.

## 1. Problem Statement

- **Contexto**: o runtime instalado é **opencode v2.0.32**. Duas superfícies do harness foram escritas para a linha v1/1.18.x: o **shape dos agentes** em `opencode.json` e o **shape dos 3 plugins** (`.opencode/plugins/{gate,harness-validator,hitl-guardrail}.js`).
- **Impacto atual (medido)**:
  - **Agentes**: registravam **zero** (`opencode debug agents` só listava os 7 nativos). Causa: `description` (obrigatória no v2) ausente nos 9 + mapa `agents`/`system` (shape que o v2 não usa) vencendo o conflito de normalização sobre o shape `agent`/`prompt`. **Já corrigido e verificado** nesta sessão (9/9 voltaram).
  - **Plugins**: **não carregam** — `failed to reload plugins` + `TypeError: t is not a function` (**58 ocorrências desde 15/10**). Causa: o loader v2 chama o export como **função**; o harness exporta **objeto** (`{id, server, setup}`, com o ternário caindo no fallback porque `Plugin.define` não existe no binário).
  - **Consequência de produto**: `opencode.json` e `.opencode/plugins/**` estão em `INCOMING_ROOTS` (`installer/install.mjs:1411-1418`) ⇒ **toda instalação nova nasce com o mesmo defeito**, e o merge do `opencode.json` é **aditivo** ⇒ um destino que já tenha o shape obsoleto **o mantém**.
- **Evidência**: RT-02 em `workflow-state.json` (causa, sondas, evidência de log, o que já foi mudado) + `opencode debug config` (o runtime lê o projeto) + contagem no log (58×, crônico desde 15/10).

## 2. Proposed Solution

**Resumo**: completar a migração para o runtime v2 — plugins no contrato de **função → hooks**, e o payload do instalador deixando o destino em **v2-only** (merge que **substitui/limpa** o shape obsoleto, não só adiciona).

**Abordagem**:
- **Plugins (RF-01/RF-02)**: cada um passa a exportar **função** (`async (ctx) => ({ hooks })`) com os hooks do v2 (`tool.execute.before`, `event`, `shell.env`), **preservando os núcleos puros** (`decide`, `gate*`, `CORE_GATES`, `loadConfigOrDeny`, `DenyError`) — só o **adapter** muda. A matriz de paridade **v1×v2** deve continuar provando o **mesmo veredito** deny/allow.
- **Config (RF-03)**: `opencode.json` v2-only — **já aplicado e verificado** (agente com `description` + `permission`; sem `agents`/`system`; `plugin` vazio, pois local plugin é auto-carregado e a chave serve a pacotes npm).
- **Instalador (RF-04/RF-05)**: o merge do `opencode.json` passa a **substituir** o bloco gerenciado e a **remover** chave obsoleta (`agents`, `permissions` malformado, `plugin` com caminhos locais), com teste de destino que **já tinha** o shape antigo.
- **Documentação/esteira (RF-06)**: corrigir a prosa que prescreve o shape v1 (`gate-contract.md` I5 cita `tools.write/edit`) e declarar o ciclo antigo **superseded**.
- **Alternativas descartadas**: (i) manter dual v1+v2 — foi o que causou o defeito (o normalizador prefere o nativo inválido); (ii) voltar o app para 1.18.x — resolve hoje, congela o harness numa versão que o próprio repo já tentou migrar; (iii) só remover os plugins do diretório — desliga o enforcement sem substituto.

## 3. Scope

### In Scope
- [ ] Migrar os **3 plugins** para o contrato v2 (função → hooks), núcleos puros intactos.
- [ ] Matriz de paridade **deny/allow** provando que a migração não mudou veredito.
- [ ] **Verificação de runtime**: os 3 plugins carregam sem `TypeError` no log.
- [ ] Merge do **instalador** que deixa o destino **v2-only** (substitui/limpa shape obsoleto) + testes.
- [ ] Prosa: `gate-contract.md` (I5) alinhada a `permission`; ciclo antigo declarado **superseded**.
- [ ] Verificação de **instalação nova** em dir temporário (sem WARN de `conflict`/`malformed`).

### Out of Scope
- Núcleos puros dos gates (semântica de deny) · `commands.suiteFull`/selo · C-1 (counts) · go/rust · `installer/` fora do merge do `opencode.json` · `.spec/archive/**`.

## 4. Architecture Impact

| Aspecto | Impacto | ADR? |
|---|---|---|
| Backend/DB/tenancy/RBAC/eventos | **N/A** (repo de tooling; sem Java/DB/tenancy) | Não |
| Plugins (adapter v2) | `.opencode/plugins/*.js` — 3 arquivos; núcleos preservados | Sim (ADR-001 do ciclo: adapter ≠ núcleo) |
| Config de runtime | `opencode.json` (agentes v2-only) — **aplicado** | Não (contrato da doc) |
| Payload do instalador | merge do `opencode.json` + testes | Sim (ADR-002: merge substitui, não acumula) |
| Supply chain | nenhuma dependência nova; plugins seguem locais | Não |

## 5. Delta Preview

| Documento Alvo | Tipo | Seção |
|---|---|---|
| `.agents/rules/gate-contract.md` | MODIFIED | I5 (`tools.write/edit` → `permission.edit`) |
| `.spec/backend/opencode-v2-plugin-migration/` | SUPERSEDED (declaração) | cabeçalho/índice — **não** editar os artefatos; declarar no ciclo novo + `workflow-state.json` |
| `workflow-state.json` | MODIFIED | ciclo corrente + supersession |

## 6. Risk Assessment

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Migração do adapter mudar veredito de gate (fail-open silencioso) | Média | **Alto** | Matriz deny/allow v1×v2 + núcleos puros byte-idênticos (diff vazio nas funções puras) |
| Hook v2 sem equivalente confirmado | Média | Alto | Regra de ouro do ciclo antigo (válida): hook sem equivalente ⇒ **erro visível**, nunca silêncio |
| Merge aditivo deixar shape obsoleto no destino | Alta | Alto | Teste com destino que **já tem** `agents`/`permissions`/`plugin` v1 ⇒ deve sair v2-only |
| Runtime não re-ler config | Baixa | Médio | Medido: re-lê a quente (agentes voltaram sem restart) |
| Enforcement ficar off durante a migração | Certo (hoje) | Alto | **Declarado**: os gates estão OFF agora; cada batch termina com verificação de carga |

## 7. Success Criteria

- [ ] **Funcional**: `opencode debug agents` lista os **9** agentes do harness (já ✅) e os **3 plugins carregam sem `TypeError`** no log.
- [ ] **Funcional (produto)**: instalação nova em dir temporário gera `opencode.json` **v2-only**, aceito pelo runtime **sem WARN** de `conflict`/`malformed`.
- [ ] **Técnico**: suíte selada (`commands.suiteFull`) **0 falhas**; núcleos puros com **diff vazio**; selo intacto.
- [ ] **Técnico**: matriz de paridade deny/allow **verde** nos dois entrypoints.
- [ ] **Qualidade**: `code-reviewer` sem 🔴; `brain_store` do achado; `workflow-state.json` atualizado.
