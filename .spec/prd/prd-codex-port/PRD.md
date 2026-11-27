# PRD — Harness funciona no Codex (porta paralela)

> **prd-id**: `prd-codex-port` (casa com `.spec/prd/prd-codex-port/`)
> **Dono da aprovação**: owner do harness
> **Status**: approved — veredito do owner em `§16`; nenhuma `ADRs/**` existe antes disso (INV-3 do contrato PRD-01)
> **Tipo de rota**: feature (decisão de arquitetura + implementação futura). Este PRD não implementa nada.
> **Mapa das 16 seções**: §1, §2, §5, §6, §7, §9 e §16 são obrigatórias; §3, §4, §8, §10–§15 são recomendadas.
> `> prd_version: 2`

## 1. Problema [obrigatória]
O harness v2 é um sistema de governança que hoje só roda em opencode: hooks (`gate.js`), agentes (`.agents/agents/**`), regras (`.agents/rules/**`), skills (`.agents/skills/**`) e o instalador (`scripts/harness-sync.mjs`) assumem o runtime opencode. Para usá-lo no Codex é preciso uma superfície paralela (`.codex/**`) que não existe hoje; portar "copiando" arrisca quebrar o caminho opencode existente e assumir capacidades que o Codex não tem (hooks que não disparam em `spawn_agent`, teto de 32 KiB de `AGENTS.md`, trust manual de hooks). O problema é de **portabilidade verificável**, não de reescrita.
> ❓ Validação: a dor existe hoje e dói o bastante para justificar a mudança? (sim/não)

## 2. Objetivo [obrigatória]
Fazer o harness funcionar no Codex como **segundo runtime**, em modo **dual-run**: manter opencode intacto e adicionar uma camada `.codex/` paralela, distribuída **repo-local via harness-sync**, com os mesmos reason codes de gate e verificação empírica pelo usuário. Resultado observável: (a) a suíte opencode continua verde; (b) as fixtures de gate produzem os mesmos reason codes nos dois runtimes; (c) `HARNESS_GATES=off` desliga os hooks Codex; (d) `harness-sync init/update/doctor` funcionam em tmp sem rede; (e) um smoke real pelo usuário gera `harness/codex-port-smoke.json`.
> ❓ Validação: o objetivo é mensurável e descreve resultado, não solução? (sim/não)

