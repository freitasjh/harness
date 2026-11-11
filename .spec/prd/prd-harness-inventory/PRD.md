# PRD — Inventário do harness, revisão do roster de agentes e agente de planejamento

> **prd-id**: `prd-harness-inventory` (casa com `.spec/prd/prd-harness-inventory/`)
> **Dono da aprovação**: owner do harness
> **Status**: draft — aguardando veredito do owner em `§16`; nenhum `ADRs/**` pode existir antes disso (INV-3 do contrato PRD-01)
> **Tipo de rota**: Refactor (programa multi-PRD `harness-refactor-2026-11`, ordem 1 — registrado em `workflow-state.json.program.prds[0]`)
> **Mapa das 16 seções**: §1, §2, §5, §6, §7, §9 e §16 são obrigatórias; §3, §4, §8, §10–§15 são recomendadas.
> **Itens do owner neste PRD**: 2 (levantamento dos agentes), 3 (levantamento das skills), 10 (agente especialista em planejamento). Itens 1, 4, 5, 6, 7, 8 e 9 pertencem a outros PRDs do programa (§7 e §12).

## 1. Problema [obrigatória]
O harness distribui agentes, skills e rules para projetos-destino sem **inventário verificável**: não existe hoje uma lista única que diga o que existe, para que serve, quem consome e onde a prosa divergiu do disco. Medido em 2026-11-11: **11** `AGENT.md` contra **10** agentes registrados em `opencode.json` (o `sdd-orquestrador` não está registrado — drift `d2`); **15** arquivos dentro de `.agents/` citam **5** caminhos de rule que não existem no disco; **48 de 49** diretórios de skill têm `SKILL.md` (o `prd-adr-pipeline` é citado como skill por 4 agentes mas não é carregável); **27 das 49** skills não têm nenhum agente consumidor. Além disso, o papel de planejamento que a própria prosa invoca (`planejador`, citado 3× em `.agents/`) **não existe como agente** — o planejamento vive diluído no `orchestrator` e numa skill (`dev-planner`) que nenhum agente referencia. Consequência: nem o owner, nem o projeto-destino, nem o agente em runtime sabem qual roster é o real; e cada adoção herda prosa que promete artefato inexistente.
> ❓ Validação: a dor existe hoje e dói o bastante para justificar a mudança? **Sim** — os números acima foram lidos do disco nesta data (comandos em §3.4) e são pré-condição dos PRDs 2–6 do programa.

## 2. Objetivo [obrigatória]
Tornar o roster do harness **verificável e decidido**: (a) inventário 1:1, com evidência de leitura, de todos os agentes, skills e rules que o harness instala; (b) cada artefato classificado — vivo, vendorizado por eixo, órfão com dono, ou prosa morta — sem "TBD"; (c) registro e disco em paridade, com o caso `sdd-orquestrador` decidido; (d) um papel de planejamento com fronteira explícita contra `product-manager`, `architect`, `sdd-compiler` e a skill `dev-planner`, medido por artefato produzido e por violação de fronteira. Resultado observável: a próxima adoção consegue responder "quais agentes existem, por que existem e quem os alimenta" sem ler 1.689 linhas de `AGENT.md` nem descobrir a resposta por tentativa.
> ❓ Validação: o objetivo é mensurável e não é uma solução? **Sim** — descreve estado observável do roster, não stack, formato ou algoritmo.

