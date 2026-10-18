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
import { runWizard, runInit, assertCreateOnly, isAbortToken, detect, promptAnswers, runCli, InstallError, WIZARD_MENU, askMenuStep, sourceLineOf, W2M_MARKER, validateAnswer, QUESTIONS } from '../install.mjs';

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
// ADR-004: header literal do passo 1 (o menu de 2 passos substitui o antigo
// 'W2m menu manual') — as asserções estruturais apontam para este texto.
const W2M1_HEADER_RE = /W2m tipo de projeto/i;

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
    assert.match(out.text(), W2M1_HEADER_RE);
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
    assert.match(text, W2M1_HEADER_RE, 'wizard seguiu ate o W2m');
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
      ['Outro projeto', 'outra'],
    ]) {
      assert.match(text, new RegExp(`[1-5]\\) .*${label}.*-> stack ${stack}`), `item ${label} -> ${stack}`);
    }
    // ADR-004 §2: o item 4 deixa de mapear direto para java+vue — encadeia o passo 2.
    assert.match(text, /4\) .*Aplica[cç][aã]o web \(backend \+ frontend\).*-> segue: frontend/);
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
    // AT-3: escopado ao bloco W2m-1 (o filtro global casaria o W2m-2 tambem).
    const items = w2m1Items(out.text());
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
      // FU-49: item 4 encadeia o W2m-2; Enter reproduz o default (Vue).
      stdin: piped(['4', '', 'demo', '', 'node', '', '']),
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

// EX-BE-03 (RF-14/D-2): o prompt do W3 deriva de STACK_VALUES (fonte unica) e
// nao repete a lista antiga de install.mjs:196 — que omitia java+react.
// AT-1 (review iteracao 2): a lista esperada e LITERAL (oraculo independente);
// `assert.match(line, /java\+vue/)` era satisfeito pelo sufixo `(default: ...)`.
const EXPECTED_STACK_PROMPT = 'Stack do destino? (node/java+vue/java+react/outra/node-esm/flutter/dart)';

describe('EX-BE-03 prompt do W3 derivado da fonte unica (RF-14)', () => {
  it('QUESTIONS.stack.prompt e exatamente a lista derivada (falha se voltar hardcoded)', () => {
    const q = QUESTIONS.find((x) => x.key === 'stack');
    assert.ok(q, 'QUESTIONS tem a chave stack');
    assert.equal(q.prompt, EXPECTED_STACK_PROMPT);
  });

  it('lista exibida no W3 = EXPECTED_STACK_PROMPT (com java+react; sem a lista antiga)', async () => {
    const t = mkTarget({});
    const src = mkSource();
    const out = capture();
    await runWizard({
      target: t,
      // FU-49: item 4 encadeia o W2m-2; Enter reproduz o default (Vue).
      stdin: piped(['4', '', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: src,
      options: WOPTS,
    });
    const line = out.text().split('\n').find((l) => l.includes('Stack do destino'));
    assert.ok(line, 'prompt de stack exibido no W3');
    assert.ok(line.includes(EXPECTED_STACK_PROMPT), 'W3 exibe a lista derivada de STACK_VALUES');
    assert.doesNotMatch(line, /flutter\/dart\/node\/java\+vue\/outra/, 'lista antiga hardcoded nao volta');
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
    assert.doesNotMatch(out.text(), W2M1_HEADER_RE, 'menu nao exibido com pubspec');
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
    assert.doesNotMatch(out.text(), W2M1_HEADER_RE);
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
    assert.match(out.text(), W2M1_HEADER_RE);
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

// ---------------------------------------------------------------------------
// EX-FE-07 / EX-FE-08 / EX-VAL-09: W2m em 2 passos (ADR-004, decisao D-A).
// ADR_LITERAL_* transcreve BYTE-A-BYTE as 11 linhas de menu do ADR-004 §2
// (blocos de W2m-1 e W2m-2). A comparacao e por SUBSTRING EXATA — sem regex
// flexivel, sem trim: e o que prova que o padding do menu e o do ADR.
// ---------------------------------------------------------------------------
const ADR_MENU_LINES = [
  "[INFO] W2m tipo de projeto — escolha o tipo do seu projeto:",
  "  1) App Flutter        -> stack flutter",
  "  2) Pacote Dart        -> stack dart",
  "  3) Projeto Node.js    -> stack node (ESM incluso)",
  "  4) Aplicação web (backend + frontend) -> segue: frontend",
  "  5) Outro projeto      -> stack outra",
  "[1/2] escolha [1-5] (q cancela) >",
  "[INFO] W2m frontend — qual o frontend do seu projeto web:",
  "  1) Vue (default)   -> stack java+vue",
  "  2) React           -> stack java+react",
  "[2/2] escolha [1-2] (default: 1) (q cancela) >",
];
const W2M1_HEADER = ADR_MENU_LINES[0];
const W2M2_HEADER = ADR_MENU_LINES[7];

// Itens do bloco W2m-1 (entre o cabecalho e o prompt do passo 1) — asserção
// ESCOPADA: o filtro global `/^\s*\d\)/` casaria tambem os itens do W2m-2.
function w2m1Items(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.includes(W2M1_HEADER));
  const end = lines.findIndex((l, i) => i > start && /^\[\d+\/\d+\] escolha/.test(l));
  return lines.slice(start + 1, end).filter((l) => /^\s*\d\)/.test(l));
}
function w2m2Items(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.includes(W2M2_HEADER));
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && /^\[\d+\/\d+\] escolha/.test(l));
  return lines.slice(start + 1, end).filter((l) => /^\s*\d\)/.test(l));
}
const globalItems = (text) => text.split('\n').filter((l) => /^\s*\d\)/.test(l));

