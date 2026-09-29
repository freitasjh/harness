# Specification — harness-installer (v1)

- **Domínio:** `governanca-de-agentes` · **Tipo:** `feature`
- **Status:** `Em análise — aguardando security review + architect`
- **Proposal:** `.spec/governance/harness-installer/PROPOSAL.md`
- **Compatibilidade:** Node ESM (mesmo runtime dos plugins/checks); destino = qualquer repo com opencode

> Caso fundador: Hive AI herdou `.agents/` por cópia verbatim e alucinou domínio/stack
> (`regras/projetos/hive/agents-rules-alignment`). Este SPEC existe para tornar esse
> modo de falha **impossível por construção**: gerar-nunca-copiar + validar-contra-o-real.

---

## 1. Architecture Decision Records (ADRs)

### ADR-001: Node ESM, não shell
- **Decision**: instalador em Node ESM (`installer/install.mjs`), mesmo runtime dos
  plugins, checks e suite do repo.
- **Contexto**: JSON, schemas e testes são de primeira classe em Node; em shell são
  improviso. Testabilidade (`node --test`) decide.
- **Trade-offs**: exige Node no destino (pré-requisito documentado, não negociável).

### ADR-002: Gerar o config, nunca copiar (anti-Hive)
- **Decision**: `harness.config.json` do destino sai **exclusivamente** de respostas do
  Q&A + validação. Copiar o template com valores de outro projeto é proibido pelo gate
  de geração (I3) e pelo check pós-instalação.
- **Contexto**: o caso Hive é cópia verbatim com valores errados.
- **Trade-offs**: Q&A é mais lento que cópia; paga-se uma vez, usa-se para sempre.
- **Escopo honesto (architect)**: o "nunca copiar" vale INTEGRALMENTE para o config.
  Para rules/agents/skills/plugins copiados quando novos, a proteção anti-Hive é o
  check zero-literais (R3) + validação contra o real (ADR-005) — não a ausência de cópia.

### ADR-003: Backup-first + merge, nunca sobrescrita silenciosa
- **Decision**: nenhuma escrita no destino antes de backup completo versionado;
  falha no backup ⇒ aborta. Colisão ⇒ backup + merge por regra de camada.
- **Contexto**: instalador escreve em repo alheio — a ação mais perigosa do programa.
- **Trade-offs**: backup ocupa disco; aceito (segurança > economia).

### ADR-004: Manifesto obrigatório
- **Decision**: toda execução real grava `.harness-install.json` (versão, data, origem,
  instalados, mergeados, flagrados, dir do backup, respostas sem segredos).
  `--dry-run` não escreve nada (nem manifesto).
- **Contexto**: sem manifesto não há upgrade/desinstalação futura nem auditoria.
- **Trade-offs**: mais um arquivo no destino; documentado como pertencente ao harness.

### ADR-005: Validar contra o código real
- **Decision**: cada resposta do Q&A é validada antes de escrever (path existe no destino,
  comando resolve via `PATH`/arquivo, projeto declara stack compatível).
- **Contexto**: previne a classe inteira "referencia o inexistente" do caso Hive.
- **Trade-offs**: instalador precisa ler o destino (read-only) antes de escrever.

### ADR-006: Instalador roda fora dos gates (fronteira honesta)
- **Decision**: o instalador executa como HUMANO via bash. Os gates (`task`/`write`/`edit`)
  **não** o governam — e isso está declarado, não escondido. O que é governado é a
  SAÍDA: checks pós-instalação + dogfood. Fronteira explícita, não buraco.
- **Contexto**: gate que não cobre o caminho de instalação e finge cobrir é pior que
  admitir a fronteira (mesma doutrina do N15/U7=a).
- **Trade-offs**: confiança vem dos checks, não do processo.

### ADR-007: Fora de escopo, com porta aberta
- **Decision**: detecção automática de stack, upgrade/desinstalação e adaptação de
  consumidores ficam fora da v1. O manifesto (ADR-004) é o ponto de extensão.
- **Contexto**: escopo A aprovado (simples primeiro).
- **Trade-offs**: nenhum; evoluir sem manifesto seria recomeçar.

---

