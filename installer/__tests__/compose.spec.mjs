// compose.spec.mjs — EIX-02 (ADR-001 §3 itens 2/3; SPEC RF-02/RF-03).
// ORÁCULO INDEPENDENTE: as tabelas literais abaixo foram escritas à mão a
// partir da decisão §16 / ADR §2.1. Nenhuma deriva de `compose.mjs` — por
// isso o teste falha se a origem de um campo mudar de forma silenciosa.
// Mesmo padrão do `eixos.spec.mjs` (EIX-01).
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

// commands/moduleMap: origem = eixo BACKEND (ADR §2.1 / RF-02).
// Valores literais já existentes no oráculo congelado, re-indexados por eixo —
// nenhum comando/default NOVO é introduzido aqui.
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
const ORACULO_MODULEMAP = {
  java: {}, node: {}, rust: {}, nestjs: {}, other: {}, none: {},
  dart: { lib: 'lib', test: 'test' },
  flutter: { lib: 'lib', test: 'test' },
};

// mcp: origem = eixo FRONTEND (ADR §2.1 / RF-03); chrome-devtools só nas frentes web.
const ORACULO_MCP = {
  vue: ['chrome-devtools'],
  react: ['chrome-devtools'],
  dart: ['dart'],
  flutter: ['marionette_mcp', 'dart'],
  other: [],
  none: [],
};

// stacks: mesma regra de derivação do oráculo congelado, com a ÚNICA exceção
// mobile declarada flutter+flutter → ['flutter','dart'].
function stacksOracle(backend, frontend) {
  if (backend === 'flutter' && frontend === 'flutter') return ['flutter', 'dart'];
  const out = [];
  if (backend === 'dart') out.push('dart');
  if (backend === 'rust') out.push('rust');
  if (backend === 'nestjs') out.push('nestjs');
  if (frontend === 'react') out.push('react');
  return out;
}

import { BACKEND_IDS, FRONTEND_IDS, AXIS_PAIRS, PAIR_KEYS } from '../eixos.mjs';
import {
  SKILLS_BY_AXIS, SKILLS_COMMON, RULES_BY_AXIS, RULES_COMMON,
} from '../contract-registry.mjs';
import {
  commandsForBackend, moduleMapForBackend, mcpForFrontend,
  stacksForAxes, skillsForAxes, rulesForAxes, composeAxes,
} from '../compose.mjs';

describe('EIX-02 funções de origem por eixo presentes (RF-02)', () => {
  it('commandsForBackend/moduleMapForBackend existem e são funções', () => {
    assert.equal(typeof commandsForBackend, 'function');
    assert.equal(typeof moduleMapForBackend, 'function');
  });

  it('commandsForBackend: um literal por backend, igual ao oráculo', () => {
    assert.deepEqual([...BACKEND_IDS], ORACULO_BACKENDS);
    for (const backend of ORACULO_BACKENDS) {
      assert.deepEqual(commandsForBackend(backend), ORACULO_COMMANDS[backend], backend);
    }
  });

  it('moduleMapForBackend: um literal por backend, igual ao oráculo', () => {
    for (const backend of ORACULO_BACKENDS) {
      assert.deepEqual(moduleMapForBackend(backend), ORACULO_MODULEMAP[backend], backend);
    }
  });

  it('backend inválido reprova — nunca cai no valor do outro eixo', () => {
    for (const invalido of ['vue', 'react', 'ruby', '', undefined, null]) {
      assert.throws(() => commandsForBackend(invalido), /backend/, String(invalido));
      assert.throws(() => moduleMapForBackend(invalido), /backend/, String(invalido));
    }
  });
});

describe('EIX-02 mcp vem do FRONTEND, não do backend (RF-03)', () => {
  it('mcpForFrontend: um literal por frontend, igual ao oráculo', () => {
    assert.deepEqual([...FRONTEND_IDS], ORACULO_FRONTENDS);
    for (const frontend of ORACULO_FRONTENDS) {
      assert.deepEqual(mcpForFrontend(frontend), ORACULO_MCP[frontend], frontend);
    }
  });

  it('frentes web exigem chrome-devtools; mobile exige marionette/dart', () => {
    assert.deepEqual(mcpForFrontend('vue'), ['chrome-devtools']);
    assert.deepEqual(mcpForFrontend('react'), ['chrome-devtools']);
    assert.deepEqual(mcpForFrontend('flutter'), ['marionette_mcp', 'dart']);
    assert.deepEqual(mcpForFrontend('dart'), ['dart']);
  });

  it('frontend inválido reprova — nunca cai no valor do outro eixo', () => {
    for (const invalido of ['java', 'rust', 'svelte', '', undefined, null]) {
      assert.throws(() => mcpForFrontend(invalido), /frontend/, String(invalido));
    }
  });
});

