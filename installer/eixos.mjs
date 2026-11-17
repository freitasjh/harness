// Inventário fechado de eixos — ADR-001 §3 item 1 / SPEC RF-01 (EIX-01).
// 8 backends × 6 frontends = 48 combinações. Conjuntos literais, imutáveis e
// deriváveis por produto cartesiano: nenhuma tabela de 48 escrita à mão, nenhum
// preset casado, nenhuma op de CLI visual (ADR-002). Módulo puro: zero imports,
// zero I/O, nenhuma dependência de registry/oráculo/runtime.
//
// Exceção mobile DECLARADA, nunca inferida do nome: `dart`/`flutter` são ids
// legítimos nos dois eixos, e o par `flutter+flutter` carrega a única entrada
// da tabela de exceções. Nenhuma heurística por substring ou rótulo.

export class EixoInvalidoError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EixoInvalidoError';
    this.code = 'INVALID_AXIS_PAIR';
  }
}

export const BACKEND_IDS = Object.freeze([
  'java', 'node', 'rust', 'nestjs', 'dart', 'flutter', 'other', 'none',
]);

export const FRONTEND_IDS = Object.freeze([
  'vue', 'react', 'dart', 'flutter', 'other', 'none',
]);

export const MOBILE_AXIS_IDS = Object.freeze(['dart', 'flutter']);

export const EIXOS = Object.freeze({
  backend: BACKEND_IDS,
  frontend: FRONTEND_IDS,
});

export function pairKey(axes) {
  if (!axes || typeof axes !== 'object'
    || typeof axes.backend !== 'string' || typeof axes.frontend !== 'string') {
    throw new EixoInvalidoError('par de eixos inválido: esperado { backend, frontend }');
  }
  return `${axes.backend}+${axes.frontend}`;
}

export const AXIS_PAIRS = Object.freeze(
  BACKEND_IDS.flatMap((backend) => FRONTEND_IDS.map((frontend) => Object.freeze({ backend, frontend }))),
);

export const PAIR_KEYS = Object.freeze(AXIS_PAIRS.map(pairKey));

export const MOBILE_PAIR_EXCEPTIONS = Object.freeze({
  'flutter+flutter': Object.freeze(['flutter', 'dart']),
});

export function isKnownAxisId(axis, id) {
  const ids = EIXOS[axis];
  return Array.isArray(ids) && ids.includes(id);
}

export function isValidAxisPair(axes) {
  try {
    return PAIR_KEYS.includes(pairKey(axes));
  } catch {
    return false;
  }
}

export function assertAxisPair(axes) {
  if (!isValidAxisPair(axes)) {
    let descricao = 'forma inválida';
    try { descricao = pairKey(axes); } catch { /* forma inválida */ }
    throw new EixoInvalidoError(
      `par de eixos fora do inventário: ${descricao} (8 backends × 6 frontends = 48)`,
    );
  }
  return axes;
}

export function exceptionForPair(axes) {
  assertAxisPair(axes);
  const chave = pairKey(axes);
  const valor = Object.prototype.hasOwnProperty.call(MOBILE_PAIR_EXCEPTIONS, chave)
    ? MOBILE_PAIR_EXCEPTIONS[chave]
    : null;
  return valor === null ? null : [...valor];
}
