// eixos-stack.spec.mjs — RF-01/D1/D4: registry com eixos + ORACULO INDEPENDENTE
// de `stacks`. Batch 1 (EX-BE-01 / EX-VAL-02), endurecido na iteracao 2 do
// code review (CR-1/AT-3).
//
// CR-1: comparar `profile.stacks` com `stacksFor(profile.axes)` e TAUTOLOGICO
// (o valor e atribuido a partir dessa mesma funcao no load de install.mjs).
// A prova aqui e a tabela LITERAL `EXPECTED_STACKS` (oraculo independente).
// O gating por eixo (RF-03/RF-04) entra neste arquivo nas fases seguintes
// (EX-VAL-06), sem tocar nestes asserts.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  STACK_PROFILES,
  STACKS_FOR_EXCEPTIONS,
  STACK_VALUES,
  AXIS_IDS,
  stacksFor,
  profileOf,
  collectIncoming,
  axisIdsFromAxes,
  ruleAllowedForAxes,
  validateRulesByAxis,
  RULES_BY_AXIS,
  RULES_COMMON,
  InstallError,
} from '../install.mjs';
import { buildVendor, REPO_ROOT } from '../../scripts/vendor-skills.mjs';

// ORAculo INDEPENDENTE (CR-1): tabela literal, escrita a mao a partir da tabela
// de excecoes do SPEC RF-01. Nao deriva de `stacksFor`/`axes` — por isso falha
// quando a derivacao muda de comportamento.
const EXPECTED_STACKS = {
  node: [],
  'node-esm': [],
  'java+vue': [],
  'java+react': ['react'],
  outra: [],
  flutter: ['flutter', 'dart'],
  dart: ['dart'],
};

describe('EX-BE-01 oraculo independente: stacks esperado por preset (RF-01/D4)', () => {
  it('a tabela cobre EXATAMENTE os presets do registry (nem a mais, nem a menos)', () => {
    assert.deepEqual(Object.keys(EXPECTED_STACKS).sort(), Object.keys(STACK_PROFILES).sort());
  });

  for (const [name, expected] of Object.entries(EXPECTED_STACKS)) {
    it(`${name}: stacks === ${JSON.stringify(expected)} (tabela literal)`, () => {
      assert.deepEqual(STACK_PROFILES[name].stacks, expected, `${name}: stacks esperado`);
    });
  }
});

describe('EX-BE-01 stacksFor: regra do eixo (RF-01)', () => {
  it('excecao mobile DECLARADA (SPEC RF-01): par flutter+flutter => [flutter, dart]', () => {
    assert.deepEqual(STACKS_FOR_EXCEPTIONS, { 'flutter+flutter': ['flutter', 'dart'] });
    assert.deepEqual(stacksFor({ backend: 'flutter', frontend: 'flutter' }), ['flutter', 'dart']);
    assert.deepEqual(STACK_PROFILES.flutter.stacks, ['flutter', 'dart'], 'preset mobile intacto');
  });

  it('dart deriva [dart]; java+vue deriva [] (sem tags); react deriva [react]', () => {
    assert.deepEqual(stacksFor({ backend: 'dart', frontend: 'none' }), ['dart']);
    assert.deepEqual(stacksFor({ backend: 'java', frontend: 'vue' }), []);
    assert.deepEqual(stacksFor({ backend: 'java', frontend: 'react' }), ['react']);
  });

  it('a derivacao do eixo react e [react], nunca [vue] (Scenario 2 / D-1)', () => {
    assert.notDeepEqual(stacksFor({ backend: 'java', frontend: 'react' }), ['vue']);
  });
});

// AT-3: `STACK_VALUES` (prompt do W3 / BAD_ANSWER / howToFix) e lista PARALELA
// ao registry — sem guarda, um preset novo pode existir num lado e faltar no
// outro (RF-14).
describe('EX-BE-01 AT-3: STACK_VALUES espelha o registry', () => {
  it('STACK_VALUES == Object.keys(STACK_PROFILES) (sem lista duplicada divergente)', () => {
    assert.deepEqual([...STACK_VALUES].sort(), Object.keys(STACK_PROFILES).sort());
  });
});

