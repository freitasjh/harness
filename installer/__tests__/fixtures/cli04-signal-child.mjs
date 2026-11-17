// CLI-04 — fixture de prova PTY. Prompt aberto + SIGTERM; captura `stty -a`
// logo após o restore para provar que o eco voltou antes do término por sinal.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { readSecret, installSignalEchoGuard } from '../../cli/secret.js'
import { defaultPrompts } from '../../cli/wizard.js'

const out = process.env.CLI04_SIGNAL_OUT
const state = { pid: process.pid, restored: false, signal: '', stty: '' }
fs.writeFileSync(out, JSON.stringify(state))

const guard = installSignalEchoGuard({
  onRestore({ signal, restored }) {
    state.restored = restored
    state.signal = signal || ''
    try {
      state.stty = execFileSync('stty', ['-a'], { stdio: [0, 'pipe', 'pipe'], encoding: 'utf8' }).trim()
    } catch (error) {
      state.stty = `ERRO: ${error.message}`
    }
    fs.writeFileSync(out, JSON.stringify(state))
  },
})

const prompts = await defaultPrompts()
await readSecret({ prompts, guard })
process.stdout.write('NAO_DEVERIA_CHEGAR\n')
