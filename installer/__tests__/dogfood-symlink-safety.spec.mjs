// dogfood-symlink-safety.spec.mjs — FU-34/35 rodada FINAL (hard-stop).
// Fecha os dois defeitos destrutivos sobreviventes da limpeza do dogfood:
//
//   🔴-1  C2 lexical: `assertDisjointSourceTarget` comparava paths ESCRITOS
//         (`path.resolve`). Fonte alcancada por SYMLINK + `--target` no path
//         real passava o cheque => `cp` copiava sobre si mesmo e falhava =>
//         `finally` => `rmSync(copy)` => a ORIGEM inteira apagada.
//         Prova: origem via symlink + alvo no path real ABORTA e a origem
//         fica INTACTA (digest igual, `pubspec.yaml` presente).
//
//   🔴-2  Zona de remocao lexical: `isInsideTmp`/`removeWithinTmp`/
//         `backupOrphans` decidiam por `resolve`; `rmSync`/`statSync` seguem
//         symlink. Um atalho dentro da zona (ou nomeado como backup orfao)
//         atravessava o /tmp e removia/citava referente FORA dele.
//         Prova: atalho no topo => `blocked`; atalho interno => `blocked`;
//         referente intacto em todos os casos.
//
// Politica (conservadora, provavel por teste): so remove o que TODA camada
// prova seguro — lstat (nao-symlink) + realpath dentro de os.tmpdir() real +
// disjoint da origem + nenhum atalho interno apontando para fora. Duvida =>
// `blocked` (orfao inofensivo) em vez de delecao errada.
//
// Prefixo proprio deste run: `harness-dfs-` (a spec generica usa
// `harness-dogfood-<digito>-`, a mobile `harness-dfm-`/`harness-dogfood-mobile-`;
// varreduras diferentes nao se apagam entre si quando rodam em paralelo).
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { runDogfood, sourceState } from '../dogfood.mjs';
import {
  assertDisjointSourceTarget,
  backupOrphans,
  cleanupDogfood,
  realOrResolved,
  removeWithinTmp,
} from '../dogfood-common.mjs';

const RUN_T0 = Date.now();
const OWN_PATTERNS = [/^harness-dfs-/];

let dirs = [];
let outside = [];

function mkTemp(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-dfs-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}

// Referente FORA de os.tmpdir() — unico jeito de provar que a remocao nao
// atravessa o atalho. Criado e destruido por esta spec, sempre.
function mkOutside(files = {}) {
  const d = fs.mkdtempSync(path.join(os.homedir(), 'harness-dfs-referent-'));
  outside.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}

function sweepOwn() {
  const removed = [];
  let entries = [];
  try { entries = fs.readdirSync(os.tmpdir(), { withFileTypes: true }); } catch { return removed; }
  for (const e of entries) {
    if (!OWN_PATTERNS.some((re) => re.test(e.name))) continue;
    const p = path.join(os.tmpdir(), e.name);
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.mtimeMs < RUN_T0 - 1000) continue;
    try { fs.rmSync(p, { recursive: true, force: true }); removed.push(e.name); } catch { /* melhor esforco */ }
  }
  return removed;
}

afterEach(() => {
  for (const d of dirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* jah removido */ } }
  dirs = [];
  for (const d of outside) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* jah removido */ } }
  outside = [];
  sweepOwn();
});

function digestOf(dir) {
  return sourceState(dir).digest;
}

