# VERIFY — prd-installer-rust-adr-001

> Verificação de 3 dimensões sobre o ciclo que executa o **ADR-001 do PRD-3** (fronteira de subprocesso).
> Data: 2026-11-16. Branch: `adr/prd-installer-rust/01-fronteira-subprocesso`. HEAD: `293919a`.

## Veredito: **3/3 PASS**

| Dimensão | Resultado | Base |
|---|---|---|
| Completude | ✅ PASS | 10/10 microtasks; 5 artefatos; 1 exceção datada com expiração |
| Corretude | ✅ PASS | 1.126 testes (540 plugins + 586 installer) 0 falhas; 13/13 itens; REPORT schema-válido |
| Coerência | ✅ PASS | `commands.suiteFull`/selo `c904f1c5` byte-idênticos; oráculo `c63e333` por identidade; ponte declarada |

## 1. Completude

- `TASKS.md`: 10/10 marcadas.
- **Exceção `D1-two-motors`** (ADR §16 + `workflow-state.json.overrides`, 2026-11-16): única ponte `export … from './install.mjs'` em `installer-contract.mjs:15` e a referência dinâmica `:23` (`sanitizeLog`, mesmo módulo em cache) — expira no merge do ADR-003. **Não é conformidade**: é dívida datada.

## 2. Corretude

| Prova | Resultado |
|---|---|
| 6 mapas byte-idênticos ao oráculo | `AXIS_IDS 02215342…`, `SKILLS_BY_AXIS 793e3eca…`, `SKILLS_COMMON 6b9d86f7…`, `RULES_BY_AXIS 8f823529…`, `RULES_COMMON 66e4a89f…`, `STACKS_FOR_EXCEPTIONS 10d9874f…`, ALL `e13f11d5…` — idênticos, com sha por mapa |
| Consumidores | **22/22** em 4 grupos; **75/75** exports com destino (6 registry + 9 data + 29 pure + 23 engine + 8 TUI); 20 internos; 75+20=95 |
| Segredo | `serializeSkips=true` · `sanitizeLog=token=[REDACTED]` · ataque que ecoa `SEGREDO_PROVA` ⇒ `segredo vazou no envelope` FAIL |
| Aborto | `E_ABORT`, hash antes=depois, 0 arquivos |
| Oráculo | worktree `detach` `c63e333`, SHA verificado, `status --porcelain` vazio; canários via `oracleSource()` com fallback fail-closed |
| Critério item 9 | `grep -rn "from '.*install\.mjs'" | wc -l` = **1**, a linha autorizada |

**Suíte:** plugins 540/0 · installer 586/0 · static exit 0 · sdd 0 FAIL · vendor OK. Selo `c904f1c5d7e9…`.

## 3. Coerência

- **Fronteira sem motor paralelo**: `gate.js` 0 referências; nenhum `.so`/`.dylib`; `.mjs` só no oráculo fora do caminho de instalação, com a ponte datada acima.
- **Canais separados**: stdout = envelope JSON; stderr = `[OK]/[INFO]/[AVISO]`; sinal vira `SignalError`, nunca exit 0.
- **`encodeError` sanitiza**: 5 chaves sempre (`clean()` com `''` para undefined/null) ⇒ round-trip `parseEnvelope → ContractError`, não `ProtocolError`.
- **Guarda anti-tautologia é por identidade, não por presença de import** — ver ressalva D-2 abaixo.

## 4. Traceability

| RF | Task | Onde |
|---|---|---|
| RF-01..RF-02 | RC-01..RC-04 | `installer-contract.mjs`, `contract-registry.mjs` |
| RF-03..RF-06 | RC-05, RC-06 | códigos, `IsTerminal`, segredo, aborto |
| RF-07..RF-08 | RC-01, RC-02, RC-07, RC-08 | registry + 22/75 |
| RF-09..RF-11 | RC-09, RC-10 | oráculo, selo, suíte |

**Cobertura: 11/11 RF · 13/13 itens · traceability 100%.**

## 5. Ressalvas do QA (registradas, não corrigidas)

| # | Fato |
|---|---|
| D-1 | SPEC dizia `559 pass`; medido `586` — número corrigido neste commit; selo é a fonte canônica |
| D-2 | A inserção isolada de `readFileSync('../install.mjs')` num canário **não** reprova; o guarda real é a identidade do oráculo (`oracle.mjs` lendo o vivo + VERSION corrompido ⇒ FAIL). Imprecisão de descrição de prova, não defeito de produto |
| — | Ponte `D1-two-motors` expira no ADR-003 — dívida com dono e data |

## 6. Conclusão

As 3 dimensões fecham. A fronteira `contract-v1`, a registry byte-igual e os adapters estão implementados e provados; o motor Rust ainda não existe e a ponte que o substitui temporariamente está declarada com data de expiração. **Apto ao P5→P6.**