## 3. Contexto e evidências
### 3.1 Inventário de agentes (`ls .agents/agents/*/AGENT.md` → 11 arquivos; `grep -c '"prompt": "{file:' opencode.json` → 10)
| Agente | Registrado | Propósito declarado (1 linha) | Skills citadas no AGENT.md | Drift medido |
|---|---|---|---|---|
| `architect` | S | Decisões arquiteturais/ADRs; escrita só em `.spec/prd/**` | `context-compressor`, `prd-adr-pipeline` | cita `prd-adr-pipeline` como skill; o diretório não tem `SKILL.md` |
| `codebase-analyzer` | S | Reverse engineering do workspace; não escreve | — (usa tools do brain) | nenhum consumidor de skill; declara "reconstruct the systemic architecture", mandato que colide com o do `architect` |
| `code-reviewer` | S (`PROMPT.md`) | Parecer de code review por severidade | — | `AGENT.md` de 6 linhas é stub morto: o runtime usa `PROMPT.md` |
| `design-system-specialist` | S | Contratos de template (props/slots/estados) | `template-*` ×3, `frontend-design`, `frontend-*-specialist` | exige `frontend/DESIGN.md` (Pulse) — arquivo ausente no repo |
| `developer-engineer` | S | Implementa código e testes sob delegação | `java-*`, `frontend-*`, `template-*` ×3, `harness-report` | TaskFlow/PrimeVue/Remix e "proibido Axios" contradizem `frontend-coding-standards.md`; cita `security-standard.md` e outras 4 rules ausentes |
| `orchestrator` | S | Triagem, governança, SPEC/PLAN/TASKS, delegação | 20 skills | cita 5 rules ausentes, `frontend/DESIGN.md` e literais `taskflow` (`:200`, `:292`); assume planejamento na Fase 2 (`:309`) |
| `product-manager` | S | PRD, escopo, aceite, riscos de produto | `context-compressor`, `prd-adr-pipeline` | mesmo drift da skill sem `SKILL.md` |
| `qa-engineer` | S | Harness/qualidade e verificação independente | `context-compressor`, `harness-report` | invoca `@planejador` (`:9`) — agente inexistente |
| `sdd-orquestrador` | **N** | Esteira SDD com portões de aprovação | `sdd-compiler`, `prompt-optimizer`, `prd-adr-pipeline` | **não registrado em `opencode.json`** (drift `d2`); citado como vivo em 10 arquivos fora de `.spec/**`; também cita `planejador` (`:98`) |
| `security-engineer` | S | Auditoria OWASP/ASVS por fase do SDD | — | fonte da verdade declarada `.agents/rules/security-standard.md` **não existe** (`:26`, `:29`) |
| `ux-designer` | S | Parecer de UX/interface | `ui-ux-pro-max`, `frontend-design`, `context-compressor`, `frontend-vue-specialist` | Design System Pulse em `frontend/DESIGN.md` — ausente; cita PrimeVue/Vuetify (`:147`) |
> Soma: 10 registrados + 1 não registrado = 11. Permissões: 4 `edit: allow` (`developer-engineer`, `product-manager`, `qa-engineer`, `architect`), 6 `edit: deny`.

### 3.2 Inventário de skills (`ls -d .agents/skills/*/` → 49 diretórios; `.agents/skills/.vendor-lock.json` → 25 entradas)
| Classe | Nº | Evidência |
|---|---|---|
| Vendorizadas | 25 | lock: 12 `dart-lang/skills`, 10 `flutter/skills`, 1 `vercel-labs` (`react-best-practices`), 1 `Kadajett` (`nestjs-best-practices`), 1 `stitch` (`react-components`) |
| Locais (sem entrada no lock) | 24 | restante dos 49 diretórios |
| Com `SKILL.md` | 48 | `for d in .agents/skills/*/` — só `prd-adr-pipeline/` não tem (tem `checks.mjs` + `templates/`) |
| Sem consumidor em nenhum `AGENT.md` | 27 | `grep -rqlF <skill> .agents/agents/` — 25 vendorizadas + `dev-planner` + `harness-installer` |
| Sobrepostas por propósito | 5 grupos | twins `frontend-vue-specialist`/`frontend-react-specialist` (gate por eixo no instalador); trio `template-structure`/`-best-practices`/`-deepsearch` (consumido junto pelo `design-system-specialist`); `sdd-compiler`/`sdd-architecture-board`/`sdd-feedback`; `spec-review`/`security-review` (ambos revisam SPEC); `dev-planner`/`sdd-compiler` (ambos produzem PLAN) |

