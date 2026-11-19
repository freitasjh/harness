# ADR-001 — Seção gerenciada delimitada em AGENTS.md/DESIGN.md, artefatos próprios em create-or-skip e stack por detecção com override: identidade do init sem sobrescrever arquivo vivo

- **prd-id**: `prd-init-project-scaffold` — `.spec/prd/prd-init-project-scaffold/PRD.md` (§16 **APROVADO** em 2026-11-18 por joao).
- **order**: 1 de 1 linha real (`.spec/prd/prd-init-project-scaffold/ADR-INDEX.md`).
- **status**: `in-progress` — decisão ratificada neste batch; `SPEC.md`/`TASKS.md` pendentes, gerados pelo `sdd-compiler`. `ADR-01` reprova nesse intervalo por desenho (`unit: adr sem SPEC.md`/`sem TASKS.md`); estado declarado no `ADR-INDEX.md` e no campo `Status` abaixo.
- **branch**: `adr/prd-init-project-scaffold/01-managed-section-scaffold`.
- **data**: 2026-11-18.
- **depende-de**: — (primeira linha do ledger; nenhum ADR anterior deste PRD).
- **dono da decisão**: owner do harness. As três decisões de PRD §14/§16 — (a) `update` preserva seção `<!-- harness:v2 -->` editada e reporta divergência, nunca reescreve; (b) stack indeterminada sem flags ⇒ exigir flag; (c) `AGENTS.md`/`DESIGN.md` anexados fora do manifesto — são **insumo fechado**; este ADR as implementa, não as reabre.
- **insumo de pesquisa**: `RESEARCH.md` §§2–7 — recomendação híbrida **A+B+D**, 11 fontes oficiais consultadas em 2026-11-18. Toda afirmação sobre código atual cita símbolo/caminho; todo comportamento novo está marcado **REQUISITO a implementar** (lição `regras/projetos/atlas-ecm/prosa-regra-nao-promete-mecanismo-ausente`).
- **escopo de escrita desta entrega**: somente `ADR-INDEX.md` e este `ADR.md`, sob `.spec/prd/prd-init-project-scaffold/**`. Nenhum `SPEC.md`, `TASKS.md`, `RESEARCH.md`, código, config, gate ou `workflow-state.json` foi tocado.

## Decisão

**Adotar seção gerenciada com par de marcadores `<!-- harness:v2:start -->` / `<!-- harness:v2:end -->` como única mutação permitida em `AGENTS.md` e `DESIGN.md`; tratar `.agents/rules/project-{frontend|backend|fullstack}.md` e `tokens/*.json` como artefatos próprios em `create|skip`; resolver a stack por `detectTargets` sobreposta por `--frontend`/`--backend`, com recusa `exit 1` quando não há sinal; e manter os arquivos anexados fora do manifesto e fora do hash do `doctor`.** 🟢 para as decisões do owner (14a/14b/14c) e para a forma do contrato; 🟡 para execução — cada item é REQUISITO e só passa a valer como comportamento após o SDD desta ADR.

Corolário de integridade: nenhum byte de conteúdo pré-existente do consumidor é reescrito, reordenado ou reencodado. A única escrita em arquivo vivo é o append do bloco delimitado ao final; toda escrita nova passa pela via única `writeGuarded` (`scripts/harness-sync.mjs:527`), e o manifesto continua sendo o último write (`writeManifest` em `:482`, `applyPlan` em `:635-649`).

## Motivo

Dor medida em `scripts/harness-sync.mjs`: `PAYLOAD_FILES` (`:145-149`) não inclui `AGENTS.md`; `PRESERVED_RES` (`:159`, `isPreserved` em `:161-166`) protege `.agents/rules/project-*.md` **sem nunca criá-los**; não há geração de `DESIGN.md`/tokens; `detectTargets` (`:417-437`) já devolve `frontend ∈ {react,vue,null}` e `backend ∈ {java,rust,nestjs,node,null}`, mas as flags são só `--target/--dry-run/--suite/--unit/--backup-dir` (`:10-12`, `:1018`) — `--frontend`/`--backend` não existem. Resultado: operador monta identidade na mão, com conteúdo divergente entre projetos; automatizar ingenuamente arrisca apagar `AGENTS.md`/`DESIGN.md` vivos.

