# RESEARCH — `prd-eixos-separados-cli`

> **prd-id**: `prd-eixos-separados-cli` · **data de acesso das fontes**: 2026-11-16 · **tipo**: feature (reabertura de D5 e ADR-004 por decisão §16).
> **Entrada**: `PRD.md` aprovado (§16, `D16-EIXOS-CLI`, 2026-11-17T01:28:48.585Z; override `reabertura-D5-ADR004-eixos-cli`). Os 5 itens que o owner fechou em §16 são **insumo, não reabertos aqui**: (1) compor por eixo, (2) 8×6=48 substituindo os 12, (3) CLI setas+enter, (4) re-derivar golden/V20/selo com baseline aprovado, (5) critério comportamental medido + protótipo ao vivo antes da spec.
> **Regra de fontes**: 11 URLs, todas abertas com sucesso em 2026-11-16 (coluna "Acessível"). URL que não abrisse seria declarada inacessível e **não** usada como sustentação — não houve caso. Nenhuma outra URL é citada. Versões de biblioteca abaixo são as **publicadas em docs.rs/npm na data de acesso**, não pin do repo (o instalador Node não declara essas crates; a decisão de versão fica no SDD — constraints do batch).
> **O que este arquivo não é**: decisão de arquitetura, SPEC, PLAN ou implementação. Cada §2–§4 termina em recomendação com **critério medido**; o veredito é do owner no G2 e dos ADRs. Nenhum `ADR.md` nasce neste batch.
> **Insumo medido — não re-derivado aqui** (PRD §3 é a fonte; comandos de re-derivação estão em §3/§5): `STACK_PROFILES` = **12** perfis (`install.mjs:252`); `java+react` **já** tem `axes {backend:'java', frontend:'react'}` e _.backend/.frontend são strings literais declaradas via Q&A, não derivadas_; `rust+vue`, citado pelo owner, **não tem perfil** (`install.mjs:210`); oráculo cobre **9 byte-equal + java+react**, **36** combinações novas sem baseline (`golden.spec.mjs:48`); **13** consumidores de presets; V19 consumer=**21**, V20 population=**223/30373**; transcript ADR-004 congelado **16.336 B**; selo **`c904f1c5…`**.

## 1. Fontes (todas verificadas em 2026-11-16)

| id | URL | Data | O que sustenta | Acessível |
|---|---|---|---|---|
| S1 | https://en.wikipedia.org/wiki/Composition_over_inheritance | 2026-11-16 | Compor comportamentos "has-a" em vez de enumerar subclasses para cada combinação; o artigo cita explicitamente o anti-padrão de criar `VisibleAndSolid`, `VisibleAndMovable`, `VisibleAndSolidAndMovable` "para cada combinação necessária" → "grande quantidade de código repetitivo"; Rust citado como linguagem de composição exclusiva | Sim |
| S2 | https://en.wikipedia.org/wiki/Combinatorial_explosion | 2026-11-16 | Seção *Computing*: *n* variáveis com *Z* valores ⇒ **Zⁿ** estados; se cada combinação de tipos precisa ser programada, "logo se torna intratável até para poucas classes"; alternatura = intermediário/comum em vez de caso casado | Sim |
| S3 | https://12factor.net/config | 2026-11-16 | Config agrupada em "ambientes" nomeados não escala: novos deploys exigem novos nomes e geram "combinatorial explosion of config"; correção = controles **granulares e ortogonais**, cada um gerenciado de forma independente — base para eixos backend/frontend independentes | Sim |
| S4 | https://docs.rs/inquire/latest/inquire | 2026-11-16 | `inquire 0.9.5` (docs.rs 15-11-2026): `Select`/`MultiSelect` (navegação por setas), `Password`, `prompt_secret`, validators/defaults/help; **documenta o risco real**: SIGTERM com prompt aberto encerra sem destructors e pode deixar o terminal sem eco — "inquire does not install signal handlers itself" | Sim |
| S5 | https://docs.rs/dialoguer/latest/dialoguer | 2026-11-16 | `dialoguer 0.12.0` (docs.rs 23-08-2025): `Input`, `Select`, `MultiSelect`, `Password` (feature `password` **default on**), validação, `theme`; documentação 76,54% — alternativa mais antiga | Sim |
| S6 | https://www.npmjs.com/package/@inquirer/prompts | 2026-11-16 | `@inquirer/prompts 8.8.0` (npm, publicado 6 dias antes): `select` — "arrow keys + Enter"; `password`; `AbortSignal` para cancelamento; utilitários de teste; **`@inquirer/i18n` é drop-in com locale português embutido e detecção automática** via `LANGUAGE`/`LC_ALL`/`LANG` — sustenta i18n PT-BR; aviso： prompt não interativo sem TTY requer `setRawMode(true)` e `ExitPromptError` no Ctrl+C precisa tratamento | Sim |
| S7 | https://kiro.dev/docs/cli/ | 2026-11-16 | Kiro CLI (página atualizada 03-11-2026): "Terminal UI — panels, themes, keyboard shortcuts, and the fullscreen and voice modes built into the terminal interface"; binário standalone, modo headless — referência do "tipo Kiro CLI" citado em PRD §6/§16.3 | Sim |
| S8 | https://insta.rs/docs/ | 2026-11-16 | Insta (Armin Ronacher): snapshot testing com arquivos `.snap`, **redactions** para valores voláteis, seção "Testing CLIs" (`insta-cmd`), `cargo insta review` — ferramenta de revisão de diff, não oráculo de correção | Sim |
| S9 | https://associationforsoftwaretesting.org/2023/01/10/the-often-overlooked-test-oracle | 2026-11-16 | AST / Doug Hoffman: oráculo = mecanismo para julgar comportamento; **Saved Master** divide-se em *validated* (cada caractere verificado) e *unvalidated* (só "não notamos nada") — IBM: 30% dos bugs de campo já apareciam nos resultados e não foram notados; **Functional Equivalence** (versão anterior como oráculo); **Independent Implementation** — "quanto mais complexo o oráculo, mais provável que tenha bugs" | Sim |
| S10 | https://en.wikipedia.org/wiki/Characterization_test | 2026-11-16 | Golden Master Testing = *change detector* da versão de referência (Michael Feathers); oráculo histórico (Bach/Bolton); **"does not imply correctness"**, depende de repetibilidade e de mascarar valores voláteis; geração automatizada possível — risco de transformar comportamento observado em baseline "correto" | Sim |
| S11 | https://docs.rs/ratatui/latest/ratatui | 2026-11-16 | `ratatui 0.30.2` (docs.rs 02-11-2026): renderização imediata com buffer, widgets/layout, `run`/`init`/`restore`, backend crossterm default; **"Ratatui does not include any input handling"** — evento vem do backend (crossterm `event::read`) | Sim |

