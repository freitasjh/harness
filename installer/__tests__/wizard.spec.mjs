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
import { runWizard, runInit, assertCreateOnly, isAbortToken, detect, promptAnswers, runCli, InstallError, WIZARD_MENU, validateAnswer } from '../install.mjs';

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

// ---------------------------------------------------------------------------
// Batch F2 (INS-07..10) — menu produto 5 itens (TDD-first, SPEC §9.1 + REQ-01..04).
describe('INS-07 W2m 5 itens produto (REQ-01)', () => {
  it('menu exibe 5 itens produto com seta -> stack', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const out = capture();
    await runWizard({
      target: t,
      stdin: piped(['3', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: WOPTS,
    });
    const text = out.text();
    assert.match(text, /escolha o tipo do seu projeto/i);
    for (const [label, stack] of [
      ['App Flutter', 'flutter'],
      ['Pacote Dart', 'dart'],
      ['Projeto Node\\.js', 'node'],
      ['Projeto Java \\+ Vue', 'java\\+vue'],
      ['Outro projeto', 'outra'],
    ]) {
      assert.match(text, new RegExp(`[1-5]\\) .*${label}.*-> stack ${stack}`), `item ${label} -> ${stack}`);
    }
  });

  it('regressao: menu nunca tem 4 itens (SPEC violada)', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const out = capture();
    await runWizard({
      target: t,
      stdin: piped(['3', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: WOPTS,
    });
    const items = out.text().split('\n').filter((l) => /^\s*[1-5]\)/.test(l));
    assert.equal(items.length, 5, 'exatamente 5 itens');
    assert.notEqual(items.length, 4, 'travada regressao aos 4 itens legados');
  });

  it('hint (q cancela) visivel no prompt W2m', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const out = capture();
    await runWizard({
      target: t,
      stdin: piped(['3', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: WOPTS,
    });
    assert.match(out.text(), /\(q cancela\)/, 'hint q visivel');
  });
});

describe('INS-08 mapeamento sem nova key (REQ-02)', () => {
  it('escolhas 1..5 mapeiam para flutter|dart|node|java+vue|outra', () => {
    const byKey = Object.fromEntries(WIZARD_MENU.map((m) => [m.key, m.stack]));
    assert.deepEqual(byKey, { 1: 'flutter', 2: 'dart', 3: 'node', 4: 'java+vue', 5: 'outra' });
  });

  it('menu 4 => java+vue alimenta default W3 (wizard)', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const res = await runWizard({
      target: t,
      stdin: piped(['4', 'demo', '', 'node', '', '']),
      stdout: capture().stream,
      sourceDir: src,
      options: WOPTS,
    });
    assert.equal(res.answers.stack, 'java+vue');
  });

  it('menu 5 => outra alimenta default W3 (wizard)', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const res = await runWizard({
      target: t,
      stdin: piped(['5', 'demo', '', 'node', '', '']),
      stdout: capture().stream,
      sourceDir: src,
      options: WOPTS,
    });
    assert.equal(res.answers.stack, 'outra');
  });

  it('node-esm valido em W3/validateAnswer mas sem item proprio no W2m', () => {
    const t = mkTarget({});
    assert.equal(validateAnswer(t, 'stack', 'node-esm'), 'node-esm');
    assert.ok(!WIZARD_MENU.some((m) => m.stack === 'node-esm'), 'sem item node-esm no menu');
  });
});

