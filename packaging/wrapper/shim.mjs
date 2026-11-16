#!/usr/bin/env node
// PUB-02 — localizador/lançador do binário Rust. NÃO é motor: nenhum init,
// nenhum doctor, nenhum upgrade, nenhuma decisão de instalação. O contrato
// contract-v1 pertence ao binário; aqui só se resolve o pacote da plataforma
// e se repassam stdin, stdout, stderr e o código de saída.

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const BIN = 'harness-installer'

const PLATFORM_PACKAGES = Object.freeze({
  'linux-x64-gnu': '@harness/installer-linux-x64-gnu',
  'linux-x64-musl': '@harness/installer-linux-x64-musl',
  'darwin-arm64': '@harness/installer-darwin-arm64',
})

function tripleOf() {
  const platform = process.platform
  const arch = process.arch
  let libc = null
  if (platform === 'linux') {
    try {
      const header = process.report.getReport().header
      libc = header && typeof header.glibcVersionRuntime === 'string' ? 'glibc' : 'musl'
    } catch {
      libc = null
    }
  }
  const suffix = libc === 'glibc' ? 'gnu' : libc === 'musl' ? 'musl' : 'unknown'
  const key = platform === 'linux'
    ? `${platform}-${arch}-${suffix}`
    : `${platform}-${arch}`
  return { platform, arch, libc, key }
}

function locate(key) {
  const name = PLATFORM_PACKAGES[key]
  if (!name) return null
  try {
    const manifestPath = require.resolve(`${name}/package.json`)
    const manifest = require(manifestPath)
    const entry = typeof manifest.bin === 'string'
      ? manifest.bin
      : manifest.bin && manifest.bin[BIN]
    if (!entry) return null
    return path.resolve(path.dirname(manifestPath), entry)
  } catch {
    return null
  }
}

function main() {
  const triple = tripleOf()
  const bin = locate(triple.key)
  if (!bin) {
    const libc = triple.libc ?? 'n/a'
    process.stderr.write(
      `harness-installer: nenhum pacote para ${triple.key} ` +
      `(${triple.platform}/${triple.arch}/${libc}). Instale uma plataforma suportada.\n`,
    )
    process.exitCode = 1
    return
  }
  const child = spawn(bin, process.argv.slice(2), { stdio: 'inherit' })
  child.on('error', (err) => {
    process.stderr.write(`harness-installer: falha ao lançar o binário: ${err.message}\n`)
    process.exitCode = 1
  })
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    else process.exitCode = code
  })
}

main()
