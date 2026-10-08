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
  SPDX_ALLOWLIST,
  isAllowedSpdx,
  aggregatedLicenseName,
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

// --- must-fix #2: allowlist SPDX (P-02=(i)) -------------------------------
describe('IM-BE-06 SPDX allowlist (frontmatter fail-closed)', () => {
  it('isAllowedSpdx aceita permissivas e rejeita UNLICENSED/PROPRIETARY/desconhecido', () => {
    for (const ok of ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MPL-2.0']) {
      assert.equal(isAllowedSpdx(ok), true, `${ok} deve ser aceita`);
    }
    for (const bad of ['UNLICENSED', 'PROPRIETARY', 'WTFPL', 'garbage', '', null, undefined]) {
      assert.equal(isAllowedSpdx(bad), false, `${bad} deve ser rejeitada`);
    }
    assert.ok(SPDX_ALLOWLIST.has('MIT'));
    assert.ok(!SPDX_ALLOWLIST.has('UNLICENSED'));
  });

  it('`license: UNLICENSED` no frontmatter => skill EXCLUÍDA (não fail-open)', () => {
    const src = tmp('harness-vendor-src-');
    write(src, 'bad-unlicensed/SKILL.md', '---\nname: bad-unlicensed\nlicense: UNLICENSED\n---\n# x\n');
    write(src, 'bad-proprietary/SKILL.md', '---\nname: bad-proprietary\nlicense: PROPRIETARY\n---\n# y\n');
    write(src, 'good-apache/SKILL.md', '---\nname: good-apache\nlicense: Apache-2.0\n---\n# z\n');
    const lock = fakeLock(src, ['bad-unlicensed', 'bad-proprietary', 'good-apache']);
    const built = buildVendor({ sourceDir: src, sourceLock: lock, sourceLicenses: {}, sourceCommits: {}, destDir: tmp('harness-vendor-dest-') });
    assert.deepEqual(built.vendored.map((v) => v.name), ['good-apache']);
    assert.ok(!('bad-unlicensed' in built.lock.skills));
    assert.ok(!('bad-proprietary' in built.lock.skills));
    const byName = Object.fromEntries(built.excluded.map((x) => [x.name, x]));
    assert.equal(byName['bad-unlicensed'].reason, 'license-not-allowed');
    assert.equal(byName['bad-proprietary'].reason, 'license-not-allowed');
    assert.equal(built.lock.skills['good-apache'].license, 'Apache-2.0');
  });
});

// --- must-fix #1: licença agregada com texto + copyright ------------------
const BSD3_TEXT = `Copyright 2012, the Dart project authors.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice.
2. Redistributions in binary form must reproduce the above copyright notice.
3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS".
`;

