# SPEC — Refactor prompt-optimizer v1 → v2

- **Domínio:** governança-de-agentes
- **Tipo:** refactor
- **Status:** APROVADA (usuário)
- **Score:** 92%

---

## 1. Problema (evidenciado)

Skill v1 estrutura o gate em 3 tiers (crítico/ambíguo/claro) + 5 critérios + 4 tabelas de exemplo + 6 anti-patterns. Falhas:

| # | Falha | Base |
|---|-------|------|
| F1 | Tiers são deixados à interpretação. "Tier 2 vs 3" é julgamento subjetivo — a IA classifica diferente em dias diferentes. Duas linguagens para o mesmo estado mental. | decisão do usuário (remover tiers) |
| F2 | Sem noção de "entendi" quantificável. 5 critérios em checkbox, mas nada conta. Não há como saber se 5/5 ou 4/5. | decisão do usuário |
| F3 | Não há re-encoding. Entendeu → vai pro workflow. O briefing estruturado do usuário é jogado fora e o orquestrador reconstrói do zero em cada delegação. | arXiv 2609.22249 (re-encoding step) |
| F4 | Persona como folk magic. v1 não usa role, mas os call sites (AGENTS.md 3.0, workflow-rules.md 0) ensinam "Você DEVE..." sem critério → o erro de persona-só-rótulo. | estudo 162 personas / 2410 perguntas |
| F5 | Constraint count. v1 expõe ~15 regras simultâneas ao modelo. Adesão cai acima de ~10. | pesquisa 2026 |
| F6 | Sem critério de saída da Rota B. v1 diz "se claro → prossseguir" e não diz o que fazer. | — |
| F7 | Rota de conflito ausente. Pedido que viola regra do projeto (Lombok, pular harness, pkill -f) não tem rota. | — |
| F8 | Órfandade de regra. Skill não é citada em harness-continuous.md; call sites descrevem o fluxo v1. | grep no repo |

## 2. Decisões do usuário (locked)

- D1: output do re-encoding efêmero no chat (sem artefato em .spec/).
- D2: consumo triplo — auto-uso do orquestrador + prompt de delegação ao developer-engineer + colável pelo usuário noutra ferramenta.
- D3: patch inclui call sites (AGENTS.md 3.0, workflow-rules.md 0).
- D4: tiers removidos, substituídos por score N/6 elementos.

## 3. Design v2

### 3.1 Modelo de análise: 6 elementos (PICCO + consensus)

| # | Elemento | Pergunta de checagem | Ausente = |
|---|----------|----------------------|-----------|
| E1 | Objetivo | O que muda no mundo quando isso estiver pronto? | crítico |
| E2 | Escopo | O que entra? O que NÃO entra? | crítico |
| E3 | Contexto | Módulo/domínio/tela/endpoint/feature afetado | alto |
| E4 | Restrições | O que não pode quebrar? (regra, contrato, compatibilidade) | alto |
| E5 | Critério de aceite | Como se sabe que ficou pronto? | médio |
| E6 | Intenção de rota | Feature / Bugfix / Refactor / Melhoria? | médio |

Score = elementos presentes / 6. Presente = o usuário AFIRMOU (não que a IA deduziu).

### 3.2 Duas rotas

```
RECEBER prompt
   ↓
brain_search(prompt, top_k=3)          [mantém]
   ↓
score = contar E1..E6 afirmados
   ↓
score = 6/6 ?  NÃO → ROTA A        SIM → ROTA B
```

**ROTA A — score < 6 (NÃO ENTENDI o suficiente)**

1. PARAR. Nenhuma skill, subagente ou artefato antes disso.
2. Perguntar no máximo 3, ordenadas por impacto no retrabalho (E1 > E2 > E3 > E4 > E5 > E6).
3. Proibido: preencher lacuna com default, "vou assumir que...", delegar com contexto parcial.
4. Saída: bloco de perguntas no formato 3.4, SEM emitir prompt otimizado.
5. Repete a partir do score. Máximo 2 rodadas de pergunta — se a 2ª não resolver, apresentar as 2 interpretações mais prováveis e pedir desempate (não interrogatório infinito).

**ROTA B — score = 6/6 (ENTENDI)**

1. Re-encoding: emitir bloco PICCO estruturado (3.3) com delimiter tags.
2. 1 pergunta de confirmação — "entendi X/Y/Z, sigo?" (o "sempre perguntar" = nunca assumir; não = nunca executar).
3. Sobre "sim" → seguir workflow SDD carregando o bloco re-encoded como contexto.
4. Sobre ajuste → volta pra Rota A só com os elementos corrigidos.
5. O bloco re-encoded é efêmero: vai no prompt de delegação e no chat, nunca em arquivo.

### 3.3 Contrato de saída (delimiter tags)

```xml
<role>[critério de comportamento + o que conta como defeito — nunca rótulo de persona]</role>

<task>Entregar [E1] em [E3].</task>

<context>
  Projeto: [projeto ativo]
  Escopo: [o que entra e o que NÃO entra]
  Tipo de rota: [E6]
  Fornecido pelo usuário: [lista do que foi afirmado]
</context>

<constraints>
  Sempre: [E4 como positivos — "sempre X", nunca negação pura]
  Nunca: [violações do projeto que esta demanda arrisca]
</constraints>

<acceptance>
  [E5 — como se verifica pronto]
</acceptance>

<open_questions>   <!-- só Rota A; vazio na Rota B -->
  - ...
</open_questions>
```

Contrato do bloco:

