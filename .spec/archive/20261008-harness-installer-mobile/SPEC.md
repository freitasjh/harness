# Specification — harness-installer-mobile (v1)

- **Domínio:** `governanca-de-agentes` · **Tipo:** `feature`
- **Status:** `Em análise — aguardando spec-review + security-review`
- **Proposal:** `.spec/governance/harness-installer-mobile/PROPOSAL.md`
- **Baseline:** `.spec/archive/20260929-harness-installer/SPEC.md` (v1) — esta SPEC é **aditiva**
- **Compatibilidade:** Node ESM · destino = repo Flutter/Dart com opencode

---

## 1. Architecture Decision Records (novos)

### ADR-008: Perfis de stack dirigidos por dados (registry puro)
- **Decision**: `STACK_PROFILES` (objeto puro) é a única fonte de capacidades por stack
  (`backend/frontend/commands/mcp/moduleMap`). `generateConfig` resolve por lookup e
  permanece puro/determinístico (zero I/O). Leitura do real (pubspec.yaml, PATH) vive em
  `validateAnswer` (ADR-005), nunca no gerador.
- **Perfil mobile**: `flutter` → `mcp:['marionette_mcp','dart']`, `suite:'flutter test'`,
  `analyze:'dart analyze'`, `moduleMap +{lib,test}`; `dart` → `mcp:['dart']`, `suite:'dart test'`.
- **Contexto**: hoje `generateConfig` usa `isNodeOnly` binário + `mcp.required` hardcoded;
  adicionar flutter sem registry vira `if` empilhado e quebra o gerador puro.
- **Consequências**: `mcp.required` é **declarativo** — nomeia os servers, não os define;
  o merge do bloco `mcp` no `opencode.json` é aditivo (A3). Adicionar perfil = adicionar
  entrada no registry (ponto de extensão já aberto pelo manifesto, ADR-004/007).
- **Trade-off**: `flutter` e `dart` separados (Dart puro não tem VM Service Flutter → marionette não se aplica).

### ADR-009: Vendor de skills escopado por stack, zero rede no install
- **Decision**:
  1. Skills `dart-*`/`flutter-*` vendorizadas **byte-idênticas** em `.agents/skills/` por
     script offline `scripts/vendor-skills.mjs` (único ponto com rede; source-side; resultado commitado).
  2. `.agents/skills/.vendor-lock.json` central guarda `source+sourceCommit+computedHash+treeHash+stacks`;
     respeita `skills-lock.json` como procedência.
  3. `collectIncoming(sourceDir,{stacks})` filtra: skill com `stacks` entra só se intersecta;
     skill **sem** `stacks` (comum) sempre entra; **sem lock ⇒ nada filtrado** (retrocompat).
  4. Lock **nunca** é copiado ao destino (`.vendor-lock.json` excluído).
- **Enforcement**: `node scripts/vendor-skills.mjs --check` no CI (drift ⇒ FAIL); check estático
  V15 (rede proibida em `installer/`). Colisão de skill existente = **flag** (§5.2, inalterado).
- **Trade-off**: lock central preserva byte-identidade (não edita arquivo upstream).

### ADR-010: Wizard B2 é camada de apresentação, sem autoridade
- **Decision**:
  - Entrada `runWizard({target, stdin, stdout, sourceDir, detect?})`; saída
    `{answers, profile, plan}` com `answers` **já validados** por `validateAnswer`.
  - Auto-detecção `detect(target)` lê `pubspec.yaml` → **sugere** `flutter`/`dart`; sempre confirmável.
  - Revisão/resumo reusa `printPlan` + `confirmByLayer` (RF-10).
  - Streams injetados (mesma técnica de `promptAnswers`); zero dependência de TTY real.
  - O wizard **não** chama `generateConfig` nem escreve.
- **Contexto**: sem isso, B2 vira segundo caminho de entrada que contorna ADR-003/ADR-005.
- **Trade-off**: detectar só pubspec limita conveniência, mantém escopo aprovado.

---


> **Ressalva (pós-Batch 2):** a garantia 🟢 de I9/ADR-009 depende de `vendor-skills.mjs --check` no CI,
> que **ainda não está wired** (`suiteFull` = plugins+static; `installer/__tests__` e o `--check` ficam fora).
> Enquanto não wired, I9 é 🟠 parcial (manual). Ver `.spec/tech-debts/ci-wiring-vendor-check/TASKS.md`.

