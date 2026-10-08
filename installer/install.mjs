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
  { key: 'stack', prompt: 'Stack do destino? (flutter/dart/node/java+vue/outra)', kind: 'stack' },
  { key: 'suiteCommand', prompt: 'Comando da suite de testes?', kind: 'command' },
  { key: 'pluginsDir', prompt: 'Diretorio de plugins no destino?', kind: 'path' },
  { key: 'deployToken', prompt: 'Token de deploy (sensivel, opcional)?', kind: 'string', secret: true },
];

// ---------- perfis de stack (ADR-008) ----------
// Registry puro: UNICA fonte das capacidades por stack (backend/frontend,
// commands, mcp, moduleMap) + `stacks` (skills que o perfil aceita, A4).
// generateConfig resolve por lookup e permanece puro (zero I/O). Leitura do
// real (pubspec.yaml, PATH) vive em validateAnswer, nunca aqui.
// As strings de backend/frontend dos perfis nao-mobile sao congeladas para
// manter a saida byte-identica ao baseline (invariante I7 / golden).
export const STACK_PROFILES = {
  'node-esm': {
    backend: 'N/A — no Java/Maven backend declared by destination Q&A; Node-only stack',
    frontend: 'N/A — no Vue/Vite frontend declared by destination Q&A; Node-only stack',
    commands: { suiteFull: 'node --test', unit: 'node --test' },
    mcp: ['chrome-devtools'],
    moduleMap: {},
    stacks: [],
  },
  node: {
    backend: 'N/A — no Java/Maven backend declared by destination Q&A; Node-only stack',
    frontend: 'N/A — no Vue/Vite frontend declared by destination Q&A; Node-only stack',
    commands: { suiteFull: 'node --test', unit: 'node --test' },
    mcp: ['chrome-devtools'],
    moduleMap: {},
    stacks: [],
  },
  'java+vue': {
    backend: 'java+vue backend (declared via Q&A)',
    frontend: 'java+vue frontend (declared via Q&A)',
    commands: {},
    mcp: ['chrome-devtools'],
    moduleMap: {},
    stacks: [],
  },
  outra: {
    backend: 'outra backend (declared via Q&A)',
    frontend: 'outra frontend (declared via Q&A)',
    commands: {},
    mcp: ['chrome-devtools'],
    moduleMap: {},
    stacks: [],
  },
  flutter: {
    backend: 'flutter/dart mobile (Q&A)',
    frontend: 'flutter/dart mobile (Q&A)',
    commands: { suiteFull: 'flutter test', unit: 'flutter test', analyze: 'dart analyze' },
    mcp: ['marionette_mcp', 'dart'],
    moduleMap: { lib: 'lib', test: 'test' },
    stacks: ['flutter', 'dart'],
  },
  dart: {
    backend: 'dart package (Q&A)',
    frontend: 'dart package (Q&A)',
    commands: { suiteFull: 'dart test', unit: 'dart test', analyze: 'dart analyze' },
    mcp: ['dart'],
    moduleMap: { lib: 'lib', test: 'test' },
    stacks: ['dart'],
  },
};

export function profileOf(stack) {
  return STACK_PROFILES[stack] || null;
}

const STACK_VALUES = ['node', 'java+vue', 'outra', 'node-esm', 'flutter', 'dart'];

function commandResolves(cmd) {
  if (!cmd || typeof cmd !== 'string') return false;
  const bin = cmd.trim().split(/\s+/)[0];
  if (!bin) return false;
  if (bin.includes('/') || bin.includes(path.sep)) return fs.existsSync(path.resolve(bin));
  const pathEnv = (process.env.PATH || '').split(path.delimiter);
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE').split(';') : [''];
  return pathEnv.some((d) => exts.some((e) => { try { return fs.existsSync(path.join(d, bin + e)); } catch { return false; } }));
}

