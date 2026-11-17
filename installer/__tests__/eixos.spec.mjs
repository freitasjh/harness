// eixos.spec.mjs — EIX-01 (ADR-001 §3 item 1): inventário FECHADO 8×6=48.
// ORÁCULO INDEPENDENTE: as tabelas abaixo são literais escritas à mão a partir
// da decisão §16 / SPEC RF-01. Nenhuma delas deriva de `eixos.mjs` — por isso
// falha se o inventor mudar de forma silenciosa.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ORACULO_BACKENDS = [
  'java', 'node', 'rust', 'nestjs', 'dart', 'flutter', 'other', 'none',
];
const ORACULO_FRONTENDS = [
  'vue', 'react', 'dart', 'flutter', 'other', 'none',
];
const ORACULO_MOBILE = ['dart', 'flutter'];
const ORACULO_EXCECAO = { 'flutter+flutter': ['flutter', 'dart'] };
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

import {
  BACKEND_IDS,
  FRONTEND_IDS,
  MOBILE_AXIS_IDS,
  EIXOS,
  AXIS_PAIRS,
  PAIR_KEYS,
  MOBILE_PAIR_EXCEPTIONS,
  EixoInvalidoError,
  isKnownAxisId,
  isValidAxisPair,
  assertAxisPair,
  exceptionForPair,
} from '../eixos.mjs';

describe('EIX-01 cardinalidade: 8 backends × 6 frontends = 48 (RF-01)', () => {
  it('8 × 6 = 48 (literal, não deduzido do módulo)', () => {
    assert.equal(ORACULO_BACKENDS.length, 8);
    assert.equal(ORACULO_FRONTENDS.length, 6);
    assert.equal(ORACULO_BACKENDS.length * ORACULO_FRONTENDS.length, 48);
    assert.equal(BACKEND_IDS.length, 8);
    assert.equal(FRONTEND_IDS.length, 6);
    assert.equal(BACKEND_IDS.length * FRONTEND_IDS.length, 48);
    assert.equal(AXIS_PAIRS.length, 48);
    assert.equal(PAIR_KEYS.length, 48);
  });

  it('conjuntos fechados batem com o oráculo literal (nem a mais, nem a menos)', () => {
    assert.deepEqual([...BACKEND_IDS], ORACULO_BACKENDS);
    assert.deepEqual([...FRONTEND_IDS], ORACULO_FRONTENDS);
    assert.deepEqual([...MOBILE_AXIS_IDS], ORACULO_MOBILE);
    assert.deepEqual({ backend: [...EIXOS.backend], frontend: [...EIXOS.frontend] }, {
      backend: ORACULO_BACKENDS, frontend: ORACULO_FRONTENDS,
    });
  });

  it('48 pares derivados = oráculo literal, sem duplicata (bidirecional)', () => {
    assert.deepEqual([...PAIR_KEYS], ORACULO_PAIRS);
    assert.equal(new Set(PAIR_KEYS).size, 48);
    for (const key of ORACULO_PAIRS) assert.ok(PAIR_KEYS.includes(key), `par ausente: ${key}`);
    for (const key of PAIR_KEYS) assert.ok(ORACULO_PAIRS.includes(key), `par fora do oráculo: ${key}`);
    assert.deepEqual(AXIS_PAIRS.map((p) => `${p.backend}+${p.frontend}`), ORACULO_PAIRS);
  });
});

describe('EIX-01 oráculo 48/48: um teste por par do inventário', () => {
  for (const chave of ORACULO_PAIRS) {
    const [backend, frontend] = chave.split('+');
    it(`${chave}: par derivado e aceito (${backend} backend × ${frontend} frontend)`, () => {
      assert.ok(isValidAxisPair({ backend, frontend }), chave);
      assert.doesNotThrow(() => assertAxisPair({ backend, frontend }), chave);
      assert.ok(PAIR_KEYS.includes(chave), chave);
      assert.ok(AXIS_PAIRS.some((p) => p.backend === backend && p.frontend === frontend), chave);
    });
  }
});

describe('EIX-01 imutabilidade: conjuntos fechados de verdade', () => {
  it('arrays e pares congelados; EIXOS e exceção congelados', () => {
    assert.ok(Object.isFrozen(BACKEND_IDS));
    assert.ok(Object.isFrozen(FRONTEND_IDS));
    assert.ok(Object.isFrozen(MOBILE_AXIS_IDS));
    assert.ok(Object.isFrozen(EIXOS));
    assert.ok(Object.isFrozen(AXIS_PAIRS));
    assert.ok(Object.isFrozen(PAIR_KEYS));
    assert.ok(Object.isFrozen(MOBILE_PAIR_EXCEPTIONS));
    for (const pair of AXIS_PAIRS) assert.ok(Object.isFrozen(pair));
  });

  it('mutar os arrays expostos não altera o inventário', () => {
    assert.throws(() => { BACKEND_IDS.push('ruby'); }, TypeError);
    assert.throws(() => { FRONTEND_IDS.push('svelte'); }, TypeError);
    assert.throws(() => { AXIS_PAIRS.push({ backend: 'ruby', frontend: 'vue' }); }, TypeError);
    assert.equal(BACKEND_IDS.length, 8);
    assert.equal(AXIS_PAIRS.length, 48);
  });
});

