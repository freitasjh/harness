// checks.mjs — Critério do Destino Limpo (CDL): rubrica de 4 vereditos por linha.
//
// Contract (ADR-001 §3 prevalece sobre a SPEC):
//   derivePopulation(root)              → { root, files, lines, byFile }
//   classifyLine(line, ctx)             → "condicional" | "exemplo" | "catálogo"
//                                         | "incondicional" | null
//   declaredAxis(artifact, exports)     → Set<axisId> (∅ = artefato comum)
//   missingVocabulary(exports, lock)    → string[] (vazio = chaves cobertas)
//   runCdlChecks(root, opts)            → { ok, results, counters }
//   STACK_VOCAB (alias VOCAB), PROJECT_TERMS, EXCEPTIONS, BASELINE, VERDICTS
//
// A decisão que este arquivo executa é a RÉGUA, nunca a lista de sítios: a
// rubrica da ADR-001 §2.3 aplica-se a toda linha da população, na ordem fixa
// (`classifyLine` devolve UM veredito ou `null`), e a dívida que a régua
// encontra mora na `BASELINE` literal — com dono e hash — ou reprova.
//
// --- População (ADR-001 §2.1, D7) ----------------------------------------
// Repo inteiro menos três exclusões NOMEADAS. A população é uma FUNÇÃO, não a
// lista do PRD nem "o que o instalador propaga":
//   X1 `^\.spec/`                            registro datado, não artefato
//   X2 `(^|/)__tests__/`                     dado de teste/fixture (E-4)
//   X3 `^\.agents/skills/ui-ux-pro-max/data/` catálogo multi-stack (E-1)
// Unidade = linha `.md` (`*.md` filtra por FORMA; `.csv`/`.mjs`/`.json` ficam
// fora por não serem instrução lida pelo agente do destino). `lines` segue a
// semântica de `wc -l` (conta NEWLINE, não a última linha sem `\n`) — é o
// número que a ADR-001 §2.1 publica (228 arquivos / 31.661 linhas).
//
// --- Vocabulário (ADR-001 §2.2) -----------------------------------------
// As CHAVES derivam do instalador (`AXIS_IDS` ∪ tags de `stacks` do
// `.vendor-lock.json`); os TERMOS de cada chave são curados, e a COBERTURA é
// cobrada: id de eixo sem entrada ⇒ `cdl-axis-vocabulary-missing`. Termo só
// existe para chave que o instalador já conhece, então preset novo não passa
// verde por omissão (RF-09). Termo cross-axis vira `Map<term, Set<axis>>`, não
// `Map<term, axis>` (ADR-001 §2.2).
//
// --- Fonte de eixo ÚNICA (ADR-001 §2.4, R3) -----------------------------
// O eixo declarado de um artefato vem dos exports do instalador e do lock,
// NUNCA de outro check. Este módulo não lê — nem nomeia — a saída do inventário
// (ADR-004): a divergência entre "declarado" e "classe primária" é publicada
// pelo adapter em `axis-decl*`/`axis-class*`, e o módulo recebe `axisClass`
// injetado. `declaredAxis` em ordem: (1) `stacks` do lock; (2) complemento do
// id excluído em `RULES_BY_AXIS`/`SKILLS_BY_AXIS` (mapas de EXCLUSÃO); (3)
// segmento do nome da skill igual a id de eixo (D8/E-3); (4) ∅.
// **∅ é resposta, não ausência de resposta:** artefato comum (`RULES_COMMON`,
// `SKILLS_COMMON`, agentes) vai a TODO destino — prescrever stack nele é
// `incondicional` por construção (ADR-001 §2.3, SPEC E1). "Comum a todos" NÃO
// confere eixo.
//
// --- D2 (ADR-001 §2.3, §2.3-bis) ----------------------------------------
// Proibição citando tecnologia NÃO recebe veredito e NÃO entra na baseline:
// o efeito pretendido é ausência. O predicado é POR TERMO (C3 do review):
// negação imediatamente antes do termo, "X é proibido", "evitar X" ou
// "não usar X", insensível a caixa. Uma linha mista (`Use Spring Boot; NUNCA
// use Y`) conta a prescrição de X E a proibição de Y — o
// predicado antigo ("negação antes de ALGUM termo") apagava a prescrição
// inteira, que é como uma proibição escondia uma norma.
//
// --- Predicado v2 (ADR-001 §2.3-bis) -------------------------------------
// A forma canônica de prescrever stack neste repo é linha de TABELA; o
// predicado v1 não a via (`| Framework | Spring Boot 3 |` passava verde) e
// aceitava qualquer item de lista (item solto não é norma). O passo 1 é:
//   (a) marcador normativo + termo na MESMA cláusula
//   (b) linha de tabela/item com checkbox `[ ]`/`[x]`
//   (c) item de lista SOB HEADING NORMATIVO (o heading é consultado)
//   (d) linha de tabela cujo cabeçalho/célula declara stack/ferramenta/comando
//   (e) prosa declarativa com cópula/determinação de stack
//
// --- Predicado v3 — rodada 3 (ADR-001 §2.3-ter) ---------------------------
// Seis correções, cada uma com mutação que derruba (`cdl.spec.mjs`):
//   1. cópula `é`: alternância explícita sem `\b` à esquerda (`\b` não casa
//      antes de caractere não-ASCII, então `A stack é Spring Boot.` sumia);
//   2. marcadores (`Verifique`, `Configure`, `Analise`, `Substituir`, `rode`,
//      `garanta`, `Ao final`) e headings topicais (`Testes`, `DDD Modular`,
//      `Performance`, ...) entram no passo 1a/1c;
//   3. D2 vale com o termo em code, com rótulo (`Proibido no unitário: X`),
//      com verbo (`reprova: X`) e com sufixo (`X proibido`);
//   4. `catálogo` exige conectivo de ALTERNATIVA (`or|ou|/|,`) e nenhuma
//      composição (`com`, `with`, `+`) na mesma cláusula — `Use X com Y` é
//      prescrição de stack composta, não enumeração;
//   5. C5 fail-closed real: sem `exports` injetado o vocabulário reprova mesmo
//      com `.vendor-lock.json` presente (o lock não substitui a fonte de eixo);
//   6. ruído estrutural sai de A-2: registro datado, colisão do termo `H2`
//      (exige contexto de banco/teste), anti-pattern invertido e arquivo de
//      template de exemplo.
// **O instrumento é HEURÍSTICO e diz isso.** `HEURISTIC` publica tamanho de
// amostra, método do sorteio, revisor e FP/FN medidos; o `detail` do check
// publica `heuristic=true fp=<n>/<amostra> fn=<n>/<amostra>`. A baseline é a
// dívida MEDIDA por este scanner, não a verdade sobre o repo.
//
// --- Pureza e portabilidade (SPEC I1, ADR-001 §10-N4) --------------------
// `node:fs`/`node:path` read-only + `node:crypto` para o `sha256` da linha
// (hash é cálculo, não I/O). Sem rede, sem child process, sem gravação. `root`
// é injetável; a árvore nunca é mutada. Vive em `.opencode/plugins/lib/**`,
// caminho que o instalador propaga (install.mjs:107).
//
// O módulo NÃO importa `installer/` (C5 do review): `installer/` não propaga
// (install.mjs:1689), logo um import relativo de lá morre no destino com
// `ERR_MODULE_NOT_FOUND`. A fonte de eixo é INJETADA pelo adapter
// (`scripts/static-checks.mjs` importa `installer/install.mjs` e passa
// `exports`). Sem `exports` o módulo degrada para vocabulário vazio e
// `cdl-axis-vocabulary-missing` FAIL — fail-closed, nunca verde por omissão.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

// --- Vereditos (ADR-001 §2.3) --------------------------------------------
// Ordem FIXA: o primeiro passo que decide, decide. `classifyLine` devolve um
// destes ou `null` — nunca dois.
export const VERDICTS = Object.freeze([
  "condicional",
  "exemplo",
  "catálogo",
  "incondicional",
]);

// --- Rotulagem heurística (ADR-001 §2.3-ter) ------------------------------
// Medir prosa com regex move a fronteira a cada correção: o scanner tem erro
// próprio. Publicar o erro é parte do contrato — declarar FP/FN "sem método"
// ou ajustar a baseline para um número-alvo é o defeito que esta rodada fecha.
// Amostra: linhas da população com ≥1 termo do vocabulário, sorteio
// determinístico por `sha256("<arquivo>:<linha>")` crescente; veredito humano
// lido no contexto (arquivo + heading), revisor único (o autor do commit).
// `fp` = scanner disse `incondicional` e a linha NÃO é dívida (não é prescrição,
// ou é condicional/exemplo/catálogo/proibição);
// `fn` = a linha É prescritiva (merecia um dos 4 vereditos) e o scanner
// devolveu `null` — inclui a dívida perdida e a categoria perdida.
export const HEURISTIC = Object.freeze({
  heuristic: true,
  fp: 5,
  fn: 4,
  sample: Object.freeze({
    size: 90,
    classified: 42,
    candidateLines: 387,
    method:
      "amostra determinística de 90 linhas dentre as 387 da população (D7, sem vendor) com ≥1 termo do "
      + "vocabulário: ordena por sha256(\"<arquivo>:<linha>\") ascendente e toma as 90 primeiras; "
      + "FP = scanner `incondicional` com veredito humano diferente (por linha, lendo arquivo + heading); "
      + "FN = veredito humano prescritivo (qualquer dos 4) e scanner `null`",
    reviewer: "developer-engineer (autor do commit), veredito humano lido no contexto do arquivo",
    at: "2026-11-11",
  }),
});

// --- Exclusões da população (ADR-001 §2.1) -------------------------------
export const POPULATION_EXCLUSIONS = Object.freeze([
  {
    id: "X1",
    re: /^\.spec\//,
    reason: "registro datado (PRD/RESEARCH/ADR/SPEC); incluir mediria o próprio instrumento",
  },
  {
    id: "X2",
    re: /(^|\/)__tests__\//,
    reason: "dado de teste/fixture — recorte de D7 (E-4)",
  },
  {
    id: "X3",
    re: /^\.agents\/skills\/ui-ux-pro-max\/data\//,
    reason: "catálogo multi-stack: a lista de stacks É o conteúdo (E-1)",
  },
]);

const SKIPPED_DIRS = new Set(["node_modules", ".git"]);

// --- Vocabulário derivado (ADR-001 §2.2) ---------------------------------
// As CHAVES derivam do instalador (AXIS_IDS ∪ tags de `stacks` do lock); os
// TERMOS de cada chave são curados em `vocabulary.txt` — arquivo de DADO ao
// lado deste módulo. A cobertura é cobrada: eixo sem termo ⇒
// `cdl-axis-vocabulary-missing` (RF-09). O dado mora fora de código de
// propósito: o canário de adoção do instalador (`isScannablePath`,
// install.mjs:1199) escaneia código/config e isenta prosa; citar tecnologia em
// `.mjs` viraria "adoção da stack alheia" no destino limpo — o oposto do que
// este instrumento mede.
const VOCABULARY_URL = new URL("./vocabulary.txt", import.meta.url);

function parseVocabularyTable(text) {
  const vocab = {};
  const projects = [];
  let section = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      section = /eixos/i.test(heading[1])
        ? "axes"
        : /projeto/i.test(heading[1])
          ? "projects"
          : null;
      continue;
    }
    if (!section || !line.startsWith("|")) continue;
    const cells = line.slice(1, line.lastIndexOf("|")).split("|").map((c) => c.trim());
    if (!cells.length) continue;
    if (/^:?-+:?$/.test(cells[0])) continue; // separador da tabela
    if (section === "axes") {
      const [axis, terms] = cells;
      if (!axis || axis === "axis") continue;
      vocab[axis] = terms ? terms.split(",").map((t) => t.trim()).filter(Boolean) : [];
    } else {
      const [term, klass, proof, owner] = cells;
      if (!term || term === "term") continue;
      projects.push({ term, class: klass, proof, owner });
    }
  }
  return { vocab, projects };
}

