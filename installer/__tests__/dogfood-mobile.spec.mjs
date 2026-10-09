// dogfood-mobile.spec.mjs — IM-VAL-06: dogfood do instalador num projeto Flutter
// copiado para /tmp. Prova: config mobile correto + checks PASS + origem intocada
// + copia removida + evidencia harness-report gravada. Sem rede, sem TTY real.
//
// FU-34: isolamento provado por DIGEST de conteudo (nao so `git status --short`)
//   — alterar o conteudo de arquivo JA modificado na origem muda o digest.
//   C1: o parser do status eh `--porcelain -z` (NUL, sem C-quoting): path com
//   espaco/aspas/backslash/acento/`a -> b` precisa chegar literal ao hash,
//   senao o digest fica cego ('absent' constante).
// FU-35: limpeza em qualquer caminho — cp→install→validacao dentro de try/finally
//   — falha remove copia + backup; `--keep` preserva. A3: falha da propria
//   remocao (EACCES) nao engole a evidencia (`cleanupError`).
// C2: `--target` igual a origem, ancestral ou descendente dela ABORTA antes de
//   qualquer copy/remocao — sem isso a limpeza apagava arquivos do usuario.
// A1: esta spec nao deixa orfao em /tmp (varredura no afterEach + assert final).
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  assertMobileConfig,
  sanitizeFlutterCopy,
  sourceState,
  porcelainPaths,
  runDogfoodMobile,
  MOBILE_HARNESS_LAYERS,
} from '../dogfood-mobile.mjs';
import { backupOrphans, cleanupDogfood, cleanupErrorOf, cleanupNote } from '../dogfood-common.mjs';
import { sweepOrphans } from '../../scripts/test-temp.mjs';

// Prefixos que ESTA spec cria sob /tmp — a varredura so mexe neles. O sufixo
// "-mobile-" e explicito: o dogfood da stack generica usa
// "harness-dogfood-<ano>-..." e roda em paralelo (outro arquivo de spec) —
// prefixo frouxo faria uma spec apagar os temporarios da outra.
const RUN_T0 = Date.now();
const OWN_PATTERNS = [
  /^harness-dogfood-mobile-/,
  /^harness-dfm-/,
  /^\.harness-backup-harness-dogfood-mobile-/,
];

let dirs = [];
function mkTemp(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-dfm-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
afterEach(() => {
  for (const d of dirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* jah removido */ } }
  dirs = [];
  sweepOwnOrphans();
});

// A1: copia de `--keep` + backups orfaos deste run — sem isso cada execucao da
// suite sujava /tmp com 1 par orfao (o maior poluidor era o teste `--keep`).
// A regra vive no utilitário comum (scripts/test-temp.mjs, FU-43).
function sweepOwnOrphans() {
  return sweepOrphans(OWN_PATTERNS, { since: RUN_T0 });
}

const PUBSPEC_FLUTTER = `name: demo_app
environment:
  sdk: '>=3.0.0 <4.0.0'
dependencies:
  flutter:
    sdk: flutter
`;

function mkFlutterSource() {
  return mkTemp({
    'pubspec.yaml': PUBSPEC_FLUTTER,
    'analysis_options.yaml': 'include: package:flutter_lints/flutter.yaml\n',
    'lib/main.dart': 'void main() {}\n',
    'test/widget_test.dart': 'void main() {}\n',
  });
}

