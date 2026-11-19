# RESEARCH — Init que entrega a identidade do projeto

> **prd-id**: `prd-init-project-scaffold`
> **Natureza**: insumo em Markdown para o ADR do `architect`. **Não decide.** Veredito e desenho final pertencem ao ADR (`.agents/rules/prd-adr-pipeline.md` §1/§16).
> **PRD de entrada**: `.spec/prd/prd-init-project-scaffold/PRD.md` — §16 APROVADO em 2026-11-18 por joao.
> **Data das consultas externas**: 2026-11-18 (todas as URLs abaixo).
> **Protocolo**: `.agents/rules/deepsearch.md` + skill `deepsearch` (hierarquia de fonte; uma afirmação por citação; sem fonte = inferência rotulada).
> **Regra de prosa**: todo mecanismo novo está marcado **REQUISITO a implementar**; nada aqui é apresentado como existente hoje (lição `regras/projetos/atlas-ecm/prosa-regra-nao-promete-mecanismo-ausente`).

---

## 1. Pergunta de pesquisa

Como gerar artefatos de identidade de projeto (`AGENTS.md`, `.agents/rules/project-{stack}.md`, `DESIGN.md`+tokens) de forma **idempotente e não destrutiva**, preservando arquivos editados pelo consumidor e mantendo `doctor`/manifesto íntegros — e como resolver a stack sem inventar identidade?

Critérios explícitos de comparação (aplicados a todas as alternativas):

1. **Custo de implementação** no destino real: script Node `scripts/harness-sync.mjs`, sem dependências novas, zero rede.
2. **Acoplamento** com `writeGuarded`/`assertSafeWrite`, `buildPlan`, `writeManifest`, `runDoctor` e `PRESERVED_RES` atuais.
3. **Testabilidade** no clean-room (`scripts/acceptance-clean-room.mjs`, A1..A7 + seis cenários do PRD §10).
4. **Segurança**: risco de sobrescrever conteúdo do consumidor; symlink guard; backup fora do alvo.
5. **Aderência às decisões do owner (PRD §14)**: (a) `update` preserva seção `<!-- harness:v2 -->` editada e reporta divergência, nunca reescreve; (b) stack indeterminada sem flags ⇒ exigir flag; (c) `AGENTS.md`/`DESIGN.md` anexados ficam **fora** do manifesto.

---

## 2. Estado atual medido (antes de qualquer alternativa)

- `PAYLOAD_FILES = [scripts/harness-sync.mjs, scripts/seal.mjs, opencode.json]` — `scripts/harness-sync.mjs:145-149`. `AGENTS.md`/`DESIGN.md` não são payload.
- `PRESERVED_RES = [/^\.agents\/rules\/project-[^/]*\.md$/]` — `scripts/harness-sync.mjs:159`, `isPreserved` em `:161-166`: G3 proíbe escrever `project-*.md` hoje. Qualquer geração desse path é **mudança de contrato via ADR**, não fato atual.
- `detectTargets` — `scripts/harness-sync.mjs:417-437`: `frontend ∈ {react,vue,null}`, `backend ∈ {java,rust,nestjs,node,null}`; flags atuais só `--target/--dry-run/--suite/--unit/--backup-dir` (`:10-12`, `:1018`); `--frontend`/`--backend` **não existem**.
- `writeGuarded` — `scripts/harness-sync.mjs:527-532`: via única de escrita; chama `assertSafeWrite` (walk com `lstat`, G6) e `writeAtomic` (`wx`+rename, G7). `buildPlan` (`:557-589`) e `applyPlan` (`:635-682`) produzem `create|skip|update` e escrevem o manifesto por último (G7).
- `mergeManaged(source, target)` — `scripts/harness-sync.mjs:390-400`: já existe para `opencode.json` (G4, `:32-33`, `:566-582`); é merge **por chave de JSON**, não por marcador textual em Markdown. Reaproveitar o nome para outro mecanismo seria enganoso.
- `manifestFiles` — `scripts/harness-sync.mjs:615-627`: manifesto é *ledger*; entradas com `inManifest: false` (caso de `harness.config.json`, `:545`, `:550`) ficam fora. É o gancho natural para 14c, **sem mecanismo novo** para exclusão.
- `runDoctor` recomputa sha256 e falha em divergência/ausência/symlink; contrato em `.agents/rules/harness-config.md` §"Sincronizador de payload (v2/F1)".
- Clean-room hoje cobre A1..A7 em `scripts/acceptance-clean-room.mjs:201-430`; nenhum dos seis cenários do PRD §10 existe ainda (REQUISITO).
- Brain consultado: `estudos/projetos/projetos/contas-filtros/hardening-catalogo-completo` (manifesto que cobre todo o catálogo transforma edição legítima em falha até `--update`; reforça 14c) e `regras/projetos/atlas-ecm/prosa-regra-nao-promete-mecanismo-ausente` (origem da distinção estado atual vs REQUISITO).

