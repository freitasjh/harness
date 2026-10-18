#!/usr/bin/env node
// vendor-skills.mjs — source-side, offline vendor of third-party skills.
//
// ADR-009 / RF-13 / I9. Vendoriza skills byte-identicas ao lock de origem,
// grava `.agents/skills/.vendor-lock.json` (procedencia + hashes) e
// `.agents/skills/VENDOR-NOTICE.md` (source+commit+SPDX+excluidas).
//
// ADR-003: a PROCEDENCIA da licenca e declarada por fonte (`licenseOrigin`):
// `upstream-file` (sha do arquivo de licenca real do upstream) ou
// `declared-evidence` (licenca declarada por evidencia citada; sha do NOSSO
// texto transcrito). O NOTICE declara a origem por fonte e NAO afirma
// byte-identidade universal ao upstream.
//
// Politica P-02=(i): skill sem licenca identificavel NAO e vendorizada
// (fail-closed). `--check` recomputa o treeHash e FALHA em divergencia ou
// symlink. O caminho de instalacao (`installer/install.mjs`) permanece
// rede-zero (V15); este script e o unico ponto source-side.
//
//   node scripts/vendor-skills.mjs --source <dir> --lock <skills-lock.json> \
//     [--dest <dir>] [--source-commit <src>=<sha>] [--source-license <src>=<spdx>]
//   node scripts/vendor-skills.mjs --check [--dest <dir>]
//
// Build (RF-13): clonar cada fonte no commit pinado, expor cada skill como
// `<source-dir>/<nome-da-skill>` e passar `--lock scripts/vendor/skills-lock.json`
// (o source-lock de ENTRADA commitado) + um `--source-commit <src>=<sha>` por
// fonte. O `--check` roda no CI sem rede nem clones.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const VENDOR_LOCK_NAME = ".vendor-lock.json";
export const VENDOR_NOTICE_NAME = "VENDOR-NOTICE.md";
export const VENDOR_LOCK_VERSION = "1";
export const POLICY = "P-02=(i)";
// Source-lock de ENTRADA, commitado como evidencia de build (RF-13): declara,
// por skill, `source`/`sourceType`/`skillPath`/`computedHash` + `stacks`
// (RF-03/A1), `optional` e `runtimeDeps` (RF-09). O `--check` NAO depende dele
// (nem de clones/rede): a evidencia do CI e o `.vendor-lock.json` de saida.
export const SOURCE_LOCK_PATH = "scripts/vendor/skills-lock.json";

// Allowlist SPDX (P-02=(i), fail-closed): so licencas identificaveis e
// permissivas passam. `UNLICENSED`/`PROPRIETARY`/desconhecido NAO passam —
// a skill e excluida. Fonte: SPDX License List.
export const SPDX_ALLOWLIST = new Set([
  "0BSD",
  "MIT",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "MPL-2.0",
  "Unlicense",
  "CC0-1.0",
]);

export function isAllowedSpdx(spdx) {
  return typeof spdx === "string" && SPDX_ALLOWLIST.has(spdx.trim());
}

// Texto COMPLETO + copyright da licenca da fonte upstream, transcrito do
// LICENSE do repositorio no commit pinado (source+commit no lock). Estes
// textos sao DERIVADOS (nunca retidos no dir da skill) e gravados pelo vendor
// como arquivo agregado `LICENSE-<source-slug>` na raiz do dest (P-02, RF-13).
// dart-lang/skills @ 0d9f1c4a / flutter/skills @ 0ef3972f: BSD-3-Clause.
const BSD3_DART = `Copyright 2012, the Dart project authors.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software without
   specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;

const BSD3_FLUTTER = `Copyright 2026 The Flutter Authors. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software without
   specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;

// Texto COMPLETO do LICENSE do repo upstream stitch (Apache-2.0), copiado
// byte-a-byte do arquivo real no commit pinado (11.273 bytes, COM newline
// final). O `sha256` congela os bytes: `--check` recomputa e falha em drift.
const APACHE2_STITCH = `                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or Derivative
      Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
      stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
      that You distribute, all copyright, patent, trademark, and
      attribution notices from the Source form of the Work,
      excluding those notices that do not pertain to any part of
      the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
      distribution, then any Derivative Works that You distribute must
      include a readable copy of the attribution notices contained
      within such NOTICE file, excluding those notices that do not
      pertain to any part of the Derivative Works, in at least one
      of the following places: within a NOTICE text file distributed
      as part of the Derivative Works; within the Source form or
      documentation, if provided along with the Derivative Works; or,
      within a display generated by the Derivative Works, if and
      wherever such third-party notices normally appear. The contents
      of the NOTICE file are for informational purposes only and
      do not modify the License. You may add Your own attribution
      notices within Derivative Works that You distribute, alongside
      or as an addendum to the NOTICE text from the Work, provided
      that such additional attribution notices cannot be construed
      as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright [yyyy] [name of copyright owner]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
`;

