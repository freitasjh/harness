// wizard.spec.mjs — IM-VAL-05: estados do wizard B2 (W0..W7) + detect().
// Estilo do repo: node:test + assert/strict, streams injetados (sem TTY real).
// Contrato: ADR-010 / RF-15 / I11 — o wizard apresenta, valida e confirma;
// NUNCA escreve nem gera config por conta propria.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { runWizard, detect, promptAnswers, runCli, InstallError } from '../install.mjs';

let dirs = [];
function mkTarget(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-wizard-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
afterEach(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); dirs = []; });

function piped(lines) {
  return Readable.from(lines.map((l) => `${l}\n`));
}
function capture() {
  let buf = '';
  const stream = new Writable({ write(c, _e, cb) { buf += c.toString(); cb(); } });
  return { stream, text: () => buf };
}

const PUBSPEC_FLUTTER = `name: demo_app
environment:
  sdk: '>=3.0.0 <4.0.0'
dependencies:
  flutter:
    sdk: flutter
`;
const PUBSPEC_DART = `name: demo_pkg
environment:
  sdk: '>=3.0.0 <4.0.0'
dependencies:
  path: ^1.0.0
`;

function mkSource() {
  return mkTarget({
    '.agents/rules/a.md': '# a\n',
    'opencode.json': JSON.stringify({ plugin: ['harness'] }),
  });
}
const WOPTS = { allowRoot: true, yes: true };

// ---------------------------------------------------------------------------
describe('IM-BE-07 detect() — leitura line-based do pubspec (ADR-010/G3)', () => {
  it('pubspec flutter => sugere flutter + origem (arquivo:linha)', () => {
    const t = mkTarget({ 'pubspec.yaml': PUBSPEC_FLUTTER });
    const d = detect(t);
    assert.equal(d.hasPubspec, true);
    assert.equal(d.name, 'demo_app');
    assert.equal(d.declaresFlutter, true);
    assert.equal(d.suggestedStack, 'flutter');
    assert.ok(d.sources.some((s) => s.field === 'project' && s.file === 'pubspec.yaml' && s.line === 1));
    assert.ok(d.sources.some((s) => s.field === 'stack'), 'origem da stack registrada');
  });

  it('pubspec dart (sem sdk: flutter) => sugere dart', () => {
    const t = mkTarget({ 'pubspec.yaml': PUBSPEC_DART });
    const d = detect(t);
    assert.equal(d.hasPubspec, true);
    assert.equal(d.name, 'demo_pkg');
    assert.equal(d.declaresFlutter, false);
    assert.equal(d.suggestedStack, 'dart');
  });

  it('sem pubspec => sem sugestao (menu manual no W2m)', () => {
    const t = mkTarget({});
    const d = detect(t);
    assert.equal(d.hasPubspec, false);
    assert.equal(d.suggestedStack, null);
    assert.deepEqual(d.sources, []);
  });
});

