# Spec Review — harness-installer-mobile

- **Skill:** `spec-review` (adaptada: SPEC = CLI de governança Node, não app TaskFlow Spring/Vue)
- **Artefato:** `.spec/governance/harness-installer-mobile/SPEC.md` (v1, score 94%)
- **Data:** 2026-10-07

> Observação de adaptação: os checklists DDD Modular (api/impl/public), JPA, Flyway,
> Vue 3/Pinia/Vuetify e JUnit/Mockito são **N/A** — não há aplicação neste artefato.
> Validados: estrutura da spec, RFs verificáveis, invariantes, estratégia de testes,
> riscos, segurança do instalador-como-vetor.

## Scorecard

| Categoria | Status |
|---|---|
| Estrutura da spec (título/escopo/deps/riscos) | ✅ |
| ADRs | ✅ (008–010 + v1 preservados) |
| Requisitos funcionais verificáveis | ✅ (RF-11..17) |
| Invariantes testáveis | ✅ (I7..I11) |
| Estratégia de testes | ✅ (golden/vendor/filtro/wizard/rede) |
| DDD Modular / JPA / Flyway | N/A justificado |
| Vue 3 / Pinia / Vuetify | N/A justificado |
| Testes JUnit/Mockito | N/A justificado |
| Segurança do instalador | ⚠️ ver SECURITY.md |
| Localização do artefato | ⚠️ G7 |

**Score de conformidade: 90%**

## Gaps

### 🟠 Alta
- **G1 — baseline suite não verificado.** SPEC §V8 aceita "baseline + novos verdes"; o
  número "60/60" citado no handoff do architect **não foi conferido**. Ação (PLAN): rodar
  `commands.suiteFull` real e congelar o baseline antes do golden test.
- **G2 — licença das skills upstream.** `skills-lock.json` do mobile **não traz campo de
  licença**; a SPEC §7 diz "skill sem licença identificável ⇒ não vendorizar". Ação (PLAN):
  conferir LICENSE de `dart-lang/skills` e `flutter/skills`; definir o que fazer se ausente
  (bloquear vendor OU atribuir via `VENDOR-NOTICE.md` com fonte+commit). Sem isso, A1 fica ambíguo.

### 🟡 Média
- **G3 — parse do `pubspec.yaml` no `detect()`.** SPEC não define as regras de leitura
  (YAML completo? line-based?). Restrição zero-dep proíbe parser YAML. Ação: especificar
  leitura **line-based** minimista (`name:`, `environment: sdk:`, presença de `flutter:`).
- **G4 — `detect()` lê bloco `mcp` do `opencode.json`, e se ausente?** Ação: definir default
  do perfil mobile mesmo sem MCP declarado no destino (gerar config mínimo + passo humano no resumo).
- **G5 — `pluginsDir` no contexto mobile.** Projeto Flutter tem `.opencode/plugins`? Sim no
  mobile ref, mas o perfil não deve exigir. Ação: default por profile (target root) sem quebrar validação.

### 🟢 Baixa
- **G6 — `terminal:true` em TTY** (UX §6) pode impactar testes que assumem `terminal:false`.
  Ação: teste de regressão do leitor.
- **G7 — localização em `.spec/governance/`** diverge de `sdd-workflow-standard.md §1`
  (manda `backend/`/`frontend/`). Justificativa: precedente do próprio domínio
  (`harness-installer` v1 também usou `governance/`); artefato não é backend nem frontend.
  Ação: registrar a exceção; ou mover para `.spec/backend/governanca-de-agentes/` se o padrão for estrito.

## Pontos positivos
- Golden test de retrocompat (I7) é forte e barato.
- Vendor com proveniência dupla (`computedHash` + `treeHash`) + `--check` no CI.
- Rede-zero no install (I8) + wizard sem autoridade (I11) preservam os invariantes v1.
- Matriz de risco explica cada supressão; UX do wizard tem crítica Nielsen embutida.

## Plano de ação
| Gap | Sev | Ação | Dono | Quando |
|---|---|---|---|---|
| G1 | 🟠 | Congelar baseline da suite | PLAN/Execution | antes do golden |
| G2 | 🟠 | Decidir/licenciar vendor | PLAN | bloqueia A1 |
| G3 | 🟡 | Especificar parse line-based | PLAN | task wizard |
| G4 | 🟡 | Default MCP ausente | PLAN | task detect |
| G5 | 🟡 | Default pluginsDir por profile | PLAN | task Q&A |
| G6 | 🟢 | Teste regressão leitor | Execution | com wizard |
| G7 | 🟢 | Registrar exceção de path | SPEC v1.1 | junto |

## Veredito do spec-review
**APROVADO COM AJUSTES** — 0 🔴. G1 e G2 são 🟠 e devem ser endereçados no PLAN antes
da implementação; G3/G4/G5 são decisões de detalhamento no PLAN.
