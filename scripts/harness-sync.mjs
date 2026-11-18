#!/usr/bin/env node
// harness-sync.mjs — deterministic harness payload synchronizer (v2, F1).
//
// Replaces the v1 installer (directories `installer`, `installer-rs` and
// `packaging`, deleted in this cycle). No wizard, no stack profiles, no axes,
// no TUI. Keep the literal directory names out of live prose: the v2 gate is
// "no reference to the deleted payload", and a path-shaped mention reads as one.
// The contract is three verbs over a file manifest:
//
//   node scripts/harness-sync.mjs init   --target <dir> [--dry-run] [--suite <cmd>] [--unit <cmd>]
//   node scripts/harness-sync.mjs update --target <dir> [--dry-run]
//   node scripts/harness-sync.mjs doctor --target <dir>
//
// Guarantees (each one is measured by `scripts/__tests__/sync.spec.mjs`):
//   G1. Determinism — the write set is exactly {p : sha256(target/p) !==
//       sha256(source/p)}; a second run writes 0 files. No timestamps, no
//       "managed marker" block, no ordering by directory enumeration luck.
//   G2. Backup before the first write — every path that will be overwritten
//       is copied to `<target>/.harness-backup/<UTC timestamp>/` first.
//   G3. Project data survives — `harness.config.json`, `workflow-state.json`,
//       `.agents/rules/project-*.md` and `.spec/**` are never written or
//       removed, even when the payload enumerates them.
//   G4. `opencode.json` is MERGED, not replaced: only the keys the source
//       declares are managed; project-only keys are preserved recursively.
//   G5. Zero network — `node:fs`/`node:path`/`node:crypto` only. No fetch, no
//       HTTP client, no network child process (the v1 `V15` check has no
//       subject now that the installer tree is gone; this file is covered by
//       NET-01 in `scripts/__tests__/sync.spec.mjs` instead of a scanner over
//       a deleted directory).
//
// Two deliberate departures from the v1 installer, both fail-closed:
//   - `init` refuses a target that already carries harness state (`.agents/`
//     or `.harness-manifest.json`) and points at `update`; it does NOT refuse
//     a target that merely carries project files (`package.json`, `pom.xml`),
//     because target detection reads exactly those.
//   - `doctor` is read-only and returns exit 1 listing every failure with its
//     path, instead of a verdict letter per marker.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SOURCE_ROOT = path.resolve(HERE, "..");

export const MANIFEST_NAME = ".harness-manifest.json";
export const MANIFEST_VERSION = 2;
export const BACKUP_DIR_NAME = ".harness-backup";
export const CONFIG_NAME = "harness.config.json";

// Payload owned by the harness. Everything here is overwritten on `update`
// when its hash differs; nothing outside it is touched.
export const PAYLOAD_DIRS = Object.freeze([
  ".agents/agents",
  ".agents/rules",
  ".agents/schemas",
  ".agents/skills",
  ".opencode/plugins",
  ".opencode/commands",
]);
export const PAYLOAD_FILES = Object.freeze([
  "scripts/harness-sync.mjs",
  "scripts/seal.mjs",
  "opencode.json",
]);

// Directories never walked (tests are harness-internal; VCS and bytecode
// caches are not payload — shipping `*.pyc` would copy a build artifact whose
// bytes also depend on the interpreter that produced it).
const SKIPPED_DIRS = new Set(["node_modules", ".git", "__tests__", "__pycache__"]);

// Project data: never written, never removed (G3).
const PRESERVED_FILES = new Set([CONFIG_NAME, "workflow-state.json"]);
const PRESERVED_PREFIXES = [".spec/"];
const PRESERVED_RES = [/^\.agents\/rules\/project-[^/]*\.md$/];

export function isPreserved(rel) {
  const posix = rel.split(path.sep).join("/");
  if (PRESERVED_FILES.has(posix)) return true;
  if (PRESERVED_PREFIXES.some((p) => posix.startsWith(p))) return true;
  return PRESERVED_RES.some((re) => re.test(posix));
}

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function readOrNull(file) {
  try {
    return fs.readFileSync(file);
  } catch {
    return null;
  }
}

