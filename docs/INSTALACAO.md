# INSTALAÇÃO — Harness v7

Instalação e configuração do harness em outro repositório (destino).
Todo passo tem comando copiável + saída esperada + verificação binária.
Passo sem verificação binária conta como defeito — não avance sem o ✅.

> Escopo: `installer/install.mjs` via CLI (`init` greenfield, `doctor` brownfield).
> Não cobre código do installer nem instalação em medflow
> (medflow aparece só como exemplo diagnóstico QUEBRADO, §6).

---

## 0. Pré-requisitos

| # | Requisito | Comando | Saída esperada | Verificação binária |
|---|-----------|---------|----------------|---------------------|
| P1 | Node ≥ 20 no destino | `node --version` | `v20.x.x` ou maior (ex: `v26.7.0`) | ✅ major ≥ 20, senão `NODE_MIN` aborta — origem: `installer/install.mjs:15,62-68` |
| P2 | Target existe e é diretório | `ls -d "<target>"` | lista o diretório sem erro | ✅ `preflight` resolve absoluto — origem: `installer/install.mjs:51-60` |
| P3 | Não rodar como root sem flag | `id -u` | saída ≠ `0`, ou use `--allow-root` | ✅ uid 0 sem `--allow-root` ⇒ `UID_ROOT` — origem: `installer/install.mjs:69-72` |
| P4 | Flutter/Dart: `pubspec.yaml` no target | `ls "<target>/pubspec.yaml"` | arquivo listado | ✅ sem ele, `stack: flutter\|dart` ⇒ `BAD_ANSWER` — origem: `installer/install.mjs:299-317` |
| P5 | `suiteCommand` resolve | `command -v "<suiteCommand>"` ou `ls "<caminho-absoluto>"` | path impresso | ✅ senão `BAD_ANSWER command does not resolve` — origem: `installer/install.mjs:264-272,326-328` |
| P6 | `pluginsDir` existe **dentro** do target | `ls -d "<target>/<pluginsDir>"` | diretório listado | ✅ fora do target ⇒ `OUTSIDE_TARGET` — origem: `installer/install.mjs:320-325,42-49` |

Flags reais (únicas — nunca invente outra; origem: `installer/install.mjs:1099-1121`):

```
--target <dir> | --allow-root | --dry-run | --answers-file <json>
--yes / -y | --backup-dir <dir> | --help / -h
+ posicional: init | doctor (um por invocação)
```

Ajuda:

```sh
node installer/install.mjs --help
```

Saída esperada (origem: `installer/install.mjs:1653-1661`):

```
uso: node installer/install.mjs init   --target <dir> [--dry-run] [--answers-file <json>] [--yes] [--backup-dir <dir>] [--allow-root]
uso: node installer/install.mjs doctor --target <dir> [--answers-file <json>] [--backup-dir <dir>] [--allow-root]
```

Verificação: ✅ exit `0`.

---

## 1. `init` greenfield — create-only (W0–W7)

Cria do zero em destino **limpo**. Qualquer `merge|flag` no plano aborta
e manda rodar `doctor` (gate create-only — origem: `installer/install.mjs:532-541,1583-1600`).
Nunca use `init` em destino com conteúdo harness divergente — use `doctor` (§2).

### 1.1 Dry-run primeiro (obrigatório)

```sh
node installer/install.mjs init --target /tmp/meu-destino --dry-run --answers-file respostas.json
```

`respostas.json` (chaves = Q&A real — origem: `installer/install.mjs:192-198`):

```json
{
  "project": "meu-projeto",
  "stack": "node",
  "suiteCommand": "node --test",
  "pluginsDir": "/tmp/meu-destino"
}
```

Valores de `stack` (únicos — origem: `installer/install.mjs:262`):

```
node | node-esm | java+vue | outra | flutter | dart
```

(`flutter`/`dart` exigem `pubspec.yaml` no target + discriminador `sdk: flutter` —
origem: `installer/install.mjs:286-317`. Sem `pubspec.yaml`, o wizard interativo
abre o menu W2m de 5 itens produto→stack — origem: `installer/install.mjs:1360-1366,1507-1519`.)

Saída esperada:

```
[OK] W0 pre-flight: target=/tmp/meu-destino node=v26.7.0
[OK] W0: pico-fim
[INFO] W1 inventario do destino:
  [AVISO] opencode.json ausente
  ...
[INFO] W4 previa do plano (init create-only):
plano de instalacao:
  create  opencode.json
  create  harness.config.json
  ...
[INFO] W5 dry-run: confirmacao por camada dispensada (nada sera aplicado).
[INFO] dry-run: NÃO EXECUTADO — nenhum write (plano + relatório apenas)
```

