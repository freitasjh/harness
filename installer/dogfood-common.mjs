// installer/dogfood-common.mjs — base compartilhada dos dogfoods (IN-07 e
// IM-VAL-06). Zero rede. Nunca pkill -f. Nunca remove path fora do /tmp
// autorizado.
//
// Tres provas vivem aqui, e cada uma fecha um defeito destrutivo:
//   C1  `porcelainPaths`: parser do `git status --porcelain -z` (NUL, sem
//       C-quoting). O parser antigo (slice/lastIndexOf(' -> ')/unquote) nao
//       desescapava o quoting do git: path com espaco/aspas/backslash/acento
//       virava string inexistente => feedFile gravava 'absent' constante =>
//       digest identico antes/depois => prova de isolamento CEGA.
//   C2  `assertDisjointSourceTarget`: --target igual a origem, ancestral ou
//       descendente dela ABORTA antes de qualquer copy/remocao. Sem isso o
//       `finally` apagava a origem (quando --target == --source, `cp` falha e
//       `rmSync(copy)` removia a origem inteira; quando --target era
//       ANCESTRAL, o install sucedia no pai e o `finally` removia o pai
//       silenciosamente, incluindo arquivos irmaos do usuario).
//       FU-34 rodada final: a comparacao passou a ser REALPATH + lexico.
//       So o lexico deixava fonte alcancada por SYMLINK + --target no path
//       real passar (os dois resolvem para a mesma arvore) => origem apagada.
//   A2/A3/A4 `cleanupDogfood`: remocao so dentro do /tmp autorizado (alerta
//       em PT-BR com o caminho exato antes de cada remocao), erro de remocao
//       NUNCA engole a evidencia (campo `cleanupError`), e varredura fallback
//       de backups orfaos `.harness-backup-<basename(copy)>-*` criados durante
//       a execucao (backup entre `backup()` e uma falha em `applyMerge`).
//       FU-35 rodada final: a zona passou a ser medida por REALPATH e a
//       decisao de remocao por um classificador de 4 camadas
//       (`classifyRemoval`): lstat nao-symlink + realpath dentro do /tmp real
//       + disjoint da origem + nenhum atalho interno para fora da zona.
//       Duvida em qualquer camada => `blocked`: orfao inofensivo, nunca
//       delecao errada (politica conservadora provavel por teste).
//
// A5 (documentado): o digest de conteudo tem teto por arquivo
// (CONTENT_HASH_LIMIT — acima dele entram size+mtime, nao o conteudo) e, no
// caminho git, cobre SOMENTE as entradas reportadas pelo porcelain; sem git, o
// fallback cobre a arvore inteira.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { insideDir, isInsideTmp, realOrResolved, tmpRealRoot } from './zone.mjs';

// Zona do /tmp medida por REALPATH: um corpo so (./zone.mjs) para a trava de
// REMOCAO daqui e a de ESCRITA de install.mjs (`assertDogfoodTarget`). Medidas
// divergentes escreveriam onde nao removem (FU-42).
export { isInsideTmp, realOrResolved, tmpRealRoot };

function insideRealTmp(real) {
  const tmp = tmpRealRoot();
  return Boolean(tmp) && insideDir(real, tmp);
}

// A5: teto de tamanho por arquivo no digest de conteudo.
export const CONTENT_HASH_LIMIT = 8 * 1024 * 1024;

export function sha(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function feedFile(h, rel, abs) {
  h.update(`\u0000${rel}\u0000`);
  let s;
  try {
    s = fs.statSync(abs);
    if (!s.isFile()) { h.update('not-a-file\n'); return; }
  } catch { h.update('absent\n'); return; }
  if (s.size > CONTENT_HASH_LIMIT) {
    h.update(`big:${s.size}:${s.mtimeMs}\n`);
    return;
  }
  try {
    const buf = fs.readFileSync(abs);
    h.update(`b:${buf.length}:`);
    h.update(buf);
    h.update('\n');
  } catch { h.update('unreadable\n'); }
}

// `git status --porcelain -z`: "XY <path>" com NUL como terminador e SEM
// quote. rename/copy: "XY <to>\0<from>\0" (ordem invertida vs. ' -> ').
// NAO faz trim antes do slice: o espaco em XY eh posicional (" M path" comeca
// com branco) — trimar a entrada come o inicio e corrompe o path.
export function porcelainPaths(stdout) {
  const out = [];
  const tokens = String(stdout).split('\u0000');
  for (let i = 0; i < tokens.length; i++) {
    const entry = tokens[i];
    if (entry === '') continue;
    const p = entry.slice(3);
    if (p) out.push(p);
    const xy = entry.slice(0, 2);
    if (xy.includes('R') || xy.includes('C')) {
      const orig = tokens[i + 1];
      if (orig !== undefined && orig !== '') {
        out.push(orig);
        i += 1;
      }
    }
  }
  return out;
}

function walkTree(source) {
  const files = [];
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const p = path.join(d, e.name);
      let isDir;
      try { isDir = e.isDirectory(); } catch { continue; }
      if (isDir) walk(p);
      else files.push(p);
    }
  };
  walk(source);
  return files.sort();
}

