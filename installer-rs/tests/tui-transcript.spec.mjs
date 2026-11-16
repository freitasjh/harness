// VAL-01 — teste ANTES da implementação (ADR-004 §2.1/§3 itens 2,5,13).
// Transcript é autoridade externa: 16.336 B, 5 marcadores, sha congelado,
// oráculo c63e333 detach+limpo ANTES de cada comparação, mutação de 1 byte
// reprova. Nenhum byte novo é escrito no transcript — a mutação vive em /tmp.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../..', import.meta.url))
const TRANSCRIPT_REL = '.spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt'
const TRANSCRIPT = path.join(REPO, TRANSCRIPT_REL)
const REPORT = path.join(REPO, 'harness', 'prd-installer-rust-adr-004.json')
const ORACLE_DIR = '/tmp/opencode/harness-oracle-c63e333'
const ORACLE_FULL = 'c63e33307710e1c6271f5c68b2dd9fb15283f49c'
const EXPECTED_BYTES = 16336
const MARKERS = ['[1/2]', '[2/2]', '[1-5]', '(default: 1)', '(q cancela)']
const FROZEN_SHA = 'fe1f918757f30afec7c43518b94fb19e341dca4a219d7f44848076d7ba165109'

const git = (args, cwd = REPO) =>
  String(execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })).trim()

function materializeOracle() {
  try { git(['worktree', 'remove', '--force', ORACLE_DIR]) } catch {}
  fs.rmSync(ORACLE_DIR, { recursive: true, force: true })
  git(['worktree', 'add', '--detach', ORACLE_DIR, ORACLE_FULL])
}

function assertOracleClean(rotulo) {
  const sha = git(['rev-parse', 'HEAD'], ORACLE_DIR)
  const status = git(['status', '--porcelain'], ORACLE_DIR)
  assert.equal(sha, ORACLE_FULL, `${rotulo}: SHA do oráculo divergente`)
  assert.equal(status, '', `${rotulo}: worktree sujo (${status})`)
  return { rotulo, sha, clean: true }
}

function releaseOracle() {
  try { git(['worktree', 'remove', '--force', ORACLE_DIR]) } catch {}
  fs.rmSync(ORACLE_DIR, { recursive: true, force: true })
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const transcriptBytes = () => fs.readFileSync(TRANSCRIPT)
const oracleTranscript = () => path.join(ORACLE_DIR, TRANSCRIPT_REL)

after(() => releaseOracle())

test('transcript: 16336 bytes, sha congelado e git diff vazio', () => {
  const buf = transcriptBytes()
  assert.equal(buf.length, EXPECTED_BYTES, 'transcript 16.336 bytes')
  assert.equal(sha256(buf), FROZEN_SHA, 'sha do veredito congelado')
  const diff = git(['diff', '--exit-code', '--', TRANSCRIPT_REL])
  assert.equal(diff, '', 'git diff --exit-code vazio (nenhum byte novo)')
})

test('cinco marcadores presentes', () => {
  const text = transcriptBytes().toString('utf8')
  for (const m of MARKERS) {
    assert.ok(text.includes(m), `marcador ${m} ausente`)
  }
})

test('oráculo detach c63e333 limpo ANTES de cada comparação; diff de transcript vazio', () => {
  materializeOracle()
  const checkpoints = []
  for (let i = 1; i <= 3; i++) {
    checkpoints.push(assertOracleClean(`comparação ${i}/3`))
    const diff = execFileSync('diff', ['-u', TRANSCRIPT, oracleTranscript()], {
      encoding: 'utf8',
    })
    assert.equal(diff, '', `comparação ${i}/3: diff transcript↔oráculo vazio`)
  }
  assert.equal(checkpoints.length, 3)
})

test('mutação de 1 byte em cópia /tmp reprova', () => {
  materializeOracle()
  assertOracleClean('mutação 1 byte')
  const original = transcriptBytes()
  const mutant = Buffer.from(original)
  mutant[0] = mutant[0] === 0x5b ? 0x58 : 0x5b // '[' -> 'X'
  assert.equal(mutant.length, EXPECTED_BYTES, 'mutação não muda tamanho')
  assert.notEqual(sha256(mutant), FROZEN_SHA, 'sha muda com 1 byte')

  const copy = path.join('/tmp/opencode', 'adr004-mutant-transcript.txt')
  fs.writeFileSync(copy, mutant)
  try {
    let diff = ''
    try {
      diff = execFileSync('diff', ['-u', TRANSCRIPT, copy], { encoding: 'utf8' })
    } catch (e) {
      diff = String(e.stdout ?? '')
    }
    assert.notEqual(diff, '', '1 byte mutado ⇒ diff NÃO vazio (prova reprova)')
  } finally {
    fs.rmSync(copy, { force: true })
  }
})

test('8 vereditos congelados registrados no RELATÓRIO antes da comparação', () => {
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'))
  const v = report.frozenVerdicts
  assert.equal(v.length, 8, '8 vereditos congelados')
  assert.equal(report.frozenVerdictsRecordedBeforeFirstComparison, true)
  for (const entry of v) {
    assert.match(entry.sha256, /^[0-9a-f]{64}$/, `sha 64-hex: ${entry.path}`)
  }
  const t = v.find((e) => e.path === TRANSCRIPT_REL)
  assert.ok(t, 'transcript está entre os 8 vereditos')
  assert.equal(t.sha256, FROZEN_SHA)
})
