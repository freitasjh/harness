// test-temp.mjs — utilitário COMUM de diretório temporário para as suítes
// deste repo (FU-43).
//
// Defeito que este módulo fecha: as specs criam mkdtempSync em os.tmpdir() /
// os.homedir() e nem sempre removem. Cada rodada da suite (e a suite roda
// 2x por ciclo de harness) acumulava lixo: medido em 2026-10-09, ~2057
// órfãos de prefixo do repo em /tmp antes desta correção.
//
// Regras do contrato (testadas em installer/__tests__/test-temp.spec.mjs):
//   R1. tmp() cria o dir, escreve os arquivos pedidos e REGISTRA o caminho.
//       cleanup() remove EXATAMENTE os caminhos registrados — nunca nome
//       solto, nunca glob.
//   R2. limpeza cobre o caminho de falha: o registro é removível a qualquer
//       momento, e a spec chama cleanup() em afterEach (e opcionalmente em
//       after()) — o hook roda mesmo quando o assert estoura.
//   R3. patterns de varredura é OPT-IN EXPLÍCITO. Sem pattern, sweep não
//       remove nada. Existe para órfãos criados por código de PRODUÇÃO
//       (ex.: backup), cujo nome a spec não controla. O caller passa o
//       regex da própria spec — prefixo frouxo vazaria para a spec vizinha
//       (dogfood vs dogfood-mobile rodam em paralelo).
//   R4. sweep só remove órfão DESTE run: guarda de mtime (since - 1s de
//       folga de relógio) impede apagar lixo de rodada anterior.
//   R5. sweep só varre os roots informados (default: os.tmpdir()).
//   R6. lstat, não stat: um atalho plantado num nome casante é desfeito sem
//       atravessar para o alvo (rmSync em symlink remove o elo, não a
//       árvore apontada).
//
// Fora do contrato, de propósito: nenhum path literal do projeto (o config
// manda resolver em harness.config.json — ADR-003) e nenhuma rede.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Folga de relógio na guarda de mtime: 1s cobre skew entre processos.
const MTIME_GRACE_MS = 1000;

function rmBestEffort(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Varre `roots` e remove entradas que casem algum `patterns` cujo mtime seja
 * deste run (mtimeMs >= since - MTIME_GRACE_MS).
 *
 * @param {RegExp[]} patterns lista FECHADA de patterns desta spec
 * @param {{since?: number, roots?: string[], removed?: string[]}} options
 * @returns {string[]} paths removidos (os que já não existiam não entram)
 */
export function sweepOrphans(patterns = [], { since = Date.now(), roots = [os.tmpdir()], removed = [] } = {}) {
  for (const root of roots) {
    let entries = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue; // root ausente/não legível: nada a varrer
    }
    for (const entry of entries) {
      if (!patterns.some((re) => re.test(entry.name))) continue;
      const candidate = path.join(root, entry.name);
      let st;
      try {
        st = fs.lstatSync(candidate); // R6: não segue atalho
      } catch {
        continue;
      }
      if (st.mtimeMs < since - MTIME_GRACE_MS) continue; // R4: não é deste run
      if (rmBestEffort(candidate)) removed.push(candidate);
    }
  }
  return removed;
}

/**
 * Cria um escopo de temp dono de um prefixo exclusivo.
 *
 * @param {{label: string, patterns?: RegExp[], roots?: string[]}} options
 *   label    — prefixo do mkdtemp (ex.: "harness-in01" ⇒ harness-in01-XXXXXX)
 *   patterns — patterns EXPLÍCITOS de varredura desta spec (default: nenhum)
 *   roots    — onde varrer (default: [os.tmpdir()])
 */
export function tempScope({ label, patterns = [], roots = [os.tmpdir()] } = {}) {
  if (typeof label !== "string" || label.length === 0) {
    throw new TypeError("tempScope exige label (prefixo exclusivo desta spec)");
  }
  const started = Date.now();
  const tracked = new Set();

  const tmp = (files = {}, { root = os.tmpdir() } = {}) => {
    const dir = fs.mkdtempSync(path.join(root, `${label}-`));
    tracked.add(dir);
    for (const [rel, content] of Object.entries(files)) {
      const file = path.join(dir, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    return dir;
  };

  const register = (...paths) => {
    for (const p of paths) if (typeof p === "string" && p.length > 0) tracked.add(p);
  };

  const sweep = () => sweepOrphans(patterns, { since: started, roots });

  const cleanup = () => {
    const removed = [];
    for (const target of [...tracked].reverse()) {
      if (rmBestEffort(target)) {
        tracked.delete(target);
        removed.push(target);
      }
    }
    for (const swept of sweep()) {
      if (!removed.includes(swept)) removed.push(swept);
    }
    return removed;
  };

  return { label, prefix: `${label}-`, started, tmp, register, sweep, cleanup };
}
