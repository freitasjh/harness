// TDD FIRST — quitação parcial D1-two-motors: 13 D-ENGINE no binário Rust.
// Anti-tautologia: o lado de referência é install.mjs do worktree DETACH c63e333
// executado pelo oracle-bridge (ORACLE_MJS), nunca o install.mjs do HEAD e nunca
// o binário sob teste. Comparação por canonicalJson + erro (code), com SHA cheio
// e status --porcelain vazios antes de cada comparação.
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { materializeOracle, releaseOracle, canonicalJson } from '../parity-oracle.mjs'
import {
  invokeSync, MIGRATED_ENGINE_OPS, ContractError, ProtocolError, InstallError,
} from '../installer-contract.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const BRIDGE = path.join(ROOT, 'installer-rs', 'tests', 'oracle-bridge.mjs')
const FIXTURES = path.join(ROOT, 'installer-rs', 'tests', 'req-fixtures.json')
const WORKTREE = '/tmp/opencode/harness-oracle-engine-c63e333'
const PROVA_TMP = '/tmp/opencode/harness-contract-engine'

const WRAPPERS = {
  preflight: (r) => [r.args],
  inventory: (r) => [r.args.target],
  backup: (r) => [r.target, r.args],
  resolveBackupDir: (r) => [r.args.target, r.args.backupRoot],
  loadAnswersFile: (r) => [r.args.path],
  collectIncoming: (r) => [r.args.sourceDir, { stacks: r.args.stacks, stack: r.args.stack }],
  applyMerge: (r) => [r.args.target, r.args.plan, { incomingFiles: r.args.incomingFiles, dryRun: r.args.dryRun }],
  buildManifest: (r) => [r.args],
  writeManifest: (r) => [r.args.target, r.args.manifest, { dryRun: r.args.dryRun }],
  requireVerifiedBackup: (r) => [r.args.backup],
  mergeOpencodeJson: (r) => [r.args.existing, r.args.incoming],
  mergeAgentFile: (r) => [r.args.existing, r.args.incomingSection],
  parseArgs: (r) => [r.args.argv],
}

let oracleUrl
let oracleIdentity
const fixtures = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'))

before(() => {
  oracleIdentity = materializeOracle({ worktreeDir: WORKTREE })
  oracleUrl = pathToFileURL(path.join(WORKTREE, 'installer', 'install.mjs')).href
  fs.mkdirSync(PROVA_TMP, { recursive: true })
})
after(() => releaseOracle({ worktreeDir: WORKTREE }))

function requestFor(op) {
  const text = JSON.stringify(fixtures[op])
    .replaceAll('{{REPO_ROOT}}', ROOT)
    .replaceAll('{{PROVA_TMP}}', PROVA_TMP)
  return JSON.parse(text)
}

function oracleEnvelope(req) {
  const r = spawnSync(process.execPath, [BRIDGE], {
    input: JSON.stringify(req) + '\n',
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, ORACLE_MJS: path.join(WORKTREE, 'installer', 'install.mjs') },
  })
  assert.equal(r.status, 0, 'oracle-bridge: ' + r.stderr)
  return JSON.parse(r.stdout.trim())
}

function side(env, op) {
  if (!env.ok) return { error: env.error && env.error.code }
  const v = env.result
  if (op === 'buildManifest' && v && typeof v === 'object') {
    const copy = { ...v }; delete copy.date; return { result: copy }
  }
  return { result: v }
}

describe('D-ENGINE local via motor Rust — differential contra c63e333', () => {
  it('identidade do oráculo e inventário de 13 ops migradas', () => {
    assert.equal(oracleIdentity.sha, 'c63e33307710e1c6271f5c68b2dd9fb15283f49c')
    assert.equal(oracleIdentity.clean, true)
    assert.deepEqual([...MIGRATED_ENGINE_OPS].sort(), Object.keys(WRAPPERS).sort())
  })

  for (const op of Object.keys(WRAPPERS)) {
    it(`${op}: wrapper síncrono === oráculo c63e333`, async () => {
      const req = requestFor(op)
      const oracle = oracleEnvelope(req)
      const mod = await import('../installer-contract.mjs')
      let value
      let subject
      try {
        value = mod[op](...WRAPPERS[op](req))
        assert.ok(!value || typeof value.then !== 'function', `${op} deve ser síncrono`)
        subject = { ok: true, result: value }
      } catch (e) {
        assert.ok(e instanceof ContractError, `${op} erro deve ser ContractError`)
        subject = { ok: false, error: e.error }
      }
      assert.equal(canonicalJson(side(subject, op)), canonicalJson(side(oracle, op)), `${op} differential`)
    })

    it(`${op}: invokeSync usa spawnSync e argv limpo`, () => {
      const req = requestFor(op)
      let r
      try {
        r = invokeSync({ op, args: req.args, answers: req.answers, target: req.target })
      } catch (e) {
        r = { argv: e.argv, stdout: e.stdout }
      }
      assert.ok(r && r.argv, 'spawnSync sempre devolve envelope ou meta')
      assert.deepEqual(r.argv.slice(1), ['contract-v1'])
      assert.ok(!JSON.stringify(r.argv).includes('SEGREDO'))
    })
  }

  it('erro de domínio => ContractError (também instanceof InstallError); protocolo => ProtocolError', () => {
    const fake = path.join(PROVA_TMP, 'fake-bin.mjs')
    fs.writeFileSync(fake, `#!/usr/bin/env node
import fs from 'node:fs';
const req = JSON.parse(fs.readFileSync(0,'utf8'));
if (req.op === 'proto') process.exit(2);
process.stdout.write(JSON.stringify({v:1,ok:false,op:req.op,error:{code:'BAD_TARGET',what:'x',why:'',fix:'',where:''}}));
process.exit(1);
`)
    fs.chmodSync(fake, 0o755)
    assert.throws(() => invokeSync({ bin: fake, op: 'preflight', args: {} }), (e) => e instanceof ContractError && e instanceof InstallError && e.code === 'BAD_TARGET')
    assert.throws(() => invokeSync({ bin: fake, op: 'proto', args: {} }), ProtocolError)
    assert.throws(() => invokeSync({ bin: '/nao/existe', op: 'preflight', args: {} }), ProtocolError)
  })
})