function walkFiles(root, relDir) {
  const abs = path.join(root, relDir);
  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    return [];
  }
  if (stat.isFile()) return [relDir];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) continue;
    const rel = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      out.push(...walkFiles(root, rel));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

// The payload, sorted: enumeration order is part of determinism.
export function payloadFiles() {
  const files = [];
  for (const dir of PAYLOAD_DIRS) files.push(...walkFiles(SOURCE_ROOT, dir));
  for (const file of PAYLOAD_FILES) {
    if (fs.existsSync(path.join(SOURCE_ROOT, file))) files.push(file);
  }
  return [...new Set(files)].filter((rel) => !isPreserved(rel)).sort();
}

// --- opencode.json merge (G4) ---------------------------------------------
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Source wins on every key it declares; project-only keys survive. Recursive
// by key, so a project that adds an agent keeps it while managed agents are
// refreshed.
export function mergeManaged(source, target) {
  if (!isPlainObject(source) || !isPlainObject(target)) return source;
  const out = {};
  for (const [key, value] of Object.entries(target)) {
    out[key] = key in source ? mergeManaged(source[key], value) : value;
  }
  for (const [key, value] of Object.entries(source)) {
    if (!(key in out)) out[key] = value;
  }
  return out;
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// --- detection (never a question) -----------------------------------------
function readJson(file) {
  const raw = readOrNull(file);
  if (!raw) return null;
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
}

export function detectTargets(targetDir) {
  const pkg = readJson(path.join(targetDir, "package.json")) ?? {};
  const deps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
  };
  const has = (file) => fs.existsSync(path.join(targetDir, file));

  let frontend = null;
  if (deps.react) frontend = "react";
  else if (deps.vue) frontend = "vue";

  let backend = null;
  if (has("pom.xml")) backend = "java";
  else if (has("Cargo.toml")) backend = "rust";
  else if (deps["@nestjs/core"]) backend = "nestjs";
  else if (deps.express || deps.fastify) backend = "node";

  return { frontend, backend };
}

export function detectCommands(targetDir) {
  const pkg = readJson(path.join(targetDir, "package.json")) ?? {};
  if (fs.existsSync(path.join(targetDir, "pom.xml"))) return "mvn test";
  if (fs.existsSync(path.join(targetDir, "Cargo.toml"))) return "cargo test";
  if (pkg.scripts && typeof pkg.scripts.test === "string" && pkg.scripts.test.trim()) return "npm test";
  return null;
}

function sourceProtectedPaths() {
  const config = readJson(path.join(SOURCE_ROOT, CONFIG_NAME)) ?? {};
  return Array.isArray(config.protectedPaths) ? config.protectedPaths : [];
}

export function buildConfig(targetDir, { suite, unit } = {}) {
  const detected = detectCommands(targetDir);
  const suiteFull = suite ?? detected;
  const unitCmd = unit ?? suite ?? detected;
  return {
    version: MANIFEST_VERSION,
    project: path.basename(path.resolve(targetDir)),
    targets: detectTargets(targetDir),
    commands: { suiteFull, unit: unitCmd },
    evidence: { path: "harness/" },
    protectedPaths: sourceProtectedPaths(),
  };
}

// --- manifest -------------------------------------------------------------
export function readManifest(targetDir) {
  const raw = readOrNull(path.join(targetDir, MANIFEST_NAME));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.toString("utf8"));
    return parsed && typeof parsed === "object" && parsed.files ? parsed : null;
  } catch {
    return null;
  }
}

export function writeManifest(targetDir, files) {
  const body = { version: MANIFEST_VERSION, files };
  const sorted = {};
  for (const key of Object.keys(files).sort()) sorted[key] = files[key];
  fs.writeFileSync(path.join(targetDir, MANIFEST_NAME), serialize({ ...body, files: sorted }));
}

