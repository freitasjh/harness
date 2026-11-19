// refs.spec.mjs — TDD da prosa órfã (ADR-005, PO-01..PO-05).
//
// Contract (SPEC RF-01/RF-03/RF-04): `runRefsChecks(root)` devolve
//   { ok, results: [{ id, status, detail }] } com os 4 ids declarados.
//
// Regra desta spec: cada modo de falha é provado por FIXTURE QUE O DERRUBA —
// duas árvores com o MESMO conteúdo e UM caractere de diferença, uma PASS e
// outra FAIL. Asserção de fachada (checar que o id existe) não conta.
//
// Fixtures vivem em tempScope (nunca no repo real) e reutilizam a BASELINE de
// produção: um fixture "limpo" cita as 7 entradas, então qualquer mutação
// (criar o arquivo, remover a citação, trocar o lock) muda o veredito.
import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tempScope } from "../../../scripts/test-temp.mjs";
import { REPO_ROOT } from "../lib/config.mjs";
import {
  BASELINE,
  NON_DEFECT,
  BASELINE_CLASSES,
  CLASS_LABELS,
  LIVE_CITER_RE,
  REF_RE,
  isLiveCiter,
  diskPathOf,
  parseProof,
  validateBaseline,
  validateNonDefect,
  validateNonDefectStale,
  runRefsChecks,
  runRefChecks,
} from "../lib/refs/checks.mjs";
import { runStaticChecks } from "../../../scripts/static-checks.mjs";

const TMP = tempScope({ label: "refs-checks" });
afterEach(() => TMP.cleanup());
after(() => TMP.cleanup());

function fixture(files) {
  return TMP.tmp(files);
}

function byId(report, id) {
  const r = report.results.find((x) => x.id === id);
  assert.ok(r, `resultado ausente: ${id}`);
  return r;
}

// Uma árvore "limpa": lock vazio + um citante vivo que cita as entradas da
// BASELINE (nenhum dos arquivos citados existe). O NON_DEFECT de produção está
// VAZIO desde v2/F1 (a entrada citava o fixture de `harness-installer`, skill
// apagada com o instalador), então as fixtures que exercitam a supressão C3
// passam uma entrada SINTÉTICA por `{ nonDefect }` — o mecanismo continua
// provado, só a lista de produção encolheu.
const NON_DEFECT_FIXTURE = Object.freeze({
  path: "rules/exemplo.md",
  reason: "entrada sintética do fixture (a lista de produção é vazia em v2)",
  proof: ".agents/rules/_nondefect-proof.md:3",
});
const PROOF_FILE = NON_DEFECT_FIXTURE.proof.split(":")[0];
const PROOF_LINE = Number(NON_DEFECT_FIXTURE.proof.split(":")[1]);

function proofSource(path = NON_DEFECT_FIXTURE.path) {
  const pad = Array.from({ length: PROOF_LINE - 1 }, (_, i) => `linha ${i + 1}`);
  pad.push(`    '${path}': '# regra\\n',`);
  return pad.join("\n") + "\n";
}

function treeWithLock(lockSkills, extra = {}) {
  return {
    ".agents/skills/.vendor-lock.json": JSON.stringify({ version: "1", skills: lockSkills }),
    ".agents/rules/_baseline.md": BASELINE.map((e) => `- \`${e.path}\``).join("\n") + "\n",
    ...extra,
  };
}

// A prova do fixture só entra nas árvores que INJETAM a entrada sintética:
// com a lista de produção vazia, uma prova viva citando `rules/exemplo.md`
// seria uma órfã não classificada (a supressão não existe mais).
function withProof(extra = {}) {
  return { [PROOF_FILE]: proofSource(), ...extra };
}

function cleanTree(extra = {}) {
  return treeWithLock({}, extra);
}

const CITED = "rules/nao-existe.md";

