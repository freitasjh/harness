# SPEC — prd-installer-rust-adr-003

> Prescritivo. Origem: `ADR-003` §3 (17 itens de interface congelada), §2.1 (23 `op`s), §2.2 (ordens), §2.3 (rito de leitura), §2.4 (critério de crate). Em conflito, o ADR prevalece. Classificação: **Refactor** (P0→P1 aprovado pelo owner 2026-11-16).

## 0. Score do spec-gate

Ver relatório em `GATE-SPEC.md`. Resultado: **100% (6 aplicáveis atendidos; 5 `N/A` com motivo)**.

## 1. Requisitos funcionais

- **RF-01 (item 1)** — dispatcher expõe **exatamente 23** `op`s de engine, 1:1 com `D-ENGINE` (ADR-001 §5). Nenhuma `op` nova; `planUpgrade`/`applyUpgrade` permanecem internos (`grep -c` ⇒ 0 no dispatcher); 8 `op`s de TUI ficam de fora. 🟢 inventário · 🟡 SDD.
- **RF-02 (item 2)** — cada uma das 23 `op`s tem oráculo e comando de prova (ADR §2.1 tabela). `prova(op)` = `diff -u <(printf '%s\n' "$REQ_$op" | node "$ORACULO/installer/install.mjs") <(printf '%s\n' "$REQ_$op" | "$INSTALLER_BIN" contract-v1 | …result|error…)` ⇒ vazio, envelope `v:1`, `op` igual à solicitada. 🟢 specs · 🟡 differential.
- **RF-03 (item 3)** — ordem do `runUpgrade` preservada: `preflight` → manifesto → parse → schema → `runDoctor` (somente leitura, `report.verdict` **não** é gate) → `collectAnswers` → `collectIncoming`/`generateConfig` → `planUpgrade`/`printPlan` → [dry-run: retorno 0 writes] → `confirmByLayer` → `backup`+`requireVerifiedBackup` → `applyUpgrade` → `buildManifest`/`writeManifest` → `runChecks` → regrava manifesto → `exitCode`. Ordem do `main` distinta e também congelada (backup antes de planejar). Uni-las = reescrita proibida (BF-02b/EX-BE-05).
- **RF-04 (item 4)** — backup verificado antes de `apply`: `injectFailure` ⇒ `exit 1`, `BACKUP_FAIL`/`BACKUP_UNVERIFIED`, hash do destino idêntico (0 writes). `apply` é o único ponto de escrita de conteúdo.
- **RF-05 (item 5)** — dry-run ⇒ **0 writes**, sem backup, sem `confirm`, sem `checks`; `applied:false`, `backupDir:null`, `checks:{passed:null,ran:false,skipped:true}`, `exit 0`. Hash de árvore antes=depois (FU-28: `passed:null` nunca publicado como PASS).
- **RF-06 (item 6)** — `runDoctor` somente leitura, 7 marcadores D0..D6, vereditos `SAUDÁVEL`/`ATENÇÃO`/`QUEBRADO`, `exit 0/1` idênticos ao oráculo.
- **RF-07 (item 7)** — mensagem de erro 4 linhas (`[ERRO] …` / `  porquê: <code>` / `  como corrigir: …` / `  onde ver: …`) e vocabulário de códigos + `UNKNOWN` byte-equal ao oráculo. **Achado S3 (architect, sem reabertura do ADR):** o ADR afirma 23 códigos; medição direta de `install.mjs:1529-1535` ⇒ **22 códigos + `UNKNOWN`**. A autoridade é o oráculo e o `Set` dele; o número do ADR é herança registrada para rubrica futura (RFC pendente), nunca um valor a propagar no motor. `NOT_INSTALLED`/`MANIFEST_INVALID` medidos na fonte mapeiam para `UNKNOWN` no envelope — nenhum código novo.
- **RF-08 (item 8)** — textos de usage/help fixados: 9 linhas de `printUsage` e `--help` ⇒ `0`; sem `--target` ⇒ `1`; `diff` vazio contra o oráculo.
- **RF-09 (item 9)** — `init` create-only: destino sujo ⇒ `flagged-open`, `exit 1`, 0 writes, dica apontando `doctor`. `upgrade` com `flag` ⇒ `collisions`, **não** aborta. Merge de config por **forma**, nunca por nome de chave; npm do usuário preservado; only-add em `mcp`/`instructions` (Brain `merge-de-config-remocao-por-forma`, `merge-opencode-json-v2-only`).
- **RF-10 (item 10)** — merge v2-only T1..T8 e idempotência por efeito: 2ª execução de `upgrade` ⇒ `noop`, schema intacto em **conteúdo/mtime/inode** (BF-02b).
- **RF-11 (item 11)** — `exitCode` nos 4 call sites (`runInit`, `main`, `runCli --answers-file`, wizard TTY): `0` válido/dry-run, `1` reprovado, `2` **somente** erro de protocolo `contract-v1`. Nenhum `0` em silêncio (BF-03).
- **RF-12 (item 12)** — vereditos congelados **lidos como arquivos externos ao binário Rust**: `sha256` registrado no RELATÓRIO antes da 1ª comparação; extração por `grep`/`sed`, nunca por comando que regenere a partir de `$INSTALLER_BIN`/`contract-v1`/registry; `git diff --exit-code` vazio nos 8 arquivos durante o ciclo; differential só contra `c63e333`; `cargo insta review` é leitura, `.snap.new` nunca baseline; literal só com `Veredito: validated literal <sha256> <ISO-8601> <oráculo>` (rito ADR-002 §2.4).
- **RF-13 (item 13)** — número publicado é re-derivável: baseline escrito é `9 byte-equal + 2 parciais`, dry-run medido em 2 presets; `12/12` só após SI-1/SI-2/SI-3 nos 12 presets.
- **RF-14 (item 14)** — oráculo materializado por SHA cheio `c63e33307710e1c6271f5c68b2dd9fb15283f49c`, `status --porcelain` vazio **antes de cada** `prova(op)`.
- **RF-15 (item 15)** — `harness.config.json`, `commands.suiteFull`, `seal.mjs`, `HARNESS_SEAL_JSON` (`c904f1c5…`) byte-idênticos; suíte Rust e harness de paridade em **comandos paralelos fora do selo**; `node scripts/static-checks.mjs` exit 0 com `PASS PRD-01`/`PASS ADR-01`/`PASS ADR-02`.
- **RF-16 (item 16)** — ledger 1:1: `PASS ADR-01` (uma linha por `ADR.md`), `PASS ADR-02` (sequência 1-2-3, 1 `in-progress`, branch no padrão). PR humano.
- **RF-17 (item 17)** — crate/versão/toolchain **não** são decididos neste ciclo: escolha pelo critério do ADR §2.4 (`clap` derive/anyhow/thiserror recomendados em `RESEARCH.md` S1/S2/S3, `std::env::args` alternativa descartada), com fonte e `Cargo.toml` versionado. Sem fonte = SI-6.

