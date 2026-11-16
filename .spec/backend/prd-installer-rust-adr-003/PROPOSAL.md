# PROPOSAL — prd-installer-rust-adr-003

> Ciclo SDD escopado do **ADR-003 do PRD-3** (motor `init`/`doctor`/`upgrade`).
> Fonte: `.spec/prd/prd-installer-rust/ADRs/ADR-003-motor-init-doctor-upgrade/ADR.md` (17 itens de interface congelada, §3; G2 aprovado).
> Classificação (P0→P1, owner 2026-11-16): **Refactor** — isento de `planner` (`.agents/rules/prd-adr-pipeline.md` §3, refactor sem comportamento observável).

## 1. Problema (medido)

| Fato | Número / fonte |
|---|---|
| `op`s de engine a migrar | **23**, nomes idênticos aos exports `D-ENGINE` (ADR-001 §5) |
| `op`s de TUI fora do escopo | **8** (ADR-004) |
| Entrypoints de paridade | **4**: `runInit`, `runDoctor`, `runUpgrade`, `runCli`/`main` |
| Motor legado | `install.mjs` **3.010 linhas**, **95 exports** (ADR-001 §1) |
| Ordem do `upgrade` | **duas** ordens medidas por entrypoint — uni-las é reescrita proibida (ADR §2.2) |
| Baseline de paridade | **9 byte-equal + 2 parciais**; `12/12` é meta re-derivável (ADR-002) |
| Oráculo | `c63e333…`, worktree `detach`, SHA + `status --porcelain` verificados |
| Selo | `c904f1c5…` — `commands.suiteFull` byte-idêntico; suíte Rust fora dele |
| Ponte temporária | `installer/installer-contract.mjs:15` (`export … from './install.mjs'`) expira no merge deste ADR |

**Defeito evitado:** fixar as 23 `op`s por intuição produz verde falso (a `op` existe no dispatcher, mas ninguém provou envelope/mensagem/`exitCode` iguais ao oráculo). O defeito simétrico — "corrigir" a ordem do `upgrade` ou promover o veredito do `doctor` a gate — muda comportamento congelado e quebra BF-02b/EX-BE-05.

## 2. Proposta

Implementar o motor como projeção de exatamente 23 `op`s sobre `contract-v1`, com nome igual ao export do oráculo, ordem operatória congelada (backup verificado antes de qualquer escrita, `apply` único ponto de escrita, `checks` depois do `apply`), cada mensagem e cada `exitCode` provados por `prova(op)` contra o Node `c63e333`, e vereditos congelados lidos como arquivos externos (rito do ADR-002). Crate/versão ficam para o SDD, escolhidos pelo critério de paridade observável do ADR §2.4 com fonte em `RESEARCH.md` S1/S2/S3 — o ADR não os decide.

## 3. Escopo

Os 17 itens de interface do ADR §3; as 23 `op`s da tabela §2.1; as duas ordens congeladas de §2.2; o rito de leitura de §2.3; o critério de crate de §2.4.

## 4. Não-escopo

8 `op`s de TUI e 10 telas (ADR-004) · publicação npm/runtime do adotante/selo (ADR-005) · procedimento SI-1..SI-6 e registry (ADR-002) · contrato `contract-v1`, 12 presets, selo, gate, `harness.config.json` (ADR-001/fechado).

## 5. Riscos (herdados do ADR §5)

| # | Risco | Mitigação |
|---|---|---|
| R1 | crate gera texto divergente de help/erro | critério §2.4.1: oráculo vence, nunca se edita expectativa |
| R2 | reescrita involuntária da ordem | tabela de falhas §2.2 + item 3 + `diff` contra `c63e333` |
| R3 | `flagged-open` virar merge automático | item 9 + Brain `merge-de-config-remocao-por-forma` |
| R4 | 2ª execução reescrever schema (mtime/inode) | `noop` por efeito, item 10 |
| R5 | cobertura Rust fora do selo | custo aceito no G2; comandos paralelos, `c904f1c5` intacto |
| R6 | veredito expirado sem rubrica nova | §2.3.6 + rito de ADR-002 §2.4 |

## 6. Verificação

17 itens com comando e oráculo; `prova(op)` para 23 `op`s; 5 suítes Node + suíte Rust em paralelo fora do selo; `literalProven: true` mantido; SI-2/SI-3 passam de `not_measured` a differential real.
