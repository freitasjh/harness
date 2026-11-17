// generate-eixos.spec.mjs — EIX-03 (ADR-001 §3 itens 4/5; SPEC RF-04/RF-05).
// ORÁCULO INDEPENDENTE: tabelas e invariantes abaixo foram escritos à mão a
// partir da decisão §16 / ADR §2.1 e do baseline congelado (golden.spec.mjs).
// Nenhum valor deriva de `generate-eixos.mjs` — o teste falha se a origem de um
// campo mudar de forma silenciosa. Mesmo padrão de eixos.spec/compose.spec.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ORACULO_BACKENDS = [
  'java', 'node', 'rust', 'nestjs', 'dart', 'flutter', 'other', 'none',
];
const ORACULO_FRONTENDS = [
  'vue', 'react', 'dart', 'flutter', 'other', 'none',
];
const ORACULO_PAIRS = [
  'java+vue', 'java+react', 'java+dart', 'java+flutter', 'java+other', 'java+none',
  'node+vue', 'node+react', 'node+dart', 'node+flutter', 'node+other', 'node+none',
  'rust+vue', 'rust+react', 'rust+dart', 'rust+flutter', 'rust+other', 'rust+none',
  'nestjs+vue', 'nestjs+react', 'nestjs+dart', 'nestjs+flutter', 'nestjs+other', 'nestjs+none',
  'dart+vue', 'dart+react', 'dart+dart', 'dart+flutter', 'dart+other', 'dart+none',
  'flutter+vue', 'flutter+react', 'flutter+dart', 'flutter+flutter', 'flutter+other', 'flutter+none',
  'other+vue', 'other+react', 'other+dart', 'other+flutter', 'other+other', 'other+none',
  'none+vue', 'none+react', 'none+dart', 'none+flutter', 'none+other', 'none+none',
];

// commands/moduleMap: origem = eixo BACKEND (re-indexados do oráculo congelado).
const ORACULO_COMMANDS = {
  java: {},
  node: { suiteFull: 'node --test', unit: 'node --test' },
  rust: {},
  nestjs: {},
  dart: { suiteFull: 'dart test', unit: 'dart test', analyze: 'dart analyze' },
  flutter: { suiteFull: 'flutter test', unit: 'flutter test', analyze: 'dart analyze' },
  other: {},
  none: {},
};
const ORACULO_MODULEMAP_EXTRA = {
  java: {}, node: {}, rust: {}, nestjs: {}, other: {}, none: {},
  dart: { lib: 'lib', test: 'test' },
  flutter: { lib: 'lib', test: 'test' },
};

// mcp: origem = eixo FRONTEND.
const ORACULO_MCP = {
  vue: ['chrome-devtools'],
  react: ['chrome-devtools'],
  dart: ['dart'],
  flutter: ['marionette_mcp', 'dart'],
  other: [],
  none: [],
};

// Textos DERIVADOS do id do eixo (ADR §2.1) — nunca literal por preset.
function textoOracle(eixo, id) {
  if (id === 'none') return `N/A — no ${eixo} axis`;
  return `${id} ${eixo}`;
}

