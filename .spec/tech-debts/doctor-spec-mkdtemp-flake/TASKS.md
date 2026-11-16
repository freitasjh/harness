# Tech Debt — `doctor.spec.mjs:61` intermitente (P3)

- **Origem:** review final do ADR-004 batch 3 (registro em `workflow-state.json:887`).
- **Gravidade:** P3 — defeito de teste, sem comportamento de produto afetado; reviewer marcou "não bloqueia".

## Problema
`installer/__tests__/doctor.spec.mjs:61` (`it('sequencia D0..D6 presente em ordem')`)
usa `text.indexOf(m)` sobre a saída do comando. O sufixo aleatório do `mkdtemp`
(`harness-doctor-<sufixo>` / `harness-doctor-src-<sufixo>`) pode conter as
substrings `D0`..`D6`, poluindo `indexOf` e fazendo a asserção de ordem falhar
de forma intermitente. Arquivo **congelado** (`f10ef580…`) — não alterar neste batch.

## Correção (task própria)
Trocar `text.indexOf(m)` por busca ancorada ao marcador real (ex.: regex com
fronteira `/\bD[0-6]\b/` sobre a linha do marcador, ou expor `r.markers` com
posições). Nenhuma mudança de comportamento de `runDoctor`.

## Dono
`developer-engineer` → `code-reviewer`. Agendar após o fechamento do ADR-004.

## Relacionado
- Veredito congelado ADR-003: `installer/__tests__/doctor.spec.mjs` consta em
  `installer-rs/tests/prova-engine.mjs::FROZEN` — qualquer edição exige
  re-selo do rito, não apenas task de teste.
- Não confundir com o warning R9 de `detect()` corrigido neste batch.
