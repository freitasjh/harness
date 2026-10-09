# Tech Debt — dogfood escreve fora do /tmp via pai-symlink (P2)

- **Origem:** review FU-34/FU-35 (rodada final). Remoção está bloqueada; a ESCRITA não.
- **Gravidade:** P2 (nenhuma perda de dados comprovada; remoção é bloqueada por `classifyRemoval`)

## Problema
`assertDogfoodTarget` (`installer/install.mjs:698`) é **lexical** (`path.resolve` + prefixo `/tmp`).
Alvo como `/tmp/<link>/sub`, com `<link>` → fora do `/tmp`, passa a trava e o instalador **escreve**
fora da zona autorizada (a limpeza bloqueia, mas o writes já aconteceu).

## Correção
Trocar a validação para `realpathSync` do alvo (fallback: resolve) dentro do `os.tmpdir()` real,
mantendo o cheque lexical. Teste: alvo via pai-symlink ⇒ `OUTSIDE_TARGET`/abort.

## Dono
`developer-engineer` → `code-reviewer`. Não bloqueia uso atual (dogfood é teste manual/CI).

## Relacionado
- P2: poluidores pré-existentes de `/tmp` (`config-loader.spec.mjs:30`, `gate.spec.mjs:856/1008`,
  `network.spec.mjs:17`, `preflight.spec.md:18` → `.harness-backup-harness-in01-*`).
- P3: TOCTOU entre `classifyRemoval` e `rmSync` (benigno: `rmSync` não segue symlink).
- P3: `dogfood.mjs` não expõe `cleanup.blockedDetails`; `ok` ignora `cleanupError`.
