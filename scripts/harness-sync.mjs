#!/usr/bin/env node
// harness-sync.mjs — deterministic harness payload synchronizer (v2, F1).
//
// Replaces the v1 installer (the directories deleted in this cycle). No wizard,
// no stack profiles, no axes, no TUI. Keeping the literal directory names out
// of live prose is a WRITING CONVENTION: no check measures it, so a mention is
// not a gate violation — it is just noise for the next reader.
// The contract is three verbs over a file manifest:
//
//   node scripts/harness-sync.mjs init   --target <dir> [--dry-run] [--suite <cmd>] [--unit <cmd>]
//   node scripts/harness-sync.mjs update --target <dir> [--dry-run] [--backup-dir <dir>]
//   node scripts/harness-sync.mjs doctor --target <dir>
//
// Guarantees (each one is measured by `scripts/__tests__/sync.spec.mjs`):
//   G1. Determinism — the write set is exactly {p : sha256(target/p) !==
//       sha256(source/p)}; a second run writes 0 files. No timestamps, no
//       "managed marker" block, no ordering by directory enumeration luck.
//   G2. Backup before the first write — every PAYLOAD path that will be
//       overwritten is copied to `<parent of target>/.harness-backup/<name>-<timestamp>/`
//       first. (The manifest and the generated config are written, not payload:
//       the manifest is a ledger the run regenerates and the config is created
//       only when absent, so neither is a project file a backup would rescue.)
//       Never inside the target: a backup is not payload, and an
//       in-target copy would be enumerated as project content by the next run.
//   G3. Project data survives — `harness.config.json`, `workflow-state.json`,
//       `.agents/rules/project-*.md` and `.spec/**` are never OVERWRITTEN or
//       removed, even when the payload enumerates them. The generated config is
//       the one project file this script creates (only when absent), and it is
//       created by the SAME guarded, atomic path as the payload (see G6/G7); it
//       never enters the manifest, because a manifest claim over project data
//       would make `update` rewrite the operator's own commands on the next run.
//   G4. `opencode.json` is MERGED, not replaced: only the keys the source
//       declares are managed; project-only keys are preserved recursively.
//   G5. Zero network — `node:fs`/`node:path`/`node:crypto` and a local
//       `git rev-parse` only. No fetch, no HTTP client, no network command
//       (the v1 `V15` check has no subject now that the installer tree is
//       gone; this file is covered by NET-01 in `scripts/__tests__/sync.spec.mjs`
//       instead of a scanner over a deleted directory).
//   G6. No write through a symlink — every path this run writes (payload,
//       generated config, manifest) is checked component by component with
//       `lstat` before the plan is applied and again before each write; the
//       BACKUP destination is checked the same way, including the directory a
//       `--backup-dir` names. A link anywhere in a chain aborts the WHOLE run
//       with exit 1, before the backup and before any byte is written. The
//       check runs on the PATH, not on `existsSync`: `existsSync` follows the
//       link, so a dangling link would read as "absent" and the write would
//       land on the far side of it.
//   G7. Atomic replace — each file (payload, config, manifest and each backup
//       copy) is written as `<name>.tmp-<pid>` and then renamed; the manifest
//       is written LAST, so a crash never leaves a manifest claiming files that
//       were not written.
//   G8. The manifest is a PRESERVING ledger — a path the target manifest
//       records and the payload no longer publishes (an orphan) survives every
//       rewrite of the manifest. `update` also recreates a missing/stale
//       manifest when the payload is already byte-identical, so a deleted
//       manifest is not a permanent "0 writes, nothing to do".
//   G9. `commands.suiteFull` is required by BOTH verbs — `init` and `update`
//       share the guard, so `update` cannot install a config whose canonical
//       command is null either.
//   G10. One write path — `writeGuarded(root, rel, content)` is the only
//       function that writes: it walks the path (`assertNoLinkInPath`), creates
//       the directory and performs the atomic replace. `writeAtomic` is private
//       to it, so a new loop (the backup copy was one) cannot write unguarded.
//
// Deliberate, fail-closed departures from the v1 installer:
//   - `init` refuses a target that already carries harness state (`.agents/`,
//     `.harness-manifest.json`, `.opencode/plugins/`, `.opencode/commands/`)
//     and points at `update`; it does NOT refuse a target that merely carries
//     project files (`package.json`, `pom.xml`), because target detection
//     reads exactly those.
//   - `init` also refuses to succeed without `commands.suiteFull`: a target
//     whose config says "no canonical command" makes every gate that reads it
//     fail closed later. Pass `--suite <cmd>` to state it explicitly. `update`
//     shares the same guard for the case where it is the verb creating the
//     config (G9).
//   - `doctor` is read-only and returns exit 1 listing every failure with its
//     path, instead of a verdict letter per marker. It re-hashes the files the
//     manifest names, so a payload corrupted after install is a FAIL, not a
//     silence.
//
// What this file does NOT do (declared, not silently skipped):
//   - `update` never deletes: a path recorded in the target manifest that the
//     payload no longer publishes is printed as `orphan <path> (não removido)`.
//     There is no `--prune` in this phase, so the decision stays with a human.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SOURCE_ROOT = path.resolve(HERE, "..");