Verificação: ✅ exit `0` + linha `dry-run: NÃO EXECUTADO` presente:

```sh
node installer/install.mjs init --target /tmp/meu-destino --dry-run --answers-file respostas.json | grep -c "NÃO EXECUTADO"
# esperado: >= 1
```

Grep de origem: `dryRunNotice` em `installer/install.mjs:912-914`.

> Dry-run nunca cria nem backup (`installer/install.mjs:974-976`) e nunca
> roda checks: `checks = { passed: null, ran: false, skipped: true }`
> (origem: `installer/install.mjs:1001-1003`). `passed: null` = desconhecido,
> nunca leia como PASS.

### 1.2 Execução real

Interativa (pergunta W3 com `[i/total]` + `(q cancela)` — origem: `installer/install.mjs:1530-1566`):

```sh
node installer/install.mjs init --target /tmp/meu-destino
```

Não-interativa (CI/agente):

```sh
node installer/install.mjs init --target /tmp/meu-destino --answers-file respostas.json --yes
```

Saída esperada (sucesso):

```
[OK] W0 pre-flight: target=/tmp/meu-destino node=v26.7.0
[OK] W0: pico-fim
[INFO] W1 inventario do destino:
...
[INFO] W4 previa do plano (init create-only):
plano de instalacao:
  create  ...
resumo: N itens (create=N ...)
[OK] apply: pico-fim
[INFO] W7 manifesto + checks:
  [OK] manifesto: /tmp/meu-destino/.harness-install.json
  [OK] checks: PASS
[OK] checks: pico-fim
[OK] init: pico-fim
```

Verificação: ✅ exit `0` + `init: pico-fim` no log stdout (via tee) + manifesto válido:

```sh
bash -c 'set -o pipefail; node installer/install.mjs init --target /tmp/meu-destino --answers-file respostas.json --yes 2>&1 | tee /tmp/init.log'; echo "exit=$?"
# esperado: exit=0 (falha aqui = interromper, não seguir para o grep)
grep -c "init: pico-fim" /tmp/init.log
# esperado: >= 1 (marcador é log stdout via say() — nunca está no manifesto JSON)
ls /tmp/meu-destino/.harness-install.json && node -e "JSON.parse(require('fs').readFileSync('/tmp/meu-destino/.harness-install.json','utf8')); console.log('manifest-JSON-OK')"
# esperado: manifesto listado + manifest-JSON-OK
node -e "const c=require('/tmp/meu-destino/harness.config.json'); console.log('version='+c.version,'project='+c.project)"
# esperado: version=1 project=meu-projeto
```

Origens: `runInit` em `installer/install.mjs:1670-1774`, W6/W7 via `main`
em `installer/install.mjs:1736-1744`, marcadores pico-fim em
`installer/install.mjs:1741-1742`.

### 1.3 `init` abortado por destino não-limpo (create-only)

Se o destino tem conteúdo divergente, `init` aborta **antes de qualquer write**
(abort até W5 = 0 writes):

```sh
node installer/install.mjs init --target /tmp/destino-sujo --answers-file respostas.json --yes; echo "exit=$?"
```

Saída esperada:

```
[ERRO] init abortado: destino nao esta limpo (create-only)
  porquê: flagged-open: target nao-limpo: N item(ns) merge|flag — rode doctor / limpe o destino (create-only).
  como corrigir: rode doctor --target <dir> para diagnosticar (D0-D6), ou limpe o destino e rode init de novo.
  onde ver: installer/install.mjs (runInit gate create-only; doctor D0-D6)
exit=1
```

Verificação: ✅ exit `1` + bloco 4-linhas com `flagged-open` (origem do formato:
`installer/install.mjs:899-909`). Ação: rode `doctor` (§2), resolva, tente de novo.
Nada foi escrito — confirme: `ls /tmp/destino-sujo/.harness-install.json`
deve falhar (ausente) se nunca instalado.

---

## 2. `doctor` brownfield — read-only (D0–D6)

Diagnostica destino **já existente** sem escrever nada. Zero writes por
construção: `runDoctor` (origem: `installer/install.mjs:744-844`) nunca chama
`writeManifest` (definido em `installer/install.mjs:848-854`, sem chamada no
caminho doctor) e o dispatch só invoca `runDoctor` (origem:
`installer/install.mjs:1799-1808`).
Sem `--fix` (fora de escopo): humano resolve, roda o fluxo de escrita.
`--dry-run`/`--yes` são ignorados (read-only).

