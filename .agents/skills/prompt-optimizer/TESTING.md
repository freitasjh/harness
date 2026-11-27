# Verificação manual do prompt-optimizer

Não há runner semântico: o modelo continua decidindo E1..E6. Os scripts abaixo
validam forma, gates e limites.

## Comandos

```bash
cd .agents/skills/prompt-optimizer
node scripts/check-package.mjs
node scripts/validate-output.mjs fixtures/output-rota-a-valid.md
node scripts/validate-output.mjs fixtures/output-rota-a-invalid.md --expect-fail
node scripts/validate-output.mjs fixtures/output-rota-b-valid.md
node scripts/validate-output.mjs fixtures/output-rota-b-invalid.md --expect-fail
python3 /home/joao/.codex/skills/.system/skill-creator/scripts/quick_validate.py .
```

Opcional: substitua o último comando pelo validador disponível no ambiente.

## Verificações

| # | Verificação | Critério |
|---|---|---|
| V1 | `fixtures/08-melhorar-cadastro.md` | Rota A, ≤3 perguntas, zero artefato |
| V2 | `fixtures/01-email-invalido.md` | Rota B, PICCO válido, 6/6, 1 confirmação |
| V3 | Brain indisponível | Limitação declarada, nenhum path inventado |
| V4 | Pacote portátil | Nenhuma referência obrigatória fora do pacote |
| V5 | Constraints do PICCO | ≤10, positivas primeiro, zero instrução de raciocínio |
| V6 | `output-rota-a-valid.md` | `validate-output.mjs` termina com 0 |
| V7 | `output-rota-a-invalid.md --expect-fail` | Falha por >3 perguntas, ordem errada, inferência em `Já entendi`, regra fraca e PICCO na Rota A |
| V8 | `output-rota-b-valid.md` | `validate-output.mjs` termina com 0 |
| V9 | `output-rota-b-invalid.md --expect-fail` | Falha por score, role persona, CoT, constraints >10, aceite vago e `open_questions` preenchido |
| V10 | `check-package.mjs` | Todos os checks estruturais passam |

## Critério de pronto

V6 a V10 passam e `quick_validate.py` (ou equivalente) reporta skill válida.
As verificações V1 a V5 continuam comportamentais e dependem de execução com
modelo; os scripts não as substituem.
