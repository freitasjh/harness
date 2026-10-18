# Security Assessment — Fase 1 (SPEC)

> **Skill**: `security-review` (modo Fase 1) · **Data**: 2026-10-18 · **Alvo**: `.spec/backend/harness-eixos-stack/SPEC.md`
> **Fonte da verdade**: `.agents/rules/security-standard.md` (OWASP Top 10 / ASVS 4.x / MASVS 2.x)

## 0. Aplicabilidade

Este ciclo **não** tem autenticação, autorização, endpoints, dados de usuário, banco ou UI web/mobile. O instalador é uma **CLI/TTY local** e o artefato de valor é o **registry de perfis + o vendor de skills de terceiros**. Logo:

- Check de JWT / `@HasPermission` / `@Valid` / SQL / rate limiting / CSP / Keychain → **N/A** (sem backend, sem web, sem mobile).
- Superfície real de risco = **supply chain + integridade de artefato instalado** (o que entra no projeto do usuário e de onde veio).

## 1. Threat Model (STRIDE) — adaptado

| Threat | Fluxo | Risco | Mitigação no SPEC | Nível |
|---|---|---|---|---|
| **Tampering** | `.agents/skills/.vendor-lock.json` e `LICENSE-<slug>` adulterados após o vendor | Alto | `sha256`/`treeHash` por skill + sha do texto de licença; `--check` **FALHA** em drift — roda no `suiteFull` selado (`harness.config.json:14`) | 🟢 runtime |
| **Tampering** | Skill vendorizada **patchada** no destino (injeção de conteúdo) | Médio | Vendor grava cópia byte-idêntica; patch proibido (RF-09); `--check` detecta | 🟢 |
| **Spoofing** (de origem) | Conteúdo de skill atribuído à fonte errada / commit não pinado | Médio | `source` + `sourceCommit` pinado + `skillPath` no lock; NOTICE declara procedência | 🟢 |
| **Information Disclosure** | Segredo do destino vazando em log do wizard | Médio | `deployToken` continua o único segredo; `serializeAnswers` o omite; sink redige (`sanitizeLog`) — **inalterado** por este ciclo | 🟢 |
| **Information Disclosure** | Texto de licença/holder citado errado vira claim falso | Baixo | `licenseOrigin` + `evidence[]` expõem a limitação em vez de afirmar garantia (RF-08/RF-10) | 🟠 parcial |
| **Elevation of Privilege** (integridade) | Skill de um eixo **vazando** para destino de outro (A1) | Médio | RF-03 fecha o gating por eixo + teste nas **duas** direções | 🟢 |
| **Denial of Service** | Skill opcional com `curl`/`@swc/core` no destino | Baixo | `react-components` entra como **opcional** declarado; nenhuma rede é adicionada ao `installer/` | 🟠 parcial |
| **Repudiation** | Não se sabe quem/quando vendorizou | Baixo | `generatedBy` + commit pinado + NOTICE gerado | 🟡 processo |

## 2. Cobertura de requisitos de segurança (aplicáveis)

- [x] Integridade do artefato instalado verificável por hash (🟢, no `suiteFull`)
- [x] Procedência rastreável por skill (source + commit + path)
- [x] Licença com SPDX na allowlist, **fail-closed** para licença não identificável
- [x] Limitação declarada em vez de garantia falsa (`declared-evidence` = 🟡 processo)
- [x] Nenhuma rede nova no caminho de instalação (`installer/` rede-zero, V15 verde)
- [x] Nenhum segredo novo; nenhum log novo com dado sensível
- [x] Nenhum `deny` novo no gate; nenhum path protegido alterado
- [ ] **Ressalva 1**: a autenticidade do **upstream** depende de `git clone` por TLS + pin de commit — **não** há verificação de assinatura. 🟡 processo, declarado
- [ ] **Ressalva 2**: `.agents/skills/**` está **fora** do scan dos canários (`scripts/static-checks.mjs:42-47`) e V15 varre só `installer/` (`:280-286`) ⇒ rede em runtime dentro de uma skill vendorizada **passa** pelo CI verde. 🟠 parcial, declarado (pré-existente, amplificado por RF-09)

## 3. Gaps

- 🔴 **Critical**: **0**
- 🟠 **High**: **2** — (a) `declared-evidence` sem verificação criptográfica do upstream; (b) skill vendorizada fora do alcance dos canários
- 🟡 **Medium**: **1** — não-repúdio do vendor é processo (sem assinatura)
- 🟢 **Low**: **0**

**Nenhum gap é bloqueador de Fase 2** por decisão explícita e registrada do owner (caminho **A**: vendorizar com desvio declarado). Ambos os gaps 🟠 ficam **declarados no SPEC §9** com nível de garantia — não silenciados.

## 4. Veredito

- **Status**: `partial` (2 ressalvas 🟠 declaradas, 0 críticos)
- **Threat Model**: sim (STRIDE adaptado ao artefato real)
- **OWASP/ASVS/MASVS**: N/A estrutural (relatório de aplicabilidade honesto em vez de tabela verde artificial)
- **Recomendação**: **prosseguir** para Fase 2 (Planejamento); reavaliar na **Fase 3** (revisão do vendor implementado) e na **Fase 4.5** (checklist de tolerância zero aplicado ao que existir: hashes, pin, allowlist, sem segredo)
