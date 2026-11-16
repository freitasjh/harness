// VAL-02 — prova integral ADR-004: 8 `op`s TUI 1:1, transcript 16.336 B,
// canais MEDIDOS, segredo sem eco, guarda RF-05(b) 3/3, rito ADR-002 reusado.
// Oráculo = c63e333 em worktree detach; SHA + porcelain ANTES de cada prova;
// mutação 1 byte por op + binário mutante exit-preserving; sem cargo insta accept.
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ORACLE_FULL, canonicalJson, materializeOracle, releaseOracle,
  ARCHIVED_TRANSCRIPT_REL, isLiteralProven,
} from '../../installer/parity-oracle.mjs'
import { checkOracle, fullComparison, mutatedRejects, WORKTREE, MUTANT_BIN } from './prova-engine.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const BIN = path.join(ROOT, 'installer-rs', 'target', 'debug', 'harness-installer')
const BRIDGE = path.join(HERE, 'tui-oracle-bridge.mjs')
const TRANSCRIPT = path.join(ROOT, ARCHIVED_TRANSCRIPT_REL)
const REPORT_002 = path.join(ROOT, 'harness', 'prd-installer-rust-adr-002.json')
const LITERAL = path.join(ROOT, 'installer', '__tests__', 'oracle-literal.sha256')
const LITERAL_SHA = '9fa4530bbe0d431781a159cced28c011e1d94a8abea5ca1cc8465608976552f0'
const SECRET = 'SEGREDO_PROVA'
const TMP = '/tmp/opencode/adr004-prova'
const MARKERS = ['[1/2]', '[2/2]', '[1-5]', '(default: 1)', '(q cancela)']
const TRANSCRIPT_BYTES = 16336
const TRANSCRIPT_SHA = 'fe1f918757f30afec7c43518b94fb19e341dca4a219d7f44848076d7ba165109'

const sha = (v) => createHash('sha256').update(v).digest('hex')
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opts })
const req = (op, args = {}) => JSON.stringify({ v: 1, op, args, answers: {}, target: null }) + '\n'

function diffUnified(a, b) {
  fs.mkdirSync(TMP, { recursive: true })
  const pa = path.join(TMP, 'diff-a')
  const pb = path.join(TMP, 'diff-b')
  fs.writeFileSync(pa, `${a}\n`)
  fs.writeFileSync(pb, `${b === undefined ? '∅' : b}\n`)
  const d = run('diff', ['-u', pa, pb])
  return { empty: d.status === 0, text: d.stdout || '' }
}

// Oráculo de cada op (ADR-004 §2.1, coluna "comando de prova").
const FIX = Object.freeze({
  askMenuStep: {
    header: '[INFO] W2m tipo de projeto', items: [{ key: '4', label: 'web', stack: 'java+vue', next: 'frontend' }],
    step: 1, total: 2, choice: '4', width: 0, answers: {},
  },
  detect: { target: TMP },
  printPlan: { plan: [], answers: {} },
  printUsage: {},
  promptAnswers: {
    target: TMP,
    stdinText: 'demo\nnode\nnode\n.\n\n',
    scripted: { target: TMP, stack: 'node', project: 'demo', suiteCommand: 'node', pluginsDir: '.' },
  },
  readSecretPrompt: { prompt: 'Token de deploy (sensivel, opcional)?' },
  readSecretRaw: { input: '' },
  sourceLineOf: { marker: 'W2m menu manual em 2 passos (ADR-004/D-A)', path: path.join(WORKTREE, 'installer', 'install.mjs') },
})
const OPS = Object.keys(FIX)

function prova(op, bin) {
  checkOracle()
  const request = req(op, FIX[op])
  const oracle = run(process.execPath, [BRIDGE], {
    input: request,
    env: { ...process.env, ORACLE_MJS: path.join(WORKTREE, 'installer', 'install.mjs') },
  })
  if (oracle.status !== 0) throw new Error(`tui-bridge oracle exit ${oracle.status}: ${oracle.stderr}`)
  const subject = run(bin, ['contract-v1'], { input: request })
  const oEnv = JSON.parse(oracle.stdout.trim())
  let bEnv
  try { bEnv = JSON.parse(subject.stdout.trim()) } catch {
    return { op, status: 'reprovado', reason: 'stdout não é envelope' }
  }
  const side = (e) => canonicalJson(e.ok ? e.result : (e.error && e.error.code))
  const o = side(oEnv)
  const b = side(bEnv)
  const d = diffUnified(o, b)
  const comparison = fullComparison(oEnv, bEnv, oracle.status, subject.status, d.empty)
  const mutation = mutatedRejects(op, oEnv.ok ? oEnv.result : (oEnv.error && oEnv.error.code), run)
  return {
    op, status: comparison.allMatch ? 'ok' : 'reprovado', comparison,
    sideSha: { oracle: sha(o === undefined ? '∅' : o), bin: sha(b === undefined ? '∅' : b) },
    diff: d.text, mutation, opDoEnvelope: bEnv.op, v: bEnv.v,
  }
}

