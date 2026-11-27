# Padrões e versões congeladas

Use estas versões ao preencher relatórios. Se uma fonte oficial mais nova for
necessária, faça `deepsearch` e atualize este arquivo com URL e data.

## OWASP ASVS

- Versão: **5.0.0**, publicada em 30 de maio de 2025.
- Uso: critério de verificação de controles de aplicação.
- Identificador: `v5.0.0-<capítulo>.<seção>.<requisito>`, por exemplo
  `v5.0.0-1.2.5`.
- Fonte: https://asvs.owasp.org/ — consultada em 2026-11-24.
- Regra: não citar ID sem abrir a fonte; IDs mudam entre versões.

## OWASP Top 10

- Versão: **2025**.
- Uso: lente de priorização de risco, não prova de exploração.
- Categorias: A01 Broken Access Control; A02 Security Misconfiguration;
  A03 Software Supply Chain Failures; A04 Cryptographic Failures;
  A05 Injection; A06 Insecure Design; A07 Authentication Failures;
  A08 Software or Data Integrity Failures; A09 Security Logging and Alerting
  Failures; A10 Mishandling of Exceptional Conditions.
- Fonte: https://owasp.org/Top10/2025/ — consultada em 2026-11-24.

## MITRE CWE

- Uso: linguagem comum para fraqueza de software.
- Distinção: CWE descreve uma condição que pode contribuir para uma
  vulnerabilidade; não é a confirmação da vulnerabilidade.
- Fonte: https://cwe.mitre.org/about/index.html — consultada em 2026-11-24.
- Regra: registrar `CWE-<n>` apenas quando a fraqueza foi lida no código.

## OWASP Code Review Guide

- Estado observado: versão 3.0 em desenvolvimento; versão anterior 2.0.
- Uso: apoio conceitual. Não usar o rascunho 3.0 como baseline versionado.
- Fonte: https://github.com/owasp/www-project-code-review-guide — consultada
  em 2026-11-24.

## SAST

- Uso: auxílio para localizar código relevante.
- Limite: alta taxa de falso positivo, dificuldade para provar exploração e
  incapacidade de ver configuração fora do código.
- Fonte: https://community.owasp.org/controls/Static_Code_Analysis —
  consultada em 2026-11-24.

## C4 model

- Uso: níveis de zoom context, container, component e code.
- Regra: usar apenas os níveis que agregam valor.
- Fonte: https://c4model.com/diagrams — consultada em 2026-11-24.
