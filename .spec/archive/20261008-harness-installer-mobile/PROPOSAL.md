# Proposal — harness-installer-mobile (v1)

- **Domínio:** `governanca-de-agentes` · **Tipo:** `feature`
- **Status:** `Em análise — aguardando spec-review + security-review`
- **Baseline:** `.spec/archive/20260929-harness-installer/` (SPEC v1, 92%)
- **Referência de alvo:** `/home/joao/progat/wsProjetos/mobile` (Progat ERP Mobile, Flutter/Dart ^3.9.2)

## 1. Problema

O `harness-installer` (SPEC v1) instala governança repo→repo, mas o `QUESTIONS.stack`
só aceita `node | java+vue | outra | node-esm` e `generateConfig` é Node-centric
(hardcoda `mcp.required: ['chrome-devtools']`, moduleMap Node). Projetos de **apps
mobile Flutter/Dart** (que rodam com `marionette_mcp` + `dart mcp_server`, suite
`flutter test`) não têm perfil: o config gerado aponta MCP errado e não propaga as
skills do projeto mobile. Restrição real do caso: **o config nunca é copiado**
(ADR-002) — então "as skills do mobile" precisam ser **dados vendorizados**, não um
segundo caminho de cópia.

## 2. Objetivo (E1)

Instalar a governança Harness v7 em **projetos de desenvolvimento de apps mobile
(Flutter/Dart)**, com um perfil de stack correto e um **wizard interativo** adaptado a
terminal pequeno/touch, propagando o mesmo conjunto de skills usado no projeto mobile.

## 3. Decisões do usuário (Fase 0)

| Fork | Escolha | Efeito |
|---|---|---|
| A — origem das skills | **A1 vendor** | 22 skills `dart-*`/`flutter-*` vendorizadas em `.agents/skills/` do harness |
| B — interatividade | **B2 wizard TUI** | menus, auto-detecção `pubspec.yaml`, revisão por passo, tela de resumo |
| C — sentido | **instalar EM** projeto mobile | target = repo Flutter/Dart; NÃO rodar de dentro do celular |

## 4. Escopo

**Entra:**
- Perfil `flutter`/`dart` no `QUESTIONS.stack` + `validateAnswer` (exige `pubspec.yaml`, ADR-005).
- `generateConfig` dirigido por `STACK_PROFILES` (registry puro; novo `mcp.required`, `analyze`, `moduleMap`).
- A1: vendor offline das 22 skills + `.vendor-lock.json` (source+hash+stacks) + `VENDOR-NOTICE.md`.
- `collectIncoming(sourceDir,{stacks})` filtrado por stack (não planta skill mobile em repo node).
- B2: `runWizard()` como camada de apresentação reusando `validateAnswer`/`confirmByLayer`.
- Merge aditivo do bloco `mcp` no `opencode.json` (A3) — only-add, divergência ⇒ flag.

**NÃO entra:**
- Rodar o instalador de dentro do celular (Termux/Android).
- Auto-detecção de stacks fora de flutter/dart (sem `package.json`/`pom.xml`).
- Upgrade/desinstalação (porta aberta via manifesto, ADR-007).

## 5. Abordagem

1. **Profiles como dados puros** — `STACK_PROFILES` é a única fonte por stack; `generateConfig`
   continua puro/determinístico (teste S3 exige zero I/O). Leitura do real vive em `validateAnswer`.
2. **Vendor é operação source-side** — `scripts/vendor-skills.mjs` (único ponto com rede, roda 1x,
   resultado commitado). `install.mjs` permanece **rede-zero**. Skills byte-idênticas; scoping no lock central.
3. **Wizard sem autoridade** — B2 reusa os mesmos portões do CLI; só entrega `answers` validados + plano.
4. **Retrocompat absoluta** — `node`/`node-esm`/`java+vue`/`outra` produzem config **byte-idêntico** ao atual (golden test).

## 6. Critérios de aceite (E5)

- Wizard instala em projeto Flutter real e imprime tela de resumo antes de aplicar.
- `generateConfig` mobile correto: `mcp.required: ['marionette_mcp','dart']`, `suiteFull: 'flutter test'`, `analyze: 'dart analyze'`.
- Golden test: config de stacks não-mobile byte-idêntico ao baseline.
- 22 skills vendorizadas com `treeHash` conferido; `--check` verde.
- Suite do repo harness verde (baseline 60/60 + novos).
- Dogfood em cópia de projeto Flutter sob `/tmp`.

## 7. Riscos macro

| Risco | Sev | Mitigação |
|---|---|---|
| Regressão node/java+vue | 🔴 | STACK_PROFILES + filtro por stack + golden test |
| Drift do vendor | 🟠 | treeHash + `--check` no CI |
| Detecção dart vs flutter errada | 🟠 | pubspec obrigatório + discriminador `sdk: flutter` + menu confirmável |
| MCP mobile não configurado no host | 🟠 | A3 merge aditivo + passo humano no resumo |
| Rede no caminho de instalação | 🔴 | check estático proíbe `fetch`/`node:http(s)` em `installer/` |

## 8. ADRs

ADR-008 (profiles dirigidos por dados), ADR-009 (vendor escopado por stack), ADR-010
(wizard camada de apresentação) — detalhe na SPEC §1.

---

## Conclusão (2026-10-08)
- **Status:** COMPLETED · 14/14 tasks · 4 batches · reviews APPROVED (0 🔴)
- **Suítes:** plugins 104/104 · installer 162/162 · static PASS · dogfood mobile PASS
- **Verify:** 3/3 dimensões ✅ · traceability 100% · Security Verify pass (5/5 aplicáveis)
- **Arquivos entregues:** installer/install.mjs, scripts/vendor-skills.mjs, scripts/static-checks.mjs, installer/dogfood-mobile.mjs, .agents/skills/{dart-*,flutter-*,LICENSE-*,VENDOR-NOTICE.md,.vendor-lock.json}, SKILL.md, README.md + testes.
- **Ressalvas:** FU-29 (I9 CI wiring), FU-33..38 (cleanups/hardening), commit protected paths (trailer Harness-Gate-Change).
