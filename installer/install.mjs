// installer/install.mjs — harness-installer Batch 1/2 (IN-01..IN-04)
// Node ESM, zero deps. Gera-nunca-copia; backup-first; segredo so-memoria.
// Escopo: SOMENTE este arquivo + installer/__tests__/. Nunca toca outro repo;
// fixtures dos testes usam tempdir.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { Writable } from 'node:stream';

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
  const dryRun = options.dryRun === true;
  const pf = preflight({ target, allowRoot: options.allowRoot === true, nodeVersion: options.nodeVersion });
  const inv = inventory(pf.target);
  // I4: dry-run = ZERO writes — nem backup cria. Inventario + respostas +
  // geracao + plano + relatorio, tudo em memoria.
  const bk = dryRun
    ? { backupDir: null, copied: [], verified: true, skipped: true }
    : backup(pf.target, { backupRoot: options.backupRoot, injectFailure: options.injectFailure === true });
  requireVerifiedBackup(bk);
  const answers = collectAnswers(pf.target, scriptedAnswers);
  const generated = JSON.stringify(generateConfig(answers), null, 2);
  const withGenerated = { ...incomingFiles, 'harness.config.json': generated };
  const plan = planMerge(pf.target, withGenerated);
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

// ---------- CLI: incoming canonico + Q&A + plano + main ----------
// Lista canonica dos incoming: o instalador GERA o harness.config.json a
// partir do Q&A (ADR-002, nunca copia config alheio) e usa como incoming o
// conteudo versionado destas raizes do repo harness:
//   - dirs que entram: .agents/agents, .agents/rules, .agents/skills,
//     .opencode/plugins (+ o arquivo opencode.json, merge aditivo)
//   - o que exclui: segmentos node_modules e .git em qualquer nivel,
//     e o manifesto .harness-install.json (estado, nunca conteudo).
export const INCOMING_ROOTS = [
  '.agents/agents',
  '.agents/rules',
  '.agents/skills',
  '.opencode/plugins',
  'opencode.json',
];
export const INCOMING_EXCLUDE = new Set(['node_modules', '.git']);

export function collectIncoming(sourceDir) {
  const src = path.resolve(sourceDir);
  const incoming = {};
  const excluded = (rel) =>
    rel.split(path.sep).some((seg) => INCOMING_EXCLUDE.has(seg))
    || path.basename(rel) === MANIFEST_NAME;
  const walk = (abs, rel) => {
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(abs)) walk(path.join(abs, e), rel ? `${rel}/${e}` : e);
    } else if (st.isFile()) {
      if (!excluded(rel)) incoming[rel] = fs.readFileSync(abs, 'utf8');
    }
  };
  for (const root of INCOMING_ROOTS) {
    const abs = path.join(src, root);
    if (!fs.existsSync(abs)) continue;
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, root);
    else if (!excluded(root)) incoming[root] = fs.readFileSync(abs, 'utf8');
  }
  return incoming;
}