// ---------------------------------------------------------------------------
// Batch 2 (EX-BE-04 / EX-BE-05 / EX-VAL-06): gating por EIXO DECLARADO.
// A1/A2 fechados aqui — o eixo que decide a entrada de um artefato vem de DADO
// (stacks da origem no vendor-lock / RULES_BY_AXIS validado na carga), nunca do
// nome do arquivo. Os asserts acima (oraculo EXPECTED_STACKS etc.) ficam
// intactos (I9).
// Iteracao 2 (CR-1 + achados de atencao): chave de RULES_BY_AXIS validada
// contra AXIS_IDS (fail-closed), ids do destino derivados de `axes` (nao das
// tags), enumeracao recursiva e bidirecional, doctor com stack do manifesto.
// ---------------------------------------------------------------------------

const tmps = [];
function tmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmps.push(d);
  return d;
}
function writeIn(root, rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}
afterEach(() => {
  for (const d of tmps) fs.rmSync(d, { recursive: true, force: true });
  tmps.length = 0;
});

const MIT_TEXT = 'MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\n';
const SKILLS_PREFIX = '.agents/skills/';
const RULES_PREFIX = '.agents/rules/';
const FRONTEND_RULE = 'frontend-coding-standards.md';

// Ids de eixo do destino pelo PRESET (fonte primaria, CR-1).
const ES_IDS = (stack) => axisIdsFromAxes(profileOf(stack).axes);

// ORAculo LITERAL (nao deriva do lock): as 2 skills react declaram o eixo react.
const REACT_SKILLS = { 'react-components': ['react'], 'react-best-practices': ['react'] };

// Dir de origem com as skills react DECLARADAS no source-lock. O vendor (layout
// source-side = skills na raiz) propaga a declaracao; o lock e as skills sao
// espelhados no layout do destino que `collectIncoming` le (`.agents/skills/`).
// `overrides` injeta um eixo divergente (prova de mutacao do Scenario 4).
function mkReactSkillsSource(overrides = {}) {
  const vend = tmp('harness-eixos-vend-');
  const src = tmp('harness-eixos-src-');
  const skills = {};
  for (const name of Object.keys(REACT_SKILLS)) {
    const body = `---\nname: ${name}\n---\n# ${name}\n`;
    writeIn(vend, `${name}/SKILL.md`, body);
    writeIn(vend, `${name}/LICENSE`, MIT_TEXT);
    writeIn(src, `${SKILLS_PREFIX}${name}/SKILL.md`, body);
    skills[name] = {
      source: 'acme/react',
      sourceType: 'github',
      skillPath: `skills/${name}/SKILL.md`,
      stacks: overrides[name] ?? ['react'],
    };
  }
  writeIn(vend, 'common-skill/SKILL.md', '# skill comum (sem stacks)\n');
  writeIn(src, `${SKILLS_PREFIX}common-skill/SKILL.md`, '# skill comum (sem stacks)\n');
  skills['common-skill'] = { source: 'acme/react', sourceType: 'github', skillPath: 'skills/common-skill/SKILL.md' };
  const built = buildVendor({
    sourceDir: vend,
    sourceLock: { version: 1, skills },
    sourceLicenses: {},
    sourceCommits: {},
    destDir: tmp('harness-eixos-dest-'),
  });
  writeIn(src, `${SKILLS_PREFIX}.vendor-lock.json`, JSON.stringify(built.lock));
  return { src, lock: built.lock };
}

function stacksInLock(lock, names) {
  return Object.fromEntries(names.map((n) => [n, lock.skills[n].stacks]));
}
function skillPaths(inc) {
  return Object.keys(inc).filter((k) => k.startsWith(SKILLS_PREFIX)).sort();
}
const REACT_SKILL_RE = /react-(components|best-practices)/;