// Texto MIT transcrito por NOS (a fonte vercel NAO tem arquivo LICENSE): o
// sha congela o NOSSO texto (origem `declared-evidence`). O holder e atribuido
// a partir do que o upstream declara (`metadata.author: vercel` no SKILL.md,
// `organization: Vercel Engineering` no metadata.json, repo `vercel-labs`) —
// a ATRIBUICAO do holder e 🟡 processo, declarada na evidencia e no NOTICE.
const MIT_VERCEL = `MIT License

Copyright (c) Vercel, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

// `licenseText` e transcrito byte-a-byte do LICENSE upstream (o `sha256`
// congela os bytes e permite ao `--check` validar o arquivo agregado escrito
// na raiz do dest contra a fonte). Sem newline final: o upstream nao o tem.
//
// `licenseOrigin` (ADR-003) declara a PROCEDENCIA da licenca por fonte:
//   - `upstream-file`    — existe arquivo de licenca no repo upstream; o sha e
//                          o do ARQUIVO real no commit pinado (verificavel).
//   - `declared-evidence` — o upstream NAO tem arquivo de licenca; a licenca e
//                          declarada por evidencia citada (`evidence[]`) e o
//                          sha congela o NOSSO texto transcrito.
// `licenseFile` (opcional) declara o nome do arquivo agregado; sem ele o nome
// e derivado do slug (comportamento historico: `LICENSE-<slug>`).
export const SOURCE_LICENSES = {
  "dart-lang/skills": {
    spdx: "BSD-3-Clause",
    licenseOrigin: "upstream-file",
    licenseText: BSD3_DART,
    sha256: "835b0ffef5681b070c8d9c6c7d67cdd018441a7ae65b1ebd772dbdd2bd40f097",
  },
  "flutter/skills": {
    spdx: "BSD-3-Clause",
    licenseOrigin: "upstream-file",
    licenseText: BSD3_FLUTTER,
    sha256: "5b95696b504e162bcf775060ec416005df9969a95cda6f7d4ddb57327dd74d35",
  },
  // stitch: LICENSE na raiz do repo upstream (sem NOTICE) no commit pinado.
  "google-labs-code/stitch-skills": {
    spdx: "Apache-2.0",
    licenseOrigin: "upstream-file",
    licenseFile: "LICENSE-stitch-skills",
    licenseText: APACHE2_STITCH,
    sha256: "b4133a55232c0996713349891dc55469d46a16ec027c033c9e4108b2149abb42",
  },
  // vercel: sem arquivo LICENSE no upstream; MIT declarado no frontmatter do
  // SKILL.md, no README (§License) e no package.json — evidencia citada.
  "vercel-labs/agent-skills": {
    spdx: "MIT",
    licenseOrigin: "declared-evidence",
    licenseFile: "LICENSE-vercel-agent-skills",
    licenseText: MIT_VERCEL,
    sha256: "1cc9611d4fffbd0201696a5a81cc0b1d82743db847654ff4fa57d92ba7669387",
    evidence: [
      {
        url: "https://github.com/vercel-labs/agent-skills/blob/063bee94c3f4df8453406c830b0a7df0f2860278/skills/react-best-practices/SKILL.md",
        section: "frontmatter: license: MIT (metadata.author: vercel)",
        commit: "063bee94c3f4df8453406c830b0a7df0f2860278",
      },
      {
        url: "https://github.com/vercel-labs/agent-skills/blob/063bee94c3f4df8453406c830b0a7df0f2860278/README.md",
        section: "## License -> MIT",
        commit: "063bee94c3f4df8453406c830b0a7df0f2860278",
      },
      {
        url: "https://github.com/vercel-labs/agent-skills/blob/063bee94c3f4df8453406c830b0a7df0f2860278/packages/react-best-practices-build/package.json",
        section: '"license": "MIT"',
        commit: "063bee94c3f4df8453406c830b0a7df0f2860278",
        note: "holder 'Vercel, Inc.' atribuido do author/organization declarados upstream (🟡 processo)",
      },
    ],
  },
};

// Nome do arquivo agregado escrito pelo vendor para a licenca de uma fonte
// (o LICENSE vive no repo upstream, nao no dir da skill). Nunca e escrito
// dentro de `.agents/skills/<name>/` — logo nao afeta o treeHash (I9).
// O `licenseFile` DECLARADO na tabela vence (ADR-003: nomes por fonte, ex.
// `LICENSE-stitch-skills`); sem declaracao, deriva do slug (historico:
// `dart-lang/skills` -> `LICENSE-dart-lang-skills` — nome congelado, I5).
export function aggregatedLicenseName(source, table = SOURCE_LICENSES) {
  const declared = table?.[source]?.licenseFile;
  if (typeof declared === "string" && declared) return declared;
  return `LICENSE-${String(source).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()}`;
}

// Hash esperado dos bytes do LICENSE de uma fonte: o `sha256` congelado
// quando declarado; senao derivado do `licenseText`. `null` = nao ha como
// verificar a licenca agregada (o `--check` trata como FAIL, fail-closed).
export function expectedLicenseSha(entry) {
  if (!entry) return null;
  if (typeof entry.sha256 === "string" && entry.sha256) return entry.sha256;
  if (typeof entry.licenseText === "string" && entry.licenseText) return sha256(entry.licenseText);
  return null;
}

export class VendorError extends Error {
  constructor(message, code = "VENDOR") {
    super(message);
    this.name = "VendorError";
    this.code = code;
  }
}

export function sha256(data) {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return createHash("sha256").update(buf).digest("hex");
}

// Recursivo, lstat (nao segue symlink). Symlinks sao reportados, nunca lidos.
// A RAIZ tambem e classificada: um diretorio simlinkado (readdir segue) e
// reportado como symlink "." e nunca percorrido (fail-closed).
export function listTree(dir) {
  const files = [];
  const symlinks = [];
  let root;
  try {
    root = fs.lstatSync(dir);
  } catch {
    return { files, symlinks };
  }
  if (root.isSymbolicLink()) return { files, symlinks: ["."] };
  if (!root.isDirectory()) return { files, symlinks };
  const walk = (abs, rel) => {
    for (const entry of fs.readdirSync(abs)) {
      const p = path.join(abs, entry);
      const r = rel ? `${rel}/${entry}` : entry;
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink()) {
        symlinks.push(r);
      } else if (st.isDirectory()) {
        walk(p, r);
      } else if (st.isFile()) {
        files.push({ rel: r, bytes: fs.readFileSync(p), mode: st.mode & 0o777 });
      }
    }
  };
  walk(dir, "");
  return { files, symlinks };
}

// treeHash = sha256 de (path \0 sha256(bytes)) por arquivo, ordenado, multi-arquivo.
export function treeHash(dir) {
  const { files, symlinks } = listTree(dir);
  if (symlinks.length > 0) {
    throw new VendorError(`symlink proibido no vendor: ${symlinks.join(", ")}`, "SYMLINK");
  }
  const lines = files.map((f) => `${f.rel}\0${sha256(f.bytes)}`).sort();
  return sha256(lines.join("\n"));
}

// Compat com o `computedHash` do skills-lock.json (vercel-labs/skills):
// sha256 de (relativePath + content), por arquivo, ordenado por path.
export function folderComputedHash(dir) {
  const { files } = listTree(dir);
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  const h = createHash("sha256");
  for (const f of files) {
    h.update(f.rel);
    h.update(f.bytes);
  }
  return h.digest("hex");
}

export function detectSpdx(text) {
  if (!text) return null;
  const t = String(text);
  if (/GNU AFFERO GENERAL PUBLIC LICENSE/i.test(t) && /Version 3/i.test(t)) return "AGPL-3.0-only";
  if (/GNU LESSER GENERAL PUBLIC LICENSE/i.test(t) && /Version 3/i.test(t)) return "LGPL-3.0-only";
  if (/GNU GENERAL PUBLIC LICENSE/i.test(t) && /Version 3/i.test(t)) return "GPL-3.0-only";
  if (/GNU GENERAL PUBLIC LICENSE/i.test(t) && /Version 2/i.test(t)) return "GPL-2.0-only";
  if (/Apache License/i.test(t) && /Version 2\.0/i.test(t)) return "Apache-2.0";
  if (/Mozilla Public License/i.test(t) && /2\.0/i.test(t)) return "MPL-2.0";
  if (/Redistribution and use in source and binary forms/i.test(t) && /Neither the name/i.test(t)) return "BSD-3-Clause";
  if (/Redistribution and use in source and binary forms/i.test(t)) return "BSD-2-Clause";
  if (/Permission is hereby granted, free of charge/i.test(t) || /\bMIT License\b/i.test(t)) return "MIT";
  if (/ISC License/i.test(t)) return "ISC";
  if (/This is free and unencumbered software released into the public domain/i.test(t)) return "Unlicense";
  if (/Creative Commons Zero|CC0 1\.0/i.test(t)) return "CC0-1.0";
  return null;
}

const LICENSE_FILE_RE = /^(LICENSE|LICENCE|COPYING|NOTICE)(\.(md|txt))?$/i;

// 1) arquivo de licenca no dir da skill; 2) `license:` no frontmatter do SKILL.md.
// lstat: um LICENSE simlinkado nunca e lido (fail-closed, S4).
export function readDeclaredLicense(skillDir) {
  let root;
  try {
    root = fs.lstatSync(skillDir);
  } catch {
    return null;
  }
  if (root.isSymbolicLink() || !root.isDirectory()) return null;
  for (const entry of fs.readdirSync(skillDir)) {
    if (!LICENSE_FILE_RE.test(entry)) continue;
    const p = path.join(skillDir, entry);
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink() || !st.isFile()) continue;
    const spdx = detectSpdx(fs.readFileSync(p, "utf8"));
    if (spdx) return { spdx, licenseFile: entry };
  }
  const skillMd = path.join(skillDir, "SKILL.md");
  if (fs.existsSync(skillMd)) {
    const text = fs.readFileSync(skillMd, "utf8");
    const m = text.match(/^license:\s*([^\s#]+)/m);
    if (m) return { spdx: m[1], licenseFile: "SKILL.md" };
  }
  return null;
}

// Resolve a licenca e aplica a allowlist SPDX (P-02=(i)). Retorna
// `{ spdx, licenseFile, allowed, fromSource, reason? }` ou null. Uma licenca
// declarada no frontmatter fora da allowlist (`UNLICENSED`/`PROPRIETARY`/…)
// retorna `allowed:false` — o chamador exclui a skill (fail-closed).
export function resolveLicense({ skillDir, source, sourceLicenses }) {
  const declared = readDeclaredLicense(skillDir);
  if (declared) {
    return {
      ...declared,
      allowed: isAllowedSpdx(declared.spdx),
      fromSource: false,
      ...(isAllowedSpdx(declared.spdx) ? {} : { reason: "license-not-allowed" }),
    };
  }
  const table = sourceLicenses ?? SOURCE_LICENSES;
  const src = table[source];
  if (src && src.spdx) {
    const allowed = isAllowedSpdx(src.spdx);
    return {
      spdx: src.spdx,
      licenseFile: aggregatedLicenseName(source, table),
      licenseText: src.licenseText,
      allowed,
      fromSource: true,
      ...(allowed ? {} : { reason: "license-not-allowed" }),
    };
  }
  return null;
}

// FALLBACK de eixo por prefixo conhecido (RF-03/A1): so `dart-`/`flutter-`.
// O eixo normal vem DECLARADO na origem (`stacks` do source-lock); este
// fallback existe apenas para compatibilidade com as skills mobile ja
// vendorizadas (assert de `installer/__tests__/vendor.spec.mjs` congelado).
export function inferStacks(name) {
  if (name.startsWith("dart-")) return ["dart"];
  if (name.startsWith("flutter-")) return ["flutter"];
  return [];
}

export function buildVendor({ sourceDir, sourceLock, sourceLicenses, sourceCommits, destDir }) {
  const src = path.resolve(sourceDir);
  const entries = (sourceLock && sourceLock.skills) || {};
  const commits = sourceCommits || {};
  const vendored = [];
  const excluded = [];
  const skills = {};
  for (const name of Object.keys(entries)) {
    const entry = entries[name];
    const skillDir = path.join(src, name);
    let st;
    try {
      st = fs.lstatSync(skillDir);
    } catch {
      excluded.push({ name, reason: "source-missing" });
      continue;
    }
    // lstat (nao segue): dir de skill simlinkado nunca e percorrido nem
    // vendorizado (fail-closed, P-02/S4).
    if (st.isSymbolicLink()) {
      excluded.push({ name, reason: "symlink" });
      continue;
    }
    if (!st.isDirectory()) {
      excluded.push({ name, reason: "source-missing" });
      continue;
    }
    const license = resolveLicense({ skillDir, source: entry.source, sourceLicenses });
    if (!license) {
      excluded.push({ name, reason: "no-license" });
      continue;
    }
    if (!license.allowed) {
      excluded.push({ name, reason: license.reason ?? "license-not-allowed", license: license.spdx });
      continue;
    }
    const computed = folderComputedHash(skillDir);
    if (entry.computedHash && computed !== entry.computedHash) {
      throw new VendorError(
        `computedHash divergente para ${name}: lock=${entry.computedHash} fonte=${computed}`,
        "HASH_MISMATCH",
      );
    }
    const { files } = listTree(skillDir);
    skills[name] = {
      source: entry.source,
      sourceType: entry.sourceType,
      sourceCommit: commits[entry.source] ?? entry.sourceCommit ?? null,
      skillPath: entry.skillPath,
      computedHash: entry.computedHash,
      treeHash: treeHash(skillDir),
      // RF-03/A1: o eixo da skill vem da ORIGEM declarada no source-lock de
      // entrada. `inferStacks` fica so como FALLBACK para prefixos conhecidos
      // (`dart-`/`flutter-`). Sem declaracao e sem prefixo conhecido => [] =
      // COMUM por desenho (fail-open documentado): a skill entra em TODOS os
      // destinos, quaisquer que sejam os eixos — o gate so existe quando a
      // origem declara o eixo.
      stacks: Array.isArray(entry.stacks) ? [...entry.stacks] : inferStacks(name),
      license: license.spdx,
      licenseFile: license.licenseFile,
    };
    // RF-09/ADR-003: `optional` e metadado de PROCEDENCIA (dependencia externa
    // declarada na origem), aditivo e opcional — ausente = obrigatoria do eixo.
    // `runtimeDeps` documenta a dependencia (rede/@swc/core/MCP) e alimenta o
    // NOTICE; nada e injetado no SKILL.md (byte-identidade preservada).
    if (entry.optional === true) skills[name].optional = true;
    if (Array.isArray(entry.runtimeDeps) && entry.runtimeDeps.length > 0) {
      skills[name].runtimeDeps = [...entry.runtimeDeps];
    }
    // Procedencia do CONTEUDO (aditivo): revisao real da copia quando ela NAO
    // reproduz o `sourceCommit` declarado (achado do Batch 4 — declarado, nunca
    // silenciado). O NOTICE renderiza isto como limitacao nomeada.
    if (typeof entry.contentRevision === "string" && entry.contentRevision) {
      skills[name].contentRevision = entry.contentRevision;
      if (typeof entry.contentRevisionNote === "string" && entry.contentRevisionNote) {
        skills[name].contentRevisionNote = entry.contentRevisionNote;
      }
    }
    vendored.push({ name, source: entry.source, files });
  }
  // Arquivos de licenca agregados (texto completo + copyright) escritos pelo
  // vendor na raiz do dest. Uma entrada por FONTE referenciada que declare
  // `licenseText` na tabela (a skill pode declarar a licenca no proprio dir —
  // nesse caso o agregado continua sendo a evidencia transcrita/do upstream).
  const aggregateBySource = new Map();
  for (const e of Object.values(skills)) {
    if (aggregateBySource.has(e.source)) continue;
    const src2 = (sourceLicenses ?? SOURCE_LICENSES)[e.source];
    if (!src2 || typeof src2.licenseText !== "string" || !src2.licenseText) continue;
    aggregateBySource.set(e.source, {
      source: e.source,
      spdx: src2.spdx,
      file: aggregatedLicenseName(e.source, sourceLicenses ?? SOURCE_LICENSES),
      text: src2.licenseText,
      sha256: expectedLicenseSha(src2),
      licenseOrigin: src2.licenseOrigin ?? null,
      evidence: Array.isArray(src2.evidence) ? src2.evidence : [],
    });
  }
  const licenses = [...aggregateBySource.values()];
  const lock = {
    version: VENDOR_LOCK_VERSION,
    generatedBy: "scripts/vendor-skills.mjs",
    // Hashes das licencas agregadas (sem o texto — ele vive no arquivo na
    // raiz do dest e no NOTICE). Permite ao `--check` validar `LICENSE-<slug>`.
    // `licenseOrigin`/`evidence` (ADR-003) declaram a PROCEDENCIA por fonte.
    licenses: licenses.map(({ source, spdx, file, sha256, licenseOrigin, evidence }) => ({
      source, spdx, file, sha256, licenseOrigin,
      ...(evidence.length > 0 ? { evidence } : {}),
    })),
    skills,
  };
  return { lock, vendored, excluded, destDir, licenses };
}

const SCRIPT_EXT_RE = /\.(sh|bash|zsh|fish|js|mjs|cjs|ts|tsx|py|rb|pl|ps1|bat|cmd|exe|bin|so|dylib|dll|jar)$/i;

function isExecutableFile(f) {
  if ((f.mode ?? 0) & 0o111) return true;
  if (SCRIPT_EXT_RE.test(f.rel)) return true;
  return f.bytes.slice(0, 2).toString("latin1") === "#!";
}

function renderNotice(built) {
  const { lock, excluded } = built;
  const names = Object.keys(lock.skills).sort();
  const originBySource = new Map();
  const aggregateBySourceName = new Map();
  for (const lic of built.licenses ?? []) {
    originBySource.set(lic.source, lic.licenseOrigin ?? "(nao declarada)");
    aggregateBySourceName.set(lic.source, lic.file);
  }
  const sources = new Map();
  for (const name of names) {
    const e = lock.skills[name];
    if (!sources.has(e.source)) {
      sources.set(e.source, { source: e.source, sourceType: e.sourceType, sourceCommit: e.sourceCommit, spdx: e.license, licenseFile: aggregateBySourceName.get(e.source) ?? e.licenseFile });
    }
  }
  const lines = [];
  lines.push("# VENDOR-NOTICE");
  lines.push("");
  lines.push("Vendor de skills de terceiros do harness. Gerado por `scripts/vendor-skills.mjs`.");
  lines.push(`Politica de licenca ${POLICY}: skill sem licenca identificavel NAO e vendorizada (fail-closed).`);
  lines.push("O vendor copia cada skill do source-lock de entrada; o `--check` recomputa o treeHash das skills e o sha dos arquivos de licenca agregados e FALHA em qualquer drift contra o lock commitado (o lock e a referencia de integridade do CI).");
  lines.push("A procedencia da LICENCA varia por FONTE (`licenseOrigin`): `upstream-file` = sha do arquivo de licenca REAL do upstream no commit pinado; `declared-evidence` = licenca declarada por evidencia citada (`evidence[]`) e sha do NOSSO texto transcrito.");
  lines.push("");
  lines.push("## Fontes (proveniencia)");
  lines.push("");
  lines.push("| source | sourceType | sourceCommit | SPDX | licenseOrigin | licenseFile (agregado) |");
  lines.push("|---|---|---|---|---|---|");
  for (const s of sources.values()) {
    lines.push(`| ${s.source} | ${s.sourceType} | ${s.sourceCommit ?? "(unknown)"} | ${s.spdx} | ${originBySource.get(s.source) ?? "-"} | ${s.licenseFile} |`);
  }
  lines.push("");
  lines.push("## Licencas (texto completo + copyright)");
  lines.push("");
  const licenses = built.licenses ?? [];
  if (licenses.length === 0) {
    lines.push("Nenhuma licenca agregada: toda skill retem LICENSE/NOTICE proprio.");
  } else {
    lines.push("Cada licenca abaixo foi escrita na raiz deste diretorio como arquivo agregado");
    lines.push("(o `licenseFile` da fonte). A ORIGEM do texto e declarada por fonte:");
    lines.push("");
    for (const lic of licenses) {
      const origin = lic.licenseOrigin ?? "(nao declarada)";
      lines.push(`### ${lic.source} — ${lic.spdx} (\`${lic.file}\`)`);
      lines.push("");
      lines.push(origin === "upstream-file"
        ? "Origem `upstream-file`: texto byte-identico ao arquivo de licenca do repo upstream no commit pinado (o `--check` recomputa o sha256 e falha em drift)."
        : "Origem `declared-evidence`: o upstream NAO publica arquivo de licenca; o texto foi TRANSCRITO por nos e o `--check` valida o sha do NOSSO texto. A fidelidade da transcricao e 🟡 processo (evidencia citada), NAO garantia de runtime.");
      const evidence = Array.isArray(lic.evidence) ? lic.evidence : [];
      if (evidence.length > 0) {
        lines.push("");
        lines.push("Evidencia:");
        for (const ev of evidence) {
          lines.push(`- ${ev.url} — ${ev.section} (commit \`${ev.commit}\`)${ev.note ? ` — ${ev.note}` : ""}`);
        }
      }
      lines.push("");
      lines.push("```text");
      lines.push(lic.text.replace(/\n$/, ""));
      lines.push("```");
      lines.push("");
    }
  }
  lines.push(`## Skills vendorizadas (${names.length})`);
  lines.push("");
  lines.push("| skill | source | stacks | optional | computedHash | treeHash |");
  lines.push("|---|---|---|---|---|---|");
  for (const name of names) {
    const e = lock.skills[name];
    lines.push(`| ${name} | ${e.source} | ${e.stacks.join(",") || "-"} | ${e.optional === true ? "true" : "-"} | ${e.computedHash} | ${e.treeHash} |`);
  }
  lines.push("");
  const optionalSkills = names.filter((n) => lock.skills[n].optional === true);
  lines.push(`## Skills opcionais (${optionalSkills.length})`);
  lines.push("");
  if (optionalSkills.length === 0) {
    lines.push("Nenhuma skill marcada como opcional.");
  } else {
    lines.push("`optional` e METADADO DE PROCEDENCIA (RF-09/D-3): a skill SEGUE instalada no");
    lines.push("destino do seu eixo — o campo declara dependencia EXTERNA declarada na origem,");
    lines.push("nao \"nao instalar\".");
    lines.push("");
    lines.push("| skill | source | dependencias externas declaradas |");
    lines.push("|---|---|---|");
    for (const n of optionalSkills) {
      lines.push(`| ${n} | ${lock.skills[n].source} | ${(lock.skills[n].runtimeDeps ?? []).join("; ") || "-"} |`);
    }
  }
  lines.push("");
  lines.push(`## Skills excluidas (${excluded.length})`);
  lines.push("");
  lines.push("| skill | motivo |");
  lines.push("|---|---|");
  for (const x of excluded) lines.push(`| ${x.name} | ${x.reason} |`);
  lines.push("");
  lines.push("## Revisao de conteudo (S1/S4)");
  lines.push("");
  const vendored = built.vendored ?? [];
  const allFiles = vendored.flatMap((v) => v.files);
  const execs = allFiles.filter(isExecutableFile);
  lines.push(`Arquivos vendorizados: ${allFiles.length}. Conteudo executavel: ${execs.length}. Symlinks: 0.`);
  if (execs.length) {
    lines.push("");
    lines.push("| skill | arquivo |");
    lines.push("|---|---|");
    for (const v of vendored) {
      for (const f of v.files) if (isExecutableFile(f)) lines.push(`| ${v.name} | ${f.rel} |`);
    }
  }
  lines.push("");
  lines.push("## Build do vendor (RF-13 — source-side, nunca no instalador)");
  lines.push("");
  lines.push(`Source-lock de entrada COMMITADO: \`${SOURCE_LOCK_PATH}\` (declara \`stacks\`, \`optional\` e \`runtimeDeps\` por skill — evidencia auditavel).`);
  lines.push("Reproducao: clonar cada fonte no commit pinado (tabela de fontes acima), expor cada");
  lines.push("skill como `<stage>/<nome-da-skill>` e rodar:");
  lines.push("");
  lines.push("```sh");
  lines.push(`node scripts/vendor-skills.mjs --source <stage> --lock ${SOURCE_LOCK_PATH} \\`);
  lines.push("  --source-commit <source>=<sha>   # um por fonte, pinado");
  lines.push("```");
  lines.push("");
  lines.push("O `--check` roda no CI SEM rede nem clones: o lock commitado e a evidencia.");
  lines.push("");
  lines.push("## Limites declarados");
  lines.push("");
  lines.push("- Rede em RUNTIME dentro de skill opcional (`scripts/fetch-stitch.sh`, `@swc/core`, Stitch MCP) NAO e cacada pelo V15 (escopo `installer/`): 🟠 parcial, declarado.");
  lines.push("- Fidelidade da transcricao das fontes `declared-evidence` e 🟡 processo (evidencia citada), nao garantia de runtime.");
  // AT-1 (review Batch 4): a fidelidade da COPIA ao commit pinado e 🟡 PROCESSO,
  // e as divergencias CONHECIDAS sao NOMEADAS (skill + revisao real + o que
  // difere) — limite generico esconderia divergencia conhecida num artefato de
  // procedencia lido por consumidor.
  const contentDivergentes = names.filter((n) => typeof lock.skills[n].contentRevision === "string" && lock.skills[n].contentRevision);
  lines.push("- Fidelidade byte-a-byte da COPIA DA SKILL ao commit pinado e 🟡 PROCESSO: verificada na vendorizacao e NAO re-verificada pelo `--check` (que compara com o lock commitado).");
  if (contentDivergentes.length === 0) {
    lines.push("  Nenhuma divergencia conhecida contra o commit pinado declarado.");
  } else {
    lines.push(`  Divergencia CONHECIDA e NAO corrigida em ${contentDivergentes.length} skill(s): o \`sourceCommit\` declarado NAO descreve o conteudo delas — a copia veio de outra revisao e foi preservada para nao alterar os hashes congelados do lock (invariante I5 do ciclo).`);
    lines.push("");
    lines.push("  | skill | sourceCommit declarado | revisao real do conteudo | divergencia vs o pin |");
    lines.push("  |---|---|---|---|");
    for (const n of contentDivergentes) {
      const e = lock.skills[n];
      lines.push(`  | ${n} | ${e.sourceCommit ?? "(unknown)"} | ${e.contentRevision} | ${e.contentRevisionNote ?? "-"} |`);
    }
  }
  lines.push("- `.agents/skills/**` esta fora do scan dos canarios (`scripts/static-checks.mjs`).");
  lines.push("");
  return lines.join("\n");
}

