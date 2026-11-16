// Fronteira ADR-001/PRD-3 — adapter de subprocesso (contract-v1).
// Node é o chamador: monta o request, despacha por spawn, valida o envelope.
// Ponte de transição (ADR-003): os nomes de função/dado abaixo são re-exportados
// do oráculo congelado install.mjs até o binário Rust existir. Isto NÃO é um
// segundo motor — é a mesma implementação, atrás de um especificador estável.
// Nenhuma escrita, nenhum FFI, nenhum valor sensível em argv.

import { spawn } from 'node:child_process'
import { CONTRACT_VERSION, SUBCOMMAND, EXIT, OP_NAMES } from './contract-inventory.mjs'

// --- ponte de transição: registry de dados puro -------------------------------
export { AXIS_IDS, REGISTRY_ALL_DIGEST, REGISTRY_DATA, REGISTRY_MAPS, REGISTRY_MAP_DIGESTS, RULES_BY_AXIS, RULES_COMMON, SKILLS_BY_AXIS, SKILLS_COMMON, STACKS_FOR_EXCEPTIONS } from './contract-registry.mjs'

// --- ponte de transição: funções do oráculo (mesmo nome, mesmo tipo) ----------
export { DENYLIST, MANIFEST_NAME, MIN_NODE_VERSION, QUESTIONS, STACK_PROFILES, STACK_VALUES, VERSION, W2M_MARKER, WIZARD_MENU, InstallError, assertCreateOnly, assertDogfoodTarget, assertInside, axisIdsFromAxes, canNoEcho, configReferenceTargets, defaultSuiteFor, dryRunNotice, formatError, hasHarnessSection, isAbortToken, isScannablePath, normalizeSection, presetOfAxes, presetsOfAxes, profileOf, resolveAnswerSource, ruleAllowedForAxes, sanitizeLog, scanLiterals, serializeAnswers, skillAllowedForLocalAxes, stacksFor, stripAnsiControls, validateAnswer, validateRulesByAxis, validateSkillsByAxis, writtenPathsOf, applyMerge, backup, buildManifest, collectAnswers, collectIncoming, generateConfig, inventory, loadAnswersFile, main, mergeAgentFile, mergeOpencodeJson, parseArgs, planMerge, preflight, requireVerifiedBackup, resolveBackupDir, runChecks, runCli, runDoctor, runInit, runUpgrade, runWizard, writeManifest, askMenuStep, detect, printPlan, printUsage, promptAnswers, readSecretPrompt, readSecretRaw, sourceLineOf } from './install.mjs'

export { CONTRACT_VERSION, SUBCOMMAND, EXIT, OP_NAMES }

// ---------------------------------------------------------------------------
// envelope contract-v1
// ---------------------------------------------------------------------------
export function encodeSuccess(op, result) {
  return JSON.stringify({ v: 1, ok: true, op, result })
}

export function encodeError(op, error) {
  const e = error && typeof error === 'object' ? error : { what: String(error) }
  return JSON.stringify({
    v: 1,
    ok: false,
    op,
    error: { code: e.code, what: e.what, why: e.why, fix: e.fix, where: e.where },
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

export class ContractError extends Error {
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
