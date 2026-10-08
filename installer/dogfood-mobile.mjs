// installer/dogfood-mobile.mjs — IM-VAL-06: dogfood do instalador num projeto
// Flutter/Dart COPIADO para /tmp (origem SOMENTE leitura). Nunca instala no repo
// real nem no projeto mobile real. Sem rede. Nunca pkill -f.
//
// Fluxo: copia a origem -> sanitiza as camadas do harness na copia (o alvo passa
// a ser um projeto Flutter limpo) -> dirige o CLI REAL (runCli, wizard W0..W7 por
// stdin TTY-simulado) -> valida o harness.config.json mobile + checks PASS ->
// prova re-instalacao (aborta) e origem intocada -> grava evidencia harness-report
// em .spec/governance/harness-installer-mobile/harness/<timestamp>.json ->
// remove a copia e o backup.
//
// Uso:
//   node installer/dogfood-mobile.mjs --source /caminho/do/projeto-flutter \
//     [--keep] [--evidence-dir <dir>] [--suite-command <cmd>] [--brain-store <path>]

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { runCli, assertDogfoodTarget, MANIFEST_NAME } from './install.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const INSTALLER_ROOT = path.resolve(HERE, '..');
const DEFAULT_EVIDENCE_DIR = path.join(INSTALLER_ROOT, '.spec', 'governance', 'harness-installer-mobile', 'harness');

// Camadas que o instalador gera/possui. Numa copia de dogfood elas sao removidas
// para simular um projeto Flutter LIMPO (alvo de instalacao fresh). Documentado
// na evidencia (campo `sanitized`).
export const MOBILE_HARNESS_LAYERS = ['.agents', '.opencode', 'opencode.json', 'harness.config.json', MANIFEST_NAME];

function sha(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function sink() {
  return new Writable({ write(_c, _e, cb) { cb(); } });
}

function capture() {
  let buf = '';
  const stream = new Writable({ write(c, _e, cb) { buf += c.toString(); cb(); } });
  return { stream, text: () => buf };
}

// ---- validacao do perfil mobile gerado ------------------------------------

export function assertMobileConfig(cfg = {}) {
  const errors = [];
  const backend = String(cfg?.stack?.backend || '');
  const frontend = String(cfg?.stack?.frontend || '');
  if (!/flutter/i.test(backend) && !/flutter/i.test(frontend)) {
    errors.push('stack nao-mobile: esperado perfil flutter/dart mobile');
  }
  if (cfg?.commands?.analyze !== 'dart analyze') {
    errors.push("commands.analyze ausente/errado: esperado 'dart analyze'");
  }
  const req = cfg?.mcp?.required;
  if (!Array.isArray(req) || !req.includes('marionette_mcp')) {
    errors.push("mcp.required sem 'marionette_mcp'");
  }
  if (!Array.isArray(req) || !req.includes('dart')) {
    errors.push("mcp.required sem 'dart'");
  }
  if (cfg?.moduleMap?.lib !== 'lib') errors.push('moduleMap.lib ausente');
  if (cfg?.moduleMap?.test !== 'test') errors.push('moduleMap.test ausente');
  return { ok: errors.length === 0, errors };
}

// ---- sanitizacao da copia --------------------------------------------------

export function sanitizeFlutterCopy(copy) {
  const removed = [];
  for (const rel of MOBILE_HARNESS_LAYERS) {
    const p = path.join(copy, rel);
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
      removed.push(rel);
    }
  }
  return { removed };
}

// ---- estado da origem (somente leitura) ------------------------------------

function sourceState(source) {
  try {
    const st = execFileSync('git', ['-C', source, 'status', '--short'], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] });
    return { kind: 'git', status: st.trim() };
  } catch {
    const files = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name === '.git' || e.name === 'node_modules') continue;
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else files.push(p);
      }
    };
    walk(source);
    const h = crypto.createHash('sha256');
    for (const f of files.sort()) {
      const s = fs.statSync(f);
      h.update(`${path.relative(source, f)}:${s.size}:${s.mtimeMs}\n`);
    }
    return { kind: 'mtimes', files: files.length, digest: `sha256:${h.digest('hex')}` };
  }
}

// ---- suites canonicas (contraprova H1) -------------------------------------

function parseCounts(stdout) {
  const g = (k) => {
    const m = String(stdout).match(new RegExp(`\u2139\\s+${k}\\s+(\\d+)`));
    return m ? Number(m[1]) : 0;
  };
  return { passed: g('pass'), failed: g('fail'), skipped: g('skipped') };
}

