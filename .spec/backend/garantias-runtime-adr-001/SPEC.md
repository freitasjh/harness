# SPEC — Modo efetivo de um gate vive no env do processo host

> Ciclo `prd-garantias-runtime` · ADR-001 · escopo: P1-A (RF-01, RF-05)
> Este documento é **prescritivo**: a interface congelada do ADR-001 vira norma.
> Nomes, assinaturas e ordem de avaliação aqui são contrato — mudar um deles exige novo ADR.

## 1. Contexto e vocabulário

- **Gate** = uma função de negação registrada em `CORE_GATES` (`gate.js:1010-1014`).
- **Modo efetivo** = o valor que decide se o `DenyError` de um gate nega (`enforce`)
  ou vira log + allow (`warn`) — `decide()` (`gate.js:161-177`).
- **Rebaixamento** = colocar um gate em `warn`. **Corte de suíte** = `HARNESS_GATES=off`.
- **env do processo host** = `process.env` do processo do opencode, externo ao worktree.

## 2. Requisitos normativos

| ID | Requisito | Origem |
|---|---|---|
| RF-01 | Nenhuma chave de `harness.config.json` altera o modo efetivo de um gate registrado | PRD §9 RF-01 |
| RF-05 | O rebaixamento, quando em vigor, é registrado em log — nunca silencioso | PRD §9 RF-05 |
| RF-04 | Toda afirmação de garantia em prosa cita `arquivo:linha` do mecanismo e o nível real | PRD §9 RF-04 (instrumento em `ADR-004`) |
| C1 | (do owner, Q1) O rebaixamento de gate vive no env do processo host; `gates.*` no config é informativo | PRD §16 |

## 3. Contrato de interface (norma)

### 3.1 Função de resolução (nova, pura)
```
resolveGateMode(gateName: string, env: object) → {
  mode: "enforce" | "warn",
  source: "env" | "default",
  envVar: string | null,
  reason: string | null
}
```
- Nome da env: `"HARNESS_GATE_" + gateName.toUpperCase()` (só `[A-Za-z0-9_]`).
  Mapa: `picco` → `HARNESS_GATE_PICCO`; `evidence` → `HARNESS_GATE_EVIDENCE`;
  `hitlBatch` → `HARNESS_GATE_HITLBATCH`.
- Variante do motivo: `HARNESS_GATE_<GATE>_REASON`.

### 3.2 Regras de resolução (fail-closed)
| Env | Resultado | Log |
|---|---|---|
| ausente | `{mode:"enforce", source:"default", envVar:null, reason:null}` | — |
| `"enforce"` | `{mode:"enforce", source:"env", envVar, reason:null}` | — |
| `"warn"` + motivo não vazio | `{mode:"warn", source:"env", envVar, reason:<texto>}` | 1 WARN (gate, envVar, motivo) |
| `"warn"` sem motivo | `{mode:"enforce", source:"default", envVar, reason:null}` | 1 WARN "downgrade recusado: motivo ausente" |
| valor fora de {`enforce`,`warn`} | `{mode:"enforce", source:"default", envVar, reason:null}` | 1 WARN "valor inválido" |

### 3.3 O config não participa
- Para todo `k` e todo `v`: `resolveGateMode(k, { env: {} }).mode === "enforce"`.
- `resolveMode(config, gateName)` **sai do contrato** (é removido do código).
- `modeForGate(gateFn, env)` passa a resolver pelo env; gate sem `gateName` próprio
  (o de higiene) cai no `DEFAULT_MODE` (`enforce`).

### 3.4 Auditoria do config (observabilidade, não decisão)
- No carregamento, para cada `gates[k]` com valor ≠ `"enforce"`: **exatamente 1 WARN**
  contendo chave, valor, modo efetivo (`"enforce"`) e se a chave é gate registrado
  (sim/não).
- Para valor `"enforce"`: **nenhum** log.

### 3.5 Ordem de avaliação
1. `HARNESS_GATES=off` ⇒ corte de suíte, **antes** de qualquer resolução de modo.
2. Resolução de modo por env.
3. Loop de gates.

### 3.6 Sem deny novo
Nenhum `DenyError` novo, nenhum hook novo. `decide()` mantém assinatura
`{gateFn, mode, ctx, env, logger}` e a semântica "DenyError ⇒ deny; outro erro ⇒
allow + log `error`" (`gate.js:161-177`).

### 3.7 Compatibilidade do config
A chave `gates.*` **permanece** em `harness.config.json` (`harness.config.json:38-43`),
permanece no config gerado pelo instalador (`installer/install.mjs:664`) e o golden
test mantém igualdade byte-a-byte (`installer/__tests__/golden.spec.mjs:40`). Muda a
**semântica** (informativa), não a forma.

