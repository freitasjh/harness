# ADR-INDEX — `prd-installer-rust`

> **Ledger 1:1 com `ADRs/**`** — uma linha por `ADR.md` existente no disco. Contrato das colunas
> (`.agents/rules/prd-adr-pipeline.md` §2): `order` inteiro ≥1 · `status` no enum
> `todo|in-progress|merged|dropped` (`proposed` não existe — `checks.mjs:47`) · `depends_on` declarado
> (`—` quando não há) · `dir` no padrão `ADRs/ADR-00N-{slug}/` · `branch` no padrão
> `adr/{prd-id}/{nn}-{slug}` · `merge` preenchido **somente** quando `status=merged`.
>
> **Por que este índice nasce com 1 linha e não 5.** As 5 linhas do fatiamento D8 estão aprovadas
> (`PRD.md` §16) e recomendadas em `RESEARCH.md` §7, mas `ADR-01` exige 1:1 entre índice e disco:
> linha de índice sem `ADRs/<dir>/` correspondente é FAIL e diretório sem linha é órfão
> (`checks.mjs:294-301`). Materializar as 5 linhas antes dos 5 diretórios deixaria
> `node scripts/static-checks.mjs` em exit 1 com 5 falhas de 1:1 — contra RF-10 e H2 do harness.
> `ADR-02` tampouco aceita índice sem linha parseável (`checks.mjs:362-366`). A forma honesta é a do
> precedente da casa (PRD-2): **o índice nasce com o primeiro ADR**; cada linha nova entra no mesmo
> commit do seu `ADR.md`.
>
> **1:1 resolvido com stub declarado.** A linha 1 existe e o diretório
> `ADRs/ADR-001-fronteira-subprocesso/` existe, com `ADR.md` marcado **STUB — não é decisão**. Ele
> contém `depende-de` e `interface congelada` no inventário de entrada, e deixa explícito que a
> decisão (alternativas, critério, trade-off e interface ratificada) vem no próximo batch de
> autoria de ADR. Sem esse arquivo, a linha 1 seria FAIL por 1:1; com ele, o ledger é 1:1 e não
> finge que a decisão foi tomada. Nenhuma das decisões D1–D8 é reaberta no stub.
>
> **Estado:** 1 linha, `ADR-001` `in-progress`, branch `adr/prd-installer-rust/01-fronteira-subprocesso`,
> sem merge. As linhas 2–5 do fatiamento entram quando seus `ADR.md` existirem: 2 oráculo de paridade
> (depende de 1), 3 motor `init`/`doctor`/`upgrade` (depende de 2), 4 TUI 10 telas (depende de 1) e
> 5 publicação/runtime/selo (depende de 3). No máximo 1 linha `in-progress` por vez
> (`checks.mjs:378-379`). A ordem é a de merge do fatiamento — 1 a 5, sem pulo.
>
> *Nota de forma: não há segunda tabela. `parseIndex` (`checks.mjs:149-163`) lê toda linha que começa
> com `|` como linha do ledger; uma tabela adicional seria interpretada como ADR extra e reprovaria
> `ADR-01`.*

| order | id | title | status | depends_on | dir | branch | merge |
|---|---|---|---|---|---|---|---|
| 1 | ADR-001 | Fronteira de subprocesso e contrato: CLI Rust como binário invocado por 22 consumidores Node, com stdin/stdout/stderr, códigos de saída e segredo sem eco, sem FFI e sem dois motores | in-progress | — | ADRs/ADR-001-fronteira-subprocesso/ | adr/prd-installer-rust/01-fronteira-subprocesso | — |

## Insumo da linha existente

- **ADR-001** — decisão G1 **D1** (subprocesso/CLI; 22 consumidores adaptados; sem FFI, sem dois
  motores) e **D4** (Node `c63e333` como oráculo de comportamento). Requisitos: RF-05, RF-07,
  M-6. Evidência: 22 consumidores importam 75 dos 95 exports; `gate.js` tem 0 referência ao
  instalador; 3 módulos `lib/**/checks.mjs` recebem os 6 mapas por injeção em
  `scripts/static-checks.mjs:81`. Pesquisa: `RESEARCH.md` §5 (tema D, fontes S9/S10/S11) e §7
  (recomendação com critério). Oráculo de paridade (linha 2) e motor (linha 3) herdam desta a
  fronteira de contrato; a TUI (linha 4) herda a separação CLI/TUI (P-3).
