// scaffold.spec.mjs — TDD de ADR-001 (SCAF-01..08), interface congelada I1..I8.
//
// Cada describe abaixo foi escrito ANTES do código de produção. As asserções
// medem bytes literais (OPEN/CLOSE), classes de path, estados, mensagens e a
// via única de escrita — não intenção de prosa.
import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  lstatSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tempScope } from "../test-temp.mjs";
import {
  PATH_CLASSES,
  MARKERS,
  classifyPath,
  isOwnedPath,
  isAttachedPath,
  markerState,
  identityBody,
  appendBlock,
  resolveStack,
  stackRefusalMessage,
  buildIdentityPlan,
  identityReportLines,
  STACK_ARTIFACTS,
} from "../harness-sync.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SYNC = join(REPO_ROOT, "scripts", "harness-sync.mjs");
const DESIGN_TEMPLATE = join(REPO_ROOT, ".agents", "skills", "design-system", "templates", "DESIGN.md");
const TMP = tempScope({ label: "scaffold" });
afterEach(() => TMP.cleanup());
after(() => TMP.cleanup());

const { OPEN, CLOSE } = MARKERS;
const SUITE = ["--suite", "node --test"];

function newTarget(files = {}) {
  const parent = TMP.tmp();
  const target = join(parent, "alvo");
  mkdirSync(target, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const file = join(target, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return target;
}

function run(args) {
  const res = spawnSync(process.execPath, [SYNC, ...args], { encoding: "utf8" });
  return {
    code: res.status,
    out: `${res.stdout ?? ""}${res.stderr ?? ""}${res.error ? `\nspawn: ${res.error.message}` : ""}`,
  };
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

// Flags explícitas: a stack indeterminada recusa por I5, então todo teste que
// não tem stack detectada precisa declará-la.
function init(target, extra = []) {
  return run(["init", "--target", target, ...SUITE, ...extra]);
}
function update(target, extra = []) {
  return run(["update", "--target", target, ...extra]);
}
function doctor(target) {
  return run(["doctor", "--target", target]);
}

// ---------------------------------------------------------------------------
describe("SCAF-01 — classes de path PRÓPRIO/ANEXADO (RF-01, I1)", () => {
  it("tabela de 9 casos: 7 válidos classificam, 2 inválidos falham fechado", () => {
    const cases = [
      [".agents/rules/project-frontend.md", "owned"],
      [".agents/rules/project-backend.md", "owned"],
      [".agents/rules/project-fullstack.md", "owned"],
      ["tokens/base.json", "owned"],
      ["tokens/semantic.json", "owned"],
      ["AGENTS.md", "attached"],
      ["DESIGN.md", "attached"],
      ["tokens/themes/dark.json", null],
      ["README.md", null],
    ];
    for (const [rel, expected] of cases) {
      if (expected === null) {
        assert.throws(() => classifyPath(rel), TypeError, `path fora da lista: ${rel}`);
        assert.equal(isOwnedPath(rel), false, rel);
        assert.equal(isAttachedPath(rel), false, rel);
      } else {
        assert.equal(classifyPath(rel), expected, rel);
        assert.equal(isOwnedPath(rel), expected === "owned", rel);
        assert.equal(isAttachedPath(rel), expected === "attached", rel);
      }
    }
  });

  it("PATH_CLASSES é a lista fechada: 3 project-*.md + tokens/*.json + 2 anexados", () => {
    assert.deepEqual([...PATH_CLASSES.owned].sort(), [
      ".agents/rules/project-backend.md",
      ".agents/rules/project-frontend.md",
      ".agents/rules/project-fullstack.md",
      "tokens/*.json",
    ]);
    assert.deepEqual([...PATH_CLASSES.attached], ["AGENTS.md", "DESIGN.md"]);
  });
});

// ---------------------------------------------------------------------------
describe("SCAF-02 — gramática do marcador e append byte-seguro (RF-02, I2)", () => {
  it("literais congelados: OPEN/CLOSE exatos, sem folga", () => {
    assert.equal(OPEN, "<!-- harness:v2:start -->");
    assert.equal(CLOSE, "<!-- harness:v2:end -->");
  });

  it("6 fixtures: 0 par, 1 par, 2 pares, ordem invertida, linha duplicada no BODY, sem LF final", () => {
    const body = identityBody("AGENTS.md");
    assert.equal(markerState("", body).state, "absent");
    assert.equal(markerState(`prefácio\n${OPEN}\n${body}\n${CLOSE}\n`, body).state, "match");
    assert.equal(
      markerState(`${OPEN}\n${body}\n${CLOSE}\n${OPEN}\n${body}\n${CLOSE}\n`, body).state,
      "malformed",
    );
    assert.equal(markerState(`${CLOSE}\n${body}\n${OPEN}\n`, body).state, "malformed");
    assert.equal(
      markerState(`${OPEN}\n${body}\n${OPEN}\n${CLOSE}\n`, body).state,
      "malformed",
    );
    const noLf = markerState("sem LF final", body);
    assert.equal(noLf.state, "absent");
    assert.equal(appendBlock("sem LF final", "AGENTS.md"), `sem LF final\n${OPEN}\n${body}\n${CLOSE}\n`);
  });

  it("prefixo byte-idêntico (hash) e 1 LF inserido antes de OPEN quando o arquivo não termina em LF", () => {
    const prefix = Buffer.from("#AGENTS\r\nown\r\n\nlinha sem LF", "utf8"); // CRLF e bytes crus preservados
    const result = appendBlock(prefix, "AGENTS.md");
    assert.equal(sha256(result.slice(0, prefix.length)), sha256(prefix), "prefixo intocado byte a byte");
    assert.equal(result[prefix.length], 0x0a, "um LF novo antes de OPEN");
    assert.ok(result.slice(prefix.length + 1).toString("utf8").startsWith(`${OPEN}\n`));
    assert.ok(result.toString("utf8").endsWith(`${CLOSE}\n`));
  });

  it("variante sem espaços e marcador simples legado não são reconhecidos (0 par ⇒ append)", () => {
    const body = identityBody("AGENTS.md");
    const legacy = `<!-- harness:v2 -->\n<!--harness:v2:start-->\n<!--HARNESS:V2:START-->\n`;
    assert.equal(markerState(legacy, body).state, "absent");
    const appended = appendBlock(legacy, "AGENTS.md");
    assert.ok(appended.startsWith(legacy), "marcadores legados ficam no prefixo");
    assert.equal(appended.split(OPEN).length - 1, 1, "exatamente 1 OPEN no resultado");
  });

  it("BODY não contém linha igual a OPEN ou CLOSE", () => {
    for (const rel of ["AGENTS.md", "DESIGN.md"]) {
      const body = identityBody(rel);
      assert.ok(body.length > 0);
      for (const line of body.split("\n")) {
        assert.notEqual(line, OPEN, rel);
        assert.notEqual(line, CLOSE, rel);
      }
    }
  });
});

// ---------------------------------------------------------------------------
describe("SCAF-03 — máquina de estados por path (RF-03, I3)", () => {
  const stack = { frontend: "react", backend: "java", origin: "flag" };

  it("tabela estado × ação (12 linhas): 6 estados, preserved/divergent/malformed nunca escrevem", () => {
    const target = newTarget({ "pom.xml": "<project/>" });
    const bodyAgents = identityBody("AGENTS.md");
    const bodyDesign = identityBody("DESIGN.md");
    const cases = [
      // [arquivos no alvo, path esperado, estado, ação]
      [{}, STACK_ARTIFACTS.fullstack, "created", "create"], // frontend+backend
      [{ [STACK_ARTIFACTS.fullstack]: bodyOfRule(stack) }, STACK_ARTIFACTS.fullstack, "skip", "skip"],
      [{ [STACK_ARTIFACTS.fullstack]: "# do maintainer\n" }, STACK_ARTIFACTS.fullstack, "preserved", "skip"],
      [{}, "AGENTS.md", "created", "create"],
      [{ "AGENTS.md": "# time\n" }, "AGENTS.md", "appended", "append"],
      [{ "AGENTS.md": `${OPEN}\n${bodyAgents}\n${CLOSE}\n` }, "AGENTS.md", "skip", "skip"],
      [{ "AGENTS.md": `${OPEN}\n${bodyAgents}-editado\n${CLOSE}\n` }, "AGENTS.md", "divergent", "skip"],
      [{}, "DESIGN.md", "created", "create"],
      [{ "DESIGN.md": `${OPEN}\n${bodyDesign}\n${CLOSE}\n` }, "DESIGN.md", "skip", "skip"],
      [{ "DESIGN.md": `${OPEN}\nEDITADO\n${CLOSE}\n` }, "DESIGN.md", "divergent", "skip"],
      [{ "AGENTS.md": `${CLOSE}\n${OPEN}\n` }, "AGENTS.md", "malformed", "skip"],
      [{ "DESIGN.md": `${OPEN}\n${OPEN}\n${CLOSE}\n` }, "DESIGN.md", "malformed", "skip"],
    ];
    for (const [files, rel, state, action] of cases) {
      const dir = newTarget({ ...files, "pom.xml": "<project/>" });
      const plan = buildIdentityPlan(dir, stack);
      const entry = plan.find((e) => e.rel === rel);
      assert.ok(entry, `plano sem ${rel}`);
      assert.equal(entry.state, state, `${rel}: estado`);
      assert.equal(entry.action, action, `${rel}: ação`);
      if (state === "preserved" || state === "divergent" || state === "malformed") {
        assert.notEqual(entry.action, "update", `${rel}: ${state} virou update`);
      }
    }
    assert.ok(target);
  });

  it("reexecução após created/appended produz skip nos mesmos paths", () => {
    const target = newTarget({ "package.json": JSON.stringify({ dependencies: { react: "^18" } }) });
    const first = buildIdentityPlan(target, { frontend: "react", backend: null, origin: "detectada" });
    for (const entry of first) {
      if (entry.action === "create" || entry.action === "append") {
        const file = join(target, entry.rel);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, entry.content);
      }
    }
    const second = buildIdentityPlan(target, { frontend: "react", backend: null, origin: "detectada" });
    for (const entry of second) assert.equal(entry.state, "skip", `${entry.rel}: 2ª execução`);
  });

  it("malformed ⇒ exit 1, zero escrita e zero backup (CLI)", () => {
    const target = newTarget({
      "package.json": JSON.stringify({ dependencies: { react: "^18" } }),
      "AGENTS.md": `${CLOSE}\n${OPEN}\nconteúdo do time\n`,
    });
    const before = readFileSync(join(target, "AGENTS.md"), "utf8");
    const res = init(target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /ERROR seção malformada AGENTS\.md/);
    assert.equal(readFileSync(join(target, "AGENTS.md"), "utf8"), before, "nenhum byte escrito no anexado");
    assert.equal(existsSync(join(target, ".harness-manifest.json")), false, "nenhum manifesto");
    assert.equal(existsSync(join(target, ".agents")), false, "nenhum payload");
    assert.equal(existsSync(join(dirname(target), ".harness-backup")), false, "nenhum backup");
  });
});

// ---------------------------------------------------------------------------
describe("SCAF-04 — manifesto/doctor: PRÓPRIOS dentro, ANEXADOS fora (RF-04, I4)", () => {
  it("init: own no manifesto com sha256; attached fora", () => {
    const target = newTarget({ "package.json": JSON.stringify({ dependencies: { react: "^18" } }) });
    assert.equal(init(target).code, 0);
    const files = readJson(join(target, ".harness-manifest.json")).files;
    assert.ok(STACK_ARTIFACTS.frontend in files, "project-frontend.md no manifesto");
    assert.match(files[STACK_ARTIFACTS.frontend], /^[0-9a-f]{64}$/);
    assert.equal(sha256(readFileSync(join(target, STACK_ARTIFACTS.frontend))), files[STACK_ARTIFACTS.frontend]);
    for (const rel of ["AGENTS.md", "DESIGN.md"]) {
      assert.equal(rel in files, false, `${rel} fora do manifesto (14c)`);
    }
  });

  it("PRÓPRIO corrompido ⇒ doctor exit 1; ANEXADO editado ou apagado ⇒ doctor segue 0", () => {
    const target = newTarget({ "package.json": JSON.stringify({ dependencies: { react: "^18" } }) });
    assert.equal(init(target).code, 0);
    assert.equal(doctor(target).code, 0);

    writeFileSync(join(target, "AGENTS.md"), `${readFileSync(join(target, "AGENTS.md"), "utf8")}\n# editado pelo time\n`);
    assert.equal(doctor(target).code, 0, "edição legítima de anexado não é FAIL");
    rmSync(join(target, "DESIGN.md"));
    assert.equal(doctor(target).code, 0, "anexado apagado não é FAIL do doctor");

    const own = join(target, STACK_ARTIFACTS.frontend);
    writeFileSync(own, `${readFileSync(own, "utf8")}\nX`);
    const bad = doctor(target);
    assert.equal(bad.code, 1);
    assert.match(bad.out, new RegExp(`sha256 divergente do manifesto: ${STACK_ARTIFACTS.frontend.replace(/[.]/g, "\\.")}`));
  });

  it("PRESERVED_RES global continua proibindo sobrescrita; allowlist cobre só o path ausente", () => {
    const target = newTarget({
      "package.json": JSON.stringify({ dependencies: { react: "^18" } }),
      [STACK_ARTIFACTS.frontend]: "# regra do maintainer\n",
    });
    const res = update(target, ["--frontend", "react", ...SUITE]);
    assert.equal(res.code, 0, res.out);
    assert.equal(readFileSync(join(target, STACK_ARTIFACTS.frontend), "utf8"), "# regra do maintainer\n");
    assert.match(res.out, new RegExp(`${STACK_ARTIFACTS.frontend.replace(/[.]/g, "\\.")} preserved`));
  });
});

// ---------------------------------------------------------------------------
describe("SCAF-05 — flags de stack e recusa sem sinal (RF-05, I5)", () => {
  it("5 casos de resolução: detectada, flag, override, nulo, inválida", () => {
    const detected = newTarget({ "package.json": JSON.stringify({ dependencies: { vue: "^3" }, scripts: { test: "vitest" } }) });
    assert.deepEqual(resolveStack(detected, {}), { frontend: "vue", backend: null, origin: "detectada" });

    const plain = newTarget();
    assert.deepEqual(resolveStack(plain, { backend: "java" }), { frontend: null, backend: "java", origin: "flag" });
    assert.deepEqual(resolveStack(detected, { frontend: "react", backend: "node" }), {
      frontend: "react", backend: "node", origin: "flag",
    }); // override vence detecção
    assert.equal(resolveStack(plain, {}), null);
    assert.equal(resolveStack(plain, { frontend: "solid" }), null);
  });

  it("CLI nulo|nulo: exit 1, mensagem literal de I5, zero escrita e zero backup", () => {
    const target = newTarget();
    const res = run(["init", "--target", target, ...SUITE]);
    assert.equal(res.code, 1, res.out);
    assert.match(
      res.out,
      /^harness-sync init: stack indeterminada: passe --frontend <react\|vue> e\/ou --backend <java\|rust\|nestjs\|node>$/m,
    );
    assert.deepEqual(readJsonSafe(join(target, "harness.config.json")), null);
    assert.equal(existsSync(join(target, ".agents")), false);
    assert.equal(existsSync(join(target, ".harness-manifest.json")), false);
    assert.equal(existsSync(join(dirname(target), ".harness-backup")), false);
  });

  it("CLI flag inválida: mesma recusa com o valor nomeado", () => {
    const target = newTarget();
    const res = init(target, ["--frontend", "solid"]);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /stack indeterminada/);
    assert.match(res.out, /frontend=solid/);
    assert.equal(existsSync(join(target, ".agents")), false);
  });

  it("CLI com flag: artefato de stack correto e origem=flag no relatório", () => {
    const target = newTarget();
    const res = init(target, ["--frontend", "vue", "--backend", "java"]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /harness-sync init: stack origem=flag frontend=vue backend=java/);
    assert.ok(existsSync(join(target, STACK_ARTIFACTS.fullstack)));
    assert.equal(existsSync(join(target, STACK_ARTIFACTS.frontend)), false);
    assert.equal(existsSync(join(target, STACK_ARTIFACTS.backend)), false);
    assert.equal(existsSync(join(target, ".agents/skills")), true);
  });

  it("stackRefusalMessage mantém o <verb> no prefixo", () => {
    for (const verb of ["init", "update", "doctor"]) {
      assert.match(
        stackRefusalMessage(verb),
        new RegExp(`^harness-sync ${verb}: stack indeterminada:`),
      );
    }
  });
});

// ---------------------------------------------------------------------------
describe("SCAF-06 — relatório determinístico e dry-run = apply (RF-06, I6)", () => {
  it("linhas literais e ordem: stack → paths POSIX → WARN/ERROR → resumo", () => {
    const target = newTarget({
      "package.json": JSON.stringify({ dependencies: { react: "^18" } }),
      "AGENTS.md": `${OPEN}\nEDITADO\n${CLOSE}\n`,
    });
    const plan = buildIdentityPlan(target, { frontend: "react", backend: null, origin: "detectada" });
    const lines = identityReportLines("init", plan, { frontend: "react", backend: null, origin: "detectada" });
    assert.equal(lines[0], "harness-sync init: stack origem=detectada frontend=react backend=null");
    assert.equal(lines.at(-1), "harness-sync init: plano created=2 appended=0 preserved=0 skip=0 divergent=1 malformed=0");
    const pathLines = lines.filter((l) => l.startsWith("harness-sync init: ") && l.includes(" ") && !/stack |plano /.test(l));
    const rels = pathLines.map((l) => l.split(" ").at(-2));
    assert.deepEqual(rels, [...rels].sort(), "paths ordenados POSIX");
    assert.ok(lines.includes(`WARN divergência AGENTS.md: seção gerenciada preservada (não reescrita)`));
    assert.ok(lines.every((l) => l.startsWith("harness-sync ") || l.startsWith("WARN ") || l.startsWith("ERROR ")));
  });

  it("WARN divergência não altera exit; ERROR malformada força exit 1 (CLI)", () => {
    const divergent = newTarget({
      "package.json": JSON.stringify({ dependencies: { react: "^18" } }),
      "AGENTS.md": `${OPEN}\nEDITADO\n${CLOSE}\n`,
    });
    const ok = init(divergent);
    assert.equal(ok.code, 0, ok.out);
    assert.match(ok.out, /WARN divergência AGENTS\.md/);
    assert.equal(existsSync(join(divergent, STACK_ARTIFACTS.frontend)), true);

    const malformed = newTarget({
      "package.json": JSON.stringify({ dependencies: { react: "^18" } }),
      "DESIGN.md": `${OPEN}\n${CLOSE}\n${OPEN}\n${CLOSE}\n`,
    });
    const bad = init(malformed);
    assert.equal(bad.code, 1, bad.out);
    assert.match(bad.out, /ERROR seção malformada DESIGN\.md/);
    assert.equal(existsSync(join(malformed, STACK_ARTIFACTS.frontend)), false);
  });

  it("--dry-run imprime o mesmo conjunto de linhas I6 do apply, sem escrever", () => {
    const fixture = () => ({
      "package.json": JSON.stringify({ dependencies: { react: "^18" } }),
      "AGENTS.md": "# time\n",
    });
    const dryTarget = newTarget(fixture());
    const applyTarget = newTarget(fixture());
    const dry = init(dryTarget, ["--dry-run"]);
    assert.equal(dry.code, 0, dry.out);
    assert.equal(existsSync(join(dryTarget, "AGENTS.md")), true, "fixture intacta");
    assert.equal(existsSync(join(dryTarget, STACK_ARTIFACTS.frontend)), false, "dry-run não escreve");
    const applied = init(applyTarget);
    assert.equal(applied.code, 0, applied.out);

    const i6 = (out) => out.split("\n").filter((l) => /^(harness-sync (init|update): (stack |.{3,} (created|appended|preserved|skip|divergent|malformed)$|plano )|WARN divergência |ERROR seção malformada )/.test(l));
    assert.deepEqual(i6(dry.out), i6(applied.out), "dry-run = apply, linha a linha");
  });

  // SCAF-06 (review): o resumo I6 só valia no sub-relatório puro. Aqui a prova
  // é o stdout REAL do subprocess — a linha legada de escrita não pode fechar.
  it("stdout do init real: stack primeiro e resumo I6 por último", () => {
    const target = newTarget({
      "package.json": JSON.stringify({ dependencies: { react: "^18" } }),
    });
    const res = init(target);
    assert.equal(res.code, 0, res.out);
    const out = res.out.trimEnd().split("\n");
    assert.ok(out.some((l) => /^init: \d+ file\(s\) written/.test(l)), "linha legada de escrita presente");
    assert.match(out[0], /^harness-sync init: stack origem=/, "stack é a primeira linha");
    assert.match(out.at(-1), /^harness-sync init: plano created=/, "resumo I6 é a última linha");
  });
});

// ---------------------------------------------------------------------------
describe("SCAF-07 — via única de escrita (RF-07, I7)", () => {
  it("todo fs.writeFileSync da fonte está dentro de writeAtomic", () => {
    const source = readFileSync(SYNC, "utf8");
    const hits = [...source.matchAll(/writeFileSync\s*\(/g)].map((m) => m.index);
    const atomic = source.indexOf("function writeAtomic");
    const guarded = source.indexOf("function writeGuarded");
    assert.ok(hits.length >= 1, "writeAtomic deve existir");
    assert.ok(atomic > 0 && guarded > atomic, "writeAtomic privado antes de writeGuarded");
    for (const at of hits) {
      assert.ok(at > atomic && at < guarded, `writeFileSync fora de writeAtomic em ${at}`);
    }
  });

  it("symlink plantado em path novo ⇒ exit 1, nenhum byte fora do alvo", () => {
    const target = newTarget({ "package.json": JSON.stringify({ dependencies: { react: "^18" } }) });
    const outside = join(dirname(target), "fora-agente.md");
    writeFileSync(outside, "INTOCADO\n");
    symlinkSync(outside, join(target, "AGENTS.md"));
    const res = init(target);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /symlink no destino/);
    assert.equal(readFileSync(outside, "utf8"), "INTOCADO\n");
    assert.equal(lstatSync(join(target, "AGENTS.md")).isSymbolicLink(), true);
  });
});

// ---------------------------------------------------------------------------
describe("SCAF-08 — templates da skill design-system, sem token inventado (RF-08, I8)", () => {
  it("DESIGN.md gerado tem os bytes do template da skill (BODY = template sem LF final)", () => {
    const template = readFileSync(DESIGN_TEMPLATE, "utf8").replace(/\n+$/, "");
    assert.equal(identityBody("DESIGN.md"), template);
    const target = newTarget({ "package.json": JSON.stringify({ dependencies: { react: "^18" } }) });
    assert.equal(init(target).code, 0);
    const content = readFileSync(join(target, "DESIGN.md"), "utf8");
    assert.ok(content.includes(template));
    assert.ok(content.startsWith(`${OPEN}\n`), "arquivo novo = só BLOCO");
  });

  it("gerador não contém hex/fonte/paleta e não escolhe perfil", () => {
    const source = readFileSync(SYNC, "utf8");
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/, "nenhum hex literal no gerador");
    assert.doesNotMatch(source, /font-family\s*:/, "nenhuma fonte literal no gerador");
    assert.doesNotMatch(source, /--profile/, "perfil não é decidido por esta ADR");
    assert.doesNotMatch(source, /profiles\/(?:shadcn|claude)/, "nenhum perfil escolhido por palpite");
  });
});

// helpers -------------------------------------------------------------------
function readJsonSafe(file) {
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function bodyOfRule(stack) {
  const plan = buildIdentityPlan(newTarget(), stack);
  const rel = STACK_ARTIFACTS.fullstack;
  const entry = plan.find((e) => e.rel === rel);
  return entry.content.toString("utf8");
}