describe('IM-BE-06 licença agregada escrita pelo vendor (licenseFile não mente)', () => {
  function sourceFallback() {
    const src = tmp('harness-vendor-src-');
    write(src, 'dart-a/SKILL.md', '---\nname: dart-a\n---\n# a\n');
    write(src, 'dart-b/SKILL.md', '---\nname: dart-b\n---\n# b\n');
    const lock = fakeLock(src, ['dart-a', 'dart-b']);
    for (const n of ['dart-a', 'dart-b']) lock.skills[n].source = 'acme/skills';
    return { src, lock };
  }
  const LICENSES = { 'acme/skills': { spdx: 'BSD-3-Clause', licenseText: BSD3_TEXT } };

  it('grava LICENSE-<slug> na raiz com texto+copyright e licenseFile aponta pra ele', () => {
    const { src, lock } = sourceFallback();
    const dest = tmp('harness-vendor-dest-');
    const built = buildVendor({ sourceDir: src, sourceLock: lock, sourceLicenses: LICENSES, sourceCommits: {}, destDir: dest });
    const file = aggregatedLicenseName('acme/skills');
    assert.equal(file, 'LICENSE-acme-skills');
    const e = built.lock.skills['dart-a'];
    assert.equal(e.license, 'BSD-3-Clause');
    assert.equal(e.licenseFile, file);
    assert.ok(!e.licenseFile.startsWith('LICENSE/acme') && e.licenseFile !== 'LICENSE');

    writeVendor(built, { destDir: dest });
    const licPath = path.join(dest, file);
    assert.ok(fs.existsSync(licPath), 'arquivo agregado existe');
    const text = fs.readFileSync(licPath, 'utf8');
    assert.match(text, /Copyright 2012, the Dart project authors\./);
    assert.match(text, /Redistribution and use in source and binary forms/);
    assert.match(text, /THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS/);
    // nunca dentro do dir da skill (I9/treeHash preservado)
    assert.ok(!fs.existsSync(path.join(dest, 'dart-a', file)));
    const notice = fs.readFileSync(path.join(dest, 'VENDOR-NOTICE.md'), 'utf8');
    assert.match(notice, /LICENSE-acme-skills/);
    assert.match(notice, /Copyright 2012, the Dart project authors\./);
    assert.match(notice, /## Licencas \(texto completo \+ copyright\)/);
  });

  it('SOURCE_LICENSES traz licenseText completo (não só SPDX)', () => {
    assert.match(SOURCE_LICENSES['dart-lang/skills'].licenseText, /Copyright 2012, the Dart project authors\./);
    assert.match(SOURCE_LICENSES['flutter/skills'].licenseText, /Copyright 2026 The Flutter Authors\./);
    assert.equal(SOURCE_LICENSES['dart-lang/skills'].licenseFile, undefined, 'licenseFile falso removido');
  });
});

// --- must-fix #3: symlink na RAIZ da skill --------------------------------
describe('IM-VAL-04 symlink na raiz do skill (fail-closed)', () => {
  it('buildVendor exclui dir de skill simlinkado (motivo symlink)', () => {
    const src = tmp('harness-vendor-src-');
    const real = tmp('harness-vendor-real-');
    write(real, 'SKILL.md', '# real\n');
    fs.symlinkSync(real, path.join(src, 'linked-skill'), 'dir');
    const lock = { version: 1, skills: { 'linked-skill': { source: 'acme/skills', sourceType: 'github', skillPath: 'skills/linked-skill/SKILL.md' } } };
    const dest = tmp('harness-vendor-dest-');
    const built = buildVendor({ sourceDir: src, sourceLock: lock, sourceLicenses: {}, sourceCommits: {}, destDir: dest });
    assert.deepEqual(built.vendored, []);
    assert.deepEqual(built.excluded, [{ name: 'linked-skill', reason: 'symlink' }]);
  });

  it('checkVendor: skill root simlinkado => FAIL (symlinks)', () => {
    const src = fakeSource();
    const lock = fakeLock(src, ['fake-licensed']);
    const dest = tmp('harness-vendor-dest-');
    const built = buildVendor({ sourceDir: src, sourceLock: lock, sourceLicenses: {}, sourceCommits: {}, destDir: dest });
    writeVendor(built, { destDir: dest });
    assert.equal(checkVendor({ destDir: dest }).ok, true);
    const realDir = tmp('harness-vendor-real-');
    write(realDir, 'SKILL.md', 'x');
    const skillPath = path.join(dest, 'fake-licensed');
    fs.rmSync(skillPath, { recursive: true, force: true });
    fs.symlinkSync(realDir, skillPath, 'dir');
    const res = checkVendor({ destDir: dest });
    assert.equal(res.ok, false);
    assert.deepEqual(res.symlinks, ['fake-licensed']);
  });

  it('listTree classifica a raiz simlinkada como symlink "."', () => {
    const real = tmp('harness-vendor-real-');
    write(real, 'SKILL.md', 'x');
    const link = path.join(tmp('harness-vendor-linkparent-'), 'link');
    fs.symlinkSync(real, link, 'dir');
    assert.deepEqual(listTree(link).symlinks, ['.']);
    assert.throws(() => treeHash(link), (e) => e instanceof VendorError && e.code === 'SYMLINK');
  });
});

// --- re-review: `--check` valida o LICENSE-<slug> agregado; bytes == upstream -
describe('licença agregada: byte-identidade upstream + verificação por --check', () => {
  // sha256 congelados do LICENSE upstream nos commits pinados no lock
  // (dart-lang/skills @ 0d9f1c4a, flutter/skills @ 0ef3972f). Sem newline final.
  const UPSTREAM_DART_SHA = '835b0ffef5681b070c8d9c6c7d67cdd018441a7ae65b1ebd772dbdd2bd40f097';
  const UPSTREAM_FLUTTER_SHA = '5b95696b504e162bcf775060ec416005df9969a95cda6f7d4ddb57327dd74d35';

  function mobileSource() {
    const src = tmp('harness-vendor-src-');
    for (const n of ['dart-a', 'dart-b']) write(src, `${n}/SKILL.md`, `---\nname: ${n}\n---\n# ${n}\n`);
    const lock = fakeLock(src, ['dart-a', 'dart-b']);
    for (const n of ['dart-a', 'dart-b']) lock.skills[n].source = 'dart-lang/skills';
    return { src, lock };
  }
  function vendoredMobile() {
    const { src, lock } = mobileSource();
    const dest = tmp('harness-vendor-dest-');
    const built = buildVendor({ sourceDir: src, sourceLock: lock, sourceCommits: { 'dart-lang/skills': '0d9f1c4a0ae29d6f5180bf6143d7997ec3bacf49' }, destDir: dest });
    writeVendor(built, { destDir: dest });
    return { dest, built };
  }

  it('SOURCE_LICENSES bate byte-a-byte com o LICENSE upstream (sha congelado)', () => {
    assert.equal(sha256(SOURCE_LICENSES['dart-lang/skills'].licenseText), UPSTREAM_DART_SHA);
    assert.equal(sha256(SOURCE_LICENSES['flutter/skills'].licenseText), UPSTREAM_FLUTTER_SHA);
    assert.equal(SOURCE_LICENSES['dart-lang/skills'].sha256, UPSTREAM_DART_SHA);
    assert.equal(SOURCE_LICENSES['flutter/skills'].sha256, UPSTREAM_FLUTTER_SHA);
    for (const k of ['dart-lang/skills', 'flutter/skills']) {
      assert.ok(!SOURCE_LICENSES[k].licenseText.endsWith('\n'), `${k}: sem newline final (upstream)`);
    }
  });

  it('buildVendor registra lock.licenses; writeVendor grava o arquivo byte-identico', () => {
    const { dest, built } = vendoredMobile();
    assert.deepEqual(built.lock.licenses, [{
      source: 'dart-lang/skills',
      spdx: 'BSD-3-Clause',
      file: 'LICENSE-dart-lang-skills',
      sha256: UPSTREAM_DART_SHA,
    }]);
    const onDisk = fs.readFileSync(path.join(dest, 'LICENSE-dart-lang-skills'), 'utf8');
    assert.equal(onDisk, SOURCE_LICENSES['dart-lang/skills'].licenseText, 'bytes == upstream');
    assert.equal(sha256(onDisk), UPSTREAM_DART_SHA);
    assert.equal(checkVendor({ destDir: dest }).ok, true);
  });

  it('LICENSE-<slug> adulterado => FAIL (licenseDivergences)', () => {
    const { dest } = vendoredMobile();
    fs.writeFileSync(path.join(dest, 'LICENSE-dart-lang-skills'), 'tampered');
    const res = checkVendor({ destDir: dest });
    assert.equal(res.ok, false);
    assert.deepEqual(res.licenseDivergences, ['LICENSE-dart-lang-skills']);
  });

  it('LICENSE-<slug> ausente => FAIL (licenseMissing)', () => {
    const { dest } = vendoredMobile();
    fs.rmSync(path.join(dest, 'LICENSE-dart-lang-skills'));
    const res = checkVendor({ destDir: dest });
    assert.equal(res.ok, false);
    assert.deepEqual(res.licenseMissing, ['LICENSE-dart-lang-skills']);
  });

  it('LICENSE-<slug> simlinkado => FAIL (licenseSymlinks)', () => {
    const { dest } = vendoredMobile();
    const licPath = path.join(dest, 'LICENSE-dart-lang-skills');
    fs.rmSync(licPath);
    fs.symlinkSync(path.join(dest, '.vendor-lock.json'), licPath);
    const res = checkVendor({ destDir: dest });
    assert.equal(res.ok, false);
    assert.deepEqual(res.licenseSymlinks, ['LICENSE-dart-lang-skills']);
  });

  it('CLI --check: exit 0 no estado bom, exit 1 ao apagar/adulterar LICENSE-*', () => {
    const { dest } = vendoredMobile();
    assert.equal(main(['--check', '--dest', dest]), 0);
    fs.writeFileSync(path.join(dest, 'LICENSE-dart-lang-skills'), 'x');
    assert.equal(main(['--check', '--dest', dest]), 1);
    fs.rmSync(path.join(dest, 'LICENSE-dart-lang-skills'));
    assert.equal(main(['--check', '--dest', dest]), 1);
  });

  it('lock sem o arquivo mas fonte conhecida: apagar LICENSE ainda falha (deriva da tabela)', () => {
    const { dest } = vendoredMobile();
    const lock = JSON.parse(fs.readFileSync(path.join(dest, '.vendor-lock.json'), 'utf8'));
    delete lock.licenses;
    fs.writeFileSync(path.join(dest, '.vendor-lock.json'), JSON.stringify(lock, null, 2) + '\n');
    assert.equal(checkVendor({ destDir: dest }).ok, true, 'fonte na tabela ainda valida');
    fs.rmSync(path.join(dest, 'LICENSE-dart-lang-skills'));
    const res = checkVendor({ destDir: dest });
    assert.equal(res.ok, false);
    assert.deepEqual(res.licenseMissing, ['LICENSE-dart-lang-skills']);
  });
});
