# Harness v2 — Engenheiro de Software Especialista

Status: aprovado (2026-11-18) · Decisões: Q1=A · Q2=A · Q3=A
Repo: `harness` · Branch: `v2/` · Baseline: tag `v1.0`
Nota de path: gravação em `~/.opencode/plan` foi negada pelo gate (`orch-write-outside-allowlist`, `gate.js:668`); este plano vive em `.spec/**`, único path de escrita nativa do orchestrator.

---

## 1. Decisões travadas

| # | Decisão |
|---|---|
| Q1=A | Critério de aceite = **clean-room executável**: init em repo vazio → PRD → 2 ADRs → SPEC/TASKS por ADR → FE+BE implementados → gates verdes, medido por script em CI. |
| Q2=A | **Apagar** `installer/`, `installer-rs/`, `packaging/`, `.agents/skills/harness-installer/`, `docs/INSTALACAO.md`. Substituir por sync mínimo (`scripts/harness-sync.mjs`) + comandos `/harness-init`, `/harness-update`, `/harness-doctor`. Consumidores: re-init limpo em branch, com backup obrigatório; `update` recusa major sem `--force`. |
| Q3=A | Frontend suportado = **React + Vue** com Storybook. **Dart/Flutter sai do payload core** (vendor sob demanda). |

Restrições globais (não negociáveis):
- Os 4 gates atuais (`picco`, `evidence`, `hitlBatch`, higiene) continuam com enforcement; toda afirmação de gate cita mecanismo (`gate.js:<linha>`).
- `brain`, `harness-report.schema.json` e a skill `security-review` permanecem como SSoT.
- Orchestrator nunca escreve código de feature.
- Deepsearch mora em **uma** skill; agentes só referenciam.

---

## 2. Contrato de delegação (PICCO)

```xml
<role>Refatora o harness para v2 especialista em engenharia de software: apaga o instalador, troca o pipeline por PRD→ADR→SPEC/TASKS por ADR, separa frontend/backend specialists com deepsearch e adiciona workflow visual com Storybook. Defeito = gate atual perder enforcement, regra always-on acima do orçamento, ou contradição frontend remanescente.</role>
<task>Entregar harness v2 com clean-room aceitável (Q1=A) em 8 fases, sem instalador/installer-rs/packaging (Q2=A), React+Vue+Storybook e Dart/Flutter fora do core (Q3=A).</task>
<context>
  Repo: /home/joao/fusionlf/wsProjeto/harness
  Hoje: installer 139KB + 18.075 linhas de teste + installer-rs 3.773; rules 79KB always-on; orchestrator 678 linhas; 11 agentes; 53 skills/3.4MB; gates picco/evidence/hitlBatch/hygiene
</context>
<constraints>
  Sempre manter os 4 gates funcionando e citar mecanismo em toda afirmação de gate
  Sempre preservar brain + harness-report schema + security-review como SSoT
  Sempre manter orçamento: rules ≤20KB, orchestrator ≤160 linhas, agents ≤1.100 linhas, core skills ≤1.8MB
  Sempre tratar SPEC/TASKS como artefatos do ADR, não da feature
  Sempre validar por clean-room executável, não por prosa
  Nunca reescrever código de feature no orchestrator
  Nunca deixar contradição PrimeVue/shadcn, axios/fetch ou Remix/lucide
  Nunca duplicar deepsearch em cada agent prompt
</constraints>
<acceptance>scripts/acceptance-clean-room.mjs verde em CI (job harness-acceptance.yml) + suíte do repo sem falhas + orçamentos da seção 3 medidos</acceptance>
<open_questions></open_questions>
```

---

## 3. Orçamento mensurável (antes → depois)

| Item | Hoje | v2 | Como medir |
|---|---|---|---|
| `installer/` + `installer-rs/` + `packaging/` | 18.075 + ~5k + 3.773 linhas | ~400 linhas | `wc -l scripts/harness-sync.mjs scripts/seal.mjs` |
| `.agents/rules/*` (always-on) | 79 KB (~20k tok) | ≤20 KB / 4 arquivos | `du -b .agents/rules` |
| `orchestrator/AGENT.md` | 678 linhas | ≤160 | `wc -l` |
| Agentes (soma) | 1.723 linhas | ≤1.100 | `wc -l .agents/agents/*/*.md` |
| Skills | 53 / 3.4 MB | ~35 / ≤1.8 MB | `du -sh .agents/skills` |
| `workflow-state.json` | 128 KB | ≤20 KB + `workflow-history.jsonl` | `stat -c%s` |
| Gates | 4, zero de design | 4 (evidence estendido) | `gate.spec.mjs` |
| `docs/` | 79 KB + `{{PROVA_TMP}}` | README ≤150 linhas + `docs/ref/` | `wc -l` |

