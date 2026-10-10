import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  DENYLIST,
  scanLiterals,
  isScannablePath,
  runChecks,
  requireVerifiedBackup,
  main,
  buildManifest,
  serializeAnswers,
  collectIncoming,
  QUESTIONS,
} from '../install.mjs';

let dirs = [];
function mkTarget(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in05-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
afterEach(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); dirs = []; });

function cleanManifest(target, backupDir, extra = {}) {
  return buildManifest({
    target, backupDir,
    installed: [{ path: 'opencode.json', kind: 'file' }],
    merged: [], flagged: [],
    answers: { project: 'demo', stack: 'node' },
    checks: { passed: true, failed: [] },
    fileContents: { 'opencode.json': fs.readFileSync(path.join(target, 'opencode.json'), 'utf8') },
    ...extra,
  });
}

describe('IN-05 S1: instalacao limpa => checks PASS com veredito', () => {
  it('PASS quando JSON valido + sem literais + flagged vazio', () => {
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({ version: 1, project: 'demo' }),
      '.agents/rules/clean.md': '# regra limpa do harness\nsem stack alheia\n',
    });
    const bk = path.join(os.tmpdir(), `harness-in05-bk-${Date.now()}`);
    fs.mkdirSync(bk, { recursive: true });
    dirs.push(bk);
    const manifest = cleanManifest(target, bk);
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    const verdict = runChecks(target, { manifest });
    assert.equal(verdict.passed, true, `esperava PASS, falhou: ${JSON.stringify(verdict.failed)}`);
    assert.deepEqual(verdict.failed, []);
  });
});

describe('IN-05 S2: flagged pendente / literal-canario => FAIL com motivo', () => {
  it('flagged nao-vazio => FAIL (I6)', () => {
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({ version: 1, project: 'demo' }),
    });
    const bk = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in05-bk-'));
    dirs.push(bk);
    const manifest = cleanManifest(target, bk, {
      flagged: [{ path: '.agents/rules/a.md', reason: 'exists-different' }],
    });
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    const verdict = runChecks(target, { manifest });
    assert.equal(verdict.passed, false, 'flag pendente bloqueia (I6)');
    assert.ok(verdict.failed.some((f) => /flag/i.test(f)), 'motivo cita flag');
  });

  it('denylist publicada e nao-vazia', () => {
    assert.ok(Array.isArray(DENYLIST) && DENYLIST.length >= 3, 'denylist inicial publicada');
    for (const lit of DENYLIST) assert.ok(typeof lit === 'string' && lit.length >= 3, `literal valido: ${lit}`);
  });

  it('canario R3: adocao real de stack alheia num arquivo de codigo => check falha', () => {
    const canary = 'vuetify';
    const planted = "import { createVuetify } from 'vuetify'\n";
    const target = mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({ version: 1, project: 'demo' }),
      '.opencode/plugins/plantada.js': planted,
    });
    const bk = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in05-bk-'));
    dirs.push(bk);
    const manifest = cleanManifest(target, bk, {
      installed: [{ path: '.opencode/plugins/plantada.js', kind: 'file' }],
      fileContents: {
        'opencode.json': fs.readFileSync(path.join(target, 'opencode.json'), 'utf8'),
        '.opencode/plugins/plantada.js': planted,
      },
    });
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    const verdict = runChecks(target, { manifest });
    assert.equal(verdict.passed, false, 'canario positivo deve falhar o check (R3)');
    assert.ok(verdict.failed.some((f) => f.includes(canary)), 'motivo cita o literal');
  });

  it('scanLiterals: quase-igual NAO casa (negativo)', () => {
    const hits = scanLiterals('nada suspeito aqui, so harness v7 limpo');
    assert.deepEqual(hits, []);
  });

  it('opencode.json corrompido => FAIL (R1)', () => {
    const target = mkTarget({
      'opencode.json': '{CORROMPIDO{{{',
      'harness.config.json': JSON.stringify({ version: 1, project: 'demo' }),
    });
    const bk = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in05-bk-'));
    dirs.push(bk);
    const verdict = runChecks(target, { manifest: cleanManifest(target, bk) });
    assert.equal(verdict.passed, false);
    assert.ok(verdict.failed.some((f) => /json|corromp/i.test(f)));
  });
});

