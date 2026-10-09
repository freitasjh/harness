import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempScope } from '../../scripts/test-temp.mjs';
import {
  preflight,
  inventory,
  backup,
  InstallError,
  MIN_NODE_VERSION,
  assertInside,
} from '../install.mjs';

// FU-43: o target é rastreado (remoção exata). O backup, não: resolveBackupDir
// sem --backup-dir o cria AO LADO do target em /tmp com nome próprio
// (`.harness-backup-<basename>-<stamp>`), que a spec nunca vê. A varredura é
// OPT-IN explícita e só casa o padrão DESTA spec, com guarda de mtime deste
// run — nunca apaga backup alheio nem sobra de rodada anterior.
const TMP = tempScope({
  label: 'harness-in01',
  patterns: [/^\.harness-backup-harness-in01-[0-9A-Za-z]{6}-\d{4}-/],
});

function mkTarget(files = {}) {
  return TMP.tmp(files);
}

describe('IN-01 S1 sucesso: pre-flight + inventario + backup', () => {
  let target;
  beforeEach(() => { target = mkTarget({ 'opencode.json': '{"a":1}' }); });
  afterEach(() => TMP.cleanup());

  it('backup existe e verificado antes de qualquer escrita', () => {
    const pf = preflight({ target, allowRoot: true, nodeVersion: 'v26.7.0' });
    assert.equal(pf.target, path.resolve(target));
    const inv = inventory(pf.target);
    assert.ok(Array.isArray(inv.layers));
    const bk = backup(pf.target, {});
    assert.ok(fs.existsSync(bk.backupDir), 'backup dir existe');
    assert.ok(bk.verified, 'backup verificado');
    assert.ok(fs.existsSync(path.join(bk.backupDir, 'opencode.json')));
  });

  it('uid 0 / node minimo pinado expostos', () => {
    assert.ok(Array.isArray(MIN_NODE_VERSION) && MIN_NODE_VERSION[0] >= 18);
  });
});

describe('IN-01 S2 falha: aborta antes de qualquer escrita', () => {
  let target;
  beforeEach(() => { target = mkTarget({}); });
  afterEach(() => TMP.cleanup());

  it('.. no target aborta', () => {
    assert.throws(() => preflight({ target: target + '/../escape', allowRoot: true, nodeVersion: 'v26.7.0' }), /outside|traversal|\.\./i);
    assert.throws(() => assertInside(target, path.join(target, '..', 'x')), /outside/i);
  });

  it('uid 0 sem --allow-root aborta', () => {
    assert.throws(() => preflight({ target, uid: 0, allowRoot: false, nodeVersion: 'v26.7.0' }), /root/i);
  });

  it('node abaixo do minimo aborta', () => {
    assert.throws(() => preflight({ target, allowRoot: true, nodeVersion: 'v10.0.0' }), /node/i);
  });

  it('I1: falha injetada no backup => aborta e nada escrito', () => {
    const pf = preflight({ target, allowRoot: true, nodeVersion: 'v26.7.0' });
    assert.throws(() => backup(pf.target, { injectFailure: true }), InstallError);
    const entries = fs.readdirSync(target);
    assert.deepEqual(entries, [], 'nenhuma escrita apos falha de backup');
  });
});

describe('IN-01 S3 borda: manifesto pre-existente aborta', () => {
  let target;
  afterEach(() => TMP.cleanup());

  it('re-instalacao (manifesto harness) aborta com instrucao', () => {
    target = mkTarget({
      '.harness-install.json': JSON.stringify({ manifestSchemaVersion: 1, source: 'harness@abc', target: '/x' }),
    });
    assert.throws(() => preflight({ target, allowRoot: true, nodeVersion: 'v26.7.0' }), /re-?instal/i);
  });

  it('manifesto alheio aborta com instrucao distinta', () => {
    target = mkTarget({ '.harness-install.json': JSON.stringify({ foo: 'bar' }) });
    assert.throws(() => preflight({ target, allowRoot: true, nodeVersion: 'v26.7.0' }), /manifesto|foreign|alheio/i);
  });
});
