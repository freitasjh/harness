# SDD Workflow Standard (MANDATORY)

Esta regra define o contrato rigoroso de organização de arquivos e gestão de estado para todo o ciclo de vida de desenvolvimento (SDD) no projeto Atlas ECM.

## 1. Organização de Arquivos (File Structure)

Todos os artefatos de especificação e planejamento devem ser organizados por camada (backend/frontend) e agrupados por contexto de funcionalidade.

### Estrutura de Diretórios:
- **Backend**: `.spec/backend/[feature-or-bugfix-context]/`
- **Frontend**: `.spec/frontend/[feature-or-bugfix-context]/`

### Artefatos Obrigatórios por Funcionalidade:
Cada pasta de funcionalidade deve conter:
1. `SPEC.md`: Especificação técnica prescritiva (gerada pelo `sdd-compiler`).
2. `PLAN.md`: Plano de implementação detalhado (gerado pelo `sdd-compiler`).
3. `TASKS.md`: Backlog de tarefas TDD-ready (gerado pelo `sdd-compiler`).

## 2. Gestão de Estado Global (`workflow-state.json`)

O arquivo `workflow-state.json` deve residir na **raiz do projeto**. Ele é a única fonte de verdade para o progresso do desenvolvimento.

### Campos Obrigatórios:
- `current_feature`: Nome da funcionalidade em desenvolvimento (ou bugfix).
- `current_phase`: Fase atual (Discovery, Planning, Execution, Testing, Completed — ou BugAnalysis, BugFix, BugReview, BugCompleted para bugfixes).
- `previous_phase`: Fase imediatamente anterior.
- `next_phase`: Próxima fase planejada.
- `artifacts`: Caminhos absolutos para SPEC, PLAN e TASKS (ou TASKS.md para bugfix).
- `type`: `feature` ou `bugfix` (indica se é funcionalidade ou correção).
- `last_update`: Timestamp da última alteração.

## 3. Registro de Progresso (`spec-developed.md`)

O arquivo `spec-developed.md` na **raiz do projeto** deve listar cronologicamente todas as funcionalidades desenvolvidas e suas respectivas etapas concluídas.

## 4. Portão de Aprovação e Feedback
Antes de avançar entre as fases (SPEC -> PLAN -> TASKS), o `sdd-orquestrador` deve obrigatoriamente:
1. Validar o artefato contra os `asserts` da skill `sdd-compiler`.
2. Invocar skill `spec-review` para revisar SPEC.md contra regras do projeto.
3. Gerar relatório de gaps e conformidade (com scorecard por categoria).
4. Corrigir gaps 🔴 críticos e 🟠 alta prioridade antes de avançar.
5. Solicitar aprovação explícita do usuário via `ask_user`.

## 5. Persistência no Brain
Ao concluir as TASKS, o `planejador` deve consolidar a análise e as lições aprendidas em uma nota estruturada no sistema de memória (Obsidian).
