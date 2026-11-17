# ADR-001 — Eixos separados: compor config por eixo (8 backends × 6 frontends = 48 combinações), substituindo os 12 presets casados, com baseline, V20 e selo re-derivados e ratificados

- **prd-id**: `prd-eixos-separados-cli` — `.spec/prd/prd-eixos-separados-cli/PRD.md`
- **order**: 1 de 2 (`.spec/prd/prd-eixos-separados-cli/ADR-INDEX.md`)
- **status**: `todo` (decisão escrita; branch/merge humano são do orquestrador)
- **branch**: `adr/prd-eixos-separados-cli/01-eixos-separados` (reservada no índice; nenhum push feito por este batch)
- **depende-de**: — (primeira ADR do PRD; pressupõe `PRD.md` §16 aprovado e `RESEARCH.md` §2/§4/§5). Nenhuma rubrica de ADR anterior é reaberta: a reabertura de D5 e ADR-004 é a decisão do owner `D16-EIXOS-CLI`, registrada em `workflow-state.json` (`overrides[portao="reabertura-D5-ADR004-eixos-cli"]`, `decisoes_16[D16-EIXOS-CLI]`).
- **data**: 2026-11-17 (data da decisão §16; protótipo aprovado no mesmo dia)
- **dono da decisão**: owner do harness. §16.1/§16.2/§16.4 fixam: compor por eixo, 48 combinações **em substituição** aos 12, re-derivar `golden.spec.mjs`/V20/selo com baseline aprovado. §16.5 fixa critério comportamental. Este ADR implementa essas decisões como contrato; não as reabre.
- **rota**: feature (reabertura de D5 por §16). Muda a forma de composição da config e o inventário de combinações; não muda `gate.js`, `opencode.json`, `harness.config.json` nem `workflow-state.json`.
- **escopo de escrita desta entrega**: apenas `.spec/prd/prd-eixos-separados-cli/**` — neste batch, este `ADR.md` e a atualização de `ADR-INDEX.md`. Nenhum arquivo de `installer/**`, `installer-rs/**`, `scripts/**`, `.opencode/**`, `.agents/**` ou a raiz foi tocado. Registry/derivações, migração dos consumidores, specs e selo novo são o **SDD** deste ADR.
- **insumo**: `PRD.md` §3 (fatos medidos), §5 (métricas/comandos), §6/§9 (escopo e RF-01..05, RF-09), §8 (P0-1/P0-2, P2-1/P2-2), §16.1/§16.2/§16.4; `RESEARCH.md` §2 (A1 aceita / A2 descartada, fontes S1/S2/S3), §4 (C1 autoridade, C2 só revisor de diff, C3 proibida, fontes S8/S9/S10), §5 (recomendação final).

## 1. Contexto — fatos medidos, não deduzidos

Medições registradas no PRD §3 e na pesquisa (números do instalador **não re-derivados** neste batch — RESEARCH §7). Cada linha traz o comando de re-derivação declarado no PRD §3/§5.

| Fato | Valor | Comando / fonte |
|---|---|---|
| `STACK_PROFILES` hoje | **12** perfis casados | `node -e 'import("./installer/install.mjs").then(m=>console.log(Object.keys(m.STACK_PROFILES).length))'` (PRD §3, `install.mjs:252`) |
| Eixos já declarados | `AXIS_IDS.backend` = **8** (java, node, rust, nestjs, dart, flutter, other, none); `AXIS_IDS.frontend` = **6** (vue, react, dart, flutter, other, none) ⇒ **48** | `node --input-type=module -e 'import("./installer/install.mjs").then(m=>{const a=m.AXIS_IDS;console.log(a.backend.length+"x"+a.frontend.length+"="+(a.backend.length*a.frontend.length))})'` (PRD §3, `install.mjs:210`) |
| `java+react` | `axes {backend:'java', frontend:'react'}` **já existe**, mas `.backend`/`.frontend` são strings literais declaradas via Q&A, não derivadas | `install.mjs:252`; PRD §3; RESEARCH §2 |
| `rust+vue` (exemplo do owner) | **sem perfil** — só nasce com composição por eixo | PRD §3 / RESEARCH §7 (`install.mjs:210`) |
| Oráculo `golden.spec.mjs` | **9 presets byte-equal + bloco `java+react`**; **36** combinações novas sem baseline | `node --test installer/__tests__/golden.spec.mjs` (PRD §3, `golden.spec.mjs:48`) |
| Consumidores de presets | **13** declarados no PRD §3 (`install.mjs`, `contract-registry.mjs`, `contract-pure.mjs`, `installer-rs/src/ops/registry.rs`, specs etc.); o `grep` do PRD cobre `installer/`+`.agents/`, e o inventário do SDD estende a varredura a `installer-rs/src/` | `grep -rlE 'STACK_(VALUES|PROFILES)' installer/ .agents/ | sort -u` (PRD §3); divergência de contagem é débito de inventário do SDD, não decisão nova aqui |
| V19/V20 | consumer=**21**; population=**223/30373** | `node scripts/static-checks.mjs` (PRD §3) |
| Selo canônico | `c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2` — será **substituído**; sem promessa de compatibilidade | `node --input-type=module -e "import {sealCommands} from './.opencode/plugins/lib/seal.mjs';import fs from 'node:fs';const c=JSON.parse(fs.readFileSync('harness.config.json','utf8')).commands;console.log(sealCommands(c))"` (PRD §3) |