// FU-34: `git status --short` sozinho NAO prova isolamento — alterar o
// CONTEUDO de um arquivo jah modificado mantem o mesmo status. O estado
// carrega DIGEST do conteudo (mais o proprio status), assim mutacao de
// conteudo, criacao e delecao mudam a assinatura.
export function sourceState(source) {
  try {
    // -uall: sem isso o porcelain resume diretorios untracked em "?? lib/" e o
    // digest ficaria cego ao CONTEUDO dos arquivos novos dentro deles.
    const raw = execFileSync('git', ['-C', source, 'status', '--porcelain', '-z', '-uall'], {
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const h = crypto.createHash('sha256');
    for (const rel of porcelainPaths(raw).sort()) feedFile(h, rel, path.join(source, rel));
    return {
      kind: 'git',
      status: raw.replace(/\u0000/g, '\n').trim(),
      digest: `sha256:${h.digest('hex')}`,
      coverage: 'porcelain-entries',
      hashLimit: CONTENT_HASH_LIMIT,
    };
  } catch {
    const files = walkTree(source);
    const h = crypto.createHash('sha256');
    for (const f of files) feedFile(h, path.relative(source, f), f);
    return {
      kind: 'mtimes',
      files: files.length,
      digest: `sha256:${h.digest('hex')}`,
      coverage: 'full-tree',
      hashLimit: CONTENT_HASH_LIMIT,
    };
  }
}

export function sameSourceState(a, b) {
  return Boolean(a) && Boolean(b) && a.kind === b.kind && a.status === b.status && a.digest === b.digest;
}

// ---- trava destrutiva C2 (antes de qualquer copy ou remocao) ---------------

// Sobreposicao: igual, ancestral ou descendente (nas duas direcoes).
function overlapping(a, b) {
  return a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
}

// Duas camadas: lexica (paths como escritos) E real (symlinks resolvidos).
// So a lexica deixava origem alcancada por symlink + --target no path real
// passar => cp copiava sobre si mesmo => finally apagava a origem inteira.
export function assertDisjointSourceTarget(source, target, { label = 'dogfood' } = {}) {
  const s = path.resolve(source);
  const c = path.resolve(target);
  const sReal = realOrResolved(s);
  const cReal = realOrResolved(c);
  if (overlapping(s, c) || overlapping(sReal, cReal)) {
    throw new Error(
      `${label}: --target nao pode ser a origem nem ancestral/descendente dela: ${c} (origem: ${s}). `
      + 'Apontar o alvo para a origem (ou para um diretorio que a contem) faria a limpeza final apagar arquivos seus.',
    );
  }
  return { source: s, copy: c, sourceReal: sReal, copyReal: cReal };
}

// Atalho no ALVO: `cp` seguiria o symlink e escreveria no referente; a
// limpeza depois nao conseguiria provar onde remove. Aborta antes do cp.
export function assertNoShortcutTarget(target, { label = 'dogfood' } = {}) {
  const abs = path.resolve(target);
  let st = null;
  try {
    st = fs.lstatSync(abs);
  } catch (e) {
    if (e && e.code !== 'ENOENT') throw e;
  }
  if (st && st.isSymbolicLink()) {
    throw new Error(
      `${label}: --target nao pode ser um symlink (atalho): ${abs}. `
      + 'A copia seguiria o atalho e a limpeza nao poderia provar onde remove.',
    );
  }
  return abs;
}

// ---- limpeza segura (A2/A3/A4) ---------------------------------------------

// Varre a arvore (lstat, sem seguir atalho) procurando symlink cujo destino
// nao seja provavel: fora do /tmp real, alcancando a origem, ou destino que
// nao resolve (atalho pendurado). Achou um => a REMOCAO nao acontece.
function findUnsafeSymlink(root, protectedReals) {
  const stack = [path.resolve(root)];
  const seen = new Set();
  while (stack.length > 0) {
    const dir = stack.pop();
    if (seen.has(dir)) continue;
    seen.add(dir);
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return `${dir}: ilegivel (${e && e.code ? e.code : e})`;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isSymbolicLink()) {
        let real;
        try {
          real = fs.realpathSync(p);
        } catch {
          return `${p}: destino do atalho nao resolve`;
        }
        // FU-42: medida da zona pelo corpo unico (`insideRealTmp`), nunca
        // inline — a duplicacao aqui media a mesma zona uma 3a vez e foi
        // exatamente o que zone.mjs nasceu para matar (escreve onde nao remove).
        const inTmp = insideRealTmp(real);
        const hitsSource = protectedReals.some((pr) => overlapping(pr, real));
        if (!inTmp || hitsSource) return `${p} -> ${real}`;
        continue;
      }
      if (e.isDirectory()) stack.push(p);
    }
  }
  return null;
}

