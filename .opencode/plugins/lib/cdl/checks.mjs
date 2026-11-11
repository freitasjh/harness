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
// --- D2 (ADR-001 §2.3) ---------------------------------------------------
// Proibição citando tecnologia NÃO recebe veredito e NÃO entra na baseline:
// o efeito pretendido é ausência. O predicado é marcador de negação ANTES do
// termo na mesma linha; a linha entra no contador `prohibition-cited`,
// publicado em PASS e em FAIL. Uma proibição que deixe de citar tecnologia sai
// do contador — a variação fica visível, não silenciosa.
//
// --- Pureza (SPEC I1) ----------------------------------------------------
// `node:fs`/`node:path` read-only + `node:crypto` para o `sha256` da linha
// (hash é cálculo, não I/O). Sem rede, sem child process, sem gravação. `root`
// é injetável; a árvore nunca é mutada. Vive em `.opencode/plugins/lib/**`,
// caminho que o instalador propaga (install.mjs:107).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  AXIS_IDS,
  RULES_BY_AXIS,
  RULES_COMMON,
  SKILLS_BY_AXIS,
  SKILLS_COMMON,
  STACKS_FOR_EXCEPTIONS,
} from "../../../../installer/install.mjs";

// --- Vereditos (ADR-001 §2.3) --------------------------------------------
// Ordem FIXA: o primeiro passo que decide, decide. `classifyLine` devolve um
// destes ou `null` — nunca dois.
export const VERDICTS = Object.freeze([
  "condicional",
  "exemplo",
  "catálogo",
  "incondicional",
]);

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
]);

// --- Baseline (ADR-001 §2.5, SPEC I3) -----------------------------------
// Dívida declarada, nunca permissão. Entrada = { file, line, sha256, verdict,
// owner }. `verdict` ∈ {"incondicional","identity"}; `owner` ∈ ADR-002..005.
// A lista só ENCOLHE: linha editada, veredito que deixou de valer ou arquivo
// removido ⇒ `cdl-baseline-stale` (a entrada não vira permissão permanente).
// Entrada de baseline pode nomear a rule pelo SLOT do mapa de eixo do dono
// (`@rule-axis:<chave>#<índice>`) em vez do path literal: as duas rules de
// frontend são o sujeito do congelamento EX-VAL-06 (12 arquivos entregues que
// citam a rule excluída do destino react) — o path é DERIVADO da declaração do
// instalador, nunca digitado aqui. Resolvido na carga; o export sai com `file`.
const RULE_AXIS_REF = /^@rule-axis:(.+)#(\d+)$/;

