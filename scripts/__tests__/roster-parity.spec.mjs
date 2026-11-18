// roster-parity.spec.mjs — V21: paridade roster (opencode.json) ↔ disco
// (.agents/agents), nos DOIS sentidos (F1-fix, achado C2 / decisão D1=A).
//
// O que este check repõe: metade do inventário V19 apagado em v2/F1 — a
// paridade de registro e a presença do arquivo de papel (`AGENT.md`/`PROMPT.md`).
// O que ele NÃO repõe (declarado no cabeçalho de `scripts/static-checks.mjs`):
// citação por token e derivação de classe pelo `.vendor-lock.json`.
//
// Cada teste falha se a checagem virar um dos dois verdes-falsos possíveis:
// olhar só o registro (não vê diretório órfão) ou só o disco (não vê agente
// registrado que não existe).
import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tempScope } from "../test-temp.mjs";
import { rosterParity, runStaticChecks, REPO_ROOT } from "../static-checks.mjs";

const TMP = tempScope({ label: "roster-parity" });
afterEach(() => TMP.cleanup());
after(() => TMP.cleanup());

// Uma raiz de fixture mínima: `opencode.json` com o roster pedido e um
// diretório por agente, cada um com o arquivo de papel indicado.
function fixture({ roster, dirs = {}, roleFile = "AGENT.md" }) {
  const root = TMP.tmp();
  writeFileSync(join(root, "opencode.json"), JSON.stringify({ agent: roster }, null, 2));
  for (const name of Object.keys(roster)) {
    const dir = join(root, ".agents/agents", name);
    mkdirSync(dir, { recursive: true });
    if (roleFile) writeFileSync(join(dir, roleFile), `# ${name}\n`);
  }
  for (const [name, file] of Object.entries(dirs)) {
    const dir = join(root, ".agents/agents", name);
    mkdirSync(dir, { recursive: true });
    if (file) writeFileSync(join(dir, file), `# ${name}\n`);
  }
  return root;
}

describe("V21 — roster ↔ disco em paridade (bidirecional)", () => {
  it("no repo real: 10 registrados = 10 diretórios, todos com papel", () => {
    const parity = rosterParity(REPO_ROOT);
    assert.equal(parity.ok, true, parity.problems.join("; "));
    assert.equal(parity.registered.length, 10);
    assert.equal(parity.dirs.length, 10);
    assert.deepEqual(parity.registered, parity.dirs);
    // O caso que obriga a aceitar DOIS nomes de arquivo de papel.
    assert.ok(parity.registered.includes("code-reviewer"));
  });

  it("diretório sem entrada no registro reprova nomeando o diretório", () => {
    const root = fixture({ roster: { orchestrator: { mode: "primary" } }, dirs: { "agente-fantasma": "AGENT.md" } });
    const parity = rosterParity(root);
    assert.equal(parity.ok, false);
    assert.ok(parity.problems.some((p) => p.includes("diretório sem entrada no registro: agente-fantasma")));
  });

  it("entrada no registro sem diretório reprova nomeando a entrada", () => {
    const root = fixture({ roster: { orchestrator: {}, "agente-inexistente": {} } });
    // O registro nomeia os dois; só `orchestrator` existe em disco.
    rmSync(join(root, ".agents/agents/agente-inexistente"), { recursive: true, force: true });
    const parity = rosterParity(root);
    assert.equal(parity.ok, false);
    assert.ok(parity.problems.some((p) => p.includes("registro sem diretório: agente-inexistente")));
  });

  it("diretório registrado sem AGENT.md nem PROMPT.md reprova", () => {
    const root = fixture({ roster: { orchestrator: {}, planner: {} }, roleFile: "AGENT.md" });
    // `planner` perde o arquivo de papel sem perder o diretório.
    rmSync(join(root, ".agents/agents/planner/AGENT.md"));
    const parity = rosterParity(root);
    assert.equal(parity.ok, false);
    assert.ok(parity.problems.some((p) => p.includes("diretório sem AGENT.md/PROMPT.md: planner")));
  });

  it("PROMPT.md sozinho é papel válido (caso code-reviewer)", () => {
    const root = fixture({ roster: { "code-reviewer": {} }, roleFile: "PROMPT.md" });
    assert.equal(rosterParity(root).ok, true);
  });

  it("opencode.json ausente ou inválido reprova com o motivo", () => {
    const empty = TMP.tmp();
    assert.match(rosterParity(empty).problems[0], /opencode\.json ausente/);

    const broken = TMP.tmp({ "opencode.json": "{ nao e json" });
    assert.match(rosterParity(broken).problems[0], /JSON inválido/);
  });

  it("o runner selado carrega V21 e o veredito é PASS no repo real", () => {
    const report = runStaticChecks();
    const v21 = report.results.find((r) => r.id === "V21");
    assert.ok(v21, "runStaticChecks precisa registrar V21 — linha de console não define o exit");
    assert.equal(v21.status, "PASS", v21.detail);
    assert.match(v21.detail, /registrados=10/);
    assert.match(v21.detail, /diretórios=10/);
  });

  it("o veredito barra: fixture com diretório órfão ⇒ V21 FAIL", () => {
    const root = fixture({ roster: { orchestrator: {} }, dirs: { sobra: "AGENT.md" } });
    const report = runStaticChecks(root);
    const v21 = report.results.find((r) => r.id === "V21");
    assert.equal(v21.status, "FAIL");
    assert.match(v21.detail, /sobra/);
    assert.equal(report.ok, false);
  });
});
