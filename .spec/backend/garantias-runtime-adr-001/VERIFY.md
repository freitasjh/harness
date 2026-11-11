# VERIFY — Modo efetivo de um gate vive no env do processo host

> Ciclo `prd-garantias-runtime` / ADR-001 · branch `adr/prd-garantias-runtime/01-modo-gate-no-env`
> Verificado em 2026-10-22 · evidência: `harness/garantias-runtime-adr-001.json` + `/tmp/opencode/qa-adr001/`
> Verificador: `qa-engineer` (execução) + orquestrador (consolidação). Auto-declarado; a prova é a contraprova.

## Dimensão 1 — Completude

| Task | Commit | O que prova |
|---|---|---|
| `MODO-01` `resolveGateMode` puro | `308403c` | as 5 regras de SPEC §3.2 em teste (incl. `""`, `"  "`, `42`, `null`, `"ENFORCE"`, `"off"`) |
| `MODO-02` `modeForGate` por env | `308403c` | resolve pelo env; gate sem `gateName` ⇒ `DEFAULT_MODE`; fallback por `Function.name` removido (teste com `HARNESS_GATE_GATESHELLHYGIENE`) |
| `MODO-03` auditoria do config | `530be78` | 1 WARN por (chave, valor); `enforce` silencioso; chave sem gate ⇒ "inerte", sem prescrever env |
| `MODO-04` log de rebaixamento/recusa | `530be78` | 1 WARN por (gate, motivo)/(gate, tipo); `enforce` explícito ⇒ 0 linha; recusa não ecoa valor bruto |
| `MODO-05` ordem kill-switch → modo → gates | `eb62598` | 3 pernas: corte ⇒ allow sem anúncio; armado ⇒ 1 anúncio + allow via warn; env vazio ⇒ deny |
| `MODO-06` remoção do `resolveMode` | `eb62598` | `!("resolveMode" in namespace)`; 3 trechos de teste migrados; `grep` = 0 em código |
| `MODO-07` prosa de contrato | `a19acab` | gate-contract (I1/I5/I6/I11 remapeadas, RF-01/02, KILL, RF-04, TIME), harness-config, README |
| `MODO-08` doc de referência | `a19acab` | §3/§4.2/§4.7/§10 a1/a7; 151 citações remapeadas; 778 linhas; a6/a7/a8 em 645-647 |
| `MODO-09` instalador declara a semântica | `a19acab` | comentário em `install.mjs:664`; objeto gerado **byte-idêntico** (golden 516/516) |
| `MODO-10` prosa residual | `a19acab` | `config.mjs:35-37` e `orchestrator/AGENT.md:628-629` com mecanismo + nível |

**10/10 tasks com DoD satisfeito. Zero TODO.**

## Dimensão 2 — Corretude

| Prova | Resultado |
|---|---|
| `commands.suiteFull` (literal do config) | **exit 0**, 6055–6057 ms, stderr 0 bytes |
| Suíte de plugins (unit) | **379 pass / 0 fail / 0 skip** (94 suítes) |
| Suíte do instalador (it) | **516 pass / 0 fail / 0 skip** (178 suítes; golden byte-a-byte) |
| Checks estáticos + SDD | **10 PASS / 0 FAIL** · **8 PASS / 0 FAIL** |
| Contraprova (selo calculado localmente + exec real) | `allow` via `counts-unverifiable` (a6 declarado) |
| Comando adulterado | `DENY sealed-command-mismatch` (selo funciona) |
| `readEvidenceReport` | acha o REPORT, `schemaViolations: []` |

| Critério do PROPOSAL | Prova |
|---|---|
| C1 nenhuma chave do config altera o modo | `resolveGateMode("picco", config)` ⇒ `enforce/default` (RF-01) + E2E `gates.picco="warn"` + env vazio ⇒ **DENY** |
| C2 rebaixamento exige motivo, nunca silencioso | `warn` + `_REASON` ⇒ `warn` + 1 WARN; `warn` sem motivo ⇒ `enforce` + 1 WARN de recusa |
| C3 kill-switch precede a resolução de modo | `HARNESS_GATES=off` + downgrade env ⇒ `{allow, via:"kill-switch"}` com **0** anúncio |
| C4 config auditado, não silencioso | 1 WARN por (chave, valor); `e2eGreenfield` sai como "inerte" |
| C5 nenhum deny novo, `decide()` intacta | diff de `decide()` vazio; `R-NODENY` PASS; zero hook novo |
| C6 suíte verde e prosa no mesmo alcance | acima + 0 referência viva a `resolveMode` |

## Dimensão 3 — Coerência

| Item da interface congelada (ADR-001) | Onde está | Provado |
|---|---|---|
| 1. `resolveGateMode(gateName, env)` puro, 4 campos | `gate.js:98` | teste das 5 regras |
| 2. `HARNESS_GATE_<GATE>` + `_REASON` | `gate.js:95-96` | naming testado (picco/evidence/hitlBatch) |
| 3. fail-closed (ausente/inválido ⇒ enforce) | `gate.js:106-124` | 6 valores fora de domínio |
| 4. config não participa; `resolveMode` removido | `gate.js` (0 ocorrências) | namespace check + E2E |
| 5. auditoria do config | `gate.js:252` | 1 WARN/chave; "inerte" |
| 6. rebaixamento nunca silencioso | `gate.js:278` | 1 WARN/par; dedupe por processo |
| 7. kill-switch antes de tudo | `gate.js:1366` | 3 pernas |
| 8. chave `gates.*` mantida; golden intacto | `install.mjs:664` | 516/516 byte-a-byte |
| 9. prosa no mesmo alcance | gate-contract/harness-config/README/doc | 4 arquivos + doc (1:1 / 778 linhas) |
| 10. sem deny novo | `decide()` inalterada | diff vazio + `R-NODENY` |

**Sem vazamento de camada:** o dispatcher não decide modo (usa `announceGateMode`); `decide()` não lê env nem config; o resolvedor é puro.

## Limites declarados (não escondidos)

| # | Limite | Dono |
|---|---|---|
| a6 | contagens declaradas no REPORT não são comparadas (executor devolve `counts: null` ⇒ `counts-unverifiable`) | ADR-003 (`prd-garantias-runtime`, próximo ADR) |
| c1 | o selo da contraprova depende de `HARNESS_SEAL_JSON` publicado no host; ausente ⇒ `empty-seal` | operação do host (ADR-003) |
| — | `stdoutHash` não tem consumidor no gate (decorativo) e varia entre runs | registrado (ADR-003/Q) |
| — | `modeForGate` não é o call site de produção — é a referência pura congelada (SPEC §3.3), provada por anti-drift | por desenho |
| — | H3 (E2E greenfield) **N/A justificado**: repo sem UI/infra (`stack` N/A, `infra` null); chrome-devtools sem alvo. Substituto: probe do dispatcher | — |

## Veredito

**Completude ✅ · Corretude ✅ · Coerência ✅ — 3/3 PASS.**
Archive liberado (sujeito ao merge humano do PR; o `ADR-INDEX` marca `merged` só depois).
