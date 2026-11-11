// inventory.spec.mjs — TDD do inventário canônico (ADR-004, PI-01..PI-10).
//
// Contract (SPEC RF-01/RF-12): `runInventoryChecks(root, options)` devolve
//   { ok, results: [{ id, status, detail, counters }], counters }
// com os 10 ids da ADR-004 §2.4 e `counters` de fechamento em PASS e em FAIL.
//
// Regra desta spec, herdada de `refs.spec.mjs`: cada modo de falha é provado
// por FIXTURE QUE O DERRUBA — árvore em `tempScope`, mutação REAL (um arquivo,
// uma entrada, um caractere), veredito FAIL do id específico. Asserção de
// fachada (checar que o id existe) não conta.
//
// Onde um defeito tem causa e sintoma, a fixture isola a MUTAÇÃO, não o
// sintoma: `inventory-attendance-drift` é a equação de fechamento, logo é por
// desenho o sintoma agregado das outras causas. A fixture dele usa uma
// declaração fantasma (id declarado sem artefato no disco) — mutação real que
// quebra o fechamento sem que nenhum outro id dispare.
//
// Baseline do repo: 48 skills (25 do lock + 22 com consumidor + 1 órfã
// decidida), 8 rules (7 + 1 de eixo), 10 agentes registrados.
import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tempScope } from "../../../scripts/test-temp.mjs";
import { REPO_ROOT } from "../lib/config.mjs";
import {
  CLASS_LABELS,
  DECISION_FIELDS,
  DECISION_VALUES,
  EXPIRY_CONDITIONS,
  OWNER_DECISIONS,
  PROMPT_REF_RE,
  SKILL_ENTRY_NAME,
  VENDOR_LOCK_NAME,
  axisKeysOf,
  deriveInventory,
  normalizeDeclarations,
  normalizeRef,
  parseProof,
  runInventoryChecks,
  stripHtmlComments,
} from "../lib/inventory/checks.mjs";
import { inventoryCheckResults, runStaticChecks } from "../../../scripts/static-checks.mjs";
import {
  RULES_BY_AXIS,
  RULES_COMMON,
  SKILLS_BY_AXIS,
  SKILLS_COMMON,
} from "../../../installer/install.mjs";

const TMP = tempScope({ label: "inventory-checks" });
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

const PROMPT_A = ".agents/agents/agente-a/AGENT.md";
const PROMPT_B = ".agents/agents/agente-b/AGENT.md";

// Árvore "limpa": 1 skill com consumidor, 1 skill órfã com decisão, 1 rule com
// consumidor, 2 agentes com prompt resolvido. Toda skill local aparece nas
// declarações do instalador (é o que o fechamento exige), mas `common` NÃO
// confere classe — `skill-orfa` está em `skillCommon` e continua órfã.
function baseFiles(extra = {}) {
  return {
    "opencode.json": JSON.stringify({
      agent: {
        "agente-a": { prompt: `{file:./${PROMPT_A}}` },
        "agente-b": { prompt: `{file:./${PROMPT_B}}` },
      },
    }),
    [PROMPT_A]: "# agente-a\nconsome skill-util e rule-um.md\n",
    [PROMPT_B]: "# agente-b\n",
    ".agents/skills/.vendor-lock.json": JSON.stringify({ version: "1", skills: {} }),
    ".agents/skills/skill-util/SKILL.md": "# skill-util\n",
    ".agents/skills/skill-orfa/SKILL.md": "# skill-orfa\n",
    ".agents/rules/rule-um.md": "# rule-um\n",
    // Documento do DONO, fora do artefato do sujeito: é a forma de prova que a
    // ADR exige (`RF-01` "fonte de evidência"). O próprio `SKILL.md` não serve
    // — seria o sujeito citando a si mesmo (I1).
    "docs/decisoes.md": "# decisões do fixture\n- skill-orfa: órfã deliberada (owner: fluxo de teste)\n",
    ...extra,
  };
}

const DECL = {
  skillCommon: ["skill-util", "skill-orfa"],
  skillAxis: {},
  ruleCommon: ["rule-um.md"],
  ruleAxis: {},
};

const DECISION_OK = {
  subject: "skill-orfa",
  class: "skill",
  owner: "fluxo de teste (fixture)",
  decision: "keep",
  reason: "órfã deliberada deste fixture",
  proof: "docs/decisoes.md:2",
  expiresWhen: ["subject-absent", "gained-consumer", "gained-axis", "gained-lock"],
};

function check(root, { declarations = DECL, decisions = [DECISION_OK] } = {}) {
  return runInventoryChecks(root, { declarations, decisions });
}

const ALL_IDS = [
  "inventory-artifact-untracked",
  "inventory-class-ambiguous",
  "inventory-attendance-drift",
  "inventory-lock-disk-mismatch",
  "inventory-skill-without-manifest",
  "inventory-lock-unreadable",
  "inventory-declaration-phantom",
  "inventory-agent-prompt-unresolved",
  "owner-decision-incomplete",
  "owner-decision-stale",
];

