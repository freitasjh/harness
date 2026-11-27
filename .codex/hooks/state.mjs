import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const INTEGRITY_KEY = "__integrity";
const KEY_FILE = ".state-key";
const KEY_ENV = "HARNESS_STATE_KEY";
const SECRET_FIELD_RE = /^(api[_-]?key|apikey|secret|.*token|password|passwd|authorization|bearer|private[_-]?key)$/i;
const SECRET_VALUE_RE = /sk-[a-z0-9]{10,}|ghp_[a-z0-9]{20,}|AKIA[0-9A-Z]{16}|\b(api[_-]?key|token|secret|password|authorization)\b\s*[:=]\s*["']?[A-Za-z0-9_.-]{12,}/i;

export function resolveStatePath(root = process.cwd()) {
  return path.join(root, ".codex", "harness-state.json");
}

// ADR-003 M-01/F-03: chave HMAC fora do estado (env ou arquivo 0600 gitignored),
// nonce por escrita, comparação em tempo constante. Divergência ⇒ state-corrupt.
function loadKey(dir) {
  const explicit = process.env[KEY_ENV];
  if (typeof explicit === "string" && explicit.length >= 16) {
    return Buffer.from(explicit, "utf8");
  }
  const keyFile = path.join(dir, KEY_FILE);
  fs.mkdirSync(dir, { recursive: true });
  try {
    const fd = fs.openSync(keyFile, "wx", 0o600);
    try {
      fs.writeFileSync(fd, crypto.randomBytes(32).toString("hex"));
    } finally {
      fs.closeSync(fd);
    }
  } catch (err) {
    if (!err || err.code !== "EEXIST") throw err;
  }
  try { fs.chmodSync(keyFile, 0o600); } catch { /* best-effort */ }
  return fs.readFileSync(keyFile);
}

function assertNoSecrets(state) {
  const hits = [];
  const walk = (value, at) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${at}[${i}]`));
      return;
    }
    if (typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (SECRET_FIELD_RE.test(key)) hits.push(`${at}.${key}(field)`);
        walk(item, `${at}.${key}`);
      }
      return;
    }
    if (typeof value === "string" && SECRET_VALUE_RE.test(value)) hits.push(`${at}(value)`);
  };
  walk(state, "$");
  if (hits.length) throw new Error(`state-secret: ${hits.join(", ")}`);
}

function keyFor(filePath) {
  return loadKey(path.dirname(filePath));
}

export function sealState(state, filePath) {
  const body = { ...(state && typeof state === "object" ? state : {}) };
  delete body[INTEGRITY_KEY];
  assertNoSecrets(body);
  const nonce = crypto.randomBytes(16).toString("hex");
  const signed = { ...body, [INTEGRITY_KEY]: { nonce } };
  const mac = crypto.createHmac("sha256", keyFor(filePath))
    .update(JSON.stringify(signed)).digest("hex");
  return { ...body, [INTEGRITY_KEY]: { nonce, mac } };
}

function openState(parsed, filePath) {
  const integrity = parsed[INTEGRITY_KEY];
  const body = { ...parsed };
  delete body[INTEGRITY_KEY];
  if (Object.keys(body).length === 0) return {};
  if (!integrity || typeof integrity.nonce !== "string" || typeof integrity.mac !== "string") {
    throw new Error("state-corrupt");
  }
  const signed = { ...body, [INTEGRITY_KEY]: { nonce: integrity.nonce } };
  const expected = crypto.createHmac("sha256", keyFor(filePath))
    .update(JSON.stringify(signed)).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(integrity.mac, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("state-corrupt");
  return body;
}

export function readState(filePath, opts = {}) {
  const strict = !!(opts && opts.strict);
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf8");
    if (raw.trim() === "") return {};
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (strict) throw new Error("state-corrupt");
      return {};
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      if (strict) throw new Error("state-corrupt");
      return {};
    }
    return openState(parsed, filePath);
  } catch (err) {
    if (strict) throw err;
    return {};
  }
}

const LOCK_RETRY_MS = 10;
const LOCK_TIMEOUT_MS = 2000;

export function acquireLock(lockPath) {
  const start = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.closeSync(fd);
      return () => {
        try { fs.unlinkSync(lockPath); } catch { /* best-effort */ }
      };
    } catch (err) {
      if (err && err.code !== "EEXIST") throw err;
      if (Date.now() - start >= LOCK_TIMEOUT_MS) throw new Error("state-lock-timeout");
      try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_RETRY_MS); } catch { /* best-effort */ }
    }
  }
}

export function withLock(filePath, fn) {
  const lockPath = filePath + ".lock";
  const release = acquireLock(lockPath);
  try {
    return fn();
  } finally {
    release();
  }
}

export function writeAtomic(filePath, state) {
  return writeStateAtomic(filePath, state);
}

function writeStateAtomicUnlocked(filePath, state) {
  const sealed = sealState(state, filePath);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.harness-state.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`);
  try {
    // wx = O_CREAT|O_EXCL: link plantado no temporário é recusa, não travessia.
    const fd = fs.openSync(tmp, "wx", 0o600);
    try {
      fs.writeFileSync(fd, JSON.stringify(sealed, null, 2) + "\n");
    } finally {
      fs.closeSync(fd);
    }
    try { fs.chmodSync(tmp, 0o600); } catch { /* best-effort */ }
    fs.renameSync(tmp, filePath);
    try { fs.chmodSync(filePath, 0o600); } catch { /* best-effort */ }
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* best-effort */ }
  }
}

export function writeStateAtomic(filePath, state) {
  return withLock(filePath, () => writeStateAtomicUnlocked(filePath, state));
}

export function updateState(filePath, mutator) {
  return withLock(filePath, () => {
    const current = readState(filePath, { strict: true });
    const next = typeof mutator === "function" ? mutator({ ...current }) : { ...current, ...mutator };
    writeStateAtomicUnlocked(filePath, next);
    return next;
  });
}

export function resetHitlCounter(state, sessionId) {
  const s = state && typeof state === "object" ? state : {};
  if (!s.hitl || typeof s.hitl !== "object") s.hitl = {};
  if (sessionId) {
    s.hitl[sessionId] = { taskCount: 0 };
  } else {
    s.hitl = {};
  }
  if (!s.turn || typeof s.turn !== "object") s.turn = {};
  if (sessionId) s.turn[sessionId] = { boundary: Date.now() };
  return s;
}

export function recordSessionAgentState(state, sessionId, agent) {
  const s = state && typeof state === "object" ? state : {};
  if (!s.sessions || typeof s.sessions !== "object") s.sessions = {};
  if (sessionId) s.sessions[sessionId] = { agent };
  return s;
}

export default {
  resolveStatePath,
  readState,
  writeAtomic,
  writeStateAtomic,
  updateState,
  withLock,
  acquireLock,
  sealState,
  resetHitlCounter,
  recordSessionAgentState,
};
