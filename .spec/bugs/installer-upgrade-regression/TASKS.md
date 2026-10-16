# TASKS — Bugfix: regressão do installer (`config-ref-missing` em instalação mínima)

> **Contexto**: `.spec/bugs/installer-upgrade-regression/`
> **Tipo**: `bugfix` · **Classificação**: **P1**
> **Origem**: detectado no Pre-Delegation Gate (H2) do ciclo `prd-adr-pipeline`
> **Débito correlato**: `.spec/tech-debts/installer-upgrade-regression/TASKS.md` (mesmo assunto — este arquivo é o artefato canônico do fluxo B1–B4)

---

## 1. Bug

Instalação real do harness passa a **reprovar nos próprios checks** que ela executa, mesmo quando o destino é exatamente o que a chamada pediu. `checks.passed` vira `false` e o CLI passa a sair com código 1.

**Esperado**: instalação real cujo destino reflete o `incomingFiles` informado ⇒ `checks.passed === true`, exit 0.
**Atual**: `checks.passed === false`, com 3 erros `config-ref-missing`; exit 1.

## 2. Evidência (reproduzida, R1)

Suíte: `node --test "installer/__tests__/*.spec.mjs"`

| Base | Resultado |
|---|---|
| `b9e58e5` (antes de `68be417`) | **360 pass · 0 fail** |
| `68be417` = `main` | **355 pass · 5 fail** |

Bissecção: `68be417` alterou **apenas** `installer/install.mjs` (+258/−22).

Reprodução direta da API `main()` com destino mínimo (`.agents/rules/x.md` como único `incomingFiles`):

```
exitCode      = undefined            ← ver §6, item de investigação
checks.passed = false
checks.failed = [
  "config-ref-missing: evidence.schema aponta '.agents/schemas/harness-report.schema.json' inexistente",
  "config-ref-missing: moduleMap.plugins aponta '.opencode/plugins' inexistente",
  "config-ref-missing: moduleMap.schemas aponta '.agents/schemas' inexistente"
]
```

Testes que quebram (5): `main completo escreve conteudo + manifesto + checks PASS` · `main REAL: checks continua { passed: boolean, failed: [] }` (`cli.spec.mjs:156`) · `CLI-02b FU-28: dry-run sinaliza checks NAO-executados` · `FU-20: main() exige backup.verified===true antes de applyMerge (I1)` · `destino limpo instala: config+skills, checks verdes, pico-fim, exit 0` / `runDogfood — stack generica em copia /tmp`.

## 3. Causa raiz

Check **novo** introduzido por `68be417` — `config-ref-missing` (`installer/install.mjs:790-800`), alimentado por `configReferenceTargets()` (`installer/install.mjs:713`).

O check percorre `evidence.schema` e `moduleMap.<HARNESS_OWNED_MODULEMAP_KEYS>` e **exige que cada path exista no destino**. A config gerada cita `.agents/schemas/harness-report.schema.json`, `.opencode/plugins` e `.agents/schemas` — artefatos que **não são escritos** quando o chamador fornece um `incomingFiles` mínimo (caso dos 5 testes, e possivelmente de instalações parciais legítimas).

Gravidade amplificada em `68be417`: o retorno passou a `exitCode: checks.passed ? 0 : 1`, então **qualquer** falha de check derruba asserções de `exit 0` que antes passavam por construção.

**Mecanismo exato**: `configReferenceTargets` filtra apenas globs (`!r.path.includes('*')`) — não distingue *ref que o próprio installer deveria ter escrito nesta execução* de *ref que só existe em instalação completa*. Logo, avalia refs de camadas ausentes do `incomingFiles`.

## 4. Gap de decisão (requer owner/architect — `workflow-rules.md §3.3`)

Há três leituras defensáveis; **a escolha define se o defeito está no código ou nos testes**:

| # | Interpretação | Consequência | Correção |
|---|---|---|---|
| **A** | O check está **certo**: destino sem `evidence.schema` é destino **inoperante** (o gate de evidência fica sem schema). As 5 fixtures simulam instalação inválida | Muda: `installer/__tests__/**` (5 casos) passam a fornecer schema + plugins; documentar que instalação mínima não é suportada | Só testes + doc |
| **B** | O check é **estrito demais**: instalação mínima/parcial é modo suportado ⇒ o check deve **pular** refs de camadas que não fazem parte desta execução (ou degradar para aviso quando a camada não está no `incomingFiles`) | Muda: `installer/install.mjs` (`configReferenceTargets` ou o loop em `:790`) | Código |
| **C** | O installer deve ser **auto-consistente**: se a config gerada cita `.agents/schemas/**` e `.opencode/plugins/**`, o installer **escreve** esses artefatos (ou para de citá-los) | Muda: `generateConfig`/`applyMerge` | Código |

