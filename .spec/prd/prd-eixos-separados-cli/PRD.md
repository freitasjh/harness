# PRD — Eixos separados + CLI visual do instalador

> **prd-id**: `prd-eixos-separados-cli`
> **Dono da aprovação**: owner (decisão §16 `D16-EIXOS-CLI`, `workflow-state.json`, 2026-11-17T01:28:48.585Z)
> **Status**: approved — reabertura de D5 e ADR-004 registrada em `overrides[portao="reabertura-D5-ADR004-eixos-cli"]`
> **Mapa das 16 seções**: §1, §2, §5, §6, §7, §9 e §16 são **obrigatórias**
> (marcadas `[obrigatória]`); §3, §4, §8, §10–§15 são recomendadas.
> Orçamento (NFR-5): PRD ≤120 linhas; nenhuma seção >15 linhas.

## 1. Problema [obrigatória]
Instalador não entrega melhora visível: 12 opções casadas impedem combinar backend e frontend; tela line-based `[1/5]` exige digitação e é inutilizável. Owner classificou PRD-3 como tempo perdido.
> ❓ Validação: a dor existe hoje e dói o bastante para justificar a mudança? (sim — decisão §16)

## 2. Objetivo [obrigatória]
Instalar qualquer combinação backend/frontend sem digitar comando, por CLI interativa (setas+enter), com config válida para as 48 combinações e critério comportamental medido antes da spec final.
> ❓ Validação: o objetivo é mensurável e não é uma solução? (sim — métricas em §5)

## 3. Contexto e evidências
- `STACK_PROFILES` tem **12** perfis; `axes` já separa eixos (`java+react` → backend `java`, frontend `react`), mas só essas 12 combinações têm perfil. Fonte: `install.mjs:252`; re-derivar: `node -e 'import("./installer/install.mjs").then(m=>console.log(Object.keys(m.STACK_PROFILES).length))'`.
- `AXIS_IDS`: 8 backends × 6 frontends = **48** combinações; `rust+vue`, citada pelo owner, não tem perfil. Fonte: `install.mjs:210`.
- Oráculo byte-congelado cobre **9 presets byte-equal + java+react**; **36** combinações novas não têm baseline. Fonte: `installer/__tests__/golden.spec.mjs:48`; re-derivar: `node --test installer/__tests__/golden.spec.mjs`.
- **13** arquivos consomem presets (`install.mjs`, `contract-registry.mjs`, `contract-pure.mjs`, `installer-rs/src/ops/registry.rs`, specs etc.). Re-derivar: `grep -rlE 'STACK_(VALUES|PROFILES)' installer/ .agents/ | sort -u`.
- V19 consumer=21; V20 population=223/30373 (medição do orquestrador, insumo). Re-derivar: `node scripts/static-checks.mjs`.
- Decisão §16: `D16-EIXOS-CLI` + override de reabertura — composição por eixo, substituição dos 12, re-derivação de selo, critério comportamental.

## 4. Público e impacto
Usuário do instalador (escolhe stack no destino) e mantenedores do harness (13 consumidores de presets, selo e specs congeladas). Impacto: 36 combinações antes impossíveis passam a ser instaláveis.

## 5. Métricas de sucesso [obrigatória]
| Métrica | Como medir (comando de re-derivação) | Meta |
|---|---|---|
| Combinações com config válida | `node --test installer/__tests__/eixos-stack.spec.mjs` (oráculo 48) | 48/48 |
| Paridade byte das combinações | `node --test installer/__tests__/golden.spec.mjs` | 0 divergência não declarada; 36 novas com baseline aprovado |
| Selo re-derivado | `node scripts/static-checks.mjs && node scripts/vendor-skills.mjs --check` | selo novo ratificado pelo owner |
| Consumidores migrados | `grep -rlE 'STACK_(VALUES|PROFILES)' installer/ .agents/ \| sort -u` | nenhum preset casado como caminho principal |
| Interações da CLI | protótipo ao vivo + `node --test installer/__tests__/wizard.spec.mjs` | N telas, M interações (setas+enter) medidas |
| Comando digitado | gravação do protótipo | zero |
| i18n PT-BR | `node --test installer/__tests__/wizard.spec.mjs` + varredura de literais | completo, sem literal solto |
> ❓ Validação: ao menos uma métrica tem "como medir" preenchida? (sim — todas)

