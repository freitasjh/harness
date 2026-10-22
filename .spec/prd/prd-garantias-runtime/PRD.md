# PRD — Garantias de runtime verificáveis (3 lacunas P1)

> **prd-id**: `prd-garantias-runtime` (casa com `.spec/prd/prd-garantias-runtime/`)
> **Dono da aprovação**: owner do harness
> **Status**: draft — aguardando veredito do owner em `§16`; nenhum `ADRs/**` pode existir antes disso (INV-3 do contrato PRD-01)
> **Tipo de rota**: feature (decisão de arquitetura + implementação futura). Este PRD não implementa nada.
> **Mapa das 16 seções**: §1, §2, §5, §6, §7, §9 e §16 são obrigatórias; §3, §4, §8, §10–§15 são recomendadas.

## 1. Problema [obrigatória]
O harness **declara** garantias de runtime (prosa em `gate-contract.md`, chaves em `harness.config.json`) que o runtime **não aplica integralmente**. Três lacunas medidas: (P1-A) o config grava o modo de um gate e o rebaixa sem tocar em código; (P1-B) config ausente nega 2 das 4 tools sondadas, não todas; (P1-C) a contraproveva promete "contagens divergentes ⇒ deny" e o caminho real nunca compara contagens. O leitor — owner, revisor, auditor — não tem como saber quais garantias valem; a prosa já descreve o comportamento real (`gate-contract.md:26`, `:28`), mas o comportamento real ainda tem furos.
> ❓ Validação: o problema é de governança (garantia declarada ≠ garantia aplicada), não de implementação pontual? (sim/não)

## 2. Objetivo [obrigatória]
Tornar o conjunto de garantias do harness **verificável e coerente com a prosa**, fechando as 3 lacunas medidas (P1-A, P1-B, P1-C) **sem reduzir** a cobertura efetiva de negação. Resultado observável: (a) nenhuma tool call passa a ser permitida por bypass de configuração; (b) config indisponível deixa de produzir allow silencioso; (c) a contraproveva passa a afirmar apenas o que de fato verifica; (d) toda garantia afirmada tem mecanismo executável, testado e com lastro `arquivo:linha`.
> ❓ Validação: o objetivo é mensurável, descreve resultado e não solução? (sim/não)

## 3. Contexto e evidências
- **P1-A — rebaixamento de gate via config.** `resolveMode` só honra o literal `"enforce"`; qualquer outro valor cai para `"warn"`, e em `warn` o `DenyError` vira log + allow (`gate.js:76-80`, `:171-174`). `gates.*` está no config gravável (`harness.config.json:38-43`); a proteção de path do próprio config é parse de redirect/`tee` — evadível (`gate.js:949-1004`; `gate-contract.md:22`, I9). **Medido 2026-10-22**: `gates.picco="warn"` ⇒ `task` sem `<open_questions>` ⇒ **ALLOW** (`via: warn`); `gates.picco="enforce"` ⇒ **DENY** `picco-tag-absent`.
- **P1-B — config ausente não nega toda tool call.** `runGatesShim` engole o erro de load (`gate.js:1182-1189`, `config = null`); o `DenyError("config-unavailable")` só nasce *lazy*, nos gates que pedem o config (`gate.js:771`, `:993`). **Medido 2026-10-22**: `task` ⇒ **ALLOW**; `write`/`edit`/`bash` ⇒ **DENY** `config-unavailable`.
- **P1-C — contraproveva sem contagem.** O executor padrão devolve `counts: null` (`gate.js:561-572`) e o schema exige `counts` (`.agents/schemas/harness-report.schema.json:14`, `:40-48`); a comparação é inalcançável e o allow sai por `via: "counts-unverifiable"` (`gate.js:636-639`). **Medido 2026-10-22**: `runContraprova` com executor padrão ⇒ `via: "counts-unverifiable"`; o deny `contraprove-divergent` só dispara com executor injetado.
- Inventário canônico dos 3 achados: `docs/FUNCIONAMENTO.md` §10(a) — `a7` (`:646`), `a8` (`:647`), `a6` (`:645`).
- Contradição residual de prosa: o modelo de ameaça classifica "rebaixar gate via config" como Elevação de Privilégio, mitigação "`gates.*` não autoritativo", garantia 🟢 (SPEC `SPEC.md:491`, `:130-131`) — o código medido diz o contrário.
- Contexto operacional adjacente (condiciona o desenho, não é escopo): o selo vem de `HARNESS_SEAL_JSON`, fora do worktree, e selo ausente ⇒ deny `empty-seal` (`gate.js:753-764`, `:129-131`); o cache da contraprova só vale com `treeHash` real (`gate.js:113-115`, `:591-593`).
> ❓ Validação: cada afirmação de problema tem lastro `arquivo:linha` ou medição executada? (sim/não)

