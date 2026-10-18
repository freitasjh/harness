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
  REPO_ROOT,
  SOURCE_LOCK_PATH,
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

  // EX-BE-04 (RF-03/A1): o `stacks` da skill vem da ORIGEM declarada no
  // source-lock; `inferStacks` (prefixo conhecido) fica so como fallback.
  it('stacks DECLARADO na origem vence o nome; sem declaracao e sem prefixo => [] comum', () => {
    const src = tmp('harness-vendor-src-');
    write(src, 'react-widgets/SKILL.md', '---\nname: react-widgets\n---\n# react\n');
    write(src, 'react-widgets/LICENSE', MIT_TEXT);
    write(src, 'react-loose/SKILL.md', '---\nname: react-loose\n---\n# react sem origem declarada\n');
    write(src, 'react-loose/LICENSE', MIT_TEXT);
    const lock = fakeLock(src, ['react-widgets', 'react-loose']);
    lock.skills['react-widgets'].stacks = ['react'];
    const dest = tmp('harness-vendor-dest-');
    const built = buildVendor({ sourceDir: src, sourceLock: lock, sourceLicenses: {}, sourceCommits: {}, destDir: dest });
    assert.deepEqual(built.lock.skills['react-widgets'].stacks, ['react'], 'declaracao de origem vence o nome');
    assert.deepEqual(built.lock.skills['react-loose'].stacks, [], 'nome react-* sem declaracao NAO gate (comum)');
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
    // I9(a): `licenseOrigin` e aditivo (ADR-003) — file/spdx/sha256 intactos.
    assert.deepEqual(built.lock.licenses, [{
      source: 'dart-lang/skills',
      spdx: 'BSD-3-Clause',
      file: 'LICENSE-dart-lang-skills',
      sha256: UPSTREAM_DART_SHA,
      licenseOrigin: 'upstream-file',
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

// --- FU-30: log de mismatch lock-vs-fonte DE-DUPLICADO ---------------------
// O erro era empurrado uma vez POR SKILL da mesma fonte (22 skills dart-* /
// flutter-* => mesma linha repetida 22x). O arquivo agregado e UM; a mensagem
// tambem deve ser uma.
describe('FU-30 lock-vs-source mismatch — 1 linha por arquivo, nao por skill', () => {
  it('duas skills da MESMA fonte com hash divergente => UM erro de divergencia', () => {
    const src = tmp('harness-vendor-src-');
    for (const n of ['dart-a', 'dart-b']) write(src, `${n}/SKILL.md`, `---\nname: ${n}\n---\n# ${n}\n`);
    const lock = fakeLock(src, ['dart-a', 'dart-b']);
    for (const n of ['dart-a', 'dart-b']) lock.skills[n].source = 'dart-lang/skills';
    const dest = tmp('harness-vendor-dest-');
    const built = buildVendor({ sourceDir: src, sourceLock: lock, sourceCommits: { 'dart-lang/skills': '0d9f1c4a0ae29d6f5180bf6143d7997ec3bacf49' }, destDir: dest });
    writeVendor(built, { destDir: dest });

    // lock gravado com hash DIFERENTE do esperado pela tabela de fontes
    const onDisk = JSON.parse(fs.readFileSync(path.join(dest, '.vendor-lock.json'), 'utf8'));
    onDisk.licenses[0].sha256 = 'f'.repeat(64);
    fs.writeFileSync(path.join(dest, '.vendor-lock.json'), JSON.stringify(onDisk, null, 2) + '\n');

    const res = checkVendor({ destDir: dest });
    assert.equal(res.ok, false, 'divergencia lock-vs-fonte reprova');
    const mismatch = res.errors.filter((e) => /hash da licenca divergente/.test(e));
    assert.equal(mismatch.length, 1, `FU-30: esperava 1 linha, veio ${mismatch.length}: ${JSON.stringify(res.errors)}`);
    assert.match(mismatch[0], /LICENSE-dart-lang-skills/, 'a linha nomeia o arquivo');
    assert.match(mismatch[0], /lock=f{64}/, 'a linha traz o hash do lock');
    // o arquivo em disco continua valido contra a TABELA — só o lock divergiu
    assert.deepEqual(res.licenseDivergences, [], 'arquivo agregado intacto');
  });
});

// ---------------------------------------------------------------------------
// EX-BE-10 / EX-BE-11 / EX-VAL-12 (ADR-003): vendor com ORIGEM de licenca
// declarada por fonte (`licenseOrigin`), NOTICE sem claim universal e as 2
// skills React vendorizadas (lock/NOTICE/licencas/optional).
// ---------------------------------------------------------------------------
const SKILLS_DIR = path.join(REPO_ROOT, '.agents', 'skills');
const VENDOR_LOCK = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, '.vendor-lock.json'), 'utf8'));
const NOTICE_TEXT = fs.readFileSync(path.join(SKILLS_DIR, 'VENDOR-NOTICE.md'), 'utf8');
const SOURCE_LOCK = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, SOURCE_LOCK_PATH), 'utf8'));

