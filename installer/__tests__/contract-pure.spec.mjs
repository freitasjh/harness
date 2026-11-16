// TDD FIRST — quitação parcial D1-two-motors: 29 D-PURE locais.
// Anti-tautologia: o lado de referência é install.mjs do worktree DETACH c63e333
// (SHA cheio + status --porcelain vazio), NUNCA o install.mjs do HEAD nem o
// próprio módulo sob teste. Mesma entrada ⇒ mesmo resultado (ou mesmo erro).
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { materializeOracle, releaseOracle } from '../parity-oracle.mjs'
import { DESTINATIONS } from '../contract-inventory.mjs'

const WORKTREE = '/tmp/opencode/harness-oracle-pure-c63e333'
const NAMES = DESTINATIONS['D-PURE']

let oracleUrl
let oracleIdentity

before(() => {
  oracleIdentity = materializeOracle({ worktreeDir: WORKTREE })
  oracleUrl = pathToFileURL(path.join(WORKTREE, 'installer', 'install.mjs')).href
})
after(() => releaseOracle({ worktreeDir: WORKTREE }))

function norm(v) {
  if (v instanceof Set) return { __set: [...v].sort() }
  if (v instanceof Map) return { __map: [...v.entries()].sort() }
  if (Array.isArray(v)) return v.map(norm)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)]))
  return v
}

function run(fn, args) {
  try {
    const value = fn(...args)
    return { kind: 'value', value: norm(value === undefined ? null : value) }
  } catch (e) {
    return { kind: 'error', name: e && e.name, code: e && e.code, message: e && e.message }
  }
}

