// test-temp.spec.mjs — TDD do utilitário comum de temp (FU-43).
//
// Contrato que este spec fixa (e a implementação em scripts/test-temp.mjs
// cumpre): nenhuma suite do repo deixa órfão em os.tmpdir()/os.homedir().
//
//   1. tmp() cria + REGISTRA o dir sob os.tmpdir() com prefixo da label;
//   2. cleanup() remove EXATAMENTE o registrado — nunca nome solto;
//   3. caminho de FALHA também limpa (afterEach roda mesmo com assert/throw);
//   4. patterns é opt-in EXPLICITO — sem pattern, sweep não remove nada;
//   5. sweep só remove órfão DESTE run (guarda de mtime) e só nos roots dados;
//   6. nome que não casa o pattern fica intocado (nunca apaga órfão alheio);
//   7. symlink em nome casante é desfeito sem atravessar para o alvo.
//
// Este arquivo é o próprio cão de guarda: se ele deixar órfão, a medição
// da suite pega (prefixo harness-tmputil-).
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tempScope, sweepOrphans } from '../../scripts/test-temp.mjs';

// Prefixo curto e único: o sufixo de 6 chars do mkdtemp ([-shape) não casa
// os labels longos usados nos testes de sweep.
const LABEL = 'harness-tmputil';
const SWEEP_LABEL = 'harness-tmputilsweep';

const S = tempScope({ label: LABEL, patterns: [new RegExp(`^${SWEEP_LABEL}-[0-9A-Za-z]{6}$`)] });
afterEach(() => S.cleanup());

describe('FU-43 test-temp: tmp() cria, registra e escreve', () => {
  it('tmp() devolve dir sob os.tmpdir() com o prefixo da label', () => {
    const d = S.tmp();
    assert.ok(d.startsWith(path.join(os.tmpdir(), `${LABEL}-`)), d);
    assert.equal(path.basename(path.dirname(d)), path.basename(os.tmpdir()));
    assert.ok(fs.statSync(d).isDirectory());
  });

  it('tmp(files) escreve a arvore pedida', () => {
    const d = S.tmp({ 'a.txt': 'x', 'nested/b.json': '{"b":1}' });
    assert.equal(fs.readFileSync(path.join(d, 'a.txt'), 'utf8'), 'x');
    assert.equal(fs.readFileSync(path.join(d, 'nested/b.json'), 'utf8'), '{"b":1}');
  });

  it('tmp({}, {root}) cria fora de os.tmpdir() (referente em homedir)', () => {
    const d = S.tmp({ 'y': 'z' }, { root: os.homedir() });
    assert.ok(d.startsWith(path.join(os.homedir(), `${LABEL}-`)), d);
    assert.equal(fs.readFileSync(path.join(d, 'y'), 'utf8'), 'z');
  });

  it('register() aceita path criado fora do helper', () => {
    const p = fs.mkdtempSync(path.join(os.tmpdir(), `${LABEL}-reg-`));
    const ok = fs.existsSync(p);
    S.register(p);
    assert.ok(ok);
    assert.ok(fs.existsSync(p));
    S.cleanup();
    assert.equal(fs.existsSync(p), false);
  });
});

describe('FU-43 test-temp: cleanup() remove exatamente o registrado', () => {
  it('dir rastreado deixa de existir apos cleanup', () => {
    const d = S.tmp({ 'f': '1' });
    assert.ok(fs.existsSync(d));
    const removed = S.cleanup();
    assert.equal(fs.existsSync(d), false);
    assert.ok(removed.includes(d), `cleanup deveria reportar ${d}: ${removed}`);
  });

  it('cleanup idempotente: segunda chamada não erra e não remove alheio', () => {
    S.tmp();
    S.cleanup();
    const again = S.cleanup();
    assert.deepEqual(again, []);
  });

  it('caminho de FALHA limpa: dir criado antes do assert que estourou', () => {
    let d = null;
    assert.throws(() => {
      d = S.tmp({ 'x': '1' });
      throw new Error('falha injetada no meio do teste');
    }, /falha injetada/);
    assert.ok(fs.existsSync(d), 'dir existe apos a falha');
    // o afterEach roda após a falha; aqui simulo a chamada dele.
    S.cleanup();
    assert.equal(fs.existsSync(d), false);
  });
});

