# TASKS — Refactor prompt-optimizer v1 → v2

Derivado de `.spec/refactor-prompt-optimizer/SPEC.md` (aprovada).

## Tabela de Tasks

| ID | Arquivo alvo | Ação | Critério de aceite | Verificação |
|----|---------------|------|--------------------|-------------|
| PO-01 | `.spec/refactor-prompt-optimizer/SPEC.md` | CRIAR | SPEC aprovada reproduzida íntegra: §1..§9, sem resumo, sem reinterpretar, sem remover seções. Quem lê depois implementa sem perguntar nada. | — (artefato de entrada) |
| PO-02 | `.agents/skills/prompt-optimizer/SKILL.md` | REWRITE | v1 substituída. Frontmatter `name: prompt-optimizer` + description citando 6 elementos PICCO, 2 rotas, re-encoding. Seções: Regra Fundamental, 6 Elementos (tabela E1..E6), Fluxo, Rota A, Rota B, Contrato de Saída, Rota de Conflito, Exceção (comandos de consulta), Anti-Patterns, Brain, Verificação. Zero resíduo de tier. | V3, V5 |
| PO-03 | `.agents/skills/prompt-optimizer/references/clarifying-questions.md` | REWRITE | Reescrito POR ELEMENTO E1..E6 (não por tipo de demanda). Cada elemento: pergunta primária, 2-3 variações, o que NÃO perguntar. Ao final: "Perguntas de Conflito" (rota 3.5) e "Perguntas de Desempate" (2ª rodada Rota A). | — |
| PO-04 | `.agents/skills/prompt-optimizer/references/picco-template.md` | CRIAR | Contrato de saída XML completo + 2 exemplos Bons + 2 Ruins (BOM 1 rota B 6/6; BOM 2 rota A 2 bloqueios ordenados por impacto; RUIM 1 persona sem critério; RUIM 2 14 constraints + CoT explícito). Cada exemplo com uma linha `Por que falha` / `Por que funciona`. Nenhum exemplo >10 constraints. | V5 |
| PO-05 | `.agents/agents/orchestrator/AGENT.md` seção **3.0** | MODIFICAR | Descreve v2 (6 elementos, 2 rotas, score 6/6) e aponta para o template de perguntas. Zero resíduo de tier. Resto do arquivo (580 linhas) intocado. | V3 |
| PO-06 | `.agents/rules/workflow-rules.md` seção **0** | MODIFICAR | Idem PO-05 + apontar para o novo template de perguntas. Seções 0.1+ intocadas. | V3 |
| PO-07 | `.agents/rules/harness-continuous.md` | MODIFICAR | 1 linha citando `prompt-optimizer` (seção de skills ou índice). Toque mínimo. | V4 |
| PO-08 | `workflow-state.json` | CRIAR | JSON válido parseável. `current_feature: refactor-prompt-optimizer`, `type: refactor`, artifacts apontando SPEC/TASKS, `code_review.last_status: pending`, `overrides: []`. | V6 |

## Roteiro de Execução

Ordem de aplicação. Cada passo é cirúrgico no arquivo indicado — nada além do trecho citado é tocado.

1. **PO-01** — materializa a SPEC aprovada. Sem ela não há critério de aceite para o resto. Cria `.spec/refactor-prompt-optimizer/`.
2. **PO-08** — cria `workflow-state.json`. Antes de qualquer edição de call site, o estado central passa a existir e a apontar para os artefatos (D3 não cobre este arquivo, mas o gate de workflow-rules §1 exige estado).
3. **PO-02** — reescreve a skill. É a fonte normativa; os call sites (PO-05/06/07) só descrevem o que a skill define. Fazer antes evita escrever 2 vezes.
4. **PO-04** — cria o template de saída. Depende do contrato definido em PO-02; materializa os exemplos worked que mitigam R2 (consistência de score).
5. **PO-03** — reescreve as perguntas por elemento. Fecha a referência da Rota A e a rota de conflito (F7).
6. **PO-05** — sincroniza `orchestrator/AGENT.md` §3.0. Único call site com fluxo de gate detalhado.
7. **PO-06** — sincroniza `workflow-rules.md` §0.
8. **PO-07** — 1 linha de citação em `harness-continuous.md`. Fecha F8 (regra órfã).
9. **PO-01..PO-08** → `brain_store` do registro de que a v2 substitui a v1 e do contrato dos 6 elementos.

Ordem de escrita dentro de PO-05/PO-06: ler trecho → substituir apenas o bloco da seção → reler seções vizinhas para confirmar que nada ao redor mudou.

## Checklist Pré-Conclusão

| Verificação | Como verificar | Task | Status |
|-------------|----------------|------|--------|
| **V1** Prompt vago real → Rota A, ≤3 perguntas, ZERO artefato | Dogfood: "melhorar o sistema" contra a skill carregada. Nenhum arquivo criado. | PO-02, PO-03 | ☐ |
| **V2** Prompt claro real → Rota B, bloco PICCO válido, 1 confirmação, depois avança | Dogfood: "Adicionar validação de email no endpoint POST /internal/registrations do módulo company" | PO-02, PO-04 | ☐ |
| **V3** Zero resíduo de tier nos 4 call sites | `grep -c "Tier 1\|Tier 2\|Tier 3"` nos 4 arquivos de call site = 0 | PO-05, PO-06, PO-02 | ☐ |
| **V4** `prompt-optimizer` citado em `harness-continuous.md` | `grep -c "prompt-optimizer" .agents/rules/harness-continuous.md` >= 1 | PO-07 | ☐ |
| **V5** Contagem de constraints em todos os exemplos <= 10 | Contar linhas de constraint em cada exemplo do `picco-template.md` e no bloco do SKILL.md | PO-04, PO-02 | ☐ |
| **V6** `workflow-state.json` é JSON válido, `type: refactor` | `python3 -c "import json;json.load(open('workflow-state.json'))"` + leitura de `.type` | PO-08 | ☐ |
| **H5.2** `brain_store` de lições da fase executado | Brain note de `refactor-prompt-optimizer` registrada (paths citados no retorno) | PO-01..PO-08 | ☐ |

### Critérios de aceite do batch

- [ ] 7 arquivos existem, conteúdo fiel à SPEC
- [ ] Nenhum resíduo de tier nos 4 call sites → V3
- [ ] `prompt-optimizer` citado em `harness-continuous.md` → V4
- [ ] Nenhum exemplo com >10 constraints → V5
- [ ] `workflow-state.json` é JSON válido parseável
- [ ] `orchestrator/AGENT.md` e `workflow-rules.md`: só a seção citada alterada, resto intacto
- [ ] Nenhum "pense passo a passo" / CoT manual em nenhum arquivo
- [ ] Nenhuma persona genérica sem critério anexado