As três decisões do owner eliminam as saídas tentadoras: reescrever seção editada (14a), inventar `project-fullstack.md` sem sinal (14b) e cobrir arquivo anexado com sha256 integral (14c — edição legítima viraria `doctor` FAIL). O par de marcadores resolve o problema que um marcador único deixa em aberto (`RESEARCH.md` §6): com `<!-- harness:v2 -->` simples não há como distinguir "seção vazia" de "um par", nem contar ocorrências de forma não ambígua; com `start`/`end` a cardinalidade é `1+1` e a detecção é determinística.

Reaproveitar `mergeManaged` (`:390-400`) seria enganoso: ele faz merge **por chave de JSON** para `opencode.json`, não por marcador textual em Markdown. Reaproveitar `manifestFiles` (`:615-627`) não: ele já suporta `inManifest: false` (`:623`, usado por `planConfig` em `:545-554`), que é exatamente o gancho de 14c sem mecanismo novo de hash parcial.

## Alternativas descartadas

Todas as fontes abaixo são as do `RESEARCH.md` §7, consultadas em **2026-11-18**; uma afirmação por citação.

| Alternativa | Por que não | Fonte oficial (URL — consulta) |
|---|---|---|
| **A sozinha** — template com `skip`/`preserve` e manifesto; arquivo existente nunca é tocado | Cobre `created`/`skip` e reusa `buildPlan`/`applyPlan`, mas **não entrega MS-2**: não anexa a seção a `AGENTS.md`/`DESIGN.md` pré-existentes e não reporta divergência (14a). Insuficiente sozinha; adequada só aos artefatos próprios. | `dotnet new --dry-run` mostra o plano e `--force` é necessário para sobrescrever — https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-new — 2026-11-18; Rails `-p/--pretend`, `-f/--force`, `-s/--skip` — https://guides.rubyonrails.org/generators.html — 2026-11-18; Yeoman submete escrita sobre arquivo pré-existente a resolução de conflito e só commita ao final — https://yeoman.io/authoring/file-system.html — 2026-11-18 |
| **B com marcador único** (`<!-- harness:v2 -->` servindo de abertura e fechamento) | Satisfaria 14a/14c, mas a gramática fica ambígua: uma ocorrência pode ser seção vazia, duas podem ser um par ou dois marcadores órfãos. Difícil de testar por contagem e de distinguir de edição humana. Prefere-se o par `start`/`end` com cardinalidade explícita. | Rails `inject_into_file` com sentinela textual e `force: false` — https://api.rubyonrails.org/classes/Rails/Generators/Actions.html — 2026-11-18; Go usa linha sentinela `^// Code generated .* DO NOT EDIT\.$` antes do primeiro texto não-comentário — https://go.dev/src/cmd/go/internal/generate/generate.go — 2026-11-18 |
| **B sozinha** — só anexo demarcado, sem `create|skip` de artefatos próprios | Não gera `.agents/rules/project-*.md` nem tokens; deixa MS-1 pela metade. O híbrido A+B é necessário: A para o que o gerador possui, B para o que o consumidor possui. | Angular Schematics aplica transformações em `Tree` com `base` + staging ao disco só após validação; merge strategy aceita/ignora/lança — https://angular.dev/tools/cli/schematics-authoring — 2026-11-18; Yeoman alerta que editar arquivo existente por RegEx é "perilous" e exige testes unitários completos — https://yeoman.io/authoring/file-system.html — 2026-11-18 |
| **C — regeneração determinística de arquivo "owned" (estilo lockfile)** | Reescreveria a seção editada no `update` (contradiz 14a) e transformaria edição legítima em `doctor` FAIL (contradiz 14c). Vale apenas como analogia de *ledger* — já implementada em `writeManifest`. | `Cargo.lock` é mantido pelo Cargo e não deve ser editado manualmente; `cargo update` reescreve — https://doc.rust-lang.org/cargo/guide/cargo-toml-vs-cargo-lock.html — 2026-11-18; `.terraform.lock.hcl` é criado/atualizado por `terraform init` e verifica checksum, com erro em divergência — https://developer.hashicorp.com/terraform/language/files/dependency-lock — 2026-11-18 |
| **D sozinha — resolver stack e parar** (ou adotar "Other" como Vercel) | Não gera artefato algum. Além disso, "Other" é comportamento da fonte, **não** a decisão do owner: aqui a recusa com pedido de flag é 14b. D entra como política de resolução dentro do híbrido, não como substituto. | Linguist aplica override explícito antes das heurísticas — https://github.com/github-linguist/linguist/blob/main/docs/how-linguist-works.md — 2026-11-18; Vercel detecta framework/preset, seleciona "Other" quando não detecta e habilita override em `vercel.json` — https://vercel.com/docs/builds/configure-a-build — 2026-11-18; Vercel detecta até gerenciador por lockfile — https://vercel.com/docs/fundamentals/builds — 2026-11-18 |

