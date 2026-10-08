#!/usr/bin/env node
// vendor-skills.mjs — source-side, offline vendor of third-party skills.
//
// ADR-009 / RF-13 / I9. Vendoriza skills byte-identicas ao lock de origem,
// grava `.agents/skills/.vendor-lock.json` (procedencia + hashes) e
// `.agents/skills/VENDOR-NOTICE.md` (source+commit+SPDX+excluidas).
//
// Politica P-02=(i): skill sem licenca identificavel NAO e vendorizada
// (fail-closed). `--check` recomputa o treeHash e FALHA em divergencia ou
// symlink. O caminho de instalacao (`installer/install.mjs`) permanece
// rede-zero (V15); este script e o unico ponto source-side.
//
//   node scripts/vendor-skills.mjs --source <dir> --lock <skills-lock.json> \
//     [--dest <dir>] [--source-commit <src>=<sha>] [--source-license <src>=<spdx>]
//   node scripts/vendor-skills.mjs --check [--dest <dir>]
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const VENDOR_LOCK_NAME = ".vendor-lock.json";
export const VENDOR_NOTICE_NAME = "VENDOR-NOTICE.md";
export const VENDOR_LOCK_VERSION = "1";
export const POLICY = "P-02=(i)";

// Allowlist SPDX (P-02=(i), fail-closed): so licencas identificaveis e
// permissivas passam. `UNLICENSED`/`PROPRIETARY`/desconhecido NAO passam —
// a skill e excluida. Fonte: SPDX License List.
export const SPDX_ALLOWLIST = new Set([
  "0BSD",
  "MIT",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "MPL-2.0",
  "Unlicense",
  "CC0-1.0",
]);

export function isAllowedSpdx(spdx) {
  return typeof spdx === "string" && SPDX_ALLOWLIST.has(spdx.trim());
}

// Texto COMPLETO + copyright da licenca da fonte upstream, transcrito do
// LICENSE do repositorio no commit pinado (source+commit no lock). Estes
// textos sao DERIVADOS (nunca retidos no dir da skill) e gravados pelo vendor
// como arquivo agregado `LICENSE-<source-slug>` na raiz do dest (P-02, RF-13).
// dart-lang/skills @ 0d9f1c4a / flutter/skills @ 0ef3972f: BSD-3-Clause.
const BSD3_DART = `Copyright 2012, the Dart project authors.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software without
   specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;

const BSD3_FLUTTER = `Copyright 2026 The Flutter Authors. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software without
   specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;

// `licenseText` e transcrito byte-a-byte do LICENSE upstream (o `sha256`
// congela os bytes e permite ao `--check` validar o arquivo agregado escrito
// na raiz do dest contra a fonte). Sem newline final: o upstream nao o tem.
export const SOURCE_LICENSES = {
  "dart-lang/skills": {
    spdx: "BSD-3-Clause",
    licenseText: BSD3_DART,
    sha256: "835b0ffef5681b070c8d9c6c7d67cdd018441a7ae65b1ebd772dbdd2bd40f097",
  },
  "flutter/skills": {
    spdx: "BSD-3-Clause",
    licenseText: BSD3_FLUTTER,
    sha256: "5b95696b504e162bcf775060ec416005df9969a95cda6f7d4ddb57327dd74d35",
  },
};

// Nome do arquivo agregado escrito pelo vendor para a licenca de uma fonte
// (o LICENSE vive no repo upstream, nao no dir da skill). Nunca e escrito
// dentro de `.agents/skills/<name>/` — logo nao afeta o treeHash (I9).
export function aggregatedLicenseName(source) {
  return `LICENSE-${String(source).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()}`;
}

// Hash esperado dos bytes do LICENSE de uma fonte: o `sha256` congelado
// quando declarado; senao derivado do `licenseText`. `null` = nao ha como
// verificar a licenca agregada (o `--check` trata como FAIL, fail-closed).
export function expectedLicenseSha(entry) {
  if (!entry) return null;
  if (typeof entry.sha256 === "string" && entry.sha256) return entry.sha256;
  if (typeof entry.licenseText === "string" && entry.licenseText) return sha256(entry.licenseText);
  return null;
}

