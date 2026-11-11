// checks.mjs — inventário canônico (ADR-004): superfície derivada, não documento.
//
// Contract (SPEC RF-01/RF-03): `deriveInventory(root, options)` deriva o
// inventário; `runInventoryChecks(root, options)` transforma os achados nos 7
// vereditos da ADR-004 §2.4 e devolve
//   { ok: boolean, results: [{ id, status: "PASS"|"FAIL", detail, counters }],
//     counters, artifacts, findings }
// `counters` é o fechamento aritmético por tipo e é publicado em PASS **e** em
// FAIL — a dívida não pode depender de o check estar vermelho para ser lida
// (mesma lição do `vendorOnly` em `refs/checks.mjs`, ADR-005 §8-N18).
//
// Duas coisas, e só duas, são afirmadas aqui:
//
//   1. O inventário é DERIVADO. Não há arquivo de 66 linhas, nem gerado nem à
//      mão: contagem escrita é cópia, e cópia divergente é o defeito que o
//      ADR-004 §1 mediu quatro vezes no próprio PRD do ciclo. Toda classe sai
//      de um registro DECLARADO: o `.vendor-lock.json` (skill vendorizada), os
//      mapas de eixo do instalador (dono: `installer/install.mjs`), o
//      `opencode.json` (roster) e as citações dos prompts do roster.
//   2. A única literal commitada é `OWNER_DECISIONS`, e ela EXPIRA. Não existe
//      supressão permanente: entrada cujo sujeito desaparece, cujo `proof`
//      morre ou cujo órfão ganha consumidor/eixo/lock é FAIL. O registry só
//      encolhe ou se justifica.
//
// Álgebra das classes — ordem da tabela é a precedência DECLARADA, primeiro
// match vence (ADR-004 §2.3), nunca descoberta pelo primeiro que rodar:
//
//   skill  vendor-by-axis > consumer > axis > orphan+decision
//   rule                  consumer > axis > orphan+decision
//   agent  registered > orphan+decision
//
// `vendor-by-axis` vence `consumer` por decisão do owner (D3): skill
// vendorizada continua vendorizada mesmo citada. A citação não desaparece —
// vira o contador `vendorCited`, publicado em PASS, para não ser dívida
// invisível. Consequência declarada: `SKILLS_COMMON`/`RULES_COMMON` NÃO
// conferem classe (declaram propagação a todo destino, não eixo nem consumo);
// se conferissem, bastaria somar um nome à lista para comprar isenção. O
// `harness-installer` está em `SKILLS_COMMON` e é, mesmo assim,
// `orphan+decision` — é o caso canônico do formato do registry.
//
// `inventory-class-ambiguous` é o outro lado da precedência: precedência
// resolve CLASSES, não DECLARAÇÕES contraditórias. Uma skill que o lock diz
// vendorizada e o mapa de eixo diz local (as duas declarações sobre a mesma
// natureza) casa 2 classes sem que a ordem diga qual declaração é verdadeira.
// Vendorizada + citada NÃO é ambiguidade: é o caso resolvido da §2.3.
//
// `inventory-attendance-drift` é o fechamento aritmético, medido em duas
// fontes independentes: (a) |disco| = Σ classes, (b) |população declarada| =
// |disco| (lock ∩ disco + declarações locais do instalador). É por desenho o
// sintoma agregado: quando ele quebra, algum dos outros ids nomeia a causa. A
// fixture que o derruba usa mutação real de UMA entrada (declaração fantasma,
// que não existe no disco) e prova o FAIL da equação com counters.
//
// `inventory-lock-disk-mismatch` anda nas DUAS direções — chave do lock sem
// diretório, e diretório do lock sem `SKILL.md` legível. `checkVendor`
// (`scripts/vendor-skills.mjs`) itera só as chaves do lock e por isso não vê a
// segunda direção; este check vê.
//
// `inventory-agent-prompt-unresolved` mede o ROSTER, não o nome do arquivo
// (§3 item 10): a unidade é a chave de `opencode.json.agent` com `prompt`
// resolvido. Contar `AGENT.md` daria 9 e erraria o roster de 10 (o
// `code-reviewer` usa `PROMPT.md`).
//
// `lockPresent=false` — destino sem `.vendor-lock.json` — NÃO é falha: no
// destino o conjunto de skills já foi filtrado por eixo, e "vendorizada" versus
// "local" descreve a origem na casa de origem. Input ausente ⇒ classificação
// de skill suspensa, com contador publicado, nunca FAIL e nunca silêncio
// (ADR-004 §2.2). `agents` e `rules` continuam derivados, porque dependem de
// arquivos que propagam.
//
// Pureza (SPEC I1): `node:fs`/`node:path` read-only; sem rede, sem MCP, sem
// child process, sem gravação. Vive em `.opencode/plugins/lib/**` — caminho que
// o instalador propaga (`install.mjs:107`) — e recebe `root` injetável, então
// o destino herda o código, não um veredito falso.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

