# PRD — Init que entrega a identidade do projeto

> **prd-id**: `prd-init-project-scaffold` (casa com `.spec/prd/prd-init-project-scaffold/`)
> **Dono da aprovação**: owner do harness
> **Status**: rascunho — aguarda veredito humano em §16. Nenhum `RESEARCH.md`, `ADR-INDEX.md` ou `ADRs/**` pode nascer antes disso (INV-3, `.agents/rules/prd-adr-pipeline.md` §1).
> **Mapa das 16 seções**: obrigatórias §1, §2, §5, §6, §7, §9, §16; demais recomendadas.
> **Convenção de verdade**: toda frase que nomeia mecanismo cita o símbolo/caminho que o sustenta (DOC-01). O que não existe hoje está marcado como **REQUISITO a implementar**, nunca como feature atual.

## 1. Problema [obrigatória]
`init` v2 entrega a governança, não a identidade do projeto. `scripts/harness-sync.mjs` copia `PAYLOAD_FILES` (`:145-149`) e as árvores de payload, detecta `targets`/`commands` (`:417-445`) e gera `harness.config.json` + manifesto — mas `AGENTS.md` não está no payload, `.agents/rules/project-*.md` é preservado e **nunca criado** (`:159`, `:25-31`), e não há geração de `DESIGN.md`/tokens nem de configs de stack. Operador monta os três artefatos na mão, com conteúdo divergente entre projetos; quando tenta automatizar, arrisca sobrescrever `AGENTS.md`/`DESIGN.md` vivos do consumidor.
> ❓ Validação: o problema existe hoje e é verificável no código? **Sim** — `PAYLOAD_FILES` e `PRESERVED_RES` acima.

## 2. Objetivo [obrigatória]
Fazer o `init` entregar, além da governança, a **identidade mínima do projeto**: detecção de stack + geração de `AGENTS.md` (seção gerenciada), `.agents/rules/project-{stack}.md` e `DESIGN.md`+tokens a partir dos templates do skill `design-system`, sem sobrescrever arquivo existente. Resultado observável: projeto recém-inicializado sai do `init` com os três artefatos e relatório do que foi criado/anexado/preservado; segundo `init`/`update` é idempotente; `doctor` continua verde.
> ❓ Validação: objetivo é mensurável e não descreve solução técnica? **Sim** — medido pelos seis cenários do clean-room (§10).

## 3. Contexto e evidências
- Estado atual medido: `PAYLOAD_FILES = [scripts/harness-sync.mjs, scripts/seal.mjs, opencode.json]` (`:145`); `PRESERVED_RES = [/^\.agents\/rules\/project-[^/]*\.md$/]` (`:159`); `detectTargets` produz `frontend: react|vue|null`, `backend: java|rust|nestjs|node|null` (`:417-437`); flags atuais são só `--target`, `--dry-run`, `--suite`, `--unit`, `--backup-dir` (`:10-12`, `:1018`) — **`--frontend`/`--backend` não existem hoje**.
- Decisões do owner (6/6 afirmados): Q1=A (varredura ou flags explícitas geram os 3 artefatos); Q2=A (nunca sobrescrever `AGENTS.md`/`DESIGN.md`: anexar seção `<!-- harness:v2 -->` e reportar); Q3=sim (aceite = clean-room estendido).
- Regras vivas: `.agents/rules/harness-config.md` (init/update/doctor, preservação de dados do projeto, config nunca reescrito), `.agents/rules/prd-adr-pipeline.md` (1 ADR = 1 PR), `.agents/rules/always-on.md` (§3/§5).
- Lições do Brain (não repetir): `regras/global/harness/installer-nao-valida-operabilidade` — instalador que só checa JSON/manifesto pode assinar instalação quebrada; aceite exige executar a auto-suite no destino, não só `doctor` verde. `regras/projetos/atlas-ecm/prosa-regra-nao-promete-mecanismo-ausente` — prosa que promete mecanismo ausente é defeito; daí a distinção **estado atual vs REQUISITO** neste PRD.
- Garantias reutilizáveis já medidas: via única `writeGuarded` (`:527`, G10 em `:67`), manifesto `.harness-manifest.json` com sha256, backup fora do alvo, symlink guard, `--dry-run` com o mesmo guard do apply, zero rede (`harness-config.md` §"Sincronizador de payload (v2/F1)"; `scripts/harness-sync.mjs` G1–G7).

