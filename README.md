# Harness — enforcement duro para agentes opencode

> Prosa descreve; quem nega é `gate.js` + CI. Este repo transforma governança de
> agentes (que o modelo pode ignorar) em portões que o runtime aplica — com
> evidência verificável por máquina e honestidade declarada onde não há garantia.

## Funcionalidades

| # | O quê | Como |
|---|---|---|
| 1 | **Gates bloqueantes** — delegação sem PICCO nega; conclusão sem contraprova nega; 3º task sem turno humano nega; higiene de shell (I7) nega; escrita em path protegido nega | hook v2 `ctx.tool.hook("execute.before", …)` + `DenyError` tipado (`.opencode/plugins/gate.js`) |
| 2 | **Evidência machine-checkable** — conclusão de fase exige `REPORT.json` válido + **re-execução** do comando canônico pelo gate (verificador ≠ executor) | contrato + selo `sha256` + cache |
| 3 | **Zero path hardcoded** — comandos, paths, portas e módulos vêm do `harness.config.json` do projeto | ADR-003; check estático acusa literal |
| 4 | **Portão de prompt** — toda demanda de mudança passa por 6 elementos (PICCO); sem eles, o orquestrador pergunta em vez de adivinhar | skill `prompt-optimizer` + gate PICCO |
| 5 | **SDD governado** — SPEC → PLAN → TASKS → execução → VERIFY → archive, com portões humanos P0..P6 e asserts executáveis | skills `sdd-compiler` + checks |
| 6 | **Cobertura de risco** — mudança em `riskPaths` (auth/acl/security/i18n) está declarada para subir o E2E a `enforce` (declarativo: sem consumidor no runtime — ver `docs/FUNCIONAMENTO.md` §10a2) | `escalateOnRisk` |
| 7 | **Kill-switch fora do worktree** — `HARNESS_GATES=off` no processo host corta a suíte; o config nunca desliga a suíte **nem** rebaixa um gate — o rebaixamento por gate vive no env (`HARNESS_GATE_<GATE>` + `_REASON` obrigatório, `gate.js:98`) e todo `gates.*` com valor ≠ `"enforce"` é auditado (`gate.js:252`) | ADR-009 · 🟢 runtime |
| 8 | **Memória persistente** — decisões, erros e lições no Brain (busca antes, registra depois) | skill `brain` |
| 9 | **Sincronizador** — leva o harness a outro repo sem copiar domínio alheio; determinístico (manifesto + sha256 + backup), sem wizard, sem perfis de stack, sem rede; os mesmos três verbos ficam disponíveis como `/harness-init`, `/harness-update` e `/harness-doctor` (`.opencode/commands/`, payload) | `scripts/harness-sync.mjs` (`init`/`update`/`doctor`) + `scripts/seal.mjs` |
| 10 | **Esteira PRD→ADR→SDD** — intenção de negócio aprovada **antes** do design; 1 ADR = 1 branch = 1 ciclo SDD; checks entram no `suiteFull`, sem deny novo no runtime | `.spec/prd/**` (bucket non-cycle) + `.agents/rules/prd-adr-pipeline.md` + `PRD-01`/`ADR-01`/`ADR-02` |

## Estrutura

```
.opencode/plugins/   → gate.js (deny) + libs + __tests__ (fixtures)
.opencode/commands/  → comandos do operador (/harness-init, /harness-update, /harness-doctor)
.agents/rules/       → política descritiva (nunca enforcement sozinha)
.agents/agents/      → papéis (orchestrator sem write; reviewer/code-reviewer sem write)
.agents/skills/      → playbooks (prompt-optimizer, sdd-compiler, harness-report, ...)
.agents/schemas/     → JSON schemas (REPORT, state)
scripts/harness-sync → payload determinístico (init/update/doctor) + testes
harness.config.json  → dados DESTE projeto (comandos, paths, portas, riskPaths)
scripts/             → checks estáticos (suite, sdd, integridade)
.spec/archive/       → specs concluídas (histórico imutável)
workflow-state.json  → estado do ciclo (única fonte de verdade do progresso)
```

## Como instalar em projetos

**Pré-requisitos**: Node 20+, git, opencode **v2** (contrato medido em v2.0.32 — este repo é v2-only), MCP `chrome-devtools` (p/ H3).

