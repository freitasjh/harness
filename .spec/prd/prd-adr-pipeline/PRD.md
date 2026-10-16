# PRD — Esteira PRD → ADR → SDD (intenção aprovada antes do design)

> **prd-id**: `prd-adr-pipeline` (casa com `.spec/prd/prd-adr-pipeline/`)
> **Dono da aprovação**: owner do harness
> **Status**: approved — veredito do owner em `§16`; registro do portão em `workflow-state.json.gates.G2_PRD` (`approved_user_2026_10_16`)
> **Mapa das 16 seções**: §1, §2, §5, §6, §7, §9 e §16 são obrigatórias; §3, §4, §8, §10–§15 recomendadas.
> Orçamento (NFR-5): PRD ≤120 linhas; nenhuma seção >15 linhas.

## 1. Problema [obrigatória]
Hoje o dono do produto aprova o que será construído por **confiança**: o único artefato aprovado antes do código é escrito para o compilador, não para quem decide. O que estava sendo construído só fica claro no merge, quando reprovar já custou branch aberta, design completo e código escrito. Não existe um artefato de negócio aprovado **antes** do design.
> ❓ Validação: a dor existe hoje e dói o bastante para justificar a mudança? (sim/não)

## 2. Objetivo [obrigatória]
Passar a existir uma **intenção aprovada pelo dono, legível sem ler código, antes de qualquer design**; e o trabalho revisável passa a ser pequeno o bastante para o dono resumir cada entrega em uma frase. Resultado observável: nenhum design ou branch de trabalho nasce antes da intenção aprovada; o retrabalho pós-entrega cai.
> ❓ Validação: o objetivo é mensurável e não é uma solução? (sim/não)

## 3. Contexto e evidências
- Pedido literal do dono: *"fico muito sem contexto do que está sendo desenvolvido, fazendo com que passe coisas erradas e que acaba dando mais retrabalho"*.
- Nenhuma menção a intenção aprovada nas regras vigentes (0 ocorrências).
- Histórico de retrabalho: 43 follow-ups; uma escalação com 4 rodadas de revisão no mesmo ponto; 1 override por limite de correção.
- A dor admite ≥3 causas; este escopo ataca 2 (intenção não vista antes; unidade de revisão grande). A terceira (drift entre o que se escreve e o que se entrega) é **medida**, não presumida.
- **Meta-ciclo (retroativo)**: este PRD é o dogfood da esteira sobre si mesma. A aprovação humana do *conteúdo* veio antes (portão `P1→P2`/`PROPOSAL`, 2026-10-15); o *artefato* `PRD.md` é posterior à realização das decisões. Exceção declarada em `SPEC §4.4` ("PRD retroativo ao próprio ciclo").

## 4. Público e impacto
- **Dono do produto** — decide; ganha um artefato de negócio para aprovar/reprovar cedo.
- **Quem conduz o ciclo** — ganha uma unidade de trabalho pequena e sequenciada.
- **Quem revisa a entrega** — ganha contexto de negócio para julgar o que foi construído.
- Impacto: menos retrabalho pós-merge; decisão de reprovar fica mais barata.

## 5. Métricas de sucesso [obrigatória]
| Métrica | Como medir | Meta |
|---|---|---|
| Unidade de revisão pequena (SM-2) | 1 merge = 1 decisão; o dono resume cada revisão em 1 frase | 100% dos merges |
| Retrabalho pós-merge por decisão (SM-3) | Δ de follow-ups entre retratos consecutivos do estado, por decisão | cair vs. baseline |
| Suíte confiável (SM-6) | suíte completa verde em 100% dos merges | 100% |
| Zero merge revertido por desalinhamento (SM-4) | contagem de reversões/reaberturas por "não era isso" | 0 |
| Desalinhamento capturado antes (SM-1) | pedidos na leitura ÷ pedidos após aprovar | ⚠️ não falseável hoje — declarada |
| Guardrail de cerimônia (SM-5) | nº de intenções para bug/chore/abaixo do limiar | ⚠️ não falseável hoje — declarada |
| Tempo até o primeiro "não é isso" (SM-7) | quantas decisões/branches existiam quando o dono disse isso | ⚠️ não falseável hoje — declarada |
> ❓ Validação: ao menos uma métrica tem a coluna "como medir" preenchida? (sim/não)

## 6. Escopo [obrigatória]
- Intenção aprovada (PRD) como artefato de negócio, legível sem código, com pergunta fechada por seção.
- Pesquisa de alternativas com fonte antes de decidir tecnologia.
- Decomposição da intenção em decisões independentes, cada uma = 1 branch = 1 PR = 1 ciclo de design.
- Verificações automáticas de formato da esteira, entrando pela suíte já existente (sem novo bloqueio de runtime).
- Isenção explícita: typo, doc, rename interno, formatação, refactor sem efeito observável e bump de patch não geram PRD.
> ❓ Validação: o escopo é fechado o bastante para caber em um ADR? (sim/não)

