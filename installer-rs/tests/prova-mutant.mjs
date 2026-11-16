#!/usr/bin/env node
// Anti-C1 — executa o MESMO `prova()` das 23 provas reais contra um binário
// mutante exit-preserving (result + error.code corrompidos em 100% das saídas).
// Veredito esperado: 0 provados / 23 reprovados. Se o differential voltar a
// ser vacuo (double-unwrap), este script imprime 23/23 provados e sai != 0.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { materializeOracle, releaseOracle } from '../../installer/parity-oracle.mjs'
import { prova, OP_TABLE, WORKTREE, MUTANT_BIN } from './prova-engine.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const TMP = path.join('/tmp/opencode', 'harness-prova-engine')
const run = (bin, args, opts = {}) => spawnSync(bin, args, {
  encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opts,
})

function requestFor(op) {
  const raw = JSON.parse(fs.readFileSync(path.join(HERE, 'req-fixtures.json'), 'utf8'))[op]
  return JSON.parse(JSON.stringify(raw)
    .replaceAll('{{REPO_ROOT}}', ROOT)
    .replaceAll('{{PROVA_TMP}}', TMP))
}

for (const d of ['src', 'emptysrc', 'target', 'checks', 'init', 'backup']) {
  fs.mkdirSync(path.join(TMP, d), { recursive: true })
}
fs.writeFileSync(path.join(TMP, 'src', 'opencode.json'), '{"agent":{}}\n')
fs.writeFileSync(path.join(TMP, 'checks', 'opencode.json'), '{}\n')
fs.writeFileSync(path.join(TMP, 'checks', 'harness.config.json'), '{}\n')
fs.writeFileSync(path.join(TMP, 'checks', '.harness-install.json'), '{"manifestSchemaVersion":1}\n')
fs.writeFileSync(path.join(TMP, 'answers.json'), JSON.stringify({
  project: 'demo', stack: 'node', suiteCommand: 'node --test', pluginsDir: '.opencode/plugins',
}) + '\n')

if (fs.existsSync(path.join(WORKTREE, '.git'))) releaseOracle({ worktreeDir: WORKTREE })
materializeOracle({ worktreeDir: WORKTREE })
try {
  const rows = OP_TABLE.map((op) => {
    const r = prova({ bin: MUTANT_BIN, op, request: requestFor(op), run })
    return {
      op,
      status: r.status,
      sideMatch: r.comparison.sideMatch,
      okMatch: r.comparison.okMatch,
      sideShaOracle: r.sideSha.oracle.slice(0, 12),
      sideShaBin: r.sideSha.bin.slice(0, 12),
    }
  })
  const proved = rows.filter((r) => r.status === 'ok').length
  const failed = rows.filter((r) => r.status === 'reprovado').length
  process.stdout.write(JSON.stringify({
    mutante: 'exit-preserving: __MUTANT__ em todo result + MUTANTCODE em todo error.code',
    total: rows.length, proved, failed, rows,
  }, null, 2) + '\n')
  process.exitCode = failed === 23 && proved === 0 ? 0 : 1
} finally {
  releaseOracle({ worktreeDir: WORKTREE })
}