**Recomendação registrada (não vinculante)**: **C** é a única que satisfaz a intenção declarada no próprio comentário do check ("senao o consumidor instala 'verde' mas inoperante") sem transformar o check em falso-positivo. **A** é aceitável se o modo mínimo for descontinuado explicitamente. **B** é o caminho mais barato, mas enfraquece o check e mantém o cenário "verde inoperante" que ele existe para pegar.

### ✅ DECISÃO DO OWNER (2026-10-15): interpretação **C**

O installer passa a ser **auto-consistente**: se a config que ele gera cita `.agents/schemas/**` e `.opencode/plugins/**`, ele escreve esses artefatos — ou deixa de citá-los. O check `config-ref-missing` **permanece** com a dureza atual (é ele que impede "instala verde e inoperante").

**Consequências vinculantes para a implementação:**
1. `config-ref-missing` **não** deve ser enfraquecido, nem pulado para refs ausentes (isso seria a interpretação B, rejeitada).
2. `generateConfig` e/ou `applyMerge` deixam de emitir referência para artefato que a mesma execução não escreve.
3. **Teste de idempotência obrigatório**: o comando `upgrade` (feature do mesmo commit `68be417`) não pode passar a reescrever artefatos de schema a cada execução.
4. As 5 fixtures **não** são o alvo da correção — devem voltar a passar porque a instalação passa a ser consistente, não porque o teste foi afrouxado.

## 5. Solução e tarefas (a executar em B2, por `developer-engineer`)

Depende da decisão do owner (§4). Ordem TDD:

- [x] **BF-01** — Congelar a reprodução: teste que falha hoje com destino mínimo, provando `checks.passed === false` com os 3 `config-ref-missing` (TDD FIRST). → `installer/__tests__/installer-upgrade-regression.spec.mjs` (BF-01) + **BF-01b** provando que o check segue duro (4 refs ausentes reprovam).
- [x] **BF-02** — Aplicar a correção escolhida (**C**): `generateConfig(answers, { writtenPaths })` deixa de citar `evidence.schema`/`moduleMap.*` quando a execução não os escreve; os 4 call-sites passam `writtenPathsOf(incomingFiles)`. Check `config-ref-missing` **inalterado**. → `installer/install.mjs`
- [x] **BF-03** — Congelar o contrato de `exitCode`: válido ⇒ 0; reprovado ⇒ 1, cobrindo os **3 caminhos do consumidor** (`main()`, `runCli` legado, wizard TTY). → `spec:249-358`
- [x] **BF-04** — Determinismo: 3 execuções consecutivas → **372 / 372 / 372** (0 fail, 0 skipped). Sem dependência de estado em `/tmp`. **Bônus**: o mesmo ID virou a trava anti-regressão do `writtenPaths` opt-in (enumera os 4 call-sites).
- [x] **BF-05** — Harness completo: `commands.suiteFull` exit 0 (plugins 216/216, installer 372/372, static PASS, vendor OK) + `sdd-checks` 8/8.
- [x] **BF-06** — Registrar no Brain: **FEITO (2026-10-15)** — `regras/global/global/harness/installer-config-ref-regression-2026-10-15` (regra reutilizável, scope `global`) + `sessoes/harness/2026-10-15-prd-adr-pipeline-e-bugfix-installer`. O MCP voltou no fim da sessão; as lições da §8 foram migradas. **Achado do brain_search prévio**: o check `config-ref-missing` e o fix de `exitCode` vieram do bugfix `harness-installer-operability` (2026-10-14) — logo `68be417` **regrediu um fix de um dia antes**, não introduziu bug novo.
- [x] **BF-07** — Fechar o débito em `.spec/tech-debts/installer-upgrade-regression/TASKS.md` (referenciando este arquivo).

### Resultado

| Métrica | Antes (`main 68be417`) | Depois |
|---|---|---|
| installer `pass/fail` | 355 / **5** | **372 / 0** |
| determinismo (3×) | 4–5 falhas variáveis | 372 / 372 / 372 |
| `exitCode` no CLI com checks reprovados | **0** (bug) | **1** |
| escopo do diff | — | `installer/install.mjs` + 1 spec novo; **nenhuma fixture editada** |
| `gate.js` / `harness.config.json` | — | **0 linhas** |

### Loop §6.2

| Iteração | Veredito do revisor | Ação |
|---|---|---|
| 1 | `APPROVED WITH CHANGES` — 1 🔴 (D1 `exitCode`), 2 🟡 (D2 cobertura, D3 opt-in) | re-delegado |
| 2 | **`APPROVED`** — 0 🔴; D1/D2/D3 fechados | fim do loop |

## 6. Itens de investigação em aberto

1. **`exitCode: undefined`** no retorno de `main()` observado na reprodução (o diff de `68be417` define `exitCode: checks.passed ? 0 : 1` em um ramo e `w.result.checks && ... ? 0 : 1` em outro). Confirmar se algum caminho retorna sem `exitCode` — se sim, é um segundo defeito, independente de A/B/C.
2. **Flakiness**: uma execução listou 4 falhas, outra 5, do mesmo conjunto. Confirmar se é `FU-43` (`/tmp` compartilhado) ou consequência de estado entre casos.
3. **Cobertura de CI**: o CI (`harness-integrity.yml`) **não** barra push por suíte vermelha — só cobra o trailer de path protegido. Foi por isso que `68be417` entrou vermelho. Gap de processo a registrar separadamente.

