// ratificacao-oraculo-48.mjs — ferramenta de PROVENIENCIA do baseline VAL-01.
//
// Deriva o literal canonico de cada um dos 48 pares a partir das tabelas
// ORACULO_* escritas a mao — as MESMAS de installer/__tests__/golden.spec.mjs
// (linhas 193-235) que espelham ORACULO_STACK_* de eixos-stack.spec.mjs:41-48.
//
// NENHUM valor esperado vem do gerador sob teste (generateConfig). Este modulo
// NAO importa installer-contract.mjs / generate-eixos.mjs: a autoridade e a
// tabela literal escrita a mao (C1), nunca a saida do gerador (RF-08/E1).
// O gerador compare-se ao oraculo SOMENTE no golden.spec (48 pares), como
// comparacao rotulada — nunca como origem de literal/sha256 (ADR-002 §2.4).
//
// Uso:
//   node installer/ratificacao-oraculo-48.mjs <backend> <frontend>
// Imprime o literal canonico (JSON de 1 linha) no stdout; sha256 = sha256(stdout).
// Ex.: node installer/ratificacao-oraculo-48.mjs java vue

import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ORACULO_TEXTO_BACKEND = Object.freeze({
  java: 'java backend', node: 'node backend', rust: 'rust backend', nestjs: 'nestjs backend',
  dart: 'dart backend', flutter: 'flutter backend', other: 'other backend', none: 'N/A — no backend axis',
});
export const ORACULO_TEXTO_FRONTEND = Object.freeze({
  vue: 'vue frontend', react: 'react frontend', dart: 'dart frontend', flutter: 'flutter frontend',
  other: 'other frontend', none: 'N/A — no frontend axis',
});
export const ORACULO_COMMANDS_BACKEND = Object.freeze({
  java: {}, node: { suiteFull: 'node --test', unit: 'node --test' }, rust: {}, nestjs: {},
  dart: { suiteFull: 'dart test', unit: 'dart test', analyze: 'dart analyze' },
  flutter: { suiteFull: 'flutter test', unit: 'flutter test', analyze: 'dart analyze' },
  other: {}, none: {},
});
export const ORACULO_MODULEMAP_EXTRA_BACKEND = Object.freeze({
  java: {}, node: {}, rust: {}, nestjs: {},
  dart: { lib: 'lib', test: 'test' }, flutter: { lib: 'lib', test: 'test' }, other: {}, none: {},
});
export const ORACULO_MCP_FRONTEND = Object.freeze({
  vue: ['chrome-devtools'], react: ['chrome-devtools'], dart: ['dart'],
  flutter: ['marionette_mcp', 'dart'], other: [], none: [],
});
export const ORACULO_STACK_BACKEND = Object.freeze({
  java: [], node: [], rust: ['rust'], nestjs: ['nestjs'],
  dart: ['dart'], flutter: [], other: [], none: [],
});
export const ORACULO_STACK_FRONTEND = Object.freeze({
  vue: [], react: ['react'], dart: [], flutter: [], other: [], none: [],
});
export const ORACULO_EXCECAO_STACKS = Object.freeze({ 'flutter+flutter': ['flutter', 'dart'] });
export const ORACULO_INVARIANTES = Object.freeze({
  moduleMapBase: Object.freeze({ plugins: '.opencode/plugins', rules: '.agents/rules', schemas: '.agents/schemas' }),
  infra: Object.freeze({ composeFile: null, ports: Object.freeze({ backend: null, frontend: null }) }),
  protectedPaths: Object.freeze([
    '.opencode/plugins/**', '.agents/rules/**', '.agents/schemas/**', '.agents/agents/**',
    'opencode.json', 'harness.config.json',
  ]),
  gates: Object.freeze({ picco: 'enforce', evidence: 'enforce', hitlBatch: 'enforce', e2eGreenfield: 'warn' }),
  riskPaths: Object.freeze(['**/security/**', '**/auth/**']),
  escalateOnRisk: Object.freeze({ e2eGreenfield: 'enforce', evidenceScenario: 'required' }),
  contraproveTimeoutMs: 900000,
  evidence: Object.freeze({ path: 'harness/', schema: '.agents/schemas/harness-report.schema.json' }),
});

export function stacksEsperados(backend, frontend) {
  const chave = `${backend}+${frontend}`;
  if (Object.prototype.hasOwnProperty.call(ORACULO_EXCECAO_STACKS, chave)) {
    return [...ORACULO_EXCECAO_STACKS[chave]];
  }
  return [...ORACULO_STACK_BACKEND[backend], ...ORACULO_STACK_FRONTEND[frontend]];
}

export function esperadoPorEixo(backend, frontend) {
  return {
    version: 1,
    project: 'demo',
    stack: { backend: ORACULO_TEXTO_BACKEND[backend], frontend: ORACULO_TEXTO_FRONTEND[frontend] },
    moduleMap: { ...ORACULO_INVARIANTES.moduleMapBase, ...ORACULO_MODULEMAP_EXTRA_BACKEND[backend] },
    commands: { ...ORACULO_COMMANDS_BACKEND[backend] },
    infra: { composeFile: null, ports: { ...ORACULO_INVARIANTES.infra.ports } },
    mcp: { required: [...ORACULO_MCP_FRONTEND[frontend]] },
    protectedPaths: [...ORACULO_INVARIANTES.protectedPaths],
    gates: { ...ORACULO_INVARIANTES.gates },
    riskPaths: [...ORACULO_INVARIANTES.riskPaths],
    escalateOnRisk: { ...ORACULO_INVARIANTES.escalateOnRisk },
    contraproveTimeoutMs: ORACULO_INVARIANTES.contraproveTimeoutMs,
    evidence: { ...ORACULO_INVARIANTES.evidence },
  };
}

// literal canonico = JSON do esperado, sem o campo auxiliar _stacks.
export function literalCanonico(backend, frontend) {
  return JSON.stringify(esperadoPorEixo(backend, frontend));
}

export function sha256(texto) {
  return createHash('sha256').update(texto).digest('hex');
}

const invocadoDireto = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invocadoDireto) {
  const [backend, frontend] = process.argv.slice(2);
  if (!Object.prototype.hasOwnProperty.call(ORACULO_TEXTO_BACKEND, backend || '')
    || !Object.prototype.hasOwnProperty.call(ORACULO_TEXTO_FRONTEND, frontend || '')) {
    console.error('Uso: node installer/ratificacao-oraculo-48.mjs <backend> <frontend>');
    process.exit(2);
  }
  process.stdout.write(literalCanonico(backend, frontend) + '\n');
}
