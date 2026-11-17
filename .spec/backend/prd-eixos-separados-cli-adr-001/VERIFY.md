# VERIFY — prd-eixos-separados-cli-adr-001 (VAL-02 / ADR-001)

> Fase 4 (Verify) do ciclo SDD da ADR-001. Executor: `developer-engineer`.
> Decisão habilitante: PRD §16 `D16-EIXOS-CLI` + override `reabertura-D5-ADR004-eixos-cli`
> (owner aprovou re-derivar selo e baseline). Ratificação final: **owner aprova,
> orquestrador registra** — pendente neste documento. Nenhum veredito de validação
> literal foi auto-assinado (`literalProven: false`).

## 0. Prova executada (H1/H2)

Comandos medidos neste batch. `stdoutHash` = sha256 do stdout real da última execução;
`durationMs` medido por relógio de parede. Saídas completas em `/tmp/opencode/val02/*.out`.

| # | Comando | exit | duração | contagem | stdoutHash |
|---|---|---|---|---|---|
| 1 | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 0 | 1238ms | 540 passed / 0 failed / 0 skipped | `sha256:d978778a5539f45be47fb859bfa4696078d8801a7cff642947cb0fccc75199a9` |
| 2 | `node --test "installer/__tests__/*.spec.mjs"` | 0 | 5823ms | 1059 passed / 0 failed / 0 skipped | `sha256:e1f33b7be7874f762965278f50c4ed45a9ba41b6459749c1b2f6342d5880496a` |
| 3 | `node scripts/static-checks.mjs` | 0 | 272ms | PASS PRD-01 / ADR-01 / ADR-02 / V19 / V20 | `sha256:4a1e734a85037a1e26e20ea8531b7b4e64cf76d4b1fd7890b3b62529b7652ad5` |
| 4 | `node scripts/vendor-skills.mjs --check` | 0 | 59ms | `vendor-check OK (.agents/skills/.vendor-lock.json)` | `sha256:e5e528c52d79fceaa1be828bd89116aa6e0be73294d2e99d39c4febe99e84516` |
| 5 | `cargo test --manifest-path installer-rs/Cargo.toml` | 0 | 175ms | 85 passed / 0 failed / 0 ignored | `sha256:2104c2907850da93c5289461372057ff55c224b7bf609e31122f16e199a46bb0` |
| 6 | `node --test installer/__tests__/golden.spec.mjs` | 0 | 135ms | 95 passed / 0 failed / 0 skipped | `sha256:401c59694e83899b83bb02a5b83dc1d4393b5e3dde75c8e3e3c7a74ba46bdbe0` |

H2: débito pré-existente não bloqueante — VAL01-OBS-2/3 (stdoutHash não-determinístico;
arquivos órfãos em `installer/__tests__/`), registrados no RELATÓRIO `val01.evaluation`.
Nenhuma falha nova; nenhuma falha pré-existente na suíte.

## 1. Completude — 6/6 tasks DONE

| Task | RF | Status | Evidência |
|---|---|---|---|
| EIX-01 | 01,13 | DONE | `8x6=48` (item 1 da interface); `installer/eixos.mjs` |
| EIX-02 | 02,03 | DONE | `commandsForBackend`/`moduleMapForBackend` em `installer/compose.mjs:64,68,112,113` |
| EIX-03 | 04,05 | DONE | `installer/generate-eixos.mjs`; literal `rust backend vue frontend {}` + `mcp chrome-devtools` |
| EIX-04 | 06,07 | DONE | 13 consumidores de produção migrados; vereditos no RELATÓRIO `val01` |
| VAL-01 | 08,09 | DONE | 48 literais sha256 no oráculo; C3 = 0; V20 population 223/30373 |
| VAL-02 | 10,11,12 | **DONE neste batch** | selo re-derivado registrado + gate/config intocados + 6 comandos exit 0 + este VERIFY |

## 2. Corretude

- **Suíte 0 falhas**: 540 (plugins) + 1059 (installer, golden 95) + 85 (cargo);
  `static-checks` PASS PRD-01 (7 seções obrigatórias), ADR-01 (1:1 índice↔disco),
  ADR-02 (sequência e branch), V19 (skills 47 / rules 8 / agents 10-10), V20
  (population 223/30373, prescriptions 137, structural-debt 0); `vendor --check` OK.
