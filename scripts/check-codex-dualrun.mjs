import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..");

const FORBIDDEN = [
  /^\.opencode\//,
  /^opencode\.json$/,
  /^\.agents\//,
];

const ALLOWED_EXCEPTIONS = new Set([
  ".opencode/plugins/gate.js",
  ".opencode/plugins/lib/gate-core.mjs",
  // drift externo aceito pelo owner 2026-11-24 — delegação explícita deste
  // ciclo para alinhar o contrato executável ao SKILL v4.
  ".opencode/plugins/__tests__/prompt-optimizer.spec.mjs",
  ".opencode/plugins/__tests__/apply-patch-command.spec.mjs",
  ".opencode/plugins/__tests__/contraprove-counts.spec.mjs",
  ".opencode/plugins/__tests__/config-loader.spec.mjs",
  ".opencode/plugins/__tests__/agent-identity.spec.mjs",
  ".opencode/plugins/__tests__/gate-telemetry.spec.mjs",
  ".opencode/plugins/__tests__/v2-shims.spec.mjs",
  ".opencode/plugins/__tests__/opencode-v2-adapter.spec.mjs",
  ".opencode/plugins/__tests__/matrix-v1v2-parity.spec.mjs",
  ".opencode/plugins/__tests__/matrix-no-leak.spec.mjs",
  ".opencode/plugins/__tests__/matrix-gate-absent.spec.mjs",
  ".opencode/plugins/__tests__/gate.spec.mjs",
  ".opencode/commands/harness-migrate.md",
  ".agents/agents/code-reviewer/PROMPT.md",
  ".agents/agents/orchestrator/AGENT.md",
  ".agents/agents/qa-engineer/AGENT.md",
  ".agents/agents/security-engineer/AGENT.md",
  ".agents/rules/deepsearch.md",
  ".agents/schemas/harness-report.schema.json",
  ".agents/rules/always-on.md",
  ".agents/rules/gate-contract.md",
  ".agents/rules/harness-config.md",
  ".agents/rules/prd-adr-pipeline.md",
  ".agents/rules/workflow-rules.md",
  ".agents/rules/workflow.md",
]);

export function isForbiddenPath(p) {
  const n = p.replace(/\\/g, "/");
  if (ALLOWED_EXCEPTIONS.has(n)) return false;
  // drift externo aceito pelo owner 2026-11-24 — pacote de skills é baseline.
  // Demais caminhos .agents/** (rules, schemas, agents) seguem proibidos.
  if (n.startsWith(".agents/skills/")) return false;
  return FORBIDDEN.some((re) => re.test(n));
}

export function collectChangedPaths(root = REPO_ROOT) {
  const opts = { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
  let tracked = [];
  let untracked = [];
  try {
    tracked = execSync("git diff --name-only HEAD", opts).split(/\r?\n/).filter(Boolean);
  } catch {
    tracked = [];
  }
  try {
    untracked = execSync("git ls-files --others --exclude-standard", opts).split(/\r?\n/).filter(Boolean);
  } catch {
    untracked = [];
  }
  return [...new Set([...tracked, ...untracked])];
}

export function checkCodexDualRun(root = REPO_ROOT) {
  const changed = collectChangedPaths(root);
  const hits = changed.filter(isForbiddenPath);
  return { ok: hits.length === 0, hits, checked: changed.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkCodexDualRun();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}