## 4. Público e impacto
- **Operador que instala o harness em repo existente** — deixa de montar identidade na mão; ganha plano `--dry-run` idêntico ao apply.
- **Maintainer do projeto consumidor** — mantém seu `AGENTS.md`/`DESIGN.md` intactos; ganha governança coerente sem perda de conteúdo.
- **Arquiteto que revisa governança** — ganha artefato inspecionável (seção marcada + manifesto + relatório) para julgar o que foi gerado.
- Impacto: menos divergência entre projetos; risco de sobrescrita cai a zero por construção, não por convenção.

## 5. Métricas de sucesso [obrigatória]
| Métrica | Como medir | Meta |
|---|---|---|
| MS-1 Artefatos gerados | clean-room: fixture sem `AGENTS.md` ⇒ 3 artefatos existem no destino pós-`init` | 100% dos fixtures |
| MS-2 Não-sobrescrita | clean-room: fixture com `AGENTS.md`/`DESIGN.md` pré-existentes ⇒ sha256 do original intacto; seção `<!-- harness:v2 -->` uma vez | 0 bytes alterados |
| MS-3 Idempotência | 2º `init`/`update` no mesmo alvo ⇒ 0 writes no plano | 0 writes |
| MS-4 Doctor | `doctor --target` pós-init sai 0; manifesto recomputa os novos artefatos | exit 0 |
| MS-5 Operabilidade | auto-suite do destino (`commands.suiteFull`) verde após o init | 0 falhas |
| MS-6 Plano = apply | `--dry-run` e apply produzem o mesmo conjunto `{create|appended|preserved|skip}` | 100% de igualdade |
> ❓ Validação: ao menos uma métrica tem "como medir" preenchida? **Sim** — todas as seis.

## 6. Escopo [obrigatória]
- **Varredura + flags**: detectar stack por `package.json`/`pom.xml`/`Cargo.toml` reaproveitando `detectTargets` (`:417`); `--frontend`/`--backend` explícitos **sobrepõem** a detecção — ambas as vias **REQUISITO a implementar** (flags hoje inexistentes).
- **Geração** (REQUISITO): (a) `AGENTS.md` na raiz com seção gerenciada delimitada por `<!-- harness:v2 -->`; (b) `.agents/rules/project-{frontend|backend|fullstack}.md`; (c) `DESIGN.md` + tokens a partir dos templates do skill `design-system`.
- **Não-sobrescrita** (REQUISITO): arquivo existente ⇒ anexar seção demarcada ao final, nunca substituir; reportar `created|appended|preserved` por path.
- **Manifesto/doctor** (REQUISITO): novos artefatos entram no manifesto com sha256; `doctor` recompute e falha em divergência/symlink, mantendo o contrato atual.
- **Selo/contraprova** (REQUISITO se `commands.suiteFull` mudar): recalcular selo conforme `harness-config.md` §"Command seal (ADR-002, U6=b)"; contraprova = auto-suite do destino, nunca "só doctor verde".
- **Aceite**: estender o clean-room (`scripts/acceptance-clean-room.mjs`) com os seis cenários de §10, integrados ao `commands.suiteFull`.
> ❓ Validação: escopo fechado o bastante para caber em ADRs? **Sim** — cada item vira no máximo 1 ADR; teto de 5 (`.agents/rules/prd-adr-pipeline.md` §3).

