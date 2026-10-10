import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import {
  main,
  planMerge,
  printPlan,
  collectIncoming,
  promptAnswers,
  resolveAnswerSource,
  canNoEcho,
  readSecretRaw,
  readSecretPrompt,
  InstallError,
} from '../install.mjs';

let dirs = [];
function mkTarget(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cli-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
afterEach(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); dirs = []; });

const OPTS = { allowRoot: true, nodeVersion: 'v26.7.0' };

function pipedInput(lines) {
  return Readable.from(lines.map((l) => `${l}\n`));
}
function nullOutput() {
  return new Writable({ write(_c, _e, cb) { cb(); } });
}
function capture() {
  let buf = '';
  const stream = new Writable({ write(c, _e, cb) { buf += c.toString(); cb(); } });
  return { stream, text: () => buf };
}

describe('CLI-01: stdin fechado sem --answers-file => aborta (nunca trava)', () => {
  it('resolveAnswerSource sem tty e sem answers-file => aborta alto', () => {
    assert.throws(
      () => resolveAnswerSource({ stdinIsTTY: false, stdinKind: 'char', answersFile: null }),
      /stdin|answers-file|abort/i,
    );
    assert.throws(
      () => resolveAnswerSource({ stdinIsTTY: false, stdinKind: 'unknown', answersFile: null }),
      /stdin|answers-file|abort/i,
    );
  });

  it('resolveAnswerSource: pipe/arquivo/tty/file liberam; char aborta', () => {
    assert.equal(resolveAnswerSource({ stdinIsTTY: true, stdinKind: 'tty', answersFile: null }).mode, 'prompt');
    assert.equal(resolveAnswerSource({ stdinIsTTY: false, stdinKind: 'fifo', answersFile: null }).mode, 'prompt');
    assert.equal(resolveAnswerSource({ stdinIsTTY: false, stdinKind: 'file', answersFile: null }).mode, 'prompt');
    assert.equal(resolveAnswerSource({ stdinIsTTY: false, stdinKind: 'char', answersFile: 'a.json' }).mode, 'file');
  });

  it('processo real com stdin fechado sai != 0 com mensagem (timeout = travou)', () => {
    const target = mkTarget({});
    let out = '';
    let code = 0;
    try {
      out = execFileSync('node', ['installer/install.mjs', '--target', target, '--allow-root'], {
        cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..'),
        input: '',
        encoding: 'utf8',
        timeout: 15000,
      });
    } catch (e) {
      code = e.status ?? 1;
      out = String(e.stderr ?? e.stdout ?? e.message);
    }
    assert.notEqual(code, 0, 'stdin fechado deve abortar, nao sair 0');
    assert.match(out, /stdin|answers-file|abort/i, 'mensagem orienta para --answers-file');
    assert.deepEqual(fs.readdirSync(target), [], 'nada escrito apos abort');
  });
});

describe('CLI-02: dry-run = ZERO writes (inclui sem backup)', () => {
  it('main dry-run nao chama nenhuma escrita (FS com contador)', () => {
    const target = mkTarget({ '.agents/rules/velha.md': '# destino\n' });
    const before = JSON.stringify(fs.readdirSync(target));
    const orig = {};
    let writes = 0;
    for (const m of ['writeFileSync', 'mkdirSync', 'cpSync', 'copyFileSync']) {
      orig[m] = fs[m];
      fs[m] = (...a) => { writes++; return orig[m](...a); };
    }
    let out;
    try {
      out = main({
        target,
        scriptedAnswers: { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: target },
        incomingFiles: { '.agents/rules/velha.md': '# outra\n', '.agents/rules/nova.md': '# nova\n' },
        options: { ...OPTS, dryRun: true },
      });
    } finally {
      for (const m of Object.keys(orig)) fs[m] = orig[m];
    }
    assert.equal(out.dryRun, true);
    assert.equal(out.backup.skipped, true, 'dry-run nao cria backup');
    assert.ok(out.backup.backupDir == null, 'sem backupDir em dry-run');
    assert.equal(writes, 0, `dry-run: zero writes (contadas ${writes})`);
    assert.equal(JSON.stringify(fs.readdirSync(target)), before, 'disco intocado');
    assert.ok(!fs.existsSync(path.join(target, '.harness-install.json')), 'sem manifesto em dry-run');
    assert.ok(!fs.existsSync(path.join(target, '.agents/rules/nova.md')), 'nada instalado em dry-run');
  });
});

