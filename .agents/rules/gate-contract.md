# gate-contract — prosa descreve, runtime nega (DOC-01)

> Regra normativa de **descrição**, não de enforcement (mesmo estatuto de
> `.agents/rules/harness-config.md`: SPEC §2, linha "`.agents/rules/*.md` —
> política descritiva — ❌ não bloqueia").
> **Regra do DOC-01:** toda afirmação de gate nesta prosa cita o mecanismo
> que a sustenta (RUNTIME-CONTRACT ou SPEC). Linha de gate sem citação =
> gate órfão = defeito. Nenhuma linha aqui nega tool por si só.

## 1. Onde mora cada negação

| # | Afirmação de gate | Mecanismo (citação obrigatória) | Garantia declarada |
|---|---|---|---|
| I1 | `task` sem bloco PICCO válido ⇒ deny; tag `<open_questions>` obrigatória, vazia = válido; E1/E2 ausentes ⇒ deny, E3–E6 ⇒ aviso | `gate.js` no hook v2 `ctx.tool.hook("execute.before", …)` (gate.js:1066, :1268) — único primitivo de deny é `throw` (SPEC ADR-001); contrato exato da tag (SPEC ADR-004); input `{tool,sessionID,callID}` + `args` (RUNTIME-CONTRACT §4) | 🟢 garantido (SPEC §7.1) |
| I2 | `Completed` exige escrita pela via estruturada + contraprova por re-execução; próximo `task` exige `Completed` + `harness_status` + `code_review_status` do ciclo anterior | `gate.js` âncoras A (path-check em `args.filePath`/`args.patchText`, dois shapes de `write` — RUNTIME-CONTRACT H6) + B (state anterior) + re-execução do comando selado (SPEC ADR-008, ADR-002) | 🟠 parcial — escape por escrita fora da allowlist, coberto pelo CI (SPEC §7.1) |
| I3 | zero path/comando de projeto hardcoded em rules e plugins | check estático V3 — `grep` por literais (SPEC §12 V3); dados vêm de `harness.config.json` (SPEC ADR-003) | 🟢 garantido via CI (SPEC §7.1) |
| I4 | nenhum portão confiável existe apenas como prosa | auditoria manual periódica H7 — invariante **de processo**, não auto-enforçável (SPEC §7.1 I4) | 🟡 processo — declarado como tal, não como garantia (SPEC §7.1) |
| I5 | **5 sem `edit`**: `orchestrator`/`code-reviewer`/`ux-designer`/`codebase-analyzer`/`security-engineer`. **Com `edit: allow`**: `developer-engineer`, `product-manager`/`architect` (a esteira exige criar `.spec/prd/**` — F1) e `qa-engineer` (o papel exige gravar o REPORT `harness/<demand>.json` — N1). No v2 não existe "escreve mas não edita": `write` **é** a ação `edit` | `opencode.json` (`permission.edit: deny`) — camada nativa, grosseira (SPEC §2, ADR-001). **Nota (medido, `opencode debug config`)**: a chave `write` **não** é recurso independente — o runtime a mapeia para a ação **`edit`**, logo `write: "deny"` é alias redundante, não uma segunda garantia | 🟢 literal · 🟠 intenção — `bash` contorna (SPEC §7.1). **Para o `qa-engineer`, o escopo de escrita é imposto pelo GATE, não pela permissão**: `isHarnessScoped` (`gate.js:402`) + deny em `gate.js:504` ⇒ fora de `harness/` ⇒ deny (por isso o `edit: allow` dele é seguro) |
| I6 | batch concluído não inicia o próximo sem pausa HITL; exceção: loop `developer-engineer → code-reviewer` (2 calls) | GATE-04 `gateHitlBatch` em `gate.js` (gate.js:931; registro do gate gate.js:1013, `gateName` gate.js:1018) nega o 3º `task` consecutivo da sessão; a fronteira de turno vem do event stream (`V2_TURN_BOUNDARY_TYPES`, gate.js:1105; `noteTurnBoundary`, gate.js:1123-1132; assinatura em `ctx.event.subscribe`, gate.js:1272-1294) — `hitl-guardrail.js` é no-op desde FIX-01 e `chat.message` não existe no v2; definição precisa de batch vs loop (SPEC §7.2) | 🟠 parcial (SPEC §7.1) |
| I7 | nunca executar `pkill -f`; `bash` contendo o padrão ⇒ deny | `gate.js` por parse de comando — **evadível** (`bash -c`, `python -c` — SPEC §7.3 fixture de evasão); `permission.bash` casa comando, não alvo (RUNTIME-CONTRACT H4); rede final = CI (SPEC ADR-007) | 🟠 parcial (SPEC §7.1) |
| I8 | `DenyError` ⇒ deny; qualquer outro erro ⇒ allow + log `error` | contrato tipado do dispatcher: `catch (e) { if (e instanceof DenyError) throw e; … }` (SPEC ADR-006); `throw` propaga sem `catch` no dispatcher (RUNTIME-CONTRACT §2) | 🟢 garantido (SPEC §7.1) |
| I9 | não-orquestrador não escreve em path protegido, por nenhuma via (incl. `bash`) | CI + pre-commit revertem/falham commit sem trailer `Harness-Gate-Change` (SPEC ADR-007); parse no gate é defesa em profundidade, evadível (SPEC §1 ADR-007) | 🔴 não garantido por runtime · 🟠 coberto por CI **após o passo 0** `git init` + remote + CI (SPEC ADR-007, §16) |
| I10 | motivo de negação sem segredo no log | scrub antes do log (SPEC RF-12, §7.1 I10) | 🟢 garantido (SPEC §7.1) |
| I11 | mapa `sessionID → agente` disponível aos gates que precisam | no v2 o agente chega no payload do hook `execute.before` (`recordSessionAgent`, gate.js:1181; mapa + cap de 1000 entradas, gate.js:245-262); `chat.params`/`chat.message` não são hooks do v2 (tabela v1→v2, gate.js:1080-1099) — SPEC §3 e RUNTIME-CONTRACT §4 descrevem o runtime v1; sem entrada no mapa, as regras por papel falham para allow (gate.js:240-243) | 🟢 garantido (SPEC §7.1) |
| I12 | ordem config → schema → gate(warn) → enforce respeitada | checklist de rollout (SPEC §16, ADR-010) — processo | 🟡 processo (SPEC §7.1) |
| RF-01/RF-02 | config ausente/inválido ⇒ fail-closed com mensagem; comandos sempre resolvidos do config | `gate.js` loader (SPEC §8 RF-01/RF-02); `gates.*` do config não desliga a suíte — o kill-switch é só o env `HARNESS_GATES=off` (SPEC ADR-009) — mas `resolveMode` só honra o literal `"enforce"`: qualquer outro valor rebaixa aquele gate para `"warn"`, e em `warn` o `DenyError` vira log + allow (gate.js:76-80, :171-174) | mecanismo em `gate.js` (Batch 4) |
| RF-04 | `Completed` sem `harness/<demand>.json` ⇒ deny; contagens divergentes ⇒ deny | contraprova por re-execução + selo `sha256` do comando (`sealed-command-mismatch` — SPEC ADR-002/U6=b) | mecanismo em `gate.js` (Batch 4) |
| KILL | desligar a suíte de gates = env `HARNESS_GATES=off` no processo host; `harness.config.json` **não** desliga a suíte (mas rebaixa um gate isolado — ver row RF-01/RF-02) | leitura de env no `gate.js` (SPEC ADR-009); o config é gravável por `bash`, logo não pode ser kill-switch da suíte (SPEC §1 ADR-009) — em contrapartida, `gates.<nome>` = qualquer valor ≠ `"enforce"` rebaixa aquele gate (gate.js:76-80, :171-174), o que é uma superfície de downgrade, não um kill-switch | 🟢 por construção (SPEC §15) |
| TIME | re-execução além de `contraproveTimeoutMs` ⇒ deny `contraprove-timeout` | veredito do gate, não exceção de plugin (SPEC ADR-002) | mecanismo em `gate.js` (Batch 4) |

| V15 | nenhuma referencia de rede em `installer/` (builtins, libs HTTP, globais, comandos child_process da classe fechada) | check estatico `checkV15` em `scripts/static-checks.mjs` (varre `installer/`; roda em `commands.suiteFull` via `harness.config.json` + CI `harness-integrity.yml` passo `static-checks`; bounds anti-ReDoS POR FORMA — string-unica {0,4} pares flag+arg antes do subcomando, array {0,200} chars antes do subcomando; teste de tempo <50ms nos dois caminhos) | 🟠 parcial — arestas declaradas: comando em variavel (`--suite-command`/`commands.suiteFull` lido em runtime — E1), alias de global/fetch (E2), specifier construido (E3), builtins internos fora da lista (`node:_http_agent` — E4), array-form com elemento quotado em qualquer posicao (E5), comandos de rede fora da lista fechada (E6), padrao dividido entre linhas (scan linha-a-linha — E7, nao cacado), alias de require (E8, nao cacado), npx so na forma string-unica (E9, nao cacado); FP residual `npx --version`; varredura e linha-inteira — mencao em comentario tambem bate (intencional); limites dos bounds: >4 pares flag+arg (string-unica) ou elemento de array >200 chars antes do subcomando git/pkg nao casa |

## 2. Não-promessas explícitas (o runtime NÃO tem — RUNTIME-CONTRACT §3/H5, §6)

1. **Prosa não é negada.** Nenhum hook bloqueia declaração em linguagem
   natural (RUNTIME-CONTRACT H5). "Declarou pronto em prosa e parou" é
   fuga de processo, coberta por regra de processo + âncora B no
   encadeamento (SPEC ADR-008) — nunca afirmar bloqueio de prosa.
2. **`permission.ask` não existe.** 0 call sites no binário
   (RUNTIME-CONTRACT §2, H1). Nenhum gate o usa; asserção de contrato
   `permission-ask-absent` (SPEC §7.3).
3. **`output.system = string` não propaga** (RUNTIME-CONTRACT H2);
   nenhum plugin re-injeta regra por esse hook (SPEC §6).
4. **Não existe evento de bus `tool.execute.after`** (RUNTIME-CONTRACT H3);
   handlers que filtram esse nome de evento **nunca disparam** (SPEC §7.3
   `bus-event-dead-handler`). Observação usa o hook confirmado
   `tool.execute.after` (7 call sites — RUNTIME-CONTRACT §2).
5. **Contraprova = consistência, não cobertura.** Cobertura de cenário de
   risco vem de `escalateOnRisk` (SPEC §5.1, §14): mudança em `riskPaths`
   exige evidência E2E do fluxo afetado. Suite verde + bug P0 = lacuna de
   cobertura, não falha da contraprova (RUNTIME-CONTRACT §6, caso ACL/ECM).

## 3. Higiene de prosa (vale para rules, skills e AGENT.md)

- Afirmar "bloqueia/nega/impede/garante" só com citação da linha da §1.
- Nível de garantia sempre explícito: 🟢 runtime · 🟠 parcial/CI-dependente · 🟡 processo · 🔴 declarado-aberto.
- `code-reviewer` (nome desde o RENAME, Batch 7 — SPEC §23/U11):
  veredito dele é parecer; o bloqueio é a
  âncora B lendo `code_review_status` (SPEC ADR-008, §5.3).