describe('FU-32: canario por ESCOPO (substring amplo so em codigo/config)', () => {
  it('scanLiterals: substring amplo casa adocao real que o contextual deixava passar', () => {
    assert.deepEqual(scanLiterals("const Vuetify = require('vuetify/lib')"), ['vuetify'], 'CJS subpath');
    assert.deepEqual(scanLiterals('const app = new Vuetify()'), ['vuetify'], 'new X');
    assert.deepEqual(scanLiterals('Vue.use(Vuetify)'), ['vuetify'], '.use(X)');
    assert.deepEqual(scanLiterals("import { createVuetify } from 'vuetify'"), ['vuetify'], 'import');
    assert.deepEqual(scanLiterals('"primevue": "^3.5.0"'), ['primevue'], 'package.json dep');
    assert.deepEqual(scanLiterals("implementation 'org.projectlombok:lombok:1.18.30'"), ['lombok'], 'gradle');
    assert.deepEqual(scanLiterals('<artifactId>lombok</artifactId>'), ['lombok'], 'pom artifactId');
    assert.deepEqual(scanLiterals('using Vuetify;'), ['vuetify'], 'C# using');
  });

  it('scanLiterals: case-insensitive, ordem da DENYLIST', () => {
    assert.deepEqual(scanLiterals('NEW VUETIFY()'), ['vuetify']);
    assert.deepEqual(scanLiterals('require("Lombok")'), ['lombok']);
    assert.deepEqual(scanLiterals('TaskFlow e PrimeVue'), ['taskflow', 'primevue']);
  });

  it('scanLiterals: proibicao em prosa tambem casa (mencao crua) — o escopo e quem decide', () => {
    assert.deepEqual(scanLiterals('# Vuetify e proibido'), ['vuetify']);
  });

  it('isScannablePath: codigo/config sim, prosa/binario nao', () => {
    for (const p of ['a.js', 'b.mjs', 'c.cjs', 'd.ts', 'e.tsx', 'f.vue', 'g.svelte',
      'A.java', 'B.kt', 'C.kts', 'D.gradle', 'E.groovy', 'F.dart', 'G.cs', 'H.py',
      'I.rb', 'J.go', 'K.rs', 'L.php', 'M.xml', 'N.json', 'O.yaml', 'P.yml', 'Q.toml',
      'R.properties', 's.lock', 'pubspec.yaml', 'package.json', 'pom.xml', 'build.gradle',
      'build.gradle.kts']) {
      assert.equal(isScannablePath(p), true, `escaneavel: ${p}`);
    }
    for (const p of ['a.md', 'b.txt', 'c.png', 'd.pdf', 'sem-extensao']) {
      assert.equal(isScannablePath(p), false, `fora do scan: ${p}`);
    }
  });

  it('FU-33: buracos da allowlist fechados (html/css/sh/Dockerfile); .csv/noext seguem fora', () => {
    for (const p of ['a.html', 'b.css', 'c.sh', 'Dockerfile', 'dockerfile', 'sub/dir/page.html', 'sub/dir/Dockerfile']) {
      assert.equal(isScannablePath(p), true, `escaneavel (FU-33): ${p}`);
    }
    for (const p of ['d.csv', 'e.svg', 'sem-extensao', 'Makefile']) {
      assert.equal(isScannablePath(p), false, `fora do scan (FU-33): ${p}`);
    }
  });

  it('FU-33: tooling/testes do harness fora do scan (justificativa: plugins/__tests__ entra no incoming)', () => {
    for (const p of ['scripts/gerador.mjs', 'x/scripts/gerador.mjs', '__tests__/x.spec.mjs',
      '.opencode/plugins/__tests__/gate.spec.mjs', '.agents/skills/x/__tests__/y.mjs']) {
      assert.equal(isScannablePath(p), false, `fora do scan: ${p}`);
    }
    for (const p of ['app/main.js', '.opencode/plugins/gate.js', 'lib/util.dart']) {
      assert.equal(isScannablePath(p), true, `dentro do scan: ${p}`);
    }
  });

  function targetWith(rel, content) {
    return mkTarget({
      'opencode.json': JSON.stringify({ plugin: ['harness'] }),
      'harness.config.json': JSON.stringify({ version: 1, project: 'demo' }),
      [rel]: content,
    });
  }

  function manifestWith(target, rel) {
    const bk = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-fu32-bk-'));
    dirs.push(bk);
    const manifest = cleanManifest(target, bk, {
      installed: [{ path: rel, kind: 'file' }],
      fileContents: { [rel]: fs.readFileSync(path.join(target, rel), 'utf8') },
    });
    fs.writeFileSync(path.join(target, '.harness-install.json'), JSON.stringify(manifest));
    return manifest;
  }

  it('runChecks: prosa .md com proibicao/mencao => PASS (nao escaneada)', () => {
    const rel = '.agents/rules/guia.md';
    const target = targetWith(rel, '# Proibido Vuetify\nNunca use Lombok nem MapStruct. TaskFlow foi substituido.\n');
    const verdict = runChecks(target, { manifest: manifestWith(target, rel) });
    assert.equal(verdict.passed, true, `prosa nao reprova: ${JSON.stringify(verdict.failed)}`);
    assert.deepEqual(verdict.failed, []);
  });

  it('runChecks: .txt com mencao => PASS (nao escaneado)', () => {
    const rel = '.agents/rules/notas.txt';
    const target = targetWith(rel, 'vuetify lombok mapstruct restassured\n');
    assert.equal(runChecks(target, { manifest: manifestWith(target, rel) }).passed, true);
  });

  for (const [rel, content, lit] of [
    ['.opencode/plugins/plantada.js', "const V = require('vuetify/lib')\n", 'vuetify'],
    ['.agents/agents/adotado.ts', "import Vue from 'primevue'\n", 'primevue'],
    ['harness-deps.json', JSON.stringify({ dependencies: { vuetify: '^3' } }), 'vuetify'],
    ['pom.xml', '<dependency><groupId>org.projectlombok</groupId></dependency>\n', 'lombok'],
    ['build.gradle', "implementation 'org.mapstruct:mapstruct:1.5.5.Final'\n", 'mapstruct'],
    ['package.json', JSON.stringify({ name: 'x', packageManager: 'restassured' }), 'restassured'],
  ]) {
    it(`runChecks: adocao em ${rel} => FAIL`, () => {
      const target = targetWith(rel, content);
      const verdict = runChecks(target, { manifest: manifestWith(target, rel) });
      assert.equal(verdict.passed, false, `${rel} adota stack alheia`);
      assert.ok(verdict.failed.some((f) => f.includes(lit)), `motivo cita ${lit}`);
      assert.ok(verdict.failed.some((f) => f.includes('literal-denied') && f.includes('(R3/canario)')), 'mensagem canonica');
    });
  }

  it('runChecks: tooling/testes do harness excluidos do SCAN', () => {
    const rel = 'scripts/gerador.mjs';
    const target = targetWith(rel, '// fixture com vuetify\n');
    assert.equal(runChecks(target, { manifest: manifestWith(target, rel) }).passed, true, 'scripts/ fora do scan');
    const rel2 = '.opencode/plugins/__tests__/x.spec.mjs';
    const target2 = targetWith(rel2, "const x = 'lombok';\n");
    assert.equal(runChecks(target2, { manifest: manifestWith(target2, rel2) }).passed, true, '__tests__/ fora do scan');
  });

  it('conteudo REAL do harness (incoming) instala sem literal-denied falso', () => {
    const sourceDir = new URL('../../', import.meta.url).pathname;
    const target = mkTarget({});
    const incoming = collectIncoming(sourceDir, { stacks: [] });
    assert.ok(Object.keys(incoming).length > 50, 'incoming real coletado');
    const out = main({
      target,
      scriptedAnswers: { project: 'harness', stack: 'node', suiteCommand: 'node', pluginsDir: target },
      incomingFiles: incoming,
      options: { allowRoot: true, nodeVersion: 'v26.7.0', backupRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'harness-fu32-main-')) },
    });
    dirs.push(out.backup.backupDir);
    assert.equal(out.checks.passed, true, `harness limpo => checks PASS, falhou: ${JSON.stringify(out.checks.failed)}`);
    assert.deepEqual(out.checks.failed, []);
  });
});

