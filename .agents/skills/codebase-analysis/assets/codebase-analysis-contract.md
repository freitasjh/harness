# Contrato interno da skill codebase-analysis

Este é o contrato do pacote. Ele não é uma regra always-on e não substitui
`assets/deepsearch-rule.md` nem `assets/pentest-rule.md`. Agentes desta skill
referenciam este arquivo; não o duplicam em `AGENTS.md`, steering ou hooks.

- Todo pedido começa com alvo, modo, inclusões e exclusão registrados. Sem alvo
  ou sem modo, pare e pergunte antes de ler em profundidade.
- Toda conclusão sobre o repositório cita `arquivo:linha`. Toda afirmação
  externa cita URL e data da consulta. Recomendação que vai virar código e
  depende de fonte externa usa `deepsearch`.
- Mesmo uma análise focada reconstrói o contexto mínimo: regras, mapa do repo,
  entry points, contratos, dados, testes e CI.
- Separe observação, interpretação e recomendação. Nunca apresente dedução
  como se tivesse sido lida no código.
- Segurança é estática: classifique como `suspeito`, `fraca confirmada em
  código` ou `requer runtime`. Somente evidência de runtime autorizado pode
  sustentar “vulnerabilidade confirmada”, via fluxo `pentest`.
- Não escreva payload, comando de exploração, segredo, token ou PII no
  relatório. Registre local e impacto mascarado.
- Relatório só está pronto com limitações, lacunas, handoffs e validação
  executada. Sem validação, diga que não foi validado.
- Se uma subquestão não fecha com evidência local, fonte oficial ou inferência
  rotulada com alvo de verificação, ela permanece aberta.
- No modo `full`, backend, frontend e SQL/dados têm seções próprias, matriz de
  cobertura e evidência por camada. Regras e governança não substituem leitura
  de código.

Este arquivo é a única descrição destas regras dentro do pacote.
