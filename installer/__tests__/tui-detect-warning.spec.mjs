// ADR-004 batch 3 — correção do 🟠 do review final.
// detect() deve emitir o warning R9 do oráculo (install.mjs:2182) quando o
// pubspec declara flutter e `flutter` NÃO resolve no PATH. Veredito congelado
// wizard.spec.mjs NÃO é alterado; este é um teste novo, focado só em warnings.
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { detect } from '../installer-contract.mjs'

const R9 = "'flutter' nao resolve no PATH (R9): confirme o comando da suite."
const dirs = []
after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }) })

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adr004-detect-warn-'))
  const bin = path.join(root, 'emptybin')
  fs.mkdirSync(bin)
  fs.writeFileSync(path.join(root, 'pubspec.yaml'), 'name: flutter_demo\nflutter:\n  uses-material-design: true\n')
  dirs.push(root)
  return { root, bin }
}

function withPath(value, fn) {
  const original = process.env.PATH
  process.env.PATH = value
  try { return fn() } finally { process.env.PATH = original }
}

describe('TUI-06 — detect() warning R9 (paridade com install.mjs:2182)', () => {
  it('pubspec flutter sem flutter no PATH => warning R9 presente', () => {
    const { root, bin } = fixture()
    const r = withPath(bin, () => detect(root))
    assert.equal(r.hasPubspec, true)
    assert.equal(r.declaresFlutter, true)
    assert.equal(r.suggestedStack, 'flutter')
    assert.deepEqual(r.sources, [
      { field: 'project', file: 'pubspec.yaml', line: 1 },
      { field: 'stack', file: 'pubspec.yaml', line: 2 },
    ])
    assert.deepEqual(r.warnings, [R9], 'warning R9 idêntico ao oráculo')
  })

  it('pubspec flutter COM flutter no PATH => nenhum warning', () => {
    const { root, bin } = fixture()
    fs.writeFileSync(path.join(bin, 'flutter'), '#!/bin/sh\nexit 0\n')
    fs.chmodSync(path.join(bin, 'flutter'), 0o755)
    const r = withPath(bin, () => detect(root))
    assert.equal(r.suggestedStack, 'flutter')
    assert.deepEqual(r.warnings, [], 'commandResolves(true) suprime o warning')
  })
})