---

## 3. Alternativas

### Alternativa A — Template + `skip`/`preserve` + manifesto (scaffolding clássico)

Gerar o artefato **só quando ausente**; arquivo existente ⇒ `skip`, sem merge, sem escrita. Artefatos criados entram no manifesto com sha256; o que é project-owned fica fora. É o modelo já adotado pelo `harness-sync.mjs` para payload/config.

Fontes oficiais (fonte primária; consulta 2026-11-18):

- `dotnet new --dry-run` mostra o resumo do que aconteceria; `--force` é **necessário** quando o template sobrescreveria arquivos existentes — https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-new — 2026-11-18.
- Geradores Rails expõem `-p/--pretend` (executa sem mudanças), `-f/--force` (sobrescreve) e `-s/--skip` (pula arquivos existentes) — https://guides.rubyonrails.org/generators.html — 2026-11-18.
- Yeoman submete **toda** escrita sobre arquivo pré-existente a resolução de conflito que exige validação do usuário, e só grava em disco ao final — https://yeoman.io/authoring/file-system.html — 2026-11-18.

Trade-off:

- **Prós**: custo baixíssimo (reusa `buildPlan`/`applyPlan`/`writeGuarded` quase sem código novo); risco de sobrescrita zero por construção; idempotência (2ª rodada = `skip`) já garantida por `buildPlan:584`; `--dry-run` já usa o mesmo plano (MS-6); compatível com `PRESERVED_RES`/G3.
- **Contras**: **não atende MS-2/14c** para `AGENTS.md`/`DESIGN.md` pré-existentes — o PRD exige *anexar* seção demarcada, não pular; se adotada sozinha, o cenário "fixture com AGENTS.md pré-existente ⇒ uma seção `<!-- harness:v2 -->` anexada" falha. Também não resolve 14a por si: `skip` preserva, mas não reporta divergência de conteúdo.
- **Veredito para este PRD**: insuficiente sozinha; adequada aos artefatos **integralmente gerados** (`.agents/rules/project-*.md`, tokens).

### Alternativa B — Mesclagem por marcadores / "managed section" em arquivo que o usuário edita

Anexar uma seção delimitada por `<!-- harness:v2 -->` ao final de `AGENTS.md`/`DESIGN.md`, sem tocar no conteúdo pré-existente; na 2ª rodada detectar a seção e **preservá-la mesmo divergente do template**, reportando divergência (14a); arquivo anexado **fora do manifesto** (14c).

Fontes oficiais (fonte primária; consulta 2026-11-18):

- Rails insere conteúdo em arquivo existente usando um *sentinela* (`inject_into_file "config/routes.rb", routing_code, after: namespace_pattern, verbose: false, force: false`; `environment` usa `sentinel = "class Application < Rails::Application\n"`) —ou seja, âncora textual + `force: false` — https://api.rubyonrails.org/classes/Rails/Generators/Actions.html — 2026-11-18.
- Go define convenção legível por máquina para código gerado: linha que casa `^// Code generated .* DO NOT EDIT\.$` antes do primeiro texto não-comentário — https://go.dev/src/cmd/go/internal/generate/generate.go — 2026-11-18.
- Angular Schematics descreve transformações sobre um **sistema de arquivos virtual** (`Tree` com `base` + `staging area`) aplicadas ao disco real só depois de validadas; a *merge strategy* pode aceitar, ignorar ou lançar exceção — https://angular.dev/tools/cli/schematics-authoring — 2026-11-18.
- Yeoman recomenda editar arquivo existente por AST e alerta que parsear com RegEx é "perilous", exigindo testes unitários completos — https://yeoman.io/authoring/file-system.html — 2026-11-18.

Trade-off:

