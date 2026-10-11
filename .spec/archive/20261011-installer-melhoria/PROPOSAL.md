# Change Proposal: Installer Melhoria (menu produto, erro limpo, init greenfield, doctor brownfield)

> **ID**: `installer-melhoria`
> **Status**: `Under Review`
> **Author**: developer-engineer (via sdd-compiler generate-proposal)
> **Date**: 2026-10-11
> **Source**: triagem architect + parecer ux-designer vinculante + evidência medflow

---

## 1. Problem Statement

- **Contexto**: instalador do harness (`installer/install.mjs`, 1492 linhas) — Q&A/wizard W0..W7 (`installer/install.mjs:1246-1390`), geração pura (`installer/install.mjs:346-386`), merge (`installer/install.mjs:417-505`), checks (`installer/install.mjs:666-701`), skill de uso (`.agents/skills/harness-installer/SKILL.md`).
- **Impacto atual**:
  1. Menu W2m fala em stacks técnicas (`installer/install.mjs:1157-1162` — 4 itens `flutter/dart/node/outra`), sem cobrir os 6 valores válidos (`installer/install.mjs:245` — `STACK_VALUES = node, java+vue, outra, node-esm, flutter, dart`). Usuário de produto não sabe mapear "meu projeto" → stack; `node-esm` e `java+vue` ficam inalcançáveis pelo menu.
  2. Erros são mensagens inline de 1–2 linhas sem padrão (`installer/install.mjs:1303` menu inválida 1 linha; `installer/install.mjs:1345-1346` erro + como-corrigir 2 linhas sem onde-ver; `installer/install.mjs:1263,1266` aborts; `installer/install.mjs:477,483` CORRUPT; `installer/install.mjs:687-698` strings de `runChecks`). Falta o quê / porquê / correção / onde-ver; dry-run não declara `NÃO EXECUTADO`; sucesso não marca pico-fim.
  3. Não há caminho greenfield explícito create-only: wizard atual aceita merge/flag no mesmo fluxo (`installer/install.mjs:1357` `planMerge` + `installer/install.mjs:1363-1386` W5/W6/W7), sem contador de progresso `[i/total]` e sem `q` visível em cada prompt (só `ABORT_TOKENS` em `installer/install.mjs:1155` + leitura em `installer/install.mjs:1259-1269`).
  4. Não há diagnóstico brownfield read-only: `planMerge` (`installer/install.mjs:457-505`) e `runChecks` (`installer/install.mjs:666-701`) só rodam dentro do fluxo de instalação; destino com divergência só descobre via tentativa de install.
- **Evidência**: triagem architect (STACK_PROFILES fonte única `installer/install.mjs:190-239`; generateConfig puro `installer/install.mjs:346-386`; merge `installer/install.mjs:417-450`; planMerge `installer/install.mjs:457-505`; checks `installer/install.mjs:666-701`; wizard `installer/install.mjs:1246-1390`); parecer ux-designer vinculante (menu 5 itens produto→stack, erro 4-linhas, fluxos init/doctor); evidência medflow (gate/schema/config ausentes — sem impacto, não entra); testes atuais do wizard (`installer/__tests__/wizard.spec.mjs:89-142` cobrem W0..W2m com 4 itens — precisarão de update).

---

## 2. Proposed Solution

**Resumo**: melhorar o instalador em 4 eixos sem mudar stacks/profiles nem medflow: menu W2m de 5 itens em linguagem de produto mapeando para stacks existentes; padrão de erro em 4 linhas + marcadores dry-run/sucesso; comando `init` greenfield create-only (W0–W7 com contador e `q` visível); comando `doctor` brownfield read-only (7 passos D0–D6 — corrige ALTA-001: uniforme "7 passos" com SPEC ADR-014).

