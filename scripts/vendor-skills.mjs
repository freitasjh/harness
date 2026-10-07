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

// Licenca declarada pela fonte upstream quando o dir da skill nao retem
// arquivo LICENSE/NOTICE proprio. Verificado source-side contra o LICENSE
// do repositorio (dart-lang/skills e flutter/skills: BSD-3-Clause).
export const SOURCE_LICENSES = {
  "dart-lang/skills": { spdx: "BSD-3-Clause", licenseFile: "LICENSE" },
  "flutter/skills": { spdx: "BSD-3-Clause", licenseFile: "LICENSE" },
};

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
export function listTree(dir) {
  const files = [];
  const symlinks = [];
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
export function readDeclaredLicense(skillDir) {
  if (!fs.existsSync(skillDir)) return null;
  for (const entry of fs.readdirSync(skillDir)) {
    if (!LICENSE_FILE_RE.test(entry)) continue;
    const p = path.join(skillDir, entry);
    if (!fs.statSync(p).isFile()) continue;
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

export function resolveLicense({ skillDir, source, sourceLicenses }) {
  const declared = readDeclaredLicense(skillDir);
  if (declared) return declared;
  const table = sourceLicenses ?? SOURCE_LICENSES;
  const src = table[source];
  if (src && src.spdx) return { spdx: src.spdx, licenseFile: src.licenseFile ?? "LICENSE" };
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
    if (!fs.existsSync(skillDir) || !fs.statSync(skillDir).isDirectory()) {
      excluded.push({ name, reason: "source-missing" });
      continue;
    }
    const license = resolveLicense({ skillDir, source: entry.source, sourceLicenses });
    if (!license) {
      excluded.push({ name, reason: "no-license" });
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
  const lock = {
    version: VENDOR_LOCK_VERSION,
    generatedBy: "scripts/vendor-skills.mjs",
    skills,
  };
  return { lock, vendored, excluded, destDir };
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
  lines.push("A copia e byte-identica a fonte; o drift e barrado por `node scripts/vendor-skills.mjs --check`.");
  lines.push("");
  lines.push("## Fontes (proveniencia)");
  lines.push("");
  lines.push("| source | sourceType | sourceCommit | SPDX | licenseFile |");
  lines.push("|---|---|---|---|---|");
  for (const s of sources.values()) {
    lines.push(`| ${s.source} | ${s.sourceType} | ${s.sourceCommit ?? "(unknown)"} | ${s.spdx} | ${s.licenseFile} |`);
  }
  lines.push("");
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
  fs.writeFileSync(path.join(dest, VENDOR_LOCK_NAME), JSON.stringify(built.lock, null, 2) + "\n");
  fs.writeFileSync(path.join(dest, VENDOR_NOTICE_NAME), renderNotice(built));
  return built;
}

export function checkVendor({ destDir }) {
  const dest = path.resolve(destDir);
  const lockPath = path.join(dest, VENDOR_LOCK_NAME);
  if (!fs.existsSync(lockPath)) {
    return { ok: false, errors: [`lock ausente: ${VENDOR_LOCK_NAME}`], missing: [], divergences: [], symlinks: [] };
  }
  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch (e) {
    return { ok: false, errors: [`lock invalido: ${e.message}`], missing: [], divergences: [], symlinks: [] };
  }
  const skills = (lock && lock.skills) || {};
  const missing = [];
  const divergences = [];
  const symlinks = [];
  const errors = [];
  for (const name of Object.keys(skills)) {
    const dir = path.join(dest, name);
    if (!fs.existsSync(dir)) {
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
  const ok = missing.length === 0 && divergences.length === 0 && symlinks.length === 0 && errors.length === 0;
  return { ok, errors, missing, divergences, symlinks };
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
