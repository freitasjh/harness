import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { oracleSource, readRef, ORACLE_COMMIT, ORACLE_REL } from './oracle.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('oráculo materializado c63e333 — identidade e fail-closed', () => {
  it('oracleSource é byte-igual a git show do commit congelado', () => {
    const expected = execFileSync('git', ['show', `${ORACLE_COMMIT}:${ORACLE_REL}`], {
      encoding: 'utf8',
      cwd: root,
    })
    assert.equal(oracleSource(), expected)
  })

  it('ref inexistente lança fail-closed (nunca fallback silencioso)', () => {
    assert.throws(
      () => readRef('refs/heads/__oracle_inexistente__:installer/install.mjs'),
      /fail-closed/,
    )
  })
})