---

## 4. Fases

### F0 — Baseline (meio dia)
- `git tag v1.0`, branch `v2/`.
- Rodar suíte completa e registrar falhas pré-existentes (H2) em `docs/ref/baseline-v1.md`.
- Confirmar no runtime o diretório de comandos do projeto (`.opencode/command/` vs `.opencode/commands/`) — consumidores usam plural; verificar no binário antes de padronizar.
- Congelar inventário do que será apagado (F1) para o backup.

Saída: baseline registrado, nome do diretório de comandos confirmado.

### F1 — Apagar instalador (maior ganho, isolado)
Deletar:
- `installer/`, `installer-rs/`, `packaging/`
- `.agents/skills/harness-installer/`
- `docs/INSTALACAO.md`
- `{{PROVA_TMP}}/`, `baseline-suite.log`, `.harness-backup*` remanescentes

Criar:
- `scripts/harness-sync.mjs` — `init | update | doctor --target <dir> [--dry-run]`. Manifest + sha256 + backup. Substitui arquivos **harness-owned**; preserva `harness.config.json`, `workflow-state.json`, `.agents/rules/project-*.md`, `.spec/**`. Sem wizard, sem perfis/axes, sem rede.
- `scripts/seal.mjs` — emite `HARNESS_SEAL_JSON` a partir de `commands.suiteFull`.

Ajustar:
- `harness.config.json.commands` (remover testes do installer).
- `scripts/static-checks.mjs` (remover imports `installer/contract-*`, checagem V15).
- `.github/workflows/harness-integrity.yml`.

Testes: `scripts/__tests__/sync.spec.mjs` — create / update / preserva projeto / backup / idempotente / dry-run / zero rede.

Saída: `node scripts/harness-sync.mjs init --target /tmp/probe && node scripts/harness-sync.mjs doctor --target /tmp/probe` verde.

### F2 — Comandos
`.opencode/commands/harness-init.md`, `harness-update.md`, `harness-doctor.md` (≤40 linhas cada): detectar → plano → confirmar → aplicar → verificar.

`init` grava config mínimo, **sem perguntar stack**:

```json
{
  "version": 2,
  "project": "x",
  "targets": { "frontend": "react", "backend": "java" },
  "commands": { "suiteFull": "...", "unit": "..." },
  "evidence": { "path": "harness/" },
  "protectedPaths": ["..."]
}
```

`targets` é **detectado** (`package.json` / `DESIGN.md` / `pom.xml` / `Cargo.toml`), não escolhido em menu.

Saída: comando invocado em repo limpo cria config válido.

### F3 — Fluxo PRD→ADR→SPEC/TASKS
- `.agents/rules/workflow.md`: um único pipeline.
- Artefatos por ADR:
  ```
  .spec/prd/{prd-id}/
  ├── PRD.md
  ├── RESEARCH.md
  ├── ADR-INDEX.md
  └── ADRs/ADR-00N-{slug}/
      ├── ADR.md
      ├── SPEC.md
      ├── TASKS.md
      └── VERIFY.md   (no fechamento)
  ```
- `prd-adr-pipeline/checks.mjs`: `ADR-01`/`ADR-02` exigem `SPEC.md` + `TASKS.md` no diretório do ADR; `VERIFY.md` ao marcar `merged`.
- `sdd-compiler` v2: modos `spec-from-adr`, `tasks-from-adr`, `verify`, `archive`. Sai `PROPOSAL.md`; sai SPEC por feature.
- Estado: `workflow-state.json` enxuto + `workflow-history.jsonl` append-only.

Saída: PRD fixture → 2 ADRs → `SPEC.md`/`TASKS.md` em cada ADR → checks verdes.

### F4 — Agentes
- `orchestrator` ≤160 linhas: rotas, HITL, estado, template de delegação. Política nas rules.
- Delete `developer-engineer` → `frontend-engineer` + `backend-engineer`.
- Delete `planner` → `engineer` (base `dev-par-programer`: md-only, deepsearch, rubric CRÍTICO/ARQUITETURA/MELHORIA; escreve `RESEARCH.md`/análise; não decide ADR).
- Permissões estreitadas: `product-manager`, `architect`, `engineer`, `ux-designer` → `{"*":"deny",".spec/**":"allow"}`. Atualizar `opencode.json` + linha I5 do `gate-contract.md`.
- Remover hardcodes `:8080`, `:5173`, `mvn`, `taskflow/*` do orchestrator.
- Atualizar `KNOWN_AGENTS` em `gate.js` para o novo roster (frontend-engineer, backend-engineer, engineer) — hoje só conhece os antigos (`gate.js:626`).