describe('EIX-02 prova literal rust+vue: commands do backend / mcp do frontend', () => {
  it('rust+vue: commands = rust, moduleMap = rust, mcp = vue', () => {
    const c = composeAxes({ backend: 'rust', frontend: 'vue' });
    assert.deepEqual(c.commands, ORACULO_COMMANDS.rust);
    assert.deepEqual(c.commands, commandsForBackend('rust'));
    assert.deepEqual(c.moduleMap, ORACULO_MODULEMAP.rust);
    assert.deepEqual(c.moduleMap, moduleMapForBackend('rust'));
    assert.deepEqual(c.mcp, ORACULO_MCP.vue);
    assert.deepEqual(c.mcp, mcpForFrontend('vue'));
  });

  it('rust+vue: stacks sem rust (frontend não é react, não é exceção mobile)', () => {
    const c = composeAxes({ backend: 'rust', frontend: 'vue' });
    assert.deepEqual(c.stacks, stacksOracle('rust', 'vue'));
  });

  it('flutter+vue: commands NÃO-vazios do backend flutter, mcp NÃO-mobile do frontend vue', () => {
    const c = composeAxes({ backend: 'flutter', frontend: 'vue' });
    assert.deepEqual(c.commands, ORACULO_COMMANDS.flutter);
    assert.equal(c.commands.suiteFull, 'flutter test');
    assert.notEqual(c.commands.suiteFull, ORACULO_COMMANDS.dart.suiteFull);
    assert.deepEqual(c.mcp, ['chrome-devtools']);
    assert.equal(c.mcp.includes('marionette_mcp'), false);
    assert.equal(c.mcp.includes('dart'), false);
  });

  it('dart+vue: comando do backend dart, mcp do frontend vue — campos distintos', () => {
    const c = composeAxes({ backend: 'dart', frontend: 'vue' });
    assert.deepEqual(c.commands, ORACULO_COMMANDS.dart);
    assert.deepEqual(c.mcp, ORACULO_MCP.vue);
    assert.notDeepEqual(c.commands, c.mcp);
  });
});

describe('EIX-02 asserção por eixo nos 48 pares (DoD: 0 falha)', () => {
  it('inventário 48 pares é o mesmo do EIX-01', () => {
    assert.equal(AXIS_PAIRS.length, 48);
    assert.equal(PAIR_KEYS.length, 48);
    assert.deepEqual([...PAIR_KEYS], ORACULO_PAIRS);
  });

  for (const chave of ORACULO_PAIRS) {
    const [backend, frontend] = chave.split('+');
    it(`${chave}: commands/moduleMap=backend, mcp/stacks=frontend, skills/rules=registry`, () => {
      const c = composeAxes({ backend, frontend });
      assert.deepEqual(c.backend, backend);
      assert.deepEqual(c.frontend, frontend);
      assert.deepEqual(c.commands, ORACULO_COMMANDS[backend], `commands de ${backend}`);
      assert.deepEqual(c.moduleMap, ORACULO_MODULEMAP[backend], `moduleMap de ${backend}`);
      assert.deepEqual(c.mcp, ORACULO_MCP[frontend], `mcp de ${frontend}`);
      assert.deepEqual(c.stacks, stacksOracle(backend, frontend), `stacks de ${chave}`);
      assert.deepEqual(c.skills, skillsForAxes({ backend, frontend }), `skills de ${chave}`);
      assert.deepEqual(c.rules, rulesForAxes({ backend, frontend }), `rules de ${chave}`);
    });
  }
});

