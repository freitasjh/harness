import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateConfig } from '../install.mjs';

describe('IN-03 S1: answers validos => config valido', () => {
  it('gera chaves do SPEC §5.1 / config do repo', () => {
    const cfg = generateConfig({ project: 'demo', stack: 'node', suiteCommand: 'node --test', pluginsDir: '/tmp/x' });
    assert.equal(cfg.version, 1);
    assert.equal(cfg.project, 'demo');
    assert.ok(cfg.commands && typeof cfg.commands.suiteFull === 'string');
    assert.ok(cfg.evidence && cfg.evidence.path === 'harness/');
    assert.ok(Array.isArray(cfg.protectedPaths));
  });
});

describe('IN-03 S2: sem backend java => sem chaves maven + N/A justificado', () => {
  it('stack node nao contem maven', () => {
    const cfg = generateConfig({ project: 'demo', stack: 'node', suiteCommand: 'node --test', pluginsDir: '/tmp/x' });
    const blob = JSON.stringify(cfg);
    assert.ok(!blob.includes('mvn') && !blob.includes('maven'), 'sem maven');
    assert.ok(cfg.stack.backend.includes('N/A'), 'backend N/A justificado');
    assert.ok(cfg.stack.frontend.includes('N/A'), 'frontend N/A justificado');
  });
});

describe('IN-03 S3: sem funcao de copia no codigo', () => {
  it('grep: install.mjs nao expoe caminho de copia', () => {
    const src = fs.readFileSync(new URL('../install.mjs', import.meta.url), 'utf8');
    assert.ok(!/copyTemplate|copyConfig|cp\s+-r|readFileSync\(.*template/i.test(src), 'sem copia de template');
    assert.ok(!/pkill\s+-f/.test(src), 'nunca pkill -f');
  });
  it('gerador puro: deterministico e sem I/O', () => {
    const a = { project: 'demo', stack: 'node', suiteCommand: 'node --test', pluginsDir: '/tmp/x' };
    assert.deepEqual(generateConfig(a), generateConfig(a));
    const src = fs.readFileSync(new URL('../install.mjs', import.meta.url), 'utf8');
    const fn = src.slice(src.indexOf('export function generateConfig'));
    assert.ok(!/readFileSync|writeFileSync|copyFileSync/.test(fn.split('export function')[0] || fn.slice(0, 2000)), 'gerador sem I/O');
  });
});
