// merge-v2-only.spec.mjs — ciclo `opencode-v2-only`, RF-04 (Batch 2).
//
// O merge do instalador TEM de deixar o destino v2-only — tanto em instalacao
// nova quanto na via de UPGRADE (destino que ja tinha o shape v1/dual). Defeito
// de produto que este arquivo trava:
//   (1) `plugin`/`plugins` por SUBSTITUICAO => o destino PERDE os pacotes npm
//       do usuario (a chave e a lista de pacotes, NAO um bloco do harness);
//   (2) chaves obsoletas (`agents`/`system`/`permissions`/`server`) removidas
//       por NOME => destroi shape nativo bem-formado do usuario;
//   (3) `agent`/`permission` divergentes marcados como CONFLITO humano =>
//       `init` aborta com `flagged-open` por um bloco que e do PROPRIO harness.
//
// Decisao do owner (2026-10-19): o bloco que o harness gera (`agent`,
// `permission`) e SUBSTITUIDO pelo incoming; `plugin`/`plugins` sao a lista de
// PACOTES npm (SPEC §0) — o merge so REMOVE dali o path local do harness
// (`.opencode/plugins/`, auto-carregado) e une o resto. O que e do usuario
// (`mcp` extra, `instructions` proprias, npm) continua *only-add*.
//
// Correcao do review (Batch 2, 2026-10-19): C1 (npm do usuario), A1 (remocao
// por FORMA), A2 (`noop` pelo efeito), B2 (assertar codigo+plano, nao regex na
// mensagem).
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  mergeOpencodeJson,
  planMerge,
  applyMerge,
  assertCreateOnly,
  InstallError,
} from '../install.mjs';

let dirs = [];
function mkTarget(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-v2only-'));
  dirs.push(d);
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return d;
}
afterEach(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); dirs = []; });

// O `opencode.json` DESTE repo ja e v2-only => e o "incoming" esperado.
const TEMPLATE_TEXT = fs.readFileSync(new URL('../../opencode.json', import.meta.url), 'utf8');
const TEMPLATE = JSON.parse(TEMPLATE_TEXT);

const HARNESS_LOCAL_RE = /^\.?\/?\.opencode\/plugins\//;

// Shape v1/dual COMPLETO: `plugin` MISTO (paths locais do harness + path local
// do usuario + npm + dual `{id,path}` + `{package,options}`) + `plugins[]` +
// `agents`/`system` + `permissions` (mapa) + `agent` SEM `description`.
function dualConfig() {
  return {
    $schema: 'https://opencode.ai/config.json',
    plugin: [
      '.opencode/plugins/gate.js',
      '.opencode/plugins/hitl-guardrail.js',
      './plugins/caveman/plugin.js',
      'some-npm-plugin',
      { id: './.opencode/plugins/dual.js', path: './.opencode/plugins/dual.js' },
      { package: 'opencode-toon-plugin', options: { x: 1 } },
    ],
    plugins: ['legacy-npm-plugin'],
    agents: {
      orchestrator: { mode: 'primary', tools: { write: false, edit: false } },
      'developer-engineer': { mode: 'subagent', tools: { write: true, edit: true } },
    },
    system: { prompt: 'legacy system prompt' },
    permissions: { bash: 'allow' },
    server: { port: 4599 },
    agent: {
      orchestrator: {
        mode: 'primary',
        prompt: '{file:./.agents/agents/orchestrator/AGENT.md}',
        tools: { write: false, edit: false },
      },
    },
    instructions: ['.agents/rules/*.md'],
  };
}

// Nenhuma entrada de `plugin`/`plugins` pode continuar apontando para o path
// local do harness (o alvo real da remocao — nunca o array inteiro).
function assertNoHarnessLocalPlugin(cfg) {
  for (const e of [...(cfg.plugin || []), ...(cfg.plugins || [])]) {
    const s = typeof e === 'string' ? e : (e && (e.path || e.source || e.file));
    assert.ok(!(typeof s === 'string' && HARNESS_LOCAL_RE.test(s)),
      `entrada local do harness removida: ${JSON.stringify(e)}`);
  }
}

// Asserta o contrato v2-only medido (SPEC §0/RF-04).
function assertV2Only(cfg) {
  for (const k of ['agents', 'system', 'permissions', 'server']) {
    assert.ok(!(k in cfg), `chave v1/dual '${k}' removida pelo merge`);
  }
  assert.ok(cfg.agent && typeof cfg.agent === 'object', 'chave `agent` (singular) presente');
  for (const [name, entry] of Object.entries(cfg.agent)) {
    assert.equal(typeof entry.description, 'string', `agent.${name}.description presente`);
    assert.ok(entry.description.length > 0, `agent.${name}.description nao-vazia`);
    assert.ok(entry.permission && typeof entry.permission === 'object', `agent.${name}.permission presente`);
  }
  assert.ok(cfg.permission && typeof cfg.permission === 'object', 'chave `permission` presente');
  assertNoHarnessLocalPlugin(cfg);
}