**Defeito que esta ADR fecha.** `STACK_PROFILES` tem `axes` separados, porém os campos de config são literais de Q&A por perfil. Só 12 pares têm perfil: `rust+vue` não existe, e estender a tabela até 48 recriaria a explosão combinatória que S2/S3 descrevem. Sem uma regra de composição, o instalador não consegue produzir config válida para as 48 combinações que o owner exigiu — e sem baseline validado, as 36 novas entrariam "verdes" por characterization (S9/S10). A decisão precisa ser **uma regra de derivação verificável**, não uma lista maior.

## 2. Decisão (única)

**Adotar A1 — compor a config por eixo: `commands` e `moduleMap` derivados do eixo backend, `mcp`, `stacks` e skills derivados do eixo frontend, textos derivados ("rust backend", "vue frontend") em vez de literais por preset; as 8×6=48 combinações passam a ser o caminho principal, substituindo os 12 presets casados; `golden.spec.mjs`, V20 e o selo são re-derivados com C1 como autoridade, C2 apenas como revisor de diff e C3 proibida, e nenhuma das 36 combinações novas entra verde sem baseline validado e ratificado pelo owner em §16.** 🟢 para a decisão (owner §16.1/§16.2/§16.4 + RESEARCH A1/C1, fontes S1/S2/S3/S8/S9/S10); 🟡 para execução, migração e ratificação do selo (é o SDD desta ADR que as prova). Nenhuma compatibilidade com os 12 presets como caminho principal é prometida.

### 2.1 Regra de composição — origem por eixo

| Campo da config | Origem | Regra de derivação | Proibição |
|---|---|---|---|
| `commands` | eixo `backend` | suíte/unitário declarados pelo backend (`java`→Maven, `node`/`nestjs`→npm, `rust`→cargo, `dart`/`flutter`→dart/flutter, `other`/`none`→N/A justificado) | nenhum `commands` vindo do frontend |
| `moduleMap` | eixo `backend` | mapa de módulos do backend (`plugins`, `rules`, `schemas`) | nenhum `moduleMap` por preset casado |
| `mcp` | eixo `frontend` | servidores exigidos pelo frontend (`chrome-devtools` para as frentes web) | nenhum `mcp` vindo do backend |
| `stacks` | eixo `frontend` (+ backend quando aplicável) | `stacksFor(axes)` com exceção mobile **declarada** `flutter+flutter → ['flutter','dart']`; nunca tabela de 48 entradas | nenhuma exceção implícita, nenhum preset literal |
| skills | eixo `frontend` (+ backend quando aplicável) | `SKILLS_BY_AXIS`/`SKILLS_COMMON`, `SKILLS_FOR_EXCEPTIONS` quando houver; o mesmo contrato de 6 mapas injetados continua | nenhuma skill escolhida pelo nome do preset |
| `stack.backend` / `stack.frontend` (textos) | eixo correspondente | derivar `"<eixo> backend"` / `"<eixo> frontend"`; `none` produz texto `N/A` com justificativa | nenhuma string literal por preset fora do oráculo congelado |
| `infra`, `protectedPaths`, `gates`, `riskPaths`, `escalateOnRisk`, `contraproveTimeoutMs`, `evidence` | invariantes do harness | permanecem byte-idênticos ao baseline (PRD §3/`golden.spec.mjs`) | nenhuma mudança destes campos sem decisão §16 separada |

Skills/rules por eixo usam o contrato já existente de `SKILLS_BY_AXIS`/`RULES_BY_AXIS` (`.opencode/plugins/lib/.../checks.mjs`) — a migração é de **origem dos eixos**, não de mecanismo de gating. `gate.js` continua sem referência ao instalador.

### 2.2 Cardinalidade e substituição

