import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  QUESTIONS,
  validateAnswer,
  collectAnswers,
  serializeAnswers,
  sanitizeLog,
  stripAnsiControls,
  buildManifest,
  runCli,
  loadAnswersFile,
  formatError,
} from '../installer-contract.mjs';
import { oracleSource } from './oracle.mjs';

const specDir = path.dirname(fileURLToPath(import.meta.url));

let dirs = [];
function mkTemp(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in02-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe('IN-02 S1: respostas validas => answers completos', () => {
  it('Q&A fake com respostas scriptadas passa', () => {
    const target = mkTemp({});
    fs.mkdirSync(path.join(target, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(target, 'scripts', 'suite.sh'), '#!/bin/sh\n');
    const scripted = {
      project: 'demo',
      suiteCommand: path.join(target, 'scripts', 'suite.sh'),
      pluginsDir: target,
      stack: 'node',
    };
    const answers = collectAnswers(target, scripted);
    assert.equal(answers.project, 'demo');
    assert.equal(answers.stack, 'node');
  });
});

describe('IN-02 S2: resposta invalida => rejeita', () => {
  it('path inexistente rejeita', () => {
    const target = mkTemp({});
    assert.throws(() => validateAnswer(target, 'pluginsDir', '/nao/existe/xyz'), /exist/i);
  });
  it('comando que nao resolve rejeita', () => {
    const target = mkTemp({});
    assert.throws(() => validateAnswer(target, 'suiteCommand', '/nao/existe/cmd-xyz'), /resolv|not found|ENOENT/i);
  });
  it('collectAnswers com path ruim rejeita e nao retorna parcial valido', () => {
    const target = mkTemp({});
    assert.throws(() => collectAnswers(target, { project: 'x', suiteCommand: 'node', pluginsDir: '/nope', stack: 'node' }), /exist|outside/i);
  });
});

describe('IN-02 S3: segredo ausente de disco', () => {
  it('campo secret so-memoria: serializacao exclui', () => {
    const q = QUESTIONS.find((x) => x.secret);
    assert.ok(q, 'existe ao menos uma questao secret');
    const answers = { project: 'demo', stack: 'node', [q.key]: 'FAKE-SECRET-abc123' };
    const disk = serializeAnswers(answers);
    assert.ok(!JSON.stringify(disk).includes('FAKE-SECRET-abc123'), 'segredo ausente do objeto serializavel');
    assert.equal(answers[q.key], 'FAKE-SECRET-abc123', 'memoria mantem');
  });
  it('QUESTIONS marca secret explicitamente', () => {
    for (const q of QUESTIONS.filter((x) => x.secret)) {
      assert.ok(q.key && q.prompt, 'secret tem key+prompt');
    }
  });
});

// INS-05 (REQ-14/R1): log sempre com contexto de segredos
describe('INS-05 S1: log com token canario redigido', () => {
  it('qualquer log/say com o canario sai sem o canario', () => {
    const canary = 'CANARIO-INS05-t7k2';
    const answers = { project: 'p', stack: 'node', deployToken: canary };
    assert.ok(!sanitizeLog(`token=${canary} ok`, answers).includes(canary));
  });

  it('runCli dry-run com token no answers-file: stdout+stderr sem canario', async () => {
    const canary = 'CANARIO-INS05-cli8';
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-ins05-'));
    dirs.push(d);
    const af = path.join(d, 'answers.json');
    fs.writeFileSync(af, JSON.stringify({ project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: d, deployToken: canary }));
    let outBuf = '';
    let errBuf = '';
    const out = new Writable({ write(c, _e, cb) { outBuf += c.toString(); cb(); } });
    const err = new Writable({ write(c, _e, cb) { errBuf += c.toString(); cb(); } });
    await runCli({ argv: ['--target', d, '--allow-root', '--dry-run', '--answers-file', af], stdin: Readable.from([]), stdout: out, stderr: err });
    assert.ok(!outBuf.includes(canary), 'stdout sem canario');
    assert.ok(!errBuf.includes(canary), 'stderr sem canario');
  });
});

describe('INS-05 S2: scan estatico — zero sanitizeLog( sem answers', () => {
  it('toda chamada passa o 2º argumento (contexto vigente)', () => {
    const src = oracleSource();
    const bad = [];
    src.split('\n').forEach((raw, i) => {
      const code = raw.replace(/\/\/.*$/, '');
      if (/function\s+sanitizeLog/.test(code)) return;
      const at = code.indexOf('sanitizeLog(');
      if (at < 0) return;
      let depth = 0;
      let commaAtDepth1 = false;
      for (let j = at + 'sanitizeLog'.length; j < code.length; j++) {
        const ch = code[j];
        if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (depth === 0) break; }
        else if (ch === ',' && depth === 1) commaAtDepth1 = true;
      }
      if (!commaAtDepth1) bad.push(i + 1);
    });
    assert.deepEqual(bad, [], 'call sem contexto = H1 reaberto');
  });
});

describe('INS-05 S3: resumo W4 + manifesto sem canario', () => {
  it('serializeAnswers + resumo + manifesto omitem o segredo', () => {
    const canary = 'CANARIO-INS05-m9w1';
    const answers = { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: '/tmp/x', deployToken: canary };
    const resumo = JSON.stringify(serializeAnswers(answers));
    assert.ok(!resumo.includes(canary), 'resumo W4 sem canario');
    const manifest = buildManifest({ target: '/tmp/t', backupDir: '/tmp/b', answers });
    assert.ok(!JSON.stringify(manifest).includes(canary), 'manifesto sem canario');
  });
});

// INS-06 (REQ-18/M4): strip ANSI/controle antes de exibir
describe('INS-06 S1: answer com escape ANSI exibida sem efeito', () => {
  it('output contem ola sem \\x1b', () => {
    const cleaned = stripAnsiControls('\x1b[2Jola');
    assert.ok(cleaned.includes('ola'));
    assert.ok(!cleaned.includes('\x1b'), 'escape removido');
    const viaLog = sanitizeLog('eco: \x1b[2Jola', {});
    assert.ok(viaLog.includes('ola') && !viaLog.includes('\x1b'));
  });
});

describe('INS-06 S2: \\r overwrite removido', () => {
  it('sem \\r no output', () => {
    assert.ok(!stripAnsiControls('a\rb').includes('\r'));
    assert.ok(!sanitizeLog('a\rb', {}).includes('\r'));
  });
});

describe('INS-06 S3: \\n\\t preservados, demais controles removidos', () => {
  it('\\n\\t intactos; \\x07 removido', () => {
    const cleaned = stripAnsiControls('a\n\tb\x07c');
    assert.ok(cleaned.includes('\n') && cleaned.includes('\t'), '\\n\\t preservados');
    assert.ok(!cleaned.includes('\x07'), 'controle removido');
  });
});

describe('INS-06 ordem: strip-then-redact (REQ-18)', () => {
  it('token com ANSI em volta sai sem escape e sem token', () => {
    const canary = 'CANARIO-INS06-z4q8';
    const answers = { project: 'p', stack: 'node', deployToken: canary };
    const out = sanitizeLog(`\x1b[1m${canary}\x1b[0m`, answers);
    assert.ok(!out.includes('\x1b'), 'sem escape');
    assert.ok(!out.includes(canary), 'sem segredo');
  });
});

// INS-17 --answers-file validado (REQ-15/M1) — TDD FIRST
describe('INS-17 S1: arquivo objeto valido carrega e pula respondidas', () => {
  it('loadAnswersFile devolve objeto; collectAnswers aplica', () => {
    const d = mkTemp({});
    const af = path.join(d, 'answers.json');
    fs.writeFileSync(af, JSON.stringify({ project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: d }));
    const loaded = loadAnswersFile(af);
    assert.equal(loaded.project, 'demo');
    const answers = collectAnswers(d, loaded);
    assert.equal(answers.stack, 'node');
    assert.equal(answers.deployToken, '', 'segredo ausente => vazio');
  });
});

describe('INS-17 S2: arquivo array aborta BAD_ANSWER em bloco', () => {
  it('loadAnswersFile rejeita [1,2] com BAD_ANSWER', () => {
    const d = mkTemp({});
    const af = path.join(d, 'answers.json');
    fs.writeFileSync(af, '[1,2]');
    let err = null;
    try {
      loadAnswersFile(af);
    } catch (e) {
      err = e;
    }
    assert.ok(err && err.code === 'BAD_ANSWER', 'array => BAD_ANSWER');
    const block = formatError({ what: `answers-file invalido: ${af}`, code: err.code, fix: 'passe um JSON objeto.', where: af }, {});
    assert.match(block, /\[ERRO\]/);
    assert.match(block, /porquê: BAD_ANSWER/);
    assert.match(block, /como corrigir:/);
    assert.match(block, /onde ver:/);
  });
});

describe('INS-17 S3: token do arquivo so-memoria (nunca serializado)', () => {
  it('CANARIO_Y ausente em serializeAnswers + resumo + manifesto', () => {
    const canary = 'CANARIO-INS17-Y5t2';
    const d = mkTemp({});
    const af = path.join(d, 'answers.json');
    fs.writeFileSync(af, JSON.stringify({ project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: d, deployToken: canary }));
    const loaded = loadAnswersFile(af);
    assert.equal(loaded.deployToken, canary, 'arquivo carrega o segredo em memoria');
    assert.ok(!JSON.stringify(serializeAnswers(loaded)).includes(canary), 'serializeAnswers sem canario');
    const manifest = buildManifest({ target: d, backupDir: path.join(d, '..'), answers: loaded });
    assert.ok(!JSON.stringify(manifest).includes(canary), 'manifesto sem canario');
  });
});

// INS-18 segredo sem eco em W3 (REQ-16/M2) — TDD FIRST
describe('INS-18 pipe (nao-TTY): leitor historico, sem hang', () => {
  it('token via pipe capturado sem eco e sem travar (retrocompat)', async () => {
    const { promptAnswers } = await import('../installer-contract.mjs');
    const d = mkTemp({});
    const input = Readable.from(['demo\n', 'node\n', 'node\n', `${d}\n`, 'TOKEN-pipe-1\n']);
    let buf = '';
    const output = new Writable({ write(c, _e, cb) { buf += c.toString(); cb(); } });
    const p = promptAnswers(d, { input, output });
    const answers = await Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('HANG')), 5000))]);
    assert.equal(answers.deployToken, 'TOKEN-pipe-1');
    assert.ok(!buf.includes('TOKEN-pipe-1'), 'pipe nao ecoa o token');
  });
});

