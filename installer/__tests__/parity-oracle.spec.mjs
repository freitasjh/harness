// parity-oracle.spec.mjs — ADR-002 (PRD-3): mecanismo de verificação sem tautologia.
// TDD FIRST. Oráculo = c63e333 (anterior ao sujeito, imutável, legível sem Rust).
// Cada predicado SI-1..SI-6 provado por mutação que o derruba (não apenas verde).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ORACLE_COMMIT,
  ORACLE_FULL,
  ORACLE_BLOB_SHA256,
  FIXTURE_SOURCE_SHA256,
  assertOracleIdentity,
  materializeOracle,
  readOracleSource,
  ritualVerdict,
  parseRitual,
  isLiteralProven,
  si1_configByteEqual,
  si2_payloadDifferential,
  si3_dryRunZeroWrites,
  si4_transcriptMarkers,
  si5_checksManifestParity,
  si6_noNewKeys,
  assertNoInstaAccept,
  measurement,
  rederiveCommand,
} from '../parity-oracle.mjs'

const SOURCE = 'const VERSION = "1.0.0"\n// oráculo congelado c63e333\n'

describe('identidade do oráculo — fail-closed, nunca tautologia', () => {
  it('aceita fonte byte-igual ao SHA congelado com proveniência git-object', () => {
    const meta = assertOracleIdentity({
      source: SOURCE,
      provenance: `git-object:${ORACLE_COMMIT}`,
      expectedSha: FIXTURE_SOURCE_SHA256,
    })
    assert.equal(meta.sha256, FIXTURE_SOURCE_SHA256)
    assert.equal(meta.oraculo, ORACLE_COMMIT)
    assert.match(meta.iso8601, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('MUTAÇÃO: 1 byte na fonte derruba identidade (oráculo regenerado não passa)', () => {
    assert.throws(
      () => assertOracleIdentity({
        source: SOURCE.replace('1.0.0', '9.9.9'),
        provenance: `git-object:${ORACLE_COMMIT}`,
        expectedSha: FIXTURE_SOURCE_SHA256,
      }),
      /oráculo divergente/,
    )
  })

  it('MUTAÇÃO: proveniência "subject" (oráculo derivado do sujeito) reprova', () => {
    assert.throws(
      () => assertOracleIdentity({ source: SOURCE, provenance: 'subject', expectedSha: FIXTURE_SOURCE_SHA256 }),
      /proveniência/,
    )
  })

  it('fonte vazia reprova (sem fallback silencioso)', () => {
    assert.throws(
      () => assertOracleIdentity({ source: '', provenance: `git-object:${ORACLE_COMMIT}`, expectedSha: FIXTURE_SOURCE_SHA256 }),
      /fail-closed/,
    )
  })
})

describe('rito do literal — assinatura humana com sha antes de baseline', () => {
  const verdict = ritualVerdict({
    sha256: ORACLE_BLOB_SHA256,
    iso8601: '2026-11-16T12:00:00.000Z',
    oraculo: ORACLE_COMMIT,
  })

  it('assa exatamente Veredito: validated literal <sha256> <ISO-8601> <oráculo>', () => {
    assert.equal(verdict, `Veredito: validated literal ${ORACLE_BLOB_SHA256} 2026-11-16T12:00:00.000Z ${ORACLE_COMMIT}`)
  })

  it('parse extrai sha/iso/oráculo de assinatura válida', () => {
    assert.deepEqual(parseRitual(verdict), {
      sha256: ORACLE_BLOB_SHA256,
      iso8601: '2026-11-16T12:00:00.000Z',
      oraculo: ORACLE_COMMIT,
    })
  })

  it('sem assinatura, asserção dependente NÃO conta como prova', () => {
    assert.equal(isLiteralProven({ validationVerdict: '' }), false)
    assert.equal(isLiteralProven({}), false)
    assert.equal(isLiteralProven({ validationVerdict: 'aprovado verbalmente' }), false)
  })

  it('MUTAÇÃO: sha trocado na assinatura reprova mesmo com formato válido', () => {
    assert.equal(isLiteralProven({ validationVerdict: verdict.replace(ORACLE_BLOB_SHA256, 'a'.repeat(64)) }), false)
  })

  it('assinatura íntegra prova o literal', () => {
    assert.equal(isLiteralProven({ validationVerdict: verdict }), true)
  })
})

describe('SI-1 config byte-equal (9+2 medido, 12/12 meta re-derivável)', () => {
  const oracle = { node: '{"commands":{"unit":"node --test"}}', rust: '{"commands":{"unit":"node --test"}}' }
  it('happy: chaves+valores iguais passam', () => {
    assert.equal(si1_configByteEqual({ ...oracle }, oracle).pass, true)
  })
  it('MUTAÇÃO: 1 valor de config diferente derruba SI-1', () => {
    const subject = { ...oracle, rust: '{"commands":{"unit":"cargo test"}}' }
    const r = si1_configByteEqual(subject, oracle)
    assert.equal(r.pass, false)
    assert.deepEqual(r.mismatches, ['rust'])
  })
})

describe('SI-2 payload differential (caminhos+bodies)', () => {
  const oracle = { node: 'hash-a', rust: 'hash-b' }
  it('happy: hashes ordenados idênticos passam', () => {
    assert.equal(si2_payloadDifferential({ ...oracle }, oracle).pass, true)
  })
  it('MUTAÇÃO: body alterado ou arquivo extra derruba SI-2', () => {
    assert.equal(si2_payloadDifferential({ node: 'hash-a', rust: 'hash-X' }, oracle).pass, false)
    const extra = si2_payloadDifferential({ ...oracle, novo: 'hash-c' }, oracle)
    assert.equal(extra.pass, false)
    assert.deepEqual(extra.extra, ['novo'])
  })
})

describe('SI-3 dry-run 0 writes', () => {
  it('happy: hash antes=depois e porcelain vazio passam', () => {
    assert.equal(si3_dryRunZeroWrites({ beforeHash: 'abc', afterHash: 'abc', porcelain: '' }).pass, true)
  })
  it('MUTAÇÃO: 1 write ou 1 arquivo untracked derruba SI-3', () => {
    assert.equal(si3_dryRunZeroWrites({ beforeHash: 'abc', afterHash: 'def', porcelain: '' }).pass, false)
    assert.equal(si3_dryRunZeroWrites({ beforeHash: 'abc', afterHash: 'abc', porcelain: '?? x' }).pass, false)
  })
})

describe('SI-4 transcript W0..W7/W2m com 5 marcadores', () => {
  const markers = ['W0 pre-flight', 'W2m tipo de projeto', 'W2m frontend', 'W3', 'W7']
  const oracleTranscript = markers.join('\n')
  it('happy: 5 marcadores presentes e byte-igual ao oráculo', () => {
    assert.equal(si4_transcriptMarkers({ transcript: oracleTranscript, oracleTranscript }).pass, true)
  })
  it('MUTAÇÃO: marcador ausente derruba SI-4', () => {
    const t = oracleTranscript.replace('W7', '')
    const r = si4_transcriptMarkers({ transcript: t, oracleTranscript })
    assert.equal(r.pass, false)
    assert.deepEqual(r.missing, ['W7'])
  })
  it('MUTAÇÃO: texto diverge do transcript congelado derruba SI-4', () => {
    assert.equal(si4_transcriptMarkers({ transcript: oracleTranscript + '\nlixo', oracleTranscript }).pass, false)
  })
})

describe('SI-5 checks/manifesto mesmos campos/vereditos', () => {
  const oracle = { V18: 'baseline=1', V19: 'consumer=21', V20: 'baseline=0' }
  it('happy: campos e vereditos idênticos passam', () => {
    assert.equal(si5_checksManifestParity({ ...oracle }, oracle).pass, true)
  })
  it('MUTAÇÃO: 1 veredito alterado derruba SI-5', () => {
    assert.equal(si5_checksManifestParity({ ...oracle, V20: 'baseline=9' }, oracle).pass, false)
  })
})

describe('SI-6 nada novo sem §16', () => {
  const protectedPaths = ['harness.config.json', '.agents/rules/**', '.opencode/plugins/**']
  it('happy: diff só em paths não-protegidos passa', () => {
    assert.equal(si6_noNewKeys({ diffNames: ['installer/parity-oracle.mjs'], protectedPaths }).pass, true)
  })
  it('MUTAÇÃO: nova chave/comando em path protegido derruba SI-6', () => {
    const r = si6_noNewKeys({ diffNames: ['harness.config.json', 'installer/x.mjs'], protectedPaths })
    assert.equal(r.pass, false)
    assert.deepEqual(r.violations, ['harness.config.json'])
  })
})

describe('insta só revisor — accept cego proibido', () => {
  it('comando de aceitação cega do insta reprova (regex montada, sem literal no arquivo)', () => {
    const cmd = ['cargo', 'insta', 'accept'].join(' ')
    assert.throws(() => assertNoInstaAccept(`run ${cmd}`), /insta/)
  })
  it('menção em prosa de revisão é permitida (só comando é proibido)', () => {
    assert.equal(assertNoInstaAccept('insta como revisor de diff'), true)
  })
})

describe('9+2 é medição; 12/12 é meta re-derivável', () => {
  it('measurement declara 9 byte-equal + 2 parciais, não 12/12 medido', () => {
    assert.equal(measurement.byteEqual, 9)
    assert.equal(measurement.partial, 2)
    assert.equal(measurement.mobilePresetsDryRun, 2)
    assert.equal(measurement.claimed12of12, false)
  })
  it('comando de re-derivação roda os literais byte-equal, nunca "12/12 pago"', () => {
    const cmd = rederiveCommand()
    assert.match(cmd, /golden\.spec\.mjs/)
    assert.match(cmd, /eixos-stack\.spec\.mjs/)
    assert.doesNotMatch(cmd, /12\/12\s*[=:]\s*true/)
  })
})

describe('materialização do oráculo — worktree detach, SHA e status', () => {
  function fakeRun(map) {
    return (args, opts) => {
      const key = args.join(' ')
      if (!(key in map)) throw new Error(`unexpected: ${key}`)
      return map[key]
    }
  }
  it('happy: worktree limpo no commit exato', () => {
    const run = fakeRun({
      'worktree add --detach /tmp/oracle c63e333': '',
      'rev-parse HEAD': `${ORACLE_FULL}\n`,
      'status --porcelain': '',
    })
    const r = materializeOracle({ worktreeDir: '/tmp/oracle', run })
    assert.equal(r.sha, ORACLE_FULL)
    assert.equal(r.clean, true)
  })
  it('MUTAÇÃO: worktree sujo reprova (sem aceitar snapshot cego)', () => {
    const run = fakeRun({
      'worktree add --detach /tmp/oracle c63e333': '',
      'rev-parse HEAD': `${ORACLE_FULL}\n`,
      'status --porcelain': ' M installer/install.mjs\n',
    })
    assert.throws(() => materializeOracle({ worktreeDir: '/tmp/oracle', run }), /worktree sujo/)
  })
  it('MUTAÇÃO: SHA divergente reprova (oráculo anterior ao sujeito)', () => {
    const run = fakeRun({
      'worktree add --detach /tmp/oracle c63e333': '',
      'rev-parse HEAD': 'deadbeef\n',
      'status --porcelain': '',
    })
    assert.throws(() => materializeOracle({ worktreeDir: '/tmp/oracle', run }), /SHA/)
  })
})

describe('readOracleSource usa git show do commit congelado (fail-closed)', () => {
  it('fonte lida do oráculo bate com o SHA congelado', () => {
    const run = fakeGitShow(SOURCE)
    const meta = readOracleSource({ run, expectedSha: FIXTURE_SOURCE_SHA256 })
    assert.equal(meta.sha256, FIXTURE_SOURCE_SHA256)
    assert.equal(meta.oraculo, ORACLE_COMMIT)
  })
})

function fakeGitShow(text) {
  return (args) => {
    if (args[0] === 'show' && args[1] === `${ORACLE_COMMIT}:installer/install.mjs`) return text
    throw new Error(`unexpected: ${args.join(' ')}`)
  }
}
