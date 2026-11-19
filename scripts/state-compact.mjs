// state-compact.mjs — separa o estado VIVO de workflow-state.json do histórico.
//
// Defeito que fecha: workflow-state.json virou diário de bordo (127 KB / 96
// chaves) e as chaves que o runtime lê ficaram enterradas entre incidentes,
// batches e decisões antigas. A compactação move — nunca apaga — todo valor
// fora da whitelist para workflow-history.jsonl (append-only, uma linha JSON
// por chave).
//
// Contrato (medido por scripts/__tests__/state-compact.spec.mjs):
//   C1. whitelist explícita (LIVE_KEYS): nada sai sem estar nela;
//   C2. `{ts,key,value}` por linha → toda chave arquivada recuperável por key;
//   C3. dedupe por sha256(JSON.stringify(value)) + key ⇒ 2ª execução = 0 linhas;
//   C4. histórico é escrito ANTES do estado (nada removido sem registro prévio);
//   C5. follow_ups mantém open/pending COM created_at (ou, na falta, o mais
//       recente que tenha created_at) — PAP-12/FLOW-06 exige created_at string
//       em cada item sobrevivente; item sem data é arquivado, nunca vivo.
//
// Uso: node scripts/state-compact.mjs [--state <path>] [--history <path>] [--dry-run]
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Chaves que gate.js / sdd-checks / PAP-12 leem (ordem = ordem de saída). */
export const LIVE_KEYS = Object.freeze([
  "current_feature",
  "current_phase",
  "previous_phase",
  "next_phase",
  "type",
  "artifacts",
  "gates",
  "code_review",
  "code_review_status",
  "code_review_status_ciclo",
  "harness_status",
  "harness_status_detail",
  "features",
  "prd_adr",
  "follow_ups",
  "follow_ups_created_at_basis",
  "overrides",
  "overrides_history",
  "superseded_cycles",
  "harness_v2",
  "last_update",
]);

export const SIZE_LIMIT = 20_480;
export const ARCHIVED_FOLLOW_UPS_KEY = "follow_ups:archived";

export function serializeState(state) {
  return JSON.stringify(state, null, 2);
}

export function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** FLOW-06: vivo = open/pending COM created_at string; fallback = mais recente com data. */
export function selectFollowUps(list) {
  const items = Array.isArray(list) ? list : [];
  const dated = items.filter((f) => f && typeof f.created_at === "string");
  const keep = dated.filter((f) => f.status === "open" || f.status === "pending");
  if (keep.length > 0) {
    return { keep, archived: items.filter((f) => !keep.includes(f)) };
  }
  if (dated.length === 0) return { keep: [], archived: items };
  const newest = [...dated].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return { keep: [newest], archived: items.filter((f) => f !== newest) };
}

/** Uma linha por chave; `history` = entradas já presentes no jsonl. */
export function compactState(state, options = {}) {
  const liveKeys = options.liveKeys ?? LIVE_KEYS;
  const now = options.now ?? (() => new Date().toISOString());
  const history = options.history ?? [];
  const ts = now();

  const seen = new Set(history.map((e) => `${e.key}\u0000${hashValue(e.value)}`));
  const candidates = [];
  const archivedKeys = [];
  const push = (key, value) => {
    archivedKeys.push(key);
    const hash = hashValue(value);
    if (!seen.has(`${key}\u0000${hash}`)) {
      seen.add(`${key}\u0000${hash}`);
      candidates.push({ ts, key, value });
    }
  };

  const next = {};
  for (const key of liveKeys) {
    if (!(key in state)) continue;
    next[key] = state[key];
  }

  if ("follow_ups" in state) {
    const original = state.follow_ups;
    const picked = selectFollowUps(original);
    next.follow_ups = picked.keep;
    if (picked.archived.length > 0) {
      push(ARCHIVED_FOLLOW_UPS_KEY, original);
    }
  }

  for (const key of Object.keys(state)) {
    if (liveKeys.includes(key)) continue;
    push(key, state[key]);
  }

  if ("last_update" in next) next.last_update = ts;

  const before = serializeState(state);
  const after = serializeState(next);
  return {
    state: next,
    entries: candidates,
    archivedKeys,
    beforeBytes: Buffer.byteLength(before, "utf8"),
    afterBytes: Buffer.byteLength(after, "utf8"),
  };
}

export function readHistory(historyPath) {
  if (!existsSync(historyPath)) return [];
  const text = readFileSync(historyPath, "utf8");
  const out = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === "") continue;
    try {
      out.push(JSON.parse(lines[i]));
    } catch (error) {
      throw new Error(`${historyPath}:${i + 1} linha inválida: ${error.message}`);
    }
  }
  return out;
}

function appendHistory(historyPath, entries) {
  if (entries.length === 0) return 0;
  mkdirSync(dirname(historyPath), { recursive: true });
  let prefix = "";
  if (existsSync(historyPath) && statSync(historyPath).size > 0) {
    const text = readFileSync(historyPath, "utf8");
    if (!text.endsWith("\n")) prefix = "\n";
  }
  appendFileSync(historyPath, prefix + entries.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
  return entries.length;
}

export function parseArgs(argv) {
  const opts = {
    statePath: join(REPO_ROOT, "workflow-state.json"),
    historyPath: join(REPO_ROOT, "workflow-history.jsonl"),
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--state") opts.statePath = argv[++i];
    else if (arg === "--history") opts.historyPath = argv[++i];
    else throw new Error(`arg desconhecido: ${arg}`);
  }
  if (!opts.statePath || !opts.historyPath) throw new Error("--state/--history exigem um caminho");
  return opts;
}

export function runCompact({ statePath, historyPath, dryRun = false, now } = {}) {
  const raw = readFileSync(statePath, "utf8");
  const state = JSON.parse(raw);
  const history = readHistory(historyPath);
  const result = compactState(state, { history, now });
  const beforeBytes = statSync(statePath).size;

  if (!dryRun) {
    appendHistory(historyPath, result.entries);
    writeFileSync(statePath, serializeState(result.state), "utf8");
  }

  const mode = dryRun ? "dry-run" : "apply";
  console.log(
    `state-compact ${mode}: arquivar=${result.archivedKeys.length} ` +
      `novas=${result.entries.length} bytes ${beforeBytes}->${result.afterBytes} ` +
      `chaves vivo=${Object.keys(result.state).length}`,
  );
  return { ...result, beforeBytes, dryRun };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runCompact(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(`state-compact: ${error.message}`);
    process.exitCode = 1;
  }
}