export class VendorError extends Error {
  constructor(message, code = "VENDOR") {
    super(message);
    this.name = "VendorError";
    this.code = code;
  }
}

export function sha256(data) {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return createHash("sha256").update(buf).digest("hex");
}

// Recursivo, lstat (nao segue symlink). Symlinks sao reportados, nunca lidos.
// A RAIZ tambem e classificada: um diretorio simlinkado (readdir segue) e
// reportado como symlink "." e nunca percorrido (fail-closed).
export function listTree(dir) {
  const files = [];
  const symlinks = [];
  let root;
  try {
    root = fs.lstatSync(dir);
  } catch {
    return { files, symlinks };
  }
  if (root.isSymbolicLink()) return { files, symlinks: ["."] };
  if (!root.isDirectory()) return { files, symlinks };
  const walk = (abs, rel) => {
    for (const entry of fs.readdirSync(abs)) {
      const p = path.join(abs, entry);
      const r = rel ? `${rel}/${entry}` : entry;
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink()) {
        symlinks.push(r);
      } else if (st.isDirectory()) {
        walk(p, r);
      } else if (st.isFile()) {
        files.push({ rel: r, bytes: fs.readFileSync(p), mode: st.mode & 0o777 });
      }
    }
  };
  walk(dir, "");
  return { files, symlinks };
}

// treeHash = sha256 de (path \0 sha256(bytes)) por arquivo, ordenado, multi-arquivo.
export function treeHash(dir) {
  const { files, symlinks } = listTree(dir);
  if (symlinks.length > 0) {
    throw new VendorError(`symlink proibido no vendor: ${symlinks.join(", ")}`, "SYMLINK");
  }
  const lines = files.map((f) => `${f.rel}\0${sha256(f.bytes)}`).sort();
  return sha256(lines.join("\n"));
}

// Compat com o `computedHash` do skills-lock.json (vercel-labs/skills):
// sha256 de (relativePath + content), por arquivo, ordenado por path.
export function folderComputedHash(dir) {
  const { files } = listTree(dir);
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  const h = createHash("sha256");
  for (const f of files) {
    h.update(f.rel);
    h.update(f.bytes);
  }
  return h.digest("hex");
}

export function detectSpdx(text) {
  if (!text) return null;
  const t = String(text);
  if (/GNU AFFERO GENERAL PUBLIC LICENSE/i.test(t) && /Version 3/i.test(t)) return "AGPL-3.0-only";
  if (/GNU LESSER GENERAL PUBLIC LICENSE/i.test(t) && /Version 3/i.test(t)) return "LGPL-3.0-only";
  if (/GNU GENERAL PUBLIC LICENSE/i.test(t) && /Version 3/i.test(t)) return "GPL-3.0-only";
  if (/GNU GENERAL PUBLIC LICENSE/i.test(t) && /Version 2/i.test(t)) return "GPL-2.0-only";
  if (/Apache License/i.test(t) && /Version 2\.0/i.test(t)) return "Apache-2.0";
  if (/Mozilla Public License/i.test(t) && /2\.0/i.test(t)) return "MPL-2.0";
  if (/Redistribution and use in source and binary forms/i.test(t) && /Neither the name/i.test(t)) return "BSD-3-Clause";
  if (/Redistribution and use in source and binary forms/i.test(t)) return "BSD-2-Clause";
  if (/Permission is hereby granted, free of charge/i.test(t) || /\bMIT License\b/i.test(t)) return "MIT";
  if (/ISC License/i.test(t)) return "ISC";
  if (/This is free and unencumbered software released into the public domain/i.test(t)) return "Unlicense";
  if (/Creative Commons Zero|CC0 1\.0/i.test(t)) return "CC0-1.0";
  return null;
}