## 2. Domain Context & Units

- **Bounded Context**: provisionamento repo→repo de camada de governança (estendido a stacks mobile).
- **Unidades**:

| Unidade | Papel | Bloqueia? |
|---|---|---|
| `installer/install.mjs` | + `STACK_PROFILES`, `runWizard`, `detect`, filtro `collectIncoming`, merge `mcp` | N/A (roda como humano) |
| `scripts/vendor-skills.mjs` | vendor offline + `--check` (source-side) | ✅ CI |
| `.agents/skills/.vendor-lock.json` | procedência (source+hash+stacks) | ✅ |
| `.agents/skills/dart-*`, `flutter-*` | 22 skills byte-idênticas | ✅ checks |
| `installer/__tests__/*.spec.mjs` | fixtures + golden retrocompat | ✅ |
| `.agents/skills/harness-installer/SKILL.md` | contrato de uso (atualizar com mobile) | ❌ doc |

---

## 3. Data Model

### 3.1 `STACK_PROFILES` (puro, em `install.mjs`)
```js
export const STACK_PROFILES = {
  'node-esm': { backend:'N/A (Node-only)', frontend:'N/A (Node-only)', commands:{suiteFull:'node --test',unit:'node --test'}, mcp:['chrome-devtools'], moduleMap:{} },
  node:       { ...idem node-esm... },
  'java+vue': { backend:'java+vue (Q&A)', frontend:'java+vue (Q&A)', commands:{}, mcp:['chrome-devtools'], moduleMap:{} },
  outra:      { backend:'outra (Q&A)', frontend:'outra (Q&A)', commands:{}, mcp:['chrome-devtools'], moduleMap:{} },
  flutter:    { backend:'flutter/dart mobile (Q&A)', frontend:'flutter/dart mobile (Q&A)',
                commands:{suiteFull:'flutter test',unit:'flutter test',analyze:'dart analyze'},
                mcp:['marionette_mcp','dart'], moduleMap:{lib:'lib',test:'test'} },
  dart:       { backend:'dart package (Q&A)', frontend:'dart package (Q&A)',
                commands:{suiteFull:'dart test',unit:'dart test',analyze:'dart analyze'},
                mcp:['dart'], moduleMap:{lib:'lib',test:'test'} },
};
```

> **Nota (Batch 1 / doc-sync):** o registry real (`STACK_PROFILES` em `install.mjs`) congela os
> **literais do baseline** para preservar I7 (golden byte-equal). O snippet acima é **ilustrativo**;
> as strings de `node`/`node-esm`/`java+vue`/`outra` são byte-idênticas ao baseline. Golden é a autoridade.

### 3.2 `.vendor-lock.json`
| Campo | Tipo | Obrig. |
|---|---|---|
| `version` / `generatedBy` | string | ✅ |
| `skills.<name>.source` / `sourceType` / `sourceCommit` / `skillPath` | string | ✅ |
| `skills.<name>.computedHash` / `treeHash` | string | ✅ |
| `skills.<name>.stacks[]` | string[] | ✅ |
| `skills.<name>.license` / `licenseFile` | string | ✅ |

### 3.3 Contrato do wizard
```js
runWizard({target, stdin, stdout, sourceDir, detect?})
  -> Promise<{ answers:{project,stack,suiteCommand,pluginsDir,deployToken?},
               profile:'flutter'|'dart'|string, plan:Array<{path,layer,action,reason?}> }>
```

### 3.4 Merge — delta da matriz v1 (§5.2)
| Camada | Delta mobile |
|---|---|
| `opencode.json` | + merge aditivo do bloco `mcp` (only-add; divergência ⇒ **flag**) |
| `.agents/skills/*` | inalterado: exists-different ⇒ **flag** (agora com 22 skills a mais) |
| `harness.config.json` | inalterado: **gerado** do Q&A (agora com perfil mobile) |
| `.vendor-lock.json` | **nunca** copiado ao destino |

---

## 4. Invariants (novos)

