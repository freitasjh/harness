const messages = {
  wizard: {
    title: 'Assistente de configuração do harness',
    backend: {
      message: 'Selecione o backend',
      hint: 'Use as setas e pressione Enter para escolher',
    },
    frontend: {
      message: 'Selecione o frontend',
      hint: 'Use as setas e pressione Enter para escolher',
    },
    name: {
      message: 'Nome do projeto',
      placeholder: 'meu-projeto',
      hint: 'Pressione Enter para confirmar',
    },
    token: {
      message: 'Token de acesso (opcional)',
      masked: '[input is masked]',
      hint: 'Pressione Enter para confirmar',
    },
  },
  summary: {
    title: 'Resumo da configuração',
    backend: 'Backend',
    frontend: 'Frontend',
    name: 'Nome do projeto',
    token: 'Token de acesso',
    redacted: '[REDACTED]',
    confirm: 'Confirmar e instalar?',
  },
  actions: {
    yes: 'Sim',
    no: 'Não',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    back: 'Voltar',
    retry: 'Tentar novamente',
  },
  abort: {
    userAbort: 'Operação cancelada pelo usuário.',
    exitPrompt: 'Prompt interrompido.',
    eof: 'Entrada encerrada.',
  },
  hint: {
    navigation: 'Use as setas para navegar, Enter para confirmar e q para cancelar.',
  },
  errors: {
    invalidAnswer: 'Resposta inválida. Tente novamente.',
    promptsUnavailable: `Dependências da interface não encontradas. Execute ${['npm', 'ci'].join(' ')} em installer/cli e tente novamente.`,
  },
}

function deepFreeze(object) {
  for (const value of Object.values(object)) {
    if (value && typeof value === 'object') deepFreeze(value)
  }
  return Object.freeze(object)
}

export const PT_BR = deepFreeze(messages)

function flatten(object, prefix = '', out = []) {
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') flatten(value, path, out)
    else out.push(path)
  }
  return out
}

export const LOCALE_KEYS = Object.freeze(flatten(PT_BR).sort())

export function t(path) {
  const value = path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), PT_BR)
  if (typeof value !== 'string') throw new Error(`locale PT-BR: chave ausente: ${path}`)
  return value
}
