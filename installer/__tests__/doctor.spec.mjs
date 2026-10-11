import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Writable } from 'node:stream';
import {
  runDoctor,
  resolveBackupDir,
  formatError,
  InstallError,
} from '../install.mjs';

let dirs = [];
function mkTarget(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-doctor-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
function mkSource(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-doctor-src-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
afterEach(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); dirs = []; });

function capture() {
  let buf = '';
  const stream = new Writable({ write(c, _e, cb) { buf += c.toString(); cb(); } });
  return { stream, text: () => buf };
}

// ---------- INS-11: doctor D0-D6 ----------

describe('INS-11 doctor D0-D6 read-only', () => {
  it('D6 lista flag p/ x.md divergente + como corrigir + exit 1', () => {
    const src = mkSource({ '.agents/rules/x.md': '# origem harness\n' });
    const target = mkTarget({ '.agents/rules/x.md': '# destino divergente\n' });
    const out = capture();
    const r = runDoctor({ target, sourceDir: src, output: out.stream });
    assert.ok(Array.isArray(r.markers) && r.markers.length === 7, '7 passos D0..D6');
    const flagged = (r.plan || []).filter((p) => p.action === 'flag');
    assert.ok(flagged.some((p) => p.path === '.agents/rules/x.md'), 'D6 lista flag p/ x.md');
    const text = out.text() + JSON.stringify(r.report || {});
    assert.match(text, /flag/i, 'relatorio cita flag');
    assert.match(text, /como corrigir/i, 'relatorio traz como corrigir');
    assert.equal(r.exitCode, 1, 'divergente => exit 1');
  });

  it('sequencia D0..D6 presente em ordem', () => {
    const src = mkSource({ '.agents/rules/a.md': '# a\n' });
    const target = mkTarget({});
    const out = capture();
    const r = runDoctor({ target, sourceDir: src, output: out.stream });
    assert.deepEqual(r.markers, ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6']);
    const text = out.text();
    const idx = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'].map((m) => text.indexOf(m));
    for (const [i, p] of idx.entries()) assert.ok(p >= 0, `marcador D${i} presente`);
    for (let i = 1; i < idx.length; i++) assert.ok(idx[i] > idx[i - 1], 'ordem D0..D6');
  });

  it('target limpo => noop dominante + exit 0 + veredito SAUDAVEL', () => {
    const src = mkSource({ '.agents/rules/a.md': '# a\n' });
    const target = mkTarget({ '.agents/rules/a.md': '# a\n' });
    const out = capture();
    const r = runDoctor({ target, sourceDir: src, output: out.stream });
    const noop = (r.plan || []).filter((p) => p.action === 'noop').length;
    assert.ok(noop >= 1, 'noop presente no limpo');
    assert.equal(r.exitCode, 0, 'limpo => exit 0');
    assert.match(String(r.verdict || ''), /SAUD[AÁ]VEL/i, 'veredito SAUDAVEL');
  });

  it('veredito acionavel cita init ou flags', () => {
    const src = mkSource({ '.agents/rules/x.md': '# origem\n' });
    const divergente = mkTarget({ '.agents/rules/x.md': '# outro\n' });
    const r1 = runDoctor({ target: divergente, sourceDir: src, output: capture().stream });
    assert.match(String(r1.report?.next || r1.report?.verdict || JSON.stringify(r1.report)), /flag|init|doctor|install/i);
    const limpo = mkTarget({});
    const r2 = runDoctor({ target: limpo, sourceDir: src, output: capture().stream });
    assert.match(JSON.stringify(r2.report || {}), /init|create|install/i, 'limpo cita init/install');
  });
});

// ---------- INS-12: zero writes ----------

describe('INS-12 doctor zero writes por construcao', () => {
  it('fs-mock: 0 writes no target durante D0-D6', () => {
    const src = mkSource({ '.agents/rules/a.md': '# a\n' });
    const target = mkTarget({ '.agents/rules/a.md': '# destino\n' });
    const orig = {};
    let writes = 0;
    for (const m of ['writeFileSync', 'mkdirSync', 'cpSync', 'copyFileSync', 'appendFileSync']) {
      orig[m] = fs[m];
      fs[m] = (...a) => { writes++; return orig[m](...a); };
    }
    try {
      runDoctor({ target, sourceDir: src, output: capture().stream });
    } finally {
      for (const m of Object.keys(orig)) fs[m] = orig[m];
    }
    assert.equal(writes, 0, `doctor: zero writes (contadas ${writes})`);
  });

  it('scan estatico: caminho doctor sem applyMerge|writeManifest|apply', () => {
    const src = String(runDoctor);
    for (const pat of [/applyMerge/, /writeManifest/, /\bapply\b/]) {
      assert.ok(!pat.test(src), `caminho doctor sem ${pat}`);
    }
  });

  it('D5 leitura pura: mtime do manifesto inalterado', () => {
    const manifest = { manifestSchemaVersion: 1, source: 'harness@1.0.0', installed: [], merged: [], flagged: [] };
    const target = mkTarget({ '.harness-install.json': JSON.stringify(manifest) });
    const abs = path.join(target, '.harness-install.json');
    const before = fs.statSync(abs).mtimeMs;
    const r = runDoctor({ target, sourceDir: mkSource({}), output: capture().stream });
    const after = fs.statSync(abs).mtimeMs;
    assert.equal(after, before, 'mtime inalterado (leitura pura)');
    assert.ok(r.manifestInfo?.present === true || r.manifest?.present === true || JSON.stringify(r).includes('.harness-install.json'), 'conteudo exibido');
  });
});

// ---------- INS-13: backup-dir validado ----------

describe('INS-13 resolveBackupDir validado (R3)', () => {
  it('backup-dir igual ao target aborta BACKUP_FAIL em bloco 4-linhas', () => {
    const target = mkTarget({});
    assert.throws(
      () => resolveBackupDir(target, target),
      (e) => e instanceof InstallError && e.code === 'BACKUP_FAIL',
    );
    const block = formatError({ what: 'backup invalido', code: 'BACKUP_FAIL', fix: 'escolha um diretorio fora do target.', where: 'installer/install.mjs (resolveBackupDir)' });
    assert.match(block, /\[ERRO\]/);
    assert.match(block, /porquê: BACKUP_FAIL/);
    assert.match(block, /como corrigir:/);
    assert.match(block, /onde ver:/);
  });

  it('repasse sem bypass: doctor valida backup-dir (sem caminho alternativo)', () => {
    const src = mkSource({});
    const target = mkTarget({});
    assert.throws(
      () => runDoctor({ target, sourceDir: src, backupDir: target, output: capture().stream }),
      (e) => e instanceof InstallError && e.code === 'BACKUP_FAIL',
    );
    const fnSrc = String(runDoctor);
    assert.match(fnSrc, /resolveBackupDir/, 'doctor passa por resolveBackupDir');
  });

  it('relativo equivalente, nested e symlink => BACKUP_FAIL', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-bk-'));
    dirs.push(base);
    const t = path.join(base, 'x');
    fs.mkdirSync(t, { recursive: true });
    assert.throws(() => resolveBackupDir(t, path.join(base, 'x', '..', 'x')), (e) => e.code === 'BACKUP_FAIL', 'relativo equivalente');
    assert.throws(() => resolveBackupDir(t, path.join(t, 'sub')), (e) => e.code === 'BACKUP_FAIL', 'nested dentro do target');
    assert.throws(() => resolveBackupDir(path.join(t, 'sub2'), t), (e) => e.code === 'BACKUP_FAIL', 'target dentro do backup');
    const link = path.join(base, 'link-x');
    try { fs.symlinkSync(t, link); } catch { /* sem symlink no FS: pula assert */ }
    if (fs.existsSync(link)) {
      assert.throws(() => resolveBackupDir(t, link), (e) => e.code === 'BACKUP_FAIL', 'symlink equivalente');
    }
  });
});