// Decisao de remocao de UM path (defesa em profundidade, camada a camada):
//   1. lstat: nao pode ser symlink (atalho no topo bloqueia);
//   2. realpath dentro de os.tmpdir() REAL (macOS inclui: /private/var/...);
//   3. realpath disjoint de todo path protegido (a origem do dogfood);
//   4. nenhum atalho DENTRO da arvore apontando para fora da zona 2/3.
// Qualquer duvida => NAO remove (`blocked`). Orfao inofensivo em vez de
// delecao errada — politica conservadora provavel por teste.
export function classifyRemoval(raw, { protectedReals = [] } = {}) {
  const abs = path.resolve(raw);
  const refuse = (reason, detail) => ({ removable: false, abs, reason, detail: detail || null });
  let st;
  try {
    st = fs.lstatSync(abs);
  } catch (e) {
    if (e && e.code === 'ENOENT') return { removable: false, abs, reason: 'ausente', detail: null };
    return refuse('inacessivel', e && e.code ? e.code : String(e));
  }
  if (st.isSymbolicLink()) return refuse('symlink', `${abs} eh atalho; nao remove pelo atalho`);
  const real = realOrResolved(abs);
  if (!insideRealTmp(real)) return refuse('fora-do-tmp', real);
  if (protectedReals.some((pr) => overlapping(pr, real))) {
    return refuse('protegido-origem', real);
  }
  const unsafe = findUnsafeSymlink(abs, protectedReals);
  if (unsafe) return refuse('atalho-na-arvore', unsafe);
  return { removable: true, abs, real, reason: 'ok', detail: null };
}

// Alerta em PT-BR com o caminho EXATO antes de cada remocao; path fora do
// /tmp autorizado (ou nao provavel seguro) nao eh removido (vai para
// `blocked`); falha de remocao (EACCES/EBUSY) nao propaga (vai para `errors`)
// — evidencia precisa sobreviver.
export function removeWithinTmp(paths, { warn = () => {}, protectedReals = [] } = {}) {
  const removed = [];
  const blocked = [];
  const blockedDetails = [];
  const errors = [];
  const guards = Array.isArray(protectedReals) ? protectedReals : [protectedReals];
  for (const raw of paths) {
    if (!raw) continue;
    const c = classifyRemoval(raw, { protectedReals: guards });
    if (!c.removable) {
      if (c.reason === 'ausente') continue;
      blocked.push(c.abs);
      blockedDetails.push({ path: c.abs, reason: c.reason, detail: c.detail });
      warn(`remocao BLOQUEADA (nenhum arquivo apagado) — ${c.reason}: ${c.abs}${c.detail ? ` (${c.detail})` : ''}`);
      continue;
    }
    warn(`removendo caminho autorizado: ${c.abs}`);
    try {
      fs.rmSync(c.abs, { recursive: true, force: true });
      removed.push(c.abs);
    } catch (e) {
      errors.push(`${c.abs}: ${e && e.message ? e.message : String(e)}`);
    }
  }
  return { removed, blocked, blockedDetails, errors, ok: blocked.length === 0 && errors.length === 0 };
}

