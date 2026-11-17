# SPEC — prd-eixos-separados-cli-adr-001

> Prescritivo. Origem: ADR-001 §3 (13 itens), §2 (A1/C1/C2/C3). Em conflito, o ADR prevalece. Classificação: Feature (§16 `D16-EIXOS-CLI`).

## 0. Score do spec-gate
Ver `GATE-SPEC.md`. Alvo 100%.

## 1. Requisitos funcionais
- **RF-01 (item 1)** — cardinalidade **8×6=48**: 8 backends (java,node,rust,nestjs,dart,flutter,other,none) × 6 frontends (vue,react,dart,flutter,other,none). `eixos-stack.spec.mjs` ⇒ oráculo 48/48.
- **RF-02 (item 2)** — `commands`/`moduleMap` derivados do **eixo backend**; `commandsForBackend`/`moduleMapForBackend` presentes; asserção por eixo no golden.
- **RF-03 (item 3)** — `mcp`/`stacks`/skills derivados do **eixo frontend**; exceção mobile (`flutter+flutter`) a única declarada.
- **RF-04 (item 4)** — textos derivados ("rust backend"/"vue frontend"); **zero literal de preset no gerador** (`grep 'declared via Q&A'` vazio em `installer/*.mjs`).
- **RF-05 (item 5)** — **`rust+vue` válido sem perfil casado**: `generateConfig({axes:{backend:'rust',frontend:'vue'}})` ⇒ `rust backend` / `vue frontend` com commands do backend e mcp do frontend, 0 exceção.
- **RF-06 (item 6)** — 12 presets **substituídos** como caminho principal; nenhuma seleção de config por nome de preset casado fora da camada de compatibilidade congelada.
- **RF-07 (item 7)** — inventário dos **13 consumidores** com veredito registrado por arquivo em TASKS/VERIFY; nenhum import órfão.
- **RF-08 (item 8)** — baseline re-derivado: **1 literal por combinação das 48** no golden.spec; nenhuma das 36 novas sem baseline ratificado em §16 (P0-1); `INSTA_UPDATE=always`/`insta accept` proibidos (C3).
- **RF-09 (item 9)** — V20 re-medido por `static-checks.mjs`, population registrada; nenhuma queda silenciosa de cobertura.
- **RF-10 (item 10)** — selo re-derivado: novo hash registrado e ratificado em §16; **nenhuma afirmação de compatibilidade com `c904f1c5…`** (P0-2).
- **RF-11 (item 11)** — invariantes do harness intactas: `grep install.mjs gate.js` = 0; `gate.js` byte-idêntico; campos infra/gates/protectedPaths/riskPaths/escalateOnRisk/contraproveTimeoutMs/evidence inalterados.
- **RF-12 (item 12)** — suíte completa 0 falhas (H1/H2); `PRD-01`/`ADR-01`/`ADR-02` PASS; ledger 1:1.
- **RF-13 (item 13)** — escopo: CLI visual/protótipo/versões de lib/N/M pertencem ao ADR-002; este ADR decide só composição e critério de baseline.

## 2. Invariantes
- **I1** — 48 combinações por composição de eixo, nenhum preset casado como caminho principal.
- **I2** — commands/moduleMap do backend; mcp/stacks/skills do frontend; textos derivados.
- **I3** — baseline validado por humano antes de virar verdade; auto-accept proibido (C3).
- **I4** — selo novo ratificado; sem promessa de compatibilidade com o antigo.
- **I5** — gate/config/protectedPaths intocados; nenhum preset/chave/comando/default novo sem §16.

## 3. Edge cases
- E1 — 36 combinações novas entram verdes só com baseline ratificado; nunca por geração automática.
- E2 — mobile (`flutter`/`dart`) vale nos dois eixos; única exceção declarada.
- E3 — 13 consumidores com imports órfãos depois da substituição ⇒ falha de RF-07.
- E4 — texto "declared via Q&A" vazando no gerador ⇒ RFC-04 reprova.

## 4. Estratégia de teste
| Nível | Comando | Esperado |
|---|---|---|
| Eixos | `node --test installer/__tests__/eixos-stack.spec.mjs` | oráculo 48/48 |
| Golden | `node --test installer/__tests__/golden.spec.mjs` | 48 literais ratificados, 0 falha |
| Rust | `cargo test --manifest-path installer-rs/Cargo.toml` | 0 falhas |
| Selo | `sealCommands(commands)` | novo hash ratificado |
| Harness | `node scripts/static-checks.mjs && node scripts/sdd-checks.mjs` | 0 falhas |

## 5. N/A declarado (spec-gate)
- DDD api/impl/public — N/A (config generation, não camada Java).
- Segurança/IAM — N/A (sem auth HTTP; SECURITY.md cobre STRIDE).
- ERD — N/A (nenhuma entidade persistida nova).
- Event Registry — N/A (composição pura, sem barramento).
- Migrations — N/A (não-Java).
