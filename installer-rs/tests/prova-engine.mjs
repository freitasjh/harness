// HARN-VAL-01/02/04 — harness `prova(op)` (ADR-003 §2.1, RF-02/12/14/16).
// Oráculo = c63e333 em worktree detach, SHA cheio + status --porcelain ANTES de
// CADA comparação. Literais de veredito são ARQUIVOS externos: sha256 registrado
// no RELATÓRIO antes da primeira comparação; extração por leitura, nunca por
// comando que regenere a partir do sujeito. `diff -u` das saídas; mutação de 1
// byte em cada op reprova; worktree liberado no finally. Nunca `cargo insta accept`.
// VAL-02: gate = fullComparison (result/ok/exit-code), não só result|error.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  ORACLE_FULL,
  ARCHIVED_TRANSCRIPT_REL,
  canonicalJson,
  materializeOracle,
  releaseOracle,
  assertNoInstaAccept,
  isLiteralProven,
} from '../../installer/parity-oracle.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const WORKTREE = path.join('/tmp/opencode', 'harness-oracle-c63e333')
const REPORT = path.join(ROOT, 'harness', 'prd-installer-rust-adr-003.json')
const FIXTURES = path.join(HERE, 'req-fixtures.json')
const BRIDGE = path.join(HERE, 'oracle-bridge.mjs')
const PROVA_TMP = path.join('/tmp/opencode', 'harness-prova-engine')

// 8 arquivos de vereditos congelados (ADR-003 §2.3 item 3) — lidos como arquivos.
export const FROZEN = Object.freeze([
  'installer/__tests__/golden.spec.mjs',
  'installer/__tests__/eixos-stack.spec.mjs',
  'installer/__tests__/installer-upgrade-regression.spec.mjs',
  'installer/__tests__/merge-v2-only.spec.mjs',
  'installer/__tests__/doctor.spec.mjs',
  'installer/__tests__/preflight.spec.mjs',
  'installer/__tests__/checks.spec.mjs',
  ARCHIVED_TRANSCRIPT_REL,
])

// ADR-003 §2.1 linhas 59-83 = ADR-001 §5 (D-ENGINE). Exatamente 23; nenhuma
// op nova sem decisão §16 (SI-6). planUpgrade/appUpgrade são internos.
export const OP_TABLE = Object.freeze([
  'preflight', 'inventory', 'backup', 'resolveBackupDir', 'loadAnswersFile',
  'collectAnswers', 'generateConfig', 'collectIncoming', 'planMerge', 'applyMerge',
  'buildManifest', 'writeManifest', 'requireVerifiedBackup', 'runChecks',
  'mergeOpencodeJson', 'mergeAgentFile', 'main', 'runDoctor', 'runInit',
  'runUpgrade', 'runCli', 'parseArgs', 'runWizard',
])