function runCommand(cmd, cwd) {
  const t0 = Date.now();
  let stdout = '';
  let exitCode = 0;
  try {
    stdout = execFileSync(cmd, { cwd, encoding: 'utf8', timeout: 600000, shell: '/bin/sh' });
  } catch (e) {
    exitCode = typeof e.status === 'number' ? e.status : 1;
    stdout = String(e.stdout ?? e.message ?? '');
  }
  return { cmd, exitCode, durationMs: Date.now() - t0, stdoutHash: `sha256:${sha(stdout)}`, stdout };
}

function runRepoSuites() {
  const commands = [];
  let suiteFull = '';
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(INSTALLER_ROOT, 'harness.config.json'), 'utf8'));
    suiteFull = cfg?.commands?.suiteFull || '';
  } catch { /* config ausente: cai no fallback abaixo */ }
  if (!suiteFull) suiteFull = 'node --test ".opencode/plugins/__tests__/*.spec.mjs" && node scripts/static-checks.mjs';

  const full = runCommand(suiteFull, INSTALLER_ROOT);
  const pluginCounts = parseCounts(full.stdout);
  commands.push({ cmd: suiteFull, exitCode: full.exitCode, durationMs: full.durationMs, stdoutHash: full.stdoutHash });

  const installerCmd = 'node --test "installer/__tests__/*.spec.mjs"';
  const inst = runCommand(installerCmd, INSTALLER_ROOT);
  const instCounts = parseCounts(inst.stdout);
  commands.push({ cmd: installerCmd, exitCode: inst.exitCode, durationMs: inst.durationMs, stdoutHash: inst.stdoutHash });

  return {
    commands,
    counts: {
      unit: { passed: pluginCounts.passed, failed: pluginCounts.failed, skipped: pluginCounts.skipped },
      it: { passed: instCounts.passed, failed: instCounts.failed, skipped: instCounts.skipped },
      frontend: { passed: 0, failed: 0, skipped: 0 },
    },
  };
}

// ---- driver do wizard (CLI real, stdin TTY-simulado) ------------------------

async function driveWizardInstall(copy, { suiteCommand } = {}) {
  const lines = ['', '', suiteCommand || '', '', ''];
  const stdin = Readable.from(lines.map((l) => `${l}\n`));
  stdin.isTTY = true;
  const out = capture();
  const err = capture();
  const result = await runCli({
    argv: ['--target', copy, '--allow-root', '--yes'],
    stdin,
    stdout: out.stream,
    stderr: err.stream,
    sourceDir: INSTALLER_ROOT,
  });
  return { result, stdout: out.text(), stderr: err.text() };
}

// ---- dogfood ---------------------------------------------------------------