- **Prós**: única alternativa que satisfaz simultaneamente MS-2, 14a e 14c; preserva bytes do conteúdo do consumidor; o relatório `created|appended|preserved|divergent` sai naturalmente do parser de seção; não exige mudar o contrato do manifesto (basta `inManifest: false`, já existente em `manifestFiles`).
- **Contras**: **exige mecanismo novo (REQUISITO a implementar)**: parser de seção demarcada com ocorrência única, append idempotente, comparação conteúdo-da-seção vs template para reportar divergência sem reescrever, e teste de que o sha256 do prefixo original permanece idêntico. Risco de implementação: marcador duplicado ou editado pelo usuário; mitigação = exigir ocorrência única e tratar divergência como *report*, não *repair* (14a).
- **Veredito para este PRD**: necessária para `AGENTS.md`/`DESIGN.md`; mecanismo novo, portanto cada REQUISITO deve virar ADR explícito, não prosa promete-enabled.

### Alternativa C — Regeneração determinística de arquivo "owned" pelo gerador (estilo lockfile)

Tratar o artefato como propriedade do instalador: arquivo gerado por inteiro, edição manual ⇒ divergência; `doctor`/`--locked` falha ou `update` reescreve.

Fontes oficiais (fonte primária; consulta 2026-11-18):

- `Cargo.lock` é mantido pelo Cargo e **não deve ser editado manualmente**; `cargo update` reescreve o arquivo — https://doc.rust-lang.org/cargo/guide/cargo-toml-vs-cargo-lock.html — 2026-11-18.
- `.terraform.lock.hcl` é criado/atualizado automaticamente por `terraform init` e verifica checksums, retornando erro se nada casar (*trust on first use*) — https://developer.hashicorp.com/terraform/language/files/dependency-lock — 2026-11-18.

Trade-off:

- **Prós**: integridade mais forte e implementação mais simples que B (sem parser de seção); ótimo para artefatos que o instalador de fato possui.
- **Contras**: **contradiz 14a e 14c** — reescreveria seção editada no `update` e transformaria edição legítima do operador em `doctor` FAIL. É exatamente o modo que o PRD §7/§8 exclui. Também não tem como anexar a seção sem apagar conteúdo pré-existente.
- **Veredito para este PRD**: **rejeitada** para `AGENTS.md`/`DESIGN.md`; serve apenas como analogia de *ledger* para o manifesto, já implementado em `writeManifest`.

### Alternativa D — Resolução de stack: heurística + override explícito (sem inventar identidade)

Reaproveitar `detectTargets`; flags explícitas sobrepõem a varredura; sem sinal e sem flag ⇒ **falhar/exigir flag**, nunca gerar `project-fullstack.md` por chute (14b). Origem da decisão (`detectada|flag`) entra no relatório.

Fontes oficiais (fonte primária; consulta 2026-11-18):

- Linguist aplica **override explícito antes das heurísticas** e só então tenta modeline, nome de arquivo, shebang, extensão, XML header, heurística e classificação Bayesiana — https://github.com/github-linguist/linguist/blob/main/docs/how-linguist-works.md — 2026-11-18.
- Vercel inspeciona package files, config e estrutura de diretórios para detectar framework e aplica um preset; quando **nenhum framework é detectado, seleciona "Other"** e habilita override manual; o preset também pode ser sobrescrito via `framework` em `vercel.json` — https://vercel.com/docs/builds/configure-a-build — 2026-11-18.
- Vercel detecta até gerenciador de pacotes por lockfile (`pnpm-lock.yaml`), porque detects a partir de artefatos presentes no repo — https://vercel.com/docs/fundamentals/builds — 2026-11-18.

Trade-off:

- **Prós**: zero dependência nova; alinha 14b diretamente; a detecção por varredura já existe em `detectTargets`, e a sobreposição por flag segue o padrão de "override explícito vence heurística" das fontes.
- **Contras**: `--frontend`/`--backend` são **REQUISITO a implementar** (não existem hoje); superfície do `/harness-init` precisa continuar ≤40 linhas (PRD §11); detecção heurística pode errar em monorepos — inferência (sem fonte específica para monorepos nestas consultas); verificar em `detectTargets` com fixture de monorepo antes de ampliar.
- **Veredito para este PRD**: adotar como política de resolução; "exigir flag" é decisão do owner (14b), não comportamento copiado de Vercel (que usa "Other").

---

## 4. Tabela de trade-off

