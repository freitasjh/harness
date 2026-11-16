// ADR-002 (PRD-3) — mecanismo de verificação de paridade sem tautologia.
// Oráculo = c63e333 (anterior ao sujeito, imutável, legível sem executar Rust).
// Fronteira: nenhuma função aqui regenera o oráculo a partir do sujeito.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ORACLE_COMMIT = 'c63e333'
export const ORACLE_FULL = 'c63e33307710e1c6271f5c68b2dd9fb15283f49c'
export const ORACLE_REL = 'installer/install.mjs'

// Literal escrito à mão: SHA do blob congelado do oráculo. Nunca derivado do sujeito.
// É este o literal submetido ao rito de validação humana (Veredito: validated literal).
export const ORACLE_BLOB_SHA256 = '17a704c37a018e1efd4fd7f4658d024c79e20cf874f73c5203a3a04ec3201a8d'
// Fixture sintética usada apenas nos testes de identidade (inyetada via expectedSha).
export const FIXTURE_SOURCE_SHA256 = '5d23de40fdedd658e5aa61fc6e51e4b3940a7e3a802dee255a0e998066c00d22'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function defaultRun(args, opts = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    cwd: opts.cwd || repoRoot,
  })
}

export function assertOracleIdentity({ source, provenance, expectedSha = ORACLE_BLOB_SHA256 }) {
  if (typeof source !== 'string' || source.length === 0) {
    throw new Error('oráculo c63e333: fail-closed — fonte vazia, sem fallback silencioso')
  }
  if (provenance !== `git-object:${ORACLE_COMMIT}`) {
    throw new Error(`oráculo c63e333: proveniência ${provenance} reprovada — oráculo derivado do sujeito não é oráculo`)
  }
  const digest = sha256(source)
  if (digest !== expectedSha) {
    throw new Error(`oráculo divergente: sha ${digest} != ${expectedSha} (regenerado a partir do sujeito)`)
  }
  return {
    sha256: digest,
    oraculo: ORACLE_COMMIT,
    provenance,
    iso8601: new Date().toISOString(),
  }
}

export function readOracleSource({ run = defaultRun, expectedSha = ORACLE_BLOB_SHA256 } = {}) {
  const source = run(['show', `${ORACLE_COMMIT}:${ORACLE_REL}`])
  return assertOracleIdentity({ source, provenance: `git-object:${ORACLE_COMMIT}`, expectedSha })
}

export function materializeOracle({ worktreeDir, run = defaultRun, commit = ORACLE_COMMIT }) {
  run(['worktree', 'add', '--detach', worktreeDir, commit])
  const sha = String(run(['rev-parse', 'HEAD'], { cwd: worktreeDir })).trim()
  if (sha !== ORACLE_FULL) {
    throw new Error(`oráculo c63e333: SHA ${sha} divergente do congelado ${ORACLE_FULL}`)
  }
  const status = String(run(['status', '--porcelain'], { cwd: worktreeDir })).trim()
  if (status !== '') {
    throw new Error(`oráculo c63e333: worktree sujo (${status}) — snapshot aceito cego não é prova`)
  }
  return { worktreeDir, sha, clean: true }
}

export function releaseOracle({ worktreeDir, run = defaultRun }) {
  run(['worktree', 'remove', '--force', worktreeDir])
  return { worktreeDir, released: true }
}

const RITUAL_RE = /^Veredito: validated literal ([0-9a-f]{64}) (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) (\S+)$/

export function ritualVerdict({ sha256: digest, iso8601, oraculo = ORACLE_COMMIT }) {
  return `Veredito: validated literal ${digest} ${iso8601} ${oraculo}`
}

export function parseRitual(text) {
  if (typeof text !== 'string') return null
  const m = RITUAL_RE.exec(text.trim())
  if (!m) return null
  return { sha256: m[1], iso8601: m[2], oraculo: m[3] }
}

