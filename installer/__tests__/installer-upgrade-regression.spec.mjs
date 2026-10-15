// installer-upgrade-regression.spec.mjs — bugfix `installer-upgrade-regression`.
// Interpretacao C (decisao do owner): o installer e AUTO-CONSISTENTE com a
// config que ele mesmo gera. Se a config cita `.agents/schemas/**` e
// `.opencode/plugins/**`, ou o installer escreve esses artefatos, ou deixa de
// cita-los. O check `config-ref-missing` NAO e afrouxado: toda ref concreta
// presente na config continua tendo de existir no destino.
//
// Cobre:
//   BF-01  reproducao congelada: instalacao minima => checks PASS (TDD FIRST).
//   BF-01b dureza do check: ref concreta ausente continua reprovando.
//   BF-02  auto-consistencia: config so cita o que a execucao escreve.
//   BF-02b idempotencia do `upgrade`: 2a execucao nao reescreve schemas.
//   BF-03  contrato de exitCode em todos os caminhos do consumidor:
//          main() direto, runInit/runUpgrade, runCli legado (--answers-file) e
//          wizard TTY. Valida => 0; reprovada => 1 (nunca 0 em silencio).
//   BF-04  trava os call-sites de generateConfig (writtenPaths obrigatorio).
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Readable, Writable } from 'node:stream';
import {
  main,
  runInit,
  runUpgrade,
  runCli,
  runChecks,
  generateConfig,
  configReferenceTargets,
  writtenPathsOf,
} from '../install.mjs';

let dirs = [];
function mkDir(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-regr-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
afterEach(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); dirs = []; });

function sink() {
  return new Writable({ write(_c, _e, cb) { cb(); } });
}
function capture() {
  let buf = '';
  const stream = new Writable({ write(c, _e, cb) { buf += c.toString(); cb(); } });
  return { stream, text: () => buf };
}

const OPTS = { allowRoot: true, nodeVersion: 'v26.7.0' };
const SCHEMA_REL = '.agents/schemas/harness-report.schema.json';
const PLUGIN_REL = '.opencode/plugins/p.mjs';
const SCHEMA_BODY = `${JSON.stringify({ $schema: 'http://json-schema.org/draft-07/schema#', type: 'object' }, null, 2)}\n`;
const PLUGIN_BODY = 'export const ok = true;\n';

// Fonte completa do harness: inclui os artefatos que a config cita.
function mkFullSource() {
  return mkDir({
    'opencode.json': JSON.stringify({ plugin: ['harness'] }),
    '.agents/rules/a.md': '# a\n',
    [SCHEMA_REL]: SCHEMA_BODY,
    [PLUGIN_REL]: PLUGIN_BODY,
  });
}

function writeAnswers(t, extra = {}) {
  const af = path.join(t, 'answers.json');
  fs.writeFileSync(af, JSON.stringify({ project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: t, ...extra }));
  return af;
}

function configOf(t) {
  return JSON.parse(fs.readFileSync(path.join(t, 'harness.config.json'), 'utf8'));
}

// Fonte que REPROVA os checks: plugin com dependencia de stack alheia
// (canario literal-denied). Mesmo canario da fixture de runInit em BF-03.
function mkInvalidSource() {
  return mkDir({
    'opencode.json': JSON.stringify({ plugin: ['harness'] }),
    '.agents/rules/a.md': '# a\n',
    '.opencode/plugins/evil.js': "const Vuetify = require('vuetify/lib');\n",
  });
}

// answers-file fora do target (o caminho CLI le o arquivo, nao o instala).
// pluginsDir PRECISA estar dentro do target (assertInside/OUSIDE_TARGET).
function mkAnswers(pluginsDir, extra = {}) {
  const dir = mkDir({});
  const af = path.join(dir, 'answers.json');
  fs.writeFileSync(af, JSON.stringify({ project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir, ...extra }));
  return af;
}

// stdin fake TTY com as respostas do wizard (node sem pubspec): menu W2m=3,
// project, stack default, suiteCommand, pluginsDir, deployToken.
function ttyStdin(lines = ['3', 'demo', '', 'node', '', '']) {
  const s = Readable.from(lines.map((l) => `${l}\n`));
  s.isTTY = true;
  return s;
}