## 6. Escopo [obrigatória]
- **Frente A — separação de eixos**: compor config por eixo — `commands`/`moduleMap` do backend, `mcp`/`stacks`/skills do frontend, textos derivados ("rust backend", "vue frontend").
- **Frente B — CLI visual**: substituir tela line-based `[1/5]` por CLI interativa setas+enter, tipo Copilot CLI / Kiro CLI.
- Re-derivar selo, `golden.spec.mjs`, V20 e baseline com aprovação do owner.
- Protótipo da CLI demonstrado ao vivo antes da spec final; ux-designer fonte da verdade visual; design-system-specialist para componentes.
> ❓ Validação: o escopo é fechado o bastante para caber em um ADR? (sim — duas frentes avaliáveis separadamente)

## 7. NÃO entra [obrigatória]
- Manter os 12 presets casados como caminho principal (owner decidiu substituir).
- Segredo em argv, stdout ou stderr; segredo com eco em TTY.
- Quebrar selo ou baseline sem re-derivação declarada e ratificada.
- Prometer CLI visual sem critério comportamental medido.
- RESEARCH, ADR-INDEX ou ADRs neste documento; mudança de `gate.js` ou código/config/estado.
> ❓ Validação: o que não entra está declarado, não inferido? (sim)

## 8. Riscos e mitigação
- **P0-1** — 36 combinações novas sem baseline byte-equal: re-derivar `golden.spec.mjs` para 48 e aprovar baseline com owner; nenhuma combinação entra verde sem baseline.
- **P0-2** — selo quebrado sem re-derivação: registrar novo hash no PRD e ratificar; não prometer compatibilidade com selo antigo.
- **P1-1** — CLI visual prometida sem critério medido: protótipo ao vivo antes da spec; N telas/M interações medidos; ux-designer vinculante.
- **P1-2** — segredo em argv/stdout/stderr: leitura sem eco em TTY, nunca argv; teste de não-vazamento.
- **P2-1** — 13 consumidores de presets: migrar todos e cobrir em teste; `installer-rs` incluído.
- **P2-2** — confundir as duas frentes: avaliar separação de eixos e CLI visual como unidades distintas na esteira ADR.

## 9. Requisitos funcionais [obrigatória]
- **RF-01** — Owner fixou 8 backends e 6 frontends; gerar config válida para todas as 48 combinações. Verificável: `eixos-stack.spec.mjs` com oráculo 48.
- **RF-02** — Compor `commands`/`moduleMap` do eixo backend. Verificável: asserção por eixo em `eixos-stack.spec.mjs`.
- **RF-03** — Compor `mcp`/`stacks`/skills do eixo frontend. Verificável: `contract-registry.spec.mjs`.
- **RF-04** — Derivar textos ("rust backend"/"vue frontend"), sem string literal por preset. Verificável: grep por literal em `install.mjs`.
- **RF-05** — Substituir os 12 presets como caminho principal. Verificável: `STACK_VALUES`/`STACK_PROFILES` re-derivados no PRD.
- **RF-06** — CLI setas+enter, zero comando digitado. Verificável: protótipo gravado + `wizard.spec.mjs`.
- **RF-07** — i18n PT-BR completo na CLI. Verificável: varredura de literais + `wizard.spec.mjs`.
- **RF-08** — Segredo sem eco em TTY e nunca em argv. Verificável: teste de não-vazamento.
- **RF-09** — Selo e baseline re-derivados e ratificados. Verificável: `suiteFull` + registro em §16.
- **RF-10** — Protótipo demonstrado antes da spec final. Verificável: evidência de protótipo no ciclo.
> ❓ Validação: cada requisito é verificável por um teste? (sim)

