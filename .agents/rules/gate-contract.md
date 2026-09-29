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
| I1 | `task` sem bloco PICCO válido ⇒ deny; tag `<open_questions>` obrigatória, vazia = válido; E1/E2 ausentes ⇒ deny, E3–E6 ⇒ aviso | `gate.js` em `tool.execute.before` — único primitivo de deny é `throw` (SPEC ADR-001); contrato exato da tag (SPEC ADR-004); input `{tool,sessionID,callID}` + `args` (RUNTIME-CONTRACT §4) | 🟢 garantido (SPEC §7.1) |
| I2 | `Completed` exige escrita pela via estruturada + contraprova por re-execução; próximo `task` exige `Completed` + `harness_status` + `code_review_status` do ciclo anterior | `gate.js` âncoras A (path-check em `args.filePath`/`args.patchText`, dois shapes de `write` — RUNTIME-CONTRACT H6) + B (state anterior) + re-execução do comando selado (SPEC ADR-008, ADR-002) | 🟠 parcial — escape por escrita fora da allowlist, coberto pelo CI (SPEC §7.1) |
| I3 | zero path/comando de projeto hardcoded em rules e plugins | check estático V3 — `grep` por literais (SPEC §12 V3); dados vêm de `harness.config.json` (SPEC ADR-003) | 🟢 garantido via CI (SPEC §7.1) |
| I4 | nenhum portão confiável existe apenas como prosa | auditoria manual periódica H7 — invariante **de processo**, não auto-enforçável (SPEC §7.1 I4) | 🟡 processo — declarado como tal, não como garantia (SPEC §7.1) |
| I5 | `orchestrator`/`code-reviewer`/`ux-designer` sem `write`/`edit` | `opencode.json` (`tools.write/edit: false`) — camada nativa, grosseira (SPEC §2, ADR-001) | 🟢 literal · 🟠 intenção — `bash` contorna (SPEC §7.1) |
| I6 | batch concluído não inicia o próximo sem pausa HITL; exceção: loop `developer-engineer → code-reviewer` (2 calls) | `hitl-guardrail.js` bloqueante; fronteira de turno via `chat.message` (1 call site — RUNTIME-CONTRACT §2); definição precisa de batch vs loop (SPEC §7.2) | 🟠 parcial (SPEC §7.1) |
| I7 | nunca executar `pkill -f`; `bash` contendo o padrão ⇒ deny | `gate.js` por parse de comando — **evadível** (`bash -c`, `python -c` — SPEC §7.3 fixture de evasão); `permission.bash` casa comando, não alvo (RUNTIME-CONTRACT H4); rede final = CI (SPEC ADR-007) | 🟠 parcial (SPEC §7.1) |
| I8 | `DenyError` ⇒ deny; qualquer outro erro ⇒ allow + log `error` | contrato tipado do dispatcher: `catch (e) { if (e instanceof DenyError) throw e; … }` (SPEC ADR-006); `throw` propaga sem `catch` no dispatcher (RUNTIME-CONTRACT §2) | 🟢 garantido (SPEC §7.1) |
| I9 | não-orquestrador não escreve em path protegido, por nenhuma via (incl. `bash`) | CI + pre-commit revertem/falham commit sem trailer `Harness-Gate-Change` (SPEC ADR-007); parse no gate é defesa em profundidade, evadível (SPEC §1 ADR-007) | 🔴 não garantido por runtime · 🟠 coberto por CI **após o passo 0** `git init` + remote + CI (SPEC ADR-007, §16) |
| I10 | motivo de negação sem segredo no log | scrub antes do log (SPEC RF-12, §7.1 I10) | 🟢 garantido (SPEC §7.1) |
| I11 | mapa `sessionID → agente` disponível aos gates que precisam | alimentado por `chat.message` / `chat.params` (`chat.params` inclui `agent` — RUNTIME-CONTRACT §4); `tool.execute.before` não traz o agente (SPEC §3) | 🟢 garantido (SPEC §7.1) |
| I12 | ordem config → schema → gate(warn) → enforce respeitada | checklist de rollout (SPEC §16, ADR-010) — processo | 🟡 processo (SPEC §7.1) |
| RF-01/RF-02 | config ausente/inválido ⇒ fail-closed com mensagem; comandos sempre resolvidos do config | `gate.js` loader (SPEC §8 RF-01/RF-02); `gates.*` do config é informativo, não desliga nada (SPEC ADR-009) | mecanismo em `gate.js` (Batch 4) |
| RF-04 | `Completed` sem `harness/<demand>.json` ⇒ deny; contagens divergentes ⇒ deny | contraprova por re-execução + selo `sha256` do comando (`sealed-command-mismatch` — SPEC ADR-002/U6=b) | mecanismo em `gate.js` (Batch 4) |
| KILL | desligar gates = env `HARNESS_GATES=off` no processo host; `harness.config.json` **não** desliga | leitura de env no `gate.js` (SPEC ADR-009); fato: config é gravável por `bash`, logo não pode ser kill-switch (SPEC §1 ADR-009) | 🟢 por construção (SPEC §15) |
| TIME | re-execução além de `contraproveTimeoutMs` ⇒ deny `contraprove-timeout` | veredito do gate, não exceção de plugin (SPEC ADR-002) | mecanismo em `gate.js` (Batch 4) |

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
