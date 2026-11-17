// golden.spec.mjs — IM-VAL-01 / IM-BE-01 (I7).
// Baseline congelado (P-01): config de stacks nao-mobile byte-identico ao que
// o instalador produzia ANTES de STACK_PROFILES. As strings abaixo sao literais
// congelados, independentes de install.mjs — qualquer mudanca na saida quebra
// este teste (regressao bloqueia merge).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { generateConfig, STACK_PROFILES, profileOf, AXIS_IDS } from '../installer-contract.mjs';
import { AXIS_PAIRS, PAIR_KEYS, pairKey } from '../eixos.mjs';

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

const NON_MOBILE = ['node', 'node-esm', 'java+vue', 'outra', 'rust', 'nestjs', 'node+react', 'nestjs+react', 'rust+react'];

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

// C-2 (Batch 4): baselines explicitos para os presets novos (rust, nestjs, node+react,
// nestjs+react, rust+react) — mesmo padrao do java+react, sem nodeOnly.
const NEW_WEB_PRESETS = ['rust', 'nestjs', 'node+react', 'nestjs+react', 'rust+react'];
describe('C-2 golden: presets novos byte-identicos ao builder congelado', () => {
  for (const stack of NEW_WEB_PRESETS) {
    it(`stack=${stack}: suiteCommand explicito => byte-equal`, () => {
      const actual = JSON.stringify(
        generateConfig({ project: 'demo', stack, suiteCommand: 'npm run test:run' }),
      );
      assert.equal(actual, JSON.stringify(baseline(stack, 'npm run test:run')));
    });
    it(`stack=${stack}: sem suiteCommand => default congelado byte-equal`, () => {
      const actual = JSON.stringify(generateConfig({ project: 'demo', stack }));
      assert.equal(actual, JSON.stringify(baseline(stack, undefined)));
    });
    it(`${stack} congela commands/infra/gates/mcp explicitamente`, () => {
      const cfg = generateConfig({ project: 'demo', stack });
      assert.deepEqual(cfg.commands, { suiteFull: 'node --test', unit: 'node --test' });
      assert.deepEqual(cfg.infra, { composeFile: null, ports: { backend: null, frontend: null } });
      assert.deepEqual(cfg.gates, { picco: 'enforce', evidence: 'enforce', hitlBatch: 'enforce', e2eGreenfield: 'warn' });
      assert.deepEqual(cfg.mcp.required, ['chrome-devtools']);
      assert.deepEqual(cfg.stack, {
        backend: `${stack} backend (declared via Q&A)`,
        frontend: `${stack} frontend (declared via Q&A)`,
      });
    });
  }
});

// ===========================================================================
// VAL-01 (ADR-001 §2.3 / SPEC RF-08, RF-09) — baseline 48 combinações (8×6).
//
// C1 (autoridade): as tabelas ORACULO_* abaixo são LITERAIS escritas à mão,
// espelhando as tabelas ORACULO_STACK_* de eixos-stack.spec.mjs (oráculo
// independente). NENHUM valor esperado é produzido pelo gerador sob teste —
// isso seria characterization (C3, proibida). Cada par tem 1 sha256 ratificado
// no RELATÓRIO harness/prd-eixos-separados-cli-adr-001.json ANTES de virar
// baseline; `cargo insta review`/diff é apenas revisor de diff (C2).
//
// Contagem honesta: 11 pares são herdados dos 12 presets (node e node-esm
// colapsam em node+none); 37 pares são novos. O ADR fala em 36 (48−12 nomes
// de preset) — off-by-one declarado no RELATÓRIO, sem queda de cobertura:
// 37 ≥ 36 e todos os 48 pares têm sha256 ratificado.
// ===========================================================================