// ---------------------------------------------------------------------------
describe('IM-VAL-05 wizard W0..W7 (I11/RF-15)', () => {
  it('W0: pre-flight invalido aborta sem called apply e sem writes', async () => {
    const src = mkSource();
    const out = capture();
    let applied = 0;
    await assert.rejects(
      runWizard({
        target: path.join(os.tmpdir(), 'x', '..', 'y'),
        stdin: piped([]),
        stdout: out.stream,
        sourceDir: src,
        options: WOPTS,
        apply: () => { applied++; return {}; },
      }),
      (e) => e instanceof InstallError,
    );
    assert.equal(applied, 0, 'abort em W0: nenhum apply');
  });

  it('W1/W2/W4: inventario + deteccao + previa do plano via printPlan', async () => {
    const t = mkTarget({ 'pubspec.yaml': PUBSPEC_FLUTTER });
    const src = mkSource();
    const out = capture();
    const res = await runWizard({
      target: t,
      stdin: piped(['', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: WOPTS,
    });
    const text = out.text();
    assert.match(text, /W0 pre-flight/i);
    assert.match(text, /W1 inventario/i);
    assert.match(text, /W2 deteccao/i);
    assert.match(text, /W4 previa/i);
    assert.match(text, /plano de instala/i);
    assert.equal(res.answers.stack, 'flutter', 'stack herdada da deteccao (confirmada)');
    assert.equal(res.answers.project, 'demo_app', 'project herdado do pubspec');
    assert.equal(res.profile, 'flutter');
    assert.ok(Array.isArray(res.plan) && res.plan.length > 0, 'plano retornado');
  });

  it('W2m: sem pubspec => menu manual (3=node) alimenta o default do W3', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const out = capture();
    const res = await runWizard({
      target: t,
      stdin: piped(['3', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: WOPTS,
    });
    assert.match(out.text(), /W2m menu manual/i);
    assert.equal(res.answers.stack, 'node');
    assert.equal(res.answers.project, 'demo');
  });

  it('W3: resposta invalida repete e depois aceita (erro inline + como corrigir)', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const out = capture();
    const res = await runWizard({
      target: t,
      stdin: piped(['3', 'demo', '', 'RUIM_CMD', 'node', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: WOPTS,
    });
    assert.equal(res.answers.suiteCommand, 'node', 'aceitou apos rejeitar RUIM_CMD');
    assert.match(out.text(), /ERRO.*suiteCommand/i);
    assert.match(out.text(), /como corrigir/i);
  });

  it('W3: token de abort (q) => USER_ABORT e zero writes', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const before = JSON.stringify(fs.readdirSync(t));
    let applied = 0;
    await assert.rejects(
      runWizard({
        target: t,
        stdin: piped(['3', 'q']),
        stdout: capture().stream,
        sourceDir: src,
        options: WOPTS,
        apply: () => { applied++; return {}; },
      }),
      (e) => e instanceof InstallError && e.code === 'USER_ABORT',
    );
    assert.equal(applied, 0);
    assert.equal(JSON.stringify(fs.readdirSync(t)), before, 'abort em W3: disco intocado');
  });

  it('W3: EOF => NO_STDIN com instrucao (nunca trava)', async () => {
    const t = mkTarget({});
    const src = mkSource();
    await assert.rejects(
      runWizard({ target: t, stdin: piped(['3']), stdout: capture().stream, sourceDir: src, options: WOPTS }),
      (e) => e instanceof InstallError && e.code === 'NO_STDIN',
    );
  });

  it('W5: negar camada => USER_ABORT e zero writes', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const before = JSON.stringify(fs.readdirSync(t));
    let applied = 0;
    await assert.rejects(
      runWizard({
        target: t,
        stdin: piped(['3', 'demo', '', 'node', '', '', 'n', 'n', 'n', 'n']),
        stdout: capture().stream,
        sourceDir: src,
        options: { allowRoot: true, yes: false },
        apply: () => { applied++; return {}; },
      }),
      (e) => e instanceof InstallError && e.code === 'USER_ABORT',
    );
    assert.equal(applied, 0);
    assert.equal(JSON.stringify(fs.readdirSync(t)), before, 'abort em W5: disco intocado');
  });

  it('W5 yes: camadas aprovadas sem ler stdin (reusa confirmByLayer)', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const res = await runWizard({
      target: t,
      stdin: piped(['3', 'demo', '', 'node', '', '']),
      stdout: capture().stream,
      sourceDir: src,
      options: WOPTS,
    });
    assert.equal(res.applied, false, 'sem apply injetado: W6/W7 nao executados');
    assert.ok(res.plan.some((p) => p.action !== 'noop'));
  });

  it('W6/W7: apply injetado recebe answers validados; progresso [n/total] + manifesto/checks', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const out = capture();
    let seen = null;
    const res = await runWizard({
      target: t,
      stdin: piped(['3', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: WOPTS,
      apply: async (ctx) => {
        seen = ctx;
        return {
          target: ctx.target,
          manifestRef: { path: path.join(ctx.target, '.harness-install.json') },
          checks: { passed: true, failed: [] },
          plan: ctx.plan,
        };
      },
    });
    assert.equal(res.applied, true);
    assert.ok(seen, 'apply chamado');
    assert.equal(seen.answers.project, 'demo');
    assert.equal(seen.answers.stack, 'node');
    assert.match(out.text(), /W6 backup \+ aplicacao/i);
    assert.match(out.text(), /\[1\/\d+\]/);
    assert.match(out.text(), /W7 manifesto \+ checks/i);
    assert.match(out.text(), /checks: PASS/i);
    assert.equal(JSON.stringify(fs.readdirSync(t)), '[]', 'wizard nunca escreve por conta propria');
  });

  it('detect injetado e respeitado (mesma tecnica de promptAnswers)', async () => {
    const t = mkTarget({});
    const src = mkSource();
    // stub de detect (sem tocar disco): sugere node, sem nome.
    const res = await runWizard({
      target: t,
      stdin: piped(['demo', '', '', '', '']),
      stdout: capture().stream,
      sourceDir: src,
      detect: () => ({ hasPubspec: true, name: null, sdk: null, declaresFlutter: false, suggestedStack: 'node', sources: [], warnings: [] }),
      options: WOPTS,
    });
    assert.equal(res.answers.project, 'demo');
    assert.equal(res.answers.stack, 'node', 'default veio do detect injetado');
  });

  it('dry-run: dispensa confirmacao e nao chama apply', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const out = capture();
    let applied = 0;
    const res = await runWizard({
      target: t,
      stdin: piped(['3', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: { allowRoot: true, dryRun: true },
      apply: () => { applied++; return {}; },
    });
    assert.equal(applied, 0);
    assert.equal(res.applied, false);
    assert.match(out.text(), /dry-run/i);
  });
});

// ---------------------------------------------------------------------------
describe('G6 regressao do leitor (terminal:false em pipe/redirect)', () => {
  it('promptAnswers pipado continua identico (terminal:false)', async () => {
    const t = mkTarget({});
    const answers = await promptAnswers(t, {
      input: piped(['demo', 'node', 'node', t, '']),
      output: capture().stream,
    });
    assert.equal(answers.project, 'demo');
    assert.equal(answers.stack, 'node');
    assert.equal(answers.pluginsDir, path.resolve(t));
  });

  it('runWizard aceita stdin com isTTY=true sem quebrar (terminal:true condicional)', async () => {
    const t = mkTarget({ 'pubspec.yaml': PUBSPEC_DART });
    const src = mkSource();
    const input = piped(['', '', 'node', '', '']);
    input.isTTY = true;
    const res = await runWizard({
      target: t,
      stdin: input,
      stdout: capture().stream,
      sourceDir: src,
      options: WOPTS,
    });
    assert.equal(res.answers.stack, 'dart');
  });
});

// ---------------------------------------------------------------------------
// should-fix do review Batch 3: costura real runCli -> runWizard -> apply.
// Prova o wiring (TTY => wizard; --answers-file => caminho v1), sem TTY real.
describe('IM-VAL-05 costura runCli -> runWizard (should-fix review)', () => {
  it('stdin.isTTY=true sem --answers-file => runCli entra no wizard (marcador W0)', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const out = capture();
    const input = piped(['3', 'demo', '', 'node', '', '']);
    input.isTTY = true;
    await runCli({
      argv: ['--target', t, '--allow-root', '--dry-run'],
      stdin: input,
      stdout: out.stream,
      stderr: capture().stream,
      sourceDir: src,
    });
    const text = out.text();
    assert.match(text, /W0 pre-flight/i, 'runCli liga o stdin TTY ao wizard');
    assert.match(text, /W2m menu manual/i, 'wizard seguiu ate o W2m');
    assert.match(text, /dry-run/i);
    assert.equal(JSON.stringify(fs.readdirSync(t)), '[]', 'dry-run: zero writes no target');
  });

  it('--answers-file => pula o wizard mesmo com stdin TTY (caminho v1, sem W0)', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const af = path.join(mkTarget({}), 'answers.json');
    fs.writeFileSync(af, JSON.stringify({ project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: t }));
    const out = capture();
    const input = piped(['nao', 'deve', 'ser', 'lido']);
    input.isTTY = true;
    await runCli({
      argv: ['--target', t, '--allow-root', '--dry-run', '--answers-file', af],
      stdin: input,
      stdout: out.stream,
      stderr: capture().stream,
      sourceDir: src,
    });
    const text = out.text();
    assert.doesNotMatch(text, /W0 pre-flight/i, '--answers-file nao entra no wizard');
    assert.match(text, /plano de instala/i, 'caminho v1 imprime o plano');
    assert.equal(JSON.stringify(fs.readdirSync(t)), '[]', 'dry-run: zero writes no target');
  });
});

// ---------------------------------------------------------------------------
// should-fix do review Batch 3: suiteCommand default preso ao stack DETECTADO.
describe('IM-VAL-05 W3 suiteCommand recalcula pelo stack escolhido (should-fix review)', () => {
  it('stack sobrescrita no W3 recalcula o default de suiteCommand', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const out = capture();
    const res = await runWizard({
      target: t,
      // project=demo, stack=node (sobrescreve o detect 'dart'), aceita defaults seguintes.
      stdin: piped(['demo', 'node', '', '', '']),
      stdout: out.stream,
      sourceDir: src,
      detect: () => ({
        hasPubspec: true, name: null, sdk: null, declaresFlutter: false,
        suggestedStack: 'dart', sources: [], warnings: [],
      }),
      options: WOPTS,
    });
    assert.equal(res.answers.stack, 'node', 'stack escolhida difere da detectada');
    assert.equal(res.answers.suiteCommand, 'node --test', 'default recalculado do stack escolhido');
    const suiteLine = out.text().split('\n').find((l) => l.includes('suite de testes'));
    assert.match(suiteLine, /default: node --test/, 'default exibido vem do stack escolhido, nao do detectado');
  });
});