// --- plan -----------------------------------------------------------------
// One entry per payload path. `content` is what the target SHOULD hold
// (already merged for `opencode.json`), so the plan and the apply agree byte
// for byte.
export function buildPlan(targetDir) {
  const plan = [];
  for (const rel of payloadFiles()) {
    const sourceRaw = readOrNull(path.join(SOURCE_ROOT, rel));
    if (!sourceRaw) continue;
    // Raw bytes by default: a payload file is copied, never re-encoded. Only
    // `opencode.json` goes through text, because it is merged (G4).
    let wanted = sourceRaw;
    if (rel === "opencode.json") {
      let content = sourceRaw.toString("utf8");
      const targetRaw = readOrNull(path.join(targetDir, rel));
      const sourceJson = JSON.parse(content);
      if (targetRaw) {
        let targetJson = null;
        try {
          targetJson = JSON.parse(targetRaw.toString("utf8"));
        } catch {
          targetJson = null; // malformed project file: the managed block replaces it
        }
        content = serialize(mergeManaged(sourceJson, targetJson ?? {}));
      } else {
        content = serialize(sourceJson);
      }
      wanted = Buffer.from(content, "utf8");
    }
    const current = readOrNull(path.join(targetDir, rel));
    const action = !current ? "create" : sha256(current) === sha256(wanted) ? "skip" : "update";
    plan.push({ rel, action, content: wanted, sha: sha256(wanted) });
  }
  return plan;
}

function backupTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function applyPlan(targetDir, plan) {
  const writes = plan.filter((entry) => entry.action !== "skip");
  if (writes.length === 0) return { written: 0, backupDir: null };

  const backupDir = path.join(targetDir, BACKUP_DIR_NAME, backupTimestamp());
  let backedUp = 0;
  for (const entry of writes) {
    const current = readOrNull(path.join(targetDir, entry.rel));
    if (!current) continue; // nothing to preserve for a new file
    const dest = path.join(backupDir, entry.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, current);
    backedUp += 1;
  }

  for (const entry of writes) {
    const dest = path.join(targetDir, entry.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, entry.content);
  }

  const files = {};
  for (const entry of plan) files[entry.rel] = entry.sha;
  writeManifest(targetDir, files);
  // `init` on a fresh target backs up nothing (every write is a create): the
  // backup directory is only materialised when a file was actually preserved.
  return { written: writes.length, backupDir: backedUp > 0 ? backupDir : null };
}

// --- verbs ----------------------------------------------------------------
function ensureConfig(targetDir, opts, dryRun, log) {
  const configPath = path.join(targetDir, CONFIG_NAME);
  if (fs.existsSync(configPath)) {
    log(`skip ${CONFIG_NAME} (project data preserved)`);
    return;
  }
  const config = buildConfig(targetDir, opts);
  log(`create ${CONFIG_NAME} (targets=frontend:${config.targets.frontend ?? "null"}/backend:${config.targets.backend ?? "null"}, suiteFull:${config.commands.suiteFull ?? "null"})`);
  if (!dryRun) fs.writeFileSync(configPath, serialize(config));
}

export function runInit(targetDir, opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const log = opts.log ?? ((line) => console.log(line));
  if (!dryRun) fs.mkdirSync(targetDir, { recursive: true });

  for (const marker of [".agents", MANIFEST_NAME]) {
    if (fs.existsSync(path.join(targetDir, marker))) {
      const error = `harness-sync init: target já tem estado do harness (${marker}) — use \`node scripts/harness-sync.mjs update --target ${targetDir}\``;
      log(error);
      return 1;
    }
  }

  const plan = buildPlan(targetDir);
  for (const entry of plan) log(`${entry.action} ${entry.rel}`);
  ensureConfig(targetDir, opts, dryRun, log);

  if (dryRun) {
    log(`dry-run: ${plan.filter((e) => e.action !== "skip").length} write(s) planned, 0 written, no backup`);
    return 0;
  }
  const { written, backupDir } = applyPlan(targetDir, plan);
  log(`init: ${written} file(s) written${backupDir ? ` (backup: ${path.relative(targetDir, backupDir)})` : ""}`);
  return 0;
}