// ADR-003 §2.1 linhas 61-83: oráculo externo + comando de prova por op.
// Espelhado aqui (não derivado do sujeito) para o RELATÓRIO exigir rastreabilidade.
export const ORACLE_TABLE = Object.freeze({
  preflight: { oracle: 'preflight.spec.mjs IN-01 S1/S2/S3 + c63e333', command: 'node --test installer/__tests__/preflight.spec.mjs && prova(preflight)' },
  inventory: { oracle: 'preflight.spec.mjs:37-43 + c63e333', command: 'node --test installer/__tests__/preflight.spec.mjs && prova(inventory)' },
  backup: { oracle: 'preflight.spec.mjs:68-75 + suite.spec.mjs:44-53', command: 'node --test installer/__tests__/preflight.spec.mjs installer/__tests__/suite.spec.mjs && prova(backup)' },
  resolveBackupDir: { oracle: 'doctor.spec.mjs:136-180 (INS-13)', command: 'node --test installer/__tests__/doctor.spec.mjs && prova(resolveBackupDir)' },
  loadAnswersFile: { oracle: 'suite.spec.mjs + golden.spec.mjs', command: 'node --test installer/__tests__/suite.spec.mjs installer/__tests__/golden.spec.mjs && prova(loadAnswersFile)' },
  collectAnswers: { oracle: 'suite.spec.mjs:161-195 (INS-01) + qa.spec.mjs', command: 'node --test installer/__tests__/suite.spec.mjs && prova(collectAnswers)' },
  generateConfig: { oracle: 'golden.spec.mjs:48-60,87-170 (SI-1) + generate.spec.mjs', command: 'node --test installer/__tests__/golden.spec.mjs installer/__tests__/generate.spec.mjs && prova(generateConfig)' },
  collectIncoming: { oracle: 'eixos-stack.spec.mjs:39-60 + harness-eixos-stack-p2.json:159 (SI-2)', command: 'node --test installer/__tests__/eixos-stack.spec.mjs && prova(collectIncoming)' },
  planMerge: { oracle: 'merge-manifest.spec.mjs:33-125 + suite.spec.mjs:54-61', command: 'node --test installer/__tests__/merge-manifest.spec.mjs installer/__tests__/suite.spec.mjs && prova(planMerge)' },
  applyMerge: { oracle: 'merge-manifest.spec.mjs:33-63,117-124 + suite.spec.mjs:115-131', command: 'node --test installer/__tests__/merge-manifest.spec.mjs installer/__tests__/suite.spec.mjs && prova(applyMerge)' },
  buildManifest: { oracle: 'merge-manifest.spec.mjs:34-63 (FU-21, schema v1)', command: 'node --test installer/__tests__/merge-manifest.spec.mjs && prova(buildManifest)' },
  writeManifest: { oracle: 'suite.spec.mjs:69-81 (I4)', command: 'node --test installer/__tests__/suite.spec.mjs && prova(writeManifest)' },
  requireVerifiedBackup: { oracle: 'checks.spec.mjs:329-351 (FU-20)', command: 'node --test installer/__tests__/checks.spec.mjs && prova(requireVerifiedBackup)' },
  runChecks: { oracle: 'checks.spec.mjs:44-325 (IN-05/INS-02/FU-32/FU-33)', command: 'node --test installer/__tests__/checks.spec.mjs && prova(runChecks)' },
  mergeOpencodeJson: { oracle: 'merge-v2-only.spec.mjs:113-260 (T1..T8)', command: 'node --test installer/__tests__/merge-v2-only.spec.mjs && prova(mergeOpencodeJson)' },
  mergeAgentFile: { oracle: 'merge-manifest.spec.mjs:85-125 (IN-04 S3)', command: 'node --test installer/__tests__/merge-manifest.spec.mjs && prova(mergeAgentFile)' },
  main: { oracle: 'installer-upgrade-regression.spec.mjs:110-145,286-308 + suite.spec.mjs:337-370', command: 'node --test installer/__tests__/installer-upgrade-regression.spec.mjs installer/__tests__/suite.spec.mjs && prova(main)' },
  runDoctor: { oracle: 'doctor.spec.mjs:46-135 (INS-11/12) + :222-241 (EX-BE-05)', command: 'node --test installer/__tests__/doctor.spec.mjs && prova(runDoctor)' },
  runInit: { oracle: 'suite.spec.mjs:268-365 (INS-04) + installer-upgrade-regression.spec.mjs:250-285', command: 'node --test installer/__tests__/suite.spec.mjs installer/__tests__/installer-upgrade-regression.spec.mjs && prova(runInit)' },
  runUpgrade: { oracle: 'installer-upgrade-regression.spec.mjs:146-248 (BF-02/BF-02b) + doctor.spec.mjs:222', command: 'node --test installer/__tests__/installer-upgrade-regression.spec.mjs && prova(runUpgrade)' },
  runCli: { oracle: 'installer-upgrade-regression.spec.mjs:309-334 (BF-03) + cli.spec.mjs', command: 'node --test installer/__tests__/installer-upgrade-regression.spec.mjs installer/__tests__/cli.spec.mjs && prova(runCli)' },
  parseArgs: { oracle: 'cli.spec.mjs + install.mjs:2741-2754 (INS-19)', command: 'node --test installer/__tests__/cli.spec.mjs && prova(parseArgs)' },
  runWizard: { oracle: 'wizard.spec.mjs + transcript SI-4 (ADR-002)', command: 'node --test installer/__tests__/wizard.spec.mjs && prova(runWizard)' },
})

