# VERIFY — prd-installer-rust-adr-005 (batch 3, VAL-02 + VAL-03)

> Data 2026-11-17. Branch `adr/prd-installer-rust/05-publicacao-runtime-selo-impl`. HEAD de medição `6dd87e7` (commit de estado "iniciar batch 3"); SHA do commit desta entrega registrado no retorno ao orquestrador. Evidência: `harness/prd-installer-rust-adr-005.json` (32 comandos reais, hashes/durações medidos, tabela differential 23 ops).

## 1. Completeness — ✅ PASS

| Item | Medição |
|---|---|
| Tasks | VAL-02, VAL-03 entregues; 7/7 tasks do ADR-005 DONE; JIRA_BOARD 7/7 DONE |
| Selo | `sealCommands` ⇒ `suiteFull=c904f1c5…`, `unit=daba8c5…`; 4 etapas; `git diff --exit-code` config+seal vazio (0 B); `grep -cE 'cargo\|rust' harness.config.json = 0` |
| 12 presets | `STACK_VALUES` + `STACK_PROFILES` lidos do oráculo `c63e333` em worktree `detach` e do HEAD: 12/12 idênticos, `namesHash=sha256:e1a24dee…` igual; 0 preset novo |
| Oráculo | `git merge-base --is-ancestor c63e333 HEAD` ⇒ exit 0; worktree `detach` com SHA cheio + `status --porcelain` vazio antes de **cada** prova (`checkOracle`) |
| Differential | `prova(op)` 23/23 `ok`, mutação 1 byte por op (23/23), mutante exit-preserving **0 provado / 23 reprovado**, `zeroWrites=true`, `frozenUnchanged=true` |
| `--run-parity` | SI-1..SI-6 `status:medido`, `pass:true`; `literalProven:true` |
| Suítes | plugins 540/540 · installer 716/716 · static 13 PASS/0 FAIL · vendor OK · suiteFull concatenado exit 0 · cargo 85/85 (paralelo, fora do selo) |
| Ledger | `PASS PRD-01`/`ADR-01`/`ADR-02`; sequência 1-2-3-4-5; 1 `in-progress` (ADR-005); 5 `ADR.md` no disco |
| TODO/STUB | zero no escopo do batch |

## 2. Correctness — ✅ PASS

| Dimensão | Evidência |
|---|---|
| Selo byte-idêntico | `c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2` / `daba8c5465bffe061738235b274c497a4e8e761e41c5e79d4c671a72231cffc7` re-derivados, **não republicados**; `HARNESS_SEAL_JSON` inalterado; nenhuma etapa Rust em `commands.suiteFull` |
| Differential real | 23 ops D-ENGINE, `sideShaOracle == sideShaBin` por op (tabela no REPORT); gate `result/ok/exit-code` (VAL-02), não só `result\|error`; mutante exit-preserving corrompe 100% dos envelopes e reprova 23/23 no **mesmo** `prova()` — differential não é vácuo |
| 12/12 nunca fato | medição = 9 byte-equal + 2 partial; `measurement.claimed12of12=false`. Nenhum "12/12" publicado como fato medido |
| Custo D6 | Rust (`cargo test` + differential) em comandos paralelos, explicitamente **fora** de `commands.suiteFull` e `HARNESS_SEAL_JSON`; a garantia de não-regressão do binário é o oráculo externo (ADR-002), não o selo |
| Rito ADR-002 | literal `9fa4530b…` reutilizado do `harness/prd-installer-rust-adr-002.json`; sha256 do **arquivo** `installer/__tests__/oracle-literal.sha256` confere; **nenhum** `Veredito: validated literal` escrito por este agente |
| FU-ADR005-03 | seleção real `os`/`cpu`/`libc` via `optionalDependencies` exercitada no D7 (npm instalou 1 de 3 pacotes; `namesHash`/lock conferem); registry local (verdaccio) fora de escopo — exigiria ferramenta/comando novos + endpoint HTTP, contra rede-zero (§5) |

## 3. Coherence — ✅ PASS