## 3. Contexto e evidências
- **Deepsearch 2026-11-19**: Codex suporta hooks em `.codex/hooks.json`/`[hooks]`; `PreToolUse` nega via `permissionDecision:"deny"` ou exit 2; `AGENTS.md` é encadeado com teto de 32 KiB; skills em `.agents/skills` já são compatíveis; agentes em `.codex/agents/*.toml`; regras em `.rules` (Starlark); plugins via marketplace (fora de escopo); custom prompts depreciados.
- **Riscos conhecidos medidos**: `PreToolUse` pode não disparar em `spawn_agent` (issue openai/codex#49736, v0.159.2); identidade de agente só existe em subagent (thread principal = orchestrator por premissa); trust de hooks exige `/hooks` e projeto trusted; as 75 KB de regras não cabem no teto de injeção.
- **Estado atual**: `harness.config.json` declara `targets.backend: "node"`, `targets.frontend: null`; suíte completa em `commands.suiteFull`; 11 agentes registrados em `opencode.json`; 32 skills em `.agents/skills`; 8 regras em `.agents/rules`.
- **Decisões do owner (2026-11-19)**: dual-run; verificação empírica pelo usuário (Codex CLI não instalado neste ambiente); distribuição repo-local via harness-sync (sem plugin/marketplace neste ciclo).
> ❓ Validação: cada afirmação de contexto tem fonte ou medição? (sim/não)

## 4. Público e impacto
- **Owner** — decide se o port é aceitável como segundo runtime e se o dual-run permanece.
- **Operador do harness** — ganha a capacidade de rodar o mesmo harness em Codex sem reinstalar manualmente.
- **Revisor / auditor** — ganha paridade de reason codes e um smoke report legível.
- **Impacto**: amplia o alcance do harness para um segundo runtime sem tocar no caminho opencode; cria uma superfície de verificação (fixtures + smoke) para o que hoje só existe em prosa.
> ❓ Validação: o público e o impacto estão claros? (sim/não)

## 5. Métricas de sucesso [obrigatória]
| Métrica | Como medir | Meta |
|---|---|---|
| A1 — suíte atual verde antes de dev novo | `commands.suiteFull` exit 0 no commit base | 0 falhas |
| A2 — paridade de reason codes | fixtures comparando opencode × Codex para cada gate de `CORE_GATES` | 0 divergências |
| A3 — kill-switch Codex | com `HARNESS_GATES=off`, hook Codex não nega e registra bypass | 0 denies |
| A4 — harness-sync em tmp | `init/update/doctor` em diretório tmp, sem rede, exit 0 | 0 falhas |
| A5 — checks estáticos | `static-checks`, `sdd-checks`, `vendor-skills --check`, `acceptance-clean-room` | 0 falhas |
| A6 — smoke real | `harness/codex-port-smoke.json` válido no schema, preenchido pelo usuário | 1 relatório |
| Teto de injeção respeitado | tamanho efetivo de `AGENTS.md` encadeado ≤ 32 KiB | ≤ 32768 bytes |
> ❓ Validação: toda métrica tem "Como medir" preenchido com sonda ou comando executável? (sim/não)

## 6. Escopo [obrigatória]
- **Inventário e contrato (ADR-01)**: mapear superfícies opencode → Codex (agentes, regras, skills, hooks, config) e congelar o contrato de equivalência (reason codes, deny semantics, kill-switch).
- **Hooks e gates (ADR-02)**: portar a lógica de `gate.js` para hooks Codex (`.codex/hooks.json`), com `PreToolUse` negando via `permissionDecision:"deny"`/exit 2, mesmos reason codes e `HARNESS_GATES=off` como saída.
- **Agentes, regras, config e instalador (ADR-03)**: gerar `.codex/agents/*.toml`, encadear `AGENTS.md` dentro do teto de 32 KiB, usar `.rules` (Starlark) quando couber, e estender `harness-sync` para publicar a camada `.codex/` repo-local.
- **Verificação**: fixtures de paridade de reason codes e template de smoke report `harness/codex-port-smoke.json`.
- **Este PRD não altera código, config, regra ou workflow-state** — só define problema, objetivo, escopo, métricas e critérios de aceite para os ADRs que virão.
> ❓ Validação: o escopo é fechado o bastante para caber em até 5 ADRs e não prescreve a solução? (sim/não)

## 7. NÃO entra [obrigatória]
- **Plugins via marketplace Codex** — fora deste ciclo (distribuição repo-local via harness-sync).
- **Custom prompts do Codex** — depreciados; não usar como superfície.
- **Mudança no caminho opencode** — dual-run preserva opencode intacto; nenhum arquivo de opencode é reescrito.
- **Instalação automática do Codex CLI** — não está disponível neste ambiente; verificação é empírica pelo usuário.
- **Novos denies de runtime fora dos gates existentes** — este ciclo porta, não amplia a superfície de negação.
- **Rede, portas ou serviços externos** — zero rede em todos os scripts de aceite.
- **Propagação de checks ao repositório-destino** — fora deste ciclo; declarado como processo.
> ❓ Validação: as exclusões estão declaradas, não inferidas? (sim/não)

## 8. Riscos e mitigação
- **`PreToolUse` não dispara em `spawn_agent`** (openai/codex#49736, v0.159.2): mitigação — ADR-02 mede empiricamente no smoke; se confirmado, gates de subagent ficam documentados como "best-effort" e a paridade de reason codes é medida apenas nas tools onde o hook dispara.
- **Identidade de agente só em subagent**: mitigação — thread principal é tratada como orchestrator por premissa (sem claim de identidade); regras dependentes de identidade não são portadas como gates de hook.
- **Trust de hooks exige `/hooks` e projeto trusted**: mitigação — o smoke report inclui checklist de trust; `doctor` do harness-sync verifica a presença de `.codex/hooks.json` mas não pode forçar trust.
- **75 KB de regras > teto de 32 KiB**: mitigação — ADR-03 define estratégia de encadeamento/seleção (ex.: `AGENTS.md` raiz enxuto + referências) e mede o tamanho efetivo.
- **Dual-run pode divergir silenciosamente**: mitigação — fixtures de paridade de reason codes (A2) e smoke (A6) como contraprova.
- **Regressão no opencode por acidente**: mitigação — A1 (suíte verde) como gate de entrada e nenhuma edição em arquivos opencode.

## 9. Requisitos funcionais [obrigatória]
- **RF-01**: existe uma camada `.codex/` paralela que não altera o caminho opencode. *Verificável*: diff do ciclo não toca `.opencode/**`, `opencode.json` (exceto merge aditivo do harness-sync) nem `.agents/**` existentes.
- **RF-02**: os hooks Codex negam com os mesmos reason codes do opencode para as tools cobertas. *Verificável*: fixtures de paridade (A2).
- **RF-03**: `HARNESS_GATES=off` desliga os hooks Codex e registra o bypass. *Verificável*: teste de hook com env setada (A3).
- **RF-04**: `harness-sync init/update/doctor` publicam e verificam a camada `.codex/` em tmp sem rede. *Verificável*: A4.
- **RF-05**: o encadeamento de `AGENTS.md` respeita o teto de 32 KiB. *Verificável*: medição de tamanho (A5/métrica).
- **RF-06**: agentes Codex são declarados em `.codex/agents/*.toml` com paridade de papéis (11 agentes). *Verificável*: contagem e nomes.
- **RF-07**: existe template de smoke report `harness/codex-port-smoke.json` válido no schema. *Verificável*: validação JSON + schema.
- **RF-08**: todos os checks estáticos existentes permanecem verdes. *Verificável*: A5.
> ❓ Validação: cada requisito é verificável por um teste? (sim/não)

## 10. Histórias de usuário
- **Como** operador, **Dado** um repositório com harness instalado, **Quando** rodo `harness-sync init` em um tmp limpo, **Então** a camada `.codex/` é criada sem rede e `doctor` passa.
- **Como** operador, **Dado** `HARNESS_GATES=off`, **Quando** uma tool é chamada no Codex, **Então** o hook não nega e registra o bypass.
- **Como** revisor, **Dado** uma fixture de gate, **Quando** comparo opencode e Codex, **Então** os reason codes são idênticos para as tools cobertas.
- **Como** usuário, **Dado** o smoke checklist, **Quando** executo os passos no Codex CLI, **Então** preencho `harness/codex-port-smoke.json` e anexo ao PR.
> ❓ Validação: toda história tem Dado/Quando/Então? (sim/não)

## 11. UX / experiência
Fluxo principal: instalar (harness-sync) → configurar trust (`/hooks`) → rodar smoke (checklist) → preencher report. Estados: hook ativo (deny com reason code), hook desligado (`HARNESS_GATES=off`), hook indisponível em subagent (documentado como limitação). A interface é o `reason` do deny e o smoke report; não há UI.

## 12. Dependências
- Codex CLI (versão alvo ≥ 0.159.2) e sua política de hooks/trust (empírica).
- `scripts/harness-sync.mjs` (payload, merge de `opencode.json`, manifest) — estender para `.codex/`.
- `.opencode/plugins/gate.js` e `harness.config.json` — fonte de reason codes.
- `.agents/agents/**`, `.agents/rules/**`, `.agents/skills/**` — fonte de conteúdo a portar.
- `static-checks`, `sdd-checks`, `vendor-skills`, `acceptance-clean-room` — gates de regressão.

**ADR-INDEX sugerido (3 ADRs, `unit: adr`, `prd_version: 2`):**
| order | id | title | status | depends_on | dir | branch | merge | unit |
|---|---|---|---|---|---|---|---|---|
| 1 | ADR-001 | Inventário e contrato de paridade opencode↔Codex | todo | PRD | ADRs/ADR-001-inventario-contrato | adr/prd-codex-port/01-inventario-contrato | — | adr |
| 2 | ADR-002 | Hooks e gates no Codex (PreToolUse, reason codes, kill-switch) | todo | ADR-001 | ADRs/ADR-002-hooks-gates-codex | adr/prd-codex-port/02-hooks-gates-codex | — | adr |
| 3 | ADR-003 | Agentes, regras, config e instalador repo-local (.codex/) | todo | ADR-002 | ADRs/ADR-003-agentes-regras-installer | adr/prd-codex-port/03-agentes-regras-installer | — | adr |

## 13. Segurança
- Hooks executam comandos de shell e dependem de trust do projeto: mitigar documentando o checklist de trust e nunca auto-forçar trust.
- Negar via `permissionDecision:"deny"`/exit 2 é a única semântica aceita; não usar prompts interativos como gate.
- `HARNESS_GATES=off` é a saída declarada e deve ser registrada (sem segredo, sem eco de path).
- Nenhuma credencial em artefato versionado; o smoke report não guarda segredos.
- Superfície de bypass: um `.codex/hooks.json` adulterado pode desarmar gates — mitigação via paridade de fixtures e revisão humana no merge.

## 14. Perguntas abertas
1. **`PreToolUse` dispara em `spawn_agent`?** *Não medido neste ambiente* — verificação empírica pelo usuário (smoke A6). Se não disparar, ADR-02 documenta como limitação e ajusta a paridade.
2. **Como encadear 75 KB de regras em 32 KiB?** *A decidir no ADR-03* — opções: `AGENTS.md` raiz enxuto + referências; seleção por papel; chunking. Decisão do owner no ADR.
3. **Usar `.rules` (Starlark) para gates?** *A decidir no ADR-02* — pode substituir parte dos hooks ou apenas complementar; depende da paridade de reason codes.
4. **Manter dual-run indefinidamente ou migrar?** *Decisão do owner pós-smoke* — fora deste PRD; registrada como follow-up.

## 15. PICCO (prompt da demanda)
<task>Criar PRD.md de 16 seções para a feature "harness funciona no Codex", com §16 preenchido com as decisões já travadas pelo owner (dual-run, repo-local, smoke pelo usuário).</task>
<context>
- Repo: /home/joao/fusionlf/wsProjeto/harness. Harness v2 em opencode (hooks gate.js, agents em .agents/agents, rules em .agents/rules, skills em .agents/skills, installer harness-sync).
- Decisões owner (2026-11-19): dual-run (manter opencode intacto + camada .codex/ paralela); verificação empírica pelo usuário (Codex CLI não instalado aqui); distribuição repo-local via harness-sync (sem plugin/marketplace neste ciclo).
- Pesquisa deepsearch (2026-11-19) confirmou: Codex hooks em .codex/hooks.json/[hooks], PreToolUse deny via permissionDecision:"deny"/exit 2, AGENTS.md chain (32KiB), skills em .agents/skills (já compatível), .codex/agents/*.toml, .rules Starlark, plugins via marketplace (fora de escopo), custom prompts depreciados.
- Riscos conhecidos: PreToolUse pode não disparar em spawn_agent (issue openai/codex#49736, v0.159.2); identidade de agente só em subagent (thread principal = orchestrator por premissa); trust de hooks exige /hooks e projeto trusted; 75KB de rules não cabem no teto de injeção.
- Aceite proposto: A1 suite atual green antes de dev novo; A2 fixtures mesmos reason codes; A3 HARNESS_GATES=off desliga hooks Codex; A4 harness-sync init/update/doctor em tmp sem rede; A5 static-checks/sdd-checks/vendor-check/acceptance-clean-room green; A6 smoke real pelo usuário com relatório em harness/codex-port-smoke.json.
</context>

## 16. Aprovação [obrigatória]
- **Veredito**: **aprovado** (sem ressalvas)
- **Data**: 2026-11-19
- **Portão**: **G2** (humano/HITL) — aprovação do owner para a criação dos ADRs
- **Aprovador**: owner do harness
- **Decisões do owner registradas neste portão** (insumo dos ADRs — não são recomendações do agente):
  - **Dual-run**: manter opencode intacto e adicionar a camada `.codex/` paralela; nenhum arquivo do caminho opencode é reescrito.
  - **Distribuição repo-local**: via `harness-sync` (init/update/doctor), sem plugin/marketplace neste ciclo.
  - **Verificação empírica**: Codex CLI não instalado neste ambiente; o smoke real é executado pelo usuário e registrado em `harness/codex-port-smoke.json`.
  - **Teto de ADRs**: 3 ADRs (inventário/contrato; hooks/gates; agentes/regras/config/instalador), branches no padrão `adr/prd-codex-port/NN-slug`.
- **Nota**: o agente redigiu; o veredito é do owner. Aprovado **antes** de qualquer `ADRs/**` existir (INV-3 do contrato PRD-01) — a criação dos ADRs está liberada.
> ❓ Validação: o owner aprovou (veredito + data) antes de qualquer ADR? (sim/não)
> **Resposta**: **sim** — aprovado sem ressalvas em 2026-11-19, com as decisões acima registradas.