describe('C2 realpath — origem alcancada por symlink (FU-34 hard-stop)', () => {
  it('--target no path real da origem => ABORTA (lexico passava, origin morria)', () => {
    const real = mkTemp({ 'pubspec.yaml': 'name: x\n', 'lib/main.dart': 'void main() {}\n' });
    const link = path.join(real, 'atalho-para-a-origem');
    fs.symlinkSync(real, link);

    assert.throws(
      () => assertDisjointSourceTarget(link, real),
      /nao pode ser a origem nem ancestral\/descendente/,
    );
    assert.ok(fs.existsSync(path.join(real, 'pubspec.yaml')), 'origem intacta');
  });

  it('ancestral alcancado por symlink => ABORTA', () => {
    const real = mkTemp({ 'projeto/lib.js': 'x\n', 'arquivo-do-usuario.txt': 'dado\n' });
    const link = path.join(real, 'ponteiro');
    fs.symlinkSync(real, link);

    assert.throws(
      () => assertDisjointSourceTarget(link, path.join(real, 'projeto')),
      /nao pode ser a origem nem ancestral\/descendente/,
    );
    assert.ok(fs.existsSync(path.join(real, 'arquivo-do-usuario.txt')), 'irmao preservado');
  });

  it('alvo legitimo com origem por symlink NAO aborta (sem falso positivo)', () => {
    const real = mkTemp({ 'README.md': '# origem\n' });
    const link = path.join(real, 'ponteiro');
    fs.symlinkSync(real, link);
    const alvo = path.join(os.tmpdir(), `harness-dfs-alvo-${process.pid}`);

    const r = assertDisjointSourceTarget(link, alvo);
    assert.equal(r.source, link, 'origem lexical devolvida');
    assert.equal(r.copy, path.resolve(alvo));
    assert.equal(r.sourceReal, fs.realpathSync(real), 'realpath da origem exposto');
    assert.equal(realOrResolved(link), fs.realpathSync(real));
  });

  it('(a) runDogfood com --source por symlink e --target no real => origem INTACTA', async () => {
    const real = mkTemp({ 'README.md': '# origem dogfood\n', 'lib/index.js': 'module.exports = 1;\n' });
    const link = path.join(real, 'atalho-para-a-origem');
    fs.symlinkSync(real, link);
    const before = digestOf(real);

    await assert.rejects(
      () => runDogfood({ source: link, keep: false, evidenceDir: mkTemp({}), runSuites: false, target: real }),
      /nao pode ser a origem nem ancestral\/descendente/,
    );

    assert.equal(digestOf(real), before, 'digest identico: nada apagado nem reescrito');
    assert.ok(fs.existsSync(path.join(real, 'lib/index.js')), 'arvore da origem presente');
    assert.equal(fs.statSync(path.join(real, 'README.md')).size > 0, true, 'conteudo preservado');
  });
});