describe('EX-BE-04/EX-VAL-06 gating de skill pelo eixo declarado na origem (RF-03/A1)', () => {
  it('a origem declara o eixo e o lock propaga o valor declarado (Scenario 1)', () => {
    const { lock } = mkReactSkillsSource();
    assert.deepEqual(stacksInLock(lock, Object.keys(REACT_SKILLS)), REACT_SKILLS);
  });

  it('entra em java+react: as 2 skills react + a comum', () => {
    const { src } = mkReactSkillsSource();
    const inc = collectIncoming(src, { stacks: STACK_PROFILES['java+react'].stacks, stack: 'java+react' });
    assert.equal(skillPaths(inc).filter((k) => REACT_SKILL_RE.test(k)).length, 2, 'as 2 skills react entram');
    assert.ok(skillPaths(inc).some((k) => k.includes('common-skill')), 'skill comum entra');
  });

  for (const dest of ['java+vue', 'node', 'outra']) {
    it(`nao entra em ${dest}: nenhuma skill react (Scenario 2)`, () => {
      const { src } = mkReactSkillsSource();
      const inc = collectIncoming(src, { stacks: STACK_PROFILES[dest].stacks, stack: dest });
      assert.deepEqual(skillPaths(inc).filter((k) => REACT_SKILL_RE.test(k)), [], `${dest} sem skill react`);
      assert.ok(skillPaths(inc).some((k) => k.includes('common-skill')), 'skill comum continua entrando');
    });
  }

  it('fallback documentado: as TAGS de `stacks` tambem gateiam a skill (sem preset)', () => {
    const { src } = mkReactSkillsSource();
    const inc = collectIncoming(src, { stacks: ['react'] });
    assert.equal(skillPaths(inc).filter((k) => REACT_SKILL_RE.test(k)).length, 2, 'tag react aceita');
  });

  it('SANGRA (Scenario 4): divergencia entre a declaracao de origem e o oraculo literal e detectada', () => {
    // NAO exercita `stacksFor`/`axes`: prova que o valor propagado pelo vendor e
    // comparado a um oraculo independente (a divergencia nao passa verde).
    const incoerentes = (m) => Object.keys(REACT_SKILLS).filter((n) => JSON.stringify(m[n]) !== JSON.stringify(REACT_SKILLS[n]));
    const coerente = stacksInLock(mkReactSkillsSource().lock, Object.keys(REACT_SKILLS));
    const divergente = stacksInLock(mkReactSkillsSource({ 'react-components': ['vue'] }).lock, Object.keys(REACT_SKILLS));
    assert.deepEqual(incoerentes(coerente), [], 'fixture coerente passa verde');
    assert.deepEqual(incoerentes(divergente), ['react-components'], 'divergencia de eixo nao passa verde');
  });
});

// Enumeracao RECURSIVA de `.agents/rules/**` (SPEC §5): subdiretorio entra na
// cobertura e o nome classificado e o caminho relativo sob `.agents/rules/`.
function realRuleNames() {
  const root = path.join(REPO_ROOT, '.agents', 'rules');
  const out = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(abs, r);
      else if (e.isFile()) out.push(r);
    }
  };
  walk(root, '');
  return out.sort();
}
function mkRulesSource(extra = {}) {
  const src = tmp('harness-eixos-rules-');
  for (const name of realRuleNames()) writeIn(src, `${RULES_PREFIX}${name}`, `# ${name}\n`);
  for (const [name, body] of Object.entries(extra)) writeIn(src, `${RULES_PREFIX}${name}`, body);
  return src;
}
function rulesIn(inc) {
  return Object.keys(inc)
    .filter((k) => k.startsWith(RULES_PREFIX))
    .map((k) => k.slice(RULES_PREFIX.length))
    .sort();
}