## 4. Público e impacto
- **Owner** — decide se a capacidade de rebaixar gate por config é desejada; sem essa decisão o ADR não fecha (§14.1).
- **Operador do harness** — perde a chave de diagnóstico se o rebaixamento sair do config; saída restante: `HARNESS_GATES=off`.
- **Revisor / auditor** — passa a poder auditar garantia por lastro `arquivo:linha` + nível, sem ler o gate inteiro.
- **Impacto**: fecha uma superfície de bypass de gate de segurança (P1-A); torna o fail-closed total, não parcial (P1-B); alinha a promessa de evidência machine-checkable (`README.md:12`) ao que o verificador executa (P1-C).

## 5. Métricas de sucesso [obrigatória]
| Métrica | Como medir | Meta |
|---|---|---|
| Gates rebaixáveis por config gravável | nº de gates de `CORE_GATES` cujo modo efetivo muda quando `gates.<chave>` ≠ `"enforce"` (enumeração `CORE_GATES` × `resolveMode`) | 0 |
| Tool calls allow com config indisponível | nº de tools que retornam `allow` em `runGatesShim` com `configPath` inexistente (sonda: `task`, `write`, `edit`, `bash`) | 0 |
| Contraprova que declara verificação não feita | nº de `runContraprova` que retornam `via: "counts-unverifiable"` no caminho do executor padrão | 0 |
| Afirmação de garantia sem lastro | nº de linhas de garantia em `gate-contract.md` e `docs/FUNCIONAMENTO.md` sem `arquivo:linha` nem nível | 0 |
| Nível declarado ≠ comportamento medido | nº de garantias cujo nível difere do resultado da sonda correspondente (sonda inexistente conta como divergência) | 0 |
| Suíte completa verde | `commands.suiteFull`: `node --test` + `node scripts/static-checks.mjs` + `node scripts/vendor-skills.mjs --check` | 0 falhas |
> ❓ Validação: toda métrica tem "Como medir" preenchido com sonda ou comando executável? (sim/não)

## 6. Escopo [obrigatória]
- **P1-A**: nenhuma chave de `harness.config.json` pode reduzir o modo efetivo de um gate registrado; se o rebaixamento for desejado, ele passa a viver em canal fora do worktree (ADR-009 já fixa o kill-switch na env do processo host). *Aceite*: sonda por gate — config com `gates.<chave>` = `"warn"`/`"off"`/valor inválido ⇒ modo efetivo inalterado; suíte completa verde.
- **P1-B**: config ausente ou inválido produz deny em toda tool call, com motivo acionável e sem ecoar o path. *Aceite*: sonda com `configPath` inexistente ⇒ deny `config-unavailable` nas 4 tools; `HARNESS_GATES=off` permanece como saída declarada.
- **P1-C**: a contraproveva declara o que verificou — contagem comparada, não comparável por falta de observador, ou não comparável por desenho — e a afirmação correspondente na prosa tem o mesmo alcance. *Aceite*: o veredito nunca retorna `via: "counts-unverifiable"` sem o motivo declarado, e o deny `contraprove-divergent` é alcançável pelo caminho de execução real **ou** a promessa é reduzida.
- **Coerência de prosa (transversal)**: toda garantia afirmada passa a citar `arquivo:linha` do mecanismo e o nível real (🟢/🟠/🟡/🔴), no formato já usado em `gate-contract.md` §1.
- **Este PRD não altera código, config, regra ou workflow-state** — só define problema, objetivo, escopo, métricas e critérios de aceite para os ADRs que virão.
> ❓ Validação: o escopo é fechado o bastante para caber em até 5 ADRs e não prescreve a solução? (sim/não)

