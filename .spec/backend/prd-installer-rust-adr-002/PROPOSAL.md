# PROPOSAL — prd-installer-rust-adr-002

> Ciclo SDD escopado do **ADR-002 do PRD-3** (oráculo de paridade e golden).
> Fonte: `.spec/prd/prd-installer-rust/ADRs/ADR-002-oraculo-paridade/ADR.md` (15 itens, G2 aprovado).

## 1. Problema (medido)

| Fato | Número |
|---|---|
| Baseline golden real | **9 presets byte-equal + 2 parciais** — 12/12 é meta, nunca fato |
| dry-run medido | apenas **2 presets** |
| Oráculo | `c63e333` em worktree `detach`, SHA verificado |
| Risco | snapshot aceito vira bug validado; `insta accept` cego |
| Selo | `c904f1c5` — `commands.suiteFull` não muda |

## 2. Proposta

Mecanismo de paridade com **oráculo externo ao sujeito**: SI-1..SI-6 medidos por differential contra o worktree `c63e333`, literais validados por rito humano com sha em `harness/<demand>.json`, `insta` só como revisor de diff. Registry dos 6 mapas (ADR-001) entra como prova já existente.

## 3. Escopo

Os 15 itens de interface do ADR §3.

## 4. Não-escopo

Motor Rust (ADR-003), TUI (ADR-004), publicação (ADR-005), fronteira `contract-v1` (ADR-001).

## 5. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | oráculo derivado do sujeito (tautologia) | 3 condições de externalidade + `git diff --exit-code` nos literais |
| R2 | `accept` cego | rito com assinatura `Veredito: validated literal <sha> <ISO> <oráculo>` |
| R3 | publicar 12/12 como fato | só re-derivável por comando nos 12 presets |
| R4 | selo republicado | comandos paralelos fora de `suiteFull` |

## 6. Verificação

5 suítes + 6 predicados SI provados + literais com sha validado.
