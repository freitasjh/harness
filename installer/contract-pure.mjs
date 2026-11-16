// 29 D-PURE — copiados byte-fiel do oráculo congelado c63e333 (worktree detach,
// SHA c63e33307710e1c6271f5c68b2dd9fb15283f49c). Nenhuma linha reexporta
// o módulo vivo: fronteira de transição D1-two-motors, quitação parcial.
// Sem subprocesso, sem escrita, sem FFI. Constantes/helpers privados vêm da
// mesma fonte congelada; dados vêm de contract-registry.mjs (já congelado).

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { danglingSymlinkInPath, insideDir, realOrResolved, tmpRealRoot } from './zone.mjs'
import {
  AXIS_IDS, DENYLIST, QUESTIONS, RULES_BY_AXIS, SKILLS_BY_AXIS,
  STACK_PROFILES, STACK_VALUES, STACKS_FOR_EXCEPTIONS,
} from './contract-registry.mjs'

const ESC = String.fromCharCode(27);
const CSI_RE = new RegExp(`${ESC}\\[[0-9;?]*[A-Za-z]`, 'g');
const CHARSET_RE = new RegExp(`${ESC}[()][0-9A-B]`, 'g');

const SCAN_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.vue', '.svelte',
  '.java', '.kt', '.kts', '.gradle', '.groovy', '.dart', '.cs',
  '.py', '.rb', '.go', '.rs', '.php',
  '.xml', '.json', '.yaml', '.yml', '.toml', '.properties', '.lock',
  '.html', '.css', '.sh',
]);

// Arquivos sem extensao cobertos pelo scan (FU-33).

const SCAN_NAMES = new Set(['dockerfile']);

const HARNESS_OWNED_MODULEMAP_KEYS = ['plugins', 'rules', 'schemas'];

const ERROR_CODES = new Set([
  'BAD_ANSWER', 'CORRUPT', 'NO_STDIN', 'USER_ABORT', 'BACKUP_FAIL',
  'BACKUP_UNVERIFIED', 'BAD_TARGET', 'NODE_MIN', 'UID_ROOT', 'REINSTALL',
  'FOREIGN_MANIFEST', 'OUTSIDE_TARGET', 'DOGFOOD_GUARD', 'MISSING_INCOMING',
  'SECRET_TTY', 'manifest-missing', 'config-missing', 'json-invalid',
  'flagged-open', 'literal-denied', 'config-ref-missing', 'plugin-parse',
]);

const ABORT_TOKENS = new Set(['q', 'quit', 'cancel', 'cancelar', 'abort', 'abortar']);

function validateAxisExclusionMap(label, map) {
  for (const [key, artifacts] of Object.entries(map)) {
    const eq = key.indexOf('=');
    const axis = eq < 0 ? null : key.slice(0, eq);
    const id = eq < 0 ? null : key.slice(eq + 1);
    if (!axis || !id) {
      throw new InstallError(`${label}: chave invalida '${key}' (esperado '<eixo>=<id>')`, 'BAD_DECLARATION');
    }
    if (!Object.prototype.hasOwnProperty.call(AXIS_IDS, axis)) {
      throw new InstallError(`${label}: eixo desconhecido '${axis}' em '${key}' (AXIS_IDS: ${Object.keys(AXIS_IDS).join(', ')})`, 'BAD_DECLARATION');
    }
    if (!AXIS_IDS[axis].includes(id)) {
      throw new InstallError(`${label}: id '${id}' fora de AXIS_IDS.${axis} em '${key}'`, 'BAD_DECLARATION');
    }
    if (!Array.isArray(artifacts) || artifacts.length === 0 || artifacts.some((a) => typeof a !== 'string' || a === '')) {
      throw new InstallError(`${label}: valor de '${key}' tem de ser array de strings nao-vazias`, 'BAD_DECLARATION');
    }
  }
}

function commandResolves(cmd) {
  if (!cmd || typeof cmd !== 'string') return false;
  const bin = cmd.trim().split(/\s+/)[0];
  if (!bin) return false;
  if (bin.includes('/') || bin.includes(path.sep)) return fs.existsSync(path.resolve(bin));
  const pathEnv = (process.env.PATH || '').split(path.delimiter);
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE').split(';') : [''];
  return pathEnv.some((d) => exts.some((e) => { try { return fs.existsSync(path.join(d, bin + e)); } catch { return false; } }));
}

