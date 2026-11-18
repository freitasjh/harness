// state-compact.spec.mjs — contrato de `scripts/state-compact.mjs` (compactação
// de workflow-state.json para o estado vivo que o runtime lê).
//
// Defeitos que esta spec fecha:
//   C1 — remover chave que gate.js/SDD/PAP-12 lê (whitelist incompleta);
//   C2 — perder histórico (valor arquivado não recuperável do jsonl por chave);
//   C3 — não-idempotência (2ª execução duplica linha no jsonl);
//   C4 — executar no estado real e estourar o teto de 20.480 bytes;
//   C5 — PAP-12 sem created_at em follow_ups (controle de positivo).
//
// Todo fixture vive em tempScope; o estado real é SOMENTE LIDO (o script já foi
// executado nele antes desta suite rodar em CI).
import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tempScope } from "../test-temp.mjs";
import {
  LIVE_KEYS,
  SIZE_LIMIT,
  hashValue,
  selectFollowUps,
  compactState,
  readHistory,
  serializeState,
  parseArgs,
} from "../state-compact.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "state-compact.mjs");
const REAL_STATE = join(REPO_ROOT, "workflow-state.json");

const TMP = tempScope({ label: "state-compact" });
afterEach(() => TMP.cleanup());
after(() => TMP.cleanup());

function run(args) {
  const res = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  const diagnostics = res.error ? `\nspawn: ${res.error.message}` : "";
  return { code: res.status, out: `${res.stdout ?? ""}${res.stderr ?? ""}${diagnostics}` };
}

function fixtureState() {
  const state = {};
  for (const key of LIVE_KEYS) state[key] = { chave: key };
  state.current_feature = "fixture";
  state.current_phase = "Execution";
  state.gates = { P1_P2: "approved", P2_P3: "approved" };
  state.prd_adr = { snapshots: [] };
  state.features = [{ id: "F1" }];
  state.harness_status = "passed";
  state.code_review_status = "passed";
  state.follow_ups = [
    { id: "FU-1", status: "open", created_at: "2026-01-01T00:00:00Z", texto: "aberta" },
    { id: "FU-2", status: "closed", created_at: "2026-01-02T00:00:00Z", texto: "fechada" },
    { id: "FU-3", status: "pending", created_at: "2026-01-03T00:00:00Z", texto: "pendente" },
    { id: "FU-4", status: "closed_reviewed", created_at: "2026-01-04T00:00:00Z", texto: "revisada" },
    { id: "FU-5", created_at: "2026-01-05T00:00:00Z", texto: "sem status" },
  ];
  state.follow_ups_created_at_basis = "PAP-12";
  state.last_update = "2020-01-01T00:00:00.000Z";
  state.legacy_blob = "x".repeat(30_000);
  state.legacy_meta = { a: 1, b: [1, 2, 3] };
  return state;
}

function setup() {
  const dir = TMP.tmp();
  const statePath = join(dir, "workflow-state.json");
  const historyPath = join(dir, "workflow-history.jsonl");
  writeFileSync(statePath, serializeState(fixtureState()));
  return { statePath, historyPath };
}

function historyMap(historyPath) {
  const map = new Map();
  for (const line of readFileSync(historyPath, "utf8").split("\n").filter(Boolean)) {
    const entry = JSON.parse(line);
    map.set(entry.key, entry.value);
  }
  return map;
}

function countLines(historyPath) {
  return existsSync(historyPath)
    ? readFileSync(historyPath, "utf8").split("\n").filter(Boolean).length
    : 0;
}