## 7. NÃO entra [obrigatória]
- **Bloqueio de runtime para PRD/ADR** — quebraria a decisão de não criar novos denies; a esteira prova formato, não nega tool.
- **Intenção aprovada para bug** — bug mantém o fluxo próprio de correção (decisão do dono).
- **Automação de PR/merge** — a ferramenta não está instalada; o merge continua humano.
- **Propagar os verificadores para o repositório-destino** — fora deste ciclo; declarado como processo.
- **Consertar o drift entre o que se escreve e o que se entrega** — causa distinta; ganha métrica própria para ser medida antes de atacada.
- **Alterar a suíte completa selada** — mudaria o selo e a contraprova; os verificadores entram por comando já existente.
> ❓ Validação: o que não entra está declarado, não inferido? (sim/não)

## 8. Riscos e mitigação
- **A cerimônia virar a nova dor** (PRD para tudo): isenção declarada + teto de linhas + teto de decisões por intenção.
- **Independência das decisões ser só aspiração**: cada decisão declara de que depende e qual interface congela.
- **Revisão virar corrida adversarial**: verificadores só estruturais e determinísticos (presença/campo/orfandade).
- **Causa errada** (retrabalho vem de drift, não de intenção): baseline congelado antes + métrica de retrabalho com gatilho de pivot.

## 9. Requisitos funcionais [obrigatória]
- **RF-01**: existe uma intenção de negócio aprovada antes de qualquer design ou branch de trabalho.
- **RF-02**: a intenção é legível sem ler código — cada seção obrigatória tem uma pergunta fechada e a seção "NÃO entra" é obrigatória e não-vazia.
- **RF-03**: a intenção cobre ≥1 métrica com "como medir" preenchido.
- **RF-04**: cada decisão tem pesquisa com ≥2 fontes antes de virar decisão.
- **RF-05**: as decisões são sequenciadas 1:1 com o que existe, com no máximo 1 em andamento.
- **RF-06**: verificadores automáticos de formato entram pela suíte existente, sem novo bloqueio de runtime.
- **RF-07**: mudança abaixo do limiar de isenção não gera intenção nem decisão.
> ❓ Validação: cada requisito é verificável por um teste? (sim/não)

## 10. Histórias de usuário
- Dado um pedido novo classificado como feature, Quando o dono lê a intenção, Então ele aprova ou reprova antes de existir qualquer design.
- Dado um conjunto de decisões, Quando o dono revisa uma entrega, Então ele resume o PR em 1 frase.
- Dado um pedido de typo/doc/refactor sem efeito observável, Quando ele é classificado, Então nenhuma intenção é exigida.

## 11. UX / experiência
Fluxo principal: pedido → intenção escrita e aprovada → pesquisa → decisões sequenciadas → 1 decisão = 1 branch = 1 PR → design. Estados: intenção pendente (segura o design), intenção reprovada (revisar antes de seguir), mudança abaixo do limiar (segue sem intenção).

## 12. Dependências
- A detecção de ciclo existente precisa tratar a árvore da intenção como fora de ciclo.
- A suíte existente precisa continuar verde com a árvore da intenção materializada.
- Registro do estado do ciclo (bloco de produto) para instrumentar a métrica de retrabalho.

## 13. Segurança
- Superfície nova: escrita de quem redige a intenção e a decisão. Sem bloqueio de runtime; mitigação de processo + revisão humana no merge (nível declarado: processo).
- Sem segredo em artefato versionado; o bloco de aprovação não guarda credencial.

## 14. Perguntas abertas
- A causa real do retrabalho é a intenção não vista ou o drift? Medido por baseline + métrica de retrabalho; se não cair em 3 decisões, decidir pivot.
- O teto de 5 decisões por intenção é o ponto certo? Ajustável após o primeiro caso real.

## 15. PICCO (prompt da demanda)
<task>Escrever o PRD real da esteira PRD → ADR → SDD em .spec/prd/prd-adr-pipeline/PRD.md, com as 7 seções obrigatórias, pergunta fechada por seção, §7 não-vazia, métrica com "como medir" e bloco de aprovação pendente (sem auto-assinatura).</task>
<context>Dogfood da esteira sobre si mesma. Fontes: PROPOSAL.md (problema/escopo/riscos/critérios), SPEC §4.4 e §14.1 (métricas SM), template de PRD (SSoT da numeração). A aprovação é do owner, pendente do portão humano.</context>

## 16. Aprovação [obrigatória]
- **Veredito**: **aprovado** (sem ressalvas)
- **Data**: 2026-10-16
- **Portão**: **G2** (humano/HITL) — evento de aprovação do owner registrado em `workflow-state.json.gates.G2_PRD`
- **Aprovador**: owner do harness
- **Nota**: o veredito é do owner, não do agente (`SPEC §14`, item 13); o agente redigiu, o owner aprovou.
- **Retroatividade declarada**: os commits que realizam as decisões são de **2026-10-15**; a aprovação humana do *conteúdo* precedeu-os no portão `P1→P2`/`PROPOSAL`, mas o *artefato* `PRD.md` (e este bloco) é **posterior** a eles. Exceção declarada em `SPEC §4.4` ("PRD retroativo ao próprio ciclo"). O dogfood prova **formato e checks**, não a ordenação temporal.
> ❓ Validação: o owner aprovou (veredito + data) antes de qualquer ADR? (sim/não)
> **Resposta**: **não** — neste meta-ciclo a aprovação do artefato é retroativa à realização das decisões (linha acima; `SPEC §4.4`). A ordenação temporal **não** é o que este dogfood prova.
