# RESEARCH — prd-adr-pipeline

> Insumo do PRD/ADR. ≥2 alternativas com fonte, trade-off e recomendação.
> Fonte = URL `http(s)`; sem fonte, a alternativa não conta.
> Eixo investigado: **qual é a unidade de decisão revisável e como o formato dela é verificado**.
> Insumo das 5 decisões de `SPEC §1` (ADR-P01..ADR-P05) deste ciclo (dogfood).

## Alternativas avaliadas

### Alternativa A — ADR por decisão, numerado e monotônico, com índice/ledger
- **Fonte**: https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions
- **Fonte**: https://adr.github.io/
- **Fonte**: https://adr.github.io/madr/
- **Fonte**: https://github.com/npryce/adr-tools
- **Trade-off**: **ganha** unidade pequena e rastreável — "um ADR descreve uma decisão", numeração sequencial e monotônica nunca reusada, decisão revertida é marcada `superseded` em vez de apagada (Nygard); MADR acrescenta campo de status e links entre ADRs; `adr-tools` mantém o log como arquivos numerados em subdiretório do projeto × **perde** um arquivo por decisão e a manutenção de um índice que precisa casar com o disco — o ledger vira superfície a manter coerente.
- **Recomendação**: **aceita** — é a base de `ADRs/ADR-00N-{slug}/` + `ADR-INDEX.md` (`SPEC §4.1`), com o 1:1 verificado por check estrutural (`ADR-01`).

### Alternativa B — Processo SDD entregue por toolkit externo (Spec Kit)
- **Fonte**: https://github.com/github/spec-kit
- **Trade-off**: **ganha** processo pronto (constituição → specify → plan → tasks → implement → converge) com quality gates e extensões (bug, idea assessment) × **perde** acopla o repositório a uma CLI/agente externo (Python 3.11+, `specify`), traz escopo maior que a dor declarada (retrabalho por intenção não vista) e **não** resolve o contrato de "1 decisão = 1 revisão"; adotar a ferramenta é decisão de produto, não de formato.
- **Recomendação**: **descartada como dependência** — o repositório não adota a CLI (`NFR-3`: zero dependência nova); o que se aproveita é a ideia "spec antes de plan antes de tasks", já vigente no SDD local.

### Alternativa C — Verificação client-side (hook) + obrigatória no CI, sem deny de runtime
- **Fonte**: https://pre-commit.com/
- **Fonte**: https://martinfowler.com/articles/continuousIntegration.html
- **Trade-off**: **ganha** feedback determinístico e barato antes da revisão e um estado verificável por todos — o hook aponta o problema antes do code review, e o build valida cada push com "falha = prioridade máxima" (Fowler: build self-testing) × **perde** nada impede, no runtime do agente, começar sem o artefato: a barreira é o check no momento da integração, não a negação da ferramenta.
- **Recomendação**: **aceita** — é a forma de enforcement de `ADR-P03`: os checks entram pelo `static-checks` já invocado pelo `commands.suiteFull` e pelo CI; zero deny novo em `gate.js`.

## Recomendação final
Seguir **A** para a forma — 1 decisão = 1 ADR numerado + índice 1:1, com `depende-de` e interface congelada declarados (`ADR-P04`) — e **C** para a verificação — checks determinísticos entrando pela suíte/CI existente, nunca por deny de runtime (`ADR-P03`). **B** fica registrada e descartada como dependência: cobre o processo inteiro, mas o problema aqui é o formato da unidade de revisão, não a falta de um toolkit.
