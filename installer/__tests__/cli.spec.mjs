import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import {
  main,
  planMerge,
  printPlan,
  collectIncoming,
  promptAnswers,
  resolveAnswerSource,
  InstallError,
} from '../install.mjs';

let dirs = [];
function mkTarget(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
afterEach(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); dirs = []; });

const OPTS = { allowRoot: true, nodeVersion: 'v26.7.0' };

function pipedInput(lines) {
  return Readable.from(lines.map((l) => `${l}\n`));
}
function nullOutput() {
  return new Writable({ write(_c, _e, cb) { cb(); } });
}

describe('CLI-01: stdin fechado sem --answers-file => aborta (nunca trava)', () => {
  it('resolveAnswerSource sem tty e sem answers-file => aborta alto', () => {
    assert.throws(
      () => resolveAnswerSource({ stdinIsTTY: false, stdinKind: 'char', answersFile: null }),
      /stdin|answers-file|abort/i,
    );
    assert.throws(
      () => resolveAnswerSource({ stdinIsTTY: false, stdinKind: 'unknown', answersFile: null }),
      /stdin|answers-file|abort/i,
    );
  });

  it('resolveAnswerSource: pipe/arquivo/tty/file liberam; char aborta', () => {
    assert.equal(resolveAnswerSource({ stdinIsTTY: true, stdinKind: 'tty', answersFile: null }).mode, 'prompt');
    assert.equal(resolveAnswerSource({ stdinIsTTY: false, stdinKind: 'fifo', answersFile: null }).mode, 'prompt');
    assert.equal(resolveAnswerSource({ stdinIsTTY: false, stdinKind: 'file', answersFile: null }).mode, 'prompt');
    assert.equal(resolveAnswerSource({ stdinIsTTY: false, stdinKind: 'char', answersFile: 'a.json' }).mode, 'file');
  });

  it('processo real com stdin fechado sai != 0 com mensagem (timeout = travou)', () => {
    const target = mkTarget({});
    let out = '';
    let code = 0;
    try {
      out = execFileSync('node', ['installer/install.mjs', '--target', target, '--allow-root'], {
        cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..'),
        input: '',
        encoding: 'utf8',
        timeout: 15000,
      });
    } catch (e) {
      code = e.status ?? 1;
      out = String(e.stderr ?? e.stdout ?? e.message);
    }
    assert.notEqual(code, 0, 'stdin fechado deve abortar, nao sair 0');
    assert.match(out, /stdin|answers-file|abort/i, 'mensagem orienta para --answers-file');
    assert.deepEqual(fs.readdirSync(target), [], 'nada escrito apos abort');
  });
});

describe('CLI-02: dry-run = ZERO writes (inclui sem backup)', () => {
  it('main dry-run nao chama nenhuma escrita (FS com contador)', () => {
    const target = mkTarget({ '.agents/rules/velha.md': '# destino\n' });
    const before = JSON.stringify(fs.readdirSync(target));
    const orig = {};
    let writes = 0;
    for (const m of ['writeFileSync', 'mkdirSync', 'cpSync', 'copyFileSync']) {
      orig[m] = fs[m];
      fs[m] = (...a) => { writes++; return orig[m](...a); };
    }
    let out;
    try {
      out = main({
        target,
        scriptedAnswers: { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: target },
        incomingFiles: { '.agents/rules/velha.md': '# outra\n', '.agents/rules/nova.md': '# nova\n' },
        options: { ...OPTS, dryRun: true },
      });
    } finally {
      for (const m of Object.keys(orig)) fs[m] = orig[m];
    }
    assert.equal(out.dryRun, true);
    assert.equal(out.backup.skipped, true, 'dry-run nao cria backup');
    assert.ok(out.backup.backupDir == null, 'sem backupDir em dry-run');
    assert.equal(writes, 0, `dry-run: zero writes (contadas ${writes})`);
    assert.equal(JSON.stringify(fs.readdirSync(target)), before, 'disco intocado');
    assert.ok(!fs.existsSync(path.join(target, '.harness-install.json')), 'sem manifesto em dry-run');
    assert.ok(!fs.existsSync(path.join(target, '.agents/rules/nova.md')), 'nada instalado em dry-run');
  });
});

describe('CLI-03: plano impresso contem create/merge/flag', () => {
  it('printPlan lista as 3 classes com paths', () => {
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['dest'], instructions: ['hard'] }),
      '.agents/rules/conflito.md': '# destino\n',
    });
    const plan = planMerge(target, {
      'opencode.json': JSON.stringify({ plugin: ['dest', 'harness'], instructions: ['hard'] }),
      '.agents/rules/conflito.md': '# outro\n',
      '.agents/rules/nova.md': '# nova\n',
    });
    const actions = new Set(plan.map((p) => p.action));
    assert.ok(actions.has('create'), 'fixture tem create');
    assert.ok(actions.has('merge'), 'fixture tem merge');
    assert.ok(actions.has('flag'), 'fixture tem flag');
    const lines = [];
    printPlan(plan, { output: { write: (s) => lines.push(s) } });
    const text = lines.join('\n');
    assert.match(text, /create/i);
    assert.match(text, /merge/i);
    assert.match(text, /flag/i);
    for (const p of plan) assert.ok(text.includes(p.path), `plano cita ${p.path}`);
  });
});

describe('CLI-04: Q&A pipado valida respostas', () => {
  it('stdin pipado com respostas validas => answers validados', async () => {
    const target = mkTarget({});
    const answers = await promptAnswers(target, {
      input: pipedInput(['demo', 'node', 'node', target, '']),
      output: nullOutput(),
    });
    assert.equal(answers.project, 'demo');
    assert.equal(answers.stack, 'node');
    assert.equal(answers.suiteCommand, 'node');
    assert.equal(answers.pluginsDir, path.resolve(target));
  });

  it('resposta invalida repete a pergunta ate validar', async () => {
    const target = mkTarget({});
    const answers = await promptAnswers(target, {
      input: pipedInput(['demo', 'RUIM', 'node', 'node', target, '']),
      output: nullOutput(),
    });
    assert.equal(answers.stack, 'node', 'rejeitou RUIM e aceitou node');
  });

  it('EOF antes de completar => aborta alto (nao trava)', async () => {
    const target = mkTarget({});
    await assert.rejects(
      promptAnswers(target, { input: pipedInput(['so-projeto']), output: nullOutput() }),
      /stdin|abort|EOF/i,
    );
  });
});

describe('CLI-05: incoming canonico documentado no codigo', () => {
  it('collectIncoming varre .opencode+.agents, exclui node_modules/.git', () => {
    const src = mkTarget({
      '.agents/rules/a.md': '# a\n',
      '.opencode/plugins/p/gate.js': '// gate\n',
      '.agents/rules/node_modules/x.js': '// excluir\n',
      '.opencode/plugins/.git/HEAD': 'ref\n',
    });
    const incoming = collectIncoming(src);
    assert.ok(incoming['.agents/rules/a.md'], 'inclui rule');
    assert.ok(incoming['.opencode/plugins/p/gate.js'], 'inclui plugin');
    assert.ok(!Object.keys(incoming).some((k) => k.includes('node_modules')), 'exclui node_modules');
    assert.ok(!Object.keys(incoming).some((k) => k.includes('.git')), 'exclui .git');
    const srcText = fs.readFileSync(new URL('../install.mjs', import.meta.url), 'utf8');
    assert.match(srcText, /INCOMING_ROOTS|lista can[oô]nica/i, 'lista canonica documentada no codigo');
  });
});