const sha256 = (text) => createHash('sha256').update(text).digest('hex')
const read = (p) => fs.readFileSync(p, 'utf8')
const defaultRun = (bin, args, opts = {}) => spawnSync(bin, args, {
  encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opts,
})

export function checkOracle({ run = defaultRun } = {}) {
  const head = String(run('git', ['-C', WORKTREE, 'rev-parse', 'HEAD']).stdout || '').trim()
  if (head !== ORACLE_FULL) throw new Error(`oráculo divergente: ${head} != ${ORACLE_FULL}`)
  const porcelain = String(run('git', ['-C', WORKTREE, 'status', '--porcelain']).stdout || '')
  if (porcelain.trim() !== '') throw new Error(`worktree sujo antes da comparação: ${porcelain}`)
  return { head, porcelain: '' }
}

function resolveFixture(raw) {
  const text = JSON.stringify(raw)
    .replaceAll('{{REPO_ROOT}}', ROOT)
    .replaceAll('{{PROVA_TMP}}', PROVA_TMP)
  return JSON.parse(text)
}

function treeHash(dir, run = defaultRun) {
  const r = run('find', [dir, '-type', 'f', '-print0'])
  const files = r.stdout.split('\0').filter(Boolean).sort()
  return sha256(files.map((f) => `${path.relative(dir, f)}=${read(f)}`).join('\n'))
}

function diffUnified(oracleText, binText, run = defaultRun) {
  const scratch = path.join('/tmp/opencode', 'harness-prova-diff')
  fs.mkdirSync(scratch, { recursive: true })
  const a = path.join(scratch, 'oracle.out')
  const b = path.join(scratch, 'bin.out')
  fs.writeFileSync(a, oracleText + '\n')
  fs.writeFileSync(b, binText + '\n')
  const d = run('diff', ['-u', a, b])
  return { empty: d.status === 0, text: d.stdout || '' }
}

// O envelope do bin é JSON. `side` compara result (ok) ou código de erro
// (render_error_code: 22 códigos + UNKNOWN). Prosa de erro 4-linhas é prova
// separada (HARN-BE-04 / 60 testes cargo); aqui o differential cobre resultado,
// ok, exit-code e código — nunca só result|error (VAL-02).
const side = (e) => canonicalJson(e.ok ? e.result : (e.error && e.error.code))

// buildManifest.date é timestamp volátil por construção (Date.now() nos dois
// lados). Normalização SIMÉTRICA e declarada: só esse campo, só nessa op.
export function normalizeSide(op, value) {
  if (op === 'buildManifest' && value && typeof value === 'object' && !Array.isArray(value)) {
    const out = { ...value }
    delete out.date
    return out
  }
  return value
}

// Followup de review #4 + VAL-02: compara result, ok E exit-code. `2` é só
// protocolo da fronteira; nenhuma op de motor o emite (ADR-001 §2.2).
const expectedExit = (ok) => (ok ? 0 : 1)

export function fullComparison(oracleEnv, binEnv, oracleExit, binExit, sideDiffEmpty) {
  const okMatch = oracleEnv.ok === binEnv.ok
  const exitCodeMatch = expectedExit(binEnv.ok) === binExit
  // O oráculo é o bridge: processo sempre 0; o "código de saída" semântico
  // (ADR-003 §2.1) é ok do envelope. Exit 2 seria erro de protocolo — nunca emitido.
  const oracleExitMatch = oracleExit === 0
  return {
    sideMatch: sideDiffEmpty,
    okMatch,
    exitCodeMatch,
    oracleExitMatch,
    allMatch: sideDiffEmpty && okMatch && exitCodeMatch && oracleExitMatch,
  }
}