describe("PO-01 — BASELINE é dívida declarada com dono (SPEC I2)", () => {
  it("ADR-004 reduz a baseline de 7 para 1: só a dívida ainda citada, com dono PRD-4", () => {
    assert.equal(BASELINE.length, 1);
    const byClass = BASELINE.reduce((acc, e) => ({ ...acc, [e.class]: (acc[e.class] ?? 0) + 1 }), {});
    assert.deepEqual(byClass, { C2: 1 });
    assert.equal(BASELINE[0].owner, "PRD-4");
    assert.match(BASELINE[0].reason, /reativar/);
    for (const e of BASELINE) {
      assert.ok(BASELINE_CLASSES.has(e.class), `class inválida: ${e.class}`);
      for (const key of ["path", "reason", "owner", "prd"]) {
        assert.equal(typeof e[key], "string", `${e.path}: ${key} ausente`);
        assert.ok(e[key].trim().length > 0, `${e.path}: ${key} vazio`);
      }
    }
    assert.deepEqual(validateBaseline(BASELINE), []);
  });

  it("entrada sem prd/owner/class reprova — é FAIL do próprio check (§4 item 4)", () => {
    const broken = [{ path: "rules/x.md", class: "C2", reason: "r", owner: "o" }];
    const issues = validateBaseline(broken);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /prd ausente/);

    const badClass = validateBaseline([{ path: "rules/x.md", class: "C6", reason: "r", owner: "o", prd: "p" }]);
    assert.match(badClass.join("; "), /class fora de \{C1, C2\}/);
  });

  it("a baseline real é a única citação viva pinned pelo CDL (dev-planner/SKILL.md:204)", () => {
    const paths = BASELINE.map((e) => e.path).sort();
    assert.deepEqual(paths, ["rules/backend-coding-standards.md"]);
    for (const gone of [
      "rules/security-standard.md",
      "rules/unit-testing-standards.md",
      "rules/backend-integration-tests.md",
      "rules/backend-unit-tests.md",
      "rules/db-migration-flyway.md",
      "rules/db-migration-liquibase.md",
    ]) {
      assert.equal(BASELINE.some((e) => e.path === gone), false, `${gone} saiu da baseline no ADR-004`);
    }
    assert.equal(CLASS_LABELS.C1, "live-orphan");
    assert.equal(CLASS_LABELS.C2, "foreign-baseline");
  });
});

describe("PO-01 — NON_DEFECT é lista literal com prova (C3)", () => {
  it("lista de produção vazia em v2/F1 — o citante que a justificava foi apagado", () => {
    assert.equal(NON_DEFECT.length, 0);
    assert.deepEqual(validateNonDefect(NON_DEFECT), []);
  });

  it("o mecanismo segue vivo: entrada completa passa, entrada sem proof é issue", () => {
    assert.deepEqual(validateNonDefect([NON_DEFECT_FIXTURE]), []);
    const issues = validateNonDefect([{ path: "rules/exemplo.md", reason: "r" }]);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /proof ausente/);
  });

  it("a prova sintética aponta para a linha real do fixture (senão o teste é fachada)", () => {
    const [file, line] = NON_DEFECT_FIXTURE.proof.split(":");
    const text = proofSource().split("\n");
    assert.match(text[Number(line) - 1], /exemplo\.md/, "proof desatualizada: a linha não cita o path");
    assert.match(file, /^\.agents\/rules\/_nondefect-proof\.md$/);
  });
});

