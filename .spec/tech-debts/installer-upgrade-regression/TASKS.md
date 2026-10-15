# TASKS — Débito técnico: regressão do installer pós-`feat(installer): comando upgrade`

> **Contexto**: `.spec/tech-debts/installer-upgrade-regression/`
> **Detectado por**: orchestrator, no **Pre-Delegation Gate** (H2) do ciclo `prd-adr-pipeline`
> **Data**: 2026-10-15
> **Bloqueia**: delegação de implementação do ciclo `prd-adr-pipeline` (regra H2.3)

---

## 1. Sintoma

A suíte do installer está **vermelha em `main`**. O ciclo `prd-adr-pipeline` não pode receber implementação enquanto o débito P1 existir (H2: "zero tolerância a falhas pré-existentes"; "resolver P1 antes da feature do domínio").

## 2. Evidência (medida, não inferida)

Comando: `node --test "installer/__tests__/*.spec.mjs"` (`commands.suiteFull` do `harness.config.json`).

| Base git | Commit | Resultado |
|---|---|---|
| `b9e58e5` | `refactor: dual-export v1+v2 dos plugins opencode` | **pass 360 · fail 0** |
| `68be417` | `feat(installer): comando upgrade (overwrite gerenciado, backup verificado, idempotente)` | **pass 355 · fail 5** |

Execução adicional na árvore de trabalho (com o ciclo `prd-adr-pipeline` em curso) reproduziu a mesma falha com as mudanças do ciclo em `git stash`, confirmando **pré-existência** e não causalidade do ciclo atual.

**Suspeito único**: `installer/install.mjs` (+258/−22) no commit `68be417` — o único arquivo alterado nesse commit (`git diff b9e58e5 68be417 --stat`).

## 3. Testes que falham

| # | Teste | Arquivo | Asserção que quebra |
|---|-------|---------|---------------------|
| 1 | `main completo escreve conteudo + manifesto + checks PASS` | `installer/__tests__/` (suite CLI) | `checks PASS` |
| 2 | `main REAL: checks continua { passed: boolean, failed: [] } (ran implicito verdadeiro)` | `cli.spec.mjs:156` | `out.checks.passed === true` (obtido `false`) — "instalacao real roda os checks" |
| 3 | `CLI-02b FU-28: dry-run sinaliza checks NAO-executados` | `cli.spec.mjs` | contrato de `checks` no caminho dry-run |
| 4 | `FU-20: main() exige backup.verified===true antes de applyMerge (I1)` | suite CLI | invariante I1 de backup |
| 5 | `destino limpo instala: config+skills, checks verdes, pico-fim, exit 0` / `instala de verdade, prova re-install abort e limpa copia + backup` / `--keep preserva copia + backup...` | `dogfood`/`suite` | fase de `checks` / backup |
| 6 | `runDogfood — stack generica em copia /tmp` | `dogfood.spec.mjs` | checks verdes |

**Observação de determinismo**: uma execução listou 4 falhas e outra 5 do mesmo conjunto. A variação **não** é do conjunto observado acima isoladamente — é sinal de que pelo menos um caso é **flaky** (provável dependência de estado em `os.tmpdir()`; ver débito correlato `FU-43 P2: specs poluem /tmp`). Investigar antes de declarar a causa raiz como única.

## 4. Classificação

| Item | Prioridade | Racional |
|------|-----------|----------|
| Suíte do installer vermelha em `main` | **P1** | Viola H1/H2 (suite completa = 0 falhas antes de qualquer dev novo). Bloqueia todo ciclo novo por regra explícita. |
| Teste flaky no conjunto (4×5) | **P1** | Falha intermitente mascara regressão real e corrói a confiança na suíte — exatamente o custo que o harness existe para eliminar. |
| Commit `68be417` entrou sem suíte verde | **P2** | Processo: o commit violou o H1 (suite completa antes de finalizar). Vira lição no Brain + verificação de que o CI (`harness-integrity.yml`) **não** barra `push` por suíte vermelha — só por trailer de path protegido. Gap de processo a registrar. |
| Débito `FU-43` (specs em `/tmp`) | **P3** | Correlato; pode ser a causa do flaky. Registrar vínculo. |

## 5. Solução proposta (a executar em ciclo próprio de bugfix, B1–B4)

1. **Reproduzir com o erro real** (R1 do §4 do `workflow-rules.md`): rodar a suíte no commit `68be417` e capturar a mensagem completa da asserção de `checks` (`cli.spec.mjs:156`) e do invariante de backup (`FU-20`).
2. **Bissecar o diff** de `installer/install.mjs` em `68be417`: a fase de `checks` do `main()` e a ordem `backup → applyMerge` são os dois pontos que os testes cobrem. A hipótese mais provável é que o comando `upgrade` reordenou a execução dos checks ou condicionou `ran`/`passed` a um caminho que o install "normal" não percorre.
3. **Corrigir código ou teste** — decidir com evidência se o contrato de `checks` mudou legitimamente (então os 4 testes estão desatualizados) ou se a mudança quebrou o contrato (então o código está errado). **Não** marcar como "teste desatualizado" sem provar que o contrato novo é intencional.
4. **Determinismo**: rodar a suíte 3× seguidas e comparar a contagem; se variar, eliminar a dependência de estado em `/tmp` (vínculo com `FU-43`).
5. **Re-rodar a suíte completa** até 0 falhas, 0 skips não-autorizados.
6. **Registrar no Brain** (quando o MCP voltar): causa, solução, prevenção, severidade, frequência.

## 6. Riscos

- **Não corrigir** ⇒ o ciclo `prd-adr-pipeline` roda sobre base vermelha; qualquer falha nova fica indistinguível da pré-existente (mascaramento direto da regressão).
- **Corrigir tratando como "teste desatualizado"** sem provar a intenção do contrato ⇒ normaliza uma quebra de contrato de consumidor (o `checks.passed` é lido por consumidores do instalador).
- **Corrigir dentro do ciclo `prd-adr-pipeline`** ⇒ mistura de escopos: o ciclo de governança passaria a conter mudança de lógica do instalador, violando "escopo único" do `proposal-gate §2`.

## 7. Decisão do owner — ✅ RESOLVIDA (2026-10-15)

**Decisão**: abrir ciclo de **bugfix** para este débito, fechar em 0 falhas, e **então** retomar `prd-adr-pipeline`.

**Executado**: ciclo `installer-upgrade-regression` (B1–B4), interpretação **C** (installer auto-consistente).
**Artefato canônico**: `.spec/bugs/installer-upgrade-regression/TASKS.md` (bug, evidência, causa raiz, BF-01..BF-07, lições, débitos remanescentes).

**Resultado**: installer **372/372** (era 355/5) · determinismo 3×372 · `exitCode` corrigido nos caminhos CLI · code review **APPROVED** em 2 iterações · diff restrito a `installer/**` · nenhuma fixture afrouxada.

### 🟢 FECHADO

Débitos remanescentes deste tema foram reclassificados e vivem na §9 do artefato do bugfix (R-1..R-8) — inclui os achados colaterais (CI não barra suíte vermelha; registro de agentes ausente; skills indisponíveis; seal não republicado; Brain down).
