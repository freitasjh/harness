// Oráculo materializado c63e333 — fonte congelada para canários de leitura.
// Fail-closed: sem o commit, SEM fallback silencioso e SEM regex de formato.
// O único import estático do oráculo permanece na ponte (contract:15).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ORACLE_COMMIT = 'c63e333'
export const ORACLE_REL = 'installer/install.mjs'
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

let cachedSource = null
let cachedModule = null

function fail(msg) {
  throw new Error(`oráculo ${ORACLE_COMMIT}:${ORACLE_REL} indisponível — fail-closed: ${msg}`)
}

export function readRef(ref) {
  let text
  try {
    text = execFileSync('git', ['show', ref], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      cwd: repoRoot,
    })
  } catch (e) {
    fail(e.message)
  }
  if (typeof text !== 'string' || text.length === 0) fail(`saída vazia para ${ref}`)
  return text
}

export function oracleSource() {
  if (cachedSource !== null) return cachedSource
  cachedSource = readRef(`${ORACLE_COMMIT}:${ORACLE_REL}`)
  return cachedSource
}

export async function oracleModule() {
  if (cachedModule) return cachedModule
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-oracle-'))
  for (const name of ['install.mjs', 'zone.mjs']) {
    const text = readRef(`${ORACLE_COMMIT}:installer/${name}`)
    fs.writeFileSync(path.join(dir, name), text, 'utf8')
  }
  cachedModule = await import(pathToFileURL(path.join(dir, 'install.mjs')).href)
  return cachedModule
}
