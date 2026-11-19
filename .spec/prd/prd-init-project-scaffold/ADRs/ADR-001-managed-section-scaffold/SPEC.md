# SPEC — ADR-001: scaffold de identidade com seção gerenciada

Escopo: especificação **da decisão** em `ADR.md`, não do produto inteiro.
Entradas: `PRD.md` (aprovado), `RESEARCH.md`, `ADR.md` (interface congelada I1–I9), regras vivas e `scripts/harness-sync.mjs` atual.

## 1. Contexto e fronteira

- **Domínio**: bootstrap/instalação do harness (`harness-sync init|update|doctor`). Sem entidade de negócio, tenant, IAM ou eventos de domínio.
- **Problema**: o `init` v2 entrega governança, não identidade — `AGENTS.md` não está em `PAYLOAD_FILES`, `project-*.md` é preservado mas nunca criado, `DESIGN.md`/tokens só via `/ui-bootstrap` manual.
- **Fora**: configs de stack do consumidor; `--prune`; push/PR; alteração de regras do harness; migração automática de consumidores v1.

## 2. Invariantes

| ID | Invariante | Origem no ADR |
|---|---|---|
| INV-01 | Nenhum byte é escrito fora do alvo; toda escrita passa por `writeGuarded` | I7 |
| INV-02 | `AGENTS.md`/`DESIGN.md` nunca têm conteúdo do consumidor reescrito — só o `BLOCO` | I1/I2/I3 (14a) |
| INV-03 | Arquivos ANEXADOS nunca entram no manifesto nem no `doctor` | I4 (14c) |
| INV-04 | `preserved`/`divergent` nunca viram `update`; só `WARN` | I3/I6 |
| INV-05 | `malformed` ⇒ `exit 1`, zero escrita, zero backup | I2/I3/I6 |
| INV-06 | `--dry-run` imprime exatamente as linhas do apply, sem escrever | I6 |
| INV-07 | `nulo|nulo` sem flag ⇒ `exit 1` sem inventar `project-fullstack.md` | I5 (14b) |
| INV-08 | Prefixo de arquivo ANEXADO é byte-idêntico após o append | I2 |

## 3. Requisitos funcionais

| ID | Requisito (rastreável ao ADR) | Critério de aceite executável |
|---|---|---|
| RF-01 | Classificar cada path gerado como PRÓPRIO ou ANEXADO (I1) | Tabela de classes em `sync.spec.mjs` cobre os 5 paths PRÓPRIOS e os 2 ANEXADOS; nenhum outro path escrito |
| RF-02 | Gramática literal `OPEN`/`CLOSE` com linha exata, 1 par por arquivo, append no fim (I2) | `<!--harness:v2:start-->` (sem espaços) não é reconhecido; arquivo sem LF final ganha 1 LF antes de `OPEN`; prefixo byte-idêntico |
| RF-03 | Máquina de estados `created|appended|preserved|skip|divergent|malformed` por path (I3) | 6 estados exercitados em fixture; reexecução após `created`/`appended` ⇒ `skip` |
| RF-04 | PRÓPRIOS no manifesto com sha256; ANEXADOS fora (I4) | `readManifest` não contém `AGENTS.md`/`DESIGN.md`; `doctor` ignora edição manual deles e falha em PRÓPRIO corrompido |
| RF-05 | Resolver stack por `detectTargets` + `--frontend/--backend`, com mensagem literal em `nulo|nulo` (I5) | `node scripts/harness-sync.mjs init --target <t>` sem stack ⇒ exit 1 + mensagem exata de I5; com flag ⇒ artefato de stack correto |
| RF-06 | Relatório com linhas literais: stack, um estado por path, `WARN divergência`/`ERROR seção malformada`, resumo (I6) | Ordem determinística por path POSIX; `WARN` não muda exit; `ERROR` ⇒ exit 1; `--dry-run` produz as mesmas linhas |
| RF-07 | Toda escrita nova pela via única `writeGuarded` (I7) | Grep: nenhum `writeFileSync` fora de `writeAtomic`; mutação que remove guard derruba teste |
| RF-08 | Templates de `DESIGN.md`/tokens vêm só da skill `design-system` (I8) | Nenhum hex/fonte literal no gerador; perfil `shadcn|claude` não é decidido por palpite |
| RF-09 | Clean-room estendido A1..A7 + 6 cenários do PRD §10 (I9) | Fixture sem `AGENTS.md` ⇒ 3 artefatos; 2º run 0 writes; fixture com `AGENTS.md` ⇒ original byte-idêntico + 1 bloco; `doctor` 0 |

## 4. Requisitos não-funcionais

| ID | Requisito | Critério |
|---|---|---|
| NFR-01 | Zero rede; somente `node:fs`/`path`/`crypto` + `git rev-parse` local | `NET-01` existente continua verde |
| NFR-02 | Idempotência: 2ª execução = 0 writes e nenhum backup novo | teste de 2º run em fixture |
| NFR-03 | `commands.suiteFull` continua sendo a contraprova — "doctor verde" não prova operabilidade | aceite não pode substituir suiteFull |
| NFR-04 | Se `commands.suiteFull` mudar, reexportar `HARNESS_SEAL_JSON` | nota em `docs/ref/sync.md`; nenhuma mudança de comando nesta ADR |

## 5. Estratégia de testes

- **Unitário** (`scripts/__tests__/sync.spec.mjs`, `acceptance-clean-room.spec.mjs`): gramática do marcador, 6 estados, manifesto, flags, relatório, mutações.
- **Integração/clean-room** (`scripts/acceptance-clean-room.mjs`): A1 bootstrap + A8..A13 (novos cenários) sobre tmpdirs, sem rede/porta/LLM.
- **Contraprova**: `commands.suiteFull` inalterado nesta ADR; gate de `Completed` continua comparando selo.

## 6. Delta Specs (docs vivos)

| Doc | Operação | Conteúdo |
|---|---|---|
| `docs/ref/sync.md` | MODIFIED | seção "Geração de identidade do projeto": classes PRÓPRIA/ANEXADA, marcadores, flags, estados e relatório |
| `README.md` | MODIFIED | `init` agora cria identidade; `--frontend/--backend` |
| `.opencode/commands/harness-init.md` | MODIFIED | passo extra: revisar plano de identidade e o relatório de estados |
| `.agents/rules/harness-config.md` | MODIFIED | ANEXADOS fora do manifesto; `project-*.md` passa a ser criável quando ausente |

## 7. Checklist do spec-gate (item → veredito)

- ADRs (decisão com porquê): ✅ `ADR.md` + este documento.
- DDD modular: N/A — ferramenta de bootstrap, sem camadas api/impl/public.
- Segurança/IAM: N/A — nenhum endpoint, papel ou permissão nova; escrita limitada ao alvo (INV-01).
- ERD: N/A — sem entidade persistida (arquivos são artefatos, não modelo de dados).
- Event Registry: N/A — nenhum evento de domínio.
- Migrations: N/A — sem banco.
- Invariantes de entidade: ✅ INV-01..INV-08 acima.
- Invariantes de workflow: ✅ máquina de estados I3 + regras de transição.
- Test Strategy: ✅ seção 5.
- Single file: ✅ este arquivo é a SPEC do ADR.
- Domínio claro: ✅ bootstrap/instalação do harness.

Score: 6/6 aplicáveis = **100%** (11 itens no gate, 5 `N/A` com motivo: DDD, IAM, ERD, Event Registry, Migrations — nenhum gap 🔴/🟠 aberto).