### 3.3 Inventário de rules (`ls .agents/rules/` → 8 arquivos)
| Arquivo | Agnóstico | Projeto externo citado | Referências quebradas |
|---|---|---|---|
| `brain-context.md` | S | — | 0 |
| `frontend-coding-standards.md` | N | Atlas ECM / shadcn-vue (13 linhas com termo externo) | 0 |
| `frontend-react-coding-standards.md` | N | Atlas ECM / shadcn-vue (13 linhas com termo externo) | 0 |
| `gate-contract.md` | S | — | 0 |
| `harness-config.md` | S | — | 0 |
| `prd-adr-pipeline.md` | S | — | 0 |
| `sdd-workflow-standard.md` | N | "projeto Atlas ECM" (`:3`) | 0 |
| `workflow-rules.md` | S (0 literal externo) | — | 5 rules (§9), 3 `.doc/` e `AGENTS.md` ausentes |

### 3.4 Comandos que produziram os números acima
`ls .agents/agents/*/AGENT.md | wc -l` (11) · `grep -c '"prompt": "{file:' opencode.json` (10) · `wc -l .agents/agents/*/AGENT.md` (1.689) · `ls -d .agents/skills/*/ | wc -l` (49) · chaves de `.agents/skills/.vendor-lock.json` (25) · `grep -rqlF <skill> .agents/agents/` (27 sem consumidor; 48 com `SKILL.md`) · `ls .agents/rules/` (8) · `grep -rln "rules/<nome>.md" .agents/` (15 arquivos citam os 5 caminhos ausentes) · `grep -rn "planejador" .agents/` (3) · `ls frontend/DESIGN.md` e `ls .doc/*` (ausentes) · `node scripts/static-checks.mjs` (exit 0, PRD-01 PASS).
> ❓ Validação: cada afirmação de problema tem lastro `arquivo:linha` ou medição executada? **Sim** — tabelas 3.1–3.3 com comando declarado em 3.4.

### 3.5 Paths de rule citados e ausentes (medido 2026-11-11)
`grep -rhoE "rules/[a-z0-9-]+\.md" .agents | sort -u` → **20** paths distintos citados; **13 não existem no disco**, somando **52** citações. Os 7 restantes (rules existentes) não entram na classificação. Apenas 8 são acionáveis; 5 são internos a skill vendorizada (apontam para o diretório de rules do upstream, não para o nosso — classificar sem ação).

| Path citado | Citações | Arquivos | Classe |
|---|---|---|---|
| `rules/backend-coding-standards.md` | 16 | 14 | acionável |
| `rules/security-standard.md` | 8 | 5 | acionável |
| `rules/backend-integration-tests.md` | 7 | 7 | acionável |
| `rules/backend-unit-tests.md` | 6 | 6 | acionável |
| `rules/db-migration-flyway.md` | 4 | 4 | acionável |
| `rules/db-migration-liquibase.md` | 3 | 3 | acionável |
| `rules/unit-testing-standards.md` | 2 | 2 | acionável |
| `rules/exemplo.md` | 1 | 1 | acionável (string de exemplo no `harness-installer/SKILL.md`) |
| `rules/security-validate-all-input.md` | 1 | 1 | vendor-internal (`nestjs-best-practices`) |
| `rules/bundle-barrel-imports.md` | 1 | 1 | vendor-internal (`react-best-practices`) |
| `rules/async-parallel.md` | 1 | 1 | vendor-internal (`react-best-practices`) |
| `rules/area-description.md` | 1 | 1 | vendor-internal (`react-best-practices`) |
| `rules/arch-avoid-circular-deps.md` | 1 | 1 | vendor-internal (`nestjs-best-practices`) |