```sh
node installer/install.mjs doctor --target /tmp/destino-sujo
```

Variante com respostas (refina D3/D4 sem gravar):

```sh
node installer/install.mjs doctor --target /tmp/destino-sujo --answers-file respostas.json
```

Saída esperada (7 passos D0–D6 — origem: `installer/install.mjs:744-844`):

```
[INFO] D0 pre-flight (somente leitura): verifica destino sem criar nada.
[OK] D0 pre-flight: target=/tmp/destino-sujo
[INFO] D1 inventario do destino (somente leitura).
  [OK] D1 opencode.json presente
  [AVISO] D1 harness.config.json ausente
  ...
[INFO] D2 deteccao pubspec (somente leitura, fontes arquivo:linha).
  [AVISO] D2 sem pubspec.yaml — diagnostico segue sem sugestao.
[INFO] D3 plano seco (classifica sem gravar).
[INFO] D3 plano: 133 itens (create=.. merge=.. flag=.. noop=..)
[INFO] D4 checks + scan (somente leitura).
[INFO] D4 checks: FAIL 16 item(ns)
[ERRO] flagged-open: ...
  porquê: flagged-open: ...
  como corrigir: ...
  onde ver: ...
[INFO] D5 manifesto existente (leitura pura, nunca grava).
  [AVISO] D5 sem manifesto: /tmp/destino-sujo/.harness-install.json (destino ainda nao instalado)
[INFO] D6 relatorio por camada + proximos passos.
  [INFO] D6 plano por camada: ...
  [INFO] D6 veredito: QUEBRADO (exit 1)
  [INFO] D6 proximos passos: resolva cada item flag/FAIL acima e rode o fluxo de escrita de novo.
```

Veredítos D6 (origem: `installer/install.mjs:831-843`):

| Veredito | Condição | Exit |
|----------|----------|------|
| `SAUDÁVEL` | zero flag + zero FAIL | `0` |
| `ATENÇÃO` | há `merge` (sem flag/FAIL) | `1` |
| `QUEBRADO` | há `flag` ou FAIL | `1` |

Verificação (read-only = 0 writes). Rode e confira mtime intacto:

```sh
node installer/install.mjs doctor --target /tmp/destino-sujo; echo "exit=$?"
# esperado QUEBRADO/ATENÇÃO: exit=1. SAUDÁVEL: exit=0.
stat -c '%y %n' /tmp/destino-sujo/.harness-install.json 2>/dev/null || echo "sem-manifesto-ok"
# doctor nunca cria manifesto: ausente antes => ausente depois ✅
```

Grep de ordem dos marcadores (D0 antes de D6):

```sh
node installer/install.mjs doctor --target /tmp/destino-sujo 2>&1 | grep -o "\[INFO\] D[0-6]\|OK\] D[0-6]"
# esperado: D0 D1 D2 D3 D4 D5 D6 em ordem
```

---

## 3. Verificação pós-install (obrigatória)

Após `init` com `checks: PASS`, valide os 5 itens. Todos binários.

| # | Item | Comando | Esperado ✅ |
|---|------|---------|-------------|
| V1 | `plugin`/`plugins` **sem** path local do harness | `node -e "const o=require('/tmp/meu-destino/opencode.json'); console.log(o.plugin, o.plugins)"` | **nenhuma** entrada sob `.opencode/plugins/` — o plugin local é **auto-carregado** pelo runtime e a chave é a lista de **pacotes npm** (merge v2-only, `mergeOpencodeJson`) |
| V2 | `harness.config.json` válido | `node -e "const c=require('/tmp/meu-destino/harness.config.json'); console.log(c.version, c.project, JSON.stringify(c.mcp))"` | `version: 1`, `project` = Q&A, `mcp.required` contém `chrome-devtools` (node) ou `marionette_mcp,dart` / `dart` (mobile) — origem: `generateConfig` em `installer/install.mjs:363-403` |
| V3 | Schema do relatório existe | `ls /tmp/meu-destino/.agents/schemas/harness-report.schema.json` | arquivo presente (path declarado no config: `evidence.schema` — origem: `installer/install.mjs:401`) |
| V4 | Manifesto válido | `node -e "const m=require('/tmp/meu-destino/.harness-install.json'); console.log(m.manifestSchemaVersion, m.backupDir, 'checks.passed='+m.checks.passed)"` | `manifestSchemaVersion: 1`, `backupDir` fora do target, `checks.passed=true` — origem: `buildManifest` em `installer/install.mjs:593-619`, `MANIFEST_NAME` em `installer/install.mjs:16` |
| V5 | Checks PASS re-executáveis | `node -e "import('./installer/install.mjs').then(m=>{const r=m.runChecks('/tmp/meu-destino',{manifest:JSON.parse(require('fs').readFileSync('/tmp/meu-destino/.harness-install.json','utf8'))}); console.log('passed='+r.passed); if(!r.passed) console.log(r.failed.map(f=>f.split('\n')[0]).join('\n'))})"` | `passed=true`, `failed=[]` — origem: `runChecks` em `installer/install.mjs:702-741` |

