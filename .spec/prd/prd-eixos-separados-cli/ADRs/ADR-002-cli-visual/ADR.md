# ADR-002 — CLI visual setas+enter: prompts interativos do runtime Node com i18n PT-BR, segredo sem eco e protótipo aprovado congelado como interface

- **prd-id**: `prd-eixos-separados-cli` — `.spec/prd/prd-eixos-separados-cli/PRD.md`
- **order**: 2 de 2 (`.spec/prd/prd-eixos-separados-cli/ADR-INDEX.md`)
- **status**: `todo` (decisão escrita; branch/merge humano são do orquestrador)
- **branch**: `adr/prd-eixos-separados-cli/02-cli-visual` (reservada no índice; nenhum push feito por este batch)
- **depende-de**: **ADR-001** (`.spec/prd/prd-eixos-separados-cli/ADRs/ADR-001-eixos-separados/ADR.md`). A CLI seleciona os eixos que a ADR-001 define: primeiro backend, depois frontend, depois revisão e instalação (PRD §10/§11). Sem a composição por eixo, não há o que selecionar. Nenhuma rubrica da ADR-001 é reaberta; esta ADR consome a interface congelada dela.
- **data**: 2026-11-17 (data da decisão §16 e da aprovação do protótipo pelo owner)
- **dono da decisão**: owner do harness. §16.3 fixou "CLI visual tipo Copilot CLI / Kiro CLI (setas+enter), em substituição à tela line-based"; §16.5 fixou critério comportamental medido e protótipo ao vivo antes da spec final. O protótipo foi **aprovado pelo owner em 2026-11-17** (`workflow-state.json.prototype.status = approved_user_2026_11_17`) — é insumo fechado, não decisão a reabrir.
- **rota**: feature (Frente B do PRD, avaliada separadamente da Frente A por P2-2/PRD §8).
- **escopo de escrita desta entrega**: apenas `.spec/prd/prd-eixos-separados-cli/**` — neste batch, este `ADR.md` e a atualização de `ADR-INDEX.md`. Nenhum arquivo de `installer/**`, `scripts/**`, `.opencode/**`, `.agents/**` ou a raiz (inclusive `workflow-state.json`) foi tocado. Implementação da tela, pin de dependência e transcript re-derivado são o **SDD** desta ADR.
- **insumo**: `PRD.md` §3/§5/§6/§7/§8/§9/§11/§13/§16.3/§16.5 (RF-06..08, RF-10, P1-1/P1-2); `RESEARCH.md` §3 (B1 recomendada / B2 divergência declarada, fontes S4/S5/S6/S7/S11), §5 (recomendação final), §6-4/§6-5 (riscos de TTY e de protótipo sem critério); `workflow-state.json.prototype` (medições do protótipo aprovado); transcript congelado de 16.336 B da tela anterior (`.spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt`).

## 1. Contexto — fatos medidos, não deduzidos

| Fato | Valor | Comando / fonte |
|---|---|---|
| Tela atual | line-based `[1/5]`, exige digitação; W2m em 2 passos | `grep -nE '\[1/5\]|\[1/2\]|\[2/2\]' .spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt` |
| Transcript da tela anterior | **16.336 bytes**, 5 marcadores, sha congelado — mudará com B1 e exigirá re-derivação ratificada em §16 | `wc -c .spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt` (PRD §3; RESEARCH §3) |
| Protótipo aprovado | `approved_user_2026_11_17`; tecnologia B1 `@inquirer/prompts` + i18n PT-BR, **não** full-screen | `node -e 'const p=require("./workflow-state.json").prototype;console.log(p.status,p.tecnologia)'` (`workflow-state.json:2052-2062`) |
| Métricas do protótipo | N=**4** telas (backend, frontend, nome, token) + resumo; M=**2 setas+Enter (backend) / 1 seta+Enter (frontend) / Enter (nome) / token+Enter**; **0** comando digitado; PT-BR; segredo `[input is masked]` / `[REDACTED]`; `rust+vue` escolhidos separadamente — OK | `node -e 'const p=require("./workflow-state.json").prototype;console.log("N="+p.telas_N,"M="+p.interacoes_M,"cmd="+p.comandos_digitados,p.i18n,p.segredo,p.combinacao_demo)'` |
| Runtime do instalador | Node ESM; 13 consumidores de presets (ADR-001 item 7) | PRD §3; `harness.config.json.stack` |
| Referência visual do owner | Kiro CLI — "Terminal UI — panels, themes, keyboard shortcuts, and the fullscreen and voice modes"; ux-designer é fonte visual vinculante, design-system-specialist produz componentes | RESEARCH §1 S7; PRD §6/§11 |