// FU-28: main() em --dry-run devolvia `checks: { passed: true, failed: [] }` —
// um PASS que nUNCA rodou. Consumidor que lesse `passed === true` interpretaria
// instalacao verificada sem verificacao. Agora o dry-run sinaliza explicitamente.
describe('CLI-02b FU-28: dry-run sinaliza checks NAO-executados', () => {
  it('main dry-run: checks.passed === null (nao true), ran/skipped/reason explicitos', () => {
    const target = mkTarget({ '.agents/rules/velha.md': '# destino\n' });
    const out = main({
      target,
      scriptedAnswers: { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: target },
      incomingFiles: { '.agents/rules/nova.md': '# nova\n' },
      options: { ...OPTS, dryRun: true },
    });
    assert.equal(out.dryRun, true);
    assert.notEqual(out.checks.passed, true, 'dry-run NUNCA pode dizer PASS');
    assert.equal(out.checks.passed, null, 'passed null = veredito desconhecido (nao rodou)');
    assert.equal(out.checks.ran, false, 'ran false explicito');
    assert.equal(out.checks.skipped, true, 'skipped true explicito');
    assert.match(out.checks.reason, /dry-run/, 'reason nomeia o dry-run');
    assert.deepEqual(out.checks.failed, []);
    // manifesto em memoria tambem nao mente
    assert.notEqual(out.manifest.checks.passed, true, 'manifesto nao carrega PASS mentiroso');
  });

  it('main REAL: checks continua { passed: boolean, failed: [] } (ran implicito verdadeiro)', () => {
    const target = mkTarget({});
    const out = main({
      target,
      scriptedAnswers: { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: target },
      incomingFiles: { '.agents/rules/x.md': '# regra limpa harness\n' },
      options: { ...OPTS, backupRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'harness-fu28-')) },
    });
    dirs.push(out.backup.backupDir);
    assert.equal(out.checks.passed, true, 'instalacao real roda os checks');
    assert.equal(out.checks.ran, undefined, 'caminho real nao carrega os campos de dry-run');
    assert.ok(fs.existsSync(path.join(target, '.harness-install.json')));
  });
});

describe('CLI-03: plano impresso contem create/merge/flag', () => {
  it('printPlan lista as 3 classes com paths', () => {
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['dest'], instructions: ['hard'] }),
      '.agents/rules/conflito.md': '# destino\n',
    });
    const plan = planMerge(target, {
      'opencode.json': JSON.stringify({ plugin: ['dest', 'harness'], instructions: ['hard'] }),
      '.agents/rules/conflito.md': '# outro\n',
      '.agents/rules/nova.md': '# nova\n',
    });
    const actions = new Set(plan.map((p) => p.action));
    assert.ok(actions.has('create'), 'fixture tem create');
    assert.ok(actions.has('merge'), 'fixture tem merge');
    assert.ok(actions.has('flag'), 'fixture tem flag');
    const lines = [];
    printPlan(plan, { output: { write: (s) => lines.push(s) } });
    const text = lines.join('\n');
    assert.match(text, /create/i);
    assert.match(text, /merge/i);
    assert.match(text, /flag/i);
    for (const p of plan) assert.ok(text.includes(p.path), `plano cita ${p.path}`);
  });
});

describe('CLI-04: Q&A pipado valida respostas', () => {
  it('stdin pipado com respostas validas => answers validados', async () => {
    const target = mkTarget({});
    const answers = await promptAnswers(target, {
      input: pipedInput(['demo', 'node', 'node', target, '']),
      output: nullOutput(),
    });
    assert.equal(answers.project, 'demo');
    assert.equal(answers.stack, 'node');
    assert.equal(answers.suiteCommand, 'node');
    assert.equal(answers.pluginsDir, path.resolve(target));
  });

  it('resposta invalida repete a pergunta ate validar', async () => {
    const target = mkTarget({});
    const answers = await promptAnswers(target, {
      input: pipedInput(['demo', 'RUIM', 'node', 'node', target, '']),
      output: nullOutput(),
    });
    assert.equal(answers.stack, 'node', 'rejeitou RUIM e aceitou node');
  });

  it('EOF antes de completar => aborta alto (nao trava)', async () => {
    const target = mkTarget({});
    await assert.rejects(
      promptAnswers(target, { input: pipedInput(['so-projeto']), output: nullOutput() }),
      /stdin|abort|EOF/i,
    );
  });
});

