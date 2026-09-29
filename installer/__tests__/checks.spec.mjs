import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  DENYLIST,
  scanLiterals,
  runChecks,
  requireVerifiedBackup,
  main,
  buildManifest,
  serializeAnswers,
  QUESTIONS,
  InstallError,
} from '../install.mjs';

let dirs = [];
function mkTarget(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in05-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
afterEach(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); dirs = []; });

function cleanManifest(target, backupDir, extra = {}) {
  return buildManifest({
    target, backupDir,
    installed: [{ path: 'opencode.json', kind: 'file' }],
    merged: [], flagged: [],
    answers: { project: 'demo', stack: 'node' },
    checks: { passed: true, failed: [] },
    fileContents: { 'opencode.json': fs.readFileSync(path.join(target, 'opencode.json'), 'utf8') },
    ...extra,
  });
}

describe('IN-05 S1: instalacao limpa => checks PASS com veredito', () => {
  it('PASS quando JSON valido + sem literais + flagged vazio', () => {
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({ version: 1, project: 'demo' }),
      '.agents/rules/clean.md': '# regra limpa do harness\nsem stack alheia\n',
    });
    const bk = path.join(os.tmpdir(), `harness-in05-bk-${Date.now()}`);
    fs.mkdirSync(bk, { recursive: true });
    dirs.push(bk);
    const manifest = cleanManifest(target, bk);
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    const verdict = runChecks(target, { manifest });
    assert.equal(verdict.passed, true, `esperava PASS, falhou: ${JSON.stringify(verdict.failed)}`);
    assert.deepEqual(verdict.failed, []);
  });
});

describe('IN-05 S2: flagged pendente / literal-canario => FAIL com motivo', () => {
  it('flagged nao-vazio => FAIL (I6)', () => {
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({ version: 1, project: 'demo' }),
    });
    const bk = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in05-bk-'));
    dirs.push(bk);
    const manifest = cleanManifest(target, bk, {
      flagged: [{ path: '.agents/rules/a.md', reason: 'exists-different' }],
    });
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    const verdict = runChecks(target, { manifest });
    assert.equal(verdict.passed, false, 'flag pendente bloqueia (I6)');
    assert.ok(verdict.failed.some((f) => /flag/i.test(f)), 'motivo cita flag');
  });

  it('denylist publicada e nao-vazia', () => {
    assert.ok(Array.isArray(DENYLIST) && DENYLIST.length >= 3, 'denylist inicial publicada');
    for (const lit of DENYLIST) assert.ok(typeof lit === 'string' && lit.length >= 3, `literal valido: ${lit}`);
  });

  it('canario: literal plantado numa rule copiada => check falha (R3)', () => {
    const canary = DENYLIST[0];
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({ version: 1, project: 'demo' }),
      '.agents/rules/plantada.md': `# regra copiada\ncontem ${canary} plantado\n`,
    });
    const bk = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in05-bk-'));
    dirs.push(bk);
    const manifest = cleanManifest(target, bk, {
      installed: [{ path: '.agents/rules/plantada.md', kind: 'file' }],
      fileContents: {
        'opencode.json': fs.readFileSync(path.join(target, 'opencode.json'), 'utf8'),
        '.agents/rules/plantada.md': fs.readFileSync(path.join(target, '.agents/rules/plantada.md'), 'utf8'),
      },
    });
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    const verdict = runChecks(target, { manifest });
    assert.equal(verdict.passed, false, 'canario deve falhar o check');
    assert.ok(verdict.failed.some((f) => f.includes(canary)), 'motivo cita o literal');
  });

  it('scanLiterals: quase-igual NAO casa (negativo)', () => {
    const hits = scanLiterals('nada suspeito aqui, so harness v7 limpo');
    assert.deepEqual(hits, []);
  });

  it('opencode.json corrompido => FAIL (R1)', () => {
    const target = mkTarget({
      'opencode.json': '{CORROMPIDO{{{',
      'harness.config.json': JSON.stringify({ version: 1, project: 'demo' }),
    });
    const bk = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in05-bk-'));
    dirs.push(bk);
    const verdict = runChecks(target, { manifest: cleanManifest(target, bk) });
    assert.equal(verdict.passed, false);
    assert.ok(verdict.failed.some((f) => /json|corromp/i.test(f)));
  });
});