**Defeito que esta ADR fecha.** Uma "CLI visual" sem critério medido é promessa, não decisão (P1-1/PRD §7). O protótipo ao vivo já rodou, foi aprovado e mediu N, M, zero comando digitado, PT-BR, mascaramento de segredo e a escolha separada de `rust`+`vue`. Reabrir o protótipo para "melhorar" a apresentação (B2 full-screen) trocaria um contrato medido por uma preferência estética sem oráculo de tela — exatamente o risco S4/S11 documentam (terminal sem eco após sinal; crate de TUI sem input handling). Esta ADR congela o que foi aprovado.

## 2. Decisão (única)

**Adotar B1 — prompts interativos do runtime Node (`@inquirer/prompts` + i18n PT-BR) com navegação por setas+Enter, `password` sem eco e `AbortSignal` para aborto — e congelar o protótipo aprovado em 2026-11-17 como contrato de tela: N=4 telas (backend, frontend, nome, token) + resumo; M=2 setas+Enter (backend) / 1 seta+Enter (frontend) / Enter (nome) / token+Enter; zero comando digitado; PT-BR completo; segredo exibido como `[input is masked]` e redacionado como `[REDACTED]`; `rust+vue` escolhidos separadamente e funcionando. B2 (TUI full-screen estilo Kiro) fica como **divergência declarada, não escolhida**, e o protótipo aprovado não é reaberto.** 🟢 para a decisão e as métricas (owner §16.3/§16.5 + protótipo aprovado + RESEARCH B1, fontes S6/S7; contraste S4/S5/S11); 🟡 para implementação, pin e transcript re-derivado (SDD). Versão/pin de biblioteca não é decidida aqui.

### 2.1 Protótipo congelado — métricas ratificadas

Estes valores são **interface**, não meta a negociar. Qualquer mudança de N, M, do mascaramento, do idioma ou da demonstração `rust+vue` exige nova decisão §16 — não "ajuste de implementação".

| Item | Valor medido e aprovado | Prova (somente leitura) |
|---|---|---|
| Status | `approved_user_2026_11_17` | `node -e 'console.log(require("./workflow-state.json").prototype.status)'` |
| N | **4** telas: backend → frontend → nome → token, **+ resumo** | `node -e 'console.log(require("./workflow-state.json").prototype.telas_N)'` ⇒ `4` |
| M | **2** setas+Enter (backend) / **1** seta+Enter (frontend) / Enter (nome) / token+Enter | `node -e 'console.log(require("./workflow-state.json").prototype.interacoes_M)'` |
| Comando digitado | **0** | `node -e 'console.log(require("./workflow-state.json").prototype.comandos_digitados)'` ⇒ `0` |
| Idioma | PT-BR completo, sem literal solto | `node -e 'console.log(require("./workflow-state.json").prototype.i18n)'` ⇒ `PT-BR` |
| Segredo | `[input is masked]` no prompt / `[REDACTED]` no resumo e em logs | `node -e 'console.log(require("./workflow-state.json").prototype.segredo)'` |
| Demonstração | `rust+vue` escolhidos separadamente e funcionando | `node -e 'console.log(require("./workflow-state.json").prototype.combinacao_demo)'` |

### 2.2 Contrato B1