function measureChannels() {
  fs.mkdirSync(TMP, { recursive: true })
  const valid = run(BIN, ['contract-v1'], { input: req('printUsage') })
  const protocol = run(BIN, [], { input: '' })
  const rJson = path.join(TMP, 'r.json')
  const rErr = path.join(TMP, 'r.err')
  fs.writeFileSync(rJson, valid.stdout)
  fs.writeFileSync(rErr, protocol.stderr)
  const j = fs.readFileSync(rJson, 'utf8')
  const e = fs.readFileSync(rErr, 'utf8')
  const envelopesInErr = (e.match(/"v":1/g) || []).length
  const progressInJson = (j.match(/^\[(OK|INFO|AVISO)\]/gm) || []).length
  const jsonLines = j.trim().split('\n').filter(Boolean)
  let parsed = null
  try { parsed = JSON.parse(jsonLines[0] || '') } catch { /* fail-closed abaixo */ }
  return {
    measured: true,
    envelopeLinesInStdout: jsonLines.length,
    envelopeOp: parsed && parsed.op,
    stderrBytes: Buffer.byteLength(e),
    stderrHasProtocol: e.includes('protocol:'),
    grepV1InErr: envelopesInErr,
    grepProgressInJson: progressInJson,
    pass: envelopesInErr === 0 && progressInJson === 0 && jsonLines.length === 1 && parsed && parsed.v === 1,
  }
}

function measureSecret() {
  const child = spawn(BIN, ['contract-v1'], { stdio: ['pipe', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (c) => { stdout += c })
  child.stderr.on('data', (c) => { stderr += c })
  child.stdin.write(req('promptAnswers', {
    target: TMP, scripted: { target: TMP, stack: 'node', project: 'demo', suiteCommand: 'node', pluginsDir: '.' },
    answers: { deployToken: SECRET },
  }))
  const cmdline = fs.readFileSync(`/proc/${child.pid}/cmdline`, 'utf8')
  child.kill('SIGTERM')
  const done = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })))
  return done.then((status) => ({
    measured: true,
    cmdlineContainsSecret: cmdline.includes(SECRET),
    stdoutContainsSecret: stdout.includes(SECRET),
    stderrContainsSecret: stderr.includes(SECRET),
    signal: status.signal,
    exitCode: status.code,
    pass: !cmdline.includes(SECRET) && !stdout.includes(SECRET) && !stderr.includes(SECRET),
  }))
}

function measureGuard() {
  const script = '/tmp/opencode/adr004-guard-proof.sh'
  const r = run('bash', [script])
  const exits = (r.stdout.match(/exit=(\d+)/g) || []).map((s) => Number(s.slice(5)))
  return {
    exits,
    writePrimitivesCount: Number(r.stdout.match(/grep -cE stdout = \[(\d+)\]/)?.[1]),
    pass: r.status === 0 && JSON.stringify(exits) === '[0,1,1]',
    stdoutSha: `sha256:${sha(r.stdout)}`,
  }
}

function measureTranscript() {
  const buf = fs.readFileSync(TRANSCRIPT)
  const diff = run('diff', ['-u', TRANSCRIPT, path.join(WORKTREE, ARCHIVED_TRANSCRIPT_REL)])
  const text = buf.toString('utf8')
  return {
    bytes: buf.length, sha256: sha(buf),
    markers: MARKERS.filter((m) => text.includes(m)),
    oracleDiffEmpty: diff.status === 0,
    gitDiffEmpty: run('git', ['-C', ROOT, 'diff', '--exit-code', '--', ARCHIVED_TRANSCRIPT_REL]).status === 0,
    pass: buf.length === TRANSCRIPT_BYTES && sha(buf) === TRANSCRIPT_SHA && MARKERS.every((m) => text.includes(m)) && diff.status === 0,
  }
}

async function main() {
  if (!fs.existsSync(BIN)) throw new Error(`binário ausente: ${BIN}`)
  fs.rmSync(WORKTREE, { recursive: true, force: true })
  try { run('git', ['-C', ROOT, 'worktree', 'remove', '--force', WORKTREE]) } catch { /* não órfão */ }
  materializeOracle({ worktreeDir: WORKTREE })
  try {
    const literalSha = sha(fs.readFileSync(LITERAL, 'utf8'))
    const adr002 = JSON.parse(fs.readFileSync(REPORT_002, 'utf8'))
    const rito = {
      reused: literalSha === LITERAL_SHA && isLiteralProven(adr002, LITERAL_SHA),
      literalSha, expected: LITERAL_SHA,
      verdict: adr002.validationVerdict,
      note: 'rito ADR-002 reutilizado; nenhuma assinatura nova gravada por este agente',
    }
    const provas = OPS.map((op) => prova(op, BIN))
    const mutant = OPS.map((op) => prova(op, MUTANT_BIN))
    const mutantGuard = {
      ops: mutant.map((r) => ({ op: r.op, status: r.status, sideMatch: r.comparison && r.comparison.sideMatch })),
      reprovados: mutant.filter((r) => r.status === 'reprovado').length,
      pass: mutant.every((r) => r.status === 'reprovado'),
    }
    const guard = measureGuard()
    const channels = measureChannels()
    const transcript = measureTranscript()
    const secret = await measureSecret()
    const report = {
      version: 1, demand: 'prd-installer-rust-adr-004-val02', agent: 'developer-engineer',
      phase: 'Testing', oraculo: 'c63e333', shaFull: ORACLE_FULL,
      tasks: ['TUI-06', 'VAL-02'],
      gitSha: run('git', ['-C', ROOT, 'rev-parse', 'HEAD']).stdout.trim(),
      transcript, channels, secret, guard,
      provas: provas.map((p) => ({
        op: p.op, status: p.status, sideSha: p.sideSha, mutation: p.mutation,
        comparison: p.comparison, opDoEnvelope: p.opDoEnvelope, v: p.v, diff: p.diff,
      })),
      mutantGuard, rito,
      pass: provas.every((p) => p.status === 'ok') && mutantGuard.pass && guard.pass
        && channels.pass && secret.pass && transcript.pass && rito.reused,
    }
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
    if (!report.pass) process.exitCode = 1
  } finally {
    releaseOracle({ worktreeDir: WORKTREE })
  }
}

main().catch((e) => { process.stderr.write(String(e && e.stack ? e.stack : e) + '\n'); process.exitCode = 1 })
