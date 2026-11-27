# Workflow Rules — stub de compatibilidade

Fonte canônica: .agents/skills/harness-workflow/SKILL.md e .agents/skills/harness-prd/SKILL.md.

## 0. Prompt Gate

Stage 0 carrega .agents/skills/prompt-optimizer/SKILL.md e faz brain_search com o prompt literal.
Depois do Stage 0, Contar os 6 elementos afirmados pelo usuário: E1..E6.
Score < 6: Rota A (parar e perguntar). Score = 6: Rota B com bloco PICCO e 1 confirmação.
Premissa não confirmada vai para o ledger em prompt_assumptions[]; nunca escrever premissa não confirmada como fato.

## 0.1 Divisão de Papéis

Matriz em harness-workflow. Nenhuma persona inventada substitui o papel registrado.

## 5. Harness contínuo

H0..H7: princípios, suite completa, zero tolerância, E2E greenfield, avaliação contínua, encerramento limpo, portão de conclusão e cadência.
Contrato operacional: .agents/skills/harness-report/SKILL.md e harness.config.json.