const VOCABULARY = parseVocabularyTable(readFileSync(VOCABULARY_URL, "utf8"));

export const STACK_VOCAB = Object.freeze(VOCABULARY.vocab);

// SPEC RF-01 nomeia `VOCAB`; ADR-001 §3 item 1 nomeia `STACK_VOCAB`. Um
// binding, dois nomes — nenhuma divergência de contrato.
export const VOCAB = STACK_VOCAB;

// --- Registro de nomes de projeto (ADR-001 §2.2, A-1) --------------------
// Não são deriváveis de preset nenhum (são nomes do cliente). Registro
// declarado em `vocabulary.txt` com classe, prova viva e dono; entrada sem prova
// viva ⇒ `cdl-identity-term-stale`.
export const PROJECT_TERMS = Object.freeze(VOCABULARY.projects);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Termo com caractere de palavra ganha fronteira; termo com símbolo (`ri-*`,
// `*IT.java`, `-Pintegration`) casa literalmente: `Java` não casa `JavaScript`
// e um nome de framework não casa o nome do seu sucessor.
function termPattern(term) {
  const escaped = escapeRegExp(term);
  const wordLike = /^[A-Za-z0-9_.]+$/.test(term) && /[A-Za-z]/.test(term);
  return wordLike
    ? new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, "g")
    : new RegExp(escaped, "g");
}

// `Map<term, Set<axis>>` — termo cross-axis pertence a mais de um eixo.
const TERM_AXES = (() => {
  const map = new Map();
  for (const [axis, terms] of Object.entries(STACK_VOCAB)) {
    for (const term of terms) {
      if (!map.has(term)) map.set(term, new Set());
      map.get(term).add(axis);
    }
  }
  return map;
})();

const TERM_PATTERNS = [...TERM_AXES.keys()].map((term) => ({
  term,
  axes: TERM_AXES.get(term),
  re: termPattern(term),
}));

// Prefiltro barato: uma linha sem nenhum termo é descartada por um único
// `test` em vez de N. O veredito continua vindo dos padrões por termo (o
// prefiltro não decide nada).
const TERMS_ALTERNATION = TERM_PATTERNS.map((t) => escapeRegExp(t.term)).join("|");
const TERM_PREFILTER = new RegExp(TERMS_ALTERNATION);

// --- Exceções declaradas (ADR-001 §4.3, SPEC RF-07) ----------------------
// Cada entrada nomeia um predicado executável, a razão e a prova. Predicado
// morto ou prova morta ⇒ `cdl-exception-stale` (exceção obsoleta é o modo de
// falha nº 2 exigido).
export const EXCEPTIONS = Object.freeze([
  {
    id: "E-1",
    name: "catálogo multi-stack",
    reason: "a lista de stacks É o conteúdo; o arquivo inteiro é catálogo, não prescrição",
    predicate: { type: "artifact-prefix", value: ".agents/skills/ui-ux-pro-max/" },
    proof: "ls .agents/skills/ui-ux-pro-max/data/*.csv | wc -l ⇒ 14",
  },
  {
    id: "E-2",
    name: "N/A justificado inline",
    reason: "declaração de ausência de stack não é prescrição (o oposto do defeito)",
    predicate: {
      type: "line-declaration",
      file: ".agents/rules/harness-config.md",
      line: 13,
      contains: "N/A",
    },
    proof: "sed -n '13p' .agents/rules/harness-config.md ⇒ `N/A` with inline justification",
  },
  {
    id: "E-3",
    name: "identidade por design",
    reason: "D8: o nome da skill de stack É a declaração de identidade",
    predicate: {
      type: "skill-name-axis",
      value: [
        "frontend-react-specialist",
        "frontend-vue-specialist",
        "java-architecture-specialist",
        "nestjs-architecture-specialist",
        "node-architecture-specialist",
        "rust-architecture-specialist",
      ],
    },
    proof: "node --input-type=module -e 'const m=await import(\"./installer/install.mjs\");…' ⇒ 5 em SKILLS_COMMON (+1 no mapa)",
  },
  {
    id: "E-4",
    name: "dado de teste/fixture",
    reason: "recorte de D7: `__tests__/` fica fora da população (X2)",
    predicate: { type: "population-exclusion", value: "X2" },
    proof: "git ls-files '*/__tests__/*.md' | wc -l ⇒ 0",
  },
  {
    id: "E-5",
    name: "linha de skill vendorizada (upstream)",
    reason:
      "vendor é código de terceiro: `treeHash` congela os bytes, logo editar quebra "
      + "`vendor-skills --check` e baselinar cria dívida IMPAGÁVEL (ADR-001 §10-N5). "
      + "As linhas ficam fora de A-2 e do contador de proibições: medir upstream não "
      + "é medir o destino",
    predicate: { type: "vendored-skill" },
    proof: ".agents/skills/.vendor-lock.json (25 skills com `treeHash`; line-stacks por chave)",
  },
  {
    id: "E-6",
    name: "dívida estrutural de A-1 declarada (com dono)",
    reason:
      "os dois alarmes estruturais de A-1 (license fora de SPDX; termo de stack fora do "
      + "eixo declarado) NÃO são escusáveis pela entrada `identity` da BASELINE — era "
      + "assim que o alarme criado para pegar o `license:` não-SPDX deste skill se "
      + "desligava justamente ali (ADR-001 §10-N3). A escusa só existe como dívida "
      + "estrutural nomeada, com dono e predicado vivo: corrigida a linha, a exceção "
      + "fica obsoleta e o próprio check reprova",
    predicate: {
      type: "structural-offender",
      kind: "license",
      file: ".agents/skills/security-review/SKILL.md",
      line: 4,
      owner: "ADR-003",
    },
    proof: "sed -n '4p' .agents/skills/security-review/SKILL.md ⇒ `license:` não-SPDX (PRD §13)",
  },
]);

// --- Baseline (ADR-001 §2.5, SPEC I3) -----------------------------------
// Dívida declarada, nunca permissão. Entrada = { file, line, sha256, verdict,
// owner }. `verdict` ∈ {"incondicional","identity"}; `owner` ∈ ADR-002..005.
// A lista só ENCOLHE: linha editada, veredito que deixou de valer ou arquivo
// removido ⇒ `cdl-baseline-stale` (a entrada não vira permissão permanente).
// Entrada de baseline pode nomear a rule pelo SLOT do mapa de eixo do dono
// (`@rule-axis:<chave>#<índice>`) em vez do path literal: as duas rules de
// frontend são o sujeito do congelamento EX-VAL-06 (12 arquivos entregues que
// citam a rule excluída do destino react) — o path é DERIVADO da declaração
// injetada pelo adapter, nunca digitado aqui. Resolvido no `runCdlChecks`
// (nunca na carga: o módulo não importa `installer/`, C5).
const RULE_AXIS_REF = /^@rule-axis:(.+)#(\d+)$/;

function resolveBaselineEntry(entry, exports) {
  if (typeof entry.file !== "string") return entry;
  const ref = RULE_AXIS_REF.exec(entry.file);
  if (!ref) return entry;
  const slot = (exports?.RULES_BY_AXIS?.[ref[1]] ?? [])[Number(ref[2])];
  return slot ? { ...entry, file: `.agents/rules/${slot}` } : entry;
}