## 7. NÃO entra [obrigatória]
- **a2 — `riskPaths`/`escalateOnRisk` sem consumidor no runtime** (`docs/FUNCIONAMENTO.md:641`): follow-up; nenhum gate registrado consome essas chaves (`gate.js:89-93`, `:1015-1018`).
- **b1..b6 — checks por parse** (path protegido, `pkill -f`, identidade de agente): são evasão declarada com CI como rede final (`gate-contract.md:20`, `:22`); não são as 3 lacunas deste ciclo.
- **d1 — `workflow-state.json` com 81 chaves de topo** (7 canônicas): deriva de estado, não de garantia de runtime.
- **d2 — `sdd-orquestrador` sem registro em `opencode.json`** (10 papéis vs 9 agentes): cadastro de agente, não garantia.
- **Decisão A/B/C sobre `orchestrator.permission.edit`** (`workflow-state.json` → `enforcement_status.pendente`): decisão de permissão do owner, não lacuna de garantia.
- **Reescrita de UX, mudança de stack, novo instalador, propagação de checks ao repo-destino.**
- **Novos denies de runtime fora dos 3 itens** — este ciclo fecha lacunas existentes; não amplia a superfície de negação.
- **Follow-up — prosa residual da SPEC arquivada**: `.spec/archive/20260929-harness-v7-hardening/SPEC.md:491`, `:130-131` ainda afirma que `gates.*` não é autoritativo, com garantia 🟢 — o código medido diz o contrário (o config rebaixa o gate). O arquivo arquivado é **histórico imutável** e não é editado; a divergência fica registrada aqui para o próximo ciclo que mexer na SPEC.
> ❓ Validação: as exclusões estão declaradas (não inferidas) e cobrem os achados que NÃO entram? (sim/não)

## 8. Riscos e mitigação
- **Fail-closed total trava o agente** com config inválido (P1-B): mitigação — `HARNESS_GATES=off` é a saída declarada (ADR-009) e o deny carrega motivo acionável; o escopo do deny (toda tool call × só as tools que dependem do config) é decisão do owner (§14.2).
- **Comparar contagens por parse da saída do teste é frágil**: parsers variam por runner (node --test, vitest, maven). Mitigação — implementar a comparação × reduzir a promessa é decisão do owner (§14.3); enquanto não decidida, a prosa declara o alcance real.
- **Retirar o rebaixamento do config tira uma capacidade de diagnóstico** (§4): mitigação — o canal de downgrade passa a ser explícito e fora do worktree, ou deixa de existir; decisão do owner (§14.1).
- **Falsa sensação de "depois a gente arruma"**: mitigação — o ADR fixa a ordem e a prosa passa a declarar o nível real no mesmo PR.
- **Deny mais amplo ⇒ falsos negativos** (ex.: `task` legítimo bloqueado por config ilegível): mitigação — `reason` estruturado e distinguível do deny de política (RF-06).
- **Prosa e código divergirem de novo**: mitigação — RF-04 torna a divergência detectável por check estático, não por leitura.

## 9. Requisitos funcionais [obrigatória]
- **RF-01**: nenhuma chave de `harness.config.json` altera o modo efetivo de um gate registrado. *Verificável*: para cada gate de `CORE_GATES`, config com `gates.<chave>` ∈ {`"warn"`, `"off"`, inválido} ⇒ modo efetivo = `enforce`.
- **RF-02**: config ausente ou inválido ⇒ deny de **toda** tool call, com motivo `config-unavailable` e sem eco do path. *Verificável*: sonda nas tools `task`/`write`/`edit`/`bash`.
- **RF-03**: a contraproveva declara o que verificou (comparou / não comparável por falta de observador / não comparável por desenho) e a garantia correspondente na prosa tem o mesmo alcance. *Verificável*: teste do contrato do veredito + conferência da prosa.
- **RF-04**: toda afirmação de garantia em prosa cita `arquivo:linha` do mecanismo e o nível real. *Verificável*: check estático na suíte existente (sem novo bloqueio de runtime).
- **RF-05**: rebaixamento de gate, quando existir, é **registrado em log** — nunca silencioso. *Verificável*: teste do logger.
- **RF-06**: o deny por config indisponível é distinguível do deny de política (`reason` distinto), para que o operador saiba a causa. *Verificável*: teste do `reason`.
- **RF-07**: a suíte completa permanece verde durante e depois do ciclo. *Verificável*: `commands.suiteFull`.
> ❓ Validação: cada requisito tem uma sonda ou teste que o reprova hoje? (sim/não)

