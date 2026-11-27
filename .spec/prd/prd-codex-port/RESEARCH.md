# RESEARCH — prd-codex-port

> Insumo técnico para os ADRs de `prd-codex-port`. Cada decisão lista ≥2 alternativas com fonte (URL + data da consulta), trade-off e recomendação. **Recomendações são insumo, não veredito** — a decisão final é do owner / `architect`. Consulta de fontes feita em **2026-11-19** (deepsearch, sem rede nos scripts de aceite; as URLs abaixo são referências para revisão humana).

## Fontes base

- Codex Hooks — https://developers.openai.com/codex/hooks (consultado 2026-11-19)
- AGENTS.md — https://developers.openai.com/codex/agent-configuration/agents-md (consultado 2026-11-19)
- Subagents — https://developers.openai.com/codex/agent-configuration/subagents (consultado 2026-11-19)
- Rules — https://developers.openai.com/codex/agent-configuration/rules (consultado 2026-11-19)
- Build skills — https://developers.openai.com/codex/build-skills (consultado 2026-11-19)
- Advanced config — https://developers.openai.com/codex/config-file/config-advanced (consultado 2026-11-19)
- issue openai/codex#49736 — https://github.com/openai/codex/issues/49736 (consultado 2026-11-19)
- gate.js / config.mjs / harness-sync.mjs / seal.mjs — fontes locais (`.opencode/plugins/**`, `scripts/harness-sync.mjs`)

## Decisão D1 — Implementação dos hooks Codex

**Pergunta**: portar a lógica de `gate.js` como adapter reusando o módulo, ou reescrever em standalone?

### Alternativa A — Adapter fino reusando `gate.js`

- **Fonte**: https://developers.openai.com/codex/hooks (consultado 2026-11-19) — hooks são comandos que recebem JSON em stdin e negam via `permissionDecision:"deny"`/exit 2; https://developers.openai.com/codex/hooks#tool-coverage (consultado 2026-11-19) — `PreToolUse` cobre Bash/apply_patch/MCP/other local function tools.
- **Descrição**: extrair de `.opencode/plugins/gate.js` as funções puras (reason codes, `DenyError`, modos) para um módulo compartilhado e criar um adapter `.codex/hooks/pre_tool_use.*` (Node) que lê o evento Codex de stdin, monta o `ctx` equivalente, executa os gates e emite o JSON de deny ou exit 2.
- **Trade-off**: ganha paridade de reason codes (A2) e fonte única de verdade; perde acoplamento ao runtime Node no destino (aceitável: `harness-sync` e os scripts de aceite já exigem Node) e exige refatoração de `gate.js` para separar I/O OpenCode do núcleo puro.
- **Recomendação**: **aceita** como direção preferida, condicionada à refatoração mínima de `gate.js` (sem alterar o caminho OpenCode).

### Alternativa B — Reescrita standalone (Python/Node) dos gates

- **Fonte**: https://developers.openai.com/codex/hooks (consultado 2026-11-19) — formato de I/O do hook; https://developers.openai.com/codex/enterprise/security-cookbook (consultado 2026-11-19) — exemplo de hook Python com exit 2.
- **Descrição**: reimplementar cada gate em um script independente, duplicando reason codes e lógica.
- **Trade-off**: ganha independência de `gate.js` e de Node; perde paridade (risco de drift de reason codes, viola A2) e dobra a manutenção (dual-run vira dois sistemas).
- **Recomendação**: **descartada** — contradiz a métrica A2 e o princípio dual-run (mesmos reason codes).

### Alternativa C — Híbrido (adapter para gates críticos + scripts dedicados para deny simples)

- **Fonte**: https://developers.openai.com/codex/hooks (consultado 2026-11-19).
- **Descrição**: adapter reusando `gate.js` para gates de deny; scripts curtos para kill-switch/bypass log.
- **Trade-off**: ganha flexibilidade; perde uniformidade e aumenta superfície de bypass (PRD §13).
- **Recomendação**: **descartada** como padrão; pode ser sub-opção do ADR-02 para o bypass log, desde que o deny continue vindo do adapter.

