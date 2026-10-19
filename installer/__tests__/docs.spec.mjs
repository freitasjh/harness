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

// ---------------------------------------------------------------------------
// EX-FE-13 (RF-11 / Delta Specs do ciclo harness-eixos-stack): paridade
// prosa <-> MECANISMO. Cada assert exige o SIMBOLO real, nao so a ideia.
// ---------------------------------------------------------------------------
describe('EX-FE-13 SKILL.md — registry de 7 presets, menu 2 passos e vendor por origem', () => {
  const skill = read(SKILL);

  it('FU-54 FECHADO: a lista de stacks inclui java+react (sem a string antiga do item 4)', () => {
    assert.match(skill, /java\+react/, 'cita o preset java+react');
    assert.match(skill, /stack: 'node',\s*\/\/[^\n]*java\+react/, 'exemplo de API lista os 7 stacks');
    assert.match(skill, /^\| `stack` \|[^\n]*`java\+react`/m, 'tabela do Q&A cita java+react');
    assert.ok(!/`4` Projeto Java \+ Vue/.test(skill), 'FU-54: texto antigo do item 4 removido');
  });

  it('menu W2m documentado em 2 passos, com o mecanismo do range derivado', () => {
    assert.match(skill, /W2m-1/, 'cita o passo 1');
    assert.match(skill, /W2m-2/, 'cita o passo 2');
    assert.match(skill, /Aplica[cç][aã]o web \(backend \+\s+frontend\)/, 'item 4 = Aplicacao web (nao mais Java+Vue)');
    assert.match(skill, /segue: frontend/, 'item 4 encadeia o passo 2');
    assert.match(skill, /`2` React→`java\+react`/, 'passo 2 oferece React -> java+react');
    assert.match(skill, /`1` Vue→`java\+vue` \(default/, 'passo 2 default Vue -> java+vue (D-9)');
    assert.match(skill, /WIZARD_MENU\.length/, 'range derivado do mecanismo (nao literal)');
    assert.match(skill, /`\[1\/2\]`/, 'contador do passo 1');
    assert.match(skill, /`\[2\/2\]`/, 'contador do passo 2');
  });

  it('registry: 7 presets com axes/stacks derivados e o eixo como fonte do gating', () => {
    for (const preset of ['node', 'node-esm', 'java+vue', 'java+react', 'outra', 'flutter', 'dart']) {
      assert.ok(skill.includes(preset), `cita o preset ${preset}`);
    }
    assert.match(skill, /AXIS_IDS/, 'cita AXIS_IDS (IDs de eixo)');
    assert.match(skill, /stacksFor\(axes\)/, 'stacks DERIVADO do eixo (mecanismo)');
    assert.match(skill, /STACKS_FOR_EXCEPTIONS/, 'cita a tabela de excecoes declarada');
    assert.match(skill, /RULES_BY_AXIS/, 'gating de rules pelo eixo (mecanismo)');
    assert.match(skill, /RULES_BY_AXIS[\s\S]{0,80}nunca pelo nome do arquivo|nunca pelo nome do arquivo/, 'declara que o gating nao usa nome de arquivo');
    assert.match(skill, /ADR-005/, 'cita a rota dos perfis go/rust');
    assert.match(skill, /go[\s\S]{0,40}rust/, 'cita go e rust como futuros');
  });

  it('vendor: licenseOrigin por fonte e react-components como OPCIONAL (RF-08/RF-09)', () => {
    assert.match(skill, /licenseOrigin/, 'cita licenseOrigin');
    assert.match(skill, /upstream-file/, 'cita a origem upstream-file');
    assert.match(skill, /declared-evidence/, 'cita a origem declared-evidence');
    assert.match(skill, /optional/, 'cita optional');
    assert.match(skill, /react-components/, 'cita a skill opcional');
    assert.match(skill, /fetch-stitch\.sh/, 'cita a rede em runtime declarada');
    assert.match(skill, /VENDOR-NOTICE/, 'aponta o NOTICE (procedencia declarada)');
  });

  it('presets web: tabela com stacks derivado e default de suite do par react', () => {
    assert.match(skill, /\|\s*`java\+vue`\s*\|\s*`java\+react`\s*\|/, 'tabela dos presets web');
    assert.match(skill, /\|\s*`stacks` \(derivado\)\s*\|[^|]*\|\s*`\['react'\]`\s*\|/, 'stacks do react = [react]');
    assert.match(skill, /defaultSuiteFor\('java\+react'\)/, 'default de suite do par react');
  });
});

describe('EX-FE-13 harness-config.md — registry real (nao so o mobile)', () => {
  const cfg = read(new URL('../../.agents/rules/harness-config.md', import.meta.url));

  it('descreve o registry com 7 presets, axes, stacks derivado e gating por eixo', () => {
    assert.match(cfg, /## Perfis de stack do instalador/, 'secao renomeada (nao e so o mobile)');
    for (const preset of ['node', 'node-esm', 'java+vue', 'java+react', 'outra', 'flutter', 'dart']) {
      assert.ok(cfg.includes(preset), `cita o preset ${preset}`);
    }
    assert.match(cfg, /`AXIS_IDS`/, 'cita AXIS_IDS');
    assert.match(cfg, /`stacksFor\(axes\)`/, 'stacks derivado do eixo');
    assert.match(cfg, /`RULES_BY_AXIS`/, 'gating de rules pelo eixo');
    assert.match(cfg, /`RULES_COMMON`/, 'cita RULES_COMMON');
    assert.match(cfg, /`SKILLS_BY_AXIS`/, 'gating de skills LOCAIS pelo eixo (via local nova)');
    assert.match(cfg, /`SKILLS_COMMON`/, 'cita SKILLS_COMMON');
    assert.match(cfg, /validado na carga contra `AXIS_IDS`/, 'declaracao validada na carga (fail-closed)');
    assert.match(cfg, /NUNCA do nome do arquivo/, 'proibicao explicita de inferir por nome');
    assert.match(cfg, /go\/\*\*rust\*\*|go\*\*\/\*\*rust\*\*|\*\*go\*\*\/\*\*rust\*\*/, 'cita go/rust como futuros');
    assert.match(cfg, /ADR-005/, 'cita a rota (ADR-005)');
  });

  it('mantem o mobile como caso especial declarado (sem perder o que ja documentava)', () => {
    assert.match(cfg, /marionette_mcp/, 'mantem marionette_mcp');
    assert.match(cfg, /dart analyze/, 'mantem dart analyze');
    assert.match(cfg, /W2m/, 'cita o menu em 2 passos');
    assert.match(cfg, /WIZARD_MENU\.length/, 'range derivado');
  });
});

describe('EX-FE-13 nota de eixo (delta: AGENTS.md ausente -> README.md)', () => {
  it('README traz a nota de eixo com mecanismo (AXIS_IDS/stacksFor) e a rota do ADR-005', () => {
    const readme = read(README);
    assert.match(readme, /escolhida por \*\*eixo\*\*|por \*\*eixo\*\*/, 'declara a escolha por eixo');
    assert.match(readme, /`STACK_PROFILES` \/ `AXIS_IDS`/, 'cita os simbolos reais');
    assert.match(readme, /`stacksFor\(axes\)`/, 'stacks derivado do eixo');
    assert.match(readme, /`java\+react`/, 'cita o preset novo');
    assert.match(readme, /ADR-005/, 'cita a rota dos perfis futuros');
  });

  it('o alvo do delta (AGENTS.md da raiz) NAO existe — a nota foi para o README (emenda)', () => {
    assert.ok(!fs.existsSync(new URL('../../AGENTS.md', import.meta.url)), 'AGENTS.md nao existe (delta emendado para README.md)');
  });
});

// ---------------------------------------------------------------------------
// RF-04 (ciclo opencode-v2-only, review Batch 2): a prosa de instalacao tem de
// refletir o merge v2-only — `plugin`/`plugins` sao PACOTES npm (o plugin local
// e auto-carregado), nunca um array que DEVE conter o path do gate.
// ---------------------------------------------------------------------------
describe('RF-04 INSTALACAO.md / SKILL.md — prosa do merge v2-only (anti-inversao)', () => {
  const inst = read(new URL('../../docs/INSTALACAO.md', import.meta.url));
  const skill = read(SKILL);

  it('INSTALACAO.md V1: `plugin` SEM path local (contrato antigo invertido)', () => {
    assert.ok(!/array contém path do gate/.test(inst), 'contrato antigo (path do gate no array) removido');
    assert.match(inst, /auto-carregado/, 'declara o plugin local como auto-carregado');
    assert.match(inst, /pacotes npm/, 'declara `plugin` como lista de pacotes npm');
  });

  it('SKILL.md: regra de merge nao promete uniao de `plugin` nem preserva o bloco do harness', () => {
    assert.ok(!/merge aditivo \(`plugin` união/.test(skill), 'texto antigo do merge aditivo removido');
    assert.match(skill, /substituídos/, 'agent/permission substituidos pelo incoming');
    assert.match(skill, /pacotes npm/, 'plugin/plugins = pacotes npm (preservados)');
  });
});