describe('IM-VAL-06 assertMobileConfig — perfil flutter do harness.config.json', () => {
  const good = {
    stack: { backend: 'flutter/dart mobile (Q&A)', frontend: 'flutter/dart mobile (Q&A)' },
    commands: { suiteFull: 'flutter test', unit: 'flutter test', analyze: 'dart analyze' },
    mcp: { required: ['marionette_mcp', 'dart'] },
    moduleMap: { lib: 'lib', test: 'test' },
  };

  it('aceita o config mobile correto', () => {
    const r = assertMobileConfig(good);
    assert.equal(r.ok, true, `esperava ok, erros: ${JSON.stringify(r.errors)}`);
    assert.deepEqual(r.errors, []);
  });

  it('rejeita config sem analyze, sem marionette_mcp ou com stack errada', () => {
    const r = assertMobileConfig({
      stack: { backend: 'node', frontend: 'node' },
      commands: { suiteFull: 'flutter test' },
      mcp: { required: ['dart'] },
      moduleMap: {},
    });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => /analyze/i.test(e)), 'acusa analyze ausente');
    assert.ok(r.errors.some((e) => /marionette_mcp/i.test(e)), 'acusa marionette_mcp ausente');
    assert.ok(r.errors.some((e) => /stack/i.test(e)), 'acusa stack nao-mobile');
  });
});

describe('IM-VAL-06 sanitizeFlutterCopy — copia vira projeto Flutter limpo', () => {
  it('remove as camadas do harness e preserva o projeto', () => {
    const copy = mkTemp({
      'pubspec.yaml': PUBSPEC_FLUTTER,
      'lib/main.dart': 'void main() {}\n',
      '.agents/rules/x.md': '# regra\n',
      '.opencode/plugins/gate.js': '// gate\n',
      'opencode.json': JSON.stringify({ plugin: ['x'] }),
      'harness.config.json': JSON.stringify({ version: 1 }),
      '.harness-install.json': JSON.stringify({ manifestSchemaVersion: 1 }),
    });
    const { removed } = sanitizeFlutterCopy(copy);
    for (const rel of MOBILE_HARNESS_LAYERS) {
      assert.ok(!fs.existsSync(path.join(copy, rel)), `${rel} removido`);
    }
    assert.ok(fs.existsSync(path.join(copy, 'pubspec.yaml')), 'pubspec preservado');
    assert.ok(fs.existsSync(path.join(copy, 'lib/main.dart')), 'lib preservado');
    assert.ok(removed.length >= MOBILE_HARNESS_LAYERS.length, 'removidos listados');
  });
});

describe('IM-VAL-06 runDogfoodMobile — instalacao real em copia /tmp', () => {
  it('config mobile + checks PASS + evidencia + copia removida + origem intocada', async () => {
    const source = mkFlutterSource();
    const evidenceDir = mkTemp({});
    const res = await runDogfoodMobile({
      source,
      keep: false,
      evidenceDir,
      runSuites: false,
      suiteCommand: 'node',
    });

    assert.equal(res.ok, true, `dogfood falhou: checks=${JSON.stringify(res.checks)} flags=${JSON.stringify(res.flags)}`);
    assert.equal(res.checks.passed, true, 'checks PASS');
    assert.deepEqual(res.checks.failed, []);
    assert.equal(res.config.commands.analyze, 'dart analyze', 'analyze do perfil');
    assert.deepEqual(res.config.mcp.required, ['marionette_mcp', 'dart'], 'mcp do perfil');
    assert.equal(res.config.moduleMap.lib, 'lib', 'moduleMap lib');
    assert.equal(res.config.moduleMap.test, 'test', 'moduleMap test');
    assert.equal(res.sourceUntouched, true, 'origem somente leitura');
    assert.equal(res.copyRemoved, true, 'copia limpa ao final');
    assert.ok(!fs.existsSync(res.copy), 'copia removida do disco');
    assert.ok(fs.existsSync(res.evidencePath), 'evidencia gravada');

    const ev = JSON.parse(fs.readFileSync(res.evidencePath, 'utf8'));
    for (const k of ['version', 'demand', 'agent', 'phase', 'gitSha', 'commands', 'counts', 'evaluation', 'brainStore', 'cleanup', 'selfReported']) {
      assert.ok(k in ev, `evidencia tem ${k} (harness-report schema)`);
    }
    assert.ok(Array.isArray(ev.commands) && ev.commands.length >= 1, 'commands nao-vazio');
    assert.equal(ev.selfReported, true);
  });

  it('alvo fora de /tmp => aborta (nunca instala no repo real)', async () => {
    const source = mkFlutterSource();
    await assert.rejects(
      () => runDogfoodMobile({ source, keep: true, runSuites: false, suiteCommand: 'node', target: '/etc/harness-dogfood-probe' }),
      /tmp|dogfood/i,
    );
  });
});