describe('EX-BE-05/EX-VAL-06 gating de .agents/rules/** pelo eixo declarado (RF-04/A2)', () => {
  it('java+react NAO recebe a prosa Vue; as demais rules entram (Scenario 1)', () => {
    const rules = rulesIn(collectIncoming(mkRulesSource(), { stacks: STACK_PROFILES['java+react'].stacks, stack: 'java+react' }));
    assert.ok(!rules.includes(FRONTEND_RULE), 'frontend-coding-standards.md fora do destino react');
    assert.deepEqual(rules, realRuleNames().filter((n) => n !== FRONTEND_RULE), 'todas as outras entram');
  });

  it('java+vue continua recebendo a prosa Vue (direcao positiva)', () => {
    const inc = collectIncoming(mkRulesSource(), { stacks: STACK_PROFILES['java+vue'].stacks, stack: 'java+vue' });
    assert.ok(rulesIn(inc).includes(FRONTEND_RULE));
  });

  it('NAO infere eixo por nome de arquivo (Scenario 2): rule react/vue nao declarada e comum', () => {
    const src = mkRulesSource({
      'frontend-react-standards.md': '# prosa react NAO declarada\n',
      'vue-specific-notes.md': '# prosa vue NAO declarada\n',
    });
    for (const stack of ['java+vue', 'java+react', 'node']) {
      const rules = rulesIn(collectIncoming(src, { stack }));
      assert.ok(rules.includes('frontend-react-standards.md'), `nome react nao gate sozinho (${stack})`);
      assert.ok(rules.includes('vue-specific-notes.md'), `nome vue nao gate sozinho (${stack})`);
    }
  });

  it('rule em SUBDIRETORIO nao declarada continua comum e entra (filtro nao da bail por "/")', () => {
    const src = mkRulesSource({ 'nested/deep.md': '# prosa aninhada nao declarada\n' });
    const rules = rulesIn(collectIncoming(src, { stack: 'java+react' }));
    assert.ok(rules.includes('nested/deep.md'), 'rule aninhada nao declarada entra');
    assert.deepEqual(rules, [...realRuleNames().filter((n) => n !== FRONTEND_RULE), 'nested/deep.md'].sort());
  });

  it('dir com nome de rule excluida NAO some do incoming (so o artefato declarado)', () => {
    const src = mkRulesSource({ 'nested/safe.md': '# ok\n' });
    const rules = rulesIn(collectIncoming(src, { stack: 'java+react' }));
    assert.ok(rules.includes('nested/safe.md'), 'subdir nao e afetado pela exclusao do artefato');
  });

  for (const dest of ['node', 'node-esm', 'outra', 'flutter', 'dart']) {
    it(`nao-regressao ${dest}: incoming de rules identico ao de hoje (Scenario 5/D-4b)`, () => {
      const inc = collectIncoming(mkRulesSource(), { stacks: STACK_PROFILES[dest].stacks, stack: dest });
      assert.deepEqual(rulesIn(inc), realRuleNames());
    });
  }
});

