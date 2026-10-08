// mobile.spec.mjs — IM-BE-02 (validateAnswer flutter/dart) + IM-BE-03 (filtro por stack).
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { validateAnswer, collectIncoming, InstallError } from '../install.mjs';

let dirs = [];
function mkTarget(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-mobile-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
afterEach(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); dirs = []; });

const PUBSPEC_FLUTTER = `name: demo_app
environment:
  sdk: '>=3.0.0 <4.0.0'
dependencies:
  flutter:
    sdk: flutter
`;
const PUBSPEC_DART = `name: demo_pkg
environment:
  sdk: '>=3.0.0 <4.0.0'
dependencies:
  path: ^1.0.0
`;

describe('IM-BE-02 validateAnswer stack mobile (RF-11/ADR-005)', () => {
  it('rama 1: flutter ok quando pubspec declara sdk: flutter', () => {
    const t = mkTarget({ 'pubspec.yaml': PUBSPEC_FLUTTER });
    assert.equal(validateAnswer(t, 'stack', 'flutter'), 'flutter');
  });

  it('rama 2: dart ok quando pubspec NAO declara flutter', () => {
    const t = mkTarget({ 'pubspec.yaml': PUBSPEC_DART });
    assert.equal(validateAnswer(t, 'stack', 'dart'), 'dart');
  });

  it('rama 3: pubspec ausente => BAD_ANSWER (fail-closed)', () => {
    const t = mkTarget({});
    assert.throws(() => validateAnswer(t, 'stack', 'flutter'), (e) => e instanceof InstallError && e.code === 'BAD_ANSWER');
    assert.throws(() => validateAnswer(t, 'stack', 'dart'), /pubspec/i);
  });

  it('rama 4: mismatch flutter pubspec + stack dart => erro "use flutter"', () => {
    const t = mkTarget({ 'pubspec.yaml': PUBSPEC_FLUTTER });
    assert.throws(() => validateAnswer(t, 'stack', 'dart'), /flutter/i);
  });

  it('rama 4b: pubspec dart + stack flutter => erro (sem sdk: flutter)', () => {
    const t = mkTarget({ 'pubspec.yaml': PUBSPEC_DART });
    assert.throws(() => validateAnswer(t, 'stack', 'flutter'), /flutter|sdk/i);
  });

  it('retrocompat: stack nao-mobile nao exige pubspec', () => {
    const t = mkTarget({});
    assert.equal(validateAnswer(t, 'stack', 'node'), 'node');
    assert.equal(validateAnswer(t, 'stack', 'java+vue'), 'java+vue');
    assert.equal(validateAnswer(t, 'stack', 'outra'), 'outra');
    assert.equal(validateAnswer(t, 'stack', 'node-esm'), 'node-esm');
    assert.throws(() => validateAnswer(t, 'stack', 'ruim'), /stack/i);
  });
});

describe('IM-BE-03 collectIncoming filtra por stack (I10/A4)', () => {
  function mkSource({ lock = null, skills = {} } = {}) {
    const files = {};
    for (const [name, body] of Object.entries(skills)) files[`.agents/skills/${name}/SKILL.md`] = body;
    if (lock) files['.agents/skills/.vendor-lock.json'] = JSON.stringify(lock);
    return mkTarget(files);
  }
  const LOCK = {
    version: 1,
    skills: {
      'flutter-widgets': { stacks: ['flutter'] },
      'dart-core': { stacks: ['dart'] },
      'common-rule': {},
    },
  };

  it('com lock + stacks node => mobile fora, comum dentro, lock nunca copiado', () => {
    const src = mkSource({ lock: LOCK, skills: {
      'flutter-widgets': '# flutter\n', 'dart-core': '# dart\n', 'common-rule': '# comum\n',
    } });
    const inc = collectIncoming(src, { stacks: [] });
    assert.ok(!inc['.agents/skills/flutter-widgets/SKILL.md'], 'skill flutter excluida');
    assert.ok(!inc['.agents/skills/dart-core/SKILL.md'], 'skill dart excluida');
    assert.ok(inc['.agents/skills/common-rule/SKILL.md'], 'skill comum permanece');
    assert.ok(!Object.keys(inc).some((k) => k.endsWith('.vendor-lock.json')), 'lock nunca no incoming');
  });

  it('com lock + stacks flutter => flutter entra; dart fora (perfil flutter)', () => {
    const src = mkSource({ lock: LOCK, skills: { 'flutter-widgets': '# flutter\n', 'dart-core': '# dart\n' } });
    const inc = collectIncoming(src, { stacks: ['flutter', 'dart'] });
    assert.ok(inc['.agents/skills/flutter-widgets/SKILL.md'], 'flutter aceita');
    assert.ok(inc['.agents/skills/dart-core/SKILL.md'], 'dart aceita no perfil flutter');
  });

  it('sem lock => nada filtrado (retrocompat byte-identica)', () => {
    const src = mkSource({ lock: null, skills: { 'flutter-widgets': '# flutter\n', 'dart-core': '# dart\n' } });
    const inc = collectIncoming(src, { stacks: [] });
    assert.ok(inc['.agents/skills/flutter-widgets/SKILL.md'], 'sem lock: tudo entra');
    assert.ok(inc['.agents/skills/dart-core/SKILL.md']);
    assert.deepEqual(inc, collectIncoming(src), 'sem opts == comportamento legado');
  });
});
