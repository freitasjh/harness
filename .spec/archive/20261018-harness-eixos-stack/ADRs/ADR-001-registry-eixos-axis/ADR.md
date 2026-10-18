# ADR-001 — Registry de perfis modela backend e frontend como eixos, com rótulos literais congelados

- **Status**: `todo`
- **Data**: 2026-10-18
- **Ciclo**: `harness-eixos-stack`
- **Fonte**: parecer do `architect` §1.1/§2a/§2c (2026-10-18) + decisão de portão **D-B** (usuário, 2026-10-18)

## Contexto

`STACK_PROFILES` (`installer/install.mjs:209-258`) é indexado por **valor composto** e seus campos `backend`/`frontend` são **descrições humanas congeladas** — `'N/A — no Java/Maven backend declared by destination Q&A; Node-only stack'` (`:210-212`), `'java+vue backend (declared via Q&A)'` (`:226-228`) — **não identidades de eixo**: não existe `backendId`/`frontendId`. O alvo declarado pelo usuário é java/go/rust × vue/react. Aditivo puro custa duplicação O(N·M) (6 campos para cada um de N·M combos) e um par não enumerado falha fechado com `BAD_ANSWER` (`:298-300`). O golden I7 congela a **saída gerada** dos presets existentes (`installer/__tests__/golden.spec.mjs:48-61`, `:64-69`, `:76-97`).

## Decisão

Cada entrada do registry passa a `{ axes: { backend, frontend }, backend: <literal>, frontend: <literal>, commands, mcp, moduleMap, stacks }`:

1. `axes` carrega **IDs estáveis** de eixo (`java|node|dart|flutter|other|none` × `vue|react|none`), **separados dos rótulos**;
2. `backend`/`frontend` permanecem **literais congelados** — nunca derivados por concatenação;
3. `profileOf(stack)` e a assinatura de `generateConfig(answers, {writtenPaths})` **não mudam**; a resolução continua por preset;
4. `stacks` (gating de skill/rule) passa a ser **derivável do eixo** — consumido por ADR-002;
5. presets novos são **adições** (`java+react` nesta entrega), nunca renumeração.

## Alternativas descartadas

- **Aditivo raso** (só `+1` valor composto, sem `axes`): entrega o par enumerado, mas obriga a **refazer o registry** na migração (ADR-005) e mantém a duplicação N×M — o defeito que motivou este ADR.
- **Migrar já para a pergunta dupla** `backend`+`frontend`: viola o escopo aprovado (E2) e amplia o blast radius para ≈20 fixtures de `--answers-file` (`collectAnswers` exige toda chave não-secret, `installer/install.mjs:340-347`).
- **Derivar `backend`/`frontend` por concatenação**: quebra `golden.spec.mjs:48-61` por **formatação**, não por semântica.

## Consequências

- Par novo = nova entrada + rótulos; combinação não enumerada continua `BAD_ANSWER` até ADR-005.
- Duplicação de `commands`/`mcp`/`moduleMap` entre presets **persiste** — dívida **declarada**, com literais explícitos (não escondida atrás de reuso).
- O campo `axes` só tem valor se **consumido**; se ficar decorativo, o defeito original volta (risco registrado no PROPOSAL §6, mitigado por ADR-002 + teste).

## Invariantes preservados

- Saída byte-idêntica para os 6 presets existentes (I7; prova `golden.spec.mjs:48-61`).
- `generateConfig` puro, sem I/O (prova `installer/__tests__/generate.spec.mjs:65-71`).
- `commands.suiteFull` deste repo intocado (`harness.config.json:14` — selo ADR-002); `gate.js` intocado.
- Nenhum path/comando de projeto hardcoded em rule/plugin (SPEC ADR-003; check V3 em `scripts/static-checks.mjs`).

## Interface congelada

`STACK_PROFILES`, `profileOf`, `generateConfig` (exports consumidos por `golden.spec.mjs:4,8`); as 12 chaves da config gerada (`installer/install.mjs:412-438`); `QUESTIONS` com 5 chaves (`:194-200`).

**depende-de**: — (raiz). **Bloqueia**: ADR-002, ADR-005.

## Fora desta decisão

Pergunta dupla (ADR-005); perfis backend `go`/`rust`; `gate.js`.