describe('EX-FE-08 W2m (ADR-004 §2): as 11 linhas do menu sao BYTE-IGUAIS ao literal', () => {
  async function runMenu(input) {
    const out = capture();
    const res = await runWizard({ target: mkTarget({}), stdin: piped(input), stdout: out.stream, sourceDir: mkSource(), options: WOPTS });
    return { text: out.text(), res };
  }

  it('as 11 linhas (W2m-1 + W2m-2) aparecem byte-a-byte no texto renderizado', async () => {
    // fixture que percorre os DOIS passos (4 -> 2) e depois o W3
    const { text } = await runMenu(['4', '2', 'demo', '', 'node', '', '']);
    for (const literal of ADR_MENU_LINES) {
      assert.ok(text.includes(literal), `linha do ADR ausente/divergente: ${JSON.stringify(literal)}`);
    }
  });

  it('W2m-1: 5 itens na ordem 1..5 do ADR (e o item 4 encadeia o passo 2)', async () => {
    const { text } = await runMenu(['3', 'demo', '', 'node', '', '']);
    assert.equal(w2m1Items(text).length, 5, 'exatamente 5 itens no W2m-1');
    for (const literal of ADR_MENU_LINES.slice(1, 6)) {
      assert.ok(text.includes(literal), `item literal: ${JSON.stringify(literal)}`);
    }
    assert.ok(text.includes(ADR_MENU_LINES[4]), 'item 4 -> segue: frontend (nao mapeia direto)');
  });

  it('itens SEM encadeamento nao exibem o passo 2 (nenhum [2/2])', async () => {
    for (const key of ['3', '5']) {
      const { text } = await runMenu([key, 'demo', '', 'node', '', '']);
      assert.doesNotMatch(text, /\[2\/2\]/, `item ${key}: sem passo 2`);
      assert.ok(!text.includes(W2M2_HEADER), `item ${key}: sem cabecalho do passo 2`);
    }
    // Itens 1/2 (mobile) exigem `pubspec.yaml` no W3 (validateAnswer), logo o
    // caminho end-to-end deles nao e dirigivel sem pubspec — a ausencia de
    // encadeamento e DADO do menu (nunca inferida):
    for (const m of WIZARD_MENU.filter((x) => x.key !== '4')) {
      assert.ok(!m.next, `item ${m.key} nao encadeia o passo 2`);
    }
  });
});

describe('EX-FE-08 W2m-2 (ADR-004 §2): frontend so no item 4', () => {
  async function runMenu(input) {
    const out = capture();
    const res = await runWizard({ target: mkTarget({}), stdin: piped(input), stdout: out.stream, sourceDir: mkSource(), options: WOPTS });
    return { text: out.text(), res };
  }

  it('item 4 => Enter (default 1 = Vue) reproduz o comportamento congelado: java+vue (D-9)', async () => {
    const { text, res } = await runMenu(['4', '', 'demo', '', 'node', '', '']);
    const [header, vueItem, reactItem, prompt] = [ADR_MENU_LINES[7], ADR_MENU_LINES[8], ADR_MENU_LINES[9], ADR_MENU_LINES[10]];
    for (const literal of [header, vueItem, reactItem, prompt]) {
      assert.ok(text.includes(literal), `linha do ADR ausente/divergente: ${JSON.stringify(literal)}`);
    }
    assert.equal(w2m2Items(text).length, 2, 'exatamente 2 itens no W2m-2');
    assert.equal(res.answers.stack, 'java+vue', 'Enter = default Vue (D-9)');
  });

  it('item 4 => 2 (React) => java+react', async () => {
    const { res } = await runMenu(['4', '2', 'demo', '', 'node', '', '']);
    assert.equal(res.answers.stack, 'java+react');
  });

  it('a escolha do W2m-2 alimenta a pergunta do W3 (prompt mostra o stack escolhido)', async () => {
    const { text, res } = await runMenu(['4', '2', 'demo', '', 'node', '', '']);
    assert.equal(res.answers.stack, 'java+react');
    const line = text.split('\n').find((l) => l.includes('Stack do destino'));
    assert.ok(line && line.includes('(default: java+react)'), `W3 exibe o stack do W2m-2: ${line}`);
  });
});

