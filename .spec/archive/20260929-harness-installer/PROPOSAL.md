# Change Proposal: harness-installer

> **ID**: `harness-installer`
> **Status**: `Under Review`
> **Author**: orchestrator (governança de agentes)
> **Date**: 2026-09-29
> **Source**: demanda do usuário pós-v7 + caso Hive (cópia verbatim => agentes alucinando)

---

## 1. Problem Statement

O harness-v7 funciona neste repo. Levá-lo a outro projeto hoje significa **copiar
`.agents/` + `.opencode/` na mão** — e a prova de que isso falha existe no Brain:
o repo Hive AI foi migrado assim e herdou domínio, stack, módulos, paths e design
system errados (`regras/projetos/hive/agents-rules-alignment`, 2026-09-24).
Agentes passaram a alucinar módulos e comandos inexistentes.

- **Contexto**: camada de governança; origem = repo `harness`; destino = qualquer repo
  com opencode (novo ou existente); referência = `atlas-ecm`.
- **Impacto atual**: sem instalador, cada adoção é cópia manual — ou não acontece,
  ou acontece errada (caso Hive). O v7 morre neste repo.
- **Evidência**: Brain Hive (lista de 20+ divergências por cópia); ADR-003 do v7
  (zero hardcode) nasceu exatamente dessa dor.

---

## 2. Proposed Solution

**Resumo**: script Node ESM que planta o harness num projeto destino via cópia assistida
+ Q&A que **gera** o config, com backup, merge por camada e manifesto — nunca cópia verbatim.

**Abordagem**:
- **Gerar, nunca copiar** (config): `harness.config.json` sai das respostas + validação
  contra o código real do destino (paths existem, comandos resolvem). É o anti-Hive.
- **Backup-first + merge**: nada é escrito no destino antes do backup; colisão =
  backup + merge por regra de camada, nunca sobrescrita silenciosa.
- **Manifesto** (`.harness-install.json`): instalado/mergeado/flagrado/backup/respostas
  (sem segredos). Sem ele, sem upgrade/desinstalação futura.
- **Checks pós-instalação**: JSON válido, comandos/paths resolvem, zero literais
  de domínio estranho, suite do harness verde no destino.
- **Dogfood**: instalação de referência numa CÓPIA de `atlas-ecm` (nunca no repo real).

**Alternativas descartadas**:
- *B — detecção automática de stack*: adivinhar pelo usuário repete o pecado original;
  Q&A explícito é mais chato e mais correto. Futuro, não agora.
- *Só documentar "copie estas pastas"*: é o procedimento que gerou o caso Hive.
- *Shell puro*: JSON/schema/testes são penosos em shell; repo já é Node ESM (plugins,
  checks, suite) — consistência de runtime.

---

## 3. Scope

### In Scope
- [ ] Script `installer/install.mjs` (inventário, backup, Q&A, geração, merge, manifesto, checks)
- [ ] Fixtures sobre diretórios temporários (alvo novo, alvo com conflitos, alvo limpo)
- [ ] Skill `.agents/skills/harness-installer/SKILL.md` (uso + contrato)
- [ ] Dogfood em cópia de `atlas-ecm` + 4 itens do aceite
- [ ] `--dry-run` (prevê sem escrever) e detecção de re-instalação (manifesto existente)

### Out of Scope
- Detecção automática de stack (futuro)
- Adaptação de `atlas-ecm`/`hive` de verdade (só cópia de dogfood)
- Upgrade/desinstalação (futuro; manifesto deixa pronto)
- Laya AI, worktree, qualquer mudança no v7 instalado

---

## 4. Architecture Impact

| Aspecto | Impacto | ADR Necessário? |
|---------|---------|-----------------|
| Backend / Frontend / DB / Tenancy / RBAC / Eventos | N/A — instalador não toca aplicação | Não |
| Segurança (segredos) | Respostas do Q&A nunca persistem segredo; backup contém arquivos do destino (tratar com cuidado) | Sim |
| Superfície nova | `installer/` + skill; manipula arquivos de OUTRO repo | Sim |
| Processo de agentes | Instalador roda como HUMANO via bash (fora dos gates); saída verificada por checks | Sim |

---

## 5. Delta Preview

| Documento Alvo | Tipo de Mudança | Seção Afetada |
|----------------|-----------------|---------------|
| `installer/install.mjs` | ADDED | — |
| `installer/__tests__/*.spec.mjs` | ADDED | — |
| `.agents/skills/harness-installer/SKILL.md` | ADDED | — |
| `.agents/rules/harness-config.md` | MODIFIED | como instalar / manifesto |
| `workflow-state.json` | MODIFIED | ciclo `harness-installer` |

---

## 6. Risk Assessment

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Sobrescrita sem backup | Baixa | Alto | backup obrigatório primeiro; aborta se falhar (I1) |
| Resposta errada no Q&A gera config inválido | Média | Médio | cada resposta validada (path existe, comando resolve) antes de escrever (I5/ADR-005) |
| Colisão em `opencode.json`/agents vira bagunça | Média | Médio | merge por camada + flag para humano; nunca auto-merge de prosa |
| Re-instalação duplica tudo | Média | Baixo | manifesto existente ⇒ aborta com instrução (idempotência declarada) |
| Segredo parado em manifesto/config | Baixa | Alto | nunca persistir segredo; aviso explícito no Q&A |
| Instalador usado como vetor (escreve em outro repo!) | Baixa | Alto | escopo restrito a governança; roda como humano (rastreável); sem segredos |

---

## 7. Success Criteria

- [ ] **Funcional**: roda limpo numa cópia de `atlas-ecm` (backup + merge + manifesto gerados, zero intervenção manual além do Q&A)
- [ ] **Funcional**: projeto instalado passa nos checks (JSON, comandos/paths resolvem, zero literais estranhos)
- [ ] **Técnico**: suite do harness verde no destino (`node --test` + static-checks)
- [ ] **Técnico**: restart + smoke no destino (deny PICCO, allow espelho, deny `pkill-f`, HITL)
- [ ] **Qualidade**: re-instalação aborta com mensagem (não duplica); `--dry-run` não escreve nada

---

## 8. Completion Metadata

- **Archived on**: —
- **Duration**: —
- **Archive path**: —
- **Files changed**: —
