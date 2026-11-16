// ADR-004 / TUI-06 — 8 `op`s de apresentação (D-TUI) em módulo local byte-fiel
// a c63e333. Antes viviam como reexport de `install.mjs` na ponte D1; saem da
// ponte e passam a ser implementação local, como os 29 D-PURE. Nenhuma escrita:
// `apply` permanece no motor (ADR-003). Assinaturas e literais congelados.
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { Writable } from 'node:stream'
import { URL } from 'node:url'
import { canNoEcho, formatError, InstallError, sanitizeLog, validateAnswer } from './contract-pure.mjs'
import { QUESTIONS, W2M_MARKER } from './contract-registry.mjs'

const EOF_ABORT = 'stdin fechado (EOF) antes de concluir o Q&A: passe --answers-file <json>. Abortando sem escrever nada.'
const ABORT_TOKENS = new Set(['q', 'quit', 'cancel', 'cancelar', 'abort', 'abortar'])
const isAbortToken = (s) => ABORT_TOKENS.has(String(s).trim().toLowerCase())

export function readSecretRaw(input, output, { mask = '*' } = {}) {
  if (!canNoEcho(input)) {
    return Promise.reject(new InstallError('leitura sem eco exige stdin TTY com setRawMode', 'SECRET_TTY'));
  }
  const write = (s) => { try { if (output && typeof output.write === 'function') output.write(s); } catch { /* stream opcional */ } };
  return new Promise((resolve, reject) => {
    let buf = '';
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      input.removeListener('data', onData);
      try { input.setRawMode(false); } catch { /* stream sem raw mode */ }
      write('\n');
      if (err) reject(err); else resolve(value);
    };
    const onData = (chunk) => {
      const s = String(chunk);
      for (const ch of s) {
        if (ch === '\r' || ch === '\n') { finish(null, buf); return; }
        if (ch === '\u0003') {
          finish(new InstallError('digitacao do segredo cancelada (Ctrl+C): abortando sem escrever nada.', 'USER_ABORT'), null);
          return;
        }
        if (ch === '\u007F' || ch === '\b') {
          if (buf.length > 0) { buf = buf.slice(0, -1); write('\b \b'); }
          continue;
        }
        buf += ch;
        write(mask);
      }
    };
    input.setRawMode(true);
    input.on('data', onData);
    if (typeof input.resume === 'function') input.resume();
  });
}

export function readSecretPrompt({ input, output, prompt = '' } = {}) {
  if (!canNoEcho(input)) return Promise.resolve(null);
  try { if (output && typeof output.write === 'function') output.write(`${prompt} `); } catch { /* stream opcional */ }
  return readSecretRaw(input, output);
}

function createLineReader({ input, output, terminal = false }) {
  const nullOut = new Writable({ write(_c, _e, cb) { cb(); } });
  const rl = readline.createInterface({
    input,
    output: output || nullOut,
    terminal: terminal === true,
    ...(terminal === true ? { historySize: 0 } : {}),
  });
  const queue = [];
  const waiters = [];
  rl.on('line', (l) => {
    if (waiters.length > 0) waiters.shift()(l);
    else queue.push(l);
  });
  rl.on('close', () => {
    while (waiters.length > 0) waiters.shift()(undefined);
  });
  return {
    next() {
      if (queue.length > 0) return Promise.resolve(queue.shift());
      if (!input || input.readableEnded || input.destroyed) return Promise.resolve(undefined);
      return new Promise((res) => waiters.push(res));
    },
    say(s) {
      try {
        if (output && typeof output.write === 'function') output.write(`${s}\n`);
      } catch { /* output opcional: nunca quebra o prompt */ }
    },
    close() { try { rl.close(); } catch { /* ja fechado */ } },
  };
}