## 2. Domain Context & Units

- **Bounded Context**: provisionamento repo→repo de camada de governança.
- **Tipos**: script CLI + fixtures + skill de uso + checks.

| Unidade | Papel | Bloqueia? |
|---|---|---|
| `installer/install.mjs` | inventário, backup, Q&A, geração, merge, manifesto, checks | N/A (roda como humano) |
| `installer/__tests__/` | fixtures sobre diretórios temporários | N/A (prova) |
| `.agents/skills/harness-installer/` | contrato de uso para agentes/humanos | ❌ doc |
| checks pós-instalação | validam a saída | ✅ (veredito pass/fail) |
| `.harness-install.json` (no destino) | auditoria + base de upgrade futuro | ❌ dados |

---

## 3. Permission & Safety Model

O instalador não tem modelo de permissão próprio: roda com os privilégios do humano
que o invoca, no diretório que ele aponta. A segurança vem de **restrições de desenho**:

| Regra | Enforcement |
|---|---|
| Só escreve dentro do `--target` declarado | `resolve` + prefix-check no início; fora ⇒ aborta |
| Backup antes de tudo; falha ⇒ aborta | I1, verificável (backup existe?) |
| Nunca sobrescreve sem backup + regra de merge | I2 |
| Nunca persiste segredo (resposta marcada `secret` ⇒ só memória) | I5 + grep nos artefatos |
| `--dry-run` não escreve nada ( Nem manifesto) | I4 + teste com FS read-only fake |
| Re-instalação detectada (manifesto existe) ⇒ aborta com instrução | teste dedicado |
| Backup vive ao lado do target (ou `--backup-dir`), nunca dentro da árvore instalada | **exceção documentada (FU-22)**: fora da fence `assertInside`; a fence vale só para arquivos instalados/mergeados (`resolveBackupDir` sem prefix-check contra o target) |

---

## 4. Security

- **Segredos**: Q&A marca campos sensíveis; nunca vão para manifesto, config ou log.
  Checagem: fixture tenta injetar segredo falso e asserta ausência nos artefatos.
- **Backup**: contém arquivos do destino — fica ao lado do destino (ou `--backup-dir`),
  nunca é enviado a lugar algum pelo instalador. Avisar o humano.
- **Superfície**: o script escreve em repo alheio — por isso backup-first + dry-run
  default? **Decisão**: `--dry-run` é o modo padrão de primeira execução? NÃO — o padrão
  é interativo com confirmação explícita por camada antes de escrever. `--dry-run`
  só relata. (Sem confirmação cega.)
- **Dependências**: zero além de Node (sem rede, sem fetch, sem postinstall).

---

## 5. Data Model

### 5.1 Manifesto `.harness-install.json`
| Campo | Tipo | Obrig. |
|---|---|---|
| `version` / `date` / `source` (repo+commit do harness) | string | ✅ |
| `target` | string (path absoluto resolvido) | ✅ |
| `installed[]` | `{path, kind}` | ✅ |
| `merged[]` | `{path, strategy, backupRef}` | ✅ |
| `flagged[]` | `{path, reason}` (para humano) | ✅ |
| `backupDir` | string | ✅ |
| `answers` | object (SEM segredos) | ✅ |
| `checks` | `{passed, failed[]}` | ✅ |
| `manifestSchemaVersion` | int (1 na v1) | ✅ |
| `fileHashes[]` | `{path, sha256, preMergeSha256?}` por instalado/mergeado | ✅ |
| `flaggedResolution[]` | `{path, status: open/resolved, how}` | ✅ |
| `validationMarks[]` | `{item, validated|na-justificado}` | ✅ |