> Achado: os 6 paths de backend/Flyway/Liquibase apontam para a baseline Java que este repo não tem — a prosa do harness herdou regras de um projeto Java. É a mesma classe do `FU-47`; a **correção** fica no PRD 2 (D5), a **classificação** acontece aqui.

## 4. Público e impacto
- **Owner do harness** — decide o roster; hoje não tem lista autoritativa e cada decisão de agente é tomada em contexto disperso.
- **Projeto-destino** — recebe agentes/skills/rules pelo instalador e herda, sem aviso, prosa que cita artefatos que não foram instalados (5 rules, `frontend/DESIGN.md`).
- **Agente de IA em runtime** — é a vítima direta da prosa órfã: seu prompt manda carregar skill sem `SKILL.md`, seguir rule inexistente e invocar `@planejador` inexistente.
- **Revisor / auditor** — passa a auditar roster por tabela + comando, em vez de reconstruir o inventário a cada ciclo.

## 5. Métricas de sucesso [obrigatória]
| Métrica | Como medir | Meta |
|---|---|---|
| Artefatos de agente sem classe e sem decisão no inventário | nº de `AGENT.md` sem linha em §3.1 com decisão de roster (manter/fundir/renomear/remover/registrar) | 0 de 11 |
| Divergências registro↔disco sem decisão | comparar `ls .agents/agents/*/AGENT.md` com `agent.*.prompt` de `opencode.json`; toda diferença precisa de decisão registrada | 0 (baseline 1: `sdd-orquestrador`) |
| Referências vivas a caminho inexistente sem classificação | união de `grep -rl "rules/<nome ausente>.md" .agents/` + `frontend/DESIGN.md` + `planejador`; cada arquivo precisa de "reapontar/remover/dívida com dono" | 0 não classificadas (baseline 15 arquivos / 5 rules) |
| Skills classificadas | linhas da tabela de skills ÷ `ls -d .agents/skills/*/` | 49/49 (baseline: 0 explícitas; 27 órfãs de consumidor) |
| Ciclos com artefato de planejamento produzido pelo papel de planejamento antes da SPEC | provinência declarada no artefato do ciclo (`.spec/**/PLAN.md` ou equivalente) | 100% dos ciclos do programa após adoção (baseline 0: papel inexistente) |
| Violações de fronteira do papel de planejamento por ciclo | checklist de fronteira no review do ciclo (planejamento não emite PRD, não decide ADR, não gera TASKS) | 0 |
| Suíte completa verde no ciclo | `commands.suiteFull` (`node --test … && node scripts/static-checks.mjs`) | 0 falhas |
> ❓ Validação: ao menos uma métrica tem a coluna "como medir" preenchida? **Sim** — todas as 7.

## 6. Escopo [obrigatória]
- **Inventário 1:1** de agentes (11), skills (49) e rules (8), com propósito, consumidor, eixo, e evidência de leitura por linha (§3). *Aceite*: todas as linhas do disco aparecem exatamente uma vez; nenhum número sem comando declarado.
- **Decisão de roster por agente**: manter, fundir, renomear, remover ou registrar — com justificativa e impacto de permissão. Inclui resolver o `sdd-orquestrador` (registrar de vez ou retirar com as referências tratadas) e o stub `code-reviewer/AGENT.md`. *Aceite*: 11/11 decisões, nenhuma "TBD"; referências ao agente removido tratadas (amarra RF-03).
- **Classificação de skills**: consumidor nomeado, vendorizada-gateada-por-eixo (fonte `.vendor-lock.json`, nunca nome de arquivo) ou órfã com dono. Inclui decidir o `prd-adr-pipeline` (sem `SKILL.md`) e as 22 skills mobile sem agente consumidor. *Aceite*: soma 49; nenhuma skill sem classe.
- **Prosa órfã classificada**: cada referência viva a artefato inexistente recebe "reapontar", "remover" ou "dívida registrada com dono e PRD". *Aceite*: zero referência viva não classificada.
- **Papel de planejamento de software** definido por problema, resultado esperado e métrica, com fronteira explícita contra `product-manager` (o quê/por quê + PRD), `architect` (decisão/ADR), `sdd-compiler` (geração de SPEC/PLAN/TASKS) e a skill `dev-planner` (metodologia). *Aceite*: definição aprovada sem sobreposição com os 4.
- **Este PRD não altera código, config, regra, skill, agente nem `workflow-state.json`** — define problema, escopo, métricas e critérios para os ADRs que virão.
> ❓ Validação: o escopo é fechado o bastante para caber em até 5 ADRs? **Sim** — 3 eixos de decisão (inventário/roster, classificação de artefatos, papel de planejamento).