Backup (reter até flags resolvidos + suite verde no destino):

```sh
node -e "console.log(require('/tmp/meu-destino/.harness-install.json').backupDir)"
ls -d "<backupDir-impresso>"
```

Verificação: ✅ `backupDir` existe e é **fora** do target (origem:
`resolveBackupDir` em `installer/install.mjs:144-161`; retenção/descarte em
SKILL §6). Descarte só após checklist §7 todo ✅: `rm -rf <backupDir>`.
Rollback: copiar arquivos de volta do `backupDir` + apagar `.harness-install.json`.

---

## 4. Q&A — referência rápida

| key | Validação | Segredo? |
|-----|-----------|----------|
| `project` | não-vazio | não |
| `stack` | `node\|node-esm\|java+vue\|outra\|flutter\|dart` | não |
| `suiteCommand` | resolve via `PATH` ou arquivo | não |
| `pluginsDir` | existe **dentro** do target | não |
| `deployToken` | livre, opcional | **SIM — só memória** |

Origem: `QUESTIONS` em `installer/install.mjs:192-198`, `validateAnswer` em
`installer/install.mjs:286-334`, `serializeAnswers` (segredo fora do disco/log)
em `installer/install.mjs:350-357`.

> `deployToken` nunca aparece em manifesto, config ou log (redigido como
> `[REDACTED]` — origem: `sanitizeLog` em `installer/install.mjs:876-886`).
> Nunca cole token em issue/log/evidência.

---

## 5. Troubleshooting (fail opaco → causa + ação)

Todo erro sai no bloco 4-linhas (origem: `formatError` em
`installer/install.mjs:899-909`; códigos em `installer/install.mjs:891-897`):

```
[ERRO] <o quê>
  porquê: <CÓDIGO>: <motivo>
  como corrigir: <ação>
  onde ver: <arquivo:linha ou path real>
```

| Código (o quê) | Porquê | Correção | Onde ver |
|----------------|--------|----------|----------|
| `manifest-missing` | checks sem manifesto: `.harness-install.json` não informado/ausente no target | rode a instalação antes dos checks e repita | `installer/install.mjs:709-714` + `<target>/.harness-install.json` |
| `config-missing` | `harness.config.json` ausente no target | gere via instalação (`generateConfig` a partir do Q&A) — nunca copie de outro projeto | `installer/install.mjs:715-720` + `<target>/harness.config.json` |
| `flagged-open` | item `flag` com resolução humana pendente (init create-only abortado, ou doctor QUEBRADO) | resolva cada `flag` manualmente, rode `doctor` de novo (D0–D6), depois o fluxo de escrita | `installer/install.mjs:727-729` (checks) / `794-797` (doctor) / `532-541` (gate) |
| `literal-denied` | canário R3: arquivo de código/config instalado contém literal de stack alheia (`taskflow\|vuetify\|primevue\|lombok\|mapstruct\|restassured` — origem: `DENYLIST` em `installer/install.mjs:632-639`) | remova a dependência/uso da stack alheia no arquivo apontado | `installer/install.mjs:731-739` (scan só código/config — origem: `isScannablePath` em `installer/install.mjs:685-693`; prosa `.md` nunca escaneada) |
| `BAD_ANSWER` | resposta inválida: stack fora da lista, `suiteCommand` sem resolve, `pluginsDir` fora/inexistente, `flutter`/`dart` sem `pubspec.yaml` (ou mismatch `sdk: flutter`), answers-file ilegível/não-objeto | corrija o valor (`howToFix`: stack/suite/plugins — origem: `installer/install.mjs:1440-1448`) e repita | `installer/install.mjs:286-347` + `installer/install.mjs:1123-1137` |
| `BACKUP_FAIL` | backup falhou (inclui `--backup-dir` igual/aninhado ao target) ou verificação I1 reprovou — aborta **antes de qualquer write** | use `--backup-dir` fora do target (não-aninhado) ou deixe o default ao lado do target; repita | `installer/install.mjs:144-161` + `installer/install.mjs:961-966` + `installer/install.mjs:974-977` |
| `REINSTALL` | `.harness-install.json` próprio já existe no target (re-install) | veja `backupDir` no manifesto; remova o manifesto ou siga caminho de upgrade; nunca reinstale por cima | `installer/install.mjs:73-96` + `<target>/.harness-install.json` |

