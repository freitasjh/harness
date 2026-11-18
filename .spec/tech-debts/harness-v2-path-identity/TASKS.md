# Tech debt — identidade de path sob symlink (F1)

Status: registrado (2026-11-18) · Origem: parecer #5 do code review · Bloqueia F2: **não**

## Contexto

O 5º passe centralizou a escrita em `writeGuarded(root, rel, content)` (`scripts/harness-sync.mjs`), o que elimina a classe "escrita fora do guard" para conteúdo. Sobraram três casos da família **identidade de path quando o operador fornece caminho symlinkado**. Todos exigem input do operador e escrevem apenas conteúdo já conhecido do target.

## D1 — `assertSafeBackupDir` não inspeciona ancestral intermediário

- **Sintoma:** `--backup-dir /b/mid/link/sub` com `link` symlink e `sub` alcançável pelo elo ⇒ `update` exit 0 e o backup cai **dentro do target** (`.agents/inside-bk/…`), apesar do log imprimir caminho lexical "fora".
- **O que NÃO acontece:** fuga do guard — cada cópia passa por `assertSafeWrite` no root resolvido; nenhum byte sai da superfície validada.
- **O que quebra:** a invariante "backup fora do target" e a frase G6 ("a link anywhere in a chain aborts"), que fica mais larga que o mecanismo.
- **Fix sugerido:** `realpath` do ancestral existente mais fundo, continuar o walk a partir do canônico e comparar contenção contra `realpath(target)`.

## D2 — `assertNotSource` é lexical

- **Sintoma:** `--target` apontando para symlink do próprio checkout ⇒ `update` grava `.harness-manifest.json` **dentro da fonte**, exit 0.
- **Risco:** contamina o checkout do harness; o manifesto passa a descrever o próprio repo.
- **Fix sugerido:** comparar `realpath` quando o path existe (1 linha) e manter o fallback lexical para alvos inexistentes.

## D3 — range de doc

- `docs/FUNCIONAMENTO.md:112` cita `317-330` para o runner; o real é `316-334`. Cosmético.

## Critério de reativação

D1 e D2 entram no começo de F2 (são baratos e o `harness-update` documentado em F2 é justamente o caminho que recebe `--target`/`--backup-dir` do operador). D3 entra junto com a revisão de docs de F8 se não for feito antes.
