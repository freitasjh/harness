// Composição de config por eixo — ADR-001 §3 itens 2/3 (SPEC RF-02/RF-03).
// Origem dos campos:
//   commands, moduleMap        → eixo BACKEND
//   mcp, stacks, skills, rules → eixo FRONTEND (+ backend quando aplicável)
// Dados por eixo vêm de tabelas indexadas pelo ID do eixo (8 + 6 entradas),
// nunca de perfis casados. skills/rules são derivados dos mapas do registry
// congelado, não do nome do preset. A exceção mobile vem do registry/eixos,
// nunca re-declarada aqui. Módulo puro: sem I/O, subprocesso ou escrita.

import { assertAxisPair, BACKEND_IDS, FRONTEND_IDS } from './eixos.mjs';
import {
  RULES_BY_AXIS,
  RULES_COMMON,
  SKILLS_BY_AXIS,
  SKILLS_COMMON,
} from './contract-registry.mjs';
import { axisIdsFromAxes, stacksFor } from './contract-pure.mjs';

const COMMANDS_BY_BACKEND = Object.freeze({
  java: Object.freeze({}),
  node: Object.freeze({ suiteFull: 'node --test', unit: 'node --test' }),
  rust: Object.freeze({}),
  nestjs: Object.freeze({}),
  dart: Object.freeze({ suiteFull: 'dart test', unit: 'dart test', analyze: 'dart analyze' }),
  flutter: Object.freeze({ suiteFull: 'flutter test', unit: 'flutter test', analyze: 'dart analyze' }),
  other: Object.freeze({}),
  none: Object.freeze({}),
});

const MODULEMAP_BY_BACKEND = Object.freeze({
  java: Object.freeze({}),
  node: Object.freeze({}),
  rust: Object.freeze({}),
  nestjs: Object.freeze({}),
  dart: Object.freeze({ lib: 'lib', test: 'test' }),
  flutter: Object.freeze({ lib: 'lib', test: 'test' }),
  other: Object.freeze({}),
  none: Object.freeze({}),
});

const MCP_BY_FRONTEND = Object.freeze({
  vue: Object.freeze(['chrome-devtools']),
  react: Object.freeze(['chrome-devtools']),
  dart: Object.freeze(['dart']),
  flutter: Object.freeze(['marionette_mcp', 'dart']),
  other: Object.freeze([]),
  none: Object.freeze([]),
});

function assertBackend(backend) {
  if (typeof backend !== 'string' || !BACKEND_IDS.includes(backend)) {
    throw new RangeError(`backend fora do inventário de eixos: ${String(backend)} (8 backends)`);
  }
  return backend;
}

function assertFrontend(frontend) {
  if (typeof frontend !== 'string' || !FRONTEND_IDS.includes(frontend)) {
    throw new RangeError(`frontend fora do inventário de eixos: ${String(frontend)} (6 frontends)`);
  }
  return frontend;
}

export function commandsForBackend(backend) {
  return { ...COMMANDS_BY_BACKEND[assertBackend(backend)] };
}

export function moduleMapForBackend(backend) {
  return { ...MODULEMAP_BY_BACKEND[assertBackend(backend)] };
}

export function mcpForFrontend(frontend) {
  return [...MCP_BY_FRONTEND[assertFrontend(frontend)]];
}

export function stacksForAxes(axes) {
  assertAxisPair(axes);
  return stacksFor(axes);
}

function artifactsForAxes(axes, byAxis, common) {
  assertAxisPair(axes);
  const keys = axisIdsFromAxes(axes);
  const out = [...common];
  for (const [key, nomes] of Object.entries(byAxis)) {
    if (keys.has(key)) out.push(...nomes);
  }
  return [...new Set(out)];
}

export function skillsForAxes(axes, registry = {}) {
  return artifactsForAxes(
    axes,
    registry.skillsByAxis ?? SKILLS_BY_AXIS,
    registry.skillsCommon ?? SKILLS_COMMON,
  );
}

export function rulesForAxes(axes, registry = {}) {
  return artifactsForAxes(
    axes,
    registry.rulesByAxis ?? RULES_BY_AXIS,
    registry.rulesCommon ?? RULES_COMMON,
  );
}

export function composeAxes(axes) {
  assertAxisPair(axes);
  return Object.freeze({
    backend: axes.backend,
    frontend: axes.frontend,
    commands: commandsForBackend(axes.backend),
    moduleMap: moduleMapForBackend(axes.backend),
    mcp: mcpForFrontend(axes.frontend),
    stacks: stacksForAxes(axes),
    skills: skillsForAxes(axes),
    rules: rulesForAxes(axes),
  });
}