- **Navegação**: `select` com setas+Enter para backend (8 opções) e frontend (6 opções), na ordem ADR-001 → ADR-002 (PRD §10/§11). Nenhuma pergunta aceita comando digitado; o nome do projeto entra por `input` com Enter; o token por `password` sem eco.
- **Segredo**: leitura em TTY sem eco, nunca em `argv`, `stdout` ou `stderr` (RF-08/§13). O valor sensível aparece apenas como `[input is masked]` durante a entrada e `[REDACTED]` no resumo/logs. `/proc/$PID/cmdline` não contém o segredo.
- **Aborto**: `AbortSignal`/`ExitPromptError` (Ctrl+C), `q` e EOF terminam com 0 escrita antes de `apply` — a invariante de "tela não grava" da ADR-001/herdada do instalador permanece.
- **i18n**: PT-BR completo via `@inquirer/i18n` (locale português embutido + detecção por `LANGUAGE`/`LC_ALL`/`LANG`, RESEARCH S6); nenhum texto visível solto em prompt, placeholder, `aria-label` ou resumo.
- **Transcript**: o formato muda em relação aos 16.336 B congelados; o novo transcript é re-derivado, validado e ratificado em §16 (§16.4/RESEARCH §3). Nenhuma afirmação de byte-paridade com o transcript antigo.
- **TTY**: `setRawMode` e cleanup de sinal são obrigatórios; SIGTERM com prompt aberto não pode deixar o terminal sem eco (risco documentado em S4/S6).

### 2.3 B2 — divergência declarada, não escolhida

TUI full-screen estilo Kiro (S7/S11/S4) é a alternativa **não adotada**: exige backend de evento (S11 declara que a crate não inclui input handling), ciclo draw/evento, cleanup de sinal e um oráculo de tela novo — sem critério medido, ao contrário do protótipo aprovado. Se o owner exigir full-screen depois desta ADR, isso é **nova decisão §16**, não "detalhe de implementação" nem reabertura silenciosa do protótipo.

## 3. Interface congelada

Forma ratificada pelo protótipo aprovado e por §16.3/§16.5. Itens *(proto)* são medições fechadas; *(SDD)* só passam a valer após a implementação. Comando de prova por item.

1. **N = 4 telas + resumo.** *(proto)* `node -e 'const p=require("./workflow-state.json").prototype;console.log(p.status,p.telas_N)'` ⇒ `approved_user_2026_11_17 4`. A ordem é backend → frontend → nome → token, seguida de resumo; nenhuma tela extra entra sem §16. 🟢 protótipo.

2. **M = interações medidas.** *(proto)* `node -e 'console.log(require("./workflow-state.json").prototype.interacoes_M)'` ⇒ `2 setas+Enter (backend) / 1 seta+Enter (frontend) / Enter (nome) / token+Enter`. *(SDD)* `node --test installer/__tests__/wizard.spec.mjs` cobre cada uma das 4 transições ⇒ 0 falha. 🟢 protótipo · 🟡 SDD.

3. **Zero comando digitado.** *(proto)* `node -e 'console.log(require("./workflow-state.json").prototype.comandos_digitados)'` ⇒ `0`. *(SDD)* `node --test installer/__tests__/wizard.spec.mjs` (fluxo completo por setas/Enter) ⇒ 0 falha; nenhuma etapa lê nome de stack como texto livre. 🟢 protótipo · 🟡 SDD.

4. **i18n PT-BR completo.** *(proto)* `node -e 'console.log(require("./workflow-state.json").prototype.i18n)'` ⇒ `PT-BR`. *(SDD)* `node --test installer/__tests__/wizard.spec.mjs` + varredura de literais visíveis nos prompts (`grep -rnE "prompt\(|message:|placeholder:" installer/install.mjs`) ⇒ todo texto vem de chave de locale; nenhuma string solta. 🟢 protótipo · 🟡 SDD.

5. **Segredo mascarado e fora de canais visíveis.** *(proto)* `node -e 'console.log(require("./workflow-state.json").prototype.segredo)'` ⇒ `[input is masked] / [REDACTED]`. *(SDD)* `tr '\0' ' ' </proc/$PID/cmdline | grep -F SEGREDO_PROVA` ⇒ vazio; `grep -F SEGREDO_PROVA <transcript> <stdout> <stderr>` ⇒ vazio; `node --test installer/__tests__/qa.spec.mjs` ⇒ 0 falha. 🟢 protótipo · 🟡 SDD.

