# ADR-004 — Referências quebradas: rubrica de ação por classe com predicado por comando e dono — reapontar a SSoT declarada, remover baseline de eixo fora de suporte com reativação, e medir N30 no detector selado

- **prd-id**: `prd-agnostic-artifacts` — `.spec/prd/prd-agnostic-artifacts/PRD.md`
- **order**: 4 de 5 (`.spec/prd/prd-agnostic-artifacts/ADR-INDEX.md`)
- **status**: `in-progress`
- **branch**: `adr/prd-agnostic-artifacts/04-referencias-e-design-md` (de `main` @ `b5c23dd`, HEAD `fe42912`)
- **depende-de**: `ADR-001, ADR-003` — herda do **ADR-001** o predicado de A-3 (a gramática do `V18` para `rules/*.md`), a **segunda gramática declarada** (`.doc/**`, `frontend/DESIGN.md`) publicada como `refs-undetected`, o **oráculo de §10-N7** (o número que vale é o da linha do `V20`/`V18`, nunca o parágrafo de um ADR) e a exigência de **zero comando novo no `suiteFull`** (§2.6: selo intacto). Herda do **ADR-003** a disciplina de **re-medir quando o payload muda** (§11-H6: `population=223/30385` porque o próprio portão ganhou 23 linhas) — é por isso que as contagens do `PRD.md` §3.5 (16/8/7/6/4/3/2/1, "52 citações") **não** são reaprovadas aqui: `spec-review` saiu do payload e levou parte delas. Nenhum dos dois é dispensável: sem o ADR-001 não há régua nem oráculo; sem o ADR-003 não há regra de que o número publicado muda com o artefato que o mede.
- **data**: 2026-11-16
- **dono da decisão**: owner do harness — portão **G1** (PRD §16). Três decisões, transcritas do `PRD.md:330,331` e do `RESEARCH.md:185` (R5): **D4** = *"remover as 52 citações e declarar Java fora do suporte atual; as rules voltam quando o PRD-4 (`prd-axes-split`) habilitar o eixo backend"* — com a ressalva obrigatória de R5: *"remover puro é o único veredito que colide com RF-04"*; **D5** = *"remover o ponteiro agora: os 3 agentes deixam de citar `frontend/DESIGN.md`. O `DESIGN.md` correto nasce com o harness de frontend (**PRD-5**), que passa a ser o dono do arquivo"*; **N30** = o link-ref `[//]: # (skill)` compraria `consumer` falso no `V19` — coberto por **extensão do detector de refs**, não por lint externo (`RESEARCH.md:174`).
- **rota**: refactor de documentação normativa (rubrica + prosa; nenhum comportamento de produto observável ⇒ não gera PRD novo; `.agents/rules/prd-adr-pipeline.md` §3)
- **insumo de pesquisa**: `RESEARCH.md` §8 (recomendação do ADR-004: *"veredito por path (criar / reapontar / remover citação) com D4 = remover as 52 citações e declarar Java fora de suporte até o PRD-4; D5 = remover o ponteiro `DESIGN.md` dos 3 agentes; N30 coberto por extensão do detector de refs, não por lint externo"*; critério: *"`V18` baseline ≤ 1 e 0 citação de `DESIGN.md`, com 9/9 vereditos e zero dependência nova de toolchain"*) e §9-R5 (tensão da SSoT). `PRD.md` §3.5 (heranças), §3.6 (A-3), §9 (RF-05, RF-07), §13, §16 (D4/D5). Rubric original: `ADR-005` do PRD-1 (`.spec/prd/prd-harness-inventory/ADRs/ADR-005-prosa-orfa/ADR.md` §2.2/§2.3, classes C1..C6) — **reutilizada por referência, não reaberta**.
- **escopo de escrita desta entrega**: `.spec/prd/prd-agnostic-artifacts/**` (`ADR.md` + 1 linha no `ADR-INDEX.md`, com a promoção do `ADR-003` a `merged`). **Nenhum** arquivo de `.agents/**`, `installer/**`, `opencode.json`, `harness.config.json`, `scripts/**` ou `.opencode/plugins/**` foi tocado — as reescritas, a baseline, os donos e a extensão do detector são o **SDD deste ADR**.
- **escopo não decidido aqui**: frota identitária restante (`TaskFlow`), proibições, catálogo e skills por eixo (ADR-005); criação do `DESIGN.md` (PRD-5); reativação do eixo backend (PRD-4); runner do `V20` no destino e mapa novo no instalador (PRD-3); qualquer alteração em `gate.js` (nenhuma).

---

## 1. Contexto — o que a medição diz hoje (pós-ADR-003)

Todos os números abaixo foram **re-medidos** em `b5c23dd` / `fe42912` (2026-11-16), não copiados do PRD. O oráculo é a linha publicada pelo instrumento; este parágrafo é a **previsão derivada**, não contrato (ADR-001 §10-N7, ADR-003 §11-H6).

