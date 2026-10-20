# Implementation Plan: opencode-v2-only

> **Fonte**: `SPEC.md` (mesmo dir) · **Suíte**: `commands.suiteFull` (`harness.config.json:14`)
> **Estratégia**: o **adapter** migra para o contrato v2 (função → hooks); os **núcleos puros** ficam byte-idênticos. Cada batch termina com **verificação de runtime** (o plugin carrega?).

## 1. Context & Traceability

- **Target**: `.spec/backend/opencode-v2-only/SPEC.md`
- **Goal**: plugins carregando no runtime v2 + payload do instalador deixando o destino **v2-only**.
- **Assumption declarada**: os nomes de hook v2 são os da doc (`tool.execute.before`, `tool.execute.after`, `event`, `shell.env`). Onde o equivalente de um hook v1 **não** for confirmável, o adapter **falha visível** (nunca registra hook morto).

## 2. Technical Strategy

- **Runtime**: opencode v2.0.32; plugin local auto-carregado de `.opencode/plugins/`.
- **Padrão**: núcleos puros (domínio) + adapter fino (v2). Adapter traduz payload v2 → envelope dos núcleos; **unidirecional**.
- **Instalador**: merge do `opencode.json` passa a **substituir** o bloco gerenciado e **remover** chave obsoleta (`agents`, `permissions`, `plugin` com caminho local).

## 3. Constraint Mapping

| SPEC | Constraint | Enforcement | Failure Mode |
|---|---|---|---|
| RF-01 | export **função** → hooks | loader v2 | `TypeError` ⇒ plugin morto (silêncio) |
| RF-02 | núcleos puros intactos | `git diff` por função + matriz deny/allow | veredito muda (fail-open) |
| RF-04 | merge **substitui** | teste com destino no shape antigo | destino mantém shape obsoleto ⇒ agentes não registram |
| RF-03 | `permission.edit` nos 3 papéis | `debug agents` + config | papel ganha edit (viola I5) |
| RF-07 | enforcement OFF declarado | `workflow-state.json` | estado afirma gate ativo inexistente |

## 4. Fases

### Fase 1 — Plugins (Batch 1)
- **Deps**: nenhuma. **Escopo**: os 3 adapters + matriz de paridade + verificação de runtime.
- **DoD**: `await plugin(ctx)` devolve hooks; log sem `failed to reload plugins`; matriz verde; núcleos com diff vazio.

### Fase 2 — Instalador (Batch 2)
- **Deps**: Batch 1 (o template precisa estar válido).
- **Escopo**: merge que substitui/limpa shape obsoleto + testes (destino com shape antigo; destino sem config).
- **DoD**: instalação nova ⇒ `opencode.json` v2-only; `debug config` sem WARN.

### Fase 3 — Prosa e fechamento (Batch 3)
- **Deps**: Batches 1-2.
- **Escopo**: `gate-contract.md` (I5), supersession do ciclo antigo, VERIFY + archive.
- **DoD**: prosa alinhada; VERIFY 3/3; estado fechado.

## 5. Caminho crítico

`MIG-BE-01` → `MIG-VAL-03` → `MIG-VAL-04` → `MIG-BE-05` → `MIG-VAL-06` → `MIG-VAL-08`

## 6. Tasks

### Fase 1
- **[MIG-BE-01]** [ ] `gate.js`: export **função** v2 (hooks) preservando núcleos puros
  - Deps: — · Layer: Integration · Artefato: `.opencode/plugins/gate.js` · Constraint: RF-01/RF-02
- **[MIG-BE-02]** [ ] `harness-validator.js` + `hitl-guardrail.js`: mesmo contrato
  - Deps: MIG-BE-01 · Layer: Integration · Constraint: RF-01
- **[MIG-VAL-03]** [ ] Contrato do adapter (T2) + matriz deny/allow (T1)
  - Deps: MIG-BE-02 · Layer: Test · Constraint: RF-02
- **[MIG-VAL-04]** [ ] Verificação de runtime: os 3 carregam, log sem `TypeError`
  - Deps: MIG-VAL-03 · Layer: Test · Constraint: RF-01/RF-07

### Fase 2
- **[MIG-BE-05]** [ ] Merge do `opencode.json` substitui/limpa shape obsoleto
  - Deps: MIG-VAL-04 · Layer: Integration · Artefato: `installer/install.mjs` · Constraint: RF-04
- **[MIG-VAL-06]** [ ] Testes do merge (destino com shape antigo; destino sem config)
  - Deps: MIG-BE-05 · Layer: Test · Constraint: RF-04/RF-05

### Fase 3
- **[MIG-FE-07]** [ ] Prosa: `gate-contract.md` I5 + supersession do ciclo antigo
  - Deps: MIG-VAL-06 · Layer: Interface · Constraint: RF-06
- **[MIG-VAL-08]** [ ] Fechamento: instalação nova v2-only + suíte + VERIFY
  - Deps: MIG-FE-07 · Layer: Test · Constraint: RF-05

## 7. Riscos

- **🔥 Veredito de gate mudando** (fail-open): mitigado por núcleos byte-idênticos + matriz deny/allow.
- **🟠 Hook v2 sem equivalente**: regra de ouro — erro visível.
- **🟠 Enforcement OFF durante a transição**: declarado (RF-07), cada batch verifica carga.
