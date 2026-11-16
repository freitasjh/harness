// Fronteira ADR-001/PRD-3 — adapter de subprocesso (contract-v1).
// Node é o chamador: monta o request, despacha por spawn/spawnSync, valida envelope.
// Quitação PARCIAL da ponte D1-two-motors (2026-11-16): 9 D-DATA vêm da registry,
// 29 D-PURE do módulo local byte-fiel a c63e333, 13 D-ENGINE rodam no binário
// Rust por subprocesso síncrono. ADR-004/TUI-06 quita os 8 D-TUI: saem do
// reexport vivo de install.mjs e viram módulo local byte-fiel (`contract-tui.mjs`)
// com 8 `op`s 1:1 no dispatcher Rust. Restam 10 D-ENGINE em dívida de
// byte-paridade (FU-D1-ENGINE10 — decisão owner pendente).
// Nenhuma escrita pelo adapter, nenhum FFI, nenhum valor sensível em argv.

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONTRACT_VERSION, SUBCOMMAND, EXIT, OP_NAMES } from './contract-inventory.mjs'
import { sanitizeLog, InstallError as PureInstallError } from './contract-pure.mjs'

// Superfície única de InstallError: erros do módulo puro local e erros do módulo
// vivo (dívida declarada abaixo) precisam satisfazer o MESMO `instanceof` nos
// specs congelados. Nenhuma função é reexportada sob outro nome por aqui.
export class InstallError extends PureInstallError {
  static [Symbol.hasInstance](value) {
    return Boolean(value) && (value.name === 'InstallError' || value instanceof PureInstallError)
  }
}

// --- D-INJ + 9 D-DATA: registry congelado ------------------------------------
export {
  AXIS_IDS, REGISTRY_ALL_DIGEST, REGISTRY_DATA, REGISTRY_MAPS, REGISTRY_MAP_DIGESTS,
  RULES_BY_AXIS, RULES_COMMON, SKILLS_BY_AXIS, SKILLS_COMMON, STACKS_FOR_EXCEPTIONS,
  DENYLIST, MANIFEST_NAME, MIN_NODE_VERSION, QUESTIONS, STACK_PROFILES, STACK_VALUES,
  VERSION, W2M_MARKER, WIZARD_MENU,
} from './contract-registry.mjs'

// --- 29 D-PURE: módulo local byte-fiel a c63e333 ------------------------------
export {
  assertCreateOnly, assertDogfoodTarget, assertInside, axisIdsFromAxes, canNoEcho,
  configReferenceTargets, defaultSuiteFor, dryRunNotice, formatError, hasHarnessSection,
  isAbortToken, isScannablePath, normalizeSection, presetOfAxes, presetsOfAxes,
  profileOf, resolveAnswerSource, ruleAllowedForAxes, scanLiterals, serializeAnswers,
  skillAllowedForLocalAxes, stacksFor, stripAnsiControls, validateAnswer,
  validateRulesByAxis, validateSkillsByAxis, writtenPathsOf,
} from './contract-pure.mjs'
export { sanitizeLog } from './contract-pure.mjs'

// --- DÍVIDA DECLARADA (D1-two-motors-restante): 10 D-ENGINE ------------------
// runCli, runDoctor, runInit, runUpgrade, runWizard (streams + callbacks de
// `apply` + marcadores de tela que o Rust não emite) e collectAnswers,
// generateConfig, planMerge, runChecks, main divergem em ordem de chaves de
// JSON.stringify ou no bloco 4-linhas — specs comparam byte a byte.
// Os outros 13 D-ENGINE rodam no binário Rust. Os 8 D-TUI saíram da ponte
// (ADR-004): são módulo local + 8 `op`s no dispatcher Rust.
// Ponte de 10 nomes, datada 2026-11-16 — dívida explícita (FU-D1-ENGINE10).
import {
  runCli, runDoctor, runInit, runUpgrade, runWizard,
  collectAnswers, generateConfig, planMerge, runChecks, main,
} from './install.mjs'
export {
  runCli, runDoctor, runInit, runUpgrade, runWizard,
  collectAnswers, generateConfig, planMerge, runChecks, main,
}