| Fato medido | Valor no HEAD | Comando |
|---|---|---|
| `V18` — dívida de refs `rules/*.md` | `baseline=7 (2 C1 + 5 C2)`, `non-defect=1` | `node scripts/static-checks.mjs \| grep V18` |
| `V19` — inventário | `skills=47 (vendor-by-axis=25, consumer=21, axis=0, orphan=1)`, `rules=8 (consumer=7, axis=1, orphan=0)`, `agents=10/10` | `node scripts/static-checks.mjs \| grep V19` |
| `V20` — CDL | `population=223/30385`, `baseline=38 (incondicional=34, identity=4)`, `identity=4/3`, `payload=214`, `structural-debt=0`, **`refs-undetected=20` (owner ADR-004)**, `vocabulary=10`, `heuristic=true fp=5/90 fn=4/90` | `node scripts/static-checks.mjs \| grep V20` |
| 8 paths acionáveis — citações vivas | **33** no total (12/7/4/3/3/1/2/1), contra 47 no PRD §3.5 — a diferença são as citações que `spec-review` levou consigo | laço `grep -rn "rules/<p>\.md" .agents \| wc -l` (§4.1) |
| `frontend/DESIGN.md` | **11 linhas / 3 agentes** (`design-system-specialist` 3, `ux-designer` 5, `orchestrator` 3); `test -e frontend/DESIGN.md` ⇒ falso | `grep -rn "DESIGN\.md" .agents/agents \| wc -l` |
| `.doc/**` — segunda gramática | **9 linhas** (5 paths) — parte dos 20 de `refs-undetected` | `grep -rPn '\`?\.doc/[\w./-]+\`?' .agents opencode.json \| wc -l` |
| SSoT de segurança | `security-standard.md` **ausente**; 7 citações com prefixo `rules/` **e 4 citações nuas** (fora da gramática do `V18`) | `grep -rn "security-standard\.md" .agents` |
| N30 — link-ref | **0 ocorrências** em `.agents/` — buraco **latente**, não incidente | `grep -rIl '\[//\]: #' .agents \| wc -l` |

**O defeito que este ADR existe para não cometer** tem duas caras, e as duas são decisão, não detalhe de implementação:

1. **Remover uma SSoT declarada e deixar o agente sem norma.** `security-engineer/AGENT.md:26` diz *"Você **DEVE** seguir rigorosamente o `.agents/rules/security-standard.md`"*. Apagar a citação por ser um path ausente satisfaz o `V18` e produz exatamente o pior resultado descrito em `PRD.md` §13 e `RESEARCH.md` §9-R5: agente sem norma **e** sem o dever de seguir. D4 não pode ser executado como "apagar e pronto" para este path.
2. **Classificar sem dizer qual comando prova.** Uma tabela de "vereditos" sem predicado mecânico é opinião com formato de relatório. Aqui toda classe carrega (a) um comando que a prova, (b) uma ação única do vocabulário `reapontar | criar | remover | dívida com dono` e (c) um dono — e as instâncias entram como **aplicação da rubrica**, nunca como decisões avulsas.

---

## 2. Decisão — uma única: adotar a rubrica abaixo

**Adotar uma rubrica de 7 classes (`RC0`..`RC6`) para toda referência quebrada de classe (c), com predicado por comando, uma ação por classe e dono explícito. As decisões do owner (D4, D5) e o achado N30 são **aplicações** da rubrica — não decisões separadas, não casos especiais.** A rubrica é a especialização de classe (c) da rubrica C1..C6 do `ADR-005` do PRD-1: reusa os predicados C1/C2/C3/C4 **por referência** (o contrato do `V18` não muda) e substitui apenas a **ação**, porque o owner fechou em D4 o que o ADR-005 deixou em dívida (*"remoção não é decidida aqui"*, §2.3-C2). Nenhuma linha daquela rubrica é reaberta.

### 2.1 A rubrica — classe × predicado (comando) × ação × dono

| Classe | Nome | Predicado — o comando que a prova | Ação (uma do vocabulário) | Dono |
|---|---|---|---|---|
| **RC0** | `alvo-necessario-sem-ssot` | alvo ausente ∧ nenhuma SSoT viva para reapontar ∧ nenhum PRD posterior declarado dono ⇒ `test -e "<alvo>"` falso **e** `grep -rIl "<alvo>" .agents` sem linha de `fonte da verdade`/`DEVE seguir` **e** sem dono em `PRD.md` §16 | **`criar`** — a rule/artefato nasce no payload comum | SDD que a aplica |
| **RC1** | `ssot-declarada` | alvo ausente ∧ ∃ linha viva com o path **e** um declarador (`fonte da verdade` \| `DEVE seguir` \| `padrão obrigatório`): `grep -rn "<path>" .agents \| grep -iE "fonte da verdade\|DEVE seguir\|padrão obrigatório"` ⇒ não vazio | **`reapontar`** — destino = skill `security-review` (existe, viaja, já aplica OWASP/ASVS/MASVS); a norma é **internalizada no corpo citante**. **`remover` é proibido nesta classe** | SDD deste ADR |
| **RC2** | `baseline-de-eixo-fora-de-suporte` | alvo ausente ∧ eixo declarado `N/A`: `node -e 'console.log(require("./harness.config.json").stack.<eixo>)'` ⇒ `N/A …` ∧ nome casa `^(backend-\|db-migration-)` | **`remover` citações + `dívida com dono`** — dono **PRD-4** (`prd-axes-split`) + **condição de reativação** explícita: quando o eixo backend for habilitado, as rules voltam ao payload | PRD-4 |
| **RC3** | `ponteiro-de-dono-posterior` | alvo ausente ∧ citado só em `.agents/agents/**` ∧ dono do conteúdo é PRD posterior (`PRD.md:331`): `test -e frontend/DESIGN.md` falso ∧ `grep -rn "DESIGN\.md" .agents/agents \| wc -l` ⇒ 11 | **`remover` ponteiro + `dívida com dono`** — dono **PRD-5**; nada é criado aqui (a criação é do dono) | PRD-5 |
| **RC4** | `regra-local-ja-e-ssot` | alvo ausente ∧ a norma do assunto **já viaja** em prosa viva: `grep -n "Testes Unitários" .agents/rules/workflow-rules.md` ⇒ §5.1 (e §5.3 para frontend) | **`remover`** — a citação é redundante; o conteúdo não se perde porque a SSoT local existe | SDD deste ADR |
| **RC5** | `suprimida-por-mecanismo` | citação em code-fence/fixture ou em skill do lock: `sed -n '68p' .agents/skills/harness-installer/SKILL.md` ⇒ objeto de exemplo; `node -e '... in require("./.agents/skills/.vendor-lock.json").skills'` ⇒ `true` | **`nenhuma`** — `NON_DEFECT` (`reason` + `proof`) ou lock já cobrem; 0 edição de prosa | mecanismo do ADR-005 |
| **RC6** | `forma-de-citacao-compravel` (N30) | `grep -rIl '\[//\]: #' .agents \| wc -l` ⇒ `0` hoje, **mas** `citesToken` do `V19` casa link-ref markdown | **`dívida com dono`** — extend o detector de refs existente com fixture que reprova `[//]: # (skill)`; `V19` publica `consumer` idêntico antes/depois | SDD deste ADR |