**Recomendação D1**: Alternativa A (adapter fino), com a refatoração de `gate.js` isolando o núcleo puro. O kill-switch `HARNESS_GATES=off` (A3) é tratado no adapter como saída antecipada com log de bypass, sem negar.

## Decisão D2 — Encoding das regras (`.rules` Starlark vs hooks)

**Pergunta**: usar `.rules` (Starlark) para gates, apenas hooks, ou híbrido?

### Alternativa A — Apenas `.rules` (Starlark)

- **Fonte**: https://developers.openai.com/codex/agent-configuration/rules (consultado 2026-11-19) — `.rules` controla quais comandos rodam **fora do sandbox** via `prefix_rule()`; Starlark sem side effects; decisão mais restritiva vence.
- **Descrição**: codificar todas as políticas do harness como `prefix_rule` em `.codex/rules/*.rules`.
- **Trade-off**: ganha integração nativa com o sandbox do Codex e `codex execpolicy check`; perde capacidade de negar por reason code (`.rules` não emite reason codes do harness, nem cobre tools não-shell como `apply_patch`/MCP com a semântica de gate), e é experimental (pode mudar).
- **Recomendação**: **descartada** como substituto dos gates — não atende RF-02.

### Alternativa B — Apenas hooks (`PreToolUse`)

- **Fonte**: https://developers.openai.com/codex/hooks (consultado 2026-11-19) — `PreToolUse` nega via `permissionDecision:"deny"`/exit 2, com `permissionDecisionReason`.
- **Descrição**: toda política do harness vira hook, sem `.rules`.
- **Trade-off**: ganha paridade de reason codes e cobertura de tools (Bash/apply_patch/MCP/other local function tools); perde o controle fino de comandos fora do sandbox que o Codex oferece nativamente (allow/prompt/forbidden por prefixo), forçando o harness a reimplementar allowlist de shell.
- **Recomendação**: **aceita parcialmente** — cobre os gates, mas deixa de usar uma capacidade nativa útil.

### Alternativa C — Híbrido: hooks para gates + `.rules` para sandbox de comandos

- **Fonte**: https://developers.openai.com/codex/hooks (consultado 2026-11-19) + https://developers.openai.com/codex/agent-configuration/rules (consultado 2026-11-19).
- **Descrição**: hooks (adapter D1) emitem os reason codes do harness em `PreToolUse`; `.rules` complementa com `prefix_rule` para comandos shell (allow/prompt/forbidden) e é validado por `codex execpolicy check`.
- **Trade-off**: ganha paridade de reason codes **e** controle nativo de sandbox; perde simplicidade (duas superfícies) e exige cuidado para não duplicar política (risco de divergência silenciosa — mitigado por fixtures A2).
- **Recomendação**: **aceita** como direção preferida.

**Recomendação D2**: Alternativa C (híbrido), com fronteira clara: hooks = gates/reason codes; `.rules` = sandbox de comandos. `.rules` tratado como complementar e experimental (PRD §14.3).

## Decisão D3 — Encadeamento de `AGENTS.md` (teto 32 KiB)

**Pergunta**: como caber ~75 KB de regras em 32 KiB de injeção?

### Alternativa A — `AGENTS.md` raiz enxuto + referências

- **Fonte**: https://developers.openai.com/codex/agent-configuration/agents-md (consultado 2026-11-19) — discovery de root→cwd, `project_doc_max_bytes` (32 KiB default), fallback filenames.
- **Descrição**: raiz contém índice curto + convenções; detalhes vivem em `.agents/rules/*` carregados via `project_doc_fallback_filenames` ou referenciados.
- **Trade-off**: ganha simplicidade e respeito ao teto; perde garantia de carregamento (fallback filenames aumentam a cadeia e podem truncar silenciosamente).
- **Recomendação**: **aceita parcialmente** — base do desenho.

