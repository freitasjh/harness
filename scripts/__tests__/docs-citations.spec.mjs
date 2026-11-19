// docs-citations.spec.mjs — guarda da classe "citação por linha em doc".
//
// Defeito que esta guarda fecha (F3a review #3, MF-2): `docs/FUNCIONAMENTO.md`
// citava a evidência de cada afirmação como `arquivo.ext:NNN`. Número de linha
// apodrece no primeiro diff do arquivo citado; o doc passa a apontar para o
// lugar errado sem que nada falhe. A forma estável é o SÍMBOLO (`evaluateSdd02`,
// `runPrdChecks`, `resolveAdrUnit`) ou a SEÇÃO da rule (`§5 H6`,
// `gate-contract.md` I2).
//
// O que a guarda barra: citação por linha de arquivo
// (`.mjs|.js|.ts|.tsx|.vue|.json|.sh|.md|.yml|.yaml`) dentro de `docs/**`. O que
// ela permite: `§N`, rótulos de gate (I2, RF-01), nome de arquivo sem linha, e
// qualquer URL (`https?://…` é removida antes da varredura — `http://localhost:8080`
// e `https://…/x.mjs:1` não são citações de linha do repo).
//
// Citar seção (`workflow.md §2.4`) ou símbolo continua sendo a forma prescrita:
// só `arquivo.ext:NNN` é citação por linha, qualquer que seja a extensão.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tempScope } from "../test-temp.mjs";

const DOCS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs");

// Arquivo seguido de número de linha: a classe proibida. Exige o separador `:`
// imediatamente após a extensão, então `foo.mjs` (sem linha), `harness.config.json`
// (sem linha) e `§5` passam. `md|ya?ml` cobre as 104 citações que o doc usava;
// `:1-10` casa o `:1` inicial.
const LINE_CITATION_RE = /\b[A-Za-z0-9_][\w./-]*\.(?:mjs|js|ts|tsx|vue|json|sh|md|ya?ml):\d+/g;
const URL_RE = /https?:\/\/\S+/g;

function listMarkdown(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...listMarkdown(abs));
    else if (entry.endsWith(".md")) out.push(abs);
  }
  return out.sort();
}

/**
 * Varre `<root>/**\/*.md` e devolve cada citação por linha encontrada.
 * `root` é injetável para a fixture; a produção usa `docs/`.
 *
 * @returns {{ file: string, line: number, text: string, snippet: string }[]}
 */
export function findLineCitations(root = DOCS_ROOT) {
  const violations = [];
  for (const file of listMarkdown(root)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((raw, index) => {
      const scanned = raw.replace(URL_RE, " ");
      for (const match of scanned.matchAll(LINE_CITATION_RE)) {
        violations.push({
          file: relative(root, file) || file,
          line: index + 1,
          text: match[0],
          snippet: raw.trim(),
        });
      }
    });
  }
  return violations;
}

function formatViolations(violations) {
  return violations.map((v) => `${v.file}:${v.line} → "${v.text}" em: ${v.snippet}`).join("\n  ");
}

describe("docs/** sem citação por linha de arquivo técnico", () => {
  it("o repo real não tem nenhuma citação `arquivo.ext:NNN` em docs/", () => {
    const violations = findLineCitations();
    assert.deepEqual(
      violations,
      [],
      `citação por linha apodrece no próximo diff — cite o símbolo ou a seção:\n  ${formatViolations(violations)}`,
    );
  });

  it("fixture com `foo.mjs:123` reprova e nomeia arquivo, linha e trecho", () => {
    const scope = tempScope({ label: "docs-citations-negative" });
    try {
      const root = scope.tmp({
        "doc.md": "# Doc\n\nO gate nega (`gate.js:123`) antes do loop.\n",
      });
      const violations = findLineCitations(root);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].file, "doc.md");
      assert.equal(violations[0].line, 3);
      assert.equal(violations[0].text, "gate.js:123");
      assert.match(violations[0].snippet, /gate\.js:123/);
    } finally {
      scope.cleanup();
    }
  });

  it("todas as extensões técnicas da classe são barradas", () => {
    const scope = tempScope({ label: "docs-citations-ext" });
    try {
      const root = scope.tmp({
        "sub/deep.md": [
          "a.mjs:1",
          "b.js:2",
          "c.ts:3",
          "d.tsx:4",
          "e.vue:5",
          "f.json:6",
          "g.sh:7",
        ].join("\n"),
      });
      assert.equal(findLineCitations(root).length, 7);
    } finally {
      scope.cleanup();
    }
  });

  it("citações `.md`/`.yml` são barradas, inclusive intervalo `:N-M`", () => {
    const scope = tempScope({ label: "docs-citations-md-yml" });
    try {
      const root = scope.tmp({
        "doc.md": [
          "A âncora B lê `code_review_status` (`gate-contract.md:35`).",
          "Intervalo: `doc.md:1-10`.",
          "CI: `harness-integrity.yml:23-32`.",
          "Build: `ci.yml:3`.",
        ].join("\n"),
      });
      const violations = findLineCitations(root);
      assert.deepEqual(
        violations.map((v) => v.text),
        ["gate-contract.md:35", "doc.md:1", "harness-integrity.yml:23", "ci.yml:3"],
      );
    } finally {
      scope.cleanup();
    }
  });

  it("citação estável passa: símbolo, §N, rótulo de gate, arquivo sem linha, URL", () => {
    const scope = tempScope({ label: "docs-citations-positive" });
    try {
      const root = scope.tmp({
        "ok.md": [
          "`evaluateSdd02` nega (`scripts/sdd-checks.mjs`).",
          "O portão está em `workflow-rules.md` §5 H6 e em `gate-contract.md` I2.",
          "RF-01/RF-02 vêm do config; V21 mede o roster.",
          "Ver https://exemplo.test/x.mjs:9, https://exemplo.test/doc.md:9 e http://localhost:8080/health.",
          "Cite `harness.config.json` (chave `protectedPaths`), nunca a linha.",
        ].join("\n"),
      });
      assert.deepEqual(findLineCitations(root), []);
    } finally {
      scope.cleanup();
    }
  });

  it("varre subdiretórios e ignora arquivos que não são .md", () => {
    const scope = tempScope({ label: "docs-citations-walk" });
    try {
      const root = scope.tmp({
        "a/b/c.md": "x.json:10",
        "a/notes.txt": "y.json:10",
      });
      const violations = findLineCitations(root);
      assert.equal(violations.length, 1);
      assert.equal(violations[0].file, join("a/b/c.md"));
    } finally {
      scope.cleanup();
    }
  });
});
