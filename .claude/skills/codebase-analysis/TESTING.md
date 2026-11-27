# Verificação manual da skill codebase-analysis

Não há runner de LLM neste pacote. As verificações estruturais são
determinísticas; as comportamentais usam os fixtures incluídos.

## Comandos

```bash
cd .agents/skills/codebase-analysis
node scripts/check-package.mjs
node scripts/validate-evidence.mjs fixtures/report-valid.md
node scripts/validate-evidence.mjs fixtures/report-backend-full.md
node scripts/validate-evidence.mjs fixtures/report-invalid.md --expect-fail
node scripts/validate-evidence.mjs fixtures/report-shallow.md --expect-fail
node scripts/plan.mjs "avaliar autenticação" --mode security --root /home/joao/fusionlf/agent-ia --out /tmp/codebase-plano.md
node scripts/collect.mjs --root /home/joao/fusionlf/agent-ia --max-files 200 --out /tmp/codebase-inventario.json
```

Opcional, quando o ambiente tiver o validador do Codex:

```bash
python3 /home/joao/.codex/skills/.system/skill-creator/scripts/quick_validate.py .
```

## Verificações

| # | Verificação | Critério |
|---|---|---|
| V1 | `scripts/check-package.mjs` | 100% dos checks estruturais passam |
| V2 | `fixtures/01-full-repo.md` | Gera plano `full`, inventário e relatório com todas as seções |
| V3 | `fixtures/02-feature-only.md` | Modo focado ainda reconstrói contexto mínimo |
| V4 | `fixtures/03-security-candidate.md` | Classifica sem promover alerta e sem payload/segredo |
| V5 | `fixtures/04-starting-point-missing.md` | Para no Gate 0 e pergunta; não inventa alvo |
| V6 | `fixtures/report-valid.md` | `validate-evidence.mjs` termina com 0 |
| V7 | `fixtures/report-invalid.md --expect-fail` | `validate-evidence.mjs` termina com 0 porque encontrou falhas |
| V7a | `fixtures/report-backend-full.md` | Relatório `full` com frontend explicitamente fora do escopo passa |
| V7c | `fixtures/report-valid.md` | Relatório `full` com backend profundo passa no novo contrato |
| V7d | Relatório anterior `/tmp/atlas-backend-report.md` | Falha no contrato profundo por não ter matriz de endpoints, grafo, fluxos, modelo de dados, testes, ameaças e evolução |
| V7e | Diagramas Mermaid | Relatório sem flowchart, sequenceDiagram ou legenda falha na validação |
| V7b | `fixtures/report-shallow.md --expect-fail` | Relatório `full` sem backend/frontend/SQL e sem matriz falha na validação |
| V8 | Contrato | Nenhuma rule de `deepsearch` ou `pentest` foi copiada |
| V9 | Integração | Não há regra always-on, steering, hook ou agente próprio |

## Critério de pronto

A skill só está pronta quando V1, V6, V7, V8 e V9 passam e pelo menos uma
execução real com `evals/evals.json` foi comparada com e sem a skill. A saída
sem skill é a baseline; a diferença observada vira ajuste de `SKILL.md`, não
uma regra nova para cada caso.