describe('FU-34 sourceState — digest de conteudo (isolamento real)', () => {
  function initGitRepo(d) {
    const g = (args) => execFileSync('git', ['-C', d, '-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] });
    g(['init', '-q']);
    g(['add', '-A']);
    g(['commit', '-qm', 'base']);
  }

  it('git: conteudo alterado em arquivo JA modificado muda o digest (status igual)', () => {
    const d = mkTemp({ 'lib/main.dart': 'void main() {}\n', 'pubspec.yaml': PUBSPEC_FLUTTER });
    initGitRepo(d);
    const clean = sourceState(d);
    assert.equal(clean.kind, 'git');

    // arquivo jah modificado na origem (prova antiga: status "--short" so)
    fs.writeFileSync(path.join(d, 'lib/main.dart'), 'void main() { /* v1 */ }\n');
    const mid = sourceState(d);
    assert.equal(mid.kind, 'git');
    assert.notEqual(clean.digest, mid.digest, ' modificacao inicial detectada');

    // MESMO status porcelain (" M lib/main.dart"), CONTEUDO diferente, MESMO tamanho
    const v1 = 'void main() { /* v1 */ }\n';
    const v2 = 'void main() { /* v2 */ }\n';
    assert.equal(v1.length, v2.length, 'mutacao de mesmo tamanho (prova mais fraca)');
    fs.writeFileSync(path.join(d, 'lib/main.dart'), v1);
    const s1 = sourceState(d);
    fs.writeFileSync(path.join(d, 'lib/main.dart'), v2);
    const s2 = sourceState(d);

    assert.equal(s1.status, s2.status, 'porcelain identico — prova antiga era cega aqui');
    assert.notEqual(s1.digest, s2.digest, 'digest detecta alteracao de conteudo');
  });

  it('git: arquivo untracked novo e delecao mudam o digest', () => {
    const d = mkTemp({ 'lib/main.dart': 'void main() {}\n' });
    initGitRepo(d);
    const before = sourceState(d);
    fs.writeFileSync(path.join(d, 'extra.txt'), 'novo\n');
    const withNew = sourceState(d);
    assert.notEqual(before.digest, withNew.digest, 'arquivo novo detectado');

    fs.rmSync(path.join(d, 'lib/main.dart'));
    const withDel = sourceState(d);
    assert.notEqual(withNew.digest, withDel.digest, 'delecao detectada');
  });

  it('sem git: alteracao de conteudo (mesmo tamanho) muda o digest', () => {
    const d = mkTemp({ 'lib/main.dart': 'void main() {}\n' });
    const s1 = sourceState(d);
    assert.equal(s1.kind, 'mtimes');
    fs.writeFileSync(path.join(d, 'lib/main.dart'), 'void main() { }\n');
    const s2 = sourceState(d);
    assert.notEqual(s1.digest, s2.digest, 'fallback sem git tambem detecta conteudo');
  });

  it('sem git: origem intacta => digest estavel', () => {
    const d = mkTemp({ 'lib/main.dart': 'void main() {}\n' });
    assert.equal(sourceState(d).digest, sourceState(d).digest, 'digest estavel sem falsos positivos');
  });
});

describe('FU-35 limpeza em qualquer caminho (try/finally)', () => {
  it('falha na validacao => copia e backup removidos (sem orfao)', async () => {
    const source = mkFlutterSource();
    const evidenceDir = mkTemp({});
    const res = await runDogfoodMobile({
      source,
      keep: false,
      evidenceDir,
      runSuites: false,
      suiteCommand: 'node',
      validateConfig: () => { throw new Error('falha injetada FU-35'); },
    });

    assert.equal(res.ok, false, 'dogfood nao ok em falha');
    assert.match(String(res.failure), /FU-35/, 'falha reportada');
    assert.equal(res.copyRemoved, true, 'copyRemoved true no caminho de falha');
    assert.ok(!fs.existsSync(res.copy), 'copia /tmp removida');
    assert.ok(res.backupDir, 'backupDir reportado');
    assert.ok(!fs.existsSync(res.backupDir), 'backup removido (sem orfao)');
    assert.ok(fs.existsSync(res.evidencePath), 'evidencia gravada mesmo em falha');
    const ev = JSON.parse(fs.readFileSync(res.evidencePath, 'utf8'));
    assert.match(String(ev.failure), /FU-35/, 'evidencia registra a falha');
  });

  it('--keep preserva copia (e backup) mesmo em falha', async () => {
    const source = mkFlutterSource();
    const evidenceDir = mkTemp({});
    const res = await runDogfoodMobile({
      source,
      keep: true,
      evidenceDir,
      runSuites: false,
      suiteCommand: 'node',
      validateConfig: () => { throw new Error('falha injetada keep'); },
    });

    assert.equal(res.ok, false);
    assert.equal(res.copyRemoved, false, '--keep nao remove');
    assert.ok(fs.existsSync(res.copy), 'copia mantida para inspecao');
    assert.ok(fs.existsSync(res.backupDir), 'backup mantido com --keep');
  });

  it('caminho feliz continua limpando copia + backup', async () => {
    const source = mkFlutterSource();
    const evidenceDir = mkTemp({});
    const res = await runDogfoodMobile({ source, keep: false, evidenceDir, runSuites: false, suiteCommand: 'node' });
    assert.equal(res.ok, true);
    assert.equal(res.copyRemoved, true);
    assert.ok(res.backupDir && !fs.existsSync(res.backupDir), 'backup do happy path removido');
  });
});

describe('C1 porcelainPaths — parser do `git status --porcelain -z` (NUL, sem quote)', () => {
  it('path com espaco, aspas, backslash e acento chega literal', () => {
    const raw = [
      ' M lib/café.dart',
      '?? lib/we"ird.dart',
      '?? lib/back\\slash.dart',
      '?? lib/a -> b.dart',
    ].map((s) => `${s}\u0000`).join('');
    assert.deepEqual(porcelainPaths(raw), [
      'lib/café.dart',
      'lib/we"ird.dart',
      'lib/back\\slash.dart',
      'lib/a -> b.dart',
    ]);
  });

  it('rename/copy no formato -z tem DOIS campos (to\0from) — ambos entram', () => {
    const raw = 'R  lib/novo.dart\u0000lib/velho.dart\u0000\u0000';
    assert.deepEqual(porcelainPaths(raw), ['lib/novo.dart', 'lib/velho.dart']);
  });

  it('status posicional eh preservado (nao trima a entrada)', () => {
    const raw = '?? lib/main.dart\u0000';
    assert.deepEqual(porcelainPaths(raw), ['lib/main.dart']);
  });
});

describe('C1 sourceState — digest nao eh cego a path quotado', () => {
  function initGitRepo(d) {
    const g = (args) => execFileSync('git', ['-C', d, '-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] });
    g(['init', '-q']);
    g(['add', '-A']);
    g(['commit', '-qm', 'base']);
  }

  for (const weird of ['café.dart', 'we"ird.dart', 'a -> b.dart']) {
    it(`mutacao de conteudo em '${weird}' muda o digest (status igual)`, () => {
      const d = mkTemp({ 'pubspec.yaml': PUBSPEC_FLUTTER });
      initGitRepo(d);
      const rel = path.join('lib', weird);
      const p = path.join(d, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, '// v1\n');
      const s1 = sourceState(d);
      assert.equal(s1.kind, 'git');
      assert.equal(s1.status, s1.status);

      fs.writeFileSync(p, '// v2\n');
      const s2 = sourceState(d);
      assert.equal(s1.status, s2.status, 'porcelain identico — a prova antiga era cega aqui');
      assert.notEqual(s1.digest, s2.digest, `digest detecta mutacao em ${weird}`);

      // criacao e delecao do mesmo path tambem mudam a assinatura
      fs.rmSync(p);
      const s3 = sourceState(d);
      assert.notEqual(s2.digest, s3.digest, `delecao de ${weird} detectada`);
    });
  }

  it('rename (R) de path estranho muda o digest', () => {
    const d = mkTemp({ 'pubspec.yaml': PUBSPEC_FLUTTER });
    initGitRepo(d);
    const lib = path.join(d, 'lib');
    fs.mkdirSync(lib, { recursive: true });
    fs.writeFileSync(path.join(lib, 'velho.dart'), 'conteudo\n');
    execFileSync('git', ['-C', d, 'add', '-A'], { stdio: ['ignore', 'ignore', 'ignore'] });
    execFileSync('git', ['-C', d, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'add'], { stdio: ['ignore', 'ignore', 'ignore'] });
    const before = sourceState(d);
    fs.renameSync(path.join(lib, 'velho.dart'), path.join(lib, 'novo -> renomeado.dart'));
    const after = sourceState(d);
    assert.notEqual(before.digest, after.digest, 'rename detectado (dois campos do -z)');
  });
});

describe('C2 trava destrutiva — --target nunca apaga a origem', () => {
  it('--target == --source => ABORTA e a origem permanece inteira', async () => {
    const source = mkFlutterSource();
    const evidenceDir = mkTemp({});
    const before = sourceState(source);
    await assert.rejects(
      () => runDogfoodMobile({ source, keep: false, evidenceDir, runSuites: false, suiteCommand: 'node', target: source }),
      /nao pode ser a origem nem ancestral\/descendente/,
    );
    assert.equal(sourceState(source).digest, before.digest, 'origem intacta (nada apagado)');
    assert.ok(fs.existsSync(path.join(source, 'pubspec.yaml')), 'pubspec da origem preservado');
    assert.ok(fs.existsSync(path.join(source, 'lib/main.dart')), 'lib da origem preservado');
  });

  it('--target ANCESTRAL da origem => ABORTA (irmaos do usuario intactos)', async () => {
    const parent = mkTemp({ 'arquivo-do-usuario.txt': 'dado do usuario\n' });
    const source = path.join(parent, 'projeto-flutter');
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, 'pubspec.yaml'), PUBSPEC_FLUTTER);
    const evidenceDir = mkTemp({});

    await assert.rejects(
      () => runDogfoodMobile({ source, keep: false, evidenceDir, runSuites: false, suiteCommand: 'node', target: parent }),
      /nao pode ser a origem nem ancestral\/descendente/,
    );
    assert.ok(fs.existsSync(path.join(parent, 'arquivo-do-usuario.txt')), 'irmao do usuario NAO apagado');
    assert.ok(fs.existsSync(path.join(source, 'pubspec.yaml')), 'origem NAO apagada');
  });

  it('--target DESCENDENTE da origem => ABORTA', async () => {
    const source = mkFlutterSource();
    const evidenceDir = mkTemp({});
    await assert.rejects(
      () => runDogfoodMobile({ source, keep: false, evidenceDir, runSuites: false, suiteCommand: 'node', target: path.join(source, 'alvo') }),
      /nao pode ser a origem nem ancestral\/descendente/,
    );
    assert.ok(fs.existsSync(path.join(source, 'lib/main.dart')), 'origem intacta');
  });
});

describe('A3 limpeza que lanca — evidencia sobrevive', () => {
  it('rmSync falha (EACCES) => cleanupError preenchido e evidencia gravada', async () => {
    const source = mkFlutterSource();
    const parent = mkTemp({});
    const copy = path.join(parent, 'alvo');
    fs.mkdirSync(path.join(copy, 'trava'), { recursive: true });
    fs.chmodSync(copy, 0o500);
    const evidenceDir = mkTemp({});
    let res;
    try {
      res = await runDogfoodMobile({ source, keep: false, evidenceDir, runSuites: false, suiteCommand: 'node', target: copy });
    } finally {
      fs.chmodSync(copy, 0o700);
    }
    assert.equal(res.ok, false, 'dogfood falha');
    assert.ok(res.failure, 'falha reportada');
    assert.ok(res.cleanupError, `cleanupError preenchido: ${res.cleanupError}`);
    assert.equal(res.copyRemoved, false, 'copyRemoved honesto');
    assert.ok(fs.existsSync(res.evidencePath), 'evidencia gravada apesar da falha de remocao');
    const ev = JSON.parse(fs.readFileSync(res.evidencePath, 'utf8'));
    assert.match(String(ev.cleanup.note), /FALHA ao remover/, 'A2: nota nao mente');
    assert.ok(ev.cleanup.error, 'A3: erro de limpeza na evidencia');
  });
});

describe('A4 varredura de backups orfaos (.harness-backup-<basename>-*)', () => {
  it('remove orfao criado durante a execucao e preserva o antigo', () => {
    const parent = mkTemp({});
    const copy = path.join(parent, 'alvo');
    fs.mkdirSync(copy, { recursive: true });
    const recent = path.join(parent, `.harness-backup-alvo-2026-10-09T00-00-00`);
    const old = path.join(parent, `.harness-backup-alvo-2020-01-01T00-00-00`);
    const other = path.join(parent, '.harness-backup-outro-projeto-2026-10-09T00-00-00');
    for (const d of [recent, old, other]) fs.mkdirSync(d, { recursive: true });
    // "criado durante a execucao": mtime >= t0informado.
    const t0 = Date.now() - 1000;
    fs.utimesSync(old, new Date(0), new Date(0));

    assert.deepEqual(backupOrphans(copy, t0).sort(), [recent].sort(), 'so o orfao recente deste alvo');

    const state = cleanupDogfood(copy, null, { keep: false, t0 });
    assert.equal(state.copyRemoved, true, 'copia removida');
    assert.ok(!fs.existsSync(recent), 'orfao recente removido');
    assert.ok(fs.existsSync(old), 'backup anterior preservado');
    assert.ok(fs.existsSync(other), 'backup de outro projeto preservado');
  });

  it('--keep nao varre nem remove orfao', () => {
    const parent = mkTemp({});
    const copy = path.join(parent, 'alvo');
    fs.mkdirSync(copy, { recursive: true });
    const orphan = path.join(parent, '.harness-backup-alvo-2026-10-09T00-00-00');
    fs.mkdirSync(orphan, { recursive: true });
    const state = cleanupDogfood(copy, null, { keep: true, t0: 0 });
    assert.equal(state.kept, true);
    assert.ok(fs.existsSync(orphan), 'orfao preservado com --keep (inspecao)');
    assert.ok(fs.existsSync(copy), 'copia preservada com --keep');
  });
});

describe('A2/A1 higiene da nota e do /tmp', () => {
  it('cleanupNote/cleanupErrorOf nao mentem sobre falha ou bloqueio', () => {
    assert.match(cleanupNote({ copyRemoved: true }, '/tmp/x'), /removidos/);
    assert.match(cleanupNote({ kept: true }, '/tmp/x'), /--keep/);
    assert.match(cleanupNote({ errors: ['/tmp/y: EACCES'] }, '/tmp/x'), /FALHA ao remover/);
    assert.match(cleanupNote({ blocked: ['/home/user/dados'] }, '/tmp/x'), /bloqueada/i);
    assert.equal(cleanupErrorOf({ errors: ['a'], blocked: ['b'] }), 'remocao falhou: a; remocao bloqueada: b');
    assert.equal(cleanupErrorOf({ errors: [], blocked: [] }), null);
  });

  it('spec nao deixa orfao proprio em /tmp', () => {
    assert.deepEqual(sweepOwnOrphans(), [], 'zero orfaos deste run');
  });
});
