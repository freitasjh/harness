// network.spec.mjs — IM-VAL-03 V15: rede proibida em installer/ (I8).
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { scanNetworkRefs, networkCheck } from '../../scripts/static-checks.mjs';

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

describe('IM-VAL-03 V15 rede em installer/ (I8)', () => {
  it('detecta fetch( / node:http / node:https', () => {
    const d = tmp();
    write(d, 'install.mjs', 'const r = await fetch("http://x");\n');
    write(d, 'lib/http.mjs', 'import http from "node:http";\n');
    write(d, 'lib/https.mjs', 'const h = require("node:https");\n');
    const hits = scanNetworkRefs(d);
    assert.equal(hits.length, 3, JSON.stringify(hits));
    assert.ok(hits.some((h) => h.pattern === 'fetch'));
    assert.ok(hits.some((h) => h.pattern === 'node:http'));
    assert.ok(hits.some((h) => h.pattern === 'node:https'));
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