**Regra de precedência — a ordem é fixa, logo a classe é determinística.** RC5 → RC6 → RC1 → RC3 → RC2 → RC4 → RC0. O predicado de RC1 vem **antes** de RC2: é o que impede a SSoT de segurança de ser arrastada para a remoção de baseline só porque o nome casa `^(backend-|db-migration-)` (`security-standard` casa o sujeito "segurança", não o eixo). RC0 vem **por último** e tem **0 instâncias hoje** — está na rubrica para que `criar` não seja ação órfã e para declarar a condição sob a qual dispararia; as 6 rules Java **não** são criadas (D4 descartou a opção (a)) e o `DESIGN.md` **não** é criado aqui (D5 o defere ao PRD-5).

**Por que uma classe por ação, e não um rótulo com sub-ação:** RC2 e RC3 ambos removem e ambos registram dívida — mas o dono e a condição de saída são diferentes (PRD-4 reativa eixo; PRD-5 cria arquivo). Uma classe, um dono, uma condição de reativação. A sacola "remover + talvez criar depois" é exatamente o que produz agente sem norma.

### 2.2 RC1 — o veredito do `security-standard.md` (tensão R5)

**Veredito: `reapontar` para a skill `security-review`, com internalização da norma no corpo citante. `remover` puro está proibido nesta classe.**

Racional mecânico, não de preferência:

- `security-review` **existe**, **viaja** (`SKILLS_COMMON`) e **já aplica** OWASP Top 10 / ASVS 4.x / MASVS 2.x — O ADR-003 só removeu a linha de `license:` falsa (`SKILL.md:4`), não a skill. Reapontar para ela dá ao agente uma norma que o destino recebe, sem artefato novo (`PRD.md` §7 não autoriza artefato novo neste ciclo).
- Criar uma `.agents/rules/security-standard.md` genérica (a alternativa que o R5 abre) foi **descartada**: D4 escolheu remover citações e declarar Java fora de suporte, e criar rule nova num ciclo que fecha dívida é trocar 7 citações órfãs por 1 artefato novo com dono de manutenção indefinido. A skill já é a SSoT de fato; torná-la SSoT declarada é 0 arquivo novo.
- **A armadilha medida:** o próprio `security-review/SKILL.md:36` cita o path ausente, e há **4 ocorrências nuas** de `security-standard.md` (sem prefixo `rules/`) em `SKILL.md:15,152`, `security-engineer/AGENT.md:29` e `orchestrator/AGENT.md:406` — fora da gramática do `V18`. Reapontar só as 7 citações `grep`-áveis deixaria o agente citando um arquivo inexistente em 4 sítios que o instrumento não vê. O item de interface 3 exige, por isso, `grep -rIn "security-standard\.md" .agents` ⇒ **0** (as duas formas), e não apenas o padrão do detector.

### 2.3 RC2/RC3 — remover com dono, nunca remover sem dono

As 5 rules Java (`backend-coding-standards`, `backend-integration-tests`, `backend-unit-tests`, `db-migration-flyway`, `db-migration-liquibase`) caem em RC2: o predicado `stack.backend = N/A` é medido (`node -e 'console.log(require("./harness.config.json").stack.backend)'` ⇒ `N/A — this repo has no Java/Maven backend…`) e a condição de reativação é **PRD-4 habilita o eixo backend**. Ação = remover citações **e** registrar dívida com dono; as rules voltam quando o eixo voltar — não antes, não por decreto deste ADR.

`frontend/DESIGN.md` cai em RC3: os 3 agentes deixam de citar o ponteiro **agora** (D5); o arquivo correto nasce no **PRD-5**, que é o dono. Nenhuma promessa silenciosa fica: a dívida tem dono e prazo de cycles, e o contador `refs-undetected` continua publicando o que sobrar.

### 2.4 RC6 — N30 no detector, não no lint

