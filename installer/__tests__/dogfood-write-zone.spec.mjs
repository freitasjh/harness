// dogfood-write-zone.spec.mjs — FU-42 (zona de ESCRITA do dogfood por realpath).
//
// Defeito fechado aqui (tech-debt `.spec/tech-debts/dogfood-write-zone-symlink`):
// `assertDogfoodTarget` (`installer/install.mjs`) media a zona autorizada pelo
// path ESCRITO (`path.resolve` + prefixo de `os.tmpdir()`). Um alvo
// `/tmp/<atalho>/sub`, com `<atalho>` apontando para FORA do /tmp, passava a
// trava e o instalador ESCREVIA fora da zona — a limpeza bloqueava
// (`classifyRemoval`), mas a escrita já tinha acontecido.
//
// Correção: a trava passou a medir o alvo por REALPATH dentro do realpath de
// `os.tmpdir()` (com fallback para o caminho escrito quando o alvo ainda não
// existe), mantendo o cheque léxico como 1ª camada e o escape
// `explicit + confirmed` para fora do /tmp.
//
// Política (provavel por teste): o que o SO escreve é decidido pelo path REAL;
// dúvida (atalho pendurado, zona desconhecida) => ABORTA antes de qualquer
// escrita, com o caminho resolvido na mensagem.
//
// Prefixo próprio deste run: `harness-fu42-`.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { assertDogfoodTarget } from '../install.mjs';
import { isInsideTmp, realOrResolved, tmpRealRoot } from '../zone.mjs';
import { runDogfood } from '../dogfood.mjs';

const RUN_T0 = Date.now();

let tmpDirs = [];
let homeDirs = [];

// Zona autorizada: só o que este run criou entra na lista.
function mkZone(name) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `harness-fu42-${name}-`));
  tmpDirs.push(d);
  return d;
}

// Referente FORA de os.tmpdir() — unico jeito de provar que a escrita nao
// atravessa o atalho. Criado e destruido por esta spec, sempre.
function mkReferent(name, files = {}) {
  const d = fs.mkdtempSync(path.join(os.homedir(), `harness-fu42-ref-${name}-`));
  homeDirs.push(d);
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
    if (!/^harness-fu42-/.test(e.name)) continue;
    const p = path.join(os.tmpdir(), e.name);
    let st;
    try { st = fs.lstatSync(p); } catch { continue; }
    if (st.mtimeMs < RUN_T0 - 1000) continue;
    try { fs.rmSync(p, { recursive: true, force: true }); removed.push(e.name); } catch { /* melhor esforço */ }
  }
  return removed;
}

afterEach(() => {
  for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* já removido */ } }
  tmpDirs = [];
  for (const d of homeDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* já removido */ } }
  homeDirs = [];
  sweepOwn();
});

describe('FU-42 trava de escrita: alvo via pai-symlink para fora do /tmp', () => {
  it('atalho no caminho => ABORTA (OUTSIDE_TARGET) com o caminho REAL na mensagem', () => {
    const referente = mkReferent('fora', { 'dado-do-usuario.txt': 'nao pode nascer nada aqui\n' });
    const antes = fs.readdirSync(referente).sort();
    const zona = mkZone('pai');
    const atalho = path.join(zona, 'atalho-para-fora');
    fs.symlinkSync(referente, atalho);
    const alvo = path.join(atalho, 'harness-fu42-sub');

    let err = null;
    try { assertDogfoodTarget(alvo); } catch (e) { err = e; }
    assert.ok(err, 'trava abortou');
    assert.equal(err.code, 'OUTSIDE_TARGET', `code: ${err.code}`);
    assert.match(err.message, /fora da zona autorizada/);
    // Mensagem acionável: o path escrito E onde ele realmente cai.
    assert.ok(err.message.includes(alvo), `msg sem o alvo escrito: ${err.message}`);
    assert.ok(err.message.includes(fs.realpathSync(referente)), `msg sem o real: ${err.message}`);

    // E nada foi escrito: o referente continua com o que já tinha.
    assert.deepEqual(fs.readdirSync(referente).sort(), antes, 'referente intacto');
    assert.equal(fs.existsSync(path.join(referente, 'harness-fu42-sub')), false, 'nenhum sub diretorio criado');
  });

  it('atalho pendurado no caminho => ABORTA antes de escrever (fail-closed)', () => {
    const zona = mkZone('pendurado');
    const atalho = path.join(zona, 'atalho-quebrado');
    fs.symlinkSync(path.join(zona, 'destino-inexistente'), atalho);
    const alvo = path.join(atalho, 'sub');

    assert.throws(
      () => assertDogfoodTarget(alvo),
      (e) => e.code === 'OUTSIDE_TARGET' && /atalho pendurado/.test(e.message) && e.message.includes(atalho),
    );
  });

  it('atalho que continua DENTRO do /tmp passa (sem falso positivo)', () => {
    const real = mkZone('real');
    const zona = mkZone('ponte');
    const atalho = path.join(zona, 'atalho-interno');
    fs.symlinkSync(real, atalho);
    const alvo = path.join(atalho, 'harness-fu42-sub');

    assert.equal(assertDogfoodTarget(alvo), path.resolve(alvo), 'alvo interno autorizado');
  });
});

