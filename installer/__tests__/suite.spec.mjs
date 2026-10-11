import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Readable, Writable } from 'node:stream';
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
  formatError,
  dryRunNotice,
  runCli,
  runWizard,
  runInit,
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

// INS-01 (REQ-05): formatError bloco 4-linhas
function captureStream() {
  let buf = '';
  const stream = new Writable({ write(c, _e, cb) { buf += c.toString(); cb(); } });
  return { stream, text: () => buf };
}

describe('INS-01 S1: bloco completo para BAD_ANSWER', () => {
  it('output tem [ERRO], porquê: BAD_ANSWER, como corrigir:, onde ver: (4 linhas)', () => {
    const block = formatError({
      what: `opção '7' inválida`,
      code: 'BAD_ANSWER',
      fix: 'digite 1, 2, 3 ou 4.',
      where: 'installer/install.mjs (W2m)',
    });
    assert.match(block, /\[ERRO\]/);
    assert.match(block, /porquê: BAD_ANSWER/);
    assert.match(block, /como corrigir:/);
    assert.match(block, /onde ver:/);
    assert.equal(block.split('\n').length, 4, 'bloco sempre 4 linhas');
  });
});

describe('INS-01 S2: codigo desconhecido cai em UNKNOWN sem throw', () => {
  it('X_INVENTADO => porquê: UNKNOWN + onde ver generico', () => {
    const block = formatError({ what: 'algo estranho', code: 'X_INVENTADO' });
    assert.match(block, /porquê: UNKNOWN/);
    assert.match(block, /onde ver: \S+/);
    assert.equal(block.split('\n').length, 4);
  });
});

describe('INS-01 S3: segredo no texto redigido via sanitizeLog com contexto', () => {
  it('canario ausente no output', () => {
    const canary = 'CANARIO-INS01-9f3';
    const answers = { project: 'p', stack: 'node', deployToken: canary };
    const block = formatError({ what: `falha com ${canary} no meio`, code: 'BAD_ANSWER', fix: 'x', where: 'y' }, answers);
    assert.ok(!block.includes(canary), 'canario redigido no bloco');
  });
});

// INS-03 (REQ-07): dry-run NAO EXECUTADO
describe('INS-03 S1: install --dry-run em fixture imprime NAO EXECUTADO, zero writes, passed:null', () => {
  it('output contem NÃO EXECUTADO; 0 arquivos criados; checks passed:null', async () => {
    const t = mkTarget({});
    const af = path.join(t, 'answers.json');
    fs.writeFileSync(af, JSON.stringify({ project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: t }));
    const out = captureStream();
    const res = await runCli({
      argv: ['--target', t, '--allow-root', '--dry-run', '--answers-file', af],
      stdin: Readable.from([]),
      stdout: out.stream,
      stderr: captureStream().stream,
    });
    assert.match(out.text(), /NÃO EXECUTADO/);
    assert.equal(res.checks.passed, null, 'dry-run nunca PASS');
    assert.deepEqual(fs.readdirSync(t).sort(), ['answers.json'], 'zero writes no target');
  });
});

describe('INS-03 S2: regressao checks-como-PASS travada', () => {
  it('nenhum passed:true; relatorio diz plano + relatório apenas', async () => {
    const t = mkTarget({});
    const af = path.join(t, 'answers.json');
    fs.writeFileSync(af, JSON.stringify({ project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: t }));
    const out = captureStream();
    const res = await runCli({
      argv: ['--target', t, '--allow-root', '--dry-run', '--answers-file', af],
      stdin: Readable.from([]),
      stdout: out.stream,
      stderr: captureStream().stream,
    });
    assert.notEqual(res.checks.passed, true);
    assert.ok(!/checks: PASS/.test(out.text()), 'relatorio nunca declara PASS em dry-run');
    assert.match(out.text(), /plano \+ relatório apenas/);
  });
});

describe('INS-03 S3: dry-run nao cria backup', () => {
  it('nenhum .harness-backup-* surge ao lado do target', async () => {
    const t = mkTarget({});
    const af = path.join(t, 'answers.json');
    fs.writeFileSync(af, JSON.stringify({ project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: t }));
    const parent = path.dirname(t);
    const before = new Set(fs.readdirSync(parent));
    await runCli({
      argv: ['--target', t, '--allow-root', '--dry-run', '--answers-file', af],
      stdin: Readable.from([]),
      stdout: captureStream().stream,
      stderr: captureStream().stream,
    });
    const created = fs.readdirSync(parent).filter((e) => !before.has(e) && e.startsWith(`.harness-backup-${path.basename(t)}-`));
    assert.deepEqual(created, [], 'dry-run: nem backup cria');
  });
});

describe('INS-03 unidade: dryRunNotice rotula NAO EXECUTADO, nunca PASS', () => {
  it('contem NÃO EXECUTADO e nao declara PASS', () => {
    assert.match(dryRunNotice(), /NÃO EXECUTADO/);
    assert.ok(!/\bPASS\b/.test(dryRunNotice()), 'nunca PASS');
  });
});

