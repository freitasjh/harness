# harness-installer — instalar a governança Harness v7 em outro repo

> Você NÃO precisa ler o SPEC. Este documento é auto-suficiente: siga o
> quickstart e pronto. (Detalhe de desenho vive em
> `.spec/governance/harness-installer/SPEC.md`, só se quiser o porquê.)

## 1. O que o instalador faz

Copia as camadas do harness (`.agents/`, `.opencode/plugins/`, skill) para o
repo de destino, **gera** o `harness.config.json` a partir de respostas suas
(nunca copia config de outro projeto), e valida tudo com checks. Ordem fixa:

```
inventário → backup → Q&A → geração → merge → manifesto → checks
```

Nada é escrito antes do backup existir e verificado (falha no backup = aborta).

## 2. Pré-requisitos

- Node >= 20 no destino. Verifique: `node --version`.
- Rode como seu usuário. Como root, só com `--allow-root` explícito.
- Nunca use `pkill -f` para nada neste fluxo.

## 3. Quickstart

```sh
# 1. Só relata o plano, não escreve nada (comece sempre por aqui):
node installer/install.mjs --target /caminho/do/destino --dry-run

# 2. Execução real (interativa, confirma por camada):
node installer/install.mjs --target /caminho/do/destino

# 3. Não-interativo (CI/agente sem tty):
node installer/install.mjs --target /caminho/do/destino --answers-file respostas.json --yes
```

Flags reais: `--target <dir>` (obrigatório), `--dry-run` (zero writes —
nem backup cria; só imprime plano + relatório), `--answers-file <json>`
(pula o Q&A; chaves = `project`, `stack`, `suiteCommand`, `pluginsDir`,
`deployToken` opcional), `--yes`/`-y` (aprova todas as camadas sem
perguntar), `--backup-dir <dir>`, `--allow-root`, `--help`.

Sem `--answers-file`, o Q&A pergunta no stdin (interativo ou pipado:
`printf ... | node installer/install.mjs --target X`). Com stdin fechado
(`< /dev/null`, sem tty e sem pipe) o CLI **aborta com instrução e sem
escrever nada** — nunca trava esperando tecla.

Antes de aplicar, o CLI imprime o plano (`create`/`merge`/`flag` por path)
e pede confirmação **por camada** (RF-10); `--yes` aprova tudo de uma vez.
`--dry-run` dispensa a confirmação (nada será aplicado).

Via API (para agentes):

```js
import { main } from './installer/install.mjs';
const out = main({
  target: '/caminho/do/destino',
  scriptedAnswers: {
    project: 'nome-do-projeto',          // obrigatório, não-vazio
    stack: 'node',                       // node | java+vue | outra
    suiteCommand: 'node --test',         // precisa resolver (PATH ou arquivo)
    pluginsDir: '/caminho/do/destino',   // precisa existir dentro do target
    // deployToken: '...'                // sensível: só memória, nunca em disco
  },
  incomingFiles: {
    'opencode.json': JSON.stringify({ plugin: ['harness'], instructions: ['...'] }),
    '.agents/rules/exemplo.md': '# regra\n',
  },
  options: { allowRoot: false, dryRun: false },
});
console.log(out.checks); // { passed: true, failed: [] } = instalado OK
```

## 4. Q&A — o que responder

| Pergunta (`key`) | Validação | Segredo? |
|---|---|---|
| `project` | não-vazio | não |
| `stack` | `node` \| `java+vue` \| `outra` \| `node-esm` \| `flutter` \| `dart` | não |
| `suiteCommand` | precisa resolver via `PATH` ou existir como arquivo | não |
| `pluginsDir` | precisa existir **dentro** do `--target` | não |
| `deployToken` | livre, opcional | **SIM — só memória** |

Resposta inválida = rejeitada, repete a pergunta. Campos sensíveis nunca vão
para manifesto, config ou log (são filtrados na serialização).

`flutter`/`dart` (perfil mobile — §9) exigem `pubspec.yaml` no target e usam o
discriminador `sdk: flutter`: pubspec declara `sdk: flutter` (ou uma dep/plugin
`flutter:`) ⇒ `flutter`; caso contrário ⇒ `dart`. Mismatch (`flutter` sem o
discriminador, ou `dart` com ele) = `BAD_ANSWER` (fail-closed).

## 5. Regras de merge (o que acontece com arquivo que já existe)