export const MANIFEST_NAME = ".harness-manifest.json";
export const MANIFEST_VERSION = 2;
export const BACKUP_DIR_NAME = ".harness-backup";
export const CONFIG_NAME = "harness.config.json";
// Pin of the sibling `brain` checkout (`brain-context.md` G1). Doctor REPORTS
// divergence and never fails on it: the brain is a separate repo, and its
// absence is a normal state of a fresh target.
export const BRAIN_DIR_NAME = "brain";
export const BRAIN_PIN = "8b965093a00d291195313fe457b3aa35bbff71f2";

// Payload owned by the harness. Everything here is overwritten on `update`
// when its hash differs; nothing outside it is touched.
// `.opencode/commands` is listed ahead of the layer it will carry: the source
// repo has no such directory yet, so `walkFiles` returns [] for it today and
// `doctor` skips it (it only checks layers the source publishes). The entry
// stays so F2 can populate it without a second contract change — until then it
// is a documented pending layer, not a silent one.
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

// `existsSync` FOLLOWS a link, so a dangling one reads as "absent" and the
// write lands on the far side. `lstat` answers about the entry itself, which is
// the only question this script may ask before writing (G6).
function lexists(abs) {
  try {
    fs.lstatSync(abs);
    return true;
  } catch {
    return false;
  }
}

// --- write safety (G6) -----------------------------------------------------
// A symlink planted in the target turns "copy the payload" into "overwrite a
// file outside the target". The check is component by component with `lstat`
// (never `stat`: it would follow the link and see the far side), so a link at
// `.agents`, `.agents/rules` or the file itself is caught.
//
// L2 (5º passe): the walk is its OWN function because it has two consumers with
// different questions — `writeGuarded` (may I write here?) and `runDoctor` (is
// the path I am about to re-hash free of links?). When only the writer walked,
// the reader followed the link and re-hashed the far side.
export function assertNoLinkInPath(root, rel) {
  const lexical = path.resolve(root, rel);
  let realRoot;
  try {
    realRoot = fs.realpathSync(root);
  } catch {
    // Root ainda não existe (init --dry-run num path novo, backup a criar): não
    // há componente a atravessar, portanto não há link plantado. O caminho
    // lexical já foi normalizado por `path.resolve`.
    return lexical;
  }
  const resolved = path.resolve(realRoot, rel);
  // Contenção lexical: um `rel` com `..` sairia do root mesmo sem link nenhum.
  if (resolved !== realRoot && !resolved.startsWith(realRoot + path.sep)) {
    throw new Error(`path escapa do target (${rel})`);
  }
  let current = realRoot;
  for (const part of rel.split(path.sep)) {
    if (!part || part === ".") continue;
    current = path.join(current, part);
    let st;
    try {
      st = fs.lstatSync(current);
    } catch {
      break; // nothing below a missing component can be a link
    }
    if (st.isSymbolicLink()) {
      throw new Error(`symlink no destino (${rel}) → ${current}; run recusado`);
    }
  }
  return resolved;
}

// O nome do guard do destino: contenção lexical + walk de componentes. É a
// MESMA regra que `assertNoLinkInPath` aplica — o alias existe para os call
// sites de plano (que perguntam antes de qualquer byte), e `writeGuarded`
// chama este par a cada escrita para que a regra não dependa do call site.
export function assertSafeWrite(targetDir, rel) {
  return assertNoLinkInPath(targetDir, rel);
}