Saída: `opencode debug config` mostra permissões resolvidas; `grep` sem hardcodes.

### F5 — Deepsearch + prompt-optimizer v3
- Skill `deepsearch`: quando buscar, citar URL+data, proibir assinatura de API de memória, julgar doc oficial vs blog.
- `prompt-optimizer` v3: Stage 0 (brain literal + probe do repo + eixo detectado) antes do score; ledger de premissas em `workflow-state.prompt_assumptions[]`; PICCO com `<context>` citando `arquivo:linha`; 174 → ~120 linhas + `references/`.
- Fixtures: 10 prompts (7 claros, 3 vagos). Meta: ≥7/10 Rota B na primeira tentativa; os 3 vagos continuam bloqueados.

Saída: fixture run documentado; nenhum default silencioso.

### F6 — Frontend/design
- Matar contradição: regra always-on só aponta; padrão React e padrão Vue viram skills por eixo. `frontend-coding-standards.md` e `frontend-react-coding-standards.md` deixam de ser always-on.
- Skills novas:
  - `design-system` — tokens→primitivos→blocos→telas, matriz de estados, a11y, anti-slop.
  - `storybook` — story por estado, build, screenshot review, interaction tests, adapter React/Vue.
  - `frontend-quality` — zero hex hardcoded, i18n, estados, 375/1280.
- Portar de `../harness-frontend`: `scripts/init.mjs`, `build-tokens.mjs`, `validate.mjs`, `DESIGN.md` template + adapter Vue.
- Comandos: `ui-bootstrap`, `ui-audit`, `ui-review`.
- Reescrever `ux-designer` (wireframe + matriz de estados + a11y + auditoria de tokens, **fora Pulse**) e `design-system-specialist` (lê `DESIGN.md`/tokens do destino, **fora Pulse**).
- Gate: `evidence` exige `frontend_evidence` (`stories[]`, `screenshots[]`, `a11y`) quando `targets.frontend` ≠ null. Sem campo ⇒ deny.
- Gate `picco`/`evidence` inalterados em assinatura.

Saída: app React de amostra → 3 telas via stories → build Storybook → review por screenshot → evidência reprova sem stories e aprova com.

### F7 — Gates & estado (paralelizável com F6)
- `gate-contract.md` v2: remove referências ao installer; adiciona `frontend_evidence`; permissões estreitadas; **selo declarado 🟠** (sem instalador, trust root = `config` + `.agents/seal.json` protegidos, recuperado por CI).
- Atualizar `gate.spec.mjs`, `matrix-*`, fixtures de evidência.
- Compactar `workflow-state.json`; criar `workflow-history.jsonl`; migrar chaves aditivas.

Saída: `node --test ".opencode/plugins/__tests__/*.spec.mjs"` verde.

### F8 — Clean-room + docs + tag
`scripts/acceptance-clean-room.mjs`:
1. tmp + `git init` → `harness-sync init` → doctor verde
2. PRD fixture → 2 ADRs → `SPEC.md`+`TASKS.md` por ADR → checks verdes
3. app amostra React+Node: 1 ADR backend, 1 ADR frontend (stories + página)
4. gates: PICCO nega bloco inválido; `Completed` sem report nega; report selado aprova; FE sem stories nega

CI: `.github/workflows/harness-acceptance.yml` roda em PR para `v2/`.

Docs: README/AGENTS ≤150 linhas; `docs/ref/` para o resto.
Brain: `brain_store` de decisões (arquitetura), sessão e lições.
Tag: `v2.0.0`.

---

## 5. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Quebrar bootstrap de consumidores | tag `v1.0` congelada; `update` recusa major sem `--force`; backup obrigatório |
| Trust do selo 🟢 → 🟠 | declarado no gate-contract + CI recalcula; sem promessa falsa |
| Dart/Flutter fora do core | vendor sob demanda, fora do payload |
| Layout antigo de `.spec` quebra checks | checks validam só ciclos novos; legado congelado em `.spec/archive/` |
| 8 fases longas | F6 e F7 tocam arquivos diferentes → paralelo |
| Regra enxuta perde gate | toda linha cita `gate.js:<linha>`; `static-checks` valida |

---

## 6. Ordem

`F0 → F1 → F2` (freio no instalador) · `F3 → F4 → F5` (fluxo e papéis) · `F6 ∥ F7` · `F8`.