describe('EX-BE-05 CR-1: chave de RULES_BY_AXIS validada na carga e nunca inerte', () => {
  it('a declaracao real passa na validacao de carga (nao lanca)', () => {
    assert.doesNotThrow(() => validateRulesByAxis());
  });

  it('axisIdsFromAxes produz PARES <eixo>=<id> (nao ids soltos)', () => {
    assert.deepEqual([...ES_IDS('node')].sort(), ['backend=node', 'frontend=none']);
    assert.deepEqual([...ES_IDS('node-esm')].sort(), ['backend=node', 'frontend=none']);
    assert.deepEqual([...ES_IDS('dart')].sort(), ['backend=dart', 'frontend=none']);
    assert.deepEqual([...ES_IDS('java+react')].sort(), ['backend=java', 'frontend=react']);
    assert.deepEqual([...ES_IDS('java+vue')].sort(), ['backend=java', 'frontend=vue']);
    assert.deepEqual([...ES_IDS('flutter')].sort(), ['backend=flutter', 'frontend=flutter']);
    assert.deepEqual([...ES_IDS('outra')].sort(), ['backend=other', 'frontend=other']);
  });

  it('N-1: o match exige o PAR {eixo,id} — id compartilhado entre eixos NAO over-matcheia', () => {
    // `none` e id de FRONTEND em node/node-esm/dart; a chave e `backend=none`.
    const map = { 'backend=none': ['harness-config.md'] };
    for (const dest of ['node', 'node-esm', 'dart']) {
      assert.equal(
        ruleAllowedForAxes('.agents/rules/harness-config.md', ES_IDS(dest), map),
        true,
        `${dest}: 'backend=none' nao pode casar (o destino tem frontend=none)`,
      );
    }
    // O PAR certo dispara: `frontend=none` casa node/node-esm/dart.
    const rightPair = { 'frontend=none': ['harness-config.md'] };
    for (const dest of ['node', 'node-esm', 'dart']) {
      assert.equal(ruleAllowedForAxes('.agents/rules/harness-config.md', ES_IDS(dest), rightPair), false, `${dest}: frontend=none exclui`);
    }
    assert.equal(ruleAllowedForAxes('.agents/rules/harness-config.md', ES_IDS('java+vue'), rightPair), true, 'java+vue intacto');
  });

  it('chave valida de eixo BACKEND dispara (nao e inerte): backend=node exclui em node', () => {
    const map = { 'backend=node': ['harness-config.md'] };
    assert.equal(ruleAllowedForAxes('.agents/rules/harness-config.md', ES_IDS('node'), map), false, 'node: excluido');
    assert.equal(ruleAllowedForAxes('.agents/rules/harness-config.md', ES_IDS('java+vue'), map), true, 'java+vue: intacto');
    assert.equal(ruleAllowedForAxes('.agents/rules/harness-config.md', ES_IDS('node-esm'), map), false, 'node-esm: mesmo backend=node');
  });

  it('a declaracao real exclui a rule exatamente no par frontend=react', () => {
    const rel = `${RULES_PREFIX}${FRONTEND_RULE}`;
    assert.equal(ruleAllowedForAxes(rel, ES_IDS('java+react')), false, 'java+react: excluido');
    for (const dest of ['java+vue', 'node', 'node-esm', 'outra', 'flutter', 'dart']) {
      assert.equal(ruleAllowedForAxes(rel, ES_IDS(dest)), true, `${dest}: intacto`);
    }
  });

  it('chave valida frontend=vue dispara em java+vue (ids vem de `axes`, nao das tags)', () => {
    const map = { 'frontend=vue': [FRONTEND_RULE] };
    assert.equal(ruleAllowedForAxes(`${RULES_PREFIX}${FRONTEND_RULE}`, ES_IDS('java+vue'), map), false, 'java+vue: excluido');
    assert.equal(ruleAllowedForAxes(`${RULES_PREFIX}${FRONTEND_RULE}`, ES_IDS('java+react'), map), true, 'java+react: intacto');
  });

  it('chave valida com artefato ANINHADO classifica o caminho completo', () => {
    const map = { 'frontend=react': ['nested/deep.md'] };
    assert.equal(ruleAllowedForAxes('.agents/rules/nested/deep.md', ES_IDS('java+react'), map), false);
    assert.equal(ruleAllowedForAxes('.agents/rules/nested/deep.md', ES_IDS('java+vue'), map), true);
  });

  for (const [label, bad] of [
    ['eixo errado p/ o id (backend=react)', { 'backend=react': ['x.md'] }],
    ['id fora do conjunto fechado (frontend=blazor)', { 'frontend=blazor': ['x.md'] }],
    ['chave sem separador (frontendreact)', { frontendreact: ['x.md'] }],
    ['valor nao-array', { 'frontend=react': 'x.md' }],
    ['valor array vazio', { 'frontend=react': [] }],
  ]) {
    it(`declaracao invalida derruba a carga (fail-closed): ${label}`, () => {
      assert.throws(() => validateRulesByAxis(bad), (e) => e instanceof InstallError && e.code === 'BAD_DECLARATION');
    });
  }
});