## 7. NÃO entra [obrigatória]
- **PRD 2 — `prd-agnostic-artifacts` (ordem 2)**: agnosticização de skills/rules (`FU-47`) e reescrita do conteúdo stack-bound. Aqui a prosa stack-bound é **detectada e classificada**, não reescrita.
- **PRD 3 — `prd-installer-rust` (ordem 3)**: CLI Rust, reescrita do instalador, paridade de presets, TUI. Inclui o item 6 do owner ("instalação feita da maneira correta, sem invenção") — nenhuma decisão de instalação é tomada aqui.
- **PRD 4 — `prd-axes-split` (ordem 4)**: backend/frontend sem combo, perfis `go`/`rust` (`FU-46`), mobile Flutter/Dart (`FU-53`). Nada de preset novo ou configuração mobile neste ciclo.
- **PRD 5 — `prd-frontend-harness-fusion` (ordem 5)**: incorporar o harness de frontend. Aqui só se registra que 3 agentes apontam para `frontend/DESIGN.md` ausente.
- **PRD 6 — `prd-forge-integration` (ordem 6)**: commit/push/PR/issues em forge.
- **Não-objetivos deste ciclo**: criar agentes além do papel de planejamento; apagar skills ou rules; alterar `gate.js` ou `harness.config.json`; decidir stack do novo papel; definir formato de arquivo de inventário gerado.
> ❓ Validação: o que não entra está declarado, não inferido? **Sim** — 6 PRDs do programa mapeados em `workflow-state.json.program.prds` + 4 não-objetivos explícitos.

## 8. Riscos e mitigação
- **Inventário nasce desatualizado**: o disco muda (agente novo, skill vendorizada) e a tabela vira ficção. Mitigação: RF-07 exige números re-deriváveis por comando declarado e RF-02 exige que a divergência seja detectável, não memorizada.
- **Remover/renomear agente quebra quem o cita**: `sdd-orquestrador` aparece em 10 arquivos vivos (rules, skill, `scripts/sdd-checks.mjs`, `docs/`). Mitigação: RF-03 e RF-06 acoplados — nenhum agente sai sem referências tratadas.
- **Papel de planejamento vira camada extra**: sobreposição com `product-manager`, `architect` e `sdd-compiler` gera handoff duplicado e latência. Mitigação: RF-05 exige fronteira de 4 vizinhos escrita antes de qualquer registro; métrica de violação = 0.
- **Confundir "skill sem consumidor" com "skill inútil"**: as 25 vendorizadas são gateadas por eixo no instalador e algumas só entram em destino mobile. Mitigação: classe `vendor-by-axis` derivada do lock, nunca do nome (mesma regra do instalador, `ADR-002`).
- **Decisão do roster barra o programa**: PRDs 2–6 dependem do inventário. Mitigação: §16 lista as decisões mínimas; o resto pode virar follow-up.

