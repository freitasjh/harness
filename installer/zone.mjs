// installer/zone.mjs — primitivas da zona autorizada /tmp (FU-42).
// Modulo folha (so `node:*`): mede a zona por REALPATH, nunca pelo path
// escrito. Usado pelas DUAS pontas que precisam da MESMA medida:
//   - `assertDogfoodTarget` (install.mjs): trava de ESCRITA do dogfood;
//   - `classifyRemoval`/`isInsideTmp` (dogfood-common.mjs): trava de REMOCAO.
// Um corpo unico para a mesma politica: se as duas medidas divergissem, uma
// ponta escreveria onde a outra remove — exatamente o defeito do tech-debt
// `dogfood-write-zone-symlink`.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let TMP_REAL = undefined;

// `/tmp` como o SO ve. No macOS `/tmp` e `/var` sao atalhos
// (`/var/folders/...` -> `/private/var/folders/...`): comparar o path escrito
// com o real daria falso positivo nos dois sentidos. `null` = zona
// desconhecida => fail-closed: nada passa.
export function tmpRealRoot() {
  if (TMP_REAL === undefined) {
    try {
      TMP_REAL = fs.realpathSync(os.tmpdir());
    } catch {
      TMP_REAL = null;
    }
  }
  return TMP_REAL;
}

// Path como o sistema de arquivos ve, MESMO quando o alvo ainda nao existe:
// resolve o ancestral existente mais fundo e reanexa a cauda que falta. Sem
// isso um alvo legitimo e ainda nao criado (`/tmp/harness-dogfood-<stamp>`)
// cairia no fallback lexical e, no macOS, nao bateria com o tmp real.
// Atalho pendurado no meio do caminho: a cauda e anexada ao que foi provado
// (quem escreve vai falhar no `mkdir`; a trava de atalho pendurado —
// `danglingSymlinkInPath` — nega o caso antes).
export function realOrResolved(p) {
  const abs = path.resolve(p);
  let rest = '';
  let cur = abs;
  for (;;) {
    try {
      return rest === '' ? fs.realpathSync(cur) : path.join(fs.realpathSync(cur), rest);
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return abs; // raiz alcancada: nada a resolver
      rest = path.join(path.basename(cur), rest);
      cur = parent;
    }
  }
}

// Igual ou dentro de `dir` — nome de diretorio exato, nunca prefixo de string
// (`/tmpevil` nao e `/tmp`).
export function insideDir(real, dir) {
  return real === dir || real.startsWith(dir + path.sep);
}

// Zona autorizada = realpath(os.tmpdir()). `false` quando a zona e
// desconhecida: duvida => fora.
export function isInsideTmp(p) {
  const tmp = tmpRealRoot();
  return Boolean(tmp) && insideDir(realOrResolved(p), tmp);
}

// Primeiro componente do caminho (da raiz para a folha) que existe, e atalho e
// NAO resolve (referente inexistente). Destino nao provavel => fail-closed:
// negar antes de escrever e melhor que erro confuso de `mkdir` depois.
// Para no primeiro componente inexistente — o resto ainda sera criado.
// `null` = caminho provavel (ou ainda nao criado, o caso normal do alvo).
export function danglingSymlinkInPath(p) {
  const abs = path.resolve(p);
  const { root } = path.parse(abs);
  const parts = abs.slice(root.length).split(path.sep).filter(Boolean);
  let cur = root;
  for (const part of parts) {
    cur = path.join(cur, part);
    let st;
    try {
      st = fs.lstatSync(cur);
    } catch {
      return null;
    }
    if (st.isSymbolicLink()) {
      try {
        fs.realpathSync(cur);
      } catch {
        return cur;
      }
    }
  }
  return null;
}