const ORACULO_TEXTO_BACKEND = Object.freeze({
  java: 'java backend', node: 'node backend', rust: 'rust backend', nestjs: 'nestjs backend',
  dart: 'dart backend', flutter: 'flutter backend', other: 'other backend', none: 'N/A — no backend axis',
});
const ORACULO_TEXTO_FRONTEND = Object.freeze({
  vue: 'vue frontend', react: 'react frontend', dart: 'dart frontend', flutter: 'flutter frontend',
  other: 'other frontend', none: 'N/A — no frontend axis',
});
const ORACULO_COMMANDS_BACKEND = Object.freeze({
  java: {}, node: { suiteFull: 'node --test', unit: 'node --test' }, rust: {}, nestjs: {},
  dart: { suiteFull: 'dart test', unit: 'dart test', analyze: 'dart analyze' },
  flutter: { suiteFull: 'flutter test', unit: 'flutter test', analyze: 'dart analyze' },
  other: {}, none: {},
});
const ORACULO_MODULEMAP_EXTRA_BACKEND = Object.freeze({
  java: {}, node: {}, rust: {}, nestjs: {},
  dart: { lib: 'lib', test: 'test' }, flutter: { lib: 'lib', test: 'test' }, other: {}, none: {},
});
const ORACULO_MCP_FRONTEND = Object.freeze({
  vue: ['chrome-devtools'], react: ['chrome-devtools'], dart: ['dart'],
  flutter: ['marionette_mcp', 'dart'], other: [], none: [],
});
const ORACULO_STACK_BACKEND = Object.freeze({
  java: [], node: [], rust: ['rust'], nestjs: ['nestjs'],
  dart: ['dart'], flutter: [], other: [], none: [],
});
const ORACULO_STACK_FRONTEND = Object.freeze({
  vue: [], react: ['react'], dart: [], flutter: [], other: [], none: [],
});
const ORACULO_EXCECAO_STACKS = Object.freeze({ 'flutter+flutter': ['flutter', 'dart'] });
const ORACULO_INVARIANTES = Object.freeze({
  moduleMapBase: Object.freeze({ plugins: '.opencode/plugins', rules: '.agents/rules', schemas: '.agents/schemas' }),
  infra: Object.freeze({ composeFile: null, ports: Object.freeze({ backend: null, frontend: null }) }),
  protectedPaths: Object.freeze([
    '.opencode/plugins/**', '.agents/rules/**', '.agents/schemas/**', '.agents/agents/**',
    'opencode.json', 'harness.config.json',
  ]),
  gates: Object.freeze({ picco: 'enforce', evidence: 'enforce', hitlBatch: 'enforce', e2eGreenfield: 'warn' }),
  riskPaths: Object.freeze(['**/security/**', '**/auth/**']),
  escalateOnRisk: Object.freeze({ e2eGreenfield: 'enforce', evidenceScenario: 'required' }),
  contraproveTimeoutMs: 900000,
  evidence: Object.freeze({ path: 'harness/', schema: '.agents/schemas/harness-report.schema.json' }),
});

function esperadoPorEixo(backend, frontend) {
  const chave = `${backend}+${frontend}`;
  const stacks = Object.prototype.hasOwnProperty.call(ORACULO_EXCECAO_STACKS, chave)
    ? [...ORACULO_EXCECAO_STACKS[chave]]
    : [...ORACULO_STACK_BACKEND[backend], ...ORACULO_STACK_FRONTEND[frontend]];
  return {
    version: 1,
    project: 'demo',
    stack: { backend: ORACULO_TEXTO_BACKEND[backend], frontend: ORACULO_TEXTO_FRONTEND[frontend] },
    moduleMap: { ...ORACULO_INVARIANTES.moduleMapBase, ...ORACULO_MODULEMAP_EXTRA_BACKEND[backend] },
    commands: { ...ORACULO_COMMANDS_BACKEND[backend] },
    infra: { composeFile: null, ports: { ...ORACULO_INVARIANTES.infra.ports } },
    mcp: { required: [...ORACULO_MCP_FRONTEND[frontend]] },
    protectedPaths: [...ORACULO_INVARIANTES.protectedPaths],
    gates: { ...ORACULO_INVARIANTES.gates },
    riskPaths: [...ORACULO_INVARIANTES.riskPaths],
    escalateOnRisk: { ...ORACULO_INVARIANTES.escalateOnRisk },
    contraproveTimeoutMs: ORACULO_INVARIANTES.contraproveTimeoutMs,
    evidence: { ...ORACULO_INVARIANTES.evidence },
    _stacks: stacks,
  };
}

