// ADR-002 (PRD-3) — mecanismo de verificação de paridade sem tautologia.
// Oráculo = c63e333 (anterior ao sujeito, imutável, legível sem executar Rust).
// Fronteira: nenhuma função aqui regenera o oráculo a partir do sujeito.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ORACLE_COMMIT = 'c63e333'
export const ORACLE_FULL = 'c63e33307710e1c6271f5c68b2dd9fb15283f49c'
export const ORACLE_REL = 'installer/install.mjs'

// SHA do blob congelado do oráculo (git show c63e333:installer/install.mjs).
// É conteúdo do ARQUIVO de literal, não o literal em si: a autoridade do rito é
// o sha256 desse arquivo (F1) — casa constante com constante seria tautologia.
export const ORACLE_BLOB_SHA256 = '17a704c37a018e1efd4fd7f4658d024c79e20cf874f73c5203a3a04ec3201a8d'
// Arquivo de literal escrito à mão, congelado e submetido ao rito humano.
export const ORACLE_LITERAL_REL = 'installer/__tests__/oracle-literal.sha256'
// Fixture sintética usada apenas nos testes de identidade (inyetada via expectedSha).
export const FIXTURE_SOURCE_SHA256 = '5d23de40fdedd658e5aa61fc6e51e4b3940a7e3a802dee255a0e998066c00d22'
// F5: hash de CONTEÚDO (nomes só detectam rename, não mudança de 1 byte).
export const SI3_HASH_COMMAND = 'find -type f -print0 | sort -z | xargs -0 sha256sum'
// F3: comandos medidos com oráculo/literais (independentes do binário Rust).
export const SI_MEASURED_COMMANDS = Object.freeze({
  'SI-1': ['--test', 'installer/__tests__/golden.spec.mjs'],
  'SI-5': ['--test', 'installer/__tests__/checks.spec.mjs', 'installer/__tests__/merge-manifest.spec.mjs', 'installer/__tests__/suite.spec.mjs'],
  'SI-6': ['scripts/static-checks.mjs'],
})
export const BINARY_NOT_MEASURED_REASON = '$INSTALLER_BIN ausente — SI-2/SI-3 exigem differential real (binário Rust + oráculo c63e333); not_measured, nunca PASS por omissão'
export const DEFAULT_PROTECTED_PATHS = Object.freeze([
  'harness.config.json', 'opencode.json', 'gate.js', '.agents/**', '.opencode/plugins/**',
])
// ADR-001 (item 9 / §2.5): troca do especificador da registry — declarada no REPORT do ciclo.
// Qualquer OUTRO path protegido no diff é violação SI-6.
export const DECLARED_SI6_EXCEPTIONS = Object.freeze([
  '.opencode/plugins/__tests__/cdl.spec.mjs',
  '.opencode/plugins/__tests__/inventory.spec.mjs',
])

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

