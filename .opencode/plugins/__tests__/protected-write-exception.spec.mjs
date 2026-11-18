// F4: the protected-path exemption follows the live implementation roster.
// The old exception named `developer-engineer`, removed in F4, which left no
// living role able to edit .agents/**, .opencode/plugins/** or rules.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkWriteAccess, DENY_PROTECTED } from "../gate.js";

const PROTECTED = [".opencode/plugins/**", ".agents/rules/**", ".agents/agents/**"];
const target = { path: ".opencode/plugins/gate.js" };

describe("F4 protected-write exception", () => {
  for (const agent of ["frontend-engineer", "backend-engineer"]) {
    it(`${agent} may write a protected path under delegation`, () => {
      assert.doesNotThrow(() =>
        checkWriteAccess({ agent, tool: "edit", targets: [target], protectedPaths: PROTECTED }),
      );
    });
  }

  it("the removed role no longer holds the exemption", () => {
    assert.throws(
      () =>
        checkWriteAccess({
          agent: "developer-engineer",
          tool: "edit",
          targets: [target],
          protectedPaths: PROTECTED,
        }),
      (err) => err?.reason === DENY_PROTECTED,
    );
  });

  it("read-only roles still deny", () => {
    for (const agent of ["code-reviewer", "ux-designer", "design-system-specialist", "orchestrator"]) {
      assert.throws(
        () =>
          checkWriteAccess({ agent, tool: "edit", targets: [target], protectedPaths: PROTECTED }),
        (err) => Boolean(err?.reason),
        agent,
      );
    }
  });
});
