# RESEARCH — prd-garantias-runtime

> Insumo do PRD/ADR. ≥2 alternativas com fonte, trade-off e recomendação.
> Fonte = URL `http(s)`; sem fonte, a alternativa não conta.
> Eixo investigado: **como o harness deve expressar e proteger garantias de runtime que são aplicadas por software, sem prometer o que não verifica**.
> Insumo: as 3 decisões do owner registradas no §16 do PRD (2026-10-22) — **Q1** rebaixamento no env do processo host · **Q2** config indisponível nega toda tool call · **Q3** contraproveva híbrida (counts opcional). Este documento **investiga o COMO** de cada uma e **propõe** o eixo D (coerência da prosa), que não estava no PRD.

## Alternativas avaliadas

### Eixo A — Onde o modo efetivo de um gate vive (P1-A / Q1 / ADR-001)

- **Fonte**: https://12factor.net/config
- **Fonte**: https://12factor.net/build-release-run
- **Fonte**: https://nodejs.org/api/process.html
- **Fonte**: https://kubernetes.io/docs/concepts/configuration/secret/#use-secrets-as-files-or-environment-variables
- **Fonte**: https://martinfowler.com/articles/feature-toggles.html
- **Trade-off**: **ganha** — config fora do artefato versionado (12factor III: "store config in the environment"; strictly separate config from code) e, no Kubernetes, segredo injetado como variável de ambiente do container em vez de gravado no manifesto: o canal de rebaixamento sai do worktree e o operador do host controla o poderio (env = escopo do processo, `process.env` é mutável e global ao processo) — o toggle operacional fica explícito, observável e efêmero (Fowler: toggle é instrumento de operação, não de build) × **perde** — (i) o rebaixamento deixa de ser um dado versionado e auditável no repositório: passa a depender do ambiente onde o processo nasceu, o que **exige** a contrapartida de log explícito, ou o poder reduzido fica invisível; (ii) exige um vocabulário de env por gate (nome + motivo) que precisa ser documentado e testado como contrato, não como convenção.
- **Recomendação**: **aceita** — é a decisão do owner (Q1) e a que fecha a superfície de bypass medida (`gate.js:76-80` rebaixa por chave de `harness.config.json`, arquivo gravável por `bash`). O preço da perda (i) é pago por log obrigatório + motivo obrigatório no canal novo, e o preço de (ii) é pago por um contrato de env congelado no ADR-001.

### Eixo B — Como o config indisponível falha (P1-B / Q2 / ADR-002)

- **Fonte**: https://owasp.org/Top10/A05_2021-Security_Misconfiguration/
- **Fonte**: https://owasp.org/Top10/A01_2021-Broken_Access_Control/
- **Fonte**: https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final
- **Fonte**: https://12factor.net/build-release-run
- **Trade-off**: **ganha** — fail-closed total fecha o furo de desenho ("a garantia amarra ao detalhe de quais gates leram o config": qualquer gate novo que não leia o config reabre o furo — PRD §13) e é o tratamento canônico de configuração ausente/inconsistente (OWASP A05: configuração insegura ou inconsistente é falha da configuração, não permissão implícita; NIST SP 800-53, família CM: configuração de base mínima e explícita) × **perde** — o harness fica **vermelho inteiro** quando o config está inválido, e o agente trava; a mitigação é o kill-switch já existente (`HARNESS_GATES=off`, ADR-009), que precisa ser avaliado **antes** do config para continuar sendo uma saída real, e o `reason` do deny precisa dizer o que fazer (PRD §11: o reason é a interface).
- **Recomendação**: **aceita** — decisão do owner (Q2). O desenho mantém o kill-switch como precedeência máxima, carrega o config **uma vez** no dispatcher (em vez de "lazy" por gate) e faz o erro de carga virar `DenyError` tipado com `cause` enumerado e **sem o path** (I10).

### Eixo C — Como a contraproveva declara o que verificou (P1-C / Q3 / ADR-003)