6. **`rust+vue` separados.** *(proto)* `node -e 'console.log(require("./workflow-state.json").prototype.combinacao_demo)'` ⇒ `rust+vue escolhidos separadamente — OK`. *(SDD)* `node --test installer/__tests__/eixos-stack.spec.mjs` + `installer/__tests__/wizard.spec.mjs` ⇒ seleção independente de backend e frontend produz config válida (ADR-001 itens 1 e 5). 🟢 protótipo · 🟡 SDD.

7. **Aborto com 0 escrita.** *(hoje)* `node --test installer/__tests__/wizard.spec.mjs` ⇒ abortos `q`/EOF/`USER_ABORT` já cobertos (62 testes, 0 falhas). *(SDD)* os mesmos testes com `AbortSignal`/`ExitPromptError` ⇒ 0 falha; `find . | sort | sha256sum` antes/depois do aborto ⇒ idêntico; terminal com eco restaurado. 🟢 oráculo · 🟡 SDD.

8. **B2 não escolhida e protótipo não reaberto.** *(hoje)* `grep -nE 'B2|full-screen' .spec/prd/prd-eixos-separados-cli/ADRs/ADR-002-cli-visual/ADR.md` ⇒ só menções de divergência/fora; `grep -rnE "ratatui|inquire|dialoguer" installer/*.mjs` ⇒ vazio. *(SDD)* o mesmo `grep` ⇒ vazio; nenhuma tela full-screen, nenhuma mudança de N/M sem §16. 🟢 processo.

9. **Transcript re-derivado e ratificado.** *(hoje)* `wc -c .spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt` ⇒ `16336`; `grep -nE '\[1/5\]|\[1/2\]|\[2/2\]' <transcript>` ⇒ marcadores da tela antiga. *(SDD)* novo transcript com as 4 telas + resumo e os marcadores PT-BR, validado e ratificado em §16; nenhuma afirmação de paridade com 16.336 B (§16.4/P0-2 da ADR-001 aplicado ao transcript). 🟢 git · 🟡 ratificação.

10. **Consome a ADR-001.** *(hoje)* `grep -n '^-- \*\*depende-de\*\*' .spec/prd/prd-eixos-separados-cli/ADRs/ADR-002-cli-visual/ADR.md` ⇒ `ADR-001`. *(SDD)* `node --test installer/__tests__/wizard.spec.mjs && node --test installer/__tests__/eixos-stack.spec.mjs` ⇒ 0 falha; backend e frontend vêm dos eixos da ADR-001, não de preset casado. 🟢 documento · 🟡 SDD.

11. **Suíte completa e 1:1 do ledger.** *(hoje)* `node scripts/static-checks.mjs` ⇒ exit `0` com `PASS PRD-01`, `PASS ADR-01`, `PASS ADR-02`. *(SDD)* o mesmo comando ⇒ 0 falhas (H1/H2). 🟢 runtime.

12. **Escopo de decisão.** *(hoje)* `grep -nE '@inquirer/prompts@|inquire@|ratatui@|0\.[0-9]+\.[0-9]+' .spec/prd/prd-eixos-separados-cli/ADRs/ADR-002-cli-visual/ADR.md` ⇒ vazio. Versão/pin, toolchain e publicação ficam no SDD; este ADR decide apenas apresentação, critério medido e segredo. 🟢 processo.

## 4. Alternativas descartadas — custo medido

| Alternativa | Custo neste repo | Por que não |
|---|---|---|
| **B2 — TUI full-screen (`ratatui`/`inquire`, estética Kiro)** | + backend de evento (S11: a crate não inclui input handling), ciclo draw/evento, cleanup de sinal, oráculo de tela novo; altera prompts/defaults/ranges do transcript | É a aparência citada em S7, mas **não tem critério medido** — exatamente P1-1. Fica como divergência declarada: se o owner a exigir, é nova decisão §16, não reabertura do protótipo |
| **Manter a tela line-based `[1/5]`** | 0 dependência nova; transcript 16.336 B intacto | §16.3 decidiu substituir; exige digitação, é a dor que o owner classificou como "inutilizável" (PRD §1). Não atende RF-06 |
| **Segredo por argv (`--token=…`)** | 0 linha de código; `ps`/`/proc/$PID/cmdline` expõe o valor | Proibido por RF-08/§13 e pelo contrato de segredo da ADR-001. O protótipo já mediu `[input is masked]`/`[REDACTED]` |
| **Reabrir o protótipo para "acertar" N/M depois da aprovação** | Refaz medição, transcript e ratificação §16; perde o critério congelado | O protótipo foi **aprovado** em 2026-11-17; reabri-lo é trocar evidência por preferência (RESEARCH §6-4). N/M são interface, não meta revisável por implementação |