**Abordagem**:
- Menu W2m com 5 rótulos de produto → stacks existentes (`installer/install.mjs:1157-1162` vira 5 entradas; `STACK_VALUES` em `installer/install.mjs:245` e `STACK_PROFILES` em `installer/install.mjs:190-239` preservados, sem nova key). `node`+`node-esm` colapsam num item produto ("Projeto Node.js"); `java+vue` ganha item próprio.
- Função de formatação de erro 4-linhas (o quê / porquê / correção / onde-ver) reutilizada em todos os pontos de erro do wizard/Q&A/checks (`installer/install.mjs:1263,1266,1303,1345-1346,477,483,687-698`); linha 2 cita exclusivamente códigos reais do código (`BAD_ANSWER` de `validateAnswer` em `installer/install.mjs:271-310` — corrige CRÍTICA-001: código de menu inválido inexistente removido); intervalo do menu sempre fechado `[1,5]` (corrige CRÍTICA-001); `howToFix` (`installer/install.mjs:1236-1244`) vira a linha 3; dry-run imprime `NÃO EXECUTADO`; sucesso imprime marcador pico-fim.
- `init`: entrypoint greenfield que só aceita plano create-only (`planMerge` em `installer/install.mjs:457-505` com filtro `create|generate-overwrite|noop`; qualquer `merge|flag` aborta com instrução para `doctor`); wizard W0–W7 com contador `[i/total]` e `q` visível em todo prompt.
- `doctor`: entrypoint brownfield read-only (7 passos D0–D6, corrige ALTA-001) que só lê (`inventory`, `detect` em `installer/install.mjs:1171-1222`, `planMerge` seco, `runChecks` em `installer/install.mjs:666-701`); zero writes por construção (sem `apply`, sem `writeManifest` em `installer/install.mjs:705-711`, sem `applyMerge` em `installer/install.mjs:507-545`).
- Contrato CLI `init`/`doctor` (corrige ALTA-002 — detalhe normativo em SPEC §9.5): reusa `parseArgs` (`installer/install.mjs:909-926`) e `printUsage` (`installer/install.mjs:1393-1396`), sem flag novo; `init --target <dir> [--dry-run] [--answers-file] [--yes] [--backup-dir] [--allow-root]`, `doctor --target <dir> [--answers-file] [--backup-dir] [--allow-root]`; exit `0` sucesso/help, `1` abort (`BAD_TARGET|BAD_ANSWER|BACKUP_FAIL|NO_STDIN|USER_ABORT`); `doctor` ignora `--dry-run`/`--yes`.
- Higiene de segredos e I/O (corrige security-review H1, M1–M4 — detalhe normativo em SPEC RF-05 REQ-14–18): `sanitizeLog(line, answers)` sempre com contexto (`installer/install.mjs:715-723`; defeito atual em `installer/install.mjs:1408` sem 2º argumento); `serializeAnswers` filtra segredo (`installer/install.mjs:333-340` — corrige CRÍTICA-001: linha antes não citada); backup em `installer/install.mjs:135-164` (corrige CRÍTICA-001: linhas antes não citadas); `--answers-file` validado (`installer/install.mjs:926-937`); segredo sem eco (`installer/install.mjs:977-1029`); `--backup-dir` validado (`installer/install.mjs:135-144`); strip ANSI/controle no display.
- Alternativas descartadas:
  - Nova key de stack para cada item de menu — descartada: viola invariante "preservar STACK_VALUES/STACK_PROFILES sem nova key" e quebraria golden (`installer/__tests__/golden.spec.mjs:64-71`).
  - Auto-merge em init — descartado: viola regra "rules/skills/plugins nunca auto-merge" (`installer/install.mjs:501-502`) e o desenho create-only.
  - `doctor` com `--fix` — descartado: escopo é diagnóstico read-only; escrita continua exclusiva do fluxo com confirmação por camada.

---

## 3. Scope