**Fatos locais lastreados (não são fontes web)**: PRD §3/§5/§6/§8/§9/§16 (insumo medido e decisões do owner); `install.mjs:210,252`; `installer/__tests__/golden.spec.mjs:48`; `installer/__tests__/eixos-stack.spec.mjs` (oráculo 48); 13 consumidores via `grep -rlE 'STACK_(VALUES|PROFILES)'`; transcript 16.336 B arquivado do ADR-004; selo `c904f1c5…`.

---

## 2. Tema A — composição de eixos vs tabela de perfis casados (Frente A → ADR-001)

> §16.1/§16.2 **fecharam o "se"**: compor por eixo e substituir os 12. O que pesa aqui é o **critério de composição**: como derivar `commands`/`moduleMap` do backend, `mcp`/`stacks`/skills do frontend e os textos, quando `.backend`/`.frontend` hoje são literais de Q&A (`install.mjs:252`, PRD §3) e `rust+vue` não tem perfil. P2-2 (PRD §8) pede avaliar esta frente separada da CLI.

| Alternativa | Fonte | Trade-off | Custo |
|---|---|---|---|
| **A1 — compor por eixo**: `BACKEND_AXES` (8) + `FRONTEND_AXES` (6) com `STACKS_FOR_EXCEPTIONS` declarada; derivar `commands`/`moduleMap` do eixo backend e `mcp`/`stacks`/skills do eixo frontend | S1, S3; lastro local `install.mjs:210,252` | Ganha 48 combinações a partir de 14 eixos declarados, sem enumerate 48 perfis; textos viram derivação ("rust backend"/"vue frontend") em vez de literal por preset (RF-04); é exatamente o padrão "has-a" de S1 e os controles ortogonais de S3. Contra: **36 combinações novas sem baseline byte-equal** (P0-1) e 13 consumidores a migrar (P2-1) | Derivar textos/commands/mcp; migrar 13 consumidores; re-derivar golden para 48 (Tema C) |
| **A2 — estender a tabela de perfis casados** até cobrir as 48 combinações (ex.: adicionar `rust+vue` como perfil literal) | S2, S3; lastro local 12 perfis | Ganha lookup direto e reaproveita os 9 baselines byte-equal sem derivação. Contra: é o "Zⁿ estados" de S2 e a "combinatorial explosion of config" de S3 — 48 entradas com `commands`/`mcp`/textos duplicados; `java+react` já mostra que o perfil só existe porque alguém o escreveu; **contraria §16.2** (substituir, não manter) e RF-05 | 48 entradas manuais, 36 novas sem oráculo, divergência garantida com a decisão do owner |