## 7. NÃO entra [obrigatória]
- **Sobrescrever `AGENTS.md`/`DESIGN.md` existentes** — Q2=A; apagar conteúdo do consumidor é o defeito que este PRD evita.
- **Editar configs de stack do projeto** (eslint, tsconfig, `pom.xml`, `Cargo.toml`, `package.json` etc.) — leitura para detecção, nunca escrita.
- **`--prune` / remoção de órfãos** — contrato atual de `update` reporta `orphan ... (não removido)`; remoção é decisão humana (`harness-config.md`, linha do `update`).
- **Push/PR automático** — merge é humano (`.agents/rules/prd-adr-pipeline.md` §4).
- **Mudar regras do harness em si** (`.agents/rules/**`, payload, gates) — ciclo distinto; aqui só se consome o contrato existente.
- **Migrar consumidores automaticamente** — nenhum `update` reescreve artefato de identidade já editado sem decisão explícita (contrato em §14).
> ❓ Validação: o que não entra está declarado, não inferido? **Sim** — seis itens explícitos.

## 8. Riscos e mitigação
- **Conflito com `AGENTS.md` rico do projeto**: anexar seção demarcada no fim e exigir ocorrência única de `<!-- harness:v2 -->`; nunca reordenar o conteúdo original. Medido por MS-2.
- **Falsa detecção de stack**: `--frontend`/`--backend` sobrepõem a varredura; sem sinal, exigir flag em vez de inventar identidade (§14-b).
- **Seção marcada editada e reescrita no `update`**: contrato proposto — `update` **preserva** a seção existente; divergência é reportada, nunca sobrescrita (§14-a).
- **Apagar órfãos por acidente**: nenhum `--prune`; `doctor` continua FAIL em arquivo do manifesto ausente/divergente, o que impede "limpeza" silenciosa.
- **Instalação que passa no doctor mas não opera**: MS-5 executa a auto-suite no destino (lição `installer-nao-valida-operabilidade`).
- **Prosa prometendo mecanismo ausente**: §3 separa estado atual de REQUISITO; todo RF dependente de código novo está marcado (lição `prosa-regra-nao-promete-mecanismo-ausente`).

## 9. Requisitos funcionais [obrigatória]
- **RF-01** *(REQUISITO)*: `init` varre o alvo reaproveitando `detectTargets` e aceita `--frontend`/`--backend` como sobreposição explícita; a origem da decisão (`detectada|flag`) aparece no relatório.
- **RF-02** *(REQUISITO)*: `init` gera `AGENTS.md` raiz com seção gerenciada delimitada por `<!-- harness:v2 -->`, sem tocar no conteúdo pré-existente.
- **RF-03** *(REQUISITO)*: `init` gera `.agents/rules/project-{frontend|backend|fullstack}.md` conforme a stack resolvida; se já existir, reporta `preserved` e não escreve (contrato G3 de `harness-sync.mjs`).
- **RF-04** *(REQUISITO)*: `init` gera `DESIGN.md` + tokens a partir dos templates do skill `design-system`; arquivo existente ⇒ anexo demarcado, nunca substituição.
- **RF-05** *(REQUISITO)*: cada path novo é escrito pela via única guardada e atômica `writeGuarded` (`:527`, G10), com symlink guard e backup fora do alvo antes da primeira escrita; o manifesto é o último write.
- **RF-06** *(REQUISITO)*: `--dry-run` imprime o mesmo plano do apply e não escreve nem cria backup.
- **RF-07** *(REQUISITO)*: manifesto registra sha256 dos novos artefatos; `doctor` recompute e falha em divergência, ausência ou symlink, exit 0 quando íntegro.
- **RF-08** *(REQUISITO se `commands.suiteFull` mudar)*: selo de comandos recalculado e contraprova = auto-suite do destino verde, registrada no relatório; nunca "só doctor verde".
- **RF-09** *(REQUISITO)*: relatório final lista `created|appended|preserved` por path e a origem da stack; 2ª execução produz 0 writes.
> ❓ Validação: cada requisito é verificável por teste? **Sim** — RF-01..RF-09 mapeiam para MS-1..MS-6 e para os cenários de §10.