### 5.2 Merge por camada (precedência)
| Camada | Novo (não existe) | Existe igual | Existe diferente |
|---|---|---|---|
| `opencode.json` | cria chaves do harness | nada | merge: `plugin[]` união, `instructions` append, `permission/agent` só-adiciona; conflito real ⇒ **flag** |
| `.agents/agents/*` | copia | nada | anexa seção `Harness v7` se ausente; senão **flag** |
| `.agents/rules/*` | copia | nada | **flag** (nunca auto-merge de prosa) |
| `.agents/skills/*` | copia | nada | **flag** |
| `.opencode/plugins/*` | copia | nada | **flag** (código!) |
| `harness.config.json` | **gera** | **gera** (sobrescrito a partir do Q&A, com backup do anterior) | idem |
| QUALQUER arquivo | **existe-mas-corrompido** (ex: `opencode.json` com JSON inválido) | **aborta** com motivo; nunca tenta merge nem escreve pior (R1) | aborta |
| QUALQUER camada | colisão resulta em **flag** | `flagged[]` não-vazio ⇒ checks = **FAIL** até resolução humana (R2); sem categoria aviso — todo flag bloqueia na v1 | FAIL + lista acionável |
| resto do destino | — | — | **intocado sempre** |

---

**Detectores (R4)**: conflito em `opencode.json` = parse + deep-compare semântico
(normalizado, whitespace-insensitive); seção ausente em `agents/*` = match de header
de seção normalizado. Ambos com teste negativo (quase-igual que NÃO deve casar).

## 6. Hook Registry
N/A — instalador fora dos gates por desenho (ADR-006). Equivalente funcional: os
**checks pós-instalação** (executáveis, com veredito). Nenhum hook é afirmado.

---

## 7. Invariants

| # | Invariante | Enforcement | Garantia |
|---|---|---|---|
| I1 | Nada é escrito antes do backup existir e verificado | abort se backup falha | 🟢 (teste dedicado) |
| I2 | Nenhuma sobrescrita silenciosa (toda escrita = novo, merge com backup, ou flag) | revisão do plano de escrita no `--dry-run` + teste | 🟢 |
| I3 | `harness.config.json` sempre gerado, nunca copiado | diff contra template proibido por construção (não há caminho de cópia no código) + teste | 🟢 |
| I4 | Manifesto em toda execução real; nada escrito em dry-run | teste com FS fake | 🟢 |
| I5 | Segredo nunca persistido | fixture injeta segredo falso e asserta ausência (inclui log) | 🟢 |
| I6 | Flag pendente ⇒ checks FAIL | `flagged[]` não-vazio bloqueia veredito até resolução humana | 🟢 |

---

## 8. Functional Requirements

| ID | Requisito |
|---|---|
| RF-01 | inventário do destino (agents/rules/skills/config/plugins existentes) |
| RF-02 | backup versionado antes de qualquer escrita; falha ⇒ aborta |
| RF-03 | Q&A interativo com validação por resposta (path/comando/stack) |
| RF-04 | geração do `harness.config.json` só de respostas validadas |
| RF-05 | merge por camada conforme §5.2 (flag onde indicado) |
| RF-06 | manifesto completo ao final de execução real |
| RF-07 | checks pós-instalação (JSON, resolve, zero-literais em TODOS copiados, flagged vazio) com veredito |
| RF-08 | `--dry-run` relata o plano sem escrever nada |
| RF-09 | re-instalação detectada ⇒ aborta com instrução |
| RF-10 | confirmação humana por camada antes de escrever (sem modo cego) |

---

## 9. Test Strategy

- **Unit/fixtures** (`installer/__tests__/`): diretórios temporários como destinos —
  novo vazio, existente com conflitos, existente limpo; `--dry-run` com FS fake;
  segredo falso; re-instalação; cada invariante I1..I5 com positivo+negativo.
- **Dogfood**: instalação numa CÓPIA de `atlas-ecm` em `/tmp` (nunca no repo real);
  allowlist exata de paths de teste + abort fora dela (Y4).
- **Canário (R3)**: fixture planta literal sabidamente-estranho numa rule copiada e
  asserta que o check falha; denylist inicial publicada no teste.
  depois suite + restart + smoke do destino + grep de literais estranhos.
- **Regressão**: suite do harness intacta (instalador não toca o repo de origem).

---

## 10. Files Affected

| Arquivo | Delta |
|---|---|
| `installer/install.mjs` | ADDED |
| `installer/__tests__/*.spec.mjs` | ADDED |
| `.agents/skills/harness-installer/SKILL.md` | ADDED |
| `.agents/rules/harness-config.md` | MODIFIED (como instalar + manifesto) |

---