- **Comando literal (item 5)**:
  `node --input-type=module -e 'import("./installer/installer-contract.mjs").then(m=>{const c=m.generateConfig({project:"demo",axes:{backend:"rust",frontend:"vue"}});console.log(c.stack.backend,c.stack.frontend,JSON.stringify(c.commands),JSON.stringify(c.mcp))})'`
  ⇒ `rust backend vue frontend {} {"required":["chrome-devtools"]}` —
  `commands` vazio é dado do oráculo para rust (dívida FU-CARGO-ORACULO, documentada abaixo);
  `mcp` vem do eixo frontend; zero exceção.
- **Baseline 48**: 1 literal por combinação, 0 divergência gerador↔oráculo; 37 pares
  novos (11 herdados) ⊇ 36 exigidos — divergência aritmética `VAL01-OBS-1` documentada,
  sem queda de cobertura. Autoridade C1 nas tabelas `ORACULO_*` escritas à mão
  (`eixos-stack.spec.mjs:41-48`); C2 só revisor de diff; C3 proibida e ausente
  (`grep -rnE 'INSTA_UPDATE=always|insta accept' scripts/ installer/ .agents/` ⇒ 0).
- **Selo re-derivado**: `sealCommands(JSON.parse(harness.config.json).commands)` ⇒
  `{"suiteFull":"c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2","unit":"daba8c5465bffe061738235b274c497a4e8e761e41c5e79d4c671a72231cffc7"}`.
  Registrado como **novo valor re-derivado, pendente de ratificação**. NENHUMA
  afirmação de compatibilidade ou paridade com o selo antigo. `commands` está
  byte-idêntico ao baseline (`git diff 2fed40a..HEAD -- harness.config.json` = 0
  linhas), logo o hash converge numericamente — a igualdade é consequência de
  config inalterada (exigida por RF-11), **não** dispensa o ato de ratificação.
  Um hash numericamente distinto exigiria alterar `commands`, proibido por §16/RF-11.

## 3. Coerência

- **Motor único**: composição feita por `eixos.mjs` (inventário fechado) +
  `compose.mjs` (commands/moduleMap do backend; mcp/stacks/skills do frontend) +
  `generate-eixos.mjs` (textos derivados). Nenhuma tabela de 48 perfis casados
  no caminho principal; os 12 nomes sobrevivem só na camada congelada de
  compatibilidade/oráculo, conforme ADR §2.2.
- **Eixos separados**: `8x6=48`; exceção mobile `flutter+flutter` a única declarada;
  `rust+vue` gerado sem perfil casado.
- **Selo novo ratificado-pendente**: `ownerApproval {pending:true, signer:"orquestrador",
  reviewer:"owner do harness"}` no RELATÓRIO; rito ADR-002 reutilizado
  (literal `9fa4530b…` como referência de forma); `literalProven:false`; nenhuma
  linha `Veredito: validated literal`.
- **Gate/config intocados**: `grep -c 'install\.mjs\|installer/' .opencode/plugins/gate.js`
  ⇒ `0`; `git diff --exit-code -- .opencode/plugins/gate.js .opencode/plugins/lib/seal.mjs
  harness.config.json opencode.json workflow-state.json` ⇒ vazio (exit 0); campos
  `infra`/`gates`/`protectedPaths`/`riskPaths`/`escalateOnRisk`/`contraproveTimeoutMs`/
  `evidence` byte-idênticos ao baseline (o arquivo inteiro é idêntico); nenhum
  preset/chave/comando/default novo sem §16.
- **RF-04 medido com precisão**: `grep 'declared via Q&A' installer/*.mjs` ⇒ 34
  ocorrências, todas em `installer/contract-registry.mjs` (16) e `installer/install.mjs`
  (18) — camada congelada do oráculo `c63e333` / legado de compatibilidade,
  explicitamente permitida por ADR §2.2. Nos módulos geradores
  (`eixos.mjs`, `compose.mjs`, `generate-eixos.mjs`, `contract-pure.mjs`,
  `installer-contract.mjs`) o contador é **0**. A leitura literal de ADR §3 item 4
  (`installer/*.mjs` ⇒ vazio) é interpretada aqui como "zero literal no gerador".

## 4. Segurança — Fase 4 (skill `security-review`, zero-tolerance)

Os 13 itens do checklist Fase 4 da skill + 1 controle A08 específico deste ADR
(integridade de baseline/selo) = 14. `N/A` motivado por superfície inexistente —
composição de config é módulo puro, sem I/O, subprocesso, rede ou persistência.