```sh
# 1. init — cria o payload + harness.config.json mínimo no destino
node scripts/harness-sync.mjs init --target /caminho/do/projeto

# 2. confira o plano SEM escrever nada (create/update/skip por path)
node scripts/harness-sync.mjs init --target /caminho/do/projeto --dry-run

# 3. valide o destino (somente leitura; exit 1 nomeia cada falha com o path)
node scripts/harness-sync.mjs doctor --target /caminho/do/projeto

# 4. depois de um ciclo do harness: atualize (backup obrigatório + só o que mudou)
node scripts/harness-sync.mjs update --target /caminho/do/projeto
```

O mesmo contrato, pelo agente, sem decorar flags — `.opencode/commands/` é
payload, então os três comandos existem no destino logo após o `init`:

| Comando | O que faz | Garantia |
|---|---|---|
| `/harness-init [dir]` | confere que o alvo está limpo, mostra `--dry-run`, pede confirmação, aplica e fecha com `doctor` | alvo com estado do harness é mandado para `/harness-update`; nada é aplicado sem "sim" |
| `/harness-update [dir]` | avisa o destino do backup (fora do alvo), mostra `--dry-run` (`create`/`update`/`skip` + `orphan`), confirma, aplica e valida | backup fora do alvo; órfão só reportado; FAIL do `doctor` é listado, não "consertado" |
| `/harness-doctor [dir]` | roda só a validação | somente leitura; exit code + cada `FAIL <o quê>: <path>` |

Nenhum comando pergunta stack/perfil: `targets` e `commands` são detectados
(`--suite`/`--unit` sobrepõem) e o resto se ajusta no `harness.config.json` do
projeto.

`targets` e `commands` são **detectados**, nunca perguntados: `pom.xml` ⇒ backend
`java` + `mvn test`; `Cargo.toml` ⇒ `rust` + `cargo test`; `package.json` com
`react`/`vue` ⇒ frontend e, com `scripts.test`, `npm test`; `@nestjs/core` ⇒
`nestjs`; `express`/`fastify` ⇒ `node`. Detectou errado? `--suite`/`--unit`
sobrepõem, e o resto se ajusta no `harness.config.json` do projeto.

O sincronizador **nunca sobrescreve** `harness.config.json`, `workflow-state.json`,
`.agents/rules/project-*.md` nem `.spec/**` (o config só é **criado quando
ausente**, pela mesma via guardada e atômica do payload, e nunca entra no
manifesto), e faz **backup** em
`<parent do destino>/.harness-backup/<nome>-<timestamp>/` (fora do destino;
`--backup-dir` sobrepõe) antes de qualquer sobrescrita. Escrita é atômica e o
manifesto é o último arquivo gravado. Path do manifesto que o payload não publica
mais é reportado como `orphan <path> (não removido)` — nada é apagado, e o
registro órfão sobrevive às regravações do manifesto. Um manifesto ausente ou
divergente é recriado pelo `update` mesmo com payload idêntico. O selo do
comando canônico sai de `node scripts/seal.mjs --env`.

Identidade de path é resolvida por `realpath`, não por string: `--target` que é
symlink para este checkout é recusado (`target é a própria fonte`, sem manifesto
na fonte) e `--backup-dir` cujo ancestral symlinkado resolve para dentro do
destino é recusado (`backup dentro do target`) mesmo quando o caminho lexical
parece fora. Link no ancestral existente mais fundo do backup (ou na folha que
`--backup-dir` nomeia) continua recusado (`symlink no diretório de backup`);
ancestrais acima dele não são superfície da run e o fallback lexical vale só para
path que ainda não existe.

**Mudou `commands.suiteFull`? Reexporte o selo** (o gate compara o selo publicado
com o config; divergência = deny `sealed-command-mismatch`):

```sh
eval "$(node scripts/seal.mjs --env)"
```

**Depois de instalar, no destino:**
1. `node --test` + checks verdes
2. **Restart do opencode** (plugins só carregam no boot)
3. Smoke: delegação sem PICCO nega · com PICCO permite · higiene de shell nega
4. Rollback imediato, se preciso: `HARNESS_GATES=off`

## Verificação (neste repo)

```sh
node --test ".opencode/plugins/__tests__/*.spec.mjs"  # gates + libs
node --test "scripts/__tests__/*.spec.mjs"            # sync + seal + comandos (v2/F1-F2)
node scripts/static-checks.mjs                        # V2/V3/V6/V6b/V7/V12/V14/V18/V21 + PRD-01/ADR-01/ADR-02 (V14 exige remote+CI)
node scripts/sdd-checks.mjs                           # V4/R-V12/V17/SDD/R-NODENY/RENAME
```

## Histórico

Specs concluídas em `.spec/archive/` (imutável) e `spec-developed.md`.
Sessões e lições no Brain (`sessoes/harness/*`, `regras/global/*`).
