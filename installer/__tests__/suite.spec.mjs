import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  preflight,
  backup,
  collectAnswers,
  generateConfig,
  planMerge,
  applyMerge,
  writeManifest,
  buildManifest,
  serializeAnswers,
  sanitizeLog,
  assertDogfoodTarget,
  QUESTIONS,
  InstallError,
} from '../install.mjs';

let dirs = [];
function mkTarget(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in06-'));
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

describe('IN-06 S1: cobertura por invariante (2 ramos cada)', () => {
  it('I1 backup: sucesso verificado / falha aborta sem writes', () => {
    const t1 = mkTarget({ 'opencode.json': '{}' });
    const bk = backup(t1, {});
    dirs.push(bk.backupDir);
    assert.equal(bk.verified, true);
    const t2 = mkTarget({});
    assert.throws(() => backup(t2, { injectFailure: true }), InstallError);
    assert.deepEqual(fs.readdirSync(t2), []);
  });

  it('I2 sem sobrescrita silenciosa: novo=create / diferente=flag-ou-merge', () => {
    const t = mkTarget({ '.agents/rules/a.md': '# destino\n' });
    const plan = planMerge(t, { '.agents/rules/a.md': '# outro\n', '.agents/rules/b.md': '# novo\n' });
    const byPath = Object.fromEntries(plan.map((p) => [p.path, p.action]));
    assert.equal(byPath['.agents/rules/a.md'], 'flag');
    assert.equal(byPath['.agents/rules/b.md'], 'create');
  });

  it('I3 config gerado: chaves presentes / sem caminho de copia no codigo', () => {
    const cfg = generateConfig({ project: 'p', stack: 'node', suiteCommand: 'node --test' });
    assert.equal(cfg.project, 'p');
    const src = fs.readFileSync(new URL('../install.mjs', import.meta.url), 'utf8');
    assert.ok(!/copyTemplate|copyConfig/i.test(src));
  });

  it('I4 manifesto: run real grava / dry-run pula (FS fake conta zero)', () => {
    const t = mkTarget({});
    let writes = 0;
    const fakeFs = { writeFileSync: () => { writes++; } };
    const m = buildManifest({ target: t, backupDir: '/tmp/bk', answers: { project: 'p' } });
    const skipped = writeManifest(t, m, { dryRun: true, fsImpl: fakeFs });
    assert.equal(skipped.skipped, true);
    assert.equal(writes, 0, 'dry-run: zero writes');
    const done = writeManifest(t, m, { dryRun: false });
    assert.equal(done.skipped, false);
    assert.ok(fs.existsSync(path.join(t, '.harness-install.json')));
  });

  it('I5 segredo: memoria mantem / disco+log excluem', () => {
    const answers = { project: 'p', stack: 'node', deployToken: 'FAKE-SECRET-q11' };
    assert.equal(answers.deployToken, 'FAKE-SECRET-q11');
    assert.ok(!JSON.stringify(serializeAnswers(answers)).includes('FAKE-SECRET-q11'));
    assert.ok(!sanitizeLog(`token=FAKE-SECRET-q11 ok`, answers).includes('FAKE-SECRET-q11'));
  });

  it('I6 flag: vazio=PASS-path / pendente=FAIL-path (via plan)', () => {
    const t = mkTarget({});
    const plan = planMerge(t, { '.agents/rules/n.md': '# novo\n' });
    assert.ok(plan.every((p) => p.action !== 'flag'), 'limpo: sem flag');
    const t2 = mkTarget({ '.agents/rules/n.md': '# velho\n' });
    const plan2 = planMerge(t2, { '.agents/rules/n.md': '# novo\n' });
    assert.ok(plan2.some((p) => p.action === 'flag'), 'conflito: flag');
  });
});

describe('IN-06 S2: leak por campo secret (Y5)', () => {
  it('CADA campo secret excluido de manifesto+config+log', () => {
    const secrets = QUESTIONS.filter((q) => q.secret);
    assert.ok(secrets.length >= 1, 'ha ao menos um campo secret');
    for (const q of secrets) {
      const marker = `FAKE-SECRET-${q.key}-001`;
      const answers = { project: 'p', stack: 'node', [q.key]: marker };
      const disk = JSON.stringify(serializeAnswers(answers))
        + JSON.stringify(generateConfig({ project: 'p', stack: 'node', suiteCommand: 'node' }))
        + JSON.stringify(buildManifest({ target: '/tmp/t', backupDir: '/tmp/b', answers }));
      assert.ok(!disk.includes(marker), `campo ${q.key}: ausente de manifesto+config`);
      assert.ok(!sanitizeLog(`run ${marker} end`, answers).includes(marker), `campo ${q.key}: ausente de log`);
    }
  });
});

describe('IN-06 S3: dry-run zero writes (FS fake)', () => {
  it('applyMerge dry-run nao toca disco (contador de writes)', () => {
    const t = mkTarget({});
    const plan = planMerge(t, { '.agents/rules/n.md': '# novo\n', 'opencode.json': '{}' });
    const before = fs.readdirSync(t);
    const res = applyMerge(t, plan, { incomingFiles: { '.agents/rules/n.md': '# novo\n', 'opencode.json': '{}' }, dryRun: true });
    assert.equal(res.written.length, 0);
    assert.deepEqual(fs.readdirSync(t), before, 'disco intocado');
  });

  it('applyMerge sem incomingFiles para create => aborta alto (nunca arquivo vazio silencioso)', () => {
    const t = mkTarget({});
    const plan = planMerge(t, { '.agents/rules/n.md': '# novo\n' });
    assert.throws(() => applyMerge(t, plan, { dryRun: false }), /incoming/i);
  });
});

describe('IN-07 S1 trava: abort fora de /tmp sem --target explicito + confirmacao (Y4)', () => {
  it('dentro de /tmp passa; fora sem flags aborta; fora com flags passa', () => {
    const inside = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in07-'));
    dirs.push(inside);
    assert.equal(assertDogfoodTarget(inside), path.resolve(inside));
    assert.throws(() => assertDogfoodTarget('/etc/harness-x'), /\/tmp|confirm/i);
    assert.throws(() => assertDogfoodTarget('/etc/harness-x', { explicit: true }), /confirm/i);
    assert.equal(
      assertDogfoodTarget('/etc/harness-x', { explicit: true, confirmed: true }),
      path.resolve('/etc/harness-x'),
    );
  });

  it('preflight valida respostas Q&A contra o real (path/comando)', () => {
    const t = mkTarget({});
    assert.throws(() => collectAnswers(t, { project: 'x', stack: 'node', suiteCommand: 'node', pluginsDir: '/nao/existe' }), /exist|outside/i);
    const ok = collectAnswers(t, { project: 'x', stack: 'node', suiteCommand: 'node', pluginsDir: t });
    assert.equal(ok.project, 'x');
    preflight({ target: t, ...OPTS });
  });
});
