# VERIFY — harness-inventory-adr-002

> Verificação de 3 dimensões sobre o ciclo que executa o **ADR-002 do PRD-1**.
> Data: 2026-11-11. Branch: `adr/prd-harness-inventory/02-prd-adr-pipeline-modulo`. HEAD: `735245a`.

## Veredito: **3/3 PASS**

| Dimensão | Resultado | Base |
|---|---|---|
| Completude | ✅ PASS | 10/10 microtasks marcadas; 0 aberto; 5 artefatos; 0 TODO |
| Corretude | ✅ PASS | 938 testes 0 falhas; 12/12 RF; REPORT schema-válido |
| Coerência | ✅ PASS | 12/12 itens do ADR; `gate.js`/`config.mjs`/`seal.mjs`/`harness.config.json` com 0 linhas; selo `c904f1c5` inalterado |

## 1. Completude

- `TASKS.md`: **10/10** marcadas, 0 `[ ]`.
- Artefatos: `PROPOSAL.md` (40 l.), `SPEC.md` (48 l.), `PLAN.md` (50 l.), `TASKS.md` (50 l.), `VERIFY.md`.
- `grep -ric 'TODO|TBD|FIXME'` na pasta: 0.

## 2. Corretude

| Requisito | Evidência |
|---|---|
| RF-01 — propagação | **12/12 presets** de `STACK_PROFILES`: 5 arquivos no path novo, 0 no antigo, `__tests__` = 0; instalação real em `/tmp` exit 0. Contraprova: a mesma `collectIncoming` em `ac80e49` devolve `novo=0 velho=5` ⇒ teste não-vácuo |
| RF-02 — `skills/` uniforme | 48 dirs, **48** com `SKILL.md`, **0** sem; path antigo ausente |
| RF-03 — imports | 2 reapontados; `grep -rn "skills/prd-adr-pipeline" --include=*.mjs` = 0 |
| RF-04/05 — templates e guarda | 4 paths derivam de `LIB`; guarda relê o módulo no path novo (mutação `C2` provou que lê o **conteúdo** do path, não um default) |
| RF-06 — prosa expirada | `"only path the installer propagates"` = 0 em `checks.mjs` e `static-checks.mjs` |
| RF-07 — `SKILLS_COMMON` | **23→22** medido (ADR previa 24→23; N11); `realLocalSkills()` 24→23; `unclassified=[]`, `phantoms=[]` |
| RF-08 — rule preservada | `grep -c "prd-adr-pipeline" installer/install.mjs` = **1** (`:384`); `numstat` = 0 inserções / 1 remoção |
| RF-09/10 — prosa | 1 agente reapontado; 2 rules com path novo, 79 l. (≤80), total 1290 (≤1705); trailer presente |
| RF-11 — runtime | `git diff` de `gate.js`/`lib/config.mjs`/`lib/seal.mjs`/`harness.config.json` **vazio**; selo `c904f1c5` ok |
| RF-12 — suíte | plugins 379/0 · installer 559/0 · static exit 0 · sdd 0 FAIL · vendor OK |

## 3. Coerência

- **12/12 itens** do ADR com prova de comando.
- **Movimento legítimo**: `R099` (`checks.mjs`, difere só nas 2 linhas de prosa autorizadas) + `R100` ×4 templates; `D` = **0**; **um** único `checks.mjs` no disco.
- **Nenhum número inventado**: dois números do ADR estavam errados (24→23 e "3 testes") e foram **corrigidos no contrato** com nota (N11/N12), não mascarados — e nenhuma entrada fantasma foi criada na enumeração para "fazer a conta fechar".
- **Supersessão registrada**: `.spec/prd/prd-adr-pipeline/ADRs/ADR-002-checks-path-propagavel/ADR.md` recebeu nota `SUPERSEDED` — a decisão anterior era correta no mérito (path propagável) e está superada no path.
- **Sem vazamento de camada**: o destino continua decidido só por `collectIncoming` (I5); nenhum caminho novo entra no destino por fora.

## 4. Traceability (RF → task → arquivo)

| RF | Task | Onde |
|---|---|---|
| RF-01, RF-02 | PA-01, PA-02 | `.opencode/plugins/lib/prd-adr-pipeline/{checks.mjs,templates/*}` |
| RF-03, RF-04, RF-05 | PA-03, PA-04 | `scripts/static-checks.mjs:29`, `prd-checks.spec.mjs:29,1127-1131,915-925` |
| RF-06 | PA-05 | `checks.mjs:14-16`, `static-checks.mjs:24-29` |
| RF-07, RF-08 | PA-06 | `installer/install.mjs:407` (COMMON), `:384` (RULES) |
| RF-09, RF-10 | PA-07, PA-08 | `orchestrator/AGENT.md:273`, 2 rules |
| RF-01 (prova) | PA-09 | `harness/harness-inventory-adr-002.json` |
| RF-11, RF-12 | PA-10 | suíte + diff dos protegidos |

**Cobertura: 12/12 · Traceability 100%.**

## 5. Resíduos declarados

| # | Item | Dono |
|---|---|---|
| — | `docs/FUNCIONAMENTO.md:110` cita `checks.mjs:417-495`; `runPrdChecks` vai até `:504` (pré-existente, cosmético) | follow-up de prosa |
| FU-63 | `prd-adr-pipeline.md` §1 × `ADR-01` (índice exige disco) — regra ainda ambígua | PRD-2 |
| — | `config-dual-parity.spec.mjs:150` assere 4 de 5 `deny` (herdado do ADR-001) | follow-up de teste |
| — | Mutação ao vivo de `checks.mjs` foi negada pelo gate (`protected-path-write`) — limite declarado, sem evasão | — |

## 6. Conclusão

As 3 dimensões fecham; o empacotamento está íntegro e o repo-destino **não** perdeu o módulo (12/12 presets). **Apto ao portão P5→P6** (merge humano).