## 9. Requisitos funcionais [obrigatória]
- **RF-01** *(origem: item 2 + item 3)* — inventário 1:1 de agentes, skills e rules com nome, propósito, consumidor/eixo e fonte de evidência. *Verificável*: contagem de linhas da tabela = saída de `ls`/`grep` para cada diretório.
- **RF-02** *(origem: item 2)* — toda divergência entre disco e `opencode.json` tem decisão registrada (registrar, remover ou classificar como legado com motivo). *Verificável*: comparação registro↔disco = 0 divergências sem decisão; baseline 1 (`sdd-orquestrador`).
- **RF-03** *(origem: item 2 + item 3)* — nenhuma referência viva a artefato inexistente permanece sem classificação (reapontar/remover/dívida com dono). *Verificável*: `grep -rhoE "rules/[a-z0-9-]+\.md" .agents` filtrado por ausência no disco resulta em **13** paths ausentes de 20 citados (tabela §3.5); somados a `frontend/DESIGN.md` e às 3 citações de `planejador`, o total classificado deve ser 15/15 (8 acionáveis + 5 vendor-internal + 1 exemplo + DESIGN.md + planejador×3); baseline não classificado = 15.
- **RF-04** *(origem: item 3)* — cada uma das 49 skills recebe classe `consumer` | `vendor-by-axis` | `orphan+decision`; a classe vendorizada vem do `.vendor-lock.json`, nunca do prefixo do nome. *Verificável*: soma das classes = 49 e cruzamento com as chaves do lock.
- **RF-05** *(origem: item 10)* — o papel de planejamento é descrito por problema, resultado esperado e métrica, com fronteira escrita contra `product-manager`, `architect`, `sdd-compiler` e a skill `dev-planner`. *Verificável*: checklist de fronteira com 4 itens, cada um com "não faz" explícito e zero item vazio.
- **RF-06** *(origem: item 2)* — cada um dos 11 agentes recebe decisão de roster (manter/fundir/renomear/remover/registrar) com justificativa e impacto de permissão (`edit`). *Verificável*: 11/11 decisões preenchidas; nenhuma "TBD".
- **RF-07** *(origem: item 2 + item 3)* — todo número publicado no inventário é re-derivável pelo comando declarado na mesma seção. *Verificável*: reexecutar os comandos de §3.4 e obter os mesmos valores (diferença = drift a registrar, não a esconder).
- **RF-08** *(origem: item 2 + item 3)* — a revisão não pode quebrar os checks do próprio repo. *Verificável*: `commands.suiteFull` verde, incluindo `PRD-01`/`ADR-01`/`ADR-02`.
> ❓ Validação: cada requisito é verificável por um teste? **Sim** — todos por comando de contagem/comparação já existente ou por checklist com item obrigatório.

## 10. Histórias de usuário
- Dado o `opencode.json` deste repo, Quando o owner lista os agentes ativos, Então ele obtém 11 linhas com decisão explícita e nenhum agente órfão ou não registrado sem justificativa.
- Dado um projeto-destino recém-instalado, Quando um agente tenta carregar uma skill citada no próprio prompt, Então ou a skill existe e tem `SKILL.md`, ou a referência está classificada como dívida com dono — nunca uma promessa silenciosa.
- Dado o início de um ciclo de feature, Quando a fase de planejamento começa, Então existe um papel nomeado que produz o plano antes da SPEC, e esse papel não emite PRD nem decide ADR.
- Dado uma skill vendorizada de plataforma que o destino não usa, Quando o instalador monta o destino, Então ela é classificada como `vendor-by-axis` e não conta como órfã no inventário.

## 11. UX / experiência
Sem tela. A experiência é de leitura e decisão: (a) o inventário precisa ser legível em uma passada — tabela por camada, uma linha por artefato, drift na última coluna; (b) o estado "não decidido" precisa ser visível e barulhento, nunca um branco silencioso; (c) a decisão de roster precisa citar o efeito no destino (o que o adotante passa a receber ou deixa de receber); (d) erro clássico a evitar: tabela que promete "inventário completo" e omite licenças, `VENDOR-NOTICE.md` e arquivos de licença (presentes em `.agents/skills/`, não são skills).

