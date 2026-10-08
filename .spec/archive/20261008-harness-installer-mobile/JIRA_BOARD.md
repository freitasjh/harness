# JIRA Board — harness-installer-mobile

**EPIC:** IM — Instalação do harness em projetos mobile (Flutter/Dart) + wizard interativo
**Tipo:** Feature · **Fase:** Planning · **Progresso:** 14/14

| Key | Título | Batch | Camada | Dep. | Status |
|---|---|---|---|---|---|
| IM-BE-01 | STACK_PROFILES + generateConfig lookup | 1 | BE | — | DONE |
| IM-BE-02 | validateAnswer stack flutter/dart | 1 | BE | — | DONE |
| IM-BE-03 | collectIncoming filtra por stack (A4) | 1 | BE | — | DONE |
| IM-BE-04 | merge aditivo do bloco mcp (A3) | 1 | BE | — | DONE |
| IM-VAL-01 | Golden retrocompat (I7) | 1 | VAL | P-01 | DONE |
| IM-BE-05 | scripts/vendor-skills.mjs + --check | 2 | BE | — | DONE |
| IM-BE-06 | Política de licença (G2/S2) | 2 | BE | P-02 | DONE |
| IM-VAL-02 | Vendor 22 skills + lock + NOTICE | 2 | VAL | IM-BE-05,06 | DONE |
| IM-VAL-03 | Check estático V15 rede | 2 | VAL | — | DONE |
| IM-VAL-04 | Revisão conteúdo vendor (S1) + symlink (S4) | 2 | VAL | IM-BE-05 | DONE |
| IM-BE-07 | runWizard W0..W7 + detect() | 3 | BE | B1 | DONE |
| IM-VAL-05 | Testes de estado do wizard | 3 | VAL | IM-BE-07 | DONE |
| IM-DOC-01 | SKILL.md + README (RF-17) | 4 | DOC | B1-B3 | DONE |
| IM-VAL-06 | Dogfood cópia Flutter /tmp | 4 | VAL | B1-B3 | DONE |

## Pré-condições (bloqueiam)
- **P-01** congelar baseline da suite (G1)
- **P-02** política de licença (G2/S2) — decisão do usuário

## Legenda
TODO · DOING · BLOCKED · DONE
