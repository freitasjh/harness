// PUB-01/PUB-02 — teste ANTES da implementação (TDD).
// Escopo: wrapper package.json e shim localizador. Nenhum motor, nenhuma escrita.
// Execução: node --test packaging/wrapper/__tests__/wrapper.spec.mjs

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WRAPPER = path.resolve(HERE, '..')
const PKG_JSON = path.join(WRAPPER, 'package.json')
const SHIM = path.join(WRAPPER, 'shim.mjs')
const SCRATCH_ROOT = '/tmp/opencode'

const read = (p) => fs.readFileSync(p, 'utf8')
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts })

function sandbox(label) {
  const dir = fs.mkdtempSync(path.join(SCRATCH_ROOT, `pub02-${label}-`))
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  }
}

function installFakePlatform(dir, { key = 'linux-x64-gnu' } = {}) {
  const pkg = `@harness/installer-${key}`
  const root = path.join(dir, 'node_modules', '@harness', `installer-${key}`)
  const bindir = path.join(root, 'bin')
  fs.mkdirSync(bindir, { recursive: true })
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: pkg,
    version: '1.0.0',
    bin: { 'harness-installer': 'bin/harness-installer' },
    os: ['linux'],
    cpu: ['x64'],
    libc: ['glibc'],
  }, null, 2) + '\n')
  const bin = path.join(bindir, 'harness-installer')
  fs.writeFileSync(bin, [
    '#!/bin/sh',
    'cat >/dev/null',
    "printf 'fake progress\\n' >&2",
    "printf '%s' \"$FAKE_STDOUT\"",
    'exit "${FAKE_EXIT:-0}"',
    '',
  ].join('\n'))
  fs.chmodSync(bin, 0o755)
  return { root, bin }
}

// ---------------------------------------------------------------------------
// PUB-01 — wrapper package.json
// ---------------------------------------------------------------------------

test('PUB-01: package.json declara bin, engines>=20 e optionalDependencies da tripla', () => {
  const p = JSON.parse(read(PKG_JSON))
  assert.equal(p.name, 'harness-installer')
  assert.equal(p.version, '1.0.0')
  assert.equal(p.bin['harness-installer'], 'shim.mjs')
  assert.equal(p.engines.node, '>=20')
  assert.ok(p.optionalDependencies && typeof p.optionalDependencies === 'object')
  for (const key of ['@harness/installer-linux-x64-gnu', '@harness/installer-linux-x64-musl', '@harness/installer-darwin-arm64']) {
    assert.equal(p.optionalDependencies[key], p.version, `versão de ${key} acompanha o wrapper`)
  }
})

test('PUB-01: nenhum script de build/install/postinstall no pacote', () => {
  const p = JSON.parse(read(PKG_JSON))
  const scripts = p.scripts || {}
  for (const name of ['build', 'install', 'postinstall', 'preinstall', 'prepare']) {
    assert.equal(scripts[name], undefined, `script proibido: ${name}`)
  }
  const hits = (read(PKG_JSON).match(/cargo build|rustc |npm run build/g) || []).length
  assert.equal(hits, 0)
})

test('PUB-01: install.mjs não é entrypoint nem embarcado', () => {
  const text = read(PKG_JSON)
  assert.equal(text.includes('install.mjs'), false)
  const p = JSON.parse(text)
  assert.ok(p.files && p.files.includes('shim.mjs'))
  assert.equal(p.files.includes('__tests__'), false)
})

// ---------------------------------------------------------------------------
// PUB-02 — shim localizador/lançador, não motor
// ---------------------------------------------------------------------------

test('PUB-02: shim não implementa motor, não grava, não faz rede', () => {
  const src = read(SHIM)
  const forbidden = [
    'applyMerge', 'writeFileSync', 'writeFile', 'appendFile', 'mkdirSync',
    'node:fs', 'runInit', 'runDoctor', 'runUpgrade', 'install.mjs',
    'curl', 'wget', 'fetch(', 'execSync', 'spawnSync',
  ]
  for (const marker of forbidden) {
    assert.equal(src.includes(marker), false, `marker de motor/rede/escrita no shim: ${marker}`)
  }
})

test('PUB-02: libc detectada por sinal do runtime, não por execução cega', () => {
  const src = read(SHIM)
  assert.match(src, /process\.report\.getReport\(\)/)
  assert.match(src, /glibcVersionRuntime/)
})

test('PUB-02: stdin→binário, stdout envelope, stderr progresso, exit 0/1/2 repassados', () => {
  const box = sandbox('forward')
  try {
    const shim = path.join(box.dir, 'shim.mjs')
    fs.copyFileSync(SHIM, shim)
    installFakePlatform(box.dir)
    const envelope = '{"v":1,"ok":true,"op":"contract-v1","result":{"x":1}}'
    for (const code of [0, 1, 2]) {
      const r = run(process.execPath, [shim, 'contract-v1'], {
        input: '{"v":1,"op":"contract-v1"}\n',
        env: { ...process.env, FAKE_STDOUT: envelope, FAKE_EXIT: String(code) },
      })
      assert.equal(r.stdout, envelope, `stdout byte-a-byte (exit ${code})`)
      assert.match(r.stderr, /fake progress/, `stderr progresso (exit ${code})`)
      assert.equal(r.status, code, `exit repassado (${code})`)
    }
  } finally {
    box.cleanup()
  }
})

test('PUB-02: pacote ausente ⇒ exit 1, stdout sem envelope, sem download/cargo/motor', () => {
  const box = sandbox('missing')
  try {
    const shim = path.join(box.dir, 'shim.mjs')
    fs.copyFileSync(SHIM, shim)
    const r = run(process.execPath, [shim, 'contract-v1'], {
      input: '{"v":1,"op":"contract-v1"}\n',
      env: { ...process.env, PATH: os.tmpdir() },
    })
    assert.equal(r.status, 1)
    assert.equal(r.stdout, '')
    assert.match(r.stderr, /linux|x64|glibc|instale/i)
    assert.doesNotMatch(r.stderr, /curl|wget|cargo|install\.mjs/i)
  } finally {
    box.cleanup()
  }
})