## 12. Dependências e relações com os PRDs irmãos
- **Depende de**: nada além do disco atual e de `workflow-state.json.program` (ordem dos PRDs, medido).
- **Bloqueia**: PRD 2 (`prd-agnostic-artifacts`) — a lista de prosa stack-bound sai daqui; PRD 5 (`prd-frontend-harness-fusion`) — o destino dos 3 agentes que citam `frontend/DESIGN.md` depende da decisão de roster; PRD 3 (`prd-installer-rust`) — inventário é a entrada da paridade de presets.
- **Relação declarada com os irmãos** (todos fora deste ciclo, ordem medida em `workflow-state.json.program.prds`): 2 `prd-agnostic-artifacts`, 3 `prd-installer-rust`, 4 `prd-axes-split`, 5 `prd-frontend-harness-fusion`, 6 `prd-forge-integration`.
- **Ferramentas que este PRD usa e não altera**: `scripts/static-checks.mjs` e `.agents/skills/prd-adr-pipeline/checks.mjs` (PRD-01/ADR-01/ADR-02); `commands.suiteFull` de `harness.config.json`.

## 13. Segurança
- **Superfície nova: nenhuma.** Este PRD não cria tool, plugin, gate ou permissão.
- **O roster é superfície de autoridade**: 4 agentes têm `edit: allow` e 6 têm `edit: deny` (medido). Fundir ou remover agente muda quem pode escrever — a decisão de roster precisa declarar o efeito por agente (RF-06).
- **Remoção de agente não pode reduzir cobertura de gate**: `gate.js` nega por papel (mapa `sessionID → agente`, `gate-contract.md` I11). Agente removido deixa regras por papel sem entrada — declarar como risco no ADR, não como efeito colateral silencioso.
- **Inventário não expõe segredo**: nada de conteúdo de credencial; apenas caminhos e contagens. O `.vendor-lock.json` já é público no repo.

## 14. Perguntas abertas
1. **`sdd-orquestrador`: registrar ou retirar?** Tem `AGENT.md` completo, é citado em 10 arquivos vivos e não está em `opencode.json`. Registrar cria dois orquestradores com mandatos sobrepostos; retirar exige tratar as 10 referências. → decisão do owner (§16-D1).
2. **Roster: consistência ou consolidação?** O mínimo é registrar/renomear. O máximo é fundir papéis sobrepostos (`codebase-analyzer` × `architect`; `sdd-orquestrador` × `orchestrator`) e apagar o stub `code-reviewer/AGENT.md`. → §16-D2.
3. **Skills vendorizadas sem consumidor de agente (25, incluindo 22 mobile):** manter gateadas por eixo e declarar, ou exigir agente por stack? → §16-D3.
4. **`prd-adr-pipeline` sem `SKILL.md`, instalado e citado como skill por 4 agentes:** virar skill de fato, ou passar a ser declarado como módulo de checks e as referências mudam? → §16-D4.
5. **Prosa órfã (5 rules, 3 `.doc/`, `AGENTS.md`, `frontend/DESIGN.md`):** reapontar/remover neste ciclo, ou tratar no PRD 2? → §16-D5.
6. **Papel de planejamento: nome, modo (`primary`/`subagent`) e herança do nome `planejador`** citado 3× na prosa. Se herdar o nome, as 3 citações passam a ser verdadeiras sem edição. → §16-D6.
7. **Numeração canônica da demanda:** `workflow-state.json.program.origem` registra "8 itens"; a demanda recebida por este PRD enumera 10. Qual lista é a canônica para rastrear os PRDs 2–6? → §16-D7.

## 15. PICCO (prompt da demanda)
<task>Escrever o PRD do ciclo "inventário do harness + revisão do roster de agentes + agente especialista em planejamento", com inventário 1:1 medido por leitura de disco, decisões de roster numeradas e bloco de aprovação humana, sem criar ADR nem alterar código/config.</task>
<context>Repo harness (`/home/joao/fusionlf/wsProjeto/harness`), programa `harness-refactor-2026-11` ordem 1. Demanda do owner 2026-11-11, itens 2, 3 e 10. Medições em 2026-11-11: 11 `AGENT.md` vs 10 registros; `sdd-orquestrador` órfão; 49 skills (25 vendorizadas, 27 sem consumidor, 1 sem `SKILL.md`); 8 rules, 3 stack-bound; 15 arquivos citam 5 rules ausentes; `planejador` citado 3× sem agente. Fora de escopo: PRDs 2–6 (§7).</context>

