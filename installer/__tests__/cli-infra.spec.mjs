import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const CLI_DIR = join(REPO_ROOT, 'installer', 'cli')

const REQUIRED_KEYS = [
  'wizard.title',
  'wizard.backend.message',
  'wizard.backend.hint',
  'wizard.frontend.message',
  'wizard.frontend.hint',
  'wizard.name.message',
  'wizard.name.placeholder',
  'wizard.name.hint',
  'wizard.token.message',
  'wizard.token.masked',
  'wizard.token.hint',
  'summary.title',
  'summary.backend',
  'summary.frontend',
  'summary.name',
  'summary.token',
  'summary.redacted',
  'summary.confirm',
  'actions.yes',
  'actions.no',
  'actions.confirm',
  'actions.cancel',
  'actions.back',
  'actions.retry',
  'abort.userAbort',
  'abort.exitPrompt',
  'abort.eof',
  'hint.navigation',
  'errors.invalidAnswer',
]

function readJson(relative) {
  return JSON.parse(readFileSync(join(REPO_ROOT, relative), 'utf8'))
}

function cliSources() {
  return readdirSync(CLI_DIR)
    .filter((name) => /\.(mjs|js|cjs)$/.test(name))
    .map((name) => ({ name, source: readFileSync(join(CLI_DIR, name), 'utf8') }))
}

test('CLI-01 · @inquirer/prompts disponível com pin exato registrado no SDD, não no ADR', () => {
  const pkg = readJson('installer/cli/package.json')
  assert.equal(pkg.dependencies['@inquirer/prompts'], '8.8.0')
  assert.equal(pkg.dependencies['@inquirer/i18n'], '1.4.0')
  for (const version of Object.values(pkg.dependencies)) {
    assert.match(version, /^\d+\.\d+\.\d+$/, 'pin deve ser exato, sem caret/til')
  }

  assert.equal(existsSync(join(CLI_DIR, 'package-lock.json')), true)
  const lock = readJson('installer/cli/package-lock.json')
  assert.equal(lock.packages['node_modules/@inquirer/prompts'].version, '8.8.0')
  assert.equal(lock.packages['node_modules/@inquirer/i18n'].version, '1.4.0')

  const adr = readFileSync(
    join(REPO_ROOT, '.spec/prd/prd-eixos-separados-cli/ADRs/ADR-002-cli-visual/ADR.md'),
    'utf8',
  )
  assert.equal(adr.includes('8.8.0'), false, 'versão não pode ser decisão do ADR (item 12)')
  assert.equal(adr.includes('1.4.0'), false, 'versão não pode ser decisão do ADR (item 12)')
})

test('CLI-01 · locale PT-BR cobre todas as chaves dos prompts do protótipo', async () => {
  const { PT_BR, LOCALE_KEYS, t } = await import('../cli/locale.js')
  const prototype = readJson('workflow-state.json').prototype
  assert.equal(prototype.status, 'approved_user_2026_11_17')
  assert.equal(prototype.i18n, 'PT-BR')
  assert.equal(prototype.telas_N, 4)

  assert.equal(typeof PT_BR, 'object')
  assert.equal(Object.isFrozen(PT_BR), true)
  for (const key of REQUIRED_KEYS) {
    assert.equal(LOCALE_KEYS.includes(key), true, `chave ausente: ${key}`)
    assert.equal(typeof t(key), 'string', `t(${key}) não é string`)
    assert.notEqual(t(key).trim(), '', `t(${key}) vazio`)
  }

  assert.equal(t('wizard.token.masked'), '[input is masked]')
  assert.equal(t('summary.redacted'), '[REDACTED]')
  assert.equal(prototype.segredo.includes(t('wizard.token.masked')), true)
  assert.equal(prototype.segredo.includes(t('summary.redacted')), true)
  assert.match(t('wizard.backend.message'), /backend/i)
  assert.throws(() => t('nao.existe'), /locale/i)
})

test('CLI-01 · Ctrl+C (ExitPromptError/AbortSignal/AbortError) ⇒ USER_ABORT, nunca valor lido', async () => {
  const { USER_ABORT, classifyAbort, toUserAbort, guardAbort, isExitPromptError } = await import('../cli/abort.js')
  assert.equal(USER_ABORT, 'USER_ABORT')

  class ExitPromptError extends Error {
    constructor() {
      super('interrupt')
      this.name = 'ExitPromptError'
    }
  }
  const exit = new ExitPromptError()
  assert.equal(isExitPromptError(exit), true)
  assert.equal(classifyAbort(exit), USER_ABORT)
  assert.equal(toUserAbort(exit), USER_ABORT)

  const controller = new AbortController()
  controller.abort()
  assert.equal(classifyAbort(null, controller.signal), USER_ABORT)
  assert.equal(toUserAbort(new Error('qualquer'), controller.signal), USER_ABORT)
  assert.equal(guardAbort(controller.signal, 'backend-82'), USER_ABORT, 'abort não pode virar valor lido')

  const live = new AbortController()
  assert.equal(guardAbort(live.signal, 'backend-82'), 'backend-82')
  assert.throws(() => toUserAbort(new Error('boom')), /boom/)
})

test('CLI-01 · grep word-boundary B2 = 0 (e detecta inquire/ratatui/dialoguer reais)', () => {
  const B2 = /\b(inquire|ratatui|dialoguer)\b/
  assert.equal(B2.test('inquire'), true)
  assert.equal(B2.test('ratatui'), true)
  assert.equal(B2.test('dialoguer'), true)
  assert.equal(B2.test('@inquirer/prompts'), false, '@inquirer/ é B1, não B2')

  const files = cliSources().concat([
    { name: 'package.json', source: readFileSync(join(CLI_DIR, 'package.json'), 'utf8') },
    { name: 'package-lock.json', source: readFileSync(join(CLI_DIR, 'package-lock.json'), 'utf8') },
  ])
  const hits = []
  for (const { name, source } of files) {
    source.replace(/@inquirer\//g, '').split('\n').forEach((line, index) => {
      if (B2.test(line)) hits.push(`${name}:${index + 1}`)
    })
  }
  assert.deepEqual(hits, [], `B2 full-screen detectado: ${hits.join(', ')}`)
})

test('CLI-02 · nenhuma string de prompt solta — varre CLI + install.mjs e checa prompt(', async () => {
  const { LOCALE_KEYS, t } = await import('../cli/locale.js')
  const others = cliSources().filter(({ name }) => name !== 'locale.js')
  assert.notEqual(others.length, 0)

  // Casa só literal de prompt (message: '...'), não `message: t(chave)` nem
  // o ternário legado `e.message : String(e)` do install.mjs.
  const LITERAL = /(?<![\w.])(?:message|placeholder)\s*:\s*['"`]/
  const RAW_PROMPT = /\bprompt\s*\(/

  for (const { name, source } of others) {
    for (const key of LOCALE_KEYS) {
      const value = t(key)
      if (value.length >= 8) {
        assert.equal(source.includes(value), false, `${name} repete literal de locale: ${key}`)
      }
    }
    assert.equal(LITERAL.test(source), false, `${name} tem message/placeholder literal solto`)
    assert.equal(RAW_PROMPT.test(source), false, `${name} tem prompt( cru — use select/input/password via t()`)
  }

  const installSource = readFileSync(join(REPO_ROOT, 'installer', 'install.mjs'), 'utf8')
  assert.equal(RAW_PROMPT.test(installSource), false, 'install.mjs tem prompt( cru')
  assert.equal(LITERAL.test(installSource), false, 'install.mjs tem message/placeholder literal solto')
})