// A target that IS the source would make `update` compare a file with itself
// and report 0 writes while the backup machinery walks the real payload.
export function assertNotSource(targetDir) {
  if (path.resolve(targetDir) === path.resolve(SOURCE_ROOT)) {
    throw new Error("target é a própria fonte: rode do checkout do harness");
  }
}

// N7: the backup lives OUTSIDE the target, so `assertSafeWrite` (which resolves
// relative to the target) does not cover it. The same component-by-component
// `lstat` rule applies: a symlink anywhere below the deepest existing ancestor
// — including the directory `--backup-dir` names — would make the COPY of a
// project file land wherever the link points. Ancestors above it are the
// operator's filesystem (e.g. `/tmp` is a link on some systems) and are not
// this run's write surface.
export function assertSafeBackupDir(dir) {
  const abs = path.resolve(dir);
  const chain = [];
  for (let current = abs; ; current = path.dirname(current)) {
    chain.unshift(current);
    if (path.dirname(current) === current) break;
  }
  let deepestExisting = -1;
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    if (lexists(chain[i])) {
      deepestExisting = i;
      break;
    }
  }
  for (let i = deepestExisting; i >= 0 && i < chain.length; i += 1) {
    let st;
    try {
      st = fs.lstatSync(chain[i]);
    } catch {
      break; // below a missing component nothing can be a link
    }
    if (st.isSymbolicLink()) {
      throw new Error(`symlink no diretório de backup (${abs}) → ${chain[i]}; run recusado`);
    }
    if (!st.isDirectory()) break; // a file in the chain: mkdir will fail loudly
  }
  return abs;
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
  // The manifest is a write like any other: it goes through `writeGuarded`, so
  // the guard cannot be forgotten by a caller that only wanted the ledger.
  writeGuarded(targetDir, MANIFEST_NAME, Buffer.from(serialize({ ...body, files: sorted }), "utf8"));
}