### In Scope
- [ ] E1 — menu W2m com 5 itens em linguagem de produto → stacks existentes, sem nova key (`installer/install.mjs:1157-1162`, `installer/install.mjs:245`, `installer/install.mjs:190-239`)
- [ ] E2 — padrão de erro 4-linhas (o quê/porquê/correção/onde-ver) + `dry-run: NÃO EXECUTADO` + marcador de sucesso pico-fim (`installer/install.mjs:1236-1244`, `installer/install.mjs:1303`, `installer/install.mjs:1345-1346`, `installer/install.mjs:666-701`, `.agents/skills/harness-installer/SKILL.md` §7)
- [ ] E3 — `init` greenfield create-only W0–W7 com contador `[i/total]` e `q` visível (`installer/install.mjs:1246-1390`, `installer/install.mjs:457-505`)
- [ ] E4 — `doctor` brownfield read-only D0–D6 (7 passos, corrige ALTA-001), zero writes (`installer/install.mjs:1171-1222`, `installer/install.mjs:457-505`, `installer/install.mjs:666-701`)
- [ ] E5 — higiene de segredos e I/O (corrige H1, M1–M4): `sanitizeLog` com contexto, `--answers-file` validado, segredo sem eco, `--backup-dir` validado, strip ANSI/controle (SPEC RF-05 REQ-14–18)
- [ ] E6 — contrato CLI `init`/`doctor` argv/flags/exit/help (corrige ALTA-002; SPEC §9.5)
- [ ] ADRs 011–014 + seção Delta Specs no SPEC

### Out of Scope
- Implementação de código (esta demanda entrega só `PROPOSAL.md` + `SPEC.md`; código vem em fase posterior via PLAN/TASKS) — porque a rota contratada é SPEC-first.
- Alteração de stacks/profiles (`STACK_VALUES`, `STACK_PROFILES`, `profileOf`, `generateConfig`) — porque golden e compat retroativa congelam o contrato.
- Alteração de medflow — porque evidência aponta ausência de gate/schema/config e nada há para mudar.
- `--fix` no doctor, upgrade/desinstalação, i18n do wizard — porque expandem escopo além dos 4 eixos.

---

## 4. Architecture Impact

| Aspecto | Impacto | ADR Necessário? |
|---------|---------|-----------------|
| Backend (módulos afetados) | `installer/install.mjs` (wizard WIZARD_MENU, erro, init, doctor, higiene segredos H1/M1–M4, contrato CLI); `installer/__tests__/` (wizard/cli/docs/qa/checks/suite updates) | Sim (011–014) |
| DDD api/impl/public | N/A — CLI single-file zero-dep (`installer/install.mjs:1-10`), sem camadas Java; separação por funções puras exportadas (corrige ALTA-003) | Não |
| Frontend (componentes/stores) | N/A — repo sem frontend Vue (harness.config.json `stack.frontend: N/A`) | Não |
| Banco de dados (migrations) | N/A — sem banco, sem Flyway | Não |
| Multi-tenancy | N/A — CLI local single-target | Não |
| Segurança / RBAC | Segredo `deployToken` segue só-memória (`installer/install.mjs:715-...` sanitizeLog); sem `@HasPermission` (CLI local, sem IAM) — explícito | Não |
| Eventos (Kafka/async) | N/A — sem eventos | Não |

---

## 5. Delta Preview

| Documento Alvo | Tipo de Mudança | Seção Afetada |
|----------------|-----------------|---------------|
| `.agents/skills/harness-installer/SKILL.md` | MODIFIED | §9.2 Wizard W0..W7 (menu 5 itens, contador, q visível); §7 Checks (erro 4-linhas, dry-run, pico-fim) |
| `.agents/skills/harness-installer/SKILL.md` | ADDED | §10 init greenfield (W0–W7 create-only); §11 doctor brownfield (D0–D6 read-only) |
| `.agents/rules/harness-config.md` | MODIFIED | Key map — nota de que menu/init/doctor não mudam `harness.config.json` (comandos/portas idem) |
| `spec-developed.md` | MODIFIED | Entrada da feature ao arquivar |

---