## depende-de

— Nenhuma ADR anterior deste PRD. Pressupõe o PRD aprovado (§16) e o `RESEARCH.md` entregue, ambos em disco. Precedente **estrutural, não dependência**: o formato de ADR com `depende-de`, interface numerada e `1 ADR = 1 branch = 1 PR` vem de `.spec/prd/prd-adr-pipeline/ADRs/ADR-004-adr-como-unidade/ADR.md`. Nenhuma rubrica anterior é reaberta aqui.

## Interface congelada

Contrato consumível por outros ADRs e pelo implementador. Itens marcados *(hoje)* descrevem código existente; *(SDD)* só valem como comportamento após a implementação. Nível de garantia explícito por item. Nenhum item pode ser emendado por prosa de implementação — mudança exige nova decisão.

**I1 — Classes de path (conjunto fechado).** *(SDD)* Todo path gerado pertence a exatamente uma classe:

- **PRÓPRIA** (`owned`): `.agents/rules/project-frontend.md`, `.agents/rules/project-backend.md`, `.agents/rules/project-fullstack.md` e `tokens/*.json` no alvo. Conteúdo integralmente gerado; sha256 no manifesto; mapeamento de stack em I5.
- **ANEXADA** (`attached`): `AGENTS.md` e `DESIGN.md` na raiz do alvo. Conteúdo do consumidor; única mutação = bloco de I2; `inManifest: false` sempre, mesmo quando o arquivo é criado pelo `init`.

Nenhum outro path é escrito por esta decisão. Configs de stack do consumidor (`package.json`, `pom.xml`, `Cargo.toml`, eslint, tsconfig) são **somente leitura** (PRD §7). 🟢 contrato.

**I2 — Gramática do marcador (bytes literais, case-sensitive, sem folga).** *(SDD)*

```
OPEN  = "<!-- harness:v2:start -->"
CLOSE = "<!-- harness:v2:end -->"
BLOCO = OPEN + LF + BODY + LF + CLOSE
BODY  = sequência UTF-8 que NÃO contém linha igual a OPEN nem a CLOSE
```

