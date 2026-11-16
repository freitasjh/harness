# VERIFY — prd-agnostic-artifacts-adr-003

> Verificação de 3 dimensões sobre o ciclo que executa o **ADR-003 do PRD-2** (skills comuns + `spec-review`).
> Data: 2026-11-12. Branch: `adr/prd-agnostic-artifacts/03-skills-comuns-e-spec-review`. HEAD: `50fcf41` + `8eda209`.

## Veredito: **3/3 PASS**

| Dimensão | Resultado | Base |
|---|---|---|
| Completude | ✅ PASS | 10/10 microtasks; 5 artefatos; 5 desvios + 5 residuais declarados |
| Corretude | ✅ PASS | 1.097 testes (538 + 559) 0 falhas; 12/12 itens; REPORT schema-válido |
| Coerência | ✅ PASS | `gate.js`/`harness.config.json`/`installer/` com diff mínimo (1 linha autorizada); selo `c904f1c5` intacto |

## 1. Completude

- `TASKS.md`: 10/10 marcadas.
- **Desvios declarados**: (1) `spec-gate.md` 22 → 45 linhas (a fórmula do score não cabia sem texto); (2) pino de população do `cdl.spec` atualizado (30.362 → 30.385) por causa do (1); (3) `numstat` das 2 rules `4/4` (ADR previu `6/6`); (4) `population=223/30362` (ADR previu …363); (5) `inventory.spec`/`eixos-stack.spec` atualizados porque a remoção muda contagem (`PENDING_REFS_REACT` 12 → 7) e classe (`consumer` 22 → 21).

## 2. Corretude

| Bloco | Evidência |
|---|---|
| Payload | `git ls-files .agents/skills/spec-review/` = **0**; `SKILLS_COMMON` **22 → 21** no mesmo commit; `eixos-stack` 559/559 (disco↔lista nos dois sentidos) |
| Invocação | `grep -rn 'spec-review' .agents README.md docs` = **0**; `Revisar SPEC` = 1; 5 sítios reescritos |
| Substituto | **R1 mecânico** (`asserts/spec-gate.md` + `commands.suiteFull`) no portão; R2 opcional = revisor do destino |
| Score | definido em `spec-gate.md` §5: `itens atendidos / itens aplicáveis × 100`, `N/A` só com motivo, `aplicáveis=0 ⇒ N/A` tratado como FAIL |
| Baseline | **80 → 38** (34 + 4), 19 chaves; `onlyAfter=0`; `owner ADR-003 42→0`; `identity` **14/11 → 4/3**; `structural-debt` **1 → 0** |
| D1 | as 2 rules de frontend com `incondicional=[]` e "Atlas ECM" = 0; corpo prescritivo intacto |
| D8/E-3 | `E-1..E-5` com predicado vivo; renomear skill de eixo ⇒ `cdl-exception-stale` FAIL (contraprova medida) |
| Selo | `commands.suiteFull` byte-idêntico; `harness.config.json`/`seal.mjs` sem diff |

**Suíte:** plugins 538/0 · installer 559/0 · static exit 0 · sdd 0 FAIL · vendor OK. `V20`: `baseline=38 (34+4), prescriptions=137 (53/33/17/34), prohibition-cited=27, identity=4/3, structural-debt=0, refs-undetected=20, payload=214`.

## 3. Coerência

- **Apagar ≠ reescrever**: 1.654 deleções, **0 inserções** no diretório; nenhuma linha de TaskFlow virou genérica.
- **O passo sobreviveu ao artefato**: a revisão de SPEC continua com portão **nomeado** (`spec-gate.md`, que está no payload) e o **score** agora tem produtor declarado — foi o buraco que o review achou (H1) e que a remoção abriu.
- **Dívida com dono, não dívida escondida**: `spec-gate.md` ainda cita Flyway/JWT (1 entrada, `owner: ADR-005`) e **não** foi tocado — o review confirmou `git diff` vazio nesse arquivo.
- **`V19` mudou por consequência, não por acidente**: `spec-review` era `consumer`; saiu do disco e da lista ⇒ 48→47 e 22→21, `orphan` segue 1 (`harness-installer`).
- **`license:` removido é correto**: campo opcional por spec (S4), repo sem `LICENSE`, skill não vendorizada, e o valor era afirmação jurídica falsa sobre cliente. O alarme continua vivo (reintroduzir ⇒ `cdl-identity-term-stale`).

## 4. Traceability

| RF | Task | Onde |
|---|---|---|
| RF-01 | EC-01 | `installer/install.mjs` (−1 linha), `.agents/skills/spec-review/**` (0) |
| RF-02 | EC-02, EC-03 | `workflow-rules.md:205,566`, `orchestrator/AGENT.md:43,306,310`, `sdd-workflow-standard.md:44`, `README.md:15`, `docs/FUNCIONAMENTO.md:134` |
| RF-03, RF-04 | EC-04, EC-06, EC-07 | 2 rules + `vocabulary.txt` + `BASELINE` 38 |
| RF-05 | EC-05 | `security-review/SKILL.md` (−`license:`), `EXCEPTIONS` E-6 fora |
| RF-06, RF-08 | EC-08 | `cdl.spec.mjs` (38/14/11), `E-1..E-5` |
| RF-07 | EC-09, EC-10 | selo + trailer |

**Cobertura: 8/8 RF · 12/12 itens · traceability 100%.**

## 5. Resíduos registrados

| # | Item | Dono |
|---|---|---|
| R1 | `spec-gate.md` cita Flyway/JWT (1 entrada de baseline) | ADR-005 |
| R2 | `TaskFlow` sobrevive em `developer-engineer:1,25` e `ux-designer:32` (prova re-apontada) | ADR-005 |
| R3 | `nestjs:81` / `node:86` — corpo stack-bound das skills de eixo | ADR-005 |
| R4 | `V20` não mede órfão de invocação (prova por `grep`, 🟡) | ciclo de gate |
| R5 | `score` é fórmula declarada, não gate de runtime — quem verifica é o portão humano | processo |

## 6. Conclusão

As 3 dimensões fecham. O harness deixou de distribuir 1.298 linhas de checklist de outro projeto, e a fase que dependia delas ganhou substituto nomeado **com métrica aplicável** — em vez de ficar com a fase órfã ou com um "score" que ninguém sabia calcular. **Apto ao P5→P6.**
