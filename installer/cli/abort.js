export const USER_ABORT = 'USER_ABORT'

function errorName(error) {
  if (!error || typeof error !== 'object') return ''
  return error.name || error.constructor?.name || ''
}

export function isExitPromptError(error) {
  return errorName(error) === 'ExitPromptError'
}

export function isAbortError(error) {
  return errorName(error) === 'AbortError'
}

export function classifyAbort(error, signal) {
  if (signal?.aborted) return USER_ABORT
  if (isExitPromptError(error) || isAbortError(error)) return USER_ABORT
  return null
}

export function toUserAbort(error, signal) {
  if (classifyAbort(error, signal) === USER_ABORT) return USER_ABORT
  throw error
}

export function guardAbort(signal, value) {
  if (signal?.aborted) return USER_ABORT
  return value
}

export function onAbort(signal, handler) {
  if (!signal) return () => {}
  signal.addEventListener('abort', handler, { once: true })
  return () => signal.removeEventListener('abort', handler)
}
