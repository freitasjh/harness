# TASKS — Bugfix: installer reporta sucesso em instalação inoperante

**Contexto:** `harness` · **Tipo:** bugfix (governança do instalador) · **HEAD:** `85e9f6b`
**Origem:** post-mortem `atlas-ecm/.spec/governance/harness-install-postmortem-2026-10-14.md` (225 linhas) + nota Brain `regras/global/harness/installer-nao-valida-operabilidade`.
**Rigor:** E1/E2 bloqueiam análise (ver §0 do workflow-rules).

---

## 1. Bug

O instalador (`installer/install.mjs`, `harness@1.0.0`) grava `checks.passed = true` e imprime `init: pico-fim` mas deixa o harness **inoperante** no destino: a auto-suite instalada falha **9/20** e o gate de evidência fica sem schema.

## 2. Evidência (reprodução local, HEAD 85e9f6b, 2026-10-14)

```
$ node installer/install.mjs init --target /tmp/harness-repro \
    --answers-file /tmp/answers.json --yes
[OK] checks: PASS
[OK] init: pico-fim                      # ← sucesso FALSO

$ cd /tmp/harness-repro && node --test '.opencode/plugins/__tests__/*.spec.mjs'
# tests 20  # pass 11  # fail 9   exit=1
```

Falhas mapeadas por spec:

| Spec | Falha | Achado |
|---|---|---|
| `config-loader.spec.mjs` | import error | F3 (`../../../scripts/*.mjs` ausente) |
| `gate.spec.mjs` | import error | F3 |
| `sdd-checks.spec.mjs` | import error | F3 |
| `report-schema.spec.mjs` | ENOENT schema | F2 |
| `dogfood.spec.mjs` S2 + S4 | assert invariante repo-harness | F4/F5 |
| `seal.spec.mjs` | ✅ PASS | — |

## 3. Causa raiz (arquivo:linha)

1. **F2** — `INCOMING_ROOTS` (`installer/install.mjs:1032`) omite `.agents/schemas`, enquanto `generateConfig` (`installer/install.mjs:401`) aponta `evidence.schema` para `.agents/schemas/harness-report.schema.json`. Config referencia artefato não instalado.
2. **F3** — `.opencode/plugins` é incoming root; `collectIncoming` (`installer/install.mjs:1070-1094`) varre `__tests__/` inteiro. Specs foram escritos no layout interno do repo-harness e importam `scripts/` (não instalado).
3. **F4/F5** — `dogfood.spec.mjs` afirma invariantes **do repo-harness** (S4: `suiteFull` casa a suíte do harness; S2: CI/pre-commit backstop). Falso para qualquer consumidor.
4. **F1** — `runChecks` (`installer/install.mjs:702-741`) valida só: manifesto presente, `opencode.json`/`harness.config.json` parseiam, flagged, denylist. **Não** roda a suite instalada nem confere `existsSync` dos paths citados na config → PASS falso.

**Nota de intenção:** `.opencode/plugins/__tests__` é a **suíte do próprio repo-harness** (`suiteFull` = plugins+static, conforme `.spec/archive/20261008-harness-installer-mobile/SPEC.md:55`). Shipa para o consumidor por colateral (root `.opencode/plugins`), não por decisão. `.agents/schemas/harness-report.schema.json` existe na origem mas fora do set instalado.

## 4. Solução proposta — ESTRATÉGIA A (runtime-only) [RECOMENDADA]

Princípio: o instalador entrega **runtime + artefatos referenciados** ao consumidor; a auto-suite interna do repo-harness (e `scripts/` de que depende) **não** é artefato de consumidor.

- **Q1 (F2):** incluir `.agents/schemas/**` no set instalado (nova entrada em `INCOMING_ROOTS` ou item explícito) — fecha config↔artefato.
- **Q2 (F3+F4+F5):** excluir `.opencode/plugins/__tests__/**` e `scripts/**` do set instalado **no consumidor** (não afeta a árvore nativa do repo-harness). Elimina 4 das 5 causas de falha na raiz.
- **Q3 (F1):** reforçar `runChecks`:
  - (a) **validação de referências:** cada path citado em `harness.config.json` (`evidence.schema`, `moduleMap.*`, `protectedPaths`) deve existir no destino (`existsSync`); falha ⇒ `checks.failed[]` em bloco 4-linhas.
  - (b) **operabilidade:** `node --check` em cada plugin `.js`/`.mjs` instalado (parse real no destino). Se um dia houver suíte de consumidor, rodá-la e falhar se vermelha.
- **Q4:** ajustar `dogfood`/docs de forma que a distinção repo-harness × consumidor fique explícita (ou remover as asserções internas do spec, já que ele não shipa).

### Alternativa B (ship-tooling) — NÃO recomendada
Shipar `scripts/` + `__tests__/` juntos e tornar `dogfood` repo-scoped (skip fora do repo-harness). Mantém a suíte rodável no consumidor mas acopla o consumidor a tooling interno do harness e não resolve a raiz (artefato interno como se fosse de consumidor).

## 5. Testes (TDD)

- Novo teste em `installer/__tests__/` reproduzindo a falha: instalar em `/tmp` e afirmar que `runChecks` (a) **detecta** `evidence.schema` ausente e falha (red antes do fix), (b) **passa** após fix com schema presente.
- Teste de validação de referência: config com path inexistente ⇒ `checks.passed=false` + bloco 4-linhas.
- Regressão de set instalado: `__tests__/**` e `scripts/**` **não** entram no consumidor; `.agents/schemas/**` entra.
- `node --check` dos plugins instalados no destino verde.
- Rodar `commands.suiteFull` do `harness.config.json` (node tests + `scripts/static-checks.mjs`) verde; `installer/__tests__/` verde.

## 6. Riscos

- Não quebrar o **dogfood** (repo-harness usa a própria suíte): garantidamente a exclusão afeta só o CONSUMIDOR, nunca a árvore nativa do harness.
- `report-schema.spec` deixa de shipar junto com `__tests__/` — aceitável (é teste, não runtime).
- Alterar `INCOMING_ROOTS` toca o caminho de install e os fixtures de `installer/__tests__/` (revisar golden/suite).

## 7. Fora de escopo (follow-ups)

- **F6** — `.agents/rules/harness-config.md` instalado descreve o repo do harness, não o consumidor.
- **F7** — `AGENTS.md` cita `.agents/rules/security-standard.md` removido (referência pendurada).
- **F8** — `permission.task="ask"` no `opencode.json` não documentado.
- Alternativa B (ship-tooling).

## 8. Portão

- **B1→B2 (HITL):** aguarda aprovação explícita do usuário sobre a Estratégia A e a implementação antes de delegar a `developer-engineer`.
