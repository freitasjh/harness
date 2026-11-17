// PUB-04 + FU-ADR005-01 — teste ANTES da implementação (TDD).
// Tripla não casa: stderr com tripla detectada + MATRIZ DE ALVOS PUBLICADOS
// + ação corretiva; exit 1; stdout vazio; sem download/cargo/install.mjs.
// Execução: node --test packaging/wrapper/__tests__/fallback.spec.mjs

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WRAPPER = path.resolve(HERE, '..')
const SHIM = path.join(WRAPPER, 'shim.mjs')
const SCRATCH = '/tmp/opencode'

const read = (p) => fs.readFileSync(p, 'utf8')
const run = (shim) => spawnSync(process.execPath, [shim, 'contract-v1'], {
  input: '{"v":1,"op":"inventory","args":{},"answers":{},"target":null}\n',
  encoding: 'utf8',
  env: { ...process.env, PATH: os.tmpdir() },
})

function noPlatformBox(label) {
  const dir = fs.mkdtempSync(path.join(SCRATCH, `pub04-${label}-`))
  const shim = path.join(dir, 'shim.mjs')
  fs.copyFileSync(SHIM, shim)
  return { dir, shim, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) }
}

// ---------------------------------------------------------------------------
// PUB-04 — fallback de distribuição (falha não é contract-v1 / exit 2)
// ---------------------------------------------------------------------------

test('PUB-04: tripla sem pacote ⇒ exit 1, stdout vazio, sem download/cargo/segundo motor', () => {
  const box = noPlatformBox('basic')
  try {
    const r = run(box.shim)
    assert.equal(r.status, 1)
    assert.equal(r.stdout, '', 'stdout sem envelope')
    assert.doesNotMatch(r.stderr, /curl|wget|cargo|rustc|install\.mjs|execSync|spawnSync/i)
  } finally {
    box.cleanup()
  }
})

test('PUB-04: stderr traz (a) tripla detectada (plataforma/arch/libc)', () => {
  const box = noPlatformBox('triple')
  try {
    const r = run(box.shim)
    const head = r.stderr.split('\n')[0]
    assert.match(head, /nenhum pacote para/i)
    assert.match(r.stderr, new RegExp(process.platform, 'i'))
    assert.match(r.stderr, new RegExp(process.arch, 'i'))
    assert.match(r.stderr, /glibc|musl|n\/a/i)
  } finally {
    box.cleanup()
  }
})

test('FU-ADR005-01: stderr traz (b) MATRIZ DE ALVOS PUBLICADOS com os 3 alvos', () => {
  const box = noPlatformBox('matrix')
  try {
    const r = run(box.shim)
    assert.match(r.stderr, /MATRIZ DE ALVOS PUBLICADOS/)
    const wrapper = JSON.parse(read(path.join(WRAPPER, 'package.json')))
    for (const name of Object.keys(wrapper.optionalDependencies)) {
      assert.ok(r.stderr.includes(name), `matriz deve listar ${name}`)
    }
    for (const triple of ['linux-x64-gnu', 'linux-x64-musl', 'darwin-arm64']) {
      assert.ok(r.stderr.includes(triple), `matriz deve listar ${triple}`)
    }
  } finally {
    box.cleanup()
  }
})

test('PUB-04: stderr traz (c) ação corretiva', () => {
  const box = noPlatformBox('action')
  try {
    const r = run(box.shim)
    assert.match(r.stderr, /ACAO CORRETIVA/i)
    assert.match(r.stderr, /instale|reinstale/i)
    assert.match(r.stderr, /plataforma suportada/i)
  } finally {
    box.cleanup()
  }
})

test('PUB-04: matriz do shim não deriva — constante casa com optionalDependencies do wrapper', () => {
  const src = read(SHIM)
  const wrapper = JSON.parse(read(path.join(WRAPPER, 'package.json')))
  assert.match(src, /MATRIZ DE ALVOS PUBLICADOS/)
  for (const name of Object.keys(wrapper.optionalDependencies)) {
    assert.ok(src.includes(name), `constante da matriz deve conter ${name}`)
  }
  for (const marker of ['fetch(', 'curl', 'wget', 'node install.mjs', 'runInit', 'runDoctor']) {
    assert.equal(src.includes(marker), false, `marker proibido no shim: ${marker}`)
  }
})