### Alternativa B — Chunking por papel (AGENTS.md aninhado por diretório)

- **Fonte**: https://developers.openai.com/codex/agent-configuration/agents-md (consultado 2026-11-19) — "Codex stops searching once it reaches your current directory"; overrides por diretório.
- **Descrição**: regras por papel vivem em `AGENTS.md`/`AGENTS.override.md` nos diretórios relevantes (ex.: `frontend/`, `backend/`), carregadas apenas quando o cwd está naquele escopo.
- **Trade-off**: ganha uso eficiente do teto (só o necessário por contexto) e overrides naturais; perde visibilidade global (regras cross-cutting precisam estar na raiz ou duplicadas).
- **Recomendação**: **aceita** como componente principal.

### Alternativa C — Injeção via `SessionStart` hook (`additionalContext`)

- **Fonte**: https://developers.openai.com/codex/hooks (consultado 2026-11-19) — `SessionStart` adiciona `additionalContext` como developer context, com `additionalContextLimit` (default 2500 tokens).
- **Descrição**: hook `SessionStart` monta o contexto dinamicamente (ex.: regras do papel atual) e injeta via `additionalContext`.
- **Trade-off**: ganha contexto dinâmico e pode ultrapassar o teto de project docs; perde determinismo/auditabilidade (contexto depende do hook) e conta contra a janela do modelo (custo de tokens), com risco de "context rot" (ver subagents doc).
- **Recomendação**: **aceita como complemento**, não como canal primário — útil para contexto de sessão, não para regras canônicas.

**Recomendação D3**: combinação B (chunking por papel) + A (raiz enxuta) como canal primário, mantendo o teto de 32 KiB (métrica PRD); C como complemento dinâmico com `additionalContextLimit` conservador. Não elevar `project_doc_max_bytes` acima de 32 KiB sem revisar a métrica A5.

## Decisão D4 — Persistência de estado HITL/agente

**Pergunta**: como persistir estado entre invocações de hook (processos separados) para HITL batch e identidade de agente?

### Alternativa A — Arquivo (canônico `workflow-state.json` ou `.codex/state.json`)

- **Fonte**: https://developers.openai.com/codex/hooks (consultado 2026-11-19) — cada hook é um processo separado com `session_id`/`cwd` no stdin; não há memória compartilhada.
- **Descrição**: estado mutável em arquivo versionado/preservado (análogo a `workflow-state.json`), escrito atomicamente.
- **Trade-off**: ganha persistência robusta entre processos e sessões; perde atomicidade (mitigada por write atomic + lock) e risco de concorrência em subagents (mitigado por escopo de sessão).
- **Recomendação**: **aceita** como canal primário.

### Alternativa B — Arquivos em `tmp` (com cleanup)

- **Fonte**: https://developers.openai.com/codex/hooks (consultado 2026-11-19) — Codex já usa `<temp_dir>/hook_outputs/...` para spilling de output grande.
- **Descrição**: estado efêmero em tmp, limpo ao fim da sessão.
- **Trade-off**: ganha limpeza automática; perde sobrevivência entre sessões e reprodutibilidade (smoke A6 exige relatório persistente); tmp é adequado para output grande, não para estado de governança.
- **Recomendação**: **descartada** para estado de governança; mantida apenas para output grande (comportamento nativo do Codex).

### Alternativa C — Variáveis de ambiente

- **Fonte**: https://developers.openai.com/codex/config-file/environment-variables (consultado 2026-11-19).
- **Descrição**: estado em env (ex.: `HARNESS_GATES`, contadores de HITL).
- **Trade-off**: ganha simplicidade de leitura; perde mutabilidade cross-processo (env do processo hook não propaga de volta ao Codex) — inviável para HITL batch/turn boundaries.
- **Recomendação**: **descartada** para estado mutável; env permanece apenas para kill-switch e config (ex.: `HARNESS_GATES`, `CODEX_HOME`).

