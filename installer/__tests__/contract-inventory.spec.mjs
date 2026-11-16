import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CONTRACT_VERSION,
  SUBCOMMAND,
  EXIT,
  DESTINATIONS,
  INTERNAL_EXPORTS,
  OP_NAMES,
  CONSUMER_ROUTES,
  destinationOf,
  assertInventory,
} from '../contract-inventory.mjs'
import { REGISTRY_MAPS, REGISTRY_DATA } from '../contract-registry.mjs'

describe('RF-08 / item 9 — inventário congelado 22 consumidores + 75 exports', () => {
  it('contrato é contract-v1, versão 1, códigos 0/1/2', () => {
    assert.equal(CONTRACT_VERSION, 1)
    assert.equal(SUBCOMMAND, 'contract-v1')
    assert.deepEqual(EXIT, { OK: 0, FAILURE: 1, PROTOCOL: 2 })
  })

  it('5 classes de destino somam 75 nomes únicos', () => {
    const all = Object.values(DESTINATIONS).flat()
    assert.equal(all.length, 75)
    assert.equal(new Set(all).size, 75)
    assert.deepEqual(Object.fromEntries(Object.entries(DESTINATIONS).map(([k, v]) => [k, v.length])), {
      'D-INJ': 6, 'D-DATA': 9, 'D-PURE': 29, 'D-ENGINE': 23, 'D-TUI': 8,
    })
  })

  it('20 exports internos não são superfície de compatibilidade', () => {
    assert.equal(INTERNAL_EXPORTS.length, 20)
    assert.equal(new Set(INTERNAL_EXPORTS).size, 20)
    for (const n of INTERNAL_EXPORTS) assert.equal(destinationOf(n), null)
  })

  it('registry cobre D-INJ (6) e D-DATA (9) sem nome fantasma', () => {
    for (const n of DESTINATIONS['D-INJ']) assert.ok(n in REGISTRY_MAPS, `mapa ${n} ausente`)
    for (const n of DESTINATIONS['D-DATA']) assert.ok(n in REGISTRY_DATA, `dado ${n} ausente`)
    assert.equal(Object.keys(REGISTRY_MAPS).length, 6)
    assert.equal(Object.keys(REGISTRY_DATA).length, 9)
  })

  it('op = nome do export: D-ENGINE (23) + D-TUI (8) = 31, zero vocabulário novo', () => {
    assert.equal(OP_NAMES.length, 31)
    assert.deepEqual(OP_NAMES, [...DESTINATIONS['D-ENGINE'], ...DESTINATIONS['D-TUI']])
    assert.equal(new Set(OP_NAMES).size, 31)
  })

  it('22 consumidores com grupo, adapter e prova — nenhum órfão', () => {
    assert.equal(CONSUMER_ROUTES.length, 22)
    assert.deepEqual(Object.fromEntries(['G-INJ', 'G-DOGFOOD', 'G-ORACLE-DATA', 'G-CLI-TUI'].map((g) => [g, CONSUMER_ROUTES.filter((r) => r.group === g).length])), {
      'G-INJ': 3, 'G-DOGFOOD': 2, 'G-ORACLE-DATA': 4, 'G-CLI-TUI': 13,
    })
    for (const r of CONSUMER_ROUTES) {
      assert.ok(r.file && r.group && r.adapter && r.proof, JSON.stringify(r))
      assert.ok(r.adapter === 'contract-registry.mjs' || r.adapter === 'installer-contract.mjs' || r.adapter === 'oráculo-materializado', r.adapter)
    }
  })

  it('destinationOf resolves cada um dos 75 e assertInventory é idempotente', () => {
    for (const [cls, names] of Object.entries(DESTINATIONS)) {
      for (const n of names) assert.equal(destinationOf(n), cls)
    }
    assert.deepEqual(assertInventory(), { consumers: 22, exports: 75, internal: 20, ops: 31 })
  })
})