// ---------------------------------------------------------------------------
describe('RF-04/T1: destino com shape v1/dual => resultado v2-only (via de UPGRADE)', () => {
  it('mergeOpencodeJson remove o shape dual e substitui o bloco gerenciado', () => {
    const { merged } = mergeOpencodeJson(dualConfig(), TEMPLATE);
    assertV2Only(merged);
    assert.equal(merged.agent.orchestrator.description, TEMPLATE.agent.orchestrator.description, 'agent vem do incoming');
    assert.deepEqual(merged.permission, TEMPLATE.permission, 'permission vem do incoming');
  });

  it('C1: o npm do usuario SOBREVIVE e so o path local do harness sai', () => {
    const { merged } = mergeOpencodeJson(dualConfig(), TEMPLATE);
    assert.deepEqual(merged.plugin, [
      './plugins/caveman/plugin.js',
      'some-npm-plugin',
      { package: 'opencode-toon-plugin', options: { x: 1 } },
    ], 'npm + path local do USUARIO ficam; paths do harness saem');
    assert.deepEqual(merged.plugins, ['legacy-npm-plugin'], '`plugins` (npm) preservado, nunca substituido');
  });

  it('planMerge+applyMerge (upgrade): arquivo no disco vira v2-only', () => {
    const target = mkTarget({ 'opencode.json': JSON.stringify(dualConfig(), null, 2) });
    const plan = planMerge(target, { 'opencode.json': TEMPLATE_TEXT });
    const step = plan.find((p) => p.path === 'opencode.json');
    assert.equal(step.action, 'merge', 'destino dual => merge (nunca flag de conflito)');
    const res = applyMerge(target, plan, { incomingFiles: { 'opencode.json': TEMPLATE_TEXT } });
    assert.equal(res.written.length, 1);
    const onDisk = JSON.parse(fs.readFileSync(path.join(target, 'opencode.json'), 'utf8'));
    assertV2Only(onDisk);
  });
});

// ---------------------------------------------------------------------------
describe('RF-04/T2: destino SEM opencode.json => recebe o template (propagacao preservada)', () => {
  it('planMerge => create; applyMerge grava o template verbatim', () => {
    const target = mkTarget({});
    const plan = planMerge(target, { 'opencode.json': TEMPLATE_TEXT });
    assert.equal(plan[0].action, 'create');
    applyMerge(target, plan, { incomingFiles: { 'opencode.json': TEMPLATE_TEXT } });
    assert.equal(fs.readFileSync(path.join(target, 'opencode.json'), 'utf8'), TEMPLATE_TEXT);
  });
});

// ---------------------------------------------------------------------------
describe('RF-04/T3: chaves do USUARIO preservadas (only-add)', () => {
  it('mcp extra do destino mantido + `required` unido; `instructions` proprias mantidas', () => {
    const existing = {
      ...dualConfig(),
      mcp: { required: ['chrome-devtools'], extra: { url: 'http://localhost:3333' } },
      instructions: ['.agents/rules/*.md', '.agents/rules/custom.md'],
    };
    const incoming = { ...TEMPLATE, mcp: { required: ['dart'] } };
    const { merged } = mergeOpencodeJson(existing, incoming);
    assertV2Only(merged);
    assert.deepEqual(merged.mcp.required, ['chrome-devtools', 'dart'], '`required` unido (only-add)');
    assert.deepEqual(merged.mcp.extra, { url: 'http://localhost:3333' }, 'mcp extra do usuario preservado');
    assert.ok(merged.instructions.includes('.agents/rules/custom.md'), 'instructions proprias do destino mantidas');
    assert.ok(merged.instructions.includes('.agents/rules/*.md'), 'instructions do harness presentes');
  });
});

// ---------------------------------------------------------------------------
describe('RF-04/T4: idempotencia — merge 2x => 2a vez noop', () => {
  it('1o planMerge => merge; 2o => noop (nada muda)', () => {
    const target = mkTarget({ 'opencode.json': JSON.stringify(dualConfig(), null, 2) });
    const p1 = planMerge(target, { 'opencode.json': TEMPLATE_TEXT });
    assert.equal(p1.find((p) => p.path === 'opencode.json').action, 'merge');
    applyMerge(target, p1, { incomingFiles: { 'opencode.json': TEMPLATE_TEXT } });
    const afterFirst = fs.readFileSync(path.join(target, 'opencode.json'), 'utf8');
    const p2 = planMerge(target, { 'opencode.json': TEMPLATE_TEXT });
    assert.equal(p2.find((p) => p.path === 'opencode.json').action, 'noop', '2a vez noop');
    assert.equal(fs.readFileSync(path.join(target, 'opencode.json'), 'utf8'), afterFirst, 'arquivo intacto');
  });
});