// --- Layout declarado -----------------------------------------------------
// Paths do ARTEFATO inventariado (não do projeto-cliente): são a gramática do
// check, iguais em qualquer repo que receba esta camada.
export const SKILLS_DIR = ".agents/skills";
export const RULES_DIR = ".agents/rules";
export const AGENTS_DIR = ".agents/agents";
export const REGISTRY_FILE = "opencode.json";
export const VENDOR_LOCK_NAME = ".vendor-lock.json";
export const SKILL_ENTRY_NAME = "SKILL.md";

// `{file:./…}` é a forma como o roster referencia um prompt no disco.
export const PROMPT_REF_RE = /\{file:([^}]+)\}/;

// --- Classes (ADR-004 §2.3) ----------------------------------------------
// A ordem do array É a precedência declarada. Flat + frozen: nenhum consumidor
// pode reordenar em runtime e transformar precedência em acidente.
export const CLASS_LABELS = Object.freeze({
  skill: Object.freeze(["vendor-by-axis", "consumer", "axis", "orphan+decision"]),
  rule: Object.freeze(["consumer", "axis", "orphan+decision"]),
  agent: Object.freeze(["registered", "orphan+decision"]),
});

// --- Expiração (ADR-004 §2.4, SPEC I3) -----------------------------------
// Conjunto FECHADO de condições que o mecanismo sabe executar. `expiresWhen`
// que declare um token fora daqui é `owner-decision-incomplete`: prometer
// expiração que ninguém executa é supressão permanente com outro nome.
export const EXPIRY_CONDITIONS = Object.freeze({
  skill: Object.freeze(["subject-absent", "gained-consumer", "gained-axis", "gained-lock"]),
  rule: Object.freeze(["subject-absent", "gained-consumer", "gained-axis"]),
  agent: Object.freeze(["subject-absent", "gained-registry"]),
});

export const DECISION_FIELDS = Object.freeze([
  "subject",
  "class",
  "owner",
  "decision",
  "reason",
  "proof",
  "expiresWhen",
]);

// --- Registry: a ÚNICA literal do inventário -----------------------------
// Uma entrada por artefato `orphan+decision`. `subject`/`class` nomeiam
// `id`/`kind` do ADR-004 §3 item 6 e `decision` carrega o veredito do dono
// (não derivável); `expiresWhen` declara as condições de expiração, e o
// mecanismo as executa — a string não é a garantia, o código é.
//
// A entrada abaixo é a N6 do ADR: `harness-installer` é a única órfã local e a
// órfã é deliberada. O dono NÃO é um agente — é o fluxo de instalação, e a
// prova é a linha que a declara em `SKILLS_COMMON`. A entrada expira se a
// skill sair do disco, se `install.mjs:413` deixar de citá-la, se algum prompt
// do roster passar a citá-la (vira `consumer`) ou se ela entrar no lock.
export const OWNER_DECISIONS = Object.freeze([
  Object.freeze({
    subject: "harness-installer",
    class: "skill",
    owner: "installer/install.mjs (fluxo de instalação)",
    decision: "keep",
    reason:
      "manual operacional do instalador, distribuído a todo destino por SKILLS_COMMON; o consumidor é o operador que roda `node installer/install.mjs`, não um agente do roster",
    proof: "installer/install.mjs:413",
    expiresWhen: Object.freeze(["subject-absent", "gained-consumer", "gained-axis", "gained-lock"]),
  }),
]);

