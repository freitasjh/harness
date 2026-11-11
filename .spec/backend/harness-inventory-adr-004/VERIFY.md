# VERIFY — harness-inventory-adr-004

> Verificação de 3 dimensões sobre o ciclo que executa o **ADR-004 do PRD-1** — o último ADR do PRD.
> Data: 2026-11-11. Branch: `adr/prd-harness-inventory/04-inventario-canonico`. HEAD: `0f59ab0`.

## Veredito: **3/3 PASS**

| Dimensão | Resultado | Base |
|---|---|---|
| Completude | ✅ PASS | 10/10 microtasks; 5 artefatos; 2 residuais declarados com dono (N30) |
| Corretude | ✅ PASS | 1.027 testes (468 plugins + 559 installer) 0 falhas; 14/14 itens; REPORT schema-válido |
| Coerência | ✅ PASS | `gate.js`/`harness.config.json`/`installer/`/`lib/**` com 0 linhas; selo `b698703d` idêntico a `cb0f08d` |

## 1. Completude

- `TASKS.md`: 10/10 marcadas.
- Artefatos: PROPOSAL (43), SPEC (47), PLAN (43), TASKS (127), VERIFY.
- **Declarado como residual, não como entrega**: link-ref markdown comprando `consumer` (dono PRD-2), skill em symlink (dono PRD-3).

## 2. Corretude

| Bloco | Evidência |
|---|---|
| `V19` derivado | `PASS V19: skills=48 (vendor-by-axis=25, consumer=22, axis=0, orphan=1), rules=8 (consumer=7, axis=1, orphan=0), agents=10/10 (registered=10, orphan=0), vendorCited=0, lockPresent=true, owner-decisions=1, pendingRemoval=0` |
| 10 ids provados | órfã nova · ambiguidade de classe · `attendance-drift` · lock↔disco · prompt não resolvido · decisão incompleta · decisão obsoleta · lock ilegível · declaração fantasma · diretório sem `SKILL.md` |
| Classe sem heurística | `grep -c "startsWith\|inferStacks"` = 0; classe só do `.vendor-lock.json` |
| Supressão expira | `expiresWhen ⊇ EXPIRY_CONDITIONS[class]`; 4 condições executadas; proof com lastro fora do sujeito e normalizado contra o root; `.spec/**` proibido como prova |
| Agente por registro | 10 chaves ↔ 10 `prompt` resolvidos vs 9 `AGENT.md` (o `code-reviewer` usa `PROMPT.md`) |
| Zero comando novo | `commands.suiteFull` e `seal.mjs` byte-idênticos ⇒ selo não republicado |

**Suíte:** plugins 468/0 · installer 559/0 · static exit 0 · sdd 0 FAIL · vendor OK.

**Mutações que derrubam (5, em cópia fora do repo):** órfã nova · lock como diretório · proof com alias `..` · comentário HTML não fechado · diretório sem `SKILL.md`.

## 3. Coerência

- **Inventário não virou SSoT**: `SKILLS_COMMON`/`RULES_COMMON` continuam donos da propagação e **não** conferem classe — sem isso "pôr no COMMON" compraria isenção sem dono.
- **`V18` e `V19` ortogonais**: um fala de *referência* órfã, o outro de *artefato* sem classe; ambos verdes, nenhum substitui o outro.
- **O contrato foi corrigido onde mentia**: 3 notas (N20, N28, N29) registraram que o ADR descrevia algo que o código não fazia — o item 9 dizia `vendor ∧ consumer` (resolvido por D3), o item 6 dizia "5 campos" enumerando 6, e os ids eram 10 com a tabela publicando 7.
- **Nada de fachada**: cada id tem fixture com par PASS/FAIL de **um arquivo de diferença**.

## 4. Traceability

| RF | Task | Onde |
|---|---|---|
| RF-01, RF-03, RF-09–RF-11 | PI-01..PI-04 | `lib/inventory/checks.mjs` |
| RF-05–RF-08 | PI-05..PI-07 | `OWNER_DECISIONS`, modos de decisão, ambiguidade |
| RF-02, RF-04 | PI-08 | `scripts/static-checks.mjs` (`V19` + counters) |
| RF-12 | PI-09 | `__tests__/inventory.spec.mjs` (56 testes) |

**Cobertura: 12/12 RF · 14/14 itens · traceability 100%.**

## 5. Divergências declaradas pelo QA

| # | Fato |
|---|---|
| d1 | ids 7→10 — corrigido no ADR (N29) |
| d2 | `TASKS.md` publicava 445 testes/7 ids — nota de atualização acrescentada |
| d3 | item 14 literal reproduz em `a789003` (batch do ADR), não no batch de implementação |
| d4 | `workflow-state.json` é corrigido no fechamento do ciclo (dono: orquestrador) |
| d5 | "10 ids em `ALL_IDS`": o símbolo não existe; 10 ids únicos medidos |

## 6. Conclusão

As 3 dimensões fecham. O PRD-1 termina com o inventário **derivado e com prazo de validade** — a contagem que já errou 4 vezes em menos de um dia agora é verificável por comando, e a decisão de exceção expira sozinha. **Apto ao P5→P6.**