describe('EIX-02 skills/rules vêm do REGISTRY, não do nome do preset (RF-03)', () => {
  it('registry tem o mapeamento INVERTIDO: frontend=react → frontend-vue-specialist', () => {
    assert.deepEqual(SKILLS_BY_AXIS['frontend=react'], ['frontend-vue-specialist']);
    assert.deepEqual(SKILLS_BY_AXIS['frontend=vue'], ['frontend-react-specialist']);
    assert.deepEqual(RULES_BY_AXIS['frontend=react'], ['frontend-coding-standards.md']);
    assert.deepEqual(RULES_BY_AXIS['frontend=vue'], ['frontend-react-coding-standards.md']);
  });

  it('skills de frontend=react contém frontend-vue-specialist (só o registry explica)', () => {
    const skills = skillsForAxes({ backend: 'rust', frontend: 'react' });
    assert.ok(skills.includes('frontend-vue-specialist'));
    assert.ok(skills.every((s) => SKILLS_COMMON.includes(s) || Object.values(SKILLS_BY_AXIS).flat().includes(s)));
  });

  it('injeção de registry altera skills: prova que a fonte é o mapa, não o preset', () => {
    const skills = skillsForAxes(
      { backend: 'java', frontend: 'vue' },
      { skillsByAxis: { 'frontend=vue': ['skill-injetada'] }, skillsCommon: ['common-injetada'] },
    );
    assert.deepEqual(skills, ['common-injetada', 'skill-injetada']);
    assert.equal(skills.includes('frontend-react-specialist'), false);
  });

  it('injeção de registry altera rules: prova que a fonte é o mapa, não o preset', () => {
    const rules = rulesForAxes(
      { backend: 'java', frontend: 'react' },
      { rulesByAxis: { 'frontend=react': ['rule-injetada.md'] }, rulesCommon: ['common-injetada.md'] },
    );
    assert.deepEqual(rules, ['common-injetada.md', 'rule-injetada.md']);
    assert.equal(rules.includes('frontend-coding-standards.md'), false);
  });

  it('composeAxes delega skills/rules ao registry padrão (sem preset casado)', () => {
    const c = composeAxes({ backend: 'java', frontend: 'vue' });
    assert.deepEqual(c.skills, skillsForAxes({ backend: 'java', frontend: 'vue' }));
    assert.deepEqual(c.rules, rulesForAxes({ backend: 'java', frontend: 'vue' }));
    for (const nome of ['java+vue', 'rust+vue', 'node+react', 'STACK_PROFILES']) {
      assert.equal([...c.skills, ...c.rules].some((a) => a.includes(nome)), false, nome);
    }
  });
});

describe('EIX-02 imutabilidade: cópias devolvidas não corrompem a origem', () => {
  it('mutar commands/moduleMap/mcp/stacks/skills/rules devolvidos não afeta calls seguintes', () => {
    const c = composeAxes({ backend: 'flutter', frontend: 'flutter' });
    c.commands.suiteFull = 'comando-hack';
    c.moduleMap.lib = 'hack';
    c.mcp.push('hack');
    c.stacks.push('hack');
    c.skills.push('hack');
    c.rules.push('hack');

    assert.deepEqual(composeAxes({ backend: 'flutter', frontend: 'flutter' }).commands, ORACULO_COMMANDS.flutter);
    assert.deepEqual(composeAxes({ backend: 'flutter', frontend: 'flutter' }).moduleMap, ORACULO_MODULEMAP.flutter);
    assert.deepEqual(composeAxes({ backend: 'flutter', frontend: 'flutter' }).mcp, ORACULO_MCP.flutter);
    assert.deepEqual(composeAxes({ backend: 'flutter', frontend: 'flutter' }).stacks, ['flutter', 'dart']);
    assert.equal(composeAxes({ backend: 'flutter', frontend: 'flutter' }).skills.includes('hack'), false);
    assert.equal(composeAxes({ backend: 'flutter', frontend: 'flutter' }).rules.includes('hack'), false);
  });
});

describe('EIX-02 nenhum preset casado como caminho, zero CLI visual (escopo ADR-002)', () => {
  const fonte = fs.readFileSync(new URL('../compose.mjs', import.meta.url), 'utf8');
  const codigo = fonte.replace(/\/\/.*$/gm, '');

  it('compose.mjs não seleciona config por nome de preset casado', () => {
    for (const simbolo of [
      'STACK_PROFILES', 'STACK_VALUES', 'profileOf', 'presetOfAxes',
      'presetsOfAxes', 'WIZARD_MENU', 'install.mjs', 'contract-tui',
    ]) {
      assert.equal(codigo.includes(simbolo), false, `preset casado vazou: ${simbolo}`);
    }
  });

  it('exceção mobile NÃO é re-declarada em compose.mjs (vem do registry/eixos)', () => {
    assert.equal(codigo.includes('flutter+flutter'), false);
  });

  it('nenhuma op de CLI visual em compose.mjs', () => {
    for (const op of ['ratatui', 'inquire', 'dialoguer', '@inquirer']) {
      assert.equal(fonte.toLowerCase().includes(op), false, `CLI visual vazou: ${op}`);
    }
  });

  it('par fora do inventário reprova em composeAxes (fail-closed)', () => {
    for (const invalido of [{ backend: 'ruby', frontend: 'vue' }, { backend: 'java', frontend: 'svelte' }, null]) {
      assert.throws(() => composeAxes(invalido));
    }
  });
});
