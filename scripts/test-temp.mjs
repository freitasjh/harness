// test-temp.mjs — utilitário COMUM de diretório temporário para as suítes
// deste repo (FU-43).
//
// Defeito que este módulo fecha: as specs criam mkdtempSync em os.tmpdir() /
// os.homedir() e nem sempre removem. Cada rodada da suite (e a suite roda
// 2x por ciclo de harness) acumulava lixo: medido em 2026-10-09, ~2057
// órfãos de prefixo do repo em /tmp antes desta correção.
//
// Regras do contrato (exercitadas pelas specs que o consomem):
//   R1. tmp() cria o dir, escreve os arquivos pedidos e REGISTRA o caminho.
//       cleanup() remove EXATAMENTE os caminhos registrados — nunca nome
//       solto, nunca glob.
//   R2. limpeza cobre o caminho de falha: o registro é removível a qualquer
//       momento, e a spec chama cleanup() em afterEach (e opcionalmente em
//       after()) — o hook roda mesmo quando o assert estoura.
//
// O que este módulo NÃO faz (removido no F1-fix, código morto sem caller): a
// varredura de órfãos por `patterns` (`sweepOrphans`/`sweep`). Nenhuma spec
// chamava as duas funções nem passava patterns — três regras de contrato
// (varredura opt-in, guarda de mtime, roots) descreviam um caminho que nunca
// rodou. Quem precisar de um path criado por código de produção o registra com
// `register(path)` e a limpeza o remove como qualquer outro.
//
// Fora do contrato, de propósito: nenhum path literal do projeto (o config
// manda resolver em harness.config.json — ADR-003) e nenhuma rede.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function rmBestEffort(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Cria um escopo de temp dono de um prefixo exclusivo.
 *
 * @param {{label: string}} options
 *   label — prefixo do mkdtemp (ex.: "harness-in01" ⇒ harness-in01-XXXXXX)
 */
export function tempScope({ label } = {}) {
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

  const cleanup = () => {
    const removed = [];
    for (const target of [...tracked].reverse()) {
      if (rmBestEffort(target)) {
        tracked.delete(target);
        removed.push(target);
      }
    }
    return removed;
  };

  return { label, prefix: `${label}-`, started, tmp, register, cleanup };
}