describe("PO-02 — escopo por PATH do citante, nunca por conteúdo (SPEC I3/RF-04)", () => {
  it("predicado: .agents/** e opencode.json são vivos; registro não é", () => {
    assert.equal(isLiveCiter(".agents/rules/workflow-rules.md"), true);
    assert.equal(isLiveCiter(".agents/agents/orchestrator/AGENT.md"), true);
    assert.equal(isLiveCiter("opencode.json"), true);
    for (const rel of ["docs/FUNCIONAMENTO.md", "harness/report.json", ".spec/backend/x/SPEC.md", ".agentsx/a.md"]) {
      assert.equal(isLiveCiter(rel), false, `não deveria ser vivo: ${rel}`);
    }
    assert.match(".agents/rules/a.md", LIVE_CITER_RE);
    assert.match("rules/backend-unit-tests.md", REF_RE);
  });

  it("mesmo texto nos dois lados: só o citante vivo conta (mutação flipa o veredito)", () => {
    const registryOnly = fixture(cleanTree({ "docs/registro.md": `ver \`${CITED}\`\n` }));
    const registryReport = runRefsChecks(registryOnly);
    assert.equal(byId(registryReport, "missing-and-unclassified").status, "PASS");
    assert.equal(registryReport.ok, true, byId(registryReport, "missing-and-unclassified").detail);

    const withLiveCiter = fixture(
      cleanTree({
        "docs/registro.md": `ver \`${CITED}\`\n`,
        ".agents/rules/a.md": `ver \`${CITED}\`\n`, // ÚNICA diferença
      }),
    );
    const liveReport = runRefsChecks(withLiveCiter);
    const r = byId(liveReport, "missing-and-unclassified");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, new RegExp(CITED.replace(/\./g, "\\.")));
    assert.match(r.detail, /\.agents\/rules\/a\.md:1/);
    assert.doesNotMatch(r.detail, /docs\/registro\.md/, "citante de registro não pode ser reportado");
    assert.equal(liveReport.ok, false);
  });

  it("citante em .spec/** cita órfã e não é reportado (C5 dated-record)", () => {
    const root = fixture(cleanTree({ ".spec/backend/f/SPEC.md": `cita \`${CITED}\`\n` }));
    const report = runRefsChecks(root);
    assert.equal(byId(report, "missing-and-unclassified").status, "PASS");
    assert.equal(report.ok, true, byId(report, "missing-and-unclassified").detail);
  });

  it("a própria prosa que cita .doc/* não nasce violação (gramática declarada)", () => {
    // E1 da SPEC: workflow-rules.md cita `.doc/*` e o predicado é só rules/*.md.
    const root = fixture(cleanTree({ ".agents/rules/prosa.md": "ver `.doc/stacks.md` e `.doc/`\n" }));
    const report = runRefsChecks(root);
    assert.equal(report.ok, true, byId(report, "missing-and-unclassified").detail);
  });
});

describe("PO-02/PO-03 — os dois modos de falha (RF-03)", () => {
  it("modo (a): órfã nova em .agents/rules reprova com path + citante", () => {
    const root = fixture(cleanTree({ ".agents/rules/novo.md": `linha 1\ncita \`${CITED}\`\n` }));
    const report = runRefsChecks(root);
    const r = byId(report, "missing-and-unclassified");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /\.agents\/rules\/novo\.md:2/);
    assert.equal(byId(report, "stale-baseline-entry").status, "PASS", "baseline está intacta neste fixture");
    assert.equal(report.ok, false);
  });

  it("modo (b): entrada que passou a existir no disco reprova (baseline não infla)", () => {
    const root = fixture(
      cleanTree({ [diskPathOf(BASELINE[0].path)]: "# a rule apareceu\n" }),
    );
    const report = runRefsChecks(root);
    const r = byId(report, "stale-baseline-entry");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /passou a existir/);
    assert.equal(report.ok, false);
  });

  it("modo (b): entrada sem nenhuma citação viva reprova (texto corrigido, entrada ficou)", () => {
    const dropped = BASELINE[0].path;
    const root = fixture(
      cleanTree({
        ".agents/rules/_baseline.md":
          BASELINE.filter((e) => e.path !== dropped).map((e) => `- \`${e.path}\``).join("\n") + "\n",
      }),
    );
    const report = runRefsChecks(root);
    const r = byId(report, "stale-baseline-entry");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, new RegExp(dropped.replace(/[.]/g, "\\.")));
    assert.match(r.detail, /0 citações vivas/);
  });

  it("baseline intacta e citada ⇒ PASS nos 5 ids", () => {
    const report = runRefsChecks(fixture(cleanTree()));
    assert.equal(report.ok, true, JSON.stringify(report.results));
    for (const id of [
      "missing-and-unclassified",
      "stale-baseline-entry",
      "baseline-entry-incomplete",
      "nondefect-entry-incomplete",
      "stale-nondefect-entry",
    ]) {
      assert.equal(byId(report, id).status, "PASS");
    }
  });
});

