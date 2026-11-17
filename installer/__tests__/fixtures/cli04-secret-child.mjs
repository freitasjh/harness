// CLI-04 — fixture de prova PTY. Segredo entra pelo TTY, nunca por argv/canal.
import fs from 'node:fs'
import { readSecret } from '../../cli/secret.js'
import { defaultPrompts } from '../../cli/wizard.js'

const out = process.env.CLI04_CHILD_OUT
const prompts = await defaultPrompts()
const value = await readSecret({ prompts })

const cmdline = fs.readFileSync('/proc/self/cmdline', 'utf8').replace(/\0/g, ' ').trim()
fs.writeFileSync(out, JSON.stringify({
  pid: process.pid,
  cmdline,
  length: value.length,
  cmdlineLeaked: cmdline.includes('SEGREDO_PROVA'),
}))
process.stdout.write('SECRET_READ_OK\n')