// --- 8 D-TUI quitadas (ADR-004): módulo local byte-fiel, NÃO reexport vivo ---
export {
  askMenuStep, detect, printPlan, printUsage, promptAnswers,
  readSecretPrompt, readSecretRaw, sourceLineOf,
  menuChoices, menuItemLine, pubspecDeclaresFlutter,
} from './contract-tui.mjs'

export { CONTRACT_VERSION, SUBCOMMAND, EXIT, OP_NAMES }

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_BIN = path.join(REPO_ROOT, 'installer-rs', 'target', 'debug', 'harness-installer')

export function installerBin() {
  return process.env.INSTALLER_BIN || DEFAULT_BIN
}

// ---------------------------------------------------------------------------
// envelope contract-v1
// ---------------------------------------------------------------------------
export function encodeSuccess(op, result) {
  return JSON.stringify({ v: 1, ok: true, op, result })
}

export function encodeError(op, error, answers = {}) {
  const e = error && typeof error === 'object' ? error : { what: String(error) }
  const ctx = answers && typeof answers === 'object'
    ? answers
    : (e.answers && typeof e.answers === 'object' ? e.answers : {})
  const clean = (v) => sanitizeLog(v === undefined || v === null ? '' : String(v), ctx)
  return JSON.stringify({
    v: 1,
    ok: false,
    op,
    error: {
      code: clean(e.code),
      what: clean(e.what),
      why: clean(e.why),
      fix: clean(e.fix),
      where: clean(e.where),
    },
  })
}

export class ProtocolError extends Error {
  constructor(message, meta = {}) {
    super(message)
    this.name = 'ProtocolError'
    this.code = 'PROTOCOL'
    Object.assign(this, meta)
  }
}

export class ContractError extends InstallError {
  constructor(error, meta = {}) {
    super(error && error.what ? error.what : 'contract error')
    this.name = 'ContractError'
    this.code = error && error.code
    this.error = error
    Object.assign(this, meta)
  }
}

export class SignalError extends Error {
  constructor(signal, meta = {}) {
    super('processo terminado por sinal: ' + signal)
    this.name = 'SignalError'
    this.signal = signal
    Object.assign(this, meta)
  }
}

export function parseEnvelope(text) {
  if (typeof text !== 'string' || text.trim() === '') throw new ProtocolError('envelope ausente')
  let env
  try { env = JSON.parse(text) } catch { throw new ProtocolError('envelope não é JSON válido') }
  if (!env || typeof env !== 'object' || Array.isArray(env)) throw new ProtocolError('envelope não é objeto')
  if (env.v !== 1) throw new ProtocolError('v desconhecido: ' + String(env.v))
  if (typeof env.ok !== 'boolean') throw new ProtocolError('ok não booleano')
  if (typeof env.op !== 'string') throw new ProtocolError('op ausente')
  if (env.ok) {
    if (!('result' in env) || 'error' in env) throw new ProtocolError('envelope ok sem result exclusivo')
  } else {
    if (!('error' in env) || 'result' in env) throw new ProtocolError('envelope erro sem error exclusivo')
    const e = env.error
    if (!e || typeof e !== 'object') throw new ProtocolError('bloco error inválido')
    for (const k of ['code', 'what', 'why', 'fix', 'where']) {
      if (!(k in e)) throw new ProtocolError('bloco error incompleto: ' + k)
    }
  }
  return env
}

// NOT_INSTALLED / MANIFEST_INVALID são códigos do oráculo (E2): renderizam
// UNKNOWN sem introduzir código novo no vocabulário.
export function renderErrorCode(code) {
  return code === 'NOT_INSTALLED' || code === 'MANIFEST_INVALID' ? 'UNKNOWN' : code
}

export function resultForExit(code, signal = null) {
  if (signal) return { kind: 'signal', signal }
  if (code === EXIT.OK) return { kind: 'resolve' }
  if (code === EXIT.FAILURE) return { kind: 'reject' }
  return { kind: 'protocol' }
}

