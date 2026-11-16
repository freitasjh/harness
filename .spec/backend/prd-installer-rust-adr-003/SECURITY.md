# Security Assessment — Fase 1 — prd-installer-rust-adr-003

> Skill `security-review` (SSoT). Escopo: motor local de instalação; **sem endpoints HTTP/API**. STRIDE aplicado aos fluxos de dados do `contract-v1`.

## Fluxos de dados

| Fluxo | Origem | Destino | Dado sensível |
|---|---|---|---|
| `stdin` → `contract-v1` | operador | dispatcher Rust | segredo de instalação |
| `stdout`/`stderr` | dispatcher Rust | operador / 22 consumidores Node | envelope `v:1`, bloco 4-linhas |
| manifesto `.harness-install.json` | disco | motor | `source`, `doctorPre`, hashes |
| diretório de backup | disco | motor | conteúdo integral do destino |
| `opencode.json` / agentes / rules | disco | motor | config do adotante |

## Threat Model (STRIDE)

| Ameaça | Fluxo | Risco | Mitigação (SPEC/ADR) |
|---|---|---|---|
| Spoofing | `stdin` → dispatcher | 🟡 | oráculo externo `c63e333` com SHA + proveniência `git-object`; envelope `v:1` com `op` igual à solicitada (RF-02/RF-14); nenhuma `op` nova sem §16 |
| Tampering | manifesto | 🟠 | `manifestSchemaVersion===1` + `source` conhecido + `FOREIGN_MANIFEST` ⇒ `exit 1`, 0 writes (RF-03/I1); hash de backup verificado antes do `apply` (RF-04/I2) |
| Tampering | vereditos congelados | 🟠 | lidos como **arquivos externos**, sha registrado antes da comparação, `git diff --exit-code` no ciclo, `insta accept` proibido, rito `Veredito: validated literal …` (RF-12/I6) |
| Repudiation | escrita de config | 🟢 | manifesto registra `upgradedFrom`, `removed`, `collisions`, `doctorPre`; não há log central em CLI local — rastro é o próprio manifesto + backup verificado |
| Information Disclosure | `stdout`/`stderr`/RELATÓRIO | 🟠 | segredo em `stdin` **sem eco** (I5); mensagens 4-linhas com códigos do vocabulário fixo, sem stack trace/paths internos (RF-07); `NOT_INSTALLED`/`MANIFEST_INVALID` mapeados para `UNKNOWN`, nunca novos códigos (E5) |
| DoS | dispatcher `contract-v1` | 🟢 | CLI local, sem superfície de rede; `exit 2` só para erro de protocolo, fail-closed |
| Elevation of Privilege | `preflight` | 🟠 | `UID_ROOT` barra execução como root (ADR §2.1 op 1); `assertCreateOnly` impede `init` sobre destino sujo (RF-09) — remoção de config por **forma**, nunca por nome de chave, preservando npm do usuário |

## Requirements Coverage

- [x] AuthN/AuthZ — **N/A**: sem endpoints; integridade por oráculo + envelope `v:1` (RF-02/RF-14)
- [x] Input validation — `parseArgs` Valid/DTO equivalente: posicional desconhecido ⇒ `BAD_ANSWER`; `--target` obrigatório (RF-08/RF-11)
- [x] SQL/JPQL parametrizado — **N/A**: sem banco
- [x] DTOs explícitos — envelope `v:1` com `result`/`error` (ADR-001 §2.2)
- [x] Segredos — `stdin` sem eco, nenhum segredo em código/RELATÓRIO/log (I5)
- [x] Erros genéricos — 4 linhas, códigos do `Set` do oráculo + `UNKNOWN` (22 medidos em `install.mjs:1529-1535`; ADR diz 23 — achado S3), sem stack trace (RF-07)
- [x] Rollback seguro — backup verificado, único ponto de escrita `apply` (RF-04)
- [x] Idempotência — 2ª execução `noop`, schema intacto em conteúdo/mtime/inode (RF-10)

## Gaps

- 🔴 Crítico: **nenhum**
- 🟠 Alto: **nenhum** (todos os riscos acima têm mitigação prescritiva na SPEC)
- 🟡 Médio: nenhum
- 🟢 Baixo: R5 — cobertura Rust fora do selo é custo aceito/declarado no G2, não é gap de segurança (a contraprova selada segue sendo `c904f1c5`)

## Veredito

- **Status:** `pass`
- **Threat Model:** sim
- **Critical Findings:** 0 · **Attention Findings:** 0
- **Recomendação:** seguir para Fase 2 — nenhum bloqueio de segurança. Revalidar na Fase 3 (OWASP A01–A10 onde aplicável) e na Fase 4 (checklist 14 itens, com os N/A de CLI local declarados).
