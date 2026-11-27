---
name: codebase-analysis
description: "Análise profunda e somente leitura de codebase: regras, arquitetura, contratos, testes e revisão estática de segurança. Use quando pedirem avaliar repositório, funcionalidade, commit ou vulnerabilidades no código; não use para pentest autorizado, exploração, implementação ou escolha de biblioteca sem fonte."
---

# Codebase analysis — detalhe operacional

Contrato interno do pacote: `assets/codebase-analysis-contract.md`.
Este arquivo não substitui nem copia as rules de `deepsearch` ou `pentest`.
Quando uma recomendação depender de biblioteca, API, configuração ou padrão
externo que vai virar código, use `deepsearch`. Quando um achado exigir prova
em ambiente real, use o fluxo `pentest` com autorização.

Pacote portátil: `SKILL.md`, `assets/`, `references/`, `scripts/`,
`fixtures/`, `evals/` e `TESTING.md` viajam juntos. Não é uma regra always-on.

## Sintoma que esta skill corrige

Uma análise que começa com “vou ler tudo” e termina em opiniões soltas não
orienta correção: não diz onde olhou, quais regras aplicou, o que ficou de
fora nem como cada achado foi classificado. O produto desta skill é um mapa
de contexto com evidência `arquivo:linha`, achados separados por classe e um
relatório validável.

## Quando usar

- Avaliar repositório inteiro, módulo, funcionalidade, commit ou PR.
- Entender regras, arquitetura, contratos, fronteiras, dados, testes e CI.
- Revisão estática de segurança: fraquezas, candidatos e lacunas de controle.
- Preparar contexto para outra tarefa que vai mudar código.

## Quando não usar

- Teste ativo, exploração, payload, persistência ou exfiltração: use `pentest`
  com Gate 0.
- Escolha de biblioteca/API/padrão que ainda não tem fonte verificada: use
  `deepsearch` antes de recomendar.
- Implementação da mudança: esta skill é somente leitura. Leve o relatório
  para `brainstorming`/`prompt-optimizer` antes de escrever código.
- Conceito estável do domínio sem necessidade de contexto do repositório:
  responda com `arquivo:linha` e siga em frente.

## Gate 0 — travar o pedido

Antes de ler em profundidade, registre:

- alvo: repositório, diretório, arquivo, funcionalidade, commit ou PR;
- modo: `full`, `feature`, `diff` ou `security`;
- inclusões e exclusões explícitas;
- `ref`/commit quando a análise precisar ser reproduzível;
- pergunta que a análise precisa responder.

Sem alvo ou sem modo, pare e pergunte. Não escolha silenciosamente. Use
`node scripts/plan.mjs` para materializar esse travamento.

## Contexto mínimo obrigatório

Mesmo nos modos `feature`, `diff` e `security`, a análise sempre reconstrói:

1. regras e precedência (`AGENTS.md`, rules, steering, hooks);
2. mapa do repositório e manifests;
3. entry points e fronteiras da funcionalidade;
4. contratos e dados que cruzam fronteira;
5. testes e configuração de CI/CD;
6. lacunas que não dá para saber sem rodar.

No modo `full`, o contexto mínimo se estende ao contrato de profundidade em
`references/full-depth-contract.md`: backend, frontend e SQL/dados são
seções obrigatórias, com matriz de cobertura e evidência por camada.

Use `node scripts/collect.mjs` para inventário somente leitura. O script não
abre conteúdo de arquivos suspeitos nem imprime segredos.

## Modos

| Modo | Ponto de partida | Cobertura |
|---|---|---|
| `full` | repositório ou diretório raiz | contrato de profundidade + todas as seções do playbook |
| `feature` | funcionalidade, rota, serviço ou símbolo | contexto mínimo + caminho da funcionalidade |
| `diff` | commit, PR ou intervalo | mudança + contextos que ela toca |
| `security` | superfície ou requisito de segurança | lente de segurança + contexto mínimo |

## Fluxo por fases

1. **Travar.** `plan.mjs` → plano com alvo, modo, inclusões, exclusões e gates.
2. **Inventariar.** `collect.mjs` → mapa de arquivos, regras, manifests, entry
   points, testes, CI e candidatos sensíveis.
3. **Ler regras.** Aplicar precedência observada; registrar conflito, não
   inventar exceção.
4. **Mapear contexto.** Arquitetura C4-lite + lentes de backend, frontend e
   SQL/dados. No modo `full`, nenhuma dessas camadas pode ser substituída por
   leitura de regras.
