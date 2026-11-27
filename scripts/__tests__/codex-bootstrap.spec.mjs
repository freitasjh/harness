import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveBootstrapAgent, agentNames } from "../codex-support.mjs";
import { deriveAgent } from "../../.codex/hooks/pre_tool_use.mjs";
import { tempScope } from "../test-temp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scope = tempScope({ label: "codex-bootstrap" });

describe("ADR-003 BOOTSTRAP-01 — identidade consumida por ADR-002", () => {
  const published = agentNames(path.join(ROOT, ".codex", "agents"));

  it("identidade vem do contexto de sessão publicado", () => {
    assert.equal(
      deriveBootstrapAgent({ session: { agent: "qa-engineer" } }, ROOT, published),
      "qa-engineer",
    );
  });

  it("campo agent em tool_input é ignorado", () => {
    assert.equal(
      deriveBootstrapAgent({ tool_input: { agent: "orchestrator" } }, ROOT, published),
      "unknown",
    );
  });

  it("bootstrap ausente ⇒ unknown", () => {
    const empty = scope.tmp({ ".codex/agents/.keep": "" });
    assert.equal(deriveBootstrapAgent({ session: { agent: "qa-engineer" } }, empty, []), "unknown");
  });

  it("adapter ADR-002 não lê identidade de tool_input", () => {
    assert.equal(deriveAgent({ tool_name: "Bash", tool_input: { agent: "orchestrator" } }, {}), "unknown");
  });
});