## 7. Riscos

- Corrigir por **A** sem declarar que o modo mínimo deixou de ser suportado ⇒ quebra silenciosa de consumidores que hoje fazem instalação parcial.
- Corrigir por **B** ⇒ o check deixa de pegar o cenário "instala verde mas inoperante" que o próprio commit declarou querer pegar.
- Corrigir por **C** sem teste de idempotência ⇒ o `upgrade` (a feature do mesmo commit) pode passar a reescrever artefatos de schema a cada execução.
- **Não corrigir e seguir** (override) ⇒ o ciclo `prd-adr-pipeline` roda sobre base vermelha e qualquer regressão nova fica indistinguível da pré-existente.

---

## Portão B1→B2 (HITL)

Aguardando decisão do owner sobre §4 (interpretação A, B ou C) antes de qualquer implementação.

---

## 8. Lições (BF-06 — retenção local enquanto o Brain MCP está down)

> Registrar no Brain (`regras/projeto/*`, scope `projetos`) assim que o MCP voltar. Lição retida aqui para não se perder.

1. **Check novo que valida a própria saída pode invalidar instalações legítimas.** `config-ref-missing` foi escrito para impedir "instala verde e inoperante", mas avaliava refs de camadas que a execução não escrevia. **Prevenção**: todo check que valida a config gerada deve ser exercitado contra o cenário **mínimo** de entrada, não só contra o cenário completo.
2. **Mudar o contrato de retorno (`exitCode`) sem teste é regressão silenciosa.** `68be417` passou a derivar `exitCode` de `checks.passed`, e só cobriu `runInit` — os caminhos CLI reais ficaram sem cobertura e o CLI saía 0 com instalação reprovada. **Prevenção**: contrato de retorno de CLI é asserção obrigatória por caminho de entrada.
3. **Commit entrou com a suíte vermelha e nada barrou.** O CI (`harness-integrity.yml`) só cobra trailer de path protegido; **não** roda/valida a suíte como portão de push. Gap de processo a endereçar.
4. **Default opt-in em parâmetro de contexto é dívida de manutenção.** `writtenPaths = null` preservou o golden, mas um call-site futuro sem o argumento voltaria ao falso-FAIL em silêncio. **Prevenção**: travar por teste que enumera os call-sites (feito no BF-04).
5. **Diagnóstico por bissecção de commit** (`b9e58e5` 360/0 → `68be417` 355/5, com o commit tocando 1 arquivo) resolveu em minutos o que "olhar o diff" não resolvia. Reutilizar.

**Severidade**: P1 · **Frequência**: 1ª ocorrência · **Tipo**: `error` + `anti-pattern`.

---

## 9. Débitos remanescentes (declarados, não bloqueantes)

| # | Sev | Item | Onde |
|---|-----|------|------|
| R-1 | 🟢 | Sem spawn end-to-end de instalação **reprovada** (o elo `process.exit(res.exitCode)` não é exercido por subprocesso; coberto por construção) | `installer/__tests__/cli.spec.mjs` |
| R-2 | 🟢 | Scan do BF-04 não é robusto a `(`/`)` dentro de string/comentário (modos de falha conservadores: falso-FAIL, não falso-PASS) | `installer-upgrade-regression.spec.mjs:373-380` |
| R-3 | 🟢 | Drift de doc: `evidence.schema` documentado como incondicional; linha-origem desatualizada | `docs/INSTALACAO.md:270`, `.agents/rules/harness-config.md:14` — **este último é path PROTEGIDO**, não corrigível no runtime atual |
| R-4 | 🟠 | CI não barra push com suíte vermelha (foi assim que `68be417` entrou) | `.github/workflows/harness-integrity.yml` |
| R-5 | 🟠 | Registro de agentes do harness ausente no runtime (`developer-engineer` etc.); isenção de path protegido sem sujeito | ambiente/`opencode.json` |
| R-6 | 🟠 | Skills do harness (`prompt-optimizer`, `sdd-compiler`, `spec-review`, `security-review`, `sdd-architecture-board`, `sdd-feedback`, `feature-status-dashboard`, `jira-microtask-breaker`) não são oferecidas pelo tool `skill`; regras e agentes ainda as citam como carregáveis ⇒ ponteiro morto | `.agents/rules/workflow-rules.md` §7, `.agents/agents/**` |
| R-7 | 🟠 | `HARNESS_SEAL_JSON` não republicado ⇒ escrever `current_phase:"Completed"` é negado pelo gate (falha fail-closed) | `pending_actions` do state |
| R-8 | 🟠 | Brain MCP down (HTTP 410) ⇒ `brain_store` impossível (BF-06) | `pending_actions` do state |