O `V19` classifica skill como `consumer` por `citesToken`, que ainda casa `[//]: # (skill)`. Hoje há **0** ocorrências em `.agents/` — buraco latente. A ação é **estender o detector de refs existente** (`.opencode/plugins/lib/refs/checks.mjs`, path propagado) com uma fixture que prova que a forma de citação é reprovada, **sem** mudar `consumer` do `V19` (`21` antes, `21` depois). Nenhum lint externo, nenhuma toolchain nova, nenhum comando novo no `suiteFull` — é a mesma restrição de selo do ADR-001 §2.6.

### 2.5 O oráculo — número nunca é contrato

`baseline=7`, `refs-undetected=20`, `consumer=21` e `population=223/30385` são o **estado medido no HEAD desta decisão**. O que o SDD entrega é o que a linha do `V18`/`V19`/`V20` publicar no commit de implementação — inclusive se a própria remoção de linhas mudar `population` (ADR-003 §11-H6: *"o oráculo é a linha do `V20`, e ela muda quando o próprio payload muda"*). Este ADR fixa o **predicado** e a **direção** (baseline tende a 0; refs-undetected tende a 9; consumer não muda), não os dígitos.

---

## 3. Interface congelada

Cada item é verificável por comando, rodando da raiz do repo. Nenhum depende de leitura subjetiva de prosa — quando depende, o nível 🟡 está declarado.

1. **A rubrica está publicada neste ADR com 7 classes, 4 ações do vocabulário e dono por classe.** `grep -c '^| \*\*RC[0-6]\*\*' .spec/prd/prd-agnostic-artifacts/ADRs/ADR-004-referencias-e-design-md/ADR.md` ⇒ `7`; `grep -oE 'reapontar|criar|remover|dívida com dono' … | sort -u | wc -l` ⇒ `4`; `grep -c 'predicado' …` ⇒ `≥1`.

2. **RC1 — SSoT reapontada, nunca removida.** As 7 citações com prefixo e as 4 nuas chegam a 0; `security-review` é o destino e a norma OWASP/ASVS/MASVS fica inline. *Verificação (SDD)*: `grep -rn "rules/security-standard\.md" .agents | wc -l` ⇒ `0` **e** `grep -rIn "security-standard\.md" .agents | wc -l` ⇒ `0` **e** `grep -n "Fonte da verdade\|DEVE seguir" .agents/agents/security-engineer/AGENT.md` ⇒ `≥1` (o agente **continua** com o dever de seguir) **e** `grep -c "Fonte da verdade\|padrão obrigatório" .agents/skills/security-review/SKILL.md` ⇒ `≥1`.

3. **RC2 — 5 rules Java removidas com dono e reativação.** *Verificação (SDD)*: laço `grep -rn "rules/<p>\.md" .agents | wc -l` ⇒ `0` para os 5 paths; `node -e 'console.log(require("./harness.config.json").stack.backend)'` ⇒ `N/A …`; `grep -c "PRD-4\|prd-axes-split" .spec/prd/prd-agnostic-artifacts/ADRs/ADR-004-referencias-e-design-md/ADR.md` ⇒ `≥1` (condição de reativação escrita). Nenhuma rule é criada: `git ls-files .agents/rules/ | grep -E 'backend-|db-migration-'` ⇒ vazio.

4. **RC3 — `DESIGN.md` fora dos 3 agentes, criação com dono PRD-5.** *Verificação (SDD)*: `grep -rn "DESIGN\.md" .agents/agents | wc -l` ⇒ `0`; `test -e frontend/DESIGN.md` ⇒ falso (nada é criado aqui); `grep -c "PRD-5" .spec/prd/prd-agnostic-artifacts/ADRs/ADR-004-referencias-e-design-md/ADR.md` ⇒ `≥1`.

5. **RC4 — `unit-testing-standards` removido sem perda de norma.** *Verificação (SDD)*: `grep -rn "rules/unit-testing-standards\.md" .agents | wc -l` ⇒ `0` **e** `grep -c "Testes Unitários" .agents/rules/workflow-rules.md` ⇒ `≥1` (§5.1/§5.3 já viajam).

6. **RC5 — `exemplo` suprimido por mecanismo, 0 edição.** *Verificação (SDD)*: `sed -n '68p' .agents/skills/harness-installer/SKILL.md` ⇒ objeto de exemplo intacto; `node -e 'import("./.opencode/plugins/lib/refs/checks.mjs").then(m=>console.log(m.NON_DEFECT.length, m.NON_DEFECT.every(e=>e.reason&&e.proof)))'` ⇒ `1 true`; `V18` publica `non-defect=1` inalterado.

7. **RC6 — N30 medido por check, `consumer` inalterado.** *Verificação (SDD)*: `grep -rIl '\[//\]: #' .agents | wc -l` ⇒ `0`; `node --test .opencode/plugins/__tests__/refs.spec.mjs` ⇒ 0 fail **com** fixture que reprova link-ref contendo nome de skill; `node scripts/static-checks.mjs | grep V19` ⇒ `consumer=21` idêntico ao antes do SDD; `git diff --stat harness.config.json` ⇒ vazio (0 toolchain nova).

8. **`V18` — baseline tende a 0, sem número contratual.** As 7 entradas (2 C1 + 5 C2) ficam sem citação e saem da baseline; `non-defect=1` permanece. *Verificação (SDD)*: `node scripts/static-checks.mjs | grep V18` ⇒ `PASS` com `baseline` menor que 7 e `non-defect=1`; **o número publicado é o oráculo** (ADR-001 §10-N7), não o valor desta frase. A meta de RF-05 é `baseline ≤ 1`.

