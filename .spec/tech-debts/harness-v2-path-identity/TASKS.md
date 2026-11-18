# Tech debt — identidade de path sob symlink (F1)

Status: registrado (2026-11-18) · Origem: parecer #5 do code review · Bloqueia F2: **não**
Atualização F2 (2026-11-18): **D1 e D2 fechados** e medidos no parecer do F2 (D1: 7 variantes de symlink, zero writes na recusa; D2: 8 variantes, nenhum manifesto na fonte). Resta **D3** (range de doc, entra em F8).

## Contexto

O 5º passe centralizou a escrita em `writeGuarded(root, rel, content)` (`scripts/harness-sync.mjs`), o que elimina a classe "escrita fora do guard" para conteúdo. Sobraram três casos da família **identidade de path quando o operador fornece caminho symlinkado**. Todos exigem input do operador e escrevem apenas conteúdo já conhecido do target.

## D1 — FECHADO no F2 — `assertSafeBackupDir` não inspecionava ancestral intermediário

- **Sintoma:** `--backup-dir /b/mid/link/sub` com `link` symlink e `sub` alcançável pelo elo ⇒ `update` exit 0 e o backup cai **dentro do target** (`.agents/inside-bk/…`), apesar do log imprimir caminho lexical "fora".
- **O que NÃO acontece:** fuga do guard — cada cópia passa por `assertSafeWrite` no root resolvido; nenhum byte sai da superfície validada.
- **O que quebra:** a invariante "backup fora do target" e a frase G6 ("a link anywhere in a chain aborts"), que fica mais larga que o mecanismo.
- **Fix sugerido:** `realpath` do ancestral existente mais fundo, continuar o walk a partir do canônico e comparar contenção contra `realpath(target)`.

## D2 — FECHADO no F2 — `assertNotSource` era lexical

- **Sintoma:** `--target` apontando para symlink do próprio checkout ⇒ `update` grava `.harness-manifest.json` **dentro da fonte**, exit 0.
- **Risco:** contamina o checkout do harness; o manifesto passa a descrever o próprio repo.
- **Fix sugerido:** comparar `realpath` quando o path existe (1 linha) e manter o fallback lexical para alvos inexistentes.

## D3 — range de doc

- `docs/FUNCIONAMENTO.md:112` cita `317-330` para o runner; o real é `316-334`. Cosmético.

## Critério de reativação

D1 e D2 foram fechados em F2 (`realpath` do ancestral mais fundo + contenção contra `realpath(target)`; `assertNotSource` por `realpath`). D3 entra na revisão de docs de F8.
