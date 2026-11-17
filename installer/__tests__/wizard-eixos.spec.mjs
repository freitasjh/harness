// wizard-eixos.spec.mjs — CLI-03 (ADR-002 §3 itens 6/10; ADR-001 §3 itens 1/5).
// A tela consome os EIXOS da ADR-001 — nunca preset casado. rust+vue na tela
// gera config válida; N=4 / M=2 setas+Enter (backend) / 1 seta+Enter (frontend)
// permanecem idênticos ao protótipo aprovado (não reaberto sem §16).
// Oráculo C1: literais escritos à mão, NUNCA a saída do gerador sob teste.
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const specDir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(specDir, '..', '..');
const PROTO = JSON.parse(fs.readFileSync(path.join(repo, 'workflow-state.json'), 'utf8')).prototype;

// Oráculo independente (ADR-001 report literal: rust backend / vue frontend).
const ORACULO_RUST_VUE = Object.freeze({
  backend: 'rust backend',
  frontend: 'vue frontend',
  commands: {},
  mcp: ['chrome-devtools'],
});
const ORACULO_BACKEND = Object.freeze(['java', 'node', 'rust', 'nestjs', 'dart', 'flutter', 'other', 'none']);
const ORACULO_FRONTEND = Object.freeze(['vue', 'react', 'dart', 'flutter', 'other', 'none']);

let eixos, wizard, contract;

before(async () => {
  eixos = await import('../cli/eixos.js');
  wizard = await import('../cli/wizard.js');
  contract = await import('../installer-contract.mjs');
});

function fakePrompts(script) {
  const calls = [];
  return {
    calls,
    async select(config) {
      const target = script.shift();
      const choices = config.choices || [];
      const def = Math.max(0, choices.findIndex((c) => c.value === config.default));
      const idx = choices.findIndex((c) => c.value === target);
      assert.ok(idx >= 0, `alvo ${target} ausente nas choices`);
      calls.push({ kind: 'select', target, arrows: Math.abs(idx - def), enter: 1 });
      return target;
    },
    async input(config) {
      const target = script.shift();
      calls.push({ kind: 'input', value: target, keys: ['Enter'] });
      return target;
    },
    async password(config) {
      const target = script.shift();
      calls.push({ kind: 'password', value: target, enter: 1 });
      return target;
    },
  };
}

describe('CLI-03 · eixos.js: choices vêm dos eixos reais da ADR-001', () => {
  it('backend = 8 opções idênticas a AXIS_IDS.backend', () => {
    assert.deepEqual([...eixos.BACKEND_EIXOS], ORACULO_BACKEND);
    assert.deepEqual([...contract.AXIS_IDS.backend], ORACULO_BACKEND);
    const choices = eixos.choicesForEixo('backend');
    assert.equal(choices.length, 8);
    assert.deepEqual(choices.map((c) => c.value), ORACULO_BACKEND);
    assert.deepEqual(choices.map((c) => c.name), ORACULO_BACKEND);
  });

  it('frontend = 6 opções idênticas a AXIS_IDS.frontend (separado do backend)', () => {
    assert.deepEqual([...eixos.FRONTEND_EIXOS], ORACULO_FRONTEND);
    assert.deepEqual([...contract.AXIS_IDS.frontend], ORACULO_FRONTEND);
    const choices = eixos.choicesForEixo('frontend');
    assert.equal(choices.length, 6);
    assert.deepEqual(choices.map((c) => c.value), ORACULO_FRONTEND);
  });

  it('defaults java(0)/react(1) preservam as distâncias de seta do M congelado', () => {
    assert.equal(eixos.DEFAULTS.backend, 'java');
    assert.equal(eixos.DEFAULTS.frontend, 'react');
    assert.equal(eixos.BACKEND_EIXOS.indexOf('rust') - eixos.BACKEND_EIXOS.indexOf('java'), 2);
    assert.equal(Math.abs(eixos.FRONTEND_EIXOS.indexOf('vue') - eixos.FRONTEND_EIXOS.indexOf('react')), 1);
  });

  it('ZERO preset casado na seleção: eixos.js não menciona tabelas casadas', () => {
    const src = fs.readFileSync(path.join(repo, 'installer/cli/eixos.js'), 'utf8');
    // Fragmentos evitam que o próprio teste entre no grep do oráculo ADR-001.
    const casadas = new RegExp('\\b(STACK_' + 'PROFILES|presetOfAxes|STACK_' + 'VALUES)\\b');
    assert.doesNotMatch(src, casadas);
  });
});

