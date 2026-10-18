import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateConfig, STACK_PROFILES, profileOf, defaultSuiteFor } from '../install.mjs';

describe('IN-03 S1: answers validos => config valido', () => {
  it('gera chaves do SPEC §5.1 / config do repo', () => {
    const cfg = generateConfig({ project: 'demo', stack: 'node', suiteCommand: 'node --test', pluginsDir: '/tmp/x' });
    assert.equal(cfg.version, 1);
    assert.equal(cfg.project, 'demo');
    assert.ok(cfg.commands && typeof cfg.commands.suiteFull === 'string');
    assert.ok(cfg.evidence && cfg.evidence.path === 'harness/');
    assert.ok(Array.isArray(cfg.protectedPaths));
  });
});

// FU-25: QUESTIONS nao pergunta composeFile/ports. Decisao JUSTIFICADA (nao
// lacuna aberta): (a) perfil mobile nao tem servidor/compose — infra N/A por
// natureza; (b) estender o Q&A mudaria o contrato congelado do baseline
// golden (I7); (c) destino edita o bloco infra pos-install. O teste congela o
// comportamento e a justificativa precisa existir NO CODIGO.
describe('FU-25 infra (composeFile/ports) — N/A justificado, nao lacuna silenciosa', () => {
  it('todo perfil gera infra com composeFile/ports null (comportamento congelado)', () => {
    for (const stack of Object.keys(STACK_PROFILES)) {
      const cfg = generateConfig({ project: 'demo', stack });
      assert.deepEqual(
        cfg.infra,
        { composeFile: null, ports: { backend: null, frontend: null } },
        `stack=${stack}: infra null em todos os perfis`,
      );
    }
  });

  it('a justificativa FU-25 esta documentada no codigo (QUESTIONS/infra)', () => {
    const src = fs.readFileSync(new URL('../install.mjs', import.meta.url), 'utf8');
    assert.match(src, /FU-25/, 'justificativa cita o item');
    assert.match(src, /composeFile/, 'a justificativa nomeia composeFile');
    assert.ok(/mobile[^]*N\/A|N\/A[^]*mobile/i.test(src), 'justifica N/A no perfil mobile');
  });

  it('QUESTIONS continua sem composeFile/ports (escopo do Q&A inalterado)', () => {
    const src = fs.readFileSync(new URL('../install.mjs', import.meta.url), 'utf8');
    const block = src.slice(src.indexOf('export const QUESTIONS'), src.indexOf('---------- perfis'));
    assert.ok(!/composeFile/.test(block), 'nenhuma pergunta nova sobre composeFile');
    assert.ok(!/key: 'ports'/.test(block), 'nenhuma pergunta nova sobre ports');
  });
});

describe('IN-03 S2: sem backend java => sem chaves maven + N/A justificado', () => {
  it('stack node nao contem maven', () => {
    const cfg = generateConfig({ project: 'demo', stack: 'node', suiteCommand: 'node --test', pluginsDir: '/tmp/x' });
    const blob = JSON.stringify(cfg);
    assert.ok(!blob.includes('mvn') && !blob.includes('maven'), 'sem maven');
    assert.ok(cfg.stack.backend.includes('N/A'), 'backend N/A justificado');
    assert.ok(cfg.stack.frontend.includes('N/A'), 'frontend N/A justificado');
  });
});

