// dogfood.spec.mjs — IN-07 + A6: dogfood da stack generica (nao-mobile).
// Cobre os defeitos que este script tinha e que o mobile ja havia fechado:
//   - isolamento da origem SEM digest de conteudo (mutacao invisivel) =
//     coberto pelo sourceState compartilhado em dogfood-mobile.spec.mjs;
//   - limpeza SO no caminho feliz => falha deixava copia/backup orfao em /tmp;
//   - falta da trava destrutiva --target vs origem (C2).
//
// A4 cenario real: `opencode.json` corrompido na origem => `planMerge` aborta
// DEPOIS de `backup()`, sem retornar `result.backup` => o backup ficaria orfao.
// A varredura fallback (dogfood-common.backupOrphans) remove.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { runDogfood, DEFAULT_SOURCE, sourceState } from '../dogfood.mjs';
import { cleanupDogfood, cleanupNote, cleanupErrorOf } from '../dogfood-common.mjs';

const RUN_T0 = Date.now();
// Prefixos que ESTA spec cria sob /tmp — a varredura so mexe neles.
// O sufixo exige DIGITO depois de "harness-dogfood-": o dogfood MOBILE usa
// "harness-dogfood-mobile-..." e roda em paralelo (outro arquivo de spec) —
// prefixo frouxo faria uma spec apagar os temporarios da outra.
const OWN_PATTERNS = [
  /^harness-dogfood-\d{4}-/,
  /^\.harness-backup-harness-dogfood-\d{4}-/,
];
const TEMP_PREFIX = 'harness-dfd-';
const INSTALLER_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let dirs = [];

function mkTemp(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}

// A1: varredura de orfaos deste run (copia --keep, backup orfao, etc.).
function sweepOwnOrphans() {
  const removed = [];
  let entries = [];
  try { entries = fs.readdirSync(os.tmpdir(), { withFileTypes: true }); } catch { return removed; }
  for (const e of entries) {
    if (!OWN_PATTERNS.some((re) => re.test(e.name))) continue;
    const p = path.join(os.tmpdir(), e.name);
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.mtimeMs < RUN_T0 - 1000) continue; // nao eh deste run
    try { fs.rmSync(p, { recursive: true, force: true }); removed.push(e.name); } catch { /* melhor esforco */ }
  }
  return removed;
}

afterEach(() => {
  for (const d of dirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* jah removido */ } }
  dirs = [];
  sweepOwnOrphans();
});

function mkSource(files = {}) {
  return mkTemp({
    'README.md': '# origem dogfood\n',
    'lib/index.js': 'module.exports = 1;\n',
    ...files,
  });
}

