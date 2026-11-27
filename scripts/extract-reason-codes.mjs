import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..");

const REASON_CODE_RE = /export\s+const\s+(DENY_[A-Z0-9_]+)\s*=\s*"([^"]+)"/g;

function collectReasonCodeText(root) {
  const files = [
    path.join(root, ".opencode", "plugins", "lib", "gate-core.mjs"),
    path.join(root, ".opencode", "plugins", "gate.js"),
  ];
  let text = "";
  for (const f of files) {
    if (fs.existsSync(f)) text += "\n" + fs.readFileSync(f, "utf8");
  }
  return text;
}

export function extractReasonCodes(root = REPO_ROOT) {
  const gatePath = path.join(root, ".opencode", "plugins", "gate.js");
  if (!fs.existsSync(gatePath)) throw new Error("gate.js ausente");
  const text = collectReasonCodeText(root);
  const found = [];
  const seen = new Set();
  for (const match of text.matchAll(REASON_CODE_RE)) {
    const key = match[1] + "::" + match[2];
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ name: match[1], code: match[2] });
  }
  found.sort((a, b) => a.name.localeCompare(b.name));
  return found.map((entry) => entry.code);
}

export function extractReasonCodeEntries(root = REPO_ROOT) {
  const gatePath = path.join(root, ".opencode", "plugins", "gate.js");
  if (!fs.existsSync(gatePath)) throw new Error("gate.js ausente");
  const text = collectReasonCodeText(root);
  const found = [];
  const seen = new Set();
  for (const match of text.matchAll(REASON_CODE_RE)) {
    const key = match[1] + "::" + match[2];
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ name: match[1], code: match[2] });
  }
  found.sort((a, b) => a.name.localeCompare(b.name));
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const entries = extractReasonCodeEntries();
  console.log(JSON.stringify(entries, null, 2));
  process.exitCode = entries.length > 0 ? 0 : 1;
}