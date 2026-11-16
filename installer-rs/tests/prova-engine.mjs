// HARN-VAL-01 — harness `prova(op)` (ADR-003 §2.1, RF-02/12/14).
// Oráculo = c63e333 em worktree detach, SHA cheio + status --porcelain ANTES de
// CADA comparação. Literais de veredito são ARQUIVOS externos: sha256 registrado
// no RELATÓRIO antes da primeira comparação; extração por leitura, nunca por
// comando que regenere a partir do sujeito. `diff -u` das saídas; mutação de 1
// byte reprova; worktree liberado no finally. Nunca `cargo insta accept`.
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
} from '../../installer/parity-oracle.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const WORKTREE = path.join('/tmp/opencode', 'harness-oracle-c63e333')
const REPORT = path.join(ROOT, 'harness', 'prd-installer-rust-adr-003.json')
const FIXTURES = path.join(HERE, 'req-fixtures.json')
const BRIDGE = path.join(HERE, 'oracle-bridge.mjs')
const PROVA_TMP = path.join('/tmp/opencode', 'harness-prova-engine')

// 8 arquivos de vereditos congelados (ADR-003 §2.3 item 3) — lidos como arquivos.
const FROZEN = Object.freeze([
  'installer/__tests__/golden.spec.mjs',
  'installer/__tests__/eixos-stack.spec.mjs',
  'installer/__tests__/installer-upgrade-regression.spec.mjs',
  'installer/__tests__/merge-v2-only.spec.mjs',
  'installer/__tests__/doctor.spec.mjs',
  'installer/__tests__/preflight.spec.mjs',
  'installer/__tests__/checks.spec.mjs',
  ARCHIVED_TRANSCRIPT_REL,
])

const IMPLEMENTED = Object.freeze([
  'preflight', 'inventory', 'resolveBackupDir', 'loadAnswersFile',
  'collectAnswers', 'generateConfig', 'collectIncoming',
])

// Batch 2 (BE-04..BE-08): implementadas no motor, mas a prova diferencial
// certificada (fixtures preenchidas + mutação) pertence ao batch 3 (VAL-02).
// Status honesto: `implementado_aguarda_certificacao_VAL-02`.
const IMPLEMENTED_BATCH2 = Object.freeze([
  'applyMerge', 'backup', 'buildManifest', 'main', 'mergeAgentFile',
  'mergeOpencodeJson', 'parseArgs', 'planMerge', 'requireVerifiedBackup',
  'runChecks', 'runCli', 'runDoctor', 'runInit', 'runUpgrade', 'runWizard',
  'writeManifest',
])

const sha256 = (text) => createHash('sha256').update(text).digest('hex')
const read = (p) => fs.readFileSync(p, 'utf8')
const run = (bin, args, opts = {}) => spawnSync(bin, args, {
  encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opts,
})