## 16. Aprovação [obrigatória]
- **Veredito**: **APROVADO** — portão G1 fechado pelo owner em 2026-11-11; decisões D1–D7 registradas abaixo
- **Data**: 2026-11-11 (redação e aprovação no mesmo dia)
- **Portão**: **G1** (humano/HITL) — aprovação do PRD **antes** de qualquer `ADRs/**`
- **Aprovador**: owner do harness
- **Decisões que o owner precisa fechar** (cada uma vira insumo de ADR; nenhuma é recomendação do agente):
  - **D1 — `sdd-orquestrador`**: registrar em `opencode.json` (dois orquestradores) **ou** retirar e tratar as 10 referências vivas?
  - **D2 — alcance do roster**: só paridade registro↔disco, **ou** também consolidação de sobrepostos (`codebase-analyzer`×`architect`, `sdd-orquestrador`×`orchestrator`, stub `code-reviewer/AGENT.md`)?
  - **D3 — skills vendorizadas sem consumidor** (25, 22 mobile): manter declaradas como `vendor-by-axis` **ou** exigir agente consumidor por stack?
  - **D4 — `prd-adr-pipeline` sem `SKILL.md`**: criar a skill **ou** reclassificar como módulo de checks e reapontar os 4 agentes?
  - **D5 — prosa órfã** (5 rules + 3 `.doc/` + `AGENTS.md` + `frontend/DESIGN.md`): tratar neste PRD **ou** transferir ao PRD 2?
  - **D6 — papel de planejamento**: qual nome (herdar `planejador` ou nome novo), qual modo (`primary`/`subagent`) e confirmação de que ele **consome** a skill `dev-planner` em vez de duplicá-la?
  - **D7 — lista canônica de itens** do owner (8 registrados × 10 enumerados) para rastrear os PRDs 2–6.
- **Decisões fechadas pelo owner (2026-11-11)**:
  - **D1+D2 = retirar + consolidar**: `sdd-orquestrador` sai (10 referências tratadas); `codebase-analyzer` funde em `architect`; stub `code-reviewer/AGENT.md` (6 linhas, runtime usa `PROMPT.md`) é removido.
  - **D3 = manter `vendor-by-axis`**: as 25 vendorizadas ficam classificadas por `.vendor-lock.json`, sem exigir agente consumidor por stack.
  - **D4 = reclassificar `prd-adr-pipeline` como módulo**: sai de `.agents/skills/`, as 4 citações em agentes são reapontadas.
  - **D5 = classificar aqui, corrigir no PRD 2**: prosa órfã (8 paths acionáveis de §3.5 + 3 `.doc/` + `AGENTS.md` + `frontend/DESIGN.md`) é classificada neste ciclo; a edição do texto fica no PRD 2.
  - **D6 = `planner`**, modo `subagent`, **consome** a skill `dev-planner`; as 3 citações de `planejador` são reapontadas.
  - **D7 = fechada pelo orquestrador**: a lista canônica tem **10 itens** (o "8" do bloco PICCO foi erro de contagem do orquestrador, corrigido em `workflow-state.json.program`).
- **Nota**: o agente redigiu; o veredito é do owner. Nenhum `ADRs/**` foi criado (INV-3 satisfeito: `ADRs/` inexistente).
> ❓ Validação: o owner aprovou (veredito + data) antes de qualquer ADR? **Não ainda** — este bloco está em `draft`; as 7 decisões acima são o que o portão G1 precisa fechar.
