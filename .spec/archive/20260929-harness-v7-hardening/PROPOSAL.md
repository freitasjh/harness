# Change Proposal: harness-v7-hardening

> **ID**: `harness-v7-hardening`
> **Status**: `Under Review`
> **Author**: orchestrator (governança de agentes)
> **Date**: 2026-09-28
> **Source**: diagnóstico direto do repo + incidente ACL/ECM 2026-09-27

---

## 1. Problem Statement

O harness de agentes deste repo existe para impedir que uma demanda seja declarada
concluída sem estar funcional. Ele falha exatamente nisso.

- **Contexto**: camada de governança de agentes do opencode — `.agents/rules/*.md`
  (injetadas via `instructions`), `.opencode/plugins/*.js`, `.agents/agents/*/AGENT.md`
  e `opencode.json`.
- **Impacto atual**: demandas são marcadas como `Completed` com erro real em tela e em
  regra de negócio. Retrabalho em ciclo (implementa → declara pronto → usuário encontra
  o erro → reabre). Custo: confiança no harness ≈ zero; o gate vira cerimônia.
- **Evidência**:
  1. Incidente 2026-09-27 — demanda de ACL do Atlas ECM entregue como concluída, com erro.
  2. `harness-validator.js:166-171` — o "validator" só faz `output.system += texto`. Não valida.
  3. `hitl-guardrail.js:56-70` — só `client.app.log`. Não bloqueia.
  4. `grep` por `tool.execute.before` / `permission.ask` nos plugins → **zero** ocorrências.
  5. `chrome-devtools` ausente em `developer-engineer/AGENT.md` e `qa-engineer/AGENT.md`;
     H3 (único gate que pega bug de tela) é inexecutável para quem deveria rodá-lo.
  6. Paths hardcoded de outro projeto (`docker/docker-compose-postgresql.yml`,
     `-pl application`) em `harness-continuous.md:70,158` e `harness-validator.js:30,65-68`
     → nos repos consumidores (atlas-ecm, hive) o comando não existe e H3 é silenciosamente pulado.
  7. `3101` linhas em `.agents/rules/*.md` sempre em contexto + re-injeção do mesmo
     conteúdo por dois plugins.

**Fato estrutural**: as duas únicas regras que nunca falharam na história deste harness
são as duas que o *runtime* aplica (`tools.write/edit:false`, `permission.task:"ask"`).
Toda regra escrita só em prosa falhou em algum momento.

---

## 2. Proposed Solution

**Resumo**: converter de "lei escrita" para "gate executado" — todo portão que precisa ser
confiável passa a ser um hook bloqueante do runtime, e toda evidência de conclusão passa a
ser um artefato machine-checkable produzido fora do executor.

**Abordagem**:
- **D1 — `harness.config.json` por projeto**: paths, comandos canônicos, portas, credenciais
  e mapa de módulos. Regras passam a referenciar o config; zero path de projeto em texto.
- **D2 — plugin `gate.js` bloqueante**: usa `tool.execute.before` e `permission.ask`
  (os dois hooks hoje ociosos). Portão que nega ação, não que sugere.
- **D3 — contrato de evidência `harness/REPORT.json`**: schema com comando executado,
  exit code, contagens (passou/falhou/skip), timestamps, artefatos. O plugin lê o arquivo
  em vez de ler a prosa do subagente.
- **D4 — gate PICCO duro na delegação**: `task` negada se o turno não trouxer bloco PICCO
  ou se `<open_questions>` não estiver vazio. "Nunca prever" deixa de ser promessa.
- **D5 — `chrome-devtools` no AGENT.md de quem roda H3** (ou extrair um agente
  `harness-runner` dedicado), com o protocolo vindo do `harness.config.json`.
- **D6 — dieta de rules**: fundir `workflow-rules.md` + `harness-continuous.md`,
  eliminar a re-injeção redundante dos plugins, cortar o que é gate duplicado.

**Ordenação obrigatória (dependência, não prioridade)**:
`enforcement → evidência → desacoplamento → expansão`.

**Alternativas descartadas**:
- *Laya AI como motor de decisão / MCP server (agora)*: adiciona ponto de falha e superfície
  antes de o enforcement existir. Fora de escopo; retomar em fase futura.
- *git worktree por tarefa (agora)*: opencode não orquestra git; estado e limpeza
  multiplicam. Sem ganho enquanto o gate for fraco.
- *Adaptar atlas-ecm/hive nesta rodada*: só faz sentido depois de D1/D2 existirem —
  hoje eles nem têm onde declarar seus comandos.
- *Apenas reescrever as rules com mais ênfase*: é a estratégia atual, e é a que falha.

---

## 3. Scope

### In Scope
- [ ] D1 `harness.config.json` (schema + arquivo do repo `harness`)
- [ ] D2 plugin `gate.js` bloqueante (`tool.execute.before` + `permission.ask`)
- [ ] D3 contrato `harness/REPORT.json` (schema + validação no plugin)
- [ ] D4 gate PICCO duro na tool `task`
- [ ] D5 `chrome-devtools` nos AGENT.md de H3 (developer-engineer, qa-engineer) + protocolo via config
- [ ] D6 dieta de rules (fusão + remoção de re-injeção)
- [ ] Gate HITL/pausa-entre-batches com enforcement real (hoje é log)
- [ ] `harness.config.json` e schemas em `.agents/` documentados

### Out of Scope
- Laya AI / MCP server de decisão (fase futura)
- `git worktree` por tarefa (fase futura)
- Adaptação de atlas-ecm / hive / quaisquer repos consumidores
- Reescrever as skills de domínio (java, vue, ux) — só os call sites de gate
- Migrar o backend/frontend de nenhum projeto