`AXIS_IDS.backend` (8) × `AXIS_IDS.frontend` (6) = **48** combinações válidas. `other` e `none` são eixos legítimos, não coringa: `none` produce `N/A` justificado, `other` produz config mínima declarada. `rust+vue` é apenas o caso de demonstração citado pelo owner — a regra cobre os 48, não um par especial. "Substituir" (§16.2/RF-05) significa: nenhum consumidor escolhe stack por nome de preset casado como caminho principal; os 12 nomes podem sobreviver **somente** como rótulos legados em camada de compatibilidade congelada e oráculo, nunca como fonte de `commands`/`mcp`/textos.

### 2.3 Re-derivação de baseline, V20 e selo — critério C1/C2/C3

- **C1 (autoridade)**: os literais validados de `golden.spec.mjs` continuam sendo o oráculo externo ao código sob teste. Re-derivar para 48 com um literal por combinação; as 36 novas só entram verdes depois de **validação humana e ratificação em §16** (P0-1/RF-09). Nenhum `insta accept` como ato de autoridade.
- **C2 (revisor de diff)**: snapshots/`insta` podem ser usados para **revisar o diff** (redactions para valores volágeis), nunca para aceitar baseline sem validação (S8/S9/S10).
- **C3 (proibida)**: regenerar baseline automaticamente a partir da implementação atual (auto-accept) é characterization — detector de mudança, não de correção; transforma bug em baseline "correto" e viola P0-1, RF-09 e H1/H2.
- **Selo**: o hash `c904f1c5…` será substituído pelo resultado de `sealCommands(commands)` sobre o `harness.config.json` pós-SDD. O novo valor é **registrado e ratificado em §16**; nenhuma afirmação de paridade com o selo antigo (P0-2). V20 population é re-medida por `node scripts/static-checks.mjs`. `suiteFull` termina com 0 falhas.

### 2.4 Consumidores

Os 13 consumidores do PRD §3 são migrados no SDD: cada um passa a consumir eixos/derivações puras em vez de tabela casada; `installer-rs/src/ops/registry.rs` e `answers.rs` entram no inventário. Nenhum consumidor fica sem veredito; a contagem exata é reconciliada no SDD com `grep -rlE 'STACK_(VALUES|PROFILES)' installer/ .agents/ installer-rs/src/`.

## 3. Interface congelada

Forma ratificada de §16.1/§16.2/§16.4. Itens marcados *(hoje)* medem o estado antes do SDD; *(SDD)* só passam a valer após a implementação. Nível de garantia explícito por item.

1. **Cardinalidade 8×6=48.** *(hoje)* `node --input-type=module -e 'import("./installer/install.mjs").then(m=>{const a=m.AXIS_IDS;console.log(a.backend.length+"x"+a.frontend.length+"="+(a.backend.length*a.frontend.length))})'` ⇒ `8x6=48`. *(SDD)* `node --test installer/__tests__/eixos-stack.spec.mjs` ⇒ oráculo 48/48 (hoje: 73 testes, 0 falhas, oráculo de 12 perfis). 🟢 medição · 🟡 SDD.

2. **`commands`/`moduleMap` vêm do backend.** *(hoje)* `grep -n "commands:\|moduleMap:" installer/__tests__/golden.spec.mjs` mostra os literais do baseline congelado. *(SDD)* `node --test installer/__tests__/eixos-stack.spec.mjs` com asserção por eixo backend (RF-02) ⇒ 0 falha; `grep -n "commandsForBackend\|moduleMapForBackend" installer/*.mjs` ⇒ ≥1. 🟢 SDD.

3. **`mcp`/`stacks`/skills vêm do frontend.** *(hoje)* `node --test installer/__tests__/contract-registry.spec.mjs` (registry atual) e `node --test installer/__tests__/eixos-stack.spec.mjs` (exceção mobile declarada) ⇒ 0 falha. *(SDD)* os mesmos comandos com oráculo por eixo frontend (RF-03) ⇒ 0 falha; `grep -n 'flutter+flutter' installer/*.mjs` ⇒ só a exceção declarada. 🟢 SDD.

4. **Textos derivados, zero literal de preset no gerador.** *(hoje)* `grep -rn "backend (declared via Q&A)\|frontend (declared via Q&A)" installer/__tests__/golden.spec.mjs` ⇒ os literais vivem **no oráculo**, não no gerador. *(SDD)* `grep -rn "backend (declared via Q&A)\|frontend (declared via Q&A)" installer/*.mjs` ⇒ vazio; `node --test installer/__tests__/golden.spec.mjs` ⇒ 0 falha (RF-04). 🟢 SDD.