## 11. Risks

| R | Sev | Mitigação |
|---|---|---|
| R1 escrita em path fora do target (typo, `..`) | alto | prefix-check no início; teste com `..` |
| R2 backup falha silenciosa e escrita prossegue | alto | I1: verifica backup antes; teste |
| R3 Q&A cansativo leva a resposta "qualquer" | médio | validação bloqueia resposta inválida; `N/A` justificado onde aplicável |
| R4 colisão em `opencode.json` quebra projeto | médio | merge aditivo + flag; dry-run mostra antes |
| R5 dogfood acidental no repo real | alto | alvo sempre sob `/tmp`, com trava (recusa paths fora de allowlist de teste fora de `--target` explícito com confirmação) |
| R6 segredo no manifesto | alto | I5 + fixture dedicada |

---

## 12. Verification

| # | Verificação | Critério |
|---|---|---|
| V1 | fixtures | todos verdes (I1..I5 com 2 ramos) |
| V2 | `--dry-run` | zero writes (FS fake conta) |
| V3 | dogfood em cópia atlas-ecm | 4 itens do aceite |
| V4 | re-instalação | aborta com instrução |
| V5 | `harness.config.json` gerado | difere do template onde o destino difere; comandos/paths resolvem |
| V6 | SPEC gate | conformidade §13 |
| V7 | canário anti-Hive | literal plantado => check falha |

---

## 13. Spec Gate — conformidade

| Critério | Status |
|---|---|
| ADRs | OK §1 (001..007) |
| DDD Modular | N/A — sem código de aplicação |
| Segurança/IAM | N/A como app; §3 (modelo de segurança do instalador) + §4 |
| ERD | N/A; §5 (manifesto + merge) |
| Event Registry | N/A; §6 (fronteira honesta) |
| Migrations | N/A |
| Invariantes | §7 (I1..I5, todas testáveis) |
| Invariantes de Workflow | N/A (instalador é linear: inventário→backup→Q&A→merge→manifesto→checks) |
| Test Strategy | §9 (fixtures + dogfood em cópia) |
| Single File | OK |
| Domínio claro | OK — `governanca-de-agentes` |

---

## 14. Spec Score

**92%** — 0 críticos abertos; R1–R4 + Y1 incorporados pós-architect (aprovar-com-ajustes).
Débito conhecido: sem detecção automática (futuro, com porta no manifesto).

---

## 15. Security Assessment — Fase 1 (skill `security-review`)

> Checklist da skill é orientado a aplicação; adaptado à única superfície real:
> **um script que escreve em repo alheio**. Ameaça = o instalador como vetor.

### 15.1 Threat Model (STRIDE)

| Ameaça | Fluxo | Risco | Mitigação | Status |
|---|---|---|---|---|
| **Tampering** | escrita fora do `--target` (typo, `..`) | Alto | prefix-check + abort; teste R1 | 🟢 mitigado |
| **Tampering** | backup falha e escrita prossegue | Alto | I1 (verifica antes); teste | 🟢 mitigado |
| **Information Disclosure** | segredo do Q&A parado em manifesto/config/log | Alto | I5 + fixture dedicada; aviso explícito | 🟢 mitigado |
| **Tampering** | dogfood acidental no repo real | Alto | trava: só `/tmp` sem `--target` explícito + confirmação (R5) | 🟢 mitigado |
| **Elevation** | rodar como root amplia qualquer erro | Médio | **GAP 🟡**: recusar uid 0 sem `--allow-root` (ir para o PLAN) | 🟡 levar ao PLAN |
| Repudiation | "não fui eu que instalei isso" | Baixo | manifesto = trilha de auditoria | 🟢 mitigado |
| Spoofing/DoS clássicos | — | — | N/A (roda local, sem rede, sem daemon) | N/A justificado |

### 15.2 Gaps
- 🔴 **Críticos: 0**
- 🟡 **Médio: 1** — recusa de uid 0 (`--allow-root` explícito); dono: PLAN.
- 🟢 **Baixo: 0**

### 15.3 Verdict
**partial** — nenhum item bloqueia Fase 2; fronteira honesta (ADR-006) + resíduos nomeados.
