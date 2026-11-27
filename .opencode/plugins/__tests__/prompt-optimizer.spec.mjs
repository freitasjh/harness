// prompt-optimizer.spec.mjs — contrato EXECUTÁVEL do Prompt Gate (F5), SKILL v4.
//
// DECLARAÇÃO DE ESCOPO (obrigatória; D-F5-B):
//   O veredito comportamental "7/10 prompts claros caem na Rota B na 1ª tentativa"
//   NÃO é executável nesta suite. Não existe runner de LLM aqui, e scoring de
//   prompt é comportamento de modelo — não função pura. O que este arquivo cobre
//   é o CONTRATO (marcadores do SKILL, §0 do call site, fixtures e a coerência
//   interna do veredito esperado de cada fixture) e as REGRAS V3..V6. Ele NÃO
//   afirma performance do modelo e NÃO registra "provado 7/10".
//
//   Executável: contagem de fixtures, proporção 7/3, bloqueios E1/E2/E5,
//   consistência frontmatter ↔ veredito declarado, presença de Stage 0/ledger/
//   PICCO no SKILL, citação no §0, ausência de "Tier 1/2/3" nos 2 call sites,
//   V5 (≤10 constraints nos exemplos) e V6 (estado JSON com type presente,
//   não valor transitório).
//   Declarado, não provado: acerto do modelo ao classificar prompts novos.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "../lib/config.mjs";

const SKILL_REL = ".agents/skills/prompt-optimizer/SKILL.md";
const TEMPLATE_REL = ".agents/skills/prompt-optimizer/references/picco-template.md";
const FIXTURES_REL = ".agents/skills/prompt-optimizer/fixtures";
const RULES_REL = ".agents/rules/workflow-rules.md";
const STATE_REL = "workflow-state.json";
// Os 2 call sites do V3: o roteador de papéis e a rule do gate (fundida DOC-02).
const CALL_SITES = [".agents/agents/orchestrator/AGENT.md", RULES_REL];

