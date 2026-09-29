import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  normalizeSection,
  hasHarnessSection,
  mergeOpencodeJson,
  mergeAgentFile,
  planMerge,
  applyMerge,
  buildManifest,
  InstallError,
} from '../install.mjs';

let dirs = [];
function mkTarget(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in04-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
afterEach(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); dirs = []; });

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

describe('IN-04 S1: destino novo => tudo instalado + manifesto completo', () => {
  it('plan classifica novo + apply escreve CONTEUDO do incoming + manifesto schema-conformant (FU-21)', () => {
    const target = mkTarget({});
    const incoming = {
      'opencode.json': JSON.stringify({ plugin: ['harness'], instructions: ['a'] }),
      '.agents/rules/x.md': '# rule\n',
    };
    const plan = planMerge(target, incoming, null);
    assert.ok(plan.every((p) => p.action === 'create'), 'tudo novo');
    const res = applyMerge(target, plan, { incomingFiles: incoming, dryRun: false });
    assert.ok(res.written.length === 2);
    for (const [rel, body] of Object.entries(incoming)) {
      assert.equal(fs.readFileSync(path.join(target, rel), 'utf8'), body, `conteudo gravado == incoming: ${rel}`);
    }
    const m = buildManifest({
      target, backupDir: path.join(target, '.harness-backup-test'),
      installed: res.written.map((w) => ({ path: w.path, kind: 'file' })),
      merged: [], flagged: [],
      answers: { project: 'demo', stack: 'node' },
      checks: { passed: true, failed: [] },
      fileContents: Object.fromEntries(res.written.map((w) => [w.path, fs.readFileSync(path.join(target, w.path), 'utf8')])),
    });
    assert.equal(m.manifestSchemaVersion, 1);
    for (const h of m.fileHashes) {
      assert.ok(h.path && /^[a-f0-9]{64}$/.test(h.sha256), 'hash Y1 por arquivo');
    }
    assert.ok(Array.isArray(m.flaggedResolution) && Array.isArray(m.validationMarks));
    assert.ok(m.target && m.backupDir && m.date && m.version && m.source);
  });
});

describe('IN-04 S2: corrompido-aborta R1 / colisao => flag', () => {
  it('opencode.json invalido aborta (R1)', () => {
    const target = mkTarget({ 'opencode.json': '{INVALID{{{' });
    assert.throws(() => planMerge(target, { 'opencode.json': '{}' }, null), InstallError);
  });
  it('colisao real em opencode.json => flag com motivo', () => {
    const target = mkTarget({ 'opencode.json': JSON.stringify({ permission: { bash: 'deny *' } }) });
    const plan = planMerge(target, { 'opencode.json': JSON.stringify({ permission: { other: 'x' } }) }, null);
    const flagged = plan.filter((p) => p.action === 'flag');
    assert.ok(flagged.length === 1 && flagged[0].reason, 'flag com motivo');
  });
  it('rules existente diferente => flag (nunca auto-merge de prosa)', () => {
    const target = mkTarget({ '.agents/rules/a.md': '# outro conteudo\n' });
    const plan = planMerge(target, { '.agents/rules/a.md': '# harness conteudo\n' }, null);
    assert.equal(plan[0].action, 'flag');
  });
});

describe('IN-04 S3: detectores normalizados R4 + whitespace G2', () => {
  it('secao Harness casa com whitespace variado', () => {
    assert.ok(hasHarnessSection('##   Harness   v7\nbody'), 'casa normalizado');
    assert.ok(hasHarnessSection('##\tharness\tV7'), 'tab normalizado');
  });
  it('quase-igual NAO casa (teste negativo)', () => {
    assert.ok(!hasHarnessSection('## Harness v6\nbody'), 'v6 nao casa');
    assert.ok(!hasHarnessSection('## Harnessing stuff\n'), 'prefixo nao casa');
  });
  it('agents/* com secao ausente => merge anexa; presente => flag', () => {
    const noSection = mergeAgentFile('# Agent\ncorpo\n', '## Harness v7\nnovo\n');
    assert.equal(noSection.action, 'merge');
    assert.ok(hasHarnessSection(noSection.content));
    const withSection = mergeAgentFile('# Agent\n## Harness v7\nold\n', '## Harness v7\nnovo\n');
    assert.equal(withSection.action, 'flag');
  });
  it('merge opencode.json: plugin uniao + instructions append + permission so-adiciona', () => {
    const existing = { plugin: ['a'], instructions: ['x'], permission: { bash: 'deny rm' } };
    const inc = { plugin: ['a', 'b'], instructions: ['x', 'y'], permission: { bash: 'allow all' } };
    const { merged, conflict } = mergeOpencodeJson(existing, inc);
    assert.deepEqual(merged.plugin.sort(), ['a', 'b']);
    assert.ok(merged.instructions.includes('x') && merged.instructions.includes('y'));
    assert.equal(merged.permission.bash, 'deny rm', 'permission preservada');
    assert.ok(conflict === true, 'conflito real sinalizado');
  });
  it('normalizeSection colapsa whitespace (G2)', () => {
    assert.equal(normalizeSection('a   b\tc'), normalizeSection('a b c'));
  });
  it('dry-run nao escreve nada', () => {
    const target = mkTarget({});
    const plan = planMerge(target, { 'opencode.json': '{}' }, null);
    const res = applyMerge(target, plan, { dryRun: true });
    assert.equal(res.written.length, 0);
    assert.ok(!fs.existsSync(path.join(target, 'opencode.json')));
  });
});
