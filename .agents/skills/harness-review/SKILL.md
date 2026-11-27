---
name: harness-review
description: "Skill canônica de code review: parecer read-only, severidades, saida estruturada e ligacao com code_review_status. Use apos qualquer mudanca de codigo."
---

# Harness Review

Substitui a regra de revisao em workflow.md. Nao duplica seguranca: isso pertence a security-review.

## Quando usar
Apos qualquer mudanca de codigo, antes de declarar tarefa ou fase concluida.

## Entradas
git diff, SPEC do ADR, codigo afetado, resultados de teste.

## Saidas
{approval_status, critical_issues, attention_issues, must_fix_before_done[], evidence[]}.

## Portoes
Read-only. Comeca pelo git diff. Zero critical antes de passed. Loop implementador -> reviewer ate 3 iteracoes. Veredito e parecer; bloqueio real e a ancora B lendo code_review_status.

## Referencias
security-review, harness-report, harness-workflow/references/handoff-schema.md. Rubrica project-owned; sem dependencia externa.
