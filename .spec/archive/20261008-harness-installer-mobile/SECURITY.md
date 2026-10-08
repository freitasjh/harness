# Security Assessment — Fase 1 — harness-installer-mobile

- **Skill:** `security-review` (Fase 1)
- **Fonte da verdade:** `.agents/rules/security-standard.md` (OWASP/ASVS/MASVS)
- **Escopo de avaliação:** o instalador como vetor + o vendor de skills de terceiros.
- **Data:** 2026-10-07

> Adaptação: o artefato não é aplicação web/API; não há authn/authz/endpoints. O modelo
> de ameaça é o de um **script que escreve em repo alheio** e de um **supply chain** de
> skills vendorizadas.

## 1. Threat Model (STRIDE)

| Ameaça | Fluxo | Risco | Mitigação | Status |
|---|---|---|---|---|
| Tampering | escrita fora do `--target` (typo, `..`) | Alto | prefix-check + abort (v1/I1) | 🟢 v1 |
| Tampering | backup falha e escrita prossegue | Alto | I1 (verifica antes) | 🟢 v1 |
| Info Disclosure | `deployToken` em manifesto/config/log | Alto | I5 + fixture | 🟢 v1 |
| Elevation | rodar como root | Médio | `--allow-root` explícito | 🟢 v1 |
| **Supply chain** | skill de terceiro vendorizada vira governança instalada | **Alto** | `treeHash` + `--check` + proveniência (source+commit) | 🟠 S1 |
| **Supply chain** | skill de terceiro sem licença clara | Médio | bloquear vendor ou atribuir | 🟠 S2 |
| Tampering | drift do vendor após commit | Médio | `.vendor-lock.json` + `--check` CI | 🟢 ADR-009 |
| Info Disclosure | lock/segredo copiado ao destino | Médio | `.vendor-lock.json` excluído; segredo só-memória | 🟢 I/ADR |
| Integridade | vendor com symlink/arquivo oculto seguido no install | Baixo | revisão; `collectIncoming` só lê arquivos | 🟡 S4 |
| Repudiation | "não fui eu que instalei" | Baixo | manifesto (auditoria) | 🟢 v1 |
| Rede/DoS | fetch no caminho de instalação | Alto | install rede-zero (I8) + check V15 | 🟢 |
| Spoofing/DoS clássicos | — | — | N/A (local, sem rede no install, sem daemon) | N/A justificado |

## 2. Requirements Coverage

- [x] Sem rede no caminho de instalação (I8 + V15)
- [x] Segredo nunca persistido (I5 v1)
- [x] Escrita restrita ao target (v1)
- [x] Proveniência do vendor (source+commit+hash) e drift-check
- [ ] Licença das skills de terceiros — **GAP S2** (ver G2 do REVIEW)
- [ ] Atestação de que skill vendorizada não contém payload executável oculto — **GAP S1**
- N/A: AuthN/AuthZ/rate-limit/TLS/headers (não é app)

## 3. ASVS 4.x / MASVS

- **ASVS L2:** cobertura **parcial** e declarada — os controles de aplicação (V2 auth,
  V3 sessão, V4 acesso, V5 validação de entrada web) são N/A; os aplicáveis (V10 gestão
  de segredos, V14 configuração) estão cobertos por I5/I8.
- **MASVS:** N/A no instalador; **aplicável ao app alvo** (mobile) — a SPEC propaga o
  perfil mas não audita o app; o security-review do app ocorre no repo mobile, não aqui.

## 4. Gaps

- 🔴 **Críticos: 0**
- 🟠 **Alto: 2**
  - **S1** — supply chain: as 22 skills de terceiros passam a integrar a governança
    instalada. Ação (PLAN): revisar cada skill vendorizada procurando scripts/payloads
    executáveis; o check `treeHash` cobre integridade pós-commit, **não** revisão de conteúdo.
  - **S2** — licença ausente no `skills-lock.json`. Ação (PLAN): conferir LICENSE upstream;
    se ausente, **não vendorizar** (bloqueia A1) — decisão do usuário/PLAN.
- 🟡 **Médio: 1**
  - **S4** — symlink/arquivo oculto no vendor seguido no install. Ação (PLAN): assert que o
    vendor é composto por arquivos regulares; proibir symlink no `--check`.
- 🟢 **Baixo: 0**

## 5. Verdict

**partial** — 0 críticos. S1/S2 são 🟠 e devem virar tasks no PLAN (bloqueiam a
completude do A1, não a Fase 2). Nenhum item bloqueia o avanço para o PLAN.

### Recommendation
proceed (para PLAN), endereçando S1/S2 como pré-requisitos do vendor (A1).