1. Por arquivo anexado: **exatamente 1 `OPEN` e 1 `CLOSE`**, `OPEN` antes de `CLOSE`, sem aninhamento. Contagem por linha exata; variantes como `<!--harness:v2:start-->`, maiúsculas ou espaços extras **não são reconhecidas**.
2. `BLOCO` é anexado ao **final** do arquivo. Prefixo = bytes desde o início até `OPEN`, intocados byte a byte. Se o arquivo original não termina em `LF`, inserir `LF` antes de `OPEN`; nenhum outro byte é normalizado, reordenado ou reencodado.
3. Um marcador simples legado `<!-- harness:v2 -->` **não é reconhecido** como delimitador; permanece no prefixo como conteúdo do consumidor, sem migração e sem erro.
4. `0` pares ⇒ anexar; `1` par ⇒ comparar `BODY` ao template (I3); `≠1` par, `CLOSE` antes de `OPEN` ou linha `OPEN`/`CLOSE` dentro de `BODY` ⇒ estado `malformed` (I3), nenhuma escrita naquele path.

🟢 contrato · 🟡 execução no SDD (teste de contagem e de sha256 do prefixo).

**I3 — Máquina de estados por path (enum fechado).** *(SDD)* Estado ∈ `created | appended | preserved | skip | divergent | malformed`.

| Classe | Situação no alvo | Estado | Escrita |
|---|---|---|---|
| PRÓPRIA | path ausente | `created` | sim, via `writeGuarded` |
| PRÓPRIA | path presente, bytes == template | `skip` | nenhuma |
| PRÓPRIA | path presente, bytes != template | `preserved` | nenhuma (maintainer é dono) |
| ANEXADA | arquivo ausente | `created` | sim, arquivo só com `BLOCO`, `inManifest: false` |
| ANEXADA | arquivo presente, 0 par | `appended` | sim, append de `BLOCO` ao final |
| ANEXADA | 1 par, `BODY` == template | `skip` | nenhuma |
| ANEXADA | 1 par, `BODY` != template | `divergent` | **nenhuma** — preservar e reportar (14a) |
| ANEXADA | contagem/ordem inválida | `malformed` | **nenhuma** — recusa fail-closed |

`preserved` e `divergent` nunca viram `update`. Reexecução imediata após `created`/`appended` produz `skip` nos mesmos paths (MS-3). 🟢 contrato · 🟡 SDD.

**I4 — G3 e manifesto.** *(hoje)* `isPreserved` (`scripts/harness-sync.mjs:161-166`) e `PRESERVED_RES` (`:159`) continuam proibindo escrita sobre `project-*.md` **existente**; a proteção é contra sobrescrita, não contra criação. *(SDD)* A exceção é uma **allowlist explícita dos paths PRÓPRIOS ausentes no plano** — nunca relaxamento do regex global. `manifestFiles` (`:615-627`) inclui PRÓPRIOS (`sha256` do conteúdo) e exclui ANEXADOS (`inManifest: false`, gancho já em `:623`). `runDoctor` (`:907`) recompute cobre payload + PRÓPRIOS; ANEXADOS não entram em veredito de integridade (14c). Manifesto é o último write. 🟢 mecanismo existente · 🟡 extensão no SDD.

**I5 — Resolução de stack e flags (nomes e valores exatos).** *(hoje)* `detectTargets` (`:417-437`) e `buildConfig` (`:452`) existem; flags atuais em `:10-12`/`:1018` não incluem `--frontend`/`--backend`. *(SDD)* Superfície congelada: `--target <dir>` · `--dry-run` · `--suite <cmd>` · `--unit <cmd>` · `--backup-dir <dir>` (inalteradas) **+** `--frontend react|vue` **+** `--backend java|rust|nestjs|node`. Override explícito vence detecção; origem (`detectada|flag`) entra no relatório (I6). Mapeamento para o artefato PRÓPRIO:

| `frontend` | `backend` | artefato |
|---|---|---|
| não-nulo | nulo | `.agents/rules/project-frontend.md` |
| nulo | não-nulo | `.agents/rules/project-backend.md` |
| não-nulo | não-nulo | `.agents/rules/project-fullstack.md` |
| nulo | nulo | **nenhum artefato de stack** |