Outros códigos que podem aparecer (mesmo bloco 4-linhas, mesma tabela de origem):

`BAD_TARGET` (sem `--target` / `..` no path) · `NODE_MIN` (node < 20) ·
`UID_ROOT` (root sem `--allow-root`) · `FOREIGN_MANIFEST` (manifesto estranho:
humano resolve) · `OUTSIDE_TARGET` (write/paths fora do target) ·
`CORRUPT` (`opencode.json` inválido: corrija o JSON, nunca merge) ·
`NO_STDIN` (stdin fechado sem `--answers-file`: rode interativo ou passe o arquivo) ·
`USER_ABORT` (cancelado / camada recusada: 0 writes) ·
`DOGFOOD_GUARD` (alvo fora de `/tmp` sem confirmação) ·
`json-invalid` (JSON corrompido no destino) · `UNKNOWN` (fora do vocabulário).

---

## 6. Exemplo diagnóstico QUEBRADO (medflow — só leitura)

> Exemplo real de `doctor` QUEBRADO, citado como referência diagnóstica.
> Nada foi instalado em medflow; o fluxo foi read-only (0 writes).

```sh
node installer/install.mjs doctor --target /home/joao/fusionlf/wsProjeto/medflow --allow-root; echo "exit=$?"
```

Saída resumida (evidência: `harness/fase4-harness-medflow.json`):

```
[INFO] D3 plano: 133 itens (...)
[INFO] D4 checks: FAIL 16 item(ns)
  [INFO] D6 veredito: QUEBRADO (exit 1)
exit=1
```

Leitura: 133 itens classificados sem gravar; **16 flags** exigem resolução
humana (sem plugins/config do harness no destino); mtime intacto
(0 writes — read-only preservado). Verificação da evidência:

```sh
node -e "const h=require('./harness/fase4-harness-medflow.json'); console.log(h.commands[4].cmd, 'exit='+h.commands[4].exitCode, h.commands[4].stdoutHash)"
# esperado: node installer/install.mjs doctor ... exit=1 doctor-quebrado-16flags
```

---

## 7. Checklist final binário (tudo ✅ ou não está pronto)

```text
[ ] P1 node --version → major >= 20 (senão NODE_MIN)
[ ] P2 --target existe (senão BAD_TARGET)
[ ] P3 uid != 0 ou --allow-root (senão UID_ROOT)
[ ] P4 flutter/dart → pubspec.yaml presente (senão BAD_ANSWER)
[ ] INIT dry-run → exit 0 + "NÃO EXECUTADO" no output
[ ] INIT real → exit 0 + "[OK] init: pico-fim" + "[OK] checks: PASS"
[ ] INIT sujo → exit 1 + bloco flagged-open citando doctor (0 writes)
[ ] DOCTOR → marcadores D0..D6 em ordem + veredito + exit (0 SAUDÁVEL / 1 ATENÇÃO|QUEBRADO)
[ ] DOCTOR → 0 writes (manifesto ausente antes => ausente depois)
[ ] V1 opencode.json `plugin`/`plugins` SEM path local (o plugin local é auto-carregado)
[ ] V2 harness.config.json version=1 + project=Q&A + mcp.required correto (presente)
[ ] V3 .agents/schemas/harness-report.schema.json (presente)
[ ] V4 .harness-install.json manifestSchemaVersion=1 + backupDir fora do target (presente)
[ ] V5 checks re-executados → passed=true failed=[] (PASS)
[ ] FAIL opaco → código da §5 identificado (o quê/porquê/correção/onde-ver)
[ ] Backup retido até flags resolvidos + suite verde (ausente só depois disso)
[ ] Segredo: nenhum token em disco/log/evidência (ausente)
[ ] Código: zero arquivos fora de docs/ alterados (git status só mostra docs/INSTALACAO.md)
```

Verificação do último item:

```sh
git status --porcelain -- docs/ | head -n 5; echo ---; git status --porcelain | grep -v "^?? docs/" | grep -v "^M docs/" || echo "só-docs-ok"
# esperado: só-docs-ok (nada fora de docs/ tocado)
```