describe('INS-09 detect soberano (REQ-03)', () => {
  it('com pubspec flutter: W2m pulado, default W3 = flutter', async () => {
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
    assert.doesNotMatch(out.text(), /W2m menu manual/, 'menu nao exibido com pubspec');
    assert.equal(res.answers.stack, 'flutter', 'default veio do suggestedStack');
  });

  it('regressao: pubspec presente => suggestedStack nao-null e menu ausente', async () => {
    const t = mkTarget({ 'pubspec.yaml': PUBSPEC_DART });
    const src = mkSource();
    const out = capture();
    const res = await runWizard({
      target: t,
      stdin: piped(['', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: WOPTS,
    });
    assert.equal(res.detection.suggestedStack, 'dart');
    assert.doesNotMatch(out.text(), /W2m menu manual/);
  });

  it('sem pubspec: W2m exibido (INS-07)', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const out = capture();
    await runWizard({
      target: t,
      stdin: piped(['3', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: WOPTS,
    });
    assert.match(out.text(), /W2m menu manual/);
  });
});

describe('INS-10 invalida repete [1,5] (REQ-04)', () => {
  it("'7' repete com bloco [ERRO] BAD_ANSWER fora de [1,5]", async () => {
    const t = mkTarget({});
    const src = mkSource();
    const out = capture();
    const res = await runWizard({
      target: t,
      stdin: piped(['7', '3', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: WOPTS,
    });
    assert.match(out.text(), /\[ERRO\]/);
    assert.match(out.text(), /porquê: BAD_ANSWER/);
    assert.match(out.text(), /fora de \[1,5\]/);
    assert.equal(res.answers.stack, 'node', 'repetiu e aceitou o valido');
  });

  it("gerador invalido (0,6,x,'',espaco) nunca avanca para W3", async () => {
    for (const bad of ['0', '6', 'x', '', ' ']) {
      const t = mkTarget({});
      const src = mkSource();
      const out = capture();
      const res = await runWizard({
        target: t,
        stdin: piped([bad, '3', 'demo', '', 'node', '', '']),
        stdout: out.stream,
        sourceDir: src,
        options: WOPTS,
      });
      assert.match(out.text(), /\[ERRO\]/, `invalido '${bad}' repetiu`);
      assert.equal(res.answers.stack, 'node', `invalido '${bad}' nao avancou`);
    }
  });

  it("'q' no menu => USER_ABORT sem writes", async () => {
    const t = mkTarget({});
    const src = mkSource();
    const before = JSON.stringify(fs.readdirSync(t));
    let applied = 0;
    await assert.rejects(
      runWizard({
        target: t,
        stdin: piped(['q']),
        stdout: capture().stream,
        sourceDir: src,
        options: WOPTS,
        apply: () => { applied++; return {}; },
      }),
      (e) => e instanceof InstallError && e.code === 'USER_ABORT',
    );
    assert.equal(applied, 0);
    assert.equal(JSON.stringify(fs.readdirSync(t)), before, 'q: disco intocado (I-05)');
  });
});

// ---------------------------------------------------------------------------
// INS-14 init W0-W7 greenfield (REQ-09) — TDD FIRST
describe('INS-14 init W0-W7 (REQ-09)', () => {
  it('destino limpo instala: config+skills, checks verdes, pico-fim, exit 0', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const out = capture();
    const res = await runInit({
      target: t,
      stdin: piped(['3', 'demo', '', '', '', '']),
      stdout: out.stream,
      stderr: capture().stream,
      sourceDir: src,
      options: { allowRoot: true, yes: true },
    });
    dirs.push(res.backupDir);
    assert.equal(res.exitCode, 0, 'init limpo sai 0');
    assert.match(out.text(), /pico-fim/, 'sucesso marca pico-fim');
    assert.ok(fs.existsSync(path.join(t, 'harness.config.json')), 'config instalado');
    assert.ok(fs.existsSync(path.join(t, '.agents/rules/a.md')), 'skills instaladas');
    assert.ok(fs.existsSync(path.join(t, '.harness-install.json')), 'manifesto escrito');
    assert.equal(res.checks.passed, true, 'checks verdes');
  });

  it('pre-flight falha (manifesto pre-existente): aborta sem writes', async () => {
    const t = mkTarget({ '.harness-install.json': JSON.stringify({ manifestSchemaVersion: 1, source: 'harness@x' }) });
    const src = mkSource();
    const before = JSON.stringify(fs.readdirSync(t));
    await assert.rejects(
      runInit({
        target: t,
        stdin: piped(['3', 'demo', '', '', '', '']),
        stdout: capture().stream,
        stderr: capture().stream,
        sourceDir: src,
        options: { allowRoot: true, yes: true },
      }),
      (e) => e instanceof InstallError,
    );
    assert.equal(JSON.stringify(fs.readdirSync(t)), before, 'abort em W0: disco intocado');
  });

  it('stdin fechado sem answers: NO_STDIN sem writes', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const before = JSON.stringify(fs.readdirSync(t));
    await assert.rejects(
      runInit({
        target: t,
        stdin: piped([]),
        stdout: capture().stream,
        stderr: capture().stream,
        sourceDir: src,
        options: { allowRoot: true, yes: true },
      }),
      (e) => e instanceof InstallError && e.code === 'NO_STDIN',
    );
    assert.equal(JSON.stringify(fs.readdirSync(t)), before, 'NO_STDIN: disco intocado');
  });
});

// ---------------------------------------------------------------------------
// INS-15 gate create-only (REQ-10) — TDD FIRST
describe('INS-15 gate create-only (REQ-10)', () => {
  it('plano so-create passa (create|generate-overwrite|noop)', () => {
    const r = assertCreateOnly([
      { action: 'create', path: 'a' },
      { action: 'generate-overwrite', path: 'harness.config.json' },
      { action: 'noop', path: 'b' },
    ]);
    assert.equal(r.ok, true);
  });

  it('merge presente: init aborta citando doctor, 0 writes', async () => {
    const t = mkTarget({ 'opencode.json': JSON.stringify({ plugin: ['dest'] }) });
    const src = mkSource();
    const before = JSON.stringify(fs.readdirSync(t));
    const out = capture();
    await assert.rejects(
      runInit({
        target: t,
        stdin: piped(['3', 'demo', '', '', '', '']),
        stdout: out.stream,
        stderr: capture().stream,
        sourceDir: src,
        options: { allowRoot: true, yes: true },
      }),
      (e) => e instanceof InstallError && e.code === 'flagged-open',
    );
    assert.match(out.text(), /doctor/, 'abort cita doctor');
    assert.equal(JSON.stringify(fs.readdirSync(t)), before, 'gate: disco intocado, 0 writes');
  });

  it('flag solitario tambem aborta', () => {
    assert.throws(
      () => assertCreateOnly([{ action: 'create', path: 'a' }, { action: 'flag', path: '.agents/rules/x.md' }]),
      (e) => e instanceof InstallError && e.code === 'flagged-open' && /doctor/.test(e.message),
    );
  });
});

// ---------------------------------------------------------------------------
// INS-16 contador + q (REQ-11) — TDD FIRST
describe('INS-16 contador + q (REQ-11)', () => {
  it('prompts W3 exibem [i/N] sequencial 1..N', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const out = capture();
    await runWizard({
      target: t,
      stdin: piped(['3', 'demo', '', '', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: WOPTS,
    });
    const text = out.text();
    for (let i = 1; i <= 5; i++) assert.match(text, new RegExp(`\\[${i}/5\\]`), `contador [${i}/5] visivel`);
  });

  it('q na 3a pergunta => USER_ABORT, 0 writes', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const before = JSON.stringify(fs.readdirSync(t));
    let applied = 0;
    await assert.rejects(
      runWizard({
        target: t,
        stdin: piped(['3', 'demo', '', 'q']),
        stdout: capture().stream,
        sourceDir: src,
        options: WOPTS,
        apply: () => { applied++; return {}; },
      }),
      (e) => e instanceof InstallError && e.code === 'USER_ABORT',
    );
    assert.equal(applied, 0);
    assert.equal(JSON.stringify(fs.readdirSync(t)), before, 'q: disco intocado (I-05)');
  });

  it("sinonimos quit/cancel/abort abortam idem q", async () => {
    for (const syn of ['quit', 'cancel', 'abort']) {
      const t = mkTarget({});
      const src = mkSource();
      await assert.rejects(
        runWizard({
          target: t,
          stdin: piped(['3', 'demo', '', syn]),
          stdout: capture().stream,
          sourceDir: src,
          options: WOPTS,
        }),
        (e) => e instanceof InstallError && e.code === 'USER_ABORT',
        `sinonimo '${syn}' aborta`,
      );
    }
  });

  it('hint (q cancela) em todo prompt W3', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const out = capture();
    await runWizard({
      target: t,
      stdin: piped(['3', 'demo', '', '', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: WOPTS,
    });
    const hits = out.text().match(/\(q cancela\)/g) || [];
    assert.ok(hits.length >= 5, `hint em todo prompt W3 (achados ${hits.length})`);
  });

  it('isAbortToken exportado cobre q + sinonimos; valor comum nao aborta', () => {
    assert.equal(isAbortToken('q'), true);
    assert.equal(isAbortToken('quit'), true);
    assert.equal(isAbortToken('cancel'), true);
    assert.equal(isAbortToken('abort'), true);
    assert.equal(isAbortToken('node'), false);
    assert.equal(isAbortToken(''), false);
  });
});
