# FLIP-RUNBOOK — DOG-01: restart + smoke pós-restart (ação humana)

> Estado: arquivos prontos, runtime NÃO. `gate.js` com `DEFAULT_MODE="enforce"`,
> registrado em `opencode.json`, modos por gate consistentes — mas **nada disso
> está vivo no runtime até o restart** (o host carrega plugins no boot).
> Nenhum processo foi reiniciado por este batch; nenhum commit foi criado.

## 1. O que o flip mudou em arquivo (verificável sem restart)

| Item | Arquivo | Esperado |
|---|---|---|
| Registro | `opencode.json` → `plugin[]` | contém `./.opencode/plugins/gate.js` |
| Modo global | `gate.js` → `DEFAULT_MODE` | `"enforce"` |
| Modos por gate (FU-06) | `harness.config.json` → `gates.*` | `picco/enforce`, `evidence/enforce`, `hitlBatch/enforce`, `e2eGreenfield/warn` |
| Cache (FU-07) | `gate.js` → `isCacheableTreeHash` | `unknown` nunca acerta cache |
| Estado lazy (FU-11) | `gate.js` → `HarnessGate` | sem `loadWorkflowState()` eager; DenyError via `decide()` |
| Dogfood (DOG-01) | `.opencode/plugins/__tests__/dogfood.spec.mjs` | S1/S2/S3/S4 verdes |
| Suite | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 103/103 (este batch) |

Conferência rápida (1 comando, sem restart):

```sh
node --test ".opencode/plugins/__tests__/*.spec.mjs" && node scripts/static-checks.mjs
```

Verde esperado: 103/103; `static-checks` com FAIL V14 `REMOTE_URL_PENDING`
(declarado: sem remote, INF-01/INF-02 pendentes — não é regressão).

## 2. Ordem do restart (humano executa)

1. Salvar trabalho aberto (o restart derruba sessões ativas).
2. Encerrar o processo host do opencode (CLI/Desktop) normalmente.
   **Nunca `pkill -f`** — encerra pela UI/sinal do próprio processo.
3. (Opcional, recomendado) `HARNESS_GATES=off` **desligado** — i.e. variável
   ausente ou com outro valor — para o smoke valer como enforce real.
4. Subir o host de novo (mesmo binário/versão do contrato).
5. Confirmar no log/boot que `gate.js` foi carregado como plugin.

## 3. Smoke pós-restart (na ordem, aborta no 1º vermelho)

| # | Ação | Esperado |
|---|---|---|
| 1 | Delegar task **sem** `<open_questions>` | negada, motivo `picco-tag-absent` (S1/V5) |
| 2 | Delegar task com `<open_questions>texto</open_questions>` | negada, motivo `picco-tag-nonempty` |
| 3 | Delegar task com PICCO válido (tag vazia) **citando `current_feature`** | permite (continuação do ciclo). Sem citação, a âncora B nega corretamente (`prev-cycle-not-completed`) — ver smoke S3/2026-09-29 |
| 4 | `bash` com `pkill -f x` | negado, motivo `pkill-f` (S2/V11) |
| 5 | 3º `task` seguido sem turno humano | negado, motivo `hitl-pause-required` |
| 6 | Turno humano (`show status`) → novo `task` | permite (contador zerado) |
| 7 | Suite + checks de novo | 103/103, V14 como único FAIL declarado |

## 4. Rollback (se qualquer smoke falhar)

- **Imediato (sem tocar arquivo):** subir o host com `HARNESS_GATES=off`
  no ambiente — kill-switch ADR-009, todos os gates viram allow.
- **Definitivo:** `git diff` (sem commit neste batch) → revert dos arquivos
  do flip (`gate.js` DEFAULT_MODE, `opencode.json` registro) → restart de novo.

## 5. Pós-flip (fora deste batch)

- INF-01/INF-02 (`git init` + remote + CI): sem isso, ADR-007 segue inoperante
  (V14) e o trailer `Harness-Gate-Change` não é cobrado.
- A partir do restart, delegações usam `code-reviewer` (RENAME); o runtime
  antigo ainda registrava `fullstack-code-reviewer`.
