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
```

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
| `stack` | `node` \| `java+vue` \| `outra` | não |
| `suiteCommand` | precisa resolver via `PATH` ou existir como arquivo | não |
| `pluginsDir` | precisa existir **dentro** do `--target` | não |
| `deployToken` | livre, opcional | **SIM — só memória** |

Resposta inválida = rejeitada, repete a pergunta. Campos sensíveis nunca vão
para manifesto, config ou log (são filtrados na serialização).

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
`harness.config.json` existe, nenhum flag pendente, zero literais de stack
alheia nos arquivos instalados (`taskflow`, `vuetify`, `primevue`, `lombok`,
`mapstruct`, `restassured`). FAIL lista o motivo acionável em `failed[]`.

## 8. Dogfood / teste em cópia (nunca no repo real)

```sh
node installer/dogfood.mjs --source /caminho/do/repo-real
```

- Copia a origem para `/tmp/harness-dogfood-<data>` (origem só leitura).
- Alvo fora de `/tmp` sem `--target` explícito + confirmação = **aborta**.
- Ao final, a cópia é removida; a evidência fica em
  `.spec/governance/harness-installer/harness/<data>.json`.