// G7: `<name>.tmp-<pid>` + rename. The rename is the only step that replaces
// the destination, so a reader never sees a half-written payload file.
//
// R-1: the temporary is a WRITE path too, and `<name>.tmp-<pid>` is predictable
// — a link planted there would be followed by `writeFileSync` and the bytes
// would land outside the target (the manifest claim would then be a lie about a
// file this run never wrote). `wx` = O_CREAT|O_EXCL: it fails instead of
// following the link, and an existing entry (file, link or directory) is a
// refusal, never a target. The temporary is removed on ANY failure so a refused
// run leaves no `.tmp-*` behind; the cleanup never masks the original error.
function writeAtomic(dest, content) {
  const tmp = `${dest}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tmp, content, { flag: "wx" });
    fs.renameSync(tmp, dest);
  } catch (error) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // cleanup is best-effort: the error that stopped the write is the reason
    }
    if (error?.code === "EEXIST") {
      throw new Error(`temporário já existe: possível symlink plantado (${tmp})`);
    }
    throw error;
  }
}

// L1 (5º passe): the ONLY write path of this script. The previous shape guarded
// each CALL SITE (payload, generated config, manifest, backup copy) and the
// backup loop was added without its guard — the defect class was "every new
// loop can forget the walk". Now the walk and the atomic replace live in one
// function, `writeAtomic` is private to it, and there is no exported way to
// reach `fs.writeFileSync`/`fs.renameSync` without passing `assertSafeWrite`.
// The backup copy passes the BACKUP root as `root`, so the same rule covers the
// tree that lives outside the target.
function writeGuarded(root, rel, content) {
  const dest = assertSafeWrite(root, rel); // assertNoLinkInPath: contenção + walk
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  writeAtomic(dest, content);
  return dest;
}

// --- plan -----------------------------------------------------------------
// One entry per path the run may write. `content` is what the target SHOULD
// hold (already merged for `opencode.json`), so the plan and the apply agree
// byte for byte. Every path is checked for symlinks BEFORE the create/update/
// skip decision: a refusal must not depend on whether the file happened to
// differ.
//
// N1: the generated config rides in the SAME plan as the payload. `init` used to
// write it with a bare `writeFileSync` after the plan was validated, so a
// symlink planted at `harness.config.json` was either followed (`existsSync`
// answered about the far side) or silently treated as "project data, skip".
// `inManifest: false` keeps it out of the manifest claim (G3).
export function planConfig(targetDir, opts = {}) {
  assertSafeWrite(targetDir, CONFIG_NAME);
  const configPath = path.join(targetDir, CONFIG_NAME);
  if (lexists(configPath)) {
    return { rel: CONFIG_NAME, action: "skip", content: null, sha: null, inManifest: false };
  }
  const config = buildConfig(targetDir, opts);
  const content = Buffer.from(serialize(config), "utf8");
  return { rel: CONFIG_NAME, action: "create", content, sha: sha256(content), config, inManifest: false };
}

export function buildPlan(targetDir, opts = {}) {
  const plan = [];
  for (const rel of payloadFiles()) {
    const sourceRaw = readOrNull(path.join(SOURCE_ROOT, rel));
    if (!sourceRaw) continue;
    assertSafeWrite(targetDir, rel);
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
  plan.push(planConfig(targetDir, opts));
  return plan;
}

// `<parent>/.harness-backup/<name>-<ISO with ms>/` — OUTSIDE the target (D2=A).
// Inside, the backup would be enumerated as project content by the next run and
// would sit in the very tree the operator is about to inspect.
export function defaultBackupDir(targetDir) {
  const resolved = path.resolve(targetDir);
  return path.join(path.dirname(resolved), BACKUP_DIR_NAME, `${path.basename(resolved)}-${backupTimestamp()}`);
}

function backupTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// N2: the manifest is a LEDGER, not a snapshot of the current payload. Entries
// the target records and the payload no longer publishes are orphans: they are
// reported, never deleted, and they must survive every rewrite of the manifest
// — otherwise the first `update` that writes anything would erase the record
// and the `orphan` line would vanish from the next run.
function manifestFiles(targetDir, plan) {
  const current = readManifest(targetDir);
  const files = {};
  const planned = new Set(plan.map((entry) => entry.rel));
  for (const [rel, sha] of Object.entries(current?.files ?? {})) {
    if (!planned.has(rel)) files[rel] = sha;
  }
  for (const entry of plan) {
    if (entry.inManifest === false || !entry.sha) continue;
    files[entry.rel] = entry.sha;
  }
  return files;
}

function sameHashes(left, right) {
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => right[key] === left[key]);
}

function applyPlan(targetDir, plan, { backupDir } = {}) {
  const writes = plan.filter((entry) => entry.action !== "skip");
  const currentManifest = readManifest(targetDir);
  const desiredFiles = manifestFiles(targetDir, plan);
  // N9: a missing or stale manifest is repaired even when the payload is already
  // byte-identical — otherwise `rm .harness-manifest.json` would leave `update`
  // reporting "0 writes" forever and `doctor` failing forever.
  const manifestStale = !currentManifest || !sameHashes(currentManifest.files, desiredFiles);
  if (writes.length === 0 && !manifestStale) return { written: 0, backupDir: null, manifestRewritten: false };

  // Re-check the whole write set before touching anything: the backup itself
  // must not be the first thing a planted symlink captures.
  assertNotSource(targetDir);
  for (const entry of writes) assertSafeWrite(targetDir, entry.rel);
  if (manifestStale) assertSafeWrite(targetDir, MANIFEST_NAME);

  const target = path.resolve(targetDir);
  let dir = null;
  if (writes.length > 0) {
    dir = backupDir ? path.resolve(backupDir) : defaultBackupDir(target);
    const relativeToTarget = path.relative(target, dir);
    if (!relativeToTarget.startsWith("..") && !path.isAbsolute(relativeToTarget)) {
      throw new Error(`backup não pode ficar dentro do target (${dir})`);
    }
    // N7: the backup directory is outside the target and therefore outside
    // `assertSafeWrite`; a link there would capture the copy of a project file.
    assertSafeBackupDir(dir);
  }

  let backedUp = 0;
  for (const entry of writes) {
    const current = readOrNull(path.join(targetDir, entry.rel));
    if (!current) continue; // nothing to preserve for a new file
    // L1: each copy goes through `writeGuarded` against the BACKUP root — the
    // loop that used to write without a guard is now unable to: the atomic
    // replace has no public caller.
    writeGuarded(dir, entry.rel, current);
    backedUp += 1;
  }

  for (const entry of writes) {
    writeGuarded(targetDir, entry.rel, entry.content);
  }

  // Manifest LAST (G7): it is the claim that the files are there, so it can
  // only be true after they are.
  if (manifestStale) writeManifest(targetDir, desiredFiles);
  // `init` on a fresh target backs up nothing (every write is a create): the
  // backup directory is only materialised when a file was actually preserved.
  return { written: writes.length, backupDir: backedUp > 0 ? dir : null, manifestRewritten: manifestStale };
}

// A7: paths the target manifest records that the payload no longer ships. They
// are REPORTED, never deleted — removing a file the operator may have edited is
// a decision for a human, and `--prune` does not exist in this phase.
export function orphans(targetDir, plan) {
  const manifest = readManifest(targetDir);
  if (!manifest) return [];
  const planned = new Set(plan.map((entry) => entry.rel));
  return Object.keys(manifest.files)
    .filter((rel) => !planned.has(rel))
    .sort();
}

// --- verbs ----------------------------------------------------------------
// Markers of "this target already carries harness state". `.agents/` alone
// already implies `.agents/skills`, but both are listed: a half-installed
// target can have one without the other, and each is named in the refusal so
// the operator knows which one fired.
const HARNESS_STATE_MARKERS = [
  ".agents",
  ".agents/skills",
  ".opencode/plugins",
  ".opencode/commands",
  MANIFEST_NAME,
];

// G9 / N3: the guard is SHARED by `init` and `update`. Only a config that is
// about to be created needs it — an existing config is project data and is
// never overwritten, so its (possibly odd) commands are the operator's call.
function requireSuiteFull(entry, log, verb) {
  if (!entry || !entry.config) return true;
  const suite = entry.config.commands.suiteFull;
  if (typeof suite !== "string" || !suite.trim()) {
    log(`harness-sync ${verb}: commands.suiteFull não detectado: passe --suite <cmd>`);
    return false;
  }
  return true;
}

function logPlan(plan, log) {
  for (const entry of plan) {
    if (!entry.config) {
      log(`${entry.action} ${entry.rel}`);
      continue;
    }
    const { frontend, backend } = entry.config.targets;
    const suite = entry.config.commands.suiteFull ?? "null";
    log(`${entry.action} ${entry.rel} (targets=frontend:${frontend ?? "null"}/backend:${backend ?? "null"}, suiteFull:${suite})`);
  }
}

export function runInit(targetDir, opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const log = opts.log ?? ((line) => console.log(line));
  try {
    assertNotSource(targetDir);
  } catch (error) {
    log(`harness-sync init: ${error.message}`);
    return 1;
  }
  if (!dryRun) fs.mkdirSync(targetDir, { recursive: true });

  for (const marker of HARNESS_STATE_MARKERS) {
    if (fs.existsSync(path.join(targetDir, marker))) {
      const error = `harness-sync init: estado do harness já presente (${marker}) — use \`node scripts/harness-sync.mjs update --target ${targetDir}\``;
      log(error);
      return 1;
    }
  }

  let plan;
  try {
    plan = buildPlan(targetDir, opts);
  } catch (error) {
    log(`harness-sync init: ${error.message}`);
    return 1;
  }
  // Refusing here (exit 1, zero writes) beats installing a config that lies:
  // a config without `commands.suiteFull` is a target where the contraprova
  // cannot run, and every gate that reads it fails closed on the first
  // Completion. Runs for `--dry-run` too — the command is the config's
  // contract, not the apply's.
  if (!requireSuiteFull(plan.find((entry) => entry.rel === CONFIG_NAME), log, "init")) return 1;
  logPlan(plan, log);

  if (dryRun) {
    log(`dry-run: ${plan.filter((e) => e.action !== "skip").length} write(s) planned, 0 written, no backup`);
    return 0;
  }
  let applied;
  try {
    applied = applyPlan(targetDir, plan, opts);
  } catch (error) {
    log(`harness-sync init: ${error.message}`);
    return 1;
  }
  const { written, backupDir } = applied;
  log(`init: ${written} file(s) written${backupDir ? ` (backup: ${backupDir})` : ""}`);
  return 0;
}