describe('FU-43 test-temp: sweep só mexe no pattern EXPLICITO e deste run', () => {
  it('sem patterns, sweep não remove nada', () => {
    const V = tempScope({ label: SWEEP_LABEL });
    const orphan = V.tmp(); // registrado, mas não batido pelo sweep
    const swept = V.sweep();
    assert.deepEqual(swept, []);
    assert.ok(fs.existsSync(orphan), 'sweep sem pattern não pode remover');
    V.cleanup();
    assert.equal(fs.existsSync(orphan), false);
  });

  it('orfão deste run no pattern é removido pelo sweep', () => {
    const V = tempScope({ label: SWEEP_LABEL, patterns: [new RegExp(`^${SWEEP_LABEL}-[0-9A-Za-z]{6}$`)] });
    const orphan = fs.mkdtempSync(path.join(os.tmpdir(), `${SWEEP_LABEL}-`)); // NÃO registrado
    const swept = V.sweep();
    assert.ok(swept.includes(orphan), `sweep deveria remover ${orphan}: ${swept}`);
    assert.equal(fs.existsSync(orphan), false);
    V.cleanup();
  });

  it('nome que NÃO casa o pattern fica intocado (órfão alheio)', () => {
    const V = tempScope({ label: SWEEP_LABEL, patterns: [new RegExp(`^${SWEEP_LABEL}-[0-9A-Za-z]{6}$`)] });
    const foreign = path.join(os.tmpdir(), `${SWEEP_LABEL}-backup-src-alheio`);
    fs.mkdirSync(foreign, { recursive: true });
    try {
      const swept = V.sweep();
      assert.ok(!swept.includes(foreign));
      assert.ok(fs.existsSync(foreign), 'sweep não pode remover nome fora do pattern');
    } finally {
      fs.rmSync(foreign, { recursive: true, force: true });
      V.cleanup();
    }
  });

  it('pattern com guarda de sufixo não casa o nome da spec vizinha (-mobile-)', () => {
    // REGRESSÃO observada em 2026-10-09 (FU-43): a primeira versão deste
    // teste criava scope com prefixo REAL (`harness-dogfood`) varrendo o
    // /tmp — apagou a cópia viva do teste `--keep` de dogfood.spec.mjs, que
    // roda em OUTRO processo, em paralelo (dogfood.spec falhou com ENOENT em
    // .harness-install.json). Prova de formato de regex, portanto, usa raiz
    // PRIVADA e nome fictício: nunca prefixo de spec real.
    const root = S.tmp();
    const generico = path.join(root, 'harness-loose-2026-10-09T00-00-00-000Z');
    const vizinha = path.join(root, 'harness-loose-mobile-2026-10-09T00-00-00-000Z');
    fs.mkdirSync(generico, { recursive: true });
    fs.mkdirSync(vizinha, { recursive: true });

    const V = tempScope({ label: 'harness-loose', patterns: [/^harness-loose-\d{4}-/], roots: [root] });
    const swept = V.sweep();

    assert.ok(swept.includes(generico), `pattern deveria varrer o nome genérico: ${swept}`);
    assert.ok(!swept.includes(vizinha), 'não pode varrer o nome da spec vizinha (-mobile-)');
    assert.equal(fs.existsSync(generico), false);
    assert.ok(fs.existsSync(vizinha));
    V.cleanup();
  });

  it('órfão PRÉ-existente (mtime anterior ao run) não é removido', () => {
    const V = tempScope({ label: SWEEP_LABEL, patterns: [new RegExp(`^${SWEEP_LABEL}-[0-9A-Za-z]{6}$`)] });
    const old = fs.mkdtempSync(path.join(os.tmpdir(), `${SWEEP_LABEL}-`));
    const past = new Date(V.started - 60000);
    fs.utimesSync(old, past, past);
    try {
      const swept = V.sweep();
      assert.ok(!swept.includes(old), 'guarda de mtime falhou: removeu lixo de run anterior');
    } finally {
      fs.rmSync(old, { recursive: true, force: true });
      V.cleanup();
    }
  });

  it('sweep respeita roots: orphan em root não listado fica', () => {
    const V = tempScope({
      label: SWEEP_LABEL,
      patterns: [new RegExp(`^${SWEEP_LABEL}home-[0-9A-Za-z]{6}$`)],
      roots: [os.tmpdir()],
    });
    const inHome = fs.mkdtempSync(path.join(os.homedir(), `${SWEEP_LABEL}home-`));
    try {
      const swept = V.sweep();
      assert.ok(!swept.includes(inHome), 'root fora da lista não pode ser varrido');
      assert.ok(fs.existsSync(inHome));
    } finally {
      fs.rmSync(inHome, { recursive: true, force: true });
      V.cleanup();
    }
  });

  it('symlink em nome casante é desfeito sem atravessar para o alvo', () => {
    const V = tempScope({ label: SWEEP_LABEL, patterns: [new RegExp(`^${SWEEP_LABEL}-[0-9A-Za-z]{6}$`)] });
    const referent = S.tmp({ 'precioso.txt': 'nao pode sumir' }); // rastreado, sobrevive
    const link = fs.mkdtempSync(path.join(os.tmpdir(), `${SWEEP_LABEL}-`));
    fs.rmSync(link, { recursive: true, force: true });
    fs.symlinkSync(referent, link);
    try {
      const swept = V.sweep();
      assert.ok(swept.includes(link), `symlink deveria ser removida: ${swept}`);
      assert.equal(fs.existsSync(link), false, 'atalho removido');
      assert.ok(fs.existsSync(referent), 'alvo do atalho intacto');
      assert.equal(fs.readFileSync(path.join(referent, 'precioso.txt'), 'utf8'), 'nao pode sumir');
    } finally {
      V.cleanup();
    }
  });

  it('sweepOrphans é puro quanto a direção: retorna só o que removeu', () => {
    const V = tempScope({ label: SWEEP_LABEL, patterns: [new RegExp(`^${SWEEP_LABEL}-[0-9A-Za-z]{6}$`)] });
    const keep = S.tmp();
    const caught = sweepOrphans([new RegExp(`^${SWEEP_LABEL}-[0-9A-Za-z]{6}$`)], { since: V.started });
    assert.ok(Array.isArray(caught));
    assert.ok(!caught.includes(keep), `dir de outra label varido: ${caught}`);
    V.cleanup();
  });
});
