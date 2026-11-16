# RESEARCH — `prd-installer-rust`

> **prd-id**: `prd-installer-rust` · **data de acesso das fontes**: 2026-11-16 · **tipo**: refactor (programa `harness-refactor-2026-11`, PRD-3).
> **Entrada**: `PRD.md` aprovado no G1 (§16, D1–D8 fechadas). **D1–D8 não são reabertos aqui**: o que o owner decidiu é insumo; crate/framework/formato de contrato são recomendação para os 5 ADRs do fatiamento D8.
> **Estado medido na redação**: branch `prd/prd-installer-rust` @ `5025721` (commit do PRD); oráculo congelado `c63e333` é ancestral direto; `be8a348` (main verde, 540+559 no payload do owner) também é ancestral. `git status --short` vazio. Selo publicado `c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2` re-derivado por `sealCommands` (inalterado, D6).
> **Regra de fontes**: 12 URLs, todas abertas com sucesso em 2026-11-16 (coluna "Acessível"). URL que não abrisse seria declarada como inacessível e **não** usada como sustentação — não houve caso. Nenhuma outra URL é citada neste documento. Versões de crate abaixo são as **publicadas em docs.rs na data de acesso**, não pin do repo (`Cargo.toml` ausente, PRD §3.6 M7).
> **O que este arquivo não é**: decisão de arquitetura, SPEC, PLAN ou implementação. Cada §7 termina em recomendação com critério; o veredito é do owner no G2 e dos ADRs.

## 1. Fontes (todas verificadas em 2026-11-16)

| id | URL | Data | O que sustenta | Acessível |
|---|---|---|---|---|
| S1 | https://docs.rs/clap | 2026-11-16 | `clap 4.6.7`; interfaces derive/builder, `Parser`/`Subcommand`/`ValueEnum`, help/usage gerados, MSRV 1.74, licença MIT/Apache-2.0 | Sim |
| S2 | https://docs.rs/anyhow | 2026-11-16 | `anyhow 1.0.104`; `anyhow::Result`, `Context`/`with_context`, `bail!`, `ensure!`, downcast, backtrace; recomenda `thiserror` para tipos de erro próprios | Sim |
| S3 | https://docs.rs/thiserror | 2026-11-16 | `thiserror 2.0.21`; `derive(Error)`, `#[error("…")]`, `#[from]`/`#[source]`, `error(transparent)`; "deliberately does not appear in your public API" | Sim |
| S4 | https://docs.rs/ratatui/latest/ratatui | 2026-11-16 | `ratatui 0.30.2`; renderização imediata com buffer, `run`/`init`/`restore`, widgets/layout, backend `crossterm` default; **não inclui input handling** — evento vem do backend | Sim |
| S5 | https://docs.rs/inquire | 2026-11-16 | `inquire 0.9.5`; `Text`/`Select`/`Confirm`/`Password`/`prompt_secret`, validadores/defaults, renderer via crossterm; `SIGTERM` com prompt aberto pode deixar terminal sem eco se a aplicação não registrar cleanup | Sim |
| S6 | https://docs.rs/dialoguer | 2026-11-16 | `dialoguer 0.12.0`; `Input`/`Select`/`Password` (feature `password`, default on), `console`/`theme`, validação; alternativa mais antiga (docs 76,54%) | Sim |
| S7 | https://insta.rs/docs | 2026-11-16 | Ferramenta de snapshot testing para Rust: `.snap`, `.snap.new`, `cargo insta review`, inline snapshots, seção "Testing CLIs" | Sim |
| S8 | https://associationforsoftwaretesting.org/2023/01/10/the-often-overlooked-test-oracle | 2026-11-16 | Doug Hoffman / AST: oráculo = mecanismo para julgar comportamento; tipos "Saved Master" (validated vs unvalidated), "Independent Implementation" (custo alto; oráculo mais complexo que o sujeito inverte o bug), "Functional Equivalence" (versão anterior como oráculo), "Model-Based", "Constraint/Property" | Sim |
| S9 | https://doc.rust-lang.org/std/process/struct.Command.html | 2026-11-16 | `std::process::Command` (std 1.100.0): `spawn`/`output`/`status`, `Stdio` piped vs inherit, `env`/`env_clear`, `current_dir`; `output()` captura stdout/stderr, **não** captura stdin; falha do filho (inclusive sinal) aparece em `ExitStatus`, não como erro de spawn; `arg()` não passa por shell | Sim |
| S10 | https://doc.rust-lang.org/std/io/trait.IsTerminal.html | 2026-11-16 | `std::io::IsTerminal::is_terminal` (std 1.70): detecta tty; exemplo oficial mostra prompt só se `stdin.is_terminal()` e `read_line` para o caso pipe — base para TTY vs pipe/redirect | Sim |
| S11 | https://docs.rs/readpass | 2026-11-16 | `readpass 1.2.0`; `from_tty()` lê senha sem eco em Unix/Windows; retorno `Zeroizing<String>` de `zeroize`; prompt deve ser escrito antes, em stdout ou stderr | Sim |
| S12 | https://docs.npmjs.com/cli/v12/configuring-npm/package-json | 2026-11-16 | npm 12.2.2: `optionalDependencies` (falha de install não aborta; "program's responsibility to handle the lack"), `os`/`cpu`/`libc`, `bin`, `files`, `bundleDependencies`, `engines`; base para distribuir binário sem toolchain no destino | Sim |

