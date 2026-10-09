// network.spec.mjs — IM-VAL-03 V15: rede proibida em installer/
// (rótulo canônico V15/rede-installer — NÃO é o I8 do gate-contract.md,
// que trata de DenyError; o I8 do spec da feature era ambíguo, FU-31
// review MF-1).
// FU-31: V15 cobre a CLASSE de rede (builtins, libs, globais, comandos
// child_process), não só os literais fetch(/node:http/node:https.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { scanNetworkRefs, networkCheck } from '../../scripts/static-checks.mjs';
import { REPO_ROOT } from '../../.opencode/plugins/lib/config.mjs';

let dirs = [];
function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-v15-'));
  dirs.push(d);
  return d;
}
function write(root, rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs = [];
});

// FU-42: calibração do bound de ASSERÇÃO dos testes de tempo. O contrato
// publicado do gate (<50ms, ver comentários abaixo) é da REGEX contra a
// linha patológica — com bound a regex fecha em microssegundos. Aqui se
// mede o scan INTEIRO (leitura dos arquivos + 12 patterns × linhas), que
// custa dezenas de ms e oscila com carga: single-shot <50ms mostrou-se
// flaky (50.8ms em 1 de 3 rodadas sob carga, review FU-42). Por isso a
// asserção é a MEDIANA de SCAN_REPS (pico isolado de GC/scheduler não
// derruba mediana) contra SCAN_BOUND_MS, com folga realista (150–250ms
// pedidas pelo review). Negative control no describe ao final prova que a
// regex ANTIGA (sem bound) estoura o MESMO bound — folga não pode chegar
// ao ponto de a regressão passar.
const SCAN_BOUND_MS = 250;
const SCAN_REPS = 5;