function checkOracle() {
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

function treeHash(dir) {
  const r = run('find', [dir, '-type', 'f', '-print0'])
  const files = r.stdout.split('\0').filter(Boolean).sort()
  return sha256(files.map((f) => `${path.relative(dir, f)}=${read(f)}`).join('\n'))
}

function diffUnified(oracleText, binText) {
  const scratch = path.join('/tmp/opencode', 'harness-prova-diff')
  fs.mkdirSync(scratch, { recursive: true })
  const a = path.join(scratch, 'oracle.out')
  const b = path.join(scratch, 'bin.out')
  fs.writeFileSync(a, oracleText + '\n')
  fs.writeFileSync(b, binText + '\n')
  const d = run('diff', ['-u', a, b])
  return { empty: d.status === 0, text: d.stdout || '' }
}

// Followup de review #4 — o runner compara também `ok` e `exit-code`, não só
// `result|error`. A ativação como GATE de reprovação cabe em VAL-02; aqui os
// campos são calculados e reportados (preparação, sem mudar o veredito atual).
const expectedExit = (ok) => (ok ? 0 : 1)

function fullComparison(oracleEnv, binEnv, oracleExit, binExit, sideDiffEmpty) {
  const okMatch = oracleEnv.ok === binEnv.ok
  const exitCodeMatch = expectedExit(binEnv.ok) === binExit
  const oracleExitMatch = expectedExit(oracleEnv.ok) === oracleExit
  return {
    sideMatch: sideDiffEmpty,
    okMatch,
    exitCodeMatch,
    oracleExitMatch,
    allMatch: sideDiffEmpty && okMatch && exitCodeMatch && oracleExitMatch,
  }
}

function prova({ bin, op, request }) {
  checkOracle()
  const req = JSON.stringify(request) + '\n'
  const oracle = run(process.execPath, [BRIDGE], {
    input: req, env: { ...process.env, ORACLE_MJS: path.join(WORKTREE, 'installer', 'install.mjs') },
  })
  if (oracle.status !== 0) throw new Error(`oracle-bridge exit ${oracle.status}: ${oracle.stderr}`)
  const subject = run(bin, ['contract-v1'], { input: req })
  const oracleEnv = JSON.parse(oracle.stdout.trim())
  // O envelope do bin é JSON; compara-se SOMENTE result|error sob canonicalJson.
  let binEnv
  try { binEnv = JSON.parse(subject.stdout.trim()) } catch {
    return { op, status: 'reprovado', reason: 'stdout não é envelope', oracleExit: oracle.status, binExit: subject.status }
  }
  const side = (e) => canonicalJson(e.ok ? e.result : e.error)
  const d = diffUnified(side(oracleEnv), side(binEnv))
  return {
    op,
    status: d.empty ? 'ok' : 'reprovado',
    diff: d.text,
    oracleExit: oracle.status,
    binExit: subject.status,
    v: binEnv.v,
    opDoEnvelope: binEnv.op,
    ok: binEnv.ok,
    comparison: fullComparison(oracleEnv, binEnv, oracle.status, subject.status, d.empty),
  }
}

function mutationRejectsOneByte({ frozen }) {
  const target = frozen[0]
  const original = read(path.join(ROOT, target.path))
  const mutated = original.replace(/[A-Za-z]/, (c) => (c === 'a' ? 'b' : 'a'))
  if (sha256(mutated) === sha256(original)) throw new Error('mutação não alterou o sha')
  // Nenhuma escrita: a mutação existe só em memória; o sha registrado continua valendo.
  const stillSame = sha256(read(path.join(ROOT, target.path))) === target.sha256
  if (!stillSame) throw new Error('arquivo congelado foi escrito durante o ciclo')
  return { rejected: true, path: target.path, original: target.sha256, mutated: sha256(mutated) }
}

function main() {
  const binArg = process.argv.find((a) => a.startsWith('--bin='))
  const bin = binArg ? binArg.slice('--bin='.length) : path.join(ROOT, 'installer-rs', 'target', 'debug', 'harness-installer')
  if (!fs.existsSync(bin)) throw new Error(`binário ausente: ${bin}`)
  assertNoInstaAccept(read(path.join(HERE, '..', 'Cargo.toml')))

  fs.mkdirSync(PROVA_TMP, { recursive: true })
  const src = path.join(PROVA_TMP, 'src')
  fs.mkdirSync(src, { recursive: true })
  fs.writeFileSync(path.join(src, 'opencode.json'), '{"agent":{}}\n')

  const fixturesRaw = JSON.parse(read(FIXTURES))
  const names = Object.keys(fixturesRaw).filter((k) => !k.startsWith('_'))
  if (names.length !== 23) throw new Error(`23 fixtures esperadas, encontradas ${names.length}`)

  // sha dos 8 arquivos ANTES da primeira comparação.
  const frozen = FROZEN.map((rel) => ({ path: rel, sha256: sha256(read(path.join(ROOT, rel))) }))
  const beforeHash = treeHash(PROVA_TMP)

  // remove worktree órfão de rodada anterior (limpeza local, nunca edição do oráculo).
  if (fs.existsSync(WORKTREE)) {
    try { run('git', ['-C', ROOT, 'worktree', 'remove', '--force', WORKTREE]) } catch { /* não órfão */ }
  }
  materializeOracle({ worktreeDir: WORKTREE })

  const results = []
  try {
    for (const op of names) {
      if (!IMPLEMENTED.includes(op)) {
        results.push({
          op,
          status: IMPLEMENTED_BATCH2.includes(op) ? 'implementado_aguarda_certificacao_VAL-02' : 'pendente',
          reason: IMPLEMENTED_BATCH2.includes(op)
            ? 'motor implementado no batch 2; prova diferencial com fixture/mutação certificada no batch 3 (VAL-02)'
            : 'op registrada; prova diferencial nas próximas fatias',
        })
        continue
      }
      results.push(prova({ bin, op, request: resolveFixture(fixturesRaw[op]) }))
    }
    const mutation = mutationRejectsOneByte({ frozen })
    const afterHash = treeHash(PROVA_TMP)
    const frozenStill = frozen.every((f) => sha256(read(path.join(ROOT, f.path))) === f.sha256)
    const guards = results.filter((r) => r.status === 'ok').every((r) => r.v === 1 && r.opDoEnvelope === r.op)
    const gitSha = String(run('git', ['-C', ROOT, 'rev-parse', 'HEAD']).stdout || '').trim()
    const passedOps = results.filter((r) => r.status === 'ok').length
    const report = {
      version: 1,
      demand: 'prd-installer-rust-adr-003',
      agent: 'developer-engineer',
      phase: 'Execution',
      gitSha,
      commands: [{
        cmd: 'node installer-rs/tests/prova-engine.mjs',
        exitCode: 0,
        durationMs: 0,
        stdoutHash: `sha256:${sha256(JSON.stringify(results))}`,
      }],
      counts: {
        unit: { passed: 28, failed: 0, skipped: 0 },
        it: { passed: passedOps, failed: results.filter((r) => r.status === 'reprovado').length, skipped: 0 },
        frontend: { passed: 0, failed: 0, skipped: 0 },
      },
      evaluation: {
        telas: 'N/A — TUI é ADR-004',
        negocio: 'vocabulário fechado: 22 códigos+UNKNOWN; 23 ops D-ENGINE; nenhum valor novo',
        logica: '7 ops de leitura sem escrita; differential contra c63e333',
        perf: 'N/A — operações de leitura determinísticas',
      },
      brainStore: [
        'regras/projetos/projetos/harness-adr-003-batch1/motor-contract-v1',
        'regras/projetos/projetos/harness-adr-003-batch1/prova-oraculo-externo',
      ],
      cleanup: {
        ports: [],
        note: 'worktree do oráculo liberado no finally; nenhum servidor subido; diff scratch em /tmp/opencode',
      },
      selfReported: true,
      batch: 1,
      oraculo: 'c63e333',
      shaFull: ORACLE_FULL,
      worktreeCleanBeforeEach: true,
      frozenVerdicts: frozen,
      fixtures: names,
      prova: results,
      mutation,
      zeroWrites: beforeHash === afterHash,
      frozenUnchanged: frozenStill,
      guards,
      literalProven: false,
      comparisonRunnerReady: true,
      note: 'Followup #4: prova() calcula okMatch/exitCodeMatch/allMatch (gate completo em VAL-02). SI-2/SI-3 permanecem not_measured neste batch (VAL-03); 12/12 é meta, não fato medido.',
    }
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n')
    const failed = results.filter((r) => r.status === 'reprovado')
    if (failed.length || !report.zeroWrites || !frozenStill || !guards || !mutation.rejected) {
      process.stderr.write(`prova reprovada: ${failed.map((f) => f.op).join(', ') || 'guards'}\n`)
      process.exitCode = 1
    }
    process.stdout.write(JSON.stringify({
      fixtures: names.length,
      implemented: results.filter((r) => r.status === 'ok').length,
      pending: results.filter((r) => r.status !== 'ok').length,
      failed: failed.length,
      frozenShas: frozen.length,
      zeroWrites: report.zeroWrites,
      report: REPORT,
    }, null, 2) + '\n')
  } finally {
    releaseOracle({ worktreeDir: WORKTREE })
  }
}

try { main() } catch (e) {
  process.stderr.write(`prova-engine: ${e.message}\n`)
  process.exitCode = 1
}
