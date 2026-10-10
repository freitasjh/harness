// docs.spec.mjs — IM-DOC-01 (RF-17): SKILL.md + README documentam o perfil mobile.
// A doc e o produto desta task; sem assert, ela diverge do codigo em silencio.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SKILL = new URL('../../.agents/skills/harness-installer/SKILL.md', import.meta.url);
const README = new URL('../../README.md', import.meta.url);

function read(u) {
  return fs.readFileSync(u, 'utf8');
}

describe('IM-DOC-01 SKILL.md — perfil mobile fiel ao codigo (RF-17)', () => {
  const skill = read(SKILL);

  it('documenta stacks mobile flutter/dart e o requisito pubspec.yaml', () => {
    assert.match(skill, /flutter/i, 'cita flutter');
    assert.match(skill, /dart/i, 'cita dart');
    assert.match(skill, /pubspec\.yaml/i, 'exige/descreve pubspec.yaml');
  });

  it('documenta o que o perfil mobile gera (mcp, commands, analyze)', () => {
    assert.match(skill, /marionette_mcp/, 'cita o server marionette_mcp');
    assert.match(skill, /dart analyze/i, 'cita o comando de analise');
    assert.match(skill, /flutter test/i, 'cita a suite do perfil flutter');
  });

  it('FU-37: cobre o ramo DART do perfil (dart test, mcp [dart]) — igual ao registry', () => {
    // §9.1 tem uma linha por capacidade, com coluna flutter e coluna dart.
    assert.match(skill, /\|\s*Campo\s*\|\s*`flutter`\s*\|\s*`dart`\s*\|/, 'tabela comparativa flutter x dart');
    assert.match(skill, /\|\s*`commands\.suiteFull` \/ `unit`\s*\|[^|]*\|\s*`dart test`\s*\|/, 'suiteFull do dart = dart test');
    assert.match(skill, /\|\s*`commands\.analyze`\s*\|[^|]*\|\s*`dart analyze`\s*\|/, 'analyze do dart = dart analyze');
    assert.match(skill, /\|\s*`mcp\.required`\s*\|[^|]*\|\s*`\['dart'\]`\s*\|/, 'mcp do dart = [dart] (sem marionette)');
    assert.match(skill, /\|\s*`stack\.backend` \/ `frontend`\s*\|[^|]*\|\s*`dart package \(Q&A\)`\s*\|/, 'stack do dart = dart package (Q&A)');
  });

  it('FU-37: exemplo de API lista os 6 stacks aceitos por validateAnswer', () => {
    const m = skill.match(/stack: 'node',\s*\/\/\s*(.+)/);
    assert.ok(m, 'exemplo de API comenta os stacks validos');
    for (const s of ['node', 'node-esm', 'java+vue', 'outra', 'flutter', 'dart']) {
      assert.ok(m[1].includes(s), `exemplo cita ${s}`);
    }
  });

  it('documenta o wizard W0..W7 e a deteccao de pubspec', () => {
    assert.match(skill, /wizard/i, 'cita o wizard');
    assert.match(skill, /W0/, 'cita W0');
    assert.match(skill, /W7/, 'cita W7');
    assert.match(skill, /detecc|detec[cç][aã]o|detect/i, 'cita a deteccao');
  });

  it('documenta o filtro de vendor por stack + --check', () => {
    assert.match(skill, /vendor/i, 'cita vendor');
    assert.match(skill, /--check/, 'cita o --check do vendor');
    assert.match(skill, /stack/i, 'cita filtro por stack');
  });

  it('documenta o dogfood mobile (copia Flutter sob /tmp)', () => {
    assert.match(skill, /dogfood/i, 'cita dogfood');
    assert.match(skill, /dogfood-mobile\.mjs/, 'cita o script dogfood-mobile');
    assert.match(skill, /\/tmp/, 'deixa claro que a copia vive em /tmp');
  });
});

describe('IM-DOC-01 README.md — aponta o caminho mobile', () => {
  const readme = read(README);

  it('menciona instalacao mobile (flutter/dart)', () => {
    assert.match(readme, /mobile|flutter|dart/i, 'README cita o alvo mobile');
  });

  it('aponta o script de dogfood mobile', () => {
    assert.match(readme, /dogfood-mobile\.mjs/, 'README cita dogfood-mobile.mjs');
  });
});