## 4. Invariantes

| ID | Invariante |
|---|---|
| INV-1 | Para todo gate e todo `env` sem `HARNESS_GATE_*`: modo efetivo = `enforce` |
| INV-2 | Para todo gate e todo config: o config não muda o modo efetivo (RF-01) |
| INV-3 | Rebaixamento em vigor ⇒ existe motivo não vazio e existe 1 WARN no log |
| INV-4 | `HARNESS_GATES=off` ⇒ nenhum gate nega, independente de qualquer outra env |
| INV-5 | A ordem é: corte de suíte → resolução de modo → loop de gates |
| INV-6 | `decide()` não muda: assinatura e semântica de deny/fail-open |

## 5. Matriz de arquivos afetados

| Arquivo | Mudança | Natureza |
|---|---|---|
| `.opencode/plugins/gate.js` | `resolveGateMode` (nova), `modeForGate` (env), `resolveMode` (removido), auditoria de `gates.*`, log de downgrade, ordem no dispatcher | código |
| `.opencode/plugins/__tests__/gate.spec.mjs` | testes de `resolveMode` → `resolveGateMode`; casos de `gates.*` (`:144-149`, `:1007-1024`) | teste |
| `.opencode/plugins/__tests__/matrix-v1v2-parity.spec.mjs` | caso "GATES-OFF" perde objeto (`:197-206`) | teste |
| `.agents/rules/gate-contract.md` | rows `RF-01/RF-02` e `KILL` + §3 | prosa |
| `.agents/rules/harness-config.md` | linha `gates.*` + seção Kill-switch | prosa |
| `README.md` | funcionalidade #7 | prosa |
| `docs/FUNCIONAMENTO.md` | §3 (#7), §4.7, §10 `a7` | prosa |
| `installer/install.mjs` | semântica declarada de `gates.*` (comentário; **formato inalterado**) | código/comentário |

## 6. Estratégia de teste

| Nível | Onde | O que cobre |
|---|---|---|
| Unitário | `gate.spec.mjs` | `resolveGateMode` (5 casos da tabela 3.2); `modeForGate` com env; auditoria de `gates.*` (1 WARN por chave, 0 para `enforce`); log de downgrade (1 por par) |
| Integração (runtime) | `matrix-v1v2-parity.spec.mjs` | ordem kill-switch → modo → gates; `HARNESS_GATES=off` com `HARNESS_GATE_PICCO=warn` ⇒ allow; deny de PICCO com env ausente |
| Regressão | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` (379) + `installer/__tests__` (516) | nada quebra |
| Harness | `commands.suiteFull` + `scripts/sdd-checks.mjs` | ciclo SDD 1:1, prosa coerente |

## 7. Itens N/A (com justificativa)

| Item do spec-gate | Status | Justificativa |
|---|---|---|
| ERD | **N/A** | o plugin não tem estado persistente |
| Event Registry / 4-task lifecycle | **N/A** | sem eventos; o deny é síncrono no hook |
| Migrações Flyway | **N/A** | sem banco |
| Modelo JWT / `@HasPermission` | **N/A** | o plugin não autentica; a dimensão equivalente é a superfície de bypass, tratada em §3.3/§4 |
| Multi-tenancy | **N/A** | single-host |

## 8. Delta Specs

| Documento | Tipo | Delta |
|---|---|---|
| `.agents/rules/gate-contract.md` | MODIFIED | §1 row `RF-01/RF-02`: "gates.* do config é informativo" ⇒ "nenhuma chave do config altera o modo efetivo; o rebaixamento vive em `HARNESS_GATE_<GATE>` + `_REASON`"; row `KILL`: distinguir corte de suíte (env) de rebaixamento de gate (env por gate) |
| `.agents/rules/harness-config.md` | MODIFIED | tabela de chaves: `gates.*` ⇒ "informativo/auditado; rebaixamento vive no env"; seção Kill-switch: acrescenta o canal por gate e o motivo obrigatório |
| `README.md` | MODIFIED | funcionalidade #7: "config nunca desliga" ⇒ "o config nunca desliga a suíte; rebaixar um gate exige env do processo host + motivo" |
| `docs/FUNCIONAMENTO.md` | MODIFIED | §3 #7, §4.7 (modo por env + auditoria), §10 `a7` ⇒ status "implementado em 2026-10-22 (ADR-001)" |
| `installer/install.mjs` | MODIFIED | comentário da semântica de `gates.*` no config gerado (formato do config inalterado) |