describe('INS-18 wizard W3: token mascarado, proxima resposta intacta', () => {
  it('token digitado nao aparece no output e nao vaza p/ proxima', async () => {
    const { runWizard } = await import('../installer-contract.mjs');
    const d = mkTemp({});
    const src = mkTemp({ '.agents/rules/a.md': '# a\n', 'opencode.json': JSON.stringify({ plugin: ['harness'] }) });
    const input = Readable.from(['3\n', 'demo\n', '\n', '\n', '\n', 'TOKEN-w3-9\n']);
    let buf = '';
    const output = new Writable({ write(c, _e, cb) { buf += c.toString(); cb(); } });
    const res = await runWizard({
      target: d,
      stdin: input,
      stdout: output,
      sourceDir: src,
      options: { allowRoot: true, yes: true },
    });
    assert.equal(res.answers.deployToken, 'TOKEN-w3-9');
    assert.ok(!buf.includes('TOKEN-w3-9'), 'token nunca exibido no wizard');
  });
});

// ---------------------------------------------------------------------------
// CLI-04 — segredo sem eco, aborto 0 writes, restore de eco (ADR-002 §3 5/7).
// Oráculo escrito à mão: nenhum valor é lido do módulo sob teste para formar
// a expectativa. `SEGREDO_PROVA` é canário — nunca entra em argv/canal.
// ---------------------------------------------------------------------------

