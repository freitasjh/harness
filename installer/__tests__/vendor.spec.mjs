// vendor.spec.mjs — IM-BE-05/IM-BE-06/IM-VAL-02/IM-VAL-04.
// TDD: vendor copia byte-identico; --check recomputa treeHash e falha em
// divergencia OU symlink; P-02=(i): skill sem licenca identificavel e excluida.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import {
  VendorError,
  sha256,
  folderComputedHash,
  detectSpdx,
  treeHash,
  listTree,
  buildVendor,
  writeVendor,
  checkVendor,
  SOURCE_LICENSES,
  main,
} from '../../scripts/vendor-skills.mjs';

let dirs = [];
function tmp(prefix = 'harness-vendor-') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  dirs.push(d);
  return d;
}
function write(root, rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}
afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});

const MIT_TEXT = `MIT License

Copyright (c) 2026 Fake Author

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction.
`;

function fakeSource() {
  const src = tmp('harness-vendor-src-');
  write(src, 'fake-licensed/SKILL.md', '---\nname: fake-licensed\n---\n# Licensed\n');
  write(src, 'fake-licensed/LICENSE', MIT_TEXT);
  write(src, 'fake-unlicensed/SKILL.md', '---\nname: fake-unlicensed\n---\n# No license here\n');
  return src;
}

function fakeLock(src, names) {
  const skills = {};
  for (const name of names) {
    skills[name] = {
      source: 'acme/skills',
      sourceType: 'github',
      skillPath: `skills/${name}/SKILL.md`,
      computedHash: folderComputedHash(path.join(src, name)),
    };
  }
  return { version: 1, skills };
}

describe('IM-BE-05 treeHash (multi-arquivo, path\\0sha256)', () => {
  it('deterministico e sensivel a bytes e a path', () => {
    const d = tmp();
    write(d, 'SKILL.md', 'abc');
    write(d, 'refs/a.md', 'def');
    const h1 = treeHash(d);
    const h2 = treeHash(d);
    assert.equal(h1, h2, 'mesmo conteudo => mesmo hash');
    write(d, 'refs/a.md', 'DEF');
    assert.notEqual(treeHash(d), h1, 'mudanca de bytes => hash muda');
    // independente: sha256(join(sorted(`${rel}\0${sha256(bytes)}`), "\n"))
    const lines = [
      `SKILL.md\0${sha256('abc')}`,
      `refs/a.md\0${sha256('DEF')}`,
    ].sort();
    assert.equal(treeHash(d), sha256(lines.join('\n')));
  });

  it('rejeita symlink (fail-closed, S4)', () => {
    const d = tmp();
    write(d, 'SKILL.md', 'x');
    fs.symlinkSync('/etc/hostname', path.join(d, 'evil'));
    assert.throws(() => treeHash(d), (e) => e instanceof VendorError && e.code === 'SYMLINK');
    const t = listTree(d);
    assert.deepEqual(t.symlinks, ['evil']);
  });
});

describe('IM-BE-05 folderComputedHash (compat vercel skills-lock)', () => {
  it('= sha256 de (relPath + content) ordenado por path', () => {
    const d = tmp();
    write(d, 'SKILL.md', 'abc');
    const manual = createHash('sha256').update('SKILL.md').update(Buffer.from('abc')).digest('hex');
    assert.equal(folderComputedHash(d), manual);
  });
});

describe('IM-BE-06 política P-02=(i) — licença', () => {
  it('detectSpdx reconhece MIT/BSD-3/Apache-2.0', () => {
    assert.equal(detectSpdx(MIT_TEXT), 'MIT');
    assert.equal(detectSpdx('Redistribution and use in source and binary forms\nNeither the name of'), 'BSD-3-Clause');
    assert.equal(detectSpdx('Apache License, Version 2.0'), 'Apache-2.0');
    assert.equal(detectSpdx('no license here at all'), null);
  });

  it('SOURCE_LICENSES declara as fontes mobile', () => {
    assert.equal(SOURCE_LICENSES['dart-lang/skills'].spdx, 'BSD-3-Clause');
    assert.equal(SOURCE_LICENSES['flutter/skills'].spdx, 'BSD-3-Clause');
  });
});

