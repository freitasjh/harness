// operability.spec.mjs — bugfix harness-installer-operability (Estrategia A).
// O instalador reportava checks PASS com o consumidor inoperante:
//   F2: .agents/schemas ausente do set instalado (config aponta evidence.schema);
//   F3: __tests__/** shipado ao consumidor (specs importam scripts/ ausente);
//   F1: runChecks nunca validava referencias da config nem parse dos plugins.
// TDD: estes testes sao RED antes do fix e GREEN depois.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { runChecks, collectIncoming, main, buildManifest, runInit } from '../install.mjs';

let dirs = [];
function mkTarget(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-op-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
afterEach(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); dirs = []; });

function manifestFor(target, extra = {}) {
  const bk = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-op-bk-'));
  dirs.push(bk);
  return buildManifest({
    target, backupDir: bk,
    installed: [], merged: [], flagged: [],
    answers: { project: 'demo', stack: 'node' },
    checks: { passed: true, failed: [] },
    ...extra,
  });
}

describe('operability Q3(a): runChecks valida referencias da config no destino', () => {
  it('evidence.schema ausente => FAIL com bloco 4-linhas', () => {
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({
        version: 1, project: 'demo',
        evidence: { path: 'harness/', schema: '.agents/schemas/harness-report.schema.json' },
      }),
    });
    const manifest = manifestFor(target);
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    const verdict = runChecks(target, { manifest });
    assert.equal(verdict.passed, false, `esperava FAIL: ${JSON.stringify(verdict.failed)}`);
    const entry = verdict.failed.find((f) => f.includes('config-ref-missing'));
    assert.ok(entry, 'failed[] contem config-ref-missing');
    assert.match(entry, /porquê: config-ref-missing/);
    assert.match(entry, /\.agents\/schemas\/harness-report\.schema\.json/);
    assert.equal(entry.split('\n').length, 4, 'bloco 4-linhas');
  });

  it('evidence.schema presente => PASS', () => {
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({
        version: 1, project: 'demo',
        evidence: { path: 'harness/', schema: '.agents/schemas/harness-report.schema.json' },
      }),
      '.agents/schemas/harness-report.schema.json': '{}',
    });
    const manifest = manifestFor(target);
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    assert.deepEqual(runChecks(target, { manifest }).failed, []);
  });

  it('moduleMap aponta dir ausente => FAIL', () => {
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({
        version: 1, project: 'demo',
        moduleMap: { plugins: '.opencode/plugins', rules: '.agents/rules', schemas: '.agents/schemas' },
      }),
    });
    const manifest = manifestFor(target);
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    const verdict = runChecks(target, { manifest });
    assert.equal(verdict.passed, false);
    assert.ok(verdict.failed.some((f) => f.includes('config-ref-missing') && f.includes('.agents/rules')));
  });

  it('protectedPaths NAO sao reference-validados (so owned-by-harness)', () => {
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({
        version: 1, project: 'demo',
        protectedPaths: ['.agents/rules/**', 'artefato-inexistente.json'],
      }),
    });
    const manifest = manifestFor(target);
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    assert.deepEqual(runChecks(target, { manifest }).failed, [], 'protectedPaths fora do escopo de refs');
  });

  it('flutter: moduleMap.lib/test NAO são exigidos (nao owned-by-harness) — sem dirs', () => {
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({
        version: 1, project: 'app',
        evidence: { path: 'harness/', schema: '.agents/schemas/harness-report.schema.json' },
        moduleMap: {
          plugins: '.opencode/plugins', rules: '.agents/rules', schemas: '.agents/schemas',
          lib: 'lib', test: 'test',
        },
      }),
      '.opencode/plugins/gate.js': 'export const x = 1;\n',
      '.agents/rules/a.md': '# a\n',
      '.agents/schemas/harness-report.schema.json': '{}\n',
    });
    const manifest = manifestFor(target);
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    assert.deepEqual(runChecks(target, { manifest }).failed, [], 'sem lib/ e test/ => sem falso-FAIL');
  });

  it('flutter: com dirs lib/test presentes => PASS (coerente)', () => {
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({
        version: 1, project: 'app',
        evidence: { path: 'harness/', schema: '.agents/schemas/harness-report.schema.json' },
        moduleMap: {
          plugins: '.opencode/plugins', rules: '.agents/rules', schemas: '.agents/schemas',
          lib: 'lib', test: 'test',
        },
      }),
      '.opencode/plugins/gate.js': 'export const x = 1;\n',
      '.agents/rules/a.md': '# a\n',
      '.agents/schemas/harness-report.schema.json': '{}\n',
      'lib/main.dart': 'void main() {}\n',
      'test/app_test.dart': 'void main() {}\n',
    });
    const manifest = manifestFor(target);
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    assert.deepEqual(runChecks(target, { manifest }).failed, []);
  });

  it('curinga simples (*) tambem e ignorado como referencia', () => {
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({
        version: 1, project: 'demo',
        evidence: { schema: '.agents/schemas/*.json' },
      }),
    });
    const manifest = manifestFor(target);
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    assert.deepEqual(runChecks(target, { manifest }).failed, [], 'glob simples nao e exigido');
  });
});