| Alternativa | Complexidade (no destino) | Risco de sobrescrever | Compatível com `update` (14a) | Compatível com manifesto/`doctor` (14c) | Testável no clean-room | Aderência ao stack atual |
|---|---|---|---|---|---|---|
| **A** — template + `skip` + manifesto | Baixa: reusa `buildPlan`/`applyPlan`/`writeGuarded` | Zero (`skip`) | Parcial: preserva, mas não reporta divergência | Sim (já há `inManifest: false`) | Sim para `created`/`skip`; **não** cobre MS-2 | Total (`PRESERVED_RES`/G3) |
| **B** — managed section por marcador | Média/Alta: parser + append + relatório de divergência (**REQUISITO**) | Zero no prefixo; risco controlado na seção | **Sim** (preserva + reporta) | **Sim**, se anexados ficarem fora do manifesto | Sim: sha256 do original + ocorrência única | Reusa `writeGuarded`; `manifestFiles` já suporta exclusão |
| **C** — regeneração owned/lockfile | Baixa | **Alta** (reescreve seção editada) | **Não** (contradiz 14a) | **Não** (edição legítima ⇒ FAIL, contradiz 14c) | Sim, mas para o comportamento proibido | Reusa `writeGuarded` |
| **D** — heurística + flag (resolução de stack) | Baixa/Média: 2 flags novas (**REQUISITO**) | N/A (não escreve) | Sim | Sim | Sim: `--dry-run` mostra origem `detectada|flag` | Reaproveita `detectTargets` |

Legenda: "Sim/Não" = compatibilidade com a decisão do owner, não juízo de valor genérico.

---

## 5. Recomendação (una, insumo ao ADR)

**Recomendar o híbrido A+B com D**: gerar `.agents/rules/project-{stack}.md` e tokens pelo modo A (`create` se ausente, `preserved`/`skip` se existir, via `writeGuarded`), anexar a seção `<!-- harness:v2 -->` a `AGENTS.md`/`DESIGN.md` pelo modo B (fora do manifesto, `update` preserva e reporta divergência) e resolver a stack por `detectTargets` + `--frontend`/`--backend`, exigindo flag quando não houver sinal.

Desdobramento em insumos para o architect (cada item é **REQUISITO a implementar**, não estado atual):

1. **Novos paths gerados integralmente** (`.agents/rules/project-*.md`, tokens): entrar no plano `buildPlan` com `create|skip`, sha256 no manifesto e última escrita pelo manifesto — exige mudar o contrato G3/`PRESERVED_RES` **via ADR**; hoje `isPreserved` proíbe a escrita (`scripts/harness-sync.mjs:159-166`).
2. **Anexo demarcado** em `AGENTS.md`/`DESIGN.md`: seção `<!-- harness:v2 -->` com ocorrência única; conteúdo pré-existente intocado (MS-2); `update` **preserva** a seção divergente e reporta `divergent` (14a); `inManifest: false` para esses paths (14c), reaproveitando `manifestFiles` sem mecanismo de hash parcial.
3. **Resolução de stack**: `--frontend`/`--backend` sobrepõem `detectTargets`; sem sinal e sem flag ⇒ recusa com mensagem, sem `project-fullstack.md` (14b); origem no relatório; nenhuma config de stack do consumidor é escrita (PRD §7).
4. **Escrita/integridade**: todo byte novo passa por `writeGuarded` e pelo mesmo guard de `--dry-run`; backup fora do alvo; manifesto permanece o último write; `doctor` recompute continua cobrindo payload + artefatos gerados por inteiro, não os anexados.
5. **Aceite**: estender `scripts/acceptance-clean-room.mjs` com os seis cenários do PRD §10 dentro de `commands.suiteFull`; se o comando mudar, recalcular o selo conforme `.agents/rules/harness-config.md` §"Command seal (ADR-002, U6=b)" — contraprova é a auto-suite do destino, não "só doctor verde" (lição `regras/global/installer-nao-valida-operabilidade`).
6. **Limite de ADRs**: itens 1–3 são candidatos naturais a ADRs separados; teto de 5 por PRD (`.agents/rules/prd-adr-pipeline.md` §3). O `architect` decide o recorte.

**Por que não as outras**: A sozinha não entrega MS-2; C viola 14a/14c; D sozinha não gera artefato. A+B+D cobre os seis cenários sem inventar mecanismo de hash parcial nem prometer feature ausente.

---

## 6. Riscos, premissas não validadas e pontos para decisão

