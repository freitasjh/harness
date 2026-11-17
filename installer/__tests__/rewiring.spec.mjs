// EIX-04 — rewiring dos consumidores para o gerador por eixos (ADR-001 §3 itens 5/6/7).
// TDD: este arquivo nasce VERMELHO contra o gerador antigo (N/A Node-only) e
// só fica verde quando installer-contract.generateConfig({axes}) compõe por eixo
// sem perder writtenPaths (BF-04) nem suiteCommand.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { generateConfig, STACK_PROFILES } from '../installer-contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LER = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('FU-GERADOR-REWIRING: comando literal ADR §3 item 5 (RF-05)', () => {
  it('installer-contract.generateConfig({project,axes:{rust,vue}}) => rust backend / vue frontend', () => {
    const cfg = generateConfig({ project: 'demo', axes: { backend: 'rust', frontend: 'vue' } });
    assert.equal(cfg.stack.backend, 'rust backend');
    assert.equal(cfg.stack.frontend, 'vue frontend');
    assert.deepEqual(cfg.commands, {}, 'commands do eixo backend rust (sem default inventado)');
    assert.deepEqual(cfg.mcp, { required: ['chrome-devtools'] }, 'mcp do eixo frontend vue');
  });

  it('nenhum literal "(declared via Q&A)" escapa do gerador por eixo', () => {
    const cfg = generateConfig({ project: 'demo', axes: { backend: 'rust', frontend: 'vue' } });
    assert.equal(/declared via Q&A/.test(JSON.stringify(cfg)), false);
    assert.equal(/declared via Q&A/.test(LER('installer/generate-eixos.mjs')), false);
  });

  it('48 pares geram config válida pelo caminho por eixos (0 exceção)', () => {
    const backends = ['java', 'node', 'rust', 'nestjs', 'dart', 'flutter', 'other', 'none'];
    const frontends = ['vue', 'react', 'dart', 'flutter', 'other', 'none'];
    let n = 0;
    for (const backend of backends) {
      for (const frontend of frontends) {
        const cfg = generateConfig({ project: 'demo', axes: { backend, frontend } });
        assert.equal(typeof cfg.stack.backend, 'string');
        assert.equal(typeof cfg.stack.frontend, 'string');
        assert.ok(Array.isArray(cfg.mcp.required));
        n += 1;
      }
    }
    assert.equal(n, 48);
  });

  it('par fora do inventário reprova (fail-closed, sem fallback de preset)', () => {
    assert.throws(
      () => generateConfig({ project: 'demo', axes: { backend: 'ruby', frontend: 'vue' } }),
      (e) => e && e.code === 'INVALID_AXIS_PAIR',
    );
  });
});

describe('FU-WRITTENPATHS-BF04: portar trim + suiteCommand para o gerador novo', () => {
  const escritos = (paths) => new Set(paths);

  it('writtenPaths remove moduleMap/evidence.schema ausentes (BF-04)', () => {
    const cfg = generateConfig(
      { project: 'demo', axes: { backend: 'java', frontend: 'vue' } },
      { writtenPaths: escritos(['.opencode/plugins/gate.js']) },
    );
    assert.deepEqual(Object.keys(cfg.moduleMap), ['plugins']);
    assert.equal('schema' in cfg.evidence, false);
  });

  it('writtenPaths presentes preservam TODOS os refs (sem perda silenciosa)', () => {
    const cfg = generateConfig(
      { project: 'demo', axes: { backend: 'java', frontend: 'vue' } },
      { writtenPaths: escritos([
        '.opencode/plugins/gate.js',
        '.agents/rules/x.md',
        '.agents/schemas/y.json',
        '.agents/schemas/harness-report.schema.json',
      ]) },
    );
    assert.deepEqual(Object.keys(cfg.moduleMap).sort(), ['plugins', 'rules', 'schemas']);
    assert.equal(cfg.evidence.schema, '.agents/schemas/harness-report.schema.json');
  });

  it('suiteCommand explicito sobrepoe o default do backend sem criar valor novo', () => {
    const cfg = generateConfig(
      { project: 'demo', axes: { backend: 'node', frontend: 'vue' }, suiteCommand: 'make test' },
    );
    assert.equal(cfg.commands.suiteFull, 'make test');
    assert.equal(cfg.commands.unit, 'make test');
  });

  it('forma antiga (stack/suiteCommand/writtenPaths) preserva o contrato congelado', () => {
    const cfg = generateConfig(
      { project: 'demo', stack: 'node', suiteCommand: 'make test' },
      { writtenPaths: escritos(['.opencode/plugins/gate.js']) },
    );
    assert.equal(cfg.stack.backend, STACK_PROFILES.node.backend, 'texto congelado do perfil legado');
    assert.equal(cfg.commands.suiteFull, 'make test');
    assert.deepEqual(Object.keys(cfg.moduleMap), ['plugins']);
    assert.equal('schema' in cfg.evidence, false);
  });
});