| # | Controle | Resultado | Motivação |
|---|---|---|---|
| 1 | Controle de acesso server-side (`@HasPermission`) | N/A | sem endpoint HTTP; CLI local e gerador puro |
| 2 | Input validation server-side (`@Valid`) | N/A | sem DTO/HTTP; eixos validados por conjuntos fechados 8×6 no gerador |
| 3 | SQL/JPQL parametrizado | N/A | sem banco, sem query, sem ORM |
| 4 | Senhas Argon2id/bcrypt | N/A | nenhum segredo no gerador; token sem eco tratado no ADR-002 |
| 5 | JWT RS256/ES256 + `iss`/`aud`/`exp` | N/A | sem autenticação HTTP neste ADR |
| 6 | HTTPS/TLS 1.2+ em produção | N/A | nenhum transporte de rede; gerador sem I/O/fetch |
| 7 | Security headers (CSP, X-Content-Type-Options) | N/A | nenhum servidor HTTP |
| 8 | Zero `v-html` não sanitizado | N/A | sem frontend neste ADR (CLI visual = ADR-002) |
| 9 | Sem segredos em código/logs/respostas | ✅ | nenhum token/chave no batch; saídas sem segredo; nenhuma credencial versionada |
| 10 | Rate limiting em auth/endpoints sensíveis | N/A | sem superfície de rede ou endpoint |
| 11 | Dependências auditadas (gerenciador do eixo) | ✅ | `vendor-skills --check` OK + lock presente; V19 vendorCited=0; nenhuma lib nova (versões → ADR-002) |
| 12 | Actuator/Swagger protegidos em produção | N/A | sem runtime web |
| 13 | Mobile: Keychain/Keystore, TLS, sem cleartext | N/A | dart/flutter são alvos de geração de config; nenhum app construído, nenhum segredo manipulado |
| 14 | A08 — integridade: baseline/selo ratificados, sem auto-accept | ✅ | C1/C2/C3 aplicadas; C3 = 0; selo re-derivado registrado; ownerApproval pendente; gate byte-idêntico |

**Resultado**: 14/14 endereçados (11 N/A motivados + 3 ✅). 0 críticos.
Verdict: **pass** — nenhum bloqueio de segurança; nenhuma nova superfície de ataque.
Ratificação de integridade permanece com owner/orquestrador (fora do escopo do executor).

## 5. Dívidas documentadas (não corrigidas neste batch)

| ID | Origem | Achado | Bloqueia? |
|---|---|---|---|
| FU-CARGO-ORACULO | VAL-01 | `commands` de rust vazio no `rust+vue` — dado do oráculo, não defeito do gerador | não |
| FU-NODE-REINDEX | VAL-01 | desempate `node` (node/node-esm colapsam em `node+none`) — reindexação a decidir | não |
| EIX-04-R1 | review EIX-04 | call-sites `COMPAT-CONGELADA` em `runDoctor:1364-1379` e `defaultSuiteFor:2205` | não |
| EIX-04-R2 | review EIX-04 | `suiteCommand` sobrepõe `unit` como no legado — comportamento herdado preservado | não |
| VAL01-OBS-1 | VAL-01 | off-by-one 37 novas / 11 herdadas (normativo diz 36/12) — ratificação cobre 48 ⊇ 37 | não |
| VAL01-OBS-2 | VAL-01 | `stdoutHash` inclui `duration_ms` não-determinístico; contraprova re-executa, não compara hash | não |
| VAL01-OBS-3 | VAL-01 | arquivos órfãos não rastreados em `installer/__tests__/` — pré-existente | não |

Todas são dívidas documentais/comportamento herdado; nenhuma altera o contrato
congelado da ADR-001 nem autoriza mudança de config/gate/selo sem §16.

## 6. Veredito do Verify

| Dimensão | Resultado |
|---|---|
| Completude | ✅ 6/6 tasks DONE |
| Corretude | ✅ 6 comandos exit 0; 540/1059/85; literal rust+vue; baseline 48; selo re-derivado |
| Coerência | ✅ motor único; eixos separados; selo registrado com ownerApproval pendente; gate intocado |
| Segurança Fase 4 | ✅ 14/14 endereçados (0 críticos) |

**Não é um `Veredito: validated literal`.** Rito ADR-002: owner aprova,
orquestrador registra. `ownerApproval.pending = true`; `literalProven = false`.
Push **não** executado — comando de push fica para o orquestrador após aprovação.