| Invariante | Resultado |
|---|---|
| I1 — motor único | shim localiza/lança; binário Rust é o único motor via `contract-v1`; nenhum `init`/`doctor`/`upgrade` no shim |
| I2 — selo intacto | c904f1c5 byte-idêntico; Rust nunca dentro da contraprova |
| I3 — `install.mjs` fora | `find packaging -name install.mjs` vazio; só oráculo `c63e333` em worktree `detach` |
| I4 — 12 presets/contrato/telas | 12/12 contra oráculo; nenhum preset/op/chave/código/tela novo |
| I5 — rede-zero | fallback sem download; V15 rede em `installer/=0`; nenhum `postinstall`/build |
| Ponte D1 | **10 nomes D-ENGINE intactos** (`runCli, runDoctor, runInit, runUpgrade, runWizard, collectAnswers, generateConfig, planMerge, runChecks, main`); `FU-D1-ENGINE10` com decisão owner pendente — não alterado |
| Arquitetura | nenhum crate/versão/toolchain/`Cargo.toml` decidido; nenhum path protegido tocado |

## Segurança — Fase 4 (14 itens)

Checklist zero-tolerance da skill `security-review`: **3 aplicáveis PASS + 11 N/A motivados = 14**.

**Aplicáveis PASS (3):**
- **A03 injection** — `contract-v1` valida stdin; nenhuma concatenação em query (sem SQL).
- **A08 integrity** — `Cargo.lock` + `.vendor-lock.json` congelados; differential 23/23 contra oráculo, mutante reprovado.
- **A05/A06 misconfig/deps** — V15 rede em `installer/=0`; nenhuma dependência nova; nenhum script `build`/`postinstall`.

**N/A motivados (11):**
| # | Item | Motivo |
|---|---|---|
| 1 | A01 broken access control | CLI local, sem endpoint HTTP/auth |
| 2 | A02 cryptographic failures | sem JWT/senha/TLS no caminho de instalação |
| 3 | A04 insecure design / rate limiting | sem servidor, sem entrada remota |
| 4 | A07 auth failures | sem sessão/token |
| 5 | A09 logging | segredo sem eco (ADR-001); nenhum log central em CLI |
| 6 | A10 SSRF | nenhuma URL buscada; rede-zero (V15=0) |
| 7 | Headers CSP/X-Content-Type | sem resposta HTTP |
| 8 | `v-html` não sanitizado | sem frontend/tela HTML |
| 9 | HTTPS/TLS 1.2+ | sem transporte de rede |
| 10 | Actuator/Swagger | sem framework web |
| 11 | mobile Keychain/Keystore | sem mobile |

🔴 críticos: **0** · 🟡 atenção: **0** · **Verdict: pass**.

## Rito ADR-002 (reutilizado, não auto-assinado)

Literal `9fa4530bbe0d431781a159cced28c011e1d94a8abea5ca1cc8465608976552f0` — sha256 do arquivo `installer/__tests__/oracle-literal.sha256` — verificado também por `isLiteralProven` via `--run-parity` e pelo `validationVerdict` do REPORT ADR-002. Veredito existente **reutilizado**; nenhuma assinatura nova escrita; nenhuma rubrica pendente neste batch.

## Limites declarados

- RELATÓRIO é evidência auto-declarada; prova = contraprova do gate reexecutando `commands.suiteFull` lido de `harness.config.json` (SPEC ADR-002).
- Differential/Rust fora do selo (D6); 23/23 é medição real, 12/12 nunca fato.
- RELATÓRIO-003 escrito pelo driver differential foi copiado para scratch e restaurado via `git checkout --` (fora do escopo do batch).
- Nenhum escrita em `gate.js`, `harness.config.json`, `seal.mjs`, `opencode.json`, `workflow-state.json`, ADRs/SPEC/PLAN/TASKS/rules.
- **Push não executado**; `npm publish` fora de escopo.

## Portões pendentes (fora deste papel)

- `code_review_status`: orquestrador delega `code-reviewer` após o commit.
- Override `D1-two-motors-restante` no `workflow-state.json`: **não alterado** — governança do orquestrador (10 D-ENGINE em `FU-D1-ENGINE10`).
- Promoção de ADR-005 a `merged` no `ADR-INDEX.md`: feita pelo orquestrador no merge humano do PR (último ADR — não há branch 06).
