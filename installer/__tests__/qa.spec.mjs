import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Readable, Writable } from 'node:stream';
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
} from '../install.mjs';

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
    const src = fs.readFileSync(new URL('../install.mjs', import.meta.url), 'utf8');
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
    const { promptAnswers } = await import('../install.mjs');
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
    const { runWizard } = await import('../install.mjs');
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