function resolveBaselineEntry(entry) {
  if (typeof entry.file !== "string") return entry;
  const ref = RULE_AXIS_REF.exec(entry.file);
  if (!ref) return entry;
  const slot = (RULES_BY_AXIS[ref[1]] ?? [])[Number(ref[2])];
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
    line: 85,
    sha256: "2ac782cf05a3a813689a1a3b5f98836d4204f5ec069ca5c3eaded7ec191670eb",
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
    line: 493,
    sha256: "138a27d671b0a896c79f54a6ae1bbd068fcd359fbd6ec36bc049e3df14e23906",
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
    line: 541,
    sha256: "4667c613fb3011b3fbde4b574123e44317c3d11cfe3a1845dade194fae422ebb",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/orchestrator/AGENT.md",
    line: 542,
    sha256: "d7693126f8b98e944ee0a2a914f87437d4a8a320490a4f115a6cb217957fcf76",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/orchestrator/AGENT.md",
    line: 543,
    sha256: "1ae275297bf502eca6dbd672dd2b2125b2f5ff85511809d1e90154d5de920a8a",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/agents/orchestrator/AGENT.md",
    line: 611,
    sha256: "52f599dc4d605fd47b792d83bf2de30134582f70c24d255438e437f0a0e457f3",
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
    file: ".agents/agents/security-engineer/AGENT.md",
    line: 96,
    sha256: "5b3a4c41be9d460618a3339e02207c8d2864b2b1e50c81b1504eab30d033651f",
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
    line: 359,
    sha256: "8622470257e5345558bd65364dc1c0548d24feb56cd9923ad368dad0ba5705e2",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/rules/workflow-rules.md",
    line: 424,
    sha256: "389b3b180bd506a9fff195e5b262f1a2c2baef74cad8c029f558196b50be75fe",
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
    line: 442,
    sha256: "fc131278bcc3ea3e1ac01b2e580b907972d3d804ba81ee66c26cdc60f4341e9f",
    verdict: "incondicional",
    owner: "ADR-002",
  },
  {
    file: ".agents/skills/dev-planner/anti-patterns.md",
    line: 169,
    sha256: "b2b5ab8cb39e903772ce7b19f0674fd1449640b024d3cb540f16efbcb5f0cf2b",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/dev-planner/anti-patterns.md",
    line: 208,
    sha256: "5840a3927e56a38712b861142e46613a11cdee77e475340770d2291a73514b6a",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/dev-planner/anti-patterns.md",
    line: 264,
    sha256: "79cef6906fabf4cf2fdd207f1775ea95409f92660e6f9c76f974e137530008e5",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/dev-planner/anti-patterns.md",
    line: 284,
    sha256: "a38c5422475f3672f2709d80ad8747b654c5c1087842d7634eefbe39e469732d",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/dev-planner/anti-patterns.md",
    line: 290,
    sha256: "41b8e4a615e94d0c4647ff63be0cbd8f123a13e690a618f226928019a49e9770",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/harness-installer/SKILL.md",
    line: 256,
    sha256: "741da99f2fcbdfe32fb19d3eaf262b414ee0f0d7f47f19163521d496fb033d76",
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
    file: ".agents/skills/prompt-optimizer/SKILL.md",
    line: 108,
    sha256: "468d147c7b5c0e96fadc6ccfc315d6b07ef2c411b04fb4f06ba4057a1abf7901",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/react-best-practices/AGENTS.md",
    line: 3619,
    sha256: "38fc325d2a5fc37a3aa612a78be36d26f4a520df473075dacd954f0c88fb24ce",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/react-best-practices/rules/js-tosorted-immutable.md",
    line: 45,
    sha256: "38fc325d2a5fc37a3aa612a78be36d26f4a520df473075dacd954f0c88fb24ce",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/react-components/SKILL.md",
    line: 92,
    sha256: "8fe78bd79eda580fef5e4f2308a273f92feb71907967845f848606e4431e9d38",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/react-components/SKILL.md",
    line: 97,
    sha256: "e035472d806dab4b9cac30298b0c08faf20054d3e9c148b1099b8da54f6baa32",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/react-components/SKILL.md",
    line: 100,
    sha256: "001753252e0a43df2bc6cf4e60eca0323f1f9ca9efdaa5cd5fd5f7ebf8413c8c",
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
    file: ".agents/skills/sdd-compiler/references/frontend.md",
    line: 52,
    sha256: "8b412daee4c43d73364a27bff241723243cfd859e648c4fbebc6d7a9bdd3d0bf",
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
    line: 160,
    sha256: "498154f79aa87f8ecb4cb60335f23e260ad700f3acf266645652676951c94934",
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
    file: ".agents/skills/spec-review/assets/output-template.md",
    line: 73,
    sha256: "ecb0910c4ea8115ba0f151334c18347f5e24c175ce620f27747e78678fdf40d4",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/output-template.md",
    line: 170,
    sha256: "86821a0623be9b82491a6d131ca91c1fa9c1763d0dc46d9490a187226348d24f",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/output-template.md",
    line: 192,
    sha256: "9641aa76e71ba07b6d0afaec9648748ef6aa42c34c11d0298f9d3522f7eaab9b",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/assets/output-template.md",
    line: 205,
    sha256: "72b14a9a23b31e896103748aafd60bcf9d74f35d2760f2ab57aa2e211d8047af",
    verdict: "incondicional",
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
    line: 56,
    sha256: "58246df6437e4a2c526c5aa1bd9a103e15e310053b928f094876207cf9750ffd",
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
    file: ".agents/skills/spec-review/assets/usage-guide.md",
    line: 280,
    sha256: "0a5a82ce9bf7e8f1fa93c03d4a305a6cee1d68a7493962eb4f7e58ec82cbd35e",
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
    line: 141,
    sha256: "058ca03f7c1d8a6fac3fead1958a80fbcb3dc70511546dc6c024e834bb67dcf5",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/README.md",
    line: 142,
    sha256: "b52da28acdbd2f7197a372c481d045aff7f540743b92f0d8840957e5778f2e3e",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/README.md",
    line: 143,
    sha256: "168adc88e8cfa6e7fa0783ebdfef1b9407bbc2311679476b6d4c0db8c1736c83",
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
    file: ".agents/skills/spec-review/README.md",
    line: 216,
    sha256: "2cf42bd6ba1d040a3260b5eb56d9791bf15eddfce447f28ac2f9161ce4cb99ab",
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
    line: 43,
    sha256: "ecc52cf98219a179473e31dccd409374ae8e84c2a8bc71d7af07c47af4af76d9",
    verdict: "incondicional",
    owner: "ADR-003",
  },
  {
    file: ".agents/skills/spec-review/SKILL.md",
    line: 44,
    sha256: "a9e0d29f61757ee1a796106c4b623ef8648076ae6f67875316355866a8ebbb10",
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
    file: ".agents/skills/template-best-practices/SKILL.md",
    line: 37,
    sha256: "b03cc63cd3302b22418c218940ee145881bab6309ffc0966821c88f476fb98c9",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: ".agents/skills/template-deepsearch/SKILL.md",
    line: 49,
    sha256: "a7c5f070c94577d56353fb2a23541970793be5e595d737820f42017ae4a302c7",
    verdict: "incondicional",
    owner: "ADR-005",
  },
  {
    file: "spec-developed.md",
    line: 57,
    sha256: "48911d759bed8eb5e575ea0fa66b231038ee6e4e4367a39df8976f927ee4e377",
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
].map(resolveBaselineEntry));