// A4: backup criado entre `backup()` e uma falha em `applyMerge` (ou antes do
// retorno do runCli) nao aparece em `result.backup` — ficaria orfao. Varre o
// diretorio irmao do alvo pelos backups que o proprio instalador nomeou.
// lstat (nunca statSync): atalho com nome de backup nao eh backup — seguir o
// symlink aqui removeria o referente FORA do /tmp.
export function backupOrphans(copy, t0 = 0, { protectedReals = [] } = {}) {
  const dir = path.dirname(path.resolve(copy));
  const prefix = `.harness-backup-${path.basename(path.resolve(copy))}-`;
  const out = [];
  const guards = Array.isArray(protectedReals) ? protectedReals : [protectedReals];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (!e.name.startsWith(prefix)) continue;
    const p = path.join(dir, e.name);
    let st;
    try { st = fs.lstatSync(p); } catch { continue; }
    if (st.isSymbolicLink()) continue;
    if (!st.isDirectory()) continue;
    if (t0 && st.mtimeMs < t0) continue;
    const real = realOrResolved(p);
    if (!insideRealTmp(real)) continue;
    if (guards.some((pr) => overlapping(pr, real))) continue;
    out.push(p);
  }
  return out;
}

// Limpeza canonica: roda em QUALQUER caminho (feliz, falha, `--keep`).
// Nunca lanca: devolve o estado para a evidencia.
// `sourceReal`: realpath (ou path) da origem — 2a linha de defesa: re-valida a
// disjointness AQUI, antes de qualquer remocao, mesmo que o guard do inicio
// tenha passado (path criado depois, symlink novo, TOCTOU).
export function cleanupDogfood(copy, backupDir, {
  keep = false,
  t0 = Date.now(),
  warn,
  sourceReal = null,
} = {}) {
  const absCopy = path.resolve(copy);
  if (keep) {
    return { kept: true, copyRemoved: false, backupRemoved: false, removed: [], blocked: [], blockedDetails: [], errors: [] };
  }
  const protectedReals = sourceReal == null || sourceReal === ''
    ? []
    : (Array.isArray(sourceReal) ? sourceReal : [sourceReal]).map((p) => realOrResolved(p));
  const known = [absCopy, backupDir].filter(Boolean).map((p) => path.resolve(p));
  const orphans = backupOrphans(absCopy, t0, { protectedReals });
  const res = removeWithinTmp([...known, ...orphans], { warn, protectedReals });
  let copyRemoved = false;
  try { copyRemoved = !fs.existsSync(absCopy); } catch { copyRemoved = false; }
  let backupRemoved = false;
  if (backupDir) {
    try { backupRemoved = !fs.existsSync(path.resolve(backupDir)); } catch { backupRemoved = false; }
  }
  return {
    kept: false,
    copyRemoved,
    backupRemoved,
    removed: res.removed,
    blocked: res.blocked,
    blockedDetails: res.blockedDetails,
    errors: res.errors,
    orphans,
    sourceReal: protectedReals,
  };
}

// A2: a nota antiga dizia "copia e backup removidos" mesmo com copyRemoved:false.
export function cleanupNote(state, copy) {
  const abs = path.resolve(copy);
  const blocked = state.blocked || [];
  const errors = state.errors || [];
  if (state.kept) return `copia mantida (--keep): ${abs}`;
  if (blocked.length > 0) {
    const detail = (state.blockedDetails || [])
      .map((b) => `${b.path} (${b.reason}${b.detail ? `: ${b.detail}` : ''})`)
      .join(', ');
    return `remocao BLOQUEADA — NADA foi apagado: ${detail || blocked.join(', ')}`;
  }
  if (errors.length > 0) {
    return `FALHA ao remover (orfao pode permanecer em disco): ${errors.join('; ')}`;
  }
  if (state.copyRemoved) return 'copia e backup removidos ao final';
  return `remocao concluida sem erro, mas o caminho ainda existe: ${abs}`;
}

export function cleanupErrorOf(state) {
  const parts = [
    ...(state.errors || []).map((e) => `remocao falhou: ${e}`),
    ...(state.blocked || []).map((b) => `remocao bloqueada: ${b}`),
  ];
  return parts.length > 0 ? parts.join('; ') : null;
}