9. **`V20` — `refs-undetected` tende a 9, com dono declarado para o resto.** As 11 linhas de `DESIGN.md` saem; as 9 de `.doc/**` permanecem com dono **ADR-005** registrado (nunca silêncio — ADR-001 §3-IF10). *Verificação (SDD)*: `node scripts/static-checks.mjs | grep V20` ⇒ `PASS` com `refs-undetected` menor que 20 **e** `owner ADR-004` ainda no `detail` do contador; `grep -rPn '\`?\.doc/[\w./-]+\`?' .agents opencode.json | wc -l` ⇒ `9` (as que sobram, com dono ADR-005 escrito neste ADR). `population`/`payload` mudam na medida exata das linhas removidas — oráculo = linha do `V20` (ADR-003 §11-H6).

10. **Selo intacto — zero comando novo.** `commands.suiteFull`, `harness.config.json` e `HARNESS_SEAL_JSON` byte-idênticos. *Verificação*: `git diff --stat harness.config.json .opencode/plugins/lib/seal.mjs` ⇒ vazio; `node -e 'console.log(require("./harness.config.json").commands.suiteFull)'` ⇒ idêntico ao da `main`; extensão de N30 é módulo em `.opencode/plugins/lib/refs/checks.mjs` + fixture em `__tests__/`, nenhum `record(...)` novo no adapter.

11. **Escopo de escrita — 2 arquivos, 1 commit.** *Verificação*: `git show --stat --name-only HEAD` ⇒ `ADR-INDEX.md` + `ADRs/ADR-004-referencias-e-design-md/ADR.md`; `git diff --stat gate.js harness.config.json opencode.json installer/` ⇒ vazio; `ADR-01`/`ADR-02` PASS; `node scripts/static-checks.mjs` ⇒ exit `0`.

12. **1:1 e sequência do ledger — 3 merged + 1 in-progress.** *Verificação*: `node scripts/static-checks.mjs | grep -E '^PASS ADR-0'` ⇒ `ADR-01` e `ADR-02` PASS; `ADR-INDEX.md` tem 4 linhas, `ADR-003` promovido a `merged` com `b5c23dd (PR #12)` e `ADR-004` `in-progress` com `merge = —`; no máximo 1 `in-progress` (ADR-02, `checks.mjs:378-379`).

---

## 4. Aplicação da rubrica — instâncias re-medidas (pós-ADR-003)

Regra de leitura: **classe** vem da árvore de §2.1; **ação** é a de §2.1; **comando** reproduz o fato. Nenhuma linha é "caso especial" — D4/D5/N30 são esta tabela.

### 4.1 Os 8 paths acionáveis de `rules/*.md` (gramática do `V18`)