**Fatos locais lastreados (não são fontes web)**: `installer/__tests__/golden.spec.mjs:50,87,119,149` (9 não-mobile byte-equal + bloco `java+react` + novos; `flutter`/`dart` com asserts dedicados); `installer/__tests__/eixos-stack.spec.mjs:7,39` (comentário "oráculo independente" + `EXPECTED_STACKS` literal); `harness.config.json:14` (4 etapas em `commands.suiteFull`); `.spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt` (16.336 bytes, transcript arquivado); `PRD.md` §3.3/§3.5/§3.7/§16.

---

## 2. Tema A — parsing de argumentos e erro (insumo do ADR-003: motor `init`/`doctor`/`upgrade`)

| Alternativa | Fonte | Trade-off | Custo |
|---|---|---|---|
| **A1 — `clap` derive + `anyhow` (app) + `thiserror` (tipos de domínio)** | S1, S2, S3 | Parser, help, subcomandos, validação de range e sugestões prontos; `thiserror` não polui API pública (S3). Contra: texto de help/erro gerado pelo `clap` **não é** o `printUsage` atual — exige fixação explícita dos textos para SI-5/paridade de stdout/stderr | 3 dependências + feature `derive`; MSRV 1.74 declarado em S1; trabalho de pinar textos contra o oráculo |
| **A2 — `std::env::args` + `Result<T, Box<dyn Error>>`, sem crate de CLI** | S9, S10, S11 (std como contrato) | Controle byte-a-byte de todo o texto impresso; zero dependency tree. Contra: reimplementar `--help`, ranges, defaults, mensagens 4-linhas e parsing legado (`install.mjs:2463-2471`) — é exatamente onde "reinterpretação" (PRD §1) mora | Mais código próprio e mais superfície de teste; economia de 3 crates, aumento de lógica manual |

**Recomendação (ADR-003)**: **A1**, com os textos de usage/erro tratados como saída a ser comparada com o oráculo — **critério**: minimizar defeito de parsing sem perder paridade observável nos 4 entrypoints; o custo de 3 crates é menor que reimplementar validação/help à mão, e o risco de texto diferente é fechado por golden (ADR-002), não por intenção.

## 3. Tema B — TUI de terminal (insumo do ADR-004: 10 telas)

> D3 permanece **fechado**: 10 telas completas, com navegação, prompts, estados e a11y (TTY vs pipe, segredo sem eco). A decisão aqui é **como implementar a tela**, não quanto dela entregar.