// ---------------------------------------------------------------------------
describe('RF-04/T5: bloco gerenciado => merge, nunca conflito de agent/permission', () => {
  it('divergencia do bloco gerenciado nao gera flag; o create-only aborta por MERGE, nao por conflito', () => {
    const target = mkTarget({ 'opencode.json': JSON.stringify(dualConfig(), null, 2) });
    const plan = planMerge(target, { 'opencode.json': TEMPLATE_TEXT });
    const step = plan.find((p) => p.path === 'opencode.json');
    assert.equal(step.action, 'merge', 'o harness substitui o proprio bloco => merge deterministico');
    assert.ok(!plan.some((p) => p.action === 'flag'), 'nenhum flag de conflito agent/permission');
    // B2 (review): assertar o CODIGO + o PLANO, nunca regex na mensagem. O gate
    // create-only continua exigindo destino limpo, mas o motivo e o MERGE
    // (write em destino nao-limpo) — nunca um conflito humano pendente.
    let err = null;
    try { assertCreateOnly(plan); } catch (e) { err = e; }
    assert.ok(err instanceof InstallError, 'destino nao-limpo continua abortando');
    assert.equal(err.code, 'flagged-open');
    const offenders = plan.filter((p) => p.action === 'merge' || p.action === 'flag');
    assert.deepEqual(offenders.map((p) => p.action), ['merge'], 'o unico motivo do abort e o merge');
  });
});

// ---------------------------------------------------------------------------
describe('RF-04/T6 (A2): convergencia pelo EFEITO => noop (nao aborta)', () => {
  it('destino convergido COM chave propria do usuario => 2o planMerge = noop e create-only passa', () => {
    // Chave que o merge nunca escreve (only-add de host): torna
    // `canon(existing) !== canon(incoming)` para sempre — e era isso que fazia
    // o `noop` por TEXTO nunca acontecer => `init` abortava `flagged-open`.
    const target = mkTarget({
      'opencode.json': JSON.stringify({
        ...dualConfig(),
        mcp: { servers: { x: { type: 'local', command: ['x'] } } },
      }, null, 2),
    });
    const p1 = planMerge(target, { 'opencode.json': TEMPLATE_TEXT });
    assert.equal(p1.find((p) => p.path === 'opencode.json').action, 'merge', '1a passada converge');
    applyMerge(target, p1, { incomingFiles: { 'opencode.json': TEMPLATE_TEXT } });

    const p2 = planMerge(target, { 'opencode.json': TEMPLATE_TEXT });
    assert.equal(p2.find((p) => p.path === 'opencode.json').action, 'noop', '2a passada = ponto fixo => noop');
    assert.doesNotThrow(() => assertCreateOnly(p2), 'destino convergido nao aborta flagged-open');
    const onDisk = JSON.parse(fs.readFileSync(path.join(target, 'opencode.json'), 'utf8'));
    assert.deepEqual(onDisk.mcp.servers, { x: { type: 'local', command: ['x'] } }, 'chave do usuario intacta');
  });
});

// ---------------------------------------------------------------------------
describe('RF-04/T7 (A1): remocao por FORMA — shape NATIVO do usuario sobrevive', () => {
  it('`permissions` array nativo + `agents` mapa nativo (sem `tools`) nao sao removidos', () => {
    // Medicao (`opencode debug config`, runtime v2.0.32): `permissions` (array
    // de {action,resource,effect}) e `agents` (mapa de ConfigAgent.Info) SAO
    // chaves nativas — so a FORMA do harness cai.
    const existing = {
      plugin: [],
      permissions: [{ action: 'shell', resource: '*', effect: 'deny' }],
      agents: { 'probe-native': { description: 'agente nativo do usuario', mode: 'subagent', system: 'voce e um probe' } },
    };
    const { merged } = mergeOpencodeJson(existing, { agent: {}, permission: {} });
    assert.deepEqual(merged.permissions, [{ action: 'shell', resource: '*', effect: 'deny' }], 'permissions nativo (array) preservado');
    assert.ok(merged.agents && merged.agents['probe-native'], 'agents nativo (mapa sem `tools`) preservado');
  });

  it('a forma do harness (permissions mapa, agents com `tools`) cai', () => {
    const { merged } = mergeOpencodeJson(dualConfig(), TEMPLATE);
    assert.ok(!('permissions' in merged) && !('agents' in merged), 'shape v1/dual removido');
  });
});

// ---------------------------------------------------------------------------
describe('RF-04/T8: filtro do path local do harness e cirurgico', () => {
  it('`./plugins/caveman/plugin.js` (local do USUARIO) sobrevive; `.opencode/plugins/**` sai', () => {
    const existing = {
      plugin: [
        './plugins/caveman/plugin.js',
        './.opencode/plugins/gate.js',
        '.opencode/plugins/gate.js',
        'npm-specifier',
      ],
      plugins: [{ package: 'opencode-toon-plugin', options: {} }],
    };
    const { merged } = mergeOpencodeJson(existing, {});
    assert.deepEqual(merged.plugin, ['./plugins/caveman/plugin.js', 'npm-specifier'], 'so o path do harness sai');
    assert.deepEqual(merged.plugins, [{ package: 'opencode-toon-plugin', options: {} }], '`{package,options}` intacto');
  });
});