export function promptAnswers(target, { input, output } = {}) {
  let r = createLineReader({ input, output });
  const askOne = async (q) => {
    r.say(`${q.prompt} `);
    const line = await r.next();
    if (line === undefined) throw new InstallError(EOF_ABORT, 'NO_STDIN');
    return line;
  };
  const askSecret = async (q) => {
    if (!canNoEcho(input)) return askOne(q);
    r.close();
    const raw = await readSecretPrompt({ input, output, prompt: q.prompt });
    r = createLineReader({ input, output });
    return raw;
  };
  return (async () => {
    const answers = {};
    for (const q of QUESTIONS.filter((x) => !x.optional)) {
      for (;;) {
        const raw = q.secret ? await askSecret(q) : await askOne(q);
        const value = raw === '' && q.secret ? '' : raw;
        try {
          if (q.secret && value === '') { answers[q.key] = ''; break; }
          answers[q.key] = validateAnswer(target, q.key, value);
          break;
        } catch (e) {
          r.say(sanitizeLog(`resposta invalida para '${q.key}': ${e.message} — tente de novo.`, { ...answers, [q.key]: raw }));
        }
      }
    }
    r.close();
    return answers;
  })().catch((e) => {
    r.close();
    throw e;
  });
}

export function printPlan(plan, { output = process.stdout, answers = {} } = {}) {
  const write = (s) => output.write(`${sanitizeLog(String(s), answers)}\n`);
  const counts = {};
  for (const p of plan) counts[p.action] = (counts[p.action] || 0) + 1;
  write('plano de instalacao:');
  for (const p of plan) {
    const extra = p.reason ? ` — ${p.reason}` : '';
    write(`  ${p.action}  ${p.path}${extra}`);
  }
  const summary = Object.entries(counts).map(([a, n]) => `${a}=${n}`).join(' ');
  write(`resumo: ${plan.length} itens (${summary || 'vazio'})`);
  write('classes: create (novo), merge (aditivo), flag (humano resolve)');
  return { counts, total: plan.length };
}

// `sourceLineOf`: ainda lê o install.mjs congelado — a âncora tem de apontar
// o bloco em runWizard, não a declaração local da constante.
export function sourceLineOf(marker, file = new URL('./install.mjs', import.meta.url).href) {
  try {
    const text = fs.readFileSync(new URL(file), 'utf8');
    const idx = text.split('\n').findLastIndex((l) => l.includes(marker));
    return idx >= 0 ? idx + 1 : null;
  } catch {
    return null;
  }
}

export function menuItemLine(item, width = 0) {
  const extra = item.note ? ` (${item.note})` : '';
  const anchor = item.next ? `segue: ${item.next}` : `stack ${item.stack}`;
  return `  ${item.key}) ${String(item.label).padEnd(width)} -> ${anchor}${extra}`;
}

export function menuChoices(count) {
  const keys = Array.from({ length: count }, (_, i) => String(i + 1));
  if (keys.length === 0) return '';
  if (keys.length === 1) return keys[0];
  return `${keys.slice(0, -1).join(', ')} ou ${keys[keys.length - 1]}`;
}

const w2mErrorWhere = (step) => {
  const line = sourceLineOf(W2M_MARKER);
  return line ? `installer/install.mjs:${line} (W2m-${step})` : `installer/install.mjs (W2m-${step})`;
};

export async function askMenuStep({ read, out, answers = {}, header, items, step, total, defaultKey = null, width = 0 }) {
  out(header);
  for (const item of items) out(menuItemLine(item, width));
  const range = `1-${items.length}`;
  const shownDefault = defaultKey ? ` (default: ${defaultKey})` : '';
  const prompt = `[${step}/${total}] escolha [${range}]${shownDefault} (q cancela) > `;
  for (;;) {
    const raw = (await read(prompt)).trim();
    if (raw === '' && defaultKey) {
      const fallback = items.find((i) => i.key === defaultKey);
      if (fallback) return fallback;
    }
    const hit = items.find((i) => i.key === raw);
    if (hit) return hit;
    out(formatError({
      what: `opcao '${raw}' invalida — digite ${menuChoices(items.length)} (ou 'q' para cancelar).`,
      code: 'BAD_ANSWER',
      why: `fora de [${range.replace('-', ',')}]`,
      fix: 'escolha o numero de um dos itens listados acima (ou q para cancelar).',
      where: w2mErrorWhere(step),
    }, answers));
  }
}

