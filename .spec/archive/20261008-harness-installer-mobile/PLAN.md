# Plan — harness-installer-mobile

- **SPEC:** `.spec/governance/harness-installer-mobile/SPEC.md` (94%, reviewed 90%)
- **Estratégia:** implementar por **4 batches** na ordem de contrato → vendor → wizard → docs/dogfood.
- **Restrição dura:** cada batch termina com suite verde + code review; pausa HITL entre batches.

## 0. Pré-condições (bloqueiam implementação)

| # | Item | Origem | Dono |
|---|---|---|---|
| P-01 | **Congelar baseline da suite** (`commands.suiteFull`) e registrar o número real | G1 | Execution |
| P-02 | **Política de licença do vendor** (verificar LICENSE upstream de `dart-lang/skills` e `flutter/skills`) | G2/S2 | PLAN + usuário |

> P-02 é decisão do usuário: (i) bloquear skill sem licença, (ii) vendorizar só com licença, ou (iii) atribuir via `VENDOR-NOTICE.md`.

## 1. Batches

### Batch 1 — Contrato de dados (INST)
Base: ADR-008. Retrocompat é invariante (I7).
- `STACK_PROFILES` + `profileOf()`; `generateConfig` por lookup (puro).
- `validateAnswer('stack')` aceita flutter/dart + exige `pubspec.yaml` + discriminador `sdk: flutter`.
- `collectIncoming(sourceDir,{stacks})` filtra por stack; exclui `.vendor-lock.json`. `runCli` propaga `stacks` (A4).
- Merge aditivo do bloco `mcp` no `opencode.json` (A3).
- Golden test: node/java+vue/outra byte-idênticos.

### Batch 2 — Vendor (VEND)
Base: ADR-009.
- `scripts/vendor-skills.mjs` (offline, source-side): fetch → grava byte-idêntico → `.vendor-lock.json` → `VENDOR-NOTICE.md`; `--check` recomputa `treeHash`.
- Executar vendor das 22 skills.
- Check estático V15: proíbe `fetch`/`node:http(s)` em `installer/`.
- Revisão de conteúdo do vendor (S1) + assert de arquivos regulares/sem symlink (S4).

### Batch 3 — Wizard B2 (INST)
Base: ADR-010 + UX spec (vinculante).
- `runWizard()` W0..W7; `detect()` line-based do pubspec; `terminal:true` condicional em TTY.
- Reusa `validateAnswer`/`printPlan`/`confirmByLayer`; abort até W5 = 0 writes.
- Testes de estado com streams injetados.

### Batch 4 — Docs + Dogfood
- `SKILL.md` do harness-installer documenta perfil mobile (RF-17).
- Dogfood em cópia de projeto Flutter sob `/tmp` (H3).

## 2. Detalhamentos de gap (do REVIEW)

| Gap | Decisão no PLAN |
|---|---|
| G3 | `detect()` lê pubspec **line-based** (sem lib YAML) |
| G4 | Sem bloco `mcp` no destino ⇒ gerar config do perfil + passo humano no resumo |
| G5 | `pluginsDir` default = target root (profile), sem quebrar validação |
| G6 | Teste de regressão do leitor para `terminal:false` |
| G7 | Manter `.spec/governance/` (precedente v1); registrar exceção no standard |

## 3. Rastreabilidade SPEC→PLAN

| RF/Invariante | Batch |
|---|---|
| RF-11 validateAnswer | B1 |
| RF-12 generateConfig | B1 |
| RF-13 vendor + --check | B2 |
| RF-14 filtro collectIncoming | B1 |
| RF-15 wizard | B3 |
| RF-16 merge mcp | B1 |
| RF-17 SKILL doc | B4 |
| I7 golden | B1 |
| I8 rede-zero | B2 |
| I9 vendor drift | B2 |
| I10 filtro | B1 |
| I11 wizard sem autoridade | B3 |

## 4. Modos de falha / mitigação

- Retrocompat quebrada ⇒ golden test falha ⇒ bloqueia merge.
- Vendor drift ⇒ `--check` vermelho no CI ⇒ bloqueia.
- Detecção errada dart/flutter ⇒ validateAnswer rejeita + menu manual.
- Wizard trava sem TTY ⇒ comportamento v1 (abort com instrução) preservado.

## 5. Gate do PLAN

| Critério | Status |
|---|---|
| Toda RF da SPEC mapeada | ✅ §3 |
| Pré-condições explícitas | ✅ §0 (P-01, P-02) |
| Batches com escopo + base ADR | ✅ §1 |
| Riscos com mitigação | ✅ §4 |
