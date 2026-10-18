// installer/install.mjs — harness-installer Batch 1/2 (IN-01..IN-04)
// Node ESM, zero deps. Gera-nunca-copia; backup-first; segredo so-memoria.
// Escopo: SOMENTE este arquivo + installer/__tests__/. Nunca toca outro repo;
// fixtures dos testes usam tempdir.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import { Writable } from 'node:stream';
import { danglingSymlinkInPath, insideDir, realOrResolved, tmpRealRoot } from './zone.mjs';

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

export function preflight({ target, uid, allowRoot = false, nodeVersion, skipManifestGuard = false } = {}) {
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
  // G3/R9: manifesto pre-existente => aborta com instrucao (dispensado no
  // doctor D0, que diagnostica destino ja instalado sem gravar).
  const manifestPath = path.join(resolved, MANIFEST_NAME);
  if (!skipManifestGuard && fs.existsSync(manifestPath)) {
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
  { layer: '.agents/schemas', paths: ['.agents/schemas'] },
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

function safeReal(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}

export function resolveBackupDir(target, backupRoot) {
  const t = path.resolve(target);
  if (backupRoot) {
    const dir = path.resolve(backupRoot);
    const realT = safeReal(t);
    const realD = safeReal(dir);
    if (dir === t || realD === realT) throw new InstallError('backup dir must not equal target', 'BACKUP_FAIL');
    if (dir.startsWith(t + path.sep) || realD.startsWith(realT + path.sep)) {
      throw new InstallError('backup dir must not live inside target (nested)', 'BACKUP_FAIL');
    }
    if (t.startsWith(dir + path.sep) || realT.startsWith(realD + path.sep)) {
      throw new InstallError('target must not live inside backup dir (nested)', 'BACKUP_FAIL');
    }
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

// FU-25 (decisao JUSTIFICADA, nao lacuna): `infra.composeFile`/`infra.ports`
// NAO sao perguntados. Motivos: (a) perfil mobile (flutter/dart) nao tem
// servidor nem compose — infra e N/A por natureza; (b) estender o Q&A
// mudaria o contrato congelado do baseline golden (I7) e collectAnswers
// (missing answer para scripted); (c) o destino edita o bloco `infra` depois
// de instalar. O comportamento fica congelado por teste (generate.spec.mjs).
// FONTE UNICA da lista de stacks aceitos (RF-14/D-2): alimenta o prompt do W3,
// a mensagem de BAD_ANSWER e o `howToFix('stack')` — nenhuma lista duplicada a mao.
export const STACK_VALUES = ['node', 'java+vue', 'java+react', 'outra', 'node-esm', 'flutter', 'dart'];

export const QUESTIONS = [
  { key: 'project', prompt: 'Nome do projeto?', kind: 'name' },
  { key: 'stack', prompt: `Stack do destino? (${STACK_VALUES.join('/')})`, kind: 'stack' },
  { key: 'suiteCommand', prompt: 'Comando da suite de testes?', kind: 'command' },
  { key: 'pluginsDir', prompt: 'Diretorio de plugins no destino?', kind: 'path' },
  { key: 'deployToken', prompt: 'Token de deploy (sensivel, opcional)?', kind: 'string', secret: true },
];

// ---------- perfis de stack (ADR-008) ----------
// Registry puro: UNICA fonte das capacidades por stack (axes, backend/frontend,
// commands, mcp, moduleMap). `stacks` (skills/rules que o perfil aceita, A4)
// NAO e campo independente: deriva de `axes` por stacksFor (RF-01/D4).
// generateConfig resolve por lookup e permanece puro (zero I/O). Leitura do
// real (pubspec.yaml, PATH) vive em validateAnswer, nunca aqui.
// As strings de backend/frontend sao literais CONGELADOS (nunca concatenados) e
// mantem a saida byte-identica ao baseline (invariante I7 / golden).
//
// IDs de eixo (D1): conjunto fechado, separado dos rotulos (ADR-001).
// Os IDs mobile (`dart`/`flutter`) valem nos dois eixos (SPEC RF-01: o preset
// flutter carrega `flutter/flutter`) — declarado aqui, nunca inferido do nome.
export const AXIS_IDS = {
  backend: ['java', 'node', 'dart', 'flutter', 'other', 'none'],
  frontend: ['vue', 'react', 'dart', 'flutter', 'other', 'none'],
};

// Tabela de EXCECOES declarada (SPEC RF-01). A SPEC lista a excecao por PRESET
// (`flutter` -> ['flutter','dart'], o par mobile que compartilha skills); aqui a
// chave e o PAR de eixos `backend+frontend`, que identifica o mesmo preset sem
// ambiguidade (preset flutter = axes flutter/flutter) — nao ha heuristica por
// nome nem por um eixo isolado.
export const STACKS_FOR_EXCEPTIONS = {
  'flutter+flutter': ['flutter', 'dart'],
};

// `stacks` deriva do eixo (D1 do PM): o par mobile (excecao declarada acima),
// backend dart e frontend react produzem tags; os demais presets ficam sem
// filtro ([] = comum, semantica preservada).
export function stacksFor(axes) {
  if (!axes || typeof axes !== 'object') return [];
  const pair = `${axes.backend}+${axes.frontend}`;
  if (Object.prototype.hasOwnProperty.call(STACKS_FOR_EXCEPTIONS, pair)) {
    return [...STACKS_FOR_EXCEPTIONS[pair]];
  }
  const out = [];
  if (axes.backend === 'dart') out.push('dart');
  if (axes.frontend === 'react') out.push('react');
  return out;
}

export const STACK_PROFILES = {
  'node-esm': {
    axes: { backend: 'node', frontend: 'none' },
    backend: 'N/A — no Java/Maven backend declared by destination Q&A; Node-only stack',
    frontend: 'N/A — no Vue/Vite frontend declared by destination Q&A; Node-only stack',
    commands: { suiteFull: 'node --test', unit: 'node --test' },
    mcp: ['chrome-devtools'],
    moduleMap: {},
  },
  node: {
    axes: { backend: 'node', frontend: 'none' },
    backend: 'N/A — no Java/Maven backend declared by destination Q&A; Node-only stack',
    frontend: 'N/A — no Vue/Vite frontend declared by destination Q&A; Node-only stack',
    commands: { suiteFull: 'node --test', unit: 'node --test' },
    mcp: ['chrome-devtools'],
    moduleMap: {},
  },
  'java+vue': {
    axes: { backend: 'java', frontend: 'vue' },
    backend: 'java+vue backend (declared via Q&A)',
    frontend: 'java+vue frontend (declared via Q&A)',
    commands: {},
    mcp: ['chrome-devtools'],
    moduleMap: {},
  },
  'java+react': {
    axes: { backend: 'java', frontend: 'react' },
    backend: 'java+react backend (declared via Q&A)',
    frontend: 'java+react frontend (declared via Q&A)',
    commands: {},
    mcp: ['chrome-devtools'],
    moduleMap: {},
  },
  outra: {
    axes: { backend: 'other', frontend: 'other' },
    backend: 'outra backend (declared via Q&A)',
    frontend: 'outra frontend (declared via Q&A)',
    commands: {},
    mcp: ['chrome-devtools'],
    moduleMap: {},
  },
  flutter: {
    axes: { backend: 'flutter', frontend: 'flutter' },
    backend: 'flutter/dart mobile (Q&A)',
    frontend: 'flutter/dart mobile (Q&A)',
    commands: { suiteFull: 'flutter test', unit: 'flutter test', analyze: 'dart analyze' },
    mcp: ['marionette_mcp', 'dart'],
    moduleMap: { lib: 'lib', test: 'test' },
  },
  dart: {
    axes: { backend: 'dart', frontend: 'none' },
    backend: 'dart package (Q&A)',
    frontend: 'dart package (Q&A)',
    commands: { suiteFull: 'dart test', unit: 'dart test', analyze: 'dart analyze' },
    mcp: ['dart'],
    moduleMap: { lib: 'lib', test: 'test' },
  },
};

// RF-01/D4: `stacks` deixa de ser campo independente — derivado do eixo.
for (const name of Object.keys(STACK_PROFILES)) {
  STACK_PROFILES[name].stacks = stacksFor(STACK_PROFILES[name].axes);
}

// ---------- gating de artefato por EIXO DECLARADO (RF-03/RF-04, ADR-002) ----
// A1/A2: o eixo que decide a entrada de um artefato vem de DADO DECLARADO,
// nunca do nome do arquivo. Skills: `stacks` do vendor-lock (declarados na
// origem — `scripts/vendor-skills.mjs`, RF-03). Rules: as 2 estruturas abaixo.

// Mapa de EXCLUSAO por eixo. Chave `<eixo>=<id>` — VALIDADA contra AXIS_IDS na
// carga (CR-1: declaracao invalida nunca vira no-op silencioso, SPEC §5/§6);
// valor = artefatos de `.agents/rules/**` (caminho relativo sob `.agents/rules/`,
// com `/` quando em subdiretorio) que NAO entram em destino cujo eixo casa com a
// chave. O match exige o PAR `{eixo, id}` completo (N-1): `AXIS_IDS` compartilha
// ids entre eixos (`dart`, `flutter`, `other`, `none`), entao casar so o id
// over-matchearia (`'backend=none'` atingiria `node`/`node-esm`/`dart`, que tem
// `none` no eixo FRONTEND). Nao e allowlist de inclusao: um artefato citado aqui
// continua entrando em TODO destino que nao case (residual declarado do RF-04/D-4b).
export const RULES_BY_AXIS = {
  'frontend=react': ['frontend-coding-standards.md'],
};

// Artefatos de rule COMUNS: entram em todo destino. Toda rule de
// `.agents/rules/**` tem de estar aqui OU em uma chave de RULES_BY_AXIS — a
// cobertura total e checada por ENUMERACAO (recursiva e bidirecional) em
// `installer/__tests__/eixos-stack.spec.mjs` (rule nova nao classificada, ou
// nome fantasma aqui, deixa a suite vermelha; D5).
export const RULES_COMMON = [
  'brain-context.md',
  'gate-contract.md',
  'harness-config.md',
  'prd-adr-pipeline.md',
  'sdd-workflow-standard.md',
  'workflow-rules.md',
];

// CR-1: a declaracao de RULES_BY_AXIS e validada NA CARGA (fail-closed, mesmo
// padrao de RF-01/RF-02). Chave fora do formato `<eixo>=<id>`, eixo desconhecido
// em AXIS_IDS, id fora do conjunto fechado do eixo, ou valor que nao seja array
// de strings nao-vazias => erro na carga. Sem isto, `'backend=react'` (eixo
// errado), `'frontend=blazor'` (id fora do conjunto) e `'backend=node'` num
// destino sem esse eixo passariam VERDE como no-op silencioso.
export function validateRulesByAxis(rulesByAxis = RULES_BY_AXIS) {
  for (const [key, artifacts] of Object.entries(rulesByAxis)) {
    const eq = key.indexOf('=');
    const axis = eq < 0 ? null : key.slice(0, eq);
    const id = eq < 0 ? null : key.slice(eq + 1);
    if (!axis || !id) {
      throw new InstallError(`RULES_BY_AXIS: chave invalida '${key}' (esperado '<eixo>=<id>')`, 'BAD_DECLARATION');
    }
    if (!Object.prototype.hasOwnProperty.call(AXIS_IDS, axis)) {
      throw new InstallError(`RULES_BY_AXIS: eixo desconhecido '${axis}' em '${key}' (AXIS_IDS: ${Object.keys(AXIS_IDS).join(', ')})`, 'BAD_DECLARATION');
    }
    if (!AXIS_IDS[axis].includes(id)) {
      throw new InstallError(`RULES_BY_AXIS: id '${id}' fora de AXIS_IDS.${axis} em '${key}'`, 'BAD_DECLARATION');
    }
    if (!Array.isArray(artifacts) || artifacts.length === 0 || artifacts.some((a) => typeof a !== 'string' || a === '')) {
      throw new InstallError(`RULES_BY_AXIS: valor de '${key}' tem de ser array de strings nao-vazias`, 'BAD_DECLARATION');
    }
  }
}
validateRulesByAxis();

// Chaves de eixo do destino a partir de um `axes`: PAReS `<eixo>=<id>` (mesma
// forma das chaves de RULES_BY_AXIS), restritos aos eixos declarados em AXIS_IDS.
// O par — e nao o id solto — e o que torna o match exato entre eixos que
// compartilham id (`dart`/`flutter`/`other`/`none`).
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

// Chaves de eixo do DESTINO. Fonte primaria (CR-1): o PRESET —
// `profileOf(stack).axes` —, porque para 5 dos 7 presets as tags de `stacks` sao
// vazias (qualquer chave seria inerte/∅). FALLBACK DOCUMENTADO: sem preset
// conhecido, um valor de `stacks` que seja NOME de preset e expandido pelos seus
// eixos. TAGS isoladas ('react') NAO formam par `{eixo,id}` e por isso NAO
// gateiam — casar por tag exigiria adivinhar o eixo, que e exatamente o
// over-match corrigido em N-1 (fail-open, nunca fail-wide).
function axisIdsForDestination({ stack, stacks } = {}) {
  const profile = profileOf(stack);
  if (profile) return axisIdsFromAxes(profile.axes);
  const keys = new Set();
  for (const value of Array.isArray(stacks) ? stacks : []) {
    const byPreset = STACK_PROFILES[value];
    if (byPreset) for (const key of axisIdsFromAxes(byPreset.axes)) keys.add(key);
  }
  return keys;
}

// Rule barrada para este destino? So o mapa DECLARADO decide — o nome do
// arquivo nunca e consultado. Sem entrada no mapa => comum (entra). O match e o
// PAR exato `{eixo, id}` (N-1): `axisKeys` ja vem como `<eixo>=<id>` e a chave da
// declaracao tem a mesma forma, logo `has(key)` compara eixo E id. `rel` e o
// caminho relativo ao repo (ex.: `.agents/rules/x/y.md`): a classificacao usa o
// caminho COMPLETO sob `.agents/rules/`, logo rule em subdiretorio tambem e
// classificavel (SPEC §5 — enumeracao recursiva).
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

export function profileOf(stack) {
  return STACK_PROFILES[stack] || null;
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
//
// C (bugfix installer-upgrade-regression): AUTO-CONSISTENCIA. A config gerada
// so cita artefato que a PROPRIA execucao escreve. `writtenPaths` = conjunto dos
// paths relativos dos arquivos que a execucao vai gravar (chaves de
// incomingFiles). Sem esse conjunto o gerador devolve o baseline congelado
// (golden I7): todas as refs harness-owned presentes. O check
// `config-ref-missing` NAO e afrouxado — segue exigindo que toda ref concreta
// presente na config exista no destino; o que muda e que a config deixa de
// declarar camadas que a execucao nao instalou.
export const DEFAULT_EVIDENCE_SCHEMA = '.agents/schemas/harness-report.schema.json';

// Conjunto normalizado dos paths relativos escritos nesta execucao.
export function writtenPathsOf(incomingFiles = {}) {
  return new Set(Object.keys(incomingFiles || {}).map((p) => String(p).replace(/\\/g, '/')));
}

// Um ref de DIRETORIO existe se algum arquivo escrito vive sob ele; um ref de
// ARQUIVO (evidence.schema) existe so se o arquivo exato foi escrito.
function refWillExist(rel, writtenPaths) {
  const norm = String(rel).replace(/\\/g, '/');
  if (writtenPaths.has(norm)) return true;
  const prefix = norm.endsWith('/') ? norm : `${norm}/`;
  for (const p of writtenPaths) if (p.startsWith(prefix)) return true;
  return false;
}

export function generateConfig(answers, { writtenPaths = null } = {}) {
  if (!answers || !answers.project) throw new InstallError('answers.project required', 'BAD_ANSWER');
  const stack = answers.stack || 'node';
  const profile = profileOf(stack);
  const defaultSuite = (profile && profile.commands && profile.commands.suiteFull) || 'node --test';
  const suiteFull = answers.suiteCommand || defaultSuite;
  const commands = { suiteFull, unit: suiteFull };
  if (profile && profile.commands && profile.commands.analyze) commands.analyze = profile.commands.analyze;
  const moduleMap = {
    plugins: '.opencode/plugins',
    rules: '.agents/rules',
    schemas: '.agents/schemas',
    ...(profile ? profile.moduleMap : {}),
  };
  const evidence = { path: 'harness/', schema: DEFAULT_EVIDENCE_SCHEMA };
  if (writtenPaths) {
    for (const k of HARNESS_OWNED_MODULEMAP_KEYS) {
      const rel = moduleMap[k];
      if (typeof rel === 'string' && !refWillExist(rel, writtenPaths)) delete moduleMap[k];
    }
    if (!refWillExist(evidence.schema, writtenPaths)) delete evidence.schema;
  }
  return {
    version: 1,
    project: answers.project,
    stack: {
      backend: profile ? profile.backend : `${stack} backend (declared via Q&A)`,
      frontend: profile ? profile.frontend : `${stack} frontend (declared via Q&A)`,
    },
    moduleMap,
    commands,
    // FU-25: infra N/A — ver justificativa em QUESTIONS (mobile nao tem
    // servidor/compose; contrato golden congelado; destino edita pos-install).
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
    evidence,
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
  if (rel.startsWith('.agents/schemas/')) return '.agents/schemas/*';
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
  // MUSTFIX-4 excecao (dono F3 doctor D3 / F4 init W4): planMerge e puro (sem IO,
  // sem sink) e lanca CORRUPT com codigo; a camada de display formata via
  // formatError — runWizard W4 e runCli (F1) formatam no catch; doctor/init
  // (F3/F4) formatam no proprio display. Sem sink aqui por construcao.
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

// ---------- gate create-only do init (REQ-10/INS-15, SPEC §9.3) ----------
// Puro: classifica o plano pos-W4. So create|generate-overwrite|noop passam;
// qualquer merge|flag aborta com flagged-open citando doctor. Sem sink aqui —
// o display (bloco 4-linhas) vive no chamador (runWizard/runInit).
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
// FU-33 (cleanups pos-FU-32):
// 1. SCAN_BASENAMES (pubspec.yaml/package.json/pom.xml/build.gradle/
//    build.gradle.kts) foi REMOVIDO — era redundante: cada um ja casa pela
//    extensao (.yaml/.json/.xml/.gradle/.kts). O teste "isScannablePath" em
//    checks.spec.mjs cobre os cinco para a nao-regressao.
// 2. Buracos da allowlist FECHADOS: .html/.css/.sh (web/shell reprovam igual)
//    e Dockerfile (sem extensao => unica entrada em SCAN_NAMES, casa EXATO,
//    minusculo, sem substring). Fora do scan, DECLARADO: .csv/.svg/etc.,
//    extensionless (exceto Dockerfile) e binarios.
const SCAN_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.vue', '.svelte',
  '.java', '.kt', '.kts', '.gradle', '.groovy', '.dart', '.cs',
  '.py', '.rb', '.go', '.rs', '.php',
  '.xml', '.json', '.yaml', '.yml', '.toml', '.properties', '.lock',
  '.html', '.css', '.sh',
]);

// Arquivos sem extensao cobertos pelo scan (FU-33).
const SCAN_NAMES = new Set(['dockerfile']);

// Tooling/testes do proprio harness: nomeiam os padroes como dado de teste.
// Nunca sao conteudo instalado util; o canario mira o CONTEUDO INSTALADO do
// destino, nao a tooling/testes de quem instala.
//
// Justificativa (FU-33, ajustada por harness-installer-operability) — cada ramo
// DEFENSIVO: o canario mira o CONTEUDO INSTALADO do destino; tooling/testes de
// quem instala nomeiam os padroes como dado de teste e nao podem reprovar.
// - `__tests__/`: apos a Estrategia A o instalador NAO shipa mais
//   `.opencode/plugins/__tests__` ao consumidor (collectIncoming exclui). A
//   exclusao permanece por defesa: se um destino vendorizar seus testes como
//   conteudo instalado, instalar o harness nao vira falso-positivo (defeito FU-32).
// - `scripts/`: idem. `scripts/` nunca e INCOMING_ROOT; se um destino o
//   vendorizar como conteudo instalado, tooling que nomeia padroes como dado de
//   teste nao pode reprovar o canario. Estreita: so o segmento `scripts`, em
//   qualquer nivel; arquivo comum nunca.
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
  if (SCAN_NAMES.has(base)) return true;
  const dot = base.lastIndexOf('.');
  return dot >= 0 && SCAN_EXTENSIONS.has(base.slice(dot));
}

// Substring simples e amplo, case-insensitive (FU-32). Sem maquinaria
// contextual: o escopo (isScannablePath) e quem separa codigo de prosa.
export function scanLiterals(content) {
  const lower = String(content).toLowerCase();
  return DENYLIST.filter((lit) => lower.includes(lit));
}

// Q3(a): referencias que a config declara e o consumidor precisa ter em disco.
// Escopo OWNED-BY-HARNESS (re-review F2): o instalador so shipa os roots do
// proprio harness — `evidence.schema` + `moduleMap.{plugins,rules,schemas}`.
// Chaves de stack do destino (`lib`/`test` do perfil flutter/dart, etc.) NAO
// sao artefatos do harness e nao podem reprovar a instalacao (falso-FAIL).
// Qualquer path com curinga (`*`, `**`) e padrao, nunca artefato concreto.
const HARNESS_OWNED_MODULEMAP_KEYS = ['plugins', 'rules', 'schemas'];
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

function collectPluginFiles(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) collectPluginFiles(abs, out);
    else if (e.isFile() && /\.(mjs|js)$/.test(e.name)) out.push(abs);
  }
}

export function runChecks(target, { manifest = null, answers = {} } = {}) {
  const t = path.resolve(target);
  const failed = [];
  // INS-02 (REQ-06): cada falha sai como bloco 4-linhas (INS-01) com onde ver
  // no manifesto/target real. Tokens legados preservados como substring.
  // MUSTFIX-1/3: bloco redige com answers vigentes (sink sem sanitizacao = defeito).
  const block = (what, code, fix, where) => formatError({ what, code, fix, where }, answers);
  if (!manifest) {
    failed.push(block('manifest-missing: .harness-install.json nao informado', 'manifest-missing', 'informe o manifesto via .harness-install.json no target ou rode a instalacao antes dos checks.', t));
    return { passed: false, failed };
  }
  const manifestPath = path.join(t, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) failed.push(block('manifest-missing: .harness-install.json ausente no target', 'manifest-missing', 'rode a instalacao para gerar o manifesto e rode os checks de novo.', manifestPath));
  for (const rel of ['opencode.json', 'harness.config.json']) {
    const abs = path.join(t, rel);
    if (!fs.existsSync(abs)) {
      if (rel === 'harness.config.json') failed.push(block('config-missing: harness.config.json ausente', 'config-missing', 'gere o harness.config.json via instalacao (generateConfig) no target.', abs));
      continue;
    }
    try {
      JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch {
      failed.push(block(`json-invalid: ${rel} corrompido (R1)`, 'json-invalid', 'corrija o JSON apontado (valide com um parser) e rode os checks de novo.', abs));
    }
  }
  for (const f of manifest.flagged || []) {
    failed.push(block(`flagged-open: ${f.path} (${f.reason || 'sem motivo'}) — resolucao humana pendente (I6)`, 'flagged-open', 'resolva cada item flagged manualmente e rode doctor/install de novo.', path.join(t, f.path)));
  }
  const listed = [...(manifest.installed || []), ...(manifest.merged || [])];
  for (const f of listed) {
    if (!isScannablePath(f.path)) continue;
    const abs = path.join(t, f.path);
    if (!fs.existsSync(abs)) continue;
    const st = fs.statSync(abs);
    if (!st.isFile()) continue;
    const hits = scanLiterals(fs.readFileSync(abs, 'utf8'));
    for (const h of hits) failed.push(block(`literal-denied: ${f.path} contem '${h}' (R3/canario)`, 'literal-denied', 'remova a dependencia/uso da stack alheia do arquivo apontado.', abs));
  }
  // Q3(a) (F1): referencias declaradas na config devem existir no destino.
  // Config presente e valida: cada path citado (evidence.schema, moduleMap.*,
  // protectedPaths) sem glob precisa existir — senao o gate de evidencia fica
  // sem schema e o consumidor instala "verde" mas inoperante.
  const configAbs = path.join(t, 'harness.config.json');
  let parsedConfig = null;
  if (fs.existsSync(configAbs)) {
    try {
      parsedConfig = JSON.parse(fs.readFileSync(configAbs, 'utf8'));
    } catch {
      parsedConfig = null;
    }
  }
  if (parsedConfig && typeof parsedConfig === 'object') {
    for (const ref of configReferenceTargets(parsedConfig)) {
      const abs = path.join(t, ref.path);
      if (!fs.existsSync(abs)) {
        failed.push(block(`config-ref-missing: ${ref.label} aponta '${ref.path}' inexistente`, 'config-ref-missing', `instale/crie o artefato referenciado por ${ref.label} ('${ref.path}') no target e rode os checks de novo.`, abs));
      }
    }
    // Q3(b) (F1): operabilidade real — cada plugin .js/.mjs instalado precisa
    // parsear. node --check por stdin com input-type=module funciona para ESM
    // em qualquer versao suportada (sem depender de package.json no destino).
    const mapPlugins = parsedConfig.moduleMap && parsedConfig.moduleMap.plugins;
    const pluginDir = (typeof mapPlugins === 'string' && mapPlugins.length > 0 && !mapPlugins.includes('**'))
      ? path.join(t, mapPlugins)
      : path.join(t, '.opencode/plugins');
    const pluginFiles = [];
    collectPluginFiles(pluginDir, pluginFiles);
    for (const abs of pluginFiles) {
      try {
        execFileSync(process.execPath, ['--check', '--input-type=module'], {
          input: fs.readFileSync(abs),
          stdio: ['pipe', 'ignore', 'pipe'],
        });
      } catch {
        failed.push(block(`plugin-parse: ${path.relative(t, abs)} nao parseia (node --check)`, 'plugin-parse', 'corrija a sintaxe do plugin apontado (rode node --check nele) e reinstale.', abs));
      }
    }
  }
  return { passed: failed.length === 0, failed };
}

// ---------- doctor brownfield read-only D0-D6 (INS-11/INS-12) ----------

// Stack do destino a partir do estado GRAVADO pelo init (manifesto). Leitura
// pura: e o dado que faz o doctor sem `--answers-file` ser previa fiel do
// `upgrade` (que le `manifest.answers`) — SPEC §6.
function destinationStack(target) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(target, MANIFEST_NAME), 'utf8'));
    const s = parsed && parsed.answers && parsed.answers.stack;
    return typeof s === 'string' && s ? s : null;
  } catch {
    return null;
  }
}