## 10. Histórias de usuário
- Dado um backend e um frontend quaisquer entre os 8×6, Quando o usuário os seleciona na CLI, Então recebe config válida sem digitar comando.
- Dado o menu line-based atual, Quando a nova CLI entra, Então navegação ocorre por setas+enter com texto PT-BR.
- Dado um segredo solicitado, Quando o usuário o informa, Então nada é ecoado em TTY nem aparece em argv/stdout/stderr.

## 11. UX / experiência
ux-designer é fonte da verdade visual; design-system-specialist produz componentes. Fluxo: seleção de backend → seleção de frontend → revisão → instalação. Estados de erro: combinação inválida, entrada sem default, aborto. Protótipo ao vivo mede N telas e M interações antes da spec final.

## 12. Dependências
- Aprovação do owner para o novo baseline e selo (decisão §16 já registrada).
- ux-designer e design-system-specialist antes da spec visual.
- Oráculo `golden.spec.mjs`/`eixos-stack.spec.mjs` re-derivado antes de selar.

## 13. Segurança
Nenhum segredo em argv (visível em `/proc` e histórico); leitura em TTY sem eco, com tratamento de EOF. Nenhuma superfície nova de rede. Superfície nova: parser de setas da CLI — validar entrada e evitar loop de `BAD_ANSWER`.

## 14. Perguntas abertas
Nenhuma de produto: E1–E6 afirmados pelo owner e fechados em `D16-EIXOS-CLI`. Valores exatos de N, M e do hash do selo são medições do protótipo, ratificadas em §16 — não decisões em aberto.

## 15. PICCO (prompt da demanda)
<task>Substituir 12 presets casados por 48 combinações de eixos e a tela line-based por CLI visual setas+enter, com selo e baseline re-derivados.</task>
<context>install.mjs (STACK_PROFILES/STACK_VALUES/WIZARD_MENU), contract-registry.mjs, golden/eixos-stack/wizard.spec, 13 consumidores. Decisão §16 D16-EIXOS-CLI.</context>
<constraints>Compor por eixo; sem preset casado como principal; segredo sem eco e nunca em argv; ux-designer e design-system-specialist; selo re-derivado com aprovação.</constraints>
<acceptance>48 configs válidas, N telas/M interações medidas, i18n PT-BR completo, zero comando digitado, protótipo ao vivo antes da spec.</acceptance>
<open_questions></open_questions>

## 16. Aprovação [obrigatória]
- **Veredito**: Aprovado — owner, decisão §16 `D16-EIXOS-CLI` + override `reabertura-D5-ADR004-eixos-cli` (reabre D5 e ADR-004).
- **Data**: 2026-11-17T01:28:48.585Z.
- **Portão**: G1_PRD (reabertura por §16); nenhum ADR nasce antes deste bloco.
- **Decisões do owner**:
  1. Compor config por eixo: `commands`/`moduleMap` do backend, `mcp`/`stacks`/skills do frontend, textos derivados.
  2. Todas as 48 combinações (8 backend × 6 frontend); compatibilidade = **substituir** os 12 atuais.
  3. CLI visual tipo Copilot CLI / Kiro CLI (setas+enter), em substituição à tela line-based.
  4. Re-derivar `golden.spec.mjs`, V20 e selo, com baseline aprovado pelo owner.
  5. Critério comportamental medido (N telas, M interações, i18n PT-BR, zero comando digitado, 48 configs) e protótipo demonstrado ao vivo antes da spec final.
- **Risco aceito**: 36 combinações novas sem baseline — coberto por re-derivação (P0-1).
> ❓ Validação: o owner aprovou (veredito + data) antes de qualquer ADR? (sim)