**Recomendação (ADR-001): A1.** **Critério**: `eixos-stack.spec.mjs` com oráculo 48/48 (RF-01), asserção por eixo para `commands`/`moduleMap` (RF-02) e para `mcp`/`stacks`/skills (RF-03), zero literal de preset solto em `install.mjs` (RF-04), e nenhum `STACK_VALUES`/`STACK_PROFILES` como caminho principal (RF-05/§16.2). A1 é a única alternativa que satisfaz §16.1 sem recriar a explosão que S2/S3 descrevem; A2 é descartada por decisão do owner **e** por custo de manutenção. A re-derivação de selo/baseline entra como critério desta frente (Tema C), não como ADR separado.

## 3. Tema B — frameworks de CLI TUI (Frente B → ADR-002)

> §16.3 fechou "setas+enter, tipo Copilot/Kiro, substituindo a tela `[1/5]`". A decisão aqui é **como entregar isso com critério medido** — P1-1 e §7 proíbem "prometer CLI visual sem critério comportamental medido". O runtime do instalador é Node ESM; S4/S5/S11 são referências cross-language, S6 é a alternativa do runtime atual. ux-designer é fonte visual vinculante (§6/§11); design-system-specialist produz os componentes.

| Alternativa | Fonte | Trade-off | Custo |
|---|---|---|---|
| **B1 — prompts interativos do runtime Node (`@inquirer/prompts` + `@inquirer/i18n`)** | S6; contraste S4/S5 | Ganha `select` com setas+Enter nativo, `password` sem eco, `AbortSignal` para aborto com 0 writes, utilitários de teste e — decisivo — **locale português embutido + auto-detecção**para i18n PT-BR (RF-07); casa com os 13 consumidores Node (PRD §3) e não troca o runtime. Contra: muda o formato do transcript de 16.336 B (exige re-derivação com aprovação §16) e depende de TTY: S6 documenta `setRawMode` e tratamento de `ExitPromptError` no Ctrl+C | 1–2 dependências Node; handler de sinal/TTY; transcript revalidado com protótipo |
| **B2 — TUI full-screen (`ratatui`/`inquire`, estética Kiro/Copilot)** | S7, S11, S4 | Ganha aparência de painel/full-screen citada em S7 — mais próxima da referência visual do owner. Contra: S11 declara que a crate **não inclui input handling** (exige backend de evento); S4 documenta terminal sem eco após SIGTERM; cria dois caminhos de tela (TTY full-screen × pipe) e **altera prompts/defaults/ranges** do transcript, sem oráculo de tela — exatamente o risco P1-1 que o PRD quer evitar | + backend de evento, ciclo draw/evento, cleanup de sinal, oráculo de tela novo |

**Recomendação (ADR-002): B1.** **Critério (medido, não prometido)**: protótipo ao vivo **antes da spec final** (RF-10) registrando **N telas** e **M interações setas+enter**, i18n PT-BR completo sem literal solto (RF-07), **zero comando digitado** (RF-06) e nenhum segredo em argv/stdout/stderr com leitura sem eco em TTY (RF-08/§13). B2 fica como divergência declarada em §16 **somente** se o owner, depois do protótipo, exigir full-screen — nunca como "detalhe de implementação". Versão de biblioteca não é congelada aqui (vai no SDD); S6/S4/S5/S11 são critério de seleção, não pin.

## 4. Tema C — estratégia de re-derivação de baseline, V20 e selo (critério do ADR-001, não ADR próprio)

> §16.4 e P0-1/P0-2 são explícitos: re-derivar `golden.spec.mjs`, V20 (population 223/30373) e o selo `c904f1c5…`, com **baseline aprovado pelo owner**. Risco medido: apenas 9 byte-equal + `java+react` têm oráculo; 36 combinações novas não têm. S9/S10 dizem o que acontece se o baseline for aceito sem validação.

