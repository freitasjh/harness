// parity-oracle.spec.mjs — ADR-002 (PRD-3): mecanismo de verificação sem tautologia.
// TDD FIRST. Oráculo = c63e333 (anterior ao sujeito, imutável, legível sem Rust).
// Cada predicado SI-1..SI-6 provado por mutação que o derruba (não apenas verde).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ORACLE_COMMIT,
  ORACLE_FULL,
  ORACLE_BLOB_SHA256,
  FIXTURE_SOURCE_SHA256,
  ORACLE_LITERAL_REL,
  ARCHIVED_TRANSCRIPT_MARKERS,
  SI3_HASH_COMMAND,
  assertOracleIdentity,
  materializeOracle,
  readOracleSource,
  ritualVerdict,
  parseRitual,
  readLiteralFile,
  literalSha256,
  assertLiteralMatchesSource,
  isLiteralProven,
  canonicalJson,
  si1_configByteEqual,
  si2_payloadDifferential,
  si3_dryRunZeroWrites,
  si4_transcriptMarkers,
  si5_checksManifestParity,
  si6_noNewKeys,
  assertNoInstaAccept,
  measurement,
  rederiveCommand,
  runParity,
} from '../parity-oracle.mjs'

const TEST_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const LITERAL_TEXT = fs.readFileSync(path.join(TEST_ROOT, ORACLE_LITERAL_REL), 'utf8')
const LITERAL_SHA = literalSha256({ readFile: () => LITERAL_TEXT })
const GOLDEN_SHA = createHash('sha256')
  .update(fs.readFileSync(path.join(TEST_ROOT, 'installer/__tests__/golden.spec.mjs'), 'utf8')).digest('hex')

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

describe('rito do literal — assinatura humana do SHA do ARQUIVO de literal (F1)', () => {
  const verdict = ritualVerdict({
    sha256: LITERAL_SHA,
    iso8601: '2026-11-16T12:00:00.000Z',
    oraculo: ORACLE_COMMIT,
  })

  it('assa exatamente Veredito: validated literal <sha256 do arquivo> <ISO-8601> <oráculo>', () => {
    assert.equal(verdict, `Veredito: validated literal ${LITERAL_SHA} 2026-11-16T12:00:00.000Z ${ORACLE_COMMIT}`)
    assert.notEqual(LITERAL_SHA, ORACLE_BLOB_SHA256, 'sha do arquivo de literal ≠ sha do blob de origem')
  })

  it('parse extrai sha/iso/oráculo de assinatura válida', () => {
    assert.deepEqual(parseRitual(verdict), {
      sha256: LITERAL_SHA,
      iso8601: '2026-11-16T12:00:00.000Z',
      oraculo: ORACLE_COMMIT,
    })
  })

  it('o arquivo de literal é lido do disco (nunca derivado da constante do módulo)', () => {
    assert.equal(readLiteralFile(), LITERAL_TEXT)
    assert.match(LITERAL_TEXT.trim(), /^[0-9a-f]{64}$/)
    assert.equal(LITERAL_TEXT.trim(), ORACLE_BLOB_SHA256, 'conteúdo do literal = sha do oráculo c63e333')
    assert.doesNotThrow(() => assertLiteralMatchesSource({ literalText: LITERAL_TEXT }))
  })

  it('sem assinatura OU sem sha esperado, não prova (fail-closed)', () => {
    assert.equal(isLiteralProven({ validationVerdict: '' }, LITERAL_SHA), false)
    assert.equal(isLiteralProven({}, LITERAL_SHA), false)
    assert.equal(isLiteralProven({ validationVerdict: 'aprovado verbalmente' }, LITERAL_SHA), false)
    assert.equal(isLiteralProven({ validationVerdict: verdict }), false, 'sem expectedLiteralSha ⇒ false')
    assert.equal(isLiteralProven({ validationVerdict: verdict }, 'curto'), false, 'sha esperado malformado ⇒ false')
  })

  it('assinatura correta (sha do arquivo de literal) ⇒ true', () => {
    assert.equal(isLiteralProven({ validationVerdict: verdict }, LITERAL_SHA), true)
  })

  it('MUTAÇÃO: sha trocado na assinatura reprova mesmo com formato válido', () => {
    assert.equal(isLiteralProven({ validationVerdict: verdict.replace(LITERAL_SHA, 'a'.repeat(64)) }, LITERAL_SHA), false)
  })

  it('MUTAÇÃO: assinar sha real de golden.spec.mjs reprova (não é o arquivo de literal)', () => {
    assert.notEqual(GOLDEN_SHA, LITERAL_SHA)
    assert.equal(isLiteralProven({ validationVerdict: verdict.replace(LITERAL_SHA, GOLDEN_SHA) }, LITERAL_SHA), false)
  })

  it('MUTAÇÃO: alterar 1 byte do literal muda seu sha e a assinatura antiga reprova', () => {
    const mutated = LITERAL_TEXT.replace(ORACLE_BLOB_SHA256[0], ORACLE_BLOB_SHA256[0] === 'a' ? 'b' : 'a')
    const mutatedSha = literalSha256({ readFile: () => mutated })
    assert.notEqual(mutatedSha, LITERAL_SHA)
    assert.equal(isLiteralProven({ validationVerdict: verdict }, mutatedSha), false)
    assert.throws(() => assertLiteralMatchesSource({ literalText: mutated }), /divergente/)
  })

  it('MUTAÇÃO: assinar o sha da origem (ORACLE_BLOB_SHA256) reprova — literal é o arquivo', () => {
    const wrong = ritualVerdict({ sha256: ORACLE_BLOB_SHA256, iso8601: '2026-11-16T12:00:00.000Z', oraculo: ORACLE_COMMIT })
    assert.equal(isLiteralProven({ validationVerdict: wrong }, LITERAL_SHA), false)
  })
})