// Ponta-a-ponta: a copia REAL do dogfood herdou um atalho da origem. A
// limpeza tem que bloquear, deixar orfao e REPORTAR — nunca remover o
// referente fora do /tmp (politica conservadora em acao, na origem).
describe('(b) ponta-a-ponta — copia com atalho para fora da zona', () => {
  it('runDogfood bloqueia a limpeza e o referente sobrevive', async () => {
    const referente = mkOutside({ 'pubspec.yaml': 'name: x\n' });
    const parent = mkTemp({});
    const source = path.join(parent, 'origem');
    fs.mkdirSync(path.join(source, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(source, 'README.md'), '# origem\n');
    fs.writeFileSync(path.join(source, 'lib', 'index.js'), 'module.exports = 1;\n');
    fs.symlinkSync(referente, path.join(source, 'lib', 'atalho'));
    const evidenceDir = mkTemp({});

    const res = await runDogfood({
      source,
      keep: false,
      evidenceDir,
      runSuites: false,
      target: path.join(parent, 'alvo'),
    });

    assert.equal(res.copyRemoved, false, 'copyRemoved honesto: bloqueado, nao removido');
    assert.ok(res.cleanupError && /remocao bloqueada/i.test(res.cleanupError), `cleanupError: ${res.cleanupError}`);
    assert.ok(fs.existsSync(path.join(referente, 'pubspec.yaml')), 'referente FORA do /tmp intacto');
    assert.ok(fs.existsSync(res.copy), 'copia orfa preservada para inspecao');

    const ev = JSON.parse(fs.readFileSync(res.evidence, 'utf8'));
    assert.match(String(ev.cleanup.note), /BLOQUEADA/, 'evidencia nao mente sobre o bloqueio');
    assert.ok(ev.cleanup.blocked.length > 0, 'blocked registrado na evidencia');
  });
});

describe('Zona de remocao — atalho no topo da lista (FU-35)', () => {
  it('removeWithinTmp bloqueia symlink e o referente FORA do /tmp sobrevive', () => {
    const referente = mkOutside({ 'dado-do-usuario.txt': 'nao pode sumir\n' });
    const atalho = path.join(mkTemp({}), 'atalho');
    fs.symlinkSync(referente, atalho);

    const res = removeWithinTmp([atalho]);

    assert.deepEqual(res.removed, [], 'nada removido');
    assert.deepEqual(res.blocked, [path.resolve(atalho)], 'bloqueado com o caminho exato');
    assert.equal(res.ok, false);
    assert.ok(fs.existsSync(path.join(referente, 'dado-do-usuario.txt')), 'referente fora do /tmp intacto');
    assert.ok(fs.lstatSync(atalho).isSymbolicLink(), 'o proprio atalho tambem nao foi apagado');
  });

  it('cleanupDogfood bloqueia quando a copia eh um symlink (nao remove o referente)', () => {
    const referente = mkOutside({ 'pubspec.yaml': 'name: x\n' });
    const atalho = path.join(mkTemp({}), 'copia-atalho');
    fs.symlinkSync(referente, atalho);

    const state = cleanupDogfood(atalho, null);

    assert.equal(state.copyRemoved, false, 'copyRemoved honesto');
    assert.deepEqual(state.blocked, [path.resolve(atalho)]);
    assert.ok(fs.existsSync(path.join(referente, 'pubspec.yaml')), 'referente intacto');
  });
});

describe('Zona de remocao — atalho DENTRO da arvore', () => {
  it('cleanupDogfood bloqueia a copia com symlink interno apontando para fora do /tmp', () => {
    const referente = mkOutside({ 'pubspec.yaml': 'name: x\n' });
    const parent = mkTemp({});
    const copy = path.join(parent, 'harness-dogfood-2026');
    fs.mkdirSync(path.join(copy, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(copy, 'lib/x.js'), 'x\n');
    fs.symlinkSync(referente, path.join(copy, 'lib', 'atalho'));

    const state = cleanupDogfood(copy, null);

    assert.deepEqual(state.removed, [], 'nada removido: duvida => bloqueio');
    assert.deepEqual(state.blocked, [path.resolve(copy)], 'copia bloqueada (orfao inofensivo)');
    assert.equal(state.copyRemoved, false);
    assert.ok(fs.existsSync(path.join(referente, 'pubspec.yaml')), 'referente FORA do /tmp intacto');
    assert.ok(fs.existsSync(path.join(copy, 'lib/x.js')), 'copia permanece para inspecao');
  });

  it('symlink interno para DENTRO do /tmp nao bloqueia a remocao (granularidade)', () => {
    const parent = mkTemp({});
    const referente = path.join(parent, 'referente-interno');
    fs.mkdirSync(referente, { recursive: true });
    fs.writeFileSync(path.join(referente, 'dentro.txt'), 'ok\n');
    const copy = path.join(parent, 'harness-dogfood-copy');
    fs.mkdirSync(copy, { recursive: true });
    fs.symlinkSync(referente, path.join(copy, 'atalho-interno'));

    const state = cleanupDogfood(copy, null);

    assert.equal(state.copyRemoved, true, 'copia removida (atalho interno nao cruza a zona)');
    assert.deepEqual(state.blocked, []);
    assert.ok(fs.existsSync(path.join(referente, 'dentro.txt')), 'referente interno preservado');
  });

  it('atalho que nao resolve (pendurado) => desprovavel => bloqueia', () => {
    const parent = mkTemp({});
    const copy = path.join(parent, 'harness-dogfood-copy');
    fs.mkdirSync(copy, { recursive: true });
    fs.symlinkSync(path.join(parent, 'inexistente'), path.join(copy, 'atalho-quebrado'));

    const state = cleanupDogfood(copy, null);

    assert.equal(state.copyRemoved, false, 'sem prova de destino => nao remove');
    assert.deepEqual(state.blocked, [path.resolve(copy)]);
    assert.ok(fs.lstatSync(path.join(copy, 'atalho-quebrado')).isSymbolicLink(), 'atalho pendurado preservado');
  });
});

describe('backupOrphans — lstat ignora atalho (FU-35)', () => {
  it('orfao em forma de symlink para fora do /tmp nao entra na lista de remocao', () => {
    const referente = mkOutside({ 'pubspec.yaml': 'name: x\n' });
    const parent = mkTemp({});
    const copy = path.join(parent, 'alvo');
    fs.mkdirSync(copy, { recursive: true });
    const legitimo = path.join(parent, '.harness-backup-alvo-2026-10-09T00-00-00');
    fs.mkdirSync(legitimo, { recursive: true });
    const falso = path.join(parent, '.harness-backup-alvo-2026-10-09T00-00-01');
    fs.symlinkSync(referente, falso);

    const orfaos = backupOrphans(copy, 0);

    assert.deepEqual(orfaos, [legitimo], 'so o diretorio real entra na lista');
    const state = cleanupDogfood(copy, null);
    assert.equal(state.copyRemoved, true);
    assert.ok(fs.existsSync(path.join(referente, 'pubspec.yaml')), 'referente intacto');
    assert.ok(fs.lstatSync(falso).isSymbolicLink(), 'atalho nem foi tocado');
  });
});

describe('2a linha de defesa — re-validacao da disjointness no finally', () => {
  it('cleanupDogfood(sourceReal cobrindo a copia) => bloqueia e nao remove', () => {
    const origemReal = mkTemp({ 'projeto/lib.js': 'x\n', 'arquivo-do-usuario.txt': 'dado\n' });
    const copia = path.join(origemReal, 'projeto', 'sub');
    fs.mkdirSync(copia, { recursive: true });
    fs.writeFileSync(path.join(copia, 'x.txt'), 'x\n');

    const state = cleanupDogfood(copia, null, { sourceReal: origemReal });

    assert.deepEqual(state.removed, []);
    assert.deepEqual(state.blocked, [path.resolve(copia)]);
    assert.equal(state.copyRemoved, false);
    assert.ok(fs.existsSync(path.join(origemReal, 'arquivo-do-usuario.txt')), 'irmao do usuario intacto');
    assert.ok(fs.existsSync(path.join(copia, 'x.txt')), 'nada apagado');
  });

  it('sourceReal por symlink (realpath) protege a origem real', () => {
    const real = mkTemp({ 'projeto/lib.js': 'x\n' });
    const link = path.join(real, 'atalho-para-a-origem');
    fs.symlinkSync(real, link);
    const copia = path.join(real, 'projeto');

    const state = cleanupDogfood(copia, null, { sourceReal: link });

    assert.deepEqual(state.removed, [], 'realpath do sourceReal alcança a copia => bloqueio');
    assert.ok(fs.existsSync(path.join(copia, 'lib.js')));
  });

  it('copia legitima sob /tmp com origem alhures => remove (sem falso bloqueio)', () => {
    const parent = mkTemp({});
    const copy = path.join(parent, 'harness-dogfood-2026');
    fs.mkdirSync(copy, { recursive: true });
    fs.writeFileSync(path.join(copy, 'x.txt'), 'x\n');
    const origem = mkOutside({ 'README.md': '# origem\n' });

    const state = cleanupDogfood(copy, null, { sourceReal: origem });

    assert.equal(state.copyRemoved, true);
    assert.deepEqual(state.blocked, []);
  });
});

describe('higiene — nenhum orfao proprio em /tmp', () => {
  it('spec nao deixa lixo', () => {
    assert.deepEqual(sweepOwn(), [], 'zero orfaos deste run');
  });
});
