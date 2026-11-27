---
name: harness-bootstrap
description: "Skill de inicializacao e migracao do harness em projetos OpenCode e Codex. Use para init, migrate ou doctor."
---

# Harness Bootstrap

Fachada para a CLI. A skill nunca escreve diretamente.

## Quando usar
Instalar harness em projeto novo, migrar layout antigo, diagnosticar instalacao.

## Entradas
Target dir, suite command opcional, flags de stack, modo init|migrate|doctor, confirmacao do operador.

## Saidas
Plano antes da escrita, apply via node scripts/harness-sync.mjs, resultado do doctor, manifesto atualizado.

## Portoes
Dry-run e apply devem produzir as mesmas linhas de plano. migrate preserva project-*.md, workflow-state.json, harness.config.json e prefixo de AGENTS.md/DESIGN.md. Segunda execucao com payload identico faz 0 writes. Zero rede e zero porta.

## Referencias
docs/ref/sync.md; scripts/harness-sync.mjs; .codex/hooks.json gerado com caminho relativo.
