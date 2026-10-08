# Tasks — harness-installer-mobile (TDD-ready)

Convenção: `IM-[LAYER]-[NN]`. Camadas: `BE` (installer/scripts Node), `VAL` (validação/dogfood), `DOC`.
Cada task: **teste antes** (TDD), escopo de arquivos, cenários BDD, critério de done.

## Batch 1 — Contrato de dados

### IM-BE-01 — STACK_PROFILES + generateConfig por lookup
- **Teste primeiro:** `generate.spec.mjs` golden node/java+vue/outra byte-idêntico + flutter/dart esperado.
- **Escopo:** `installer/install.mjs` (`STACK_PROFILES`, `profileOf`, `generateConfig`).
- **BDD:** dado stack=flutter → mcp `['marionette_mcp','dart']`, suite `flutter test`, analyze `dart analyze`; dado stack=node → saída idêntica ao baseline.
- **Done:** golden verde; nenhum I/O no gerador.

### IM-BE-02 — validateAnswer stack flutter/dart
- **Teste primeiro:** 4 ramos (flutter ok, dart ok, pubspec ausente⇒erro, mismatch flutter/dart⇒erro).
- **Escopo:** `installer/install.mjs` (`validateAnswer`).
- **BDD:** target sem pubspec + stack=flutter ⇒ `BAD_ANSWER`; pubspec sem `sdk: flutter` + stack=flutter ⇒ erro.
- **Done:** 4 asserções verdes.

### IM-BE-03 — collectIncoming filtra por stack (A4)
- **Teste primeiro:** install node não recebe skill `stacks:['flutter']`; install flutter recebe; sem lock ⇒ nada filtrado.
- **Escopo:** `installer/install.mjs` (`collectIncoming`, `runCli`), `INCOMING_EXCLUDE`.
- **BDD:** dado lock presente e stacks=['node'] → 0 skills flutter no incoming; `.vendor-lock.json` nunca no incoming.
- **Done:** testes verdes; retrocompat sem lock.

### IM-BE-04 — merge aditivo do bloco mcp (A3)
- **Teste primeiro:** `opencode.json` sem mcp + incoming com mcp ⇒ merge; divergência ⇒ flag.
- **Escopo:** `installer/install.mjs` (`mergeOpencodeJson`, `planMerge`).
- **BDD:** dado mcp existente diferente → flag; mcp ausente → merge.
- **Done:** testes verdes; merge aditivo não destrutivo.

### IM-VAL-01 — Golden retrocompat consolidado
- **Teste primeiro:** snapshot de `generateConfig` para os 4 stacks não-mobile contra baseline congelado (P-01).
- **Escopo:** `installer/__tests__/golden.spec.mjs`.
- **Done:** byte-equal contra baseline; roda no `commands.suiteFull`.

## Batch 2 — Vendor

### IM-BE-05 — scripts/vendor-skills.mjs (+ --check)
- **Teste primeiro:** fixture de skill fake; vendor copia byte-idêntico; `--check` verde; hash adulterado ⇒ FAIL.
- **Escopo:** `scripts/vendor-skills.mjs` (novo).
- **BDD:** dado skill com treeHash divergente → `--check` exit≠0 e lista divergências.
- **Done:** script roda offline-source; `--check` no CI.

### IM-VAL-02 — Vendor das 22 skills + lock + NOTICE
- **Pré:** IM-LIC-01 resolvido.
- **Ação:** executar vendor; commitar `.agents/skills/dart-*`, `flutter-*`, `.vendor-lock.json`, `VENDOR-NOTICE.md`.
- **Done:** `--check` verde; 22 dirs presentes; byte-idêntico.

### IM-VAL-03 — Check estático V15 (rede proibida em installer/)
- **Teste primeiro:** `scripts/static-checks.mjs` detecta `fetch(`/`node:http` em `installer/` ⇒ FAIL; ausência ⇒ PASS.
- **Escopo:** `scripts/static-checks.mjs`.
- **Done:** V15 verde no repo atual.

### IM-VAL-04 — Revisão de conteúdo do vendor (S1) + sem symlink (S4)
- **Ação:** varrer as 22 skills por scripts/payloads executáveis e symlinks; `--check` falha se symlink.
- **Escopo:** `scripts/vendor-skills.mjs` (assert), relatório no BRAIN.
- **Done:** nenhum symlink; inventário de conteúdo executável registrado.

### IM-BE-06 — IM-LIC-01: política de licença
- **Ação:** ler LICENSE das fontes; aplicar decisão P-02; bloquear/atribuir conforme.
- **Done:** política registrada em `VENDOR-NOTICE.md` + `.vendor-lock.json` (campo license).

## Batch 3 — Wizard

### IM-BE-07 — runWizard W0..W7 + detect()
- **Teste primeiro:** streams injetados; cada estado W0..W7; abort ⇒ 0 writes.
- **Escopo:** `installer/install.mjs` (`runWizard`, `detect`), `SKILL.md` não.
- **BDD:** dado pubspec mobile → detect sugere flutter; dado sem pubspec → menu manual; dado `q` em W3 → abort 0 writes.
- **Done:** testes verdes; `terminal:true` só em TTY; reusa validateAnswer/confirmByLayer.

### IM-VAL-05 — Testes de estado do wizard
- **Teste primeiro:** matriz estado×passo (default/válida/inválida/progresso/resumo/cancel) de §1.1 do UX.
- **Escopo:** `installer/__tests__/wizard.spec.mjs`.
- **Done:** todos os estados cobertos; regressão `terminal:false` (G6).

## Batch 4 — Docs + Dogfood

### IM-DOC-01 — SKILL.md + README
- **Ação:** documentar perfil mobile, flags, fluxo wizard, vendor (RF-17).
- **Escopo:** `.agents/skills/harness-installer/SKILL.md`, `README.md` (se houver).
- **Done:** doc reflete comportamento real.

### IM-VAL-06 — Dogfood em cópia Flutter (/tmp)
- **Ação:** copiar projeto Flutter para `/tmp`; rodar wizard; validar config gerado + checks PASS.
- **Done:** H3 evidência em `.spec/.../harness/*.json`.