describe('IM-VAL-02 buildVendor + writeVendor', () => {
  it('vendoriza licenciada byte-idêntico; exclui sem licença com motivo', () => {
    const src = fakeSource();
    const lock = fakeLock(src, ['fake-licensed', 'fake-unlicensed']);
    const dest = tmp('harness-vendor-dest-');
    const built = buildVendor({ sourceDir: src, sourceLock: lock, sourceLicenses: {}, sourceCommits: { 'acme/skills': 'deadbeef' }, destDir: dest });
    const names = built.vendored.map((v) => v.name);
    assert.deepEqual(names, ['fake-licensed']);
    assert.deepEqual(built.excluded, [{ name: 'fake-unlicensed', reason: 'no-license' }]);
    assert.ok('fake-licensed' in built.lock.skills);
    assert.ok(!('fake-unlicensed' in built.lock.skills));
    const e = built.lock.skills['fake-licensed'];
    assert.equal(e.source, 'acme/skills');
    assert.equal(e.sourceType, 'github');
    assert.equal(e.sourceCommit, 'deadbeef');
    assert.equal(e.skillPath, 'skills/fake-licensed/SKILL.md');
    assert.equal(e.computedHash, lock.skills['fake-licensed'].computedHash);
    assert.equal(e.treeHash, treeHash(path.join(src, 'fake-licensed')));
    assert.deepEqual(e.stacks, []);
    assert.equal(e.license, 'MIT');
    assert.equal(e.licenseFile, 'LICENSE');

    writeVendor(built, { destDir: dest });
    assert.equal(
      fs.readFileSync(path.join(dest, 'fake-licensed', 'SKILL.md'), 'utf8'),
      fs.readFileSync(path.join(src, 'fake-licensed', 'SKILL.md'), 'utf8'),
      'bytes identicos a fonte',
    );
    assert.ok(fs.existsSync(path.join(dest, '.vendor-lock.json')));
    assert.ok(fs.existsSync(path.join(dest, 'VENDOR-NOTICE.md')));
    const notice = fs.readFileSync(path.join(dest, 'VENDOR-NOTICE.md'), 'utf8');
    assert.match(notice, /fake-unlicensed/);
    assert.match(notice, /no-license/);
    assert.match(notice, /P-02/);
  });

  it('infere stacks dart/flutter pelo prefixo', () => {
    const src = tmp('harness-vendor-src-');
    write(src, 'dart-x/SKILL.md', 'x');
    write(src, 'dart-x/LICENSE', MIT_TEXT);
    write(src, 'flutter-y/SKILL.md', 'y');
    write(src, 'flutter-y/LICENSE', MIT_TEXT);
    const lock = fakeLock(src, ['dart-x', 'flutter-y']);
    const dest = tmp('harness-vendor-dest-');
    const built = buildVendor({ sourceDir: src, sourceLock: lock, sourceLicenses: {}, sourceCommits: {}, destDir: dest });
    assert.deepEqual(built.lock.skills['dart-x'].stacks, ['dart']);
    assert.deepEqual(built.lock.skills['flutter-y'].stacks, ['flutter']);
  });

  it('fonte ausente => excluída source-missing (não vendoriza às cegas)', () => {
    const src = tmp('harness-vendor-src-');
    const lock = { version: 1, skills: { ghost: { source: 'acme/skills', sourceType: 'github', skillPath: 'skills/ghost/SKILL.md', computedHash: 'deadbeef' } } };
    const dest = tmp('harness-vendor-dest-');
    const built = buildVendor({ sourceDir: src, sourceLock: lock, sourceLicenses: {}, sourceCommits: {}, destDir: dest });
    assert.deepEqual(built.excluded, [{ name: 'ghost', reason: 'source-missing' }]);
  });
});

describe('IM-VAL-04 checkVendor (drift + symlink fail-closed)', () => {
  function vendored() {
    const src = fakeSource();
    const lock = fakeLock(src, ['fake-licensed']);
    const dest = tmp('harness-vendor-dest-');
    const built = buildVendor({ sourceDir: src, sourceLock: lock, sourceLicenses: {}, sourceCommits: { 'acme/skills': 'deadbeef' }, destDir: dest });
    writeVendor(built, { destDir: dest });
    return { dest, src };
  }

  it('verde no estado recém-vendoriado', () => {
    const { dest } = vendored();
    const res = checkVendor({ destDir: dest });
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.deepEqual(res.divergences, []);
    assert.deepEqual(res.symlinks, []);
    assert.deepEqual(res.missing, []);
  });

  it('hash adulterado => FAIL e lista divergência', () => {
    const { dest } = vendored();
    fs.writeFileSync(path.join(dest, 'fake-licensed', 'SKILL.md'), 'tampered');
    const res = checkVendor({ destDir: dest });
    assert.equal(res.ok, false);
    assert.deepEqual(res.divergences, ['fake-licensed']);
  });

  it('symlink no vendor => FAIL', () => {
    const { dest } = vendored();
    fs.symlinkSync('/etc/hostname', path.join(dest, 'fake-licensed', 'evil'));
    const res = checkVendor({ destDir: dest });
    assert.equal(res.ok, false);
    assert.deepEqual(res.symlinks, ['fake-licensed']);
  });

  it('dir ausente => missing => FAIL', () => {
    const { dest } = vendored();
    fs.rmSync(path.join(dest, 'fake-licensed'), { recursive: true, force: true });
    const res = checkVendor({ destDir: dest });
    assert.equal(res.ok, false);
    assert.deepEqual(res.missing, ['fake-licensed']);
  });
});

describe('IM-BE-05 CLI', () => {
  it('--check exit 0 verde / exit 1 adulterado', () => {
    const src = fakeSource();
    const lock = fakeLock(src, ['fake-licensed']);
    const dest = tmp('harness-vendor-dest-');
    const built = buildVendor({ sourceDir: src, sourceLock: lock, sourceLicenses: {}, sourceCommits: {}, destDir: dest });
    writeVendor(built, { destDir: dest });
    assert.equal(main(['--check', '--dest', dest]), 0);
    fs.writeFileSync(path.join(dest, 'fake-licensed', 'SKILL.md'), 'x');
    assert.equal(main(['--check', '--dest', dest]), 1);
  });

  it('--check sem lock => exit 1 (fail-closed)', () => {
    const dest = tmp('harness-vendor-dest-');
    assert.equal(main(['--check', '--dest', dest]), 1);
  });
});
