import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..");

const FRONTEND_RULE_RE = /^frontend.*coding-standards\.md$/;

export function countAgents(root) {
  const opencodePath = path.join(root, "opencode.json");
  const parsed = JSON.parse(fs.readFileSync(opencodePath, "utf8"));
  return Object.keys(parsed?.agent ?? {}).length;
}

export function countRules(root) {
  const dir = path.join(root, ".agents", "rules");
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .filter((name) => !FRONTEND_RULE_RE.test(name)).length;
}

export function countSkills(root) {
  const dir = path.join(root, ".agents", "skills");
  // Critério medido: entradas não ocultas em .agents/skills (29 dirs de skill
  // + 4 auxiliares: LICENSE-* ×3 e VENDOR-NOTICE.md = 33). Inclui brainstorming
  // e o pacote ampliado de deepsearch. `.vendor-lock.json` é oculto e não entra.
  return fs.readdirSync(dir).filter((name) => !name.startsWith(".")).length;
}

export function countInventoryRows(root) {
  const adrPath = path.join(root, ".spec", "prd", "prd-codex-port", "ADRs", "ADR-001-inventario-contrato", "ADR.md");
  const text = fs.readFileSync(adrPath, "utf8");
  const lines = text.split("\n");
  let inTable = false;
  let count = 0;
  for (const line of lines) {
    if (line.includes("Superfície opencode")) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) break;
    if (/^\|\s*-/.test(trimmed)) continue;
    count += 1;
  }
  return count;
}

function countInventoryRowsSafe(root) {
  try {
    return countInventoryRows(root);
  } catch {
    return 0;
  }
}

export function checkCodexInventory(root = REPO_ROOT) {
  const problems = [];
  const adrPath = path.join(root, ".spec", "prd", "prd-codex-port", "ADRs", "ADR-001-inventario-contrato", "ADR.md");
  if (!fs.existsSync(adrPath)) problems.push("ADR.md ausente");
  else {
    const text = fs.readFileSync(adrPath, "utf8");
    if (!text.includes("Superfície opencode")) problems.push("tabela de inventário ausente (Superfície opencode)");
    const rows = countInventoryRows(root);
    if (rows !== 7) problems.push(`inventário: ${rows} linhas, esperado 7`);
  }
  let agents = 0;
  let rules = 0;
  let skills = 0;
  try {
    agents = countAgents(root);
    if (agents !== 11) problems.push(`agentes: ${agents}, esperado 11`);
  } catch (e) {
    problems.push(`opencode.json inválido: ${e.message}`);
  }
  try {
    rules = countRules(root);
    if (rules !== 8) problems.push(`regras: ${rules}, esperado 8`);
  } catch (e) {
    problems.push(`.agents/rules indisponível: ${e.message}`);
  }
  try {
    skills = countSkills(root);
    if (skills !== 39) problems.push(`skills: ${skills}, esperado 39`);
  } catch (e) {
    problems.push(`.agents/skills indisponível: ${e.message}`);
  }
  const specPath = path.join(root, ".spec", "prd", "prd-codex-port", "ADRs", "ADR-001-inventario-contrato", "SPEC.md");
  if (fs.existsSync(specPath)) {
    const specText = fs.readFileSync(specPath, "utf8");
    if (!specText.includes("INV-INV-1")) problems.push("SPEC.md sem INV-INV-1");
  }
  return { ok: problems.length === 0, problems, counts: { agents, rules, skills, inventoryRows: countInventoryRowsSafe(root) } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkCodexInventory();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}