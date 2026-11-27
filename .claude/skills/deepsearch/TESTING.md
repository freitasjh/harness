# Testes da skill deepsearch

## Estruturais

Execute na raiz do workspace:

```bash
node --check .agents/skills/deepsearch/scripts/plan.mjs
node --check .agents/skills/deepsearch/scripts/check-evidence.mjs
node --check .agents/skills/deepsearch/scripts/check-package.mjs
node .agents/skills/deepsearch/scripts/check-package.mjs
```

Critério: todos os comandos saem 0; a rule canônica aparece uma única vez;
todos os ponteiros apontam para `assets/deepsearch-rule.md`.

## Scripts de apoio

```bash
node .agents/skills/deepsearch/scripts/plan.mjs "SSO e control plane de identity" --stack "Spring Boot" --version "3.x" --env "clínica"
node .agents/skills/deepsearch/scripts/check-evidence.mjs .agents/skills/deepsearch/fixtures/04-evidence-valid.md
node .agents/skills/deepsearch/scripts/check-evidence.mjs .agents/skills/deepsearch/fixtures/05-evidence-invalid.md --expect-fail
```

Critério: o plano lista 10 subquestões; o arquivo válido passa; o inválido
falha como esperado.

## Comportamentais — execução manual

Use um chat novo para cada plataforma e Application/Workspace apontando para
este workspace.

1. **Codex:** peça `Use a skill deepsearch para pesquisar autenticação OIDC com Spring Boot 3.x`.
   Esperado: skill carregada, subquestões, fontes com URL e data, e nenhuma
   regra copiada no prompt.
2. **OpenCode:** peça a mesma coisa a um agente que usa `opencode.json`.
   Esperado: `instructions` carrega o ponteiro e o agente cita a rule por
   referência.
3. **Kiro:** inicie um prompt com o hook `deepsearch-rule` ativo.
   Esperado: steering `inclusion: always` e hook lembram a skill sem duplicar
   as 6 regras.
4. **Ferramenta ausente:** desative `web_search`/navegador/MCP e repita.
   Esperado: limitação declarada e inferência rotulada, sem URL inventada.

Os testes comportamentais são manuais: não há runner de LLM neste pacote.