5. **Revisar segurança.** Usar `references/security-review-lens.md` e
   `references/standards-and-versions.md`. Classificar, não adivinhar.
6. **Validar.** `validate-evidence.mjs` confere estrutura, evidência, versões,
   classes, handoffs e vazamento de segredo no rascunho do relatório.
7. **Entregar.** Relatório em `assets/report-template.md`; lacunas e handoffs
   são seções obrigatórias quando existirem.

Cada fase só avança quando o artefato anterior existe. Se uma subquestão não
fecha com fonte oficial, evidência local citável ou inferência rotulada com
alvo de verificação, ela permanece aberta no relatório.

## Segurança: fronteira rígida

- `suspeito`: padrão ou ausência observada; ainda não prova impacto.
- `fraca confirmada em código`: caminho de dados/controle lido até a origem e
  ao sink, com `arquivo:linha` nos dois lados.
- `requer runtime`: precisa de configuração, estado ou comportamento real.
  Vai para handoff `pentest` com Gate 0; nunca é promovido por esta skill.

Não escreva payload, comando de exploração, segredo descoberto nem PII no
relatório. Mascare e registre apenas o local do achado.

Não cite ID ASVS, CWE ou Top 10 de memória. Use
`references/standards-and-versions.md`; se precisar de um ID não listado,
abra a fonte oficial com `deepsearch` antes de escrever.

## Scripts disponíveis

- `scripts/plan.mjs` — Planeja e fixa escopo. `--help` mostra as opções.
- `scripts/collect.mjs` — Inventário somente leitura do repositório.
- `scripts/validate-evidence.mjs` — Valida rascunho de relatório e cartões.
- `scripts/check-package.mjs` — Checa integridade deste pacote.

Exemplo:

```bash
node scripts/plan.mjs "avaliar autenticação" --root . --mode security --out /tmp/plano.md
node scripts/collect.mjs --root . --out /tmp/inventario.json
node scripts/validate-evidence.mjs /tmp/relatorio.md --format json
```

Todos são não interativos, saem em JSON ou Markdown previsível e usam exit
codes documentados no `--help`. Nenhum script modifica o repositório.

## Leituras condicionais

Leia apenas o que a fase exige:

- `references/analysis-playbook.md` — eixos, gates e checklist operacional.
- `references/architecture-lens.md` — C4-lite, regras, contratos e operação.
- `references/full-depth-contract.md` — cobertura mínima exigida no modo `full`.
- `references/backend-lens.md` — módulos, controllers, serviços, persistência e testes.
- `references/backend-depth-contract.md` — profundidade obrigatória do backend no modo `full`.
- `references/diagram-lens.md` — Mermaid verificável para arquitetura e fluxos.
- `references/frontend-lens.md` — rotas, componentes, estado, XSS e build.
- `references/sql-lens.md` — migrações, schema, queries e dados sensíveis.
- `references/security-review-lens.md` — categorias, classificação e evidência.
- `references/standards-and-versions.md` — fontes e versões congeladas.
- `references/handoff-to-pentest.md` — quando e como entregar validação real.
- `assets/report-template.md` e `assets/evidence-card.md` — saída esperada.

## Saturação e saída

Uma subquestão fecha em um de três estados: evidência local com
`arquivo:linha`, fonte oficial com URL e data da consulta, ou inferência
rotulada com alvo concreto de verificação. Se nenhum dos três aconteceu,
continue buscando ou declare explicitamente a limitação.

O relatório final não termina em lista de alertas: ele traz resumo, escopo,
método, mapa de contexto, achados classificados, priorização, lacunas,
handoffs, fontes versionadas e o resultado da validação executada.

## Verificação manual

Use `TESTING.md`. Antes de dizer que a skill está pronta, rode:

```bash
node scripts/check-package.mjs
node scripts/validate-evidence.mjs fixtures/report-valid.md
node scripts/validate-evidence.mjs fixtures/report-invalid.md --expect-fail
node scripts/validate-evidence.mjs fixtures/report-shallow.md --expect-fail
```

## Arquivos do pacote

`SKILL.md` · `assets/codebase-analysis-contract.md` ·
`assets/report-template.md` · `assets/evidence-card.md` · `references/` ·
`scripts/` · `fixtures/` · `evals/evals.json` · `TESTING.md`.

Todos viajam juntos. Não copie apenas o `SKILL.md` para outro projeto.