// 1 literal (sha256 do JSON canônico) por combinação. `origem=herdado` = par
// já coberto por algum dos 12 presets; `origem=novo` = ratificação nova.
const BASELINE_48 = Object.freeze({
  'java+vue': Object.freeze({ origem: 'herdado', sha256: '86f29679f6c9e9e71dc6ca3db6e5fe923290d4705d28506a9db4677f264e2b0c' }), // stacks=[]
  'java+react': Object.freeze({ origem: 'herdado', sha256: '592d601e1c358d415e367c3782c9d093f1db08bf5d275c0e2b60a1c1283b629a' }), // stacks=["react"]
  'java+dart': Object.freeze({ origem: 'novo', sha256: 'd15f9f19d562b456b4a38b39f6df8cd028fbdce9f623895f713e03aba1c52c7d' }), // stacks=[]
  'java+flutter': Object.freeze({ origem: 'novo', sha256: 'e4d7ae3da0d5b7e06e0c30705b24e4d6867523e88b22cd6e9d6e60ad0abb4932' }), // stacks=[]
  'java+other': Object.freeze({ origem: 'novo', sha256: '930f4c4204e84c236c5dfbbc1966c09ffe092e805dd681d2ade9c3c7cd7376b2' }), // stacks=[]
  'java+none': Object.freeze({ origem: 'novo', sha256: 'bb7d89d904617e029c1eb5dc154f0f44a48b1a44a72b8f2523ce5f537480527e' }), // stacks=[]
  'node+vue': Object.freeze({ origem: 'novo', sha256: 'a7c87078bdef46bcf89a05efa0992a6ce3632bc7916a7164064abec75b1bbd55' }), // stacks=[]
  'node+react': Object.freeze({ origem: 'herdado', sha256: 'ef944ce9b824be7ea394c617fcde255b6258085b4f8b1da747cabb5a1f5cbad0' }), // stacks=["react"]
  'node+dart': Object.freeze({ origem: 'novo', sha256: '043af3174eb8141015ac44da28de8692409a30c291d28a8d18519b7179a4e198' }), // stacks=[]
  'node+flutter': Object.freeze({ origem: 'novo', sha256: '1729f893cb0c80ea21b01509a7b1f3fd8a87fc2e832ddcf8f4500e3917e21e74' }), // stacks=[]
  'node+other': Object.freeze({ origem: 'novo', sha256: '935d57570110098593cc53d5971e5ac60a23696e3f025bb3de16467ee35319b2' }), // stacks=[]
  'node+none': Object.freeze({ origem: 'herdado', sha256: 'e9a653009b1707cc92d1f3cf7499c78f848a9605050edf53208e98d256e109b8' }), // stacks=[]
  'rust+vue': Object.freeze({ origem: 'novo', sha256: '7a2f5cfa08c337932759247e5b7dbc9de4efd6d0d80d69e18f79ab96a54e6876' }), // stacks=["rust"]
  'rust+react': Object.freeze({ origem: 'herdado', sha256: '3324b6df110fe62f47fbcb610ad5eaec75db523a5af0091d527e52138bacbe19' }), // stacks=["rust","react"]
  'rust+dart': Object.freeze({ origem: 'novo', sha256: 'c3d09ef1b03744098a5a2c6a71a95a5a8bc8193774c1d1c0d7af455cda295e88' }), // stacks=["rust"]
  'rust+flutter': Object.freeze({ origem: 'novo', sha256: '720e5b0857d274243d382803068cd69e4d7665ee7ed7b794b920363efb93f64b' }), // stacks=["rust"]
  'rust+other': Object.freeze({ origem: 'novo', sha256: '9fd75d840cdf0507b12ff2411ec146500ab5dfd3221fb534d6404874d561eac8' }), // stacks=["rust"]
  'rust+none': Object.freeze({ origem: 'herdado', sha256: '794c32004ad723b36ed47be53840ffdeedfeb4cb335038767497de311fbc9597' }), // stacks=["rust"]
  'nestjs+vue': Object.freeze({ origem: 'novo', sha256: 'dbc246ebde080ce2dc24d66f919458592456f9b117ba2e30caa99457453db3cc' }), // stacks=["nestjs"]
  'nestjs+react': Object.freeze({ origem: 'herdado', sha256: '0cbaf139bb2219383bf4a8c97650cfef33a3ede5f7eb5593fcd2057a31109c6e' }), // stacks=["nestjs","react"]
  'nestjs+dart': Object.freeze({ origem: 'novo', sha256: 'b185fa80b8fc86beebfa73b66f81a02e572b173a9beed31a38107a126b5352db' }), // stacks=["nestjs"]
  'nestjs+flutter': Object.freeze({ origem: 'novo', sha256: '0d9256dd6dd33b74de56b8d6b522d45129afe19e3aa0388f47241394c00cc9f8' }), // stacks=["nestjs"]
  'nestjs+other': Object.freeze({ origem: 'novo', sha256: '3e5bb0837c2570d28f9383164b110df6a2af59ed1fe04e207c3f1e0a78488471' }), // stacks=["nestjs"]
  'nestjs+none': Object.freeze({ origem: 'herdado', sha256: '9c71f11ea898be4fcf2c7810a255e6c366055fe5da4cd43b1232a1c1fb2985b9' }), // stacks=["nestjs"]
  'dart+vue': Object.freeze({ origem: 'novo', sha256: '09e38c39d4a79d2f643b5e527850c5688558f4ae8d21578c16230b958e5a0038' }), // stacks=["dart"]
  'dart+react': Object.freeze({ origem: 'novo', sha256: 'f4a8407e93ee0b6f1c7a1e000b19a298dc0fb0f5e931d046482854e7186d6989' }), // stacks=["dart","react"]
  'dart+dart': Object.freeze({ origem: 'novo', sha256: '06ef5953bc7aff589fc0d0e03226d5d30a448ecc7b1f027ba417faee7da4e189' }), // stacks=["dart"]
  'dart+flutter': Object.freeze({ origem: 'novo', sha256: 'a73016ae096eb483c3a23c11823bfec4f3a8fb1d341ab14d9bccb82529b0b3fb' }), // stacks=["dart"]
  'dart+other': Object.freeze({ origem: 'novo', sha256: '4b00e2023223cec8c793fd1caba5418e7c8c1095298525dfee5f8c156b37aee9' }), // stacks=["dart"]
  'dart+none': Object.freeze({ origem: 'herdado', sha256: 'cf86b1971eee96feb0ac54c851e06dabc52bcbb9f26fc8d48ef7fec503f1047f' }), // stacks=["dart"]
  'flutter+vue': Object.freeze({ origem: 'novo', sha256: '50d94240d39653ef33d8cf64d3fe2f27b8b9a0b52000e4f43a8e539c419f5de4' }), // stacks=[]
  'flutter+react': Object.freeze({ origem: 'novo', sha256: 'f7f543eaaf98162bf87e95bf99edac726bc5679caf4b8a50c755fe3faf4b2b40' }), // stacks=["react"]
  'flutter+dart': Object.freeze({ origem: 'novo', sha256: '949652544dd42a803b163b54e5cfcb6ea056ec59d87fb9c2f5ad6f997bb8dcd9' }), // stacks=[]
  'flutter+flutter': Object.freeze({ origem: 'herdado', sha256: '730d03151e296386068db5a72853a432f8e5b39848c98ea517d7a859093c2677' }), // stacks=["flutter","dart"]
  'flutter+other': Object.freeze({ origem: 'novo', sha256: 'f83cef56f842142f9673aef51ebd0cd6024fa72c70cece38ad15b1465d4b8cba' }), // stacks=[]
  'flutter+none': Object.freeze({ origem: 'novo', sha256: '14ac389468c7e6a6614aa6bd6417e076053b8934f7b667621f50d570e4dd6902' }), // stacks=[]
  'other+vue': Object.freeze({ origem: 'novo', sha256: '929bc96f1281f7a85c9d5b8e297b65785a1aa2fd5633ee5806a2bf13234fc6e1' }), // stacks=[]
  'other+react': Object.freeze({ origem: 'novo', sha256: '2685f76176897eaf418fdc8e21dfd17a17bee6adf8cd2cce6cef6bd01d886181' }), // stacks=["react"]
  'other+dart': Object.freeze({ origem: 'novo', sha256: '3c721b7efbffabc4d58403d288daf95bec93f8ec6bbe3cab7e62281e2ff0ebc0' }), // stacks=["dart"]
  'other+flutter': Object.freeze({ origem: 'novo', sha256: '55aa1c04660a59d8507580992eaa3cd3a20b20bec493531af46ed69c483596ca' }), // stacks=[]
  'other+other': Object.freeze({ origem: 'herdado', sha256: '38863feaaec40fce100b25ba6f13759512fe8ea3ce800c4e6151663fbf5ca056' }), // stacks=[]
  'other+none': Object.freeze({ origem: 'novo', sha256: '4358431c2130aa71c62e6b609e48dd9abb4915ed2c6c31c8500e194dc16e66f2' }), // stacks=[]
  'none+vue': Object.freeze({ origem: 'novo', sha256: '05bf5fc6ef86cd626bd7bb61aab2bd331a84d5fb8d9efcce725a4c35f694e9ec' }), // stacks=[]
  'none+react': Object.freeze({ origem: 'novo', sha256: '20efc0fc06dc9e3a9a866ca46c14b3f07cd02ff70ed6a11a08580685f9a476f5' }), // stacks=["react"]
  'none+dart': Object.freeze({ origem: 'novo', sha256: 'c8177e5bc90ef861c775351ceaea41257e7722947162c922e846268cc3eb97c5' }), // stacks=["dart"]
  'none+flutter': Object.freeze({ origem: 'novo', sha256: '56b21bd37122bfa6b08202db30121b85e5caef2032659ff6ea9f8e5b2894cbc1' }), // stacks=[]
  'none+other': Object.freeze({ origem: 'novo', sha256: '3a5fbd984dc39a5a956080e0cf284c5b958c735d8d6ba4a09a8f38cf572b2feb' }), // stacks=[]
  'none+none': Object.freeze({ origem: 'novo', sha256: 'd029fcfaa7dcc906578ba29d048ebf1aa95178d8d8b3584fef639d0e17fd2806' }), // stacks=[]
});

