# Tech debt — CDL e inventário por eixo removidos na v2/F1

Status: registrado (2026-11-18) · Origem: code review do F1 (`C2`) · Dono da decisão: orquestrador

## O que foi perdido

No F1 foram apagados `.opencode/plugins/lib/cdl/` e `.opencode/plugins/lib/inventory/` junto com o instalador. O parecer do code review mostrou que a declaração original ("os checks perderam o sujeito") subdeclarava a perda:

| Check | O que media de fato | Número no baseline v1 |
|---|---|---|
| V20 (CDL) | prosa viva `.md` repo-wide, régua de 4 vereditos, `prohibition-cited`, dívidas pinadas | população 223 arquivos / 30.373 linhas no momento da remoção; baseline 96 no pico (`47c906b`), zerada por ADR-002/003/005, **0** em `381b5e0` (tag v1.0) e **0** na remoção; `prohibition-cited=27` |
| V19 (inventário) | roster (`opencode.json` ↔ diretórios com `AGENT.md`/`PROMPT.md`), citação por token, vendor lock, além do inventário por eixo | skills 47, rules 8, agents 10/10 |

O único pedaço que dependia do instalador era o **vocabulário de eixo** (`contract-registry.mjs`). O resto media o repositório, não o instalador.

## Decisão (D1=A)

Não reintroduzir os 2.600 linhas na v2. Em vez disso:

1. **Mitigado agora (F1-fix):** `checkRosterParity` (`V21`) em `scripts/static-checks.mjs` repõe a metade barata e bidirecional — registro em `opencode.json` ↔ diretórios de `.agents/agents` com `AGENT.md`/`PROMPT.md`.
2. **Adiado (este débito):** régua de prosa (4 vereditos + `prohibition-cited`) e citação por token não voltam na v2.0.

## Consequência declarada

Sem V20, nenhuma checagem mede identidade de projeto alheio em skills/rules/agents (o defeito "Hive" citado no README). A suíte fica verde sem essa régua — perda conhecida, não silenciosa.

Correção de número (re-review #2): a dívida de 96 entradas era **pico histórico** (`47c906b`), já zerada por ADR-002/003/005 antes da remoção. O que se perdeu não é a dívida — é o **instrumento que a media e que impediria nova dívida**.

## Critério de reativação

Reintroduzir uma versão local (sem `installer/`) quando ocorrer qualquer um:

- v2.1 ou primeiro PRD que altere `.agents/skills/**` ou `.agents/rules/**` em massa;
- incidente de regra copiada de outro projeto;
- PRD-4/PRD-5 (stacks e design system) voltarem ao roadmap.

Formato sugerido: módulo em `.opencode/plugins/lib/prose/` com vocabulário local, ~200 linhas, população = `*.md` vivo, sem import de instalador.