describe('EIX-01 exceção mobile DECLARADA, nunca inferida do nome (RF-01/E2)', () => {
  it('dart e flutter valem nos DOIS eixos por declaração explícita', () => {
    for (const id of ORACULO_MOBILE) {
      assert.ok(BACKEND_IDS.includes(id), `${id} em backend`);
      assert.ok(FRONTEND_IDS.includes(id), `${id} em frontend`);
      assert.ok(isKnownAxisId('backend', id));
      assert.ok(isKnownAxisId('frontend', id));
    }
  });

  it('tabela literal: única exceção flutter+flutter → [flutter, dart]', () => {
    assert.deepEqual({ ...MOBILE_PAIR_EXCEPTIONS }, ORACULO_EXCECAO);
    assert.deepEqual(exceptionForPair({ backend: 'flutter', frontend: 'flutter' }), ['flutter', 'dart']);
    assert.deepEqual(Object.keys(MOBILE_PAIR_EXCEPTIONS), ['flutter+flutter']);
  });

  it('não inferir do nome: dart+dart não herda a exceção', () => {
    assert.equal(exceptionForPair({ backend: 'dart', frontend: 'dart' }), null);
    assert.equal(exceptionForPair({ backend: 'flutter', frontend: 'vue' }), null);
    assert.equal(exceptionForPair({ backend: 'java', frontend: 'flutter' }), null);
  });

  it('exceção devolve CÓPIA: mutar o retorno não corrompe a declaração', () => {
    const copia = exceptionForPair({ backend: 'flutter', frontend: 'flutter' });
    copia.push('extra');
    assert.deepEqual(exceptionForPair({ backend: 'flutter', frontend: 'flutter' }), ['flutter', 'dart']);
    assert.deepEqual(MOBILE_PAIR_EXCEPTIONS['flutter+flutter'], ['flutter', 'dart']);
  });
});

describe('EIX-01 combinação fora do inventário é reprovada (BDD falha)', () => {
  it('isValidAxisPair: eixo desconhecido reprova', () => {
    assert.equal(isValidAxisPair({ backend: 'ruby', frontend: 'vue' }), false);
    assert.equal(isValidAxisPair({ backend: 'java', frontend: 'svelte' }), false);
    assert.equal(isValidAxisPair({ backend: 'java', frontend: 'flutter+flutter' }), false);
    assert.equal(isKnownAxisId('backend', 'ruby'), false);
    assert.equal(isKnownAxisId('inexistente', 'java'), false);
  });

  it('isValidAxisPair: forma inválida reprova (fail-closed)', () => {
    assert.equal(isValidAxisPair(null), false);
    assert.equal(isValidAxisPair(undefined), false);
    assert.equal(isValidAxisPair('java+vue'), false);
    assert.equal(isValidAxisPair({ backend: 'java' }), false);
    assert.equal(isValidAxisPair({ frontend: 'vue' }), false);
  });

  it('assertAxisPair lança EixoInvalidoError com código estável', () => {
    assert.throws(
      () => assertAxisPair({ backend: 'ruby', frontend: 'vue' }),
      (err) => err instanceof EixoInvalidoError && err.code === 'INVALID_AXIS_PAIR',
    );
    assert.throws(() => assertAxisPair(null), EixoInvalidoError);
    assert.equal(assertAxisPair({ backend: 'java', frontend: 'vue' }).backend, 'java');
    assert.throws(
      () => exceptionForPair({ backend: 'ruby', frontend: 'vue' }),
      EixoInvalidoError,
    );
  });
});

describe('EIX-01 zero preset casado, zero op de CLI visual no inventor', () => {
  const fonte = fs.readFileSync(new URL('../eixos.mjs', import.meta.url), 'utf8');
  const codigo = fonte.replace(/\/\/.*$/gm, '');

  it('nenhum import: inventor puro, sem arrastar registry/preset/runtime', () => {
    assert.equal(/\bimport\s/.test(codigo), false, 'eixos.mjs não deve importar nada');
    assert.equal(/\brequire\s*\(/.test(codigo), false);
  });

  it('nenhum símbolo de preset casado no inventor', () => {
    for (const simbolo of [
      'STACK_PROFILES', 'STACK_VALUES', 'profileOf', 'presetOfAxes',
      'WIZARD_MENU', 'contract-registry', 'contract-pure', 'install.mjs',
    ]) {
      assert.equal(codigo.includes(simbolo), false, `preset casado vazou: ${simbolo}`);
    }
  });

  it('nenhuma op de CLI visual no inventor (escopo ADR-002)', () => {
    for (const op of ['ratatui', 'inquire', 'dialoguer', '@inquirer', 'contract-tui']) {
      assert.equal(fonte.toLowerCase().includes(op), false, `CLI visual vazou: ${op}`);
    }
  });
});