export const BASELINE = Object.freeze([
  {
    file: ".agents/agents/code-reviewer/PROMPT.md",
    line: 24,
    sha256: "080c8e210cdf81626ced129cc448fece9299ebf9b3bcdba83aba8198d12bd87b",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/code-reviewer/PROMPT.md",
    line: 29,
    sha256: "1af1ce79f3067199c7dc4dc2262a2d4d566b293bb62506e6c82100f401da90ab",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/code-reviewer/PROMPT.md",
    line: 61,
    sha256: "bf8b44d0ebc556be494841b8525dfe410eff1432c6bca3f6adaee76d2dc40a28",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/design-system-specialist/AGENT.md",
    line: 28,
    sha256: "4e3c2a3ded6189e2d050c88f64c836ce083772d63a3197145181de367c161513",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/design-system-specialist/AGENT.md",
    line: 42,
    sha256: "47f81221e746e6bb42538bb44f67b15caa76bd1d9784cff8ba211e5a6a130f81",
    verdict: "identity",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/developer-engineer/AGENT.md",
    line: 1,
    sha256: "275f8d98170ec380593147246b018eeef6151f7d1e37b7d85f8c7a3be9b778e6",
    verdict: "identity",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/developer-engineer/AGENT.md",
    line: 25,
    sha256: "fdb7b4d401c2a756471b9aff8ede5c44f8c0468b847d51942bbd7820b59f966c",
    verdict: "identity",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/developer-engineer/AGENT.md",
    line: 77,
    sha256: "c18c7a11d9c0cefc5170de44e5ba158f7084f036c157d8ae3243f78e17eee166",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/developer-engineer/AGENT.md",
    line: 78,
    sha256: "fcb686ffe71ae4790e5ea02540c1ae97f4fe9a8b872af3e31a7b1cbcd3986e01",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/developer-engineer/AGENT.md",
    line: 144,
    sha256: "a5a843231087121f816c0dbaf36f6f19d6c1794d990617f962a648c48ac45e78",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/orchestrator/AGENT.md",
    line: 36,
    sha256: "99e4167817f1669da507c3d9d40a236e1d925ded5a55f1876e3325979aac05e4",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/orchestrator/AGENT.md",
    line: 158,
    sha256: "6e6be13f61f8d01d973428bdbf7c3e3d9505538eb92626a5b839811bf9497e4e",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/orchestrator/AGENT.md",
    line: 323,
    sha256: "6755b1793346e5f8ac704f8f657e0f7a44f8b0f4e3b8aa9c45758201f502db38",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/orchestrator/AGENT.md",
    line: 500,
    sha256: "be650ccc0d6a0d5c6065882bdb84668564a00785eb4b621e69a615a254bc85ce",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/orchestrator/AGENT.md",
    line: 501,
    sha256: "aa1a6846d24fd5dda09f444330575e68cd179898953d83d55680f63e6139e840",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/orchestrator/AGENT.md",
    line: 502,
    sha256: "1dfd8be17201b4d422ce4cb55e605ebde68bc4a9acbc969636b15b81dee9343f",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/orchestrator/AGENT.md",
    line: 503,
    sha256: "2316b6af66d898a37e5fd40329ad7365ba956f10d582c67441cb67e345ca9010",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/orchestrator/AGENT.md",
    line: 504,
    sha256: "e9b9534027c436acf4c152a68937808f7bd7738cbc4122cb2411dfa774a89d78",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/orchestrator/AGENT.md",
    line: 619,
    sha256: "10f1d906a2bfc1bccc9c70a327fc60a941fbda865c139d6fd849c23d797399dc",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/ux-designer/AGENT.md",
    line: 32,
    sha256: "044cfe3cdc4c5f71d75041d1b55d89efb9f6f15fde22f817f2b5c23d5b49dbec",
    verdict: "identity",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/ux-designer/AGENT.md",
    line: 147,
    sha256: "6c54ee58654e2ca07520d872f8756f6a41036f8133e21b82785b4b75d13e63a5",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: "@rule-axis:frontend=react#0",
    line: 12,
    sha256: "a122ef408adab46393ee331ae75a839861ed62ac9f477184ba2c649ec72b9dfe",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: "@rule-axis:frontend=react#0",
    line: 159,
    sha256: "af686330573a7aef995ef569822668dfdc893139b6ed6c76a1c750ed7107cf1c",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: "@rule-axis:frontend=vue#0",
    line: 30,
    sha256: "f3abb89eab8f3aac6c3ac38da7add70864a646143921b1a473c8add565526f9d",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/rules/sdd-workflow-standard.md",
    line: 3,
    sha256: "875ea1fdc48bc47f9fde5be959df0e8ddd544620a373c0678ff75b776594a5cf",
    verdict: "identity",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 217,
    sha256: "970c558aa5f23a7045aebad0e7076299dcc3b98059b113bf722b871f84759f62",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 218,
    sha256: "b4132247738b7f755c9c9cf43bdda2c1593672fc5c61ab6cad918ccf8e331d8d",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 219,
    sha256: "d767bd6d8c3534b34aa5d5088a454baca343b2945543c2d75f661d972332dc88",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 225,
    sha256: "df5c5123c94c917400bd810f8846a08907f87e3c9e375d0198420c23b42ccd2c",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 435,
    sha256: "ce4d6f20aa81efef947edefb2dbc90718dbf0e0ce3a4bd4a26bb1db1a8490e23",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 436,
    sha256: "29240cf0a1442c8134becb7638424d057045aa9b3ea6e839160267741c6a4add",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 440,
    sha256: "91633dc578c81945c1c9056c0f8aef01337f8a6d09c65c60dd21f4942707a176",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 441,
    sha256: "7141f970546e952178e7230b0f06a2e9025fc31b520f42aff3e35b6af27c7203",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 442,
    sha256: "fc131278bcc3ea3e1ac01b2e580b907972d3d804ba81ee66c26cdc60f4341e9f",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 446,
    sha256: "61aba56a49d2ace433b281f83fd5c1094e08d02653983fbaaa2eee51ed7b7bcd",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 558,
    sha256: "93da5033ad9e6c1f2d9e380be2de0943d3f30d31a1c17f1317abe9ffc5ed15ba",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 559,
    sha256: "1f7f49e593a65db90a6530c466e877f5ea139aabaec619c21e6099ab28bd1221",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 560,
    sha256: "63976475b5ec9fce643f78ad8e4fe0b4573e62c56f95ae32f2318877e55e6166",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 561,
    sha256: "e21f868502c98b7c0e05c2ea6a5cd9f0d32b320d688f58884c475285a4daaff1",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 563,
    sha256: "44f7c4a09151737a604fce63afdf3d93182090058b91568b1944733cbed35e74",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/skills/dev-planner/SKILL.md",
    line: 204,
    sha256: "a8950a25fdeb7c3267c82ebb00cd8ee8bcb27e5c1f1949d2f245a01cece25866",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/dev-planner/SKILL.md",
    line: 205,
    sha256: "15b04e116c164a2f5b308d47558b089b5072b3870a547d69d4e620190c44e832",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/harness-installer/SKILL.md",
    line: 97,
    sha256: "ba4c796232e594c498781374d999d3ee220a5e44023f581cc1d4af50042a0925",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/nestjs-architecture-specialist/SKILL.md",
    line: 81,
    sha256: "4154b9c42ab98afc55b0aa114e700460dcfdd41fe2bd960fc8ffece3708d99b0",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/node-architecture-specialist/SKILL.md",
    line: 86,
    sha256: "95cfcc2402ef926640a1cf297729dcfbb77a70a168bb831933166233ff9e89b8",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/prompt-optimizer/references/clarifying-questions.md",
    line: 130,
    sha256: "a6420b60b1fcd8aaeaa453f38ce790c6a1414addc2ae53ef1b2b3c252cd72988",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/sdd-architecture-board/SKILL.md",
    line: 18,
    sha256: "511be83eb5cd5a041f7459c3e1bf73691b34b695bba611b0d66ac1e57b56140a",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/sdd-compiler/asserts/spec-gate.md",
    line: 13,
    sha256: "290d91f4c99f660adede347989454a5a8b9b618d962f640cc6a9f538ee1ee48d",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/sdd-compiler/references/backend.md",
    line: 28,
    sha256: "c45704d8d967847b8344ea39a69e1d9fc6938e624fd2f9a336fd1ee25dbe00c9",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/sdd-compiler/references/database.md",
    line: 56,
    sha256: "83b3c71c1558176093ccfe7ffd78cb3b524d4d9184db8ffbf994675481640f13",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/sdd-compiler/references/database.md",
    line: 60,
    sha256: "1c20a6437fbf826f654a75e6fe373690611bd08e71c27931dc1ef67940712ad4",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/sdd-compiler/references/frontend.md",
    line: 15,
    sha256: "d2c5d037cdb76f79d6c5d9d89fc38bd701dc2b50064323994f4e4910cb1b3053",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/security-review/SKILL.md",
    line: 3,
    sha256: "74a73a24cbf5b3046f7fe01059c906920a997a7933a15c8d2e8b20af32d515d8",
    verdict: "identity",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/security-review/SKILL.md",
    line: 4,
    sha256: "b09ad3a43b0146ce30eb3fab6db7b21f184f38946896b57bc40479d8ffedd1cb",
    verdict: "identity",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/security-review/SKILL.md",
    line: 115,
    sha256: "f778127e5b0c579bf51e68ba386b50ab2a4c3c2bb309ce2ff5b351ec3436ef09",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/security-review/SKILL.md",
    line: 166,
    sha256: "43135d7b90b14367319175e509b8f866fc08cdcd6d7b4f19e17bfd0cbab2e9f0",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/README.md",
    line: 1,
    sha256: "ece2b564031498f04456c13773248aaf504468f555f9586f707654482304c78b",
    verdict: "identity",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/README.md",
    line: 83,
    sha256: "b7d81cd77441007431d4d9bc84c365b5e11f25d9e3de1db6612935ffc1071e09",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/README.md",
    line: 111,
    sha256: "f82af833130f2a4dc8cceaa97f9c512ad23c565567d77b9acc78bed4559a1222",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/README.md",
    line: 114,
    sha256: "3469a5f9f03b82d94adc2b619ccf3298d945e4696cf420c3237d22fee9c89199",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/README.md",
    line: 115,
    sha256: "7511f47fdb5986637a83218d4ff3d75dd983ccd7b98640854aaf65213b4db0bc",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/README.md",
    line: 116,
    sha256: "dc0ba0f7a8b4dfc1a018add1fb40136562c3b0ba8a04dd0d2a3a5659daa05824",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/README.md",
    line: 141,
    sha256: "058ca03f7c1d8a6fac3fead1958a80fbcb3dc70511546dc6c024e834bb67dcf5",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/README.md",
    line: 178,
    sha256: "255f97a829bab599ef923606038577dc4e3540261f8d02f8ca690fc485034d4b",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/README.md",
    line: 179,
    sha256: "3046059c36939e610eb25c20a78da0aacfaa09b593dfe14300830ba6876689ce",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/SKILL.md",
    line: 3,
    sha256: "05d3757ed2b257a755aa83ca3ef98456766ad6f1ec079697c3815c66226ed188",
    verdict: "identity",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/SKILL.md",
    line: 8,
    sha256: "5a583e534c672076818f0893aac727f6b9f09f730c8ed1db784ec1f48840c8d9",
    verdict: "identity",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/SKILL.md",
    line: 61,
    sha256: "22dc209626d3395c2a1fb2b47ef788c1d6c356c13b27b71eb73f307f18d956ca",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/SKILL.md",
    line: 116,
    sha256: "4997d5f75d55008c0f7b3ec29f6b809c1b1223ea16091e41ab30cb49efb10443",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/SKILL.md",
    line: 164,
    sha256: "4474222d5862bc35370a334b832277176a0a16d4f8e4daf5fed6c7a71e284355",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/SKILL.md",
    line: 166,
    sha256: "78427222a6d4e54d48d2e90feabff5faac4a0934894fe7ec9b7d6844c7f22316",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/SKILL.md",
    line: 167,
    sha256: "54fcf5526e9fa66668f130b587e42b5d8f22a7ac689782eed1055e33024eb385",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/checklist.md",
    line: 1,
    sha256: "cdf2c902348a0f2ebf91a23b38f49248998c38b9447a7e12afbecdf9c47930d2",
    verdict: "identity",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/checklist.md",
    line: 48,
    sha256: "e32a9b1cb121a7082041fed3b03e60fe56d9e79977ec0d58b5b058e57418ad74",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/checklist.md",
    line: 94,
    sha256: "db800651755e751285674095b415286f39129e52ac87a373aa9e90c24814ceaa",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/checklist.md",
    line: 98,
    sha256: "14741313b631f9883db31d940f74eed23acfefc8eab6f69a548bd45c0170b6ac",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/checklist.md",
    line: 99,
    sha256: "53ccfd525333afc3fd5f5b1171a492b5da5a391143c0f75471097618a5598cfb",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/checklist.md",
    line: 106,
    sha256: "680978b99b403a55606797b91da8ce0b98dae0dd49f009c830e4e0dc25ee39bf",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/checklist.md",
    line: 117,
    sha256: "e2d70f262a845cc4624a6fec4847838faea9a7a4c8629c642e2da2eb4a6f9c3c",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/checklist.md",
    line: 120,
    sha256: "96d55f26e847b3546f7f642d5a0849deb3319f853229d8bf981beb0e59ab8126",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/checklist.md",
    line: 121,
    sha256: "aa408db0ec492d129888c53541218198090b13d885a8a0b04becd3672ecfe3da",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/checklist.md",
    line: 137,
    sha256: "c0b799a7ff67e75523518a06d586200f270508fcce6ad6f984da4bdf41e3a41e",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/checklist.md",
    line: 159,
    sha256: "65584ddc584de0406620025ba3cf44a52d88309f6d7f3ebc6a30b70cfb6f5bcb",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/checklist.md",
    line: 161,
    sha256: "d574afe2370ced716fec31544b80f2f142cf6eaf6b4b0e67900631df33fd911a",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/output-template.md",
    line: 7,
    sha256: "ef03f19636570329d01507ab9217524e016bab101b4d389e773fb1afcb0174db",
    verdict: "identity",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/usage-guide.md",
    line: 1,
    sha256: "2d7f8cdb06d724eea0f7724f45577afe93e6c48bfebd9963c141e5710bd5eac9",
    verdict: "identity",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/usage-guide.md",
    line: 3,
    sha256: "5abedc974b43ccf61b6d5efa7c1d7a2a7072e6fa0431ac3d68ae785f61c3fa98",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/usage-guide.md",
    line: 258,
    sha256: "b01ece55b13d200963c7dcbd098cba9d696216dc0515506b445a25b4cc7b77ae",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/usage-guide.md",
    line: 259,
    sha256: "3db08edcbb65a6e0812a1551278c41e7d658ba3c1781a7b5defe4924a0097c1f",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/template-best-practices/SKILL.md",
    line: 24,
    sha256: "d74c7bff20ee32d115a3c7c1f86d100ee5623628211ed769cb6feb7b0c9572ec",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/template-structure/SKILL.md",
    line: 3,
    sha256: "1b0b5ade789f02caf10c41b50ced849cea0c8b507bd7a69b0a419eda239c82f6",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/template-structure/SKILL.md",
    line: 9,
    sha256: "ac4ecb57521b9232b4f449364dfae5fa47aa5e721f21d8ca42ddcd99ae01033e",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: "@rule-axis:frontend=react#0",
    line: 154,
    sha256: "459a3e39cd4b8530e1ed2ca814c0dc1b38cf112007b60dcf09f0fa7c95b7389f",
    verdict: "identity",
    owner: "ADR-003",
  },
  {
    file: "@rule-axis:frontend=vue#0",
    line: 161,
    sha256: "459a3e39cd4b8530e1ed2ca814c0dc1b38cf112007b60dcf09f0fa7c95b7389f",
    verdict: "identity",
    owner: "ADR-003",
  },
  {
    file: "docs/INSTALACAO.md",
    line: 268,
    sha256: "922b43b50b2c53cb41a2deffe45d60fd4218f879ae63d1c361e7e0fd15385048",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: "spec-developed.md",
    line: 122,
    sha256: "e4c22b8001056a1dec50fb30828d04d1612f0ff27c2138759f41fdef9c84538f",
    verdict: "incondicional",
    owner: "ADR-005",
  },
]);

const BASELINE_VERDICTS = new Set(["incondicional", "identity"]);
const BASELINE_OWNERS = new Set(["ADR-002", "ADR-003", "ADR-004", "ADR-005"]);

// --- Helpers puros -------------------------------------------------------