// FU-27: segredo (deployToken) lido com eco no TTY vazava para quem olhasse a
// tela. Correcao: leitura SEM ECO (setRawMode + mascara '*'). Sem raw-mode
// (pipe/redirect/teste) segue o leitor de linha — com aviso de --answers-file.
describe('FU-27 segredo sem eco no TTY', () => {
  // TTY simulado com digitacao SEQUENCIAL (delay por chunk): stream eager
  // drenaria o script inteiro no buffer do readline antes da pergunta do
  // segredo (o proprio fenomeno de typed-ahead de um TTY real). O delay mantem
  // o Q&A e a entrada em sincronia, como um usuario digitando.
  function ttyTyping(chunks, delayMs = 10) {
    const input = new Readable({ read() {} });
    input.isTTY = true;
    input.setRawMode = () => input;
    chunks.forEach((c, i) => setTimeout(() => { try { input.push(Buffer.from(c)); } catch { /* ja fechado */ } }, i * delayMs));
    return input;
  }
  const noHang = (p, ms = 3000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('HANG: leitura nao resolveu')), ms))]);

  it('canNoEcho: true so em TTY real com setRawMode', () => {
    assert.equal(canNoEcho(ttyTyping(['x'])), true);
    assert.equal(canNoEcho(pipedInput(['x'])), false, 'pipe nao tem setRawMode');
    const noRaw = pipedInput(['x']);
    noRaw.isTTY = true;
    assert.equal(canNoEcho(noRaw), false, 'isTTY sem setRawMode (stream injetado) nao engana');
    assert.equal(canNoEcho(null), false);
  });

  it('readSecretRaw: le os caracteres, mascara com * e resolve no Enter', async () => {
    const input = ttyTyping(['s', 'e', 'c', 'r', 'e', 't', '\r']);
    const out = capture();
    const value = await noHang(readSecretRaw(input, out.stream));
    assert.equal(value, 'secret');
    assert.match(out.text(), /\*{6}/, 'mascara exibida no lugar do token');
    assert.ok(!out.text().includes('secret'), 'token nunca ecoado');
  });

  it('readSecretRaw: backspace apaga o ultimo caractere (e a mascara)', async () => {
    const input = ttyTyping(['a', 'b', '\u007f', 'c', '\n']);
    const out = capture();
    assert.equal(await noHang(readSecretRaw(input, out.stream)), 'ac');
    assert.match(out.text(), /\*/, 'mascara dos aceitos');
  });

  it('readSecretRaw: Ctrl+C rejeita com USER_ABORT (nunca resolve vazio)', async () => {
    const input = ttyTyping(['a', '\u0003']);
    await assert.rejects(
      noHang(readSecretRaw(input, nullOutput())),
      (e) => e instanceof InstallError && e.code === 'USER_ABORT',
    );
  });

  it('readSecretRaw sem TTY cru => rejeita (nao cai em leitura com eco)', async () => {
    await assert.rejects(
      readSecretRaw(pipedInput(['x']), nullOutput()),
      (e) => e instanceof InstallError && e.code === 'SECRET_TTY',
    );
  });

  it('readSecretPrompt: em TTY devolve o token cru; sem TTY devolve null (leitor de linha)', async () => {
    const tty = await noHang(readSecretPrompt({ input: ttyTyping(['t', 'k', '\r']), output: nullOutput(), prompt: 'token? ' }));
    assert.equal(tty, 'tk');
    assert.equal(await readSecretPrompt({ input: pipedInput(['tk\n']), output: nullOutput(), prompt: 'token? ' }), null);
  });

  it('promptAnswers em TTY: token entra pelo leitor sem eco e NAO vaza para a proxima pergunta', async () => {
    const target = mkTarget({});
    const input = ttyTyping(['demo\n', 'node\n', 'node\n', `${target}\n`, 'TOKEN-xyz', '\r']);
    const out = capture();
    const answers = await noHang(promptAnswers(target, { input, output: out.stream }), 5000);
    assert.equal(answers.project, 'demo');
    assert.equal(answers.stack, 'node');
    assert.equal(answers.pluginsDir, path.resolve(target), 'pluginsDir nao virou o token (readline recriado)');
    assert.equal(answers.deployToken, 'TOKEN-xyz');
    assert.ok(!out.text().includes('TOKEN-xyz'), 'token nunca ecoado no output');
  });
});

describe('CLI-05: incoming canonico documentado no codigo', () => {
  it('collectIncoming varre .opencode+.agents, exclui node_modules/.git', () => {
    const src = mkTarget({
      '.agents/rules/a.md': '# a\n',
      '.opencode/plugins/p/gate.js': '// gate\n',
      '.agents/rules/node_modules/x.js': '// excluir\n',
      '.opencode/plugins/.git/HEAD': 'ref\n',
    });
    const incoming = collectIncoming(src);
    assert.ok(incoming['.agents/rules/a.md'], 'inclui rule');
    assert.ok(incoming['.opencode/plugins/p/gate.js'], 'inclui plugin');
    assert.ok(!Object.keys(incoming).some((k) => k.includes('node_modules')), 'exclui node_modules');
    assert.ok(!Object.keys(incoming).some((k) => k.includes('.git')), 'exclui .git');
    const srcText = fs.readFileSync(new URL('../install.mjs', import.meta.url), 'utf8');
    assert.match(srcText, /INCOMING_ROOTS|lista can[oô]nica/i, 'lista canonica documentada no codigo');
  });
});