Caso `nulo|nulo` sem flag: `exit 1`, **zero escrita e zero backup**, com mensagem literal:

```
harness-sync <verb>: stack indeterminada: passe --frontend <react|vue> e/ou --backend <java|rust|nestjs|node>
```

`<verb>` ∈ `init|update|doctor`. Flag inválida (valor fora do enum) ⇒ mesma recusa, com o valor recebido nomeado. Nenhum `project-fullstack.md` é inventado (14b). 🟢 decisão do owner · 🟡 SDD.

**I6 — Formato do relatório (linhas literais; ordem determinística).** *(SDD)* Uma linha por path, paths ordenados por string POSIX; linha de stack primeiro, resumo por último. States de I3.

```
harness-sync <verb>: stack origem=<detectada|flag> frontend=<react|vue|null> backend=<java|rust|nestjs|node|null>
harness-sync <verb>: <path> <state>
WARN divergência <path>: seção gerenciada preservada (não reescrita)
ERROR seção malformada <path>: esperado 1 par start/end; nenhuma escrita
harness-sync <verb>: plano created=<n> appended=<n> preserved=<n> skip=<n> divergent=<n> malformed=<n>
```

Regras: `WARN divergência ` é o prefixo exato do aviso de 14a e **não** altera `exit code`; `ERROR seção malformada ` é o prefixo exato da recusa e **força `exit 1` com zero escrita no alvo**; `<path>` é sempre relativo ao alvo, com `/`. `--dry-run` imprime o **mesmo** conjunto de linhas do apply (MS-6), sem escrever e sem criar backup. 🟢 contrato · 🟡 SDD.

**I7 — Escrita e operabilidade.** *(hoje)* `writeGuarded` (`:527-532`) chama `assertSafeWrite` (`:261`) e `writeAtomic` (`:501`); `defaultBackupDir` (`:594-597`) mantém backup fora do alvo; `buildPlan` (`:557-589`) e `applyPlan` (`:635`) já compartilham o guard do `--dry-run`. *(SDD)* Todo byte novo passa por essa via única; nenhuma segunda função de escrita é introduzida; `commands.suiteFull` continua sendo a contraprova (nunca "só doctor verde", lição `regras/global/installer-nao-valida-operabilidade`). Se `commands.suiteFull` mudar ao estender o clean-room, o selo é recalculado conforme `.agents/rules/harness-config.md` §"Command seal (ADR-002, U6=b)" — objeto de decisão separada, não desta ADR. 🟢 mecanismo existente · 🟡 SDD.

**I8 — Origem dos templates.** *(hoje)* Skill `design-system` presente em `.agents/skills/design-system/SKILL.md`, com `templates/DESIGN.md` e `profiles/{shadcn,claude}/tokens/**`; a regra da skill é "nenhum token inventado" e `tokens/*.json` no destino é a fonte visual. *(SDD)* Templates de `DESIGN.md`/tokens vêm **somente** daquela skill; nenhum hex, fonte, raio ou paleta é inventado no gerador. Escolha de perfil (`shadcn` vs `claude`) fica **fora** desta ADR (§5) — o gerador não a decide por palpite. 🟢 evidência em disco · 🟡 SDD.

**I9 — Verificação de prontidão.** *(hoje)* `node scripts/static-checks.mjs` ⇒ `PASS PRD-01`, `PASS ADR-01` (1:1 índice↔disco) e `PASS ADR-02` (sequência/branch) **não** devem depender de `SPEC.md`/`TASKS.md`; `ADR-01` pode estar `FAIL` neste batch pelo motivo declarado no `ADR-INDEX.md` (`unit: adr` sem SDD gerado). *(SDD)* Os seis cenários de `PRD.md` §10 entram em `scripts/acceptance-clean-room.mjs` (A1..A7) e rodam via `commands.suiteFull`. 🟢 runtime · 🟡 SDD.

