// commands.spec.mjs — contrato dos comandos do operador (v2/F2, CMD-01..03).
//
// A camada `.opencode/commands/` é payload (PAYLOAD_DIRS em
// `scripts/harness-sync.mjs`), logo o comando que o operador invoca no destino é
// o MESMO arquivo daqui. O contrato que estes testes seguram:
//   - cada comando tem frontmatter `description` e corpo com `$ARGUMENTS`;
//   - o corpo mostra o plano (`--dry-run`) e pede confirmação antes de aplicar
//     (init/update) — comando que executa sem plano é o defeito que F2 fecha;
//   - o `doctor` diz que não escreve nada;
//   - nenhum comando pergunta "qual é a stack": o vocabulário de perfil/eixo e o
//     `installer/` do v1 ficam fora;
//   - ≤ 40 linhas: comando curto é comando lido.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(REPO_ROOT, ".opencode", "commands");
const COMMANDS = [
  "harness-init.md", "harness-update.md", "harness-doctor.md",
  "ui-bootstrap.md", "ui-audit.md", "ui-review.md",
];
const UI_COMMANDS = ["ui-bootstrap.md", "ui-audit.md", "ui-review.md"];

function read(name) {
  return readFileSync(join(DIR, name), "utf8");
}

function body(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n/, "");
}

// Índices das chamadas REAIS do verbo no texto (`<verbo> --target <dir>` + resto
// da linha). O plano é a chamada que carrega `--dry-run`; o apply é a que não
// carrega. Ordem é contrato: plano → confirmação → apply.
function commandCalls(text, verb) {
  return [...text.matchAll(new RegExp(`${verb} --target <dir>([^\\n]*)`, "g"))].map((match) => ({
    index: match.index,
    rest: match[1],
  }));
}

function assertPlanThenApply(text, verb) {
  const calls = commandCalls(text, verb);
  assert.ok(calls.length >= 2, `${verb}: o comando precisa mostrar o plano E aplicar`);
  assert.match(calls[0].rest, /--dry-run/, `${verb}: o PRIMEIRO comando é o plano`);
  const applies = calls.slice(1);
  for (const call of applies) {
    assert.doesNotMatch(call.rest, /--dry-run/, `${verb}: o apply não é dry-run`);
  }
  const confirm = text.search(/confirmação explícita/);
  assert.ok(confirm >= 0, `${verb}: o comando pede confirmação explícita`);
  assert.ok(
    confirm < applies[0].index,
    `${verb}: a confirmação vem ANTES do comando que aplica (índices ${confirm} < ${applies[0].index})`,
  );
}

describe("CMD-01/02/03 — comandos do operador", () => {
  it("a camada publica exatamente os seis comandos (3 harness + 3 ui)", () => {
    assert.deepEqual(readdirSync(DIR).sort(), [...COMMANDS].sort());
  });

  for (const name of COMMANDS) {
    it(`${name}: frontmatter description + $ARGUMENTS no corpo`, () => {
      const text = read(name);
      assert.match(text, /^---\ndescription: .+\n---\n/, "frontmatter com description");
      assert.match(body(text), /\$ARGUMENTS/, "o alvo vem de $ARGUMENTS");
    });

    it(`${name}: ≤ 40 linhas`, () => {
      assert.ok(text_line_count(read(name)) <= 40, `${name}: ${text_line_count(read(name))} linhas`);
    });

    it(`${name}: sem vocabulário de stack/perfil/eixo/wizard/installer`, () => {
      assert.doesNotMatch(read(name), /\bstack\b|\bperfil\b|\beixo\b|\bwizard\b|installer\//i);
    });
  }

  it("harness-init: recusa alvo com estado, mostra plano, confirma e valida", () => {
    const text = read("harness-init.md");
    assert.match(text, /init --target <dir> --dry-run/, "o plano vem antes de qualquer escrita");
    assert.match(text, /harness-update/, "alvo com estado do harness é mandado para o update");
    assert.match(text, /\.opencode\/commands\//, "o marcador de estado inclui a camada de comandos");
    assert.match(text, /confirmação explícita/, "nada é aplicado sem confirmação");
    assert.match(text, /doctor --target <dir>/, "fecha com doctor");
    assertPlanThenApply(text, "init");
    assert.match(text, /--suite "<cmd>"/, "o comando dá canal para a flag que o CLI exige");
  });

  it("harness-update: anuncia backup fora do alvo, mostra plano, confirma e valida", () => {
    const text = read("harness-update.md");
    assert.match(text, /\.harness-backup\/<nome-do-alvo>-<timestamp>\//, "backup nomeado e fora do alvo");
    assert.match(text, /update --target <dir> --dry-run/, "o plano vem antes de qualquer escrita");
    assert.match(text, /confirmação explícita/, "nada é aplicado sem confirmação");
    assert.match(text, /orphan/, "órfão é reportado, nunca apagado");
    assert.match(text, /doctor --target <dir>/, "fecha com doctor");
    assertPlanThenApply(text, "update");
    assert.match(text, /--backup-dir <dir>/, "o comando dá canal para o diretório de backup");
  });

  it("harness-doctor: somente leitura, exit code e FAIL por path", () => {
    const text = read("harness-doctor.md");
    assert.match(text, /doctor --target <dir>/);
    assert.match(text, /exit code/);
    assert.match(text, /FAIL <o quê>: <path>/);
    assert.match(text, /Nada é escrito/, "o comando declara que não escreve");
  });
});

describe("UI-01..03 — comandos de UI (F6a)", () => {
  for (const name of UI_COMMANDS) {
    it(`${name}: frontmatter, $ARGUMENTS, ≤ 40 linhas e sem vocabulário proibido`, () => {
      const text = read(name);
      assert.match(text, /^---\ndescription: .+\n---\n/);
      assert.match(body(text), /\$ARGUMENTS/);
      assert.ok(text_line_count(text) <= 40, `${name}: ${text_line_count(text)} linhas`);
      assert.doesNotMatch(text, /\bstack\b|\bperfil\b|\beixo\b|\bwizard\b|installer\//i);
    });
  }

  it("ui-bootstrap: detecta, mostra plano, pede confirmação e só depois aplica", () => {
    const text = read("ui-bootstrap.md");
    assert.match(text, /package\.json/, "detecta em vez de perguntar");
    assertPlanThenApply(text, "init.mjs");
    assert.match(text, /build-tokens\.mjs --target <dir>/);
    assert.match(text, /validate\.mjs --target <dir>/);
  });

  it("ui-audit e ui-review: somente leitura", () => {
    assert.match(read("ui-audit.md"), /não edita nada/i);
    assert.match(read("ui-review.md"), /Nada é editado/i);
    assert.match(read("ui-audit.md"), /arquivo:linha|CAMINHO:LINHA/);
    assert.match(read("ui-review.md"), /1280×800|1280px/);
  });
});

function text_line_count(text) {
  return text.split("\n").filter((line, index, all) => !(index === all.length - 1 && line === "")).length;
}
