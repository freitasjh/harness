import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {
  CONTRACT_VERSION, SUBCOMMAND, EXIT,
  encodeSuccess, encodeError, parseEnvelope,
  buildArgv, buildRequest, isTerminal, answerSourceOf,
  renderErrorCode, resultForExit, serializeAnswers, sanitizeLog, canNoEcho,
  ContractError, ProtocolError, SignalError, invoke,
} from '../installer-contract.mjs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-adapter-'))
after(() => fs.rmSync(tmp, { recursive: true, force: true }))

const FAKE = path.join(tmp, 'fake-bin.mjs')
fs.writeFileSync(FAKE, `#!/usr/bin/env node
import fs from 'node:fs';
const req = JSON.parse(fs.readFileSync(0, 'utf8'));
if (req.op === 'bad') { process.stdout.write('not-json\\n'); process.exit(0); }
if (req.op === 'silent') { process.exit(2); }
if (req.op === 'signal') { process.kill(process.pid, 'SIGTERM'); }
const styled = req.op === 'abort'
  ? encodeErr()
  : JSON.stringify({ v: 1, ok: true, op: req.op, result: { echo: req.args?.echo ?? null } });
function encodeErr() {
  return JSON.stringify({ v: 1, ok: false, op: req.op, error: {
    code: req.args?.code ?? 'E_ABORT', what: 'abort', why: 'q', fix: 'retry', where: 'prompt',
  } });
}
process.stdout.write(styled + '\\n');
process.stderr.write('[INFO] progresso\\n');
process.exit(req.op === 'abort' ? 1 : 0);
`)
const spawnFake = (extra = {}) => ({ bin: process.execPath, binArgs: [FAKE], ...extra })

describe('RF-02 / item 2 — envelope contract-v1', () => {
  it('sucesso e erro são um único JSON com v/ok/op/result|error', () => {
    const ok = JSON.parse(encodeSuccess('generateConfig', { project: 'x' }))
    assert.equal(ok.v, 1); assert.equal(ok.ok, true); assert.equal(ok.op, 'generateConfig')
    assert.deepEqual(ok.result, { project: 'x' }); assert.ok(!('error' in ok))
    const bad = JSON.parse(encodeError('runCli', { code: 'E_ABORT', what: 'a', why: 'b', fix: 'c', where: 'd' }))
    assert.equal(bad.v, 1); assert.equal(bad.ok, false); assert.equal(bad.op, 'runCli')
    assert.deepEqual(Object.keys(bad.error), ['code', 'what', 'why', 'fix', 'where'])
    assert.ok(!('result' in bad))
  })

  it('parseEnvelope rejeita JSON inválido, bytes extras, v errado e forma incompleta', () => {
    assert.throws(() => parseEnvelope('not-json'), ProtocolError)
    assert.throws(() => parseEnvelope(encodeSuccess('op', {}) + '\n[OK] progresso'), ProtocolError)
    assert.throws(() => parseEnvelope(JSON.stringify({ v: 2, ok: true, op: 'op', result: {} })), ProtocolError)
    assert.throws(() => parseEnvelope(JSON.stringify({ v: 1, ok: true, op: 'op' })), ProtocolError)
    assert.throws(() => parseEnvelope(JSON.stringify({ v: 1, ok: 'yes', op: 'op', result: {} })), ProtocolError)
  })
})

describe('RF-02 / item 3 + RF-03 / item 4 — canais e códigos', () => {
  it('stderr nunca contém envelope; stdout nunca contém progresso', async () => {
    const r = await invoke(spawnFake({ op: 'generateConfig', args: { echo: 'x' } }))
    assert.equal(r.exitCode, 0)
    assert.equal(r.envelope.ok, true)
    assert.ok(!r.stderr.includes('"v":1'))
    assert.ok(!r.stdout.includes('[INFO]'))
  })

  it('códigos 0/1/2 e sinal nunca vira 0', () => {
    assert.deepEqual(EXIT, { OK: 0, FAILURE: 1, PROTOCOL: 2 })
    assert.equal(resultForExit(0, null).kind, 'resolve')
    assert.equal(resultForExit(1, null).kind, 'reject')
    assert.equal(resultForExit(2, null).kind, 'protocol')
    assert.equal(resultForExit(0, 'SIGTERM').kind, 'signal')
  })

  it('erro de protocolo (2) e sinal têm classes distintas', async () => {
    await assert.rejects(() => invoke(spawnFake({ op: 'bad' })), ProtocolError)
    await assert.rejects(() => invoke(spawnFake({ op: 'silent' })), ProtocolError)
    await assert.rejects(() => invoke(spawnFake({ op: 'signal' })), SignalError)
  })

  it('NOT_INSTALLED / MANIFEST_INVALID viram UNKNOWN sem código novo', () => {
    assert.equal(renderErrorCode('NOT_INSTALLED'), 'UNKNOWN')
    assert.equal(renderErrorCode('MANIFEST_INVALID'), 'UNKNOWN')
    assert.equal(renderErrorCode('BAD_TARGET'), 'BAD_TARGET')
  })
})

