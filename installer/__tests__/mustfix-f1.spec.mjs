// mustfix-f1.spec.mjs — 4 must-fix do review Batch F1 (TDD-first, red antes do fix).
// M1: :1140 vigentes completos + scan S2 endurecido p/ contexto vigente.
// M2: catch top-level :1536-1542 sanitizado com vigentes + invariante canario.
// M3: out()/printPlan com redacao no sink + contexto em :1352.
// M4: NO_STDIN/USER_ABORT/CORRUPT em bloco 4-linhas (ou excecao com dono F3/F4).
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Readable, Writable } from 'node:stream';
import {
  printPlan,
  runWizard,
  runCli,
  InstallError,
} from '../install.mjs';

const INSTALL_MJS_URL = new URL('../install.mjs', import.meta.url);
const srcLines = () => fs.readFileSync(INSTALL_MJS_URL, 'utf8').split('\n');
const srcText = () => fs.readFileSync(INSTALL_MJS_URL, 'utf8');

let dirs = [];
function mkTemp(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-mustfix-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
afterEach(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); dirs = []; });

function capture() {
  let buf = '';
  const stream = new Writable({ write(c, _e, cb) { buf += c.toString(); cb(); } });
  return { stream, text: () => buf };
}
function nullOut() {
  return new Writable({ write(_c, _e, cb) { cb(); } });
}

// ---- M1: scan S2 endurecido — todo sanitizeLog( com contexto VIGENTE ----
describe('MUSTFIX-1 S2-hard: sanitizeLog sempre com contexto vigente', () => {
  it('zero call sem vigente (answers|currentAnswers|scripted|lastCliAnswers)', () => {
    const bad = [];
    srcLines().forEach((raw, i) => {
      const code = raw.replace(/\/\/.*$/, '');
      if (/function\s+sanitizeLog/.test(code)) return;
      const at = code.indexOf('sanitizeLog(');
      if (at < 0) return;
      let depth = 0;
      let comma = false;
      let second = '';
      for (let j = at + 'sanitizeLog'.length; j < code.length; j++) {
        const ch = code[j];
        if (ch === '(') { depth++; continue; }
        if (ch === ')') { depth--; if (depth === 0) break; continue; }
        if (depth === 1 && ch === ',') { comma = true; continue; }
        if (comma) second += ch;
      }
      if (!comma || !/\b(answers|currentAnswers|scripted|lastCliAnswers)\b/.test(second)) bad.push(i + 1);
    });
    assert.deepEqual(bad, [], 'sanitizeLog sem contexto vigente = H1 reaberto (REQ-14)');
  });

  it(':1140 (promptAnswers r.say) passa vigentes completos (...answers)', () => {
    const line = srcLines().find((l) => l.includes('r.say') && l.includes("resposta invalida para '${q.key}'"));
    assert.ok(line, 'call site :1140 existe');
    assert.ok(/\.\.\.answers/.test(line), 'promptAnswers deve espalhar ...answers vigentes + raw atual');
  });
});

// ---- M2: top-level sanitizado + invariante canario ----
describe('MUSTFIX-2 top-level sanitizado com vigentes', () => {
  it('bloco de entrada cli (process.stderr.write) sanitiza com vigentes', () => {
    const lines = srcLines();
    const idx = lines.findIndex((l) => l.includes('process.stderr.write'));
    assert.ok(idx >= 0, 'top-level catch existe');
    const win = lines.slice(Math.max(0, idx - 8), idx + 1).join('\n');
    assert.ok(/sanitizeLog/.test(win), 'top-level deve chamar sanitizeLog');
    assert.ok(/lastCliAnswers|currentAnswers/.test(win), 'top-level deve usar vigentes (lastCliAnswers|currentAnswers)');
  });

  it('runCli com canario no answers-file que falha nao vaza no erro', async () => {
    const canary = 'CANARY-MUSTFIX2-k7q9';
    const d = mkTemp({});
    const af = path.join(d, 'answers.json');
    fs.writeFileSync(af, JSON.stringify({
      project: 'demo',
      stack: 'node',
      suiteCommand: `${canary}-no-such-cmd`,
      pluginsDir: d,
      deployToken: canary,
    }));
    await assert.rejects(
      runCli({
        argv: ['--target', d, '--allow-root', '--answers-file', af],
        stdin: Readable.from([]),
        stdout: nullOut(),
        stderr: nullOut(),
      }),
      (e) => {
        assert.ok(e instanceof InstallError, 'erro tipado preservado');
        assert.ok(!String(e.message).includes(canary), 'erro sanitizado com vigentes (sem canario em claro)');
        return true;
      },
    );
  });
});

