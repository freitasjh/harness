// installer/dogfood.mjs — IN-07: dogfood em COPIA sob /tmp (nunca no repo real).
// Uso: node installer/dogfood.mjs --source /caminho/do/repo-real [--keep]
// [--target <dir>] [--evidence-dir <dir>] [--no-suites]
// Sem --source: usa ../atlas-ecm ao lado deste repo. --keep: nao remove a copia.
// Origem SOMENTE leitura (cp -r). Alvo fora de /tmp sem --target explicito +
// confirmacao => aborta (Y4). Nunca pkill -f. Nunca commita segredo.
//
// A6 (2026-10-09): este dogfood tinha o MESMO par de defeitos do mobile, ambos
// fechados aqui e cobertos por installer/__tests__/dogfood.spec.mjs:
//   - isolamento da origem provado SEM digest de conteudo (`git status --short`
//     + size/mtime no fallback) => mutacao de conteudo invisivel;
//   - limpeza so no caminho feliz (nada de try/finally) => falha deixava copia
//     e backup orfaos em /tmp.
// As travessas principais (digest resistente a path quotado, trava
// origem-vs-alvo, limpeza que nunca lanca) vivem em ./dogfood-common.mjs.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { main, runChecks, scanLiterals, DENYLIST, assertDogfoodTarget, VERSION } from './install.mjs';
import {
  assertDisjointSourceTarget,
  assertNoShortcutTarget,
  cleanupDogfood,
  cleanupErrorOf,
  cleanupNote,
  realOrResolved,
  sameSourceState,
  sourceState,
} from './dogfood-common.mjs';

export { cleanupNote, sourceState };

export const DEFAULT_SOURCE = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  'atlas-ecm',
);

const EVIDENCE_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  '.spec',
  'governance',
  'harness-installer',
  'harness',
);