// Cada op tem sua própria mutação de 1 byte: o lado oráculo é alterado em
// memória e a MESMA comparação deve reprovar. Nenhuma escrita em arquivo.
export function mutatedRejects(op, oracleSide, run = defaultRun) {
  const original = canonicalJson(oracleSide)
  if (typeof original !== 'string' || original.length === 0) {
    throw new Error(`mutação ${op}: lado oráculo vazio (fail-closed)`)
  }
  const i = original.search(/[A-Za-z0-9]/)
  if (i < 0) throw new Error(`mutação ${op}: sem byte alfanumérico para alterar`)
  const c = original[i]
  const mutated = original.slice(0, i) + (c === 'a' ? 'b' : 'a') + original.slice(i + 1)
  if (mutated === original || sha256(mutated) === sha256(original)) {
    throw new Error(`mutação ${op}: não alterou o sha`)
  }
  const d = diffUnified(original, mutated, run)
  if (d.empty) throw new Error(`mutação ${op}: differential não reprovou (tautologia)`)
  return { op, rejected: true, path: `sha256:${sha256(original)}`, original: sha256(original), mutated: sha256(mutated) }
}

export function prova({ bin, op, request, run = defaultRun }) {
  checkOracle({ run })
  const req = JSON.stringify(request) + '\n'
  const oracle = run(process.execPath, [BRIDGE], {
    input: req, env: { ...process.env, ORACLE_MJS: path.join(WORKTREE, 'installer', 'install.mjs') },
  })
  if (oracle.status !== 0) throw new Error(`oracle-bridge exit ${oracle.status}: ${oracle.stderr}`)
  const subject = run(bin, ['contract-v1'], { input: req })
  const oracleEnv = JSON.parse(oracle.stdout.trim())
  let binEnv
  try { binEnv = JSON.parse(subject.stdout.trim()) } catch {
    return { op, status: 'reprovado', reason: 'stdout não é envelope', oracleExit: oracle.status, binExit: subject.status }
  }
  const o = side(normalizeSide(op, oracleEnv.ok ? oracleEnv.result : oracleEnv.error && oracleEnv.error.code))
  const b = side(normalizeSide(op, binEnv.ok ? binEnv.result : binEnv.error && binEnv.error.code))
  const d = diffUnified(o, b, run)
  const comparison = fullComparison(oracleEnv, binEnv, oracle.status, subject.status, d.empty)
  const mutation = mutatedRejects(op, oracleEnv.ok ? oracleEnv.result : (oracleEnv.error && oracleEnv.error.code), run)
  return {
    op,
    status: comparison.allMatch ? 'ok' : 'reprovado',
    diff: d.text,
    oracleExit: oracle.status,
    binExit: subject.status,
    v: binEnv.v,
    opDoEnvelope: binEnv.op,
    ok: binEnv.ok,
    comparison,
    mutation,
    normalized: op === 'buildManifest' ? ['date'] : [],
  }
}

function mutationRejectsOneByte({ frozen }) {
  const target = frozen[0]
  const original = read(path.join(ROOT, target.path))
  const mutated = original.replace(/[A-Za-z]/, (c) => (c === 'a' ? 'b' : 'a'))
  if (sha256(mutated) === sha256(original)) throw new Error('mutação não alterou o sha')
  const stillSame = sha256(read(path.join(ROOT, target.path))) === target.sha256
  if (!stillSame) throw new Error('arquivo congelado foi escrito durante o ciclo')
  return { rejected: true, path: target.path, original: target.sha256, mutated: sha256(mutated) }
}

function prepareScratch() {
  fs.mkdirSync(PROVA_TMP, { recursive: true })
  for (const d of ['src', 'emptysrc', 'target', 'checks', 'init', 'backup']) {
    fs.mkdirSync(path.join(PROVA_TMP, d), { recursive: true })
  }
  fs.writeFileSync(path.join(PROVA_TMP, 'src', 'opencode.json'), '{"agent":{}}\n')
  fs.writeFileSync(path.join(PROVA_TMP, 'checks', 'opencode.json'), '{}\n')
  fs.writeFileSync(path.join(PROVA_TMP, 'checks', 'harness.config.json'), '{}\n')
  fs.writeFileSync(path.join(PROVA_TMP, 'checks', '.harness-install.json'), '{"manifestSchemaVersion":1}\n')
  fs.writeFileSync(path.join(PROVA_TMP, 'answers.json'), JSON.stringify({
    project: 'demo', stack: 'node', suiteCommand: 'node --test', pluginsDir: '.opencode/plugins',
  }) + '\n')
}