export function isLiteralProven(report) {
  const parsed = parseRitual(report && report.validationVerdict)
  if (!parsed) return false
  return parsed.sha256 === ORACLE_BLOB_SHA256 && parsed.oraculo === ORACLE_COMMIT
}

export function si1_configByteEqual(subject, oracle) {
  const keys = Object.keys(oracle)
  const mismatches = keys.filter((k) => subject[k] !== oracle[k])
  const extra = Object.keys(subject).filter((k) => !keys.includes(k))
  return {
    id: 'SI-1',
    pass: mismatches.length === 0 && extra.length === 0,
    mismatches,
    extra,
  }
}

export function si2_payloadDifferential(subject, oracle) {
  const keys = Object.keys(oracle)
  const mismatches = keys.filter((k) => subject[k] !== oracle[k])
  const extra = Object.keys(subject).filter((k) => !keys.includes(k))
  return {
    id: 'SI-2',
    pass: mismatches.length === 0 && extra.length === 0,
    mismatches,
    extra,
  }
}

export function si3_dryRunZeroWrites({ beforeHash, afterHash, porcelain = '' }) {
  const pass = beforeHash === afterHash && String(porcelain).trim() === ''
  return { id: 'SI-3', pass, reason: pass ? null : 'writes detectados no destino do dry-run' }
}

export const TRANSCRIPT_MARKERS = Object.freeze([
  'W0 pre-flight',
  'W2m tipo de projeto',
  'W2m frontend',
  'W3',
  'W7',
])

export function si4_transcriptMarkers({ transcript, oracleTranscript, markers = TRANSCRIPT_MARKERS }) {
  const missing = markers.filter((m) => !String(transcript).includes(m))
  const byteEqual = transcript === oracleTranscript
  return { id: 'SI-4', pass: missing.length === 0 && byteEqual, missing, byteEqual }
}

export function si5_checksManifestParity(subject, oracle) {
  const a = JSON.stringify(subject)
  const b = JSON.stringify(oracle)
  return { id: 'SI-5', pass: a === b, reason: a === b ? null : 'campos/vereditos divergentes' }
}

function pathInGlob(name, pattern) {
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3)
    return name === prefix || name.startsWith(`${prefix}/`)
  }
  return name === pattern
}

export function si6_noNewKeys({ diffNames, protectedPaths: guards }) {
  const violations = diffNames.filter((n) => guards.some((g) => pathInGlob(n, g)))
  return { id: 'SI-6', pass: violations.length === 0, violations }
}

export function assertNoInstaAccept(text) {
  if (/\bcargo\s+insta\s+accept\b/.test(String(text))) {
    throw new Error('comando de aceitação cega do insta proibido — insta é só revisor de diff, nunca autoridade de baseline')
  }
  return true
}

export function snapNewFiles(root) {
  const found = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir)) {
      const p = path.join(dir, entry)
      const st = fs.lstatSync(p)
      if (st.isSymbolicLink()) continue
      if (st.isDirectory()) walk(p)
      else if (entry.endsWith('.snap.new')) found.push(p)
    }
  }
  if (fs.existsSync(root)) walk(root)
  return found
}

// 9 byte-equal + 2 parciais é medição; 12/12 é meta re-derivável, nunca fato publicado.
export const measurement = Object.freeze({
  byteEqual: 9,
  partial: 2,
  mobilePresetsDryRun: 2,
  claimed12of12: false,
  source: 'SPEC.md §4 / golden.spec.mjs:48 / PRD.md SI-1',
})

export function rederiveCommand() {
  return 'node --test "installer/__tests__/golden.spec.mjs" "installer/__tests__/eixos-stack.spec.mjs" 2>&1 | tail -8'
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--rederive-12')) {
    console.log(JSON.stringify({ measurement, command: rederiveCommand(), note: '12/12 é meta; execute o comando para re-derivar' }, null, 2))
  } else {
    console.log(JSON.stringify({ oraculo: ORACLE_COMMIT, full: ORACLE_FULL, blobSha256: ORACLE_BLOB_SHA256 }))
  }
}