describe("PI-01 — módulo puro, root injetável, contrato de saída", () => {
  it("os 10 ids da ADR §2.4 existem sempre, com status PASS|FAIL e detail string", () => {
    const report = check(fixture(baseFiles()));
    assert.deepEqual(report.results.map((r) => r.id), ALL_IDS);
    for (const r of report.results) {
      assert.ok(r.status === "PASS" || r.status === "FAIL", `status inválido: ${r.id}=${r.status}`);
      assert.equal(typeof r.detail, "string");
      assert.ok(r.detail.length > 0);
    }
    assert.equal(report.ok, true, JSON.stringify(report.results.filter((r) => r.status === "FAIL")));
  });

  it("root sem .agents/ é vacuous-safe (PASS com N/A, nunca crash)", () => {
    const report = check(fixture({ "README.md": "# vazio\n" }));
    assert.equal(report.ok, true);
    assert.equal(report.counters.skills.total, 0);
    for (const r of report.results) assert.match(r.detail, /N\/A/);
  });

  it("pureza: imports estáticos = {node:fs, node:path}; sem require/child process/rede", () => {
    const src = readFileSync(join(REPO_ROOT, ".opencode/plugins/lib/inventory/checks.mjs"), "utf8");
    const specifiers = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(specifiers)].sort(), ["node:fs", "node:path"]);
    assert.doesNotMatch(src, /\brequire\s*\(/);
    assert.doesNotMatch(src, /\bimport\s*\(/);
    assert.doesNotMatch(src, /node:child_process/);
    assert.doesNotMatch(src, /\bfetch\s*\(/);
    assert.equal(src.includes("writeFile"), false);
  });

  it("helpers: proof `arquivo:linha`, referência do roster normalizada, eixos por par", () => {
    assert.deepEqual(parseProof(".agents/x.md:12"), { file: ".agents/x.md", line: 12 });
    assert.equal(parseProof("sem-linha"), null);
    assert.equal(normalizeRef("./.agents/agents/a/AGENT.md"), ".agents/agents/a/AGENT.md");
    assert.match(`{file:./.agents/x.md}`, PROMPT_REF_RE);
    assert.deepEqual(axisKeysOf({ "frontend=vue": ["r.md"], "frontend=react": ["r.md"] }, "r.md"), [
      "frontend=react",
      "frontend=vue",
    ]);
    assert.deepEqual(normalizeDeclarations(null), { skillCommon: [], skillAxis: {}, ruleCommon: [], ruleAxis: {} });
  });
});

describe("PI-02 — classe de skill só pelo lock; sem lock não herda vermelho", () => {
  it("vendor-by-axis vem do lock e a citação vira vendorCited, não muda a classe", () => {
    const root = fixture(
      baseFiles({
        [".agents/skills/.vendor-lock.json"]: JSON.stringify({ version: "1", skills: { "skill-util": {} } }),
        [PROMPT_A]: "# agente-a\nconsome skill-util e rule-um.md\n", // citada E vendorizada
      }),
    );
    const report = check(root);
    assert.equal(report.counters.skills["vendor-by-axis"], 1);
    assert.equal(report.counters.vendorCited, 1, "citação de vendorizada é publicada, não escondida");
    assert.equal(byId(report, "inventory-class-ambiguous").status, "PASS", "vendor×consumer é resolvido pela precedência");
    assert.equal(report.counters.skills.consumer, 0);
  });

  it("lock ausente ⇒ lockPresent=false, classificação suspensa, ok=true (ADR §2.2)", () => {
    const files = baseFiles();
    delete files[".agents/skills/.vendor-lock.json"];
    const report = check(fixture(files));
    assert.equal(report.ok, true, JSON.stringify(report.results.filter((r) => r.status === "FAIL")));
    assert.equal(report.counters.lockPresent, false);
    assert.equal(report.counters.skills.suspended, 2);
    assert.match(byId(report, "inventory-lock-disk-mismatch").detail, /ausente .*suspensa/);
    // agents e rules continuam derivados: dependem de arquivos que propagam.
    assert.equal(report.counters.rules.consumer, 1);
    assert.equal(report.counters.agents.registered, 2);
  });

  it("classe nunca vem do nome: skill sem prefixo reconhecível entra no lock e é vendorizada", () => {
    const root = fixture(
      baseFiles({
        "opencode.json": JSON.stringify({ agent: { "agente-b": { prompt: `{file:./${PROMPT_B}}` } } }),
        [".agents/skills/.vendor-lock.json"]: JSON.stringify({ version: "1", skills: { "react-best-practices": {} } }),
        ".agents/skills/react-best-practices/SKILL.md": "# react\n",
      }),
    );
    const rows = deriveInventory(root, { declarations: DECL, decisions: [DECISION_OK] }).artifacts.skills;
    const row = rows.find((r) => r.id === "react-best-practices");
    assert.equal(row.class, "vendor-by-axis");
    // e o inverso: nome com prefixo de stack sem chave no lock NÃO é vendorizada.
    const local = fixture(
      baseFiles({
        "opencode.json": JSON.stringify({ agent: { "agente-b": { prompt: `{file:./${PROMPT_B}}` } } }),
        ".agents/skills/dart-sem-lock/SKILL.md": "# local\n",
        ".agents/skills/skill-util/SKILL.md": "# skill-util\n",
      }),
    );
    const decl = { ...DECL, skillCommon: [...DECL.skillCommon, "dart-sem-lock"] };
    const localRows = deriveInventory(local, { declarations: decl, decisions: [DECISION_OK] }).artifacts.skills;
    assert.equal(localRows.find((r) => r.id === "dart-sem-lock").class, "orphan+decision");
  });

  it("a fonte não contém heurística de prefixo/stack (grep = 0)", () => {
    const src = readFileSync(join(REPO_ROOT, ".opencode/plugins/lib/inventory/checks.mjs"), "utf8");
    assert.equal(src.includes("startsWith"), false);
    assert.equal(src.includes("inferStacks"), false);
  });

  it("I5 — consumer exige citação real: `harness` NÃO é consumida por `harness-report`", () => {
    const files = baseFiles({
      [PROMPT_A]: "# agente-a\nconsome skill-util, harness-report e rule-um.md\n",
      ".agents/skills/harness/SKILL.md": "# harness\n",
      "docs/harness-note.md": "harness: órfã deliberada\n",
    });
    const decl = { ...DECL, skillCommon: [...DECL.skillCommon, "harness"] };
    const decisions = [
      DECISION_OK,
      { ...DECISION_OK, subject: "harness", proof: "docs/harness-note.md:1" },
    ];
    const root = fixture(files);
    const report = check(root, { declarations: decl, decisions });
    const row = report.artifacts.skills.find((r) => r.id === "harness");
    assert.equal(row.cited, false, "`harness` dentro de `harness-report` não é citação");
    assert.equal(row.class, "orphan+decision");
    assert.equal(report.counters.skills.consumer, 1, "só skill-util é consumida");

    // controle: o MESMO id citado como token isolado vira consumer.
    const isolated = fixture(
      baseFiles({
        [PROMPT_A]: "# agente-a\nconsome skill-util, harness e rule-um.md\n",
        ".agents/skills/harness/SKILL.md": "# harness\n",
      }),
    );
    const isolatedRow = deriveInventory(isolated, {
      declarations: decl,
      decisions,
    }).artifacts.skills.find((r) => r.id === "harness");
    assert.equal(isolatedRow.cited, true);
    assert.equal(isolatedRow.class, "consumer");
  });
});

describe("PI-03 — agente medido pelo REGISTRO, não por AGENT.md", () => {
  it("chave com prompt resolvido é registered; contar só AGENT.md erraria o roster", () => {
    const report = check(fixture(baseFiles()));
    assert.equal(report.counters.agents.registry, 2);
    assert.equal(report.counters.agents.registered, 2);
    assert.equal(report.counters.agents.dirs, 2);
    assert.equal(byId(report, "inventory-agent-prompt-unresolved").status, "PASS");
  });

  it("prompt referenciado e ausente ⇒ inventory-agent-prompt-unresolved FAIL", () => {
    const files = baseFiles();
    delete files[PROMPT_B]; // ÚNICA diferença: o arquivo do prompt não existe
    const report = check(fixture(files));
    const r = byId(report, "inventory-agent-prompt-unresolved");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /agente-b/);
    assert.match(r.detail, /prompt ausente no disco/);
    assert.equal(report.counters.agents.registered, 1);
    assert.equal(report.ok, false);
  });

  it("registro sem prompt e diretório sem chave também são visíveis", () => {
    const root = fixture(
      baseFiles({
        "opencode.json": JSON.stringify({
          agent: {
            "agente-a": { prompt: `{file:./${PROMPT_A}}` },
            "agente-b": { prompt: `{file:./${PROMPT_B}}` },
            "agente-sem-prompt": { description: "sem prompt declarado" },
          },
        }),
        [".agents/agents/agente-fantasma/AGENT.md"]: "# sem chave no registro\n",
      }),
    );
    const report = check(root);
    assert.match(byId(report, "inventory-agent-prompt-unresolved").detail, /agente-sem-prompt/);
    assert.match(byId(report, "inventory-artifact-untracked").detail, /agent:agente-fantasma/);
  });
});