## 5. Riscos, mitigação e reversibilidade

- **P1-1 — CLI visual prometida sem critério.** Mitigação: protótipo aprovado e métricas congeladas na §2.1/§3 itens 1–6; ux-designer é fonte visual vinculante, design-system-specialist produz componentes (PRD §6/§11). 🟢 critério fechado · 🟡 execução no SDD.
- **P1-2 / TTY — segredo em argv ou terminal sem eco após sinal.** Mitigação: `password` sem eco, `AbortSignal`, `setRawMode` com cleanup de sinal; prova de não-vazamento no item 5 e aborto no item 7. Risco real documentado em S4/S6. 🟠 aberto até o SDD.
- **Transcript re-derivado sem ratificação.** Mitigação: novo transcript validado e registrado em §16; sem afirmação de paridade com 16.336 B (item 9). 🟠 aberto.
- **Pressão estética por B2.** Mitigação: B2 é divergência declarada (item 8); full-screen exige nova decisão §16, nunca "pequeno ajuste". 🟢 processo.
- **Reversibilidade**: reverter significa voltar à tela line-based e ao transcript de 16.336 B — decisão do owner §16, não reversível por esta ADR sozinha. Nada aqui toca `gate.js`, `harness.config.json` ou `workflow-state.json`.

## 6. Fora desta decisão

- Composição por eixo, cardinalidade 48, re-derivação de `golden.spec.mjs`/V20/selo e migração dos 13 consumidores — ADR-001.
- Versão/pin de `@inquirer/prompts`, `@inquirer/i18n` ou qualquer dependência; toolchain, formato de binário e publicação — SDD. Nenhuma versão é congelada aqui.
- Novos valores de N, M, mascaramento ou demonstração — exigem decisão §16; o protótipo aprovado não é reaberto.
- Qualquer alteração em `gate.js`, `harness.config.json`, `opencode.json`, `workflow-state.json`, `PRD.md`, `RESEARCH.md` ou `ADR-INDEX.md` além da atualização 1:1 deste batch.

## 7. Verificação de prontidão deste batch

```sh
git status --short
# somente .spec/prd/prd-eixos-separados-cli/** tocado (este ADR + ADR-INDEX)

node -e 'const p=require("./workflow-state.json").prototype;console.log(p.status,"N="+p.telas_N,"M="+p.interacoes_M,"cmd="+p.comandos_digitados,p.i18n,p.segredo,p.combinacao_demo)'
# approved_user_2026_11_17 N=4 M=2 setas+Enter (backend) / 1 seta+Enter (frontend) / Enter (nome) / token+Enter cmd=0 PT-BR [input is masked] / [REDACTED] rust+vue escolhidos separadamente — OK

node scripts/static-checks.mjs
# exit 0; PASS PRD-01 / PASS ADR-01 (1:1 índice↔disco) / PASS ADR-02 (sequência e branch)

grep -c 'depende-de' .spec/prd/prd-eixos-separados-cli/ADRs/ADR-002-cli-visual/ADR.md
grep -c 'interface congelada' .spec/prd/prd-eixos-separados-cli/ADRs/ADR-002-cli-visual/ADR.md
# ambos ≥1 — contrato do checks.mjs:329/332

grep -nE '^## (2\.|3\.|5\.|7\.)' .spec/prd/prd-eixos-separados-cli/ADRs/ADR-002-cli-visual/ADR.md
# decisão única §2, interface §3, riscos §5, verificação §7
```