export function writeVendor(built, { destDir = built.destDir } = {}) {
  const dest = path.resolve(destDir);
  fs.mkdirSync(dest, { recursive: true });
  for (const v of built.vendored) {
    const target = path.join(dest, v.name);
    fs.rmSync(target, { recursive: true, force: true });
    for (const f of v.files) {
      const p = path.join(target, f.rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, f.bytes);
    }
  }
  // Licencas agregadas na raiz do dest (fora dos dirs das skills — I9).
  for (const lic of built.licenses ?? []) {
    if (!lic.file || lic.file.includes("/") || lic.file.includes("\\")) continue;
    fs.writeFileSync(path.join(dest, lic.file), lic.text);
  }
  fs.writeFileSync(path.join(dest, VENDOR_LOCK_NAME), JSON.stringify(built.lock, null, 2) + "\n");
  fs.writeFileSync(path.join(dest, VENDOR_NOTICE_NAME), renderNotice(built));
  return built;
}

export function checkVendor({ destDir, sourceLicenses } = {}) {
  const dest = path.resolve(destDir);
  const lockPath = path.join(dest, VENDOR_LOCK_NAME);
  const base = {
    errors: [],
    missing: [],
    divergences: [],
    symlinks: [],
    licenseMissing: [],
    licenseDivergences: [],
    licenseSymlinks: [],
  };
  if (!fs.existsSync(lockPath)) {
    return { ok: false, ...base, errors: [`lock ausente: ${VENDOR_LOCK_NAME}`] };
  }
  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch (e) {
    return { ok: false, ...base, errors: [`lock invalido: ${e.message}`] };
  }
  const skills = (lock && lock.skills) || {};
  const missing = [];
  const divergences = [];
  const symlinks = [];
  const errors = [];
  const licenseMissing = [];
  const licenseDivergences = [];
  const licenseSymlinks = [];
  for (const name of Object.keys(skills)) {
    const dir = path.join(dest, name);
    // lstat na RAIZ: um dir de skill simlinkado (mesmo que aponte para dir
    // valido) e symlink => FAIL. Tambem cobre symlink quebrado (existsSync
    // seguiria e diria "missing").
    let st;
    try {
      st = fs.lstatSync(dir);
    } catch {
      missing.push(name);
      continue;
    }
    if (st.isSymbolicLink()) {
      symlinks.push(name);
      continue;
    }
    if (!st.isDirectory()) {
      missing.push(name);
      continue;
    }
    let tree;
    try {
      tree = listTree(dir);
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
      continue;
    }
    if (tree.symlinks.length > 0) {
      symlinks.push(name);
      continue;
    }
    if (treeHash(dir) !== skills[name].treeHash) divergences.push(name);
  }

  // Licencas agregadas (`LICENSE-<slug>`). O lock registra o sha256 esperado;
  // quando a fonte esta na tabela, o hash congelado (`expectedLicenseSha`)
  // prevalece — divergencia entre lock e fonte e erro (desalinhados). Sem
  // hash esperado => FAIL (fail-closed): apagar/adulterar o arquivo nunca
  // passa silencioso.
  const table = sourceLicenses ?? SOURCE_LICENSES;
  const recorded = new Map();
  for (const lic of Array.isArray(lock.licenses) ? lock.licenses : []) {
    if (lic && typeof lic.file === "string" && lic.file) recorded.set(lic.file, lic.sha256 ?? null);
  }
  const expected = new Map();
  // FU-30: mismatch lock-vs-fonte e por ARQUIVO agregado, nao por skill —
  // N skills da mesma fonte repetiam a MESMA linha de erro (22x no vendor
  // mobile). Um Map por arquivo colapsa em uma mensagem.
  const mismatchByFile = new Map();
  for (const name of Object.keys(skills)) {
    const e = skills[name] || {};
    const file = e.licenseFile;
    if (typeof file !== "string" || !file || file.includes("/") || file.includes("\\")) continue;
    if (file !== aggregatedLicenseName(e.source, table)) continue;
    const src = table[e.source];
    const fromTable = src ? expectedLicenseSha(src) : null;
    const fromLock = recorded.has(file) ? recorded.get(file) : null;
    if (fromTable && fromLock && fromTable !== fromLock) {
      if (!mismatchByFile.has(file)) {
        mismatchByFile.set(file, { fromLock, fromTable });
      }
    }
    const want = fromTable ?? fromLock;
    if (!want) {
      errors.push(`${file}: sem hash esperado para a licenca agregada (nao verificavel)`);
      continue;
    }
    if (expected.has(file) && expected.get(file) !== want) {
      errors.push(`${file}: hash esperado ambiguo`);
      continue;
    }
    expected.set(file, want);
  }
  for (const [file, m] of mismatchByFile) {
    errors.push(`${file}: hash da licenca divergente (lock=${m.fromLock} fonte=${m.fromTable})`);
  }
  // Entradas registradas no lock mas nao referenciadas por nenhuma skill
  // ainda sao validadas (nao ha arquivo agregado orfao passando em branco).
  for (const [file, h] of recorded) {
    if (h && !expected.has(file)) expected.set(file, h);
  }
  for (const [file, want] of expected) {
    const p = path.join(dest, file);
    let st;
    try {
      st = fs.lstatSync(p);
    } catch {
      licenseMissing.push(file);
      continue;
    }
    if (st.isSymbolicLink()) {
      licenseSymlinks.push(file);
      continue;
    }
    if (!st.isFile()) {
      licenseMissing.push(file);
      continue;
    }
    if (sha256(fs.readFileSync(p)) !== want) licenseDivergences.push(file);
  }

  const ok =
    missing.length === 0 &&
    divergences.length === 0 &&
    symlinks.length === 0 &&
    errors.length === 0 &&
    licenseMissing.length === 0 &&
    licenseDivergences.length === 0 &&
    licenseSymlinks.length === 0;
  return {
    ok,
    errors,
    missing,
    divergences,
    symlinks,
    licenseMissing,
    licenseDivergences,
    licenseSymlinks,
  };
}