describe('IN-05 S3: skill auto-suficiente (instala sem ler o SPEC)', () => {
  it('SKILL.md existe com quickstart + Q&A + rollback, sem exigir SPEC', () => {
    const skillPath = new URL('../../.agents/skills/harness-installer/SKILL.md', import.meta.url);
    const skill = fs.readFileSync(skillPath, 'utf8');
    for (const kw of ['--target', '--dry-run', 'backup', 'checks', 'rollback', 'Q&A']) {
      assert.ok(skill.includes(kw), `skill cobre: ${kw}`);
    }
    assert.ok(!/leia o SPEC|read the SPEC/i.test(skill), 'skill nao delega leitura ao SPEC');
  });

  it('Y3: skill documenta retencao/descarte do backup', () => {
    const skillPath = new URL('../../.agents/skills/harness-installer/SKILL.md', import.meta.url);
    const skill = fs.readFileSync(skillPath, 'utf8');
    assert.ok(/reten|retention|guardar|manter/i.test(skill), 'retencao documentada');
    assert.ok(/descart|rm -rf|remover|apagar/i.test(skill), 'descarte documentado');
  });
});

describe('FU-20: main() exige backup.verified===true antes de applyMerge (I1)', () => {
  it('requireVerifiedBackup rejeita verified!==true', () => {
    assert.throws(() => requireVerifiedBackup(null), /backup/i);
    assert.throws(() => requireVerifiedBackup({ verified: false }), /backup/i);
    assert.throws(() => requireVerifiedBackup({}), /backup/i);
    requireVerifiedBackup({ verified: true, backupDir: '/tmp/x' });
  });

  it('main sem backup (falha injetada) => aborta e nada instalado', () => {
    const target = mkTarget({});
    assert.throws(
      () => main({
        target,
        scriptedAnswers: { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: target },
        incomingFiles: { '.agents/rules/x.md': '# x\n' },
        options: { allowRoot: true, nodeVersion: 'v26.7.0', injectFailure: true },
      }),
      /backup/i,
    );
    assert.ok(!fs.existsSync(path.join(target, '.agents/rules/x.md')), 'nada escrito apos falha de backup');
    assert.ok(!fs.existsSync(path.join(target, '.harness-install.json')), 'sem manifesto apos abort');
  });

  it('main completo escreve conteudo + manifesto + checks PASS', () => {
    const target = mkTarget({});
    const out = main({
      target,
      scriptedAnswers: { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: target },
      incomingFiles: {
        'opencode.json': JSON.stringify({ plugin: ['harness'], instructions: ['hard'] }),
        '.agents/rules/x.md': '# regra limpa harness\n',
      },
      options: { allowRoot: true, nodeVersion: 'v26.7.0', backupRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in05-main-')) },
    });
    dirs.push(out.backup.backupDir);
    assert.equal(fs.readFileSync(path.join(target, '.agents/rules/x.md'), 'utf8'), '# regra limpa harness\n');
    assert.ok(fs.existsSync(path.join(target, '.harness-install.json')), 'manifesto gravado');
    assert.equal(out.checks.passed, true, `checks PASS: ${JSON.stringify(out.checks.failed)}`);
    assert.ok(!JSON.stringify(out.manifest.answers).includes('deployToken'), 'sem segredo no manifesto');
  });

  it('segredo scriptado nunca chega a disco nem log (I5 via main)', () => {
    const target = mkTarget({});
    const out = main({
      target,
      scriptedAnswers: { project: 'demo', stack: 'node', suiteCommand: 'node', pluginsDir: target, deployToken: 'FAKE-SECRET-zzz999' },
      incomingFiles: { '.agents/rules/x.md': '# regra limpa harness\n' },
      options: { allowRoot: true, nodeVersion: 'v26.7.0', backupRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'harness-in05-main-')) },
    });
    dirs.push(out.backup.backupDir);
    const disk = fs.readFileSync(path.join(target, '.harness-install.json'), 'utf8')
      + fs.readFileSync(path.join(target, 'harness.config.json'), 'utf8');
    assert.ok(!disk.includes('FAKE-SECRET-zzz999'), 'segredo ausente de disco');
    assert.ok(!JSON.stringify(serializeAnswers({ project: 'x', deployToken: 'FAKE-SECRET-zzz999' })).includes('FAKE-SECRET-zzz999'));
    assert.ok(QUESTIONS.find((q) => q.secret), 'ha campo secret marcado');
  });
});
