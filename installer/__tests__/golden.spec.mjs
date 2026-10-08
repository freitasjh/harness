// golden.spec.mjs — IM-VAL-01 / IM-BE-01 (I7).
// Baseline congelado (P-01): config de stacks nao-mobile byte-identico ao que
// o instalador produzia ANTES de STACK_PROFILES. As strings abaixo sao literais
// congelados, independentes de install.mjs — qualquer mudanca na saida quebra
// este teste (regressao bloqueia merge).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateConfig, STACK_PROFILES, profileOf } from '../install.mjs';

const NODE_BE = 'N/A — no Java/Maven backend declared by destination Q&A; Node-only stack';
const NODE_FE = 'N/A — no Vue/Vite frontend declared by destination Q&A; Node-only stack';

// Construtor literal do baseline congelado (ordem de chaves preservada).
function baseline(stack, suiteCommand) {
  const nodeOnly = stack === 'node' || stack === 'node-esm';
  const suiteFull = suiteCommand || 'node --test';
  return {
    version: 1,
    project: 'demo',
    stack: {
      backend: nodeOnly ? NODE_BE : `${stack} backend (declared via Q&A)`,
      frontend: nodeOnly ? NODE_FE : `${stack} frontend (declared via Q&A)`,
    },
    moduleMap: {
      plugins: '.opencode/plugins',
      rules: '.agents/rules',
      schemas: '.agents/schemas',
    },
    commands: { suiteFull, unit: suiteFull },
    infra: { composeFile: null, ports: { backend: null, frontend: null } },
    mcp: { required: ['chrome-devtools'] },
    protectedPaths: [
      '.opencode/plugins/**',
      '.agents/rules/**',
      '.agents/schemas/**',
      '.agents/agents/**',
      'opencode.json',
      'harness.config.json',
    ],
    gates: { picco: 'enforce', evidence: 'enforce', hitlBatch: 'enforce', e2eGreenfield: 'warn' },
    riskPaths: ['**/security/**', '**/auth/**'],
    escalateOnRisk: { e2eGreenfield: 'enforce', evidenceScenario: 'required' },
    contraproveTimeoutMs: 900000,
    evidence: { path: 'harness/', schema: '.agents/schemas/harness-report.schema.json' },
  };
}

const NON_MOBILE = ['node', 'node-esm', 'java+vue', 'outra'];

describe('IM-VAL-01 golden: stacks nao-mobile byte-identicos ao baseline (I7)', () => {
  for (const stack of NON_MOBILE) {
    it(`stack=${stack}: suiteCommand explicito => byte-equal`, () => {
      const actual = JSON.stringify(generateConfig({ project: 'demo', stack, suiteCommand: 'make test' }));
      assert.equal(actual, JSON.stringify(baseline(stack, 'make test')));
    });
    it(`stack=${stack}: sem suiteCommand => default congelado byte-equal`, () => {
      const actual = JSON.stringify(generateConfig({ project: 'demo', stack }));
      assert.equal(actual, JSON.stringify(baseline(stack, undefined)));
    });
  }
});

describe('IM-BE-01 registry puro (ADR-008)', () => {
  it('STACK_PROFILES contem os 6 perfis', () => {
    assert.deepEqual(
      Object.keys(STACK_PROFILES).sort(),
      ['dart', 'flutter', 'java+vue', 'node', 'node-esm', 'outra'],
    );
  });
  it('profileOf resolve por lookup; desconhecido => null', () => {
    assert.equal(profileOf('flutter'), STACK_PROFILES.flutter);
    assert.equal(profileOf('nope'), null);
  });
});

describe('IM-BE-01 perfil mobile (RF-12)', () => {
  it('flutter => mcp + suite + analyze + moduleMap', () => {
    const cfg = generateConfig({ project: 'app', stack: 'flutter' });
    assert.equal(cfg.stack.backend, 'flutter/dart mobile (Q&A)');
    assert.equal(cfg.stack.frontend, 'flutter/dart mobile (Q&A)');
    assert.deepEqual(cfg.commands, { suiteFull: 'flutter test', unit: 'flutter test', analyze: 'dart analyze' });
    assert.deepEqual(cfg.mcp.required, ['marionette_mcp', 'dart']);
    assert.deepEqual(cfg.moduleMap, {
      plugins: '.opencode/plugins',
      rules: '.agents/rules',
      schemas: '.agents/schemas',
      lib: 'lib',
      test: 'test',
    });
  });
  it('dart => mcp dart, sem marionette, suite dart test', () => {
    const cfg = generateConfig({ project: 'pkg', stack: 'dart' });
    assert.equal(cfg.stack.backend, 'dart package (Q&A)');
    assert.deepEqual(cfg.commands, { suiteFull: 'dart test', unit: 'dart test', analyze: 'dart analyze' });
    assert.deepEqual(cfg.mcp.required, ['dart']);
    assert.equal(cfg.moduleMap.lib, 'lib');
  });
  it('suiteCommand do Q&A sobrepoe o default do perfil (mobile)', () => {
    const cfg = generateConfig({ project: 'app', stack: 'flutter', suiteCommand: 'fvm flutter test' });
    assert.equal(cfg.commands.suiteFull, 'fvm flutter test');
    assert.equal(cfg.commands.analyze, 'dart analyze', 'analyze continua do perfil');
  });
});