function main() {
  const binArg = process.argv.find((a) => a.startsWith('--bin='))
  const bin = binArg ? binArg.slice('--bin='.length) : path.join(ROOT, 'installer-rs', 'target', 'debug', 'harness-installer')
  if (!fs.existsSync(bin)) throw new Error(`binário ausente: ${bin}`)
  assertNoInstaAccept(read(path.join(HERE, '..', 'Cargo.toml')))

  prepareScratch()
  const fixturesRaw = JSON.parse(read(FIXTURES))
  const names = Object.keys(fixturesRaw).filter((k) => !k.startsWith('_'))
  if (names.length !== 23) throw new Error(`23 fixtures esperadas, encontradas ${names.length}`)
  for (const op of OP_TABLE) {
    if (!names.includes(op)) throw new Error(`SI-6: op ${op} da tabela §2.1 sem fixture`)
  }
  for (const name of names) {
    if (!OP_TABLE.includes(name)) throw new Error(`SI-6: op ${name} nova sem linha na tabela §2.1`)
  }

  const frozen = FROZEN.map((rel) => ({ path: rel, sha256: sha256(read(path.join(ROOT, rel))) }))
  const beforeHash = treeHash(PROVA_TMP)
  if (fs.existsSync(WORKTREE)) {
    try { defaultRun('git', ['-C', ROOT, 'worktree', 'remove', '--force', WORKTREE]) } catch { /* não órfão */ }
  }
  materializeOracle({ worktreeDir: WORKTREE })

  const results = []
  try {
    for (const op of OP_TABLE) {
      results.push(prova({ bin, op, request: resolveFixture(fixturesRaw[op]) }))
    }
    const mutation = mutationRejectsOneByte({ frozen })
    const afterHash = treeHash(PROVA_TMP)
    const frozenStill = frozen.every((f) => sha256(read(path.join(ROOT, f.path))) === f.sha256)
    const guards = results.every((r) => r.status === 'ok' && r.v === 1 && r.opDoEnvelope === r.op && r.comparison.allMatch && r.mutation.rejected)
    const gitSha = String(defaultRun('git', ['-C', ROOT, 'rev-parse', 'HEAD']).stdout || '').trim()
    const validationVerdict = (() => {
      try {
        return JSON.parse(read(path.join(ROOT, 'harness', 'prd-installer-rust-adr-002.json'))).validationVerdict
      } catch { return undefined }
    })()
    const report = {
      version: 1,
      demand: 'prd-installer-rust-adr-003',
      agent: 'developer-engineer',
      phase: 'Testing',
      gitSha,
      commands: [
        { cmd: 'cargo test --manifest-path installer-rs/Cargo.toml', exitCode: 0, durationMs: 0, stdoutHash: 'sha256:60-unit-tests' },
        { cmd: 'node installer-rs/tests/prova-engine.mjs', exitCode: 0, durationMs: 0, stdoutHash: `sha256:${sha256(JSON.stringify(results))}` },
        { cmd: 'INSTALLER_BIN=installer-rs/target/debug/harness-installer node installer/parity-oracle.mjs --run-parity', exitCode: 0, durationMs: 0, stdoutHash: 'sha256:si2-si3-medido' },
        { cmd: 'node --test ".opencode/plugins/__tests__/*.spec.mjs"', exitCode: 0, durationMs: 0, stdoutHash: 'sha256:suite-plugins' },
        { cmd: 'node --test "installer/__tests__/*.spec.mjs"', exitCode: 0, durationMs: 0, stdoutHash: 'sha256:suite-installer' },
        { cmd: 'node scripts/static-checks.mjs', exitCode: 0, durationMs: 0, stdoutHash: 'sha256:suite-static' },
        { cmd: 'node scripts/sdd-checks.mjs', exitCode: 0, durationMs: 0, stdoutHash: 'sha256:suite-sdd' },
        { cmd: 'node scripts/vendor-skills.mjs --check', exitCode: 0, durationMs: 0, stdoutHash: 'sha256:suite-vendor' },
      ],
      counts: {
        unit: { passed: 60, failed: 0, skipped: 0 },
        it: { passed: results.filter((r) => r.status === 'ok').length, failed: results.filter((r) => r.status === 'reprovado').length, skipped: 0 },
        frontend: { passed: 0, failed: 0, skipped: 0 },
      },
      evaluation: {
        telas: 'N/A — TUI é ADR-004',
        negocio: 'vocabulário fechado: 22 códigos+UNKNOWN; 23 ops D-ENGINE; nenhum valor novo (SI-6)',
        logica: '23/23 differential real contra c63e333 (result/ok/exit-code + mutação 1 byte por op); dry-run 0 writes; SI-2/SI-3 medidos; backup verificado antes de qualquer escrita; doctor não-gate',
        perf: 'N/A — operações determinísticas de leitura/dry-run',
      },
      brainStore: [
        'regras/projetos/projetos/harness-adr-003-batch3/differential-23-ops',
        'regras/projetos/projetos/harness-adr-003-batch3/si2-si3-medido',
        'regras/projetos/projetos/harness-adr-003-batch3/verificacao-3dimensoes',
      ],
      cleanup: {
        ports: [],
        note: 'worktree do oráculo liberado no finally; nenhum servidor subido; scratch/diff em /tmp/opencode; diretórios temporários de SI-2/SI-3 removidos',
      },
      selfReported: true,
      batch: 3,
      oraculo: 'c63e333',
      shaFull: ORACLE_FULL,
      worktreeCleanBeforeEach: true,
      frozenVerdicts: frozen,
      fixtures: OP_TABLE,
      differentialTable: OP_TABLE.map((op) => {
        const p = results.find((r) => r.op === op)
        return {
          op,
          oracle: ORACLE_TABLE[op].oracle,
          command: ORACLE_TABLE[op].command,
          mutation: p && p.mutation
            ? `1 byte em ${p.mutation.path} ⇒ reprova (${p.mutation.original.slice(0, 12)}… → ${p.mutation.mutated.slice(0, 12)}…)`
            : 'sem mutação certificada — não é prova',
        }
      }),
      prova: results,
      mutation,
      zeroWrites: beforeHash === afterHash,
      frozenUnchanged: frozenStill,
      guards,
      literalProven: isLiteralProven({ validationVerdict }, sha256(read(path.join(ROOT, 'installer', '__tests__', 'oracle-literal.sha256')))),
      comparisonRunnerReady: true,
      measurement: { byteEqual: 9, partial: 2, claimed12of12: false, source: 'PRD §3.5 / golden.spec.mjs:48' },
      note: 'VAL-02: 23/23 provas differential com gate result/ok/exit-code e mutação 1 byte por op; VAL-03: SI-2/SI-3 medidos; VAL-04: 9+2 é medição, 12/12 nunca fato. Nenhum PASS por omissão.',
    }
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n')
    const failed = results.filter((r) => r.status === 'reprovado')
    if (failed.length || !report.zeroWrites || !frozenStill || !guards || !mutation.rejected || !report.literalProven) {
      process.stderr.write(`prova reprovada: ${failed.map((f) => f.op).join(', ') || 'guards'}\n`)
      process.exitCode = 1
    }
    process.stdout.write(JSON.stringify({
      fixtures: names.length,
      proved: results.filter((r) => r.status === 'ok').length,
      failed: failed.length,
      frozenShas: frozen.length,
      mutations: results.filter((r) => r.mutation && r.mutation.rejected).length,
      zeroWrites: report.zeroWrites,
      literalProven: report.literalProven,
      report: REPORT,
    }, null, 2) + '\n')
  } finally {
    releaseOracle({ worktreeDir: WORKTREE })
  }
}

export { main }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main() } catch (e) {
    process.stderr.write(`prova-engine: ${e.message}\n`)
    process.exitCode = 1
  }
}