function vector(name, tmp) {
  switch (name) {
    case 'InstallError': return args => args
    case 'assertCreateOnly': return () => [
      [{ action: 'add' }], [{ action: 'merge' }, { action: 'flag' }], [],
    ]
    case 'assertDogfoodTarget': return () => [[tmp], ['/etc'], [path.join(tmp, 'esc/../x')]]
    case 'assertInside': return () => [[tmp, path.join(tmp, 'a')], [tmp, '/etc']]
    case 'axisIdsFromAxes': return () => [[{ backend: 'java', frontend: 'vue' }], [null], [{}]]
    case 'canNoEcho': return () => [[{ isTTY: true, setRawMode() {} }], [{ isTTY: false }], [null]]
    case 'configReferenceTargets': return () => [[{
      evidence: { schema: '.agents/schemas/harness-report.schema.json' },
      moduleMap: { plugins: '.opencode/plugins', rules: '.agents/rules', lib: 'lib', skip: '**' },
    }], [null]]
    case 'defaultSuiteFor': return () => [['node'], ['flutter'], ['dart'], [{ backend: 'java', frontend: 'react' }], ['nope']]
    case 'dryRunNotice': return () => [[]]
    case 'formatError': return () => [
      [{ what: 'falha', code: 'BAD_ANSWER', why: 'motivo', fix: 'consertar', where: 'cli' }, {}],
      [{ what: 'token=SEGREDO_X', code: 'NOPE', why: 'SEGREDO_X', fix: '', where: '' }, { deployToken: 'SEGREDO_X' }],
    ]
    case 'hasHarnessSection': return () => [['# AGENTS\n## Harness V7\ntexto\n'], ['# AGENTS\n']]
    case 'isAbortToken': return () => [['Q'], [' cancelar '], ['segue']]
    case 'isScannablePath': return () => [['a.js'], ['README.md'], ['scripts/x.js'], ['Dockerfile'], [''], [null]]
    case 'normalizeSection': return () => [['  ##  Harness   v7  '], ['ABC']]
    case 'presetOfAxes': return () => [['java', 'vue'], ['nope', 'vue'], ['dart', 'none']]
    case 'presetsOfAxes': return () => [['java', 'vue'], ['node', 'none'], ['nope', 'vue']]
    case 'profileOf': return () => [['node'], ['java+react'], ['nope']]
    case 'resolveAnswerSource': return () => [
      [{ answersFile: 'a.json' }], [{ stdinIsTTY: true }], [{ stdinKind: 'fifo' }], [{}],
    ]
    case 'ruleAllowedForAxes': return () => [
      ['.agents/rules/frontend-coding-standards.md', new Set(['frontend=vue'])],
      ['.agents/rules/frontend-coding-standards.md', new Set(['frontend=react'])],
      ['.md', new Set()],
    ]
    case 'sanitizeLog': return () => [
      ['token=SEGREDO_Y', { deployToken: 'SEGREDO_Y' }],
      ['\u001b[31mvermelho\u0007', {}],
      ['sem segredo', {}],
    ]
    case 'scanLiterals': return () => [['usa vuetify e LOMBOK'], ['limpo']]
    case 'serializeAnswers': return () => [[{ project: 'demo', deployToken: 'SEGREDO_Z', answersVersion: 2 }]]
    case 'skillAllowedForLocalAxes': return () => [
      ['.agents/skills/frontend-vue-specialist/SKILL.md', null, new Set(['frontend=react'])],
      ['.agents/skills/frontend-vue-specialist/SKILL.md', { skills: { 'frontend-vue-specialist': {} } }, new Set(['frontend=react'])],
      ['.txt', null, new Set()],
    ]
    case 'stacksFor': return () => [
      [{ backend: 'flutter', frontend: 'flutter' }], [{ backend: 'dart', frontend: 'none' }],
      [{ backend: 'java', frontend: 'react' }], [null],
    ]
    case 'stripAnsiControls': return () => [['\u001b[31mvermelho\u0007limpo'], ['plano']]
    case 'validateAnswer': return () => [
      [tmp, 'project', 'demo'], [tmp, 'stack', 'node'], [tmp, 'backend', 'java'],
      [tmp, 'suiteCommand', 'node --test'], [tmp, 'nope', 'x'], [tmp, 'project', '   '],
    ]
    case 'validateRulesByAxis': return () => [undefined, [{ 'badkey': [] }]]
    case 'validateSkillsByAxis': return () => [undefined, [{ 'frontend=vue': [''] }]]
    case 'writtenPathsOf': return () => [[{ 'a/b': 1, 'c\\d': 2 }], [null]]
    default: throw new Error('vetor ausente para ' + name)
  }
}

describe('D-PURE local — golden vectors contra c63e333 (worktree detach, anti-tautologia)', () => {
  it('identidade do oráculo: SHA cheio e worktree limpo', () => {
    assert.equal(oracleIdentity.sha, 'c63e33307710e1c6271f5c68b2dd9fb15283f49c')
    assert.equal(oracleIdentity.clean, true)
    assert.equal(NAMES.length, 29)
  })

  it('módulo local NÃO importa install.mjs (sem reexport disfarçado)', async () => {
    const src = fs.readFileSync(new URL('../contract-pure.mjs', import.meta.url), 'utf8')
    assert.ok(!/from\s+['"][^'"]*install\.mjs['"]/.test(src), 'sem reexport do módulo vivo')
    assert.ok(!/import\s*\(\s*['"][^'"]*install\.mjs['"]/.test(src), 'sem import dinâmico do módulo vivo')
  })

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-pure-'))
  for (const name of NAMES) {
    it(`${name}: local === oráculo c63e333`, async () => {
      const local = await import('../contract-pure.mjs')
      const oracle = await import(oracleUrl)
      assert.equal(typeof local[name], typeof oracle[name], `tipo de ${name}`)
      const cases = vector(name, tmp)(name === 'InstallError' ? undefined : undefined)
      const inputs = name === 'InstallError'
        ? [[['x', 'CODE']], [['y']]]
        : cases
      for (const args of inputs) {
        assert.deepEqual(run(local[name], args), run(oracle[name], args), `${name}(${JSON.stringify(args)})`)
      }
    })
  }
})