## 10. Histórias de usuário (critérios de aceite BDD)
- Dado um fixture limpo sem `AGENTS.md` e com `package.json` contendo `react`, Quando o operador roda `init --target <dir>`, Então são criados `AGENTS.md` com seção `<!-- harness:v2 -->`, `.agents/rules/project-frontend.md` e `DESIGN.md`+tokens, e o relatório marca os três como `created` com origem `detectada`.
- Dado o mesmo fixture já inicializado, Quando o operador roda `init` ou `update` novamente, Então o plano reporta `skip` para os três artefatos, 0 writes ocorrem e o manifesto permanece byte-igual.
- Dado um fixture com `AGENTS.md` e `DESIGN.md` pré-existentes e conteúdo próprio, Quando o operador roda `init`, Então o sha256 do conteúdo original permanece idêntico, exatamente uma seção `<!-- harness:v2 -->` é anexada a cada arquivo e o relatório marca `appended`.
- Dado um alvo com `.agents/rules/project-backend.md` já escrito pelo maintainer, Quando o operador roda `init` com stack detectada `java`, Então o arquivo é reportado como `preserved`, nenhum byte é alterado e o `doctor` sai 0.
- Dado um `init` concluído nos cenários acima, Quando o operador roda `doctor --target <dir>`, Então todos os sha256 do manifesto recomputam iguais, arquivo ausente/divergente ou symlink falha com exit 1 nomeando o path e a auto-suite (`commands.suiteFull`) roda verde.
- Dado um operador passando `--frontend vue --backend java` sobre um fixture sem sinal de stack, Quando roda `init --dry-run`, Então o plano mostra a criação de `project-fullstack.md` com origem `flag` e nenhum arquivo é escrito.
> ❓ Validação: os critérios são BDD executáveis no clean-room? **Sim** — seis cenários (4 do Q3 + idempotência + doctor/flags).

## 11. UX / experiência
Fluxo: `init --target <dir> [--frontend … --backend …] [--dry-run]` → varredura + resolução da stack → plano `create|appended|preserved|skip` → (confirmação nos comandos `/harness-init`) → escrita guardada → manifesto → relatório → `doctor`. Estados: plano seco (sem escrita), criado, anexado, preservado, órfão reportado (não removido), divergência de manifesto (FAIL com path). Nenhuma pergunta de perfil/wizard; a superfície do agente permanece curta (`.opencode/commands/harness-init.md`, ≤40 linhas).

## 12. Dependências
- `scripts/harness-sync.mjs`: reaproveitar `detectTargets`, `writeGuarded`, backup, manifesto e guards; alterar `PRESERVED_RES`/`PAYLOAD_FILES` só via ADR (G3 hoje proíbe escrever `project-*.md` — este PRD propõe mudar esse contrato, não finge que ele já existe).
- skill `design-system` (templates de `DESIGN.md`/tokens) — única fonte dos templates; nenhum token inventado.
- `.opencode/commands/harness-init.md`/`update`/`doctor` — superfície do agente; contrato de ≤40 linhas, sem vocabulário de wizard.
- `scripts/acceptance-clean-room.mjs` + `commands.suiteFull` — onde os cenários entram; se o comando mudar, regenerar selo (RF-08).

## 13. Segurança
- Superfície nova: escrita de três artefatos no alvo. Mitigação: via única `writeGuarded`, symlink guard em cada componente, backup fora do alvo, `target` ≠ fonte, zero rede (G5–G7, G10 de `harness-sync.mjs`).
- `AGENTS.md` e `DESIGN.md` são conteúdo de confiança do consumidor: não sobrescrever, não reordenar, não interpretar; anexo demarcado é a única mutação permitida.
- Nenhum segredo em `DESIGN.md`/tokens gerados; templates do skill `design-system` são a única fonte.

