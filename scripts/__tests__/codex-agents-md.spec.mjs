import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverInstructionFiles } from "../codex-support.mjs";
import { tempScope } from "../test-temp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scope = tempScope({ label: "codex-agentsmd" });

describe("ADR-003 AGENTSMD-01 — encadeamento AGENTS.md", () => {
  it("raiz existe e contém segurança crítica priorizada", () => {
    const text = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");
    for (const token of ["protectedPaths", "state file", "32768", "dual-run"]) {
      assert.ok(text.includes(token), `segurança crítica ausente na raiz: ${token}`);
    }
  });

  it("chunking por diretório existe (scripts/ e harness/)", () => {
    for (const dir of ["scripts", "harness"]) {
      assert.ok(fs.existsSync(path.join(ROOT, dir, "AGENTS.md")), `${dir}/AGENTS.md ausente`);
    }
  });

  it("override em subdiretório tem precedência sobre AGENTS.md", () => {
    const root = scope.tmp({
      "AGENTS.md": "raiz",
      "services/payments/AGENTS.md": "base",
      "services/payments/AGENTS.override.md": "override",
    });
    const files = discoverInstructionFiles(root, "services/payments");
    assert.deepEqual(files.map((f) => f.rel), ["AGENTS.md", "services/payments/AGENTS.override.md"]);
    assert.equal(files[1].content.trim(), "override");
  });
});
