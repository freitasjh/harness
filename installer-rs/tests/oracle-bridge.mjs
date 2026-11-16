// Ponte de PROVA (ADR-003 §2.1): traduz REQ_op → argv/stdin do ORÁCULO.
// Importa SOMENTE o install.mjs do worktree detach (ORACLE_MJS); nunca o do HEAD
// nem o binário sob teste. Nenhum resultado é gerado a partir do sujeito.
// Não importa installer-contract.mjs: isso reintroduziria o motor do HEAD.
// VAL-02: 23 braços (D-ENGINE), um por linha da tabela ADR-003 §2.1.
import { pathToFileURL } from 'node:url'
import { Readable } from 'node:stream'

const ORACLE_MJS = process.env.ORACLE_MJS
if (!ORACLE_MJS) {
  process.stderr.write('oracle-bridge: ORACLE_MJS ausente\n')
  process.exit(2)
}

const oracle = await import(pathToFileURL(ORACLE_MJS).href)

// install.mjs:1529-1535 @ c63e333 — 22 códigos + UNKNOWN. NOT_INSTALLED e
// MANIFEST_INVALID são convertidos em UNKNOWN pelo formatError; o mesmo
// mapeamento é aplicado aqui para o envelope (nunca código novo inventado).
const ERROR_CODES = new Set([
  'BAD_ANSWER', 'CORRUPT', 'NO_STDIN', 'USER_ABORT', 'BACKUP_FAIL',
  'BACKUP_UNVERIFIED', 'BAD_TARGET', 'NODE_MIN', 'UID_ROOT', 'REINSTALL',
  'FOREIGN_MANIFEST', 'OUTSIDE_TARGET', 'DOGFOOD_GUARD', 'MISSING_INCOMING',
  'SECRET_TTY', 'manifest-missing', 'config-missing', 'json-invalid',
  'flagged-open', 'literal-denied', 'config-ref-missing', 'plugin-parse',
])
const renderCode = (code) => (ERROR_CODES.has(code) ? code : 'UNKNOWN')

function serializeAnswers(answers) {
  const out = {}
  for (const q of oracle.QUESTIONS) {
    if (q.secret) continue
    if (answers[q.key] !== undefined) out[q.key] = answers[q.key]
  }
  if (answers.answersVersion !== undefined) out.answersVersion = answers.answersVersion
  return out
}

function fakeStdin(text) {
  const s = Readable.from([text ?? ''])
  s.isTTY = false
  return s
}

const sink = () => {}

async function call(op, req) {
  const a = req.args || {}
  switch (op) {
    case 'preflight': return oracle.preflight(a)
    case 'inventory': return oracle.inventory(a.target)
    case 'resolveBackupDir': return oracle.resolveBackupDir(a.target, a.backupRoot)
    case 'loadAnswersFile': return oracle.loadAnswersFile(a.path)
    case 'collectAnswers': return serializeAnswers(oracle.collectAnswers(a.target, a.scripted))
    case 'generateConfig': return oracle.generateConfig(a.answers, { writtenPaths: a.writtenPaths ?? null })
    case 'collectIncoming': return oracle.collectIncoming(a.sourceDir, { stacks: a.stacks ?? [], stack: a.stack ?? null })
    case 'backup': return oracle.backup(req.target, { backupRoot: a.backupRoot, injectFailure: a.injectFailure })
    case 'planMerge': return { plan: oracle.planMerge(a.target, a.incomingFiles ?? {}) }
    case 'applyMerge': return oracle.applyMerge(a.target, a.plan ?? [], { incomingFiles: a.incomingFiles ?? {}, dryRun: a.dryRun })
    case 'buildManifest': return oracle.buildManifest({
      target: a.target, backupDir: a.backupDir, installed: a.installed ?? [], merged: a.merged ?? [],
      flagged: a.flagged ?? [], answers: a.answers ?? {}, checks: a.checks ?? { passed: true, failed: [] },
      fileContents: a.fileContents ?? {}, source: a.source ?? 'harness@0.1.0',
    })
    case 'writeManifest': return oracle.writeManifest(a.target, a.manifest ?? {}, { dryRun: a.dryRun })
    case 'requireVerifiedBackup': return oracle.requireVerifiedBackup(a.backup)
    case 'runChecks': return oracle.runChecks(a.target, { manifest: a.manifest ?? null, answers: a.answers ?? {} })
    case 'mergeOpencodeJson': return oracle.mergeOpencodeJson(a.existing ?? {}, a.incoming ?? {})
    case 'mergeAgentFile': return oracle.mergeAgentFile(a.existing ?? '', a.incomingSection ?? '')
    case 'main': return oracle.main({ target: a.target, scriptedAnswers: req.answers ?? {}, incomingFiles: a.incomingFiles ?? {}, options: a.options ?? {} })
    case 'runDoctor': return oracle.runDoctor({
      target: a.target, sourceDir: a.sourceDir ?? null, answersFile: a.answersFile ?? null,
      backupDir: a.backupDir ?? null, allowRoot: a.allowRoot, output: { write: sink },
    })
    case 'runInit': return oracle.runInit({
      target: a.target, stdin: fakeStdin(a.stdinText ?? ''), stdout: { write: sink }, stderr: { write: sink },
      sourceDir: a.sourceDir ?? null, answersFile: a.answersFile ?? null, options: a.options ?? {},
    })
    case 'runUpgrade': return oracle.runUpgrade({
      target: a.target, stdin: fakeStdin(a.stdinText ?? ''), stdout: { write: sink }, stderr: { write: sink },
      sourceDir: a.sourceDir ?? null, answersFile: a.answersFile ?? null, options: a.options ?? {},
    })
    case 'runCli': return oracle.runCli({
      argv: a.argv ?? [], stdin: fakeStdin(a.stdinText ?? ''), stdout: { write: sink }, stderr: { write: sink },
      sourceDir: a.sourceDir ?? null,
    })
    case 'parseArgs': return oracle.parseArgs(a.argv ?? [])
    case 'runWizard': return oracle.runWizard({
      target: a.target, stdin: fakeStdin(a.stdinText ?? ''), stdout: { write: sink },
      sourceDir: a.sourceDir ?? null, apply: null, options: a.options ?? {},
    })
    default: throw new Error(`op ${op} sem ponte (SI-6: nenhuma op nova sem §16)`)
  }
}

let input = ''
for await (const chunk of process.stdin) input += chunk

let req
try { req = JSON.parse(input) } catch {
  process.stdout.write(JSON.stringify({ v: 1, ok: false, op: '', error: { code: 'UNKNOWN', what: 'request inválido', why: '', fix: '', where: 'oracle-bridge' } }))
  process.exit(2)
}

try {
  const result = await call(req.op, req)
  process.stdout.write(JSON.stringify({ v: 1, ok: true, op: req.op, result }))
} catch (e) {
  process.stdout.write(JSON.stringify({
    v: 1,
    ok: false,
    op: req.op,
    error: { code: renderCode(e && e.code), what: String(e && e.message ? e.message : e), why: '', fix: '', where: 'oracle-bridge' },
  }))
}