describe("PO-03/review F4 — NON_DEFECT não é permissão permanente (stale-nondefect-entry)", () => {
  // A lista de produção está vazia em v2, então cada caso injeta a entrada
  // sintética: o que se prova é o VEREDITO do check, não a lista.
  const withEntry = { nonDefect: [NON_DEFECT_FIXTURE] };

  it("entrada cujo path passou a existir no disco reprova", () => {
    const root = fixture(cleanTree(withProof({ ".agents/rules/exemplo.md": "# a rule apareceu\n" })));
    const report = runRefsChecks(root, withEntry);
    const r = byId(report, "stale-nondefect-entry");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /exemplo\.md .*passou a existir/);
    assert.equal(report.ok, false);
  });

  it("proof cuja linha deixou de existir reprova (o arquivo encolheu)", () => {
    // 2 linhas: a proof declara a linha 3 ⇒ fora do arquivo
    const root = fixture(cleanTree(withProof({ [PROOF_FILE]: "linha 1\nlinha 2" })));
    const r = byId(runRefsChecks(root, withEntry), "stale-nondefect-entry");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /proof .*fora do arquivo/);
  });

  it("proof que aponta para linha sem o path reprova (prova morta)", () => {
    const semCitacao = Array.from({ length: PROOF_LINE }, (_, i) => `texto ${i + 1}`).join("\n") + "\n";
    const root = fixture(cleanTree(withProof({ [PROOF_FILE]: semCitacao })));
    const r = byId(runRefsChecks(root, withEntry), "stale-nondefect-entry");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /não cita o path/);
  });

  it("proof cujo arquivo não existe no disco reprova", () => {
    const tree = cleanTree(withProof());
    delete tree[PROOF_FILE]; // ÚNICA diferença para a árvore com prova
    const r = byId(runRefsChecks(fixture(tree), withEntry), "stale-nondefect-entry");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /proof ausente no disco/);
  });

  it("a prova é verificada em TODAS as entradas, não só na primeira", () => {
    const entries = [
      { path: NON_DEFECT_FIXTURE.path, reason: "r", proof: NON_DEFECT_FIXTURE.proof },
      { path: "rules/segunda.md", reason: "r", proof: ".agents/rules/segunda.md:1" },
    ];
    const issues = validateNonDefectStale(entries, fixture(cleanTree(withProof())));
    assert.equal(issues.length, 1, `só a 2ª entrada está morta: ${issues.join("; ")}`);
    assert.match(issues[0], /rules\/segunda\.md .*proof ausente no disco/);
    assert.deepEqual(parseProof(NON_DEFECT_FIXTURE.proof), { file: PROOF_FILE, line: PROOF_LINE });
    assert.equal(parseProof("sem-linha"), null);
  });

  // H-B3 (ADR-005 §8-N17): prova que existe e cita o path NÃO basta. Medido:
  // uma prova em `.spec/archive/**` anulava a régua de uma órfã viva nova.
  it("proof em registro datado (.spec/archive/**) não sustenta a supressão", () => {
    const alvo = "rules/exemplo.md";
    const root = fixture(
      cleanTree({ ".spec/archive/20260101-ciclo/REPORT.md": `cita \`${alvo}\`\n` }),
    );
    const issues = validateNonDefectStale(
      [{ path: alvo, reason: "r", proof: ".spec/archive/20260101-ciclo/REPORT.md:1" }],
      root,
    );
    assert.equal(issues.length, 1, issues.join("; "));
    assert.match(issues[0], /não é citante vivo/);
  });

  // H-B3: prova viva mas o path perdeu toda citação viva — `node_modules` sob
  // `.agents` é vivo pelo predicado e fora do walker, logo o coletor (o mesmo
  // que decide a supressão) não vê a linha da prova.
  it("proof vivo mas path sem citação viva reprova (a prova não substitui a citação)", () => {
    const alvo = "rules/segunda.md";
    const root = fixture(
      cleanTree({ ".agents/node_modules/dep/NOTES.md": `cita \`${alvo}\`\n` }),
    );
    const issues = validateNonDefectStale(
      [{ path: alvo, reason: "r", proof: ".agents/node_modules/dep/NOTES.md:1" }],
      root,
    );
    assert.equal(issues.length, 1, issues.join("; "));
    assert.match(issues[0], /0 citações vivas/);
  });
});

