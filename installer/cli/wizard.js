import { t } from './locale.js'
import { USER_ABORT, classifyAbort } from './abort.js'
import { AXIS_IDS } from '../install.mjs'
import { choicesForEixo, DEFAULTS } from './eixos.js'

export const TELAS = Object.freeze(['backend', 'frontend', 'name', 'token'])

function abortError() {
  return Object.assign(new Error(t('abort.userAbort')), { code: USER_ABORT })
}

async function ask(promptFactory, signal) {
  if (signal?.aborted) throw abortError()
  try {
    const value = await promptFactory()
    if (signal?.aborted) throw abortError()
    return value
  } catch (error) {
    if (classifyAbort(error, signal) === USER_ABORT) throw abortError()
    throw error
  }
}

export async function defaultPrompts() {
  const { select, input, password } = await import('@inquirer/prompts')
  return { select, input, password }
}

export function renderSummary({ backend, frontend, name, token }) {
  return [
    t('summary.title'),
    `${t('summary.backend')}: ${backend}`,
    `${t('summary.frontend')}: ${frontend}`,
    `${t('summary.name')}: ${name}`,
    `${t('summary.token')}: ${t('summary.redacted')}`,
    t('summary.confirm'),
  ].join('\n')
}

export async function runVisualWizard({
  prompts,
  signal,
  axes = AXIS_IDS,
  write = () => {},
} = {}) {
  const p = prompts || (await defaultPrompts())

  const backend = await ask(
    () => p.select({
      message: t('wizard.backend.message'),
      choices: choicesForEixo('backend', axes),
      default: DEFAULTS.backend,
    }),
    signal,
  )

  const frontend = await ask(
    () => p.select({
      message: t('wizard.frontend.message'),
      choices: choicesForEixo('frontend', axes),
      default: DEFAULTS.frontend,
    }),
    signal,
  )

  const name = await ask(
    () => p.input({
      message: t('wizard.name.message'),
      placeholder: t('wizard.name.placeholder'),
    }),
    signal,
  )

  const token = await ask(
    () => p.password({
      message: t('wizard.token.message'),
      masked: t('wizard.token.masked'),
    }),
    signal,
  )

  const answers = { backend, frontend, name, token }
  const summary = renderSummary(answers)
  write(summary)
  return { answers, telas: [...TELAS], summary }
}
