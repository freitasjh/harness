// dogfood-mobile.spec.mjs — IM-VAL-06: dogfood do instalador num projeto Flutter
// copiado para /tmp. Prova: config mobile correto + checks PASS + origem intocada
// + copia removida + evidencia harness-report gravada. Sem rede, sem TTY real.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  assertMobileConfig,
  sanitizeFlutterCopy,
  runDogfoodMobile,
  MOBILE_HARNESS_LAYERS,
} from '../dogfood-mobile.mjs';

let dirs = [];
function mkTemp(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-dfm-'));
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

function mkFlutterSource() {
  return mkTemp({
    'pubspec.yaml': PUBSPEC_FLUTTER,
    'analysis_options.yaml': 'include: package:flutter_lints/flutter.yaml\n',
    'lib/main.dart': 'void main() {}\n',
    'test/widget_test.dart': 'void main() {}\n',
  });
}

describe('IM-VAL-06 assertMobileConfig — perfil flutter do harness.config.json', () => {
  const good = {
    stack: { backend: 'flutter/dart mobile (Q&A)', frontend: 'flutter/dart mobile (Q&A)' },
    commands: { suiteFull: 'flutter test', unit: 'flutter test', analyze: 'dart analyze' },
    mcp: { required: ['marionette_mcp', 'dart'] },
    moduleMap: { lib: 'lib', test: 'test' },
  };

  it('aceita o config mobile correto', () => {
    const r = assertMobileConfig(good);
    assert.equal(r.ok, true, `esperava ok, erros: ${JSON.stringify(r.errors)}`);
    assert.deepEqual(r.errors, []);
  });

  it('rejeita config sem analyze, sem marionette_mcp ou com stack errada', () => {
    const r = assertMobileConfig({
      stack: { backend: 'node', frontend: 'node' },
      commands: { suiteFull: 'flutter test' },
      mcp: { required: ['dart'] },
      moduleMap: {},
    });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => /analyze/i.test(e)), 'acusa analyze ausente');
    assert.ok(r.errors.some((e) => /marionette_mcp/i.test(e)), 'acusa marionette_mcp ausente');
    assert.ok(r.errors.some((e) => /stack/i.test(e)), 'acusa stack nao-mobile');
  });
});

describe('IM-VAL-06 sanitizeFlutterCopy — copia vira projeto Flutter limpo', () => {
  it('remove as camadas do harness e preserva o projeto', () => {
    const copy = mkTemp({
      'pubspec.yaml': PUBSPEC_FLUTTER,
      'lib/main.dart': 'void main() {}\n',
      '.agents/rules/x.md': '# regra\n',
      '.opencode/plugins/gate.js': '// gate\n',
      'opencode.json': JSON.stringify({ plugin: ['x'] }),
      'harness.config.json': JSON.stringify({ version: 1 }),
      '.harness-install.json': JSON.stringify({ manifestSchemaVersion: 1 }),
    });
    const { removed } = sanitizeFlutterCopy(copy);
    for (const rel of MOBILE_HARNESS_LAYERS) {
      assert.ok(!fs.existsSync(path.join(copy, rel)), `${rel} removido`);
    }
    assert.ok(fs.existsSync(path.join(copy, 'pubspec.yaml')), 'pubspec preservado');
    assert.ok(fs.existsSync(path.join(copy, 'lib/main.dart')), 'lib preservado');
    assert.ok(removed.length >= MOBILE_HARNESS_LAYERS.length, 'removidos listados');
  });
});

describe('IM-VAL-06 runDogfoodMobile — instalacao real em copia /tmp', () => {
  it('config mobile + checks PASS + evidencia + copia removida + origem intocada', async () => {
    const source = mkFlutterSource();
    const evidenceDir = mkTemp({});
    const res = await runDogfoodMobile({
      source,
      keep: false,
      evidenceDir,
      runSuites: false,
      suiteCommand: 'node',
    });

    assert.equal(res.ok, true, `dogfood falhou: checks=${JSON.stringify(res.checks)} flags=${JSON.stringify(res.flags)}`);
    assert.equal(res.checks.passed, true, 'checks PASS');
    assert.deepEqual(res.checks.failed, []);
    assert.equal(res.config.commands.analyze, 'dart analyze', 'analyze do perfil');
    assert.deepEqual(res.config.mcp.required, ['marionette_mcp', 'dart'], 'mcp do perfil');
    assert.equal(res.config.moduleMap.lib, 'lib', 'moduleMap lib');
    assert.equal(res.config.moduleMap.test, 'test', 'moduleMap test');
    assert.equal(res.sourceUntouched, true, 'origem somente leitura');
    assert.equal(res.copyRemoved, true, 'copia limpa ao final');
    assert.ok(!fs.existsSync(res.copy), 'copia removida do disco');
    assert.ok(fs.existsSync(res.evidencePath), 'evidencia gravada');

    const ev = JSON.parse(fs.readFileSync(res.evidencePath, 'utf8'));
    for (const k of ['version', 'demand', 'agent', 'phase', 'gitSha', 'commands', 'counts', 'evaluation', 'brainStore', 'cleanup', 'selfReported']) {
      assert.ok(k in ev, `evidencia tem ${k} (harness-report schema)`);
    }
    assert.ok(Array.isArray(ev.commands) && ev.commands.length >= 1, 'commands nao-vazio');
    assert.equal(ev.selfReported, true);
  });

  it('alvo fora de /tmp => aborta (nunca instala no repo real)', async () => {
    const source = mkFlutterSource();
    await assert.rejects(
      () => runDogfoodMobile({ source, keep: true, runSuites: false, suiteCommand: 'node', target: '/etc/harness-dogfood-probe' }),
      /tmp|dogfood/i,
    );
  });
});
