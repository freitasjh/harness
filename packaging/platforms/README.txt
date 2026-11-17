# Pacotes de plataforma — ADR-005 / PUB-03

Cada diretório é um pacote npm de **um** alvo. O wrapper (`../wrapper/package.json`)
os declara em `optionalDependencies`: o npm instala só o que casa com o host e
ignora silenciosamente o resto (S12). Nenhum pacote compila, baixa ou grava.

| Alvo | Pacote | os | cpu | libc |
|---|---|---|---|---|
| linux-x64-gnu | `@harness/installer-linux-x64-gnu` | linux | x64 | glibc |
| linux-x64-musl | `@harness/installer-linux-x64-musl` | linux | x64 | musl |
| darwin-arm64 | `@harness/installer-darwin-arm64` | darwin | arm64 | glibc |

## Contrato de forma

- `version` = `1.0.0`, a mesma do wrapper; nenhuma versão é fixada pelo ADR.
- `files` contém **só** `bin/harness-installer`. O binário é autocontido: traz o
  runtime Rust, sem `cargo`/`rustc`/fontes no destino (D7).
- `bin` é próprio de cada pacote (`harness-installer-<alvo>` → `bin/harness-installer`).
  O nome é distinto do `bin` do wrapper (`harness-installer`) de propósito:
  colisão de nomes em `node_modules/.bin` faria o npm linkar o binário cru e
  bypassar o shim, matando o fallback da ADR-005 §2.2. O shim lê a entrada
  `bin` do manifesto resolvido e lança o arquivo como subprocesso.
- `engines.node = ">=20"` — runtime de hospedagem, não toolchain de build.
- `exports["./package.json"] = "./package.json"` (FU-ADR005-02). O shim chama
  `require.resolve(`${name}/package.json`)`; sem essa entrada o resolve cai em
  fallback **falso** mesmo com a tripla correta. O teste
  `packaging/platforms/__tests__/platforms.spec.mjs` prova os dois lados: resolve
  com `exports` e `ERR_PACKAGE_PATH_NOT_EXPORTED` sem ele.
- Em darwin o npm não aplica o filtro de `libc` (o campo só é consultado em
  Linux); o valor é mantido para uniformidade da matriz congelada, não para
  distinguir builds.
- **Sem build e sem compilação**: não há `scripts`, `postinstall`, `install.mjs`,
  `cargo build` ou download em nenhum manifesto. O binário entra no pacote pela
  etapa de publicação, fora do caminho de instalação do adotante (ADR-005 §2.3).

`find packaging -name install.mjs` ⇒ vazio.