describe("PO-04 — supressões separadas por mecanismo (C3/C4)", () => {
  it("C4: skill do lock suprime; o MESMO texto com lock sem a chave reprova", () => {
    const vendorPath = "rules/security-validate-all-input.md";
    const citer = ".agents/skills/nestjs-best-practices/SKILL.md";
    const locked = fixture(treeWithLock({ "nestjs-best-practices": {} }, { [citer]: `cita \`${vendorPath}\`\n` }));
    assert.equal(runRefsChecks(locked).ok, true, "citação vendor-internal não reprova");

    // Mutação de 1 token: o lock deixa de derivar a skill.
    const unlocked = fixture(treeWithLock({ outro: {} }, { [citer]: `cita \`${vendorPath}\`\n` }));
    const r = byId(runRefsChecks(unlocked), "missing-and-unclassified");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /nestjs-best-practices/);
  });

  it("C4 é derivada do lock, não do prefixo do nome: skill fora do lock não suprime", () => {
    const root = fixture(
      cleanTree({ ".agents/skills/react-best-practices-x/SKILL.md": `cita \`${CITED}\`\n` }),
    );
    assert.equal(byId(runRefsChecks(root), "missing-and-unclassified").status, "FAIL");
  });

  it("C3: o nome da lista é suprimido; o mesmo citer com outro nome reprova", () => {
    const withEntry = { nonDefect: [NON_DEFECT_FIXTURE] };
    const okRoot = fixture(cleanTree(withProof({ ".agents/rules/a.md": "cita `rules/exemplo.md`\n" })));
    assert.equal(runRefsChecks(okRoot, withEntry).ok, true);

    const badRoot = fixture(cleanTree(withProof({ ".agents/rules/a.md": "cita `rules/exemplo-2.md`\n" })));
    const r = byId(runRefsChecks(badRoot, withEntry), "missing-and-unclassified");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /exemplo-2\.md/);
  });
});

describe("PO-04/review F5 — baseline viva por citação vendorizada é visível, não silenciosa", () => {
  it("única citação vendorizada: PASS, mas o detalhe nomeia a entrada (limite N13)", () => {
    const alvo = BASELINE[0].path;
    const tree = treeWithLock({ "react-best-practices": {} }, {
      ".agents/rules/_baseline.md":
        BASELINE.filter((e) => e.path !== alvo).map((e) => `- \`${e.path}\``).join("\n") + "\n",
      ".agents/skills/react-best-practices/SKILL.md": `cita \`${alvo}\`\n`,
    });
    const r = byId(runRefsChecks(fixture(tree)), "stale-baseline-entry");
    assert.equal(r.status, "PASS");
    assert.match(r.detail, /sustentadas só por citação vendorizada=1/);
    assert.match(r.detail, new RegExp(alvo.replace(/[.]/g, "\\.")));
  });

  it("nenhuma entrada nessa condição ⇒ contador zerado (limite medido, não presumido)", () => {
    const r = byId(runRefsChecks(fixture(cleanTree())), "stale-baseline-entry");
    assert.equal(r.status, "PASS");
    assert.match(r.detail, /sustentadas só por citação vendorizada=0/);
  });
});

describe("PO-04 — pureza e propagabilidade (SPEC I1, ADR §4 item 2)", () => {
  it("imports estáticos = {node:fs, node:path}; sem require/import dinâmico/child process", () => {
    const src = readFileSync(join(REPO_ROOT, ".opencode/plugins/lib/refs/checks.mjs"), "utf8");
    const specifiers = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(specifiers)].sort(), ["node:fs", "node:path"]);
    assert.doesNotMatch(src, /\brequire\s*\(/);
    assert.doesNotMatch(src, /\bimport\s*\(/);
    assert.doesNotMatch(src, /node:child_process/);
  });

  it("`runRefChecks` é alias de `runRefsChecks` (as duas grafias do contrato)", () => {
    const root = fixture(cleanTree());
    assert.deepEqual(runRefChecks(root), runRefsChecks(root));
    assert.equal(diskPathOf("rules/x.md"), ".agents/rules/x.md");
  });

  it("root sem .agents/ é vacuous-safe (PASS com N/A)", () => {
    const report = runRefsChecks(fixture({ "README.md": "# vazio\n" }));
    assert.equal(report.ok, true);
    assert.match(byId(report, "missing-and-unclassified").detail, /N\/A/);
  });
});