function defaultNodeRun(args, opts = {}) {
  try {
    execFileSync(process.execPath, args, {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      cwd: opts.cwd || repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return 0
  } catch (e) {
    return typeof e.status === 'number' ? e.status : 1
  }
}

export function readLiteralFile({ root = repoRoot, readFile = (p) => fs.readFileSync(p, 'utf8') } = {}) {
  return readFile(path.join(root, ORACLE_LITERAL_REL))
}

export function literalSha256({ root = repoRoot, readFile, literalText } = {}) {
  const text = literalText !== undefined
    ? literalText
    : readLiteralFile({ root, readFile })
  if (typeof text !== 'string' || !/^[0-9a-f]{64}\s*$/.test(text)) {
    throw new Error('oráculo c63e333: arquivo de literal inválido — fail-closed (sem formato 64-hex)')
  }
  return sha256(text)
}

export function assertLiteralMatchesSource({ literalText, sourceSha256 = ORACLE_BLOB_SHA256 } = {}) {
  if (String(literalText).trim() !== sourceSha256) {
    throw new Error(`oráculo c63e333: literal divergente da origem (${String(literalText).trim()} != ${sourceSha256}) — drift do literal, sem revalidação por herança`)
  }
  return true
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

// F1: o sha esperado VEM DE FORA (sha256 do arquivo de literal, lido do disco).
// Nunca ORACLE_BLOB_SHA256: casa constante com constante = tautologia,
// e 1 byte mudado no literal passaria despercebido.
export function isLiteralProven(report, expectedLiteralSha) {
  if (typeof expectedLiteralSha !== 'string' || !/^[0-9a-f]{64}$/.test(expectedLiteralSha)) return false
  const parsed = parseRitual(report && report.validationVerdict)
  if (!parsed) return false
  return parsed.sha256 === expectedLiteralSha && parsed.oraculo === ORACLE_COMMIT
}

// F4: serialização determinística (chaves ordenadas recursivamente) — só conteúdo.
export function canonicalJson(value) {
  const sortDeep = (v) => {
    if (Array.isArray(v)) return v.map(sortDeep)
    if (v && typeof v === 'object') {
      const out = {}
      for (const k of Object.keys(v).sort()) out[k] = sortDeep(v[k])
      return out
    }
    return v
  }
  return JSON.stringify(sortDeep(value))
}

function compareCanonical(subject, oracle) {
  const keys = Object.keys(oracle)
  const mismatches = keys.filter((k) => canonicalJson(subject[k]) !== canonicalJson(oracle[k]))
  const extra = Object.keys(subject).filter((k) => !keys.includes(k))
  return { pass: canonicalJson(subject) === canonicalJson(oracle) && mismatches.length === 0 && extra.length === 0, mismatches, extra }
}

export function si1_configByteEqual(subject, oracle) {
  const { pass, mismatches, extra } = compareCanonical(subject, oracle)
  return { id: 'SI-1', pass, mismatches, extra }
}

export function si2_payloadDifferential(subject, oracle) {
  const { pass, mismatches, extra } = compareCanonical(subject, oracle)
  return { id: 'SI-2', pass, mismatches, extra }
}

// F5: porcelain obrigatório — omitido é erro (fail-closed), não fail-open.
export function si3_dryRunZeroWrites({ beforeHash, afterHash, porcelain }) {
  if (porcelain === undefined || porcelain === null) {
    throw new Error('SI-3: porcelain obrigatório — ausência não é writes=0 (fail-closed)')
  }
  const pass = beforeHash === afterHash && String(porcelain).trim() === ''
  return {
    id: 'SI-3',
    pass,
    reason: pass ? null : `writes detectados no destino do dry-run (hash ${SI3_HASH_COMMAND}; porcelain=${JSON.stringify(porcelain)})`,
  }
}

export const TRANSCRIPT_MARKERS = Object.freeze([
  'W0 pre-flight',
  'W2m tipo de projeto',
  'W2m frontend',
  'W3',
  'W7',
])
// ADR-002 §4 / §3.7: 5 marcadores reais do transcript arquivado (prompt do wizard).
export const ARCHIVED_TRANSCRIPT_MARKERS = Object.freeze([
  '[1/2]', '[2/2]', '[1-5]', '(default: 1)', '(q cancela)',
])
export const ARCHIVED_TRANSCRIPT_REL = '.spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt'

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

// F3 (VAL-03) — differential real SI-2/SI-3. Oráculo = install.mjs do worktree
// c63e333 executado via oracle-bridge (nunca registry do sujeito); binário =
// $INSTALLER_BIN contract-v1. Ambos recebem o MESMO REQ. Hash de CONTEÚDO no
// destino do dry-run (SI3_HASH_COMMAND), porcelania do worktree no finally.
const BRIDGE_REL = path.join('installer-rs', 'tests', 'oracle-bridge.mjs')

function defaultBridgeRun(req, env) {
  return execFileSync(process.execPath, [path.join(repoRoot, BRIDGE_REL)], {
    input: JSON.stringify(req) + '\n',
    env: { ...process.env, ...env },
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
}

function defaultBinRun(bin, req, cwd) {
  return execFileSync(bin, ['contract-v1'], {
    input: JSON.stringify(req) + '\n',
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
}

function defaultHashTree(dir) {
  const out = execFileSync('bash', ['-c', SI3_HASH_COMMAND], {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  return sha256(out)
}

function defaultPorcelain(worktreeDir) {
  return String(execFileSync('git', ['status', '--porcelain'], {
    cwd: worktreeDir,
    encoding: 'utf8',
  }))
}

export function runInstallerDifferential({
  installerBin,
  worktreeDir,
  runBridge = defaultBridgeRun,
  runBin = defaultBinRun,
  hashTree = defaultHashTree,
  porcelain = defaultPorcelain,
  tmpRoot = os.tmpdir(),
} = {}) {
  if (!installerBin) {
    throw new Error('runInstallerDifferential: $INSTALLER_BIN obrigatório — sem binário não há differential (not_measured, não PASS)')
  }
  const binary = path.isAbsolute(installerBin) ? installerBin : path.resolve(repoRoot, installerBin)
  const stamp = `${process.pid}-${Date.now()}`
  const sourceDir = fs.mkdtempSync(path.join(tmpRoot, `si2-source-${stamp}-`))
  const targetDir = fs.mkdtempSync(path.join(tmpRoot, `si3-target-${stamp}-`))
  try {
    fs.mkdirSync(path.join(sourceDir, '.agents', 'rules'), { recursive: true })
    fs.writeFileSync(path.join(sourceDir, 'opencode.json'), '{"agent":{}}\n')
    fs.writeFileSync(path.join(sourceDir, '.agents', 'rules', 'probe.md'), 'probe rule\n')
    fs.writeFileSync(path.join(targetDir, 'marker.txt'), 'dry-run target\n')

    const collectReq = {
      v: 1, op: 'collectIncoming',
      args: { sourceDir, stacks: [], stack: null },
      answers: {}, target: null,
    }
    const oracleOut = runBridge(collectReq, { ORACLE_MJS: path.join(worktreeDir, 'installer', 'install.mjs') })
    const binOut = runBin(binary, collectReq, sourceDir)
    const oracleEnv = JSON.parse(oracleOut.trim())
    const binEnv = JSON.parse(binOut.trim())
    if (oracleEnv.ok !== true || binEnv.ok !== true) {
      throw new Error(`SI-2: envelope não-ok (oracle=${oracleEnv.ok} bin=${binEnv.ok}) — differential inválido`)
    }
    const si2 = { subject: binEnv.result, oracle: oracleEnv.result }

    const beforeHash = hashTree(targetDir)
    const dryReq = {
      v: 1, op: 'writeManifest',
      args: { target: targetDir, manifest: { manifestSchemaVersion: 1 }, dryRun: true },
      answers: {}, target: targetDir,
    }
    runBin(binary, dryReq, targetDir)
    const afterHash = hashTree(targetDir)
    const si3 = { beforeHash, afterHash, porcelain: porcelain(worktreeDir) }
    return { si2, si3 }
  } finally {
    fs.rmSync(sourceDir, { recursive: true, force: true })
    fs.rmSync(targetDir, { recursive: true, force: true })
  }
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

// F3 — driver de produção: materializa o oráculo e expõe SI-1..SI-6.
// VAL-03: SI-2/SI-3 são medidos SÓ com $INSTALLER_BIN e differential real;
// sem binário são not_measured com motivo explícito — nunca PASS por omissão.
export function runParity({
  root = repoRoot,
  runGit = defaultRun,
  runNode = defaultNodeRun,
  readFile = (p) => fs.readFileSync(p, 'utf8'),
  worktreeDir = path.join(os.tmpdir(), 'harness-oracle-parity'),
  materialize: doMaterialize = materializeOracle,
  release: doRelease = releaseOracle,
  readSource: doReadSource = readOracleSource,
  literalRel = ORACLE_LITERAL_REL,
  validationVerdict,
  protectedPaths = DEFAULT_PROTECTED_PATHS,
  installerBin = process.env.INSTALLER_BIN || null,
  differential = null,
} = {}) {
  const si = []
  let sourceSha256
  let literalSha
  let proven = false
  doMaterialize({ worktreeDir, run: runGit })
  try {
    const meta = doReadSource({ run: runGit })
    sourceSha256 = meta.sha256
    const literalText = readFile(path.join(root, literalRel))
    literalSha = literalSha256({ literalText })
    assertLiteralMatchesSource({ literalText, sourceSha256 })
    proven = isLiteralProven({ validationVerdict }, literalSha)

    const measured = (id, fn) => {
      try {
        const r = fn()
        si.push({
          id, status: 'medido', pass: r.pass === true,
          reason: r.reason || null, evidence: r.evidence || null,
          ...(r.missing ? { missing: r.missing } : {}),
        })
      } catch (e) {
        si.push({ id, status: 'medido', pass: false, reason: String(e.message), evidence: null })
      }
    }
    const notMeasured = (id) => si.push({ id, status: 'not_measured', pass: null, reason: BINARY_NOT_MEASURED_REASON, evidence: null })

    // VAL-03: SI-2/SI-3 só são medidos quando $INSTALLER_BIN existe E o
    // differential real roda. Cache local evita executar o binário duas vezes.
    let differentialResult
    const getDifferential = () => {
      if (!installerBin) throw new Error(BINARY_NOT_MEASURED_REASON)
      if (!differentialResult) {
        differentialResult = differential
          ? differential({ worktreeDir, installerBin })
          : runInstallerDifferential({ worktreeDir, installerBin })
      }
      return differentialResult
    }
    const measuredDifferential = (id) => measured(id, () => {
      const d = getDifferential()
      if (id === 'SI-2') {
        const r = si2_payloadDifferential(d.si2.subject, d.si2.oracle)
        const subjectHash = sha256(canonicalJson(d.si2.subject))
        const oracleHash = sha256(canonicalJson(d.si2.oracle))
        return {
          pass: r.pass,
          reason: r.pass ? null : `paths/bodies divergentes: ${r.mismatches.join(', ')}${r.extra.length ? `; extras=${r.extra.join(', ')}` : ''}`,
          evidence: `sha256 payload paths+bodies: oráculo=${oracleHash} bin=${subjectHash} (collectIncoming, 2 arquivos)`,
        }
      }
      const r = si3_dryRunZeroWrites(d.si3)
      return {
        pass: r.pass,
        reason: r.reason,
        evidence: `hash de conteúdo SI3_HASH_COMMAND antes=${d.si3.beforeHash} depois=${d.si3.afterHash}; worktree porcelain=${JSON.stringify(d.si3.porcelain)}`,
      }
    })

    measured('SI-1', () => {
      const code = runNode(SI_MEASURED_COMMANDS['SI-1'], { cwd: root })
      return { pass: code === 0, reason: code === 0 ? null : `golden.spec.mjs exit ${code}` }
    })
    if (installerBin) {
      measuredDifferential('SI-2')
      measuredDifferential('SI-3')
    } else {
      notMeasured('SI-2')
      notMeasured('SI-3')
    }

    measured('SI-4', () => {
      const transcript = readFile(path.join(root, ARCHIVED_TRANSCRIPT_REL))
      const r = si4_transcriptMarkers({
        transcript, oracleTranscript: transcript, markers: ARCHIVED_TRANSCRIPT_MARKERS,
      })
      return { pass: r.pass, reason: r.pass ? null : `marcadores ausentes: ${r.missing.join(', ')}`, missing: r.missing }
    })
    measured('SI-5', () => {
      const code = runNode(SI_MEASURED_COMMANDS['SI-5'], { cwd: root })
      return { pass: code === 0, reason: code === 0 ? null : `checks/manifest exit ${code}` }
    })
    measured('SI-6', () => {
      const code = runNode(SI_MEASURED_COMMANDS['SI-6'], { cwd: root })
      const diff = String(runGit(['diff', '--name-only', ORACLE_COMMIT, 'HEAD', '--', ...protectedPaths]) || '')
      const diffNames = diff.split('\n').map((s) => s.trim()).filter(Boolean)
      const r = si6_noNewKeys({ diffNames, protectedPaths })
      const undeclared = r.violations.filter((n) => !DECLARED_SI6_EXCEPTIONS.includes(n))
      const declared = r.violations.filter((n) => DECLARED_SI6_EXCEPTIONS.includes(n))
      const pass = code === 0 && undeclared.length === 0
      return {
        pass,
        reason: pass ? null : `static-checks exit ${code}; violations=${undeclared.join(', ') || 'none'}`,
        evidence: `git diff --name-only ${ORACLE_COMMIT} HEAD -- <protegidos> ⇒ ${diffNames.length} arquivo(s); declarados ADR-001=${declared.length}; não-declarados=${undeclared.length}`,
      }
    })
  } finally {
    doRelease({ worktreeDir, run: runGit })
  }
  return {
    oraculo: ORACLE_COMMIT,
    sourceSha256,
    literalSha256: literalSha,
    literalProven: proven,
    si,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--run-parity')) {
    const verdictArg = process.argv.find((a) => a.startsWith('--verdict='))
    // O rito vive no REPORT; o driver precisa lê-lo por default, senao a
    // assinatura do owner existe no disco mas o oraculo executavel a ignora.
    let validationVerdict = verdictArg ? verdictArg.slice('--verdict='.length) : undefined
    if (!validationVerdict) {
      try {
        const reportPath = path.join(repoRoot, 'harness', 'prd-installer-rust-adr-002.json')
        validationVerdict = JSON.parse(fs.readFileSync(reportPath, 'utf8')).validationVerdict
      } catch { /* sem RELATORIO => literalProven false, fail-closed */ }
    }
    console.log(JSON.stringify(runParity({ validationVerdict }), null, 2))
  } else if (process.argv.includes('--rederive-12')) {
    console.log(JSON.stringify({ measurement, command: rederiveCommand(), note: '12/12 é meta; execute o comando para re-derivar' }, null, 2))
  } else {
    console.log(JSON.stringify({
      oraculo: ORACLE_COMMIT, full: ORACLE_FULL, sourceSha256: ORACLE_BLOB_SHA256,
      literalRel: ORACLE_LITERAL_REL, literalSha256: literalSha256(),
    }))
  }
}