// --- Helpers puros --------------------------------------------------------

function readText(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function readJson(file) {
  const text = readText(file);
  if (text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isFile(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function listDirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.isSymbolicLink())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function listFiles(dir, suffix) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(suffix))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

// `proof` é `path:linha` — mesmo formato do `refs/checks.mjs`, contrato único
// de prova entre os dois checks.
export function parseProof(proof) {
  if (typeof proof !== "string") return null;
  const m = /^(.+):(\d+)$/.exec(proof.trim());
  return m ? { file: m[1], line: Number(m[2]) } : null;
}

// `./.agents/x` e `.agents/x` são o mesmo alvo; o roster escreve as duas.
export function normalizeRef(ref) {
  return String(ref).replace(/^\.\//, "");
}

// Eixos são PAR `{eixo, id}` no dono (`install.mjs:370`, `:396`): o mesmo id
// pode estar em mais de uma chave, e o inventário publica todas.
export function axisKeysOf(axisMap, id) {
  const keys = [];
  for (const [axisKey, ids] of Object.entries(axisMap ?? {})) {
    if (Array.isArray(ids) && ids.includes(id)) keys.push(axisKey);
  }
  return keys.sort();
}

// Declarações vêm do DONO por injeção (o adapter lê `installer/install.mjs` e
// passa adiante): o módulo LÊ, nunca COPIA (ADR-004 §4-C2). `common` é aceito
// para observabilidade e é ignorado pela classificação — de propósito.
// Sem declaração injetada o resultado é FAIL-CLOSED: skill local não citada cai
// em `orphan+decision` e pede decisão de dono. A superfície canônica é o `V19`,
// que injeta do instalador; a chamada nua é diagnóstico, não veredito verde.
export function normalizeDeclarations(declarations) {
  const source = declarations && typeof declarations === "object" ? declarations : {};
  const asMap = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const asList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  return {
    skillCommon: asList(source.skillCommon),
    skillAxis: asMap(source.skillAxis),
    ruleCommon: asList(source.ruleCommon),
    ruleAxis: asMap(source.ruleAxis),
  };
}

function declaredOf(kind, decl) {
  const axisValues = Object.values(decl[`${kind}Axis`] ?? {}).flat();
  return [...new Set([...decl[`${kind}Common`], ...axisValues])];
}

function isKind(value) {
  return Object.prototype.hasOwnProperty.call(CLASS_LABELS, value);
}

// --- Derivação ------------------------------------------------------------

function loadRoster(root) {
  const registry = readJson(join(root, REGISTRY_FILE));
  const agents = registry && registry.agent && typeof registry.agent === "object" ? registry.agent : {};
  const names = Object.keys(agents).sort();
  const prompts = [];
  const unresolved = [];
  for (const name of names) {
    const entry = agents[name] ?? {};
    const raw = typeof entry.prompt === "string" ? entry.prompt.trim() : "";
    if (raw === "") {
      unresolved.push({ name, reason: "registro sem prompt" });
      continue;
    }
    const ref = PROMPT_REF_RE.exec(raw);
    if (!ref) {
      prompts.push({ name, file: null }); // prompt inline: nada a resolver no disco
      continue;
    }
    const file = normalizeRef(ref[1]);
    if (!isFile(join(root, file))) {
      unresolved.push({ name, reason: `prompt ausente no disco: ${file}` });
      continue;
    }
    prompts.push({ name, file });
  }
  return { registry, agents, names, prompts, unresolved };
}

function loadLock(root) {
  const lock = readJson(join(root, SKILLS_DIR, VENDOR_LOCK_NAME));
  const skills = lock && lock.skills && typeof lock.skills === "object" && !Array.isArray(lock.skills) ? lock.skills : null;
  return skills ? new Set(Object.keys(skills)) : null;
}

function corpusOf(root, roster) {
  const parts = roster.prompts.map((p) => (p.file ? readText(join(root, p.file)) : ""));
  parts.push(readText(join(root, REGISTRY_FILE)));
  return parts.join("\n");
}

function findRow(rows, subject) {
  return rows.find((r) => r.id === subject) ?? null;
}

// A classe `orphan+decision` é contada sob a chave `orphan` (a decisão tem
// contadores próprios: `decided`/`undecided`). Um mapa, não uma concatenação.
const COUNTER_KEY = Object.freeze({
  "vendor-by-axis": "vendor-by-axis",
  consumer: "consumer",
  axis: "axis",
  "orphan+decision": "orphan",
  registered: "registered",
});

// Campos da entrada, `expiresWhen` executável — tudo menos `proof`, que é
// verificado à parte para que "sujeito desapareceu" seja relatado como
// EXPIRAÇÃO (o `proof` de uma órfã cita o próprio arquivo do sujeito; checar a
// prova antes da existência relataria a morte do sujeito como campo faltando).
function reviewEntryShape(entry, index) {
  const label = entry && typeof entry.subject === "string" && entry.subject !== ""
    ? `${entry.class ?? "?"}:${entry.subject}`
    : `OWNER_DECISIONS[${index}]`;
  if (!entry || typeof entry !== "object") return { label, issues: ["entrada não é objeto"] };
  const issues = [];
  for (const field of ["subject", "owner", "decision", "reason"]) {
    const value = entry[field];
    if (typeof value !== "string" || value.trim() === "") issues.push(`${field} ausente`);
  }
  if (!isKind(entry.class)) {
    issues.push(`class fora do enum {skill, rule, agent} ("${entry.class ?? ""}")`);
  }
  if (!Array.isArray(entry.expiresWhen) || entry.expiresWhen.length === 0) {
    issues.push("expiresWhen ausente (decisão sem prazo de validade)");
  } else if (isKind(entry.class)) {
    const allowed = EXPIRY_CONDITIONS[entry.class];
    for (const condition of entry.expiresWhen) {
      if (!allowed.includes(condition)) {
        issues.push(`expiresWhen "${condition}" não é executável para ${entry.class}`);
      }
    }
  }
  return { label, issues };
}

// `proof` = `arquivo:linha` vivo que cita o sujeito.
function reviewEntryProof(entry, root) {
  const issues = [];
  const parsed = parseProof(entry.proof);
  if (!parsed) {
    issues.push(`proof fora do formato arquivo:linha ("${entry.proof ?? ""}")`);
    return issues;
  }
  const text = readText(join(root, parsed.file));
  if (text === "") {
    issues.push(`proof ausente no disco: ${parsed.file}`);
    return issues;
  }
  const lines = text.split("\n");
  if (parsed.line < 1 || parsed.line > lines.length) {
    issues.push(`proof ${parsed.file}:${parsed.line} fora do arquivo: ${lines.length} linha(s)`);
  } else if (!lines[parsed.line - 1].includes(String(entry.subject))) {
    issues.push(`proof ${parsed.file}:${parsed.line} não cita o sujeito`);
  }
  return issues;
}

// As condições de expiração, executadas sobre a linha derivada do sujeito.
function expiredBy(entry, row) {
  const reasons = [];
  for (const condition of entry.expiresWhen ?? []) {
    if (condition === "subject-absent" && !row) {
      reasons.push("o sujeito desapareceu do disco");
    }
    if (condition === "gained-consumer" && row && row.cited) {
      reasons.push("o sujeito ganhou consumidor no roster");
    }
    if (condition === "gained-axis" && row && row.axis.length > 0) {
      reasons.push(`o sujeito ganhou eixo (${row.axis.join(", ")})`);
    }
    if (condition === "gained-lock" && row && row.vendor) {
      reasons.push("o sujeito entrou no vendor-lock");
    }
    if (condition === "gained-registry" && row && row.registered) {
      reasons.push("o sujeito ganhou registro com prompt resolvido");
    }
  }
  return reasons;
}

function reviewDecisions(decisions, ctx) {
  const incomplete = [];
  const stale = [];
  const effective = new Set();
  decisions.forEach((entry, index) => {
    const { label, issues } = reviewEntryShape(entry, index);
    if (issues.length > 0) {
      incomplete.push(`${label}: ${issues.join("; ")}`);
      return;
    }
    const rows = ctx.rows[entry.class] ?? [];
    const row = findRow(rows, entry.subject);
    const reasons = expiredBy(entry, row);
    if (reasons.length > 0) {
      stale.push(`${label} (${reasons.join("; ")}) — remover a entrada`);
      return;
    }
    const proofIssues = reviewEntryProof(entry, ctx.root);
    if (proofIssues.length > 0) {
      incomplete.push(`${label}: ${proofIssues.join("; ")}`);
      return;
    }
    effective.add(`${entry.class}:${entry.subject}`);
  });
  return { incomplete, stale, effective };
}

function zeroCounters() {
  return {
    skills: { total: 0, "vendor-by-axis": 0, consumer: 0, axis: 0, orphan: 0, decided: 0, undecided: 0, suspended: 0 },
    rules: { total: 0, consumer: 0, axis: 0, orphan: 0, decided: 0, undecided: 0 },
    agents: { registry: 0, dirs: 0, registered: 0, orphan: 0, decided: 0, undecided: 0, unresolved: 0 },
    vendorCited: 0,
    lockPresent: false,
    ownerDecisions: 0,
  };
}

function emptyFindings() {
  return {
    untracked: [],
    ambiguous: [],
    lockMismatch: [],
    unresolvedPrompts: [],
    decisionIncomplete: [],
    decisionStale: [],
    attendance: [],
  };
}

/**
 * Deriva o inventário de `root`. Puro: só lê, nunca grava (SPEC I1).
 *
 * @param {string} root raiz injetável (default: cwd)
 * @param {{declarations?: object, decisions?: object[]}} options
 *   declarations — mapas de eixo/comuns do DONO (`installer/install.mjs`),
 *                  injetados pelo adapter porque o dono do dado é o instalador
 *   decisions    — registry a validar (default: `OWNER_DECISIONS`)
 */
export function deriveInventory(root = process.cwd(), options = {}) {
  const decl = normalizeDeclarations(options.declarations);
  const decisions = Array.isArray(options.decisions) ? options.decisions : OWNER_DECISIONS;

  if (!existsSync(join(root, ".agents"))) {
    return { ok: true, vacuous: true, counters: zeroCounters(), artifacts: { skills: [], rules: [], agents: [] }, findings: emptyFindings() };
  }

  const roster = loadRoster(root);
  const corpus = corpusOf(root, roster);
  const lock = loadLock(root);
  const lockPresent = lock !== null;
  const findings = emptyFindings();

  // --- skills ------------------------------------------------------------
  const skillDirs = listDirs(join(root, SKILLS_DIR));
  const skillRows = skillDirs.map((id) => {
    const vendor = lockPresent && lock.has(id);
    const cited = corpus.includes(id);
    const axis = axisKeysOf(decl.skillAxis, id);
    let cls = "suspended";
    if (lockPresent) {
      if (vendor) cls = "vendor-by-axis";
      else if (cited) cls = "consumer";
      else if (axis.length > 0) cls = "axis";
      else cls = "orphan+decision";
    }
    if (vendor && axis.length > 0) {
      findings.ambiguous.push(`${id} ← vendor-by-axis (${VENDOR_LOCK_NAME}) + axis (${axis.join(", ")})`);
    }
    return { kind: "skill", id, class: cls, cited, axis, vendor, registered: false };
  });

  // `checkVendor` só anda lock→disco; a outra direção é deste check.
  const lockMissingDir = lockPresent ? [...lock].filter((id) => !skillDirs.includes(id)).sort() : [];
  const lockMissingEntry = lockPresent ? skillDirs.filter((id) => lock.has(id) && !isFile(join(root, SKILLS_DIR, id, SKILL_ENTRY_NAME))) : [];
  for (const id of lockMissingDir) findings.lockMismatch.push(`${id} (chave do lock sem diretório no disco)`);
  for (const id of lockMissingEntry) findings.lockMismatch.push(`${id} (diretório do lock sem ${SKILL_ENTRY_NAME} legível)`);

  // --- rules -------------------------------------------------------------
  const ruleFiles = listFiles(join(root, RULES_DIR), ".md");
  const ruleRows = ruleFiles.map((name) => {
    const cited = corpus.includes(name);
    const axis = axisKeysOf(decl.ruleAxis, name);
    const cls = cited ? "consumer" : axis.length > 0 ? "axis" : "orphan+decision";
    return { kind: "rule", id: name, class: cls, cited, axis, vendor: false, registered: false };
  });

  // --- agents (medidos pelo REGISTRO, não pelo nome do arquivo) ----------
  const agentDirs = listDirs(join(root, AGENTS_DIR));
  const registeredNames = new Set(roster.prompts.map((p) => p.name));
  const unresolvedNames = new Set(roster.unresolved.map((u) => u.name));
  const agentNames = [...new Set([...roster.names, ...agentDirs])].sort();
  const agentRows = agentNames.map((id) => {
    const registered = registeredNames.has(id);
    // Chave sem prompt resolvido é defeito de registro, não órfão decidível:
    // fica fora de toda classe (o fechamento de agentes passa a não fechar).
    const cls = registered ? "registered" : unresolvedNames.has(id) ? "unresolved" : "orphan+decision";
    return { kind: "agent", id, class: cls, cited: false, axis: [], vendor: false, registered };
  });
  for (const u of roster.unresolved) findings.unresolvedPrompts.push(`${u.name} (${u.reason})`);

  // --- registry: expira ou se justifica ---------------------------------
  const { incomplete, stale, effective } = reviewDecisions(decisions, { root, rows: { skill: skillRows, rule: ruleRows, agent: agentRows } });
  findings.decisionIncomplete = incomplete;
  findings.decisionStale = stale;

  for (const row of [...skillRows, ...ruleRows, ...agentRows]) {
    if (row.class !== "orphan+decision") continue;
    if (!effective.has(`${row.kind}:${row.id}`)) findings.untracked.push(`${row.kind}:${row.id}`);
  }

  // --- fechamento --------------------------------------------------------
  const counters = zeroCounters();
  counters.lockPresent = lockPresent;
  counters.ownerDecisions = decisions.length;
  counters.vendorCited = skillRows.filter((r) => r.vendor && r.cited).length;

  counters.skills.total = skillRows.length;
  for (const r of skillRows) {
    if (r.class === "suspended") counters.skills.suspended += 1;
    else counters.skills[COUNTER_KEY[r.class]] += 1;
    if (r.class === "orphan+decision") {
      if (effective.has(`skill:${r.id}`)) counters.skills.decided += 1;
      else counters.skills.undecided += 1;
    }
  }

  counters.rules.total = ruleRows.length;
  for (const r of ruleRows) {
    counters.rules[COUNTER_KEY[r.class]] += 1;
    if (r.class === "orphan+decision") {
      if (effective.has(`rule:${r.id}`)) counters.rules.decided += 1;
      else counters.rules.undecided += 1;
    }
  }

  counters.agents.registry = roster.names.length;
  counters.agents.dirs = agentDirs.length;
  counters.agents.unresolved = roster.unresolved.length;
  for (const r of agentRows) {
    if (r.class === "registered") counters.agents.registered += 1;
    else if (r.class === "orphan+decision") counters.agents.orphan += 1;
    if (r.class === "orphan+decision") {
      if (effective.has(`agent:${r.id}`)) counters.agents.decided += 1;
      else counters.agents.undecided += 1;
    }
  }

  // (a) |disco| = Σ classes — por tipo. Skill sem lock é suspensa, não somada.
  if (lockPresent) {
    const s = counters.skills;
    const sum = s["vendor-by-axis"] + s.consumer + s.axis + s.orphan;
    if (sum !== s.total) {
      findings.attendance.push(
        `skills: disco=${s.total} ≠ Σ classes=${sum} (vendor=${s["vendor-by-axis"]} + consumer=${s.consumer} + axis=${s.axis} + orphan=${s.orphan})`,
      );
    }
    // (b) |população declarada| = |disco| — o dono da declaração é o instalador.
    const declaredLocal = new Set(declaredOf("skill", decl));
    const vendorOnDisk = skillRows.filter((r) => r.vendor).length;
    if (vendorOnDisk + declaredLocal.size !== s.total) {
      findings.attendance.push(
        `skills: disco=${s.total} ≠ lock∩disco (${vendorOnDisk}) + declarações locais (${declaredLocal.size})`,
      );
    }
  }
  {
    const r = counters.rules;
    const sum = r.consumer + r.axis + r.orphan;
    if (sum !== r.total) {
      findings.attendance.push(
        `rules: disco=${r.total} ≠ Σ classes=${sum} (consumer=${r.consumer} + axis=${r.axis} + orphan=${r.orphan})`,
      );
    }
    const declaredRules = new Set(declaredOf("rule", decl));
    if (declaredRules.size !== r.total) {
      findings.attendance.push(`rules: disco=${r.total} ≠ declarações do instalador (${declaredRules.size})`);
    }
  }
  {
    const a = counters.agents;
    if (a.registered + a.orphan !== a.registry) {
      findings.attendance.push(
        `agents: registro=${a.registry} ≠ Σ classes=${a.registered + a.orphan} (registered=${a.registered} + orphan=${a.orphan}; unresolved=${a.unresolved})`,
      );
    }
  }

  const ok = Object.values(findings).every((list) => list.length === 0);
  return {
    ok,
    vacuous: false,
    counters,
    artifacts: { skills: skillRows, rules: ruleRows, agents: agentRows },
    findings,
  };
}

export function runInventoryChecks(root = process.cwd(), options = {}) {
  const inventory = deriveInventory(root, options);
  const f = inventory.findings;
  const c = inventory.counters;

  if (inventory.vacuous) {
    const detail = "N/A — .agents/ ausente (vacuous-safe)";
    const ids = [
      "inventory-artifact-untracked",
      "inventory-class-ambiguous",
      "inventory-attendance-drift",
      "inventory-lock-disk-mismatch",
      "inventory-agent-prompt-unresolved",
      "owner-decision-incomplete",
      "owner-decision-stale",
    ];
    return {
      ok: true,
      counters: c,
      artifacts: inventory.artifacts,
      results: ids.map((id) => ({ id, status: "PASS", detail, counters: {} })),
    };
  }

  const skillSum = c.skills["vendor-by-axis"] + c.skills.consumer + c.skills.axis + c.skills.orphan;
  const results = [
    {
      id: "inventory-artifact-untracked",
      status: f.untracked.length ? "FAIL" : "PASS",
      detail: f.untracked.length
        ? `${f.untracked.length} artefato(s) no disco sem classe derivável e sem decisão de dono: ${f.untracked.join("; ")} — falta entrada em OWNER_DECISIONS`
        : `artefatos sem classe e sem decisão=0 (skills=${c.skills.total}, rules=${c.rules.total}, agents=${c.agents.registered + c.agents.orphan})`,
      counters: { untracked: f.untracked.length },
    },
    {
      id: "inventory-class-ambiguous",
      status: f.ambiguous.length ? "FAIL" : "PASS",
      detail: f.ambiguous.length
        ? `${f.ambiguous.length} artefato(s) casando classes contraditórias: ${f.ambiguous.join("; ")} — a precedência resolve classes, não declarações contraditórias`
        : `classes contraditórias=0 (precedência declarada: skill ${CLASS_LABELS.skill.join(" > ")}; rule ${CLASS_LABELS.rule.join(" > ")}; agent ${CLASS_LABELS.agent.join(" > ")}; vendor×consumer resolvido, vendorCited=${c.vendorCited})`,
      counters: { ambiguous: f.ambiguous.length, vendorCited: c.vendorCited },
    },
    {
      id: "inventory-attendance-drift",
      status: f.attendance.length ? "FAIL" : "PASS",
      detail: f.attendance.length
        ? `fechamento quebrado: ${f.attendance.join("; ")}`
        : `fechamento: skills ${c.skills.total}=${c.skills["vendor-by-axis"]}+${c.skills.consumer}+${c.skills.axis}+${c.skills.orphan}; rules ${c.rules.total}=${c.rules.consumer}+${c.rules.axis}+${c.rules.orphan}; agents ${c.agents.registry}=${c.agents.registered}+${c.agents.orphan}`,
      counters: c,
    },
    {
      id: "inventory-lock-disk-mismatch",
      status: f.lockMismatch.length ? "FAIL" : "PASS",
      detail: f.lockMismatch.length
        ? `lock↔disco: ${f.lockMismatch.length} divergência(s): ${f.lockMismatch.join("; ")}`
        : c.lockPresent
          ? `lock↔disco: ${c.skills["vendor-by-axis"]} chave(s) com diretório, 0 divergência nas duas direções`
          : `lock↔disco: ${VENDOR_LOCK_NAME} ausente — classificação de skill suspensa (${c.skills.suspended} skill(s)), nunca FAIL por ausência de input`,
      counters: { mismatches: f.lockMismatch.length, lockPresent: c.lockPresent },
    },
    {
      id: "inventory-agent-prompt-unresolved",
      status: f.unresolvedPrompts.length ? "FAIL" : "PASS",
      detail: f.unresolvedPrompts.length
        ? `${f.unresolvedPrompts.length} registro(s) com prompt não resolvido: ${f.unresolvedPrompts.join("; ")}`
        : `prompts do roster resolvidos=${c.agents.registered}/${c.agents.registry} (a unidade é o registro, não o nome do arquivo)`,
      counters: { resolved: c.agents.registered, registry: c.agents.registry, unresolved: c.agents.unresolved },
    },
    {
      id: "owner-decision-incomplete",
      status: f.decisionIncomplete.length ? "FAIL" : "PASS",
      detail: f.decisionIncomplete.length
        ? `OWNER_DECISIONS com ${f.decisionIncomplete.length} entrada(s) incompleta(s): ${f.decisionIncomplete.join("; ")}`
        : `OWNER_DECISIONS com ${c.ownerDecisions} entrada(s), todas com ${DECISION_FIELDS.join("/")} e proof vivo`,
      counters: { entries: c.ownerDecisions, incomplete: f.decisionIncomplete.length },
    },
    {
      id: "owner-decision-stale",
      status: f.decisionStale.length ? "FAIL" : "PASS",
      detail: f.decisionStale.length
        ? `OWNER_DECISIONS com ${f.decisionStale.length} entrada(s) expirada(s): ${f.decisionStale.join("; ")}`
        : `OWNER_DECISIONS com ${c.ownerDecisions} entrada(s) vivas (sujeito no disco e ainda órfão)`,
      counters: { entries: c.ownerDecisions, stale: f.decisionStale.length },
    },
  ];

  // A soma das classes é a mesma que o `detail` narra: se divergir, o veredito
  // não pode ser verde só porque a lista de achados ficou vazia. Sem lock, a
  // classificação de skill está suspensa por desenho — a soma não se aplica.
  const skillsClose = c.lockPresent ? skillSum === c.skills.total : c.skills.suspended === c.skills.total;
  const healthy = Object.values(f).every((list) => list.length === 0) && skillsClose;
  return { ok: healthy, counters: c, artifacts: inventory.artifacts, results };
}
