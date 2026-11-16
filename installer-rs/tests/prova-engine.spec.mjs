// HARN-VAL-02 — TDD FIRST. Gate de differential completo: result/ok/exit-code.
// Nenhuma op é PASS por omissão; mutação de 1 byte reprova toda op.
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalJson, materializeOracle, releaseOracle } from '../../installer/parity-oracle.mjs'
import {
  fullComparison,
  normalizeSide,
  mutatedRejects,
  checkOracle,
  prova,
  OP_TABLE,
  ORACLE_TABLE,
  WORKTREE,
  MUTANT_BIN,
} from './prova-engine.mjs'

const SPEC_HERE = path.dirname(fileURLToPath(import.meta.url))
const SPEC_ROOT = path.resolve(SPEC_HERE, '..', '..')
const SPEC_TMP = path.join('/tmp/opencode', 'harness-prova-engine')

function requestFor(op) {
  const raw = JSON.parse(fs.readFileSync(path.join(SPEC_HERE, 'req-fixtures.json'), 'utf8'))[op]
  return JSON.parse(JSON.stringify(raw)
    .replaceAll('{{REPO_ROOT}}', SPEC_ROOT)
    .replaceAll('{{PROVA_TMP}}', SPEC_TMP))
}

const runWithMode = (mode) => (bin, args, opts = {}) => spawnSync(bin, args, {
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
  ...opts,
  ...(bin === MUTANT_BIN ? { env: { ...process.env, MUTANT_MODE: mode } } : {}),
})

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
    const a = normalizeSide('buildManifest', { date: '2026-01-01T00:00:00.000Z', version: '1.0.0' })
    const b = normalizeSide('buildManifest', { date: '2026-01-02T00:00:00.000Z', version: '1.0.0' })
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

// Anti-C1 — MUTAÇÃO NO CAMINHO REAL. `mutatedRejects` mexe num diffUnified
// sintético e prova outra coisa; aqui o binário mutante entra pelo MESMO
// `prova()` das 23 provas, com exit-code preservado. Com o double-unwrap
// antigo, todos os modos abaixo retornariam `ok` (diff vazio) e estes testes
// falhariam — é essa a regressão que trava o defeito.
describe('prova() anti-C1 — mutante exit-preserving no caminho real (ADR-003 C1)', () => {
  before(() => {
    for (const d of ['src', 'emptysrc', 'target', 'checks', 'init', 'backup']) {
      fs.mkdirSync(path.join(SPEC_TMP, d), { recursive: true })
    }
    fs.writeFileSync(path.join(SPEC_TMP, 'src', 'opencode.json'), '{"agent":{}}\n')
    fs.writeFileSync(path.join(SPEC_TMP, 'checks', 'opencode.json'), '{}\n')
    fs.writeFileSync(path.join(SPEC_TMP, 'checks', 'harness.config.json'), '{}\n')
    fs.writeFileSync(path.join(SPEC_TMP, 'checks', '.harness-install.json'), '{"manifestSchemaVersion":1}\n')
    fs.writeFileSync(path.join(SPEC_TMP, 'answers.json'), JSON.stringify({
      project: 'demo', stack: 'node', suiteCommand: 'node --test', pluginsDir: '.opencode/plugins',
    }) + '\n')
    if (fs.existsSync(path.join(WORKTREE, '.git'))) releaseOracle({ worktreeDir: WORKTREE })
    materializeOracle({ worktreeDir: WORKTREE })
  })
  after(() => {
    try { releaseOracle({ worktreeDir: WORKTREE }) } catch { /* já liberado */ }
  })

  const reqErro = {
    v: 1, op: 'requireVerifiedBackup',
    args: { backup: { verified: false, backupDir: '/tmp/opencode/harness-prova-engine-backup' } },
    answers: {}, target: null,
  }

  it('result corrompido ⇒ reprovado (sideSha oracle != bin)', () => {
    const r = prova({ bin: MUTANT_BIN, op: 'preflight', request: requestFor('preflight'), run: runWithMode('result') })
    assert.equal(r.status, 'reprovado')
    assert.equal(r.comparison.allMatch, false)
    assert.equal(r.comparison.sideMatch, false)
    assert.notEqual(r.sideSha.oracle, r.sideSha.bin)
    assert.match(r.diff, /__MUTANT__/)
  })
  it('error.code corrompido ⇒ reprovado', () => {
    const r = prova({ bin: MUTANT_BIN, op: 'requireVerifiedBackup', request: reqErro, run: runWithMode('errorcode') })
    assert.equal(r.status, 'reprovado')
    assert.equal(r.comparison.sideMatch, false)
    assert.match(r.diff, /MUTANTCODE/)
  })
  it('ok invertido ⇒ reprovado', () => {
    const r = prova({ bin: MUTANT_BIN, op: 'preflight', request: requestFor('preflight'), run: runWithMode('okflip') })
    assert.equal(r.status, 'reprovado')
    assert.equal(r.comparison.okMatch, false)
    assert.equal(r.comparison.allMatch, false)
  })
  it('exit-code divergente ⇒ reprovado', () => {
    const r = prova({ bin: MUTANT_BIN, op: 'preflight', request: requestFor('preflight'), run: runWithMode('exit') })
    assert.equal(r.status, 'reprovado')
    assert.equal(r.comparison.exitCodeMatch, false)
    assert.equal(r.comparison.allMatch, false)
  })
  it('buildManifest.date divergente ⇒ ok (normalizado; só date é volátil)', () => {
    const r = prova({ bin: MUTANT_BIN, op: 'buildManifest', request: requestFor('buildManifest'), run: runWithMode('date') })
    assert.equal(r.status, 'ok')
    assert.equal(r.comparison.sideMatch, true)
    assert.deepEqual(r.normalized, ['date'])
    assert.equal(r.sideSha.oracle, r.sideSha.bin)
  })
  it('buildManifest: corromper QUALQUER outro campo ⇒ reprovado (normalização não é irrestrita)', () => {
    const r = prova({ bin: MUTANT_BIN, op: 'buildManifest', request: requestFor('buildManifest'), run: runWithMode('result') })
    assert.equal(r.status, 'reprovado')
    assert.equal(r.comparison.sideMatch, false)
    assert.notEqual(r.sideSha.oracle, r.sideSha.bin)
  })
  it('mutante 100% corrompido (all) reprova 23/23 no mesmo prova()', () => {
    const vereditos = OP_TABLE.map((op) => ({
      op,
      r: prova({ bin: MUTANT_BIN, op, request: requestFor(op), run: runWithMode('all') }),
    }))
    const reprovados = vereditos.filter(({ r }) => r.status === 'reprovado')
    const provados = vereditos.filter(({ r }) => r.status === 'ok')
    assert.equal(reprovados.length, 23, `esperado 23 reprovados, obtido ${reprovados.length}: ${provados.map((p) => p.op).join(',')}`)
    assert.equal(provados.length, 0)
    assert.ok(reprovados.every(({ r }) => r.comparison.sideMatch === false || r.comparison.okMatch === false))
  })
})