- **Fonte**: https://slsa.dev/
- **Fonte**: https://in-toto.io/
- **Fonte**: https://nodejs.org/api/test.html
- **Fonte**: https://json-schema.org/draft/2020-12/json-schema-validation
- **Trade-off**: **ganha** — a evidência passa a **declarar** o que foi de fato verificado, em vez de prometer uma verificação que o verificador não executa (princípio de provenance/attestation: a prova declara o sujeito e o procedimento, não o que se espera que seja provado); o schema relaxado (`counts` opcional) elimina a mentira estrutural — hoje 3 relatórios gravados já carregam `deviation` porque o schema exige um campo que o observador padrão (`gate.js:561-572`) não produz × **perde** — (i) o schema deixa de ser auto-explicativo: um relatório sem `counts` deixa de ser distinguível de "zero testes" sem ler o bloco de declaração; (ii) a comparação de contagens continua **não sendo feita** no caminho real, e a promessa da prosa precisa ser reduzida em vez de mantida — a divergência real continua negando, mas só quando as duas pontas declaram e o observador viu.
- **Alternativa de observador**: implementar o parse da saída do runner para obter contagens — **ganha** a comparação real no caminho de execução (o deny `contraprove-divergent` fica alcançável sem executor injetado) × **perde** a robustez: o formato de saída é específico do runner (`node --test` documenta um formato próprio de TAP/summary; vitest e maven têm outros), então o verificador passa a conhecer o runner — acoplamento que o PRD §8 risco 2 já sinaliza.
- **Recomendação**: **aceita** o híbrido (decisão do owner, Q3) e **descarta** o observador parseado para este ciclo (registrado como caminho futuro; a análise já existe em `.spec/bugs/gate-counts-observation/TASKS.md`).

### Eixo D — Como garantir a coerência da prosa de garantia (RF-04 / ADR-004 — proposta do agente)

- **Fonte**: https://vale.sh/docs/topics/styles/
- **Fonte**: https://pre-commit.com/
- **Fonte**: https://martinfowler.com/articles/continuousIntegration.html
- **Fonte**: https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does
- **Trade-off**: **ganha** — a verificação entra na suíte que já roda em todo commit e no CI (Fowler: o build precisa ser self-testing e reprodutível localmente; o hook é o ponto barato e determinístico para reportar antes da revisão), sem tocar o runtime (regra do ciclo `prd-adr-pipeline`: enforcement = suíte + CI, nunca deny novo para artefato de prosa) × **perde** — (i) um linter de prosa externo (vale/markdownlint com regra custom) traria dependência de binário para o `suiteFull` (que é selado por `sha256`) e um **segundo** arquivo de configuração, fora do `harness.config.json` — o dado "quais arquivos são prosa de garantia" ficaria duplicado, contra o SSoT (ADR-003 do ciclo v7 / regra I3); (ii) a verificação por parse só prova a **forma** da garantia (existe nível e existe `arquivo:linha`), não a **verdade** do lastro — a verdade do lastro é apuração de código e probe de comportamento, de outro tipo de artefato.
- **Recomendação**: **aceita** — check estrutural em JS no padrão dos checks `V2..V15` já existentes (determinístico, sem dependência nova, dados vindos do `harness.config.json`), com escopo restrito ao par de arquivos que a própria métrica do PRD §5 nomeia (`.agents/rules/gate-contract.md` e `docs/FUNCIONAMENTO.md`) e com escape declarado e auditável para a prosa legitimamente parcial.

## Recomendação final

Coerente com as três decisões do owner e com a regra do repo (enforcement = suíte + CI, nunca deny novo de runtime para artefato de prosa):

- **A (ADR-001)**: o modo efetivo de um gate vive no env do processo host (`HARNESS_GATE_<GATE>`), com motivo obrigatório e log por rebaixamento; `gates.*` no `harness.config.json` vira **informativo** e é lido só para auditoria.
- **B (ADR-002)**: o config é carregado **uma vez** no dispatcher, **antes** do loop de gates; a falha vira deny `config-unavailable` com `cause` enumerado e sem path; `HARNESS_GATES=off` é avaliado antes e permanece como saída declarada.
- **C (ADR-003)**: `counts` sai de `required`; o veredito carrega `countsVerification` com 4 estados (`compared` / `not-declared` / `not-observable` / `not-by-design`); a divergência real continua negando; o literal `via: "counts-unverifiable"` sai; a prosa assume o mesmo alcance do verificador.
- **D (ADR-004)**: check estático `V18` em `scripts/static-checks.mjs` exige, em toda linha de garantia, um nível (🟢/🟠/🟡/🔴 ou `mecanismo em`) e um lastro `arquivo:linha`; a lista de arquivos vem de `harness.config.json`; escape declarado `<!-- v18:skip ... -->`; nenhum deny novo.

Eixos **B** e **C** não são re-decididos: são o *como* das decisões do owner (Q2, Q3). Eixo **A** é o *como* de Q1. Eixo **D** é a única decisão nova deste ciclo.
