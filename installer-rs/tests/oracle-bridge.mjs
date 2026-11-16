// Ponte de PROVA (ADR-003 §2.1): traduz REQ_op → argv/stdin do ORÁCULO.
// Importa SOMENTE o install.mjs do worktree detach (ORACLE_MJS); nunca o do HEAD
// nem o binário sob teste. Nenhum resultado é gerado a partir do sujeito.
// Não importa installer-contract.mjs: isso reintroduziria o motor do HEAD.
import { pathToFileURL } from 'node:url'

const ORACLE_MJS = process.env.ORACLE_MJS
if (!ORACLE_MJS) {
  process.stderr.write('oracle-bridge: ORACLE_MJS ausente\n')
  process.exit(2)
}

const oracle = await import(pathToFileURL(ORACLE_MJS).href)

function serializeAnswers(answers) {
  const out = {}
  for (const q of oracle.QUESTIONS) {
    if (q.secret) continue
    if (answers[q.key] !== undefined) out[q.key] = answers[q.key]
  }
  if (answers.answersVersion !== undefined) out.answersVersion = answers.answersVersion
  return out
}

function call(op, args) {
  switch (op) {
    case 'preflight': return oracle.preflight(args)
    case 'inventory': return oracle.inventory(args.target)
    case 'resolveBackupDir': return oracle.resolveBackupDir(args.target, args.backupRoot)
    case 'loadAnswersFile': return oracle.loadAnswersFile(args.path)
    case 'collectAnswers': {
      const a = oracle.collectAnswers(args.target, args.scripted)
      return serializeAnswers(a)
    }
    case 'generateConfig': return oracle.generateConfig(args.answers, { writtenPaths: args.writtenPaths ?? null })
    case 'collectIncoming': return oracle.collectIncoming(args.sourceDir, { stacks: args.stacks ?? [], stack: args.stack ?? null })
    default: throw new Error(`op ${op} sem ponte neste batch (pendente)`)
  }
}

let input = ''
for await (const chunk of process.stdin) input += chunk

let req
try { req = JSON.parse(input) } catch {
  process.stdout.write(JSON.stringify({ v: 1, ok: false, op: '', error: { code: 'json-invalid', what: 'request inválido', why: '', fix: '', where: 'oracle-bridge' } }))
  process.exit(2)
}

try {
  const result = call(req.op, req.args || {})
  process.stdout.write(JSON.stringify({ v: 1, ok: true, op: req.op, result }))
} catch (e) {
  const code = e && e.code && e.code !== 'INSTALL_ABORT' ? e.code : 'UNKNOWN'
  process.stdout.write(JSON.stringify({
    v: 1,
    ok: false,
    op: req.op,
    error: { code, what: String(e && e.message ? e.message : e), why: '', fix: '', where: 'oracle-bridge' },
  }))
}