const REACT_SKILL_SOURCES = {
  'react-components': 'google-labs-code/stitch-skills',
  'react-best-practices': 'vercel-labs/agent-skills',
};
const STITCH_UPSTREAM_SHA = 'b4133a55232c0996713349891dc55469d46a16ec027c033c9e4108b2149abb42';
const VERCEL_TEXT_SHA = '1cc9611d4fffbd0201696a5a81cc0b1d82743db847654ff4fa57d92ba7669387';
const STITCH_COMMIT = '0337446dadde6f8c94210444e2aa9d546126480f';
const VERCEL_COMMIT = '063bee94c3f4df8453406c830b0a7df0f2860278';

// I5 (ORACULO INDEPENDENTE): treeHashes das 22 skills mobile no estado
// PRE-Batch-4. Se o vendor reescrever qualquer byte de uma skill existente,
// isto sangra.
const MOBILE_TREE_HASHES = {
  "dart-add-unit-test": "ca966dcf20f38b27ef6fc48a55b8c27cb7705127e03b7a5c78d36ea146fc266e",
  "dart-build-cli-app": "9c88873c3404f2afa386ef9e9c7dd181c052ced38aa1b8e9f4814c685a49c5a5",
  "dart-collect-coverage": "fca566d09e82d45c7acbd8c4e85a38487c0f813b7919893f4bc7066ca03a33f2",
  "dart-fix-runtime-errors": "5e389fb7035cc36177318dfccaf047eaf222946930f0e24844ab1281a9601800",
  "dart-generate-test-mocks": "c8a6732810c81d861aae6eacea0e02097942f752dc9f63ea318aa838253cc729",
  "dart-migrate-to-checks-package": "601c6e0201db0ed1b92a5fb3f21e65e97dcc0b4ce420e4a2036ef46e20d60d53",
  "dart-resolve-package-conflicts": "e21ffd909306c9d7e0d9a9a207e4383c8c372c9e080ed9b23ffdff822b8f86f4",
  "dart-run-static-analysis": "e2a7454ac22d69d6c6ccb3d1c4c5e2da56c846d0a4c9699bbd33827936bec4f4",
  "dart-setup-ffi-assets": "ae72ba6a8253362a100d31d471ad70e9bae0128e8150b1541dedaafb3209cb81",
  "dart-use-ffigen": "d0f26d683f54589a6c44bf599d5c37dd4862c7d2a9befe6862167c421355fec8",
  "dart-use-pattern-matching": "08dcca251379e52a84ec7b2206518208c563b86ab72f29056ff2c54619d6ebe1",
  "dart-use-primary-constructors": "0f919b00d2f9b57cb27207782888feb2c9117f3b2b5466bd63a159ca4f20be78",
  "flutter-add-integration-test": "62eb6600a25156b09012ff5c1b5897fc4e02e9dbb1a1a8d3bc80fbce0d8fb345",
  "flutter-add-widget-preview": "d015fd19a06b7c9f42e65add3e90fd51095cd6cb11f2b57c5d6bf759483b4f9a",
  "flutter-add-widget-test": "bc03a884d80821350ce6298b0f528e27af1fe70733f8d8717fb84129750666b6",
  "flutter-apply-architecture-best-practices": "7d8ae28831dcf0bf1d5968e0ef79218e2994d68f2463a5ef1e96f4c51c77b489",
  "flutter-build-responsive-layout": "f77247468631edb171477f808da95151dd19ce0164001ca57df3e38f912be6b2",
  "flutter-fix-layout-issues": "85570f8ea12d4e1f3a2b2d6622c51b144a4df2697779633e67c2c23558f5946c",
  "flutter-implement-json-serialization": "4a3198b5f1949c9bb5fc72466373b23ca7cf3b32ab92a44af51f2dec0348d49a",
  "flutter-setup-declarative-routing": "7d9c8b9d144b4064886b497b62968627fab7615e441fc67d95bfec7fc50e5c4a",
  "flutter-setup-localization": "33bfbdfb46d39c2acba559ab0b1b8d28a51c6a7ff3f6e0367f3b3cd46086cc92",
  "flutter-use-http-package": "7400a1e1f5424fd85a99e1d57dc1946761e4768a0c3ac5accf20d2e896ba03c1",
};

