# Change Proposal: harness-adr-005-dual-axes

> **ID**: `harness-adr-005-dual-axes`
> **Status**: `Approved`
> **Author**: orchestrator
> **Date**: 2026-10-28
> **Source**: ADR-005 (pergunta dupla backend+frontend) — Feature A da divisão aprovada

---

## 1. Problem Statement

Installer usa uma única chave `stack` (preset) para resolver perfil, labels, gating e baseline. Isso trava N×M backend×frontend e obriga release a cada par novo. Migração precisa ser aditiva (dual-shape), sem quebrar ≈20 fixtures e baselines atuais.

- **Contexto**: `installer/install.mjs` (QUESTIONS, collectAnswers, profileOf, generateConfig, defaultSuiteFor, validateAnswer, WIZARD_MENU).
- **Impacto atual**: novos pares backend×frontend exigem preset explícito + release; `--answers-file` legado só aceita `stack`.
- **Evidência**: análise architect + product-manager.

## 2. Proposed Solution

**Resumo**: implementar ADR-005 — Q&A pergunta backend e frontend separadamente, introduzir `presetOfAxes(backend, frontend)` puro, `collectAnswers` dual-shape (legado `stack` + novo `backend`/`frontend`), `answersVersion` opcional, compat retroativa, wizard W2m em 2 passos.

**Abordagem**:
- `presetOfAxes(b, f)` + `presetsOfAxes(b, f)` (reverse index por axes).
- `QUESTIONS` ganha `backend`/`frontend` opcionais (kind backend/frontend).
- `collectAnswers`: legado (stack) / novo (backend+frontend) / misto (consistência) / nenhum (BAD_ANSWER).
- `answers.stack` derivado no shape novo.
- `answersVersion` opcional (default 1 legado, 2 novo), serializado se presente, não gateia.
- `validateAnswer`: cases backend/frontend + `validateAxesCombination`.
- `generateConfig`: resolve stack via answers.stack ?? presetOfAxes ?? 'node'.
- `defaultSuiteFor`: aceita stack string OU {backend, frontend}.
- Wizard: mantém menu preset como atalho, serializa axes derivados.

**Alternativas descartadas**:
- Remover `stack` (quebra fixtures).
- Sintetizar perfil para par não registrado (quebra frozen labels/I7).
- Tornar `answersVersion` obrigatório (quebra consumidores antigos).

## 3. Scope

### In Scope
- [x] `presetOfAxes` / `presetsOfAxes` puros.
- [x] `collectAnswers` dual-shape.
- [x] `answersVersion` opcional.
- [x] `validateAnswer` backend/frontend + `validateAxesCombination`.
- [x] `generateConfig` resolution.
- [x] `defaultSuiteFor` dual input.
- [x] Wizard serializa axes derivados.
- [x] Testes compat + golden.

### Out of Scope
- Criar perfis backend novos (go etc.) ou combos *+vue.
- Vendor upstream de skills novas.
- Upgrade/migração de repos já instalados.
- Gating positivo de backend specialist por eixo.
- Remover `stack` ou torná-lo obrigatório no shape novo.
- Síntese de perfil para par não registrado.
- Mudanças em gate.js, protected paths, selo.

## 4. Architecture Impact

| Aspecto | Impacto | ADR Necessário? |
|---------|---------|-----------------|
| Backend (installer) | collectAnswers, generateConfig, validateAnswer, defaultSuiteFor, presetOfAxes | ADR-005 (este) |
| Frontend | N/A | Não |
| Banco | N/A | Não |
| Multi-tenancy | N/A | Não |
| Segurança | N/A | Não |
| Eventos | N/A | Não |

## 5. Delta Preview

| Documento Alvo | Tipo | Seção |
|----------------|------|-------|
| `installer/install.mjs` | MODIFIED | QUESTIONS, collectAnswers, generateConfig, validateAnswer, defaultSuiteFor, presetOfAxes, runWizard |
| `installer/__tests__/*.spec.mjs` | MODIFIED | compat + golden + eixos-stack |
| `README.md` / skill | MODIFIED | answers shape |

## 6. Risk Assessment

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Regressão fixtures (~20) | Média | Alto | Dual-shape + stack derivado |
| UX wizard (mais perguntas) | Baixa | Médio | Menu preset como atalho |
| Ambiguidade stack vs axes | Baixa | Médio | Validação estrita de consistência |
| Baseline golden | Baixa | Alto | Adicionar baselines novos, não alterar existentes |
| N×M não resolvido | — | — | presetOfAxes retorna null para pares não registrados (intencional) |

## 7. Success Criteria
- [ ] `presetOfAxes('java','react') === 'java+react'`; `presetOfAxes('node','none') === 'node'`; `presetOfAxes('java','flutter') === null`.
- [ ] IDs inválidos → BAD_ANSWER.
- [ ] Shape legado continua válido sem backend/frontend.
- [ ] Shape novo resolve stack e passa em generateConfig.
- [ ] Shape misto inconsistente → BAD_ANSWER.
- [ ] Arquivo sem answersVersion aceito; answersVersion:2 aceito.
- [ ] Nenhum fixture existente precisa mudar.
- [ ] Baselines existentes byte-idênticos.
- [ ] generateConfig shape novo == output do preset correspondente.
- [ ] Doctor com manifest legado (sem axes) deriva axes de stack.
- [ ] Suite + static-checks + temp install verdes.

## 8. Completion Metadata
- **Archived on**: —
- **Duration**: —
- **Archive path**: —
- **Files changed**: —