// ---------------------------------------------------------------------------
describe('BF-01 (installer-upgrade-regression): instalacao minima e auto-consistente', () => {
  it('main() com incomingFiles minimo => checks PASS, sem config-ref-missing', () => {
    const t = mkDir({});
    const out = main({
      target: t,
      scriptedAnswers: { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: t },
      incomingFiles: { '.agents/rules/x.md': '# regra limpa harness\n' },
      options: { ...OPTS, backupRoot: mkDir({}) },
    });
    assert.equal(out.checks.passed, true, `checks devem PASS: ${JSON.stringify(out.checks.failed)}`);
    assert.ok(
      !out.checks.failed.some((f) => /config-ref-missing/.test(f)),
      'nenhuma ref ausente pode ser declarada pela config gerada',
    );
  });

  it('BF-01b: config-ref-missing permanece DURO — ref concreta ausente reprova', () => {
    const t = mkDir({
      '.harness-install.json': JSON.stringify({ manifestSchemaVersion: 1, source: 'harness@1', installed: [], merged: [], flagged: [] }),
      'harness.config.json': JSON.stringify({
        evidence: { path: 'harness/', schema: SCHEMA_REL },
        moduleMap: { plugins: '.opencode/plugins', rules: '.agents/rules', schemas: '.agents/schemas' },
      }),
    });
    const manifest = JSON.parse(fs.readFileSync(path.join(t, '.harness-install.json'), 'utf8'));
    const r = runChecks(t, { manifest });
    assert.equal(r.passed, false, 'refs concretas ausentes reprovam a instalacao');
    const joined = r.failed.join('\n');
    assert.match(joined, /config-ref-missing: evidence\.schema/, 'schema ausente reprovado');
    assert.match(joined, /config-ref-missing: moduleMap\.plugins/, 'plugins ausente reprovado');
    assert.match(joined, /config-ref-missing: moduleMap\.schemas/, 'schemas ausente reprovado');
    assert.match(joined, /config-ref-missing: moduleMap\.rules/, 'rules ausente reprovado');
  });
});

// ---------------------------------------------------------------------------
describe('BF-02 (installer-upgrade-regression): config so cita o que a execucao escreve', () => {
  it('instalacao minima: refs citadas existem; camadas ausentes nao sao citadas', () => {
    const t = mkDir({});
    main({
      target: t,
      scriptedAnswers: { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: t },
      incomingFiles: { '.agents/rules/x.md': '# regra limpa harness\n' },
      options: { ...OPTS, backupRoot: mkDir({}) },
    });
    const cfg = configOf(t);
    for (const ref of configReferenceTargets(cfg)) {
      assert.ok(fs.existsSync(path.join(t, ref.path)), `ref ${ref.label} ('${ref.path}') existe no destino`);
    }
    assert.equal(cfg.moduleMap.rules, '.agents/rules', 'rules instalada => citada');
    assert.equal(cfg.moduleMap.plugins, undefined, 'plugins nao instalados => nao citados');
    assert.equal(cfg.moduleMap.schemas, undefined, 'schemas nao instalados => nao citados');
    assert.equal(cfg.evidence.schema, undefined, 'evidence.schema nao instalado => nao citado');
    assert.equal(cfg.evidence.path, 'harness/', 'evidence.path preservado');
  });

  it('instalacao completa: schema/plugins escritos => refs mantidas e checks PASS', async () => {
    const t = mkDir({});
    const src = mkFullSource();
    const af = writeAnswers(t);
    const res = await runInit({
      target: t,
      stdin: Readable.from([]),
      stdout: sink(),
      stderr: sink(),
      sourceDir: src,
      answersFile: af,
      options: { allowRoot: true, yes: true },
    });
    dirs.push(res.backupDir);
    assert.equal(res.checks.passed, true, `checks: ${JSON.stringify(res.checks.failed)}`);
    const cfg = configOf(t);
    assert.equal(cfg.evidence.schema, SCHEMA_REL, 'schema escrito => citado');
    assert.equal(cfg.moduleMap.plugins, '.opencode/plugins', 'plugins escritos => citados');
    assert.ok(fs.existsSync(path.join(t, SCHEMA_REL)), 'schema realmente escrito');
    for (const ref of configReferenceTargets(cfg)) {
      assert.ok(fs.existsSync(path.join(t, ref.path)), `ref ${ref.label} ('${ref.path}') existe no destino`);
    }
  });

  it('writtenPathsOf + generateConfig: sem writtenPaths o baseline congelado (golden) fica intacto', () => {
    const full = generateConfig({ project: 'demo', stack: 'node' });
    assert.deepEqual(full.moduleMap, { plugins: '.opencode/plugins', rules: '.agents/rules', schemas: '.agents/schemas' });
    assert.equal(full.evidence.schema, SCHEMA_REL);
    const trimmed = generateConfig({ project: 'demo', stack: 'node' }, { writtenPaths: writtenPathsOf({ '.agents/rules/x.md': '# x\n' }) });
    assert.deepEqual(trimmed.moduleMap, { rules: '.agents/rules' });
    assert.equal(trimmed.evidence.schema, undefined);
  });
});