// Invariantes do harness: literais congelados do baseline (golden.spec.mjs).
const ORACULO_INVARIANTES = {
  moduleMapBase: {
    plugins: '.opencode/plugins',
    rules: '.agents/rules',
    schemas: '.agents/schemas',
  },
  infra: { composeFile: null, ports: { backend: null, frontend: null } },
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

import { generateConfig } from '../generate-eixos.mjs';

describe('EIX-03 gerador puro presente (RF-04/RF-05)', () => {
  it('generateConfig existe e é função', () => {
    assert.equal(typeof generateConfig, 'function');
  });

  it('project vazio reprova (fail-closed)', () => {
    for (const projeto of [undefined, null, '', '   ']) {
      assert.throws(() => generateConfig({ project: projeto, axes: { backend: 'rust', frontend: 'vue' } }), /project/);
    }
  });

  it('par fora do inventário reprova (fail-closed)', () => {
    for (const axes of [
      { backend: 'ruby', frontend: 'vue' },
      { backend: 'rust', frontend: 'svelte' },
      null,
      undefined,
      { backend: 'rust' },
    ]) {
      assert.throws(() => generateConfig({ project: 'demo', axes }));
    }
  });
});

describe('EIX-03 prova literal rust+vue sem perfil casado (RF-05)', () => {
  it('generateConfig(rust+vue) ⇒ rust backend / vue frontend, 0 exceção', () => {
    const cfg = generateConfig({ project: 'demo', axes: { backend: 'rust', frontend: 'vue' } });
    assert.doesNotThrow(() => generateConfig({ project: 'demo', axes: { backend: 'rust', frontend: 'vue' } }));
    assert.equal(cfg.project, 'demo');
    assert.equal(cfg.stack.backend, 'rust backend');
    assert.equal(cfg.stack.frontend, 'vue frontend');
  });

  it('rust+vue: commands do backend rust, mcp do frontend vue', () => {
    const cfg = generateConfig({ project: 'demo', axes: { backend: 'rust', frontend: 'vue' } });
    assert.deepEqual(cfg.commands, ORACULO_COMMANDS.rust);
    assert.deepEqual(cfg.commands, {});
    assert.deepEqual(cfg.mcp.required, ORACULO_MCP.vue);
    assert.deepEqual(cfg.mcp.required, ['chrome-devtools']);
    assert.equal(cfg.mcp.required.includes('dart'), false);
    assert.equal(cfg.mcp.required.includes('marionette_mcp'), false);
  });

  it('rust+vue: nenhum texto vaza literal de preset', () => {
    const cfg = generateConfig({ project: 'demo', axes: { backend: 'rust', frontend: 'vue' } });
    for (const texto of [cfg.stack.backend, cfg.stack.frontend]) {
      assert.equal(texto.includes('declared'), false, texto);
      assert.equal(texto.includes('Q&A'), false, texto);
      assert.equal(texto.includes('java+'), false, texto);
    }
  });
});

describe('EIX-03 textos derivados nos 48 pares (RF-04)', () => {
  for (const chave of ORACULO_PAIRS) {
    const [backend, frontend] = chave.split('+');
    it(`${chave}: stack.backend/frontend derivados dos ids dos eixos`, () => {
      const cfg = generateConfig({ project: 'demo', axes: { backend, frontend } });
      assert.equal(cfg.stack.backend, textoOracle('backend', backend), chave);
      assert.equal(cfg.stack.frontend, textoOracle('frontend', frontend), chave);
      assert.equal(cfg.stack.backend.includes('declared'), false, chave);
      assert.equal(cfg.stack.frontend.includes('declared'), false, chave);
    });
  }
});

describe('EIX-03 48 configs válidas (DoD: borda = todos os pares)', () => {
  it('inventário 48 pares é o mesmo do EIX-01', () => {
    assert.equal(ORACULO_PAIRS.length, 48);
    assert.equal(new Set(ORACULO_PAIRS).size, 48);
  });

  const geradas = [];
  for (const chave of ORACULO_PAIRS) {
    const [backend, frontend] = chave.split('+');
    it(`${chave}: config válida + origem por eixo + invariantes`, () => {
      const cfg = generateConfig({ project: 'demo', axes: { backend, frontend } });
      assert.equal(cfg.version, 1);
      assert.equal(cfg.project, 'demo');
      assert.equal(typeof cfg.stack.backend, 'string');
      assert.ok(cfg.stack.backend.length > 0);
      assert.equal(typeof cfg.stack.frontend, 'string');
      assert.ok(cfg.stack.frontend.length > 0);
      assert.deepEqual(cfg.commands, ORACULO_COMMANDS[backend], `commands de ${chave}`);
      assert.deepEqual(cfg.mcp.required, ORACULO_MCP[frontend], `mcp de ${chave}`);
      assert.deepEqual(cfg.moduleMap, {
        ...ORACULO_INVARIANTES.moduleMapBase,
        ...ORACULO_MODULEMAP_EXTRA[backend],
      }, `moduleMap de ${chave}`);
      assert.deepEqual(cfg.infra, ORACULO_INVARIANTES.infra);
      assert.deepEqual(cfg.protectedPaths, ORACULO_INVARIANTES.protectedPaths);
      assert.deepEqual(cfg.gates, ORACULO_INVARIANTES.gates);
      assert.deepEqual(cfg.riskPaths, ORACULO_INVARIANTES.riskPaths);
      assert.deepEqual(cfg.escalateOnRisk, ORACULO_INVARIANTES.escalateOnRisk);
      assert.equal(cfg.contraproveTimeoutMs, ORACULO_INVARIANTES.contraproveTimeoutMs);
      assert.deepEqual(cfg.evidence, ORACULO_INVARIANTES.evidence);
      geradas.push(chave);
    });
  }

  it('48 configs geradas, sem duplicata de chave', () => {
    assert.equal(geradas.length, 48);
    assert.equal(new Set(geradas).size, 48);
    assert.deepEqual([...geradas].sort(), [...ORACULO_PAIRS].sort());
  });
});

describe('EIX-03 gerador sem literal de preset, sem perfil casado, sem CLI visual', () => {
  const fonte = fs.readFileSync(new URL('../generate-eixos.mjs', import.meta.url), 'utf8');
  const codigo = fonte.replace(/\/\/.*$/gm, '');

  it('zero literal declared via Q&A no gerador', () => {
    assert.equal(fonte.includes('declared via Q&A'), false);
    assert.equal(fonte.toLowerCase().includes('declared via q&a'), false);
  });

  it('zero perfil casado consultado no gerador', () => {
    for (const simbolo of [
      'STACK_PROFILES', 'STACK_VALUES', 'profileOf', 'presetOfAxes',
      'presetsOfAxes', 'WIZARD_MENU', 'install.mjs', 'contract-registry',
      'contract-pure', 'contract-tui',
    ]) {
      assert.equal(codigo.includes(simbolo), false, `perfil casado vazou: ${simbolo}`);
    }
  });

  it('usa APENAS eixos.mjs + compose.mjs como fontes de composição', () => {
    const imports = [...codigo.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    assert.deepEqual([...imports].sort(), ['./compose.mjs', './eixos.mjs']);
  });

  it('nenhuma op de CLI visual no gerador (escopo ADR-002)', () => {
    for (const op of ['ratatui', 'inquire', 'dialoguer', '@inquirer']) {
      assert.equal(fonte.toLowerCase().includes(op), false, `CLI visual vazou: ${op}`);
    }
  });
});

describe('EIX-03 cópias devolvidas não corrompem a origem', () => {
  it('mutar commands/moduleMap/mcp do retorno não afeta calls seguintes', () => {
    const cfg = generateConfig({ project: 'demo', axes: { backend: 'flutter', frontend: 'flutter' } });
    cfg.commands.suiteFull = 'hack';
    cfg.moduleMap.lib = 'hack';
    cfg.mcp.required.push('hack');
    const again = generateConfig({ project: 'demo', axes: { backend: 'flutter', frontend: 'flutter' } });
    assert.deepEqual(again.commands, ORACULO_COMMANDS.flutter);
    assert.deepEqual(again.moduleMap, {
      ...ORACULO_INVARIANTES.moduleMapBase,
      ...ORACULO_MODULEMAP_EXTRA.flutter,
    });
    assert.deepEqual(again.mcp.required, ORACULO_MCP.flutter);
  });
});