const LICENSE_FILE_RE = /^(LICENSE|LICENCE|COPYING|NOTICE)(\.(md|txt))?$/i;

// 1) arquivo de licenca no dir da skill; 2) `license:` no frontmatter do SKILL.md.
// lstat: um LICENSE simlinkado nunca e lido (fail-closed, S4).
export function readDeclaredLicense(skillDir) {
  let root;
  try {
    root = fs.lstatSync(skillDir);
  } catch {
    return null;
  }
  if (root.isSymbolicLink() || !root.isDirectory()) return null;
  for (const entry of fs.readdirSync(skillDir)) {
    if (!LICENSE_FILE_RE.test(entry)) continue;
    const p = path.join(skillDir, entry);
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink() || !st.isFile()) continue;
    const spdx = detectSpdx(fs.readFileSync(p, "utf8"));
    if (spdx) return { spdx, licenseFile: entry };
  }
  const skillMd = path.join(skillDir, "SKILL.md");
  if (fs.existsSync(skillMd)) {
    const text = fs.readFileSync(skillMd, "utf8");
    const m = text.match(/^license:\s*([^\s#]+)/m);
    if (m) return { spdx: m[1], licenseFile: "SKILL.md" };
  }
  return null;
}

// Resolve a licenca e aplica a allowlist SPDX (P-02=(i)). Retorna
// `{ spdx, licenseFile, allowed, fromSource, reason? }` ou null. Uma licenca
// declarada no frontmatter fora da allowlist (`UNLICENSED`/`PROPRIETARY`/…)
// retorna `allowed:false` — o chamador exclui a skill (fail-closed).
export function resolveLicense({ skillDir, source, sourceLicenses }) {
  const declared = readDeclaredLicense(skillDir);
  if (declared) {
    return {
      ...declared,
      allowed: isAllowedSpdx(declared.spdx),
      fromSource: false,
      ...(isAllowedSpdx(declared.spdx) ? {} : { reason: "license-not-allowed" }),
    };
  }
  const table = sourceLicenses ?? SOURCE_LICENSES;
  const src = table[source];
  if (src && src.spdx) {
    const allowed = isAllowedSpdx(src.spdx);
    return {
      spdx: src.spdx,
      licenseFile: aggregatedLicenseName(source),
      licenseText: src.licenseText,
      allowed,
      fromSource: true,
      ...(allowed ? {} : { reason: "license-not-allowed" }),
    };
  }
  return null;
}

export function inferStacks(name) {
  if (name.startsWith("dart-")) return ["dart"];
  if (name.startsWith("flutter-")) return ["flutter"];
  return [];
}

export function buildVendor({ sourceDir, sourceLock, sourceLicenses, sourceCommits, destDir }) {
  const src = path.resolve(sourceDir);
  const entries = (sourceLock && sourceLock.skills) || {};
  const commits = sourceCommits || {};
  const vendored = [];
  const excluded = [];
  const skills = {};
  for (const name of Object.keys(entries)) {
    const entry = entries[name];
    const skillDir = path.join(src, name);
    let st;
    try {
      st = fs.lstatSync(skillDir);
    } catch {
      excluded.push({ name, reason: "source-missing" });
      continue;
    }
    // lstat (nao segue): dir de skill simlinkado nunca e percorrido nem
    // vendorizado (fail-closed, P-02/S4).
    if (st.isSymbolicLink()) {
      excluded.push({ name, reason: "symlink" });
      continue;
    }
    if (!st.isDirectory()) {
      excluded.push({ name, reason: "source-missing" });
      continue;
    }
    const license = resolveLicense({ skillDir, source: entry.source, sourceLicenses });
    if (!license) {
      excluded.push({ name, reason: "no-license" });
      continue;
    }
    if (!license.allowed) {
      excluded.push({ name, reason: license.reason ?? "license-not-allowed", license: license.spdx });
      continue;
    }
    const computed = folderComputedHash(skillDir);
    if (entry.computedHash && computed !== entry.computedHash) {
      throw new VendorError(
        `computedHash divergente para ${name}: lock=${entry.computedHash} fonte=${computed}`,
        "HASH_MISMATCH",
      );
    }
    const { files } = listTree(skillDir);
    skills[name] = {
      source: entry.source,
      sourceType: entry.sourceType,
      sourceCommit: commits[entry.source] ?? entry.sourceCommit ?? null,
      skillPath: entry.skillPath,
      computedHash: entry.computedHash,
      treeHash: treeHash(skillDir),
      stacks: inferStacks(name),
      license: license.spdx,
      licenseFile: license.licenseFile,
    };
    vendored.push({ name, source: entry.source, files });
  }
  // Arquivos de licenca agregados (texto completo + copyright) escritos pelo
  // vendor na raiz do dest quando a licenca vem da fonte (nao do dir da skill).
  const aggregateBySource = new Map();
  for (const name of Object.keys(skills)) {
    const e = skills[name];
    const src2 = (sourceLicenses ?? SOURCE_LICENSES)[e.source];
    if (src2 && e.licenseFile === aggregatedLicenseName(e.source) && src2.licenseText) {
      aggregateBySource.set(e.source, {
        source: e.source,
        spdx: e.license,
        file: e.licenseFile,
        text: src2.licenseText,
        sha256: expectedLicenseSha(src2),
      });
    }
  }
  const licenses = [...aggregateBySource.values()];
  const lock = {
    version: VENDOR_LOCK_VERSION,
    generatedBy: "scripts/vendor-skills.mjs",
    // Hashes das licencas agregadas (sem o texto — ele vive no arquivo na
    // raiz do dest e no NOTICE). Permite ao `--check` validar `LICENSE-<slug>`.
    licenses: licenses.map(({ source, spdx, file, sha256 }) => ({ source, spdx, file, sha256 })),
    skills,
  };
  return { lock, vendored, excluded, destDir, licenses };
}

const SCRIPT_EXT_RE = /\.(sh|bash|zsh|fish|js|mjs|cjs|ts|tsx|py|rb|pl|ps1|bat|cmd|exe|bin|so|dylib|dll|jar)$/i;

function isExecutableFile(f) {
  if ((f.mode ?? 0) & 0o111) return true;
  if (SCRIPT_EXT_RE.test(f.rel)) return true;
  return f.bytes.slice(0, 2).toString("latin1") === "#!";
}

function renderNotice(built) {
  const { lock, excluded } = built;
  const names = Object.keys(lock.skills).sort();
  const sources = new Map();
  for (const name of names) {
    const e = lock.skills[name];
    if (!sources.has(e.source)) {
      sources.set(e.source, { source: e.source, sourceType: e.sourceType, sourceCommit: e.sourceCommit, spdx: e.license, licenseFile: e.licenseFile });
    }
  }
  const lines = [];
  lines.push("# VENDOR-NOTICE");
  lines.push("");
  lines.push("Vendor de skills de terceiros do harness. Gerado por `scripts/vendor-skills.mjs`.");
  lines.push(`Politica de licenca ${POLICY}: skill sem licenca identificavel NAO e vendorizada (fail-closed).`);
  lines.push("A copia e byte-identica a fonte; o drift (skill ou `LICENSE-<slug>` agregado) e barrado por `node scripts/vendor-skills.mjs --check`.");
  lines.push("");
  lines.push("## Fontes (proveniencia)");
  lines.push("");
  lines.push("| source | sourceType | sourceCommit | SPDX | licenseFile |");
  lines.push("|---|---|---|---|---|");
  for (const s of sources.values()) {
    lines.push(`| ${s.source} | ${s.sourceType} | ${s.sourceCommit ?? "(unknown)"} | ${s.spdx} | ${s.licenseFile} |`);
  }
  lines.push("");
  lines.push("## Licencas (texto completo + copyright)");
  lines.push("");
  const licenses = built.licenses ?? [];
  if (licenses.length === 0) {
    lines.push("Nenhuma licenca agregada: toda skill retem LICENSE/NOTICE proprio.");
  } else {
    lines.push("As licencas abaixo vivem no repositorio upstream, nao no dir da skill");
    lines.push("(por isso o `licenseFile` da skill aponta para o arquivo agregado).");
    lines.push("O vendor grava cada uma na raiz deste diretorio, byte-a-byte (sem");
    lines.push("newline final, como no upstream); o `--check` recomputa o sha256 e");
    lines.push("falha se o arquivo divergir ou faltar.");
    lines.push("");
    for (const lic of licenses) {
      lines.push(`### ${lic.source} — ${lic.spdx} (\`${lic.file}\`)`);
      lines.push("");
      lines.push("```text");
      lines.push(lic.text.replace(/\n$/, ""));
      lines.push("```");
      lines.push("");
    }
  }
  lines.push(`## Skills vendorizadas (${names.length})`);
  lines.push("");
  lines.push("| skill | source | stacks | computedHash | treeHash |");
  lines.push("|---|---|---|---|---|");
  for (const name of names) {
    const e = lock.skills[name];
    lines.push(`| ${name} | ${e.source} | ${e.stacks.join(",") || "-"} | ${e.computedHash} | ${e.treeHash} |`);
  }
  lines.push("");
  lines.push(`## Skills excluidas (${excluded.length})`);
  lines.push("");
  lines.push("| skill | motivo |");
  lines.push("|---|---|");
  for (const x of excluded) lines.push(`| ${x.name} | ${x.reason} |`);
  lines.push("");
  lines.push("## Revisao de conteudo (S1/S4)");
  lines.push("");
  const vendored = built.vendored ?? [];
  const allFiles = vendored.flatMap((v) => v.files);
  const execs = allFiles.filter(isExecutableFile);
  lines.push(`Arquivos vendorizados: ${allFiles.length}. Conteudo executavel: ${execs.length}. Symlinks: 0.`);
  if (execs.length) {
    lines.push("");
    lines.push("| skill | arquivo |");
    lines.push("|---|---|");
    for (const v of vendored) {
      for (const f of v.files) if (isExecutableFile(f)) lines.push(`| ${v.name} | ${f.rel} |`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

export function writeVendor(built, { destDir = built.destDir } = {}) {
  const dest = path.resolve(destDir);
  fs.mkdirSync(dest, { recursive: true });
  for (const v of built.vendored) {
    const target = path.join(dest, v.name);
    fs.rmSync(target, { recursive: true, force: true });
    for (const f of v.files) {
      const p = path.join(target, f.rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, f.bytes);
    }
  }
  // Licencas agregadas na raiz do dest (fora dos dirs das skills — I9).
  for (const lic of built.licenses ?? []) {
    if (!lic.file || lic.file.includes("/") || lic.file.includes("\\")) continue;
    fs.writeFileSync(path.join(dest, lic.file), lic.text);
  }
  fs.writeFileSync(path.join(dest, VENDOR_LOCK_NAME), JSON.stringify(built.lock, null, 2) + "\n");
  fs.writeFileSync(path.join(dest, VENDOR_NOTICE_NAME), renderNotice(built));
  return built;
}

export function checkVendor({ destDir, sourceLicenses } = {}) {
  const dest = path.resolve(destDir);
  const lockPath = path.join(dest, VENDOR_LOCK_NAME);
  const base = {
    errors: [],
    missing: [],
    divergences: [],
    symlinks: [],
    licenseMissing: [],
    licenseDivergences: [],
    licenseSymlinks: [],
  };
  if (!fs.existsSync(lockPath)) {
    return { ok: false, ...base, errors: [`lock ausente: ${VENDOR_LOCK_NAME}`] };
  }
  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch (e) {
    return { ok: false, ...base, errors: [`lock invalido: ${e.message}`] };
  }
  const skills = (lock && lock.skills) || {};
  const missing = [];
  const divergences = [];
  const symlinks = [];
  const errors = [];
  const licenseMissing = [];
  const licenseDivergences = [];
  const licenseSymlinks = [];
  for (const name of Object.keys(skills)) {
    const dir = path.join(dest, name);
    // lstat na RAIZ: um dir de skill simlinkado (mesmo que aponte para dir
    // valido) e symlink => FAIL. Tambem cobre symlink quebrado (existsSync
    // seguiria e diria "missing").
    let st;
    try {
      st = fs.lstatSync(dir);
    } catch {
      missing.push(name);
      continue;
    }
    if (st.isSymbolicLink()) {
      symlinks.push(name);
      continue;
    }
    if (!st.isDirectory()) {
      missing.push(name);
      continue;
    }
    let tree;
    try {
      tree = listTree(dir);
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
      continue;
    }
    if (tree.symlinks.length > 0) {
      symlinks.push(name);
      continue;
    }
    if (treeHash(dir) !== skills[name].treeHash) divergences.push(name);
  }

  // Licencas agregadas (`LICENSE-<slug>`). O lock registra o sha256 esperado;
  // quando a fonte esta na tabela, o hash congelado (`expectedLicenseSha`)
  // prevalece — divergencia entre lock e fonte e erro (desalinhados). Sem
  // hash esperado => FAIL (fail-closed): apagar/adulterar o arquivo nunca
  // passa silencioso.
  const table = sourceLicenses ?? SOURCE_LICENSES;
  const recorded = new Map();
  for (const lic of Array.isArray(lock.licenses) ? lock.licenses : []) {
    if (lic && typeof lic.file === "string" && lic.file) recorded.set(lic.file, lic.sha256 ?? null);
  }
  const expected = new Map();
  for (const name of Object.keys(skills)) {
    const e = skills[name] || {};
    const file = e.licenseFile;
    if (typeof file !== "string" || !file || file.includes("/") || file.includes("\\")) continue;
    if (file !== aggregatedLicenseName(e.source)) continue;
    const src = table[e.source];
    const fromTable = src ? expectedLicenseSha(src) : null;
    const fromLock = recorded.has(file) ? recorded.get(file) : null;
    if (fromTable && fromLock && fromTable !== fromLock) {
      errors.push(`${file}: hash da licenca divergente (lock=${fromLock} fonte=${fromTable})`);
    }
    const want = fromTable ?? fromLock;
    if (!want) {
      errors.push(`${file}: sem hash esperado para a licenca agregada (nao verificavel)`);
      continue;
    }
    if (expected.has(file) && expected.get(file) !== want) {
      errors.push(`${file}: hash esperado ambiguo`);
      continue;
    }
    expected.set(file, want);
  }
  // Entradas registradas no lock mas nao referenciadas por nenhuma skill
  // ainda sao validadas (nao ha arquivo agregado orfao passando em branco).
  for (const [file, h] of recorded) {
    if (h && !expected.has(file)) expected.set(file, h);
  }
  for (const [file, want] of expected) {
    const p = path.join(dest, file);
    let st;
    try {
      st = fs.lstatSync(p);
    } catch {
      licenseMissing.push(file);
      continue;
    }
    if (st.isSymbolicLink()) {
      licenseSymlinks.push(file);
      continue;
    }
    if (!st.isFile()) {
      licenseMissing.push(file);
      continue;
    }
    if (sha256(fs.readFileSync(p)) !== want) licenseDivergences.push(file);
  }

  const ok =
    missing.length === 0 &&
    divergences.length === 0 &&
    symlinks.length === 0 &&
    errors.length === 0 &&
    licenseMissing.length === 0 &&
    licenseDivergences.length === 0 &&
    licenseSymlinks.length === 0;
  return {
    ok,
    errors,
    missing,
    divergences,
    symlinks,
    licenseMissing,
    licenseDivergences,
    licenseSymlinks,
  };
}

function parseArgs(argv) {
  const out = { check: false, source: null, lock: null, dest: null, commits: {}, licenses: {}, json: false, help: false };
  const assign = (map, raw, flag) => {
    const i = raw.indexOf("=");
    if (i < 0) throw new VendorError(`${flag} exige <source>=<valor>`, "BAD_ARG");
    map[raw.slice(0, i)] = raw.slice(i + 1);
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--check") out.check = true;
    else if (a === "--source") out.source = argv[++i];
    else if (a === "--lock") out.lock = argv[++i];
    else if (a === "--dest") out.dest = argv[++i];
    else if (a === "--source-commit") assign(out.commits, argv[++i], "--source-commit");
    else if (a === "--source-license") assign(out.licenses, argv[++i], "--source-license");
    else if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else throw new VendorError(`flag desconhecida: ${a}`, "BAD_ARG");
  }
  return out;
}

const USAGE = `uso:
  node scripts/vendor-skills.mjs --source <dir> --lock <skills-lock.json> [--dest <dir>]
  node scripts/vendor-skills.mjs --check [--dest <dir>]`;

export function main(argv = process.argv.slice(2), { root = REPO_ROOT, log = console.log } = {}) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    log(`erro: ${e.message}`);
    return 2;
  }
  if (opts.help) {
    log(USAGE);
    return 0;
  }
  const destDir = opts.dest ? path.resolve(opts.dest) : path.join(root, ".agents", "skills");

  if (opts.check) {
    const res = checkVendor({ destDir });
    if (res.ok) {
      log(`vendor-check OK (${path.relative(root, path.join(destDir, VENDOR_LOCK_NAME))})`);
      return 0;
    }
    if (res.errors.length) for (const e of res.errors) log(`  error: ${e}`);
    for (const n of res.missing) log(`  missing: ${n}`);
    for (const n of res.divergences) log(`  divergent: ${n}`);
    for (const n of res.symlinks) log(`  symlink: ${n}`);
    for (const n of res.licenseMissing ?? []) log(`  missing-license: ${n}`);
    for (const n of res.licenseDivergences ?? []) log(`  divergent-license: ${n}`);
    for (const n of res.licenseSymlinks ?? []) log(`  symlink-license: ${n}`);
    log("vendor-check FAIL");
    return 1;
  }

  if (!opts.source || !opts.lock) {
    log(USAGE);
    return 2;
  }
  const sourceLock = JSON.parse(fs.readFileSync(path.resolve(opts.lock), "utf8"));
  const sourceLicenses = { ...SOURCE_LICENSES, ...opts.licenses };
  const sourceCommits = { ...opts.commits };
  for (const source of new Set(Object.values(sourceLock.skills || {}).map((s) => s.source))) {
    if (!sourceCommits[source]) {
      const sha = resolveRemoteCommit(source);
      if (sha) sourceCommits[source] = sha;
    }
  }
  const built = buildVendor({
    sourceDir: opts.source,
    sourceLock,
    sourceLicenses,
    sourceCommits,
    destDir,
  });
  writeVendor(built, { destDir });
  const summary = {
    vendored: built.vendored.map((v) => v.name),
    excluded: built.excluded,
    dest: path.relative(root, destDir),
  };
  if (opts.json) log(JSON.stringify(summary, null, 2));
  else {
    log(`vendored ${summary.vendored.length}: ${summary.vendored.join(", ")}`);
    for (const x of summary.excluded) log(`excluded ${x.name}: ${x.reason}`);
  }
  return 0;
}

// Best-effort source-side apenas (a fonte local ja e a fonte preferida).
function resolveRemoteCommit(source) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(source)) return null;
  try {
    const out = execFileSync("git", ["ls-remote", `https://github.com/${source}`, "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15000,
    });
    const m = out.match(/^([0-9a-f]{40})\s/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
