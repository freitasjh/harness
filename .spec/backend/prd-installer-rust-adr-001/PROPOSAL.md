# PROPOSAL — prd-installer-rust-adr-001

> Ciclo SDD escopado do **ADR-001 do PRD-3** (fronteira de subprocesso e contrato `contract-v1`).
> Fonte: `.spec/prd/prd-installer-rust/ADRs/ADR-001-fronteira-subprocesso/ADR.md` (244 l., 13 itens, G2 aprovado).

## 1. Problema (medido)

| Fato | Número |
|---|---|
| exports de `install.mjs` | 95 — **75 importados por 22 consumidores**, 20 internos |
| grupos de consumidores | G-INJ 3 (6 mapas injetados) · G-DOGFOOD 2 · G-ORACLE-DATA 4 · G-CLI-TUI 13 |
| `gate.js` | 0 referências ao instalador |
| selo | `c904f1c5` — `commands.suiteFull` byte-idêntico |
| oráculo | `c63e333` em worktree `detach`, SHA verificado |

## 2. Proposta

Implementar a **fronteira** no lado dos consumidores: `installer/contract-registry.mjs` com os 6 mapas provados byte-a-byte contra o oráculo, adapters de subprocesso para os 4 grupos, e o contrato `contract-v1` (envelope/canais/códigos/segredo) como superfície testável. **O motor Rust em si pertence ao ADR-003 — não escrever Rust neste ciclo.**

## 3. Escopo

Os 13 itens de interface do ADR §3.

## 4. Não-escopo

Motor init/doctor/upgrade (ADR-003), TUI (ADR-004), publicação (ADR-005), oráculo de paridade (ADR-002).

## 5. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | registry divergir muda fonte de `V19`/`V20` | prova byte-a-byte dos 6 mapas antes de trocar especificador |
| R2 | segredo em argv/stdout | `IsTerminal`/sem eco, `grep -F` vazio |
| R3 | dois motores no caminho de instalação | `.mjs` vira **oráculo** (worktree), não entrypoint |
| R4 | selo republicado | `commands.suiteFull` intacto |

## 6. Verificação

5 comandos (540 plugins / 559 installer / static / sdd / vendor), 6 mapas byte-equal, 22/22 consumidores com destino, 75/75 exports mapeados.
