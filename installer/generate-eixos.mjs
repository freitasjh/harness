// Gerador de config por eixos — ADR-001 §3 itens 4/5 (SPEC RF-04/RF-05).
// Fonte única de composição: eixos.mjs (inventário fechado) + compose.mjs
// (commands/moduleMap do backend, mcp/stacks/skills do frontend).
// Textos são derivados do id de cada eixo por template — nenhuma tabela de
// rótulos por combinação. Invariantes do harness são literais congelados do
// baseline; nenhum campo de infra/gates/risk/evidence é inventado aqui.
// Módulo puro: sem I/O, sem subprocesso, sem seleção por nome de combinação.

import { assertAxisPair } from './eixos.mjs';
import { composeAxes } from './compose.mjs';

export class GeradorConfigError extends Error {
  constructor(message, code = 'BAD_CONFIG_INPUT') {
    super(message);
    this.name = 'GeradorConfigError';
    this.code = code;
  }
}

const INVARIANTES = Object.freeze({
  moduleMapBase: Object.freeze({
    plugins: '.opencode/plugins',
    rules: '.agents/rules',
    schemas: '.agents/schemas',
  }),
  infra: Object.freeze({
    composeFile: null,
    ports: Object.freeze({ backend: null, frontend: null }),
  }),
  protectedPaths: Object.freeze([
    '.opencode/plugins/**',
    '.agents/rules/**',
    '.agents/schemas/**',
    '.agents/agents/**',
    'opencode.json',
    'harness.config.json',
  ]),
  gates: Object.freeze({
    picco: 'enforce',
    evidence: 'enforce',
    hitlBatch: 'enforce',
    e2eGreenfield: 'warn',
  }),
  riskPaths: Object.freeze(['**/security/**', '**/auth/**']),
  escalateOnRisk: Object.freeze({
    e2eGreenfield: 'enforce',
    evidenceScenario: 'required',
  }),
  contraproveTimeoutMs: 900000,
  evidence: Object.freeze({
    path: 'harness/',
    schema: '.agents/schemas/harness-report.schema.json',
  }),
});

function textoDoEixo(eixo, id) {
  if (id === 'none') return `N/A — no ${eixo} axis`;
  return `${id} ${eixo}`;
}

export function generateConfig(entrada = {}) {
  const project = entrada && entrada.project;
  if (typeof project !== 'string' || project.trim() === '') {
    throw new GeradorConfigError('project required', 'BAD_PROJECT');
  }
  const axes = entrada && entrada.axes;
  assertAxisPair(axes);

  const { backend, frontend, commands, moduleMap, mcp } = composeAxes(axes);

  return {
    version: 1,
    project,
    stack: {
      backend: textoDoEixo('backend', backend),
      frontend: textoDoEixo('frontend', frontend),
    },
    moduleMap: { ...INVARIANTES.moduleMapBase, ...moduleMap },
    commands: { ...commands },
    infra: { composeFile: INVARIANTES.infra.composeFile, ports: { ...INVARIANTES.infra.ports } },
    mcp: { required: [...mcp] },
    protectedPaths: [...INVARIANTES.protectedPaths],
    gates: { ...INVARIANTES.gates },
    riskPaths: [...INVARIANTES.riskPaths],
    escalateOnRisk: { ...INVARIANTES.escalateOnRisk },
    contraproveTimeoutMs: INVARIANTES.contraproveTimeoutMs,
    evidence: { ...INVARIANTES.evidence },
  };
}