const BASELINE_VERDICTS = new Set(["incondicional", "identity"]);
const BASELINE_OWNERS = new Set(["ADR-002", "ADR-003", "ADR-004", "ADR-005"]);

// --- Helpers puros -------------------------------------------------------

export function posixPath(p) {
  return String(p).replaceAll("\\", "/").replace(/^\.\//, "");
}

export function sha256Line(line) {
  return createHash("sha256").update(line).digest("hex");
}

// Termos presentes na linha, cada um com o conjunto de eixos que os declara.
export function termsOf(line) {
  if (!TERM_PREFILTER.test(line)) return [];
  const hits = [];
  for (const { term, axes, re } of TERM_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(line)) {
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

export function axisIdsOf(exports = DEFAULT_EXPORTS, lock = {}) {
  const ids = new Set(Object.values(exports.AXIS_IDS ?? {}).flat());
  for (const entry of Object.values(lock)) {
    for (const stack of entry?.stacks ?? []) ids.add(stack);
  }
  return ids;
}

export function missingVocabulary(exports = DEFAULT_EXPORTS, lock = {}) {
  const missing = [];
  for (const id of axisIdsOf(exports, lock)) {
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

// Marcador normativo — imperativo/modal/estado obrigatório. É o que separa
// "instrução" de "menção" no passo 1 da rubrica.
const NORMATIVE = new RegExp(
  [
    "\\bMUST\\b", "\\bSHOULD\\b", "\\bDEVE[M]?\\b", "\\bDEVEM\\b", "\\bobrigat[óo]ri[oa]s?\\b",
    "\\bNUNCA\\b", "\\bSEMPRE\\b", "\\bnever\\b", "\\balways\\b", "\\brequired\\b",
    "\\bProibido\\b", "\\bproibid[oa]s?\\b", "\\bproibida\\b", "\\bUse\\b", "\\buse\\b",
    "\\bUsar\\b", "\\busar\\b", "\\busa\\b", "\\bEscreva\\b", "\\bescreva\\b", "\\bEscrever\\b",
    "\\bCriar\\b", "\\bcriar\\b", "\\bVerificar\\b", "\\bverificar\\b", "\\bExecutar\\b",
    "\\bexecutar\\b", "\\bRodar\\b", "\\brodar\\b", "\\bpreferencial(?:mente)?\\b",
    "\\bEvite\\b", "\\bevite\\b", "\\bEvitar\\b", "\\bevitar\\b", "\\bViola\\b",
    "\\bNÃO\\b", "\\bnão\\b", "\\bnao\\b", "\\bNot\\b", "\\bAvoid\\b", "\\bDON'T\\b",
    "\\bDo not\\b", "\\bFerramentas:", "\\bExecução:", "\\bTooling:", "\\bRule:",
  ].join("|"),
);

// Marcador de negação — D2. Tem de estar ANTES do termo, na mesma linha.
const NEGATION = new RegExp(
  [
    "\\bNUNCA\\b", "\\bnever\\b", "\\bNÃO\\b", "\\bnão\\b", "\\bnao\\b", "\\bProibido\\b",
    "\\bproibid[oa]s?\\b", "\\bsem\\b", "\\bSem\\b", "\\bDON'T\\b", "\\bDo not\\b",
    "\\bdon't\\b", "\\bAvoid\\b", "\\bevite\\b", "\\bEvite\\b", "\\breprova\\b",
    "\\bViola\\b", "\\bMUST NOT\\b", "\\bmust not\\b", "\\bbanido\\b",
  ].join("|"),
);

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
// "when{Action}_then{Expected}" é nome de padrão, não gate.
function explicitGate(line) {
  if (/\b(?:backend|frontend)\s*[=:]\s*[a-z]+\b/i.test(line)) return true;
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

// Passo 1: a linha é prescritiva? (a) marcador normativo + termo; (b) checkbox
// (tabela OU item de lista — checklist é prescrição por estrutura); (c) item de
// lista que não é citação de artefato. Sem isso a linha é menção/referência —
// não recebe veredito (A-3 é quem trata path).
function isPrescriptive(line, ctx = {}) {
  if (TABLE_CHECKBOX.test(line) || LIST_CHECKBOX.test(line)) return true;
  if (NORMATIVE.test(line) && termsOf(line).length > 0) return true;
  if (LIST_ITEM.test(line) && !REFERENCE_ITEM.test(line)) return true;
  return false;
}

// Passo 2 (D2): negação ANTES do termo na mesma linha ⇒ fora de A-2.
export function prohibitionOf(line) {
  const hits = termsOf(line);
  if (!hits.length) return false;
  const negation = new RegExp(NEGATION.source, "g");
  const first = negation.exec(line);
  if (!first) return false;
  const cut = first.index;
  return hits.some(({ term }) => {
    const at = line.indexOf(term);
    return at >= 0 && at > cut;
  });
}

// Passo 4: catálogo. ≥2 termos de ≥2 eixos distintos na MESMA linha, ou ≥2
// termos ligados por conectivo de alternativa/listagem SEM composição `+`.
// Um termo cross-axis sozinho (`Vitest`) não faz catálogo: ele pertence aos
// dois eixos, não enumera dois.
const CATALOGUE_JOINED = new RegExp(
  `(?:${TERMS_ALTERNATION})\\s*(?:,|\\|)\\s*(?:or|ou)?\\s*(?:${TERMS_ALTERNATION})`,
  "i",
);

function isCatalogue(line, hits) {
  if (hits.length >= 2) {
    // Dois termos de eixos DISJUNTOS enumeram alternativas; um termo
    // cross-axis ao lado de um dos seus eixos não enumera nada.
    for (let i = 0; i < hits.length; i += 1) {
      for (let j = i + 1; j < hits.length; j += 1) {
        const a = hits[i].axes;
        const b = hits[j].axes;
        if ([...a].every((axis) => !b.has(axis))) return true;
      }
    }
  }
  return CATALOGUE_JOINED.test(line);
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

/**
 * classifica UMA linha. `ctx` carrega o que é escopo, não julgamento:
 *   { artifact, axis: Set, heading, ancestors: string[], inFence, inPico,
 *     inQuote, catalogueFile }
 * Devolve UM veredito ou `null` (não-prescritiva, ou proibição por D2).
 */
export function classifyLine(line, ctx = {}) {
  const hits = termsOf(line);
  if (!hits.length) return null;
  if (!isPrescriptive(line, ctx)) return null;
  // E-2: declaração de ausência de stack não é prescrição.
  if (ctx.absenceDeclaration) return null;
  if (prohibitionOf(line)) return null; // D2: proibição não recebe veredito

  // 3. exemplo
  if (
    ctx.inFence ||
    ctx.inPico ||
    ctx.inQuote ||
    EXAMPLE_MARKERS.test(line) ||
    quotedTermSpan(line)
  ) {
    return "exemplo";
  }

  // 4. catálogo
  if (ctx.catalogueFile) return "catálogo";
  if (isCatalogue(line, hits)) return "catálogo";

  // 5. condicional
  if (explicitGate(line) || scopeGate(ctx)) return "condicional";
  const declared = ctx.axis instanceof Set ? ctx.axis : new Set(ctx.axis ?? []);
  if (declared.size > 0) {
    // Termo cross-axis (`shadcn`, `Vitest`) está coberto quando QUALQUER um
    // dos seus eixos é declarado: o artefato fala de um dos donos do termo.
    const all = hits.every((h) => [...h.axes].some((axis) => declared.has(axis)));
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
// blockquote, heading delimitante, bullets ancestrais por indentação).
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
  const catalogue = catalogueFileOf(file, exceptions);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const n = i + 1;

    if (FENCE.test(line)) {
      inFence = !inFence;
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
      ancestors,
      inFence,
      inPico,
      inQuote: BLOCKQUOTE.test(line),
      catalogueFile: Boolean(catalogue),
      absenceDeclaration: Boolean(absence && absence.predicate?.type === "line-declaration"),
    };
    const verdict = classifyLine(line, ctx);
    if (verdict) {
      verdicts.push({ line: n, text: line, verdict });
    } else if (!ctx.absenceDeclaration && termsOf(line).length && prohibitionOf(line)) {
      // D2: proibição citando tecnologia não recebe veredito, mas é contada.
      prohibitions.push({ line: n, text: line });
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

// Diagnóstico/teste: a análise de UM artefato (vereditos por linha, posições
// identitárias, `license:` e proibições) com o mesmo contexto do `runCdlChecks`.
export function scanArtifact(root, file, opts = {}) {
  const exports = {
    AXIS_IDS,
    RULES_BY_AXIS,
    RULES_COMMON,
    SKILLS_BY_AXIS,
    SKILLS_COMMON,
    STACKS_FOR_EXCEPTIONS,
    STACK_VOCAB,
    ...(opts.declarations ?? {}),
  };
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
 * Ponto de entrada. `opts` é injeção de fixture, nunca de corpus:
 *   { declarations?, baseline?, exceptions?, projectTerms?, axisClass? }
 */
export function runCdlChecks(root = process.cwd(), opts = {}) {
  const exports = {
    AXIS_IDS,
    RULES_BY_AXIS,
    RULES_COMMON,
    SKILLS_BY_AXIS,
    SKILLS_COMMON,
    STACKS_FOR_EXCEPTIONS,
    STACK_VOCAB,
    ...(opts.declarations ?? {}),
  };
  const baseline = opts.baseline ?? BASELINE;
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

  for (const file of population.files) {
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

  // --- 3. cdl-exception-stale --------------------------------------------
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
    } else {
      staleExceptions.push(`${entry.id}: predicate tipo desconhecido`);
    }
  }

  // --- 4. cdl-axis-vocabulary-missing ------------------------------------
  const missing = missingVocabulary(exports, lock);

  // --- 5. cdl-population-payload-gap -------------------------------------
  const populationSet = new Set(population.files);
  const payloadGap = payload.filter((file) => !populationSet.has(file));
  const populationEmpty = population.files.length === 0;

  // --- 6. cdl-axis-declaration-phantom -----------------------------------
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

  // --- 7. cdl-identity-term-stale (registro + dois alarmes estruturais) --
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
  const licenceOffenders = [];
  for (const { file, line, text } of licenceLines) {
    const value = text.replace(/^\s*license:\s*/i, "").trim().replace(/^["']|["']$/g, "");
    const admissible = SPDX.test(value) || /licen[cs]e/i.test(value);
    if (admissible) continue;
    const declared = baselineAt.get(`${file}:${line}`);
    if (declared && declared.verdict === "identity") continue; // dívida com dono
    licenceOffenders.push(`${file}:${line} (${value})`);
  }
  // Alarme (b): termo de stack em posição identitária fora do eixo declarado.
  const axisOffenders = [];
  for (const { file, line, text, axis } of identityLines) {
    if (!axis.size) continue; // comum: prescrição de stack é incondicional, não cruzada
    for (const hit of termsOf(text)) {
      const outside = [...hit.axes].filter((a) => !axis.has(a));
      if (outside.length === hit.axes.size) {
        const declared = baselineAt.get(`${file}:${line}`);
        if (declared && declared.verdict === "identity") continue;
        axisOffenders.push(`${file}:${line} (${hit.term} ∉ ${[...axis].join("/")})`);
      }
    }
  }
  for (const offender of licenceOffenders) identityIssues.push(`license fora de SPDX: ${offender}`);
  for (const offender of axisOffenders) identityIssues.push(`stack fora do eixo declarado: ${offender}`);
  // Posição identitária nova (não declarada) é dívida nova: FAIL, não silêncio.
  for (const { file, line } of identityLines) {
    if (!baselineAt.has(`${file}:${line}`)) {
      identityIssues.push(`${file}:${line} (posição identitária fora da baseline)`);
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
    vocabulary: Object.keys(exports.STACK_VOCAB ?? STACK_VOCAB).length,
    projectTerms: projectTerms.length,
    exceptions: exceptions.length,
    licenceOffenders: licenceOffenders.length,
    axisOffenders: axisOffenders.length,
  };

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
        ? `eixo(s) sem vocabulário em STACK_VOCAB: ${missing.join(", ")} (preset novo escaparia da lista)`
        : `vocabulário com ${Object.keys(exports.STACK_VOCAB ?? STACK_VOCAB).length} chave(s) derivadas de AXIS_IDS ∪ stacks do lock; cobertura completa`,
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
        : `PROJECT_TERMS=${projectTerms.length} com prova viva; identidade=${counters.identity.lines} linha(s) em ${counters.identity.files} arquivo(s), todas declaradas; license fora de SPDX=${licenceOffenders.length}; stack fora do eixo=${axisOffenders.length}`,
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

const DEFAULT_EXPORTS = Object.freeze({
  AXIS_IDS,
  RULES_BY_AXIS,
  RULES_COMMON,
  SKILLS_BY_AXIS,
  SKILLS_COMMON,
  STACKS_FOR_EXCEPTIONS,
  STACK_VOCAB,
});