5. **`rust+vue` válido sem perfil casado.** *(hoje)* `node -e 'import("./installer/install.mjs").then(m=>console.log("rust+vue" in m.STACK_PROFILES))'` ⇒ `false`. *(SDD)* `node --input-type=module -e 'import("./installer/installer-contract.mjs").then(m=>{const c=m.generateConfig({project:"demo",axes:{backend:"rust",frontend:"vue"}});console.log(c.stack.backend,c.stack.frontend,JSON.stringify(c.commands))})'` ⇒ `rust backend vue frontend` com `commands` do backend e `mcp` do frontend; 0 exceção. 🟢 medição · 🟡 SDD.

6. **Substituição dos 12 como caminho principal.** *(hoje)* `node -e 'import("./installer/install.mjs").then(m=>console.log(Object.keys(m.STACK_PROFILES).length))'` ⇒ `12`. *(SDD)* `grep -rnE "presetOfAxes|STACK_PROFILES\[" installer/*.mjs installer-rs/src/ops/*.rs` ⇒ nenhuma seleção de config por nome de preset casado fora da camada de compatibilidade congelada; `grep -rlnE 'STACK_(VALUES|PROFILES)' installer/ .agents/ installer-rs/src/ | sort -u` ⇒ inventário reduzido ao registry/oráculo (RF-05/§16.2). 🟡 SDD.

7. **Inventário de consumidores com veredito.** *(hoje)* `grep -rlE 'STACK_(VALUES|PROFILES)' installer/ .agents/ installer-rs/src/ | sort -u | wc -l` ⇒ contagem local (PRD §3 declara 13; reconciliação é débito do SDD). *(SDD)* cada arquivo do inventário tem veredito registrado em `TASKS.md`/`VERIFY.md` do SDD; nenhum import órfão. 🟡 SDD.

8. **Baseline re-derivado e validado para 48.** *(hoje)* `node --test installer/__tests__/golden.spec.mjs` ⇒ 42 testes, 0 falhas (9 byte-equal + `java+react`); `wc -l installer/__tests__/golden.spec.mjs` registra o tamanho atual. *(SDD)* `node --test installer/__tests__/golden.spec.mjs` ⇒ um literal por combinação das 48, 0 falha; nenhuma das 36 novas sem baseline ratificado em §16 (P0-1); `grep -rnE 'INSTA_UPDATE=always|insta accept' scripts/ installer/ .agents/` ⇒ vazio (C3 proibida). 🟢 oráculo · 🟡 ratificação.

9. **V20 re-medido.** *(hoje)* `node scripts/static-checks.mjs` ⇒ `PASS V20: cdl medido: population=223/30373` (PRD §3). *(SDD)* o mesmo comando ⇒ `PASS V20` com population re-medida e registrada no relatório do SDD; nenhuma queda silenciosa de cobertura. 🟢 runtime.

10. **Selo re-derivado e ratificado.** *(hoje)* `node --input-type=module -e "import {sealCommands} from './.opencode/plugins/lib/seal.mjs';import fs from 'node:fs';const c=JSON.parse(fs.readFileSync('harness.config.json','utf8')).commands;console.log(sealCommands(c))"` ⇒ `suiteFull: c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2`. *(SDD)* o mesmo comando ⇒ novo hash, registrado e ratificado em §16; nenhuma afirmação de compatibilidade com `c904f1c5…` (P0-2). 🟢 runtime · 🟡 ratificação.

11. **Invariantes do harness intactas.** *(hoje)* `grep -c 'install\.mjs\|installer/' .opencode/plugins/gate.js` ⇒ `0`; `git diff --exit-code -- harness.config.json opencode.json workflow-state.json` ⇒ vazio neste batch. *(SDD)* o mesmo `grep` ⇒ `0`; `git diff --exit-code -- gate.js` ⇒ vazio; campos `infra`/`gates`/`protectedPaths`/`riskPaths`/`escalateOnRisk`/`contraproveTimeoutMs`/`evidence` byte-idênticos ao baseline. 🟢 repo · 🟡 SDD.

12. **Suíte completa e 1:1 do ledger.** *(hoje)* `node scripts/static-checks.mjs` ⇒ exit `0` com `PASS PRD-01`, `PASS ADR-01` (1:1 índice↔disco), `PASS ADR-02` (sequência e branch). *(SDD)* o mesmo comando ⇒ `PASS` com 0 falhas (H1/H2). 🟢 runtime.