// ---------------------------------------------------------------------------
// canais / segredo — valor sensível NUNCA entra em argv
// ---------------------------------------------------------------------------
export function buildArgv({ op, answersFile = null } = {}) {
  return answersFile ? [SUBCOMMAND, '--answers-file', answersFile] : [SUBCOMMAND]
}

export function buildRequest({ op, args = {}, answers = {}, target = null } = {}) {
  const request = { v: 1, op, args, answers }
  if (target) request.target = target
  return JSON.stringify(request)
}

export function isTerminal(stream) {
  return Boolean(stream && stream.isTTY)
}

export function answerSourceOf({ stdin, answers, answersFile } = {}) {
  if (isTerminal(stdin)) return 'tty'
  if (answersFile) return 'answers-file'
  if (answers) return 'answers'
  return 'none'
}

// ---------------------------------------------------------------------------
// despacho por subprocesso — sem FFI, sem escrita pelo adapter
// ---------------------------------------------------------------------------
export function invoke({
  bin,
  binArgs = [],
  op,
  args = {},
  answers = {},
  answersFile = null,
  target = null,
  cwd,
  env,
} = {}) {
  if (!bin) return Promise.reject(new ProtocolError('bin ausente'))
  const argv = [...binArgs, ...buildArgv({ op, answersFile })]
  const request = buildRequest({ op, args, answers, target })
  return new Promise((resolve, reject) => {
    const child = spawn(bin, argv, { stdio: ['pipe', 'pipe', 'pipe'], cwd, env })
    let stdout = ''
    let stderr = ''
    let spawnError = null
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (c) => { stdout += c })
    child.stderr.on('data', (c) => { stderr += c })
    child.on('error', (e) => { spawnError = e })
    child.on('close', (code, signal) => {
      const meta = { stdout, stderr, argv, exitCode: code, signal }
      if (spawnError) return reject(new ProtocolError('spawn falhou: ' + spawnError.message, meta))
      if (signal) return reject(new SignalError(signal, meta))
      if (code === EXIT.PROTOCOL) return reject(new ProtocolError('erro de protocolo do contrato', meta))
      let envParsed
      try { envParsed = parseEnvelope(stdout) } catch (e) { return reject(new ProtocolError(e.message, meta)) }
      if (envParsed.op !== op) return reject(new ProtocolError('op do envelope divergente', meta))
      if (!envParsed.ok) {
        if (code !== EXIT.FAILURE) return reject(new ProtocolError('exit/envelope divergentes', meta))
        return reject(new ContractError(envParsed.error, meta))
      }
      if (code !== EXIT.OK) return reject(new ProtocolError('exit/envelope divergentes', meta))
      return resolve({ ok: true, op: envParsed.op, envelope: envParsed, result: envParsed.result, stdout, stderr, exitCode: code, argv })
    })
    child.stdin.setEncoding('utf8')
    child.stdin.end(request + '\n')
  })
}