// ---------------------------------------------------------------------------
describe('BF-02b (installer-upgrade-regression): upgrade idempotente, nao reescreve schema', () => {
  it('2 execucoes de upgrade: 2a inteiramente noop, schema intacto (conteudo/mtime/inode)', async () => {
    const t = mkDir({});
    const src = mkFullSource();
    const af = writeAnswers(t);
    const init = await runInit({
      target: t,
      stdin: Readable.from([]),
      stdout: sink(),
      stderr: sink(),
      sourceDir: src,
      answersFile: af,
      options: { allowRoot: true, yes: true },
    });
    dirs.push(init.backupDir);

    const schemaAbs = path.join(t, SCHEMA_REL);
    const before = fs.statSync(schemaAbs);
    const bodyBefore = fs.readFileSync(schemaAbs, 'utf8');

    const r1 = await runUpgrade({ target: t, stdin: Readable.from([]), stdout: sink(), stderr: sink(), sourceDir: src, options: { allowRoot: true, yes: true } });
    dirs.push(r1.backupDir);
    assert.equal(r1.checks.passed, true, `upgrade#1 checks: ${JSON.stringify(r1.checks.failed)}`);
    const schemaStep = r1.plan.find((p) => p.path === SCHEMA_REL);
    assert.ok(schemaStep, 'plano do upgrade cita o schema');
    assert.equal(schemaStep.action, 'noop', 'schema identico => noop (nunca reescreve)');

    const r2 = await runUpgrade({ target: t, stdin: Readable.from([]), stdout: sink(), stderr: sink(), sourceDir: src, options: { allowRoot: true, yes: true } });
    dirs.push(r2.backupDir);
    assert.equal(r2.checks.passed, true, `upgrade#2 checks: ${JSON.stringify(r2.checks.failed)}`);
    assert.ok(
      r2.plan.every((p) => p.action === 'noop'),
      `2o upgrade deve ser inteiramente noop, veio ${JSON.stringify(r2.plan.map((p) => [p.path, p.action]))}`,
    );

    const after = fs.statSync(schemaAbs);
    assert.equal(fs.readFileSync(schemaAbs, 'utf8'), bodyBefore, 'conteudo do schema intacto');
    assert.equal(after.mtimeMs, before.mtimeMs, 'mtime do schema intacto (nao reescrito)');
    assert.equal(after.ino, before.ino, 'mesmo inode (arquivo nao recriado)');
  });
});