function medianScanMs(dir, reps = SCAN_REPS) {
  const samples = [];
  for (let i = 0; i < reps; i++) {
    const t0 = performance.now();
    scanNetworkRefs(dir);
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

describe('IM-VAL-03 V15 rede em installer/ (V15/rede-installer)', () => {
  it('detecta fetch( / node:http / node:https', () => {
    const d = tmp();
    write(d, 'install.mjs', 'const r = await fetch("http://x");\n');
    write(d, 'lib/http.mjs', 'import http from "node:http";\n');
    write(d, 'lib/https.mjs', 'const h = require("node:https");\n');
    const hits = scanNetworkRefs(d);
    assert.equal(hits.length, 3, JSON.stringify(hits));
    assert.ok(hits.some((h) => h.pattern === 'fetch'));
    assert.ok(hits.some((h) => h.pattern === 'builtin-net-import'));
  });

  it('ignora __tests__ e node_modules e código limpo', () => {
    const d = tmp();
    write(d, 'install.mjs', 'export const x = 1;\n');
    write(d, '__tests__/x.spec.mjs', 'const r = await fetch("http://x");\n');
    write(d, 'node_modules/dep/index.js', 'fetch("http://x");\n');
    assert.deepEqual(scanNetworkRefs(d), []);
    assert.equal(networkCheck(d).ok, true);
  });

  it('networkCheck => FAIL quando há hit', () => {
    const d = tmp();
    write(d, 'install.mjs', 'export async function go(){ return fetch("http://x"); }\n');
    const res = networkCheck(d);
    assert.equal(res.ok, false);
    assert.equal(res.hits.length, 1);
  });
});

describe('FU-31 V15 classe de rede (não só literal)', () => {
  it('detecta builtins de rede sem prefixo node: e demais builtins', () => {
    const d = tmp();
    write(d, 'a.mjs', 'import http from "https";\n');
    write(d, 'b.mjs', 'import dns from "node:dns";\n');
    write(d, 'c.mjs', 'import net from "net";\n');
    write(d, 'd.mjs', 'import http2 from "node:http2";\n');
    write(d, 'e.mjs', 'import tls from "tls";\n');
    write(d, 'f.mjs', 'import dgram from "node:dgram";\n');
    const hits = scanNetworkRefs(d);
    assert.equal(hits.length, 6, JSON.stringify(hits));
    for (const h of hits) assert.equal(h.pattern, 'builtin-net-import');
  });

  it('detecta libs HTTP terceiras por specifier (import/require)', () => {
    const d = tmp();
    write(d, 'a.mjs', 'import axios from "axios";\n');
    write(d, 'b.mjs', 'import got from "got";\n');
    write(d, 'c.mjs', 'import { request } from "undici";\n');
    write(d, 'd.mjs', 'const nf = require("node-fetch");\n');
    write(d, 'e.mjs', 'import superagent from "superagent";\n');
    write(d, 'f.mjs', 'const WS = require("ws");\n');
    const hits = scanNetworkRefs(d);
    assert.equal(hits.length, 6, JSON.stringify(hits));
    for (const h of hits) assert.equal(h.pattern, 'http-lib-import');
  });

  it('detecta globais de rede WebSocket/XMLHttpRequest', () => {
    const d = tmp();
    write(d, 'a.mjs', 'const ws = new WebSocket("wss://x");\n');
    write(d, 'b.mjs', 'const xhr = new XMLHttpRequest();\n');
    const hits = scanNetworkRefs(d);
    assert.equal(hits.length, 2, JSON.stringify(hits));
    assert.deepEqual(hits.map((h) => h.pattern).sort(), ['new-WebSocket', 'new-XMLHttpRequest']);
  });

  it('detecta child_process com comando de rede (string e array)', () => {
    const d = tmp();
    write(d, 'a.mjs', 'execFileSync("curl", ["-s", url]);\n');
    write(d, 'b.mjs', 'spawnSync("wget", [url]);\n');
    write(d, 'c.mjs', 'execSync("git clone https://x");\n');
    write(d, 'd.mjs', 'execFileSync("npm", ["install"]);\n');
    write(d, 'e.mjs', 'exec("npm install left-pad");\n');
    write(d, 'f.mjs', 'spawn("git", ["clone", u]);\n');
    const hits = scanNetworkRefs(d);
    assert.equal(hits.length, 6, JSON.stringify(hits));
    const patterns = hits.map((h) => h.pattern).sort();
    assert.deepEqual(patterns, [
      'net-cmd-download', 'net-cmd-download',
      'net-git-cmd', 'net-git-cmd-array',
      'net-pkg-cmd', 'net-pkg-cmd-array',
    ]);
  });

  it('zero falso-positivo no uso legitimo espelhado de dogfood*.mjs', () => {
    const d = tmp();
    // Espelha o uso REAL de installer/dogfood.mjs / dogfood-mobile.mjs:
    // child_process local (git status/rev-parse, cp, node --test) é permitido.
    write(d, 'dogfood.mjs', [
      'import { execFileSync } from "node:child_process";',
      'import { createHash } from "node:crypto";',
      'const st = execFileSync("git", ["-C", source, "status", "--short"], { encoding: "utf8", timeout: 15000 });',
      'execFileSync("cp", ["-r", `${source}/.`, copy], { timeout: 120000 });',
      'execFileSync("node", ["--test", "installer/__tests__/*.spec.mjs"], { timeout: 600000 });',
      'const head = execFileSync("git", ["-C", INSTALLER_ROOT, "rev-parse", "HEAD"], { encoding: "utf8" });',
      'if (ver < MIN) throw new Error(`node minimum ${MIN_NODE_VERSION.join(".")} required, got ${ver.join(".")} (G1/Y2)`);',
      'const u = "http://localhost:5173/health";',
      'const p = await globalThis.fetchX;',
    ].join('\n'));
    assert.deepEqual(scanNetworkRefs(d), []);
    assert.equal(networkCheck(d).ok, true);
  });

  it('repo real installer/ permanece limpo (guardião anti-regressão)', () => {
    const res = networkCheck(path.join(REPO_ROOT, 'installer'));
    assert.equal(res.ok, true, JSON.stringify(res.hits));
  });
});

// D-1 (FU-31 rodada final): rótulos E5/E6 daqui são os escapes do review
// MF-2/MF-3 — colidem com os escapes E5/E6 ABERTOS declarados no header de
// static-checks.mjs (array-form FP residual; comandos fora da lista).
// Renomeados para E5-legado/E6-legado para evitar colisão de rótulo.
describe('FU-31 review MF-2/MF-3/MF-5 — escapes E5-legado/E6-legado fechados (contraprova de bypass)', () => {
  it('E5-legado side-effect import sem binding passa a ser HIT', () => {
    const d = tmp();
    write(d, 'a.mjs', 'import "node:https";\n');
    write(d, 'b.mjs', 'import "axios";\n');
    write(d, 'c.mjs', 'import "got";\n');
    const hits = scanNetworkRefs(d);
    assert.equal(hits.length, 3, JSON.stringify(hits));
    assert.equal(hits.filter((h) => h.pattern === 'builtin-net-import').length, 1);
    assert.equal(hits.filter((h) => h.pattern === 'http-lib-import').length, 2);
  });

  it('E5-legado formas com binding continuam HIT (zero regressao)', () => {
    const d = tmp();
    write(d, 'a.mjs', 'import axios from "axios";\n');
    write(d, 'b.mjs', 'import("got")\n');
    write(d, 'c.mjs', 'const W = require("ws");\n');
    const hits = scanNetworkRefs(d);
    assert.equal(hits.length, 3, JSON.stringify(hits));
    for (const h of hits) assert.equal(h.pattern, 'http-lib-import');
  });

  it('E6-legado subcomando apos flag em string e array passa a ser HIT', () => {
    const d = tmp();
    write(d, 'a.mjs', 'execSync("git -C /tmp/x clone https://y");\n');
    write(d, 'b.mjs', 'execFileSync("git", ["-C", repo, "clone", url]);\n');
    write(d, 'c.mjs', 'execFileSync("npm", ["--prefix", p, "install"]);\n');
    write(d, 'd.mjs', 'exec("npm --prefix ./x install");\n');
    const hits = scanNetworkRefs(d);
    const patterns = hits.map((h) => h.pattern).sort();
    assert.deepEqual(patterns, [
      'net-git-cmd', 'net-git-cmd-array',
      'net-pkg-cmd', 'net-pkg-cmd-array',
    ]);
  });

  it('E6-legado comandos locais com flag seguem permitidos (zero falso-positivo)', () => {
    const d = tmp();
    write(d, 'a.mjs', 'execFileSync("git", ["-C", source, "status", "--short"], { encoding: "utf8" });\n');
    write(d, 'b.mjs', 'execFileSync("git", ["-C", root, "rev-parse", "HEAD"]);\n');
    write(d, 'c.mjs', 'execFileSync("node", ["--test", "x.spec.mjs"]);\n');
    write(d, 'd.mjs', 'execSync("git -C /tmp/x status --short");\n');
    write(d, 'e.mjs', 'execSync("npm run build");\n');
    write(d, 'f.mjs', 'execSync("npm init -y");\n');
    write(d, 'g.mjs', 'execFileSync("cp", ["-r", source, copy]);\n');
    assert.deepEqual(scanNetworkRefs(d), []);
  });

  it('extras do review: bun add / npx / flutter+dart pub get cobertos', () => {
    const d = tmp();
    write(d, 'a.mjs', 'execSync("bun add zod");\n');
    write(d, 'b.mjs', 'execSync("npx some-pkg");\n');
    write(d, 'c.mjs', 'execSync("flutter pub get");\n');
    write(d, 'd.mjs', 'execSync("yarn add left-pad");\n');
    const hits = scanNetworkRefs(d);
    const patterns = hits.map((h) => h.pattern).sort();
    assert.deepEqual(patterns, ['net-npx-cmd', 'net-pkg-cmd', 'net-pkg-cmd', 'net-pub-cmd']);
  });

  it('extras do review: indirecao via globalThis coberta; alias de global segue escape declarado', () => {
    const d = tmp();
    write(d, 'a.mjs', 'const ws = new globalThis.WebSocket("wss://x");\n');
    const hits = scanNetworkRefs(d);
    assert.equal(hits.length, 1, JSON.stringify(hits));
    assert.equal(hits[0].pattern, 'new-WebSocket');
    // E2 (alias): const W = WebSocket; new W(...) — segue escapando, declarado.
    const d2 = tmp();
    write(d2, 'b.mjs', 'const W = WebSocket;\nnew W("wss://x");\n');
    assert.deepEqual(scanNetworkRefs(d2), []);
  });
});

describe('FU-31 review it-3 RE-1 — ReDoS bound nos comandos git/pkg', () => {
  // Linha patológica: 200+ chars, muitas flags, nenhum subcomando de rede.
  // Regex antiga (grupo * sem limite) media >120s nesta linha (medido em
  // 2026-10-09, node v26) — ReDoS confirmado; scan síncrono trava o
  // static-check e o CI. Com bound {0,4} o scan fecha em microssegundos.
  // Nota honesta: timeout de teste NÃO preempta regex síncrona catastrófica
  // (a thread fica bloqueada; o timer só corre com o loop livre) — por isso
  // o bound é obrigatório. FU-42: o CONTRATO publicado (<50ms) é da regex
  // contra a linha patológica; a asserção abaixo mede o scan inteiro com
  // mediana + SCAN_BOUND_MS (ver helpers no topo) — teste de tempo não pode
  // falhar por carga de máquina (flaky 50.8ms em 1/3 rodadas).
  const patho = [
    'git ' + '--x '.repeat(200) + 'yy',
    'npm ' + '--x '.repeat(200) + 'yy',
    'pnpm ' + '-y '.repeat(200) + 'zz',
    'git -C /tmp ' + '--no-tags '.repeat(60) + 'status --short',
    'yarn ' + '--flag '.repeat(120) + 'run build',
  ];

  it(`linha patologica de 200+ chars com muitas flags: scan < ${SCAN_BOUND_MS}ms (mediana de ${SCAN_REPS}, bound)`, () => {
    const d = tmp();
    patho.forEach((line, i) => write(d, `p${i}.mjs`, `const c = "${line}";\n`));
    const hits = scanNetworkRefs(d);
    const dt = medianScanMs(d);
    assert.deepEqual(hits, [], JSON.stringify(hits));
    assert.ok(dt < SCAN_BOUND_MS, `scan (mediana de ${SCAN_REPS}) levou ${dt.toFixed(1)}ms — bound ${SCAN_BOUND_MS}ms violado (ReDoS)`);
  });

  it('bound preserva cobertura: flags antes do subcomando seguem HIT', () => {
    const d = tmp();
    write(d, 'a.mjs', 'execSync("git clone https://x");\n');
    write(d, 'b.mjs', 'execSync("git -C /tmp/x clone https://y");\n');
    write(d, 'c.mjs', 'execSync("git -c a=b -c c=d push origin main");\n');
    write(d, 'd.mjs', 'exec("npm install left-pad");\n');
    write(d, 'e.mjs', 'exec("npm --prefix ./x install");\n');
    write(d, 'f.mjs', 'execSync("bun add zod");\n');
    write(d, 'g.mjs', 'execSync("yarn add left-pad");\n');
    const hits = scanNetworkRefs(d);
    const patterns = hits.map((h) => h.pattern).sort();
    assert.deepEqual(patterns, [
      'net-git-cmd', 'net-git-cmd', 'net-git-cmd',
      'net-pkg-cmd', 'net-pkg-cmd', 'net-pkg-cmd', 'net-pkg-cmd',
    ]);
  });

  it('bound preserva zero falso-positivo local (npm run/init, git status)', () => {
    const d = tmp();
    write(d, 'a.mjs', 'execSync("npm run build");\n');
    write(d, 'b.mjs', 'execSync("npm init -y");\n');
    write(d, 'c.mjs', 'execSync("git -C /tmp/x status --short");\n');
    assert.deepEqual(scanNetworkRefs(d), []);
  });
});

describe('FU-31 review it-3 RE-1 extra — fronteira do npx (FP my-npx)', () => {
  it('my-npx (substring) nao é falso-positivo; npx real segue HIT', () => {
    const d = tmp();
    write(d, 'a.mjs', 'const bin = "my-npx some-pkg";\n');
    write(d, 'b.mjs', 'execSync("npx some-pkg");\n');
    const hits = scanNetworkRefs(d);
    assert.equal(hits.length, 1, JSON.stringify(hits));
    assert.equal(hits[0].pattern, 'net-npx-cmd');
  });
});

describe('FU-31 review it-3 ES-1/ES-2 — arestas E7/E8 DECLARADAS (não caçadas)', () => {
  // REGRA DE PARADA: não perseguir escapes novos. E7/E8 ficam na lista
  // de arestas declaradas (header de static-checks.mjs + linha V15 do
  // gate-contract.md, redação entregue ao orchestrador). Os testes abaixo
  // são a contraprova de que a aresta existe e continua declarada.
  it('E7: padrão dividido entre linhas escapa (scan é linha-a-linha)', () => {
    const d = tmp();
    write(d, 'a.mjs', 'import\n  "node:https";\n');
    write(d, 'b.mjs', 'fetch\n("http://x");\n');
    write(d, 'c.mjs', 'execSync("git\n clone https://y");\n');
    write(d, 'd.mjs', 'const u = "https://x";\nconst p = await fetch\n("http://x");\n');
    assert.deepEqual(scanNetworkRefs(d), []);
  });

  it('E8: alias de require escapa (createRequire / const rq=require)', () => {
    const d = tmp();
    write(d, 'a.mjs', 'import { createRequire } from "node:module";\nconst rq = createRequire(import.meta.url);\nrq("axios");\n');
    write(d, 'b.mjs', 'const rq2 = require;\nrq2("got");\n');
    write(d, 'c.mjs', 'const req = require;\nreq("undici");\n');
    assert.deepEqual(scanNetworkRefs(d), []);
  });
});

describe('FU-31 rodada final RE-1 — bound {0,200} no caminho ARRAY (metade array do ReDoS)', () => {
  // RE-1 pela metade: os patterns array usavam [^\]]* sem limite superior.
  // Custo medido sem bound (node v26.7.0, 2026-10-09):
  //   - forma linear (1 ocorrência do prefixo, array enorme): O(n) baixo
  //     (1.2M chars ~1.5ms) — degrada, mas não estoura o contrato sozinho;
  //   - forma multi-ocorrência (N repetições de ["git", ): O(n²) — cada
  //     prefixo git", [ reinicia o scan até o fim do array (64k chars =
  //     305ms, >50ms). Esta é a linha que dá dente ao contrato.
  // Fix: [^\]]{0,200} — cada tentativa fecha em <=200 passos.
  // FU-42: contrato publicado (<50ms) é da REGEX; a asserção mede o scan
  // inteiro com mediana + SCAN_BOUND_MS (helpers no topo) — teste de tempo
  // não pode falhar por carga de máquina.
  const N_LINEAR = 200000;
  const N_QUAD = 8000;

  it(`caminho array: linha patologica com muitos elementos: scan < ${SCAN_BOUND_MS}ms (mediana de ${SCAN_REPS}, bound {0,200})`, () => {
    const d = tmp();
    // forma prescrita (linear): array enorme, 1 ocorrência do prefixo.
    write(d, 'big-git.mjs', 'const c = spawn("git", ' + '["x", '.repeat(N_LINEAR) + '"y"]);\n');
    write(d, 'big-pkg.mjs', 'const c = spawn("npm", ' + '["--flag", '.repeat(N_LINEAR / 2) + '"y"]);\n');
    // forma multi-ocorrência (O(n²) sem bound): N prefixos git", [ / npm", [.
    write(d, 'quad-git.mjs', 'const a = ' + '["git", '.repeat(N_QUAD) + '"y"];\n');
    write(d, 'quad-pkg.mjs', 'const b = ' + '["npm", '.repeat(N_QUAD) + '"y"];\n');
    const hits = scanNetworkRefs(d);
    const dt = medianScanMs(d);
    assert.deepEqual(hits, [], JSON.stringify(hits));
    assert.ok(dt < SCAN_BOUND_MS, `scan (mediana de ${SCAN_REPS}) levou ${dt.toFixed(1)}ms — bound ${SCAN_BOUND_MS}ms violado (ReDoS)`);
  });

  it('bound preserva semantica array: 4 HIT (subcomando em qualquer posicao) + 2 MISS (status/rev-parse)', () => {
    const d = tmp();
    write(d, 'a.mjs', 'spawn("git", ["clone", u]);\n');
    write(d, 'b.mjs', 'execFileSync("git", ["-C", repo, "clone", url]);\n');
    write(d, 'c.mjs', 'execFileSync("git", ["-c", "a=b", "-c", "c=d", "push", "origin"]);\n');
    write(d, 'd.mjs', 'execFileSync("git", ["--git-dir", a, "--work-tree", b, "fetch", "--all"]);\n');
    write(d, 'e.mjs', 'execFileSync("npm", ["--prefix", p, "install"]);\n');
    write(d, 'f.mjs', 'execFileSync("git", ["status", "--short"]);\n');
    write(d, 'g.mjs', 'execFileSync("git", ["rev-parse", "HEAD"]);\n');
    const hits = scanNetworkRefs(d);
    assert.equal(hits.length, 5, JSON.stringify(hits));
    const patterns = hits.map((h) => h.pattern).sort();
    assert.deepEqual(patterns, [
      'net-git-cmd-array', 'net-git-cmd-array',
      'net-git-cmd-array', 'net-git-cmd-array',
      'net-pkg-cmd-array',
    ]);
  });

  it('limite declarado: elemento de array >200 chars antes do subcomando nao casa', () => {
    const d = tmp();
    const long = 'x'.repeat(250);
    write(d, 'a.mjs', `execFileSync("git", ["${long}", "clone", url]);\n`);
    write(d, 'b.mjs', `execFileSync("npm", ["${long}", "install"]);\n`);
    assert.deepEqual(scanNetworkRefs(d), []);
  });
});

// FU-42 review — NEGATIVE CONTROL: a folga do bound de asserção NÃO pode
// chegar ao ponto de a regex ANTIGA (sem bound) passar. Medidas 2026-10-09
// (node v26.7.0, curva exponencial confirmada ~1.6x por token na string e
// quadrática no array): string "git "+"--x "*34+"yy" = 2160ms; array
// '["git", '*20000 = 2201ms — ambas >8x SCAN_BOUND_MS (250ms) e ambas
// fecham em <5s mesmo sob carga (custo fixo desta contraprova). Se alguém
// subir SCAN_BOUND_MS além disso, estes testes falham: bound perdeu o dente.
describe('FU-42 negative control — regex antiga (sem bound) estoura o bound novo', () => {
  // Regex PRÉ-bound (grupo * e [^\]]* sem limite) — dados de teste em
  // __tests__/ são justamente o que nomeia o padrão proibido como amostra.
  const OLD_STRING_GIT = /\bgit\s+(?:-\S+(?:\s+[^\s|;&]+)?\s+)*(?:clone|fetch|pull|push|ls-remote)\b/;
  const OLD_ARRAY_GIT = /\bgit['"]\s*,\s*\[[^\]]*['"](?:clone|fetch|pull|push|ls-remote)['"]/;

  it('string sem bound: 34 tokens de flag estouram SCAN_BOUND_MS', () => {
    const line = 'git ' + '--x '.repeat(34) + 'yy';
    const t0 = performance.now();
    OLD_STRING_GIT.test(line);
    const dt = performance.now() - t0;
    assert.ok(dt > SCAN_BOUND_MS, `regex antiga fechou em ${dt.toFixed(1)}ms — bound de ${SCAN_BOUND_MS}ms perdeu o dente`);
  });

  it('array sem bound: 20000 prefixos ["git", estouram SCAN_BOUND_MS', () => {
    const line = 'const a = ' + '["git", '.repeat(20000) + '"y"];\n';
    const t0 = performance.now();
    OLD_ARRAY_GIT.test(line);
    const dt = performance.now() - t0;
    assert.ok(dt > SCAN_BOUND_MS, `regex antiga fechou em ${dt.toFixed(1)}ms — bound de ${SCAN_BOUND_MS}ms perdeu o dente`);
  });
});

describe('FU-31 rodada final D-2/D-3 — E9 (npx array-form) e FP npx --version declarados', () => {
  it('E9 declarado: npx so na forma string-unica — array-form escapa (nao cacado)', () => {
    const d = tmp();
    write(d, 'a.mjs', 'execFileSync("npx", ["create-vite", "app"]);\n');
    write(d, 'b.mjs', 'execSync("npx create-vite app");\n');
    const hits = scanNetworkRefs(d);
    assert.equal(hits.length, 1, JSON.stringify(hits));
    assert.equal(hits[0].pattern, 'net-npx-cmd');
  });

  it('FP residual anotado (D-3): "npx --version" casa — so imprime versao; declarado, nao cacado', () => {
    const d = tmp();
    write(d, 'a.mjs', 'execSync("npx --version");\n');
    const hits = scanNetworkRefs(d);
    assert.equal(hits.length, 1, JSON.stringify(hits));
    assert.equal(hits[0].pattern, 'net-npx-cmd');
  });
});