## 14. Perguntas abertas
- (a) `update` × seção editada: preservar sempre a seção `<!-- harness:v2 -->` mesmo divergente do template, ou reportar divergência e exigir decisão humana? Recomendação do PM: **preservar + reportar divergência**, nunca reescrever (alinha Q2=A). Decisão final: owner/arquiteto no ADR.
  - **DECIDIDO (owner, 2026-11-18)**: preservar + reportar divergência, nunca reescrever.
- (b) Stack indeterminada (sem `package.json`/`pom.xml`/`Cargo.toml` e sem flags): gerar `project-fullstack.md` ou exigir flag? Recomendação do PM: **exigir flag**, para não inventar identidade.
  - **DECIDIDO (owner, 2026-11-18)**: exigir flag.
- (c) Manifestos: `AGENTS.md`/`DESIGN.md` anexados entram no manifesto com sha256 do arquivo todo? Se entrarem, edição manual do operador fará `doctor` FAIL — definir se cobre só a seção gerenciada (exige mecanismo novo) ou se o arquivo fica fora do manifesto. Recomendação do PM: **fora do manifesto**, para não transformar edição legítima em falha de integridade.
  - **DECIDIDO (owner, 2026-11-18)**: fora do manifesto.

## 15. PICCO (prompt da demanda)
<task>Entregar `.spec/prd/prd-init-project-scaffold/PRD.md` (16 seções; 7 obrigatórias conforme `.agents/rules/prd-adr-pipeline.md`) para o produto "init que entrega a identidade do projeto": problemas, usuários, escopo, restrições, RFs numerados e critérios de aceite BDD executáveis no clean-room. Não escrever RESEARCH/ADR/SPEC/TASKS.</task>
<context>Repo `harness`, branch `prd/prd-init-project-scaffold`. Estado atual medido: `scripts/harness-sync.mjs init` copia payload fixo, detecta `targets`/`commands`, gera config+manifesto; não cria `AGENTS.md` (fora de `PAYLOAD_FILES`), não gera `.agents/rules/project-*.md` (preservados, nunca criados), não gera `DESIGN.md`/tokens. Decisões do owner 6/6: Q1=A (varredura + flags geram os 3 artefatos), Q2=A (nunca sobrescrever; anexar `<!-- harness:v2 -->` e reportar), Q3=sim (clean-room estendido: gera tudo / idempotente / anexa sem alterar original / doctor verde). Regras vivas: `.agents/rules/prd-adr-pipeline.md`, `harness-config.md`, `workflow.md`, `always-on.md`. Lições: "installer não valida operabilidade" e "prosa que promete mecanismo ausente" — não repetir.</context>

## 16. Aprovação [obrigatória]
> **BLOCO DE APROVAÇÃO HUMANA — APROVADO PELO OWNER.** Decisões §14 registradas abaixo; a esteira RESEARCH → ADR está liberada (INV-3, `.agents/rules/prd-adr-pipeline.md` §1).
- **Veredito**: APROVADO.
- **Data**: 2026-11-18 (aprovação explícita do owner, após 3 decisões de §14).
- **Aprovador**: joao.
- **Decisões §14**: (a) preservar seção `<!-- harness:v2 -->` editada + reportar divergência, nunca reescrever; (b) stack indeterminada sem flags ⇒ exigir flag; (c) `AGENTS.md`/`DESIGN.md` anexados ficam FORA do manifesto.
- **Nota**: preencher veredito, data e aprovador no ato da decisão; as três perguntas de §14 são entrada obrigatória do RESEARCH.
> ❓ Validação: existe aprovação registrada antes de qualquer ADR? **Sim** — veredito APROVADO em §16; RESEARCH/ADR liberados.
