# VERIFY — prd-agnostic-artifacts-adr-002

> Verificação de 3 dimensões sobre o ciclo que executa o **ADR-002 do PRD-2** (entradas sempre-instaladas + autoria).
> Data: 2026-11-12. Branch: `adr/prd-agnostic-artifacts/02-entradas-sempre-instaladas`. HEAD: `6054418`.

## Veredito: **3/3 PASS**

| Dimensão | Resultado | Base |
|---|---|---|
| Completude | ✅ PASS | 11/11 microtasks; 5 artefatos; 4 desvios + 4 residuais declarados |
| Corretude | ✅ PASS | 1.097 testes (538 plugins + 559 installer) 0 falhas; 12/13 itens provados, 1 com prova 🟡 declarada |
| Coerência | ✅ PASS | `gate.js`/`harness.config.json`/`installer/`/`lib/**` com 0 linhas; selo `c904f1c5` idêntico; `V18`/`V19` inalterados |

## 1. Completude

- `TASKS.md`: 11/11 marcadas.
- **Desvios declarados**: (1) **10 hunks**, não 11 — git coalesce `558-563`; oráculo executável (`awk NR`=608, `numstat` 20/20) bate. (2) `PROJECT_TERMS["Atlas ECM"].proof` → `frontend-react-coding-standards.md:161`; a alternativa (`frontend-coding-standards.md:154`) criaria a 13ª ref pendurada do freeze `EX-VAL-06`. (3) item 9: `grep` global ⇒ **1** (`ux-designer/AGENT.md:259`, afirmação verdadeira do próprio papel); escopo do orchestrator ⇒ 0. (4) **item 3 🟡**: escrita real em `.spec/**` executada; negação em `.agents/**` provada por **resolução + fixture** — `opencode run --agent orchestrator` falhou por billing (`Insufficient balance`).

## 2. Corretude

| Bloco | Evidência |
|---|---|
| Permissão resolvida | `[{edit,*,"deny"},{edit,".spec/**","allow"},{shell,*,"allow"}]`; `i(deny*)=0 < a(allow)=1`; `system` 44.822 chars preservado (E1 não ocorreu); resolvedor lido no binário v2.2.4 (`findLast`, glob → `^…$`, recurso **relativo**) |
| 15 linhas | 4 genéricas → `commands.unit|suiteFull`; 11 → `condicional` por heading/célula; nenhuma invisível por acidente |
| Baseline | **96 → 80** (66 + 14); 16 entradas removidas com `sha256` do texto **antigo**; **80/80 restantes byte-idênticas**; fixture prova que remoção indevida sangra |
| `sdd-workflow-standard.md:3` | "projeto Atlas ECM" → "repositório que adota este harness"; `:16-18` nomeiam a sessão que escreve |
| I-3 / I-3b | classe inteira: `grep -nE "commands\.(integration|frontendTest|frontendBuild|backendRun|frontendRun)" .agents/rules/workflow-rules.md` ⇒ **vazio** |
| I-1 | `workflow-state.json` não afirma mais "orchestrator segue com `edit: deny`" (0 ocorrências) |
| Selo | `commands.suiteFull` byte-idêntico; `harness.config.json`/`installer/`/`seal.mjs` com 0 linhas |

**Suíte:** plugins 538/0 · installer 559/0 · static exit 0 · sdd 0 FAIL · vendor OK. `V20`: `baseline=80, prescriptions=178 (56/39/17/66), prohibition-cited=39, identity=14/11`.

## 3. Coerência

- **A permissão foi provada no runtime**: o reviewer extraiu o resolvedor do binário e testou 5 formas de burlar (glob mais amplo, `effect` trocado, `agent` vs `agents`, ordem invertida, override global) — todas fecharam.
- **Baseline encolheu com prova de causa**: 16/16 com `sha` antigo; 80 restantes intocadas; remoção indevida sangra.
- **Duas camadas concordam**: `gate.js:556-565` já permitia `.spec/**`; agora a permissão nativa também — sem deny de gate mascarando o allow.
- **`bash` continua evasão declarada** (I5): `workflow-state.json` e `.agents/**` seguem por `bash` até a decisão A/B/C.

## 4. Traceability

| RF | Task | Onde |
|---|---|---|
| RF-01, RF-02, RF-09 | ED-01..ED-03 | `opencode.json:18-21`, `config-dual-parity.spec.mjs:190-222` |
| RF-03, RF-05 | ED-04..ED-06 | `workflow-rules.md` (608 l., 20/20) |
| RF-06, RF-07 | ED-07, ED-08 | `sdd-workflow-standard.md:3,16-18`; `vocabulary.txt:46` |
| RF-04, RF-08 | ED-09 | `BASELINE` 96→80 |
| RF-10 | ED-10, ED-11 | suíte + diff dos protegidos |

**Cobertura: 10/10 RF · 13/13 itens · traceability 100%.**

## 5. Resíduos registrados (não bloqueiam)

| # | Item | Dono |
|---|---|---|
| S-1 | falso negativo da mesma classe de N8 em `workflow-rules.md:212,213,359` (skills sem eixo) | ADR-005 / PRD-4 |
| S-2 | ADR §4.2 cita `:448`; a frase da §5.4 está na `:449` | correção de texto |
| S-3 | `dev-planner/SKILL.md:162` ainda diz "gerado pelo `sdd-compiler`" | ADR-003 do PRD-2 |
| S-4 | `resolveEdit` do teste é oráculo-proxy; o oráculo real é o item 1 | declarado |

## 6. Conclusão

As 3 dimensões fecham. A dívida de maior alcance do repo — `workflow-rules.md`, que vai a **todo** destino — caiu de 15 para 0 linhas incondicionais, com a obrigação preservada por `commands.*` e não por `mvn`. A permissão do `orchestrator` existe de fato e a prosa de autoria parou de mentir. **Apto ao P5→P6.**