describe("PO-05 — adapter V18 em scripts/static-checks.mjs (RF-06)", () => {
  it("no repo real o runner reporta V18 PASS com baseline=1 (meta RF-05 <=1) e non-defect=0", () => {
    const report = runStaticChecks();
    const v18 = byId(report, "V18");
    assert.equal(v18.status, "PASS", v18.detail);
    assert.match(v18.detail, /baseline=1/);
    // v2/F1: a única supressão C3 citava a skill `harness-installer` (apagada).
    assert.match(v18.detail, /non-defect=0/);
    // H-B4 (§8-N18): o contador não pode sumir no único ramo que roda.
    assert.match(v18.detail, /stale-baseline-entry=ok\[vendor-only=0\]/);
  });

  it("dívida vendorizada aparece no PASS do V18 sem tornar o check vermelho", () => {
    const alvo = BASELINE[0].path;
    const tree = treeWithLock({ "react-best-practices": {} }, {
      ".agents/rules/_baseline.md":
        BASELINE.filter((e) => e.path !== alvo).map((e) => `- \`${e.path}\``).join("\n") + "\n",
      ".agents/skills/react-best-practices/SKILL.md": `cita \`${alvo}\`\n`,
    });
    const v18 = byId(runStaticChecks(fixture(tree)), "V18");
    assert.equal(v18.status, "PASS", v18.detail);
    assert.match(v18.detail, /stale-baseline-entry=ok\[vendor-only=1\]/);
  });

  it("o veredito barra: fixture com órfã nova ⇒ V18 FAIL e ok=false", () => {
    const root = fixture(cleanTree({ ".agents/rules/novo.md": `cita \`${CITED}\`\n` }));
    const report = runStaticChecks(root);
    const v18 = byId(report, "V18");
    assert.equal(v18.status, "FAIL");
    assert.match(v18.detail, /missing-and-unclassified/);
    assert.equal(report.ok, false);
  });

  it("mutar só o registro não move o veredito (docs/ ignorado pelo runner)", () => {
    const root = fixture(cleanTree({ "docs/registro.md": `cita \`${CITED}\`\n` }));
    const v18 = byId(runStaticChecks(root), "V18");
    assert.equal(v18.status, "PASS", v18.detail);
  });
});

// RC6 / N30 (ADR-004 §2.4): `citesToken` do V19 ainda casa o rótulo de um
// link-ref markdown. O detector de refs reprova a FORMA antes do incidente —
// duas árvores com o MESMO token, só a forma muda.
describe("RC6/N30 — link-ref não compra consumer (ADR-004 §2.4)", () => {
  it("[//]: # (skill) reprova; o mesmo token em prosa normal PASSA", () => {
    const skill = "security-review";
    const withLinkRef = fixture(
      treeWithLock({ [skill]: {} }, {
        ".agents/rules/linkref.md": `texto\n[//]: # (${skill})\n`,
      }),
    );
    const bad = byId(runRefsChecks(withLinkRef), "link-ref-citation-form");
    assert.equal(bad.status, "FAIL", bad.detail);
    assert.match(bad.detail, new RegExp(skill));
    assert.match(bad.detail, /\.agents\/rules\/linkref\.md:2/);

    const plainProse = fixture(
      treeWithLock({ [skill]: {} }, {
        ".agents/rules/linkref.md": `texto\n${skill} em prosa normal\n`,
      }),
    );
    const good = byId(runRefsChecks(plainProse), "link-ref-citation-form");
    assert.equal(good.status, "PASS", good.detail);
  });

  it("link-ref com rótulo que não é skill não reprova (predicado restrito)", () => {
    const root = fixture(
      treeWithLock({ "security-review": {} }, {
        ".agents/rules/linkref.md": "texto\n[//]: # (ancora-generica)\n",
      }),
    );
    assert.equal(byId(runRefsChecks(root), "link-ref-citation-form").status, "PASS");
  });
});