function read(rel) {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

function section0(text) {
  const start = text.indexOf("## 0. Prompt Gate");
  const end = text.indexOf("## 0.1 Divisão de Papéis");
  assert.ok(start >= 0 && end > start, "§0 e §0.1 precisam existir para isolar o call site");
  return text.slice(start, end);
}

function parseFixture(text) {
  const lines = text.split("\n");
  assert.equal(lines[0], "---", "fixture sem frontmatter");
  const end = lines.indexOf("---", 1);
  assert.ok(end > 1, "frontmatter não fechado");
  const meta = {};
  for (const line of lines.slice(1, end)) {
    const m = line.match(/^([a-z_]+):\s*(.+)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  const body = lines.slice(end + 1).join("\n");
  const verdictAt = body.indexOf("## Veredito esperado");
  assert.ok(verdictAt >= 0, "fixture sem seção de veredito esperado");
  const verdict = body.slice(verdictAt);
  const marks = [...verdict.matchAll(/E([1-6])\s*(✅|❌)/g)].map((m) => ({ element: `E${m[1]}`, mark: m[2] }));
  return { meta, prompt: body.slice(0, verdictAt), marks };
}

function fixtures() {
  const dir = join(REPO_ROOT, FIXTURES_REL);
  return readdirSync(dir)
    .filter((name) => /^\d\d-.*\.md$/.test(name))
    .sort()
    .map((name) => ({ name, ...parseFixture(read(`${FIXTURES_REL}/${name}`)) }));
}

function tierHits(rel) {
  return [...read(rel).matchAll(/Tier [123]/g)].length;
}

function constraintsBlocks(text) {
  const out = [];
  for (const m of text.matchAll(/<constraints>([\s\S]*?)<\/constraints>/g)) {
    out.push(m[1].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("<!--")));
  }
  return out;
}

describe("F5-C1 — fixtures do Prompt Gate (10 prompts, veredito esperado)", () => {
  const all = fixtures();

  it("existem exatamente 10 fixtures .md — contagem mutável, não 'pelo menos'", () => {
    assert.equal(all.length, 10, `esperado 10 fixtures, encontrados ${all.length}`);
  });

  it("proporção 7 Rota B / 3 Rota A", () => {
    const count = all.reduce((acc, f) => ({ ...acc, [f.meta.esperado]: (acc[f.meta.esperado] ?? 0) + 1 }), {});
    assert.deepEqual(count, { "rota-a": 3, "rota-b": 7 });
  });

  it("as 3 vagas bloqueiam E1, E2 e E5 (um cada) — as 7 claras não declaram bloqueio", () => {
    const vagas = all.filter((f) => f.meta.esperado === "rota-a");
    assert.deepEqual(vagas.map((f) => f.meta.bloqueio).sort(), ["E1", "E2", "E5"]);
    for (const f of all.filter((x) => x.meta.esperado === "rota-b")) {
      assert.equal(f.meta.bloqueio, undefined, `${f.name}: Rota B não pode declarar bloqueio`);
    }
  });

  it("frontmatter e veredito esperado são coerentes em TODAS as fixtures", () => {
    for (const f of all) {
      assert.ok(["rota-a", "rota-b"].includes(f.meta.esperado), `${f.name}: esperado inválido`);
      assert.ok(f.prompt.trim().length > 40, `${f.name}: prompt vazio demais para ser classificado`);
      assert.equal(f.marks.length, 6, `${f.name}: veredito deve marcar E1..E6`);
      assert.deepEqual(f.marks.map((m) => m.element), ["E1", "E2", "E3", "E4", "E5", "E6"]);
      const missing = f.marks.filter((m) => m.mark === "❌").map((m) => m.element);
      if (f.meta.esperado === "rota-b") {
        assert.deepEqual(missing, [], `${f.name}: Rota B com elemento ausente`);
      } else {
        assert.deepEqual(missing, [f.meta.bloqueio], `${f.name}: bloqueio diverge do veredito`);
      }
    }
  });
});

describe("F5-C2 — SKILL v4: Stage 0, ledger, PICCO e V3/V5/V6", () => {
  const skill = read(SKILL_REL);

  it("marcadores Stage 0, ledger e PICCO presentes no SKILL", () => {
    assert.match(skill, /Stage 0/);
    assert.match(skill, /ledger/i);
    assert.match(skill, /PICCO/);
  });

  it("Stage 0 prescreve brain literal + probe genérico (somente leitura) ANTES de contar E1..E6", () => {
    assert.match(skill, /brain_search/);
    assert.match(skill, /prompt do usuário, literal|prompt literal/);
    assert.match(skill, /Probe do projeto \(somente leitura\)/);
    for (const token of ["instruções", "manifests", "documentação", "regras", "nomes de diretório", "existem de fato"]) {
      assert.ok(skill.includes(token), `probe genérico não cita ${token}`);
    }
    assert.match(skill, /Não presuma[\s\S]{0,80}?arquivo específico/);
    for (const literal of ["AGENTS.md", "harness.config.json", "targets"]) {
      assert.ok(!skill.includes(literal), `SKILL v4 é portátil: não pode fixar ${literal}`);
    }
    assert.ok(skill.indexOf("Stage 0") < skill.indexOf("Os 6 elementos"), "Stage 0 vem antes do score");
  });

  it("ledger da conversa registra premissa pendente com texto/elemento/origem (append-only, sem arquivo)", () => {
    assert.match(skill, /ledger da conversa/);
    for (const token of ["Premissas pendentes", "<texto da premissa>", "<trecho do prompt>"]) {
      assert.ok(skill.includes(token), `ledger não declara ${token}`);
    }
    assert.match(skill, /\(E[1-6], inferida de/);
    assert.match(skill, /append-only/);
    assert.match(skill, /não exige arquivo/);
    assert.match(skill, /\*\*não\*\*[\s\S]{0,80}?entra no PICCO/);
    assert.match(skill, /premissa não confirmada/i);
  });

  it("PICCO exige <context> citado (arquivo:linha ou brain path) e <acceptance> executável", () => {
    const contract = skill + read(".agents/skills/prompt-optimizer/assets/picco.md");
    for (const tag of ["<role>", "<task>", "<context>", "<constraints>", "<acceptance>", "<open_questions>"]) {
      assert.ok(contract.includes(tag), `tag ausente: ${tag}`);
    }
    assert.match(contract, /arquivo:linha/);
    assert.match(contract, /brain path/);
    assert.match(contract, /executável/);
  });

  it("contrato do bloco: ≤10 constraints, role=critério, positivas primeiro, sem CoT", () => {
    assert.match(skill, /10 constraints|≤ 10/i);
    assert.match(skill, /critério, não persona|critério de comportamento/i);
    assert.match(skill, /[Pp]ositivas primeiro/);
    const cotLines = skill.split("\n").filter((l) => /pense passo a passo/i.test(l));
    assert.ok(cotLines.length > 0, "SKILL deve proibir explicitamente o CoT escrito");
    for (const line of cotLines) {
      assert.match(line, /nunca|proib|sem |zero/i, `linha não é proibição: ${line}`);
    }
  });

  it("V3: o próprio SKILL não reintroduz Tier 1/2/3", () => {
    assert.equal(tierHits(SKILL_REL), 0);
  });

  it("V5: nenhum exemplo em picco-template.md passa de 10 constraints", () => {
    const blocks = constraintsBlocks(read(TEMPLATE_REL));
    assert.ok(blocks.length >= 2, "picco-template.md perdeu os exemplos com constraints");
    for (const [i, block] of blocks.entries()) {
      assert.ok(block.length <= 10, `exemplo ${i + 1}: ${block.length} constraints (>10)`);
    }
  });

  it("V6: workflow-state.json é JSON válido com type presente (não valor transitório)", () => {
    const state = JSON.parse(read(STATE_REL));
    assert.ok(typeof state.type === "string" && state.type.length > 0, "type presente, não valor transitório");
  });

  it("limite de tamanho: SKILL.md tem no máximo 140 linhas", () => {
    const lines = skill.replace(/\n$/, "").split("\n").length;
    assert.ok(lines <= 140, `SKILL.md tem ${lines} linhas`);
  });
});

describe("F5-C3 — call site: workflow-rules.md §0 cita a skill e o ledger", () => {
  const s0 = section0(read(RULES_REL));

  it("§0 cita prompt-optimizer, a skill e o ledger de premissas", () => {
    assert.match(s0, /prompt-optimizer/);
    assert.match(s0, /\.agents\/skills\/prompt-optimizer\/SKILL\.md/);
    assert.match(s0, /prompt_assumptions/);
    assert.match(s0, /ledger/i);
  });

  it("§0 coloca o Stage 0 antes da contagem de E1..E6", () => {
    const stage = s0.indexOf("Stage 0");
    const score = s0.indexOf("Contar os 6 elementos");
    assert.ok(stage >= 0 && score > stage, "Stage 0 precisa preceder a contagem");
  });

  it("§0 proíbe escrever premissa não confirmada como fato", () => {
    assert.match(s0, /nunca escrever premissa não confirmada como fato/i);
  });

  it("V3: zero 'Tier 1|Tier 2|Tier 3' nos 2 call sites (contagem por arquivo)", () => {
    const hits = CALL_SITES.map((rel) => ({ rel, n: tierHits(rel) }));
    assert.deepEqual(hits.map((h) => h.n), [0, 0], JSON.stringify(hits));
  });

  it("V4: prompt-optimizer aparece em workflow-rules.md (≥1)", () => {
    const n = [...read(RULES_REL).matchAll(/prompt-optimizer/g)].length;
    assert.ok(n >= 1, `V4: ${n} ocorrências`);
  });
});