| Alternativa | Fonte | Trade-off | Custo |
|---|---|---|---|
| **B1 — `ratatui` (tela cheia, widgets, immediate-mode)** | S4 | Rendimento rico, layout/estilos prontos, `run`/`restore`. Contra: **S4 declara que a crate não inclui input handling** — exige backend de evento; muda o formato do transcript (SI-4) e cria dois caminhos de tela (TTY full-screen × pipe) para manter | + backend (crossterm) e ciclo draw/evento; testes de tela precisam de terminal emulado; risco alto de divergência de prompt/default/range |
| **B2 — `inquire` / `dialoguer` (prompts interativos)** | S5, S6 | `Password`/`prompt_secret` (S5) e `Password` feature (S6) cobrem segredo sem eco; validadores/defaults embutidos. Contra: cada prompt renderiza o próprio desenho; os textos `[1/2]`, `[1-5]`, `(default: 1)`, `(q cancela)` do transcript arquivado tendem a mudar. **S5 registra risco real**: `SIGTERM` com prompt aberto pode deixar o terminal sem eco se a aplicação não registrar handler de restauração | 1–2 crates + backend de terminal; handler de sinal obrigatório; paridade de transcript renegociada (SI-6) |
| **B3 — line-based explícito: `std::io` + `IsTerminal` + `readpass` no segredo** | S10, S11; lastro local `install.mjs:1893` (`createLineReader`) e transcript arquivado | Mantém os prompts do oráculo e o canal `terminal:false` sem dependência de renderizador; 10 telas passam a existir como **modelo declarado** (5 campos de PRD §3.7 por tela), não como widget. Contra: "parece menos UI" para quem espera tela cheia; exige transcript novo comparável e estados escritos à mão | Sem crate de TUI; 1 crate pequena para segredo (`readpass`); custo concentrado em descrever/verificar as 10 telas |

**Recomendação (ADR-004)**: **B3** — **critério**: 0 transição nova + prompts/defaults/ranges byte-comparáveis ao transcript (M-4/SI-4) + canal não-TTY idêntico + segredo sem eco. Se o owner exigir widgets visuais, B1/B2 entram como divergência declarada em §16 (SI-6), não como "detalhe de implementação".

## 4. Tema C — golden testing e paridade byte-a-byte (insumo do ADR-002)

| Alternativa | Fonte | Trade-off | Custo |
|---|---|---|---|
| **C1 — `insta` (`.snap`, `.snap.new`, `cargo insta review`)** | S7 | Review visual do diff, inline snapshots, seção de CLI testing. Contra: S8 classifica saved master como **validated** ou **unvalidated** — reviewer aceitar `.snap.new` errado transforma bug em baseline; exige disciplina de "validated master" | Cargo tool (`cargo-insta`) + etapa humana de review por mudança |
| **C2 — baseline literal congelado + `assert_eq` (**padrão da casa**)** | S8 + local `golden.spec.mjs:50` / `eixos-stack.spec.mjs:39` | Oráculo externo ao sujeito; `EXPECTED_STACKS` literal quebra a guarda tautológica registrada no PRD §3.5. Contra: drift se o oráculo mudar; hoje cobre **9 byte-equal + 2 parciais**, não 12/12 (SI-1 é meta) | Manter arquivos literais; re-derivar baseline só com decisão §16 |
| **C3 — differential testing contra o Node congelado `c63e333`** | S8 ("Functional Equivalence" / "Independent Implementation") | Cobre os 12 presets, inclusive os 2 parciais, e todo o comportamento observável (config, payload, manifesto, transcript). Contra: S8 alerta que oráculo complexo pode ter os próprios bugs e ser mais caro que o sujeito; exige manter o `.mjs` executável durante a migração | Manter runtime Node na suíte de paridade; tempo de execução por preset |

**Recomendação (ADR-002)**: **C2 + C3 como par obrigatório**; **C1 opcional apenas como ferramenta de revisão de diff**, nunca como autoridade. **Critério**: nenhum oráculo pode derivar do código Rust sob teste (anti-tautologia R1) e a prova precisa cobrir 12/12 — os 9 byte-equal atuais mais os 2 parciais via differential. Número publicado só é fato se re-derivável (M-10).

