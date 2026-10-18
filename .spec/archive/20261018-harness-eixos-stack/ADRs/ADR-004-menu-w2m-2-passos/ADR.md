# ADR-004 — Menu W2m em 2 passos, range derivado e padrões do erro reparados

- **Status**: `todo`
- **Data**: 2026-10-18
- **Ciclo**: `harness-eixos-stack`
- **Fonte**: parecer **vinculante** do `ux-designer` (2026-10-18) **adaptado** pela decisão de portão **D-A** (usuário, 2026-10-18: "2 passos agora; backend depois") + achado A4

## Contexto

`WIZARD_MENU` tem **5 itens** produto→stack (`installer/install.mjs:1492-1498`) e o bloco `W2m` (`:1635-1651`) fixa o range `[1-5]` **literalmente** em dois pontos — prompt (`:1646`) e mensagem de erro (`:1649`). O parecer do `ux-designer` apontou que o item 4 (`Projeto Java + Vue`) **funde dois eixos** num rótulo; com backend {java,go,rust} × frontend {vue,react} o menu único viraria 9+ itens (Hick/Miller). O parecer propôs **3 passos** (tipo de projeto → backend → frontend), incluindo as opções "Nenhum" — o que criaria os presets `java` (backend sem frontend) e `vue`/`react` (frontend sem backend).

**Decisão do owner (D-A)** corta o 3º passo: o eixo backend vira pergunta própria **quando** `go`/`rust` forem criados; nesta entrega o backend tem uma única opção (java) e uma pergunta de 1 item seria cerimônia sem valor.

## Decisão

1. `W2m` passa a **2 passos**, ambos com ≤5 opções: `W2m-1 tipo de projeto (5 itens)` → `W2m-2 frontend (Vue | React)`, este último **somente** quando `W2m-1 = 4` (Aplicação web).
2. Ordem e numeração de `W2m-1` **idênticas** à atual (não renumerar — teste lê os itens por string):

```
[INFO] W2m tipo de projeto — escolha o tipo do seu projeto:
  1) App Flutter        -> stack flutter
  2) Pacote Dart        -> stack dart
  3) Projeto Node.js    -> stack node (ESM incluso)
  4) Aplicação web (backend + frontend) -> segue: frontend
  5) Outro projeto      -> stack outra
[1/2] escolha [1-5] (q cancela) >
```

```
[INFO] W2m frontend — qual o frontend do seu projeto web:
  1) Vue (default)   -> stack java+vue
  2) React           -> stack java+react
[2/2] escolha [1-2] (default: 1) (q cancela) >
```

3. **Range derivado** de `WIZARD_MENU.length` no prompt e na mensagem de erro (fecha A4).
4. Default `1` (Vue) em `W2m-2` **por um motivo declarado**: `java+vue` é o único valor web congelado no baseline, então Enter reproduz o comportamento atual. Não há detector de Vue/React (o detector só lê `pubspec.yaml`, `installer/install.mjs:1507-1558`) ⇒ é **default de produto estático**, não detectado — declarado como tal.
5. Padrões reparados no bloco `W2m` (parecer UX, defeitos 3..5): contador `[i/total]` no prompt (paridade com W3, `:1672`); linha 3 do erro em **linguagem de produto** (hoje vaza `flutter|dart|node|java+vue|outra` via `howToFix('stack')`, `:1575`); linha 4 com `arquivo:linha` do bloco (hoje traz `runWizard W2m` genérico).
6. O item do menu aponta para o **preset** (não para string solta) — se o rótulo citar termo que `validateAnswer` não aceita, o caminho é emenda de ADR, não um `stack` novo silencioso.

## Alternativas descartadas

- **3 passos com eixos vazios** (parecer UX original): cria presets `java`/`vue`/`react` fora do escopo aprovado (D-A) e mais superfície de baseline/teste.
- **Menu único com 2 itens web** (Java+Vue / Java+React): menor diff, mas mantém a fusão de eixos no rótulo e não prepara `go`/`rust`.
- **Item por tecla extra fora do menu**: fora do padrão de `WIZARD_MENU` e não testável por string.
- **Manter `[1-5]` literal**: item novo fica inalcançável (A4).

## Consequências

- `installer/__tests__/wizard.spec.mjs` precisa ser atualizado: asserção de "5 itens" escopada ao bloco `W2m-1` (o filtro `^\s*[1-5]\)` casaria também as linhas do `W2m-2`), e o item 4 deixa de mapear direto para `java+vue` (passa a ser branch).
- `docs.spec.mjs:30-46` + `.agents/skills/harness-installer/SKILL.md:220-228` acompanham (paridade prosa↔mecanismo).
- Desvio registrado: o parecer de UX era de 3 passos; a decisão do owner **D-A** reduz para 2. O desvio está declarado aqui e no SPEC, não silenciado.

## Invariantes preservados

- O wizard continua **apresentação pura**: nunca chama `generateConfig`, nunca escreve (`installer/install.mjs:1485`, `:1700-1706`).
- `q`/`ABORT_TOKENS` abortam com **0 writes** (`:1490`, `:1605-1607`); W2 com `pubspec.yaml` continua **pulando** o menu (`:1627-1633`).
- Zero cor/ANSI, sem rede, sem mouse — texto puro (`stripAnsiControls`, V15).

## Interface congelada

`WIZARD_MENU` (export, consumido por `installer/__tests__/wizard.spec.mjs:11,454`) e o fluxo `W0..W7`.

**depende-de**: ADR-002. **Era bloqueado por**: parecer do `ux-designer` — **entregue** em 2026-10-18 e incorporado acima (com a adaptação D-A).

## Fora desta decisão

Reordenar itens existentes; renomear presets já lançados; pular o passo backend definitivamente (ele volta no ADR que criar `go`/`rust`).