describe("PI-04 — lock↔disco nas duas direções", () => {
  it("chave do lock sem diretório ⇒ FAIL (o que checkVendor não vê)", () => {
    const root = fixture(
      baseFiles({
        [".agents/skills/.vendor-lock.json"]: JSON.stringify({ version: "1", skills: { "so-no-lock": {} } }),
      }),
    );
    const r = byId(check(root), "inventory-lock-disk-mismatch");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /so-no-lock .*sem diretório/);
  });

  it("diretório do lock sem SKILL.md legível ⇒ FAIL (a outra direção)", () => {
    const files = baseFiles({
      [".agents/skills/.vendor-lock.json"]: JSON.stringify({ version: "1", skills: { "skill-util": {} } }),
      // o diretório existe (tem um README), mas o lock promete um SKILL.md.
      ".agents/skills/skill-util/README.md": "# sem SKILL.md\n",
    });
    delete files[".agents/skills/skill-util/SKILL.md"]; // ÚNICA diferença
    const report = check(fixture(files));
    const r = byId(report, "inventory-lock-disk-mismatch");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, new RegExp(`skill-util .*sem ${SKILL_ENTRY_NAME}`));
    // R7 (shape irmão): o mesmo diretório também não é skill — o manifesto faltou.
    assert.equal(byId(report, "inventory-skill-without-manifest").status, "FAIL");
  });

  it("chave do lock com diretório e SKILL.md ⇒ PASS (controle do par)", () => {
    const root = fixture(
      baseFiles({
        [".agents/skills/.vendor-lock.json"]: JSON.stringify({ version: "1", skills: { "skill-util": {} } }),
      }),
    );
    const r = byId(check(root), "inventory-lock-disk-mismatch");
    assert.equal(r.status, "PASS");
    assert.match(r.detail, /1 chave\(s\) com diretório, 0 divergência/);
  });

  it("I4 — lock ILEGÍVEL não é lock ausente: FAIL com id próprio", () => {
    const cases = ["{ isto não é json", JSON.stringify({ version: "1", skills: ["skill-util"] })];
    for (const content of cases) {
      const report = check(
        fixture(baseFiles({ [".agents/skills/.vendor-lock.json"]: content })),
      );
      const unreadable = byId(report, "inventory-lock-unreadable");
      assert.equal(unreadable.status, "FAIL", `deveria reprovar: ${content}`);
      assert.match(unreadable.detail, /ilegível/);
      // input presente que mente nunca vira "lockPresent=false" silencioso.
      assert.equal(report.counters.lockPresent, false);
      assert.equal(report.counters.lockUnreadable, true);
      // e o mismatch não narra "ausente" — narra a suspensão pela ilegibilidade.
      assert.match(byId(report, "inventory-lock-disk-mismatch").detail, /ilegível/);
      assert.equal(report.ok, false);
    }
    // controle: ausente é o caso legítimo do destino, e continua PASS.
    const files = baseFiles();
    delete files[".agents/skills/.vendor-lock.json"];
    const absent = check(fixture(files));
    assert.equal(byId(absent, "inventory-lock-unreadable").status, "PASS");
    assert.equal(absent.counters.lockUnreadable, false);
    assert.match(byId(absent, "inventory-lock-disk-mismatch").detail, /ausente/);
  });

  it("R1 — lock como DIRETÓRIO é input presente ilegível, nunca ausente", () => {
    const files = baseFiles();
    delete files[".agents/skills/.vendor-lock.json"];
    // o path do lock existe, mas é diretório: `isFile()` devolvia false ⇒ absent.
    files[".agents/skills/.vendor-lock.json/placeholder"] = "não é lock\n";
    const report = check(fixture(files));
    const r = byId(report, "inventory-lock-unreadable");
    assert.equal(r.status, "FAIL", r.detail);
    assert.match(r.detail, /ilegível/);
    assert.equal(report.counters.lockPresent, false);
    assert.equal(report.counters.lockUnreadable, true);
    assert.match(byId(report, "inventory-lock-disk-mismatch").detail, /ilegível/);
    assert.equal(report.ok, false);
  });

  it("R1 — symlink QUEBRADO no path do lock também é presente, não ausente", () => {
    const files = baseFiles();
    delete files[".agents/skills/.vendor-lock.json"];
    const root = fixture(files);
    // `existsSync` segue o link e diria `false`; o elo existe no disco.
    symlinkSync("alvo-inexistente.json", join(root, ".agents/skills/.vendor-lock.json"));
    const report = check(root);
    const r = byId(report, "inventory-lock-unreadable");
    assert.equal(r.status, "FAIL", r.detail);
    assert.match(r.detail, /ilegível/);
    assert.equal(report.counters.lockUnreadable, true);
    assert.equal(report.ok, false);
  });
});