describe("state-compact — whitelist e pure helpers", () => {
  it("LIVE_KEYS cobre TODA chave lida por gate.js / SDD / PAP-12", () => {
    const consumed = [
      "current_phase",
      "harness_status",
      "code_review_status",
      "current_feature",
      "artifacts",
      "features",
      "gates",
      "prd_adr",
      "follow_ups",
      "overrides",
      "overrides_history",
      "superseded_cycles",
    ];
    for (const key of consumed) {
      assert.ok(LIVE_KEYS.includes(key), `whitelist perdeu chave lida pelo runtime: ${key}`);
    }
  });

  it("hashValue é estável e distingue valores diferentes", () => {
    assert.equal(hashValue({ a: 1, b: [2] }), hashValue({ a: 1, b: [2] }));
    assert.notEqual(hashValue({ a: 1 }), hashValue({ a: 2 }));
  });

  it("selectFollowUps mantém open/pending; fallback = mais recente por created_at", () => {
    const list = fixtureState().follow_ups;
    const picked = selectFollowUps(list);
    assert.deepEqual(
      picked.keep.map((f) => f.id),
      ["FU-1", "FU-3"],
    );
    assert.equal(picked.archived.length, 3);

    const onlyClosed = list.filter((f) => f.status && f.status.startsWith("closed"));
    const fallback = selectFollowUps(onlyClosed);
    assert.deepEqual(
      fallback.keep.map((f) => f.id),
      ["FU-4"],
      "sem open/pending ⇒ mantém o mais recente",
    );

    const one = selectFollowUps(fallback.keep);
    assert.equal(one.archived.length, 0, "2ª passagem não tem nada novo para arquivar");
  });

  it("FLOW-06: item open/pending SEM created_at é arquivado, nunca fica vivo", () => {
    const noDate = { id: "F-SEM-DATA", status: "open", texto: "aberta sem data" };
    const withDate = {
      id: "F-COM-DATA",
      status: "open",
      created_at: "2026-06-01T00:00:00Z",
      texto: "aberta com data",
    };
    const picked = selectFollowUps([noDate, withDate]);
    assert.deepEqual(picked.keep, [withDate], "só sobrevive quem tem created_at string");
    assert.ok(picked.archived.includes(noDate), "open sem created_at ⇒ arquivado");

    const onlyNoDate = selectFollowUps([noDate]);
    assert.deepEqual(onlyNoDate.keep, [], "sem nenhum created_at, nada fica vivo");
    assert.deepEqual(onlyNoDate.archived, [noDate]);

    const pendingNoDate = { id: "F-PEND", status: "pending" };
    assert.deepEqual(selectFollowUps([pendingNoDate]).keep, [], "pending sem data também arquiva");
  });

  it("compactState preserva chaves vivas (valor intacto) e sinaliza as arquivadas", () => {
    const before = fixtureState();
    const { state, entries, archivedKeys } = compactState(before, { now: () => "TS" });
    for (const key of LIVE_KEYS) {
      if (key === "follow_ups" || key === "last_update") continue;
      assert.deepEqual(state[key], before[key], `chave viva alterada: ${key}`);
    }
    assert.notEqual(state.last_update, before.last_update, "last_update é novo");
    assert.ok(archivedKeys.includes("legacy_blob"));
    assert.ok(archivedKeys.includes("legacy_meta"));
    assert.ok(archivedKeys.includes("follow_ups:archived"));
    assert.equal(entries.length, archivedKeys.length);
    assert.deepEqual(Object.keys(state), LIVE_KEYS, "ordem das chaves = whitelist");
  });
});

