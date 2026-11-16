# VERIFY — prd-agnostic-artifacts-adr-004

> Verificação de 3 dimensões sobre o ciclo que executa o **ADR-004 do PRD-2** (referências + `DESIGN.md`).
> Data: 2026-11-16. Branch: `adr/prd-agnostic-artifacts/04-referencias-e-design-md`. HEAD: `b760df5` (+ ADR §12).

## Veredito: **3/3 PASS**

| Dimensão | Resultado | Base |
|---|---|---|
| Completude | ✅ PASS | 10/10 microtasks; 5 artefatos; 1 exceção pinada com dono (EP-03) |
| Corretude | ✅ PASS | 1.099 testes (540 plugins + 559 installer) 0 falhas; 12/12 itens; REPORT schema-válido |
| Coerência | ✅ PASS | `gate.js`/`harness.config.json`/`seal.mjs`/`lib/cdl/**` byte-idênticos; selo `c904f1c5` intacto |

## 1. Completude

- `TASKS.md`: 10/10 marcadas.
- **Exceção EP-03 declarada**: 1 citação de `backend-coding-standards.md` permanece em `dev-planner/SKILL.md:204` — linha **pinada byte-a-byte** no `BASELINE` do `lib/cdl/checks.mjs` (módulo fora de escopo). Linha intacta + entrada C2 com `owner: PRD-4` e condição de reativação. O reviewer provou por dupla mutação: mudar a linha ⇒ `cdl-baseline-stale`; remover a entrada ⇒ `missing-and-unclassified`. **Rubric não burlada** — dívida visível com dono.

## 2. Corretude

| Bloco | Evidência |
|---|---|
| Rubric | 7 classes RC0–RC6, 4 ações, 12 predicados; precedência fixa RC1 antes de RC2 |
| SSoT | `grep -rn "rules/security-standard\.md" .agents` ⇒ **0**; `grep -rIn "security-standard\.md" .agents` ⇒ **0** (7 prefixadas + 4 nuas); `DEVE seguir ... skill security-review` vivo em `security-engineer/AGENT.md:26` |
| Java | 5 paths RC2 removidos com dívida **PRD-4** + condição de reativação escrita em 4 lugares verificáveis |
| `DESIGN.md` | `grep -rn "DESIGN\.md" .agents/agents` ⇒ **0** (11 linhas/3 agentes); dono do arquivo = **PRD-5** |
| `.doc/**` | 9 linhas classificadas com dono **ADR-005** — `refs-undetected=9`, não 0 (0 esconderia dívida viva) |
| N30 | detector de link-ref em `lib/refs/checks.mjs` + fixture: `[//]: # (security-review)` ⇒ `link-ref-citation-form` FAIL; `V19 consumer=21` inalterado |
| Oráculos | `V18 baseline 7→1` (meta ≤1), `non-defect=1`; `V20 refs-undetected 20→9`; `V20 population=223/30372` |

**Suíte:** plugins 540/0 · refs 35/35 · installer 559/0 · static exit 0 · sdd 0 FAIL · vendor OK.

## 3. Coerência

- **SSoT não removida**: trocou-se o ponteiro de um arquivo inexistente por uma skill viva que viaja no payload (`security-review`, OWASP/ASVS/MASVS inline). O `DEVE seguir` do agente de segurança continua tendo referente.
- **Dívida não apagada**: 7→1 no `V18` (a 1 é a linha pinada, com dono PRD-4) e 20→9 no `V20` (as 9 com dono ADR-005). Nenhum número zerado artificialmente.
- **Predicado corrigido no ADR, não no código** (§12-N7): o `grep` congelado no item 2 falhava também no pai — era case-sensitive e não via os `**` do texto real.
- **Selo intacto**: nenhum `record(...)` novo, `commands.suiteFull` byte-idêntico.

## 4. Traceability

| RF | Task | Onde |
|---|---|---|
| RF-01, RF-03 | EP-01, EP-02 | `security-review/SKILL.md`, `security-engineer/AGENT.md:26`, `workflow-rules.md:602` |
| RF-02 | EP-03 | refs BASELINE C2 (`owner: PRD-4`), `workflow-rules.md:591` |
| RF-04 | EP-04 | `dev-planner/anti-patterns.md:456`, `dev-planner/SKILL.md:206` |
| RF-05, RF-06 | EP-05, EP-06 | 3 agentes, `workflow-rules.md:590`, ADR §4.3 |
| RF-07 | EP-06 | `harness-installer/SKILL.md:68`, `NON_DEFECT` |
| RF-08 | EP-07 | `lib/refs/checks.mjs` + `refs.spec.mjs` |
| RF-09, RF-10 | EP-08..EP-10 | `V18`/`V20`, suíte, selo |

**Cobertura: 10/10 RF · 12/12 itens · traceability 100%.**

## 5. Resíduos registrados

| # | Item | Dono |
|---|---|---|
| EP-03 | 1 citação pinada em `dev-planner/SKILL.md:204` | PRD-4 |
| — | 9 linhas de `.doc/**` com dono | ADR-005 |
| — | 5 ocorrências nuas fora da gramática do `V18` | ADR-005 |
| — | conteúdo do `DESIGN.md` | PRD-5 |

## 6. Conclusão

As 3 dimensões fecham. A SSoT de segurança deixou de apontar para um arquivo que não existe e agora aponta para uma skill viva; as dívidas Java e de design system têm dono e condição de reativação; o detector N30 cobre a forma latente sem mexer em `consumer`. **Apto ao P5→P6.**
