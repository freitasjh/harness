# Tech debt ativa — copiada do ADR arquivado

# Tech debt — perfil de tokens do init (ADR-001, PRD prd-init-project-scaffold)

Status: registrado (2026-11-18) · Origem: review da implementação do ADR-001 · Bloqueia merge: **não** (declarado no aceite)

## Decisão tomada

A interface congelada I8 do ADR-001 diz: templates de `DESIGN.md`/tokens vêm só da skill `design-system`, e a escolha de perfil (`shadcn` vs `claude`) fica **fora** desta ADR — o gerador não decide por palpite.

Consequência: `tokens/*.json` está classificado como PRÓPRIO (`PATH_CLASSES.owned`) no `harness-sync.mjs`, mas **nenhum token é gerado** neste ciclo. O aceite A8 passa a rotular MS-1 como **parcial** e a asserir que `<target>/tokens` não existe (gerar sem perfil seria violação de I8).

## O que falta

Uma ADR de perfil decidindo:
1. qual perfil é o padrão quando não há sinal no projeto (`shadcn`/`claude`/outro);
2. se isso vira flag `--profile` (com enum) ou detecção a partir de `package.json`/`DESIGN.md`;
3. quais arquivos `tokens/*.json` entram no manifesto e como o `doctor` os valida;
4. como atualizar tokens em projetos já instalados sem sobrescrever edição do maintainer (o mesmo problema I3/I4, agora aplicado a tokens).

## Critério de reativação

- Próximo ADR do PRD `prd-init-project-scaffold` (ADR-002), **ou**
- primeiro projeto real que reclamar falta de tokens no scaffold.

Até lá, MS-1 do PRD é **parcial por decisão explícita**, não por omissão silenciosa.