describe('EX-VAL-09 asserção de itens ESCOPADA ao W2m-1 (regex global daria falso 7)', () => {
  it('com os DOIS blocos no texto, escopado = 5 no passo 1 e 2 no passo 2; global != 5', async () => {
    const out = capture();
    await runWizard({
      target: mkTarget({}),
      stdin: piped(['4', '2', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: mkSource(),
      options: WOPTS,
    });
    const text = out.text();
    assert.equal(w2m1Items(text).length, 5, 'exatamente 5 itens no W2m-1 (escopado)');
    assert.equal(w2m2Items(text).length, 2, 'exatamente 2 itens no W2m-2 (escopado)');
    assert.equal(globalItems(text).length, 7, 'global: 5 do passo 1 + 2 do passo 2');
    assert.notEqual(globalItems(text).length, 5, 'a asserção NAO escopada falharia (prova do escopo)');
  });

  it('pubspec.yaml presente => W2m inteiro pulado (nenhum prompt do menu)', async () => {
    const out = capture();
    const res = await runWizard({
      target: mkTarget({ 'pubspec.yaml': PUBSPEC_FLUTTER }),
      stdin: piped(['', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: mkSource(),
      options: WOPTS,
    });
    const text = out.text();
    assert.ok(!text.includes(W2M1_HEADER), 'sem cabecalho do W2m-1');
    assert.ok(!text.includes(W2M2_HEADER), 'sem cabecalho do W2m-2');
    assert.doesNotMatch(text, /\[\d\/\d\] escolha \[1-\d\]/, 'nenhum prompt de menu exibido');
    assert.equal(res.answers.stack, 'flutter', 'stack veio da deteccao');
  });

  for (const [label, input] of [['W2m-1', ['q']], ['W2m-2', ['4', 'q']]]) {
    it(`q em ${label} => USER_ABORT com 0 writes`, async () => {
      const t = mkTarget({});
      const before = JSON.stringify(fs.readdirSync(t));
      let applied = 0;
      await assert.rejects(
        runWizard({
          target: t,
          stdin: piped(input),
          stdout: capture().stream,
          sourceDir: mkSource(),
          options: WOPTS,
          apply: () => { applied++; return {}; },
        }),
        (e) => e instanceof InstallError && e.code === 'USER_ABORT',
      );
      assert.equal(applied, 0);
      assert.equal(JSON.stringify(fs.readdirSync(t)), before, 'disco intocado');
    });
  }
});

describe('EX-FE-08 bloco de erro de 4 linhas por passo (ADR-004 §5)', () => {
  it('AT-2: sourceLineOf(W2M_MARKER) aponta o BLOCO W2m em runWizard (nunca a declaracao)', () => {
    const src = fs.readFileSync(new URL('../install.mjs', import.meta.url), 'utf8').split('\n');
    const n = sourceLineOf(W2M_MARKER);
    assert.equal(typeof n, 'number', 'marcador presente no arquivo');
    const declLine = src.findIndex((l) => /^(export )?const W2M_MARKER/.test(l)) + 1;
    assert.ok(declLine > 0, 'a declaracao do marcador existe (referencia)');
    assert.notEqual(n, declLine, 'a ancora NAO pode apontar para a propria declaracao');
    assert.ok(src[n - 1].includes(W2M_MARKER), 'a linha resolvida contem o marcador');
    // ... e a linha resolvida e a do bloco, que chama o passo 1 logo abaixo:
    assert.match(src[n - 1], /^\s*\/\/.*W2m menu manual em 2 passos/, 'linha do bloco (comentario)');
    assert.ok(src.slice(n, n + 14).join('\n').includes('askMenuStep({'), 'o bloco chama askMenuStep abaixo da ancora');
  });

  it('AT-2: o texto renderizado no erro usa a linha do bloco (W2m-1 e W2m-2)', async () => {
    const n = sourceLineOf(W2M_MARKER);
    const out = capture();
    await runWizard({
      target: mkTarget({}),
      stdin: piped(['7', '4', '9', '2', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: mkSource(),
      options: WOPTS,
    });
    const text = out.text();
    assert.match(text, new RegExp(`onde ver: installer/install\\.mjs:${n} \\(W2m-1\\)`), 'linha 4 do erro (passo 1) = linha do bloco');
    assert.match(text, new RegExp(`onde ver: installer/install\\.mjs:${n} \\(W2m-2\\)`), 'linha 4 do erro (passo 2) = linha do bloco');
  });

  it('W2m-1: 4 linhas; linha 3 em linguagem de produto; linha 4 com arquivo:linha', async () => {
    const out = capture();
    const res = await runWizard({
      target: mkTarget({}),
      stdin: piped(['7', '3', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: mkSource(),
      options: WOPTS,
    });
    const text = out.text();
    assert.match(text, /\[ERRO\] opcao '7' invalida/);
    assert.match(text, /porquê: BAD_ANSWER: fora de \[1,5\]/);
    assert.match(text, /como corrigir: escolha o numero de um dos itens listados acima/);
    assert.doesNotMatch(text, /como corrigir:[^\n]*(flutter|dart|node-esm|java\+vue|outra)/, 'linha 3 sem jargao de stack');
    assert.match(text, /onde ver: installer\/install\.mjs:\d+ \(W2m-1\)/, 'linha 4 com arquivo:linha');
    assert.equal(res.answers.stack, 'node', 'repetiu o MESMO passo e aceitou o valido');
  });

  it('W2m-2: 4 linhas e REPETE o passo 2 (nao reinicia o menu)', async () => {
    const out = capture();
    const res = await runWizard({
      target: mkTarget({}),
      stdin: piped(['4', '9', '2', 'demo', '', 'node', '', '']),
      stdout: out.stream,
      sourceDir: mkSource(),
      options: WOPTS,
    });
    const text = out.text();
    assert.match(text, /\[ERRO\] opcao '9' invalida/);
    assert.match(text, /fora de \[1,2\]/);
    assert.match(text, /onde ver: installer\/install\.mjs:\d+ \(W2m-2\)/, 'linha 4 com arquivo:linha');
    assert.doesNotMatch(text, /como corrigir:[^\n]*(flutter|dart|node-esm|java\+vue|outra)/, 'linha 3 sem jargao de stack');
    assert.equal(res.answers.stack, 'java+react', 'repetiu o passo 2 e aceitou 2');
    assert.equal((text.match(/W2m tipo de projeto/g) || []).length, 1, 'passo 1 exibido 1x (nao reiniciou o menu)');
    assert.equal((text.match(/W2m frontend/g) || []).length, 1, 'cabecalho do passo 2 exibido 1x');
    assert.equal((text.match(/\[2\/2\] escolha/g) || []).length, 2, 'prompt do passo 2 REPETIDO apos o erro');
  });
});

describe('EX-FE-07 range do menu DERIVADO de items.length (A4)', () => {
  it('item sintetico adicional e ALCANCAVEL; prompt e erro derivam do total', async () => {
    const lines = [];
    const inputs = ['7', '6'];
    const read = async (label) => { lines.push(label); return inputs.shift(); };
    const items = [...WIZARD_MENU, { key: '6', label: 'Projeto Go', stack: 'outra' }];
    const picked = await askMenuStep({
      read,
      out: (s) => lines.push(s),
      answers: {},
      header: W2M1_HEADER,
      items,
      step: 1,
      total: 2,
    });
    assert.equal(picked.key, '6', 'indice novo aceito (com range literal cairia em BAD_ANSWER)');
    const text = lines.join('\n');
    assert.match(text, /\[1\/2\] escolha \[1-6\] \(q cancela\) > /, 'prompt deriva o range');
    assert.match(text, /6\) Projeto Go -> stack outra/, 'item sintetico listado');
    assert.match(text, /digite 1, 2, 3, 4, 5 ou 6/, 'mensagem de erro deriva o range');
    assert.match(text, /fora de \[1,6\]/);
  });

  it('o menu real deriva [1-5] (5 itens)', async () => {
    const lines = [];
    const inputs = ['9', '3'];
    const read = async (label) => { lines.push(label); return inputs.shift(); };
    const picked = await askMenuStep({ read, out: (s) => lines.push(s), answers: {}, header: W2M1_HEADER, items: WIZARD_MENU, step: 1, total: 2 });
    assert.equal(picked.stack, 'node', 'repetiu e aceitou');
    assert.match(lines.join('\n'), /\[1\/2\] escolha \[1-5\] \(q cancela\) > /);
    assert.match(lines.join('\n'), /fora de \[1,5\]/);
  });
});