describe('operability Q3(b): runChecks valida parse (node --check) dos plugins instalados', () => {
  it('plugin sintaticamente invalido => FAIL plugin-parse', () => {
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({ version: 1, project: 'demo' }),
      '.opencode/plugins/broken.js': 'const x = ;\n',
    });
    const manifest = manifestFor(target);
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    const verdict = runChecks(target, { manifest });
    assert.equal(verdict.passed, false, `esperava FAIL: ${JSON.stringify(verdict.failed)}`);
    const entry = verdict.failed.find((f) => f.includes('plugin-parse'));
    assert.ok(entry, 'failed[] contem plugin-parse');
    assert.ok(entry.includes('.opencode/plugins/broken.js'), 'cita o arquivo');
    assert.equal(entry.split('\n').length, 4, 'bloco 4-linhas');
  });

  it('plugin valido (ESM) => sem plugin-parse', () => {
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({ version: 1, project: 'demo' }),
      '.opencode/plugins/gate.js': 'import fs from "node:fs";\nexport const x = () => fs.existsSync("x");\n',
      '.opencode/plugins/lib/seal.mjs': 'export const y = 1;\n',
    });
    const manifest = manifestFor(target);
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    assert.deepEqual(runChecks(target, { manifest }).failed, []);
  });
});

describe('operability Q1/Q2: set do consumidor (collectIncoming)', () => {
  it('inclui .agents/schemas; exclui __tests__/** e scripts/**', () => {
    const src = mkTarget({
      '.agents/schemas/harness-report.schema.json': '{}',
      '.opencode/plugins/gate.js': 'export const x = 1;\n',
      '.opencode/plugins/lib/seal.mjs': 'export const y = 1;\n',
      '.opencode/plugins/__tests__/gate.spec.mjs': 'export const z = 1;\n',
      'scripts/static-checks.mjs': 'export const w = 1;\n',
    });
    const inc = collectIncoming(src);
    assert.ok(inc['.agents/schemas/harness-report.schema.json'], 'schema entra');
    assert.ok(inc['.opencode/plugins/gate.js'], 'plugin entra');
    assert.ok(inc['.opencode/plugins/lib/seal.mjs'], 'lib entra');
    assert.ok(!Object.keys(inc).some((k) => k.includes('__tests__')), 'sem __tests__');
    assert.ok(!Object.keys(inc).some((k) => k.startsWith('scripts/')), 'sem scripts');
  });
});

describe('operability repro end-to-end: instalacao real nao reporta falso-PASS', () => {
  it('destino tem .agents/schemas, sem __tests__/scripts e checks PASS', () => {
    const sourceDir = new URL('../../', import.meta.url).pathname;
    const target = mkTarget({});
    const incoming = collectIncoming(sourceDir, { stacks: [] });
    const out = main({
      target,
      scriptedAnswers: { project: 'harness', stack: 'node', suiteCommand: 'node', pluginsDir: target },
      incomingFiles: incoming,
      options: { allowRoot: true, nodeVersion: 'v26.7.0', backupRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'harness-op-main-')) },
    });
    dirs.push(out.backup.backupDir);
    assert.ok(fs.existsSync(path.join(target, '.agents/schemas/harness-report.schema.json')), 'schema shipado');
    assert.ok(!fs.existsSync(path.join(target, '.opencode/plugins/__tests__')), 'sem __tests__ no consumidor');
    assert.ok(!fs.existsSync(path.join(target, 'scripts')), 'sem scripts no consumidor');
    assert.ok(fs.existsSync(path.join(target, '.opencode/plugins/lib/seal.mjs')), 'runtime lib presente');
    assert.equal(out.checks.passed, true, `checks PASS: ${JSON.stringify(out.checks.failed)}`);
  });
});

describe('operability exit code: checks FAIL nao sai 0 (re-review pre-existente)', () => {
  function sink() {
    return new Writable({ write(_c, _e, cb) { cb(); } });
  }

  it('init com checks FAIL => exitCode 1', async () => {
    const src = mkTarget({
      '.agents/rules/a.md': '# a\n',
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      '.opencode/plugins/evil.js': "const V = require('vuetify/lib');\n",
    });
    const target = mkTarget({});
    const af = path.join(target, 'answers.json');
    fs.writeFileSync(af, JSON.stringify({ project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: '.' }));
    const res = await runInit({
      target, stdin: Readable.from([]), stdout: sink(), stderr: sink(),
      sourceDir: src, answersFile: af, options: { allowRoot: true, yes: true },
    });
    dirs.push(res.backupDir);
    assert.equal(res.checks.passed, false, 'canario literal-denied reprova');
    assert.equal(res.exitCode, 1, 'checks FAIL => exit code != 0 (nao mais falso-sucesso)');
  });
});