// ---------------------------------------------------------------------------
// D1 (review): o contrato de exitCode tem de valer em TODOS os caminhos que o
// consumidor real usa — nao so runInit/runUpgrade. `main()` e a raiz comum:
// runCli legado (`--answers-file`) e o wizard TTY devolvem o objeto de main()
// verbatim, e o top-level faz `res.exitCode ?? 0`. Se main() nao carrega
// exitCode, uma instalacao reprovada sai 0 em silencio nesses caminhos.
describe('BF-03 (installer-upgrade-regression): contrato de exitCode', () => {
  it('runInit valida => exitCode 0', async () => {
    const t = mkDir({});
    const src = mkFullSource();
    const af = writeAnswers(t);
    const res = await runInit({
      target: t,
      stdin: Readable.from([]),
      stdout: sink(),
      stderr: sink(),
      sourceDir: src,
      answersFile: af,
      options: { allowRoot: true, yes: true },
    });
    dirs.push(res.backupDir);
    assert.equal(res.checks.passed, true, `checks: ${JSON.stringify(res.checks.failed)}`);
    assert.equal(res.exitCode, 0, 'instalacao valida sai 0');
  });

  it('runInit invalida (canario literal-denied) => exitCode 1', async () => {
    const t = mkDir({});
    const src = mkInvalidSource();
    const af = writeAnswers(t);
    const res = await runInit({
      target: t,
      stdin: Readable.from([]),
      stdout: sink(),
      stderr: sink(),
      sourceDir: src,
      answersFile: af,
      options: { allowRoot: true, yes: true },
    });
    dirs.push(res.backupDir);
    assert.equal(res.checks.passed, false, 'canario literal-denied reprova');
    assert.equal(res.exitCode, 1, 'instalacao invalida sai 1');
  });

  it('main() direto: checks PASS => 0; checks FAIL => 1', () => {
    const base = { project: 'demo', stack: 'node', suiteCommand: 'node' };
    const okTarget = mkDir({});
    const ok = main({
      target: okTarget,
      scriptedAnswers: { ...base, pluginsDir: okTarget },
      incomingFiles: { '.agents/rules/x.md': '# x\n' },
      options: { ...OPTS, backupRoot: mkDir({}) },
    });
    assert.equal(ok.checks.passed, true, `checks: ${JSON.stringify(ok.checks.failed)}`);
    assert.equal(ok.exitCode, 0, 'main() valido devolve exitCode 0');

    const badTarget = mkDir({});
    const bad = main({
      target: badTarget,
      scriptedAnswers: { ...base, pluginsDir: badTarget },
      incomingFiles: { '.agents/rules/x.md': '# x\n', '.opencode/plugins/evil.js': "const Vuetify = require('vuetify/lib');\n" },
      options: { ...OPTS, backupRoot: mkDir({}) },
    });
    assert.equal(bad.checks.passed, false, 'canario literal-denied reprova');
    assert.equal(bad.exitCode, 1, 'main() invalido devolve exitCode 1');
  });

  it('runCli legado (--answers-file): PASS => 0; FAIL => 1', async () => {
    const okTarget = mkDir({});
    const okRes = await runCli({
      argv: ['--target', okTarget, '--allow-root', '--yes', '--answers-file', mkAnswers(okTarget)],
      stdin: Readable.from([]),
      stdout: sink(),
      stderr: sink(),
      sourceDir: mkFullSource(),
    });
    dirs.push(okRes.backup.backupDir);
    assert.equal(okRes.checks.passed, true, `checks: ${JSON.stringify(okRes.checks.failed)}`);
    assert.equal(okRes.exitCode, 0, 'runCli legado valido => 0');

    const badTarget = mkDir({});
    const badRes = await runCli({
      argv: ['--target', badTarget, '--allow-root', '--yes', '--answers-file', mkAnswers(badTarget)],
      stdin: Readable.from([]),
      stdout: sink(),
      stderr: sink(),
      sourceDir: mkInvalidSource(),
    });
    dirs.push(badRes.backup.backupDir);
    assert.equal(badRes.checks.passed, false, 'canario literal-denied reprova');
    assert.equal(badRes.exitCode, 1, 'runCli legado reprovado => 1 (top-level nao pode sair 0)');
  });

  it('runCli wizard TTY (sem --answers-file): PASS => 0; FAIL => 1', async () => {
    const okRes = await runCli({
      argv: ['--target', mkDir({}), '--allow-root', '--yes'],
      stdin: ttyStdin(),
      stdout: sink(),
      stderr: sink(),
      sourceDir: mkFullSource(),
    });
    dirs.push(okRes.backup.backupDir);
    assert.equal(okRes.checks.passed, true, `checks: ${JSON.stringify(okRes.checks.failed)}`);
    assert.equal(okRes.exitCode, 0, 'wizard valido => 0');

    const badRes = await runCli({
      argv: ['--target', mkDir({}), '--allow-root', '--yes'],
      stdin: ttyStdin(),
      stdout: sink(),
      stderr: sink(),
      sourceDir: mkInvalidSource(),
    });
    dirs.push(badRes.backup.backupDir);
    assert.equal(badRes.checks.passed, false, 'canario literal-denied reprova no wizard');
    assert.equal(badRes.exitCode, 1, 'wizard reprovado => 1 (top-level nao pode sair 0)');
  });
});

// ---------------------------------------------------------------------------
// D3 (review): trava os call-sites de generateConfig. O default opt-in
// (`writtenPaths = null`) e necessario para o baseline congelado (golden I7),
// mas um call-site de instalacao que ESQUECA o 2o argumento volta em silencio
// ao comportamento antigo (falso-FAIL de config-ref-missing) sem falhar teste.
// Este caso enumera os call-sites em install.mjs e exige writtenPaths em cada.
describe('BF-04 (installer-upgrade-regression): call-sites de generateConfig passam writtenPaths', () => {
  it('todo call-site de instalacao em install.mjs passa { writtenPaths }', () => {
    const src = fs.readFileSync(new URL('../install.mjs', import.meta.url), 'utf8');
    const sites = [];
    const re = /(?<!function )generateConfig\(/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      let depth = 1;
      let j = m.index + m[0].length;
      while (j < src.length && depth > 0) {
        const ch = src[j];
        if (ch === '(') depth += 1;
        else if (ch === ')') depth -= 1;
        j += 1;
      }
      sites.push(src.slice(m.index, j));
    }
    assert.equal(sites.length, 4, `esperados 4 call-sites de instalacao (main/runInit/runCli/runUpgrade), achados ${sites.length}`);
    for (const site of sites) {
      assert.match(site, /writtenPaths:\s*writtenPathsOf\(/, `call-site sem writtenPaths (volta ao baseline silencioso): ${site.slice(0, 80)}`);
    }
  });
});