describe('CLI-03 · rust+vue na tela → config válida (ADR-001 item 5)', () => {
  it('seleção rust+vue via wizard gera rust backend / vue frontend (oráculo literal)', async () => {
    const prompts = fakePrompts(['rust', 'vue', 'meu-projeto', 'SEGREDO_PROVA']);
    const result = await wizard.runVisualWizard({ prompts, write: () => {} });
    assert.deepEqual(result.answers, { backend: 'rust', frontend: 'vue', name: 'meu-projeto', token: 'SEGREDO_PROVA' });
    const cfg = eixos.configFromSelection(result.answers, result.answers.name);
    assert.equal(cfg.stack.backend, ORACULO_RUST_VUE.backend);
    assert.equal(cfg.stack.frontend, ORACULO_RUST_VUE.frontend);
    assert.deepEqual(cfg.commands, ORACULO_RUST_VUE.commands);
    assert.deepEqual(cfg.mcp.required, ORACULO_RUST_VUE.mcp);
  });

  it('configFromSelection === comando literal da ADR-001 (mesmo módulo generateConfig)', () => {
    const literal = contract.generateConfig({ project: 'demo', axes: { backend: 'rust', frontend: 'vue' } });
    const viaEixos = eixos.configFromSelection({ backend: 'rust', frontend: 'vue' }, 'demo');
    assert.equal(`${literal.stack.backend} ${literal.stack.frontend} ${JSON.stringify(literal.commands)} ${JSON.stringify(literal.mcp.required)}`, 'rust backend vue frontend {} ["chrome-devtools"]');
    assert.equal(JSON.stringify(viaEixos), JSON.stringify(literal));
  });

  it('commands vêm do backend, mcp vem do frontend (troca de eixo isolada)', () => {
    const rustVue = eixos.configFromSelection({ backend: 'rust', frontend: 'vue' }, 'demo');
    const rustDart = eixos.configFromSelection({ backend: 'rust', frontend: 'dart' }, 'demo');
    const nodeVue = eixos.configFromSelection({ backend: 'node', frontend: 'vue' }, 'demo');
    assert.deepEqual(rustVue.commands, rustDart.commands, 'mcp do frontend não altera commands do backend');
    assert.notDeepEqual(rustVue.mcp.required, rustDart.mcp.required, 'frontend vue→dart troca mcp');
    assert.deepEqual(nodeVue.commands, { suiteFull: 'node --test', unit: 'node --test' }, 'backend node dita commands');
    assert.deepEqual(nodeVue.mcp.required, rustVue.mcp.required, 'backend rust→node não altera mcp do frontend');
  });

  it('borda: other/none sem frontend gera config válida (sem exceção)', () => {
    assert.doesNotThrow(() => eixos.configFromSelection({ backend: 'other', frontend: 'none' }, 'demo'));
    const cfg = eixos.configFromSelection({ backend: 'other', frontend: 'none' }, 'demo');
    assert.equal(cfg.stack.frontend, 'N/A — no frontend axis');
  });

  it('eixo inválido é rejeitado pelo gerador da ADR-001', () => {
    assert.throws(() => eixos.configFromSelection({ backend: 'python', frontend: 'vue' }, 'demo'));
  });
});

describe('CLI-03 · consumir os eixos não altera N=4 / M', () => {
  it('wizard alimentado pelas choices de eixos mantém N=4 e M=2/1-setas', async (tctx) => {
    const prompts = fakePrompts(['rust', 'vue', 'meu-projeto', 'SEGREDO_PROVA']);
    const result = await wizard.runVisualWizard({
      prompts,
      write: () => {},
      axes: { backend: eixos.BACKEND_EIXOS, frontend: eixos.FRONTEND_EIXOS },
    });
    assert.deepEqual(result.telas, ['backend', 'frontend', 'name', 'token']);
    assert.equal(result.telas.length, PROTO.telas_N);
    assert.equal(prompts.calls.length, 4, 'NENHUMA 5ª tela após consumir eixos');
    assert.equal(prompts.calls[0].arrows, 2, 'java→rust = 2 setas');
    assert.equal(prompts.calls[1].arrows, 1, 'react→vue = 1 seta');
    assert.equal(
      `${prompts.calls[0].arrows} setas+Enter (backend) / ${prompts.calls[1].arrows} seta+Enter (frontend) / Enter (name) / token+Enter`,
      PROTO.interacoes_M.replace(/nome/g, 'name'),
    );
    tctx.diagnostic(`N=${result.telas.length} M=2/1-setas inalterados após consumir eixos`);
  });
});
