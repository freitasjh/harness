# Architecture & Software Specification — ADR-005

## 1. ADRs

### ADR-005: Pergunta dupla backend+frontend
- **Decision**: Q&A pergunta backend e frontend separadamente; `presetOfAxes(b,f)` resolve preset; `collectAnswers` dual-shape; `answersVersion` opcional.
- **Context**: desacoplar backend×frontend para evitar N×M presets.
- **Trade-offs**: mais perguntas no Q&A; mitigado com menu preset como atalho.

## 2. Functional Requirements

### FR-01: presetOfAxes
`presetOfAxes(backendId, frontendId)` MUST ser função pura retornando nome do preset existente ou `null`. `presetsOfAxes(b,f)` retorna array de todos os matches.

### FR-02: collectAnswers dual-shape
- Legado: `stack` presente → valida como hoje.
- Novo: `backend`+`frontend` presentes → valida IDs em AXIS_IDS, resolve via presetOfAxes; sem preset → BAD_ANSWER.
- Misto: ambos presentes → exige consistência (presetOfAxes(b,f) === stack), senão BAD_ANSWER.
- Nenhum → BAD_ANSWER (missing answer).
- Paired: se apenas um de backend/frontend presente → BAD_ANSWER.

### FR-03: answersVersion
Opcional. Default 1 (legado) / 2 (novo). Serializado se presente. Não gateia comportamento.

### FR-04: validateAnswer
Cases `'backend'` (AXIS_IDS.backend) e `'frontend'` (AXIS_IDS.frontend). Helper `validateAxesCombination(b,f)`.

### FR-05: generateConfig
Resolve stack: `answers.stack ?? presetOfAxes(answers.backend, answers.frontend) ?? 'node'`. Se backend/frontend presentes mas sem preset → BAD_ANSWER.

### FR-06: defaultSuiteFor
Aceita stack string OU {backend, frontend}; resolve preset first se axes given.

### FR-07: Wizard
Mantém menu preset como atalho, serializa axes derivados (sem quebrar transcript).

### FR-08: Doctor
Manifest legado (sem axes) deriva axes de stack.

## 3. Invariants
- I1: presets existentes byte-idênticos (golden).
- I2: `presetOfAxes` puro (sem I/O).
- I3: `answers.stack` derivado no shape novo.
- I4: dual-shape: nenhum fixture legado precisa mudar.

## 4. Delta Specs

| Documento Alvo | Tipo | Seção |
|----------------|------|-------|
| `installer/install.mjs` | MODIFIED | QUESTIONS, collectAnswers, generateConfig, validateAnswer, defaultSuiteFor, presetOfAxes, runWizard |
| `installer/__tests__/*.spec.mjs` | MODIFIED | compat + golden + eixos-stack |