describe('IN-05 S3: skill auto-suficiente (instala sem ler o SPEC)', () => {
  it('SKILL.md existe com quickstart + Q&A + rollback, sem exigir SPEC', () => {
    const skillPath = new URL('../../.agents/skills/harness-installer/SKILL.md', import.meta.url);
    const skill = fs.readFileSync(skillPath, 'utf8');
    for (const kw of ['--target', '--dry-run', 'backup', 'checks', 'rollback', 'Q&A']) {
      assert.ok(skill.includes(kw), `skill cobre: ${kw}`);
    }
    assert.ok(!/leia o SPEC|read the SPEC/i.test(skill), 'skill nao delega leitura ao SPEC');
  });

  it('Y3: skill documenta retencao/descarte do backup', () => {
    const skillPath = new URL('../../.agents/skills/harness-installer/SKILL.md', import.meta.url);
    const skill = fs.readFileSync(skillPath, 'utf8');
    assert.ok(/reten|retention|guardar|manter/i.test(skill), 'retencao documentada');
    assert.ok(/descart|rm -rf|remover|apagar/i.test(skill), 'descarte documentado');
  });
});

describe('FU-20: main() exige backup.verified===true antes de applyMerge (I1)', () => {
  it('requireVerifiedBackup rejeita verified!==true', () => {
    assert.throws(() => requireVerifiedBackup(null), /backup/i);
    assert.throws(() => requireVerifiedBackup({ verified: false }), /backup/i);
    assert.throws(() => requireVerifiedBackup({}), /backup/i);
    requireVerifiedBackup({ verified: true, backupDir: '/tmp/x' });
  });

  it('main sem backup (falha injetada) => aborta e nada instalado', () => {
    const target = mkTarget({});
    assert.throws(
      () => main({
        target,
        scriptedAnswers: { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: target },
        incomingFiles: { '.agents/rules/x.md': '# x\n' },
        options: { allowRoot: true, nodeVersion: 'v26.7.0', injectFailure: true },
      }),
      /backup/i,
    );
    assert.ok(!fs.existsSync(path.join(target, '.agents/rules/x.md')), 'nada escrito apos falha de backup');
    assert.ok(!fs.existsSync(path.join(target, '.harness-install.json')), 'sem manifesto apos abort');
  });

  it('main completo escreve conteudo + manifesto + checks PASS', () => {
    const target = mkTarget({});
    const out = main({
      target,
      scriptedAnswers: { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: target },
      incomingFiles: {
        'opencode.json': JSON.stringify({ plugin: ['harness'], instructions: ['hard'] }),
        '.agents/rules/x.md': '# regra limpa harness\n',
      },
      options: { allowRoot: true, nodeVersion: 'v26.7.0', backupRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in05-main-')) },
    });
    dirs.push(out.backup.backupDir);
    assert.equal(fs.readFileSync(path.join(target, '.agents/rules/x.md'), 'utf8'), '# regra limpa harness\n');
    assert.ok(fs.existsSync(path.join(target, '.harness-install.json')), 'manifesto gravado');
    assert.equal(out.checks.passed, true, `checks PASS: ${JSON.stringify(out.checks.failed)}`);
    assert.ok(!JSON.stringify(out.manifest.answers).includes('deployToken'), 'sem segredo no manifesto');
  });

  it('segredo scriptado nunca chega a disco nem log (I5 via main)', () => {
    const target = mkTarget({});
    const out = main({
      target,
      scriptedAnswers: { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: target, deployToken: 'FAKE-SECRET-zzz999' },
      incomingFiles: { '.agents/rules/x.md': '# regra limpa harness\n' },
      options: { allowRoot: true, nodeVersion: 'v26.7.0', backupRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in05-main-')) },
    });
    dirs.push(out.backup.backupDir);
    const disk = fs.readFileSync(path.join(target, '.harness-install.json'), 'utf8')
      + fs.readFileSync(path.join(target, 'harness.config.json'), 'utf8');
    assert.ok(!disk.includes('FAKE-SECRET-zzz999'), 'segredo ausente de disco');
    assert.ok(!JSON.stringify(serializeAnswers({ project: 'x', deployToken: 'FAKE-SECRET-zzz999' })).includes('FAKE-SECRET-zzz999'));
    assert.ok(QUESTIONS.find((q) => q.secret), 'ha campo secret marcado');
  });
});