describe('FU-42 retrocompat: caminho normal e escape explicit+confirmed', () => {
  it('caminho normal em /tmp passa, mesmo ainda inexistente', () => {
    const zona = mkZone('normal');
    const alvo = path.join(zona, 'harness-fu42-ainda-nao-existe');
    assert.equal(fs.existsSync(alvo), false);
    assert.equal(assertDogfoodTarget(alvo), path.resolve(alvo));
  });

  it('o proprio /tmp passa', () => {
    assert.equal(assertDogfoodTarget(os.tmpdir()), path.resolve(os.tmpdir()));
  });

  it('fora do /tmp sem flags aborta (DOGFOOD_GUARD); escape exige explicit+confirmed', () => {
    assert.throws(() => assertDogfoodTarget('/etc/harness-fu42-x'), /\/tmp|confirm/i);
    assert.throws(() => assertDogfoodTarget('/etc/harness-fu42-x', { explicit: true }), /confirm/i);
    assert.equal(
      assertDogfoodTarget('/etc/harness-fu42-x', { explicit: true, confirmed: true }),
      path.resolve('/etc/harness-fu42-x'),
      'escape preservado',
    );
  });
});

describe('zone.mjs — primitivas da zona por realpath', () => {
  it('realOrResolved segue o atalho e anexa a cauda inexistente ao ancestral real', () => {
    const referente = mkReferent('interno', { 'x.txt': 'x\n' });
    const zona = mkZone('ancestral');
    const atalho = path.join(zona, 'atalho');
    fs.symlinkSync(referente, atalho);

    assert.equal(
      realOrResolved(path.join(atalho, 'sub', 'inexistente')),
      path.join(fs.realpathSync(referente), 'sub', 'inexistente'),
      'atalho resolvido + cauda preservada',
    );

    const cauda = path.join(zona, 'nao', 'existe', 'ainda');
    assert.equal(
      realOrResolved(cauda),
      path.join(fs.realpathSync(zona), 'nao', 'existe', 'ainda'),
      'cauda sob ancestral real (macOS: /var -> /private/var)',
    );
    assert.equal(realOrResolved(zona), fs.realpathSync(zona));
  });

  it('isInsideTmp/tmpRealRoot medem pelo real, nao pelo path escrito', () => {
    const referente = mkReferent('zona', { 'x.txt': 'x\n' });
    const zona = mkZone('medida');
    const atalho = path.join(zona, 'atalho-para-fora');
    fs.symlinkSync(referente, atalho);

    assert.equal(isInsideTmp(path.join(zona, 'inexistente')), true);
    assert.equal(isInsideTmp(path.join(atalho, 'sub')), false, 'escapa pelo atalho');
    assert.equal(isInsideTmp(path.join(os.homedir(), 'harness-fu42-fora')), false);
    assert.equal(tmpRealRoot(), fs.realpathSync(os.tmpdir()));
  });
});

describe('FU-42 ponta-a-ponta: runDogfood com --target sob pai-symlink', () => {
  it('ABORTA antes de qualquer escrita e o referente FORA do /tmp fica intacto', async () => {
    const referente = mkReferent('e2e', { 'dado-do-usuario.txt': 'nada do harness aqui\n' });
    const antes = fs.readdirSync(referente).sort();
    const fonte = mkZone('fonte');
    fs.mkdirSync(path.join(fonte, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(fonte, 'README.md'), '# origem dogfood\n');
    fs.writeFileSync(path.join(fonte, 'lib', 'index.js'), 'module.exports = 1;\n');
    const zona = mkZone('alvo');
    const atalho = path.join(zona, 'atalho-para-fora');
    fs.symlinkSync(referente, atalho);
    const alvo = path.join(atalho, 'harness-fu42-sub');

    await assert.rejects(
      () => runDogfood({ source: fonte, target: alvo, keep: false, runSuites: false, evidenceDir: mkZone('evidencia') }),
      (e) => /fora da zona autorizada/.test(e.message) && e.message.includes(fs.realpathSync(referente)),
      'abortou com o caminho real na mensagem',
    );

    // Nada escrito fora da zona: sem sub diretorio, sem manifesto, sem config.
    assert.deepEqual(fs.readdirSync(referente).sort(), antes, 'referente intacto (zero escrita)');
    assert.equal(fs.existsSync(path.join(referente, '.harness-install.json')), false);
    assert.equal(fs.existsSync(path.join(referente, 'opencode.json')), false);
    assert.equal(fs.existsSync(alvo), false, 'nem o diretorio do alvo foi criado');
    assert.deepEqual(fs.readdirSync(zona).sort(), [path.basename(atalho)], 'zona sem lixo do dogfood');
  });
});

describe('higiene — nenhum orfao proprio em /tmp', () => {
  it('spec nao deixa lixo', () => {
    assert.deepEqual(sweepOwn(), [], 'zero orfaos deste run');
  });
});
