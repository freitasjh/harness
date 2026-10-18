# ADR-002 — Perfil `react` + gating de skill e rules derivado do eixo (fim do vazamento A1/A2)

- **Status**: `todo`
- **Data**: 2026-10-18
- **Ciclo**: `harness-eixos-stack`
- **Fonte**: parecer do `architect` §1.5/§2c + achados A1/A2 (`workflow-state.json` → `cycle_eixos_stack.achados_de_analise`) + decisão de portão **D-C** (usuário, 2026-10-18: "A1+A2 entram no escopo")

## Contexto

O gating de artefato do instalador filtra **apenas** `.agents/skills/**` e apenas por `stacks` (`installer/install.mjs:1186-1198`). Duas falhas concretas:

1. **A1 (P1)**: o `stacks` do lock é derivado do **nome** da skill — `inferStacks` só conhece os prefixos `dart-`/`flutter-` (`scripts/vendor-skills.mjs:284-288`) e `buildVendor` grava `stacks: inferStacks(name)` (`:341`), ignorando qualquer origem declarada. Como `stacks: []` significa "comum, entra sempre" (`installer/install.mjs:1195-1196`), as duas skills react entrariam em **todo** destino — e o perfil react **não filtraria nada**.
2. **A2 (P2)**: `.agents/rules/**` **não** é filtrado por eixo → um destino react receberia `.agents/rules/frontend-coding-standards.md` (prosa Vue 3 + shadcn-vue, com "Vuetify é proibido").

O `moduleMap` novo do perfil é seguro por construção: chaves de stack não são harness-owned, logo não entram no check `config-ref-missing` (`installer/install.mjs:740-746` + filtro `:406-409`).

## Decisão

1. Preset **`java+react`** com `axes: { backend: 'java', frontend: 'react' }`, `backend`/`frontend` literais próprios, `commands` próprios, `mcp.required: ['chrome-devtools']` e `moduleMap` de stack (chaves não harness-owned).
2. **Fim da inferência por nome**: a origem do eixo é declarada na entrada de source do lock e o `stacks` da skill passa a derivar dela; `inferStacks` deixa de ser a **única** fonte (para `dart-*`/`flutter-*` o resultado tem de continuar idêntico — prova `installer/__tests__/vendor.spec.mjs:161-172`).
3. **`.agents/rules/**` ganha o mesmo filtro** de eixo que hoje vale para skills.
4. `react-components` entra como skill **opcional** do perfil (rede em runtime via `scripts/fetch-stitch.sh` → `curl`; depende de `@swc/core` e do Stitch MCP); `react-best-practices` é a skill **padrão**. A marcação "opcional" é dado declarado no lock, não prosa.

## Alternativas descartadas

- `stacks: []` nas skills react (cairiam como "comum" em todo destino — é exatamente o A1).
- Renomear as skills para `react-*` e ensinar o prefixo no `inferStacks`: mantém a inferência por **nome** (o defeito) e quebra a byte-identidade do vendor (`--check` recomputa `treeHash`).
- Instalar `react-components` como **obrigatória**: um instalador rede-zero por desenho não deve ter, como default, uma skill que faz rede em runtime.

## Consequências

- Destino react recebe as 2 skills e **não** recebe `frontend-vue-specialist`.
- Teste novo deve provar as **duas direções** (entra em react; não entra em `java+vue`/`node`/`outra`) — `installer/__tests__/mobile.spec.mjs:74-114` é o precedente de fixture.
- Registro honesto: `.agents/skills/**` **não** é varrido pelos canários (`scripts/static-checks.mjs:42-47`) e V15 só varre `installer/` (`:280-286`) ⇒ o `curl` da skill opcional **passa** pelo CI verde. Declarado, não escondido.

## Invariantes preservados

- `installer/` continua rede-zero (V15).
- Lock **nunca** é copiado ao destino.
- `stacks` dos presets existentes inalterado (`installer/install.mjs:216-256`); resultado de `inferStacks` para `dart-*`/`flutter-*` inalterado.

## Interface congelada

`collectIncoming(sourceDir, { stacks })` (`installer/install.mjs:1200-1227`) e a semântica "sem entrada no lock ⇒ comum" (`:1187`, `:1194`); `.vendor-lock.json` v1 (consumido por `harness.config.json:14` via `vendor-skills.mjs --check`).

**depende-de**: ADR-001. **Bloqueia**: ADR-003 (as skills só têm efeito com o perfil), ADR-004.

## Fora desta decisão

Escrever skill nova; dogfood em projeto externo.