## 6. Risk Assessment

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Quebra de compat do menu (testes esperam 4 itens) | Alta | Médio | Update de `installer/__tests__/wizard.spec.mjs:131-142` + `cli.spec.mjs` no mesmo batch; golden intacto (sem nova key) |
| Erro 4-linhas quebra asserts de substring existentes | Média | Médio | Manter tokens atuais (`[ERRO]`, `como corrigir`, `W0`..) como substrings do novo bloco; testes via `assert.match` seguem passando |
| `init` confundido com install padrão | Média | Médio | `init` aborta em qualquer `merge|flag` com instrução explícita para `doctor`; documentado em SKILL §10 |
| `doctor` escreve acidentalmente | Baixa | Alto | Sem `apply`/`applyMerge`/`writeManifest` no caminho; assert estático (scan de imports) + teste "zero writes" com fs mock |
| Segredo vaza em log/output (H1) | Média | Alto | `sanitizeLog` sempre com contexto + `serializeAnswers` filtra + teste canário em todo output (REQ-14) |
| Propor `pkill -f`/Lombok/skip harness por acidente | Baixa | Alto | Constraint explícita + checklist no SPEC; encerramento segue `lsof -ti :PORT` + `kill` por PID |

---

## 7. Success Criteria

- [ ] Menu W2m exibe 5 itens em linguagem de produto, cada um mapeado para stack existente, sem nova key em `STACK_VALUES`/`STACK_PROFILES` (verificável: `node -e` lista + `golden.spec.mjs` verde)
- [ ] Todo erro do wizard/checks imprime bloco 4-linhas (o quê/porquê/correção/onde-ver); dry-run imprime `NÃO EXECUTADO`; sucesso imprime marcador pico-fim (verificável: `wizard.spec.mjs` + `suite.spec.mjs` asserts)
- [ ] `init` em destino limpo executa W0–W7 com contador e `q` visível e instala; em destino divergente aborta create-only indicando `doctor` (verificável: teste greenfield + teste brownfield-abort)
- [ ] `doctor` em destino divergente diagnostica sem escrever nenhum byte (verificável: teste fs-mock zero-writes + relatório D0–D6)
- [ ] Higiene de segredos H1/M1–M4 (verificável: teste canário ausente em outputs, `--backup-dir`==target → `BACKUP_FAIL`, answers-file array → `BAD_ANSWER`, escape ANSI removido — arquivos-alvo `cli.spec.mjs`/`qa.spec.mjs`, barra: 0 falhas + ≥90% funções tocadas, corrige ALTA-004)
- [ ] Contrato CLI `init`/`doctor` (verificável: `--help` exit 0, sem `--target` exit 1, SPEC §9.5)
- [ ] `PROPOSAL.md` + `SPEC.md` passam em `proposal-gate` e `spec-gate` (checklists anexados em SPEC §13 — corrige ALTA-005); requisitos rastreáveis arquivo:linha; Delta Specs presente
- [ ] Suite completa do repo verde (`harness.config.json` `commands.suiteFull`), zero `pkill -f`, zero Lombok, zero skip harness

---

## 8. Completion Metadata

- **Archived on**: 2026-10-11
- **Duration**: 1 dia (2026-10-11 → 2026-10-11)
- **Archive path**: `.spec/archive/20261011-installer-melhoria/`
- **Files changed**: `installer/install.mjs`, `installer/__tests__/{suite,checks,wizard,cli,qa,doctor,mustfix-f1}.spec.mjs`, `.agents/skills/harness-installer/SKILL.md` (§7, §9.2 MODIFIED + §10, §11 ADDED), `.agents/rules/harness-config.md` (nota Key map), `spec-developed.md` (entrada), `harness/*.json` (evidências)
- **Verify**: PASS 3/3 (VERIFY.md 2026-10-11) — suite plugins 135/135 + installer 358/358 + static-checks + vendor-check, coverage funcs 96.21%
- **Delta merged into**: `.agents/skills/harness-installer/SKILL.md`, `.agents/rules/harness-config.md`, `spec-developed.md`