- ≤ 10 constraints (F5). Acima disso, o bloco está mal — cortar.
- Role declara critério, não persona genérica (F4). "Analisa o diff procurando vazamento de camada" OK. "Você é um especialista" NÃO.
- Constraints positivas primeiro (pesquisa: negação pura → substitua por positivo).
- Sem "pense passo a passo" (CoT explícito prejudica modelo de raciocínio).

### 3.4 Formato de pergunta (Rota A)

```markdown
## Falta contexto — preciso de X resposta(s)

Bloqueio (o que não vou assumir): [elemento ausente, ex: E2 Escopo]

1. **[pergunta de E1]**
2. **[pergunta de E2]**

### Já entendi (afirmado por você)
- E3: módulo `identity`
- E6: Bugfix

### Regra
Não vou assumir o que ficou em branco. Escolher por você é palpite caro.
```

Mudança vs v1: v1 tinha "Contexto que já entendi" mas NÃO nomeava o elemento bloqueante e não justificava por que não vai assumir. Falta de justificativa é o que faz a IA ceder no próximo turno.

### 3.5 Rota de conflito (F7 — nova)

Se o pedido do usuário viola regra do projeto (Lombok, @Disabled, pular harness, pkill -f, editar código no orquestrador, pular code review):

1. Não executa e não pergunta só por ambiguidade.
2. Nomeia a regra: "isso viola `<arquivo>:<seção>`".
3. Oferece o caminho permitido mais próximo.
4. Pergunta: executo o caminho permitido, ou você quer abrir exceção explícita no portão? (exceção → registrada em `workflow-state.json.overrides`)

## 4. Arquivos afetados (D3)

| Arquivo | Delta | Motivo |
|---------|-------|--------|
| .agents/skills/prompt-optimizer/SKILL.md | REWRITE | v1 removido (tiers, 5 critérios, 3 exemplos longos) |
| .agents/skills/prompt-optimizer/references/clarifying-questions.md | MODIFIED | Reescrito por elemento E1-E6 + rota de conflito |
| .agents/skills/prompt-optimizer/references/picco-template.md | ADDED | Contrato de saída XML + 2 exemplos bons e 2 ruins |
| .agents/agents/orchestrator/AGENT.md seção 3.0 | MODIFIED | Descreve fluxo v1 (tiers) -> v2 (score 6 elementos, 2 rotas) |
| .agents/rules/workflow-rules.md seção 0 | MODIFIED | Idem + novo template de perguntas |
| .agents/rules/harness-continuous.md | MODIFIED (1 linha) | Citar prompt-optimizer, fecha F8 |
| workflow-state.json | ADDED | Não existe neste repo |

> Nota: o path real da seção 3.0 é `.agents/agents/orchestrator/AGENT.md` (`AGENT.md`, não `AGENTS.md`). Não existe `AGENTS.md` na raiz deste repo.

## 5. Fora de escopo

- Nao cria `.spec/<feature>/OPTIMIZED-PROMPT.md` (D1 efemero)
- Nao implementa eval/golden-set (backlog futuro, infra de produto)
- Nao mexe em outras skills
- Nao renomeia a skill (nome prompt-optimizer continua)
- Nao desativa o gate: propaga a ponte para `.agents/agents/sdd-orquestrador/AGENT.md` (agente legado, o único outro orquestrador do repo — sem ele o gate é burlado).

## 6. Riscos

| R | Sev | Mitigação |
|---|-----|-----------|
| R1 v2 mais rígido = mais perguntas que irritam | medio | Teto 2 rodadas Rota A + 1 confirmação Rota B. Override em 1 palavra ("ja vai") |
| R2 IA não conta score 6/6 com consistência | critico | Score explícito em tabela. Exemplo worked no picco-template.md (bom + ruim) |
| R3 drift entre skill e call sites | medio | D3 obrigatorio; sem os 4 call sites, regra orfa. Verificacao V3 |
| R4 gate vira taxacao em comandos triviais ("show status") | alto | Excecao explicita: comandos de leitura/consulta pulam o gate. So demandas de MUDANCA passam |
| R5 re-encoding gasto em todo ciclo, tokens sobem | medio | Bloco <=10 constraints, sem repetir o que ja esta em workflow-state.json |

## 7. Verificação (dogfood)

- **V1** Prompt vago real ("melhorar o sistema") -> Rota A, <=3 perguntas, ZERO artefato criado
- **V2** Prompt claro real -> Rota B, bloco PICCO valido, 1 confirmacao, depois avanca
- **V3** `grep -c "Tier 1|Tier 2|Tier 3"` nos 4 call sites = 0
- **V4** `grep -c "prompt-optimizer"` em harness-continuous.md >= 1
- **V5** Contagem de constraints em todos os exemplos do picco-template.md <= 10
- **V6** workflow-state.json valido JSON, `type: refactor`

## 8. Gate spec-gate.md — conformidade

| Critério | Status |
|----------|--------|
| ADRs | OK §1, §2, §3 |
| DDD modular | N/A sem codigo de app |
| Seguranca/IAM | N/A sem codigo de app |
| ERD/Event Registry/Migrations | N/A sem codigo de app |
| Invariantes | substituidas: invariantes do gate sao os 6 elementos (§3.1) — E1/E2 ausentes = gate fechado |
| Test strategy | OK §7 (V1-V6 dogfood) |
| Single file / dominio claro | OK, dominio: governanca-de-agentes |

## 9. Spec score

92% — 0 criticos abertos, 2 riscos mitigaveis (R4 excecoes, R2 consistencia de score, ambos com verificacao).