## 10. Histórias de usuário
- **Como** owner do harness, **Dado** um `harness.config.json` gravável com `gates.picco: "warn"`, **Quando** um agente dispara `task` sem `<open_questions>`, **Então** a tool call é negada como se o config dissesse `"enforce"`.
- **Como** operador do harness, **Dado** um `harness.config.json` ausente ou com JSON inválido, **Quando** qualquer tool é chamada, **Então** a chamada é negada com `config-unavailable` e existe saída declarada (`HARNESS_GATES=off`).
- **Como** revisor, **Dado** uma garantia afirmada em `gate-contract.md`, **Quando** ele a lê, **Então** ela cita `arquivo:linha` do mecanismo e o nível real, e o comportamento citado é o medido.
- **Como** auditor, **Dado** um relatório `harness/<demand>.json` com `counts` declarado, **Quando** a contraprova roda, **Então** o veredito diz se as contagens foram comparadas, e a prosa "contagens divergentes ⇒ deny" corresponde ao que o verificador executa.

## 11. UX / experiência
Sem tela. A experiência é do operador durante o ciclo: (a) o `reason` do deny **é** a interface — precisa dizer o que foi negado, por quê e qual a saída; (b) rebaixamento, se existir, não pode ser silencioso: o operador precisa perceber que está com poder reduzido; (c) `harness/<demand>.json` continua sendo o artefato que o humano lê para julgar a entrega — P1-C muda o alcance da afirmação, não o formato do relatório.

## 12. Dependências
- `docs/FUNCIONAMENTO.md` §10(a) — inventário canônico dos achados (`:641`, `:645`, `:646`, `:647`); precisa seguir coerente depois do ciclo.
- `.agents/rules/gate-contract.md` §1 (rows I1..I12, RF-01/RF-02, RF-04, KILL) — prosa das garantias; `.agents/rules/harness-config.md` — política de kill-switch.
- SPEC do harness v7 (arquivada em `.spec/archive/20260929-harness-v7-hardening/SPEC.md`): §7.1 invariants (`:284-298`), ADR-009 (`:128-134`), modelo de ameaça (`:491`).
- `.opencode/plugins/gate.js`: `resolveMode`/dispatcher (`:76-80`, `:161-177`), loader de config (`:220-236`, `:1182-1189`), contraproveva (`:561-572`, `:619-639`), selo (`:120-135`, `:753-764`).
- `.opencode/plugins/lib/config.mjs` (loader; `configGatesDisableEnforcement` hoje sempre `false`, `:38-40`) e `.opencode/plugins/lib/seal.mjs` (selo do comando canônico).
- `harness.config.json`: `gates.*` (`:38-43`), `contraproveTimeoutMs` (`:55`), `evidence` (`:56-59`), `protectedPaths` (`:36`).
- `node scripts/static-checks.mjs` (roda `PRD-01`/`ADR-01`/`ADR-02`) e `scripts/sdd-checks.mjs` — a suíte que este PRD não pode quebrar.

## 13. Segurança
- P1-A é **elevação de privilégio dentro do próprio harness**: um gate de segurança (path protegido, PICCO, evidência) pode ser rebaixado por edição de arquivo — o arquivo que o gate deveria proteger. Tratar como superfície de bypass, não como chave de conveniência.
- P1-B é **defesa em profundidade**: fail-closed parcial amarra a garantia ao detalhe de *quais* gates leram o config; qualquer gate novo que não leia config reabre o furo.
- P1-C é **integridade de evidência**: uma garantia de verificação que o verificador não executa é pior que garantia nenhuma — cria confiança falsa e enfraquece a mitigação de Spoofing do modelo de ameaça (`SPEC.md:492`).
- Nível por garantia: o objetivo do ciclo é que toda linha de garantia carregue 🟢/🟠/🟡/🔴, e que nenhuma garantia nova nasça 🟢 sem sonda.
- Log sem segredo: o motivo do deny de config não pode ecoar o path (I10; `gate.js:145-156`).

