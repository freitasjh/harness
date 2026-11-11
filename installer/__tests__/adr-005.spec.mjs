import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  presetOfAxes,
  presetsOfAxes,
  collectAnswers,
  generateConfig,
  defaultSuiteFor,
  InstallError,
} from '../install.mjs';

function mkTemp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-adr005-'));
  return d;
}

describe('ADR-005 BE-08: presetOfAxes / presetsOfAxes (puros)', () => {
  it("presetOfAxes('java','react') === 'java+react'", () => {
    assert.equal(presetOfAxes('java', 'react'), 'java+react');
  });
  it("presetOfAxes('node','none') === 'node'", () => {
    assert.equal(presetOfAxes('node', 'none'), 'node');
  });
  it("presetOfAxes('java','flutter') === null", () => {
    assert.equal(presetOfAxes('java', 'flutter'), null);
  });
  it("presetsOfAxes('node','none') === ['node','node-esm']", () => {
    assert.deepEqual(presetsOfAxes('node', 'none'), ['node', 'node-esm']);
  });
});

describe('ADR-005 BE-08: collectAnswers (5+ cenários)', () => {
  it('legado: stack apenas, sem backend/frontend', () => {
    const t = mkTemp();
    const a = collectAnswers(t, { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: t });
    assert.equal(a.stack, 'node');
    assert.equal(a.backend, undefined);
    assert.equal(a.frontend, undefined);
  });

  it('novo: backend+frontend sem stack resolve preset', () => {
    const t = mkTemp();
    const a = collectAnswers(t, { project: 'demo', backend: 'java', frontend: 'react', suiteCommand: 'node', pluginsDir: t });
    assert.equal(a.stack, 'java+react');
    assert.equal(a.backend, 'java');
    assert.equal(a.frontend, 'react');
  });

  it('misto consistente: stack === preset', () => {
    const t = mkTemp();
    const a = collectAnswers(t, { project: 'demo', stack: 'java+react', backend: 'java', frontend: 'react', suiteCommand: 'node', pluginsDir: t });
    assert.equal(a.stack, 'java+react');
  });

  it('misto inconsistente: stack !== preset => BAD_ANSWER', () => {
    const t = mkTemp();
    assert.throws(
      () => collectAnswers(t, { project: 'demo', stack: 'node', backend: 'java', frontend: 'react', suiteCommand: 'node', pluginsDir: t }),
      (e) => e instanceof InstallError && e.code === 'BAD_ANSWER',
    );
  });

  it('nenhum: sem stack nem backend => BAD_ANSWER', () => {
    const t = mkTemp();
    assert.throws(
      () => collectAnswers(t, { project: 'demo', suiteCommand: 'node', pluginsDir: t }),
      (e) => e instanceof InstallError && e.code === 'BAD_ANSWER',
    );
  });

  it('paired: backend sem frontend => BAD_ANSWER', () => {
    const t = mkTemp();
    assert.throws(
      () => collectAnswers(t, { project: 'demo', backend: 'java', suiteCommand: 'node', pluginsDir: t }),
      (e) => e instanceof InstallError && e.code === 'BAD_ANSWER',
    );
  });

  it('answersVersion ausente aceito; :2 aceito', () => {
    const t1 = mkTemp();
    const a1 = collectAnswers(t1, { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: t1 });
    assert.equal(a1.answersVersion, undefined);
    const t2 = mkTemp();
    const a2 = collectAnswers(t2, { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: t2, answersVersion: 2 });
    assert.equal(a2.answersVersion, 2);
  });
});

describe('ADR-005 BE-08: generateConfig com axes == preset output', () => {
  it('shape novo equals output do preset', () => {
    const a = generateConfig({ project: 'demo', backend: 'java', frontend: 'react' });
    const b = generateConfig({ project: 'demo', stack: 'java+react' });
    assert.deepEqual(a, b);
  });
});

describe('ADR-005 BE-08: defaultSuiteFor com objeto {backend,frontend}', () => {
  it('objeto resolve igual ao preset string', () => {
    assert.equal(defaultSuiteFor({ backend: 'java', frontend: 'react' }), defaultSuiteFor('java+react'));
  });
});