// `init` on a not-yet-existing target needs no special case: `buildPlan`
// reads a missing file as absent, so every payload path plans as `create`.

export function runUpdate(targetDir, opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const log = opts.log ?? ((line) => console.log(line));
  if (!fs.existsSync(targetDir)) {
    log(`harness-sync update: target inexistente (${targetDir}) — use init`);
    return 1;
  }
  const plan = buildPlan(targetDir);
  for (const entry of plan) log(`${entry.action} ${entry.rel}`);
  ensureConfig(targetDir, opts, dryRun, log);
  if (dryRun) {
    log(`dry-run: ${plan.filter((e) => e.action !== "skip").length} write(s) planned, 0 written, no backup`);
    return 0;
  }
  const { written, backupDir } = applyPlan(targetDir, plan);
  log(`update: ${written} file(s) written${backupDir ? ` (backup: ${path.relative(targetDir, backupDir)})` : ""}`);
  return 0;
}

export function runDoctor(targetDir, opts = {}) {
  const log = opts.log ?? ((line) => console.log(line));
  const failures = [];
  const fail = (what, detail) => failures.push(`${what}: ${detail}`);

  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    fail("target", `diretório inexistente: ${targetDir}`);
    for (const line of failures) log(`FAIL ${line}`);
    return 1;
  }

  for (const dir of PAYLOAD_DIRS) {
    if (!fs.existsSync(path.join(SOURCE_ROOT, dir))) continue; // camada que a fonte não publica
    const abs = path.join(targetDir, dir);
    const present = fs.existsSync(abs) && fs.statSync(abs).isDirectory();
    if (!present) fail("camada ausente", dir);
    else if (fs.readdirSync(abs).length === 0) fail("camada vazia", dir);
  }
  for (const file of PAYLOAD_FILES) {
    if (!fs.existsSync(path.join(SOURCE_ROOT, file))) continue;
    if (!fs.existsSync(path.join(targetDir, file))) fail("arquivo ausente", file);
  }

  const manifest = readManifest(targetDir);
  if (!manifest) fail("manifesto inválido ou ausente", MANIFEST_NAME);

  const config = readJson(path.join(targetDir, CONFIG_NAME));
  if (!config) fail("config inválido ou ausente", CONFIG_NAME);
  else if (typeof config.commands?.suiteFull !== "string" || !config.commands.suiteFull.trim()) {
    fail("commands.suiteFull nulo", CONFIG_NAME);
  }

  if (!readJson(path.join(targetDir, "opencode.json"))) fail("JSON inválido", "opencode.json");

  if (failures.length) {
    for (const line of failures) log(`FAIL ${line}`);
    return 1;
  }
  log(`doctor: OK (${manifest ? Object.keys(manifest.files).length : 0} arquivo(s) no manifesto)`);
  return 0;
}

// --- CLI ------------------------------------------------------------------
const USAGE = `uso: node scripts/harness-sync.mjs <init|update|doctor> --target <dir> [--dry-run] [--suite <cmd>] [--unit <cmd>]`;

function parseArgs(argv) {
  const opts = { verb: null, target: null, dryRun: false, suite: null, unit: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--target") opts.target = argv[++i] ?? null;
    else if (arg === "--suite") opts.suite = argv[++i] ?? null;
    else if (arg === "--unit") opts.unit = argv[++i] ?? null;
    else if (!opts.verb && !arg.startsWith("-")) opts.verb = arg;
  }
  return opts;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.verb || !opts.target) {
    console.log(USAGE);
    process.exit(opts.help ? 0 : 2);
  }
  const targetDir = path.resolve(opts.target);
  const run = { init: runInit, update: runUpdate, doctor: runDoctor }[opts.verb];
  if (!run) {
    console.log(USAGE);
    process.exit(2);
  }
  process.exit(run(targetDir, opts));
}
