// prova(detect) — ADR-004 batch 3, correção do 🟠 do review final.
// Oráculo = c63e333 (install.mjs:2182 emite o warning R9). Sujeito = binário
// Rust ops.rs::detect. Fixture: pubspec declara flutter, PATH sem `flutter`.
// Falha ANTES da correção (warning ausente no bin) e passa DEPOIS, byte-idêntico.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ORACLE_FULL, canonicalJson, materializeOracle, releaseOracle,
} from '../../installer/parity-oracle.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const BIN = path.join(ROOT, 'installer-rs', 'target', 'debug', 'harness-installer')
const BRIDGE = path.join(HERE, 'tui-oracle-bridge.mjs')
const WORKTREE = path.join('/tmp/opencode', 'harness-oracle-detect-r9')
const TMP = path.join('/tmp/opencode', 'adr004-detect-r9')
const R9 = "'flutter' nao resolve no PATH (R9): confirme o comando da suite."

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opts })
const req = (target) => JSON.stringify({ v: 1, op: 'detect', args: { target }, answers: {}, target: null }) + '\n'

function prepare() {
  fs.rmSync(TMP, { recursive: true, force: true })
  fs.mkdirSync(path.join(TMP, 'emptybin'), { recursive: true })
  fs.writeFileSync(path.join(TMP, 'pubspec.yaml'), 'name: flutter_demo\nflutter:\n  uses-material-design: true\n')
  return path.join(TMP, 'emptybin')
}

function oracle(target, binPath) {
  const r = run(process.execPath, [BRIDGE], {
    input: req(target),
    env: { ...process.env, PATH: binPath, ORACLE_MJS: path.join(WORKTREE, 'installer', 'install.mjs') },
  })
  if (r.status !== 0) throw new Error(`oracle bridge exit ${r.status}: ${r.stderr}`)
  return JSON.parse(r.stdout.trim())
}

function subject(target, binPath) {
  const r = run(BIN, ['contract-v1'], { input: req(target), env: { ...process.env, PATH: binPath } })
  if (r.status !== 0) throw new Error(`bin exit ${r.status}: ${r.stderr}`)
  return JSON.parse(r.stdout.trim())
}

function main() {
  if (!fs.existsSync(BIN)) throw new Error(`binário ausente: ${BIN}`)
  fs.rmSync(WORKTREE, { recursive: true, force: true })
  try { run('git', ['-C', ROOT, 'worktree', 'remove', '--force', WORKTREE]) } catch { /* não órfão */ }
  materializeOracle({ worktreeDir: WORKTREE })
  try {
    const head = run('git', ['-C', WORKTREE, 'rev-parse', 'HEAD']).stdout.trim()
    if (head !== ORACLE_FULL) throw new Error(`oráculo divergente: ${head}`)
    const emptybin = prepare()
    const o = oracle(TMP, emptybin)
    const b = subject(TMP, emptybin)

    // Caso de controle: com `flutter` no PATH, nenhum dos lados avisa.
    fs.writeFileSync(path.join(emptybin, 'flutter'), '#!/bin/sh\nexit 0\n')
    fs.chmodSync(path.join(emptybin, 'flutter'), 0o755)
    const oOn = oracle(TMP, emptybin)
    const bOn = subject(TMP, emptybin)

    const side = (e) => canonicalJson(e.ok ? e.result : (e.error && e.error.code))
    const byteEqual = side(o) === side(b)
    const check = {
      oracle: o.result,
      bin: b.result,
      sideSha: {
        oracle: createHash('sha256').update(side(o)).digest('hex'),
        bin: createHash('sha256').update(side(b)).digest('hex'),
      },
      byteEqual,
      oracleR9: (o.result.warnings || []).includes(R9),
      binR9: (b.result.warnings || []).includes(R9),
      controlOracleNoWarn: (oOn.result.warnings || []).length === 0,
      controlBinNoWarn: (bOn.result.warnings || []).length === 0,
      pass: byteEqual && (o.result.warnings || []).includes(R9)
        && (b.result.warnings || []).includes(R9)
        && (oOn.result.warnings || []).length === 0
        && (bOn.result.warnings || []).length === 0,
    }
    process.stdout.write(JSON.stringify(check, null, 2) + '\n')
    if (!check.pass) process.exitCode = 1
  } finally {
    releaseOracle({ worktreeDir: WORKTREE })
  }
}

try { main() } catch (e) { process.stderr.write(String(e && e.stack ? e.stack : e) + '\n'); process.exitCode = 1 }