function treeHash(root) {
  const hash = createHash('sha256');
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full);
      if (entry.isDirectory()) {
        hash.update(`d:${rel}\n`);
        walk(full);
      } else {
        const content = fs.readFileSync(full);
        hash.update(`f:${rel}:${content.length}\n`);
        hash.update(content);
      }
    }
  };
  walk(root);
  return hash.digest('hex');
}

function runPty({ command, env = {}, input = '', inputDelayMs = 0, closeStdin = true, timeoutMs = 20000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn('script', ['-q', '-e', '-c', command, '/dev/null'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* já encerrado */ }
      reject(new Error('PTY timeout'));
    }, timeoutMs);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
    if (input) {
      if (inputDelayMs > 0) {
        setTimeout(() => { try { child.stdin.write(input); } catch { /* já encerrado */ } }, inputDelayMs);
        if (closeStdin) setTimeout(() => { try { child.stdin.end(); } catch { /* já encerrado */ } }, inputDelayMs + 1200);
      } else {
        child.stdin.write(input);
        if (closeStdin) child.stdin.end();
      }
    } else if (closeStdin) {
      child.stdin.end();
    }
  });
}

async function waitForFile(file, timeoutMs = 10000) {
  const started = Date.now();
  while (!fs.existsSync(file)) {
    if (Date.now() - started > timeoutMs) throw new Error(`arquivo não apareceu: ${file}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe('CLI-04 · segredo mask real (não só [REDACTED] do resumo)', () => {
  it('password config mascarar entrada, desliga toggle e vem da chave de locale', async () => {
    const secret = await import('../cli/secret.js');
    const { t } = await import('../cli/locale.js');
    const cfg = secret.secretPromptConfig();
    assert.equal(cfg.message, t('wizard.token.message'));
    assert.equal(cfg.toggleMask, false, 'Ctrl+T não pode revelar o segredo');
    assert.equal(cfg.mask, false, 'usa maskedText do tema; string repetiria por caractere');
    assert.equal(cfg.theme.style.maskedText, t('wizard.token.masked'));
    assert.equal(JSON.stringify(cfg).includes('SEGREDO_PROVA'), false);
  });

  it('redactSecret: resumo e manifesto nunca contêm o valor', async () => {
    const secret = await import('../cli/secret.js');
    const { t } = await import('../cli/locale.js');
    assert.equal(secret.redactSecret('SEGREDO_PROVA'), t('summary.redacted'));
    assert.equal(secret.redactSecret(''), t('summary.redacted'));
    assert.ok(!secret.redactSecret('SEGREDO_PROVA').includes('SEGREDO'));
  });

  it('SEGREDO_PROVA 0 em /proc/$PID/cmdline, stdout, stderr e transcript (PTY real)', async () => {
    const secret = await import('../cli/secret.js');
    assert.equal(typeof secret.readSecret, 'function');
    const out = path.join(mkTemp({}), 'child.json');
    const fixture = path.join(specDir, 'fixtures', 'cli04-secret-child.mjs');
    const res = await runPty({
      command: `${process.execPath} ${fixture}`,
      env: { CLI04_CHILD_OUT: out },
      input: 'SEGREDO_PROVA\r',
      inputDelayMs: 700,
    });
    assert.equal(res.code, 0, `child falhou: ${res.stderr}`);
    const state = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(state.length, 'SEGREDO_PROVA'.length, 'valor lido em memória');
    assert.equal(state.cmdlineLeaked, false, 'cmdline vazou SEGREDO_PROVA');
    assert.ok(!res.stdout.includes('SEGREDO_PROVA'), 'stdout vazou SEGREDO_PROVA');
    assert.ok(!res.stderr.includes('SEGREDO_PROVA'), 'stderr vazou SEGREDO_PROVA');
    assert.ok(!fs.readFileSync(out, 'utf8').includes('SEGREDO_PROVA'), 'estado/transcript vazou');
  });
});

describe('CLI-04 · aborto q/EOF/ExitPromptError/USER_ABORT ⇒ 0 writes', () => {
  it('hash de árvore antes=depois e nenhum write no aborto', async () => {
    const { runVisualWizard } = await import('../cli/wizard.js');
    const { USER_ABORT } = await import('../cli/abort.js');
    const target = mkTemp({ 'mantido.txt': 'conteudo\n', 'sub/a.txt': 'a' });
    const before = treeHash(target);
    let writes = 0;
    const sink = () => { writes += 1; };

    const controller = new AbortController();
    controller.abort();
    const never = async () => { throw new Error('prompt não devia ser chamado'); };
    await assert.rejects(
      runVisualWizard({ prompts: { select: never, input: never, password: never }, signal: controller.signal, write: sink }),
      (error) => error.code === USER_ABORT,
    );

    const promptsExit = {
      select: async () => { const e = new Error('interrupt'); e.name = 'ExitPromptError'; throw e; },
      input: never,
      password: never,
    };
    await assert.rejects(
      runVisualWizard({ prompts: promptsExit, write: sink }),
      (error) => error.code === USER_ABORT,
    );

    const promptsQ = {
      select: async () => { const e = new Error('q'); e.name = 'ExitPromptError'; throw e; },
      input: never,
      password: never,
    };
    await assert.rejects(
      runVisualWizard({ prompts: promptsQ, write: sink }),
      (error) => error.code === USER_ABORT,
    );

    assert.equal(writes, 0, 'nenhum write em nenhum caminho de aborto');
    assert.equal(treeHash(target), before, 'hash da árvore mudou => write no aborto');
  });

  it('erro comum NÃO é disfarçado de aborto', async () => {
    const { runVisualWizard } = await import('../cli/wizard.js');
    const { USER_ABORT } = await import('../cli/abort.js');
    const prompts = {
      select: async () => { throw new Error('boom-real'); },
      input: async () => '',
      password: async () => '',
    };
    await assert.rejects(
      runVisualWizard({ prompts, write: () => {} }),
      (error) => /boom-real/.test(error.message) && error.code !== USER_ABORT,
    );
  });
});

describe('CLI-04 · isAbortError e onAbort (dívida do review CLI-01)', () => {
  it('isAbortError distingue AbortError de erro comum', async () => {
    const { isAbortError, USER_ABORT, classifyAbort } = await import('../cli/abort.js');
    class AbortError extends Error {
      constructor() { super('aborted'); this.name = 'AbortError'; }
    }
    assert.equal(isAbortError(new AbortError()), true);
    assert.equal(isAbortError(new Error('boom')), false);
    assert.equal(isAbortError(null), false);
    assert.equal(classifyAbort(new AbortError()), USER_ABORT);
  });

  it('onAbort registra uma vez e devolve unsubscribe idempotente', async () => {
    const { onAbort } = await import('../cli/abort.js');
    const controller = new AbortController();
    let calls = 0;
    const off = onAbort(controller.signal, () => { calls += 1; });
    assert.equal(typeof off, 'function');
    controller.abort();
    assert.equal(calls, 1, 'abort disparou exatamente uma vez');
    controller.abort();
    assert.equal(calls, 1, 'handler once');
    off();
    const offNoSignal = onAbort(null, () => { calls += 1; });
    assert.doesNotThrow(offNoSignal);
  });
});

describe('CLI-04 · SIGTERM com prompt aberto restaura o eco', () => {
  it('stty -a mostra eco ON, término por sinal (nunca exit 0), handler idempotente', async () => {
    const secret = await import('../cli/secret.js');
    assert.equal(typeof secret.installSignalEchoGuard, 'function');
    assert.equal(typeof secret.restoreEcho, 'function');
    const out = path.join(mkTemp({}), 'signal.json');
    const fixture = path.join(specDir, 'fixtures', 'cli04-signal-child.mjs');
    const running = runPty({
      command: `${process.execPath} ${fixture}`,
      env: { CLI04_SIGNAL_OUT: out },
      closeStdin: false,
    });
    await waitForFile(out);
    const pid = JSON.parse(fs.readFileSync(out, 'utf8')).pid;
    process.kill(pid, 'SIGTERM');
    const res = await running;
    assert.notEqual(res.code, 0, 'exit 0 após sinal é proibido');
    const state = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(state.restored, true, 'restore não executou');
    assert.equal(state.signal, 'SIGTERM');
    assert.match(state.stty, /(?:^|\s)echo(?:\s|$)/, 'stty -a não mostrou eco ON');
    assert.doesNotMatch(state.stty, /(?:^|\s)-echo(?:\s|$)/, 'stty -a mostrou -echo');
  });
});

describe('CLI-04 · dívidas: defaultPrompts legível + wiring configFromSelection', () => {
  it('defaultPrompts() sem lib => erro legível PROMPTS_UNAVAILABLE, não ERR_MODULE_NOT_FOUND', async () => {
    const { defaultPrompts } = await import('../cli/wizard.js');
    const { t } = await import('../cli/locale.js');
    const cause = Object.assign(new Error("Cannot find package '@inquirer/prompts'"), { code: 'ERR_MODULE_NOT_FOUND' });
    await assert.rejects(
      defaultPrompts({ importPrompts: async () => { throw cause; } }),
      (error) => {
        assert.equal(error.code, 'PROMPTS_UNAVAILABLE');
        assert.match(error.message, /npm ci/i);
        assert.equal(error.message.includes('ERR_MODULE_NOT_FOUND'), false);
        assert.equal(error.cause, cause, 'causa preservada para diagnóstico');
        return true;
      },
    );
    assert.match(t('errors.promptsUnavailable'), /npm ci/i);
  });

  it('runVisualWizard (caminho de produção) entrega config de configFromSelection', async () => {
    const { runVisualWizard } = await import('../cli/wizard.js');
    const { generateConfig } = await import('../installer-contract.mjs');
    const calls = [];
    const script = ['rust', 'vue', 'demo', 'SEGREDO_PROVA'];
    const prompts = {
      select: async (cfg) => {
        const value = script.shift();
        const idx = cfg.choices.findIndex((c) => c.value === value);
        const def = cfg.choices.findIndex((c) => c.value === cfg.default);
        calls.push({ kind: 'select', arrows: Math.abs(idx - def) });
        return value;
      },
      input: async () => { calls.push({ kind: 'input' }); return 'demo'; },
      password: async () => { calls.push({ kind: 'password' }); return 'SEGREDO_PROVA'; },
    };
    const result = await runVisualWizard({ prompts, write: () => {} });
    assert.ok(result.config, 'configFromSelection não foi chamado no caminho de produção');
    const literal = generateConfig({ project: 'demo', axes: { backend: 'rust', frontend: 'vue' } });
    assert.equal(JSON.stringify(result.config), JSON.stringify(literal), 'config divergiu da ADR-001');
    assert.deepEqual(result.telas, ['backend', 'frontend', 'name', 'token']);
    assert.equal(calls.length, 4, 'N/M alterados');
    assert.equal(calls[0].arrows, 2, 'java→rust = 2 setas');
    assert.equal(calls[1].arrows, 1, 'react→vue = 1 seta');
    assert.ok(!JSON.stringify(result.summary).includes('SEGREDO_PROVA'), 'resumo vazou segredo');
  });
});
