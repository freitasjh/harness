# Template PICCO — Rota B

Bloco efêmero: chat + prompt de delegação, nunca arquivo. Premissa não
confirmada que sobrou do estoque vai para o ledger da conversa.

```xml
<role>[critério de comportamento, não persona]</role>

<task>[E1] em [E3].</task>

<context>
  Projeto: [projeto ativo — citar arquivo:linha ou brain path]
  Escopo: [o que entra e o que NÃO entra]
  Tipo de rota: [E6]
  Fornecido pelo usuário: [lista do que foi afirmado, sem dedução]
</context>

<constraints>
  Sempre: [positivos]
  Sempre: [positivos]
  Nunca: [violações que esta demanda arrisca]
</constraints>

<acceptance>
  [E5 — comando/verificação observável, não adjetivo]
</acceptance>

<delivery>
  agent: [agente responsável]
  phase: [P0..P6]
  skills: [skills em ordem]
  inputs: [paths/artefatos de entrada]
  write_scope: [onde pode escrever]
  outputs: [artefatos de saída]
  evidence_path: [harness/<demand>.json ou n/a]
  handoff_schema: [references/handoff-schema.md]
  stop_condition: [quando parar e pedir HITL]
</delivery>

<open_questions>
  <!-- Rota B: vazio -->
</open_questions>
```

Regras:

- `<role>` é critério de comportamento; nunca “Você é especialista em X”.
- `<task>` é o que muda no mundo, não a lista de passos.
- Escopo entra em `<context>`, não em `<task>`.
- `<context>` cita toda afirmação que não veio literalmente do usuário.
- `constraints`: ≤10 linhas, positivas antes das negativas.
- `<acceptance>` contém comando, asserção ou evidência observável.
- `<open_questions>` fica vazio na Rota B.
- Nunca escrever nem sugerir “pense passo a passo”.
