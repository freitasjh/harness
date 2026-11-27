// codex-support.mjs — pure helpers for the ADR-003 agent/rule/config layer.
// No framework, no network, no writes: every consumer passes its own paths.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const INSTRUCTION_BUDGET = 32768;

const NAME_RE = /^name\s*=\s*"([^"]+)"\s*$/m;
const DESC_RE = /^description\s*=\s*"([^"]+)"\s*$/m;
const DEV_RE = /^developer_instructions\s*=\s*(?:'''[\s\S]*?'''|"""[\s\S]*?""")/m;

export function agentNames(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith(".toml"))
    .map((file) => {
      const match = fs.readFileSync(path.join(dir, file), "utf8").match(NAME_RE);
      return match ? match[1] : null;
    })
    .filter(Boolean)
    .sort();
}

export function validateAgentToml(text) {
  const problems = [];
  const raw = String(text ?? "");
  const name = raw.match(NAME_RE)?.[1] ?? null;
  const description = raw.match(DESC_RE)?.[1] ?? null;
  const dev = raw.match(DEV_RE)?.[0] ?? null;
  if (!name) problems.push("campo name ausente ou vazio");
  if (!description) problems.push("campo description ausente ou vazio");
  if (!dev) problems.push("campo developer_instructions ausente ou vazio");
  else if (dev.replace(/^[^']*?'''|^[^"]*?"""/, "").replace(/'''|"""$/, "").trim() === "") {
    problems.push("campo developer_instructions vazio");
  }
  return { ok: problems.length === 0, problems, name, description };
}

export function parityProblems(source, published) {
  const problems = [];
  if (source.length !== published.length) {
    problems.push(`contagem: fonte=${source.length} publicação=${published.length}`);
  }
  const a = new Set(source);
  const b = new Set(published);
  for (const name of [...a, ...b].sort()) {
    if (!a.has(name) || !b.has(name)) problems.push(`nome divergente: ${name}`);
  }
  return problems;
}

export function parseCodexConfig(text) {
  const raw = String(text ?? "");
  const maxBytes = Number(raw.match(/\bproject_doc_max_bytes\s*=\s*(\d+)/)?.[1] ?? 0);
  const list = raw.match(/\bproject_doc_fallback_filenames\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  const fallbackFilenames = [...list.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  return { maxBytes, fallbackFilenames };
}

export function discoverInstructionFiles(root, cwdRel = ".", fallbacks = []) {
  const segments = String(cwdRel).split("/").filter((s) => s && s !== ".");
  const dirs = [""];
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    dirs.push(current);
  }
  const out = [];
  for (const dir of dirs) {
    const candidates = ["AGENTS.override.md", "AGENTS.md", ...fallbacks];
    for (const name of candidates) {
      const rel = dir ? `${dir}/${name}` : name;
      const abs = path.join(root, rel);
      let st = null;
      try { st = fs.statSync(abs); } catch { /* ausente */ }
      if (!st || !st.isFile() || st.size === 0) continue;
      const content = fs.readFileSync(abs, "utf8");
      out.push({ rel, content, bytes: Buffer.byteLength(content, "utf8") });
      break; // Codex carrega no máximo um arquivo por diretório
    }
  }
  return out;
}

export function measureInstructionChain(root, cwdRel = ".", fallbacks = []) {
  const files = discoverInstructionFiles(root, cwdRel, fallbacks);
  const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
  return { files, bytes, ok: bytes <= INSTRUCTION_BUDGET };
}

export function assertInstructionBudget(bytes, limit = INSTRUCTION_BUDGET) {
  if (bytes > limit) throw new Error(`teto de injeção ${limit} bytes excedido: ${bytes}`);
  return bytes;
}

const SECRET_FIELD_RE = /^(api[_-]?key|apikey|secret|.*token|password|passwd|authorization|bearer|private[_-]?key)$/i;
const SECRET_VALUE_RE = /sk-[a-z0-9]{10,}|ghp_[a-z0-9]{20,}|AKIA[0-9A-Z]{16}|\b(api[_-]?key|token|secret|password|authorization)\b\s*[:=]\s*["']?[A-Za-z0-9_.-]{12,}/i;

export function scanSecretPatterns(value, at = "$") {
  const hits = [];
  if (value === null || value === undefined) return hits;
  if (Array.isArray(value)) {
    value.forEach((item, i) => hits.push(...scanSecretPatterns(item, `${at}[${i}]`)));
    return hits;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const here = `${at}.${key}`;
      if (SECRET_FIELD_RE.test(key)) hits.push({ path: here, kind: "field" });
      hits.push(...scanSecretPatterns(item, here));
    }
    return hits;
  }
  if (typeof value === "string" && SECRET_VALUE_RE.test(value)) {
    hits.push({ path: at, kind: "value" });
  }
  return hits;
}

export function assertNoSecrets(value) {
  const hits = scanSecretPatterns(value);
  if (hits.length) {
    throw new Error(`state-secret: ${hits.map((h) => `${h.path}(${h.kind})`).join(", ")}`);
  }
  return value;
}

export function deriveBootstrapAgent(event, root, known = null) {
  const published = known ?? agentNames(path.join(root, ".codex", "agents"));
  if (!published.length) return "unknown";
  const session = event?.session || event?.sessionContext || event?.context?.session;
  // Identidade só do contexto de sessão: tool_input nunca é consultado (ADR-002 C-01).
  const candidates = [session?.agent, event?.sessionAgent, event?.session_agent];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && published.includes(candidate)) return candidate;
  }
  return "unknown";
}
