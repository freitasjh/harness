// CLI-04 — leitura de segredo sem eco e cleanup de sinal (ADR-002 §2.2/§3 5/7).
// O valor sensível nunca entra em argv, stdout, stderr, transcript ou resumo:
// o prompt do @inquirer/password usa o `maskedText` do tema (via locale) e o
// toggle de revelação é desligado. No sinal, o eco é restaurado uma única vez
// antes de propagar — término por sinal, nunca exit 0.
import { t } from './locale.js'
import { USER_ABORT, classifyAbort } from './abort.js'

export const DEFAULT_SIGNALS = Object.freeze(['SIGTERM', 'SIGINT', 'SIGHUP'])

export function secretPromptConfig() {
  return {
    message: t('wizard.token.message'),
    masked: t('wizard.token.masked'),
    mask: false,
    toggleMask: false,
    theme: { style: { maskedText: t('wizard.token.masked') } },
  }
}

export function redactSecret() {
  return t('summary.redacted')
}

export function restoreEcho(stream = process.stdin) {
  if (!stream || !stream.isTTY || typeof stream.setRawMode !== 'function') return false
  try {
    stream.setRawMode(false)
    return true
  } catch {
    return false
  }
}

export function installSignalEchoGuard({
  stream = process.stdin,
  signals = DEFAULT_SIGNALS,
  processRef = process,
  onRestore,
} = {}) {
  let restored = false
  let disposed = false
  let signalSeen = null
  const handlers = new Map()

  const restore = () => {
    if (restored) return false
    restored = true
    const ok = restoreEcho(stream)
    if (typeof onRestore === 'function') onRestore({ signal: signalSeen, restored: ok })
    return ok
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    for (const [name, handler] of handlers) processRef.removeListener(name, handler)
    handlers.clear()
  }

  for (const name of signals) {
    const handler = () => {
      signalSeen = name
      restore()
      dispose()
      try {
        processRef.kill(processRef.pid, name)
      } catch {
        // Processo já em término; o eco foi restaurado antes de chegar aqui.
      }
    }
    handlers.set(name, handler)
    processRef.on(name, handler)
  }

  return { restore, dispose, isRestored: () => restored }
}

export async function readSecret({ prompts, signal, guard } = {}) {
  if (!prompts || typeof prompts.password !== 'function') {
    throw new Error(t('errors.promptsUnavailable'))
  }
  const owned = guard ? null : installSignalEchoGuard()
  const active = guard || owned
  try {
    const value = await prompts.password(secretPromptConfig(), { signal })
    if (signal?.aborted) throw Object.assign(new Error(t('abort.userAbort')), { code: USER_ABORT })
    return value
  } catch (error) {
    if (classifyAbort(error, signal) === USER_ABORT) {
      throw Object.assign(new Error(t('abort.userAbort')), { code: USER_ABORT })
    }
    throw error
  } finally {
    active.restore()
    if (owned) owned.dispose()
  }
}