describe('runDogfood — stack generica em copia /tmp', () => {
  it('instala de verdade, prova re-install abort e limpa copia + backup', async () => {
    const source = mkSource();
    const evidenceDir = mkTemp({});
    const res = await runDogfood({ source, keep: false, evidenceDir, runSuites: false });

    assert.equal(res.failure, null, `sem falha: ${res.failure}`);
    assert.equal(res.ok, true, 'dogfood ok');
    assert.equal(res.sourceUntouched, true, 'origem somente leitura');
    assert.equal(res.copyRemoved, true, 'copia removida');
    assert.ok(res.backupDir && !fs.existsSync(res.backupDir), 'backup removido (sem orfao)');
    assert.equal(res.cleanupError, null, 'sem erro de limpeza');
    assert.ok(fs.existsSync(res.evidence), 'evidencia gravada');

    const ev = JSON.parse(fs.readFileSync(res.evidence, 'utf8'));
    assert.equal(ev.s3.checksPassed, true, 'checks PASS na copia');
    assert.equal(ev.s4.clean, true, 'zero denylist nos instalados');
    assert.match(String(ev.cleanup.note), /removidos/, 'nota honesta no caminho feliz');
  });

  it('C2: --target == origem => ABORTA sem apagar nada', async () => {
    const source = mkSource({ 'lib/keepme.js': 'nao pode sumir\n' });
    const evidenceDir = mkTemp({});
    await assert.rejects(
      () => runDogfood({ source, keep: false, evidenceDir, runSuites: false, target: source }),
      /nao pode ser a origem nem ancestral\/descendente/,
    );
    assert.ok(fs.existsSync(path.join(source, 'lib/keepme.js')), 'arquivo da origem intacto');
    assert.equal(sourceState(source).kind, 'mtimes', 'origem ainda legivel');
  });

  it('C2: --target ANCESTRAL da origem => ABORTA (irmaos do usuario intactos)', async () => {
    const parent = mkTemp({ 'arquivo-do-usuario.txt': 'dado do usuario\n' });
    const source = path.join(parent, 'projeto');
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, 'lib.js'), 'x\n');
    const evidenceDir = mkTemp({});

    await assert.rejects(
      () => runDogfood({ source, keep: false, evidenceDir, runSuites: false, target: parent }),
      /nao pode ser a origem nem ancestral\/descendente/,
    );
    assert.ok(fs.existsSync(path.join(parent, 'arquivo-do-usuario.txt')), 'irmao do usuario preservado');
    assert.ok(fs.existsSync(path.join(source, 'lib.js')), 'origem preservada');
  });

  it('C2: --target DESCENDENTE da origem => ABORTA', async () => {
    const source = mkSource();
    const evidenceDir = mkTemp({});
    await assert.rejects(
      () => runDogfood({ source, keep: false, evidenceDir, runSuites: false, target: path.join(source, 'alvo') }),
      /nao pode ser a origem nem ancestral\/descendente/,
    );
    assert.ok(fs.existsSync(path.join(source, 'lib/index.js')), 'origem intacta');
  });

  it('A4: falha apos o backup (opencode.json corrompido) => copia/backup orfaos removidos', async () => {
    // `planMerge` aborta em opencode.json corrompido DEPOIS de `backup()`;
    // `main()` lanca antes de retornar => `result.backup` inexistente.
    const source = mkSource({ 'opencode.json': '{isto nao eh json' });
    const evidenceDir = mkTemp({});
    const res = await runDogfood({ source, keep: false, evidenceDir, runSuites: false });

    assert.equal(res.ok, false, 'dogfood falha com origem corrompida');
    assert.match(String(res.failure), /corrupt|opencode\.json/i, 'falha reportada');
    assert.equal(res.copyRemoved, true, 'copia removida mesmo na falha');
    assert.equal(res.cleanupError, null, 'limpeza sem erro');

    // backup orfao: segue o padrao do instalador, irmao da copia.
    const pattern = new RegExp(`^\\.harness-backup-${path.basename(res.copy)}-`);
    const siblings = fs.readdirSync(os.tmpdir()).filter((n) => pattern.test(n));
    assert.deepEqual(siblings, [], `nenhum backup orfao em /tmp: ${siblings.join(', ')}`);
    assert.ok(fs.existsSync(path.join(source, 'opencode.json')), 'origem corrompida intacta (nunca reescrita)');
  });

  it('A3: limpeza que lanca => evidencia ainda gravada + cleanupError preenchido', async () => {
    const source = mkSource();
    // Alvo sem permissao de escrita e com uma entrada: `cp` falha e `rmSync`
    // tambem (EACCES ao remover a entrada) — a evidencia precisa sobreviver.
    const parent = mkTemp({});
    const copy = path.join(parent, 'alvo');
    fs.mkdirSync(path.join(copy, 'trava'), { recursive: true });
    fs.chmodSync(copy, 0o500);
    const evidenceDir = mkTemp({});
    let res;
    try {
      res = await runDogfood({ source, keep: false, evidenceDir, runSuites: false, target: copy });
    } finally {
      fs.chmodSync(copy, 0o700);
    }
    assert.equal(res.ok, false, 'dogfood falha');
    assert.ok(res.failure, 'falha do cp reportada');
    assert.ok(res.cleanupError, `cleanupError preenchido: ${res.cleanupError}`);
    assert.match(String(res.cleanupError), /remocao falhou|remocao bloqueada/i);
    assert.equal(res.copyRemoved, false, 'copyRemoved honesto (nao removeu)');
    assert.ok(fs.existsSync(res.evidence), 'evidencia gravada apesar da falha de remocao');
    const ev = JSON.parse(fs.readFileSync(res.evidence, 'utf8'));
    assert.match(String(ev.cleanup.note), /FALHA ao remover/, 'A2: nota NAO mente sobre a falha');
    assert.ok(ev.cleanup.error, 'A3: erro de limpeza na evidencia');
  });

  it('--keep preserva copia + backup e a nota diz onde esta', async () => {
    const source = mkSource();
    const evidenceDir = mkTemp({});
    const res = await runDogfood({ source, keep: true, evidenceDir, runSuites: false });
    assert.equal(res.ok, true);
    assert.equal(res.copyRemoved, false, '--keep nao remove');
    assert.ok(fs.existsSync(res.copy), 'copia mantida para inspecao');
    assert.ok(fs.existsSync(res.backupDir), 'backup mantido com --keep');
    const ev = JSON.parse(fs.readFileSync(res.evidence, 'utf8'));
    assert.match(String(ev.cleanup.note), /--keep/, 'nota explicita do keep');
  });

  it('A2/A3: cleanupNote/cleanupErrorOf refletem falha e bloqueio sem mentir', () => {
    assert.match(cleanupNote({ copyRemoved: true }, '/tmp/x'), /removidos/);
    assert.match(cleanupNote({ kept: true }, '/tmp/x'), /--keep/);
    assert.match(cleanupNote({ errors: ['/tmp/y: EACCES'] }, '/tmp/x'), /FALHA ao remover/);
    assert.match(cleanupNote({ blocked: ['/home/user/dados'] }, '/tmp/x'), /BLOQUEADA|bloqueada/);
    assert.equal(cleanupErrorOf({ errors: ['a'], blocked: ['b'] }), 'remocao falhou: a; remocao bloqueada: b');
    assert.equal(cleanupErrorOf({ errors: [], blocked: [] }), null);
  });

  it('A1: nenhum orfao deste run sob /tmp ao final', () => {
    const leftovers = sweepOwnOrphans();
    assert.deepEqual(leftovers, [], `spec nao deixou orfao: ${leftovers.join(', ')}`);
  });
});

describe('DEFAULT_SOURCE', () => {
  it('aponta para o repo irmao documentado', () => {
    assert.equal(DEFAULT_SOURCE, path.resolve(INSTALLER_ROOT, '..', 'atlas-ecm'));
  });
});