describe("PI-04b — R7: skill é o diretório COM SKILL.md", () => {
  it("diretório só com README não é skill e tem id próprio ⇒ FAIL", () => {
    const root = fixture(
      baseFiles({ ".agents/skills/skill-sem-manifesto/README.md": "# só README\n" }),
    );
    const report = check(root);
    const r = byId(report, "inventory-skill-without-manifest");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /skill-sem-manifesto/);
    assert.match(r.detail, /sem SKILL\.md/);
    // a contagem continua medindo o manifesto: as 2 skills reais, não o diretório.
    assert.equal(report.counters.skills.total, 2);
    assert.equal(report.ok, false);
  });

  it("controle: diretório COM SKILL.md continua skill e o id fica PASS", () => {
    const report = check(fixture(baseFiles()));
    const r = byId(report, "inventory-skill-without-manifest");
    assert.equal(r.status, "PASS");
    assert.match(r.detail, /sem SKILL\.md=0 \(2 skill\(s\)/);
    assert.equal(report.counters.skills.total, 2);
  });
});

describe("PI-05/PI-06 — o registry de decisões de dono, e ele expira", () => {
  it("OWNER_DECISIONS: 1 entrada, 6+ campos, proof vivo e expiresWhen executável", () => {
    assert.equal(OWNER_DECISIONS.length, 1);
    const [entry] = OWNER_DECISIONS;
    assert.equal(entry.subject, "harness-installer");
    assert.equal(entry.class, "skill");
    assert.equal(entry.decision, "keep");
    for (const field of DECISION_FIELDS) {
      assert.ok(entry[field] !== undefined, `campo ausente: ${field}`);
    }
    assert.deepEqual([...entry.expiresWhen].sort(), [...EXPIRY_CONDITIONS.skill].sort());
    // o proof aponta para a linha REAL que declara a skill em SKILLS_COMMON —
    // e essa linha é a prova do dono (o fluxo de instalação, não um agente).
    const [file, line] = entry.proof.split(":");
    const source = readFileSync(join(REPO_ROOT, file), "utf8").split("\n");
    assert.ok(source[Number(line) - 1].includes("harness-installer"), "proof não cita o sujeito");
    assert.equal(SKILLS_COMMON.includes("harness-installer"), true);
  });

  it("COMMON não confere classe: a órfã do fixture está em skillCommon e continua órfã", () => {
    const rows = deriveInventory(fixture(baseFiles()), { declarations: DECL, decisions: [DECISION_OK] }).artifacts.skills;
    const row = rows.find((r) => r.id === "skill-orfa");
    assert.equal(DECL.skillCommon.includes("skill-orfa"), true);
    assert.equal(row.class, "orphan+decision");
    assert.equal(row.axis.length, 0);
  });

  it("entrada incompleta reprova: sem expiresWhen, com token não executável, e proof morto", () => {
    const cases = [
      { ...DECISION_OK, expiresWhen: [] },
      { ...DECISION_OK, expiresWhen: ["subject-absent", "gained-registry"] },
      { ...DECISION_OK, proof: "sem-linha" },
      { ...DECISION_OK, proof: ".agents/skills/skill-orfa/SKILL.md:99" },
      { ...DECISION_OK, owner: " " },
    ];
    for (const broken of cases) {
      const report = check(fixture(baseFiles()), { decisions: [broken] });
      const r = byId(report, "owner-decision-incomplete");
      assert.equal(r.status, "FAIL", `deveria reprovar: ${JSON.stringify(broken)}`);
      assert.match(r.detail, /skill:skill-orfa/);
      assert.equal(report.ok, false);
    }
    // controle: a MESMA árvore com a entrada completa passa.
    const okReport = check(fixture(baseFiles()));
    assert.equal(byId(okReport, "owner-decision-incomplete").status, "PASS");
    assert.equal(okReport.ok, true);
  });

  it("proof que não cita o sujeito reprova (prova de outro artefato não serve)", () => {
    const broken = { ...DECISION_OK, proof: ".agents/rules/rule-um.md:1" };
    const r = byId(check(fixture(baseFiles()), { decisions: [broken] }), "owner-decision-incomplete");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /não nomeia o sujeito nem o dono/);
  });

  it("decisão obsoleta (a): o sujeito desapareceu do disco", () => {
    const files = baseFiles();
    delete files[".agents/skills/skill-orfa/SKILL.md"]; // o sujeito sai do disco
    const decl = { ...DECL, skillCommon: ["skill-util"] };
    const report = check(fixture(files), { declarations: decl });
    const r = byId(report, "owner-decision-stale");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /skill:skill-orfa .*desapareceu do disco/);
    assert.equal(report.ok, false);
  });

  it("decisão obsoleta (b): o sujeito ganhou consumidor", () => {
    const root = fixture(
      baseFiles({ [PROMPT_A]: "# agente-a\nconsome skill-util, skill-orfa e rule-um.md\n" }),
    );
    const report = check(root);
    const r = byId(report, "owner-decision-stale");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /skill:skill-orfa .*ganhou consumidor/);
    // a classe mudou junto: deixou de haver decisão a tomar.
    assert.equal(report.counters.skills.consumer, 2);
    assert.equal(report.counters.skills.orphan, 0);
  });

  it("decisão obsoleta (c): o sujeito entrou no lock", () => {
    const root = fixture(
      baseFiles({
        [".agents/skills/.vendor-lock.json"]: JSON.stringify({ version: "1", skills: { "skill-orfa": {} } }),
      }),
    );
    const r = byId(check(root), "owner-decision-stale");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /entrou no vendor-lock/);
  });

  it("C1 — expiresWhen estreito reprova: a entrada não escolhe a própria validade", () => {
    const narrow = { ...DECISION_OK, expiresWhen: ["subject-absent"] };
    const report = check(fixture(baseFiles()), { decisions: [narrow] });
    const r = byId(report, "owner-decision-incomplete");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /expiresWhen incompleto para skill: falta gained-consumer, gained-axis, gained-lock/);
    assert.equal(report.ok, false);

    // com o sujeito citado no roster a entrada continua INCOMPLETA — o FAIL vem
    // da forma do conjunto, não do acidente de a órfã ter ganhado consumidor.
    const cited = fixture(
      baseFiles({ [PROMPT_A]: "# agente-a\nconsome skill-util, skill-orfa e rule-um.md\n" }),
    );
    const citedReport = check(cited, { decisions: [narrow] });
    assert.equal(byId(citedReport, "owner-decision-incomplete").status, "FAIL");
    assert.equal(byId(citedReport, "owner-decision-stale").status, "PASS");
    assert.equal(citedReport.ok, false);
  });

  it("I1 — proof dentro do artefato do PRÓPRIO sujeito é tautológico ⇒ FAIL", () => {
    const tautological = { ...DECISION_OK, proof: ".agents/skills/skill-orfa/SKILL.md:1" };
    const report = check(fixture(baseFiles()), { decisions: [tautological] });
    const r = byId(report, "owner-decision-incomplete");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /artefato do próprio sujeito .*prova tautológica/);
    assert.equal(report.ok, false);
  });

  it("I1 — proof fora do sujeito que não nomeia owner nem subject ⇒ FAIL", () => {
    const root = fixture(baseFiles({ "docs/outra.md": "# nota\nsem menção a nada\n" }));
    const broken = { ...DECISION_OK, proof: "docs/outra.md:1" };
    const r = byId(check(root, { decisions: [broken] }), "owner-decision-incomplete");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /não nomeia o sujeito nem o dono/);
    // controle: a linha que nomeia o DONO também vale como lastro.
    const ownerRoot = fixture(
      baseFiles({ "docs/owner.md": "owner: docs/owner.md\n" }),
    );
    const byOwner = { ...DECISION_OK, owner: "docs/owner.md", proof: "docs/owner.md:1" };
    assert.equal(
      byId(check(ownerRoot, { decisions: [byOwner] }), "owner-decision-incomplete").status,
      "PASS",
    );
  });

  it("I2 — (class, subject) duplicado reprova", () => {
    const duplicate = { ...DECISION_OK, reason: "duplicata da mesma decisão" };
    const report = check(fixture(baseFiles()), { decisions: [DECISION_OK, duplicate] });
    const r = byId(report, "owner-decision-incomplete");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /skill:skill-orfa: entrada duplicada/);
    assert.equal(report.counters.ownerDecisions, 2);
    assert.equal(report.ok, false);
  });

  it("R2 — proof de agente em opencode.json é o artefato do próprio sujeito ⇒ FAIL", () => {
    const files = baseFiles({ ".agents/agents/agente-orfao/AGENT.md": "# sem chave no registro\n" });
    const decision = {
      subject: "agente-orfao",
      class: "agent",
      owner: "fluxo de teste (fixture)",
      decision: "keep",
      reason: "órfão deliberado deste fixture",
      proof: "opencode.json:1",
      expiresWhen: ["subject-absent", "gained-registry"],
    };
    const report = check(fixture(files), { decisions: [decision] });
    const r = byId(report, "owner-decision-incomplete");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /opencode\.json é o artefato do próprio sujeito .*prova tautológica/);
    assert.equal(report.ok, false);
  });

  it("R2 — proof em .spec/** reprova: snapshot datado não é fonte autoritativa", () => {
    const files = baseFiles({
      ".spec/prd/x/ADR.md": "# ADR (snapshot)\n- skill-orfa: órfã deliberada\n",
    });
    const decision = { ...DECISION_OK, proof: ".spec/prd/x/ADR.md:2" };
    const report = check(fixture(files), { decisions: [decision] });
    const r = byId(report, "owner-decision-incomplete");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /\.spec\/\*\* .*snapshot datado não é fonte autoritativa/);
    assert.equal(report.ok, false);
  });

  it("R3 — citação em comentário HTML não compra `consumer`; com decisions=[] a órfã reprova", () => {
    const files = baseFiles({
      [PROMPT_A]: "# agente-a\n<!-- skill-orfa --> consome skill-util e rule-um.md\n",
    });
    const report = check(fixture(files), { decisions: [] });
    const row = report.artifacts.skills.find((r) => r.id === "skill-orfa");
    assert.equal(row.cited, false, "comentário HTML não é citação viva");
    assert.equal(row.class, "orphan+decision");
    const r = byId(report, "inventory-artifact-untracked");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /skill:skill-orfa/);
    assert.equal(report.ok, false);
    // shape irmão: a citação REAL movida para fora do comentário continua valendo.
    const real = fixture(
      baseFiles({ [PROMPT_A]: "# agente-a\nconsome skill-util, skill-orfa e rule-um.md\n" }),
    );
    const realReport = check(real, { decisions: [] });
    const realRow = realReport.artifacts.skills.find((r) => r.id === "skill-orfa");
    assert.equal(realRow.cited, true);
    assert.equal(realRow.class, "consumer");
    assert.equal(realReport.ok, true, JSON.stringify(realReport.results.filter((r) => r.status === "FAIL")));
    assert.equal(stripHtmlComments("a <!-- x --> b"), "a  b");
  });

  it("R4 — agente órfão COM decisão fecha a equação (orphan+decision alcançável em verde)", () => {
    const files = baseFiles({
      ".agents/agents/agente-orfao/AGENT.md": "# sem chave no registro\n",
      "docs/decisoes.md":
        "# decisões do fixture\n- skill-orfa: órfã deliberada (owner: fluxo de teste)\n- agente-orfao: órfão deliberado (owner: fluxo de teste)\n",
    });
    const decision = {
      subject: "agente-orfao",
      class: "agent",
      owner: "fluxo de teste (fixture)",
      decision: "keep",
      reason: "órfão deliberado deste fixture",
      proof: "docs/decisoes.md:3",
      expiresWhen: ["subject-absent", "gained-registry"],
    };
    const report = check(fixture(files), { decisions: [DECISION_OK, decision] });
    assert.equal(byId(report, "inventory-attendance-drift").status, "PASS", byId(report, "inventory-attendance-drift").detail);
    assert.equal(byId(report, "inventory-artifact-untracked").status, "PASS");
    assert.equal(report.counters.agents.orphan, 1);
    assert.equal(report.counters.agents.decided, 1);
    assert.equal(report.ok, true, JSON.stringify(report.results.filter((r) => r.status === "FAIL")));
  });

  it("R4 — o inverso: o MESMO órfão sem decisão quebra a equação e reprova", () => {
    const files = baseFiles({ ".agents/agents/agente-orfao/AGENT.md": "# sem chave no registro\n" });
    const report = check(fixture(files));
    const drift = byId(report, "inventory-attendance-drift");
    assert.equal(drift.status, "FAIL");
    assert.match(drift.detail, /agents: registro=2 .*orphan\(non-decided\)=1/);
    assert.equal(byId(report, "inventory-artifact-untracked").status, "FAIL");
    assert.equal(report.ok, false);
  });

  it("R5 — decision fora do enum fechado reprova (TBD não é decisão)", () => {
    const broken = { ...DECISION_OK, decision: "TBD" };
    const report = check(fixture(baseFiles()), { decisions: [broken] });
    const r = byId(report, "owner-decision-incomplete");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, new RegExp(`decision fora do enum \\{${DECISION_VALUES.join(", ")}\\}`));

    const inverted = { ...DECISION_OK, decision: "REMOVE" };
    assert.equal(
      byId(check(fixture(baseFiles()), { decisions: [inverted] }), "owner-decision-incomplete").status,
      "FAIL",
      "o enum é case-sensitive: o valor executado é literal",
    );
    assert.deepEqual([...DECISION_VALUES], ["keep", "remove"]);
  });

  it("R5 — decision `remove` é válida e publica pendingRemoval=1", () => {
    const remove = { ...DECISION_OK, decision: "remove" };
    const report = check(fixture(baseFiles()), { decisions: [remove] });
    const r = byId(report, "owner-decision-incomplete");
    assert.equal(r.status, "PASS");
    assert.match(r.detail, /pendingRemoval=1/);
    assert.equal(report.counters.pendingRemoval, 1);
    assert.equal(report.ok, true, JSON.stringify(report.results.filter((x) => x.status === "FAIL")));
    // shape irmão: `keep` é válido e NÃO entra na dívida de remoção.
    assert.equal(check(fixture(baseFiles())).counters.pendingRemoval, 0);
  });
});