function pubspecDeclaresFlutter(text) {
  for (const raw of String(text).split('\n')) {
    const line = raw.replace(/#.*$/, '');
    if (/^\s*sdk:\s*flutter\s*$/.test(line)) return true;
    if (/^\s*flutter:\s*$/.test(line)) return true;
  }
  return false;
}

function howToFix(key) {
  switch (key) {
    case 'project': return 'informe um nome nao-vazio.';
    case 'stack': return `use ${STACK_VALUES.join('|')}; flutter/dart exigem pubspec.yaml.`;
    case 'suiteCommand': return 'use um comando no PATH ou caminho de arquivo absoluto (ex: node).';
    case 'pluginsDir': return 'informe um diretorio existente DENTRO do target.';
    default: return 'revise o valor informado.';
  }
}

function isToolingPath(rel) {
  const norm = rel.replace(/\\/g, '/');
  return norm.startsWith('scripts/') || norm.includes('/scripts/')
    || norm.startsWith('__tests__/') || norm.includes('/__tests__/');
}

function isDisplayControl(ch) {
  const c = ch.codePointAt(0);
  return c === 27 || (c >= 0 && c <= 8) || (c >= 11 && c <= 13) || (c >= 14 && c <= 31) || c === 127;
}

export class InstallError extends Error {
  constructor(message, code = 'INSTALL_ABORT') {
    super(message);
    this.name = 'InstallError';
    this.code = code;
  }
}

export function assertCreateOnly(plan) {
  const items = Array.isArray(plan) ? plan : [];
  const offenders = items.filter((p) => p && (p.action === 'merge' || p.action === 'flag'));
  if (offenders.length === 0) return { ok: true, total: items.length };
  const kinds = [...new Set(offenders.map((p) => p.action))].join('|');
  throw new InstallError(
    `target nao-limpo: ${offenders.length} item(ns) ${kinds} — rode doctor / limpe o destino (create-only).`,
    'flagged-open',
  );
}

export function assertDogfoodTarget(target, { explicit = false, confirmed = false } = {}) {
  const r = path.resolve(target);
  const tmp = path.resolve(os.tmpdir());
  if (!(r === tmp || r.startsWith(tmp + path.sep))) {
    if (explicit && confirmed) return r;
    throw new InstallError(
      `refusing target outside /tmp without explicit --target + confirmation: ${r} (R5/Y4)`,
      'DOGFOOD_GUARD',
    );
  }
  const real = realOrResolved(r);
  const tmpReal = tmpRealRoot();
  if (!tmpReal || !insideDir(real, tmpReal)) {
    throw new InstallError(
      `alvo ${r} resolve para fora da zona autorizada: ${real} (tmp real: ${tmpReal || 'desconhecido'})`
      + ' — recusado antes de qualquer escrita: um atalho no caminho atravessa o /tmp (R5/Y4/FU-42)',
      'OUTSIDE_TARGET',
    );
  }
  const dangling = danglingSymlinkInPath(r);
  if (dangling) {
    throw new InstallError(
      `alvo ${r} tem atalho pendurado no caminho: ${dangling} — destino nao resolve,`
      + ' recusado antes de qualquer escrita (R5/Y4/FU-42)',
      'OUTSIDE_TARGET',
    );
  }
  return r;
}

export function assertInside(target, p) {
  const t = path.resolve(target);
  const r = path.resolve(p);
  if (r !== t && !r.startsWith(t + path.sep)) {
    throw new InstallError(`write outside target: ${p}`, 'OUTSIDE_TARGET');
  }
  return r;
}

export function axisIdsFromAxes(axes) {
  const keys = new Set();
  if (axes && typeof axes === 'object') {
    for (const axis of Object.keys(AXIS_IDS)) {
      const id = axes[axis];
      if (typeof id === 'string' && id) keys.add(`${axis}=${id}`);
    }
  }
  return keys;
}

export function canNoEcho(input) {
  return Boolean(input && input.isTTY && typeof input.setRawMode === 'function');
}

export function configReferenceTargets(config) {
  const refs = [];
  if (config && typeof config === 'object') {
    const schema = config.evidence && config.evidence.schema;
    if (typeof schema === 'string') refs.push({ label: 'evidence.schema', path: schema });
    const map = config.moduleMap;
    if (map && typeof map === 'object') {
      for (const k of HARNESS_OWNED_MODULEMAP_KEYS) {
        const v = map[k];
        if (typeof v === 'string') refs.push({ label: `moduleMap.${k}`, path: v });
      }
    }
  }
  return refs.filter((r) => r.path.length > 0 && !r.path.includes('*'));
}

export function defaultSuiteFor(stackOrAxes) {
  let stack = stackOrAxes;
  if (stackOrAxes && typeof stackOrAxes === 'object') {
    stack = presetOfAxes(stackOrAxes.backend, stackOrAxes.frontend) || stackOrAxes.stack || '';
  }
  stack = stack || '';
  const profile = profileOf(stack);
  const frontendAxis = profile ? profile.axes.frontend : null;
  const web = frontendAxis === 'vue' || frontendAxis === 'react';
  const candidates = stack === 'flutter'
    ? ['flutter test', 'make test', 'dart test']
    : stack === 'dart'
      ? ['dart test', 'make test']
      : stack === 'node' || stack === 'node-esm'
        ? ['node --test']
        : web
          ? ['npm run test:run', 'npm test']
          : [];
  for (const c of candidates) if (commandResolves(c)) return c;
  return candidates.length > 0 ? candidates[0] : '';
}

export function dryRunNotice() {
  return '[INFO] dry-run: NÃO EXECUTADO — nenhum write (plano + relatório apenas)';
}

export function formatError({ what, code, why, fix, where } = {}, answers = {}) {
  const known = ERROR_CODES.has(code) ? code : 'UNKNOWN';
  const oneLine = (v) => stripAnsiControls(String(v ?? '')).replace(/\s*\n\s*/g, ' ').trim();
  const lines = [
    `[ERRO] ${oneLine(what) || 'erro no instalador'}`,
    `  porquê: ${known}${why ? `: ${oneLine(why)}` : ''}`,
    `  como corrigir: ${oneLine(fix ?? howToFix('')) || 'revise o valor informado.'}`,
    `  onde ver: ${oneLine(where) || 'installer/install.mjs'}`,
  ];
  return sanitizeLog(lines.join('\n'), answers);
}

export function hasHarnessSection(content) {
  const lines = String(content).split('\n');
  return lines.some((l) => normalizeSection(l) === normalizeSection('## Harness v7'));
}

export function isAbortToken(s) {
  return ABORT_TOKENS.has(String(s).trim().toLowerCase());
}

export function isScannablePath(rel) {
  if (typeof rel !== 'string' || rel === '') return false;
  const norm = rel.replace(/\\/g, '/');
  if (isToolingPath(norm)) return false;
  const base = norm.slice(norm.lastIndexOf('/') + 1).toLowerCase();
  if (SCAN_NAMES.has(base)) return true;
  const dot = base.lastIndexOf('.');
  return dot >= 0 && SCAN_EXTENSIONS.has(base.slice(dot));
}

export function normalizeSection(s) {
  return String(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

export function presetOfAxes(backend, frontend) {
  const arr = presetsOfAxes(backend, frontend);
  return arr.length ? arr[0] : null;
}

export function presetsOfAxes(backend, frontend) {
  const out = [];
  for (const name of STACK_VALUES) {
    const prof = STACK_PROFILES[name];
    if (prof && prof.axes && prof.axes.backend === backend && prof.axes.frontend === frontend) {
      out.push(name);
    }
  }
  return out;
}

export function profileOf(stack) {
  return STACK_PROFILES[stack] || null;
}

export function resolveAnswerSource({ stdinIsTTY = false, stdinKind = 'unknown', answersFile = null } = {}) {
  if (answersFile) return { mode: 'file' };
  if (stdinIsTTY) return { mode: 'prompt', piped: false };
  if (stdinKind === 'fifo' || stdinKind === 'file') return { mode: 'prompt', piped: true };
  throw new InstallError(
    'stdin fechado e sem --answers-file: nada a perguntar. Rode interativo ou passe --answers-file <json>. Abortando sem escrever nada.',
    'NO_STDIN',
  );
}

export function ruleAllowedForAxes(rel, axisKeys, rulesByAxis = RULES_BY_AXIS) {
  const prefix = '.agents/rules/';
  if (!rel.startsWith(prefix)) return true;
  const name = rel.slice(prefix.length);
  if (!name) return true;
  for (const [key, artifacts] of Object.entries(rulesByAxis)) {
    if (axisKeys.has(key) && artifacts.includes(name)) return false;
  }
  return true;
}

export function sanitizeLog(line, answers = {}) {
  let out = stripAnsiControls(String(line));
  const secrets = new Set();
  for (const q of QUESTIONS) {
    if (!q.secret) continue;
    const v = answers[q.key];
    if (typeof v === 'string' && v !== '') secrets.add(v);
  }
  for (const s of secrets) out = out.split(s).join('[REDACTED]');
  return out;
}

export function scanLiterals(content) {
  const lower = String(content).toLowerCase();
  return DENYLIST.filter((lit) => lower.includes(lit));
}

export function serializeAnswers(answers) {
  const out = {};
  for (const q of QUESTIONS) {
    if (q.secret) continue;
    if (answers[q.key] !== undefined) out[q.key] = answers[q.key];
  }
  if (answers.answersVersion !== undefined) out.answersVersion = answers.answersVersion;
  return out;
}

export function skillAllowedForLocalAxes(rel, lock, axisKeys, skillsByAxis = SKILLS_BY_AXIS) {
  const prefix = '.agents/skills/';
  if (!rel.startsWith(prefix)) return true;
  const name = rel.slice(prefix.length).split('/')[0];
  if (!name) return true;
  if (lock && lock.skills && lock.skills[name]) return true;
  for (const [key, names] of Object.entries(skillsByAxis)) {
    if (axisKeys.has(key) && names.includes(name)) return false;
  }
  return true;
}

export function stacksFor(axes) {
  if (!axes || typeof axes !== 'object') return [];
  const pair = `${axes.backend}+${axes.frontend}`;
  if (Object.prototype.hasOwnProperty.call(STACKS_FOR_EXCEPTIONS, pair)) {
    return [...STACKS_FOR_EXCEPTIONS[pair]];
  }
  const out = [];
  if (axes.backend === 'dart') out.push('dart');
  if (axes.backend === 'rust') out.push('rust');
  if (axes.backend === 'nestjs') out.push('nestjs');
  if (axes.frontend === 'react') out.push('react');
  return out;
}

export function stripAnsiControls(s) {
  const noAnsi = String(s).replace(CSI_RE, '').replace(CHARSET_RE, '');
  return [...noAnsi].filter((ch) => !isDisplayControl(ch)).join('');
}

export function validateAnswer(target, key, value) {
  const q = QUESTIONS.find((x) => x.key === key);
  if (!q) throw new InstallError(`unknown question: ${key}`, 'BAD_ANSWER');
  // optional: valor vazio => ausente (undefined), sem BAD_ANSWER.
  if (q.optional && (value === undefined || value === null || String(value).trim() === '')) {
    return undefined;
  }
  const t = path.resolve(target);
  switch (q.kind) {
    case 'name':
      if (!value || String(value).trim() === '') throw new InstallError('project must be non-empty', 'BAD_ANSWER');
      return String(value).trim();
    case 'stack': {
      const v = String(value);
      if (!STACK_VALUES.includes(v)) {
        throw new InstallError(`stack must be one of ${STACK_VALUES.join('|')}`, 'BAD_ANSWER');
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
    case 'backend': {
      const v = String(value);
      if (!AXIS_IDS.backend.includes(v)) {
        throw new InstallError(`backend must be one of ${AXIS_IDS.backend.join('|')}`, 'BAD_ANSWER');
      }
      return v;
    }
    case 'frontend': {
      const v = String(value);
      if (!AXIS_IDS.frontend.includes(v)) {
        throw new InstallError(`frontend must be one of ${AXIS_IDS.frontend.join('|')}`, 'BAD_ANSWER');
      }
      return v;
    }
    default:
      return value;
  }
}

export function validateRulesByAxis(rulesByAxis = RULES_BY_AXIS) {
  validateAxisExclusionMap('RULES_BY_AXIS', rulesByAxis);
}

export function validateSkillsByAxis(skillsByAxis = SKILLS_BY_AXIS) {
  validateAxisExclusionMap('SKILLS_BY_AXIS', skillsByAxis);
}

export function writtenPathsOf(incomingFiles = {}) {
  return new Set(Object.keys(incomingFiles || {}).map((p) => String(p).replace(/\\/g, '/')));
}
