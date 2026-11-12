# SPEC — prd-agnostic-artifacts-adr-002

> Prescritivo. Origem: `ADR-002` §3 (13 itens). Em conflito, o ADR prevalece. Tipo: governança com mecanismo.

## 1. Requisitos funcionais

- **RF-01 (itens 1, 2, 2b)** — `opencode.json.agent.orchestrator.permission.edit` = `{ "*": "deny", ".spec/**": "allow" }`; a **ordem** é asserida por teste de índice; objeto invertido e `agents.*` sem `prompt` reprovam.
- **RF-02 (item 3)** — escrita real: `.spec/**` grava, `.agents/**` é negado (prova descartável, worktree limpo ao fim).
- **RF-03 (itens 4, 5)** — `workflow-rules.md` sem linha `incondicional` (`scanArtifact` ⇒ `[]`); baseline **96 → 80** com as **27 chaves vizinhas intactas** (mapa literal, soma 80).
- **RF-04 (item 6)** — nada nasce: `cdl-unconditional-unbaselined` e `cdl-baseline-stale` com fixture.
- **RF-05 (item 7)** — nenhuma linha vira `null` por acidente: `awk NR` = 608 linhas, `numstat` = 20/20, `@@` = 11 hunks.
- **RF-06 (item 8)** — identidade "Atlas ECM" fora de `sdd-workflow-standard.md:3`; `PROJECT_TERMS["Atlas ECM"].proof` **re-apontado** para linha viva (`frontend-coding-standards.md:154`); `identity=14/11`.
- **RF-07 (item 9)** — prosa não atribui geração de `SPEC/PLAN/TASKS` a papel `edit: deny` (`grep` ⇒ 0).
- **RF-08 (item 10)** — `orchestrator/AGENT.md` preserva as 682 linhas (nada desloca as 9 entradas do ADR-005): `numstat` 4/4.
- **RF-09 (item 11)** — o teste assere **resolução** (3 caminhos: `deny` antes, `allow` depois, `agents.*` sem `prompt`).
- **RF-10 (itens 12, 13)** — `installer/` e `seal.mjs` sem diff; `commands.suiteFull` intacto; batch só em `.spec/**` + config + rules.

## 2. Invariantes

- **I1** — permissão se prova por **resolução**, nunca por presença de string.
- **I2** — baseline só encolhe: nenhuma entrada nova em nenhum arquivo.
- **I3** — reescrita preserva contagem de linha (nada desloca vizinhos).
- **I4** — `V18`/`V19`/`V20` seguem ortogonais; nenhum comando novo em `suiteFull`.
- **I5** — `bash: allow` permanece declarado como evasão, não como garantia.

## 3. Edge cases

- E1 — `agents.orchestrator` (plural) substitui `agent.orchestrator` e apaga `prompt` ⇒ `system:""`.
- E2 — `permissions` (array sob chave singular) é inerte: não muda nada e não reprova.
- E3 — heading `## 5.1 Backend (Java)` dá o gate; a linha sob ele vira `condicional` **sem** reescrever o texto.
- E4 — `PROJECT_TERMS` com `proof` morto ⇒ `cdl-identity-term-stale` FAIL (hoje aponta para a linha que este ciclo reescreve).

## 4. Estratégia de teste

| Nível | Comando | Esperado |
|---|---|---|
| Plugins | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 0 falhas |
| Paridade | `node --test ".opencode/plugins/__tests__/config-dual-parity.spec.mjs"` | 0 falhas, incluindo ordem |
| Instalador | `node --test "installer/__tests__/*.spec.mjs"` | 559 pass |
| Static | `node scripts/static-checks.mjs` | exit 0, `V20` com `baseline=80` |
| SDD | `node scripts/sdd-checks.mjs` | 0 FAIL |
| Permissão | `opencode debug config` + asserção de índice | exit 0 |

## 5. N/A declarado

Sem backend/frontend/DB: o entregável é prosa normativa + uma permissão de config.