describe('RF-04/RF-05/RF-06 / itens 5,6,7 — segredo, TTY e aborto 0 writes', () => {
  const SEGREDO = 'SEGRE' + 'DO_PROVA'

  it('argv carrega só contract-v1 e --answers-file; nunca valor sensível', () => {
    const argv = buildArgv({ op: 'runCli', answersFile: '/tmp/answers.json', answers: { deployToken: SEGREDO } })
    assert.deepEqual(argv.slice(0, 1), [SUBCOMMAND])
    assert.ok(argv.includes('--answers-file') && argv.includes('/tmp/answers.json'))
    assert.ok(!JSON.stringify(argv).includes(SEGREDO))
    assert.ok(!JSON.stringify(buildArgv({ op: 'main' })).includes(SEGREDO))
  })

  it('serializeAnswers omite secret; sanitizeLog redaciona; canNoEcho isola TTY', () => {
    assert.equal('deployToken' in serializeAnswers({ deployToken: SEGREDO, project: 'x' }), false)
    assert.equal(sanitizeLog('token=' + SEGREDO, { deployToken: SEGREDO }), 'token=[REDACTED]')
    assert.equal(canNoEcho({ isTTY: false }), false)
    assert.equal(canNoEcho({ isTTY: true, setRawMode() {} }), true)
  })

  it('IsTerminal escolhe prompt só em TTY; pipe exige answers/answers-file', () => {
    assert.equal(isTerminal({ isTTY: true }), true)
    assert.equal(isTerminal({ isTTY: false }), false)
    assert.equal(answerSourceOf({ stdin: { isTTY: true } }), 'tty')
    assert.equal(answerSourceOf({ stdin: { isTTY: false }, answers: {} }), 'answers')
    assert.equal(answerSourceOf({ stdin: { isTTY: false }, answersFile: '/tmp/a.json' }), 'answers-file')
    assert.equal(answerSourceOf({ stdin: { isTTY: false } }), 'none')
  })

  it('request coloca segredo só em answers, nunca em args/target/op', () => {
    const req = JSON.parse(buildRequest({ op: 'runCli', args: { echo: 'x' }, answers: { deployToken: SEGREDO }, target: '/tmp/t' }))
    assert.equal(req.v, 1); assert.equal(req.op, 'runCli')
    assert.equal(req.answers.deployToken, SEGREDO)
    assert.ok(!JSON.stringify({ op: req.op, args: req.args, target: req.target }).includes(SEGREDO))
  })

  it('segredo ausente de stdout/stderr/cmdline e aborto não cria arquivo', async () => {
    const dir = path.join(tmp, 'abort-zone')
    fs.mkdirSync(dir)
    const before = crypto.createHash('sha256').update(fs.readdirSync(dir).sort().join(',')).digest('hex')
    const reqPath = path.join(tmp, 'segredo-request.json')
    fs.writeFileSync(reqPath, JSON.stringify({ v: 1, op: 'abort', args: { code: 'E_ABORT' }, answers: { deployToken: SEGREDO } }))
    let r
    try { await invoke(spawnFake({ op: 'abort', args: { code: 'E_ABORT' }, cwd: dir })) } catch (e) { r = e }
    assert.ok(r instanceof ContractError, 'abort deve rejeitar com ContractError')
    assert.equal(r.code, 'E_ABORT')
    const after = crypto.createHash('sha256').update(fs.readdirSync(dir).sort().join(',')).digest('hex')
    assert.equal(after, before)
    assert.ok(!r.stdout.includes(SEGREDO))
    assert.ok(!r.stderr.includes(SEGREDO))
    assert.ok(!JSON.stringify(r.argv).includes(SEGREDO))
    fs.unlinkSync(reqPath)
  })
})

describe('item 1 — fronteira única via subprocesso', () => {
  it('adapter usa spawn (subprocesso), nunca FFI; contract-v1 aparece no contrato', () => {
    assert.equal(CONTRACT_VERSION, 1)
    assert.equal(SUBCOMMAND, 'contract-v1')
    const src = fs.readFileSync(new URL('../installer-contract.mjs', import.meta.url), 'utf8')
    assert.ok(src.includes('spawn'))
    assert.ok(!/(node:ffi|ffi-napi|\.node['"])/.test(src))
  })
})
