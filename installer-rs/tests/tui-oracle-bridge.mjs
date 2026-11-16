// Ponte de PROVA das 8 `op`s de TUI (ADR-004 §2.1 / RF-04/11).
// Importa SOMENTE o install.mjs do worktree detach (ORACLE_MJS). Nunca o do
// HEAD, nunca o binário sob teste, nunca installer-contract.mjs. Cada braço
// devolve o resultado no formato contract-v1 que o dispatcher Rust produz.
import { pathToFileURL } from 'node:url'
import { Readable } from 'node:stream'

const ORACLE_MJS = process.env.ORACLE_MJS
if (!ORACLE_MJS) {
  process.stderr.write('tui-oracle-bridge: ORACLE_MJS ausente\n')
  process.exit(2)
}
const oracle = await import(pathToFileURL(ORACLE_MJS).href)

const ERROR_CODES = new Set([
  'BAD_ANSWER', 'CORRUPT', 'NO_STDIN', 'USER_ABORT', 'BACKUP_FAIL',
  'BACKUP_UNVERIFIED', 'BAD_TARGET', 'NODE_MIN', 'UID_ROOT', 'REINSTALL',
  'FOREIGN_MANIFEST', 'OUTSIDE_TARGET', 'DOGFOOD_GUARD', 'MISSING_INCOMING',
  'SECRET_TTY', 'manifest-missing', 'config-missing', 'json-invalid',
  'flagged-open', 'literal-denied', 'config-ref-missing', 'plugin-parse',
])
const renderCode = (code) => (ERROR_CODES.has(code) ? code : 'UNKNOWN')
const linesOut = () => {
  const lines = []
  return { stream: { write: (s) => { lines.push(String(s)) } }, lines }
}
const fakeStdin = (text) => {
  const raw = String(text ?? '')
  const lines = raw.length ? raw.split('\n') : []
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  const s = Readable.from(lines.map((l) => `${l}\n`))
  s.isTTY = false
  return s
}
const serializeAnswers = (answers) => {
  const out = {}
  for (const q of oracle.QUESTIONS) {
    if (q.secret) continue
    if (answers[q.key] !== undefined) out[q.key] = answers[q.key]
  }
  return out
}

async function call(op, req) {
  const a = req.args || {}
  switch (op) {
    case 'askMenuStep': {
      const promptBox = { value: '' }
      const out = linesOut()
      const picked = await oracle.askMenuStep({
        read: async (p) => { promptBox.value = p; return String(a.choice ?? '') },
        out: (s) => out.stream.write(`${s}\n`),
        answers: a.answers ?? {},
        header: a.header ?? '',
        items: a.items ?? [],
        step: a.step ?? 1,
        total: a.total ?? 2,
        defaultKey: a.defaultKey ?? null,
        width: a.width ?? 0,
      })
      return { prompt: promptBox.value, lines: out.lines.map((l) => l.replace(/\n$/, '')), picked }
    }
    case 'detect': return oracle.detect(a.target ?? req.target)
    case 'printPlan': {
      const out = linesOut()
      const r = oracle.printPlan(a.plan ?? [], { output: out.stream, answers: a.answers ?? {} })
      return { counts: r.counts, total: r.total, lines: out.lines.map((l) => l.replace(/\n$/, '')) }
    }
    case 'printUsage': {
      const out = linesOut()
      oracle.printUsage({ output: out.stream })
      return { lines: out.lines.map((l) => l.replace(/\n$/, '')) }
    }
    case 'promptAnswers': {
      const answers = await oracle.promptAnswers(a.target ?? req.target, {
        input: fakeStdin(a.stdinText ?? ''), output: { write() {} },
      })
      return serializeAnswers(answers)
    }
    case 'readSecretPrompt': {
      const input = fakeStdin('')
      const prompt = a.prompt ?? oracle.QUESTIONS.find((q) => q.secret)?.prompt ?? ''
      const value = await oracle.readSecretPrompt({ input, output: { write() {} }, prompt })
      return { prompt: `${prompt} `, canNoEcho: oracle.canNoEcho(input) && value !== null }
    }
    case 'readSecretRaw': {
      const input = fakeStdin(a.input ?? '')
      return await oracle.readSecretRaw(input, { write() {} })
    }
    case 'sourceLineOf': {
      const marker = a.marker ?? ''
      const file = a.path ? pathToFileURL(a.path).href : undefined
      const line = file ? oracle.sourceLineOf(marker, file) : oracle.sourceLineOf(marker)
      return { line }
    }
    default: throw new Error(`op TUI ${op} sem ponte (SI-6)`)
  }
}

let input = ''
for await (const chunk of process.stdin) input += chunk
let req
try { req = JSON.parse(input) } catch {
  process.stdout.write(JSON.stringify({ v: 1, ok: false, op: '', error: { code: 'UNKNOWN', what: 'request inválido', why: '', fix: '', where: 'tui-oracle-bridge' } }))
  process.exit(2)
}
try {
  const result = await call(req.op, req)
  process.stdout.write(JSON.stringify({ v: 1, ok: true, op: req.op, result }))
} catch (e) {
  process.stdout.write(JSON.stringify({
    v: 1, ok: false, op: req.op,
    error: { code: renderCode(e && e.code), what: String(e && e.message ? e.message : e), why: '', fix: '', where: 'tui-oracle-bridge' },
  }))
}
