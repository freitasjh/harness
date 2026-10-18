// golden.spec.mjs — IM-VAL-01 / IM-BE-01 (I7).
// Baseline congelado (P-01): config de stacks nao-mobile byte-identico ao que
// o instalador produzia ANTES de STACK_PROFILES. As strings abaixo sao literais
// congelados, independentes de install.mjs — qualquer mudanca na saida quebra
// este teste (regressao bloqueia merge).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateConfig, STACK_PROFILES, profileOf, AXIS_IDS } from '../install.mjs';

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

// Perfis legados que o registry DEVE preservar: assertado como SUPERCONJUNTO
// (EX-VAL-02/I9), nunca como igualdade — presets novos sao adicoes (D3).
const LEGACY_PROFILES = ['dart', 'flutter', 'java+vue', 'node', 'node-esm', 'outra'];

describe('IM-BE-01 registry puro (ADR-008)', () => {
  it('STACK_PROFILES e SUPERCONJUNTO dos 6 perfis legados (D3/EX-VAL-02)', () => {
    const keys = Object.keys(STACK_PROFILES);
    for (const legacy of LEGACY_PROFILES) {
      assert.ok(keys.includes(legacy), `perfil legado ${legacy} preservado`);
    }
  });
  it('profileOf resolve por lookup; desconhecido => null', () => {
    assert.equal(profileOf('flutter'), STACK_PROFILES.flutter);
    assert.equal(profileOf('nope'), null);
  });
  it('todo perfil expoe axes { backend, frontend } validos (RF-01/D1)', () => {
    for (const [name, p] of Object.entries(STACK_PROFILES)) {
      assert.ok(p.axes && typeof p.axes === 'object', `${name}: axes presente`);
      assert.ok(AXIS_IDS.backend.includes(p.axes.backend), `${name}: backend id no conjunto fechado`);
      assert.ok(AXIS_IDS.frontend.includes(p.axes.frontend), `${name}: frontend id no conjunto fechado`);
    }
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

// C-2 (review Batch 1): o preset novo tambem ganha baseline byte-congelado —
// o builder `baseline()` acima e REUSADO (nenhum assert existente e tocado).
describe('C-2 golden: preset java+react byte-identico ao builder congelado', () => {
  it('stack=java+react: suiteCommand explicito => byte-equal', () => {
    const actual = JSON.stringify(
      generateConfig({ project: 'demo', stack: 'java+react', suiteCommand: 'npm run test:run' }),
    );
    assert.equal(actual, JSON.stringify(baseline('java+react', 'npm run test:run')));
  });

  it('stack=java+react: sem suiteCommand => default congelado byte-equal', () => {
    const actual = JSON.stringify(generateConfig({ project: 'demo', stack: 'java+react' }));
    assert.equal(actual, JSON.stringify(baseline('java+react', undefined)));
  });

  it('java+react congela commands/infra/gates/mcp explicitamente', () => {
    const cfg = generateConfig({ project: 'demo', stack: 'java+react' });
    assert.deepEqual(cfg.commands, { suiteFull: 'node --test', unit: 'node --test' });
    assert.deepEqual(cfg.infra, { composeFile: null, ports: { backend: null, frontend: null } });
    assert.deepEqual(cfg.gates, { picco: 'enforce', evidence: 'enforce', hitlBatch: 'enforce', e2eGreenfield: 'warn' });
    assert.deepEqual(cfg.mcp.required, ['chrome-devtools']);
    assert.deepEqual(cfg.stack, {
      backend: 'java+react backend (declared via Q&A)',
      frontend: 'java+react frontend (declared via Q&A)',
    });
  });
});