describe("PI-07 — órfão novo reprova, classe ambígua reprova", () => {
  it("inventory-artifact-untracked: skill nova sem classe e sem decisão ⇒ FAIL", () => {
    const root = fixture(
      baseFiles({
        ".agents/skills/skill-nova/SKILL.md": "# skill-nova\n",
        "docs/decisions-nova.md": "# decisões\n- skill-nova: órfã deliberada\n",
      }),
    );
    const decl = { ...DECL, skillCommon: [...DECL.skillCommon, "skill-nova"] };
    const report = check(root, { declarations: decl });
    const r = byId(report, "inventory-artifact-untracked");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /skill:skill-nova/);
    // o controle é o MESMO arquivo com a decisão registrada.
    const decided = check(root, {
      declarations: decl,
      decisions: [
        DECISION_OK,
        { ...DECISION_OK, subject: "skill-nova", proof: "docs/decisions-nova.md:2" },
      ],
    });
    assert.equal(byId(decided, "inventory-artifact-untracked").status, "PASS");
    assert.equal(decided.ok, true, JSON.stringify(decided.results.filter((x) => x.status === "FAIL")));
  });

  it("rule nova sem classe e sem decisão também reprova", () => {
    const root = fixture(baseFiles({ ".agents/rules/rule-nova.md": "# nova\n" }));
    const r = byId(check(root, { declarations: { ...DECL, ruleCommon: [...DECL.ruleCommon, "rule-nova.md"] } }), "inventory-artifact-untracked");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /rule:rule-nova/);
  });

  it("inventory-class-ambiguous: lock diz vendorizada, mapa de eixo diz local ⇒ FAIL", () => {
    const files = baseFiles({
      ".agents/skills/skill-dup/SKILL.md": "# skill-dup\n",
      [".agents/skills/.vendor-lock.json"]: JSON.stringify({ version: "1", skills: { "skill-dup": {} } }),
    });
    const decl = { ...DECL, skillCommon: [...DECL.skillCommon, "skill-dup"], skillAxis: { "frontend=react": ["skill-dup"] } };
    const report = check(fixture(files), { declarations: decl });
    const r = byId(report, "inventory-class-ambiguous");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /skill-dup .*vendor-by-axis.*\+ axis \(frontend=react\)/);
    // controle: a MESMA árvore sem a entrada do eixo ⇒ vendor-by-axis, PASS.
    const control = check(fixture(files), {
      declarations: { ...DECL, skillCommon: [...DECL.skillCommon, "skill-dup"] },
    });
    assert.equal(byId(control, "inventory-class-ambiguous").status, "PASS");
    assert.equal(control.counters.skills["vendor-by-axis"], 1);
  });

  it("vendorizada E citada NÃO é ambiguidade — é a precedência declarada", () => {
    const root = fixture(
      baseFiles({
        [".agents/skills/.vendor-lock.json"]: JSON.stringify({ version: "1", skills: { "skill-util": {} } }),
      }),
    );
    const report = check(root);
    assert.equal(byId(report, "inventory-class-ambiguous").status, "PASS");
    assert.match(byId(report, "inventory-class-ambiguous").detail, /vendor×consumer resolvido, vendorCited=1/);
  });
});

