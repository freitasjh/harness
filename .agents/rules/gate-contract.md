# gate-contract — índice de negações

Fonte canônica: .agents/skills/harness-workflow/SKILL.md e mecanismo em .opencode/plugins/gate.js.
Prosa descreve; runtime nega. Nenhuma linha deste índice bloqueia tool.

| ID | Negação | Mecanismo |
|---|---|---|
| I13 | task ou escrita sensível sem papel conhecido | gateAgentIdentity / resolveSessionAgent |
| I1 | task sem PICCO válido | gatePiccoTask / checkPicco |
| I2 | Completed sem evidência ou contraprova divergente | gateCompletionAnchorA / checkAnchorB / runContraprova |
| I5 | escrita fora do escopo do papel | checkWriteAccess |
| I6 | 3º task sem turno humano | gateHitlBatch |
| I8 | DenyError nega; erro inesperado fail-open | decide |
| I9 | path protegido sem trailer | CI harness-integrity |
| I10 | segredo no motivo da negação | sanitização em gate.js |
| I11 | sessão → agente | recordSessionAgent / deriveAgent |
| I12 | ordem config → selo → gate | runGatesShim |

Níveis: runtime, parcial/CI, processo, declarado-aberto. Não prometer mais do que o mecanismo sustenta.