describe('canonicalJson — serialização determinística (F4)', () => {
  it('ordena chaves recursivamente: ordem de inserção não muda o resultado', () => {
    assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }))
    assert.equal(canonicalJson({ z: { y: 1, x: 2 } }), canonicalJson({ z: { x: 2, y: 1 } }))
  })
  it('MUTAÇÃO: conteúdo diferente gera string diferente', () => {
    assert.notEqual(canonicalJson({ a: 1 }), canonicalJson({ a: 9 }))
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
  it('F4: ordem de chaves invertida passa por conteúdo (não por referência)', () => {
    const r = si1_configByteEqual({ rust: oracle.rust, node: oracle.node }, oracle)
    assert.equal(r.pass, true)
  })
  it('F4 MUTAÇÃO: valores-objeto com mesmo conteúdo, ordem de chaves diferente, passam', () => {
    const r = si1_configByteEqual({ cfg: { b: 2, a: 1 } }, { cfg: { a: 1, b: 2 } })
    assert.equal(r.pass, true, 'canonicalJson derruba comparação por referência')
  })
  it('F4 MUTAÇÃO: objeto-valor divergente derruba SI-1', () => {
    assert.equal(si1_configByteEqual({ cfg: { a: 9, b: 2 } }, { cfg: { a: 1, b: 2 } }).pass, false)
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
  it('F4: ordem de paths invertida passa por conteúdo', () => {
    assert.equal(si2_payloadDifferential({ rust: 'hash-b', node: 'hash-a' }, oracle).pass, true)
  })
  it('F4 MUTAÇÃO: payload-objeto com conteúdo divergente derruba SI-2', () => {
    const a = { f: { path: 'x', body: 'b1' } }
    const b = { f: { body: 'b1', path: 'y' } }
    assert.equal(si2_payloadDifferential(a, { f: { path: 'x', body: 'b1' } }).pass, true)
    assert.equal(si2_payloadDifferential(a, b).pass, false)
  })
})

describe('SI-3 dry-run 0 writes — fail-closed e hash de CONTEÚDO (F5)', () => {
  it('happy: hash antes=depois e porcelain vazio passam', () => {
    assert.equal(si3_dryRunZeroWrites({ beforeHash: 'abc', afterHash: 'abc', porcelain: '' }).pass, true)
  })
  it('MUTAÇÃO: 1 write ou 1 arquivo untracked derruba SI-3', () => {
    assert.equal(si3_dryRunZeroWrites({ beforeHash: 'abc', afterHash: 'def', porcelain: '' }).pass, false)
    assert.equal(si3_dryRunZeroWrites({ beforeHash: 'abc', afterHash: 'abc', porcelain: '?? x' }).pass, false)
  })
  it('F5: porcelain OBRIGATÓRIO — omitido lança (nunca fail-open)', () => {
    assert.throws(() => si3_dryRunZeroWrites({ beforeHash: 'abc', afterHash: 'abc' }), /porcelain/)
    assert.throws(() => si3_dryRunZeroWrites({ beforeHash: 'abc', afterHash: 'def' }), /porcelain/)
  })
  it('F5: hash de conteúdo, não só nomes — comando declarado usa -type f -print0 + sha256sum', () => {
    assert.match(SI3_HASH_COMMAND, /find -type f -print0/)
    assert.match(SI3_HASH_COMMAND, /sort -z/)
    assert.match(SI3_HASH_COMMAND, /xargs -0 sha256sum/)
    assert.doesNotMatch(SI3_HASH_COMMAND, /find \. \| sort \| sha256sum/)
  })
  it('F5 MUTAÇÃO: trocar 1 byte do conteúdo sem mudar nome derruba (hash muda)', () => {
    const a = createHash('sha256').update('conteúdo-A').digest('hex')
    const b = createHash('sha256').update('conteúdo-B').digest('hex')
    assert.notEqual(a, b)
    assert.equal(si3_dryRunZeroWrites({ beforeHash: a, afterHash: b, porcelain: '' }).pass, false)
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

describe('runParity — driver de produção do oráculo (F3)', () => {
  const WORKTREE = '/tmp/opencode/harness-oracle-test'
  const TRANSCRIPT = '.spec/archive/20261018-harness-eixos-stack/harness/wizard-react-transcript.txt'
  const ORACLE_MARKERS = ARCHIVED_TRANSCRIPT_MARKERS
  const lastMarker = ORACLE_MARKERS[ORACLE_MARKERS.length - 1]

  function harness({ transcript = ORACLE_MARKERS.join('\n'), exitCode = 0, binaryAvailable = false, literalText = LITERAL_TEXT, diffNames = '' } = {}) {
    const calls = { materialize: 0, release: 0, node: [] }
    const runGit = (args) => {
      const k = args.join(' ')
      if (k === `worktree add --detach ${WORKTREE} ${ORACLE_COMMIT}`) return ''
      if (k === 'rev-parse HEAD') return `${ORACLE_FULL}\n`
      if (k === 'status --porcelain') return ''
      if (k.startsWith('diff --name-only')) return diffNames
      throw new Error(`unexpected git: ${k}`)
    }
    const runNode = (args) => { calls.node.push(args.join(' ')); return exitCode }
    const readFile = (p) => {
      if (p.endsWith(ORACLE_LITERAL_REL)) return literalText
      if (p.endsWith(TRANSCRIPT)) return transcript
      throw new Error(`unexpected readFile: ${p}`)
    }
    return {
      calls,
      opts: {
        root: TEST_ROOT,
        runGit,
        runNode,
        readFile,
        worktreeDir: WORKTREE,
        binaryAvailable,
        validationVerdict: ritualVerdict({ sha256: LITERAL_SHA, iso8601: '2026-11-16T12:00:00.000Z', oraculo: ORACLE_COMMIT }),
        materialize: (args) => { calls.materialize++; return { worktreeDir: args.worktreeDir, sha: ORACLE_FULL, clean: true } },
        release: () => { calls.release++ },
        readSource: () => ({ sha256: ORACLE_BLOB_SHA256, oraculo: ORACLE_COMMIT }),
      },
    }
  }

  it('materializa e libera o oráculo; expõe 6 predicados com SHA do literal separado da origem', () => {
    const h = harness()
    const r = runParity(h.opts)
    assert.equal(h.calls.materialize, 1)
    assert.equal(h.calls.release, 1)
    assert.equal(r.literalSha256, LITERAL_SHA)
    assert.equal(r.sourceSha256, ORACLE_BLOB_SHA256)
    assert.notEqual(r.literalSha256, r.sourceSha256)
    assert.equal(r.literalProven, true)
    assert.deepEqual(r.si.map((x) => x.id), ['SI-1', 'SI-2', 'SI-3', 'SI-4', 'SI-5', 'SI-6'])
  })

  it('SI-2 e SI-3 são not_measured com motivo explícito (binário Rust do ADR-003), nunca PASS por omissão', () => {
    const r = runParity(harness({ binaryAvailable: false }).opts)
    for (const id of ['SI-2', 'SI-3']) {
      const si = r.si.find((x) => x.id === id)
      assert.equal(si.status, 'not_measured', `${id} não pode ser PASS sem binário`)
      assert.equal(si.pass, null)
      assert.match(si.reason, /ADR-003/)
    }
  })

  it('SI-1/SI-4/SI-5/SI-6 são medidos de verdade quando oráculo+literais estão íntegros', () => {
    const r = runParity(harness().opts)
    for (const id of ['SI-1', 'SI-4', 'SI-5', 'SI-6']) {
      const si = r.si.find((x) => x.id === id)
      assert.equal(si.status, 'medido', `${id} deve ser medido`)
      assert.equal(si.pass, true, `${id} íntegro ⇒ pass`)
      assert.equal(si.reason, null)
    }
  })

  it('MUTAÇÃO: marcador removido do transcript derruba SI-4 (não é verde por omissão)', () => {
    const r = runParity(harness({ transcript: ORACLE_MARKERS.slice(0, -1).join('\n') }).opts)
    const si = r.si.find((x) => x.id === 'SI-4')
    assert.equal(si.status, 'medido')
    assert.equal(si.pass, false)
    assert.deepEqual(si.missing, [lastMarker])
  })

  it('MUTAÇÃO: comando do oráculo falha ⇒ SI-1 medido com pass=false (não silenciado)', () => {
    const r = runParity(harness({ exitCode: 1 }).opts)
    const si = r.si.find((x) => x.id === 'SI-1')
    assert.equal(si.status, 'medido')
    assert.equal(si.pass, false)
    assert.match(si.reason, /exit 1/)
  })

  it('MUTAÇÃO: path protegido no diff derruba SI-6 (medição real, não vazia)', () => {
    const r = runParity(harness({ diffNames: 'harness.config.json\n' }).opts)
    const si = r.si.find((x) => x.id === 'SI-6')
    assert.equal(si.status, 'medido')
    assert.equal(si.pass, false)
    assert.match(si.reason, /harness\.config\.json/)
  })

  it('MUTAÇÃO: literal alterado ⇒ drift detectado (fail-closed, assinatura antiga não casa)', () => {
    const mutated = LITERAL_TEXT.replace(ORACLE_BLOB_SHA256[0], ORACLE_BLOB_SHA256[0] === 'a' ? 'b' : 'a')
    assert.throws(() => runParity(harness({ literalText: mutated }).opts), /divergente/)
  })

  it('MUTAÇÃO: assinatura diferente da sha do arquivo ⇒ literalProven=false', () => {
    const h = harness()
    const r = runParity({ ...h.opts, validationVerdict: ritualVerdict({ sha256: ORACLE_BLOB_SHA256, iso8601: '2026-11-16T12:00:00.000Z', oraculo: ORACLE_COMMIT }) })
    assert.equal(r.literalProven, false)
  })

  it('fail-closed: identidade do oráculo divergente lança (sem materializar cego)', () => {
    const h = harness()
    assert.throws(
      () => runParity({ ...h.opts, readSource: () => { throw new Error('oráculo divergente') } }),
      /divergente/,
    )
    assert.equal(h.calls.release, 1, 'libera o worktree mesmo no throw')
  })
})

function fakeGitShow(text) {
  return (args) => {
    if (args[0] === 'show' && args[1] === `${ORACLE_COMMIT}:installer/install.mjs`) return text
    throw new Error(`unexpected: ${args.join(' ')}`)
  }
}