| # | Path citado | Citações / arquivos — amostra `arquivo:linha` | Classe | Ação | Comando de prova |
|---|---|---|---|---|---|
| A1 | `rules/backend-coding-standards.md` | **12 / 10** — `sdd-compiler/asserts/verify-gate.md:25`, `sdd-compiler/SKILL.md:43`, `orchestrator/AGENT.md:672`, `developer-engineer/AGENT.md:137`, `workflow-rules.md:599` | RC2 | remover + dívida PRD-4 + reativação | `grep -rn "rules/backend-coding-standards\.md" .agents \| wc -l` ⇒ `12` (meta 0) |
| A2 | `rules/security-standard.md` | **7 / 5** — `security-engineer/AGENT.md:26`, `security-review/SKILL.md:36`, `orchestrator/AGENT.md:576,617,677`, `developer-engineer/AGENT.md:142`, `workflow-rules.md:602` **+ 4 nuas** (`SKILL.md:15,152`, `AGENT.md:29`, `AGENT.md:406`) | **RC1** | **reapontar** → skill `security-review` + norma inline; remover proibido | `grep -rn "rules/security-standard\.md" .agents \| wc -l` ⇒ `7` (meta 0) **e** `grep -rIn "security-standard\.md" .agents \| wc -l` ⇒ `11` (meta 0) |
| A3 | `rules/backend-integration-tests.md` | **4 / 4** — `security-review/SKILL.md:39`, `orchestrator/AGENT.md:675`, `developer-engineer/AGENT.md:140`, `workflow-rules.md:598` | RC2 | remover + dívida PRD-4 + reativação | `grep -rn "rules/backend-integration-tests\.md" .agents \| wc -l` ⇒ `4` (meta 0) |
| A4 | `rules/backend-unit-tests.md` | **3 / 3** — `orchestrator/AGENT.md:674`, `developer-engineer/AGENT.md:139`, `workflow-rules.md:597` | RC2 | remover + dívida PRD-4 + reativação | `grep -rn "rules/backend-unit-tests\.md" .agents \| wc -l` ⇒ `3` (meta 0) |
| A5 | `rules/db-migration-flyway.md` | **3 / 3** — `orchestrator/AGENT.md:676`, `developer-engineer/AGENT.md:141`, `workflow-rules.md:601` | RC2 | remover + dívida PRD-4 + reativação | `grep -rn "rules/db-migration-flyway\.md" .agents \| wc -l` ⇒ `3` (meta 0) |
| A6 | `rules/db-migration-liquibase.md` | **1 / 1** — `dev-planner/SKILL.md:207` | RC2 | remover + dívida PRD-4 + reativação | `grep -rn "rules/db-migration-liquibase\.md" .agents \| wc -l` ⇒ `1` (meta 0) |
| A7 | `rules/unit-testing-standards.md` | **2 / 2** — `dev-planner/anti-patterns.md:456`, `dev-planner/SKILL.md:206` | RC4 | remover (SSoT local em `workflow-rules.md` §5.1/§5.3) | `grep -rn "rules/unit-testing-standards\.md" .agents \| wc -l` ⇒ `2` (meta 0) |
| A8 | `rules/exemplo.md` | **1 / 1** — `harness-installer/SKILL.md:68` (bloco ```js) | RC5 | nenhuma — `NON_DEFECT` com `reason`+`proof` | `sed -n '68p' .agents/skills/harness-installer/SKILL.md` ⇒ objeto de exemplo |

**Fechamento medido:** `12+7+4+3+3+1+2+1 = 33` citações (contra 47 no PRD §3.5; o "52" do D4 somava os 5 paths `vendor-internal` de 1 citação cada). `RC1 = 1` · `RC2 = 5` · `RC4 = 1` · `RC5 = 1` = 8 paths. `RC0 = 0` instâncias.

### 4.2 `frontend/DESIGN.md` — segunda gramática, dono PRD-5

| # | Instância | `arquivo:linha` (11 linhas) | Classe | Ação | Comando de prova |
|---|---|---|---|---|---|
| B1 | `frontend/DESIGN.md` — Design System *Pulse* | `design-system-specialist/AGENT.md:26,43,57`; `ux-designer/AGENT.md:24,34,162,253,273`; `orchestrator/AGENT.md:152,299,359` | RC3 | remover ponteiro agora + dívida PRD-5 (que cria o arquivo) | `grep -rn "DESIGN\.md" .agents/agents \| wc -l` ⇒ `11` (meta 0); `test -e frontend/DESIGN.md` ⇒ falso |

### 4.3 `.doc/**` — segunda gramática, 9 linhas, dono ADR-005 (fora do 9/9)

| # | Path citado | `arquivo:linha` | Classe | Ação | Comando de prova |
|---|---|---|---|---|---|
| C1 | `.doc/ARCHITECTURE.md` | `dev-planner/workflow.md:33,101`, `dev-planner/SKILL.md:209` | RC3 | remover ponteiro + dívida com dono = **ADR-005** (frota restante) | `grep -rPn '\.doc/ARCHITECTURE\.md' .agents \| wc -l` ⇒ `3` |
| C2 | `.doc/STACK.md` | `dev-planner/workflow.md:101`, `dev-planner/SKILL.md:210` | RC3 | idem | `grep -rPn '\.doc/STACK\.md' .agents \| wc -l` ⇒ `2` |
| C3 | `.doc/especificacao-sistema.md` | `orchestrator/AGENT.md:679`, `workflow-rules.md:595` | RC3 | idem | `grep -rPn '\.doc/especificacao-sistema\.md' .agents \| wc -l` ⇒ `2` |
| C4 | `.doc/arquitetura-backend.md` | `orchestrator/AGENT.md:680`, `workflow-rules.md:594` | RC3 | idem | `grep -rPn '\.doc/arquitetura-backend\.md' .agents \| wc -l` ⇒ `2` |
| C5 | `.doc/stacks.md` | `workflow-rules.md:593` | RC3 | idem | `grep -rPn '\.doc/stacks\.md' .agents \| wc -l` ⇒ `1` |

Estas 9 linhas **não** fazem parte dos 9/9 vereditos de RF-05 (que são 8 paths + `DESIGN.md`). Elas ficam classificadas aqui, com dono ADR-005, para que o `refs-undetected` publicado nunca seja silêncio sobre dívida real (ADR-001 §3-IF10). O contador cai de 20 para ~9, não para 0 — e 9 com dono é o estado correto deste ADR.

### 4.4 N30 — forma de citação

| # | Instância | Estado medido | Classe | Ação | Comando de prova |
|---|---|---|---|---|---|
| N1 | link-ref `[//]: # (skill)` comprando `consumer` no `V19` | **0 ocorrências** em `.agents/` — latente | RC6 | dívida com dono: estender detector de refs + fixture | `grep -rIl '\[//\]: #' .agents \| wc -l` ⇒ `0`; `node scripts/static-checks.mjs \| grep V19` ⇒ `consumer=21` antes e depois |

---

## 5. Consequências

- **C1 — a SSoT de segurança muda de endereço, não de existência.** 11 citações (7 com prefixo + 4 nuas) reapontam para a skill `security-review`, que viaja e já contém OWASP/ASVS/MASVS. O agente de segurança continua obrigado a seguir uma norma; o que muda é o **suporte** da obrigação — de um arquivo que o destino nunca recebe para um artefato que recebe. É a resposta direta a R5 e a RF-04.
- **C2 — Java sai de suporte por decisão com prazo, não por esquecimento.** 20 citações de 5 rules são removidas e a dívida fica com dono PRD-4 + condição de reativação explícita. O custo é o mesmo do ADR-005 C2, agora com data de validade: quando o eixo backend voltar, as rules voltam — e a baseline muda com trailer `Harness-Gate-Change` (`protectedPaths`).
- **C3 — `DESIGN.md` sai agora; o conteúdo não é deste ciclo.** 11 linhas em 3 agentes desaparecem; o PRD-5 herda o arquivo e o conceito. O destino deixa de ser prometido um design system que não recebe, e o agente de UX/Design deixa de inventar tokens contra um arquivo que não existe.
- **C4 — `refs-undetected` não zera neste ADR, e isso é honestidade.** 20 → ~9: as 9 de `.doc/**` seguem com dono ADR-005. Publicar 0 esconderia dívida viva; publicar 9 com dono é o contrato do ADR-001 §3-IF10.
- **C5 — N30 fecha um buraco latente sem toolchain nova.** O detector de refs ganha a forma de citação que o `V19` ainda casa; `consumer=21` fica idêntico. O check existe antes do incidente, não depois — a lição `FU-32` (canário que reprova prosa legítima) é evitada pela fixture e pelo predicado restrito a link-ref.
- **C6 — 🟠 escape declarado (os mesmos dos precedentes).** (a) `scripts/static-checks.mjs` não é `protectedPaths`: remover o `record(...)` do `V18`/`V20` desliga o oráculo sem trailer (ADR-001-C7). (b) O destino herda o módulo de refs mas não o adapter (PRD-3). (c) RC1 depende de `grep` com 4 formas nuas fora da gramática do detector — 🟡 revisão assistida no SDD, não garantia de runtime; o item de interface 3 torna a checagem explícita, mas quem editar o adapter pode removê-la.
- **C7 — a rubrica não reabre o ADR-005 do PRD-1.** RC1..RC6 reutilizam C1..C6 por referência e trocam só a ação que o owner fechou em D4/D5. Se o PRD-4 reativar o eixo backend, a entrada volta à baseline com o dono do PRD-4 — não como "exceção" inventada aqui.

---

## 6. Alternativas descartadas

| Alternativa | Custo | Por que foi descartada |
|---|---|---|
| **Remover a citação de `security-standard.md` sem substituto** (D4 literal sobre RC1) | 7 linhas | Satisfaz o `V18` e deixa `security-engineer` sem norma — o pior resultado de `PRD.md` §13 / `RESEARCH.md` §9-R5; colide com RF-04. É o único veredito proibido pela rubrica |
| **Criar `.agents/rules/security-standard.md` genérica** (a alternativa do R5) | 1 artefato novo + dono de manutenção | D4 remove dívida, não troca 7 citações por 1 rule com dono indefinido; `security-review` já é a SSoT de fato e viaja; `PRD.md` §7 não autoriza artefato novo neste ciclo |
| **Criar as 6 rules Java** (opção (a) de D4) | 6 arquivos no payload comum | Owner descartou: Java está fora de suporte e o eixo pode voltar no PRD-4 — criar agora seria norma incondicional num destino sem eixo |
| **Manter os 8 paths como dívida na baseline** (`ADR-005` C2 original) | 7 entradas + 33 citações mortas | D4 fechou a decisão que o ADR-005 deixou aberta; manter seria decidir contra o owner e deixar `baseline=7` contrariando a meta `≤ 1` de RF-05 |
| **Deferir `DESIGN.md` inteiro ao PRD-5** (não remover o ponteiro agora) | 11 linhas por 3 agentes | D5 removendo ponteiro agora; o dono do **arquivo** é PRD-5, mas o **ponteiro quebrado** é deste ciclo (classe (c)) |
| **Cobrir N30 com lint externo / nova ferramenta** | toolchain nova | `RESEARCH.md:174`: zero dependência nova; `commands.suiteFull` selado não pode ganhar comando (ADR-001 §2.6) |
| **Zerar `refs-undetected` removendo também as 9 de `.doc/**`** | 9 linhas fora do 9/9 | As 9 são dívida viva com dono ADR-005; removê-las aqui seria decidir fora de escopo e publicar silêncio onde o contrato exige dono |

---

## 7. Critérios de verificação

```sh
# o oráculo (não fixar número como contrato)
node scripts/static-checks.mjs | grep -E '^(PASS|FAIL) (V18|V19|V20|ADR-0|PRD-01)'

# as 33 citações re-medidas por path (estado atual → meta 0)
for p in backend-coding-standards security-standard backend-integration-tests \
         backend-unit-tests db-migration-flyway db-migration-liquibase \
         unit-testing-standards exemplo; do
  printf '%s %s\n' "$p" "$(grep -rn "rules/$p\.md" .agents 2>/dev/null | wc -l)"
done

# RC1 — SSoT: 7 com prefixo + 4 nuas, as duas formas devem chegar a 0
grep -rn "rules/security-standard\.md" .agents | wc -l    # 7  → 0
grep -rIn "security-standard\.md" .agents | wc -l         # 11 → 0
grep -n "DEVE seguir" .agents/agents/security-engineer/AGENT.md

# RC3 / quarta gramática — donos diferentes
grep -rn "DESIGN\.md" .agents/agents | wc -l                          # 11 → 0
grep -rPn '`?\.doc/[\w./-]+`?' .agents opencode.json | wc -l           # 9 (dono ADR-005)

# N30 — buraco latente medido, consumer inalterado
grep -rIl '\[//\]: #' .agents | wc -l                      # 0
node scripts/static-checks.mjs | grep V19                  # consumer=21 antes e depois

# RF-10 / IF-10 / IF-11 — selo, escopo e 1:1
git diff --stat harness.config.json .opencode/plugins/lib/seal.mjs gate.js   # vazio
git show --stat --name-only HEAD                          # ADR-INDEX.md + ADR-004/ADR.md
node scripts/static-checks.mjs                            # exit 0
```

---

## 8. Notas de correção (divergências medidas entre PRD/RESEARCH e disco)

- **N1 — "52 citações" (D4) não é o número das 8 paths.** O PRD §3.5 mede 47 (16+8+7+6+4+3+2+1); as 52 do D4/RESEARCH somam os 5 paths `vendor-internal` de 1 citação cada (A9–A13 do ADR-005 do PRD-1), que são RC5 aqui e saem por lock, não por remoção. Pós-ADR-003 são **33** — `spec-review` (5 arquivos, removidos no ADR-003) levou 16-12=4 de `backend-coding-standards`, 8-7=1 de `security-standard`, 7-4=3 de `backend-integration-tests`, 6-3=3 de `backend-unit-tests`, 4-3=1 de `db-migration-flyway` e 3-1=2 de `db-migration-liquibase`. Re-medido, não reaproveitado.
- **N2 — SSoT tem 2 gramáticas, não 1.** O `V18` casa `rules/security-standard.md` (7 citações); há **4** ocorrências nuas de `security-standard.md` em `SKILL.md:15,152`, `security-engineer/AGENT.md:29` e `orchestrator/AGENT.md:406`, fora da gramática. Um SDD que corrigir só o `grep` do detector deixaria o agente citando arquivo inexistente em 4 sítios. Item de interface 3 cobre as duas formas (🟡 revisitado na revisão).
- **N3 — `refs-undetected=20` = 11 de `DESIGN.md` + 9 de `.doc/**`.** As duas gramáticas somam 20; D5 remove só as 11. O alvo é ~9 com dono ADR-005, não 0 — declarado em §5-C4 para não virar "falha" no G2.
- **N4 — `V19 consumer` mudou de 22 (PRD) para 21 (pós-ADR-003).** `spec-review` saiu do inventário; o número de referência de N30 é **21**, medido. O oráculo é a linha do `V19`.
- **N5 — a rubrica C1..C6 do PRD-1 não é reaberta.** RC1..RC6 reutilizam os predicados e trocam a ação onde o owner decidiu (D4/D5). A frase "remoção não é decidida aqui" do ADR-005 §2.3-C2 valia para aquele ciclo; aqui a decisão é do owner e está em `PRD.md:330`.

---

## 9. Riscos antes do G2 (o que o owner precisa saber)

| # | Risco | Evidência | Mitigação / por que não bloqueia |
|---|---|---|---|
| **G2-A** | Reapontar só as 7 citações `grep`-áveis e esquecer as 4 nuas — agente continua sem norma | `SKILL.md:15,152`, `AGENT.md:29`, `AGENT.md:406` (N2) | Item de interface 3 exige `grep -rIn "security-standard\.md"` ⇒ 0; 🟡 revisão assistida, declarada em C6 |
| **G2-B** | SDD tratar as 7 citações de segurança como as outras 26 e aplicar `remover` | R5; RC1 predicado `fonte da verdade\|DEVE seguir` | Classe RC1 com precedência antes de RC2 e proibição explícita de `remover`; 1 regra, 1 comando |
| **G2-C** | Owner esperar `refs-undetected=0` e ler 9 como falha | 20 = 11 + 9 (N3) | ADR-001 §3-IF10 exige "publicado com dono, nunca silêncio"; 9 com dono ADR-005 é o estado correto |
| **G2-D** | Extensão de N30 alterar `citesToken` e mudar `consumer` do `V19` sem querer | RF-07; `V19 consumer=21` (N4) | Fixture exige `consumer=21` idêntico antes/depois; se mudar, a extensão está no lugar errado e o SDD volta |
| **G2-E** | `baseline=0` é frágil: qualquer órfã nova reprova sem supressão | H1/H2; `protectedPaths` | Desejado. Custo de processo no PRD-4 (trailer `Harness-Gate-Change`) aceito e declarado em C2 |
| **G2-F** | Este ADR não implementa nada — risco de "decisão sem consequência" se o SDD não vier | Escopo de escrita = 2 arquivos | É o modelo do fatiamento aprovado (ADR-001/002/003 nasceram iguais); os 12 itens de interface são contrato do SDD, com comando por item |

---

## 10. O que fica para o SDD deste ADR

Nesta ordem (a ordem importa: RC1 antes dos demais, senão a SSoT é apagada no meio do caminho):

1. **RC1** — reapontar as 7 + 4 citações de `security-standard.md` para a skill `security-review`, internalizando a norma; checar `DEVE seguir` preservado no `security-engineer`.
2. **RC2** — remover as 20 citações de baseline Java (5 paths) e registrar dono PRD-4 + condição de reativação; remover as 5 entradas da `BASELINE` do `V18`.
3. **RC4** — remover as 2 citações de `unit-testing-standards`; confirmar §5.1/§5.3 em `workflow-rules.md`.
4. **RC3** — remover as 11 linhas de `DESIGN.md` dos 3 agentes; registrar dono PRD-5.
5. **RC5** — confirmar 0 edição em `exemplo` (`NON_DEFECT` intacto).
6. **RC6** — estender o detector de refs + fixture; `V19 consumer=21` idêntico.
7. **RC3 em `.doc/**`** — classificar as 9 linhas com dono ADR-005 sem removê-las aqui.
8. **Verificar** os 12 itens de interface, rodar `commands.suiteFull` + `node scripts/sdd-checks.mjs` e transcrever a linha do `V18`/`V19`/`V20` no `VERIFY.md`.

**Fora do SDD (declarado):** criação do `DESIGN.md` (PRD-5), reativação do eixo backend (PRD-4), remoção das 9 de `.doc/**` (ADR-005), runner do `V20` no destino e mapa novo no instalador (PRD-3), `gate.js` (byte-idêntico).