describe('IN-03 S3: sem funcao de copia no codigo', () => {
  it('grep: install.mjs nao expoe caminho de copia', () => {
    const src = fs.readFileSync(new URL('../install.mjs', import.meta.url), 'utf8');
    assert.ok(!/copyTemplate|copyConfig|cp\s+-r|readFileSync\(.*template/i.test(src), 'sem copia de template');
    assert.ok(!/pkill\s+-f/.test(src), 'nunca pkill -f');
  });
  it('gerador puro: deterministico e sem I/O', () => {
    const a = { project: 'demo', stack: 'node', suiteCommand: 'node --test', pluginsDir: '/tmp/x' };
    assert.deepEqual(generateConfig(a), generateConfig(a));
    const src = fs.readFileSync(new URL('../install.mjs', import.meta.url), 'utf8');
    const fn = src.slice(src.indexOf('export function generateConfig'));
    assert.ok(!/readFileSync|writeFileSync|copyFileSync/.test(fn.split('export function')[0] || fn.slice(0, 2000)), 'gerador sem I/O');
  });
});

// EX-BE-03 (RF-02): preset novo do par react — ADICAO pura ao registry.
describe('EX-BE-03 preset java+react (RF-02)', () => {
  it('generateConfig: rotulos proprios java/react + mcp chrome-devtools', () => {
    const cfg = generateConfig({ project: 'demo', stack: 'java+react' });
    assert.equal(cfg.stack.backend, 'java+react backend (declared via Q&A)');
    assert.equal(cfg.stack.frontend, 'java+react frontend (declared via Q&A)');
    assert.deepEqual(cfg.mcp.required, ['chrome-devtools']);
  });

  it('rotulos do par react sao distintos do par vue', () => {
    const react = generateConfig({ project: 'demo', stack: 'java+react' });
    const vue = generateConfig({ project: 'demo', stack: 'java+vue' });
    assert.notEqual(react.stack.backend, vue.stack.backend);
    assert.notEqual(react.stack.frontend, vue.stack.frontend);
  });

  it('moduleMap sem chave de stack (nao criaria ref ausente em config-ref-missing)', () => {
    const cfg = generateConfig({ project: 'demo', stack: 'java+react' });
    assert.deepEqual(Object.keys(cfg.moduleMap), ['plugins', 'rules', 'schemas']);
  });
});

// EX-BE-03 (RF-07) + BUG-1 (harness-eixos-stack-p2): default de suiteCommand do
// eixo web nunca e ''. AT-2 (review iteracao 2): a expectativa e o PRIMEIRO
// candidato; estes casos provam NAO-VAZIO — a selecao "primeiro candidato que
// resolve no PATH" e provada no describe seguinte (candidatos distinguiveis).
//
// BUG-1 (criterio autorizado pelo owner): o eixo web INTEIRO (vue e react)
// passa a ter candidatos. Antes o par vue retornava '' e o caminho
// "defaults + Enter" do wizard terminava em BAD_ANSWER (prompt sem default).
// A assert de valor congelado 'java+vue continua ""' foi SUBSTITUIDA pela
// assert do novo criterio — mudanca de criterio autorizada, nao regressao
// silenciosa (declarada em .spec/bugs/harness-eixos-stack-p2/TASKS.md).
describe('EX-BE-03 defaultSuiteFor eixo web — nao-vazio (RF-07 + BUG-1)', () => {
  it('react: valor nao-vazio e igual ao primeiro candidato', () => {
    assert.equal(defaultSuiteFor('java+react'), 'npm run test:run');
  });

  it('vue (BUG-1): passa a ter candidato — nao e mais ""', () => {
    assert.notEqual(defaultSuiteFor('java+vue'), '');
    assert.equal(defaultSuiteFor('java+vue'), 'npm run test:run');
  });

  it('sem npm no PATH: continua nao-vazio nos DOIS pares web (primeiro candidato)', () => {
    const saved = process.env.PATH;
    try {
      process.env.PATH = '';
      for (const stack of ['java+vue', 'java+react']) {
        assert.equal(defaultSuiteFor(stack), 'npm run test:run', `${stack}: primeiro candidato, nunca ""`);
      }
    } finally {
      process.env.PATH = saved;
    }
  });
});

// AT-2: prova da REGRA (nao da constante) — com candidatos multiplos, o vencedor
// e o primeiro que resolve no PATH. Usa `dart` (['dart test','make test']) porque
// os 2 candidatos do par web compartilham o binario `npm` e seriam
// indistinguiveis; a regra testada e o loop compartilhado de defaultSuiteFor.
describe('EX-BE-03 defaultSuiteFor seleciona o 1o candidato que resolve (RF-07)', () => {
  it('PATH so com `make`: pula `dart test` e devolve `make test`', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-path-'));
    const saved = process.env.PATH;
    try {
      fs.writeFileSync(path.join(dir, 'make'), '#!/bin/sh\n');
      process.env.PATH = dir;
      assert.equal(defaultSuiteFor('dart'), 'make test', 'segundo candidato vence quando o primeiro nao resolve');
      assert.notEqual(defaultSuiteFor('dart'), 'dart test', 'nao devolve o primeiro as cegas');
    } finally {
      process.env.PATH = saved;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // BUG-1: a regra do loop vale para o eixo web (PATH controlado). Os dois
  // candidatos compartilham o binario `npm`, logo o vencedor e SEMPRE o primeiro
  // — com npm resolvendo (loop) e sem npm (fallback): nunca ''.
  it('BUG-1 eixo web: PATH com npm => primeiro candidato; PATH vazio => primeiro candidato (nunca "")', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-path-'));
    const saved = process.env.PATH;
    try {
      fs.writeFileSync(path.join(dir, 'npm'), '#!/bin/sh\n');
      process.env.PATH = dir;
      assert.equal(defaultSuiteFor('java+vue'), 'npm run test:run', 'npm resolve: primeiro candidato vence');
      assert.equal(defaultSuiteFor('java+react'), 'npm run test:run', 'react: mesmo criterio');
      process.env.PATH = '';
      assert.equal(defaultSuiteFor('java+vue'), 'npm run test:run', 'nada resolve: primeiro candidato, nunca ""');
    } finally {
      process.env.PATH = saved;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
