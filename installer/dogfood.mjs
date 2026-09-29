// installer/dogfood.mjs — IN-07: dogfood em COPIA sob /tmp (nunca no repo real).
// Uso: node installer/dogfood.mjs --source /caminho/do/repo-real [--keep]
// Sem --source: usa ../atlas-ecm ao lado deste repo. --keep: nao remove a copia.
// Origem SOMENTE leitura (cp -r). Alvo fora de /tmp sem --target explicito +
// confirmacao => aborta (Y4). Nunca pkill -f. Nunca commita segredo.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { main, runChecks, scanLiterals, DENYLIST, assertDogfoodTarget, VERSION } from './install.mjs';

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  if (i + 1 >= process.argv.length || process.argv[i + 1].startsWith('--')) return true;
  return process.argv[i + 1];
}

function sha(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function sourceState(source) {
  try {
    const st = execFileSync('git', ['-C', source, 'status', '--short'], { encoding: 'utf8', timeout: 15000 });
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

const evidenceDir = new URL('../.spec/governance/harness-installer/harness/', import.meta.url);

async function mainDogfood() {
  const t0 = Date.now();
  const here = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const source = path.resolve(String(arg('source', path.join(here, '..', 'atlas-ecm'))));
  const keep = arg('keep', false) === true;
  if (!fs.existsSync(source)) {
    console.error(`abort: source nao existe: ${source}`);
    process.exit(1);
  }
  const before = sourceState(source);

  // S1a: trava — path fora de /tmp sem flags => aborta (prova do abort).
  let abortProof = null;
  try {
    assertDogfoodTarget('/etc/harness-dogfood-probe');
  } catch (e) {
    abortProof = String(e.message);
  }
  if (!abortProof) throw new Error('trava Y4 nao abortou — BUG');

  // S1b: copia para /tmp (origem so-leitura).
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const copy = path.join(os.tmpdir(), `harness-dogfood-${stamp}`);
  assertDogfoodTarget(copy);
  fs.mkdirSync(copy, { recursive: true });
  execFileSync('cp', ['-r', `${source}/.`, copy], { timeout: 120000 });
  // Remove manifesto alheio da copia se houver (re-instalacao abortaria; a copia e campo de teste).
  const foreignManifest = path.join(copy, '.harness-install.json');
  const hadForeignManifest = fs.existsSync(foreignManifest);
  if (hadForeignManifest) fs.rmSync(foreignManifest);

  // S1c: instalacao real na copia.
  const out = main({
    target: copy,
    scriptedAnswers: {
      project: 'atlas-ecm-dogfood',
      stack: 'node',
      suiteCommand: 'node',
      pluginsDir: copy,
    },
    incomingFiles: {
      'opencode.json': JSON.stringify({ plugin: ['harness-dogfood'], instructions: ['dogfood smoke'] }),
      '.agents/rules/dogfood.md': '# regra dogfood harness\nconteudo limpo de teste\n',
    },
    options: { allowRoot: true, nodeVersion: process.version },
  });

  // S2: suite do harness (origem) verde — instalador nao toca o repo de origem.
  let suite = { exitCode: -1, stdout: '' };
  try {
    const so = execFileSync('node', ['--test', 'installer/__tests__/*.spec.mjs'], {
      cwd: here, encoding: 'utf8', timeout: 120000, shell: '/bin/sh',
    });
    suite = { exitCode: 0, stdout: so.slice(-500) };
  } catch (e) {
    suite = { exitCode: e.status ?? 1, stdout: String(e.stdout ?? e.message).slice(-500) };
  }

  // S3: smoke — re-instalacao aborta + manifesto re-lido + checks PASS.
  let reinstallAbort = null;
  try {
    main({
      target: copy,
      scriptedAnswers: { project: 'x', stack: 'node', suiteCommand: 'node', pluginsDir: copy },
      incomingFiles: {},
      options: { allowRoot: true, nodeVersion: process.version },
    });
  } catch (e) {
    reinstallAbort = String(e.message);
  }
  const manifestOnDisk = JSON.parse(fs.readFileSync(path.join(copy, '.harness-install.json'), 'utf8'));
  const smokeChecks = runChecks(copy, { manifest: manifestOnDisk });

  // S4: literais — zero DENYLIST nos instalados + canario negativo.
  const installedHits = [];
  for (const f of [...(manifestOnDisk.installed || []), ...(manifestOnDisk.merged || [])]) {
    const abs = path.join(copy, f.path);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
    const hits = scanLiterals(fs.readFileSync(abs, 'utf8'));
    if (hits.length) installedHits.push({ path: f.path, hits });
  }

  const after = sourceState(source);
  const untouched = JSON.stringify(before) === JSON.stringify(after);

  const evidence = {
    version: 1,
    demand: 'harness-installer-dogfood',
    installerVersion: VERSION,
    date: new Date().toISOString(),
    source,
    copy,
    hadForeignManifest,
    s1: {
      abortOutsideTmp: abortProof,
      manifestWritten: fs.existsSync(path.join(copy, '.harness-install.json')),
      checksPassed: out.checks.passed,
      checksFailed: out.checks.failed,
      backupDir: out.backup.backupDir,
    },
    s2: { installerSuiteExit: suite.exitCode, tail: suite.stdout },
    s3: {
      reinstallAbort,
      manifestReread: manifestOnDisk.manifestSchemaVersion === 1,
      checksPassed: smokeChecks.passed,
      checksFailed: smokeChecks.failed,
    },
    s4: { denylist: DENYLIST, installedHits, clean: installedHits.length === 0 },
    sourceUntouched: { before, after, untouched },
    durationMs: Date.now() - t0,
  };
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evPath = path.join(new URL(evidenceDir).pathname, `${stamp}.json`);
  fs.writeFileSync(evPath, JSON.stringify(evidence, null, 2));

  if (!keep) {
    fs.rmSync(copy, { recursive: true, force: true });
    fs.rmSync(out.backup.backupDir, { recursive: true, force: true });
  }
  const ok = out.checks.passed && suite.exitCode === 0 && reinstallAbort && smokeChecks.passed
    && installedHits.length === 0 && untouched;
  console.log(JSON.stringify({ ok, evidence: evPath, copyRemoved: !keep, sourceUntouched: untouched }, null, 2));
  process.exit(ok ? 0 : 1);
}

mainDogfood().catch((e) => { console.error(`abort: ${e.message}`); process.exit(1); });