describe("state-compact — CLI e histórico", () => {
  it("compacta e arquiva; cada chave fora da whitelist é recuperável do jsonl", () => {
    const { statePath, historyPath } = setup();
    const before = JSON.parse(readFileSync(statePath, "utf8"));
    const res = run(["--state", statePath, "--history", historyPath]);
    assert.equal(res.code, 0, res.out);

    const after = JSON.parse(readFileSync(statePath, "utf8"));
    assert.deepEqual(Object.keys(after), LIVE_KEYS);
    assert.ok(statSync(statePath).size <= SIZE_LIMIT, "estado compactado ≤ limite");

    const hist = historyMap(historyPath);
    for (const key of Object.keys(before).filter((k) => !LIVE_KEYS.includes(k))) {
      assert.ok(hist.has(key), `chave ${key} não foi arquivada`);
      assert.deepEqual(hist.get(key), before[key], `valor arquivado divergiu: ${key}`);
    }
    assert.equal(hist.has("follow_ups:archived"), true);
    assert.deepEqual(
      hist.get("follow_ups:archived"),
      before.follow_ups,
      "array COMPLETO de follow_ups arquivado — nada perdido",
    );
  });

  it("follow_ups vivos têm ≥1 created_at e só open/pending", () => {
    const { statePath, historyPath } = setup();
    assert.equal(run(["--state", statePath, "--history", historyPath]).code, 0);
    const after = JSON.parse(readFileSync(statePath, "utf8"));
    assert.ok(after.follow_ups.length >= 1);
    assert.ok(after.follow_ups.every((f) => typeof f.created_at === "string"), "PAP-12");
    assert.ok(after.follow_ups.every((f) => f.status === "open" || f.status === "pending"));
  });

  it("2ª execução não acrescenta linha ao jsonl (idempotência por hash)", () => {
    const { statePath, historyPath } = setup();
    assert.equal(run(["--state", statePath, "--history", historyPath]).code, 0);
    const first = countLines(historyPath);
    assert.ok(first > 0, "1ª execução arquivou algo");
    const res = run(["--state", statePath, "--history", historyPath]);
    assert.equal(res.code, 0, res.out);
    assert.equal(countLines(historyPath), first, "2ª execução = zero linhas novas");
    assert.match(res.out, /novas=0/);
  });

  it("--dry-run imprime contagem/bytes e não escreve nada", () => {
    const { statePath, historyPath } = setup();
    const bytes = statSync(statePath).size;
    const res = run(["--state", statePath, "--history", historyPath, "--dry-run"]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /arquivar=3/);
    assert.match(res.out, /bytes/);
    assert.equal(existsSync(historyPath), false, "dry-run não cria o jsonl");
    assert.equal(statSync(statePath).size, bytes, "dry-run não altera o estado");
  });

  it("mutação: remover chave viva da whitelist ⇒ ela é arquivada; restaurar ⇒ passa", () => {
    const before = fixtureState();
    const reduced = LIVE_KEYS.filter((k) => k !== "current_phase");
    const broken = compactState(before, { liveKeys: reduced, now: () => "TS" });
    assert.ok(broken.archivedKeys.includes("current_phase"), "sem a chave na whitelist, ela sai");
    assert.equal(broken.state.current_phase, undefined);

    const fixed = compactState(before, { liveKeys: LIVE_KEYS, now: () => "TS" });
    assert.deepEqual(fixed.state.current_phase, before.current_phase, "restaurada ⇒ intacta");
  });

  it("readHistory tolera arquivo ausente", () => {
    assert.deepEqual(readHistory(join(TMP.tmp(), "inexistente.jsonl")), []);
  });

  it("parseArgs sem flags resolve para a raiz do repo (não para o pai)", () => {
    const opts = parseArgs([]);
    assert.equal(opts.statePath, join(REPO_ROOT, "workflow-state.json"));
    assert.equal(opts.historyPath, join(REPO_ROOT, "workflow-history.jsonl"));
    assert.equal(opts.dryRun, false);
  });
});

describe("state-compact — estado real do repo", () => {
  it(`workflow-state.json do repo ≤ ${SIZE_LIMIT} bytes após a compactação`, () => {
    const bytes = statSync(REAL_STATE).size;
    assert.ok(bytes <= SIZE_LIMIT, `estado real com ${bytes} bytes > ${SIZE_LIMIT}`);
  });

  it("estado real conserva as chaves que o runtime lê", () => {
    const state = JSON.parse(readFileSync(REAL_STATE, "utf8"));
    for (const key of ["current_feature", "current_phase", "harness_status", "code_review_status", "gates", "prd_adr", "follow_ups"]) {
      assert.ok(key in state, `estado real perdeu ${key}`);
    }
    assert.ok(state.follow_ups.length > 0, "controle PAP-12 no estado real");
    assert.ok(state.follow_ups.every((f) => typeof f.created_at === "string"));
  });
});