const sha256 = (texto) => createHash('sha256').update(texto).digest('hex');
function literalCanonico(backend, frontend) {
  const esperado = esperadoPorEixo(backend, frontend);
  delete esperado._stacks;
  return JSON.stringify(esperado);
}

describe('VAL-01 guarda de ratificação (C1/C2/C3 — ADR §2.3)', () => {
  it('BASELINE_48 cobre exatamente os 48 pares do inventário, sem duplicata', () => {
    assert.equal(Object.keys(BASELINE_48).length, 48);
    assert.deepEqual(Object.keys(BASELINE_48).sort(), [...PAIR_KEYS].sort());
  });

  it('toda origem=novo tem sha256 de 64 hex — 37 novas (≥36 do ADR)', () => {
    const novos = Object.entries(BASELINE_48).filter(([, v]) => v.origem === 'novo');
    assert.ok(novos.length >= 36, `novas ratificadas=${novos.length} < 36`);
    for (const [chave, v] of novos) {
      assert.match(v.sha256, /^[0-9a-f]{64}$/, `${chave}: sha256 inválido`);
    }
  });

  it('anti-tautologia: o oráculo NÃO chama o gerador sob teste', () => {
    assert.ok(!esperadoPorEixo.toString().includes('generateConfig'));
    assert.ok(!literalCanonico.toString().includes('generateConfig'));
  });

  it('C3 ausente: nenhum auto-accept de baseline em código/rules', () => {
    const raiz = process.cwd();
    const alvos = ['scripts', 'installer', '.agents'];
    const proibido = [new RegExp('INSTA' + '_UPDATE=always'), new RegExp('insta' + ' accept')];
    const encontrados = [];
    const varrer = (dir) => {
      let entradas;
      try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entradas) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) varrer(abs);
        else if (e.isFile() && /\.(mjs|js|ts|json|md)$/.test(e.name)) {
          const corpo = fs.readFileSync(abs, 'utf8');
          for (const re of proibido) if (re.test(corpo)) encontrados.push(path.relative(raiz, abs));
        }
      }
    };
    for (const d of alvos) varrer(path.join(raiz, d));
    assert.deepEqual([...new Set(encontrados)], [], 'C3 detectada em: ' + encontrados.join(', '));
  });

  it('o sha256 ratificado bate com o oráculo independente, par a par', () => {
    for (const { backend, frontend } of AXIS_PAIRS) {
      const chave = pairKey({ backend, frontend });
      assert.equal(
        BASELINE_48[chave].sha256,
        sha256(literalCanonico(backend, frontend)),
        `${chave}: sha256 do baseline diverge do oráculo`,
      );
    }
  });
});

describe('VAL-01 golden 48 pares: gerador === oráculo independente (0 divergência)', () => {
  for (const { backend, frontend } of AXIS_PAIRS) {
    const chave = pairKey({ backend, frontend });
    it(`${chave}: JSON canônico === literal ratificado`, () => {
      const produced = JSON.stringify(generateConfig({ project: 'demo', axes: { backend, frontend } }));
      assert.equal(produced, literalCanonico(backend, frontend), `${chave}: divergência de baseline`);
      assert.equal(sha256(produced), BASELINE_48[chave].sha256, `${chave}: sha divergente do ratificado`);
    });
  }
});