export function pubspecDeclaresFlutter(text) {
  for (const raw of String(text).split('\n')) {
    const line = raw.replace(/#.*$/, '');
    if (/^\s*sdk:\s*flutter\s*$/.test(line)) return true;
    if (/^\s*flutter:\s*$/.test(line)) return true;
  }
  return false;
}

export function detect(target) {
  const t = path.resolve(target);
  const file = 'pubspec.yaml';
  const pubPath = path.join(t, file);
  const result = {
    hasPubspec: fs.existsSync(pubPath),
    name: null,
    sdk: null,
    declaresFlutter: false,
    suggestedStack: null,
    sources: [],
    warnings: [],
  };
  if (!result.hasPubspec) return result;
  let text;
  try {
    text = fs.readFileSync(pubPath, 'utf8');
  } catch {
    result.warnings.push(`${file}: ilegivel`);
    return result;
  }
  let inEnvironment = false;
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '');
    const nameMatch = line.match(/^name:\s*(.+?)\s*$/);
    if (nameMatch && result.name === null) {
      result.name = nameMatch[1].replace(/^["']|["']$/g, '');
      result.sources.push({ field: 'project', file, line: i + 1 });
    }
    if (/^environment:\s*$/.test(line)) { inEnvironment = true; return; }
    if (/^\S/.test(line) && line.trim() !== '') inEnvironment = false;
    if (inEnvironment) {
      const sdkMatch = line.match(/^\s+sdk:\s*(.+?)\s*$/);
      if (sdkMatch) {
        result.sdk = sdkMatch[1].replace(/^["']|["']$/g, '');
        result.sources.push({ field: 'environment.sdk', file, line: i + 1 });
        inEnvironment = false;
      }
    }
    if (/^\s*flutter:\s*$/.test(line) || /^\s*sdk:\s*flutter\s*$/.test(line)) {
      result.sources.push({ field: 'stack', file, line: i + 1 });
      result.declaresFlutter = true;
    }
  });
  result.declaresFlutter = result.declaresFlutter || pubspecDeclaresFlutter(text);
  result.suggestedStack = result.declaresFlutter ? 'flutter' : 'dart';
  return result;
}

export function printUsage({ output = process.stdout } = {}) {
  output.write(`uso: node installer/install.mjs init   --target <dir> [--dry-run] [--answers-file <json>] [--yes] [--backup-dir <dir>] [--allow-root]\n`);
  output.write(`uso: node installer/install.mjs doctor   --target <dir> [--answers-file <json>] [--backup-dir <dir>] [--allow-root]\n`);
  output.write(`uso: node installer/install.mjs upgrade --target <dir> [--dry-run] [--answers-file <json>] [--yes] [--backup-dir <dir>] [--allow-root]\n`);
  output.write(`  init: greenfield create-only — so create|generate-overwrite|noop passam; merge|flag abortam com dica de doctor.\n`);
  output.write(`  doctor: brownfield read-only — D0-D6 diagnostico, zero writes; ignora --dry-run/--yes.\n`);
  output.write(`  upgrade: sobrescreve camadas gerenciadas pela versao atual do harness; backup automatico antes de escrever; idempotente; exige manifesto proprio.\n`);
  output.write(`  sem --answers-file exige stdin interativo ou pipado; stdin fechado aborta sem escrever.\n`);
  output.write(`  --dry-run: zero writes (nem backup cria); imprime plano + relatorio.\n`);
  output.write(`  legado (sem init|doctor): node installer/install.mjs --target <dir> [--dry-run] [--answers-file <json>] [--yes] [--backup-dir <dir>] [--allow-root]\n`);
}

export const TUI_OPS_LOCAL = Object.freeze([
  'askMenuStep', 'detect', 'printPlan', 'printUsage', 'promptAnswers',
  'readSecretPrompt', 'readSecretRaw', 'sourceLineOf',
])
