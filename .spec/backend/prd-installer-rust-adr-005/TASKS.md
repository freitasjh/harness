# TASKS — prd-installer-rust-adr-005

> 7 microtasks. Teste ANTES do código. Base `d4e9924`. Selo `c904f1c5` invariante.

### PUB-01 — Wrapper package.json (bin, optionalDependencies, engines)
- **RF**: 01, 02, 14 · **P0** · **Risco Médio**
- **Arquivos**: `packaging/wrapper/package.json` (novo)
- **Teste primeiro**: `bin` aponta ao shim; `optionalDependencies` com os/cpu/libc; `engines.node = ">=20"`; **nenhum script de build/install/postinstall**.
- **BDD**: sucesso = campos S12 declarados e versão das deps acompanha wrapper; falha = script de compilação; borda = versão definida no SDD, não pinada no ADR.
- **DoD**: `grep -cE 'cargo build|rustc |npm run build' package.json` = 0.

### PUB-02 — Shim JS localizador (não motor)
- **RF**: 01, 05, 11 · **P0** · **Risco Alto**
- **Arquivos**: `packaging/wrapper/shim.mjs` (novo)
- **Teste primeiro**: shim resolve o pacote da plataforma e lança subprocesso; **não** implementa init/doctor/upgrade, não grava, não decide; stdin→binário, stdout envelope único, stderr progresso, exit 0/1/2 repassados.
- **BDD**: sucesso = `contract-v1` byte-a-byte; falha = shim manipulando envelope ou gravando; borda = detecção de libc por sinal do runtime (`process.report`), não execução cega.
- **DoD**: `prova(op)` pelo shim idêntica ao binário direto; nenhuma `apply`/`fs::write` no shim.

### PUB-03 — Pacotes de plataforma (matriz os/cpu/libc)
- **RF**: 02, 06, 12, 16 · **P0** · **Risco Médio**
- **Arquivos**: `packaging/platforms/*/package.json`, `packaging/platforms/README.md`
- **Teste primeiro**: cada pacote declara `os`/`cpu`/`libc`, `files` só o binário, `bin` próprio; npm ignora silenciosamente triplas que não casam; nenhum `install.mjs` embarcado; nenhum download.
- **BDD**: sucesso = matriz cobre alvos publicados; falha = binário de plataforma errada instalado; borda = glibc vs musl.
- **DoD**: `find packaging -name install.mjs` = vazio; nenhum `postinstall` com download.

### PUB-04 — Fallback tripla não casa + prova D7
- **RF**: 03, 04, 12 · **P0** · **Risco Alto**
- **Arquivos**: `packaging/wrapper/shim.mjs` (fallback), `packaging/README.md`
- **Teste primeiro**: remover pacote de plataforma ⇒ stderr com (a) tripla detectada, (b) matriz de alvos, (c) ação corretiva, **exit 1**, stdout sem envelope; **não** baixa, **não** invoca cargo, **não** cai para `node install.mjs`.
- **BDD**: sucesso = erro claro e exit 1; falha = download/cargo/`.mjs`; borda = adotante com cargo no PATH mas instalação não depende dele (E3).
- **DoD**: prova em PATH sem cargo/rustc, Node ≥ 20, envelope `v:1` lido.

### VAL-01 — Prova de runtime limpo (D7) e rede-zero
- **RF**: 03, 05, 11, 12 · **P0** · **Risco Alto** · VAL
- **Arquivos**: `harness/prd-installer-rust-adr-005.json`
- **Teste primeiro**: `command -v cargo || echo no cargo`, `rustc`, `node -v ≥ 20`; instalar wrapper; `printf REQ | harness-installer contract-v1` ⇒ envelope `v:1`; `grep cargo build|rustc` package.json = 0; V15 rede=0.
- **DoD**: 9 comandos reais com `stdoutHash:sha256:<64hex>` e `durationMsMeasured` honesto; rito ADR-002 reutilizado sem auto-assinatura.

### VAL-02 — Selo, oráculo e differential (RF-07..10,13)
- **RF**: 07, 08, 09, 10, 13 · **P0** · **Risco Alto** · VAL
- **Arquivos**: `harness/prd-installer-rust-adr-005.json`
- **Teste primeiro**: `sealCommands` = c904f1c5/daba8c5, 4 etapas, `git diff --exit-code` config/selos vazio, `grep -cE 'cargo|rust' harness.config.json`=0; 12 presets inalterados; `prova(op)` differential contra `c63e333` (garantia, não o selo); merge-base + worktree detach.
- **BDD**: sucesso = selo intacto + differential vazio; falha = selo republicado ou Rust na contraprova; borda = oráculo sujo ⇒ fail-closed.
- **DoD**: tabela 12 presets + differential por op; nenhum `12/12` como fato medido.

### VAL-03 — Ledger, 4 etapas, VERIFY
- **RF**: 15 · **P0** · **Médio** · VAL
- **Arquivos**: `harness/prd-installer-rust-adr-005.json`, `.spec/backend/prd-installer-rust-adr-005/VERIFY.md`
- **Teste primeiro**: `PASS PRD-01/ADR-01/ADR-02`, sequência 1-2-3-4-5, 1 `in-progress`; 4 etapas seladas 0 falhas; cargo paralelo 0; VERIFY 3 dimensões + segurança 14 itens.
- **DoD**: VERIFY 3/3; ponte D1 = 10 nomes; push não executado sem aprovação.

## Grafo
```mermaid
graph LR
  P01[PUB-01] --> P02[PUB-02] --> P03[PUB-03] --> P04[PUB-04] --> V01[VAL-01] --> V02[VAL-02] --> V03[VAL-03]
```

**Layer**: PUB 4 · VAL 3 · FE N/A (distribuição, sem tela).