export function posixPath(p) {
  return String(p).replaceAll("\\", "/").replace(/^\.\//, "");
}

export function sha256Line(line) {
  return createHash("sha256").update(line).digest("hex");
}

// Colisão de termo curto (ADR-001 §2.3-ter item 6): `H2` é banco de dados em
// `.agents/rules/*` e é o identificador de seção `H2` no contrato do runtime.
// O termo só conta quando a linha dá o contexto — sem isso o instrumento mede
// a referência bibliográfica como se fosse stack.
const TERM_CONTEXT = new Map([
  [
    "H2",
    /\b(?:banco|database|db|testcontainers|postgres(?:ql)?|jdbc|datasource|mem[óo]ria|unit[áa]ri[oa]s?|integra[çc][ãa]o|integration|testes?|tests?|testing)\b/i,
  ],
]);

function termInContext(term, line) {
  const required = TERM_CONTEXT.get(term);
  return !required || required.test(line);
}

// Termos presentes na linha, cada um com o conjunto de eixos que os declara.
export function termsOf(line) {
  if (!TERM_PREFILTER.test(line)) return [];
  const hits = [];
  for (const { term, axes, re } of TERM_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(line) && termInContext(term, line)) {
      hits.push({ term, axes: axes });
    }
  }
  return hits;
}

// --- Fonte de eixo -------------------------------------��------------------

function lockSkills(root) {
  try {
    const parsed = JSON.parse(
      readFileSync(join(root, ".agents", "skills", ".vendor-lock.json"), "utf8"),
    );
    const skills = parsed && parsed.skills;
    return skills && typeof skills === "object" && !Array.isArray(skills) ? skills : {};
  } catch {
    return {};
  }
}

function ruleAxisExclusion(rel, exports) {
  for (const [key, values] of Object.entries(exports.RULES_BY_AXIS ?? {})) {
    if (!values.includes(rel)) continue;
    const [axis, id] = key.split("=");
    const ids = exports.AXIS_IDS?.[axis] ?? [];
    return ids.filter((x) => x !== id);
  }
  return null;
}

function skillAxisExclusion(name, exports) {
  for (const [key, values] of Object.entries(exports.SKILLS_BY_AXIS ?? {})) {
    if (!values.includes(name)) continue;
    const [axis, id] = key.split("=");
    const ids = exports.AXIS_IDS?.[axis] ?? [];
    return ids.filter((x) => x !== id);
  }
  return null;
}

// Derivação em ordem (ADR-001 §2.3): lock → mapa de exclusão → nome da skill
// → ∅. Nunca do nome *isolado*: o segmento só vale para skill local sem lock.
// O fecho `flutter ⇒ dart` é DECLARADO em `STACKS_FOR_EXCEPTIONS` (a mesma
// exceção que o instalador usa para `stacks`): skill Flutter declara Dart.
export function declaredAxis(artifact, exports = DEFAULT_EXPORTS, lock = null) {
  const path = posixPath(artifact);
  const skill = /^\.agents\/skills\/([^/]+)(\/|$)/.exec(path);
  const skills = lock ?? {};
  const close = (axes) => {
    const out = new Set(axes);
    for (const pair of Object.values(exports.STACKS_FOR_EXCEPTIONS ?? {})) {
      if (pair.some((id) => out.has(id))) for (const id of pair) out.add(id);
    }
    return out;
  };
  if (skill) {
    const name = skill[1];
    const entry = skills[name];
    const stacks = entry && Array.isArray(entry.stacks) ? entry.stacks : [];
    if (entry) return close(stacks); // vendor: `stacks` do lock, nunca o nome
    const excluded = skillAxisExclusion(name, exports);
    if (excluded) return close(excluded); // mapa de EXCLUSÃO: complemento
    const ids = new Set(Object.values(exports.AXIS_IDS ?? {}).flat());
    const segment = name.split("-").find((s) => ids.has(s));
    return segment ? close([segment]) : new Set(); // E-3/D8
  }
  if (path.startsWith(".agents/rules/")) {
    const rel = path.slice(".agents/rules/".length);
    const excluded = ruleAxisExclusion(rel, exports);
    if (excluded) return close(excluded);
  }
  // RULES_COMMON, SKILLS_COMMON, agentes, docs: ∅ por construção — comum a
  // todos NÃO confere eixo (prescrição de stack aqui é incondicional).
  return new Set();
}

// --- Vocabulário: cobertura cobrada --------------------------------------

// Marcador de fonte ausente (C5). Não é nome de eixo: é a declaração de que
// ninguém injetou `exports` — e por isso o resultado é FAIL, nunca PASS.
export const AXIS_SOURCE_MISSING = "<fonte-de-eixo-ausente>";

export function axisIdsOf(exports = DEFAULT_EXPORTS, lock = {}) {
  const ids = new Set(Object.values(exports.AXIS_IDS ?? {}).flat());
  for (const entry of Object.values(lock)) {
    for (const stack of entry?.stacks ?? []) ids.add(stack);
  }
  return ids;
}

export function missingVocabulary(exports = DEFAULT_EXPORTS, lock = {}) {
  // Fail-closed (C5 de §2.3-ter): sem `exports` injetado NÃO há fonte de eixo —
  // o `.vendor-lock.json` sozinho não a substitui. O predicado anterior deixava
  // o lock preencher `ids`, cada id era encontrado no vocabulário do módulo e a
  // cobertura publicava PASS com a fonte ausente (`missingVocabulary({}, lock)`
  // ⇒ `[]`). Fonte ausente = FAIL, com ou sem lock.
  const axisIds = Object.keys(exports?.AXIS_IDS ?? {});
  if (axisIds.length === 0) return [AXIS_SOURCE_MISSING];
  const ids = axisIdsOf(exports, lock);
  const missing = [];
  for (const id of ids) {
    if (!Object.prototype.hasOwnProperty.call(exports.STACK_VOCAB ?? STACK_VOCAB, id)) {
      missing.push(id);
    }
  }
  return missing.sort();
}

// --- População -----------------------------------------------------------

// `git ls-files '*.md'` sem child process: a walk lê a árvore, aplica as três
// exclusões nomeadas e conta NEWLINE (semântica de `wc -l`).
export function derivePopulation(root = process.cwd()) {
  const files = [];
  const walk = (rel) => {
    let entries;
    try {
      entries = readdirSync(join(root, rel || "."), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) walk(path);
        continue;
      }
      if (!entry.isFile() || !path.endsWith(".md")) continue;
      if (POPULATION_EXCLUSIONS.some((x) => x.re.test(path))) continue;
      files.push(path);
    }
  };
  walk("");
  files.sort();

  const byFile = new Map();
  let lines = 0;
  for (const file of files) {
    let text;
    try {
      text = readFileSync(join(root, file), "utf8");
    } catch {
      continue;
    }
    const newlines = (text.match(/\n/g) ?? []).length;
    lines += newlines;
    const content = text.split("\n");
    if (content.length && content[content.length - 1] === "") content.pop();
    byFile.set(file, content);
  }
  return { root, files, lines, byFile };
}

// --- Rubrica -------------------------------------------------------------

const TABLE_CHECKBOX = /^\s*\|.*\[[ xX]\]/;
const LIST_CHECKBOX = /^\s*(?:[-*+]|\d+\.)\s+\[[ xX]\]\s+/;
const LIST_ITEM = /^(\s*)(?:[-*+]|\d+\.)\s+/;
// Item de lista que é CITAÇÃO de artefato (`- \`rule.md\` — descrição`), não
// instrução: menção/referência pelo passo 1, tratada por A-3, não por A-2.
const REFERENCE_ITEM = /^\s*(?:[-*+]|\d+\.)\s+`[^`]+`\s*(?:[—–-]|:)\s*/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^\s*(?:```|~~~)/;
const PICO_OPEN = /^\s*<(context|acceptance|task|constraints)>\s*$/i;
const PICO_CLOSE = /^\s*<\/(context|acceptance|task|constraints)>\s*$/i;
const BLOCKQUOTE = /^\s*>/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|?[\s:|-]*-{2,}[\s:|-]*\|?\s*$/;

// Marcador normativo — imperativo/modal/estado obrigatório. É o que separa
// "instrução" de "menção" no passo 1 da rubrica. Os verbos de §2.3-ter item 2
// entram aqui: o corpus prescreve com `Verifique`/`Configure`/`Analise`/
// `Substituir`/`rode`/`garanta` e com o rótulo temporal `Ao final`.
const NORMATIVE_SOURCE = [
    "\\bMUST\\b", "\\bSHOULD\\b", "\\bDEVE[M]?\\b", "\\bDEVEM\\b", "\\bobrigat[óo]ri[oa]s?\\b",
    "\\bNUNCA\\b", "\\bSEMPRE\\b", "\\bnever\\b", "\\balways\\b", "\\brequired\\b",
    "\\bProibido\\b", "\\bproibid[oa]s?\\b", "\\bproibida\\b", "\\bUse\\b", "\\buse\\b",
    "\\bUsar\\b", "\\busar\\b", "\\busa\\b", "\\bEscreva\\b", "\\bescreva\\b", "\\bEscrever\\b",
    "\\bCriar\\b", "\\bcriar\\b", "\\bVerificar\\b", "\\bverificar\\b", "\\bVerifique\\b",
    "\\bverifique\\b", "\\bVerifica\\b", "\\bConfigure\\b", "\\bconfigure\\b", "\\bConfigurem\\b",
    "\\bAnalise\\b", "\\banalise\\b", "\\bAnalisar\\b", "\\bSubstituir\\b", "\\bsubstituir\\b",
    "\\bSubstitua\\b", "\\bsubstitua\\b", "\\bRode\\b", "\\brode\\b", "\\bGaranta\\b",
    "\\bgaranta\\b", "\\bAo final\\b", "\\bPor fim\\b", "\\bExecutar\\b",
    "\\bexecutar\\b", "\\bRodar\\b", "\\brodar\\b", "\\bpreferencial(?:mente)?\\b",
    "\\bEvite\\b", "\\bevite\\b", "\\bEvitar\\b", "\\bevitar\\b", "\\bViola\\b",
    "\\bNot\\b", "\\bAvoid\\b", "\\bDON'T\\b",
    "\\bDo not\\b", "\\bFerramentas:", "\\bExecução:", "\\bTooling:", "\\bRule:",
  ].join("|");

const NORMATIVE = new RegExp(NORMATIVE_SOURCE);

// Heading NORMATIVO (passo 1c): um item de lista só é prescrição quando o
// heading que o delimita declara norma. "Item solto não basta" — o predicado v1
// aceitava qualquer bullet, e era assim que sumário e amostra entravam como
// dívida (ADR-001 §2.3-bis, C1/C2 do review). Headings TOPICAIS (§2.3-ter
// item 2) declaram o assunto da seção e, por isso, também delimitam norma:
// `### Testes`, `### DDD Modular`, `### Performance`.
const NORMATIVE_HEADING = new RegExp(
  [
    "\\bregras?\\b", "\\brules?\\b", "\\bobrigat[óo]ri[oa]s?\\b",
    "\\brequisitos?\\b", "\\brequirements?\\b", "\\bcontrato\\b", "\\bcontract\\b",
    "\\bprotocolo\\b", "\\bprotocol\\b", "\\bpadr[ãa]o\\b", "\\bpadr[õo]es\\b",
    "\\bstandards?\\b", "\\bconven[çc][õo]es\\b", "\\bconventions?\\b", "\\bchecklist\\b",
    "\\bpol[íi]tica\\b", "\\bpolicy\\b", "\\bproibid[oa]s?\\b", "\\binviol[áa]ve(?:l|is)\\b",
    "\\bnunca\\b", "\\bnever\\b", "\\bmust\\b", "\\bdeve[m]?\\b", "\\bsempre\\b",
    "\\balways\\b", "\\bnon-negotiable\\b", "\\bprocedimento\\b", "\\bworkflow\\b",
    "\\btestes?\\b", "\\btests?\\b", "\\btesting\\b", "\\bddd\\b", "\\bperformance\\b",
    "\\bseguran[çc]a\\b", "\\bsecurity\\b", "\\barquitetura\\b", "\\barchitecture\\b",
    "\\bbanco de dados\\b", "\\bdatabase\\b", "\\bpersist[êe]ncia\\b", "\\bpersistence\\b",
    "\\bcomandos?\\b", "\\bcommands?\\b", "\\bbuild\\b", "\\bharness\\b", "\\be2e\\b",
    "\\bgreenfield\\b",
  ].join("|"),
  "i",
);