13. **Escopo de decisão.** *(hoje)* `grep -nE 'ratatui|inquire|dialoguer|@inquirer|telas_N|interacoes_M' ADR.md` ⇒ só menções em "fora desta decisão". CLI visual, protótipo, versões de biblioteca e N/M pertencem ao ADR-002/SDD; este ADR decide apenas a composição por eixo e o critério de baseline. 🟢 processo.

## 4. Alternativas descartadas — custo medido

| Alternativa | Custo neste repo | Por que não |
|---|---|---|
| **A2 — estender a tabela de perfis casados até 48** (ex.: adicionar `rust+vue` como literal) | 48 entradas com `commands`/`mcp`/textos duplicados; 36 novas sem oráculo | É o "Zⁿ estados" (S2) e a "combinatorial explosion of config" (S3); contraria §16.2 (substituir) e RF-05. `java+react` só existe porque alguém escreveu o perfil — exatamente o custo que A1 remove (RESEARCH §2) |
| **C2 como autoridade (snapshots `insta` aceitos)** | + etapa de review por mudança; risco de `.snap.new` virar baseline sem validação | S9: saved master *unvalidated* — 30% dos bugs de campo já apareciam nos resultados e passaram batido; S10: golden master "does not imply correctness". C2 fica só como revisor de diff |
| **C3 — auto-accept do baseline a partir da implementação** | 48/48 "verdes" imediatos; dívida P0 | Characterization puro (S10); viola P0-1/RF-09 (baseline aprovado pelo owner) e H1/H2 do harness |
| **Manter os 12 como caminho principal ao lado dos eixos** | Dois caminhos de composição; 13 consumidores com fonte dupla | §16.2 decidiu **substituir**; RESEARCH §6-3 prevê o risco. Nenhuma compatibilidade é prometida |

## 5. Riscos, mitigação e reversibilidade

- **P0-1 — 36 combinações sem baseline byte-equal.** Mitigação: C1 com literal validado por combinação e ratificação em §16; nenhuma entra verde antes disso. Comando de prova: item 8 da interface. 🟠 aberto até o SDD.
- **P0-2 — selo quebrado sem re-derivação.** Mitigação: novo hash registrado em §16, sem promessa de paridade com `c904f1c5…`. Comando: item 10. 🟠 aberto.
- **P2-1 — 13 consumidores de presets.** Mitigação: veredito por consumidor no inventário do SDD, incluindo `installer-rs`; contagem reconciliada (item 7). 🟡 inventário.
- **P2-2 — confundir eixos com CLI visual.** Mitigação: ADR-002 é unidade separada e `depende-de` desta; este ADR não decide tela, prompts, N/M nem biblioteca de UI (item 13). 🟢 processo.
- **Reversibilidade**: reverter significa voltar a compor por tabela de 12 perfis e restaurar o selo `c904f1c5…` — custo alto (48→12 Perfis, baseline rejeitado), mas o SDD é a única camada que muda; `gate.js`, `harness.config.json` e `workflow-state.json` nunca são tocados. Decisão do owner §16, não reversível por este ADR sozinho.

## 6. Fora desta decisão

- CLI visual, framework/pin de biblioteca, N telas, M interações, protótipo e segredo em tela — ADR-002 e SDD (RESEARCH tema B, fontes S4/S5/S6/S7/S11).
- Versão de qualquer dependência, toolchain, formato de binário e publicação — SDD; nenhuma versão é congelada aqui.
- Valor exato do novo hash do selo e o conteúdo do baseline das 36 novas — medição do SDD, ratificada em §16 (PRD §14).
- Qualquer alteração em `gate.js`, `harness.config.json`, `opencode.json`, `workflow-state.json`, `PRD.md`, `RESEARCH.md` ou `ADR-INDEX.md` além da atualização 1:1 deste batch.

## 7. Verificação de prontidão deste batch

```sh
git status --short
# somente .spec/prd/prd-eixos-separados-cli/** tocado (este ADR + ADR-INDEX)

node scripts/static-checks.mjs
# exit 0; PASS PRD-01 / PASS ADR-01 (1:1 índice↔disco) / PASS ADR-02 (sequência e branch)

grep -c 'depende-de' .spec/prd/prd-eixos-separados-cli/ADRs/ADR-001-eixos-separados/ADR.md
grep -c 'interface congelada' .spec/prd/prd-eixos-separados-cli/ADRs/ADR-001-eixos-separados/ADR.md
# ambos ≥1 — contrato do checks.mjs:329/332

grep -nE '^## (2\.|3\.|5\.|7\.)' .spec/prd/prd-eixos-separados-cli/ADRs/ADR-001-eixos-separados/ADR.md
# decisão única §2, interface §3, riscos §5, verificação §7
```
