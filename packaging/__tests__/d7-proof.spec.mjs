// VAL-01 — teste ANTES da implementação (TDD).
// O RELATÓRIO é evidência auto-declarada: prova é a contraprova (gate reexecuta).
// Este teste trava a FORMA do relatório D7 (comandos reais, hash real, tempo medido,
// rito ADR-002 reutilizado sem nova assinatura, 2 follow-ups fechados com prova).
// Execução: node --test packaging/__tests__/d7-proof.spec.mjs

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const REPORT = path.join(ROOT, 'harness', 'prd-installer-rust-adr-005.json')

const read = (p) => fs.readFileSync(p, 'utf8')
const load = () => JSON.parse(read(REPORT))

test('VAL-01: RELATÓRIO existe e satisfaz o schema canônico (campos obrigatórios)', () => {
  const r = load()
  for (const key of ['version', 'demand', 'agent', 'phase', 'gitSha', 'commands', 'counts',
    'evaluation', 'brainStore', 'cleanup', 'selfReported']) {
    assert.ok(key in r, `campo obrigatório ausente: ${key}`)
  }
  assert.equal(r.version, 1)
  assert.equal(r.demand, 'prd-installer-rust-adr-005')
  assert.ok(r.commands.length >= 9, 'pelo menos 9 comandos reais (DoD VAL-01)')
  for (const c of r.commands) {
    assert.match(c.stdoutHash, /^sha256:[0-9a-f]{64}$/, `hash real de: ${c.cmd}`)
    assert.equal(typeof c.durationMs, 'number')
    assert.ok(c.durationMs >= 0)
    assert.equal(typeof c.exitCode, 'number')
  }
})

test('VAL-01: gitSha e durationMs têm BASE declarada (não estimativa)', () => {
  const r = load()
  assert.match(r.gitSha, /^[0-9a-f]{40}$/)
  assert.ok(r.gitShaBasis && /HEAD|antes do commit|medid/i.test(r.gitShaBasis))
  assert.ok(r.timingBasis && /medid/i.test(r.timingBasis))
})

test('VAL-01: comandos D7 presentes — PATH sem cargo/rustc, Node>=20, contrato, grep build, V15', () => {
  const r = load()
  const all = r.commands.map((c) => c.cmd).join('\n')
  for (const needle of [
    "command -v cargo || echo 'no cargo'",
    "command -v rustc || echo 'no rustc'",
    'node -v',
    'npm install',
    'contract-v1',
    'cargo build|rustc',
    'static-checks.mjs',
  ]) {
    assert.ok(all.includes(needle), `comando D7 ausente: ${needle}`)
  }
  assert.equal(r.d7.commandVCargo, 'no cargo')
  assert.equal(r.d7.commandVRustc, 'no rustc')
  assert.match(r.d7.nodeVersion, /^v(2[0-9]|[3-9][0-9])\./)
  assert.equal(r.d7.envelopeV, 1)
  assert.equal(r.d7.okType, 'boolean')
  assert.equal(r.d7.grepBuildHits, 0)
  assert.equal(r.d7.v15Network, 0)
})

test('FU-ADR005-01 e FU-ADR005-02: fechados com prova no RELATÓRIO', () => {
  const r = load()
  const ids = r.followUpsClosed.map((f) => f.id).sort()
  assert.deepEqual(ids, ['FU-ADR005-01', 'FU-ADR005-02'])
  for (const f of r.followUpsClosed) {
    assert.equal(f.status, 'closed')
    assert.ok(f.proof && f.proof.length > 40, `prova de ${f.id} não vazia`)
  }
  const byId = Object.fromEntries(r.followUpsClosed.map((f) => [f.id, f.proof]))
  assert.match(byId['FU-ADR005-01'], /MATRIZ DE ALVOS PUBLICADOS/)
  assert.match(byId['FU-ADR005-02'], /exports|package\.json/i)
})

test('VAL-01: rito ADR-002 9fa4530b REUTILIZADO — nenhum Veredito assinado por este agente', () => {
  const r = load()
  assert.equal(r.literalRito.sha, '9fa4530bbe0d431781a159cced28c011e1d94a8abea5ca1cc8465608976552f0')
  assert.equal(r.literalRito.reused, true)
  assert.equal(r.literalRito.writtenByThisAgent, false)
  assert.match(r.literalRito.source, /prd-installer-rust-adr-002\.json/)
  assert.equal(r.literalRito.verdictWrittenHere, null)
})

test('VAL-01: invariantes congelados — selo c904f1c5, 4 etapas, 12 presets, sem valor novo', () => {
  const r = load()
  assert.equal(r.frozen.sealSuiteFull, 'c904f1c5d7e9369cbeafa1d7721973b53c0eeb558e22d182679a14287aa649a2')
  assert.equal(r.frozen.sealUnit, 'daba8c5465bffe061738235b274c497a4e8e761e41c5e79d4c671a72231cffc7')
  assert.equal(r.frozen.suiteSteps, 4)
  assert.equal(r.frozen.presets, 12)
  assert.equal(r.frozen.newPreset, false)
  assert.equal(r.frozen.newOp, false)
  assert.equal(r.frozen.newKey, false)
  assert.equal(r.frozen.rustInContraprova, false)
})
