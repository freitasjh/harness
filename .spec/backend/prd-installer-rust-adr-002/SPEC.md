# SPEC — prd-installer-rust-adr-002

> Prescritivo. Origem: `ADR-002` §3 (15 itens). Em conflito, o ADR prevalece.

## 1. Requisitos funcionais

- **RF-01 (item 1)** — literais de `golden.spec.mjs`, `eixos-stack.spec.mjs` e transcript **inalterados**: `git diff --exit-code` vazio.
- **RF-02 (item 2)** — oráculo físico imutável: SHA `c63e333…` + `status --porcelain` vazio antes de cada corrida.
- **RF-03 (itens 3, 12)** — rito de validação humana: `Veredito: validated literal <sha256> <ISO-8601> <oráculo>` em `harness/<demand>.json`; sem assinatura, asserção dependente não conta como prova; `cargo insta accept` proibido.
- **RF-04 (item 4)** — SI-1: chaves+valores de config byte-equal (9+2 hoje, 12/12 meta) com `node --test .../golden.spec.mjs` + `diff`.
- **RF-05 (item 5)** — SI-2: caminhos+bodies do payload idênticos por `diff -u <(oráculo | sort | sha256sum) <(binário | sort | sha256sum)`.
- **RF-06 (item 6)** — SI-3: dry-run 0 writes por hash de árvore antes=depois + `git status --porcelain`.
- **RF-07 (item 7)** — SI-4: transcript W0..W7/W2m com os 5 marcadores e `diff -u`.
- **RF-08 (item 8)** — SI-5: checks/manifesto com mesmos campos/vereditos.
- **RF-09 (item 9)** — SI-6: nenhum preset/chave/comando/default novo sem §16; `git diff --name-only c63e333 HEAD -- <protegidos>` vazio.
- **RF-10 (item 10)** — registry 6 mapas byte-equal **antes** da troca de especificador (já entregue no ADR-001; verificar).
- **RF-11 (item 11)** — `insta` só revisor: `grep -rn 'cargo insta accept'` vazio e nenhum `*.snap.new`.
- **RF-12 (item 13)** — `12/12` só re-derivável por comando; nunca publicar como fato medido.
- **RF-13 (itens 14, 15)** — selo `c904f1c5` e comandos paralelos; `commands.suiteFull` byte-idêntico.

## 2. Invariantes

- **I1** — oráculo anterior, imutável e legível sem executar Rust.
- **I2** — derivado reprova mesmo verde.
- **I3** — literal sem assinatura não é prova.
- **I4** — 9+2 é medição; 12/12 é meta.
- **I5** — zero comando novo no selo.

## 3. Edge cases

- E1 — `EXPECTED_STACKS` escrito à mão: não pode ser regenerado pelo próprio código sob teste.
- E2 — sem worktree materializado, guarda cai em tautologia — fallback deve falhar.
- E3 — transcript em TTY pode divergir por cleanup (dono ADR-004).
- E4 — snapshot aceito vira bug validado sem rito humano.

## 4. Estratégia de teste

| Nível | Comando | Esperado |
|---|---|---|
| Plugins | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 540 pass |
| Instalador | `node --test "installer/__tests__/*.spec.mjs"` | 586 pass |
| Static | `node scripts/static-checks.mjs` | exit 0, selo intacto |
| SDD | `node scripts/sdd-checks.mjs` | 0 FAIL |
| Vendor | `node scripts/vendor-skills.mjs --check` | OK |

## 5. N/A declarado

Motor e TUI Rust são ADRs 003/004.
