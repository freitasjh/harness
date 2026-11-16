// HARN-VAL-02 — TDD FIRST. Gate de differential completo: result/ok/exit-code.
// Nenhuma op é PASS por omissão; mutação de 1 byte reprova toda op.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canonicalJson } from '../../installer/parity-oracle.mjs'
import {
  fullComparison,
  normalizeSide,
  mutatedRejects,
  checkOracle,
  OP_TABLE,
  ORACLE_TABLE,
} from './prova-engine.mjs'

const env = (result, ok = true, exit = 0) => ({
  v: 1, ok, op: 'probe', ...(ok ? { result } : { error: { code: 'BAD_ANSWER' } }),
})

describe('fullComparison — gate de result + ok + exit-code (VAL-02)', () => {
  const oracle = env({ answer: 42 })
  it('happy: side/ok/exit iguais ⇒ allMatch', () => {
    const r = fullComparison(oracle, env({ answer: 42 }), 0, 0, true)
    assert.equal(r.allMatch, true)
    assert.equal(r.sideMatch, true)
    assert.equal(r.okMatch, true)
    assert.equal(r.exitCodeMatch, true)
  })
  it('MUTAÇÃO: 1 byte no result derruba allMatch', () => {
    const r = fullComparison(oracle, env({ answer: 43 }), 0, 0, false)
    assert.equal(r.allMatch, false)
    assert.equal(r.sideMatch, false)
  })
  it('MUTAÇÃO: ok divergente derruba allMatch mesmo com side vazio', () => {
    const r = fullComparison(oracle, env({ answer: 42 }, false), 0, 1, true)
    assert.equal(r.okMatch, false)
    assert.equal(r.allMatch, false)
  })
  it('MUTAÇÃO: exit-code divergente derruba allMatch', () => {
    const r = fullComparison(oracle, env({ answer: 42 }), 0, 2, true)
    assert.equal(r.exitCodeMatch, false)
    assert.equal(r.allMatch, false)
  })
  it('protocolo 2 nunca é esperado para op de motor', () => {
    const r = fullComparison(oracle, env({ answer: 42 }), 2, 2, true)
    assert.equal(r.oracleExitMatch, false)
    assert.equal(r.allMatch, false)
  })
})

describe('normalizeSide — volátil declarado, simétrico, só buildManifest.date', () => {
  it('remove date de buildManifest nos dois lados (hash de conteúdo preservado no resto)', () => {
    const a = normalizeSide('buildManifest', { date: '2026-01-01T00:00:00.000Z', version: '0.1.0' })
    const b = normalizeSide('buildManifest', { date: '2026-01-02T00:00:00.000Z', version: '0.1.0' })
    assert.equal(canonicalJson(a), canonicalJson(b))
    assert.equal('date' in a, false)
  })
  it('NÃO remove date de nenhuma outra op', () => {
    const v = normalizeSide('runDoctor', { date: 'x', verdict: 'SAUDÁVEL' })
    assert.equal(v.date, 'x')
  })
})

describe('mutatedRejects — prova de que cada oráculo é sensível a 1 byte', () => {
  it('mutação de 1 byte do lado oráculo reprova a comparação', () => {
    const r = mutatedRejects('preflight', { target: '/tmp/x', uid: 1000 })
    assert.equal(r.rejected, true)
    assert.notEqual(r.original, r.mutated)
    assert.match(r.path, /^sha256:/)
  })
  it('mutação vazia não é aceita (fail-closed)', () => {
    assert.throws(() => mutatedRejects('preflight', ''), /mutação/)
  })
})

describe('OP_TABLE — 23 ops, nenhuma a mais, nenhuma a menos (SI-6)', () => {
  it('exatamente 23 nomes D-ENGINE de ADR-003 §2.1', () => {
    assert.equal(OP_TABLE.length, 23)
    assert.equal(new Set(OP_TABLE).size, 23)
    for (const name of ['planUpgrade', 'applyUpgrade']) {
      assert.equal(OP_TABLE.includes(name), false)
    }
  })
  it('toda op tem oráculo externo e comando de prova (tabela 23 linhas do RELATÓRIO)', () => {
    assert.equal(Object.keys(ORACLE_TABLE).length, 23)
    for (const op of OP_TABLE) {
      assert.ok(ORACLE_TABLE[op].oracle, `${op} sem oráculo`)
      assert.match(ORACLE_TABLE[op].command, /prova\(/, `${op} sem comando de prova`)
    }
  })
})

describe('checkOracle — SHA cheio + status --porcelain antes de cada comparação', () => {
  it('aceita SHA c63e333 com worktree limpo', () => {
    const run = (bin, args) => ({
      stdout: args.includes('rev-parse')
        ? 'c63e33307710e1c6271f5c68b2dd9fb15283f49c\n'
        : '',
    })
    const r = checkOracle({ run })
    assert.equal(r.head, 'c63e33307710e1c6271f5c68b2dd9fb15283f49c')
    assert.equal(r.porcelain, '')
  })
  it('MUTAÇÃO: worktree sujo reprova antes da comparação', () => {
    const run = (bin, args) => ({
      stdout: args.includes('rev-parse')
        ? 'c63e33307710e1c6271f5c68b2dd9fb15283f49c\n'
        : ' M installer/install.mjs\n',
    })
    assert.throws(() => checkOracle({ run }), /worktree sujo/)
  })
})