// ---- M3: out()/printPlan com redacao no sink + contexto em :1352 ----
describe('MUSTFIX-3 out/printPlan com redacao no sink', () => {
  it('printPlan redige canario com contexto answers', () => {
    const canary = 'CANARY-MUSTFIX3-p4m2';
    const out = capture();
    printPlan(
      [{ path: `rel-${canary}.md`, layer: 'l', action: 'create', reason: `tem ${canary}` }],
      { output: out.stream, answers: { deployToken: canary } },
    );
    assert.ok(!out.text().includes(canary), 'sink printPlan redige com vigentes');
  });

  it('out() do wizard sanitiza com answers (sink sem sanitizacao = defeito)', () => {
    const line = srcLines().find((l) => l.includes('const out = (s)'));
    assert.ok(line, 'sink out() existe');
    assert.ok(/sanitizeLog/.test(line) && /\banswers\b/.test(line), 'out() deve redigir via sanitizeLog com answers vigentes');
  });

  it(':1352 (W2m invalida) passa contexto answers ao formatError', () => {
    const line = srcLines().find((l) => l.includes("invalida") && l.includes('formatError'));
    assert.ok(line, 'call site :1352 existe');
    assert.ok(/\banswers\b/.test(line), ':1352 deve passar answers vigentes ao formatError');
  });
});

// ---- M4: NO_STDIN/USER_ABORT/CORRUPT em bloco 4-linhas ----
describe('MUSTFIX-4 aborts em bloco 4-linhas', () => {
  it('wizard stdin fechado emite bloco NO_STDIN', async () => {
    const t = mkTemp({});
    const out = capture();
    await assert.rejects(
      runWizard({ target: t, stdin: Readable.from([]), stdout: out.stream, options: { allowRoot: true } }),
      (e) => e instanceof InstallError && e.code === 'NO_STDIN',
    );
    assert.match(out.text(), /\[ERRO\]/);
    assert.match(out.text(), /porquê: NO_STDIN/);
  });

  it("wizard 'q' no menu emite bloco USER_ABORT", async () => {
    const t = mkTemp({});
    const out = capture();
    await assert.rejects(
      runWizard({ target: t, stdin: Readable.from(['q\n']), stdout: out.stream, options: { allowRoot: true } }),
      (e) => e instanceof InstallError && e.code === 'USER_ABORT',
    );
    assert.match(out.text(), /\[ERRO\]/);
    assert.match(out.text(), /porquê: USER_ABORT/);
  });

  it('CORRUPT do planMerge sai em bloco 4-linhas no runCli', async () => {
    const t = mkTemp({ 'opencode.json': '{CORROMPIDO{{{' });
    const af = path.join(t, 'answers.json');
    fs.writeFileSync(af, JSON.stringify({ project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: t }));
    const out = capture();
    const err = capture();
    await assert.rejects(
      runCli({
        argv: ['--target', t, '--allow-root', '--answers-file', af],
        stdin: Readable.from([]),
        stdout: out.stream,
        stderr: err.stream,
      }),
      (e) => e instanceof InstallError && e.code === 'CORRUPT',
    );
    assert.match(out.text() + err.text(), /porquê: CORRUPT/);
  });

  it('CORRUPT em planMerge carrega excecao documentada com dono F3/F4', () => {
    const text = srcText();
    assert.ok(/dono F3\/F4|dono F3|F3\/F4/.test(text), 'excecao CORRUPT documenta dono F3/F4 (display futuro)');
  });
});
