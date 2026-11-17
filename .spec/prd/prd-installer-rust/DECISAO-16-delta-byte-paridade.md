# Decisão §16 — aceite do delta de byte-paridade dos 10 D-ENGINE

- **prd-id**: `prd-installer-rust` (PRD-3, concluído 5/5 ADRs em `1fe22cd`)
- **data**: 2026-11-17
- **dono da decisão**: owner do harness (decisão explícita: "aceitar o delta")
- **natureza**: ratificação de exceção — **não** é quitação de dívida, **não** reabre ADR-001/003/004/005

## 1. Regra violada (nomeada, com caminho)

**D1 — "nenhum segundo motor"** (`.agents/rules/prd-adr-pipeline.md` §3 / `PRD.md` §16-D1 / ADR-001 §16). O `.mjs vivo` fora do caminho de instalação é proibido; a única ponte autorizada (`export … from './install.mjs'`) expirava no merge do ADR-003, foi parcialmente quitada no ADR-004 e **permanece** em `installer/installer-contract.mjs:57-58` com 10 nomes D-ENGINE.

## 2. Caminho permitido oferecido (e não escolhido)

`byte-paridade no Rust`: reescrever a serialização dos 10 ops para produzir o mesmo `JSON.stringify` byte-a-byte do oráculo `c63e333`, sem tocar specs congeladas. Owner escolheu o outro caminho: **aceitar a divergência como delta declarado**.

## 3. O que é aceito (medido, não deduzido)

| Fato | Medição |
|---|---|
| Divergência | **somente ordem de chaves** de `JSON.stringify` — `sideCanon:true`, `sideBytes:false` nos 10 ops (revalidado pelo reviewer com placeholders interpolados) |
| Conteúdo | **idêntico** ao oráculo — nenhuma divergência de valor, `ok`, `exit-code` ou marcação de tela |
| Nomes na ponte | `runCli`, `runDoctor`, `runInit`, `runUpgrade`, `runWizard`, `collectAnswers`, `generateConfig`, `planMerge`, `runChecks`, `main` |
| Efeito no selo | **nenhum** — `c904f1c5` byte-idêntico; Rust/differential continuam fora da contraprova (D6) |
| Efeito no oráculo | **nenhum** — `c63e333` em worktree `detach` continua sendo a garantia de não-regressão do binário (ADR-005 §2.5) |

## 4. Escopo da exceção (declarado)

- **Autorizado**: os 10 nomes acima permaneçam reexportados de `install.mjs` em `installer/installer-contract.mjs:57-58`.
- **Não autorizado**: acrescentar qualquer 11º nome; usar a ponte para novos preset/chave/comando/default; mover a exceção para outro arquivo; tratar o delta como equivalência byte-a-byte.
- **Expiração**: nunca por herança. Só nova decisão §16 do owner pode reverter ou ampliar.
- **Status dos overrides**: `D1-two-motors` → `delta_aceito_owner_2026_11_17`; `D1-two-motors-restante` → `delta_aceito_owner_2026_11_17` (10 nomes, sem prazo).
- **Follow-up**: `FU-D1-ENGINE10` marcado `resolvido_por_decisao_owner` (não por código).

## 5. Por que isto não é "dois motores"

Motor = o que decide e grava a instalação. Há **um**: o binário Rust via `contract-v1`. Os 10 nomes reexportados são funções **puramente de leitura/formatação** do oráculo congelado, usadas pelas specs congeladas que comparam byte a byte. Nenhuma delas decide, grava ou é chamada pelo caminho de instalação do adotante (o pacote npm não embarca `install.mjs` — ADR-005 RF-06). A exceção é de **ferramenta de prova**, não de motor de instalação.

## 6. Revalidação

Se qualquer um dos 10 nomes passar a divergir em **conteúdo** (não só ordem de chaves), ou se um 11º nome aparecer na ponte, a exceção é suspensa automaticamente e o caso volta ao owner. Comando de checagem: `node installer-rs/tests/prova-engine.mjs` + tabela `differentialTable` do REPORT ADR-003 (sha oráculo vs sha bin por op, com `canonicalJson`).