## 5. Tema D — subprocesso como contrato (insumo do ADR-001)

> Alternativa "FFI / duas bibliotecas convivendo" **não está em disputa**: D1 fechou subprocesso/CLI, sem FFI e sem dois motores (PRD §16). Não é reaberta.

| Alternativa | Fonte | Trade-off | Custo |
|---|---|---|---|
| **D1 — argv fixo + stdout (resultado estruturado) + stderr (progresso/erro) + códigos de saída** | S9 | `Command` permite separar `stdout`/`stderr` e inspecionar `ExitStatus` (S9), inclusive termine por sinal. Contra: segredo **nunca** pode ir em argv (argv é visível); exige schema de saída versionado | Definir e congelar schema de contrato + tabela de códigos de saída |
| **D2 — stdin/pipe + `--answers-file`, com detecção TTY** | S9, S10 | `IsTerminal` (S10) resolve TTY vs pipe/redirect exatamente como o instalador atual (`terminal:true/false`); `output()` não herda stdin (S9) — o adapter Node precisa declarar `Stdio` explicitamente. Contra: exige protocolo de aborto (`q`/EOF) com 0 writes | Adapter por consumidor + teste de pipe/TTY; nenhuma crate extra |

**Recomendação (ADR-001)**: **D2 com D1 por cima** — resposta estruturada em stdout, progresso/erro em stderr, códigos de saída estáveis, segredo só por stdin/arquivo de respostas, `IsTerminal` para escolher prompt. **Critério**: 22/22 consumidores com veredito (M-6), 75 exports com destino, `gate.js` com 0 referência ao instalador, segredo ausente de argv/stdout e aborto com 0 writes. Cancelamento precisa de mapeamento explícito para `ExitStatus` (S9 documenta sinal como status, não erro de spawn).

## 6. Tema E — publicação/runtime sem toolchain no destino (insumo do ADR-005)

| Alternativa | Fonte | Trade-off | Custo |
|---|---|---|---|
| **E1 — pacote npm wrapper + `optionalDependencies` por `os`/`cpu`/`libc`, binário em `bin`** | S12 | O destino já tem Node≥20 (D7) e não instala Rust; npm ignora plataformas incompatíveis. Contra: S12 é explícito — "program's responsibility to handle the lack of the dependency": fallback de erro claro é obrigatório | Matriz de publicação por alvo; wrapper capaz de detectar ausência |
| **E2 — tarball único com `files`/`bundleDependencies` contendo os binários** | S12 | Um artefato, sem matriz de pacotes. Contra: baixa todos os alvos para todo mundo e `bundleDependencies` exige `npm pack`; pior para quem só usa um alvo | Tarball maior; gestão de versão dos binários encorporados |

**Recomendação (ADR-005)**: **E1**, com fallback explícito quando a dependência opcional faltar. **Critério**: nenhuma toolchain Rust no destino (D7), Node≥20 preservado, selo `c904f1c5` e `commands.suiteFull` inalterados (D6), suíte Rust rodando em comandos paralelos fora do selo. **Custo declarado**: a cobertura Rust fica fora da contraprova selada — o owner precisa aceitar isso no G2 (D6 já fechou "selo invariante").

---

## 7. Recomendação por ADR (uma linha + critério)

