# TASKS — Bugfix: gate-counts-observation (conflito C-1)

> **Tipo**: Bugfix do próprio harness (fast-track B1..B4 de `.agents/rules/workflow-rules.md` §4)
> **Origem**: conflito **C-1** registrado em `workflow-state.json.conflicts[0]` (aberto desde o ciclo `prd-adr-pipeline`, 2026-10-16; confirmado empiricamente pelo QA no P4 de `harness-eixos-stack`)
> **Decisões do owner**: via **executor observa counts** · aceite **par ALLOW+DENY** · restrição **manter o gate forte + selo intacto**

---

## Sintoma
Um REPORT conforme o **schema** **não passa** na contraprova, e um REPORT que passa é **schema-inválido**:
- `counts` é **obrigatório** no schema (`.agents/schemas/harness-report.schema.json`, `required` inclui `counts`; `counts` exige `unit`/`it`/`frontend`).
- A contraprova **nega** counts declarados sem observação: `expectedCounts && !observedCounts` ⇒ `DenyError(contraprove-divergent, cause: counts-unverifiable)` (`gate.js:619-625`).
- O executor padrão **nunca observa counts**: `defaultContraproveExec` devolve `{ exitCode: 0, counts: null }` (`gate.js:561-572`).

Resultado: escrever `current_phase: "Completed"` exige um REPORT **sem** `counts` — que o gate aceita (não valida schema) e o schema proíbe. Os dois ciclos anteriores fecharam **com desvio declarado**.

## Causa raiz (🟢 observado)
**Assimetria entre duas partes do mesmo contrato:** o schema exige counts; o executor da contraprova não os observa; a regra de comparação trata "declarado e não observado" como **divergência** (decisão correta: claim não verificável não é prova) — logo a única saída não-mentirosa hoje é **omitir** o campo.

O comentário do próprio `gate.js` declara a limitação: *"Partial by declaration: the default executor observes exit codes only."*

## Solução (via escolhida pelo owner)
O executor da contraprova passa a **OBSERVAR** os counts do comando selado e o gate compara observado × declarado:

1. `defaultContraproveExec` captura o **stdout** do comando selado (hoje usa `stdio: "pipe"` e descarta) e **parseia os blocos de contagem** do `node --test` (`ℹ tests N` / `ℹ pass N` / `ℹ fail N` / `ℹ skipped N`).
2. **Mapeamento por segmento do comando selado**: a cadeia tem **2** invocações `node --test` — a 1ª (`plugins`) ⇒ `counts.unit`; a 2ª (`installer`) ⇒ `counts.it`; `counts.frontend` = `{passed:0,failed:0,skipped:0}` (não há frontend neste repo — declarado, não inventado).
3. **Fail-closed na observação**: se o número de blocos parseados **não** corresponder ao número de segmentos `node --test` do comando selado, o executor devolve `counts: null` (observação não confiável ⇒ o comportamento atual se mantém: counts declarado vira `counts-unverifiable`).
4. **O DENY para divergência real continua** (não afrouxar): `expectedCounts && observedCounts` divergentes ⇒ `contraprove-divergent` (inalterado).

## Testes exigidos (par ALLOW+DENY — é o critério de aceite)
1. **ALLOW**: REPORT com counts **iguais** aos observados ⇒ `allow` (com o executor novo, não com `execFn` injetado).
2. **DENY**: REPORT com counts **divergentes** ⇒ `contraprove-divergent`.
3. **DENY preservado**: executor que **não** observa (`counts: null`) + REPORT com counts ⇒ `counts-unverifiable` (fixture **FU-09** existente **não pode** ser afrouxada).
4. **Fail-closed da observação**: comando selado cujo número de blocos não casa ⇒ `counts: null` (e não um count parcial inventado).
5. **Prova de mutação dos DOIS lados**: (a) executor volta a devolver `counts: null` ⇒ o teste ALLOW sangra; (b) comparação afrouxada ⇒ o teste DENY sangra.

## Riscos
- **Parsing frágil**: a forma do output do `node --test` pode mudar. Mitigação: exigir o conjunto **completo** de marcadores por bloco; ausência ⇒ `counts: null` (nunca parcial).
- **Selo**: o comando selado e seu `sha256` **não** mudam (a mudança é no **executor**, não na cadeia). Verificar por teste/asserção que `commands.suiteFull` e o selo seguem intactos.
- **`gate.js` é o enforcement**: a mudança só vale em runtime **após restart** (plugins carregam no boot). O kill-switch (`HARNESS_GATES=off`) e o selo permanecem.
- **Fixtures existentes**: `gate.spec.mjs` tem ~10 pontos que injetam `execFn` com `counts: null` — eles devem **continuar passando** (o caminho do executor customizado não muda).

## Invariantes preservadas
`commands.suiteFull` e o selo **inalterados** · schema **inalterado** (`counts` continua obrigatório) · DENY de divergência real **mantido** · `installer/` intocado · REPORTs históricos **não** retro-consertados · `.spec/archive/**` intocado.

## Fora do escopo
Tornar `counts` opcional · retro-consertar os REPORTs antigos · mudar a cadeia selada · `installer/` · go/rust.