describe('RF-06/RF-07: inventário de consumidores com veredito, 0 órfão', () => {
  const INVENTARIO = Object.freeze({
    '.agents/rules/harness-config.md': 'CONGELADO-DOC — rótulo legado em prosa (path protegido)',
    '.agents/skills/harness-installer/SKILL.md': 'CONGELADO-DOC — rótulo legado em prosa (path protegido)',
    'installer/contract-inventory.mjs': 'CONGELADO-CONTRATO — inventário de nomes c63e333',
    'installer/contract-pure.mjs': 'CONGELADO-COMPAT — presetOfAxes/profileOf (D-PURE)',
    'installer/contract-registry.mjs': 'CONGELADO-COMPAT — STACK_PROFILES/STACK_VALUES (D-DATA, só rótulo)',
    'installer/installer-contract.mjs': 'PONTE-CONGELADA — 10 D-ENGINE inalterados (TUI-06); rewire em install.mjs:759',
    'installer/install.mjs': 'COMPAT-CONGELADA — 4 call-sites legados (oráculo golden byte-equal)',
    'installer-rs/src/ops/answers.rs': 'CONGELADO-ORACLE — validação Rust c63e333',
    'installer-rs/src/ops/registry.rs': 'CONGELADO-ORACLE — STACK_VALUES Rust c63e333',
    'installer/__tests__/compose.spec.mjs': 'ORÁCULO-EIXOS — guarda zero preset nos módulos novos',
    'installer/__tests__/docs.spec.mjs': 'CONGELADO-ORACLE — prosa documental',
    'installer/__tests__/eixos.spec.mjs': 'ORÁCULO-48 — inventário 8×6 literal',
    'installer/__tests__/eixos-stack.spec.mjs': 'MIGRADO — oráculo 12 presets → 48 pares (fora do grep, EIX-04)',
    'installer/__tests__/generate-eixos.spec.mjs': 'ORÁCULO-EIXOS — gerador por eixo',
    'installer/__tests__/generate.spec.mjs': 'CONGELADO-ORACLE — gerador legado byte-equal',
    'installer/__tests__/rewiring.spec.mjs': 'ORÁCULO-EIXOS — inventário/vereditos e comando literal (EIX-04)',
    'installer/__tests__/golden.spec.mjs': 'CONGELADO-ORACLE — baseline (VAL-01 re-deriva)',
    'installer/__tests__/wizard.spec.mjs': 'CONGELADO-ORACLE — prompt W3 legado',
  });

  it('inventário: 17 no grep (13 do PRD + specs) + 1 migrado para fora dele', () => {
    const medido = new Set(
      execFileSync('grep', ['-rlE', 'STACK_(VALUES|PROFILES)', 'installer/', '.agents/', 'installer-rs/src/'], { cwd: ROOT, encoding: 'utf8' })
        .trim().split('\n').filter(Boolean),
    );
    assert.equal(medido.size, 17);
    for (const rel of medido) {
      assert.ok(rel in INVENTARIO, `arquivo sem veredito: ${rel}`);
    }
    assert.equal(medido.has('installer/__tests__/eixos-stack.spec.mjs'), false, 'oráculo migrado ainda casa com preset');
    assert.equal('installer/__tests__/eixos-stack.spec.mjs' in INVENTARIO, true, 'veredito do migrado preservado');
    assert.equal(Object.keys(INVENTARIO).length, 18);
  });

  it('todo arquivo do inventário existe e tem veredito não-vazio', () => {
    for (const [rel, veredito] of Object.entries(INVENTARIO)) {
      assert.ok(fs.existsSync(path.join(ROOT, rel)), `ausente: ${rel}`);
      assert.ok(typeof veredito === 'string' && veredito.length > 10, `sem veredito: ${rel}`);
    }
  });

  it('nenhum import órfão: todo nome importado/exportado de .mjs existe no módulo', async () => {
    const padrao = /(?:import|export)\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
    for (const rel of Object.keys(INVENTARIO)) {
      if (!rel.endsWith('.mjs')) continue;
      const fonte = LER(rel);
      const base = new URL(`../${rel.slice('installer/'.length)}`, import.meta.url);
      for (const m of fonte.matchAll(padrao)) {
        const nomes = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
        if (nomes.length === 0) continue;
        const alvo = new URL(m[2], base);
        const modulo = await import(alvo.href);
        for (const nome of nomes) {
          assert.ok(nome in modulo, `import órfão: ${nome} em ${rel} ← ${m[2]}`);
        }
      }
    }
  });

  it('FU-EIX-ORACULO: eixos-stack.spec.mjs troca o oráculo de 12 presets por 48 pares literais', () => {
    const fonte = LER('installer/__tests__/eixos-stack.spec.mjs');
    assert.equal(/EXPECTED_STACKS/.test(fonte), false, 'tabela de 12 presets ainda é fonte');
    assert.equal(/STACK_PROFILES\[/.test(fonte), false, 'preset casado ainda seleciona config no oráculo');
    const bloco = fonte.match(/const ORACULO_PARES_48 = \[([\s\S]*?)\];/);
    assert.ok(bloco, 'oráculo literal de 48 pares ausente');
    const chaves = [...bloco[1].matchAll(/'([^']+\+[^']+)'/g)].map((m) => m[1]);
    assert.equal(new Set(chaves).size, 48);
  });

  it('nenhum preset casado como caminho principal no gerador por eixo', () => {
    for (const rel of ['installer/eixos.mjs', 'installer/compose.mjs', 'installer/generate-eixos.mjs']) {
      const codigo = LER(rel).replace(/\/\/.*$/gm, '');
      for (const simbolo of ['STACK_PROFILES[', 'presetOfAxes(', 'profilesOfAxes(', 'profileOf(']) {
        assert.equal(codigo.includes(simbolo), false, `${simbolo} em ${rel}`);
      }
    }
  });
});
