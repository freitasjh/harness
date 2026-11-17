// PUB-03 + FU-ADR005-02 — teste ANTES da implementação (TDD).
// Cada pacote de plataforma: os/cpu/libc, files só binário, bin próprio,
// versão igual à do wrapper, exports./package.json para o require.resolve do shim.
// Execução: node --test packaging/platforms/__tests__/platforms.spec.mjs

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PACKAGING = path.resolve(HERE, '../..')
const PLATFORMS = path.join(PACKAGING, 'platforms')
const WRAPPER = path.join(PACKAGING, 'wrapper')
const SCRATCH = '/tmp/opencode'

const MATRIX = [
  { dir: 'linux-x64-gnu', name: '@harness/installer-linux-x64-gnu', binName: 'harness-installer-linux-x64-gnu', os: ['linux'], cpu: ['x64'], libc: ['glibc'] },
  { dir: 'linux-x64-musl', name: '@harness/installer-linux-x64-musl', binName: 'harness-installer-linux-x64-musl', os: ['linux'], cpu: ['x64'], libc: ['musl'] },
  { dir: 'darwin-arm64', name: '@harness/installer-darwin-arm64', binName: 'harness-installer-darwin-arm64', os: ['darwin'], cpu: ['arm64'], libc: ['glibc'] },
]

const read = (p) => fs.readFileSync(p, 'utf8')

// ---------------------------------------------------------------------------
// PUB-03 — matriz de alvos publicados
// ---------------------------------------------------------------------------

test('PUB-03: matriz cobre linux-x64-gnu, linux-x64-musl e darwin-arm64', () => {
  const dirs = fs.readdirSync(PLATFORMS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('__'))
    .map((e) => e.name)
    .sort()
  assert.deepEqual(dirs, MATRIX.map((m) => m.dir).sort())
})

test('PUB-03: cada pacote declara os/cpu/libc, bin próprio, files só binário e versão do wrapper', () => {
  const wrapper = JSON.parse(read(path.join(WRAPPER, 'package.json')))
  for (const target of MATRIX) {
    const file = path.join(PLATFORMS, target.dir, 'package.json')
    const p = JSON.parse(read(file))
    assert.equal(p.name, target.name, `${target.dir}: nome`)
    assert.equal(p.version, wrapper.version, `${target.dir}: versão acompanha o wrapper`)
    assert.deepEqual(p.os, target.os, `${target.dir}: os`)
    assert.deepEqual(p.cpu, target.cpu, `${target.dir}: cpu`)
    assert.deepEqual(p.libc, target.libc, `${target.dir}: libc`)
    assert.equal(p.bin[target.binName], 'bin/harness-installer', `${target.dir}: bin próprio`)
    assert.equal(p.bin['harness-installer'], undefined,
      `${target.dir}: bin não colide com o do wrapper (npm .bin)`)
    assert.notEqual(target.binName, 'harness-installer')
    assert.deepEqual(p.files, ['bin/harness-installer'], `${target.dir}: files só o binário`)
    assert.equal(p.engines.node, '>=20', `${target.dir}: engines`)
    assert.equal(wrapper.optionalDependencies[target.name], p.version, `${target.dir}: registered no wrapper`)
  }
})

test('PUB-03: nenhum script de build/download nem install.mjs nos pacotes', () => {
  for (const target of MATRIX) {
    const raw = read(path.join(PLATFORMS, target.dir, 'package.json'))
    const p = JSON.parse(raw)
    assert.equal(p.scripts, undefined, `${target.dir}: nenhum script`)
    assert.equal(raw.includes('install.mjs'), false, `${target.dir}: install.mjs ausente`)
    assert.equal(new RegExp(/cargo|rustc|postinstall|preinstall|prepare|download/i).test(raw), false,
      `${target.dir}: nenhum marcador de compilação/download`)
  }
  const found = spawnSync('find', ['packaging', '-name', 'install.mjs'], {
    cwd: path.resolve(PACKAGING, '..'), encoding: 'utf8',
  })
  assert.equal(found.status, 0)
  assert.equal(found.stdout.trim(), '', 'find packaging -name install.mjs ⇒ vazio')
})

test('PUB-03: README da matriz declara alvos, versionamento e ausência de build', () => {
  const readme = read(path.join(PLATFORMS, 'README.txt'))
  for (const target of MATRIX) {
    assert.ok(readme.includes(target.name), `README cita ${target.name}`)
  }
  assert.match(readme, /sem (build|compilação)/i)
  assert.match(readme, /exports/i)
})

// ---------------------------------------------------------------------------
// FU-ADR005-02 — exports ./package.json (require.resolve do shim)
// ---------------------------------------------------------------------------

test('FU-ADR005-02: require.resolve(<pacote>/package.json) resolve com exports declarado', () => {
  const box = fs.mkdtempSync(path.join(SCRATCH, 'fu02-ok-'))
  try {
    for (const target of MATRIX) {
      const root = path.join(box, 'node_modules', '@harness', `installer-${target.dir}`)
      fs.mkdirSync(root, { recursive: true })
      fs.copyFileSync(path.join(PLATFORMS, target.dir, 'package.json'), path.join(root, 'package.json'))
      const req = createRequire(path.join(box, 'probe.cjs'))
      const resolved = req.resolve(`${target.name}/package.json`)
      assert.equal(resolved, path.join(root, 'package.json'))
      const p = JSON.parse(read(path.join(root, 'package.json')))
      assert.equal(p.exports['./package.json'], './package.json')
    }
  } finally {
    fs.rmSync(box, { recursive: true, force: true })
  }
})

test('FU-ADR005-02: ataque — exports sem ./package.json derruba o require.resolve do shim', () => {
  const box = fs.mkdtempSync(path.join(SCRATCH, 'fu02-atk-'))
  try {
    const target = MATRIX[0]
    const root = path.join(box, 'node_modules', '@harness', `installer-${target.dir}`)
    fs.mkdirSync(root, { recursive: true })
    const p = JSON.parse(read(path.join(PLATFORMS, target.dir, 'package.json')))
    p.exports = { '.': './bin/harness-installer' }
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(p))
    const req = createRequire(path.join(box, 'probe.cjs'))
    assert.throws(() => req.resolve(`${target.name}/package.json`), /ERR_PACKAGE_PATH_NOT_EXPORTED/)
  } finally {
    fs.rmSync(box, { recursive: true, force: true })
  }
})
