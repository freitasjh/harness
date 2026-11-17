# Publicação do instalador — ADR-005 (PUB-03 / PUB-04 / VAL-01)

Topologia (ADR-005 §2.1):

```
adotante (Node >= 20, SEM cargo/rustc)
  npm install harness-installer
    wrapper/               package.json: bin -> shim.mjs, optionalDependencies por alvo
    platforms/<alvo>/      pacote com 1 binário autocontido (os/cpu/libc)
    wrapper/shim.mjs       localizador/lançador — NÃO é motor
      contract-v1          stdout=envelope único, stderr=progresso, exit 0/1/2
```

## Fallback quando a tripla não casa (FU-ADR005-01)

O npm trata dependência opcional ausente como "program's responsibility"
(S12). O shim não rebaixa isso para silêncio nem para um segundo motor:

- escreve em **stderr**: tripla detectada (`plataforma/arch/libc`), o cabeçalho
  literal `MATRIZ DE ALVOS PUBLICADOS` com os três alvos e `ACAO CORRETIVA`;
- termina com **exit 1** e `stdout` vazio — é falha de distribuição, não falha
  de protocolo (que usa exit 2);
- **não** baixa binário, **não** invoca `cargo`/`rustc`, **não** cai para
  `node install.mjs` e não tenta compilar.

A matriz impressa deriva da mesma constante usada para localizar o pacote, e o
teste `packaging/wrapper/__tests__/fallback.spec.mjs` confronta essa constante
com as `optionalDependencies` do wrapper — deriva entre as duas é reprovada.

## Prova D7 — runtime limpo

Com `PATH` sem `cargo`/`rustc` e Node >= 20, instalar o wrapper e exercitar
`printf REQ | harness-installer contract-v1`; o envelope lido tem `v:1` e
`ok` booleano. Comando de prova completo, hashes e tempos medidos:
`harness/prd-installer-rust-adr-005.json`.

## Invariantes

- selo `c904f1c5` byte-idêntico; `commands.suiteFull` com 4 etapas; suíte Rust
  roda em comandos paralelos, **fora** da contraprova selada (D6);
- 12 presets, `contract-v1`, 23 `op`s de engine e 8 de TUI inalterados; nenhum
  valor/preset/chave/op/código novo para acomodar empacotamento;
- nenhum `install.mjs` no caminho de instalação: no repo ele só existe como
  oráculo `c63e333` em worktree `detach`, fora do pacote.

## Testes

```sh
node --test packaging/wrapper/__tests__/*.spec.mjs
node --test packaging/platforms/__tests__/*.spec.mjs
node --test packaging/__tests__/*.spec.mjs
```
