import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import {
  REGISTRY_MAPS, REGISTRY_MAP_DIGESTS, REGISTRY_ALL_DIGEST,
  AXIS_IDS, SKILLS_BY_AXIS, SKILLS_COMMON, RULES_BY_AXIS, RULES_COMMON, STACKS_FOR_EXCEPTIONS,
} from '../contract-registry.mjs'
import { oracleModule } from './oracle.mjs'

const sha = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex')
const names = ['AXIS_IDS', 'SKILLS_BY_AXIS', 'SKILLS_COMMON', 'RULES_BY_AXIS', 'RULES_COMMON', 'STACKS_FOR_EXCEPTIONS']
const root = path.resolve(new URL('..', import.meta.url).pathname, '..')

describe('RF-07 / item 8 — registry congelado byte-idêntico ao oráculo', () => {
  it('6 mapas com sha congelado (JSON.stringify, ordem de chaves preservada)', () => {
    for (const n of names) {
      assert.equal(sha(REGISTRY_MAPS[n]), REGISTRY_MAP_DIGESTS[n], `digest divergente: ${n}`)
    }
    assert.equal(sha(REGISTRY_MAPS), REGISTRY_ALL_DIGEST)
  })

  it('sha congelado confere com a identidade REAL do oráculo c63e333 (fail-closed)', async () => {
    const ora = await oracleModule()
    for (const n of names) assert.equal(sha(ora[n]), REGISTRY_MAP_DIGESTS[n], `oráculo divergente: ${n}`)
  })

  it('especificador de scripts/static-checks.mjs aponta para o registry (troca pós-prova)', () => {
    const src = fs.readFileSync(path.join(root, 'scripts/static-checks.mjs'), 'utf8')
    assert.ok(src.includes('from "../installer/contract-registry.mjs"'))
    assert.ok(!/from\s+['"]\.\.\/installer\/install\.mjs['"]/.test(src))
  })

  it('módulos lib/**/checks.mjs intactos: cdl←exports, inventory←declarations, refs←sem mapa', () => {
    for (const mod of ['cdl', 'inventory', 'refs']) {
      const src = fs.readFileSync(path.join(root, `.opencode/plugins/lib/${mod}/checks.mjs`), 'utf8')
      assert.ok(!/^\s*import\s[^;]*installer\//m.test(src), `${mod}: import runtime de installer/`)
    }
    const cdl = fs.readFileSync(path.join(root, '.opencode/plugins/lib/cdl/checks.mjs'), 'utf8')
    const inv = fs.readFileSync(path.join(root, '.opencode/plugins/lib/inventory/checks.mjs'), 'utf8')
    assert.ok(/function declaredAxis\(artifact, exports/.test(cdl))
    assert.ok(/declarations/.test(inv))
    const runner = fs.readFileSync(path.join(root, 'scripts/static-checks.mjs'), 'utf8')
    assert.ok(runner.includes('exports: CDL_EXPORTS'))
    assert.ok(runner.includes('declarations: INVENTORY_DECLARATIONS'))
    assert.ok(/skillAxis:\s*SKILLS_BY_AXIS/.test(runner))
  })

  it('valores congelados preservam o contrato medido', () => {
    assert.deepEqual(Object.keys(AXIS_IDS), ['backend', 'frontend'])
    assert.deepEqual(STACKS_FOR_EXCEPTIONS, { 'flutter+flutter': ['flutter', 'dart'] })
    assert.ok(SKILLS_COMMON.includes('node-architecture-specialist'))
    assert.deepEqual(RULES_BY_AXIS, {
      'frontend=react': ['frontend-coding-standards.md'],
      'frontend=vue': ['frontend-react-coding-standards.md'],
    })
    assert.equal(RULES_COMMON.length, 6)
  })
})