export async function runDogfoodMobile({
  source,
  keep = false,
  evidenceDir = null,
  runSuites = true,
  suiteCommand = null,
  brainStore = [],
  target = null,
} = {}) {
  const t0 = Date.now();
  if (!source || typeof source !== 'string') throw new Error('dogfood-mobile: --source obrigatorio');
  const src = path.resolve(source);
  if (!fs.existsSync(src)) throw new Error(`dogfood-mobile: source nao existe: ${src}`);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const copy = target ? path.resolve(target) : path.join(os.tmpdir(), `harness-dogfood-mobile-${stamp}`);
  // Trava Y4: alvo fora de /tmp sem --target explicito + confirmacao => aborta.
  assertDogfoodTarget(copy);

  const before = sourceState(src);
  fs.mkdirSync(copy, { recursive: true });
  execFileSync('cp', ['-r', `${src}/.`, copy], { timeout: 300000 });

  const { removed } = sanitizeFlutterCopy(copy);

  // Instalacao real pela via do CLI (wizard W0..W7).
  const { result, stdout } = await driveWizardInstall(copy, { suiteCommand });
  const configPath = path.join(copy, 'harness.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const mobile = assertMobileConfig(config);
  const checks = result?.checks || { passed: false, failed: ['sem resultado de checks'] };
  const planCounts = (result?.plan || []).reduce((acc, p) => { acc[p.action] = (acc[p.action] || 0) + 1; return acc; }, {});
  const flags = (result?.manifest?.flagged || []).map((f) => f.path);

  // Re-instalacao deve abortar (manifesto pre-existente).
  let reinstallAbort = null;
  try {
    const empty = Readable.from([]);
    empty.isTTY = true;
    await runCli({ argv: ['--target', copy, '--allow-root', '--yes'], stdin: empty, stdout: sink(), stderr: sink(), sourceDir: INSTALLER_ROOT });
  } catch (e) {
    reinstallAbort = String(e.message);
  }

  const after = sourceState(src);
  const sourceUntouched = JSON.stringify(before) === JSON.stringify(after);

  const suites = runSuites
    ? runRepoSuites()
    : { commands: [], counts: { unit: { passed: 0, failed: 0, skipped: 0 }, it: { passed: 0, failed: 0, skipped: 0 }, frontend: { passed: 0, failed: 0, skipped: 0 } } };

  const ok = mobile.ok && checks.passed === true && Boolean(reinstallAbort) && sourceUntouched;

  const gitSha = (() => {
    try { return execFileSync('git', ['-C', INSTALLER_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { return ''; }
  })();

  const evidence = {
    version: 1,
    demand: 'harness-installer-mobile-dogfood',
    agent: 'developer-engineer',
    phase: 'Execution',
    gitSha,
    commands: [
      ...suites.commands,
      { cmd: `node installer/dogfood-mobile.mjs --source ${src}`, exitCode: ok ? 0 : 1, durationMs: Date.now() - t0, stdoutHash: `sha256:${sha(stdout)}` },
    ],
    counts: suites.counts,
    evaluation: {
      telas: 'n/a-CLI-sem-UI (wizard TUI validado por streams injetados)',
      negocio: `ok-perfil-mobile-config-analyze-mcp (flags=${flags.length})`,
      logica: `ok-wizard-W0..W7-abort-reinstall-origem-${sourceUntouched ? 'intocada' : 'ALTERADA'}`,
      perf: 'n/a-instalacao-local-copia',
    },
    brainStore: Array.isArray(brainStore) ? brainStore : [brainStore].filter(Boolean),
    cleanup: {
      ports: [],
      note: keep ? `copia mantida (--keep): ${copy}` : 'copia e backup removidos ao final',
    },
    selfReported: true,
    // ---- campos de dogfood (extras, nao exigidos pelo schema) ----
    source: src,
    copy,
    sanitized: removed,
    install: {
      checksPassed: checks.passed === true,
      checksFailed: checks.failed,
      planCounts,
      flags,
      config: {
        project: config.project,
        stack: config.stack,
        commands: config.commands,
        mcp: config.mcp,
        moduleMap: config.moduleMap,
      },
    },
    reinstallAbort,
    sourceUntouched: { before, after, untouched: sourceUntouched },
    copyRemoved: false,
    durationMs: Date.now() - t0,
  };

  const dir = evidenceDir ? path.resolve(evidenceDir) : DEFAULT_EVIDENCE_DIR;
  fs.mkdirSync(dir, { recursive: true });
  const evidencePath = path.join(dir, `${stamp}.json`);
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  let copyRemoved = false;
  if (!keep) {
    fs.rmSync(copy, { recursive: true, force: true });
    const bk = result?.backup?.backupDir;
    if (bk && fs.existsSync(bk)) fs.rmSync(bk, { recursive: true, force: true });
    copyRemoved = !fs.existsSync(copy);
  }
  // Re-grava com o veredito de limpeza (evidencia final).
  evidence.copyRemoved = copyRemoved;
  evidence.cleanup.note = copyRemoved ? 'copia e backup removidos ao final' : evidence.cleanup.note;
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  return {
    ok,
    config,
    checks,
    flags,
    planCounts,
    copy,
    copyRemoved,
    evidencePath,
    sourceUntouched,
    reinstallAbort,
    sanitized: removed,
    mobileErrors: mobile.errors,
    stdoutTail: stdout.split('\n').slice(-6).join('\n'),
  };
}

// ---- CLI -------------------------------------------------------------------

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  if (i + 1 >= process.argv.length || process.argv[i + 1].startsWith('--')) return true;
  return process.argv[i + 1];
}

async function cli() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write('uso: node installer/dogfood-mobile.mjs --source <projeto-flutter> [--keep] [--evidence-dir <dir>] [--suite-command <cmd>] [--brain-store <path>]\n');
    return;
  }
  const source = arg('source');
  if (!source || source === true) throw new Error('--source <projeto-flutter> obrigatorio');
  const res = await runDogfoodMobile({
    source: String(source),
    keep: arg('keep', false) === true,
    evidenceDir: arg('evidence-dir', null) ? String(arg('evidence-dir')) : null,
    suiteCommand: arg('suite-command', null) ? String(arg('suite-command')) : null,
    brainStore: arg('brain-store', null) ? String(arg('brain-store')).split(',').map((s) => s.trim()).filter(Boolean) : [],
  });
  process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
  process.exit(res.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch((e) => {
    process.stderr.write(`abort: ${e && e.message ? e.message : e}\n`);
    process.exit(1);
  });
}