**Recomendação D4**: Alternativa A (arquivo), reusando o padrão canônico `workflow-state.json` quando fizer sentido e um arquivo dedicado `.codex/harness-state.json` para estado específico do runtime Codex. Env apenas para kill-switch/config. tmp apenas para output grande (nativo).

## Decisão D5 — Instalador: `.codex/` como payload copiado vs gerado

**Pergunta**: publicar a camada `.codex/` via `harness-sync` como payload copiado ou como artefato gerado?

### Alternativa A — Payload copiado (adicionar `.codex/` a `PAYLOAD_DIRS`/`PAYLOAD_FILES`)

- **Fonte**: `scripts/harness-sync.mjs` (local) — contrato G1 (determinismo: write set = diff de hash), G3 (preservados), G4 (merge), G5 (zero rede); https://developers.openai.com/codex/agent-configuration/subagents (consultado 2026-11-19) — agentes em `.codex/agents/*.toml`.
- **Descrição**: `.codex/agents`, `.codex/hooks`, `.codex/rules` (e eventualmente `.codex/skills`) entram no payload copiado, com o mesmo contrato de `harness-sync`.
- **Trade-off**: ganha determinismo, backup, idempotência e paridade com o caminho OpenCode; perde flexibilidade para conteúdo project-specific (mitigada por G3 preserved + merge).
- **Recomendação**: **aceita** para arquivos gerenciados.

### Alternativa B — Gerado por template no `harness-sync`

- **Fonte**: `scripts/harness-sync.mjs` (local) — `buildConfig` gera config apenas quando ausente.
- **Descrição**: `harness-sync` renderiza `.codex/agents/*.toml` e `.codex/hooks.json` a partir de templates.
- **Trade-off**: ganha adaptação ao stack do destino; perde determinismo (G1) e auditabilidade (diff de template vs arquivo), e duplica a fonte de verdade (templates vs `.agents/`).
- **Recomendação**: **descartada** como padrão — conflita com G1 e com a fonte única de verdade.

### Alternativa C — Híbrido: payload copiado para estáticos + merge para config

- **Fonte**: `scripts/harness-sync.mjs` (local) — G4 merge de `opencode.json`; https://developers.openai.com/codex/config-file/config-advanced (consultado 2026-11-19) — `config.toml` em camadas.
- **Descrição**: arquivos estáticos (agentes, hooks, rules) são payload copiado; `.codex/config.toml` é mesclado (análogo a `opencode.json`) ou preservado (G3), conforme ADR-03.
- **Trade-off**: ganha determinismo para código e flexibilidade para config project-specific; perde complexidade no merge (config.toml é TOML, não JSON — exige parser/serializer) e risco de divergência entre camadas.
- **Recomendação**: **aceita** como direção preferida, com a ressalva de que o merge de TOML precisa ser decidido no ADR-03 (parser disponível no Node? `@iarna/toml` é dependência externa — zero rede impede instalação; alternativa: tratar `config.toml` como preservado e publicar apenas um `config.toml` inicial quando ausente, como `buildConfig`).

**Recomendação D5**: Alternativa C, com viés para "copiado para estáticos + preservado/criado-quando-ausente para `config.toml`" (evitando dependência de parser TOML e mantendo G1/G3). ADR-03 decide o detalhe do merge.

## Decisões auxiliares

### D6 — Declaração de agentes (`.codex/agents/*.toml`)

- **Fonte**: https://developers.openai.com/codex/agent-configuration/subagents (consultado 2026-11-19) — schema TOML com `name`, `description`, `developer_instructions`; custom agent sobrepõe built-in de mesmo nome.
- **Alt A**: um `.toml` por agente (11), reusando o conteúdo de `.agents/agents/**` em `developer_instructions`.
- **Alt B**: um agente genérico + skills para especialização.
- **Trade-off**: A ganha paridade de papéis (RF-06) e instruções dedicadas; B ganha manutenção mas perde especialização e viola RF-06 (contagem 10).
- **Recomendação**: A.

