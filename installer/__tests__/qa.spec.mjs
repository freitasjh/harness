import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  QUESTIONS,
  validateAnswer,
  collectAnswers,
  serializeAnswers,
} from '../install.mjs';

let dirs = [];
function mkTemp(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in02-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe('IN-02 S1: respostas validas => answers completos', () => {
  it('Q&A fake com respostas scriptadas passa', () => {
    const target = mkTemp({});
    fs.mkdirSync(path.join(target, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(target, 'scripts', 'suite.sh'), '#!/bin/sh\n');
    const scripted = {
      project: 'demo',
      suiteCommand: path.join(target, 'scripts', 'suite.sh'),
      pluginsDir: target,
      stack: 'node',
    };
    const answers = collectAnswers(target, scripted);
    assert.equal(answers.project, 'demo');
    assert.equal(answers.stack, 'node');
  });
});

describe('IN-02 S2: resposta invalida => rejeita', () => {
  it('path inexistente rejeita', () => {
    const target = mkTemp({});
    assert.throws(() => validateAnswer(target, 'pluginsDir', '/nao/existe/xyz'), /exist/i);
  });
  it('comando que nao resolve rejeita', () => {
    const target = mkTemp({});
    assert.throws(() => validateAnswer(target, 'suiteCommand', '/nao/existe/cmd-xyz'), /resolv|not found|ENOENT/i);
  });
  it('collectAnswers com path ruim rejeita e nao retorna parcial valido', () => {
    const target = mkTemp({});
    assert.throws(() => collectAnswers(target, { project: 'x', suiteCommand: 'node', pluginsDir: '/nope', stack: 'node' }), /exist|outside/i);
  });
});

describe('IN-02 S3: segredo ausente de disco', () => {
  it('campo secret so-memoria: serializacao exclui', () => {
    const q = QUESTIONS.find((x) => x.secret);
    assert.ok(q, 'existe ao menos uma questao secret');
    const answers = { project: 'demo', stack: 'node', [q.key]: 'FAKE-SECRET-abc123' };
    const disk = serializeAnswers(answers);
    assert.ok(!JSON.stringify(disk).includes('FAKE-SECRET-abc123'), 'segredo ausente do objeto serializavel');
    assert.equal(answers[q.key], 'FAKE-SECRET-abc123', 'memoria mantem');
  });
  it('QUESTIONS marca secret explicitamente', () => {
    for (const q of QUESTIONS.filter((x) => x.secret)) {
      assert.ok(q.key && q.prompt, 'secret tem key+prompt');
    }
  });
});
