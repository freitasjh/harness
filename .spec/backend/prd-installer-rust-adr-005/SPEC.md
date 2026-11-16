# SPEC — prd-installer-rust-adr-005

> Prescritivo. Origem: ADR-005 §2/§3 (16 itens). Em conflito, o ADR prevalece. Classificação: **Refactor de distribuição** (P0→P1 aprovado 2026-11-16).

## 0. Score do spec-gate
Ver `GATE-SPEC.md`. Alvo 100%.

## 1. Requisitos funcionais
- **RF-01 (1)** — wrapper expõe o binário via `bin` no `package.json`; shim JS é localizador/lançador, **não motor** (não implementa init/doctor/upgrade, não grava).
- **RF-02 (2)** — `optionalDependencies` por `os`/`cpu`/`libc`; versão de cada pacote de plataforma acompanha o wrapper, definida no SDD (não fixada no ADR).
- **RF-03 (3)** — destino sem toolchain Rust: nenhum script `install`/`postinstall` compila; prova em PATH sem `cargo`/`rustc` (D7).
- **RF-04 (4)** — fallback quando tripla não casa: stderr com tripla detectada + matriz de alvos + ação corretiva, **exit 1**, sem download, sem cargo, sem `node install.mjs`; `stdout` sem envelope (falha de distribuição ≠ protocolo, que usa exit 2).
- **RF-05 (5)** — nenhum segundo motor no caminho de instalação: Node é runtime de hospedagem; shim só localiza; `apply` só no binário.
- **RF-06 (6)** — `install.mjs` legado **não é entrypoint nem embarcado**: `find node_modules/harness-installer -name install.mjs` = vazio; no repo permanece só como oráculo `c63e333` em worktree `detach`, fora do caminho de instalação.
- **RF-07 (7)** — 12 presets inalterados (D5); nenhum preset novo para distribuição.
- **RF-08 (8)** — `commands.suiteFull` byte-idêntico (4 etapas); `git diff --exit-code -- harness.config.json` vazio.
- **RF-09 (9)** — selo `c904f1c5…` e `unit=daba8c5…` byte-idênticos; `grep -cE 'cargo|rust' harness.config.json` = 0; **não republicar** selo.
- **RF-10 (10)** — cobertura Rust em comandos paralelos **fora** da contraprova selada (D6, custo aceito); garantia de não-regressão = oráculo externo ADR-002, não o selo.
- **RF-11 (11)** — `contract-v1` não muda: `stdout` envelope único, `stderr` progresso, exit 0/1/2; nenhum campo/op/código/marcador alterado (drift ⇒ §16).
- **RF-12 (12)** — rede-zero no caminho de instalação: nenhum `postinstall` faz download; fallback não baixa binário (V15).
- **RF-13 (13)** — oráculo fora do caminho de instalação: `git merge-base --is-ancestor c63e333 HEAD` = 0; worktree `detach` com SHA + porcelania.
- **RF-14 (14)** — `engines: {node: ">=20"}` declarado no wrapper.
- **RF-15 (15)** — ledger 1:1 (`PASS ADR-01`/`ADR-02`, sequência 1-2-3-4-5, 1 `in-progress`); PR humano.
- **RF-16 (16)** — nenhum crate/versão/toolchain pinado neste ADR (campos npm de S12 não são pin de crate); escolha no SDD com fonte.

## 2. Invariantes
- **I1** — motor único: binário Rust via `contract-v1`; shim/Node = hospedagem.
- **I2** — selo `c904f1c5` byte-idêntico; Rust nunca dentro da contraprova.
- **I3** — `install.mjs` nunca no caminho de instalação; só oráculo externo.
- **I4** — 12 presets, contrato e telas inalterados; nenhum valor novo para acomodar empacotamento.
- **I5** — rede-zero no install; fallback sem download; stderr claro + exit 1.

## 3. Edge cases
- E1 — tripla sem pacote compatível ⇒ fallback, não fallback para `.mjs`.
- E2 — script de build no `package.json` ⇒ reprova (exige Rust no destino).
- E3 — adotante com cargo instalado: permitido, mas a instalação não pode depender dele.
- E4 — `os`/`cpu`/`libc` mal declarados ⇒ npm instala pacote errado; matriz congelada no SDD.

## 4. Estratégia de teste
| Nível | Comando | Esperado |
|---|---|---|
| Pacote | `find node_modules/harness-installer -name install.mjs` | vazio |
| D7 | PATH sem cargo/rustc + `contract-v1` | envelope v:1 |
| Selo | `sealCommands(commands)` | `c904f1c5…` / `daba8c5…` |
| Rust | `cargo test` paralelo | 0 falhas, fora do selo |
| Suítes | 5 suítes | 0 falhas |

## 5. N/A declarado (spec-gate)
- **DDD api/impl/public** — `N/A — distribuição/pacote npm, não camada Java`.
- **Segurança/IAM** — `N/A — publicação de pacote, sem autenticação HTTP no harness; segredo em stdin sem eco (ADR-001)`.
- **ERD** — `N/A — nenhuma entidade persistida nova`.
- **Event Registry** — `N/A — contrato síncrono por subprocesso`.
- **Migrations** — `N/A — não-Java`.