// Proibição POR TERMO (passo 2, D2, C3 do review). A negação vale por termo:
// (a) imediatamente antes dele — com code/ênfase/aspas no meio (`Sem \`<termo>\``,
//     `Proibido \`<termo>\``) e com o verbo de uso opcional;
// (b) por ESCOPO de cláusula — um marcador antes do termo proíbe até o fim da
//     cláusula, a menos que um verbo de prescrição reinicie o escopo
//     (`Proibido no unitário: <termo>`, `reprova: \`<termo>\``);
// (c) depois do termo — `X é proibido`, `X proibido`, `X NÃO usado`.
// Caixa é irrelevante: `Não`/`NÃO`/`Nunca`/`Evitar`/`Evite`/`Sem` valem igual.
const PROHIBITION_MARKER =
  "(?:nunca|never|jamais|nenhum[a]?|n[ãa]o|nao|don'?t|do not|must not|avoid|evite|evitar|proibid[oa]s?|proibido|banid[oa]s?|sem|reprova(?:m|r)?|forbidden|prohibited)";
const PROHIBITION_VERB = "(?:(?:use|usar|utilize|utilizar|usa|usam|using|uses)\\s+(?:o\\s+|a\\s+)?)?";
const NEGATION_BEFORE = new RegExp(
  `(?:^|[\\s(*_"\`\\[,;:—–-])${PROHIBITION_MARKER}[\\s,;:\`*_"'()\\[\\]—–-]*${PROHIBITION_VERB}$`,
  "i",
);
const FORBIDDEN_AFTER =
  /^[\s`*_)"'\]]*(?:(?:é|e|is|são)\s+(?:proibid[oa]s?|banid[oa]s?|forbidden|prohibited)|(?:n[ãa]o|nao)\s+usad[oa]s?|proibid[oa]s?|banid[oa]s?|forbidden|prohibited)\b/i;

// Verbo de prescrição que REINICIA o escopo de proibição: `Proibido X, prefira Y`
// proíbe X e prescreve Y. O verbo da própria negação (`não use`) é consumido
// antes da busca, senão `Não use X` prescreveria X.
const PRESCRIPTION_RESET = /\b(?:use|usar|utilize|utilizar|prefira|preferir|mantenha|adote|adotar)\b/i;
const USE_VERB_WORDS = "(?:use|usar|utilize|utilizar|usa|usam|using|uses)";
const HEAD_VERB = new RegExp(`^\\s*${USE_VERB_WORDS}\\b`, "i");
const MARKER_GLOBAL = new RegExp(PROHIBITION_MARKER, "gi");
// "Nenhuma anotação <termo>": quantificador negativo + até 2 palavras antes do
// termo. `nenhum[a]?`/`zero` não são verbos de uso, então não colidem com o
// escopo de prescrição.
const QUANTIFIER_BEFORE =
  /(?:^|[\s(*_`"'\[,;:—–-])(?:nenhum[a]?|zero)\s+(?:[A-Za-zÀ-ÿ]+\s+){0,2}$/i;

// Escopo de proibição só dentro da CLÁUSULA/CÉLULA: `|` separa células de
// tabela, e a célula `Não usar <A>/<B>` proíbe os dois termos sem
// contaminar as outras células da mesma linha.
const PROHIBITION_CLAUSE_SPLIT = /;|(?<=[.!?])\s+|\s+[—–]\s+|\|/;
const CLAUSE_HEAD = /^[\s>*_`"'([\-+|]+/;
const HEAD_MARKER = new RegExp(`^(?:${PROHIBITION_MARKER})\\b`, "i");
// Rótulo de rejeição: `Proibido no unitário: X`, `código reprova: X`. Só verbos
// de REJEIÇÃO entram aqui — `não`/`sem` soltos antes de dois-pontos descrevem
// condição (`Se não estiver: ...`), não proibição.
const REJECTION_LABEL =
  /\b(?:proibid[oa]s?|proibido|banid[oa]s?|reprova(?:m|r)?|forbidden|prohibited)\b[^.:;|]{0,40}:\s*/i;

function prohibitionClausesOf(line) {
  return line.split(PROHIBITION_CLAUSE_SPLIT).filter((c) => c.trim() !== "");
}

// Cláusula que COMEÇA com marcador de proibição proíbe todos os seus termos,
// até um verbo de prescrição reiniciar o escopo.
function headProhibits(clause, index) {
  const head = clause.replace(CLAUSE_HEAD, "").replace(/^\*\*/, "");
  if (!HEAD_MARKER.test(head)) return false;
  const lead = Math.max(0, clause.indexOf(head));
  const afterVerb = head.replace(
    new RegExp(`^(?:${PROHIBITION_MARKER})\\b(?:\\s*${USE_VERB_WORDS}\\b)?`, "i"),
    "",
  );
  const consumed = head.length - afterVerb.length;
  const reset = PRESCRIPTION_RESET.exec(afterVerb);
  if (!reset) return true;
  return lead + consumed + reset.index > index;
}

function prohibitionAppliesBefore(clause, index) {
  if (NEGATION_BEFORE.test(clause.slice(0, index))) return true;
  if (QUANTIFIER_BEFORE.test(clause.slice(0, index))) return true;
  if (headProhibits(clause, index)) return true;
  const label = REJECTION_LABEL.exec(clause);
  if (label && label.index + label[0].length <= index) {
    const between = clause.slice(label.index + label[0].length, index);
    return !PRESCRIPTION_RESET.test(between.replace(HEAD_VERB, ""));
  }
  return false;
}

// Célula de tabela que declara stack/ferramenta/comando (passo 1d). É a forma
// CANÔNICA de prescrever neste repo (tabelas de stack das rules e dos
// agentes), invisível ao predicado v1.
const TABLE_DECLARATIVE = new RegExp(
  [
    "\\bframework\\b", "\\bstack\\b", "\\btecnologias?\\b", "\\btechnology\\b",
    "\\bferramentas?\\b", "\\btools?\\b", "\\bbibliotecas?\\b", "\\blibrar(?:y|ies)\\b",
    "\\bruntime\\b", "\\blinguagens?\\b", "\\blanguages?\\b", "\\bbancos?\\b", "\\bdatabase\\b",
    "\\borm\\b", "\\bpersist[êe]ncia\\b", "\\bpersistence\\b", "\\btestes?\\b", "\\btests?\\b",
    "\\btesting\\b", "\\bbuild\\b", "\\bcomandos?\\b", "\\bcommands?\\b", "\\bdepend[êe]ncias?\\b",
    "\\bdependenc(?:y|ies)\\b", "\\bpackages?\\b", "\\bpacotes?\\b",
    "\\bfrontend\\b", "\\bbackend\\b",
  ].join("|"),
  "i",
);
const COMMAND_WORD =
  /(?:^|[\s`($>])(?:mvn|npm|npx|pnpm|yarn|cargo|flutter|dart|gradle|dotnet|docker|git)\b/i;
const PINNED_STACK = new RegExp(`^[\\s*_\`]*(?:${TERMS_ALTERNATION})[^,;|]{0,24}\\d`, "i");

// Prosa declarativa com cópula/determinação de stack (passo 1e):
// "A stack do destino é Spring Boot 3 com Maven." — afirma a stack, não a
// menciona. Exige sujeito de stack + cópula/verbo na MESMA linha do termo.
// `\b` NÃO serve antes de `é`/`são` (caractere não-ASCII não forma fronteira
// com espaço); a alternância usa lookbehind/lookahead de letra explícitos —
// senão `A stack é Spring Boot.` continua invisível (ADR-001 §2.3-ter item 1).
const STACK_SPECIFIER =
  /\b(stack|backend|frontend|framework|tecnologia|technology|runtime|linguagem|language|banco(?: de dados)?|database|orm|build|test runner|ferramenta)\b/i;
const STACK_COPULA =
  /(?<![A-Za-zÀ-ÿ0-9_])(?:é|são|usa|usam|utiliza|utilizam|adota|adotam|com|using|uses|requires?)(?![A-Za-zÀ-ÿ0-9_])/i;

function tableCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

const EXAMPLE_MARKERS = /\bex\.?:|\be\.g\.|\bexemplo\b|\bfor example\b/i;

function axisOfLine(line) {
  const axes = new Set();
  for (const { axes: termAxes } of termsOf(line)) {
    for (const axis of termAxes) axes.add(axis);
  }
  return axes;
}

function namesAxis(line) {
  return axisOfLine(line).size > 0;
}

// Gate explícito na própria linha: `backend=java`, `Frontend:`, `If React`,
// `**Spring Boot**:`. O keyword condicional precisa do TERMO na sequência —
// "when{Action}_then{Expected}" é nome de padrão, não gate. O par
// `backend`/`frontend` seguido de `=`/`:` só é gate quando o VALOR é um id de
// eixo: `Backend: mvn compile` é prescrição de comando, não condição
// (`mvn` não é eixo) — o predicado v2 o classificava como `condicional`.
const AXIS_ID_SET = new Set(Object.keys(STACK_VOCAB));

function explicitGate(line) {
  const backendFrontend = /\b(?:backend|frontend)\s*[=:]\s*([A-Za-z][A-Za-z0-9_-]*)\b/gi;
  for (const m of line.matchAll(backendFrontend)) {
    if (AXIS_ID_SET.has(m[1].toLowerCase())) return true;
  }
  const conditional = new RegExp(
    `(?:\\bif\\b|\\bse\\b|\\bquando\\b|\\bwhen\\b)[^.{}]{0,30}(?:${TERMS_ALTERNATION})`,
    "i",
  );
  if (conditional.test(line)) return true;
  // Rótulo que NOMEIA a stack (`**Spring Boot**:`, `Frontend React:`) é gate.
  // Rótulo que só nomeia o eixo de trabalho (`Unit backend:`) não é: o termo
  // tem de estar no rótulo, não apenas no corpo da linha.
  const label = /^\s*(?:[-*+]|\d+\.)?\s*(?:\*\*)?([A-Z][A-Za-z0-9 .()/-]{0,40}?)(?:\*\*)?\s*:\s+/.exec(line);
  if (label && namesAxis(label[1])) return true;
  return false;
}

// Gate no escopo: heading delimitante OU bullet ancestral nomeia eixo.
function scopeGate(ctx) {
  if (ctx.heading && namesAxis(ctx.heading)) return true;
  for (const ancestor of ctx.ancestors ?? []) {
    if (namesAxis(ancestor)) return true;
  }
  return false;
}

// Cláusulas de uma linha: `;`, `. ` e ` — ` separam afirmações. O passo 1a
// exige marcador normativo e termo na MESMA cláusula (senão "Use X. Faça Y
// com Z" viraria uma única norma sobre Z).
function clausesOf(line) {
  return line.split(/;|(?<=[.!?])\s+|\s+[—–]\s+/).filter((c) => c.trim() !== "");
}

function normativeClause(line) {
  return clausesOf(line).some((clause) => NORMATIVE.test(clause) && termsOf(clause).length > 0);
}

function tableDeclaresStack(line, ctx = {}) {
  if (!TABLE_ROW.test(line)) return false;
  const cells = tableCells(line);
  if (cells.some((cell) => TABLE_DECLARATIVE.test(cell))) return true;
  if (ctx.tableHeader && tableCells(ctx.tableHeader).some((cell) => TABLE_DECLARATIVE.test(cell))) {
    return true;
  }
  // Célula que fixa versão de stack (`Spring Boot 3`, `Vue 3.5 + TypeScript`).
  if (cells.some((cell) => PINNED_STACK.test(cell))) return true;
  // Célula que é um COMANDO de build/execução citando tecnologia (inline code
  // ou prompt): sem o marcador de código, `Java` no meio de prosa não é comando.
  if (cells.some((cell) => /`[^`]+`/.test(cell) && COMMAND_WORD.test(cell))) return true;
  return false;
}

function declarativeStack(line) {
  if (LIST_ITEM.test(line) || TABLE_ROW.test(line) || HEADING.test(line)) return false;
  return STACK_SPECIFIER.test(line) && STACK_COPULA.test(line);
}

// Passo 1: a linha é prescritiva? (a) marcador normativo + termo na mesma
// cláusula; (b) checkbox (tabela ou item); (c) item de lista SOB HEADING
// NORMATIVO; (d) linha de tabela cujo cabeçalho/célula declara stack;
// (e) prosa declarativa com cópula de stack. Sem isso a linha é
// menção/referência — não recebe veredito (A-3 é quem trata path).
// Exportada para diagnóstico/teste: `classifyLine` ainda exige TERMO (A-2 =
// prescritiva **com** termo), então o predicado puro é medido à parte.
export function isPrescriptive(line, ctx = {}) {
  if (TABLE_CHECKBOX.test(line) || LIST_CHECKBOX.test(line)) return true;
  if (normativeClause(line)) return true;
  if (declarativeStack(line) && termsOf(line).length > 0) return true;
  if (tableDeclaresStack(line, ctx)) return true;
  if (
    LIST_ITEM.test(line)
    && !REFERENCE_ITEM.test(line)
    && ctx.heading
    && (NORMATIVE_HEADING.test(ctx.heading) || namesAxis(ctx.heading))
  ) {
    return true;
  }
  return false;
}

// Passo 2 (D2): termos da linha que a própria linha PROÍBE. Avaliado termo a
// termo (C3): `Use X; NUNCA use Y` proíbe Y e prescreve X na mesma linha —
// cada um conta no seu lugar.
export function prohibitedTermsOf(line) {
  const out = [];
  for (const clause of prohibitionClausesOf(line)) {
    for (const { term } of termsOf(clause)) {
      const re = new RegExp(escapeRegExp(term), "g");
      let match;
      while ((match = re.exec(clause)) !== null) {
        const index = match.index;
        const tail = clause.slice(index + match[0].length);
        if (prohibitionAppliesBefore(clause, index) || FORBIDDEN_AFTER.test(tail)) {
          out.push(term);
          break;
        }
        re.lastIndex = index + 1;
      }
    }
  }
  return out;
}

export function prohibitionOf(line) {
  return prohibitedTermsOf(line).length > 0;
}

// Passo 4: catálogo. Enumeração de ALTERNATIVAS (§2.3-ter item 4): na MESMA
// cláusula, ≥2 termos de eixos disjuntos ligados por conectivo de alternativa
// (`or`, `ou`, `/`, `,`) e SEM composição (`com`, `with`, `+`). `Use Spring Boot
// com React no mesmo artefato` é prescrição de stack composta — `incondicional`,
// não catálogo. Um termo cross-axis sozinho (`Vitest`) não enumera dois eixos.
const COMPOSITION = /(?:\bcom\b|\bwith\b|\+)/i;
const ALTERNATIVE_JOINED = new RegExp(
  `(?:${TERMS_ALTERNATION})[^;.|]{0,40}(?:\\bor\\b|\\bou\\b|/|,)[^;.|]{0,40}(?:${TERMS_ALTERNATION})`,
  "i",
);

function isCatalogue(line, hits) {
  if (hits.length < 2) return false;
  for (const clause of clausesOf(line)) {
    const clauseHits = termsOf(clause);
    if (clauseHits.length < 2) continue;
    if (COMPOSITION.test(clause)) continue;
    const disjoint = clauseHits.some((a, i) =>
      clauseHits.some((b, j) => i !== j && [...a.axes].every((axis) => !b.axes.has(axis))),
    );
    if (disjoint && ALTERNATIVE_JOINED.test(clause)) return true;
  }
  return false;
}

// "termo entre aspas": o termo aparece dentro de uma citação (`"..."` ou
// `'...'`) — a citação é forma de exemplo, não de norma. Backtick é formatação
// de código, não citação.
function quotedTermSpan(line) {
  const spans = line.matchAll(/(["'])([^"']{0,140})\1/g);
  for (const span of spans) {
    if (termsOf(span[2]).length) return true;
  }
  return false;
}

// Ruído estrutural (§2.3-ter item 6) — formas que não são norma para o destino:
//   · registro datado de tabela (`| 2026-10-20 | feat | ... |`) é memória, não
//     instrução;
//   · arquivo de TEMPLATE (`*-template.md`, `templates/*.md`) é exemplo de
//     forma — as linhas são amostra, não prescrição;
//   · catálogo de anti-patterns (`anti-patterns.md`) descreve o que evitar na
//     forma invertida (`Usar JNDI`) — a linha é exemplo do padrão ruim.
const DATED_RECORD = /^\s*\|\s*\d{4}-\d{2}-\d{2}\s*\|/;
const ARTIFACT_TEMPLATE = /(?:^|\/)(?:[^/]*template[^/]*\.md|templates\/[^/]+\.md)$/i;
const ARTIFACT_ANTI_PATTERN = /(?:^|\/)anti-?patterns?\.md$/i;

/**
 * classifica UMA linha. `ctx` carrega o que é escopo, não julgamento:
 *   { artifact, axis: Set, heading, tableHeader, ancestors: string[], inFence,
 *     inPico, inQuote, catalogueFile, templateFile, antiPatternFile }
 * Devolve UM veredito ou `null` (não-prescritiva, ou proibição por D2).
 */
export function classifyLine(line, ctx = {}) {
  if (DATED_RECORD.test(line)) return null;
  const hits = termsOf(line);
  if (!hits.length) return null;
  // D2 avaliado POR TERMO: o termo proibido não consome veredito, o resto da
  // linha continua sendo norma — `Use X; NUNCA use Y` prescreve X e proíbe Y,
  // em vez de evaporar como um todo.
  const prohibited = new Set(prohibitedTermsOf(line));
  const allowed = hits.filter((h) => !prohibited.has(h.term));
  if (!allowed.length) return null;
  if (!isPrescriptive(line, ctx)) return null;
  // E-2: declaração de ausência de stack não é prescrição.
  if (ctx.absenceDeclaration) return null;

  // 3. exemplo
  if (
    ctx.inFence ||
    ctx.inPico ||
    ctx.inQuote ||
    ctx.templateFile ||
    ctx.antiPatternFile ||
    EXAMPLE_MARKERS.test(line) ||
    quotedTermSpan(line)
  ) {
    return "exemplo";
  }

  // 4. catálogo
  if (ctx.catalogueFile) return "catálogo";
  if (isCatalogue(line, allowed)) return "catálogo";

  // 5. condicional
  if (explicitGate(line) || scopeGate(ctx)) return "condicional";
  const declared = ctx.axis instanceof Set ? ctx.axis : new Set(ctx.axis ?? []);
  if (declared.size > 0) {
    // Termo cross-axis (`shadcn`, `Vitest`) está coberto quando QUALQUER um
    // dos seus eixos é declarado: o artefato fala de um dos donos do termo.
    const all = allowed.every((h) => [...h.axes].some((axis) => declared.has(axis)));
    if (all) return "condicional";
  }

  // 6. incondicional
  return "incondicional";
}

// --- Contexto de varredura ----------------------------------------------

function exceptionForLine(line, exceptions, population) {
  for (const entry of exceptions) {
    const p = entry.predicate ?? {};
    if (p.type === "line-declaration" && p.file && line.file === posixPath(p.file)) {
      const content = population.byFile.get(posixPath(p.file))?.[p.line - 1] ?? "";
      if (content.includes(p.contains ?? "")) return entry;
    }
    if (p.type === "population-exclusion") return entry;
  }
  return null;
}

function catalogueFileOf(artifact, exceptions) {
  for (const entry of exceptions) {
    const p = entry.predicate ?? {};
    if (p.type === "artifact-prefix" && artifact.startsWith(p.value)) return entry;
  }
  return null;
}

// Percorre a população mantendo o estado que a rubrica consome (fence, PICCO,
// blockquote, heading delimitante, cabeçalho de tabela, bullets ancestrais por
// indentação).
function analyseFile(root, file, axis, exceptions, population, projectTerms = PROJECT_TERMS) {
  const lines = population.byFile.get(file) ?? [];
  const verdicts = [];
  const identity = [];
  const licence = [];
  const prohibitions = [];
  const headings = [];
  let bullets = [];
  let inFence = false;
  let inPico = false;
  let tableHeader = null;
  let previousRow = null;
  const catalogue = catalogueFileOf(file, exceptions);
  const templateFile = ARTIFACT_TEMPLATE.test(file);
  const antiPatternFile = ARTIFACT_ANTI_PATTERN.test(file);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const n = i + 1;

    if (FENCE.test(line)) {
      inFence = !inFence;
      tableHeader = null;
      previousRow = null;
      continue;
    }
    if (PICO_OPEN.test(line)) {
      inPico = true;
      bullets = [];
      continue;
    }
    if (PICO_CLOSE.test(line)) {
      inPico = false;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      while (headings.length && headings[headings.length - 1].level >= level) headings.pop();
      headings.push({ level, text: heading[2] });
      bullets = [];
      tableHeader = null;
      previousRow = null;
    }
    // A linha separadora da tabela promove a linha anterior a CABEÇALHO: é o
    // que permite julgar a célula pelo que a coluna declara (passo 1d).
    if (TABLE_SEPARATOR.test(line)) {
      tableHeader = previousRow;
      previousRow = null;
    } else if (TABLE_ROW.test(line)) {
      previousRow = line;
    } else if (line.trim() !== "") {
      tableHeader = null;
      previousRow = null;
    }
    const item = LIST_ITEM.exec(line);
    let ancestors = bullets.map((b) => b.text);
    if (item) {
      const indent = item[1].length;
      while (bullets.length && bullets[bullets.length - 1].indent >= indent) bullets.pop();
      // O próprio item NÃO é ancestral de si mesmo: o gate de escopo olha o
      // heading e os bullets PAI (indentação), nunca a linha em análise.
      ancestors = bullets.map((b) => b.text);
      bullets.push({ indent, text: line });
    } else if (line.trim() === "" || HEADING.test(line)) {
      bullets = [];
    }

    // A-1: posição identitária (heading, `description:`, `license:`, prosa
    // "neste/no projeto X") com termo de projeto registrado.
    const identityPos =
      /^(#{1,6}\s|description:|license:)/.test(line) ||
      /(neste|no) projeto [A-Z]/.test(line);
    const projectHit = projectTerms.some((p) => line.includes(p.term));
    if (identityPos && projectHit) identity.push({ line: n, text: line });
    if (/^\s*license:/i.test(line)) licence.push({ line: n, text: line });

    // E-2: linha declarada como ausência de stack — não é prescrição nem
    // proibição; o predicado da exceção nomeia arquivo:linha.
    const absence = exceptionForLine({ file, line: n }, exceptions, population);
    const ctx = {
      artifact: file,
      axis,
      heading: headings.length ? headings[headings.length - 1].text : null,
      tableHeader,
      ancestors,
      inFence,
      inPico,
      inQuote: BLOCKQUOTE.test(line),
      catalogueFile: Boolean(catalogue),
      templateFile,
      antiPatternFile,
      absenceDeclaration: Boolean(absence && absence.predicate?.type === "line-declaration"),
    };
    const verdict = classifyLine(line, ctx);
    if (verdict) verdicts.push({ line: n, text: line, verdict });
    // D2 é contada INDEPENDENTE do veredito: numa linha mista
    // (`Use X; NUNCA use Y`) os dois contam (C3).
    if (!ctx.absenceDeclaration) {
      const forbidden = prohibitedTermsOf(line);
      if (forbidden.length) prohibitions.push({ line: n, text: line, terms: forbidden });
    }
  }
  return { verdicts, identity, licence, catalogue: Boolean(catalogue), prohibitions };
}

// --- Payload do instalador (ADR-001 §3 item 3) ---------------------------

function walkMarkdown(root, rel) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(join(root, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) walk(path);
      } else if (entry.isFile() && path.endsWith(".md")) {
        out.push(path);
      }
    }
  };
  walk(posixPath(rel));
  return out;
}

// Derivado dos exports/roster/lock — nunca de lista escrita à mão. Só conta o
// que existe no disco: artefato declarado e ausente é `cdl-axis-declaration-
// phantom`, não gap de população.
export function derivePayload(root = process.cwd(), exports = DEFAULT_EXPORTS, lock = {}) {
  const out = new Set();
  for (const rule of [...(exports.RULES_COMMON ?? []), ...Object.values(exports.RULES_BY_AXIS ?? {}).flat()]) {
    out.add(`.agents/rules/${posixPath(rule)}`);
  }
  for (const skill of [...(exports.SKILLS_COMMON ?? []), ...Object.values(exports.SKILLS_BY_AXIS ?? {}).flat()]) {
    for (const file of walkMarkdown(root, `.agents/skills/${skill}`)) out.add(file);
  }
  for (const skill of Object.keys(lock)) {
    for (const file of walkMarkdown(root, `.agents/skills/${skill}`)) out.add(file);
  }
  // Roster: `{file:...}` dos prompts de agente, resolvido da raiz.
  try {
    const oc = JSON.parse(readFileSync(join(root, "opencode.json"), "utf8"));
    for (const agent of Object.values(oc.agent ?? {})) {
      const m = /\{file:(.+?)\}/.exec(agent.prompt ?? "");
      if (m && m[1].endsWith(".md")) out.add(posixPath(m[1]));
    }
  } catch {
    // sem roster: o resto do payload continua derivado
  }
  return [...out].filter((f) => existsSync(join(root, f))).sort();
}

// --- Varredura -----------------------------------------------------------

// Fonte de eixo injetada (ADR-001 §10-N4). `opts.exports` é o canal formal
// (adapter → módulo); `opts.declarations` continua aceito porque é o nome que a
// spec/fixtures usam. Sem NENHUM dos dois, `axisIdsOf` é vazio e o vocabulário
// reprova — fail-closed, nunca verde por omissão.
function resolveExports(opts = {}) {
  return {
    ...DEFAULT_EXPORTS,
    ...(opts.exports ?? {}),
    ...(opts.declarations ?? {}),
  };
}

// Skill vendorizada (E-5): o arquivo pertence a uma chave do `.vendor-lock.json`.
// Vendor é upstream — medir a linha como dívida do destino criaria dívida
// impagável (`treeHash` congela os bytes).
function vendoredSkillOf(file, lock) {
  const m = /^\.agents\/skills\/([^/]+)\//.exec(posixPath(file));
  if (!m) return null;
  return Object.prototype.hasOwnProperty.call(lock, m[1]) ? m[1] : null;
}

// Exceção estrutural de A-1 (E-6): dívida nomeada, com dono e predicado vivo.
// A baseline `identity` NÃO escusa estes alarmes (ADR-001 §10-N3).
function structuralExcuse(exceptions, kind, file, line) {
  return exceptions.find((entry) => {
    const p = entry.predicate ?? {};
    return p.type === "structural-offender"
      && p.kind === kind
      && posixPath(p.file) === file
      && p.line === line;
  }) ?? null;
}

// Diagnóstico/teste: a análise de UM artefato (vereditos por linha, posições
// identitárias, `license:` e proibições) com o mesmo contexto do `runCdlChecks`.
export function scanArtifact(root, file, opts = {}) {
  const exports = resolveExports(opts);
  const lock = lockSkills(root);
  const population = derivePopulation(root);
  const axis = declaredAxis(file, exports, lock);
  return analyseFile(
    root,
    file,
    axis,
    opts.exceptions ?? EXCEPTIONS,
    population,
    opts.projectTerms ?? PROJECT_TERMS,
  );
}

/**
 * Ponto de entrada. `opts` é injeção de fixture e de fonte de eixo, nunca de
 * corpus: `{ exports?, declarations?, baseline?, exceptions?, projectTerms?,
 * axisClass? }`.
 */
export function runCdlChecks(root = process.cwd(), opts = {}) {
  const exports = resolveExports(opts);
  const baseline = (opts.baseline ?? BASELINE).map((entry) => resolveBaselineEntry(entry, exports));
  const exceptions = opts.exceptions ?? EXCEPTIONS;
  const projectTerms = opts.projectTerms ?? PROJECT_TERMS;
  const lock = lockSkills(root);

  const population = derivePopulation(root);
  const payload = derivePayload(root, exports, lock);

  // Baseline indexada por arquivo:linha.
  const baselineAt = new Map();
  for (const entry of baseline) {
    baselineAt.set(`${posixPath(entry.file)}:${entry.line}`, entry);
  }

  const prescriptions = [];
  const identityLines = [];
  const licenceLines = [];
  const prohibitions = [];
  const vendorFindings = [];

  for (const file of population.files) {
    const vendored = vendoredSkillOf(file, lock);
    if (vendored) {
      // E-5: linha de skill vendorizada fica fora de A-2, de A-1 e de D2.
      const termLines = (population.byFile.get(file) ?? []).filter((l) => termsOf(l).length);
      if (termLines.length) vendorFindings.push({ file, skill: vendored, lines: termLines.length });
      continue;
    }
    const axis = declaredAxis(file, exports, lock);
    const analysis = analyseFile(root, file, axis, exceptions, population, projectTerms);
    for (const v of analysis.verdicts) prescriptions.push({ file, ...v });
    for (const v of analysis.identity) identityLines.push({ file, ...v, axis });
    for (const v of analysis.licence) licenceLines.push({ file, ...v, axis });
    for (const v of analysis.prohibitions) prohibitions.push({ file, ...v });
  }

  const count = (verdict) => prescriptions.filter((p) => p.verdict === verdict).length;

  // --- 1. cdl-unconditional-unbaselined ----------------------------------
  const unconditional = prescriptions.filter((p) => p.verdict === "incondicional");
  const unbaselined = unconditional.filter((p) => !baselineAt.has(`${p.file}:${p.line}`));

  // --- 2. cdl-baseline-stale ---------------------------------------------
  const staleBaseline = [];
  const incompleteBaseline = [];
  for (const [index, entry] of baseline.entries()) {
    const label = entry && entry.file ? `${posixPath(entry.file)}:${entry.line}` : `BASELINE[${index}]`;
    if (
      !entry ||
      typeof entry.file !== "string" || entry.file.trim() === "" ||
      !Number.isInteger(entry.line) || entry.line < 1 ||
      typeof entry.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.sha256) ||
      !BASELINE_VERDICTS.has(entry.verdict) ||
      !BASELINE_OWNERS.has(entry.owner)
    ) {
      incompleteBaseline.push(`${label} (file/line/sha256/verdict/owner)`);
      continue;
    }
    const vendored = vendoredSkillOf(entry.file, lock);
    if (vendored) {
      // C6: baselinar upstream é dívida IMPAGÁVEL (E-5). Invalidação explícita,
      // não silêncio.
      staleBaseline.push(`${label} (vendorizada: ${vendored} — dívida impagável, E-5 upstream)`);
      continue;
    }
    const lines = population.byFile.get(posixPath(entry.file));
    if (!lines) {
      staleBaseline.push(`${label} (arquivo fora da população ou ausente)`);
      continue;
    }
    const text = lines[entry.line - 1];
    if (text === undefined) {
      staleBaseline.push(`${label} (linha além do arquivo: ${lines.length})`);
      continue;
    }
    if (sha256Line(text) !== entry.sha256) {
      staleBaseline.push(`${label} (linha mudou)`);
      continue;
    }
    if (entry.verdict === "incondicional") {
      const verdict = prescriptions.find((p) => p.file === posixPath(entry.file) && p.line === entry.line);
      if (!verdict || verdict.verdict !== "incondicional") {
        staleBaseline.push(`${label} (deixou de ser incondicional: ${verdict ? verdict.verdict : "sem veredito"})`);
      }
    } else {
      const stillIdentity = identityLines.some(
        (l) => l.file === posixPath(entry.file) && l.line === entry.line,
      );
      if (!stillIdentity) staleBaseline.push(`${label} (deixou de ser identitária)`);
    }
  }

  // --- 3. cdl-axis-vocabulary-missing ------------------------------------
  const missing = missingVocabulary(exports, lock);

  // --- 4. cdl-population-payload-gap -------------------------------------
  const populationSet = new Set(population.files);
  const payloadGap = payload.filter((file) => !populationSet.has(file));
  const populationEmpty = population.files.length === 0;

  // --- 5. cdl-axis-declaration-phantom -----------------------------------
  const phantoms = [];
  for (const [key, values] of Object.entries(exports.RULES_BY_AXIS ?? {})) {
    for (const rule of values) {
      if (!existsSync(join(root, ".agents", "rules", rule))) phantoms.push(`RULES_BY_AXIS['${key}'] → ${rule}`);
    }
  }
  for (const [key, values] of Object.entries(exports.SKILLS_BY_AXIS ?? {})) {
    for (const skill of values) {
      if (!existsSync(join(root, ".agents", "skills", skill))) phantoms.push(`SKILLS_BY_AXIS['${key}'] → ${skill}`);
    }
  }

  // --- 6. A-1: registro + DOIS alarmes estruturais (rodam ANTES da
  //        baseline: a entrada `identity` da BASELINE não os escusa) --------
  const identityIssues = [];
  for (const entry of projectTerms) {
    for (const key of ["term", "class", "proof", "owner"]) {
      if (typeof entry[key] !== "string" || entry[key].trim() === "") {
        identityIssues.push(`${entry.term ?? "PROJECT_TERMS"}: ${key} ausente`);
      }
    }
    const m = /^(.+):(\d+)$/.exec(entry.proof ?? "");
    if (!m) {
      identityIssues.push(`${entry.term}: proof fora do formato arquivo:linha`);
      continue;
    }
    let text;
    try {
      text = readFileSync(join(root, m[1]), "utf8").split("\n")[Number(m[2]) - 1];
    } catch {
      text = undefined;
    }
    if (text === undefined) identityIssues.push(`${entry.term}: proof morta (${entry.proof})`);
    else if (!text.includes(entry.term)) identityIssues.push(`${entry.term}: proof não cita o termo (${entry.proof})`);
    const appears = identityLines.some((l) => l.text.includes(entry.term));
    if (!appears) identityIssues.push(`${entry.term}: nenhuma posição identitária na população`);
  }

  // Alarme (a): `license:` fora de SPDX id ou referência a arquivo empacotado.
  const SPDX = /^(?:MIT|Apache-2\.0|BSD-[23]-Clause|ISC|GPL-[23]\.0(?:-only|-or-later)?|LGPL-[23]\.\d|MPL-2\.0|Unlicense|CC0-1\.0|CC-BY-4\.0)$/;
  const licenceFindings = [];
  for (const { file, line, text } of licenceLines) {
    const value = text.replace(/^\s*license:\s*/i, "").trim().replace(/^["']|["']$/g, "");
    if (SPDX.test(value) || /licen[cs]e/i.test(value)) continue;
    licenceFindings.push({ file, line, value });
  }
  // Alarme (b): termo de stack em posição identitária fora do eixo declarado.
  const axisFindings = [];
  for (const { file, line, text, axis } of identityLines) {
    if (!axis.size) continue; // comum: prescrição de stack é incondicional, não cruzada
    for (const hit of termsOf(text)) {
      const outside = [...hit.axes].filter((a) => !axis.has(a));
      if (outside.length === hit.axes.size) {
        axisFindings.push({ file, line, term: hit.term, axis: [...axis].join("/") });
      }
    }
  }
  const structuralDebt = [];
  const licenceOffenders = [];
  for (const finding of licenceFindings) {
    const excuse = structuralExcuse(exceptions, "license", finding.file, finding.line);
    if (excuse) structuralDebt.push({ kind: "license", ...finding, owner: excuse.predicate.owner ?? null });
    else licenceOffenders.push(`${finding.file}:${finding.line} (${finding.value})`);
  }
  const axisOffenders = [];
  for (const finding of axisFindings) {
    const excuse = structuralExcuse(exceptions, "axis", finding.file, finding.line);
    if (excuse) structuralDebt.push({ kind: "axis", ...finding, owner: excuse.predicate.owner ?? null });
    else axisOffenders.push(`${finding.file}:${finding.line} (${finding.term} ∉ ${finding.axis})`);
  }
  for (const offender of licenceOffenders) identityIssues.push(`license fora de SPDX: ${offender}`);
  for (const offender of axisOffenders) identityIssues.push(`stack fora do eixo declarado: ${offender}`);
  // Posição identitária nova (não declarada) é dívida nova: FAIL, não silêncio.
  for (const { file, line } of identityLines) {
    if (!baselineAt.has(`${file}:${line}`)) {
      identityIssues.push(`${file}:${line} (posição identitária fora da baseline)`);
    }
  }

  // --- 7. cdl-exception-stale --------------------------------------------
  const staleExceptions = [];
  for (const entry of exceptions) {
    const p = entry.predicate ?? {};
    for (const key of ["reason", "proof", "id"]) {
      if (typeof entry[key] !== "string" || entry[key].trim() === "") {
        staleExceptions.push(`${entry.id ?? "EXCEPTION"}: ${key} ausente`);
      }
    }
    if (p.type === "artifact-prefix") {
      const dir = join(root, p.value);
      const hasCatalogue = existsSync(dir)
        && walkMarkdown(root, p.value.replace(/\/$/, "")).length > 0;
      if (!hasCatalogue) staleExceptions.push(`${entry.id}: ${p.value} sem catálogo .md`);
    } else if (p.type === "line-declaration") {
      const lines = population.byFile.get(posixPath(p.file));
      const text = lines?.[p.line - 1];
      if (!lines) staleExceptions.push(`${entry.id}: ${p.file} fora da população`);
      else if (text === undefined || !text.includes(p.contains ?? "")) {
        staleExceptions.push(`${entry.id}: ${p.file}:${p.line} sem "${p.contains}"`);
      }
    } else if (p.type === "skill-name-axis") {
      const ids = axisIdsOf(exports, lock);
      for (const name of p.value ?? []) {
        const dir = join(root, ".agents", "skills", name);
        if (!existsSync(dir)) staleExceptions.push(`${entry.id}: skill ${name} ausente`);
        else if (!name.split("-").some((s) => ids.has(s))) {
          staleExceptions.push(`${entry.id}: ${name} sem segmento de eixo`);
        }
      }
    } else if (p.type === "population-exclusion") {
      const found = POPULATION_EXCLUSIONS.find((x) => x.id === p.value);
      if (!found) staleExceptions.push(`${entry.id}: exclusão ${p.value} inexistente`);
    } else if (p.type === "vendored-skill") {
      const names = Object.keys(lock);
      const alive = names.filter((n) => existsSync(join(root, ".agents", "skills", n)));
      if (!names.length) staleExceptions.push(`${entry.id}: nenhuma skill no .vendor-lock.json`);
      else if (!alive.length) staleExceptions.push(`${entry.id}: lock sem skill correspondente no disco`);
    } else if (p.type === "structural-offender") {
      // O predicado morre quando a linha é corrigida: dívida estrutural não
      // vira permissão permanente.
      if (!(p.owner && BASELINE_OWNERS.has(p.owner))) {
        staleExceptions.push(`${entry.id}: structural-offender sem owner válido`);
      }
      const target = posixPath(p.file ?? "");
      if (p.kind === "license") {
        if (!licenceFindings.some((f) => f.file === target && f.line === p.line)) {
          staleExceptions.push(`${entry.id}: ${target}:${p.line} deixou de ser license fora de SPDX`);
        }
      } else if (p.kind === "axis") {
        if (!axisFindings.some((f) => f.file === target && f.line === p.line)) {
          staleExceptions.push(`${entry.id}: ${target}:${p.line} deixou de ser stack fora do eixo`);
        }
      } else {
        staleExceptions.push(`${entry.id}: structural-offender sem kind conhecido`);
      }
    } else {
      staleExceptions.push(`${entry.id}: predicate tipo desconhecido`);
    }
  }

  // --- A-3: `refs-undetected` (publicado, dono ADR-004) ------------------
  // A gramática de A-3 para `rules/*.md` é a do check de prosa órfã (ADR-005
  // do PRD-1); a segunda gramática (`.doc/**`, `frontend/DESIGN.md`) não é
  // detectada — publicada com dono, nunca silêncio.
  let refsUndetected = 0;
  for (const file of population.files) {
    if (!/^\.agents\//.test(file) && file !== "opencode.json") continue;
    const lines = population.byFile.get(file) ?? [];
    for (const line of lines) {
      if (/frontend\/DESIGN\.md/.test(line)) refsUndetected += 1;
      if (/`?\.doc\/[\w./-]+`?/.test(line)) refsUndetected += 1;
    }
  }

  const vocabularySize = Object.keys(exports.STACK_VOCAB ?? STACK_VOCAB).length;
  const counters = {
    population: { files: population.files.length, lines: population.lines },
    prescriptions: {
      total: prescriptions.length,
      conditional: count("condicional"),
      example: count("exemplo"),
      catalogue: count("catálogo"),
      unconditional: unconditional.length,
    },
    identity: { files: new Set(identityLines.map((l) => l.file)).size, lines: identityLines.length },
    baseline: {
      total: baseline.length,
      unconditional: baseline.filter((e) => e.verdict === "incondicional").length,
      identity: baseline.filter((e) => e.verdict === "identity").length,
    },
    payload: payload.length,
    refsUndetected,
    axisDecl: {
      skills: Object.values(exports.SKILLS_BY_AXIS ?? {}).flat().length,
      rules: Object.values(exports.RULES_BY_AXIS ?? {}).flat().length,
    },
    axisClass: opts.axisClass ?? { skills: null, rules: null },
    vocabulary: vocabularySize,
    projectTerms: projectTerms.length,
    exceptions: exceptions.length,
    licenceOffenders: licenceOffenders.length,
    axisOffenders: axisOffenders.length,
    structuralDebt: structuralDebt.length,
    // Publicado por extenso: dívida estrutural declarada é dívida VISÍVEL, com
    // dono — nunca um número que esconde a decisão.
    structuralDebtEntries: structuralDebt.map(
      (d) => `${d.kind}@${d.file}:${d.line}→${d.owner ?? "sem-dono"}`,
    ),
    vendorUpstream: vendorFindings.length,
    vendorUpstreamLines: vendorFindings.reduce((sum, v) => sum + v.lines, 0),
    // Rotulagem heurística (§2.3-ter): o número tem erro medido e o erro é
    // publicado junto — nunca um FP/FN "sem método".
    heuristic: {
      heuristic: HEURISTIC.heuristic,
      fp: HEURISTIC.fp,
      fn: HEURISTIC.fn,
      sample: HEURISTIC.sample,
    },
  };

  counters.heuristicLabel =
    `heuristic=${HEURISTIC.heuristic} fp=${HEURISTIC.fp}/${HEURISTIC.sample.size} `
    + `fn=${HEURISTIC.fn}/${HEURISTIC.sample.size}`;

  const axisSourceMissing = missing.includes(AXIS_SOURCE_MISSING);
  const results = [
    {
      id: "cdl-unconditional-unbaselined",
      status: unbaselined.length ? "FAIL" : "PASS",
      detail: unbaselined.length
        ? `${unbaselined.length} linha(s) incondicional fora da BASELINE: `
          + unbaselined.map((p) => `${p.file}:${p.line} (${p.text.trim().slice(0, 80)})`).join("; ")
        : `incondicional=${unconditional.length}, todas na BASELINE (baseline=${baseline.length})`,
    },
    {
      id: "cdl-baseline-stale",
      status: staleBaseline.length || incompleteBaseline.length ? "FAIL" : "PASS",
      detail: staleBaseline.length || incompleteBaseline.length
        ? `BASELINE com ${staleBaseline.length + incompleteBaseline.length} entrada(s) inválida(s)/obsoleta(s): `
          + [...incompleteBaseline, ...staleBaseline].join("; ")
        : `BASELINE com ${baseline.length} entrada(s), todas com file/line/sha256/verdict/owner e veredito vivo`,
    },
    {
      id: "cdl-exception-stale",
      status: staleExceptions.length ? "FAIL" : "PASS",
      detail: staleExceptions.length
        ? `EXCEPTIONS com ${staleExceptions.length} problema(s): ${staleExceptions.join("; ")}`
        : `EXCEPTIONS com ${exceptions.length} entrada(s), cada predicado ainda casando e prova viva`,
    },
    {
      id: "cdl-axis-vocabulary-missing",
      status: missing.length ? "FAIL" : "PASS",
      detail: missing.length
        ? (axisSourceMissing
          ? `${AXIS_SOURCE_MISSING}: nenhuma fonte de eixo injetada (o adapter deve passar `
            + `\`exports\` do instalador); fail-closed em vez de verde por omissão`
          : `eixo(s) sem vocabulário em STACK_VOCAB: ${missing.join(", ")} (preset novo escaparia da lista)`)
        : `vocabulário com ${vocabularySize} chave(s) derivadas de AXIS_IDS ∪ stacks do lock; cobertura completa`,
    },
    {
      id: "cdl-population-payload-gap",
      status: payloadGap.length || populationEmpty ? "FAIL" : "PASS",
      detail: payloadGap.length || populationEmpty
        ? `população=${population.files.length} arquivo(s); artefato propagado fora dos globs: `
          + `${payloadGap.join(", ") || "população vazia (glob quebrado)"}`
        : `população=${population.files.length}/${population.lines}; payload .md derivado=${payload.length}, 0 fora`,
    },
    {
      id: "cdl-axis-declaration-phantom",
      status: phantoms.length ? "FAIL" : "PASS",
      detail: phantoms.length
        ? `mapa de eixo nomeia artefato ausente: ${phantoms.join("; ")}`
        : `mapas de eixo (rules=${counters.axisDecl.rules}, skills=${counters.axisDecl.skills}) apontam para alvos existentes`,
    },
    {
      id: "cdl-identity-term-stale",
      status: identityIssues.length ? "FAIL" : "PASS",
      detail: identityIssues.length
        ? `A-1: ${identityIssues.join("; ")}`
        : `PROJECT_TERMS=${projectTerms.length} com prova viva; identidade=${counters.identity.lines} linha(s) em `
          + `${counters.identity.files} arquivo(s), todas declaradas; license fora de SPDX=${licenceOffenders.length}`
          + ` (dívida estrutural declarada=${structuralDebt.length}); stack fora do eixo=${axisOffenders.length}`
          + `; vendor fora de A-2=${counters.vendorUpstreamLines} linha(s) (E-5)`,
    },
  ];

  counters.prohibitionCited = prohibitions.length;

  // `prohibition-cited` é contador, não veredito: publica em PASS e em FAIL.
  return {
    ok: results.every((r) => r.status === "PASS"),
    results,
    counters,
  };
}

// Fonte de eixo vazia por design: o módulo não importa `installer/` (C5). O
// adapter injeta; sozinho, o módulo reprova em vez de passar verde.
const DEFAULT_EXPORTS = Object.freeze({
  AXIS_IDS: Object.freeze({}),
  RULES_BY_AXIS: Object.freeze({}),
  RULES_COMMON: Object.freeze([]),
  SKILLS_BY_AXIS: Object.freeze({}),
  SKILLS_COMMON: Object.freeze([]),
  STACKS_FOR_EXCEPTIONS: Object.freeze({}),
});