// `init` on a not-yet-existing target needs no special case: `buildPlan`
// reads a missing file as absent, so every payload path plans as `create`.

export function runUpdate(targetDir, opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const log = opts.log ?? ((line) => console.log(line));
  try {
    assertNotSource(targetDir);
  } catch (error) {
    log(`harness-sync update: ${error.message}`);
    return 1;
  }
  if (!fs.existsSync(targetDir)) {
    log(`harness-sync update: target inexistente (${targetDir}) — use init`);
    return 1;
  }
  let plan;
  try {
    plan = buildPlan(targetDir, opts);
  } catch (error) {
    log(`harness-sync update: ${error.message}`);
    return 1;
  }
  const configEntry = plan.find((entry) => entry.rel === CONFIG_NAME);
  // G9/N3: `update` is the verb that CREATES the config when the target lacks
  // one; the guard is the same one `init` uses, so this path cannot install a
  // config whose canonical command is null.
  if (!requireSuiteFull(configEntry, log, "update")) return 1;
  // I1: an EXISTING config is project data — never rewritten, so its null
  // `suiteFull` cannot be repaired here. Silence would be a green `update` on a
  // target where every gate reading the config fails closed at Completion: the
  // operator is warned, the run keeps exit 0, and not one byte of the config
  // changes.
  //
  // I1 (5º passe): the warning names the ACTUAL defect. A config that does not
  // parse has no `commands.suiteFull` to be null — `readJson` answered null and
  // the old code blamed the suite key for a JSON syntax error. `doctor` is the
  // verb that reproves it, so the warning says exactly that.
  if (configEntry && configEntry.action === "skip") {
    const raw = readOrNull(path.join(targetDir, CONFIG_NAME));
    let existing = null;
    let parsed = false;
    if (raw) {
      try {
        existing = JSON.parse(raw.toString("utf8"));
        parsed = true;
      } catch {
        parsed = false;
      }
    }
    if (!parsed) {
      log(`WARN ${CONFIG_NAME} inválido — doctor reprova`);
    } else {
      const suite = existing?.commands?.suiteFull;
      if (typeof suite !== "string" || !suite.trim()) {
        log(`WARN commands.suiteFull nulo em ${CONFIG_NAME} — o gate negará Completed até ser preenchido`);
      }
    }
  }
  logPlan(plan, log);
  for (const rel of orphans(targetDir, plan)) log(`orphan ${rel} (não removido)`);
  if (dryRun) {
    log(`dry-run: ${plan.filter((e) => e.action !== "skip").length} write(s) planned, 0 written, no backup`);
    return 0;
  }
  let applied;
  try {
    applied = applyPlan(targetDir, plan, opts);
  } catch (error) {
    log(`harness-sync update: ${error.message}`);
    return 1;
  }
  const { written, backupDir } = applied;
  log(`update: ${written} file(s) written${backupDir ? ` (backup: ${backupDir})` : ""}`);
  // N9: the payload was already byte-identical; only the ledger was repaired.
  if (applied.manifestRewritten && written === 0) log(`manifest rewritten (${MANIFEST_NAME})`);
  return 0;
}