| Camada | Existe diferente → |
|---|---|
| `opencode.json` | merge aditivo (`plugin` união, `instructions` append; `permission`/`agent` preservam o destino; conflito real = flag) |
| `.agents/agents/*` | anexa seção `Harness v7` se ausente; senão flag |
| `.agents/rules/*`, `.agents/skills/*`, `.opencode/plugins/*` | **flag** (nunca auto-merge de prosa/código) |
| `harness.config.json` | **sempre gerado** do Q&A (com backup do anterior) |
| `opencode.json` corrompido (JSON inválido) | **aborta**, nunca tenta merge |
| Flag pendente | checks = **FAIL** até humano resolver |

## 6. Backup — retenção e descarte (Y3)

- Onde fica: ao lado do destino, `.harness-backup-<nome>-<data>` (ou o que
  passar em `options.backupRoot`). **Exceção documentada:** o backup vive
  fora do `--target` por desenho — a trava de escrita cobre só arquivos
  instalados/mergeados, nunca o backup.
- O que contém: `opencode.json`, `harness.config.json`, `.agents/`,
  `.opencode/`, manifesto anterior. É arquivo do destino — nunca é enviado a
  lugar algum pelo instalador. Avise o humano onde ficou (`backupDir` no
  manifesto `.harness-install.json`).
- **Retenção:** guarde o backup até (a) todos os `flagged[]` resolvidos **e**
  (b) uma suite verde no destino. Só então pode descartar.
- **Descarte:** `rm -rf <backupDir>` (o path exato está em
  `.harness-install.json` → `backupDir`). Descarte antes disso = sem rede de
  volta; o instalador não apaga backup sozinho.
- **Rollback:** copie de volta os arquivos do `backupDir` para o target e
  apague `.harness-install.json`. O procedimento de rollback acima é completo:
  backup + manifesto bastam, nenhum outro estado existe. Re-instalação com
  manifesto presente aborta com instrução (apague ou siga o caminho de upgrade futuro).

## 7. Checks — como saber que deu certo

`out.checks.passed === true` (ou veredito PASS) significa: JSONs parseiam,
`harness.config.json` existe, nenhum flag pendente, zero **adoção** de stack
alheia nos arquivos instalados (`DENYLIST` publicada em `installer/install.mjs`).
FAIL lista o motivo acionável em `failed[]`.

O scan do canário (**R3**) é por **ESCOPO** (FU-32): a `DENYLIST` é procurada
como **substring** amplo, case-insensitive, mas **só em arquivos de
código/config** (`.js .mjs .cjs .ts .tsx .vue .svelte .java .kt .kts .gradle
.groovy .dart .cs .py .rb .go .rs .php .xml .json .yaml .yml .toml .properties
.lock`, mais `pubspec.yaml`/`package.json`/`pom.xml`/`build.gradle`). Prosa
(`.md`, `.txt`) e binários **nunca** são escaneados; `scripts/` e `__tests__/`
(tooling/testes do próprio harness) também ficam fora do scan.

Por isso rules/skills do harness, que citam Vuetify/Lombok/... para bani-los,
instalam em destino limpo **sem falso-positivo** — e a **adoção real** em
código reprova: `require('vuetify/lib')`, `new Vuetify()`, `Vue.use(Vuetify)`,
dependência em `package.json`, coordenada Maven/Gradle `grupo:artifact[:versão]`,
`<artifactId>lombok</artifactId>`, etc.

## 8. Dogfood / teste em cópia (nunca no repo real)

```sh
node installer/dogfood.mjs --source /caminho/do/repo-real
```

- Copia a origem para `/tmp/harness-dogfood-<data>` (origem só leitura).
- Alvo fora de `/tmp` sem `--target` explícito + confirmação = **aborta**.
- Ao final, a cópia é removida; a evidência fica em
  `.spec/governance/harness-installer/harness/<data>.json`.

Para um projeto **mobile (Flutter/Dart)**, use `installer/dogfood-mobile.mjs` —
ver §9.4.

## 9. Perfil mobile (Flutter/Dart)

O instalador instala em projetos mobile pela via normal (`--target` + Q&A ou
wizard). Este perfil foi desenhado para um repo Flutter/Dart com opencode.

### 9.1 Stacks e o que o perfil gera

`STACK_PROFILES` é a única fonte das capacidades por stack (registry puro,
zero I/O); `generateConfig` resolve por lookup. O `harness.config.json` gerado
para mobile fica assim:

| Campo | `flutter` | `dart` |
|---|---|---|
| `stack.backend` / `frontend` | `flutter/dart mobile (Q&A)` | `dart package (Q&A)` |
| `commands.suiteFull` / `unit` | `flutter test` (default; sobrescrevível no Q&A) | `dart test` |
| `commands.analyze` | `dart analyze` | `dart analyze` |
| `mcp.required` | `['marionette_mcp', 'dart']` | `['dart']` |
| `moduleMap` | `+{lib: 'lib', test: 'test'}` | `+{lib: 'lib', test: 'test'}` |

O `mcp.required` é **declarativo** (nomeia os servers, não os define). O merge
do bloco `mcp` no `opencode.json` do destino é **aditivo** (only-add): host sem
`mcp` adota o do harness; host com `mcp` preserva o server existente, une
`required` e divergência real vira **flag** (nunca remove server).

### 9.2 Wizard W0..W7 (RF-15)

Sem `--answers-file` e com TTY, o CLI entra no wizard (camada de apresentação;
nunca escreve nem gera config sozinho — a aplicação é delegada ao `main`):

```
W0 pre-flight → W1 inventário → W2 detecção pubspec → (W2m menu se sem pubspec)
→ W3 Q&A guiado → W4 resumo+prévia → W5 confirmação por camada → W6 backup+aplicação
→ W7 manifesto+checks
```

- **W2 detecção** (`detect()`, line-based, sem parser YAML): lê `pubspec.yaml`,
  sugere `project`←`name`, `stack`←`sdk: flutter`/deps e `suiteCommand`←
  `flutter test`→`make test`→`dart test` (1ª que resolve). A origem é exibida
  como `(arquivo:linha)`. Sem `pubspec.yaml` ⇒ **W2m** menu manual
  (`1` flutter · `2` dart · `3` node · `4` outra).
- **W3** valida cada resposta com `validateAnswer`; inválida = erro inline +
  "como corrigir"; `q`/`quit`/`cancel` aborta. Trocou a stack no W3 ⇒ o default
  de `suiteCommand` é recalculado para ela.
- **W4** imprime o resumo das respostas (segredos omitidos) + prévia do plano
  (`printPlan`). **W5** confirma por camada (`--yes` aprova tudo). Abort até o
  W5 = **0 writes**; de W6 em diante o rollback é via `backupDir`.
- `terminal:true` só em TTY real; pipe/redirect/`--answers-file` seguem o
  caminho v1 (`terminal:false`).

### 9.3 Vendor de skills filtrado por stack

`.agents/skills/.vendor-lock.json` (procedência: source + commit + `treeHash` +
`stacks`) é gerado pelo script **source-side** `scripts/vendor-skills.mjs`
(único ponto com rede; `node scripts/vendor-skills.mjs --check` recomputa o
`treeHash` e falha em drift). `install.mjs` é **rede-zero** (I8, check estático
V15).

No install, `collectIncoming(sourceDir, {stacks})` filtra: skill com `stacks`
entra só se intersecta os stacks pedidos (`flutter` aceita `['flutter','dart']`);
skill sem `stacks` (comum) sempre entra; **sem lock ⇒ nada filtrado**
(retrocompat). O `.vendor-lock.json` **nunca** é copiado ao destino.

### 9.4 Dogfood mobile (cópia Flutter sob /tmp)

```sh
node installer/dogfood-mobile.mjs --source /caminho/do/projeto-flutter
```

- Copia a origem para `/tmp/harness-dogfood-mobile-<data>` (origem **só
  leitura**; a trava `assertDogfoodTarget` **aborta** alvo fora de `/tmp`).
- Sanitiza as camadas que o harness possui na cópia (`.agents`, `.opencode`,
  `opencode.json`, `harness.config.json`, `.harness-install.json`) para simular
  um projeto Flutter **limpo** — a lista removida fica em `sanitized` na
  evidência.
- Dirige o **CLI real** (`runCli`, wizard W0..W7 por stdin TTY-simulado),
  valida o `harness.config.json` mobile (`assertMobileConfig`) + `checks.passed`,
  prova que re-instalação **aborta** e que a origem ficou intocada.
- Grava evidência no schema `harness-report` em
  `.spec/governance/harness-installer-mobile/harness/<data>.json` e remove a
  cópia + backup ao final (salvo `--keep`).

Flags: `--source <dir>` (obrigatório), `--keep`, `--evidence-dir <dir>`,
`--suite-command <cmd>` (default: detectado), `--brain-store <path,...>`.

