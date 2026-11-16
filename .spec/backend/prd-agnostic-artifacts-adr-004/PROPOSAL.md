# PROPOSAL — prd-agnostic-artifacts-adr-004

> Ciclo SDD escopado do **ADR-004 do PRD-2** (referências + `DESIGN.md`).
> Fonte: `.spec/prd/prd-agnostic-artifacts/ADRs/ADR-004-referencias-e-design-md/ADR.md` (256 l., 12 itens, G2 aprovado 2026-11-16).

## 1. Problema (re-medido após o ADR-003)

| Fato | Número |
|---|---|
| `V18` baseline de refs órfãs | 7 (2 C1 + 5 C2) |
| `refs-undetected` no `V20` | 20 (dono: este ADR) |
| Citações dos 8 paths de rule | **33** (o PRD dizia 47/52; `spec-review` levou 14) |
| `security-standard.md` | SSoT declarada em **7 prefixadas + 4 nuas** — `remover` deixaria a segurança sem norma |
| `frontend/DESIGN.md` citado | **11 linhas / 3 agentes** — arquivo ausente |
| `.doc/**` citado | 9 linhas (dono: ADR-005, **não** remover aqui) |
| N30 link-ref | 0 ocorrências hoje, mas `citesToken` casa o padrão (latente) |

## 2. Proposta

Aplicar a rubric RC0–RC6 com precedência fixa: **RC1 reapontar** a SSoT para a skill `security-review` (nunca remover); **RC2** remover as citações Java com dívida PRD-4; **RC3** remover os 11 ponteiros de `DESIGN.md` com dívida PRD-5; **RC4** remover `unit-testing-standards` (já normatizado); **RC6** estender o detector de link-ref.

## 3. Escopo

Os 12 itens de interface do `ADR.md` §3.

## 4. Não-escopo

Frota restante (identidade `TaskFlow`, `nestjs:81`/`node:86`, catálogo, 9 linhas de `.doc/**`) — ADR-005. PRD-3 (CLI Rust), PRD-5 (conteúdo do `DESIGN.md`).

## 5. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | Esquecer as 4 ocorrências nuas de `security-standard` | item 3 força `grep -rIn` ⇒ 0 (além do `grep -rn` ⇒ 0) |
| R2 | Aplicar `remover` na SSoT | RC1 tem precedência sobre RC2; proibição explícita |
| R3 | Ler `refs-undetected=9` como falha | 9 com dono é o correto; 0 esconderia dívida |
| R4 | Extensão do N30 alterar `consumer` do `V19` | fixture exige 21 antes/depois |
| R5 | Selo republicado | nenhum comando novo em `suiteFull` |

## 6. Verificação

5 comandos + `V18 baseline≈0` · `refs-undetected≈9` · `V19 consumer=21` · selo intacto.
