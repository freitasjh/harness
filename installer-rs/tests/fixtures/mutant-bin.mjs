#!/usr/bin/env node
// Anti-C1 — binário MUTANTE exit-preserving para prova ponta-a-ponta (ADR-003).
// Envolve o binário REAL (`contract-v1`), corrompe o envelope de saída e
// preserva o exit-code. NÃO toca em diffUnified isolado: a mutação entra pelo
// mesmo caminho de `prova()` usado nas 23 provas reais.
//
// MUTANT_MODE (default `all`):
//   all       → __MUTANT__ em todo result + MUTANTCODE em todo error.code
//   result    → só result corrompido
//   errorcode → só error.code corrompido
//   okflip    → ok invertido (resultado/erro preservados)
//   exit      → envelope intacto, exit-code divergente (0↔2)
//   date      → só `result.date` divergente (deve PASSAR em buildManifest:
//               normalizeSide remove esse único campo, simetricamente)
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REAL_BIN = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'target', 'debug', 'harness-installer',
)

let input = ''
for await (const chunk of process.stdin) input += chunk

const child = spawnSync(REAL_BIN, process.argv.slice(2), {
  input, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
})
if (!child.stdout || child.error) {
  process.stderr.write(String(child.stderr || child.error || 'mutante: sem stdout'))
  process.exit(child.status ?? 1)
}

let envelope
try { envelope = JSON.parse(child.stdout.trim()) } catch { envelope = null }
if (!envelope || typeof envelope !== 'object') {
  process.stdout.write(child.stdout)
  process.exit(child.status ?? 0)
}

const mode = process.env.MUTANT_MODE || 'all'
const corruptResult = (value) => ({ __MUTANT__: true, value })

if (mode === 'result' || mode === 'all') {
  if (envelope.ok) envelope.result = corruptResult(envelope.result)
}
if (mode === 'errorcode' || mode === 'all') {
  if (!envelope.ok && envelope.error && typeof envelope.error === 'object') {
    envelope.error.code = 'MUTANTCODE'
  }
}
if (mode === 'okflip') {
  envelope.ok = !envelope.ok
  envelope.result = envelope.result ?? corruptResult(null)
  envelope.error = envelope.error ?? { code: 'UNKNOWN' }
}
if (mode === 'date' && envelope.ok && envelope.result && typeof envelope.result === 'object') {
  envelope.result = { ...envelope.result, date: '2000-01-01T00:00:00.000Z' }
}

process.stdout.write(JSON.stringify(envelope))
if (mode === 'exit') process.exit(child.status === 0 ? 2 : 0)
process.exit(child.status ?? 0)
