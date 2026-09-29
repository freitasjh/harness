// installer/install.mjs — harness-installer Batch 1/2 (IN-01..IN-04)
// Node ESM, zero deps. Gera-nunca-copia; backup-first; segredo so-memoria.
// Escopo: SOMENTE este arquivo + installer/__tests__/. Nunca toca outro repo;
// fixtures dos testes usam tempdir.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export const VERSION = '1.0.0';
export const MIN_NODE_VERSION = [20, 0, 0];
export const MANIFEST_NAME = '.harness-install.json';

export class InstallError extends Error {
  constructor(message, code = 'INSTALL_ABORT') {
    super(message);
    this.name = 'InstallError';
    this.code = code;
  }
}

// ---------- pre-flight (IN-01) ----------

function parseNode(v) {
  const m = String(v || process.version).match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function gte(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

export function assertInside(target, p) {
  const t = path.resolve(target);
  const r = path.resolve(p);
  if (r !== t && !r.startsWith(t + path.sep)) {
    throw new InstallError(`write outside target: ${p}`, 'OUTSIDE_TARGET');
  }
  return r;
}

export function preflight({ target, uid, allowRoot = false, nodeVersion } = {}) {
  if (!target || typeof target !== 'string' || target.trim() === '') {
    throw new InstallError('missing --target', 'BAD_TARGET');
  }
  // R1: rejeita segmento `..` literal no argumento (traversal antes do resolve).
  if (/(^|[/\\])\.\.([/\\]|$)/.test(target)) {
    throw new InstallError(`target escapes (.. segment): ${target}`, 'OUTSIDE_TARGET');
  }
  const resolved = path.resolve(target);
  if (!path.isAbsolute(resolved)) throw new InstallError('target must resolve absolute', 'BAD_TARGET');

  const ver = parseNode(nodeVersion);
  if (!gte(ver, MIN_NODE_VERSION)) {
    throw new InstallError(
      `node minimum ${MIN_NODE_VERSION.join('.')} required, got ${ver.join('.')} (G1/Y2)`,
      'NODE_MIN',
    );
  }
  const effectiveUid = uid !== undefined ? uid : (typeof process.getuid === 'function' ? process.getuid() : null);
  if (effectiveUid === 0 && !allowRoot) {
    throw new InstallError('refusing to run as uid 0 without --allow-root (Y2)', 'UID_ROOT');
  }
  // G3/R9: manifesto pre-existente => aborta com instrucao.
  const manifestPath = path.join(resolved, MANIFEST_NAME);
  if (fs.existsSync(manifestPath)) {
    let parsed = null;
    try {
      parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      parsed = null;
    }
    const isOurs = parsed && parsed.manifestSchemaVersion === 1 && typeof parsed.source === 'string';
    if (isOurs) {
      throw new InstallError(
        `re-install detected (${MANIFEST_NAME} exists). See manifest backupDir; remove or run upgrade path. Aborting.`,
        'REINSTALL',
      );
    }
    throw new InstallError(
      `foreign manifest ${MANIFEST_NAME} exists (not ours). Human must resolve before install. Aborting.`,
      'FOREIGN_MANIFEST',
    );
  }
  return { target: resolved, uid: effectiveUid };
}

// ---------- inventario (IN-01) ----------

const LAYER_PREFIX = [
  { layer: 'opencode.json', paths: ['opencode.json'] },
  { layer: '.agents/agents', paths: ['.agents/agents'] },
  { layer: '.agents/rules', paths: ['.agents/rules'] },
  { layer: '.agents/skills', paths: ['.agents/skills'] },
  { layer: '.opencode/plugins', paths: ['.opencode/plugins'] },
  { layer: 'harness.config.json', paths: ['harness.config.json'] },
];

export function inventory(target) {
  const t = path.resolve(target);
  const layers = [];
  for (const { layer } of LAYER_PREFIX) layers.push({ layer, present: layerPresent(t, layer) });
  return { target: t, layers };
}

function layerPresent(t, layer) {
  if (layer === 'opencode.json' || layer === 'harness.config.json') return fs.existsSync(path.join(t, layer));
  const dir = path.join(t, layer);
  if (!fs.existsSync(dir)) return false;
  try {
    return fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

// ---------- backup (IN-01/I1 + FU-22) ----------
// FU-22 (via escolhida: excecao documentada em SPEC §3): o backup vive AO LADO
// do target (ou --backup-dir), NUNCA dentro da arvore instalada. Por isso o
// backupDir esta explicitamente FORA da fence assertInside — a fence vale para
// arquivos instalados/mergeados. Nenhum guard adicional no codigo; a excecao
// e a regra, documentada e testada (suite.spec: backup-outside-target ok).

const BACKUP_TRACKED = ['opencode.json', 'harness.config.json', '.agents', '.opencode', MANIFEST_NAME];

export function resolveBackupDir(target, backupRoot) {
  const t = path.resolve(target);
  if (backupRoot) {
    const dir = path.resolve(backupRoot);
    if (dir === t) throw new InstallError('backup dir must not equal target', 'BACKUP_FAIL');
    return dir;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(path.dirname(t), `.harness-backup-${path.basename(t)}-${stamp}`);
}

export function backup(target, { backupRoot, injectFailure = false } = {}) {
  const t = path.resolve(target);
  if (injectFailure) throw new InstallError('backup failed (injected): aborting before any write (I1)', 'BACKUP_FAIL');
  const dir = resolveBackupDir(t, backupRoot);
  fs.mkdirSync(dir, { recursive: true });
  const copied = [];
  for (const rel of BACKUP_TRACKED) {
    const src = path.join(t, rel);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const st = fs.statSync(src);
    if (st.isDirectory()) fs.cpSync(src, dst, { recursive: true });
    else fs.copyFileSync(src, dst);
    copied.push(rel);
  }
  // I1: verifica existencia antes de liberar escrita.
  if (!fs.existsSync(dir)) throw new InstallError('backup verification failed: dir missing (I1)', 'BACKUP_FAIL');
  return { backupDir: dir, copied, verified: true };
}

// ---------- Q&A (IN-02/ADR-005/I5) ----------

export const QUESTIONS = [
  { key: 'project', prompt: 'Nome do projeto?', kind: 'name' },
  { key: 'stack', prompt: 'Stack do destino? (node/java+vue/outra)', kind: 'stack' },
  { key: 'suiteCommand', prompt: 'Comando da suite de testes?', kind: 'command' },
  { key: 'pluginsDir', prompt: 'Diretorio de plugins no destino?', kind: 'path' },
  { key: 'deployToken', prompt: 'Token de deploy (sensivel, opcional)?', kind: 'string', secret: true },
];

function commandResolves(cmd) {
  if (!cmd || typeof cmd !== 'string') return false;
  const bin = cmd.trim().split(/\s+/)[0];
  if (!bin) return false;
  if (bin.includes('/') || bin.includes(path.sep)) return fs.existsSync(path.resolve(bin));
  const pathEnv = (process.env.PATH || '').split(path.delimiter);
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE').split(';') : [''];
  return pathEnv.some((d) => exts.some((e) => { try { return fs.existsSync(path.join(d, bin + e)); } catch { return false; } }));
}

export function validateAnswer(target, key, value) {
  const q = QUESTIONS.find((x) => x.key === key);
  if (!q) throw new InstallError(`unknown question: ${key}`, 'BAD_ANSWER');
  const t = path.resolve(target);
  switch (q.kind) {
    case 'name':
      if (!value || String(value).trim() === '') throw new InstallError('project must be non-empty', 'BAD_ANSWER');
      return String(value).trim();
    case 'stack':
      if (!['node', 'java+vue', 'outra', 'node-esm'].includes(String(value))) {
        throw new InstallError('stack must be one of node|java+vue|outra', 'BAD_ANSWER');
      }
      return String(value);
    case 'path': {
      const p = path.resolve(t, String(value));
      assertInside(t, p);
      if (!fs.existsSync(p)) throw new InstallError(`path does not exist: ${value}`, 'BAD_ANSWER');
      return p;
    }
    case 'command':
      if (!commandResolves(String(value))) throw new InstallError(`command does not resolve: ${value}`, 'BAD_ANSWER');
      return String(value);
    case 'string':
      return value === undefined || value === null ? '' : String(value);
    default:
      return value;
  }
}

export function collectAnswers(target, scripted) {
  const answers = {};
  for (const q of QUESTIONS) {
    if (q.secret && (scripted[q.key] === undefined || scripted[q.key] === '')) {
      answers[q.key] = '';
      continue;
    }
    if (scripted[q.key] === undefined && !q.secret) throw new InstallError(`missing answer: ${q.key}`, 'BAD_ANSWER');
    answers[q.key] = validateAnswer(target, q.key, scripted[q.key]);
  }
  return answers;
}

// Serializa para disco/log: segredo nunca sai da memoria (I5).
export function serializeAnswers(answers) {
  const out = {};
  for (const q of QUESTIONS) {
    if (q.secret) continue;
    if (answers[q.key] !== undefined) out[q.key] = answers[q.key];
  }
  return out;
}

// ---------- geracao (IN-03/ADR-002/I3) ----------
// UNICA fonte do config: construido de answers validados. Nenhuma leitura de
// template, nenhum caminho de copia neste arquivo por construcao.

export function generateConfig(answers) {
  if (!answers || !answers.project) throw new InstallError('answers.project required', 'BAD_ANSWER');
  const stack = answers.stack || 'node';
  const suiteFull = answers.suiteCommand || 'node --test';
  const isNodeOnly = stack === 'node' || stack === 'node-esm';
  return {
    version: 1,
    project: answers.project,
    stack: {
      backend: isNodeOnly
        ? 'N/A — no Java/Maven backend declared by destination Q&A; Node-only stack'
        : `${stack} backend (declared via Q&A)`,
      frontend: isNodeOnly
        ? 'N/A — no Vue/Vite frontend declared by destination Q&A; Node-only stack'
        : `${stack} frontend (declared via Q&A)`,
    },
    moduleMap: {
      plugins: '.opencode/plugins',
      rules: '.agents/rules',
      schemas: '.agents/schemas',
    },
    commands: {
      suiteFull,
      unit: suiteFull,
    },
    infra: { composeFile: null, ports: { backend: null, frontend: null } },
    mcp: { required: ['chrome-devtools'] },
    protectedPaths: [
      '.opencode/plugins/**',
      '.agents/rules/**',
      '.agents/schemas/**',
      '.agents/agents/**',
      'opencode.json',
      'harness.config.json',
    ],
    gates: { picco: 'enforce', evidence: 'enforce', hitlBatch: 'enforce', e2eGreenfield: 'warn' },
    riskPaths: ['**/security/**', '**/auth/**'],
    escalateOnRisk: { e2eGreenfield: 'enforce', evidenceScenario: 'required' },
    contraproveTimeoutMs: 900000,
    evidence: { path: 'harness/', schema: '.agents/schemas/harness-report.schema.json' },
  };
}

// ---------- merge (IN-04/§5.2) ----------

export function normalizeSection(s) {
  return String(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

function sortDeep(o) {
  if (Array.isArray(o)) return o.map(sortDeep);
  if (o && typeof o === 'object') {
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortDeep(o[k])]));
  }
  return o;
}

export function hasHarnessSection(content) {
  const lines = String(content).split('\n');
  return lines.some((l) => normalizeSection(l) === normalizeSection('## Harness v7'));
}

function layerOf(rel) {
  if (rel === 'opencode.json') return 'opencode.json';
  if (rel === 'harness.config.json') return 'harness.config.json';
  if (rel.startsWith('.agents/agents/')) return '.agents/agents/*';
  if (rel.startsWith('.agents/rules/')) return '.agents/rules/*';
  if (rel.startsWith('.agents/skills/')) return '.agents/skills/*';
  if (rel.startsWith('.opencode/plugins/')) return '.opencode/plugins/*';
  return 'other';
}

export function mergeOpencodeJson(existing, incoming) {
  const merged = { ...(existing || {}) };
  const plugins = new Set([...(existing?.plugin || []), ...(incoming?.plugin || [])]);
  merged.plugin = [...plugins];
  const instr = [...(existing?.instructions || [])];
  for (const i of incoming?.instructions || []) if (!instr.includes(i)) instr.push(i);
  if (instr.length) merged.instructions = instr;
  for (const [k, v] of Object.entries(incoming || {})) {
    if (k === 'plugin' || k === 'instructions' || k === 'permission' || k === 'agent') continue;
    if (merged[k] === undefined) merged[k] = v;
  }
  // permission/agent so-adiciona: preserva destino, flag se divergir.
  let conflict = false;
  for (const k of ['permission', 'agent']) {
    if (incoming?.[k] === undefined) continue;
    if (merged[k] === undefined) { merged[k] = incoming[k]; continue; }
    if (JSON.stringify(merged[k]) !== JSON.stringify(incoming[k])) conflict = true;
  }
  return { merged, conflict };
}

export function mergeAgentFile(existing, incomingSection) {
  if (hasHarnessSection(existing)) return { action: 'flag', content: existing, reason: 'Harness v7 section already present' };
  return { action: 'merge', content: `${existing.replace(/\s+$/, '')}\n\n${incomingSection}` };
}

export function planMerge(target, incomingFiles, _opts = {}) {
  const t = path.resolve(target);
  const plan = [];
  for (const [rel, content] of Object.entries(incomingFiles)) {
    assertInside(t, path.join(t, rel));
    const layer = layerOf(rel);
    const abs = path.join(t, rel);
    const exists = fs.existsSync(abs);
    if (layer === 'harness.config.json') {
      plan.push({ path: rel, layer, action: exists ? 'generate-overwrite' : 'create', reason: 'generated from Q&A (ADR-002)' });
      continue;
    }
    if (!exists) { plan.push({ path: rel, layer, action: 'create' }); continue; }
    const current = fs.readFileSync(abs, 'utf8');
    if (current === content) { plan.push({ path: rel, layer, action: 'noop' }); continue; }
    if (rel === 'opencode.json') {
      let parsed;
      try {
        parsed = JSON.parse(current);
      } catch {
        throw new InstallError(`corrupt ${rel}: invalid JSON, aborting (R1); never merge nor overwrite worse`, 'CORRUPT');
      }
      let inc;
      try {
        inc = JSON.parse(content);
      } catch {
        throw new InstallError('incoming opencode.json invalid', 'CORRUPT');
      }
      // deep-compare normalizado (whitespace-insensitive): stringify canonico recursivo.
      const canon = (o) => JSON.stringify(sortDeep(o));
      if (canon(parsed) === canon(inc)) { plan.push({ path: rel, layer, action: 'noop' }); continue; }
      const { conflict } = mergeOpencodeJson(parsed, inc);
      plan.push(conflict
        ? { path: rel, layer, action: 'flag', reason: 'permission/agent conflict: human must resolve' }
        : { path: rel, layer, action: 'merge', reason: 'additive merge: plugin union, instructions append' });
      continue;
    }
    if (layer === '.agents/agents/*') {
      const r = mergeAgentFile(current, content);
      plan.push(r.action === 'merge'
        ? { path: rel, layer, action: 'merge', reason: 'append Harness v7 section' }
        : { path: rel, layer, action: 'flag', reason: r.reason });
      continue;
    }
    // rules/skills/plugins/codigo: nunca auto-merge de prosa/codigo.
    plan.push({ path: rel, layer, action: 'flag', reason: `${layer}: exists-different => flag (never auto-merge)` });
  }
  return plan;
}

export function applyMerge(target, plan, { incomingFiles = {}, dryRun = false } = {}) {
  const t = path.resolve(target);
  const written = [];
  const flagged = [];
  if (dryRun) {
    return { written, flagged: plan.filter((p) => p.action === 'flag'), planned: plan.length };
  }
  for (const step of plan) {
    const abs = assertInside(t, path.join(t, step.path));
    if (step.action === 'noop') continue;
    if (step.action === 'flag') { flagged.push(step); continue; }
    const incoming = incomingFiles[step.path];
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (step.action === 'create' || step.action === 'generate-overwrite') {
      if (typeof incoming !== 'string') {
        throw new InstallError(`missing incoming content for ${step.path}: refusing silent empty write (FU-21)`, 'MISSING_INCOMING');
      }
      const body = incoming;
      const pre = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
      fs.writeFileSync(abs, body);
      written.push({ path: step.path, strategy: step.action, preMergeSha256: pre ? sha256(pre) : undefined });
    } else if (step.action === 'merge') {
      if (typeof incoming !== 'string') {
        throw new InstallError(`missing incoming content for ${step.path}: refusing silent empty write (FU-21)`, 'MISSING_INCOMING');
      }
      const current = fs.readFileSync(abs, 'utf8');
      const pre = sha256(current);
      if (step.path === 'opencode.json') {
        const { merged } = mergeOpencodeJson(JSON.parse(current), JSON.parse(incoming));
        fs.writeFileSync(abs, JSON.stringify(merged, null, 2));
      } else {
        const r = mergeAgentFile(current, incoming);
        fs.writeFileSync(abs, r.content);
      }
      written.push({ path: step.path, strategy: 'merge', preMergeSha256: pre });
    }
  }
  return { written, flagged };
}

export function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// ---------- manifesto (IN-04/Y1) ----------

export function buildManifest({
  target, backupDir, installed = [], merged = [], flagged = [],
  answers = {}, checks = { passed: true, failed: [] }, fileContents = {},
  source = `harness@${VERSION}`,
} = {}) {
  const fileHashes = [];
  const all = [...installed, ...merged];
  for (const f of all) {
    const body = fileContents[f.path];
    if (typeof body !== 'string') continue;
    const entry = { path: f.path, sha256: sha256(body) };
    if (f.preMergeSha256) entry.preMergeSha256 = f.preMergeSha256;
    fileHashes.push(entry);
  }
  return {
    version: VERSION,
    date: new Date().toISOString(),
    source,
    target: path.resolve(target),
    installed,
    merged,
    flagged: flagged.map((f) => ({ path: f.path, reason: f.reason || 'flagged' })),
    backupDir: backupDir ? path.resolve(backupDir) : backupDir,
    answers: serializeAnswers(answers),
    checks,
    manifestSchemaVersion: 1,
    fileHashes,
    flaggedResolution: flagged.map((f) => ({ path: f.path, status: 'open', how: '' })),
    validationMarks: Object.keys(serializeAnswers(answers)).map((k) => ({ item: k, status: 'validated' })),
  };
}

// ---------- checks pos-instalacao (IN-05/RF-07/I6/R3) ----------

// Denylist inicial de literais sabidamente-estranhos: marcadores de stack de
// OUTRO projeto que denunciam copia verbatim (caso Hive). Scan
// case-insensitive sobre arquivos instalados/copiados listados no manifesto.
export const DENYLIST = [
  'taskflow',
  'vuetify',
  'primevue',
  'lombok',
  'mapstruct',
  'restassured',
];

export function scanLiterals(content) {
  const lower = String(content).toLowerCase();
  return DENYLIST.filter((lit) => lower.includes(lit));
}

export function runChecks(target, { manifest = null } = {}) {
  const t = path.resolve(target);
  const failed = [];
  if (!manifest) {
    failed.push('manifest-missing: .harness-install.json nao informado');
    return { passed: false, failed };
  }
  const manifestPath = path.join(t, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) failed.push('manifest-missing: .harness-install.json ausente no target');
  for (const rel of ['opencode.json', 'harness.config.json']) {
    const abs = path.join(t, rel);
    if (!fs.existsSync(abs)) {
      if (rel === 'harness.config.json') failed.push('config-missing: harness.config.json ausente');
      continue;
    }
    try {
      JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch {
      failed.push(`json-invalid: ${rel} corrompido (R1)`);
    }
  }
  for (const f of manifest.flagged || []) {
    failed.push(`flagged-open: ${f.path} (${f.reason || 'sem motivo'}) — resolucao humana pendente (I6)`);
  }
  const listed = [...(manifest.installed || []), ...(manifest.merged || [])];
  for (const f of listed) {
    const abs = path.join(t, f.path);
    if (!fs.existsSync(abs)) continue;
    const st = fs.statSync(abs);
    if (!st.isFile()) continue;
    const hits = scanLiterals(fs.readFileSync(abs, 'utf8'));
    for (const h of hits) failed.push(`literal-denied: ${f.path} contem '${h}' (R3/canario)`);
  }
  return { passed: failed.length === 0, failed };
}

// ---------- manifesto em disco (IN-06/I4) ----------

export function writeManifest(target, manifest, { dryRun = false, fsImpl = fs } = {}) {
  if (dryRun) return { skipped: true, path: null };
  const t = path.resolve(target);
  const abs = assertInside(t, path.join(t, MANIFEST_NAME));
  fsImpl.writeFileSync(abs, JSON.stringify(manifest, null, 2));
  return { skipped: false, path: abs };
}

// ---------- segredo fora do log (IN-06/Y5) ----------

export function sanitizeLog(line, answers = {}) {
  let out = String(line);
  const secrets = new Set();
  for (const q of QUESTIONS) {
    if (!q.secret) continue;
    const v = answers[q.key];
    if (typeof v === 'string' && v !== '') secrets.add(v);
  }
  for (const s of secrets) out = out.split(s).join('[REDACTED]');
  return out;
}

// ---------- trava dogfood (IN-07/Y4/R5) ----------

export function assertDogfoodTarget(target, { explicit = false, confirmed = false } = {}) {
  const r = path.resolve(target);
  const tmp = path.resolve(os.tmpdir());
  if (r === tmp || r.startsWith(tmp + path.sep)) return r;
  if (explicit && confirmed) return r;
  throw new InstallError(
    `refusing target outside /tmp without explicit --target + confirmation: ${r} (R5/Y4)`,
    'DOGFOOD_GUARD',
  );
}

// ---------- main: orquestracao com I1 enforcement (FU-20) ----------

export function requireVerifiedBackup(bk) {
  if (!bk || bk.verified !== true) {
    throw new InstallError('backup unverified: aborting before any write (I1/FU-20)', 'BACKUP_UNVERIFIED');
  }
  return bk.backupDir;
}

export function main({ target, scriptedAnswers = {}, incomingFiles = {}, options = {} } = {}) {
  const pf = preflight({ target, allowRoot: options.allowRoot === true, nodeVersion: options.nodeVersion });
  const inv = inventory(pf.target);
  const bk = backup(pf.target, { backupRoot: options.backupRoot, injectFailure: options.injectFailure === true });
  requireVerifiedBackup(bk);
  const answers = collectAnswers(pf.target, scriptedAnswers);
  const generated = JSON.stringify(generateConfig(answers), null, 2);
  const withGenerated = { ...incomingFiles, 'harness.config.json': generated };
  const plan = planMerge(pf.target, withGenerated);
  const dryRun = options.dryRun === true;
  const result = applyMerge(pf.target, plan, { incomingFiles: withGenerated, dryRun });
  const written = result.written || [];
  const installed = written
    .filter((w) => w.strategy === 'create' || w.strategy === 'generate-overwrite')
    .map((w) => ({ path: w.path, kind: 'file' }));
  const merged = written
    .filter((w) => w.strategy === 'merge')
    .map((w) => ({ path: w.path, strategy: 'merge', backupRef: bk.backupDir, preMergeSha256: w.preMergeSha256 }));
  const fileContents = {};
  for (const w of written) {
    try {
      fileContents[w.path] = fs.readFileSync(path.join(pf.target, w.path), 'utf8');
    } catch { /* noop: arquivo listado mas ilegivel nao entra no hash */ }
  }
  const manifest = buildManifest({
    target: pf.target,
    backupDir: bk.backupDir,
    installed,
    merged,
    flagged: result.flagged || [],
    answers,
    checks: { passed: true, failed: [] },
    fileContents,
    source: `harness@${VERSION}`,
  });
  let manifestRef = { skipped: true, path: null };
  let checks = { passed: true, failed: [] };
  if (!dryRun) {
    manifestRef = writeManifest(pf.target, manifest);
    checks = runChecks(pf.target, { manifest });
    manifest.checks = checks;
    fs.writeFileSync(path.join(pf.target, MANIFEST_NAME), JSON.stringify(manifest, null, 2));
  }
  return { target: pf.target, inventory: inv, backup: bk, answers: serializeAnswers(answers), plan, result, manifest, manifestRef, checks, dryRun };
}

// ---------- CLI minimo ----------

export function parseArgs(argv) {
  const out = { target: null, allowRoot: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target') out.target = argv[++i];
    else if (argv[i] === '--allow-root') out.allowRoot = true;
    else if (argv[i] === '--dry-run') out.dryRun = true;
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  try {
    const pf = preflight({ target: args.target || process.cwd(), allowRoot: args.allowRoot });
    console.log(JSON.stringify({ ok: true, target: pf.target, dryRun: args.dryRun }));
  } catch (e) {
    console.error(`abort: ${e.message}`);
    process.exit(1);
  }
}