function parseArgs(argv) {
  const out = { check: false, source: null, lock: null, dest: null, commits: {}, licenses: {}, json: false, help: false };
  const assign = (map, raw, flag) => {
    const i = raw.indexOf("=");
    if (i < 0) throw new VendorError(`${flag} exige <source>=<valor>`, "BAD_ARG");
    map[raw.slice(0, i)] = raw.slice(i + 1);
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--check") out.check = true;
    else if (a === "--source") out.source = argv[++i];
    else if (a === "--lock") out.lock = argv[++i];
    else if (a === "--dest") out.dest = argv[++i];
    else if (a === "--source-commit") assign(out.commits, argv[++i], "--source-commit");
    else if (a === "--source-license") assign(out.licenses, argv[++i], "--source-license");
    else if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else throw new VendorError(`flag desconhecida: ${a}`, "BAD_ARG");
  }
  return out;
}

const USAGE = `uso:
  node scripts/vendor-skills.mjs --source <dir> --lock <skills-lock.json> [--dest <dir>]
  node scripts/vendor-skills.mjs --check [--dest <dir>]`;

export function main(argv = process.argv.slice(2), { root = REPO_ROOT, log = console.log } = {}) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    log(`erro: ${e.message}`);
    return 2;
  }
  if (opts.help) {
    log(USAGE);
    return 0;
  }
  const destDir = opts.dest ? path.resolve(opts.dest) : path.join(root, ".agents", "skills");

  if (opts.check) {
    const res = checkVendor({ destDir });
    if (res.ok) {
      log(`vendor-check OK (${path.relative(root, path.join(destDir, VENDOR_LOCK_NAME))})`);
      return 0;
    }
    if (res.errors.length) for (const e of res.errors) log(`  error: ${e}`);
    for (const n of res.missing) log(`  missing: ${n}`);
    for (const n of res.divergences) log(`  divergent: ${n}`);
    for (const n of res.symlinks) log(`  symlink: ${n}`);
    for (const n of res.licenseMissing ?? []) log(`  missing-license: ${n}`);
    for (const n of res.licenseDivergences ?? []) log(`  divergent-license: ${n}`);
    for (const n of res.licenseSymlinks ?? []) log(`  symlink-license: ${n}`);
    log("vendor-check FAIL");
    return 1;
  }

  if (!opts.source || !opts.lock) {
    log(USAGE);
    return 2;
  }
  const sourceLock = JSON.parse(fs.readFileSync(path.resolve(opts.lock), "utf8"));
  const sourceLicenses = { ...SOURCE_LICENSES, ...opts.licenses };
  const sourceCommits = { ...opts.commits };
  for (const source of new Set(Object.values(sourceLock.skills || {}).map((s) => s.source))) {
    if (!sourceCommits[source]) {
      const sha = resolveRemoteCommit(source);
      if (sha) sourceCommits[source] = sha;
    }
  }
  const built = buildVendor({
    sourceDir: opts.source,
    sourceLock,
    sourceLicenses,
    sourceCommits,
    destDir,
  });
  writeVendor(built, { destDir });
  const summary = {
    vendored: built.vendored.map((v) => v.name),
    excluded: built.excluded,
    dest: path.relative(root, destDir),
  };
  if (opts.json) log(JSON.stringify(summary, null, 2));
  else {
    log(`vendored ${summary.vendored.length}: ${summary.vendored.join(", ")}`);
    for (const x of summary.excluded) log(`excluded ${x.name}: ${x.reason}`);
  }
  return 0;
}

// Best-effort source-side apenas (a fonte local ja e a fonte preferida).
function resolveRemoteCommit(source) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(source)) return null;
  try {
    const out = execFileSync("git", ["ls-remote", `https://github.com/${source}`, "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15000,
    });
    const m = out.match(/^([0-9a-f]{40})\s/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
