# Relatório full superficial (fixture inválida)

## 1. Resumo executivo

Este relatório é sobre regras e quase não lê código.

## 2. Escopo e ponto de partida
- Alvo: repositório sintético
- Modo: full
- Pergunta que a análise responde: o projeto está correto?
- Commit/ref: fixture-local
- Incluído: regras
- Excluído: código

## 3. Método e cobertura
- Arquivos/diretórios examinados: `AGENTS.md`
- Regras aplicáveis citadas: `AGENTS.md:1`
- Ferramentas usadas: nenhuma
- O que não foi executado: tudo
- Validação executada: nenhuma

## 4. Mapa de contexto
- Regras e precedência: `AGENTS.md:1`
- Arquitetura: não verificada
- Entry points: não verificados
- Contratos e fronteiras: não verificados
- Dados, testes e CI: não verificados

## 5. Achados de segurança

| ID | Título | Classe | CWE | ASVS | Top 10 | Evidência | Impacto | Remediação | Verificação |
|---|---|---|---|---|---|---|---|---|---|
| SEC-001 | Regra desatualizada | suspeito | — | — | — | `AGENTS.md:1` | Confusão | Atualizar regra | Revisar |

## 6. Achados de arquitetura e regras

| ID | Título | Evidência | Impacto | Recomendação |
|---|---|---|---|---|
| ARC-001 | Regra antiga | `AGENTS.md:1` | Confusão | Atualizar |

## 7. Priorização
1. Atualizar regra

## 8. Lacunas e handoffs
- Código não foi analisado

## 9. Fontes e versões
- Nenhuma fonte externa; análise apenas local em 2026-11-24
