# SPEC Review — harness-eixos-stack

> **Skill**: `spec-review` · **Data**: 2026-10-18 · **Revisor**: orchestrator (self-review estruturado)
> **Alvo**: `.spec/backend/harness-eixos-stack/SPEC.md` (v1 → **v2** após correções desta rodada)
> **Tipo**: infraestrutura/tooling (instalador Node ESM) — **não** é spec backend Java nem frontend Vue

## 0. Nota de aplicabilidade da skill

`spec-review` é escrita para **TaskFlow** (Spring Boot 3.5 + Vue 3 + Vuetify). Este ciclo não tem backend Java/Maven, nem frontend Vue/Vite, nem Flyway, nem multi-tenancy (`harness.config.json:5-6`). Por isso: os blocos **DDD Modular, Flyway, `@HasPermission`/JWT, Vuetify/Pinia, cobertura 80/90** foram marcados **N/A com justificativa no SPEC §8** (aplicação honesta do `spec-gate`), em vez de "conforme" silencioso. Os critérios **aplicáveis** — estrutura, escopo, critérios de aceite verificáveis, riscos, tratamento de erro, estratégia de teste, rastreabilidade — foram aplicados integralmente.

**Observação com dono (fora deste ciclo, não bloqueia)**: a skill `spec-review` e o `.agents/rules/frontend-coding-standards.md` deste repo descrevem stacks de **outros** projetos (TaskFlow/Vuetify e Atlas ECM/shadcn). Em um repo de tooling isso produz `N/A` em massa. Registrar como tech-debt de governança (skill/rules stack-bound) — **não** corrigido aqui (fora do escopo).

## 1. Scorecard de conformidade

| Categoria | Itens aplicáveis | Conforme | Atenção | Não conforme | N/A |
|---|---|---|---|---|---|
| Estrutura (título, escopo, camada, deps, riscos) | 5 | 5 | 0 | 0 | 0 |
| Requisitos (aceite verificável, erros, edge cases) | 6 | 6 | 0 | 0 | 0 |
| Arquitetura (ADR, invariantes, interfaces) | 4 | 4 | 0 | 0 | 0 |
| Segurança | 1 (supply chain) | 1 | 0 | 0 | 0 |
| Testes (estratégia + rastreabilidade) | 3 | 3 | 0 | 0 | 0 |
| Stack-específico (DDD/Flyway/Vue/JWT) | 6 | 0 | 0 | 0 | 6 |
| **Total aplicável** | **19** | **19** | **0** | **0** | **6** |

**Score de conformidade (aplicáveis): 19/19 = 100%** após as correções da §2.

## 2. Gaps encontrados NESTA rodada e correção aplicada

| # | Sev | Gap | Correção aplicada no SPEC |
|---|---|---|---|
| G1 | **Alta** | **RF-04 sem mecanismo**: exigia filtrar `.agents/rules/**` por eixo, mas rules **não têm lock de vendor** — a SPEC dizia o *quê* e não o *como* (gate órfão, `.agents/rules/gate-contract.md` §1) | RF-04 ganhou mecanismo nomeado: mapa declarado `RULES_BY_AXIS` no `installer/install.mjs`, com semântica "não citado = comum" e **proibição explícita** de inferir por nome + teste que falha se voltar a olhar nome |
| G2 | **Alta** | **RF-13 ausente**: o vendor é source-side e exige os repositórios upstream **clonados localmente** (rede **fora** do instalador) e o `--source-license` por fonte. Sem declarar isso, o ciclo prometia vendor sem pré-requisito de ambiente | RF-13 criado, com aceite de que o `--check` roda **sem rede** com o lock commitado e o pré-requisito é passo de build do repo |
| G3 | **Alta** | **RF-07 ambíguo**: o aceite aceitava "comando que resolve **ou** `''` declaradamente" — critério não binário, impossível de testar | RF-07 virou decisão binária: lista de candidatos do eixo react, primeiro candidato quando nada resolve (paridade com flutter/dart), + assert explícito do comportamento do par Vue |
| G4 | Média | **RF-03 sem mecanismo de origem**: dizia "derivar da origem declarada" sem nomear **onde** a origem é declarada | RF-03 ganhou o mecanismo: `stacks` explícito no source-lock de entrada; `inferStacks` rebaixado a **fallback**; skill nova sem declaração = comum (declarado como consequência) |
| G5 | Média | **RF-09 sem formato**: "opcional legível por máquina (campo **ou** lista)" — duas formas possíveis | RF-09 fixou `optional: true` na entrada do lock, com aceite de ausência para a outra skill |
| G6 | Média | **Política de edição de teste ausente**: a mudança toca testes que enumeram o registry (`golden.spec.mjs:64-69`) e o menu (`wizard.spec.mjs:432`). Sem regra, "golden intacto" vira ambiguidade | Invariante **I9** criada: teste só pode ser editado para escopar asserção estrutural ou somar caso novo; **nenhum** assert de valor congelado muda |
| G7 | Média | **Invariante do ciclo anterior não declarado**: `node-esm` precisa continuar alcançável **sem** item de menu (`wizard.spec.mjs:484-487`); a mudança de menu poderia quebrá-lo em silêncio | Invariante **I10** criada, ancorada no assert existente (não editado) |
| G8 | Baixa | Rastreabilidade não tinha linha para o requisito novo | Tabela §10 atualizada (RF-13) |

## 3. Pontos fortes da SPEC

- Toda afirmação de garantia tem **nível explícito** (🟢/🟠/🟡/🔴) e mecanismo citado — evita promessa de runtime que não existe.
- **E2E declarado honestamente**: este repo não tem browser; o H3 é substituído por dry-run real + verificação de 0 writes, **sem** alegar H3 cumprido.
- Interfaces congeladas listadas **com arquivo:linha** (§5), inclusive a decisão de **não** mexer no schema do `--answers-file` (RF-12).
- Modos de falha (§6) cobrem o caminho de erro do wizard e do vendor, não só o caminho felizes.
- Limitações declaradas em vez de escondidas: V15 **não** cobre `.agents/skills/**`; `declared-evidence` é 🟡 processo.

## 4. Riscos residuais que o PLAN/TASKS devem materializar

1. **G1/I9 são a fronteira do golden**: `axes` é aditivo ao registry, mas se algum teste existente `deepEqual` o **objeto** do perfil (não a saída gerada), ele precisará de edição **estrutural** — I9 autoriza, e T2 precisa provar que os valores congelados seguem iguais.
2. **Duplicação N×M persiste por decisão** (ADR-001): o PLAN deve tornar visível quantas entradas foram tocadas, para que a migração do ADR-005 saiba o custo real.
3. **Vendor exige ambiente** (G2): se os clones upstream não estiverem disponíveis no momento da implementação, a task de vendor fica **bloqueada** — e as tasks de gating (RF-03) dependem dela para ter fixture real.

## 5. Veredito

- **Bloqueadores 🔴**: **0**
- **Alta prioridade 🟠**: **3** — todos **corrigidos** nesta rodada (G1, G2, G3)
- **Média 🟡**: **4** — todos corrigidos (G4..G7)
- **Baixa 🟢**: 1 corrigido (G8)
- **Veredito**: `pass` — SPEC v2 pronta para o portão **P1→P2**