## Fora desta decisão

- Conteúdo dos templates de `DESIGN.md`/tokens e escolha de perfil `shadcn`/`claude` — I8 congela apenas a **origem**; o conteúdo é o da skill, não inventado aqui.
- Mudança de `gate.js`, `.agents/rules/**`, payload, selo `HARNESS_SEAL_JSON`, `harness.config.json`, `workflow-state.json`, presets, eixos ou comandos canônicos — aqui só se consome o contrato existente (PRD §7).
- `--prune`/remoção de órfãos, push/PR automático e migração automática de consumidores (PRD §7).
- Escrita em configs de stack do consumidor — leitura para detecção, nunca escrita (PRD §7).
- Recálculo de selo e a inclusão dos seis cenários no `commands.suiteFull` — decididos quando o comando mudar; esta ADR só congela que a contraprova é a auto-suite do destino (I7/I9).
- Detecção em monorepo com múltiplos manifests — `RESEARCH.md` §6 a registra como premissa não validada; `--frontend`/`--backend` cobre o caso, mas nenhum comportamento padrão novo é decidido aqui.
- `SPEC.md`/`TASKS.md` e a implementação — unidade entregue pelo `sdd-compiler` e pelo implementador, não por esta decisão.

## Consequências se estiver errado

- **R1 — gramática insuficiente.** Se usuário editar/duplicar marcadores, `malformed` recusa com `exit 1` e zero escrita. Custo: operador precisa intervir. Reversibilidade: restaurar o par canônico; nenhum byte do prefixo foi tocado. 🟠 risco aberto até o SDD.
- **R2 — falso positivo de divergência.** Mudança legítima do template no payload fará todo `update` emitir `WARN divergência`. É o comportamento desejado por 14a (preservar), mas gera ruído; a correção é decisão humana, nunca auto-repair. 🟢 comportamento congelado · 🟡 ruído operacional.
- **R3 — G3 enfraquecida por implementação ingênua.** Relaxar `PRESERVED_RES` globalmente permitiria sobrescrever `project-*.md` do maintainer. Mitigação congelada em I4: allowlist de paths ausentes no plano. Se violado, `doctor` e o clean-room (cenário de `project-backend.md` preservado) pegam. 🟢 contrato · 🟡 execução.
- **R4 — manifesto cobrindo arquivo anexado.** Se `AGENTS.md`/`DESIGN.md` entrassem com sha256 integral, qualquer edição legítima viraria `doctor` FAIL — exatamente 14c. Mitigação: `inManifest: false`. Reversibilidade: exclusion é um campo, sem mecanismo de hash parcial. 🟢 decisão do owner.
- **R5 — recusa por stack em alvo válido.** Se `detectTargets` não enxergar stack em projeto real, `init` exige flag (14b). Custo: uma flag a mais; benefício: nenhuma identidade inventada. Reversibilidade: passar `--frontend`/`--backend`. 🟢 decisão do owner.
- **C1 — reversibilidade geral.** Reverter esta decisão significa voltar os paths ANEXADOS ao status `inManifest: false` e remove-los do plano, e desfazer a allowlist de I4; nenhum arquivo do consumidor é apagado no processo. Custo: uma ADR de revogação + ajuste do clean-room. Nenhuma config/gate muda nesta ADR, logo não há selo a desfazer. 🟢 processo.

## Status

`in-progress` — decisão arquitetural fechada e citável; branch `adr/prd-init-project-scaffold/01-managed-section-scaffold` aberta; `ADR-INDEX.md` com 1 linha real; `SPEC.md`/`TASKS.md` a gerar pelo `sdd-compiler`. Promoção a `merged` depende do merge humano do PR, com `unit: adr` exigindo também `VERIFY.md` (`.opencode/plugins/lib/prd-adr-pipeline/checks.mjs:423-425`). Nenhum commit, tag ou push foi criado por esta entrega.
