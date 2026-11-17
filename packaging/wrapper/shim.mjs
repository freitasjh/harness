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

const TARGETS = Object.freeze([
  { key: 'linux-x64-gnu', name: '@harness/installer-linux-x64-gnu', triple: 'linux/x64/glibc' },
  { key: 'linux-x64-musl', name: '@harness/installer-linux-x64-musl', triple: 'linux/x64/musl' },
  { key: 'darwin-arm64', name: '@harness/installer-darwin-arm64', triple: 'darwin/arm64' },
])
const PLATFORM_PACKAGES = Object.freeze(Object.fromEntries(TARGETS.map((t) => [t.key, t.name])))

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
    const bin = manifest.bin
    const entry = typeof bin === 'string'
      ? bin
      : bin && (bin[BIN] ?? Object.values(bin)[0])
    if (!entry) return null
    return path.resolve(path.dirname(manifestPath), entry)
  } catch {
    return null
  }
}

function fallback(triple) {
  const detected = `${triple.platform}/${triple.arch}/${triple.libc ?? 'n/a'}`
  const lines = [
    `harness-installer: nenhum pacote para ${triple.key} (${detected}).`,
    'MATRIZ DE ALVOS PUBLICADOS:',
    ...TARGETS.map((t) => `  ${t.key.padEnd(15)} ${t.name}  [${t.triple}]`),
    'ACAO CORRETIVA: instale o pacote da plataforma deste host ou reinstale harness-installer em uma plataforma suportada.',
    'Sem rede e sem compilacao: o binario e distribuido pronto pelo registry npm.',
  ]
  process.stderr.write(`${lines.join('\n')}\n`)
  process.exitCode = 1
}

function main() {
  const triple = tripleOf()
  const bin = locate(triple.key)
  if (!bin) {
    fallback(triple)
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