describe("PI-07 — fechamento aritmético (inventory-attendance-drift)", () => {
  it("declaração fantasma quebra a equação ⇒ FAIL com os counters no detalhe", () => {
    const decl = { ...DECL, skillCommon: [...DECL.skillCommon, "fantasma-local"] };
    const report = check(fixture(baseFiles()), { declarations: decl });
    const r = byId(report, "inventory-attendance-drift");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /skills: disco=2 ≠ lock∩disco \(0\) \+ declarações locais \(3\)/);
    // sintoma, não causa: nada no disco ficou sem classe.
    assert.equal(byId(report, "inventory-artifact-untracked").status, "PASS");
    assert.equal(byId(report, "inventory-class-ambiguous").status, "PASS");
  });

  it("rule declarada que não existe no disco quebra a equação", () => {
    const decl = { ...DECL, ruleCommon: [...DECL.ruleCommon, "rule-fantasma.md"] };
    const r = byId(check(fixture(baseFiles()), { declarations: decl }), "inventory-attendance-drift");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /rules: disco=1 ≠ declarações do instalador \(2\)/);
  });

  it("I3 — declaração fantasma tem id próprio, não só o agregado", () => {
    const decl = {
      ...DECL,
      skillCommon: [...DECL.skillCommon, "fantasma-local"],
      ruleCommon: [...DECL.ruleCommon, "rule-fantasma.md"],
    };
    const report = check(fixture(baseFiles()), { declarations: decl });
    const r = byId(report, "inventory-declaration-phantom");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /skill:fantasma-local .*sem diretório/);
    assert.match(r.detail, /rule:rule-fantasma\.md .*sem arquivo/);
    assert.equal(report.ok, false);
  });

  it("I3 — par compensatório (remove 1 real, inventa 1) não compra silêncio", () => {
    // A equação fecha (2 declaradas, 2 no disco) mas uma das declarações não
    // tem artefato: sem id próprio, o par compensaria e o fantasma passaria.
    const decl = { ...DECL, skillCommon: ["skill-util", "fantasma-local"] };
    const report = check(fixture(baseFiles()), { declarations: decl });
    assert.equal(byId(report, "inventory-attendance-drift").status, "PASS");
    const r = byId(report, "inventory-declaration-phantom");
    assert.equal(r.status, "FAIL");
    assert.match(r.detail, /skill:fantasma-local/);
    assert.equal(report.ok, false);
  });

  it("fechamento das classes fecha: disco = Σ classes (PASS narra a conta)", () => {
    const r = byId(check(fixture(baseFiles())), "inventory-attendance-drift");
    assert.equal(r.status, "PASS");
    assert.match(r.detail, /skills 2=0\+1\+0\+1/);
    assert.match(r.detail, /rules 1=1\+0\+0/);
    assert.match(r.detail, /agents 2=2\+0/);
  });
});