describe('EX-BE-10 licenseOrigin: procedencia declarada por fonte (ADR-003)', () => {
  it('cada fonte declara licenseOrigin valido (upstream-file | declared-evidence)', () => {
    for (const [source, entry] of Object.entries(SOURCE_LICENSES)) {
      assert.ok(['upstream-file', 'declared-evidence'].includes(entry.licenseOrigin), `${source}: licenseOrigin valido`);
    }
  });

  it('upstream-file: o sha256 e o do ARQUIVO real do upstream (stitch, Apache-2.0, 11.273 bytes)', () => {
    const s = SOURCE_LICENSES['google-labs-code/stitch-skills'];
    assert.equal(s.spdx, 'Apache-2.0');
    assert.equal(s.licenseOrigin, 'upstream-file');
    assert.equal(s.sha256, STITCH_UPSTREAM_SHA);
    assert.equal(sha256(s.licenseText), STITCH_UPSTREAM_SHA, 'texto == arquivo upstream (byte-a-byte)');
    assert.equal(Buffer.byteLength(s.licenseText, 'utf8'), 11273, 'tamanho do LICENSE upstream');
    assert.match(s.licenseText, /Apache License\s+Version 2\.0, January 2004/);
  });

  it('declared-evidence: sha do NOSSO texto + evidence[] com URL/secao + commit pinado (vercel, MIT)', () => {
    const v = SOURCE_LICENSES['vercel-labs/agent-skills'];
    assert.equal(v.spdx, 'MIT');
    assert.equal(v.licenseOrigin, 'declared-evidence');
    assert.equal(v.sha256, VERCEL_TEXT_SHA);
    assert.equal(sha256(v.licenseText), VERCEL_TEXT_SHA, 'sha congela o NOSSO texto');
    assert.match(v.licenseText, /^MIT License\n\nCopyright \(c\) Vercel, Inc\./, 'holder nomeado');
    assert.ok(Array.isArray(v.evidence) && v.evidence.length >= 3, 'evidencia citada (>=3 itens)');
    for (const ev of v.evidence) {
      assert.match(ev.url, /^https:\/\/github\.com\/vercel-labs\/agent-skills\/blob\/[0-9a-f]{40}\//, 'URL com commit');
      assert.ok(ev.section && ev.section.length > 0, 'secao citada');
      assert.equal(ev.commit, VERCEL_COMMIT, 'commit pinado na evidencia');
    }
  });

  it('SPLIT do assert: a exigencia "bate com o arquivo upstream" vale SO para upstream-file', () => {
    for (const [source, entry] of Object.entries(SOURCE_LICENSES)) {
      if (entry.licenseOrigin !== 'upstream-file') continue;
      assert.equal(sha256(entry.licenseText), entry.sha256, `${source}: sha == upstream (verificavel)`);
    }
    const declared = Object.entries(SOURCE_LICENSES).filter(([, e]) => e.licenseOrigin === 'declared-evidence');
    assert.ok(declared.length >= 1, 'existe ao menos uma fonte declared-evidence');
    for (const [source, entry] of declared) {
      // NAO ha arquivo upstream para comparar: o contrato POSITIVO e o sha do
      // NOSSO texto + evidencia citada (URL/secao + commit).
      assert.equal(sha256(entry.licenseText), entry.sha256, `${source}: sha do nosso texto`);
      assert.ok(Array.isArray(entry.evidence) && entry.evidence.length > 0, `${source}: evidence[] presente`);
      for (const ev of entry.evidence) {
        assert.ok(typeof ev.url === 'string' && ev.url.length > 0, `${source}: evidencia com URL`);
        assert.ok(typeof ev.section === 'string' && ev.section.length > 0, `${source}: evidencia com secao`);
        assert.match(ev.commit, /^[0-9a-f]{40}$/, `${source}: evidencia com commit pinado`);
      }
    }
  });

  it('nome do arquivo agregado: declarado por fonte vence; mobile mantem a derivacao historica', () => {
    assert.equal(aggregatedLicenseName('google-labs-code/stitch-skills'), 'LICENSE-stitch-skills');
    assert.equal(aggregatedLicenseName('vercel-labs/agent-skills'), 'LICENSE-vercel-agent-skills');
    assert.equal(aggregatedLicenseName('dart-lang/skills'), 'LICENSE-dart-lang-skills', 'I5: nome congelado');
    assert.equal(aggregatedLicenseName('flutter/skills'), 'LICENSE-flutter-skills', 'I5: nome congelado');
  });

  it('agrega a licenca de fonte cujo artefato declara a propria licenca (declared-evidence)', () => {
    const src = tmp('harness-vendor-src-');
    write(src, 'declared-skill/SKILL.md', '---\nname: declared-skill\nlicense: MIT\n---\n# x\n');
    const lock = fakeLock(src, ['declared-skill']);
    lock.skills['declared-skill'].source = 'acme/declared';
    const sourceLicenses = {
      'acme/declared': {
        spdx: 'MIT',
        licenseOrigin: 'declared-evidence',
        licenseFile: 'LICENSE-acme-declared',
        licenseText: 'MIT License\n\nCopyright (c) ACME\n',
        evidence: [{ url: 'https://example.test/blob/abc/', section: 'README §License -> MIT', commit: 'abc' }],
      },
    };
    const dest = tmp('harness-vendor-dest-');
    const built = buildVendor({ sourceDir: src, sourceLock: lock, sourceLicenses, sourceCommits: {}, destDir: dest });
    assert.deepEqual(built.lock.skills['declared-skill'].licenseFile, 'SKILL.md', 'licenca declarada pelo artefato');
    assert.equal(built.lock.licenses.length, 1, 'agregado escrito para a fonte referenciada');
    assert.equal(built.lock.licenses[0].file, 'LICENSE-acme-declared');
    assert.equal(built.lock.licenses[0].licenseOrigin, 'declared-evidence');
    assert.equal(built.lock.licenses[0].evidence.length, 1, 'evidence[] propagada para o lock');
    writeVendor(built, { destDir: dest });
    assert.ok(fs.existsSync(path.join(dest, 'LICENSE-acme-declared')), 'arquivo agregado no dest');
    assert.equal(checkVendor({ destDir: dest }).ok, true);
  });
});

describe('EX-BE-11 vendor das 2 skills React (lock + licencas + optional)', () => {
  it('lock: as 2 skills React presentes, com commit pinado e stacks [react]', () => {
    for (const name of ['react-components', 'react-best-practices']) {
      const e = VENDOR_LOCK.skills[name];
      assert.ok(e, `${name} no lock`);
      assert.equal(e.stacks.join(','), 'react', `${name}: stacks declarado (nao vira "comum")`);
      assert.equal(e.sourceType, 'github');
      assert.match(e.skillPath, /SKILL\.md$/, `${name}: skillPath`);
      assert.match(e.computedHash, /^[0-9a-f]{64}$/, `${name}: computedHash`);
      assert.match(e.treeHash, /^[0-9a-f]{64}$/, `${name}: treeHash`);
    }
    for (const [name, source] of Object.entries(REACT_SKILL_SOURCES)) {
      assert.equal(VENDOR_LOCK.skills[name].source, source, `${name}: fonte`);
    }
    assert.equal(VENDOR_LOCK.skills['react-components'].sourceCommit, STITCH_COMMIT);
    assert.equal(VENDOR_LOCK.skills['react-components'].license, 'Apache-2.0');
    assert.equal(VENDOR_LOCK.skills['react-best-practices'].source, 'vercel-labs/agent-skills');
    assert.equal(VENDOR_LOCK.skills['react-best-practices'].sourceCommit, VERCEL_COMMIT);
    assert.equal(VENDOR_LOCK.skills['react-best-practices'].license, 'MIT');
  });

  // AT-1 (review iteracao 2): o artefato de procedencia NOMEIA as divergencias
  // conhecidas (skill + revisao real + o que difere) e o `sourceCommit`
  // declarado e declaradamente NAO descritivo para elas.
  it('NOTICE nomeia as 3 divergencias conhecidas com a revisao real (nao limite generico)', () => {
    const KNOWN = {
      'dart-add-unit-test': 'last_modified',
      'dart-build-cli-app': 'examples/multi_command_runner.dart',
      'dart-use-pattern-matching': 'examples/json_patterns.dart',
    };
    const OLD_REV = '19228e842c691a5bcdb06b6603f3651953b2af2a';
    for (const [name, detail] of Object.entries(KNOWN)) {
      const e = VENDOR_LOCK.skills[name];
      assert.equal(e.contentRevision, OLD_REV, `${name}: revisao real declarada no lock`);
      assert.match(NOTICE_TEXT, new RegExp(`\\| ${name} \\| 0d9f1c4a[0-9a-f]{32} \\| ${OLD_REV} \\|`), `${name}: linha da tabela de divergencias`);
      assert.ok(NOTICE_TEXT.includes(detail), `${name}: divergencia nomeada (${detail})`);
    }
    assert.match(NOTICE_TEXT, /Fidelidade byte-a-byte da COPIA DA SKILL ao commit pinado e 🟡 PROCESSO/, 'nivel 🟡 declarado');
    assert.match(NOTICE_TEXT, /Divergencia CONHECIDA e NAO corrigida em 3 skill\(s\)/, 'contagem declarada');
    assert.match(NOTICE_TEXT, /o `sourceCommit` declarado NAO descreve o conteudo delas/, 'sourceCommit nao descritivo');
    assert.match(NOTICE_TEXT, /preservada para nao alterar os hashes congelados do lock \(invariante I5 do ciclo\)/, 'motivo declarado');
    // nenhuma skill FORA das 3 carrega `contentRevision`
    const outras = Object.entries(VENDOR_LOCK.skills).filter(([, e]) => e.contentRevision).map(([n]) => n);
    assert.deepEqual(outras, Object.keys(KNOWN), 'so as 3 divergentes declaradas');
  });

  it('optional: true SO em react-components (RF-09/D-3)', () => {
    assert.equal(VENDOR_LOCK.skills['react-components'].optional, true);
    assert.ok(!VENDOR_LOCK.skills['react-best-practices'].optional, 'a padrao do perfil nao e opcional');
    const opcionais = Object.entries(VENDOR_LOCK.skills).filter(([, e]) => e.optional === true).map(([n]) => n);
    assert.deepEqual(opcionais, ['react-components'], 'nenhuma outra skill marcada como opcional');
  });

  it('licencas agregadas existem no dest com a origem declarada no lock', () => {
    for (const f of ['LICENSE-stitch-skills', 'LICENSE-vercel-agent-skills']) {
      assert.ok(fs.existsSync(path.join(SKILLS_DIR, f)), `${f} existe`);
    }
    const bySource = Object.fromEntries(VENDOR_LOCK.licenses.map((l) => [l.source, l]));
    assert.equal(bySource['google-labs-code/stitch-skills'].licenseOrigin, 'upstream-file');
    assert.equal(bySource['google-labs-code/stitch-skills'].sha256, STITCH_UPSTREAM_SHA);
    assert.equal(bySource['vercel-labs/agent-skills'].licenseOrigin, 'declared-evidence');
    assert.equal(bySource['vercel-labs/agent-skills'].sha256, VERCEL_TEXT_SHA);
    assert.ok(bySource['vercel-labs/agent-skills'].evidence.length >= 3, 'evidence[] no lock');
    assert.equal(sha256(fs.readFileSync(path.join(SKILLS_DIR, 'LICENSE-stitch-skills'), 'utf8')), STITCH_UPSTREAM_SHA);
  });

  it('copia das skills React byte-identica a fonte (nenhum patch no SKILL.md)', () => {
    // o sha congelado do texto do SKILL.md vendoriado bate com o lock do upstream
    // (computedHash) — patch quebraria o `--check`.
    for (const name of ['react-components', 'react-best-practices']) {
      const dir = path.join(SKILLS_DIR, name);
      assert.ok(fs.existsSync(path.join(dir, 'SKILL.md')), `${name}/SKILL.md`);
      assert.equal(folderComputedHash(dir), VENDOR_LOCK.skills[name].computedHash, `${name}: computedHash == origem`);
      assert.equal(treeHash(dir), VENDOR_LOCK.skills[name].treeHash, `${name}: treeHash`);
    }
    const rbp = fs.readFileSync(path.join(SKILLS_DIR, 'react-best-practices', 'SKILL.md'), 'utf8');
    assert.match(rbp, /^---\nname: vercel-react-best-practices/, 'frontmatter intacto (sem campo injetado)');
  });

  it('I5: treeHashes das 22 skills mobile IDENTICOS ao estado pre-Batch-4', () => {
    for (const [name, expected] of Object.entries(MOBILE_TREE_HASHES)) {
      assert.equal(VENDOR_LOCK.skills[name]?.treeHash, expected, `${name}: treeHash inalterado`);
      assert.equal(treeHash(path.join(SKILLS_DIR, name)), expected, `${name}: bytes em disco inalterados`);
    }
    assert.equal(Object.keys(MOBILE_TREE_HASHES).length, 22, '22 skills mobile no oraculo');
  });

  it('source-lock de ENTRADA commitado declara stacks/optional das 2 skills (RF-13/A1)', () => {
    for (const name of ['react-components', 'react-best-practices']) {
      assert.ok(SOURCE_LOCK.skills[name], `${name} no source-lock de entrada`);
      assert.deepEqual(SOURCE_LOCK.skills[name].stacks, ['react'], `${name}: stacks declarado na origem`);
    }
    assert.equal(SOURCE_LOCK.skills['react-components'].optional, true);
    assert.ok(!SOURCE_LOCK.skills['react-best-practices'].optional);
    assert.ok(SOURCE_LOCK.skills['react-components'].runtimeDeps.some((d) => /fetch-stitch\.sh/.test(d)), 'rede em runtime declarada');
  });

  it('NOTICE: origem por fonte, sem claim universal, com a dependencia externa do opcional', () => {
    assert.ok(!/byte-identica? (ao|com o) (repositorio )?upstream/i.test(NOTICE_TEXT), 'sem claim universal de byte-identidade');
    assert.match(NOTICE_TEXT, /o lock e a referencia de integridade do CI/, 'referencia de integridade declarada (o lock)');
    assert.match(NOTICE_TEXT, /licenseOrigin/, 'NOTICE cita licenseOrigin');
    assert.match(NOTICE_TEXT, /google-labs-code\/stitch-skills[\s\S]{0,120}upstream-file/, 'origem stitch declarada');
    assert.match(NOTICE_TEXT, /vercel-labs\/agent-skills[\s\S]{0,120}declared-evidence/, 'origem vercel declarada');
    assert.match(NOTICE_TEXT, /fidelidade da transcricao e 🟡 processo/i, 'limite da transcricao declarado');
    assert.match(NOTICE_TEXT, /fetch-stitch\.sh/, 'rede em runtime declarada');
    assert.match(NOTICE_TEXT, /@swc\/core/, '@swc/core declarado');
    assert.match(NOTICE_TEXT, /Stitch MCP/, 'Stitch MCP declarado');
    assert.match(NOTICE_TEXT, /Skills opcionais \(1\)/, 'secao de opcionais com 1 skill');
    assert.match(NOTICE_TEXT, /scripts\/vendor\/skills-lock\.json/, 'source-lock de entrada documentado');
    assert.match(NOTICE_TEXT, new RegExp(STITCH_COMMIT), 'commit pinado no NOTICE');
  });

  it('CI limpo (sem clones, sem rede): --check verde no dest real', () => {
    const res = checkVendor({ destDir: SKILLS_DIR });
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(main(['--check']), 0);
  });
});