export function runDoctor({ target, sourceDir = null, answersFile = null, backupDir = null, allowRoot = false, output = null } = {}) {
  const srcRoot = sourceDir || INSTALLER_ROOT;
  const say = (s) => {
    try {
      if (output && typeof output.write === 'function') output.write(`${s}\n`);
    } catch { /* stream opcional */ }
  };
  let redacting = {};
  say('[INFO] D0 pre-flight (somente leitura): verifica destino sem criar nada.');
  const pf = preflight({ target, allowRoot, skipManifestGuard: true });
  if (backupDir) resolveBackupDir(pf.target, backupDir);
  if (answersFile) {
    const loaded = loadAnswersFile(answersFile);
    redacting = { ...(loaded || {}) };
  }
  // SPEC §6: sem `--answers-file` o doctor NAO pode ser no-op (fail-open) — o
  // stack do destino esta no manifesto do init. Sem isto o D3 proporia `create`
  // de um artefato que o `init` excluiu de proposito (o eixo nao seria aplicado).
  if (!redacting.stack) {
    const fromTarget = destinationStack(pf.target);
    if (fromTarget) redacting = { ...redacting, stack: fromTarget };
  }
  say(`[OK] D0 pre-flight: target=${pf.target}`);
  say('[INFO] D1 inventario do destino (somente leitura).');
  const inv = inventory(pf.target);
  for (const l of inv.layers) {
    say(`  [${l.present ? 'OK' : 'AVISO'}] D1 ${l.layer}${l.present ? ' presente' : ' ausente'}`);
  }
  say('[INFO] D2 deteccao pubspec (somente leitura, fontes arquivo:linha).');
  const det = detect(pf.target);
  if (det.hasPubspec) {
    for (const s of det.sources) say(`  [OK] D2 ${s.field} <- ${s.file}:${s.line}`);
    say(`  [INFO] D2 sugestao de stack: ${det.suggestedStack}`);
  } else {
    say('  [AVISO] D2 sem pubspec.yaml — diagnostico segue sem sugestao.');
  }
  for (const w of det.warnings || []) say(`  [AVISO] D2 ${w}`);
  say('[INFO] D3 plano seco (classifica sem gravar).');
  const prof = redacting.stack ? profileOf(redacting.stack) : null;
  const stacks = prof ? prof.stacks : (redacting.stack ? [redacting.stack] : []);
  const incomingFiles = collectIncoming(srcRoot, { stacks, stack: redacting.stack ?? null });
  const plan = planMerge(pf.target, { ...incomingFiles, 'harness.config.json': '' });
  const counts = {};
  for (const p of plan) counts[p.action] = (counts[p.action] || 0) + 1;
  say(`[INFO] D3 plano: ${plan.length} itens (${Object.entries(counts).map(([a, n]) => `${a}=${n}`).join(' ') || 'vazio'})`);
  say('[INFO] D4 checks + scan (somente leitura).');
  const failed = [];
  const block = (what, code, fix, where) => formatError({ what, code, fix, where }, redacting);
  for (const rel of ['opencode.json', 'harness.config.json']) {
    const abs = path.join(pf.target, rel);
    if (!fs.existsSync(abs)) continue;
    try {
      JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch {
      failed.push(block(`json-invalid: ${rel} corrompido`, 'json-invalid', 'corrija o JSON apontado (valide com um parser) e rode os checks de novo.', abs));
    }
  }
  for (const p of plan) {
    if (p.action !== 'flag') continue;
    failed.push(block(`flagged-open: ${p.path} (${p.reason || 'sem motivo'}) — resolucao humana pendente`, 'flagged-open', 'resolva cada item flagged manualmente e rode o fluxo de escrita de novo.', path.join(pf.target, p.path)));
  }
  for (const p of plan) {
    if (!isScannablePath(p.path)) continue;
    const abs = path.join(pf.target, p.path);
    if (!fs.existsSync(abs)) continue;
    let st;
    try { st = fs.statSync(abs); } catch { continue; }
    if (!st.isFile()) continue;
    let hits = [];
    try { hits = scanLiterals(fs.readFileSync(abs, 'utf8')); } catch { continue; }
    for (const h of hits) failed.push(block(`literal-denied: ${p.path} contem '${h}'`, 'literal-denied', 'remova a dependencia/uso da stack alheia do arquivo apontado.', abs));
  }
  say(`[INFO] D4 checks: ${failed.length === 0 ? 'PASS' : `FAIL ${failed.length} item(ns)`}`);
  for (const f of failed) say(f);
  say('[INFO] D5 manifesto existente (leitura pura, nunca grava).');
  const manifestPath = path.join(pf.target, MANIFEST_NAME);
  const manifestInfo = { present: false, path: manifestPath, mtimeMs: null, parsed: null };
  if (fs.existsSync(manifestPath)) {
    try {
      manifestInfo.mtimeMs = fs.statSync(manifestPath).mtimeMs;
      const raw = fs.readFileSync(manifestPath, 'utf8');
      try { manifestInfo.parsed = JSON.parse(raw); } catch { manifestInfo.parsed = null; }
      manifestInfo.present = true;
      say(`  [OK] D5 manifesto presente: ${manifestPath}`);
    } catch {
      say(`  [AVISO] D5 manifesto ilegivel: ${manifestPath}`);
    }
  } else {
    say(`  [AVISO] D5 sem manifesto: ${manifestPath} (destino ainda nao instalado)`);
  }
  say('[INFO] D6 relatorio por camada + proximos passos.');
  const hasFlag = plan.some((p) => p.action === 'flag');
  const hasMerge = plan.some((p) => p.action === 'merge');
  const hasFailed = failed.length > 0;
  let verdict = 'SAUDÁVEL';
  let exitCode = 0;
  if (hasFlag || hasFailed) { verdict = 'QUEBRADO'; exitCode = 1; }
  else if (hasMerge) { verdict = 'ATENÇÃO'; exitCode = 1; }
  let next = '';
  if (verdict === 'QUEBRADO') next = 'resolva cada item flag/FAIL acima e rode o fluxo de escrita de novo.';
  else if (verdict === 'ATENÇÃO') next = 'revise os itens merge acima e rode o fluxo de escrita de novo.';
  else next = `nada a corrigir; para instalar do zero rode init --target ${pf.target}.`;
  say(`  [INFO] D6 plano por camada: ${Object.entries(counts).map(([a, n]) => `${a}=${n}`).join(' ') || 'vazio'}`);
  say(`  [INFO] D6 veredito: ${verdict} (exit ${exitCode})`);
  say(`  [INFO] D6 proximos passos: ${next}`);
  const report = { verdict, counts, next, total: plan.length, failed: failed.length };
  return { target: pf.target, markers: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'], inventory: inv, detection: det, plan, checks: { passed: failed.length === 0, failed }, manifestInfo, manifest: manifestInfo, report, verdict, exitCode };
}

// ---------- manifesto em disco (IN-06/I4) ----------

export function writeManifest(target, manifest, { dryRun = false, fsImpl = fs } = {}) {
  if (dryRun) return { skipped: true, path: null };
  const t = path.resolve(target);
  const abs = assertInside(t, path.join(t, MANIFEST_NAME));
  fsImpl.writeFileSync(abs, JSON.stringify(manifest, null, 2));
  return { skipped: false, path: abs };
}

// ---------- segredo fora do log (IN-06/Y5) + display hygiene (REQ-18/M4) ----------

// REQ-18 (INS-06): filtro ANSI/controle. Ordem explícita strip-then-redact:
// primeiro remove escapes ANSI e controles (exceto \n\t), depois
// sanitizeLog redige segredos. Strip antes garante que escape em volta do
// token não quebre a redação por split.
const ESC = String.fromCharCode(27);
const CSI_RE = new RegExp(`${ESC}\\[[0-9;?]*[A-Za-z]`, 'g');
const CHARSET_RE = new RegExp(`${ESC}[()][0-9A-B]`, 'g');

function isDisplayControl(ch) {
  const c = ch.codePointAt(0);
  return c === 27 || (c >= 0 && c <= 8) || (c >= 11 && c <= 13) || (c >= 14 && c <= 31) || c === 127;
}

export function stripAnsiControls(s) {
  const noAnsi = String(s).replace(CSI_RE, '').replace(CHARSET_RE, '');
  return [...noAnsi].filter((ch) => !isDisplayControl(ch)).join('');
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

// ---------- erro padrão 4-linhas (REQ-05/INS-01, SPEC §9.2) ----------

// Vocabulário real de códigos emitidos pelo CLI/checks. Fora dele => UNKNOWN.
const ERROR_CODES = new Set([
  'BAD_ANSWER', 'CORRUPT', 'NO_STDIN', 'USER_ABORT', 'BACKUP_FAIL',
  'BACKUP_UNVERIFIED', 'BAD_TARGET', 'NODE_MIN', 'UID_ROOT', 'REINSTALL',
  'FOREIGN_MANIFEST', 'OUTSIDE_TARGET', 'DOGFOOD_GUARD', 'MISSING_INCOMING',
  'SECRET_TTY', 'manifest-missing', 'config-missing', 'json-invalid',
  'flagged-open', 'literal-denied', 'config-ref-missing', 'plugin-parse',
]);

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

// Dry-run nunca PASS (REQ-07/INS-03, SPEC §9.2): rótulo greppable único.
export function dryRunNotice() {
  return '[INFO] dry-run: NÃO EXECUTADO — nenhum write (plano + relatório apenas)';
}

// ---------- trava dogfood (IN-07/Y4/R5) ----------

// Tres camadas, e a ESCRITA so passa pelas tres:
//   1. lexica: o path ESCRITO estah sob /tmp — ou vem com --target explicito +
//      confirmacao (escape documentado, a UNICA saida para fora do /tmp);
//   2. real: o alvo, como o SO ve, estah sob o realpath de os.tmpdir()
//      (macOS inclui: /private/var). So a lexica deixava
//      `/tmp/<atalho>/sub` com `<atalho>` -> fora do /tmp passar, e o
//      instalador ESCREVIA fora da zona autorizada — a limpeza bloqueava a
//      remocao, mas a escrita jah tinha acontecido (FU-42);
//   3. atalho pendurado no caminho: destino nao provavel => fail-closed.
// Duvida em qualquer camada => ABORTA antes de qualquer escrita, com o caminho
// resolvido na mensagem (politica conservadora, provavel por teste).
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
  const generated = JSON.stringify(generateConfig(answers, { writtenPaths: writtenPathsOf(incomingFiles) }), null, 2);
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
  let manifestRef = { skipped: true, path: null };
  // FU-28: dry-run NAO roda checks — devolver `{ passed: true }` aqui seria um
  // PASS que nunca executou (consumidor leria instalacao verificada sem
  // verificacao). Sinal explicito: passed null (desconhecido), ran false,
  // skipped true, reason nomeando o dry-run.
  let checks = dryRun
    ? { passed: null, failed: [], ran: false, skipped: true, reason: 'dry-run: checks nao executados' }
    : { passed: true, failed: [] };
  const manifest = buildManifest({
    target: pf.target,
    backupDir: bk.backupDir,
    installed,
    merged,
    flagged: result.flagged || [],
    answers,
    checks,
    fileContents,
    source: `harness@${VERSION}`,
  });
  if (!dryRun) {
    manifestRef = writeManifest(pf.target, manifest);
    checks = runChecks(pf.target, { manifest, answers });
    manifest.checks = checks;
    fs.writeFileSync(path.join(pf.target, MANIFEST_NAME), JSON.stringify(manifest, null, 2));
  }
  // D1 (bugfix installer-upgrade-regression): `main()` e a raiz comum dos
  // caminhos do consumidor — runInit/runUpgrade, o CLI legado e o wizard TTY
  // devolvem este objeto (verbatim em runCli). O top-level faz
  // `res.exitCode ?? 0`; sem exitCode aqui, uma instalacao REPROVADA sai 0 em
  // silencio. `checks.passed === false` => 1; PASS ou dry-run (passed null,
  // checks nao executados) => 0.
  const exitCode = checks && checks.passed === false ? 1 : 0;
  return { target: pf.target, inventory: inv, backup: bk, answers: serializeAnswers(answers), profile: answers.stack, plan, result, manifest, manifestRef, checks, dryRun, exitCode };
}

// ---------- CLI: incoming canonico + Q&A + plano + main ----------
// Lista canonica dos incoming: o instalador GERA o harness.config.json a
// partir do Q&A (ADR-002, nunca copia config alheio) e usa como incoming o
// conteudo versionado destas raizes do repo harness:
//   - dirs que entram: .agents/agents, .agents/rules, .agents/schemas,
//     .agents/skills, .opencode/plugins (+ o arquivo opencode.json, merge aditivo)
//   - o que exclui: segmentos node_modules e .git em qualquer nivel, o
//     manifesto .harness-install.json (estado, nunca conteudo), o vendor-lock,
//     e o tooling de CONSUMIDOR que nao e runtime: .opencode/plugins/__tests__
//     (suite interna do repo-harness) e scripts/ (tooling interno).
// Estrategia A (bugfix harness-installer-operability): entregamos runtime +
// artefatos REFERENCIADOS (ex.: .agents/schemas, alvo de evidence.schema);
// a auto-suite interna e scripts/ nunca sao artefato de consumidor.
export const INCOMING_ROOTS = [
  '.agents/agents',
  '.agents/rules',
  '.agents/schemas',
  '.agents/skills',
  '.opencode/plugins',
  'opencode.json',
];
export const INCOMING_EXCLUDE = new Set(['node_modules', '.git']);
// Prefixos de tooling interno que NUNCA vao ao consumidor.
export const CONSUMER_EXCLUDED_PREFIXES = ['.opencode/plugins/__tests__/'];
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

export function collectIncoming(sourceDir, { stacks, stack } = {}) {
  const src = path.resolve(sourceDir);
  const incoming = {};
  const lock = readVendorLock(src);
  const wanted = new Set(Array.isArray(stacks) ? stacks : []);
  // RF-04/A2: gating de `.agents/rules/**` pela MESMA mecanica das skills —
  // eixo declarado (RULES_BY_AXIS validado na carga), nunca nome do arquivo.
  // O eixo do destino deriva do PRESET (`stack`); `stacks` e fallback (CR-1).
  const axisIds = axisIdsForDestination({ stack, stacks });
  const excluded = (rel) =>
    rel.split(path.sep).some((seg) => INCOMING_EXCLUDE.has(seg))
    || rel === 'scripts' || rel.startsWith('scripts/')
    || CONSUMER_EXCLUDED_PREFIXES.some((prefix) => rel.startsWith(prefix))
    || path.basename(rel) === MANIFEST_NAME
    || path.basename(rel) === VENDOR_LOCK_NAME;
  const walk = (abs, rel) => {
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(abs)) walk(path.join(abs, e), rel ? `${rel}/${e}` : e);
    } else if (st.isFile()) {
      if (!excluded(rel) && skillAllowedForStacks(rel, lock, wanted) && ruleAllowedForAxes(rel, axisIds)) {
        incoming[rel] = fs.readFileSync(abs, 'utf8');
      }
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

const CLI_COMMANDS = new Set(['init', 'doctor', 'upgrade']);

export function parseArgs(argv) {
  const out = { command: null, target: null, allowRoot: false, dryRun: false, answersFile: null, yes: false, backupDir: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target') out.target = argv[++i];
    else if (a === '--allow-root') out.allowRoot = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--answers-file') out.answersFile = argv[++i];
    else if (a === '--yes' || a === '-y') out.yes = true;
    else if (a === '--backup-dir') out.backupDir = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
    else if (!a.startsWith('-') && out.command === null) {
      // SPEC §9.5 (INS-19): primeiro posicional seleciona o entrypoint.
      if (!CLI_COMMANDS.has(a)) {
        throw new InstallError(`comando desconhecido '${a}' (use init|doctor|upgrade; sem comando segue o fluxo install legado)`, 'BAD_ANSWER');
      }
      out.command = a;
    } else if (!a.startsWith('-')) {
      throw new InstallError(`posicional extra '${a}' (um comando por invocacao: init|doctor|upgrade)`, 'BAD_ANSWER');
    }
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

// ---------- segredo sem eco (FU-27/Y5) ----------
// O token (deployToken) era lido com ECO no TTY: quem olhasse a tela (ou o
// scrollback) via o segredo. Correcao: em TTY real a leitura e SEM ECO
// (setRawMode(true) + mascara '*'). Pipe/redirect/teste (sem raw-mode) seguem
// no leitor de linha — pipe nao ecoa nada; o risco fica restrito ao TTY, onde
// agora ha mascara.
//
// O leitor readline e FECHADO e RECRIADO em volta da leitura crua: dois
// ouvintes no mesmo stdin fariam o readline enfilar o token como resposta da
// PROXIMA pergunta (vazamento de segredo para pluginsDir). Janela residual
// declarada: digitacao entre o Enter do segredo e o recreate do leitor (trecho
// sincrono) depende do buffer do TTY — em pipe nao ha leitura crua.

export function canNoEcho(input) {
  return Boolean(input && input.isTTY && typeof input.setRawMode === 'function');
}

export function readSecretRaw(input, output, { mask = '*' } = {}) {
  if (!canNoEcho(input)) {
    return Promise.reject(new InstallError('leitura sem eco exige stdin TTY com setRawMode', 'SECRET_TTY'));
  }
  const write = (s) => { try { if (output && typeof output.write === 'function') output.write(s); } catch { /* stream opcional */ } };
  return new Promise((resolve, reject) => {
    let buf = '';
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      input.removeListener('data', onData);
      try { input.setRawMode(false); } catch { /* stream sem raw mode */ }
      write('\n');
      if (err) reject(err); else resolve(value);
    };
    const onData = (chunk) => {
      const s = String(chunk);
      for (const ch of s) {
        if (ch === '\r' || ch === '\n') { finish(null, buf); return; }
        if (ch === '\u0003') {
          finish(new InstallError('digitacao do segredo cancelada (Ctrl+C): abortando sem escrever nada.', 'USER_ABORT'), null);
          return;
        }
        if (ch === '\u007F' || ch === '\b') {
          if (buf.length > 0) { buf = buf.slice(0, -1); write('\b \b'); }
          continue;
        }
        buf += ch;
        write(mask);
      }
    };
    input.setRawMode(true);
    input.on('data', onData);
    if (typeof input.resume === 'function') input.resume();
  });
}

// TTY real => token cru (sem eco). Sem raw-mode => null: o chamador usa o
// leitor de linha (comportamento historico, retrocompat de pipe/redirect).
export function readSecretPrompt({ input, output, prompt = '' } = {}) {
  if (!canNoEcho(input)) return Promise.resolve(null);
  try { if (output && typeof output.write === 'function') output.write(`${prompt} `); } catch { /* stream opcional */ }
  return readSecretRaw(input, output);
}

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
  let r = createLineReader({ input, output });
  const askOne = async (q) => {
    r.say(`${q.prompt} `);
    const line = await r.next();
    if (line === undefined) throw new InstallError(EOF_ABORT, 'NO_STDIN');
    return line;
  };
  // FU-27: segredo em TTY real => leitura sem eco; o readline e fechado e
  // recriado em volta para nao enfilar o token como proxima resposta.
  const askSecret = async (q) => {
    if (!canNoEcho(input)) return askOne(q);
    r.close();
    const raw = await readSecretPrompt({ input, output, prompt: q.prompt });
    r = createLineReader({ input, output });
    return raw;
  };
  return (async () => {
    const answers = {};
    for (const q of QUESTIONS) {
      for (;;) {
        const raw = q.secret ? await askSecret(q) : await askOne(q);
        const value = raw === '' && q.secret ? '' : raw;
        try {
          if (q.secret && value === '') { answers[q.key] = ''; break; }
          answers[q.key] = validateAnswer(target, q.key, value);
          break;
        } catch (e) {
          // MUSTFIX-1 (REQ-14): vigentes COMPLETOS — anteriores validados +
          // raw atual. Parcial `{ [q.key]: raw }` vaza token de outra resposta.
          r.say(sanitizeLog(`resposta invalida para '${q.key}': ${e.message} — tente de novo.`, { ...answers, [q.key]: raw }));
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

export function printPlan(plan, { output = process.stdout, answers = {} } = {}) {
  // MUSTFIX-3: sink redige com vigentes (sink sem sanitizacao = defeito).
  const write = (s) => output.write(`${sanitizeLog(String(s), answers)}\n`);
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

// Menu do W2m-1 (ADR-004 §2): ordem e numeracao 1..5 IDENTICAS ao menu legado —
// nao renumerar (o teste le os itens por string). O item 4 nao mapeia mais
// direto para `java+vue`: encadeia o passo 2 (`next`) e seu `stack` e o PRESET
// que o Enter do passo 2 reproduz (default de produto, D-9).
export const WIZARD_MENU = [
  { key: '1', label: 'App Flutter', stack: 'flutter' },
  { key: '2', label: 'Pacote Dart', stack: 'dart' },
  { key: '3', label: 'Projeto Node.js', stack: 'node', note: 'ESM incluso' },
  { key: '4', label: 'Aplicação web (backend + frontend)', stack: 'java+vue', next: 'frontend' },
  { key: '5', label: 'Outro projeto', stack: 'outra' },
];

// Menu do W2m-2 (ADR-004, adaptado por D-A): frontend do projeto web. Default =
// item 1 (Vue) por decisao do owner (D-9): `java+vue` e o unico valor web
// congelado no baseline, entao Enter reproduz o comportamento atual. NAO existe
// detector de Vue/React (o detector so le `pubspec.yaml`): e default de PRODUTO
// estatico, declarado como tal — nunca inferido.
export const WIZARD_MENU_FRONTEND = [
  { key: '1', label: 'Vue (default)', stack: 'java+vue' },
  { key: '2', label: 'React', stack: 'java+react' },
];
export const WIZARD_MENU_FRONTEND_DEFAULT = '1';

export function isAbortToken(s) {
  return ABORT_TOKENS.has(String(s).trim().toLowerCase());
}

// Colunas de alinhamento do rotulo por bloco, LITERAIS do ADR-004 §2 (fonte
// congelada do parecer UX): o separador ` -> ` soma 1 espaco, entao a coluna do
// `->` e `5 + width + 1`. No bloco 1 a coluna acomoda os rotulos curtos e o
// rotulo longo do item 4 TRANSBORDA com um espaco (padEnd nunca trunca); no
// bloco 2 a coluna acomoda `Vue (default)`. E layout de produto, nao constante
// derivavel do conteudo — por isso vem declarado, nunca inferido.
export const WIZARD_MENU_WIDTH = 18;
export const WIZARD_MENU_FRONTEND_WIDTH = 15;

// Linha de um item do menu: `  <key>) <label> -> stack <preset>`, com o rotulo
// alinhado na coluna do bloco (`padEnd`); o item que encadeia o passo seguinte
// mostra `-> segue: <passo>` (ADR-004 §2).
export function menuItemLine(item, width = 0) {
  const extra = item.note ? ` (${item.note})` : '';
  const anchor = item.next ? `segue: ${item.next}` : `stack ${item.stack}`;
  return `  ${item.key}) ${String(item.label).padEnd(width)} -> ${anchor}${extra}`;
}

// Numeros aceitos por um menu de N itens (`1, 2, 3, 4 ou 5`) para a mensagem de
// erro — DERIVADO do total (A4/RF-05), nunca literal.
export function menuChoices(count) {
  const keys = Array.from({ length: count }, (_, i) => String(i + 1));
  if (keys.length === 0) return '';
  if (keys.length === 1) return keys[0];
  return `${keys.slice(0, -1).join(', ')} ou ${keys[keys.length - 1]}`;
}

// Marcador do BLOCO W2m (o texto tambem aparece no comentario do bloco em
// `runWizard`): a 4a linha do bloco de erro aponta `arquivo:linha` DESSE bloco
// (ADR-004 §5). A declaracao da constante carrega o literal apenas como dado de
// busca — `sourceLineOf` resolve para a ULTIMA ocorrencia, isto e, para o bloco.
export const W2M_MARKER = 'W2m menu manual em 2 passos (ADR-004/D-A)';

export function sourceLineOf(marker, file = import.meta.url) {
  try {
    const text = fs.readFileSync(new URL(file), 'utf8');
    // findLastIndex: a ocorrencia UTIL e a do bloco em runWizard, nunca a da
    // declaracao desta constante (uma ancora que aponta para a propria
    // declaracao nao ancora nada).
    const idx = text.split('\n').findLastIndex((l) => l.includes(marker));
    return idx >= 0 ? idx + 1 : null;
  } catch {
    return null;
  }
}

function w2mErrorWhere(step) {
  const line = sourceLineOf(W2M_MARKER);
  return line ? `installer/install.mjs:${line} (W2m-${step})` : `installer/install.mjs (W2m-${step})`;
}

// Um passo do menu W2m (ADR-004 §2/§5): cabecalho, itens (range DERIVADO de
// `items.length`), prompt com contador `[passo/total]`, `(default: N)` quando ha
// default e `(q cancela)`. Entrada invalida => bloco de 4 linhas e REPETE o
// MESMO passo; `q`/sinonimos abortam dentro do `read` (0 writes). Exportado para
// o teste do item sintetico (EX-FE-07 Scenario 2) sem tocar no menu real.
export async function askMenuStep({ read, out, answers = {}, header, items, step, total, defaultKey = null, width = 0 }) {
  out(header);
  for (const item of items) out(menuItemLine(item, width));
  const range = `1-${items.length}`;
  const shownDefault = defaultKey ? ` (default: ${defaultKey})` : '';
  const prompt = `[${step}/${total}] escolha [${range}]${shownDefault} (q cancela) > `;
  for (;;) {
    const raw = (await read(prompt)).trim();
    if (raw === '' && defaultKey) {
      const fallback = items.find((i) => i.key === defaultKey);
      if (fallback) return fallback;
    }
    const hit = items.find((i) => i.key === raw);
    if (hit) return hit;
    out(formatError({
      what: `opcao '${raw}' invalida — digite ${menuChoices(items.length)} (ou 'q' para cancelar).`,
      code: 'BAD_ANSWER',
      why: `fora de [${range.replace('-', ',')}]`,
      // Linha 3 em LINGUAGEM DE PRODUTO (nunca `howToFix('stack')`, que vazava
      // `flutter|dart|node|java+vue|outra`) — parecer UX, defeito 4 (ADR-004 §5).
      fix: 'escolha o numero de um dos itens listados acima (ou q para cancelar).',
      where: w2mErrorWhere(step),
    }, answers));
  }
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

// Candidatos por eixo (RF-07): o par react precisa de default — sem ele o
// usuario digita o comando sem sugestao (default ''). Nunca retorna '' quando
// ha candidatos; o primeiro vence se nenhum resolver no PATH.
export function defaultSuiteFor(stack) {
  const profile = profileOf(stack);
  const frontendAxis = profile ? profile.axes.frontend : null;
  const candidates = stack === 'flutter'
    ? ['flutter test', 'make test', 'dart test']
    : stack === 'dart'
      ? ['dart test', 'make test']
      : stack === 'node' || stack === 'node-esm'
        ? ['node --test']
        : frontendAxis === 'react'
          ? ['npm run test:run', 'npm test']
          : [];
  for (const c of candidates) if (commandResolves(c)) return c;
  return candidates.length > 0 ? candidates[0] : '';
}

export function howToFix(key) {
  switch (key) {
    case 'project': return 'informe um nome nao-vazio.';
    case 'stack': return `use ${STACK_VALUES.join('|')}; flutter/dart exigem pubspec.yaml.`;
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
  // MUSTFIX-3: vigentes definidos antes do sink; out() redige toda linha com
  // answers (sink sem sanitizacao = defeito). formatError ja redige; out
  // redige de novo (idempotente, defesa em profundidade).
  const answers = {};
  const out = (s) => { try { stdout.write(`${sanitizeLog(String(s), answers)}\n`); } catch { /* stream opcional */ } };
  const interactive = Boolean(stdin && stdin.isTTY);
  // G6: edicao de linha so quando ha TTY real; pipe/redirect = terminal:false.
  let r = createLineReader({ input: stdin, output: stdout, terminal: interactive });
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
    out('[OK] W0: pico-fim');

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

    // W2m menu manual em 2 passos (ADR-004/D-A), apenas sem pubspec:
    //   passo 1 = tipo de projeto (WIZARD_MENU, ordem/numeracao 1..5 intactas);
    //   passo 2 = frontend (WIZARD_MENU_FRONTEND), SOMENTE quando o item
    //   escolhido encadeia (`next`) — dado declarado, nunca nome inferido.
    // Range DERIVADO de `items.length` no prompt e no erro (A4/RF-05); o total e
    // derivado do menu (ha passo 2 quando algum item encadeia). node-esm segue
    // digitavel em W3/validateAnswer, sem item proprio (I10).
    let menuStack = null;
    if (!det.hasPubspec) {
      const menuTotal = WIZARD_MENU.some((m) => m.next) ? 2 : 1;
      const picked = await askMenuStep({
        read,
        out,
        answers,
        step: 1,
        total: menuTotal,
        header: '[INFO] W2m tipo de projeto — escolha o tipo do seu projeto:',
        items: WIZARD_MENU,
        width: WIZARD_MENU_WIDTH,
      });
      if (picked.next) {
        const front = await askMenuStep({
          read,
          out,
          answers,
          step: 2,
          total: menuTotal,
          header: '[INFO] W2m frontend — qual o frontend do seu projeto web:',
          items: WIZARD_MENU_FRONTEND,
          defaultKey: WIZARD_MENU_FRONTEND_DEFAULT,
          width: WIZARD_MENU_FRONTEND_WIDTH,
        });
        menuStack = front.stack;
      } else {
        menuStack = picked.stack;
      }
    }

    // W3 Q&A guiado, com default detectado e validacao por validateAnswer.
    // (answers vem do topo do wizard — MUSTFIX-3 — para o sink out() redigir.)
    const defaults = {
      project: det.name || '',
      stack: det.suggestedStack || menuStack || '',
      suiteCommand: defaultSuiteFor(det.suggestedStack || menuStack || ''),
      pluginsDir: pf.target,
      deployToken: '',
    };
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
        const label = `[${i + 1}/${QUESTIONS.length}] ${q.prompt}${shown} (q cancela)`;
        let raw;
        if (q.secret && canNoEcho(stdin)) {
          // FU-27: token sem eco; readline fechado e recriado para nao enfilar
          // o segredo como resposta da proxima pergunta.
          r.close();
          const secret = await readSecretPrompt({ input: stdin, output: stdout, prompt: label });
          r = createLineReader({ input: stdin, output: stdout, terminal: interactive });
          raw = secret;
          // REQ-11 (INS-16): q vale em qualquer pergunta, inclusive segredo TTY.
          if (isAbortToken(raw)) {
            throw new InstallError('cancelado pelo usuario no wizard. Abortando sem escrever nada.', 'USER_ABORT');
          }
        } else {
          raw = await read(label);
        }
        const value = raw === '' ? def : raw;
        if (q.secret && value === '') { answers[q.key] = ''; break; }
        try {
          answers[q.key] = validateAnswer(pf.target, q.key, value);
          out(`  [OK] ${q.key} = ${q.secret && answers[q.key] !== '' ? '[REDACTED]' : answers[q.key]}`);
          break;
        } catch (e) {
          out(formatError({ what: `resposta invalida para '${q.key}': ${e.message}`, code: e.code || 'BAD_ANSWER', fix: howToFix(q.key), where: 'installer/install.mjs (runWizard W3)' }, { ...answers, [q.key]: value }));
        }
      }
    }

    // W4 resumo + previa. O plano reusa planMerge sobre o incoming filtrado;
    // harness.config.json entra como placeholder (a acao dele independe do
    // conteudo) — assim o wizard NAO chama generateConfig.
    const profile = profileOf(answers.stack);
    const stacks = profile ? profile.stacks : [answers.stack];
    const incomingFiles = collectIncoming(sourceDir, { stacks, stack: answers.stack ?? null });
    const plan = planMerge(pf.target, { ...incomingFiles, 'harness.config.json': '' });
    out('[INFO] W4 resumo das respostas (segredos omitidos):');
    out(`  ${JSON.stringify(serializeAnswers(answers))}`);
    out('[INFO] W4 previa do plano (reusa printPlan):');
    printPlan(plan, { output: stdout, answers });

    // REQ-10 (INS-15): gate create-only pos-W4, pre-W5 (antes de qualquer
    // write). So create|generate-overwrite|noop passam; merge|flag abortam
    // com bloco citando doctor D0-D6. Display aqui; assertCreateOnly e puro.
    if (options.createOnly === true) {
      try {
        assertCreateOnly(plan);
      } catch (e) {
        if (e instanceof InstallError) {
          try {
            out(formatError({
              what: 'init abortado: destino nao esta limpo (create-only)',
              code: e.code,
              why: e.message,
              fix: 'rode doctor --target <dir> para diagnosticar (D0-D6), ou limpe o destino e rode init de novo.',
              where: 'installer/install.mjs (runWizard gate create-only; doctor D0-D6)',
            }, answers));
          } catch { /* bloco best-effort */ }
        }
        throw e;
      }
    }

    // W5 confirmacao por camada (reusa confirmByLayer, mesmo leitor/stream).
    if (options.dryRun) {
      out('[INFO] W5 dry-run: confirmacao por camada dispensada (nada sera aplicado).');
    } else {
      out('[INFO] W5 confirmacao por camada:');
      await confirmByLayer(plan, { input: stdin, output: stdout, yes: options.yes === true, reader: r });
    }

    // W6/W7: DELEGADOS. O wizard nao escreve; `apply` (CLI) aplica + manifesta.
    if (typeof apply !== 'function' || options.dryRun) {
      if (options.dryRun) out(dryRunNotice());
      out(`[INFO] W6/W7 nao executados pelo wizard (apply=${typeof apply === 'function' ? 'dry-run' : 'ausente'}); nenhum write.`);
      return { answers, profile: answers.stack, plan, applied: false, detection: det, inventory: inv };
    }
    const steps = plan.filter((p) => p.action !== 'noop' && p.action !== 'flag');
    const total = steps.length;
    out('[INFO] W6 backup + aplicacao:');
    steps.forEach((s, i) => out(`  [${i + 1}/${total}] ${s.action} ${s.path}`));
    const result = await apply({ answers, profile: answers.stack, plan, target: pf.target });
    out('[OK] apply: pico-fim');
    out('[INFO] W7 manifesto + checks:');
    const manifestPath = result && result.manifestRef && result.manifestRef.path ? result.manifestRef.path : '(dry-run)';
    out(`  [OK] manifesto: ${manifestPath}`);
    const checksOk = Boolean(result && result.checks && result.checks.passed);
    out(`  [${checksOk ? 'OK' : 'ERRO'}] checks: ${checksOk ? 'PASS' : `FAIL ${JSON.stringify(result && result.checks ? result.checks.failed : [])}`}`);
    if (checksOk) out('[OK] checks: pico-fim');
    return { answers, profile: answers.stack, plan, applied: true, result, detection: det, inventory: inv };
  } catch (e) {
    // MUSTFIX-4: NO_STDIN/USER_ABORT/CORRUPT saem em bloco 4-linhas (SPEC §9.2)
    // com vigentes; rethrow preserva code (contrato wizard.spec) com message
    // sanitizada (H1). Outros erros passam sem display (sem sink novo).
    if (e instanceof InstallError && (e.code === 'NO_STDIN' || e.code === 'USER_ABORT' || e.code === 'CORRUPT')) {
      const what = e.code === 'USER_ABORT'
        ? 'instalacao cancelada pelo usuario no wizard'
        : e.code === 'NO_STDIN'
          ? 'entrada indisponivel no wizard'
          : 'configuracao corrompida no destino';
      const fix = e.code === 'USER_ABORT'
        ? 'operacao cancelada; nenhum write foi feito.'
        : e.code === 'NO_STDIN'
          ? 'rode interativo ou passe --answers-file <json>.'
          : 'corrija o JSON apontado e rode de novo.';
      try { out(formatError({ what, code: e.code, why: e.message, fix, where: 'installer/install.mjs (runWizard)' }, answers)); } catch { /* bloco best-effort */ }
      try { e.message = sanitizeLog(String(e.message), answers); } catch { /* message ja segura */ }
    }
    throw e;
  } finally {
    r.close();
  }
}

export function printUsage({ output = process.stdout } = {}) {
  output.write(`uso: node installer/install.mjs init   --target <dir> [--dry-run] [--answers-file <json>] [--yes] [--backup-dir <dir>] [--allow-root]\n`);
  output.write(`uso: node installer/install.mjs doctor   --target <dir> [--answers-file <json>] [--backup-dir <dir>] [--allow-root]\n`);
output.write(`uso: node installer/install.mjs upgrade --target <dir> [--dry-run] [--answers-file <json>] [--yes] [--backup-dir <dir>] [--allow-root]\n`);
  output.write(`  init: greenfield create-only — so create|generate-overwrite|noop passam; merge|flag abortam com dica de doctor.\n`);
  output.write(`  doctor: brownfield read-only — D0-D6 diagnostico, zero writes; ignora --dry-run/--yes.\n`);
output.write(`  upgrade: sobrescreve camadas gerenciadas pela versao atual do harness; backup automatico antes de escrever; idempotente; exige manifesto proprio.\n`);
  output.write(`  sem --answers-file exige stdin interativo ou pipado; stdin fechado aborta sem escrever.\n`);
  output.write(`  --dry-run: zero writes (nem backup cria); imprime plano + relatorio.\n`);
  output.write(`  legado (sem init|doctor): node installer/install.mjs --target <dir> [--dry-run] [--answers-file <json>] [--yes] [--backup-dir <dir>] [--allow-root]\n`);
}

// ---------- init greenfield create-only W0-W7 (REQ-09/INS-14) ----------
// Caminho limpo de instalacao: reaproveita o wizard W0-W7 (runWizard) com o
// gate create-only ligado (options.createOnly) e o apply conectado ao main()
// — que verifica o backup antes de qualquer write (requireVerifiedBackup).
// Com --answers-file, o W3 e scriptado (validate + gate + confirm + main) sem
// stdin. Retorna exitCode 0 no sucesso; aborts jogam InstallError (exit 1 no
// CLI). Sem sink sem sanitizacao: todo display passa por answers vigentes.
export async function runInit({
  target,
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  sourceDir = INSTALLER_ROOT,
  answersFile = null,
  options = {},
} = {}) {
  const answers = {};
  const allowRoot = options.allowRoot === true;
  const backupRoot = options.backupDir || undefined;
  const say = (s) => { try { stdout.write(`${sanitizeLog(String(s), answers)}\n`); } catch { /* stream opcional */ } };
  try {
    if (options.backupDir) resolveBackupDir(target, options.backupDir);
    if (answersFile) {
      // W0 pre-flight (aborta sem escrever).
      const pf = preflight({ target, allowRoot });
      say(`[OK] W0 pre-flight: target=${pf.target} node=${process.version}`);
      say('[OK] W0: pico-fim');
      // W1/W2 somente leitura (relato).
      const inv = inventory(pf.target);
      say('[INFO] W1 inventario do destino:');
      for (const l of inv.layers) {
        say(`  [${l.present ? 'OK' : 'AVISO'}] ${l.layer}${l.present ? ' presente' : ' ausente'}`);
      }
      const det = detect(pf.target);
      say(`[INFO] W2 deteccao: ${det.hasPubspec ? `sugestao ${det.suggestedStack}` : 'sem pubspec (answers-file supre o W2m/W3)'}`);
      // W3 scriptado.
      const rawFile = loadAnswersFile(answersFile);
      Object.assign(answers, rawFile);
      const scripted = collectAnswers(pf.target, rawFile);
      Object.assign(answers, scripted);
      // W4 previa + gate create-only (antes de qualquer write).
      const profile = profileOf(scripted.stack);
      const incomingFiles = collectIncoming(sourceDir, { stacks: profile ? profile.stacks : [scripted.stack], stack: scripted.stack ?? null });
      const generated = JSON.stringify(generateConfig(scripted, { writtenPaths: writtenPathsOf(incomingFiles) }), null, 2);
      const plan = planMerge(pf.target, { ...incomingFiles, 'harness.config.json': generated });
      say('[INFO] W4 previa do plano (init create-only):');
      printPlan(plan, { output: stdout, answers });
      try {
        assertCreateOnly(plan);
      } catch (e) {
        if (e instanceof InstallError) {
          try {
            say(formatError({
              what: 'init abortado: destino nao esta limpo (create-only)',
              code: e.code,
              why: e.message,
              fix: 'rode doctor --target <dir> para diagnosticar (D0-D6), ou limpe o destino e rode init de novo.',
              where: 'installer/install.mjs (runInit gate create-only; doctor D0-D6)',
            }, answers));
          } catch { /* bloco best-effort */ }
        }
        throw e;
      }
      // W5 confirmacao por camada (dispensada em dry-run).
      if (options.dryRun) {
        say('[INFO] W5 dry-run: confirmacao por camada dispensada (nada sera aplicado).');
        say(dryRunNotice());
        return { target: pf.target, answers: serializeAnswers(scripted), plan, applied: false, dryRun: true, checks: { passed: null, failed: [], ran: false, skipped: true, reason: 'dry-run: checks nao executados' }, backupDir: null, exitCode: 0 };
      }
      if (options.yes !== true) {
        await confirmByLayer(plan, { input: stdin, output: stdout });
      }
      // W6/W7 via main (backup verificado antes de qualquer write).
      const result = main({ target: pf.target, scriptedAnswers: scripted, incomingFiles, options: { allowRoot, dryRun: false, backupRoot } });
      say('[OK] apply: pico-fim');
      say('[INFO] W7 manifesto + checks:');
      say(`  [OK] manifesto: ${result.manifestRef.path || '(sem manifesto?)'}`);
      say(`  [${result.checks.passed ? 'OK' : 'ERRO'}] checks: ${result.checks.passed ? 'PASS' : `FAIL ${JSON.stringify(result.checks.failed)}`}`);
      if (result.checks.passed) say('[OK] checks: pico-fim');
      if (result.checks.passed) say('[OK] init: pico-fim');
      else say('[ERRO] init: FAIL checks reprovaram (sem pico-fim)');
      return { target: result.target, answers: serializeAnswers(scripted), plan, applied: true, result, checks: result.checks, manifestRef: result.manifestRef, backupDir: result.backup.backupDir, exitCode: result.checks.passed ? 0 : 1 };
    }
    // Interativo: wizard W0-W7 com gate create-only + apply no main().
    const w = await runWizard({
      target,
      stdin,
      stdout,
      sourceDir,
      options: { allowRoot, yes: options.yes === true, dryRun: options.dryRun === true, createOnly: true },
      apply: ({ answers: wa, target: wt }) => {
        const prof = profileOf(wa.stack);
        const files = collectIncoming(sourceDir, { stacks: prof ? prof.stacks : [wa.stack], stack: wa.stack ?? null });
        return main({ target: wt, scriptedAnswers: wa, incomingFiles: files, options: { allowRoot, dryRun: false, backupRoot } });
      },
    });
    if (!w.applied) {
      return { target: w.target || path.resolve(target), answers: w.answers, plan: w.plan, applied: false, dryRun: true, checks: { passed: null, failed: [], ran: false, skipped: true, reason: 'dry-run: checks nao executados' }, backupDir: null, exitCode: 0 };
    }
    Object.assign(answers, w.answers);
    if (w.result && w.result.checks && w.result.checks.passed) say('[OK] init: pico-fim');
    else say('[ERRO] init: FAIL checks reprovaram (sem pico-fim)');
    return { target: w.result.target, answers: w.answers, plan: w.plan, applied: true, result: w.result, checks: w.result.checks, manifestRef: w.result.manifestRef, backupDir: w.result.backup.backupDir, exitCode: w.result.checks && w.result.checks.passed ? 0 : 1 };
  } catch (e) {
    // Display fica com o chamador (runCli imprime o bloco); aqui so redige a
    // mensagem relancada (invariante: erro nunca carrega segredo em claro).
    if (e instanceof InstallError) {
      try { e.message = sanitizeLog(String(e.message), answers); } catch { /* message ja segura */ }
    }
    throw e;
  }
}

const INSTALLER_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// MUSTFIX-2: ultimos vigentes conhecidos pelo CLI; o catch top-level do
// processo sanitiza com eles (sem sink sem sanitizacao). Espelho de
// currentAnswers do runCli (ver atribuicoes abaixo).
let lastCliAnswers = {};
export function getLastCliAnswers() {
  return lastCliAnswers;
}

export async function runCli({ argv = [], stdin = process.stdin, stdout = process.stdout, stderr = process.stderr, sourceDir = INSTALLER_ROOT } = {}) {
  const args = parseArgs(argv);
  // SPEC §9.5 (INS-19): help puro imprime o uso e sai 0, mesmo sem --target.
  if (args.help) {
    printUsage({ output: stdout });
    return { help: true };
  }
  let currentAnswers = {};
  const err = (s) => stderr.write(`${sanitizeLog(String(s), currentAnswers)}\n`);
  const log = (s) => stdout.write(`${sanitizeLog(String(s), currentAnswers)}\n`);
  try {
  // SPEC §9.5 (INS-19): dispatch init|doctor; sem posicional segue o legado.
  if (!args.target) throw new InstallError('missing --target', 'BAD_TARGET');
  if (args.command === 'doctor') {
    // REQ-13 (INS-12): read-only por construcao — --dry-run/--yes sem efeito.
    const rep = runDoctor({
      target: args.target,
      sourceDir,
      answersFile: args.answersFile,
      backupDir: args.backupDir,
      allowRoot: args.allowRoot,
      output: stdout,
    });
    if (rep.exitCode !== 0) {
      throw new InstallError(`doctor: veredito ${rep.verdict} — ${rep.report.next}`, 'flagged-open');
    }
    return rep;
  }
  if (args.command === 'init') {
    const res = await runInit({
      target: args.target,
      stdin,
      stdout,
      stderr,
      sourceDir,
      answersFile: args.answersFile,
      options: { allowRoot: args.allowRoot, yes: args.yes, dryRun: args.dryRun, backupDir: args.backupDir },
    });
    currentAnswers = res.answers || {};
    lastCliAnswers = currentAnswers;
    return res;
  }
  if (args.command === 'upgrade') {
    const res = await runUpgrade({
      target: args.target, stdin, stdout, stderr, sourceDir,
      answersFile: args.answersFile,
      options: { allowRoot: args.allowRoot, yes: args.yes, dryRun: args.dryRun, backupDir: args.backupDir },
    });
    currentAnswers = res.answers || {};
    lastCliAnswers = currentAnswers;
    if (res.applied === false) {
      log(`dry-run: zero writes; plano=${res.plan.length} itens.`);
      return res;
    }
    log(`upgrade aplicado em ${res.target}: checks ${res.checks && res.checks.passed ? 'PASS' : 'FAIL'}`);
    log(`checks: ${res.checks && res.checks.passed ? 'PASS' : `FAIL ${JSON.stringify(res.checks && res.checks.failed)}`}`);
    return res;
  }
  const pf = preflight({ target: args.target, allowRoot: args.allowRoot });
  // TTY interativo => wizard B2 (ADR-010). --answers-file / pipe / redirect
  // seguem os caminhos v1 inalterados (retrocompat G6).
  if (!args.answersFile && stdin && stdin.isTTY) {
    const incomingOf = (stack) => {
      const profile = profileOf(stack);
      return collectIncoming(sourceDir, { stacks: profile ? profile.stacks : [stack], stack });
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
      currentAnswers = w.answers || {};
      lastCliAnswers = currentAnswers;
      const out = main({
        target: pf.target,
        scriptedAnswers: w.answers,
        incomingFiles: incomingOf(w.answers.stack),
        options: { allowRoot: args.allowRoot, dryRun: true },
      });
      log(`${dryRunNotice()}: ${out.plan.length} itens no plano, zero writes.`);
      return out;
    }
    log(`instalado em ${pf.target}: ${w.result.manifestRef.path || 'sem manifesto?'}`);
    log(`checks: ${w.result.checks.passed ? 'PASS' : `FAIL ${JSON.stringify(w.result.checks.failed)}`}`);
    return w.result;
  }
  let scripted;
  if (args.answersFile) {
    // MUSTFIX-2: best-effort — vigentes do arquivo ANTES de validar, para o
    // catch sanitizar mesmo quando collectAnswers rejeita (ex.: canario no
    // proprio valor que causou o erro).
    const rawFile = loadAnswersFile(args.answersFile);
    currentAnswers = { ...(rawFile || {}) };
    lastCliAnswers = currentAnswers;
    scripted = collectAnswers(pf.target, rawFile);
  } else {
    const kind = stdinKindOf(stdin);
    const src = resolveAnswerSource({ stdinIsTTY: Boolean(stdin && stdin.isTTY), stdinKind: kind, answersFile: null });
    if (src.mode !== 'prompt') throw new InstallError('fonte de respostas indisponivel', 'NO_STDIN');
    scripted = await promptAnswers(pf.target, { input: stdin, output: stdout });
  }
  currentAnswers = scripted || {};
  lastCliAnswers = currentAnswers;
  const profile = profileOf(scripted.stack);
  const incomingFiles = collectIncoming(sourceDir, { stacks: profile ? profile.stacks : [scripted.stack], stack: scripted.stack ?? null });
  const generated = JSON.stringify(generateConfig(scripted, { writtenPaths: writtenPathsOf(incomingFiles) }), null, 2);
  const preview = planMerge(pf.target, { ...incomingFiles, 'harness.config.json': generated });
  printPlan(preview, { output: stdout, answers: scripted });
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
    log(`${dryRunNotice()}: ${out.plan.length} itens no plano, zero writes.`);
  } else {
    log(`instalado em ${out.target}: ${out.manifestRef.path || 'sem manifesto?'}`);
    log(`checks: ${out.checks.passed ? 'PASS' : `FAIL ${JSON.stringify(out.checks.failed)}`}`);
  }
  return out;
  } catch (e) {
    // MUSTFIX-2/4: display em bloco 4-linhas com vigentes + erro sanitizado no
    // rethrow (invariante: top-level nunca ve segredo em claro). Cobre
    // NO_STDIN/USER_ABORT/CORRUPT/BAD_ANSWER de qualquer fonte (wizard,
    // promptAnswers, planMerge, checks). Code preservado (contrato cli.spec).
    if (e instanceof InstallError) {
      try { err(formatError({ what: 'falha na instalacao', code: e.code, why: e.message, fix: howToFix(''), where: 'installer/install.mjs (runCli)' }, currentAnswers)); } catch { /* bloco best-effort */ }
      try { e.message = sanitizeLog(String(e.message), currentAnswers); } catch { /* message ja segura */ }
    }
    throw e;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let a;
  try {
    a = parseArgs(process.argv.slice(2));
  } catch (e) {
    // SPEC §9.5 (INS-19): posicional desconhecido aborta com bloco, exit 1.
    let msg = '';
    try {
      msg = formatError({ what: 'falha na instalacao', code: e instanceof InstallError ? e.code : 'BAD_ANSWER', why: e instanceof Error ? e.message : String(e), fix: howToFix(''), where: 'installer/install.mjs (parseArgs)' }, lastCliAnswers);
      msg = sanitizeLog(msg, lastCliAnswers);
    } catch { /* bloco best-effort */ }
    process.stderr.write(`${msg || 'abort: comando invalido'}\n`);
    process.exit(1);
  }
  if (!a.target && (a.help || process.argv.length <= 2)) {
    printUsage({});
    process.exit(a.help ? 0 : 1);
  }
  runCli({ argv: process.argv.slice(2) }).then(
    (res) => process.exit(res && typeof res.exitCode === 'number' ? res.exitCode : 0),
    (e) => {
      // MUSTFIX-2: top-level sanitiza com os ultimos vigentes conhecidos
      // (lastCliAnswers); runCli ja sanitiza e.message no rethrow — aqui e
      // defesa em profundidade (sink sem sanitizacao = defeito).
      const raw = e && e.code === 'NO_STDIN' ? String(e.message) : `abort: ${e && e.message ? e.message : e}`;
      let safe = raw;
      try { safe = sanitizeLog(raw, lastCliAnswers); } catch { /* raw ja seguro */ }
      process.stderr.write(`${safe}\n`);
      process.exit(1);
    },
  );
}

// ---------- upgrade: overwrite gerenciado (feature installer-upgrade) ----------
// Overwrite SEM merge: toda camada gerenciada trocada pela versao atual do
// harness. Sem remoção automatica de user-owned; backup verificado antes de
// toda escrita; dry-run sem writes.

export function planUpgrade(target, incomingFiles) {
  const t = path.resolve(target);
  const plan = [];
  for (const [rel, content] of Object.entries(incomingFiles)) {
    assertInside(t, path.join(t, rel));
    const layer = layerOf(rel);
    const abs = path.join(t, rel);
    const exists = fs.existsSync(abs);
    if (layer === 'harness.config.json') {
      if (!exists) { plan.push({ path: rel, layer, action: 'create', reason: 'generated from Q&A (ADR-002)' }); continue; }
      let current;
      try { current = fs.readFileSync(abs, 'utf8'); } catch { current = '__unreadable__'; }
      if (current === content) { plan.push({ path: rel, layer, action: 'noop', reason: 'identical' }); continue; }
      plan.push({ path: rel, layer, action: 'generate-overwrite', reason: 'managed overwrite (upgrade)' });
      continue;
    }
    if (!exists) { plan.push({ path: rel, layer, action: 'create', reason: 'incoming-new' }); continue; }
    let current = '';
    try { current = fs.readFileSync(abs, 'utf8'); } catch { current = null; }
    if (current === content) { plan.push({ path: rel, layer, action: 'noop', reason: 'identical' }); continue; }
    plan.push({ path: rel, layer, action: 'overwrite', reason: 'managed overwrite (upgrade)' });
  }
  return plan;
}

export function applyUpgrade(target, plan, { incomingFiles = {}, dryRun = false } = {}) {
  const t = path.resolve(target);
  const written = [];
  const flagged = [];
  if (dryRun) return { written, flagged: plan.filter((p) => p.action === 'flag'), planned: plan.length };
  for (const step of plan) {
    const abs = assertInside(t, path.join(t, step.path));
    if (step.action === 'noop') continue;
    if (step.action === 'flag') { flagged.push(step); continue; }
    const incoming = incomingFiles[step.path];
    if (typeof incoming !== 'string') {
      throw new InstallError(`missing incoming content for ${step.path}: refusing silent empty write (FU-21)`, 'MISSING_INCOMING');
    }
    const pre = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, incoming);
    written.push({ path: step.path, strategy: step.action, preMergeSha256: pre ? sha256(pre) : undefined });
  }
  return { written, flagged };
}

export async function runUpgrade({
  target, stdin = process.stdin, stdout = process.stdout, stderr = process.stderr,
  sourceDir = INSTALLER_ROOT, answersFile = null, options = {},
} = {}) {
  const answers = {};
  const allowRoot = options.allowRoot === true;
  const backupRoot = options.backupDir || undefined;
  const say = (s) => { try { stdout.write(`${sanitizeLog(String(s), answers)}\n`); } catch { /* stream opcional */ } };
  try {
    const pf = preflight({ target, allowRoot, skipManifestGuard: true });
    const manifestPath = path.join(pf.target, MANIFEST_NAME);
    let prevManifest = null;
    if (!fs.existsSync(manifestPath)) throw new InstallError('upgrade requires prior installation (.harness-install.json missing); run init first', 'NOT_INSTALLED');
    try { prevManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
    catch { throw new InstallError(`manifesto ilegivel: ${manifestPath}`, 'MANIFEST_INVALID'); }
    if (!prevManifest || prevManifest.manifestSchemaVersion !== 1 || typeof prevManifest.source !== 'string') {
      throw new InstallError('manifesto estrangeiro: nao e do harness-installer', 'FOREIGN_MANIFEST');
    }
    // W6: doctor pre-execucao (read-only).
    Object.assign(answers, prevManifest.answers || {});
    const report = runDoctor({ target: pf.target, sourceDir, answersFile, backupDir: backupRoot, allowRoot, output: stdout });
    say(`[INFO] upgrade: doctor veredito ${report.verdict}`);

    if (answersFile) {
      const rawFile = loadAnswersFile(answersFile);
      Object.assign(answers, rawFile);
    }
    const subjectAnswers = collectAnswers(pf.target, answers);
    Object.assign(answers, subjectAnswers);

    const profile = profileOf(subjectAnswers.stack);
    const incomingFiles = collectIncoming(sourceDir, { stacks: profile ? profile.stacks : [subjectAnswers.stack], stack: subjectAnswers.stack ?? null });
    const generated = JSON.stringify(generateConfig(subjectAnswers, { writtenPaths: writtenPathsOf(incomingFiles) }), null, 2);
    const incoming = { ...incomingFiles, 'harness.config.json': generated };

    const plan = planUpgrade(pf.target, incoming);
    say(`[INFO] upgrade: plano gerado (${plan.length} itens)`);
    printPlan(plan, { output: stdout, answers });

    if (options.dryRun === true) {
      say(`[INFO] upgrade dry-run: zero writes. plano=${plan.length} itens`);
      return { target: pf.target, answers: serializeAnswers(subjectAnswers), plan, applied: false, dryRun: true, checks: { passed: null, failed: [], ran: false, skipped: true, reason: 'dry-run: checks nao executados' }, backupDir: null, exitCode: 0 };
    }

    if (options.yes !== true) await confirmByLayer(plan, { input: stdin, output: stdout });

    // Backup verificado antes de qualquer write (I1/FU-20).
    const bk = backup(pf.target, { backupRoot, injectFailure: options.injectFailure === true });
    requireVerifiedBackup(bk);
    const result = applyUpgrade(pf.target, plan, { incomingFiles: incoming, dryRun: false });
    const written = result.written || [];
    const fileContents = {};
    for (const w of written) { try { fileContents[w.path] = fs.readFileSync(path.join(pf.target, w.path), 'utf8'); } catch { /* noop */ } }
    const installed = written.filter((w) => w.strategy === 'create' || w.strategy === 'generate-overwrite' || w.strategy === 'overwrite').map((w) => ({ path: w.path, kind: 'file' }));
    const manifest = buildManifest({
      target: pf.target, backupDir: bk.backupDir, installed, merged: [], flagged: result.flagged || [],
      answers: subjectAnswers, checks: { passed: true, failed: [] }, fileContents, source: `harness@${VERSION}`,
    });
    manifest.upgradedFrom = prevManifest.source || null;
    manifest.removed = [];
    manifest.collisions = [];
    manifest.doctorPre = { verdict: report.verdict, next: report.next };
    const manifestRef = writeManifest(pf.target, manifest);
    const checks = runChecks(pf.target, { manifest, answers: subjectAnswers });
    manifest.checks = checks;
    fs.writeFileSync(path.join(pf.target, MANIFEST_NAME), JSON.stringify(manifest, null, 2));
    say(`[OK] upgrade: aplicado; checks ${checks.passed ? 'PASS' : 'FAIL'}`);
    return { target: pf.target, answers: serializeAnswers(subjectAnswers), plan, applied: true, result, checks, manifestRef, backupDir: bk.backupDir, exitCode: checks.passed ? 0 : 1 };
  } catch (e) {
    if (e instanceof InstallError) {
      try { e.message = sanitizeLog(String(e.message), answers); } catch { /* message ja segura */ }
    }
    throw e;
  }
}
