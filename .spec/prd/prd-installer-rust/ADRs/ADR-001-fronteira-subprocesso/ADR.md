# ADR-001 — Fronteira de subprocesso e contrato (STUB)

> **STUB — não é decisão.** Este arquivo materializa o 1:1 exigido por `ADR-01`
> (`checks.mjs:294-301`): a linha 1 do `ADR-INDEX.md` existe, logo o diretório e o `ADR.md`
> precisam existir. Ele registra **inventário de entrada**, não escolha de crate, formato de
> contrato ou estratégia de migração. A decisão, com alternativas, critério, trade-off e
> interface ratificada, entra no próximo batch de autoria de ADR.
> **Status:** `in-progress` · **Branch:** `adr/prd-installer-rust/01-fronteira-subprocesso` ·
> **Fatiamento:** D8, ADR 1 de 5 (`PRD.md` §16).

## depende-de

— (primeira ADR do fatiamento D8).

## Interface congelada

**Pendente de ratificação.** Os itens abaixo são fatos medidos que condicionam a decisão — não
são a interface decidida. A interface congelada definitiva será registrada aqui no batch da
decisão.

- Fronteira de API observada: **22 consumidores** importam **75 dos 95 exports** de
  `installer/install.mjs` (PRD §3.3, M2/M3); `gate.js` tem **0 referência** ao instalador.
- Contrato de injeção a preservar: 6 mapas (`AXIS_IDS`, `SKILLS_BY_AXIS`, `SKILLS_COMMON`,
  `RULES_BY_AXIS`, `RULES_COMMON`, `STACKS_FOR_EXCEPTIONS`) injetados em
  `scripts/static-checks.mjs:81`; 3 módulos `lib/**/checks.mjs` dependem dessa injeção.
- Oráculo de comportamento: instalador Node no commit `c63e333` (D4); baselines literais
  (`golden.spec.mjs`, `EXPECTED_STACKS`) permanecem como contraprova de config.
- Invariantes de decisão do owner, **não reabertos**: D1 = subprocesso/CLI, sem FFI e sem dois
  motores convivendo; D2 = paridade total antes de trocar; D6 = selo `c904f1c5` e
  `commands.suiteFull` inalterados; D7 = binário autocontido com Node≥20 no destino.
- Predicado de aceite desta frente (PRD §5, M-6): 22/22 consumidores com veredito declarado
  (contrato equivalente, substituição ou convivência), 75 exports com destino, nenhum
  import órfão.

## O que o próximo batch deve conter

1. Decisão única sobre o formato do contrato de subprocesso (stdin/stdout/stderr, códigos de
   saída, segredo sem eco, TTY vs pipe, cancelamento), com alternativas e custo.
2. Rubrica de veredito para os 22 consumidores e a preservação explícita dos 6 mapas injetados.
3. Interface congelada ratificada substituindo o inventário acima; `RESEARCH.md` §5 e §7 são
   insumo, não veredito.
4. Dependências registradas: ADR-002 (oráculo de paridade) e ADR-004 (TUI) herdam desta fronteira;
   ADR-003 (motor) vem depois do oráculo.