---

## 4. Architecture Impact

| Aspecto | Impacto | ADR Necessário? |
|---------|---------|-----------------|
| Backend (módulos afetados) | N/A — refactor de governança, sem código de aplicação | Não |
| Frontend (componentes/stores) | N/A — nenhuma tela alterada | Não |
| Banco de dados (migrations) | N/A | Não |
| Multi-tenancy | N/A | Não |
| Segurança / RBAC | **Sim** — `permission.*` do opencode é o IAM do harness; hooks bloqueantes são superfície de negação indevida (podem travar o dev) | Sim |
| Eventos (Kafka/async) | N/A — substituído por **Hook Registry** (`tool.execute.before/after`, `permission.ask`, `chat.*`) | Sim |
| Processo de agentes (novo) | Plugins `.opencode/plugins/`, `opencode.json`, AGENT.md de 4 agentes | Sim |

---

## 5. Delta Preview

| Documento Alvo | Tipo de Mudança | Seção Afetada |
|----------------|-----------------|---------------|
| `.agents/rules/harness-continuous.md` | MODIFIED / MERGED INTO | documento inteiro (fusão com workflow-rules) |
| `.agents/rules/workflow-rules.md` | MODIFIED | seções 0, 4.0, 5, 6.3 (apontar para config + gates duros) |
| `.agents/rules/gate-contract.md` | ADDED | novo — contrato de gate híbrido (prosa vs hook) |
| `.agents/rules/harness-config.md` | ADDED | novo — schema e uso do `harness.config.json` |
| `.agents/agents/orchestrator/AGENT.md` | MODIFIED | seções 3.x (evidência), HARNESS, HITL |
| `.agents/agents/developer-engineer/AGENT.md` | MODIFIED | H1/H3 + `chrome-devtools` + leitura do config |
| `.agents/agents/qa-engineer/AGENT.md` | MODIFIED | idem |
| `.agents/agents/fullstack-code-reviewer/PROMPT.md` | MODIFIED | evidência machine-checkable |
| `.opencode/plugins/gate.js` | ADDED | novo — gates bloqueantes |
| `.opencode/plugins/harness-validator.js` | MODIFIED | remove re-injeção; passa a validar `REPORT.json` |
| `.opencode/plugins/hitl-guardrail.js` | MODIFIED | remove re-injeção; passa a bloquear |
| `opencode.json` | MODIFIED | registra `gate.js`; permissions por agente |
| `harness.config.json` | ADDED | raiz do repo `harness` |
| `.agents/skills/harness-report/` | ADDED | skill do contrato `REPORT.json` |

---

## 6. Risk Assessment

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Gate bloqueante trava o dev por falso positivo | Média | Alto | Modo `warn` → `enforce` por gate, com flag no `harness.config.json`; log do motivo da negação sempre visível; override de 1 palavra |
| Falha no plugin derruba a sessão inteira | Média | Alto | `try/catch` em todo hook; em erro do plugin, decisão default = `allow` + log de erro do próprio plugin |
| Rigor E1/E2 gera fricção e o usuário desliga o gate | Média | Médio | Só E1/E2 bloqueiam; E3-E6 avisam; override registrado |
| Schema do `REPORT.json` fica desatualizado e vira gate morto | Média | Médio | Versão no schema + validação; teste de fixture no CI do harness |
| Dieta de rules remove conteúdo ainda necessário | Baixa | Médio | Fusão preserva conteúdo; diff revisado por `fullstack-code-reviewer`; nada de deleção sem destino |
| Bootstrap: refatorar o harness usando o harness falho | Alta | Médio | Humano como gate no 1º lote; gates novos passam a valer para o próprio desenvolvimento à medida que pousam |
| Plugin vira superfície de negação (DoS do próprio fluxo) | Baixa | Alto | Sem `pkill`, sem bloqueio de `bash` genérico; allowlist explícita de tools; kill-switch no config |

---

## 7. Success Criteria

- [ ] **Funcional**: reproduzida a falha do caso ACL/ECM, o harness **nega** a conclusão da fase
      antes de o erro ser visto em tela (o usuário não precisa reabrir a demanda)
- [ ] **Funcional**: o orquestrador não consegue delegar `task` sem bloco PICCO com
      `<open_questions>` vazio — tentativa de violação é negada e registrada
- [ ] **Técnico**: `grep -rn "tool.execute.before\|permission.ask" .opencode/plugins` ≥ 2 (ogiva
      carregada), e teste do plugin em `warn` e `enforce` passa
- [ ] **Técnico**: `harness/REPORT.json` validado contra schema; conclusão de fase sem esse
      arquivo é negada pelo gate
- [ ] **Técnico**: `grep -rn "docker-compose-postgresql\|-pl application" .agents/ .opencode/plugins/`
      → 0 no texto de regra (paths só no `harness.config.json` do projeto)
- [ ] **Qualidade**: `.agents/rules/*.md` reduzido (meta: ≤ 55% do total atual de linhas) sem
      perda de cobertura de gate — cada gate removido do texto existe como hook ou é
      explicitamente rebaixado a "aviso"
- [ ] **Qualidade**: `mvn clean install -Dintegration.test.skip=false -Pintegration` do repo
      consumidor usado no teste → 0 falhas (harness não pode quebrar o que já passa)

---

## 8. Completion Metadata

- **Archived on**: —
- **Duration**: —
- **Archive path**: —
- **Files changed**: —
