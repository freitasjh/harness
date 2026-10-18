# ADR-003 — Vendor com origem de licença declarada (`licenseOrigin`) e NOTICE sem claim universal

- **Status**: `todo`
- **Data**: 2026-10-18
- **Ciclo**: `harness-eixos-stack`
- **Fonte**: parecer do `architect` §1.4/ADR-003 + achado A5 + verificação de licenças (orquestrador, 2026-10-18) + decisão de portão **A** (usuário, 2026-10-18: "vendorizar com desvio declarado")

## Contexto

`scripts/vendor-skills.mjs` é o único ponto de vendor (source-side, offline). A allowlist SPDX é permissiva por desenho (`:31-45`) e a política é fail-closed: skill sem licença **identificável** não é vendorizada (`P-02=(i)`, `:8`, `:317-325`). Hoje o `SOURCE_LICENSES` transcreve o `LICENSE` **do repo upstream** com `sha256` congelado (`:47-51`, `:109-120`) e o `VENDOR-NOTICE.md` afirma **byte-identidade universal** ao upstream (`:398`, `:416`).

**Fatos verificados nesta data (GitHub API + raw, commit em `main`):**

| Source | Evidência de licença | SPDX | Rota |
|---|---|---|---|
| `google-labs-code/stitch-skills` | arquivo `LICENSE` na raiz (11.273 bytes); sem `NOTICE`; skill em `plugins/stitch-build/skills/react-components/` | Apache-2.0 (na allowlist) | `upstream-file` — sha verificável do arquivo real |
| `vercel-labs/agent-skills` | **sem arquivo `LICENSE`**; `README.md` §License = `MIT`; `packages/react-best-practices-build/package.json` → `"license": "MIT"` | MIT (na allowlist) | `declared-evidence` — sha da **nossa** transcrição + `evidence[]` |

Sem esta decisão, a fonte vercel cai no ramo `no-license` (`:317-325`) e o perfil react fica com **uma** skill — ou, pior, o NOTICE passa a afirmar byte-identidade sobre um texto que nós transcrevemos.

## Decisão

1. Vendorizar **as duas** skills (caminho A aprovado pelo usuário).
2. Novo campo **`licenseOrigin`** em `SOURCE_LICENSES`/lock, com dois valores: `upstream-file` (sha do arquivo real do upstream) e `declared-evidence` (sha do nosso texto + `evidence[]` citando URL/§ e commit pinado).
3. `VENDOR-NOTICE.md` passa a declarar a **origem por fonte** e **para de afirmar** byte-identidade universal.
4. SPDX finais: `Apache-2.0` (stitch) e `MIT` (vercel), com o texto MIT transcrito e o holder nomeado na evidência.
5. A **cópia da skill continua byte-idêntica à fonte** — nada é injetado em `SKILL.md` (a skill não é patchada).
6. `react-components` entra como **opcional** (rede em runtime + `@swc/core` + Stitch MCP); `react-best-practices` como padrão.
7. **Precedência de `licenseFile` (divergência declarada pelo `developer-engineer` no Batch 4, aceita pelo orquestrador)**: o `licenseFile` da **skill** aponta para onde a licença está declarada **no próprio artefato** (frontmatter do `SKILL.md` da vercel = `MIT`); o **texto agregado** por source (`LICENSE-vercel-agent-skills`, com a transcrição + `evidence[]`) vive em `lock.licenses[]`. Os dois coexistem: artefato (precedência de leitura) **e** agregado (transcrição auditável). Não é drift — é a regra de precedência do próprio vendor (`P-02=(i)`).

## Alternativas descartadas

- Aplicar fail-closed estrito e excluir a fonte sem `LICENSE`: contraria a decisão vinculante **A** do usuário.
- Injetar `license: MIT` no frontmatter do `SKILL.md` vendoriado: quebra a byte-identidade e o `treeHash` (`--check` passa a falhar por drift legítimo).
- Fork/patch da skill: mata o drift check.
- Declarar o desvio só em prosa (sem campo): o NOTICE continuaria afirmando algo que não é verificável — pior que não declarar.

## Consequências

- `--check` passa a verificar **duas coisas distintas**: estabilidade do **nosso** texto (fonte `declared-evidence`) e fidelidade ao upstream (fonte `upstream-file`).
- Ficam explícitos dois limites — e é isso que o NOTICE deve dizer:
  - fidelidade da transcrição em `declared-evidence` é 🟡 **processo** (transcrição + evidência citada), **não** garantia de runtime;
  - a rede em runtime dentro da skill opcional (`fetch-stitch.sh`) **não** é caçada por V15 (escopo `installer/`, 🟠 parcial declarado em `gate-contract.md` §1).
- `installer/__tests__/vendor.spec.mjs:396` (assert "bate byte-a-byte com o LICENSE upstream") precisa ser **dividido por `licenseOrigin`** — não pode continuar valendo para fonte sem arquivo no upstream.

## Invariantes preservados

- `SPDX_ALLOWLIST` inalterada (`scripts/vendor-skills.mjs:31-41`).
- `installer/` rede-zero; lock não copiado ao destino; `.vendor-lock.json` segue a única fonte de procedência.

## Interface congelada

`.vendor-lock.json` v1 (`scripts/vendor-skills.mjs:25`) + contrato `writeVendor`/`checkVendor` (consumido por `harness.config.json:14`); campos existentes por skill permanecem — a mudança é **aditiva**.

**depende-de**: ADR-002 (as skills só têm efeito com o perfil react).

## Fora desta decisão

Nova política de licenças proibidas; licença das skills mobile já vendorizadas.
