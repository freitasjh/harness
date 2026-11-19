# Sync — detalhe operacional

`node scripts/harness-sync.mjs <init|update|doctor> --target <dir> [--dry-run]
[--suite <cmd>] [--unit <cmd>] [--backup-dir <dir>]`. Três verbos, nenhum
wizard, nenhum perfil de stack, nenhuma rede (`node:fs`/`node:path`/
`node:crypto` e `git rev-parse` local).

## Verbos

| Verbo | Efeito | Recusa / preservação |
|---|---|---|
| `init --target <dir>` | copia o payload (`.agents/{agents,rules,skills,schemas}`, `.opencode/{plugins,commands}`, `scripts/harness-sync.mjs`, `scripts/seal.mjs`, `opencode.json`), gera `harness.config.json` e o manifesto | recusa alvo que já tem estado do harness (`.agents/`, `.agents/skills/`, `.opencode/plugins/`, `.opencode/commands/`, manifesto) e manda usar `update`; recusa config sem `commands.suiteFull` — passe `--suite <cmd>` |
| `update --target <dir>` | backup e grava só `{p : sha256(destino) ≠ sha256(fonte)}` | nunca sobrescreve `harness.config.json`, `workflow-state.json`, `.agents/rules/project-*.md` nem `.spec/**`; não apaga nada: órfão sai como `orphan <path> (não removido)` e sobrevive às regravações do manifesto; manifesto ausente/divergente é recriado |
| `doctor --target <dir>` | somente leitura: re-hasha cada arquivo do manifesto e valida camadas/config | exit 1 lista cada `FAIL <o quê>: <path>`; brain em commit diferente do pin é WARN, nunca FAIL |

## Determinismo e segurança de escrita

- `writeGuarded` é a **única** via de escrita: contenção lexical + `lstat`
  componente a componente + replace atômico (`writeAtomic`, privado). O manifesto
  é gravado por último; a 2ª `update` com payload idêntico faz 0 writes.
- Backup fora do alvo: `<parent do target>/.harness-backup/<nome>-<timestamp>/`
  (D2=A), ou `--backup-dir`. O destino do backup é verificado pelo ancestral
  existente mais fundo e por identidade (`realpath`) contra o alvo — um link
  que resolve para dentro do alvo é recusado.
- `--target` symlink para o próprio checkout é recusado por `assertNotSource`
  (`realpath`, não string), para não gerar manifesto dentro da fonte.
- `init --dry-run` e `update --dry-run` rodam os mesmos guards do apply: não
  exibem plano que a aplicação recusaria.

## Detecção e selo

`targets`/`commands` são detectados, nunca perguntados: `pom.xml` ⇒ `java` +
`mvn test`; `Cargo.toml` ⇒ `rust` + `cargo test`; `package.json` com `react`/
`vue` ⇒ frontend e, com `scripts.test`, `npm test`; `@nestjs/core` ⇒ `nestjs`;
`express`/`fastify` ⇒ `node`. `--suite`/`--unit` sobrepõem a detecção.

O selo cobre **todas** as chaves de `commands` (`sealCommands`), não só
`suiteFull`. Depois de mudar um comando canônico, reexporte no host:

```sh
eval "$(node scripts/seal.mjs --env)"
```

O gate de Completed compara o selo publicado com o config; divergência é deny
`sealed-command-mismatch` antes de qualquer re-execução.

## Comandos do operador

`.opencode/commands/` é payload. Após o `init`, existem no destino
`/harness-init`, `/harness-update`, `/harness-doctor` (plano → confirmação →
aplica → doctor) e `/ui-bootstrap`, `/ui-audit`, `/ui-review` (Storybook/
tokens/a11y; os dois últimos são somente leitura de código-fonte). Cada comando tem no máximo 40 linhas; o contrato é
medido por `scripts/__tests__/commands.spec.mjs`.

A cobertura de testes do sincronizador está em `scripts/__tests__/sync.spec.mjs`
(init/update/doctor, G1..G10, N1..N9, I1, NET-01 de rede-zero) e
`scripts/__tests__/commands.spec.mjs`.