### D7 — Transporte do hook (command vs MCP tool)

- **Fonte**: https://developers.openai.com/codex/hooks (consultado 2026-11-19) — `command` e `mcp_tool` suportados; `prompt`/`agent` parsed mas skipped.
- **Alt A**: `command` (Node) invocando o adapter.
- **Alt B**: `mcp_tool` chamando um servidor MCP.
- **Trade-off**: A é simples, local, zero rede e coerente com repo-local; B exige servidor MCP em execução (porta/rede — viola restrições de aceite).
- **Recomendação**: A.

### D8 — Matcher de `PreToolUse`

- **Fonte**: https://developers.openai.com/codex/hooks (consultado 2026-11-19) — matcher é regex por `tool_name`; `spawn_agent` casa com `Agent` (issue #49736); hosted tools (WebSearch) não disparam.
- **Alt A**: matcher amplo (`Bash|apply_patch|Agent|.*`) cobrindo todos os local function tools.
- **Alt B**: matcher por tool explícita (`Bash|apply_patch`).
- **Trade-off**: A maximiza cobertura mas pode disparar em tools onde o hook é advisory; B é conservador mas deixa gaps (issue #49736 documenta que `spawn_agent` não dispara mesmo com matcher correto — limitação do Codex, não do matcher).
- **Recomendação**: A para tools locais, com documentação da limitação de `spawn_agent` (PRD §8/§14.1) e paridade medida apenas onde o hook dispara (A2).

## Recomendação final

Direção coerente com as decisões do owner (dual-run, repo-local, smoke pelo usuário):

1. **Hooks**: adapter fino reusando o núcleo puro de `gate.js` (D1-A), deny via `permissionDecision:"deny"`/exit 2, com kill-switch `HARNESS_GATES=off` (A3).
2. **Regras**: híbrido hooks (gates/reason codes) + `.rules` (sandbox de comandos) (D2-C), com `.rules` complementar e experimental.
3. **AGENTS.md**: raiz enxuta + chunking por papel (D3-A+B), teto 32 KiB mantido; `SessionStart` apenas como complemento dinâmico (D3-C).
4. **Estado**: arquivo (D4-A); env só para kill-switch/config; tmp só para output grande nativo.
5. **Instalador**: payload copiado para estáticos + preservado/criado-quando-ausente para `config.toml` (D5-C), mantendo G1/G3/G4 de `harness-sync`.
6. **Agentes**: um `.toml` por papel (D6-A); transporte por `command` (D7-A); matcher amplo com limitação documentada de `spawn_agent` (D8-A).

**Bloqueios/pontos que exigem decisão de `product-manager`/`architect`** (não resolvidos aqui):

- A refatoração de `gate.js` para extrair núcleo puro pode tocar arquivo protegido — exige ADR-02 e revisão humana.
- O merge (ou preservação) de `.codex/config.toml` no `harness-sync` (D5-C) precisa de decisão de contrato no ADR-03.
- A paridade de reason codes em `spawn_agent` depende do issue #49736 (não controlável) — ADR-02 deve declarar "best-effort" se confirmado.
- Uso de `project_doc_fallback_filenames` para carregar `.agents/rules/*` precisa validação empírica do tamanho efetivo (A5).

**Premissas não validadas (inferência)**:

- Disponibilidade de Node no destino é assumida (harness-sync já a exige) — fonte: `scripts/harness-sync.mjs` (local).
- O teto de 32 KiB é tratado como limite rígido conforme métrica PRD §5; elevar exigiria revisão da métrica.<|end|><|start|>Assistant to=bash<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="command">
wc -l .spec/prd/prd-codex-port/RESEARCH.md; grep -c "https://" .spec/prd/prd-codex-port/RESEARCH.md