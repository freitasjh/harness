# SPEC — harness-inventory-adr-004

> Prescritivo. Origem: `ADR-004` §3 (14 itens). Em conflito, o ADR prevalece. Tipo: governança com mecanismo.

## 1. Requisitos funcionais

- **RF-01 (item 1)** — `.opencode/plugins/lib/inventory/checks.mjs` puro (`node:fs`/`node:path`, sem rede/child/escrita), `root` injetável, exportando `deriveInventory`, `runInventoryChecks`, `OWNER_DECISIONS`, `CLASS_LABELS`.
- **RF-02 (itens 2, 3)** — um `record("V19", …)` no runner selado; `commands.suiteFull` e `seal.mjs` byte-idênticos (selo não republicado).
- **RF-03 (item 4)** — classe de skill derivada **só** do `.vendor-lock.json`: `grep -c "startsWith|inferStacks"` = 0.
- **RF-04 (item 5)** — fechamento aritmético publicado em `counters`, **inclusive em PASS**: skills = vendor + consumer + orphan; agentes = registrados; rules = consumer + axis.
- **RF-05 (item 6)** — `OWNER_DECISIONS` com 6 campos por entrada (`subject`, `class`, `owner`, `reason`, `proof`, `expiresWhen`); único literal commitado; registry em path protegido.
- **RF-06 (item 7)** — órfã nova reprova; órfã com decisão registrada passa.
- **RF-07 (item 8)** — decisão obsoleta reprova nos 2 casos: sujeito ausente do disco; sujeito que ganhou consumidor.
- **RF-08 (item 9)** — classe ambígua reprova (skill simultaneamente vendorizada e local, ou sem classe).
- **RF-09 (item 10)** — agente medido pelo **registro** (`opencode.json.agent`), não por `AGENT.md`; `10 / 10 / 10` (chaves/prompts resolvidos/diretórios) vs `ls *.md` = 9.
- **RF-10 (item 11)** — lock↔disco nas **duas** direções (chave do lock sem diretório ⇒ falha própria), porque `checkVendor` só anda lock→disco.
- **RF-11 (item 12)** — destino sem lock: `lockPresent=false`, sem FAIL (o inventário não herda vermelho).
- **RF-12 (item 14)** — `inventory.spec.mjs` com fixture por id (7) + caso sem lock; par PASS/FAIL com 1 arquivo de diferença.

## 2. Invariantes

- **I1** — o módulo não escreve: só lê disco + config e reporta.
- **I2** — nenhuma heurística de nome/prefixo decide classe.
- **I3** — decisão de dono **expira**; não existe supressão permanente.
- **I4** — `V18` (referência órfã) e `V19` (artefato sem classe) são ortogonais; nenhum substitui o outro.
- **I5** — nenhum comando novo em `commands.suiteFull` (selo é trust root).

## 3. Edge cases

- E1 — `code-reviewer` não tem `AGENT.md` (usa `PROMPT.md`): contar por registro evita o off-by-one que já mordeu o ADR-001.
- E2 — skill vendorizada sem consumidor **não** é órfã (D3): a classe é `vendor-by-axis`.
- E3 — `harness-installer` é a única órfã local; dono é `installer/install.mjs:413`, não um agente.
- E4 — repo-destino pode não ter `.vendor-lock.json`: ausência não é falha.

## 4. Estratégia de teste

| Nível | Comando | Esperado |
|---|---|---|
| Unit (inventory) | `node --test ".opencode/plugins/__tests__/inventory.spec.mjs"` | 0 falhas, 7 ids + caso sem lock |
| Plugins | `node --test ".opencode/plugins/__tests__/*.spec.mjs"` | 0 falhas |
| Instalador | `node --test "installer/__tests__/*.spec.mjs"` | 559 pass |
| Static (V19) | `node scripts/static-checks.mjs` | exit 0 com `PASS V19` |
| SDD | `node scripts/sdd-checks.mjs` | 0 FAIL |

## 5. N/A declarado

Sem backend/frontend/DB/endpoint/auth: as rules de stack não se aplicam (o inventário **mede** isso, não obedece).