| ADR | Recomendação (1 linha) | Critério declarado | Fontes |
|---|---|---|---|
| **ADR-001** — fronteira subprocesso + contrato | Binário Rust invocado por subprocesso: `stdin`/`--answers-file` para dados e segredo, stdout estruturado, stderr para progresso/erro, códigos de saída estáveis, `IsTerminal` para TTY vs pipe | 22/22 consumidores com veredito, 75 exports com destino, `gate.js` 0 referência, segredo fora de argv/stdout, aborto com 0 writes | S9, S10, S11 |
| **ADR-002** — oráculo de paridade + golden | `EXPECTED_STACKS`/golden literais congelados **mais** differential contra o Node `c63e333`; `insta` só como revisor de diff | Oráculo externo ao sujeito (anti-tautologia R1), 9 byte-equal + 2 parciais hoje → 12/12 como meta re-derivável (M-10) | S7, S8 |
| **ADR-003** — motor `init`/`doctor`/`upgrade` | `clap` derive para os 4 entrypoints + `anyhow` no app e `thiserror` nos tipos de erro, com textos de usage/erro fixados contra o oráculo | Paridade observável nos 4 entrypoints (inclusive mensagem 4-linhas do `doctor`) com menor risco de parser do que código manual | S1, S2, S3 |
| **ADR-004** — TUI 10 telas | Modelo de 10 telas explícito (5 campos por tela) sobre `std::io` + `IsTerminal` + `readpass`, sem renderizador de widgets | 0 transição nova, transcript `[1/2]`/`[1-5]`/`(default: 1)`/(`q cancela`) comparável, canal não-TTY idêntico, segredo sem eco | S4, S5, S6, S10, S11 |
| **ADR-005** — publicação/runtime/selo | Wrapper npm com `optionalDependencies` por os/cpu/libc e fallback se binário ausente; suíte Rust em comandos paralelos, selo `c904f1c5` intacto | D7 (sem toolchain no destino, Node≥20) + D6 (selo invariante) com custo de cobertura paralela não selada aceito | S12 |

## 8. Riscos que o owner precisa saber antes do G2

1. **Versões de crate não são decisão do repo.** S1–S6/S11 mostram versões publicadas em 2026-11-16; não existe `Cargo.toml` (PRD M7). O ADR deve escolher **critério de seleção**, não congelar número lido de docs.rs como se fosse pin do projeto.
2. **Cobertura Rust fora do selo (D6).** Selo `c904f1c5` cobre apenas as 4 etapas Node de `harness.config.json:14`. Rodar a suíte Rust "em comandos paralelos" mantém M-8 verde, mas a paridade Rust não entra na contraprova selada — é custo aceito, não invenção.
3. **Oráculo físico.** `c63e333` é ancestral do HEAD atual (`5025721`, branch `prd/prd-installer-rust`); o número congelado está disponível. O ADR-002 precisa dizer **onde** o `.mjs` oráculo vive durante o SDD sem alterar `gate.js`, `harness.config.json` nem o selo.
4. **9 + 2 ≠ 12.** SI-1/SI-3 hoje são 9 byte-equal + 2 com asserts parciais e dry-run medido em 2 presets. "12/12" é meta; qualquer relatório que o apresente como fato medido é drift.
5. **Transcript é oráculo de tela.** B1/B2 (S4/S5/S6) tendem a alterar prompts/defaults/ranges; S5 documenta risco de terminal sem eco após `SIGTERM`. Mesmo com a recomendação B3, o ADR-004 deve fixar cleanup de terminal e regenerar o transcript com aprovação §16.
6. **Snapshot aceito pode virar bug validado.** S7 viabiliza o review, S8 classifica saved master não validado como risco real. O ADR-002 precisa exigir validação humana do baseline literal, não apenas `cargo insta accept`.
7. **Fronteira de 22 consumidores não se resolve sozinha.** D1 fechou "subprocesso"; ainda faltam os 22 vereditos de M-6 e a preservação da injeção dos 6 mapas em `scripts/static-checks.mjs:81`. A recomendação D2 não substitui essa tarefa.

## 9. Limites desta pesquisa

- 12 fontes, 12 abertas, 0 inacessíveis; nenhuma afirmação acima depende de página não aberta.
- Nenhuma versão de crate, comando ou comportamento do instalador foi inventado: números de crate vêm de docs.rs em 2026-11-16; números do instalador vêm do PRD §3.6 (M1–M9) e das leituras locais citadas.
- Recomendações não são decisões. O fatiamento de 5 ADRs é o de D8/PRD §16; nenhum sexto ADR é proposto.