export function parseArgs(argv) {
  const out = { target: null, allowRoot: false, dryRun: false, answersFile: null, yes: false, backupDir: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target') out.target = argv[++i];
    else if (a === '--allow-root') out.allowRoot = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--answers-file') out.answersFile = argv[++i];
    else if (a === '--yes' || a === '-y') out.yes = true;
    else if (a === '--backup-dir') out.backupDir = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

export function loadAnswersFile(p) {
  let raw;
  try {
    raw = fs.readFileSync(path.resolve(p), 'utf8');
  } catch {
    throw new InstallError(`answers-file ilegivel: ${p}`, 'BAD_ANSWER');
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not-object');
    return parsed;
  } catch {
    throw new InstallError(`answers-file invalido (JSON objeto esperado): ${p}`, 'BAD_ANSWER');
  }
}

function stdinKindOf(stdin) {
  if (stdin && stdin.isTTY) return 'tty';
  try {
    const st = fs.fstatSync(stdin && typeof stdin.fd === 'number' ? stdin.fd : 0);
    if (st.isFIFO()) return 'fifo';
    if (st.isFile()) return 'file';
    if (st.isCharacterDevice()) return 'char';
  } catch { /* sem fd acessivel: trata como desconhecido */ }
  return 'unknown';
}

// Decide a fonte das respostas sem nunca travar: sem --answers-file e sem
// stdin utilizavel (tty, pipe ou redirect) => aborta com instrucao.
export function resolveAnswerSource({ stdinIsTTY = false, stdinKind = 'unknown', answersFile = null } = {}) {
  if (answersFile) return { mode: 'file' };
  if (stdinIsTTY) return { mode: 'prompt', piped: false };
  if (stdinKind === 'fifo' || stdinKind === 'file') return { mode: 'prompt', piped: true };
  throw new InstallError(
    'stdin fechado e sem --answers-file: nada a perguntar. Rode interativo ou passe --answers-file <json>. Abortando sem escrever nada.',
    'NO_STDIN',
  );
}

const EOF_ABORT = 'stdin fechado (EOF) antes de concluir o Q&A: passe --answers-file <json>. Abortando sem escrever nada.';

// Leitor de linhas sem corrida com EOF: enfileira 'line' e resolve
// pendencias no 'close' (undefined = EOF). Serve tty, pipe e redirect.
function createLineReader({ input, output }) {
  const nullOut = new Writable({ write(_c, _e, cb) { cb(); } });
  const rl = readline.createInterface({ input, output: output || nullOut, terminal: false });
  const queue = [];
  const waiters = [];
  rl.on('line', (l) => {
    if (waiters.length > 0) waiters.shift()(l);
    else queue.push(l);
  });
  rl.on('close', () => {
    while (waiters.length > 0) waiters.shift()(undefined);
  });
  return {
    next() {
      if (queue.length > 0) return Promise.resolve(queue.shift());
      if (!input || input.readableEnded || input.destroyed) return Promise.resolve(undefined);
      return new Promise((res) => waiters.push(res));
    },
    say(s) {
      try {
        if (output && typeof output.write === 'function') output.write(`${s}\n`);
      } catch { /* output opcional: nunca quebra o prompt */ }
    },
    close() { try { rl.close(); } catch { /* ja fechado */ } },
  };
}

export function promptAnswers(target, { input, output } = {}) {
  const r = createLineReader({ input, output });
  const askOne = async (q) => {
    r.say(`${q.prompt} `);
    const line = await r.next();
    if (line === undefined) throw new InstallError(EOF_ABORT, 'NO_STDIN');
    return line;
  };
  return (async () => {
    const answers = {};
    for (const q of QUESTIONS) {
      for (;;) {
        const raw = await askOne(q);
        const value = raw === '' && q.secret ? '' : raw;
        try {
          if (q.secret && value === '') { answers[q.key] = ''; break; }
          answers[q.key] = validateAnswer(target, q.key, value);
          break;
        } catch (e) {
          r.say(`resposta invalida para '${q.key}': ${sanitizeLog(e.message, { [q.key]: raw })} — tente de novo.`);
        }
      }
    }
    r.close();
    return answers;
  })().catch((e) => {
    r.close();
    throw e;
  });
}

export function printPlan(plan, { output = process.stdout } = {}) {
  const write = (s) => output.write(`${s}\n`);
  const counts = {};
  for (const p of plan) counts[p.action] = (counts[p.action] || 0) + 1;
  write('plano de instalacao:');
  for (const p of plan) {
    const extra = p.reason ? ` — ${p.reason}` : '';
    write(`  ${p.action}  ${p.path}${extra}`);
  }
  const summary = Object.entries(counts).map(([a, n]) => `${a}=${n}`).join(' ');
  write(`resumo: ${plan.length} itens (${summary || 'vazio'})`);
  write('classes: create (novo), merge (aditivo), flag (humano resolve)');
  return { counts, total: plan.length };
}

export function confirmByLayer(plan, { input, output, yes = false } = {}) {
  const layers = [...new Set(plan.filter((p) => p.action !== 'noop').map((p) => p.layer))];
  if (layers.length === 0) return { approved: [], denied: [] };
  if (yes) return { approved: layers, denied: [] };
  const r = createLineReader({ input, output });
  const denyMsg = (layer) => `stdin fechado na confirmacao da camada '${layer}': passe --yes ou rode interativo. Abortando sem escrever nada.`;
  return (async () => {
    const approved = [];
    const denied = [];
    for (const layer of layers) {
      const n = plan.filter((p) => p.layer === layer && p.action !== 'noop').length;
      r.say(`Aplicar camada '${layer}' (${n} acoes)? [s/N] `);
      const raw = await r.next();
      if (raw === undefined) throw new InstallError(denyMsg(layer), 'NO_STDIN');
      if (/^(s|sim|y|yes)$/i.test(String(raw).trim())) approved.push(layer);
      else denied.push(layer);
    }
    r.close();
    if (denied.length > 0) {
      throw new InstallError(`camadas recusadas (${denied.join(', ')}): abortando sem escrever nada.`, 'USER_ABORT');
    }
    return { approved, denied };
  })().catch((e) => {
    r.close();
    throw e;
  });
}

export function printUsage({ output = process.stdout } = {}) {
  output.write(`uso: node installer/install.mjs --target <dir> [--dry-run] [--answers-file <json>] [--yes] [--backup-dir <dir>] [--allow-root]\n`);
  output.write(`  sem --answers-file exige stdin interativo ou pipado; stdin fechado aborta sem escrever.\n`);
  output.write(`  --dry-run: zero writes (nem backup cria); imprime plano + relatorio.\n`);
}

const INSTALLER_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export async function runCli({ argv = [], stdin = process.stdin, stdout = process.stdout, stderr = process.stderr, sourceDir = INSTALLER_ROOT } = {}) {
  const args = parseArgs(argv);
  if (args.help || !args.target) {
    printUsage({ output: stdout });
    if (!args.target) throw new InstallError('missing --target', 'BAD_TARGET');
    return { help: true };
  }
  const err = (s) => stderr.write(`${s}\n`);
  const log = (s) => stdout.write(`${sanitizeLog(s)}\n`);
  const pf = preflight({ target: args.target, allowRoot: args.allowRoot });
  let scripted;
  if (args.answersFile) {
    scripted = collectAnswers(pf.target, loadAnswersFile(args.answersFile));
  } else {
    const kind = stdinKindOf(stdin);
    const src = resolveAnswerSource({ stdinIsTTY: Boolean(stdin && stdin.isTTY), stdinKind: kind, answersFile: null });
    if (src.mode !== 'prompt') throw new InstallError('fonte de respostas indisponivel', 'NO_STDIN');
    scripted = await promptAnswers(pf.target, { input: stdin, output: stdout });
  }
  const incomingFiles = collectIncoming(sourceDir);
  const generated = JSON.stringify(generateConfig(scripted), null, 2);
  const preview = planMerge(pf.target, { ...incomingFiles, 'harness.config.json': generated });
  printPlan(preview, { output: stdout });
  if (!args.dryRun) {
    await confirmByLayer(preview, { input: stdin, output: stdout, yes: args.yes });
  } else {
    log('dry-run: confirmacao por camada dispensada (nada sera aplicado).');
  }
  const out = main({
    target: pf.target,
    scriptedAnswers: scripted,
    incomingFiles,
    options: { allowRoot: args.allowRoot, dryRun: args.dryRun, backupRoot: args.backupDir || undefined },
  });
  if (args.dryRun) {
    log(`dry-run ok: ${out.plan.length} itens no plano, zero writes.`);
  } else {
    log(`instalado em ${out.target}: ${out.manifestRef.path || 'sem manifesto?'}`);
    log(`checks: ${out.checks.passed ? 'PASS' : `FAIL ${JSON.stringify(out.checks.failed)}`}`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = parseArgs(process.argv.slice(2));
  if (!a.target && (a.help || process.argv.length <= 2)) {
    printUsage({});
    process.exit(a.help ? 0 : 1);
  }
  runCli({ argv: process.argv.slice(2) }).then(
    () => process.exit(0),
    (e) => {
      const safe = e && e.code === 'NO_STDIN' ? String(e.message) : `abort: ${e && e.message ? e.message : e}`;
      process.stderr.write(`${safe}\n`);
      process.exit(1);
    },
  );
}
