// TUI-06 — teste ANTES da implementação (ADR-004 §2.3, RF-11).
// A ponte em installer-contract.mjs:58 fica com 10 D-ENGINE; os 8 D-TUI saem
// do reexport vivo de install.mjs e passam a vir do módulo local byte-fiel.
// Nenhuma prova por omissão: o grep é literal e as 8 funções continuam
// exportadas e exercitadas com as assinaturas congeladas dos consumidores.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { Readable } from 'node:stream'
import {
  askMenuStep, detect, printPlan, printUsage, promptAnswers,
  readSecretPrompt, readSecretRaw, sourceLineOf, W2M_MARKER,
} from '../installer-contract.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const BRIDGE = path.join(ROOT, 'installer', 'installer-contract.mjs')
const TUI = ['askMenuStep', 'detect', 'printPlan', 'printUsage', 'promptAnswers', 'readSecretPrompt', 'readSecretRaw', 'sourceLineOf']
const ENGINE10 = ['runCli', 'runDoctor', 'runInit', 'runUpgrade', 'runWizard', 'collectAnswers', 'generateConfig', 'planMerge', 'runChecks', 'main']

const bridgeSource = () => fs.readFileSync(BRIDGE, 'utf8')

function namesFromBridge() {
  const src = bridgeSource()
  const m = src.match(/import\s*\{([^{}]*)\}\s*from\s*'\.\/install\.mjs'/)
  assert.ok(m, 'bloco de import de install.mjs presente')
  return m[1].split(',').map((s) => s.trim()).filter(Boolean)
}

describe('TUI-06 — ponte 18 -> 10 nomes (8 D-TUI quitados)', () => {
  it('import de install.mjs tem exatamente os 10 D-ENGINE', () => {
    const names = namesFromBridge()
    assert.equal(names.length, 10)
    assert.deepEqual([...names].sort(), [...ENGINE10].sort())
    for (const tui of TUI) assert.ok(!names.includes(tui), `${tui} nao é mais reexport da ponte`)
  })

  it('grep literal de install.mjs continua igual a 1', () => {
    const out = execFileSync('grep', ['-rn', "from '.*install\\.mjs'", '--include=*.mjs', ROOT], { encoding: 'utf8' })
    const hits = out.split('\n').filter((l) => l.trim() !== '')
    assert.equal(hits.length, 1, `grep = 1 (ponte de 10), obtido ${hits.length}`)
    assert.match(hits[0], /installer-contract\.mjs/)
  })

  it('as 8 D-TUI seguem exportadas e executáveis (sem perda de consumidor)', () => {
    for (const [nome, fn] of Object.entries({ askMenuStep, detect, printPlan, printUsage, promptAnswers, readSecretPrompt, readSecretRaw, sourceLineOf })) {
      assert.equal(typeof fn, 'function', nome)
    }
  })
})

describe('TUI-06 — comportamento byte-fiel das 8 ops de tela', () => {
  it('printUsage escreve as 9 linhas congeladas', () => {
    const lines = []
    printUsage({ output: { write: (s) => lines.push(s) } })
    assert.equal(lines.length, 9)
    assert.match(lines[0], /^uso: node installer\/install\.mjs init/)
  })

  it('printPlan redige segredo e devolve contagem', () => {
    const lines = []
    const r = printPlan([{ action: 'create', path: 'a.md', layer: 'rules' }], { output: { write: (s) => lines.push(s) }, answers: { deployToken: 'SEGREDO' } })
    assert.equal(r.total, 1)
    assert.deepEqual(r.counts, { create: 1 })
    assert.equal(lines.join('\n').includes('SEGREDO'), false)
  })

  it('detect sem pubspec devolve hasPubspec=false e zero sources', () => {
    const r = detect(path.join(ROOT, 'installer-rs', '__sem_pubspec__'))
    assert.equal(r.hasPubspec, false)
    assert.deepEqual(r.sources, [])
  })

  it('sourceLineOf aponta o bloco W2m em install.mjs', () => {
    const n = sourceLineOf(W2M_MARKER)
    assert.ok(n > 0 && Number.isInteger(n), 'linha encontrada')
  })

  it('askMenuStep aceita default e item, sem mensagem nova', () => {
    const out = []
    const read = async (p) => { out.push(p); return '4' }
    return askMenuStep({ read, out: (s) => out.push(s), header: 'h', items: [{ key: '4', label: 'web', stack: 'java+vue', next: 'frontend' }], step: 1, total: 2 })
      .then((picked) => {
        assert.equal(picked.key, '4')
        assert.ok(out.join('\n').includes('[1/2] escolha [1-1] (q cancela) > '))
      })
  })

  it('readSecretRaw mascara em TTY falso e rejeita sem raw mode', async () => {
    const input = new Readable({ read() {} })
    input.isTTY = false
    await assert.rejects(() => readSecretRaw(input, { write() {} }), (e) => e.code === 'SECRET_TTY')
  })

  it('readSecretPrompt sem TTY devolve null', async () => {
    const input = new Readable({ read() {} })
    input.isTTY = false
    assert.equal(await readSecretPrompt({ input, output: { write() {} } }), null)
  })

  it('promptAnswers em pipe: token vazio permitido e serializeSkips omite a chave', async () => {
    const input = Readable.from(['demo', 'node', 'node', '.opencode/plugins', ''].map((l) => `${l}\n`))
    input.isTTY = false
    const answers = await promptAnswers(ROOT, { input, output: { write() {} } })
    assert.equal(answers.deployToken, '', 'token vazio é permitido (RF-07)')
    const { serializeAnswers } = await import('../installer-contract.mjs')
    assert.ok(!Object.prototype.hasOwnProperty.call(serializeAnswers(answers), 'deployToken'), 'envelope sem deployToken')
  })
})