// A1: the sibling `brain` checkout is pinned by `brain-context.md`. The pin is
// REPORTED (WARN), never enforced: this verb validates the harness payload, and
// a brain at a different commit is a fact for the operator, not a broken target.
function brainWarning(targetDir, log) {
  const brainDir = path.resolve(targetDir, "..", BRAIN_DIR_NAME);
  if (!fs.existsSync(brainDir)) {
    log("WARN brain ausente: pin não verificado");
    return;
  }
  let head;
  try {
    head = execFileSync("git", ["-C", brainDir, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
  } catch (error) {
    log(`WARN brain não é checkout git (${brainDir}): pin não verificado`);
    return;
  }
  if (head !== BRAIN_PIN) {
    log(`WARN brain em commit diferente do pin: ${brainDir} HEAD=${head} pin=${BRAIN_PIN}`);
  }
}

export function runDoctor(targetDir, opts = {}) {
  const log = opts.log ?? ((line) => console.log(line));
  const failures = [];
  const fail = (what, detail) => failures.push(`${what}: ${detail}`);

  try {
    assertNotSource(targetDir);
  } catch (error) {
    log(`harness-sync doctor: ${error.message}`);
    return 1;
  }

  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    fail("target", `diretório inexistente: ${targetDir}`);
    for (const line of failures) log(`FAIL ${line}`);
    return 1;
  }

  // L2: `lstat`, never `stat`. A layer replaced by a link to a directory used
  // to read as "present" and the reader went through the link; the layer itself
  // is a FAIL before any hash is computed.
  for (const dir of PAYLOAD_DIRS) {
    if (!fs.existsSync(path.join(SOURCE_ROOT, dir))) continue; // camada que a fonte não publica
    const abs = path.join(targetDir, dir);
    let st = null;
    try {
      st = fs.lstatSync(abs);
    } catch {
      st = null;
    }
    if (!st) fail("camada ausente", dir);
    else if (st.isSymbolicLink()) fail("camada é symlink", dir);
    else if (!st.isDirectory()) fail("camada não é diretório", dir);
    else if (fs.readdirSync(abs).length === 0) fail("camada vazia", dir);
  }
  for (const file of PAYLOAD_FILES) {
    if (!fs.existsSync(path.join(SOURCE_ROOT, file))) continue;
    if (!fs.existsSync(path.join(targetDir, file))) fail("arquivo ausente", file);
  }

  const manifest = readManifest(targetDir);
  if (!manifest) fail("manifesto inválido ou ausente", MANIFEST_NAME);
  else {
    // A6: the manifest is the claim "these bytes were written". Re-hash the
    // claim instead of trusting it — a payload corrupted after install (one
    // byte is enough) must be a FAIL, not a green doctor.
    //
    // R-2: `lstat` FIRST, entry by entry. `readFileSync` follows a link, so a
    // payload file replaced by a link to identical bytes would re-hash green
    // while the target no longer holds those bytes. A link is a FAIL on its own
    // — the hash is never computed through it.
    //
    // L2: the LEAF is not the only place a link can be planted — a component
    // (`.agents/rules` → dir externo) sends the read outside the target with
    // every entry still hashing green. `assertNoLinkInPath` walks the whole
    // chain first, and the same rule the writer uses answers the reader. The
    // message names the leaf separately because "the file is a link" and "a
    // parent directory is a link" are different repairs.
    for (const [rel, expected] of Object.entries(manifest.files)) {
      const abs = path.join(targetDir, rel);
      let blocked = null;
      try {
        assertNoLinkInPath(targetDir, rel);
      } catch (error) {
        blocked = error;
      }
      if (blocked) {
        let leafIsLink = false;
        try {
          leafIsLink = fs.lstatSync(abs).isSymbolicLink();
        } catch {
          leafIsLink = false;
        }
        fail(leafIsLink ? "arquivo do manifesto é symlink" : "symlink no caminho", rel);
        continue;
      }
      let st = null;
      try {
        st = fs.lstatSync(abs);
      } catch {
        st = null;
      }
      if (!st) fail("arquivo do manifesto ausente", rel);
      else if (st.isSymbolicLink()) fail("arquivo do manifesto é symlink", rel);
      else {
        const current = readOrNull(abs);
        if (!current) fail("arquivo do manifesto ausente", rel);
        else if (sha256(current) !== expected) fail("sha256 divergente do manifesto", rel);
      }
    }
  }

  const config = readJson(path.join(targetDir, CONFIG_NAME));
  if (!config) fail("config inválido ou ausente", CONFIG_NAME);
  else if (typeof config.commands?.suiteFull !== "string" || !config.commands.suiteFull.trim()) {
    fail("commands.suiteFull nulo", CONFIG_NAME);
  }

  if (!readJson(path.join(targetDir, "opencode.json"))) fail("JSON inválido", "opencode.json");

  brainWarning(targetDir, log);

  if (failures.length) {
    for (const line of failures) log(`FAIL ${line}`);
    return 1;
  }
  log(`doctor: OK (${manifest ? Object.keys(manifest.files).length : 0} arquivo(s) no manifesto)`);
  return 0;
}

// --- CLI ------------------------------------------------------------------
const USAGE = `uso: node scripts/harness-sync.mjs <init|update|doctor> --target <dir> [--dry-run] [--suite <cmd>] [--unit <cmd>] [--backup-dir <dir>]`;

function parseArgs(argv) {
  const opts = {
    verb: null,
    target: null,
    dryRun: false,
    suite: null,
    unit: null,
    backupDir: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--target") opts.target = argv[++i] ?? null;
    else if (arg === "--suite") opts.suite = argv[++i] ?? null;
    else if (arg === "--unit") opts.unit = argv[++i] ?? null;
    else if (arg === "--backup-dir") opts.backupDir = argv[++i] ?? null;
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