// Discriminador flutter vs dart (ADR-005): pubspec declara `sdk: flutter`
// (dep flutter do SDK) ou uma dep/plugin `flutter:`. Barato, line-based,
// sem parser YAML (G3).
export function pubspecDeclaresFlutter(text) {
  for (const raw of String(text).split('\n')) {
    const line = raw.replace(/#.*$/, '');
    if (/^\s*sdk:\s*flutter\s*$/.test(line)) return true;
    if (/^\s*flutter:\s*$/.test(line)) return true;
  }
  return false;
}

export function validateAnswer(target, key, value) {
  const q = QUESTIONS.find((x) => x.key === key);
  if (!q) throw new InstallError(`unknown question: ${key}`, 'BAD_ANSWER');
  const t = path.resolve(target);
  switch (q.kind) {
    case 'name':
      if (!value || String(value).trim() === '') throw new InstallError('project must be non-empty', 'BAD_ANSWER');
      return String(value).trim();
    case 'stack': {
      const v = String(value);
      if (!STACK_VALUES.includes(v)) {
        throw new InstallError('stack must be one of node|java+vue|outra|node-esm|flutter|dart', 'BAD_ANSWER');
      }
      if (v === 'flutter' || v === 'dart') {
        const pub = path.join(t, 'pubspec.yaml');
        if (!fs.existsSync(pub)) {
          throw new InstallError(`stack ${v} requires pubspec.yaml in target (ADR-005)`, 'BAD_ANSWER');
        }
        let text;
        try {
          text = fs.readFileSync(pub, 'utf8');
        } catch {
          throw new InstallError(`pubspec.yaml ilegivel no target: ${v} (ADR-005)`, 'BAD_ANSWER');
        }
        const declaresFlutter = pubspecDeclaresFlutter(text);
        if (v === 'flutter' && !declaresFlutter) {
          throw new InstallError('pubspec.yaml sem "sdk: flutter": stack flutter exige projeto Flutter', 'BAD_ANSWER');
        }
        if (v === 'dart' && declaresFlutter) {
          throw new InstallError('pubspec.yaml declara flutter: use stack "flutter"', 'BAD_ANSWER');
        }
      }
      return v;
    }
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
  const profile = profileOf(stack);
  const defaultSuite = (profile && profile.commands && profile.commands.suiteFull) || 'node --test';
  const suiteFull = answers.suiteCommand || defaultSuite;
  const commands = { suiteFull, unit: suiteFull };
  if (profile && profile.commands && profile.commands.analyze) commands.analyze = profile.commands.analyze;
  return {
    version: 1,
    project: answers.project,
    stack: {
      backend: profile ? profile.backend : `${stack} backend (declared via Q&A)`,
      frontend: profile ? profile.frontend : `${stack} frontend (declared via Q&A)`,
    },
    moduleMap: {
      plugins: '.opencode/plugins',
      rules: '.agents/rules',
      schemas: '.agents/schemas',
      ...(profile ? profile.moduleMap : {}),
    },
    commands,
    infra: { composeFile: null, ports: { backend: null, frontend: null } },
    mcp: { required: [...(profile ? profile.mcp : ['chrome-devtools'])] },
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
  let conflict = false;
  const plugins = new Set([...(existing?.plugin || []), ...(incoming?.plugin || [])]);
  merged.plugin = [...plugins];
  const instr = [...(existing?.instructions || [])];
  for (const i of incoming?.instructions || []) if (!instr.includes(i)) instr.push(i);
  if (instr.length) merged.instructions = instr;
  // mcp: only-add (A3/RF-16). Host ausente => adota incoming; presente =>
  // preserva host, une `required`, divergencia => flag (nunca remove server).
  if (incoming && incoming.mcp !== undefined) {
    if (merged.mcp === undefined) {
      merged.mcp = incoming.mcp;
    } else {
      const hostReq = Array.isArray(merged.mcp && merged.mcp.required) ? merged.mcp.required : [];
      const incReq = Array.isArray(incoming.mcp && incoming.mcp.required) ? incoming.mcp.required : [];
      const union = [...hostReq];
      for (const r of incReq) if (!union.includes(r)) union.push(r);
      if (JSON.stringify(sortDeep(merged.mcp)) !== JSON.stringify(sortDeep(incoming.mcp))) conflict = true;
      merged.mcp = { ...merged.mcp, required: union };
    }
  }
  for (const [k, v] of Object.entries(incoming || {})) {
    if (k === 'plugin' || k === 'instructions' || k === 'permission' || k === 'agent' || k === 'mcp') continue;
    if (merged[k] === undefined) merged[k] = v;
  }
  // permission/agent so-adiciona: preserva destino, flag se divergir.
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

// Denylist de literais sabidamente-estranhos: marcadores de stack de OUTRO
// projeto que denunciam copia verbatim (caso Hive). O scan (FU-32) e um
// SUBSTRING simples e amplo (case-insensitive) RESTRITO a arquivos de
// CODIGO/CONFIG: prosa (.md/.txt) e binarios nunca sao escaneados, entao a
// mera MENCAO em rules/skills do harness — que citam taskflow/vuetify/primevue/
// lombok/mapstruct/restassured para PROIBI-LOS — instala em destino limpo sem
// falso-positivo. Ja a adocao REAL em codigo reprova: `require('vuetify/lib')`,
// `new Vuetify()`, `Vue.use(Vuetify)`, dependencia em package.json/pom.xml/
// build.gradle etc.
export const DENYLIST = [
  'taskflow',
  'vuetify',
  'primevue',
  'lombok',
  'mapstruct',
  'restassured',
];

// Escopo do scan (FU-32): SO arquivos de CODIGO/CONFIG. Extensoes de prosa
// (.md/.txt) e binarios ficam fora — por isso a proibicao legítima nas rules/
// skills do harness nao gera falso-positivo, enquanto a copia verbatim de
// codigo de outro projeto segue reprovando.
const SCAN_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.vue', '.svelte',
  '.java', '.kt', '.kts', '.gradle', '.groovy', '.dart', '.cs',
  '.py', '.rb', '.go', '.rs', '.php',
  '.xml', '.json', '.yaml', '.yml', '.toml', '.properties', '.lock',
]);

const SCAN_BASENAMES = new Set(['pubspec.yaml', 'package.json', 'pom.xml', 'build.gradle', 'build.gradle.kts']);

// Tooling/testes do proprio harness: nomeiam os padroes como dado de teste.
// Nunca sao conteudo instalado util; o canario mira o CONTEUDO INSTALADO do
// destino, nao a tooling/testes de quem instala.
function isToolingPath(rel) {
  const norm = rel.replace(/\\/g, '/');
  return norm.startsWith('scripts/') || norm.includes('/scripts/')
    || norm.startsWith('__tests__/') || norm.includes('/__tests__/');
}

export function isScannablePath(rel) {
  if (typeof rel !== 'string' || rel === '') return false;
  const norm = rel.replace(/\\/g, '/');
  if (isToolingPath(norm)) return false;
  const base = norm.slice(norm.lastIndexOf('/') + 1).toLowerCase();
  if (SCAN_BASENAMES.has(base)) return true;
  const dot = base.lastIndexOf('.');
  return dot >= 0 && SCAN_EXTENSIONS.has(base.slice(dot));
}

// Substring simples e amplo, case-insensitive (FU-32). Sem maquinaria
// contextual: o escopo (isScannablePath) e quem separa codigo de prosa.
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
    if (!isScannablePath(f.path)) continue;
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
  return { target: pf.target, inventory: inv, backup: bk, answers: serializeAnswers(answers), profile: answers.stack, plan, result, manifest, manifestRef, checks, dryRun };
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
export const VENDOR_LOCK_NAME = '.vendor-lock.json';

function readVendorLock(src) {
  const p = path.join(src, '.agents', 'skills', VENDOR_LOCK_NAME);
  if (!fs.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

// Skill aceita pelo destino (ADR-009): skill sem `stacks` (comum) sempre entra;
// skill com `stacks` entra so se intersecta os stacks pedidos; sem entrada no
// lock => tratada como comum. Sem lock => nada filtrado (retrocompat).
function skillAllowedForStacks(rel, lock, wanted) {
  if (!lock || !lock.skills) return true;
  const prefix = '.agents/skills/';
  if (!rel.startsWith(prefix)) return true;
  const rest = rel.slice(prefix.length);
  const name = rest.split('/')[0];
  if (!name) return true;
  const entry = lock.skills[name];
  if (!entry) return true;
  const stacks = Array.isArray(entry.stacks) ? entry.stacks : [];
  if (stacks.length === 0) return true;
  return stacks.some((s) => wanted.has(s));
}

export function collectIncoming(sourceDir, { stacks } = {}) {
  const src = path.resolve(sourceDir);
  const incoming = {};
  const lock = readVendorLock(src);
  const wanted = new Set(Array.isArray(stacks) ? stacks : []);
  const excluded = (rel) =>
    rel.split(path.sep).some((seg) => INCOMING_EXCLUDE.has(seg))
    || path.basename(rel) === MANIFEST_NAME
    || path.basename(rel) === VENDOR_LOCK_NAME;
  const walk = (abs, rel) => {
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(abs)) walk(path.join(abs, e), rel ? `${rel}/${e}` : e);
    } else if (st.isFile()) {
      if (!excluded(rel) && skillAllowedForStacks(rel, lock, wanted)) incoming[rel] = fs.readFileSync(abs, 'utf8');
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
// `terminal` (G6): true SO em TTY real (edicao de linha + historico vazio);
// pipe/redirect/--answers-file permanecem em terminal:false (retrocompat).
function createLineReader({ input, output, terminal = false }) {
  const nullOut = new Writable({ write(_c, _e, cb) { cb(); } });
  const rl = readline.createInterface({
    input,
    output: output || nullOut,
    terminal: terminal === true,
    ...(terminal === true ? { historySize: 0 } : {}),
  });
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

export function confirmByLayer(plan, { input, output, yes = false, reader } = {}) {
  const layers = [...new Set(plan.filter((p) => p.action !== 'noop').map((p) => p.layer))];
  if (layers.length === 0) return { approved: [], denied: [] };
  if (yes) return { approved: layers, denied: [] };
  // `reader` (opcional): o wizard compartilha seu proprio leitor de stdin
  // (nenhum gate duplicado, nenhuma linha perdida ao trocar de interface).
  const owns = !reader;
  const r = reader || createLineReader({ input, output });
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
    if (owns) r.close();
    if (denied.length > 0) {
      throw new InstallError(`camadas recusadas (${denied.join(', ')}): abortando sem escrever nada.`, 'USER_ABORT');
    }
    return { approved, denied };
  })().catch((e) => {
    if (owns) r.close();
    throw e;
  });
}

// ---------- wizard B2 (ADR-010/RF-15/I11) ----------
// Camada de APRESENTACAO: W0..W7. NUNCA escreve e NUNCA chama generateConfig.
// Reusa os portoes existentes (validateAnswer/printPlan/confirmByLayer); a
// aplicacao (W6/W7) e DELEGADA via `apply`, jamais feita aqui. Streams
// injetados (mesma tecnica de promptAnswers): zero dependencia de TTY real.

const ABORT_TOKENS = new Set(['q', 'quit', 'cancel', 'cancelar', 'abort', 'abortar']);

const WIZARD_MENU = [
  { key: '1', stack: 'flutter' },
  { key: '2', stack: 'dart' },
  { key: '3', stack: 'node' },
  { key: '4', stack: 'outra' },
];

function isAbortToken(s) {
  return ABORT_TOKENS.has(String(s).trim().toLowerCase());
}

// W2: deteccao line-based do pubspec.yaml (sem lib YAML, G3). Sugere
// flutter/dart SEMPRE confirmavel; sem pubspec => suggestedStack null
// (menu manual no W2m). Registra a origem como (arquivo:linha).
export function detect(target) {
  const t = path.resolve(target);
  const file = 'pubspec.yaml';
  const pubPath = path.join(t, file);
  const result = {
    hasPubspec: fs.existsSync(pubPath),
    name: null,
    sdk: null,
    declaresFlutter: false,
    suggestedStack: null,
    sources: [],
    warnings: [],
  };
  if (!result.hasPubspec) return result;
  let text;
  try {
    text = fs.readFileSync(pubPath, 'utf8');
  } catch {
    result.warnings.push(`${file}: ilegivel`);
    return result;
  }
  let inEnvironment = false;
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '');
    const nameMatch = line.match(/^name:\s*(.+?)\s*$/);
    if (nameMatch && result.name === null) {
      result.name = nameMatch[1].replace(/^["']|["']$/g, '');
      result.sources.push({ field: 'project', file, line: i + 1 });
    }
    if (/^environment:\s*$/.test(line)) { inEnvironment = true; return; }
    if (/^\S/.test(line) && line.trim() !== '') inEnvironment = false;
    if (inEnvironment) {
      const sdkMatch = line.match(/^\s+sdk:\s*(.+?)\s*$/);
      if (sdkMatch) {
        result.sdk = sdkMatch[1].replace(/^["']|["']$/g, '');
        result.sources.push({ field: 'environment.sdk', file, line: i + 1 });
        inEnvironment = false;
      }
    }
    if (/^\s*flutter:\s*$/.test(line) || /^\s*sdk:\s*flutter\s*$/.test(line)) {
      result.sources.push({ field: 'stack', file, line: i + 1 });
      result.declaresFlutter = true;
    }
  });
  // Discriminador autoritativo reusado do ADR-005.
  result.declaresFlutter = result.declaresFlutter || pubspecDeclaresFlutter(text);
  result.suggestedStack = result.declaresFlutter ? 'flutter' : 'dart';
  if (result.suggestedStack === 'flutter' && !commandResolves('flutter')) {
    result.warnings.push("'flutter' nao resolve no PATH (R9): confirme o comando da suite.");
  }
  return result;
}

function defaultSuiteFor(stack) {
  const candidates = stack === 'flutter'
    ? ['flutter test', 'make test', 'dart test']
    : stack === 'dart'
      ? ['dart test', 'make test']
      : stack === 'node' || stack === 'node-esm'
        ? ['node --test']
        : [];
  for (const c of candidates) if (commandResolves(c)) return c;
  return candidates.length > 0 ? candidates[0] : '';
}

function howToFix(key) {
  switch (key) {
    case 'project': return 'informe um nome nao-vazio.';
    case 'stack': return 'use flutter|dart|node|java+vue|outra; flutter/dart exigem pubspec.yaml.';
    case 'suiteCommand': return 'use um comando no PATH ou caminho de arquivo absoluto (ex: node).';
    case 'pluginsDir': return 'informe um diretorio existente DENTRO do target.';
    default: return 'revise o valor informado.';
  }
}

export async function runWizard({
  target,
  stdin,
  stdout,
  sourceDir = INSTALLER_ROOT,
  detect: detectFn = detect,
  apply = null,
  options = {},
} = {}) {
  const out = (s) => { try { stdout.write(`${s}\n`); } catch { /* stream opcional */ } };
  const interactive = Boolean(stdin && stdin.isTTY);
  // G6: edicao de linha so quando ha TTY real; pipe/redirect = terminal:false.
  const r = createLineReader({ input: stdin, output: stdout, terminal: interactive });
  const read = async (label) => {
    if (label) out(label);
    const line = await r.next();
    if (line === undefined) {
      throw new InstallError('stdin fechado (EOF) no wizard: rode interativo ou passe --answers-file. Abortando sem escrever nada.', 'NO_STDIN');
    }
    if (isAbortToken(line)) {
      throw new InstallError('cancelado pelo usuario no wizard. Abortando sem escrever nada.', 'USER_ABORT');
    }
    return line;
  };

  try {
    // W0 pre-flight (read-only; aborta sem escrever).
    const pf = preflight({ target, allowRoot: options.allowRoot === true });
    out(`[OK] W0 pre-flight: target=${pf.target} node=${process.version}`);

    // W1 inventario do destino.
    const inv = inventory(pf.target);
    out('[INFO] W1 inventario do destino:');
    for (const l of inv.layers) {
      out(`  [${l.present ? 'OK' : 'AVISO'}] ${l.layer}${l.present ? ' presente' : ' ausente'}`);
    }

    // W2 deteccao pubspec (sugestao, sempre confirmavel).
    const det = detectFn(pf.target);
    out('[INFO] W2 deteccao (pubspec.yaml):');
    if (det.hasPubspec) {
      for (const s of det.sources) out(`  [OK] ${s.field} <- ${s.file}:${s.line}`);
      out(`  [INFO] sugestao de stack: ${det.suggestedStack}`);
    } else {
      out('  [AVISO] sem pubspec.yaml — stack sera escolhida no W2m.');
    }
    for (const w of det.warnings || []) out(`  [AVISO] ${w}`);

    // W2m menu manual (apenas sem pubspec). Fora de flutter/dart = fora de escopo.
    let menuStack = null;
    if (!det.hasPubspec) {
      out('[INFO] W2m menu manual — escolha a stack:');
      for (const m of WIZARD_MENU) out(`  ${m.key}) ${m.stack}`);
      for (;;) {
        const raw = await read('> ');
        const choice = WIZARD_MENU.find((m) => m.key === raw.trim());
        if (choice) { menuStack = choice.stack; break; }
        out(`[ERRO] opcao '${raw.trim()}' invalida — digite 1, 2, 3 ou 4 (ou 'q' para cancelar).`);
      }
    }

    // W3 Q&A guiado, com default detectado e validacao por validateAnswer.
    const defaults = {
      project: det.name || '',
      stack: det.suggestedStack || menuStack || '',
      suiteCommand: defaultSuiteFor(det.suggestedStack || menuStack || ''),
      pluginsDir: pf.target,
      deployToken: '',
    };
    const answers = {};
    for (let i = 0; i < QUESTIONS.length; i++) {
      const q = QUESTIONS[i];
      // should-fix: o default de suiteCommand acompanha o stack RESPONDIDO no
      // W3, nao o detectado/menu. Se o usuario troca o stack, recalcula aqui.
      if (q.key === 'suiteCommand') {
        defaults.suiteCommand = defaultSuiteFor(answers.stack || defaults.stack);
      }
      const def = defaults[q.key] !== undefined ? defaults[q.key] : '';
      for (;;) {
        const shown = def !== '' && !q.secret ? ` (default: ${def})` : '';
        const raw = await read(`[${i + 1}/${QUESTIONS.length}] ${q.prompt}${shown}`);
        const value = raw === '' ? def : raw;
        if (q.secret && value === '') { answers[q.key] = ''; break; }
        try {
          answers[q.key] = validateAnswer(pf.target, q.key, value);
          out(`  [OK] ${q.key} = ${q.secret && answers[q.key] !== '' ? '[REDACTED]' : answers[q.key]}`);
          break;
        } catch (e) {
          out(`  [ERRO] ${q.key}: ${sanitizeLog(e.message, { [q.key]: value })}`);
          out(`  como corrigir: ${howToFix(q.key)}`);
        }
      }
    }

    // W4 resumo + previa. O plano reusa planMerge sobre o incoming filtrado;
    // harness.config.json entra como placeholder (a acao dele independe do
    // conteudo) — assim o wizard NAO chama generateConfig.
    const profile = profileOf(answers.stack);
    const stacks = profile ? profile.stacks : [answers.stack];
    const incomingFiles = collectIncoming(sourceDir, { stacks });
    const plan = planMerge(pf.target, { ...incomingFiles, 'harness.config.json': '' });
    out('[INFO] W4 resumo das respostas (segredos omitidos):');
    out(`  ${JSON.stringify(serializeAnswers(answers))}`);
    out('[INFO] W4 previa do plano (reusa printPlan):');
    printPlan(plan, { output: stdout });

    // W5 confirmacao por camada (reusa confirmByLayer, mesmo leitor/stream).
    if (options.dryRun) {
      out('[INFO] W5 dry-run: confirmacao por camada dispensada (nada sera aplicado).');
    } else {
      out('[INFO] W5 confirmacao por camada:');
      await confirmByLayer(plan, { input: stdin, output: stdout, yes: options.yes === true, reader: r });
    }

    // W6/W7: DELEGADOS. O wizard nao escreve; `apply` (CLI) aplica + manifesta.
    if (typeof apply !== 'function' || options.dryRun) {
      out(`[INFO] W6/W7 nao executados pelo wizard (apply=${typeof apply === 'function' ? 'dry-run' : 'ausente'}); nenhum write.`);
      return { answers, profile: answers.stack, plan, applied: false, detection: det, inventory: inv };
    }
    const steps = plan.filter((p) => p.action !== 'noop' && p.action !== 'flag');
    const total = steps.length;
    out('[INFO] W6 backup + aplicacao:');
    steps.forEach((s, i) => out(`  [${i + 1}/${total}] ${s.action} ${s.path}`));
    const result = await apply({ answers, profile: answers.stack, plan, target: pf.target });
    out('[INFO] W7 manifesto + checks:');
    const manifestPath = result && result.manifestRef && result.manifestRef.path ? result.manifestRef.path : '(dry-run)';
    out(`  [OK] manifesto: ${manifestPath}`);
    const checksOk = Boolean(result && result.checks && result.checks.passed);
    out(`  [${checksOk ? 'OK' : 'ERRO'}] checks: ${checksOk ? 'PASS' : `FAIL ${JSON.stringify(result && result.checks ? result.checks.failed : [])}`}`);
    return { answers, profile: answers.stack, plan, applied: true, result, detection: det, inventory: inv };
  } finally {
    r.close();
  }
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
  // TTY interativo => wizard B2 (ADR-010). --answers-file / pipe / redirect
  // seguem os caminhos v1 inalterados (retrocompat G6).
  if (!args.answersFile && stdin && stdin.isTTY) {
    const incomingOf = (stack) => {
      const profile = profileOf(stack);
      return collectIncoming(sourceDir, { stacks: profile ? profile.stacks : [stack] });
    };
    const w = await runWizard({
      target: pf.target,
      stdin,
      stdout,
      sourceDir,
      options: { allowRoot: args.allowRoot, yes: args.yes, dryRun: args.dryRun },
      apply: args.dryRun ? null : ({ answers }) => main({
        target: pf.target,
        scriptedAnswers: answers,
        incomingFiles: incomingOf(answers.stack),
        options: { allowRoot: args.allowRoot, dryRun: false, backupRoot: args.backupDir || undefined },
      }),
    });
    if (args.dryRun) {
      const out = main({
        target: pf.target,
        scriptedAnswers: w.answers,
        incomingFiles: incomingOf(w.answers.stack),
        options: { allowRoot: args.allowRoot, dryRun: true },
      });
      log(`dry-run ok: ${out.plan.length} itens no plano, zero writes.`);
      return out;
    }
    log(`instalado em ${pf.target}: ${w.result.manifestRef.path || 'sem manifesto?'}`);
    log(`checks: ${w.result.checks.passed ? 'PASS' : `FAIL ${JSON.stringify(w.result.checks.failed)}`}`);
    return w.result;
  }
  let scripted;
  if (args.answersFile) {
    scripted = collectAnswers(pf.target, loadAnswersFile(args.answersFile));
  } else {
    const kind = stdinKindOf(stdin);
    const src = resolveAnswerSource({ stdinIsTTY: Boolean(stdin && stdin.isTTY), stdinKind: kind, answersFile: null });
    if (src.mode !== 'prompt') throw new InstallError('fonte de respostas indisponivel', 'NO_STDIN');
    scripted = await promptAnswers(pf.target, { input: stdin, output: stdout });
  }
  const profile = profileOf(scripted.stack);
  const incomingFiles = collectIncoming(sourceDir, { stacks: profile ? profile.stacks : [scripted.stack] });
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