## 2. Invariantes

- **I1 (entidade — manifesto)** — `manifestSchemaVersion === 1`, `source` conhecido, regravação sem mudar conteúdo/mtime/inode quando `noop`.
- **I2 (entidade — backup)** — nenhuma escrita de conteúdo sem `verified === true`; rollback é o diretório de backup verificado, nunca "limpeza" inventada.
- **I3 (workflow)** — duas ordens por entrypoint, preservadas; `doctor` reporta, nunca gate; `apply` é único ponto de escrita; `checks` depois do `apply`.
- **I4 (workflow)** — `exit 0/1` do oráculo; `2` exclusivo de protocolo; nenhum valor novo em códigos/presets/chaves/defaults.
- **I5 (segredo)** — segredo em `stdin`, sem eco em stdout/stderr/RELATÓRIO; nenhum token em arquivo de evidência.
- **I6 (oráculo)** — externo (anterior, imutável por escrita, legível sem Rust); derivado reprova mesmo verde; literal sem assinatura não conta como prova.

## 3. Edge cases

- E1 — 2ª execução de `upgrade` reescreve schema ⇒ quebra BF-02b; exigir `noop` por efeito.
- E2 — veredito `QUEBRADO` do `doctor` usado como gate ⇒ muda comportamento congelado (EX-BE-05).
- E3 — `flag` do `init` tratado como merge automático ⇒ destrói dados do usuário (remoção por forma).
- E4 — crate gera `--help` divergente ⇒ oráculo vence; nunca editar expectativa.
- E5 — `NOT_INSTALLED`/`MANIFEST_INVALID` promovidos a código de envelope ⇒ vocabulário novo proibido; mapear para `UNKNOWN`.
- E6 — oráculo materializado sem `status --porcelain` vazio ⇒ tautologia/falso positivo; fail-closed.

## 4. Estratégia de teste

| Nível | Comando | Esperado |
|---|---|---|
| Estrutural | `node scripts/static-checks.mjs` | exit 0, V18/V19/V20 estáveis, `PASS PRD-01/ADR-01/ADR-02` |
| SDD | `node scripts/sdd-checks.mjs` | 0 FAIL |
| Specs Node (oráculo) | `node --test installer/__tests__/{preflight,merge-manifest,merge-v2-only,doctor,checks,suite,installer-upgrade-regression,golden,eixos-stack,cli,wizard,parity-oracle}.spec.mjs` | verde; sources congeladas |
| Rust (paralelo, fora do selo) | `cargo test` no crate do motor | 0 falhas; nunca dentro de `suiteFull` |
| Differential | `prova(op)` × 23 + `runParity` com `literalProven:true` | `diff` vazio; SI-2/SI-3 deixam `not_measured` |
| Contraprova selada | `commands.suiteFull` | byte-idêntica a `c904f1c5…`, exit 0 |

## 5. N/A declarado (spec-gate)

- **DDD api/impl/public** — `N/A — motor Rust sob contract-v1; fronteira é o dispatcher de 23 ops, não camadas Java`.
- **Segurança/IAM `@HasPermission`** — `N/A — instalação local sem autenticação HTTP/API; modelo de segredo em I5 (stdin sem eco)`.
- **ERD** — `N/A — nenhuma entidade persistida nova; manifesto v1 e diretório de backup já existentes`.
- **Event Registry** — `N/A — comunicação por stdin/stdout/stderr (contract-v1), sem barramento de eventos`.
- **Migrations Flyway/Liquibase** — `N/A — não-Java; nenhuma migration`.
