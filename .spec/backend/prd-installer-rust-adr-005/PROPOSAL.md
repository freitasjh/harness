# PROPOSAL — prd-installer-rust-adr-005

> Ciclo SDD do **ADR-005 do PRD-3** (último ADR: publicação do binário, runtime do adotante e selo). Fonte: `.spec/prd/prd-installer-rust/ADRs/ADR-005-publicacao-runtime-selo/ADR.md` (16 itens §3; G2 aprovado).
> Classificação P0→P1: **Refactor de distribuição** — nenhum preset/comando/chave/contrato/tela/número novo.

## 1. Problema (medido)
| Fato | Valor |
|---|---|
| Selo | `c904f1c5…` (4 etapas), `unit=daba8c5…` — byte-idêntico |
| Destino | Node ≥ 20 (D7), sem toolchain Rust; `install.mjs` não é entrypoint |
| Cobertura Rust | fora da contraprova (D6, custo aceito) — oráculo `c63e333` é a garantia |
| 12 presets | congelados (D5); nenhum novo para acomodar distribuição |

**Defeito evitado:** empacotar com script de build (exige Rust no destino), expor `install.mjs` como entrypoint (segundo motor), ou republicar o selo para acomodar Rust na contraprova.

## 2. Proposta
Pacote npm wrapper com `bin` → shim JS (localizador, não motor) e binário autocontido via `optionalDependencies` por os/cpu/libc; fallback explícito em stderr + exit 1; `install.mjs` só como oráculo em worktree `detach`, fora do caminho de instalação; Rust em comandos paralelos fora do selo.

## 3. Escopo
16 itens de interface; wrapper/package.json, shim, pacotes de plataforma, pipeline de publicação, prova D7/D6, selo intacto.

## 4. Não-escopo
Reabrir D1/D5/D6/D7 · presets/contrato/tela/selo · publicação real (sem `npm publish` sem owner) · gate/config.

## 5. Riscos
R1 tripla não casa ⇒ fallback claro; R2 script de build ⇒ proibido; R3 `install.mjs` vazando no pacote ⇒ 2º motor; R4 selo republicado ⇒ drift; R5 rede no install ⇒ V15.

## 6. Verificação
16 itens com comando; `find node_modules -name install.mjs` vazio; `sealCommands` = `c904f1c5`; `grep -cE 'cargo|rust' harness.config.json` = 0; 4 etapas seladas (plugins/installer/static/vendor) + cargo e differential em paralelo (D6).