- **Risco — seção editada vs template**: parser deve distinguir "seção ausente" (anexar) de "seção divergente" (preservar + reportar). Não validado ainda qual delimitador exato (`<!-- harness:v2 -->` sozinho ou par open/close); o PRD nomeia apenas o marcador. **Pergunta ao architect**: fixar gramática do delimitador no ADR.
- **Risco — manifesto sobre arquivo anexado**: se `AGENTS.md`/`DESIGN.md` entrarem com sha256 do arquivo todo, edição legítima ⇒ `doctor` FAIL; 14c já decidiu "fora". **Não reabrir decisão**; apenas implementar `inManifest: false`.
- **Risco — G3**: `isPreserved` hoje protege `project-*.md`; gerá-los exige excluir apenas os paths recém-criados da regra de preservação, sem liberar escrita sobre arquivos já escritos pelo maintainer. **Pergunta ao architect**: como expressar isso sem enfraquecer G3.
- **Premissa não validada**: templates do skill `design-system` existem e são estáveis o bastante para gerar `DESIGN.md`+tokens; não auditei o conteúdo do skill nesta pesquisa — verificar antes do ADR.
- **Premissa não validada**: detecção em monorepo (múltiplos `package.json`) — `--frontend`/`--backend` cobre o caso, mas o comportamento padrão não foi medido.
- **Selo/contraprova**: se `commands.suiteFull` mudar ao estender o clean-room, RF-08 exige recalcular `HARNESS_SEAL_JSON`; não decidido aqui.
- **Bloqueio para HITL**: **nenhum**. Todas as decisões do owner estão em PRD §14/§16; os pontos acima são de desenho, reservados ao `architect` no ADR.

---

## 7. Fontes consultadas (URL + data)

Todas consultadas em **2026-11-18** via `websearch` (descoberta) + `webfetch` (leitura da íntegra, quando aplicável). Uma afirmação por citação.

1. `dotnet new --dry-run` mostra resumo; `--force` é necessário para sobrescrever arquivos existentes — https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-new — 2026-11-18.
2. Rails: `-p/--pretend`, `-f/--force`, `-s/--skip` — https://guides.rubyonrails.org/generators.html — 2026-11-18.
3. Rails: `inject_into_file` com sentinela `after:` e `force: false` em `config/routes.rb`/`config/application.rb` — https://api.rubyonrails.org/classes/Rails/Generators/Actions.html — 2026-11-18.
4. Yeoman: escrita sobre arquivo pré-existente passa por resolução de conflito; escrita em memória, commit único ao final — https://yeoman.io/authoring/file-system.html — 2026-11-18.
5. Angular Schematics: `Tree` com base + staging, aplicado ao disco só após validação; merge strategy aceita/ignora/lança — https://angular.dev/tools/cli/schematics-authoring — 2026-11-18.
6. Go: convenção `^// Code generated .* DO NOT EDIT\.$` antes do primeiro texto não-comentário — https://go.dev/src/cmd/go/internal/generate/generate.go — 2026-11-18.
7. Cargo: `Cargo.lock` mantido pelo Cargo, não editar manualmente; `cargo update` reescreve — https://doc.rust-lang.org/cargo/guide/cargo-toml-vs-cargo-lock.html — 2026-11-18.
8. Terraform: `.terraform.lock.hcl` criado/atualizado por `terraform init`; verificação de checksum com erro em divergência — https://developer.hashicorp.com/terraform/language/files/dependency-lock — 2026-11-18.
9. Linguist: override explícito vem antes das heurísticas; ordem das estratégias de detecção — https://github.com/github-linguist/linguist/blob/main/docs/how-linguist-works.md — 2026-11-18.
10. Vercel: detecção de framework + preset; sem detecção seleciona "Other" e habilita override; `framework` em `vercel.json` — https://vercel.com/docs/builds/configure-a-build — 2026-11-18.
11. Vercel: inspeção de package files/config/diretórios e detecção de gerenciador por lockfile — https://vercel.com/docs/fundamentals/builds — 2026-11-18.

**Inferências rotuladas** (sem fonte consultada; verificar antes do ADR): monorepo com múltiplos manifests; gramática exata do delimitador `<!-- harness:v2 -->`; estabilidade dos templates do skill `design-system`. Não apresentar como fato.

---

## 8. Delimitação

Este arquivo é apenas insumo. Não escrevi `ADR.md`, `SPEC.md`, `TASKS.md`, `PRD.md`, código nem alterei `workflow-state.json`. Nenhuma recomendação aqui substitui o veredito do `architect` no ADR.