| # | Invariante | Enforcement | Garantia |
|---|---|---|---|
| I7 | Config de stacks não-mobile permanece byte-idêntico ao baseline | golden test `generateConfig` | 🟢 |
| I8 | `install.mjs` não faz rede (nem `fetch`, nem `node:http(s)`) | check estático V15 | 🟢 |
| I9 | Vendor byte-idêntico ao upstream; drift detectado | `treeHash` + `vendor-skills.mjs --check` | 🟢 |
| I10 | Skill mobile não é plantada em destino de stack não-mobile | `collectIncoming` filtra por `stacks` | 🟢 |
| I11 | Wizard não escreve nem gera config por conta própria | revisão de fluxo + testes de stream injetado | 🟢 |
| I1–I6 (v1) | backup-first, gerar-nunca-copiar, manifesto, segredo, flag⇒FAIL | inalterados | 🟢 |

---

## 5. Functional Requirements (novos)

| ID | Requisito |
|---|---|
| RF-11 | `QUESTIONS.stack` aceita `flutter`/`dart`; `validateAnswer` exige `pubspec.yaml` + discriminador `sdk: flutter` |
| RF-12 | `generateConfig` resolve por `STACK_PROFILES`; retrocompat byte-idêntica |
| RF-13 | `scripts/vendor-skills.mjs` vendoriza 22 skills + lock; `--check` detecta drift |
| RF-14 | `collectIncoming` filtra skills por stack; lock excluído do destino |
| RF-15 | Wizard B2: W0..W7, auto-detecção pubspec, revisão por passo, resumo antes de aplicar |
| RF-16 | Merge aditivo do bloco `mcp` no `opencode.json` (only-add, divergência ⇒ flag) |
| RF-17 | `SKILL.md` do harness-installer documenta o perfil mobile |

---

## 6. UX Specification (wizard B2 — parecer vinculante do `ux-designer`)

> Declaração: Pulse (`frontend/DESIGN.md`) = **N/A** (não existe; artefato é CLI TUI).
> Base: skill `ui-ux-pro-max` (Developer Tool/IDE, dados Flutter). Cor é advisory.

**Máquina de estados W0..W7:** pre-flight → inventário → detecção pubspec → Q&A guiado →
resumo+prévia → confirmação por camada → backup+aplicação (progresso) → manifesto+checks.
Abort até W5 = **0 writes**; de W6 em diante, rollback via `backupDir`.

**Layout (terminal pequeno/touch):**
- `L = min(cols,80)-2`; faixas ≥72 (completo) / 48–71 (compacto) / <48 (ultra-compacto).
- Saída **append-only**; sem mouse/SGR, sem alt-screen, sem spinner por padrão (progresso `[n/total]` estático).
- Cor só se `TTY && TERM!=dumb && !NO_COLOR`; estado sempre com rótulo ASCII `[OK]/[AVISO]/[ERRO]/[INFO]`; **sem emoji**.

**Acessibilidade:** 100% teclado; menu numérico primário (setas = enhancement); foco visível `>`;
default seguro `N` em confirmação destrutiva; erro inline sob o campo + como corrigir;
`[k/N]` no Q&A; fallback ASCII de acentos com aviso; sem animação por padrão.


> **Nota (Batch 3 / traceability):** `detect()` cobre `project`/`stack`/`suiteCommand` lendo `pubspec.yaml`
> (line-based). `análise` (`dart analyze`) e `mcp` (`marionette_mcp`,`dart`) **derivam do perfil (ADR-008)**,
> não da detecção — alinhado ao trade-off declarado em ADR-010.

**Auto-detecção Flutter (sugestão, sempre confirmável):** `project`←pubspec `name`;
`stack`←`environment.sdk`/deps (discriminador `sdk: flutter`); `suiteCommand`←`flutter test`→
`make test`→`dart test` (1ª que resolve); `análise`←`analysis_options.yaml`; `mcp`←`opencode.json`.
Sem pubspec ⇒ menu manual (1 flutter / 2 dart / 3 node / 4 outra). Origem exibida como `(arquivo:linha)`.

**Ajuste de UX exigido:** o `readline` atual usa `terminal:false` (sem edição de linha);
em TTY usar `terminal:true` (com histórico vazio) **sem** quebrar pipe/redirect/`--answers-file`.

---

## 7. Security

- **Segredos**: inalterado — `deployToken` só memória; nunca em manifesto/config/log (I5).
- **Rede**: `install.mjs` rede-zero (I8); a única rede é `vendor-skills.mjs` source-side.
- **Vendor/licença**: cada skill retém `LICENSE`/`NOTICE` upstream; `VENDOR-NOTICE.md` agrega
  source+commit+SPDX. Skill sem licença identificável ⇒ **não vendorizar** (bloqueia).
