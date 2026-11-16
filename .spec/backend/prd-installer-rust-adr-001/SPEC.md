# SPEC — prd-installer-rust-adr-001

> Prescritivo. Origem: `ADR-001` §3 (13 itens). Em conflito, o ADR prevalece.

## 1. Requisitos funcionais

- **RF-01 (item 1)** — fronteira única via subprocesso; **nenhum FFI**, nenhum segundo motor no caminho de instalação.
- **RF-02 (itens 2, 3)** — envelope `contract-v1` `{v:1, ok:boolean, ...}` no **stdout**; progresso `[OK]/[INFO]/[AVISO]` no **stderr**; nenhum byte de tela no envelope.
- **RF-03 (item 4)** — códigos 0 (ok), 1 (aborto/erro), 2 (protocolo/uso inválido); o oráculo nunca emite 2.
- **RF-04 (item 5)** — segredo fora de argv, stdout e stderr; `canNoEchoTTY=true`, `canNoEchoPipe=false`, `serializeSkips=true`.
- **RF-05 (item 6)** — TTY vs pipe por `IsTerminal`; pipe usa `--answers-file`.
- **RF-06 (item 7)** — aborto ⇒ exit 1 + **0 writes** (hash antes=depois).
- **RF-07 (item 8)** — 6 mapas em `installer/contract-registry.mjs` byte-idênticos ao oráculo **antes** de trocar `scripts/static-checks.mjs:81`.
- **RF-08 (item 9)** — 22/22 consumidores com destino nos 4 grupos; 75/75 exports mapeados.
- **RF-09 (item 10)** — oráculo materializado por SHA `c63e333` + `status --porcelain` vazio antes de cada medição.
- **RF-10 (item 11)** — `commands.suiteFull` e selo `c904f1c5` byte-idênticos.
- **RF-11 (itens 12, 13)** — suíte verde e ledger 1:1.

## 2. Invariantes

- **I1** — o oráculo é externo e imutável; nada no SDD o reescreve.
- **I2** — adapter não é motor: decide forma, não grava.
- **I3** — registry antes do despacho; divergência = especificador antigo preservado.
- **I4** — canal de progresso nunca contamina o envelope.
- **I5** — zero comando novo no selo.

## 3. Edge cases

- E1 — `op` é o nome do export do oráculo: nenhum vocabulário novo.
- E2 — `NOT_INSTALLED`/`MANIFEST_INVALID` são `InstallError.code` do oráculo, renderizados `UNKNOWN` — não criar código novo.
- E3 — `planUpgrade`/`applyUpgrade` ficam internos ao oráculo, não viram `op`.
- E4 — progresso migrou de stdout para stderr: paridade por união de bytes + transcript mesclado.

## 4. Estratégia de teste

| Nível | Comando | Esperado |
|---|---|---|
| Plugins | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 540 pass |
| Instalador | `node --test "installer/__tests__/*.spec.mjs"` | 586 pass |
| Static | `node scripts/static-checks.mjs` | exit 0, `V18=1`, `V20 baseline=0` |
| SDD | `node scripts/sdd-checks.mjs` | 0 FAIL |
| Vendor | `node scripts/vendor-skills.mjs --check` | OK |

## 5. N/A declarado

Motor Rust e TUI não são deste ciclo (ADR-003/004).
