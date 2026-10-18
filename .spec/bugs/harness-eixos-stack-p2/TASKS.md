# TASKS — Bugfix: harness-eixos-stack-p2

> **Tipo**: Bugfix (fast-track B1..B4 de `.agents/rules/workflow-rules.md` §4)
> **Origem**: QA Quality Gate (P4) do ciclo `harness-eixos-stack` — `qa-engineer`, 2026-10-18
> **Fonte dos achados**: `.spec/tech-debts/harness-eixos-stack-p2/TASKS.md` (mesma evidência, agora com rota de correção)
> **Ciclo anterior**: arquivado em `.spec/archive/20261018-harness-eixos-stack/` (SPEC/ADRs/VERIFY) — **não** editar

---

## BUG-1 — O caminho **default** do menu termina em `BAD_ANSWER` no comando da suíte

### Sintoma
`Enter` no passo 1 (item 4) → `Enter` no passo 2 (Vue) chega ao `[3/5] Comando da suite` **sem default**; `Enter` com valor vazio falha a validação e o prompt **repete** (o QA observou 6 repetições até `NO_STDIN` em entrada scriptada). Um humano consegue sair digitando um comando — mas o caminho de **defaults + Enter** é o primeiro que qualquer usuário tenta.

### Causa raiz (🟢 observado)
- `installer/install.mjs` → `defaultSuiteFor(stack)`: candidatos existem **apenas** para `flutter`/`dart`/`node`/`node-esm`. O par **`java+vue` retorna `''`**; o par `java+react` ganhou `['npm run test:run','npm test']` no ciclo anterior — **o default (vue) não ganhou**.
- O default do W3 é `defaultSuiteFor(answers.stack)`; com `''`, o prompt sai **sem `(default: …)`** e `Enter` produz `''`.
- `validateAnswer` caso `command` → `commandResolves('')` é `false` → `BAD_ANSWER` (bloco de 4 linhas) → **repete o mesmo passo**.

### Solução (autorizada pelo owner — muda o critério do RF-07 do ciclo arquivado)
- O **eixo web inteiro** (vue **e** react) passa a ter candidatos de suíte: `['npm run test:run','npm test']`, na ordem, vencendo o primeiro cujo token resolve no PATH; se nenhum resolver, retorna o **primeiro candidato** (nunca `''` por ausência de branch).
- Mudança de critério declarada: o RF-07 dizia "par vue mantém `''` (paridade provada)". Passa a valer **candidato para o eixo web**, vue incluído.

### Testes exigidos
1. **Fluxo** (`installer/__tests__/wizard.spec.mjs`): `Enter,Enter` no menu → **um** prompt de comando com default visível; **sem** repetição por vazio.
2. **Unitário** (`generate.spec.mjs`): `defaultSuiteFor('java+vue')` **não-vazio** e a regra "primeiro que resolve no PATH" (PATH controlado, como no teste do `make` do ciclo anterior).
3. **Prova de mutação**: remover o ramo do eixo web ⇒ vermelho.

### Riscos
- `defaultSuiteFor` é **default do wizard** — **não** entra em `generateConfig` ⇒ não afeta a byte-identidade dos presets (I2). Verificar explicitamente.
- Expectativas de `wizard.spec.mjs` que hoje assumem default vazio para o par vue precisam ser atualizadas **só** nesse aspecto (política I9: escopo estrutural/caso novo).

---

## BUG-2 — Assimetria de gating: skill **local** Vue entra no destino react

### Sintoma
Destino `java+react` **não** recebe a rule `frontend-coding-standards.md` (excluída por eixo), mas **recebe** `.agents/skills/frontend-vue-specialist/SKILL.md` — prosa Vue. O mesmo eixo é tratado de duas formas.

### Causa raiz (🟢 observado)
- `collectIncoming` filtra **skills** pelo `stacks` do `.vendor-lock.json`; skill **local** (sem entrada no lock) cai na semântica "sem entrada ⇒ **comum**" ⇒ entra em **todo** destino.
- O mecanismo de exclusão por eixo (`RULES_BY_AXIS`/`RULES_COMMON`, validado na carga) existe **só** para `.agents/rules/**`. Não há equivalente declarado para `.agents/skills/**` locais.

### Solução
- Estender o mecanismo declarado às skills **locais**, espelhando o que já vale para rules: mapa de **exclusão** por eixo + lista explícita de comuns, **validado na carga** contra `AXIS_IDS` (fail-closed) e com **enumeração total** (skill local não classificada ⇒ teste vermelho).
- **Semântica da chave (correção do próprio artefato — reportada pelo `developer-engineer` na B2)**: o mapa é de **EXCLUSÃO**, logo a chave nomeia o **eixo do destino que NÃO recebe** o artefato. Para `frontend-vue-specialist` a chave é **`frontend=react`** — é a única leitura que satisfaz o aceite (`java+vue` **continua recebendo**) **e** a não-regressão de `node`/`node-esm`/`outra`/`flutter`/`dart`. A redação anterior ("classificar no eixo `frontend=vue`") estava **errada** sob a semântica de exclusão (faria `java+vue` perder a skill) e foi corrigida aqui.
- **Não** criar rule React nova (fora do escopo aprovado).

### Testes exigidos
1. Destino `java+react` **não** recebe `frontend-vue-specialist`; destino `java+vue` **continua** recebendo.
2. **Enumeração**: `.agents/skills/**` local — toda skill classificada (eixo **ou** comum declarado); nova skill não classificada ⇒ vermelho.
3. **Bidirecional**: nome classificado que não existe no disco ⇒ vermelho (fantasma).
4. **Prova de mutação**: gating por **nome** de arquivo ⇒ vermelho; remover a exclusão ⇒ vermelho.
5. **Não-regressão**: incoming de skills de `node`, `node-esm`, `outra`, `flutter`, `dart` **idêntico** ao de hoje.

### Riscos
- Classificar errado remove skill de destino legítimo ⇒ a não-regressão acima é obrigatória.
- **Lição do ciclo anterior**: declaração sem validação na carga = **no-op silencioso**; oráculo do teste tem de ser **independente** (tabela literal, nunca derivada da função sob teste).

---

## Invariantes preservadas (não pode quebrar)
I2 byte-identidade da config gerada dos 6 presets · I5 hashes das skills vendorizadas · `gate.js`/`harness.config.json`/`commands.suiteFull` com **0 linhas** · `installer/` **rede-zero** · política **I9** de edição de teste · ciclo arquivado **intocado**.

## Fora do escopo
C-1 (gate/schema) · rule `frontend-react-standards.md` · perfis backend go/rust · refatorar o menu.