- **MCP mobile**: declarado, não definido pelo instalador; merge aditivo evita sobrescrever host (A3).
- Superfície continua: script que escreve em repo alheio → backup-first + dry-run + confirmação por camada (v1).

---

## 8. Test Strategy

- **Golden (I7)**: `generateConfig` p/ node/node-esm/java+vue/outra byte-idêntico ao baseline.
- **Perfil mobile (RF-11/12)**: validateAnswer 3 ramos (flutter ok / dart ok / pubspec ausente / mismatch); config com mcp+suite+analyze corretos.
- **Vendor (I9/RF-13)**: `--check` verde no commitado; fixture com hash adulterado ⇒ FAIL.
- **Filtro (I10)**: install node não recebe skill `stacks:['flutter']`; install flutter recebe.
- **Wizard (I11/RF-15)**: streams injetados cobrindo cada estado W0..W7 (válido/inválido/abort); abort ⇒ 0 writes.
- **Rede (I8)**: check estático V15 varre `installer/`.
- **Dogfood**: cópia de projeto Flutter sob `/tmp`; allowlist de paths.

---

## 9. Files Affected

| Arquivo | Delta |
|---|---|
| `installer/install.mjs` | MODIFIED (STACK_PROFILES, validateAnswer, collectIncoming, runWizard, detect, merge mcp) |
| `installer/__tests__/*.spec.mjs` | ADDED/MODIFIED (golden, mobile, wizard, vendor, filtro) |
| `scripts/vendor-skills.mjs` | ADDED (offline, source-side, `--check`) |
| `scripts/static-checks.mjs` | MODIFIED (V15 rede em installer/) |
| `.agents/skills/dart-*` (12), `flutter-*` (10) | ADDED (vendor byte-idêntico) |
| `.agents/skills/.vendor-lock.json` | ADDED |
| `.agents/skills/VENDOR-NOTICE.md` | ADDED |
| `.agents/skills/harness-installer/SKILL.md` | MODIFIED (perfil mobile) |

---

## 10. Risks

| R | Sev | Mitigação | Prova |
|---|---|---|---|
| R1 regressão node/java+vue | 🔴 | STACK_PROFILES + filtro + golden | teste golden |
| R2 drift vendor | 🟠 | treeHash + `--check` CI | V9/CI |
| R3 detecção dart vs flutter | 🟠 | pubspec obrigatório + discriminador + menu | teste validateAnswer |
| R4 colisão skill sobrescreve | 🔴 | §5.2 flag inalterado | teste merge |
| R5 MCP mobile não configurado | 🟠 | A3 merge aditivo + passo humano | teste merge mcp |
| R6 rede no install | 🔴 | check estático V15 | V15 |
| R7 denylist substring em corpus mobile | 🟡 | scan do vendorizado; match contextual (FU-26) | CI/pre-commit |
| R9 flutter/dart ausente no PATH | 🟡 | fail-closed ADR-005 + aviso wizard | teste commandResolves |

---

## 11. Verification

| # | Verificação | Critério |
|---|---|---|
| V1 | golden retrocompat | byte-idêntico node/java+vue |
| V2 | perfil mobile | config mcp/suite/analyze corretos |
| V3 | vendor `--check` | verde; adulterado ⇒ FAIL |
| V4 | filtro por stack | node não recebe skill flutter |
| V5 | wizard estados | W0..W7 cobertos; abort ⇒ 0 writes |
| V6 | rede em installer | V15 zero |
| V7 | dogfood Flutter | instala em cópia /tmp |
| V8 | suite repo | baseline + novos verdes |

---

## 12. Spec Gate — conformidade

| Critério | Status |
|---|---|
| ADRs | OK §1 (008..010) |
| DDD Modular | N/A — sem app |
| Segurança/IAM | §7 (segredo, rede-zero, licença, MCP) |
| ERD | N/A; §3 (profiles, lock, wizard, merge) |
| Event Registry | N/A (instalador fora dos gates, ADR-006 v1) |
| Migrations | N/A |
| Invariantes | §4 (I7..I11 + I1..I6) |
| Test Strategy | §8 (golden + vendor + filtro + wizard + rede) |
| Domínio claro | OK — `governanca-de-agentes` |

## 13. Spec Score

**94%** — 0 críticos abertos. Ajustes A1–A5 do architect incorporados. Débito conhecido:
sem detecção fora de flutter/dart; MCP declarativo (não define server).