describe("PI-10 — adapter V19 no runner selado e o repo real", () => {
  it("o repo real fecha: 48 = 25+22+0+1; 8 = 7+1+0; 10 = 10+0", () => {
    const report = runStaticChecks();
    const v19 = byId(report, "V19");
    assert.equal(v19.status, "PASS", v19.detail);
    assert.match(v19.detail, /skills=48 \(vendor-by-axis=25, consumer=22, axis=0, orphan=1\)/);
    assert.match(v19.detail, /rules=8 \(consumer=7, axis=1, orphan=0\)/);
    assert.match(v19.detail, /agents=10\/10 \(registered=10, orphan=0\)/);
    assert.match(v19.detail, /vendorCited=0/);
    assert.match(v19.detail, /lockPresent=true/);
    assert.match(v19.detail, /owner-decisions=1/);
    assert.equal(report.ok, true);
  });

  it("o veredito barra: fixture com órfã nova ⇒ V19 FAIL, counters no detalhe e ok=false", () => {
    const root = fixture(baseFiles({ ".agents/skills/skill-nova/SKILL.md": "# nova\n" }));
    const report = runStaticChecks(root);
    const v19 = byId(report, "V19");
    assert.equal(v19.status, "FAIL");
    assert.match(v19.detail, /inventory-artifact-untracked/);
    // counters de fechamento publicados TAMBÉM no vermelho.
    assert.match(v19.detail, /skills=3 /);
    assert.match(v19.detail, /vendorCited=0/);
    assert.equal(report.ok, false);
  });

  it("V19 FAIL quando a declaração fantasma quebra o fechamento (adapter usa as do dono)", () => {
    // O adapter injeta as declarações reais do instalador; num root vazio elas
    // são fantasmas ⇒ a equação do fechamento acusa. Nunca verde por omissão.
    const report = runStaticChecks(fixture(baseFiles()));
    const v19 = byId(report, "V19");
    assert.equal(v19.status, "FAIL", v19.detail);
    assert.match(v19.detail, /inventory-attendance-drift/);
  });

  it("adapter expõe os mesmos 10 ids do módulo (uma implementação, dois acessos)", () => {
    const ids = inventoryCheckResults().map((r) => r.id);
    assert.deepEqual(ids, ALL_IDS);
  });

  it("as classes declaradas são as da ADR §2.3, na ordem da precedência", () => {
    assert.deepEqual(CLASS_LABELS.skill, ["vendor-by-axis", "consumer", "axis", "orphan+decision"]);
    assert.deepEqual(CLASS_LABELS.rule, ["consumer", "axis", "orphan+decision"]);
    assert.deepEqual(CLASS_LABELS.agent, ["registered", "orphan+decision"]);
    assert.match(VENDOR_LOCK_NAME, /vendor-lock/);
    assert.deepEqual(Object.keys(RULES_BY_AXIS).sort(), ["frontend=react", "frontend=vue"]);
    assert.deepEqual(Object.keys(SKILLS_BY_AXIS).sort(), ["frontend=react", "frontend=vue"]);
    assert.equal(RULES_COMMON.length > 0, true);
  });
});