describe('EX-BE-05 enumera .agents/rules/** (D5): cobertura total, recursiva e bidirecional', () => {
  const CLASSIFIED = new Set([...RULES_COMMON, ...Object.values(RULES_BY_AXIS).flat()]);
  const unclassified = (names) => names.filter((n) => !CLASSIFIED.has(n));
  const phantoms = (classified = CLASSIFIED) => [...classified].filter((n) => !realRuleNames().includes(n));

  it('disco -> lista: toda rule (recursiva) esta em RULES_COMMON ou em uma chave de RULES_BY_AXIS', () => {
    assert.deepEqual(unclassified(realRuleNames()), []);
  });

  it('lista -> disco: nenhum nome classificado e fantasma (bidirecional)', () => {
    assert.deepEqual(phantoms(), []);
  });

  it('SANGRA: rule nova nao classificada e reportada (guarda nao-vacuosa)', () => {
    assert.deepEqual(
      unclassified([...realRuleNames(), 'regra-nova-nao-classificada.md']),
      ['regra-nova-nao-classificada.md'],
    );
  });

  it('SANGRA: fantasma em RULES_COMMON e reportado (guarda nao-vacuosa)', () => {
    assert.deepEqual(phantoms(new Set([...CLASSIFIED, 'regra-fantasma.md'])), ['regra-fantasma.md']);
  });

  it('o mapa de exclusao e declarado por eixo, com id valido e artefato existente no disco', () => {
    validateRulesByAxis();
    for (const [key, artifacts] of Object.entries(RULES_BY_AXIS)) {
      const [axis, id] = key.split('=');
      assert.ok(AXIS_IDS[axis].includes(id), `id de eixo valido em '${key}'`);
      for (const a of artifacts) assert.ok(realRuleNames().includes(a), `'${a}' existe sob .agents/rules/**`);
    }
    assert.ok(Object.values(RULES_BY_AXIS).flat().includes(FRONTEND_RULE));
  });
});

// SPEC §6 (residual declarado; dono do tech-debt A-3): o destino `java+react`
// recebe 6 de 7 rules, mas N arquivos ENTREGUES citam a rule excluida => ref
// pendurada (o `doctor` desse destino reporta D6 SAUDAVEL: `config-ref-missing`
// so cobre evidence.schema/moduleMap). Mitigacao deste batch: CONGELAR a
// contagem — crescimento (ou queda) deixa a suite vermelha e obriga a decisao
// do dono (remover os indices e do `A-3`, nao deste ciclo).
const PENDING_REFS_REACT = 12;

describe('EX-VAL-06 residual: refs penduradas no destino java+react (SPEC §6)', () => {
  it(`congela em ${PENDING_REFS_REACT} os arquivos entregues que citam ${FRONTEND_RULE}`, () => {
    const inc = collectIncoming(REPO_ROOT, { stacks: STACK_PROFILES['java+react'].stacks, stack: 'java+react' });
    const rulePath = `${RULES_PREFIX}${FRONTEND_RULE}`;
    assert.ok(!(rulePath in inc) || !inc[rulePath], 'a rule excluida nao e entregue ao destino react');
    const refs = Object.entries(inc)
      .filter(([, body]) => body.includes(FRONTEND_RULE))
      .map(([rel]) => rel)
      .sort();
    assert.equal(
      refs.length,
      PENDING_REFS_REACT,
      `refs penduradas mudaram (agora ${refs.length}) — decisao do dono A-3: ${refs.join(', ')}`,
    );
  });
});