// ---------------------------------------------------------------------------
// motor Rust — chamada SÍNCRONA (contract-v1) para os D-ENGINE serializáveis.
// Mesma semântica de `invoke()` (linhas 165-179), com spawnSync em vez de spawn.
// Nenhum valor sensível em argv: request vai por stdin; stdout = envelope.
// ---------------------------------------------------------------------------
export function invokeSync({ bin, op, args = {}, answers = {}, target = null, env } = {}) {
  const resolvedBin = bin || installerBin()
  if (!resolvedBin) throw new ProtocolError('bin ausente')
  if (!fs.existsSync(resolvedBin)) throw new ProtocolError('bin ausente: ' + resolvedBin)
  const request = buildRequest({ op, args, answers, target })
  const result = spawnSync(resolvedBin, [SUBCOMMAND], {
    input: request + '\n',
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env,
  })
  const meta = {
    stdout: result.stdout || '', stderr: result.stderr || '',
    argv: [resolvedBin, SUBCOMMAND], exitCode: result.status, signal: result.signal,
  }
  if (result.error) throw new ProtocolError('spawn falhou: ' + result.error.message, meta)
  if (result.signal) throw new SignalError(result.signal, meta)
  if (result.status === EXIT.PROTOCOL) throw new ProtocolError('erro de protocolo do contrato', meta)
  let envParsed
  try { envParsed = parseEnvelope(meta.stdout) } catch (e) { throw new ProtocolError(e.message, meta) }
  if (envParsed.op !== op) throw new ProtocolError('op do envelope divergente', meta)
  if (!envParsed.ok) {
    if (result.status !== EXIT.FAILURE) throw new ProtocolError('exit/envelope divergentes', meta)
    throw new ContractError(envParsed.error, meta)
  }
  if (result.status !== EXIT.OK) throw new ProtocolError('exit/envelope divergentes', meta)
  return { ok: true, op: envParsed.op, envelope: envParsed, result: envParsed.result, ...meta }
}

// Adapta a assinatura pública (congelada nos specs) ao formato do request
// contract-v1. Espelha 1:1 o oracle-bridge de prova (installer-rs/tests).
const ENGINE_ADAPTERS = Object.freeze({
  preflight: (a) => ({ args: a[0] ?? {} }),
  inventory: (a) => ({ args: { target: a[0] } }),
  backup: (a) => ({ target: a[0], args: { ...(a[1] ?? {}), target: a[0] } }),
  resolveBackupDir: (a) => ({ args: { target: a[0], backupRoot: a[1] } }),
  loadAnswersFile: (a) => ({ args: { path: a[0] } }),
  collectIncoming: (a) => ({ args: { sourceDir: a[0], stacks: a[1]?.stacks ?? [], stack: a[1]?.stack ?? null } }),
  applyMerge: (a) => ({ args: { target: a[0], plan: a[1] ?? [], incomingFiles: a[2]?.incomingFiles ?? {}, dryRun: a[2]?.dryRun } }),
  buildManifest: (a) => ({ args: a[0] ?? {} }),
  writeManifest: (a) => ({ args: { target: a[0], manifest: a[1] ?? {}, dryRun: a[2]?.dryRun } }),
  requireVerifiedBackup: (a) => ({ args: { backup: a[0] } }),
  mergeOpencodeJson: (a) => ({ args: { existing: a[0] ?? {}, incoming: a[1] ?? {} } }),
  mergeAgentFile: (a) => ({ args: { existing: a[0] ?? '', incomingSection: a[1] ?? '' } }),
  parseArgs: (a) => ({ args: { argv: a[0] ?? [] } }),
})

export const MIGRATED_ENGINE_OPS = Object.freeze(Object.keys(ENGINE_ADAPTERS))

function engineCall(op, positional) {
  const adapter = ENGINE_ADAPTERS[op]
  if (!adapter) throw new ProtocolError('op sem adapter de motor: ' + op)
  return invokeSync({ op, ...adapter(positional) }).result
}

export function preflight(...a) { return engineCall('preflight', a) }
export function inventory(...a) { return engineCall('inventory', a) }
export function backup(...a) { return engineCall('backup', a) }
export function resolveBackupDir(...a) { return engineCall('resolveBackupDir', a) }
export function loadAnswersFile(...a) { return engineCall('loadAnswersFile', a) }
export function collectIncoming(...a) { return engineCall('collectIncoming', a) }
export function applyMerge(...a) { return engineCall('applyMerge', a) }
export function buildManifest(...a) { return engineCall('buildManifest', a) }
export function writeManifest(...a) { return engineCall('writeManifest', a) }
export function requireVerifiedBackup(...a) { return engineCall('requireVerifiedBackup', a) }
export function mergeOpencodeJson(...a) { return engineCall('mergeOpencodeJson', a) }
export function mergeAgentFile(...a) { return engineCall('mergeAgentFile', a) }
export function parseArgs(...a) { return engineCall('parseArgs', a) }