const INSTALLER_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Dogfood da stack generica: copia a origem para /tmp, instala de verdade,
// re-prova o abort de re-instalacao, roda os checks e confirma que a origem
// ficou intocada. `runSuites:false` (usado nos testes) pula a suite aninhada —
// rodar a suite aqui de dentro de `node --test` seria recursao.
export async function runDogfood({
  source = DEFAULT_SOURCE,
  keep = false,
  evidenceDir = null,
  runSuites = true,
  target = null,
} = {}) {
  const t0 = Date.now();
  const src = path.resolve(String(source));
  if (!fs.existsSync(src)) throw new Error(`dogfood: source nao existe: ${src}`);

  const before = sourceState(src);

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
  const copy = target ? path.resolve(target) : path.join(os.tmpdir(), `harness-dogfood-${stamp}`);
  assertDogfoodTarget(copy);
  // Atalho no alvo: `cp` seguiria o symlink e a limpeza nao provaria onde
  // remove — aborta antes de qualquer escrita (FU-35 rodada final).
  assertNoShortcutTarget(copy, { label: 'dogfood' });
  // C2: o alvo nunca pode ser a origem nem um ancestral/descendente dela —
  // sem esta trava a limpeza final apagaria arquivos do usuario. FU-34: a
  // comparacao cobre o REALPATH tambem (origem alcancada por symlink).
  assertDisjointSourceTarget(src, copy, { label: 'dogfood' });

  let out = null;
  let suite = { exitCode: -1, stdout: '' };
  let reinstallAbort = null;
  let manifestOnDisk = null;
  let smokeChecks = { passed: false, failed: ['instalacao nao concluida'] };
  let installedHits = [];
  let failure = null;
  let backupDir = null;
  let hadForeignManifest = false;
  let cleanupState = { kept: false, copyRemoved: false, backupRemoved: false, removed: [], blocked: [], errors: [] };

  try {
    fs.mkdirSync(copy, { recursive: true });
    execFileSync('cp', ['-r', `${src}/.`, copy], { timeout: 300000 });
    // Remove manifesto alheio da copia se houver (re-instalacao abortaria; a copia e campo de teste).
    const foreignManifest = path.join(copy, '.harness-install.json');
    hadForeignManifest = fs.existsSync(foreignManifest);
    if (hadForeignManifest) fs.rmSync(foreignManifest);

    // S1c: instalacao real na copia.
    out = main({
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
        // Harness v7 operability (Estrategia A): o smoke precisa shipar o que a
        // config gerada referencia (moduleMap.plugins + evidence.schema), senao
        // os checks corretamente reprovam a instalacao por referencia ausente.
        '.opencode/plugins/dogfood-smoke.js': 'export const dogfoodSmoke = true;\n',
        '.agents/schemas/harness-report.schema.json': '{}\n',
      },
      options: { allowRoot: true, nodeVersion: process.version },
    });

    // S2: suite do installer (origem) verde — instalador nao toca a origem.
    if (runSuites) {
      try {
        const so = execFileSync('node', ['--test', 'installer/__tests__/*.spec.mjs'], {
          cwd: INSTALLER_ROOT,
          encoding: 'utf8',
          timeout: 600000,
          shell: '/bin/sh',
        });
        suite = { exitCode: 0, stdout: so.slice(-500) };
      } catch (e) {
        suite = { exitCode: e.status ?? 1, stdout: String(e.stdout ?? e.message).slice(-500) };
      }
    }

    // S3: smoke — re-instalacao aborta + manifesto re-lido + checks PASS.
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
    manifestOnDisk = JSON.parse(fs.readFileSync(path.join(copy, '.harness-install.json'), 'utf8'));
    smokeChecks = runChecks(copy, { manifest: manifestOnDisk });

    // S4: literais — zero DENYLIST nos instalados + canario negativo.
    for (const f of [...(manifestOnDisk.installed || []), ...(manifestOnDisk.merged || [])]) {
      const abs = path.join(copy, f.path);
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
      const hits = scanLiterals(fs.readFileSync(abs, 'utf8'));
      if (hits.length) installedHits.push({ path: f.path, hits });
    }
  } catch (e) {
    failure = String(e && e.message ? e.message : e);
  } finally {
    // A6: limpeza em QUALQUER caminho (antes so no feliz). Falha de remocao
    // nao lanca — a evidencia precisa ser gravada.
    backupDir = out?.backup?.backupDir || null;
    // 2a linha de defesa (FU-34/35): `sourceReal` re-valida a disjointness
    // antes de qualquer remocao, mesmo que o guard do inicio tenha passado.
    cleanupState = cleanupDogfood(copy, backupDir, {
      keep,
      t0,
      sourceReal: realOrResolved(src),
      warn: (m) => { try { process.stderr.write(`dogfood: ${m}\n`); } catch { /* stderr opcional */ } },
    });
  }

  const after = sourceState(src);
  const untouched = !failure && sameSourceState(before, after);
  const cleanupError = cleanupErrorOf(cleanupState);

  const evidence = {
    version: 1,
    demand: 'harness-installer-dogfood',
    installerVersion: VERSION,
    date: new Date().toISOString(),
    agent: 'developer-engineer',
    phase: 'Execution',
    gitSha: (() => {
      try { return execFileSync('git', ['-C', INSTALLER_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
    })(),
    commands: [
      { cmd: `node installer/dogfood.mjs --source ${src}`, exitCode: failure ? 1 : 0, durationMs: Date.now() - t0, stdoutHash: 'n/a-CLI-direto' },
      ...(runSuites ? [{ cmd: 'node --test "installer/__tests__/*.spec.mjs"', exitCode: suite.exitCode, durationMs: 0, stdoutHash: 'n/a-tail' }] : []),
    ],
    counts: { unit: { passed: 0, failed: 0, skipped: 0 }, it: { passed: 0, failed: 0, skipped: 0 }, frontend: { passed: 0, failed: 0, skipped: 0 } },
    evaluation: {
      telas: 'n/a-CLI-sem-UI',
      negocio: `dogfood-stack-node-flags-${installedHits.length}`,
      logica: `instalacao-real-reinstall-abort-origem-${untouched ? 'intocada' : 'ALTERADA'}`,
      perf: 'n/a-instalacao-local-copia',
    },
    brainStore: [],
    cleanup: {
      ports: [],
      note: cleanupNote(cleanupState, copy),
      removed: cleanupState.removed,
      blocked: cleanupState.blocked,
      orphans: cleanupState.orphans || [],
      error: cleanupError,
    },
    selfReported: true,
    source: src,
    copy,
    hadForeignManifest,
    s1: {
      abortOutsideTmp: abortProof,
      manifestWritten: out ? Boolean(out.manifestRef && out.manifestRef.path) : false,
      checksPassed: out ? out.checks.passed : false,
      checksFailed: out ? out.checks.failed : [],
      backupDir,
    },
    s2: { installerSuiteExit: suite.exitCode, tail: suite.stdout },
    s3: {
      reinstallAbort,
      manifestReread: manifestOnDisk ? manifestOnDisk.manifestSchemaVersion === 1 : false,
      checksPassed: smokeChecks.passed,
      checksFailed: smokeChecks.failed,
    },
    s4: { denylist: DENYLIST, installedHits, clean: installedHits.length === 0 },
    sourceUntouched: { before, after, untouched },
    failure,
    copyRemoved: cleanupState.copyRemoved,
    cleanupError,
    durationMs: Date.now() - t0,
  };

  const dir = evidenceDir ? path.resolve(evidenceDir) : EVIDENCE_DIR;
  fs.mkdirSync(dir, { recursive: true });
  const evPath = path.join(dir, `${stamp}.json`);
  fs.writeFileSync(evPath, JSON.stringify(evidence, null, 2));

  const suitesOk = runSuites ? suite.exitCode === 0 : true;
  const ok = !failure && Boolean(out)
    && out.checks.passed && suitesOk && reinstallAbort && smokeChecks.passed
    && installedHits.length === 0 && untouched;
  return {
    ok,
    evidence: evPath,
    copy,
    copyRemoved: cleanupState.copyRemoved,
    backupDir,
    failure,
    cleanupError,
    sourceUntouched: untouched,
    reinstallAbort,
    installedHits,
  };
}

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  if (i + 1 >= process.argv.length || process.argv[i + 1].startsWith('--')) return true;
  return process.argv[i + 1];
}

async function cli() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write('uso: node installer/dogfood.mjs --source <repo-real> [--keep] [--no-suites] [--evidence-dir <dir>]\n');
    return;
  }
  const source = arg('source', DEFAULT_SOURCE);
  const res = await runDogfood({
    source: source === true ? DEFAULT_SOURCE : String(source),
    keep: arg('keep', false) === true,
    runSuites: arg('no-suites', false) !== true,
    evidenceDir: arg('evidence-dir', null) ? String(arg('evidence-dir')) : null,
    target: arg('target', null) && arg('target') !== true ? String(arg('target')) : null,
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
