import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePatchPaths, extractWriteTargets, gateCompletionAnchorA } from "../gate.js";

describe("P0 — apply_patch command shape", () => {
  it("parses Add/Update/Delete File from args.command", () => {
    for (const line of ["*** Add File: .agents/rules/x.md", "*** Update File: .agents/rules/x.md", "*** Delete File: .agents/rules/x.md"]) {
      assert.deepEqual(parsePatchPaths("*** Begin Patch\n" + line + "\n+text\n*** End Patch\n"), [".agents/rules/x.md"]);
    }
  });
  it("extractWriteTargets reads args.command", () => {
    const args = { command: "*** Begin Patch\n*** Add File: .agents/rules/x.md\n+text\n*** End Patch\n" };
    assert.deepEqual(extractWriteTargets("apply_patch", args).map((t) => t.path), [".agents/rules/x.md"]);
  });
  it("detecta Move to para path protegido", async () => {
    const command = "*** Begin Patch\n*** Update File: .spec/prd/x.md\n*** Move to: .agents/rules/y.md\n@@\n-context\n+new\n*** End Patch\n";
    assert.deepEqual(parsePatchPaths(command), [".spec/prd/x.md", ".agents/rules/y.md"]);
    await assert.rejects(
      gateCompletionAnchorA({
        tool: "apply_patch",
        args: { command },
        sessionAgent: "orchestrator",
        config: { protectedPaths: [".agents/rules/**"] },
        logger: { warn() {}, error() {} },
      }),
      (err) => err.reason === "protected-path-write",
    );
  });
});