## 14. Perguntas abertas
1. **P1-A — onde deve viver a capacidade de rebaixar o modo de um gate?** *Resposta do owner (2026-10-22)*: o rebaixamento **passa a viver no env do processo host** (mesmo desenho do kill-switch, ADR-009); `gates.*` no `harness.config.json` volta a ser **puramente informativo** — nenhuma chave do config altera o modo efetivo de um gate. → **decisão do owner**, vira o ADR-001. (§8 risco 3)
2. **P1-B — o deny de config indisponível cobre quais tool calls?** *Resposta do owner (2026-10-22)*: **toda tool call** (fail-closed total); `HARNESS_GATES=off` permanece como a saída declarada. → **decisão do owner**, vira o ADR-002. (§8 risco 1; RF-02)
3. **P1-C — a comparação de contagens: implementar ou reduzir a promessa?** *Resposta do owner (2026-10-22)*: **híbrido** — `counts` passa a ser **opcional** no schema; se o relatório declara `counts`, o gate compara e nega em divergência (`contraprove-divergent`); se não declara, o veredito declara explicitamente "não comparável". A promessa da prosa assume o mesmo alcance do verificador. → **decisão do owner**, vira o ADR-003. (§8 risco 2; RF-03)
4. **P1-A (detalhe) — se o downgrade por gate existir, deve exigir flag explícita + motivo + registro de auditoria, além do log?** *Não decidido pelo owner*: o **onde** o rebaixamento vive já está decidido (Q1); o **como** é detalhe de desenho. → entra no **ADR-001**. (RF-05 assume log.)
5. **Prosa residual — a SPEC arquivada (`.spec/archive/20260929-harness-v7-hardening/SPEC.md:491`, `:130-131`) ainda afirma que `gates.*` não é autoritativo, com garantia 🟢 — entra neste ciclo?** *Decidido (2026-10-22): NÃO entra* — `.spec/archive/` é histórico imutável por contrato; o arquivo arquivado **não é editado**. → **follow-up** (a registrar na §7 — NÃO entra).

## 15. PICCO (prompt da demanda)
<task>Escrever o PRD do ciclo PRD → ADR → SDD que fecha 3 lacunas P1 de garantia do harness (rebaixamento de gate via config gravável; config ausente que não nega toda tool call; contraproveva que não compara contagens), sem implementar nada: lastro arquivo:linha em cada afirmação de problema, métrica com "Como medir" preenchido, §16 com veredito do owner registrado antes de qualquer ADR e nenhum ADR criado nesta etapa.</task>
<context>Repo harness (governança de agentes opencode), ramo main, ciclo aberto pelo owner em 2026-10-22 ("Abrir ciclo SDD/ADR do P1"). Lastro: docs/FUNCIONAMENTO.md §10(a) a7/a8/a6 (linhas 646/647/645) e sondas medidas em 2026-10-22 sobre gate.js:76-80/171-174, :1182-1189/771/993, :561-572/619-639. Fora de escopo: a2 (riskPaths sem consumidor), b1..b6 (parse), d1/d2 (estado e cadastro de agente).</context>

## 16. Aprovação [obrigatória]
- **Veredito**: **aprovado** (sem ressalvas)
- **Data**: 2026-10-22
- **Portão**: **G1** (humano/HITL) — aprovação do owner para a criação dos ADRs
- **Aprovador**: owner do harness
- **Decisões do owner registradas neste portão** (insumo dos ADRs — não são recomendações do agente):
  - **P1-A / Q1 — destino do rebaixamento**: o modo efetivo de um gate passa a viver no **env do processo host** (mesmo desenho do kill-switch, ADR-009). `gates.*` em `harness.config.json` volta a ser **puramente informativo** — nenhuma chave do config altera o modo de um gate.
  - **P1-B / Q2 — escopo do deny de config indisponível**: **toda tool call**. `HARNESS_GATES=off` permanece como a saída declarada.
  - **P1-C / Q3 — escopo da contraprova**: **híbrido** — `counts` passa a ser **opcional** no schema: declarado ⇒ comparado (divergência nega); ausente ⇒ o veredito declara "não comparável". A promessa da prosa assume o mesmo alcance do verificador.
- **Nota**: o agente redigiu; o veredito é do owner. Aprovado **antes** de qualquer `ADRs/**` existir (INV-3 do contrato PRD-01) — a criação dos ADRs está liberada.
> ❓ Validação: o owner aprovou (veredito + data) antes de qualquer ADR? (sim/não)
> **Resposta**: **sim** — aprovado sem ressalvas em 2026-10-22, com as três decisões acima registradas.