| Alternativa | Fonte | Trade-off | Custo |
|---|---|---|---|
| **C1 — literal congelado + differential (padrão da casa), re-derivado para 48 e ratificado** | S9, S10; lastro local `golden.spec.mjs:48` | Ganha oráculo externo ao sujeito (não deriva do código sob teste — anti-tautologia); cobre as 12 existentes por paridade e as 36 novas por baseline **validado** (S9) antes de entrar verde. Contra: drift se o oráculo mudar; exige aprovação humana explícita do novo baseline e do novo selo (P0-1/P0-2) | Manter literais; re-derivar golden/V20; registrar novo hash em §16 |
| **C2 — snapshots automatizados (`insta`, `.snap`, redactions, `insta-cmd`)** | S8, S9, S10 | Ganha review visual do diff, redactions para valores voláteis e seção "Testing CLIs". Contra: S9 classifica saved master **unvalidated** como risco real (30% dos bugs de campo já estavam nos resultados e passaram batido) e S10 é claro — golden master "does not imply correctness"; um `.snap.new` aceito sem validação transforma bug em baseline | Ferramenta de review + etapa humana obrigatória por mudança |
| **C3 — regenerar baseline automaticamente a partir da implementação atual (auto-accept)** | S10, S9 | Ganha velocidade: 48/48 "verdes" imediatos. Contra: é characterization puro — detector de mudança, não de correção (S10); equivale ao master *unvalidated* que S9 condena; viola P0-1/RF-09 (baseline aprovado pelo owner) e H1/H2 do harness | Aparente economia; dívida P0 e risco de selo ratificar bug |

**Recomendação (ADR-001, critério de re-derivação): C1 como autoridade, C2 apenas como ferramenta de revisão de diff, C3 descartada.** **Critério**: nenhuma das 36 combinações novas entra verde sem baseline validado e ratificado em §16 (P0-1); selo novo re-derivado e registrado, sem promessa de compatibilidade com `c904f1c5…` (P0-2); V20 population re-medida por `node scripts/static-checks.mjs`; `suiteFull` 0 falhas (H1/H2). S8 viabiliza o review, mas a autoridade é o literal validado por humano — não `cargo insta accept`.

---

## 5. Recomendação final (uma por tema)

| Tema | Recomendação | Critério declarado | Fontes | PRD |
|---|---|---|---|---|
| **A — eixos** (ADR-001) | **A1**: compor `commands`/`moduleMap` do backend e `mcp`/`stacks`/skills do frontend; 14 eixos → 48 combinações, substituindo os 12 | 48/48 oráculo, asserção por eixo, zero literal de preset, 13 consumidores migrados; baseline re-derivado (Tema C) | S1, S3, S2 | §16.1/§16.2, RF-01..05, P0-1, P2-1 |
| **B — CLI** (ADR-002) | **B1**: prompts do runtime Node com setas+Enter, `password` sem eco e i18n PT-BR; protótipo ao vivo antes da spec | N telas / M interações medidas, PT-BR completo, zero comando digitado, segredo fora de argv/stdout; ux-designer vinculante | S6, S7, S4, S5, S11 | §16.3/§16.5, RF-06..08, RF-10, P1-1 |
| **C — baseline** (critério no ADR-001) | **C1** autoridade + **C2** só revisor de diff; **C3** proibida | 36 novas com baseline validado e ratificado em §16; selo novo registrado; `suiteFull` 0 falhas | S9, S10, S8 | §16.4, RF-09, P0-1/P0-2, H1/H2 |

## 6. Riscos que o owner precisa saber antes do G2

1. **36 combinações sem baseline não são "verdes por construção".** S9/S10: master não validado esconde bug; nenhuma entra no oráculo sem ratificação §16 (P0-1).
2. **Selo não é compatível com o antigo.** `c904f1c5…` será substituído; anunciar o novo hash e não prometer paridade com o selo congelado (P0-2).
3. **"12 presets casados" morrem como caminho principal, mas os literais podem sobreviver em 13 consumidores.** A1 sem a migração dos 13 deixa dois caminhos — verificar com o `grep` de RF-05.
4. **CLI visual sem protótipo é promessa, não critério.** B1 só vira decisão depois de N/M medidos ao vivo (P1-1/RF-10); ux-designer pode vetar a apresentação.
5. **TTY/SIGTERM é superfície real, não detalhe.** S4 e S6 documentam terminal sem eco e `ExitPromptError`; o ADR-002 precisa de cleanup e teste de não-vazamento (RF-08/§13).
6. **Versões não são desta pesquisa.** Números de docs.rs/npm em §1 são o que estava publicado em 2026-11-16; o repo não declara essas crates — pin e escolha de dependência ficam no SDD, não aqui.

## 7. Limites desta pesquisa

- 11 fontes, 11 abertas em 2026-11-16, 0 inacessíveis; nenhuma afirmação depende de página não aberta.
- Nenhum número do instalador foi re-derivado aqui: 12/48/9/36/13/21/223/30373/16.336 B/selo vêm do PRD §3 (insumo do batch, "não re-derivar").
- Nenhuma versão de biblioteca foi congelada como decisão; S1–S11 sustentam critério de seleção, não pin.
- Recomendações não são decisões. As duas frentes viram ADRs distintos (P2-2); nenhum `ADR.md`, spec, código, config ou estado foi criado/alterado neste batch.