// INS-04 (REQ-08): pico-fim por etapa — TDD FIRST (G2)
function pipedLines(lines) {
  return Readable.from(lines.map((l) => `${l}\n`));
}
function mkSourceMini() {
  return mkTarget({
    '.agents/rules/a.md': '# a\n',
    'opencode.json': JSON.stringify({ plugin: ['harness'] }),
  });
}

describe('INS-04 S1: etapa verde marca pico-fim', () => {
  it('W0 verde => [OK] W0: pico-fim; apply+checks verdes => seus marcadores', async () => {
    const t = mkTarget({});
    const src = mkSourceMini();
    const out = captureStream();
    const res = await runWizard({
      target: t,
      stdin: pipedLines(['3', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: { allowRoot: true, yes: true },
      apply: async (ctx) => ({
        target: ctx.target,
        manifestRef: { path: path.join(ctx.target, '.harness-install.json') },
        checks: { passed: true, failed: [] },
        plan: ctx.plan,
      }),
    });
    assert.equal(res.applied, true);
    assert.match(out.text(), /\[OK\] W0: pico-fim/, 'W0 verde marca');
    assert.match(out.text(), /\[OK\] apply: pico-fim/, 'apply verde marca');
    assert.match(out.text(), /\[OK\] checks: pico-fim/, 'checks verde marca');
  });
});

describe('INS-04 S2: etapa com falha nunca marca pico-fim', () => {
  it('checks FAIL => sem [OK] checks: pico-fim, com [ERRO]', async () => {
    const t = mkTarget({});
    const src = mkSourceMini();
    const out = captureStream();
    const res = await runWizard({
      target: t,
      stdin: pipedLines(['3', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: { allowRoot: true, yes: true },
      apply: async (ctx) => ({
        target: ctx.target,
        manifestRef: { path: path.join(ctx.target, '.harness-install.json') },
        checks: { passed: false, failed: ['manifest-missing'] },
        plan: ctx.plan,
      }),
    });
    assert.equal(res.applied, true);
    assert.doesNotMatch(out.text(), /\[OK\] checks: pico-fim/, 'falha nunca marca');
    assert.match(out.text(), /\[ERRO\]/, 'bloco [ERRO] presente');
  });
});

describe('INS-04 S3: dry-run nunca marca pico-fim de apply', () => {
  it('dry-run => sem [OK] apply: pico-fim, com NÃO EXECUTADO, apply nao chamado', async () => {
    const t = mkTarget({});
    const src = mkSourceMini();
    const out = captureStream();
    let applied = 0;
    const res = await runWizard({
      target: t,
      stdin: pipedLines(['3', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: { allowRoot: true, dryRun: true },
      apply: () => { applied++; return {}; },
    });
    assert.equal(applied, 0, 'dry-run nao chama apply');
    assert.equal(res.applied, false);
    assert.doesNotMatch(out.text(), /\[OK\] apply: pico-fim/, 'dry-run nunca marca apply');
    assert.match(out.text(), /NÃO EXECUTADO/, 'dry-run rotula NÃO EXECUTADO');
  });
});

describe('INS-04 S4: init com checks FAIL nunca marca init pico-fim', () => {
  function mkSourcePoisoned() {
    return mkTarget({
      '.agents/rules/a.md': '# a\n',
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      '.opencode/plugins/evil.js': "const Vuetify = require('vuetify/lib');\n",
    });
  }
  it('scriptada (answers-file) com checks FAIL => sem [OK] init: pico-fim, com [ERRO]', async () => {
    const t = mkTarget({});
    const src = mkSourcePoisoned();
    const af = path.join(t, 'answers.json');
    fs.writeFileSync(af, JSON.stringify({ project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: '.' }));
    const out = captureStream();
    const res = await runInit({
      target: t,
      stdin: Readable.from([]),
      stdout: out.stream,
      stderr: captureStream().stream,
      sourceDir: src,
      answersFile: af,
      options: { allowRoot: true, yes: true },
    });
    dirs.push(res.backupDir);
    assert.equal(res.checks.passed, false, 'checks FAIL (canario literal-denied)');
    assert.doesNotMatch(out.text(), /\[OK\] init: pico-fim/, 'checks FAIL nunca marca init pico-fim');
    assert.match(out.text(), /\[ERRO\]/, 'bloco [ERRO] presente');
  });
  it('interativa (wizard) com checks FAIL => sem [OK] init: pico-fim, com [ERRO]', async () => {
    const t = mkTarget({});
    const src = mkSourcePoisoned();
    const out = captureStream();
    const res = await runInit({
      target: t,
      stdin: pipedLines(['3', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      stderr: captureStream().stream,
      sourceDir: src,
      options: { allowRoot: true, yes: true },
    });
    dirs.push(res.backupDir);
    assert.equal(res.checks.passed, false, 'checks FAIL (canario literal-denied)');
    assert.doesNotMatch(out.text(), /\[OK\] init: pico-fim/, 'checks FAIL nunca marca init pico-fim');
    assert.match(out.text(), /\[ERRO\]/, 'bloco [ERRO] presente');
  });
});
